import { useMemo } from "react";

function seededParticleValue(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function Particles({ count = 24 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: seededParticleValue(i + count * 1.7) * 100,
        size: seededParticleValue(i + count * 2.9) * 4 + 2,
        delay: seededParticleValue(i + count * 4.1) * 14,
        duration: 10 + seededParticleValue(i + count * 5.3) * 10,
        hue:
          seededParticleValue(i + count * 6.5) > 0.5
            ? "var(--color-myntra-glow)"
            : "var(--color-violet-glow)",
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full blur-[1px] animate-particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.hue,
            boxShadow: `0 0 ${p.size * 4}px ${p.hue}`,
            animationDelay: `-${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
