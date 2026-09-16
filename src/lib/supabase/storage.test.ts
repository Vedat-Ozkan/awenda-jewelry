import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicPhotoUrl } from "./storage";

describe("publicPhotoUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the public storage URL for a path", () => {
    expect(publicPhotoUrl("designs/abc/main.jpg")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/photos/designs/abc/main.jpg",
    );
  });

  it("strips a leading slash", () => {
    expect(publicPhotoUrl("/designs/abc/main.jpg")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/photos/designs/abc/main.jpg",
    );
  });
});
