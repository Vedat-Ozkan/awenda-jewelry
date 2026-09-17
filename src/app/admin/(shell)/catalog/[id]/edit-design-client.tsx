"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { resizeImage } from "@/lib/images/resize";
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

const inputClass = "mt-1 block w-full rounded border border-black/[.15] px-3 py-2 text-sm dark:border-white/[.2]";
const labelClass = "mt-4 block text-sm font-medium";
const frHint = "Optional — falls back to English on the storefront";

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
    <div className="p-4 pb-16">
      <h1 className="text-lg font-semibold">Edit design</h1>

      <div className="mt-4">
        <span className="block text-sm font-medium">Main photo</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin photo, not worth next/image config */}
        {mainSrc && <img src={mainSrc} alt="" className="mt-1 h-32 w-32 rounded object-cover" />}
        <label className="mt-2 inline-block text-sm underline">
          Replace photo
          <input type="file" accept="image/*" onChange={handleReplacePhoto} disabled={photoBusy} className="hidden" />
        </label>
      </div>

      <div className="mt-4">
        <span className="block text-sm font-medium">Extra photos</span>
        <ul className="mt-1 flex flex-wrap gap-2">
          {images.map((img, i) => {
            const src = photoSrc(img.thumb_image_path);
            return (
              <li key={img.id} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumb, not worth next/image config */}
                {src && <img src={src} alt="" className="h-16 w-16 rounded object-cover" />}
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    disabled={photoBusy || i === 0}
                    onClick={() => handleReorderExtraPhoto(img.id, "up")}
                    aria-label={`Move photo ${i + 1} up`}
                    className="rounded border border-black/[.15] px-1 disabled:opacity-40 dark:border-white/[.2]"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={photoBusy || i === images.length - 1}
                    onClick={() => handleReorderExtraPhoto(img.id, "down")}
                    aria-label={`Move photo ${i + 1} down`}
                    className="rounded border border-black/[.15] px-1 disabled:opacity-40 dark:border-white/[.2]"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={photoBusy}
                    onClick={() => handleRemoveExtraPhoto(img.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="rounded border border-black/[.15] px-1 text-red-600 dark:border-white/[.2]"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <label className="mt-2 inline-block text-sm underline">
          Add photo
          <input
            type="file"
            accept="image/*"
            onChange={handleAddExtraPhoto}
            disabled={photoBusy}
            className="hidden"
          />
        </label>
        {photoError && <p className="mt-1 text-sm text-red-600">{photoError}</p>}
      </div>

      <label className={labelClass}>
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
        <span className="ml-1 text-xs text-zinc-500">{frHint}</span>
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
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Description (FR)
        <span className="ml-1 text-xs text-zinc-500">{frHint}</span>
        <textarea
          value={form.descriptionFr}
          onChange={(e) => setForm((f) => ({ ...f, descriptionFr: e.target.value }))}
          className={inputClass}
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
        <span className="ml-1 text-xs text-zinc-500">{frHint}</span>
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

      <label className={labelClass}>
        Slug
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className={inputClass}
        />
      </label>

      {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-4 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        Save
      </button>

      <div className="mt-8">
        <h2 className="text-sm font-semibold">Variants</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {variants.map((v) => (
            <li key={v.id} className="rounded border border-black/[.08] p-2 dark:border-white/[.145]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {v.label} — qty {v.qty_on_hand}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveVariant(v.id)}
                  className="text-xs text-red-600 underline"
                >
                  Remove
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <input
                  type="number"
                  min={1}
                  placeholder="N"
                  aria-label={`Quantity for ${v.label}`}
                  value={qtyInputs[v.id] ?? ""}
                  onChange={(e) => setQtyInputs((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  className="w-16 rounded border border-black/[.15] px-1 py-1 text-sm dark:border-white/[.2]"
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  aria-label={`Note for ${v.label}`}
                  value={noteInputs[v.id] ?? ""}
                  onChange={(e) => setNoteInputs((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  className="rounded border border-black/[.15] px-1 py-1 text-sm dark:border-white/[.2]"
                />
                <button
                  type="button"
                  onClick={() => handleAdjust(v.id, "restock")}
                  className="rounded border border-black/[.15] px-2 py-1 text-xs dark:border-white/[.2]"
                >
                  +N restock
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(v.id, "adjustment")}
                  className="rounded border border-black/[.15] px-2 py-1 text-xs dark:border-white/[.2]"
                >
                  −N adjustment
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            placeholder="New variant label"
            value={newVariantLabel}
            onChange={(e) => setNewVariantLabel(e.target.value)}
            className="rounded border border-black/[.15] px-2 py-1 text-sm dark:border-white/[.2]"
          />
          <button
            type="button"
            onClick={handleAddVariant}
            className="rounded border border-black/[.15] px-2 py-1 text-sm dark:border-white/[.2]"
          >
            Add variant
          </button>
        </div>
        {variantError && <p className="mt-1 text-sm text-red-600">{variantError}</p>}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold">Recent stock movements</h2>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="p-1">When</th>
              <th className="p-1">Variant</th>
              <th className="p-1">Delta</th>
              <th className="p-1">Reason</th>
              <th className="p-1">Note</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.id} className="border-t border-black/[.08] dark:border-white/[.145]">
                <td className="p-1">{dateTime.format(new Date(row.created_at))}</td>
                <td className="p-1">{row.variant_label}</td>
                <td className="p-1">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                <td className="p-1">{row.reason}</td>
                <td className="p-1">{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded border border-red-600/40 p-3">
        <h2 className="text-sm font-semibold text-red-600">Danger zone</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Archiving hides this design from the storefront. It is never hard-deleted.
        </p>
        <button
          type="button"
          disabled={design.status === "archived"}
          onClick={handleArchive}
          className="mt-2 rounded border border-red-600 px-3 py-1.5 text-sm text-red-600 disabled:opacity-40"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
