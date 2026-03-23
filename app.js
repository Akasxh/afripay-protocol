// AfriPay Frontend -- Multi-View Tabbed Application
// In production, this would connect to deployed contracts via ethers.js

const COUNTRIES = {
  NG: "Nigeria", ZA: "South Africa", KE: "Kenya", GH: "Ghana",
  EG: "Egypt", ET: "Ethiopia", UG: "Uganda", TZ: "Tanzania",
  ZW: "Zimbabwe", SN: "Senegal", RW: "Rwanda",
};

const CORRIDORS = {
  "NG-KE": 0.40, "NG-GH": 0.35, "ZA-ZW": 0.45, "KE-UG": 0.30,
  "KE-TZ": 0.30, "ZA-KE": 0.50, "NG-SN": 0.50, "GH-NG": 0.35,
};

const AGENTS = [
  { name: "Amara's Exchange", country: "KE", location: "Nairobi CBD", orders: 142, rating: 4.9 },
  { name: "ChiChi Mobile Money", country: "NG", location: "Lagos, Ikeja", orders: 98, rating: 4.8 },
  { name: "Ubuntu Pay", country: "ZA", location: "Johannesburg, Sandton", orders: 76, rating: 4.7 },
  { name: "Kwame Financial", country: "GH", location: "Accra, Osu", orders: 54, rating: 4.8 },
  { name: "SafariCash", country: "KE", location: "Mombasa, Old Town", orders: 43, rating: 4.6 },
  { name: "Kampala Express", country: "UG", location: "Kampala Central", orders: 31, rating: 4.5 },
  { name: "Table Mountain Pay", country: "ZA", location: "Cape Town, CBD", orders: 28, rating: 4.7 },
  { name: "Harare Quick Send", country: "ZW", location: "Harare, Avondale", orders: 22, rating: 4.4 },
  { name: "Dar Remit", country: "TZ", location: "Dar es Salaam, Kariakoo", orders: 19, rating: 4.5 },
  { name: "Kigali Connect", country: "RW", location: "Kigali, Kimihurura", orders: 15, rating: 4.6 },
  { name: "Dakar Transfer", country: "SN", location: "Dakar, Plateau", orders: 12, rating: 4.3 },
  { name: "Nile Express", country: "EG", location: "Cairo, Zamalek", orders: 18, rating: 4.5 },
];

// Simulated transaction history
const TRANSACTIONS = [
  { id: 1042, from: "NG", to: "KE", amount: 500, fee: 2.00, status: "completed", date: "2026-03-23" },
  { id: 1041, from: "ZA", to: "ZW", amount: 200, fee: 0.90, status: "completed", date: "2026-03-23" },
  { id: 1040, from: "KE", to: "UG", amount: 150, fee: 0.45, status: "claimed", date: "2026-03-22" },
  { id: 1039, from: "NG", to: "GH", amount: 1000, fee: 3.50, status: "completed", date: "2026-03-22" },
  { id: 1038, from: "GH", to: "NG", amount: 300, fee: 1.05, status: "pending", date: "2026-03-22" },
  { id: 1037, from: "ZA", to: "KE", amount: 750, fee: 3.75, status: "completed", date: "2026-03-21" },
  { id: 1036, from: "KE", to: "TZ", amount: 100, fee: 0.30, status: "completed", date: "2026-03-21" },
];

// Simulated analytics data
const CORRIDOR_VOLUMES = [
  { label: "NG \u2192 KE", volume: 84200 },
  { label: "ZA \u2192 ZW", volume: 52800 },
  { label: "KE \u2192 UG", volume: 41500 },
  { label: "NG \u2192 GH", volume: 38900 },
  { label: "KE \u2192 TZ", volume: 31200 },
  { label: "ZA \u2192 KE", volume: 22400 },
  { label: "NG \u2192 SN", volume: 8700 },
  { label: "GH \u2192 NG", volume: 4800 },
];

const MONTHLY_VOLUMES = [
  { label: "Oct 2025", volume: 28400 },
  { label: "Nov 2025", volume: 35200 },
  { label: "Dec 2025", volume: 42100 },
  { label: "Jan 2026", volume: 51800 },
  { label: "Feb 2026", volume: 58700 },
  { label: "Mar 2026", volume: 68300 },
];

const ORDER_STATUS = { completed: 892, claimed: 108, pending: 42 };

// Protocol stats (simulated cumulative)
let protocolStats = {
  totalVolume: 284500,
  totalOrders: 1042,
  totalFeesSaved: 22760,
};

// Leaderboard state
let leaderboardSort = { key: "orders", asc: false };
let leaderboardFilter = "";

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  updateStats();
  renderAgentList();
  renderTransactions();
  setupForm();
  updateFeeComparison();
  setupTabs();
  setupLeaderboard();
  renderLeaderboard();
  renderAnalytics();
  animateImpactMetrics();
});

// ===================== TAB NAVIGATION =====================

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Handle initial hash
  const hash = window.location.hash.replace("#", "") || "dashboard";
  switchTab(hash, false);

  // Handle back/forward navigation
  window.addEventListener("hashchange", () => {
    const newHash = window.location.hash.replace("#", "") || "dashboard";
    switchTab(newHash, false);
  });
}

function switchTab(tabId, updateHash) {
  if (updateHash === undefined) updateHash = true;
  const validTabs = ["dashboard", "agents", "analytics", "how-it-works"];
  if (!validTabs.includes(tabId)) {
    tabId = "dashboard";
  }

  // Update buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Update views with fade transition
  document.querySelectorAll(".tab-view").forEach((view) => {
    const isTarget = view.id === "view-" + tabId;
    if (isTarget) {
      view.style.display = "block";
      // Trigger reflow for fade animation
      void view.offsetWidth;
      view.classList.add("active");
    } else {
      view.classList.remove("active");
      view.style.display = "none";
    }
  });

  // Update URL hash
  if (updateHash) {
    history.pushState(null, "", "#" + tabId);
  }

  // Re-render analytics charts when switching to that tab (for animations)
  if (tabId === "analytics") {
    renderAnalytics();
  }
}

// ===================== STATS =====================

function updateStats() {
  document.getElementById("stat-volume").textContent = formatCurrency(protocolStats.totalVolume);
  document.getElementById("stat-orders").textContent = protocolStats.totalOrders.toLocaleString();
  document.getElementById("stat-saved").textContent = formatCurrency(protocolStats.totalFeesSaved);
}

function formatCurrency(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

// --- Sanitize text for safe DOM insertion ---
function escapeText(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.textContent;
}

// ===================== FEE COMPARISON =====================

function getAfriPayFee(from, to) {
  const corridor = from + "-" + to;
  return CORRIDORS[corridor] || 0.50;
}

function updateFeeComparison() {
  const amount = parseFloat(document.getElementById("amount").value) || 200;
  const from = document.getElementById("from-country").value;
  const to = document.getElementById("to-country").value;

  const afriFeeRate = getAfriPayFee(from, to);
  const afriFee = (amount * afriFeeRate) / 100;
  const wuFee = amount * 0.079;
  const bankFee = amount * 0.125;
  const savings = wuFee - afriFee;

  document.getElementById("compare-amount").textContent = amount.toFixed(0);
  document.getElementById("afripay-fee").textContent = afriFee.toFixed(2);
  document.getElementById("wu-fee").textContent = wuFee.toFixed(2);
  document.getElementById("bank-fee").textContent = bankFee.toFixed(2);
  document.getElementById("savings").textContent = savings.toFixed(2);
}

// ===================== AGENT LIST (Dashboard quick view) =====================

function renderAgentList() {
  const container = document.getElementById("agent-list");
  const toCountry = document.getElementById("to-country").value;

  const sorted = [...AGENTS].sort((a, b) => {
    if (a.country === toCountry && b.country !== toCountry) return -1;
    if (b.country === toCountry && a.country !== toCountry) return 1;
    return b.orders - a.orders;
  });

  container.replaceChildren();
  sorted.slice(0, 4).forEach((agent) => {
    const item = document.createElement("div");
    item.className = "agent-item";

    const info = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "agent-name";
    nameEl.textContent = agent.name;
    const locEl = document.createElement("div");
    locEl.className = "agent-location";
    locEl.textContent = agent.location + " \u2022 " + agent.orders + " orders";
    info.appendChild(nameEl);
    info.appendChild(locEl);

    const badge = document.createElement("span");
    badge.className = "agent-badge";
    badge.textContent = COUNTRIES[agent.country];

    item.appendChild(info);
    item.appendChild(badge);
    container.appendChild(item);
  });

  applyStagger(container, ".agent-item");
}

// ===================== TRANSACTION HISTORY =====================

function renderTransactions() {
  const tbody = document.getElementById("tx-body");
  tbody.replaceChildren();

  TRANSACTIONS.forEach((tx) => {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = "#" + tx.id;
    tr.appendChild(tdId);

    const tdCorridor = document.createElement("td");
    tdCorridor.textContent = COUNTRIES[tx.from] + " \u2192 " + COUNTRIES[tx.to];
    tr.appendChild(tdCorridor);

    const tdAmount = document.createElement("td");
    tdAmount.textContent = "$" + tx.amount.toFixed(2);
    tr.appendChild(tdAmount);

    const tdFee = document.createElement("td");
    const feeText = "$" + tx.fee.toFixed(2);
    const feePercent = ((tx.fee / tx.amount) * 100).toFixed(1);
    tdFee.textContent = feeText + " ";
    const feeSpan = document.createElement("span");
    feeSpan.style.color = "var(--green)";
    feeSpan.style.fontSize = "12px";
    feeSpan.textContent = "(" + feePercent + "%)";
    tdFee.appendChild(feeSpan);
    tr.appendChild(tdFee);

    const tdStatus = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = "status-badge status-" + tx.status;
    statusBadge.textContent = tx.status;
    tdStatus.appendChild(statusBadge);
    tr.appendChild(tdStatus);

    const tdDate = document.createElement("td");
    tdDate.textContent = tx.date;
    tr.appendChild(tdDate);

    tbody.appendChild(tr);
  });

  applyStagger(tbody, "tr");
}

// ===================== FORM =====================

function setupForm() {
  const form = document.getElementById("remittance-form");
  const amountInput = document.getElementById("amount");
  const fromSelect = document.getElementById("from-country");
  const toSelect = document.getElementById("to-country");

  amountInput.addEventListener("input", updateFeeComparison);
  fromSelect.addEventListener("change", () => { updateFeeComparison(); renderAgentList(); });
  toSelect.addEventListener("change", () => { updateFeeComparison(); renderAgentList(); });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    const from = fromSelect.value;
    const to = toSelect.value;
    const recipient = document.getElementById("recipient").value;

    if (!amount || amount <= 0) {
      showToast("Please enter a valid amount");
      return;
    }
    if (!recipient) {
      showToast("Please enter recipient details");
      return;
    }
    if (from === to) {
      showToast("Sender and recipient countries must differ");
      return;
    }

    const feeRate = getAfriPayFee(from, to);
    const fee = (amount * feeRate) / 100;

    const newTx = {
      id: protocolStats.totalOrders + 1,
      from, to, amount, fee,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
    };
    TRANSACTIONS.unshift(newTx);

    protocolStats.totalOrders++;
    protocolStats.totalVolume += amount;
    protocolStats.totalFeesSaved += (amount * 0.079) - fee;

    updateStats();
    renderTransactions();

    showToast("Remittance of $" + amount.toFixed(2) + " sent! Fee: $" + fee.toFixed(2) + " (" + feeRate + "%)");

    amountInput.value = "";
    document.getElementById("recipient").value = "";
  });
}

// ===================== AGENT LEADERBOARD =====================

function setupLeaderboard() {
  // Search filter
  const searchInput = document.getElementById("agent-search");
  searchInput.addEventListener("input", () => {
    leaderboardFilter = searchInput.value.trim().toLowerCase();
    renderLeaderboard();
  });

  // Sortable column headers
  document.querySelectorAll(".sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const sortKey = th.dataset.sort;
      if (leaderboardSort.key === sortKey) {
        leaderboardSort.asc = !leaderboardSort.asc;
      } else {
        leaderboardSort.key = sortKey;
        leaderboardSort.asc = false;
      }
      updateSortArrows();
      renderLeaderboard();
    });
  });
}

function updateSortArrows() {
  document.querySelectorAll(".sortable").forEach((th) => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.sort === leaderboardSort.key) {
      arrow.textContent = leaderboardSort.asc ? "\u25B2" : "\u25BC";
    } else {
      arrow.textContent = "";
    }
  });
}

function buildStarElements(rating) {
  const container = document.createElement("span");
  container.className = "star-display";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  for (let i = 0; i < 5; i++) {
    if (i < full || (i === full && half)) {
      const star = document.createTextNode("\u2605");
      container.appendChild(star);
    } else {
      const emptyStar = document.createElement("span");
      emptyStar.className = "star-empty";
      emptyStar.textContent = "\u2605";
      container.appendChild(emptyStar);
    }
  }
  return container;
}

function renderLeaderboard() {
  const tbody = document.getElementById("leaderboard-body");
  tbody.replaceChildren();

  let filtered = [...AGENTS];

  // Apply country filter
  if (leaderboardFilter) {
    filtered = filtered.filter((agent) => {
      const countryName = (COUNTRIES[agent.country] || "").toLowerCase();
      return countryName.includes(leaderboardFilter) || agent.country.toLowerCase().includes(leaderboardFilter);
    });
  }

  // Sort
  filtered.sort((a, b) => {
    const valA = a[leaderboardSort.key];
    const valB = b[leaderboardSort.key];
    const diff = valB - valA;
    return leaderboardSort.asc ? -diff : diff;
  });

  filtered.forEach((agent, idx) => {
    const tr = document.createElement("tr");

    const tdRank = document.createElement("td");
    tdRank.style.fontWeight = "700";
    tdRank.textContent = "#" + (idx + 1);
    tr.appendChild(tdRank);

    const tdName = document.createElement("td");
    tdName.style.fontWeight = "600";
    tdName.textContent = agent.name;
    tr.appendChild(tdName);

    const tdCountry = document.createElement("td");
    const countryBadge = document.createElement("span");
    countryBadge.className = "agent-badge";
    countryBadge.textContent = COUNTRIES[agent.country];
    tdCountry.appendChild(countryBadge);
    tr.appendChild(tdCountry);

    const tdLocation = document.createElement("td");
    tdLocation.style.color = "var(--text-secondary)";
    tdLocation.textContent = agent.location;
    tr.appendChild(tdLocation);

    const tdOrders = document.createElement("td");
    tdOrders.style.fontWeight = "700";
    tdOrders.textContent = agent.orders;
    tr.appendChild(tdOrders);

    const tdRating = document.createElement("td");
    const starContainer = buildStarElements(agent.rating);
    tdRating.appendChild(starContainer);
    const ratingNum = document.createElement("span");
    ratingNum.style.marginLeft = "6px";
    ratingNum.style.fontSize = "13px";
    ratingNum.style.fontWeight = "600";
    ratingNum.textContent = agent.rating.toFixed(1);
    tdRating.appendChild(ratingNum);
    tr.appendChild(tdRating);

    const tdStatus = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = "status-badge status-completed";
    statusBadge.textContent = agent.orders >= 50 ? "Verified" : "Active";
    tdStatus.appendChild(statusBadge);
    tr.appendChild(tdStatus);

    tbody.appendChild(tr);
  });

  applyStagger(tbody, "tr");
}

// ===================== ANALYTICS =====================

function renderAnalytics() {
  renderCorridorChart();
  renderMonthlyChart();
  renderStatusChart();
  renderSavingsBreakdown();
  updateAnalyticsStats();
}

function updateAnalyticsStats() {
  const volumeEl = document.getElementById("analytics-volume");
  const ordersEl = document.getElementById("analytics-orders");
  const savedEl = document.getElementById("analytics-saved");

  volumeEl.textContent = formatCurrency(protocolStats.totalVolume);
  ordersEl.textContent = protocolStats.totalOrders.toLocaleString();

  // Animated counter for fees saved
  animateCounter(savedEl, protocolStats.totalFeesSaved);
}

function animateCounter(element, target) {
  const duration = 1200;
  const startTime = performance.now();
  const startVal = 0;

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (target - startVal) * eased;
    element.textContent = formatCurrency(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

function renderCorridorChart() {
  const container = document.getElementById("corridor-chart");
  container.replaceChildren();

  const maxVolume = Math.max(...CORRIDOR_VOLUMES.map((c) => c.volume));

  CORRIDOR_VOLUMES.forEach((corridor) => {
    const row = document.createElement("div");
    row.className = "bar-chart-row";

    const label = document.createElement("div");
    label.className = "bar-chart-label";
    label.textContent = corridor.label;

    const track = document.createElement("div");
    track.className = "bar-chart-track";

    const fill = document.createElement("div");
    fill.className = "bar-chart-fill";
    fill.style.width = "0%";
    // Animate after a brief delay
    setTimeout(() => {
      fill.style.width = ((corridor.volume / maxVolume) * 100).toFixed(1) + "%";
    }, 50);

    track.appendChild(fill);

    const value = document.createElement("div");
    value.className = "bar-chart-value";
    value.textContent = formatCurrency(corridor.volume);

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}

function renderMonthlyChart() {
  const container = document.getElementById("monthly-chart");
  container.replaceChildren();

  const maxVolume = Math.max(...MONTHLY_VOLUMES.map((m) => m.volume));

  MONTHLY_VOLUMES.forEach((month) => {
    const row = document.createElement("div");
    row.className = "bar-chart-row";

    const label = document.createElement("div");
    label.className = "bar-chart-label";
    label.textContent = month.label;

    const track = document.createElement("div");
    track.className = "bar-chart-track";

    const fill = document.createElement("div");
    fill.className = "bar-chart-fill gold";
    fill.style.width = "0%";
    setTimeout(() => {
      fill.style.width = ((month.volume / maxVolume) * 100).toFixed(1) + "%";
    }, 50);

    track.appendChild(fill);

    const value = document.createElement("div");
    value.className = "bar-chart-value";
    value.textContent = formatCurrency(month.volume);

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}

function renderStatusChart() {
  const container = document.getElementById("status-chart");
  container.replaceChildren();

  const total = ORDER_STATUS.completed + ORDER_STATUS.claimed + ORDER_STATUS.pending;
  const completedPct = ((ORDER_STATUS.completed / total) * 100).toFixed(1);
  const claimedPct = ((ORDER_STATUS.claimed / total) * 100).toFixed(1);
  const pendingPct = ((ORDER_STATUS.pending / total) * 100).toFixed(1);

  // Stacked bar
  const barContainer = document.createElement("div");
  barContainer.className = "status-bar-container";

  const track = document.createElement("div");
  track.className = "status-bar-track";

  const segments = [
    { cls: "completed", pct: completedPct, label: completedPct + "%" },
    { cls: "claimed", pct: claimedPct, label: claimedPct + "%" },
    { cls: "pending", pct: pendingPct, label: pendingPct + "%" },
  ];

  segments.forEach((seg) => {
    const el = document.createElement("div");
    el.className = "status-bar-segment " + seg.cls;
    el.style.width = seg.pct + "%";
    el.textContent = parseFloat(seg.pct) > 5 ? seg.label : "";
    track.appendChild(el);
  });

  barContainer.appendChild(track);
  container.appendChild(barContainer);

  // Legend
  const legend = document.createElement("div");
  legend.className = "status-legend";

  const legendData = [
    { cls: "completed", label: "Completed", count: ORDER_STATUS.completed },
    { cls: "claimed", label: "Claimed", count: ORDER_STATUS.claimed },
    { cls: "pending", label: "Pending", count: ORDER_STATUS.pending },
  ];

  legendData.forEach((item) => {
    const legendItem = document.createElement("div");
    legendItem.className = "status-legend-item";

    const dot = document.createElement("div");
    dot.className = "status-legend-dot " + item.cls;

    const text = document.createElement("span");
    text.textContent = item.label;

    const count = document.createElement("span");
    count.className = "status-count";
    count.textContent = "(" + item.count + ")";

    legendItem.appendChild(dot);
    legendItem.appendChild(text);
    legendItem.appendChild(count);
    legend.appendChild(legendItem);
  });

  container.appendChild(legend);
}

function renderSavingsBreakdown() {
  const container = document.getElementById("savings-breakdown");
  container.replaceChildren();

  // Big counter
  const counter = document.createElement("div");
  counter.className = "savings-counter";
  const counterValue = document.createElement("div");
  counterValue.className = "savings-counter-value";
  counterValue.id = "savings-animated-counter";
  counterValue.textContent = "$0";
  const counterLabel = document.createElement("div");
  counterLabel.className = "savings-counter-label";
  counterLabel.textContent = "Total fees saved vs traditional providers";
  counter.appendChild(counterValue);
  counter.appendChild(counterLabel);
  container.appendChild(counter);

  // Breakdown items
  const breakdownData = [
    { label: "vs Western Union (7.9%)", value: protocolStats.totalVolume * 0.079 - protocolStats.totalVolume * 0.005 },
    { label: "vs Bank Transfer (12.5%)", value: protocolStats.totalVolume * 0.125 - protocolStats.totalVolume * 0.005 },
    { label: "vs Mobile Money (6%)", value: protocolStats.totalVolume * 0.06 - protocolStats.totalVolume * 0.005 },
    { label: "Average per transaction", value: protocolStats.totalFeesSaved / protocolStats.totalOrders },
  ];

  breakdownData.forEach((item) => {
    const row = document.createElement("div");
    row.className = "savings-item";

    const label = document.createElement("div");
    label.className = "savings-item-label";
    label.textContent = item.label;

    const value = document.createElement("div");
    value.className = "savings-item-value";
    value.textContent = formatCurrency(item.value);

    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  });

  // Animate the counter
  animateCounter(counterValue, protocolStats.totalFeesSaved);
}

// ===================== COUNT-UP ANIMATION =====================

function animateImpactMetrics() {
  const metrics = [
    { selector: ".grid-4 .impact-card:nth-child(1) .impact-value", target: 48, prefix: "$", suffix: "B", decimals: 0 },
    { selector: ".grid-4 .impact-card:nth-child(2) .impact-value", target: 8.9, prefix: "", suffix: "%", decimals: 1 },
    { selector: ".grid-4 .impact-card:nth-child(3) .impact-value", target: 0.5, prefix: "", suffix: "%", decimals: 1 },
    { selector: ".grid-4 .impact-card:nth-child(4) .impact-value", target: 4.3, prefix: "$", suffix: "B", decimals: 1 },
  ];

  // Only target impact cards inside the dashboard view
  const dashboard = document.getElementById("view-dashboard");
  if (!dashboard) return;

  metrics.forEach((m) => {
    const el = dashboard.querySelector(m.selector);
    if (!el) return;
    // Preserve classes
    const classes = el.className;
    animateNumberTo(el, m.target, m.prefix, m.suffix, m.decimals, classes);
  });

  // Header stats count-up
  animateStatTo("stat-volume", protocolStats.totalVolume, true);
  animateStatTo("stat-orders", protocolStats.totalOrders, false);
  animateStatTo("stat-saved", protocolStats.totalFeesSaved, true);
}

function animateNumberTo(el, target, prefix, suffix, decimals, classes) {
  const duration = 1000;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    el.textContent = prefix + current.toFixed(decimals) + suffix;
    el.className = classes;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function animateStatTo(id, target, isCurrency) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1000;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    el.textContent = isCurrency ? formatCurrency(current) : Math.round(current).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ===================== STAGGERED FADE-IN UTILITY =====================

function applyStagger(parentEl, selector) {
  const items = parentEl.querySelectorAll(selector);
  items.forEach((item, i) => {
    item.classList.add("stagger-in");
    item.style.animationDelay = (i * 50) + "ms";
  });
}

// ===================== TOAST =====================

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}
