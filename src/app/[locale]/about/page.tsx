import { getTranslations } from "next-intl/server";

// Placeholder copy (docs/plan/05-storefront.md step 7: "placeholder copy,
// owner supplies text in Phase 9"). Kept neutral — no invented brand claims
// — until the owner writes the real story.
export default async function AboutPage() {
  const t = await getTranslations("pages.about");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-3xl text-ink">{t("title")}</h1>
      <p className="mt-4 text-ink/80">{t("body1")}</p>
      <p className="mt-4 text-ink/80">{t("body2")}</p>
    </main>
  );
}
