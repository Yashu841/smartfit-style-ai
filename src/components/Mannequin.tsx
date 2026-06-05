import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { Product } from "@/lib/catalog";
import femaleAsset from "@/assets/female_avatar.glb.asset.json";
import maleAsset from "@/assets/male_avatar.glb.asset.json";

// Kept for backwards-compat with SmartFit.tsx import.
export const OUTFIT_IMAGE_MAP: Record<string, string> = {};

type Fit = "tight" | "perfect" | "relaxed" | "oversized";
type Gender = "Female" | "Male" | "Unisex";
type BodyType = "Slim" | "Athletic" | "Regular" | "Curvy" | "Plus" | "Plus Size" | "Pear" | "Rectangle";

export type MannequinProps = {
  height?: number;
  weight?: number;
  gender?: Gender;
  bodyType?: BodyType;
  fit?: Fit;
  rotation?: number;
  scanning?: boolean;
  product?: Product | null;
  footwear?: Product | null;
  bag?: Product | null;
  accessory?: Product | null;
  showSkeleton?: boolean;
};

const FEMALE_URL = femaleAsset.url;
const MALE_URL = maleAsset.url;

// Preload both avatars so gender switching is instant.
useGLTF.preload(FEMALE_URL);
useGLTF.preload(MALE_URL);

/* ──────────────── Morph target mapping ──────────────── */

type MorphTargets = {
  slim?: number;
  athletic?: number;
  curvy?: number;
  plusSize?: number;
  weight?: number;
};

const DEFAULT_MORPH_STATE: Required<MorphTargets> = {
  weight: 0,
  slim: 0,
  athletic: 0,
  curvy: 0,
  plusSize: 0,
};

const BODY_TYPE_TO_MORPH_MAPPING: Record<string, string | null> = {
  "Female:Slim": "slim",
  "Female:Athletic": "athletic",
  "Female:Curvy": "curvy",
  "Female:Plus Size": "plusSize",
  "Female:Plus": "plusSize",
  "Male:Slim": "slim",
  "Male:Athletic": "athletic",
  "Male:Plus Size": "plusSize",
  "Male:Plus": "plusSize",
  "Unisex:Slim": "slim",
  "Unisex:Athletic": "athletic",
  "Unisex:Curvy": "curvy",
  "Unisex:Plus Size": "plusSize",
  "Unisex:Plus": "plusSize",
  Regular: null,
  Pear: "curvy",
  Rectangle: "slim",
};

const MORPH_ALIASES: Record<keyof Required<MorphTargets>, string[]> = {
  weight: ["weight", "bodyweight", "body_weight", "heavy"],
  slim: ["slim", "thin", "lean"],
  athletic: ["athletic", "muscular", "sport"],
  curvy: ["curvy", "curve", "pear"],
  plusSize: ["plussize", "plus_size", "plus size", "plus", "large"],
};

function normalizeMorphName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function morphValueForName(name: string, targets: MorphTargets) {
  const normalized = normalizeMorphName(name);
  for (const [key, aliases] of Object.entries(MORPH_ALIASES) as [keyof Required<MorphTargets>, string[]][]) {
    if (aliases.some((alias) => normalizeMorphName(alias) === normalized)) return targets[key] ?? 0;
  }
  return 0;
}

function targetsFor(
  weight: number,
  gender: Gender,
  bodyType: BodyType,
): MorphTargets {
  // Weight morph: neutral fitting-room default (60kg) → 0, 150kg → 1, clamped.
  const weightMorph = Math.max(0, Math.min(1, (weight - 60) / 90));

  const t: MorphTargets = { weight: weightMorph };

  switch (bodyType) {
    case "Slim":
    case "Rectangle":
      t.slim = 1;
      break;
    case "Athletic":
      t.athletic = 1;
      break;
    case "Curvy":
    case "Pear":
      if (gender !== "Male") t.curvy = 1;
      break;
    case "Plus Size":
    case "Plus":
      t.plusSize = 1;
      break;
    case "Regular":
    default:
      // neutral baseline
      break;
  }
  return t;
}

/* ──────────────── Avatar component ──────────────── */

type AvatarProps = {
  url: string;
  targets: MorphTargets;
  heightScale: number;
  rotationY: number;
  garmentTopColor?: string | null;
  garmentBottomColor?: string | null;
};

function Avatar({ url, targets, heightScale, rotationY, garmentTopColor, garmentBottomColor }: AvatarProps) {
  const { scene, animations } = useGLTF(url) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const normalizedTransform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const modelHeight = Math.max(size.y, size.x, size.z, 1);
    return {
      scale: (1.95 * heightScale) / modelHeight,
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      sourceBounds: {
        min: box.min.toArray(),
        max: box.max.toArray(),
        size: size.toArray(),
      },
    };
  }, [scene, heightScale]);

  // Clone so multiple instances / re-renders don't fight each other.
  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Group;
    const detectedMorphTargets: { mesh: string; target: string; index: number; defaultValue: number }[] = [];
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          (mesh as THREE.SkinnedMesh).skeleton.pose();
        }
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences.fill(0);
        }
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          for (const [target, index] of Object.entries(mesh.morphTargetDictionary)) {
            detectedMorphTargets.push({
              mesh: mesh.name || "Unnamed mesh",
              target,
              index,
              defaultValue: mesh.morphTargetInfluences[index] ?? 0,
            });
          }
        }
        // Premium matte dark skin material
        const baseMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#1d1a24"),
          roughness: 0.55,
          metalness: 0.05,
          clearcoat: 0.25,
          clearcoatRoughness: 0.6,
          sheen: 0.4,
          sheenColor: new THREE.Color("#3a2a44"),
        });
        mesh.material = baseMat;
      }
    });
    c.updateMatrixWorld(true);
    console.info("[SmartFit Avatar Debug]", {
      avatarUrl: url,
      genderToAvatarMapping: {
        Female: FEMALE_URL,
        Male: MALE_URL,
        Unisex: FEMALE_URL,
      },
      bodyTypeToMorphMapping: BODY_TYPE_TO_MORPH_MAPPING,
      defaultState: DEFAULT_MORPH_STATE,
      detectedMorphTargets,
      animations: animations.map((clip) => clip.name),
      sourceBounds: normalizedTransform.sourceBounds,
      pose: "Imported skeleton bind pose; no procedural pose deformation applied.",
    });
    return c;
  }, [scene, animations, url, normalizedTransform.sourceBounds]);

  // Build garment overlay meshes that share the morph-targeted geometry.
  const overlays = useMemo(() => {
    const list: { mesh: THREE.Mesh; sourceName: string; region: "top" | "bottom" }[] = [];
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const geom = m.geometry as THREE.BufferGeometry;
      if (!geom || !geom.morphAttributes || !geom.morphAttributes.position) return;
      // Skip the high-poly hair/detail layer for garments – only use the main body.
      if (!m.name.toLowerCase().includes("avatar")) return;

      const bbox = new THREE.Box3().setFromBufferAttribute(geom.attributes.position as THREE.BufferAttribute);
      const minY = bbox.min.y;
      const maxY = bbox.max.y;
      const heightSpan = maxY - minY;

      // TOP garment: clip below waistline (~55% up the body)
      const topMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#888"),
        roughness: 0.7,
        metalness: 0.0,
        clearcoat: 0.15,
        side: THREE.DoubleSide,
        clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(minY + heightSpan * 0.45))],
      });
      const topMesh = new THREE.Mesh(geom, topMat);
      topMesh.scale.set(1.018, 1.005, 1.018);
      topMesh.position.copy(m.position);
      topMesh.rotation.copy(m.rotation);
      topMesh.morphTargetInfluences = m.morphTargetInfluences ? [...m.morphTargetInfluences] : undefined;
      topMesh.morphTargetDictionary = m.morphTargetDictionary;
      topMesh.visible = false;
      topMesh.renderOrder = 2;
      m.parent?.add(topMesh);
      list.push({ mesh: topMesh, sourceName: m.name, region: "top" });

      // BOTTOM garment: clip above hips (~55%)
      const botMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#444"),
        roughness: 0.75,
        metalness: 0.0,
        clearcoat: 0.1,
        side: THREE.DoubleSide,
        clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, -1, 0), minY + heightSpan * 0.5)],
      });
      const botMesh = new THREE.Mesh(geom, botMat);
      botMesh.scale.set(1.022, 1.002, 1.022);
      botMesh.position.copy(m.position);
      botMesh.rotation.copy(m.rotation);
      botMesh.morphTargetInfluences = m.morphTargetInfluences ? [...m.morphTargetInfluences] : undefined;
      botMesh.morphTargetDictionary = m.morphTargetDictionary;
      botMesh.visible = false;
      botMesh.renderOrder = 2;
      m.parent?.add(botMesh);
      list.push({ mesh: botMesh, sourceName: m.name, region: "bottom" });
    });
    return list;
  }, [cloned]);

  // Smoothly interpolate morph target influences each frame.
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const dict = m.morphTargetDictionary;
      const infl = m.morphTargetInfluences;
      if (!dict || !infl) return;

      for (const [name, idx] of Object.entries(dict)) {
        const target = morphValueForName(name, targets);
        infl[idx] = THREE.MathUtils.lerp(infl[idx], target, 0.12);
      }

      // Mirror morphs to overlay meshes
      for (const o of overlays) {
        if (o.sourceName !== m.name) continue;
        if (o.mesh.morphTargetInfluences) {
          for (let i = 0; i < infl.length; i++) {
            o.mesh.morphTargetInfluences[i] = infl[i];
          }
        }
      }
    });
  });

  // Apply garment colours / visibility
  useEffect(() => {
    for (const o of overlays) {
      const color = o.region === "top" ? garmentTopColor : garmentBottomColor;
      o.mesh.visible = !!color;
      if (color) {
        (o.mesh.material as THREE.MeshPhysicalMaterial).color = new THREE.Color(color);
      }
    }
  }, [overlays, garmentTopColor, garmentBottomColor]);

  // The uploaded GLBs already contain their own upright node rotation.
  // Keep that native transform, normalize from the actual source bounds.
  return (
    <group ref={groupRef} position={[0, -0.93, 0]} rotation={[0, rotationY, 0]} scale={normalizedTransform.scale}>
      <primitive object={cloned} position={normalizedTransform.offset.toArray()} />
    </group>
  );
}

/* ──────────────── Garment slot routing ──────────────── */

function garmentSlots(product?: Product | null): { top?: string; bottom?: string; dress?: string } {
  if (!product) return {};
  const cat = product.category;
  const color = product.color;
  if (cat === "Dress") return { top: color, bottom: color };
  if (["Top", "Shirt", "T-Shirt", "Blazer", "Jacket", "Hoodie"].includes(cat)) return { top: color };
  if (["Jeans", "Trousers", "Skirt"].includes(cat)) return { bottom: color };
  return {};
}

/* ──────────────── Scene + exported component ──────────────── */

function fitLabel(fit: Fit): string {
  return fit === "tight" ? "Tight" : fit === "perfect" ? "Perfect Fit" : fit === "relaxed" ? "Relaxed" : "Oversized";
}

export function Mannequin({
  height = 168,
  weight = 60,
  gender = "Female",
  bodyType = "Regular",
  fit = "perfect",
  rotation = 0,
  product,
  footwear,
  bag,
  accessory,
}: MannequinProps) {
  const url = gender === "Male" ? MALE_URL : FEMALE_URL;
  const targets = useMemo(
    () => targetsFor(weight, gender, bodyType),
    [weight, gender, bodyType],
  );
  // Height 140-210cm → scale 0.86-1.18
  const heightScale = useMemo(
    () => 0.86 + ((Math.max(140, Math.min(210, height)) - 140) / 70) * 0.32,
    [height],
  );
  const slots = useMemo(() => garmentSlots(product), [product]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-b from-[#1a1622] via-[#0f0d18] to-[#080610] border border-white/5 shadow-2xl">
      {mounted && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0.1, 3.2], fov: 32 }}
          gl={{ antialias: true, alpha: true, localClippingEnabled: true }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
          }}
        >
          <color attach="background" args={["#0f0d18"]} />
          <ambientLight intensity={0.45} />
          <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-2.5, 1.5, -1]} intensity={0.8} color="#a78bfa" />
          <directionalLight position={[0, 1.2, -2.5]} intensity={0.6} color="#ec4f8a" />
          <spotLight position={[0, 3.2, 1.8]} intensity={0.9} angle={0.55} penumbra={1} color="#ffffff" />
          <Suspense fallback={null}>
            <Avatar
              url={url}
              targets={targets}
              heightScale={heightScale}
              rotationY={THREE.MathUtils.degToRad(rotation)}
              key={url}
              garmentTopColor={slots.top ?? null}
              garmentBottomColor={slots.bottom ?? null}
            />
            <ContactShadows position={[0, -0.9, 0]} opacity={0.7} scale={3.5} blur={2.6} far={1.5} />
            <Environment preset="studio" />
          </Suspense>
          <OrbitControls
            enablePan
            enableZoom
            minDistance={2.0}
            maxDistance={6}
            minPolarAngle={Math.PI / 5}
            maxPolarAngle={Math.PI / 1.7}
            target={[0, 0.05, 0]}
          />
        </Canvas>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">{gender} · {bodyType}</span>
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">{height}cm · {weight}kg</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">
          {product ? `${product.brand} · ${product.name}` : "No outfit"}
        </span>
        <span className="rounded-full bg-[var(--color-myntra-glow,#ec4f8a)]/80 text-white px-2 py-0.5 backdrop-blur">
          {fitLabel(fit)}
        </span>
      </div>
      {bag && (
        <div className="pointer-events-none absolute bottom-12 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur">
          + {bag.name}
        </div>
      )}
      {accessory && (
        <div className="pointer-events-none absolute top-12 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur">
          + {accessory.name}
        </div>
      )}
    </div>
  );
}

export default Mannequin;
