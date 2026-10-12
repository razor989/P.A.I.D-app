import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/oracles/**/*.test.ts"], environment: "node" },
});
