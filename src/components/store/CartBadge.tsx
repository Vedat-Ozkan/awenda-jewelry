"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/CartContext";

// Cart icon + live count badge (Phase 5 step 6). The one client boundary
// inside the otherwise-server Header — it needs useCart()'s localStorage
// count, which only exists in the browser. Rendered inside a <Link> to
// /cart by Header.
export function CartBadge() {
  const t = useTranslations("header");
  const { count } = useCart();

  return (
    <span aria-label={t("cart")} className="relative text-ink">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
      </svg>
      <span
        data-testid="cart-count"
        className="absolute -right-2 -top-2 rounded-full bg-gold px-1 text-[10px] leading-4 text-ivory"
      >
        {count}
      </span>
    </span>
  );
}
