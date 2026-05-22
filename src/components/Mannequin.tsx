import { useMemo } from "react";
import type { Product } from "@/lib/catalog";

import baseFemale from "@/assets/mannequin/base-female.jpg";
import baseMale from "@/assets/mannequin/base-male.jpg";
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

/**
 * Compute realistic body adaptation via CSS transform.
 * - height → vertical scale
 * - weight → horizontal scale (volume)
 * - bodyType → additional shoulder/hip emphasis via skew + tweaks
 */
function useBodyTransform(
  height: number, weight: number, gender: Gender, bodyType: BodyType, fit: Fit,
) {
  return useMemo(() => {
    const hScale = Math.max(0.92, Math.min(1.08, 0.92 + (height - 150) / 60 * 0.16));
    let wScale = Math.max(0.88, Math.min(1.22, 0.9 + (weight - 50) / 80 * 0.32));

    const mods: Record<BodyType, { w: number; topW?: number; botW?: number }> = {
      Slim:      { w: 0.94 },
      Athletic:  { w: 1.02, topW: 1.06 },
      Regular:   { w: 1.0 },
      Curvy:     { w: 1.04, topW: 1.02, botW: 1.08 },
      Plus:      { w: 1.12, topW: 1.10, botW: 1.14 },
      Pear:      { w: 1.02, topW: 0.96, botW: 1.10 },
      Rectangle: { w: 1.0 },
    };
    const m = mods[bodyType];
    wScale *= m.w;
    if (gender === "Male") wScale *= 1.02;

    // Fit influences subtle silhouette puff via filter; mostly handled by chosen outfit image
    const fitGlow = fit === "oversized" ? 1.04 : fit === "relaxed" ? 1.02 : 1.0;

    return {
      transform: `translateZ(0) scale(${wScale * fitGlow}, ${hScale})`,
      transformOrigin: "50% 92%",
      topW: m.topW ?? 1,
      botW: m.botW ?? 1,
    };
  }, [height, weight, gender, bodyType, fit]);
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
