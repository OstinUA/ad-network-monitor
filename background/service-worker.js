import { MESSAGE_TYPES, CONFIG, STORAGE_KEYS } from "../shared/constants.js";
import {
  classifyRequest,
  buildRequestRecord,
} from "../shared/utils.js";

/* ──────────────────────────────────────────────
   State – per-tab request buffers + monitoring flag
   ────────────────────────────────────────────── */

/** @type {Map<number, object[]>} tabId → array of request records */
const tabRequests = new Map();

/** @type {Map<number, number>} tabId → ad request count for badge */
const tabCounts = new Map();

let monitoringEnabled = true;

/* ──────────────────────────────────────────────
   Initialisation
   ────────────────────────────────────────────── */

chrome.storage.local.get(STORAGE_KEYS.MONITORING_ENABLED, (result) => {
  if (result[STORAGE_KEYS.MONITORING_ENABLED] === false) {
    monitoringEnabled = false;
  }
});

/* ──────────────────────────────────────────────
   Badge helper (debounced per tab)
   ────────────────────────────────────────────── */

const pendingBadgeUpdates = new Map();

function scheduleBadgeUpdate(tabId) {
  if (pendingBadgeUpdates.has(tabId)) return;
  pendingBadgeUpdates.set(
    tabId,
    setTimeout(() => {
      pendingBadgeUpdates.delete(tabId);
      const count = tabCounts.get(tabId) || 0;
      const text = count > 0 ? (count > 999 ? "999+" : String(count)) : "";
      chrome.action.setBadgeText({ text, tabId }).catch(() => {});
      chrome.action.setBadgeBackgroundColor({ color: "#3498db", tabId }).catch(() => {});
    }, CONFIG.BADGE_UPDATE_DEBOUNCE_MS)
  );
}

/* ──────────────────────────────────────────────
   Core: intercept network requests
   ────────────────────────────────────────────── */

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!monitoringEnabled) return;

    const tabId = details.tabId;
    if (tabId < 0) return; // ignore non-tab requests (e.g. service workers)

    const classification = classifyRequest(details.url);
    if (!classification) return;

    const record = buildRequestRecord(details, classification);

    // Append to tab buffer, enforce cap
    if (!tabRequests.has(tabId)) tabRequests.set(tabId, []);
    const buffer = tabRequests.get(tabId);
    buffer.push(record);
    if (buffer.length > CONFIG.MAX_REQUESTS_PER_TAB) {
      buffer.splice(0, buffer.length - CONFIG.MAX_REQUESTS_PER_TAB);
    }

    // Update badge count
    tabCounts.set(tabId, (tabCounts.get(tabId) || 0) + 1);
    scheduleBadgeUpdate(tabId);

    // Notify popup (fire-and-forget; popup may not be open)
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.AD_DETECTED,
      record,
      tabId,
    }).catch(() => {});
  },
  { urls: ["<all_urls>"] }
);

/* ──────────────────────────────────────────────
   Tab lifecycle – reset counters on navigation
   ────────────────────────────────────────────── */

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabRequests.delete(tabId);
    tabCounts.delete(tabId);
    chrome.action.setBadgeText({ text: "", tabId }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabRequests.delete(tabId);
  tabCounts.delete(tabId);
  const timer = pendingBadgeUpdates.get(tabId);
  if (timer) {
    clearTimeout(timer);
    pendingBadgeUpdates.delete(tabId);
  }
});

/* ──────────────────────────────────────────────
   Message API – popup ↔ background
   ────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE_TYPES.GET_REQUESTS: {
      const tabId = message.tabId;
      const requests = tabRequests.get(tabId) || [];
      sendResponse({ success: true, requests });
      break;
    }

    case MESSAGE_TYPES.GET_STATS: {
      const tabId = message.tabId;
      const requests = tabRequests.get(tabId) || [];
      const stats = computeStats(requests);
      sendResponse({ success: true, stats });
      break;
    }

    case MESSAGE_TYPES.CLEAR_DATA: {
      const tabId = message.tabId;
      tabRequests.delete(tabId);
      tabCounts.delete(tabId);
      chrome.action.setBadgeText({ text: "", tabId }).catch(() => {});
      sendResponse({ success: true });
      break;
    }

    case MESSAGE_TYPES.EXPORT_DATA: {
      const tabId = message.tabId;
      const requests = tabRequests.get(tabId) || [];
      sendResponse({ success: true, requests });
      break;
    }

    case MESSAGE_TYPES.TOGGLE_MONITORING: {
      monitoringEnabled = !!message.enabled;
      chrome.storage.local.set({
        [STORAGE_KEYS.MONITORING_ENABLED]: monitoringEnabled,
      });
      sendResponse({ success: true, enabled: monitoringEnabled });
      break;
    }

    default:
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true; // keep channel open for async sendResponse
});

/* ──────────────────────────────────────────────
   Stats computation
   ────────────────────────────────────────────── */

function computeStats(requests) {
  const byCategory = {};
  const byNetwork = {};

  for (const req of requests) {
    byCategory[req.category] = (byCategory[req.category] || 0) + 1;
    byNetwork[req.networkName] = (byNetwork[req.networkName] || 0) + 1;
  }

  const topNetworks = Object.entries(byNetwork)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    total: requests.length,
    byCategory,
    topNetworks,
  };
}
