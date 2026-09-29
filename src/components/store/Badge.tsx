import type { ReactNode } from "react";

// Small white pill label (material on product cards, "Sold out" over a photo).
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink">{children}</span>
  );
}
