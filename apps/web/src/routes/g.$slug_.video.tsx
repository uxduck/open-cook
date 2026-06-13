import type { PublicGathering } from "@open-cook/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, Loader2, Play, Sparkles, Users, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { displayImageUrl } from "../imageDisplayUrl";
import { errorMessage } from "../lib/recipe";
import {
  buttonClassName,
  inlineStatusClassName,
  pageContainerClassName,
} from "../ui";

export const Route = createFileRoute("/g/$slug_/video")({
  component: GatheringVideoRoute,
});

function GatheringVideoRoute() {
  const { slug } = Route.useParams();
  const [gathering, setGathering] = useState<PublicGathering | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus("");
    api
      .getGathering(slug)
      .then((result) => {
        if (!active) return;
        setGathering(result);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(`Video failed to load: ${errorMessage(error)}`);
        setGathering(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const videoTeaser = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "video-teaser"),
    [gathering],
  );
  const pageArtwork = useMemo(
    () => gathering?.artifacts.find((artifact) => artifact.kind === "page-artwork"),
    [gathering],
  );
  const artworkUrl =
    pageArtwork?.status === "ready" && pageArtwork.mediaUrl
      ? displayImageUrl(pageArtwork.mediaUrl)
      : undefined;
  const videoUrl =
    videoTeaser?.status === "ready" && videoTeaser.mediaUrl
      ? videoTeaser.mediaUrl
      : undefined;

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
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            params={{ slug }}
            to="/g/$slug"
          >
            <Users size={15} />
            Back to gathering
          </Link>
        </div>
      </header>

      {loading ? (
        <section className="grid min-h-[60vh] place-items-center px-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-(--color-line) bg-(--color-panel) px-4 py-2 text-[13px] font-extrabold text-(--color-fog)">
            <Loader2 className="animate-spin" size={16} />
            Loading video
          </div>
        </section>
      ) : gathering ? (
        <section className={`${pageContainerClassName} grid gap-5 px-5 py-6 md:px-8`}>
          <div className="relative isolate min-h-[520px] overflow-hidden rounded-3xl border-2 border-(--color-ink) bg-(--color-panel) shadow-[5px_5px_0_0_var(--color-ink)]">
            {videoUrl ? (
              <video
                className="absolute inset-0 h-full w-full bg-black object-cover"
                controls
                playsInline
                poster={artworkUrl}
                src={videoUrl}
              />
            ) : artworkUrl ? (
              <img
                alt=""
                className="absolute inset-0 h-full w-full object-cover motion-safe:animate-pulse"
                decoding="async"
                src={artworkUrl}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,color-mix(in_oklch,var(--color-sage-soft)_78%,white),transparent_34%),linear-gradient(135deg,var(--color-paper),var(--color-panel))]" />
            )}

            {!videoUrl ? (
              <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--color-ink)_76%,transparent),color-mix(in_oklch,var(--color-ink)_34%,transparent)_58%,transparent)]" />
            ) : null}

            {!videoUrl ? (
              <div className="relative grid min-h-[520px] content-end gap-4 p-5 text-white md:p-7">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-black/30 px-3 py-1 text-[12px] font-extrabold uppercase text-white backdrop-blur">
                  <Video size={14} />
                  {videoTeaser?.status
                    ? `Video ${mediaStatusLabel(videoTeaser.status)}`
                    : "Video not started"}
                </div>
                <h1 className="max-w-[12ch] font-[family-name:var(--font-display)] text-[clamp(36px,8vw,76px)] font-bold leading-[0.94] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.32)]">
                  {gathering.title}
                </h1>
                <p className="m-0 max-w-[58ch] text-[16px] font-semibold leading-relaxed text-white/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.34)]">
                  {videoStatusMessage(videoTeaser?.status)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className={buttonClassName({ size: "sm" })}
                    params={{ slug }}
                    to="/g/$slug"
                  >
                    <Sparkles size={15} />
                    Open gathering
                  </Link>
                </div>
              </div>
            ) : (
              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/35 bg-black/45 px-3 py-1 text-[12px] font-extrabold uppercase text-white backdrop-blur md:left-7 md:top-7">
                <Play size={14} />
                {gathering.title}
              </div>
            )}
          </div>
          {status ? <p className={inlineStatusClassName}>{status}</p> : null}
        </section>
      ) : (
        <section className="flex min-h-[60vh] items-center justify-center px-5 py-16">
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) px-6 py-14 text-center shadow-[5px_5px_0_0_var(--color-ink)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-ink) bg-(--color-soft) text-(--color-fog)">
              <ChefHat size={24} />
            </span>
            <strong className="text-lg text-(--color-ink)">Video not found</strong>
            <p className="max-w-sm text-[14px] leading-snug text-(--color-fog)">
              This gathering video is no longer available.
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

function videoStatusMessage(status: string | undefined) {
  if (status === "skipped") {
    return "A video teaser is not configured for this gathering.";
  }
  if (status === "failed") {
    return "The video could not be generated yet, but the gathering page is ready.";
  }
  return "The video teaser is being generated. The artwork preview will update when it is ready.";
}
