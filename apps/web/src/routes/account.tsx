import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type BillingSummary } from "../api";
import { SiteHeader } from "../components/SiteHeader";
import { useSession } from "../context/SessionProvider";
import { Button } from "../ui";

export const Route = createFileRoute("/account")({
  ssr: false,
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { session, sessionLoading, signOut } = useSession();
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      void navigate({ to: "/login" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .billingSummary()
      .then((summary) => {
        if (!cancelled) setBilling(summary);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load billing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, session, sessionLoading]);

  const openPortal = useCallback(async () => {
    setError(null);
    setPortalPending(true);
    try {
      const { url } = await api.openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the billing portal.");
      setPortalPending(false);
    }
  }, []);

  if (!session) {
    return null;
  }

  const plan = billing?.plan ?? session.user.plan ?? "free";
  const isPro = plan === "pro";
  const totalCredits = (billing?.balances ?? []).reduce(
    (sum, pool) => sum + pool.available,
    0,
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
      <SiteHeader
        actions={
          <>
            <Button size="sm" onClick={() => navigate({ to: "/app" })}>
              Open app
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        }
      />


      <h1 className="mb-1 text-2xl font-extrabold text-(--foreground)">Account</h1>
      <p className="mb-8 text-(--muted-foreground)">{session.user.email}</p>

      {error ? (
        <p className="mb-6 rounded-lg border-2 border-(--destructive) bg-(--card) px-4 py-3 text-sm font-bold text-(--destructive)">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border-2 border-(--border) bg-(--card) p-6 shadow-pop">
        <div className="mb-5 flex items-center gap-2">
          <CreditCard size={20} className="text-(--primary)" />
          <h2 className="text-lg font-extrabold text-(--foreground)">Billing</h2>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-(--muted-foreground)">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-(--muted-foreground)">Current plan</p>
                <p className="text-xl font-extrabold text-(--foreground)">
                  {isPro ? "Chef" : "Free"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-(--muted-foreground)">Credit balance</p>
                <p className="text-xl font-extrabold text-(--foreground)">
                  {totalCredits.toLocaleString()} credits
                </p>
              </div>
            </div>

            {billing && !billing.billingEnabled ? (
              <p className="rounded-lg border-2 border-(--border) bg-(--background) px-4 py-3 text-sm text-(--muted-foreground)">
                Billing isn't configured in this environment yet.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {isPro ? (
                <Button variant="secondary" disabled={portalPending} onClick={openPortal}>
                  {portalPending ? "Opening…" : "Manage billing"}
                  <ExternalLink size={15} />
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate({ to: "/pricing" })}>
                  Upgrade to Chef
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate({ to: "/pricing" })}>
                Buy credits
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
