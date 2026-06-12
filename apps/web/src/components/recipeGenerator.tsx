import type { Recipe } from "@open-cook/core";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  FileText,
  Loader2,
  Mic,
  RefreshCcw,
  Send,
  Share2,
  Sparkles,
  Square,
  Users,
  Utensils,
  Wand2,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useDictation } from "../lib/useDictation";
import { Button } from "../ui";

type PreviewTab = "invite" | "menu" | "guests";

type GatheringDraft = {
  dietaryLine: string;
  guestQuestion: string;
  hostNote: string;
  inviteBody: string;
  menuIntro: string;
  recipeTitles: string[];
  subtitle: string;
  title: string;
  toneLabel: string;
};

const directionPresets = [
  "dragon banquet",
  "customised for children",
  "garden birthday lunch",
  "formal printed menu",
  "easy weeknight supper",
  "make allergies prominent",
];

const dietaryPresets = [
  "vegetarian guest",
  "gluten-free option",
  "nut allergy",
  "no pork",
  "kid-friendly portions",
];

const previewTabs: Array<{ id: PreviewTab; label: string }> = [
  { id: "invite", label: "Invite" },
  { id: "menu", label: "Menu" },
  { id: "guests", label: "Guests" },
];

export function RecipeGenerationPanel({
  recipe,
  recipes = [],
}: {
  recipe: Recipe;
  recipes?: Recipe[];
}) {
  const currentRecipeKey = recipeKey(recipe);
  const availableRecipes = useMemo(
    () => uniqueRecipes(recipe, recipes),
    [recipe, recipes],
  );
  const [selectedRecipeKeys, setSelectedRecipeKeys] = useState<string[]>([
    currentRecipeKey,
  ]);
  const [started, setStarted] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [prompt, setPrompt] = useState("Make it warm, simple, and easy to share.");
  const [dietary, setDietary] = useState("");
  const [guestQuestion, setGuestQuestion] = useState(
    "Tell us anything we should avoid or adapt.",
  );
  const [activeTab, setActiveTab] = useState<PreviewTab>("invite");
  const [copied, setCopied] = useState(false);
  const draftingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dictation = useDictation();
  const dictationBaseRef = useRef("");
  const isDictating =
    dictation.status === "listening" || dictation.status === "connecting";

  useEffect(() => {
    setSelectedRecipeKeys([currentRecipeKey]);
  }, [currentRecipeKey]);

  useEffect(() => {
    return () => {
      if (draftingTimerRef.current) {
        clearTimeout(draftingTimerRef.current);
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (dictation.status === "listening" || dictation.status === "connecting") {
      const base = dictationBaseRef.current;
      setPrompt(base ? `${base} ${dictation.liveText}`.trim() : dictation.liveText);
    }
  }, [dictation.liveText, dictation.status]);

  const selectedRecipes = useMemo(() => {
    const selected = new Set(selectedRecipeKeys);
    const picked = availableRecipes.filter((item) => selected.has(recipeKey(item)));
    return picked.length ? picked : [recipe];
  }, [availableRecipes, recipe, selectedRecipeKeys]);

  const draft = useMemo(
    () =>
      buildGatheringDraft({
        dietary,
        guestQuestion,
        prompt,
        recipes: selectedRecipes,
      }),
    [dietary, guestQuestion, prompt, selectedRecipes],
  );

  function queueDraft() {
    setDrafting(true);
    if (draftingTimerRef.current) {
      clearTimeout(draftingTimerRef.current);
    }
    draftingTimerRef.current = setTimeout(() => setDrafting(false), 900);
  }

  function startGathering() {
    setStarted(true);
    queueDraft();
  }

  function toggleRecipe(nextRecipe: Recipe) {
    const key = recipeKey(nextRecipe);
    setSelectedRecipeKeys((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }
      return [...current, key];
    });
    queueDraft();
  }

  function appendDirection(value: string) {
    setPrompt((current) => (current.trim() ? `${current.trim()}; ${value}` : value));
    queueDraft();
  }

  function appendDietary(value: string) {
    setDietary((current) => (current.trim() ? `${current.trim()}, ${value}` : value));
    queueDraft();
  }

  function toggleMic() {
    if (isDictating) {
      dictation.stop();
      queueDraft();
      return;
    }
    dictationBaseRef.current = prompt;
    dictation.reset();
    void dictation.start();
  }

  async function copyDraft() {
    const text = formatGatheringDraft(draft);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[5px_5px_0_0_var(--color-ink)]">
      {!started ? (
        <GatheringStart
          recipe={recipe}
          selectedCount={selectedRecipes.length}
          onStart={startGathering}
        />
      ) : (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.72fr)]">
          <div className="grid gap-5 p-4 md:p-5">
            <GatheringHeader selectedCount={selectedRecipes.length} />

            <RecipePicker
              availableRecipes={availableRecipes}
              selectedRecipeKeys={selectedRecipeKeys}
              onToggle={toggleRecipe}
            />

            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-[13px] font-extrabold text-(--color-ink)">
                  <Wand2 size={15} />
                  AI brief
                </div>
                <span className="text-[12px] font-bold text-(--color-fog)">
                  {draft.toneLabel}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {directionPresets.map((preset) => (
                  <button
                    className="rounded-full border border-(--color-line) bg-(--color-paper) px-2.5 py-1 text-xs font-bold text-(--color-ink) transition hover:border-(--color-ink) hover:bg-(--color-peach)"
                    key={preset}
                    onClick={() => appendDirection(preset)}
                    type="button"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  className="min-h-[112px] w-full resize-y rounded-xl border-2 border-(--color-line) bg-(--color-paper) px-3 py-3 pr-12 text-[14px] leading-relaxed text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ask for a theme, audience, tone, format, or constraint."
                  value={prompt}
                />
                <button
                  aria-label={
                    isDictating ? "Stop dictation" : "Dictate with your voice"
                  }
                  className={
                    isDictating
                      ? "absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)"
                      : "absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-(--color-ink) bg-(--color-panel) text-(--color-ink) hover:bg-(--color-peach)"
                  }
                  onClick={toggleMic}
                  type="button"
                >
                  {dictation.status === "connecting" ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : isDictating ? (
                    <Square fill="currentColor" size={13} />
                  ) : (
                    <Mic size={15} />
                  )}
                </button>
              </div>

              {isDictating ? (
                <div className="flex items-center gap-2 text-xs font-bold text-(--color-tomato-dark)">
                  <span className="flex items-end gap-0.5" aria-hidden="true">
                    <span className="h-2 w-0.5 animate-pulse bg-(--color-tomato)" />
                    <span className="h-3.5 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:120ms]" />
                    <span className="h-2.5 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:240ms]" />
                    <span className="h-4 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:360ms]" />
                  </span>
                  {dictation.status === "connecting" ? "Connecting" : "Listening"}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2 rounded-xl border border-(--color-line) bg-(--color-paper) p-3">
                <div className="inline-flex items-center gap-2 text-[13px] font-extrabold text-(--color-ink)">
                  <ClipboardList size={15} />
                  Known dietary needs
                </div>
                <input
                  className="min-h-10 rounded-lg border border-(--color-line) bg-(--color-panel) px-3 text-[14px] text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setDietary(event.target.value)}
                  placeholder="vegan, gluten-free, nut allergy..."
                  value={dietary}
                />
                <div className="flex flex-wrap gap-1.5">
                  {dietaryPresets.map((preset) => (
                    <button
                      className="rounded-full border border-(--color-line) px-2 py-0.5 text-[11.5px] font-bold text-(--color-fog) hover:border-(--color-sage) hover:text-(--color-sage)"
                      key={preset}
                      onClick={() => appendDietary(preset)}
                      type="button"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-(--color-line) bg-(--color-paper) p-3">
                <div className="inline-flex items-center gap-2 text-[13px] font-extrabold text-(--color-ink)">
                  <Users size={15} />
                  Guest question
                </div>
                <textarea
                  className="min-h-[88px] resize-none rounded-lg border border-(--color-line) bg-(--color-panel) px-3 py-2 text-[14px] text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setGuestQuestion(event.target.value)}
                  value={guestQuestion}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-line) pt-1">
              <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-(--color-fog)">
                <Sparkles size={14} />
                Draft updates stay separate from the recipe.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button onClick={queueDraft} size="sm" variant="secondary">
                  <RefreshCcw size={15} />
                  Update draft
                </Button>
                <Button onClick={() => void copyDraft()} size="sm" variant="secondary">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy draft"}
                </Button>
              </div>
            </div>
          </div>

          <GatheringPreview
            activeTab={activeTab}
            draft={draft}
            drafting={drafting}
            onTabChange={setActiveTab}
          />
        </div>
      )}
    </section>
  );
}

function GatheringStart({
  onStart,
  recipe,
  selectedCount,
}: {
  onStart: () => void;
  recipe: Recipe;
  selectedCount: number;
}) {
  return (
    <div className="grid min-h-[300px] lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
      <div className="grid content-between gap-7 p-5 md:p-6">
        <div className="grid gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--color-line) bg-(--color-paper) px-3 py-1 text-[12px] font-extrabold uppercase tracking-normal text-(--color-sage)">
            <Sparkles size={14} />
            Gathering
          </div>
          <div className="grid max-w-[640px] gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(28px,4vw,44px)] font-bold leading-[1] text-(--color-ink)">
              Turn recipes into a shared table.
            </h2>
            <p className="max-w-[58ch] text-[15px] leading-relaxed text-(--color-fog)">
              Start with the menu, then shape the invite, theme, and guest dietary notes
              in one AI conversation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onStart} variant="primary">
            <Wand2 size={16} />
            Start gathering
          </Button>
          <span className="inline-flex min-h-10 items-center rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[13px] font-bold text-(--color-fog)">
            {selectedCount} recipe selected
          </span>
        </div>
      </div>

      <div className="border-t-2 border-(--color-ink) bg-[linear-gradient(135deg,var(--color-sage-soft),var(--color-paper))] p-5 lg:border-t-0 lg:border-l-2">
        <div className="flex h-full min-h-[240px] flex-col justify-between rounded-xl border-2 border-(--color-ink) bg-(--color-panel) p-4">
          <div className="grid gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-(--color-peach) px-2.5 py-1 text-[12px] font-extrabold text-(--color-tomato-dark)">
              <Utensils size={13} />
              Starter recipe
            </span>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-(--color-ink)">
                {recipe.title}
              </h3>
              {recipe.description ? (
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-(--color-fog)">
                  {recipe.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <MiniArtifact icon={<FileText size={15} />} label="Invite" />
            <MiniArtifact icon={<ClipboardList size={15} />} label="Menu" />
            <MiniArtifact icon={<Users size={15} />} label="Guests" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniArtifact({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="grid min-h-[66px] content-center justify-items-center gap-1 rounded-lg border border-(--color-line) bg-(--color-paper) px-2 text-[12px] font-extrabold text-(--color-ink)">
      {icon}
      {label}
    </span>
  );
}

function GatheringHeader({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="mb-1 inline-flex items-center gap-2 text-[12px] font-extrabold uppercase text-(--color-sage)">
          <Sparkles size={14} />
          Gathering studio
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-(--color-ink)">
          Build the shared page
        </h2>
      </div>
      <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-(--color-line) bg-(--color-paper) px-3 text-[12.5px] font-extrabold text-(--color-fog)">
        <Utensils size={14} />
        {selectedCount} recipe{selectedCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function RecipePicker({
  availableRecipes,
  onToggle,
  selectedRecipeKeys,
}: {
  availableRecipes: Recipe[];
  onToggle: (recipe: Recipe) => void;
  selectedRecipeKeys: string[];
}) {
  const selected = new Set(selectedRecipeKeys);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-[13px] font-extrabold text-(--color-ink)">
          <Utensils size={15} />
          Recipes
        </div>
        <span className="text-[12px] font-bold text-(--color-fog)">
          Choose one or more
        </span>
      </div>
      <div className="grid max-h-[190px] gap-2 overflow-auto pr-1 sm:grid-cols-2">
        {availableRecipes.map((item) => {
          const key = recipeKey(item);
          const isSelected = selected.has(key);
          return (
            <button
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "grid gap-1 rounded-xl border-2 border-(--color-sage) bg-(--color-sage-soft) p-3 text-left text-(--color-ink)"
                  : "grid gap-1 rounded-xl border border-(--color-line) bg-(--color-paper) p-3 text-left text-(--color-ink) hover:border-(--color-ink)"
              }
              key={key}
              onClick={() => onToggle(item)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={
                    isSelected
                      ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-(--color-sage) text-white"
                      : "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-(--color-line) text-transparent"
                  }
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="truncate text-[13.5px] font-extrabold">
                  {item.title}
                </span>
              </span>
              <span className="line-clamp-2 pl-7 text-[12px] leading-snug text-(--color-fog)">
                {item.description || item.servings || "OpenCook recipe"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GatheringPreview({
  activeTab,
  draft,
  drafting,
  onTabChange,
}: {
  activeTab: PreviewTab;
  draft: GatheringDraft;
  drafting: boolean;
  onTabChange: (tab: PreviewTab) => void;
}) {
  return (
    <aside className="relative min-h-[560px] border-t-2 border-(--color-ink) bg-(--color-rail) p-4 md:p-5 lg:border-t-0 lg:border-l-2">
      <div className="sticky top-5 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-[13px] font-extrabold text-(--color-ink)">
            {drafting ? (
              <Loader2 className="animate-spin text-(--color-tomato)" size={15} />
            ) : (
              <Sparkles className="text-(--color-tomato)" size={15} />
            )}
            {drafting ? "Generating gathering" : "Gathering preview"}
          </div>
          <Button disabled size="sm" variant="secondary">
            <Share2 size={15} />
            Create link
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[3px_3px_0_0_var(--color-ink)]">
          <div className="bg-(--color-sage) px-4 py-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-extrabold uppercase">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} />
                Shared gathering
              </span>
              <span>{draft.recipeTitles.length} recipe menu</span>
            </div>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(28px,5vw,42px)] font-bold leading-[0.96]">
              {draft.title}
            </h3>
            <p className="mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-white/85">
              {draft.subtitle}
            </p>
          </div>

          <div className="flex border-b border-(--color-line) bg-(--color-paper) p-1">
            {previewTabs.map((tab) => (
              <button
                aria-pressed={activeTab === tab.id}
                className={
                  activeTab === tab.id
                    ? "flex-1 rounded-md bg-(--color-panel) px-3 py-2 text-[12px] font-extrabold text-(--color-ink) shadow-[inset_0_0_0_1px_var(--color-line)]"
                    : "flex-1 rounded-md px-3 py-2 text-[12px] font-bold text-(--color-fog) hover:bg-(--color-panel) hover:text-(--color-ink)"
                }
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-h-[320px] p-4">
            {drafting ? <DraftingVeil /> : null}
            {activeTab === "invite" ? (
              <InvitePreview draft={draft} />
            ) : activeTab === "menu" ? (
              <MenuPreview draft={draft} />
            ) : (
              <GuestPreview draft={draft} />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[12.5px] font-bold leading-relaxed text-(--color-fog)">
          Guests see the generated gathering and add preferences before the host
          finalises the menu.
        </div>
      </div>
    </aside>
  );
}

function DraftingVeil() {
  return (
    <div className="absolute inset-3 z-10 grid place-items-center rounded-xl border border-(--color-line) bg-[rgba(255,250,243,0.86)] backdrop-blur-[2px]">
      <div className="grid justify-items-center gap-2 text-center">
        <Loader2 className="animate-spin text-(--color-tomato)" size={22} />
        <span className="text-[13px] font-extrabold text-(--color-ink)">
          Drafting invite, menu, and guest questions
        </span>
      </div>
    </div>
  );
}

function InvitePreview({ draft }: { draft: GatheringDraft }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <span className="text-[12px] font-extrabold uppercase text-(--color-tomato-dark)">
          Invite
        </span>
        <h4 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-(--color-ink)">
          {draft.title}
        </h4>
      </div>
      <p className="text-[14px] leading-relaxed text-(--color-ink)">
        {draft.inviteBody}
      </p>
      <div className="grid gap-2 rounded-xl border border-(--color-line) bg-(--color-paper) p-3">
        <span className="text-[12px] font-extrabold uppercase text-(--color-fog)">
          Featured dishes
        </span>
        <div className="flex flex-wrap gap-1.5">
          {draft.recipeTitles.map((title) => (
            <span
              className="rounded-full border border-(--color-line) bg-(--color-panel) px-2.5 py-1 text-[12px] font-bold text-(--color-ink)"
              key={title}
            >
              {title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuPreview({ draft }: { draft: GatheringDraft }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <span className="text-[12px] font-extrabold uppercase text-(--color-sage)">
          Menu
        </span>
        <p className="text-[14px] leading-relaxed text-(--color-ink)">
          {draft.menuIntro}
        </p>
      </div>
      <ol className="grid gap-2">
        {draft.recipeTitles.map((title, index) => (
          <li
            className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-xl border border-(--color-line) bg-(--color-paper) p-3"
            key={title}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-(--color-ink) font-[family-name:var(--font-display)] text-sm font-bold text-(--color-ink)">
              {index + 1}
            </span>
            <span className="grid gap-1">
              <strong className="text-[14px] text-(--color-ink)">{title}</strong>
              <span className="text-[12.5px] leading-snug text-(--color-fog)">
                Matched to the gathering tone and guest notes.
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="rounded-xl border border-(--color-line) bg-(--color-sage-soft) px-3 py-2 text-[12.5px] font-bold leading-relaxed text-(--color-sage)">
        {draft.dietaryLine}
      </p>
    </div>
  );
}

function GuestPreview({ draft }: { draft: GatheringDraft }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <span className="text-[12px] font-extrabold uppercase text-(--color-royal)">
          Guest preferences
        </span>
        <p className="text-[14px] leading-relaxed text-(--color-ink)">
          {draft.guestQuestion}
        </p>
      </div>
      <div className="grid gap-2">
        <PreviewField label="Name" value="Alex" />
        <PreviewField label="Dietary needs" value="No peanuts, prefers mild heat" />
        <PreviewField label="Notes for the host" value={draft.hostNote} />
      </div>
      <Button disabled fullWidth variant="primary">
        <Send size={15} />
        Send preferences
      </Button>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-(--color-line) bg-(--color-paper) p-3">
      <span className="text-[11.5px] font-extrabold uppercase text-(--color-fog)">
        {label}
      </span>
      <span className="text-[13.5px] text-(--color-ink)">{value}</span>
    </div>
  );
}

function uniqueRecipes(current: Recipe, recipes: Recipe[]) {
  const byKey = new Map<string, Recipe>();
  byKey.set(recipeKey(current), current);
  for (const item of recipes) {
    byKey.set(recipeKey(item), item);
  }
  return Array.from(byKey.values());
}

function recipeKey(recipe: Recipe) {
  return recipe.id || `${recipe.title}-${recipe.createdAt}`;
}

function buildGatheringDraft({
  dietary,
  guestQuestion,
  prompt,
  recipes,
}: {
  dietary: string;
  guestQuestion: string;
  prompt: string;
  recipes: Recipe[];
}): GatheringDraft {
  const recipeTitles = recipes.map((item) => item.title);
  const mainRecipe = recipeTitles[0] ?? "the menu";
  const extraCount = Math.max(0, recipeTitles.length - 1);
  const direction = prompt.trim();
  const lowerDirection = direction.toLowerCase();
  const tone = gatheringTone(lowerDirection);
  const dietaryText = dietary.trim();
  const dishLine =
    extraCount > 0
      ? `${mainRecipe} plus ${extraCount} more dish${extraCount === 1 ? "" : "es"}`
      : mainRecipe;

  return {
    dietaryLine: dietaryText
      ? `Known needs: ${dietaryText}. Guests can add their own before you finalise the menu.`
      : "Guests can add allergies, dislikes, and dietary needs before you finalise the menu.",
    guestQuestion: guestQuestion.trim() || "Tell us anything we should avoid or adapt.",
    hostNote: dietaryText
      ? `Host sees ${dietaryText} beside the menu before shopping.`
      : "Host sees each response beside the menu before shopping.",
    inviteBody: `${tone.inviteLead} The table is built around ${dishLine}. ${tone.inviteClose}`,
    menuIntro: `${tone.menuLead} ${recipeTitles.join(", ")}.`,
    recipeTitles,
    subtitle: `${tone.subtitle} Built from ${recipeTitles.length} recipe${
      recipeTitles.length === 1 ? "" : "s"
    } with guest preferences collected in the same place.`,
    title: tone.title,
    toneLabel: tone.label,
  };
}

function gatheringTone(direction: string) {
  if (direction.includes("dragon")) {
    return {
      inviteClose:
        "Expect bold names, a little theatre, and food that still makes sense.",
      inviteLead: "You are invited to a firelit feast.",
      label: "Dragon theme",
      menuLead: "A dramatic menu with storybook names:",
      subtitle: "A dragon-table gathering.",
      title: "Dragon Table",
    };
  }

  if (
    direction.includes("children") ||
    direction.includes("child") ||
    direction.includes("kid")
  ) {
    return {
      inviteClose: "The wording stays playful, clear, and easy for families to answer.",
      inviteLead: "Bring small appetites and big opinions.",
      label: "Children first",
      menuLead: "A friendly menu with simple dish names:",
      subtitle: "A gathering shaped for children and families.",
      title: "Little Table",
    };
  }

  if (direction.includes("formal") || direction.includes("printed")) {
    return {
      inviteClose:
        "The copy is polished enough to print, forward, or place at the table.",
      inviteLead: "Please join us for a composed supper.",
      label: "Formal menu",
      menuLead: "A restrained printed menu featuring:",
      subtitle: "A refined gathering page.",
      title: "Supper Menu",
    };
  }

  if (direction.includes("garden") || direction.includes("birthday")) {
    return {
      inviteClose: "The page keeps the tone bright, relaxed, and easy to share.",
      inviteLead: "Come over for a sunny table and a generous plate.",
      label: "Garden gathering",
      menuLead: "A bright menu for sharing:",
      subtitle: "A relaxed outdoor-style gathering.",
      title: "Garden Table",
    };
  }

  return {
    inviteClose: "Reply with anything the host should know before the menu is final.",
    inviteLead: "You are invited to share a meal.",
    label: "Warm and simple",
    menuLead: "A clear menu built from:",
    subtitle: "A shareable gathering page.",
    title: "Shared Table",
  };
}

function formatGatheringDraft(draft: GatheringDraft) {
  return [
    draft.title,
    draft.subtitle,
    "",
    "Invite",
    draft.inviteBody,
    "",
    "Menu",
    ...draft.recipeTitles.map((title, index) => `${index + 1}. ${title}`),
    "",
    "Guest preferences",
    draft.guestQuestion,
    draft.dietaryLine,
  ].join("\n");
}
