const express = require("express");
const path = require("path");
const app = express();

const DEFAULT_PORT = 3000;

// Read PORT from the environment.
// - Unset or empty string: DEFAULT_PORT (3000)
// - Allowed: a plain decimal integer string ("0" or no leading zero, ASCII digits only) in 0~65535. 0 means an OS-assigned port
// - Rejected (fail fast instead of silently replacing): sign (+/-), decimal point, exponent (1e3), hex (0x10),
//   leading zero (03000), whitespace, non-digit characters, values above 65535
function resolvePort(raw) {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  if (!/^(0|[1-9]\d{0,4})$/.test(raw)) return null;
  const port = Number(raw);
  return port >= 0 && port <= 65535 ? port : null;
}

const PORT = resolvePort(process.env.PORT);
if (PORT === null) {
  console.error(`[Nest-Finder] 서버 시작 실패: PORT 값이 올바르지 않습니다 (입력값: "${process.env.PORT}"). 0~65535 사이의 정수를 사용하세요.`);
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Express 5 passes listen errors (e.g. EADDRINUSE) as the callback's first argument.
// Print the success banner only after confirming there was no error.
const server = app.listen(PORT, "0.0.0.0", (error) => {
  if (error) {
    const reason =
      error.code === "EADDRINUSE"
        ? `포트 ${PORT}이(가) 이미 사용 중입니다. 다른 프로세스를 종료하거나 PORT 환경변수로 다른 포트를 지정하세요.`
        : `${error.code || ""} ${error.message}`.trim();
    console.error(`[Nest-Finder] 서버 시작 실패: ${reason}`);
    process.exitCode = 1;
    return;
  }
  const actualPort = server.address().port;
  console.log(`================================================`);
  console.log(`   🏠 Nest-Finder: 내 집 마련 시뮬레이터 가동!`);
  console.log(`   - 메인 페이지: public/index.html`);
  console.log(`   - 정적 리소스: public/ (CSS, JS, Assets)`);
  console.log(`   - 데이터 리소스: data/data.js`);
  console.log(`   서버 포트: ${actualPort} (http://localhost:${actualPort})`);
  console.log(`================================================`);
});
