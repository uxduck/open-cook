# OpenCook

OpenCook is a recipe app for families and communities. It starts with the
recipes you already trust. The ones from your old app, your notes, your
family docs. They all help you reshape your favorites for the people at your table
tonight.
Change the occasion, not the recipe you trust.

What you can do with it:

- **Restyle dinner for any occasion.** Take a saved recipe and make it fit the
  night: a kids' version, a dragon-birthday version, a Halloween version, a
  low-effort rainy-Tuesday version. OpenCook adapts the tone, portions, prep,
  ingredients, and presentation around who's eating.
- **Turn recipes into stories.** Give a familiar dish a new telling. A
  birthday-picnic story for the tacos, a campfire tale for the ramen. Dinner
  becomes something kids and guests look forward to, not just food on
  a plate.
  dinner becomes something kids and guests look forward to, not just food on
  a plate.
- **Bring your recipes with you.** Import from StashCook, recipe links,
  Markdown notes, JSON files, and family docs. Your collection stays private
  to your account, and remixing never overwrites the original. Every
  variation is a new version, so the recipe you trust stays exactly as it was.

OpenCook is open source and open by design: a self-hostable, AI-first recipe
API with OpenAPI docs at `/openapi.json`, so your data is never locked in and
agents like Codex can build on top of it. You can add meal plans, shopping
lists, cookbook exports, or a custom UI for your family.

The hosted demo shape is a Vercel web app backed by a Cloudflare Worker API:

- Vercel-hosted TanStack Start web app, built with Nitro
- Hono API with OpenAPI at `/openapi.json`, Swagger UI at `/docs`, and Scalar at
  `/scalar`
- Cloudflare Worker backend for API, auth, data, image, and AI endpoints
- D1 storage through Drizzle ORM
- R2 image storage for public recipe photos
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

## Deploy

The preferred hosted web target is Vercel. Create the Vercel project from
`apps/web` and use:

- Build command: `pnpm run build:vercel`
- Environment variable: `OPEN_COOK_API_ORIGIN=https://open-cook.com`

The Vercel server proxies `/api/*`, `/openapi.json`, `/docs`, and `/scalar` to
that API origin, so the browser keeps same-origin auth and API calls while the
backend stays on the Worker.

For the backend, deploy the API Worker separately. Create a D1 database and an
R2 bucket, then replace the placeholder `database_id` in
`apps/api/wrangler.jsonc`. The production and staging Worker environments set
`ASSETS_PUBLIC_BASE_URL` to `https://images.open-cook.com`, so copied recipe
images are stored as stable URLs on the public R2 custom domain:

```bash
pnpm --filter @open-cook/api exec wrangler d1 create open-cook
pnpm --filter @open-cook/api exec wrangler r2 bucket create open-cook-recipe-images
pnpm --filter @open-cook/api exec wrangler r2 bucket domain add open-cook-recipe-images --domain images.open-cook.com --zone-id <open-cook.com-zone-id> --min-tls 1.2
pnpm --filter @open-cook/api exec wrangler r2 bucket dev-url disable open-cook-recipe-images
pnpm --filter @open-cook/api db:migrate:remote
pnpm --filter @open-cook/api deploy
```

After Vercel assigns a production URL, set the API Worker auth environment to
trust that web origin:

- `WEBSITE_URL=https://<vercel-production-origin>`
- `BETTER_AUTH_URL=https://<vercel-production-origin>`
- `AUTH_TRUSTED_ORIGINS=https://<vercel-production-origin>`

Recipe images are stored in R2 under public URLs. There is no signed URL flow:
food images are served through the public R2 custom domain at
`https://images.open-cook.com`. The Worker route `/api/assets/images/:key`
remains available for local development and fallback reads. Local dev leaves
`ASSETS_PUBLIC_BASE_URL` unset so new mirrored images use the local Worker route.
Keep the R2 public development URL disabled for production.

Authentication uses Better Auth with the same D1 binding as recipe storage. Set
`AUTH_SECRET` or `BETTER_AUTH_SECRET` for deployed environments. For the
Vercel-hosted web app, set `WEBSITE_URL` and `BETTER_AUTH_URL` or
`AUTH_BASE_URL` to the Vercel web origin, and include that origin in
`AUTH_TRUSTED_ORIGINS`. If you expose the API directly without the Vercel proxy,
use that API origin instead. Passkeys default to the auth origin hostname unless
`AUTH_PASSKEY_RP_ID` is configured.

Email delivery uses Resend when `RESEND_API_KEY` is available in the Worker
environment or local process environment. Set `RESEND_FROM_EMAIL` to a verified
sender; when omitted, the local default is `OpenCook <onboarding@resend.dev>`.
Verification links, magic links, password reset links, delete-account links, and
OTP codes fall back to Worker console logging only when `RESEND_API_KEY` is unset.
The API dev script loads the repo-root `.env` through Wrangler's `--env-file`;
for deploys, store `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as Worker secrets.

Emails are React Email templates in `apps/api/src/features/emails`, rendered by
the Resend SDK at send time. Preview them locally with
`pnpm --filter @open-cook/api emails:dev`. Links in auth emails redirect back to
the website using `WEBSITE_URL` when set; without it the API falls back to its
own origin (or `http://127.0.0.1:5173` in local dev, matching the Vite server).

New databases start with no recipe rows. The old demo recipes live outside the
migration path in `apps/api/seeds/dev-recipes.sql` and can be loaded into a local
D1 database explicitly:

```bash
pnpm --filter @open-cook/api db:seed:local
```

That seed file should stay dev-only until recipe ownership exists, then it can be
changed to attach rows to a specific Better Auth user.

For bulk import testing without private recipe data, generate a deterministic
StashCook-style export fixture:

```bash
pnpm fixture:stashcook
```

This writes `artifacts/stashcook-export/dev-fixture/recipes.json` with 132 fake
recipes. The `artifacts/` directory is ignored by Git, so the fixture is rebuilt
locally instead of committed. To exercise the browser flow, run the API and web
app, create or sign into a local account, then upload that `recipes.json` file
from the app's StashCook export import control.

To insert the same fixture directly into a local D1 database, first make sure
the local database has a Better Auth user, then run:

```bash
pnpm fixture:stashcook:import:local
```

If your local `.wrangler` state has multiple D1 database files or multiple
users, set `OPEN_COOK_D1_DB` and/or `OPEN_COOK_USER_ID` before running the
import script.

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
- `POST /api/import/stashcook/export`
- `POST /api/import/website`
- `POST /api/import/markdown`
- `POST /api/assets/images/from-url`
- `POST /api/assets/images/mirror-recipes`
- `GET /api/assets/images/:key`
- `GET /api/agents/manifest`
- `POST /api/agents/tools/search-recipes`
- `POST /api/agents/workflows/shopping-list`
- `GET /api/export/recipes/json`
- `GET /api/export/recipes/markdown`
- `GET /api/export/recipes/:id/markdown`

## Codex Usage

This repo includes a Codex plugin at `plugins/opencook` and a repo-local
marketplace at `.agents/plugins/marketplace.json`. The plugin ID is `opencook`
and the displayed product name is OpenCook.

For authenticated APIs, open the API page in the web app and use
`Connect Codex` to create a scoped Codex token. The UI shows the full token only
once and stores only its hash server-side. Configure the plugin with:

```sh
OPEN_COOK_API_BASE=https://open-cook.com
OPEN_COOK_AUTH_TOKEN=your-codex-token
```

For local development, `OPEN_COOK_API_BASE` defaults to
`http://127.0.0.1:8787`. The plugin can also reuse the newest unexpired local D1
Better Auth session when no explicit token or cookie is configured.

The intended demo loop is:

1. Run OpenCook locally or use the hosted Vercel web app backed by the API
   Worker.
2. Install the `opencook` Codex plugin or ask Codex to inspect
   `http://localhost:8787/openapi.json`.
3. Ask Codex to call the API to add, edit, import, or export recipes.
4. Ask Codex to build a new workflow on top of your recipe data, such as a meal
   plan, shopping list, nutrition review, cookbook Markdown export, or a custom
   family recipe UI.

Useful agent entry points:

- `GET /api/agents/manifest`
- `POST /api/agents/tools/search-recipes`
- `POST /api/assets/images/from-url`
- `POST /api/assets/images/mirror-recipes`
- `POST /api/agents/workflows/shopping-list`
- `GET /api/export/recipes/json`
- `GET /api/export/recipes/markdown`

## StashCook Import

OpenCook does not bypass authentication. The hosted StashCook importer calls the
same authenticated browser API that your logged-in web app uses. You provide a
bearer token or cookie from your own session for a one-time import, OpenCook reads
your recipe data server-side, maps it to the OpenCook format, mirrors reachable
recipe images into R2, and saves it locally. Browser CORS does not block this
path because the StashCook request is made by the OpenCook API, not directly by
the web UI.

Users who do not want to send StashCook session credentials to a hosted OpenCook
instance can run the local exporter and upload the generated `recipes.json` file
through the Import page:

```sh
STASHCOOK_ACCESS_TOKEN="..." node scripts/stashcook-export.mjs
```

or:

```sh
STASHCOOK_COOKIE="..." node scripts/stashcook-export.mjs
```

Developers can test the same upload flow without a real StashCook account by
running `pnpm fixture:stashcook` and uploading
`artifacts/stashcook-export/dev-fixture/recipes.json`.

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
