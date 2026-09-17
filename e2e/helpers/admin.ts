import type { Page } from "@playwright/test";
import { createServiceClient } from "../../tests/helpers/local-supabase";

// Local Supabase's Mailpit instance (supabase/config.toml [local_smtp],
// port 54324 — the CLI also exposes it under the legacy INBUCKET_URL name,
// same port). API verified directly against the running instance:
// GET /api/v1/messages -> { messages: [{ ID, To: [{ Address }], Created }] }
// GET /api/v1/message/{ID} -> { Text, HTML, ... }
// DELETE /api/v1/messages with body { IDs: [...] } deletes those messages.
const MAILPIT_URL = "http://127.0.0.1:54324";

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Created: string;
}

async function findLatestMessageTo(email: string): Promise<{ id: string; text: string } | null> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`);
  const body = (await res.json()) as { messages: MailpitSummary[] };
  const normalized = email.toLowerCase();

  const matches = body.messages
    .filter((m) => m.To.some((to) => to.Address.toLowerCase() === normalized))
    .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
  if (matches.length === 0) return null;

  const full = await (await fetch(`${MAILPIT_URL}/api/v1/message/${matches[0].ID}`)).json();
  return { id: matches[0].ID, text: (full as { Text: string }).Text };
}

// Polls Mailpit for a message to `email`, for up to `timeoutMs`. Local mail
// delivery is near-instant, but this avoids a fixed sleep.
async function waitForMessageTo(
  email: string,
  timeoutMs = 10_000,
): Promise<{ id: string; text: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await findLatestMessageTo(email);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function deleteMailpitMessage(id: string): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: [id] }),
  });
}

// The default magic-link email template links to GoTrue's own
// `/auth/v1/verify?token=...&type=magiclink&redirect_to=...` endpoint (not
// directly to our /auth/callback) — GoTrue verifies the token and 302s the
// browser to `redirect_to` (our /auth/callback, with `?code=` appended for
// the PKCE flow @supabase/ssr uses). Text body: "Sign in ( <url> )".
function extractSignInLink(text: string): string {
  const match = text.match(/Sign in \(\s*(\S+)\s*\)/);
  if (!match) throw new Error(`No sign-in link found in email body:\n${text}`);
  return match[1];
}

// Ensures `email` exists as a confirmed Supabase Auth user and is in
// admin_emails, then drives the real magic-link flow through the browser:
// submits the login form, reads the link from the local Mailpit mailbox,
// deletes that message (so a later login for the same address doesn't pick
// it up again), and navigates to it. Expects to land on /admin.
export async function loginAsAdmin(page: Page, email: string): Promise<void> {
  const normalized = email.toLowerCase();
  const supabase = createServiceClient();

  const { error: upsertError } = await supabase.from("admin_emails").upsert({ email: normalized });
  if (upsertError) throw upsertError;

  const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  if (!existing.users.some((u) => u.email?.toLowerCase() === normalized)) {
    const { error: createError } = await supabase.auth.admin.createUser({
      email: normalized,
      email_confirm: true,
    });
    if (createError) throw createError;
  }

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(normalized);
  await page.getByRole("button", { name: "Send link" }).click();
  await page.getByText(/sign-in link has been sent/i).waitFor();

  const message = await waitForMessageTo(normalized);
  if (!message) throw new Error(`No mail arrived for ${normalized} within the timeout`);
  await deleteMailpitMessage(message.id);

  await page.goto(extractSignInLink(message.text));
}

export async function deleteTestAdmin(email: string): Promise<void> {
  const normalized = email.toLowerCase();
  const supabase = createServiceClient();

  await supabase.from("admin_emails").delete().eq("email", normalized);

  const { data } = await supabase.auth.admin.listUsers();
  const user = data.users.find((u) => u.email?.toLowerCase() === normalized);
  if (user) await supabase.auth.admin.deleteUser(user.id);
}

// Exported for the "non-allowlisted email sends no mail" assertion.
export async function hasMessageTo(email: string): Promise<boolean> {
  return (await findLatestMessageTo(email)) !== null;
}
