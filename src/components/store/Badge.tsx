import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-gold-muted px-2 py-0.5 text-xs font-medium text-ink">{children}</span>
  );
}
