import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi, type CurrentAuthSession } from "../authApi";
import { errorMessage } from "../lib/recipe";

type AuthIntent = "login" | "signup";

type SessionContextValue = {
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
  sessionError: string | null;
  refreshSession: () => Promise<CurrentAuthSession | null>;
  signOut: () => Promise<void>;
  openAuth: (intent: AuthIntent) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const serverSessionContext: SessionContextValue = {
  session: null,
  sessionLoading: false,
  sessionError: null,
  refreshSession: async () => null,
  signOut: async () => undefined,
  openAuth: () => undefined,
};

export function useSession(): SessionContextValue {
  if (typeof window === "undefined") {
    return serverSessionContext;
  }

  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<CurrentAuthSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const nextSession = await authApi.currentSession();
      setSession(nextSession);
      setSessionError(null);
      return nextSession;
    } catch (error) {
      setSession(null);
      setSessionError(errorMessage(error));
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // The session is resolved on the client only; SSR renders the logged-out shell
  // and hydration fills it in (the auth cookie lives in the browser).
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
      await refreshSession();
      void navigate({ to: "/login" });
    } catch {
      // Surface nothing here; the workspace shows its own status line.
    }
  }, [navigate, refreshSession]);

  const openAuth = useCallback(
    (intent: AuthIntent) => {
      void navigate({ to: intent === "signup" ? "/register" : "/login" });
    },
    [navigate],
  );

  return (
    <SessionContext.Provider
      value={{
        session,
        sessionLoading,
        sessionError,
        refreshSession,
        signOut,
        openAuth,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
