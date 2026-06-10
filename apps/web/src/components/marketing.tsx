import { Link } from "@tanstack/react-router";
import {
  ingredientBaseText,
  ingredientDisplayText,
  parseRecipeYield,
  type Recipe,
  type RecipeImage,
  type RecipeIngredient,
  type RecipeShare,
  type RecipeStep,
  type RecipeVisibility,
  recipeSearchText,
  type SharedRecipe,
  servingScaleFactor,
  structureIngredients,
  structureSteps,
} from "@open-cook/core";
import { ArrowLeft, ArchiveX, BookOpen, Braces, CheckCircle2, ChefHat, Clipboard, Clock3, Compass, Copy, Database, Download, ExternalLink, FileCode2, FileText, Github, Globe2, GripVertical, Image, ImagePlus, KeyRound, LibraryBig, Link2, ListChecks, Loader2, LockKeyhole, LogIn, Minus, Plus, RefreshCcw, Save, Search, Server, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, UploadCloud, UserPlus, UserRound, Users, Wand2, Workflow, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AgentManifest,
  type ApiInfo,
  api,
  type OpenApiDocument,
  type ShoppingListResult,
} from "../api";
import { authApi, type CurrentAuthSession } from "../authApi";
import { displayImageUrl } from "../imageDisplayUrl";
import {
  type MarketingFoodAsset,
  marketingFeatureAssets,
  marketingHeroAsset,
  marketingIngredientAssets,
} from "../marketingAssets";
import { Button, buttonClassName } from "../ui";
import {
  type AuthIntent, demoRecipes, emptyNoteClass, emptyRecipe, errorMessage, footnoteClass, githubUrl, hasIngredientStructure, importSourceLabels, ingredientWithText, marketingPreviewRecipes, marketingSocialLinkClass, optionalNumber, optionalQuantity, type Page, previewText, readOnlyListClass, recipeAutoSaveDebounceMs, recipeImagesOf, recipeSavePayload, recipeSearchDebounceMs, type RecipeSection, recipesFromStashCookExport, recipeTimeSummary, remixDemoResultTitles, remixPromptAt, remixPromptExamples, type SaveState, sharedRecipeKey, shortDate, themeExamples, useDebouncedValue, visibilityPillClass, xProfileUrl,
} from "../lib/recipe";
import { RecipeThumb } from "./recipeViews";

export function MarketingPage({
  onAuthIntent,
  onOpenApp,
  session,
}: {
  onAuthIntent: (intent: Exclude<AuthIntent, null>) => void;
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
    <div className="marketing-page" ref={pageRef}>
      <header className="marketing-nav">
        <button className="marketing-brand" onClick={onOpenApp} type="button">
          <img alt="" className="brand-logo" src="/logo.png" />
          <span>OpenCook</span>
        </button>
        <div className="marketing-nav-actions">
          <Link
            className="px-2 text-sm font-bold text-(--muted-foreground) hover:text-(--foreground)"
            to="/pricing"
          >
            Pricing
          </Link>
          <a
            aria-label="Open OpenCook on GitHub"
            className={marketingSocialLinkClass}
            href={githubUrl}
            rel="noreferrer"
            target="_blank"
            title="Open OpenCook on GitHub"
          >
            <Github size={24} />
          </a>
          <a
            aria-label="Open uxduck on X"
            className={marketingSocialLinkClass}
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
              <Button onClick={() => onAuthIntent("login")} size="sm">
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

      <section className="marketing-hero">
        <FloatingFoodLayer />
        <div className="hero-copy">
          <h1>Reimagine the recipes you already cook</h1>
          <p>
            Import the recipes you already make and keep them safe. Then{" "}
            <strong>adapt</strong> one for a new diet or a crowd, give it a{" "}
            <strong>theme</strong> for the occasion. Make it dragon meat, a Harry
            Potter feast, or another occasion motif. Or create a <strong>story</strong> to
            go with it. Your original
            is never touched.
          </p>
          <div className="hero-import-strip">
            {importSourceLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="hero-actions">
            <Button
              className="hero-primary"
              onClick={() => (session ? onOpenApp() : onAuthIntent("signup"))}
              variant="primary"
            >
              Import your recipes
              <ExternalLink size={16} />
            </Button>
          </div>
        </div>

        <section className="hero-product" aria-label="OpenCook preview">
          {marketingHeroAsset ? (
            <MarketingAsset
              asset={marketingHeroAsset}
              className="hero-food-scene"
              decorative
            />
          ) : null}
          <div className="hero-product-header">
            <strong>One recipe, many versions</strong>
            <span>original stays safe</span>
          </div>
          <div className="hero-recipe-stack">
            {previewRecipes.map((recipe) => (
              <article className="hero-recipe-card" key={recipe.id}>
                <RecipeThumb recipe={recipe} />
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

      <section className="marketing-flow" id="remix">
        <article id="library">
          {firstFeatureAsset ? (
            <MarketingAsset
              asset={firstFeatureAsset}
              className="marketing-flow-asset"
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
              className="marketing-flow-asset"
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
              className="marketing-flow-asset"
              decorative
            />
          ) : null}
          <Sparkles size={20} />
          <h2>Theme the dish. Keep the same ingredients.</h2>
          <p>
            Keep the cooking exactly as it is and dress it up for the occasion: a
            themed image of the food and a card to hand round the table. For example, a
            Harry Potter feast or a Halloween spread.
          </p>
        </article>
      </section>

      <section className="marketing-detail-band" aria-labelledby="theme-board-title">
        <div>
          <h2 id="theme-board-title">One recipe. Three ways to make it yours.</h2>
          <p>
            <strong>Adapt</strong> changes the cooking itself. A new version with
            different ingredients, portions, or effort. <strong>Theme</strong> keeps
            the ingredients and changes only the look. A themed image and a card for
            the table. <strong>Story</strong> writes a tale to serve alongside it. Pick
            a theme to see where a recipe could go:
          </p>
        </div>
        <div className="theme-chip-grid">
          {themeExamples.map((theme) => (
            <span key={theme}>{theme}</span>
          ))}
        </div>
      </section>

      <section className="marketing-data-promise" id="ownership">
        <div className="data-promise-copy">
          <h2>Your recipe data belongs to you.</h2>
          <p>
            OpenCook is built around a no-lock-in promise: your originals stay yours,
            your account can leave with them, and the API contract is open enough to
            build your own tools on top.
          </p>
        </div>
        <div className="data-promise-grid">
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

      <section className="marketing-joke" aria-label="Kitchen joke">
        {jokePotatoAsset ? (
          <MarketingAsset
            asset={jokePotatoAsset}
            className="marketing-joke-asset"
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
    <div className="marketing-floating-food" aria-hidden="true">
      {marketingIngredientAssets.map((asset) => (
        <MarketingAsset
          asset={asset}
          className={`floating-food ${asset.className}`}
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
      className={["marketing-food-asset", className].filter(Boolean).join(" ")}
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
  { kind: "Theme", sticker: "🎃", accent: "--primary", blurb: "Same bake. A Halloween makeover." },
  { kind: "Theme", sticker: "🐉", accent: "--pop-green", blurb: "Ingredients unchanged, just the look." },
  { kind: "Adapt", sticker: "🌱", accent: "--secondary", blurb: "A new version. Original stays put." },
  { kind: "Story", sticker: "📖", accent: "--accent", blurb: "A tale to serve alongside." },
] as const;

export function HeroRemixDemo({ onSaveVariation }: { onSaveVariation: () => void }) {
  const [promptIndex, setPromptIndex] = useState(0);
  const advancePrompt = useCallback(() => {
    setPromptIndex((current) => (current + 1) % remixPromptExamples.length);
  }, []);

  const step = heroShowcaseSteps[promptIndex] ?? heroShowcaseSteps[0];
  const resultTitle = remixDemoResultTitles[promptIndex] ?? remixDemoResultTitles[0];

  return (
    <div className="hero-generate-box">
      <span>Live preview</span>
      <AnimatedRemixPrompt
        onCycleComplete={advancePrompt}
        paused={false}
        prompt={remixPromptAt(promptIndex)}
      />
      <div
        aria-live="polite"
        className="remix-result-demo transition-all duration-500 border-(--primary)!"
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
      <div className="hero-prompt-actions">
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
      className="prompt-input-demo"
      role="img"
    >
      <span className="prompt-input-avatar" aria-hidden="true">
        <UserRound size={14} />
      </span>
      <span className={typedPrompt ? "prompt-input-text" : "prompt-input-placeholder"}>
        {typedPrompt || "Describe the remix..."}
      </span>
    </div>
  );
}
