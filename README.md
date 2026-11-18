# agy-token-monitor

[English](#english) | [中文](#中文)

---

## English

**agy-token-monitor** is a lightweight Token & Context monitor plugin built for **Antigravity**. It runs in the right-hand side panel with a low memory footprint, reading local session data in read-only mode without modifying any Antigravity databases, transcripts, or host settings.

### Features

- **Live Token Speed (`tok/s`) & Session Status**:
  - Tracks current generation state (`Generating` with a live timer, `Tools` with progress, or `Idle`) and active model switches.
  - Calculates latest `tok/s`, weighted average, peak speed, and a 20-step sparkline per active model using actual step completion timestamps from SQLite.
- **Context Window Monitor & One-Click `/compact`**:
  - Shows current context usage (`input + cache read`) with configurable alert and max window thresholds.
  - Includes a **`⚡ Compact`** button in the Context card header that copies `/compact` to the clipboard so you can compress long conversations at the right time.
- **Session Cost, Total Tokens & Subscription ROI**:
  - Breaks down uncached input, cache read, output tokens, and total token consumption per session. Main conversations let you toggle between **With Subagents** and **Main Only**; when inspecting an individual subagent or swarm worker directly, Equivalent Cost stays isolated to that worker's own steps (**Subagent Only**) without pulling in parent or sibling usage, and model breakdown tables support clickable **Total** and **Cost** column sorting.
  - Automatically detects your monthly plan from models used over the past 14 days (`Jio AI Pro`, `Google AI Pro`, `Ultra 5x`, `Ultra 20x`, or manual `Free` / custom fee) and compares API equivalent cost across `USD` and `CNY`.
- **Daily Official Model & Pricing Sync**:
  - Syncs model lists, token pricing, and `USD / CNY` exchange rates once per day when opened (`ai.google.dev`, `models.dev`, and ECB reference FX rates), caching results locally with a `↻ Sync Now` button and offline fallback.
  - Custom per-model price edits (`*`) and manual FX rate locks always take priority over auto-synced defaults, and clicking any row in the rate table loads that model for quick editing.
- **Multi-Period Usage Analytics**:
  - Aggregates usage across **Today** (24-hour bars), **7 Days**, **30 Days**, and **All Time** with two-line KPI summaries (active days / archived sessions and daily average / output tokens) in horizontally scrollable, mouse-draggable trend charts with a compact left Y-axis and clickable **Total** / **Cost** sorting in the model breakdown table.
  - Deduplicates forked, branched, and rewound conversations so inherited history is never double-counted.
- **Bilingual UI & Flexible Token Units**:
  - Switch between **English** and **Chinese** (`EN / 中`) in one click from the top bar.
  - Choose between `K / M / B`, `万 / 亿`, exact integers (`1,234,567`), or fixed `M` token units.
  - Live metric numbers and progress/trend bars update with zero-layout-shift transitions (inline-grid per-digit slot rolling for matching lengths, whole-value swaps on unit or digit-count changes, fixed-row cards with per-card memoization, respecting `prefers-reduced-motion` and snapping immediately when switching language or conversations).
- **Automatic OS & Environment Proxy Support**:
  - Automatically detects HTTP/HTTPS proxies in priority order: `AGY_TOKEN_MONITOR_PROXY` -> `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` -> OS system proxy (Windows Internet Settings registry and macOS `scutil --proxy`).
  - Safely ignores unsupported schemes such as `socks5://` without crashing `EnvHttpProxyAgent`, guarantees loopback addresses (`127.0.0.1`, `localhost`, `::1`) remain in `NO_PROXY`, caches detection for 5 minutes during snapshots, and force-refreshes on manual pricing sync, update check, or hot-update actions.
- **In-Panel 3-Channel Release Check, CDN Hot Update & Diagnostics**:
  - Checks for new versions automatically on startup and every 4 hours (plus manual check in Settings) across 3 fallback channels — GitHub Releases API (ETag `304` cached), GitHub Releases web redirect (`releases/latest`), and jsDelivr package metadata — and lets you preview EN/ZH release notes or skip a release tag directly in the panel.
  - Supports one-click SHA-256 verified `.zip` hot updates while keeping local settings and usage history intact; when the primary archive download fails or times out due to network or HTTP errors, automatically falls back to jsDelivr CDN (`cdn.jsdelivr.net` / `fastly.jsdelivr.net`) with per-file Base64 SHA-256 verification before atomic installation.
  - Shows distinct warning (amber) and error (rose) toast banners with localized diagnostics for timeouts, HTTP `403`/`429` rate limits, and network/proxy errors across update, pricing sync, preference save, and `/compact` copy actions, and keeps recent check failure status visible in Settings.

### Installation

**Option 1 — Download Release Archive**

Download `agy-token-monitor-v0.2.8.zip` from [GitHub Releases](https://github.com/JefferyL1ang/agy-token-monitor/releases) and extract the `agy-token-monitor` folder into:
- Windows: `%USERPROFILE%\.gemini\config\plugins\agy-token-monitor`
- macOS / Linux: `~/.gemini/config/plugins/agy-token-monitor`

**Option 2 — Sync from Source (Windows PowerShell)**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1"
```

To verify JSON manifests and plugin discovery without copying files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1" -VerifyOnly
```

### Usage

1. Open `[Token Monitor](customization://agy-token-monitor)` in Antigravity Customizations and enable the plugin (takes effect immediately without restart).
2. Click the `+` button in the right Auxiliary Pane bar and select **Token Monitor** (or click `[Token Monitor](sidecar://agy-token-monitor/monitor_pane/)` when surfaced in chat).

### Directory Structure

```text
agy-token-monitor/
├── plugin.json                        # Plugin manifest
├── README.md                          # Documentation (EN / ZH)
├── assets/
│   └── logo.svg                       # Plugin icon
├── skills/
│   └── token-monitor/
│       └── SKILL.md                   # Skill for opening the panel from chat
├── scripts/
│   └── sync-plugin.ps1                # Local plugin sync & check script
├── sidecars/
│   └── monitor_pane/
│       ├── package.json               # Sidecar package manifest
│       ├── sidecar.json               # Aux Pane entrypoint config
│       ├── net_proxy.mjs              # OS & env HTTP(S) proxy auto-detection
│       ├── pricing_sync.mjs           # Daily model & pricing sync module
│       ├── release_updater.mjs        # 3-channel release check & CDN hot-update module
│       ├── parser.mjs                 # Read-only SQLite & transcript parser
│       ├── main.mjs                   # Sidecar HTTP server & file watcher
│       ├── index.html                 # Panel HTML
│       ├── styles.css                 # Theme-adaptive styles
│       └── app.js                     # Frontend UI logic
└── tests/
    └── parser.test.mjs                # Unit & standalone API tests
```

### Local Development & Tests

Run the panel in standalone browser mode (default port `18923`):

```bash
node sidecars/monitor_pane/main.mjs --standalone 18923
```

Run unit tests:

```bash
node --test tests/parser.test.mjs
```

---

## 中文

**agy-token-monitor** 是一个面向 **Antigravity** 的轻量级 Token 与上下文监控插件。它运行在右侧辅助面板中，内存占用低，仅以只读方式读取本地会话数据，不修改任何 Antigravity 数据库、聊天记录或全局配置。

### 主要功能

- **实时 Token 测速（`tok/s`）与状态监控**：
  - 实时显示当前对话状态（生成计时、工具执行进度或空闲）及当前所用模型。
  - 基于 SQLite 步骤完成时间戳计算最新 `tok/s`、加权均速、峰值与近 20 步趋势，避免流式写入时间戳造成的测速虚高，并按当前模型独立统计。
- **上下文占用监控与一键 `/compact`**：
  - 直观显示当前对话上下文占用、缓存命中率及上下文增长最快的 Top 5 步骤。
  - 卡片右上角提供 **`⚡ 压缩 /compact`** 按钮，点击即可复制 `/compact` 命令，方便在上下文接近上限时快速压缩。
- **会话费用、总 Token 消耗与订阅对比**：
  - 统计单次会话的未缓存输入、缓存读取、累计输出与**总 Token 消耗**：主对话可在「含子代理」与「仅主对话」间切换，直接查看单个子代理或 Swarm Worker 时会自动切换为「子代理独立计费」，仅统计该节点自身用量而不混入主对话或兄弟节点；模型用量明细表支持点击 **总计** 和 **费用** 列头升降序排列。
  - 支持 `USD` / `CNY` 折算，基于近 14 天实际使用的模型自动识别订阅方案（`Jio AI Pro`、`Google AI Pro`、`Ultra 5x`、`Ultra 20x`），也支持手动选择 `Free` 或自定义月费进行回本对比。
- **每日同步官方模型、价格与汇率**：
  - 每天首次打开面板时自动同步现役模型单价与实时 `USD / CNY` 汇率（`ai.google.dev`、`models.dev` 及欧洲央行参考汇率），支持离线缓存回退与 **`↻ 立即同步`** 按钮。
  - 手动修改过的模型单价（带 `*` 标记）与手动固定汇率始终优先于自动同步值；展开下方费率表后可直接点击任意模型行切换编辑。
- **多周期历史统计与分支去重**：
  - 支持查看 **今日**（24 小时分时）、**近 7 天**、**近 30 天** 与 **全部历史** 用量趋势，概览 KPI 采用双行摘要展示（含已归档会话数与日均/输出用量），柱状图左侧固定显示紧凑 Y 轴刻度并支持鼠标按住横向拖动与滚轮横滑；周期模型明细表同样支持点击 **总计 / 费用** 列头排序。
  - 自动识别分支（Fork）、并行对比及回退重生的会话，避免继承的历史步骤被重复计费。
- **中英双语切换与多种 Token 单位**：
  - 顶部栏设置按钮旁支持一键切换 **中文 / 英文**（`EN / 中`）。
  - 支持 `K / M / B`、`万 / 亿`、精确整数（`1,234,567`）和固定 `M` 四种 Token 显示单位。
  - 指标数值与进度条、柱状图更新时采用零布局抖动平滑过渡（同位数采用内联网格逐位滚动，跨单位或位数变化时整值平滑替换，固定行高卡片配合按卡缓存避免无变化重绘；遵循系统 `prefers-reduced-motion` 设置，切换语言或会话时直接刷新）。
- **系统与环境变量代理自动适配**：
  - 按优先级自动识别 HTTP/HTTPS 代理：`AGY_TOKEN_MONITOR_PROXY` → 标准环境变量（`HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`）→ 操作系统代理（Windows Internet Settings 注册表与 macOS `scutil --proxy`）。
  - 安全忽略 `socks5://` 等不支持的代理协议以避免请求异常，自动确保 `127.0.0.1`、`localhost`、`::1` 留在 `NO_PROXY` 中；快照轮询每 5 分钟缓存一次代理状态，手动同步价格、检查更新或执行热更新时强制实时刷新。
- **内置三通道版本检测、CDN 热更新与错误诊断**：
  - 启动时及每 4 小时自动检测新版本（也可在设置中手动检查），依次支持 GitHub Releases API（支持 ETag `304`）、GitHub Releases 网页跳转（`releases/latest`）与 jsDelivr 包元数据三通道兜底，并可在面板内直接预览中/英更新说明或跳过当前版本。
  - 支持经 SHA-256 校验的一键 `.zip` 热更新，更新过程完整保留本地配置与历史用量记录；当主压缩包下载因网络或超时失败时，自动切换至 jsDelivr CDN（`cdn.jsdelivr.net` / `fastly.jsdelivr.net`），逐文件校验 Base64 SHA-256 哈希后再执行原子替换。
  - 为检查更新、安装更新、价格同步、设置保存及 `/compact` 复制失败提供独立配色的警告（琥珀色）与错误（玫瑰红）提示条，并将超时、HTTP `403`/`429` 限流与网络/代理异常转译为本地化诊断提示，同时在设置面板保留最近一次检测失败状态。

### 安装方式

**方式一 — 下载 Release 压缩包**

前往 [GitHub Releases](https://github.com/JefferyL1ang/agy-token-monitor/releases) 下载 `agy-token-monitor-v0.2.8.zip`，将其中的 `agy-token-monitor` 文件夹解压至：
- Windows：`%USERPROFILE%\.gemini\config\plugins\agy-token-monitor`
- macOS / Linux：`~/.gemini/config/plugins/agy-token-monitor`

**方式二 — 从源码同步（Windows PowerShell）**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1"
```

仅校验 JSON 与插件状态（不复制文件）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sync-plugin.ps1" -VerifyOnly
```

### 使用方法

1. 在 Antigravity 的 Customizations 页面打开 `[Token Monitor](customization://agy-token-monitor)` 并开启插件（即时生效，无需重启）。
2. 点击右侧辅助面板顶部的 `+` 号选择 **Token Monitor** 打开面板（或直接点击对话中的 `[Token Monitor](sidecar://agy-token-monitor/monitor_pane/)` 链接）。

### 目录结构

```text
agy-token-monitor/
├── plugin.json                        # 插件清单
├── README.md                          # 说明文档（中 / 英）
├── assets/
│   └── logo.svg                       # 插件图标
├── skills/
│   └── token-monitor/
│       └── SKILL.md                   # 从对话打开面板的引导技能
├── scripts/
│   └── sync-plugin.ps1                # 本地插件同步与校验脚本
├── sidecars/
│   └── monitor_pane/
│       ├── package.json               # Sidecar 包声明
│       ├── sidecar.json               # 辅助面板入口配置
│       ├── net_proxy.mjs              # 系统与环境变量 HTTP(S) 代理自动检测
│       ├── pricing_sync.mjs           # 每日模型、价格与汇率同步模块
│       ├── release_updater.mjs        # 三通道版本检测与 CDN 热更新模块
│       ├── parser.mjs                 # 只读 SQLite 与会话记录解析模块
│       ├── main.mjs                   # Sidecar HTTP 服务与文件监听
│       ├── index.html                 # 面板页面结构
│       ├── styles.css                 # 自适应主题样式
│       └── app.js                     # 前端交互逻辑
└── tests/
    └── parser.test.mjs                # 单元测试与独立接口测试
```

### 本地调试与测试

启动独立网页调试服务（默认端口 `18923`）：

```bash
node sidecars/monitor_pane/main.mjs --standalone 18923
```

运行单元测试：

```bash
node --test tests/parser.test.mjs
```
