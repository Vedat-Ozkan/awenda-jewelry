import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-ink text-ivory hover:bg-ink/90",
  secondary: "border border-ink/20 text-ink hover:bg-ink/5",
};

// Storefront button (Phase 5 step 3 design system). Cart/checkout actions in
// later steps use this rather than ad-hoc styling.
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
