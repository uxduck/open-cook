import type { PublicGathering, SharedRecipe } from "@open-cook/core";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { api } from "../api";
import { displayImageUrl } from "../imageDisplayUrl";
import { errorMessage, recipeImagesOf } from "../lib/recipe";
import { buildGatheringHead } from "../lib/recipeOg";
import { getPublicGathering } from "../server/gathering";
import {
  Button,
  buttonClassName,
  inlineStatusClassName,
  pageContainerClassName,
} from "../ui";

export const Route = createFileRoute("/g/$slug")({
  loader: async ({ params }) => {
    const gathering = await getPublicGathering({ data: { slug: params.slug } });
    if (!gathering) {
      throw notFound();
    }
    return gathering;
  },
  head: ({ loaderData, params }) =>
    buildGatheringHead(loaderData ?? null, { slug: params.slug }),
  component: GatheringRoute,
  notFoundComponent: GatheringNotFound,
});

function GatheringRoute() {
  const loaderGathering = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [gathering, setGathering] = useState<PublicGathering | null>(loaderGathering);
  const loading = false;
  const [status, setStatus] = useState("");
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(
    loaderGathering.recipes.length === 1 ? [loaderGathering.recipes[0]!.id] : [],
  );
  const [bringing, setBringing] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [welcomeAudioPlaying, setWelcomeAudioPlaying] = useState(false);
  const [welcomeAudioCurrentTime, setWelcomeAudioCurrentTime] = useState(0);
  const [welcomeAudioDuration, setWelcomeAudioDuration] = useState(0);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setGathering(loaderGathering);
    setSelectedRecipeIds(
      loaderGathering.recipes.length === 1 ? [loaderGathering.recipes[0]!.id] : [],
    );
    setStatus("");
  }, [loaderGathering]);

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
  const menuArtwork = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "menu-images"),
    [gathering],
  );
  const rsvpArtwork = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "rsvp-artwork"),
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
  const visibleVideoTeaser =
    videoTeaser?.status === "skipped" ? undefined : videoTeaser;
  const pageArtworkUrl =
    pageArtwork?.status === "ready" && pageArtwork.mediaUrl
      ? displayImageUrl(pageArtwork.mediaUrl)
      : undefined;
  const menuArtworkUrl =
    menuArtwork?.status === "ready" && menuArtwork.mediaUrl
      ? displayImageUrl(menuArtwork.mediaUrl)
      : undefined;
  const rsvpArtworkUrl =
    rsvpArtwork?.status === "ready" && rsvpArtwork.mediaUrl
      ? displayImageUrl(rsvpArtwork.mediaUrl)
      : undefined;
  const voiceoverUrl =
    voiceover?.status === "ready" && voiceover.mediaUrl ? voiceover.mediaUrl : "";
  const videoTeaserUrl =
    visibleVideoTeaser?.status === "ready" && visibleVideoTeaser.mediaUrl
      ? visibleVideoTeaser.mediaUrl
      : undefined;
  const welcomeAudioRangeMax = Math.max(
    welcomeAudioDuration,
    welcomeAudioCurrentTime,
    1,
  );
  const welcomeAudioSeekValue = Math.min(welcomeAudioCurrentTime, welcomeAudioRangeMax);

  useEffect(() => {
    setWelcomeAudioPlaying(false);
    setWelcomeAudioCurrentTime(0);
    setWelcomeAudioDuration(0);
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
      if (audio.ended) {
        audio.currentTime = 0;
        setWelcomeAudioCurrentTime(0);
      }
      await audio.play();
      setWelcomeAudioPlaying(true);
    } catch (error) {
      setStatus(`Audio failed to play: ${errorMessage(error)}`);
    }
  }

  function syncWelcomeAudioTime() {
    const audio = welcomeAudioRef.current;
    if (!audio) return;

    setWelcomeAudioCurrentTime(
      Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    );
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setWelcomeAudioDuration(audio.duration);
    }
  }

  function seekWelcomeAudio(event: ChangeEvent<HTMLInputElement>) {
    const audio = welcomeAudioRef.current;
    const nextTime = Number(event.target.value);
    if (!audio || Number.isNaN(nextTime)) return;

    audio.currentTime = nextTime;
    setWelcomeAudioCurrentTime(nextTime);
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
        <div className={`${pageContainerClassName} grid gap-5 px-5 py-6 md:px-8`}>
          {visibleVideoTeaser ? (
            <a
              aria-label={
                visibleVideoTeaser.status === "ready"
                  ? `Watch ${gathering.title} video`
                  : `Open ${gathering.title} video status`
              }
              className="group relative isolate h-[clamp(190px,28vw,300px)] overflow-hidden rounded-3xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[5px_5px_0_0_var(--color-ink)]"
              href={`/g/${encodeURIComponent(slug)}/video`}
            >
              {videoTeaserUrl ? (
                <video
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full bg-black object-cover"
                  muted
                  playsInline
                  poster={pageArtworkUrl}
                  preload="metadata"
                  src={videoTeaserUrl}
                />
              ) : pageArtworkUrl ? (
                <img
                  alt=""
                  className="absolute inset-0 h-full w-full scale-[1.01] object-cover"
                  decoding="async"
                  src={pageArtworkUrl}
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,color-mix(in_oklch,var(--color-sage-soft)_78%,white),transparent_34%),linear-gradient(135deg,var(--color-paper),var(--color-panel))]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--color-ink)_72%,transparent),color-mix(in_oklch,var(--color-ink)_34%,transparent)_62%,transparent)]" />
              <div className="relative flex h-full items-end justify-between gap-4 p-4 text-white md:p-6">
                <div className="grid min-w-0 max-w-[620px] gap-2">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-black/30 px-3 py-1 text-[12px] font-extrabold uppercase text-white backdrop-blur">
                    <Video size={14} />
                    {visibleVideoTeaser.status === "ready"
                      ? "Video"
                      : `Video ${mediaStatusLabel(visibleVideoTeaser.status)}`}
                  </span>
                  <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(28px,4vw,48px)] font-bold leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.32)]">
                    {visibleVideoTeaser.status === "ready"
                      ? "Watch the video"
                      : "Video is on the way"}
                  </h2>
                </div>
                <span className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-white bg-white text-(--color-ink) shadow-[3px_3px_0_0_var(--color-ink)] transition group-hover:-translate-y-px md:size-[76px]">
                  <Play className="ml-1" fill="currentColor" size={34} />
                </span>
              </div>
            </a>
          ) : null}

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
              {voiceoverUrl ? (
                <div className="grid max-w-[760px] gap-3 rounded-2xl border border-white/35 bg-white/92 p-3 text-(--color-ink) shadow-[4px_4px_0_0_var(--color-ink)] backdrop-blur md:grid-cols-[72px_minmax(0,1fr)] md:items-center md:p-4">
                  <button
                    aria-label={
                      welcomeAudioPlaying ? "Pause welcome audio" : "Play welcome audio"
                    }
                    className="grid size-16 place-items-center rounded-full border-2 border-(--color-ink) bg-(--color-tomato) text-white shadow-[3px_3px_0_0_var(--color-ink)] transition hover:-translate-y-px"
                    onClick={() => void toggleWelcomeAudio()}
                    type="button"
                  >
                    {welcomeAudioPlaying ? (
                      <Pause fill="currentColor" size={28} />
                    ) : (
                      <Play className="ml-1" fill="currentColor" size={28} />
                    )}
                  </button>
                  <div className="grid min-w-0 gap-2">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[13px] font-extrabold uppercase text-(--color-fog)">
                        Welcome
                        <span className="hidden sm:inline">
                          {" "}
                          from {gathering.owner.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-(--color-fog)">
                        {formatMediaTime(welcomeAudioSeekValue)}
                        {" / "}
                        {formatMediaTime(welcomeAudioDuration)}
                      </span>
                    </div>
                    <input
                      aria-label="Seek welcome audio"
                      className="h-2 w-full min-w-0 cursor-pointer accent-(--color-tomato) disabled:cursor-wait disabled:opacity-55"
                      disabled={!welcomeAudioDuration}
                      max={welcomeAudioRangeMax}
                      min={0}
                      onChange={seekWelcomeAudio}
                      step="0.1"
                      type="range"
                      value={welcomeAudioSeekValue}
                    />
                  </div>
                  <audio
                    onDurationChange={syncWelcomeAudioTime}
                    onEnded={() => {
                      setWelcomeAudioPlaying(false);
                      syncWelcomeAudioTime();
                    }}
                    onLoadedMetadata={syncWelcomeAudioTime}
                    onPause={() => {
                      setWelcomeAudioPlaying(false);
                      syncWelcomeAudioTime();
                    }}
                    onPlay={() => {
                      setWelcomeAudioPlaying(true);
                      syncWelcomeAudioTime();
                    }}
                    onTimeUpdate={syncWelcomeAudioTime}
                    preload="metadata"
                    ref={welcomeAudioRef}
                    src={voiceoverUrl}
                  />
                </div>
              ) : voiceover?.status ? (
                <span className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 text-[12px] font-extrabold uppercase text-white/90 backdrop-blur">
                  <Volume2 size={14} />
                  Audio {mediaStatusLabel(voiceover.status)}
                </span>
              ) : null}
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

          {menuArtworkUrl ? (
            <section className="grid overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[4px_4px_0_0_var(--color-ink)] md:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="aspect-[16/10] min-h-[220px] md:aspect-auto md:min-h-[320px]">
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading="lazy"
                  src={menuArtworkUrl}
                />
              </div>
              <div className="grid content-center gap-3 p-5 md:p-6">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-(--color-line) bg-(--color-paper) px-3 py-1 text-[12px] font-extrabold uppercase text-(--color-fog)">
                  <Utensils size={14} />
                  Menu
                </span>
                <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(28px,5vw,46px)] font-bold leading-[0.96] text-(--color-ink)">
                  Choose your place at the table
                </h2>
                <p className="m-0 text-[14.5px] font-semibold leading-relaxed text-(--color-fog)">
                  {gathering.recipes.length === 1
                    ? `The menu centers on ${gathering.recipes[0]?.title}.`
                    : "Pick the dish that sounds right for you, or tell the host what you are bringing."}
                </p>
              </div>
            </section>
          ) : null}

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
              {rsvpArtworkUrl ? (
                <div className="aspect-[16/10] overflow-hidden rounded-xl border border-(--color-line) bg-(--color-paper)">
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                    loading="lazy"
                    src={rsvpArtworkUrl}
                  />
                </div>
              ) : null}

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
        <GatheringMissing status={status} />
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

function GatheringNotFound() {
  return (
    <main className="min-h-screen bg-(--color-canvas) text-(--color-ink)">
      <GatheringMissing />
    </main>
  );
}

function GatheringMissing({ status }: { status?: string }) {
  return (
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
  );
}

function formatMediaTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
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
