"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { resizeImage } from "@/lib/images/resize";
import type { Database } from "@/lib/supabase/database.types";
import {
  bareInputClass,
  cardClass,
  chipClass,
  errorClass,
  h1Class,
  h2Class,
  hintClass,
  inputClass,
  labelClass,
  mutedClass,
  optionClass,
  outlineButton,
  primaryButton,
  statusChipClass,
  stepperClass,
  textareaClass,
} from "@/components/admin/ui";
import { createDraftDesign, saveDesignDetails } from "./actions";

type Category = Database["public"]["Enums"]["category"];
type Metal = Database["public"]["Enums"]["metal"];

const METALS: { value: Metal; label: string }[] = [
  { value: "stainless_steel", label: "Stainless steel" },
  { value: "sterling_silver", label: "Sterling silver" },
];

const CATEGORIES: Category[] = [
  "ring",
  "necklace",
  "bracelet",
  "anklet",
  "earring",
  "bangle",
  "chain",
  "pendant",
];

// Matches DRAFT_PRICE_CENTS in ./actions.ts — falls back to the same
// placeholder when the price field is left blank, so a "Save as draft"
// never violates designs.price_cents' `> 0` check constraint.
const DRAFT_PRICE_CENTS = 100;

interface Draft {
  id: string;
  fileName: string;
  main: Blob;
  thumb: Blob;
  previewUrl: string;
  embedStatus: "uploading" | "done" | "error";
  error?: string;
}

interface VariantEntry {
  label: string;
  qty: number;
}

interface DetailsForm {
  category: Category;
  metal: Metal;
  nameEn: string;
  nameFr: string;
  priceInput: string;
  descriptionEn: string;
  descriptionFr: string;
  materialEn: string;
  materialFr: string;
  dimensions: string;
  variants: VariantEntry[];
  customLabel: string;
}

function emptyForm(): DetailsForm {
  return {
    category: "ring",
    metal: "stainless_steel",
    nameEn: "",
    nameFr: "",
    priceInput: "",
    descriptionEn: "",
    descriptionFr: "",
    materialEn: "",
    materialFr: "",
    dimensions: "",
    variants: [],
    customLabel: "",
  };
}

async function uploadPhoto(id: string, main: Blob, thumb: Blob): Promise<void> {
  const form = new FormData();
  form.append("main", main, "main.jpg");
  form.append("thumb", thumb, "thumb.jpg");
  form.append("target", `design:${id}`);
  const res = await fetch("/api/photos", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
}

// Client half of the new design flow (Phase 4 step 4): Screen 1 creates one
// draft design per selected photo and uploads/embeds it; Screen 2 steps
// through each draft's details. Failed uploads keep the draft with a retry
// button that re-posts the same resized blobs kept in state.
export function NewDesignClient({ variantPresets }: { variantPresets: Partial<Record<Category, string[]>> }) {
  const router = useRouter();
  const [screen, setScreen] = useState<"photos" | "details">("photos");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [forms, setForms] = useState<Record<string, DetailsForm>>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError(null);

    for (const file of files) {
      let resized: Awaited<ReturnType<typeof resizeImage>>;
      try {
        resized = await resizeImage(file);
      } catch {
        setError(`Couldn't read ${file.name} — skipped. Use a JPEG, PNG or WebP photo.`);
        continue;
      }
      const { main, thumb } = resized;
      const { id } = await createDraftDesign();
      const previewUrl = URL.createObjectURL(main);
      setDrafts((prev) => [...prev, { id, fileName: file.name, main, thumb, previewUrl, embedStatus: "uploading" }]);
      setForms((prev) => ({ ...prev, [id]: emptyForm() }));

      try {
        await uploadPhoto(id, main, thumb);
        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, embedStatus: "done" } : d)));
      } catch (err) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === id ? { ...d, embedStatus: "error", error: (err as Error).message } : d)),
        );
      }
    }
  }

  async function retry(draft: Draft) {
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, embedStatus: "uploading", error: undefined } : d)));
    try {
      await uploadPhoto(draft.id, draft.main, draft.thumb);
      setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, embedStatus: "done" } : d)));
    } catch (err) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === draft.id ? { ...d, embedStatus: "error", error: (err as Error).message } : d)),
      );
    }
  }

  function updateForm(id: string, patch: Partial<DetailsForm>) {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function toggleVariant(id: string, label: string) {
    setForms((prev) => {
      const form = prev[id];
      const exists = form.variants.some((v) => v.label === label);
      const variants = exists ? form.variants.filter((v) => v.label !== label) : [...form.variants, { label, qty: 1 }];
      return { ...prev, [id]: { ...form, variants } };
    });
  }

  function setVariantQty(id: string, label: string, qty: number) {
    setForms((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        variants: prev[id].variants.map((v) => (v.label === label ? { ...v, qty: Math.max(1, qty) } : v)),
      },
    }));
  }

  function addCustomVariant(id: string) {
    setForms((prev) => {
      const form = prev[id];
      const label = form.customLabel.trim();
      if (!label || form.variants.some((v) => v.label === label)) return prev;
      return { ...prev, [id]: { ...form, customLabel: "", variants: [...form.variants, { label, qty: 1 }] } };
    });
  }

  async function submit(publish: boolean) {
    const draft = drafts[index];
    const form = forms[draft.id];
    const priceInput = Number(form.priceInput);
    const priceCents = priceInput > 0 ? Math.round(priceInput * 100) : DRAFT_PRICE_CENTS;

    setSaving(true);
    setError(null);
    try {
      await saveDesignDetails(
        draft.id,
        {
          category: form.category,
          metal: form.metal,
          nameEn: form.nameEn.trim() || "Untitled",
          nameFr: form.nameFr,
          priceCents,
          descriptionEn: form.descriptionEn,
          descriptionFr: form.descriptionFr,
          materialEn: form.materialEn,
          materialFr: form.materialFr,
          dimensions: form.dimensions,
          variants: form.variants,
        },
        { publish },
      );
      if (index + 1 < drafts.length) {
        setIndex(index + 1);
      } else {
        router.push("/admin/catalog");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (screen === "photos") {
    const uploading = drafts.some((d) => d.embedStatus === "uploading");
    return (
      <div className="mx-auto max-w-2xl" data-testid="new-design">
        <h1 className={h1Class}>New design</h1>
        <p className={`${mutedClass} mt-1`}>
          Step 1 of 2 · Photos. Ivory backdrop, top-down, item centered with room around it, no hands.
        </p>

        <label className="mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-accent/40 bg-surface px-6 py-8 text-center transition-colors hover:bg-mist/50 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
            <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-lg font-semibold text-ink">Take or choose photos</span>
          <span className={mutedClass}>One design per photo. Pick as many as you like.</span>
          <input type="file" accept="image/*" multiple onChange={handleFiles} className="sr-only" />
        </label>
        {error && <p className={errorClass}>{error}</p>}

        <ul className="mt-4 flex flex-col gap-2">
          {drafts.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-3xl bg-surface p-2 pr-4 shadow-[0_1px_0_rgba(30,31,36,0.07)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not worth next/image config */}
              <img src={d.previewUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-well object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.fileName}</span>
              {d.embedStatus === "uploading" && <span className={statusChipClass("draft")}>Uploading…</span>}
              {d.embedStatus === "done" && <span className={statusChipClass("awaiting_pickup")}>Ready</span>}
              {d.embedStatus === "error" && (
                <button type="button" onClick={() => retry(d)} className="inline-flex min-h-11 items-center text-sm font-medium text-red-700 underline underline-offset-4">
                  Embedding failed — retry
                </button>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={drafts.length === 0 || uploading}
          onClick={() => setScreen("details")}
          className={`${primaryButton} mt-6 h-12 w-full md:w-auto`}
        >
          Next
        </button>
      </div>
    );
  }

  const draft = drafts[index];
  const form = forms[draft.id];
  const presets = variantPresets[form.category] ?? [];

  return (
    <div className="mx-auto max-w-2xl" data-testid="new-design">
      <h1 className={h1Class}>New design</h1>
      <p className={`${mutedClass} mt-1`}>
        Step 2 of 2 · Details{drafts.length > 1 ? ` (${index + 1}/${drafts.length})` : ""}
      </p>

      <section className={`${cardClass} mt-6`}>
        <span className={h2Class}>Category</span>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => updateForm(draft.id, { category: c })} className={optionClass(form.category === c)}>
              {c}
            </button>
          ))}
        </div>

        <span className={`${h2Class} mt-5 block`}>Metal</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {METALS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={form.metal === m.value}
              onClick={() => updateForm(draft.id, { metal: m.value })}
              className={optionClass(form.metal === m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className={`${cardClass} mt-4`}>
        <span className={h2Class}>Variants</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((label) => {
            const variant = form.variants.find((v) => v.label === label);
            return (
              <div key={label} className="flex items-center gap-1">
                <button type="button" onClick={() => toggleVariant(draft.id, label)} className={chipClass(!!variant)}>
                  {label}
                </button>
                {variant && (
                  <div className="flex items-center gap-1 text-sm">
                    <button
                      type="button"
                      aria-label={`Decrease ${label}`}
                      onClick={() => setVariantQty(draft.id, label, variant.qty - 1)}
                      className={stepperClass}
                    >
                      -
                    </button>
                    <span className="min-w-5 text-center font-semibold tabular-nums">{variant.qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${label}`}
                      onClick={() => setVariantQty(draft.id, label, variant.qty + 1)}
                      className={stepperClass}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="Custom label"
            aria-label="Custom label"
            value={form.customLabel}
            onChange={(e) => updateForm(draft.id, { customLabel: e.target.value })}
            className={`${bareInputClass} min-w-0 flex-1`}
          />
          <button type="button" onClick={() => addCustomVariant(draft.id)} className={outlineButton}>
            + custom
          </button>
        </div>
      </section>

      <section className={`${cardClass} mt-4`}>
        <label className="block text-sm font-medium">
          Name (EN)
          <input
            type="text"
            value={form.nameEn}
            onChange={(e) => updateForm(draft.id, { nameEn: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Name (FR)
          <span className={hintClass}>Optional — falls back to English on the storefront</span>
          <input
            type="text"
            value={form.nameFr}
            onChange={(e) => updateForm(draft.id, { nameFr: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Price (CAD)
          <input
            type="text"
            inputMode="decimal"
            value={form.priceInput}
            onChange={(e) => updateForm(draft.id, { priceInput: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Description (EN)
          <textarea
            value={form.descriptionEn}
            onChange={(e) => updateForm(draft.id, { descriptionEn: e.target.value })}
            className={textareaClass}
          />
        </label>

        <label className={labelClass}>
          Description (FR)
          <span className={hintClass}>Optional — falls back to English on the storefront</span>
          <textarea
            value={form.descriptionFr}
            onChange={(e) => updateForm(draft.id, { descriptionFr: e.target.value })}
            className={textareaClass}
          />
        </label>

        <label className={labelClass}>
          Material (EN)
          <input
            type="text"
            value={form.materialEn}
            onChange={(e) => updateForm(draft.id, { materialEn: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Material (FR)
          <span className={hintClass}>Optional — falls back to English on the storefront</span>
          <input
            type="text"
            value={form.materialFr}
            onChange={(e) => updateForm(draft.id, { materialFr: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Dimensions
          <input
            type="text"
            value={form.dimensions}
            onChange={(e) => updateForm(draft.id, { dimensions: e.target.value })}
            className={inputClass}
          />
        </label>
      </section>

      {error && <p className={errorClass}>{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-2 md:flex">
        <button type="button" disabled={saving} onClick={() => submit(false)} className={`${outlineButton} h-12`}>
          Save as draft
        </button>
        <button type="button" disabled={saving} onClick={() => submit(true)} className={`${primaryButton} h-12`}>
          Publish
        </button>
      </div>
    </div>
  );
}
