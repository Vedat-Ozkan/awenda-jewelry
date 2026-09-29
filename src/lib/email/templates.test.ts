import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { OrderConfirmationEmail } from "@/lib/email/templates/order-confirmation";
import { PickupReminderEmail } from "@/lib/email/templates/pickup-reminder";
import { RefundNoticeEmail } from "@/lib/email/templates/refund-notice";
import { ShippedEmail } from "@/lib/email/templates/shipped";

// 06-checkout-orders.md step 5 verify: snapshot each template in both
// locales. Plain .ts (not .tsx) so vitest.config.ts's `**/*.test.ts` include
// picks it up — React.createElement is used instead of JSX so this file
// doesn't need JSX syntax itself; the templates (.tsx) still render fine
// through Vite's normal esbuild transform.
const LOCALES = ["en", "fr"] as const;

describe("email templates", () => {
  it.each(LOCALES)("order-confirmation renders in %s", async (locale) => {
    const html = await render(
      createElement(OrderConfirmationEmail, {
        locale,
        fulfillment: "pickup",
        items: [{ name: "Test Ring", variantLabel: "7", qty: 1, unitPriceCents: 4500 }],
        subtotalCents: 4500,
        shippingCents: 0,
        totalCents: 4500,
      }),
    );
    expect(html).toMatchSnapshot();
  });

  it.each(LOCALES)("refund-notice renders in %s", async (locale) => {
    const html = await render(
      createElement(RefundNoticeEmail, {
        locale,
        items: [{ name: "Test Ring", variantLabel: "7", qty: 1 }],
        refundAmountCents: 4500,
        fullyRefunded: true,
      }),
    );
    expect(html).toMatchSnapshot();
  });

  it.each(LOCALES)("shipped renders in %s", async (locale) => {
    const html = await render(
      createElement(ShippedEmail, {
        locale,
        items: [{ name: "Test Ring", variantLabel: "7", qty: 1 }],
        trackingNumber: "1234567890",
        trackingUrl: "https://www.canadapost-postescanada.ca/track-reperage/en#/search?trackingNumber=1234567890",
      }),
    );
    expect(html).toMatchSnapshot();
  });

  it.each(LOCALES)("pickup-reminder renders in %s", async (locale) => {
    const html = await render(
      createElement(PickupReminderEmail, {
        locale,
        items: [{ name: "Test Ring", variantLabel: "7", qty: 1 }],
        marketName: "Weekly Market",
        marketAddress: "TBD",
        marketDate: "Saturday, September 26, 2026",
        pickupInstructions: "TBD",
      }),
    );
    expect(html).toMatchSnapshot();
  });
});
