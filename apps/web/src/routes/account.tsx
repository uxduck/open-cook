import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "../context/SessionProvider";

export const Route = createFileRoute("/account")({
  ssr: false,
  component: AccountRedirect,
});

function AccountRedirect() {
  const navigate = useNavigate();
  const { session, sessionLoading } = useSession();

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!session) {
      void navigate({ replace: true, to: "/login" });
      return;
    }

    void navigate({
      replace: true,
      search: { page: "billing" },
      to: "/app",
    });
  }, [navigate, session, sessionLoading]);

  return null;
}
