import { recipeSearchText, type Recipe } from "@open-cook/core";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Image as ImageIcon,
  Loader2,
  Mail,
  Mic,
  Search,
  Send,
  Sparkles,
  Square,
  UserPlus,
  Users,
  Utensils,
  Video,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type ReactNode,
  type UIEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type GatheringArtifactId,
  type GatheringArtifactJob,
  type GatheringDraftResult,
  type PublishGatheringPayload,
  type PublishGatheringResult,
} from "../api";
import { displayImageUrl } from "../imageDisplayUrl";
import { errorMessage, recipeImagesOf } from "../lib/recipe";
import { useDictation } from "../lib/useDictation";
import { Button } from "../ui";

export type GatheringBuildRequest = {
  dietary: string;
  guestQuestion: string;
  inviteeEmails: string;
  prompt: string;
  title: string;
};

type GenerationArtifact = {
  description: string;
  Icon: LucideIcon;
  id: GatheringArtifactId | "guest-page";
  label: string;
};

type GenerationArtifactStatus =
  | "active"
  | "done"
  | "failed"
  | "ready"
  | "skipped"
  | "submitted"
  | "waiting";

export const defaultGatheringBuildRequest: GatheringBuildRequest = {
  dietary: "",
  guestQuestion: "Tell us anything we should avoid or adapt.",
  inviteeEmails: "",
  prompt: "Make it warm, simple, and easy to share.",
  title: "",
};

export const gatheringRecipeAutoPickCount = 4;
export const gatheringRecipePickerPageSize = 14;
const gatheringRecipePickerScrollThresholdPx = 80;

export function gatheringRecipePickerMatches(recipes: Recipe[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery
    ? recipes.filter((item) =>
        recipeSearchText(item).toLowerCase().includes(normalizedQuery),
      )
    : recipes;
}

export function nextGatheringRecipePickerCount(
  currentCount: number,
  totalCount: number,
) {
  return Math.min(totalCount, currentCount + gatheringRecipePickerPageSize);
}

export function gatheringRecipePickerAutoPickIds(
  recipes: Recipe[],
  count = gatheringRecipeAutoPickCount,
) {
  return recipes.slice(0, Math.max(0, count)).map((recipe) => recipe.id);
}

const directionPresets = [
  "dragon banquet",
  "garden birthday lunch",
  "cinematic invite",
  "customised for children",
  "formal printed menu",
  "make allergies prominent",
];

const dietaryPresets = [
  "vegetarian guest",
  "gluten-free option",
  "nut allergy",
  "no pork",
  "kid-friendly portions",
];

const generationArtifacts: GenerationArtifact[] = [
  {
    description: "Preparing dish image prompts and the menu image set.",
    Icon: ImageIcon,
    id: "menu-images",
    label: "Menu images",
  },
  {
    description: "Preparing the cover, invite art, and share-page visuals.",
    Icon: Sparkles,
    id: "page-artwork",
    label: "Page artwork",
  },
  {
    description: "Preparing a welcome audio intro guests can play.",
    Icon: Volume2,
    id: "voiceover",
    label: "Welcome audio",
  },
  {
    description: "Preparing a short motion teaser for sharing.",
    Icon: Video,
    id: "video-teaser",
    label: "Video teaser",
  },
  {
    description: "Packaging guest questions with the final page assets.",
    Icon: Users,
    id: "guest-page",
    label: "Guest page",
  },
];

export function GatheringPage({
  initialRequest = defaultGatheringBuildRequest,
  onBackToRecipes,
  onClear,
  onGenerate,
  onToggleRecipe,
  recipes,
  selectedRecipeIds,
  selectedRecipes,
}: {
  initialRequest?: GatheringBuildRequest;
  onBackToRecipes: () => void;
  onClear: () => void;
  onGenerate: (request: GatheringBuildRequest) => void;
  onToggleRecipe: (recipe: Recipe) => void;
  recipes: Recipe[];
  selectedRecipeIds: string[];
  selectedRecipes: Recipe[];
}) {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState(initialRequest.title);
  const [prompt, setPrompt] = useState(initialRequest.prompt);
  const [dietary, setDietary] = useState(initialRequest.dietary);
  const [guestQuestion, setGuestQuestion] = useState(initialRequest.guestQuestion);
  const [inviteeEmails, setInviteeEmails] = useState(initialRequest.inviteeEmails);
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(
    gatheringRecipePickerPageSize,
  );
  const dictation = useDictation();
  const dictationBaseRef = useRef("");
  const isDictating =
    dictation.status === "listening" || dictation.status === "connecting";

  useEffect(() => {
    setVisibleRecipeCount(gatheringRecipePickerPageSize);
  }, [query, recipes]);

  useEffect(() => {
    if (dictation.status === "listening" || dictation.status === "connecting") {
      const base = dictationBaseRef.current;
      setPrompt(base ? `${base} ${dictation.liveText}`.trim() : dictation.liveText);
    }
  }, [dictation.liveText, dictation.status]);

  const selectedKeySet = useMemo(() => new Set(selectedRecipeIds), [selectedRecipeIds]);
  const matchingRecipes = useMemo(
    () => gatheringRecipePickerMatches(recipes, query),
    [query, recipes],
  );
  const filteredRecipes = useMemo(() => {
    return matchingRecipes.slice(0, visibleRecipeCount);
  }, [matchingRecipes, visibleRecipeCount]);
  const hasMoreRecipes = filteredRecipes.length < matchingRecipes.length;
  const canMakePage = selectedRecipes.length > 0;
  const selectedRecipeLabel = `${selectedRecipes.length} recipe${
    selectedRecipes.length === 1 ? "" : "s"
  } selected`;

  function appendDirection(value: string) {
    setPrompt((current) => (current.trim() ? `${current.trim()}; ${value}` : value));
  }

  function appendDietary(value: string) {
    setDietary((current) => (current.trim() ? `${current.trim()}, ${value}` : value));
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

  function showMoreRecipes() {
    setVisibleRecipeCount((current) =>
      nextGatheringRecipePickerCount(current, matchingRecipes.length),
    );
  }

  function handleRecipePickerScroll(event: UIEvent<HTMLDivElement>) {
    if (!hasMoreRecipes) {
      return;
    }

    const list = event.currentTarget;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (distanceFromBottom <= gatheringRecipePickerScrollThresholdPx) {
      showMoreRecipes();
    }
  }

  function makeSharePage() {
    if (!canMakePage) return;

    onGenerate({
      dietary: dietary.trim(),
      guestQuestion: guestQuestion.trim() || defaultGatheringBuildRequest.guestQuestion,
      inviteeEmails: inviteeEmails.trim(),
      prompt: prompt.trim() || defaultGatheringBuildRequest.prompt,
      title: title.trim(),
    });
  }

  return (
    <section className="col-[1/-1] overflow-auto bg-(--color-canvas) max-[980px]:col-[1]">
      <div className="mx-auto grid w-full max-w-[820px] gap-5 px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={onBackToRecipes} size="sm" variant="ghost">
            <ArrowLeft size={16} />
            Recipes
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selectedRecipes.length ? (
              <span className="rounded-full border border-(--color-line) bg-(--color-panel) px-3 py-2 text-[12.5px] font-extrabold text-(--color-fog)">
                {selectedRecipeLabel}
              </span>
            ) : null}
            <Button
              disabled={selectedRecipes.length === 0}
              onClick={onClear}
              size="sm"
              variant="secondary"
            >
              Clear
            </Button>
            <Button
              disabled={!canMakePage}
              onClick={makeSharePage}
              size="sm"
              variant="primary"
            >
              <Sparkles size={15} />
              Create page
            </Button>
          </div>
        </div>

        <header className="rounded-3xl border border-(--color-line) bg-(--color-panel) p-5 shadow-workspace md:p-6">
          <div className="grid gap-2">
            <div className="inline-flex w-fit items-center gap-2 text-[12px] font-extrabold uppercase text-(--color-sage)">
              <Sparkles size={14} />
              Gathering
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(34px,7vw,58px)] font-bold leading-[0.94] text-(--color-ink)">
              Create a gathering page
            </h2>
            <p className="m-0 max-w-[54ch] text-[15px] font-semibold leading-relaxed text-(--color-fog)">
              Choose the recipes, add the guest notes, then review the page before you
              publish or send invitations.
            </p>
          </div>
        </header>

        <section className="grid gap-4 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) p-4 shadow-[4px_4px_0_0_var(--color-ink)] md:p-5">
          <StepHeader icon={<Utensils size={15} />} kicker="1" title="Choose recipes" />

          {selectedRecipes.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedRecipes.map((recipe) => (
                <button
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-(--color-sage-line) bg-(--color-sage-soft) py-1 pr-2.5 pl-1 text-[12px] font-extrabold text-(--color-sage) hover:border-(--color-sage)"
                  key={recipe.id}
                  onClick={() => onToggleRecipe(recipe)}
                  type="button"
                >
                  <RecipePillThumb recipe={recipe} />
                  <span className="truncate">{recipe.title}</span>
                  <X size={13} strokeWidth={3} />
                </button>
              ))}
            </div>
          ) : (
            <p className="m-0 rounded-xl border border-dashed border-(--color-line) bg-(--color-paper) p-3 text-[13px] font-bold leading-relaxed text-(--color-fog)">
              Start with one recipe. You can add more for a full menu.
            </p>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--color-fog)"
              size={15}
            />
            <input
              className="min-h-12 w-full rounded-xl border-2 border-(--color-line) bg-(--color-paper) pr-3 pl-9 text-[15px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search recipes"
              value={query}
            />
          </div>

          <div
            className="grid max-h-[460px] gap-2 overflow-auto pr-1"
            onScroll={handleRecipePickerScroll}
          >
            {filteredRecipes.map((item) => {
              const isSelected = selectedKeySet.has(item.id);
              return (
                <button
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "grid min-h-[82px] grid-cols-[62px_minmax(0,1fr)_32px] items-center gap-3 rounded-xl border-2 border-(--color-sage) bg-(--color-sage-soft) p-2.5 text-left text-(--color-ink)"
                      : "grid min-h-[82px] grid-cols-[62px_minmax(0,1fr)_32px] items-center gap-3 rounded-xl border border-(--color-line) bg-(--color-paper) p-2.5 text-left text-(--color-ink) hover:border-(--color-ink)"
                  }
                  key={item.id}
                  onClick={() => onToggleRecipe(item)}
                  type="button"
                >
                  <RecipeCardThumb recipe={item} selected={isSelected} />
                  <span className="grid min-w-0 gap-1">
                    <span className="line-clamp-2 text-[15px] font-extrabold leading-tight">
                      {item.title}
                    </span>
                    <span className="line-clamp-1 text-[13px] leading-snug text-(--color-fog)">
                      {item.description || item.servings || "OpenCook recipe"}
                    </span>
                  </span>
                  <span
                    className={
                      isSelected
                        ? "grid size-8 place-items-center rounded-lg bg-(--color-sage) text-white"
                        : "grid size-8 place-items-center rounded-lg border border-(--color-line) text-transparent"
                    }
                  >
                    <Check size={17} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
            {hasMoreRecipes ? (
              <button
                className="min-h-11 rounded-lg border border-dashed border-(--color-line) bg-(--color-paper) px-3 text-[13px] font-extrabold text-(--color-fog) hover:border-(--color-ink) hover:text-(--color-ink)"
                onClick={showMoreRecipes}
                type="button"
              >
                Load more recipes
              </button>
            ) : null}
            {matchingRecipes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-(--color-line) bg-(--color-paper) p-4 text-[13px] font-bold text-(--color-fog)">
                No recipes match that search.
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-(--color-line) bg-(--color-panel) p-4 md:p-5">
          <StepHeader icon={<Sparkles size={15} />} kicker="2" title="Set the tone" />

          <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
            Page title
            <input
              className="min-h-11 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Saturday supper, birthday lunch..."
              value={title}
            />
          </label>

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
              className="min-h-[132px] w-full resize-y rounded-xl border-2 border-(--color-line) bg-(--color-paper) px-3 py-3 pr-12 text-[15px] leading-relaxed text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: make it playful for children, with a dragon theme."
              value={prompt}
            />
            <button
              aria-label={isDictating ? "Stop dictation" : "Dictate with your voice"}
              className={
                isDictating
                  ? "absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)"
                  : "absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-(--color-ink) bg-(--color-panel) text-(--color-ink) hover:bg-(--color-peach)"
              }
              onClick={toggleMic}
              type="button"
            >
              {dictation.status === "connecting" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : isDictating ? (
                <Square fill="currentColor" size={14} />
              ) : (
                <Mic size={16} />
              )}
            </button>
          </div>

          {isDictating || dictation.error ? (
            <div
              className={
                dictation.error
                  ? "text-xs font-bold text-(--color-tomato-dark)"
                  : "flex items-center gap-2 text-xs font-bold text-(--color-tomato-dark)"
              }
            >
              {dictation.error ? (
                dictation.error
              ) : (
                <>
                  <span className="flex items-end gap-0.5" aria-hidden="true">
                    <span className="h-2 w-0.5 animate-pulse bg-(--color-tomato)" />
                    <span className="h-3.5 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:120ms]" />
                    <span className="h-2.5 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:240ms]" />
                    <span className="h-4 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:360ms]" />
                  </span>
                  {dictation.status === "connecting" ? "Connecting" : "Listening"}
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-2xl border border-(--color-line) bg-(--color-panel) p-4 md:p-5">
          <StepHeader icon={<Users size={15} />} kicker="3" title="Add guest notes" />

          <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
            Dietary needs you already know
            <input
              className="min-h-11 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
              onChange={(event) => setDietary(event.target.value)}
              placeholder="vegan, gluten-free, nut allergy..."
              value={dietary}
            />
          </label>

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

          <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
            Question for guests
            <textarea
              className="min-h-[92px] resize-none rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
              onChange={(event) => setGuestQuestion(event.target.value)}
              value={guestQuestion}
            />
          </label>

          <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
            Invitee emails
            <textarea
              className="min-h-[108px] resize-y rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
              onChange={(event) => setInviteeEmails(event.target.value)}
              placeholder="name@example.com, friend@example.com"
              value={inviteeEmails}
            />
          </label>
        </section>

        <section className="grid gap-3 rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fffdf8,#fff2c9_58%,#e7f0df)] p-4 shadow-[4px_4px_0_0_var(--color-ink)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-(--color-ink) bg-(--color-panel) text-(--color-tomato) shadow-[2px_2px_0_0_var(--color-ink)]">
              <Sparkles size={19} />
            </span>
            <span className="grid gap-1">
              <strong className="text-[16px] font-black leading-tight text-(--color-ink)">
                Ready to review?
              </strong>
              <span className="text-[13px] font-bold leading-relaxed text-(--color-fog)">
                {canMakePage
                  ? `${selectedRecipeLabel}. OpenCook will prepare a draft page you can edit before publishing.`
                  : "Choose at least one recipe to create a gathering page."}
              </span>
            </span>
          </div>
          <Button
            disabled={!canMakePage}
            onClick={makeSharePage}
            size="lg"
            variant="primary"
          >
            <Sparkles size={17} />
            Create gathering page
          </Button>
        </section>
      </div>
    </section>
  );
}

export function GatheringGenerationPage({
  onGenerateDraft,
  onBackToRecipes,
  onBackToSetup,
  onPublish,
  request,
  selectedRecipes,
}: {
  onGenerateDraft: (
    request: GatheringBuildRequest,
    selectedRecipes: Recipe[],
  ) => Promise<GatheringDraftResult>;
  onBackToRecipes: () => void;
  onBackToSetup: () => void;
  onPublish: (payload: PublishGatheringPayload) => Promise<PublishGatheringResult>;
  request: GatheringBuildRequest;
  selectedRecipes: Recipe[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [artifactError, setArtifactError] = useState("");
  const [artifactJobs, setArtifactJobs] = useState<GatheringArtifactJob[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(true);
  const [draft, setDraft] = useState<GatheringDraftResult | null>(null);
  const [title, setTitle] = useState(request.title);
  const [welcome, setWelcome] = useState("");
  const [guestQuestion, setGuestQuestion] = useState(request.guestQuestion);
  const [inviteeEmails, setInviteeEmails] = useState(request.inviteeEmails);
  const [statusMessage, setStatusMessage] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [draftLoading, setDraftLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const activeArtifact =
    generationArtifacts[Math.min(activeIndex, generationArtifacts.length - 1)] ??
    generationArtifacts[0]!;
  const complete = Boolean(draft) && !draftLoading && !artifactLoading;
  const progress = Math.round(
    (Math.min(
      complete ? generationArtifacts.length : activeIndex + 1,
      generationArtifacts.length,
    ) /
      generationArtifacts.length) *
      100,
  );
  const progressWidthClassName =
    ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][
      Math.min(
        complete ? generationArtifacts.length - 1 : activeIndex,
        generationArtifacts.length - 1,
      )
    ] ?? "w-1/5";
  const inviteeEmailList = useMemo(
    () => parseInviteeEmails(inviteeEmails),
    [inviteeEmails],
  );
  const invalidEmails = useMemo(
    () => inviteeEmailList.filter((email) => !looksLikeEmail(email)),
    [inviteeEmailList],
  );
  const artifactJobsById = useMemo(
    () =>
      new Map<GatheringArtifactId, GatheringArtifactJob>(
        artifactJobs.map((job) => [job.id, job]),
      ),
    [artifactJobs],
  );
  const canPublish =
    Boolean(title.trim()) &&
    Boolean(welcome.trim()) &&
    Boolean(guestQuestion.trim()) &&
    selectedRecipes.length > 0 &&
    invalidEmails.length === 0 &&
    !publishing &&
    !draftLoading &&
    !publishedUrl;

  useEffect(() => {
    let active = true;

    setActiveIndex(0);
    setArtifactError("");
    setArtifactJobs([]);
    setArtifactLoading(true);
    setDraft(null);
    setDraftLoading(true);
    setPublishedUrl("");
    setStatusMessage("");
    setTitle(request.title);
    setWelcome("");
    setGuestQuestion(request.guestQuestion);
    setInviteeEmails(request.inviteeEmails);

    const progressTimer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= generationArtifacts.length - 1) {
          return current;
        }
        return current + 1;
      });
    }, 950);

    void (async () => {
      try {
        const result = await onGenerateDraft(request, selectedRecipes);
        if (!active) return;
        setDraft(result);
        setTitle(result.title);
        setWelcome(result.welcome);
        setGuestQuestion(result.guestQuestion);
        setActiveIndex(generationArtifacts.length - 1);
      } catch (error) {
        if (!active) return;
        setStatusMessage(`Generating page copy failed: ${errorMessage(error)}`);
      } finally {
        if (active) {
          setDraftLoading(false);
          setArtifactLoading(false);
        }
        window.clearInterval(progressTimer);
      }
    })();

    return () => {
      active = false;
      window.clearInterval(progressTimer);
    };
  }, [
    onGenerateDraft,
    request.dietary,
    request.guestQuestion,
    request.inviteeEmails,
    request.prompt,
    request.title,
    selectedRecipes,
  ]);

  async function publish() {
    if (!canPublish) {
      if (invalidEmails.length) {
        setStatusMessage(`Check ${invalidEmails[0]}.`);
      }
      return;
    }

    setPublishing(true);
    setStatusMessage("Publishing and starting AI generation");
    try {
      const result = await onPublish({
        dietary: request.dietary || undefined,
        guestQuestion: guestQuestion.trim(),
        inviteeEmails: inviteeEmailList,
        prompt: request.prompt || undefined,
        recipeIds: selectedRecipes.map((recipe) => recipe.id),
        title: title.trim(),
        welcome: welcome.trim(),
      });
      setPublishedUrl(result.url);
      setStatusMessage(
        inviteeEmailList.length
          ? `Published and sent to ${inviteeEmailList.length} invitee${
              inviteeEmailList.length === 1 ? "" : "s"
            }.`
          : "Published.",
      );
    } catch (error) {
      setStatusMessage(`Publishing failed: ${errorMessage(error)}`);
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishedUrl() {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setStatusMessage("Link copied.");
  }

  return (
    <section className="col-[1/-1] overflow-auto bg-(--color-canvas) max-[980px]:col-[1]">
      <div className="mx-auto grid w-full max-w-[780px] gap-5 px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={onBackToSetup} size="sm" variant="ghost">
            <ArrowLeft size={16} />
            Edit
          </Button>
          <Button onClick={onBackToRecipes} size="sm" variant="secondary">
            Recipes
          </Button>
        </div>

        <section className="grid gap-6 rounded-3xl border-2 border-(--color-ink) bg-(--color-panel) p-5 shadow-[5px_5px_0_0_var(--color-ink)] md:p-7">
          <div className="grid gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--color-sage-line) bg-(--color-sage-soft) px-3 py-1 text-[12px] font-extrabold uppercase text-(--color-sage)">
              {complete ? (
                <Check size={14} strokeWidth={3} />
              ) : (
                <Loader2 className="animate-spin" size={14} />
              )}
              {complete ? "Ready" : "Generating"}
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(34px,7vw,62px)] font-bold leading-[0.94] text-(--color-ink)">
              {publishedUrl
                ? "Gathering published"
                : complete
                  ? "Review the page"
                  : "Creating gathering page"}
            </h2>
            <p className="m-0 max-w-[54ch] text-[15px] font-semibold leading-relaxed text-(--color-fog)">
              {publishedUrl
                ? "Everyone has the same gathering page."
                : complete
                  ? "Edit the welcome before publishing and sending invitations."
                  : activeArtifact.description}
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-[12px] font-extrabold uppercase text-(--color-fog)">
              <span>{complete ? "Final package" : activeArtifact.label}</span>
              <span>{progress}%</span>
            </div>
            <div
              aria-label="Artifact generation progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="h-3 overflow-hidden rounded-full border border-(--color-line) bg-(--color-paper)"
              role="progressbar"
            >
              <div
                className={`${progressWidthClassName} h-full rounded-full bg-(--color-tomato) transition-all duration-500`}
              />
            </div>
          </div>

          <div className="grid gap-2">
            {generationArtifacts.map((artifact, index) => {
              const job =
                artifact.id === "guest-page"
                  ? undefined
                  : artifactJobsById.get(artifact.id);
              const status =
                job?.status === "failed" ||
                job?.status === "ready" ||
                job?.status === "skipped" ||
                job?.status === "submitted"
                  ? job.status
                  : artifactError && artifact.id !== "guest-page"
                    ? "failed"
                    : complete || index < activeIndex
                      ? "done"
                      : index === activeIndex && !complete
                        ? "active"
                        : "waiting";
              return (
                <GenerationArtifactRow
                  artifact={artifact}
                  job={job}
                  key={artifact.label}
                  status={status}
                />
              );
            })}
          </div>

          {artifactError ? (
            <p className="m-0 rounded-xl bg-[color-mix(in_oklch,var(--color-tomato)_10%,white)] px-3 py-2 text-[12.5px] font-bold leading-relaxed text-(--color-tomato-dark)">
              {artifactError}
            </p>
          ) : null}

          {complete ? (
            <div className="grid gap-4 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-(--color-sage-line) bg-(--color-sage-soft) px-3 py-1 text-[12px] font-extrabold uppercase text-(--color-sage)">
                  <Sparkles size={14} />
                  {draft?.provider.provider === "workers-ai" ? "AI draft" : "Draft"}
                </span>
                <span className="text-[12px] font-bold text-(--color-fog)">
                  {inviteeEmailList.length} invitee
                  {inviteeEmailList.length === 1 ? "" : "s"}
                </span>
              </div>

              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Page title
                <input
                  className="min-h-11 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>

              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Welcome
                <textarea
                  className="min-h-[150px] resize-y rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[14px] font-semibold leading-relaxed text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setWelcome(event.target.value)}
                  value={welcome}
                />
              </label>

              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Guest question
                <textarea
                  className="min-h-[82px] resize-none rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setGuestQuestion(event.target.value)}
                  value={guestQuestion}
                />
              </label>

              <InviteeEmailEditor
                invalidEmails={invalidEmails}
                onChange={setInviteeEmails}
                value={inviteeEmails}
              />

              {invalidEmails.length ? (
                <p className="m-0 rounded-lg bg-[color-mix(in_oklch,var(--color-tomato)_10%,white)] px-3 py-2 text-[12.5px] font-bold text-(--color-tomato-dark)">
                  Check {invalidEmails[0]}.
                </p>
              ) : null}

              {publishedUrl ? (
                <div className="grid gap-2 rounded-xl border border-(--color-line) bg-(--color-paper) p-3">
                  <span className="text-[12px] font-extrabold uppercase text-(--color-fog)">
                    Shared link
                  </span>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      className="min-h-10 min-w-0 rounded-lg border border-(--color-line) bg-(--color-panel) px-3 text-[13px] font-semibold text-(--color-ink)"
                      readOnly
                      value={publishedUrl}
                    />
                    <Button onClick={() => void copyPublishedUrl()} size="sm">
                      <Clipboard size={15} />
                      Copy
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-line) pt-3">
                <div className="inline-flex items-center gap-2 text-[12.5px] font-bold text-(--color-fog)">
                  <Mail size={15} />
                  <span>{statusMessage || "Ready to publish"}</span>
                </div>
                <Button
                  disabled={!canPublish}
                  onClick={() => void publish()}
                  size="lg"
                  variant="primary"
                >
                  {publishing ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Send size={17} />
                  )}
                  Publish gathering
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-(--color-line) bg-(--color-paper) p-4">
            <span className="text-[12px] font-extrabold uppercase text-(--color-fog)">
              Menu
            </span>
            <div className="grid gap-2">
              {selectedRecipes.map((recipe) => (
                <div
                  className="grid min-h-[60px] grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-(--color-line) bg-(--color-panel) p-2"
                  key={recipe.id}
                >
                  <RecipePillThumb recipe={recipe} />
                  <span className="line-clamp-2 text-[13.5px] font-extrabold leading-tight text-(--color-ink)">
                    {recipe.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border border-(--color-line) bg-(--color-paper) p-4">
            <span className="text-[12px] font-extrabold uppercase text-(--color-fog)">
              Note for guests
            </span>
            <p className="m-0 text-[14px] font-semibold leading-relaxed text-(--color-ink)">
              {request.prompt || defaultGatheringBuildRequest.prompt}
            </p>
            {request.dietary ? (
              <p className="m-0 rounded-lg bg-(--color-sage-soft) px-2.5 py-2 text-[12.5px] font-bold leading-relaxed text-(--color-sage)">
                Dietary notes: {request.dietary}
              </p>
            ) : null}
            <p className="m-0 text-[13px] font-semibold leading-relaxed text-(--color-fog)">
              Guests will be asked:{" "}
              {request.guestQuestion || defaultGatheringBuildRequest.guestQuestion}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

function parseInviteeEmails(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatInviteeEmails(emails: string[]) {
  return parseInviteeEmails(emails.join("\n")).join("\n");
}

function InviteeEmailEditor({
  invalidEmails,
  onChange,
  value,
}: {
  invalidEmails: string[];
  onChange: (value: string) => void;
  value: string;
}) {
  const inputId = useId();
  const [draftEmail, setDraftEmail] = useState("");
  const emails = useMemo(() => parseInviteeEmails(value), [value]);
  const invalidEmailSet = useMemo(() => new Set(invalidEmails), [invalidEmails]);
  const hasInvalidEmail = invalidEmails.length > 0;

  function commitEmails(rawValue = draftEmail) {
    const nextEmails = parseInviteeEmails(rawValue);
    if (nextEmails.length === 0) return;

    onChange(formatInviteeEmails([...emails, ...nextEmails]));
    setDraftEmail("");
  }

  function removeEmail(email: string) {
    onChange(formatInviteeEmails(emails.filter((item) => item !== email)));
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className="text-[13px] font-extrabold text-(--color-ink)"
          htmlFor={inputId}
        >
          Invitee emails
        </label>
        <span
          className={
            hasInvalidEmail
              ? "rounded-full border border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_8%,white)] px-2 py-0.5 text-[11.5px] font-extrabold text-(--color-tomato-dark)"
              : "rounded-full border border-(--color-line) bg-(--color-paper) px-2 py-0.5 text-[11.5px] font-extrabold text-(--color-fog)"
          }
        >
          {emails.length} invitee{emails.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className={
          hasInvalidEmail
            ? "rounded-lg border-2 border-(--color-tomato) bg-(--color-paper) p-2"
            : "rounded-lg border border-(--color-line) bg-(--color-paper) p-2 focus-within:border-(--color-ink)"
        }
      >
        <div className="flex min-h-[94px] flex-wrap content-start items-start gap-2">
          {emails.map((email) => {
            const invalid = invalidEmailSet.has(email);
            return (
              <span
                className={
                  invalid
                    ? "inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_8%,white)] py-1 pr-1 pl-2 text-[12.5px] font-extrabold text-(--color-tomato-dark)"
                    : "inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--color-sage-line) bg-(--color-sage-soft) py-1 pr-1 pl-2 text-[12.5px] font-extrabold text-(--color-sage)"
                }
                key={email}
              >
                <Mail className="shrink-0" size={13} />
                <span className="max-w-[230px] truncate">{email}</span>
                <button
                  aria-label={`Remove ${email}`}
                  className={
                    invalid
                      ? "grid size-6 shrink-0 place-items-center rounded-full text-(--color-tomato-dark) hover:bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)]"
                      : "grid size-6 shrink-0 place-items-center rounded-full text-(--color-sage) hover:bg-(--color-panel)"
                  }
                  onClick={() => removeEmail(email)}
                  onMouseDown={(event) => event.preventDefault()}
                  title="Remove invitee"
                  type="button"
                >
                  <X size={13} strokeWidth={3} />
                </button>
              </span>
            );
          })}

          <div className="flex min-h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-dashed border-(--color-line) bg-(--color-panel) px-2">
            <Mail className="shrink-0 text-(--color-fog)" size={15} />
            <input
              className="min-h-9 min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog)"
              id={inputId}
              onBlur={() => commitEmails()}
              onChange={(event) => setDraftEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "," || event.key === ";") {
                  event.preventDefault();
                  commitEmails();
                }
              }}
              onPaste={(event) => {
                const pastedText = event.clipboardData.getData("text");
                if (!pastedText.trim()) return;

                event.preventDefault();
                commitEmails(`${draftEmail} ${pastedText}`);
              }}
              placeholder="name@example.com"
              value={draftEmail}
            />
            <button
              aria-label="Add invitee"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-(--color-line) bg-(--color-paper) text-(--color-ink) transition enabled:hover:border-(--color-ink) enabled:hover:bg-(--color-peach) disabled:opacity-45"
              disabled={!draftEmail.trim()}
              onClick={() => commitEmails()}
              onMouseDown={(event) => event.preventDefault()}
              title="Add invitee"
              type="button"
            >
              <UserPlus size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerationArtifactRow({
  artifact,
  job,
  status,
}: {
  artifact: GenerationArtifact;
  job?: GatheringArtifactJob;
  status: GenerationArtifactStatus;
}) {
  const Icon = artifact.Icon;
  const audioUrl =
    status === "ready" && artifact.id === "voiceover" ? job?.audioUrl : undefined;
  const detail =
    job?.status === "ready"
      ? `${job.provider === "elevenlabs" ? "Generated with ElevenLabs" : "Generated"}${
          job.model ? ` (${job.model})` : ""
        }`
      : job?.status === "submitted"
        ? `${job.model ? `Submitted to ${job.model}` : "Submitted"}${
            job.requestId ? ` (${job.requestId.slice(0, 8)})` : ""
          }`
        : job?.error ||
          (status === "failed" ? "Submission failed." : artifact.description);
  const badgeLabel =
    status === "done"
      ? "Done"
      : status === "active"
        ? "Now"
        : status === "ready"
          ? "Ready"
          : status === "submitted"
            ? "Submitted"
            : status === "failed"
              ? "Failed"
              : status === "skipped"
                ? "Skipped"
                : "Queued";

  return (
    <div
      className={
        status === "failed"
          ? "grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_8%,white)] p-3"
          : status === "active"
            ? "grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_8%,white)] p-3"
            : status === "ready" || status === "submitted"
              ? "grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-(--color-sage-line) bg-(--color-sage-soft) p-3"
              : "grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-(--color-line) bg-(--color-paper) p-3"
      }
    >
      <span
        className={
          status === "done" || status === "ready" || status === "submitted"
            ? "grid size-10 place-items-center rounded-xl bg-(--color-sage) text-white"
            : status === "failed"
              ? "grid size-10 place-items-center rounded-xl bg-(--color-tomato) text-white"
              : "grid size-10 place-items-center rounded-xl bg-(--color-panel) text-(--color-sage)"
        }
      >
        {status === "done" || status === "ready" || status === "submitted" ? (
          <Check size={18} strokeWidth={3} />
        ) : status === "failed" ? (
          <X size={18} strokeWidth={3} />
        ) : status === "active" ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Icon size={18} />
        )}
      </span>
      <div className="grid min-w-0 gap-1">
        <span className="text-[14px] font-extrabold leading-tight text-(--color-ink)">
          {artifact.label}
        </span>
        <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-(--color-fog)">
          {detail}
        </span>
        {audioUrl ? (
          <audio
            className="mt-1 h-9 w-full max-w-[380px]"
            controls
            preload="metadata"
            src={audioUrl}
          />
        ) : null}
      </div>
      <span className="min-w-[74px] justify-self-end rounded-full border border-(--color-line) bg-(--color-panel) px-2.5 py-1 text-center text-[11.5px] font-extrabold uppercase text-(--color-fog)">
        {badgeLabel}
      </span>
    </div>
  );
}

function StepHeader({
  icon,
  kicker,
  title,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-(--color-line) bg-(--color-paper) text-[13px] font-extrabold text-(--color-sage)">
        {kicker}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-(--color-sage)">{icon}</span>
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-(--color-ink)">
          {title}
        </h3>
      </div>
    </div>
  );
}

function RecipeCardThumb({ recipe, selected }: { recipe: Recipe; selected: boolean }) {
  const image = recipeImagesOf(recipe)[0];
  const url = displayImageUrl(image?.url);

  return (
    <span className="relative h-[60px] w-[60px] overflow-hidden rounded-lg border border-(--color-line) bg-(--color-soft)">
      {url ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          src={url}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-(--color-sage)">
          <Utensils size={20} />
        </span>
      )}
      {selected ? (
        <span className="absolute top-1 left-1 grid size-5 place-items-center rounded-md bg-(--color-sage) text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

function RecipePillThumb({ recipe }: { recipe: Recipe }) {
  const image = recipeImagesOf(recipe)[0];
  const url = displayImageUrl(image?.url);

  return (
    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-(--color-sage-line) bg-(--color-panel)">
      {url ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          src={url}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-(--color-sage)">
          <Utensils size={13} />
        </span>
      )}
    </span>
  );
}
