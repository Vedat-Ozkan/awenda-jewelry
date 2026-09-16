import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import exifr from "exifr";

// Exercises src/lib/images/resize.ts (browser-only, no Node imports) via
// window.__awendaResize, exposed by the dev harness page (Phase 3 step 5)
// when NODE_ENV !== "production". No auth needed — the sign-in form still
// mounts the client component that sets window.__awendaResize.
const FIXTURES_DIR = join(__dirname, "..", "tests", "fixtures");

function loadFixtureBase64(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name)).toString("base64");
}

async function resizeInBrowser(page: import("@playwright/test").Page, base64: string) {
  return page.evaluate(async (b64) => {
    function toBase64(bytes: Uint8Array): string {
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const { main, width, height } = await window.__awendaResize!(blob);
    const mainBytes = toBase64(new Uint8Array(await main.arrayBuffer()));
    return { width, height, mainBytes };
  }, base64);
}

// Collected per test: if NEXT_PUBLIC_SUPABASE_URL/ANON_KEY aren't supplied
// to the dev server (see playwright.config.ts webServer.env), the client
// component's createClient() throws inside its useEffect — an uncaught
// error that would otherwise go unnoticed since the test only reads
// window.__awendaResize, set earlier in the same effect.
let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });

  await page.goto("/admin/dev/embed");
  await expect(page.getByText("Embedding dev harness")).toBeVisible();
  // The client component sets this in a useEffect, which can run after this
  // navigation's load event — wait for it explicitly rather than racing it.
  await page.waitForFunction(() => typeof window.__awendaResize === "function");
});

test.afterEach(() => {
  expect(pageErrors, `unexpected page/console errors: ${pageErrors.join("; ")}`).toEqual([]);
});

test("resizes a 4000x3000 landscape photo to 1024x768 with no EXIF", async ({ page }) => {
  const result = await resizeInBrowser(page, loadFixtureBase64("landscape-4000x3000.jpg"));

  expect(result.width).toBe(1024);
  expect(result.height).toBe(768);

  const exif = await exifr.parse(Buffer.from(result.mainBytes, "base64"));
  expect(exif).toBeFalsy();
});

test("EXIF-rotated photo comes out portrait with no EXIF", async ({ page }) => {
  const result = await resizeInBrowser(page, loadFixtureBase64("portrait-exif-rotated.jpg"));

  expect(result.height).toBeGreaterThan(result.width);

  const exif = await exifr.parse(Buffer.from(result.mainBytes, "base64"));
  expect(exif).toBeFalsy();
});
