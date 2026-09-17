import { notFound } from "next/navigation";
import { EmbedDevClient } from "./embed-dev-client";

// Dev-only harness for the image pipeline + admin photo upload + match
// search (Phase 3 step 5). No login UI exists until Phase 4, so this page
// includes its own minimal dev-only sign-in (see EmbedDevClient).
export default function EmbedDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <EmbedDevClient />;
}
