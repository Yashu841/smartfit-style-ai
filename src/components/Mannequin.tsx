import { useMemo } from "react";
import type { Product } from "@/lib/catalog";

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

/* ─── Anatomy model (premium retail mannequin) ─────────────────── */
type Body = {
  // widths (half-widths from centerline)
  shoulder: number;
  chest: number;
  underbust: number;
  waist: number;
  hip: number;
  thigh: number;
  knee: number;
  calf: number;
  ankle: number;
  bicep: number;
  forearm: number;
  neck: number;
  // vertical anchors (Y)
  headTop: number;
  headBottom: number;   // chin
  shoulderY: number;
  bustY: number;
  waistY: number;
  hipY: number;
  kneeY: number;
  ankleY: number;
  // misc
  headW: number;
  headH: number;
  bust: number;   // bust projection (female)
  pec: number;    // pec projection (male)
};

function computeBody(
  height = 170, weight = 65,
  gender: Gender = "Female", bodyType: BodyType = "Regular",
): Body {
  const female = gender !== "Male";

  // base half-widths (px in 420x900 viewBox; cx=210)
  let shoulder = female ? 70 : 84;
  let chest    = female ? 56 : 70;
  let underbust= female ? 46 : 64;
  let waist    = female ? 40 : 58;
  let hip      = female ? 64 : 60;
  let thigh    = female ? 34 : 36;
  let knee     = female ? 22 : 24;
  let calf     = female ? 24 : 26;
  let ankle    = female ? 12 : 14;
  let bicep    = female ? 16 : 22;
  let forearm  = female ? 13 : 18;
  const neck   = female ? 14 : 18;
  const bust   = female ? 8  : 0;
  const pec    = female ? 0  : 4;

  // body type modifiers
  const mods: Record<BodyType, Partial<Record<keyof Body, number>>> = {
    Slim:      { shoulder: 0.92, chest: 0.88, underbust: 0.86, waist: 0.82, hip: 0.9, thigh: 0.85, calf: 0.88, bicep: 0.85 },
    Athletic:  { shoulder: 1.1, chest: 1.06, underbust: 1.0, waist: 0.9, hip: 0.98, thigh: 1.05, calf: 1.05, bicep: 1.15 },
    Regular:   {},
    Curvy:     { shoulder: 1.02, chest: 1.08, underbust: 0.95, waist: 0.86, hip: 1.18, thigh: 1.14, calf: 1.05 },
    Plus:      { shoulder: 1.08, chest: 1.22, underbust: 1.2, waist: 1.28, hip: 1.22, thigh: 1.25, calf: 1.15, bicep: 1.25 },
    Pear:      { shoulder: 0.9, chest: 0.92, underbust: 0.92, waist: 0.94, hip: 1.22, thigh: 1.2, calf: 1.08 },
    Rectangle: { shoulder: 1.0, chest: 0.96, underbust: 1.0, waist: 1.04, hip: 1.0, thigh: 1.0 },
  };
  const mod = mods[bodyType];
  const apply = (v: number, k: keyof Body) => v * (mod[k] ?? 1);
  shoulder = apply(shoulder, "shoulder");
  chest = apply(chest, "chest");
  underbust = apply(underbust, "underbust");
  waist = apply(waist, "waist");
  hip = apply(hip, "hip");
  thigh = apply(thigh, "thigh");
  knee = apply(knee, "knee");
  calf = apply(calf, "calf");
  bicep = apply(bicep, "bicep");
  forearm *= mod.bicep ?? 1;

  // weight volume
  const vol = Math.max(0.82, Math.min(1.45, weight / 65));
  const w1 = 0.6 + 0.4 * vol;
  const w2 = 0.7 + 0.3 * vol;
  chest *= w1; underbust *= w1; waist *= w1 * 0.96; hip *= w2;
  thigh *= w2; calf *= w2; bicep *= w2; forearm *= w2;

  // vertical scale by height
  const h = Math.max(0.88, Math.min(1.14, height / 170));
  const headH = 78;
  const headW = 56;
  const headTop = 40;
  const headBottom = headTop + headH;
  const shoulderY = headBottom + neck + 6;
  const torsoLen = 240 * h;
  const bustY = shoulderY + torsoLen * 0.22;
  const waistY = shoulderY + torsoLen * 0.55;
  const hipY = shoulderY + torsoLen;
  const legLen = 360 * h;
  const kneeY = hipY + legLen * 0.5;
  const ankleY = hipY + legLen;

  return {
    shoulder, chest, underbust, waist, hip, thigh, knee, calf, ankle,
    bicep, forearm, neck, headTop, headBottom, shoulderY, bustY, waistY, hipY, kneeY, ankleY,
    headW, headH, bust, pec,
  };
}

function fitEase(fit: Fit) {
  switch (fit) {
    case "tight":     return 1.03;
    case "perfect":   return 1.10;
    case "relaxed":   return 1.22;
    case "oversized": return 1.38;
  }
}

/* ──────────────────────────────────────────────────────────────── */

export function Mannequin(props: MannequinProps) {
  const {
    height = 170, weight = 65, gender = "Female", bodyType = "Regular",
    fit = "perfect", rotation = 0, scanning = false,
    product = null, footwear = null, bag = null, accessory = null,
    showSkeleton = false,
  } = props;

  const body = useMemo(
    () => computeBody(height, weight, gender, bodyType),
    [height, weight, gender, bodyType],
  );
  const ease = fitEase(fit);
  const cx = 210;

  // realistic anatomical front silhouette
  const sil = useMemo(() => buildSilhouette(body, cx, gender), [body, gender]);

  return (
    <div className="relative mx-auto aspect-[3/5] w-full max-w-[460px] select-none">
      {/* SHOWROOM BACKDROP */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden rounded-[28px]"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 30%, rgba(140,90,180,0.35), transparent 65%), " +
            "radial-gradient(ellipse 60% 40% at 50% 90%, rgba(236,79,138,0.30), transparent 70%), " +
            "linear-gradient(180deg, #1a0f24 0%, #0c0712 60%, #08050d 100%)",
        }}
      >
        {/* Wall LED strip */}
        <div
          className="absolute left-[8%] right-[8%] top-[14%] h-[3px] rounded-full opacity-90"
          style={{ background: "linear-gradient(90deg, transparent, #fff, transparent)", filter: "blur(1.2px)" }}
        />
        {/* Floor neon */}
        <div
          className="absolute bottom-[10%] left-0 right-0 h-[2px] opacity-70"
          style={{ background: "linear-gradient(90deg, transparent 5%, oklch(0.7 0.26 350) 30%, oklch(0.6 0.25 295) 70%, transparent 95%)", filter: "blur(2px)" }}
        />
      </div>

      <div
        className="relative h-full w-full transition-transform duration-700 ease-out"
        style={{ transform: `rotateY(${rotation}deg)`, transformStyle: "preserve-3d", perspective: "1200px" }}
      >
        <svg viewBox="0 0 420 900" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            {/* Matte premium mannequin gradient — dark anthracite with subtle rim */}
            <linearGradient id="mq-body" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor="#1b1b22" />
              <stop offset="18%" stopColor="#3a3a44" />
              <stop offset="50%" stopColor="#5a5a66" />
              <stop offset="82%" stopColor="#34343c" />
              <stop offset="100%" stopColor="#15151b" />
            </linearGradient>
            <linearGradient id="mq-rim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,90,160,0.55)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(140,90,255,0.45)" />
            </linearGradient>
            <radialGradient id="mq-head" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#5a5a66" />
              <stop offset="55%" stopColor="#3a3a44" />
              <stop offset="100%" stopColor="#15151b" />
            </radialGradient>
            <radialGradient id="floor" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(40,30,60,0.95)" />
              <stop offset="60%" stopColor="rgba(20,15,30,0.7)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="podium" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a3046" />
              <stop offset="100%" stopColor="#15101e" />
            </linearGradient>
            {/* Garment specular */}
            <linearGradient id="g-spec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
            </linearGradient>
            <filter id="soft-blur"><feGaussianBlur stdDeviation="0.6" /></filter>
          </defs>

          {/* Floor glow */}
          <ellipse cx={cx} cy={body.ankleY + 38} rx={body.hip*2.2} ry={36} fill="url(#floor)" />
          {/* Podium */}
          <ellipse cx={cx} cy={body.ankleY + 30} rx={body.hip*1.6} ry={14} fill="url(#podium)" />
          <ellipse cx={cx} cy={body.ankleY + 28} rx={body.hip*1.6} ry={3} fill="rgba(255,255,255,0.10)" />

          {/* MANNEQUIN BODY */}
          <g>
            {/* Arms — behind body */}
            <path d={sil.leftArm} fill="url(#mq-body)" />
            <path d={sil.rightArm} fill="url(#mq-body)" />

            {/* Torso/legs silhouette */}
            <path d={sil.body} fill="url(#mq-body)" />
            {/* rim light overlay */}
            <path d={sil.body} fill="url(#mq-rim)" opacity={0.7} style={{ mixBlendMode: "screen" }} />
            {/* center shading line (sternum) */}
            <path
              d={`M ${cx} ${body.shoulderY+10} Q ${cx-2} ${body.waistY-30} ${cx} ${body.waistY+10}`}
              stroke="rgba(0,0,0,0.35)" strokeWidth={1.2} fill="none" filter="url(#soft-blur)"
            />

            {/* Joint seams (premium mannequin signature) */}
            {[body.shoulderY + 4, body.hipY - 2, body.kneeY].map((y, i) => (
              <line key={i} x1={cx - body.hip - 6} y1={y} x2={cx + body.hip + 6} y2={y}
                    stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} strokeDasharray="2 4" opacity={0.55} />
            ))}

            {/* NECK */}
            <path
              d={`M ${cx-body.neck} ${body.headBottom} Q ${cx-body.neck-2} ${body.shoulderY-4} ${cx-body.shoulder*0.55} ${body.shoulderY+2}
                  L ${cx+body.shoulder*0.55} ${body.shoulderY+2} Q ${cx+body.neck+2} ${body.shoulderY-4} ${cx+body.neck} ${body.headBottom} Z`}
              fill="url(#mq-body)"
            />

            {/* HEAD — smooth egg, faceless */}
            <ellipse cx={cx} cy={body.headTop + body.headH*0.5} rx={body.headW*0.5} ry={body.headH*0.5} fill="url(#mq-head)" />
            {/* head highlight */}
            <ellipse cx={cx - body.headW*0.18} cy={body.headTop + body.headH*0.32} rx={body.headW*0.22} ry={body.headH*0.28}
                     fill="rgba(255,255,255,0.10)" />
            {/* head rim */}
            <ellipse cx={cx} cy={body.headTop + body.headH*0.5} rx={body.headW*0.5} ry={body.headH*0.5}
                     fill="url(#mq-rim)" opacity={0.6} style={{ mixBlendMode: "screen" }} />
          </g>

          {/* GARMENT */}
          {!showSkeleton && product && (
            <Garment product={product} body={body} cx={cx} ease={ease} fit={fit} />
          )}
          {!showSkeleton && footwear && (
            <Footwear product={footwear} cx={cx} body={body} />
          )}
          {!showSkeleton && bag && (
            <Handbag product={bag} cx={cx} body={body} />
          )}
          {!showSkeleton && accessory && (
            <Accessory product={accessory} cx={cx} body={body} />
          )}

          {/* Scan beam */}
          {scanning && (
            <>
              <line x1={10} x2={410} y1={0} y2={0} stroke="oklch(0.7 0.26 350)" strokeWidth={2}>
                <animate attributeName="y1" values="40;860;40" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="y2" values="40;860;40" dur="2.2s" repeatCount="indefinite" />
              </line>
              <rect x="0" y="0" width="420" height="900" fill="url(#scan-grid)" opacity="0.15" />
            </>
          )}
        </svg>

        {/* spotlight overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px]"
          style={{
            background:
              "radial-gradient(ellipse 45% 30% at 50% 15%, rgba(255,255,255,0.18), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
        {scanning && <div className="absolute inset-0 grid-bg opacity-25" />}
      </div>
    </div>
  );
}

/* ─── Anatomical silhouette builder ────────────────────────────── */
function buildSilhouette(b: Body, cx: number, gender: Gender) {
  // Torso → legs as one closed path using smooth bezier curves
  // Female: visible bust curve & narrower waist & flared hips.
  // Male: square chest, straight waist.
  const female = gender !== "Male";

  // Shoulder slopes from neck out to deltoid
  const neckEdgeX = cx - b.neck;
  const shoulderTopX = cx - b.shoulder;
  const shoulderTopY = b.shoulderY;
  const deltoidY = b.shoulderY + 18;

  // Bust / chest curve
  const bustOuterX = cx - b.chest - b.bust;
  const bustY = b.bustY;
  // Underbust
  const underX = cx - b.underbust;
  const underY = (b.bustY + b.waistY) / 2;
  // Waist
  const waistOuterX = cx - b.waist;
  // Hip
  const hipOuterX = cx - b.hip;

  // Inner thigh top
  const crotchY = b.hipY + 14;
  // Knee / ankle
  const kneeX = cx - b.knee;
  const ankleX = cx - b.ankle;
  const innerKneeX = cx - b.knee * 0.32;
  const innerAnkleX = cx - b.ankle * 0.32;

  // Build LEFT half then mirror via SVG (we'll write full path to be explicit)
  const body = `
    M ${cx} ${shoulderTopY - 2}
    L ${neckEdgeX} ${shoulderTopY}
    C ${shoulderTopX + 10} ${shoulderTopY - 4}, ${shoulderTopX - 4} ${shoulderTopY + 8}, ${shoulderTopX} ${deltoidY}
    C ${bustOuterX - 4} ${deltoidY + 24}, ${bustOuterX} ${bustY - 18}, ${bustOuterX} ${bustY}
    C ${bustOuterX} ${bustY + 22}, ${underX - 4} ${underY - 8}, ${underX} ${underY}
    C ${waistOuterX - 6} ${underY + 18}, ${waistOuterX} ${b.waistY - 6}, ${waistOuterX} ${b.waistY}
    C ${waistOuterX - 2} ${b.waistY + 18}, ${hipOuterX - 6} ${b.hipY - 22}, ${hipOuterX} ${b.hipY}
    C ${hipOuterX + 4} ${b.hipY + 10}, ${cx - b.thigh - 4} ${crotchY + 6}, ${cx - b.thigh} ${crotchY + 26}
    C ${cx - b.thigh + 2} ${b.kneeY - 60}, ${kneeX - 2} ${b.kneeY - 20}, ${kneeX} ${b.kneeY}
    C ${kneeX + 2} ${b.kneeY + 30}, ${cx - b.calf - 2} ${b.kneeY + 80}, ${cx - b.calf} ${(b.kneeY + b.ankleY)/2}
    C ${cx - b.calf + 4} ${b.ankleY - 50}, ${ankleX - 2} ${b.ankleY - 16}, ${ankleX} ${b.ankleY}
    L ${innerAnkleX} ${b.ankleY + 2}
    C ${innerAnkleX + 4} ${b.ankleY - 40}, ${innerKneeX - 2} ${b.kneeY + 30}, ${innerKneeX} ${b.kneeY}
    C ${innerKneeX + 2} ${b.kneeY - 30}, ${cx - 6} ${b.hipY + 80}, ${cx - 4} ${crotchY + 10}
    L ${cx} ${crotchY + 4}
    L ${cx + 4} ${crotchY + 10}
    C ${cx + 6} ${b.hipY + 80}, ${cx - innerKneeX + cx - 2} ${b.kneeY - 30}, ${2*cx - innerKneeX} ${b.kneeY}
    C ${2*cx - innerKneeX + 2} ${b.kneeY + 30}, ${2*cx - innerAnkleX - 4} ${b.ankleY - 40}, ${2*cx - innerAnkleX} ${b.ankleY + 2}
    L ${2*cx - ankleX} ${b.ankleY}
    C ${2*cx - ankleX + 2} ${b.ankleY - 16}, ${2*cx - (cx - b.calf) - 4} ${b.ankleY - 50}, ${2*cx - (cx - b.calf)} ${(b.kneeY + b.ankleY)/2}
    C ${2*cx - (cx - b.calf) + 2} ${b.kneeY + 80}, ${2*cx - kneeX - 2} ${b.kneeY + 30}, ${2*cx - kneeX} ${b.kneeY}
    C ${2*cx - kneeX + 2} ${b.kneeY - 20}, ${2*cx - (cx - b.thigh) - 2} ${b.kneeY - 60}, ${2*cx - (cx - b.thigh)} ${crotchY + 26}
    C ${2*cx - (cx - b.thigh) + 4} ${crotchY + 6}, ${2*cx - hipOuterX - 4} ${b.hipY + 10}, ${2*cx - hipOuterX} ${b.hipY}
    C ${2*cx - hipOuterX + 6} ${b.hipY - 22}, ${2*cx - waistOuterX + 2} ${b.waistY + 18}, ${2*cx - waistOuterX} ${b.waistY}
    C ${2*cx - waistOuterX + 6} ${b.waistY - 6}, ${2*cx - underX + 4} ${underY + 18}, ${2*cx - underX} ${underY}
    C ${2*cx - underX + 4} ${underY - 8}, ${2*cx - bustOuterX} ${bustY + 22}, ${2*cx - bustOuterX} ${bustY}
    C ${2*cx - bustOuterX} ${bustY - 18}, ${2*cx - bustOuterX + 4} ${deltoidY + 24}, ${2*cx - shoulderTopX} ${deltoidY}
    C ${2*cx - shoulderTopX + 4} ${shoulderTopY + 8}, ${2*cx - shoulderTopX - 10} ${shoulderTopY - 4}, ${2*cx - neckEdgeX} ${shoulderTopY}
    Z
  `;

  // ARMS hanging down with natural taper (left)
  const armTopXL = shoulderTopX + 4;
  const elbowYL = b.shoulderY + 130;
  const handYL = b.hipY + 40;
  const elbowXL = armTopXL - 12;
  const handXL = elbowXL + 6;
  const leftArm = `
    M ${armTopXL - 2} ${shoulderTopY + 4}
    C ${armTopXL - b.bicep - 4} ${b.shoulderY + 50}, ${elbowXL - b.bicep*0.7} ${elbowYL - 10}, ${elbowXL - b.forearm} ${elbowYL}
    C ${elbowXL - b.forearm - 2} ${elbowYL + 50}, ${handXL - b.forearm + 2} ${handYL - 30}, ${handXL - 10} ${handYL}
    L ${handXL + 4} ${handYL + 2}
    C ${handXL + 6} ${handYL - 30}, ${elbowXL + b.forearm*0.4} ${elbowYL + 60}, ${elbowXL + 4} ${elbowYL + 10}
    C ${elbowXL + b.bicep*0.4} ${elbowYL - 30}, ${armTopXL + b.bicep*0.3} ${b.shoulderY + 50}, ${armTopXL + 12} ${shoulderTopY + 16}
    Z
  `;
  // Right arm = mirrored
  const armTopXR = 2*cx - armTopXL;
  const elbowXR = 2*cx - elbowXL;
  const handXR = 2*cx - handXL;
  const rightArm = `
    M ${armTopXR + 2} ${shoulderTopY + 4}
    C ${armTopXR + b.bicep + 4} ${b.shoulderY + 50}, ${elbowXR + b.bicep*0.7} ${elbowYL - 10}, ${elbowXR + b.forearm} ${elbowYL}
    C ${elbowXR + b.forearm + 2} ${elbowYL + 50}, ${handXR + b.forearm - 2} ${handYL - 30}, ${handXR + 10} ${handYL}
    L ${handXR - 4} ${handYL + 2}
    C ${handXR - 6} ${handYL - 30}, ${elbowXR - b.forearm*0.4} ${elbowYL + 60}, ${elbowXR - 4} ${elbowYL + 10}
    C ${elbowXR - b.bicep*0.4} ${elbowYL - 30}, ${armTopXR - b.bicep*0.3} ${b.shoulderY + 50}, ${armTopXR - 12} ${shoulderTopY + 16}
    Z
  `;

  void female;
  return { body, leftArm, rightArm };
}

/* ────────────────── GARMENTS ────────────────── */

function Garment({
  product, body, cx, ease, fit,
}: {
  product: Product; body: Body; cx: number; ease: number; fit: Fit;
}) {
  const s = product.silhouette;
  const c = product.color;
  const accent = product.accent ?? c;
  const drape = fit === "oversized" ? 14 : fit === "relaxed" ? 8 : fit === "tight" ? -2 : 2;
  const sh = body.shoulder * ease;
  const ch = body.chest * ease;
  const wa = body.waist * ease;
  const hp = body.hip * ease;
  const th = body.thigh * ease;
  const kn = body.knee * ease;
  const ca = body.calf * ease;
  const an = body.ankle * ease;

  const gradId = `g-${product.id}`;
  const defs = (
    <defs>
      <linearGradient id={gradId} x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%"  stopColor={lighten(accent, 0.12)} />
        <stop offset="45%" stopColor={c} />
        <stop offset="100%" stopColor={darken(c, 0.28)} />
      </linearGradient>
      <linearGradient id={`${gradId}-spec`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
        <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
      </linearGradient>
    </defs>
  );

  // ─── DRESSES ───
  if (s === "mini-dress" || s === "midi-dress" || s === "maxi-dress") {
    const bottomY =
      s === "mini-dress" ? body.hipY + 70 + drape :
      s === "midi-dress" ? body.kneeY + 30 + drape :
      body.ankleY - 14 + drape;
    const flare =
      s === "maxi-dress" ? hp * 1.7 :
      s === "midi-dress" ? hp * 1.35 :
      hp * 1.12;
    const necklineY = body.shoulderY + 26;
    const path = `
      M ${cx - sh*0.62} ${body.shoulderY + 8}
      Q ${cx - ch - 4} ${body.bustY - 10} ${cx - ch} ${body.bustY + 4}
      C ${cx - underbustX(body)} ${(body.bustY+body.waistY)/2}, ${cx - wa - 4} ${body.waistY - 8}, ${cx - wa} ${body.waistY}
      C ${cx - wa} ${body.waistY + 14}, ${cx - hp*0.95} ${body.hipY - 14}, ${cx - hp} ${body.hipY}
      L ${cx - flare} ${bottomY}
      Q ${cx} ${bottomY + 18} ${cx + flare} ${bottomY}
      L ${cx + hp} ${body.hipY}
      C ${cx + hp*0.95} ${body.hipY - 14}, ${cx + wa} ${body.waistY + 14}, ${cx + wa} ${body.waistY}
      C ${cx + wa + 4} ${body.waistY - 8}, ${cx + underbustX(body)} ${(body.bustY+body.waistY)/2}, ${cx + ch} ${body.bustY + 4}
      Q ${cx + ch + 4} ${body.bustY - 10} ${cx + sh*0.62} ${body.shoulderY + 8}
      Q ${cx + 18} ${necklineY + 6} ${cx} ${necklineY + 14}
      Q ${cx - 18} ${necklineY + 6} ${cx - sh*0.62} ${body.shoulderY + 8}
      Z
    `;
    return (
      <g>
        {defs}
        <path d={path} fill={`url(#${gradId})`} />
        <path d={path} fill={`url(#${gradId}-spec)`} style={{ mixBlendMode: "overlay" }} />
        {/* drape folds */}
        {Array.from({ length: 5 }).map((_, i) => {
          const t = (i + 1) / 6;
          const x1 = cx - flare * 0.7 + i * (flare * 1.4 / 6);
          return (
            <path key={i}
              d={`M ${cx - wa*0.6 + i*wa*0.24} ${body.waistY + 18} Q ${x1 + 2} ${(body.waistY+bottomY)/2} ${x1} ${bottomY - 8}`}
              stroke={darken(c, 0.4)} strokeOpacity={0.45} strokeWidth={1.1} fill="none" />
          );
        })}
        {/* straps */}
        <rect x={cx - sh*0.6} y={body.shoulderY - 2} width={5} height={16} rx={2} fill={c} />
        <rect x={cx + sh*0.6 - 5} y={body.shoulderY - 2} width={5} height={16} rx={2} fill={c} />
      </g>
    );
  }

  // ─── TOPS ───
  if (s === "tshirt" || s === "shirt" || s === "blouse") {
    const bottom = body.waistY + body.waistY*0 + 80 + drape;
    const sleeveLen = s === "tshirt" ? 70 : 150;
    const sleeveEndX = cx - sh - 8 - sleeveLen*0.05;
    const sleeveEndY = body.shoulderY + sleeveLen;
    const necklineY = body.shoulderY + (s === "blouse" ? 28 : 18);
    const path = `
      M ${cx - sh - 8} ${body.shoulderY - 2}
      L ${sleeveEndX - 4} ${sleeveEndY}
      Q ${sleeveEndX + 6} ${sleeveEndY + 14} ${cx - sh + 20} ${sleeveEndY + 4}
      L ${cx - sh + 12} ${body.shoulderY + 22}
      C ${cx - wa - 6} ${body.waistY}, ${cx - wa - 4} ${bottom - 30}, ${cx - wa - 2} ${bottom}
      L ${cx + wa + 2} ${bottom}
      C ${cx + wa + 4} ${bottom - 30}, ${cx + wa + 6} ${body.waistY}, ${cx + sh - 12} ${body.shoulderY + 22}
      L ${cx + sh - 20} ${sleeveEndY + 4}
      Q ${2*cx - sleeveEndX - 6} ${sleeveEndY + 14} ${2*cx - sleeveEndX + 4} ${sleeveEndY}
      L ${cx + sh + 8} ${body.shoulderY - 2}
      L ${cx + 22} ${necklineY}
      Q ${cx} ${necklineY + 10} ${cx - 22} ${necklineY}
      Z
    `;
    return (
      <g>
        {defs}
        <path d={path} fill={`url(#${gradId})`} />
        <path d={path} fill={`url(#${gradId}-spec)`} style={{ mixBlendMode: "overlay" }} />
        {s === "shirt" && (
          <>
            <line x1={cx} y1={necklineY + 6} x2={cx} y2={bottom - 6} stroke={darken(c, 0.45)} strokeWidth={1.2} />
            {[0,1,2,3].map(i => <circle key={i} cx={cx} cy={necklineY + 30 + i*36} r={2} fill={lighten(c, 0.4)} />)}
            {/* collar */}
            <path d={`M ${cx - 22} ${necklineY} L ${cx - 6} ${necklineY + 26} L ${cx + 6} ${necklineY + 26} L ${cx + 22} ${necklineY} L ${cx + 14} ${necklineY - 6} L ${cx - 14} ${necklineY - 6} Z`}
                  fill={accent} opacity={0.95} />
          </>
        )}
      </g>
    );
  }

  if (s === "blazer" || s === "biker-jacket") {
    const bottom = body.hipY + 40 + drape;
    const lapelDip = 70;
    const sleeveEndY = body.shoulderY + body.shoulderY*0 + 280;
    const path = `
      M ${cx - sh - 12} ${body.shoulderY - 8}
      L ${cx - sh - 6} ${sleeveEndY}
      Q ${cx - sh + 4} ${sleeveEndY + 18} ${cx - sh + 26} ${sleeveEndY + 4}
      L ${cx - sh + 14} ${body.shoulderY + 30}
      C ${cx - wa - 8} ${body.waistY}, ${cx - hp - 8} ${body.hipY - 20}, ${cx - hp - 6} ${bottom}
      L ${cx + hp + 6} ${bottom}
      C ${cx + hp + 8} ${body.hipY - 20}, ${cx + wa + 8} ${body.waistY}, ${cx + sh - 14} ${body.shoulderY + 30}
      L ${cx + sh - 26} ${sleeveEndY + 4}
      Q ${cx + sh - 4} ${sleeveEndY + 18} ${cx + sh + 6} ${sleeveEndY}
      L ${cx + sh + 12} ${body.shoulderY - 8}
      L ${cx + 10} ${body.shoulderY + lapelDip}
      L ${cx - 10} ${body.shoulderY + lapelDip}
      Z
    `;
    const lapelL = `M ${cx - sh + 14} ${body.shoulderY + 30} L ${cx - 4} ${body.shoulderY + lapelDip} L ${cx - 6} ${body.waistY + 20} L ${cx - wa*0.6} ${body.waistY + 5} Z`;
    const lapelR = `M ${cx + sh - 14} ${body.shoulderY + 30} L ${cx + 4} ${body.shoulderY + lapelDip} L ${cx + 6} ${body.waistY + 20} L ${cx + wa*0.6} ${body.waistY + 5} Z`;
    return (
      <g>
        {defs}
        <path d={path} fill={`url(#${gradId})`} />
        <path d={lapelL} fill={lighten(c, 0.08)} />
        <path d={lapelR} fill={lighten(c, 0.08)} />
        <path d={path} fill={`url(#${gradId}-spec)`} style={{ mixBlendMode: "overlay" }} />
        {[0,1,2].map(i => <circle key={i} cx={cx - 16} cy={body.waistY + 10 + i*32} r={3.2} fill="#d8c188" />)}
        {/* lapel highlight */}
        <line x1={cx} y1={body.shoulderY + lapelDip} x2={cx} y2={bottom - 6} stroke={darken(c, 0.5)} strokeWidth={1} />
      </g>
    );
  }

  if (s === "hoodie") {
    const bottom = body.hipY + 32 + drape;
    const sleeveEndY = body.shoulderY + 280;
    const path = `
      M ${cx - sh - 14} ${body.shoulderY - 16}
      L ${cx - sh - 4} ${sleeveEndY}
      Q ${cx - sh + 6} ${sleeveEndY + 20} ${cx - sh + 28} ${sleeveEndY + 4}
      L ${cx - hp - 4} ${bottom}
      L ${cx + hp + 4} ${bottom}
      L ${cx + sh - 28} ${sleeveEndY + 4}
      Q ${cx + sh - 6} ${sleeveEndY + 20} ${cx + sh + 4} ${sleeveEndY}
      L ${cx + sh + 14} ${body.shoulderY - 16}
      C ${cx + 60} ${body.shoulderY - 50}, ${cx - 60} ${body.shoulderY - 50}, ${cx - sh - 14} ${body.shoulderY - 16}
      Z
    `;
    const hood = `M ${cx - 70} ${body.shoulderY - 12} C ${cx - 55} ${body.shoulderY - 90}, ${cx + 55} ${body.shoulderY - 90}, ${cx + 70} ${body.shoulderY - 12} Z`;
    return (
      <g>
        {defs}
        <path d={hood} fill={darken(c, 0.15)} />
        <path d={path} fill={`url(#${gradId})`} />
        <path d={`M ${cx - wa*0.8} ${body.waistY + 30} L ${cx + wa*0.8} ${body.waistY + 30} L ${cx + wa*0.6} ${bottom - 30} L ${cx - wa*0.6} ${bottom - 30} Z`}
              fill={darken(c, 0.25)} opacity={0.85} />
        <line x1={cx - 10} y1={body.shoulderY + 4} x2={cx - 14} y2={body.shoulderY + 70} stroke="#eee" strokeWidth={1.4} />
        <line x1={cx + 10} y1={body.shoulderY + 4} x2={cx + 14} y2={body.shoulderY + 70} stroke="#eee" strokeWidth={1.4} />
        <circle cx={cx - 14} cy={body.shoulderY + 72} r={2.5} fill="#eee" />
        <circle cx={cx + 14} cy={body.shoulderY + 72} r={2.5} fill="#eee" />
        <path d={path} fill={`url(#${gradId}-spec)`} style={{ mixBlendMode: "overlay" }} />
      </g>
    );
  }

  // ─── BOTTOMS ───
  if (s === "skinny-jeans" || s === "wide-jeans" || s === "trousers") {
    const wide = s === "wide-jeans" ? 1.45 : s === "trousers" ? 1.2 : 1.05;
    const ankleW = an * wide * 1.6 + 4;
    const path = `
      M ${cx - hp - 2} ${body.hipY - 4}
      L ${cx - ankleW - 2} ${body.ankleY + 4}
      L ${cx - 4} ${body.ankleY + 4}
      C ${cx - 6} ${body.kneeY}, ${cx - 4} ${body.hipY + 40}, ${cx - 2} ${body.hipY + 10}
      L ${cx + 2} ${body.hipY + 10}
      C ${cx + 4} ${body.hipY + 40}, ${cx + 6} ${body.kneeY}, ${cx + 4} ${body.ankleY + 4}
      L ${cx + ankleW + 2} ${body.ankleY + 4}
      L ${cx + hp + 2} ${body.hipY - 4}
      Z
    `;
    return (
      <g>
        {defs}
        <path d={path} fill={`url(#${gradId})`} />
        <rect x={cx - hp - 4} y={body.hipY - 14} width={hp*2 + 8} height={12} fill={darken(c, 0.2)} />
        <line x1={cx} y1={body.hipY - 2} x2={cx} y2={body.ankleY} stroke={darken(c, 0.45)} strokeWidth={1} />
        <path d={path} fill={`url(#${gradId}-spec)`} style={{ mixBlendMode: "overlay" }} />
      </g>
    );
  }

  if (s === "mini-skirt") {
    const bottomY = body.hipY + 90 + drape;
    const flare = hp * 1.22;
    const path = `
      M ${cx - hp - 2} ${body.hipY - 2}
      L ${cx - flare} ${bottomY}
      Q ${cx} ${bottomY + 12} ${cx + flare} ${bottomY}
      L ${cx + hp + 2} ${body.hipY - 2}
      Z
    `;
    return (
      <g>
        {defs}
        <path d={path} fill={`url(#${gradId})`} />
        {[-3,-2,-1,0,1,2,3].map(i => (
          <line key={i} x1={cx + i*12} y1={body.hipY + 4} x2={cx + i*22} y2={bottomY - 4} stroke={darken(c, 0.35)} strokeWidth={1} />
        ))}
        <path d={path} fill={`url(#${gradId}-spec)`} style={{ mixBlendMode: "overlay" }} />
      </g>
    );
  }

  return null;
}

function underbustX(b: Body) { return b.underbust; }

function Footwear({ product, cx, body }: { product: Product; cx: number; body: Body }) {
  const c = product.color;
  const accent = product.accent ?? c;
  if (product.silhouette === "heel") {
    return (
      <g>
        {[-1, 1].map(side => (
          <g key={side}>
            <ellipse cx={cx + side * 18} cy={body.ankleY + 18} rx={22} ry={6} fill={c} />
            <rect x={cx + side*18 - 2} y={body.ankleY + 8} width={3} height={14} fill={c} />
          </g>
        ))}
      </g>
    );
  }
  if (product.silhouette === "boot") {
    return (
      <g>
        {[-1, 1].map(side => (
          <g key={side}>
            <rect x={cx + side * 18 - 18} y={body.ankleY - 24} width={32} height={32} rx={5} fill={c} />
            <ellipse cx={cx + side * 18} cy={body.ankleY + 14} rx={22} ry={6} fill={c} />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g>
      {[-1, 1].map(side => (
        <g key={side}>
          <rect x={cx + side * 18 - 20} y={body.ankleY + 4} width={36} height={14} rx={7} fill={c} />
          <rect x={cx + side * 18 - 20} y={body.ankleY + 12} width={36} height={6} rx={3} fill="#fff" opacity={0.9} />
          <rect x={cx + side * 18 - 6} y={body.ankleY + 6} width={5} height={8} fill={accent} />
        </g>
      ))}
    </g>
  );
}

function Handbag({ product, cx, body }: { product: Product; cx: number; body: Body }) {
  const c = product.color;
  const x = cx + body.shoulder + 26;
  const y = body.hipY - 20;
  return (
    <g>
      <path d={`M ${x - 14} ${body.shoulderY + 12} C ${x - 6} ${body.shoulderY + 80}, ${x + 8} ${y - 40}, ${x + 4} ${y}`}
            stroke={c} strokeWidth={2.6} fill="none" />
      <rect x={x - 22} y={y} width={42} height={32} rx={6} fill={c} />
      <rect x={x - 22} y={y + 12} width={42} height={3} fill="rgba(255,255,255,0.45)" />
      <rect x={x - 6} y={y + 14} width={12} height={4} rx={2} fill="rgba(0,0,0,0.4)" />
    </g>
  );
}

function Accessory({ product, cx, body }: { product: Product; cx: number; body: Body }) {
  const c = product.color;
  const headCy = body.headTop + body.headH * 0.5;
  if (product.silhouette === "sunglasses") {
    return (
      <g>
        <ellipse cx={cx - 14} cy={headCy - 4} rx={12} ry={8} fill={c} />
        <ellipse cx={cx + 14} cy={headCy - 4} rx={12} ry={8} fill={c} />
        <line x1={cx - 2} y1={headCy - 4} x2={cx + 2} y2={headCy - 4} stroke={c} strokeWidth={2} />
      </g>
    );
  }
  if (product.silhouette === "belt") {
    return (
      <g>
        <rect x={cx - body.waist - 4} y={body.waistY - 5} width={body.waist*2 + 8} height={10} fill={c} />
        <rect x={cx - 9} y={body.waistY - 7} width={18} height={14} fill="#c9a84c" />
      </g>
    );
  }
  return null;
}

/* color helpers */
function lighten(hex: string, amt = 0.1) { return mix(hex, "#ffffff", amt); }
function darken(hex: string, amt = 0.1) { return mix(hex, "#000000", amt); }
function mix(a: string, b: string, t: number) {
  const pa = parse(a), pb = parse(b);
  const r = Math.round(pa[0] + (pb[0]-pa[0])*t);
  const g = Math.round(pa[1] + (pb[1]-pa[1])*t);
  const bl = Math.round(pa[2] + (pb[2]-pa[2])*t);
  return `rgb(${r},${g},${bl})`;
}
function parse(c: string): [number, number, number] {
  if (c.startsWith("#")) {
    const v = c.slice(1);
    const n = v.length === 3 ? v.split("").map(x => x+x).join("") : v;
    return [parseInt(n.slice(0,2),16), parseInt(n.slice(2,4),16), parseInt(n.slice(4,6),16)];
  }
  const m = c.match(/\d+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128,128,128];
}
