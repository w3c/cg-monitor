# W3C Community Groups Activity Monitor

[![Tests](https://github.com/w3c/cg-monitor/actions/workflows/test.yml/badge.svg)](https://github.com/w3c/cg-monitor/actions/workflows/test.yml)

This tool collects activity data from W3C Community Groups, pulling from the W3C API, GitHub repositories, mailing list archives, RSS feeds, and wikis. It processes the raw data into reports and charts, powering the [CG Activity Dashboard](https://w3c.github.io/cg-monitor/).

## Prerequisites

- **Node.js 20.x** 
- A GitHub [personal access token](https://github.com/settings/tokens) (no special scopes required, only used for higher API rate limits)

## Setup

```bash
npm install
cp config.json.dist config.json
# Edit config.json and add your GitHub token:
# { "ghapitoken": "ghp_xxxxxxxxxxxx" }
```

## Usage

### Collect group activity data

```bash
node monitor.js
```

This fetches data from all sources. It writes one JSON file per group into `data/`.

To update only specific groups, pass their W3C API IDs:

```bash
node monitor.js 12345 67890
```

### Process the collected data

```bash
node prepare-data.js        # builds report.json for the dashboard
node export-popularity.js   # computes group popularity rankings
node generate-activity-graphs.js  # generates SVG charts in viz/
```
