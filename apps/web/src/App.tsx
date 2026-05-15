import type { Recipe } from "@open-cook/core";
import {
  BookOpen,
  Braces,
  CheckCircle2,
  ChefHat,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  Github,
  Globe2,
  Image,
  Import,
  KeyRound,
  LibraryBig,
  Link2,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthPage } from "./AuthPage";
import { api } from "./api";

const githubUrl = "https://github.com/uxduck/open-cook";

type Page = "recipes" | "auth" | "build";

const emptyRecipe: Recipe = {
  id: "",
  title: "",
  tags: [],
  ingredients: [],
  steps: [],
  notes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function App() {
  const [page, setPage] = useState<Page>("recipes");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<Recipe>(emptyRecipe);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [message, setMessage] = useState("Ready");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [stashCookToken, setStashCookToken] = useState("");
  const [markdown, setMarkdown] = useState("");

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0],
    [recipes, selectedId],
  );

  const loadRecipes = useCallback(async (nextQuery = "") => {
    const nextRecipes = await api.listRecipes(nextQuery);
    setRecipes(nextRecipes);
    setSelectedId((current) => current ?? nextRecipes[0]?.id);
  }, []);

  useEffect(() => {
    api
      .health()
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    setDraft(selectedRecipe ?? emptyRecipe);
  }, [selectedRecipe]);

  async function saveRecipe() {
    const payload = {
      title: draft.title,
      description: draft.description,
      imageUrl: draft.imageUrl,
      source: draft.source,
      prepTimeMinutes: draft.prepTimeMinutes,
      cookTimeMinutes: draft.cookTimeMinutes,
      totalTimeMinutes: draft.totalTimeMinutes,
      servings: draft.servings,
      tags: draft.tags,
      ingredients: draft.ingredients,
      steps: draft.steps,
      notes: draft.notes,
    };

    const saved = draft.id
      ? await api.updateRecipe(draft.id, payload)
      : await api.createRecipe(payload);

    setMessage(`Saved ${saved.title}`);
    await loadRecipes(query);
    setSelectedId(saved.id);
  }

  async function deleteSelectedRecipe() {
    if (!draft.id) {
      return;
    }
    await api.deleteRecipe(draft.id);
    setMessage(`Deleted ${draft.title}`);
    setSelectedId(undefined);
    await loadRecipes(query);
  }

  async function importWebsite() {
    const recipe = await api.importWebsite(websiteUrl);
    setMessage(`Imported ${recipe.title}`);
    setWebsiteUrl("");
    await loadRecipes(query);
    setSelectedId(recipe.id);
  }

  async function importMarkdown() {
    const recipe = await api.importMarkdown(markdown);
    setMessage(`Imported ${recipe.title}`);
    setMarkdown("");
    await loadRecipes(query);
    setSelectedId(recipe.id);
  }

  async function importStashCook() {
    const result = await api.importStashCook({ bearerToken: stashCookToken });
    setMessage(
      `StashCook import complete: ${result.created} created, ${result.updated} updated`,
    );
    setStashCookToken("");
    await loadRecipes(query);
    setSelectedId(result.recipes[0]?.id);
  }

  async function mirrorImages() {
    const result = await api.mirrorRecipeImages();
    setMessage(
      `Mirrored ${result.updated} images to public R2${
        result.failed ? `, ${result.failed} kept original URLs` : ""
      }`,
    );
    await loadRecipes(query);
  }

  return (
    <main className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      {page === "recipes" ? (
        <>
          <section className="recipe-column">
            <TopBar status={status} />
            <div className="search-row">
              <Search size={17} />
              <input
                aria-label="Search recipes"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadRecipes(event.currentTarget.value);
                  }
                }}
                placeholder="Search title, ingredients, tags, source"
                value={query}
              />
              <button type="button" onClick={() => void loadRecipes()}>
                Search
              </button>
            </div>
            <div className="recipe-list">
              {recipes.map((recipe) => (
                <button
                  className={`recipe-row ${recipe.id === draft.id ? "selected" : ""}`}
                  key={recipe.id}
                  onClick={() => setSelectedId(recipe.id)}
                  type="button"
                >
                  <RecipeThumb recipe={recipe} />
                  <span className="row-main">
                    <strong>{recipe.title}</strong>
                    <span>{recipe.tags.slice(0, 3).join(" / ") || "untagged"}</span>
                  </span>
                  <span className="source-chip">{recipe.source?.name ?? "local"}</span>
                </button>
              ))}
            </div>
            <ImporterPanel
              importMarkdown={importMarkdown}
              importStashCook={importStashCook}
              importWebsite={importWebsite}
              markdown={markdown}
              setMarkdown={setMarkdown}
              setStashCookToken={setStashCookToken}
              setWebsiteUrl={setWebsiteUrl}
              stashCookToken={stashCookToken}
              websiteUrl={websiteUrl}
            />
          </section>
          <RecipeEditor
            draft={draft}
            message={message}
            onChange={setDraft}
            onDelete={deleteSelectedRecipe}
            onMirrorImages={mirrorImages}
            onNew={() => {
              setDraft({
                ...emptyRecipe,
                id: "",
                title: "New recipe",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              setSelectedId(undefined);
            }}
            onSave={saveRecipe}
          />
        </>
      ) : page === "auth" ? (
        <AuthPage onRecipeWorkspace={() => setPage("recipes")} />
      ) : (
        <BuildPage />
      )}
    </main>
  );
}

function Sidebar({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <ChefHat size={26} />
        <strong>OpenCook</strong>
      </div>
      <button
        className={page === "recipes" ? "active" : ""}
        onClick={() => setPage("recipes")}
        type="button"
      >
        <LibraryBig size={18} />
        Recipes
      </button>
      <button type="button">
        <Import size={18} />
        Import
      </button>
      <button type="button">
        <Braces size={18} />
        API
      </button>
      <button type="button">
        <Download size={18} />
        Export
      </button>
      <button
        className={page === "auth" ? "active" : ""}
        onClick={() => setPage("auth")}
        type="button"
      >
        <UserRound size={18} />
        Account
      </button>
      <button
        className={page === "build" ? "active" : ""}
        onClick={() => setPage("build")}
        type="button"
      >
        <FileCode2 size={18} />
        Build yours
      </button>
      <button className="bottom" type="button">
        <Settings size={18} />
        Settings
      </button>
    </nav>
  );
}

function TopBar({ status }: { status: "checking" | "online" | "offline" }) {
  return (
    <header className="topbar">
      <div>
        <h1>Recipe Library</h1>
        <p>
          Own your recipes, expose them through OpenAPI, and let Codex build workflows
          on data you control.
        </p>
      </div>
      <div className="topbar-actions">
        <span className={`api-status ${status}`}>
          <ShieldCheck size={16} />
          {status === "online" ? "Local API online" : `API ${status}`}
        </span>
        <a href="/scalar" rel="noreferrer" target="_blank">
          <Braces size={16} />
          OpenAPI
        </a>
        <a href="/api/agents/manifest" rel="noreferrer" target="_blank">
          <FileCode2 size={16} />
          Agent manifest
        </a>
        <a href={githubUrl} rel="noreferrer" target="_blank">
          <Github size={16} />
          GitHub
        </a>
      </div>
    </header>
  );
}

function ImporterPanel({
  importMarkdown,
  importStashCook,
  importWebsite,
  markdown,
  setMarkdown,
  setStashCookToken,
  setWebsiteUrl,
  stashCookToken,
  websiteUrl,
}: {
  importMarkdown: () => Promise<void>;
  importStashCook: () => Promise<void>;
  importWebsite: () => Promise<void>;
  markdown: string;
  setMarkdown: (value: string) => void;
  setStashCookToken: (value: string) => void;
  setWebsiteUrl: (value: string) => void;
  stashCookToken: string;
  websiteUrl: string;
}) {
  return (
    <section className="import-panel">
      <div className="panel-title">
        <UploadCloud size={18} />
        <strong>Import</strong>
      </div>
      <div className="import-grid">
        <label>
          <span>
            <KeyRound size={15} />
            StashCook bearer token
          </span>
          <input
            onChange={(event) => setStashCookToken(event.target.value)}
            placeholder="Bearer token from your session"
            type="password"
            value={stashCookToken}
          />
          <button
            disabled={!stashCookToken}
            onClick={() => void importStashCook()}
            type="button"
          >
            Import StashCook
          </button>
        </label>
        <label>
          <span>
            <Globe2 size={15} />
            Recipe URL
          </span>
          <input
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://example.com/recipe"
            value={websiteUrl}
          />
          <button
            disabled={!websiteUrl}
            onClick={() => void importWebsite()}
            type="button"
          >
            Scrape recipe
          </button>
        </label>
        <label className="wide">
          <span>
            <BookOpen size={15} />
            Markdown
          </span>
          <textarea
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="# Recipe title&#10;&#10;## Ingredients&#10;- 1 thing&#10;&#10;## Method&#10;1. Cook it"
            value={markdown}
          />
          <button
            disabled={!markdown}
            onClick={() => void importMarkdown()}
            type="button"
          >
            Import Markdown
          </button>
        </label>
      </div>
    </section>
  );
}

function RecipeEditor({
  draft,
  message,
  onChange,
  onDelete,
  onMirrorImages,
  onNew,
  onSave,
}: {
  draft: Recipe;
  message: string;
  onChange: (recipe: Recipe) => void;
  onDelete: () => Promise<void>;
  onMirrorImages: () => Promise<void>;
  onNew: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <section className="detail-panel">
      <div className="detail-toolbar">
        <span>
          <CheckCircle2 size={16} />
          {message}
        </span>
        <div>
          <button type="button" onClick={onNew}>
            <Plus size={16} />
            New
          </button>
          <button type="button" onClick={() => void onSave()}>
            <Save size={16} />
            Save
          </button>
          <button type="button" onClick={() => void onDelete()}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <RecipeHero draft={draft} />

      <label className="field">
        Title
        <input
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          value={draft.title}
        />
      </label>
      <label className="field">
        Image URL
        <input
          onChange={(event) =>
            onChange({ ...draft, imageUrl: event.target.value || undefined })
          }
          placeholder="https://example.com/food.jpg"
          value={draft.imageUrl ?? ""}
        />
      </label>
      <label className="field">
        Source URL
        <input
          onChange={(event) =>
            onChange({
              ...draft,
              source: {
                ...(draft.source ?? {}),
                url: event.target.value || undefined,
              },
            })
          }
          value={draft.source?.url ?? ""}
        />
      </label>
      <div className="field-grid">
        <label className="field">
          Prep
          <input
            min="0"
            onChange={(event) =>
              onChange({
                ...draft,
                prepTimeMinutes: optionalNumber(event.target.value),
              })
            }
            type="number"
            value={draft.prepTimeMinutes ?? ""}
          />
        </label>
        <label className="field">
          Cook
          <input
            min="0"
            onChange={(event) =>
              onChange({
                ...draft,
                cookTimeMinutes: optionalNumber(event.target.value),
              })
            }
            type="number"
            value={draft.cookTimeMinutes ?? ""}
          />
        </label>
        <label className="field">
          Servings
          <input
            onChange={(event) => onChange({ ...draft, servings: event.target.value })}
            value={draft.servings ?? ""}
          />
        </label>
      </div>
      <label className="field">
        Tags
        <input
          onChange={(event) =>
            onChange({
              ...draft,
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
          value={draft.tags.join(", ")}
        />
      </label>
      <label className="field">
        Ingredients
        <textarea
          onChange={(event) =>
            onChange({
              ...draft,
              ingredients: lines(event.target.value).map((text) => ({ text })),
            })
          }
          value={draft.ingredients.map((ingredient) => ingredient.text).join("\n")}
        />
      </label>
      <label className="field">
        Method
        <textarea
          onChange={(event) =>
            onChange({
              ...draft,
              steps: lines(event.target.value).map((text) => ({ text })),
            })
          }
          value={draft.steps.map((step) => step.text).join("\n")}
        />
      </label>
      <div className="export-row">
        <button type="button" onClick={() => void onMirrorImages()}>
          <Image size={16} />
          Mirror images
        </button>
        <a href="/api/export/recipes/json">
          <Database size={16} />
          JSON
        </a>
        <a href="/api/export/recipes/markdown">
          <Download size={16} />
          Markdown
        </a>
        {draft.id ? (
          <a href={`/api/export/recipes/${draft.id}/markdown`}>
            <FileCode2 size={16} />
            This recipe
          </a>
        ) : null}
      </div>
    </section>
  );
}

function RecipeHero({ draft }: { draft: Recipe }) {
  return (
    <div className="recipe-hero">
      <RecipeThumb recipe={draft} large />
      <div>
        <h2>{draft.title || "Untitled recipe"}</h2>
        <p>{draft.description || "Local OpenCook recipe"}</p>
        <div className="meta-row">
          <span>{draft.prepTimeMinutes ?? "-"} min prep</span>
          <span>{draft.cookTimeMinutes ?? "-"} min cook</span>
          <span>{draft.servings ?? "servings unset"}</span>
        </div>
      </div>
    </div>
  );
}

function RecipeThumb({ recipe, large = false }: { recipe: Recipe; large?: boolean }) {
  return recipe.imageUrl ? (
    <img alt="" className={large ? "thumb large" : "thumb"} src={recipe.imageUrl} />
  ) : (
    <span className={large ? "thumb large fallback" : "thumb fallback"}>
      <ChefHat size={large ? 30 : 18} />
    </span>
  );
}

function BuildPage() {
  return (
    <section className="build-page">
      <header>
        <div>
          <h1>Build Your Own Recipe App</h1>
          <p>
            OpenCook keeps the recipe contract, OpenAPI schema, and exports portable so
            Codex can build new views and workflows without trapping the library inside
            another company account.
          </p>
        </div>
        <a className="primary-link" href={githubUrl} rel="noreferrer" target="_blank">
          <Github size={18} />
          GitHub repo
          <ExternalLink size={15} />
        </a>
      </header>
      <div className="principle-grid">
        <article>
          <LockKeyhole size={20} />
          <h2>Local first</h2>
          <p>The default store is a JSON file in your self-hosted API process.</p>
        </article>
        <article>
          <Braces size={20} />
          <h2>Codex native</h2>
          <p>Point Codex at `/openapi.json` and let it call real recipe endpoints.</p>
        </article>
        <article>
          <Download size={20} />
          <h2>Exit always</h2>
          <p>Every recipe can leave as Markdown or JSON without a support ticket.</p>
        </article>
        <article>
          <Image size={20} />
          <h2>Public food images</h2>
          <p>Recipe photos can be copied into public R2 URLs, no signed links.</p>
        </article>
      </div>
      <section className="demo-script">
        <h2>Demo surface</h2>
        <div className="script-row">
          <Link2 size={18} />
          <span>Scrape a public recipe URL through `/api/import/website`.</span>
        </div>
        <div className="script-row">
          <KeyRound size={18} />
          <span>Import your StashCook recipes with your own session token.</span>
        </div>
        <div className="script-row">
          <FileCode2 size={18} />
          <span>
            Ask Codex to inspect `/openapi.json`, then build a meal plan, shopping
            workflow, or another UI.
          </span>
        </div>
        <div className="script-row">
          <Braces size={18} />
          <span>Demo endpoint: `POST /api/agents/workflows/shopping-list`.</span>
        </div>
      </section>
    </section>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function optionalNumber(value: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
