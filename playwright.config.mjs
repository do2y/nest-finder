import { defineConfig, devices } from "@playwright/test";
import net from "node:net";

// The test server runs on its own port (default 3100), separate from the dev server (3000).
// reuseExistingServer: false → if the port is already in use, server.js exits with code 1 (NF-017 fix),
// so the run fails immediately instead of testing some other server by mistake.
const TEST_PORT = process.env.TEST_PORT || "3100";

// Before starting the server, Playwright (1.64.1) checks whether the URL is already in use with an HTTP request that has no timeout
// (runner _startProcess → isURLAvailable). If a process accepts TCP connections but never answers HTTP, it waits forever.
// So, in the main process only, try to bind the port the same way server.js does (0.0.0.0) and fail fast if it is taken.
// Workers (TEST_WORKER_INDEX set) load the config while the test server already holds the port, so they skip this check.
async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (e) =>
      reject(new Error(`테스트 포트 ${port}을(를) 사용할 수 없습니다 (${e.code}). 다른 프로세스를 종료하지 말고 TEST_PORT로 다른 포트를 지정하세요.`)),
    );
    probe.listen(Number(port), "0.0.0.0", () => probe.close(resolve));
  });
}
if (process.env.TEST_WORKER_INDEX === undefined) await assertPortFree(TEST_PORT);

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
