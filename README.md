# OpenCook

OpenCook is a self-hostable recipe API and example app for getting personal recipe
data out of locked recipe apps and into formats you control. The demo is designed
for Codex and other AI agents: inspect `/openapi.json`, call the API, and build
new recipe workflows on top of your own data.

The current target is a Cloudflare Workers demo:

- Hono API with OpenAPI at `/openapi.json`, Swagger UI at `/docs`, and Scalar at
  `/scalar`
- Cloudflare D1 storage through Drizzle ORM
- Cloudflare R2 image storage for public recipe photos
- Replaceable storage adapter contract for future D1/Postgres/SQLite variants
- Open recipe format in JSON with Markdown import/export
- StashCook importer that uses credentials copied from your own browser session
- Public recipe URL importer for pages that expose schema.org Recipe JSON-LD
- Better Auth authentication on D1 for email/password, email OTP, magic links,
  username/password, 2FA, passkeys, and bearer sessions
- React example app that demonstrates list, edit, import, export, and build-your-own
  flows
- Agent workflow endpoint for turning recipes into a shopping list

## Run It

```bash
pnpm install
pnpm --filter @open-cook/api db:migrate:local
pnpm dev:api
pnpm dev:web
```

Then open:

- API: `http://localhost:8787`
- API docs: `http://localhost:8787/scalar`
- Web app: `http://localhost:5173`

For remote deploys, create a D1 database and an R2 bucket, then replace the
placeholder `database_id` in `apps/api/wrangler.jsonc`. The Worker config already
sets `ASSETS_PUBLIC_BASE_URL` to `https://images.open-cook.com`, so copied recipe
images are stored as stable URLs on the public R2 custom domain:

```bash
pnpm --filter @open-cook/api wrangler d1 create open-cook
pnpm --filter @open-cook/api wrangler r2 bucket create open-cook-recipe-images
pnpm --filter @open-cook/api wrangler r2 bucket domain add open-cook-recipe-images --domain images.open-cook.com --zone-id <open-cook.com-zone-id> --min-tls 1.2
pnpm --filter @open-cook/api wrangler r2 bucket dev-url disable open-cook-recipe-images
pnpm --filter @open-cook/api db:migrate:remote
pnpm --filter @open-cook/api deploy
```

Recipe images are stored in R2 under public URLs. There is no signed URL flow:
food images are served through the public R2 custom domain at
`https://images.open-cook.com`. The Worker route `/api/assets/images/:key`
remains available for local development and fallback reads. Keep the R2 public
development URL disabled for production.

Authentication uses Better Auth with the same D1 binding as recipe storage. Set
`AUTH_SECRET` or `BETTER_AUTH_SECRET` for deployed environments, and set
`AUTH_BASE_URL` or `BETTER_AUTH_URL` to the Worker origin. Browser clients should
be listed in `AUTH_TRUSTED_ORIGINS` as comma-separated origins; `WEBSITE_URL` is
also trusted when set. Passkeys default to the auth origin hostname unless
`AUTH_PASSKEY_RP_ID` is configured.

Email delivery is intentionally not wired to a provider yet. Verification links,
magic links, password reset links, delete-account links, and OTP codes are logged
to the Worker console so the demo works locally without a mail service.

New databases start with no recipe rows. The old demo recipes live outside the
migration path in `apps/api/seeds/dev-recipes.sql` and can be loaded into a local
D1 database explicitly:

```bash
pnpm --filter @open-cook/api db:seed:local
```

That seed file should stay dev-only until recipe ownership exists, then it can be
changed to attach rows to a specific Better Auth user.

## API Shape

Core endpoints:

- `GET /api/me`
- `ALL /api/auth/*`
- `GET /api/auth/reference`
- `GET /api/recipes`
- `POST /api/recipes`
- `GET /api/recipes/:id`
- `PUT /api/recipes/:id`
- `DELETE /api/recipes/:id`
- `POST /api/import/stashcook`
- `POST /api/import/website`
- `POST /api/import/markdown`
- `POST /api/assets/images/from-url`
- `POST /api/assets/images/mirror-recipes`
- `GET /api/assets/images/:key`
- `GET /api/agents/manifest`
- `POST /api/agents/workflows/shopping-list`
- `GET /api/export/recipes/json`
- `GET /api/export/recipes/markdown`
- `GET /api/export/recipes/:id/markdown`

## Codex Usage

The intended demo loop is:

1. Run OpenCook locally or deploy it to Cloudflare Workers.
2. Ask Codex to inspect `http://localhost:8787/openapi.json`.
3. Ask Codex to call the API to add, edit, import, or export recipes.
4. Ask Codex to build a new workflow on top of your recipe data, such as a meal
   plan, shopping list, nutrition review, cookbook Markdown export, or a custom
   family recipe UI.

Useful agent entry points:

- `GET /api/agents/manifest`
- `POST /api/assets/images/from-url`
- `POST /api/assets/images/mirror-recipes`
- `POST /api/agents/workflows/shopping-list`
- `GET /api/export/recipes/json`
- `GET /api/export/recipes/markdown`

## StashCook Import

OpenCook does not bypass authentication. The StashCook importer calls the same
authenticated browser API that your logged-in web app uses. You provide a bearer
token or cookie from your own session, OpenCook reads your recipe data, maps it
to the OpenCook format, mirrors reachable recipe images into R2, and saves it
locally.

Public bundle inspection on 2026-05-14 showed these relevant StashCook endpoints:

- `GET https://api.stashcook.com/recipes`
- `GET https://api.stashcook.com/recipes/{id}`
- `GET https://api.stashcook.com/recipe-collections`
- `GET https://api.stashcook.com/recipe-ids`

The initial importer uses `/recipes?skip=0&take=100&expand=Ingredients,Method,Notes,Nutrition`
and falls back to `/recipes/{id}?expand=Ingredients,Method,Notes,Nutrition` when
detail fields are missing from the list response.

See [docs/stashcook.md](docs/stashcook.md) for the extraction plan and open
questions.

## Storage Adapter Contract

The API only depends on the `RecipeStore` interface in
`apps/api/src/storage/types.ts`. The demo implementation is D1 + Drizzle. A
Postgres, SQLite, Electric, or browser sync layer can be added later by
implementing that interface and swapping the middleware.

Recipe images use the same replaceable approach through the R2-backed asset
store in `apps/api/src/assets/imageAssets.ts`. Imported image URLs are copied
into the configured bucket on a best-effort basis; if a source blocks image
fetching, the recipe still imports with its original image URL.

## Design Direction

The example app is intentionally not a landing page. It opens on the usable
recipe workspace: list, search, import controls, editable recipe detail, export
actions, OpenAPI link, agent manifest link, and GitHub link.
