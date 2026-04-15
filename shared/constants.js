/**
 * Ad network pattern definitions grouped by category.
 * Each entry contains a substring match pattern and metadata.
 */
export const AD_NETWORK_CATEGORIES = Object.freeze({
  advertising: {
    label: "Advertising",
    color: "#e74c3c",
    patterns: [
      { match: "googleads", name: "Google Ads" },
      { match: "doubleclick", name: "DoubleClick (Google)" },
      { match: "googlesyndication", name: "Google AdSense" },
      { match: "googleadservices", name: "Google Ad Services" },
      { match: "amazon-adsystem", name: "Amazon Ads" },
      { match: "adnxs", name: "Xandr (AppNexus)" },
      { match: "adsrvr.org", name: "The Trade Desk" },
      { match: "rubiconproject", name: "Magnite (Rubicon)" },
      { match: "pubmatic", name: "PubMatic" },
      { match: "openx.net", name: "OpenX" },
      { match: "criteo", name: "Criteo" },
      { match: "taboola", name: "Taboola" },
      { match: "outbrain", name: "Outbrain" },
      { match: "moatads", name: "Moat (Oracle)" },
      { match: "casalemedia", name: "Index Exchange" },
      { match: "bidswitch", name: "BidSwitch" },
      { match: "sharethrough", name: "Sharethrough" },
      { match: "33across", name: "33Across" },
      { match: "media.net", name: "Media.net" },
      { match: "smartadserver", name: "Equativ (Smart)" },
      { match: "prebid", name: "Prebid" },
    ],
  },
  tracking: {
    label: "Tracking & Analytics",
    color: "#f39c12",
    patterns: [
      { match: "google-analytics", name: "Google Analytics" },
      { match: "googletagmanager", name: "Google Tag Manager" },
      { match: "facebook.com/tr", name: "Meta Pixel" },
      { match: "connect.facebook", name: "Meta Connect" },
      { match: "analytics.tiktok", name: "TikTok Analytics" },
      { match: "snap.licdn", name: "LinkedIn Insight" },
      { match: "bat.bing", name: "Bing UET" },
      { match: "hotjar", name: "Hotjar" },
      { match: "clarity.ms", name: "Microsoft Clarity" },
      { match: "segment.io", name: "Segment" },
      { match: "segment.com", name: "Segment" },
      { match: "mixpanel", name: "Mixpanel" },
      { match: "amplitude", name: "Amplitude" },
      { match: "heapanalytics", name: "Heap" },
      { match: "fullstory", name: "FullStory" },
    ],
  },
  pixel: {
    label: "Pixels & Beacons",
    color: "#9b59b6",
    patterns: [
      { match: "pixel", name: "Tracking Pixel" },
      { match: "beacon", name: "Beacon" },
      { match: "impression", name: "Impression Tracker" },
      { match: "adserver", name: "Ad Server Call" },
      { match: "pagead", name: "Page Ad Tracker" },
    ],
  },
  social: {
    label: "Social Widgets",
    color: "#3498db",
    patterns: [
      { match: "platform.twitter", name: "X (Twitter) Platform" },
      { match: "platform.linkedin", name: "LinkedIn Platform" },
      { match: "connect.facebook.net", name: "Facebook SDK" },
      { match: "platform.instagram", name: "Instagram Embed" },
    ],
  },
});

/**
 * Flat lookup array built once for fast matching in the hot path.
 * Each entry: { match, name, category, categoryLabel, color }
 */
export const AD_PATTERNS_FLAT = Object.freeze(
  Object.entries(AD_NETWORK_CATEGORIES).flatMap(
    ([category, { label, color, patterns }]) =>
      patterns.map((pattern) => ({
        ...pattern,
        category,
        categoryLabel: label,
        color,
      }))
  )
);

/**
 * Message types used between background ↔ popup communication.
 */
export const MESSAGE_TYPES = Object.freeze({
  AD_DETECTED: "AD_DETECTED",
  GET_REQUESTS: "GET_REQUESTS",
  GET_STATS: "GET_STATS",
  CLEAR_DATA: "CLEAR_DATA",
  EXPORT_DATA: "EXPORT_DATA",
  TOGGLE_MONITORING: "TOGGLE_MONITORING",
});

/**
 * Storage keys for chrome.storage.local.
 */
export const STORAGE_KEYS = Object.freeze({
  MONITORING_ENABLED: "monitoringEnabled",
  REQUESTS_PREFIX: "requests_tab_",
});

/**
 * Limits and configuration constants.
 */
export const CONFIG = Object.freeze({
  MAX_REQUESTS_PER_TAB: 500,
  BADGE_UPDATE_DEBOUNCE_MS: 100,
  EXPORT_FILENAME_PREFIX: "ad-network-report",
});
