#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "opencook";
const SERVER_VERSION = "0.1.0";
const DEFAULT_API_BASE = "http://127.0.0.1:8787";
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "../..");
const ENV_FILE_KEYS = new Set([
  "OPEN_COOK_API_BASE",
  "OPEN_COOK_AUTH_TOKEN",
  "OPEN_COOK_COOKIE",
]);
const SQLITE_CANDIDATES = [
  "sqlite3",
  "/opt/homebrew/opt/sqlite/bin/sqlite3",
  "/usr/bin/sqlite3",
];
let cachedLocalAuthToken;
let didReadLocalAuthToken = false;

const instructions =
  "Use OpenCook tools to read and update the user's recipe store. Start with open_cook_status if the API state is unclear. Before editing an existing recipe, read it, propose the intended changes, preview them, then apply only after the user confirms. For recipe images, extract the recipe from the attached image in chat, then call create_recipe. Do not invent missing quantities; put uncertainty in notes.";

loadLocalEnvFiles();

const recipeFieldProperties = {
  title: { type: "string", description: "Recipe title." },
  description: { type: "string", description: "Short recipe description." },
  imageUrl: { type: "string", description: "Public image URL for the recipe." },
  source: {
    type: "object",
    additionalProperties: true,
    properties: {
      name: { type: "string" },
      url: { type: "string" },
      externalId: { type: "string" },
    },
  },
  prepTimeMinutes: { type: "number", minimum: 0 },
  cookTimeMinutes: { type: "number", minimum: 0 },
  totalTimeMinutes: { type: "number", minimum: 0 },
  servings: { type: "string" },
  tags: {
    type: "array",
    items: { type: "string" },
  },
  ingredients: {
    type: "array",
    description:
      "Ingredient lines as strings or objects with text and optional section.",
    items: {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          properties: {
            section: { type: "string" },
            text: { type: "string" },
          },
          required: ["text"],
        },
      ],
    },
  },
  steps: {
    type: "array",
    description: "Step lines as strings or objects with text and optional section.",
    items: {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          properties: {
            section: { type: "string" },
            text: { type: "string" },
          },
          required: ["text"],
        },
      ],
    },
  },
  notes: {
    type: "array",
    items: { type: "string" },
  },
};

const tools = [
  {
    name: "open_cook_status",
    description: "Check whether the OpenCook API is reachable and return API metadata.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "list_recipes",
    description:
      "List recipes from OpenCook, optionally filtered by query, tag, or source.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        q: { type: "string", description: "Search text." },
        tag: { type: "string", description: "Exact tag filter." },
        source: { type: "string", description: "Source name filter." },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 200,
          description: "Maximum recipes to return. Defaults to 50.",
        },
        includeIngredients: {
          type: "boolean",
          description: "Include ingredient text in list rows.",
        },
      },
    },
  },
  {
    name: "search_recipes",
    description:
      "Fast agent-friendly recipe search. Returns compact ranked summaries and match hints before fetching full recipes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        q: { type: "string", description: "Search text." },
        tag: { type: "string", description: "Exact tag filter." },
        source: { type: "string", description: "Source name filter." },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 25,
          description: "Maximum recipes to return. Defaults to 10.",
        },
        includeIngredients: {
          type: "boolean",
          description: "Include a bounded ingredient preview for each row.",
        },
        includeSteps: {
          type: "boolean",
          description: "Include a bounded method-step preview for each row.",
        },
      },
    },
  },
  {
    name: "get_recipe",
    description: "Get one recipe by id as JSON or OpenCook Markdown.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        format: {
          type: "string",
          enum: ["json", "markdown"],
          default: "json",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_recipe",
    description:
      "Create a recipe. Use this after extracting a recipe from an image, screenshot, pasted text, website, or user description.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: recipeFieldProperties,
      required: ["title"],
    },
  },
  {
    name: "preview_recipe_update",
    description:
      "Preview how an update would change an existing recipe without saving it.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        update: {
          type: "object",
          additionalProperties: false,
          properties: recipeFieldProperties,
        },
      },
      required: ["id", "update"],
    },
  },
  {
    name: "update_recipe",
    description:
      "Apply an update to an existing recipe after the user confirms the change.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        update: {
          type: "object",
          additionalProperties: false,
          properties: recipeFieldProperties,
        },
      },
      required: ["id", "update"],
    },
  },
  {
    name: "import_recipe_from_website",
    description:
      "Import a recipe from a public recipe page URL through OpenCook's website importer.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "create_shopping_list",
    description:
      "Generate a plain shopping list from all recipes or selected recipe ids.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        recipeIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional recipe ids. Omit to use all recipes.",
        },
      },
    },
  },
];

class ApiError extends Error {
  constructor(message, { status, data }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function loadLocalEnvFiles() {
  for (const path of [resolve(REPO_ROOT, ".env.local"), resolve(REPO_ROOT, ".env")]) {
    try {
      const contents = readFileSync(path, "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
        if (!match || !ENV_FILE_KEYS.has(match[1]) || process.env[match[1]]) {
          continue;
        }
        process.env[match[1]] = unquoteEnvValue(match[2]);
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        continue;
      }
      console.error(`[open-cook-mcp] failed to read ${path}`, error);
    }
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function apiBase() {
  return (process.env.OPEN_COOK_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function apiHeaders(hasBody = false) {
  const headers = {};
  if (hasBody) {
    headers["content-type"] = "application/json";
  }
  const authToken = process.env.OPEN_COOK_AUTH_TOKEN || localDevAuthToken();
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }
  if (process.env.OPEN_COOK_COOKIE) {
    headers.cookie = process.env.OPEN_COOK_COOKIE;
  }
  return headers;
}

function localDevAuthToken() {
  if (didReadLocalAuthToken) return cachedLocalAuthToken;
  didReadLocalAuthToken = true;

  if (process.env.OPEN_COOK_COOKIE || !isLocalApiBase()) {
    return undefined;
  }

  for (const dbPath of localD1DatabasePaths()) {
    const token = readLatestSessionToken(dbPath);
    if (token) {
      cachedLocalAuthToken = token;
      return cachedLocalAuthToken;
    }
  }

  return undefined;
}

function isLocalApiBase() {
  try {
    const hostname = new URL(apiBase()).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

function localD1DatabasePaths() {
  const d1Path = resolve(
    REPO_ROOT,
    "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
  );
  if (!existsSync(d1Path)) {
    return [];
  }

  return readdirSync(d1Path)
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
    .map((name) => resolve(d1Path, name));
}

function readLatestSessionToken(dbPath) {
  const query =
    "select token from session where expires_at > unixepoch() * 1000 order by updated_at desc limit 1;";

  for (const sqlitePath of SQLITE_CANDIDATES) {
    try {
      const token = execFileSync(sqlitePath, [dbPath, query], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return token || undefined;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        continue;
      }
      return undefined;
    }
  }

  return undefined;
}

function apiUrl(path, query = {}) {
  const url = new URL(path, apiBase());
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function apiRequest(path, options = {}) {
  const { method = "GET", body, query, text = false } = options;
  const response = await fetch(apiUrl(path, query), {
    method,
    headers: apiHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const data =
    !text && contentType.includes("application/json") && raw ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const detail =
      response.status === 401 &&
      !process.env.OPEN_COOK_AUTH_TOKEN &&
      !process.env.OPEN_COOK_COOKIE
        ? "Unauthorized. Set OPEN_COOK_AUTH_TOKEN to a Better Auth bearer session token. For local debugging you can set OPEN_COOK_COOKIE to a valid OpenCook browser session cookie or sign in to the local OpenCook app so the MCP bridge can reuse the local dev session."
        : typeof data === "object" && data && "error" in data
          ? data.error
          : response.statusText;
    throw new ApiError(`OpenCook API ${response.status}: ${detail}`, {
      status: response.status,
      data,
    });
  }

  return data;
}

function normalizeLineList(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (typeof item === "string") return { text: item };
    if (item && typeof item === "object") {
      return {
        ...(item.section ? { section: item.section } : {}),
        text: item.text,
      };
    }
    return item;
  });
}

function normalizeRecipeInput(input) {
  const normalized = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value !== undefined && key !== "id") {
      normalized[key] = value;
    }
  }
  if ("ingredients" in normalized) {
    normalized.ingredients = normalizeLineList(normalized.ingredients);
  }
  if ("steps" in normalized) {
    normalized.steps = normalizeLineList(normalized.steps);
  }
  return normalized;
}

function summarizeRecipe(recipe, includeIngredients = false) {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    tags: recipe.tags,
    servings: recipe.servings,
    totalTimeMinutes: recipe.totalTimeMinutes,
    source: recipe.source?.name || recipe.source?.url,
    updatedAt: recipe.updatedAt,
    ...(includeIngredients
      ? { ingredients: recipe.ingredients.map((ingredient) => ingredient.text) }
      : {}),
  };
}

function cleanRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return recipe;
  const { source, ...rest } = recipe;
  if (!source || typeof source !== "object") return recipe;
  const { raw, ...cleanSource } = source;
  void raw;
  return {
    ...rest,
    source: Object.keys(cleanSource).length ? cleanSource : undefined,
  };
}

function diffObjects(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = {};
  for (const key of keys) {
    if (["createdAt", "updatedAt"].includes(key)) continue;
    const previous = before[key];
    const next = after[key];
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changes[key] = { before: previous ?? null, after: next ?? null };
    }
  }
  return changes;
}

async function callTool(name, args = {}) {
  switch (name) {
    case "open_cook_status": {
      const [root, health, info, manifest] = await Promise.all([
        apiRequest("/"),
        apiRequest("/api/health"),
        apiRequest("/api/info"),
        apiRequest("/api/agents/manifest"),
      ]);
      return {
        apiBase: apiBase(),
        root,
        health,
        info,
        manifest,
      };
    }

    case "list_recipes": {
      const recipes = await apiRequest("/api/recipes", {
        query: { q: args.q, tag: args.tag, source: args.source },
      });
      const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
      return {
        count: recipes.length,
        returned: Math.min(recipes.length, limit),
        recipes: recipes
          .slice(0, limit)
          .map((recipe) => summarizeRecipe(recipe, Boolean(args.includeIngredients))),
      };
    }

    case "search_recipes": {
      return await apiRequest("/api/agents/tools/search-recipes", {
        method: "POST",
        body: {
          q: args.q,
          tag: args.tag,
          source: args.source,
          limit: args.limit,
          includeIngredients: args.includeIngredients,
          includeSteps: args.includeSteps,
        },
      });
    }

    case "get_recipe": {
      if (args.format === "markdown") {
        const markdown = await apiRequest(
          `/api/export/recipes/${encodeURIComponent(args.id)}/markdown`,
          { text: true },
        );
        return { id: args.id, format: "markdown", markdown };
      }
      return cleanRecipe(
        await apiRequest(`/api/recipes/${encodeURIComponent(args.id)}`),
      );
    }

    case "create_recipe": {
      const input = normalizeRecipeInput(args);
      return cleanRecipe(
        await apiRequest("/api/recipes", {
          method: "POST",
          body: input,
        }),
      );
    }

    case "preview_recipe_update": {
      const current = await apiRequest(`/api/recipes/${encodeURIComponent(args.id)}`);
      const update = normalizeRecipeInput(args.update);
      const cleanCurrent = cleanRecipe(current);
      const preview = cleanRecipe({ ...current, ...update });
      return {
        id: args.id,
        saved: false,
        update,
        changes: diffObjects(cleanCurrent, preview),
        preview,
      };
    }

    case "update_recipe": {
      const current = await apiRequest(`/api/recipes/${encodeURIComponent(args.id)}`);
      const update = normalizeRecipeInput(args.update);
      const recipe = await apiRequest(`/api/recipes/${encodeURIComponent(args.id)}`, {
        method: "PUT",
        body: update,
      });
      const cleanCurrent = cleanRecipe(current);
      const cleanUpdated = cleanRecipe(recipe);
      return {
        id: args.id,
        saved: true,
        changes: diffObjects(cleanCurrent, cleanUpdated),
        recipe: cleanUpdated,
      };
    }

    case "import_recipe_from_website": {
      return cleanRecipe(
        await apiRequest("/api/import/website", {
          method: "POST",
          body: { url: args.url },
        }),
      );
    }

    case "create_shopping_list": {
      return await apiRequest("/api/agents/workflows/shopping-list", {
        method: "POST",
        body: { recipeIds: args.recipeIds },
      });
    }

    default:
      throw new Error(`Unknown OpenCook tool: ${name}`);
  }
}

function asToolResult(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text }],
    structuredContent: typeof data === "string" ? { text: data } : data,
  };
}

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  send({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  });
}

async function handleRequest(message) {
  if (!message || typeof message !== "object") return;
  if (Array.isArray(message)) {
    await Promise.all(message.map(handleRequest));
    return;
  }

  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize":
        if (!isNotification) {
          sendResult(id, {
            protocolVersion: params?.protocolVersion || "2025-06-18",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION,
            },
            instructions,
          });
        }
        return;

      case "notifications/initialized":
      case "$/cancelRequest":
        return;

      case "tools/list":
        if (!isNotification) {
          sendResult(id, { tools });
        }
        return;

      case "tools/call": {
        const toolName = params?.name;
        const args = params?.arguments || {};
        const data = await callTool(toolName, args);
        if (!isNotification) {
          sendResult(id, asToolResult(data));
        }
        return;
      }

      case "ping":
        if (!isNotification) {
          sendResult(id, {});
        }
        return;

      default:
        if (!isNotification) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
    }
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "OpenCook MCP tool failed.";
    if (!isNotification) {
      sendResult(id, {
        content: [{ type: "text", text: messageText }],
        isError: true,
        structuredContent: {
          error: messageText,
          ...(error instanceof ApiError
            ? { status: error.status, response: error.data }
            : {}),
        },
      });
    }
  }
}

let buffer = "";
let pendingRequests = 0;
let shouldExitWhenIdle = false;

function scheduleRequest(message) {
  pendingRequests += 1;
  void handleRequest(message)
    .catch((error) => {
      console.error("[open-cook-mcp] request failed", error);
    })
    .finally(() => {
      pendingRequests -= 1;
      if (shouldExitWhenIdle && pendingRequests === 0) {
        process.exit(0);
      }
    });
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      try {
        scheduleRequest(JSON.parse(line));
      } catch (error) {
        console.error("[open-cook-mcp] invalid JSON-RPC message", error);
      }
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => {
  shouldExitWhenIdle = true;
  if (pendingRequests === 0) {
    process.exit(0);
  }
});
