import type { Locale } from "@/i18n/routing";
import { CartClient } from "./cart-client";

// `/[locale]/cart` (Phase 5 step 6). Thin server wrapper — all cart state
// lives in localStorage via CartContext, so the page itself is a client
// component (cart-client.tsx). Same page.tsx (server) / *-client.tsx
// (client) split already used by the admin cataloging pages.
export default async function CartPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <CartClient locale={locale} />;
}
