import {
  BadgeCheck,
  Fingerprint,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  authApi,
  type CurrentAuthSession,
  isTwoFactorRedirect,
  type TotpEnrollment,
} from "./authApi";
import { authClient } from "./authClient";

type AuthMode = "password" | "otp" | "passkey" | "security";

type AuthPageProps = {
  onRecipeWorkspace: () => void;
};

const authModes: Array<{ icon: typeof KeyRound; label: string; value: AuthMode }> = [
  { icon: KeyRound, label: "Password", value: "password" },
  { icon: Mail, label: "Email", value: "otp" },
  { icon: Fingerprint, label: "Passkey", value: "passkey" },
  { icon: ShieldCheck, label: "2FA", value: "security" },
];

export function AuthPage({ onRecipeWorkspace }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("password");
  const [session, setSession] = useState<CurrentAuthSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("Ready");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);
  const [trustDevice, setTrustDevice] = useState(true);
  const [passkeyName, setPasskeyName] = useState("Personal passkey");
  const [totpEnrollment, setTotpEnrollment] = useState<TotpEnrollment | null>(null);

  const passkeysAvailable = useMemo(
    () => typeof window !== "undefined" && "PublicKeyCredential" in window,
    [],
  );

  const refreshSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      setSession(await authApi.currentSession());
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

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
        setMode("security");
        setTwoFactorMethods(result.twoFactorMethods ?? ["totp", "otp"]);
        setNotice("Two-factor verification required");
        return;
      }

      if (
        typeof result === "object" &&
        result !== null &&
        "data" in result &&
        isTwoFactorRedirect((result as { data?: unknown }).data)
      ) {
        const data = (result as { data: { twoFactorMethods?: string[] } }).data;
        setMode("security");
        setTwoFactorMethods(data.twoFactorMethods ?? ["totp", "otp"]);
        setNotice("Two-factor verification required");
        return;
      }

      setNotice(successMessage);
      if (refresh) {
        await refreshSession();
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Authentication request failed",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function signInWithPasskey() {
    await runAction(
      "passkey-sign-in",
      async () => {
        const result = await authClient.signIn.passkey();
        if (result.error) {
          throw new Error(result.error.message ?? result.error.statusText);
        }
        return result;
      },
      "Signed in with passkey",
    );
  }

  async function addPasskey() {
    await runAction(
      "passkey-add",
      async () => {
        const result = await authClient.passkey.addPasskey({
          name: passkeyName || undefined,
        });
        if (result.error) {
          throw new Error(result.error.message ?? result.error.statusText);
        }
        return result;
      },
      "Passkey added",
    );
  }

  const signedIn = Boolean(session);
  const busy = Boolean(pendingAction);

  return (
    <section className="auth-page">
      <header className="auth-header">
        <div>
          <h1>Account</h1>
          <p>D1-backed Better Auth for the recipe workspace.</p>
        </div>
        <div className="auth-header-actions">
          <span className={`api-status ${signedIn ? "online" : "checking"}`}>
            <ShieldCheck size={16} />
            {sessionLoading
              ? "Checking session"
              : signedIn
                ? "Signed in"
                : "Signed out"}
          </span>
          {signedIn ? (
            <button
              type="button"
              onClick={() =>
                void runAction("sign-out", () => authApi.signOut(), "Signed out")
              }
            >
              <LogOut size={16} />
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <div className="auth-layout">
        <aside className="auth-summary">
          <SessionSummary session={session} sessionLoading={sessionLoading} />
          <div className="auth-notice" role="status">
            <BadgeCheck size={16} />
            <span>{notice}</span>
          </div>
        </aside>

        <div className="auth-workspace">
          <div className="auth-tabs" role="tablist" aria-label="Authentication modes">
            {authModes.map((item) => (
              <button
                aria-selected={mode === item.value}
                className={mode === item.value ? "active" : ""}
                key={item.value}
                onClick={() => setMode(item.value)}
                role="tab"
                type="button"
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <PasswordPanel
              busy={busy}
              email={email}
              name={name}
              onEmailChange={setEmail}
              onNameChange={setName}
              onPasswordChange={setPassword}
              onSignIn={() =>
                void runAction(
                  "email-sign-in",
                  () => authApi.signInEmail({ email, password }),
                  "Signed in",
                )
              }
              onSignUp={() =>
                void runAction(
                  "email-sign-up",
                  () =>
                    authApi.signUpEmail({
                      displayUsername: username || undefined,
                      email,
                      name: name || email,
                      password,
                      username: username || undefined,
                    }),
                  "Account created. Check the Worker console for verification.",
                )
              }
              onUsernameChange={setUsername}
              onUsernameSignIn={() =>
                void runAction(
                  "username-sign-in",
                  () => authApi.signInUsername({ password, username }),
                  "Signed in",
                )
              }
              password={password}
              pendingAction={pendingAction}
              username={username}
            />
          ) : null}

          {mode === "otp" ? (
            <EmailPanel
              busy={busy}
              email={email}
              name={name}
              onEmailChange={setEmail}
              onMagicLink={() =>
                void runAction(
                  "magic-link",
                  () => authApi.requestMagicLink(email),
                  "Magic link logged to the Worker console",
                  false,
                )
              }
              onNameChange={setName}
              onOtpChange={setOtp}
              onRequestOtp={() =>
                void runAction(
                  "email-otp-send",
                  () => authApi.sendEmailOtp(email),
                  "Email OTP logged to the Worker console",
                  false,
                )
              }
              onSendVerificationOtp={() =>
                void runAction(
                  "verification-otp-send",
                  () => authApi.sendVerificationOtp(email),
                  "Verification OTP logged to the Worker console",
                  false,
                )
              }
              onSignInOtp={() =>
                void runAction(
                  "email-otp-sign-in",
                  () => authApi.signInEmailOtp({ email, name: name || undefined, otp }),
                  "Signed in with email OTP",
                )
              }
              onVerifyEmail={() =>
                void runAction(
                  "email-otp-verify",
                  () => authApi.verifyEmailOtp({ email, otp }),
                  "Email verified",
                )
              }
              otp={otp}
              pendingAction={pendingAction}
            />
          ) : null}

          {mode === "passkey" ? (
            <PasskeyPanel
              busy={busy}
              onAddPasskey={() => void addPasskey()}
              onPasskeyNameChange={setPasskeyName}
              onSignInPasskey={() => void signInWithPasskey()}
              passkeyName={passkeyName}
              passkeysAvailable={passkeysAvailable}
              pendingAction={pendingAction}
              signedIn={signedIn}
            />
          ) : null}

          {mode === "security" ? (
            <SecurityPanel
              busy={busy}
              onDisableTwoFactor={() =>
                void runAction(
                  "2fa-disable",
                  () => authApi.disableTwoFactor({ password: password || undefined }),
                  "Two-factor disabled",
                )
              }
              onEnableTwoFactor={() =>
                void runAction(
                  "2fa-enable",
                  async () => {
                    const enrollment = await authApi.enableTwoFactor({
                      issuer: "OpenCook",
                      password: password || undefined,
                    });
                    setTotpEnrollment(enrollment);
                    return enrollment;
                  },
                  "Scan the TOTP URI and keep the backup codes",
                  false,
                )
              }
              onPasswordChange={setPassword}
              onRecipeWorkspace={onRecipeWorkspace}
              onRequestTwoFactorOtp={() =>
                void runAction(
                  "2fa-otp-send",
                  () => authApi.sendTwoFactorOtp(trustDevice),
                  "Two-factor OTP logged to the Worker console",
                  false,
                )
              }
              onTrustDeviceChange={setTrustDevice}
              onTwoFactorCodeChange={setTwoFactorCode}
              onVerifyBackupCode={() =>
                void runAction(
                  "2fa-backup",
                  () => authApi.verifyBackupCode({ code: twoFactorCode, trustDevice }),
                  "Two-factor verified",
                )
              }
              onVerifyOtp={() =>
                void runAction(
                  "2fa-otp-verify",
                  () =>
                    authApi.verifyTwoFactorOtp({ code: twoFactorCode, trustDevice }),
                  "Two-factor verified",
                )
              }
              onVerifyTotp={() =>
                void runAction(
                  "2fa-totp-verify",
                  () => authApi.verifyTotp({ code: twoFactorCode, trustDevice }),
                  "Two-factor verified",
                )
              }
              password={password}
              pendingAction={pendingAction}
              session={session}
              totpEnrollment={totpEnrollment}
              trustDevice={trustDevice}
              twoFactorCode={twoFactorCode}
              twoFactorMethods={twoFactorMethods}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SessionSummary({
  session,
  sessionLoading,
}: {
  session: CurrentAuthSession | null;
  sessionLoading: boolean;
}) {
  if (sessionLoading) {
    return (
      <section className="auth-panel compact">
        <Loader2 className="spin" size={18} />
        <strong>Checking session</strong>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="auth-panel compact">
        <KeyRound size={18} />
        <strong>No active session</strong>
        <span>Local auth requests use `/api/auth/*`.</span>
      </section>
    );
  }

  return (
    <section className="auth-panel compact">
      <BadgeCheck size={18} />
      <strong>{session.user.name}</strong>
      <span>{session.user.email}</span>
      <span>{session.user.emailVerified ? "Email verified" : "Email unverified"}</span>
      {session.user.username ? <span>@{session.user.username}</span> : null}
    </section>
  );
}

function PasswordPanel({
  busy,
  email,
  name,
  onEmailChange,
  onNameChange,
  onPasswordChange,
  onSignIn,
  onSignUp,
  onUsernameChange,
  onUsernameSignIn,
  password,
  pendingAction,
  username,
}: {
  busy: boolean;
  email: string;
  name: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onUsernameChange: (value: string) => void;
  onUsernameSignIn: () => void;
  password: string;
  pendingAction: string | null;
  username: string;
}) {
  return (
    <section className="auth-panel">
      <h2>Email and Password</h2>
      <div className="auth-form two-column">
        <label className="field">
          Email
          <input
            autoComplete="email"
            onChange={(event) => onEmailChange(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="field">
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => onPasswordChange(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <label className="field">
          Name
          <input
            autoComplete="name"
            onChange={(event) => onNameChange(event.target.value)}
            value={name}
          />
        </label>
        <label className="field">
          Username
          <input
            autoComplete="username"
            onChange={(event) => onUsernameChange(event.target.value)}
            value={username}
          />
        </label>
      </div>
      <div className="auth-actions">
        <button disabled={busy || !email || !password} onClick={onSignIn} type="button">
          <LogIn size={16} />
          {pendingAction === "email-sign-in" ? "Signing in" : "Sign in"}
        </button>
        <button
          disabled={busy || !email || !password || !name}
          onClick={onSignUp}
          type="button"
        >
          <UserPlus size={16} />
          {pendingAction === "email-sign-up" ? "Creating" : "Create account"}
        </button>
        <button
          className="secondary"
          disabled={busy || !username || !password}
          onClick={onUsernameSignIn}
          type="button"
        >
          <LogIn size={16} />
          Username sign in
        </button>
      </div>
    </section>
  );
}

function EmailPanel({
  busy,
  email,
  name,
  onEmailChange,
  onMagicLink,
  onNameChange,
  onOtpChange,
  onRequestOtp,
  onSendVerificationOtp,
  onSignInOtp,
  onVerifyEmail,
  otp,
  pendingAction,
}: {
  busy: boolean;
  email: string;
  name: string;
  onEmailChange: (value: string) => void;
  onMagicLink: () => void;
  onNameChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onRequestOtp: () => void;
  onSendVerificationOtp: () => void;
  onSignInOtp: () => void;
  onVerifyEmail: () => void;
  otp: string;
  pendingAction: string | null;
}) {
  return (
    <section className="auth-panel">
      <h2>Email Links and Codes</h2>
      <div className="auth-form two-column">
        <label className="field">
          Email
          <input
            autoComplete="email"
            onChange={(event) => onEmailChange(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="field">
          OTP
          <input
            inputMode="numeric"
            onChange={(event) => onOtpChange(event.target.value)}
            value={otp}
          />
        </label>
        <label className="field wide-field">
          Name for first OTP sign in
          <input
            autoComplete="name"
            onChange={(event) => onNameChange(event.target.value)}
            value={name}
          />
        </label>
      </div>
      <div className="auth-actions">
        <button disabled={busy || !email} onClick={onMagicLink} type="button">
          <Mail size={16} />
          {pendingAction === "magic-link" ? "Sending" : "Magic link"}
        </button>
        <button disabled={busy || !email} onClick={onRequestOtp} type="button">
          <Mail size={16} />
          Sign-in OTP
        </button>
        <button disabled={busy || !email || !otp} onClick={onSignInOtp} type="button">
          <LogIn size={16} />
          Verify sign in
        </button>
        <button
          className="secondary"
          disabled={busy || !email}
          onClick={onSendVerificationOtp}
          type="button"
        >
          <Mail size={16} />
          Verification OTP
        </button>
        <button
          className="secondary"
          disabled={busy || !email || !otp}
          onClick={onVerifyEmail}
          type="button"
        >
          <BadgeCheck size={16} />
          Verify email
        </button>
      </div>
    </section>
  );
}

function PasskeyPanel({
  busy,
  onAddPasskey,
  onPasskeyNameChange,
  onSignInPasskey,
  passkeyName,
  passkeysAvailable,
  pendingAction,
  signedIn,
}: {
  busy: boolean;
  onAddPasskey: () => void;
  onPasskeyNameChange: (value: string) => void;
  onSignInPasskey: () => void;
  passkeyName: string;
  passkeysAvailable: boolean;
  pendingAction: string | null;
  signedIn: boolean;
}) {
  return (
    <section className="auth-panel">
      <h2>Passkeys</h2>
      <div className="passkey-status">
        <Fingerprint size={20} />
        <span>{passkeysAvailable ? "WebAuthn available" : "WebAuthn unavailable"}</span>
      </div>
      <div className="auth-form">
        <label className="field">
          Passkey name
          <input
            onChange={(event) => onPasskeyNameChange(event.target.value)}
            value={passkeyName}
          />
        </label>
      </div>
      <div className="auth-actions">
        <button
          disabled={busy || !passkeysAvailable}
          onClick={onSignInPasskey}
          type="button"
        >
          <Fingerprint size={16} />
          {pendingAction === "passkey-sign-in" ? "Opening" : "Sign in"}
        </button>
        <button
          className="secondary"
          disabled={busy || !passkeysAvailable || !signedIn}
          onClick={onAddPasskey}
          type="button"
        >
          <Fingerprint size={16} />
          {pendingAction === "passkey-add" ? "Adding" : "Add passkey"}
        </button>
      </div>
    </section>
  );
}

function SecurityPanel({
  busy,
  onDisableTwoFactor,
  onEnableTwoFactor,
  onPasswordChange,
  onRecipeWorkspace,
  onRequestTwoFactorOtp,
  onTrustDeviceChange,
  onTwoFactorCodeChange,
  onVerifyBackupCode,
  onVerifyOtp,
  onVerifyTotp,
  password,
  pendingAction,
  session,
  totpEnrollment,
  trustDevice,
  twoFactorCode,
  twoFactorMethods,
}: {
  busy: boolean;
  onDisableTwoFactor: () => void;
  onEnableTwoFactor: () => void;
  onPasswordChange: (value: string) => void;
  onRecipeWorkspace: () => void;
  onRequestTwoFactorOtp: () => void;
  onTrustDeviceChange: (value: boolean) => void;
  onTwoFactorCodeChange: (value: string) => void;
  onVerifyBackupCode: () => void;
  onVerifyOtp: () => void;
  onVerifyTotp: () => void;
  password: string;
  pendingAction: string | null;
  session: CurrentAuthSession | null;
  totpEnrollment: TotpEnrollment | null;
  trustDevice: boolean;
  twoFactorCode: string;
  twoFactorMethods: string[];
}) {
  return (
    <section className="auth-panel">
      <h2>Two-Factor</h2>
      <div className="auth-form two-column">
        <label className="field">
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => onPasswordChange(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <label className="field">
          Code
          <input
            inputMode="numeric"
            onChange={(event) => onTwoFactorCodeChange(event.target.value)}
            value={twoFactorCode}
          />
        </label>
      </div>
      <label className="trust-device">
        <input
          checked={trustDevice}
          onChange={(event) => onTrustDeviceChange(event.target.checked)}
          type="checkbox"
        />
        Trust this device
      </label>
      {twoFactorMethods.length ? (
        <div className="method-strip">
          {twoFactorMethods.map((method) => (
            <span key={method}>{method}</span>
          ))}
        </div>
      ) : null}
      <div className="auth-actions">
        <button disabled={busy || !session} onClick={onEnableTwoFactor} type="button">
          <ShieldCheck size={16} />
          {pendingAction === "2fa-enable" ? "Enrolling" : "Enable 2FA"}
        </button>
        <button
          className="secondary"
          disabled={busy || !session}
          onClick={onDisableTwoFactor}
          type="button"
        >
          <ShieldCheck size={16} />
          Disable 2FA
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={onRequestTwoFactorOtp}
          type="button"
        >
          <Mail size={16} />
          Send 2FA OTP
        </button>
        <button disabled={busy || !twoFactorCode} onClick={onVerifyTotp} type="button">
          <BadgeCheck size={16} />
          Verify TOTP
        </button>
        <button disabled={busy || !twoFactorCode} onClick={onVerifyOtp} type="button">
          <BadgeCheck size={16} />
          Verify OTP
        </button>
        <button
          className="secondary"
          disabled={busy || !twoFactorCode}
          onClick={onVerifyBackupCode}
          type="button"
        >
          <BadgeCheck size={16} />
          Backup code
        </button>
        {session ? (
          <button className="secondary" onClick={onRecipeWorkspace} type="button">
            <RefreshCw size={16} />
            Recipe workspace
          </button>
        ) : null}
      </div>
      {totpEnrollment ? (
        <div className="totp-output">
          <strong>TOTP URI</strong>
          <code>{totpEnrollment.totpURI}</code>
          <strong>Backup codes</strong>
          <div>
            {totpEnrollment.backupCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
