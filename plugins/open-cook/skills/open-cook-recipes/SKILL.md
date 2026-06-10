---
name: open-cook-recipes
description: Use OpenCook recipe tools to find recipes, add recipes from images or text, and safely revise existing recipes.
---

# OpenCook Recipes

Use this skill when the user asks about their OpenCook recipes, wants to add a recipe, shares a recipe image/screenshot, or asks to rework an existing recipe.

## Workflow

1. If the API state is unclear, call `open_cook_status`.
2. To answer recipe questions, use `search_recipes` first for compact discovery, then `get_recipe` for the specific recipe ids needed. Use `list_recipes` when you need an unranked library listing.
3. For recipe images, read the attached image in the conversation, extract the recipe fields, and call `create_recipe`. Preserve uncertainty in `notes` instead of inventing missing quantities, times, or temperatures.
4. For pasted text or user-described recipes, normalize into OpenCook fields and call `create_recipe`.
5. For website URLs, prefer `import_recipe_from_website`.
6. For rehashing an existing recipe, call `get_recipe`, draft the changed fields, call `preview_recipe_update`, show the meaningful changes, and only call `update_recipe` after the user confirms.

## Recipe Style

- Keep ingredient lines specific and human-readable.
- Keep steps ordered and practical.
- Preserve source metadata unless the user asks to remove or replace it.
- Prefer tags that help retrieval, such as cuisine, meal type, dietary constraint, or effort level.
- Do not delete notes, ingredients, or steps during a rework unless the user explicitly asks for that.

## API Setup

The MCP server defaults to `http://127.0.0.1:8787`. If OpenCook is running elsewhere, set `OPEN_COOK_API_BASE`. If the API requires auth, set `OPEN_COOK_AUTH_TOKEN` or `OPEN_COOK_COOKIE`. The bridge reads these variables from the process environment, then from the repo's ignored `.env.local` and `.env` files.
