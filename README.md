<div align="center">

<pre>
     _       _    _   _      _                      _       _                                
    / \   __| |  | \ | | ___| |___      _____  _ __| | __  | |    ___   __ _  __ _  ___ _ __ 
   / _ \ / _` |  |  \| |/ _ \ __\ \ /\ / / _ \| '__| |/ /  | |   / _ \ / _` |/ _` |/ _ \ '__|
  / ___ \ (_| |  | |\  |  __/ |_ \ V  V / (_) | |  |   <   | |__| (_) | (_| | (_| |  __/ |   
 /_/   \_\__,_|  |_| \_|\___|\__| \_/\_/ \___/|_|  |_|\_\  |_____\___/ \__, |\__, |\___|_|   
                                                                       |___/ |___/           
</pre>

</div>

Real-time browser-side logging and classification toolkit for ad, tracking, pixel, and social network requests.

[![Chrome Store](https://img.shields.io/badge/platform-Chrome_Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/search/OstinUA)
[![Chrome Portfolio](https://img.shields.io/badge/Chrome_Web_Store-Portfolio-34A853?style=for-the-badge&logo=google-chrome&logoColor=white)](https://ostinua.github.io/Chrome-Web-Store_Developer-List/)

[![Version](https://img.shields.io/badge/version-2.0.2-2ea44f?style=for-the-badge)](./manifest.json)
[![Manifest](https://img.shields.io/badge/chrome_manifest-v3-4285f4?style=for-the-badge)](./manifest.json)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge)](./LICENSE)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-f7df1e?style=for-the-badge&logo=javascript&logoColor=000)](.)

> [!NOTE]
> This project is implemented as a Chrome Extension (Manifest V3) and includes reusable logging/classification modules in `shared/` that can be treated as the core logging library layer.

## Table of Contents

- [Features](#features)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Usage](#usage)
- [Configuration](#configuration)
- [License](#license)
- [Contacts & Community Support](#contacts--community-support)

## Features

- High-frequency request interception using `chrome.webRequest.onBeforeRequest`.
- Pattern-based network classification across four categories:
  - `advertising`
  - `tracking`
  - `pixel`
  - `social`
- Hot-path optimized flat pattern registry (`AD_PATTERNS_FLAT`) for low-overhead matching.
- Per-tab in-memory ring-buffer-like request retention with hard cap control.
- Real-time popup updates via message bus (`chrome.runtime.sendMessage`).
- Debounced badge updates with overflow-safe formatting (`999+`).
- Lightweight in-popup analytics:
  - total events
  - events by category
  - top networks (computed in background service worker)
- JSON export for captured telemetry snapshots.
- Monitor pause/resume state persisted through `chrome.storage.local`.
- Defensive utility primitives for URL parsing, truncation, and timestamp formatting.

> [!IMPORTANT]
> Classification is substring-based (intentionally simple and performant). It is deterministic and transparent, but not a full DNS/eTLD+1 or signature-engine classifier.

## Tech Stack & Architecture

### Core Stack

- Language: `JavaScript (ES Modules)`
- Runtime: `Chrome Extension Manifest V3`
- Background execution model: `Service Worker`
- UI layer: `Vanilla HTML/CSS/JS`
- Browser APIs:
  - `chrome.webRequest`
  - `chrome.runtime`
  - `chrome.storage`
  - `chrome.tabs`
  - `chrome.action`

### Project Structure

<details>
<summary>Expand repository tree</summary>

```text
ad-network-monitor/
├── background/
│   └── service-worker.js
├── icons/
│   └── icon128.png
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── shared/
│   ├── constants.js
│   └── utils.js
├── LICENSE
├── manifest.json
└── README.md
```

</details>

### Key Design Decisions

- **Modular core logic**: Classification and record shaping live in `shared/`, enabling future reuse beyond the popup.
- **Per-tab state isolation**: Request buffers and counters are keyed by tab ID to avoid cross-tab data contamination.
- **Memory safety by configuration**: `MAX_REQUESTS_PER_TAB` provides a deterministic upper bound.
- **UI responsiveness**: Incremental prepend rendering + filter-aware updates reduce unnecessary repainting.
- **Operational resilience**: Message sends and badge updates are intentionally fire-and-forget with catch suppression when receivers are absent.

<details>
<summary>Data flow and component interaction (Mermaid)</summary>

```mermaid
flowchart LR
  A[Browser Network Request] --> B[service-worker onBeforeRequest]
  B --> C{monitoringEnabled?}
  C -- No --> Z[Ignore]
  C -- Yes --> D[classifyRequest(url)]
  D --> E{matched pattern?}
  E -- No --> Z
  E -- Yes --> F[buildRequestRecord]
  F --> G[tabRequests Map append]
  G --> H[tabCounts increment]
  H --> I[scheduleBadgeUpdate]
  G --> J[runtime.sendMessage AD_DETECTED]
  J --> K[popup.js live listener]
  K --> L[UI list + stats update]
  G --> M[GET_REQUESTS/GET_STATS/EXPORT/CLEAR handlers]
```

</details>

## Getting Started

### Prerequisites

- `Google Chrome` (or Chromium-based browser) with extension developer mode enabled.
- Minimum browser support aligned with `minimum_chrome_version: 110`.
- Optional (for local automation/linting):
  - `Node.js 18+`
  - `npm 9+`

### Installation

1. Clone the repository.

```bash
git clone https://github.com/<your-org>/ad-network-monitor.git
cd ad-network-monitor
```

2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository root.
5. Pin the extension and open the popup on any website.

> [!TIP]
> After pulling updates, use the **Reload** button on the extension card to refresh the service worker and popup assets.

<details>
<summary>Troubleshooting and alternative setup paths</summary>

### Common issues

- **No events captured**:
  - Ensure extension has host permissions (`http://*/*`, `https://*/*`).
  - Confirm monitoring is not paused in the popup UI.
  - Verify you are browsing a page that emits matching requests.

- **Popup shows stale data**:
  - Reload the extension from `chrome://extensions`.
  - Refresh the active tab to trigger fresh request capture.

- **Service worker seems inactive**:
  - Open the extension details page and inspect the service worker console for runtime errors.

### Building from source (optional)

No transpilation/build pipeline is required; this project runs from source as-is. If you introduce a build step, output must preserve Manifest V3 compatibility and ES module imports.

</details>

## Testing

This repository currently has no formal unit/integration test harness checked in. Recommended validation workflow:

```bash
# Syntax check core scripts (Node.js)
node --check background/service-worker.js
node --check shared/constants.js
node --check shared/utils.js
node --check popup/popup.js
```

Manual integration checklist:

1. Open a site with known ad/tracking calls.
2. Confirm rows stream into the popup in real time.
3. Toggle monitoring pause/resume and verify capture behavior changes instantly.
4. Switch filters and verify category-constrained rendering.
5. Export JSON and validate payload schema.
6. Navigate to a new page and verify per-tab reset behavior.

> [!CAUTION]
> `chrome.*` APIs are browser-context APIs and cannot be fully integration-tested with plain Node.js runtime checks alone.

## Deployment

### Production packaging

1. Ensure source files are finalized and extension version in `manifest.json` is incremented.
2. Zip the extension package contents.
3. Upload to Chrome Web Store (or internal extension distribution channel).

```bash
# Example packaging command (run at repo root)
zip -r ad-network-monitor.zip manifest.json background popup shared icons LICENSE README.md
```

### CI/CD guidance

- Add CI jobs for:
  - JavaScript syntax checks (`node --check`)
  - Optional static analysis (`eslint` when configured)
  - Packaging artifact creation (`zip`)
- Promote artifacts through environment gates (dev → staging → production listing).

<details>
<summary>Suggested GitHub Actions pipeline outline</summary>

- Trigger on pull requests and tagged releases.
- Validate syntax and lint quality gates.
- Generate immutable zip artifact named with semantic version.
- On release tag, push artifact to distribution storage and trigger store publication workflow.

</details>

## Usage

### Basic Usage

Once loaded in Chrome:

1. Visit any website.
2. Open extension popup.
3. Observe categorized request logs and live counters.
4. Export captured events as JSON.

### Programmatic Core Usage (library-style)

You can consume the shared modules as a lightweight logging/classification toolkit.

```js
import { classifyRequest, buildRequestRecord } from "./shared/utils.js";

// Raw request-like object (shape aligned with chrome.webRequest details)
const details = {
  requestId: "12345",
  url: "https://www.google-analytics.com/g/collect?v=2",
  method: "GET",
  timeStamp: Date.now(),
  type: "xmlhttprequest",
  initiator: "https://example.com"
};

const classification = classifyRequest(details.url);
if (classification) {
  const record = buildRequestRecord(details, classification);
  console.log("Detected network call:", record.networkName, record.category);
  // record now contains normalized logging fields for storage/export
}
```

<details>
<summary>Advanced Usage: extend classifiers with custom pattern packs</summary>

1. Add new category or patterns in `shared/constants.js` under `AD_NETWORK_CATEGORIES`.
2. Keep patterns lowercase to match the current lowercase URL normalization.
3. Prefer specific tokens before generic tokens to reduce accidental positive matches.
4. Validate with manual browsing sessions and exported payload analysis.

</details>

<details>
<summary>Custom formatters and edge-case handling</summary>

- Use `truncateUrl(url, maxLength)` to keep UI-safe rendering.
- Use `formatTimestamp(epochMs)` for resilient display values.
- Use `extractHostname(url)` where hostname-level grouping is needed.
- Handle unknown/invalid URLs defensively (helpers return fallback-safe values).

</details>

## Configuration

Runtime behavior is configured through constants and persisted state.

- `CONFIG.MAX_REQUESTS_PER_TAB` (default: `500`): max retained records per tab.
- `CONFIG.BADGE_UPDATE_DEBOUNCE_MS` (default: `100`): badge update debounce window.
- `CONFIG.EXPORT_FILENAME_PREFIX` (default: `ad-network-report`): JSON export filename prefix.
- `STORAGE_KEYS.MONITORING_ENABLED`: persisted boolean toggle for monitoring state.

> [!WARNING]
> No `.env`-driven runtime exists in the current implementation. Configuration is code-first (`shared/constants.js`) plus persisted browser storage keys.

<details>
<summary>Configuration reference table (complete)</summary>

| Key | Type | Default | Location | Purpose |
|---|---|---:|---|---|
| `CONFIG.MAX_REQUESTS_PER_TAB` | number | `500` | `shared/constants.js` | Bounds in-memory tab buffer and popup DOM growth. |
| `CONFIG.BADGE_UPDATE_DEBOUNCE_MS` | number | `100` | `shared/constants.js` | Debounces badge writes to reduce API churn. |
| `CONFIG.EXPORT_FILENAME_PREFIX` | string | `ad-network-report` | `shared/constants.js` | Prefix for exported JSON snapshots. |
| `STORAGE_KEYS.MONITORING_ENABLED` | string | `monitoringEnabled` | `shared/constants.js` | Storage key for pause/resume persistence. |
| `AD_NETWORK_CATEGORIES` | object | n/a | `shared/constants.js` | Canonical category/pattern map for classification. |
| `AD_PATTERNS_FLAT` | array | derived | `shared/constants.js` | Optimized flattened lookup for hot-path matching. |

</details>

## License

This project is distributed under the **GNU General Public License v3.0**.

See [`LICENSE`](./LICENSE) for full legal text.

## Contacts & Community Support

## Support the Project

[![Patreon](https://img.shields.io/badge/Patreon-OstinFCT-f96854?style=flat-square&logo=patreon)](https://www.patreon.com/OstinFCT)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-fctostin-29abe0?style=flat-square&logo=ko-fi)](https://ko-fi.com/fctostin)
[![Boosty](https://img.shields.io/badge/Boosty-Support-f15f2c?style=flat-square)](https://boosty.to/ostinfct)
[![YouTube](https://img.shields.io/badge/YouTube-FCT--Ostin-red?style=flat-square&logo=youtube)](https://www.youtube.com/@FCT-Ostin)
[![Telegram](https://img.shields.io/badge/Telegram-FCTostin-2ca5e0?style=flat-square&logo=telegram)](https://t.me/FCTostin)

If you find this tool useful, consider leaving a star on GitHub or supporting the author directly.
