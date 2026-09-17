import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Integration tests hit local Supabase (storage upload + embed + RPC);
    // CI runners occasionally exceed the 5 s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
