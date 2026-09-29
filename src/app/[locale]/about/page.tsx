import { getTranslations } from "next-intl/server";

// Placeholder copy (docs/plan/05-storefront.md step 7: "placeholder copy,
// owner supplies text in Phase 9"). Kept neutral — no invented brand claims
// — until the owner writes the real story.
export default async function AboutPage() {
  const t = await getTranslations("pages.about");

  return (
    <main className="mx-auto w-full max-w-3xl px-3 pb-10 pt-6 md:px-10 lg:pb-20 lg:pt-10">
      <h1 className="mb-5 px-1 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em] lg:mb-8 lg:px-0 lg:text-[56px]">
        {t("title")}
      </h1>
      <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 leading-relaxed text-muted lg:rounded-[28px] lg:p-8">
        <p>{t("body1")}</p>
        <p>{t("body2")}</p>
      </div>
    </main>
  );
}
