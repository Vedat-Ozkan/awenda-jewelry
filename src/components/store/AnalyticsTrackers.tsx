"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/client";

// `page_view` on first load and on every client-side route change
// (Phase 7 step 3). The ref dedupes React strict mode's double-invoked
// effect in dev.
export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    track("page_view");
  }, [pathname]);

  return null;
}

// `design_view` on product page mount.
export function DesignViewTracker({ designId }: { designId: string }) {
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (tracked.current === designId) return;
    tracked.current = designId;
    track("design_view", { designId });
  }, [designId]);

  return null;
}
