import {
  type Recipe,
  type RecipeVisibility,
  recipeSearchText,
  type SharedRecipe,
  structureIngredients,
  structureSteps,
} from "@open-cook/core";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  BookOpen,
  Braces,
  CheckCircle2,
  Compass,
  CreditCard,
  Download,
  FileText,
  Globe2,
  KeyRound,
  LibraryBig,
  LogIn,
  LogOut,
  Plus,
  RefreshCcw,
  Settings,
  UploadCloud,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../api";
import type { CurrentAuthSession } from "../authApi";
import { useSession } from "../context/SessionProvider";
import {
  Button,
  buttonClassName,
  buttonRowClassName,
  checkRowClassName,
  fieldClassName,
  inlineStatusClassName,
  panelTitleClassName,
  workspacePageBaseClassName,
} from "../ui";
import {
  type AuthIntent,
  emptyRecipe,
  errorMessage,
  optionalNumber,
  type Page,
  recipeAutoSaveDebounceMs,
  recipeAutoSavePayload,
  recipeSearchDebounceMs,
  type RecipeSection,
  recipesFromStashCookExport,
  type SaveState,
  sharedRecipeKey,
  useDebouncedValue,
} from "../lib/recipe";
import {
  BrowseRecipePage,
  RecipeLibrary,
  RecipeNotFound,
  RecipePage,
} from "./recipePage";
import { ApiPage, BuildPage, ExportPage, SettingsPage, WorkspaceHeader } from "./tools";

type WorkspaceSearchState = {
  add?: boolean;
  browse?: string;
  page?: Page;
  recipe?: string;
  section?: RecipeSection;
};

const workspaceSearchKeys: Array<keyof WorkspaceSearchState> = [
  "add",
  "browse",
  "page",
  "recipe",
  "section",
];

function searchSection(search: WorkspaceSearchState): RecipeSection {
  return search.section ?? (search.browse ? "shared" : "mine");
}

function workspaceSearchEqual(
  current: WorkspaceSearchState,
  next: WorkspaceSearchState,
) {
  return workspaceSearchKeys.every((key) => current[key] === next[key]);
}

const importDetailsClassName =
  "group rounded-lg border border-solid border-(--color-line) bg-[rgba(255,253,248,0.58)] max-[860px]:min-w-0 max-[860px]:max-w-full";

const importSummaryClassName =
  "flex cursor-pointer list-none items-center justify-between gap-4 px-[13px] py-3 text-(--color-ink) group-open:border-b group-open:border-solid group-open:border-(--color-line) max-[820px]:flex-col max-[820px]:items-start max-[820px]:gap-1.5 [&::-webkit-details-marker]:hidden [&>small]:text-[11px] [&>small]:font-[720] [&>small]:text-(--color-fog) [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span]:font-[760] [&>span]:text-[#37423a]";

const advancedImportGridClassName =
  "grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4 border-t border-solid border-(--color-line) p-4 max-[860px]:grid-cols-1";

const fieldHelpClassName =
  "text-xs font-[650] leading-[1.45] text-(--color-pop-muted-ink) [&_code]:font-extrabold [&_code]:text-(--color-pop-ink)";

const importUrlFieldClassName =
  "grid min-h-[92px] content-center gap-[7px] rounded-lg border border-solid border-[#ddd2c2] bg-(--color-panel) p-2.5 text-xs font-[760] text-[#5e675f] [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-lg [&_input]:font-[520] [&_input]:text-(--color-ink) [&_input]:outline-0 [&_input::placeholder]:text-[#8a8378]";

export function AppNav({
  onAuthIntent,
  onNavigateHome,
  onSignOut,
  page,
  session,
  sessionLoading,
  setPage,
}: {
  onAuthIntent: (intent: Exclude<AuthIntent, null>) => void;
  onNavigateHome: () => void;
  onSignOut: () => Promise<void>;
  page: Page;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
  setPage: (page: Page) => void;
}) {
  const profileMenuRef = useRef<HTMLDetailsElement>(null);

  function closeProfileMenu() {
    profileMenuRef.current?.removeAttribute("open");
  }

  function openMenuPage(nextPage: Page) {
    setPage(nextPage);
    closeProfileMenu();
  }

  return (
    <header className="col-[1/-1] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_78%,transparent)] px-6 py-3 backdrop-blur-[16px] backdrop-saturate-[1.3] max-[980px]:col-[1] max-[980px]:row-auto max-[980px]:grid-cols-1 max-[720px]:px-4">
      <button
        className="inline-flex min-h-[38px] items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold tracking-[-0.01em] text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66] max-[860px]:flex-initial"
        onClick={onNavigateHome}
        type="button"
      >
        <img alt="" className="size-7" src="/logo.png" />
        <span>OpenCook</span>
      </button>
      <nav
        className="flex items-center justify-center max-[980px]:justify-start"
        aria-label="Primary"
      />
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-[980px]:justify-start max-[860px]:flex-nowrap max-[860px]:overflow-x-auto max-[860px]:pb-1 max-[860px]:[&>*]:flex-none">
        {sessionLoading ? (
          <span
            className="inline-flex aspect-square w-9 min-h-9 items-center justify-center rounded-lg border border-solid border-transparent bg-transparent p-2 text-(--color-fog)"
            aria-label="Checking account"
            role="status"
          >
            <RefreshCcw className="animate-[spin_900ms_linear_infinite]" size={15} />
          </span>
        ) : session ? (
          <details className="group relative" ref={profileMenuRef}>
            <summary
              aria-label="Account menu"
              className={buttonClassName({
                active: page === "api" || page === "export" || page === "settings",
                className:
                  "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                size: "icon",
              })}
            >
              <UserRound size={16} />
            </summary>
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 hidden min-w-[184px] gap-[3px] rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-1.5 shadow-workspace group-open:grid max-[860px]:left-0 max-[860px]:right-auto">
              {session.user.email ? (
                <div className="mb-[3px] grid gap-px border-b border-solid border-(--color-line) px-[9px] pt-1 pb-2">
                  {session.user.name ? (
                    <span className="truncate text-[13px] font-extrabold text-(--color-ink)">
                      {session.user.name}
                    </span>
                  ) : null}
                  <span className="truncate text-xs font-semibold text-(--color-fog)">
                    {session.user.email}
                  </span>
                </div>
              ) : null}
              <Button
                active={page === "settings"}
                onClick={() => openMenuPage("settings")}
                size="sm"
                variant="ghost"
              >
                <Settings size={15} />
                Settings
              </Button>
              <Link
                className={buttonClassName({ size: "sm", variant: "ghost" })}
                onClick={closeProfileMenu}
                to="/account"
              >
                <CreditCard size={15} />
                Billing
              </Link>
              <Button
                active={page === "api"}
                onClick={() => openMenuPage("api")}
                size="sm"
                variant="ghost"
              >
                <Braces size={15} />
                API
              </Button>
              <Button
                active={page === "export"}
                onClick={() => openMenuPage("export")}
                size="sm"
                variant="ghost"
              >
                <Download size={15} />
                Export
              </Button>
              <Button
                onClick={() => {
                  closeProfileMenu();
                  void onSignOut();
                }}
                size="sm"
                variant="ghost"
              >
                <LogOut size={15} />
                Log out
              </Button>
            </div>
          </details>
        ) : (
          <>
            <Button onClick={() => onAuthIntent("login")} size="sm">
              <LogIn size={15} />
              Log in
            </Button>
            <Button onClick={() => onAuthIntent("signup")} size="sm" variant="primary">
              <UserPlus size={15} />
              Register
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

export function RecipeSectionTabs({
  onSelect,
  section,
  sharedCount,
}: {
  onSelect: (section: RecipeSection) => void;
  section: RecipeSection;
  sharedCount: number;
}) {
  const tabs: Array<{
    badge?: number;
    icon: ReactNode;
    key: RecipeSection;
    label: string;
  }> = [
    { icon: <LibraryBig size={15} />, key: "mine", label: "Yours" },
    {
      badge: sharedCount,
      icon: <Users size={15} />,
      key: "shared",
      label: "Shared with you",
    },
    { icon: <Compass size={15} />, key: "explore", label: "Explore" },
  ];

  return (
    <nav
      aria-label="Recipe sections"
      className="flex flex-wrap gap-1 border-b border-(--color-line)"
    >
      {tabs.map((tab) => {
        const isActive = section === tab.key;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-extrabold leading-none transition ${
              isActive
                ? "border-(--color-tomato) text-(--color-ink)"
                : "border-transparent text-(--color-fog) hover:text-(--color-ink)"
            }`}
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            type="button"
          >
            {tab.icon}
            {tab.label}
            {tab.badge ? (
              <span className="min-w-5 rounded-full border-2 border-[var(--border)] bg-[var(--pop-pink)] px-[5px] py-[3px] text-center text-[11px] leading-none text-white">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function TopBar({
  loggedIn,
  onCreateBlank,
  onImport,
}: {
  loggedIn: boolean;
  onCreateBlank: () => void | Promise<void>;
  onImport: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-[18px] pb-2 max-[860px]:flex-col max-[860px]:items-stretch">
      <div>
        <h1 className="m-0 font-display text-[clamp(32px,2.3vw,42px)] font-bold leading-[0.98] tracking-normal text-(--color-ink)">
          {loggedIn ? "Your recipes" : "Recipes for everyone"}
        </h1>
        <p className="mx-0 mt-[9px] mb-0 max-w-[560px] text-sm leading-[1.42] text-(--color-fog)">
          Import the recipes you cook, keep every original safe, and make new versions
          from them. Adapt the cooking, theme the look, or write a story.
        </p>
      </div>
      <NewRecipeMenu onCreateBlank={onCreateBlank} onImport={onImport} />
    </header>
  );
}

// Single merged entry point: "Blank" creates a recipe instantly, "Import" opens
// the bring-in flow. Replaces the old separate New + Add recipes buttons.
export function NewRecipeMenu({
  onCreateBlank,
  onImport,
}: {
  onCreateBlank: () => void | Promise<void>;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative mt-0.5 shrink-0 max-md:w-full" ref={containerRef}>
      <Button
        className="w-full"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Plus size={16} />
        New recipe
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border-2 border-(--color-ink) bg-white shadow-[6px_6px_0_0_var(--color-ink)] max-md:left-0 max-md:w-full">
          <button
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_12%,white)]"
            onClick={() => {
              setOpen(false);
              void onCreateBlank();
            }}
            type="button"
          >
            <FileText className="mt-0.5 shrink-0" size={18} />
            <span>
              <strong className="block text-sm">Blank recipe</strong>
              <small className="text-(--color-fog)">Start from scratch</small>
            </span>
          </button>
          <button
            className="flex w-full items-start gap-3 border-t-2 border-(--color-ink) px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_12%,white)]"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
            type="button"
          >
            <UploadCloud className="mt-0.5 shrink-0" size={18} />
            <span>
              <strong className="block text-sm">Import…</strong>
              <small className="text-(--color-fog)">Website, file, or StashCook</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type ImporterPanelProps = {
  importMarkdown: (markdownText?: string) => Promise<void>;
  importStashCook: () => Promise<void>;
  importStashCookExport: (file?: File | null) => Promise<void>;
  importWebsite: () => Promise<void>;
  markdown: string;
  setMarkdown: (value: string) => void;
  setStashCookBaseUrl: (value: string) => void;
  setStashCookCookie: (value: string) => void;
  setStashCookIncludeDeleted: (value: boolean) => void;
  setStashCookTake: (value: string) => void;
  setStashCookToken: (value: string) => void;
  setWebsiteUrl: (value: string) => void;
  stashCookBaseUrl: string;
  stashCookCookie: string;
  stashCookExportFileName: string;
  stashCookIncludeDeleted: boolean;
  stashCookTake: string;
  stashCookToken: string;
  websiteUrl: string;
};

export function AddRecipePage({
  message,
  onCancel,
  ...importerProps
}: ImporterPanelProps & {
  message: string;
  onCancel: () => void;
}) {
  return (
    <section
      className={`${workspacePageBaseClassName} grid content-start gap-5 bg-[#fffbf4] [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[880px]`}
    >
      <WorkspaceHeader
        description="Bring recipes in from a link, file, StashCook export, or OpenCook Markdown."
        icon={<UploadCloud size={25} />}
        onBack={onCancel}
        title="Add recipes"
      />
      {message !== "Ready" ? (
        <p className={inlineStatusClassName}>
          <CheckCircle2 size={16} />
          {message}
        </p>
      ) : null}
      <ImporterPanel {...importerProps} />
    </section>
  );
}

export function ImporterPanel({
  importMarkdown,
  importStashCook,
  importStashCookExport,
  importWebsite,
  markdown,
  setMarkdown,
  setStashCookBaseUrl,
  setStashCookCookie,
  setStashCookIncludeDeleted,
  setStashCookTake,
  setStashCookToken,
  setWebsiteUrl,
  stashCookBaseUrl,
  stashCookCookie,
  stashCookExportFileName,
  stashCookIncludeDeleted,
  stashCookTake,
  stashCookToken,
  websiteUrl,
}: ImporterPanelProps) {
  async function importRecipeFile(file?: File | null) {
    if (!file) {
      return;
    }

    if (file.name.toLowerCase().endsWith(".json")) {
      await importStashCookExport(file);
      return;
    }

    await importMarkdown(await file.text());
  }

  return (
    <section className="mt-0 grid w-full gap-3.5 max-[860px]:min-w-0 max-[860px]:max-w-full">
      <div className="mt-3.5 grid grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] gap-3.5 max-[860px]:grid-cols-1">
        <form
          className="grid min-h-[252px] min-w-0 content-between gap-3.5 rounded-lg border border-solid border-(--color-pop-ink) p-6 shadow-pop-sm [background:linear-gradient(135deg,rgba(47,104,75,0.08),transparent_42%),linear-gradient(180deg,#fffdf8,#f7efe2)] [&_p]:mx-0 [&_p]:mt-[-4px] [&_p]:mb-0 [&_p]:max-w-[580px] [&_p]:text-sm [&_p]:text-(--color-pop-muted-ink)"
          onSubmit={(event) => {
            event.preventDefault();
            if (websiteUrl) {
              void importWebsite();
            }
          }}
        >
          <div>
            <span className={panelTitleClassName}>
              <Globe2 size={15} />
              Import from a link
            </span>
            <p>
              Paste a recipe URL and OpenCook fetches the page, extracts the recipe, and
              saves it to your recipes.
            </p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(144px,180px)] items-stretch gap-2.5 max-[820px]:grid-cols-1">
            <label className={importUrlFieldClassName}>
              Recipe URL
              <input
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="https://example.com/recipe"
                type="url"
                value={websiteUrl}
              />
            </label>
            <Button
              className="min-h-[92px]! text-[15px]"
              disabled={!websiteUrl}
              type="submit"
              variant="primary"
            >
              <Download size={16} />
              Import recipe
            </Button>
          </div>
        </form>
        <label
          className="grid min-h-[178px] cursor-pointer content-start place-items-center gap-2 rounded-lg border border-dashed border-[#c9bda9] bg-[#f8f4ec] p-[22px] text-center text-[#3f4a42] transition hover:-translate-y-px hover:border-(--color-pop-accent) hover:bg-[#fffaf2] [&>input]:hidden [&>span]:max-w-[300px] [&>span]:text-[13px] [&>span]:text-(--color-pop-muted-ink) [&>strong]:text-(--color-pop-ink) [&>svg]:text-(--color-pop-accent)"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void importRecipeFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            accept=".json,.md,.markdown,text/markdown,text/plain,application/json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              void importRecipeFile(file);
              event.currentTarget.value = "";
            }}
            type="file"
          />
          <UploadCloud size={26} />
          <strong>Drop a file here or click to browse</strong>
          <span>
            {stashCookExportFileName
              ? `Imported ${stashCookExportFileName}`
              : "StashCook JSON, Markdown, or plain text."}
          </span>
        </label>
      </div>
      <details className={importDetailsClassName}>
        <summary className={importSummaryClassName}>
          <span>
            <BookOpen size={15} />
            Paste Markdown
          </span>
          <small>For recipes you already have as text</small>
        </summary>
        <div className={`${advancedImportGridClassName} grid-cols-[minmax(0,1fr)]`}>
          <label className={fieldClassName}>
            OpenCook Markdown
            <textarea
              className="min-h-[170px]!"
              onChange={(event) => setMarkdown(event.target.value)}
              placeholder="# Recipe title&#10;&#10;## Ingredients&#10;- 1 thing&#10;&#10;## Method&#10;1. Cook it"
              value={markdown}
            />
          </label>
          <div className={buttonRowClassName}>
            <Button
              disabled={!markdown}
              onClick={() => void importMarkdown()}
              size="sm"
              variant="primary"
            >
              <Download size={15} />
              Import Markdown
            </Button>
          </div>
        </div>
      </details>
      <details className={importDetailsClassName}>
        <summary className={importSummaryClassName}>
          <span>
            <KeyRound size={15} />
            Import from a StashCook account
          </span>
          <small>One-time migration for StashCook users</small>
        </summary>
        <div className={advancedImportGridClassName}>
          <div className="grid min-w-0 content-start gap-3">
            <label className={fieldClassName}>
              Session token
              <input
                onChange={(event) => setStashCookToken(event.target.value)}
                placeholder="Paste your StashCook bearer token"
                type="password"
                value={stashCookToken}
              />
            </label>
            <label className={fieldClassName}>
              Session cookie (alternative)
              <input
                onChange={(event) => setStashCookCookie(event.target.value)}
                placeholder="Paste your StashCook cookie instead"
                type="password"
                value={stashCookCookie}
              />
            </label>
            <small className={fieldHelpClassName}>
              You only need one of the two. Find them in your browser dev tools while
              logged in to StashCook: the <code>Authorization</code> header or the
              session cookie.
            </small>
          </div>
          <div className="grid min-w-0 content-start gap-3">
            <label className={fieldClassName}>
              Base URL (optional)
              <input
                onChange={(event) => setStashCookBaseUrl(event.target.value)}
                placeholder="https://app.stashcook.com"
                value={stashCookBaseUrl}
              />
            </label>
            <label className={fieldClassName}>
              Max recipes
              <input
                max="200"
                min="1"
                onChange={(event) => setStashCookTake(event.target.value)}
                type="number"
                value={stashCookTake}
              />
            </label>
            <label className={checkRowClassName}>
              <input
                checked={stashCookIncludeDeleted}
                onChange={(event) => setStashCookIncludeDeleted(event.target.checked)}
                type="checkbox"
              />
              Include deleted recipes
            </label>
          </div>
          <div className="col-span-full flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[#eee7dc] pt-3.5">
            <small className={fieldHelpClassName}>
              Credentials are cleared once the import finishes.
            </small>
            <Button
              disabled={!stashCookToken && !stashCookCookie}
              onClick={() => void importStashCook()}
              size="sm"
              variant="primary"
            >
              <Download size={15} />
              Import from StashCook
            </Button>
          </div>
        </div>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------
// RecipeWorkspace: the authenticated /app workspace (client-rendered).
// ---------------------------------------------------------------------------
export function RecipeWorkspace() {
  const navigate = useNavigate({ from: "/app" });
  const appSearch = useSearch({ from: "/app" });
  const { session, sessionError, sessionLoading, openAuth, refreshSession, signOut } =
    useSession();
  const [page, setPage] = useState<Page>(appSearch.page ?? "recipes");
  const [addMode, setAddMode] = useState(Boolean(appSearch.add));
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(appSearch.recipe);
  const [persistedVisibilityById, setPersistedVisibilityById] = useState<
    Record<string, RecipeVisibility>
  >({});
  const [draft, setDraft] = useState<Recipe>(emptyRecipe);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [section, setSection] = useState<RecipeSection>(searchSection(appSearch));
  const [sharedRecipes, setSharedRecipes] = useState<SharedRecipe[]>([]);
  const [sharedRecipesLoading, setSharedRecipesLoading] = useState(true);
  const [publicRecipes, setPublicRecipes] = useState<SharedRecipe[]>([]);
  const [publicRecipesLoading, setPublicRecipesLoading] = useState(true);
  const [sharedSelectedKey, setSharedSelectedKey] = useState<string | undefined>(
    appSearch.browse,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [message, setMessage] = useState("Ready");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [stashCookToken, setStashCookToken] = useState("");
  const [stashCookCookie, setStashCookCookie] = useState("");
  const [stashCookBaseUrl, setStashCookBaseUrl] = useState("");
  const [stashCookTake, setStashCookTake] = useState("50");
  const [stashCookIncludeDeleted, setStashCookIncludeDeleted] = useState(false);
  const [stashCookExportFileName, setStashCookExportFileName] = useState("");
  const [markdown, setMarkdown] = useState("");
  const debouncedQuery = useDebouncedValue(query, recipeSearchDebounceMs);
  const debouncedDraft = useDebouncedValue(draft, recipeAutoSaveDebounceMs);
  const recipeRequestIdRef = useRef(0);
  const savingRef = useRef(false);
  const activeSaveCountRef = useRef(0);
  const latestDraftRef = useRef(draft);
  const mountedRef = useRef(true);
  const pendingVisibilityRef = useRef<RecipeVisibility | null>(null);
  const visibilitySaveRef = useRef(false);
  const loadedRecipeIdRef = useRef<string | undefined>(undefined);
  const applyingUrlStateRef = useRef(false);

  const workspaceSearch = useMemo<WorkspaceSearchState>(() => {
    if (addMode) {
      return { add: true };
    }

    if (page !== "recipes") {
      return { page };
    }

    if (section === "mine") {
      return selectedId ? { recipe: selectedId } : {};
    }

    return {
      section,
      ...(sharedSelectedKey ? { browse: sharedSelectedKey } : {}),
    };
  }, [addMode, page, section, selectedId, sharedSelectedKey]);

  useEffect(() => {
    const nextPage = appSearch.page ?? "recipes";
    const nextAddMode = Boolean(appSearch.add);
    const nextSection = searchSection(appSearch);
    const nextSelectedId = appSearch.recipe;
    const nextSharedSelectedKey = appSearch.browse;

    if (!workspaceSearchEqual(appSearch, workspaceSearch)) {
      applyingUrlStateRef.current = true;
    }

    setPage(nextPage);
    setAddMode(nextAddMode);
    setSection(nextSection);
    setSelectedId(nextSelectedId);
    setSharedSelectedKey(nextSharedSelectedKey);
  }, [
    appSearch.add,
    appSearch.browse,
    appSearch.page,
    appSearch.recipe,
    appSearch.section,
  ]);

  useEffect(() => {
    if (applyingUrlStateRef.current) {
      applyingUrlStateRef.current = false;
      return;
    }

    if (workspaceSearchEqual(appSearch, workspaceSearch)) {
      return;
    }

    void navigate({
      replace: true,
      resetScroll: false,
      search: workspaceSearch,
      to: "/app",
    });
  }, [
    appSearch.add,
    appSearch.browse,
    appSearch.page,
    appSearch.recipe,
    appSearch.section,
    navigate,
    workspaceSearch,
  ]);

  const sessionUserId = session?.user.id ?? null;

  const visibleRecipes = recipes;
  const selectedRecipe = useMemo(
    () =>
      visibleRecipes.find((recipe) => recipe.id === selectedId) ?? visibleRecipes[0],
    [visibleRecipes, selectedId],
  );

  // A ?recipe=<id> deep link can resolve to nothing: the recipe was deleted, it
  // belongs to someone else, or the visitor is signed out (owned recipes are
  // never public). Once the session/list settle, show a clear "not found" page
  // instead of redirecting to Explore or rendering a blank recipe.
  const recipeParam = appSearch.recipe;
  const selectedRecipeMissing =
    Boolean(recipeParam) &&
    !sessionLoading &&
    (!sessionUserId ||
      (!recipesLoading && !visibleRecipes.some((recipe) => recipe.id === recipeParam)));

  const goToRecipeLibrary = useCallback(() => {
    setPage("recipes");
    setAddMode(false);
  }, []);

  const openRecipeImportPage = useCallback(() => {
    setPage("recipes");
    setAddMode(true);
  }, []);

  const openAppPage = useCallback((nextPage: Page) => {
    setPage(nextPage);
    setAddMode(false);
  }, []);

  // Logged-out visitors only have the public Explore shelf. There is no
  // "Yours" or "Shared with you" for them. So keep them on Explore — unless a
  // ?recipe=<id> deep link is present, which routes to the not-found page.
  useEffect(() => {
    if (sessionLoading || sessionUserId || appSearch.recipe) {
      return;
    }
    setSection("explore");
  }, [appSearch.recipe, sessionLoading, sessionUserId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  const beginSave = useCallback(() => {
    activeSaveCountRef.current += 1;
    setSaveState("saving");
  }, []);

  const finishSave = useCallback(
    (
      nextState: Extract<SaveState, "error" | "saved">,
      options: { keepSaving?: boolean } = {},
    ) => {
      activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      if (activeSaveCountRef.current === 0 && mountedRef.current) {
        setSaveState(options.keepSaving ? "saving" : nextState);
      }
    },
    [],
  );

  const loadRecipes = useCallback(
    async (nextQuery = "") => {
      const requestId = recipeRequestIdRef.current + 1;
      recipeRequestIdRef.current = requestId;

      if (!sessionUserId) {
        setRecipes([]);
        setSelectedId(undefined);
        return;
      }

      let nextRecipes: Recipe[];
      try {
        nextRecipes = await api.listRecipes(nextQuery.trim());
        if (recipeRequestIdRef.current !== requestId) {
          return;
        }
      } catch (error) {
        if (recipeRequestIdRef.current !== requestId) {
          return;
        }
        throw error;
      }

      setRecipes(nextRecipes);
      // Keep the open recipe open if it still exists; otherwise fall back to the
      // library shelf rather than auto-opening the first recipe.
      setSelectedId((current) =>
        current && nextRecipes.some((recipe) => recipe.id === current)
          ? current
          : undefined,
      );
    },
    [sessionUserId],
  );

  const loadSharedRecipes = useCallback(async () => {
    if (!sessionUserId) {
      setSharedRecipes([]);
      setSharedRecipesLoading(false);
      return;
    }
    setSharedRecipesLoading(true);
    try {
      setSharedRecipes(await api.listSharedRecipes());
    } catch (error) {
      setMessage(`Loading shared recipes failed: ${errorMessage(error)}`);
    } finally {
      setSharedRecipesLoading(false);
    }
  }, [sessionUserId]);

  const loadPublicRecipes = useCallback(async () => {
    setPublicRecipesLoading(true);
    try {
      setPublicRecipes(await api.listPublicRecipes());
    } catch (error) {
      setMessage(`Loading public recipes failed: ${errorMessage(error)}`);
    } finally {
      setPublicRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    void loadSharedRecipes();
  }, [loadSharedRecipes, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || section !== "explore") {
      return;
    }
    void loadPublicRecipes();
  }, [loadPublicRecipes, section, sessionLoading]);

  const sectionQuery = query.trim().toLowerCase();
  const browseRecipes = useMemo(() => {
    const list = section === "shared" ? sharedRecipes : publicRecipes;
    if (!sectionQuery) {
      return list;
    }
    return list.filter((recipe) =>
      `${recipeSearchText(recipe)} ${recipe.owner.name.toLowerCase()}`.includes(
        sectionQuery,
      ),
    );
  }, [section, sharedRecipes, publicRecipes, sectionQuery]);

  // No fallback: an undefined key means the browse library shelf is showing and
  // no recipe is open yet.
  const openBrowse = useMemo(
    () =>
      sharedSelectedKey
        ? browseRecipes.find((recipe) => sharedRecipeKey(recipe) === sharedSelectedKey)
        : undefined,
    [browseRecipes, sharedSelectedKey],
  );
  const sharedUnreadCount = sharedRecipes.filter((recipe) => !recipe.seenAt).length;
  const recipesPageLoading =
    sessionLoading ||
    (section === "mine"
      ? recipesLoading
      : section === "shared"
        ? sharedRecipesLoading
        : publicRecipesLoading);

  const openOwnedRecipe = useCallback((id: string) => {
    setSection("mine");
    setSelectedId(id);
    setMode("view");
  }, []);

  const closeRecipe = useCallback(() => {
    setSelectedId(undefined);
  }, []);

  const openBrowseRecipe = useCallback((key: string) => {
    setSharedSelectedKey(key);
  }, []);

  const closeBrowseRecipe = useCallback(() => {
    setSharedSelectedKey(undefined);
  }, []);

  useEffect(() => {
    if (section !== "shared" || !openBrowse || openBrowse.seenAt) {
      return;
    }

    let cancelled = false;
    const selectedKey = sharedRecipeKey(openBrowse);
    api
      .markSharedRecipeSeen(openBrowse.owner.id, openBrowse.id)
      .then((updatedRecipe) => {
        if (cancelled) {
          return;
        }
        setSharedRecipes((current) =>
          current.map((recipe) =>
            sharedRecipeKey(recipe) === selectedKey ? updatedRecipe : recipe,
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(`Marking shared recipe seen failed: ${errorMessage(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [section, openBrowse]);

  useEffect(() => {
    api
      .health()
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!sessionUserId) {
      recipeRequestIdRef.current += 1;
      setRecipes([]);
      // Keep a ?recipe=<id> deep link selected so the not-found page can render
      // instead of the URL being rewritten back to the library/Explore.
      if (!appSearch.recipe) {
        setSelectedId(undefined);
      }
      setRecipesLoading(false);
      setMessage(sessionError ? `Session check failed: ${sessionError}` : "Ready");
      return;
    }

    setRecipesLoading(true);
    void loadRecipes(debouncedQuery)
      .catch((error) => {
        setRecipes([]);
        setSelectedId(undefined);
        setMessage(`Recipe refresh failed: ${errorMessage(error)}`);
      })
      .finally(() => setRecipesLoading(false));
  }, [
    appSearch.recipe,
    debouncedQuery,
    loadRecipes,
    sessionError,
    sessionLoading,
    sessionUserId,
  ]);

  // Load the open recipe into the draft when the selection changes. But not
  // when auto-save merely refreshes the same recipe's persisted copy, which
  // would clobber the edits the user is still typing. Clearing the selection
  // (returning to the library) resets the guard so reopening reloads fresh.
  useEffect(() => {
    if (!selectedId) {
      loadedRecipeIdRef.current = undefined;
      return;
    }
    const next = visibleRecipes.find((recipe) => recipe.id === selectedId);
    if (!next) {
      return;
    }
    if (loadedRecipeIdRef.current === next.id && next.id !== "") {
      return;
    }
    loadedRecipeIdRef.current = next.id;
    setDraft(next);
  }, [selectedId, visibleRecipes]);

  function ensureSignedIn(action: string) {
    if (sessionLoading) {
      setMessage(`Checking account before ${action}.`);
      return false;
    }

    if (sessionUserId) {
      return true;
    }

    openAuth("login");
    setMessage(`Log in to ${action}.`);
    return false;
  }

  // Merge a freshly persisted recipe back into local state without a full
  // reload (which would reorder the list and steal editor focus mid-edit).
  function applySavedRecipe(saved: Recipe) {
    setRecipes((current) =>
      current.some((recipe) => recipe.id === saved.id)
        ? current.map((recipe) => (recipe.id === saved.id ? saved : recipe))
        : [saved, ...current],
    );
    setPersistedVisibilityById((current) => ({
      ...current,
      [saved.id]: saved.visibility ?? "private",
    }));
  }

  // The single "New recipe → Blank" entry point. Per product decision the record
  // is created immediately so auto-save has an id to update from the first edit.
  async function createBlankRecipe() {
    if (!ensureSignedIn("create a recipe")) {
      return;
    }

    try {
      const saved = await api.createRecipe({ title: "Untitled recipe" });
      applySavedRecipe(saved);
      setSection("mine");
      setPage("recipes");
      setSelectedId(saved.id);
      setMode("edit");
      setSaveState("saved");
      setAddMode(false);
    } catch (error) {
      setMessage(`Could not start a recipe: ${errorMessage(error)}`);
    }
  }

  // Debounced auto-save: persist the draft whenever it diverges from the stored
  // copy. New recipes always have an id (created up front), so this only ever
  // PUTs. No create races to worry about.
  useEffect(() => {
    if (!sessionUserId || savingRef.current) {
      return;
    }

    const id = debouncedDraft.id;
    if (!id || id.startsWith("demo-") || !debouncedDraft.title.trim()) {
      return;
    }

    const persisted = recipes.find((recipe) => recipe.id === id);
    if (
      !persisted ||
      JSON.stringify(recipeAutoSavePayload(debouncedDraft)) ===
        JSON.stringify(recipeAutoSavePayload(persisted))
    ) {
      return;
    }

    const payload = recipeAutoSavePayload(debouncedDraft);
    savingRef.current = true;
    beginSave();
    void api
      .updateRecipe(id, payload)
      .then((saved) => {
        if (!mountedRef.current) {
          return;
        }
        applySavedRecipe(saved);
        const latestDraft = latestDraftRef.current;
        const latestStillDirty =
          latestDraft.id === saved.id &&
          JSON.stringify(recipeAutoSavePayload(latestDraft)) !==
            JSON.stringify(recipeAutoSavePayload(saved));
        finishSave("saved", { keepSaving: latestStillDirty });
      })
      .catch((error) => {
        if (mountedRef.current) {
          finishSave("error");
          setMessage(`Auto-save failed: ${errorMessage(error)}`);
        }
      })
      .finally(() => {
        savingRef.current = false;
      });
  }, [beginSave, debouncedDraft, finishSave, recipes, sessionUserId]);

  // Let the "Saved" confirmation fade back to a neutral resting state.
  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }
    const timeout = setTimeout(() => setSaveState("idle"), 1600);
    return () => clearTimeout(timeout);
  }, [saveState]);

  async function updateRecipeVisibility(visibility: RecipeVisibility) {
    const recipeId = draft.id;

    if (!recipeId || recipeId.startsWith("demo-")) {
      setDraft((current) => ({ ...current, visibility }));
      setMessage("Save this recipe before sharing it.");
      return;
    }

    if (!ensureSignedIn("change recipe visibility")) {
      return;
    }

    setDraft((current) =>
      current.id === recipeId ? { ...current, visibility } : current,
    );
    pendingVisibilityRef.current = visibility;
    if (visibilitySaveRef.current) {
      setSaveState("saving");
      return;
    }

    let fallbackVisibility = draft.visibility ?? "private";
    visibilitySaveRef.current = true;
    beginSave();
    try {
      let lastSaved: Recipe | undefined;
      while (pendingVisibilityRef.current) {
        const nextVisibility = pendingVisibilityRef.current;
        pendingVisibilityRef.current = null;
        const saved = await api.updateRecipe(recipeId, { visibility: nextVisibility });
        if (!mountedRef.current) {
          return;
        }

        const persistedVisibility = saved.visibility ?? "private";
        fallbackVisibility = persistedVisibility;
        lastSaved = saved;
        applySavedRecipe(saved);
        setDraft((current) =>
          current.id === saved.id
            ? {
                ...current,
                visibility: pendingVisibilityRef.current ?? persistedVisibility,
                updatedAt: saved.updatedAt,
              }
            : current,
        );
      }

      finishSave("saved");
      if (lastSaved) {
        setMessage(`Recipe is now ${lastSaved.visibility ?? "private"}.`);
      }
    } catch (error) {
      pendingVisibilityRef.current = null;
      if (mountedRef.current) {
        setDraft((current) =>
          current.id === recipeId
            ? { ...current, visibility: fallbackVisibility }
            : current,
        );
        finishSave("error");
        setMessage(`Visibility update failed: ${errorMessage(error)}`);
      }
    } finally {
      visibilitySaveRef.current = false;
    }
  }

  async function deleteSelectedRecipe() {
    if (!ensureSignedIn("delete recipes")) {
      return;
    }

    if (!draft.id) {
      return;
    }
    try {
      await api.deleteRecipe(draft.id);
      setMessage(`Deleted ${draft.title}`);
      setSelectedId(undefined);
      await loadRecipes(query);
    } catch (error) {
      setMessage(`Delete failed: ${errorMessage(error)}`);
    }
  }

  async function importWebsite() {
    if (!ensureSignedIn("import recipes")) {
      return;
    }

    try {
      const recipe = await api.importWebsite(websiteUrl);
      setMessage(`Imported ${recipe.title}`);
      setWebsiteUrl("");
      await loadRecipes(query);
      setSelectedId(recipe.id);
      setMode("view");
      goToRecipeLibrary();
    } catch (error) {
      setMessage(`Website import failed: ${errorMessage(error)}`);
    }
  }

  async function importMarkdown(markdownText = markdown) {
    if (!ensureSignedIn("import recipes")) {
      return;
    }

    try {
      const recipe = await api.importMarkdown(markdownText);
      setMessage(`Imported ${recipe.title}`);
      setMarkdown("");
      await loadRecipes(query);
      setSelectedId(recipe.id);
      setMode("view");
      goToRecipeLibrary();
    } catch (error) {
      setMessage(`Markdown import failed: ${errorMessage(error)}`);
    }
  }

  async function importStashCook() {
    if (!ensureSignedIn("import recipes")) {
      return;
    }

    try {
      const result = await api.importStashCook({
        baseUrl: stashCookBaseUrl || undefined,
        bearerToken: stashCookToken || undefined,
        cookie: stashCookCookie || undefined,
        includeDeleted: stashCookIncludeDeleted || undefined,
        take: optionalNumber(stashCookTake),
      });
      setMessage(
        `StashCook import complete: ${result.created} created, ${result.updated} updated`,
      );
      setStashCookToken("");
      setStashCookCookie("");
      await loadRecipes(query);
      setSelectedId(result.recipes[0]?.id);
      setMode("view");
      goToRecipeLibrary();
    } catch (error) {
      setMessage(`StashCook import failed: ${errorMessage(error)}`);
    }
  }

  async function importStashCookExport(file?: File | null) {
    if (!ensureSignedIn("import recipes")) {
      return;
    }

    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const exportedRecipes = recipesFromStashCookExport(parsed);
      const result = await api.importStashCookExport({ recipes: exportedRecipes });
      setMessage(
        `StashCook export imported: ${result.created} created, ${result.updated} updated`,
      );
      setStashCookExportFileName(file.name);
      await loadRecipes(query);
      setSelectedId(result.recipes[0]?.id);
      setMode("view");
      goToRecipeLibrary();
    } catch (error) {
      setMessage(`StashCook export import failed: ${errorMessage(error)}`);
    }
  }

  async function mirrorImages() {
    if (!ensureSignedIn("mirror recipe images")) {
      return;
    }

    try {
      const result = await api.mirrorRecipeImages();
      setMessage(
        `Mirrored ${result.updated} images to public R2${
          result.failed ? `, ${result.failed} kept original URLs` : ""
        }`,
      );
      await loadRecipes(query);
    } catch (error) {
      setMessage(`Image mirror failed: ${errorMessage(error)}`);
    }
  }

  async function structureCurrentRecipe() {
    const localIngredients = structureIngredients(draft.ingredients);
    const localRecipe = {
      ...draft,
      ingredients: localIngredients,
      steps: structureSteps(draft.steps, localIngredients),
    };

    if (!draft.id) {
      setDraft(localRecipe);
      setMessage("Structured draft locally; save it before cloud review.");
      return;
    }

    if (!ensureSignedIn("structure recipes")) {
      return;
    }

    try {
      const result = await api.structureRecipe(localRecipe);
      setDraft(result.recipe);
      setMessage(
        `Structured ${result.summary.ingredients} ingredients and ${result.summary.steps} steps${
          result.summary.warnings.length
            ? `, ${result.summary.warnings.length} review flags`
            : ""
        }`,
      );
    } catch (error) {
      setDraft(localRecipe);
      setMessage(
        `Cloud structure failed; local parser applied: ${errorMessage(error)}`,
      );
    }
  }

  async function refreshRecipeLibrary() {
    if (!ensureSignedIn("refresh recipes")) {
      return;
    }

    try {
      await loadRecipes(query);
      setMessage("Recipes refreshed");
    } catch (error) {
      setMessage(`Refresh failed: ${errorMessage(error)}`);
    }
  }

  async function copyBrowseRecipe(recipe: SharedRecipe) {
    if (!ensureSignedIn("save recipes")) {
      return;
    }

    try {
      const copy = await api.copyRecipe(recipe.owner.id, recipe.id);
      const copiedKey = sharedRecipeKey(recipe);
      setSharedRecipes((current) =>
        current.map((item) =>
          sharedRecipeKey(item) === copiedKey
            ? {
                ...item,
                copiedRecipeId: copy.id,
                seenAt: item.seenAt ?? new Date().toISOString(),
              }
            : item,
        ),
      );
      setMessage(`Saved a copy of ${copy.title} to your recipes`);
      await loadRecipes(query);
      setSelectedId(copy.id);
      setMode("view");
      setSection("mine");
      setSharedSelectedKey(undefined);
    } catch (error) {
      setMessage(`Copy failed: ${errorMessage(error)}`);
    }
  }

  async function dismissSharedRecipe(recipe: SharedRecipe) {
    if (!ensureSignedIn("dismiss shared recipes")) {
      return;
    }

    try {
      await api.dismissSharedRecipe(recipe.owner.id, recipe.id);
      const dismissedKey = sharedRecipeKey(recipe);
      setSharedRecipes((current) =>
        current.filter((item) => sharedRecipeKey(item) !== dismissedKey),
      );
      setMessage(`Dismissed ${recipe.title}`);
    } catch (error) {
      setMessage(`Dismiss failed: ${errorMessage(error)}`);
    }
  }

  return (
    <main className="grid h-screen min-h-screen grid-cols-[minmax(380px,0.68fr)_minmax(580px,1.32fr)] grid-rows-[64px_minmax(0,1fr)] overflow-hidden bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.88),transparent_30rem),linear-gradient(135deg,#fbfaf6_0%,#f4f1e9_52%,#eef2ea_100%)] text-(--color-ink) max-[1180px]:grid-cols-[minmax(360px,0.78fr)_minmax(520px,1.22fr)] max-[980px]:h-auto max-[980px]:grid-cols-[minmax(0,1fr)] max-[980px]:grid-rows-[auto] max-[980px]:overflow-visible">
      <AppNav
        onAuthIntent={openAuth}
        onNavigateHome={() => navigate({ to: "/" })}
        onSignOut={signOut}
        page={addMode ? "recipes" : page}
        session={session}
        sessionLoading={sessionLoading}
        setPage={openAppPage}
      />
      {addMode ? (
        <AddRecipePage
          importMarkdown={importMarkdown}
          importStashCook={importStashCook}
          importStashCookExport={importStashCookExport}
          importWebsite={importWebsite}
          markdown={markdown}
          message={message}
          onCancel={goToRecipeLibrary}
          setMarkdown={setMarkdown}
          setStashCookBaseUrl={setStashCookBaseUrl}
          setStashCookCookie={setStashCookCookie}
          setStashCookIncludeDeleted={setStashCookIncludeDeleted}
          setStashCookTake={setStashCookTake}
          setStashCookToken={setStashCookToken}
          setWebsiteUrl={setWebsiteUrl}
          stashCookBaseUrl={stashCookBaseUrl}
          stashCookCookie={stashCookCookie}
          stashCookExportFileName={stashCookExportFileName}
          stashCookIncludeDeleted={stashCookIncludeDeleted}
          stashCookTake={stashCookTake}
          stashCookToken={stashCookToken}
          websiteUrl={websiteUrl}
        />
      ) : page === "recipes" ? (
        selectedRecipeMissing ? (
          <RecipeNotFound onBack={closeRecipe} />
        ) : section === "mine" && selectedId ? (
          <RecipePage
            draft={draft}
            mode={mode}
            onBack={closeRecipe}
            onChange={setDraft}
            onDelete={deleteSelectedRecipe}
            onMirrorImages={mirrorImages}
            onSetMode={setMode}
            onStructure={structureCurrentRecipe}
            onVisibilityChange={updateRecipeVisibility}
            ownerUserId={sessionUserId}
            persistedVisibility={
              draft.id
                ? (persistedVisibilityById[draft.id] ??
                  (selectedRecipe?.id === draft.id
                    ? selectedRecipe.visibility
                    : undefined))
                : undefined
            }
            recipes={recipes}
            saveState={saveState}
          />
        ) : section !== "mine" && openBrowse ? (
          <BrowseRecipePage
            message={message}
            onBack={closeBrowseRecipe}
            onCopy={copyBrowseRecipe}
            onDismiss={dismissSharedRecipe}
            recipe={openBrowse}
            section={section}
          />
        ) : (
          <RecipeLibrary
            browseRecipes={browseRecipes}
            loading={recipesPageLoading}
            onCreateBlank={createBlankRecipe}
            onImport={openRecipeImportPage}
            onOpenBrowse={openBrowseRecipe}
            onOpenOwned={openOwnedRecipe}
            onQuery={setQuery}
            onSection={setSection}
            ownedRecipes={visibleRecipes}
            query={query}
            section={section}
            sessionUserId={sessionUserId}
            sharedCount={sharedUnreadCount}
          />
        )
      ) : page === "api" ? (
        <ApiPage recipes={visibleRecipes} status={status} />
      ) : page === "export" ? (
        <ExportPage
          message={message}
          onMirrorImages={mirrorImages}
          recipes={visibleRecipes}
          selectedRecipe={selectedRecipe}
        />
      ) : page === "settings" ? (
        <SettingsPage
          message={message}
          onCreateAccount={() => openAuth("signup")}
          onGoToPage={openAppPage}
          onLogIn={() => openAuth("login")}
          onMirrorImages={mirrorImages}
          onRefreshRecipes={refreshRecipeLibrary}
          onRefreshSession={refreshSession}
          onSignOut={signOut}
          session={session}
          sessionLoading={sessionLoading}
          status={status}
        />
      ) : (
        <BuildPage />
      )}
    </main>
  );
}
