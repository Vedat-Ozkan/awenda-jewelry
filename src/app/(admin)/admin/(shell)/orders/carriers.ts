// Shared between the orders admin server actions (actions.ts, for
// trackingUrlFor()/the markShipped zod schema) and the client detail view
// ([id]/order-detail-client.tsx, for the carrier <select>) — was defined
// twice.
export const CARRIERS = [
  { value: "canada_post", label: "Canada Post" },
  { value: "ups", label: "UPS" },
  { value: "purolator", label: "Purolator" },
  { value: "fedex", label: "FedEx" },
  { value: "other", label: "Other" },
] as const;

export type Carrier = (typeof CARRIERS)[number]["value"];
