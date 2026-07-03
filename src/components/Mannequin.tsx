import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { Product } from "@/lib/catalog";
import femaleAsset from "@/assets/female_avatar.glb.asset.json";
import maleAsset from "@/assets/male_avatar.glb.asset.json";
import baseFemaleImage from "@/assets/mannequin/base-female.jpg";
import baseMaleImage from "@/assets/mannequin/base-male.jpg";
import accJacketCreamImage from "@/assets/mannequin/acc-jacket-cream.jpg";
import hmBlackMiniImage from "@/assets/mannequin/hm-black-mini.jpg";
import hmBlazerMImage from "@/assets/mannequin/hm-blazer-m.jpg";
import hmMiniSkirtImage from "@/assets/mannequin/hm-mini-skirt.jpg";
import hrxHoodieImage from "@/assets/mannequin/hrx-hoodie.jpg";
import levis501Image from "@/assets/mannequin/levis-501.jpg";
import levisMomImage from "@/assets/mannequin/levis-mom.jpg";
import mangoBlazerImage from "@/assets/mannequin/mango-blazer.jpg";
import mangoFloralImage from "@/assets/mannequin/mango-floral.jpg";
import roadsterTeeImage from "@/assets/mannequin/roadster-tee.jpg";
import zaraBikerImage from "@/assets/mannequin/zara-biker.jpg";
import zaraOxfordImage from "@/assets/mannequin/zara-oxford.jpg";
import zaraPinkDressImage from "@/assets/mannequin/zara-pink-dress.jpg";
import zaraSilkBlouseImage from "@/assets/mannequin/zara-silk-blouse.jpg";
import zaraTrousersImage from "@/assets/mannequin/zara-trousers.jpg";

// Kept for backwards-compat with SmartFit.tsx import.
export const OUTFIT_IMAGE_MAP: Record<string, string> = {
  "acc-jacket-cream": accJacketCreamImage,
  "hm-black-mini": hmBlackMiniImage,
  "hm-blazer-m": hmBlazerMImage,
  "hm-mini-skirt": hmMiniSkirtImage,
  "hrx-hoodie": hrxHoodieImage,
  "levis-501": levis501Image,
  "levis-mom": levisMomImage,
  "mango-blazer": mangoBlazerImage,
  "mango-floral": mangoFloralImage,
  "roadster-tee": roadsterTeeImage,
  "zara-biker": zaraBikerImage,
  "zara-oxford": zaraOxfordImage,
  "zara-pink-dress": zaraPinkDressImage,
  "zara-silk-blouse": zaraSilkBlouseImage,
  "zara-trousers": zaraTrousersImage,
};

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
  const neutralHeight = gender === "Male" ? 176 : 164;
  const estimatedBmi = weight / Math.pow(neutralHeight / 100, 2);
  const weightMorph = THREE.MathUtils.clamp((estimatedBmi - 22) / 16, 0, 0.85);
  const t: MorphTargets = { weight: 0, slim: 0, athletic: 0, curvy: 0, plusSize: 0 };
  switch (bodyType) {
    case "Slim":
    case "Rectangle":
      t.slim = 0.9; break;
    case "Athletic":
      t.athletic = 0.9; break;
    case "Curvy":
    case "Pear":
      t.curvy = gender === "Male" ? 0 : 0.9; break;
    case "Plus":
    case "Plus Size":
      t.plusSize = 1; break;
    case "Regular":
    default:
      break;
  }
  t.weight = bodyType === "Slim" ? Math.min(weightMorph, 0.18) : weightMorph;
  return t;
}

type BodyScales = {
  avatarWidth: number;
  avatarDepth: number;
  imageWidth: number;
  imageHeight: number;
  imageLift: number;
};

function calculateBodyScales(height: number, weight: number, gender: Gender, bodyType: BodyType, fit: Fit): BodyScales {
  const clampedHeight = THREE.MathUtils.clamp(height, 140, 210);
  const clampedWeight = THREE.MathUtils.clamp(weight, 35, 150);
  const bmi = clampedWeight / Math.pow(clampedHeight / 100, 2);
  const weightWidth = THREE.MathUtils.clamp((bmi - 22) / 18, -0.22, 0.42);
  const weightDepth = THREE.MathUtils.clamp((bmi - 22) / 22, -0.14, 0.3);

  const typeWidth: Record<BodyType, number> = {
    Slim: -0.14,
    Athletic: gender === "Male" ? 0.12 : 0.07,
    Regular: 0,
    Curvy: gender === "Male" ? 0.03 : 0.18,
    Pear: gender === "Male" ? 0.02 : 0.2,
    Rectangle: -0.05,
    Plus: 0.3,
    "Plus Size": 0.3,
  };
  const fitEase = fit === "tight" ? -0.03 : fit === "relaxed" ? 0.025 : fit === "oversized" ? 0.06 : 0;
  const heightVisual = 0.94 + ((clampedHeight - 140) / 70) * 0.16;
  const bodyWidth = THREE.MathUtils.clamp(1 + weightWidth + (typeWidth[bodyType] ?? 0), 0.74, 1.5);
  const bodyDepth = THREE.MathUtils.clamp(1 + weightDepth + ((typeWidth[bodyType] ?? 0) * 0.55), 0.82, 1.34);

  return {
    avatarWidth: bodyWidth,
    avatarDepth: bodyDepth,
    imageWidth: THREE.MathUtils.clamp(bodyWidth + fitEase, 0.78, 1.48),
    imageHeight: THREE.MathUtils.clamp(heightVisual, 0.92, 1.12),
    imageLift: (heightVisual - 1) * -18,
  };
}

/* ──────────────── Avatar ──────────────── */

function Avatar({
  url,
  targets,
  heightScale,
  widthScale,
  depthScale,
  rotationY,
}: {
  url: string;
  targets: MorphTargets;
  heightScale: number;
  widthScale: number;
  depthScale: number;
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
    <group
      ref={groupRef}
      position={[0, -0.9, 0]}
      rotation={[0, rotationY, 0]}
      scale={[scale * widthScale, scale, scale * depthScale]}
    >
      <primitive object={cloned} position={offset.toArray()} />
    </group>
  );
}

function DressedTryOnLayer({
  image,
  label,
  scales,
  scanning,
}: {
  image: string;
  label: string;
  scales: BodyScales;
  scanning?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(236,79,138,0.18),transparent_46%)]" />
      <img
        src={image}
        alt={label}
        loading="eager"
        decoding="async"
        className="relative h-full w-full object-cover object-center drop-shadow-[0_30px_45px_rgba(0,0,0,0.55)] transition-transform duration-500 ease-out"
        style={{
          transform: `translateY(${scales.imageLift}px) scaleX(${scales.imageWidth}) scaleY(${scales.imageHeight})`,
          transformOrigin: "center bottom",
        }}
      />
      <div className="absolute inset-x-8 bottom-7 h-10 rounded-[999px] bg-black/35 blur-xl" />
      {scanning && (
        <div className="absolute inset-x-8 top-1/4 h-px animate-pulse bg-gradient-to-r from-transparent via-white/70 to-transparent shadow-[0_0_24px_rgba(236,79,138,0.8)]" />
      )}
    </div>
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
  scanning,
  product,
  showSkeleton,
}: MannequinProps) {
  const url = gender === "Male" ? MALE_URL : FEMALE_URL;
  const targets = useMemo(() => targetsFor(weight, gender, bodyType), [weight, gender, bodyType]);
  const bodyScales = useMemo(
    () => calculateBodyScales(height, weight, gender, bodyType, fit),
    [height, weight, gender, bodyType, fit],
  );
  const heightScale = useMemo(
    () => 0.88 + ((Math.max(140, Math.min(210, height)) - 140) / 70) * 0.24,
    [height],
  );
  const dressedImage = product && !showSkeleton ? OUTFIT_IMAGE_MAP[product.id] : undefined;
  const fallbackBodyImage = !dressedImage ? (gender === "Male" ? baseMaleImage : baseFemaleImage) : undefined;
  const tryOnImage = dressedImage ?? fallbackBodyImage;
  const tryOnLabel = product ? `${product.brand} ${product.name} on SmartFit avatar` : `${gender} SmartFit avatar`;

  // Debug log once per gender/bodyType change
  useEffect(() => {
    console.info("[SmartFit Avatar]", { url, gender, bodyType, height, weight, targets, bodyScales, dressed: Boolean(dressedImage) });
  }, [url, gender, bodyType, height, weight, targets, bodyScales, dressedImage]);

  return (
    <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-b from-[#1a1622] via-[#0f0d18] to-[#080610] border border-white/5 shadow-2xl">
      <Canvas
        className={tryOnImage ? "opacity-0" : "opacity-100"}
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.0, 4.4], fov: 28 }}
        gl={{ antialias: true, alpha: true }}
      >
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
            widthScale={bodyScales.avatarWidth}
            depthScale={bodyScales.avatarDepth}
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

      {tryOnImage && (
        <DressedTryOnLayer
          image={tryOnImage}
          label={tryOnLabel}
          scales={bodyScales}
          scanning={scanning}
        />
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">{gender} · {bodyType}</span>
        <span className="rounded-full bg-black/40 px-2 py-0.5 backdrop-blur">{height}cm · {weight}kg</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-white/70">
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
