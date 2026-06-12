import type { PublicGathering, SharedRecipe } from "@open-cook/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChefHat,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Users,
  Utensils,
  Video,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { displayImageUrl } from "../imageDisplayUrl";
import { errorMessage, recipeImagesOf } from "../lib/recipe";
import { Button, buttonClassName, inlineStatusClassName } from "../ui";

export const Route = createFileRoute("/g/$slug")({
  component: GatheringRoute,
});

function GatheringRoute() {
  const { slug } = Route.useParams();
  const [gathering, setGathering] = useState<PublicGathering | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [bringing, setBringing] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [welcomeAudioPlaying, setWelcomeAudioPlaying] = useState(false);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getGathering(slug)
      .then((result) => {
        if (!active) return;
        setGathering(result);
        setSelectedRecipeIds(
          result.recipes.length === 1 ? [result.recipes[0]!.id] : [],
        );
      })
      .catch((error) => {
        if (!active) return;
        setStatus(`Gathering failed to load: ${errorMessage(error)}`);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const selectedRecipeTitles = useMemo(() => {
    if (!gathering) return [];
    const titlesById = new Map(
      gathering.recipes.map((recipe) => [recipe.id, recipe.title]),
    );
    return selectedRecipeIds
      .map((id) => titlesById.get(id))
      .filter((title): title is string => Boolean(title));
  }, [gathering, selectedRecipeIds]);
  const pageArtwork = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "page-artwork"),
    [gathering],
  );
  const voiceover = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "voiceover"),
    [gathering],
  );
  const videoTeaser = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "video-teaser"),
    [gathering],
  );
  const pageArtworkUrl =
    pageArtwork?.status === "ready" && pageArtwork.mediaUrl
      ? displayImageUrl(pageArtwork.mediaUrl)
      : undefined;
  const voiceoverUrl =
    voiceover?.status === "ready" && voiceover.mediaUrl ? voiceover.mediaUrl : "";

  useEffect(() => {
    setWelcomeAudioPlaying(false);
    welcomeAudioRef.current?.pause();
  }, [voiceoverUrl]);

  function toggleRecipe(recipeId: string) {
    if (gathering?.recipes.length === 1) {
      return;
    }
    setSelectedRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    );
  }

  async function submitResponse() {
    if (!guestName.trim()) {
      setStatus("Add your name.");
      return;
    }

    if (selectedRecipeIds.length === 0 && !bringing.trim()) {
      setStatus("Choose a recipe or add what you are bringing.");
      return;
    }

    setSubmitting(true);
    setStatus("Saving response");
    try {
      const response = await api.addGatheringResponse(slug, {
        bringing: bringing.trim() || undefined,
        email: email.trim() || undefined,
        guestName: guestName.trim(),
        note: note.trim() || undefined,
        selectedRecipeIds,
      });
      setGathering((current) =>
        current ? { ...current, responses: [response, ...current.responses] } : current,
      );
      setStatus("Response saved.");
      setBringing("");
      setNote("");
    } catch (error) {
      setStatus(`Response failed: ${errorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleWelcomeAudio() {
    const audio = welcomeAudioRef.current;
    if (!audio || !voiceoverUrl) {
      return;
    }
    if (welcomeAudioPlaying) {
      audio.pause();
      setWelcomeAudioPlaying(false);
      return;
    }
    try {
      await audio.play();
      setWelcomeAudioPlaying(true);
    } catch (error) {
      setStatus(`Audio failed to play: ${errorMessage(error)}`);
    }
  }

  return (
    <main className="min-h-screen bg-(--color-canvas) text-(--color-ink)">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_78%,transparent)] px-6 py-3 backdrop-blur-[16px] backdrop-saturate-[1.3] max-[720px]:grid-cols-1 max-[720px]:px-4">
        <Link
          className="inline-flex min-h-[38px] items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66]"
          to="/"
        >
          <img alt="" className="size-7" src="/logo.png" />
          <span>OpenCook</span>
        </Link>
        <div className="col-start-3 flex min-w-0 flex-wrap items-center justify-end gap-2 max-[720px]:col-start-1 max-[720px]:justify-start">
          <Link className={buttonClassName({ size: "sm" })} to="/app">
            Open app
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="grid min-h-[60vh] place-items-center px-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-(--color-line) bg-(--color-panel) px-4 py-2 text-[13px] font-extrabold text-(--color-fog)">
            <Loader2 className="animate-spin" size={16} />
            Loading gathering
          </div>
        </section>
      ) : gathering ? (
        <div className="mx-auto grid w-full max-w-[1040px] gap-5 px-5 py-6 md:px-8">
          <section className="relative isolate min-h-[360px] overflow-hidden rounded-3xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[5px_5px_0_0_var(--color-ink)]">
            {pageArtworkUrl ? (
              <img
                alt=""
                className="absolute inset-0 h-full w-full scale-[1.01] object-cover"
                decoding="async"
                src={pageArtworkUrl}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,color-mix(in_oklch,var(--color-sage-soft)_78%,white),transparent_34%),linear-gradient(135deg,var(--color-paper),var(--color-panel))]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--color-ink)_72%,transparent),color-mix(in_oklch,var(--color-ink)_28%,transparent)_52%,transparent)] motion-safe:animate-pulse" />
            <div className="relative grid min-h-[360px] content-end gap-4 p-5 text-white md:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-black/30 px-3 py-1 text-[12px] font-extrabold uppercase text-white backdrop-blur">
                  <Users size={14} />
                  {gathering.owner.name}
                </div>
                {pageArtwork?.status && pageArtwork.status !== "ready" ? (
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 py-1 text-[12px] font-extrabold uppercase text-white/90 backdrop-blur">
                    <Sparkles size={14} />
                    Artwork {mediaStatusLabel(pageArtwork.status)}
                  </div>
                ) : null}
              </div>
              <h1 className="max-w-[12ch] font-[family-name:var(--font-display)] text-[clamp(36px,8vw,76px)] font-bold leading-[0.94] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.32)]">
                {gathering.title}
              </h1>
              <p className="m-0 max-w-[68ch] text-[16px] font-semibold leading-relaxed text-white/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.34)]">
                {gathering.welcome}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {voiceoverUrl ? (
                  <>
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/40 bg-white px-4 text-[13px] font-extrabold text-(--color-ink) shadow-[3px_3px_0_0_var(--color-ink)] transition hover:-translate-y-px"
                      onClick={() => void toggleWelcomeAudio()}
                      type="button"
                    >
                      {welcomeAudioPlaying ? <Pause size={16} /> : <Play size={16} />}
                      {welcomeAudioPlaying ? "Pause welcome" : "Play welcome"}
                    </button>
                    <audio
                      onEnded={() => setWelcomeAudioPlaying(false)}
                      onPause={() => setWelcomeAudioPlaying(false)}
                      onPlay={() => setWelcomeAudioPlaying(true)}
                      preload="metadata"
                      ref={welcomeAudioRef}
                      src={voiceoverUrl}
                    />
                  </>
                ) : voiceover?.status ? (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 text-[12px] font-extrabold uppercase text-white/90 backdrop-blur">
                    <Volume2 size={14} />
                    Audio {mediaStatusLabel(voiceover.status)}
                  </span>
                ) : null}
                {videoTeaser ? (
                  <a
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/35 bg-black/30 px-3 text-[12px] font-extrabold uppercase text-white backdrop-blur transition hover:bg-black/40"
                    href={`/g/${encodeURIComponent(slug)}/video`}
                  >
                    <Video size={14} />
                    {videoTeaser.status === "ready" ? "Watch video" : "Video status"}
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-(--color-line) bg-(--color-panel) p-4 md:p-5">
            {gathering.dietary ? (
              <p className="m-0 rounded-xl bg-(--color-sage-soft) px-3 py-2 text-[13px] font-bold text-(--color-sage)">
                Dietary notes: {gathering.dietary}
              </p>
            ) : (
              <p className="m-0 text-[13px] font-bold text-(--color-fog)">
                Review the menu, pick what sounds good, and send your response.
              </p>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-3">
              {gathering.recipes.map((recipe) => (
                <GatheringRecipeCard
                  key={recipe.id}
                  gatheringSlug={slug}
                  onToggle={() => toggleRecipe(recipe.id)}
                  recipe={recipe}
                  selectable={gathering.recipes.length > 1}
                  selected={selectedRecipeIds.includes(recipe.id)}
                />
              ))}
            </div>

            <aside className="grid h-fit gap-4 rounded-2xl border border-(--color-line) bg-(--color-panel) p-4 md:p-5">
              <div className="grid gap-2">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-(--color-line) bg-(--color-paper) px-3 py-1 text-[12px] font-extrabold uppercase text-(--color-fog)">
                  <ChefHat size={14} />
                  Reply
                </span>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-(--color-ink)">
                  {gathering.guestQuestion}
                </h2>
              </div>

              {gathering.recipes.length === 1 ? (
                <div className="rounded-xl border border-(--color-sage-line) bg-(--color-sage-soft) p-3 text-[13px] font-bold text-(--color-sage)">
                  {gathering.recipes[0]?.title}
                </div>
              ) : selectedRecipeTitles.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecipeTitles.map((title) => (
                    <span
                      className="rounded-full border border-(--color-sage-line) bg-(--color-sage-soft) px-2.5 py-1 text-[12px] font-extrabold text-(--color-sage)"
                      key={title}
                    >
                      {title}
                    </span>
                  ))}
                </div>
              ) : null}

              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Name
                <input
                  className="min-h-11 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setGuestName(event.target.value)}
                  value={guestName}
                />
              </label>
              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Email
                <input
                  className="min-h-11 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </label>
              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Bringing
                <textarea
                  className="min-h-[92px] resize-y rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setBringing(event.target.value)}
                  placeholder="A salad, drinks, dessert..."
                  value={bringing}
                />
              </label>
              <label className="grid gap-2 text-[13px] font-extrabold text-(--color-ink)">
                Note
                <textarea
                  className="min-h-[82px] resize-y rounded-lg border border-(--color-line) bg-(--color-paper) px-3 py-2 text-[14px] font-semibold text-(--color-ink) outline-none placeholder:text-(--color-fog) focus:border-(--color-ink)"
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                />
              </label>
              <Button
                disabled={submitting}
                fullWidth
                onClick={() => void submitResponse()}
                size="lg"
                variant="primary"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
                Send response
              </Button>
              {status ? <p className={inlineStatusClassName}>{status}</p> : null}
            </aside>
          </section>

          {gathering.responses.length ? (
            <section className="grid gap-3 rounded-2xl border border-(--color-line) bg-(--color-panel) p-4 md:p-5">
              <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase text-(--color-fog)">
                <Users size={15} />
                Responses
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {gathering.responses.map((response) => (
                  <div
                    className="grid gap-1 rounded-xl border border-(--color-line) bg-(--color-paper) p-3"
                    key={response.id}
                  >
                    <strong className="text-[14px] text-(--color-ink)">
                      {response.guestName}
                    </strong>
                    <span className="text-[12.5px] font-semibold text-(--color-fog)">
                      {response.bringing || response.selectedRecipeIds.length
                        ? [
                            response.bringing,
                            ...response.selectedRecipeIds
                              .map(
                                (id) =>
                                  gathering.recipes.find((recipe) => recipe.id === id)
                                    ?.title,
                              )
                              .filter(Boolean),
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "Responded"}
                    </span>
                    {response.note ? (
                      <span className="text-[12.5px] font-semibold text-(--color-fog)">
                        {response.note}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="flex min-h-[60vh] items-center justify-center px-5 py-16">
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) px-6 py-14 text-center shadow-[5px_5px_0_0_var(--color-ink)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-ink) bg-(--color-soft) text-(--color-fog)">
              <ChefHat size={24} />
            </span>
            <strong className="text-lg text-(--color-ink)">Gathering not found</strong>
            <p className="max-w-sm text-[14px] leading-snug text-(--color-fog)">
              This gathering link is no longer available.
            </p>
            {status ? <p className={inlineStatusClassName}>{status}</p> : null}
          </div>
        </section>
      )}
    </main>
  );
}

function mediaStatusLabel(status: string) {
  if (status === "pending") return "generating";
  if (status === "submitted") return "generating";
  if (status === "skipped") return "unavailable";
  if (status === "failed") return "failed";
  return status;
}

function GatheringRecipeCard({
  gatheringSlug,
  onToggle,
  recipe,
  selectable,
  selected,
}: {
  gatheringSlug: string;
  onToggle: () => void;
  recipe: SharedRecipe;
  selectable: boolean;
  selected: boolean;
}) {
  const image = recipeImagesOf(recipe)[0];
  const imageUrl = displayImageUrl(image?.url);
  const recipePath = `/g/${encodeURIComponent(gatheringSlug)}/r/${encodeURIComponent(
    recipe.id,
  )}`;

  return (
    <article
      className={
        selected
          ? "grid gap-4 rounded-2xl border-2 border-(--color-sage) bg-(--color-sage-soft) p-3 md:grid-cols-[160px_minmax(0,1fr)]"
          : "grid gap-4 rounded-2xl border border-(--color-line) bg-(--color-panel) p-3 md:grid-cols-[160px_minmax(0,1fr)]"
      }
    >
      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-(--color-line) bg-(--color-paper)">
        {imageUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <span className="grid h-full place-items-center text-(--color-sage)">
            <Utensils size={28} />
          </span>
        )}
      </div>
      <div className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid min-w-0 gap-1">
            <h3 className="m-0 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-(--color-ink)">
              {recipe.title}
            </h3>
            {recipe.description ? (
              <p className="m-0 text-[13.5px] font-semibold leading-relaxed text-(--color-fog)">
                {recipe.description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              href={recipePath}
              rel="noopener"
              target="_blank"
            >
              <ExternalLink size={15} />
              Open recipe
            </a>
            {selectable ? (
              <button
                aria-pressed={selected}
                className={
                  selected
                    ? "inline-flex min-h-10 items-center gap-2 rounded-lg border-2 border-(--color-sage) bg-(--color-sage) px-3 text-[13px] font-extrabold text-white"
                    : "inline-flex min-h-10 items-center gap-2 rounded-lg border border-(--color-line) bg-(--color-paper) px-3 text-[13px] font-extrabold text-(--color-ink) hover:border-(--color-ink)"
                }
                onClick={onToggle}
                type="button"
              >
                {selected ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
                {selected ? "Selected" : "Choose"}
              </button>
            ) : null}
          </div>
        </div>

        <details className="group rounded-xl border border-(--color-line) bg-(--color-paper)">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[13px] font-extrabold text-(--color-ink) [&::-webkit-details-marker]:hidden">
            Recipe
            <span className="text-(--color-fog)">+</span>
          </summary>
          <div className="grid gap-4 border-t border-(--color-line) px-3 py-3">
            {recipe.ingredients.length ? (
              <div className="grid gap-2">
                <strong className="text-[12px] uppercase text-(--color-fog)">
                  Ingredients
                </strong>
                <ul className="m-0 grid gap-1 pl-5 text-[13px] font-semibold leading-relaxed text-(--color-ink)">
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient.id ?? ingredient.text}>{ingredient.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {recipe.steps.length ? (
              <div className="grid gap-2">
                <strong className="text-[12px] uppercase text-(--color-fog)">
                  Steps
                </strong>
                <ol className="m-0 grid gap-2 pl-5 text-[13px] font-semibold leading-relaxed text-(--color-ink)">
                  {recipe.steps.map((step, index) => (
                    <li key={step.id ?? `${index}-${step.text}`}>{step.text}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}
