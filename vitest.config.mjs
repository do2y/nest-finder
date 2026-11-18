import { defineConfig } from "vitest/config";

// Unit tests (pure calculation modules) + server startup tests. Runs in the Node environment, no DOM dependency.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.mjs", "tests/server/**/*.test.mjs"],
    environment: "node",
  },
});
