// Integration tests for server.js PORT handling and NF-017 (false success message on port conflict).
// Every child process is tracked by PID and only those processes are terminated. Ports are OS-assigned (0) to avoid conflicts with other servers.
import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import net from "node:net";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const children = new Set();

function startServer(port, { timeoutMs = 5000 } = {}) {
  const env = { ...process.env };
  if (port === undefined) delete env.PORT;
  else env.PORT = port;
  const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ child, state: "running", stdout, stderr }), timeoutMs);
    child.stdout.on("data", () => {
      const m = stdout.match(/http:\/\/localhost:(\d+)/);
      if (m) { clearTimeout(timer); resolve({ child, state: "listening", port: Number(m[1]), stdout, stderr }); }
    });
    child.on("exit", (code) => { clearTimeout(timer); resolve({ child, state: "exited", code, stdout, stderr }); });
  });
}

function stop(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}

function httpStatus(port, urlPath = "/") {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: urlPath }, (res) => { res.resume(); resolve(res.statusCode); }).on("error", reject);
  });
}

function occupyPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "0.0.0.0", () => resolve(srv));
  });
}

afterEach(async () => {
  await Promise.all([...children].map(stop));
  children.clear();
});

describe("server.js PORT handling", () => {
  it("PORT=0 starts on an OS-assigned port, serves the page and data, and the banner shows the real port", async () => {
    const r = await startServer("0");
    expect(r.state).toBe("listening");
    expect(r.port).toBeGreaterThan(0);
    expect(await httpStatus(r.port, "/")).toBe(200);
    expect(await httpStatus(r.port, "/data/data.js")).toBe(200);
    expect(r.stdout).toContain(`서버 포트: ${r.port}`);
  });

  it.each(["1.5", "-1", "1e3", "0x10", "03000", "+3000", " 3000", "3000 ", "65536", "99999999999999999999", "３０００", "abc"])(
    "invalid PORT=%j exits with code 1 and prints no success banner",
    async (value) => {
      const r = await startServer(value);
      expect(r.state).toBe("exited");
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("PORT 값이 올바르지 않습니다");
      expect(r.stdout).not.toContain("가동!");
    },
  );
});

describe("NF-017 port conflict", () => {
  it("exits with code 1 and a failure message when the port is already in use; the success banner is not printed", async () => {
    const occupier = await occupyPort();
    const port = occupier.address().port;
    try {
      const r = await startServer(String(port));
      expect(r.state).toBe("exited");
      expect(r.code).toBe(1);
      expect(r.stderr).toContain(`포트 ${port}이(가) 이미 사용 중입니다`);
      expect(r.stdout).not.toContain("가동!");
    } finally {
      await new Promise((res) => occupier.close(res));
    }
  });
});
