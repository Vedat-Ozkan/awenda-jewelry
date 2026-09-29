import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Dev/test capture for outbound email (06-checkout-orders.md step 5):
// sendEmail() (./send.ts) writes here instead of calling Resend whenever
// RESEND_API_KEY is unset. `to`/`subject` are stashed as HTML comments so a
// captured file doubles as a readable preview (open it in a browser) and
// round-trips through readCapturedEmails() for tests. EMAIL_CAPTURE_SUBDIR lets
// a test file use its own tmp/ subfolder so parallel files don't clear each
// other's. next.config.ts excludes tmp/ from output file tracing.
const captureDir = () =>
  path.join(process.cwd(), "tmp", process.env.EMAIL_CAPTURE_SUBDIR ?? "emails");

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
  await mkdir(captureDir(), { recursive: true });
  const file = path.join(captureDir(), `${Date.now()}-${slugify(subject)}.html`);
  await writeFile(file, `<!-- to: ${to} -->\n<!-- subject: ${subject} -->\n${html}`, "utf8");
  return file;
}

export async function readCapturedEmails(): Promise<CapturedEmail[]> {
  let names: string[];
  try {
    names = await readdir(captureDir());
  } catch {
    return [];
  }
  const emails: CapturedEmail[] = [];
  for (const name of names.sort()) {
    const file = path.join(captureDir(), name);
    const raw = await readFile(file, "utf8");
    const to = raw.match(/<!-- to: (.*) -->/)?.[1] ?? "";
    const subject = raw.match(/<!-- subject: (.*) -->/)?.[1] ?? "";
    const html = raw.replace(/^<!-- to: .* -->\n<!-- subject: .* -->\n/, "");
    emails.push({ file, to, subject, html });
  }
  return emails;
}

export async function clearCapturedEmails(): Promise<void> {
  await rm(captureDir(), { recursive: true, force: true });
}
