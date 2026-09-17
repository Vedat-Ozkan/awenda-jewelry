import { defineRouting } from "next-intl/routing";

// Locales: en (default), fr — DECISIONS.md "Locale". Always-prefixed paths
// (`/en/...`, `/fr/...`) so "/" itself has no locale-less content and the
// redirect behaviour in proxy.ts is entirely next-intl's.
export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}
