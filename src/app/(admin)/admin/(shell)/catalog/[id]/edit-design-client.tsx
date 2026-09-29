"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { resizeImage } from "@/lib/images/resize";
import {
  bareInputClass,
  cardClass,
  dangerButton,
  errorClass,
  h1Class,
  h2Class,
  hintClass,
  inputClass,
  labelClass,
  mutedClass,
  outlineButton,
  primaryButton,
  softButton,
  textareaClass,
} from "@/components/admin/ui";
import { publicPhotoUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/database.types";
import {
  addExtraPhoto,
  addVariant,
  adjustVariantQty,
  archiveDesign,
  removeExtraPhoto,
  removeVariant,
  reorderExtraPhoto,
  updateDesign,
} from "./actions";

type Category = Database["public"]["Enums"]["category"];
type DesignStatus = Database["public"]["Enums"]["design_status"];
type Metal = Database["public"]["Enums"]["metal"];

const METALS: { value: Metal; label: string }[] = [
  { value: "stainless_steel", label: "Stainless steel" },
  { value: "sterling_silver", label: "Sterling silver" },
];

const CATEGORIES: Category[] = [
  "necklace",
  "bracelet",
  "anklet",
  "ring",
  "earring",
  "bangle",
  "chain",
  "pendant",
];
const STATUSES: DesignStatus[] = ["draft", "active", "archived"];

const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "short" });

interface Design {
  id: string;
  slug: string;
  previous_slugs: string[];
  category: Category;
  metal: Metal;
  name_en: string;
  name_fr: string | null;
  description_en: string | null;
  description_fr: string | null;
  material_en: string | null;
  material_fr: string | null;
  dimensions: string | null;
  price_cents: number;
  status: DesignStatus;
  main_image_path: string | null;
  thumb_image_path: string | null;
}

interface Variant {
  id: string;
  label: string;
  qty_on_hand: number;
  sort_order: number;
}

interface DesignImage {
  id: string;
  main_image_path: string;
  thumb_image_path: string;
  sort_order: number;
}

interface LedgerRow {
  id: string;
  variant_id: string;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
  variant_label: string;
}

// Same seed-vs-Storage split as catalog-list.tsx's thumbSrc().
function photoSrc(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("seed/") ? `/${path}` : publicPhotoUrl(path);
}

const frHint = "Optional — falls back to English on the storefront";
// Photo actions are pill-shaped <label>s around a visually hidden file input.
const photoPickClass = `${outlineButton} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent`;
const miniButton =
  "inline-flex h-11 flex-1 items-center justify-center rounded-full bg-mist text-sm font-medium text-ink transition-colors hover:bg-ink/10 disabled:opacity-40";

export function EditDesignClient({
  design,
  variants,
  images,
  ledger,
}: {
  design: Design;
  variants: Variant[];
  images: DesignImage[];
  ledger: LedgerRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: design.slug,
    category: design.category,
    metal: design.metal,
    nameEn: design.name_en,
    nameFr: design.name_fr ?? "",
    descriptionEn: design.description_en ?? "",
    descriptionFr: design.description_fr ?? "",
    materialEn: design.material_en ?? "",
    materialFr: design.material_fr ?? "",
    dimensions: design.dimensions ?? "",
    priceInput: String(design.price_cents / 100),
    status: design.status,
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [newVariantLabel, setNewVariantLabel] = useState("");
  const [variantError, setVariantError] = useState<string | null>(null);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await updateDesign(design.id, {
        slug: form.slug,
        category: form.category,
        metal: form.metal,
        nameEn: form.nameEn,
        nameFr: form.nameFr,
        descriptionEn: form.descriptionEn,
        descriptionFr: form.descriptionFr,
        materialEn: form.materialEn,
        materialFr: form.materialFr,
        dimensions: form.dimensions,
        priceCents: Math.round(Number(form.priceInput) * 100),
        status: form.status,
      });
      router.refresh();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReplacePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const { main, thumb } = await resizeImage(file);
      const body = new FormData();
      body.append("main", main, "main.jpg");
      body.append("thumb", thumb, "thumb.jpg");
      body.append("target", `design:${design.id}`);
      const res = await fetch("/api/photos", { method: "POST", body });
      if (!res.ok) {
        const body2 = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body2.error ?? `Upload failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleAddExtraPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const { main, thumb } = await resizeImage(file);
      const body = new FormData();
      body.append("main", main, "main.jpg");
      body.append("thumb", thumb, "thumb.jpg");
      await addExtraPhoto(design.id, body);
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemoveExtraPhoto(imageId: string) {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await removeExtraPhoto(design.id, imageId);
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleReorderExtraPhoto(imageId: string, direction: "up" | "down") {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await reorderExtraPhoto(design.id, imageId, direction);
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleAddVariant() {
    const label = newVariantLabel.trim();
    if (!label) return;
    setVariantError(null);
    try {
      await addVariant(design.id, label);
      setNewVariantLabel("");
      router.refresh();
    } catch (err) {
      setVariantError((err as Error).message);
    }
  }

  async function handleRemoveVariant(variantId: string) {
    setVariantError(null);
    try {
      await removeVariant(design.id, variantId);
      router.refresh();
    } catch (err) {
      setVariantError((err as Error).message);
    }
  }

  async function handleAdjust(variantId: string, reason: "restock" | "adjustment") {
    const raw = Number(qtyInputs[variantId] ?? "0");
    if (!raw || raw <= 0) return;
    const delta = reason === "restock" ? raw : -raw;
    setVariantError(null);
    try {
      await adjustVariantQty(design.id, variantId, delta, reason, noteInputs[variantId]);
      setQtyInputs((prev) => ({ ...prev, [variantId]: "" }));
      setNoteInputs((prev) => ({ ...prev, [variantId]: "" }));
      router.refresh();
    } catch (err) {
      setVariantError((err as Error).message);
    }
  }

  async function handleArchive() {
    if (!window.confirm("Archive this design? It will no longer be visible on the storefront.")) return;
    await archiveDesign(design.id);
    router.refresh();
  }

  const mainSrc = photoSrc(design.main_image_path);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className={h1Class}>Edit design</h1>
      <p className={`${mutedClass} mt-1`}>{design.name_en}</p>

      <section className={`${cardClass} mt-6`}>
        <h2 className={h2Class}>Main photo</h2>
        <div className="mt-3 flex items-end gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin photo, not worth next/image config */}
          {mainSrc ? <img src={mainSrc} alt="" className="h-32 w-32 rounded-3xl bg-well object-cover" /> : <div className="h-32 w-32 rounded-3xl bg-well" />}
          <label className={photoPickClass}>
            Replace photo
            <input type="file" accept="image/*" onChange={handleReplacePhoto} disabled={photoBusy} className="sr-only" />
          </label>
        </div>

        <h2 className={`${h2Class} mt-6`}>Extra photos</h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {images.map((img, i) => {
            const src = photoSrc(img.thumb_image_path);
            return (
              <li key={img.id} className="flex w-36 flex-col items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb, not worth next/image config */}
                {src ? <img src={src} alt="" className="h-24 w-24 rounded-2xl bg-well object-cover" /> : <div className="h-24 w-24 rounded-2xl bg-well" />}
                <div className="flex w-full gap-1">
                  <button
                    type="button"
                    disabled={photoBusy || i === 0}
                    onClick={() => handleReorderExtraPhoto(img.id, "up")}
                    aria-label={`Move photo ${i + 1} up`}
                    className={miniButton}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={photoBusy || i === images.length - 1}
                    onClick={() => handleReorderExtraPhoto(img.id, "down")}
                    aria-label={`Move photo ${i + 1} down`}
                    className={miniButton}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={photoBusy}
                    onClick={() => handleRemoveExtraPhoto(img.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className={`${miniButton} text-red-700`}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <label className={`${photoPickClass} mt-3`}>
          Add photo
          <input type="file" accept="image/*" onChange={handleAddExtraPhoto} disabled={photoBusy} className="sr-only" />
        </label>
        {photoError && <p className={errorClass}>{photoError}</p>}
      </section>

      <section className={`${cardClass} mt-4`}>
        <label className="block text-sm font-medium">
          Name (EN)
          <input
            type="text"
            value={form.nameEn}
            onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Name (FR)
          <span className={hintClass}>{frHint}</span>
          <input
            type="text"
            value={form.nameFr}
            onChange={(e) => setForm((f) => ({ ...f, nameFr: e.target.value }))}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Description (EN)
          <textarea
            value={form.descriptionEn}
            onChange={(e) => setForm((f) => ({ ...f, descriptionEn: e.target.value }))}
            className={textareaClass}
          />
        </label>
        <label className={labelClass}>
          Description (FR)
          <span className={hintClass}>{frHint}</span>
          <textarea
            value={form.descriptionFr}
            onChange={(e) => setForm((f) => ({ ...f, descriptionFr: e.target.value }))}
            className={textareaClass}
          />
        </label>

        <label className={labelClass}>
          Material (EN)
          <input
            type="text"
            value={form.materialEn}
            onChange={(e) => setForm((f) => ({ ...f, materialEn: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Material (FR)
          <span className={hintClass}>{frHint}</span>
          <input
            type="text"
            value={form.materialFr}
            onChange={(e) => setForm((f) => ({ ...f, materialFr: e.target.value }))}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Dimensions
          <input
            type="text"
            value={form.dimensions}
            onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
            className={inputClass}
          />
        </label>

        <div className="md:grid md:grid-cols-2 md:gap-x-4">
          <label className={labelClass}>
            Category
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Metal
            <select
              value={form.metal}
              onChange={(e) => setForm((f) => ({ ...f, metal: e.target.value as Metal }))}
              className={inputClass}
            >
              {METALS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Price (CAD)
            <input
              type="text"
              inputMode="decimal"
              value={form.priceInput}
              onChange={(e) => setForm((f) => ({ ...f, priceInput: e.target.value }))}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DesignStatus }))}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Slug
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className={inputClass}
          />
        </label>

        {saveError && <p className={errorClass}>{saveError}</p>}
        <button type="button" disabled={saving} onClick={handleSave} className={`${primaryButton} mt-6 h-12 w-full md:w-auto`}>
          Save
        </button>
      </section>

      <section className={`${cardClass} mt-4`}>
        <h2 className={h2Class}>Variants</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {variants.map((v) => (
            <li key={v.id} className="rounded-2xl bg-page p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {v.label} — qty {v.qty_on_hand}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveVariant(v.id)}
                  className="inline-flex h-11 items-center px-2 text-sm font-medium text-red-700 underline underline-offset-4"
                >
                  Remove
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="N"
                  aria-label={`Quantity for ${v.label}`}
                  value={qtyInputs[v.id] ?? ""}
                  onChange={(e) => setQtyInputs((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  className={`${bareInputClass} w-20 px-3 text-center`}
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  aria-label={`Note for ${v.label}`}
                  value={noteInputs[v.id] ?? ""}
                  onChange={(e) => setNoteInputs((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  className={`${bareInputClass} min-w-0 flex-1 basis-40`}
                />
                <button type="button" onClick={() => handleAdjust(v.id, "restock")} className={primaryButton}>
                  +N restock
                </button>
                <button type="button" onClick={() => handleAdjust(v.id, "adjustment")} className={softButton}>
                  −N adjustment
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="New variant label"
            aria-label="New variant label"
            value={newVariantLabel}
            onChange={(e) => setNewVariantLabel(e.target.value)}
            className={`${bareInputClass} min-w-0 flex-1`}
          />
          <button type="button" onClick={handleAddVariant} className={outlineButton}>
            Add variant
          </button>
        </div>
        {variantError && <p className={errorClass}>{variantError}</p>}
      </section>

      <section className={`${cardClass} mt-4`}>
        <h2 className={h2Class}>Recent stock movements</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead>
              <tr className="text-left font-medium text-muted">
                <th className="p-1.5">When</th>
                <th className="p-1.5">Variant</th>
                <th className="p-1.5">Delta</th>
                <th className="p-1.5">Reason</th>
                <th className="p-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} className="border-t border-ink/10">
                  <td className="p-1.5 whitespace-nowrap">{dateTime.format(new Date(row.created_at))}</td>
                  <td className="p-1.5">{row.variant_label}</td>
                  <td className="p-1.5 tabular-nums">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                  <td className="p-1.5">{row.reason}</td>
                  <td className="p-1.5">{row.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-red-700/30 bg-red-50/60 p-4 md:p-6">
        <h2 className="text-base font-semibold text-red-800">Danger zone</h2>
        <p className={`${mutedClass} mt-1`}>
          Archiving hides this design from the storefront. It is never hard-deleted.
        </p>
        <button type="button" disabled={design.status === "archived"} onClick={handleArchive} className={`${dangerButton} mt-3`}>
          Archive
        </button>
      </section>
    </div>
  );
}
