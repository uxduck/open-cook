import { recipeSearchText, type SharedRecipe } from "@open-cook/core";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChefHat,
  Clock3,
  Copy,
  LogIn,
  Search,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSession } from "../context/SessionProvider";
import { displayImageUrl } from "../imageDisplayUrl";
import { recipeTimeSummary } from "../lib/recipe";
import { buildCookbookHead } from "../lib/recipeOg";
import { getCookbook } from "../server/cookbook";
import { Button, inlineStatusClassName, pageContainerClassName } from "../ui";

export const Route = createFileRoute("/c/$slug")({
  loader: async ({ params }) => {
    const cookbook = await getCookbook({ data: { slug: params.slug } });
    if (!cookbook) {
      throw notFound();
    }
    return cookbook;
  },
  head: ({ loaderData, params }) =>
    buildCookbookHead(loaderData ?? null, { slug: params.slug }),
  component: CookbookRoute,
  notFoundComponent: CookbookNotFound,
});

function CookbookRoute() {
  const cookbook = Route.useLoaderData();
  const navigate = useNavigate();
  const { session, openAuth } = useSession();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const recipes = useMemo(() => {
    if (!cookbook) {
      return [];
    }
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return cookbook.recipes;
    }
    return cookbook.recipes.filter((recipe) =>
      `${recipeSearchText(recipe)} ${recipe.owner.name.toLowerCase()}`.includes(
        normalized,
      ),
    );
  }, [cookbook, query]);

  async function copyLink() {
    if (!cookbook) {
      return;
    }
    const path = `/c/${encodeURIComponent(cookbook.slug)}`;
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Cookbook link copied");
    } catch {
      setStatus(url);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,rgba(255,190,91,0.22),transparent_18rem),radial-gradient(circle_at_92%_8%,rgba(47,104,75,0.18),transparent_22rem),linear-gradient(135deg,#fff7e3_0%,#f7efe0_50%,#eaf3df_100%)] text-(--color-ink)">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_78%,transparent)] px-6 py-3 backdrop-blur-[16px] backdrop-saturate-[1.3] max-[720px]:grid-cols-1 max-[720px]:px-4">
        <button
          className="inline-flex min-h-[38px] items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold tracking-normal text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66]"
          onClick={() => navigate({ to: session ? "/app" : "/" })}
          type="button"
        >
          <img alt="" className="size-7" src="/logo.png" />
          <span>OpenCook</span>
        </button>
        <div className="col-start-3 flex min-w-0 flex-wrap items-center justify-end gap-2 max-[720px]:col-start-1 max-[720px]:justify-start">
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

      {cookbook ? (
        <section className={`${pageContainerClassName} grid gap-5 px-5 py-8 max-[720px]:px-4`}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5 max-[780px]:grid-cols-1">
            <div className="grid gap-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-(--color-ink) bg-(--color-panel) px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-(--color-sage) shadow-[2px_2px_0_0_var(--color-ink)]">
                <BookOpen size={14} />
                {cookbook.visibility === "public"
                  ? "Public cookbook"
                  : "Link-only cookbook"}
              </span>
              <h1 className="m-0 max-w-[820px] font-display text-[clamp(42px,6vw,86px)] font-[760] leading-[0.92] tracking-normal text-(--color-ink)">
                {cookbook.title}
              </h1>
              <p className="m-0 max-w-[680px] text-[16px] font-semibold leading-[1.55] text-(--color-fog)">
                {cookbook.description || `${cookbook.owner.name}'s OpenCook cookbook.`}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-extrabold text-(--color-fog)">
                <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-panel) px-2.5 py-1">
                  <UserRound size={13} />
                  {cookbook.owner.name}
                </span>
                <span className="rounded-full border-2 border-(--color-line) bg-(--color-panel) px-2.5 py-1">
                  {cookbook.recipes.length} recipes
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 max-[780px]:justify-start">
              <Button onClick={() => void copyLink()} size="sm" variant="secondary">
                <Copy size={15} />
                Copy link
              </Button>
            </div>
          </div>

          <div className="grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border-2 border-solid border-(--color-ink) bg-[linear-gradient(135deg,#fffdf8,#fff4d7)] p-2 shadow-[3px_3px_0_0_var(--color-ink)] transition focus-within:-translate-y-0.5 focus-within:shadow-[5px_5px_0_0_var(--color-ink)] [&>input]:min-w-0 [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-sm [&>input]:font-semibold [&>input]:text-(--color-ink) [&>input]:outline-0 [&>input::placeholder]:text-[#8a8378]">
            <span className="flex size-8 items-center justify-center rounded-xl border-2 border-(--color-ink) bg-(--color-sage-soft) text-(--color-sage)">
              <Search aria-hidden="true" size={17} />
            </span>
            <input
              aria-label="Search cookbook"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this cookbook"
              value={query}
            />
          </div>

          {status ? <p className={inlineStatusClassName}>{status}</p> : null}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-5">
            {recipes.map((recipe) => (
              <a
                className="relative flex min-h-[260px] flex-col items-stretch overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(180deg,#fffef9,#fff8ec)] p-0 text-left text-(--color-ink) no-underline shadow-[5px_5px_0_0_var(--color-ink)] transition-transform before:absolute before:top-3 before:left-3 before:z-10 before:size-3 before:rounded-full before:border-2 before:border-(--color-ink) before:bg-(--color-sage-soft) before:shadow-[1px_1px_0_0_var(--color-ink)] before:content-[''] hover:-translate-x-px hover:-translate-y-px hover:rotate-[0.35deg] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sage)]"
                href={`/c/${encodeURIComponent(cookbook.slug)}/r/${encodeURIComponent(recipe.id)}`}
                key={recipe.id}
              >
                <RecipeCardCover recipe={recipe} />
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <strong className="text-[15px] leading-tight text-(--color-ink)">
                    {recipe.title}
                  </strong>
                  <span className="line-clamp-2 text-[13px] leading-snug text-(--color-fog)">
                    {recipe.description || "OpenCook recipe"}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-2 pt-1.5 text-[11.5px] font-bold text-(--color-fog)">
                    <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5">
                      <Clock3 size={11} />
                      {recipeTimeSummary(recipe)}
                    </span>
                    {recipe.tags.slice(0, 1).map((tag) => (
                      <span
                        className="rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                </div>
              </a>
            ))}
            {recipes.length === 0 ? (
              <p className="col-span-full rounded-lg border-2 border-dashed border-(--color-line) bg-(--color-panel) p-4 text-[13px] font-semibold text-(--color-fog)">
                No matching recipes in this cookbook.
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <CookbookMissing onBack={() => navigate({ to: session ? "/app" : "/" })} />
      )}
    </main>
  );
}

function CookbookNotFound() {
  const navigate = useNavigate();
  const { session } = useSession();
  return <CookbookMissing onBack={() => navigate({ to: session ? "/app" : "/" })} />;
}

function CookbookMissing({ onBack }: { onBack: () => void }) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-(--color-ink) bg-(--color-panel) px-6 py-14 text-center shadow-[5px_5px_0_0_var(--color-ink)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-(--color-ink) bg-(--color-soft) text-(--color-fog)">
          <ChefHat size={24} />
        </span>
        <strong className="text-lg text-(--color-ink)">Cookbook not found</strong>
        <p className="max-w-sm text-[14px] leading-snug text-(--color-fog)">
          This cookbook link is private or no longer exists.
        </p>
        <Button onClick={onBack} size="sm">
          Back to OpenCook
        </Button>
      </div>
    </section>
  );
}

function RecipeCardCover({ recipe }: { recipe: SharedRecipe }) {
  const url = displayImageUrl(recipe.imageUrl);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border-b-2 border-(--color-ink) bg-(--color-soft)">
      {url && !failed ? (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          src={url}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-(--color-sage)">
          <ChefHat size={32} />
        </span>
      )}
    </div>
  );
}
