---
name: token-monitor
description: >-
  Open or guide the user to the Antigravity Token Monitor Aux Pane (`sidecar://agy-token-monitor/monitor_pane/`)
  to inspect live token generation speed (tok/s) scoped to the active model, 400k/500k context usage thresholds
  and one-click `/compact` helper, bilingual EN/ZH UI, selectable token units, session total token consumption
  and one-click session checkout receipt PNG export in Equivalent Cost, prompt cache hit rate, Top-5 recent-active
  subagent/swarm folding and aggregation, daily official model/pricing/FX auto-sync, in-panel multi-channel
  release check & SHA-256 CDN hot update, automatic OS/env HTTP(S) proxy sync & connection pool auto-rebuild, subscription ROI, and
  SQLite fork-deduplicated multi-period (today / 7d / 30d / all-time) usage history. Use whenever the user asks
  to monitor token speed, check context usage or `/compact` timing, inspect cache hit rate or context spikes,
  check session total tokens, export or copy a session checkout receipt, switch token units or language, sync or
  customize model pricing, check or install plugin updates, compare token cost vs subscription price, or open
  the Token Monitor panel.
---

# Token Monitor (v0.3.0 Beta)

The `agy-token-monitor` plugin provides a real-time, pure read-only Auxiliary Pane (`Token Monitor`) backed by the `monitor_pane` sidecar.

## What Token Monitor Tracks

- **Live Speed & Status (`tok/s`)**: Current generation state (`GENERATING` 100ms stopwatch, `RUNNING_TOOLS` progress, or `IDLE`), active model timeline, latest `tok/s`, weighted average, peak speed, and recent 20-step sparkline — computed using SQLite `completedAtMs` timestamps (avoiding streaming timestamp spikes) and scoped to the active model.
- **Context Usage Monitor (`400k / 500k`) & One-Click `/compact`**: Active conversation context (`input_tokens + cache_read_tokens`) compared against configurable defaults: **`400k` (80% `WARNING`) alert threshold** and **`500k` max window** (`460k` / 92% `CRITICAL`). Includes a one-click **`/compact`** helper button in the context header that copies `/compact` to the clipboard (and focuses a non-bound session chat if inspected) so the user can compress context immediately.
- **Bilingual UI (`EN / 中`) & Selectable Token Units**: Header `EN / 中` toggle next to Settings switches the full interface immediately between English and Simplified Chinese; 4 selectable token display units (`K/M/B` auto-scale, `万/亿`, exact integer `1,234,567`, and fixed `M`) are available in both the Analytics header and Settings drawer, with zero-layout-shift slot-roll transitions on live metric updates (per-digit rolling for matching lengths, whole-value swaps on unit or length changes, per-card DOM memoization, and `prefers-reduced-motion` support).
- **Session Total Tokens, Equivalent Cost & Sortable Breakdowns**: Tab 1's Equivalent Cost card displays session `Total Tokens` (`总 Token 消耗`, computed from uncached input + cache read + output tokens, scoped dynamically to `With Subagents` / `Main Only` and formatted with the selected `tokenUnit`) alongside step count, and Tab 2 conversation rows also display per-session `Total` tokens. All model breakdown tables support clickable `Total` and `Cost` ascending/descending column sorting.
- **One-Click Session Checkout Receipt (`🧾 结账 / 收工票根`)**: Equivalent Cost's hero row includes a one-click **`🧾 Checkout` / `🧾 结账`** button (`receipt.js` high-DPI `3x` Canvas thermal receipt renderer) to preview, copy to clipboard, or save a `PNG` **Session Receipt (`收工票根`)** with **`Today / All-Time`** (`今日收工 / 全程累计`) scope and **`Compact / Full`** (`精简 / 完整`) detail switches, merged active session duration, date/time span, primary model, subagent & compaction counts, itemized Main + Subagent token/cost rows, and adaptive `EN / ZH` language & `USD / CNY` currency formatting.
- **Prompt Cache & Spike Diagnostics**: Latest cache hit rate (`%`), uncached input, net token delta, and top 5 positive context jumps (`topSpikes`) with triggering tool summaries.
- **Subagent & Swarm Aggregation & Top-5 Recent-Active Folding**: Aggregates token usage and cost across child subagents and swarm workers (`With Subagents` vs `Main Only`) on main conversations while keeping context size isolated; when inspecting an individual subagent or swarm worker directly, Equivalent Cost automatically isolates to that worker's own steps (`Subagent Only`) with no sibling or parent leakage. Sorts child sessions by live activity priority (`GENERATING` -> `RUNNING_TOOLS` -> `updatedAtMs` descending), folds lists exceeding 5 workers to the **Top 5** most recently active by default with one-click expansion into a **`400px` scrollable** container (preserving scroll position across live polls), and shows per-worker **relative update time** plus an **`● Ended` (`● 已结束`)** badge for terminated subagents (`manage_subagents` `kill`/`kill_all`) and killed swarm workers.
- **Daily Official Pricing Sync, Per-Model Rates & Subscription ROI**:
  - Automatically syncs official model lists & Paid Tier pricing once per day on open via dual channels (`ai.google.dev/gemini-api/docs/pricing` + `models.dev/api.json` with `litellm` fallback and effective-date awareness) into `pricing_cache.json` inside `sidecar_data`, auto-discovers newly released flagship Gemini chat models and locally observed slugs, keeps user-customized `*` overrides highest priority, offers a **`↻ Sync Now` / `↻ 立即同步`** button, and falls back gracefully offline (`4.5s` timeout).
  - Separates `Gemini 3.1 Pro` (`$2.00` / `$0.20` / `$12.00` per 1M tokens, `>200k` `×2` / `×1.5`) into its own model tier alongside Gemini 4 `Carbon`/`Argon`/`Hydrogen`, `Gemini 3.8 Flash`, `Claude Opus 5.5`/`4.6`, `Claude Sonnet 5.5`, `GPT-OSS 120B`, and `Auto`, with an interactive clickable effective rates table for direct rate editing.
  - Read-only `conversations/<id>.db` + `conversation_summaries.db` Protobuf tracking deduplicates forked/branched/rewound conversations via `originCascadeId` and `botId`, normalizes `gemini-pro-default` to `gemini-3.1-pro` and strips effort-tier suffixes to raw model IDs, compares equivalent API value against recent 14-day model-gated subscription detection (**`Jio AI Pro`** `$0/mo`, `Google AI Pro` `$19.99/mo`, `Ultra 5x`, `Ultra 20x`, plus `Free` / `Custom`), and plots `Cost` / `Tokens` trends across `today`, `7d`, `30d`, and scrollable `all-time` bar charts with two-line KPI summaries and a compact fixed left Y-axis backed by `usage_ledger.json`.
- **Automatic OS/Environment HTTP(S) Proxy Auto-Detection & Pool Recovery**: Automatically resolves HTTP/HTTPS proxies in priority order (`AGY_TOKEN_MONITOR_PROXY` -> `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` -> Windows `HKCU\...\Internet Settings` registry or macOS `scutil --proxy` -> Windows `HKCU\Environment` user env registry fallback, with `%SystemRoot%\System32\reg.exe` fallback on `ENOENT`) and applies them via Node's `http.setGlobalProxyFromEnv` (5-minute cache on snapshots; automatic 15-minute proxy connection pool rebuild; forced pool rebuild & stale `undici` dispatcher close/drain on manual `Sync Now`, `Check Update`, and `Apply Update`). On transport/timeout errors (`recoverFromTransportFailure`), detects live OS proxy drift when an inherited `env` proxy goes stale and switches to the live OS proxy (or rebuilds the active pool) without ever bypassing an explicitly configured proxy to `direct`. Unsupported schemes such as `socks5://` are safely ignored without breaking `EnvHttpProxyAgent`, while loopback addresses (`127.0.0.1,localhost,::1`) are guaranteed in `NO_PROXY`.
- **In-Panel 3-Channel Release Check & SHA-256 CDN Hot Update**: Automatically checks for updates on startup and every 4 hours (cached in `update_cache.json` with ETag `304` support, plus manual check in Settings) across 3 fallback channels: GitHub Releases API (`8s` timeout), GitHub Releases web redirect (`releases/latest`, `6s`), and jsDelivr package metadata (`6s`). Manual checks force a proxy pool rebuild and automatically retry past an in-flight failed background check instead of returning stale failure state, while primary channel or download transport/timeout failures trigger proxy recovery before fallback channels or jsDelivr CDN (`cdn.jsdelivr.net` / `fastly.jsdelivr.net`, `15s` per-file timeout) are tried. Previews localized EN/ZH release notes in an in-panel modal, lets users skip a release tag until the next version, applies one-click SHA-256 verified `.zip` hot updates (`30s` timeout) — or falls back to jsDelivr CDN with per-file Base64 SHA-256 verification against `@ref/flat` while preserving all integrity/manifest/downgrade guards — keeps local preferences (`monitor_state.json`) and usage history (`usage_ledger.json`) intact, and surfaces colored warning/error toasts alongside Settings tooltip proxy diagnostics (`Proxy: <url> (<source>)` / `Direct connection`, localized for `timeout`, HTTP `403`/`429` rate limit, and network/proxy errors).

## How to Surface the Panel Link

1. **Check plugin state if uncertain** (read-only):
   - Query `GetAllPlugins` filtered to `{ name, dir, disabled, isGlobal }` (never print unfiltered `GetAllPlugins` output, never edit `~/.gemini/config/config.json`, and never call mutation RPCs).
2. **When `agy-token-monitor` is enabled and running**:
   - Surface the clickable Aux Pane pill on its own clear line so the user can open/toggle the side panel in one click:

     [Token Monitor](sidecar://agy-token-monitor/monitor_pane/)

   - Emit only one `sidecar://` pill per view and avoid repeating it if already opened in the current flow.
3. **When `agy-token-monitor` is disabled (or not yet enabled by the user)**:
   - Do **not** emit a `sidecar://` pill for a disabled plugin. Instead, surface the Customizations page link so the user can enable it (takes effect live with no restart):

     [Token Monitor](customization://agy-token-monitor)

   - Never emit `plugin://` or `plugins://` links.

## Standalone Local Debugging (Only If Requested)

If the user explicitly asks to preview or debug the dashboard outside Antigravity's Aux Pane, point them to:

```bash
node sidecars/monitor_pane/main.mjs --standalone 18923
```

Then open `http://127.0.0.1:18923/` in a browser.
