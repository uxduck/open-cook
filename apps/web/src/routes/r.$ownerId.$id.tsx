import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ChefHat, Copy, Link2, LogIn } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { JsonLd } from "../components/JsonLd";
import {
  detailActionsClassName,
  detailPanelClassName,
  detailStatusClassName,
  detailToolbarClassName,
  ReadOnlyRecipeContent,
} from "../components/recipeViews";
import { useSession } from "../context/SessionProvider";
import { errorMessage } from "../lib/recipe";
import { buildRecipeHead, buildRecipeJsonLd, publicRecipeUrl } from "../lib/recipeOg";
import { getRecipeLink } from "../server/recipeLink";
import { Button, inlineStatusClassName, pageContainerClassName } from "../ui";

export const Route = createFileRoute("/r/$ownerId/$id")({
  loader: async ({ params }) => {
    const recipe = await getRecipeLink({
      data: { ownerId: params.ownerId, recipeId: params.id },
    });
    if (!recipe) {
      throw notFound();
    }
    return recipe;
  },
  head: ({ loaderData, params }) =>
    buildRecipeHead(loaderData ?? null, { ownerId: params.ownerId, id: params.id }),
  component: RecipeLinkRoute,
  notFoundComponent: RecipeLinkNotFound,
});

function RecipeLinkRoute() {
  const recipe = Route.useLoaderData();
  const navigate = useNavigate();
  const { session, openAuth } = useSession();
  const [status, setStatus] = useState<string>();

  async function saveCopy() {
    if (!recipe) {
      return;
    }
    if (!session) {
      openAuth("login");
      return;
    }
    try {
      const copy = await api.copyRecipe(recipe.owner.id, recipe.id);
      setStatus(`Saved a copy of ${copy.title} to your recipes`);
      void navigate({ to: "/app" });
    } catch (error) {
      setStatus(`Copy failed: ${errorMessage(error)}`);
    }
  }

  return (
    <main className="min-h-screen text-(--color-pop-ink) [background:radial-gradient(circle_at_18%_14%,rgba(120,164,110,0.1),transparent_28%),#f7f8f2]">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_78%,transparent)] px-6 py-3 backdrop-blur-[16px] backdrop-saturate-[1.3] max-[720px]:px-4">
        <button
          className="inline-flex min-h-[38px] items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold tracking-[-0.01em] text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66]"
          onClick={() => navigate({ to: session ? "/app" : "/" })}
          type="button"
        >
          <img alt="" className="size-7" src="/logo.png" />
          <span>OpenCook</span>
        </button>
        <div className="col-start-3 flex min-w-0 flex-wrap items-center justify-end gap-2">
          {session ? (
            <Button onClick={() => navigate({ to: "/app" })} size="sm">
              Open app
            </Button>
          ) : (
            <Button onClick={() => openAuth("login")} size="sm">
              <LogIn size={15} />
              Log in
            </Button>
          )}
        </div>
      </header>

      {recipe ? (
        <section className={`${detailPanelClassName} ${pageContainerClassName}`}>
          {recipe.visibility === "public" ? (
            <JsonLd
              data={buildRecipeJsonLd(
                recipe,
                publicRecipeUrl(recipe.owner.id, recipe.id),
              )}
            />
          ) : null}
          <div className={detailToolbarClassName}>
            <div className={detailStatusClassName}>
              <Link2 size={16} />
              <span>
                {recipe.owner.name} shared {recipe.title}
              </span>
            </div>
            <div className={detailActionsClassName}>
              <Button onClick={() => void saveCopy()} size="sm" variant="primary">
                {session ? <Copy size={16} /> : <LogIn size={16} />}
                {session ? "Save a copy" : "Log in to save a copy"}
              </Button>
            </div>
          </div>
          <ReadOnlyRecipeContent recipe={recipe} />
          {status ? <p className={inlineStatusClassName}>{status}</p> : null}
        </section>
      ) : (
        <RecipeLinkMissing onBack={() => navigate({ to: session ? "/app" : "/" })} />
      )}
    </main>
  );
}

function RecipeLinkNotFound() {
  const navigate = useNavigate();
  const { session } = useSession();
  return <RecipeLinkMissing onBack={() => navigate({ to: session ? "/app" : "/" })} />;
}

function RecipeLinkMissing({ onBack }: { onBack: () => void }) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) px-6 py-14 text-center shadow-[5px_5px_0_0_var(--color-ink)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-ink) bg-(--color-soft) text-(--color-fog)">
          <ChefHat size={24} />
        </span>
        <strong className="text-lg text-(--color-ink)">Recipe not found</strong>
        <p className="max-w-sm text-[14px] leading-snug text-(--color-fog)">
          This share link doesn't exist anymore, or the owner has stopped sharing it.
        </p>
        <Button onClick={onBack} size="sm" variant="secondary">
          Back to OpenCook
        </Button>
      </div>
    </section>
  );
}
