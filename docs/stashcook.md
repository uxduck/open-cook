# StashCook Extraction Notes

This project is for exporting your own StashCook data. It should not bypass
authentication, scrape private accounts without consent, or weaken StashCook
accounts. The importer expects the user to supply credentials from their own
active browser session.

## Public API Surface Found

The StashCook web UI at `https://app.stashcook.com` exposes:

- `PUBLIC_BASE_API_URL=https://api.stashcook.com`
- generated API client methods for recipes, recipe collections, recipe ids,
  recipe extraction results, meals, shopping lists, pantry lists, and profile
  data

Relevant recipe endpoints observed in the public client bundle:

- `GET /recipes`
- `POST /recipes`
- `GET /recipes/{id}`
- `PUT /recipes/{id}`
- `DELETE /recipes/{id}`
- `GET /recipe-ids`
- `GET /recipe-collections`
- `GET /recipe-collections/{id}`
- `GET /recipe-revisions`
- `POST /recipe-extractions/url`
- `POST /recipe-extractions/html`
- `POST /recipe-extractions/text`
- `POST /recipe-extractions/image`

The client sends:

- `api-version: 2025.01.06`
- `Accept-Language`
- browser credentials and/or bearer token depending on session flow

## Current Import Strategy

### Hosted one-time import

1. User logs into StashCook in their browser.
2. User copies their own bearer token or cookie into OpenCook.
3. OpenCook calls `GET /recipes` with:
   - `sortBy=name`
   - `direction=asc`
   - `skip`
   - `take`
   - `expand=Ingredients,Method,Notes,Nutrition`
4. OpenCook fetches recipe detail for rows missing expanded fields.
5. OpenCook maps StashCook rows into the OpenCook recipe JSON shape.
6. OpenCook copies reachable recipe images into public Cloudflare R2.
7. OpenCook writes the recipes into the local store.
8. User exports JSON or Markdown.
9. Codex can then inspect OpenCook's `/openapi.json` and build workflows on the
   imported data without needing StashCook credentials again.

### Local export import

1. User runs `scripts/stashcook-export.mjs` locally with either
   `STASHCOOK_ACCESS_TOKEN` or `STASHCOOK_COOKIE`.
2. The script writes `recipes.json` under `artifacts/stashcook-export/...`.
3. User uploads `recipes.json` through OpenCook's Import page.
4. OpenCook maps those raw rows with the same StashCook mapper, mirrors reachable
   images, and upserts recipes without receiving StashCook session credentials.

## Questions To Resolve With Real Account Access

- Which auth credential is most reliable for a user to copy: bearer token,
  session cookie, refresh token, or all cookies?
- Does `/recipes` return all owned recipes in one account, or are collection
  filters needed to see archived/private/family recipes?
- What is the exact shape of expanded `Ingredients`, `Method`, `Notes`, and
  `Nutrition` data?
- Are images direct URLs, expiring signed URLs, or media IDs that need a second
  download endpoint?
- If StashCook image URLs require auth, which image hosts can safely receive the
  user's StashCook session headers during the one-time R2 copy?
- Are recipe collections important enough to preserve in OpenCook v0.1 as tags,
  folders, or a separate table?
- Do meal plans, shopping lists, pantry items, and notes belong in the first
  export or a later adapter pass?
- Does StashCook rate limit paginated recipe/detail reads?
- Do deleted/archived recipes require an extra query parameter?
- Should importer credentials be accepted only per request, or stored encrypted
  for repeat syncs?
- What should the conflict policy be for repeat imports: StashCook wins, local
  edits win, or preserve both revisions?

## Data Mapping Policy

OpenCook keeps a copy of the raw StashCook row under `source.raw` during import.
That makes the first importer forgiving: if the early mapper misses fields, the
original payload remains available for later migration code.
