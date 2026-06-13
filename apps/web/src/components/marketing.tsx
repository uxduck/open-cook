import { Link } from "@tanstack/react-router";
import {
  Braces,
  Download,
  ExternalLink,
  Github,
  LibraryBig,
  LockKeyhole,
  LogIn,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type MarketingFoodAsset,
  marketingFeatureAssets,
  marketingHeroAsset,
  marketingIngredientAssets,
} from "../marketingAssets";
import type { CurrentAuthSession } from "../authApi";
import {
  Button,
  marketingBrandClassName,
  marketingNavActionsClassName,
  marketingNavClassName,
  pageContainerClassName,
} from "../ui";
import {
  type AuthIntent,
  githubUrl,
  importSourceLabels,
  marketingPreviewRecipes,
  marketingSocialLinkClass,
  remixDemoResultTitles,
  remixPromptAt,
  remixPromptExamples,
  themeExamples,
  xProfileUrl,
} from "../lib/recipe";
import { RecipeThumb } from "./recipeViews";

export function MarketingPage({
  onAuthIntent,
  onImportRecipes,
  onOpenHome,
  onOpenApp,
  session,
}: {
  onAuthIntent: (intent: Exclude<AuthIntent, null>) => void;
  onImportRecipes: () => void;
  onOpenHome: () => void;
  onOpenApp: () => void;
  session: CurrentAuthSession | null;
}) {
  const previewRecipes = marketingPreviewRecipes;
  const pageRef = useRef<HTMLDivElement>(null);
  const [firstFeatureAsset, secondFeatureAsset, thirdFeatureAsset] =
    marketingFeatureAssets;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let frame = 0;
    let previousScrollY = -1;
    const updateScrollProgress = () => {
      const progress = Math.min(1, window.scrollY / 760);
      pageRef.current?.style.setProperty("--food-scroll", progress.toFixed(3));
    };
    const watchScrollProgress = () => {
      if (window.scrollY !== previousScrollY) {
        previousScrollY = window.scrollY;
        updateScrollProgress();
      }
      frame = window.requestAnimationFrame(watchScrollProgress);
    };

    frame = window.requestAnimationFrame(watchScrollProgress);
    window.addEventListener("resize", updateScrollProgress);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

  return (
    <div
      className={`${pageContainerClassName} relative px-6 pt-5 pb-16 [--food-scroll:0] max-[860px]:px-4 max-[860px]:pt-3.5 max-[860px]:pb-[42px]`}
      ref={pageRef}
    >
      <header className={marketingNavClassName}>
        <button className={marketingBrandClassName} onClick={onOpenHome} type="button">
          <img alt="" className="size-7" src="/logo.png" />
          <span>OpenCook</span>
        </button>
        <div className={marketingNavActionsClassName}>
          <Link
            className="px-2 text-sm font-bold text-(--muted-foreground) hover:text-(--foreground) max-[640px]:hidden"
            to="/pricing"
          >
            Pricing
          </Link>
          <a
            aria-label="Open OpenCook on GitHub"
            className={`${marketingSocialLinkClass} max-[640px]:hidden`}
            href={githubUrl}
            rel="noreferrer"
            target="_blank"
            title="Open OpenCook on GitHub"
          >
            <Github size={24} />
          </a>
          <a
            aria-label="Open uxduck on X"
            className={`${marketingSocialLinkClass} max-[640px]:hidden`}
            href={xProfileUrl}
            rel="noreferrer"
            target="_blank"
            title="Open uxduck on X"
          >
            <svg
              aria-hidden="true"
              className="h-[22px] w-[22px]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.964 6.817H1.68l7.73-8.835L1.254 2.25h6.827l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          {session ? (
            <Button onClick={onOpenApp} size="sm">
              Open app
            </Button>
          ) : (
            <>
              <Button
                className="max-[420px]:hidden!"
                onClick={() => onAuthIntent("login")}
                size="sm"
              >
                <LogIn size={15} />
                Log in
              </Button>
              <Button
                onClick={() => onAuthIntent("signup")}
                size="sm"
                variant="primary"
              >
                <UserPlus size={15} />
                Register
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="relative isolate grid grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] items-center gap-[42px] max-[860px]:grid-cols-1">
        <FloatingFoodLayer />
        <div className="[&>h1]:m-0 [&>h1]:max-w-[760px] [&>h1]:font-display [&>h1]:text-[clamp(44px,7vw,86px)] [&>h1]:font-extrabold [&>h1]:leading-[0.94] [&>h1]:tracking-normal [&>h1]:text-(--color-pop-ink) [&>p]:mx-0 [&>p]:mt-6 [&>p]:mb-[18px] [&>p]:max-w-[610px] [&>p]:text-[19px] [&>p]:leading-[1.55] [&>p]:text-(--color-pop-muted-ink) max-[860px]:[&>h1]:text-[clamp(42px,16vw,64px)] max-[860px]:[&>p]:text-[17px]">
          <h1>Reimagine the recipes you already cook</h1>
          <p>
            Import the recipes you already make and keep them safe. Then{" "}
            <strong>adapt</strong> one for a new diet or a crowd, give it a{" "}
            <strong>theme</strong> for the occasion. Make it dragon meat, a Harry Potter
            feast, or another occasion motif. Or create a <strong>story</strong> to go
            with it. Your original is never touched.
          </p>
          <div className="mx-0 mt-0 mb-6 flex max-w-[640px] flex-wrap gap-2 max-[860px]:mb-5 [&>span]:rounded-full [&>span]:border-2 [&>span]:border-solid [&>span]:border-(--color-pop-ink) [&>span]:bg-[color-mix(in_oklch,var(--color-pop-secondary)_15%,white)] [&>span]:px-2.5 [&>span]:py-2 [&>span]:text-xs [&>span]:font-[850] [&>span]:leading-none [&>span]:text-(--color-pop-ink)">
            {importSourceLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button onClick={onImportRecipes} size="lg" variant="primary">
              Import your recipes
              <ExternalLink size={16} />
            </Button>
          </div>
        </div>

        <section
          className="relative grid min-w-0 gap-2.5 overflow-hidden rounded-lg border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-3 shadow-pop [&>*]:relative [&>*]:z-[1]"
          aria-label="OpenCook preview"
        >
          {marketingHeroAsset ? (
            <MarketingAsset
              asset={marketingHeroAsset}
              className="absolute! z-0! right-[-100px] top-[-88px] w-[164px] rotate-[8deg] opacity-[0.58] drop-shadow-[4px_5px_0_var(--color-pop-ink)] max-[860px]:right-[-58px] max-[860px]:top-[-38px] max-[860px]:w-40 max-[860px]:opacity-[0.78]"
              decorative
            />
          ) : null}
          <div className="flex items-center justify-between [&>span]:rounded-full [&>span]:bg-(--color-pop-card) [&>span]:px-2 [&>span]:py-[3px] [&>span]:text-xs [&>span]:font-extrabold [&>span]:text-(--color-pop-muted-ink) [&>strong]:text-[17px]">
            <strong>One recipe, many versions</strong>
            <span>original stays safe</span>
          </div>
          <div className="grid gap-2.5">
            {previewRecipes.map((recipe) => (
              <article
                className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-2.5 rounded-lg border-2 border-solid border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-bg)_58%,white)] p-2 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-[3px] [&_span]:truncate [&_span]:text-[13px] [&_span]:text-(--color-pop-muted-ink) [&_strong]:truncate"
                key={recipe.id}
              >
                <RecipeThumb className="size-14" recipe={recipe} />
                <div>
                  <strong>{recipe.title}</strong>
                  <span>{recipe.tags.slice(0, 2).join(" / ")}</span>
                </div>
              </article>
            ))}
          </div>
          <HeroRemixDemo
            onSaveVariation={() => (session ? onOpenApp() : onAuthIntent("signup"))}
          />
        </section>
      </section>

      <section
        className="mt-[42px] grid grid-cols-3 gap-3.5 max-[860px]:grid-cols-1 [&>article]:relative [&>article]:grid [&>article]:min-h-[210px] [&>article]:content-start [&>article]:gap-2.5 [&>article]:overflow-hidden [&>article]:rounded-lg [&>article]:border-2 [&>article]:border-solid [&>article]:border-(--color-pop-ink) [&>article]:bg-(--color-pop-card) [&>article]:px-[18px] [&>article]:pt-[18px] [&>article]:pb-24 [&>article]:shadow-pop-sm max-[860px]:[&>article]:pb-[84px] [&_article>*]:relative [&_article>*]:z-[1] [&_h2]:m-0 [&_h2]:text-[21px] [&_h2]:leading-[1.12] [&_p]:m-0 [&_p]:text-(--color-pop-muted-ink) [&_svg]:text-(--color-pop-primary)"
        id="remix"
      >
        <article id="library">
          {firstFeatureAsset ? (
            <MarketingAsset
              asset={firstFeatureAsset}
              className="absolute! z-0! bottom-[-36px] right-[-30px] w-[126px] rotate-[7deg] opacity-90 drop-shadow-[3px_4px_0_var(--color-pop-ink)] max-[860px]:w-28"
              decorative
            />
          ) : null}
          <LibraryBig size={20} />
          <h2>Import the recipes you already cook</h2>
          <p>
            Bring in family staples, recipe links, Markdown notes, JSON files, and old
            app exports. Everything stays tied to your private account. It stays the
            source of truth for everything below.
          </p>
        </article>
        <article id="adapt">
          {secondFeatureAsset ? (
            <MarketingAsset
              asset={secondFeatureAsset}
              className="absolute! z-0! bottom-[-36px] right-[-30px] w-[126px] rotate-[7deg] opacity-90 drop-shadow-[3px_4px_0_var(--color-pop-ink)] max-[860px]:w-28"
              decorative
            />
          ) : null}
          <RefreshCcw size={20} />
          <h2>Adapt the cooking. The original stays put.</h2>
          <p>
            Generate a new version with the changes you want: make it vegan, scale it
            for a crowd, or strip it back for a busy weeknight. The original recipe is
            never overwritten.
          </p>
        </article>
        <article id="themes">
          {thirdFeatureAsset ? (
            <MarketingAsset
              asset={thirdFeatureAsset}
              className="absolute! z-0! bottom-[-36px] right-[-30px] w-[126px] rotate-[7deg] opacity-90 drop-shadow-[3px_4px_0_var(--color-pop-ink)] max-[860px]:w-28"
              decorative
            />
          ) : null}
          <Sparkles size={20} />
          <h2>Theme the dish. Keep the same ingredients.</h2>
          <p>
            Keep the cooking exactly as it is and dress it up for the occasion: a themed
            image of the food and a card to hand round the table. For example, a Harry
            Potter feast or a Halloween spread.
          </p>
        </article>
      </section>

      <section
        className="mt-14 grid grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] items-center gap-6 pt-2 pb-3 max-[860px]:mt-[38px] max-[860px]:grid-cols-1 [&_h2]:m-0 [&_h2]:max-w-[640px] [&_h2]:font-display [&_h2]:text-[clamp(32px,4vw,54px)] [&_h2]:font-extrabold [&_h2]:leading-[0.98] [&_h2]:tracking-normal [&_h2+p]:mx-0 [&_h2+p]:mt-4 [&_h2+p]:mb-0 [&_h2+p]:max-w-[600px] [&_h2+p]:text-lg [&_h2+p]:leading-[1.55] [&_h2+p]:text-(--color-pop-muted-ink)"
        aria-labelledby="theme-board-title"
      >
        <div>
          <h2 id="theme-board-title">One recipe. Three ways to make it yours.</h2>
          <p>
            <strong>Adapt</strong> changes the cooking itself. A new version with
            different ingredients, portions, or effort. <strong>Theme</strong> keeps the
            ingredients and changes only the look. A themed image and a card for the
            table. <strong>Story</strong> writes a tale to serve alongside it. Pick a
            theme to see where a recipe could go:
          </p>
        </div>
        <div className="flex flex-wrap content-center justify-end gap-2.5 max-[860px]:justify-start [&>span]:rounded-full [&>span]:border-2 [&>span]:border-solid [&>span]:border-(--color-pop-ink) [&>span]:bg-[color-mix(in_oklch,var(--color-pop-accent)_28%,white)] [&>span]:px-3 [&>span]:py-2.5 [&>span]:text-[15px] [&>span]:font-[850] [&>span]:leading-none [&>span]:text-(--color-pop-ink) [&>span:nth-child(2n)]:bg-[color-mix(in_oklch,var(--color-pop-secondary)_22%,white)] [&>span:nth-child(3n)]:bg-[color-mix(in_oklch,var(--color-pop-primary)_14%,white)]">
          {themeExamples.map((theme) => (
            <span key={theme}>{theme}</span>
          ))}
        </div>
      </section>

      <section className="mt-[58px] grid gap-6 pt-2.5 pb-4" id="ownership">
        <div className="grid max-w-[780px] gap-3.5 [&>h2]:m-0 [&>h2]:font-display [&>h2]:text-[clamp(32px,4vw,56px)] [&>h2]:font-extrabold [&>h2]:leading-[0.98] [&>p]:m-0 [&>p]:text-lg [&>p]:leading-[1.55] [&>p]:text-(--color-pop-muted-ink)">
          <h2>Your recipe data belongs to you.</h2>
          <p>
            OpenCook is built around a no-lock-in promise: your originals stay yours,
            your account can leave with them, and the API contract is open enough to
            build your own tools on top.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3.5 max-[860px]:grid-cols-1 [&>article]:grid [&>article]:min-h-[190px] [&>article]:gap-2.5 [&>article]:rounded-lg [&>article]:border-2 [&>article]:border-solid [&>article]:border-(--color-pop-ink) [&>article]:bg-(--color-pop-card) [&>article]:p-[18px] [&>article]:shadow-pop-sm [&_code]:rounded-md [&_code]:border-2 [&_code]:border-solid [&_code]:border-(--color-pop-ink) [&_code]:bg-[color-mix(in_oklch,var(--color-pop-accent)_22%,white)] [&_code]:px-[5px] [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:font-extrabold [&_code]:text-(--color-pop-ink) [&_h3]:m-0 [&_h3]:text-xl [&_h3]:leading-[1.1] [&_p]:m-0 [&_p]:text-(--color-pop-muted-ink) [&_svg]:text-(--color-pop-primary)">
          <article>
            <Download size={20} />
            <h3>Export anytime</h3>
            <p>
              Download your cookbook as portable JSON or Markdown whenever you want a
              backup, migration path, or local archive.
            </p>
          </article>
          <article>
            <Braces size={20} />
            <h3>Build from the OpenAPI spec</h3>
            <p>
              Point Codex or your own scripts at <code>/openapi.json</code> and
              vibe-code meal planners, importers, dashboards, or family kitchen apps.
            </p>
          </article>
          <article>
            <ShieldCheck size={20} />
            <h3>No lock-in cookbook</h3>
            <p>
              OpenCook can adapt, theme, and tell stories about your recipes, but the
              source collection remains portable and under your control.
            </p>
          </article>
        </div>
      </section>

      <section
        className="mt-14 flex items-center gap-[18px] rounded-lg border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) px-6 py-[18px] shadow-pop-sm [&_p]:m-0 [&_p]:text-[19px] [&_p]:leading-[1.3] [&_span]:mb-1 [&_span]:block [&_span]:text-xs [&_span]:font-extrabold [&_span]:uppercase [&_span]:text-(--color-pop-muted-ink)"
        aria-label="Kitchen joke"
      >
        {jokePotatoAsset ? (
          <MarketingAsset
            asset={jokePotatoAsset}
            className="w-16 shrink-0 rotate-[-8deg] drop-shadow-[3px_4px_0_var(--color-pop-ink)]"
            decorative
          />
        ) : null}
        <div>
          <span>One last bite</span>
          <p>
            What&apos;s a potato&apos;s favorite kind of remix?{" "}
            <strong>A mash-up.</strong>
          </p>
        </div>
      </section>
    </div>
  );
}

export const jokePotatoAsset = marketingIngredientAssets.find(
  (asset) => asset.id === "potato",
);

export function FloatingFoodLayer() {
  return (
    <div
      className="pointer-events-none absolute -z-[1] h-[min(680px,78vh)] [inset:-48px_-32px_auto_-32px] max-[860px]:hidden"
      aria-hidden="true"
    >
      {marketingIngredientAssets.map((asset) => (
        <MarketingAsset
          asset={asset}
          className={`absolute w-[var(--food-size,84px)] animate-bob drop-shadow-[4px_5px_0_color-mix(in_oklch,var(--color-pop-ink)_75%,transparent)] [transform:translate3d(calc(var(--food-scroll)*var(--scroll-x,0px)),calc(var(--food-scroll)*var(--scroll-y,0px)),0)_rotate(calc(var(--food-scroll)*var(--scroll-rotate,0deg)))] max-[860px]:w-[calc(var(--food-size,84px)*0.76)] ${asset.className}`}
          decorative
          key={asset.id}
        />
      ))}
    </div>
  );
}

export function MarketingAsset({
  asset,
  className,
  decorative = false,
}: {
  asset: MarketingFoodAsset;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      alt={decorative ? "" : asset.alt}
      className={[
        "block h-auto pointer-events-none select-none opacity-0 transition-opacity data-[loaded=true]:opacity-100 [&[hidden]]:hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      decoding="async"
      loading="lazy"
      onLoad={(event) => {
        event.currentTarget.dataset.loaded = "true";
      }}
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
      src={asset.src}
    />
  );
}

// Each hero prompt (see remixPromptExamples) maps to one showcase step, so the
// typed prompt and the morphing result card stay in sync. accent is a theme CSS
// variable so the card recolors itself per kind without new stylesheet rules.
const heroShowcaseSteps = [
  {
    kind: "Theme",
    sticker: "🎃",
    accent: "--primary",
    blurb: "Same bake. A Halloween makeover.",
  },
  {
    kind: "Theme",
    sticker: "🐉",
    accent: "--pop-green",
    blurb: "Ingredients unchanged, just the look.",
  },
  {
    kind: "Adapt",
    sticker: "🌱",
    accent: "--secondary",
    blurb: "A new version. Original stays put.",
  },
  {
    kind: "Story",
    sticker: "📖",
    accent: "--accent",
    blurb: "A tale to serve alongside.",
  },
] as const;

export function HeroRemixDemo({ onSaveVariation }: { onSaveVariation: () => void }) {
  const [promptIndex, setPromptIndex] = useState(0);
  const advancePrompt = useCallback(() => {
    setPromptIndex((current) => (current + 1) % remixPromptExamples.length);
  }, []);

  const step = heroShowcaseSteps[promptIndex] ?? heroShowcaseSteps[0];
  const resultTitle = remixDemoResultTitles[promptIndex] ?? remixDemoResultTitles[0];

  return (
    <div className="grid gap-2 rounded-lg border-2 border-solid border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-accent)_30%,white)] p-3">
      <span className="text-xs font-extrabold text-(--color-pop-muted-ink)">
        Live preview
      </span>
      <AnimatedRemixPrompt
        onCycleComplete={advancePrompt}
        paused={false}
        prompt={remixPromptAt(promptIndex)}
      />
      <div
        aria-live="polite"
        className="grid gap-0.5 rounded-lg border-2 border-solid border-(--color-pop-primary) bg-[color-mix(in_oklch,var(--color-pop-bg)_72%,white)] px-2.5 py-2 transition-all duration-500 [&>span]:text-[13px] [&>span]:font-[750] [&>span]:text-(--color-pop-muted-ink) [&>strong]:text-sm"
        style={{ borderColor: `var(${step.accent})` }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-base leading-none">
            {step.sticker}
          </span>
          <span
            className="rounded-full border-2 px-2 py-px text-[11px] font-extrabold uppercase tracking-wide transition-colors duration-500"
            style={{ borderColor: `var(${step.accent})`, color: `var(${step.accent})` }}
          >
            {step.kind}
          </span>
        </div>
        <strong
          className="transition-colors duration-500"
          style={{ color: `var(${step.accent})` }}
        >
          {resultTitle}
        </strong>
        <span>{step.blurb}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold text-(--muted-foreground)">
        <LockKeyhole size={13} />
        <span>Original recipe untouched</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSaveVariation} size="sm" variant="primary">
          Try it with your recipes
        </Button>
      </div>
    </div>
  );
}

export function AnimatedRemixPrompt({
  onCycleComplete,
  paused,
  prompt,
}: {
  onCycleComplete: () => void;
  paused: boolean;
  prompt: string;
}) {
  const [characterCount, setCharacterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const fullPrompt = prompt;
  const typedPrompt = paused ? fullPrompt : fullPrompt.slice(0, characterCount);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReduceMotion(query.matches);
    syncPreference();
    query.addEventListener("change", syncPreference);
    return () => query.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (reduceMotion || paused) {
      setCharacterCount(fullPrompt.length);
      return undefined;
    }

    const isComplete = characterCount === fullPrompt.length;
    const isEmpty = characterCount === 0;
    const delay = isComplete && !deleting ? 1600 : deleting ? 28 : 44;
    const timer = window.setTimeout(() => {
      if (isComplete && !deleting) {
        setDeleting(true);
        return;
      }

      if (isEmpty && deleting) {
        setDeleting(false);
        onCycleComplete();
        return;
      }

      setCharacterCount((current) => current + (deleting ? -1 : 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [characterCount, deleting, fullPrompt, onCycleComplete, paused, reduceMotion]);

  return (
    <div
      aria-label={`Remix prompt: ${fullPrompt}`}
      className="flex min-h-[42px] min-w-0 items-center gap-2 rounded-lg border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) px-3 py-2.5 text-(--color-pop-ink)"
      role="img"
    >
      <span
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-solid border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-secondary)_22%,white)] text-(--color-pop-primary)"
        aria-hidden="true"
      >
        <UserRound size={14} />
      </span>
      <span
        className={`inline-block min-w-0 max-w-[calc(100%-44px)] flex-initial truncate text-base font-[850] leading-[1.2] ${
          typedPrompt ? "" : "text-(--color-pop-muted-ink)"
        }`}
      >
        {typedPrompt || "Describe the remix..."}
      </span>
    </div>
  );
}
