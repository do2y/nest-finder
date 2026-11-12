// Phase 1 acceptance criteria (browser integration). Expected values come from independent calculation (nest-finder-evidence/phase1-design).
// Assertions use only DOM text/attributes and the public Chart.js API (Chart.getChart); no dependency on internal module structure.
import { test, expect } from "@playwright/test";

const MARKER = { 자이: 0, 래미안: 1, 힐스테이트: 2, 한남: 6 };

async function setField(page, id, value) {
  await page.fill(`#${id}`, String(value));
}
async function setRate(page, value) {
  await page.evaluate((v) => {
    const s = document.getElementById("save-slider");
    s.value = String(v);
    s.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function selectMarker(page, idx) {
  await page.locator(".custom-marker").nth(idx).click({ force: true });
}
async function setInputs(page, { asset, income, rate }) {
  if (asset !== undefined) await setField(page, "asset-input", asset);
  if (income !== undefined) await setField(page, "income-input", income);
  if (rate !== undefined) await setRate(page, rate);
}
const chartData = (page) =>
  page.evaluate(() => {
    const c = window.Chart && window.Chart.getChart("priceChart");
    if (!c) return null;
    return c.data.datasets.map((d) => ({ label: d.label, data: d.data.map((p) => ({ x: p.x, y: p.y })) }));
  });
const text = (page, id) => page.locator(`#${id}`).innerText().then((t) => t.trim());

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".custom-marker")).toHaveCount(7);
});

test("E-01 NF-003: '1,500' is computed as 1,500만원 (not 1만원)", async ({ page }) => {
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { asset: "1,500", income: "400", rate: 50 });
  await expect(page.locator("#shortfall")).toHaveText("1억 7,700만원");
  await expect(page.locator("#asset-ratio")).toHaveText("7.8%");
  await expect(page.locator("#target-period")).toHaveText("9년 뒤");
});

test("E-02 NF-003: invalid input → error message, calculation stops, previous result removed → recovers when corrected", async ({ page }) => {
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { asset: "1500", income: "400", rate: 50 });
  await expect(page.locator("#target-period")).toHaveText("9년 뒤");

  await setField(page, "asset-input", "abc");
  await page.locator("#asset-input").blur();
  await expect(page.locator("#asset-error")).toHaveText("숫자와 쉼표(,)만 입력할 수 있어요.");
  await expect(page.locator("#asset-input")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#result-alert")).toBeVisible();
  await expect(page.locator("#result-alert")).toContainText("입력값을 확인해 주세요");
  for (const id of ["target-period", "shortfall", "asset-ratio", "monthly-save", "prop-status"]) {
    await expect(page.locator(`#${id}`)).toHaveText("—");
  }
  expect(await chartData(page)).toBeNull();
  await expect(page.locator('.marker-label[data-band="invalid"]')).toHaveCount(7);

  await setField(page, "asset-input", "1500");
  await expect(page.locator("#asset-error")).toHaveText("");
  await expect(page.locator("#asset-input")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#result-alert")).toBeHidden();
  await expect(page.locator("#target-period")).toHaveText("9년 뒤");
  expect(await chartData(page)).not.toBeNull();
});

test("E-02b NF-003: empty, negative, decimal, full-width each show their own message; explicit 0 is allowed", async ({ page }) => {
  const cases = [
    ["", "금액을 입력해 주세요. 없으면 0을 입력하세요."],
    ["-1", "0 이상의 금액을 입력해 주세요."],
    ["1.5", "만원 단위 정수로 입력해 주세요. (예: 1500)"],
    ["１５００", "전각 숫자는 사용할 수 없어요. 반각 숫자로 입력해 주세요."],
    ["1,50", "쉼표는 세 자리마다 넣어 주세요. (예: 1,500)"],
    ["10000001", "최대 1,000억원까지 입력할 수 있어요."],
  ];
  for (const [value, msg] of cases) {
    await setField(page, "asset-input", value);
    await page.locator("#asset-input").blur();
    await expect(page.locator("#asset-error")).toHaveText(msg);
    await expect(page.locator("#target-period")).toHaveText("—");
  }
  await setField(page, "income-input", "100001");
  await page.locator("#income-input").blur();
  await expect(page.locator("#income-error")).toHaveText("최대 10억원까지 입력할 수 있어요.");
  await setInputs(page, { asset: "0", income: "400" });
  await expect(page.locator("#asset-error")).toHaveText("");
  await expect(page.locator("#income-error")).toHaveText("");
  await expect(page.locator("#asset-ratio")).toHaveText("0.0%");
});

test("E-02c NF-003/014: mid-typing state ('1,' → '1,500') does not leave stale results; field error waits for blur/pause", async ({ page }) => {
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { asset: "1500", income: "400", rate: 50 });
  await page.fill("#asset-input", "");
  await page.locator("#asset-input").pressSequentially("1,");
  // Results are cleared immediately (no stale results); the field error is not shown yet while typing
  await expect(page.locator("#target-period")).toHaveText("—");
  await expect(page.locator("#asset-error")).toHaveText("");
  await page.locator("#asset-input").pressSequentially("500");
  await expect(page.locator("#target-period")).toHaveText("9년 뒤");
  await expect(page.locator("#asset-error")).toHaveText("");
  // If typing stops while still invalid, the error appears after a short pause
  await page.fill("#asset-input", "1,5");
  await expect(page.locator("#asset-error")).toHaveText("쉼표는 세 자리마다 넣어 주세요. (예: 1,500)", { timeout: 3000 });
});

test("E-03 NF-001: no state change at the 70% boundary, income-independent, no unfounded loan wording, disclaimer present", async ({ page }) => {
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { asset: "13439", income: "400", rate: 50 });
  await expect(page.locator("#prop-status")).toHaveText("보유 자산이 매물 가격보다 적습니다");
  await expect(page.locator("#asset-ratio")).toHaveText("69.9%");
  await expect(page.locator("#shortfall")).toHaveText("5,761만원");

  await setInputs(page, { asset: "13440" });
  await expect(page.locator("#prop-status")).toHaveText("보유 자산이 매물 가격보다 적습니다");
  await expect(page.locator("#asset-ratio")).toHaveText("70.0%");
  await expect(page.locator("#shortfall")).toHaveText("5,760만원");

  await setInputs(page, { income: "0" });
  await expect(page.locator("#prop-status")).toHaveText("보유 자산이 매물 가격보다 적습니다");

  await setInputs(page, { asset: "19200", income: "400" });
  await expect(page.locator("#prop-status")).toHaveText("보유 자산이 매물 가격 이상입니다");
  await expect(page.locator("#asset-ratio")).toHaveText("100.0%");
  await expect(page.locator("#shortfall")).toHaveText("0원");

  await setInputs(page, { asset: "20000" });
  await expect(page.locator("#asset-ratio")).toHaveText("104.1%");

  const body = await page.locator("body").innerText();
  for (const banned of ["대출 시 매수 가능", "대출 실행", "지금 매수 가능", "중장기 계획 필요"]) expect(body).not.toContain(banned);
  await expect(page.locator("#disclaimer")).toContainText("대출 가능 여부를 판단하는 기능이 아닙니다");
});

test("E-03b NF-001: markers are 2-color + text (✓/title) + legend — state is not conveyed by color alone", async ({ page }) => {
  await setInputs(page, { asset: "16000", income: "400", rate: 50 }); // only 래미안 (15,000) covered
  const labels = page.locator(".marker-label");
  await expect(labels.nth(MARKER.래미안)).toHaveAttribute("data-band", "covered");
  await expect(labels.nth(MARKER.래미안)).toContainText("✓");
  await expect(labels.nth(MARKER.자이)).toHaveAttribute("data-band", "short");
  await expect(labels.nth(MARKER.자이)).not.toContainText("✓");
  await expect(page.locator('.marker-label[data-band="covered"]')).toHaveCount(1);
  await expect(page.locator('.marker-label[data-band="short"]')).toHaveCount(6);
  await expect(page.locator(".custom-marker").nth(MARKER.래미안)).toHaveAttribute("title", /래미안 센터빌.*보유 자산이 매물 가격 이상/);
  await expect(page.locator("#map-legend")).toContainText("보유 자산 ≥ 매물 가격");
  await expect(page.locator("#map-legend")).toContainText("보유 자산 < 매물 가격");
  const colors = await page.evaluate(() => [...new Set([...document.querySelectorAll(".marker-label")].map((e) => getComputedStyle(e).backgroundColor))]);
  expect(colors).toHaveLength(2);
});

test("E-04 NF-004: no interest-rate input UI or wording", async ({ page }) => {
  await expect(page.locator("#interest-input")).toHaveCount(0);
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("금리");
});

test("E-05 NF-002: period text, timeline and chart target point use the same simulation (래미안 센터빌, 29 months)", async ({ page }) => {
  await selectMarker(page, MARKER.래미안);
  await setInputs(page, { asset: "10000", income: "400", rate: 50 });
  await expect(page.locator("#target-period")).toHaveText("2년 5개월 뒤");
  await expect(page.locator("#timeline")).toHaveAttribute("data-state", "reached");
  await expect(page.locator("#target-period")).toHaveAttribute("data-months", "29");
  const ds = await chartData(page);
  const byLabel = Object.fromEntries(ds.map((d) => [d.label, d.data]));
  const target = byLabel["목표 도달"];
  expect(target).toHaveLength(1);
  expect(target[0].x).toBe(29);
  const asset = byLabel["누적 자산"];
  const price = byLabel["매물 가격 (연 2% 상승 가정)"];
  expect(asset.at(-1).x).toBe(48); // chart range max(48, 29)
  expect(asset[29].y).toBeGreaterThanOrEqual(price[29].y);
  expect(asset[28].y).toBeLessThan(price[28].y);
  expect(asset[0].y).toBe(100_000_000);
  expect(price[0].y).toBe(150_000_000);
  expect(price[12].y).toBe(153_000_000);
});

test("E-05b NF-002: timeline for already reached / not reached within 50 years / invalid input", async ({ page }) => {
  await selectMarker(page, MARKER.래미안);
  await setInputs(page, { asset: "20000", income: "400", rate: 50 });
  await expect(page.locator("#timeline")).toHaveAttribute("data-state", "already");
  await expect(page.locator("#target-period")).toHaveText("지금 바로");
  let ds = await chartData(page);
  expect(ds.find((d) => d.label === "목표 도달").data[0].x).toBe(0);

  await selectMarker(page, MARKER.한남);
  await setInputs(page, { asset: "0", income: "400", rate: 50 });
  await expect(page.locator("#timeline")).toHaveAttribute("data-state", "beyond");
  await expect(page.locator("#target-period")).toHaveText("50년 이내 목표 도달 어려움");
  ds = await chartData(page);
  expect(ds.find((d) => d.label === "목표 도달").data).toHaveLength(0);
  expect(ds.find((d) => d.label === "누적 자산").data.at(-1).x).toBe(600);

  await setField(page, "income-input", "abc");
  await expect(page.locator("#timeline")).toHaveAttribute("data-state", "invalid");
  await expect(page.locator("#target-period")).toHaveText("—");

  const steps = await page.locator("#timeline .timeline-step").count();
  expect(steps).toBe(2);
});

test("E-06 NF-008: switching listing updates the floor area", async ({ page }) => {
  await selectMarker(page, MARKER.래미안);
  await expect(page.locator("#prop-area")).toHaveText("공급 59.12m² / 전용 42.55m²");
  await selectMarker(page, MARKER.힐스테이트);
  await expect(page.locator("#prop-area")).toHaveText("공급 112.5m² / 전용 84.9m²");
});

test("E-07 NF-009: on first load, slider value = displayed rate = displayed savings = savings used in calculation", async ({ page }) => {
  await expect(page.locator("#save-slider")).toHaveValue("50");
  await expect(page.locator("#save-val")).toHaveText("50%");
  await expect(page.locator("#save-amount")).toHaveText("월 200만원");
  await expect(page.locator("#monthly-save")).toHaveText("200만원");
  await expect(page.locator("#prop-name")).toHaveText("자이 4단지");
  await expect(page.locator("#target-period")).toHaveText("9년 뒤");
  await setRate(page, 33);
  await expect(page.locator("#save-amount")).toHaveText("월 132만원");
  await setField(page, "income-input", "401");
  await setRate(page, 50);
  await expect(page.locator("#save-amount")).toHaveText("월 200만 5,000원");
  await expect(page.locator("#monthly-save")).toHaveText("200만 5,000원");
});

test("E-07b hard-coded initial values: HTML has '—' placeholders and is filled with real data after load", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  for (const stale of ["11억 9,200", "3년 6개월 뒤", "54%", "234만원", "지금매수 가능", "권장 저축률"]) expect(html).not.toContain(stale);
  await expect(page.locator("#prop-price")).toHaveText("매매 1억 9,200");
});

test("E-08 NF-013: no unfounded tip; shows calculation assumptions and limitations", async ({ page }) => {
  const tip = page.locator("#prop-tip");
  await expect(tip).toContainText("연 2%");
  await expect(tip).toContainText("저축 이자 0%");
  await expect(tip).toContainText("매월 말");
  for (const income of ["abc", "-400", "400"]) {
    await setField(page, "income-input", income);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/매달 -?[\d,]+만원을 저축하면/);
  }
});

test("E-09 NF-014: every input applies immediately without a button; asset changes update marker colors too", async ({ page }) => {
  await expect(page.locator("button")).toHaveCount(0);
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { income: "400", rate: 50 });
  await page.fill("#asset-input", "19200");
  await expect(page.locator("#prop-status")).toHaveText("보유 자산이 매물 가격 이상입니다");
  await expect(page.locator(".marker-label").nth(MARKER.자이)).toHaveAttribute("data-band", "covered");
  await page.fill("#asset-input", "1500");
  await expect(page.locator(".marker-label").nth(MARKER.자이)).toHaveAttribute("data-band", "short");
  await setField(page, "income-input", "800");
  await expect(page.locator("#monthly-save")).toHaveText("400만원");
});

test("E-09b NF-014: leaving a field (blur) only shows the error; it does not re-create the chart (redundant render found by measurement)", async ({ page }) => {
  await page.fill("#asset-input", "1500");
  const id1 = await page.evaluate(() => window.Chart.getChart("priceChart").id);
  await page.locator("#asset-input").blur();
  await page.locator("#income-input").focus();
  await page.locator("#income-input").blur();
  const id2 = await page.evaluate(() => window.Chart.getChart("priceChart").id);
  expect(id2).toBe(id1);
  await page.fill("#asset-input", "1,5");
  await page.locator("#asset-input").blur();
  await expect(page.locator("#asset-error")).toHaveText("쉼표는 세 자리마다 넣어 주세요. (예: 1,500)");
});

test("E-10 regression: Phase 0 repro inputs produce results per the new policy", async ({ page }) => {
  // Same inputs as Phase 0 repro.mjs. Expected values = independent calculation (compound 2%, rounded-down ratio, exact amounts)
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { asset: "1500", income: "400", rate: 50 });
  await expect(page.locator("#target-period")).toHaveText("9년 뒤"); // Before: 7년 5개월 (fixed price)
  await setInputs(page, { asset: "10000" });
  await expect(page.locator("#target-period")).toHaveText("4년 8개월 뒤"); // 56 months, Before: 3년 10개월
  await selectMarker(page, MARKER.래미안);
  await expect(page.locator("#target-period")).toHaveText("2년 5개월 뒤"); // 29 months, Before: 2년 1개월
  await selectMarker(page, MARKER.자이);
  await setInputs(page, { asset: "4,000", income: "4,000" });
  await expect(page.locator("#monthly-save")).toHaveText("2,000만원"); // Before: 2만원 (parseInt('4,000') = 4)
  await setInputs(page, { asset: "99999999999999999999" });
  await expect(page.locator("#prop-status")).toHaveText("—"); // Before: '지금 매수 가능'
});
