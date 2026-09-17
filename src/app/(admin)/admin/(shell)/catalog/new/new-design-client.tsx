"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { resizeImage } from "@/lib/images/resize";
import type { Database } from "@/lib/supabase/database.types";
import { createDraftDesign, saveDesignDetails } from "./actions";

type Category = Database["public"]["Enums"]["category"];

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

    for (const file of files) {
      const { main, thumb } = await resizeImage(file);
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
    return (
      <div className="p-4" data-testid="new-design">
        <h1 className="text-lg font-semibold">New design — Photos</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Gray tray, item centered, no hands.</p>

        <input type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} className="mt-4" />

        <ul className="mt-4 flex flex-col gap-2">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded border border-black/[.08] p-2 dark:border-white/[.145]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not worth next/image config */}
              <img src={d.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
              <span className="flex-1 text-sm">{d.fileName}</span>
              {d.embedStatus === "uploading" && <span className="text-xs text-zinc-500">Uploading…</span>}
              {d.embedStatus === "done" && <span className="text-xs text-green-700">Ready</span>}
              {d.embedStatus === "error" && (
                <button type="button" onClick={() => retry(d)} className="text-xs text-red-600 underline">
                  Embedding failed — retry
                </button>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={drafts.length === 0 || drafts.some((d) => d.embedStatus === "uploading")}
          onClick={() => setScreen("details")}
          className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
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
    <div className="p-4" data-testid="new-design">
      <h1 className="text-lg font-semibold">
        New design — Details{drafts.length > 1 ? ` (${index + 1}/${drafts.length})` : ""}
      </h1>

      <div className="mt-4">
        <span className="block text-sm font-medium">Category</span>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateForm(draft.id, { category: c })}
              className={`rounded border px-2 py-3 text-sm ${
                form.category === c
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/[.15] dark:border-white/[.2]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <span className="block text-sm font-medium">Variants</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {presets.map((label) => {
            const variant = form.variants.find((v) => v.label === label);
            return (
              <div key={label} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleVariant(draft.id, label)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    variant
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-black/[.15] dark:border-white/[.2]"
                  }`}
                >
                  {label}
                </button>
                {variant && (
                  <div className="flex items-center gap-1 text-sm">
                    <button
                      type="button"
                      aria-label={`Decrease ${label}`}
                      onClick={() => setVariantQty(draft.id, label, variant.qty - 1)}
                      className="rounded border border-black/[.15] px-2 dark:border-white/[.2]"
                    >
                      -
                    </button>
                    <span>{variant.qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${label}`}
                      onClick={() => setVariantQty(draft.id, label, variant.qty + 1)}
                      className="rounded border border-black/[.15] px-2 dark:border-white/[.2]"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            placeholder="Custom label"
            value={form.customLabel}
            onChange={(e) => updateForm(draft.id, { customLabel: e.target.value })}
            className="rounded border border-black/[.15] px-2 py-1 text-sm dark:border-white/[.2]"
          />
          <button
            type="button"
            onClick={() => addCustomVariant(draft.id)}
            className="rounded border border-black/[.15] px-2 py-1 text-sm dark:border-white/[.2]"
          >
            + custom
          </button>
        </div>
      </div>

      <label className="mt-4 block text-sm font-medium">
        Name (EN)
        <input
          type="text"
          value={form.nameEn}
          onChange={(e) => updateForm(draft.id, { nameEn: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Name (FR)
        <span className="ml-1 text-xs text-zinc-500">Optional — falls back to English on the storefront</span>
        <input
          type="text"
          value={form.nameFr}
          onChange={(e) => updateForm(draft.id, { nameFr: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Price (CAD)
        <input
          type="text"
          inputMode="decimal"
          value={form.priceInput}
          onChange={(e) => updateForm(draft.id, { priceInput: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Description (EN)
        <textarea
          value={form.descriptionEn}
          onChange={(e) => updateForm(draft.id, { descriptionEn: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Description (FR)
        <span className="ml-1 text-xs text-zinc-500">Optional — falls back to English on the storefront</span>
        <textarea
          value={form.descriptionFr}
          onChange={(e) => updateForm(draft.id, { descriptionFr: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Material (EN)
        <input
          type="text"
          value={form.materialEn}
          onChange={(e) => updateForm(draft.id, { materialEn: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Material (FR)
        <span className="ml-1 text-xs text-zinc-500">Optional — falls back to English on the storefront</span>
        <input
          type="text"
          value={form.materialFr}
          onChange={(e) => updateForm(draft.id, { materialFr: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      <label className="mt-4 block text-sm font-medium">
        Dimensions
        <input
          type="text"
          value={form.dimensions}
          onChange={(e) => updateForm(draft.id, { dimensions: e.target.value })}
          className="mt-1 block w-full rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2]"
        />
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(false)}
          className="rounded border border-black/[.15] px-4 py-2 text-sm dark:border-white/[.2]"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(true)}
          className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          Publish
        </button>
      </div>
    </div>
  );
}
