import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CreditCard,
  LogIn,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { api, type CheckoutTarget, isApiError } from "../api";
import { SiteHeader } from "../components/SiteHeader";
import { useSession } from "../context/SessionProvider";
import { pageContainerClassName, PopButton } from "../ui";

export const Route = createFileRoute("/pricing")({
  ssr: true,
  component: PricingPage,
});

// Pricing model. Kept in sync with the Paid product configuration.
const PRO_MONTHLY = 3.99;
const PRO_ANNUAL = 29;
const FREE_RESTYLES = 3;
const PRO_RESTYLES = 20;
const PRO_STORIES = 3;
const CHEF_CHECKOUT_TARGET: CheckoutTarget = "pro";
const ANNUAL_SAVINGS_PERCENT = Math.round(
  (1 - PRO_ANNUAL / (PRO_MONTHLY * 12)) * 100,
);
const PAYMENTS_DISABLED = true;
const PAYMENTS_DISABLED_MESSAGE =
  "Payments are temporarily paused while we finish checkout.";

function gbp(amount: number): string {
  return amount % 1 === 0 ? `£${amount}` : `£${amount.toFixed(2)}`;
}

function PricingPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [annual, setAnnual] = useState(false);
  const [pending, setPending] = useState<CheckoutTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(target: CheckoutTarget) {
    setError(null);
    if (PAYMENTS_DISABLED) {
      setError(PAYMENTS_DISABLED_MESSAGE);
      return;
    }
    if (!session) {
      void navigate({ to: "/register" });
      return;
    }
    setPending(target);
    try {
      const { url } = await api.startCheckout(target);
      window.location.href = url;
    } catch (err) {
      setError(
        isApiError(err) && err.status === 503
          ? "Billing isn't configured yet. Check back soon."
          : err instanceof Error
            ? err.message
            : "Something went wrong starting checkout.",
      );
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_8%,rgba(255,190,91,0.2),transparent_19rem),radial-gradient(circle_at_92%_10%,rgba(47,104,75,0.16),transparent_22rem),linear-gradient(135deg,#fff7e3_0%,#f6efe2_52%,#eaf3df_100%)] text-(--color-ink)">
      <SiteHeader
        actions={
          session ? (
            <>
              <PopButton
                size="sm"
                tone="secondary"
                onClick={() => navigate({ to: "/app/billing" })}
              >
                <CreditCard className="max-[520px]:hidden" size={15} />
                Account
              </PopButton>
              <PopButton
                size="sm"
                tone="primary"
                onClick={() => navigate({ to: "/app" })}
              >
                Open app
                <ArrowRight className="max-[520px]:hidden" size={15} />
              </PopButton>
            </>
          ) : (
            <>
              <PopButton
                size="sm"
                tone="secondary"
                onClick={() => navigate({ to: "/login" })}
              >
                <LogIn className="max-[520px]:hidden" size={15} />
                Log in
              </PopButton>
              <PopButton
                size="sm"
                tone="primary"
                onClick={() => navigate({ to: "/register" })}
              >
                <UserPlus className="max-[520px]:hidden" size={15} />
                Register
              </PopButton>
            </>
          )
        }
      />

      <main className={`${pageContainerClassName} px-5 pt-10 pb-14 max-[640px]:px-4 md:pt-12 md:pb-16`}>
        <section className="mb-8 text-center">
          <p className="mb-2 text-sm font-black tracking-normal text-(--color-fog)">
            Pricing
          </p>
          <h1 className="mx-auto max-w-4xl text-balance text-[clamp(34px,5vw,48px)] font-extrabold leading-[1.02] tracking-normal text-(--color-ink)">
            Keep every recipe. Upgrade when OpenCook saves dinner.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-6 text-(--color-fog)">
            Start with a generous free recipe library. Chef adds unlimited recipes
            and a simple monthly AI allowance without credit packs or surprise top-ups.
          </p>
        </section>

        <div className="mb-7 flex items-center justify-center gap-3">
          <span className={annual ? "text-(--color-fog)" : "font-black"}>Monthly</span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual((value) => !value)}
            className="relative h-7 w-12 rounded-full border-2 border-(--color-pop-ink) bg-(--color-pop-card) shadow-[2px_2px_0_0_var(--color-pop-ink)] transition hover:-translate-x-px hover:-translate-y-px hover:bg-[color-mix(in_oklch,var(--color-pop-accent)_18%,white)] hover:shadow-[3px_3px_0_0_var(--color-pop-ink)]"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full border border-(--color-pop-ink) bg-(--color-tomato) transition-all ${
                annual ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <span className={annual ? "font-black" : "text-(--color-fog)"}>
            Annual{" "}
            <span className="text-(--color-sage)">
              ({ANNUAL_SAVINGS_PERCENT}% off)
            </span>
          </span>
        </div>

        {error ? (
          <p className="mb-6 rounded-lg border-2 border-(--color-tomato) bg-(--color-panel) px-4 py-3 text-center text-sm font-bold text-(--color-tomato-dark)">
            {error}
          </p>
        ) : PAYMENTS_DISABLED ? (
          <p className="mb-6 rounded-lg border-2 border-(--color-pop-ink) bg-(--color-pop-card) px-4 py-3 text-center text-sm font-bold text-(--color-pop-ink)">
            {PAYMENTS_DISABLED_MESSAGE}
          </p>
        ) : null}

        <section className="mx-auto grid max-w-[860px] gap-5 md:grid-cols-2">
          <PlanCard title="Free" price="£0" cadence="forever">
            <FeatureList
              features={[
                "Up to 1,000 recipes",
                "Import from anywhere",
                `${FREE_RESTYLES} AI recipe edits / month`,
                "Export anytime, no lock-in",
              ]}
            />
            <PopButton
              fullWidth
              tone="secondary"
              onClick={() => navigate({ to: session ? "/app" : "/register" })}
            >
              {session ? "Open app" : "Get started"}
              <ArrowRight size={15} />
            </PopButton>
          </PlanCard>

          <PlanCard
            title="Chef"
            price={annual ? gbp(PRO_ANNUAL) : gbp(PRO_MONTHLY)}
            cadence={annual ? "per year" : "per month"}
            highlight
          >
            <FeatureList
              features={[
                "Everything in Free",
                "Unlimited recipes",
                `${PRO_RESTYLES} AI recipe edits / month`,
                `${PRO_STORIES} story generations / month as they roll out`,
                "One simple plan, no credit packs",
              ]}
            />
            <PopButton
              fullWidth
              tone="primary"
              disabled={PAYMENTS_DISABLED || pending === CHEF_CHECKOUT_TARGET}
              onClick={() => checkout(CHEF_CHECKOUT_TARGET)}
            >
              <Sparkles size={16} />
              {PAYMENTS_DISABLED
                ? "Payments paused"
                : pending === CHEF_CHECKOUT_TARGET
                  ? "Starting…"
                  : "Upgrade to Chef"}
            </PopButton>
          </PlanCard>
        </section>

        <SimplePricingNotes />

        <p className="mt-8 text-center text-xs text-(--color-fog)">
          Prices in GBP. Checkout will be enabled once payments are ready. Cancel
          anytime from your account.
        </p>
      </main>
    </div>
  );
}

function PlanCard({
  title,
  price,
  cadence,
  highlight = false,
  children,
}: {
  title: string;
  price: string;
  cadence: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border-2 bg-(--color-panel) p-5 shadow-pop-sm ${
        highlight ? "border-(--color-tomato)" : "border-(--color-ink)"
      }`}
    >
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-(--color-ink)">{title}</h2>
          {highlight ? (
            <span className="rounded-full bg-(--color-tomato) px-2.5 py-1 text-xs font-extrabold text-white">
              Popular
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-(--color-ink)">{price}</span>
          <span className="text-sm text-(--color-fog)">{cadence}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="flex flex-1 flex-col gap-2.5">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2 text-sm text-(--color-ink)">
          <Check size={18} className="mt-px shrink-0 text-(--color-sage)" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function SimplePricingNotes() {
  return (
    <section className="mx-auto mt-8 grid max-w-[860px] gap-3 rounded-lg border-2 border-(--color-ink) bg-(--color-panel) p-4 shadow-pop-sm sm:grid-cols-3 md:p-5">
      <PricingNote
        label="One paid plan"
        value="Chef includes the AI allowance; top-ups stay out of the signup flow."
      />
      <PricingNote
        label="Fair starting point"
        value="Free is useful enough to build a real recipe library before upgrading."
      />
      <PricingNote
        label="No lock-in"
        value="Recipes remain yours, with export available whether you pay or not."
      />
    </section>
  );
}

function PricingNote({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-(--color-line) bg-[rgba(255,253,248,0.7)] p-3">
      <strong className="text-sm text-(--color-ink)">{label}</strong>
      <span className="text-sm leading-5 text-(--color-fog)">{value}</span>
    </div>
  );
}
