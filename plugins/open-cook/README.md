# OpenCook Codex Plugin

This plugin exposes the OpenCook recipe API to Codex through a local MCP server.

## What Codex Can Do

- Search and list recipes.
- Fast-search recipes with compact ranked results for agent workflows.
- Get a recipe as JSON or OpenCook Markdown.
- Create recipes from extracted image text, pasted text, or user descriptions.
- Import recipes from public recipe website URLs.
- Preview existing recipe edits before saving.
- Apply confirmed recipe edits.
- Build shopping lists from selected recipes.

## API Configuration

The MCP bridge defaults to:

```sh
OPEN_COOK_API_BASE=http://127.0.0.1:8787
```

If the API uses Better Auth, set one of these in the process environment or in the repo's ignored `.env.local` file:

```sh
OPEN_COOK_AUTH_TOKEN=your-better-auth-session-token
OPEN_COOK_COOKIE=your-browser-session-cookie
```

Use `OPEN_COOK_API_BASE=https://your-api-host` when connecting Codex to a deployed OpenCook API.
