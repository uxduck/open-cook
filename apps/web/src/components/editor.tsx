import {
  ingredientDisplayText,
  parseRecipeYield,
  type Recipe,
  type RecipeIngredient,
  type RecipeShare,
  type RecipeStep,
  type RecipeVisibility,
  servingScaleFactor,
  structureIngredients,
  structureSteps,
} from "@open-cook/core";
import {
  Clipboard,
  Clock3,
  Globe2,
  Link2,
  LockKeyhole,
  Minus,
  Plus,
  Share2,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, fieldClassName, inlineStatusClassName } from "../ui";
import {
  errorMessage,
  hasIngredientStructure,
  ingredientWithText,
  optionalNumber,
  optionalQuantity,
  recipeImagesOf,
  visibilityPillClass,
} from "../lib/recipe";
import {
  detailPanelClassName,
  editorSectionClassName,
  RecipeImageGallery,
  sectionHeadingClassName,
} from "./recipeViews";

const structurePanelClassName =
  "grid min-w-0 gap-3 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-3.5";

const structureHeadingClassName = "flex items-center justify-between gap-3";

const structureHeadingLabelClassName =
  "grid gap-0.5 [&>span]:text-xs [&>span]:font-[740] [&>span]:text-(--color-fog) [&>strong]:font-display [&>strong]:text-xl [&>strong]:font-[720] [&>strong]:leading-none [&>strong]:text-(--color-ink)";

const ingCellClassName =
  "w-full min-w-0 rounded-[7px] border border-solid border-transparent bg-[#fffaf2] px-2 py-[7px] text-[13px] font-[560] leading-[1.35] text-(--color-ink) outline-0 focus:border-[#c9ad8c] focus:bg-(--color-panel)";

export function RecipeEditor({
  draft,
  onChange,
  onStructure,
  onVisibilityChange,
  ownerUserId,
  persistedVisibility,
}: {
  draft: Recipe;
  onChange: (recipe: Recipe) => void;
  onStructure: () => Promise<void>;
  onVisibilityChange: (visibility: RecipeVisibility) => Promise<void>;
  ownerUserId?: string | null;
  persistedVisibility?: Recipe["visibility"];
}) {
  const parsedYield = parseRecipeYield(draft.servings);
  const baseServings = parsedYield?.quantity;
  const recipeId = draft.id && !draft.id.startsWith("demo-") ? draft.id : "";
  const hasStructuredIngredients = draft.ingredients.some(hasIngredientStructure);
  const [targetServings, setTargetServings] = useState(baseServings ?? 1);
  const scaleFactor = servingScaleFactor(draft.servings, targetServings);

  useEffect(() => {
    setTargetServings(baseServings ?? 1);
  }, [baseServings]);

  const ingredients = useMemo(
    () =>
      hasStructuredIngredients
        ? structureIngredients(draft.ingredients)
        : draft.ingredients.map((ingredient, index) => ({
            ...ingredient,
            id: ingredient.id || `ingredient-${index + 1}`,
          })),
    [draft.ingredients, hasStructuredIngredients],
  );
  const steps = useMemo(
    () =>
      hasStructuredIngredients
        ? structureSteps(draft.steps, ingredients)
        : draft.steps.map((step, index) => ({
            ...step,
            id: step.id || `step-${index + 1}`,
          })),
    [draft.steps, ingredients, hasStructuredIngredients],
  );
  const reviewFlags = hasStructuredIngredients
    ? [
        ...ingredients.flatMap((ingredient) => ingredient.warnings ?? []),
        ...steps.flatMap((step) => step.warnings ?? []),
      ].filter(
        // Drop the non-actionable "no ingredients in this step" noise that older
        // saved recipes may still carry.
        (flag) => flag !== "No listed ingredients were detected in this step.",
      )
    : [];

  return (
    <section className={`${detailPanelClassName} gap-4! bg-(--color-panel)! p-0!`}>
      <section className={editorSectionClassName}>
        <div className={sectionHeadingClassName}>
          <strong>Recipe details</strong>
        </div>
        <div className="grid grid-cols-[minmax(220px,1.05fr)_minmax(0,1fr)] gap-2.5 max-[720px]:grid-cols-1">
          <label className={`${fieldClassName} col-span-full`}>
            Title
            <input
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              value={draft.title}
            />
          </label>
          <label className={fieldClassName}>
            Source URL
            <input
              onChange={(event) =>
                onChange({
                  ...draft,
                  source: {
                    ...draft.source,
                    url: event.target.value || undefined,
                  },
                })
              }
              value={draft.source?.url ?? ""}
            />
          </label>
        </div>
      </section>

      <section
        className={`${editorSectionClassName} grid-cols-[minmax(0,0.82fr)_minmax(220px,0.46fr)] max-[1180px]:grid-cols-1`}
      >
        <div className="grid grid-cols-3 gap-2.5 max-[720px]:grid-cols-1">
          <label className={fieldClassName}>
            Prep
            <input
              min="0"
              onChange={(event) =>
                onChange({
                  ...draft,
                  prepTimeMinutes: optionalNumber(event.target.value),
                })
              }
              type="number"
              value={draft.prepTimeMinutes ?? ""}
            />
          </label>
          <label className={fieldClassName}>
            Cook
            <input
              min="0"
              onChange={(event) =>
                onChange({
                  ...draft,
                  cookTimeMinutes: optionalNumber(event.target.value),
                })
              }
              type="number"
              value={draft.cookTimeMinutes ?? ""}
            />
          </label>
          <label className={fieldClassName}>
            Servings
            <input
              onChange={(event) => onChange({ ...draft, servings: event.target.value })}
              value={draft.servings ?? ""}
            />
          </label>
        </div>
        <label className={fieldClassName}>
          Tags
          <input
            onChange={(event) =>
              onChange({
                ...draft,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            value={draft.tags.join(", ")}
          />
        </label>
      </section>

      <section className="grid flex-none grid-cols-[minmax(430px,0.98fr)_minmax(360px,1fr)] items-start gap-3 max-[1180px]:grid-cols-1">
        <StructuredIngredientsEditor
          baseServings={baseServings}
          draft={draft}
          hasStructuredIngredients={hasStructuredIngredients}
          ingredients={ingredients}
          onChange={onChange}
          onStructure={onStructure}
          scaleFactor={scaleFactor}
          servingsUnit={parsedYield?.unit}
          setTargetServings={setTargetServings}
          targetServings={targetServings}
        />
        <StructuredMethodEditor
          draft={draft}
          hasStructuredIngredients={hasStructuredIngredients}
          ingredients={ingredients}
          onChange={onChange}
          steps={steps}
        />
      </section>

      {reviewFlags.length ? (
        <section className="grid min-w-0 gap-3 rounded-lg border border-solid border-(--color-line) bg-[#fffaf2] p-3.5 [&>div]:flex [&>div]:flex-wrap [&>div]:gap-[7px] [&>strong]:text-[13px] [&>strong]:font-[820] [&>strong]:text-(--color-ink) [&_span]:rounded-full [&_span]:border [&_span]:border-solid [&_span]:border-[#e8cda8] [&_span]:bg-[#fff3df] [&_span]:px-2 [&_span]:py-[5px] [&_span]:text-[11px] [&_span]:font-[780] [&_span]:text-[#8b5529]">
          <strong>Review flags</strong>
          <div>
            {[...new Set(reviewFlags)].slice(0, 5).map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
        </section>
      ) : null}

      <RecipeImageGallery
        images={recipeImagesOf(draft)}
        onChange={(images) => onChange({ ...draft, images, imageUrl: images[0]?.url })}
        recipeId={recipeId}
        title={draft.title}
      />

      <SharingSection
        draft={draft}
        onVisibilityChange={onVisibilityChange}
        ownerUserId={ownerUserId}
        persistedVisibility={persistedVisibility}
      />
    </section>
  );
}

export function SharingSection({
  className = "",
  draft,
  onVisibilityChange,
  ownerUserId,
  persistedVisibility,
}: {
  className?: string;
  draft: Recipe;
  onVisibilityChange: (visibility: RecipeVisibility) => Promise<void>;
  ownerUserId?: string | null;
  persistedVisibility?: Recipe["visibility"];
}) {
  const visibility = draft.visibility ?? "private";
  const savedVisibility = persistedVisibility ?? "private";
  const recipeId = draft.id && !draft.id.startsWith("demo-") ? draft.id : "";
  const hasUnsavedVisibility = Boolean(recipeId && visibility !== savedVisibility);
  const candidateShareLink =
    recipeId && ownerUserId && visibility !== "private" && typeof window !== "undefined"
      ? `${window.location.origin}/r/${ownerUserId}/${recipeId}`
      : "";
  const shareLink =
    candidateShareLink && savedVisibility !== "private" && !hasUnsavedVisibility
      ? candidateShareLink
      : "";
  const visibleShareLink = shareLink || candidateShareLink;
  const [shares, setShares] = useState<RecipeShare[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  async function copyShareLink() {
    if (!shareLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus("Link copied to clipboard");
    } catch {
      setShareStatus(shareLink);
    }
  }

  useEffect(() => {
    setShares([]);
    setIdentifier("");
    setShareStatus("");
    if (!recipeId) {
      return undefined;
    }

    let cancelled = false;
    api
      .listRecipeShares(recipeId)
      .then((next) => {
        if (!cancelled) {
          setShares(next);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  useEffect(() => {
    setShareStatus("");
  }, [savedVisibility, visibility]);

  async function share() {
    const trimmed = identifier.trim();
    if (!recipeId || !trimmed) {
      return;
    }

    try {
      const result = await api.shareRecipe(recipeId, trimmed);
      setShares((current) => [
        result,
        ...current.filter((item) => item.sharedWith.id !== result.sharedWith.id),
      ]);
      setIdentifier("");
      setShareStatus(`Shared with ${result.sharedWith.name}`);
    } catch (error) {
      setShareStatus(errorMessage(error));
    }
  }

  async function revoke(share: RecipeShare) {
    if (!recipeId) {
      return;
    }

    try {
      await api.revokeRecipeShare(recipeId, share.sharedWith.id);
      setShares((current) =>
        current.filter((item) => item.sharedWith.id !== share.sharedWith.id),
      );
      setShareStatus(`Stopped sharing with ${share.sharedWith.name}`);
    } catch (error) {
      setShareStatus(errorMessage(error));
    }
  }

  return (
    <section className={`${editorSectionClassName} ${className}`.trim()}>
      <div className={sectionHeadingClassName}>
        <strong>Sharing</strong>
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Recipe visibility"
      >
        <button
          className={visibilityPillClass(visibility === "private")}
          onClick={() => void onVisibilityChange("private")}
          type="button"
        >
          <LockKeyhole size={14} />
          Private
        </button>
        <button
          className={visibilityPillClass(visibility === "unlisted")}
          onClick={() => void onVisibilityChange("unlisted")}
          type="button"
        >
          <Link2 size={14} />
          Unlisted
        </button>
        <button
          className={visibilityPillClass(visibility === "public")}
          onClick={() => void onVisibilityChange("public")}
          type="button"
        >
          <Globe2 size={14} />
          Public
        </button>
        <small className="text-[var(--muted-foreground)]">
          {visibility === "public"
            ? "Appears in Explore for everyone once saved."
            : visibility === "unlisted"
              ? "Hidden from Explore; anyone with the link can view it once saved."
              : "Only you and the people you share with can see it."}
        </small>
      </div>
      {recipeId ? (
        <>
          {hasUnsavedVisibility ? (
            <div className="rounded-lg border-2 border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--accent)_16%,white)] px-2.5 py-2 text-[12.5px] font-bold text-[var(--muted-foreground)]">
              Save this recipe to apply the {visibility} visibility before using a link.
            </div>
          ) : null}
          {visibleShareLink ? (
            <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-[color-mix(in_oklch,var(--secondary)_12%,white)] px-2.5 py-1.5">
              <span
                className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--muted-foreground)]"
                title={visibleShareLink}
              >
                {visibleShareLink}
              </span>
              <Button
                className="shrink-0"
                disabled={!shareLink}
                onClick={() => void copyShareLink()}
                size="sm"
              >
                <Clipboard size={14} />
                {shareLink ? "Copy link" : "Copy after save"}
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              aria-label="Share with a person"
              className="min-h-[38px] flex-1 rounded-lg border-2 border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-[var(--foreground)]"
              onChange={(event) => setIdentifier(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void share();
                }
              }}
              placeholder="Share by email or username"
              value={identifier}
            />
            <Button onClick={() => void share()} size="sm">
              <Share2 size={14} />
              Share
            </Button>
          </div>
          {shares.length ? (
            <div className="flex flex-wrap gap-[7px]">
              {shares.map((item) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border)] bg-[color-mix(in_oklch,var(--secondary)_20%,white)] py-1 pr-1.5 pl-2.5 text-[13px] text-[var(--foreground)]"
                  key={item.sharedWith.id}
                >
                  <UserRound size={12} />
                  {item.sharedWith.name}
                  <Button
                    aria-label={`Stop sharing with ${item.sharedWith.name}`}
                    className="h-6 min-h-6! w-6 rounded-full"
                    onClick={() => void revoke(item)}
                    size="icon"
                    variant="danger"
                  >
                    <X size={12} />
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
          {shareStatus ? <p className={inlineStatusClassName}>{shareStatus}</p> : null}
        </>
      ) : null}
    </section>
  );
}

export function StructuredIngredientsEditor({
  baseServings,
  draft,
  hasStructuredIngredients,
  ingredients,
  onChange,
  onStructure,
  scaleFactor,
  servingsUnit,
  setTargetServings,
  targetServings,
}: {
  baseServings?: number;
  draft: Recipe;
  hasStructuredIngredients: boolean;
  ingredients: RecipeIngredient[];
  onChange: (recipe: Recipe) => void;
  onStructure: () => Promise<void>;
  scaleFactor: number;
  servingsUnit?: string;
  setTargetServings: (value: number) => void;
  targetServings: number;
}) {
  function updateIngredient(index: number, ingredient: RecipeIngredient) {
    const nextIngredients = ingredients.map((item, itemIndex) =>
      itemIndex === index ? ingredientWithText(ingredient) : item,
    );
    onChange({
      ...draft,
      ingredients: nextIngredients,
      steps: structureSteps(draft.steps, nextIngredients),
    });
  }

  function removeIngredient(index: number) {
    const nextIngredients = ingredients.filter((_, itemIndex) => itemIndex !== index);
    onChange({
      ...draft,
      ingredients: nextIngredients,
      steps: structureSteps(draft.steps, nextIngredients),
    });
  }

  function addIngredient() {
    onChange({
      ...draft,
      ingredients: [
        ...ingredients,
        {
          id: `ingredient-${ingredients.length + 1}`,
          text: "New ingredient",
          ...(hasStructuredIngredients
            ? { item: "New ingredient", scalable: false }
            : {}),
        },
      ],
    });
  }

  function updateIngredientLine(index: number, text: string) {
    onChange({
      ...draft,
      ingredients: ingredients.map((ingredient, itemIndex) =>
        itemIndex === index ? { ...ingredient, text } : ingredient,
      ),
    });
  }

  return (
    <section className={structurePanelClassName}>
      <div className={structureHeadingClassName}>
        <div className={structureHeadingLabelClassName}>
          <strong>Ingredients</strong>
          <span>
            {ingredients.length} {hasStructuredIngredients ? "rows" : "lines"}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!hasStructuredIngredients ? (
            <Button onClick={() => void onStructure()} size="sm">
              <Wand2 size={15} />
              Structure
            </Button>
          ) : null}
          <Button onClick={addIngredient} size="sm">
            <Plus size={15} />
            Add
          </Button>
        </div>
      </div>

      {hasStructuredIngredients ? (
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2.5 rounded-lg border border-solid border-[#e4d4c2] bg-[#fffaf2] p-2 max-[720px]:grid-cols-1 max-[720px]:items-stretch [&>small]:text-xs [&>small]:text-(--color-fog) [&>span]:text-xs [&>span]:font-[820] [&>span]:text-(--color-ink)">
          <span>Scale</span>
          <div className="grid grid-cols-[30px_58px_30px] items-center">
            <button
              aria-label="Decrease servings"
              className="inline-flex h-[30px] items-center justify-center rounded-none border border-solid border-[#d8c8b5] bg-(--color-panel) p-0 text-(--color-ink) first:rounded-l-lg last:rounded-r-lg"
              disabled={!baseServings}
              onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
              type="button"
            >
              <Minus size={14} />
            </button>
            <input
              aria-label="Target servings"
              className="h-[30px] w-[58px] min-w-0 border-y border-x-0 border-solid border-[#d8c8b5] bg-(--color-panel) text-center text-[13px] font-[760] text-(--color-ink) outline-0"
              disabled={!baseServings}
              min="1"
              onChange={(event) =>
                setTargetServings(optionalNumber(event.target.value) ?? 1)
              }
              type="number"
              value={targetServings}
            />
            <button
              aria-label="Increase servings"
              className="inline-flex h-[30px] items-center justify-center rounded-none border border-solid border-[#d8c8b5] bg-(--color-panel) p-0 text-(--color-ink) first:rounded-l-lg last:rounded-r-lg"
              disabled={!baseServings}
              onClick={() => setTargetServings(targetServings + 1)}
              type="button"
            >
              <Plus size={14} />
            </button>
          </div>
          <small>
            {baseServings
              ? `${baseServings} -> ${targetServings} ${servingsUnit ?? "servings"}`
              : "Numeric servings unavailable"}
          </small>
        </div>
      ) : null}

      {!hasStructuredIngredients ? (
        <div className="grid gap-2">
          {ingredients.map((ingredient, index) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_34px] items-center gap-2 rounded-lg border border-solid border-[#e1d4c2] bg-(--color-panel) p-2 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-md [&>input]:border [&>input]:border-solid [&>input]:border-transparent [&>input]:bg-[#fffaf2] [&>input]:p-2 [&>input]:text-sm [&>input]:font-[560] [&>input]:leading-[1.35] [&>input]:text-(--color-ink) [&>input]:outline-0 [&>input]:focus:border-[#c9ad8c] [&>input]:focus:bg-(--color-panel)"
              key={ingredient.id ?? index}
            >
              <input
                aria-label={`Ingredient line ${index + 1}`}
                onChange={(event) => updateIngredientLine(index, event.target.value)}
                value={ingredient.text}
              />
              <Button
                aria-label={`Remove ingredient ${index + 1}`}
                onClick={() => removeIngredient(index)}
                size="icon"
                variant="ghost"
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {hasStructuredIngredients ? (
        <div className="grid min-w-0 gap-2">
          {ingredients.map((ingredient, index) => {
            const showScaled = scaleFactor !== 1 && ingredient.scalable !== false;
            return (
              <div
                className="grid grid-cols-[3rem_3.25rem_minmax(0,1fr)_2rem] items-center gap-x-[7px] gap-y-1.5 rounded-[10px] border border-solid border-[#e1d4c2] bg-(--color-panel) p-2 transition-[border-color,box-shadow] duration-150 focus-within:border-[#c9ad8c] focus-within:shadow-[0_0_0_3px_#f3e7d4]"
                key={ingredient.id ?? `${ingredient.text}-${index}`}
              >
                <input
                  className={`${ingCellClassName} text-center font-[720]`}
                  aria-label={`Ingredient ${index + 1} quantity`}
                  onChange={(event) => {
                    const valueText = event.target.value;
                    updateIngredient(index, {
                      ...ingredient,
                      quantity: {
                        ...ingredient.quantity,
                        value: optionalQuantity(valueText),
                        valueText,
                      },
                      scalable: Boolean(valueText),
                    });
                  }}
                  placeholder="Qty"
                  value={ingredient.quantity?.valueText ?? ""}
                />
                <input
                  className={`${ingCellClassName} text-center font-[720]`}
                  aria-label={`Ingredient ${index + 1} unit`}
                  onChange={(event) =>
                    updateIngredient(index, {
                      ...ingredient,
                      quantity: {
                        ...ingredient.quantity,
                        unit: event.target.value || undefined,
                      },
                    })
                  }
                  placeholder="Unit"
                  value={ingredient.quantity?.unit ?? ""}
                />
                <input
                  className={`${ingCellClassName} font-[620]`}
                  aria-label={`Ingredient ${index + 1} item`}
                  onChange={(event) =>
                    updateIngredient(index, {
                      ...ingredient,
                      item: event.target.value,
                    })
                  }
                  placeholder="Ingredient"
                  value={ingredient.item ?? ingredient.text}
                />
                <Button
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() => removeIngredient(index)}
                  size="icon"
                  variant="ghost"
                >
                  <X size={14} />
                </Button>
                <div className="col-span-full flex min-w-0 items-center gap-[7px]">
                  <input
                    className={`${ingCellClassName} flex-auto text-xs`}
                    aria-label={`Ingredient ${index + 1} preparation`}
                    onChange={(event) =>
                      updateIngredient(index, {
                        ...ingredient,
                        preparation: event.target.value || undefined,
                      })
                    }
                    placeholder="Prep. Diced, chopped…"
                    value={ingredient.preparation ?? ""}
                  />
                  {showScaled ? (
                    <span
                      className="max-w-[55%] flex-initial truncate rounded-full border border-solid border-[#d2ddcf] bg-[#eff4ec] px-2.5 py-[5px] text-[11px] font-[760] text-(--color-sage)"
                      title="Scaled to servings"
                    >
                      → {ingredientDisplayText(ingredient, scaleFactor)}
                    </span>
                  ) : null}
                </div>
                {ingredient.warnings?.length ? (
                  <span className="col-span-full text-[11px] font-[760] leading-[1.25] text-[#9f6130]">
                    {ingredient.warnings[0]}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function StructuredMethodEditor({
  draft,
  hasStructuredIngredients,
  ingredients,
  onChange,
  steps,
}: {
  draft: Recipe;
  hasStructuredIngredients: boolean;
  ingredients: RecipeIngredient[];
  onChange: (recipe: Recipe) => void;
  steps: RecipeStep[];
}) {
  function updateStep(index: number, step: RecipeStep) {
    onChange({
      ...draft,
      steps: steps.map((item, itemIndex) => (itemIndex === index ? step : item)),
    });
  }

  function removeStep(index: number) {
    onChange({
      ...draft,
      steps: steps.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function addStep() {
    onChange({
      ...draft,
      steps: [
        ...steps,
        {
          id: `step-${steps.length + 1}`,
          text: "New step.",
        },
      ],
    });
  }

  return (
    <section className={structurePanelClassName}>
      <div className={structureHeadingClassName}>
        <div className={structureHeadingLabelClassName}>
          <strong>Method</strong>
          <span>{steps.length} steps</span>
        </div>
        <Button onClick={addStep} size="sm">
          <Plus size={15} />
          Add
        </Button>
      </div>

      <div className="grid gap-[9px]">
        {steps.map((step, index) => (
          <article
            className="grid grid-cols-[32px_minmax(0,1fr)_34px] items-start gap-2 rounded-[10px] border border-solid border-[#e1d4c2] bg-(--color-panel) p-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-[#c9ad8c] focus-within:shadow-[0_0_0_3px_#f3e7d4] max-[720px]:grid-cols-[30px_minmax(0,1fr)]"
            key={step.id ?? `${step.text}-${index}`}
          >
            <div className="inline-flex size-7 items-center justify-center rounded-full border border-solid border-[#d2ddcf] bg-[#eff4ec] text-[13px] font-[820] text-(--color-sage)">
              {index + 1}
            </div>
            <textarea
              aria-label={`Method step ${index + 1}`}
              className={`${ingCellClassName} min-h-[58px] resize-y`}
              onChange={(event) => {
                const [nextStep] = hasStructuredIngredients
                  ? structureSteps([{ ...step, text: event.target.value }], ingredients)
                  : [{ ...step, text: event.target.value }];
                updateStep(index, {
                  ...(nextStep ?? { ...step, text: event.target.value }),
                  id: step.id,
                });
              }}
              value={step.text}
            />
            <Button
              aria-label={`Remove method step ${index + 1}`}
              className="max-[720px]:col-[2] max-[720px]:justify-self-end"
              onClick={() => removeStep(index)}
              size="icon"
              variant="ghost"
            >
              <X size={14} />
            </Button>
            {hasStructuredIngredients ? (
              <div className="col-[2/-1] flex flex-wrap gap-1.5 max-[720px]:col-span-full">
                {step.timers?.map((timer) => (
                  <span
                    className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-solid border-[#d4e5e8] bg-[#eef5f6] px-[7px] py-1 text-[11px] font-[780] text-[#34545c]"
                    key={`${step.id ?? step.text}-timer-${timer.label ?? ""}-${timer.minutes}`}
                  >
                    <Clock3 size={13} />
                    {timer.minutes} min
                  </span>
                ))}
                {step.temperature ? (
                  <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-solid border-[#d4e5e8] bg-[#eef5f6] px-[7px] py-1 text-[11px] font-[780] text-[#34545c]">
                    {step.temperature.value}
                    {step.temperature.unit}
                  </span>
                ) : null}
                {step.ingredientIds?.slice(0, 4).map((ingredientId) => {
                  const ingredient = ingredients.find(
                    (item) => item.id === ingredientId,
                  );
                  return ingredient ? (
                    <span
                      className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-solid border-[#d4e5e8] bg-[#eef5f6] px-[7px] py-1 text-[11px] font-[780] text-[#34545c]"
                      key={ingredientId}
                    >
                      {ingredient.item ?? ingredient.text}
                    </span>
                  ) : null;
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
