import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { Product } from "@/lib/catalog";
import femaleAsset from "@/assets/female_avatar.glb.asset.json";
import maleAsset from "@/assets/male_avatar.glb.asset.json";

// Kept for backwards-compat with SmartFit.tsx import.
export const OUTFIT_IMAGE_MAP: Record<string, string> = {};

type Fit = "tight" | "perfect" | "relaxed" | "oversized";
type Gender = "Female" | "Male" | "Unisex";
type BodyType =
  | "Slim" | "Athletic" | "Regular" | "Curvy" | "Plus" | "Plus Size" | "Pear" | "Rectangle";

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

useGLTF.preload(FEMALE_URL);
useGLTF.preload(MALE_URL);

/* ──────────────── Morph target mapping ──────────────── */

type MorphKey = "slim" | "athletic" | "curvy" | "plusSize" | "weight";
type MorphTargets = Partial<Record<MorphKey, number>>;

const MORPH_ALIASES: Record<MorphKey, string[]> = {
  slim: ["slim", "thin", "lean"],
  athletic: ["athletic", "muscular", "sport", "fit"],
  curvy: ["curvy", "curve", "pear", "hourglass"],
  plusSize: ["plussize", "plus_size", "plus size", "plus", "large", "heavy"],
  weight: ["weight", "bodyweight", "body_weight"],
};

function normalizeMorphName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function morphValueForName(name: string, targets: MorphTargets): number {
  const normalized = normalizeMorphName(name);
  for (const [key, aliases] of Object.entries(MORPH_ALIASES) as [MorphKey, string[]][]) {
    if (aliases.some((a) => normalizeMorphName(a) === normalized)) return targets[key] ?? 0;
  }
  return 0;
}

// Reset all to 0, then apply exactly one body type.
function targetsFor(weight: number, gender: Gender, bodyType: BodyType): MorphTargets {
  const t: MorphTargets = { weight: 0, slim: 0, athletic: 0, curvy: 0, plusSize: 0 };
  switch (bodyType) {
    case "Slim":
    case "Rectangle":
      t.slim = 1; break;
    case "Athletic":
      t.athletic = 1; break;
    case "Curvy":
    case "Pear":
      t.curvy = 1; break;
    case "Plus":
    case "Plus Size":
      t.plusSize = 1; break;
    case "Regular":
    default:
      if (gender === "Male") {
        t.weight = Math.max(0, Math.min(1, (weight - 60) / 60));
      }
      break;
  }
  return t;
}

/* ──────────────── Avatar ──────────────── */

function Avatar({
  url,
  targets,
  heightScale,
  rotationY,
}: {
  url: string;
  targets: MorphTargets;
  heightScale: number;
  rotationY: number;
}) {
  const { scene } = useGLTF(url) as unknown as { scene: THREE.Group };

  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Group;
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      // Hide any high-poly / detail layer that causes faceted artifacts
      if (mesh.name.toLowerCase().includes("high-poly")) {
        mesh.visible = false;
        return;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Reset all morph influences to 0 (basis)
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);

      // Clean matte retail-mannequin material
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e9d6c4"),
        roughness: 0.55,
        metalness: 0.02,
      });
      // Smooth shading: recompute vertex normals so faceted GLBs read smooth.
      const geom = mesh.geometry as THREE.BufferGeometry;
      if (geom && !geom.attributes.normal) geom.computeVertexNormals();
      mesh.material = mat;
    });
    c.updateMatrixWorld(true);
    return c;
  }, [scene]);

  // Normalize transform: scale to ~1.8m, center on origin, feet on floor.
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const modelHeight = Math.max(size.y, 0.001);
    return {
      scale: (1.8 * heightScale) / modelHeight,
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    };
  }, [cloned, heightScale]);

  // Smoothly lerp morph influences each frame.
  useFrame(() => {
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const dict = m.morphTargetDictionary;
      const infl = m.morphTargetInfluences;
      if (!dict || !infl) return;
      for (const [name, idx] of Object.entries(dict)) {
        const target = morphValueForName(name, targets);
        infl[idx] = THREE.MathUtils.lerp(infl[idx], target, 0.15);
      }
    });
  });

  const groupRef = useRef<THREE.Group>(null);
  return (
    <group ref={groupRef} position={[0, -0.9, 0]} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={cloned} position={offset.toArray()} />
    </group>
  );
}

/* ──────────────── Scene wrapper ──────────────── */

function fitLabel(fit: Fit) {
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
}: MannequinProps) {
  const url = gender === "Male" ? MALE_URL : FEMALE_URL;
  const targets = useMemo(() => targetsFor(weight, gender, bodyType), [weight, gender, bodyType]);
  const heightScale = useMemo(
    () => 0.88 + ((Math.max(140, Math.min(210, height)) - 140) / 70) * 0.24,
    [height],
  );

  // Debug log once per gender/bodyType change
  useEffect(() => {
    console.info("[SmartFit Avatar]", { url, gender, bodyType, height, weight, targets });
  }, [url, gender, bodyType, height, weight, targets]);

  return (
    <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-b from-[#1a1622] via-[#0f0d18] to-[#080610] border border-white/5 shadow-2xl">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.0, 4.4], fov: 28 }} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={["#0f0d18"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-2.5, 1.5, -1]} intensity={0.6} color="#c4b5fd" />
        <directionalLight position={[0, 1.2, -2.5]} intensity={0.45} color="#ec4f8a" />
        <spotLight position={[0, 3.5, 2.2]} intensity={0.8} angle={0.6} penumbra={1} color="#ffffff" />
        <Suspense fallback={null}>
          <Avatar
            key={url}
            url={url}
            targets={targets}
            heightScale={heightScale}
            rotationY={THREE.MathUtils.degToRad(rotation)}
          />
          <ContactShadows position={[0, -0.9, 0]} opacity={0.6} scale={3.5} blur={2.6} far={1.5} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={2.6}
          maxDistance={6.5}
          minPolarAngle={Math.PI / 3.2}
          maxPolarAngle={Math.PI / 1.9}
          target={[0, 0.0, 0]}
        />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">{gender} · {bodyType}</span>
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">{height}cm · {weight}kg</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">
          {product ? `${product.brand} · ${product.name}` : "Mannequin"}
        </span>
        <span className="rounded-full bg-[var(--color-myntra-glow,#ec4f8a)]/80 text-white px-2 py-0.5 backdrop-blur">
          {fitLabel(fit)}
        </span>
      </div>
    </div>
  );
}

export default Mannequin;
