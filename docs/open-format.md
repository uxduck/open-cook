# OpenCook Recipe Format

The canonical OpenCook recipe format is JSON. Markdown is an export and import
format for humans.

```ts
type Recipe = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string; // preferably an OpenCook-owned public R2 URL
  source?: {
    name?: string;
    url?: string;
    externalId?: string;
    importedAt?: string;
    raw?: Record<string, unknown>;
  };
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: string;
  tags: string[];
  ingredients: { section?: string; text: string }[];
  steps: { section?: string; text: string }[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
};
```

The format is deliberately boring:

- Ingredients and steps keep original text first.
- Recipe photos can be mirrored into public R2 URLs, so image ownership follows
  the recipe data without signed URL plumbing.
- Structured nutrition, unit conversion, meal plans, and collection hierarchy can
  be layered in later.
- Imported source payloads can be retained under `source.raw` until the mapper is
  mature.
- Codex and other agents can use this format directly through OpenAPI, JSON
  export, or Markdown export.
