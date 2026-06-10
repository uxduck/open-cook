import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "../components/AuthScreen";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: () => <AuthScreen intent="login" />,
});
