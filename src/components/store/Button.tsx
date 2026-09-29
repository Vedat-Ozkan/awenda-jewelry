import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "soft" | "outline";
export type ButtonSize = "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-page hover:bg-accent",
  accent: "bg-accent text-white hover:bg-accent-deep",
  soft: "bg-mist text-ink hover:bg-ink/10",
  outline: "border border-ink/25 bg-transparent text-ink hover:bg-mist",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-[52px] px-7 text-base",
};

// Pill button styles (DECISIONS.md "Visual redesign: Silver Mist"): every
// target is at least 44px tall. Exported so links styled as buttons (hero
// CTAs, empty-state links) share the same classes as <Button>.
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]}`;
}

// Cart/checkout/lead-form actions use this rather than ad-hoc styling.
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />;
}
