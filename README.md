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
  - Breaks down uncached input, cache read, output tokens, and total token consumption per session, with a toggle between **With Subagents** and **Main Only**.
  - Compares API equivalent cost against your monthly subscription (`Free`, `Google AI Pro`, `Ultra 5x`, `Ultra 20x`, or custom fee) across `USD` and `CNY`.
- **Daily Official Model & Pricing Sync**:
  - Syncs model lists, token pricing, and `USD / CNY` exchange rates once per day when opened (`ai.google.dev`, `models.dev`, and ECB reference FX rates), caching results locally with a `↻ Sync Now` button and offline fallback.
  - Custom per-model price edits (`*`) and manual FX rate locks always take priority over auto-synced defaults, and clicking any row in the rate table loads that model for quick editing.
- **Multi-Period Usage Analytics**:
  - Aggregates usage across **Today** (24-hour bars), **7 Days**, **30 Days**, and **All Time** with horizontally scrollable, mouse-draggable trend charts.
  - Deduplicates forked, branched, and rewound conversations so inherited history is never double-counted.
- **Bilingual UI & Flexible Token Units**:
  - Switch between **English** and **Chinese** (`EN / 中`) in one click from the top bar.
  - Choose between `K / M / B`, `万 / 亿`, exact integers (`1,234,567`), or fixed `M` token units.

### Installation

**Option 1 — Download Release Archive**

Download `agy-token-monitor-v0.2.3.zip` from [GitHub Releases](https://github.com/JefferyL1ang/agy-token-monitor/releases) and extract the `agy-token-monitor` folder into:
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
│       ├── pricing_sync.mjs           # Daily model & pricing sync module
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
  - 统计单次会话的未缓存输入、缓存读取、累计输出与**总 Token 消耗**，支持在「含子代理」与「仅主对话」之间切换。
  - 支持 `USD` / `CNY` 折算，并将等效 API 费用与订阅月费（`Free`、`Google AI Pro`、`Ultra 5x`、`Ultra 20x` 或自定义月费）进行回本对比。
- **每日同步官方模型、价格与汇率**：
  - 每天首次打开面板时自动同步在役模型单价与实时 `USD / CNY` 汇率（`ai.google.dev`、`models.dev` 及欧洲央行参考汇率），支持离线缓存回退与 **`↻ 立即同步`** 按钮。
  - 手动修改过的模型单价（带 `*` 标记）与手动固定汇率始终优先于自动同步值；展开下方费率表后可直接点击任意模型行切换编辑。
- **多周期历史统计与分支去重**：
  - 支持查看 **今日**（24 小时分时）、**近 7 天**、**近 30 天** 与 **全部历史** 用量趋势，柱状图支持鼠标按住横向拖动与滚轮横滑。
  - 自动识别分支（Fork）、并行对比及回退重生的会话，避免继承的历史步骤被重复计费。
- **中英双语切换与多种 Token 单位**：
  - 顶部栏设置按钮旁支持一键切换 **中文 / 英文**（`EN / 中`）。
  - 支持 `K / M / B`、`万 / 亿`、精确整数（`1,234,567`）和固定 `M` 四种 Token 显示单位。

### 安装方式

**方式一 — 下载 Release 压缩包**

前往 [GitHub Releases](https://github.com/JefferyL1ang/agy-token-monitor/releases) 下载 `agy-token-monitor-v0.2.3.zip`，将其中的 `agy-token-monitor` 文件夹解压至：
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

### 本地调试与测试

启动独立网页调试服务（默认端口 `18923`）：

```bash
node sidecars/monitor_pane/main.mjs --standalone 18923
```

运行单元测试：

```bash
node --test tests/parser.test.mjs
```
