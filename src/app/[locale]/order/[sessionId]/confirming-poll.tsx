"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 60_000;

// Rendered by page.tsx while the order hasn't landed yet (the webhook is
// typically seconds behind the success-page redirect). Re-runs the server
// component every ~2s via router.refresh() so it picks up the order the
// moment create_order_from_checkout() commits, and gives up after ~60s with
// a "check your email" message rather than polling forever.
export function ConfirmingPoll() {
  const t = useTranslations("order");
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start >= TIMEOUT_MS) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return <p className="text-muted">{timedOut ? t("confirmingTimeout") : t("confirming")}</p>;
}
