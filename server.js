const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`================================================`);
  console.log(`   🏠 Nest-Finder: 내 집 마련 시뮬레이터 가동!`);
  console.log(`   - 메인 페이지: public/index.html`);
  console.log(`   - 정적 리소스: public/ (CSS, JS, Assets)`);
  console.log(`   - 데이터 리소스: data/data.js`);
  console.log(`   서버 포트: ${PORT}`);
  console.log(`================================================`);
});
