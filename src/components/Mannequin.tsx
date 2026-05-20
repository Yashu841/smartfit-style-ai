import { useMemo } from "react";
import type { Product } from "@/lib/catalog";

type Fit = "tight" | "perfect" | "relaxed" | "oversized";
type Gender = "Female" | "Male" | "Unisex";
type BodyType = "Slim" | "Athletic" | "Regular" | "Curvy" | "Plus" | "Pear" | "Rectangle";

export type MannequinProps = {
  height?: number;        // cm
  weight?: number;        // kg
  gender?: Gender;
  bodyType?: BodyType;
  fit?: Fit;
  rotation?: number;
  scanning?: boolean;
  product?: Product | null;
  footwear?: Product | null;
  bag?: Product | null;
  accessory?: Product | null;
  showSkeleton?: boolean; // "before" state
};

// --- Body proportions ---------------------------------------------------
type Body = {
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  thigh: number;
  calf: number;
  torso: number;
  legLength: number;
  neckHeight: number;
  headR: number;
  armLength: number;
  upperArm: number;
};

function computeBody(
  height = 170,
  weight = 65,
  gender: Gender = "Female",
  bodyType: BodyType = "Regular",
): Body {
  // base (units roughly map to viewBox 0 0 360 720)
  const base: Body = {
    shoulder: 110, chest: 96, waist: 78, hip: 100,
    thigh: 42, calf: 30, torso: 200, legLength: 280,
    neckHeight: 28, headR: 38, armLength: 240, upperArm: 28,
  };
  // gender shaping
  if (gender === "Female") {
    base.shoulder *= 0.92; base.hip *= 1.06; base.waist *= 0.88; base.chest *= 0.96; base.upperArm *= 0.85;
  } else if (gender === "Male") {
    base.shoulder *= 1.12; base.hip *= 0.94; base.waist *= 1.0; base.chest *= 1.08; base.upperArm *= 1.1;
  }
  // body type
  const bt: Record<BodyType, Partial<Body>> = {
    Slim:      { shoulder: base.shoulder*0.92, chest: base.chest*0.88, waist: base.waist*0.82, hip: base.hip*0.9, thigh: base.thigh*0.85 },
    Athletic:  { shoulder: base.shoulder*1.1, chest: base.chest*1.06, waist: base.waist*0.92, hip: base.hip*0.98, thigh: base.thigh*1.05 },
    Regular:   {},
    Curvy:     { shoulder: base.shoulder*1.02, chest: base.chest*1.05, waist: base.waist*0.85, hip: base.hip*1.18, thigh: base.thigh*1.12 },
    Plus:      { shoulder: base.shoulder*1.08, chest: base.chest*1.22, waist: base.waist*1.28, hip: base.hip*1.22, thigh: base.thigh*1.25 },
    Pear:      { shoulder: base.shoulder*0.9, chest: base.chest*0.92, waist: base.waist*0.92, hip: base.hip*1.2, thigh: base.thigh*1.18 },
    Rectangle: { shoulder: base.shoulder*1.0, chest: base.chest*0.96, waist: base.waist*1.02, hip: base.hip*1.0, thigh: base.thigh*1.0 },
  };
  Object.assign(base, bt[bodyType]);

  // weight volume — affects widths
  const vol = Math.max(0.8, Math.min(1.45, weight / 65));
  base.chest *= 0.6 + 0.4 * vol;
  base.waist *= 0.55 + 0.45 * vol;
  base.hip   *= 0.65 + 0.35 * vol;
  base.thigh *= 0.7 + 0.3 * vol;
  base.calf  *= 0.8 + 0.2 * vol;
  base.upperArm *= 0.7 + 0.3 * vol;

  // height — stretches torso/leg lengths
  const h = Math.max(0.88, Math.min(1.12, height / 170));
  base.torso *= 0.92 + 0.08 * (h / 1);
  base.legLength *= h;

  return base;
}

// --- Fit multiplier (garment ease) --------------------------------------
function fitEase(fit: Fit) {
  switch (fit) {
    case "tight":     return 1.02;
    case "perfect":   return 1.1;
    case "relaxed":   return 1.22;
    case "oversized": return 1.4;
  }
}

// =========================================================================

export function Mannequin(props: MannequinProps) {
  const {
    height = 170, weight = 65, gender = "Female", bodyType = "Regular",
    fit = "perfect", rotation = 0, scanning = false,
    product = null, footwear = null, bag = null, accessory = null,
    showSkeleton = false,
  } = props;

  const body = useMemo(() => computeBody(height, weight, gender, bodyType), [height, weight, gender, bodyType]);
  const ease = fitEase(fit);

  // Layout — center x = 180. Top of head ~30. ground ~ 30+head*2+neck+torso+legLength
  const cx = 180;
  const headTop = 28;
  const headCy = headTop + body.headR;
  const shoulderY = headCy + body.headR + body.neckHeight;
  const waistY = shoulderY + body.torso * 0.55;
  const hipY = shoulderY + body.torso;
  const kneeY = hipY + body.legLength * 0.5;
  const ankleY = hipY + body.legLength;

  // Skin path (front silhouette)
  const bodyPath = `
    M ${cx - body.shoulder} ${shoulderY}
    C ${cx - body.shoulder*0.9} ${shoulderY + body.torso*0.18},
      ${cx - body.waist} ${waistY - body.torso*0.05},
      ${cx - body.waist} ${waistY}
    C ${cx - body.waist} ${waistY + body.torso*0.05},
      ${cx - body.hip*0.95} ${hipY - body.torso*0.05},
      ${cx - body.hip} ${hipY}
    L ${cx - body.thigh*0.6} ${ankleY}
    L ${cx - body.calf*0.4} ${ankleY + 6}
    L ${cx - 4} ${ankleY + 4}
    L ${cx - 4} ${hipY + 6}
    L ${cx + 4} ${hipY + 6}
    L ${cx + 4} ${ankleY + 4}
    L ${cx + body.calf*0.4} ${ankleY + 6}
    L ${cx + body.thigh*0.6} ${ankleY}
    L ${cx + body.hip} ${hipY}
    C ${cx + body.hip*0.95} ${hipY - body.torso*0.05},
      ${cx + body.waist} ${waistY + body.torso*0.05},
      ${cx + body.waist} ${waistY}
    C ${cx + body.waist} ${waistY - body.torso*0.05},
      ${cx + body.shoulder*0.9} ${shoulderY + body.torso*0.18},
      ${cx + body.shoulder} ${shoulderY}
    Z
  `;

  const armWidth = body.upperArm;
  const armLength = body.armLength * (height / 170);
  // arms - simple tapered paths
  const leftArm = `
    M ${cx - body.shoulder + 4} ${shoulderY + 4}
    C ${cx - body.shoulder - armWidth*0.4} ${shoulderY + armLength*0.35},
      ${cx - body.shoulder - armWidth*0.6} ${shoulderY + armLength*0.7},
      ${cx - body.shoulder - armWidth*0.2} ${shoulderY + armLength}
    L ${cx - body.shoulder + armWidth*0.55} ${shoulderY + armLength*0.95}
    C ${cx - body.shoulder + armWidth*0.5} ${shoulderY + armLength*0.65},
      ${cx - body.shoulder + armWidth*0.9} ${shoulderY + armLength*0.3},
      ${cx - body.shoulder + 16} ${shoulderY + 6}
    Z
  `;

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[440px]">
      {/* Glow base */}
      <div
        aria-hidden
        className="absolute inset-x-10 bottom-2 h-16 rounded-[50%] blur-3xl opacity-70 animate-pulse-glow"
        style={{ background: "radial-gradient(ellipse, var(--color-myntra-glow), transparent 70%)" }}
      />
      {/* Spinning rim */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-rotate-slow opacity-30"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, oklch(0.7 0.26 350 / 0.5) 90deg, transparent 180deg, oklch(0.6 0.25 295 / 0.5) 270deg, transparent 360deg)",
          maskImage: "radial-gradient(circle, transparent 56%, black 57%, black 60%, transparent 61%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 56%, black 57%, black 60%, transparent 61%)",
        }}
      />

      <div
        className="relative h-full w-full transition-transform duration-700 ease-out animate-float"
        style={{ transform: `rotateY(${rotation}deg)`, transformStyle: "preserve-3d" }}
      >
        <svg viewBox="0 0 360 720" className="absolute inset-0 h-full w-full drop-shadow-[0_30px_60px_rgba(236,72,153,0.32)]" aria-hidden>
          <defs>
            <radialGradient id="skin" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#f3d6c0" />
              <stop offset="100%" stopColor="#a07664" />
            </radialGradient>
            <linearGradient id="skinShade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0,0,0,0.25)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
            </linearGradient>
            <linearGradient id="floorLight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(236,79,138,0.0)" />
              <stop offset="100%" stopColor="rgba(236,79,138,0.45)" />
            </linearGradient>
          </defs>

          {/* Floor shadow */}
          <ellipse cx={cx} cy={ankleY + 18} rx={body.hip*1.1} ry={10} fill="rgba(0,0,0,0.55)" filter="blur(2px)" />

          {/* Head */}
          <circle cx={cx} cy={headCy} r={body.headR} fill="url(#skin)" />
          <ellipse cx={cx - 4} cy={headCy - 4} rx={body.headR*0.55} ry={body.headR*0.4} fill="rgba(255,255,255,0.08)" />
          {/* Neck */}
          <rect x={cx - 14} y={headCy + body.headR - 4} width={28} height={body.neckHeight + 6} fill="url(#skin)" rx={6} />

          {/* Arms (mirror) */}
          <g opacity={showSkeleton ? 0.45 : 1}>
            <path d={leftArm} fill="url(#skin)" />
            <g transform={`translate(${cx*2} 0) scale(-1 1)`}>
              <path d={leftArm} fill="url(#skin)" />
            </g>
          </g>

          {/* Body silhouette */}
          <path d={bodyPath} fill="url(#skin)" />
          <path d={bodyPath} fill="url(#skinShade)" opacity={0.6} style={{ mixBlendMode: "overlay" }} />

          {/* GARMENT */}
          {!showSkeleton && product && (
            <Garment
              product={product}
              body={body}
              cx={cx}
              shoulderY={shoulderY}
              waistY={waistY}
              hipY={hipY}
              kneeY={kneeY}
              ankleY={ankleY}
              ease={ease}
              fit={fit}
            />
          )}

          {/* Footwear */}
          {!showSkeleton && footwear && (
            <Footwear product={footwear} cx={cx} ankleY={ankleY} body={body} />
          )}

          {/* Bag */}
          {!showSkeleton && bag && (
            <Handbag product={bag} cx={cx} hipY={hipY} shoulderY={shoulderY} body={body} />
          )}

          {/* Accessory (sunglasses / belt) */}
          {!showSkeleton && accessory && (
            <Accessory product={accessory} cx={cx} headCy={headCy} headR={body.headR} waistY={waistY} body={body} />
          )}

          {/* Scanning beam */}
          {scanning && (
            <>
              <rect x={20} y={0} width={320} height={720} fill="url(#scanGrad)" opacity={0} />
              <line x1={10} x2={350} y1={0} y2={0} stroke="oklch(0.7 0.26 350)" strokeWidth={2}>
                <animate attributeName="y1" values="40;680;40" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="y2" values="40;680;40" dur="2.2s" repeatCount="indefinite" />
              </line>
            </>
          )}
        </svg>

        {/* Soft fashion lighting overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(236,79,138,0.18), transparent 55%), radial-gradient(ellipse at 80% 60%, rgba(120,80,255,0.16), transparent 55%)",
            mixBlendMode: "screen",
          }}
        />

        {scanning && <div className="absolute inset-0 grid-bg opacity-30" />}
      </div>
    </div>
  );
}

// ======================== GARMENT RENDERERS ==========================

type GarmentArgs = {
  product: Product;
  body: Body;
  cx: number;
  shoulderY: number;
  waistY: number;
  hipY: number;
  kneeY: number;
  ankleY: number;
  ease: number;
  fit: Fit;
};

function fold(_color: string, opacity = 0.18) {
  return `rgba(0,0,0,${opacity})`;
}

function lighter(_color: string, opacity = 0.22) {
  return `rgba(255,255,255,${opacity})`;
}

function Garment({ product, body, cx, shoulderY, waistY, hipY, kneeY, ankleY, ease, fit }: GarmentArgs) {
  const s = product.silhouette;
  const c = product.color;
  const accent = product.accent ?? c;
  const ext = ease; // ease multiplier
  const drape = fit === "oversized" ? 12 : fit === "relaxed" ? 6 : 0; // extra drape ripple

  // Garment gradient (subtle satin shading)
  const gradId = `g-${product.id}`;
  const grad = (
    <defs key={gradId}>
      <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={accent} />
        <stop offset="55%" stopColor={c} />
        <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
      </linearGradient>
    </defs>
  );

  // Helpers for path math
  const sh = body.shoulder * ext;
  const wa = body.waist * ext;
  const hp = body.hip * ext;
  const th = body.thigh * ext;
  const ca = body.calf * ext;

  // ---------- TOPS ----------
  if (s === "tshirt" || s === "shirt" || s === "blouse") {
    const bottom = waistY + body.torso * 0.18 + drape;
    const sleeveLen = s === "tshirt" ? 60 : 130;
    const neckDip = s === "blouse" ? 22 : 12;
    const path = `
      M ${cx - sh - 14} ${shoulderY - 4}
      L ${cx - sh - 8 - sleeveLen*0.05} ${shoulderY + sleeveLen}
      L ${cx - sh + 22} ${shoulderY + sleeveLen + 4}
      L ${cx - sh + 14} ${shoulderY + 20}
      L ${cx - wa - 6} ${bottom}
      L ${cx + wa + 6} ${bottom}
      L ${cx + sh - 14} ${shoulderY + 20}
      L ${cx + sh - 22} ${shoulderY + sleeveLen + 4}
      L ${cx + sh + 8 + sleeveLen*0.05} ${shoulderY + sleeveLen}
      L ${cx + sh + 14} ${shoulderY - 4}
      L ${cx + 22} ${shoulderY + neckDip}
      L ${cx - 22} ${shoulderY + neckDip}
      Z
    `;
    return (
      <g>
        {grad}
        <path d={path} fill={`url(#${gradId})`} />
        {/* button placket for shirt */}
        {s === "shirt" && (
          <line x1={cx} y1={shoulderY + neckDip + 6} x2={cx} y2={bottom - 4} stroke={lighter(c, 0.3)} strokeWidth={1.5} />
        )}
        {/* fold shading */}
        <path d={path} fill={fold(c, fit === "oversized" ? 0.16 : 0.08)} style={{ mixBlendMode: "multiply" }} />
      </g>
    );
  }

  if (s === "blazer" || s === "biker-jacket") {
    const bottom = hipY + 30 + drape;
    const lapelDip = 50;
    const path = `
      M ${cx - sh - 18} ${shoulderY - 6}
      L ${cx - sh - 8} ${shoulderY + body.armLength * 0.95}
      L ${cx - sh + 28} ${shoulderY + body.armLength * 0.98}
      L ${cx - sh + 12} ${shoulderY + 28}
      L ${cx - hp - 8} ${bottom}
      L ${cx + hp + 8} ${bottom}
      L ${cx + sh - 12} ${shoulderY + 28}
      L ${cx + sh - 28} ${shoulderY + body.armLength * 0.98}
      L ${cx + sh + 8} ${shoulderY + body.armLength * 0.95}
      L ${cx + sh + 18} ${shoulderY - 6}
      L ${cx + 8} ${shoulderY + lapelDip}
      L ${cx - 8} ${shoulderY + lapelDip}
      Z
    `;
    // Lapels
    const lapelL = `M ${cx - sh + 12} ${shoulderY + 28} L ${cx - 4} ${shoulderY + lapelDip} L ${cx - 4} ${bottom*0.6} L ${cx - wa*0.6} ${bottom*0.55} Z`;
    const lapelR = `M ${cx + sh - 12} ${shoulderY + 28} L ${cx + 4} ${shoulderY + lapelDip} L ${cx + 4} ${bottom*0.6} L ${cx + wa*0.6} ${bottom*0.55} Z`;
    return (
      <g>
        {grad}
        <path d={path} fill={`url(#${gradId})`} />
        <path d={lapelL} fill={accent} opacity={0.85} />
        <path d={lapelR} fill={accent} opacity={0.85} />
        {/* Buttons */}
        <circle cx={cx - 12} cy={shoulderY + lapelDip + 50} r={3} fill="#d6c89a" />
        <circle cx={cx - 12} cy={shoulderY + lapelDip + 80} r={3} fill="#d6c89a" />
        <path d={path} fill={fold(c, 0.1)} style={{ mixBlendMode: "multiply" }} />
      </g>
    );
  }

  if (s === "hoodie") {
    const bottom = hipY + 24 + drape;
    const path = `
      M ${cx - sh - 18} ${shoulderY - 12}
      L ${cx - sh - 6} ${shoulderY + body.armLength * 0.95}
      L ${cx - sh + 26} ${shoulderY + body.armLength * 0.98}
      L ${cx - hp - 4} ${bottom}
      L ${cx + hp + 4} ${bottom}
      L ${cx + sh - 26} ${shoulderY + body.armLength * 0.98}
      L ${cx + sh + 6} ${shoulderY + body.armLength * 0.95}
      L ${cx + sh + 18} ${shoulderY - 12}
      C ${cx + 40} ${shoulderY - 30}, ${cx - 40} ${shoulderY - 30}, ${cx - sh - 18} ${shoulderY - 12}
      Z
    `;
    // hood
    const hood = `M ${cx - 50} ${shoulderY - 8} C ${cx - 40} ${shoulderY - 70}, ${cx + 40} ${shoulderY - 70}, ${cx + 50} ${shoulderY - 8} Z`;
    return (
      <g>
        {grad}
        <path d={hood} fill={accent} opacity={0.9} />
        <path d={path} fill={`url(#${gradId})`} />
        {/* pocket */}
        <path d={`M ${cx - wa*0.7} ${waistY + 20} L ${cx + wa*0.7} ${waistY + 20} L ${cx + wa*0.55} ${bottom - 30} L ${cx - wa*0.55} ${bottom - 30} Z`}
              fill={fold(c, 0.18)} />
        {/* drawstrings */}
        <line x1={cx - 8} y1={shoulderY + 2} x2={cx - 12} y2={shoulderY + 50} stroke="#eee" strokeWidth={1.2} />
        <line x1={cx + 8} y1={shoulderY + 2} x2={cx + 12} y2={shoulderY + 50} stroke="#eee" strokeWidth={1.2} />
      </g>
    );
  }

  // ---------- DRESSES ----------
  if (s === "mini-dress" || s === "midi-dress" || s === "maxi-dress") {
    const bottomY =
      s === "mini-dress" ? hipY + 50 + drape :
      s === "midi-dress" ? kneeY + 20 + drape :
      ankleY - 8 + drape;
    const flare = s === "maxi-dress" ? hp * 1.55 : s === "midi-dress" ? hp * 1.25 : hp * 1.1;
    const strapY = shoulderY + 10;
    const path = `
      M ${cx - sh*0.6} ${strapY}
      L ${cx - wa - 4} ${waistY}
      L ${cx - flare} ${bottomY}
      Q ${cx} ${bottomY + 16} ${cx + flare} ${bottomY}
      L ${cx + wa + 4} ${waistY}
      L ${cx + sh*0.6} ${strapY}
      L ${cx + 18} ${shoulderY + 24}
      L ${cx - 18} ${shoulderY + 24}
      Z
    `;
    // straps
    return (
      <g>
        {grad}
        <path d={path} fill={`url(#${gradId})`} />
        {/* shoulder straps */}
        <rect x={cx - sh*0.55} y={shoulderY - 4} width={5} height={18} fill={c} />
        <rect x={cx + sh*0.55 - 5} y={shoulderY - 4} width={5} height={18} fill={c} />
        {/* drape folds */}
        {Array.from({ length: 3 }).map((_, i) => (
          <path key={i}
            d={`M ${cx - flare*0.6 + i*flare*0.4} ${waistY + 20} Q ${cx - flare*0.6 + i*flare*0.4 + 4} ${(waistY+bottomY)/2} ${cx - flare*0.7 + i*flare*0.45} ${bottomY - 10}`}
            stroke={fold(c, 0.3)} strokeWidth={1.4} fill="none" />
        ))}
        <path d={path} fill={fold(c, 0.08)} style={{ mixBlendMode: "multiply" }} />
      </g>
    );
  }

  // ---------- BOTTOMS ----------
  if (s === "skinny-jeans" || s === "wide-jeans" || s === "trousers") {
    const wide = s === "wide-jeans" ? 1.35 : s === "trousers" ? 1.15 : 1.02;
    const ankleW = ca * wide;
    const path = `
      M ${cx - hp} ${hipY}
      L ${cx - ankleW} ${ankleY}
      L ${cx - 6} ${ankleY}
      L ${cx - 6} ${hipY + 8}
      L ${cx + 6} ${hipY + 8}
      L ${cx + 6} ${ankleY}
      L ${cx + ankleW} ${ankleY}
      L ${cx + hp} ${hipY}
      Z
    `;
    return (
      <g>
        {grad}
        <path d={path} fill={`url(#${gradId})`} />
        <line x1={cx} y1={hipY + 4} x2={cx} y2={ankleY} stroke={fold(c, 0.4)} strokeWidth={1} />
        {/* waistband */}
        <rect x={cx - hp - 2} y={hipY - 6} width={hp*2 + 4} height={10} fill={accent} opacity={0.8} />
        <path d={path} fill={fold(c, 0.1)} style={{ mixBlendMode: "multiply" }} />
      </g>
    );
  }

  if (s === "mini-skirt") {
    const bottomY = hipY + 70 + drape;
    const flare = hp * 1.18;
    const path = `
      M ${cx - hp} ${hipY}
      L ${cx - flare} ${bottomY}
      Q ${cx} ${bottomY + 8} ${cx + flare} ${bottomY}
      L ${cx + hp} ${hipY}
      Z
    `;
    return (
      <g>
        {grad}
        <path d={path} fill={`url(#${gradId})`} />
        {/* pleats */}
        {[-2,-1,0,1,2].map(i => (
          <line key={i} x1={cx + i*14} y1={hipY+4} x2={cx + i*22} y2={bottomY-2} stroke={fold(c,0.3)} strokeWidth={1} />
        ))}
      </g>
    );
  }

  return null;
}

function Footwear({ product, cx, ankleY, body }: { product: Product; cx: number; ankleY: number; body: Body }) {
  const c = product.color;
  const accent = product.accent ?? c;
  if (product.silhouette === "heel") {
    return (
      <g>
        {[-1, 1].map((side) => (
          <g key={side}>
            <ellipse cx={cx + side * 14} cy={ankleY + 14} rx={20} ry={6} fill={c} />
            <rect x={cx + side*14 - 2} y={ankleY + 6} width={3} height={12} fill={c} />
          </g>
        ))}
      </g>
    );
  }
  if (product.silhouette === "boot") {
    return (
      <g>
        {[-1, 1].map((side) => (
          <g key={side}>
            <rect x={cx + side * 14 - 16} y={ankleY - 20} width={28} height={28} rx={4} fill={c} />
            <ellipse cx={cx + side * 14} cy={ankleY + 12} rx={20} ry={6} fill={c} />
          </g>
        ))}
      </g>
    );
  }
  // sneakers (default)
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side}>
          <rect x={cx + side * 14 - 18} y={ankleY + 2} width={32} height={12} rx={6} fill={c} />
          <rect x={cx + side * 14 - 18} y={ankleY + 10} width={32} height={6} rx={3} fill="#ffffff" opacity={0.85} />
          <rect x={cx + side * 14 - 6} y={ankleY + 4} width={4} height={6} fill={accent} />
        </g>
      ))}
    </g>
  );
}

function Handbag({ product, cx, hipY, shoulderY, body }: { product: Product; cx: number; hipY: number; shoulderY: number; body: Body }) {
  const c = product.color;
  const x = cx + body.shoulder + 12;
  const y = hipY - 30;
  return (
    <g>
      {/* strap */}
      <path d={`M ${x - 12} ${shoulderY + 4} C ${x - 4} ${shoulderY + 60}, ${x + 6} ${y - 30}, ${x + 4} ${y}`}
            stroke={c} strokeWidth={2.5} fill="none" />
      <rect x={x - 18} y={y} width={36} height={28} rx={4} fill={c} />
      <rect x={x - 18} y={y + 10} width={36} height={2} fill="rgba(255,255,255,0.4)" />
    </g>
  );
}

function Accessory({ product, cx, headCy, headR, waistY, body }: { product: Product; cx: number; headCy: number; headR: number; waistY: number; body: Body }) {
  const c = product.color;
  if (product.silhouette === "sunglasses") {
    return (
      <g>
        <ellipse cx={cx - 12} cy={headCy - 4} rx={10} ry={7} fill={c} />
        <ellipse cx={cx + 12} cy={headCy - 4} rx={10} ry={7} fill={c} />
        <line x1={cx - 2} y1={headCy - 4} x2={cx + 2} y2={headCy - 4} stroke={c} strokeWidth={2} />
      </g>
    );
  }
  if (product.silhouette === "belt") {
    return (
      <g>
        <rect x={cx - body.waist - 2} y={waistY - 4} width={body.waist*2 + 4} height={8} fill={c} />
        <rect x={cx - 8} y={waistY - 6} width={16} height={12} fill="#c9a84c" />
      </g>
    );
  }
  return null;
}
