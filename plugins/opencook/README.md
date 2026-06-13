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

For the hosted app, point the bridge at production:

```sh
OPEN_COOK_API_BASE=https://open-cook.com
```

If the API uses Better Auth, open the API page in OpenCook and use `Connect Codex`
to create a scoped Codex token:

```sh
OPEN_COOK_AUTH_TOKEN=your-codex-token
```

The bridge sends that value as `Authorization: Bearer <token>`. OpenCook stores
only a hash of scoped Codex tokens and shows the full token once. `OPEN_COOK_COOKIE`
is still supported for local debugging, but it should not be the normal setup path
for shared or hosted OpenCook accounts.

When running the OpenCook repo locally, the bridge also checks the ignored repo-root `.env.local` and `.env` files for `OPEN_COOK_API_BASE`, `OPEN_COOK_AUTH_TOKEN`, and `OPEN_COOK_COOKIE`. For local development against D1, it can reuse the newest unexpired local Better Auth session when no explicit token or cookie is set.

## Installing From This Repo

This plugin is published from the repo-local marketplace as `opencook`. The plugin ID intentionally omits the dash, while the displayed product name remains OpenCook.

Add the marketplace that contains this repository's `.agents/plugins/marketplace.json`, then install `opencook` from that marketplace in Codex.
