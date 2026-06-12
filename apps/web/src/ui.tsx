import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost" | "tab";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonOptions = {
  active?: boolean;
  className?: string;
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
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

/* Shared workspace layout primitives (converted from the legacy stylesheet). */

export const workspacePageBaseClassName =
  "col-[1/-1] row-[2] min-h-0 min-w-0 overflow-auto p-7 max-[1080px]:col-[1] max-[1080px]:row-auto max-[860px]:p-[18px] max-[820px]:p-[22px]";

export const workspacePageClassName = `${workspacePageBaseClassName} bg-[color-mix(in_oklch,var(--color-pop-bg)_82%,white)]`;

export const workspacePanelClassName =
  "grid min-w-0 gap-3.5 rounded-lg border border-solid border-(--color-pop-ink) bg-(--color-pop-card) p-[18px] shadow-pop-sm";

export const panelTitleClassName = "mb-3 flex items-center gap-2";

export const inlineStatusClassName =
  "inline-flex min-h-9 items-center gap-2 rounded-lg border-2 border-solid border-(--color-pop-ink) bg-[color-mix(in_oklch,var(--color-pop-secondary)_20%,white)] px-2.5 py-[7px] text-xs font-[850] text-(--color-pop-ink)";

export const buttonRowClassName = "flex flex-wrap justify-end gap-2";

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
  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[18px] pt-2.5 pb-[30px] max-[860px]:grid-cols-1 max-[860px]:pb-[26px]";

export const marketingBrandClassName =
  "inline-flex items-center gap-2 rounded-[10px] border-0 bg-transparent p-0 text-xl font-black text-(--color-pop-ink)";

export const marketingNavActionsClassName =
  "flex flex-wrap items-center justify-end gap-2.5 max-[860px]:justify-start";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonOptions & {
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
