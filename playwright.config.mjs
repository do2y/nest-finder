import { defineConfig, devices } from "@playwright/test";

// The test server runs on its own port (default 3100), separate from the dev server (3000).
// reuseExistingServer: false → if the port is already in use, server.js exits with code 1 (NF-017 fix),
// so the run fails immediately instead of testing some other server by mistake.
const TEST_PORT = process.env.TEST_PORT || "3100";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-results.json" }]],
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: "node server.js",
    env: { PORT: TEST_PORT },
    url: `http://localhost:${TEST_PORT}/`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
