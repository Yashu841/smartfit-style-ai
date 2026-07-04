import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Mannequin, OUTFIT_IMAGE_MAP } from "@/components/Mannequin";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Particles } from "@/components/Particles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  PRODUCTS,
  findById,
  similarProducts,
  completeTheLook,
  trendingWith,
  whyMatches,
  type Product,
} from "@/lib/catalog";
import {
  Sparkles, Ruler, Wand2, ShieldCheck, ThumbsUp, ThumbsDown,
  ArrowRight, RotateCw, ChevronLeft, AlertTriangle, Heart,
} from "lucide-react";
import { submitSmartFitRecommendation, submitSmartFitFeedback } from "@/lib/smartfit.functions";



function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem("smartfit_user_id");
  if (!id) {
    id = `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem("smartfit_user_id", id);
  }
  return id;
}

type Step = "hero" | "form" | "processing" | "results";
type Fit = "tight" | "perfect" | "relaxed" | "oversized";
type Gender = "Female" | "Male" | "Unisex";
type BodyType = "Slim" | "Athletic" | "Regular" | "Curvy" | "Plus Size" | "Pear" | "Rectangle";
type FitPref = "Slim" | "Regular" | "Relaxed" | "Oversized";

type Profile = {
  height: number;
  weight: number;
  bodyType: BodyType;
  gender: Gender;
  fitPreference: FitPref;
  productId: string;
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

const PROCESSING_STEPS = [
  "Analyzing body proportions…",
  "Mapping garment to your silhouette…",
  "Cross-referencing 2M+ fit reviews…",
  "Generating personalized recommendation…",
];

const fitFromPref = (pref: FitPref): Fit =>
  pref === "Slim" ? "tight" : pref === "Relaxed" ? "relaxed" : pref === "Oversized" ? "oversized" : "perfect";

function localFallback(p: Profile): Recommendation {
  const product = findById(p.productId);
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
  if (p.bodyType === "Curvy" || p.bodyType === "Plus Size") idx = Math.min(5, idx + 1);
  const fit = fitFromPref(p.fitPreference);
  const confidence = 78 + Math.round(Math.random() * 17);
  return {
    size: sizes[idx],
    alternateSize: sizes[Math.min(5, idx + 1)],
    confidence,
    fit,
    fitExplanation: `For your ${p.height}cm · ${p.weight}kg · ${p.bodyType} build, ${product.brand}'s ${product.name} runs true-to-size. Size ${sizes[idx]} delivers a ${fit} silhouette through the ${product.category === "Dress" ? "waist and bust" : "shoulders and chest"}.`,
    outfitCompatibility: 82 + Math.round(Math.random() * 14),
    styling: [
      `Pair with ${product.gender === "Female" ? "pointed heels" : "leather boots"} to elongate the line.`,
      `Layer a structured piece for ${product.occasion[0]?.toLowerCase()} occasions.`,
      `Anchor the palette with neutral accessories — minimal, gold-toned.`,
    ],
  };
}

function parseRecommendation(raw: unknown, p: Profile): Recommendation {
  const fb = localFallback(p);
  if (!raw || typeof raw !== "object") return fb;
  const r = raw as Record<string, unknown>;
  const get = (k: string) => (typeof r[k] === "string" || typeof r[k] === "number" ? String(r[k]) : undefined);
  const size = get("size") || get("recommended_size") || fb.size;
  const confidence = Number(r.confidence ?? r.confidence_score ?? fb.confidence) || fb.confidence;
  const fit = (get("fit") as Fit) || fb.fit;
  return {
    size,
    alternateSize: get("alternative_size") || get("alternate_size") || get("alternateSize") || fb.alternateSize,
    confidence: Math.max(0, Math.min(100, Math.round(confidence > 1 ? confidence : confidence * 100))),
    fit: ["tight", "perfect", "relaxed", "oversized"].includes(fit) ? fit : fb.fit,
    fitExplanation: get("reasoning") || get("fit_explanation") || get("explanation") || fb.fitExplanation,
    outfitCompatibility: Number(r.outfit_compatibility ?? fb.outfitCompatibility) || fb.outfitCompatibility,
    styling: Array.isArray(r.styling) ? (r.styling as string[]) : fb.styling,
  };
}

export function SmartFit() {
  const [step, setStep] = useState<Step>("hero");
  const [procIdx, setProcIdx] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [activeOutfitId, setActiveOutfitId] = useState<string | null>(null);
  const [activeFootwearId, setActiveFootwearId] = useState<string | null>(null);
  const [activeBagId, setActiveBagId] = useState<string | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const [profile, setProfile] = useState<Profile>({
    height: 168,
    weight: 60,
    bodyType: "Regular",
    gender: "Female",
    fitPreference: "Regular",
    productId: "zara-pink-dress",
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
    setActiveOutfitId(profile.productId);
    const product = findById(profile.productId);
    const payload = {
      user_id: getUserId(),
      height: profile.height,
      weight: profile.weight,
      gender: profile.gender,
      body_type: profile.bodyType,
      fit_preference: profile.fitPreference,
      selected_outfit: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        color: product.color,
      },
    };
    const minDelay = new Promise((r) => setTimeout(r, 3400));
    let recommendation: Recommendation;
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
      const text = await res.text();
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { json = text ? { raw: text } : null; }
      recommendation = parseRecommendation(json, profile);
    } catch (err) {
      console.error("SmartFit webhook failed:", err);
      toast.error("AI service unreachable — showing offline recommendation.");
      recommendation = { ...localFallback(profile), fallback: true };
    }
    await minDelay;
    setRec(recommendation);
    setStep("results");

    // Auto-pick a complementary footwear + bag for the demo
    const comp = completeTheLook(product, 6);
    setActiveFootwearId(comp.find(c => c.wearableSlot === "footwear")?.id ?? null);
    setActiveBagId(comp.find(c => c.wearableSlot === "bag")?.id ?? null);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Particles count={28} />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/40 border-b border-white/5">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary btn-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="font-display text-lg font-semibold tracking-tight">
              SmartFit <span className="gradient-text">AI</span>
            </div>
            <span className="ml-3 hidden rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              by Myntra Luxe
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
      {step === "processing" && <Processing idx={procIdx} profile={profile} />}
      {step === "results" && rec && (
        <Results
          profile={profile}
          rec={rec}
          rotation={rotation}
          setRotation={setRotation}
          activeOutfitId={activeOutfitId ?? profile.productId}
          setActiveOutfitId={setActiveOutfitId}
          activeFootwearId={activeFootwearId}
          setActiveFootwearId={setActiveFootwearId}
          activeBagId={activeBagId}
          setActiveBagId={setActiveBagId}
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
  const demoProduct = findById("zara-pink-dress");
  return (
    <section className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:px-16 lg:py-20">
      <div className="space-y-8 animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
          AI Fashion Lab · v3.0 live
        </div>
        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Try it on. <br /><span className="gradient-text">Before you buy it.</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          SmartFit AI builds a virtual you — your height, weight, body type — then dresses you in the exact garment
          you're shopping. Real silhouettes. Real drape. Real fit confidence.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart} className="h-14 rounded-full gradient-primary btn-glow px-7 text-base font-semibold">
            Start virtual try-on <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Private · No camera required
          </div>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-4 pt-4">
          {[
            { k: "94%", v: "Fit accuracy" },
            { k: "2M+", v: "Fit reviews" },
            { k: "<3s", v: "Try-on render" },
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
        <Mannequin
          gender="Female" bodyType="Regular" height={168} weight={60}
          fit="perfect" product={demoProduct}
          footwear={findById("acc-heels-nude")}
          bag={findById("acc-bag-rose")}
        />
        <FloatingBubble className="left-0 top-10" delay="0s">
          <Wand2 className="h-3.5 w-3.5" /> Hi, I'm your AI stylist
        </FloatingBubble>
        <FloatingBubble className="right-0 top-40" delay="1.2s">
          <Ruler className="h-3.5 w-3.5" /> Wearing the actual Zara dress
        </FloatingBubble>
        <FloatingBubble className="left-4 bottom-16" delay="2.4s">
          <Sparkles className="h-3.5 w-3.5" /> 94% confidence match
        </FloatingBubble>
      </div>
    </section>
  );
}

function FloatingBubble({ children, className, delay = "0s" }: { children: React.ReactNode; className?: string; delay?: string }) {
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
  profile, setProfile, onSubmit, onBack,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile({ ...profile, [k]: v });
  const product = findById(profile.productId);

  const productsForGender = useMemo(
    () => PRODUCTS.filter(p => p.wearableSlot === "outfit" && (p.gender === profile.gender || p.gender === "Unisex")),
    [profile.gender],
  );

  // when gender changes, pick first product for that gender
  useEffect(() => {
    const stillValid = productsForGender.some(p => p.id === profile.productId);
    if (!stillValid && productsForGender[0]) {
      setProfile({ ...profile, productId: productsForGender[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.gender]);

  const fit: Fit = fitFromPref(profile.fitPreference);

  return (
    <section className="mx-auto grid max-w-[1400px] gap-12 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(380px,440px)_1fr] lg:gap-16 lg:px-16 lg:py-14">
      {/* Live preview column */}
      <div className="order-2 lg:order-1">
        <div className="lg:sticky lg:top-24 space-y-4">
          <Mannequin
            gender={profile.gender}
            bodyType={profile.bodyType}
            height={profile.height}
            weight={profile.weight}
            fit={fit}
            product={product}
          />
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-myntra-glow)]">Live virtual try-on</div>
            <div className="font-display text-base mt-1">{product.brand} · {product.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {profile.gender} · {profile.bodyType} · {profile.height}cm · {profile.fitPreference} fit
            </div>
          </div>
        </div>
      </div>

      <div className="order-1 lg:order-2 space-y-7 animate-fade-up">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-myntra-glow)]">Step 01 · Your body & style</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            Build your avatar. <span className="gradient-text">Dress it instantly.</span>
          </h2>
        </div>

        <div className="glass-strong space-y-6 rounded-3xl p-6 sm:p-7">
          <SliderField label="Height" unit="cm" value={profile.height} min={140} max={210} onChange={(v) => update("height", v)} />
          <SliderField label="Weight" unit="kg" value={profile.weight} min={35} max={150} onChange={(v) => update("weight", v)} />

          <PillGroup label="Gender"
            options={["Female", "Male", "Unisex"] as Gender[]}
            value={profile.gender} onChange={(v) => update("gender", v)} />
          <PillGroup label="Body Type"
            options={["Slim", "Athletic", "Regular", "Curvy", "Pear", "Rectangle", "Plus Size"] as BodyType[]}
            value={profile.bodyType} onChange={(v) => update("bodyType", v)} />
          <PillGroup label="Preferred Fit"
            options={["Slim", "Regular", "Relaxed", "Oversized"] as FitPref[]}
            value={profile.fitPreference} onChange={(v) => update("fitPreference", v)} />
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold">Pick your outfit</h3>
            <span className="text-xs text-muted-foreground">{productsForGender.length} curated · live try-on updates</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productsForGender.map((p) => (
              <ProductTile key={p.id} product={p} active={p.id === profile.productId} onClick={() => update("productId", p.id)} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button size="lg" onClick={onSubmit}
            className="h-14 rounded-full gradient-primary btn-glow px-8 text-base font-semibold">
            Generate my fit <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProductTile({ product, active, onClick }: { product: Product; active: boolean; onClick: () => void }) {
  const img = OUTFIT_IMAGE_MAP[product.id];
  return (
    <button onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-3 text-left transition-all",
        active
          ? "border-[var(--color-myntra-glow)] bg-white/[0.04] btn-glow"
          : "border-white/10 bg-white/[0.02] hover:border-white/25",
      )}>
      <div className="relative h-36 w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#1a0f24] to-[#08050d]">
        {img ? (
          <img
            src={img}
            alt={`${product.brand} ${product.name}`}
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0"
            style={{ background: `radial-gradient(120% 90% at 30% 20%, ${product.accent ?? product.color}, ${product.color} 60%, #0b0b12 110%)` }} />
        )}
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between">
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/90 backdrop-blur">
            {product.category}
          </span>
          <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white/30" style={{ background: product.color }} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{product.brand}</div>
          <div className="truncate text-sm font-medium">{product.name}</div>
        </div>
        <div className="shrink-0 text-xs font-semibold">₹{product.price.toLocaleString("en-IN")}</div>
      </div>
    </button>
  );
}

function SliderField({ label, unit, value, min, max, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
        <span className="font-display text-2xl font-semibold">
          {value}<span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function PillGroup<T extends string>({ label, options, value, onChange }: {
  label: string; options: T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          return (
            <button key={o} type="button" onClick={() => onChange(o)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                active
                  ? "border-transparent gradient-primary text-white btn-glow"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:border-white/20",
              )}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Processing ───────────── */

function Processing({ idx, profile }: { idx: number; profile: Profile }) {
  const product = findById(profile.productId);
  return (
    <section className="mx-auto grid min-h-[80vh] max-w-[1400px] place-items-center px-6 py-12 sm:px-10 lg:px-16">
      <div className="grid w-full items-center gap-12 lg:grid-cols-2">
        <Mannequin
          scanning
          gender={profile.gender}
          bodyType={profile.bodyType}
          height={profile.height}
          weight={profile.weight}
          product={product}
          fit={fitFromPref(profile.fitPreference)}
        />
        <div className="space-y-8 animate-fade-up">
          <div className="text-xs uppercase tracking-widest text-[var(--color-myntra-glow)]">AI processing</div>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            Mapping the <span className="gradient-text">{product.name}</span> to your body…
          </h2>
          <div className="space-y-3">
            {PROCESSING_STEPS.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? "active" : "pending";
              return (
                <div key={s}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
                    state === "done" && "border-[var(--color-success)]/30 bg-[var(--color-success)]/5",
                    state === "active" && "border-[var(--color-myntra-glow)]/40 bg-[var(--color-myntra-glow)]/5 glass-strong",
                    state === "pending" && "border-white/5 opacity-50",
                  )}>
                  <div className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
                    state === "done" && "bg-[var(--color-success)] text-black",
                    state === "active" && "gradient-primary text-white",
                    state === "pending" && "bg-white/5 text-muted-foreground",
                  )}>
                    {state === "done" ? "✓" : i + 1}
                  </div>
                  <span className={cn("text-sm", state === "active" && "font-medium")}>{s}</span>
                  {state === "active" && (
                    <span className="ml-auto inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-myntra-glow)]" />
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
  profile, rec, rotation, setRotation,
  activeOutfitId, setActiveOutfitId,
  activeFootwearId, setActiveFootwearId,
  activeBagId, setActiveBagId,
  showBefore, setShowBefore, feedback, setFeedback, onRetry,
}: {
  profile: Profile;
  rec: Recommendation;
  rotation: number;
  setRotation: (n: number) => void;
  activeOutfitId: string;
  setActiveOutfitId: (id: string) => void;
  activeFootwearId: string | null;
  setActiveFootwearId: (id: string | null) => void;
  activeBagId: string | null;
  setActiveBagId: (id: string | null) => void;
  showBefore: boolean;
  setShowBefore: (b: boolean) => void;
  feedback: "up" | "down" | null;
  setFeedback: (f: "up" | "down" | null) => void;
  onRetry: () => void;
}) {
  const lowConfidence = rec.confidence < 70;
  const outfit = findById(activeOutfitId);
  const footwear = activeFootwearId ? findById(activeFootwearId) : null;
  const bag = activeBagId ? findById(activeBagId) : null;
  const outfitImg = OUTFIT_IMAGE_MAP[outfit.id];

  const similar = useMemo(() => similarProducts(outfit, 6), [outfit]);
  const complete = useMemo(() => completeTheLook(outfit, 6), [outfit]);
  const trending = useMemo(() => trendingWith(outfit, 6), [outfit]);

  const fitState: Fit = rec.fit;

  return (
    <section className="mx-auto max-w-[1400px] space-y-10 px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(420px,480px)_1fr] lg:gap-16 xl:gap-20">
        {/* Mannequin column */}
        <div className="space-y-4 animate-fade-up lg:sticky lg:top-24">
          <div className="glass-strong rounded-3xl p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-[var(--color-success)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
                {fitState === "perfect" ? "Perfect Fit" : fitState === "tight" ? "Tight Fit" : fitState === "oversized" ? "Oversized" : "Relaxed Fit"}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowBefore(!showBefore)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs hover:border-white/30">
                  {showBefore ? "Show after" : "Show before"}
                </button>
                <button onClick={() => setRotation(rotation + 30)}
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 hover:border-white/30"
                  aria-label="Rotate">
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <Mannequin
              gender={profile.gender}
              bodyType={profile.bodyType}
              height={profile.height}
              weight={profile.weight}
              fit={showBefore ? (fitState === "oversized" ? "tight" : "relaxed") : fitState}
              rotation={rotation}
              product={outfit}
              footwear={footwear}
              bag={bag}
              showSkeleton={showBefore}
            />
            <div className="mt-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Now wearing</div>
              <div className="font-display text-base">{outfit.brand} · {outfit.name}</div>
            </div>
          </div>

          {/* Selected garment card */}
          <div className="glass-strong rounded-2xl p-4 flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {outfitImg ? (
                <img
                  src={outfitImg}
                  alt={`${outfit.brand} ${outfit.name}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: `radial-gradient(120% 90% at 30% 20%, ${outfit.accent ?? outfit.color}, ${outfit.color} 65%, #0b0b12 110%)`,
                    boxShadow: `0 8px 24px -8px ${outfit.color}88`,
                  }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{outfit.brand}</div>
              <div className="truncate font-display text-sm font-semibold">{outfit.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-myntra-glow)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-myntra-glow)]">
                  Recommended size {rec.size}
                </span>
              </div>
            </div>
          </div>

          {/* Fit preview checklist */}
          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-widest text-muted-foreground">Fit preview</span>
              <span className="font-semibold text-[var(--color-success)]">
                {rec.confidence >= 80 ? "High" : rec.confidence >= 60 ? "Medium" : "Low"} confidence
              </span>
            </div>
            {[
              `Recommended size ${rec.size}`,
              "Based on your body profile",
              `Based on ${outfit.brand} ${outfit.category.toLowerCase()}`,
            ].map((line) => (
              <div key={line} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--color-success)]/20 text-[10px] text-[var(--color-success)]">✓</span>
                {line}
              </div>
            ))}
          </div>



          {/* Fit visualization meter */}
          <div className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="uppercase tracking-widest text-muted-foreground">Fit visualization</span>
              <span className="font-semibold gradient-text">{fitState.toUpperCase()}</span>
            </div>
            <div className="flex gap-1.5">
              {(["tight","perfect","relaxed","oversized"] as Fit[]).map(f => (
                <div key={f}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-all",
                    f === fitState ? "gradient-primary btn-glow" : "bg-white/8",
                  )} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Tight</span><span>Perfect</span><span>Relaxed</span><span>Oversized</span>
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="space-y-7 animate-fade-up">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-myntra-glow)]">
            AI Recommendation · {outfit.brand} {outfit.category}
          </div>

          <div className="glass-strong relative overflow-hidden rounded-3xl p-8 sm:p-10">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-50 blur-3xl gradient-primary" />
            <div className="relative">
              <div className="text-sm text-muted-foreground">Your perfect size</div>
              <div className="mt-2 flex items-end gap-5">
                <div className="font-display text-7xl font-bold tracking-tighter gradient-text leading-none">{rec.size}</div>
                <div className="mb-2 text-sm text-muted-foreground">
                  alt. <span className="font-semibold text-foreground">{rec.alternateSize}</span>
                </div>
              </div>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">{rec.fitExplanation}</p>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <ConfidenceMeter value={rec.confidence} label="Fit confidence" />
                <ConfidenceMeter value={rec.outfitCompatibility} label="Outfit compatibility" />
              </div>
            </div>
          </div>

          {lowConfidence && (
            <div className="flex gap-3 rounded-2xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-destructive)]" />
              <div className="text-sm">
                <div className="font-semibold">Low confidence match</div>
                <p className="mt-1 text-muted-foreground">
                  {outfit.brand}'s {outfit.category} has limited fit data for your profile. We suggest trying both {rec.size} and {rec.alternateSize}.
                </p>
                <button onClick={onRetry} className="mt-2 text-xs font-medium text-[var(--color-myntra-glow)] underline-offset-4 hover:underline">
                  Refine my profile →
                </button>
              </div>
            </div>
          )}

          {/* Complete the look */}
          {complete.length > 0 && (
            <CarouselSection
              eyebrow="AI Stylist"
              title="Complete the look"
              subtitle={`Curated to pair with your ${outfit.category.toLowerCase()}`}
              items={complete}
              base={outfit}
              onWear={(p) => {
                if (p.wearableSlot === "footwear") setActiveFootwearId(p.id);
                else if (p.wearableSlot === "bag") setActiveBagId(p.id);
                else if (p.wearableSlot === "outfit") setActiveOutfitId(p.id);
              }}
            />
          )}

          {/* Similar */}
          {similar.length > 0 && (
            <CarouselSection
              eyebrow="Similar styles"
              title={`More ${outfit.gender === "Female" ? "women's" : outfit.gender === "Male" ? "men's" : ""} ${outfit.category.toLowerCase()}s like this`}
              subtitle={`Same silhouette, different mood`}
              items={similar}
              base={outfit}
              onWear={(p) => setActiveOutfitId(p.id)}
            />
          )}

          {/* Trending with */}
          {trending.length > 0 && (
            <CarouselSection
              eyebrow="Trending with this outfit"
              title="Shoppers also styled with"
              subtitle={`${outfit.aesthetic} edits picked by SmartFit`}
              items={trending}
              base={outfit}
              onWear={(p) => {
                if (p.wearableSlot === "footwear") setActiveFootwearId(p.id);
                else if (p.wearableSlot === "bag") setActiveBagId(p.id);
                else if (p.wearableSlot === "outfit") setActiveOutfitId(p.id);
              }}
            />
          )}

          {/* Stylist notes */}
          <div className="glass rounded-3xl p-6">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-[var(--color-myntra-glow)]" /> Stylist notes
            </h3>
            <ul className="mt-3 space-y-2.5">
              {rec.styling.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full gradient-primary" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Trust + quick feedback */}
          <div className="glass rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-myntra-glow)]" />
                AI-generated · Your data never leaves Myntra
              </div>
              <div className="flex items-center gap-2">
                <FeedbackBtn active={feedback === "up"} onClick={() => setFeedback("up")} icon={<ThumbsUp className="h-3.5 w-3.5" />} label="Helpful" />
                <FeedbackBtn active={feedback === "down"} onClick={() => setFeedback("down")} icon={<ThumbsDown className="h-3.5 w-3.5" />} label="Wrong size" />
              </div>
            </div>
          </div>

          {/* Detailed feedback */}
          <FeedbackSection productId={outfit.id} recommendedSize={rec.size} />

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

function CarouselSection({
  eyebrow, title, subtitle, items, base, onWear,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  items: Product[];
  base: Product;
  onWear: (p: Product) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--color-myntra-glow)]">{eyebrow}</div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {subtitle && <span className="hidden text-xs text-muted-foreground sm:block">{subtitle}</span>}
        </div>
      </div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {items.map((p) => (
          <RecommendationCard key={p.id} product={p} reason={whyMatches(base, p)} onWear={() => onWear(p)} />
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ product, reason, onWear }: { product: Product; reason: string; onWear: () => void }) {
  const img = OUTFIT_IMAGE_MAP[product.id];
  return (
    <div className="group relative w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-all hover:border-white/25 hover:bg-white/[0.04]">
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-[#1a0f24] to-[#08050d]">
        {img ? (
          <img
            src={img}
            alt={`${product.brand} ${product.name}`}
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="absolute inset-0"
            style={{ background: `radial-gradient(120% 90% at 30% 20%, ${product.accent ?? product.color}, ${product.color} 60%, #0b0b12 110%)` }} />
        )}
        <button onClick={onWear}
          className="absolute inset-x-2 bottom-2 rounded-full bg-white/95 px-3 py-2 text-[11px] font-semibold text-black opacity-0 transition-opacity group-hover:opacity-100">
          Wear it now
        </button>
        <Heart className="absolute right-2 top-2 h-4 w-4 text-white/80 drop-shadow hover:text-white" />
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{product.brand}</span>
          <span className="text-xs font-semibold">₹{product.price.toLocaleString("en-IN")}</span>
        </div>
        <div className="line-clamp-1 text-sm font-medium">{product.name}</div>
        <div className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-[var(--color-myntra-glow)]" />
          {reason}
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {product.occasion.slice(0, 2).map((o) => (
            <span key={o} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{o}</span>
          ))}
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{product.aesthetic}</span>
        </div>
      </div>
    </div>
  );
}

function FeedbackBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-[var(--color-myntra-glow)] bg-[var(--color-myntra-glow)]/15 text-foreground"
          : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground",
      )}>
      {icon}
      {label}
    </button>
  );
}

/* ───────────── Feedback Section ───────────── */

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function FeedbackSection({ productId, recommendedSize }: { productId: string; recommendedSize: string }) {
  const [accuracy, setAccuracy] = useState<"yes" | "no" | null>(null);
  const [wouldBuy, setWouldBuy] = useState<"yes" | "no" | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>(recommendedSize);
  const [fitRating, setFitRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelectedSize(recommendedSize);
    setAccuracy(null); setWouldBuy(null); setFitRating(0); setFeedbackText(""); setSubmitted(false);
  }, [productId, recommendedSize]);

  const canSubmit = accuracy !== null && wouldBuy !== null && fitRating > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Please answer all required fields before submitting.");
      return;
    }
    setSubmitting(true);
    const payload = {
      user_id: getUserId(),
      product_id: productId,
      recommended_size: recommendedSize,
      selected_size: selectedSize,
      fit_rating: fitRating,
      feedback_text: feedbackText.trim().slice(0, 1000),
      would_buy: wouldBuy === "yes",
      recommendation_accurate: accuracy === "yes",
      submitted_at: new Date().toISOString(),
    };
    try {
      // Fire-and-forget: do not await response from feedback webhook
      fetch(FEEDBACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((err) => console.error("Feedback webhook failed:", err));
      setSubmitted(true);
      toast.success("Feedback received. SmartFit AI just got smarter.");
    } catch (err) {
      console.error("Feedback webhook failed:", err);
      toast.error("Couldn't submit feedback — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="glass-strong rounded-3xl p-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full gradient-primary btn-glow">
            <Heart className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold">Feedback received</div>
            <p className="text-sm text-muted-foreground">SmartFit just got a little smarter — thank you.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-3xl p-6 sm:p-7 space-y-6 animate-fade-up">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--color-myntra-glow)]">Help us improve</div>
        <h3 className="mt-1 font-display text-xl font-semibold">How was this recommendation?</h3>
        <p className="text-xs text-muted-foreground mt-1">Your input trains SmartFit's fit model in real time.</p>
      </div>

      <FbYesNo label="Was the recommendation accurate?" value={accuracy} onChange={setAccuracy} />
      <FbYesNo label="Would you buy this outfit?" value={wouldBuy} onChange={setWouldBuy} />

      <div className="space-y-2.5">
        <Label className="text-sm font-medium text-muted-foreground">Which size did you actually pick?</Label>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button key={s} type="button" onClick={() => setSelectedSize(s)}
              className={cn(
                "min-w-[44px] rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                s === selectedSize
                  ? "border-transparent gradient-primary text-white btn-glow"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:border-white/25",
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Rate the fit</Label>
          <span className="text-xs text-muted-foreground">{fitRating > 0 ? `${fitRating} / 5` : "Tap to rate"}</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setFitRating(n)}
              className={cn(
                "h-11 flex-1 rounded-2xl border text-base font-semibold transition-all",
                n <= fitRating
                  ? "border-transparent gradient-primary text-white btn-glow"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25",
              )}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Label className="text-sm font-medium text-muted-foreground">Anything else? <span className="text-muted-foreground/60">(optional)</span></Label>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="Tell us what worked or what felt off…"
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm placeholder:text-muted-foreground/60 focus:border-[var(--color-myntra-glow)]/60 focus:outline-none"
        />
        <div className="text-right text-[10px] text-muted-foreground/60">{feedbackText.length}/1000</div>
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit}
        size="lg"
        className="h-13 w-full rounded-full gradient-primary btn-glow text-base font-semibold disabled:opacity-50">
        {submitting ? "Sending feedback…" : "Submit feedback"}
        {!submitting && <ArrowRight className="ml-1 h-4 w-4" />}
      </Button>
    </div>
  );
}

function FbYesNo({ label, value, onChange }: {
  label: string; value: "yes" | "no" | null; onChange: (v: "yes" | "no") => void;
}) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((opt) => {
          const active = value === opt;
          return (
            <button key={opt} type="button" onClick={() => onChange(opt)}
              className={cn(
                "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition-all",
                active
                  ? opt === "yes"
                    ? "border-[var(--color-success)]/60 bg-[var(--color-success)]/15 text-[var(--color-success)]"
                    : "border-[var(--color-destructive)]/60 bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:border-white/25",
              )}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
