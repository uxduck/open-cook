import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "../components/onboarding";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingPage,
});
