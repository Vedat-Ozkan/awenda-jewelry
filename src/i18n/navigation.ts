import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link/redirect/usePathname/useRouter — see
// node_modules/next-intl/dist/types/navigation/*/createNavigation.d.ts.
// `usePathname` returns the path with the locale prefix stripped, which is
// what <LanguageSwitcher> uses to swap locale while keeping the same page.
// `permanentRedirect` (Phase 5 step 5, 301 from a design's `previous_slugs`)
// added to chunk A's export list — same createNavigation() call, chunk A
// just didn't need it yet.
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(routing);
