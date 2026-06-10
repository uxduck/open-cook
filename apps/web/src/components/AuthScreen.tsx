import { useNavigate } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthPage } from "../AuthPage";
import { useSession } from "../context/SessionProvider";
import { Button } from "../ui";

export function AuthScreen({ intent }: { intent: "login" | "signup" }) {
  const navigate = useNavigate();
  const { session, sessionLoading, refreshSession, openAuth } = useSession();
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset_password") !== "1") {
      return;
    }
    setPasswordResetToken(url.searchParams.get("token"));
    setPasswordResetError(url.searchParams.get("error"));
  }, []);

  function clearPasswordResetUrl() {
    setPasswordResetToken(null);
    setPasswordResetError(null);
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("reset_password");
    url.searchParams.delete("token");
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <main className="site-shell min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b-2 border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_86%,white)] shadow-[0_2px_0_var(--border)]">
        <div className="mx-auto flex min-h-[70px] w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-xl font-black text-[var(--foreground)]"
            onClick={() => navigate({ to: "/" })}
            type="button"
          >
            <img alt="" className="brand-logo" src="/logo.png" />
            OpenCook
          </button>

          <nav
            className="flex flex-wrap items-center justify-end gap-2"
            aria-label="Account"
          >
            <Button
              aria-current={intent === "login" ? "page" : undefined}
              onClick={() => openAuth("login")}
              size="sm"
            >
              <LogIn size={16} />
              Log in
            </Button>
            <Button
              aria-current={intent === "signup" ? "page" : undefined}
              onClick={() => openAuth("signup")}
              size="sm"
              variant="primary"
            >
              <UserPlus size={16} />
              Register
            </Button>
          </nav>
        </div>
      </header>
      <AuthPage
        intent={intent}
        onPasswordResetComplete={clearPasswordResetUrl}
        onRecipeWorkspace={() => navigate({ to: "/app" })}
        onSessionRefresh={refreshSession}
        passwordResetError={passwordResetError}
        passwordResetToken={passwordResetToken}
        session={session}
        sessionLoading={sessionLoading}
      />
    </main>
  );
}
