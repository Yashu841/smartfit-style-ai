import { useMemo } from "react";

export function Particles({ count = 24 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 4 + 2,
        delay: Math.random() * 14,
        duration: 10 + Math.random() * 10,
        hue: Math.random() > 0.5 ? "var(--color-myntra-glow)" : "var(--color-violet-glow)",
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
