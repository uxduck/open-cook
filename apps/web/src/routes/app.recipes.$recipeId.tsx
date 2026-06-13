import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/recipes/$recipeId")({
  component: () => null,
});
