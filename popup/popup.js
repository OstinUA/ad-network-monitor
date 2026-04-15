import { MESSAGE_TYPES, CONFIG, AD_NETWORK_CATEGORIES } from "../shared/constants.js";
import { formatTimestamp, truncateUrl } from "../shared/utils.js";

/* ═══════════════════════════════════════════════
   DOM references
   ═══════════════════════════════════════════════ */

const dom = {
  requestList: document.getElementById("request-list"),
  emptyState: document.getElementById("empty-state"),
  pageUrl: document.getElementById("page-url"),
  btnToggle: document.getElementById("btn-toggle"),
  btnClear: document.getElementById("btn-clear"),
  btnExport: document.getElementById("btn-export"),
  iconPause: document.getElementById("icon-pause"),
  iconPlay: document.getElementById("icon-play"),
  statTotal: document.getElementById("stat-total"),
  statAdvertising: document.getElementById("stat-advertising"),
  statTracking: document.getElementById("stat-tracking"),
  statPixel: document.getElementById("stat-pixel"),
  statSocial: document.getElementById("stat-social"),
  filters: document.querySelectorAll(".filter"),
};

/* ═══════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════ */

let activeTabId = null;
let monitoringEnabled = true;
let activeFilter = "all";

/** @type {object[]} Full request list for the current tab */
let allRequests = [];

/* ═══════════════════════════════════════════════
   Initialisation
   ═══════════════════════════════════════════════ */

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      activeTabId = tab.id;
      dom.pageUrl.textContent = truncateUrl(tab.url || "", 60);
    }
  } catch {
    dom.pageUrl.textContent = "";
  }

  // Load persisted monitoring state
  try {
    const stored = await chrome.storage.local.get("monitoringEnabled");
    if (stored.monitoringEnabled === false) {
      monitoringEnabled = false;
      reflectMonitoringState();
    }
  } catch { /* use default */ }

  // Fetch existing requests from background
  if (activeTabId !== null) {
    sendMessage({ type: MESSAGE_TYPES.GET_REQUESTS, tabId: activeTabId }, (response) => {
      if (response?.success && Array.isArray(response.requests)) {
        allRequests = response.requests;
        renderAll();
      }
    });
  }

  bindEvents();
}

/* ═══════════════════════════════════════════════
   Event binding
   ═══════════════════════════════════════════════ */

function bindEvents() {
  // Live updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MESSAGE_TYPES.AD_DETECTED && message.tabId === activeTabId) {
      allRequests.push(message.record);
      if (matchesFilter(message.record)) {
        prependRequestItem(message.record);
      }
      updateStats();
      hideEmptyState();
    }
  });

  // Filter tabs
  dom.filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.filters.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderRequestList();
    });
  });

  // Toggle monitoring
  dom.btnToggle.addEventListener("click", () => {
    monitoringEnabled = !monitoringEnabled;
    sendMessage({
      type: MESSAGE_TYPES.TOGGLE_MONITORING,
      enabled: monitoringEnabled,
    });
    reflectMonitoringState();
  });

  // Clear data
  dom.btnClear.addEventListener("click", () => {
    sendMessage({ type: MESSAGE_TYPES.CLEAR_DATA, tabId: activeTabId });
    allRequests = [];
    renderAll();
  });

  // Export
  dom.btnExport.addEventListener("click", exportData);
}

/* ═══════════════════════════════════════════════
   Rendering
   ═══════════════════════════════════════════════ */

function renderAll() {
  renderRequestList();
  updateStats();
}

function renderRequestList() {
  const filtered = activeFilter === "all"
    ? allRequests
    : allRequests.filter((r) => r.category === activeFilter);

  // Clear existing items but keep empty state node
  const items = dom.requestList.querySelectorAll(".request-item");
  items.forEach((el) => el.remove());

  if (filtered.length === 0) {
    showEmptyState();
    return;
  }

  hideEmptyState();

  // Render newest first, batch via fragment
  const fragment = document.createDocumentFragment();
  const reversed = [...filtered].reverse();
  for (const record of reversed) {
    fragment.appendChild(createRequestElement(record));
  }
  dom.requestList.appendChild(fragment);
}

function prependRequestItem(record) {
  const el = createRequestElement(record);
  const firstChild = dom.requestList.querySelector(".request-item");
  if (firstChild) {
    dom.requestList.insertBefore(el, firstChild);
  } else {
    dom.requestList.appendChild(el);
  }

  // Enforce visible cap to avoid DOM bloat
  const items = dom.requestList.querySelectorAll(".request-item");
  if (items.length > CONFIG.MAX_REQUESTS_PER_TAB) {
    items[items.length - 1].remove();
  }
}

function createRequestElement(record) {
  const el = document.createElement("div");
  el.className = "request-item";
  el.dataset.category = record.category;

  const methodClass = getMethodClass(record.method);

  el.innerHTML = `
    <div class="request-item__meta">
      <span class="request-item__category-dot" style="background:${escapeAttr(record.color)}"></span>
      <span class="request-item__network">${escapeHtml(record.networkName)}</span>
      <span class="request-item__method ${methodClass}">${escapeHtml(record.method)}</span>
      <span class="request-item__type">${escapeHtml(record.type)}</span>
      <span class="request-item__time">${escapeHtml(formatTimestamp(record.timestamp))}</span>
    </div>
    <div class="request-item__url" title="${escapeAttr(record.url)}">${escapeHtml(truncateUrl(record.url, 100))}</div>
  `;

  return el;
}

/* ═══════════════════════════════════════════════
   Stats
   ═══════════════════════════════════════════════ */

function updateStats() {
  const counts = { total: allRequests.length, advertising: 0, tracking: 0, pixel: 0, social: 0 };
  for (const r of allRequests) {
    if (r.category in counts) counts[r.category]++;
  }

  dom.statTotal.textContent = counts.total;
  dom.statAdvertising.textContent = counts.advertising;
  dom.statTracking.textContent = counts.tracking;
  dom.statPixel.textContent = counts.pixel;
  dom.statSocial.textContent = counts.social;
}

/* ═══════════════════════════════════════════════
   Export
   ═══════════════════════════════════════════════ */

function exportData() {
  if (allRequests.length === 0) return;

  const payload = {
    exportedAt: new Date().toISOString(),
    pageUrl: dom.pageUrl.textContent,
    totalRequests: allRequests.length,
    requests: allRequests,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${CONFIG.EXPORT_FILENAME_PREFIX}_${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════ */

function matchesFilter(record) {
  return activeFilter === "all" || record.category === activeFilter;
}

function reflectMonitoringState() {
  dom.iconPause.classList.toggle("hidden", !monitoringEnabled);
  dom.iconPlay.classList.toggle("hidden", monitoringEnabled);
  dom.btnToggle.classList.toggle("paused", !monitoringEnabled);
  dom.btnToggle.title = monitoringEnabled ? "Pause monitoring" : "Resume monitoring";
}

function showEmptyState() {
  dom.emptyState.classList.remove("hidden");
}

function hideEmptyState() {
  dom.emptyState.classList.add("hidden");
}

function getMethodClass(method) {
  switch ((method || "").toUpperCase()) {
    case "GET": return "request-item__method--get";
    case "POST": return "request-item__method--post";
    default: return "request-item__method--other";
  }
}

function sendMessage(msg, callback) {
  chrome.runtime.sendMessage(msg, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[popup] sendMessage error:", chrome.runtime.lastError.message);
    }
    if (typeof callback === "function") callback(response);
  });
}

/** Minimal XSS-safe escaping for HTML text content */
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Minimal escaping for HTML attribute values */
function escapeAttr(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ═══════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════ */

init();
