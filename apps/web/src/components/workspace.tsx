import {
  type Gathering,
  type Recipe,
  type RecipeVisibility,
  recipeSearchText,
  type SharedRecipe,
  structureIngredients,
  structureSteps,
} from "@open-cook/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  BookOpen,
  Braces,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Compass,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  KeyRound,
  Link2,
  LibraryBig,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Salad,
  Save,
  Settings,
  Send,
  Share2,
  Sparkles,
  UploadCloud,
  UserPlus,
  UserRound,
  Users,
  Utensils,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, type PublishGatheringResult, type SaveGatheringPayload } from "../api";
import type { CurrentAuthSession } from "../authApi";
import { useSession } from "../context/SessionProvider";
import { displayImageUrl } from "../imageDisplayUrl";
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
  recipeImagesOf,
  recipeSearchDebounceMs,
  shortDate,
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
import { DictationControl } from "./DictationControl";
import { FoodPreferencesPage } from "./onboarding";
import {
  defaultGatheringBuildRequest,
  gatheringRecipeAutoPickCount,
  gatheringRecipePickerAutoPickIds,
  gatheringRecipePickerMatches,
  gatheringRecipePickerPageSize,
  nextGatheringRecipePickerCount,
} from "./recipeGenerator";
import {
  ApiPage,
  BillingPage,
  BuildPage,
  ExportPage,
  SettingsPage,
  WorkspaceHeader,
} from "./tools";

type WorkspaceSearchState = {
  add?: boolean;
  browse?: string;
  gathering?: string;
  page?: Page;
  recipe?: string;
  section?: RecipeSection;
};

const workspaceSearchKeys: Array<keyof WorkspaceSearchState> = [
  "add",
  "browse",
  "gathering",
  "page",
  "recipe",
  "section",
];

const gatheringEditorPickerScrollThresholdPx = 80;
const gatheringPageClassName =
  `${workspacePageBaseClassName} relative grid content-start gap-5 overflow-auto ` +
  "bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-bg)_88%,white),color-mix(in_oklch,var(--color-pop-accent)_12%,white)_58%,color-mix(in_oklch,var(--color-pop-secondary)_14%,white))] [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[1060px]";

const gatheringPanelClassName =
  "relative grid overflow-hidden rounded-2xl border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) shadow-pop-sm " +
  "before:absolute before:inset-x-0 before:top-0 before:h-2 before:content-[''] before:bg-[repeating-linear-gradient(90deg,var(--color-pop-accent)_0_18px,var(--color-pop-secondary)_18px_36px,var(--color-pop-pink)_36px_54px)]";

const gatheringPanelHeaderClassName =
  "relative z-10 flex flex-wrap items-center justify-between gap-2";

const gatheringPanelTitleClassName =
  "inline-flex items-center gap-2 text-xs font-black uppercase tracking-normal text-(--color-pop-primary)";

const gatheringPanelIconClassName =
  "grid size-8 place-items-center rounded-lg border-2 border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-accent)_36%,white)] text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-pop-ink)]";

const gatheringFieldClassName =
  "group grid content-start gap-1.5 rounded-xl border-2 border-solid border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-[linear-gradient(180deg,var(--color-panel),#fff8ec)] px-3 py-2.5 text-[11px] font-black uppercase leading-none text-(--color-pop-muted-ink) transition " +
  "focus-within:border-(--color-pop-primary) focus-within:bg-(--color-pop-card) focus-within:shadow-[3px_3px_0_0_var(--color-pop-accent)] " +
  "[&_input]:min-h-7 [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-[15px] [&_input]:font-[760] [&_input]:normal-case [&_input]:leading-snug [&_input]:text-(--color-ink) [&_input]:outline-0 [&_input::placeholder]:font-[680] [&_input::placeholder]:text-[#9a8f80] " +
  "[&_textarea]:min-h-[86px] [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:resize-y [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-0 [&_textarea]:text-[15px] [&_textarea]:font-[720] [&_textarea]:normal-case [&_textarea]:leading-[1.38] [&_textarea]:text-(--color-ink) [&_textarea]:outline-0 [&_textarea::placeholder]:font-[680] [&_textarea::placeholder]:text-[#9a8f80]";

function GatheringField({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: ReactNode;
}) {
  return (
    <label className={`${gatheringFieldClassName} ${className}`}>
      <span className="inline-flex items-center gap-1.5">{label}</span>
      {children}
    </label>
  );
}

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

const accountMenuItemClassName =
  "flex w-full cursor-pointer items-center justify-start gap-2 rounded-md border border-solid border-transparent bg-transparent px-2.5 py-2 text-left text-[13px] font-extrabold leading-none text-(--color-fog) outline-none transition hover:border-(--color-line) hover:bg-(--color-panel) hover:text-(--color-ink) focus:border-(--color-line) focus:bg-(--color-panel) focus:text-(--color-ink) data-[highlighted]:border-(--color-line) data-[highlighted]:bg-(--color-panel) data-[highlighted]:text-(--color-ink)";

const accountMenuActiveItemClassName =
  "border-(--color-line) bg-(--color-panel) text-(--color-ink)";

const accountAvatarButtonClassName =
  "cursor-pointer rounded-xl! border-2! border-(--color-pop-ink)! bg-[linear-gradient(135deg,var(--color-pop-accent),var(--color-pop-pink)_62%,var(--color-pop-secondary))]! text-(--color-pop-ink)! shadow-[2px_2px_0_0_var(--color-pop-ink)]! data-[state=open]:border-(--color-pop-ink)! data-[state=open]:bg-[linear-gradient(135deg,var(--color-pop-secondary),var(--color-pop-accent))]! data-[state=open]:text-(--color-pop-ink)! enabled:hover:shadow-[3px_3px_0_0_var(--color-pop-ink)]!";

function accountInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstPart = parts[0];
  if (!firstPart) {
    return "";
  }

  if (parts.length === 1) {
    return Array.from(firstPart).slice(0, 2).join("").toUpperCase();
  }

  const lastPart = parts[parts.length - 1] ?? firstPart;
  const firstInitial = Array.from(firstPart)[0] ?? "";
  const lastInitial = Array.from(lastPart)[0] ?? "";

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

function FoodPreferencesPrompt({ onOpenOnboarding }: { onOpenOnboarding: () => void }) {
  return (
    <section className="col-[1/-1] grid gap-3 rounded-lg border-2 border-(--color-ink) bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-sage-soft)_72%,white),var(--color-panel))] p-4 shadow-[4px_4px_0_0_var(--color-ink)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-(--color-ink) bg-(--color-panel) text-(--color-tomato) shadow-[2px_2px_0_0_var(--color-ink)]">
          <Sparkles size={20} />
        </span>
        <span>
          <h2 className="m-0 text-lg font-black leading-tight text-(--color-ink)">
            Add your food preferences
          </h2>
          <p className="m-0 mt-1 max-w-[58ch] text-sm font-semibold leading-5 text-(--color-fog)">
            Tell OpenCook what diets, allergies, cuisines, foods, and kitchen
            constraints recipes should respect.
          </p>
        </span>
      </div>
      <Button className="w-full sm:w-auto" onClick={onOpenOnboarding} variant="primary">
        <Sparkles size={15} />
        Set preferences
      </Button>
    </section>
  );
}

export function AppNav({
  onAuthIntent,
  onNavigateHome,
  onOpenOnboarding,
  onSignOut,
  page,
  session,
  sessionLoading,
  showPreferencesPrompt,
  setPage,
}: {
  onAuthIntent: (intent: Exclude<AuthIntent, null>) => void;
  onNavigateHome: () => void;
  onOpenOnboarding: () => void;
  onSignOut: () => Promise<void>;
  page: Page;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
  showPreferencesPrompt: boolean;
  setPage: (page: Page) => void;
}) {
  function openMenuPage(nextPage: Page) {
    setPage(nextPage);
  }

  const initials = session ? accountInitials(session.user.name) : "";

  return (
    <header className="relative z-50 col-[1/-1] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_78%,transparent)] px-6 py-3 backdrop-blur-[16px] backdrop-saturate-[1.3] max-[980px]:col-[1] max-[980px]:row-auto max-[980px]:grid-cols-1 max-[720px]:px-4">
      <button
        className="inline-flex min-h-[38px] items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold tracking-normal text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66] max-[860px]:flex-initial"
        onClick={onNavigateHome}
        type="button"
      >
        <img alt="" className="size-7" src="/logo.png" />
        <span>OpenCook</span>
      </button>
      <nav
        className="flex min-w-0 items-center justify-center gap-1.5 max-[980px]:justify-start"
        aria-label="Primary"
      >
        <button
          aria-current={page === "recipes" ? "page" : undefined}
          className={buttonClassName({
            active: page === "recipes",
            className: "shrink-0",
            size: "sm",
            variant: "tab",
          })}
          onClick={() => openMenuPage("recipes")}
          type="button"
        >
          <LibraryBig size={15} />
          Recipes
        </button>
        <button
          aria-current={
            page === "gatherings" ||
            page === "gathering" ||
            page === "gathering-generating"
              ? "page"
              : undefined
          }
          className={buttonClassName({
            active:
              page === "gatherings" ||
              page === "gathering" ||
              page === "gathering-generating",
            className: "shrink-0",
            size: "sm",
            variant: "tab",
          })}
          onClick={() => openMenuPage("gatherings")}
          type="button"
        >
          <Users size={15} />
          Gatherings
        </button>
      </nav>
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
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label={
                  session.user.name
                    ? `Account menu for ${session.user.name}`
                    : "Account menu"
                }
                className={buttonClassName({
                  active:
                    page === "api" ||
                    page === "billing" ||
                    page === "export" ||
                    page === "preferences" ||
                    page === "settings",
                  className: accountAvatarButtonClassName,
                  size: "icon",
                })}
                type="button"
              >
                {initials ? (
                  <span className="text-[12px] font-black leading-none">
                    {initials}
                  </span>
                ) : (
                  <UserRound size={16} />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-[100] grid min-w-[184px] gap-[3px] rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-1.5 shadow-workspace"
                sideOffset={8}
              >
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
                <DropdownMenu.Item
                  className={`${accountMenuItemClassName} ${
                    page === "settings" ? accountMenuActiveItemClassName : ""
                  }`}
                  onSelect={() => openMenuPage("settings")}
                >
                  <Settings size={15} />
                  Settings
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`${accountMenuItemClassName} ${
                    page === "preferences" ? accountMenuActiveItemClassName : ""
                  }`}
                  onSelect={() => openMenuPage("preferences")}
                >
                  <Salad size={15} />
                  Food preferences
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`${accountMenuItemClassName} ${
                    page === "billing" ? accountMenuActiveItemClassName : ""
                  }`}
                  onSelect={() => openMenuPage("billing")}
                >
                  <CreditCard size={15} />
                  Billing
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`${accountMenuItemClassName} ${
                    page === "api" ? accountMenuActiveItemClassName : ""
                  }`}
                  onSelect={() => openMenuPage("api")}
                >
                  <Braces size={15} />
                  API
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={`${accountMenuItemClassName} ${
                    page === "export" ? accountMenuActiveItemClassName : ""
                  }`}
                  onSelect={() => openMenuPage("export")}
                >
                  <Download size={15} />
                  Export
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={accountMenuItemClassName}
                  onSelect={() => {
                    void onSignOut();
                  }}
                >
                  <LogOut size={15} />
                  Log out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
      {showPreferencesPrompt ? (
        <FoodPreferencesPrompt onOpenOnboarding={onOpenOnboarding} />
      ) : null}
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
      className="flex w-fit max-w-full flex-wrap gap-1.5 rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fff6c9,#fffdf8_62%,#e5efdf)] p-1 shadow-[3px_3px_0_0_var(--color-ink)]"
    >
      {tabs.map((tab) => {
        const isActive = section === tab.key;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-9 items-center gap-2 rounded-xl border-2 px-3 py-2 text-[13px] font-extrabold leading-none transition hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_var(--color-ink)] ${
              isActive
                ? "border-(--color-ink) bg-(--color-tomato) text-white shadow-[2px_2px_0_0_var(--color-ink)]"
                : "border-transparent bg-transparent text-(--color-fog) hover:border-(--color-line) hover:bg-(--color-panel) hover:text-(--color-ink)"
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
        <h1 className="m-0 font-display text-[clamp(34px,3vw,48px)] font-bold leading-[0.94] tracking-normal text-(--color-ink) [text-shadow:2px_2px_0_#fff7d8]">
          {loggedIn ? "Your recipes" : "Recipes for everyone"}
        </h1>
        <p className="mx-0 mt-[9px] mb-0 max-w-[590px] text-[15px] font-semibold leading-[1.45] text-(--color-fog)">
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

function gatheringPublicPath(gathering: Gathering) {
  return `/g/${encodeURIComponent(gathering.slug)}`;
}

function gatheringPublicUrl(gathering: Gathering) {
  const path = gatheringPublicPath(gathering);
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function gatheringStatusClassName(status: Gathering["status"]) {
  return status === "published"
    ? "border-(--color-sage-line) bg-(--color-sage-soft) text-(--color-sage)"
    : "border-[#d9c7a1] bg-[#fff4d7] text-[#7b5b16]";
}

function GatheringShareMenu({
  disabled,
  emailFieldId,
  inviteeCount,
  onCopyLink,
  onSendInvites,
  publicLink,
  publicPath,
  sending,
}: {
  disabled?: boolean;
  emailFieldId: string;
  inviteeCount: number;
  onCopyLink: () => Promise<void>;
  onSendInvites: (emails: string) => Promise<boolean>;
  publicLink: string;
  publicPath: string;
  sending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [emailText, setEmailText] = useState("");

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = await onSendInvites(emailText);
    if (sent) {
      setEmailText("");
      setOpen(false);
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button disabled={disabled} size="sm" variant="secondary">
          <Share2 size={16} />
          Share
          <ChevronDown size={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[120] grid w-[min(360px,calc(100vw-32px))] gap-3 rounded-xl border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-3 shadow-pop-sm"
          sideOffset={8}
        >
          <div className="grid gap-2 border-b border-solid border-(--color-line) pb-3">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase text-(--color-pop-muted-ink)">
              <Link2 size={14} />
              Guest page link
            </span>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-1.5">
              <input
                aria-label="Guest page link"
                className="min-h-8 min-w-0 flex-1 border-0 bg-transparent px-2 text-[12px] font-semibold text-(--color-pop-muted-ink) outline-none"
                onKeyDown={(event) => event.stopPropagation()}
                readOnly
                value={publicLink}
              />
              <Button
                className="shrink-0"
                onClick={() => void onCopyLink()}
                size="sm"
              >
                <Copy size={14} />
                Copy
              </Button>
            </div>
            <a
              className={buttonClassName({
                fullWidth: true,
                size: "sm",
                variant: "secondary",
              })}
              href={publicPath}
              rel="noopener"
              target="_blank"
            >
              <ExternalLink size={14} />
              Open guest page
            </a>
          </div>

          <form className="grid gap-2" onSubmit={(event) => void submitInvite(event)}>
            <label
              className="grid gap-1.5 text-xs font-black uppercase text-(--color-pop-muted-ink)"
              htmlFor={emailFieldId}
            >
              <span className="inline-flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Mail size={14} />
                  Email guests
                </span>
                <span className="text-[11px] normal-case text-(--color-fog)">
                  {countLabel(inviteeCount, "invitee")}
                </span>
              </span>
              <textarea
                className="min-h-[76px] resize-y rounded-lg border border-solid border-(--color-line) bg-(--color-panel) px-2.5 py-2 text-sm font-semibold normal-case leading-5 text-(--color-ink) outline-none transition placeholder:text-[#9a8f80] focus:border-(--color-pop-primary)"
                id={emailFieldId}
                onChange={(event) => setEmailText(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="friend@example.com, family@example.com"
                value={emailText}
              />
            </label>
            <div className="flex justify-end">
              <Button
                disabled={!emailText.trim() || sending}
                size="sm"
                type="submit"
                variant="primary"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
                Send invite
              </Button>
            </div>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function GatheringsPage({
  gatherings,
  loading,
  message,
  onCreate,
  onLogIn,
  onOpen,
  onRefresh,
  onSendInvites,
  onStatus,
  sessionUserId,
}: {
  gatherings: Gathering[];
  loading: boolean;
  message: string;
  onCreate: () => void;
  onLogIn: () => void;
  onOpen: (id: string) => void;
  onRefresh: () => void | Promise<void>;
  onSendInvites: (gathering: Gathering, emails: string) => Promise<boolean>;
  onStatus: (message: string) => void;
  sessionUserId: string | null;
}) {
  const [sharingGatheringId, setSharingGatheringId] = useState<string>();

  async function copyGatheringLink(gathering: Gathering) {
    try {
      await navigator.clipboard.writeText(gatheringPublicUrl(gathering));
      onStatus(`Copied link for ${gathering.title}`);
    } catch (error) {
      onStatus(`Copy failed: ${errorMessage(error)}`);
    }
  }

  async function sendGatheringInvites(gathering: Gathering, emailText: string) {
    setSharingGatheringId(gathering.id);
    try {
      return await onSendInvites(gathering, emailText);
    } finally {
      setSharingGatheringId((current) =>
        current === gathering.id ? undefined : current,
      );
    }
  }

  return (
    <section
      className={`${workspacePageBaseClassName} grid content-start gap-5 bg-[color-mix(in_oklch,var(--color-pop-bg)_82%,white)] [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[940px]`}
    >
      <WorkspaceHeader
        description="Published menus, invite links, and drafts created from your recipes."
        icon={<Users size={25} />}
        title="Gatherings"
      >
        <Button
          disabled={!sessionUserId || loading}
          onClick={() => void onRefresh()}
          size="sm"
        >
          <RefreshCcw
            className={loading ? "animate-[spin_900ms_linear_infinite]" : undefined}
            size={16}
          />
          Refresh
        </Button>
        <Button onClick={onCreate} size="sm" variant="primary">
          <Plus size={16} />
          New gathering
        </Button>
      </WorkspaceHeader>

      {message !== "Ready" ? (
        <p className={inlineStatusClassName}>
          <CheckCircle2 size={16} />
          {message}
        </p>
      ) : null}

      {!sessionUserId ? (
        <section className="grid gap-3 rounded-lg border border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-5 shadow-pop-sm">
          <h2 className="m-0 text-xl font-black text-(--color-pop-ink)">
            Log in to see your gatherings
          </h2>
          <p className="m-0 max-w-[58ch] text-sm font-semibold leading-6 text-(--color-pop-muted-ink)">
            Gatherings are private to the account that created them until you publish an
            invite link.
          </p>
          <div className={buttonRowClassName}>
            <Button onClick={onLogIn} variant="primary">
              <LogIn size={16} />
              Log in
            </Button>
          </div>
        </section>
      ) : loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <div
              className="grid gap-3 rounded-lg border border-solid border-(--color-line) bg-(--color-pop-card) p-5 shadow-pop-sm"
              key={item}
            >
              <span className="h-5 w-2/5 animate-pulse rounded bg-(--color-line)" />
              <span className="h-4 w-4/5 animate-pulse rounded bg-(--color-line)" />
              <span className="h-10 w-full animate-pulse rounded bg-(--color-line)" />
            </div>
          ))}
        </div>
      ) : gatherings.length ? (
        <div className="grid gap-3">
          {gatherings.map((gathering) => (
            <article
              className="grid gap-4 rounded-lg border border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-5 shadow-pop-sm"
              key={gathering.id}
            >
              <div className="flex min-w-0 items-start justify-between gap-3 max-[720px]:grid">
                <div className="min-w-0">
                  <h2 className="m-0 text-2xl font-black leading-tight text-(--color-pop-ink)">
                    {gathering.title}
                  </h2>
                  <p className="m-0 mt-2 line-clamp-2 max-w-[66ch] text-sm font-semibold leading-6 text-(--color-pop-muted-ink)">
                    {gathering.welcome}
                  </p>
                </div>
                <span
                  className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border px-3 py-1 text-xs font-extrabold capitalize ${gatheringStatusClassName(
                    gathering.status,
                  )}`}
                >
                  {gathering.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 max-[760px]:grid-cols-1">
                <span className="grid min-h-[58px] gap-1 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-3 text-sm font-extrabold text-(--color-pop-ink)">
                  <span className="inline-flex items-center gap-2 text-xs text-(--color-pop-muted-ink)">
                    <BookOpen size={14} />
                    Menu
                  </span>
                  {countLabel(gathering.recipeIds.length, "recipe")}
                </span>
                <span className="grid min-h-[58px] gap-1 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-3 text-sm font-extrabold text-(--color-pop-ink)">
                  <span className="inline-flex items-center gap-2 text-xs text-(--color-pop-muted-ink)">
                    <Users size={14} />
                    Invitees
                  </span>
                  {countLabel(gathering.invitees.length, "person", "people")}
                </span>
                <span className="grid min-h-[58px] gap-1 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-3 text-sm font-extrabold text-(--color-pop-ink)">
                  <span className="inline-flex items-center gap-2 text-xs text-(--color-pop-muted-ink)">
                    <CalendarDays size={14} />
                    {gathering.publishedAt ? "Published" : "Updated"}
                  </span>
                  {shortDate(gathering.publishedAt ?? gathering.updatedAt)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-solid border-(--color-line) pt-3">
                <span className="min-w-0 truncate text-xs font-bold text-(--color-pop-muted-ink)">
                  {gathering.status === "published"
                    ? gatheringPublicPath(gathering)
                    : "Draft gathering"}
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button onClick={() => onOpen(gathering.id)} size="sm">
                    <Pencil size={15} />
                    Edit
                  </Button>
                  {gathering.status === "published" ? (
                    <>
                      <a
                        className={buttonClassName({
                          size: "sm",
                          variant: "secondary",
                        })}
                        href={gatheringPublicPath(gathering)}
                        target="_blank"
                        rel="noopener"
                      >
                        <ExternalLink size={15} />
                        Open
                      </a>
                      <GatheringShareMenu
                        disabled={sharingGatheringId === gathering.id}
                        emailFieldId={`gathering-list-share-emails-${gathering.id}`}
                        inviteeCount={gathering.invitees.length}
                        onCopyLink={() => copyGatheringLink(gathering)}
                        onSendInvites={(emailText) =>
                          sendGatheringInvites(gathering, emailText)
                        }
                        publicLink={gatheringPublicUrl(gathering)}
                        publicPath={gatheringPublicPath(gathering)}
                        sending={sharingGatheringId === gathering.id}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="grid gap-3 rounded-lg border border-dashed border-(--color-pop-ink) bg-(--color-pop-card) p-6 text-center shadow-pop-sm">
          <h2 className="m-0 text-xl font-black text-(--color-pop-ink)">
            No gatherings yet
          </h2>
          <p className="m-0 text-sm font-semibold leading-6 text-(--color-pop-muted-ink)">
            Create one from your saved recipes and it will appear here.
          </p>
          <div className="flex justify-center">
            <Button onClick={onCreate} variant="primary">
              <Plus size={16} />
              New gathering
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}

function parseInviteeEmails(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function inviteeEmailsText(gathering: Gathering) {
  return gathering.invitees.map((invitee) => invitee.email).join("\n");
}

function gatheringEditorPayload(input: {
  dietary: string;
  guestQuestion: string;
  inviteeEmails: string;
  prompt: string;
  recipeIds: string[];
  title: string;
  welcome: string;
}): SaveGatheringPayload {
  return {
    dietary: input.dietary.trim() || undefined,
    guestQuestion:
      input.guestQuestion.trim() || defaultGatheringBuildRequest.guestQuestion,
    inviteeEmails: parseInviteeEmails(input.inviteeEmails),
    prompt: input.prompt.trim() || undefined,
    recipeIds: input.recipeIds,
    title: input.title.trim() || defaultGatheringBuildRequest.title || undefined,
    welcome: input.welcome.trim() || undefined,
  };
}

function gatheringPayloadKey(payload: SaveGatheringPayload) {
  return JSON.stringify(payload);
}

function gatheringPersistedPayload(gathering: Gathering): SaveGatheringPayload {
  return gatheringEditorPayload({
    dietary: gathering.dietary ?? "",
    guestQuestion: gathering.guestQuestion,
    inviteeEmails: inviteeEmailsText(gathering),
    prompt: gathering.prompt ?? "",
    recipeIds: gathering.recipeIds,
    title: gathering.title,
    welcome: gathering.welcome,
  });
}

export function GatheringEditorPage({
  gathering,
  loading,
  message,
  onBackToGatherings,
  onPublish,
  onSave,
  onStatus,
  recipes,
}: {
  gathering?: Gathering;
  loading: boolean;
  message: string;
  onBackToGatherings: () => void;
  onPublish: (
    id: string,
    payload: SaveGatheringPayload,
  ) => Promise<PublishGatheringResult>;
  onSave: (id: string, payload: SaveGatheringPayload) => Promise<Gathering>;
  onStatus: (message: string) => void;
  recipes: Recipe[];
}) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState(defaultGatheringBuildRequest.prompt);
  const [welcome, setWelcome] = useState("");
  const [dietary, setDietary] = useState("");
  const [guestQuestion, setGuestQuestion] = useState(
    defaultGatheringBuildRequest.guestQuestion,
  );
  const [inviteeEmails, setInviteeEmails] = useState("");
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(
    gatheringRecipePickerPageSize,
  );
  const [hydratedGatheringId, setHydratedGatheringId] = useState<string | undefined>();
  const [draftSaveState, setDraftSaveState] = useState<SaveState>("idle");
  const [autoSaveRetryToken, setAutoSaveRetryToken] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [pickingRecipes, setPickingRecipes] = useState(false);
  const saveInFlightRef = useRef(false);
  const editorMountedRef = useRef(true);
  const latestGatheringIdRef = useRef<string | undefined>(gathering?.id);
  const latestDraftPayloadRef = useRef<SaveGatheringPayload>({});

  const saving = draftSaveState === "saving";

  useEffect(() => {
    setVisibleRecipeCount(gatheringRecipePickerPageSize);
  }, [query, recipes]);

  useEffect(() => {
    if (!gathering) {
      setHydratedGatheringId(undefined);
      return;
    }
    setTitle(gathering.title);
    setPrompt(gathering.prompt ?? defaultGatheringBuildRequest.prompt);
    setWelcome(gathering.welcome);
    setDietary(gathering.dietary ?? "");
    setGuestQuestion(gathering.guestQuestion);
    setInviteeEmails(inviteeEmailsText(gathering));
    setRecipeIds(gathering.recipeIds);
    setQuery("");
    setDraftSaveState("idle");
    setHydratedGatheringId(gathering.id);
  }, [gathering?.id]);

  const recipesById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const selectedRecipes = useMemo(
    () =>
      recipeIds
        .map((id) => recipesById.get(id))
        .filter((recipe): recipe is Recipe => Boolean(recipe)),
    [recipeIds, recipesById],
  );
  const matchingRecipes = useMemo(
    () => gatheringRecipePickerMatches(recipes, query),
    [query, recipes],
  );
  const autoPickRecipeIds = useMemo(
    () => gatheringRecipePickerAutoPickIds(matchingRecipes),
    [matchingRecipes],
  );
  const visibleMatchingRecipes = useMemo(
    () => matchingRecipes.slice(0, visibleRecipeCount),
    [matchingRecipes, visibleRecipeCount],
  );
  const hasMoreMatchingRecipes = visibleMatchingRecipes.length < matchingRecipes.length;
  const hasAutoPickRecipes = matchingRecipes.length > 0;
  const inviteeEmailList = useMemo(
    () => parseInviteeEmails(inviteeEmails),
    [inviteeEmails],
  );
  const invalidEmails = useMemo(
    () => inviteeEmailList.filter((email) => !looksLikeEmail(email)),
    [inviteeEmailList],
  );
  const draftPayload = useMemo(
    () =>
      gatheringEditorPayload({
        dietary,
        guestQuestion,
        inviteeEmails,
        prompt,
        recipeIds,
        title,
        welcome,
      }),
    [dietary, guestQuestion, inviteeEmails, prompt, recipeIds, title, welcome],
  );
  const draftPayloadKey = useMemo(
    () => gatheringPayloadKey(draftPayload),
    [draftPayload],
  );
  const debouncedDraftPayloadKey = useDebouncedValue(
    draftPayloadKey,
    recipeAutoSaveDebounceMs,
  );
  const persistedPayloadKey = useMemo(
    () => (gathering ? gatheringPayloadKey(gatheringPersistedPayload(gathering)) : ""),
    [gathering],
  );
  const hasRecipe = recipeIds.length > 0;
  const canPublish =
    Boolean(gathering) &&
    hasRecipe &&
    Boolean(title.trim()) &&
    Boolean(welcome.trim()) &&
    Boolean(guestQuestion.trim()) &&
    invalidEmails.length === 0 &&
    !publishing &&
    !saving;
  const publicLink =
    gathering?.status === "published" ? gatheringPublicUrl(gathering) : "";
  const hasUnsavedGatheringChanges =
    Boolean(gathering) && draftPayloadKey !== persistedPayloadKey;
  const gatheringSaveStatus =
    draftSaveState === "error"
      ? "Could not save"
      : saving
        ? "Saving..."
        : hasUnsavedGatheringChanges
          ? "Unsaved changes"
          : "Saved";
  const shouldHideRoutineGatheringStatus =
    message === "Gathering changes saved" || message === "Gathering draft saved";

  useEffect(() => {
    latestDraftPayloadRef.current = draftPayload;
  }, [draftPayload]);

  useEffect(() => {
    latestGatheringIdRef.current = gathering?.id;
  }, [gathering?.id]);

  useEffect(() => {
    return () => {
      editorMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (draftSaveState !== "saved") {
      return;
    }
    const timeout = window.setTimeout(() => setDraftSaveState("idle"), 1400);
    return () => window.clearTimeout(timeout);
  }, [draftSaveState]);

  useEffect(() => {
    if (
      !gathering ||
      gathering.status !== "draft" ||
      hydratedGatheringId !== gathering.id ||
      publishing ||
      saveInFlightRef.current ||
      invalidEmails.length ||
      debouncedDraftPayloadKey !== draftPayloadKey ||
      draftPayloadKey === persistedPayloadKey
    ) {
      return;
    }

    let needsFollowUpSave = false;
    const gatheringId = gathering.id;
    const payload = draftPayload;

    saveInFlightRef.current = true;
    setDraftSaveState("saving");
    void onSave(gatheringId, payload)
      .then((saved) => {
        if (!editorMountedRef.current) {
          return;
        }
        const appliesToCurrentGathering = latestGatheringIdRef.current === saved.id;
        const savedPayloadKey = gatheringPayloadKey(gatheringPersistedPayload(saved));
        needsFollowUpSave =
          appliesToCurrentGathering &&
          gatheringPayloadKey(latestDraftPayloadRef.current) !== savedPayloadKey;
        if (appliesToCurrentGathering) {
          setDraftSaveState(needsFollowUpSave ? "saving" : "saved");
        }
      })
      .catch(() => {
        if (editorMountedRef.current) {
          setDraftSaveState("error");
        }
      })
      .finally(() => {
        saveInFlightRef.current = false;
        if (needsFollowUpSave && editorMountedRef.current) {
          setAutoSaveRetryToken((token) => token + 1);
        }
      });
  }, [
    autoSaveRetryToken,
    debouncedDraftPayloadKey,
    draftPayload,
    draftPayloadKey,
    gathering,
    hydratedGatheringId,
    invalidEmails.length,
    onSave,
    persistedPayloadKey,
    publishing,
  ]);

  function toggleRecipe(recipeId: string) {
    setRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    );
  }

  async function pickRecipesForMe() {
    if (!hasAutoPickRecipes) {
      onStatus(query.trim() ? "No recipes match that search." : "Add recipes first.");
      return;
    }

    setPickingRecipes(true);
    try {
      const result = await api.recommendGatheringRecipes({
        candidateRecipeIds: matchingRecipes.map((recipe) => recipe.id),
        count: gatheringRecipeAutoPickCount,
        dietary: dietary.trim() || undefined,
        guestQuestion: guestQuestion.trim() || undefined,
        prompt: prompt.trim() || undefined,
        query: query.trim() || undefined,
        title: title.trim() || undefined,
      });
      if (!editorMountedRef.current) {
        return;
      }
      if (result.recipeIds.length === 0) {
        onStatus(
          result.rejectedCount
            ? "No recipes fit your saved preferences."
            : "No recipes match that search.",
        );
        return;
      }

      setRecipeIds(result.recipeIds);
      onStatus(
        result.provider.provider === "workers-ai"
          ? `AI picked ${countLabel(result.recipeIds.length, "recipe")} for the menu`
          : `Picked ${countLabel(result.recipeIds.length, "recipe")} from your preferences`,
      );
    } catch (error) {
      if (editorMountedRef.current) {
        onStatus(`Recipe picking failed: ${errorMessage(error)}`);
      }
    } finally {
      if (editorMountedRef.current) {
        setPickingRecipes(false);
      }
    }
  }

  function showMoreRecipes() {
    setVisibleRecipeCount((current) =>
      nextGatheringRecipePickerCount(current, matchingRecipes.length),
    );
  }

  function handleRecipePickerScroll(event: UIEvent<HTMLDivElement>) {
    if (!hasMoreMatchingRecipes) {
      return;
    }

    const list = event.currentTarget;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (distanceFromBottom <= gatheringEditorPickerScrollThresholdPx) {
      showMoreRecipes();
    }
  }

  function currentPayload() {
    return draftPayload;
  }

  async function saveGathering() {
    if (!gathering || saveInFlightRef.current) {
      return;
    }
    let needsFollowUpSave = false;
    saveInFlightRef.current = true;
    setDraftSaveState("saving");
    try {
      const saved = await onSave(gathering.id, currentPayload());
      needsFollowUpSave =
        gathering.status === "draft" &&
        gatheringPayloadKey(latestDraftPayloadRef.current) !==
          gatheringPayloadKey(gatheringPersistedPayload(saved));
      setDraftSaveState(needsFollowUpSave ? "saving" : "saved");
    } catch {
      setDraftSaveState("error");
    } finally {
      saveInFlightRef.current = false;
      if (needsFollowUpSave && editorMountedRef.current) {
        setAutoSaveRetryToken((token) => token + 1);
      }
    }
  }

  async function publishGathering() {
    if (!gathering) {
      return;
    }
    if (!hasRecipe) {
      onStatus("Choose at least one recipe.");
      return;
    }
    if (invalidEmails.length) {
      onStatus(`Check ${invalidEmails[0]}.`);
      return;
    }

    setPublishing(true);
    try {
      await onPublish(gathering.id, currentPayload());
      onStatus(
        inviteeEmailList.length
          ? `Published and sent to ${countLabel(inviteeEmailList.length, "invitee")}`
          : "Gathering published",
      );
    } catch (error) {
      onStatus(`Publishing failed: ${errorMessage(error)}`);
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublicLink() {
    if (!publicLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(publicLink);
      onStatus("Gathering link copied");
    } catch (error) {
      onStatus(`Copy failed: ${errorMessage(error)}`);
    }
  }

  async function sendShareInvites(emailText: string) {
    if (!gathering) {
      return false;
    }
    if (!publicLink) {
      onStatus("Publish the gathering before sharing.");
      return false;
    }
    if (saving) {
      onStatus("Wait for saving to finish.");
      return false;
    }
    if (!hasRecipe) {
      onStatus("Choose at least one recipe.");
      return false;
    }
    if (invalidEmails.length) {
      onStatus(`Check ${invalidEmails[0]}.`);
      return false;
    }

    const shareInvitees = parseInviteeEmails(emailText);
    if (!shareInvitees.length) {
      onStatus("Add at least one email.");
      return false;
    }

    const invalidShareInvitees = shareInvitees.filter((email) => !looksLikeEmail(email));
    if (invalidShareInvitees.length) {
      onStatus(`Check ${invalidShareInvitees[0]}.`);
      return false;
    }

    const sentInvitees = new Set(
      gathering.invitees
        .filter((invitee) => Boolean(invitee.sentAt))
        .map((invitee) => invitee.email.toLowerCase()),
    );
    const nextInvitees = [...new Set([...inviteeEmailList, ...shareInvitees])];
    const emailsToSend = nextInvitees.filter((email) => !sentInvitees.has(email));
    if (!emailsToSend.length) {
      onStatus(`${countLabel(shareInvitees.length, "invitee")} already has the link`);
      return true;
    }

    const nextInviteeEmails = nextInvitees.join("\n");
    const nextPayload = gatheringEditorPayload({
      dietary,
      guestQuestion,
      inviteeEmails: nextInviteeEmails,
      prompt,
      recipeIds,
      title,
      welcome,
    });

    setPublishing(true);
    try {
      await onPublish(gathering.id, nextPayload);
      setInviteeEmails(nextInviteeEmails);
      onStatus(`Sent guest page to ${countLabel(emailsToSend.length, "invitee")}`);
      return true;
    } catch (error) {
      onStatus(`Sharing failed: ${errorMessage(error)}`);
      return false;
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <section className={gatheringPageClassName}>
        <WorkspaceHeader
          description="Loading the gathering draft."
          icon={<Users size={25} />}
          onBack={onBackToGatherings}
          title="Gathering"
        />
        <div className="grid gap-3 rounded-lg border border-solid border-(--color-line) bg-(--color-pop-card) p-5 shadow-pop-sm">
          <span className="h-6 w-1/2 animate-pulse rounded bg-(--color-line)" />
          <span className="h-4 w-4/5 animate-pulse rounded bg-(--color-line)" />
          <span className="h-32 w-full animate-pulse rounded bg-(--color-line)" />
        </div>
      </section>
    );
  }

  if (!gathering) {
    return (
      <section className={gatheringPageClassName}>
        <WorkspaceHeader
          description="Choose an existing gathering or create a new draft."
          icon={<Users size={25} />}
          onBack={onBackToGatherings}
          title="Gathering not found"
        />
      </section>
    );
  }

  return (
    <section className={gatheringPageClassName}>
      <WorkspaceHeader
        description="Edit the menu, guest page copy, invitees, and publishing state for this gathering."
        icon={<Users size={25} />}
        onBack={onBackToGatherings}
        title={
          gathering.status === "published" ? "Published gathering" : "Draft gathering"
        }
      >
        <span
          aria-live="polite"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-extrabold ${
            draftSaveState === "error"
              ? "text-(--color-tomato-dark)"
              : "text-(--color-pop-muted-ink)"
          }`}
          role="status"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : null}
          <span>{gatheringSaveStatus}</span>
          {draftSaveState === "error" ? (
            <button
              className="ml-1 inline-flex min-h-7 items-center gap-1 rounded-md border border-solid border-(--color-line) bg-(--color-pop-card) px-2 text-xs font-extrabold text-(--color-pop-ink) transition hover:border-(--color-pop-ink) disabled:cursor-not-allowed disabled:opacity-55"
              disabled={saving}
              onClick={() => void saveGathering()}
              type="button"
            >
              <RefreshCcw size={13} />
              Retry
            </button>
          ) : null}
        </span>
        {gathering.status === "published" ? (
          <Button disabled={saving} onClick={() => void saveGathering()} size="sm">
            {saving ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Save changes
          </Button>
        ) : null}
        {gathering.status === "published" ? (
          <GatheringShareMenu
            disabled={saving || publishing || !publicLink}
            emailFieldId={`gathering-share-emails-${gathering.id}`}
            inviteeCount={inviteeEmailList.length}
            onCopyLink={copyPublicLink}
            onSendInvites={sendShareInvites}
            publicLink={publicLink}
            publicPath={gatheringPublicPath(gathering)}
            sending={publishing}
          />
        ) : (
          <Button
            disabled={!canPublish}
            onClick={() => void publishGathering()}
            size="sm"
            variant="primary"
          >
            {publishing ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            Publish gathering
          </Button>
        )}
      </WorkspaceHeader>

      {message !== "Ready" && !shouldHideRoutineGatheringStatus ? (
        <p className={inlineStatusClassName}>
          <CheckCircle2 size={16} />
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(360px,0.78fr)] gap-4 max-[920px]:grid-cols-1">
        <section className={`${gatheringPanelClassName} gap-4 p-5 pt-7`}>
          <div className={gatheringPanelHeaderClassName}>
            <span className={gatheringPanelTitleClassName}>
              <span className={gatheringPanelIconClassName}>
                <Sparkles size={16} strokeWidth={3} />
              </span>
              Guest page
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black capitalize ${gatheringStatusClassName(
                gathering.status,
              )}`}
            >
              {gathering.status}
            </span>
          </div>

          <GatheringField label="Page title">
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Saturday supper"
              value={title}
            />
          </GatheringField>

          <GatheringField label="Welcome note">
            <textarea
              className="min-h-[118px]!"
              onChange={(event) => setWelcome(event.target.value)}
              placeholder="Welcome everyone and set the tone."
              value={welcome}
            />
            <DictationControl onValueChange={setWelcome} value={welcome} />
          </GatheringField>

          <GatheringField label="Creative direction">
            <textarea
              className="min-h-[92px]!"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Make it playful, elegant, kid-friendly..."
              value={prompt}
            />
            <DictationControl onValueChange={setPrompt} value={prompt} />
          </GatheringField>

          <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
            <GatheringField label="Dietary notes">
              <input
                onChange={(event) => setDietary(event.target.value)}
                placeholder="vegan, nut-free, gluten-free"
                value={dietary}
              />
              <DictationControl onValueChange={setDietary} value={dietary} />
            </GatheringField>
            <GatheringField label="Guest question">
              <textarea
                className="min-h-[64px]!"
                onChange={(event) => setGuestQuestion(event.target.value)}
                value={guestQuestion}
              />
              <DictationControl
                onValueChange={setGuestQuestion}
                value={guestQuestion}
              />
            </GatheringField>
          </div>

          <GatheringField label="Invitee emails">
            <textarea
              className="min-h-[74px]!"
              onChange={(event) => setInviteeEmails(event.target.value)}
              placeholder="friend@example.com, family@example.com"
              value={inviteeEmails}
            />
          </GatheringField>
          {invalidEmails.length ? (
            <p className="m-0 rounded-lg bg-[color-mix(in_oklch,var(--color-tomato)_10%,white)] px-3 py-2 text-[12.5px] font-bold text-(--color-tomato-dark)">
              Check {invalidEmails[0]}.
            </p>
          ) : null}

          {publicLink ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-solid border-(--color-line) pt-3">
              <a
                className={buttonClassName({ size: "sm", variant: "secondary" })}
                href={gatheringPublicPath(gathering)}
                target="_blank"
                rel="noopener"
              >
                <ExternalLink size={16} />
                View guest page
              </a>
            </div>
          ) : null}
        </section>

        <aside className="grid content-start gap-4">
          <section className={`${gatheringPanelClassName} gap-3 p-4 pt-7`}>
            <div className={gatheringPanelHeaderClassName}>
              <span className={gatheringPanelTitleClassName}>
                <span className={gatheringPanelIconClassName}>
                  <Utensils size={16} strokeWidth={3} />
                </span>
                Menu
              </span>
              <span className="text-xs font-extrabold text-(--color-pop-muted-ink)">
                {countLabel(recipeIds.length, "recipe")}
              </span>
            </div>

            {selectedRecipes.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedRecipes.map((recipe) => (
                  <button
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border-2 border-(--color-sage) bg-[color-mix(in_oklch,var(--color-sage-soft)_78%,white)] px-2.5 py-1 text-xs font-black text-(--color-sage) shadow-[1px_1px_0_0_var(--color-sage)] hover:-translate-y-px"
                    key={recipe.id}
                    onClick={() => toggleRecipe(recipe.id)}
                    type="button"
                  >
                    <span className="truncate">{recipe.title}</span>
                    <X size={13} strokeWidth={3} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="m-0 rounded-lg border border-dashed border-(--color-line) bg-(--color-panel) p-3 text-[13px] font-bold leading-5 text-(--color-pop-muted-ink)">
                Add at least one recipe before publishing the gathering.
              </p>
            )}

            <div className="relative">
              <input
                className="min-h-11 w-full rounded-xl border-2 border-solid border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-(--color-panel) px-3 text-sm font-bold text-(--color-ink) outline-none transition placeholder:text-[#9a8f80] focus:border-(--color-pop-primary) focus:shadow-[3px_3px_0_0_var(--color-pop-accent)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search recipes"
                value={query}
              />
            </div>

            <button
              className="grid min-h-[58px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border-2 border-[color-mix(in_oklch,var(--color-pop-accent)_68%,var(--color-line))] bg-[color-mix(in_oklch,var(--color-pop-accent)_18%,white)] p-2.5 text-left text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-pop-ink)] transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px disabled:opacity-50"
              disabled={!hasAutoPickRecipes || pickingRecipes}
              onClick={() => void pickRecipesForMe()}
              type="button"
            >
              <span className="grid size-9 place-items-center rounded-lg border-2 border-(--color-pop-ink) bg-(--color-panel) text-(--color-tomato)">
                {pickingRecipes ? (
                  <Loader2 className="animate-spin" size={17} strokeWidth={3} />
                ) : (
                  <Sparkles size={17} strokeWidth={3} />
                )}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="text-sm font-black leading-tight">
                  {pickingRecipes ? "Picking menu" : "Pick for me"}
                </span>
                <span className="truncate text-[12px] font-extrabold text-(--color-pop-muted-ink)">
                  {pickingRecipes
                    ? "Checking preferences"
                    : query.trim()
                    ? `${countLabel(autoPickRecipeIds.length, "matching recipe")}`
                    : `${countLabel(autoPickRecipeIds.length, "recipe")}`}
                </span>
              </span>
              <span className="text-[12px] font-black text-(--color-tomato-dark)">
                Auto
              </span>
            </button>

            <div
              className="grid max-h-[460px] gap-2 overflow-auto pr-1"
              onScroll={handleRecipePickerScroll}
            >
              {visibleMatchingRecipes.map((recipe) => {
                const selected = recipeIds.includes(recipe.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "grid min-h-[88px] grid-cols-[48px_minmax(0,1fr)_28px] items-center gap-2 rounded-xl border-2 border-(--color-sage) bg-[color-mix(in_oklch,var(--color-sage-soft)_82%,white)] p-2.5 text-left text-(--color-ink) shadow-[2px_2px_0_0_var(--color-sage)]"
                        : "grid min-h-[88px] grid-cols-[48px_minmax(0,1fr)_28px] items-center gap-2 rounded-xl border-2 border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-(--color-panel) p-2.5 text-left text-(--color-ink) hover:border-(--color-pop-ink) hover:shadow-[2px_2px_0_0_var(--color-pop-accent)]"
                    }
                    key={recipe.id}
                    onClick={() => toggleRecipe(recipe.id)}
                    type="button"
                  >
                    <GatheringRecipePickerThumb recipe={recipe} />
                    <span className="grid min-w-0 gap-1">
                      <span className="line-clamp-2 text-sm font-extrabold leading-tight">
                        {recipe.title}
                      </span>
                      {recipe.description ? (
                        <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-(--color-pop-muted-ink)">
                          {recipe.description}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={
                        selected
                          ? "grid size-7 place-items-center rounded-lg bg-(--color-sage) text-white"
                          : "grid size-7 place-items-center rounded-lg border-2 border-(--color-line) text-transparent"
                      }
                    >
                      <CheckCircle2 size={15} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
              {hasMoreMatchingRecipes ? (
                <button
                  className="min-h-10 rounded-lg border border-dashed border-(--color-line) bg-(--color-panel) px-3 text-[13px] font-extrabold text-(--color-pop-muted-ink) hover:border-(--color-ink) hover:text-(--color-ink)"
                  onClick={showMoreRecipes}
                  type="button"
                >
                  Load more recipes
                </button>
              ) : null}
              {matchingRecipes.length === 0 ? (
                <p className="m-0 rounded-lg border border-dashed border-(--color-line) bg-(--color-panel) p-3 text-[13px] font-bold text-(--color-pop-muted-ink)">
                  No recipes match that search.
                </p>
              ) : null}
            </div>
          </section>

          <section className="grid gap-2 rounded-lg border border-solid border-(--color-line) bg-(--color-panel) p-4">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase text-(--color-pop-muted-ink)">
              <Mail size={15} />
              Invite status
            </span>
            <p className="m-0 text-sm font-bold leading-6 text-(--color-ink)">
              {countLabel(inviteeEmailList.length, "invitee")}
              {gathering.publishedAt
                ? `, published ${shortDate(gathering.publishedAt)}`
                : ""}
            </p>
            {publicLink ? (
              <input
                className="min-h-10 min-w-0 rounded-lg border border-solid border-(--color-line) bg-(--color-pop-card) px-3 text-xs font-semibold text-(--color-pop-muted-ink)"
                readOnly
                value={publicLink}
              />
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}

function GatheringRecipePickerThumb({ recipe }: { recipe: Recipe }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const image = recipeImagesOf(recipe)[0];
  const imageUrl = displayImageUrl(image?.url);
  const className =
    "grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-solid border-(--color-line) bg-(--color-pop-card) text-(--color-sage)";

  return imageUrl && failedImageUrl !== imageUrl ? (
    <img
      alt=""
      className={`${className} object-cover`}
      decoding="async"
      loading="lazy"
      onError={() => setFailedImageUrl(imageUrl)}
      src={imageUrl}
    />
  ) : (
    <span className={className}>
      <Utensils size={18} strokeWidth={2.5} />
    </span>
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
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [gatheringsLoading, setGatheringsLoading] = useState(false);
  const [selectedGatheringId, setSelectedGatheringId] = useState<string | undefined>(
    appSearch.gathering,
  );
  const [selectedGatheringSnapshot, setSelectedGatheringSnapshot] =
    useState<Gathering>();
  const [selectedGatheringLoadFailedId, setSelectedGatheringLoadFailedId] =
    useState<string>();
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
  const [autoSaveRetryToken, setAutoSaveRetryToken] = useState(0);
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
  const gatheringRequestIdRef = useRef(0);

  const workspaceSearch = useMemo<WorkspaceSearchState>(() => {
    if (addMode) {
      return { add: true };
    }

    if (page !== "recipes") {
      return {
        page,
        ...(page === "gathering" && selectedGatheringId
          ? { gathering: selectedGatheringId }
          : {}),
      };
    }

    if (section === "mine") {
      return selectedId ? { recipe: selectedId } : {};
    }

    return {
      section,
      ...(sharedSelectedKey ? { browse: sharedSelectedKey } : {}),
    };
  }, [addMode, page, section, selectedGatheringId, selectedId, sharedSelectedKey]);

  useEffect(() => {
    const nextPage = appSearch.page ?? "recipes";
    const nextAddMode = Boolean(appSearch.add);
    const nextSection = searchSection(appSearch);
    const nextGatheringId = appSearch.gathering;
    const nextSelectedId = appSearch.recipe;
    const nextSharedSelectedKey = appSearch.browse;

    if (!workspaceSearchEqual(appSearch, workspaceSearch)) {
      applyingUrlStateRef.current = true;
    }

    setPage(nextPage);
    setAddMode(nextAddMode);
    setSection(nextSection);
    setSelectedGatheringId(nextGatheringId);
    setSelectedId(nextSelectedId);
    setSharedSelectedKey(nextSharedSelectedKey);
  }, [
    appSearch.add,
    appSearch.browse,
    appSearch.gathering,
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
    appSearch.gathering,
    appSearch.page,
    appSearch.recipe,
    appSearch.section,
    navigate,
    workspaceSearch,
  ]);

  const sessionUserId = session?.user.id ?? null;
  const [hasFoodPreferences, setHasFoodPreferences] = useState<boolean | null>(null);

  const visibleRecipes = recipes;
  const selectedGathering = useMemo(() => {
    if (!selectedGatheringId) {
      return undefined;
    }
    return (
      gatherings.find((gathering) => gathering.id === selectedGatheringId) ??
      (selectedGatheringSnapshot?.id === selectedGatheringId
        ? selectedGatheringSnapshot
        : undefined)
    );
  }, [gatherings, selectedGatheringId, selectedGatheringSnapshot]);
  const selectedGatheringEditorLoading = Boolean(
    sessionUserId &&
    page === "gathering" &&
    selectedGatheringId &&
    !selectedGathering &&
    selectedGatheringLoadFailedId !== selectedGatheringId,
  );
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

  const upsertGathering = useCallback((gathering: Gathering) => {
    gatheringRequestIdRef.current += 1;
    setGatheringsLoading(false);
    setSelectedGatheringSnapshot((current) =>
      current?.id === gathering.id ? gathering : current,
    );
    setSelectedGatheringLoadFailedId((current) =>
      current === gathering.id ? undefined : current,
    );
    setGatherings((current) => {
      const next = current.some((item) => item.id === gathering.id)
        ? current.map((item) => (item.id === gathering.id ? gathering : item))
        : [gathering, ...current];
      return [...next].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });
  }, []);

  const openGatheringEditor = useCallback((id: string) => {
    setSelectedGatheringLoadFailedId(undefined);
    setSelectedGatheringId(id);
    setPage("gathering");
    setAddMode(false);
  }, []);

  const saveGathering = useCallback(
    async (id: string, payload: SaveGatheringPayload) => {
      const saved = await api.updateGathering(id, payload);
      upsertGathering(saved);
      return saved;
    },
    [upsertGathering],
  );

  const publishGathering = useCallback(
    async (id: string, payload: SaveGatheringPayload) => {
      const result = await api.publishOwnedGathering(id, payload);
      upsertGathering(result.gathering);
      setMessage("Gathering published");
      return result;
    },
    [upsertGathering],
  );

  const shareGatheringByEmail = useCallback(
    async (gathering: Gathering, emailText: string) => {
      if (gathering.status !== "published") {
        setMessage("Publish the gathering before sharing.");
        return false;
      }

      const shareInvitees = parseInviteeEmails(emailText);
      if (!shareInvitees.length) {
        setMessage("Add at least one email.");
        return false;
      }

      const invalidShareInvitees = shareInvitees.filter(
        (email) => !looksLikeEmail(email),
      );
      if (invalidShareInvitees.length) {
        setMessage(`Check ${invalidShareInvitees[0]}.`);
        return false;
      }

      const currentInvitees = gathering.invitees.map((invitee) => invitee.email);
      const sentInvitees = new Set(
        gathering.invitees
          .filter((invitee) => Boolean(invitee.sentAt))
          .map((invitee) => invitee.email.toLowerCase()),
      );
      const nextInvitees = [...new Set([...currentInvitees, ...shareInvitees])];
      const emailsToSend = nextInvitees.filter((email) => !sentInvitees.has(email));
      if (!emailsToSend.length) {
        setMessage(`${countLabel(shareInvitees.length, "invitee")} already has the link`);
        return true;
      }

      try {
        const result = await api.publishOwnedGathering(gathering.id, {
          ...gatheringPersistedPayload(gathering),
          inviteeEmails: nextInvitees,
        });
        upsertGathering(result.gathering);
        setMessage(`Sent guest page to ${countLabel(emailsToSend.length, "invitee")}`);
        return true;
      } catch (error) {
        setMessage(`Sharing failed: ${errorMessage(error)}`);
        return false;
      }
    },
    [upsertGathering],
  );

  async function createGatheringDraft(recipe?: Recipe) {
    if (!ensureSignedIn("create a gathering")) {
      return;
    }

    if (recipe && (!recipe.id || recipe.id.startsWith("demo-"))) {
      setMessage("Save this recipe before adding it to a gathering.");
      return;
    }

    try {
      const gathering = await api.createGathering({
        recipeIds: recipe ? [recipe.id] : [],
        title: recipe ? `${recipe.title} gathering` : undefined,
      });
      setSelectedGatheringSnapshot(gathering);
      upsertGathering(gathering);
      openGatheringEditor(gathering.id);
      setMessage(
        recipe ? `Started a gathering with ${recipe.title}` : "Gathering draft created",
      );
    } catch (error) {
      setMessage(`Creating gathering failed: ${errorMessage(error)}`);
    }
  }

  async function setRecipeGatheringMembership(
    gatheringId: string,
    recipe: Recipe,
    selected: boolean,
  ) {
    if (!recipe.id || recipe.id.startsWith("demo-")) {
      setMessage("Save this recipe before adding it to a gathering.");
      return;
    }

    const gathering = gatherings.find((item) => item.id === gatheringId);
    if (!gathering) {
      setMessage("Gathering not found.");
      return;
    }

    const recipeIds = selected
      ? gathering.recipeIds.includes(recipe.id)
        ? gathering.recipeIds
        : [...gathering.recipeIds, recipe.id]
      : gathering.recipeIds.filter((id) => id !== recipe.id);

    try {
      const saved = await api.updateGathering(gathering.id, { recipeIds });
      upsertGathering(saved);
      setMessage(
        selected
          ? `Added “${recipe.title}” to ${saved.title}`
          : `Removed “${recipe.title}” from ${saved.title}`,
      );
    } catch (error) {
      setMessage(`Updating gathering failed: ${errorMessage(error)}`);
    }
  }

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

  const loadGatherings = useCallback(async () => {
    const requestId = gatheringRequestIdRef.current + 1;
    gatheringRequestIdRef.current = requestId;

    if (!sessionUserId) {
      setGatherings([]);
      setGatheringsLoading(false);
      return;
    }

    setGatheringsLoading(true);
    try {
      const nextGatherings = await api.listGatherings();
      if (gatheringRequestIdRef.current === requestId) {
        setGatherings(nextGatherings);
      }
    } catch (error) {
      if (gatheringRequestIdRef.current === requestId) {
        setMessage(`Loading gatherings failed: ${errorMessage(error)}`);
      }
    } finally {
      if (gatheringRequestIdRef.current === requestId) {
        setGatheringsLoading(false);
      }
    }
  }, [sessionUserId]);

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

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    void loadGatherings();
  }, [loadGatherings, sessionLoading]);

  useEffect(() => {
    if (
      sessionLoading ||
      !sessionUserId ||
      page !== "gathering" ||
      !selectedGatheringId ||
      selectedGathering ||
      selectedGatheringLoadFailedId === selectedGatheringId
    ) {
      return;
    }

    let cancelled = false;
    const loadingGatheringId = selectedGatheringId;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setSelectedGatheringLoadFailedId(loadingGatheringId);
        setMessage("Loading gathering timed out. Try refreshing gatherings.");
      }
    }, 10_000);
    setSelectedGatheringLoadFailedId(undefined);
    api
      .getOwnedGathering(loadingGatheringId)
      .then((gathering) => {
        if (!cancelled) {
          upsertGathering(gathering);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedGatheringLoadFailedId(loadingGatheringId);
          setMessage(`Loading gathering failed: ${errorMessage(error)}`);
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    page,
    selectedGathering,
    selectedGatheringLoadFailedId,
    selectedGatheringId,
    sessionLoading,
    sessionUserId,
    upsertGathering,
  ]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!sessionUserId) {
      setHasFoodPreferences(null);
      return;
    }

    let cancelled = false;
    setHasFoodPreferences(null);
    api
      .getFoodPreferences()
      .then((result) => {
        if (!cancelled) {
          setHasFoodPreferences(Boolean(result.preferences));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setHasFoodPreferences(null);
          setMessage(`Preference check failed: ${errorMessage(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionLoading, sessionUserId]);

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
    let needsFollowUpSave = false;
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
        const latestStillDirty = Boolean(
          latestDraft.id === saved.id &&
          latestDraft.title.trim() &&
          JSON.stringify(recipeAutoSavePayload(latestDraft)) !==
            JSON.stringify(recipeAutoSavePayload(saved)),
        );
        needsFollowUpSave = latestStillDirty;
        finishSave("saved", { keepSaving: latestStillDirty });
      })
      .catch((error) => {
        needsFollowUpSave = false;
        if (mountedRef.current) {
          finishSave("error");
          setMessage(`Auto-save failed: ${errorMessage(error)}`);
        }
      })
      .finally(() => {
        savingRef.current = false;
        if (needsFollowUpSave && mountedRef.current) {
          setAutoSaveRetryToken((token) => token + 1);
        }
      });
  }, [
    autoSaveRetryToken,
    beginSave,
    debouncedDraft,
    finishSave,
    recipes,
    sessionUserId,
  ]);

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
    <main className="grid h-screen min-h-screen grid-cols-[minmax(380px,0.68fr)_minmax(580px,1.32fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(255,190,91,0.22),transparent_20rem),radial-gradient(circle_at_92%_7%,rgba(47,104,75,0.18),transparent_23rem),radial-gradient(circle_at_84%_88%,rgba(226,82,63,0.13),transparent_22rem),linear-gradient(135deg,#fff7e3_0%,#f6efe2_48%,#eaf3df_100%)] text-(--color-ink) max-[1180px]:grid-cols-[minmax(360px,0.78fr)_minmax(520px,1.22fr)] max-[980px]:h-auto max-[980px]:grid-cols-[minmax(0,1fr)] max-[980px]:grid-rows-[auto] max-[980px]:overflow-visible">
      <AppNav
        onAuthIntent={openAuth}
        onNavigateHome={() => navigate({ to: "/" })}
        onOpenOnboarding={() => openAppPage("preferences")}
        onSignOut={signOut}
        page={addMode ? "recipes" : page}
        session={session}
        sessionLoading={sessionLoading}
        showPreferencesPrompt={page !== "preferences" && hasFoodPreferences === false}
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
            gatherings={gatherings}
            gatheringsLoading={gatheringsLoading}
            mode={mode}
            onBack={closeRecipe}
            onChange={setDraft}
            onCreateGatheringForRecipe={(recipe) => void createGatheringDraft(recipe)}
            onDelete={deleteSelectedRecipe}
            onMirrorImages={mirrorImages}
            onOpenGathering={openGatheringEditor}
            onSetMode={setMode}
            onStructure={structureCurrentRecipe}
            onToggleGatheringRecipe={(gatheringId, recipe, selected) =>
              void setRecipeGatheringMembership(gatheringId, recipe, selected)
            }
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
      ) : page === "gatherings" ? (
        <GatheringsPage
          gatherings={gatherings}
          loading={gatheringsLoading}
          message={message}
          onCreate={() => void createGatheringDraft()}
          onLogIn={() => openAuth("login")}
          onOpen={openGatheringEditor}
          onRefresh={loadGatherings}
          onSendInvites={shareGatheringByEmail}
          onStatus={setMessage}
          sessionUserId={sessionUserId}
        />
      ) : page === "gathering" || page === "gathering-generating" ? (
        <GatheringEditorPage
          gathering={selectedGathering}
          loading={selectedGatheringEditorLoading}
          message={message}
          onBackToGatherings={() => openAppPage("gatherings")}
          onPublish={publishGathering}
          onSave={saveGathering}
          onStatus={setMessage}
          recipes={visibleRecipes}
        />
      ) : page === "api" ? (
        <ApiPage recipes={visibleRecipes} status={status} />
      ) : page === "billing" ? (
        <BillingPage
          onCreateAccount={() => openAuth("signup")}
          onGoToPricing={() => navigate({ to: "/pricing" })}
          onLogIn={() => openAuth("login")}
          session={session}
          sessionLoading={sessionLoading}
        />
      ) : page === "export" ? (
        <ExportPage
          message={message}
          onMirrorImages={mirrorImages}
          recipes={visibleRecipes}
          selectedRecipe={selectedRecipe}
        />
      ) : page === "preferences" ? (
        <FoodPreferencesPage
          embedded
          onSaved={() => setHasFoodPreferences(true)}
          onSkip={() => openAppPage("recipes")}
        />
      ) : page === "settings" ? (
        <SettingsPage
          message={message}
          onCreateAccount={() => openAuth("signup")}
          onGoToPage={openAppPage}
          onOpenOnboarding={() => openAppPage("preferences")}
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
