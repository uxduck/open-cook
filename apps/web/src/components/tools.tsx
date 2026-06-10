import {
  ingredientBaseText,
  ingredientDisplayText,
  parseRecipeYield,
  type Recipe,
  type RecipeImage,
  type RecipeIngredient,
  type RecipeShare,
  type RecipeStep,
  type RecipeVisibility,
  recipeSearchText,
  type SharedRecipe,
  servingScaleFactor,
  structureIngredients,
  structureSteps,
} from "@open-cook/core";
import { ArrowLeft, ArchiveX, BookOpen, Braces, CheckCircle2, ChefHat, Clipboard, Clock3, Compass, Copy, Database, Download, ExternalLink, FileCode2, FileText, Github, Globe2, GripVertical, Image, ImagePlus, KeyRound, LibraryBig, Link2, ListChecks, Loader2, LockKeyhole, LogIn, Minus, Plus, RefreshCcw, Save, Search, Server, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, UploadCloud, UserPlus, UserRound, Users, Wand2, Workflow, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AgentManifest,
  type ApiInfo,
  api,
  type OpenApiDocument,
  type ShoppingListResult,
} from "../api";
import { authApi, type CurrentAuthSession } from "../authApi";
import { displayImageUrl } from "../imageDisplayUrl";
import {
  type MarketingFoodAsset,
  marketingFeatureAssets,
  marketingHeroAsset,
  marketingIngredientAssets,
} from "../marketingAssets";
import { Button, buttonClassName } from "../ui";
import {
  type AuthIntent, demoRecipes, emptyNoteClass, emptyRecipe, errorMessage, footnoteClass, githubUrl, hasIngredientStructure, importSourceLabels, ingredientWithText, marketingPreviewRecipes, marketingSocialLinkClass, optionalNumber, optionalQuantity, type Page, previewText, readOnlyListClass, recipeAutoSaveDebounceMs, recipeImagesOf, recipeSavePayload, recipeSearchDebounceMs, type RecipeSection, recipesFromStashCookExport, recipeTimeSummary, remixDemoResultTitles, remixPromptAt, remixPromptExamples, type SaveState, sharedRecipeKey, shortDate, themeExamples, useDebouncedValue, visibilityPillClass, xProfileUrl,
} from "../lib/recipe";
import { RecipeThumb } from "./recipeViews";

export function ApiPage({
  recipes,
  status,
}: {
  recipes: Recipe[];
  status: "checking" | "online" | "offline";
}) {
  const [info, setInfo] = useState<ApiInfo>();
  const [manifest, setManifest] = useState<AgentManifest>();
  const [openApi, setOpenApi] = useState<OpenApiDocument>();
  const [apiMessage, setApiMessage] = useState("Loading API metadata");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListResult>();

  const loadApiMetadata = useCallback(async () => {
    try {
      const [nextInfo, nextManifest, nextOpenApi] = await Promise.all([
        api.info(),
        api.agentManifest(),
        api.openApi(),
      ]);
      setInfo(nextInfo);
      setManifest(nextManifest);
      setOpenApi(nextOpenApi);
      setApiMessage("API metadata loaded");
    } catch (error) {
      setApiMessage(`API metadata failed: ${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadApiMetadata();
  }, [loadApiMetadata]);

  useEffect(() => {
    setSelectedRecipeIds((current) => {
      const availableIds = new Set(recipes.map((recipe) => recipe.id));
      const retained = current.filter((id) => availableIds.has(id));
      return retained.length
        ? retained
        : recipes.slice(0, 3).map((recipe) => recipe.id);
    });
  }, [recipes]);

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setApiMessage(`Copied ${path}`);
    } catch (error) {
      setApiMessage(`Copy failed: ${errorMessage(error)}`);
    }
  }

  async function generateShoppingList() {
    if (!selectedRecipeIds.length) {
      setApiMessage("Select at least one recipe");
      return;
    }

    try {
      const result = await api.shoppingList(selectedRecipeIds);
      setShoppingList(result);
      setApiMessage(`Generated ${result.items.length} shopping-list items`);
    } catch (error) {
      setApiMessage(`Workflow failed: ${errorMessage(error)}`);
    }
  }

  function toggleRecipe(recipeId: string) {
    setSelectedRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    );
  }

  const endpointCount = Object.keys(openApi?.paths ?? {}).length;

  return (
    <section className="workspace-page">
      <WorkspaceHeader
        description="Inspect the live API contract, service metadata, and agent workflow surface so you can build your own OpenCook tools against the OpenAPI spec."
        icon={<Braces size={25} />}
        title="API"
      >
        <span className={`api-status ${status}`}>
          <ShieldCheck size={16} />
          {status === "online" ? "Local API online" : `API ${status}`}
        </span>
        <Button onClick={() => void loadApiMetadata()} size="sm">
          <RefreshCcw size={16} />
          Refresh
        </Button>
      </WorkspaceHeader>

      <div className="metric-grid">
        <MetricCard
          detail={info?.version ?? "Waiting for /api/info"}
          icon={<Server size={20} />}
          label="Service"
          value={info?.product ?? "OpenCook"}
        />
        <MetricCard
          detail={openApi?.info?.version ?? "OpenAPI document"}
          icon={<Braces size={20} />}
          label="Endpoints"
          value={endpointCount ? endpointCount.toString() : "-"}
        />
        <MetricCard
          detail={info?.storage.replaceable ? "Replaceable adapter" : "Fixed adapter"}
          icon={<Database size={20} />}
          label="Storage"
          value={info?.storage.adapter ?? "-"}
        />
        <MetricCard
          detail={info?.imageAssets.publicRoute ?? "Image route"}
          icon={<Image size={20} />}
          label="Images"
          value={info?.imageAssets.adapter ?? "-"}
        />
      </div>

      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-title">
            <Clipboard size={18} />
            <strong>Contracts</strong>
          </div>
          <div className="endpoint-grid">
            <a
              className="endpoint-card"
              href="/openapi.json"
              target="_blank"
              rel="noopener"
            >
              <Braces size={18} />
              <span>
                <strong>OpenAPI JSON</strong>
                <small>/openapi.json</small>
              </span>
            </a>
            <a className="endpoint-card" href="/scalar" target="_blank" rel="noopener">
              <FileCode2 size={18} />
              <span>
                <strong>Scalar Docs</strong>
                <small>/scalar</small>
              </span>
            </a>
            <a
              className="endpoint-card"
              href="/api/agents/manifest"
              target="_blank"
              rel="noopener"
            >
              <Workflow size={18} />
              <span>
                <strong>Agent manifest</strong>
                <small>/api/agents/manifest</small>
              </span>
            </a>
            <button
              className="endpoint-card"
              onClick={() => void copyPath("/api/recipes")}
              type="button"
            >
              <Database size={18} />
              <span>
                <strong>Recipes endpoint</strong>
                <small>/api/recipes</small>
              </span>
            </button>
          </div>
          <p className="inline-status">{apiMessage}</p>
        </section>

        <section className="workspace-panel">
          <div className="panel-title">
            <Search size={18} />
            <strong>Agent tools</strong>
          </div>
          <div className="workflow-list">
            {(manifest?.tools ?? []).map((tool) => (
              <div className="workflow-row" key={tool.path}>
                <span className="method-chip">{tool.method}</span>
                <code>{tool.path}</code>
                <small>{tool.description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="workspace-panel">
          <div className="panel-title">
            <Workflow size={18} />
            <strong>Agent workflows</strong>
          </div>
          <div className="workflow-list">
            {(manifest?.workflows ?? []).map((workflow) => (
              <div className="workflow-row" key={workflow.path}>
                <span className="method-chip">{workflow.method}</span>
                <code>{workflow.path}</code>
                <small>{workflow.description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="workspace-panel workflow-panel">
          <div className="panel-title">
            <ListChecks size={18} />
            <strong>Shopping-list workflow</strong>
          </div>
          <div className="recipe-picker">
            {recipes.map((recipe) => (
              <label className="check-row" key={recipe.id}>
                <input
                  checked={selectedRecipeIds.includes(recipe.id)}
                  onChange={() => toggleRecipe(recipe.id)}
                  type="checkbox"
                />
                <span>{recipe.title}</span>
              </label>
            ))}
          </div>
          <div className="button-row">
            <Button
              onClick={() => setSelectedRecipeIds(recipes.map((recipe) => recipe.id))}
              size="sm"
            >
              Select all
            </Button>
            <Button onClick={() => setSelectedRecipeIds([])} size="sm">
              Clear
            </Button>
            <Button
              disabled={!selectedRecipeIds.length}
              onClick={() => void generateShoppingList()}
              size="sm"
              variant="primary"
            >
              <ListChecks size={16} />
              Generate
            </Button>
          </div>
        </section>

        <section className="workspace-panel workflow-panel">
          <div className="panel-title">
            <FileText size={18} />
            <strong>Workflow output</strong>
          </div>
          {shoppingList ? (
            <>
              <p className="inline-status">
                {shoppingList.recipeCount} recipes, {shoppingList.items.length} items
              </p>
              <ul className="result-list">
                {shoppingList.items.slice(0, 40).map((item) => (
                  <li key={`${item.text}-${item.recipes.join(",")}`}>
                    <strong>{item.text}</strong>
                    <span>{item.recipes.join(" / ")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-state">No workflow output yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}

export function ExportPage({
  message,
  onMirrorImages,
  recipes,
  selectedRecipe,
}: {
  message: string;
  onMirrorImages: () => Promise<void>;
  recipes: Recipe[];
  selectedRecipe?: Recipe;
}) {
  const [exportRecipeId, setExportRecipeId] = useState(selectedRecipe?.id ?? "");
  const [previewTitle, setPreviewTitle] = useState("No preview loaded");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!exportRecipeId && selectedRecipe?.id) {
      setExportRecipeId(selectedRecipe.id);
    }
  }, [exportRecipeId, selectedRecipe]);

  const selectedExportRecipe =
    recipes.find((recipe) => recipe.id === exportRecipeId) ?? selectedRecipe;
  const taggedCount = recipes.filter((recipe) => recipe.tags.length > 0).length;
  const sourceCount = new Set(
    recipes.map((recipe) => recipe.source?.name ?? recipe.source?.url).filter(Boolean),
  ).size;
  const latestUpdate = recipes.reduce<string | undefined>((latest, recipe) => {
    if (!latest || recipe.updatedAt > latest) {
      return recipe.updatedAt;
    }
    return latest;
  }, undefined);

  async function previewJson() {
    try {
      const result = await api.exportAllJson();
      setPreviewTitle("All recipes JSON");
      setPreview(previewText(JSON.stringify(result, null, 2)));
    } catch (error) {
      setPreviewTitle("JSON preview failed");
      setPreview(errorMessage(error));
    }
  }

  async function previewMarkdown() {
    try {
      setPreviewTitle("All recipes Markdown");
      setPreview(previewText(await api.exportAllMarkdown()));
    } catch (error) {
      setPreviewTitle("Markdown preview failed");
      setPreview(errorMessage(error));
    }
  }

  async function previewRecipeMarkdown() {
    if (!selectedExportRecipe) {
      return;
    }
    try {
      setPreviewTitle(`${selectedExportRecipe.title} Markdown`);
      setPreview(previewText(await api.exportRecipeMarkdown(selectedExportRecipe.id)));
    } catch (error) {
      setPreviewTitle("Recipe preview failed");
      setPreview(errorMessage(error));
    }
  }

  return (
    <section className="workspace-page">
      <WorkspaceHeader
        description="Your recipe data belongs to you. Export portable JSON or Markdown at any time, preview the result, and mirror image assets before leaving another account behind."
        icon={<Download size={25} />}
        title="Export"
      >
        <span className="status-pill">
          <CheckCircle2 size={16} />
          {message}
        </span>
        <Button onClick={() => void onMirrorImages()} size="sm">
          <Image size={16} />
          Mirror images
        </Button>
      </WorkspaceHeader>

      <div className="metric-grid">
        <MetricCard
          detail="Included in JSON and Markdown"
          icon={<Database size={20} />}
          label="Recipes"
          value={recipes.length.toString()}
        />
        <MetricCard
          detail="Have at least one tag"
          icon={<LibraryBig size={20} />}
          label="Tagged"
          value={taggedCount.toString()}
        />
        <MetricCard
          detail="Distinct source names or URLs"
          icon={<Globe2 size={20} />}
          label="Sources"
          value={sourceCount.toString()}
        />
        <MetricCard
          detail={latestUpdate ? shortDate(latestUpdate) : "No recipes"}
          icon={<RefreshCcw size={20} />}
          label="Latest update"
          value={latestUpdate ? "Synced" : "-"}
        />
      </div>

      <div className="workspace-grid">
        <section className="workspace-panel">
          <div className="panel-title">
            <Download size={18} />
            <strong>Downloads</strong>
          </div>
          <div className="endpoint-grid">
            <a className="endpoint-card" href="/api/export/recipes/json">
              <Database size={18} />
              <span>
                <strong>All recipes JSON</strong>
                <small>/api/export/recipes/json</small>
              </span>
            </a>
            <a className="endpoint-card" href="/api/export/recipes/markdown">
              <FileText size={18} />
              <span>
                <strong>All recipes Markdown</strong>
                <small>/api/export/recipes/markdown</small>
              </span>
            </a>
            {selectedExportRecipe ? (
              <a
                className="endpoint-card"
                href={`/api/export/recipes/${selectedExportRecipe.id}/markdown`}
              >
                <FileCode2 size={18} />
                <span>
                  <strong>Selected recipe</strong>
                  <small>{selectedExportRecipe.title}</small>
                </span>
              </a>
            ) : null}
          </div>
        </section>

        <section className="workspace-panel">
          <div className="panel-title">
            <FileCode2 size={18} />
            <strong>Preview</strong>
          </div>
          <div className="workspace-form">
            <label className="field">
              Recipe
              <select
                onChange={(event) => setExportRecipeId(event.target.value)}
                value={selectedExportRecipe?.id ?? ""}
              >
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <Button onClick={() => void previewJson()} size="sm">
                JSON
              </Button>
              <Button onClick={() => void previewMarkdown()} size="sm">
                Markdown
              </Button>
              <Button
                disabled={!selectedExportRecipe}
                onClick={() => void previewRecipeMarkdown()}
                size="sm"
                variant="primary"
              >
                This recipe
              </Button>
            </div>
          </div>
        </section>

        <section className="workspace-panel preview-panel">
          <div className="panel-title">
            <FileText size={18} />
            <strong>{previewTitle}</strong>
          </div>
          <pre className="code-preview">{preview || "Choose an export preview."}</pre>
        </section>
      </div>
    </section>
  );
}

function AccountNameForm({
  onRefreshSession,
  session,
}: {
  onRefreshSession: () => Promise<CurrentAuthSession | null>;
  session: CurrentAuthSession;
}) {
  const currentName = session.user.name ?? "";
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Keep the field in sync if the session name changes elsewhere (e.g. after a refresh).
  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== currentName;

  const save = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setStatus(null);
    try {
      await authApi.updateUser({ name: trimmed });
      await onRefreshSession();
      setStatus("Name updated");
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [dirty, onRefreshSession, trimmed]);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label
        className="text-[13px] font-extrabold text-(--color-fog)"
        htmlFor="account-name"
      >
        Display name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoComplete="name"
          className="min-h-[38px] flex-1 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) px-2.5 py-2 text-sm text-(--color-ink)"
          disabled={saving}
          id="account-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          value={name}
        />
        <Button disabled={!dirty || saving} size="sm" type="submit" variant="primary">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save
        </Button>
      </div>
      {status ? <small className="text-(--color-fog)">{status}</small> : null}
    </form>
  );
}

export function SettingsPage({
  message,
  onCreateAccount,
  onGoToPage,
  onLogIn,
  onMirrorImages,
  onRefreshRecipes,
  onRefreshSession,
  onSignOut,
  session,
  sessionLoading,
  status,
}: {
  message: string;
  onCreateAccount: () => void;
  onGoToPage: (page: Page) => void;
  onLogIn: () => void;
  onMirrorImages: () => Promise<void>;
  onRefreshRecipes: () => Promise<void>;
  onRefreshSession: () => Promise<CurrentAuthSession | null>;
  onSignOut: () => Promise<void>;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
  status: "checking" | "online" | "offline";
}) {
  const [info, setInfo] = useState<ApiInfo>();
  const [settingsMessage, setSettingsMessage] = useState("Diagnostics not loaded");

  const refreshDiagnostics = useCallback(async () => {
    try {
      const nextInfo = await api.info();
      setInfo(nextInfo);
      setSettingsMessage("Diagnostics refreshed");
    } catch (error) {
      setSettingsMessage(`Diagnostics failed: ${errorMessage(error)}`);
    }
  }, []);

  return (
    <section className="workspace-page settings-page mx-auto w-full max-w-[1180px] justify-self-center">
      <WorkspaceHeader
        description="Manage your account and the recipe data you choose to bring in or take with you."
        icon={<SlidersHorizontal size={25} />}
        title="Settings"
      >
        <span className={`settings-user-state ${session ? "signed-in" : "signed-out"}`}>
          <UserRound size={16} />
          {sessionLoading
            ? "Checking account"
            : session
              ? "Signed in"
              : "Not signed in"}
        </span>
      </WorkspaceHeader>

      <div className="settings-layout">
        <section className="settings-card settings-account-card">
          <div className="settings-card-heading">
            <span>
              <UserRound size={18} />
            </span>
            <div>
              <h2>Account</h2>
              <p>
                {session
                  ? "You are signed in to OpenCook with this email."
                  : "Sign in to keep your cookbook available across sessions."}
              </p>
            </div>
          </div>

          <div className="settings-account-summary">
            <span className="settings-avatar">
              <UserRound size={20} />
            </span>
            <div>
              <strong>{session?.user.email ?? "No account connected"}</strong>
              <small>
                {sessionLoading
                  ? "Checking your session"
                  : session?.user.emailVerified
                    ? "Email verified"
                    : session
                      ? "Email not verified"
                      : "Create an account or log in"}
              </small>
            </div>
          </div>

          {session ? (
            <AccountNameForm onRefreshSession={onRefreshSession} session={session} />
          ) : null}

          <div className="settings-action-row">
            {session ? (
              <Button onClick={() => void onSignOut()} size="sm">
                Log out
              </Button>
            ) : (
              <>
                <Button onClick={onCreateAccount} size="sm" variant="primary">
                  <UserPlus size={16} />
                  Create account
                </Button>
                <Button onClick={onLogIn} size="sm">
                  <LogIn size={16} />
                  Log in
                </Button>
              </>
            )}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <span>
              <Database size={18} />
            </span>
            <div>
              <h2>Recipe data</h2>
              <p>
                Your recipes belong to you: move them in, export them anytime, or copy
                remote images into OpenCook.
              </p>
            </div>
          </div>

          <div className="settings-option-list">
            <button
              className="settings-option"
              onClick={() => onGoToPage("recipes")}
              type="button"
            >
              <UploadCloud size={18} />
              <span>
                <strong>Import recipes</strong>
                <small>
                  Add recipes from a website, Markdown, or StashCook export.
                </small>
              </span>
            </button>
            <button
              className="settings-option"
              onClick={() => onGoToPage("export")}
              type="button"
            >
              <Download size={18} />
              <span>
                <strong>Export cookbook</strong>
                <small>
                  Download portable JSON or Markdown copies whenever you want.
                </small>
              </span>
            </button>
            <button
              className="settings-option"
              onClick={() => void onRefreshRecipes()}
              type="button"
            >
              <RefreshCcw size={18} />
              <span>
                <strong>Refresh recipes</strong>
                <small>Reload the latest recipe data from OpenCook.</small>
              </span>
            </button>
            <button
              className="settings-option"
              onClick={() => void onMirrorImages()}
              type="button"
            >
              <Image size={18} />
              <span>
                <strong>Save recipe images</strong>
                <small>Copy remote recipe images into OpenCook storage.</small>
              </span>
            </button>
          </div>
          <p className="settings-message">{message}</p>
        </section>

        <details
          className="settings-advanced"
          onToggle={(event) => {
            if (event.currentTarget.open && !info) {
              void refreshDiagnostics();
            }
          }}
        >
          <summary>
            <span>
              <Settings size={18} />
              <span>
                <strong>Advanced diagnostics</strong>
                <small>API, auth, and asset details for debugging.</small>
              </span>
            </span>
          </summary>
          <div className="settings-diagnostics">
            <div className="settings-action-row">
              <span className={`api-status ${status}`}>
                <ShieldCheck size={16} />
                {status === "online" ? "API online" : `API ${status}`}
              </span>
              <Button onClick={() => void refreshDiagnostics()} size="sm">
                <RefreshCcw size={16} />
                Refresh diagnostics
              </Button>
            </div>
            <div className="settings-list">
              <RuntimeRow label="Product" value={info?.product ?? "-"} />
              <RuntimeRow label="Version" value={info?.version ?? "-"} />
              <RuntimeRow label="API base path" value={info?.apiBasePath ?? "-"} />
              <RuntimeRow
                label="Storage adapter"
                value={info?.storage.adapter ?? "-"}
              />
              <RuntimeRow label="Auth adapter" value={info?.auth.adapter ?? "-"} />
              <RuntimeRow
                label="Image public route"
                value={info?.imageAssets.publicRoute ?? "-"}
              />
            </div>
            <p className="inline-status">{settingsMessage}</p>
          </div>
        </details>
      </div>
    </section>
  );
}

export function BuildPage() {
  return (
    <section className="build-page">
      <header>
        <div>
          <h1>Build Your Own Recipe App</h1>
          <p>
            OpenCook keeps the recipe contract, OpenAPI schema, and exports portable so
            Codex can build new views and workflows without trapping your recipes inside
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

export function WorkspaceHeader({
  children,
  description,
  icon,
  onBack,
  title,
}: {
  children?: ReactNode;
  description: string;
  icon: ReactNode;
  onBack?: () => void;
  title: string;
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-title">
        {onBack ? (
          <Button
            aria-label="Back to recipes"
            className="workspace-back"
            onClick={onBack}
            size="icon"
          >
            <ArrowLeft size={17} />
          </Button>
        ) : null}
        <span className="workspace-icon">{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {children ? <div className="workspace-actions">{children}</div> : null}
    </header>
  );
}

export function MetricCard({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

export function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="runtime-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
