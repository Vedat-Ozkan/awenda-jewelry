import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAnonClient, createServiceClient } from "../helpers/local-supabase";

// Env schema (src/lib/env.ts) validates every var on first access, even
// though `createAdminClient`/`createClient` are mocked below and never read
// it for Supabase config — only `EMBEDDINGS_PROVIDER` is actually consumed
// (by getEmbeddingProvider(), which route.ts calls). Stubbed once, before
// the dynamic import, same pattern as src/app/api/keepalive/route.test.ts.
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
vi.stubEnv("EMBEDDINGS_PROVIDER", "fake");

// `src/lib/supabase/admin.ts` imports the `server-only` package, which
// throws outside a Next.js server bundle (see tests/integration/search.test.ts).
// Swapped for the real local-Supabase service-role client so this stays an
// integration test.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));

// `src/lib/supabase/server.ts` reads cookies via next/headers, which isn't
// available outside a request context. requireAdmin()'s bearer-token path
// only calls `.auth.getUser(token)`, which validates against Supabase Auth
// directly and doesn't need a session — a plain anon client works.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createAnonClient(),
}));

const { POST } = await import("@/app/api/photos/route");
const { findCandidates } = await import("@/lib/embeddings/search");

function fakeJpeg(marker: string): Blob {
  return new Blob([`fake-jpeg-bytes AWENDA_FAKE_KEY=${marker} more-bytes`], { type: "image/jpeg" });
}

// Distinct thumb markers per upload: if the route ever embedded `thumb`
// instead of `main`, the rank-1/distance≈0 assertions below would still
// pass with a shared thumb marker, since design and booth would then match
// each other on the thumb embedding instead. Only `main` (shared marker
// "phase3-item") should produce the exact match.
function uploadRequest(target: string, thumbMarker: string, token?: string): Request {
  const form = new FormData();
  form.append("main", fakeJpeg("phase3-item"), "main.jpg");
  form.append("thumb", fakeJpeg(thumbMarker), "thumb.jpg");
  form.append("target", target);
  return new Request("http://localhost/api/photos", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
}

describe("POST /api/photos", () => {
  const supabase = createServiceClient();
  const prefix = `test-photos-${randomUUID().slice(0, 8)}`;
  const adminEmail = `${prefix}-admin@example.com`;
  const nonAdminEmail = `${prefix}-nonadmin@example.com`;
  const password = "test-password-123!";

  let adminUserId: string;
  let nonAdminUserId: string;
  let adminToken: string;
  let nonAdminToken: string;
  let designId: string;
  let boothSaleId: string;

  beforeAll(async () => {
    const { data: adminUser, error: adminUserError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
    });
    if (adminUserError) throw adminUserError;
    adminUserId = adminUser.user.id;

    const { data: nonAdminUser, error: nonAdminUserError } = await supabase.auth.admin.createUser({
      email: nonAdminEmail,
      password,
      email_confirm: true,
    });
    if (nonAdminUserError) throw nonAdminUserError;
    nonAdminUserId = nonAdminUser.user.id;

    const { error: adminEmailsError } = await supabase.from("admin_emails").insert({ email: adminEmail });
    if (adminEmailsError) throw adminEmailsError;

    const anon = createAnonClient();
    const { data: adminSession, error: adminSignInError } = await anon.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    if (adminSignInError) throw adminSignInError;
    adminToken = adminSession.session!.access_token;

    const { data: nonAdminSession, error: nonAdminSignInError } = await anon.auth.signInWithPassword({
      email: nonAdminEmail,
      password,
    });
    if (nonAdminSignInError) throw nonAdminSignInError;
    nonAdminToken = nonAdminSession.session!.access_token;

    const { data: design, error: designError } = await supabase
      .from("designs")
      .insert({
        slug: `${prefix}-design`,
        category: "ring",
        name_en: `${prefix} design`,
        price_cents: 1000,
        status: "active",
      })
      .select("id")
      .single();
    if (designError) throw designError;
    designId = design.id;

    const { data: boothSale, error: boothSaleError } = await supabase
      .from("booth_sales")
      .insert({
        category: "ring",
        variant_label: "One size",
        photo_main_path: "pending",
        photo_thumb_path: "pending",
      })
      .select("id")
      .single();
    if (boothSaleError) throw boothSaleError;
    boothSaleId = boothSale.id;
  });

  afterAll(async () => {
    await supabase.storage.from("photos").remove([
      `designs/${designId}/main.jpg`,
      `designs/${designId}/thumb.jpg`,
    ]);
    const { data: boothRow } = await supabase
      .from("booth_sales")
      .select("photo_main_path, photo_thumb_path")
      .eq("id", boothSaleId)
      .maybeSingle();
    if (boothRow && boothRow.photo_main_path !== "pending") {
      await supabase.storage.from("photos").remove([boothRow.photo_main_path, boothRow.photo_thumb_path]);
    }
    await supabase.from("booth_sales").delete().eq("id", boothSaleId);
    await supabase.from("designs").delete().eq("id", designId);
    await supabase.from("admin_emails").delete().eq("email", adminEmail);
    await supabase.auth.admin.deleteUser(adminUserId);
    await supabase.auth.admin.deleteUser(nonAdminUserId);
  });

  it("returns 401 with no auth", async () => {
    const res = await POST(uploadRequest(`design:${designId}`, "phase3-thumb-unauth"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a signed-in non-admin user", async () => {
    const res = await POST(uploadRequest(`design:${designId}`, "phase3-thumb-nonadmin", nonAdminToken));
    expect(res.status).toBe(403);
  });

  it("uploads, embeds, and updates the design row for an admin", async () => {
    const res = await POST(uploadRequest(`design:${designId}`, "phase3-thumb-design", adminToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      target: `design:${designId}`,
      paths: { main: `designs/${designId}/main.jpg`, thumb: `designs/${designId}/thumb.jpg` },
    });

    const { data: files } = await supabase.storage.from("photos").list(`designs/${designId}`);
    expect(files?.map((f) => f.name).sort()).toEqual(["main.jpg", "thumb.jpg"]);

    const { data: design } = await supabase
      .from("designs")
      .select("main_image_path, thumb_image_path, embedding, embedded_at")
      .eq("id", designId)
      .single();
    expect(design?.main_image_path).toBe(`designs/${designId}/main.jpg`);
    expect(design?.thumb_image_path).toBe(`designs/${designId}/thumb.jpg`);
    expect(design?.embedding).not.toBeNull();
    expect(design?.embedded_at).not.toBeNull();
  });

  it("uploads, embeds, and updates the booth sale row for an admin, then matches it to the design", async () => {
    const res = await POST(uploadRequest(`booth:${boothSaleId}`, "phase3-thumb-booth", adminToken));
    expect(res.status).toBe(200);
    const body: { ok: true; paths: { main: string; thumb: string } } = await res.json();
    expect(body.ok).toBe(true);
    expect(body.paths.main).toMatch(new RegExp(`^booth/\\d{4}-\\d{2}-\\d{2}/${boothSaleId}-main\\.jpg$`));

    const folder = body.paths.main.split(`/${boothSaleId}-main.jpg`)[0];
    const { data: files } = await supabase.storage.from("photos").list(folder);
    const names = files?.map((f) => f.name) ?? [];
    expect(names).toContain(`${boothSaleId}-main.jpg`);
    expect(names).toContain(`${boothSaleId}-thumb.jpg`);

    const { data: boothSale } = await supabase
      .from("booth_sales")
      .select("photo_main_path, photo_thumb_path, embedding, embedded_at")
      .eq("id", boothSaleId)
      .single();
    expect(boothSale?.photo_main_path).toBe(body.paths.main);
    expect(boothSale?.photo_thumb_path).toBe(body.paths.thumb);
    expect(boothSale?.embedding).not.toBeNull();
    expect(boothSale?.embedded_at).not.toBeNull();

    const candidates = await findCandidates(boothSaleId);
    expect(candidates[0].design.id).toBe(designId);
    expect(candidates[0].rank).toBe(1);
    expect(candidates[0].distance).toBeLessThan(1e-6);
  });

  it("returns 400 for a bad target", async () => {
    const res = await POST(uploadRequest("not-a-target", "phase3-thumb-badtarget", adminToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await POST(uploadRequest("design:not-a-uuid", "phase3-thumb-badid", adminToken));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a target row that doesn't exist", async () => {
    const res = await POST(uploadRequest(`design:${randomUUID()}`, "phase3-thumb-404", adminToken));
    expect(res.status).toBe(404);
  });

  it("returns 413 when content-length exceeds the combined file cap", async () => {
    const form = new FormData();
    form.append("main", fakeJpeg("phase3-item"), "main.jpg");
    form.append("thumb", fakeJpeg("phase3-thumb-413"), "thumb.jpg");
    form.append("target", `design:${designId}`);
    const request = new Request("http://localhost/api/photos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-length": String(10 * 1024 * 1024 + 1),
      },
      body: form,
    });
    const res = await POST(request);
    expect(res.status).toBe(413);
  });
});
