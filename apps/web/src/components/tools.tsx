import {
  type CookbookVisibility,
  type OwnedCookbook,
  type PublicCookbook,
  recipeSearchText,
  type Recipe,
} from "@open-cook/core";
import {
  MetricCard,
  StudioBadge,
  StudioPanel,
  StudioSectionHeading,
  WorkspaceHeader,
  studioActionTileClassName,
  studioCodePanelClassName,
  studioInsetClassName,
  studioPageClassName,
  studioPageInnerClassName,
} from "@open-cook/design-system";
import {
  ArrowLeft,
  BookOpen,
  Braces,
  CheckCircle2,
  Clipboard,
  Compass,
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
  Plus,
  RefreshCcw,
  Save,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AgentManifest,
  type ApiInfo,
  type BillingSummary,
  type CodexConnection,
  type CreatedCodexConnection,
  api,
  isApiError,
  type OpenApiDocument,
  type ShoppingListResult,
} from "../api";
import { authApi, type CurrentAuthSession } from "../authApi";
import {
  Button,
  buttonClassName,
  buttonRowClassName,
  fieldClassName,
  inlineStatusClassName,
  pageContainerClassName,
  PopButton,
  popButtonClassName,
  SegmentedControl,
  type SegmentedControlItem,
  workspacePageInnerClassName,
  workspacePrimaryActionButtonClassName,
  workspaceScrollPageClassName,
} from "../ui";
import {
  emptyNoteClass,
  errorMessage,
  githubUrl,
  recipeTimeSummary,
  type Page,
  previewText,
  shortDate,
} from "../lib/recipe";
import { displayImageUrl } from "../imageDisplayUrl";
import { VirtualGrid, VirtualList } from "./virtualized";
import { VoiceSearchInput } from "./VoiceSearchInput";

const AI_EDIT_CREDIT_COST = 25;
const studioMetricsGridClassName = "grid gap-3 md:grid-cols-2 xl:grid-cols-4";
const studioDetailGridClassName = "grid gap-4 xl:grid-cols-2";
const studioListCardClassName =
  "grid gap-2 rounded-[20px] border-2 border-[color-mix(in_oklch,var(--color-line)_86%,white)] bg-[rgba(255,253,248,0.82)] p-3";
const studioListRowClassName =
  "grid gap-2 rounded-[16px] border-2 border-[color-mix(in_oklch,var(--color-line)_84%,white)] bg-(--color-panel) p-3";
const studioManifestRowClassName =
  "grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[16px] border-2 border-[color-mix(in_oklch,var(--color-line)_84%,white)] bg-(--color-panel) p-3 [&>code]:[overflow-wrap:anywhere] [&>small]:text-xs [&>small]:leading-[1.45] [&>small]:text-(--color-fog)";
const studioRecipeToggleClassName =
  "grid min-h-[62px] cursor-pointer grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-[18px] border-2 border-[color-mix(in_oklch,var(--color-line)_84%,white)] bg-(--color-panel) p-3 transition hover:-translate-y-0.5 hover:bg-[color-mix(in_oklch,var(--color-pop-accent)_12%,white)]";
const studioInfoTextClassName =
  "m-0 text-[13px] font-semibold leading-[1.55] text-(--color-fog)";
const studioErrorClassName =
  "m-0 rounded-[18px] border-2 border-[#e2a193] bg-[color-mix(in_oklch,var(--color-pop-destructive)_12%,white)] px-4 py-3 text-sm font-bold text-[#a43e2f] shadow-[3px_3px_0_0_var(--color-ink)]";
const studioTokenCodeClassName =
  "block max-h-40 overflow-auto rounded-[18px] border-2 border-[color-mix(in_oklch,var(--color-line)_84%,white)] bg-(--color-panel) p-3 text-xs [overflow-wrap:anywhere]";
const studioHeroActionButtonClassName = `${workspacePrimaryActionButtonClassName} min-w-[140px] justify-center`;
const studioStatusPillClassName =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-(--color-panel) px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-(--color-pop-muted-ink)";

const cookbookPageClassName = `${workspaceScrollPageClassName} bg-[radial-gradient(circle_at_16%_9%,rgba(47,104,75,0.16),transparent_18rem),radial-gradient(circle_at_88%_16%,rgba(255,196,86,0.12),transparent_20rem),linear-gradient(180deg,#fff8e7_0%,#f6f0e4_44%,#edf4e7_100%)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(color-mix(in_oklch,var(--color-line)_64%,transparent)_1px,transparent_1px)] before:[background-size:18px_18px] before:opacity-45`;

const cookbookPageInnerClassName = workspacePageInnerClassName;

const cookbookCardClassName =
  "rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(180deg,#fffef9,#fff8ec)] shadow-[5px_5px_0_0_var(--color-ink)]";

const cookbookCoverClassName =
  "relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden border-b-2 border-(--color-ink) bg-[linear-gradient(135deg,#fff2c9,#e7f0df_58%,#fffdf8)] text-(--color-sage) before:absolute before:top-3 before:left-3 before:z-10 before:size-3 before:rounded-full before:border-2 before:border-(--color-ink) before:shadow-[1px_1px_0_0_var(--color-ink)] before:content-['']";

const cookbookSkeletonItems = [0, 1, 2, 3, 4, 5];

const cookbookSkeletonBlockClassName =
  "block animate-pulse rounded-md bg-(--color-line)";

const cookbookSearchInputContainerClassName =
  "m-0 grid min-h-12 grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2.5 rounded-2xl border-2 border-solid border-(--color-ink) bg-[linear-gradient(135deg,#fffdf8,#fff4d7)] p-2 shadow-[3px_3px_0_0_var(--color-ink)] transition focus-within:-translate-y-0.5 focus-within:shadow-[5px_5px_0_0_var(--color-ink)] [&>input]:min-w-0 [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-sm [&>input]:font-semibold [&>input]:text-(--color-ink) [&>input]:outline-0 [&>input::placeholder]:text-[#8a8378]";

const cookbookSearchIconWrapperClassName =
  "flex size-8 items-center justify-center rounded-xl border-2 border-(--color-ink) bg-(--color-sage-soft) text-(--color-sage)";

const cookbookSearchMicButtonClassName =
  "grid size-8 place-items-center rounded-xl border-2 border-(--color-ink) bg-(--color-panel) text-(--color-ink) transition hover:bg-(--color-sage-soft)";

const cookbookSearchActiveMicButtonClassName =
  "grid size-8 place-items-center rounded-xl border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)";

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
  const [codexConnections, setCodexConnections] = useState<CodexConnection[]>([]);
  const [createdCodexConnection, setCreatedCodexConnection] =
    useState<CreatedCodexConnection>();
  const [codexConnectionName, setCodexConnectionName] = useState("Codex");
  const [isCreatingCodexConnection, setIsCreatingCodexConnection] = useState(false);
  const [revokingCodexConnectionId, setRevokingCodexConnectionId] = useState<string>();

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

  const loadCodexConnections = useCallback(async () => {
    try {
      setCodexConnections(await api.listCodexConnections());
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        setCodexConnections([]);
        return;
      }

      setApiMessage(`Codex connections failed: ${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadApiMetadata();
  }, [loadApiMetadata]);

  useEffect(() => {
    void loadCodexConnections();
  }, [loadCodexConnections]);

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
    await copyText(`${window.location.origin}${path}`, `Copied ${path}`);
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setApiMessage(successMessage);
    } catch (error) {
      setApiMessage(`Copy failed: ${errorMessage(error)}`);
    }
  }

  async function createCodexConnection() {
    setIsCreatingCodexConnection(true);
    try {
      const connection = await api.createCodexConnection({
        name: codexConnectionName,
      });
      setCreatedCodexConnection(connection);
      setCodexConnections((current) => [
        {
          createdAt: connection.createdAt,
          id: connection.id,
          lastUsedAt: connection.lastUsedAt,
          name: connection.name,
          tokenPrefix: connection.tokenPrefix,
        },
        ...current.filter((item) => item.id !== connection.id),
      ]);
      setApiMessage("Codex connection created. Copy the token now.");
    } catch (error) {
      setApiMessage(`Codex connection failed: ${errorMessage(error)}`);
    } finally {
      setIsCreatingCodexConnection(false);
    }
  }

  async function revokeCodexConnection(id: string) {
    setRevokingCodexConnectionId(id);
    try {
      await api.revokeCodexConnection(id);
      setCodexConnections((current) => current.filter((item) => item.id !== id));
      setCreatedCodexConnection((current) =>
        current?.id === id ? undefined : current,
      );
      setApiMessage("Codex connection revoked");
    } catch (error) {
      setApiMessage(`Revoke failed: ${errorMessage(error)}`);
    } finally {
      setRevokingCodexConnectionId(undefined);
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
  const apiStatusTone =
    status === "online" ? "sage" : status === "offline" ? "danger" : "default";

  return (
    <section className={studioPageClassName}>
      <div className={studioPageInnerClassName}>
        <WorkspaceHeader
          description="Inspect the live API contract, service metadata, and agent workflow surface so you can build your own OpenCook tools against the OpenAPI spec."
          icon={<Braces size={25} />}
          title="API"
        >
          <StudioBadge icon={<ShieldCheck size={16} />} tone={apiStatusTone}>
            {status === "online" ? "Local API online" : `API ${status}`}
          </StudioBadge>
          <Button
            className={studioHeroActionButtonClassName}
            onClick={() => void loadApiMetadata()}
            size="sm"
          >
            <RefreshCcw size={16} />
            Refresh metadata
          </Button>
        </WorkspaceHeader>

        <div className={studioMetricsGridClassName}>
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <div className="grid gap-4">
            <StudioPanel tone="sun">
              <StudioSectionHeading
                description="Grab the live schema, docs, and starter paths that power the app."
                icon={<Clipboard size={20} />}
                title="Contracts"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  className={studioActionTileClassName}
                  href="/openapi.json"
                  rel="noopener"
                  target="_blank"
                >
                  <Braces size={18} />
                  <span>
                    <strong>OpenAPI JSON</strong>
                    <small>/openapi.json</small>
                  </span>
                </a>
                <a
                  className={studioActionTileClassName}
                  href="/scalar"
                  rel="noopener"
                  target="_blank"
                >
                  <FileCode2 size={18} />
                  <span>
                    <strong>Scalar docs</strong>
                    <small>/scalar</small>
                  </span>
                </a>
                <a
                  className={studioActionTileClassName}
                  href="/api/agents/manifest"
                  rel="noopener"
                  target="_blank"
                >
                  <Workflow size={18} />
                  <span>
                    <strong>Agent manifest</strong>
                    <small>/api/agents/manifest</small>
                  </span>
                </a>
                <button
                  className={studioActionTileClassName}
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
              <div className="mt-4">
                <StudioBadge
                  className="justify-self-start"
                  icon={<Clipboard size={15} />}
                >
                  {apiMessage}
                </StudioBadge>
              </div>
            </StudioPanel>

            <StudioPanel>
              <StudioSectionHeading
                actions={
                  <span className={studioStatusPillClassName}>
                    {selectedRecipeIds.length} selected
                  </span>
                }
                description="Run the shopping-list workflow against a few recipes so the output is easy to inspect."
                icon={<ListChecks size={20} />}
                title="Workflow dry run"
              />
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(260px,1.08fr)]">
                <div className="grid gap-3">
                  <div
                    className={`${studioListCardClassName} max-h-[320px] overflow-auto`}
                  >
                    {recipes.length ? (
                      recipes.map((recipe) => (
                        <label className={studioRecipeToggleClassName} key={recipe.id}>
                          <input
                            checked={selectedRecipeIds.includes(recipe.id)}
                            onChange={() => toggleRecipe(recipe.id)}
                            type="checkbox"
                          />
                          <span className="grid min-w-0 gap-0.5">
                            <strong className="truncate text-sm text-(--color-ink)">
                              {recipe.title}
                            </strong>
                            <small className="truncate text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                              {recipe.tags.slice(0, 3).join(", ") || "No tags yet"}
                            </small>
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className={studioInfoTextClassName}>
                        Add a few recipes first, then come back to test the workflow.
                      </p>
                    )}
                  </div>
                  <div className={buttonRowClassName}>
                    <Button
                      onClick={() =>
                        setSelectedRecipeIds(recipes.map((recipe) => recipe.id))
                      }
                      size="sm"
                    >
                      Select all
                    </Button>
                    <Button onClick={() => setSelectedRecipeIds([])} size="sm">
                      Clear
                    </Button>
                    <Button
                      className={workspacePrimaryActionButtonClassName}
                      disabled={!selectedRecipeIds.length}
                      onClick={() => void generateShoppingList()}
                      size="sm"
                      variant="primary"
                    >
                      <ListChecks size={16} />
                      Generate list
                    </Button>
                  </div>
                </div>
                <div className={studioListCardClassName}>
                  {shoppingList ? (
                    <>
                      <StudioBadge icon={<CheckCircle2 size={15} />} tone="sage">
                        {shoppingList.recipeCount} recipes · {shoppingList.items.length}{" "}
                        items
                      </StudioBadge>
                      <ul className="m-0 grid max-h-[280px] list-none gap-2 overflow-auto p-0">
                        {shoppingList.items.slice(0, 40).map((item) => (
                          <li
                            className={studioListRowClassName}
                            key={`${item.text}-${item.recipes.join(",")}`}
                          >
                            <strong className="text-sm text-(--color-ink)">
                              {item.text}
                            </strong>
                            <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                              {item.recipes.join(" / ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className={studioInfoTextClassName}>
                      No workflow output yet. Generate a shopping list to preview what
                      agents will receive.
                    </p>
                  )}
                </div>
              </div>
            </StudioPanel>

            <StudioPanel tone="mint">
              <StudioSectionHeading
                description="Everything exported for agents: callable tools on the left, workflows on the right."
                icon={<Workflow size={20} />}
                title="Manifest surface"
              />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className={studioListCardClassName}>
                  <h3 className="m-0 font-display text-xl font-bold text-(--color-ink)">
                    Agent tools
                  </h3>
                  <div className="grid gap-2">
                    {(manifest?.tools ?? []).length ? (
                      (manifest?.tools ?? []).map((tool) => (
                        <div className={studioManifestRowClassName} key={tool.path}>
                          <span className={studioStatusPillClassName}>
                            {tool.method}
                          </span>
                          <code>{tool.path}</code>
                          <small>{tool.description}</small>
                        </div>
                      ))
                    ) : (
                      <p className={studioInfoTextClassName}>
                        No tool metadata loaded yet.
                      </p>
                    )}
                  </div>
                </div>
                <div className={studioListCardClassName}>
                  <h3 className="m-0 font-display text-xl font-bold text-(--color-ink)">
                    Agent workflows
                  </h3>
                  <div className="grid gap-2">
                    {(manifest?.workflows ?? []).length ? (
                      (manifest?.workflows ?? []).map((workflow) => (
                        <div className={studioManifestRowClassName} key={workflow.path}>
                          <span className={studioStatusPillClassName}>
                            {workflow.method}
                          </span>
                          <code>{workflow.path}</code>
                          <small>{workflow.description}</small>
                        </div>
                      ))
                    ) : (
                      <p className={studioInfoTextClassName}>
                        No workflow metadata loaded yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </StudioPanel>
          </div>

          <StudioPanel className="h-fit">
            <StudioSectionHeading
              actions={
                <Button onClick={() => void loadCodexConnections()} size="sm">
                  <RefreshCcw size={16} />
                  Refresh list
                </Button>
              }
              description="Mint a short-lived token, copy the env block, and revoke stale connections when you are done."
              icon={<KeyRound size={20} />}
              title="Connect Codex"
            />
            <div className="mt-4 grid gap-4">
              <label className={fieldClassName}>
                Connection name
                <input
                  autoComplete="off"
                  onChange={(event) => setCodexConnectionName(event.target.value)}
                  placeholder="Codex"
                  value={codexConnectionName}
                />
              </label>
              <div className={buttonRowClassName}>
                <Button
                  className={workspacePrimaryActionButtonClassName}
                  disabled={isCreatingCodexConnection}
                  onClick={() => void createCodexConnection()}
                  size="sm"
                  variant="primary"
                >
                  {isCreatingCodexConnection ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  Create token
                </Button>
              </div>

              {createdCodexConnection ? (
                <div className={studioInsetClassName}>
                  <StudioBadge icon={<CheckCircle2 size={15} />} tone="sage">
                    Token ready
                  </StudioBadge>
                  <code className={studioTokenCodeClassName}>
                    {createdCodexConnection.env}
                  </code>
                  <div className={buttonRowClassName}>
                    <Button
                      onClick={() =>
                        void copyText(
                          createdCodexConnection.token,
                          "Copied Codex token",
                        )
                      }
                      size="sm"
                    >
                      <Clipboard size={16} />
                      Copy token
                    </Button>
                    <Button
                      onClick={() =>
                        void copyText(createdCodexConnection.env, "Copied Codex env")
                      }
                      size="sm"
                    >
                      <Clipboard size={16} />
                      Copy env
                    </Button>
                  </div>
                  <p className={studioInfoTextClassName}>
                    This is the only time the full token is shown.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2">
                {codexConnections.length ? (
                  codexConnections.map((connection) => (
                    <div
                      className={`${studioListRowClassName} md:grid-cols-[minmax(0,1fr)_auto] md:items-start`}
                      key={connection.id}
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <strong className="text-sm text-(--color-ink)">
                          {connection.name}
                        </strong>
                        <small className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                          {connection.tokenPrefix}... · created{" "}
                          {shortDate(connection.createdAt)}
                          {connection.lastUsedAt
                            ? ` · used ${shortDate(connection.lastUsedAt)}`
                            : ""}
                        </small>
                      </span>
                      <Button
                        disabled={revokingCodexConnectionId === connection.id}
                        onClick={() => void revokeCodexConnection(connection.id)}
                        size="sm"
                        variant="danger"
                      >
                        {revokingCodexConnectionId === connection.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <LockKeyhole size={16} />
                        )}
                        Revoke
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className={studioInfoTextClassName}>
                    No active Codex connections.
                  </p>
                )}
              </div>
            </div>
          </StudioPanel>
        </div>
      </div>
    </section>
  );
}

export function ExportPage({
  message,
  recipes,
  selectedRecipe,
}: {
  message: string;
  recipes: Recipe[];
  selectedRecipe?: Recipe;
}) {
  const [selectionSearch, setSelectionSearch] = useState("");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(() =>
    selectedRecipe ? [selectedRecipe.id] : [],
  );
  const [selectedMarkdownMode, setSelectedMarkdownMode] = useState<
    "download" | "preview" | null
  >(null);
  const [previewTitle, setPreviewTitle] = useState("No preview loaded");
  const [preview, setPreview] = useState("");
  const selectionStarted = useRef(false);
  const initializedSelection = useRef(false);

  useEffect(() => {
    if (initializedSelection.current || !recipes.length) {
      return;
    }
    initializedSelection.current = true;
    setSelectedRecipeIds(recipes.map((recipe) => recipe.id));
  }, [recipes]);

  useEffect(() => {
    if (!initializedSelection.current) {
      return;
    }

    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    setSelectedRecipeIds((current) => {
      const currentIds = current.filter((id) => recipeIds.has(id));
      if (selectionStarted.current) {
        return currentIds;
      }
      return recipes.map((recipe) => recipe.id);
    });
  }, [recipes]);

  const normalizedSelectionSearch = selectionSearch.trim().toLowerCase();
  const filteredRecipes = useMemo(() => {
    if (!normalizedSelectionSearch) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      const source = recipe.source?.name ?? recipe.source?.url ?? "";
      const tags = recipe.tags.join(" ");
      return (
        recipe.title.toLowerCase().includes(normalizedSelectionSearch) ||
        source.toLowerCase().includes(normalizedSelectionSearch) ||
        tags.toLowerCase().includes(normalizedSelectionSearch)
      );
    });
  }, [recipes, normalizedSelectionSearch]);

  const selectedRecipeIdSet = useMemo(
    () => new Set(selectedRecipeIds),
    [selectedRecipeIds],
  );
  const selectedRecipes = useMemo(
    () => recipes.filter((recipe) => selectedRecipeIdSet.has(recipe.id)),
    [recipes, selectedRecipeIdSet],
  );
  const selectedCount = selectedRecipes.length;
  const visibleRecipeIds = useMemo(
    () => filteredRecipes.map((recipe) => recipe.id),
    [filteredRecipes],
  );
  const visibleRecipeIdSet = useMemo(
    () => new Set(visibleRecipeIds),
    [visibleRecipeIds],
  );
  const visibleAllSelected =
    filteredRecipes.length > 0 &&
    filteredRecipes.every((recipe) => selectedRecipeIdSet.has(recipe.id));
  const visibleAnySelected = filteredRecipes.some((recipe) =>
    selectedRecipeIdSet.has(recipe.id),
  );
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

  function setSelectedIds(nextIds: string[]) {
    selectionStarted.current = true;
    setSelectedRecipeIds(nextIds);
  }

  function toggleRecipeSelection(recipeId: string) {
    setSelectedIds(
      selectedRecipeIdSet.has(recipeId)
        ? selectedRecipeIds.filter((id) => id !== recipeId)
        : [...selectedRecipeIds, recipeId],
    );
  }

  function selectAllRecipes() {
    setSelectedIds(recipes.map((recipe) => recipe.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function selectVisibleRecipes() {
    setSelectedIds(Array.from(new Set([...selectedRecipeIds, ...visibleRecipeIds])));
  }

  function clearVisibleRecipes() {
    setSelectedIds(selectedRecipeIds.filter((id) => !visibleRecipeIdSet.has(id)));
  }

  function exportTextFile(filename: string, content: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSelectedMarkdown() {
    if (!selectedRecipes.length) {
      setPreviewTitle("No recipes selected");
      setPreview("Select at least one recipe before exporting your scope.");
      return;
    }

    try {
      setSelectedMarkdownMode("download");
      const recipeText = await Promise.all(
        selectedRecipes.map(async (recipe) => {
          try {
            const markdown = await api.exportRecipeMarkdown(recipe.id);
            return `# ${recipe.title}\n\n${markdown}`;
          } catch (error) {
            return `# ${recipe.title}\n\nExport failed: ${errorMessage(error)}`;
          }
        }),
      );
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `open-cook-recipes-selected-${selectedRecipes.length}-${stamp}.md`;
      exportTextFile(
        filename,
        recipeText.join("\n\n---\n\n"),
        "text/markdown; charset=utf-8",
      );
      setPreviewTitle("Selected Markdown export downloaded");
      setPreview(`Saved ${filename} locally.`);
    } catch (error) {
      setPreviewTitle("Selected Markdown export failed");
      setPreview(errorMessage(error));
    } finally {
      setSelectedMarkdownMode(null);
    }
  }

  function exportSelectedJson() {
    if (!selectedRecipes.length) {
      setPreviewTitle("No recipes selected");
      setPreview("Select at least one recipe before exporting your scope.");
      return;
    }

    const payload = JSON.stringify({ recipes: selectedRecipes }, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `open-cook-recipes-selected-${selectedRecipes.length}-${stamp}.json`;
    exportTextFile(filename, payload, "application/json");
    setPreviewTitle("Selected JSON export downloaded");
    setPreview(`Saved ${filename} locally.`);
  }

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

  function previewSelectedJson() {
    setPreviewTitle(
      `Selected recipes JSON (${selectedRecipes.length} of ${recipes.length})`,
    );
    setPreview(previewText(JSON.stringify({ recipes: selectedRecipes }, null, 2)));
  }

  async function previewSelectedMarkdown() {
    if (!selectedRecipes.length) {
      setPreviewTitle("No recipes selected");
      setPreview("Select at least one recipe before previewing your scope.");
      return;
    }

    try {
      setSelectedMarkdownMode("preview");
      const previewRecipes = selectedRecipes.slice(0, 3);
      const recipeText = await Promise.all(
        previewRecipes.map(async (recipe) => {
          try {
            const markdown = await api.exportRecipeMarkdown(recipe.id);
            return `# ${recipe.title}\n\n${markdown}`;
          } catch (error) {
            return `# ${recipe.title}\n\nExport failed: ${errorMessage(error)}`;
          }
        }),
      );
      const hiddenCount = selectedRecipes.length - previewRecipes.length;
      const suffix =
        hiddenCount > 0 ? `\n\n... and ${hiddenCount} more recipes are selected.` : "";
      setPreviewTitle(`Selected recipes Markdown (${selectedRecipes.length} selected)`);
      setPreview(previewText(recipeText.join("\n\n---\n\n") + suffix));
    } catch (error) {
      setPreviewTitle("Recipe preview failed");
      setPreview(errorMessage(error));
    } finally {
      setSelectedMarkdownMode(null);
    }
  }

  return (
    <section className={studioPageClassName}>
      <div className={studioPageInnerClassName}>
        <WorkspaceHeader
          description="Your recipe data belongs to you. Export all recipes as portable JSON or Markdown, or scope to a selected set."
          icon={<Download size={25} />}
          title="Export"
        >
          <StudioBadge icon={<CheckCircle2 size={16} />} tone="sage">
            {message}
          </StudioBadge>
        </WorkspaceHeader>

        <div className={studioMetricsGridClassName}>
          <MetricCard
            detail="Included in JSON and Markdown"
            icon={<Database size={20} />}
            label="Recipes"
            value={`${selectedCount} / ${recipes.length}`}
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(320px,1.04fr)]">
          <StudioPanel tone="sun">
            <StudioSectionHeading
              actions={
                <span className={studioStatusPillClassName}>
                  {selectedCount} selected
                </span>
              }
              description="Take the whole pantry in one click, or build a scoped bundle from the recipes you have highlighted."
              icon={<Download size={20} />}
              title="Pack the pantry"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a className={studioActionTileClassName} href="/api/export/recipes/json">
                <Database size={18} />
                <span>
                  <strong>All recipes JSON</strong>
                  <small>/api/export/recipes/json</small>
                </span>
              </a>
              <a
                className={studioActionTileClassName}
                href="/api/export/recipes/markdown"
              >
                <FileText size={18} />
                <span>
                  <strong>All recipes Markdown</strong>
                  <small>/api/export/recipes/markdown</small>
                </span>
              </a>
            </div>
            <div className={`${studioInsetClassName} mt-4`}>
              <p className={studioInfoTextClassName}>
                Use the current recipe selection to create a smaller travel bundle.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={workspacePrimaryActionButtonClassName}
                  disabled={!selectedCount}
                  onClick={() => exportSelectedJson()}
                  size="sm"
                  variant="primary"
                >
                  Export selected JSON
                </Button>
                <Button
                  disabled={!selectedCount || selectedMarkdownMode === "download"}
                  onClick={() => void exportSelectedMarkdown()}
                  size="sm"
                >
                  {selectedMarkdownMode === "download" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : null}
                  Export selected Markdown
                </Button>
              </div>
              <StudioBadge
                className="justify-self-start"
                icon={<CheckCircle2 size={15} />}
                tone={selectedCount ? "sage" : "sun"}
              >
                {selectedCount
                  ? `${selectedCount} recipes queued for custom export`
                  : "No recipes selected yet"}
              </StudioBadge>
            </div>
          </StudioPanel>

          <StudioPanel tone="mint">
            <StudioSectionHeading
              description="Filter your library, then decide whether to select everything on screen or only a few favorites."
              icon={<FileText size={20} />}
              title="Choose the scope"
            />
            <div className="mt-4 grid gap-3">
              <label className={fieldClassName}>
                Recipe search
                <input
                  onChange={(event) => setSelectionSearch(event.target.value)}
                  placeholder="Search by title, source, or tag"
                  value={selectionSearch}
                />
              </label>
              <div className={buttonRowClassName}>
                <Button onClick={() => selectAllRecipes()} size="sm">
                  Select all
                </Button>
                <Button onClick={() => clearSelection()} size="sm">
                  Clear
                </Button>
                <Button
                  disabled={visibleAllSelected}
                  onClick={() => selectVisibleRecipes()}
                  size="sm"
                  variant="secondary"
                >
                  Select visible
                </Button>
                <Button
                  disabled={!visibleAnySelected}
                  onClick={() => clearVisibleRecipes()}
                  size="sm"
                  variant="secondary"
                >
                  Clear visible
                </Button>
              </div>
              <p className={studioInfoTextClassName}>
                Showing {filteredRecipes.length} of {recipes.length} recipes
              </p>
              <div className={`${studioListCardClassName} max-h-[340px] overflow-auto`}>
                {filteredRecipes.length ? (
                  filteredRecipes.map((recipe) => {
                    const checked = selectedRecipeIdSet.has(recipe.id);
                    return (
                      <label className={studioRecipeToggleClassName} key={recipe.id}>
                        <input
                          checked={checked}
                          onChange={() => toggleRecipeSelection(recipe.id)}
                          type="checkbox"
                        />
                        <div className="grid min-w-0 gap-0.5">
                          <strong className="line-clamp-1 text-sm text-(--color-ink)">
                            {recipe.title}
                          </strong>
                          <div className="grid min-w-0 gap-1 text-[12px] font-semibold leading-[1.45] text-(--color-fog) md:grid-cols-2">
                            <span className="truncate">
                              {recipe.source?.name ??
                                recipe.source?.url ??
                                "No source attached"}
                            </span>
                            <span className="truncate">
                              {recipe.tags.length ? recipe.tags.join(", ") : "No tags"}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <p className={studioInfoTextClassName}>
                    No recipes match your filter.
                  </p>
                )}
              </div>
            </div>
          </StudioPanel>

          <StudioPanel className="xl:col-span-2">
            <StudioSectionHeading
              description="Preview the portable payload before you download it."
              icon={<FileCode2 size={20} />}
              title="Peek inside the export"
            />
            <div className="mt-4 grid gap-3">
              <div className={buttonRowClassName}>
                <Button onClick={() => void previewJson()} size="sm">
                  All JSON
                </Button>
                <Button onClick={() => void previewMarkdown()} size="sm">
                  All Markdown
                </Button>
                <Button
                  disabled={!selectedCount}
                  onClick={() => previewSelectedJson()}
                  size="sm"
                  variant="secondary"
                >
                  Selected JSON
                </Button>
                <Button
                  disabled={!selectedCount || selectedMarkdownMode === "preview"}
                  onClick={() => void previewSelectedMarkdown()}
                  size="sm"
                  variant="secondary"
                >
                  {selectedMarkdownMode === "preview" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : null}
                  Selected Markdown
                </Button>
              </div>
              <StudioBadge
                className="justify-self-start"
                icon={<FileText size={15} />}
                tone="sun"
              >
                {previewTitle}
              </StudioBadge>
              <pre className={studioCodePanelClassName}>
                {preview || "Choose an export preview."}
              </pre>
            </div>
          </StudioPanel>
        </div>
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
  const aiEditsAvailable = Math.floor(totalCredits / AI_EDIT_CREDIT_COST);
  const balancePools = billing?.balances ?? [];

  return (
    <section className={studioPageClassName}>
      <div className={studioPageInnerClassName}>
        <WorkspaceHeader
          description="Review your plan, AI allowance, and billing portal access without leaving the OpenCook app."
          icon={<CreditCard size={25} />}
          title="Billing"
        >
          <StudioBadge icon={<UserRound size={16} />} tone={session ? "sage" : "sun"}>
            {sessionLoading
              ? "Checking account"
              : session
                ? session.user.email
                : "Not signed in"}
          </StudioBadge>
        </WorkspaceHeader>

        <div className="grid gap-4">
          {error ? <p className={studioErrorClassName}>{error}</p> : null}

          {!session ? (
            <div className={studioDetailGridClassName}>
              <StudioPanel tone="sun">
                <StudioSectionHeading
                  description="Sign in to view your plan, manage billing, or upgrade to Chef."
                  icon={<UserRound size={20} />}
                  title="Account required"
                />
                <div className={`${studioInsetClassName} mt-4`}>
                  <div className="grid gap-2">
                    <div className={studioListRowClassName}>
                      <strong className="text-sm text-(--color-ink)">
                        Billing follows your account
                      </strong>
                      <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                        Your plan, credits, and checkout state travel with the email you
                        use to sign in.
                      </span>
                    </div>
                  </div>
                  <div className={buttonRowClassName}>
                    <Button onClick={onLogIn} size="sm">
                      <LogIn size={16} />
                      Log in
                    </Button>
                    <Button
                      className={workspacePrimaryActionButtonClassName}
                      onClick={onCreateAccount}
                      size="sm"
                      variant="primary"
                    >
                      <UserPlus size={16} />
                      Create account
                    </Button>
                  </div>
                </div>
              </StudioPanel>

              <StudioPanel tone="mint">
                <StudioSectionHeading
                  description="Chef is the fast lane for AI-powered recipe editing and future premium flows."
                  icon={<Sparkles size={20} />}
                  title="What Chef unlocks"
                />
                <div className="mt-4 grid gap-2">
                  <div className={studioListRowClassName}>
                    <strong className="text-sm text-(--color-ink)">
                      More AI edits
                    </strong>
                    <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                      Credits are spent on the remix and editing flows around your
                      recipe library.
                    </span>
                  </div>
                  <div className={studioListRowClassName}>
                    <strong className="text-sm text-(--color-ink)">
                      Managed billing portal
                    </strong>
                    <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                      OpenCook sends you to the hosted portal when it is enabled in the
                      current environment.
                    </span>
                  </div>
                  <div className={studioListRowClassName}>
                    <strong className="text-sm text-(--color-ink)">
                      Same portable recipes
                    </strong>
                    <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                      Upgrading never changes the export story. Your recipes remain
                      portable.
                    </span>
                  </div>
                </div>
              </StudioPanel>
            </div>
          ) : null}

          {session ? (
            <>
              <div className={studioMetricsGridClassName}>
                <MetricCard
                  detail={isPro ? "Chef subscription" : "Free OpenCook plan"}
                  icon={<CreditCard size={20} />}
                  label="Current plan"
                  value={isPro ? "Chef" : "Free"}
                />
                <MetricCard
                  detail="Approximate AI recipe edits remaining"
                  icon={<Sparkles size={20} />}
                  label="AI allowance"
                  value={`${aiEditsAvailable.toLocaleString()} edits`}
                />
                <MetricCard
                  detail="Distinct credit buckets returned by billing"
                  icon={<Database size={20} />}
                  label="Credit pools"
                  value={balancePools.length.toString()}
                />
                <MetricCard
                  detail={
                    billing?.billingEnabled
                      ? "Stripe portal available"
                      : "Portal disabled here"
                  }
                  icon={<ExternalLink size={20} />}
                  label="Portal"
                  value={billing?.billingEnabled ? "Live" : "Local only"}
                />
              </div>

              <div className={studioDetailGridClassName}>
                <StudioPanel tone={isPro ? "mint" : "sun"}>
                  <StudioSectionHeading
                    description="Your current plan, account email, and primary billing action all live here."
                    icon={<CreditCard size={20} />}
                    title="Plan and portal"
                  />
                  <div className={`${studioInsetClassName} mt-4`}>
                    <StudioBadge
                      className="justify-self-start"
                      icon={<UserRound size={15} />}
                      tone="sage"
                    >
                      {session.user.email}
                    </StudioBadge>
                    <div className="grid gap-2">
                      <div className={studioListRowClassName}>
                        <strong className="text-sm text-(--color-ink)">
                          {isPro ? "Chef is active" : "You are on the free plan"}
                        </strong>
                        <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                          {isPro
                            ? "Your account can use the paid AI allowance until you change plans."
                            : "Upgrade when you want more AI editing room without leaving the app."}
                        </span>
                      </div>
                      {billing && !billing.billingEnabled ? (
                        <div className={studioListRowClassName}>
                          <strong className="text-sm text-(--color-ink)">
                            Billing isn't configured in this environment yet
                          </strong>
                          <span className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                            The UI is ready, but the checkout and portal bindings are
                            disabled for this deployment.
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className={buttonRowClassName}>
                      {loading ? (
                        <StudioBadge
                          className="justify-self-start"
                          icon={<Loader2 className="animate-spin" size={15} />}
                        >
                          Loading billing
                        </StudioBadge>
                      ) : isPro ? (
                        <Button
                          className={workspacePrimaryActionButtonClassName}
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
                        <Button
                          className={workspacePrimaryActionButtonClassName}
                          onClick={onGoToPricing}
                          size="sm"
                          variant="primary"
                        >
                          <Sparkles size={16} />
                          Upgrade to Chef
                        </Button>
                      )}
                    </div>
                  </div>
                </StudioPanel>

                <StudioPanel>
                  <StudioSectionHeading
                    actions={
                      <StudioBadge
                        className="justify-self-start"
                        icon={<Sparkles size={15} />}
                        tone="sun"
                      >
                        25 credits per AI edit
                      </StudioBadge>
                    }
                    description="OpenCook groups available credits into pools. This view helps you see how much room is left."
                    icon={<Database size={20} />}
                    title="Credit pools"
                  />
                  <div className="mt-4 grid gap-2">
                    {loading ? (
                      <StudioBadge
                        className="justify-self-start"
                        icon={<Loader2 className="animate-spin" size={15} />}
                      >
                        Loading balances
                      </StudioBadge>
                    ) : balancePools.length ? (
                      balancePools.map((pool) => (
                        <div
                          className={`${studioListRowClassName} md:grid-cols-[minmax(0,1fr)_auto] md:items-center`}
                          key={pool.currencyKey}
                        >
                          <span className="grid gap-0.5">
                            <strong className="text-sm text-(--color-ink)">
                              {pool.currencyKey}
                            </strong>
                            <small className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                              {pool.total.toLocaleString()} total credits in this pool
                            </small>
                          </span>
                          <StudioBadge icon={<Sparkles size={15} />} tone="sage">
                            {pool.available.toLocaleString()} left
                          </StudioBadge>
                        </div>
                      ))
                    ) : (
                      <p className={studioInfoTextClassName}>
                        No balance pools are available for this account yet.
                      </p>
                    )}
                  </div>
                </StudioPanel>
              </div>
            </>
          ) : null}
        </div>
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
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className={fieldClassName} htmlFor="account-name">
        Display name
        <input
          autoComplete="name"
          disabled={saving}
          id="account-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          value={name}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <PopButton disabled={!dirty || saving} size="sm" tone="primary" type="submit">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save
        </PopButton>
        {status ? (
          <StudioBadge tone={status === "Name updated" ? "sage" : "sun"}>
            {status}
          </StudioBadge>
        ) : null}
      </div>
    </form>
  );
}

function TopLevelCookbookCard({
  recipes,
  session,
}: {
  recipes: Recipe[];
  session: CurrentAuthSession;
}) {
  const [cookbook, setCookbook] = useState<OwnedCookbook>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Loading cookbook");

  const publicPath = `/c/${encodeURIComponent(cookbook?.slug ?? session.user.id)}`;
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${publicPath}`
      : publicPath;
  const dirty = cookbook
    ? title.trim() !== cookbook.title ||
      description.trim() !== (cookbook.description ?? "")
    : false;

  const loadCookbook = useCallback(async () => {
    try {
      const next = await api.getTopLevelCookbook();
      setCookbook(next);
      setTitle(next.title);
      setDescription(next.description ?? "");
      setStatus("Cookbook ready");
    } catch (error) {
      setStatus(`Cookbook failed: ${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    void loadCookbook();
  }, [loadCookbook]);

  async function saveDetails() {
    if (!cookbook || !dirty || saving) {
      return;
    }
    setSaving(true);
    try {
      const next = await api.updateTopLevelCookbook({
        description: description.trim(),
        title: title.trim(),
      });
      setCookbook(next);
      setTitle(next.title);
      setDescription(next.description ?? "");
      setStatus("Cookbook details saved");
    } catch (error) {
      setStatus(`Save failed: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function setVisibility(visibility: CookbookVisibility) {
    if (!cookbook || saving) {
      return;
    }
    setSaving(true);
    try {
      const next = await api.updateTopLevelCookbook({ visibility });
      setCookbook(next);
      setTitle(next.title);
      setDescription(next.description ?? "");
      setStatus(
        visibility === "private"
          ? "Cookbook is private"
          : visibility === "unlisted"
            ? "Cookbook is link-only"
            : "Cookbook is public",
      );
    } catch (error) {
      setStatus(`Visibility failed: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setStatus("Cookbook link copied");
    } catch {
      setStatus(publicUrl);
    }
  }

  const visibility = cookbook?.visibility ?? "private";
  const visibilityButtonClass = (value: CookbookVisibility) =>
    popButtonClassName({
      active: visibility === value,
      className: "gap-1.5",
      size: "sm",
      tone: visibility === value ? "accent" : "secondary",
    });

  return (
    <StudioPanel className="col-span-full" tone="mint">
      <StudioSectionHeading
        actions={
          <StudioBadge icon={<BookOpen size={15} />} tone="sun">
            {cookbook?.recipeIds.length ?? recipes.length} recipes
          </StudioBadge>
        }
        description="Create one shelf link for people to browse your recipes, then decide whether it stays private, link-only, or public."
        icon={<BookOpen size={20} />}
        title="Share your cookbook"
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
        <form
          className="grid content-start gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDetails();
          }}
        >
          <label className={fieldClassName}>
            Title
            <input
              disabled={saving || !cookbook}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label className={fieldClassName}>
            Description
            <textarea
              disabled={saving || !cookbook}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <PopButton
              disabled={!dirty || saving || !title.trim()}
              size="sm"
              tone="primary"
              type="submit"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              Save
            </PopButton>
          </div>
        </form>

        <div className={`${studioInsetClassName} content-start`}>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Cookbook visibility"
          >
            <button
              className={visibilityButtonClass("private")}
              disabled={saving || !cookbook}
              onClick={() => void setVisibility("private")}
              type="button"
            >
              <LockKeyhole size={14} />
              Private
            </button>
            <button
              className={visibilityButtonClass("unlisted")}
              disabled={saving || !cookbook}
              onClick={() => void setVisibility("unlisted")}
              type="button"
            >
              <Link2 size={14} />
              Link-only
            </button>
            <button
              className={visibilityButtonClass("public")}
              disabled={saving || !cookbook}
              onClick={() => void setVisibility("public")}
              type="button"
            >
              <Globe2 size={14} />
              Public
            </button>
          </div>
          <p className={studioInfoTextClassName}>
            {visibility === "private"
              ? "Only you can open this cookbook link."
              : visibility === "unlisted"
                ? "Anyone with the link can browse this cookbook."
                : "Anyone with the link can browse this cookbook, and it is ready for public surfaces."}
          </p>
          <div className={studioInsetClassName}>
            <span
              className="truncate text-[12.5px] font-semibold text-(--color-fog)"
              title={publicUrl}
            >
              {publicUrl}
            </span>
            <div className="flex flex-wrap gap-2">
              <PopButton
                disabled={visibility === "private"}
                onClick={() => void copyLink()}
                size="sm"
                tone="secondary"
              >
                <Clipboard size={15} />
                Copy link
              </PopButton>
              <a
                className={popButtonClassName({
                  className:
                    visibility === "private"
                      ? "pointer-events-none opacity-50"
                      : undefined,
                  size: "sm",
                  tone: "secondary",
                })}
                href={publicPath}
              >
                <ExternalLink size={15} />
                Open
              </a>
            </div>
          </div>
          <small className="text-[12px] font-semibold leading-snug text-(--color-fog)">
            This controls the cookbook link. Individual recipe links keep their own
            sharing settings.
          </small>
          {status ? (
            <StudioBadge className="justify-self-start" tone="sun">
              {status}
            </StudioBadge>
          ) : null}
        </div>
      </div>
    </StudioPanel>
  );
}

type CookbookSection = "mine" | "explore";

const cookbookSectionTabs = [
  { icon: <BookOpen size={15} />, label: "Yours", value: "mine" },
  { icon: <Compass size={15} />, label: "Explore", value: "explore" },
] satisfies Array<SegmentedControlItem<CookbookSection>>;

function isVisibleOwnedCookbook(cookbook: OwnedCookbook) {
  return cookbook.kind !== "top_level" || cookbook.recipeIds.length > 0;
}

function CookbookRecipeOption({
  checked,
  disabled,
  onToggle,
  recipe,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: (recipeId: string) => void;
  recipe: Recipe;
}) {
  return (
    <label className="grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-start gap-2 rounded-lg border border-solid border-transparent px-2 py-1.5 hover:border-(--color-line) hover:bg-(--color-panel)">
      <input
        checked={checked}
        className="mt-0.5"
        disabled={disabled}
        onChange={() => onToggle(recipe.id)}
        type="checkbox"
      />
      <span className="grid min-w-0 gap-0.5">
        <strong className="truncate text-[13px] text-(--color-ink)">
          {recipe.title}
        </strong>
        <small className="truncate text-xs text-(--color-fog)">
          {recipe.tags.slice(0, 3).join(", ") || "No tags"}
        </small>
      </span>
    </label>
  );
}

function OwnedCookbookCard({
  cookbook,
  onOpen,
}: {
  cookbook: OwnedCookbook;
  onOpen: (cookbook: OwnedCookbook) => void;
}) {
  return (
    <article
      className={`${cookbookCardClassName} relative flex h-full w-full flex-col items-stretch gap-0 overflow-hidden transition-transform hover:-translate-x-px hover:-translate-y-px hover:rotate-[-0.35deg]`}
    >
      <button
        aria-label={`Open ${cookbook.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-tomato)]"
        onClick={() => onOpen(cookbook)}
        type="button"
      />
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-0">
        <div
          className={`${cookbookCoverClassName} before:bg-(--color-tomato)`}
          aria-hidden="true"
        >
          <BookOpen size={42} strokeWidth={2.4} />
          <span className="absolute right-3 bottom-3 rounded-full border-2 border-(--color-ink) bg-(--color-panel) px-2.5 py-1 text-[12px] font-extrabold text-(--color-fog)">
            {cookbook.recipeIds.length} recipes
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <div className="flex flex-wrap items-start gap-2">
            <strong className="text-[15px] leading-tight text-(--color-ink)">
              {cookbook.title}
            </strong>
          </div>
          <span className="line-clamp-2 text-[13px] leading-snug text-(--color-fog)">
            {cookbook.description || "No description yet."}
          </span>
          <span className="mt-auto flex flex-wrap items-center gap-2 pt-1.5 text-[11.5px] font-bold text-(--color-fog)">
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5">
              {visibilityIcon(cookbook.visibility)}
              {visibilityLabel(cookbook.visibility)}
            </span>
            <span>Updated {shortDate(cookbook.updatedAt)}</span>
          </span>
        </div>
      </div>
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2 border-t-2 border-(--color-line) bg-[color-mix(in_oklch,var(--color-panel)_84%,white)] px-3.5 py-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-(--color-sage)">
          <ExternalLink size={13} />
          Open cookbook
        </span>
      </div>
    </article>
  );
}

function OwnedCookbookDetail({
  confirmDeleteId,
  cookbook,
  onBack,
  onCopyLink,
  onDelete,
  onVisibilityChange,
  recipes,
  saving,
}: {
  confirmDeleteId?: string;
  cookbook: OwnedCookbook;
  onBack: () => void;
  onCopyLink: (cookbook: OwnedCookbook) => void | Promise<void>;
  onDelete: (cookbook: OwnedCookbook) => void | Promise<void>;
  onVisibilityChange: (
    cookbook: OwnedCookbook,
    visibility: CookbookVisibility,
  ) => void | Promise<void>;
  recipes: Recipe[];
  saving: boolean;
}) {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const cookbookRecipes = cookbook.recipeIds
    .map((recipeId) => recipeById.get(recipeId))
    .filter((recipe): recipe is Recipe => Boolean(recipe));

  return (
    <section className="grid gap-5">
      <div className={`${cookbookCardClassName} grid gap-4 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={onBack} size="sm" variant="secondary">
            <ArrowLeft size={15} />
            Back to cookbooks
          </Button>
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-panel) px-2.5 py-1 text-[12px] font-extrabold text-(--color-fog)">
            <BookOpen size={14} />
            {cookbookRecipes.length} recipes
          </span>
        </div>

        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-2xl leading-tight text-(--color-ink)">
              {cookbook.title}
            </h2>
          </div>
          <p className="m-0 max-w-[58ch] text-[14px] font-semibold leading-snug text-(--color-fog)">
            {cookbook.description || "No description yet."}
          </p>
        </div>
      </div>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm text-(--color-ink)">
            Recipes in this cookbook
          </strong>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-(--color-fog)">
            {cookbookRecipes.length} total
          </span>
        </div>
        {cookbookRecipes.length ? (
          <VirtualGrid
            estimatedRowHeight={308}
            getKey={(recipe) => recipe.id}
            items={cookbookRecipes}
            minColumnWidth={248}
            renderItem={(recipe) => <OwnedCookbookRecipeCard recipe={recipe} />}
          />
        ) : (
          <p
            className={`${cookbookCardClassName} m-0 p-4 text-[13px] font-semibold text-(--color-fog)`}
          >
            No recipes in this cookbook.
          </p>
        )}
      </section>

      <section className={`${cookbookCardClassName} grid gap-4 p-4`}>
        <div className="grid gap-2 rounded-lg border border-solid border-(--color-line) bg-[rgba(255,250,243,0.76)] p-3">
          <strong className="text-sm text-(--color-ink)">Visibility</strong>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={`${cookbook.title} visibility`}
          >
            {(["private", "unlisted", "public"] as CookbookVisibility[]).map(
              (option) => (
                <button
                  className={visibilityPillClass(cookbook.visibility === option)}
                  disabled={saving}
                  key={option}
                  onClick={() => void onVisibilityChange(cookbook, option)}
                  type="button"
                >
                  {visibilityIcon(option)}
                  {visibilityLabel(option)}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={cookbook.visibility === "private"}
            onClick={() => void onCopyLink(cookbook)}
            size="sm"
            variant="secondary"
          >
            <Clipboard size={15} />
            Copy link
          </Button>
          <a
            className={buttonClassName({
              className:
                cookbook.visibility === "private"
                  ? "pointer-events-none opacity-50"
                  : undefined,
              size: "sm",
              variant: "secondary",
            })}
            href={`/c/${encodeURIComponent(cookbook.slug)}`}
          >
            <ExternalLink size={15} />
            Open public page
          </a>
          {cookbook.kind !== "top_level" ? (
            <Button
              onClick={() => void onDelete(cookbook)}
              size="sm"
              variant="secondary"
            >
              <Trash2 size={15} />
              {confirmDeleteId === cookbook.id ? "Confirm delete" : "Delete"}
            </Button>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function PublicCookbookCard({ cookbook }: { cookbook: PublicCookbook }) {
  return (
    <a
      className={`${cookbookCardClassName} relative flex h-full w-full flex-col items-stretch gap-0 overflow-hidden p-0 text-left no-underline transition-transform hover:-translate-x-px hover:-translate-y-px hover:rotate-[0.35deg] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sage)]`}
      href={`/c/${encodeURIComponent(cookbook.slug)}`}
    >
      <div
        className={`${cookbookCoverClassName} before:bg-(--color-sage-soft)`}
        aria-hidden="true"
      >
        <Globe2 size={42} strokeWidth={2.4} />
        <span className="absolute right-3 bottom-3 rounded-full border-2 border-(--color-ink) bg-(--color-panel) px-2.5 py-1 text-[12px] font-extrabold text-(--color-fog)">
          {cookbook.recipes.length} recipes
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <strong className="text-[15px] leading-tight text-(--color-ink)">
          {cookbook.title}
        </strong>
        <span className="line-clamp-2 text-[13px] leading-snug text-(--color-fog)">
          {cookbook.description || `${cookbook.owner.name}'s public cookbook.`}
        </span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1.5 text-[11.5px] font-bold text-(--color-fog)">
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5">
            <UserRound size={11} />
            {cookbook.owner.name}
          </span>
          <span>Updated {shortDate(cookbook.updatedAt)}</span>
        </span>
      </div>
    </a>
  );
}

function OwnedCookbookRecipeCard({ recipe }: { recipe: Recipe }) {
  const imageUrl = displayImageUrl(recipe.imageUrl);

  return (
    <article
      className={`${cookbookCardClassName} flex h-full flex-col overflow-hidden`}
    >
      <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden border-b-2 border-(--color-ink) bg-[linear-gradient(135deg,#fff2c9,#e7f0df_58%,#fffdf8)] text-(--color-sage)">
        {imageUrl ? (
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <Image size={34} strokeWidth={2.2} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <strong className="text-[15px] leading-tight text-(--color-ink)">
          {recipe.title}
        </strong>
        <p className="line-clamp-3 text-[13px] leading-snug text-(--color-fog)">
          {recipe.description || "OpenCook recipe"}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span className="rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5 text-[11px] font-bold text-(--color-fog)">
            {recipeTimeSummary(recipe)}
          </span>
          {recipe.tags.slice(0, 2).map((tag) => (
            <span
              className="rounded-full border-2 border-(--color-line) bg-(--color-rail) px-2 py-0.5 text-[11px] font-bold text-(--color-fog)"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function CookbookSkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`${cookbookSkeletonBlockClassName} ${className}`} />;
}

function CookbookCardSkeleton({ section }: { section: CookbookSection }) {
  return (
    <article
      aria-hidden="true"
      className={`${cookbookCardClassName} flex min-h-[260px] flex-col gap-0 overflow-hidden p-0`}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b-2 border-(--color-ink) bg-(--color-soft)">
        <CookbookSkeletonBlock className="absolute inset-4 rounded-xl bg-(--color-panel)" />
        <div className="absolute right-3 bottom-3 flex gap-1.5">
          <CookbookSkeletonBlock className="h-2.5 w-8 rounded-full" />
          <CookbookSkeletonBlock className="h-2.5 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <CookbookSkeletonBlock className="h-4 w-3/5" />
          {section === "mine" ? (
            <CookbookSkeletonBlock className="h-5 w-14 rounded-full" />
          ) : null}
        </div>
        <CookbookSkeletonBlock className="h-3 w-full" />
        <CookbookSkeletonBlock className="h-3 w-4/5" />
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <CookbookSkeletonBlock className="h-5 w-20 rounded-full" />
          <CookbookSkeletonBlock className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </article>
  );
}

function CookbookLibrarySkeleton({ section }: { section: CookbookSection }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4"
    >
      {cookbookSkeletonItems.map((item) => (
        <CookbookCardSkeleton key={item} section={section} />
      ))}
    </div>
  );
}

function cookbookRecipeSearchText(recipe: Recipe) {
  return recipeSearchText(recipe);
}

function ownedCookbookSearchText(
  cookbook: OwnedCookbook,
  recipesById: Map<string, Recipe>,
) {
  return [
    cookbook.title,
    cookbook.description,
    cookbook.kind,
    visibilityLabel(cookbook.visibility),
    ...cookbook.recipeIds.map((recipeId) => {
      const recipe = recipesById.get(recipeId);
      return recipe ? cookbookRecipeSearchText(recipe) : "";
    }),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function publicCookbookSearchText(cookbook: PublicCookbook) {
  return [
    cookbook.title,
    cookbook.description,
    cookbook.owner.name,
    visibilityLabel(cookbook.visibility),
    ...cookbook.recipes.map(cookbookRecipeSearchText),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function CookbooksPage({
  onCloseCookbook,
  onOpenCookbook,
  recipes,
  selectedCookbookId,
  session,
  sessionLoading,
}: {
  onCloseCookbook: () => void;
  onOpenCookbook: (cookbookId: string) => void;
  recipes: Recipe[];
  selectedCookbookId?: string;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
}) {
  const [cookbooks, setCookbooks] = useState<OwnedCookbook[]>([]);
  const [cookbooksLoaded, setCookbooksLoaded] = useState(false);
  const [publicCookbooks, setPublicCookbooks] = useState<PublicCookbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<CookbookSection>("mine");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [status, setStatus] = useState("");
  const [publicStatus, setPublicStatus] = useState("");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CookbookVisibility>("private");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();

  const visibleOwnedCookbooks = useMemo(
    () => cookbooks.filter(isVisibleOwnedCookbook),
    [cookbooks],
  );
  const recipesById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const cookbookQuery = query.trim().toLowerCase();
  const filteredOwnedCookbooks = useMemo(() => {
    if (!cookbookQuery) {
      return visibleOwnedCookbooks;
    }

    return visibleOwnedCookbooks.filter((cookbook) =>
      ownedCookbookSearchText(cookbook, recipesById).includes(cookbookQuery),
    );
  }, [cookbookQuery, recipesById, visibleOwnedCookbooks]);
  const filteredPublicCookbooks = useMemo(() => {
    if (!cookbookQuery) {
      return publicCookbooks;
    }

    return publicCookbooks.filter((cookbook) =>
      publicCookbookSearchText(cookbook).includes(cookbookQuery),
    );
  }, [cookbookQuery, publicCookbooks]);
  const selectedCookbook = useMemo(
    () => visibleOwnedCookbooks.find((cookbook) => cookbook.id === selectedCookbookId),
    [selectedCookbookId, visibleOwnedCookbooks],
  );
  const selectedRecipeIdSet = useMemo(
    () => new Set(selectedRecipeIds),
    [selectedRecipeIds],
  );

  const loadCookbooks = useCallback(async () => {
    if (!session) {
      setCookbooks([]);
      setCookbooksLoaded(true);
      setStatus(sessionLoading ? "Checking account" : "Log in to create cookbooks.");
      return;
    }

    setLoading(true);
    setCookbooksLoaded(false);
    try {
      const next = await api.listCookbooks();
      setCookbooks(next);
      setStatus("");
    } catch (error) {
      setStatus(`Cookbooks failed: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
      setCookbooksLoaded(true);
    }
  }, [session, sessionLoading]);

  const loadPublicCookbooks = useCallback(async () => {
    setPublicLoading(true);
    try {
      const next = await api.listPublicCookbooks();
      setPublicCookbooks(next);
      setPublicStatus("");
    } catch (error) {
      setPublicStatus(`Public cookbooks failed: ${errorMessage(error)}`);
    } finally {
      setPublicLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCookbooks();
  }, [loadCookbooks]);

  useEffect(() => {
    if (section !== "explore") {
      return;
    }
    void loadPublicCookbooks();
  }, [loadPublicCookbooks, section]);

  useEffect(() => {
    if (
      !cookbooksLoaded ||
      loading ||
      section !== "mine" ||
      visibleOwnedCookbooks.length > 0
    ) {
      return;
    }

    setShowCreateForm(false);
    setSection("explore");
  }, [cookbooksLoaded, loading, section, visibleOwnedCookbooks.length]);

  useEffect(() => {
    setSelectedRecipeIds((current) => {
      const available = new Set(recipes.map((recipe) => recipe.id));
      return current.filter((recipeId) => available.has(recipeId));
    });
  }, [recipes]);

  useEffect(() => {
    if (
      selectedCookbookId &&
      cookbooksLoaded &&
      !loading &&
      !visibleOwnedCookbooks.some((cookbook) => cookbook.id === selectedCookbookId)
    ) {
      onCloseCookbook();
    }
  }, [
    cookbooksLoaded,
    loading,
    onCloseCookbook,
    selectedCookbookId,
    visibleOwnedCookbooks,
  ]);

  function changeSection(nextSection: CookbookSection) {
    setSection(nextSection);
    onCloseCookbook();
    setConfirmDeleteId(undefined);
    if (nextSection !== "mine") {
      setShowCreateForm(false);
    }
  }

  function resetCookbookForm() {
    setTitle("");
    setDescription("");
    setVisibility("private");
    setSelectedRecipeIds([]);
  }

  function openCreateForm() {
    setSection("mine");
    onCloseCookbook();
    setConfirmDeleteId(undefined);
    setShowCreateForm(true);
  }

  function toggleRecipe(recipeId: string) {
    setSelectedRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    );
  }

  async function createCookbook() {
    if (!session || !title.trim() || saving) {
      return;
    }

    setSaving(true);
    try {
      const created = await api.createCookbook({
        description: description.trim(),
        recipeIds: selectedRecipeIds,
        title: title.trim(),
        visibility,
      });
      setCookbooks((current) => [
        created,
        ...current.filter((cookbook) => cookbook.id !== created.id),
      ]);
      resetCookbookForm();
      setShowCreateForm(false);
      setSection("mine");
      setConfirmDeleteId(undefined);
      onOpenCookbook(created.id);
    } catch (error) {
      setStatus(`Create failed: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateCookbookVisibility(
    cookbook: OwnedCookbook,
    nextVisibility: CookbookVisibility,
  ) {
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      const updated =
        cookbook.kind === "top_level"
          ? await api.updateTopLevelCookbook({ visibility: nextVisibility })
          : await api.updateCookbook(cookbook.id, { visibility: nextVisibility });
      setCookbooks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setStatus(`${updated.title} is now ${visibilityLabel(updated.visibility)}.`);
    } catch (error) {
      setStatus(`Visibility failed: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function copyCookbookLink(cookbook: OwnedCookbook) {
    const url = `${window.location.origin}/c/${encodeURIComponent(cookbook.slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus(`Copied ${cookbook.title}`);
    } catch {
      setStatus(url);
    }
  }

  async function deleteCookbook(cookbook: OwnedCookbook) {
    if (cookbook.kind === "top_level") {
      return;
    }
    if (confirmDeleteId !== cookbook.id) {
      setConfirmDeleteId(cookbook.id);
      setStatus(`Click delete again to remove ${cookbook.title}`);
      return;
    }

    setSaving(true);
    try {
      await api.deleteCookbook(cookbook.id);
      setCookbooks((current) => current.filter((item) => item.id !== cookbook.id));
      if (selectedCookbookId === cookbook.id) {
        onCloseCookbook();
      }
      setConfirmDeleteId(undefined);
      setStatus(`Deleted ${cookbook.title}`);
    } catch (error) {
      setStatus(`Delete failed: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  const visibleStatus = section === "mine" ? status : publicStatus;
  const ownedCookbooksLoading = sessionLoading || loading;

  return (
    <section className={cookbookPageClassName}>
      <div className={cookbookPageInnerClassName}>
        <header className="flex items-start justify-between gap-[18px] pb-2 max-[860px]:flex-col max-[860px]:items-stretch">
          <div>
            <h1 className="m-0 font-display text-[clamp(34px,3vw,48px)] font-bold leading-[0.94] tracking-normal text-(--color-ink) [text-shadow:2px_2px_0_#fff7d8]">
              {session ? "Your cookbooks" : "Cookbooks for everyone"}
            </h1>
            <p className="mx-0 mt-[9px] mb-0 max-w-[590px] text-[15px] font-semibold leading-[1.45] text-(--color-fog)">
              Create link-only or public shelves from the recipes in your account.
              Browse public cookbooks when you are starting from an empty shelf.
            </p>
          </div>
          <div className="relative mt-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2 max-md:w-full max-md:justify-start">
            <Button
              className={`${workspacePrimaryActionButtonClassName} max-md:flex-1`}
              disabled={!session || sessionLoading}
              onClick={openCreateForm}
              variant="secondary"
            >
              <Plus size={15} />
              New cookbook
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl
            aria-label="Cookbook sections"
            items={cookbookSectionTabs}
            onChange={changeSection}
            value={section}
          />
        </div>

        <VoiceSearchInput
          aria-label="Search cookbooks"
          activeMicButtonClassName={cookbookSearchActiveMicButtonClassName}
          containerClassName={cookbookSearchInputContainerClassName}
          micButtonClassName={cookbookSearchMicButtonClassName}
          onValueChange={setQuery}
          placeholder={
            section === "mine"
              ? "Search cookbook title, recipes, description"
              : "Search public cookbooks"
          }
          searchIconWrapperClassName={cookbookSearchIconWrapperClassName}
          statusClassName="m-0 text-[11.5px] font-black leading-snug text-(--color-tomato-dark)"
          value={query}
        />

        <div className="grid gap-5">
          {showCreateForm && section === "mine" ? (
            <section
              className={`${cookbookCardClassName} grid max-w-[760px] gap-4 p-4`}
            >
              <StudioSectionHeading
                description="Choose a title, visibility, and the recipes that belong on the shelf."
                icon={<Plus size={20} />}
                title="New cookbook"
              />

              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createCookbook();
                }}
              >
                <label className="grid gap-1.5 text-[13px] font-extrabold text-(--color-fog)">
                  Title
                  <input
                    className="min-h-[38px] rounded-lg border border-solid border-(--color-line) bg-(--color-panel) px-2.5 py-2 text-sm text-(--color-ink)"
                    disabled={!session || saving}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Weeknight dinners"
                    value={title}
                  />
                </label>
                <label className="grid gap-1.5 text-[13px] font-extrabold text-(--color-fog)">
                  Description
                  <textarea
                    className="min-h-[82px] resize-y rounded-lg border border-solid border-(--color-line) bg-(--color-panel) px-2.5 py-2 text-sm leading-snug text-(--color-ink)"
                    disabled={!session || saving}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="A short note for people opening the cookbook."
                    value={description}
                  />
                </label>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="New cookbook visibility"
                >
                  {(["private", "unlisted", "public"] as CookbookVisibility[]).map(
                    (option) => (
                      <button
                        className={visibilityPillClass(visibility === option)}
                        disabled={!session || saving}
                        key={option}
                        onClick={() => setVisibility(option)}
                        type="button"
                      >
                        {visibilityIcon(option)}
                        {visibilityLabel(option)}
                      </button>
                    ),
                  )}
                </div>

                <div className="grid gap-2 rounded-lg border border-solid border-(--color-line) bg-[rgba(255,250,243,0.76)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-(--color-ink)">Recipes</strong>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="text-xs font-extrabold text-(--color-sage)"
                        disabled={!session || saving || recipes.length === 0}
                        onClick={() =>
                          setSelectedRecipeIds(recipes.map((recipe) => recipe.id))
                        }
                        type="button"
                      >
                        Select all
                      </button>
                      <button
                        className="text-xs font-extrabold text-(--color-fog)"
                        disabled={!session || saving || selectedRecipeIds.length === 0}
                        onClick={() => setSelectedRecipeIds([])}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {recipes.length ? (
                    <VirtualList
                      className="max-h-[260px] overflow-auto pr-1"
                      estimatedRowHeight={50}
                      gap={6}
                      getKey={(recipe) => recipe.id}
                      items={recipes}
                      renderItem={(recipe) => (
                        <CookbookRecipeOption
                          checked={selectedRecipeIdSet.has(recipe.id)}
                          disabled={!session || saving}
                          onToggle={toggleRecipe}
                          recipe={recipe}
                        />
                      )}
                    />
                  ) : (
                    <p className="m-0 text-[13px] font-semibold text-(--color-fog)">
                      Add recipes before creating a cookbook.
                    </p>
                  )}
                </div>

                <div className={buttonRowClassName}>
                  <Button
                    className={workspacePrimaryActionButtonClassName}
                    disabled={!session || saving || !title.trim()}
                    type="submit"
                    variant="primary"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    Create cookbook
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => {
                      resetCookbookForm();
                      setShowCreateForm(false);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="grid content-start gap-5">
            {section === "mine" ? (
              <>
                {selectedCookbook ? (
                  <OwnedCookbookDetail
                    confirmDeleteId={confirmDeleteId}
                    cookbook={selectedCookbook}
                    onBack={() => {
                      onCloseCookbook();
                      setConfirmDeleteId(undefined);
                    }}
                    onCopyLink={copyCookbookLink}
                    onDelete={deleteCookbook}
                    onVisibilityChange={updateCookbookVisibility}
                    recipes={recipes}
                    saving={saving}
                  />
                ) : ownedCookbooksLoading ? (
                  <>
                    <p className="sr-only" role="status">
                      Loading cookbooks
                    </p>
                    <CookbookLibrarySkeleton section={section} />
                  </>
                ) : filteredOwnedCookbooks.length ? (
                  <VirtualGrid
                    estimatedRowHeight={300}
                    getKey={(cookbook) => cookbook.id}
                    items={filteredOwnedCookbooks}
                    minColumnWidth={248}
                    renderItem={(cookbook) => (
                      <OwnedCookbookCard
                        cookbook={cookbook}
                        onOpen={(nextCookbook) => {
                          onOpenCookbook(nextCookbook.id);
                          setConfirmDeleteId(undefined);
                          setShowCreateForm(false);
                        }}
                      />
                    )}
                  />
                ) : null}
                {!ownedCookbooksLoading && filteredOwnedCookbooks.length === 0 ? (
                  <p className={emptyNoteClass}>
                    {cookbookQuery && visibleOwnedCookbooks.length
                      ? "No cookbooks match that search."
                      : "No cookbooks yet."}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {publicLoading ? (
                  <>
                    <p className="sr-only" role="status">
                      Loading public cookbooks
                    </p>
                    <CookbookLibrarySkeleton section={section} />
                  </>
                ) : null}
                {!publicLoading && filteredPublicCookbooks.length ? (
                  <VirtualGrid
                    estimatedRowHeight={300}
                    getKey={(cookbook) => cookbook.id}
                    items={filteredPublicCookbooks}
                    minColumnWidth={248}
                    renderItem={(cookbook) => (
                      <PublicCookbookCard cookbook={cookbook} />
                    )}
                  />
                ) : null}
                {!publicLoading && filteredPublicCookbooks.length === 0 ? (
                  <p className={emptyNoteClass}>
                    {cookbookQuery && publicCookbooks.length
                      ? "No public cookbooks match that search."
                      : "No public cookbooks yet. Make one of yours public to start the shelf."}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>

        {visibleStatus ? (
          <p className={inlineStatusClassName}>{visibleStatus}</p>
        ) : null}
      </div>
    </section>
  );
}

function visibilityIcon(visibility: CookbookVisibility) {
  if (visibility === "public") {
    return <Globe2 size={14} />;
  }
  if (visibility === "unlisted") {
    return <Link2 size={14} />;
  }
  return <LockKeyhole size={14} />;
}

function visibilityLabel(visibility: CookbookVisibility) {
  if (visibility === "public") {
    return "Public";
  }
  if (visibility === "unlisted") {
    return "Link-only";
  }
  return "Private";
}

function visibilityPillClass(active: boolean) {
  return buttonClassName({
    active,
    className: "gap-1.5",
    size: "sm",
    variant: "tab",
  });
}

export function SettingsPage({
  onCreateAccount,
  onGoToPage,
  onOpenOnboarding,
  onLogIn,
  onRefreshSession,
  onSignOut,
  recipes,
  session,
  sessionLoading,
}: {
  onCreateAccount: () => void;
  onGoToPage: (page: Page) => void;
  onOpenOnboarding: () => void;
  onLogIn: () => void;
  onRefreshSession: () => Promise<CurrentAuthSession | null>;
  onSignOut: () => Promise<void>;
  recipes: Recipe[];
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
}) {
  return (
    <section className={studioPageClassName}>
      <div className={studioPageInnerClassName}>
        <WorkspaceHeader
          description="Manage your account, food preferences, exports, and API access."
          icon={<SlidersHorizontal size={25} />}
          title="Settings"
        >
          <StudioBadge icon={<UserRound size={16} />} tone={session ? "sage" : "sun"}>
            {sessionLoading
              ? "Checking account"
              : session
                ? "Signed in"
                : "Not signed in"}
          </StudioBadge>
        </WorkspaceHeader>

        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,0.98fr)_minmax(320px,1.02fr)]">
          <StudioPanel>
            <StudioSectionHeading
              description={
                session
                  ? "You are signed in to OpenCook with this email."
                  : "Sign in to keep your cookbook available across sessions."
              }
              icon={<UserRound size={20} />}
              title="Kitchen account"
            />

            <div className={`${studioInsetClassName} mt-4`}>
              <div className={studioListRowClassName}>
                <strong className="truncate text-[15px] leading-[1.2] text-(--color-ink)">
                  {session?.user.email ?? "No account connected"}
                </strong>
                <small className="text-[12px] font-semibold leading-[1.45] text-(--color-fog)">
                  {sessionLoading
                    ? "Checking your session"
                    : session?.user.emailVerified
                      ? "Email verified"
                      : session
                        ? "Email not verified"
                        : "Create an account or log in"}
                </small>
              </div>

              {session ? (
                <AccountNameForm
                  onRefreshSession={onRefreshSession}
                  session={session}
                />
              ) : null}

              <button
                className={studioActionTileClassName}
                onClick={onOpenOnboarding}
                type="button"
              >
                <ListChecks size={18} />
                <span>
                  <strong>Food preferences</strong>
                  <small>
                    Edit diets, allergies, cuisines, spice, time, and equipment.
                  </small>
                </span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {session ? (
                  <PopButton onClick={() => void onSignOut()} size="sm" tone="danger">
                    Log out
                  </PopButton>
                ) : (
                  <>
                    <PopButton onClick={onCreateAccount} size="sm" tone="primary">
                      <UserPlus size={16} />
                      Create account
                    </PopButton>
                    <PopButton onClick={onLogIn} size="sm" tone="secondary">
                      <LogIn size={16} />
                      Log in
                    </PopButton>
                  </>
                )}
              </div>
            </div>
          </StudioPanel>

          <StudioPanel tone="sun">
            <StudioSectionHeading
              description="Jump straight to the pages that keep your recipes portable, paid, and programmable."
              icon={<Database size={20} />}
              title="Portable kitchen"
            />

            <div className="mt-4 grid gap-3">
              <button
                className={studioActionTileClassName}
                onClick={() => onGoToPage("export")}
                type="button"
              >
                <Download size={18} />
                <span>
                  <strong>Export recipes</strong>
                  <small>
                    Download portable JSON or Markdown copies whenever you want.
                  </small>
                </span>
              </button>
              <button
                className={studioActionTileClassName}
                onClick={() => onGoToPage("billing")}
                type="button"
              >
                <CreditCard size={18} />
                <span>
                  <strong>Billing and plan</strong>
                  <small>
                    Check Chef access, remaining AI allowance, and the billing portal.
                  </small>
                </span>
              </button>
              <button
                className={studioActionTileClassName}
                onClick={() => onGoToPage("api")}
                type="button"
              >
                <Braces size={18} />
                <span>
                  <strong>Developer API</strong>
                  <small>
                    Inspect the live schema, agent manifest, and Codex connection tools.
                  </small>
                </span>
              </button>
            </div>
          </StudioPanel>
        </div>
      </div>
    </section>
  );
}

export function BuildPage() {
  return (
    <section
      className={`${workspaceScrollPageClassName} bg-[color-mix(in_oklch,var(--color-pop-bg)_82%,white)]`}
    >
      <div className={pageContainerClassName}>
        <header>
          <div>
            <h1>Build Your Own Recipe App</h1>
            <p>
              OpenCook keeps the recipe contract, OpenAPI schema, and exports portable
              so Codex can build new views and workflows without trapping your recipes
              inside another company account.
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
      </div>
    </section>
  );
}
