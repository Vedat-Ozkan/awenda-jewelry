import { getTranslations } from "next-intl/server";

// Shipping/returns/privacy placeholders (docs/plan/05-storefront.md step 7:
// "placeholder until Open #4" — DECISIONS.md Open #4, return/exchange policy
// text needs the owner). The page says so plainly rather than inventing
// numbers.
export default async function PoliciesPage() {
  const t = await getTranslations("pages.policies");

  const card = "rounded-3xl bg-white p-6 lg:rounded-[28px] lg:p-8";
  const h2 = "mb-3 font-serif text-[28px] font-normal tracking-[-0.01em]";
  const h3 = "mt-5 font-semibold";

  return (
    <main className="mx-auto w-full max-w-3xl px-3 pb-10 pt-6 md:px-10 lg:pb-20 lg:pt-10">
      <h1 className="mb-5 px-1 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em] lg:mb-8 lg:px-0 lg:text-[56px]">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-3 leading-relaxed lg:gap-4">
        <section className={card}>
          <h2 className={h2}>{t("shippingTitle")}</h2>
          <p className="text-muted">{t("shippingBody")}</p>
        </section>

        <section className={card}>
          <h2 className={h2}>{t("returnsTitle")}</h2>
          <p className="text-muted">{t("returnsBody")}</p>
        </section>

        <section className={card}>
          <h2 className={h2}>{t("privacyTitle")}</h2>
          <p className="text-muted">{t("privacyBody")}</p>

          <div data-testid="privacy-details">
            <h3 className={h3}>{t("privacyAnalyticsTitle")}</h3>
            <p className="mt-1 text-muted">{t("privacyAnalyticsBody")}</p>

            <h3 className={h3}>{t("privacyEventsTitle")}</h3>
            <p className="mt-1 text-muted">{t("privacyEventsBody")}</p>

            <h3 className={h3}>{t("privacyEmailsTitle")}</h3>
            <p className="mt-1 text-muted">{t("privacyEmailsBody")}</p>
            <p className="mt-2 text-muted">{t("privacyUnsubscribeBody")}</p>
          </div>
        </section>
      </div>

      <p className="mt-6 px-1 text-xs text-muted lg:px-0">{t("tbd")}</p>
    </main>
  );
}
