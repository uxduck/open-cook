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
import { RecipeImageGallery } from "./recipeViews";

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
    <section className="detail-panel !gap-4 !bg-(--color-panel) !p-0">
      <section className="editor-section compact-details-section">
        <div className="section-heading">
          <strong>Recipe details</strong>
        </div>
        <div className="editor-details-grid">
          <label className="field field-title">
            Title
            <input
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              value={draft.title}
            />
          </label>
          <label className="field">
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

      <section className="editor-section timing-section">
        <div className="field-grid">
          <label className="field">
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
          <label className="field">
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
          <label className="field">
            Servings
            <input
              onChange={(event) => onChange({ ...draft, servings: event.target.value })}
              value={draft.servings ?? ""}
            />
          </label>
        </div>
        <label className="field">
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

      <section className="recipe-structure-grid">
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
        <section className="structure-review">
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
  const visibility = draft.visibility ?? "private";
  const savedVisibility = persistedVisibility ?? "private";
  const recipeId = draft.id && !draft.id.startsWith("demo-") ? draft.id : "";
  const hasUnsavedVisibility = Boolean(recipeId && visibility !== savedVisibility);
  const candidateShareLink =
    recipeId &&
    ownerUserId &&
    visibility !== "private" &&
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${ownerUserId}/${recipeId}`
      : "";
  const shareLink =
    candidateShareLink &&
    savedVisibility !== "private" &&
    !hasUnsavedVisibility
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
    <section className="editor-section sharing-section">
      <div className="section-heading">
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
          {shareStatus ? <p className="inline-status">{shareStatus}</p> : null}
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
    <section className="structure-panel ingredients-panel">
      <div className="structure-heading">
        <div>
          <strong>Ingredients</strong>
          <span>
            {ingredients.length} {hasStructuredIngredients ? "rows" : "lines"}
          </span>
        </div>
        <div className="structure-actions">
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
        <div className="serving-scale">
          <span>Scale</span>
          <div>
            <button
              aria-label="Decrease servings"
              disabled={!baseServings}
              onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
              type="button"
            >
              <Minus size={14} />
            </button>
            <input
              aria-label="Target servings"
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
        <div className="ingredient-line-list">
          {ingredients.map((ingredient, index) => (
            <div className="ingredient-line-row" key={ingredient.id ?? index}>
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
        <div className="ingredient-table">
          {ingredients.map((ingredient, index) => {
            const showScaled =
              scaleFactor !== 1 && ingredient.scalable !== false;
            return (
              <div
                className="ingredient-row"
                key={ingredient.id ?? `${ingredient.text}-${index}`}
              >
                <input
                  className="ing-cell ing-qty"
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
                  className="ing-cell ing-unit"
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
                  className="ing-cell ing-name"
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
                <div className="ing-meta">
                  <input
                    className="ing-cell ing-prep"
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
                    <span className="ing-scaled" title="Scaled to servings">
                      → {ingredientDisplayText(ingredient, scaleFactor)}
                    </span>
                  ) : null}
                </div>
                {ingredient.warnings?.length ? (
                  <span className="row-warning">{ingredient.warnings[0]}</span>
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
    <section className="structure-panel method-panel">
      <div className="structure-heading">
        <div>
          <strong>Method</strong>
          <span>{steps.length} steps</span>
        </div>
        <Button onClick={addStep} size="sm">
          <Plus size={15} />
          Add
        </Button>
      </div>

      <div className="step-list">
        {steps.map((step, index) => (
          <article className="step-card" key={step.id ?? `${step.text}-${index}`}>
            <div className="step-number">{index + 1}</div>
            <textarea
              aria-label={`Method step ${index + 1}`}
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
              onClick={() => removeStep(index)}
              size="icon"
              variant="ghost"
            >
              <X size={14} />
            </Button>
            {hasStructuredIngredients ? (
              <div className="step-chip-row">
                {step.timers?.map((timer) => (
                  <span
                    className="step-chip"
                    key={`${step.id ?? step.text}-timer-${timer.label ?? ""}-${timer.minutes}`}
                  >
                    <Clock3 size={13} />
                    {timer.minutes} min
                  </span>
                ))}
                {step.temperature ? (
                  <span className="step-chip">
                    {step.temperature.value}
                    {step.temperature.unit}
                  </span>
                ) : null}
                {step.ingredientIds?.slice(0, 4).map((ingredientId) => {
                  const ingredient = ingredients.find(
                    (item) => item.id === ingredientId,
                  );
                  return ingredient ? (
                    <span className="step-chip" key={ingredientId}>
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
