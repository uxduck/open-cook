import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Link2, LogIn } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { ReadOnlyRecipeContent } from "../components/recipeViews";
import { useSession } from "../context/SessionProvider";
import { errorMessage } from "../lib/recipe";
import { buildRecipeHead } from "../lib/recipeOg";
import { getRecipeLink } from "../server/recipeLink";
import { Button } from "../ui";

export const Route = createFileRoute("/r/$ownerId/$id")({
  loader: ({ params }) =>
    getRecipeLink({ data: { ownerId: params.ownerId, recipeId: params.id } }),
  head: ({ loaderData, params }) =>
    buildRecipeHead(loaderData ?? null, { ownerId: params.ownerId, id: params.id }),
  component: RecipeLinkRoute,
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
    <main className="site-shell share-site-shell">
      <header className="app-nav">
        <button
          className="app-brand-button"
          onClick={() => navigate({ to: session ? "/app" : "/" })}
          type="button"
        >
          <img alt="" className="brand-logo" src="/logo.png" />
          <span>OpenCook</span>
        </button>
        <div className="app-nav-actions">
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
        <section className="detail-panel browse-panel">
          <div className="detail-toolbar">
            <div className="detail-status">
              <Link2 size={16} />
              <span>
                {recipe.owner.name} shared {recipe.title}
              </span>
            </div>
            <div className="detail-actions">
              <Button onClick={() => void saveCopy()} size="sm" variant="primary">
                {session ? <Copy size={16} /> : <LogIn size={16} />}
                {session ? "Save a copy" : "Log in to save a copy"}
              </Button>
            </div>
          </div>
          <ReadOnlyRecipeContent recipe={recipe} />
          {status ? <p className="inline-status">{status}</p> : null}
        </section>
      ) : (
        <section className="detail-panel browse-panel">
          <p className="col-span-full self-start rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-[13px] text-[var(--muted-foreground)]">
            This recipe link doesn't exist or is no longer shared.
          </p>
        </section>
      )}
    </main>
  );
}
