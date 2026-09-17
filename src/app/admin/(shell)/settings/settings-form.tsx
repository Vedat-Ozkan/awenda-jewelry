"use client";

import { useState } from "react";
import type { SettingsInput } from "@/lib/settings/schema";
import type { Database } from "@/lib/supabase/database.types";
import { saveSettings } from "./actions";

type Settings = Database["public"]["Tables"]["settings"]["Row"];

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

// HH:MM:SS (Postgres `time`) -> HH:MM (<input type="time">).
function toTimeInput(value: string | null): string {
  return value?.slice(0, 5) ?? "";
}

function toDollarsInput(cents: number | null): string {
  return cents == null ? "" : String(cents / 100);
}

interface FormState {
  marketName: string;
  marketAddress: string;
  marketWeekday: number;
  marketOpenTime: string;
  marketCloseTime: string;
  marketTimezone: string;
  marketClosedUntil: string;
  marketClosedNoteEn: string;
  marketClosedNoteFr: string;
  pickupInstructionsEn: string;
  pickupInstructionsFr: string;
  shippingEnabled: boolean;
  shippingFlatDollars: string;
  freeShippingThresholdDollars: string;
  stripeTaxEnabled: boolean;
  variantPresetsJson: string;
}

function toFormState(settings: Settings): FormState {
  return {
    marketName: settings.market_name ?? "",
    marketAddress: settings.market_address ?? "",
    marketWeekday: settings.market_weekday ?? 0,
    marketOpenTime: toTimeInput(settings.market_open_time),
    marketCloseTime: toTimeInput(settings.market_close_time),
    marketTimezone: settings.market_timezone,
    marketClosedUntil: settings.market_closed_until ?? "",
    marketClosedNoteEn: settings.market_closed_note_en ?? "",
    marketClosedNoteFr: settings.market_closed_note_fr ?? "",
    pickupInstructionsEn: settings.pickup_instructions_en ?? "",
    pickupInstructionsFr: settings.pickup_instructions_fr ?? "",
    shippingEnabled: settings.shipping_enabled,
    shippingFlatDollars: toDollarsInput(settings.shipping_flat_cents),
    freeShippingThresholdDollars: toDollarsInput(settings.free_shipping_threshold_cents),
    stripeTaxEnabled: settings.stripe_tax_enabled,
    variantPresetsJson: JSON.stringify(settings.variant_presets, null, 2),
  };
}

const inputClass = "mt-1 block w-full rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2]";
const labelClass = "mt-4 block text-sm font-medium";

// Settings form (Phase 4 step 9): one server action (saveSettings) over the
// whole row. Dollar amounts are edited as CAD strings and converted to
// cents on submit; variant_presets is a raw JSON textarea, parsed
// client-side (a JSON syntax error is shown before it ever reaches the
// server) and validated server-side by settingsSchema.
export function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState<FormState>(() => toFormState(settings));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    let variantPresets: unknown;
    try {
      variantPresets = JSON.parse(form.variantPresetsJson);
    } catch {
      setError("Variant presets: invalid JSON");
      return;
    }

    setSaving(true);
    try {
      await saveSettings({
        marketName: form.marketName,
        marketAddress: form.marketAddress,
        marketWeekday: form.marketWeekday,
        marketOpenTime: form.marketOpenTime,
        marketCloseTime: form.marketCloseTime,
        marketTimezone: form.marketTimezone,
        marketClosedUntil: form.marketClosedUntil || null,
        marketClosedNoteEn: form.marketClosedNoteEn,
        marketClosedNoteFr: form.marketClosedNoteFr,
        pickupInstructionsEn: form.pickupInstructionsEn,
        pickupInstructionsFr: form.pickupInstructionsFr,
        shippingEnabled: form.shippingEnabled,
        shippingFlatCents: Math.round(Number(form.shippingFlatDollars) * 100),
        freeShippingThresholdCents:
          form.freeShippingThresholdDollars === "" ? null : Math.round(Number(form.freeShippingThresholdDollars) * 100),
        stripeTaxEnabled: form.stripeTaxEnabled,
        variantPresets: variantPresets as SettingsInput["variantPresets"],
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-lg">
      <label className={labelClass}>
        Market name
        <input
          type="text"
          value={form.marketName}
          onChange={(e) => update({ marketName: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Market address
        <input
          type="text"
          value={form.marketAddress}
          onChange={(e) => update({ marketAddress: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Market day
        <select
          value={form.marketWeekday}
          onChange={(e) => update({ marketWeekday: Number(e.target.value) })}
          className={inputClass}
        >
          {WEEKDAYS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex gap-2">
        <label className="flex-1 text-sm font-medium">
          Open time
          <input
            type="time"
            value={form.marketOpenTime}
            onChange={(e) => update({ marketOpenTime: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex-1 text-sm font-medium">
          Close time
          <input
            type="time"
            value={form.marketCloseTime}
            onChange={(e) => update({ marketCloseTime: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <label className={labelClass}>
        Market timezone (IANA)
        <input
          type="text"
          value={form.marketTimezone}
          onChange={(e) => update({ marketTimezone: e.target.value })}
          placeholder="America/Toronto"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Closed until
        <input
          type="date"
          value={form.marketClosedUntil}
          onChange={(e) => update({ marketClosedUntil: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Closed note (EN)
        <input
          type="text"
          value={form.marketClosedNoteEn}
          onChange={(e) => update({ marketClosedNoteEn: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Closed note (FR)
        <span className="ml-1 text-xs text-zinc-500">Optional — falls back to English on the storefront</span>
        <input
          type="text"
          value={form.marketClosedNoteFr}
          onChange={(e) => update({ marketClosedNoteFr: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Pickup instructions (EN)
        <textarea
          value={form.pickupInstructionsEn}
          onChange={(e) => update({ pickupInstructionsEn: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Pickup instructions (FR)
        <span className="ml-1 text-xs text-zinc-500">Optional — falls back to English on the storefront</span>
        <textarea
          value={form.pickupInstructionsFr}
          onChange={(e) => update({ pickupInstructionsFr: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.shippingEnabled}
          onChange={(e) => update({ shippingEnabled: e.target.checked })}
        />
        Shipping enabled
      </label>

      <label className={labelClass}>
        Flat shipping rate (CAD)
        <input
          type="text"
          inputMode="decimal"
          value={form.shippingFlatDollars}
          onChange={(e) => update({ shippingFlatDollars: e.target.value })}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Free shipping threshold (CAD, blank = never free)
        <input
          type="text"
          inputMode="decimal"
          value={form.freeShippingThresholdDollars}
          onChange={(e) => update({ freeShippingThresholdDollars: e.target.value })}
          className={inputClass}
        />
      </label>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.stripeTaxEnabled}
          onChange={(e) => update({ stripeTaxEnabled: e.target.checked })}
        />
        Stripe tax enabled
        <span className="text-xs text-zinc-500">(display only until Phase 6)</span>
      </label>

      <label className={labelClass}>
        Variant presets (JSON)
        <textarea
          value={form.variantPresetsJson}
          onChange={(e) => update({ variantPresetsJson: e.target.value })}
          rows={12}
          className={`${inputClass} font-mono text-xs`}
        />
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="mt-2 text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        Save
      </button>
    </form>
  );
}
