import mannequinImg from "@/assets/mannequin.png";
import { cn } from "@/lib/utils";

type Fit = "tight" | "perfect" | "relaxed";

export function Mannequin({
  scanning = false,
  fit = "perfect",
  rotation = 0,
  garmentColor = "oklch(0.68 0.24 5)",
}: {
  scanning?: boolean;
  fit?: Fit;
  rotation?: number;
  garmentColor?: string;
}) {
  // Garment overlay sizing by fit
  const torsoScale = fit === "tight" ? 0.95 : fit === "relaxed" ? 1.12 : 1.02;
  const legScale = fit === "tight" ? 0.95 : fit === "relaxed" ? 1.15 : 1.04;

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md">
      {/* Glow base */}
      <div
        aria-hidden
        className="absolute inset-x-8 bottom-6 h-24 rounded-[50%] blur-3xl opacity-70 animate-pulse-glow"
        style={{ background: "radial-gradient(ellipse, var(--color-myntra-glow), transparent 70%)" }}
      />
      {/* Spinning rim */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full animate-rotate-slow opacity-40"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, oklch(0.7 0.26 350 / 0.4) 90deg, transparent 180deg, oklch(0.6 0.25 295 / 0.4) 270deg, transparent 360deg)",
          maskImage: "radial-gradient(circle, transparent 55%, black 56%, black 60%, transparent 61%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 55%, black 56%, black 60%, transparent 61%)",
        }}
      />

      <div
        className="relative h-full w-full transition-transform duration-700 ease-out"
        style={{ transform: `rotateY(${rotation}deg)` }}
      >
        <img
          src={mannequinImg}
          alt="3D virtual fashion mannequin"
          className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_30px_60px_rgba(236,72,153,0.35)] animate-float"
          width={768}
          height={1024}
        />

        {/* Garment overlay - torso */}
        <div
          aria-hidden
          className={cn(
            "absolute left-1/2 top-[28%] h-[26%] w-[34%] -translate-x-1/2 rounded-[40%_40%_35%_35%/55%_55%_30%_30%] transition-all duration-700",
            scanning ? "opacity-0" : "opacity-85",
          )}
          style={{
            transform: `translateX(-50%) scale(${torsoScale})`,
            background: `linear-gradient(180deg, ${garmentColor}, oklch(0.4 0.18 320))`,
            mixBlendMode: "screen",
            filter: "blur(0.5px)",
            boxShadow: `0 0 40px ${garmentColor}`,
          }}
        />
        {/* Garment overlay - legs */}
        <div
          aria-hidden
          className={cn(
            "absolute left-1/2 top-[54%] h-[36%] w-[26%] -translate-x-1/2 transition-all duration-700",
            scanning ? "opacity-0" : "opacity-80",
          )}
          style={{
            transform: `translateX(-50%) scale(${legScale})`,
            background: "linear-gradient(180deg, oklch(0.2 0.02 300), oklch(0.12 0.02 300))",
            clipPath: "polygon(20% 0, 80% 0, 90% 100%, 60% 100%, 50% 30%, 40% 100%, 10% 100%)",
          }}
        />

        {/* Scanning beam */}
        {scanning && (
          <>
            <div
              aria-hidden
              className="absolute inset-x-0 h-1 animate-scan"
              style={{
                background:
                  "linear-gradient(90deg, transparent, oklch(0.7 0.26 350), oklch(0.6 0.25 295), transparent)",
                boxShadow: "0 0 30px oklch(0.7 0.26 350)",
              }}
            />
            <div className="absolute inset-0 grid-bg opacity-30" />
          </>
        )}
      </div>
    </div>
  );
}
