import { AD_PATTERNS_FLAT } from "./constants.js";

/**
 * Match a URL against all known ad network patterns.
 * Returns the first matching pattern object or null.
 *
 * @param {string} url - The request URL to classify.
 * @returns {object|null} Pattern metadata or null if no match.
 */
export function classifyRequest(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  const lowered = url.toLowerCase();
  for (const pattern of AD_PATTERNS_FLAT) {
    if (lowered.includes(pattern.match)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Format a timestamp (epoch ms) into a locale time string.
 *
 * @param {number} epochMs
 * @returns {string}
 */
export function formatTimestamp(epochMs) {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "--:--:--";
  try {
    return new Date(epochMs).toLocaleTimeString();
  } catch {
    return "--:--:--";
  }
}

/**
 * Truncate a URL for display purposes, keeping protocol + host + abbreviated path.
 *
 * @param {string} url
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateUrl(url, maxLength = 120) {
  if (typeof url !== "string") return "";
  if (url.length <= maxLength) return url;
  try {
    const parsed = new URL(url);
    const base = `${parsed.protocol}//${parsed.host}`;
    const remaining = maxLength - base.length - 3;
    if (remaining <= 0) return `${base}…`;
    return `${base}${parsed.pathname.slice(0, remaining)}…`;
  } catch {
    return `${url.slice(0, maxLength)}…`;
  }
}

/**
 * Extract the hostname from a URL string safely.
 *
 * @param {string} url
 * @returns {string}
 */
export function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Build a serialisable request record from raw webRequest details + classification.
 *
 * @param {object} details - chrome.webRequest callback details
 * @param {object} classification - result from classifyRequest()
 * @returns {object}
 */
export function buildRequestRecord(details, classification) {
  return {
    id: `${details.requestId}_${Date.now()}`,
    url: details.url,
    method: details.method || "GET",
    timestamp: details.timeStamp || Date.now(),
    type: details.type || "other",
    initiator: details.initiator || "",
    networkName: classification.name,
    category: classification.category,
    categoryLabel: classification.categoryLabel,
    color: classification.color,
  };
}
