export function ConfidenceMeter({ value, label = "Confidence" }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 80 ? "var(--color-success)" : pct >= 60 ? "var(--color-myntra-glow)" : "var(--color-destructive)";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-display text-2xl font-semibold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full animate-meter"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, var(--color-myntra-glow))`,
            boxShadow: `0 0 16px ${color}`,
          }}
        />
        <div className="absolute inset-0 shimmer opacity-30" />
      </div>
    </div>
  );
}
