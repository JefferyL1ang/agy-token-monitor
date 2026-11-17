---
name: token-monitor
description: >-
  Open or guide the user to the Antigravity Token Monitor Aux Pane (`sidecar://agy-token-monitor/monitor_pane/`)
  to inspect live token generation speed (tok/s) scoped to the active model, 400k/500k context usage thresholds
  and one-click `/compact` helper, bilingual EN/ZH UI, selectable token units, prompt cache hit rate,
  subagent/swarm aggregation, per-model API cost (Gemini & Claude), subscription ROI, and SQLite
  fork-deduplicated multi-period (today / 7d / 30d / all-time) usage history.
  Use whenever the user asks to monitor token speed, check context usage or `/compact` timing, inspect
  cache hit rate or context spikes, switch token units or language, compare token cost vs subscription price,
  or open the Token Monitor panel.
---

# Token Monitor (`v0.2.2` Beta)

The `agy-token-monitor` plugin provides a real-time, pure read-only Auxiliary Pane (`Token Monitor`) backed by the `monitor_pane` sidecar.

## What Token Monitor Tracks

- **Live Speed & Status (`tok/s`)**: Current generation state (`GENERATING` 100ms stopwatch, `RUNNING_TOOLS` progress, or `IDLE`), active model timeline, latest `tok/s`, weighted average, peak speed, and recent 20-step sparkline — computed using SQLite `completedAtMs` timestamps (avoiding streaming timestamp spikes) and scoped to the active model.
- **Context Usage Monitor (`400k / 500k`) & One-Click `/compact`**: Active conversation context (`input_tokens + cache_read_tokens`) compared against configurable defaults: **`400k` (80% `WARNING`) alert threshold** and **`500k` max window** (`460k` / 92% `CRITICAL`). Includes a one-click **`/compact`** helper button in the context header that copies `/compact` to the clipboard (and focuses a non-bound session chat if inspected) so the user can compress context immediately.
- **Bilingual UI (`EN / 中`) & Selectable Token Units**: Header `EN / 中` toggle next to Settings switches the full interface immediately between English and Simplified Chinese; 4 selectable token display units (`K/M/B` auto-scale, `万/亿`, exact integer `1,234,567`, and fixed `M`) are available in both the Analytics header and Settings drawer.
- **Prompt Cache & Spike Diagnostics**: Latest cache hit rate (`%`), uncached input, net token delta, and top 5 positive context jumps (`topSpikes`) with triggering tool summaries.
- **Subagent & Swarm Aggregation**: Aggregates token usage and cost across child subagents and swarm workers (`With Subagents` vs `Main Only`) while keeping the main conversation's context size strictly isolated.
- **SQLite Fork-Deduplicated Models & Subscription ROI**: Read-only `conversations/<id>.db` + `conversation_summaries.db` Protobuf tracking that deduplicates forked/branched/rewound conversations via `originCascadeId` and `botId`, normalizes `gemini-pro-default` to `gemini-3.1-pro` and strips effort-tier suffixes to raw model IDs, and prices active models (Gemini 4 `Carbon`/`Argon`/`Hydrogen`, `Gemini 3.8 Flash`, `Gemini 3.1 Pro`, `Claude Opus 5.5`/`4.6`, `Claude Sonnet 5.5`, `GPT-OSS 120B`, and `Auto`) against automatic/custom subscription plans (`Free` / `Pro` / `Ultra 5x` / `Ultra 20x` / `Custom`) across `today`, `7d`, `30d`, and scrollable `all-time` charts backed by `usage_ledger.json`.

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
