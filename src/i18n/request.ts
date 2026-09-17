import { getRequestConfig } from "next-intl/server";
import { isLocale, routing } from "./routing";

// Resolved by the next-intl webpack/turbopack plugin (next.config.ts) as the
// request config for every render — see getRequestConfig's doc comment in
// node_modules/next-intl/dist/types/server/react-server/getRequestConfig.d.ts.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
