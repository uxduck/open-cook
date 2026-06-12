import type { PublicGathering, SharedRecipe } from "@open-cook/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, Link2, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  detailActionsClassName,
  detailPanelClassName,
  detailStatusClassName,
  detailToolbarClassName,
  ReadOnlyRecipeContent,
} from "../components/recipeViews";
import { errorMessage } from "../lib/recipe";
import { buttonClassName, inlineStatusClassName } from "../ui";

export const Route = createFileRoute("/g/$slug_/r/$recipeId")({
  component: GatheringRecipeRoute,
});

function GatheringRecipeRoute() {
  const { recipeId, slug } = Route.useParams();
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
        setStatus(`Recipe failed to load: ${errorMessage(error)}`);
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

  const recipe = useMemo<SharedRecipe | undefined>(
    () => gathering?.recipes.find((item) => item.id === recipeId),
    [gathering, recipeId],
  );

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
            Loading recipe
          </div>
        </section>
      ) : gathering && recipe ? (
        <section className={`${detailPanelClassName} mx-auto w-full max-w-[1040px]`}>
          <div className={detailToolbarClassName}>
            <div className={detailStatusClassName}>
              <Link2 size={16} />
              <span>
                {gathering.owner.name} shared {recipe.title} for {gathering.title}
              </span>
            </div>
            <div className={detailActionsClassName}>
              <Link
                className={buttonClassName({ size: "sm", variant: "secondary" })}
                params={{ slug }}
                to="/g/$slug"
              >
                <Users size={15} />
                View gathering
              </Link>
            </div>
          </div>
          <ReadOnlyRecipeContent recipe={recipe} />
        </section>
      ) : (
        <section className="flex min-h-[60vh] items-center justify-center px-5 py-16">
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) px-6 py-14 text-center shadow-[5px_5px_0_0_var(--color-ink)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-ink) bg-(--color-soft) text-(--color-fog)">
              <ChefHat size={24} />
            </span>
            <strong className="text-lg text-(--color-ink)">Recipe not found</strong>
            <p className="max-w-sm text-[14px] leading-snug text-(--color-fog)">
              This recipe is not part of the published gathering anymore.
            </p>
            <Link
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              params={{ slug }}
              to="/g/$slug"
            >
              View gathering
            </Link>
            {status ? <p className={inlineStatusClassName}>{status}</p> : null}
          </div>
        </section>
      )}
    </main>
  );
}
