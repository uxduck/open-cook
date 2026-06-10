export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username?: string | null;
  displayUsername?: string | null;
  twoFactorEnabled?: boolean | null;
  plan?: string | null;
};

export type CurrentAuthSession = {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    expiresAt: string;
  };
};

export type TwoFactorRedirect = {
  twoFactorRedirect: true;
  twoFactorMethods?: string[];
};

export type TotpEnrollment = {
  totpURI: string;
  backupCodes: string[];
};

type AuthErrorBody = {
  code?: string;
  error?: string;
  message?: string;
};

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    const errorBody = body as AuthErrorBody | undefined;
    throw new AuthRequestError(
      errorBody?.message ??
        errorBody?.error ??
        `${response.status} ${response.statusText}`,
      response.status,
      errorBody?.code,
    );
  }

  return body as T;
}

function authRequest<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(`/api/auth${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    method: "POST",
  });
}

export function isTwoFactorRedirect(value: unknown): value is TwoFactorRedirect {
  return (
    typeof value === "object" &&
    value !== null &&
    "twoFactorRedirect" in value &&
    (value as TwoFactorRedirect).twoFactorRedirect === true
  );
}

export const authApi = {
  async currentSession(): Promise<CurrentAuthSession | null> {
    try {
      return await request<CurrentAuthSession>("/api/me");
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },
  signUpEmail: (input: {
    displayUsername?: string;
    email: string;
    name: string;
    password: string;
    username?: string;
  }) =>
    authRequest<unknown>("/sign-up/email", {
      ...input,
      callbackURL: "/app",
      rememberMe: true,
    }),
  signInEmail: (input: { email: string; password: string }) =>
    authRequest<unknown>("/sign-in/email", {
      ...input,
      rememberMe: true,
    }),
  requestPasswordReset: (input: { email: string; redirectTo: string }) =>
    authRequest<{ status: boolean; message: string }>("/request-password-reset", input),
  resetPassword: (input: { newPassword: string; token: string }) =>
    authRequest<{ status: boolean }>("/reset-password", input),
  signInUsername: (input: { password: string; username: string }) =>
    authRequest<unknown>("/sign-in/username", {
      ...input,
      rememberMe: true,
    }),
  requestMagicLink: (email: string) =>
    authRequest<{ status: boolean }>("/sign-in/magic-link", {
      callbackURL: "/app",
      email,
    }),
  sendEmailOtp: (email: string) =>
    authRequest<{ success: boolean }>("/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    }),
  signInEmailOtp: (input: { email: string; name?: string; otp: string }) =>
    authRequest<unknown>("/sign-in/email-otp", input),
  sendVerificationOtp: (email: string) =>
    authRequest<{ success: boolean }>("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    }),
  verifyEmailOtp: (input: { email: string; otp: string }) =>
    authRequest<unknown>("/email-otp/verify-email", input),
  updateUser: (input: { name: string }) =>
    authRequest<{ status: boolean }>("/update-user", input),
  signOut: () => authRequest<{ success: boolean }>("/sign-out", {}),
  enableTwoFactor: (input: { issuer?: string; password?: string }) =>
    authRequest<TotpEnrollment>("/two-factor/enable", input),
  disableTwoFactor: (input: { password?: string }) =>
    authRequest<{ status: boolean }>("/two-factor/disable", input),
  sendTwoFactorOtp: (trustDevice: boolean) =>
    authRequest<{ status: boolean }>("/two-factor/send-otp", { trustDevice }),
  verifyTwoFactorOtp: (input: { code: string; trustDevice: boolean }) =>
    authRequest<unknown>("/two-factor/verify-otp", input),
  verifyTotp: (input: { code: string; trustDevice: boolean }) =>
    authRequest<unknown>("/two-factor/verify-totp", input),
  verifyBackupCode: (input: { code: string; trustDevice: boolean }) =>
    authRequest<unknown>("/two-factor/verify-backup-code", input),
};
