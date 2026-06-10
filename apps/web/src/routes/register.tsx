import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";

export const Route = createFileRoute("/register")({
  ssr: false,
  component: () => <AuthScreen intent="signup" />,
});
