import { Heading, Hr, Link, Section, Text } from "@react-email/components";
import type { Locale } from "@/i18n/routing";
import { GOLD, GOLD_MUTED } from "@/lib/email/colors";
import { EmailLayout } from "@/lib/email/layout";

export interface ShippedItem {
  name: string;
  variantLabel: string;
  qty: number;
}

export interface ShippedProps {
  locale: Locale;
  items: ShippedItem[];
  trackingNumber: string;
  trackingUrl: string | null;
}

const STRINGS = {
  en: {
    preview: "Your order has shipped",
    heading: "Your order has shipped",
    intro: "Here's what's on its way:",
    tracking: "Tracking number",
    track: "Track your package",
    qty: "Qty",
  },
  fr: {
    preview: "Votre commande a été expédiée",
    heading: "Votre commande a été expédiée",
    intro: "Voici ce qui est en route :",
    tracking: "Numéro de suivi",
    track: "Suivre votre colis",
    qty: "Qté",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function ShippedEmail({ locale, items, trackingNumber, trackingUrl }: ShippedProps) {
  const t = STRINGS[locale];
  return (
    <EmailLayout preview={t.preview}>
      <Heading as="h1" style={{ fontSize: "20px" }}>
        {t.heading}
      </Heading>
      <Text>{t.intro}</Text>
      <Section>
        {items.map((item, i) => (
          <Text key={i} style={{ margin: "4px 0" }}>
            {item.name} — {item.variantLabel} · {t.qty} {item.qty}
          </Text>
        ))}
      </Section>
      <Hr style={{ borderColor: GOLD_MUTED }} />
      <Text>
        {t.tracking}: {trackingNumber}
      </Text>
      {trackingUrl ? (
        <Link href={trackingUrl} style={{ color: GOLD }}>
          {t.track}
        </Link>
      ) : null}
    </EmailLayout>
  );
}
