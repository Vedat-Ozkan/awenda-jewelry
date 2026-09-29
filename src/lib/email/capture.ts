import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Dev/test capture for outbound email (06-checkout-orders.md step 5):
// sendEmail() (./send.ts) writes here instead of calling Resend whenever
// RESEND_API_KEY is unset. `to`/`subject` are stashed as HTML comments so a
// captured file doubles as a readable preview (open it in a browser) and
// round-trips through readCapturedEmails() for tests.
const CAPTURE_DIR = path.join(process.cwd(), "tmp", "emails");

export interface CapturedEmail {
  file: string;
  to: string;
  subject: string;
  html: string;
}

function slugify(subject: string): string {
  return (
    subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 60) || "email"
  );
}

export async function captureEmail(to: string, subject: string, html: string): Promise<string> {
  await mkdir(CAPTURE_DIR, { recursive: true });
  const file = path.join(CAPTURE_DIR, `${Date.now()}-${slugify(subject)}.html`);
  await writeFile(file, `<!-- to: ${to} -->\n<!-- subject: ${subject} -->\n${html}`, "utf8");
  return file;
}

export async function readCapturedEmails(): Promise<CapturedEmail[]> {
  let names: string[];
  try {
    names = await readdir(CAPTURE_DIR);
  } catch {
    return [];
  }
  const emails: CapturedEmail[] = [];
  for (const name of names.sort()) {
    const file = path.join(CAPTURE_DIR, name);
    const raw = await readFile(file, "utf8");
    const to = raw.match(/<!-- to: (.*) -->/)?.[1] ?? "";
    const subject = raw.match(/<!-- subject: (.*) -->/)?.[1] ?? "";
    const html = raw.replace(/^<!-- to: .* -->\n<!-- subject: .* -->\n/, "");
    emails.push({ file, to, subject, html });
  }
  return emails;
}

export async function clearCapturedEmails(): Promise<void> {
  await rm(CAPTURE_DIR, { recursive: true, force: true });
}
