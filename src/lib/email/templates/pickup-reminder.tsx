import { Heading, Hr, Section, Text } from "@react-email/components";
import type { Locale } from "@/i18n/routing";
import { GOLD_MUTED } from "@/lib/email/colors";
import { EmailLayout } from "@/lib/email/layout";

export interface PickupReminderItem {
  name: string;
  variantLabel: string;
  qty: number;
}

export interface PickupReminderProps {
  locale: Locale;
  items: PickupReminderItem[];
  marketName: string | null;
  marketAddress: string | null;
  // Already formatted (formatMarketDate) by the caller — kept as a plain
  // string so this template doesn't need its own date-formatting logic.
  marketDate: string | null;
  pickupInstructions: string | null;
}

const STRINGS = {
  en: {
    preview: "Pickup reminder — your order is ready tomorrow",
    heading: "See you at the market tomorrow",
    intro: "Your order is ready for pickup:",
    qty: "Qty",
  },
  fr: {
    preview: "Rappel de cueillette — votre commande sera prête demain",
    heading: "À demain au marché",
    intro: "Votre commande est prête pour la cueillette :",
    qty: "Qté",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function PickupReminderEmail({
  locale,
  items,
  marketName,
  marketAddress,
  marketDate,
  pickupInstructions,
}: PickupReminderProps) {
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
      {marketDate ? <Text>{marketDate}</Text> : null}
      {marketName ? <Text>{marketName}</Text> : null}
      {marketAddress ? <Text>{marketAddress}</Text> : null}
      {pickupInstructions ? <Text>{pickupInstructions}</Text> : null}
    </EmailLayout>
  );
}
