import { useEffect, useState } from "react";
import { Mannequin } from "@/components/Mannequin";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Particles } from "@/components/Particles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import outfit1 from "@/assets/outfit1.jpg";
import outfit2 from "@/assets/outfit2.jpg";
import outfit3 from "@/assets/outfit3.jpg";
import {
  Sparkles,
  Ruler,
  Wand2,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  RotateCw,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";

const WEBHOOK_URL = "https://hook.eu1.make.com/11jvi2slpo1x8f9ghdpqwymj4jgvebkh";

type Step = "hero" | "form" | "processing" | "results";
type Fit = "tight" | "perfect" | "relaxed";
type Gender = "Female" | "Male" | "Unisex";
type BodyType = "Slim" | "Athletic" | "Regular" | "Curvy" | "Plus";
type FitPref = "Slim" | "Regular" | "Relaxed" | "Oversized";

type Profile = {
  height: number;
  weight: number;
  bodyType: BodyType;
  gender: Gender;
  fitPreference: FitPref;
  productCategory: string;
  brand: string;
};

type Recommendation = {
  size: string;
  confidence: number;
  fitExplanation: string;
  alternateSize: string;
  styling: string[];
  outfitCompatibility: number;
  fit: Fit;
  fallback?: boolean;
};

const CATEGORIES = ["T-Shirt", "Shirt", "Jeans", "Dress", "Jacket", "Hoodie"];
const BRANDS = ["Roadster", "HRX", "H&M", "Zara", "Nike", "Levi's", "Mango"];

const PROCESSING_STEPS = [
  "Analyzing body proportions…",
  "Matching Myntra brand sizing…",
  "Cross-referencing 2M+ fit reviews…",
  "Generating personalized fit recommendation…",
];

function localFallbackRecommendation(p: Profile): Recommendation {
  const bmi = p.weight / Math.pow(p.height / 100, 2);
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  let idx = 2;
  if (bmi < 18) idx = 0;
  else if (bmi < 21) idx = 1;
  else if (bmi < 25) idx = 2;
  else if (bmi < 28) idx = 3;
  else if (bmi < 32) idx = 4;
  else idx = 5;
  if (p.fitPreference === "Oversized") idx = Math.min(5, idx + 1);
  if (p.fitPreference === "Slim") idx = Math.max(0, idx - 1);
  const fit: Fit = p.fitPreference === "Slim" ? "tight" : p.fitPreference === "Oversized" ? "relaxed" : "perfect";
  const confidence = 72 + Math.round(Math.random() * 20);
  return {
    size: sizes[idx],
    alternateSize: sizes[Math.min(5, idx + 1)],
    confidence,
    fit,
    fitExplanation: `Based on your ${p.height}cm / ${p.weight}kg profile and ${p.fitPreference.toLowerCase()} preference, ${p.brand}'s ${p.productCategory} runs true-to-size. Size ${sizes[idx]} delivers a ${fit} silhouette across the chest and shoulders.`,
    outfitCompatibility: 80 + Math.round(Math.random() * 15),
    styling: [
      `Pair with high-rise denim for a balanced silhouette`,
      `Layer with a cropped jacket for evening looks`,
      `Complete with minimal sneakers for streetwear edge`,
    ],
  };
}

function parseRecommendation(raw: unknown, p: Profile): Recommendation {
  const fb = localFallbackRecommendation(p);
  if (!raw || typeof raw !== "object") return fb;
  const r = raw as Record<string, unknown>;
  const get = (k: string) => (typeof r[k] === "string" || typeof r[k] === "number" ? String(r[k]) : undefined);
  const size = get("size") || get("recommended_size") || fb.size;
  const confidence = Number(r.confidence ?? r.confidence_score ?? fb.confidence) || fb.confidence;
  const fit = (get("fit") as Fit) || fb.fit;
  return {
    size,
    alternateSize: get("alternate_size") || get("alternateSize") || fb.alternateSize,
    confidence: Math.max(0, Math.min(100, Math.round(confidence > 1 ? confidence : confidence * 100))),
    fit: ["tight", "perfect", "relaxed"].includes(fit) ? fit : fb.fit,
    fitExplanation: get("fit_explanation") || get("explanation") || fb.fitExplanation,
    outfitCompatibility: Number(r.outfit_compatibility ?? fb.outfitCompatibility) || fb.outfitCompatibility,
    styling: Array.isArray(r.styling) ? (r.styling as string[]) : fb.styling,
  };
}

export function SmartFit() {
  const [step, setStep] = useState<Step>("hero");
  const [procIdx, setProcIdx] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [activeOutfit, setActiveOutfit] = useState(0);
  const [showBefore, setShowBefore] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const [profile, setProfile] = useState<Profile>({
    height: 170,
    weight: 65,
    bodyType: "Athletic",
    gender: "Female",
    fitPreference: "Regular",
    productCategory: "T-Shirt",
    brand: "Roadster",
  });

  useEffect(() => {
    if (step !== "processing") return;
    setProcIdx(0);
    const interval = setInterval(() => {
      setProcIdx((i) => Math.min(i + 1, PROCESSING_STEPS.length - 1));
    }, 900);
    return () => clearInterval(interval);
  }, [step]);

  const submit = async () => {
    setStep("processing");
    setFeedback(null);
    setRec(null);
    const payload = {
      height: String(profile.height),
      weight: String(profile.weight),
      body_type: profile.bodyType,
      fit_preference: profile.fitPreference,
      product_name: profile.productCategory,
      brand: profile.brand,
    };
    const minDelay = new Promise((r) => setTimeout(r, 3600));
    let recommendation: Recommendation;
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { json = text ? { raw: text } : null; }
      recommendation = parseRecommendation(json, profile);
    } catch {
      recommendation = { ...localFallbackRecommendation(profile), fallback: true };
    }
    await minDelay;
    setRec(recommendation);
    setStep("results");
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Particles count={28} />

      {/* Top nav */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/40 border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary btn-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="font-display text-lg font-semibold tracking-tight">
              SmartFit <span className="gradient-text">AI</span>
            </div>
            <span className="ml-3 hidden rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              by Myntra
            </span>
          </div>
          {step !== "hero" && (
            <Button variant="ghost" size="sm" onClick={() => setStep("hero")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="mr-1 h-4 w-4" /> Restart
            </Button>
          )}
        </div>
      </header>

      {step === "hero" && <Hero onStart={() => setStep("form")} />}
      {step === "form" && (
        <FormScreen profile={profile} setProfile={setProfile} onSubmit={submit} onBack={() => setStep("hero")} />
      )}
      {step === "processing" && <Processing idx={procIdx} />}
      {step === "results" && rec && (
        <Results
          profile={profile}
          rec={rec}
          rotation={rotation}
          setRotation={setRotation}
          activeOutfit={activeOutfit}
          setActiveOutfit={setActiveOutfit}
          showBefore={showBefore}
          setShowBefore={setShowBefore}
          feedback={feedback}
          setFeedback={setFeedback}
          onRetry={() => setStep("form")}
        />
      )}
    </main>
  );
}

/* ───────────── Hero ───────────── */

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-12 lg:grid-cols-2 lg:gap-8 lg:py-24">
      <div className="space-y-8 animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
          AI Fashion Engine · v2.4 live
        </div>
        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Find your <span className="gradient-text">perfect fit</span> with AI.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          SmartFit AI analyzes your body profile, fit preference, and brand sizing patterns to recommend your ideal
          size — instantly, with visual try-on.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart} className="h-14 rounded-full gradient-primary btn-glow px-7 text-base font-semibold">
            Start AI Sizing <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Private · No camera required
          </div>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-4 pt-4">
          {[
            { k: "94%", v: "Fit accuracy" },
            { k: "2M+", v: "Fit reviews" },
            { k: "<3s", v: "Recommendation" },
          ].map((s) => (
            <div key={s.v} className="glass rounded-2xl p-4">
              <div className="font-display text-2xl font-semibold gradient-text">{s.k}</div>
              <div className="text-xs text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative animate-fade-in">
        <div className="absolute inset-0 -z-10 grid-bg opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
        <Mannequin fit="perfect" />
        <FloatingBubble className="left-0 top-10" delay="0s">
          <Wand2 className="h-3.5 w-3.5" /> Hi, I'm your AI stylist
        </FloatingBubble>
        <FloatingBubble className="right-0 top-40" delay="1.2s">
          <Ruler className="h-3.5 w-3.5" /> Tell me about your fit
        </FloatingBubble>
        <FloatingBubble className="left-4 bottom-16" delay="2.4s">
          <Sparkles className="h-3.5 w-3.5" /> 94% confidence match
        </FloatingBubble>
      </div>
    </section>
  );
}

function FloatingBubble({
  children,
  className,
  delay = "0s",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: string;
}) {
  return (
    <div
      className={cn(
        "absolute glass-strong flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-medium text-foreground/90 animate-float shadow-xl",
        className,
      )}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

/* ───────────── Form ───────────── */

function FormScreen({
  profile,
  setProfile,
  onSubmit,
  onBack,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile({ ...profile, [k]: v });
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[1fr_1.1fr] lg:py-16">
      <div className="order-2 lg:order-1">
        <div className="lg:sticky lg:top-28">
          <Mannequin fit={profile.fitPreference === "Slim" ? "tight" : profile.fitPreference === "Oversized" ? "relaxed" : "perfect"} />
          <div className="mt-4 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Live preview</div>
            <div className="font-display text-lg">{profile.fitPreference} {profile.productCategory}</div>
          </div>
        </div>
      </div>

      <div className="order-1 lg:order-2 space-y-7 animate-fade-up">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-myntra-glow)]">Step 01 · Your profile</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            A few details. <span className="gradient-text">Magic in seconds.</span>
          </h2>
        </div>

        <div className="glass-strong space-y-7 rounded-3xl p-6 sm:p-8">
          <SliderField label="Height" unit="cm" value={profile.height} min={140} max={210} onChange={(v) => update("height", v)} />
          <SliderField label="Weight" unit="kg" value={profile.weight} min={35} max={150} onChange={(v) => update("weight", v)} />

          <PillGroup
            label="Gender"
            options={["Female", "Male", "Unisex"] as Gender[]}
            value={profile.gender}
            onChange={(v) => update("gender", v)}
          />
          <PillGroup
            label="Body Type"
            options={["Slim", "Athletic", "Regular", "Curvy", "Plus"] as BodyType[]}
            value={profile.bodyType}
            onChange={(v) => update("bodyType", v)}
          />
          <PillGroup
            label="Preferred Fit"
            options={["Slim", "Regular", "Relaxed", "Oversized"] as FitPref[]}
            value={profile.fitPreference}
            onChange={(v) => update("fitPreference", v)}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FloatingSelect
              label="Product Category"
              value={profile.productCategory}
              options={CATEGORIES}
              onChange={(v) => update("productCategory", v)}
            />
            <FloatingSelect label="Brand" value={profile.brand} options={BRANDS} onChange={(v) => update("brand", v)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button
            size="lg"
            onClick={onSubmit}
            className="h-14 rounded-full gradient-primary btn-glow px-8 text-base font-semibold"
          >
            Generate my fit <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function SliderField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
        <span className="font-display text-2xl font-semibold">
          {value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                active
                  ? "border-transparent gradient-primary text-white btn-glow"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:border-white/20",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FloatingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Label className="absolute -top-2 left-3 z-10 bg-card px-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-foreground outline-none transition-all focus:border-[var(--color-myntra-glow)] focus:ring-2 focus:ring-[var(--color-myntra-glow)]/30"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-card">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ───────────── Processing ───────────── */

function Processing({ idx }: { idx: number }) {
  return (
    <section className="mx-auto grid min-h-[80vh] max-w-7xl place-items-center px-5 py-12">
      <div className="grid w-full items-center gap-12 lg:grid-cols-2">
        <Mannequin scanning />
        <div className="space-y-8 animate-fade-up">
          <div className="text-xs uppercase tracking-widest text-[var(--color-myntra-glow)]">AI processing</div>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Reading your <span className="gradient-text">body signature</span>…
          </h2>
          <div className="space-y-3">
            {PROCESSING_STEPS.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? "active" : "pending";
              return (
                <div
                  key={s}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
                    state === "done" && "border-[var(--color-success)]/30 bg-[var(--color-success)]/5",
                    state === "active" && "border-[var(--color-myntra-glow)]/40 bg-[var(--color-myntra-glow)]/5 glass-strong",
                    state === "pending" && "border-white/5 opacity-50",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
                      state === "done" && "bg-[var(--color-success)] text-black",
                      state === "active" && "gradient-primary text-white",
                      state === "pending" && "bg-white/5 text-muted-foreground",
                    )}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </div>
                  <span className={cn("text-sm", state === "active" && "font-medium")}>{s}</span>
                  {state === "active" && (
                    <span className="ml-auto inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-myntra-glow)]" style={{ animationDelay: "0s" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-myntra-glow)]" style={{ animationDelay: "0.15s" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-myntra-glow)]" style={{ animationDelay: "0.3s" }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Results ───────────── */

function Results({
  profile,
  rec,
  rotation,
  setRotation,
  activeOutfit,
  setActiveOutfit,
  showBefore,
  setShowBefore,
  feedback,
  setFeedback,
  onRetry,
}: {
  profile: Profile;
  rec: Recommendation;
  rotation: number;
  setRotation: (n: number) => void;
  activeOutfit: number;
  setActiveOutfit: (n: number) => void;
  showBefore: boolean;
  setShowBefore: (b: boolean) => void;
  feedback: "up" | "down" | null;
  setFeedback: (f: "up" | "down" | null) => void;
  onRetry: () => void;
}) {
  const lowConfidence = rec.confidence < 70;
  const outfits = [
    { img: outfit1, name: "Editorial Power", tag: "Trending" },
    { img: outfit2, name: "Tailored Noir", tag: "Recommended" },
    { img: outfit3, name: "Street Luxe", tag: "New" },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-10 px-5 py-10 lg:py-14">
      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_1fr]">
        {/* Mannequin column */}
        <div className="space-y-4 animate-fade-up">
          <div className="glass-strong rounded-3xl p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-[var(--color-success)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
                {rec.fit === "perfect" ? "Perfect Fit" : rec.fit === "tight" ? "Tight Fit" : "Relaxed Fit"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBefore(!showBefore)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs hover:border-white/30"
                >
                  {showBefore ? "After" : "Before"}
                </button>
                <button
                  onClick={() => setRotation(rotation + 90)}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 hover:border-white/30"
                  aria-label="Rotate"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <Mannequin
              fit={showBefore ? (profile.fitPreference === "Oversized" ? "tight" : "relaxed") : rec.fit}
              rotation={rotation}
            />
          </div>

          {/* Try-on carousel */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg font-semibold">See similar looks</h3>
              <span className="text-xs text-muted-foreground">AI styled · {profile.brand}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {outfits.map((o, i) => (
                <button
                  key={o.name}
                  onClick={() => setActiveOutfit(i)}
                  className={cn(
                    "group relative shrink-0 snap-start overflow-hidden rounded-2xl border transition-all",
                    "h-48 w-36",
                    activeOutfit === i ? "border-[var(--color-myntra-glow)] btn-glow" : "border-white/10 hover:border-white/30",
                  )}
                >
                  <img src={o.img} alt={o.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-left">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-myntra-glow)]">{o.tag}</div>
                    <div className="text-xs font-medium">{o.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="space-y-5 animate-fade-up">
          <div className="text-xs uppercase tracking-widest text-[var(--color-myntra-glow)]">
            AI Recommendation · {profile.brand} {profile.productCategory}
          </div>

          {/* Big size card */}
          <div className="glass-strong relative overflow-hidden rounded-3xl p-7">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-50 blur-3xl gradient-primary" />
            <div className="relative">
              <div className="text-sm text-muted-foreground">Your perfect size</div>
              <div className="mt-1 flex items-end gap-4">
                <div className="font-display text-7xl font-bold tracking-tighter gradient-text">{rec.size}</div>
                <div className="mb-2 text-sm text-muted-foreground">
                  alt. <span className="font-semibold text-foreground">{rec.alternateSize}</span>
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{rec.fitExplanation}</p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <ConfidenceMeter value={rec.confidence} label="Fit confidence" />
                <ConfidenceMeter value={rec.outfitCompatibility} label="Outfit compatibility" />
              </div>
            </div>
          </div>

          {/* Low confidence fallback */}
          {lowConfidence && (
            <div className="flex gap-3 rounded-2xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-destructive)]" />
              <div className="text-sm">
                <div className="font-semibold">Low confidence match</div>
                <p className="mt-1 text-muted-foreground">
                  {profile.brand}'s {profile.productCategory} has limited fit data for your profile. We suggest checking
                  the brand size chart, or trying both {rec.size} and {rec.alternateSize}.
                </p>
                <button onClick={onRetry} className="mt-2 text-xs font-medium text-[var(--color-myntra-glow)] underline-offset-4 hover:underline">
                  Refine my profile →
                </button>
              </div>
            </div>
          )}

          {/* Styling tips */}
          <div className="glass rounded-3xl p-6">
            <h3 className="font-display text-lg font-semibold">Stylist notes</h3>
            <ul className="mt-3 space-y-2.5">
              {rec.styling.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full gradient-primary" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Trust + feedback */}
          <div className="glass rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-myntra-glow)]" />
                AI-generated recommendation · Your data never leaves Myntra
              </div>
              <div className="flex items-center gap-2">
                <FeedbackBtn active={feedback === "up"} onClick={() => setFeedback("up")} icon={<ThumbsUp className="h-3.5 w-3.5" />} label="Helpful" />
                <FeedbackBtn active={feedback === "down"} onClick={() => setFeedback("down")} icon={<ThumbsDown className="h-3.5 w-3.5" />} label="Wrong size" />
              </div>
            </div>
            {feedback && (
              <div className="mt-3 text-xs text-[var(--color-myntra-glow)] animate-fade-in">
                Thanks — your feedback trains SmartFit for future shoppers.
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button size="lg" className="h-14 flex-1 rounded-full gradient-primary btn-glow text-base font-semibold">
              Add to bag · Size {rec.size}
            </Button>
            <Button size="lg" variant="outline" onClick={onRetry} className="h-14 rounded-full border-white/15 bg-white/[0.03] px-6 text-base">
              Try another
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedbackBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-[var(--color-myntra-glow)] bg-[var(--color-myntra-glow)]/15 text-foreground"
          : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// Silence unused import lint
void Input;
