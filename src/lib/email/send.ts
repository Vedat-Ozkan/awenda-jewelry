import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { captureEmail } from "@/lib/email/capture";
import { env } from "@/lib/env";

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

// RESEND_API_KEY unset (local dev, tests, CI) -> capture to tmp/emails/
// instead of calling Resend (06-checkout-orders.md step 5). EMAIL_FROM falls
// back to Resend's onboarding sender per DECISIONS.md Open #8 (no verified
// domain until Phase 9).
export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<void> {
  const html = await render(react);

  if (!env.RESEND_API_KEY) {
    await captureEmail(to, subject, html);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM ?? "Awenda Jewelry <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(error.message);
  }
}
