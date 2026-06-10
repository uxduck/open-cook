import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost" | "tab";
type ButtonSize = "sm" | "md" | "icon";

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
  soft:
    "border-(--color-line)! bg-(--color-panel)! text-(--color-ink)! shadow-none! hover:bg-(--color-rail)!",
  tab:
    "border-(--color-line)! bg-(--color-panel)! text-(--color-fog)! shadow-none! hover:bg-(--color-sage-soft)! hover:text-(--color-ink)!",
};

const activeButtonClassNames: Partial<Record<ButtonVariant, string>> = {
  ghost:
    "border-(--color-line)! bg-(--color-panel)! text-(--color-ink)!",
  secondary:
    "border-(--color-ink)! bg-(--color-panel)! text-(--color-ink)!",
  tab:
    "border-(--color-ink)! bg-(--color-panel)! text-(--color-ink)!",
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
