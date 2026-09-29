import { Heading, Hr, Section, Text } from "@react-email/components";
import { formatPrice } from "@/components/store/Price";
import type { Locale } from "@/i18n/routing";
import { GOLD_MUTED } from "@/lib/email/colors";
import { EmailLayout } from "@/lib/email/layout";

export interface RefundNoticeItem {
  name: string;
  variantLabel: string;
  qty: number;
}

export interface RefundNoticeProps {
  locale: Locale;
  items: RefundNoticeItem[];
  refundAmountCents: number;
  fullyRefunded: boolean;
}

const STRINGS = {
  en: {
    preview: "A refund has been issued for your order",
    headingPartial: "Part of your order sold out",
    headingFull: "Your order has been refunded",
    introPartial: "The following item(s) sold out before we could fulfill them, so we've refunded them:",
    introFull: "Your order sold out before we could fulfill it, so we've refunded it in full:",
    qty: "Qty",
    refunded: "Refunded",
  },
  fr: {
    preview: "Un remboursement a été émis pour votre commande",
    headingPartial: "Une partie de votre commande est épuisée",
    headingFull: "Votre commande a été remboursée",
    introPartial:
      "Les articles suivants étaient épuisés avant que nous puissions les préparer, nous les avons donc remboursés :",
    introFull: "Votre commande était épuisée avant que nous puissions la préparer, nous l'avons donc remboursée en entier :",
    qty: "Qté",
    refunded: "Remboursé",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function RefundNoticeEmail({ locale, items, refundAmountCents, fullyRefunded }: RefundNoticeProps) {
  const t = STRINGS[locale];
  return (
    <EmailLayout preview={t.preview}>
      <Heading as="h1" style={{ fontSize: "20px" }}>
        {fullyRefunded ? t.headingFull : t.headingPartial}
      </Heading>
      <Text>{fullyRefunded ? t.introFull : t.introPartial}</Text>
      <Section>
        {items.map((item, i) => (
          <Text key={i} style={{ margin: "4px 0" }}>
            {item.name} — {item.variantLabel} · {t.qty} {item.qty}
          </Text>
        ))}
      </Section>
      <Hr style={{ borderColor: GOLD_MUTED }} />
      <Text style={{ fontWeight: "bold" }}>
        {t.refunded}: {formatPrice(refundAmountCents, locale)}
      </Text>
    </EmailLayout>
  );
}
