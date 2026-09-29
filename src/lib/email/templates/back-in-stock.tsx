import { Heading, Hr, Link, Text } from "@react-email/components";
import type { Locale } from "@/i18n/routing";
import { GOLD, GOLD_MUTED } from "@/lib/email/colors";
import { EmailLayout } from "@/lib/email/layout";

export interface BackInStockProps {
  locale: Locale;
  designName: string;
  designUrl: string;
  unsubscribeUrl: string;
}

const STRINGS = {
  en: {
    preview: (name: string) => `${name} is back in stock`,
    heading: "It's back in stock",
    intro: (name: string) => `Good news: ${name} is available again. Pieces are one of a kind and may sell out quickly.`,
    view: "View it in the shop",
    reason: "You're receiving this because you asked to be notified when this design was back.",
    unsubscribe: "Unsubscribe",
  },
  fr: {
    preview: (name: string) => `${name} est de retour en stock`,
    heading: "Il est de retour en stock",
    intro: (name: string) => `Bonne nouvelle : ${name} est de nouveau disponible. Nos pièces sont uniques et peuvent partir rapidement.`,
    view: "Voir dans la boutique",
    reason: "Vous recevez ce courriel parce que vous avez demandé à être prévenu·e du retour de cet article.",
    unsubscribe: "Se désabonner",
  },
} as const satisfies Record<Locale, Record<string, string | ((name: string) => string)>>;

export function BackInStockEmail({ locale, designName, designUrl, unsubscribeUrl }: BackInStockProps) {
  const t = STRINGS[locale];
  return (
    <EmailLayout preview={t.preview(designName)}>
      <Heading as="h1" style={{ fontSize: "20px" }}>
        {t.heading}
      </Heading>
      <Text>{t.intro(designName)}</Text>
      <Link href={designUrl} style={{ color: GOLD }}>
        {t.view}
      </Link>
      <Hr style={{ borderColor: GOLD_MUTED }} />
      <Text style={{ fontSize: "12px" }}>
        {t.reason}{" "}
        <Link href={unsubscribeUrl} style={{ color: GOLD }}>
          {t.unsubscribe}
        </Link>
      </Text>
    </EmailLayout>
  );
}
