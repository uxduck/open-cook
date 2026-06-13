import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/gatherings/$gatheringId/share")({
  component: () => null,
});
