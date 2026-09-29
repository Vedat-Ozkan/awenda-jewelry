// Phase 7 step 3: fire-and-forget funnel events to POST /api/track
// (DECISIONS.md "Analytics and lead capture"). No cookies, no PII: the only
// identifier is a random per-tab session id in sessionStorage.
export type AnalyticsEvent = "page_view" | "design_view" | "add_to_cart" | "begin_checkout";

export interface TrackProps {
  designId?: string;
  variantId?: string;
}

const SESSION_KEY = "awenda-session";

function getSession(): { id: string; isNew: boolean } {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return { id: existing, isNew: false };
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return { id, isNew: true };
  } catch {
    // storage blocked (private mode): a per-call id still lets the event land
    return { id: crypto.randomUUID(), isNew: false };
  }
}

export function track(event: AnalyticsEvent, props: TrackProps = {}): void {
  try {
    if (typeof window === "undefined") return;
    // The admin has its own root layout and never mounts a tracker; this is
    // the backstop so an /admin page can never emit events.
    if (window.location.pathname.startsWith("/admin")) return;

    const session = getSession();
    const payload = {
      event,
      sessionId: session.id,
      locale: document.documentElement.lang || "en",
      path: event === "page_view" ? window.location.pathname : undefined,
      designId: props.designId,
      variantId: props.variantId,
      // External referrer, once per session (the session's first page_view).
      referrer: event === "page_view" && session.isNew ? document.referrer || undefined : undefined,
    };
    const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", body)) {
      void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // analytics must never break the page
  }
}
