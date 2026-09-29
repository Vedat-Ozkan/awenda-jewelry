import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/catalog";

// Thin mist strip above the navbar (Silver Mist). Pickup is always offered;
// the shipping half is dropped when shipping is turned off in settings, and
// on phones (where only the pickup half fits).
export async function AnnouncementBar() {
  const t = await getTranslations("announcement");
  // The strip is decoration: a DB error must not take the chrome down.
  const shippingEnabled = await getSettings()
    .then((s) => s.shippingEnabled)
    .catch(() => false);

  return (
    <div className="flex min-h-8 items-center justify-center bg-mist px-3 py-1.5 text-center text-xs font-medium text-ink sm:min-h-9 sm:text-[13px]">
      <p>
        {t("pickup")}
        {shippingEnabled && <span className="hidden sm:inline"> · {t("shipping")}</span>}
      </p>
    </div>
  );
}
