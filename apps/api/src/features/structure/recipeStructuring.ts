import {
  ingredientBaseText,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
  structureRecipe,
} from "@open-cook/core";
import {
  type WorkersAiBinding as RecipeAiBinding,
  workersAiResponseObject,
} from "../../ai/workersAiResponses";

type RecipeStructuringOptions = {
  ai?: RecipeAiBinding;
  model?: string;
};

const defaultRecipeStructureModel = "@cf/moonshotai/kimi-k2.6";

export async function structureRecipeWithAi(
  recipe: Recipe,
  options: RecipeStructuringOptions = {},
): Promise<Recipe> {
  const deterministicRecipe = structureRecipe(recipe);

  if (!options.ai) {
    return deterministicRecipe;
  }

  try {
    const model = options.model || defaultRecipeStructureModel;
    const result = await options.ai.run(model, {
      max_completion_tokens: 3200,
      messages: [
        {
          role: "system",
          content:
            "You structure recipe ingredients and method steps. Preserve source lines. Return only fields supported by the JSON schema. Do not invent missing ingredients or method steps; flag uncertainty in warnings.",
        },
        {
          role: "user",
          content: `Structure this recipe for serving scaling and import review.

Recipe title: ${deterministicRecipe.title}
Servings: ${deterministicRecipe.servings ?? ""}

Ingredients, in order:
${deterministicRecipe.ingredients
  .map((ingredient, index) => `${index + 1}. ${ingredient.text}`)
  .join("\n")}

Method steps, in order:
${deterministicRecipe.steps.map((step, index) => `${index + 1}. ${step.text}`).join("\n")}

Rules:
- Keep array order exactly the same.
- Use null or omit a field when unknown.
- Put ingredientIndexes on steps using zero-based ingredient indexes.
- Use scalable=false for "to taste", garnish, optional, or non-quantity lines.
- Warnings should be short and specific.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          description:
            "Ingredient and method-step structure for serving scaling and import review.",
          name: "RecipeStructure",
          schema: recipeStructureJsonSchema,
          strict: false,
        },
      },
      temperature: 0.1,
    });

    const parsed = workersAiResponseObject(result);
    if (!parsed) {
      return deterministicRecipe;
    }

    return mergeAiStructure(deterministicRecipe, parsed);
  } catch {
    return deterministicRecipe;
  }
}

function mergeAiStructure(recipe: Recipe, value: Record<string, unknown>): Recipe {
  const aiIngredients = Array.isArray(value.ingredients) ? value.ingredients : [];
  const ingredients = recipe.ingredients.map((ingredient, index) =>
    mergeIngredient(ingredient, aiIngredients[index]),
  );

  const aiSteps = Array.isArray(value.steps) ? value.steps : [];
  const steps = recipe.steps.map((step, index) =>
    mergeStep(step, aiSteps[index], ingredients),
  );

  return {
    ...recipe,
    ingredients,
    steps,
  };
}

function mergeIngredient(
  ingredient: RecipeIngredient,
  value: unknown,
): RecipeIngredient {
  if (!isRecord(value)) {
    return ingredient;
  }

  const quantity = isRecord(value.quantity)
    ? {
        value: numberField(value.quantity.value) ?? ingredient.quantity?.value,
        valueText:
          stringField(value.quantity.valueText) ?? ingredient.quantity?.valueText,
        unit: stringField(value.quantity.unit) ?? ingredient.quantity?.unit,
      }
    : ingredient.quantity;

  return {
    ...ingredient,
    quantity,
    item: stringField(value.item) ?? ingredient.item,
    preparation: stringField(value.preparation) ?? ingredient.preparation,
    note: stringField(value.note) ?? ingredient.note,
    scalable: booleanField(value.scalable) ?? ingredient.scalable,
    confidence: numberField(value.confidence) ?? ingredient.confidence,
    warnings: mergeWarnings(ingredient.warnings, stringArray(value.warnings)),
  };
}

function mergeStep(
  step: RecipeStep,
  value: unknown,
  ingredients: RecipeIngredient[],
): RecipeStep {
  if (!isRecord(value)) {
    return step;
  }

  const ingredientIndexes = numberArray(value.ingredientIndexes);
  const ingredientIds = ingredientIndexes.length
    ? ingredientIndexes
        .map((index) => ingredients[index]?.id)
        .filter((id): id is string => Boolean(id))
    : step.ingredientIds;

  return {
    ...step,
    ingredientIds,
    timers: timersField(value.timers) ?? step.timers,
    temperature: temperatureField(value.temperature) ?? step.temperature,
    equipment: stringArray(value.equipment) ?? step.equipment,
    confidence: numberField(value.confidence) ?? step.confidence,
    warnings: mergeWarnings(step.warnings, stringArray(value.warnings)),
  };
}

function timersField(value: unknown): RecipeStep["timers"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const timers = value
    .filter(isRecord)
    .map((timer) => ({
      label: stringField(timer.label),
      minutes: numberField(timer.minutes) ?? 0,
    }))
    .filter((timer) => timer.minutes > 0);
  return timers.length ? timers : undefined;
}

function temperatureField(value: unknown): RecipeStep["temperature"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const unit = stringField(value.unit)?.toUpperCase();
  const number = numberField(value.value);
  if (!number || (unit !== "C" && unit !== "F")) {
    return undefined;
  }
  return { value: number, unit };
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanField(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return strings.length ? strings : undefined;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(numberField)
    .filter((item): item is number => item !== undefined)
    .map(Math.floor)
    .filter((item) => item >= 0);
}

function mergeWarnings(
  first: string[] | undefined,
  second: string[] | undefined,
): string[] | undefined {
  const warnings = [...(first ?? []), ...(second ?? [])].filter(Boolean);
  return warnings.length ? [...new Set(warnings)] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const recipeStructureJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: ["string", "null"] },
          preparation: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          scalable: { type: "boolean" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          warnings: { type: "array", items: { type: "string" } },
          quantity: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              value: { type: ["number", "null"] },
              valueText: { type: ["string", "null"] },
              unit: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ingredientIndexes: {
            type: "array",
            items: { type: "integer", minimum: 0 },
          },
          timers: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: ["string", "null"] },
                minutes: { type: "number", minimum: 0 },
              },
              required: ["minutes"],
            },
          },
          temperature: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              value: { type: "number", minimum: 0 },
              unit: { type: "string", enum: ["C", "F"] },
            },
            required: ["value", "unit"],
          },
          equipment: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  required: ["ingredients", "steps"],
} as const;

export function recipeStructureSummary(recipe: Recipe) {
  const structuredIngredients = recipe.ingredients.filter((ingredient) => {
    const baseText = ingredientBaseText(ingredient);
    return Boolean(
      ingredient.quantity || ingredient.item || baseText !== ingredient.text,
    );
  }).length;
  const structuredSteps = recipe.steps.filter(
    (step) =>
      Boolean(step.ingredientIds?.length) ||
      Boolean(step.timers?.length) ||
      Boolean(step.temperature) ||
      Boolean(step.equipment?.length),
  ).length;

  return {
    ingredients: structuredIngredients,
    steps: structuredSteps,
    warnings: [
      ...recipe.ingredients.flatMap((ingredient) => ingredient.warnings ?? []),
      ...recipe.steps.flatMap((step) => step.warnings ?? []),
    ],
  };
}
