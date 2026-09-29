"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/CartContext";

// "Bag (n)" label with the live count (Phase 5 step 6). The one client
// boundary inside the otherwise-server Header — it needs useCart()'s
// localStorage count, which only exists in the browser. Rendered inside the
// accent-pill <Link> to /cart by Header, so the link's accessible name is the
// visible text.
export function CartBadge() {
  const t = useTranslations("header");
  const { count } = useCart();

  return (
    <span>
      {t("cart")} (<span data-testid="cart-count">{count}</span>)
    </span>
  );
}
