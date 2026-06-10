import { BadgeCheck, CircleAlert, KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AuthRequestError,
  authApi,
  type CurrentAuthSession,
  isTwoFactorRedirect,
} from "./authApi";
import { Button } from "./ui";

type AuthIntent = "signup" | "login" | null;
type AuthView = "signup" | "login";

const authPageClassName =
  "grid min-h-[calc(100vh-70px)] w-full place-items-start bg-[linear-gradient(180deg,color-mix(in_oklch,var(--background)_88%,white),var(--background))] px-4 text-[var(--foreground)] sm:px-6";
const authCenterClassName =
  "mx-auto w-full max-w-[390px] pb-14 pt-[clamp(56px,14vh,124px)]";
const authCardClassName =
  "grid w-full gap-[17px] rounded-lg border-2 border-[var(--border)] bg-[var(--card)] p-[22px] text-[var(--foreground)] shadow-[var(--shadow-pop)]";
const titleBlockClassName = "grid gap-2 text-left";
const titleClassName =
  "[font-family:var(--font-display)] text-[2rem] font-bold leading-[1.04] tracking-normal text-[var(--foreground)]";
const subtitleClassName = "m-0 text-[13px] text-[var(--muted-foreground)]";
const formClassName = "grid gap-[13px]";
const labelClassName =
  "grid gap-1.5 text-[13px] font-extrabold text-[var(--foreground)]";
const inputClassName =
  "min-h-[42px] w-full rounded-lg border-2 border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_54%,white)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-[2px_2px_0_var(--border)] outline-none placeholder:text-[var(--muted-foreground)] focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklch,var(--ring)_54%,white)]";
const fieldLabelRowClassName = "flex items-center justify-between gap-2.5";
const textButtonClassName =
  "inline-flex min-h-0 rounded-none border-0 bg-transparent p-0 text-[var(--primary)] underline-offset-2 hover:text-[var(--accent-dark)] hover:underline";
const authAltClassName =
  "m-0 flex flex-wrap items-center justify-center gap-1 text-[13px] text-[var(--muted-foreground)]";
const inlinePanelClassName = "grid gap-3 border-t-2 border-[var(--border)] pt-3.5";
const inlinePanelTitleClassName =
  "m-0 text-[13px] font-extrabold leading-tight text-[var(--foreground)]";
const actionsClassName = "grid gap-2";
const noticeBaseClassName =
  "flex items-center gap-2 rounded-lg border-2 border-[var(--border)] px-3 py-2.5 text-[13px] font-extrabold text-[var(--foreground)] shadow-[2px_2px_0_var(--border)]";
const noticeSuccessClassName = "bg-[color-mix(in_oklch,var(--pop-green)_14%,white)]";
const noticeErrorClassName = "bg-[color-mix(in_oklch,var(--destructive)_14%,white)]";
const trustDeviceClassName =
  "flex items-center gap-2 text-[13px] font-extrabold text-[var(--muted-foreground)] [&_input]:accent-[var(--primary)]";
const methodStripClassName = "flex flex-wrap gap-1.5";
const methodChipClassName =
  "rounded-full border-2 border-[var(--border)] bg-[color-mix(in_oklch,var(--secondary)_18%,white)] px-2 py-1 text-[11px] font-extrabold text-[var(--foreground)]";

type AuthPageProps = {
  intent?: AuthIntent;
  onRecipeWorkspace: () => void;
  onPasswordResetComplete?: () => void;
  onSessionRefresh: () => Promise<CurrentAuthSession | null>;
  passwordResetError?: string | null;
  passwordResetToken?: string | null;
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
};

function defaultNameForEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  return localPart || "OpenCook user";
}

function passwordResetRedirectTo() {
  if (typeof window === "undefined") {
    return "/?reset_password=1";
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("reset_password", "1");
  return url.href;
}

function authErrorMessage(error: unknown) {
  if (
    error instanceof AuthRequestError &&
    (error.code === "EMAIL_NOT_VERIFIED" || error.message === "Email not verified")
  ) {
    return "Please verify your email before logging in. Check your inbox for the OpenCook verification link; we sent a new one if enough time has passed.";
  }

  return error instanceof Error ? error.message : "Authentication request failed";
}

function isErrorNotice(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("not verified") ||
    normalized.includes("verify your email") ||
    normalized.includes("failed") ||
    normalized.includes("do not match") ||
    normalized.startsWith("enter ") ||
    normalized.startsWith("open ")
  );
}

export function AuthPage({
  intent = null,
  onRecipeWorkspace,
  onPasswordResetComplete,
  onSessionRefresh,
  passwordResetError = null,
  passwordResetToken: passwordResetTokenFromUrl = null,
  session,
  sessionLoading,
}: AuthPageProps) {
  const [view, setView] = useState<AuthView>(intent === "signup" ? "signup" : "login");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);
  const [trustDevice, setTrustDevice] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(
    Boolean(passwordResetTokenFromUrl || passwordResetError),
  );
  const [passwordResetToken, setPasswordResetToken] = useState(
    passwordResetTokenFromUrl ?? "",
  );
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");

  useEffect(() => {
    if (!intent) {
      return;
    }

    setView(intent === "signup" ? "signup" : "login");
  }, [intent]);

  useEffect(() => {
    if (passwordResetTokenFromUrl) {
      setPasswordResetToken(passwordResetTokenFromUrl);
      setShowPasswordReset(true);
      setView("login");
      setNotice("Choose a new password.");
      return;
    }

    if (passwordResetError) {
      setShowPasswordReset(true);
      setView("login");
      setNotice(`Password reset link failed: ${passwordResetError}`);
    }
  }, [passwordResetError, passwordResetTokenFromUrl]);

  useEffect(() => {
    if (
      !sessionLoading &&
      session &&
      !passwordResetTokenFromUrl &&
      !passwordResetError
    ) {
      onRecipeWorkspace();
    }
  }, [
    onRecipeWorkspace,
    passwordResetError,
    passwordResetTokenFromUrl,
    session,
    sessionLoading,
  ]);

  async function runAction(
    action: string,
    task: () => Promise<unknown>,
    successMessage: string,
    refresh = true,
  ) {
    setPendingAction(action);
    try {
      const result = await task();

      if (isTwoFactorRedirect(result)) {
        setTwoFactorMethods(result.twoFactorMethods ?? ["totp", "otp"]);
        setNotice("Two-factor verification required.");
        return;
      }

      if (
        typeof result === "object" &&
        result !== null &&
        "data" in result &&
        isTwoFactorRedirect((result as { data?: unknown }).data)
      ) {
        const data = (result as { data: { twoFactorMethods?: string[] } }).data;
        setTwoFactorMethods(data.twoFactorMethods ?? ["totp", "otp"]);
        setNotice("Two-factor verification required.");
        return;
      }

      setNotice(successMessage);
      if (refresh) {
        await onSessionRefresh();
      }
    } catch (error) {
      setNotice(authErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePrimaryAuth() {
    if (!email || !password) {
      setNotice("Enter email and password.");
      return;
    }

    if (view === "login") {
      await runAction(
        "email-sign-in",
        () => authApi.signInEmail({ email, password }),
        "Signed in.",
      );
      return;
    }

    await runAction(
      "email-sign-up",
      () =>
        authApi.signUpEmail({
          email,
          name: name.trim() || defaultNameForEmail(email),
          password,
        }),
      "Account created. Check your email for the verification link.",
      false,
    );
  }

  async function handleRequestPasswordReset() {
    if (!email) {
      setNotice("Enter your account email first.");
      return;
    }

    setShowPasswordReset(true);
    await runAction(
      "password-reset-request",
      () =>
        authApi.requestPasswordReset({
          email,
          redirectTo: passwordResetRedirectTo(),
        }),
      "Reset email sent.",
      false,
    );
  }

  async function handleResetPassword() {
    if (!passwordResetToken) {
      setNotice("Open the reset link from your email first.");
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      setNotice("New passwords do not match.");
      return;
    }

    await runAction(
      "password-reset-submit",
      async () => {
        const result = await authApi.resetPassword({
          newPassword,
          token: passwordResetToken,
        });
        setPasswordResetToken("");
        setNewPassword("");
        setNewPasswordConfirmation("");
        setPassword("");
        setShowPasswordReset(false);
        setView("login");
        onPasswordResetComplete?.();
        return result;
      },
      "Password reset. Log in with your new password.",
      false,
    );
  }

  const busy = Boolean(pendingAction);
  const primaryDisabled = busy;

  return (
    <section className={authPageClassName}>
      <div className={authCenterClassName}>
        <section className={authCardClassName} aria-labelledby="auth-title">
          <div className={titleBlockClassName}>
            <h1 className={titleClassName} id="auth-title">
              {view === "signup"
                ? "Create your OpenCook account"
                : "Log in to OpenCook"}
            </h1>
            <p className={subtitleClassName}>Use email and password to continue.</p>
          </div>

          <form
            className={formClassName}
            onSubmit={(event) => {
              event.preventDefault();
              void handlePrimaryAuth();
            }}
          >
            {view === "signup" ? (
              <label className={labelClassName}>
                Name
                <input
                  className={inputClassName}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Optional"
                  value={name}
                />
              </label>
            ) : null}

            <label className={labelClassName}>
              Email
              <input
                className={inputClassName}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            <label className={labelClassName}>
              <span className={fieldLabelRowClassName}>
                <span>Password</span>
                {view === "login" ? (
                  <button
                    className={textButtonClassName}
                    type="button"
                    onClick={() => setShowPasswordReset((current) => !current)}
                  >
                    {showPasswordReset ? "Cancel reset" : "Forgot?"}
                  </button>
                ) : null}
              </span>
              <input
                className={inputClassName}
                autoComplete={view === "signup" ? "new-password" : "current-password"}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>

            <Button
              className="min-h-[42px]!"
              disabled={primaryDisabled}
              fullWidth
              type="submit"
              variant="primary"
            >
              {busy ? <Loader2 className="animate-spin" size={15} /> : null}
              {pendingAction === "email-sign-in"
                ? "Signing in"
                : pendingAction === "email-sign-up"
                  ? "Creating"
                  : view === "signup"
                    ? "Create account"
                    : "Log in"}
            </Button>
          </form>

          {view === "login" && showPasswordReset ? (
            <PasswordResetPanel
              busy={busy}
              email={email}
              newPassword={newPassword}
              newPasswordConfirmation={newPasswordConfirmation}
              onEmailChange={setEmail}
              onNewPasswordChange={setNewPassword}
              onNewPasswordConfirmationChange={setNewPasswordConfirmation}
              onRequestPasswordReset={() => void handleRequestPasswordReset()}
              onResetPassword={() => void handleResetPassword()}
              passwordResetToken={passwordResetToken}
              pendingAction={pendingAction}
            />
          ) : null}

          {twoFactorMethods.length ? (
            <TwoFactorChallenge
              busy={busy}
              onRequestTwoFactorOtp={() =>
                void runAction(
                  "2fa-otp-send",
                  () => authApi.sendTwoFactorOtp(trustDevice),
                  "Two-factor OTP sent.",
                  false,
                )
              }
              onTrustDeviceChange={setTrustDevice}
              onTwoFactorCodeChange={setTwoFactorCode}
              onVerifyBackupCode={() =>
                void runAction(
                  "2fa-backup",
                  () => authApi.verifyBackupCode({ code: twoFactorCode, trustDevice }),
                  "Two-factor verified.",
                )
              }
              onVerifyOtp={() =>
                void runAction(
                  "2fa-otp-verify",
                  () =>
                    authApi.verifyTwoFactorOtp({ code: twoFactorCode, trustDevice }),
                  "Two-factor verified.",
                )
              }
              onVerifyTotp={() =>
                void runAction(
                  "2fa-totp-verify",
                  () => authApi.verifyTotp({ code: twoFactorCode, trustDevice }),
                  "Two-factor verified.",
                )
              }
              pendingAction={pendingAction}
              trustDevice={trustDevice}
              twoFactorCode={twoFactorCode}
              twoFactorMethods={twoFactorMethods}
            />
          ) : null}

          <p className={authAltClassName}>
            {view === "signup" ? "Already have an account?" : "Don't have an account?"}
            <button
              className={textButtonClassName}
              type="button"
              onClick={() => setView(view === "signup" ? "login" : "signup")}
            >
              {view === "signup" ? "Log in" : "Register"}
            </button>
          </p>

          <Notice text={notice} />
        </section>
      </div>
    </section>
  );
}

function Notice({ text }: { text: string }) {
  if (!text) {
    return null;
  }

  const isError = isErrorNotice(text);
  const Icon = isError ? CircleAlert : BadgeCheck;

  return (
    <div
      className={`${noticeBaseClassName} ${
        isError ? noticeErrorClassName : noticeSuccessClassName
      }`}
      role={isError ? "alert" : "status"}
    >
      <Icon size={16} />
      <span>{text}</span>
    </div>
  );
}

function PasswordResetPanel({
  busy,
  email,
  newPassword,
  newPasswordConfirmation,
  onEmailChange,
  onNewPasswordChange,
  onNewPasswordConfirmationChange,
  onRequestPasswordReset,
  onResetPassword,
  passwordResetToken,
  pendingAction,
}: {
  busy: boolean;
  email: string;
  newPassword: string;
  newPasswordConfirmation: string;
  onEmailChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onNewPasswordConfirmationChange: (value: string) => void;
  onRequestPasswordReset: () => void;
  onResetPassword: () => void;
  passwordResetToken: string;
  pendingAction: string | null;
}) {
  const passwordsMatch =
    newPassword.length > 0 && newPassword === newPasswordConfirmation;

  return (
    <section className={inlinePanelClassName}>
      <h3 className={inlinePanelTitleClassName}>Password reset</h3>
      <div className={formClassName}>
        <label className={labelClassName}>
          Email
          <input
            className={inputClassName}
            autoComplete="email"
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>
      </div>
      <div className={actionsClassName}>
        <Button disabled={busy || !email} fullWidth onClick={onRequestPasswordReset}>
          <Mail size={15} />
          {pendingAction === "password-reset-request" ? "Sending" : "Send reset email"}
        </Button>
      </div>

      {passwordResetToken ? (
        <>
          <div className={formClassName}>
            <label className={labelClassName}>
              New password
              <input
                className={inputClassName}
                autoComplete="new-password"
                onChange={(event) => onNewPasswordChange(event.target.value)}
                type="password"
                value={newPassword}
              />
            </label>
            <label className={labelClassName}>
              Confirm password
              <input
                className={inputClassName}
                autoComplete="new-password"
                onChange={(event) =>
                  onNewPasswordConfirmationChange(event.target.value)
                }
                type="password"
                value={newPasswordConfirmation}
              />
            </label>
          </div>
          <div className={actionsClassName}>
            <Button
              className="min-h-[42px]!"
              disabled={busy || !passwordsMatch}
              fullWidth
              onClick={onResetPassword}
              variant="primary"
            >
              <KeyRound size={15} />
              {pendingAction === "password-reset-submit"
                ? "Resetting"
                : "Reset password"}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function TwoFactorChallenge({
  busy,
  onRequestTwoFactorOtp,
  onTrustDeviceChange,
  onTwoFactorCodeChange,
  onVerifyBackupCode,
  onVerifyOtp,
  onVerifyTotp,
  pendingAction,
  trustDevice,
  twoFactorCode,
  twoFactorMethods,
}: {
  busy: boolean;
  onRequestTwoFactorOtp: () => void;
  onTrustDeviceChange: (value: boolean) => void;
  onTwoFactorCodeChange: (value: string) => void;
  onVerifyBackupCode: () => void;
  onVerifyOtp: () => void;
  onVerifyTotp: () => void;
  pendingAction: string | null;
  trustDevice: boolean;
  twoFactorCode: string;
  twoFactorMethods: string[];
}) {
  return (
    <section className={inlinePanelClassName}>
      <h3 className={inlinePanelTitleClassName}>Two-factor code</h3>
      <label className={labelClassName}>
        Code
        <input
          className={inputClassName}
          inputMode="numeric"
          onChange={(event) => onTwoFactorCodeChange(event.target.value)}
          value={twoFactorCode}
        />
      </label>
      <label className={trustDeviceClassName}>
        <input
          checked={trustDevice}
          onChange={(event) => onTrustDeviceChange(event.target.checked)}
          type="checkbox"
        />
        Trust this device
      </label>
      <div className={methodStripClassName}>
        {twoFactorMethods.map((method) => (
          <span className={methodChipClassName} key={method}>
            {method}
          </span>
        ))}
      </div>
      <div className={actionsClassName}>
        <Button
          className="min-h-[42px]!"
          disabled={busy || !twoFactorCode}
          fullWidth
          onClick={onVerifyTotp}
          variant="primary"
        >
          <BadgeCheck size={15} />
          {pendingAction === "2fa-totp-verify" ? "Verifying" : "Verify TOTP"}
        </Button>
        <Button disabled={busy || !twoFactorCode} fullWidth onClick={onVerifyOtp}>
          <BadgeCheck size={15} />
          Verify OTP
        </Button>
        <Button
          disabled={busy || !twoFactorCode}
          fullWidth
          onClick={onVerifyBackupCode}
        >
          <BadgeCheck size={15} />
          Backup code
        </Button>
        <Button disabled={busy} fullWidth onClick={onRequestTwoFactorOtp}>
          <Mail size={15} />
          Send OTP
        </Button>
      </div>
    </section>
  );
}
