import { Heading, Hr, Section, Text } from "@react-email/components";
import { formatPrice } from "@/components/store/Price";
import type { Locale } from "@/i18n/routing";
import { GOLD, GOLD_MUTED } from "@/lib/email/colors";
import { EmailLayout } from "@/lib/email/layout";

export interface OrderConfirmationItem {
  name: string;
  variantLabel: string;
  qty: number;
  unitPriceCents: number;
}

export interface OrderConfirmationProps {
  locale: Locale;
  fulfillment: "ship" | "pickup";
  items: OrderConfirmationItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

const STRINGS = {
  en: {
    preview: "Thank you for your order",
    heading: "Thank you for your order",
    intro: "We've received your payment and we're getting your order ready.",
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    pickupNote: "We'll email you when it's ready for pickup at the market.",
    shipNote: "We'll email you a tracking number once it ships.",
    qty: "Qty",
  },
  fr: {
    preview: "Merci pour votre commande",
    heading: "Merci pour votre commande",
    intro: "Nous avons reçu votre paiement et préparons votre commande.",
    subtotal: "Sous-total",
    shipping: "Livraison",
    total: "Total",
    pickupNote: "Nous vous enverrons un courriel lorsque votre commande sera prête pour la cueillette au marché.",
    shipNote: "Nous vous enverrons un numéro de suivi dès l'expédition.",
    qty: "Qté",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function OrderConfirmationEmail({
  locale,
  fulfillment,
  items,
  subtotalCents,
  shippingCents,
  totalCents,
}: OrderConfirmationProps) {
  const t = STRINGS[locale];
  return (
    <EmailLayout preview={t.preview}>
      <Heading as="h1" style={{ fontSize: "20px" }}>
        {t.heading}
      </Heading>
      <Text>{t.intro}</Text>
      <Hr style={{ borderColor: GOLD_MUTED }} />
      <Section>
        {items.map((item, i) => (
          <Text key={i} style={{ margin: "4px 0" }}>
            {item.name} — {item.variantLabel} · {t.qty} {item.qty} · {formatPrice(item.unitPriceCents * item.qty, locale)}
          </Text>
        ))}
      </Section>
      <Hr style={{ borderColor: GOLD_MUTED }} />
      <Text>
        {t.subtotal}: {formatPrice(subtotalCents, locale)}
      </Text>
      <Text>
        {t.shipping}: {formatPrice(shippingCents, locale)}
      </Text>
      <Text style={{ fontWeight: "bold", color: GOLD }}>
        {t.total}: {formatPrice(totalCents, locale)}
      </Text>
      <Text>{fulfillment === "pickup" ? t.pickupNote : t.shipNote}</Text>
    </EmailLayout>
  );
}
