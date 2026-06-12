import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type CheckoutTarget, isApiError } from "../api";
import { SiteHeader } from "../components/SiteHeader";
import { useSession } from "../context/SessionProvider";
import { Button } from "../ui";

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
// 1 credit ≈ £0.02 (restyle = 25cr = £0.50, story = 50cr = £1.00).
const CREDIT_GBP = 0.02;
const RESTYLE_CREDITS = 25;
const STORY_CREDITS = 50;

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
    <main className="mx-auto w-full max-w-6xl px-5 py-10 md:py-16">
      <SiteHeader
        actions={
          session ? (
            <>
              <Button
                size="sm"
                onClick={() =>
                  navigate({ search: { page: "billing" }, to: "/app" })
                }
              >
                Account
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate({ to: "/app" })}
              >
                Open app
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => navigate({ to: "/login" })}>
                Log in
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate({ to: "/register" })}
              >
                Register
              </Button>
            </>
          )
        }
      />

      <section className="mb-10 text-center">
        <p className="mb-2 text-sm font-bold tracking-wide text-(--muted-foreground)">
          Pricing
        </p>
        <h1 className="text-3xl font-extrabold text-(--foreground) md:text-4xl">
          Keep your recipes free. Pay only for the magic.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-(--muted-foreground)">
          Store up to 1,000 recipes at no cost. Upgrade when you want more AI versions
          and stories. Or top up with credits as you go.
        </p>
      </section>

      {/* Monthly / annual toggle */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={annual ? "text-(--muted-foreground)" : "font-bold"}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((value) => !value)}
          className="relative h-7 w-12 rounded-full border-2 border-(--border) bg-(--card) transition"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-(--primary) transition-all ${
              annual ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
        <span className={annual ? "font-bold" : "text-(--muted-foreground)"}>
          Annual <span className="text-(--pop-green)">(~40% off)</span>
        </span>
      </div>

      {error ? (
        <p className="mb-6 rounded-lg border-2 border-(--destructive) bg-(--card) px-4 py-3 text-center text-sm font-bold text-(--destructive)">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 md:grid-cols-3">
        {/* Free */}
        <PlanCard title="Free" price="£0" cadence="forever">
          <FeatureList
            features={[
              "Up to 1,000 recipes",
              "Import from anywhere",
              `${FREE_RESTYLES} AI versions / month`,
              "Export anytime, no lock-in",
            ]}
          />
          <Button
            fullWidth
            variant="secondary"
            onClick={() => navigate({ to: session ? "/app" : "/register" })}
          >
            {session ? "Open app" : "Get started"}
          </Button>
        </PlanCard>

        {/* Chef */}
        <PlanCard
          title="Chef"
          price={annual ? gbp(PRO_ANNUAL) : gbp(PRO_MONTHLY)}
          cadence={annual ? "per year" : "per month"}
          highlight
        >
          <FeatureList
            features={[
              "Unlimited recipes",
              `${PRO_RESTYLES} AI versions / month`,
              `${PRO_STORIES} stories / month`,
              "Credit overage when you need more",
            ]}
          />
          <Button
            fullWidth
            variant="primary"
            disabled={pending === "pro"}
            onClick={() => checkout("pro")}
          >
            <Sparkles size={16} />
            {pending === "pro" ? "Starting…" : "Go Chef"}
          </Button>
        </PlanCard>

        {/* Credits */}
        <PlanCard title="Credit packs" price="from £5" cadence="pay as you go">
          <FeatureList
            features={[
              "Top up on any plan",
              `Version = ${RESTYLE_CREDITS} credits (~${gbp(0.5)})`,
              `Story = ${STORY_CREDITS} credits (~${gbp(1)})`,
              "Credits never expire",
            ]}
          />
          <div className="flex gap-2">
            <Button
              fullWidth
              variant="secondary"
              disabled={pending === "credits_5"}
              onClick={() => checkout("credits_5")}
            >
              {pending === "credits_5" ? "…" : "£5 pack"}
            </Button>
            <Button
              fullWidth
              variant="secondary"
              disabled={pending === "credits_10"}
              onClick={() => checkout("credits_10")}
            >
              {pending === "credits_10" ? "…" : "£10 pack"}
            </Button>
          </div>
        </PlanCard>
      </section>

      <PricingCalculator annual={annual} />

      <p className="mt-10 text-center text-xs text-(--muted-foreground)">
        Story &amp; video generation is rolling out soon. Prices in GBP, billed
        securely. Cancel anytime from your account.
      </p>
    </main>
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
      className={`flex flex-col gap-5 rounded-2xl border-2 bg-(--card) p-6 shadow-pop ${
        highlight ? "border-(--primary)" : "border-(--border)"
      }`}
    >
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-(--foreground)">{title}</h2>
          {highlight ? (
            <span className="rounded-full bg-(--primary) px-2.5 py-1 text-xs font-extrabold text-(--primary-foreground)">
              Popular
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-(--foreground)">{price}</span>
          <span className="text-sm text-(--muted-foreground)">{cadence}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="flex flex-1 flex-col gap-2.5">
      {features.map((feature) => (
        <li
          key={feature}
          className="flex items-start gap-2 text-sm text-(--foreground)"
        >
          <Check size={18} className="mt-px shrink-0 text-(--pop-green)" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingCalculator({ annual }: { annual: boolean }) {
  const [restyles, setRestyles] = useState(8);
  const [stories, setStories] = useState(1);

  const result = useMemo(() => {
    const monthlyPro = annual ? PRO_ANNUAL / 12 : PRO_MONTHLY;

    // Cheapest fit.
    if (restyles <= FREE_RESTYLES && stories === 0) {
      return { plan: "Free", monthly: 0, note: "Your usage fits the free plan." };
    }
    if (restyles <= PRO_RESTYLES && stories <= PRO_STORIES) {
      return {
        plan: "Chef",
        monthly: monthlyPro,
        note: "Covered by your monthly Chef allowance.",
      };
    }
    const extraRestyles = Math.max(0, restyles - PRO_RESTYLES) * RESTYLE_CREDITS;
    const extraStories = Math.max(0, stories - PRO_STORIES) * STORY_CREDITS;
    const overage = (extraRestyles + extraStories) * CREDIT_GBP;
    return {
      plan: "Chef + credits",
      monthly: monthlyPro + overage,
      note: `Chef plus ~${gbp(Number(overage.toFixed(2)))} in credit top-ups.`,
    };
  }, [annual, restyles, stories]);

  return (
    <section className="mt-12 rounded-2xl border-2 border-(--border) bg-(--card) p-6 shadow-pop md:p-8">
      <div className="mb-6 flex items-center gap-2">
        <Wand2 size={20} className="text-(--primary)" />
        <h2 className="text-xl font-extrabold text-(--foreground)">
          What would it cost me?
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-6 sm:grid-cols-2">
          <Stepper
            label="AI versions / month"
            value={restyles}
            onChange={setRestyles}
            max={100}
          />
          <Stepper
            label="Stories / month"
            value={stories}
            onChange={setStories}
            max={50}
          />
        </div>
        <div className="rounded-xl border-2 border-(--primary) bg-(--background) p-5 text-center md:min-w-[220px]">
          <p className="text-sm font-bold text-(--muted-foreground)">{result.plan}</p>
          <p className="my-1 text-3xl font-extrabold text-(--foreground)">
            {result.monthly === 0 ? "£0" : `${gbp(Number(result.monthly.toFixed(2)))}`}
            <span className="text-sm font-normal text-(--muted-foreground)">/mo</span>
          </p>
          <p className="text-xs text-(--muted-foreground)">{result.note}</p>
        </div>
      </div>
    </section>
  );
}

function Stepper({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max: number;
}) {
  const clamp = (next: number) => onChange(Math.max(0, Math.min(max, next)));
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-(--foreground)">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => clamp(value - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-(--border) bg-(--card) text-(--foreground) hover:bg-(--muted)"
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(event) => clamp(Number(event.target.value) || 0)}
          className="h-10 w-16 rounded-lg border-2 border-(--border) bg-(--card) text-center font-extrabold text-(--foreground)"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => clamp(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-(--border) bg-(--card) text-(--foreground) hover:bg-(--muted)"
        >
          <Plus size={16} />
        </button>
      </div>
    </label>
  );
}
