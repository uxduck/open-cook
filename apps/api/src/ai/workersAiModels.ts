const workersAiTextModel = "@cf/zai-org/glm-4.7-flash";

export const workersAiModels = {
  gatheringDraft: workersAiTextModel,
  gatheringRecipePicker: workersAiTextModel,
  recipeImage: "@cf/black-forest-labs/flux-2-klein-9b",
  recipeRemix: workersAiTextModel,
  recipeStructure: workersAiTextModel,
  websiteImport: workersAiTextModel,
} as const;
