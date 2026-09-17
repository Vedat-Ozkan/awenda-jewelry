import { getTranslations } from "next-intl/server";

// Shipping/returns/privacy placeholders (docs/plan/05-storefront.md step 7:
// "placeholder until Open #4" — DECISIONS.md Open #4, return/exchange policy
// text needs the owner). The page says so plainly rather than inventing
// numbers.
export default async function PoliciesPage() {
  const t = await getTranslations("pages.policies");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-3xl text-ink">{t("title")}</h1>

      <section className="mt-6">
        <h2 className="font-serif text-xl text-ink">{t("shippingTitle")}</h2>
        <p className="mt-2 text-ink/80">{t("shippingBody")}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl text-ink">{t("returnsTitle")}</h2>
        <p className="mt-2 text-ink/80">{t("returnsBody")}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl text-ink">{t("privacyTitle")}</h2>
        <p className="mt-2 text-ink/80">{t("privacyBody")}</p>
      </section>

      <p className="mt-8 text-xs text-ink/50">{t("tbd")}</p>
    </main>
  );
}
