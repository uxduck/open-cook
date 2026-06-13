import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost" | "tab";
type ButtonSize = "sm" | "md" | "lg" | "icon";
export type PopButtonTone = "accent" | "danger" | "primary" | "secondary";
type PopButtonSize = "icon" | "icon-sm" | "lg" | "md" | "sm";

type ButtonOptions = {
  active?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type PopButtonOptions = {
  active?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: PopButtonSize;
  tone?: PopButtonTone;
};

export type SegmentedControlItem<TValue extends string> = {
  badge?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  value: TValue;
};

type SegmentedControlProps<TValue extends string> = {
  "aria-label": string;
  className?: string;
  items: Array<SegmentedControlItem<TValue>>;
  onChange: (value: TValue) => void;
  value?: TValue | null;
};

const buttonBaseClassName =
  "inline-flex! items-center! justify-center! gap-2! rounded-lg! border! border-solid! font-extrabold! leading-none! tracking-normal! transition enabled:hover:-translate-x-px enabled:hover:-translate-y-px disabled:pointer-events-none disabled:opacity-55";

const buttonSizeClassNames: Record<ButtonSize, string> = {
  icon: "h-9! min-h-9! w-9! px-0! py-0! text-[13px]!",
  lg: "min-h-[46px]! px-4! py-2.5! text-[15px]!",
  md: "min-h-10! px-3! py-2! text-sm!",
  sm: "min-h-[38px]! px-2.5! py-2! text-[13px]!",
};

const buttonVariantClassNames: Record<ButtonVariant, string> = {
  danger:
    "border-(--color-line)! bg-(--color-panel)! text-(--color-tomato-dark)! shadow-none! hover:border-(--color-tomato)! hover:bg-(--color-rail)!",
  ghost:
    "border-transparent! bg-transparent! text-(--color-fog)! shadow-none! hover:border-(--color-line)! hover:bg-(--color-panel)! hover:text-(--color-ink)!",
  primary:
    "border-(--color-tomato)! bg-(--color-tomato)! text-white! shadow-none! hover:border-(--color-tomato-dark)! hover:bg-(--color-tomato-dark)!",
  secondary:
    "border-(--color-line)! bg-(--color-panel)! text-(--color-ink)! shadow-none! hover:bg-(--color-rail)!",
  soft: "border-(--color-line)! bg-(--color-panel)! text-(--color-ink)! shadow-none! hover:bg-(--color-rail)!",
  tab: "border-(--color-line)! bg-(--color-panel)! text-(--color-fog)! shadow-none! hover:bg-(--color-sage-soft)! hover:text-(--color-ink)!",
};

const activeButtonClassNames: Partial<Record<ButtonVariant, string>> = {
  ghost: "border-(--color-line)! bg-(--color-panel)! text-(--color-ink)!",
  secondary: "border-(--color-ink)! bg-(--color-panel)! text-(--color-ink)!",
  tab: "border-(--color-ink)! bg-(--color-panel)! text-(--color-ink)!",
};

const popButtonBaseClassName =
  "inline-flex! items-center! justify-center! gap-2! rounded-xl! border-2! border-solid! border-(--color-pop-ink)! font-black! leading-none! tracking-normal! shadow-[3px_3px_0_0_var(--color-pop-ink)]! transition! duration-150! disabled:pointer-events-none disabled:opacity-55 disabled:shadow-[2px_2px_0_0_var(--color-pop-ink)]!";

const popButtonSizeClassNames: Record<PopButtonSize, string> = {
  icon: "h-9! min-h-9! w-9! px-0! py-0! text-[13px]!",
  "icon-sm": "h-8! min-h-8! w-8! px-0! py-0! text-[13px]!",
  lg: "min-h-[46px]! px-4! py-2.5! text-[15px]!",
  md: "min-h-10! px-3! py-2! text-sm!",
  sm: "min-h-[38px]! px-2.5! py-2! text-[13px]!",
};

const popButtonToneClassNames: Record<PopButtonTone, string> = {
  accent:
    "bg-[color-mix(in_oklch,var(--color-pop-accent)_36%,white)]! text-(--color-pop-ink)! hover:bg-[color-mix(in_oklch,var(--color-pop-secondary)_24%,white)]!",
  danger:
    "bg-[color-mix(in_oklch,var(--color-pop-destructive)_12%,white)]! text-(--color-tomato-dark)! hover:bg-[color-mix(in_oklch,var(--color-pop-destructive)_18%,white)]!",
  primary: "bg-(--color-tomato)! text-white! hover:bg-(--color-tomato-dark)!",
  secondary:
    "bg-(--color-pop-card)! text-(--color-pop-ink)! hover:bg-[color-mix(in_oklch,var(--color-pop-accent)_18%,white)]!",
};

const popButtonInteractionClassName =
  "enabled:hover:-translate-x-0.5! enabled:hover:-translate-y-0.5! enabled:hover:border-(--color-pop-ink)! enabled:hover:shadow-[4px_4px_0_0_var(--color-pop-ink)]! enabled:active:translate-x-[2px]! enabled:active:translate-y-[2px]! enabled:active:shadow-none!";

const activePopButtonClassName = "translate-x-[2px]! translate-y-[2px]! shadow-none!";

const segmentedControlBaseClassName =
  "flex w-fit max-w-full flex-wrap gap-1.5 rounded-2xl border-2 border-(--color-ink) bg-[linear-gradient(135deg,#fff6c9,#fffdf8_62%,#e5efdf)] p-1 shadow-[3px_3px_0_0_var(--color-ink)]";

function segmentedControlButtonClassName(active: boolean) {
  return [
    "inline-flex min-h-9 items-center gap-2 rounded-xl border-2 px-3 py-2 text-[13px] font-extrabold leading-none transition disabled:pointer-events-none disabled:opacity-55 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[2px_2px_0_0_var(--color-ink)]",
    active
      ? "border-(--color-ink) bg-(--color-tomato) text-white shadow-[2px_2px_0_0_var(--color-ink)]"
      : "border-transparent bg-transparent text-(--color-fog) enabled:hover:border-(--color-line) enabled:hover:bg-(--color-panel) enabled:hover:text-(--color-ink)",
  ].join(" ");
}

export function buttonClassName({
  active = false,
  className = "",
  fullWidth = false,
  size = "md",
  variant = "secondary",
}: ButtonOptions = {}) {
  return [
    buttonBaseClassName,
    buttonSizeClassNames[size],
    buttonVariantClassNames[variant],
    active ? activeButtonClassNames[variant] : "",
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function popButtonClassName({
  active = false,
  className = "",
  fullWidth = false,
  size = "md",
  tone = "secondary",
}: PopButtonOptions = {}) {
  return [
    popButtonBaseClassName,
    popButtonSizeClassNames[size],
    popButtonToneClassNames[tone],
    active ? activePopButtonClassName : popButtonInteractionClassName,
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function SegmentedControl<TValue extends string>({
  "aria-label": ariaLabel,
  className = "",
  items,
  onChange,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={[segmentedControlBaseClassName, className].filter(Boolean).join(" ")}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            aria-current={active ? "page" : undefined}
            className={segmentedControlButtonClassName(active)}
            disabled={item.disabled}
            key={item.value}
            onClick={() => onChange(item.value)}
            type="button"
          >
            {item.icon}
            {item.label}
            {item.badge ? (
              <span className="min-w-5 rounded-full border-2 border-(--color-pop-ink) bg-(--color-pop-pink) px-[5px] py-[3px] text-center text-[11px] font-black leading-none text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/* Shared page widths. Standard pages and headers align at 1180px; focused
   single-task flows (builders, importers) align at 820px. */

export const pageContainerClassName = "mx-auto w-full max-w-[1180px]";

export const focusedPageContainerClassName = "mx-auto w-full max-w-[820px]";

/* Shared workspace layout primitives (converted from the legacy stylesheet).
   Every workspace page is a full-bleed scrollable section with this shell;
   content inside centers at the shared page width. Keep the padding here in
   sync with studioPageClassName in @open-cook/design-system. */

export const workspaceScrollPageClassName =
  "relative col-[1/-1] row-[2] min-h-0 min-w-0 overflow-auto px-5 py-6 max-[980px]:col-[1] max-[980px]:row-auto md:px-8";

export const workspacePageInnerClassName = `${pageContainerClassName} relative z-10 flex flex-col gap-5`;

export const workspacePanelClassName =
  "grid min-w-0 gap-3.5 rounded-lg border border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-[18px] shadow-pop-sm";

export const panelTitleClassName = "mb-3 flex items-center gap-2";

export const inlineStatusClassName =
  "inline-flex min-h-9 items-center gap-2 rounded-lg border-2 border-solid border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-secondary)_20%,white)] px-2.5 py-[7px] text-xs font-[850] text-(--color-pop-ink)";

export const buttonRowClassName = "flex flex-wrap justify-end gap-2";

export const workspacePrimaryActionButtonClassName =
  "rounded-xl! border-2! border-(--color-pop-ink)! bg-[linear-gradient(135deg,var(--color-pop-accent),var(--color-pop-pink)_62%,var(--color-pop-secondary))]! text-(--color-pop-ink)! shadow-[2px_2px_0_0_var(--color-pop-ink)]! hover:border-(--color-pop-ink)! hover:bg-[linear-gradient(135deg,var(--color-pop-accent),var(--color-pop-pink)_62%,var(--color-pop-secondary))]! hover:shadow-[3px_3px_0_0_var(--color-pop-ink)]!";

export const checkRowClassName =
  "flex items-center gap-2 text-[13px] font-bold text-[#4b574f] [&>input]:size-4 [&>input]:accent-(--color-pop-accent)";

export const fieldClassName =
  "grid gap-[7px] rounded-lg border border-solid border-[#ddd2c2] bg-(--color-panel) p-2.5 text-xs font-[760] text-[#5e675f] " +
  "[&_input]:min-h-6 [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-sm [&_input]:font-[520] [&_input]:leading-[1.42] [&_input]:text-(--color-ink) [&_input]:outline-0 [&_input::placeholder]:text-[#8a8378] " +
  "[&_select]:w-full [&_select]:min-w-0 [&_select]:border-0 [&_select]:bg-transparent [&_select]:text-sm [&_select]:font-[520] [&_select]:leading-[1.42] [&_select]:text-(--color-ink) [&_select]:outline-0 " +
  "[&_textarea]:min-h-[86px] [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:resize-y [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:text-sm [&_textarea]:font-[520] [&_textarea]:leading-[1.42] [&_textarea]:text-(--color-ink) [&_textarea]:outline-0 [&_textarea::placeholder]:text-[#8a8378]";

export function apiStatusClassName(status: "checking" | "online" | "offline") {
  const tone =
    status === "online"
      ? "border-(--color-sage-line) bg-[color-mix(in_oklch,var(--color-pop-secondary)_14%,white)] text-(--color-pop-primary)"
      : status === "offline"
        ? "border-[#efb9ae] bg-[color-mix(in_oklch,var(--color-pop-destructive)_16%,white)] text-[#a93b2f]"
        : "border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-secondary)_20%,white)] text-(--color-pop-ink)";
  return `inline-flex min-h-9 items-center gap-2 rounded-lg border-2 border-solid px-2.5 py-[7px] text-xs font-[850] max-[820px]:justify-center ${tone}`;
}

export const marketingNavClassName =
  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[18px] pt-2.5 pb-[30px] max-[860px]:gap-3 max-[860px]:pb-[26px]";

export const marketingBrandClassName =
  "inline-flex items-center gap-2 rounded-[10px] border-0 bg-transparent p-0 text-xl font-black text-(--color-pop-ink)";

export const marketingNavActionsClassName =
  "flex min-w-0 items-center justify-end gap-2.5 max-[640px]:gap-2";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonOptions & {
    children: ReactNode;
  };

type PopButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  PopButtonOptions & {
    children: ReactNode;
  };

export function Button({
  active,
  children,
  className,
  fullWidth,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({ active, className, fullWidth, size, variant })}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function PopButton({
  active,
  children,
  className,
  fullWidth,
  size,
  tone,
  type = "button",
  ...props
}: PopButtonProps) {
  return (
    <button
      className={popButtonClassName({ active, className, fullWidth, size, tone })}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
