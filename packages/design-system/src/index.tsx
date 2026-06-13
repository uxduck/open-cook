import { ArrowLeft } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/* Shell + content widths mirror workspaceScrollPageClassName / pageContainerClassName
   in apps/web/src/ui.tsx — keep them in sync. */
export const studioPageClassName =
  "relative col-[1/-1] row-[2] min-h-0 min-w-0 overflow-auto px-5 py-6 max-[980px]:col-[1] max-[980px]:row-auto md:px-8 bg-[radial-gradient(circle_at_14%_10%,rgba(255,198,96,0.22),transparent_19rem),radial-gradient(circle_at_84%_16%,rgba(69,118,82,0.16),transparent_22rem),linear-gradient(180deg,#fff9ea_0%,#f8f1e6_42%,#eef5e8_100%)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(color-mix(in_oklch,var(--color-line)_58%,transparent)_1px,transparent_1px)] before:[background-size:18px_18px] before:opacity-35";

export const studioPageInnerClassName =
  "relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-5";

export const studioInsetClassName =
  "grid gap-3 rounded-[20px] border-2 border-dashed border-[color-mix(in_oklch,var(--color-line)_88%,white)] bg-[rgba(255,250,243,0.82)] p-4";

export const studioActionTileClassName =
  "grid min-h-[78px] w-full grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-[20px] border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fffef8,#fff6dd_62%,#edf4e7)] p-3 text-left text-(--color-ink) shadow-[3px_3px_0_0_var(--color-ink)] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[5px_5px_0_0_var(--color-ink)] disabled:cursor-default disabled:opacity-60 [&>span]:grid [&>span]:min-w-0 [&>span]:gap-1 [&_small]:text-[12px] [&_small]:font-semibold [&_small]:leading-[1.45] [&_small]:text-(--color-fog) [&_strong]:text-[14px] [&_strong]:leading-[1.15]";

export const studioCodePanelClassName =
  "m-0 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[24px] border-2 border-(--color-ink) bg-[linear-gradient(135deg,#2e3b32,#1b231e)] p-4 text-xs text-[#fff7e8] shadow-[5px_5px_0_0_var(--color-ink)]";

type BadgeTone = "danger" | "default" | "sage" | "sun";

const studioBadgeToneClassNames: Record<BadgeTone, string> = {
  danger:
    "border-[#e29f91] bg-[color-mix(in_oklch,var(--color-pop-destructive)_16%,white)] text-[#a63b2b]",
  default:
    "border-(--color-ink) bg-[color-mix(in_oklch,var(--color-pop-secondary)_20%,white)] text-(--color-pop-ink)",
  sage: "border-(--color-sage-line) bg-[color-mix(in_oklch,var(--color-pop-secondary)_18%,white)] text-(--color-pop-primary)",
  sun: "border-[#e6c98c] bg-[#fff4cf] text-[#8b5a12]",
};

export function StudioBadge({
  children,
  className,
  icon,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={classNames(
        "inline-flex min-h-[40px] items-center gap-2 rounded-full border-2 px-3 py-2 text-[12px] font-black leading-none shadow-[2px_2px_0_0_var(--color-ink)]",
        studioBadgeToneClassNames[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

type StudioPanelTone = "default" | "mint" | "sun";

const studioPanelToneClassNames: Record<StudioPanelTone, string> = {
  default: "bg-[linear-gradient(180deg,#fffef9,#fff8ec)]",
  mint: "bg-[linear-gradient(135deg,#fffef8,#edf4e7_52%,#fff8ea)]",
  sun: "bg-[linear-gradient(135deg,#fff7da,#fffdf8_52%,#ffe8bc)]",
};

export function StudioPanel({
  children,
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLElement> & {
  tone?: StudioPanelTone;
}) {
  return (
    <section
      className={classNames(
        "relative overflow-hidden rounded-[24px] border-2 border-(--color-ink) p-5 shadow-[5px_5px_0_0_var(--color-ink)]",
        studioPanelToneClassNames[tone],
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function StudioSectionHeading({
  actions,
  className,
  description,
  icon,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon: ReactNode;
  title: ReactNode;
}) {
  return (
    <div
      className={classNames(
        "grid grid-cols-[46px_minmax(0,1fr)] items-start gap-3 max-[720px]:grid-cols-[42px_minmax(0,1fr)]",
        actions ? "lg:grid-cols-[46px_minmax(0,1fr)_auto]" : "",
        className,
      )}
    >
      <span className="grid size-[46px] place-items-center rounded-[18px] border-2 border-(--color-ink) bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-accent)_28%,white),color-mix(in_oklch,var(--color-pop-secondary)_18%,white)_62%,color-mix(in_oklch,var(--color-pop-pink)_12%,white))] text-(--color-pop-ink) shadow-[2px_2px_0_0_var(--color-ink)] max-[720px]:size-[42px]">
        {icon}
      </span>
      <div className="grid min-w-0 gap-1">
        <h2 className="m-0 font-display text-[24px] font-bold leading-[0.98] text-(--color-ink)">
          {title}
        </h2>
        {description ? (
          <p className="m-0 max-w-[60ch] text-[14px] font-semibold leading-[1.5] text-(--color-fog)">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="max-lg:col-span-full max-lg:justify-self-start lg:justify-self-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceHeader({
  children,
  description,
  icon,
  onBack,
  title,
}: {
  children?: ReactNode;
  description: string;
  icon: ReactNode;
  onBack?: () => void;
  title: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[30px] border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fff8de_0%,#fffef8_40%,#e7f0df_100%)] p-5 shadow-[6px_6px_0_0_var(--color-ink)] before:absolute before:top-[-96px] before:right-[-28px] before:size-[220px] before:rounded-full before:bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pop-accent)_34%,white),transparent_68%)] before:content-[''] after:absolute after:inset-0 after:bg-[radial-gradient(color-mix(in_oklch,var(--color-line)_56%,transparent)_1px,transparent_1px)] after:[background-size:16px_16px] after:opacity-35">
      <div className="relative z-10 flex items-start justify-between gap-6 max-[860px]:flex-col max-[860px]:items-stretch">
        <div className="flex min-w-0 items-start gap-3.5">
          {onBack ? (
            <button
              aria-label="Back"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[18px] border-2 border-(--color-ink) bg-(--color-panel) px-3 py-2 text-sm font-black text-(--color-ink) shadow-[3px_3px_0_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-ink)]"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : null}
          <span className="grid size-[58px] shrink-0 place-items-center rounded-[22px] border-2 border-(--color-ink) bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-pop-accent)_28%,white),color-mix(in_oklch,var(--color-pop-secondary)_18%,white)_56%,color-mix(in_oklch,var(--color-pop-pink)_14%,white))] text-(--color-pop-ink) shadow-[3px_3px_0_0_var(--color-ink)]">
            {icon}
          </span>
          <div className="min-w-0">
            <span className="inline-flex rounded-full border-2 border-(--color-ink) bg-(--color-panel) px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-(--color-pop-muted-ink)">
              OpenCook workspace
            </span>
            <h1 className="m-0 mt-3 font-display text-[clamp(30px,4vw,48px)] font-bold leading-[0.94] text-(--color-ink) [text-shadow:2px_2px_0_#fff7d8]">
              {title}
            </h1>
            <p className="mx-0 mt-3 mb-0 max-w-[62ch] text-[15px] font-semibold leading-[1.55] text-(--color-fog)">
              {description}
            </p>
          </div>
        </div>
        {children ? (
          <div className="relative z-10 flex flex-wrap justify-end gap-2 max-[860px]:w-full max-[860px]:justify-start">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function MetricCard({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-[22px] border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fffef8,#fff4d7_58%,#edf4e7)] p-4 shadow-[4px_4px_0_0_var(--color-ink)] before:absolute before:top-3 before:right-3 before:size-12 before:rounded-full before:bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pop-secondary)_24%,white),transparent_70%)] before:content-['']">
      <div className="relative z-10 flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[16px] border-2 border-(--color-ink) bg-(--color-panel) text-(--color-pop-primary) shadow-[2px_2px_0_0_var(--color-ink)]">
          {icon}
        </span>
        <div className="grid min-w-0 gap-1">
          <small className="text-[11px] font-black uppercase tracking-[0.14em] text-(--color-pop-muted-ink)">
            {label}
          </small>
          <strong className="truncate text-[clamp(18px,2.4vw,30px)] font-black leading-[0.96] text-(--color-ink)">
            {value}
          </strong>
          <em className="text-[12.5px] not-italic font-semibold leading-[1.45] text-(--color-fog)">
            {detail}
          </em>
        </div>
      </div>
    </article>
  );
}
