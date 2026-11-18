// UI layer: reads the DOM and renders results. Calculation is delegated to the pure functions in ./calc/ (same modules Vitest tests).
import { validateInputs, parseManwon, parseSaveRate, errorMessage, LIMITS } from "./calc/input.js";
import { assessAffordability } from "./calc/affordability.js";
import { simulateGoal, monthlySaveWon, chartRangeMonths } from "./calc/simulate.js";
import { formatKRW, formatPeriod, formatRatio } from "./calc/format.js";

const MAN = 10_000;
const ERROR_DELAY_MS = 600; // mid-typing: show the field error after this pause (results update immediately)

const $ = (id) => document.getElementById(id);
const slider = $("save-slider");
const assetInput = $("asset-input");
const incomeInput = $("income-input");

const FIELDS = {
  asset: { input: assetInput, error: $("asset-error"), max: LIMITS.ASSET_MANWON_MAX },
  income: { input: incomeInput, error: $("income-error"), max: LIMITS.INCOME_MANWON_MAX },
  rate: { input: slider, error: $("rate-error") },
};

let selectedIndex = 0;
let chart = null;
let markerLayer = null;
let markerKey = null; // re-render markers only when the input that sets marker color (asset) or validity changes
const errorTimers = {};

// ---------- field errors ----------
function setFieldError(name, code) {
  const f = FIELDS[name];
  clearTimeout(errorTimers[name]);
  if (code) {
    f.error.textContent = errorMessage(code, { max: f.max });
    f.input.setAttribute("aria-invalid", "true");
  } else {
    f.error.textContent = "";
    f.input.removeAttribute("aria-invalid");
  }
}

// The field being typed in shows its error after a pause (or immediately on blur); other fields show it immediately.
// Fixing a value clears its error immediately.
function updateFieldErrors(errors, activeField, immediate) {
  for (const name of Object.keys(FIELDS)) {
    const code = errors[name];
    if (!code) setFieldError(name, null);
    else if (name === activeField && !immediate) {
      clearTimeout(errorTimers[name]);
      errorTimers[name] = setTimeout(() => setFieldError(name, code), ERROR_DELAY_MS);
    } else setFieldError(name, code);
  }
}

// ---------- render ----------
const STATUS_TEXT = { covered: "보유 자산이 매물 가격 이상입니다", short: "보유 자산이 매물 가격보다 적습니다" };

function renderListing(data) {
  $("prop-img").src = data.img;
  $("prop-img").alt = `${data.name} 이미지`;
  $("prop-name").innerText = data.name;
  $("prop-price").innerText = `매매 ${data.price}`;
  $("prop-area").innerText = data.area; // NF-008
}

function renderSaveLabels(rateOk, ratePct, incomeOk, incomeManwon) {
  const saveVal = $("save-val");
  const saveAmount = $("save-amount");
  saveVal.innerText = rateOk ? `${ratePct}%` : "—";
  saveAmount.innerText = rateOk && incomeOk ? `월 ${formatKRW(monthlySaveWon(incomeManwon, ratePct))}` : "—";
  const high = rateOk && ratePct >= 60;
  saveVal.style.color = high ? "#ff4d4f" : "#2563eb";
  saveAmount.style.color = high ? "#ff4d4f" : "#6b7280";
}

function setStatus(band) {
  const el = $("prop-status");
  el.innerText = band === "invalid" ? "—" : STATUS_TEXT[band];
  el.className = `status-pill mt-2 status-${band === "invalid" ? "neutral" : band}`;
}

function setTimeline(state, text, months) {
  const tl = $("timeline");
  tl.dataset.state = state;
  const period = $("target-period");
  period.innerText = text;
  if (months === null || months === undefined) period.removeAttribute("data-months");
  else period.dataset.months = String(months);
}

function renderInvalid() {
  $("result-alert").hidden = false;
  setStatus("invalid");
  for (const id of ["asset-ratio", "shortfall", "monthly-save"]) $(id).innerText = "—";
  setTimeline("invalid", "—", null);
  if (chart) { chart.destroy(); chart = null; }
}

function renderResult(aff, sim, saveWon) {
  $("result-alert").hidden = true;
  setStatus(aff.covered ? "covered" : "short");
  $("asset-ratio").innerText = formatRatio(aff.ratioPermille);
  $("shortfall").innerText = formatKRW(aff.shortfallWon);
  $("monthly-save").innerText = formatKRW(saveWon);
  const state = sim.status === "beyond_horizon" ? "beyond" : sim.status;
  setTimeline(state, formatPeriod(sim), sim.months);
  renderChart(sim);
}

// Instance re-creation is kept as before (optimizing it is Phase 3). Data comes from the same simulateGoal result as the period text.
function renderChart(sim) {
  if (chart) chart.destroy();
  const range = chartRangeMonths(sim);
  const points = sim.series.slice(0, range + 1);
  const target = sim.months === null ? [] : [{ x: sim.months, y: sim.series[sim.months].assetWon }];
  chart = new Chart($("priceChart"), {
    type: "line",
    data: {
      datasets: [
        { label: "매물 가격 (연 2% 상승 가정)", data: points.map((p) => ({ x: p.month, y: p.priceWon })), borderColor: "#9ca3af", borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0 },
        { label: "누적 자산", data: points.map((p) => ({ x: p.month, y: p.assetWon })), borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,0.1)", pointRadius: 0, fill: true, tension: 0 },
        { label: "목표 도달", data: target, showLine: false, pointRadius: 5, pointBackgroundColor: "#facc15", borderColor: "#ca8a04" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (items) => `${items[0].parsed.x}개월 뒤`, label: (c) => `${c.dataset.label}: ${formatKRW(Math.round(c.parsed.y))}` } },
      },
      scales: {
        x: {
          type: "linear", min: 0, max: range,
          ticks: { stepSize: range <= 120 ? 12 : 60, callback: (v) => (v === 0 ? "현재" : `${v / 12}년`) },
          grid: { display: false },
        },
        y: { display: false },
      },
    },
  });
}

// ---------- map ----------
const map = L.map("map", { zoomControl: false }).setView([37.5665, 126.978], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

function bandFor(apt, assetWon) {
  if (assetWon === null) return "invalid";
  return assessAffordability({ assetWon, priceWon: apt.price_raw }).covered ? "covered" : "short";
}

const BAND_TITLE = { covered: "보유 자산이 매물 가격 이상", short: "보유 자산이 매물 가격보다 적음", invalid: "입력 오류로 계산 중단" };

function renderMarkers(assetWon) {
  if (markerLayer) map.removeLayer(markerLayer);
  markerLayer = L.layerGroup().addTo(map);
  propertyData.forEach((apt, index) => {
    const band = bandFor(apt, assetWon);
    const priceShort = (apt.price_raw / 100000000).toFixed(1) + "억";
    const icon = L.divIcon({
      className: "custom-marker",
      html: `<div class="marker-label band-${band}" data-band="${band}">${band === "covered" ? "✓ " : ""}${priceShort}</div>`,
      iconSize: [60, 30],
      iconAnchor: [30, 15],
    });
    const marker = L.marker([apt.lat, apt.lng], { icon, title: `${apt.name} · 매매 ${apt.price} · ${BAND_TITLE[band]}` });
    marker.on("click", () => {
      selectedIndex = index;
      recalc({});
      map.flyTo([apt.lat, apt.lng], 14);
    });
    markerLayer.addLayer(marker);
  });
}

// ---------- recalculation (NF-014: every input applies immediately) ----------
function recalc({ field = null, immediate = false } = {}) {
  const data = propertyData[selectedIndex];
  const v = validateInputs({ asset: assetInput.value, income: incomeInput.value, rate: slider.value });
  updateFieldErrors(v.errors, field, immediate);
  renderListing(data);

  // The savings label depends only on income and rate (it shows even when asset is invalid). Same parser as validateInputs.
  const rate = parseSaveRate(slider.value);
  const income = parseManwon(incomeInput.value, { max: LIMITS.INCOME_MANWON_MAX });
  renderSaveLabels(rate.ok, rate.ok ? rate.value : 0, income.ok, income.ok ? income.value : 0);

  let assetWon = null;
  if (v.ok) {
    assetWon = v.values.assetManwon * MAN;
    const saveWon = monthlySaveWon(v.values.incomeManwon, v.values.ratePct);
    const aff = assessAffordability({ assetWon, priceWon: data.price_raw });
    const sim = simulateGoal({ assetWon, monthlySaveWon: saveWon, priceWon: data.price_raw });
    renderResult(aff, sim, saveWon);
  } else {
    renderInvalid();
  }

  const key = assetWon === null ? "invalid" : String(assetWon);
  if (key !== markerKey) {
    markerKey = key;
    renderMarkers(assetWon);
  }
}

// Leaving a field (blur) only shows that field's pending error immediately. Results are already current from the input event, so no recompute.
// (Measured: recomputing on blur caused one extra chart re-creation each time focus moved — see Notion log 6)
function showPendingError(name) {
  const f = FIELDS[name];
  const r = name === "rate" ? parseSaveRate(f.input.value) : parseManwon(f.input.value, { max: f.max });
  setFieldError(name, r.ok ? null : r.code);
}

for (const name of ["asset", "income"]) {
  FIELDS[name].input.addEventListener("input", () => recalc({ field: name }));
  FIELDS[name].input.addEventListener("blur", () => showPendingError(name));
}
slider.addEventListener("input", () => recalc({ field: "rate", immediate: true }));

recalc({ immediate: true });
