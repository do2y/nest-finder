const slider = document.getElementById("save-slider");
const saveValText = document.getElementById("save-val");
const assetInput = document.getElementById("asset-input");
const incomeInput = document.getElementById("income-input");

let chart;
let currentAptIndex = 0;

const saveAmountText = document.getElementById("save-amount");
if (slider) {
  slider.addEventListener("input", (e) => {
    const ratio = parseInt(e.target.value);
    saveValText.innerText = `${ratio}%`;

    const income = parseInt(incomeInput.value) || 0;
    const calculatedSave = Math.floor(income * (ratio / 100));

    if (saveAmountText) {
      saveAmountText.innerText = `월 ${formatNumber(calculatedSave)}만원`;
    }

    if (ratio >= 60) {
      saveValText.style.color = "#ff4d4f";
      if (saveAmountText) saveAmountText.style.color = "#ff4d4f";
    } else {
      saveValText.style.color = "#2563eb";
      if (saveAmountText) saveAmountText.style.color = "#6b7280";
    }

    updateReport(currentAptIndex);
  });
}

function updateReport(index) {
  currentAptIndex = index;
  const data = propertyData[index];
  if (!data) return;

  const myAsset = (parseInt(assetInput.value) || 0) * 10000;
  const monthlyIncome = (parseInt(incomeInput.value) || 0) * 10000;
  const saveRatio = (parseInt(slider.value) || 0) / 100;
  const monthlySave = monthlyIncome * saveRatio;

  const shortfall = data.price_raw - myAsset;
  const monthsToTarget =
    shortfall > 0 && monthlySave > 0 ? Math.ceil(shortfall / monthlySave) : 0;
  const years = Math.floor(monthsToTarget / 12);
  const months = monthsToTarget % 12;

  const statusEl = document.getElementById("prop-status");
  const ratio = myAsset / data.price_raw;

  if (ratio >= 1.0) {
    statusEl.innerText = "지금 매수 가능";
    statusEl.className =
      "text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-600";
  } else if (ratio >= 0.7) {
    statusEl.innerText = "대출 시 매수 가능";
    statusEl.className =
      "text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-600";
  } else {
    statusEl.innerText = "중장기 계획 필요";
    statusEl.className =
      "text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600";
  }

  document.getElementById("prop-img").src = data.img;
  document.getElementById("prop-name").innerText = data.name;
  document.getElementById("prop-price").innerText = `매매 ${data.price}`;

  document.getElementById("shortfall").innerText =
    shortfall <= 0 ? "0원" : `${(shortfall / 100000000).toFixed(1)}억`;

  document.getElementById("monthly-save").innerText =
    `${formatNumber(Math.floor(monthlySave / 10000))}만원`;

  document.getElementById("target-period").innerText =
    shortfall <= 0
      ? "지금 바로"
      : monthlySave <= 0
        ? "저축 설정 필요"
        : `${years}년 ${months}개월 뒤`;

  document.getElementById("prop-tip").innerText =
    shortfall <= 0
      ? "보유 자산으로 즉시 매수가 가능한 안정권입니다!"
      : `매달 ${(monthlySave / 10000 + 50).toFixed(0)}만원을 저축하면 기간을 더 단축할 수 있어요.`;

  renderChart(data.price_raw, myAsset, monthlySave);
}

function renderChart(price, myAsset, monthlySave) {
  const ctx = document.getElementById("priceChart");
  if (chart) chart.destroy();

  const myGrowth = [
    myAsset,
    myAsset + monthlySave * 12,
    myAsset + monthlySave * 24,
    myAsset + monthlySave * 36,
    myAsset + monthlySave * 48,
  ];

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["현재", "1년 뒤", "2년 뒤", "3년 뒤", "4년 뒤"],
      datasets: [
        {
          label: "목표 매물가",
          data: [price, price * 1.02, price * 1.04, price * 1.06, price * 1.08],
          borderColor: "#e5e7eb",
          borderDash: [5, 5],
          fill: false,
        },
        {
          label: "나의 자산 성장",
          data: myGrowth,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { display: false }, x: { grid: { display: false } } },
    },
  });
}

const map = L.map("map", { zoomControl: false }).setView(
  [37.5665, 126.978],
  14,
);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

function renderMarkers() {
  if (window.markerLayer) map.removeLayer(window.markerLayer);
  window.markerLayer = L.layerGroup().addTo(map);
  const myAsset = (parseInt(assetInput.value) || 0) * 10000;

  propertyData.forEach((apt, index) => {
    const ratio = myAsset / apt.price_raw;
    const dynamicColor =
      ratio >= 1.0
        ? "bg-green-500"
        : ratio >= 0.7
          ? "bg-blue-600"
          : ratio >= 0.4
            ? "bg-orange-500"
            : "bg-gray-500";
    const priceShort = (apt.price_raw / 100000000).toFixed(1) + "억";

    const customIcon = L.divIcon({
      className: "custom-marker",
      html: `<div class="marker-label ${dynamicColor}">${priceShort}</div>`,
      iconSize: [60, 30],
      iconAnchor: [30, 15],
    });

    const marker = L.marker([apt.lat, apt.lng], { icon: customIcon });
    marker.on("click", () => {
      updateReport(index);
      map.flyTo([apt.lat, apt.lng], 14);
    });
    window.markerLayer.addLayer(marker);
  });
}

document.querySelector("button").addEventListener("click", (e) => {
  e.preventDefault();
  renderMarkers();
  updateReport(currentAptIndex);
});

window.onload = () => {
  renderMarkers();
  updateReport(0);
};

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

incomeInput.addEventListener("input", () => {
  const ratio = slider.value;
  const income = parseInt(incomeInput.value) || 0;
  const calculatedSave = Math.floor(income * (ratio / 100));

  if (saveAmountText) {
    saveAmountText.innerText = `월 ${formatNumber(calculatedSave)}만원`;
  }

  updateReport(currentAptIndex);
});
