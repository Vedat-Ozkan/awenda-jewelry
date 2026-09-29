import { buttonClasses } from "@/components/store/Button";

// Shared class strings for the admin's "Silver Mist" look (DECISIONS.md
// "Visual redesign"). Phone-first: fields are 48px tall with 16px text (no iOS
// zoom-on-focus), every button is a >= 44px pill. Plain strings rather than
// components so server and client files can both use them.

export const h1Class = "font-serif text-3xl font-medium tracking-tight text-ink md:text-4xl";
export const h2Class = "text-base font-semibold text-ink";
export const mutedClass = "text-sm text-muted";
export const hintClass = "ml-1 text-xs font-normal text-muted";
export const errorClass = "mt-3 text-sm font-medium text-red-700";
export const noticeClass = "mt-3 text-sm font-medium text-accent";

export const cardClass = "rounded-3xl bg-surface p-4 shadow-[0_1px_0_rgba(30,31,36,0.07)] md:p-6";

export const labelClass = "mt-4 block text-sm font-medium text-ink";
// Field without the label offset, for filters and inline rows.
export const bareFieldClass =
  "block w-full rounded-2xl border border-transparent bg-mist px-4 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50";
export const bareInputClass = `${bareFieldClass} h-12`;
export const inputClass = `mt-1.5 ${bareInputClass}`;
export const textareaClass = `mt-1.5 ${bareFieldClass} min-h-28 py-3`;

export const primaryButton = buttonClasses("primary");
export const softButton = buttonClasses("soft");
export const outlineButton = buttonClasses("outline");
export const dangerButton =
  "inline-flex h-11 items-center justify-center rounded-full border border-red-700/40 px-6 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

// Filter / toggle chips (>= 44px tall).
export const chipClass = (active: boolean) =>
  `inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
    active ? "bg-ink text-page" : "bg-mist text-ink hover:bg-ink/10"
  }`;

// Small read-only status pills. Statuses that need the owner's action stand
// out in accent; finished ones sit back in mist.
const STATUS_TONES: Record<string, string> = {
  awaiting_pickup: "bg-accent text-white",
  awaiting_shipment: "bg-accent text-white",
  shipped: "bg-mist text-ink",
  picked_up: "bg-mist text-ink",
  refunded: "bg-red-50 text-red-800",
  active: "bg-mist text-ink",
  draft: "bg-surface text-muted ring-1 ring-inset ring-ink/20",
  archived: "bg-ink/10 text-muted",
};
export const statusChipClass = (status: string) =>
  `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
    STATUS_TONES[status] ?? "bg-mist text-ink"
  }`;
export const pillClass = "inline-flex items-center rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium text-ink";

// Big selectable option (category / metal toggles): 48px, rounded like fields.
export const optionClass = (active: boolean) =>
  `inline-flex h-12 items-center justify-center rounded-2xl px-3 text-sm font-medium transition-colors ${
    active ? "bg-ink text-page" : "bg-mist text-ink hover:bg-ink/10"
  }`;
// Round +/- stepper buttons.
export const stepperClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full bg-mist text-lg font-medium text-ink transition-colors hover:bg-ink/10 disabled:opacity-50";
