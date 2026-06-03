import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Product } from "@/lib/catalog";

// Kept for backwards-compat with SmartFit.tsx import; no longer used by the 3D renderer.
export const OUTFIT_IMAGE_MAP: Record<string, string> = {};

type Fit = "tight" | "perfect" | "relaxed" | "oversized";
type Gender = "Female" | "Male" | "Unisex";
type BodyType = "Slim" | "Athletic" | "Regular" | "Curvy" | "Plus" | "Pear" | "Rectangle";

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

/* ──────────────── Parametric body math ──────────────── */

type Shape = {
  heightScale: number;     // overall vertical multiplier
  shoulderW: number;       // shoulder width factor
  chest: number;           // chest depth/width
  bust: number;            // additional female bust
  waist: number;           // waist radius factor
  hip: number;             // hip radius factor
  thigh: number;           // thigh radius factor
  calf: number;            // calf radius factor
  arm: number;             // upper arm radius
  forearm: number;         // forearm radius
  muscle: number;          // shoulder/biceps bulge
  neck: number;            // neck radius
  skin: string;
  hair: string;
};

function computeShape(
  height: number,
  weight: number,
  gender: Gender,
  bodyType: BodyType,
): Shape {
  // Base heights ~170cm reference. Map 140-210 → 0.86-1.18
  const heightScale = 0.86 + ((Math.max(140, Math.min(210, height)) - 140) / 70) * 0.32;

  // Reference BMI corridor used to push waist/hip/thigh outward
  const bmi = weight / Math.pow(height / 100, 2);
  const fat = Math.max(-0.18, Math.min(0.55, (bmi - 22) / 14)); // -.18 thin → .55 heavy

  const isFemale = gender === "Female";
  const isMale = gender === "Male";

  // Body-type multipliers
  const bt: Record<BodyType, Partial<Shape>> = {
    Slim:      { shoulderW: 0.92, chest: 0.88, waist: 0.82, hip: 0.90, thigh: 0.86, arm: 0.84, muscle: -0.05 },
    Athletic:  { shoulderW: 1.08, chest: 1.06, waist: 0.90, hip: 0.98, thigh: 1.04, arm: 1.08, muscle: 0.18 },
    Regular:   { shoulderW: 1.00, chest: 1.00, waist: 1.00, hip: 1.00, thigh: 1.00, arm: 1.00, muscle: 0.04 },
    Curvy:     { shoulderW: 0.98, chest: 1.04, waist: 0.94, hip: 1.18, thigh: 1.14, arm: 1.00, muscle: 0.02 },
    Pear:      { shoulderW: 0.94, chest: 0.96, waist: 0.96, hip: 1.20, thigh: 1.20, arm: 0.96, muscle: 0.00 },
    Rectangle: { shoulderW: 1.02, chest: 0.98, waist: 1.02, hip: 1.00, thigh: 0.98, arm: 1.00, muscle: 0.02 },
    Plus:      { shoulderW: 1.08, chest: 1.20, waist: 1.30, hip: 1.26, thigh: 1.22, arm: 1.18, muscle: 0.05 },
  };
  const m = bt[bodyType] ?? bt.Regular;

  const shoulderW = (m.shoulderW ?? 1) * (isMale ? 1.10 : 0.96) + fat * 0.05;
  const chest     = (m.chest ?? 1) * (isMale ? 1.06 : 0.96) + fat * 0.18;
  const bust      = isFemale ? 0.10 + (bodyType === "Curvy" ? 0.06 : bodyType === "Plus" ? 0.08 : 0) : 0;
  const waist     = (m.waist ?? 1) * (isFemale ? 0.86 : 1.0) + fat * 0.45;
  const hip       = (m.hip ?? 1) * (isFemale ? 1.08 : 0.98) + fat * 0.28;
  const thigh     = (m.thigh ?? 1) + fat * 0.30;
  const calf      = 0.95 + fat * 0.15 + (m.muscle ?? 0) * 0.4;
  const arm       = (m.arm ?? 1) * (isMale ? 1.08 : 0.94) + fat * 0.20 + (m.muscle ?? 0) * 0.3;
  const forearm   = arm * 0.86;
  const muscle    = m.muscle ?? 0;
  const neck      = 0.92 + (isMale ? 0.08 : 0) + fat * 0.15;

  return {
    heightScale,
    shoulderW, chest, bust, waist, hip, thigh, calf, arm, forearm, muscle, neck,
    // Matte-black digital-clone skin
    skin: "#0e0e12",
    hair: "#0a0a0e",
  };
}

/* ──────────────── Smoothing hook ──────────────── */

function useSmoothShape(target: Shape): Shape {
  const [s, setS] = useState(target);
  const ref = useRef(target);
  useEffect(() => { ref.current = target; }, [target]);
  useFrame((_, dt) => {
    const cur = s;
    const tgt = ref.current;
    const k = Math.min(1, dt * 6);
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const next: Shape = {
      heightScale: lerp(cur.heightScale, tgt.heightScale),
      shoulderW: lerp(cur.shoulderW, tgt.shoulderW),
      chest: lerp(cur.chest, tgt.chest),
      bust: lerp(cur.bust, tgt.bust),
      waist: lerp(cur.waist, tgt.waist),
      hip: lerp(cur.hip, tgt.hip),
      thigh: lerp(cur.thigh, tgt.thigh),
      calf: lerp(cur.calf, tgt.calf),
      arm: lerp(cur.arm, tgt.arm),
      forearm: lerp(cur.forearm, tgt.forearm),
      muscle: lerp(cur.muscle, tgt.muscle),
      neck: lerp(cur.neck, tgt.neck),
      skin: tgt.skin,
      hair: tgt.hair,
    };
    // Only setState when meaningful change to avoid render thrash
    if (Math.abs(next.heightScale - cur.heightScale) > 0.0005 ||
        Math.abs(next.waist - cur.waist) > 0.002 ||
        Math.abs(next.hip - cur.hip) > 0.002 ||
        next.skin !== cur.skin || next.hair !== cur.hair) {
      setS(next);
    }
  });
  return s;
}

/* ──────────────── Garment classification ──────────────── */

type GarmentPlan = {
  top?: { color: string; accent?: string; sleeves: "none" | "short" | "long"; length: "crop" | "regular" | "long" };
  bottom?: { color: string; accent?: string; length: "shorts" | "mini" | "knee" | "long"; kind: "pants" | "skirt" };
  dress?: { color: string; accent?: string; length: "mini" | "midi" | "maxi" };
  outerwear?: { color: string };
  shoes?: { color: string; kind: "heel" | "sneaker" | "boot" | "flat" };
};

function planFromProduct(p?: Product | null, footwear?: Product | null): GarmentPlan {
  const plan: GarmentPlan = {};
  if (footwear) {
    plan.shoes = {
      color: footwear.color,
      kind: footwear.silhouette === "heel" ? "heel"
          : footwear.silhouette === "boot" ? "boot"
          : footwear.silhouette === "sneaker" ? "sneaker" : "flat",
    };
  }
  if (!p) return plan;
  const sil = p.silhouette;
  if (sil === "midi-dress")      plan.dress = { color: p.color, accent: p.accent, length: "midi" };
  else if (sil === "mini-dress") plan.dress = { color: p.color, accent: p.accent, length: "mini" };
  else if (sil === "maxi-dress") plan.dress = { color: p.color, accent: p.accent, length: "maxi" };
  else if (sil === "blouse")     plan.top = { color: p.color, sleeves: "long", length: "regular" };
  else if (sil === "shirt")      plan.top = { color: p.color, sleeves: "long", length: "regular" };
  else if (sil === "tshirt")     plan.top = { color: p.color, sleeves: "short", length: "regular" };
  else if (sil === "hoodie")     plan.top = { color: p.color, accent: p.accent, sleeves: "long", length: "regular" };
  else if (sil === "blazer")     { plan.top = { color: "#e9e3d6", sleeves: "long", length: "regular" }; plan.outerwear = { color: p.color }; }
  else if (sil === "biker-jacket") { plan.top = { color: "#1a1a1f", sleeves: "short", length: "regular" }; plan.outerwear = { color: p.color }; }
  else if (sil === "skinny-jeans") plan.bottom = { color: p.color, length: "long", kind: "pants" };
  else if (sil === "wide-jeans")   plan.bottom = { color: p.color, length: "long", kind: "pants" };
  else if (sil === "trousers")     plan.bottom = { color: p.color, length: "long", kind: "pants" };
  else if (sil === "mini-skirt")   plan.bottom = { color: p.color, length: "mini", kind: "skirt" };
  return plan;
}

function fitOffset(fit: Fit): number {
  return fit === "tight" ? -0.012 : fit === "perfect" ? 0.012 : fit === "relaxed" ? 0.035 : 0.06;
}

/* ──────────────── Human (R3F) ──────────────── */

function Human({
  shape, plan, fit, gender,
}: { shape: Shape; plan: GarmentPlan; fit: Fit; gender: Gender }) {
  const s = useSmoothShape(shape);
  const group = useRef<THREE.Group>(null);
  // Subtle breathing
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = Math.sin(t * 0.9) * 0.005;
  });

  const skinMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: s.skin,
      roughness: 0.38,
      metalness: 0.15,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
      sheen: 0.4,
      sheenColor: new THREE.Color("#2a2230"),
    }),
    [s.skin],
  );
  useEffect(() => { skinMat.color.set(s.skin); }, [s.skin, skinMat]);

  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: s.hair, roughness: 0.4, metalness: 0.1 }),
    [s.hair],
  );

  const fo = fitOffset(fit);
  const garment = (color: string, roughness = 0.6) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });

  // Reference vertical landmarks (in world units), then scaled by heightScale
  const H = s.heightScale;
  const head = { r: 0.13, y: 1.62 };
  const neck = { r: 0.055 * s.neck, y: 1.46, h: 0.10 };
  const shoulder = { y: 1.40, x: 0.20 * s.shoulderW };
  const torsoTop = 1.40;
  const torsoMid = 1.18;
  const waistY = 1.05;
  const hipY = 0.96;
  const kneeY = 0.50;
  const ankleY = 0.05;

  // Sleeves / outerwear
  const top = plan.top;
  const dress = plan.dress;
  const outer = plan.outerwear;
  const bottom = plan.bottom;
  const shoes = plan.shoes;

  return (
    <group ref={group} scale={[1, H, 1]} position={[0, -0.8 * H, 0]}>
      {/* HEAD */}
      <mesh position={[0, head.y, 0]} castShadow material={skinMat}>
        <sphereGeometry args={[head.r, 48, 48]} />
      </mesh>
      {/* Subtle jaw shaping */}
      <mesh position={[0, head.y - 0.06, 0.005]} scale={[0.88, 0.7, 0.88]} material={skinMat}>
        <sphereGeometry args={[head.r, 32, 32]} />
      </mesh>
      {/* Minimal facial plane — subtle nose ridge only, no eyes/lips/hair (digital clone) */}
      <mesh position={[0, head.y - 0.01, 0.11]} scale={[0.18, 0.55, 0.5]} material={skinMat}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>

      {/* NECK */}
      <mesh position={[0, neck.y, 0]} material={skinMat}>
        <cylinderGeometry args={[neck.r, neck.r * 1.1, neck.h, 24]} />
      </mesh>

      {/* SHOULDERS */}
      <mesh position={[-shoulder.x, shoulder.y, 0]} material={skinMat}>
        <sphereGeometry args={[0.075 + s.muscle * 0.02, 24, 24]} />
      </mesh>
      <mesh position={[shoulder.x, shoulder.y, 0]} material={skinMat}>
        <sphereGeometry args={[0.075 + s.muscle * 0.02, 24, 24]} />
      </mesh>

      {/* TORSO — chest */}
      <mesh position={[0, (torsoTop + torsoMid) / 2, 0]} scale={[s.chest, 1, s.chest * 0.7]} material={skinMat}>
        <cylinderGeometry args={[0.18, 0.16, torsoTop - torsoMid + 0.05, 32]} />
      </mesh>
      {/* Bust (female) */}
      {gender === "Female" && (
        <>
          <mesh position={[-0.07, torsoMid + 0.05, 0.10 * s.chest]} material={skinMat}>
            <sphereGeometry args={[0.07 + s.bust * 0.35, 24, 24]} />
          </mesh>
          <mesh position={[0.07, torsoMid + 0.05, 0.10 * s.chest]} material={skinMat}>
            <sphereGeometry args={[0.07 + s.bust * 0.35, 24, 24]} />
          </mesh>
        </>
      )}
      {/* Waist */}
      <mesh position={[0, waistY, 0]} scale={[s.waist, 1, s.waist * 0.78]} material={skinMat}>
        <cylinderGeometry args={[0.14, 0.16, 0.16, 32]} />
      </mesh>
      {/* Hips */}
      <mesh position={[0, hipY - 0.04, 0]} scale={[s.hip, 1, s.hip * 0.82]} material={skinMat}>
        <cylinderGeometry args={[0.17, 0.15, 0.18, 32]} />
      </mesh>

      {/* ARMS */}
      <Arm side={-1} shoulder={shoulder} skin={skinMat} s={s} sleeves={top?.sleeves ?? dress?.length ? "short" : "none"} />
      <Arm side={1}  shoulder={shoulder} skin={skinMat} s={s} sleeves={top?.sleeves ?? dress?.length ? "short" : "none"} />

      {/* LEGS */}
      <Leg side={-1} hipY={hipY} kneeY={kneeY} ankleY={ankleY} skin={skinMat} s={s} />
      <Leg side={1}  hipY={hipY} kneeY={kneeY} ankleY={ankleY} skin={skinMat} s={s} />

      {/* FEET / SHOES */}
      <Foot side={-1} ankleY={ankleY} skin={skinMat} shoe={shoes} />
      <Foot side={1}  ankleY={ankleY} skin={skinMat} shoe={shoes} />

      {/* ───── GARMENTS ───── */}
      {dress && (
        <Dress
          color={dress.color}
          accent={dress.accent}
          length={dress.length}
          torsoMid={torsoMid}
          waistY={waistY}
          hipY={hipY}
          s={s}
          fo={fo}
          gender={gender}
        />
      )}
      {top && !dress && (
        <Top color={top.color} sleeves={top.sleeves} length={top.length} torsoTop={torsoTop} torsoMid={torsoMid} waistY={waistY} hipY={hipY} s={s} fo={fo} gender={gender} />
      )}
      {bottom && !dress && (
        <Bottom color={bottom.color} kind={bottom.kind} length={bottom.length} hipY={hipY} kneeY={kneeY} ankleY={ankleY} s={s} fo={fo} />
      )}
      {outer && !dress && (
        <Outer color={outer.color} torsoTop={torsoTop} waistY={waistY} s={s} fo={fo} />
      )}
    </group>
  );
}

function Arm({
  side, shoulder, skin, s, sleeves,
}: {
  side: 1 | -1;
  shoulder: { y: number; x: number };
  skin: THREE.Material;
  s: Shape;
  sleeves: "none" | "short" | "long";
}) {
  const armLen = 0.36;
  const forearmLen = 0.34;
  const upperY = shoulder.y - armLen / 2 - 0.02;
  const elbowY = shoulder.y - armLen - 0.04;
  const foreY  = elbowY - forearmLen / 2;
  const handY  = elbowY - forearmLen;
  return (
    <group>
      {/* Upper arm */}
      <mesh position={[side * (shoulder.x + 0.02), upperY, 0]} rotation={[0, 0, side * -0.05]} material={skin}>
        <cylinderGeometry args={[0.045 * s.arm, 0.04 * s.arm, armLen, 20]} />
      </mesh>
      {/* Elbow */}
      <mesh position={[side * (shoulder.x + 0.04), elbowY, 0]} material={skin}>
        <sphereGeometry args={[0.04 * s.arm, 16, 16]} />
      </mesh>
      {/* Forearm */}
      <mesh position={[side * (shoulder.x + 0.05), foreY, 0]} rotation={[0, 0, side * -0.03]} material={skin}>
        <cylinderGeometry args={[0.038 * s.forearm, 0.034 * s.forearm, forearmLen, 20]} />
      </mesh>
      {/* Hand */}
      <mesh position={[side * (shoulder.x + 0.06), handY - 0.02, 0]} material={skin}>
        <boxGeometry args={[0.05, 0.10, 0.035]} />
      </mesh>
    </group>
  );
}

function Leg({
  side, hipY, kneeY, ankleY, skin, s,
}: {
  side: 1 | -1;
  hipY: number; kneeY: number; ankleY: number;
  skin: THREE.Material;
  s: Shape;
}) {
  const x = side * 0.08 * s.hip;
  const thighLen = hipY - kneeY;
  const calfLen = kneeY - ankleY;
  return (
    <group>
      {/* Thigh */}
      <mesh position={[x, (hipY + kneeY) / 2, 0]} material={skin}>
        <cylinderGeometry args={[0.085 * s.thigh, 0.065 * s.thigh, thighLen, 24]} />
      </mesh>
      {/* Knee */}
      <mesh position={[x, kneeY, 0]} material={skin}>
        <sphereGeometry args={[0.06, 20, 20]} />
      </mesh>
      {/* Calf */}
      <mesh position={[x, (kneeY + ankleY) / 2, 0]} material={skin}>
        <cylinderGeometry args={[0.06 * s.calf, 0.045, calfLen, 24]} />
      </mesh>
    </group>
  );
}

function Foot({
  side, ankleY, skin, shoe,
}: {
  side: 1 | -1;
  ankleY: number;
  skin: THREE.Material;
  shoe?: GarmentPlan["shoes"];
}) {
  const x = side * 0.08;
  if (!shoe) {
    return (
      <mesh position={[x, ankleY - 0.02, 0.04]} material={skin}>
        <boxGeometry args={[0.07, 0.04, 0.18]} />
      </mesh>
    );
  }
  const mat = new THREE.MeshStandardMaterial({ color: shoe.color, roughness: 0.4, metalness: 0.15 });
  if (shoe.kind === "heel") {
    return (
      <group>
        <mesh position={[x, ankleY - 0.015, 0.06]} material={mat}>
          <boxGeometry args={[0.06, 0.03, 0.18]} />
        </mesh>
        <mesh position={[x, ankleY - 0.06, -0.04]} material={mat}>
          <boxGeometry args={[0.02, 0.08, 0.02]} />
        </mesh>
      </group>
    );
  }
  if (shoe.kind === "boot") {
    return (
      <group>
        <mesh position={[x, ankleY + 0.05, 0]} material={mat}>
          <cylinderGeometry args={[0.06, 0.07, 0.16, 16]} />
        </mesh>
        <mesh position={[x, ankleY - 0.03, 0.05]} material={mat}>
          <boxGeometry args={[0.08, 0.05, 0.20]} />
        </mesh>
      </group>
    );
  }
  // sneaker / flat
  return (
    <mesh position={[x, ankleY - 0.015, 0.05]} material={mat}>
      <boxGeometry args={[0.085, 0.06, 0.22]} />
    </mesh>
  );
}

function Top({
  color, sleeves, length, torsoTop, torsoMid, waistY, hipY, s, fo, gender,
}: {
  color: string; sleeves: "none" | "short" | "long";
  length: "crop" | "regular" | "long";
  torsoTop: number; torsoMid: number; waistY: number; hipY: number;
  s: Shape; fo: number; gender: Gender;
}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
  const bottom = length === "crop" ? torsoMid - 0.02 : length === "long" ? hipY - 0.05 : waistY - 0.02;
  const top = torsoTop + 0.02;
  const midY = (top + bottom) / 2;
  const heightT = top - bottom;
  const chestR = (0.19 + (gender === "Female" ? s.bust * 0.25 : 0)) * s.chest + fo;
  const waistR = 0.155 * s.waist + fo;
  return (
    <group>
      <mesh position={[0, midY, 0]} scale={[1, 1, 0.78]} material={mat}>
        <cylinderGeometry args={[chestR, waistR, heightT, 36]} />
      </mesh>
      {sleeves !== "none" && (
        <>
          <Sleeve side={-1} long={sleeves === "long"} torsoTop={torsoTop} mat={mat} s={s} />
          <Sleeve side={1}  long={sleeves === "long"} torsoTop={torsoTop} mat={mat} s={s} />
        </>
      )}
    </group>
  );
}

function Sleeve({
  side, long, torsoTop, mat, s,
}: { side: 1 | -1; long: boolean; torsoTop: number; mat: THREE.Material; s: Shape }) {
  const x = side * (0.20 * s.shoulderW + 0.02);
  if (!long) {
    return (
      <mesh position={[x, torsoTop - 0.06, 0]} material={mat}>
        <cylinderGeometry args={[0.06 * s.arm, 0.05 * s.arm, 0.16, 16]} />
      </mesh>
    );
  }
  return (
    <mesh position={[x, torsoTop - 0.22, 0]} material={mat}>
      <cylinderGeometry args={[0.055 * s.arm, 0.045 * s.arm, 0.55, 16]} />
    </mesh>
  );
}

function Bottom({
  color, kind, length, hipY, kneeY, ankleY, s, fo,
}: {
  color: string; kind: "pants" | "skirt"; length: "shorts" | "mini" | "knee" | "long";
  hipY: number; kneeY: number; ankleY: number; s: Shape; fo: number;
}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  if (kind === "skirt") {
    const bottomY = length === "mini" ? hipY - 0.18 : length === "knee" ? kneeY : ankleY + 0.1;
    const topY = hipY + 0.02;
    const midY = (topY + bottomY) / 2;
    const h = topY - bottomY;
    return (
      <mesh position={[0, midY, 0]} material={mat}>
        <cylinderGeometry args={[0.18 * s.hip + fo, 0.30 * s.hip + fo, h, 32, 1, true]} />
      </mesh>
    );
  }
  // pants
  const endY = length === "shorts" ? hipY - 0.15 : length === "knee" ? kneeY : ankleY + 0.02;
  return (
    <group>
      {/* hip band */}
      <mesh position={[0, hipY - 0.02, 0]} scale={[s.hip, 1, s.hip * 0.82]} material={mat}>
        <cylinderGeometry args={[0.18 + fo, 0.16 + fo, 0.10, 32]} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.08 * s.hip, (hipY - 0.07 + endY) / 2, 0]} material={mat}>
        <cylinderGeometry args={[0.10 * s.thigh + fo, 0.075 + fo, hipY - 0.07 - endY, 24]} />
      </mesh>
      <mesh position={[0.08 * s.hip, (hipY - 0.07 + endY) / 2, 0]} material={mat}>
        <cylinderGeometry args={[0.10 * s.thigh + fo, 0.075 + fo, hipY - 0.07 - endY, 24]} />
      </mesh>
    </group>
  );
}

function Dress({
  color, accent, length, torsoMid, waistY, hipY, s, fo, gender,
}: {
  color: string; accent?: string; length: "mini" | "midi" | "maxi";
  torsoMid: number; waistY: number; hipY: number; s: Shape; fo: number; gender: Gender;
}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const topY = torsoMid + 0.18;
  const bottomY = length === "mini" ? hipY - 0.20 : length === "midi" ? 0.45 : 0.10;
  // bodice
  const bodMid = (topY + waistY) / 2;
  const bodH = topY - waistY;
  // skirt
  const skirtMid = (waistY + bottomY) / 2;
  const skirtH = waistY - bottomY;
  const chestR = (0.18 + (gender === "Female" ? s.bust * 0.30 : 0)) * s.chest + fo;
  return (
    <group>
      <mesh position={[0, bodMid, 0]} scale={[1, 1, 0.78]} material={mat}>
        <cylinderGeometry args={[chestR, 0.14 * s.waist + fo, bodH, 36]} />
      </mesh>
      <mesh position={[0, skirtMid, 0]} material={mat}>
        <cylinderGeometry args={[0.16 * s.waist + fo, 0.30 + fo + (length === "maxi" ? 0.05 : 0), skirtH, 36, 1, true]} />
      </mesh>
      {accent && (
        <mesh position={[0, waistY, 0]} scale={[1, 1, 0.8]}>
          <torusGeometry args={[0.16 * s.waist + fo + 0.005, 0.01, 12, 36]} />
          <meshStandardMaterial color={accent} roughness={0.35} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function Outer({
  color, torsoTop, waistY, s, fo,
}: { color: string; torsoTop: number; waistY: number; s: Shape; fo: number }) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const midY = (torsoTop + waistY) / 2;
  const h = torsoTop - waistY + 0.1;
  return (
    <group>
      <mesh position={[-0.11 * s.chest, midY, 0.02]} scale={[1, 1, 0.6]} material={mat}>
        <boxGeometry args={[0.10 + fo, h, 0.30 + fo]} />
      </mesh>
      <mesh position={[0.11 * s.chest, midY, 0.02]} scale={[1, 1, 0.6]} material={mat}>
        <boxGeometry args={[0.10 + fo, h, 0.30 + fo]} />
      </mesh>
    </group>
  );
}

/* ──────────────── Scene + exported component ──────────────── */

function fitLabel(fit: Fit): string {
  return fit === "tight" ? "Tight" : fit === "perfect" ? "Perfect Fit" : fit === "relaxed" ? "Relaxed" : "Oversized";
}

export function Mannequin({
  height = 168, weight = 60, gender = "Female", bodyType = "Curvy",
  fit = "perfect", product, footwear, bag, accessory,
}: MannequinProps) {
  const shape = useMemo(
    () => computeShape(height, weight, gender, bodyType),
    [height, weight, gender, bodyType],
  );
  const plan = useMemo(() => planFromProduct(product, footwear), [product, footwear]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-b from-[#1a1622] via-[#0f0d18] to-[#080610] border border-white/5 shadow-2xl">
      {mounted && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0.15, 2.4], fov: 32 }}
          gl={{ antialias: true, alpha: true }}
        >
          <color attach="background" args={["#0f0d18"]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[2, 3, 2]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-2.5, 1.5, -1]} intensity={0.8} color="#a78bfa" />
          <directionalLight position={[0, 1.2, -2.5]} intensity={0.6} color="#ec4f8a" />
          <spotLight position={[0, 3.2, 1.8]} intensity={0.9} angle={0.55} penumbra={1} color="#ffffff" />
          <Suspense fallback={null}>
            <Human shape={shape} plan={plan} fit={fit} gender={gender} />
            <ContactShadows position={[0, -0.86, 0]} opacity={0.65} scale={3.5} blur={2.6} far={1.5} />
            <Environment preset="studio" />
          </Suspense>
          <OrbitControls
            enablePan
            enableZoom
            minDistance={1.4}
            maxDistance={4}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.8}
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
