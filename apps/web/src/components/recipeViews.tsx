import {
  ingredientDisplayText,
  type Recipe,
  type RecipeImage,
  type SharedRecipe,
} from "@open-cook/core";
import {
  ArchiveX,
  CheckCircle2,
  ChefHat,
  Compass,
  Copy,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Users,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../api";
import { displayImageUrl } from "../imageDisplayUrl";
import { Button } from "../ui";
import {
  emptyNoteClass,
  errorMessage,
  footnoteClass,
  readOnlyListClass,
  recipeImagesOf,
  type RecipeSection,
} from "../lib/recipe";

export const detailPanelClassName =
  "col-[2] row-[2] flex min-h-0 min-w-0 flex-col gap-3.5 overflow-auto bg-[rgba(255,250,243,0.96)] px-[22px] pt-5 pb-7 max-[980px]:col-[1] max-[980px]:row-auto max-[860px]:max-w-full max-[720px]:px-4";

export const detailToolbarClassName =
  "flex flex-none items-center justify-between gap-3.5 rounded-lg border border-solid border-(--color-line) bg-[rgba(255,253,248,0.82)] p-2.5 shadow-[0_4px_14px_rgba(54,42,27,0.04)] max-[720px]:flex-col max-[720px]:items-stretch";

export const detailStatusClassName =
  "flex min-w-0 items-center gap-2 text-[13px] font-[780] text-(--color-sage) [&>span]:truncate";

export const detailActionsClassName =
  "flex flex-none items-center gap-2 max-[720px]:w-full max-[720px]:[&>*]:flex-1";

export const editorSectionClassName =
  "grid flex-none gap-3 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-3.5";

export const sectionHeadingClassName =
  "flex items-center justify-between gap-3 max-[720px]:flex-col max-[720px]:items-stretch [&>strong]:text-sm [&>strong]:font-[820] [&>strong]:text-(--color-ink)";

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
      <section className={detailPanelClassName}>
        <div className={detailToolbarClassName}>
          <div className={detailStatusClassName}>
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
    <section className={detailPanelClassName}>
      <div className={detailToolbarClassName}>
        <div className={detailStatusClassName}>
          {section === "shared" ? <Users size={16} /> : <Compass size={16} />}
          <span>
            {section === "shared"
              ? `${recipe.owner.name} shared this${sharedDate ? ` on ${sharedDate}` : ""}`
              : `Public recipe by ${recipe.owner.name}`}
          </span>
        </div>
        <div className={detailActionsClassName}>
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

      <section className={editorSectionClassName}>
        <div className={sectionHeadingClassName}>
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

      <section className={editorSectionClassName}>
        <div className={sectionHeadingClassName}>
          <strong>Method</strong>
        </div>
        <ol className={`list-decimal ${readOnlyListClass}`}>
          {recipe.steps.map((step, index) => (
            <li key={step.id ?? `${index}-${step.text}`}>{step.text}</li>
          ))}
        </ol>
      </section>

      {recipe.notes.length ? (
        <section className={editorSectionClassName}>
          <div className={sectionHeadingClassName}>
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
    <div className="grid flex-none grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)] items-stretch gap-[18px] overflow-hidden rounded-lg border border-solid border-[#e6d3bd] p-3 [background:linear-gradient(135deg,rgba(254,231,207,0.62),rgba(255,253,248,0.98)),var(--color-panel)] max-[720px]:grid-cols-1">
      <div className="min-h-[188px] overflow-hidden rounded-lg">
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
      <div className="grid min-w-0 content-center gap-2.5 py-2 pr-2.5 pl-0 max-[720px]:px-0.5 max-[720px]:pt-0.5 max-[720px]:pb-1">
        <h2 className="m-0 font-display text-[clamp(34px,3vw,52px)] font-[720] leading-[0.98] tracking-normal text-(--color-ink)">
          {draft.title || "Untitled recipe"}
        </h2>
        <p className="m-0 max-w-[680px] text-[15px] leading-[1.42] text-(--color-fog)">
          {draft.description || "Local OpenCook recipe"}
        </p>
        <div className="flex flex-wrap gap-2 [&>span]:rounded-full [&>span]:border [&>span]:border-solid [&>span]:border-[#dfcfbc] [&>span]:bg-[rgba(255,253,248,0.86)] [&>span]:px-2.5 [&>span]:py-1.5 [&>span]:text-xs [&>span]:font-[760] [&>span]:text-[#4d554f]">
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
    <section className={editorSectionClassName}>
      <div className={sectionHeadingClassName}>
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

export function RecipeThumb({
  className = "",
  large = false,
  recipe,
}: {
  className?: string;
  large?: boolean;
  recipe: Recipe;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const imageUrl = displayImageUrl(recipe.imageUrl);
  const thumbClassName = [
    "inline-flex aspect-square items-center justify-center bg-[#ece3d6] object-cover text-(--color-sage)",
    large ? "flex h-full min-h-[188px] w-full rounded-lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return imageUrl && failedImageUrl !== imageUrl ? (
    <img
      alt=""
      className={thumbClassName}
      decoding="async"
      loading="lazy"
      onError={() => setFailedImageUrl(imageUrl)}
      src={imageUrl}
    />
  ) : (
    <span
      className={`${thumbClassName} [background:linear-gradient(135deg,rgba(49,93,67,0.16),rgba(200,79,63,0.12)),#efe6d9]`}
    >
      <ChefHat size={large ? 30 : 18} />
    </span>
  );
}
