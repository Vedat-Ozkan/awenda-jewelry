import { Body, Container, Head, Html, Preview } from "@react-email/components";
import type { ReactNode } from "react";
import { IVORY, INK } from "@/lib/email/colors";

// Shared wrapper for the 4 templates in ./templates/ (06-checkout-orders.md
// step 5) so each template file only has to describe its own content.
export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: IVORY, fontFamily: "Georgia, serif", color: INK, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "480px" }}>
          {children}
        </Container>
      </Body>
    </Html>
  );
}
