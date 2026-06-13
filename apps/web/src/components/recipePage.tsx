import {
  type Gathering,
  ingredientDisplayText,
  parseRecipeYield,
  type Recipe,
  type RecipeCookProgressInput,
  type RecipeVisibility,
  servingScaleFactor,
  type SharedRecipe,
  structureIngredients,
} from "@open-cook/core";
import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock3,
  Download,
  ExternalLink,
  Globe2,
  Link2,
  ListChecks,
  LockKeyhole,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Share2,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { displayImageUrl } from "../imageDisplayUrl";
import {
  emptyNoteClass,
  hasIngredientStructure,
  ingredientDisplayNote,
  recipeImagesOf,
  type RecipeSection,
  type SaveState,
  sharedRecipeKey,
  recipeTimeSummary,
} from "../lib/recipe";
import {
  Button,
  workspacePageInnerClassName,
  workspaceScrollPageClassName,
} from "../ui";
import { RecipeEditor, SharingSection } from "./editor";
import { RecipeSectionTabs, TopBar } from "./workspace";
import { BrowseRecipeView } from "./recipeViews";
import { VoiceSearchInput } from "./VoiceSearchInput";
import { VirtualGrid } from "./virtualized";

const cardClassName =
  "rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(180deg,#fffef9,#fff8ec)] shadow-[5px_5px_0_0_var(--color-ink)]";
const skeletonItems = [0, 1, 2, 3, 4, 5];
const skeletonBlockClassName = "block animate-pulse rounded-md bg-(--color-line)";
const recipeRailClassName =
  "flex items-center justify-between gap-3 rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fffdf8,#fff2c9_58%,#e7f0df)] p-2.5 shadow-[4px_4px_0_0_var(--color-ink)] max-[720px]:flex-col max-[720px]:items-start";
const recipeRailActionsClassName =
  "flex flex-wrap items-center justify-end gap-2 max-[720px]:w-full max-[720px]:justify-start";
const recipeRailButtonClassName =
  "rounded-xl! border-2! border-(--color-ink)! bg-(--color-panel)! px-3! py-2! text-[13px]! shadow-[2px_2px_0_0_var(--color-ink)]! hover:bg-[#fff4d7]! hover:shadow-[3px_3px_0_0_var(--color-ink)]!";
const recipeRailPrimaryButtonClassName =
  "rounded-xl! border-2! border-(--color-ink)! bg-(--color-tomato)! px-3! py-2! text-[13px]! text-white! shadow-[2px_2px_0_0_var(--color-ink)]! hover:bg-(--color-tomato-dark)! hover:shadow-[3px_3px_0_0_var(--color-ink)]!";
const recipeRailIconButtonClassName =
  "h-10! min-h-10! w-10! rounded-xl! border-2! border-(--color-ink)! bg-(--color-panel)! text-(--color-ink)! shadow-[2px_2px_0_0_var(--color-ink)]! hover:bg-[#fff4d7]! hover:shadow-[3px_3px_0_0_var(--color-ink)]!";
const recipeRailSavePillClassName =
  "inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-(--color-ink) bg-[#f9f1df] px-3 py-2 text-[12.5px] font-extrabold shadow-[2px_2px_0_0_var(--color-ink)]";

// A full-bleed cover that fills its (positioned) parent, falling back to a chef
// hat when there is no image or it fails to load.
function CardCover({ imageUrl }: { imageUrl?: string }) {
  const url = displayImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        decoding="async"
        loading="lazy"
        onError={() => setFailed(true)}
        src={url}
      />
    );
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center text-(--color-sage)">
      <ChefHat size={32} />
    </span>
  );
}

function hostnameOf(url?: string) {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

// The drop-down of secondary + destructive actions that replaces the lone
// red trash icon. Delete is two-step so it can sit a click away without risk.
export function RecipeActionsMenu({
  onStructure,
  onDelete,
  recipeId,
}: {
  onStructure: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  recipeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-bold text-(--color-ink) transition-colors hover:bg-(--color-rail)";

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-label="More actions"
        aria-expanded={open}
        className={recipeRailIconButtonClassName}
        onClick={() => setOpen((value) => !value)}
        size="icon"
        variant="secondary"
      >
        <MoreVertical size={16} />
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[6px_6px_0_0_var(--color-ink)]">
          <button
            className={itemClass}
            onClick={() => {
              setOpen(false);
              void onStructure();
            }}
            type="button"
          >
            <Wand2 className="shrink-0 text-(--color-fog)" size={16} />
            Re-structure recipe
          </button>
          {recipeId ? (
            <a
              className={itemClass}
              href={`/api/export/recipes/${recipeId}/markdown`}
              onClick={() => setOpen(false)}
            >
              <Download className="shrink-0 text-(--color-fog)" size={16} />
              Download Markdown
            </a>
          ) : null}
          {recipeId ? (
            <>
              <div className="mx-3 my-1 border-t-2 border-(--color-line)" />
              {confirmingDelete ? (
                <button
                  className="flex w-full items-center gap-3 bg-(--color-tomato) px-4 py-2.5 text-left text-[13px] font-bold text-white"
                  onClick={() => {
                    setOpen(false);
                    void onDelete();
                  }}
                  type="button"
                >
                  <Trash2 className="shrink-0" size={16} />
                  Click again to delete
                </button>
              ) : (
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-bold text-(--color-tomato-dark) transition-colors hover:bg-(--color-rail)"
                  onClick={() => setConfirmingDelete(true)}
                  type="button"
                >
                  <Trash2 className="shrink-0" size={16} />
                  Delete recipe
                </button>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Share controls (visibility, link, share-by-person) in a read-page dropdown,
// reusing the editor's SharingSection so the logic lives in one place.
function ShareMenu({
  draft,
  onVisibilityChange,
  ownerUserId,
  persistedVisibility,
}: {
  draft: Recipe;
  onVisibilityChange: (visibility: RecipeVisibility) => Promise<void>;
  ownerUserId?: string | null;
  persistedVisibility?: Recipe["visibility"];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={open}
        className={recipeRailButtonClassName}
        onClick={() => setOpen((value) => !value)}
        size="sm"
        variant="secondary"
      >
        <Share2 size={15} />
        Share
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[340px] max-w-[88vw] overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) p-4 shadow-[6px_6px_0_0_var(--color-ink)]">
          <SharingSection
            className="rounded-none! border-0! bg-transparent! p-0! [&_input]:min-w-0 [&>*]:min-w-0"
            draft={draft}
            onVisibilityChange={onVisibilityChange}
            ownerUserId={ownerUserId}
            persistedVisibility={persistedVisibility}
          />
        </div>
      ) : null}
    </div>
  );
}

function SaveIndicator({ saveState }: { saveState: SaveState }) {
  if (saveState === "saving") {
    return (
      <span className={`${recipeRailSavePillClassName} text-(--color-fog)`}>
        Saving…
      </span>
    );
  }
  if (saveState === "saved") {
    return (
      <span
        className={`${recipeRailSavePillClassName} bg-(--color-sage-soft) text-(--color-sage)`}
      >
        <Check size={13} />
        Saved
      </span>
    );
  }
  if (saveState === "error") {
    return (
      <span
        className={`${recipeRailSavePillClassName} bg-[#fff0ec] text-(--color-tomato-dark)`}
      >
        Save failed
      </span>
    );
  }
  return null;
}

function MetaChip({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-(--color-ink) bg-(--color-sage-soft) px-3 py-1 text-[12.5px] font-bold text-(--color-ink)">
      {icon}
      {children}
    </span>
  );
}

type CookProgressSaveState = "idle" | "loading" | "saving" | "saved" | "error";

function recipeItemKey(item: { id?: string; text: string }, index: number) {
  return item.id ?? `${index}-${item.text}`;
}

function toggledSet(current: Set<string>, key: string) {
  const next = new Set(current);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

function checkedIdsFor(keys: string[], checked: Set<string>) {
  return keys.filter((key) => checked.has(key));
}

// The read-first surface: hero, then the two things you actually cook from:
// ingredients (with a live servings scaler + check-off) and method.
export function RecipeReadView({ draft }: { draft: Recipe }) {
  const images = recipeImagesOf(draft);
  const cover = images[0];
  const galleryImages = images.slice(1);
  const coverUrl = displayImageUrl(cover?.url);
  const hasStructured = draft.ingredients.some(hasIngredientStructure);
  const ingredients = hasStructured
    ? structureIngredients(draft.ingredients)
    : draft.ingredients;

  const parsedYield = parseRecipeYield(draft.servings);
  const baseServings = parsedYield?.quantity;
  const [targetServings, setTargetServings] = useState(baseServings ?? 1);
  const scaleFactor = servingScaleFactor(draft.servings, targetServings);

  const recipeId = draft.id && !draft.id.startsWith("demo-") ? draft.id : "";
  const ingredientKeys = ingredients.map(recipeItemKey);
  const stepKeys = draft.steps.map(recipeItemKey);
  const [checkedIngredientIds, setCheckedIngredientIds] = useState<Set<string>>(
    new Set(),
  );
  const [checkedStepIds, setCheckedStepIds] = useState<Set<string>>(new Set());
  const [progressSaveState, setProgressSaveState] =
    useState<CookProgressSaveState>("idle");
  const progressRevisionRef = useRef(0);
  const progressWriteRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    setTargetServings(baseServings ?? 1);
  }, [baseServings]);

  useEffect(() => {
    const requestId = progressRevisionRef.current + 1;
    progressRevisionRef.current = requestId;
    setCheckedIngredientIds(new Set());
    setCheckedStepIds(new Set());

    if (!recipeId) {
      setProgressSaveState("idle");
      return;
    }

    setProgressSaveState("loading");
    api
      .getRecipeCookProgress(recipeId)
      .then((progress) => {
        if (progressRevisionRef.current !== requestId) {
          return;
        }
        setCheckedIngredientIds(new Set(progress.checkedIngredientIds));
        setCheckedStepIds(new Set(progress.checkedStepIds));
        setProgressSaveState("idle");
      })
      .catch(() => {
        if (progressRevisionRef.current === requestId) {
          setProgressSaveState("error");
        }
      });
  }, [recipeId]);

  useEffect(() => {
    if (progressSaveState !== "saved") {
      return;
    }
    const timeout = setTimeout(() => setProgressSaveState("idle"), 1400);
    return () => clearTimeout(timeout);
  }, [progressSaveState]);

  function progressInput(
    nextIngredientIds: Set<string>,
    nextStepIds: Set<string>,
  ): RecipeCookProgressInput {
    return {
      checkedIngredientIds: checkedIdsFor(ingredientKeys, nextIngredientIds),
      checkedStepIds: checkedIdsFor(stepKeys, nextStepIds),
    };
  }

  function enqueueProgressWrite(write: () => Promise<void>) {
    if (!recipeId) {
      setProgressSaveState("idle");
      return;
    }

    const requestId = progressRevisionRef.current + 1;
    progressRevisionRef.current = requestId;
    setProgressSaveState("saving");

    const nextWrite = progressWriteRef.current.catch(() => undefined).then(write);
    progressWriteRef.current = nextWrite;

    void nextWrite
      .then(() => {
        if (progressRevisionRef.current === requestId) {
          setProgressSaveState("saved");
        }
      })
      .catch(() => {
        if (progressRevisionRef.current === requestId) {
          setProgressSaveState("error");
        }
      });
  }

  function updateCookProgress(nextProgress: RecipeCookProgressInput) {
    enqueueProgressWrite(async () => {
      await api.updateRecipeCookProgress(recipeId, nextProgress);
    });
  }

  function toggleIngredient(key: string) {
    const nextIngredientIds = toggledSet(checkedIngredientIds, key);
    setCheckedIngredientIds(nextIngredientIds);
    updateCookProgress(progressInput(nextIngredientIds, checkedStepIds));
  }

  function toggleStep(key: string) {
    const nextStepIds = toggledSet(checkedStepIds, key);
    setCheckedStepIds(nextStepIds);
    updateCookProgress(progressInput(checkedIngredientIds, nextStepIds));
  }

  function resetCookSession() {
    setCheckedIngredientIds(new Set());
    setCheckedStepIds(new Set());
    enqueueProgressWrite(async () => {
      await api.resetRecipeCookProgress(recipeId);
    });
  }

  const sourceUrl = draft.source?.url;
  const sourceLabel = draft.source?.name ?? hostnameOf(sourceUrl);
  const isEmpty = ingredients.length === 0 && draft.steps.length === 0;
  const checkedIngredientCount = checkedIdsFor(
    ingredientKeys,
    checkedIngredientIds,
  ).length;
  const checkedStepCount = checkedIdsFor(stepKeys, checkedStepIds).length;
  const checkedCount = checkedIngredientCount + checkedStepCount;
  const cookItemCount = ingredientKeys.length + stepKeys.length;
  const progressStatus =
    progressSaveState === "loading"
      ? "Loading"
      : progressSaveState === "saving"
        ? "Saving"
        : progressSaveState === "saved"
          ? "Saved"
          : progressSaveState === "error"
            ? "Progress unavailable"
            : undefined;

  return (
    <div className="flex flex-col gap-5">
      <header
        className={`grid overflow-hidden md:grid-cols-[minmax(0,300px)_1fr] ${cardClassName}`}
      >
        <div className="relative min-h-[200px] border-b-2 border-(--color-ink) bg-(--color-soft) md:border-b-0 md:border-r-2">
          {coverUrl ? (
            <img
              alt={cover?.alt ?? ""}
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
              loading="lazy"
              src={coverUrl}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-(--color-sage)">
              <ChefHat size={40} />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-5 md:py-6 md:pr-7">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(26px,4vw,36px)] font-bold leading-[1.06] text-(--color-ink)">
            {draft.title || "Untitled recipe"}
          </h1>
          {draft.description ? (
            <p className="max-w-[60ch] leading-relaxed text-(--color-fog)">
              {draft.description}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2">
            {draft.prepTimeMinutes != null ? (
              <MetaChip icon={<Clock3 size={13} />}>
                {draft.prepTimeMinutes} min prep
              </MetaChip>
            ) : null}
            {draft.cookTimeMinutes != null ? (
              <MetaChip icon={<Clock3 size={13} />}>
                {draft.cookTimeMinutes} min cook
              </MetaChip>
            ) : null}
            {draft.prepTimeMinutes == null && draft.cookTimeMinutes == null ? (
              <MetaChip icon={<Clock3 size={13} />}>
                {recipeTimeSummary(draft)}
              </MetaChip>
            ) : null}
            <MetaChip icon={<Users size={13} />}>
              {draft.servings ?? "servings unset"}
            </MetaChip>
          </div>
          {sourceUrl || draft.tags.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              {sourceUrl ? (
                <a
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-(--color-fog) underline-offset-2 hover:text-(--color-ink) hover:underline"
                  href={sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Link2 size={13} />
                  {sourceLabel ?? "Source"}
                </a>
              ) : null}
              {draft.tags.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {draft.tags.map((tag) => (
                    <span
                      className="rounded-md bg-(--color-soft) px-2 py-0.5 text-[11.5px] font-bold text-(--color-fog)"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {galleryImages.length ? (
        <section className={`${cardClassName} p-4`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {galleryImages.map((image) => (
              <img
                alt={image.alt ?? ""}
                className="aspect-square w-full rounded-xl border-2 border-(--color-ink) object-cover"
                decoding="async"
                key={image.url}
                loading="lazy"
                src={displayImageUrl(image.url)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isEmpty ? (
        <section className={`${cardClassName} p-6`}>
          <p className={emptyNoteClass}>
            This recipe is empty. Switch to Edit to add ingredients and method.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          <div className={`${cardClassName} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[13px] font-extrabold text-(--color-ink)">
                <ListChecks size={16} />
                {checkedCount}/{cookItemCount} checked
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {progressStatus ? (
                  <span
                    className={`text-[12.5px] font-bold ${
                      progressSaveState === "error"
                        ? "text-(--color-tomato)"
                        : "text-(--color-fog)"
                    }`}
                  >
                    {progressStatus}
                  </span>
                ) : null}
                <Button
                  disabled={checkedCount === 0}
                  onClick={resetCookSession}
                  size="sm"
                  variant="secondary"
                >
                  <RefreshCcw size={15} />
                  Reset session
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)]">
            <section className={`${cardClassName} p-5`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-(--color-ink)">
                  Ingredients
                </h2>
                {baseServings ? (
                  <div className="flex items-center gap-1 rounded-full border-2 border-(--color-ink) bg-(--color-panel) p-0.5">
                    <button
                      aria-label="Decrease servings"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-(--color-ink) hover:bg-(--color-rail)"
                      onClick={() =>
                        setTargetServings((value) => Math.max(1, value - 1))
                      }
                      type="button"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[5ch] text-center text-[13px] font-bold text-(--color-ink)">
                      {Math.round(targetServings * 100) / 100}{" "}
                      {parsedYield?.unit ?? "serv"}
                    </span>
                    <button
                      aria-label="Increase servings"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-(--color-ink) hover:bg-(--color-rail)"
                      onClick={() => setTargetServings((value) => value + 1)}
                      type="button"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
              <ul className="flex flex-col">
                {ingredients.map((ingredient, index) => {
                  const key = recipeItemKey(ingredient, index);
                  const isChecked = checkedIngredientIds.has(key);
                  const note = ingredientDisplayNote(ingredient);
                  return (
                    <li key={key}>
                      <button
                        aria-pressed={isChecked}
                        className="group flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-(--color-rail)"
                        onClick={() => toggleIngredient(key)}
                        type="button"
                      >
                        <span
                          className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border-2 ${
                            isChecked
                              ? "border-(--color-sage) bg-(--color-sage) text-white"
                              : "border-(--color-line) bg-(--color-panel) text-transparent group-hover:border-(--color-ink)"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <span
                            className={`text-[14.5px] leading-snug ${
                              isChecked
                                ? "text-(--color-fog) line-through"
                                : "text-(--color-ink)"
                            }`}
                          >
                            {ingredientDisplayText(ingredient, scaleFactor, {
                              includeNote: false,
                            })}
                          </span>
                          {note ? (
                            <span className="text-[12.5px] leading-snug text-(--color-fog)">
                              {note}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {ingredients.length === 0 ? (
                  <li className="px-2 py-1.5 text-[14px] text-(--color-fog)">
                    No ingredients yet.
                  </li>
                ) : null}
              </ul>
            </section>

            <section className={`${cardClassName} p-5`}>
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold text-(--color-ink)">
                Method
              </h2>
              <ol className="flex flex-col gap-2">
                {draft.steps.map((step, index) => {
                  const key = recipeItemKey(step, index);
                  const isChecked = checkedStepIds.has(key);
                  return (
                    <li key={key}>
                      <button
                        aria-pressed={isChecked}
                        className="group flex w-full gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-(--color-rail)"
                        onClick={() => toggleStep(key)}
                        type="button"
                      >
                        <span
                          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 font-[family-name:var(--font-display)] text-sm font-bold ${
                            isChecked
                              ? "border-(--color-sage) bg-(--color-sage) text-white"
                              : "border-(--color-ink) bg-(--color-panel) text-(--color-ink)"
                          }`}
                        >
                          {isChecked ? <Check size={15} strokeWidth={3} /> : index + 1}
                        </span>
                        <span
                          className={`pt-1 text-[15px] leading-relaxed ${
                            isChecked
                              ? "text-(--color-fog) line-through"
                              : "text-(--color-ink)"
                          }`}
                        >
                          {step.text}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {draft.steps.length === 0 ? (
                  <li className="text-[14px] text-(--color-fog)">No method yet.</li>
                ) : null}
              </ol>
            </section>
          </div>
        </div>
      )}

      {draft.notes.length ? (
        <section className={`${cardClassName} p-5`}>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold text-(--color-ink)">
            Notes
          </h2>
          <ul className="m-0 grid gap-[7px] pl-5 text-[14.5px] text-(--color-ink) list-disc">
            {draft.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FullWidthPage({ children }: { children: React.ReactNode }) {
  return (
    <section
      className={`${workspaceScrollPageClassName} bg-[radial-gradient(circle_at_16%_9%,rgba(255,196,86,0.18),transparent_18rem),radial-gradient(circle_at_88%_16%,rgba(47,104,75,0.12),transparent_20rem),linear-gradient(180deg,#fff8e7_0%,#f6f0e4_44%,#edf4e7_100%)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(color-mix(in_oklch,var(--color-line)_64%,transparent)_1px,transparent_1px)] before:[background-size:18px_18px] before:opacity-45`}
    >
      <div className={workspacePageInnerClassName}>{children}</div>
    </section>
  );
}

function gatheringMenuTitle(gathering: Gathering) {
  return gathering.title.trim() || "Untitled gathering";
}

function RecipeGatheringMenu({
  gatherings,
  gatheringsLoading,
  onCreateGathering,
  onOpenGathering,
  onToggleGathering,
  recipe,
}: {
  gatherings: Gathering[];
  gatheringsLoading: boolean;
  onCreateGathering: (recipe: Recipe) => void | Promise<void>;
  onOpenGathering: (gatheringId: string) => void;
  onToggleGathering: (
    gatheringId: string,
    recipe: Recipe,
    selected: boolean,
  ) => void | Promise<void>;
  recipe: Recipe;
}) {
  const [open, setOpen] = useState(false);
  const [gatheringQuery, setGatheringQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recipeId = recipe.id && !recipe.id.startsWith("demo-") ? recipe.id : "";
  const containingGatherings = gatherings.filter((gathering) =>
    recipeId ? gathering.recipeIds.includes(recipeId) : false,
  );
  const normalizedGatheringQuery = gatheringQuery.trim().toLowerCase();
  const visibleGatherings = normalizedGatheringQuery
    ? gatherings.filter((gathering) =>
        `${gatheringMenuTitle(gathering)} ${gathering.status}`
          .toLowerCase()
          .includes(normalizedGatheringQuery),
      )
    : gatherings;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setGatheringQuery("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || gatheringsLoading || !gatherings.length) {
      return;
    }
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [gatherings.length, gatheringsLoading, open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={open}
        className={
          containingGatherings.length
            ? recipeRailButtonClassName
            : recipeRailPrimaryButtonClassName
        }
        disabled={!recipeId}
        onClick={() => {
          if (open) {
            setOpen(false);
            setGatheringQuery("");
            return;
          }
          setOpen(true);
        }}
        size="sm"
        variant={containingGatherings.length ? "secondary" : "primary"}
      >
        <Users size={15} />
        Gatherings
        {containingGatherings.length ? ` (${containingGatherings.length})` : ""}
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 grid w-[min(340px,calc(100vw-2rem))] gap-2 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) p-3 shadow-[6px_6px_0_0_var(--color-ink)] max-[720px]:right-auto max-[720px]:left-0">
          <div className="flex items-center justify-between gap-2 border-b-2 border-(--color-line) pb-2">
            <strong className="text-sm text-(--color-ink)">Add to gathering</strong>
            <Button
              onClick={() => {
                setOpen(false);
                setGatheringQuery("");
                void onCreateGathering(recipe);
              }}
              size="sm"
              variant="primary"
            >
              <Plus size={14} />
              New
            </Button>
          </div>

          {gatheringsLoading ? (
            <p className="m-0 rounded-lg bg-(--color-rail) p-3 text-[13px] font-bold text-(--color-fog)">
              Loading gatherings
            </p>
          ) : gatherings.length ? (
            <>
              <VoiceSearchInput
                aria-label="Search gatherings"
                containerClassName="relative"
                inputClassName="min-h-10 w-full rounded-xl border border-(--color-line) bg-(--color-paper) pr-11 pl-9 text-[13px] font-bold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                micButtonClassName="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg border border-(--color-line) bg-(--color-panel) text-(--color-ink) transition hover:border-(--color-ink)"
                activeMicButtonClassName="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg border border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)"
                micIconSize={14}
                onValueChange={setGatheringQuery}
                placeholder="Search gatherings"
                ref={searchInputRef}
                searchIconClassName="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--color-fog)"
                searchIconSize={15}
                statusClassName="m-0 text-[11.5px] font-black leading-snug text-(--color-tomato-dark)"
                value={gatheringQuery}
              />
              {visibleGatherings.length ? (
                <div className="grid max-h-[320px] gap-2 overflow-auto pr-1">
                  {visibleGatherings.map((gathering) => {
                    const selected = gathering.recipeIds.includes(recipeId);
                    return (
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 rounded-xl border border-(--color-line) bg-(--color-paper) p-2"
                        key={gathering.id}
                      >
                        <button
                          className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-2 text-left"
                          onClick={() =>
                            void onToggleGathering(gathering.id, recipe, !selected)
                          }
                          type="button"
                        >
                          <span
                            className={
                              selected
                                ? "grid size-6 place-items-center rounded-md bg-(--color-sage) text-white"
                                : "grid size-6 place-items-center rounded-md border border-(--color-line) text-transparent"
                            }
                          >
                            <Check size={14} strokeWidth={3} />
                          </span>
                          <span className="grid min-w-0 gap-1">
                            <span className="truncate text-[13px] font-extrabold text-(--color-ink)">
                              {gatheringMenuTitle(gathering)}
                            </span>
                            <span className="text-[11px] font-bold capitalize text-(--color-fog)">
                              {gathering.status}
                            </span>
                          </span>
                        </button>
                        <button
                          aria-label={`Open ${gatheringMenuTitle(gathering)}`}
                          className="grid size-9 place-items-center rounded-lg border border-(--color-line) bg-(--color-panel) text-(--color-ink) hover:border-(--color-ink)"
                          onClick={() => {
                            setOpen(false);
                            setGatheringQuery("");
                            onOpenGathering(gathering.id);
                          }}
                          type="button"
                        >
                          <ExternalLink size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="m-0 rounded-lg border border-dashed border-(--color-line) bg-(--color-rail) p-3 text-[13px] font-bold leading-5 text-(--color-fog)">
                  No gatherings match "{gatheringQuery.trim()}".
                </p>
              )}
            </>
          ) : (
            <p className="m-0 rounded-lg border border-dashed border-(--color-line) bg-(--color-rail) p-3 text-[13px] font-bold leading-5 text-(--color-fog)">
              No gathering drafts yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// The full-width recipe surface: a back rail + an Edit/Done toggle + the
// overflow menu, wrapping either the read view or the editor.
export function RecipePage({
  draft,
  gatherings,
  gatheringsLoading,
  mode,
  onBack,
  onChange,
  onCreateGatheringForRecipe,
  onDelete,
  onOpenGathering,
  onSetMode,
  onStructure,
  onToggleGatheringRecipe,
  onVisibilityChange,
  ownerUserId,
  persistedVisibility,
  saveState,
}: {
  draft: Recipe;
  gatherings: Gathering[];
  gatheringsLoading: boolean;
  mode: "view" | "edit";
  onBack: () => void;
  onChange: (recipe: Recipe) => void;
  onCreateGatheringForRecipe: (recipe: Recipe) => void | Promise<void>;
  onDelete: () => Promise<void>;
  onOpenGathering: (gatheringId: string) => void;
  onSetMode: (mode: "view" | "edit") => void;
  onStructure: () => Promise<void>;
  onToggleGatheringRecipe: (
    gatheringId: string,
    recipe: Recipe,
    selected: boolean,
  ) => void | Promise<void>;
  onVisibilityChange: (visibility: RecipeVisibility) => Promise<void>;
  ownerUserId?: string | null;
  persistedVisibility?: Recipe["visibility"];
  saveState: SaveState;
}) {
  const recipeId = draft.id && !draft.id.startsWith("demo-") ? draft.id : "";

  return (
    <FullWidthPage>
      <div className={recipeRailClassName}>
        <Button
          className={recipeRailButtonClassName}
          onClick={onBack}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft size={16} />
          Recipes
        </Button>
        <div className={recipeRailActionsClassName}>
          <SaveIndicator saveState={saveState} />
          {recipeId && mode === "view" ? (
            <RecipeGatheringMenu
              gatherings={gatherings}
              gatheringsLoading={gatheringsLoading}
              onCreateGathering={onCreateGatheringForRecipe}
              onOpenGathering={onOpenGathering}
              onToggleGathering={onToggleGatheringRecipe}
              recipe={draft}
            />
          ) : null}
          {mode === "view" ? (
            <Button
              className={recipeRailButtonClassName}
              onClick={() => onSetMode("edit")}
              size="sm"
              variant="secondary"
            >
              <Pencil size={15} />
              Edit
            </Button>
          ) : (
            <Button
              className={recipeRailPrimaryButtonClassName}
              onClick={() => onSetMode("view")}
              size="sm"
              variant="primary"
            >
              <Check size={15} />
              Done
            </Button>
          )}
          {recipeId ? (
            <ShareMenu
              draft={draft}
              onVisibilityChange={onVisibilityChange}
              ownerUserId={ownerUserId}
              persistedVisibility={persistedVisibility}
            />
          ) : null}
          <RecipeActionsMenu
            onDelete={onDelete}
            onStructure={onStructure}
            recipeId={recipeId}
          />
        </div>
      </div>

      {mode === "view" ? (
        <RecipeReadView draft={draft} />
      ) : (
        <RecipeEditor draft={draft} onChange={onChange} onStructure={onStructure} />
      )}
    </FullWidthPage>
  );
}

// Read-only full-width surface for a recipe shared with you or found in Explore.
export function BrowseRecipePage({
  message,
  onBack,
  onCopy,
  onDismiss,
  recipe,
  section,
}: {
  message: string;
  onBack: () => void;
  onCopy: (recipe: SharedRecipe) => Promise<void>;
  onDismiss: (recipe: SharedRecipe) => Promise<void>;
  recipe: SharedRecipe;
  section: RecipeSection;
}) {
  return (
    <FullWidthPage>
      <div className={recipeRailClassName}>
        <Button
          className={recipeRailButtonClassName}
          onClick={onBack}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft size={16} />
          {section === "shared" ? "Shared with you" : "Explore"}
        </Button>
      </div>
      <BrowseRecipeView
        message={message}
        onCopy={onCopy}
        onDismiss={onDismiss}
        recipe={recipe}
        section={section}
      />
    </FullWidthPage>
  );
}

// Shown when a ?recipe=<id> link points at a recipe that doesn't exist or that
// the signed-in user can't see.
export function RecipeNotFound({ onBack }: { onBack: () => void }) {
  return (
    <FullWidthPage>
      <div className={recipeRailClassName}>
        <Button
          className={recipeRailButtonClassName}
          onClick={onBack}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft size={16} />
          Recipes
        </Button>
      </div>
      <div
        className={`${cardClassName} flex flex-col items-center gap-3 px-6 py-14 text-center`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-ink) bg-(--color-soft) text-(--color-fog)">
          <ChefHat size={24} />
        </span>
        <strong className="text-lg text-(--color-ink)">No recipe found</strong>
        <p className="max-w-md text-[14px] leading-snug text-(--color-fog)">
          This recipe doesn't exist or isn't accessible to you. It may have been
          deleted, or it belongs to someone who hasn't shared it with you.
        </p>
        <Button onClick={onBack} size="sm" variant="secondary">
          Back to recipes
        </Button>
      </div>
    </FullWidthPage>
  );
}

function VisibilityBadge({ visibility }: { visibility?: RecipeVisibility }) {
  if (!visibility || visibility === "private") {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-panel) px-2 py-0.5 text-[10.5px] font-bold text-(--color-fog)">
      {visibility === "public" ? <Globe2 size={11} /> : <LockKeyhole size={11} />}
      {visibility}
    </span>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`${skeletonBlockClassName} ${className}`} />;
}

function RecipeCardSkeleton({ section }: { section: RecipeSection }) {
  return (
    <article
      aria-hidden="true"
      className={`${cardClassName} flex min-h-[260px] flex-col gap-0 overflow-hidden p-0`}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b-2 border-(--color-ink) bg-(--color-soft)">
        <SkeletonBlock className="absolute inset-4 rounded-xl bg-(--color-panel)" />
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <SkeletonBlock className="h-2.5 w-8 rounded-full" />
          <SkeletonBlock className="h-2.5 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <SkeletonBlock className="h-4 w-3/5" />
          {section === "mine" ? (
            <SkeletonBlock className="h-5 w-14 rounded-full" />
          ) : null}
        </div>
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-4/5" />
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <SkeletonBlock className="h-5 w-20 rounded-full" />
          <SkeletonBlock className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </article>
  );
}

function RecipeLibrarySkeleton({ section }: { section: RecipeSection }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4"
    >
      {skeletonItems.map((item) => (
        <RecipeCardSkeleton key={item} section={section} />
      ))}
    </div>
  );
}

function OwnedRecipeCard({
  onOpen,
  recipe,
}: {
  onOpen: (id: string) => void;
  recipe: Recipe;
}) {
  return (
    <button
      className={`${cardClassName} relative flex h-full w-full flex-col items-stretch gap-0 overflow-hidden p-0 text-left transition-transform before:absolute before:top-3 before:left-3 before:z-10 before:size-3 before:rounded-full before:border-2 before:border-(--color-ink) before:bg-(--color-tomato) before:shadow-[1px_1px_0_0_var(--color-ink)] before:content-[''] hover:-translate-x-px hover:-translate-y-px hover:rotate-[-0.35deg] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-tomato)]`}
      onClick={() => onOpen(recipe.id)}
      type="button"
    >
      <div className="relative aspect-[16/10] w-full border-b-2 border-(--color-ink) bg-(--color-soft)">
        <CardCover imageUrl={recipe.imageUrl} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <strong className="text-[15px] leading-tight text-(--color-ink)">
            {recipe.title}
          </strong>
          <VisibilityBadge visibility={recipe.visibility} />
        </div>
        <span className="line-clamp-2 text-[13px] leading-snug text-(--color-fog)">
          {recipe.description || "Local OpenCook recipe"}
        </span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1.5 text-[11.5px] font-bold text-(--color-fog)">
          <span className="rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5">
            {recipe.source?.name ?? "local"}
          </span>
          <span>{recipeTimeSummary(recipe)}</span>
        </span>
      </div>
    </button>
  );
}

function BrowseRecipeCard({
  onOpen,
  recipe,
  section,
}: {
  onOpen: (key: string) => void;
  recipe: SharedRecipe;
  section: RecipeSection;
}) {
  const recipeKey = sharedRecipeKey(recipe);

  return (
    <button
      className={`${cardClassName} relative flex h-full w-full flex-col items-stretch gap-0 overflow-hidden p-0 text-left transition-transform before:absolute before:top-3 before:left-3 before:z-10 before:size-3 before:rounded-full before:border-2 before:border-(--color-ink) before:bg-(--color-sage-soft) before:shadow-[1px_1px_0_0_var(--color-ink)] before:content-[''] hover:-translate-x-px hover:-translate-y-px hover:rotate-[0.35deg] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sage)]`}
      onClick={() => onOpen(recipeKey)}
      type="button"
    >
      <div className="relative aspect-[16/10] w-full border-b-2 border-(--color-ink) bg-(--color-soft)">
        <CardCover imageUrl={recipe.imageUrl} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[15px] leading-tight text-(--color-ink)">
            {recipe.title}
          </strong>
          {section === "shared" && !recipe.seenAt ? (
            <span className="rounded-full border-2 border-(--color-sage) bg-(--color-sage-soft) px-2 py-0.5 text-[10.5px] font-bold text-(--color-sage)">
              New
            </span>
          ) : null}
          {section === "shared" && recipe.copiedRecipeId ? (
            <span className="rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5 text-[10.5px] font-bold text-(--color-fog)">
              Saved
            </span>
          ) : null}
        </div>
        <span className="line-clamp-2 text-[13px] leading-snug text-(--color-fog)">
          {recipe.description || "Shared OpenCook recipe"}
        </span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1.5 text-[11.5px] font-bold text-(--color-fog)">
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5">
            <Users size={11} />
            {recipe.owner.name}
          </span>
          <span>{recipeTimeSummary(recipe)}</span>
        </span>
      </div>
    </button>
  );
}

// The library shelf: a full-width gallery of recipe cards. No recipe is open
// until a card is clicked.
export function RecipeLibrary({
  browseRecipes,
  hasFoodPreferences,
  loading,
  onCreateBlank,
  onImport,
  onOpenBrowse,
  onOpenOwned,
  onOpenPreferences,
  onQuery,
  onSection,
  ownedRecipes,
  query,
  section,
  sessionUserId,
  sharedCount,
}: {
  browseRecipes: SharedRecipe[];
  hasFoodPreferences: boolean | null;
  loading: boolean;
  onCreateBlank: () => void | Promise<void>;
  onImport: () => void;
  onOpenBrowse: (key: string) => void;
  onOpenOwned: (id: string) => void;
  onOpenPreferences: () => void;
  onQuery: (value: string) => void;
  onSection: (section: RecipeSection) => void;
  ownedRecipes: Recipe[];
  query: string;
  section: RecipeSection;
  sessionUserId: string | null;
  sharedCount: number;
}) {
  const loggedIn = Boolean(sessionUserId);
  return (
    <FullWidthPage>
      <TopBar
        hasFoodPreferences={hasFoodPreferences}
        loggedIn={loggedIn}
        onCreateBlank={onCreateBlank}
        onImport={onImport}
        onOpenPreferences={onOpenPreferences}
      />
      {loggedIn ? (
        <RecipeSectionTabs
          onSelect={onSection}
          section={section}
          sharedCount={sharedCount}
        />
      ) : null}
      <VoiceSearchInput
        aria-label="Search recipes"
        containerClassName="m-0 grid min-h-12 grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2.5 rounded-2xl border-2 border-solid border-(--color-ink) bg-[linear-gradient(135deg,#fffdf8,#fff4d7)] p-2 shadow-[3px_3px_0_0_var(--color-ink)] transition focus-within:-translate-y-0.5 focus-within:shadow-[5px_5px_0_0_var(--color-ink)] [&>input]:min-w-0 [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-sm [&>input]:font-semibold [&>input]:text-(--color-ink) [&>input]:outline-0 [&>input::placeholder]:text-[#8a8378]"
        micButtonClassName="grid size-8 place-items-center rounded-xl border-2 border-(--color-ink) bg-(--color-panel) text-(--color-ink) transition hover:bg-(--color-sage-soft)"
        activeMicButtonClassName="grid size-8 place-items-center rounded-xl border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)"
        onValueChange={onQuery}
        placeholder={
          section === "mine"
            ? "Search title, ingredients, tags, source"
            : section === "shared"
              ? "Search recipes shared with you"
              : "Search public recipes"
        }
        searchIconWrapperClassName="flex size-8 items-center justify-center rounded-xl border-2 border-(--color-ink) bg-(--color-sage-soft) text-(--color-sage)"
        statusClassName="m-0 text-[11.5px] font-black leading-snug text-(--color-tomato-dark)"
        value={query}
      />

      {loading ? (
        <>
          <p className="sr-only" role="status">
            Loading recipes
          </p>
          <RecipeLibrarySkeleton section={section} />
        </>
      ) : section === "mine" ? (
        <>
          <VirtualGrid
            estimatedRowHeight={300}
            getKey={(recipe) => recipe.id}
            items={ownedRecipes}
            minColumnWidth={248}
            renderItem={(recipe) => (
              <OwnedRecipeCard onOpen={onOpenOwned} recipe={recipe} />
            )}
          />
        </>
      ) : (
        <>
          <VirtualGrid
            estimatedRowHeight={300}
            getKey={sharedRecipeKey}
            items={browseRecipes}
            minColumnWidth={248}
            renderItem={(recipe) => (
              <BrowseRecipeCard
                onOpen={onOpenBrowse}
                recipe={recipe}
                section={section}
              />
            )}
          />
          {browseRecipes.length === 0 ? (
            <p className={emptyNoteClass}>
              {section === "shared" && !sessionUserId
                ? "Log in to see recipes from other people."
                : section === "shared"
                  ? "No one has shared a recipe with you yet."
                  : "No public recipes yet. Make one of yours public to start the shelf."}
            </p>
          ) : null}
        </>
      )}

      {!loading && section === "mine" && ownedRecipes.length === 0 ? (
        <p className={emptyNoteClass}>
          No recipes yet. Use “New recipe” to start one or import from a link.
        </p>
      ) : null}
    </FullWidthPage>
  );
}
