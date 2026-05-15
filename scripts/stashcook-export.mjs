#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.STASHCOOK_BASE_URL ?? "https://api.stashcook.com";
const token = process.env.STASHCOOK_ACCESS_TOKEN;
const cookie = process.env.STASHCOOK_COOKIE;
const outputDir =
  process.env.STASHCOOK_EXPORT_DIR ??
  path.join(
    "artifacts",
    "stashcook-export",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );

const recipeExpand = [
  "Ingredients",
  "Method",
  "Notes",
  "Nutrition",
  "Ingredients2",
  "Nutrition2",
].join(",");
const mealsStartDate = process.env.STASHCOOK_MEALS_START ?? "2020-01-01";
const mealsEndDate =
  process.env.STASHCOOK_MEALS_END ??
  new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

if (!token && !cookie) {
  throw new Error(
    "Set STASHCOOK_ACCESS_TOKEN or STASHCOOK_COOKIE before running this exporter.",
  );
}

const headers = {
  Accept: "application/json",
  "Accept-Language": "en-GB",
  "api-version": "2025.01.06",
};

if (token) {
  headers.Authorization = `Bearer ${token.replace(/^Bearer\s+/i, "")}`;
}

if (cookie) {
  headers.Cookie = cookie;
}

const manifest = {
  exportedAt: new Date().toISOString(),
  baseUrl,
  endpoints: {},
  errors: {},
};

await mkdir(outputDir, { recursive: true });

async function stashcookFetch(pathname, params = {}) {
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, { headers, credentials: "include" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body);
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }

  return body;
}

async function writeJson(name, value) {
  await writeFile(
    path.join(outputDir, `${name}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function resultCount(value) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.results)) {
      return value.results.length;
    }
    if (Array.isArray(value.items)) {
      return value.items.length;
    }
  }
  return value === undefined || value === null ? 0 : 1;
}

async function capture(name, pathname, params = {}) {
  try {
    const value = await stashcookFetch(pathname, params);
    await writeJson(name, value);
    manifest.endpoints[name] = {
      path: pathname,
      params,
      count: resultCount(value),
    };
    console.log(`${name}: ok (${manifest.endpoints[name].count})`);
    return value;
  } catch (error) {
    manifest.errors[name] = {
      path: pathname,
      params,
      message: error instanceof Error ? error.message : String(error),
    };
    console.warn(`${name}: failed`);
    return undefined;
  }
}

async function capturePaginated(name, pathname, params = {}, take = 100) {
  const pages = [];
  const results = [];
  let skip = 0;

  try {
    for (;;) {
      const page = await stashcookFetch(pathname, {
        ...params,
        skip,
        take,
      });
      pages.push(page);

      const rows = Array.isArray(page) ? page : (page?.results ?? []);
      results.push(...rows);

      const totalCount =
        page && typeof page === "object" && typeof page.totalCount === "number"
          ? page.totalCount
          : undefined;

      if (
        rows.length < take ||
        (totalCount !== undefined && results.length >= totalCount)
      ) {
        break;
      }

      skip += rows.length;
    }
  } catch (error) {
    manifest.errors[name] = {
      path: pathname,
      params,
      message: error instanceof Error ? error.message : String(error),
    };
    console.warn(`${name}: failed`);
    return [];
  }

  await writeJson(name, results);
  await writeJson(`${name}-pages`, pages);
  manifest.endpoints[name] = {
    path: pathname,
    params,
    count: results.length,
    pages: pages.length,
  };
  console.log(`${name}: ok (${results.length})`);
  return results;
}

async function captureContinuation(name, pathname, params = {}, take = 100) {
  const pages = [];
  const results = [];
  let continuation;

  try {
    for (;;) {
      const page = await stashcookFetch(pathname, {
        ...params,
        continuation,
        take,
      });
      pages.push(page);

      const rows = Array.isArray(page) ? page : (page?.results ?? []);
      results.push(...rows);

      const hasMoreResults =
        page && typeof page === "object" && page.hasMoreResults === true;
      continuation =
        page && typeof page === "object" ? page.continuationToken : undefined;

      if (!hasMoreResults || !continuation) {
        break;
      }
    }
  } catch (error) {
    manifest.errors[name] = {
      path: pathname,
      params,
      message: error instanceof Error ? error.message : String(error),
    };
    console.warn(`${name}: failed`);
    return [];
  }

  await writeJson(name, results);
  await writeJson(`${name}-pages`, pages);
  manifest.endpoints[name] = {
    path: pathname,
    params,
    count: results.length,
    pages: pages.length,
  };
  console.log(`${name}: ok (${results.length})`);
  return results;
}

function parseDateOnly(value, name) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a YYYY-MM-DD date.`);
  }
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

async function captureMealWindows() {
  const startLimit = parseDateOnly(mealsStartDate, "STASHCOOK_MEALS_START");
  const endLimit = parseDateOnly(mealsEndDate, "STASHCOOK_MEALS_END");
  const pages = [];
  const results = [];
  let start = startLimit;

  while (start <= endLimit) {
    const end = new Date(Math.min(addDays(start, 55).getTime(), endLimit.getTime()));
    const params = {
      start: isoDate(start),
      end: isoDate(end),
      expand: "Recipe",
    };

    try {
      const page = await stashcookFetch("/meals", params);
      pages.push({ params, value: page });

      const rows = Array.isArray(page) ? page : (page?.results ?? []);
      results.push(...rows);
    } catch (error) {
      manifest.errors[`meals-${params.start}-${params.end}`] = {
        path: "/meals",
        params,
        message: error instanceof Error ? error.message : String(error),
      };
      console.warn(`meals ${params.start}..${params.end}: failed`);
    }

    start = addDays(end, 1);
  }

  await writeJson("meals", results);
  await writeJson("meals-pages", pages);
  manifest.endpoints.meals = {
    path: "/meals",
    params: {
      start: mealsStartDate,
      end: mealsEndDate,
      expand: "Recipe",
    },
    count: results.length,
    windows: pages.length,
  };
  console.log(`meals: ok (${results.length})`);
  return results;
}

await capture("profile", "/profile");
await capture("profile-settings", "/profile/settings");
await capture("feature-flags", "/feature-flags");
await capture("subscription", "/subscriptions");
await capture("family-share-members", "/family-share-members");
await capture("recipe-tags", "/recipe-tags");
await capture("meal-tags", "/meal-tags");
await capture("recipe-ids", "/recipe-ids");

await capturePaginated("recipes", "/recipes", {
  sortBy: "name",
  direction: "asc",
  expand: recipeExpand,
});

await capturePaginated("recipe-collections", "/recipe-collections", {
  sortBy: "name",
  direction: "asc",
  view: "tree",
});

await capture("shopping-list-default", "/shopping-lists/default", {
  expand: "Recipe",
});
await capture("pantry-list-default", "/pantry-lists/default");
await captureMealWindows();

await captureContinuation("recipe-revisions", "/recipe-revisions");
await captureContinuation(
  "recipe-collection-revisions",
  "/recipe-collection-revisions",
);
await captureContinuation("meal-revisions", "/meal-revisions");
await captureContinuation("shopping-list-revisions", "/shopping-list-revisions");
await captureContinuation("pantry-list-revisions", "/pantry-list-revisions");

await writeJson("manifest", manifest);
console.log(`exported to ${outputDir}`);
