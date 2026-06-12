import * as v from "valibot";

const shortPreferenceTextSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(80),
);

const preferenceListSchema = v.array(shortPreferenceTextSchema);

export const dietPatternSchema = v.picklist([
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "flexitarian",
]);

export const spiceLevelSchema = v.picklist(["mild", "medium", "hot", "very-hot"]);

export const cookingSkillLevelSchema = v.picklist([
  "beginner",
  "confident",
  "advanced",
]);

export const foodPreferencesSchema = v.object({
  allergies: preferenceListSchema,
  avoidedIngredients: preferenceListSchema,
  cookingGoals: preferenceListSchema,
  dietaryNeeds: preferenceListSchema,
  dietPattern: dietPatternSchema,
  equipment: preferenceListSchema,
  favoriteCuisines: preferenceListSchema,
  favoriteIngredients: preferenceListSchema,
  householdSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)),
  maxCookTimeMinutes: v.pipe(v.number(), v.integer(), v.minValue(10), v.maxValue(180)),
  skillLevel: cookingSkillLevelSchema,
  spiceLevel: spiceLevelSchema,
});

export const userFoodPreferencesSchema = v.object({
  preferences: foodPreferencesSchema,
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const userFoodPreferencesLookupSchema = v.object({
  preferences: v.nullable(foodPreferencesSchema),
  updatedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export type FoodPreferences = v.InferOutput<typeof foodPreferencesSchema>;
export type FoodPreferencesInput = v.InferInput<typeof foodPreferencesSchema>;
export type UserFoodPreferences = v.InferOutput<typeof userFoodPreferencesSchema>;
export type UserFoodPreferencesLookup = v.InferOutput<
  typeof userFoodPreferencesLookupSchema
>;

export const defaultFoodPreferences: FoodPreferences = {
  allergies: [],
  avoidedIngredients: [],
  cookingGoals: ["Weeknight dinners"],
  dietaryNeeds: [],
  dietPattern: "omnivore",
  equipment: ["Oven", "Stovetop"],
  favoriteCuisines: [],
  favoriteIngredients: [],
  householdSize: 2,
  maxCookTimeMinutes: 45,
  skillLevel: "confident",
  spiceLevel: "medium",
};
