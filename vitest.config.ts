import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/helpers/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
