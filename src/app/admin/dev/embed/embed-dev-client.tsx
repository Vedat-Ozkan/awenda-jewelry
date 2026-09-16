"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import type { Candidate } from "@/lib/embeddings/search";
import { resizeImage } from "@/lib/images/resize";
import { createClient } from "@/lib/supabase/client";
import { publicPhotoUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/database.types";
import { createDevBoothSale, createDevDesign, devFindCandidates } from "./actions";

declare global {
  interface Window {
    __awendaResize?: typeof resizeImage;
  }
}

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

async function uploadPhoto(file: File, target: string) {
  const { main, thumb } = await resizeImage(file);
  const form = new FormData();
  form.append("main", main, "main.jpg");
  form.append("thumb", thumb, "thumb.jpg");
  form.append("target", target);
  const res = await fetch("/api/photos", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
}

// Client half of the dev harness page (Phase 3 step 5). Exposes
// window.__awendaResize for e2e/resize.spec.ts and includes a minimal
// dev-only sign-in since there's no login UI until Phase 4.
export function EmbedDevClient() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("ring");
  const [status, setStatus] = useState<string | null>(null);
  const [boothSaleId, setBoothSaleId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  useEffect(() => {
    window.__awendaResize = resizeImage;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setSignInError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) setSignInError(error.message);
  }

  async function signOut() {
    await createClient().auth.signOut();
  }

  async function handleCatalogPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Uploading catalog photo…");
    try {
      const { id } = await createDevDesign(category);
      await uploadPhoto(file, `design:${id}`);
      setStatus(`Catalog photo uploaded for design ${id}.`);
    } catch (err) {
      setStatus(`Catalog upload failed: ${(err as Error).message}`);
    }
  }

  async function handleBoothPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Uploading booth photo…");
    try {
      const { id } = await createDevBoothSale(category);
      await uploadPhoto(file, `booth:${id}`);
      setBoothSaleId(id);
      setCandidates(null);
      setStatus(`Booth photo uploaded for booth sale ${id}.`);
    } catch (err) {
      setStatus(`Booth upload failed: ${(err as Error).message}`);
    }
  }

  async function handleFindMatches() {
    if (!boothSaleId) return;
    setStatus("Finding matches…");
    try {
      setCandidates(await devFindCandidates(boothSaleId));
      setStatus(null);
    } catch (err) {
      setStatus(`Find matches failed: ${(err as Error).message}`);
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-semibold">Embedding dev harness</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create this user in Supabase Studio (http://localhost:54323 → Authentication) with an
          email listed in ADMIN_EMAILS, and run <code>pnpm seed:admins</code>.
        </p>
        <form onSubmit={signIn} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            required
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-white">
            Sign in
          </button>
          {signInError && <p className="text-sm text-red-600">{signInError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-xl font-semibold">Embedding dev harness</h1>
      <p className="mt-2 flex items-center justify-between text-sm text-gray-600">
        <span>Signed in as {user.email}</span>
        <button onClick={signOut} className="text-blue-600 underline">
          Sign out
        </button>
      </p>

      <label className="mt-6 block text-sm font-medium">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6 flex flex-col gap-4">
        <label className="block">
          <span className="block text-sm font-medium">Catalog photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCatalogPhoto}
            className="mt-1"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium">Booth photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleBoothPhoto}
            className="mt-1"
          />
        </label>

        <button
          onClick={handleFindMatches}
          disabled={!boothSaleId}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-40"
        >
          Find matches
        </button>
      </div>

      {status && <p className="mt-4 text-sm text-gray-600">{status}</p>}

      {candidates && (
        <ul className="mt-4 flex flex-col gap-3">
          {candidates.map((c) => (
            <li
              key={c.design.id}
              className="flex items-center gap-3 rounded border border-gray-200 p-2"
            >
              {c.design.thumb_image_path && (
                // eslint-disable-next-line @next/next/no-img-element -- dev-only harness, not worth next/image config
                <img
                  src={publicPhotoUrl(c.design.thumb_image_path)}
                  alt=""
                  className="h-16 w-16 rounded object-cover"
                />
              )}
              <div className="text-sm">
                <p className="font-medium">{c.design.name_en}</p>
                <p className="text-gray-600">
                  {c.design.category} · distance {c.distance.toFixed(4)}
                  {c.crossCategory ? " · cross-category" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
