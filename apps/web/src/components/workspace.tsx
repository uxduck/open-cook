import {
  type Gathering,
  type GatheringArtifact,
  type Recipe,
  type RecipeVisibility,
  recipeSearchText,
  type SharedRecipe,
  structureIngredients,
  structureSteps,
} from "@open-cook/core";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Braces,
  CalendarDays,
  CheckCircle2,
  Compass,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  AlertTriangle,
  Clock3,
  Image as ImageIcon,
  KeyRound,
  LibraryBig,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Mic2,
  MoreHorizontal,
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
  Video,
  X,
} from "lucide-react";
import {
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  api,
  type PublishGatheringResult,
  type SaveGatheringPayload,
  type SendGatheringInvitesResult,
} from "../api";
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
  PopButton,
  SegmentedControl,
  type SegmentedControlItem,
  workspacePrimaryActionButtonClassName,
  workspaceScrollPageClassName,
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
  gatheringDraftAssistFieldValue,
  gatheringDraftAssistPrompt,
  gatheringBuildPlaceholders,
  gatheringRecipeAutoPickCount,
  gatheringRecipePickerAutoPickIds,
  gatheringRecipePickerMatches,
  gatheringRecipePickerPageSize,
  gatheringRecipePickerSelectedFirst,
  gatheringTitleDietaryHints,
  nextGatheringRecipePickerCount,
} from "./recipeGenerator";
import { WorkspaceHeader } from "@open-cook/design-system";
import {
  ApiPage,
  BillingPage,
  BuildPage,
  CookbooksPage,
  ExportPage,
  SettingsPage,
} from "./tools";
import { VoiceSearchInput } from "./VoiceSearchInput";

type WorkspaceSearchState = {
  add?: boolean;
  browse?: string;
  cookbook?: string;
  gathering?: string;
  page?: Page;
  recipe?: string;
  section?: RecipeSection;
};

type WorkspaceRouteState = {
  addMode: boolean;
  page: Page;
  recipeMode?: "edit" | "view";
  selectedCookbookId?: string;
  selectedRecipeId?: string;
  selectedGatheringId?: string;
};

type WorkspaceDestination = {
  pathname: string;
  search: WorkspaceSearchState;
};

type WorkspaceGathering = Gathering & {
  artifacts?: GatheringArtifact[];
};

const workspaceSearchKeys: Array<keyof WorkspaceSearchState> = [
  "add",
  "browse",
  "cookbook",
  "gathering",
  "page",
  "recipe",
  "section",
];

const gatheringEditorPickerScrollThresholdPx = 80;
const gatheringArtifactPollMs = 4_000;
const gatheringPageClassName =
  `${workspaceScrollPageClassName} grid content-start gap-5 ` +
  "bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-bg)_88%,white),color-mix(in_oklch,var(--color-pop-accent)_12%,white)_58%,color-mix(in_oklch,var(--color-pop-secondary)_14%,white))] [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[1180px]";

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
  "[&_textarea]:min-h-[86px] [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:resize-y [&_textarea]:break-words [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-0 [&_textarea]:text-[15px] [&_textarea]:font-[720] [&_textarea]:normal-case [&_textarea]:leading-[1.38] [&_textarea]:text-(--color-ink) [&_textarea]:whitespace-pre-wrap [&_textarea]:[overflow-wrap:anywhere] [&_textarea]:outline-0 [&_textarea::placeholder]:font-[680] [&_textarea::placeholder]:text-[#9a8f80]";

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

function stringSearchParam(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanSearchParam(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function decodePathSegment(value?: string) {
  if (!value) {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAppPathname(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function workspaceRouteStateFromLocation(
  pathname: string,
  search: WorkspaceSearchState,
): WorkspaceRouteState {
  const normalized = normalizeAppPathname(pathname);
  const [, appSegment, sectionSegment, idSegment, actionSegment] =
    normalized.split("/");

  if (appSegment !== "app") {
    return { addMode: false, page: "recipes" };
  }

  if (sectionSegment === "import") {
    return { addMode: true, page: "recipes" };
  }

  if (sectionSegment === "cookbooks") {
    return {
      addMode: false,
      page: "cookbooks",
      selectedCookbookId: stringSearchParam(search.cookbook),
    };
  }

  if (sectionSegment === "gatherings") {
    const selectedGatheringId = decodePathSegment(idSegment);
    if (selectedGatheringId) {
      return {
        addMode: false,
        page: actionSegment === "share" ? "gathering-share" : "gathering",
        selectedGatheringId,
      };
    }
    return { addMode: false, page: "gatherings" };
  }

  if (sectionSegment === "recipes") {
    const selectedRecipeId = decodePathSegment(idSegment);
    if (selectedRecipeId) {
      return {
        addMode: false,
        page: "recipes",
        recipeMode: actionSegment === "edit" ? "edit" : "view",
        selectedRecipeId,
      };
    }
    return { addMode: false, page: "recipes" };
  }

  if (sectionSegment === "api") {
    return { addMode: false, page: "api" };
  }

  if (sectionSegment === "billing") {
    return { addMode: false, page: "billing" };
  }

  if (sectionSegment === "export") {
    return { addMode: false, page: "export" };
  }

  if (sectionSegment === "preferences") {
    return { addMode: false, page: "preferences" };
  }

  if (sectionSegment === "settings") {
    return { addMode: false, page: "settings" };
  }

  if (sectionSegment === "build") {
    return { addMode: false, page: "build" };
  }

  if (booleanSearchParam(search.add)) {
    return { addMode: true, page: "recipes" };
  }

  const legacyPage = stringSearchParam(search.page) as Page | undefined;
  if (legacyPage) {
    return {
      addMode: false,
      page: legacyPage,
      selectedCookbookId:
        legacyPage === "cookbooks" ? stringSearchParam(search.cookbook) : undefined,
      selectedRecipeId:
        legacyPage === "recipes" ? stringSearchParam(search.recipe) : undefined,
      selectedGatheringId: stringSearchParam(search.gathering),
    };
  }

  return {
    addMode: false,
    page: "recipes",
    selectedRecipeId: stringSearchParam(search.recipe),
  };
}

function workspaceDestinationForState({
  addMode,
  page,
  recipeMode = "view",
  search,
  selectedCookbookId,
  selectedRecipeId,
  selectedGatheringId,
}: WorkspaceRouteState & { search: WorkspaceSearchState }): WorkspaceDestination {
  if (addMode) {
    return { pathname: "/app/import", search: {} };
  }

  if (page === "cookbooks") {
    return {
      pathname: "/app/cookbooks",
      search: selectedCookbookId ? { cookbook: selectedCookbookId } : {},
    };
  }

  if (page === "gatherings") {
    return { pathname: "/app/gatherings", search: {} };
  }

  if (page === "gathering" || page === "gathering-generating") {
    return {
      pathname: selectedGatheringId
        ? `/app/gatherings/${encodeURIComponent(selectedGatheringId)}`
        : "/app/gatherings",
      search: {},
    };
  }

  if (page === "gathering-share") {
    return {
      pathname: selectedGatheringId
        ? `/app/gatherings/${encodeURIComponent(selectedGatheringId)}/share`
        : "/app/gatherings",
      search: {},
    };
  }

  if (page === "api") {
    return { pathname: "/app/api", search: {} };
  }

  if (page === "billing") {
    return { pathname: "/app/billing", search: {} };
  }

  if (page === "export") {
    return { pathname: "/app/export", search: {} };
  }

  if (page === "preferences") {
    return { pathname: "/app/preferences", search: {} };
  }

  if (page === "settings") {
    return { pathname: "/app/settings", search: {} };
  }

  if (page === "build") {
    return { pathname: "/app/build", search: {} };
  }

  if (page === "recipes") {
    if (search.section && search.section !== "mine") {
      return { pathname: "/app/recipes", search };
    }

    if (selectedRecipeId) {
      return {
        pathname: `/app/recipes/${encodeURIComponent(selectedRecipeId)}${
          recipeMode === "edit" ? "/edit" : ""
        }`,
        search: {},
      };
    }

    return { pathname: "/app/recipes", search: {} };
  }

  return { pathname: "/app/recipes", search };
}

function workspaceLocationMatchesDestination(
  pathname: string,
  search: WorkspaceSearchState,
  destination: WorkspaceDestination,
) {
  return (
    normalizeAppPathname(pathname) === destination.pathname &&
    workspaceSearchEqual(search, destination.search)
  );
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

const workspaceSecondaryActionButtonClassName =
  "rounded-xl! border-2! border-(--color-pop-ink)! bg-(--color-pop-card)! text-(--color-pop-ink)! shadow-[2px_2px_0_0_var(--color-pop-ink)]! hover:border-(--color-pop-ink)! hover:bg-[color-mix(in_oklch,var(--color-pop-secondary)_16%,white)]! hover:shadow-[3px_3px_0_0_var(--color-pop-ink)]!";

const accountAvatarButtonClassName = `cursor-pointer ${workspacePrimaryActionButtonClassName} data-[state=open]:border-(--color-pop-ink)! data-[state=open]:bg-[linear-gradient(135deg,var(--color-pop-secondary),var(--color-pop-accent))]! data-[state=open]:text-(--color-pop-ink)!`;

type PrimaryAppSection = "recipes" | "cookbooks" | "gatherings";

const primaryAppSectionTabs = [
  { icon: <LibraryBig size={15} />, label: "Recipes", value: "recipes" },
  { icon: <BookOpen size={15} />, label: "Cookbooks", value: "cookbooks" },
  { icon: <Users size={15} />, label: "Gatherings", value: "gatherings" },
] satisfies Array<SegmentedControlItem<PrimaryAppSection>>;

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

export function AppNav({
  onAuthIntent,
  onNavigateHome,
  onOpenLanding,
  onSignOut,
  page,
  session,
  sessionLoading,
  setPage,
}: {
  onAuthIntent: (intent: Exclude<AuthIntent, null>) => void;
  onNavigateHome: () => void;
  onOpenLanding: () => void;
  onSignOut: () => Promise<void>;
  page: Page;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
  setPage: (page: Page) => void;
}) {
  function openMenuPage(nextPage: Page) {
    setPage(nextPage);
  }

  const initials = session ? accountInitials(session.user.name) : "";
  const isGatheringsPage =
    page === "gatherings" ||
    page === "gathering" ||
    page === "gathering-share" ||
    page === "gathering-generating";
  const activePrimarySection: PrimaryAppSection | null =
    page === "recipes" || page === "cookbooks"
      ? page
      : isGatheringsPage
        ? "gatherings"
        : null;

  return (
    <header className="relative z-50 col-[1/-1] grid content-start grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[18px] border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_78%,transparent)] px-6 py-3 backdrop-blur-[16px] backdrop-saturate-[1.3] max-[980px]:col-[1] max-[980px]:row-auto max-[980px]:grid-cols-[minmax(0,1fr)_auto] max-[980px]:gap-x-3 max-[980px]:gap-y-3 max-[720px]:px-4">
      <button
        className="inline-flex min-h-[38px] justify-self-start items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold tracking-normal text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66] max-[860px]:flex-initial"
        onClick={onNavigateHome}
        type="button"
      >
        <img alt="" className="size-7" src="/logo.png" />
        <span>OpenCook</span>
      </button>
      <SegmentedControl
        aria-label="Primary"
        className="justify-self-center max-[980px]:col-span-full max-[980px]:row-start-2 max-[980px]:w-full max-[980px]:justify-center"
        items={primaryAppSectionTabs}
        onChange={openMenuPage}
        value={activePrimarySection}
      />
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-[980px]:justify-self-end max-[980px]:justify-end max-[860px]:flex-nowrap max-[860px]:[&>*]:flex-none">
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
                  className={accountMenuItemClassName}
                  onSelect={() => onOpenLanding()}
                >
                  <Globe2 size={15} />
                  Open homepage
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-[3px] h-px bg-(--color-line)" />
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
            <Button
              className="max-[420px]:hidden!"
              onClick={() => onAuthIntent("login")}
              size="sm"
            >
              <LogIn size={15} />
              Log in
            </Button>
            <Button
              className="max-[420px]:hidden!"
              onClick={onOpenLanding}
              size="sm"
              variant="secondary"
            >
              <Globe2 size={15} />
              Home
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
  const tabs = [
    { icon: <LibraryBig size={15} />, label: "Yours", value: "mine" },
    {
      badge: sharedCount || undefined,
      icon: <Users size={15} />,
      label: "Shared with you",
      value: "shared",
    },
    { icon: <Compass size={15} />, label: "Explore", value: "explore" },
  ] satisfies Array<SegmentedControlItem<RecipeSection>>;

  return (
    <SegmentedControl
      aria-label="Recipe sections"
      items={tabs}
      onChange={onSelect}
      value={section}
    />
  );
}

export function TopBar({
  hasFoodPreferences,
  loggedIn,
  onCreateBlank,
  onImport,
  onOpenPreferences,
}: {
  hasFoodPreferences: boolean | null;
  loggedIn: boolean;
  onCreateBlank: () => void | Promise<void>;
  onImport: () => void;
  onOpenPreferences: () => void;
}) {
  const preferencesMissing = hasFoodPreferences !== true;

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
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-[860px]:w-full max-[860px]:justify-start">
        <PopButton
          className="mt-0.5 max-md:w-full"
          onClick={onOpenPreferences}
          size="md"
          tone={preferencesMissing ? "accent" : "secondary"}
        >
          {preferencesMissing ? <Sparkles size={16} /> : <Salad size={16} />}
          {preferencesMissing ? "Set preferences" : "Food preferences"}
        </PopButton>
        <NewRecipeMenu onCreateBlank={onCreateBlank} onImport={onImport} />
      </div>
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
        className={`${workspacePrimaryActionButtonClassName} w-full`}
        variant="secondary"
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
      className={`${workspaceScrollPageClassName} grid content-start gap-5 bg-[#fffbf4] [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[820px]`}
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
    ? "rotate-[-1deg] border-2 border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-secondary)_24%,white)] text-(--color-pop-primary) shadow-[2px_2px_0_0_var(--color-pop-ink)]"
    : "rotate-[1deg] border-2 border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-accent)_32%,white)] text-[#7b4d08] shadow-[2px_2px_0_0_var(--color-pop-ink)]";
}

function gatheringHasArtifactDetails(
  gathering?: WorkspaceGathering,
): gathering is WorkspaceGathering & { artifacts: GatheringArtifact[] } {
  return Array.isArray(gathering?.artifacts);
}

function gatheringArtifactIsActive(artifact: GatheringArtifact) {
  return artifact.status === "pending" || artifact.status === "submitted";
}

function gatheringHasActiveArtifacts(gathering?: WorkspaceGathering) {
  return Boolean(
    gatheringHasArtifactDetails(gathering) &&
    gathering.artifacts.some(gatheringArtifactIsActive),
  );
}

function mergeWorkspaceGathering(
  current: WorkspaceGathering,
  next: WorkspaceGathering,
): WorkspaceGathering {
  if (gatheringHasArtifactDetails(next) || !gatheringHasArtifactDetails(current)) {
    return next;
  }
  return { ...next, artifacts: current.artifacts };
}

function gatheringArtifactIsComplete(artifact: GatheringArtifact) {
  return (
    artifact.status === "ready" ||
    artifact.status === "skipped" ||
    artifact.status === "failed"
  );
}

function gatheringArtifactProgress(artifacts: GatheringArtifact[]) {
  const total = artifacts.length;
  const complete = artifacts.filter(gatheringArtifactIsComplete).length;
  const ready = artifacts.filter((artifact) => artifact.status === "ready").length;
  const failed = artifacts.filter((artifact) => artifact.status === "failed").length;
  const skipped = artifacts.filter((artifact) => artifact.status === "skipped").length;
  const active = artifacts.filter(gatheringArtifactIsActive).length;

  return {
    active,
    complete,
    failed,
    percent: total ? Math.round((complete / total) * 100) : 0,
    ready,
    skipped,
    total,
  };
}

function gatheringArtifactProgressWidthClassName(progress: {
  complete: number;
  total: number;
}) {
  if (progress.total === 0 || progress.complete === 0) {
    return "w-0";
  }
  const ratio = progress.complete / progress.total;
  if (ratio >= 1) return "w-full";
  if (ratio >= 0.8) return "w-4/5";
  if (ratio >= 0.6) return "w-3/5";
  if (ratio >= 0.4) return "w-2/5";
  return "w-1/5";
}

function gatheringArtifactStatusLabel(status: GatheringArtifact["status"]) {
  switch (status) {
    case "failed":
      return "Failed";
    case "pending":
      return "Queued";
    case "ready":
      return "Ready";
    case "skipped":
      return "Skipped";
    case "submitted":
      return "Generating";
  }
}

function gatheringArtifactStatusClassName(status: GatheringArtifact["status"]) {
  switch (status) {
    case "failed":
      return "border-(--color-tomato)! bg-[color-mix(in_oklch,var(--color-tomato)_12%,white)] text-(--color-tomato-dark)";
    case "ready":
      return "border-(--color-sage)! bg-[color-mix(in_oklch,var(--color-sage-soft)_82%,white)] text-(--color-sage)";
    case "skipped":
      return "border-(--color-line)! bg-(--color-panel) text-(--color-pop-muted-ink)";
    case "pending":
      return "border-(--color-pop-accent)! bg-[color-mix(in_oklch,var(--color-pop-accent)_22%,white)] text-[#7b4d08]";
    case "submitted":
      return "border-(--color-pop-secondary)! bg-[color-mix(in_oklch,var(--color-pop-secondary)_20%,white)] text-(--color-pop-primary)";
  }
}

function gatheringArtifactKindIcon(kind: GatheringArtifact["kind"]) {
  if (kind === "voiceover") return Mic2;
  if (kind === "video-teaser") return Video;
  return ImageIcon;
}

const gatheringListPageClassName =
  `${workspaceScrollPageClassName} grid content-start gap-5 ` +
  "bg-[radial-gradient(circle_at_16%_9%,rgba(224,122,95,0.18),transparent_18rem),radial-gradient(circle_at_88%_16%,rgba(255,196,86,0.12),transparent_20rem),linear-gradient(180deg,#fff8e7_0%,#f6f0e4_44%,#edf4e7_100%)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(color-mix(in_oklch,var(--color-line)_64%,transparent)_1px,transparent_1px)] before:[background-size:18px_18px] before:opacity-45 [&>*]:relative [&>*]:z-10 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[1180px]";

const gatheringListCardClassName =
  "group relative grid min-h-[178px] overflow-hidden rounded-2xl border-2 border-solid border-(--color-pop-ink) bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-card)_92%,var(--color-pop-accent)),var(--color-pop-card)_46%,color-mix(in_oklch,var(--color-pop-secondary)_12%,white))] shadow-pop-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-pop before:absolute before:inset-x-0 before:top-0 before:h-2 before:content-[''] before:bg-[repeating-linear-gradient(90deg,var(--color-pop-accent)_0_18px,var(--color-pop-secondary)_18px_36px,var(--color-pop-pink)_36px_54px)] min-[760px]:grid-cols-[188px_minmax(0,1fr)]";

type GatheringMetaTone = "menu" | "invitees" | "date";

function gatheringCompactMetaClassName(tone: GatheringMetaTone) {
  const toneClassName =
    tone === "menu"
      ? "border-[color-mix(in_oklch,var(--color-pop-accent)_78%,var(--color-pop-ink))] bg-[color-mix(in_oklch,var(--color-pop-accent)_22%,white)]"
      : tone === "invitees"
        ? "border-[color-mix(in_oklch,var(--color-pop-secondary)_72%,var(--color-pop-ink))] bg-[color-mix(in_oklch,var(--color-pop-secondary)_18%,white)]"
        : "border-[color-mix(in_oklch,var(--color-pop-pink)_60%,var(--color-pop-ink))] bg-[color-mix(in_oklch,var(--color-pop-pink)_13%,white)]";

  return `inline-flex min-h-8 items-center gap-1.5 rounded-full border-2 border-solid px-2.5 py-1 text-xs font-black leading-none text-(--color-pop-ink) ${toneClassName}`;
}

const gatheringSoftButtonClassName = workspaceSecondaryActionButtonClassName;

const gatheringPopButtonClassName = workspacePrimaryActionButtonClassName;

type GatheringSection = "all" | "drafts" | "published";

export function GatheringSectionTabs({
  onSelect,
  section,
}: {
  onSelect: (section: GatheringSection) => void;
  section: GatheringSection;
}) {
  const tabs = [
    { icon: <CalendarDays size={15} />, label: "All", value: "all" },
    { icon: <Pencil size={15} />, label: "Drafts", value: "drafts" },
    { icon: <Share2 size={15} />, label: "Published", value: "published" },
  ] satisfies Array<SegmentedControlItem<GatheringSection>>;

  return (
    <SegmentedControl
      aria-label="Gathering sections"
      items={tabs}
      onChange={onSelect}
      value={section}
    />
  );
}

const gatheringActionMenuContentClassName =
  "z-50 grid min-w-[220px] gap-1 rounded-2xl border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-2 text-(--color-pop-ink) shadow-[5px_5px_0_0_var(--color-pop-ink)]";

const gatheringActionMenuItemClassName =
  "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-xl border border-solid border-transparent px-3 py-2 text-[13px] font-black leading-none outline-none transition hover:border-(--color-pop-ink) hover:bg-[color-mix(in_oklch,var(--color-pop-accent)_20%,white)] focus:border-(--color-pop-ink) focus:bg-[color-mix(in_oklch,var(--color-pop-accent)_20%,white)] data-[highlighted]:border-(--color-pop-ink) data-[highlighted]:bg-[color-mix(in_oklch,var(--color-pop-accent)_20%,white)] data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

function GatheringActionsMenu({
  duplicating,
  gathering,
  onCopyLink,
  onDuplicate,
  onOpen,
  onShare,
}: {
  duplicating: boolean;
  gathering: Gathering;
  onCopyLink: (gathering: Gathering) => void | Promise<void>;
  onDuplicate: (gathering: Gathering) => void | Promise<void>;
  onOpen: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const title = gatheringDisplayTitle(gathering);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          aria-label={`More actions for ${title}`}
          className={gatheringSoftButtonClassName}
          size="sm"
          variant="secondary"
        >
          <MoreHorizontal size={15} />
          More
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className={gatheringActionMenuContentClassName}
          sideOffset={8}
        >
          <DropdownMenu.Item
            className={gatheringActionMenuItemClassName}
            onSelect={() => onOpen(gathering.id)}
          >
            <Pencil size={15} />
            Edit gathering
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={gatheringActionMenuItemClassName}
            disabled={duplicating}
            onSelect={() => void onDuplicate(gathering)}
          >
            {duplicating ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Copy size={15} />
            )}
            Duplicate draft
          </DropdownMenu.Item>
          {gathering.status === "published" ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-[color-mix(in_oklch,var(--color-pop-ink)_22%,transparent)]" />
              <DropdownMenu.Item asChild className={gatheringActionMenuItemClassName}>
                <a href={gatheringPublicPath(gathering)} target="_blank" rel="noopener">
                  <ExternalLink size={15} />
                  Open page
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={gatheringActionMenuItemClassName}
                onSelect={() => void onCopyLink(gathering)}
              >
                <Copy size={15} />
                Copy link
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={gatheringActionMenuItemClassName}
                onSelect={() => onShare(gathering.id)}
              >
                <Share2 size={15} />
                Share invite
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function gatheringArtifactImageSortIndex(kind: GatheringArtifact["kind"]) {
  if (kind === "page-artwork") return 0;
  if (kind === "menu-images") return 1;
  if (kind === "rsvp-artwork") return 2;
  return 3;
}

function gatheringArtworkUrls(
  gathering: WorkspaceGathering,
  recipesById: Map<string, Recipe>,
) {
  const urls: string[] = [];
  const pushDisplayUrl = (rawUrl?: string) => {
    const url = displayImageUrl(rawUrl);
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  };

  if (gatheringHasArtifactDetails(gathering)) {
    const artifact = [...gathering.artifacts]
      .filter(
        (item) =>
          item.status === "ready" &&
          item.mediaUrl &&
          item.kind !== "voiceover" &&
          item.kind !== "video-teaser" &&
          (!item.contentType || item.contentType.startsWith("image/")),
      )
      .sort(
        (left, right) =>
          gatheringArtifactImageSortIndex(left.kind) -
          gatheringArtifactImageSortIndex(right.kind),
      )[0];

    pushDisplayUrl(artifact?.mediaUrl);
    if (urls.length) {
      return urls;
    }
  }

  for (const recipeId of gathering.recipeIds) {
    const recipe = recipesById.get(recipeId);
    if (!recipe) {
      continue;
    }

    pushDisplayUrl(recipeImagesOf(recipe)[0]?.url ?? recipe.imageUrl);
    if (urls.length >= 4) {
      break;
    }
  }

  return urls;
}

function GatheringCardArtwork({
  gathering,
  recipesById,
}: {
  gathering: WorkspaceGathering;
  recipesById: Map<string, Recipe>;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const imageUrls = gatheringArtworkUrls(gathering, recipesById)
    .filter((url) => !failedUrls.has(url))
    .slice(0, 4);
  const title = gatheringDisplayTitle(gathering);

  const onImageError = (url: string) => {
    setFailedUrls((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

  return (
    <div
      aria-label={`Artwork for ${title}`}
      className="relative z-10 m-4 mt-6 min-h-[138px] overflow-hidden rounded-xl border-2 border-solid border-(--color-pop-ink) bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-accent)_22%,white),color-mix(in_oklch,var(--color-pop-secondary)_20%,white)_58%,color-mix(in_oklch,var(--color-pop-pink)_15%,white))] shadow-[2px_2px_0_0_var(--color-pop-ink)] max-[760px]:mb-0 max-[760px]:aspect-[16/9] max-[760px]:min-h-0"
      role="img"
    >
      {imageUrls.length ? (
        <div className="grid h-full min-h-[138px] w-full grid-cols-2 grid-rows-2 gap-1 bg-(--color-pop-ink) p-1 max-[760px]:min-h-0">
          {imageUrls.map((url) => (
            <img
              alt=""
              className={
                imageUrls.length === 1
                  ? "col-span-2 row-span-2 h-full w-full rounded-lg object-cover"
                  : "h-full w-full rounded-lg object-cover"
              }
              key={url}
              loading="lazy"
              onError={() => onImageError(url)}
              src={url}
            />
          ))}
          {imageUrls.length > 1 && imageUrls.length < 4
            ? Array.from({ length: 4 - imageUrls.length }).map((_, index) => (
                <span
                  className="rounded-lg bg-[color-mix(in_oklch,var(--color-pop-card)_82%,var(--color-pop-secondary))]"
                  key={index}
                />
              ))
            : null}
        </div>
      ) : (
        <div className="grid h-full min-h-[138px] place-items-center bg-[radial-gradient(circle_at_28%_22%,color-mix(in_oklch,var(--color-pop-card)_70%,transparent),transparent_28%),linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-accent)_28%,white),color-mix(in_oklch,var(--color-pop-secondary)_20%,white)_58%,color-mix(in_oklch,var(--color-pop-pink)_18%,white))] max-[760px]:min-h-0">
          <span className="grid size-12 place-items-center rounded-xl border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-pop-ink)]">
            <ImageIcon size={22} strokeWidth={2.8} />
          </span>
        </div>
      )}
    </div>
  );
}

export function GatheringsPage({
  gatherings,
  loading,
  message,
  onCreate,
  onDuplicate,
  onLogIn,
  onOpen,
  onShare,
  onStatus,
  recipes,
  sessionUserId,
}: {
  gatherings: Gathering[];
  loading: boolean;
  message: string;
  onCreate: () => void;
  onDuplicate: (id: string) => Promise<Gathering>;
  onLogIn: () => void;
  onOpen: (id: string) => void;
  onShare: (id: string) => void;
  onStatus: (message: string) => void;
  recipes: Recipe[];
  sessionUserId: string | null;
}) {
  const [duplicatingId, setDuplicatingId] = useState<string>();
  const [section, setSection] = useState<GatheringSection>("all");
  const recipesById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const visibleGatherings = useMemo(() => {
    if (section === "drafts") {
      return gatherings.filter((gathering) => gathering.status === "draft");
    }
    if (section === "published") {
      return gatherings.filter((gathering) => gathering.status === "published");
    }
    return gatherings;
  }, [gatherings, section]);
  const emptyTitle =
    section === "drafts"
      ? "No draft gatherings"
      : section === "published"
        ? "No published gatherings"
        : "No gatherings yet";
  const emptyDescription =
    section === "drafts"
      ? "New gathering drafts will appear here before you finish them."
      : section === "published"
        ? "Finished gatherings with guest links will appear here."
        : "Create one from your saved recipes and it will appear here.";

  async function copyGatheringLink(gathering: Gathering) {
    try {
      await navigator.clipboard.writeText(gatheringPublicUrl(gathering));
      onStatus(`Copied link for ${gatheringDisplayTitle(gathering)}`);
    } catch (error) {
      onStatus(`Copy failed: ${errorMessage(error)}`);
    }
  }

  async function duplicateGathering(gathering: Gathering) {
    if (duplicatingId) {
      return;
    }

    setDuplicatingId(gathering.id);
    try {
      const copy = await onDuplicate(gathering.id);
      onStatus(
        `Duplicated ${gatheringDisplayTitle(gathering)} as ${gatheringDisplayTitle(
          copy,
        )}`,
      );
      setDuplicatingId(undefined);
      onOpen(copy.id);
    } catch (error) {
      onStatus(`Duplicate failed: ${errorMessage(error)}`);
      setDuplicatingId(undefined);
    }
  }

  return (
    <section className={gatheringListPageClassName}>
      <header className="flex items-start justify-between gap-[18px] pb-2 max-[860px]:flex-col max-[860px]:items-stretch">
        <div>
          <h1 className="m-0 font-display text-[clamp(34px,3vw,48px)] font-bold leading-[0.94] tracking-normal text-(--color-ink) [text-shadow:2px_2px_0_#fff7d8]">
            {sessionUserId ? "Your gatherings" : "Gatherings"}
          </h1>
          <p className="mx-0 mt-[9px] mb-0 max-w-[590px] text-[15px] font-semibold leading-[1.45] text-(--color-fog)">
            Published menus, invite links, and drafts created from your recipes.
          </p>
        </div>
        <div className="relative mt-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2 max-md:w-full max-md:justify-start">
          <Button
            className={`${gatheringPopButtonClassName} max-md:flex-1`}
            onClick={onCreate}
            variant="secondary"
          >
            <Plus size={16} />
            New gathering
          </Button>
        </div>
      </header>

      {sessionUserId ? (
        // Wrapper absorbs the page's [&>*]:w-full child rule so the
        // segmented control keeps its natural w-fit width.
        <div>
          <GatheringSectionTabs onSelect={setSection} section={section} />
        </div>
      ) : null}

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
              className="grid gap-3 rounded-2xl border-2 border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-5 shadow-pop-sm"
              key={item}
            >
              <span className="h-5 w-2/5 animate-pulse rounded bg-(--color-line)" />
              <span className="h-4 w-4/5 animate-pulse rounded bg-(--color-line)" />
              <span className="h-10 w-full animate-pulse rounded bg-(--color-line)" />
            </div>
          ))}
        </div>
      ) : visibleGatherings.length ? (
        <div className="grid gap-4">
          {visibleGatherings.map((gathering) => (
            <article className={gatheringListCardClassName} key={gathering.id}>
              <GatheringCardArtwork gathering={gathering} recipesById={recipesById} />

              <div className="relative z-10 grid min-w-0 content-between gap-3 p-5 pt-6 pl-1 max-[760px]:p-4">
                <div className="grid min-w-0 gap-2">
                  <div className="flex min-w-0 items-start justify-between gap-3 max-[620px]:grid">
                    <h2 className="m-0 min-w-0 font-display text-[clamp(23px,3vw,30px)] font-black leading-[0.98] text-(--color-pop-ink)">
                      {gatheringDisplayTitle(gathering)}
                    </h2>
                    <span
                      className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border-solid px-3 py-1 text-xs font-black capitalize ${gatheringStatusClassName(
                        gathering.status,
                      )}`}
                    >
                      {gathering.status}
                    </span>
                  </div>
                  <p className="m-0 line-clamp-2 max-w-[66ch] text-[14.5px] font-bold leading-6 text-(--color-pop-muted-ink)">
                    {gatheringDisplayWelcome(gathering)}
                  </p>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={gatheringCompactMetaClassName("menu")}>
                      <BookOpen size={14} strokeWidth={2.6} />
                      {countLabel(gathering.recipeIds.length, "recipe")}
                    </span>
                    <span className={gatheringCompactMetaClassName("invitees")}>
                      <Users size={14} strokeWidth={2.6} />
                      {countLabel(gathering.invitees.length, "person", "people")}
                    </span>
                    <span className={gatheringCompactMetaClassName("date")}>
                      <CalendarDays size={14} strokeWidth={2.6} />
                      {shortDate(gathering.publishedAt ?? gathering.updatedAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      className={gatheringSoftButtonClassName}
                      onClick={() => onOpen(gathering.id)}
                      size="sm"
                    >
                      <Pencil size={15} />
                      Edit
                    </Button>
                    {gathering.status === "published" ? (
                      <Button
                        className={gatheringPopButtonClassName}
                        onClick={() => onShare(gathering.id)}
                        size="sm"
                      >
                        <Share2 size={15} />
                        Share
                      </Button>
                    ) : null}
                    <GatheringActionsMenu
                      duplicating={duplicatingId === gathering.id}
                      gathering={gathering}
                      onCopyLink={copyGatheringLink}
                      onDuplicate={duplicateGathering}
                      onOpen={onOpen}
                      onShare={onShare}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="grid gap-3 rounded-lg border border-dashed border-(--color-pop-ink) bg-(--color-pop-card) p-6 text-center shadow-pop-sm">
          <h2 className="m-0 text-xl font-black text-(--color-pop-ink)">
            {emptyTitle}
          </h2>
          <p className="m-0 text-sm font-semibold leading-6 text-(--color-pop-muted-ink)">
            {emptyDescription}
          </p>
          <div className="flex justify-center">
            <Button
              className={gatheringPopButtonClassName}
              onClick={onCreate}
              variant="secondary"
            >
              <Plus size={16} />
              New gathering
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}

function parseInviteeEmails(value: string | string[] | null | undefined) {
  const text = Array.isArray(value) ? value.join("\n") : (value ?? "");

  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function formatInviteeEmails(emails: string[]) {
  return parseInviteeEmails(emails).join("\n");
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function inviteeEmailsText(gathering: Gathering) {
  return gathering.invitees.map((invitee) => invitee.email).join("\n");
}

function gatheringDisplayTitle(gathering: Gathering) {
  return gathering.title.trim() || "Untitled gathering";
}

function gatheringDisplayWelcome(gathering: Gathering) {
  return gathering.welcome.trim() || "Add a welcome note before publishing.";
}

function gatheringEditorPayload(input: {
  dietary: string;
  guestQuestion: string;
  inviteeEmails?: string | string[];
  prompt: string;
  recipeIds: string[];
  title: string;
  welcome: string;
}): SaveGatheringPayload {
  const payload: SaveGatheringPayload = {
    dietary: input.dietary.trim(),
    guestQuestion: input.guestQuestion.trim(),
    prompt: input.prompt.trim(),
    recipeIds: input.recipeIds,
    title: input.title.trim(),
    welcome: input.welcome.trim(),
  };

  if (input.inviteeEmails !== undefined) {
    payload.inviteeEmails = parseInviteeEmails(input.inviteeEmails);
  }

  return payload;
}

function gatheringPayloadKey(payload: SaveGatheringPayload) {
  return JSON.stringify(payload);
}

function gatheringPersistedPayload(gathering: Gathering): SaveGatheringPayload {
  return gatheringEditorPayload({
    dietary: gathering.dietary ?? "",
    guestQuestion: gathering.guestQuestion,
    prompt: gathering.prompt ?? "",
    recipeIds: gathering.recipeIds,
    title: gathering.title,
    welcome: gathering.welcome,
  });
}

function GatheringArtifactProgressPanel({
  gathering,
}: {
  gathering: WorkspaceGathering;
}) {
  if (gathering.status !== "published") {
    return null;
  }

  if (!gatheringHasArtifactDetails(gathering)) {
    return (
      <section
        aria-live="polite"
        className={`${gatheringPanelClassName} gap-4 p-5 pt-7`}
      >
        <div className={gatheringPanelHeaderClassName}>
          <span className={gatheringPanelTitleClassName}>
            <span className={gatheringPanelIconClassName}>
              <Sparkles size={16} strokeWidth={3} />
            </span>
            Media progress
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-accent)_24%,white)] px-3 py-1 text-xs font-black text-[#7b4d08] shadow-[2px_2px_0_0_var(--color-pop-ink)]">
            <Loader2 className="animate-spin" size={13} />
            Loading
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-(--color-line) bg-(--color-panel)">
          <div className="h-full w-1/5 animate-pulse rounded-full bg-(--color-pop-accent)" />
        </div>
        <div className="grid gap-2">
          {[
            "Hero artwork",
            "Menu artwork",
            "Reply artwork",
            "Welcome audio",
            "Video teaser",
          ].map((label) => (
            <div
              className="grid min-h-[54px] grid-cols-[36px_minmax(0,1fr)_92px] items-center gap-3 rounded-xl border-2 border-solid border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-(--color-panel) p-2.5 max-[620px]:grid-cols-[36px_minmax(0,1fr)]"
              key={label}
            >
              <span className="size-9 animate-pulse rounded-lg bg-(--color-line)" />
              <span className="h-4 w-3/5 animate-pulse rounded bg-(--color-line)" />
              <span className="h-7 animate-pulse rounded-full bg-(--color-line) max-[620px]:col-start-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const progress = gatheringArtifactProgress(gathering.artifacts);
  const progressSummary =
    progress.total === 0
      ? "Preparing jobs"
      : progress.active
        ? `${progress.complete} of ${progress.total} complete`
        : progress.failed
          ? `${progress.ready} ready, ${progress.failed} failed`
          : progress.skipped
            ? `${progress.ready} ready, ${progress.skipped} skipped`
            : "All media ready";
  const progressWidthClassName = gatheringArtifactProgressWidthClassName(progress);

  return (
    <section aria-live="polite" className={`${gatheringPanelClassName} gap-4 p-5 pt-7`}>
      <div className={gatheringPanelHeaderClassName}>
        <span className={gatheringPanelTitleClassName}>
          <span className={gatheringPanelIconClassName}>
            <Sparkles size={16} strokeWidth={3} />
          </span>
          Media progress
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-(--color-pop-ink) bg-(--color-pop-card) px-3 py-1 text-xs font-black text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-pop-ink)]">
          {progress.active ? (
            <Loader2 className="animate-spin" size={13} />
          ) : progress.failed ? (
            <AlertTriangle size={13} />
          ) : (
            <CheckCircle2 size={13} />
          )}
          {progressSummary}
        </span>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-[12px] font-extrabold uppercase text-(--color-pop-muted-ink)">
          <span>Generated assets</span>
          <span>{progress.percent}%</span>
        </div>
        <div
          aria-label="Gathering media generation progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress.percent}
          className="h-3 overflow-hidden rounded-full border border-(--color-line) bg-(--color-panel)"
          role="progressbar"
        >
          <div
            className={`${progressWidthClassName} h-full rounded-full bg-[linear-gradient(90deg,var(--color-pop-accent),var(--color-pop-secondary),var(--color-pop-pink))] transition-all duration-500`}
          />
        </div>
      </div>

      {gathering.artifacts.length ? (
        <div className="grid gap-2">
          {gathering.artifacts.map((artifact) => {
            const Icon = gatheringArtifactKindIcon(artifact.kind);
            const StatusIcon =
              artifact.status === "ready"
                ? CheckCircle2
                : artifact.status === "failed"
                  ? AlertTriangle
                  : artifact.status === "skipped"
                    ? X
                    : artifact.status === "pending"
                      ? Clock3
                      : Loader2;

            return (
              <div
                className="grid min-h-[62px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-2 border-solid border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-(--color-panel) p-2.5 text-(--color-pop-ink) max-[620px]:grid-cols-[38px_minmax(0,1fr)]"
                key={artifact.id}
              >
                <span className="grid size-9 place-items-center rounded-lg border-2 border-(--color-pop-ink) bg-(--color-pop-card) text-(--color-pop-primary) shadow-[1px_1px_0_0_var(--color-pop-ink)]">
                  <Icon size={16} strokeWidth={2.7} />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-black leading-tight">
                    {artifact.label}
                  </span>
                  <span className="truncate text-[12px] font-bold text-(--color-pop-muted-ink)">
                    {artifact.error ??
                      (artifact.status === "ready" && artifact.mediaUrl
                        ? "Ready for the guest page"
                        : artifact.model || artifact.provider)}
                  </span>
                </span>
                <span
                  className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border-2 border-solid px-2.5 text-[12px] font-black max-[620px]:col-start-2 ${gatheringArtifactStatusClassName(
                    artifact.status,
                  )}`}
                >
                  <StatusIcon
                    className={
                      artifact.status === "submitted" ? "animate-spin" : undefined
                    }
                    size={13}
                    strokeWidth={3}
                  />
                  {gatheringArtifactStatusLabel(artifact.status)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="m-0 rounded-lg border border-dashed border-(--color-line) bg-(--color-panel) p-3 text-[13px] font-bold leading-5 text-(--color-pop-muted-ink)">
          Media generation is being prepared.
        </p>
      )}
    </section>
  );
}

export function GatheringEditorPage({
  gathering,
  loading,
  message,
  onBackToGatherings,
  onDuplicate,
  onOpenDuplicate,
  onPublish,
  onSave,
  onStatus,
  recipes,
}: {
  gathering?: WorkspaceGathering;
  loading: boolean;
  message: string;
  onBackToGatherings: () => void;
  onDuplicate: (id: string) => Promise<WorkspaceGathering>;
  onOpenDuplicate: (id: string) => void;
  onPublish: (
    id: string,
    payload: SaveGatheringPayload,
  ) => Promise<PublishGatheringResult>;
  onSave: (id: string, payload: SaveGatheringPayload) => Promise<WorkspaceGathering>;
  onStatus: (message: string) => void;
  recipes: Recipe[];
}) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [welcome, setWelcome] = useState("");
  const [dietary, setDietary] = useState("");
  const [guestQuestion, setGuestQuestion] = useState("");
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibleRecipeCount, setVisibleRecipeCount] = useState(
    gatheringRecipePickerPageSize,
  );
  const [hydratedGatheringId, setHydratedGatheringId] = useState<string | undefined>();
  const [draftSaveState, setDraftSaveState] = useState<SaveState>("idle");
  const [autoSaveRetryToken, setAutoSaveRetryToken] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [fillingDraft, setFillingDraft] = useState(false);
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
    setPrompt(gathering.prompt ?? "");
    setWelcome(gathering.welcome);
    setDietary(gathering.dietary ?? "");
    setGuestQuestion(gathering.guestQuestion);
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
  const orderedMatchingRecipes = useMemo(
    () => gatheringRecipePickerSelectedFirst(matchingRecipes, recipeIds),
    [matchingRecipes, recipeIds],
  );
  const autoPickRecipeIds = useMemo(
    () => gatheringRecipePickerAutoPickIds(matchingRecipes),
    [matchingRecipes],
  );
  const visibleMatchingRecipes = useMemo(
    () => orderedMatchingRecipes.slice(0, visibleRecipeCount),
    [orderedMatchingRecipes, visibleRecipeCount],
  );
  const hasMoreMatchingRecipes =
    visibleMatchingRecipes.length < orderedMatchingRecipes.length;
  const hasAutoPickRecipes = matchingRecipes.length > 0;
  const draftPayload = useMemo(
    () =>
      gatheringEditorPayload({
        dietary,
        guestQuestion,
        prompt,
        recipeIds,
        title,
        welcome,
      }),
    [dietary, guestQuestion, prompt, recipeIds, title, welcome],
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
  const canFillDraft = Boolean(title.trim()) && !fillingDraft && !publishing && !saving;
  const canPublish =
    Boolean(gathering) &&
    hasRecipe &&
    Boolean(title.trim()) &&
    Boolean(welcome.trim()) &&
    Boolean(guestQuestion.trim()) &&
    !fillingDraft &&
    !publishing &&
    !saving;
  const canDuplicate =
    Boolean(gathering) && !duplicating && !fillingDraft && !publishing && !saving;
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
      fillingDraft ||
      publishing ||
      saveInFlightRef.current ||
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
    fillingDraft,
    gathering,
    hydratedGatheringId,
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

  async function fillDraftFromTitle() {
    const draftTitle = title.trim();
    if (!draftTitle) {
      onStatus("Add a page title first.");
      return;
    }
    if (recipeIds.length === 0 && recipes.length === 0) {
      onStatus("Add recipes first.");
      return;
    }

    const dietaryHint = gatheringTitleDietaryHints(draftTitle);
    const promptForDraft = gatheringDraftAssistPrompt(prompt, draftTitle);
    let nextRecipeIds = recipeIds;
    let pickedRecipeCount = 0;

    setFillingDraft(true);
    try {
      if (nextRecipeIds.length === 0) {
        const recommendation = await api.recommendGatheringRecipes({
          candidateRecipeIds: recipes.map((recipe) => recipe.id),
          count: gatheringRecipeAutoPickCount,
          dietary: dietary.trim() || dietaryHint || undefined,
          guestQuestion: guestQuestion.trim() || undefined,
          prompt: promptForDraft || undefined,
          title: draftTitle,
        });
        if (!editorMountedRef.current) {
          return;
        }

        const liveRecipeIds = latestDraftPayloadRef.current.recipeIds ?? [];
        nextRecipeIds = liveRecipeIds.length ? liveRecipeIds : recommendation.recipeIds;
        pickedRecipeCount = liveRecipeIds.length ? 0 : recommendation.recipeIds.length;

        if (nextRecipeIds.length === 0) {
          onStatus(
            recommendation.rejectedCount
              ? "No recipes fit your saved preferences."
              : "No recipes available for this draft.",
          );
          return;
        }

        setRecipeIds((current) => (current.length ? current : nextRecipeIds));
      }

      const draft = await api.generateGatheringDraft({
        dietary: dietary.trim() || dietaryHint || undefined,
        guestQuestion: guestQuestion.trim() || undefined,
        prompt: promptForDraft || undefined,
        recipeIds: nextRecipeIds,
        title: draftTitle,
      });
      if (!editorMountedRef.current) {
        return;
      }

      setPrompt((current) => gatheringDraftAssistPrompt(current, draftTitle));
      setWelcome((current) => gatheringDraftAssistFieldValue(current, draft.welcome));
      setGuestQuestion((current) =>
        gatheringDraftAssistFieldValue(current, draft.guestQuestion),
      );
      if (dietaryHint) {
        setDietary((current) => gatheringDraftAssistFieldValue(current, dietaryHint));
      }
      setRecipeIds((current) => (current.length ? current : nextRecipeIds));

      onStatus(
        pickedRecipeCount
          ? `Draft filled and picked ${countLabel(pickedRecipeCount, "recipe")}`
          : "Draft filled",
      );
    } catch (error) {
      if (editorMountedRef.current) {
        onStatus(`Draft fill failed: ${errorMessage(error)}`);
      }
    } finally {
      if (editorMountedRef.current) {
        setFillingDraft(false);
      }
    }
  }

  function showMoreRecipes() {
    setVisibleRecipeCount((current) =>
      nextGatheringRecipePickerCount(current, orderedMatchingRecipes.length),
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

    setPublishing(true);
    try {
      const result = await onPublish(gathering.id, currentPayload());
      const progressMessage = gatheringHasActiveArtifacts(result.gathering)
        ? "Gathering published. Media generation is running."
        : "Gathering published.";
      onStatus(progressMessage);
    } catch (error) {
      onStatus(`Publishing failed: ${errorMessage(error)}`);
    } finally {
      setPublishing(false);
    }
  }

  async function duplicateGathering() {
    if (!gathering || duplicating || saving) {
      return;
    }

    let saveAttempted = false;
    let saveCompleted = false;
    setDuplicating(true);
    try {
      if (hasUnsavedGatheringChanges) {
        saveAttempted = true;
        setDraftSaveState("saving");
        await onSave(gathering.id, currentPayload());
        saveCompleted = true;
        setDraftSaveState("saved");
      }
      const copy = await onDuplicate(gathering.id);
      onStatus(`Duplicated as ${gatheringDisplayTitle(copy)}`);
      if (editorMountedRef.current) {
        setDuplicating(false);
      }
      onOpenDuplicate(copy.id);
    } catch (error) {
      if (saveAttempted && !saveCompleted && editorMountedRef.current) {
        setDraftSaveState("error");
      }
      onStatus(`Duplicate failed: ${errorMessage(error)}`);
      if (editorMountedRef.current) {
        setDuplicating(false);
      }
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
        description="Edit the menu, guest page copy, and publishing state for this gathering."
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
        <Button
          className={gatheringSoftButtonClassName}
          disabled={!canDuplicate}
          onClick={() => void duplicateGathering()}
          size="sm"
          variant="secondary"
        >
          {duplicating ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Copy size={16} />
          )}
          Duplicate
        </Button>
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
        {gathering.status === "draft" ? (
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
            Finish gathering
          </Button>
        ) : null}
      </WorkspaceHeader>

      {message !== "Ready" && !shouldHideRoutineGatheringStatus ? (
        <p className={inlineStatusClassName}>
          <CheckCircle2 size={16} />
          {message}
        </p>
      ) : null}

      <GatheringArtifactProgressPanel gathering={gathering} />

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

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[640px]:grid-cols-1">
            <GatheringField className="min-w-0" label="Page title">
              <textarea
                className="min-h-11!"
                onChange={(event) => setTitle(event.target.value)}
                placeholder={gatheringBuildPlaceholders.title}
                rows={1}
                value={title}
              />
            </GatheringField>
            <button
              className="grid min-h-[72px] min-w-[142px] grid-cols-[30px_minmax(0,1fr)] items-center gap-2 rounded-xl border-2 border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-accent)_24%,white)] px-3 text-left text-sm font-black text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-pop-ink)] transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px enabled:hover:bg-[color-mix(in_oklch,var(--color-pop-secondary)_20%,white)] disabled:cursor-not-allowed disabled:opacity-50 max-[640px]:min-h-12"
              disabled={!canFillDraft}
              onClick={() => void fillDraftFromTitle()}
              type="button"
            >
              <span className="grid size-8 place-items-center rounded-lg border-2 border-(--color-pop-ink) bg-(--color-panel) text-(--color-tomato)">
                {fillingDraft ? (
                  <Loader2 className="animate-spin" size={16} strokeWidth={3} />
                ) : (
                  <Sparkles size={16} strokeWidth={3} />
                )}
              </span>
              <span className="min-w-0 leading-tight">
                {fillingDraft ? "Filling" : "Fill draft"}
              </span>
            </button>
          </div>

          <GatheringField label="Welcome note">
            <textarea
              className="min-h-[118px]!"
              onChange={(event) => setWelcome(event.target.value)}
              placeholder="Welcome to the gathering. Pick what sounds good and tell us what you need."
              value={welcome}
            />
            <DictationControl onValueChange={setWelcome} value={welcome} />
          </GatheringField>

          <GatheringField label="Creative direction">
            <textarea
              className="min-h-[92px]!"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={gatheringBuildPlaceholders.prompt}
              value={prompt}
            />
            <DictationControl onValueChange={setPrompt} value={prompt} />
          </GatheringField>

          <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
            <GatheringField label="Dietary notes">
              <textarea
                className="min-h-11!"
                onChange={(event) => setDietary(event.target.value)}
                placeholder={gatheringBuildPlaceholders.dietary}
                rows={1}
                value={dietary}
              />
              <DictationControl onValueChange={setDietary} value={dietary} />
            </GatheringField>
            <GatheringField label="Guest question">
              <textarea
                className="min-h-[64px]!"
                onChange={(event) => setGuestQuestion(event.target.value)}
                placeholder={gatheringBuildPlaceholders.guestQuestion}
                value={guestQuestion}
              />
              <DictationControl
                onValueChange={setGuestQuestion}
                value={guestQuestion}
              />
            </GatheringField>
          </div>
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

            <VoiceSearchInput
              aria-label="Search recipes"
              containerClassName="relative"
              inputClassName="min-h-11 w-full rounded-xl border-2 border-solid border-[color-mix(in_oklch,var(--color-line)_82%,white)] bg-(--color-panel) pr-12 pl-9 text-sm font-bold text-(--color-ink) outline-none transition placeholder:text-[#9a8f80] focus:border-(--color-pop-primary) focus:shadow-[3px_3px_0_0_var(--color-pop-accent)]"
              micButtonClassName="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg border-2 border-(--color-pop-ink) bg-(--color-panel) text-(--color-pop-ink) transition hover:bg-[color-mix(in_oklch,var(--color-pop-accent)_28%,white)]"
              activeMicButtonClassName="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)"
              onValueChange={setQuery}
              placeholder="Search recipes"
              searchIconClassName="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#9a8f80]"
              searchIconSize={15}
              statusClassName="m-0 text-[11.5px] font-black leading-snug text-(--color-tomato-dark)"
              value={query}
            />

            <button
              className="grid min-h-[58px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border-2 border-[color-mix(in_oklch,var(--color-pop-accent)_68%,var(--color-line))] bg-[color-mix(in_oklch,var(--color-pop-accent)_18%,white)] p-2.5 text-left text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-pop-ink)] transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px disabled:opacity-50"
              disabled={!hasAutoPickRecipes || pickingRecipes || fillingDraft}
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
        </aside>
      </div>
    </section>
  );
}

export function GatheringSharePage({
  gathering,
  loading,
  message,
  onBackToEditor,
  onBackToGatherings,
  onSendInvites,
  onStatus,
}: {
  gathering?: Gathering;
  loading: boolean;
  message: string;
  onBackToEditor: (id: string) => void;
  onBackToGatherings: () => void;
  onSendInvites: (
    id: string,
    inviteeEmails: string[],
  ) => Promise<SendGatheringInvitesResult>;
  onStatus: (message: string) => void;
}) {
  const [inviteeEmails, setInviteeEmails] = useState(() =>
    gathering ? inviteeEmailsText(gathering) : "",
  );
  const [sending, setSending] = useState(false);

  const publicLink =
    gathering?.status === "published" ? gatheringPublicUrl(gathering) : "";
  const inviteeEmailList = useMemo(
    () => parseInviteeEmails(inviteeEmails),
    [inviteeEmails],
  );
  const invalidEmails = useMemo(
    () => inviteeEmailList.filter((email) => !looksLikeEmail(email)),
    [inviteeEmailList],
  );
  const sentInviteeEmailSet = useMemo(
    () =>
      new Set(
        (gathering?.invitees ?? [])
          .filter((invitee) => Boolean(invitee.sentAt))
          .map((invitee) => invitee.email.toLowerCase()),
      ),
    [gathering?.invitees],
  );
  const unsentInviteeEmails = useMemo(
    () => inviteeEmailList.filter((email) => !sentInviteeEmailSet.has(email)),
    [inviteeEmailList, sentInviteeEmailSet],
  );
  const savedInviteeEmails = useMemo(
    () =>
      gathering
        ? formatInviteeEmails(gathering.invitees.map((invitee) => invitee.email))
        : "",
    [gathering],
  );
  const normalizedInviteeEmails = useMemo(
    () => formatInviteeEmails(inviteeEmailList),
    [inviteeEmailList],
  );
  const hasInviteeChanges = normalizedInviteeEmails !== savedInviteeEmails;
  const canSaveInvitees =
    Boolean(gathering && publicLink) &&
    invalidEmails.length === 0 &&
    (unsentInviteeEmails.length > 0 || hasInviteeChanges) &&
    !sending;

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

  async function saveInvitees() {
    if (!gathering || !publicLink) {
      onStatus("Finish the gathering before inviting people.");
      return;
    }
    if (invalidEmails.length) {
      onStatus(`Check ${invalidEmails[0]}.`);
      return;
    }
    if (!hasInviteeChanges && unsentInviteeEmails.length === 0) {
      onStatus("Invitees already saved");
      return;
    }

    setSending(true);
    try {
      const result = await onSendInvites(gathering.id, inviteeEmailList);
      onStatus(
        result.sentCount
          ? `Sent guest page to ${countLabel(result.sentCount, "invitee")}`
          : "Invitees saved",
      );
    } catch (error) {
      onStatus(`Sharing failed: ${errorMessage(error)}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <section className={gatheringPageClassName}>
        <WorkspaceHeader
          description="Loading the share page."
          icon={<Share2 size={25} />}
          onBack={onBackToGatherings}
          title="Share gathering"
        />
        <div className="grid gap-3 rounded-lg border border-solid border-(--color-line) bg-(--color-pop-card) p-5 shadow-pop-sm">
          <span className="h-6 w-1/2 animate-pulse rounded bg-(--color-line)" />
          <span className="h-4 w-4/5 animate-pulse rounded bg-(--color-line)" />
          <span className="h-24 w-full animate-pulse rounded bg-(--color-line)" />
        </div>
      </section>
    );
  }

  if (!gathering) {
    return (
      <section className={gatheringPageClassName}>
        <WorkspaceHeader
          description="Choose an existing gathering before sharing."
          icon={<Share2 size={25} />}
          onBack={onBackToGatherings}
          title="Gathering not found"
        />
      </section>
    );
  }

  if (gathering.status !== "published") {
    return (
      <section className={gatheringPageClassName}>
        <WorkspaceHeader
          description="Finish the gathering before inviting people."
          icon={<Share2 size={25} />}
          onBack={onBackToGatherings}
          title="Share gathering"
        >
          <Button onClick={() => onBackToEditor(gathering.id)} size="sm">
            <Pencil size={15} />
            Edit gathering
          </Button>
        </WorkspaceHeader>
      </section>
    );
  }

  return (
    <section className={gatheringPageClassName}>
      <WorkspaceHeader
        description="Copy the public page link or email it to invitees."
        icon={<Share2 size={25} />}
        onBack={() => onBackToEditor(gathering.id)}
        title={`Share ${gatheringDisplayTitle(gathering)}`}
      >
        <a
          className={buttonClassName({ size: "sm", variant: "secondary" })}
          href={gatheringPublicPath(gathering)}
          target="_blank"
          rel="noopener"
        >
          <ExternalLink size={15} />
          Open page
        </a>
      </WorkspaceHeader>

      {message !== "Ready" ? (
        <p className={inlineStatusClassName}>
          <CheckCircle2 size={16} />
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(360px,0.68fr)] gap-4 max-[880px]:grid-cols-1">
        <section className={`${gatheringPanelClassName} gap-4 p-5 pt-7`}>
          <div className={gatheringPanelHeaderClassName}>
            <span className={gatheringPanelTitleClassName}>
              <span className={gatheringPanelIconClassName}>
                <Share2 size={16} strokeWidth={3} />
              </span>
              Link
            </span>
            <span className="text-xs font-extrabold text-(--color-pop-muted-ink)">
              Published {shortDate(gathering.publishedAt ?? gathering.updatedAt)}
            </span>
          </div>
          <div className="grid gap-2 rounded-xl border border-solid border-(--color-line) bg-(--color-panel) p-3">
            <span className="text-xs font-black uppercase text-(--color-pop-muted-ink)">
              Guest page link
            </span>
            <input
              className="min-h-11 min-w-0 rounded-lg border border-solid border-(--color-line) bg-(--color-pop-card) px-3 text-sm font-semibold text-(--color-pop-muted-ink)"
              readOnly
              value={publicLink}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void copyPublicLink()} size="sm">
                <Copy size={15} />
                Copy link
              </Button>
              <a
                className={buttonClassName({ size: "sm", variant: "secondary" })}
                href={gatheringPublicPath(gathering)}
                target="_blank"
                rel="noopener"
              >
                <ExternalLink size={15} />
                Open page
              </a>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-solid border-(--color-line) bg-(--color-panel) p-3">
            <span className="text-xs font-black uppercase text-(--color-pop-muted-ink)">
              Gathering
            </span>
            <strong className="text-lg leading-tight text-(--color-pop-ink)">
              {gatheringDisplayTitle(gathering)}
            </strong>
            <p className="m-0 line-clamp-3 text-sm font-semibold leading-6 text-(--color-pop-muted-ink)">
              {gatheringDisplayWelcome(gathering)}
            </p>
          </div>
        </section>

        <aside className={`${gatheringPanelClassName} content-start gap-4 p-5 pt-7`}>
          <div className={gatheringPanelHeaderClassName}>
            <span className={gatheringPanelTitleClassName}>
              <span className={gatheringPanelIconClassName}>
                <Mail size={16} strokeWidth={3} />
              </span>
              Invitees
            </span>
            <span
              className={
                invalidEmails.length
                  ? "rounded-full border border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_8%,white)] px-2.5 py-1 text-xs font-extrabold text-(--color-tomato-dark)"
                  : "rounded-full border border-(--color-line) bg-(--color-panel) px-2.5 py-1 text-xs font-extrabold text-(--color-pop-muted-ink)"
              }
            >
              {countLabel(inviteeEmailList.length, "invitee")}
            </span>
          </div>

          <GatheringField label="Invitee emails">
            <textarea
              className="min-h-[164px]!"
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

          <div className="grid gap-1.5 rounded-xl border border-solid border-(--color-line) bg-(--color-panel) p-3 text-sm font-bold leading-6 text-(--color-ink)">
            <span>{countLabel(sentInviteeEmailSet.size, "sent invite")}</span>
            <span>{countLabel(unsentInviteeEmails.length, "unsent invite")}</span>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-solid border-(--color-line) pt-3">
            <Button
              disabled={!canSaveInvitees}
              onClick={() => void saveInvitees()}
              size="sm"
              variant="primary"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {unsentInviteeEmails.length
                ? `Send ${countLabel(unsentInviteeEmails.length, "invite")}`
                : "Save invitees"}
            </Button>
          </div>
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
  const navigate = useNavigate();
  const location = useLocation({
    select: (current) => ({
      pathname: current.pathname,
      search: current.search as WorkspaceSearchState,
    }),
  });
  const appSearch = location.search;
  const initialRouteState = workspaceRouteStateFromLocation(
    location.pathname,
    appSearch,
  );
  const { session, sessionError, sessionLoading, openAuth, refreshSession, signOut } =
    useSession();
  const [page, setPage] = useState<Page>(initialRouteState.page);
  const [addMode, setAddMode] = useState(initialRouteState.addMode);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [gatherings, setGatherings] = useState<WorkspaceGathering[]>([]);
  const [gatheringsLoading, setGatheringsLoading] = useState(false);
  const [selectedGatheringId, setSelectedGatheringId] = useState<string | undefined>(
    initialRouteState.selectedGatheringId,
  );
  const [selectedCookbookId, setSelectedCookbookId] = useState<string | undefined>(
    initialRouteState.selectedCookbookId,
  );
  const [selectedGatheringSnapshot, setSelectedGatheringSnapshot] =
    useState<WorkspaceGathering>();
  const [selectedGatheringLoadFailedId, setSelectedGatheringLoadFailedId] =
    useState<string>();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialRouteState.selectedRecipeId ?? appSearch.recipe,
  );
  const [persistedVisibilityById, setPersistedVisibilityById] = useState<
    Record<string, RecipeVisibility>
  >({});
  const [draft, setDraft] = useState<Recipe>(emptyRecipe);
  const [mode, setMode] = useState<"view" | "edit">(
    initialRouteState.recipeMode ?? "view",
  );
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
    if (!addMode && page === "cookbooks") {
      return selectedCookbookId ? { cookbook: selectedCookbookId } : {};
    }

    if (!addMode && page === "recipes") {
      if (section === "mine") {
        return {};
      }

      return {
        section,
        ...(sharedSelectedKey ? { browse: sharedSelectedKey } : {}),
      };
    }

    return {};
  }, [addMode, page, section, selectedCookbookId, selectedId, sharedSelectedKey]);

  const workspaceDestination = useMemo(
    () =>
      workspaceDestinationForState({
        addMode,
        page,
        recipeMode: mode,
        search: workspaceSearch,
        selectedCookbookId,
        selectedRecipeId: section === "mine" ? selectedId : undefined,
        selectedGatheringId,
      }),
    [
      addMode,
      mode,
      page,
      section,
      selectedCookbookId,
      selectedGatheringId,
      selectedId,
      workspaceSearch,
    ],
  );

  const routeState = useMemo(
    () => workspaceRouteStateFromLocation(location.pathname, appSearch),
    [appSearch, location.pathname],
  );

  useEffect(() => {
    const routeRecipeId = routeState.selectedRecipeId ?? appSearch.recipe;
    const nextSection = routeRecipeId ? "mine" : searchSection(appSearch);
    const nextSelectedId = routeRecipeId;
    const nextMode = routeState.recipeMode ?? "view";
    const nextSharedSelectedKey = appSearch.browse;
    const canonicalDestination = workspaceDestinationForState({
      ...routeState,
      recipeMode: nextMode,
      search:
        !routeState.addMode && routeState.page === "recipes"
          ? nextSection === "mine"
            ? {}
            : {
                section: nextSection,
                ...(nextSharedSelectedKey ? { browse: nextSharedSelectedKey } : {}),
              }
          : {},
      selectedRecipeId: nextSection === "mine" ? nextSelectedId : undefined,
    });

    applyingUrlStateRef.current = true;
    setPage(routeState.page);
    setAddMode(routeState.addMode);
    setSection(nextSection);
    setSelectedCookbookId(routeState.selectedCookbookId);
    setSelectedGatheringId(routeState.selectedGatheringId);
    setSelectedId(nextSelectedId);
    setMode(nextMode);
    setSharedSelectedKey(nextSharedSelectedKey);

    if (
      !workspaceLocationMatchesDestination(
        location.pathname,
        appSearch,
        canonicalDestination,
      )
    ) {
      void navigate({
        replace: true,
        resetScroll: false,
        search: canonicalDestination.search,
        to: canonicalDestination.pathname,
      } as never);
    }
  }, [
    appSearch.browse,
    appSearch.gathering,
    appSearch.page,
    appSearch.recipe,
    appSearch.section,
    location.pathname,
    navigate,
    routeState,
  ]);

  useEffect(() => {
    if (applyingUrlStateRef.current) {
      applyingUrlStateRef.current = false;
      return;
    }

    if (
      workspaceLocationMatchesDestination(
        location.pathname,
        appSearch,
        workspaceDestination,
      )
    ) {
      return;
    }

    void navigate({
      replace: true,
      resetScroll: false,
      search: workspaceDestination.search,
      to: workspaceDestination.pathname,
    } as never);
  }, [appSearch, location.pathname, navigate, workspaceDestination]);

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
    (page === "gathering" || page === "gathering-share") &&
    selectedGatheringId &&
    !selectedGathering &&
    selectedGatheringLoadFailedId !== selectedGatheringId,
  );
  const selectedRecipe = useMemo(
    () =>
      visibleRecipes.find((recipe) => recipe.id === selectedId) ?? visibleRecipes[0],
    [visibleRecipes, selectedId],
  );
  // A recipe deep link can resolve to nothing: the recipe was deleted, it
  // belongs to someone else, or the visitor is signed out. Once the session/list
  // settle, show a clear "not found" page instead of redirecting elsewhere.
  const recipeParam = routeState.selectedRecipeId ?? appSearch.recipe;
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
    setSelectedCookbookId(undefined);
  }, []);

  const openCookbookPage = useCallback((cookbookId: string) => {
    setPage("cookbooks");
    setAddMode(false);
    setSelectedCookbookId(cookbookId);
  }, []);

  const upsertGathering = useCallback((gathering: WorkspaceGathering) => {
    gatheringRequestIdRef.current += 1;
    setGatheringsLoading(false);
    setSelectedGatheringSnapshot((current) =>
      current?.id === gathering.id
        ? mergeWorkspaceGathering(current, gathering)
        : current,
    );
    setSelectedGatheringLoadFailedId((current) =>
      current === gathering.id ? undefined : current,
    );
    setGatherings((current) => {
      const next = current.some((item) => item.id === gathering.id)
        ? current.map((item) =>
            item.id === gathering.id ? mergeWorkspaceGathering(item, gathering) : item,
          )
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

  const openGatheringShare = useCallback((id: string) => {
    setSelectedGatheringLoadFailedId(undefined);
    setSelectedGatheringId(id);
    setPage("gathering-share");
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

  const sendGatheringInvites = useCallback(
    async (id: string, inviteeEmails: string[]) => {
      const result = await api.sendGatheringInvites(id, { inviteeEmails });
      upsertGathering(result.gathering);
      return result;
    },
    [upsertGathering],
  );

  async function duplicateGathering(id: string) {
    if (!ensureSignedIn("duplicate gatherings")) {
      throw new Error("Log in to duplicate gatherings.");
    }

    const copy = await api.duplicateGathering(id);
    setSelectedGatheringSnapshot(copy);
    upsertGathering(copy);
    return copy;
  }

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
          ? `Added “${recipe.title}” to ${gatheringDisplayTitle(saved)}`
          : `Removed “${recipe.title}” from ${gatheringDisplayTitle(saved)}`,
      );
    } catch (error) {
      setMessage(`Updating gathering failed: ${errorMessage(error)}`);
    }
  }

  // Logged-out visitors only have the public Explore shelf. There is no
  // "Yours" or "Shared with you" for them. So keep them on Explore — unless a
  // recipe deep link is present, which routes to the not-found page.
  useEffect(() => {
    if (sessionLoading || sessionUserId || recipeParam) {
      return;
    }
    setSection("explore");
  }, [recipeParam, sessionLoading, sessionUserId]);

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
      // library shelf rather than auto-opening the first recipe. Route-selected
      // ids are preserved even when missing so the not-found page can render.
      setSelectedId((current) => {
        const nextSelected = current ?? recipeParam;
        if (!nextSelected) {
          return undefined;
        }

        if (nextRecipes.some((recipe) => recipe.id === nextSelected)) {
          return nextSelected;
        }

        return recipeParam === nextSelected ? nextSelected : undefined;
      });
    },
    [recipeParam, sessionUserId],
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
        setGatherings((current) => {
          const currentById = new Map(current.map((item) => [item.id, item]));
          return nextGatherings.map((gathering) => {
            const currentGathering = currentById.get(gathering.id);
            return currentGathering
              ? mergeWorkspaceGathering(currentGathering, gathering)
              : gathering;
          });
        });
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
    const isGatheringPage =
      page === "gathering" ||
      page === "gathering-share" ||
      page === "gathering-generating";
    if (
      sessionLoading ||
      !sessionUserId ||
      !isGatheringPage ||
      !selectedGatheringId ||
      selectedGatheringLoadFailedId === selectedGatheringId
    ) {
      return;
    }

    const needsDetailLoad =
      !selectedGathering || !gatheringHasArtifactDetails(selectedGathering);
    const needsProgressPoll = gatheringHasActiveArtifacts(selectedGathering);
    if (!needsDetailLoad && !needsProgressPoll) {
      return;
    }

    let cancelled = false;
    const loadingGatheringId = selectedGatheringId;
    const timeout = needsDetailLoad
      ? window.setTimeout(() => {
          if (!cancelled) {
            setSelectedGatheringLoadFailedId(loadingGatheringId);
            setMessage("Loading gathering timed out. Reload the page and try again.");
          }
        }, 10_000)
      : undefined;
    setSelectedGatheringLoadFailedId(undefined);

    const loadSelectedGathering = () =>
      api
        .getOwnedGathering(loadingGatheringId)
        .then((gathering) => {
          if (!cancelled) {
            upsertGathering(gathering);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            if (needsDetailLoad) {
              setSelectedGatheringLoadFailedId(loadingGatheringId);
            }
            setMessage(`Loading gathering failed: ${errorMessage(error)}`);
          }
        })
        .finally(() => {
          if (timeout) {
            window.clearTimeout(timeout);
          }
        });

    void loadSelectedGathering();
    const poll = window.setInterval(() => {
      void loadSelectedGathering();
    }, gatheringArtifactPollMs);

    return () => {
      cancelled = true;
      if (timeout) {
        window.clearTimeout(timeout);
      }
      window.clearInterval(poll);
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
      if (!recipeParam) {
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
    debouncedQuery,
    loadRecipes,
    recipeParam,
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
    <main className="grid h-screen min-h-screen grid-cols-[minmax(380px,0.68fr)_minmax(580px,1.32fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(255,190,91,0.22),transparent_20rem),radial-gradient(circle_at_92%_7%,rgba(47,104,75,0.18),transparent_23rem),radial-gradient(circle_at_84%_88%,rgba(226,82,63,0.13),transparent_22rem),linear-gradient(135deg,#fff7e3_0%,#f6efe2_48%,#eaf3df_100%)] text-(--color-ink) max-[1180px]:grid-cols-[minmax(360px,0.78fr)_minmax(520px,1.22fr)] max-[980px]:h-auto! max-[980px]:content-start! max-[980px]:grid-cols-[minmax(0,1fr)] max-[980px]:grid-rows-[auto]! max-[980px]:overflow-visible!">
      <AppNav
        onAuthIntent={openAuth}
        onNavigateHome={() => navigate({ to: "/app" })}
        onOpenLanding={() => {
          if (typeof window === "undefined") {
            void navigate({ to: "/" });
            return;
          }

          window.location.assign("/");
        }}
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
            gatherings={gatherings}
            gatheringsLoading={gatheringsLoading}
            mode={mode}
            onBack={closeRecipe}
            onChange={setDraft}
            onCreateGatheringForRecipe={(recipe) => void createGatheringDraft(recipe)}
            onDelete={deleteSelectedRecipe}
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
            hasFoodPreferences={hasFoodPreferences}
            loading={recipesPageLoading}
            onCreateBlank={createBlankRecipe}
            onImport={openRecipeImportPage}
            onOpenBrowse={openBrowseRecipe}
            onOpenOwned={openOwnedRecipe}
            onOpenPreferences={() => openAppPage("preferences")}
            onQuery={setQuery}
            onSection={setSection}
            ownedRecipes={visibleRecipes}
            query={query}
            section={section}
            sessionUserId={sessionUserId}
            sharedCount={sharedUnreadCount}
          />
        )
      ) : page === "cookbooks" ? (
        <CookbooksPage
          onCloseCookbook={() => setSelectedCookbookId(undefined)}
          onOpenCookbook={openCookbookPage}
          recipes={visibleRecipes}
          selectedCookbookId={selectedCookbookId}
          session={session}
          sessionLoading={sessionLoading}
        />
      ) : page === "gatherings" ? (
        <GatheringsPage
          gatherings={gatherings}
          loading={gatheringsLoading}
          message={message}
          onCreate={() => void createGatheringDraft()}
          onDuplicate={duplicateGathering}
          onLogIn={() => openAuth("login")}
          onOpen={openGatheringEditor}
          onShare={openGatheringShare}
          onStatus={setMessage}
          recipes={recipes}
          sessionUserId={sessionUserId}
        />
      ) : page === "gathering-share" ? (
        <GatheringSharePage
          key={selectedGathering?.id ?? "loading-gathering-share"}
          gathering={selectedGathering}
          loading={selectedGatheringEditorLoading}
          message={message}
          onBackToEditor={openGatheringEditor}
          onBackToGatherings={() => openAppPage("gatherings")}
          onSendInvites={sendGatheringInvites}
          onStatus={setMessage}
        />
      ) : page === "gathering" || page === "gathering-generating" ? (
        <GatheringEditorPage
          gathering={selectedGathering}
          loading={selectedGatheringEditorLoading}
          message={message}
          onBackToGatherings={() => openAppPage("gatherings")}
          onDuplicate={duplicateGathering}
          onOpenDuplicate={openGatheringEditor}
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
          onCreateAccount={() => openAuth("signup")}
          onGoToPage={openAppPage}
          onOpenOnboarding={() => openAppPage("preferences")}
          onLogIn={() => openAuth("login")}
          onRefreshSession={refreshSession}
          onSignOut={signOut}
          recipes={visibleRecipes}
          session={session}
          sessionLoading={sessionLoading}
        />
      ) : (
        <BuildPage />
      )}
    </main>
  );
}
