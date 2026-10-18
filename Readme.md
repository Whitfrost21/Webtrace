# WebTrace

WebTrace is a browser-based privacy transparency and auditing tool designed to help users understand how websites interact with third-party services and access browser APIs. It collects browsing activity, analyzes third-party connections, and presents the findings through a dashboard with supporting evidence.

## Overview

WebTrace consists of three main components:

- **Browser Extension:** Collects network request information and detects selected browser API activity. It aggregates events by website, maintains browsing sessions, stores limited request evidence, and provides blocking functionality.
- **Go Analyzer:** Processes extension exports, identifies third-party services using a local registry, classifies domains, and associates detected services with supporting request evidence.
- **Dashboard:** Displays analyzed transparency reports, third-party connections, unclassified domains, browser API activity, and individual request evidence. It also supports report history and session-level inspection.

The project is designed to make collected browser activity easier to understand without treating every third-party connection or API call as evidence of malicious behavior.

## What it does

### Browser Activity Collection

- Monitors network requests across websites.
- Classifies requests as first-party, third-party, or unknown.
- Detects selected browser API activity, including storage, geolocation, cookies, media access, canvas operations, and WebRTC.
- Aggregates network requests and API observations to reduce storage overhead.
- Retains a limited number of individual events as supporting evidence.
- Stores browsing sessions using Chrome extension storage.
- Provides blocking functionality through the extension.

### Third-Party Analysis

- Identifies third-party services using a local service registry.
- Classifies domains according to their identification status.
- Preserves request evidence associated with identified third-party domains.
- Retains unclassified domains instead of assigning unsupported service identities.
- Validates exported data before analysis.

### Transparency Dashboard

- Summarizes sessions, websites, third-party domains, and API observations.
- Displays third-party connections with service information and identification status.
- Provides expandable request evidence, including destinations, timestamps, request methods, and resource types.
- Displays detected browser API activity by website.
- Supports filtering and searching report data.
- Provides session-level details alongside the combined report.
- Maintains a history of analyzed reports for later review.

### Extension and Analyzer Integration

WebTrace supports direct submission of collected extension data to the Go analyzer, removing the need for manual file transfer when using the integrated workflow. Manual JSON import remains available as an alternative.

## Technology sed

| Component | Technology |
|---|---|
| Browser Extension | TypeScript, Chrome Extension Manifest V3 |
| Dashboard | React, TypeScript, Vite |
| Analyzer | Go |
| Extension Storage | Chrome Storage API |
| Analysis Input | JSON |
| Service Identification | Local registry |

## Project Structure

```text
.
├── analyzer/
│   ├── cmd/
│   │   └── server/
│   ├── internal/
│   │   ├── analysis/
│   │   ├── registry/
│   │   └── report/
│   └── go.mod
├── dashboard/
│   ├── src/
│   ├── package.json
│   └── ...
├── src/
├── build.mjs
├── manifest.json
├── popup.html
├── in.html
├── package.json
├── tsconfig.json
└── README.md
```
## Install and build 

```
git clone https://github.com/Whitfrost21/Webtrace.git
cd WebTrace

npm install
npm --prefix dashboard install

cd analyzer
go mod tidy
cd ..

npm run build
npm run dev
```
load the extension in your browser from load unpacked option in extensions.(choose the dist/ folder created after the build [npm run build]).

