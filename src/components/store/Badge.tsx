import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-ivory">{children}</span>
  );
}
