import { useEffect, useId, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";
import zaraPinkDress from "@/assets/mannequin/zara-pink-dress.jpg";
import hmBlackMini from "@/assets/mannequin/hm-black-mini.jpg";
import mangoFloral from "@/assets/mannequin/mango-floral.jpg";
import zaraSilkBlouse from "@/assets/mannequin/zara-silk-blouse.jpg";
import mangoBlazer from "@/assets/mannequin/mango-blazer.jpg";
import levisMom from "@/assets/mannequin/levis-mom.jpg";
import hmMiniSkirt from "@/assets/mannequin/hm-mini-skirt.jpg";
import roadsterTee from "@/assets/mannequin/roadster-tee.jpg";
import zaraOxford from "@/assets/mannequin/zara-oxford.jpg";
import hmBlazerM from "@/assets/mannequin/hm-blazer-m.jpg";
import hrxHoodie from "@/assets/mannequin/hrx-hoodie.jpg";
import levis501 from "@/assets/mannequin/levis-501.jpg";
import zaraTrousers from "@/assets/mannequin/zara-trousers.jpg";
import zaraBiker from "@/assets/mannequin/zara-biker.jpg";
import accJacketCream from "@/assets/mannequin/acc-jacket-cream.jpg";

export const OUTFIT_IMAGE_MAP: Record<string, string> = {
  "zara-pink-dress": zaraPinkDress,
  "hm-black-mini": hmBlackMini,
  "mango-floral": mangoFloral,
  "zara-silk-blouse": zaraSilkBlouse,
  "mango-blazer": mangoBlazer,
  "levis-mom": levisMom,
  "hm-mini-skirt": hmMiniSkirt,
  "roadster-tee": roadsterTee,
  "zara-oxford": zaraOxford,
  "hm-blazer-m": hmBlazerM,
  "hrx-hoodie": hrxHoodie,
  "levis-501": levis501,
  "zara-trousers": zaraTrousers,
  "zara-biker": zaraBiker,
  "acc-jacket-cream": accJacketCream,
};

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

type BodyMeasurements = {
  cx: number;
  topY: number;
  floorY: number;
  headY: number;
  headRx: number;
  headRy: number;
  neckY: number;
  shoulderY: number;
  bustY: number;
  waistY: number;
  hipY: number;
  crotchY: number;
  kneeY: number;
  ankleY: number;
  elbowY: number;
  wristY: number;
  shoulderW: number;
  chestW: number;
  waistW: number;
  hipW: number;
  thighW: number;
  calfW: number;
  armW: number;
  footW: number;
  posture: number;
  depth: number;
};

type SilhouettePaths = {
  torso: string;
  neck: string;
  leftArm: string;
  rightArm: string;
  leftLeg: string;
  rightLeg: string;
};

type BodyScale = {
  heightT: number;
  massT: number;
  heightScale: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalize = (value: number, min: number, max: number) => clamp((value - min) / (max - min), 0, 1) * 2 - 1;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function calculateBodyScale(height: number, weight: number): BodyScale {
  const heightT = normalize(height, 140, 210);
  const bmi = weight / Math.pow(height / 100, 2);
  const bmiMass = normalize(bmi, 17, 34);
  const rawMass = normalize(weight, 40, 140);
  const massT = clamp(bmiMass * 0.72 + rawMass * 0.28, -1, 1);
  return { heightT, massT, heightScale: 1 + heightT * 0.16 };
}

function calculateBodyMeasurements(height: number, weight: number, gender: Gender, bodyType: BodyType): BodyMeasurements {
  const { heightT, massT, heightScale } = calculateBodyScale(height, weight);
  const cx = 160;
  const floorY = 522;
  const bodyHeight = 418 * heightScale;
  const topY = floorY - bodyHeight;

  const typeMods: Record<BodyType, Partial<Record<"shoulder" | "chest" | "waist" | "hip" | "thigh" | "arm" | "posture" | "limb", number>>> = {
    Slim: { shoulder: -7, chest: -10, waist: -15, hip: -8, thigh: -6, arm: -4, posture: 1, limb: 6 },
    Athletic: { shoulder: 16, chest: 11, waist: -7, hip: -1, thigh: 5, arm: 5, posture: 4, limb: 2 },
    Regular: { shoulder: 0, chest: 0, waist: 0, hip: 0, thigh: 0, arm: 0, posture: 0, limb: 0 },
    Curvy: { shoulder: 1, chest: 9, waist: -9, hip: 20, thigh: 8, arm: 2, posture: 1, limb: -1 },
    Pear: { shoulder: -12, chest: -4, waist: -3, hip: 24, thigh: 10, arm: 1, posture: 0, limb: -1 },
    Rectangle: { shoulder: 4, chest: 4, waist: 10, hip: 5, thigh: 2, arm: 1, posture: -1, limb: 0 },
    Plus: { shoulder: 13, chest: 20, waist: 29, hip: 30, thigh: 16, arm: 9, posture: -2, limb: -4 },
  };

  const genderMods = {
    Female: { shoulder: -5, chest: 5, waist: -4, hip: 10, thigh: 3, arm: -1, posture: 1 },
    Male: { shoulder: 17, chest: 12, waist: 7, hip: -6, thigh: 2, arm: 3, posture: 3 },
    Unisex: { shoulder: 3, chest: 2, waist: 2, hip: 1, thigh: 1, arm: 1, posture: 1 },
  }[gender];
  const tm = typeMods[bodyType];

  const add = (base: number, part: keyof typeof genderMods, massGain: number, min: number, max: number) =>
    clamp(base + massT * massGain + (tm[part] ?? 0) + genderMods[part], min, max);

  const shoulderW = add(92, "shoulder", 13, 66, 138);
  const chestW = add(82, "chest", 19, 56, 132);
  const waistW = add(58, "waist", 31, 42, 126);
  const hipW = add(84, "hip", 27, 56, 146);
  const thighW = add(29, "thigh", 12, 18, 54);
  const armW = add(14, "arm", 6, 9, 30);
  const limbBoost = tm.limb ?? 0;

  const headY = topY + 24;
  const neckY = topY + 56;
  const shoulderY = topY + 84 + heightT * 3;
  const bustY = shoulderY + 34;
  const waistY = shoulderY + 86 + heightT * 13;
  const hipY = waistY + 58 + heightT * 7;
  const crotchY = hipY + 22;
  const ankleY = floorY - 18;
  const kneeY = crotchY + (ankleY - crotchY) * 0.53;
  const elbowY = shoulderY + 88 + heightT * 10 + limbBoost;
  const wristY = clamp(shoulderY + 188 + heightT * 24 + limbBoost * 1.7, hipY + 36, ankleY - 64);

  return {
    cx,
    topY,
    floorY,
    headY,
    headRx: clamp(19 + massT * 2.2 + (gender === "Male" ? 1.5 : 0), 17, 24),
    headRy: clamp(25 + heightT * 1.5 + massT * 1.2, 22, 29),
    neckY,
    shoulderY,
    bustY,
    waistY,
    hipY,
    crotchY,
    kneeY,
    ankleY,
    elbowY,
    wristY,
    shoulderW,
    chestW,
    waistW,
    hipW,
    thighW,
    calfW: clamp(18 + massT * 6 + (tm.thigh ?? 0) * 0.24, 12, 32),
    armW,
    footW: clamp(22 + heightT * 2.5 + massT * 1.5, 18, 28),
    posture: (tm.posture ?? 0) + genderMods.posture,
    depth: clamp(0.9 + massT * 0.24 + (bodyType === "Plus" ? 0.14 : 0), 0.72, 1.35),
  };
}

function interpolateMeasurements(from: BodyMeasurements, to: BodyMeasurements, progress: number): BodyMeasurements {
  const next = {} as BodyMeasurements;
  (Object.keys(to) as Array<keyof BodyMeasurements>).forEach((key) => {
    next[key] = from[key] + (to[key] - from[key]) * progress;
  });
  return next;
}

function useInterpolatedMeasurements(target: BodyMeasurements) {
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    const start = current;
    const startedAt = performance.now();
    const duration = 320;
    let frame = 0;

    const tick = (now: number) => {
      const progress = easeOutCubic(clamp((now - startedAt) / duration, 0, 1));
      setCurrent(interpolateMeasurements(start, target, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return current;
}

function generateSilhouette(m: BodyMeasurements): SilhouettePaths {
  const { cx } = m;
  const torso = [
    `M ${cx - m.shoulderW / 2 + m.posture * 0.25} ${m.shoulderY}`,
    `C ${cx - m.chestW / 2 - 10} ${m.bustY - 18}, ${cx - m.chestW / 2} ${m.bustY + 4}, ${cx - m.chestW / 2} ${m.bustY}`,
    `C ${cx - m.waistW / 2 - 7} ${m.waistY - 26}, ${cx - m.waistW / 2} ${m.waistY - 4}, ${cx - m.waistW / 2} ${m.waistY}`,
    `C ${cx - m.hipW / 2 - 4} ${m.hipY - 18}, ${cx - m.hipW / 2} ${m.hipY - 2}, ${cx - m.hipW / 2} ${m.hipY}`,
    `C ${cx - m.hipW * 0.36} ${m.hipY + 16}, ${cx - 18} ${m.crotchY - 5}, ${cx - 10} ${m.crotchY}`,
    `L ${cx + 10} ${m.crotchY}`,
    `C ${cx + 18} ${m.crotchY - 5}, ${cx + m.hipW * 0.36} ${m.hipY + 16}, ${cx + m.hipW / 2} ${m.hipY}`,
    `C ${cx + m.hipW / 2} ${m.hipY - 2}, ${cx + m.waistW / 2} ${m.waistY - 4}, ${cx + m.waistW / 2} ${m.waistY}`,
    `C ${cx + m.waistW / 2 + 7} ${m.waistY - 26}, ${cx + m.chestW / 2} ${m.bustY + 4}, ${cx + m.chestW / 2} ${m.bustY}`,
    `C ${cx + m.chestW / 2 + 10} ${m.bustY - 18}, ${cx + m.shoulderW / 2 + m.posture * 0.25} ${m.shoulderY}, ${cx + m.shoulderW / 2 + m.posture * 0.25} ${m.shoulderY}`,
    `C ${cx + 24} ${m.shoulderY - 11}, ${cx - 24} ${m.shoulderY - 11}, ${cx - m.shoulderW / 2 + m.posture * 0.25} ${m.shoulderY}`,
    "Z",
  ].join(" ");

  const neck = `M ${cx - 15} ${m.neckY + 1} C ${cx - 12} ${m.shoulderY - 20}, ${cx + 12} ${m.shoulderY - 20}, ${cx + 15} ${m.neckY + 1} L ${cx + 21} ${m.shoulderY + 8} C ${cx + 8} ${m.shoulderY + 16}, ${cx - 8} ${m.shoulderY + 16}, ${cx - 21} ${m.shoulderY + 8} Z`;

  return {
    torso,
    neck,
    leftArm: armPath(m, -1),
    rightArm: armPath(m, 1),
    leftLeg: legPath(m, -1),
    rightLeg: legPath(m, 1),
  };
}

function armPath(m: BodyMeasurements, side: -1 | 1) {
  const x = (offset: number) => m.cx + side * offset;
  const s = side;
  return [
    `M ${x(m.shoulderW / 2 - 8)} ${m.shoulderY + 7}`,
    `C ${x(m.shoulderW / 2 + m.armW * 1.7)} ${m.shoulderY + 28}, ${x(m.shoulderW / 2 + m.armW * 1.95)} ${m.elbowY - 14}, ${x(m.shoulderW / 2 + m.armW * 1.15)} ${m.elbowY}`,
    `C ${x(m.hipW / 2 + m.armW * 0.95)} ${m.wristY - 28}, ${x(m.hipW / 2 + m.armW * 0.65)} ${m.wristY - 8}, ${x(m.hipW / 2 + m.armW * 0.55)} ${m.wristY}`,
    `C ${x(m.hipW / 2 + 2)} ${m.wristY + 10}, ${x(m.hipW / 2 - m.armW * 0.22)} ${m.wristY + 3}, ${x(m.hipW / 2 - m.armW * 0.16)} ${m.wristY - 7}`,
    `C ${x(m.shoulderW / 2 - m.armW * 0.12)} ${m.elbowY - 4}, ${x(m.shoulderW / 2 - 18)} ${m.shoulderY + 22}, ${x(m.shoulderW / 2 - 8)} ${m.shoulderY + 7}`,
    "Z",
  ].join(" ").replaceAll("-0", "0").replaceAll(`${s * 0}`, "0");
}

function legPath(m: BodyMeasurements, side: -1 | 1) {
  const x = (offset: number) => m.cx + side * offset;
  return [
    `M ${x(9)} ${m.crotchY - 1}`,
    `C ${x(12)} ${m.crotchY + 30}, ${x(m.calfW * 0.35)} ${m.kneeY - 4}, ${x(7)} ${m.ankleY}`,
    `L ${x(m.footW)} ${m.ankleY + 8}`,
    `C ${x(m.footW * 0.2)} ${m.ankleY + 14}, ${x(-m.footW * 0.18)} ${m.ankleY + 11}, ${x(-3)} ${m.ankleY}`,
    `C ${x(-m.thighW * 0.16)} ${m.kneeY - 8}, ${x(m.hipW * 0.34)} ${m.hipY + 34}, ${x(m.hipW * 0.34)} ${m.hipY + 12}`,
    `C ${x(m.hipW * 0.27)} ${m.hipY + 26}, ${x(18)} ${m.crotchY - 7}, ${x(9)} ${m.crotchY - 1}`,
    "Z",
  ].join(" ");
}

type GarmentFit = {
  shoulderW: number;
  chestW: number;
  waistW: number;
  hipW: number;
  sleeveW: number;
  thighW: number;
  hemW: number;
  drape: number;
};

function applyGarmentFit(product: Product, m: BodyMeasurements, fit: Fit): GarmentFit {
  const ease = fit === "tight" ? -5 : fit === "perfect" ? 3 : fit === "relaxed" ? 13 : 24;
  const structure = ["Blazer", "Jacket", "Hoodie"].includes(product.category) ? 1.3 : 1;
  const slimContour = fit === "tight" ? 0.96 : 1;
  const drape = (fit === "oversized" ? 20 : fit === "relaxed" ? 12 : fit === "tight" ? -3 : 5) + m.depth * 6;

  return {
    shoulderW: Math.max(54, m.shoulderW + ease * structure + (product.category === "Blazer" || product.category === "Jacket" ? 12 : 0)),
    chestW: Math.max(48, (m.chestW + ease * 1.15) * slimContour),
    waistW: Math.max(38, (m.waistW + ease * 0.9 + (fit === "oversized" ? 8 : 0)) * slimContour),
    hipW: Math.max(50, m.hipW + ease * 1.05 + (["Dress", "Skirt", "Hoodie", "Blazer", "Jacket"].includes(product.category) ? 8 : 0)),
    sleeveW: Math.max(10, m.armW + ease * 0.45 + (product.category === "Hoodie" ? 7 : product.category === "Blazer" || product.category === "Jacket" ? 4 : 0)),
    thighW: Math.max(18, m.thighW + ease * 0.45 + (product.silhouette === "wide-jeans" ? 8 : 0)),
    hemW: Math.max(58, m.hipW + ease + drape),
    drape,
  };
}

function generateGarmentPaths(product: Product, m: BodyMeasurements, g: GarmentFit) {
  const { cx } = m;
  const shoulderY = m.shoulderY + (product.category === "Hoodie" ? 2 : 7);
  const waistY = m.waistY + (product.category === "Hoodie" ? 20 : 4);
  const hipY = m.hipY + (product.category === "Hoodie" ? 28 : 4);
  const skirtHemY = product.silhouette === "mini-dress" || product.silhouette === "mini-skirt"
    ? m.hipY + 64
    : product.silhouette === "maxi-dress"
      ? m.ankleY + 4
      : m.kneeY + 32;

  const bodice = `M ${cx - g.shoulderW / 2} ${shoulderY} C ${cx - g.chestW / 2 - 10} ${m.bustY - 16}, ${cx - g.chestW / 2} ${m.bustY + 12}, ${cx - g.waistW / 2} ${waistY} C ${cx - g.hipW / 2} ${hipY - 12}, ${cx - g.hipW / 2} ${hipY + 2}, ${cx - g.hipW / 2} ${hipY} L ${cx + g.hipW / 2} ${hipY} C ${cx + g.hipW / 2} ${hipY + 2}, ${cx + g.waistW / 2} ${waistY}, ${cx + g.waistW / 2} ${waistY} C ${cx + g.chestW / 2} ${m.bustY + 12}, ${cx + g.chestW / 2 + 10} ${m.bustY - 16}, ${cx + g.shoulderW / 2} ${shoulderY} C ${cx + 20} ${shoulderY - 10}, ${cx - 20} ${shoulderY - 10}, ${cx - g.shoulderW / 2} ${shoulderY} Z`;

  const dress = `M ${cx - g.shoulderW * 0.43} ${shoulderY + 2} C ${cx - g.chestW / 2} ${m.bustY - 6}, ${cx - g.waistW / 2} ${waistY - 8}, ${cx - g.waistW / 2} ${waistY} C ${cx - g.hipW / 2 - 6} ${m.hipY + 14}, ${cx - g.hemW / 2 - g.drape * 0.25} ${skirtHemY - 28}, ${cx - g.hemW / 2} ${skirtHemY} C ${cx - g.hemW * 0.22} ${skirtHemY + 9}, ${cx + g.hemW * 0.22} ${skirtHemY + 9}, ${cx + g.hemW / 2} ${skirtHemY} C ${cx + g.hemW / 2 + g.drape * 0.25} ${skirtHemY - 28}, ${cx + g.hipW / 2 + 6} ${m.hipY + 14}, ${cx + g.waistW / 2} ${waistY} C ${cx + g.waistW / 2} ${waistY - 8}, ${cx + g.chestW / 2} ${m.bustY - 6}, ${cx + g.shoulderW * 0.43} ${shoulderY + 2} C ${cx + 18} ${shoulderY - 8}, ${cx - 18} ${shoulderY - 8}, ${cx - g.shoulderW * 0.43} ${shoulderY + 2} Z`;

  const sleeve = (side: -1 | 1) => {
    const x = (o: number) => cx + side * o;
    const sleeveEnd = product.category === "T-Shirt" ? m.elbowY - 32 : product.category === "Top" ? m.elbowY - 18 : m.wristY - 12;
    return `M ${x(g.shoulderW / 2 - 6)} ${shoulderY + 5} C ${x(g.shoulderW / 2 + g.sleeveW * 1.8)} ${shoulderY + 22}, ${x(g.shoulderW / 2 + g.sleeveW * 1.65)} ${sleeveEnd - 20}, ${x(g.shoulderW / 2 + g.sleeveW * 0.95)} ${sleeveEnd} L ${x(g.shoulderW / 2 - g.sleeveW * 0.2)} ${sleeveEnd - 5} C ${x(g.shoulderW / 2 - 12)} ${m.elbowY - 20}, ${x(g.shoulderW / 2 - 16)} ${shoulderY + 21}, ${x(g.shoulderW / 2 - 6)} ${shoulderY + 5} Z`;
  };

  const pantLeg = (side: -1 | 1) => {
    const x = (o: number) => cx + side * o;
    const outer = Math.max(g.thighW, 24);
    const ankle = product.silhouette === "wide-jeans" || product.category === "Trousers" ? outer * 0.82 : outer * 0.52;
    return `M ${x(8)} ${m.crotchY} C ${x(outer * 1.05)} ${m.crotchY + 38}, ${x(outer * 0.8)} ${m.kneeY}, ${x(ankle)} ${m.ankleY + 2} L ${x(-ankle * 0.45)} ${m.ankleY + 2} C ${x(-outer * 0.15)} ${m.kneeY}, ${x(m.hipW * 0.31)} ${m.hipY + 28}, ${x(8)} ${m.crotchY} Z`;
  };

  const skirt = `M ${cx - g.waistW / 2} ${waistY - 4} C ${cx - g.hipW / 2 - 4} ${m.hipY + 16}, ${cx - g.hemW / 2} ${skirtHemY - 10}, ${cx - g.hemW / 2} ${skirtHemY} C ${cx - g.hemW * 0.2} ${skirtHemY + 8}, ${cx + g.hemW * 0.2} ${skirtHemY + 8}, ${cx + g.hemW / 2} ${skirtHemY} C ${cx + g.hemW / 2} ${skirtHemY - 10}, ${cx + g.hipW / 2 + 4} ${m.hipY + 16}, ${cx + g.waistW / 2} ${waistY - 4} Z`;

  return { bodice, dress, leftSleeve: sleeve(-1), rightSleeve: sleeve(1), leftPant: pantLeg(-1), rightPant: pantLeg(1), skirt };
}

export function Mannequin(props: MannequinProps) {
  const {
    height = 170, weight = 65, gender = "Female", bodyType = "Regular",
    fit = "perfect", rotation = 0, scanning = false,
    product = null, footwear = null, bag = null, accessory = null,
    showSkeleton = false,
  } = props;

  const baseImg = gender === "Male" ? baseMale : baseFemale;
  const productImg = product ? OUTFIT_IMAGE_MAP[product.id] : null;
  const showProduct = !showSkeleton && productImg;
  const imgSrc = showProduct ? productImg! : baseImg;

  const t = useBodyTransform(height, weight, gender, bodyType, fit);

  return (
    <div className="relative mx-auto aspect-[3/5] w-full max-w-[520px] select-none">
      {/* Showroom backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden rounded-[32px]"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 22%, rgba(160,90,200,0.40), transparent 65%), " +
            "radial-gradient(ellipse 70% 45% at 50% 92%, rgba(236,79,138,0.32), transparent 70%), " +
            "linear-gradient(180deg, #1a0f24 0%, #0c0712 60%, #08050d 100%)",
        }}
      >
        {/* top LED strip */}
        <div className="absolute left-[8%] right-[8%] top-[8%] h-[2px] rounded-full opacity-80"
             style={{ background: "linear-gradient(90deg, transparent, #fff, transparent)", filter: "blur(1px)" }} />
        {/* runway floor neon */}
        <div className="absolute bottom-[8%] left-0 right-0 h-[2px] opacity-70"
             style={{ background: "linear-gradient(90deg, transparent 8%, oklch(0.7 0.26 350) 35%, oklch(0.6 0.25 295) 65%, transparent 92%)", filter: "blur(2px)" }} />
        {/* faint grid */}
        <div className="absolute inset-0 grid-bg opacity-[0.06]" />
      </div>

      <div
        className="relative h-full w-full"
        style={{
          transform: `perspective(1400px) rotateY(${rotation}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Mannequin photo with body-adaptive transform + crossfade between outfits */}
        <div
          key={imgSrc}
          className="absolute inset-0 flex items-end justify-center animate-fade-in"
          style={{ animationDuration: "600ms" }}
        >
          <img
            src={imgSrc}
            alt={product ? `Mannequin wearing ${product.name}` : "Virtual fitting mannequin"}
            width={1024}
            height={1024}
            loading="eager"
            decoding="async"
            className="h-full w-full object-contain will-change-transform"
            style={{
              transform: t.transform,
              transformOrigin: t.transformOrigin,
              filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 30px rgba(180,90,200,0.18))",
              animation: "float 7s ease-in-out infinite",
            }}
          />
        </div>

        {/* Top spotlight wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[32px]"
          style={{
            background:
              "radial-gradient(ellipse 55% 30% at 50% 10%, rgba(255,255,255,0.18), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />

        {/* Accessory chips (heels/bag/sunnies/belt shown as floating product tags) */}
        {!showSkeleton && (footwear || bag || accessory) && (
          <div className="pointer-events-none absolute inset-0">
            {footwear && (
              <AccessoryTag
                className="bottom-[8%] right-[6%]"
                label="Footwear" name={footwear.name} brand={footwear.brand} color={footwear.color}
              />
            )}
            {bag && (
              <AccessoryTag
                className="top-[42%] right-[4%]"
                label="Bag" name={bag.name} brand={bag.brand} color={bag.color}
              />
            )}
            {accessory && (
              <AccessoryTag
                className="top-[16%] left-[4%]"
                label="Accessory" name={accessory.name} brand={accessory.brand} color={accessory.color}
              />
            )}
          </div>
        )}

        {/* Scan overlay */}
        {scanning && (
          <>
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div
              className="absolute inset-x-0 h-[3px] rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, oklch(0.7 0.26 350), transparent)",
                boxShadow: "0 0 24px 6px oklch(0.7 0.26 350 / 0.6)",
                animation: "scan 2.2s ease-in-out infinite",
              }}
            />
            <div className="pointer-events-none absolute inset-0 mix-blend-screen"
                 style={{ background: "linear-gradient(180deg, transparent 40%, rgba(236,79,138,0.10) 50%, transparent 60%)" }} />
          </>
        )}
      </div>

      {/* Fit pill anchored bottom — confirms which outfit is fitted */}
      {showProduct && product && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="glass-strong flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
            Fitted · {fit.charAt(0).toUpperCase() + fit.slice(1)}
          </div>
        </div>
      )}
    </div>
  );
}

function AccessoryTag({
  className, label, name, brand, color,
}: { className?: string; label: string; name: string; brand: string; color: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      <div className="glass-strong flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] shadow-xl animate-fade-in">
        <span className="h-5 w-5 rounded-full ring-2 ring-white/30" style={{ background: color }} />
        <div className="leading-tight">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="font-medium">{brand} · {name}</div>
        </div>
      </div>
    </div>
  );
}
