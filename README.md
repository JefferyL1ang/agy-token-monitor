# agy-token-monitor

[English](#english) | [中文](#中文)

---

## English

**agy-token-monitor** (v0.2.3 Beta) is a lightweight, low-memory-footprint, pure read-only, zero-intrusion Sidecar Auxiliary Pane plugin built and adapted for **Antigravity**. Without modifying core conversation databases, transcripts, or global host configuration, it provides live token generation speed (`tok/s`), active model switches, context usage monitoring with a one-click `/compact` helper, session total token consumption, daily dual-channel official model & pricing auto-sync, prompt cache hit rate, subagent/swarm aggregation, subscription ROI, and SQLite fork-deduplicated multi-period usage analytics.

> **Beta Release Note (`v0.2.3`)**: This release uses `0.2.3` as a beta test version introducing **Daily Dual-Channel Official Model & Pricing Auto-Sync** (`ai.google.dev` + `models.dev` / `litellm` into `pricing_cache.json`), a **Dedicated `Gemini 3.1 Pro` Tier & Interactive Rate Editor** (fixing the `#pref-model-select` switching bug and supporting row-click editing), and **Session `Total Tokens` Consumption** in Tab 1's Equivalent Cost card and Tab 2 conversation items — building on `v0.2.2`'s bilingual EN/ZH UI, `400k / 500k` context defaults with one-click `/compact`, active-model-scoped speed calculation, and 4 selectable token display units.

### Key Features

- **Daily Dual-Channel Official Model & Pricing Auto-Sync**:
  - Automatically syncs official model catalogs and Paid Tier pricing once per day on open via two channels: `https://ai.google.dev/gemini-api/docs/pricing` (Paid Tier HTML parser with **effective-date awareness** comparing current time against introductory vs `"starting <Month Day, Year>"` standard pricing dates) and `https://models.dev/api.json` (with `litellm` `model_prices_and_context_window.json` fallback).
  - Persists synced catalogs atomically to `pricing_cache.json` inside `sidecar_data`, auto-discovers newly released flagship Gemini chat models (filtering out embedding/TTS/image/video/legacy models) and locally observed slugs, and keeps user-customized `*` overrides (`modelOverrides`) at highest priority without overwriting manual edits.
  - Includes a **`↻ Sync Now`** (`POST /api/sync-pricing`) button and live sync status bar in the Settings drawer, and falls back gracefully offline (`4.5s` timeout per upstream request, preserving cached or built-in baseline rates).
- **Dedicated `Gemini 3.1 Pro` Tier & Interactive Rate Editor**:
  - Separates `Gemini 3.1 Pro` (`$2.00` input / `$0.20` cached / `$12.00` output per 1M tokens, `>200k` `×2` / `×1.5` long-context multipliers, matching `gemini-3.1-pro` and `gemini-pro-default`) into its own pricing tier (distinct from `Gemini 4 Carbon`, and mapped to the `pro` subscription tier in `auto` detection).
  - Fixes the `#pref-model-select` dropdown switching bug by updating `selectedProfileId` cleanly and syncing `*` modified badges in place instead of prematurely rebuilding `<select>` options.
  - Makes every row in the collapsible effective rates table clickable (and keyboard-activatable) so clicking any row selects and loads that model directly into the rate editor.
- **Session Total Token Consumption**:
  - Displays session `Total Tokens` (`inputUncachedTokens + cacheReadTokens + outputTokens`, dynamically scoped to `With Subagents` / `Main Only` and formatted using the selected `tokenUnit` with exact-integer hover tooltips) right in Tab 1's Equivalent Cost card alongside `Steps` (replacing the cluttered monthly share line, while retaining Subscription ROI in Tab 2 and Settings).
  - Also displays per-conversation `Total` token consumption on Tab 2 conversation items.
- **Accurate Live Token Speed (`tok/s`) & State Machine**:
  - Automatically detects `GENERATING` (with a 100ms precision live stopwatch), `RUNNING_TOOLS` (tool progress `done/total` and active tool summary), and `IDLE`.
  - Prioritizes SQLite `steps.metadata` `completedAtMs` over transient WAL streaming timestamps to eliminate artificial `tok/s` spikes.
  - Computes latest `tok/s`, weighted average, peak speed, and the 20-step sparkline **scoped to the active model** (falling back cleanly to all measured steps when switching to a model with no measured steps yet).
- **Context Usage Monitor (`400k / 500k`) & One-Click `/compact` Helper**:
  - Displays live conversation context (`input_tokens + cache_read_tokens`) against configurable defaults: **Alert Threshold = `400k` (80% `WARNING`)** and **Max Window = `500k` (`460k` / 92% `CRITICAL`)**, with automatic migration from legacy untouched `250k / 1M` settings.
  - Provides a one-click **`⚡ Compact` / `⚡ 压缩 /compact`** button in the Context Usage header (highlighted on `WARNING` and pulsing on `CRITICAL`) that copies `/compact` to the clipboard, automatically focuses the target chat via `toggleConversation` when inspecting a non-bound session, and notifies you to paste and press Enter.
- **One-Click Bilingual UI (`EN / 中`)**:
  - Click the **`EN` / `中`** toggle next to the Settings button in the top bar to switch the entire interface—including cards, charts, model tables, relative timestamps, and Settings—between English and Simplified Chinese immediately, persisted across reloads (`language: 'zh' | 'en'`).
- **4 Selectable Token Display Units**:
  - Switch between **`K/M/B`** (auto-scaled `auto`), **`万/亿`** (`wan_yi`), **Exact Integer** (`exact`, e.g. `1,234,567`), and **Fixed `M`** (`m`) from either the Tab 2 Usage Summary header or the Settings drawer, while retaining exact integer hover tooltips.
- **Scrollable & Mouse-Draggable Multi-Period Trend Charts**:
  - Inspect **`Today`** (24-hour hourly bars), **`7 Days`**, **`30 Days`**, and **`All Time`** (daily bars up to 180 days, weekly buckets beyond 180 days) with full unclipped bucket labels, left-button mouse drag scrolling, mouse-wheel horizontal scrolling, and preserved scroll position across 1s background polls.
- **Clean Equivalent API Cost & Subscription ROI**:
  - Automatic per-step pricing across active models (**Gemini 4 Argon / Carbon / Hydrogen**, **Gemini 3.1 Pro**, **Gemini 3.8 Flash**, **Claude Opus 5.5 / 4.6**, **Claude Sonnet 5.5**, **GPT-OSS 120B**, synced/discovered models, and `Auto` fallback) with `>200k` long-context tier multipliers, per-model `*` overrides, and `USD` / `CNY` conversion.
  - Toggle between **`Main Only`** and **`With Subagents`**, and track prorated subscription cost vs equivalent API value (`Free $0`, `Google AI Pro $19.99`, `Ultra 5x $99.99`, `Ultra 20x $199.99`, or `Custom`) with break-even progress and net ROI.
- **SQLite Fork-Deduplicated Raw Model IDs & `Total` Column**:
  - Parses `<appData>/conversations/<convId>.db` (`gen_metadata` & `steps`) and `conversation_summaries.db` alongside `transcript.jsonl` / `transcript_full.jsonl` and Swarm `members.json`.
  - Decodes Protobuf provenance (`originCascadeId` and `botId`) so forked, branched, battle-mode, and rewound conversations report authentic inherited context size in Tab 1 while strictly preventing duplicate token billing in session totals and global multi-period analytics (recovering deleted or rewound orphan parent steps exactly once).
  - Maps `gemini-pro-default` (and enum `1016`) to **`gemini-3.1-pro`**, strips effort-tier suffixes (`High`/`Medium`/`Low`/`XHigh`/`Thinking`) into canonical raw model IDs, captures `/compact` (`step_type = 23`) token cost without inflating live context, excludes Protobuf `field_1` enum IDs from token counts, and displays a 7-column breakdown table (`Model | Steps/Chats | Input | Cache | Output | Total | Cost`).
- **Prompt Cache & Top Context Spikes Diagnostics**:
  - Visualizes latest cache hit rate (`%`), uncached input, net delta (`+delta`), and the top 5 positive context jumps (`topSpikes`) linked to triggering tool summaries or user prompts.
- **Subagent & Swarm Aggregation with Context Isolation**:
  - Discovers child subagents and swarm workers automatically, summarizing combined tokens and costs while keeping the active conversation's context window isolated.

### Pure Read-Only, Zero-Intrusion Architecture

1. **Zero Core Data Modification**:
   - `sidecars/monitor_pane/parser.mjs` opens `<appData>/conversations/<convId>.db` and `conversation_summaries.db` strictly with `{ readOnly: true, timeout: 2500 }` and reads `transcript.jsonl`, `transcript_full.jsonl`, and `swarm/members.json` read-only.
   - `sidecars/monitor_pane/pricing_sync.mjs` performs only read-only public HTTPS GET requests (`4.5s` timeout) to official pricing sources—never uploading any user or conversation data.
   - **Never** writes to `conversations/`, `brain/`, or `~/.gemini/config/config.json`.
2. **Isolated Sidecar State & Auto-Migrating Ledger**:
   - Preferences (`monitor_state.json`, `prefsSchemaVersion: 3`), daily synced official pricing cache (`pricing_cache.json`), fallback step timings, and the daily ledger (`usage_ledger.json`, schema `version: 4`, automatically rebuilt from `v1`/`v2`/`v3` on startup) are persisted atomically only inside `sidecar_data` (`ANTIGRAVITY_EXECUTABLE_DATA_DIR`, or OS temp directory `agy-token-monitor-state/` in standalone mode).
3. **Zero External npm Dependencies**:
   - Built solely on Node.js built-in modules (including `node:sqlite`) and Antigravity's `sidecar_sdk`.
4. **Incremental ETag Polling & Safe DOM Updates**:
   - Polls `GET /api/snapshot?conv=<id>&etag=<etag>` every 1s with `{ unchanged: true }` short-circuiting, supports on-demand `POST /api/sync-pricing`, and constructs all UI nodes with zero `innerHTML`.

### Directory Structure

```text
agy-token-monitor/
├── plugin.json                        # Plugin manifest (v0.2.3 beta)
├── README.md                          # Bilingual EN/ZH documentation
├── assets/
│   └── logo.svg                       # Plugin vector icon (128x128)
├── skills/
│   └── token-monitor/
│       └── SKILL.md                   # Conversation skill guiding Aux Pane links
├── scripts/
│   └── sync-plugin.ps1                # Global plugin sync & read-only verification script
├── sidecars/
│   └── monitor_pane/
│       ├── package.json               # Sidecar ESM package manifest (v0.2.3)
│       ├── sidecar.json               # Aux Pane view & restart policy config
│       ├── pricing_sync.mjs           # Daily dual-channel official model & pricing sync engine
│       ├── parser.mjs                 # Read-only SQLite/Protobuf/Transcript/Swarm/Cost engine
│       ├── main.mjs                   # Sidecar HTTP/API server & 400ms file watcher
│       ├── index.html                 # Dashboard HTML skeleton
│       ├── styles.css                 # Adaptive dark/light theme & responsive styles
│       └── app.js                     # Polling, stopwatch, EN/ZH i18n, charts & settings UI
└── tests/
    └── parser.test.mjs                # Unit tests (node:test)
```

### Installation & Global Sync (`scripts/sync-plugin.ps1`)

**Option 1 — GitHub Release Archive**: Download `agy-token-monitor-v0.2.3.zip` directly from [GitHub Releases](https://github.com/JefferyL1ang/agy-token-monitor/releases) and extract the `agy-token-monitor` folder into `%USERPROFILE%\.gemini\config\plugins\agy-token-monitor` (or `~/.gemini/config/plugins/agy-token-monitor`).

**Option 2 — Sync from Source (`scripts/sync-plugin.ps1`)**: Deploy the plugin files to `%USERPROFILE%\.gemini\config\plugins\agy-token-monitor`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1"
```

Validate JSON manifests and read-only plugin discovery without copying files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1" -VerifyOnly
```

> `sync-plugin.ps1` updates only managed plugin files (`plugin.json`, `README.md`, `assets/`, `skills/`, `sidecars/`), never modifies `~/.gemini/config/config.json`, and queries `GetAllPlugins` strictly read-only when `ANTIGRAVITY_LS_ADDRESS` and `ANTIGRAVITY_CSRF_TOKEN` are present.

### Usage in Antigravity

1. **Enable the plugin**: Open `[Token Monitor](customization://agy-token-monitor)` and toggle it on in Customizations (takes effect live without restarting).
2. **Open the Aux Pane**:
   - Click `[Token Monitor](sidecar://agy-token-monitor/monitor_pane/)` when surfaced in chat;
   - Or click the `+` menu in Antigravity's right Aux Pane bar and choose **Token Monitor**;
   - Or ask about live `tok/s`, context usage / `/compact` timing, cache hit rate, or subscription ROI to invoke the built-in `token-monitor` skill.

### Standalone Debug & Unit Tests

Start a standalone local server without launching Antigravity (default port `18923`):

```bash
node sidecars/monitor_pane/main.mjs --standalone 18923
```

Open `http://127.0.0.1:18923/` in your browser.

Run the unit test suite:

```bash
node --test tests/parser.test.mjs
```

---

## 中文

**agy-token-monitor**（v0.2.3 测试版）是一款专为 **Antigravity** 适配打造、轻量且内存占用低的纯只读、零侵入实时 Token 与上下文监控插件（Sidecar Auxiliary Pane）。在不修改任何核心对话数据库、Transcript 与全局配置文件的前提下，提供高精度生成速度（`tok/s`）、上下文占用监控与一键 `/compact` 助手、会话总 Token 消耗展示、每日双通道官方模型与价格自动同步、可点击交互式费率表、中英双语一键切换、四种 Token 显示单位、可拖拽滚动的多周期趋势图、SQLite 分支去重统计与分模型订阅回本对比。

> **测试版本说明（`v0.2.3`）**：本版本按测试版规范采用 `0.2.3` 版本号，重点新增 **每日双通道官方模型与价格自动同步**（`ai.google.dev` + `models.dev` / `litellm` 落盘至 `pricing_cache.json`）、**`Gemini 3.1 Pro` 独立档位与可点击交互式费率表**（修复 `#pref-model-select` 下拉切换失效问题并支持点击表格行直接编辑），以及 Tab 1 等效成本卡片与 Tab 2 会话列表中的 **会话「总 Token 消耗」** 展示；同时延续 `v0.2.2` 的中英双语切换、`400k / 500k` 上下文阈值与一键 `/compact`、绑定在役模型测速及四种 Token 显示单位。

### 核心特性

- **每日双通道官方模型与价格自动同步**：
  - 每次打开面板时按日历天自动执行一次双通道同步：`https://ai.google.dev/gemini-api/docs/pricing`（解析官方 Paid Tier 单价，支持 **生效日期感知**，自动对比当前时间与过渡优惠价 / `"starting <Month Day, Year>"` 标准定价日期）与 `https://models.dev/api.json`（含 `litellm` `model_prices_and_context_window.json` 回退）。
  - 同步结果原子化持久化至 `sidecar_data` 目录下的 `pricing_cache.json`，自动发现新发布的旗舰 Gemini 对话模型（过滤 embedding/TTS/生图/视频/旧版非对话模型）与本地观测到的规范模型 ID，并严格保持用户自定义 `*` 覆盖配置（`modelOverrides`）的最高优先级。
  - 设置抽屉内提供 **`↻ 立即同步`**（`POST /api/sync-pricing`）手动同步按钮与实时状态栏，离线或超时（单源 `4.5s` 超时）时自动平滑回退至本地缓存或内置基准价。
- **`Gemini 3.1 Pro` 独立档位与可点击交互式费率表**：
  - 将 `Gemini 3.1 Pro`（每百万 Token `$2.00` 输入 / `$0.20` 缓存 / `$12.00` 输出，`>200k` 长上下文输入 `×2` / 输出 `×1.5` 倍率，匹配 `gemini-3.1-pro` 与 `gemini-pro-default`）从 `Gemini 4 Carbon` 拆分为独立计价档位，并在自动订阅识别中映射至 `pro` 档。
  - 修复 `#pref-model-select` 下拉切换时被旧模型重渲染覆盖的缺陷，支持原地刷新 `*` 修改标记而不重置选择框状态。
  - 展开等效费率明细表后，支持**直接点击任意模型行**（或键盘 `Enter` / 空格）切换并加载该模型单价进行编辑。
- **会话「总 Token 消耗」展示**：
  - 在 Tab 1「等效成本」卡片中 `步数` 旁直接展示本会话 **总 Token 消耗**（`inputUncachedTokens + cacheReadTokens + outputTokens`，随 `含子代理` / `仅主对话` 开关与所选 `tokenUnit` 动态切换，悬停保留精确整数；并移除原有的月订阅占比行以释放纵向空间，订阅 ROI 保留在 Tab 2 与设置抽屉中）。
  - 同步在 Tab 2 会话明细列表条目中展示单会话 `总计` Token 消耗。
- **精准实时 Token 速度与状态机（`tok/s` & Live State）**：
  - 自动识别 `GENERATING`（含 100ms 精度实时生成秒表）、`RUNNING_TOOLS`（工具进度与摘要标签）与 `IDLE` 状态。
  - **SQLite `completedAtMs` 优先测速**：优先采用 SQLite `steps.metadata` 的实际完成时间戳，避免 WAL 流式首包时间导致虚假高 `tok/s` 尖峰；并将加权均速、峰值与近 20 步 Sparkline **严格按当前 `activeModel` 独立统计**（切换至尚未测速的新模型时自动平滑回退展示全部已测步骤）。
- **上下文占用监控（`400k / 500k`）与一键 `/compact` 助手**：
  - 展示主对话上下文占用绝对值（`input_tokens + cache_read_tokens`）与三态预警条：默认 **提醒线 = `400k`（80% 触发 `WARNING`）**、**最大窗口 = `500k`（`460k` / 92% 触发 `CRITICAL`）**，并支持旧版未自定义 `250k / 1M` 配置自动迁移升级。
  - 卡片右上角内置 **`⚡ 压缩 /compact`（`⚡ Compact`）** 按钮（`WARNING` 琥珀高亮、`CRITICAL` 玫瑰红脉冲提示）：点击即可复制 `/compact` 到剪贴板；若当前正在查看非绑定子会话，还会自动调用 `toggleConversation` 聚焦对应聊天窗口并弹出提示。
- **一键中英双语切换（`EN / 中`）**：
  - 顶部栏设置按钮左侧新增 **`EN` / `中`** 切换按钮，点击即刻在简体中文与英文之间切换全界面文案（含卡片、图例、表头、相对时间与设置抽屉），并自动持久化保存（`language: 'zh' | 'en'`）。
- **四种可选 Token 显示单位**：
  - 支持在「用量统计 -> 用量汇总」标题栏及设置抽屉中一键切换 **`K / M / B`**（自动缩放 `auto`）、**`万 / 亿`**（`wan_yi`）、**精确整数**（`exact`，如 `1,234,567`）与 **固定 `M`**（`m`），同时在所有数值悬停 `title` 中保留完整精确整数。
- **可横向滚动与鼠标拖拽的多周期趋势图**：
  - 支持 **`今日`**（24 小时分时）、**`近 7 天`**、**`近 30 天`** 与 **`全部历史`**（180 天内按日展示，超 180 天自动按周聚合）。每个柱条拥有完整无截断标签，支持**鼠标左键按住横向拖拽**、**滚轮横向滚动**，并在 1 秒后台轮询刷新时记忆并保持当前滚动位置。
- **分模型等效 API 费用与订阅 ROI 对比**：
  - 针对在役模型（**Gemini 4 Argon / Carbon / Hydrogen**、**Gemini 3.1 Pro**、**Gemini 3.8 Flash**、**Claude Opus 5.5 / 4.6**、**Claude Sonnet 5.5**、**GPT-OSS 120B**、自动发现官方模型及 `Auto` 默认档）按步骤自动匹配独立单价，支持 `>200k` 长上下文阶梯倍率、单模型 `*` 价格覆盖与 `USD` / `CNY` 汇率折算。
  - 支持 `仅主对话` 与 `含子代理` 视图切换，并根据所用高阶模型自动识别或手动指定订阅档位（`Free $0` / `Google AI Pro $19.99` / `Ultra 5x $99.99` / `Ultra 20x $199.99` / `自定义月费`），直观呈现周期折算订阅成本、回本进度与净节省倍数。
- **SQLite 分支去重、原始模型 ID 与 `总计` 列**：
  - 以纯只读模式解析 `<appData>/conversations/<convId>.db`（`gen_metadata` 与 `steps`）及 `conversation_summaries.db`，联动 `transcript.jsonl` / `transcript_full.jsonl` 与 Swarm `members.json`。
  - 深度解码 Protobuf 溯源字段 `originCascadeId` 与 `botId`：Tab 1 上下文窗口真实反映继承后的完整占用，而单会话速度、费用与全局多周期统计严格按各会话实际执行步骤去重计费（并对已删除或回退父会话残留的孤立步骤按 `botId` 全局去重恢复一次）。
  - 将 `gemini-pro-default`（含枚举 `1016`）规范映射为 **`gemini-3.1-pro`**，自动剥离 `High` / `Medium` / `Low` / `XHigh` / `Thinking` 档位后缀聚合为原始后端模型 ID，完整计入 `/compact`（`step_type = 23`）Token 消耗而不虚增当前上下文，严格排除 `field_1` 枚举干扰，并在模型明细表提供 7 列视图（`模型 | 步数/会话 | 输入 | 缓存 | 输出 | 总计 | 费用`）。
- **Prompt Cache 与上下文增量尖峰诊断**：
  - 展示最近一步 Cache Hit Rate（`%`）、未缓存输入与净增量（`+delta`），并提取正向增量最大的 Top 5 尖峰步骤（`topSpikes`）及其触发工具/提示摘要。
- **Subagent / Swarm 聚合且上下文隔离**：
  - 自动发现当前会话的子代理与 Swarm 成员，汇总整体 Token 与费用，同时严格隔离主对话自身的上下文占用统计。

### 纯只读零侵入架构

1. **零修改 Antigravity 核心数据**：
   - `sidecars/monitor_pane/parser.mjs` 严格使用 `{ readOnly: true, timeout: 2500 }` 打开 `.db` 文件，只读访问 `transcript.jsonl`、`transcript_full.jsonl` 与 `swarm/members.json`。
   - `sidecars/monitor_pane/pricing_sync.mjs` 仅向公开官方定价页面/JSON 发起只读 HTTPS GET 请求（`4.5s` 超时），绝不上传任何用户或对话数据。
   - **绝不**向 `conversations/`、`brain/` 目录或 `~/.gemini/config/config.json` 写入任何数据。
2. **隔离持久化与自动迁移账本**：
   - 偏好设置（`monitor_state.json`，`prefsSchemaVersion: 3`）、每日官方价格缓存（`pricing_cache.json`）、JSONL 回退时间戳与历史用量账本（`usage_ledger.json`，Schema `version: 4`，启动时自动从 `v1`/`v2`/`v3` 重建）仅保存在 `sidecar_data`（`ANTIGRAVITY_EXECUTABLE_DATA_DIR`，Standalone 模式存于系统临时目录 `agy-token-monitor-state/`）。
3. **零外部 npm 依赖**：
   - 仅依赖 Node.js 内置模块（含原生 `node:sqlite`）与 Antigravity `sidecar_sdk`，无需 `npm install`。
4. **增量 ETag 轮询与零 XSS DOM 渲染**：
   - 前端每秒通过 `GET /api/snapshot?conv=<id>&etag=<etag>` 增量轮询，`unchanged: true` 时直接跳过渲染，并支持按需调用 `POST /api/sync-pricing`；全站采用原生 DOM 节点构建，零 `innerHTML` 注入风险。

### 目录结构

```text
agy-token-monitor/
├── plugin.json                        # 插件清单 (v0.2.3 beta)
├── README.md                          # 中英双语说明文档
├── assets/
│   └── logo.svg                       # 插件矢量图标 (128x128)
├── skills/
│   └── token-monitor/
│       └── SKILL.md                   # 对话引导技能 (触发 Aux Pane 链接)
├── scripts/
│   └── sync-plugin.ps1                # 同步到全局插件目录与只读校验脚本
├── sidecars/
│   └── monitor_pane/
│       ├── package.json               # Sidecar ESM 包声明 (v0.2.3)
│       ├── sidecar.json               # Aux Pane 视图与重启策略配置
│       ├── pricing_sync.mjs           # 每日双通道官方模型与价格自动同步引擎
│       ├── parser.mjs                 # 只读 SQLite/Protobuf/Transcript/Swarm/Cost 引擎
│       ├── main.mjs                   # Sidecar HTTP/API 服务与 400ms 文件监听
│       ├── index.html                 # 监控面板页面骨架
│       ├── styles.css                 # 自适应明暗主题与响应式样式
│       └── app.js                     # 实时轮询、秒表、双语 i18n、图表与设置逻辑
└── tests/
    └── parser.test.mjs                # 单元测试 (node:test)
```

### 安装与同步部署 (`scripts/sync-plugin.ps1`)

**方式一 — 下载 GitHub Release 压缩包**：直接前往 [GitHub Releases](https://github.com/JefferyL1ang/agy-token-monitor/releases) 下载 `agy-token-monitor-v0.2.3.zip`，将其中的 `agy-token-monitor` 文件夹解压至 `%USERPROFILE%\.gemini\config\plugins\agy-token-monitor`（或 `~/.gemini/config/plugins/agy-token-monitor`）即可。

**方式二 — 从源码同步（`scripts/sync-plugin.ps1`）**：在 Windows PowerShell 中将插件文件同步部署到 `%USERPROFILE%\.gemini\config\plugins\agy-token-monitor`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1"
```

仅校验 JSON 语法与只读插件发现状态（不复制文件）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1" -VerifyOnly
```

> 脚本仅更新目标插件目录内由本插件管理的 `plugin.json`、`README.md`、`assets/`、`skills/`、`sidecars/`，不会修改 `~/.gemini/config/config.json`；当环境中存在 `ANTIGRAVITY_LS_ADDRESS` 与 `ANTIGRAVITY_CSRF_TOKEN` 时执行只读 `GetAllPlugins` 查询确认发现状态。

### 在 Antigravity 中启用与打开

1. **启用插件**：点击 `[Token Monitor](customization://agy-token-monitor)`，在 Customizations 页面开启开关（即时生效，无需重启）。
2. **打开监控面板（Aux Pane）**：
   - 点击对话中的直达链接 `[Token Monitor](sidecar://agy-token-monitor/monitor_pane/)`；
   - 或点击 Antigravity 右侧 Aux Pane 标题栏 `+` 菜单选择 **Token Monitor**；
   - 也可直接在对话中询问 `tok/s` 速度、上下文占用与 `/compact` 时机、缓存命中率或订阅回本对比，由内置 `token-monitor` skill 引导打开面板。

### 独立本地调试与单元测试

无需启动 Antigravity 宿主容器即可启动独立调试服务（默认端口 `18923`）：

```bash
node sidecars/monitor_pane/main.mjs --standalone 18923
```

随后在浏览器访问 `http://127.0.0.1:18923/` 即可调试完整界面。

运行单元测试：

```bash
node --test tests/parser.test.mjs
```
