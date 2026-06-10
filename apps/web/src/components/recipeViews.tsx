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


export function BrowseRecipeView({
  message,
  onCopy,
  onDismiss,
  recipe,
  section,
}: {
  message: string;
  onCopy: (recipe: SharedRecipe) => Promise<void>;
  onDismiss: (recipe: SharedRecipe) => Promise<void>;
  recipe?: SharedRecipe;
  section: RecipeSection;
}) {
  if (!recipe) {
    return (
      <section className="detail-panel browse-panel">
        <div className="detail-toolbar">
          <div className="detail-status">
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        </div>
        <p className={emptyNoteClass}>
          {section === "shared"
            ? "When someone shares a recipe with you, it lands here ready to cook or copy."
            : "Public recipes from every OpenCook kitchen will show up here."}
        </p>
      </section>
    );
  }

  const sharedDate = recipe.sharedAt
    ? new Date(recipe.sharedAt).toLocaleDateString()
    : undefined;
  const hasSavedCopy = section === "shared" && Boolean(recipe.copiedRecipeId);

  return (
    <section className="detail-panel browse-panel">
      <div className="detail-toolbar">
        <div className="detail-status">
          {section === "shared" ? <Users size={16} /> : <Compass size={16} />}
          <span>
            {section === "shared"
              ? `${recipe.owner.name} shared this${sharedDate ? ` on ${sharedDate}` : ""}`
              : `Public recipe by ${recipe.owner.name}`}
          </span>
        </div>
        <div className="detail-actions">
          <Button
            disabled={hasSavedCopy}
            onClick={() => void onCopy(recipe)}
            size="sm"
            variant={hasSavedCopy ? "secondary" : "primary"}
          >
            {hasSavedCopy ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {hasSavedCopy ? "Saved" : "Save a copy"}
          </Button>
          {section === "shared" ? (
            <Button onClick={() => void onDismiss(recipe)} size="sm">
              <ArchiveX size={16} />
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>

      <ReadOnlyRecipeContent recipe={recipe} />

      <p className={footnoteClass}>
        {hasSavedCopy
          ? "Saved to your recipes. The original stays read-only here."
          : `Read-only. Saving a copy puts an editable version in your recipes; the original stays with ${recipe.owner.name}.`}
      </p>
    </section>
  );
}

export function ReadOnlyRecipeContent({ recipe }: { recipe: SharedRecipe }) {
  return (
    <>
      <RecipeHero draft={recipe} />

      <section className="editor-section">
        <div className="section-heading">
          <strong>Ingredients</strong>
        </div>
        <ul className={`list-disc ${readOnlyListClass}`}>
          {recipe.ingredients.map((ingredient, index) => (
            <li key={ingredient.id ?? `${index}-${ingredient.text}`}>
              {ingredientDisplayText(ingredient)}
            </li>
          ))}
        </ul>
      </section>

      <section className="editor-section">
        <div className="section-heading">
          <strong>Method</strong>
        </div>
        <ol className={`list-decimal ${readOnlyListClass}`}>
          {recipe.steps.map((step, index) => (
            <li key={step.id ?? `${index}-${step.text}`}>{step.text}</li>
          ))}
        </ol>
      </section>

      {recipe.notes.length ? (
        <section className="editor-section">
          <div className="section-heading">
            <strong>Notes</strong>
          </div>
          <ul className={`list-disc ${readOnlyListClass}`}>
            {recipe.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export function RecipeHero({ draft }: { draft: Recipe }) {
  const extraImages = recipeImagesOf(draft).slice(1, 5);

  return (
    <div className="recipe-hero">
      <div className="recipe-hero-media">
        <RecipeThumb recipe={draft} large />
        {extraImages.length ? (
          <div className="mt-2 flex gap-2">
            {extraImages.map((image) => (
              <img
                alt={image.alt ?? ""}
                className="h-12 w-12 rounded-lg border-2 border-(--color-ink) object-cover"
                decoding="async"
                key={image.url}
                loading="lazy"
                src={displayImageUrl(image.url)}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="recipe-hero-copy">
        <h2>{draft.title || "Untitled recipe"}</h2>
        <p>{draft.description || "Local OpenCook recipe"}</p>
        <div className="meta-row">
          <span>{draft.prepTimeMinutes ?? "-"} min prep</span>
          <span>{draft.cookTimeMinutes ?? "-"} min cook</span>
          <span>{draft.servings ?? "servings unset"}</span>
        </div>
      </div>
    </div>
  );
}

// Multi-image manager: paste a URL or drop/pick files (both compressed + stored
// server-side), reorder by drag, pick the cover, or remove. images[0] is cover.
export function RecipeImageGallery({
  images,
  onChange,
  recipeId,
  title,
}: {
  images: RecipeImage[];
  onChange: (images: RecipeImage[]) => void;
  recipeId?: string;
  title?: string;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dragOver, setDragOver] = useState(false);
  const dragIndexRef = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function appendImages(added: RecipeImage[]) {
    const seen = new Set(images.map((image) => image.url));
    const fresh = added.filter((image) => image.url && !seen.has(image.url));
    if (fresh.length) {
      onChange([...images, ...fresh]);
    }
  }

  async function addFromUrl() {
    const value = urlInput.trim();
    if (!value || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const asset = await api.importImageFromUrl(value, recipeId, title);
      appendImages([{ url: asset.url }]);
      setUrlInput("");
    } catch (caught) {
      // Fall back to storing the raw URL; the server mirrors it on save.
      try {
        new URL(value);
        appendImages([{ url: value }]);
        setUrlInput("");
      } catch {
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const assets = await Promise.all(
        list.map((file) => api.uploadImage(file, recipeId)),
      );
      appendImages(assets.map((asset) => ({ url: asset.url })));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, position) => position !== index));
  }

  function makeCover(index: number) {
    if (index === 0) {
      return;
    }
    const next = [...images];
    const [moved] = next.splice(index, 1);
    if (moved) {
      next.unshift(moved);
    }
    onChange(next);
  }

  function reorder(from: number, to: number) {
    if (from === to) {
      return;
    }
    const next = [...images];
    const [moved] = next.splice(from, 1);
    if (moved) {
      next.splice(to, 0, moved);
    }
    onChange(next);
  }

  return (
    <section className="editor-section">
      <div className="section-heading">
        <strong>Photos</strong>
        <span className="text-(--color-fog)">
          {images.length
            ? `${images.length} image${images.length > 1 ? "s" : ""}`
            : null}
        </span>
      </div>

      {images.length ? (
        <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
          {images.map((image, index) => (
            <div
              className={`group relative aspect-square overflow-hidden rounded-xl border-2 ${
                index === 0 ? "border-(--color-sage)" : "border-(--color-ink)"
              }`}
              draggable
              key={image.url}
              onDragEnd={() => {
                dragIndexRef.current = undefined;
                setDragOver(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => {
                dragIndexRef.current = index;
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragIndexRef.current;
                if (from !== undefined) {
                  reorder(from, index);
                }
                dragIndexRef.current = undefined;
              }}
            >
              <img
                alt={image.alt ?? ""}
                className="h-full w-full object-cover"
                decoding="async"
                loading="lazy"
                src={displayImageUrl(image.url)}
              />
              {index === 0 ? (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-(--color-sage) px-2 py-0.5 text-[11px] font-bold text-white">
                  <Star size={11} />
                  Cover
                </span>
              ) : null}
              <span className="absolute left-1.5 bottom-1.5 cursor-grab rounded-md bg-white/85 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical size={14} />
              </span>
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {index !== 0 ? (
                  <button
                    aria-label="Make cover photo"
                    className="rounded-md bg-white/90 p-1 hover:bg-white"
                    onClick={() => makeCover(index)}
                    type="button"
                  >
                    <Star size={14} />
                  </button>
                ) : null}
                <button
                  aria-label="Remove photo"
                  className="rounded-md bg-(--color-tomato) p-1 text-white hover:bg-(--color-tomato-dark)"
                  onClick={() => removeAt(index)}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        className={`mb-2 flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-(--color-sage) bg-(--color-sage-soft)"
            : "border-(--color-line) hover:border-(--color-ink)"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length) {
            void addFiles(event.dataTransfer.files);
          }
        }}
        type="button"
      >
        {busy ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <ImagePlus size={20} />
        )}
        <span className="text-sm font-semibold">
          {busy ? "Uploading…" : "Drop images here or click to upload"}
        </span>
        <span className="text-xs text-(--color-fog)">
          Compressed and stored automatically
        </span>
      </button>
      <input
        accept="image/*"
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.target.files?.length) {
            void addFiles(event.target.files);
          }
          event.target.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border-2 border-(--color-ink) px-3 py-2 text-sm"
          onChange={(event) => setUrlInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addFromUrl();
            }
          }}
          placeholder="…or paste an image URL"
          value={urlInput}
        />
        <Button
          disabled={busy || !urlInput.trim()}
          onClick={() => void addFromUrl()}
          size="sm"
          type="button"
        >
          <Plus size={16} />
          Add
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-sm font-semibold text-(--color-tomato)">{error}</p>
      ) : null}
    </section>
  );
}

export function RecipeThumb({ recipe, large = false }: { recipe: Recipe; large?: boolean }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const imageUrl = displayImageUrl(recipe.imageUrl);

  return imageUrl && failedImageUrl !== imageUrl ? (
    <img
      alt=""
      className={large ? "thumb large" : "thumb"}
      decoding="async"
      loading="lazy"
      onError={() => setFailedImageUrl(imageUrl)}
      src={imageUrl}
    />
  ) : (
    <span className={large ? "thumb large fallback" : "thumb fallback"}>
      <ChefHat size={large ? 30 : 18} />
    </span>
  );
}
