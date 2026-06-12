import type { Recipe } from "@open-cook/core";
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Github,
  Globe2,
  Image,
  KeyRound,
  LibraryBig,
  Link2,
  ListChecks,
  Loader2,
  LockKeyhole,
  LogIn,
  RefreshCcw,
  Save,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  UserPlus,
  UserRound,
  Workflow,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  type AgentManifest,
  type ApiInfo,
  type BillingSummary,
  api,
  type OpenApiDocument,
  type ShoppingListResult,
} from "../api";
import { authApi, type CurrentAuthSession } from "../authApi";
import {
  apiStatusClassName,
  Button,
  buttonRowClassName,
  checkRowClassName,
  fieldClassName,
  inlineStatusClassName,
  panelTitleClassName,
  workspacePageBaseClassName,
  workspacePageClassName,
  workspacePanelClassName,
} from "../ui";
import {
  errorMessage,
  githubUrl,
  type Page,
  previewText,
  shortDate,
} from "../lib/recipe";

const endpointCardClassName =
  "flex min-h-[66px] w-full items-start justify-start gap-2 rounded-lg p-3 text-left disabled:cursor-default disabled:bg-[#d9d1c4] disabled:text-[#82796e] [&>span]:grid [&>span]:min-w-0 [&>span]:gap-0.5 [&_small]:text-xs [&_small]:text-(--color-pop-muted-ink) [&_small]:[overflow-wrap:anywhere] [&_strong]:[overflow-wrap:anywhere]";

const settingsCardClassName =
  "grid min-w-0 content-start gap-4 self-start rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-[18px] shadow-[0_10px_26px_rgba(54,42,27,0.05)]";

const settingsCardHeadingClassName =
  "grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:leading-[1.2] [&_h2]:tracking-normal [&_h2]:text-(--color-ink) [&_p]:mx-0 [&_p]:mt-1 [&_p]:mb-0 [&_p]:max-w-[52ch] [&_p]:text-[13px] [&_p]:leading-[1.45] [&_p]:text-(--color-fog)";

const settingsBadgeClassName =
  "inline-flex size-[38px] items-center justify-center rounded-lg border border-solid border-(--color-sage-line) bg-(--color-sage-soft) text-(--color-sage)";

const settingsOptionClassName =
  "grid min-h-[58px] cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-start gap-[11px] rounded-lg border border-solid border-(--color-line) bg-[rgba(255,253,248,0.72)] p-3 text-left text-(--color-ink) hover:border-[#c8baa8] hover:bg-(--color-paper) [&>span]:grid [&>span]:min-w-0 [&>span]:gap-[3px] [&>svg]:mt-px [&>svg]:text-(--color-sage) [&_small]:text-xs [&_small]:leading-[1.35] [&_small]:text-(--color-fog) [&_strong]:text-sm [&_strong]:leading-[1.2]";

const settingsAdvancedClassName =
  "group col-span-full min-w-0 self-start rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-0 shadow-[0_10px_26px_rgba(54,42,27,0.05)]";

const settingsSummaryClassName =
  "relative flex cursor-pointer list-none items-center justify-between gap-3.5 px-[18px] py-4 text-(--color-ink) after:text-lg after:font-[760] after:text-(--color-fog) after:content-['+'] group-open:border-b group-open:border-solid group-open:border-(--color-line) group-open:after:content-['-'] max-[820px]:flex-col max-[820px]:items-start max-[820px]:gap-1.5 max-[820px]:after:absolute max-[820px]:after:right-[18px] [&::-webkit-details-marker]:hidden";

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
    <section className={workspacePageClassName}>
      <WorkspaceHeader
        description="Inspect the live API contract, service metadata, and agent workflow surface so you can build your own OpenCook tools against the OpenAPI spec."
        icon={<Braces size={25} />}
        title="API"
      >
        <span className={apiStatusClassName(status)}>
          <ShieldCheck size={16} />
          {status === "online" ? "Local API online" : `API ${status}`}
        </span>
        <Button onClick={() => void loadApiMetadata()} size="sm">
          <RefreshCcw size={16} />
          Refresh
        </Button>
      </WorkspaceHeader>

      <div className="mt-[18px] grid grid-cols-4 gap-3 max-[860px]:grid-cols-1">
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

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 max-[860px]:grid-cols-1">
        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <Clipboard size={18} />
            <strong>Contracts</strong>
          </div>
          <div className="grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1">
            <a
              className={endpointCardClassName}
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
            <a
              className={endpointCardClassName}
              href="/scalar"
              target="_blank"
              rel="noopener"
            >
              <FileCode2 size={18} />
              <span>
                <strong>Scalar Docs</strong>
                <small>/scalar</small>
              </span>
            </a>
            <a
              className={endpointCardClassName}
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
              className={endpointCardClassName}
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
          <p className={inlineStatusClassName}>{apiMessage}</p>
        </section>

        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <Search size={18} />
            <strong>Agent tools</strong>
          </div>
          <div className="grid gap-2">
            {(manifest?.tools ?? []).map((tool) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-1 border-t border-solid border-[#eee7dc] pt-2 [&>code]:[overflow-wrap:anywhere] [&>small]:text-xs [&>small]:text-(--color-pop-muted-ink)"
                key={tool.path}
              >
                <span className="self-start rounded-full bg-[color-mix(in_oklch,var(--color-pop-secondary)_14%,white)] px-[7px] py-[3px] text-[11px] font-extrabold text-(--color-pop-primary)">
                  {tool.method}
                </span>
                <code>{tool.path}</code>
                <small>{tool.description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <Workflow size={18} />
            <strong>Agent workflows</strong>
          </div>
          <div className="grid gap-2">
            {(manifest?.workflows ?? []).map((workflow) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-1 border-t border-solid border-[#eee7dc] pt-2 [&>code]:[overflow-wrap:anywhere] [&>small]:text-xs [&>small]:text-(--color-pop-muted-ink)"
                key={workflow.path}
              >
                <span className="self-start rounded-full bg-[color-mix(in_oklch,var(--color-pop-secondary)_14%,white)] px-[7px] py-[3px] text-[11px] font-extrabold text-(--color-pop-primary)">
                  {workflow.method}
                </span>
                <code>{workflow.path}</code>
                <small>{workflow.description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <ListChecks size={18} />
            <strong>Shopping-list workflow</strong>
          </div>
          <div className="grid max-h-60 gap-2 overflow-auto rounded-lg border border-solid border-[#eee7dc] p-2.5">
            {recipes.map((recipe) => (
              <label className={checkRowClassName} key={recipe.id}>
                <input
                  checked={selectedRecipeIds.includes(recipe.id)}
                  onChange={() => toggleRecipe(recipe.id)}
                  type="checkbox"
                />
                <span>{recipe.title}</span>
              </label>
            ))}
          </div>
          <div className={buttonRowClassName}>
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

        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <FileText size={18} />
            <strong>Workflow output</strong>
          </div>
          {shoppingList ? (
            <>
              <p className={inlineStatusClassName}>
                {shoppingList.recipeCount} recipes, {shoppingList.items.length} items
              </p>
              <ul className="m-0 grid max-h-[300px] list-none gap-2 overflow-auto p-0 [&>li]:grid [&>li]:gap-0.5 [&>li]:border-t [&>li]:border-solid [&>li]:border-[#eee7dc] [&>li]:pt-2 [&_span]:text-xs [&_span]:text-(--color-pop-muted-ink)">
                {shoppingList.items.slice(0, 40).map((item) => (
                  <li key={`${item.text}-${item.recipes.join(",")}`}>
                    <strong>{item.text}</strong>
                    <span>{item.recipes.join(" / ")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="m-0 text-(--color-pop-muted-ink)">No workflow output yet.</p>
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
    <section className={workspacePageClassName}>
      <WorkspaceHeader
        description="Your recipe data belongs to you. Export portable JSON or Markdown at any time, preview the result, and mirror image assets before leaving another account behind."
        icon={<Download size={25} />}
        title="Export"
      >
        <span className={inlineStatusClassName}>
          <CheckCircle2 size={16} />
          {message}
        </span>
        <Button onClick={() => void onMirrorImages()} size="sm">
          <Image size={16} />
          Mirror images
        </Button>
      </WorkspaceHeader>

      <div className="mt-[18px] grid grid-cols-4 gap-3 max-[860px]:grid-cols-1">
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

      <div className="mt-3.5 grid grid-cols-2 gap-3.5 max-[860px]:grid-cols-1">
        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <Download size={18} />
            <strong>Downloads</strong>
          </div>
          <div className="grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1">
            <a className={endpointCardClassName} href="/api/export/recipes/json">
              <Database size={18} />
              <span>
                <strong>All recipes JSON</strong>
                <small>/api/export/recipes/json</small>
              </span>
            </a>
            <a className={endpointCardClassName} href="/api/export/recipes/markdown">
              <FileText size={18} />
              <span>
                <strong>All recipes Markdown</strong>
                <small>/api/export/recipes/markdown</small>
              </span>
            </a>
            {selectedExportRecipe ? (
              <a
                className={endpointCardClassName}
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

        <section className={workspacePanelClassName}>
          <div className={panelTitleClassName}>
            <FileCode2 size={18} />
            <strong>Preview</strong>
          </div>
          <div className="grid gap-2.5">
            <label className={fieldClassName}>
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
            <div className={buttonRowClassName}>
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

        <section className={`${workspacePanelClassName} col-span-full`}>
          <div className={panelTitleClassName}>
            <FileText size={18} />
            <strong>{previewTitle}</strong>
          </div>
          <pre className="m-0 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-ink) p-3.5 text-xs text-(--color-pop-card)">
            {preview || "Choose an export preview."}
          </pre>
        </section>
      </div>
    </section>
  );
}

export function BillingPage({
  onCreateAccount,
  onGoToPricing,
  onLogIn,
  session,
  sessionLoading,
}: {
  onCreateAccount: () => void;
  onGoToPricing: () => void;
  onLogIn: () => void;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
}) {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState(false);

  useEffect(() => {
    if (sessionLoading) {
      return undefined;
    }

    if (!session) {
      setBilling(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .billingSummary()
      .then((summary) => {
        if (!cancelled) {
          setBilling(summary);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load billing.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  const openPortal = useCallback(async () => {
    setError(null);
    setPortalPending(true);
    try {
      const { url } = await api.openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't open the billing portal.",
      );
      setPortalPending(false);
    }
  }, []);

  const plan = billing?.plan ?? session?.user.plan ?? "free";
  const isPro = plan === "pro";
  const totalCredits = (billing?.balances ?? []).reduce(
    (sum, pool) => sum + pool.available,
    0,
  );

  return (
    <section className={workspacePageClassName}>
      <WorkspaceHeader
        description="Review your plan, credit balance, and billing portal access without leaving the OpenCook app."
        icon={<CreditCard size={25} />}
        title="Billing"
      >
        <span
          className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-solid px-[11px] py-2 text-[13px] font-[760] ${
            session
              ? "border-(--color-sage-line) bg-(--color-sage-soft) text-(--color-sage)"
              : "border-[#ead0b6] bg-[#fff8ed] text-[#8a4d2a]"
          }`}
        >
          <UserRound size={16} />
          {sessionLoading
            ? "Checking account"
            : session
              ? session.user.email
              : "Not signed in"}
        </span>
      </WorkspaceHeader>

      <div className="mt-[18px] grid max-w-[920px] gap-3.5">
        {!session ? (
          <section className={workspacePanelClassName}>
            <div className={panelTitleClassName}>
              <UserRound size={18} />
              <strong>Account required</strong>
            </div>
            <p className="m-0 max-w-[60ch] text-sm leading-6 text-(--color-fog)">
              Sign in to view your plan, manage billing, or buy OpenCook credits.
            </p>
            <div className={buttonRowClassName}>
              <Button onClick={onLogIn} size="sm">
                <LogIn size={16} />
                Log in
              </Button>
              <Button onClick={onCreateAccount} size="sm" variant="primary">
                <UserPlus size={16} />
                Create account
              </Button>
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="m-0 rounded-lg border-2 border-(--destructive) bg-(--color-panel) px-4 py-3 text-sm font-bold text-(--destructive)">
            {error}
          </p>
        ) : null}

        {session ? (
          <section className={workspacePanelClassName}>
            <div className={panelTitleClassName}>
              <CreditCard size={18} />
              <strong>Plan and credits</strong>
            </div>

            {loading ? (
              <p className="m-0 flex items-center gap-2 text-sm font-bold text-(--color-fog)">
                <Loader2 size={16} className="animate-spin" />
                Loading billing
              </p>
            ) : (
              <div className="grid gap-5">
                <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
                  <MetricCard
                    detail={isPro ? "Chef subscription" : "Free OpenCook plan"}
                    icon={<CreditCard size={20} />}
                    label="Current plan"
                    value={isPro ? "Chef" : "Free"}
                  />
                  <MetricCard
                    detail="Available for AI recipe actions"
                    icon={<Sparkles size={20} />}
                    label="Credit balance"
                    value={`${totalCredits.toLocaleString()} credits`}
                  />
                </div>

                {billing && !billing.billingEnabled ? (
                  <p className="m-0 rounded-lg border border-solid border-(--color-line) bg-[rgba(255,253,248,0.72)] px-3 py-2.5 text-sm font-bold text-(--color-fog)">
                    Billing isn't configured in this environment yet.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {isPro ? (
                    <Button
                      disabled={portalPending}
                      onClick={() => void openPortal()}
                      size="sm"
                      variant="primary"
                    >
                      {portalPending ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <ExternalLink size={16} />
                      )}
                      {portalPending ? "Opening" : "Manage billing"}
                    </Button>
                  ) : (
                    <Button onClick={onGoToPricing} size="sm" variant="primary">
                      <Sparkles size={16} />
                      Upgrade to Chef
                    </Button>
                  )}
                  <Button onClick={onGoToPricing} size="sm">
                    Buy credits
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}
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
  onOpenOnboarding,
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
  onOpenOnboarding: () => void;
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
    <section
      className={`${workspacePageBaseClassName} mx-auto w-full max-w-[1180px] justify-self-center bg-[#f9f7f0] [background-image:linear-gradient(180deg,rgba(255,253,248,0.72),rgba(249,247,240,0.96))]`}
    >
      <WorkspaceHeader
        description="Manage your account and the recipe data you choose to bring in or take with you."
        icon={<SlidersHorizontal size={25} />}
        title="Settings"
      >
        <span
          className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-solid px-[11px] py-2 text-[13px] font-[760] ${
            session
              ? "border-(--color-sage-line) bg-(--color-sage-soft) text-(--color-sage)"
              : "border-[#ead0b6] bg-[#fff8ed] text-[#8a4d2a]"
          }`}
        >
          <UserRound size={16} />
          {sessionLoading
            ? "Checking account"
            : session
              ? "Signed in"
              : "Not signed in"}
        </span>
      </WorkspaceHeader>

      <div className="mt-[18px] grid max-w-[1120px] grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-3.5 max-[820px]:grid-cols-1">
        <section className={settingsCardClassName}>
          <div className={settingsCardHeadingClassName}>
            <span className={settingsBadgeClassName}>
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

          <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-solid border-(--color-line) bg-[rgba(255,250,243,0.76)] p-3 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-[3px] [&_small]:text-xs [&_small]:leading-[1.35] [&_small]:text-(--color-fog) [&_strong]:truncate [&_strong]:text-[15px] [&_strong]:leading-[1.2] [&_strong]:text-(--color-ink)">
            <span className={settingsBadgeClassName}>
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

          <button
            className={settingsOptionClassName}
            onClick={onOpenOnboarding}
            type="button"
          >
            <ListChecks size={18} />
            <span>
              <strong>Food preferences</strong>
              <small>Edit diets, allergies, cuisines, spice, time, and equipment.</small>
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
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

        <section className={settingsCardClassName}>
          <div className={settingsCardHeadingClassName}>
            <span className={settingsBadgeClassName}>
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

          <div className="grid gap-2">
            <button
              className={settingsOptionClassName}
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
              className={settingsOptionClassName}
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
              className={settingsOptionClassName}
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
              className={settingsOptionClassName}
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
          <p className="m-0 rounded-lg border border-solid border-(--color-sage-line) bg-[rgba(229,239,229,0.58)] px-3 py-2.5 text-xs font-bold leading-[1.35] text-(--color-sage)">
            {message}
          </p>
        </section>

        <details
          className={settingsAdvancedClassName}
          onToggle={(event) => {
            if (event.currentTarget.open && !info) {
              void refreshDiagnostics();
            }
          }}
        >
          <summary className={settingsSummaryClassName}>
            <span className="inline-flex min-w-0 items-center gap-2 [&>svg]:text-(--color-sage)">
              <Settings size={18} />
              <span className="grid items-start gap-0.5 [&>small]:text-xs [&>small]:leading-[1.35] [&>small]:text-(--color-fog)">
                <strong>Advanced diagnostics</strong>
                <small>API, auth, and asset details for debugging.</small>
              </span>
            </span>
          </summary>
          <div className="grid gap-3.5 px-[18px] pt-4 pb-[18px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={apiStatusClassName(status)}>
                <ShieldCheck size={16} />
                {status === "online" ? "API online" : `API ${status}`}
              </span>
              <Button onClick={() => void refreshDiagnostics()} size="sm">
                <RefreshCcw size={16} />
                Refresh diagnostics
              </Button>
            </div>
            <div className="grid gap-2">
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
            <p className={inlineStatusClassName}>{settingsMessage}</p>
          </div>
        </details>
      </div>
    </section>
  );
}

export function BuildPage() {
  return (
    <section className={workspacePageClassName}>
      <header>
        <div>
          <h1>Build Your Own Recipe App</h1>
          <p>
            OpenCook keeps the recipe contract, OpenAPI schema, and exports portable so
            Codex can build new views and workflows without trapping your recipes inside
            another company account.
          </p>
        </div>
        <a
          className="inline-flex min-h-[34px] min-w-max items-center gap-2 rounded-[7px] border border-solid border-(--color-pop-ink) bg-(--color-pop-ink) px-2.5 py-[7px] text-xs font-[650] text-white"
          href={githubUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Github size={18} />
          GitHub repo
          <ExternalLink size={15} />
        </a>
      </header>
      <div className="mt-6 grid grid-cols-4 gap-3 max-[820px]:grid-cols-1 [&>article]:rounded-lg [&>article]:border [&>article]:border-solid [&>article]:border-(--color-pop-ink) [&>article]:bg-(--color-pop-card) [&>article]:p-[18px] [&_h2]:mx-0 [&_h2]:mt-2.5 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:leading-[1.2] [&_p]:m-0 [&_p]:text-(--color-pop-muted-ink)">
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
      <section className="mt-3 grid gap-2.5 rounded-lg border border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-[18px] [&>h2]:m-0 [&>h2]:text-lg [&>h2]:leading-[1.2]">
        <h2>Demo surface</h2>
        <div className="flex items-center gap-2.5 border-t border-solid border-[#eee7dc] pt-2.5">
          <Link2 size={18} />
          <span>Scrape a public recipe URL through `/api/import/website`.</span>
        </div>
        <div className="flex items-center gap-2.5 border-t border-solid border-[#eee7dc] pt-2.5">
          <KeyRound size={18} />
          <span>Import your StashCook recipes with your own session token.</span>
        </div>
        <div className="flex items-center gap-2.5 border-t border-solid border-[#eee7dc] pt-2.5">
          <FileCode2 size={18} />
          <span>
            Ask Codex to inspect `/openapi.json`, then build a meal plan, shopping
            workflow, or another UI.
          </span>
        </div>
        <div className="flex items-center gap-2.5 border-t border-solid border-[#eee7dc] pt-2.5">
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
    <header className="flex items-start justify-between gap-6 border-b border-solid border-(--color-pop-ink) pb-[22px] max-[860px]:flex-col max-[860px]:items-stretch">
      <div className="flex min-w-0 items-start gap-3">
        {onBack ? (
          <Button aria-label="Back to recipes" onClick={onBack} size="icon">
            <ArrowLeft size={17} />
          </Button>
        ) : null}
        <span className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-lg border border-solid border-(--color-sage-line) bg-[color-mix(in_oklch,var(--color-pop-secondary)_14%,white)] text-(--color-pop-primary)">
          {icon}
        </span>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {children ? (
        <div className="flex flex-wrap justify-end gap-2 max-[820px]:w-full max-[820px]:items-stretch">
          {children}
        </div>
      ) : null}
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
    <article className="flex min-w-0 items-start gap-3 rounded-lg border border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-3.5 shadow-pop-sm [&>div]:grid [&>div]:min-w-0 [&>div]:gap-0.5 [&>span]:shrink-0 [&>span]:text-(--color-pop-primary) [&_em]:text-xs [&_em]:not-italic [&_em]:text-(--color-pop-muted-ink) [&_em]:[overflow-wrap:anywhere] [&_small]:text-xs [&_small]:text-(--color-pop-muted-ink) [&_strong]:truncate [&_strong]:text-lg [&_strong]:leading-[1.15] [&_strong]:text-(--color-pop-ink)">
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
    <div className="grid grid-cols-[minmax(120px,180px)_minmax(0,1fr)] gap-2 border-t border-solid border-[#eee7dc] pt-2.5 [&>span]:text-xs [&>span]:text-(--color-pop-muted-ink) [&>strong]:[overflow-wrap:anywhere]">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
