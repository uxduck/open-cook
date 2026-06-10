import { Link } from "@tanstack/react-router";
import type { CreateRecipeInput, Recipe, RecipeDraft } from "@open-cook/core";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  Mic,
  Minus,
  Plus,
  Shuffle,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, isApiError, type RecipeRemixApiResult } from "../api";
import { useDictation } from "../lib/useDictation";
import { Button } from "../ui";

type Mode = "adapt" | "theme";
type Phase = "choose" | "compose" | "generating" | "result";

const adaptPresets = [
  "make it vegan",
  "make it gluten-free",
  "add more heat",
  "double the servings",
  "quicker & easier",
];

const themePresets = [
  "Halloween",
  "Dragon feast",
  "Harry Potter",
  "Christmas",
  "Birthday party",
];

const chipClass =
  "rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:bg-peach";

export function RecipeGenerationPanel({
  recipe,
  onSaveAsNewRecipe,
}: {
  recipe: Recipe;
  onSaveAsNewRecipe: (input: CreateRecipeInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [phase, setPhase] = useState<Phase>("choose");
  const [prompt, setPrompt] = useState("");
  const [themeLabel, setThemeLabel] = useState("");
  const [result, setResult] = useState<RecipeRemixApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [saving, setSaving] = useState(false);

  const dictation = useDictation();
  const dictationBaseRef = useRef("");
  const isDictating =
    dictation.status === "listening" || dictation.status === "connecting";

  // While the mic is live, mirror the running transcript into the prompt on top
  // of whatever was already typed when dictation started.
  useEffect(() => {
    if (dictation.status === "listening" || dictation.status === "connecting") {
      const base = dictationBaseRef.current;
      setPrompt(base ? `${base} ${dictation.liveText}`.trim() : dictation.liveText);
    }
  }, [dictation.liveText, dictation.status]);

  function pickMode(next: Mode) {
    setMode(next);
    setPhase("compose");
    setPrompt("");
    setThemeLabel("");
    setResult(null);
    setError(null);
    setOutOfCredits(false);
    dictation.reset();
  }

  function startOver() {
    dictation.reset();
    setMode(null);
    setPhase("choose");
    setPrompt("");
    setThemeLabel("");
    setResult(null);
    setError(null);
    setOutOfCredits(false);
  }

  function toggleMic() {
    if (isDictating) {
      dictation.stop();
      return;
    }
    dictationBaseRef.current = prompt;
    dictation.reset();
    void dictation.start();
  }

  const canSubmit =
    mode === "theme" ? Boolean(themeLabel || prompt.trim()) : Boolean(prompt.trim());

  async function submit() {
    if (!mode || !canSubmit) {
      return;
    }
    if (isDictating) {
      dictation.stop();
    }
    setPhase("generating");
    setError(null);
    setOutOfCredits(false);

    const text = prompt.trim();
    const payload =
      mode === "theme"
        ? {
            recipe,
            theme: themeLabel || text,
            prompt: buildThemePrompt(themeLabel, text),
            includeImagePrompt: true,
          }
        : { recipe, prompt: text };

    try {
      const res = await api.remixRecipe(payload);
      setResult(res);
      setPhase("result");
    } catch (err) {
      if (isApiError(err) && err.status === 402) {
        setOutOfCredits(true);
        setError("You're out of credits for this month.");
      } else {
        setError(
          err instanceof Error ? err.message : "That didn't work. Try again.",
        );
      }
      setPhase("compose");
    }
  }

  async function saveAsNew() {
    if (!result) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveAsNewRecipe(draftToCreateInput(result.draft, recipe, mode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the recipe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-paper p-4 shadow-[5px_5px_0_var(--color-ink)] md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="text-tomato" size={18} />
        <h2 className="font-display text-lg font-semibold text-ink">
          Make a new version
        </h2>
        <span className="ml-auto text-xs font-bold text-fog">
          your original is always kept
        </span>
      </div>

      {phase === "choose" ? (
        <ModeChooser onPick={pickMode} />
      ) : phase === "result" && result ? (
        <ResultView
          mode={mode}
          onSave={saveAsNew}
          onStartOver={startOver}
          result={result}
          saving={saving}
          sourceTitle={recipe.title}
          error={error}
        />
      ) : (
        <Composer
          canSubmit={canSubmit}
          dictating={isDictating}
          dictationStatus={dictation.status}
          error={error}
          generating={phase === "generating"}
          mode={mode as Mode}
          onBack={startOver}
          onMicToggle={toggleMic}
          onPromptChange={setPrompt}
          onSubmit={submit}
          onThemeSelect={(value) => setThemeLabel((curr) => (curr === value ? "" : value))}
          outOfCredits={outOfCredits}
          prompt={prompt}
          themeLabel={themeLabel}
        />
      )}
    </section>
  );
}

function ModeChooser({ onPick }: { onPick: (mode: Mode) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onPick("adapt")}
        className="group flex flex-col gap-3 rounded-xl border-2 border-ink bg-panel p-4 text-left shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-tomato bg-peach">
            <Shuffle className="text-tomato-dark" size={18} />
          </span>
          <span className="font-display text-base font-semibold text-ink">Adapt</span>
          <span className="ml-auto rounded-full bg-peach px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-tomato-dark">
            Changes the food
          </span>
        </div>
        <p className="text-sm leading-snug text-ink/80">
          Rewrites ingredients, flavour or method. Saved as a{" "}
          <strong className="font-extrabold">brand-new recipe</strong>.
        </p>
        <div className="rounded-lg border border-dashed border-line bg-canvas px-2.5 py-2 text-xs leading-relaxed">
          <span className="flex items-center gap-1 text-tomato-dark">
            <Minus size={12} /> <s className="text-fog">200g halloumi</s>
          </span>
          <span className="flex items-center gap-1 text-sage">
            <Plus size={12} /> 200g smoked tofu
          </span>
        </div>
        <span className="mt-auto flex items-center gap-1.5 text-xs font-extrabold text-tomato-dark">
          <ArrowRight size={14} /> Creates a new recipe
        </span>
      </button>

      <button
        type="button"
        onClick={() => onPick("theme")}
        className="group flex flex-col gap-3 rounded-xl border-2 border-ink bg-panel p-4 text-left shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-royal bg-[color-mix(in_oklch,var(--color-royal)_15%,white)]">
            <Wand2 className="text-royal" size={18} />
          </span>
          <span className="font-display text-base font-semibold text-ink">Theme</span>
          <span className="ml-auto rounded-full bg-[color-mix(in_oklch,var(--color-royal)_15%,white)] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-royal">
            Same food, new look
          </span>
        </div>
        <p className="text-sm leading-snug text-ink/80">
          Keeps every ingredient and step. Dresses it up for a{" "}
          <strong className="font-extrabold">theme</strong> you choose.
        </p>
        <div className="rounded-lg border border-dashed border-line bg-canvas px-2.5 py-2 text-xs leading-relaxed">
          <span className="flex items-center gap-1 text-fog">
            <Lock size={12} /> Ingredients unchanged
          </span>
          <span className="flex items-center gap-1 font-bold text-royal">
            <Wand2 size={12} /> new themed write-up
          </span>
        </div>
        <span className="mt-auto flex items-center gap-1.5 text-xs font-extrabold text-royal">
          <ArrowRight size={14} /> Same recipe, themed
        </span>
      </button>
    </div>
  );
}

function Composer({
  canSubmit,
  dictating,
  dictationStatus,
  error,
  generating,
  mode,
  onBack,
  onMicToggle,
  onPromptChange,
  onSubmit,
  onThemeSelect,
  outOfCredits,
  prompt,
  themeLabel,
}: {
  canSubmit: boolean;
  dictating: boolean;
  dictationStatus: string;
  error: string | null;
  generating: boolean;
  mode: Mode;
  onBack: () => void;
  onMicToggle: () => void;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onThemeSelect: (value: string) => void;
  outOfCredits: boolean;
  prompt: string;
  themeLabel: string;
}) {
  const presets = mode === "adapt" ? adaptPresets : themePresets;
  const isTheme = mode === "theme";
  const accentText = isTheme ? "text-royal" : "text-tomato-dark";
  const Icon = isTheme ? Wand2 : Shuffle;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-bold text-fog hover:text-ink"
        >
          <ArrowLeft size={14} /> Choose again
        </button>
        <span className={`ml-1 flex items-center gap-1.5 font-display text-sm font-semibold ${accentText}`}>
          <Icon size={15} />
          {isTheme ? "Theme as…" : "Adapt by…"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const selected = isTheme && themeLabel === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() =>
                isTheme ? onThemeSelect(preset) : onPromptChange(preset)
              }
              className={
                selected
                  ? "rounded-full border-2 border-royal bg-[color-mix(in_oklch,var(--color-royal)_15%,white)] px-2.5 py-1 text-xs font-extrabold text-royal"
                  : chipClass
              }
            >
              {preset}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={3}
          placeholder={
            isTheme
              ? "Add any detail… cobweb plating, spooky dish names, a little ghost story on the card"
              : "Describe the change… e.g. swap dairy for plant-based, make it lower-carb"
          }
          className="w-full resize-none rounded-xl border-2 border-soft bg-panel p-3 pr-12 text-sm text-ink outline-none placeholder:text-fog focus:border-ink"
        />
        <button
          type="button"
          onClick={onMicToggle}
          aria-label={dictating ? "Stop dictation" : "Dictate with your voice"}
          className={
            dictating
              ? "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-tomato bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-tomato-dark"
              : "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink bg-paper text-ink hover:bg-peach"
          }
        >
          {dictationStatus === "connecting" ? (
            <Loader2 className="animate-spin" size={15} />
          ) : dictating ? (
            <Square fill="currentColor" size={13} />
          ) : (
            <Mic size={15} />
          )}
        </button>
      </div>

      {dictating ? (
        <div className="flex items-center gap-2 text-xs font-bold text-tomato-dark">
          <span className="flex items-end gap-0.5" aria-hidden="true">
            <span className="h-2 w-0.5 animate-pulse bg-tomato" />
            <span className="h-3.5 w-0.5 animate-pulse bg-tomato [animation-delay:120ms]" />
            <span className="h-2.5 w-0.5 animate-pulse bg-tomato [animation-delay:240ms]" />
            <span className="h-4 w-0.5 animate-pulse bg-tomato [animation-delay:360ms]" />
          </span>
          {dictationStatus === "connecting"
            ? "Connecting…"
            : "Listening — tap stop when you're done"}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border-2 border-tomato bg-[color-mix(in_oklch,var(--color-tomato)_10%,white)] px-3 py-2 text-xs font-bold text-tomato-dark">
          {error}
          {outOfCredits ? (
            <>
              {" "}
              <Link className="underline" to="/pricing">
                See plans →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fog">Uses 1 credit</span>
        <Button
          disabled={!canSubmit || generating}
          onClick={onSubmit}
          variant="primary"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={15} />
              Cooking up your version…
            </>
          ) : (
            <>
              <Icon size={15} />
              {isTheme ? "Theme recipe" : "Adapt recipe"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ResultView({
  error,
  mode,
  onSave,
  onStartOver,
  result,
  saving,
  sourceTitle,
}: {
  error: string | null;
  mode: Mode | null;
  onSave: () => void;
  onStartOver: () => void;
  result: RecipeRemixApiResult;
  saving: boolean;
  sourceTitle: string;
}) {
  const isTheme = mode === "theme";
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs font-bold text-fog">
        <Check className="text-sage" size={15} />
        {isTheme ? "Themed version" : "New version"} from “{sourceTitle}”
      </div>

      <div
        className={
          isTheme
            ? "rounded-xl border-2 border-royal bg-[color-mix(in_oklch,var(--color-royal)_8%,white)] p-3"
            : "rounded-xl border-2 border-tomato bg-[color-mix(in_oklch,var(--color-tomato)_8%,white)] p-3"
        }
      >
        <strong
          className={`font-display text-base font-semibold ${
            isTheme ? "text-royal" : "text-tomato-dark"
          }`}
        >
          {result.draft.title}
        </strong>
        {result.draft.description ? (
          <p className="mt-1 text-sm text-ink/80">{result.draft.description}</p>
        ) : null}
      </div>

      {result.changes.length ? (
        <ul className="grid gap-1">
          {result.changes.slice(0, 6).map((change) => (
            <li key={change} className="flex items-start gap-1.5 text-sm text-ink">
              <ArrowRight className="mt-0.5 shrink-0 text-fog" size={13} />
              {change}
            </li>
          ))}
        </ul>
      ) : null}

      {result.safetyNotes.length ? (
        <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-fog">
          {result.safetyNotes.map((note) => (
            <p key={note}>⚠ {note}</p>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-xs font-bold text-tomato-dark">{error}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button onClick={onStartOver} size="sm" variant="ghost">
          <X size={14} />
          Discard
        </Button>
        <Button disabled={saving} onClick={onSave} variant="primary">
          {saving ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Check size={15} />
          )}
          Save as new recipe
        </Button>
      </div>
    </div>
  );
}

function buildThemePrompt(themeLabel: string, extra: string) {
  const subject = themeLabel || extra || "the chosen theme";
  const base = `Restyle this recipe for a ${subject} theme. Keep every ingredient, quantity, and cooking step exactly the same — only rewrite the title, description, tags, and the wording and presentation of the steps so the dish fits the theme.`;
  return extra && themeLabel ? `${base} Extra direction: ${extra}` : base;
}

function draftToCreateInput(
  draft: RecipeDraft,
  source: Recipe,
  mode: Mode | null,
): CreateRecipeInput {
  return {
    title: draft.title,
    description: draft.description,
    prepTimeMinutes: draft.prepTimeMinutes,
    cookTimeMinutes: draft.cookTimeMinutes,
    totalTimeMinutes: draft.totalTimeMinutes,
    servings: draft.servings,
    tags: draft.tags,
    ingredients: draft.ingredients,
    steps: draft.steps,
    notes: draft.notes,
    visibility: "private",
    source: {
      name: `${mode === "theme" ? "Themed" : "Adapted"} from ${source.title}`,
    },
  };
}
