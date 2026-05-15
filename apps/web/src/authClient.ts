import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

const baseURL =
  typeof window === "undefined" ? "http://localhost:5173" : window.location.origin;

type AuthClientResult = Promise<{
  data: unknown;
  error: { message?: string; status?: number; statusText: string } | null;
}>;

type OpenCookAuthClient = {
  passkey: {
    addPasskey(input?: { name?: string }): AuthClientResult;
  };
  signIn: {
    passkey(): AuthClientResult;
  };
};

export const authClient = createAuthClient({
  basePath: "/api/auth",
  baseURL,
  plugins: [passkeyClient()],
}) as unknown as OpenCookAuthClient;
