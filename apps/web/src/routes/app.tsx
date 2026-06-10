import { createFileRoute } from "@tanstack/react-router";
import { RecipeWorkspace } from "../components/workspace";
import type { Page, RecipeSection } from "../lib/recipe";

type AppSearch = {
  add?: boolean;
  browse?: string;
  page?: Page;
  recipe?: string;
  section?: RecipeSection;
};

const appPages = new Set<Page>(["recipes", "api", "export", "build", "settings"]);
const recipeSections = new Set<RecipeSection>(["mine", "shared", "explore"]);

function stringSearchValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// The authenticated workspace is client-rendered: its data is private and
// auth-gated, so SSR would only add cookie/auth-in-loader complexity.
export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AppSearch => {
    const page = stringSearchValue(search.page);
    const section = stringSearchValue(search.section);
    const recipe = stringSearchValue(search.recipe);
    const browse = stringSearchValue(search.browse);
    const add = search.add === true || search.add === "true" || search.add === "1";

    return {
      ...(add ? { add } : {}),
      ...(browse ? { browse } : {}),
      ...(page && appPages.has(page as Page) ? { page: page as Page } : {}),
      ...(recipe ? { recipe } : {}),
      ...(section && recipeSections.has(section as RecipeSection)
        ? { section: section as RecipeSection }
        : {}),
    };
  },
  component: RecipeWorkspace,
});
