import type { Recipe, RecipeIngredient, RecipeQuantity, RecipeStep } from "./recipe";

export type RecipeYield = {
  quantity?: number;
  unit?: string;
  text: string;
};

const unitAliasEntries = [
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["kg", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["ml", "ml"],
  ["millilitre", "ml"],
  ["millilitres", "ml"],
  ["milliliter", "ml"],
  ["milliliters", "ml"],
  ["l", "l"],
  ["litre", "l"],
  ["litres", "l"],
  ["liter", "l"],
  ["liters", "l"],
  ["tsp", "tsp"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["tbsp", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["oz", "oz"],
  ["ounce", "oz"],
  ["ounces", "oz"],
  ["lb", "lb"],
  ["lbs", "lb"],
  ["pound", "lb"],
  ["pounds", "lb"],
  ["clove", "clove"],
  ["cloves", "clove"],
  ["pinch", "pinch"],
  ["pinches", "pinch"],
  ["handful", "handful"],
  ["handfuls", "handful"],
  ["can", "can"],
  ["cans", "can"],
  ["tin", "tin"],
  ["tins", "tin"],
  ["packet", "packet"],
  ["packets", "packet"],
  ["package", "package"],
  ["packages", "package"],
  ["slice", "slice"],
  ["slices", "slice"],
  ["bunch", "bunch"],
  ["bunches", "bunch"],
  ["sprig", "sprig"],
  ["sprigs", "sprig"],
] satisfies Array<readonly [string, string]>;

const unitAliases = new Map(
  [...unitAliasEntries].sort((a, b) => b[0].length - a[0].length),
);

const nonScalingPhrases = [
  "to taste",
  "as needed",
  "as required",
  "optional",
  "for serving",
  "for garnish",
];

const equipmentWords = [
  "air fryer",
  "baking tray",
  "blender",
  "bowl",
  "griddle",
  "microwave",
  "oven",
  "pan",
  "pot",
  "saucepan",
  "skillet",
  "tray",
];

export function structureRecipe(recipe: Recipe): Recipe {
  const ingredients = structureIngredients(recipe.ingredients);
  return {
    ...recipe,
    ingredients,
    steps: structureSteps(recipe.steps, ingredients),
  };
}

export function parseRecipeYield(value?: string): RecipeYield | undefined {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }

  const match = /^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s*(.*)$/.exec(
    normalizeFractions(text),
  );
  if (!match) {
    return { text };
  }

  return {
    quantity: parseQuantityValue(match[1] ?? ""),
    unit: match[2]?.trim() || undefined,
    text,
  };
}

export function servingScaleFactor(baseServings?: string, targetQuantity?: number) {
  const parsed = parseRecipeYield(baseServings);
  if (!parsed?.quantity || !targetQuantity || targetQuantity <= 0) {
    return 1;
  }
  return targetQuantity / parsed.quantity;
}

export function structureIngredients(
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  return ingredients
    .filter((ingredient) => ingredient.text.trim())
    .map((ingredient, index) => {
      const parsed = parseIngredientLine(ingredient.text);
      return cleanIngredient({
        ...parsed,
        ...ingredient,
        id: ingredient.id || `ingredient-${index + 1}`,
        quantity: ingredient.quantity ?? parsed.quantity,
        item: ingredient.item ?? parsed.item,
        preparation: ingredient.preparation ?? parsed.preparation,
        note: ingredient.note ?? parsed.note,
        scalable: ingredient.scalable ?? parsed.scalable,
        confidence: ingredient.confidence ?? parsed.confidence,
        warnings: mergeWarnings(parsed.warnings, ingredient.warnings),
      });
    });
}

export function parseIngredientLine(text: string): RecipeIngredient {
  const cleaned = cleanRecipeLine(text);
  const warnings: string[] = [];
  const lower = cleaned.toLowerCase();
  const scalable = !nonScalingPhrases.some((phrase) => lower.includes(phrase));
  const match = /^((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?))\s*(.*)$/.exec(
    normalizeFractions(cleaned),
  );

  if (!match) {
    if (looksLikeCombinedIngredients(cleaned)) {
      warnings.push("This line may contain more than one ingredient.");
    }
    return cleanIngredient({
      text: cleaned,
      item: cleaned,
      scalable: false,
      confidence: warnings.length ? 0.45 : 0.58,
      warnings,
    });
  }

  const valueText = (match[1] ?? "").trim();
  const value = parseQuantityValue(valueText);
  const remainder = (match[2] ?? "").trim();
  const { unit, itemText } = extractUnit(remainder);
  const { item, preparation, note } = splitIngredientDetails(itemText);

  if (!item) {
    warnings.push("Ingredient name could not be identified.");
  }
  if (!unit && /\d/.test(remainder)) {
    warnings.push("Quantity has extra text that may need review.");
  }

  return cleanIngredient({
    text: cleaned,
    quantity: {
      value,
      valueText,
      unit,
    },
    item: item || remainder,
    preparation,
    note,
    scalable: scalable && value !== undefined,
    confidence: item ? (unit ? 0.9 : 0.78) : 0.48,
    warnings,
  });
}

export function structureSteps(
  steps: RecipeStep[],
  ingredients: RecipeIngredient[],
): RecipeStep[] {
  return steps
    .filter((step) => step.text.trim())
    .map((step, index) => {
      const parsed = parseStepLine(step.text, ingredients);
      return cleanStep({
        ...parsed,
        ...step,
        id: step.id || `step-${index + 1}`,
        ingredientIds: step.ingredientIds ?? parsed.ingredientIds,
        timers: step.timers ?? parsed.timers,
        temperature: step.temperature ?? parsed.temperature,
        equipment: step.equipment ?? parsed.equipment,
        confidence: step.confidence ?? parsed.confidence,
        warnings: mergeWarnings(parsed.warnings, step.warnings),
      });
    });
}

export function parseStepLine(
  text: string,
  ingredients: RecipeIngredient[] = [],
): RecipeStep {
  const cleaned = cleanRecipeLine(text);
  const lower = cleaned.toLowerCase();
  const timers = extractTimers(cleaned);
  const temperature = extractTemperature(cleaned);
  const equipment = equipmentWords.filter((word) => lower.includes(word));
  const ingredientIds = ingredients
    .filter((ingredient) => ingredient.id && ingredientMentioned(lower, ingredient))
    .map((ingredient) => ingredient.id as string);

  return cleanStep({
    text: cleaned,
    ingredientIds,
    timers,
    temperature,
    equipment,
    confidence: ingredientIds.length || timers.length || temperature ? 0.75 : 0.58,
    warnings: [],
  });
}

export function ingredientDisplayText(ingredient: RecipeIngredient, scale = 1) {
  const quantity = scaledQuantity(ingredient.quantity, scale);
  const parts = [
    quantity,
    ingredient.item?.trim(),
    ingredient.preparation ? `, ${ingredient.preparation.trim()}` : "",
    ingredient.note ? ` (${ingredient.note.trim()})` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" ").replace(/\s+,/g, ",") : ingredient.text;
}

export function ingredientBaseText(ingredient: RecipeIngredient) {
  return ingredientDisplayText(ingredient, 1);
}

export function scaledQuantity(quantity?: RecipeQuantity, scale = 1) {
  if (!quantity) {
    return "";
  }
  const unit = quantity.unit?.trim();
  const value =
    typeof quantity.value === "number" && Number.isFinite(quantity.value)
      ? formatQuantityNumber(quantity.value * scale)
      : quantity.valueText?.trim();
  return [value, unit].filter(Boolean).join(" ");
}

function cleanIngredient(ingredient: RecipeIngredient): RecipeIngredient {
  return {
    ...ingredient,
    id: emptyToUndefined(ingredient.id),
    section: emptyToUndefined(ingredient.section),
    text: ingredient.text.trim(),
    quantity: cleanQuantity(ingredient.quantity),
    item: emptyToUndefined(ingredient.item),
    preparation: emptyToUndefined(ingredient.preparation),
    note: emptyToUndefined(ingredient.note),
    warnings: ingredient.warnings?.filter(Boolean),
  };
}

function cleanStep(step: RecipeStep): RecipeStep {
  return {
    ...step,
    id: emptyToUndefined(step.id),
    section: emptyToUndefined(step.section),
    text: step.text.trim(),
    ingredientIds: step.ingredientIds?.filter(Boolean),
    timers: step.timers?.filter((timer) => timer.minutes > 0),
    equipment: step.equipment?.filter(Boolean),
    warnings: step.warnings?.filter(Boolean),
  };
}

function cleanQuantity(quantity?: RecipeQuantity): RecipeQuantity | undefined {
  if (!quantity) {
    return undefined;
  }
  const clean = {
    value: quantity.value,
    valueText: emptyToUndefined(quantity.valueText),
    unit: emptyToUndefined(quantity.unit),
  };
  return clean.value !== undefined || clean.valueText || clean.unit ? clean : undefined;
}

function cleanRecipeLine(value: string) {
  return value
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFractions(value: string) {
  return value
    .replace(/\u00bc/g, "1/4")
    .replace(/\u00bd/g, "1/2")
    .replace(/\u00be/g, "3/4")
    .replace(/\u2153/g, "1/3")
    .replace(/\u2154/g, "2/3")
    .replace(/\u215b/g, "1/8")
    .replace(/\u215c/g, "3/8")
    .replace(/\u215d/g, "5/8")
    .replace(/\u215e/g, "7/8");
}

function parseQuantityValue(value: string) {
  const clean = value.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(clean);
  if (mixed) {
    return Number(mixed[1] ?? 0) + Number(mixed[2] ?? 0) / Number(mixed[3] ?? 1);
  }

  const fraction = /^(\d+)\/(\d+)$/.exec(clean);
  if (fraction) {
    return Number(fraction[1] ?? 0) / Number(fraction[2] ?? 1);
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractUnit(value: string) {
  const lower = value.toLowerCase();
  for (const [alias, unit] of unitAliases) {
    const pattern = new RegExp(`^${escapeRegExp(alias)}\\b\\.?\\s*`, "i");
    if (pattern.test(lower)) {
      return {
        unit,
        itemText: value.replace(pattern, "").trim(),
      };
    }
  }

  return { unit: undefined, itemText: value };
}

function splitIngredientDetails(value: string) {
  const noteMatch = /^(.*?)\s*\((.*?)\)\s*$/.exec(value);
  const withoutNote = noteMatch?.[1]?.trim() ?? value;
  const note = noteMatch?.[2]?.trim();
  const commaParts = withoutNote
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length > 1) {
    const item = commaParts[0];
    return {
      item,
      preparation: commaParts.slice(1).join(", "),
      note,
    };
  }

  return {
    item: withoutNote.trim(),
    preparation: undefined,
    note,
  };
}

function looksLikeCombinedIngredients(value: string) {
  const commaCount = (value.match(/,/g) ?? []).length;
  return commaCount >= 2 || /\s+(and|or)\s+/i.test(value);
}

function extractTimers(text: string): NonNullable<RecipeStep["timers"]> {
  const timers: NonNullable<RecipeStep["timers"]> = [];
  const matches = text.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(minutes?|mins?|hours?|hrs?)\b/gi,
  );

  for (const match of matches) {
    const first = Number(match[1] ?? 0);
    const second = match[2] ? Number(match[2]) : first;
    const value = (first + second) / 2;
    const unit = (match[3] ?? "").toLowerCase();
    timers.push({
      minutes: unit.startsWith("hour") || unit.startsWith("hr") ? value * 60 : value,
    });
  }

  return timers;
}

function extractTemperature(text: string): RecipeStep["temperature"] {
  const match = /(\d{2,3})\s*(?:\u00b0\s*)?([CF])\b/i.exec(text);
  if (!match) {
    return undefined;
  }
  return {
    value: Number(match[1] ?? 0),
    unit: (match[2] ?? "C").toUpperCase() as "C" | "F",
  };
}

function ingredientMentioned(lowerStepText: string, ingredient: RecipeIngredient) {
  const candidates = [ingredient.item, ingredient.text]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.toLowerCase().split(/,|\sand\s/))
    .map((value) => value.trim())
    .filter((value) => value.length > 2 && !unitAliases.has(value));

  return candidates.some((candidate) =>
    new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "i").test(lowerStepText),
  );
}

function formatQuantityNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(2))).replace(/\.0+$/, "");
}

function emptyToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function mergeWarnings(
  first: string[] | undefined,
  second: string[] | undefined,
): string[] | undefined {
  const merged = [...(first ?? []), ...(second ?? [])].filter(Boolean);
  return merged.length ? [...new Set(merged)] : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
