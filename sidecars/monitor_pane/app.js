// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 20:23:00
// Description: Upgrade Token Monitor frontend to v1.1 — rename threshold labels to
// 上下文占用监控/提醒线/最大窗口, add 3-section settings drawer (context limits, subscription plan,
// active per-model tariff editor + ledger resync), and upgrade Tab 2 into multi-period 用量统计.
// ============================================================================

(() => {
  'use strict';

  const POLL_INTERVAL_MS = 1000;
  const STOPWATCH_INTERVAL_MS = 100;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Add serial polling timeout, chunked ledger-sync interval, and
// preference mutation sequence counter to decouple prefs saves from polling.
// ============================================================================
  const POLL_TIMEOUT_MS = 15000;
  const LEDGER_SYNC_POLL_MS = 350;
  let prefMutationSeq = 0;
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================

  const apiFetch = (...args) => (window.sidecar?.fetch || fetch)(...args);
  const boundConvId = window.sidecar?.conversationId || '';

  let selectedConv = boundConvId;
  let lastEtag = '';

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Add v0.2.2 state fields (lang, tokenUnit, compact copy timer, trend scroll
// preservation) and complete zh/en I18N catalog with t() & applyStaticTranslations().
// ============================================================================
  const VALID_TOKEN_UNITS = ['auto', 'wan_yi', 'exact', 'm'];
  const VALID_LANGUAGES = ['zh', 'en'];
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add model sort option constants and SVG namespace constant for v0.2.5.
// ============================================================================
  const VALID_MODEL_SORT_KEYS = ['cost', 'total'];
  const VALID_MODEL_SORT_DIRS = ['desc', 'asc'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Add bounded metric/bar motion memory maps for v0.2.6 slot-roll & smooth bar transitions.
// ============================================================================
  const MAX_MOTION_MEMORY = 256;
  const rollingMetricMemory = new Map();
  const barMetricMemory = new Map();
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:40:30
// Description: Add v0.2.9 collapsed subagent/swarm display limit constant.
// ============================================================================
  const MAX_COLLAPSED_CHILDREN = 5;
// ============================================================================
// [MODIFIED END] 2026-11-18 11:40:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:10
// Description: Add v0.4.1 collapsed Side Questions display limit constant.
// ============================================================================
  const MAX_COLLAPSED_SIDE_QUESTIONS = 5;
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: Add v0.5.1 collapsed By Project display limit constant.
// ============================================================================
  const MAX_COLLAPSED_WORKSPACES = 8;
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================

  const state = {
    homeConvId: boundConvId,
    snapshot: null,
    activeTab: 'current',
    costScope: 'withChildren',
    spikesExpanded: false,
    drawerOpen: false,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Replace overlapping request sequence counter with conversation-epoch and serial
// polling control fields (convEpoch, pollInFlight, pollTimer, activePollController,
// inFlightConv, pendingForcePoll).
// ============================================================================
    convEpoch: 0,
    pollInFlight: false,
    pollTimer: null,
    activePollController: null,
    inFlightConv: '',
    pendingForcePoll: false,
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================
    serverClockOffsetMs: 0,
    lastStopwatchText: '',
    toastTimer: null,
    lastError: '',
    // v1.1 settings & multi-period state
    selectedProfileId: 'auto',
    draftModelOverrides: {},
    resyncConfirmArmed: false,
    resyncTimer: null,
    globalPeriod: 'today',
    trendMetric: 'cost',
    convListMode: 'recent',
    selectedSeriesIdx: null,
    // v0.2.2 bilingual, token unit, /compact & trend scroll state
    lang: 'zh',
    tokenUnit: 'auto',
    pendingPrefSaves: 0,
    compactCopiedUntil: 0,
    compactTimer: null,
    trendScrollKey: '',
    trendScrollLeft: 0,
    trendNeedsRightAlign: false,
    isDraggingTrend: false,
    pendingGlobalRerender: false,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Track manual/background official pricing sync state.
// ============================================================================
    pricingSyncing: false,
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:57:00
// Description: Add v0.2.4 release update check, modal, and hot-apply state fields.
// ============================================================================
    updateModalOpen: false,
    updateChecking: false,
    updateApplying: false,
    activeUpdateStatus: null,
    lastUpdatePillSig: '',
// ============================================================================
// [MODIFIED END] 2026-11-17 18:57:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add model breakdown sort state fields (modelSortBy, modelSortDir).
// ============================================================================
    modelSortBy: 'cost',
    modelSortDir: 'desc',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Track inspected child conversation IDs, last rendered conversation ID, and motion suppression flag.
// ============================================================================
    lastRenderedConvId: '',
    suppressMotionOnce: false,
    inspectedChildIds: new Set(),
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Track per-card dirty signatures for Tab 1 DOM memoization (CLS = 0).
// ============================================================================
    cardRenderSigs: {
      speed: '',
      cost: '',
      context: '',
      cache: '',
      childrenModels: '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Add pixelOffice dirty-signature field to state.cardRenderSigs.
// ============================================================================
      pixelOffice: '',
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:10
// Description: Add sideQuestions dirty-signature field to state.cardRenderSigs.
// ============================================================================
      sideQuestions: '',
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: Add Tab 2 top-section and session-list dirty signatures for A4/C2 memoization.
// ============================================================================
      globalTop: '',
      globalList: '',
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================
    },
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:40:30
// Description: Add v0.2.9 subagent/swarm folding & scroll preservation state and session checkout receipt modal state.
// ============================================================================
    childrenExpanded: false,
    childrenScrollTop: 0,
    receiptModalOpen: false,
    receiptScope: 'today',
    receiptDetailMode: 'compact',
    lastReceiptCanvas: null,
    lastReceiptVm: null,
    lastReceiptDataSig: '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Track in-flight receipt clipboard copy state in v0.3.1.
// ============================================================================
    receiptCopying: false,
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:40:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Add in-panel Pixel Office runtime, selection, timer, and canvas state fields.
// ============================================================================
    pixelOfficeCollapsed: false,
    pixelOfficeSelectedKey: '',
    pixelOfficeTick: 0,
    pixelOfficeTimer: null,
    pixelOfficeIntervalMs: 0,
    pixelOfficeHitBoxes: [],
    pixelOfficeModel: null,
    pixelOfficeCanvas: null,
    pixelOfficeInspectorCanvas: null,
    pixelOfficeLogicalWidth: 380,
    pixelOfficeLogicalHeight: 0,
    pixelOfficeLastCurrent: null,
    pixelOfficeLastPrefs: null,
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:10
// Description: Add Side Questions expanded toggle and scroll preservation state fields.
// ============================================================================
    sideQuestionsExpanded: false,
    sideQuestionsScrollTop: 0,
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: Add v0.5.1 state for on-demand stopwatch timer, modal focus return, By Project folding, and Tab 2 session filter bar persistence.
// ============================================================================
    stopwatchTimer: null,
    modalReturnFocusEl: null,
    workspacesExpanded: false,
    globalSearchQuery: '',
    globalModelFilter: '',
    globalActiveOnly: false,
    globalDom: null,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================
  };

  const I18N = {
    zh: {
      'header.waiting': '等待会话',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot and localize header status labels to Chinese (zh).
// ============================================================================
      'header.generating': '生成中',
      'header.tools': '执行工具',
      'header.idle': '空闲',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'header.currentModel': '当前模型',
      'header.modelTitle': '当前模型: {model}',
      'header.settingsLabel': '计价与上下文设置',
      'header.nonboundRegion': '非当前绑定会话提示',
      'header.viewingDefault': '正在查看其他会话',
      'header.viewing': '正在查看: {label}',
      'header.backToCurrent': '返回当前对话',
      'tabs.navLabel': '监控视图切换',
      'tabs.current': '当前会话',
      'tabs.global': '用量统计',
      'empty.title': '暂无活跃会话数据',
      'empty.desc': '等待当前对话生成首个模型步骤，或前往「用量统计」选择历史会话进行诊断。',
      'empty.gotoGlobal': '查看用量统计',
      'common.sessionPrefix': '会话 {id}',
      'common.standaloneOpenHint': '独立浏览器模式下不可直接跳转，已切换到监控视图',
      'common.fetchErrorPrefix': '监控数据拉取异常: {msg}',
      'common.backendConnFailed': '连接后台失败',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Add localized 15s backend timeout error message (zh).
// ============================================================================
      'common.backendTimeout': '后台响应超时 (15s)',
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================
      'common.relSec': '{n}s 前',
      'common.relMin': '{n}m 前',
      'common.relHour': '{n}h 前',
      'speed.title': 'Token 生成速度',
      'speed.measuredSteps': '已测 {count} 步',
      'speed.weightedAvg': '加权均速 ',
      'speed.peak': '峰值 ',
      'speed.latest': '最新步 ',
      'speed.sparkAria': '近期步骤生成速度趋势',
      'speed.lastSteps': '近 {count} 步趋势',
      'speed.empty': '暂无已测速步骤',
      'cost.title': '等效费用',
      'cost.scopeAria': '统计范围切换',
      'cost.withChildren': '含子代理',
      'cost.withChildrenCount': '含子代理 ({count})',
      'cost.mainOnly': '仅主对话',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Add isolated subagent/swarm worker cost badge label (zh).
// ============================================================================
      'cost.childIsolatedBadge': '子代理独立计费',
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
      'cost.steps': '步数 ',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Replace monthly share note key with session total token consumption key (zh).
// ============================================================================
      'cost.totalTokens': '总 Token 消耗 ',
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
      'cost.chipHitRate': '缓存命中率',
      'cost.chipOutput': '累计输出',
      'cost.chipCacheRead': '缓存读取',
      'cost.chipUncached': '未缓存输入',
      'context.title': '上下文占用监控',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/check prefixes from compact button and uppercase English prefixes from context banners (zh).
// ============================================================================
      'context.compactBtn': '压缩 /compact',
      'context.compactCopied': '已复制',
      'context.compactTitle': '复制 /compact 命令并在聊天框发送',
      'context.compactToast': '已复制 /compact，在聊天输入框 Ctrl+V 回车即可压缩上下文',
      'context.compactFailed': '复制失败，请手动在聊天框输入 /compact',
      'context.tickTitle': '提醒线: {soft} ({pct}%)',
      'context.currentTok': '当前 {tokens} tok',
      'context.limitsRow': '提醒线 {soft} · 最大窗口 {hard}',
      'context.healthy': '上下文充裕 (提醒线 {soft} 已用 {softPct}%)',
      'context.warning': '已超提醒线 ({soft})，建议适时执行 /compact',
      'context.critical': '逼近最大窗口 ({hard})，强烈建议立即执行 /compact',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:08:00
// Description: Add post-compaction banner I18N string (zh).
// ============================================================================
      'context.compactedBanner': '已压缩 · 压缩前 {preTotal} → 摘要 {summary} tok（发送下条消息后刷新精确窗口）',
// ============================================================================
// [MODIFIED END] 2026-11-17 16:08:00
// ============================================================================
      'cache.title': 'Prompt Cache 与增量诊断',
      'cache.hitRate': '命中率 {pct}%',
      'cache.chipHit': '本步缓存命中',
      'cache.chipUncached': '未命中新输入',
      'cache.chipNetDelta': '本步净增量',
      'cache.spikesTitle': '上下文增量诊断 (Top Spikes{count})',
      'cache.expandAll': '展开全部 ({count})',
      'cache.collapse': '收起',
      'cache.spikesEmpty': '暂未检测到显著上下文跃迁',
      'childrenModels.title': '子代理 / Swarm 与模型分布',
      'childrenModels.membersCount': '{count} 个关联成员',
      'childrenModels.liveSubhead': 'Subagent / Swarm 实时状态',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/dot and localize child status labels to Chinese (zh).
// ============================================================================
      'childrenModels.childGenerating': '生成中',
      'childrenModels.childRunning': '执行工具',
      'childrenModels.childIdle': '空闲',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'childrenModels.inspectBtn': '监控',
      'childrenModels.openChatBtn': '打开对话',
      'childrenModels.modelsSubhead': '按模型分布',
      'childrenModels.colModel': '模型',
      'childrenModels.colSteps': '步数',
      'childrenModels.colInput': '输入',
      'childrenModels.colCache': '缓存',
      'childrenModels.colOutput': '输出',
      'childrenModels.colTotal': '总计',
      'childrenModels.colTotalTip': '输入 + 缓存 + 输出总吞吐量',
      'childrenModels.colCost': '费用',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add model table sort direction tooltip keys (zh).
// ============================================================================
      'childrenModels.sortDescTip': '当前按{col}从高到低排序（点击切换为从低到高）',
      'childrenModels.sortAscTip': '当前按{col}从低到高排序（点击切换为从高到低）',
      'childrenModels.sortIdleTip': '点击按{col}从高到低排序',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'childrenModels.rateTip': '{model}\n计价档: {profile} ({rate})',
      'childrenModels.modelsEmpty': '暂无模型步骤分布',
      'periods.today': '今日',
      'periods.7d': '近 7 天',
      'periods.30d': '近 30 天',
      'periods.all': '全部历史',
      'periods.aria': '统计时间范围',
      'roi.title': '订阅方案节省对比',
      'roi.autoBadge': '自动识别 · {plan} ({fee}/月)',
      'roi.manualBadge': '{plan} ({fee}/月)',
      'roi.badgeTitle': '点击调整订阅档位或单价',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Refine zero-cost plan ROI headline wording for Free / Jio AI Pro (zh).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove celebratory emoji from ROI hero labels (zh).
// ============================================================================
      'roi.freeHero': '零月费已抵扣 {cost}',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'roi.freeCaption': '{period}按量等效 {cost} · 订阅成本 {zero}',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove celebratory emoji from ROI netSaved label (zh).
// ============================================================================
      'roi.netSaved': '已净省 {cost}',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'roi.multBadge': '{mult}x 回本',
      'roi.paybackPct': '回本进度 {pct}%',
      'roi.toBreakEven': '还差 {cost} 回本',
      'roi.paidCaption': '{period} Token 等效 {cost} vs 周期折算订阅 {prorated}（整月 {monthly}）',
      'global.summaryTitle': '{period}用量汇总',
      'global.stepsCount': '{count} 步',
      'global.unitAria': 'Token 数量单位切换',
      'global.kpiSessions': '涉及会话',
      'global.activeWithArchived': '活跃 {active} 天 · 含 {archived} 已归档',
      'global.activeDays': '活跃 {active} / {span} 天',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add symmetric two-line Tab 2 KPI sub-stat I18N keys (zh).
// ============================================================================
      'global.activeDaysLine': '活跃 {active} 天',
      'global.archivedLine': '含 {archived} 已归档',
      'global.kpiTotalTokens': '总吞吐 Tokens',
      'global.avgOutSub': '日均 {avg} · Out {out}',
      'global.avgSubLine': '日均 {avg}',
      'global.outSubLine': 'Out {out}',
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
      'global.kpiCacheHit': '缓存命中率',
      'global.uncachedSub': '新输入 {input}',
      'global.kpiEstCost': 'API 等效总计',
      'global.avgDailyCost': '日均 {cost}',
      'global.trendHourTitle': '24 小时分时趋势',
      'global.trendWeekTitle': '历史每周趋势',
      'global.trendDayTitle': '{period}每日趋势',
      'global.trendMetricAria': '趋势图指标',
      'global.metricCost': '费用',
      'global.metricTokens': 'Tokens',
      'global.trendPrompt': '悬停或点击柱条查看时段明细',
      'global.trendEmptyDetail': '暂无趋势数据',
      'global.trendEmpty': '当前时段暂无用量趋势数据',
      'global.bucketDetail': '{range} · 等效 {cost} · 总计 {total} tok (Out {out})',
      'global.modelsTitle': '{period}模型消耗分布',
      'global.colChats': '会话',
      'global.modelsEmpty': '当前时段暂无模型消耗记录',
      'global.convSortAria': '会话排序模式',
      'global.sortRecent': '最近活跃',
      'global.sortTop': '高消耗 Top 20',
      'global.topConvsTitle': '{period}高消耗会话 ({count})',
      'global.recentConvsTitle': '近期会话列表 ({count})',
      'global.badgeArchived': '已归档',
      'global.badgeToday': '今日',
      'global.openChat': '跳转对话',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot from Tab 2 conversation status labels (zh).
// ============================================================================
      'global.itemGenerating': '生成中',
      'global.itemTools': '执行工具',
      'global.itemIdle': '空闲',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'global.convsEmpty': '暂无匹配会话记录',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Add Tab 2 per-conversation total token prefix i18n key (zh).
// ============================================================================
      'global.itemTotalPrefix': '总计',
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
      'settings.title': '计价与上下文设置',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Standardize Chinese terminology to 现役模型 in settings subtitle.
// ============================================================================
      'settings.subtitle': '按现役模型自动细分计价 · 订阅对比实时重算',
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
      'settings.sec1Title': '上下文与币种',
      'settings.softLimitLabel': '提醒线 (tokens)',
      'settings.hardLimitLabel': '最大窗口 (tokens)',
      'settings.tokenUnitLabel': 'Token 显示单位',
      'settings.unitAuto': 'K / M / B (自动缩放)',
      'settings.unitWanYi': '万 / 亿 (中文单位)',
      'settings.unitExact': '1,234,567 (精确整数)',
      'settings.unitM': '固定 M (百万)',
      'settings.currencyLabel': '货币单位',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:47:00
// Description: Add FX sync mode and synced FX status i18n keys (zh).
// ============================================================================
      'settings.cnyRateModeLabel': '汇率更新方式',
      'settings.cnyModeAuto': '每日自动联网同步',
      'settings.cnyModeManual': '手动固定汇率',
      'settings.cnyAutoTitle': '当前为每日自动同步模式；如需自定义请将汇率更新方式切换为「手动固定汇率」',
      'settings.syncFxPart': ' · 汇率 {rate}',
// ============================================================================
// [MODIFIED END] 2026-11-17 15:47:00
// ============================================================================
      'settings.cnyRateLabel': '汇率 (1 USD = ? CNY)',
      'settings.sec2Title': '当前订阅方案',
      'settings.subPlanLabel': '订阅档位',
      'settings.subAuto': '自动识别 (推荐)',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add Jio AI Pro subscription plan option i18n key (zh).
// ============================================================================
      'settings.subJioPro': 'Jio AI Pro ($0 / 月 · 运营商赠礼)',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'settings.subFree': 'Free ($0 / 月)',
      'settings.subPro': 'Google AI Pro ($19.99 / 月)',
      'settings.subUltra5x': 'Google AI Ultra 5x ($99.99 / 月)',
      'settings.subUltra20x': 'Google AI Ultra 20x ($199.99 / 月)',
      'settings.subCustom': '自定义月费',
      'settings.subCustomLabel': '自定义月费 (USD / 月)',
      'settings.subDetectedHint': '当前自动识别结果: {plan} (${usd}/月)',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Standardize Chinese terminology to 现役模型 in section 3 title and catalog summary.
// ============================================================================
      'settings.sec3Title': '现役模型单价配置 (USD / 1M Tokens)',
      'settings.resetModel': '恢复此模型默认',
      'settings.resetAllModels': '全部恢复默认',
      'settings.modelSelectLabel': '选择模型档位 (保存前可连续切换修改多个模型)',
      'settings.inputPriceLabel': 'Input / 1M ($)',
      'settings.cachedPriceLabel': 'Cached / 1M ($)',
      'settings.outputPriceLabel': 'Output / 1M ($)',
      'settings.longTierPrefix': '>200k 长上下文阶梯倍乘',
      'settings.longTierHint': '(超过 200k 时输入 ×2、输出 ×1.5)',
      'settings.catalogSummary': '查看全部现役模型当前生效单价',
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
      'settings.catalogModelCol': '模型档位',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Add interactive catalog row tooltip and official pricing sync i18n keys (zh).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:47:00
// Description: Mention FX synchronization in sync button tooltips & toasts (zh).
// ============================================================================
      'settings.catalogRowTip': '点击切换并编辑此模型单价',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove Unicode refresh symbol from pricing sync button labels (zh).
// ============================================================================
      'settings.syncPricingBtn': '立即同步',
      'settings.syncPricingTitle': '立即同步官方模型单价与最新 USD/CNY 汇率',
      'settings.syncingBtn': '同步中…',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'settings.syncingOfficial': '正在同步官方定价与最新汇率…',
      'settings.syncDiscoveredPart': ' · +{count} 模型',
      'settings.syncOk': '已同步官方定价{fx} · {date} ({sources}){discovered}',
      'settings.syncCachedBaseline': '使用缓存定价基线{fx} (上次同步 {date})',
      'settings.syncBuiltinBaseline': '使用内置基线{fx}（联网每日自动同步）',
      'settings.syncSuccessToast': '已同步官方最新模型单价与汇率',
      'settings.syncSuccessDiscoveredToast': '已同步官方定价与汇率，并发现 {count} 个新模型',
      'settings.syncOfflineHint': '无法连接官方数据源，保留当前基线',
      'settings.syncFailedToast': '定价同步未完成: {msg}',
// ============================================================================
// [MODIFIED END] 2026-11-17 15:47:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
      'settings.resyncIdle': '按磁盘重新同步账本',
      'settings.resyncTitle': '清除已删除会话归档并按磁盘现有日志重建历史账本',
      'settings.resyncArmed': '再次点击确认按磁盘重建',
      'settings.resyncSyncing': '正在同步磁盘日志…',
      'settings.resyncDone': '已同步 {count} 个磁盘会话',
      'settings.resyncFailed': '同步失败: {msg}',
      'settings.cancel': '收起',
      'settings.save': '保存设置',
      'settings.errSoftLimit': '提醒线需 >= 1000',
      'settings.errHardLimit': '最大窗口需 >= 提醒线',
      'settings.errCnyRate': '汇率必须大于 0',
      'settings.errCustomSub': '自定义月费需为非负数字',
      'settings.errPrices': '单价必须为有效非负数字',
      'settings.saving': '保存中…',
      'settings.saveFailedDefault': '保存失败',
      'settings.saveFailed': '保存失败: {msg}',
      'settings.savedToast': '计价与上下文设置已保存',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:57:00
// Description: Add v0.2.4 release update pill, settings version check bar, and hot-update modal i18n keys (zh).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove Unicode refresh symbol from update check button labels (zh).
// ============================================================================
      'settings.checkUpdateBtn': '检查更新',
      'settings.checkUpdateTitle': '立即检查 GitHub Release 最新版本',
      'settings.checkingUpdateBtn': '检查中…',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'settings.verChecking': '检查中...',
      'settings.verUpToDate': '当前版本 v{cur} · 已是最新',
      'settings.verAvailable': '当前版本 v{cur} · 可升级至 {tag}',
      'settings.verSkipped': '当前版本 v{cur} · 已跳过 {tag}（点击查看）',
      'settings.verCheckError': '当前版本 v{cur} · 检查更新未完成',
      'settings.upToDateToast': '已是最新版本 (v{cur})',
      'settings.checkUpdateFailedToast': '检查更新失败: {msg}',
      'update.pillText': '↑ v{ver}',
      'update.pillTitle': '发现新版本 {tag}，点击查看更新内容',
      'update.modalTitle': '发现新版本',
      'update.verRange': 'v{cur} → v{next}',
      'update.publishedAt': '发布于 {date}',
      'update.closeTip': '仅收起，保留顶栏提示按钮',
      'update.skipBtn': '跳过此版本',
      'update.skipToast': '已跳过 {tag}，将在下个新版本发布时再提醒',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Switch update flow messages to plain-language wording (zh).
// ============================================================================
      'update.confirmBtn': '立即更新',
      'update.confirmApplying': '正在更新…',
      'update.downloading': '正在下载更新包并校验完整性...',
      'update.restarting': '正在应用更新并刷新面板...',
      'update.applyFailed': '更新未完成：{msg}',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove leading check symbol from update toast (zh).
// ============================================================================
      'update.updatedToast': '已更新至 v{ver}',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      'update.fallbackLink': '前往 GitHub Release 手动下载',
      'update.emptyNotes': '暂无详细更新说明，可前往 GitHub Release 查看详情。',
// ============================================================================
// [MODIFIED END] 2026-11-17 18:57:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Add localized update timeout, rate-limit, and network diagnostic keys (zh).
// ============================================================================
      'update.errTimeout': '连接更新源超时，请检查网络或系统代理设置',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Use plain-language wording for update server rate-limit error (zh).
// ============================================================================
      'update.errRateLimit': '更新服务器访问过于频繁，请稍后再试',
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      'update.errNetwork': '无法连接更新服务器，请检查网络或代理设置',
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Add v0.3.0 proxy diagnostic tooltip i18n keys (zh).
// ============================================================================
      'settings.proxyDiagActive': '代理: {url} ({source})',
      'settings.proxyDiagDirect': '直连模式 (未检测到系统代理)',
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:40:30
// Description: Add v0.2.9 Top-5 subagent/swarm folding, Ended badge, and session checkout receipt modal i18n keys (zh).
// ============================================================================
      'childrenModels.liveSubheadFolded': 'Subagent / Swarm 实时状态 (近期活跃 {shown}/{total})',
      'childrenModels.expandAll': '展开全部 ({count})',
      'childrenModels.collapse': '收起',
      'childrenModels.expandMoreFooter': '展开其余 {rest} 个成员（共 {total} 个）',
      'childrenModels.collapseFooter': '收起列表（仅展示前 {shown} 个近期活跃）',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove leading dot/emoji from childEnded and receipt.checkoutBtn (zh).
// ============================================================================
      'childrenModels.childEnded': '已结束',
      'receipt.checkoutBtn': '结账',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'receipt.checkoutTitle': '生成当前会话收工票根 (PNG)',
      'receipt.modalTitle': '会话结账票根',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Update receipt i18n strings for direct clipboard copy in v0.3.1 (zh).
// ============================================================================
      'receipt.modalHint': '点击下方按钮即可直接复制高清票根图片到剪贴板',
      'receipt.closeTip': '关闭票根预览',
      'receipt.scopeAria': '票根统计范围',
      'receipt.detailAria': '票根明细模式',
      'receipt.scopeToday': '今日收工',
      'receipt.scopeAll': '全程累计',
      'receipt.modeCompact': '精简',
      'receipt.modeFull': '完整',
      'receipt.copyBtn': '复制小票图片',
      'receipt.copyingBtn': '正在复制...',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove leading check symbol from receipt.copiedToast (zh).
// ============================================================================
      'receipt.copiedToast': '小票图片已复制到剪贴板',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'receipt.copyFailedToast': '复制小票图片失败：{msg}',
      'receipt.unavailableToast': '当前暂无可生成票根的会话数据',
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:40:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Add Pixel Office bilingual i18n keys (zh).
// ============================================================================
      'pixelOffice.title': '像素工位',
      'pixelOffice.slotsMainOnly': '1 主工位',
      'pixelOffice.slotsCount': '1 主 + {count} 子',
      'pixelOffice.overflowPill': '+{count}',
      'pixelOffice.overflowTitle': '另有 {count} 个成员未入驻工位，点击展开完整子代理列表',
      'pixelOffice.collapse': '收起',
      'pixelOffice.expand': '展开',
      'pixelOffice.clickHint': '点击工位猫咪查看实时状态与快速跳转',
      'pixelOffice.mainRole': '主代理',
      'pixelOffice.kindMain': '主对话',
      'pixelOffice.kindSwarm': 'Swarm',
      'pixelOffice.kindSubagent': 'Subagent',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot from Pixel Office status labels (zh).
// ============================================================================
      'pixelOffice.statusGenerating': '生成中',
      'pixelOffice.statusTools': '执行工具',
      'pixelOffice.statusToolsLabel': '{tool}',
      'pixelOffice.statusIdle': '待命中',
      'pixelOffice.statusEnded': '已结束',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'pixelOffice.closeInspector': '关闭工位详情',
      'pixelOffice.backToMain': '返回当前对话',
      'pixelOffice.inspectBtn': '监控详情',
      'pixelOffice.openChatBtn': '打开会话',
      'pixelOffice.statCtx': 'Ctx',
      'pixelOffice.statSpeed': '速度',
      'pixelOffice.statOut': '输出',
      'pixelOffice.statCost': '费用',
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:10
// Description: Add v0.4.1 per-model cache hit column and Side Questions i18n keys (zh).
// ============================================================================
      'childrenModels.colCacheHit': '命中率',
      'childrenModels.colCacheHitTip': '缓存命中率 = 缓存读取 / (未缓存输入 + 缓存读取)',
      'childrenModels.colCacheHitCellTip': '缓存读取 {cached} / 总输入 {totalIn} ({pct})',
      'sideQuestions.title': '支线问题',
      'sideQuestions.countBadge': '{count} 条',
      'sideQuestions.summaryMeta': '{tokens} · {cost}',
      'sideQuestions.summaryTip': '共 {count} 条支线增量 · {steps} 步 · 缓存命中 {hit}（已剔除主会话克隆历史）',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove Unicode arrows from sideQuestions open/back buttons and add table.costWithCurrency key (zh).
// ============================================================================
      'sideQuestions.openBtn': '打开会话',
      'sideQuestions.openTip': '在 Antigravity 中一键打开此支线会话',
      'sideQuestions.inspectTip': '点击在监控面板内查看此支线详情',
      'sideQuestions.expandAll': '展开全部 ({count})',
      'sideQuestions.collapse': '收起',
      'sideQuestions.expandMoreFooter': '展开其余 {rest} 条支线（共 {total} 条）',
      'sideQuestions.collapseFooter': '收起至最近活跃 Top {shown}',
      'sideQuestions.badge': '支线问题',
      'sideQuestions.viewingBanner': '支线问题：{label}',
      'sideQuestions.backToParent': '返回主对话',
      'sideQuestions.isolatedCostBadge': '支线独立计费',
      'sideQuestions.hitStat': '命中 {pct}',
      'table.costWithCurrency': '费用 ({currency})',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: Add v0.5.1 bilingual i18n keys for cache track tooltip (B6), By Project table (C1), and Tab 2 session search/filter bar (C2) (zh).
// ============================================================================
      'cache.trackTip': '缓存读取 {cached} / 未缓存输入 {uncached}',
      'projects.title': '按项目分布 · {period}',
      'projects.colProject': '项目',
      'projects.colChats': '会话',
      'projects.ungrouped': '未分组',
      'projects.empty': '该周期内暂无项目用量记录',
      'projects.expandMoreFooter': '展开其余 {rest} 个项目（共 {total} 个）',
      'projects.collapseFooter': '收起至前 {shown} 个项目',
      'global.searchPlaceholder': '搜索会话标题或项目...',
      'global.searchAria': '搜索会话列表',
      'global.filterAllModels': '全部模型',
      'global.filterModelAria': '按模型筛选会话',
      'global.filterActiveOnly': '只看进行中',
      'global.filterEmpty': '没有符合筛选条件的会话',
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:10
// ============================================================================
    },
    en: {
      'header.waiting': 'Waiting',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot from header status labels (en).
// ============================================================================
      'header.generating': 'Generating',
      'header.tools': 'Tools',
      'header.idle': 'Idle',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'header.currentModel': 'Current Model',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Align English header model tooltip prefix with header.currentModel (Current Model).
// ============================================================================
      'header.modelTitle': 'Current Model: {model}',
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
      'header.settingsLabel': 'Pricing & Context Settings',
      'header.nonboundRegion': 'Non-bound conversation notice',
      'header.viewingDefault': 'Viewing another session',
      'header.viewing': 'Viewing: {label}',
      'header.backToCurrent': 'Back to Current',
      'tabs.navLabel': 'Monitor views',
      'tabs.current': 'Current',
      'tabs.global': 'Analytics',
      'empty.title': 'No Active Session Data',
      'empty.desc': 'Waiting for the first model step in this chat, or open Analytics to inspect historical sessions.',
      'empty.gotoGlobal': 'Open Analytics',
      'common.sessionPrefix': 'Session {id}',
      'common.standaloneOpenHint': 'Cannot focus host chat in standalone browser mode; switched to monitor view',
      'common.fetchErrorPrefix': 'Failed to fetch metrics: {msg}',
      'common.backendConnFailed': 'Backend connection failed',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Add localized 15s backend timeout error message (en).
// ============================================================================
      'common.backendTimeout': 'Backend response timed out (15s)',
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================
      'common.relSec': '{n}s ago',
      'common.relMin': '{n}m ago',
      'common.relHour': '{n}h ago',
      'speed.title': 'Generation Speed',
      'speed.measuredSteps': '{count} steps',
      'speed.weightedAvg': 'Weighted Avg ',
      'speed.peak': 'Peak ',
      'speed.latest': 'Latest ',
      'speed.sparkAria': 'Recent step generation speed trend',
      'speed.lastSteps': 'Last {count} steps',
      'speed.empty': 'No timed steps yet',
      'cost.title': 'Equivalent Cost',
      'cost.scopeAria': 'Cost scope',
      'cost.withChildren': 'With Subagents',
      'cost.withChildrenCount': 'With Subagents ({count})',
      'cost.mainOnly': 'Main Only',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Add isolated subagent/swarm worker cost badge label (en).
// ============================================================================
      'cost.childIsolatedBadge': 'Subagent Only',
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
      'cost.steps': 'Steps ',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Replace monthly share note key with session total token consumption key (en).
// ============================================================================
      'cost.totalTokens': 'Total Tokens ',
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
      'cost.chipHitRate': 'Cache Hit',
      'cost.chipOutput': 'Total Output',
      'cost.chipCacheRead': 'Cache Read',
      'cost.chipUncached': 'Uncached In',
      'context.title': 'Context Usage',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/check prefixes from compact button and uppercase prefixes from context banners (en).
// ============================================================================
      'context.compactBtn': 'Compact',
      'context.compactCopied': 'Copied',
      'context.compactTitle': 'Copy /compact command to paste in chat',
      'context.compactToast': 'Copied /compact — paste (Ctrl+V) and press Enter in chat',
      'context.compactFailed': 'Copy failed — please type /compact in chat',
      'context.tickTitle': 'Alert limit: {soft} ({pct}%)',
      'context.currentTok': 'Current {tokens} tok',
      'context.limitsRow': 'Alert {soft} · Max {hard}',
      'context.healthy': 'Context healthy ({softPct}% of {soft} alert limit)',
      'context.warning': 'Exceeded {soft} alert limit — consider /compact',
      'context.critical': 'Approaching {hard} max window — run /compact now',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:08:00
// Description: Add post-compaction banner I18N string (en).
// ============================================================================
      'context.compactedBanner': 'Compacted · {preTotal} → {summary} tok summary (exact context updates on next message)',
// ============================================================================
// [MODIFIED END] 2026-11-17 16:08:00
// ============================================================================
      'cache.title': 'Prompt Cache & Spikes',
      'cache.hitRate': 'Hit Rate {pct}%',
      'cache.chipHit': 'Step Cache Hit',
      'cache.chipUncached': 'Uncached Input',
      'cache.chipNetDelta': 'Net Delta',
      'cache.spikesTitle': 'Top Context Spikes{count}',
      'cache.expandAll': 'Expand All ({count})',
      'cache.collapse': 'Collapse',
      'cache.spikesEmpty': 'No significant context spikes detected',
      'childrenModels.title': 'Subagents / Swarm & Models',
      'childrenModels.membersCount': '{count} members',
      'childrenModels.liveSubhead': 'Live Subagents / Swarm',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot from child status labels (en).
// ============================================================================
      'childrenModels.childGenerating': 'Generating',
      'childrenModels.childRunning': 'Running',
      'childrenModels.childIdle': 'Idle',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'childrenModels.inspectBtn': 'Inspect',
      'childrenModels.openChatBtn': 'Open Chat',
      'childrenModels.modelsSubhead': 'By Model',
      'childrenModels.colModel': 'Model',
      'childrenModels.colSteps': 'Steps',
      'childrenModels.colInput': 'Input',
      'childrenModels.colCache': 'Cache',
      'childrenModels.colOutput': 'Output',
      'childrenModels.colTotal': 'Total',
      'childrenModels.colTotalTip': 'Input + Cache + Output total throughput',
      'childrenModels.colCost': 'Cost',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add model table sort direction tooltip keys (en).
// ============================================================================
      'childrenModels.sortDescTip': 'Sorted by {col}: High → Low (click for Low → High)',
      'childrenModels.sortAscTip': 'Sorted by {col}: Low → High (click for High → Low)',
      'childrenModels.sortIdleTip': 'Click to sort by {col} (High → Low)',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'childrenModels.rateTip': '{model}\nTier: {profile} ({rate})',
      'childrenModels.modelsEmpty': 'No model breakdown yet',
      'periods.today': 'Today',
      'periods.7d': '7 Days',
      'periods.30d': '30 Days',
      'periods.all': 'All Time',
      'periods.aria': 'Time range',
      'roi.title': 'Subscription ROI',
      'roi.autoBadge': 'Auto · {plan} ({fee}/mo)',
      'roi.manualBadge': '{plan} ({fee}/mo)',
      'roi.badgeTitle': 'Click to configure plan or pricing',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Refine zero-cost plan ROI headline wording for Free / Jio AI Pro (en).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove celebratory emoji from ROI hero labels (en).
// ============================================================================
      'roi.freeHero': '$0 plan covered {cost}',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'roi.freeCaption': '{period} est. API {cost} · Plan cost {zero}',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove celebratory emoji from ROI netSaved label (en).
// ============================================================================
      'roi.netSaved': 'Net Saved {cost}',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'roi.multBadge': '{mult}x ROI',
      'roi.paybackPct': 'Payback {pct}%',
      'roi.toBreakEven': '{cost} to break even',
      'roi.paidCaption': '{period} API value {cost} vs prorated plan {prorated} ({monthly}/mo)',
      'global.summaryTitle': '{period} Usage Summary',
      'global.stepsCount': '{count} steps',
      'global.unitAria': 'Token unit switcher',
      'global.kpiSessions': 'Sessions',
      'global.activeWithArchived': 'Active {active}d · {archived} archived',
      'global.activeDays': 'Active {active} / {span} d',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add symmetric two-line Tab 2 KPI sub-stat I18N keys (en).
// ============================================================================
      'global.activeDaysLine': 'Active {active}d',
      'global.archivedLine': '{archived} archived',
      'global.kpiTotalTokens': 'Total Tokens',
      'global.avgOutSub': 'Avg/d {avg} · Out {out}',
      'global.avgSubLine': 'Avg/d {avg}',
      'global.outSubLine': 'Out {out}',
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
      'global.kpiCacheHit': 'Cache Hit',
      'global.uncachedSub': 'Uncached {input}',
      'global.kpiEstCost': 'Est. API Cost',
      'global.avgDailyCost': 'Avg {cost}/d',
      'global.trendHourTitle': '24h Hourly Trend',
      'global.trendWeekTitle': 'Weekly Trend',
      'global.trendDayTitle': '{period} Daily Trend',
      'global.trendMetricAria': 'Trend metric',
      'global.metricCost': 'Cost',
      'global.metricTokens': 'Tokens',
      'global.trendPrompt': 'Hover or click a bar to inspect',
      'global.trendEmptyDetail': 'No trend data',
      'global.trendEmpty': 'No usage trend data for this period',
      'global.bucketDetail': '{range} · Cost {cost} · Total {total} tok (Out {out})',
      'global.modelsTitle': '{period} Model Breakdown',
      'global.colChats': 'Chats',
      'global.modelsEmpty': 'No model usage in this period',
      'global.convSortAria': 'Conversation sort order',
      'global.sortRecent': 'Recent',
      'global.sortTop': 'Top 20 Cost',
      'global.topConvsTitle': '{period} Top Cost ({count})',
      'global.recentConvsTitle': 'Recent Sessions ({count})',
      'global.badgeArchived': 'Archived',
      'global.badgeToday': 'Today',
      'global.openChat': 'Open Chat',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot from Tab 2 conversation status labels (en).
// ============================================================================
      'global.itemGenerating': 'Generating',
      'global.itemTools': 'Tools',
      'global.itemIdle': 'Idle',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'global.convsEmpty': 'No matching conversations',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Add Tab 2 per-conversation total token prefix i18n key (en).
// ============================================================================
      'global.itemTotalPrefix': 'Total',
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
      'settings.title': 'Pricing & Context Settings',
      'settings.subtitle': 'Per-model pricing tiers · Live subscription ROI',
      'settings.sec1Title': 'Context & Display',
      'settings.softLimitLabel': 'Alert Limit (tokens)',
      'settings.hardLimitLabel': 'Max Window (tokens)',
      'settings.tokenUnitLabel': 'Token Unit',
      'settings.unitAuto': 'K / M / B (Auto)',
      'settings.unitWanYi': '万 / 亿 (10k / 100M)',
      'settings.unitExact': '1,234,567 (Exact)',
      'settings.unitM': 'Fixed M (Millions)',
      'settings.currencyLabel': 'Currency',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:47:00
// Description: Add FX sync mode and synced FX status i18n keys (en).
// ============================================================================
      'settings.cnyRateModeLabel': 'FX Rate Mode',
      'settings.cnyModeAuto': 'Auto-Sync Daily',
      'settings.cnyModeManual': 'Manual Fixed Rate',
      'settings.cnyAutoTitle': 'Managed automatically via daily online sync; switch FX Rate Mode to Manual Fixed Rate to edit',
      'settings.syncFxPart': ' · FX {rate}',
// ============================================================================
// [MODIFIED END] 2026-11-17 15:47:00
// ============================================================================
      'settings.cnyRateLabel': 'FX Rate (1 USD = ? CNY)',
      'settings.sec2Title': 'Subscription Plan',
      'settings.subPlanLabel': 'Plan Tier',
      'settings.subAuto': 'Auto-Detect (Recommended)',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add Jio AI Pro subscription plan option i18n key (en).
// ============================================================================
      'settings.subJioPro': 'Jio AI Pro ($0 / mo · Carrier Plan)',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'settings.subFree': 'Free ($0 / mo)',
      'settings.subPro': 'Google AI Pro ($19.99 / mo)',
      'settings.subUltra5x': 'Google AI Ultra 5x ($99.99 / mo)',
      'settings.subUltra20x': 'Google AI Ultra 20x ($199.99 / mo)',
      'settings.subCustom': 'Custom Monthly Fee',
      'settings.subCustomLabel': 'Custom Fee (USD / mo)',
      'settings.subDetectedHint': 'Auto-detected plan: {plan} (${usd}/mo)',
      'settings.sec3Title': 'Model Pricing Overrides (USD / 1M Tokens)',
      'settings.resetModel': 'Reset Model',
      'settings.resetAllModels': 'Reset All',
      'settings.modelSelectLabel': 'Select Model Profile (switch & edit multiple before saving)',
      'settings.inputPriceLabel': 'Input / 1M ($)',
      'settings.cachedPriceLabel': 'Cached / 1M ($)',
      'settings.outputPriceLabel': 'Output / 1M ($)',
      'settings.longTierPrefix': '>200k Long-Context Multiplier',
      'settings.longTierHint': '(Input ×2, Output ×1.5 above 200k)',
      'settings.catalogSummary': 'View All Effective Model Rates',
      'settings.catalogModelCol': 'Model Tier',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Add interactive catalog row tooltip and official pricing sync i18n keys (en).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Mention FX synchronization in sync button tooltips & toasts (en).
// ============================================================================
      'settings.catalogRowTip': 'Click to edit this model pricing',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove Unicode refresh symbol from pricing sync button labels (en).
// ============================================================================
      'settings.syncPricingBtn': 'Sync Now',
      'settings.syncPricingTitle': 'Sync latest official model rates & USD/CNY FX rate now',
      'settings.syncingBtn': 'Syncing…',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'settings.syncingOfficial': 'Syncing official pricing & FX rate…',
      'settings.syncDiscoveredPart': ' · +{count} new',
      'settings.syncOk': 'Official pricing synced{fx} · {date} ({sources}){discovered}',
      'settings.syncCachedBaseline': 'Using cached pricing{fx} (synced {date})',
      'settings.syncBuiltinBaseline': 'Using built-in baseline{fx} (auto-syncs daily online)',
      'settings.syncSuccessToast': 'Official models, pricing & FX rate synced',
      'settings.syncSuccessDiscoveredToast': 'Synced official pricing & FX (+{count} new models)',
      'settings.syncOfflineHint': 'Upstream unreachable; keeping current baseline',
      'settings.syncFailedToast': 'Pricing sync incomplete: {msg}',
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
      'settings.resyncIdle': 'Resync Ledger from Disk',
      'settings.resyncTitle': 'Clear archived entries and rebuild ledger from disk logs',
      'settings.resyncArmed': 'Click Again to Confirm',
      'settings.resyncSyncing': 'Syncing disk logs…',
      'settings.resyncDone': 'Synced {count} disk conversations',
      'settings.resyncFailed': 'Sync failed: {msg}',
      'settings.cancel': 'Close',
      'settings.save': 'Save',
      'settings.errSoftLimit': 'Alert limit must be >= 1000',
      'settings.errHardLimit': 'Max window must be >= alert limit',
      'settings.errCnyRate': 'FX rate must be > 0',
      'settings.errCustomSub': 'Custom fee must be a non-negative number',
      'settings.errPrices': 'Prices must be valid non-negative numbers',
      'settings.saving': 'Saving…',
      'settings.saveFailedDefault': 'Save failed',
      'settings.saveFailed': 'Save failed: {msg}',
      'settings.savedToast': 'Pricing & context settings saved',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:57:00
// Description: Add v0.2.4 release update pill, settings version check bar, and hot-update modal i18n keys (en).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove Unicode refresh symbol from update check button labels (en).
// ============================================================================
      'settings.checkUpdateBtn': 'Check Update',
      'settings.checkUpdateTitle': 'Check GitHub Releases for updates now',
      'settings.checkingUpdateBtn': 'Checking…',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'settings.verChecking': 'Checking for updates...',
      'settings.verUpToDate': 'Current v{cur} · Up to date',
      'settings.verAvailable': 'Current v{cur} · Upgrade to {tag}',
      'settings.verSkipped': 'Current v{cur} · Skipped {tag} (click to view)',
      'settings.verCheckError': 'Current v{cur} · Update check offline',
      'settings.upToDateToast': 'Already on the latest version (v{cur})',
      'settings.checkUpdateFailedToast': 'Update check failed: {msg}',
      'update.pillText': '↑ v{ver}',
      'update.pillTitle': 'New release {tag} available — click to view changes',
      'update.modalTitle': 'Update Available',
      'update.verRange': 'v{cur} → v{next}',
      'update.publishedAt': 'Published {date}',
      'update.closeTip': 'Dismiss dialog (keep header update pill)',
      'update.skipBtn': 'Skip Version',
      'update.skipToast': 'Skipped {tag} — will notify on the next release',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Switch update flow messages to plain-language wording (en).
// ============================================================================
      'update.confirmBtn': 'Update Now',
      'update.confirmApplying': 'Updating…',
      'update.downloading': 'Downloading & verifying update package...',
      'update.restarting': 'Applying update & reloading panel...',
      'update.applyFailed': 'Update failed: {msg}',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove leading check symbol from update toast (en).
// ============================================================================
      'update.updatedToast': 'Updated to v{ver}',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      'update.fallbackLink': 'Download on GitHub Releases',
      'update.emptyNotes': 'No release notes provided. View details on GitHub Releases.',
// ============================================================================
// [MODIFIED END] 2026-11-17 18:57:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Add localized update timeout, rate-limit, and network diagnostic keys (en).
// ============================================================================
      'update.errTimeout': 'Connection timed out — please check your network or system proxy',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Use plain-language wording for update server rate-limit error (en).
// ============================================================================
      'update.errRateLimit': 'Update server is temporarily busy — please try again shortly',
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      'update.errNetwork': 'Unable to reach update server — please check your network or proxy',
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Add v0.3.0 proxy diagnostic tooltip i18n keys (en).
// ============================================================================
      'settings.proxyDiagActive': 'Proxy: {url} ({source})',
      'settings.proxyDiagDirect': 'Direct connection (no proxy detected)',
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:40:30
// Description: Add v0.2.9 Top-5 subagent/swarm folding, Ended badge, and session checkout receipt modal i18n keys (en).
// ============================================================================
      'childrenModels.liveSubheadFolded': 'Live Subagents / Swarm (Active {shown}/{total})',
      'childrenModels.expandAll': 'Expand All ({count})',
      'childrenModels.collapse': 'Collapse',
      'childrenModels.expandMoreFooter': 'Show {rest} more ({total} total)',
      'childrenModels.collapseFooter': 'Collapse (show top {shown} recent)',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove leading dot/emoji from childEnded and receipt.checkoutBtn (en).
// ============================================================================
      'childrenModels.childEnded': 'Ended',
      'receipt.checkoutBtn': 'Checkout',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'receipt.checkoutTitle': 'Generate session checkout receipt (PNG)',
      'receipt.modalTitle': 'Session Receipt',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Update receipt i18n strings for direct clipboard copy in v0.3.1 (en).
// ============================================================================
      'receipt.modalHint': 'Click below to copy the HD PNG receipt directly to your clipboard',
      'receipt.closeTip': 'Close receipt preview',
      'receipt.scopeAria': 'Receipt time scope',
      'receipt.detailAria': 'Receipt detail mode',
      'receipt.scopeToday': 'Today',
      'receipt.scopeAll': 'All-Time',
      'receipt.modeCompact': 'Compact',
      'receipt.modeFull': 'Full',
      'receipt.copyBtn': 'Copy Receipt Image',
      'receipt.copyingBtn': 'Copying...',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove leading check symbol from receipt.copiedToast (en).
// ============================================================================
      'receipt.copiedToast': 'Receipt image copied to clipboard',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'receipt.copyFailedToast': 'Failed to copy receipt image: {msg}',
      'receipt.unavailableToast': 'No active session data available for receipt',
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:40:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Add Pixel Office bilingual i18n keys (en).
// ============================================================================
      'pixelOffice.title': 'Pixel Office',
      'pixelOffice.slotsMainOnly': '1 Main',
      'pixelOffice.slotsCount': '1 Main + {count} Sub',
      'pixelOffice.overflowPill': '+{count}',
      'pixelOffice.overflowTitle': '{count} more members — click to expand full Subagents list',
      'pixelOffice.collapse': 'Collapse',
      'pixelOffice.expand': 'Expand',
      'pixelOffice.clickHint': 'Click any cat workstation to inspect & jump',
      'pixelOffice.mainRole': 'Main',
      'pixelOffice.kindMain': 'Main',
      'pixelOffice.kindSwarm': 'Swarm',
      'pixelOffice.kindSubagent': 'Subagent',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove emoji/leading dot from Pixel Office status labels (en).
// ============================================================================
      'pixelOffice.statusGenerating': 'Generating',
      'pixelOffice.statusTools': 'Running Tools',
      'pixelOffice.statusToolsLabel': '{tool}',
      'pixelOffice.statusIdle': 'Idle',
      'pixelOffice.statusEnded': 'Ended',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
      'pixelOffice.closeInspector': 'Close workstation inspector',
      'pixelOffice.backToMain': 'Back to Current',
      'pixelOffice.inspectBtn': 'Inspect',
      'pixelOffice.openChatBtn': 'Open Chat',
      'pixelOffice.statCtx': 'Ctx',
      'pixelOffice.statSpeed': 'Speed',
      'pixelOffice.statOut': 'Out',
      'pixelOffice.statCost': 'Cost',
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:10
// Description: Add v0.4.1 per-model cache hit column and Side Questions i18n keys (en).
// ============================================================================
      'childrenModels.colCacheHit': 'Hit %',
      'childrenModels.colCacheHitTip': 'Cache hit rate = Cache Read / (Uncached Input + Cache Read)',
      'childrenModels.colCacheHitCellTip': 'Cache Read {cached} / Total Input {totalIn} ({pct})',
      'sideQuestions.title': 'Side Questions',
      'sideQuestions.countBadge': '{count}',
      'sideQuestions.summaryMeta': '{tokens} · {cost}',
      'sideQuestions.summaryTip': '{count} side questions incremental · {steps} steps · {hit} cache hit (cloned parent history excluded)',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:19:50
// Description: Remove Unicode arrows from sideQuestions open/back buttons and add table.costWithCurrency key (en).
// ============================================================================
      'sideQuestions.openBtn': 'Open',
      'sideQuestions.openTip': 'Open this side question conversation in Antigravity',
      'sideQuestions.inspectTip': 'Click to inspect this side question inside Token Monitor',
      'sideQuestions.expandAll': 'Show All ({count})',
      'sideQuestions.collapse': 'Collapse',
      'sideQuestions.expandMoreFooter': 'Show {rest} more side questions ({total} total)',
      'sideQuestions.collapseFooter': 'Collapse to Top {shown} Recent',
      'sideQuestions.badge': 'Side Q',
      'sideQuestions.viewingBanner': 'Side Question: {label}',
      'sideQuestions.backToParent': 'Back to Main Chat',
      'sideQuestions.isolatedCostBadge': 'Side Question Only',
      'sideQuestions.hitStat': 'Hit {pct}',
      'table.costWithCurrency': 'Cost ({currency})',
// ============================================================================
// [MODIFIED END] 2026-11-20 10:19:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: Add v0.5.1 bilingual i18n keys for cache track tooltip (B6), By Project table (C1), and Tab 2 session search/filter bar (C2) (en).
// ============================================================================
      'cache.trackTip': 'Cache Read {cached} / Uncached {uncached}',
      'projects.title': 'By Project · {period}',
      'projects.colProject': 'Project',
      'projects.colChats': 'Chats',
      'projects.ungrouped': 'Ungrouped',
      'projects.empty': 'No project usage in this period',
      'projects.expandMoreFooter': 'Show {rest} more projects ({total} total)',
      'projects.collapseFooter': 'Collapse to Top {shown} Projects',
      'global.searchPlaceholder': 'Search chats or projects...',
      'global.searchAria': 'Search sessions',
      'global.filterAllModels': 'All Models',
      'global.filterModelAria': 'Filter sessions by model',
      'global.filterActiveOnly': 'Active only',
      'global.filterEmpty': 'No sessions match the current filters',
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:10
// ============================================================================
    },
  };

  const PLAN_LABELS = {
    zh: {
      auto: '自动识别',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add Jio AI Pro label to zh and en PLAN_LABELS maps.
// ============================================================================
      jio_pro: 'Jio AI Pro',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      free: 'Free',
      pro: 'Google AI Pro',
      ultra_5x: 'Google AI Ultra 5x',
      ultra_20x: 'Google AI Ultra 20x',
      custom: '自定义月费',
    },
    en: {
      auto: 'Auto',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add Jio AI Pro label to en PLAN_LABELS map.
// ============================================================================
      jio_pro: 'Jio AI Pro',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      free: 'Free',
      pro: 'Google AI Pro',
      ultra_5x: 'Google AI Ultra 5x',
      ultra_20x: 'Google AI Ultra 20x',
      custom: 'Custom Plan',
    },
  };

  const MODEL_GROUP_EN = {
    'Gemini 系列': 'Gemini Series',
    'Claude 系列': 'Claude Series',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Map 其他现役模型 (and legacy 其他在役模型 alias) in MODEL_GROUP_EN.
// ============================================================================
    '其他现役模型': 'Other Active Models',
    '其他在役模型': 'Other Active Models',
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
    '默认回退': 'Default Fallback',
  };

  const MODEL_PROFILE_EN = {
    'gemini-4-argon': { label: 'Gemini 4 Argon', hint: 'High/Med/Low · Orchestrator (Argon)' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Add dedicated Gemini 3.1 Pro English profile label and hint.
// ============================================================================
    'gemini-3.1-pro': { label: 'Gemini 3.1 Pro', hint: 'Pro Preview / Default · <=200k standard tier' },
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
    'gemini-4-carbon': { label: 'Gemini 4 Carbon', hint: 'High/Med/Low · Orchestrator (Carbon)' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Add Gemini 4 Neon English model profile metadata entry.
// ============================================================================
    'gemini-4-neon': { label: 'Gemini 4 Neon', hint: 'High/Med/Low · Orchestrator (Neon)' },
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
    'gemini-4-hydrogen': { label: 'Gemini 4 Hydrogen', hint: 'XHigh/High/Med/Low' },
    'gemini-3-8-flash': { label: 'Gemini 3.8 Flash', hint: 'High/Med/Low · Subagent Flash' },
    'claude-opus-5-5': { label: 'Claude Opus 5.5', hint: '5.5 / 4.6 · High/Med/Low' },
    'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', hint: 'High/Med/Low' },
    'gpt-oss-120b': { label: 'GPT-OSS 120B', hint: 'Medium' },
    auto: { label: 'Auto (Default)', hint: 'Fallback when no model is specified' },
  };

  function t(key, vars = null) {
    const langTable = I18N[state.lang] || I18N.zh;
    let str = langTable[key] ?? I18N.zh[key] ?? key;
    if (vars && typeof vars === 'object') {
      str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
    }
    return str;
  }

  function getPeriodLabel(rangeKey) {
    const k = rangeKey || 'today';
    const key = `periods.${k}`;
    return (I18N[state.lang] && I18N[state.lang][key]) ? t(key) : t('periods.today');
  }

  function getPlanLabel(planId, fallback = '') {
    const table = PLAN_LABELS[state.lang] || PLAN_LABELS.zh;
    return table[planId] || fallback || planId || '';
  }

  function localizeConvTitle(rawTitle) {
    const s = String(rawTitle || '');
    if (state.lang === 'en' && s.startsWith('已归档父会话 ')) {
      return `Archived Parent ${s.slice('已归档父会话 '.length)}`;
    }
    return s;
  }

  function applyStaticTranslations() {
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
      langBtn.textContent = state.lang === 'zh' ? 'EN' : '中';
      const tip = state.lang === 'zh' ? 'Switch to English' : '切换为中文';
      langBtn.title = tip;
      langBtn.setAttribute('aria-label', tip);
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: Clear dataset.btnSig when hydrating static [data-i18n] text so icon buttons re-mount SVG cleanly.
// ============================================================================
    for (const node of document.querySelectorAll('[data-i18n]')) {
      const key = node.getAttribute('data-i18n');
      if (key) {
        node.textContent = t(key);
        if (node.dataset && 'btnSig' in node.dataset) {
          delete node.dataset.btnSig;
        }
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================
    for (const node of document.querySelectorAll('[data-i18n-title]')) {
      const key = node.getAttribute('data-i18n-title');
      if (key) node.title = t(key);
    }
    for (const node of document.querySelectorAll('[data-i18n-aria-label]')) {
      const key = node.getAttribute('data-i18n-aria-label');
      if (key) node.setAttribute('aria-label', t(key));
    }
    if (state.resyncConfirmArmed) {
      const resyncBtn = document.getElementById('btn-resync-ledger');
      if (resyncBtn) resyncBtn.textContent = t('settings.resyncArmed');
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Keep #btn-receipt-copy label synchronized with receiptCopying state after static i18n updates.
// ============================================================================
    syncReceiptCopyControl();
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:21:41
// Description: Re-attach SVG icons to static back/refresh buttons after static i18n text hydration.
// ============================================================================
    const staticBackBtn = document.getElementById('btn-back-bound');
    if (staticBackBtn) {
      setIconButtonContent(staticBackBtn, 'back', staticBackBtn.textContent || t('header.backToCurrent'), 12);
    }
    const staticSyncBtn = document.getElementById('btn-sync-pricing');
    if (staticSyncBtn) {
      setIconButtonContent(
        staticSyncBtn,
        'refresh',
        state.pricingSyncing ? t('settings.syncingBtn') : t('settings.syncPricingBtn'),
        12,
      );
    }
    const staticCheckBtn = document.getElementById('btn-check-update');
    if (staticCheckBtn) {
      setIconButtonContent(
        staticCheckBtn,
        'refresh',
        state.updateChecking ? t('settings.checkingUpdateBtn') : t('settings.checkUpdateBtn'),
        12,
      );
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 10:21:41
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

  const $ = (id) => document.getElementById(id);

  // ---------------- Theme Synchronization ----------------
  function syncScheme() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--background, #f6f7f9)';
    document.documentElement.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const nums = (computed.match(/[\d.]+/g) || []).map(Number);
    if (nums.length >= 3) {
      const scale = computed.startsWith('color(') ? 1 : 255;
      const [r, g, b] = nums.slice(0, 3).map((v) => v / scale);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const theme = lum < 0.5 ? 'dark' : 'light';
      if (document.documentElement.dataset.theme !== theme) {
        document.documentElement.dataset.theme = theme;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Repaint Pixel Office canvas immediately when host theme toggles light/dark.
// ============================================================================
        drawPixelOfficeFrame();
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      }
    }
  }

  syncScheme();
  new MutationObserver(syncScheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
  });
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'theme-change') {
      syncScheme();
    }
  });

  // ---------------- Safe DOM & Format Helpers ----------------
  function el(tag, props = null, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, val] of Object.entries(props)) {
        if (val === undefined || val === null || val === false) continue;
        if (key === 'className') {
          node.className = val;
        } else if (key === 'textContent') {
          node.textContent = String(val);
        } else if (key === 'dataset' && typeof val === 'object') {
          for (const [dKey, dVal] of Object.entries(val)) {
            if (dVal !== undefined && dVal !== null) {
              node.dataset[dKey] = String(dVal);
            }
          }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Support CSS custom properties (--*) in el() style objects and add
// v0.2.6 motion helpers (splitRollingAffixes, renderRollingText, applySmoothBarSize,
// clearCurrentSessionMotionMemory, shouldAnimateMetrics) plus isChildSessionView().
// ============================================================================
        } else if (key === 'style' && typeof val === 'object') {
          for (const [sKey, sVal] of Object.entries(val)) {
            if (sVal === undefined || sVal === null) continue;
            if (sKey.startsWith('--')) {
              node.style.setProperty(sKey, String(sVal));
            } else {
              node.style[sKey] = sVal;
            }
          }
        } else if (key.startsWith('on') && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else {
          node.setAttribute(key, val === true ? '' : String(val));
        }
      }
    }
    for (const child of children) {
      appendChildSafe(node, child);
    }
    return node;
  }

  function appendChildSafe(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      for (const item of child) appendChildSafe(parent, item);
      return;
    }
    if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:30:56
// Description: Add v0.5.0 inline SVG stroke icon module (ICON_PATHS + icon() with safe fallback), model identity dot helpers (getModelAccent, createModelDot), and defensive icon-button helper (setIconButtonContent).
// ============================================================================
  const ICON_PATHS = Object.freeze({
    speed: 'M2.5 11.5a5.5 5.5 0 1 1 11 0M8 9.5l3-3M7.5 11.5h1',
    cost: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2ZM9.8 6c-.3-.7-1-1-1.8-1-1 0-1.7.5-1.7 1.3 0 .8.6 1.1 1.7 1.4 1.1.3 1.8.6 1.8 1.5 0 .9-.8 1.5-1.8 1.5-.9 0-1.6-.4-1.9-1.1M8 4.2v.8M8 10.7v1.1',
    context: 'M8 2.2 2 5.4 8 8.6l6-3.2L8 2.2ZM2 8.2l6 3.2 6-3.2M2 11l6 3.2 6-3.2',
    cache: 'M3 4.2c0-1 2.2-1.8 5-1.8s5 .8 5 1.8-2.2 1.8-5 1.8-5-.8-5-1.8ZM3 4.2v7.6c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4.2M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8',
    agents: 'M6 7.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6ZM1.8 13.5c.3-2 1.9-3.2 4.2-3.2s3.9 1.2 4.2 3.2M11 3.4a2 2 0 0 1 0 3.8M11.6 10.4c1.4.2 2.4 1.2 2.7 3.1',
    branch: 'M4.5 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM4.5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM11.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM4.5 5.5v5M11.5 7.5c0 2-1.5 3-4.5 3H4.5',
    office: 'M2.5 3h11a1 1 0 0 1 1 1v6.2a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM5.5 13.5h5M8 11.2v2.3',
    trend: 'M2.5 13.5h11M4.2 11.2V8.2M8 11.2V4.5M11.8 11.2V6.4',
    wallet: 'M2.2 4.5A1.3 1.3 0 0 1 3.5 3.2h8.5a1.3 1.3 0 0 1 1.3 1.3v7.2a1.3 1.3 0 0 1-1.3 1.3H3.5a1.3 1.3 0 0 1-1.3-1.3V4.5ZM10 7.2h3.3v2.4H10a1.2 1.2 0 0 1 0-2.4Z',
    sparkle: 'M8 1.8 9.5 6.5 14.2 8 9.5 9.5 8 14.2 6.5 9.5 1.8 8 6.5 6.5 8 1.8Z',
    wrench: 'M10.8 2.4a3.2 3.2 0 0 0-3.7 4.4l-4.2 4.2a1.3 1.3 0 1 0 1.8 1.8l4.2-4.2a3.2 3.2 0 0 0 4.4-3.7l-1.9 1.9-1.8-.6-.6-1.8 1.8-2Z',
    external: 'M6.5 3.5H3.8A1.3 1.3 0 0 0 2.5 4.8v7.4a1.3 1.3 0 0 0 1.3 1.3h7.4a1.3 1.3 0 0 0 1.3-1.3V9.5M9.5 2.5h4v4M13.5 2.5 7.5 8.5',
    back: 'M12.5 8h-9M7.2 4.2 3.5 8l3.7 3.8',
    refresh: 'M13 8a5 5 0 1 1-1.3-3.4L13 6M13 2.8V6H9.8',
    check: 'M3 8.5 6.4 11.8 13 4.5',
    alert: 'M8 2.2 14 13H2L8 2.2ZM8 6.2v3.3M8 11.4h.01',
    receipt: 'M4 2.2h8v11.6l-1.6-1.1-1.6 1.1L7.2 12.7 5.6 13.8 4 12.7V2.2ZM6.2 5.6h3.6M6.2 8.2h3.6M6.2 10.6h2.2',
    compress: 'M3 5.5h10M3 10.5h10M8 1.8v2.6M6.2 2.8 8 4.6l1.8-1.8M8 14.2v-2.6M6.2 13.2 8 11.4l1.8 1.8',
    gear: 'M7 1.8h2l.3 1.3c.4.1.7.3 1 .5l1.1-.6 1.6 1.6-.6 1.1c.2.3.4.6.5 1l1.3.3v2l-1.3.3c-.1.4-.3.7-.5 1l.6 1.1-1.6 1.6-1.1-.6c-.3.2-.6.4-1 .5l-.3 1.3H7l-.3-1.3c-.4-.1-.7-.3-1-.5l-1.1.6L3 11.4l.6-1.1c-.2-.3-.4-.6-.5-1L1.8 9V7l1.3-.3c.1-.4.3-.7.5-1L3 4.6 4.6 3l1.1.6c.3-.2.6-.4 1-.5L7 1.8ZM8 5.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: Add folder stroke icon for Tab 2 By Project (C1) card.
// ============================================================================
    folder: 'M2.2 4.2A1.2 1.2 0 0 1 3.4 3h3l1.3 1.5h4.9A1.2 1.2 0 0 1 13.8 5.7v6.1A1.2 1.2 0 0 1 12.6 13H3.4a1.2 1.2 0 0 1-1.2-1.2V4.2Z',
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================
    empty: 'M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  });

  function icon(name, size = 14, className = '') {
    const makeSvgEl = (tag) =>
      typeof document.createElementNS === 'function'
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag);
    const svg = makeSvgEl('svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', className ? `tm-icon ${className}` : 'tm-icon');
    const d = ICON_PATHS[name];
    if (d) {
      const p = makeSvgEl('path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  }

  function getModelAccent(primary, fallback = '') {
    const resolve = window.TokenMonitorPixelOffice?.resolveCatArchetype;
    if (typeof resolve !== 'function') return '';
    const p = String(primary || '').trim();
    const f = String(fallback || '').trim();
    if ((!p || p === '—') && (!f || f === '—')) return '';
    if (p && p !== '—') {
      const arch = resolve(p);
      if (arch?.deskAccent && (arch.id !== 'auto' || !f || f === '—')) {
        return arch.deskAccent;
      }
    }
    if (f && f !== '—') {
      const archF = resolve(f);
      if (archF?.deskAccent) return archF.deskAccent;
    }
    if (p && p !== '—') {
      return resolve(p)?.deskAccent || '';
    }
    return '';
  }

  function createModelDot(primary, fallback = '') {
    const accent = getModelAccent(primary, fallback);
    return el('span', {
      className: 'model-dot',
      'aria-hidden': 'true',
      style: accent ? { '--model-accent': accent } : null,
    });
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: A5 — Skip redundant button DOM rebuilds in setIconButtonContent using dataset.btnSig.
// ============================================================================
  function setIconButtonContent(btn, iconName, text, size = 12) {
    if (!btn) return;
    const label = String(text ?? '');
    const sig = `${iconName}|${size}|${label}`;
    if (btn.dataset && btn.dataset.btnSig === sig) return;
    if (btn.dataset) btn.dataset.btnSig = sig;
    if (typeof btn.replaceChildren === 'function') {
      btn.replaceChildren(icon(iconName, size), document.createTextNode(label));
    } else {
      btn.textContent = label;
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:30:56
// ============================================================================

  function setBoundedMotionMemory(map, key, value) {
    if (map.has(key)) {
      map.delete(key);
    } else if (map.size >= MAX_MOTION_MEMORY) {
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) map.delete(oldestKey);
    }
    map.set(key, value);
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add resetCardRenderSigs() helper and reset card render signatures inside clearCurrentSessionMotionMemory().
// ============================================================================
  function resetCardRenderSigs() {
    state.cardRenderSigs.speed = '';
    state.cardRenderSigs.cost = '';
    state.cardRenderSigs.context = '';
    state.cardRenderSigs.cache = '';
    state.cardRenderSigs.childrenModels = '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Reset Pixel Office dirty signature inside resetCardRenderSigs().
// ============================================================================
    state.cardRenderSigs.pixelOffice = '';
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Reset sideQuestions dirty signature inside resetCardRenderSigs().
// ============================================================================
    state.cardRenderSigs.sideQuestions = '';
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:34:38
// Description: Reset Tab 2 globalTop and globalList signatures in resetCardRenderSigs().
// ============================================================================
    state.cardRenderSigs.globalTop = '';
    state.cardRenderSigs.globalList = '';
// ============================================================================
// [MODIFIED END] 2026-11-20 15:34:38
// ============================================================================
  }

  function clearCurrentSessionMotionMemory() {
    for (const key of rollingMetricMemory.keys()) {
      if (key.startsWith('cur:')) rollingMetricMemory.delete(key);
    }
    for (const key of barMetricMemory.keys()) {
      if (key.startsWith('cur:')) barMetricMemory.delete(key);
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:40:30
// Description: Reset subagent/swarm folded state, scroll offset, and receipt memoization signature on session switch.
// ============================================================================
    state.childrenExpanded = false;
    state.childrenScrollTop = 0;
    state.lastReceiptDataSig = '';
// ============================================================================
// [MODIFIED END] 2026-11-18 11:40:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Reset Side Questions expanded flag and scroll offset on conversation switch.
// ============================================================================
    state.sideQuestionsExpanded = false;
    state.sideQuestionsScrollTop = 0;
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================
    resetCardRenderSigs();
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================

  function shouldAnimateMetrics() {
    return (
      !document.hidden &&
      !state.suppressMotionOnce &&
      !Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );
  }

  function splitRollingAffixes(prevStr, nextStr) {
    const prevChars = Array.from(String(prevStr ?? ''));
    const nextChars = Array.from(String(nextStr ?? ''));
    const minLen = Math.min(prevChars.length, nextChars.length);

    let prefixLen = 0;
    while (prefixLen < minLen && prevChars[prefixLen] === nextChars[prefixLen]) {
      prefixLen += 1;
    }

    if (prefixLen === prevChars.length && prefixLen === nextChars.length) {
      return {
        prefix: prevChars.join(''),
        prevMid: [],
        nextMid: [],
        suffix: '',
      };
    }

    let suffixLen = 0;
    while (
      suffixLen < prevChars.length - prefixLen &&
      suffixLen < nextChars.length - prefixLen &&
      prevChars[prevChars.length - 1 - suffixLen] === nextChars[nextChars.length - 1 - suffixLen]
    ) {
      suffixLen += 1;
    }

    return {
      prefix: prevChars.slice(0, prefixLen).join(''),
      prevMid: prevChars.slice(prefixLen, prevChars.length - suffixLen),
      nextMid: nextChars.slice(prefixLen, nextChars.length - suffixLen),
      suffix: suffixLen > 0 ? nextChars.slice(nextChars.length - suffixLen).join('') : '',
    };
  }

  function parseLeadingMetricNumber(str) {
    const cleaned = String(str || '').replace(/,/g, '');
    const m = cleaned.match(/[-+]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Keep .roll-val class constant at rest/animation/cleanup, roll per-character only on equal-length <=18 transitions, and use whole-value .roll-col.is-whole (with optional .is-end) on length changes without partial prefix slicing.
// ============================================================================
  function renderRollingText(metricKey, nextText, rawNumVal = null, props = null) {
    const str = String(nextText ?? '');
    const prev = rollingMetricMemory.get(metricKey);
    const numVal =
      rawNumVal !== null && rawNumVal !== undefined && Number.isFinite(Number(rawNumVal))
        ? Number(rawNumVal)
        : parseLeadingMetricNumber(str);
    setBoundedMotionMemory(rollingMetricMemory, metricKey, { text: str, numVal });

    const alignEnd = Boolean(props?.alignEnd);
    const baseProps = {};
    if (props && typeof props === 'object') {
      for (const [k, v] of Object.entries(props)) {
        if (k === 'textContent' || k === 'alignEnd') continue;
        baseProps[k] = v;
      }
    }
    const existingClass = baseProps.className ? String(baseProps.className).trim() : '';
    const restClass = existingClass
      ? (existingClass.split(/\s+/).includes('roll-val') ? existingClass : `${existingClass} roll-val`)
      : 'roll-val';

    if (!prev || prev.text === str || !shouldAnimateMetrics()) {
      const restProps = {};
      for (const [k, v] of Object.entries(baseProps)) {
        if (k === 'className') continue;
        restProps[k] = v;
      }
      restProps.className = restClass;
      return el('span', restProps, str);
    }

    const isDown =
      numVal !== null &&
      prev.numVal !== null &&
      Number.isFinite(numVal) &&
      Number.isFinite(prev.numVal) &&
      numVal < prev.numVal;
    const dir = isDown ? 'down' : 'up';

    const animProps = {};
    for (const [k, v] of Object.entries(baseProps)) {
      if (k === 'className') continue;
      animProps[k] = v;
    }
    animProps.className = `${restClass} is-${dir}`;
    animProps['aria-label'] = str;

    const prevChars = Array.from(prev.text);
    const nextChars = Array.from(str);
    const children = [];

    if (prevChars.length === nextChars.length && nextChars.length > 0 && nextChars.length <= 18) {
      let changedIdx = 0;
      for (let i = 0; i < nextChars.length; i += 1) {
        if (prevChars[i] === nextChars[i]) {
          children.push(el('span', { className: 'roll-static', 'aria-hidden': 'true' }, nextChars[i]));
        } else {
          children.push(
            el('span', {
              className: 'roll-col',
              'aria-hidden': 'true',
              style: { '--roll-delay': `${Math.min(changedIdx * 14, 70)}ms` },
            },
              el('span', { className: 'roll-old' }, prevChars[i]),
              el('span', { className: 'roll-new' }, nextChars[i]),
            ),
          );
          changedIdx += 1;
        }
      }
    } else {
      children.push(
        el('span', {
          className: `roll-col is-whole${alignEnd ? ' is-end' : ''}`,
          'aria-hidden': 'true',
        },
          el('span', { className: 'roll-old' }, prev.text),
          el('span', { className: 'roll-new' }, str),
        ),
      );
    }

    const wrapper = el('span', animProps, children);
    const hadAriaLabel = Object.prototype.hasOwnProperty.call(baseProps, 'aria-label');
    setTimeout(() => {
      if (wrapper.isConnected) {
        wrapper.classList.remove('is-up', 'is-down');
        if (!String(wrapper.className || '').split(/\s+/).includes('roll-val')) {
          wrapper.className = wrapper.className ? `${wrapper.className} roll-val` : 'roll-val';
        }
        if (!hadAriaLabel) {
          wrapper.removeAttribute('aria-label');
        }
        wrapper.textContent = str;
      }
    }, 410);
    return wrapper;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================

  function applySmoothBarSize(node, barKey, cssProp, nextPct) {
    if (!node) return node;
    const raw = Number(nextPct);
    const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    const prevPct = barMetricMemory.get(barKey);
    setBoundedMotionMemory(barMetricMemory, barKey, pct);

    if (
      prevPct !== undefined &&
      Math.abs(pct - prevPct) >= 0.05 &&
      shouldAnimateMetrics() &&
      typeof requestAnimationFrame === 'function'
    ) {
      node.style[cssProp] = `${prevPct.toFixed(2)}%`;
      requestAnimationFrame(() => {
        if (!node.isConnected) return;
        requestAnimationFrame(() => {
          if (!node.isConnected) return;
          node.style[cssProp] = `${pct.toFixed(2)}%`;
        });
      });
    } else {
      node.style[cssProp] = `${pct.toFixed(2)}%`;
    }
    return node;
  }

  function isChildSessionView(current) {
    const cid = String(current?.conversationId || '').toLowerCase();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Treat Side Question sessions (childKind === 'side_question') as isolated child views alongside isChildSession.
// ============================================================================
    return Boolean(
      current?.isChildSession ||
      current?.childKind === 'side_question' ||
      (cid && state.inspectedChildIds.has(cid)),
    );
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================

  function num(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmtInt(val) {
    return Math.round(num(val, 0)).toLocaleString('en-US');
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Implement 4-mode fmtTokens (auto/wan_yi/exact/m), localized fmtRelTime,
// safe clipboard copy helper, and partial prefs sync helper (patchPrefs).
// ============================================================================
  function fmtTokens(val) {
    const n = num(val, 0);
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const unit = VALID_TOKEN_UNITS.includes(state.tokenUnit) ? state.tokenUnit : 'auto';
    if (unit === 'wan_yi') {
      if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`;
      if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(1)}万`;
      return `${sign}${Math.round(abs)}`;
    }
    if (unit === 'exact') {
      const rounded = Math.round(n);
      return rounded === 0 ? '0' : rounded.toLocaleString('en-US');
    }
    if (unit === 'm') {
      if (abs === 0) return '0';
      return abs >= 10000
        ? `${sign}${(abs / 1e6).toFixed(2)}M`
        : `${sign}${(abs / 1e6).toFixed(4)}M`;
    }
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
    return `${sign}${Math.round(abs)}`;
  }

  function fmtDeltaTokens(val) {
    const n = num(val, 0);
    const prefix = n >= 0 ? '+' : '';
    return `${prefix}${fmtTokens(n)}`;
  }

  function fmtRate(val) {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return n >= 100 ? n.toFixed(0) : n.toFixed(1);
  }

  function fmtPct(val) {
    const n = num(val, 0);
    return `${n.toFixed(1)}%`;
  }

  function fmtCost(val, currency = 'USD') {
    const n = num(val, 0);
    const code = currency || 'USD';
    return `${code} ${n.toFixed(4)}`;
  }

  function fmtCostCompact(val, currency = 'USD') {
    const n = num(val, 0);
    const code = currency || 'USD';
    return Math.abs(n) >= 1 ? `${code} ${n.toFixed(2)}` : `${code} ${n.toFixed(4)}`;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:21:41
// Description: Add currency-free numeric cost formatters mirroring fmtCost / fmtCostCompact for breakdown tables.
// ============================================================================
  function fmtCostNumber(val) {
    const n = num(val, 0);
    return n.toFixed(4);
  }

  function fmtCostCompactNumber(val) {
    const n = num(val, 0);
    return Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4);
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 10:21:41
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add nice ceiling scale helper (computeTrendAxisScale) and ultra-compact
// trend Y-axis tick formatters (fmtAxisCost, unified pure-English SI fmtAxisTokens).
// ============================================================================
  const TREND_AXIS_BASES = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

  function computeTrendAxisScale(maxVal, metricKey) {
    const rawMax = num(maxVal, 0);
    if (rawMax <= 0) {
      const axisMax = metricKey === 'tokens' ? 1000 : 1;
      return { axisMax, midVal: axisMax / 2, zeroVal: 0 };
    }
    const effectiveMax = metricKey === 'tokens' ? Math.max(2, rawMax) : rawMax;
    const exp = Math.floor(Math.log10(effectiveMax));
    const pow = Math.pow(10, exp);
    let axisMax = Number((10 * pow).toPrecision(10));
    for (const base of TREND_AXIS_BASES) {
      const candidate = Number((base * pow).toPrecision(10));
      if (candidate >= effectiveMax) {
        axisMax = candidate;
        break;
      }
    }
    if (axisMax < effectiveMax) {
      axisMax = Number((10 * pow).toPrecision(10));
    }
    return {
      axisMax,
      midVal: Number((axisMax / 2).toPrecision(10)),
      zeroVal: 0,
    };
  }

  function trimAxisDecimals(val, decimals) {
    return val.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  function fmtAxisCost(val, currency = 'USD') {
    const sym = currency === 'CNY' ? '¥' : '$';
    const n = num(val, 0);
    const abs = Math.abs(n);
    if (abs < 1e-9) return `${sym}0`;
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${sym}${trimAxisDecimals(abs / 1e9, 2)}B`;
    if (abs >= 1e6) return `${sign}${sym}${trimAxisDecimals(abs / 1e6, 2)}M`;
    if (abs >= 1e3) return `${sign}${sym}${trimAxisDecimals(abs / 1e3, 2)}k`;
    if (abs >= 100) return `${sign}${sym}${Math.round(abs)}`;
    if (abs >= 0.1) return `${sign}${sym}${trimAxisDecimals(abs, 2)}`;
    if (abs >= 0.01) return `${sign}${sym}${trimAxisDecimals(abs, 3)}`;
    if (abs >= 0.001) return `${sign}${sym}${trimAxisDecimals(abs, 4)}`;
    return `${sign}${sym}${trimAxisDecimals(abs, 5)}`;
  }

  function fmtAxisTokens(val) {
    const n = num(val, 0);
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${trimAxisDecimals(abs / 1e9, 2)}B`;
    if (abs >= 5e5) return `${sign}${trimAxisDecimals(abs / 1e6, 2)}M`;
    if (abs >= 1e3) return `${sign}${trimAxisDecimals(abs / 1e3, 2)}k`;
    return `${sign}${trimAxisDecimals(abs, 1)}`;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================

  function fmtUnitPrice(val) {
    const n = num(val, 0);
    return n >= 1 ? n.toFixed(2) : n >= 0.1 ? n.toFixed(3).replace(/0$/, '') : n.toFixed(3);
  }

  function shortId(id) {
    const s = String(id || '');
    return s.length > 10 ? s.slice(0, 8) : s || '—';
  }

  function workspaceBase(ws) {
    const s = String(ws || '').trim();
    if (!s) return '';
    const cleaned = s.replace(/[\\/]+$/, '');
    const parts = cleaned.split(/[\\/]/);
    return parts[parts.length - 1] || s;
  }

  function fmtRelTime(ms) {
    const tMs = Number(ms);
    if (!Number.isFinite(tMs) || tMs <= 0) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - tMs) / 1000));
    if (diffSec < 60) return t('common.relSec', { n: diffSec });
    if (diffSec < 3600) return t('common.relMin', { n: Math.floor(diffSec / 60) });
    if (diffSec < 86400) return t('common.relHour', { n: Math.floor(diffSec / 3600) });
    const d = new Date(tMs);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function getServerNowMs() {
    return Date.now() + state.serverClockOffsetMs;
  }

  function fmtElapsed(sinceMs) {
    const start = Number(sinceMs);
    if (!Number.isFinite(start) || start <= 0) return '';
    const sec = Math.max(0, (getServerNowMs() - start) / 1000);
    return `${sec.toFixed(1)}s`;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Support ok/warn/error toast tones, ARIA alert role on errors, and extended 4.2s auto-hide for warn/error banners.
// ============================================================================
  function showToast(msg, tone = 'ok') {
    const banner = $('toast-banner');
    if (!banner) return;
    banner.className =
      tone === 'error'
        ? 'toast-banner is-error'
        : (tone === 'warn' ? 'toast-banner is-warn' : 'toast-banner');
    banner.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    banner.textContent = msg;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, tone === 'error' || tone === 'warn' ? 4200 : 2600);
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback to hidden textarea when clipboard API is blocked in sandboxed iframe.
      }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  async function patchPrefs(partial) {
    state.pendingPrefSaves += 1;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Track preference saves via prefMutationSeq instead of mutating
// polling sequence so background snapshot requests are not canceled or dropped.
// ============================================================================
    prefMutationSeq += 1;
    try {
      const res = await apiFetch('/api/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t('settings.saveFailedDefault'));
      lastEtag = '';
      if (state.pollInFlight) {
        state.pendingForcePoll = true;
      }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================
      if (state.snapshot) {
        if (data.prefs) state.snapshot.prefs = data.prefs;
        if (data.pricingCatalog) state.snapshot.pricingCatalog = data.pricingCatalog;
      }
      if (data.prefs && !state.drawerOpen) {
        populateSettingsForm(data.prefs);
      }
    } catch (err) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Render preference save errors with error toast tone.
// ============================================================================
      showToast(t('settings.saveFailed', { msg: err?.message || 'error' }), 'error');
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
    } finally {
      state.pendingPrefSaves = Math.max(0, state.pendingPrefSaves - 1);
    }
  }

  function openConversationInHost(convId) {
    if (!convId) return;
    const toggle = window.sidecar?.ui?.toggleConversation;
    if (typeof toggle === 'function') {
      toggle(convId);
    } else {
      showToast(t('common.standaloneOpenHint'));
      selectConversation(convId);
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Bump convEpoch, clear pending poll timer, and abort stale
// in-flight requests when switching to another conversation.
// ============================================================================
  function selectConversation(convId) {
    if (!convId) return;
    if (convId !== selectedConv) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Clear current-session motion memory when switching to another conversation.
// ============================================================================
      clearCurrentSessionMotionMemory();
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Clear Pixel Office inspector selection when switching conversations.
// ============================================================================
      state.pixelOfficeSelectedKey = '';
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      state.convEpoch += 1;
      if (state.pollTimer) {
        clearTimeout(state.pollTimer);
        state.pollTimer = null;
      }
      if (state.activePollController && state.inFlightConv !== convId) {
        try {
          state.activePollController.abort('conversation-switch');
        } catch {
          // Ignore abort errors
        }
      }
      selectedConv = convId;
    }
    lastEtag = '';
    setActiveTab('current');
    pollSnapshot(true);
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Add client-side scoreModelPerformance and sortCatalogByPerformance
// helpers and sort getCatalogList() top-to-bottom by capability while keeping
// group order (Gemini -> Claude -> Other -> Auto).
// ============================================================================
  const GROUP_SORT_ORDER = {
    'Gemini 系列': 0,
    'Claude 系列': 1,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Sort 其他现役模型 at group rank 2 (retaining legacy 其他在役模型 alias).
// ============================================================================
    '其他现役模型': 2,
    '其他在役模型': 2,
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
    '默认回退': 3,
  };

  function parseGeminiVersion(s) {
    const m = s.match(/gemini[\s_-]*(\d+(?:[._]\d+|-\d+(?=-|\s|$))?)/i);
    if (!m || !m[1]) return 3.0;
    const ver = Number(m[1].replace(/[_-]/g, '.'));
    return Number.isFinite(ver) ? ver : 3.0;
  }

  function parseClaudeVersion(s) {
    const m =
      s.match(/claude[\s_-]*(?:opus|sonnet|haiku)[\s_-]*(\d+(?:[._-]\d+)?)/i) ||
      s.match(/claude[\s_-]*(\d+(?:[._-]\d+)?)/i);
    if (!m || !m[1]) return 3.0;
    const ver = Number(m[1].replace(/[_-]/g, '.'));
    return Number.isFinite(ver) ? ver : 3.0;
  }

  function getModelGroupRank(item) {
    if (!item) return 99;
    const id = String(item.id || '').trim().toLowerCase();
    if (id === 'auto') return 3;
    const group = String(item.group || '');
    if (Object.prototype.hasOwnProperty.call(GROUP_SORT_ORDER, group)) {
      return GROUP_SORT_ORDER[group];
    }
    if (/^gemini/i.test(id)) return 0;
    if (/^claude/i.test(id)) return 1;
    return 2;
  }

  function scoreModelPerformance(item) {
    if (!item) return -1000;
    const id = String(item.id || '').trim();
    const label = String(item.label || '').trim();
    const lowerId = id.toLowerCase();
    const group = String(item.group || '');
    if (lowerId === 'auto' || group === '默认回退') {
      return -1000;
    }

    const s = `${id} ${label}`.toLowerCase();
    const previewPenalty = /-(?:preview|exp|experimental)\b/i.test(id) ? 1 : 0;

    if (group === 'Gemini 系列' || /(?:^|[^a-z0-9])gemini(?=$|[^a-z0-9])/i.test(s)) {
      const ver = parseGeminiVersion(s);
      if (/(?:^|[^a-z0-9])(?:flash[\s_-]*lite|lite|nano|8b)(?=$|[^a-z0-9])/i.test(s)) {
        return 2000 + ver * 100 - previewPenalty;
      }
      if (/(?:^|[^a-z0-9])flash(?=$|[^a-z0-9])/i.test(s)) {
        return 5000 + ver * 100 - previewPenalty;
      }
      let sub = 50;
      if (/(?:^|[^a-z0-9])ultra(?=$|[^a-z0-9])/i.test(s)) sub = 95;
      else if (/(?:^|[^a-z0-9])carbon(?=$|[^a-z0-9])/i.test(s)) sub = 90;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Rank Gemini 4 Neon between Carbon and Argon in scoreModelPerformance.
// ============================================================================
      else if (/(?:^|[^a-z0-9])neon(?=$|[^a-z0-9])/i.test(s)) sub = 85;
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      else if (/(?:^|[^a-z0-9])argon(?=$|[^a-z0-9])/i.test(s)) sub = 80;
      else if (/(?:^|[^a-z0-9])pro(?=$|[^a-z0-9])/i.test(s)) sub = 70;
      else if (/(?:^|[^a-z0-9])hydrogen(?=$|[^a-z0-9])/i.test(s)) sub = 60;
      return 10000 + ver * 100 + sub - previewPenalty;
    }

    if (group === 'Claude 系列' || /(?:^|[^a-z0-9])claude(?=$|[^a-z0-9])/i.test(s)) {
      const ver = parseClaudeVersion(s);
      if (/(?:^|[^a-z0-9])opus(?=$|[^a-z0-9])/i.test(s)) return 8000 + ver * 100 - previewPenalty;
      if (/(?:^|[^a-z0-9])sonnet(?=$|[^a-z0-9])/i.test(s)) return 6000 + ver * 100 - previewPenalty;
      if (/(?:^|[^a-z0-9])haiku(?=$|[^a-z0-9])/i.test(s)) return 3000 + ver * 100 - previewPenalty;
      return 4000 + ver * 100 - previewPenalty;
    }

    return 0;
  }

  function sortCatalogByPerformance(catalog) {
    if (!Array.isArray(catalog) || catalog.length === 0) return [];
    return [...catalog].sort((a, b) => {
      const aAuto = String(a?.id || '').trim().toLowerCase() === 'auto';
      const bAuto = String(b?.id || '').trim().toLowerCase() === 'auto';
      if (aAuto !== bAuto) return aAuto ? 1 : -1;

      const groupDiff = getModelGroupRank(a) - getModelGroupRank(b);
      if (groupDiff !== 0) return groupDiff;

      const scoreDiff = scoreModelPerformance(b) - scoreModelPerformance(a);
      if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

      const outA = Number(a?.defaultUsd?.outputPer1M ?? a?.outputPer1M ?? 0) || 0;
      const outB = Number(b?.defaultUsd?.outputPer1M ?? b?.outputPer1M ?? 0) || 0;
      if (Math.abs(outB - outA) > 1e-9) return outB - outA;

      const inA = Number(a?.defaultUsd?.inputPer1M ?? a?.inputPer1M ?? 0) || 0;
      const inB = Number(b?.defaultUsd?.inputPer1M ?? b?.inputPer1M ?? 0) || 0;
      if (Math.abs(inB - inA) > 1e-9) return inB - inA;

      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  }

  function getCatalogList() {
    const raw = Array.isArray(state.snapshot?.pricingCatalog) ? state.snapshot.pricingCatalog : [];
    return sortCatalogByPerformance(raw);
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================

  // ============================================================================
  // [MODIFIED BEGIN] 2026-11-16 21:11:00
  // Description: Align raw model ID profile matching for v1.2 tier-free slugs (argon, carbon/orchestrator/gemini-pro, hydrogen, flash/worker, claude-opus-5-5/4-6).
  // ============================================================================
  function matchProfileIdForModel(modelName) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Match exact catalog ID first, then dedicated Gemini 3.1 Pro tier before fallback rules.
// ============================================================================
    const s = String(modelName || '').trim().toLowerCase();
    if (s) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Match exact catalog ID or label first before fallback regexes.
// ============================================================================
      const catalog = getCatalogList();
      const exact =
        catalog.find((item) => String(item.id || '').toLowerCase() === s) ||
        catalog.find((item) => String(item.label || '').trim().toLowerCase() === s);
      if (exact) return exact.id;
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================
    }
    if (/gemini[\s_-]*3\.?1[\s_-]*pro|gemini-pro-default/i.test(s)) return 'gemini-3.1-pro';
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
    if (/argon/.test(s)) return 'gemini-4-argon';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Map Neon and Orchestrator (Neon) slugs to gemini-4-neon before Carbon fallback.
// ============================================================================
    if (/neon/.test(s)) return 'gemini-4-neon';
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Map gemini-flash-worker and Hydrogen (Orchestrator) to gemini-4-hydrogen before Carbon/Flash fallbacks.
// ============================================================================
    if (/hydrogen|gemini[\s_-]*flash[\s_-]*worker/i.test(s)) return 'gemini-4-hydrogen';
    if (/carbon|orchestrator|gemini[\s-]*(?:[23][\w.-]*[\s-]*)?pro|^pro$/.test(s)) return 'gemini-4-carbon';
    if (/flash/.test(s)) return 'gemini-3-8-flash';
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
    if (/claude[\s-]*opus/.test(s)) return 'claude-opus-5-5';
    if (/claude[\s-]*(?:sonnet|haiku)/.test(s)) return 'claude-sonnet-5-5';
    if (/gpt[\s-]*oss/.test(s)) return 'gpt-oss-120b';
    return 'auto';
  }
  // ============================================================================
  // [MODIFIED END] 2026-11-16 21:11:00
  // ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Localize tabs, settings drawer, model catalog groups/hints, validation,
// resync workflow, and header status/banner; add tokenUnit and 400k/500k defaults to prefs.
// ============================================================================
  // ---------------- Tabs & Settings Drawer ----------------
  function setActiveTab(tab) {
    if (tab !== 'current' && tab !== 'global') return;
    state.activeTab = tab;
    const btnCurr = $('tabbtn-current');
    const btnGlobal = $('tabbtn-global');
    const panelCurr = $('tab-current');
    const panelGlobal = $('tab-global');

    const isCurr = tab === 'current';
    btnCurr.classList.toggle('active', isCurr);
    btnCurr.setAttribute('aria-selected', String(isCurr));
    btnGlobal.classList.toggle('active', !isCurr);
    btnGlobal.setAttribute('aria-selected', String(!isCurr));
    panelCurr.classList.toggle('hidden', !isCurr);
    panelCurr.classList.toggle('active', isCurr);
    panelGlobal.classList.toggle('hidden', isCurr);
    panelGlobal.classList.toggle('active', !isCurr);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: A4 & A5 — Render the newly activated tab on switch (with signature memoization) and sync stopwatch loop.
// ============================================================================
    if (isCurr) {
      if (state.snapshot) {
        renderCurrentTab(state.snapshot);
      }
    } else {
      if (state.snapshot) {
        renderGlobalTab(state.snapshot);
      }
      syncTrendScrollPosition();
    }
    syncStopwatchLoop();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Redraw Pixel Office on returning to Current tab and sync animation loop across tab switches.
// ============================================================================
    if (isCurr) {
      drawPixelOfficeFrame();
    }
    syncPixelOfficeLoop();
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
  }

  function resetResyncConfirm() {
    state.resyncConfirmArmed = false;
    if (state.resyncTimer) {
      clearTimeout(state.resyncTimer);
      state.resyncTimer = null;
    }
    const btn = $('btn-resync-ledger');
    if (btn) {
      btn.textContent = t('settings.resyncIdle');
      btn.classList.remove('is-armed');
    }
  }

  function setDrawerOpen(open) {
    state.drawerOpen = Boolean(open);
    const drawer = $('settings-drawer');
    const btn = $('btn-settings');
    drawer.classList.toggle('hidden', !state.drawerOpen);
    btn.setAttribute('aria-expanded', String(state.drawerOpen));
    resetResyncConfirm();
    if (state.drawerOpen) {
      $('settings-feedback').textContent = '';
      $('settings-feedback').className = 'settings-feedback';
      if (state.snapshot?.prefs) {
        const activeModel = state.snapshot?.current?.activeModel;
        if (activeModel) {
          state.selectedProfileId = matchProfileIdForModel(activeModel);
        }
        populateSettingsForm(state.snapshot.prefs);
      } else {
        renderPricingSyncStatus();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:58:00
// Description: Refresh release update status bar when opening settings drawer without snapshot prefs.
// ============================================================================
        renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 18:58:00
// ============================================================================
      }
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Localize dynamic synced/observed profile hints, update #pref-model-select
// badges in place without rebuilding DOM, make catalog preview rows clickable, and
// render/trigger official pricing sync status.
// ============================================================================
  function localizeProfileHint(rawHint) {
    const hint = String(rawHint || '');
    if (state.lang !== 'en') return hint;
    return hint
      .replace(/官方自动同步模型/g, 'Auto-synced official model')
      .replace(/本地观测模型/g, 'Observed local model');
  }

  function getLocalizedProfileMeta(item) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Normalize legacy 其他在役模型 group label to 其他现役模型 in UI display.
// ============================================================================
    const group = item.group === '其他在役模型' ? '其他现役模型' : item.group;
    if (state.lang === 'en') {
      const enMeta = MODEL_PROFILE_EN[item.id];
      return {
        group: MODEL_GROUP_EN[group] || group,
        label: enMeta?.label || item.label,
        hint: enMeta?.hint || localizeProfileHint(item.hint),
      };
    }
    return {
      group,
      label: item.label,
      hint: item.hint,
    };
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================

  function getEffectiveDraftUsd(profileId) {
    const catalog = getCatalogList();
    const item = catalog.find((p) => p.id === profileId) || catalog[0];
    if (!item) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:20:16
// Description: Update empty-catalog fallback rates to Gemini 4 flat 1M context
// and 95% cache discount defaults (cachedPer1M: 0.1, longContextTier: false).
// ============================================================================
      return {
        inputPer1M: 2,
        cachedPer1M: 0.1,
        outputPer1M: 10,
        longContextTier: false,
        isOverridden: false,
        defaultUsd: { inputPer1M: 2, cachedPer1M: 0.1, outputPer1M: 10, longContextTier: false },
      };
// ============================================================================
// [MODIFIED END] 2026-11-19 14:20:16
// ============================================================================
    }
    const ov = state.draftModelOverrides[item.id];
    return {
      inputPer1M: ov ? num(ov.inputPer1M, item.defaultUsd.inputPer1M) : item.defaultUsd.inputPer1M,
      cachedPer1M: ov ? num(ov.cachedPer1M, item.defaultUsd.cachedPer1M) : item.defaultUsd.cachedPer1M,
      outputPer1M: ov ? num(ov.outputPer1M, item.defaultUsd.outputPer1M) : item.defaultUsd.outputPer1M,
      longContextTier:
        ov && typeof ov.longContextTier === 'boolean'
          ? ov.longContextTier
          : Boolean(item.defaultUsd.longContextTier),
      isOverridden: Boolean(ov),
      defaultUsd: item.defaultUsd,
    };
  }

  function renderModelSelectOptions() {
    const select = $('pref-model-select');
    const catalog = getCatalogList();
    if (!select || catalog.length === 0) return;

    const groups = new Map();
    for (const item of catalog) {
      const loc = getLocalizedProfileMeta(item);
      if (!groups.has(loc.group)) groups.set(loc.group, []);
      groups.get(loc.group).push({ item, loc });
    }

    const optGroups = [];
    for (const [groupLabel, entries] of groups.entries()) {
      const og = el('optgroup', { label: groupLabel },
        entries.map(({ item, loc }) => {
          const isModified = Boolean(state.draftModelOverrides[item.id]);
          const suffix = isModified ? ' *' : '';
          return el('option', {
            value: item.id,
            textContent: `${loc.label} (${loc.hint})${suffix}`,
          });
        }),
      );
      optGroups.push(og);
    }
    select.replaceChildren(...optGroups);
    if (catalog.some((c) => c.id === state.selectedProfileId)) {
      select.value = state.selectedProfileId;
    } else {
      state.selectedProfileId = catalog[0].id;
      select.value = state.selectedProfileId;
    }
  }

  function loadSelectedProfileInputs() {
    const eff = getEffectiveDraftUsd(state.selectedProfileId);
    $('pref-input-price').value = eff.inputPer1M;
    $('pref-cached-price').value = eff.cachedPer1M;
    $('pref-output-price').value = eff.outputPer1M;
    $('pref-long-tier').checked = eff.longContextTier;
    renderCatalogPreviewTable();
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Preserve #pref-model-select state via syncModelSelectOptionBadges(),
// make catalog table rows interactive, and sync official pricing status UI.
// ============================================================================
  function syncModelSelectOptionBadges() {
    const select = $('pref-model-select');
    if (!select) return;
    const catalogById = new Map(getCatalogList().map((item) => [item.id, item]));
    for (const opt of select.querySelectorAll('option')) {
      const item = catalogById.get(opt.value);
      if (!item) continue;
      const loc = getLocalizedProfileMeta(item);
      const isModified = Boolean(state.draftModelOverrides[item.id]);
      const expectedText = `${loc.label} (${loc.hint})${isModified ? ' *' : ''}`;
      if (opt.textContent !== expectedText) {
        opt.textContent = expectedText;
      }
    }
  }

  function stageCurrentProfileFromInputs() {
    const catalog = getCatalogList();
    const item = catalog.find((p) => p.id === state.selectedProfileId);
    if (!item) return;

    const inputPer1M = Number($('pref-input-price').value);
    const cachedPer1M = Number($('pref-cached-price').value);
    const outputPer1M = Number($('pref-output-price').value);
    const longContextTier = Boolean($('pref-long-tier').checked);
    if (
      !Number.isFinite(inputPer1M) || inputPer1M < 0 ||
      !Number.isFinite(cachedPer1M) || cachedPer1M < 0 ||
      !Number.isFinite(outputPer1M) || outputPer1M < 0
    ) {
      return;
    }

    const d = item.defaultUsd;
    const isDefault =
      Math.abs(inputPer1M - d.inputPer1M) < 1e-9 &&
      Math.abs(cachedPer1M - d.cachedPer1M) < 1e-9 &&
      Math.abs(outputPer1M - d.outputPer1M) < 1e-9 &&
      longContextTier === Boolean(d.longContextTier);

    if (isDefault) {
      delete state.draftModelOverrides[item.id];
    } else {
      state.draftModelOverrides[item.id] = {
        inputPer1M,
        cachedPer1M,
        outputPer1M,
        longContextTier,
      };
    }
    syncModelSelectOptionBadges();
    renderCatalogPreviewTable();
  }

  function renderCatalogPreviewTable() {
    const wrap = $('catalog-preview-table');
    const catalog = getCatalogList();
    if (!wrap || catalog.length === 0) return;

    const currency = $('pref-currency')?.value === 'CNY' ? 'CNY' : 'USD';
    const cnyRate = Math.max(0.01, num($('pref-cny-rate')?.value, 7.25));
    const fx = currency === 'CNY' ? cnyRate : 1;

    wrap.replaceChildren(
      el('table', { className: 'data-table tabular-nums' },
        el('thead', null,
          el('tr', null,
            el('th', null, t('settings.catalogModelCol')),
            el('th', { className: 'num' }, 'In'),
            el('th', { className: 'num' }, 'Cache'),
            el('th', { className: 'num' }, 'Out'),
            el('th', null, '>200k'),
          ),
        ),
        el('tbody', null,
          catalog.map((item) => {
            const eff = getEffectiveDraftUsd(item.id);
            const loc = getLocalizedProfileMeta(item);
            const isSelected = item.id === state.selectedProfileId;
            const selectThisModel = () => {
              if (state.selectedProfileId !== item.id) {
                stageCurrentProfileFromInputs();
                state.selectedProfileId = item.id;
                if ($('pref-model-select')) $('pref-model-select').value = item.id;
                loadSelectedProfileInputs();
              }
              $('pref-input-price')?.focus();
            };
            return el('tr', {
              className: `catalog-row${eff.isOverridden ? ' is-overridden' : ''}${isSelected ? ' is-selected' : ''}`,
              tabIndex: 0,
              title: t('settings.catalogRowTip'),
              onClick: selectThisModel,
              onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectThisModel();
                }
              },
            },
              el('td', {
                className: 'model-cell',
                textContent: `${loc.label}${eff.isOverridden ? ' *' : ''}`,
                title: loc.hint ? `${loc.hint} · ${t('settings.catalogRowTip')}` : t('settings.catalogRowTip'),
              }),
              el('td', { className: 'num', textContent: fmtUnitPrice(eff.inputPer1M * fx) }),
              el('td', { className: 'num', textContent: fmtUnitPrice(eff.cachedPer1M * fx) }),
              el('td', { className: 'num', textContent: fmtUnitPrice(eff.outputPer1M * fx) }),
              el('td', { textContent: eff.longContextTier ? '×2 / ×1.5' : '—' }),
            );
          }),
        ),
      ),
    );
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================

  function updateConditionalSettingsFields() {
    const currency = $('pref-currency').value === 'CNY' ? 'CNY' : 'USD';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Toggle FX rate mode selector, lock #pref-cny-rate as read-only
// when auto-synced, and fill live synced USD-to-CNY rate when available.
// ============================================================================
    const isCny = currency === 'CNY';
    $('pref-cny-rate-mode-wrap')?.classList.toggle('hidden', !isCny);
    $('pref-cny-rate-wrap').classList.toggle('hidden', !isCny);

    const cnyModeEl = $('pref-cny-rate-mode');
    const cnyRateEl = $('pref-cny-rate');
    if (cnyRateEl) {
      const isManual = cnyModeEl?.value === 'manual';
      cnyRateEl.readOnly = !isManual;
      cnyRateEl.title = isManual ? '' : t('settings.cnyAutoTitle');
      if (!isManual) {
        const syncedFx = Number(state.snapshot?.pricingSync?.usdToCnyRate);
        if (Number.isFinite(syncedFx) && syncedFx > 0) {
          cnyRateEl.value = syncedFx;
        }
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================

    const subPlan = $('pref-sub-plan').value;
    $('pref-sub-custom-wrap').classList.toggle('hidden', subPlan !== 'custom');

    const subInfo = state.snapshot?.global?.subscription;
    const hintEl = $('pref-sub-detected-hint');
    if (subPlan === 'auto' && subInfo) {
      const detectedLabel = getPlanLabel(subInfo.detectedPlanId, subInfo.detectedPlanLabel);
      hintEl.textContent = t('settings.subDetectedHint', {
        plan: detectedLabel,
        usd: num(subInfo.detectedMonthlyUsd, 0).toFixed(2),
      });
      hintEl.classList.remove('hidden');
    } else {
      hintEl.textContent = '';
      hintEl.classList.add('hidden');
    }
    renderCatalogPreviewTable();
  }

  function populateSettingsForm(prefs) {
    if (!prefs) return;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Update default soft/hard context limit fallbacks in populateSettingsForm to 409600 / 512000.
// ============================================================================
    const rawSoft = Number(prefs.softContextLimit);
    const rawHard = Number(prefs.hardContextLimit);
    $('pref-soft-limit').value = Number.isFinite(rawSoft) && rawSoft > 0 ? rawSoft : 409600;
    $('pref-hard-limit').value = Number.isFinite(rawHard) && rawHard > 0 ? rawHard : 512000;
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
    const unitSelect = $('pref-token-unit');
    if (unitSelect) {
      unitSelect.value = VALID_TOKEN_UNITS.includes(prefs.tokenUnit) ? prefs.tokenUnit : 'auto';
    }
    $('pref-currency').value = prefs.currency === 'CNY' ? 'CNY' : 'USD';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Populate #pref-cny-rate-mode from prefs.cnyRateMode.
// ============================================================================
    if ($('pref-cny-rate-mode')) {
      $('pref-cny-rate-mode').value = prefs.cnyRateMode === 'manual' ? 'manual' : 'auto';
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
    $('pref-cny-rate').value = num(prefs.cnyRate, 7.25);
    $('pref-sub-plan').value = prefs.subscriptionPlan || 'auto';
    $('pref-sub-custom-usd').value = num(prefs.customSubscriptionMonthlyUsd, 99.99);

    state.draftModelOverrides = {};
    if (prefs.modelOverrides && typeof prefs.modelOverrides === 'object') {
      for (const [k, v] of Object.entries(prefs.modelOverrides)) {
        if (v && typeof v === 'object') state.draftModelOverrides[k] = { ...v };
      }
    }

    renderModelSelectOptions();
    loadSelectedProfileInputs();
    updateConditionalSettingsFields();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Refresh official pricing sync status when populating settings form.
// ============================================================================
    renderPricingSyncStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:58:00
// Description: Refresh release update status bar when populating settings form.
// ============================================================================
    renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 18:58:00
// ============================================================================
  }

  async function saveSettings(event) {
    event.preventDefault();
    const feedback = $('settings-feedback');
    const saveBtn = $('btn-settings-save');

    stageCurrentProfileFromInputs();

    const softContextLimit = Number($('pref-soft-limit').value);
    const hardContextLimit = Number($('pref-hard-limit').value);
    const rawUnit = $('pref-token-unit')?.value || 'auto';
    const tokenUnit = VALID_TOKEN_UNITS.includes(rawUnit) ? rawUnit : 'auto';
    const currency = $('pref-currency').value === 'CNY' ? 'CNY' : 'USD';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Read and submit cnyRateMode ('auto' | 'manual') in saveSettings.
// ============================================================================
    const cnyRateMode = $('pref-cny-rate-mode')?.value === 'manual' ? 'manual' : 'auto';
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
    const cnyRate = Number($('pref-cny-rate').value);
    const subscriptionPlan = $('pref-sub-plan').value || 'auto';
    const customSubscriptionMonthlyUsd = Number($('pref-sub-custom-usd').value);
    const inputPer1M = Number($('pref-input-price').value);
    const cachedPer1M = Number($('pref-cached-price').value);
    const outputPer1M = Number($('pref-output-price').value);

    if (!Number.isFinite(softContextLimit) || softContextLimit < 1000) {
      feedback.textContent = t('settings.errSoftLimit');
      feedback.className = 'settings-feedback is-error';
      return;
    }
    if (!Number.isFinite(hardContextLimit) || hardContextLimit < softContextLimit) {
      feedback.textContent = t('settings.errHardLimit');
      feedback.className = 'settings-feedback is-error';
      return;
    }
    if (currency === 'CNY' && (!Number.isFinite(cnyRate) || cnyRate <= 0)) {
      feedback.textContent = t('settings.errCnyRate');
      feedback.className = 'settings-feedback is-error';
      return;
    }
    if (
      subscriptionPlan === 'custom' &&
      (!Number.isFinite(customSubscriptionMonthlyUsd) || customSubscriptionMonthlyUsd < 0)
    ) {
      feedback.textContent = t('settings.errCustomSub');
      feedback.className = 'settings-feedback is-error';
      return;
    }
    if (
      !Number.isFinite(inputPer1M) || inputPer1M < 0 ||
      !Number.isFinite(cachedPer1M) || cachedPer1M < 0 ||
      !Number.isFinite(outputPer1M) || outputPer1M < 0
    ) {
      feedback.textContent = t('settings.errPrices');
      feedback.className = 'settings-feedback is-error';
      return;
    }

    saveBtn.disabled = true;
    feedback.textContent = t('settings.saving');
    feedback.className = 'settings-feedback';

    try {
      const payload = {
        softContextLimit: Math.round(softContextLimit),
        hardContextLimit: Math.round(hardContextLimit),
        tokenUnit,
        language: state.lang,
        currency,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Include cnyRateMode in POST /api/prefs payload.
// ============================================================================
        cnyRateMode,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
        cnyRate,
        subscriptionPlan,
        customSubscriptionMonthlyUsd,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Include active model breakdown sort preferences in POST /api/prefs payload.
// ============================================================================
        modelSortBy: VALID_MODEL_SORT_KEYS.includes(state.modelSortBy) ? state.modelSortBy : 'cost',
        modelSortDir: VALID_MODEL_SORT_DIRS.includes(state.modelSortDir) ? state.modelSortDir : 'desc',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
        resetAllModels: Object.keys(state.draftModelOverrides).length === 0,
        modelOverrides: {},
      };
      for (const item of getCatalogList()) {
        payload.modelOverrides[item.id] = state.draftModelOverrides[item.id] || null;
      }

      const res = await apiFetch('/api/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || t('settings.saveFailedDefault'));
      }
      state.tokenUnit = tokenUnit;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Reset Tab 1 card memoization signatures after saving settings.
// ============================================================================
      resetCardRenderSigs();
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
      lastEtag = '';
      setDrawerOpen(false);
      showToast(t('settings.savedToast'));
      await pollSnapshot(true);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Refresh open session receipt modal immediately after saving currency/FX/tariff settings.
// ============================================================================
      if (state.receiptModalOpen) {
        renderReceiptModal();
      }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
    } catch (err) {
      feedback.textContent = t('settings.saveFailed', { msg: err.message });
      feedback.className = 'settings-feedback is-error';
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function handleResyncLedgerClick() {
    const btn = $('btn-resync-ledger');
    const feedback = $('settings-feedback');
    if (!state.resyncConfirmArmed) {
      state.resyncConfirmArmed = true;
      btn.textContent = t('settings.resyncArmed');
      btn.classList.add('is-armed');
      if (state.resyncTimer) clearTimeout(state.resyncTimer);
      state.resyncTimer = setTimeout(resetResyncConfirm, 3500);
      return;
    }

    resetResyncConfirm();
    btn.disabled = true;
    feedback.textContent = t('settings.resyncSyncing');
    feedback.className = 'settings-feedback';
    try {
      const res = await apiFetch('/api/resync-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || t('settings.saveFailedDefault'));
      lastEtag = '';
      feedback.textContent = t('settings.resyncDone', { count: fmtInt(data.conversationsCount) });
      feedback.className = 'settings-feedback is-ok';
      await pollSnapshot(true);
    } catch (err) {
      feedback.textContent = t('settings.resyncFailed', { msg: err.message });
      feedback.className = 'settings-feedback is-error';
    } finally {
      btn.disabled = false;
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Render official pricing sync status bar and handle manual /api/sync-pricing requests.
// ============================================================================
  function renderPricingSyncStatus() {
    const statusEl = $('pricing-sync-status');
    const syncBtn = $('btn-sync-pricing');
    if (!statusEl) return;

    const ps = state.snapshot?.pricingSync || null;
    const isSyncing = Boolean(state.pricingSyncing || ps?.syncing);
    if (syncBtn) {
      syncBtn.disabled = isSyncing;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:22:23
// Description: Mount refresh SVG icon inside #btn-sync-pricing via setIconButtonContent.
// ============================================================================
      setIconButtonContent(
        syncBtn,
        'refresh',
        isSyncing ? t('settings.syncingBtn') : t('settings.syncPricingBtn'),
        12,
      );
// ============================================================================
// [MODIFIED END] 2026-11-20 10:22:23
// ============================================================================
    }

    statusEl.className = 'pricing-sync-status muted-hint';
    statusEl.title = ps?.error ? String(ps.error) : '';

    if (isSyncing) {
      statusEl.textContent = t('settings.syncingOfficial');
      return;
    }

    const sourcesText = Array.isArray(ps?.sources) && ps.sources.length > 0
      ? ps.sources.join(' + ')
      : 'Official';
    const discoveredCount = num(ps?.discoveredCount, 0);
    const discoveredPart = discoveredCount > 0
      ? t('settings.syncDiscoveredPart', { count: discoveredCount })
      : '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Display synced USD-to-CNY FX rate in #pricing-sync-status and
// refresh auto-mode #pref-cny-rate upon manual /api/sync-pricing completion.
// ============================================================================
    const syncedFx = Number(ps?.usdToCnyRate);
    const fxPart = Number.isFinite(syncedFx) && syncedFx > 0
      ? t('settings.syncFxPart', { rate: syncedFx })
      : '';

    if (ps?.status === 'ok' && ps?.lastSyncLocalDate) {
      statusEl.classList.add('is-ok');
      statusEl.textContent = t('settings.syncOk', {
        fx: fxPart,
        date: ps.lastSyncLocalDate,
        sources: sourcesText,
        discovered: discoveredPart,
      });
      return;
    }

    if (ps?.status === 'offline' || ps?.status === 'cached') {
      statusEl.classList.add('is-offline');
    }
    if (ps?.lastSyncLocalDate) {
      statusEl.textContent = t('settings.syncCachedBaseline', {
        fx: fxPart,
        date: ps.lastSyncLocalDate,
      });
      return;
    }
    statusEl.textContent = t('settings.syncBuiltinBaseline', { fx: fxPart });
  }

  async function handleSyncPricingClick() {
    if (state.pricingSyncing) return;
    state.pricingSyncing = true;
    renderPricingSyncStatus();
    try {
      const res = await apiFetch('/api/sync-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      stageCurrentProfileFromInputs();
      if (!state.snapshot) state.snapshot = {};
      if (data?.prefs) state.snapshot.prefs = data.prefs;
      if (data?.pricingSync) state.snapshot.pricingSync = data.pricingSync;
      if (Array.isArray(data?.pricingCatalog)) state.snapshot.pricingCatalog = data.pricingCatalog;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Persist returned proxyStatus from /api/sync-pricing into state.snapshot.
// ============================================================================
      if (data?.proxyStatus) state.snapshot.proxyStatus = data.proxyStatus;
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================

      state.pricingSyncing = false;
      renderModelSelectOptions();
      loadSelectedProfileInputs();
      updateConditionalSettingsFields();
      renderPricingSyncStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Refresh update check status tooltip after storing refreshed proxyStatus from /api/sync-pricing.
// ============================================================================
      renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================
      lastEtag = '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 — Reset render signatures and re-render only the active tab after manual pricing sync.
// ============================================================================
      resetCardRenderSigs();
      if (state.snapshot) {
        renderActiveTab(state.snapshot);
      }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
      if (data?.ok) {
        const discoveredCount = num(data?.pricingSync?.discoveredCount, 0);
        showToast(
          discoveredCount > 0
            ? t('settings.syncSuccessDiscoveredToast', { count: discoveredCount })
            : t('settings.syncSuccessToast'),
        );
      } else {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Localize pricing sync failure messages and display them with warn toast tone.
// ============================================================================
        const errMsg = formatUpdateErrorMessage(
          data?.pricingSync?.error || t('settings.syncOfflineHint'),
        );
        showToast(t('settings.syncFailedToast', { msg: errMsg }), 'warn');
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
      }
      await pollSnapshot(true);
    } catch (err) {
      state.pricingSyncing = false;
      renderPricingSyncStatus();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Localize caught pricing sync exceptions and display them with warn toast tone.
// ============================================================================
      const errMsg = formatUpdateErrorMessage(err?.message || 'error');
      showToast(t('settings.syncFailedToast', { msg: errMsg }), 'warn');
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:58:00
// Description: Implement v0.2.4 GitHub Release update pill, settings version check bar,
// localized safe DOM release-notes parser (renderReleaseNotesDom), skip-version flow,
// and SHA-256 verified hot-update + sidecar restart polling workflow.
// ============================================================================
  // ---------------- Release Update Check & Hot-Update Modal ----------------
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Add formatUpdateErrorMessage helper for localized timeout/rate-limit/network errors and bump fallback app version to 0.2.8.
// ============================================================================
  function formatUpdateErrorMessage(rawError, errorCode = '') {
    const raw = String(rawError || '').trim();
    const code = String(errorCode || '').trim().toLowerCase();
    if (
      code === 'timeout' ||
      /aborted due to timeout|timed?\s*out|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT/i.test(raw)
    ) {
      return t('update.errTimeout');
    }
    if (code === 'rate_limit' || /HTTP\s*(?:403|429)|rate\s*limit/i.test(raw)) {
      return t('update.errRateLimit');
    }
    if (
      code === 'network' ||
      /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|ERR_TLS|CERT_/i.test(raw)
    ) {
      return t('update.errNetwork');
    }
    return raw || 'error';
  }

  function getCurrentAppVersion() {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Bump fallback app version to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Bump fallback app version from 0.2.9 to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Bump fallback app version from 0.3.0 to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:36:52
// Description: Bump fallback app version from 0.3.1 to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Bump fallback app version from 0.3.2 to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Bump fallback app version from 0.4.0 to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump fallback app version from 0.4.1 to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump fallback app version from 0.5.0 to 0.5.1.
// ============================================================================
    const raw =
      state.snapshot?.appVersion ||
      state.snapshot?.updateStatus?.currentVersion ||
      state.activeUpdateStatus?.currentVersion ||
      '0.5.1';
    return String(raw).trim().replace(/^[vV]/, '') || '0.5.1';
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:36:52
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================

  function getEffectiveUpdateStatus() {
    return state.snapshot?.updateStatus || state.activeUpdateStatus || null;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Add formatProxyDiagHint helper to format active proxy or direct-connection diagnostics for update tooltips.
// ============================================================================
  function formatProxyDiagHint(us) {
    const ps = state.snapshot?.proxyStatus || null;
    if (ps && typeof ps === 'object') {
      if (ps.enabled && ps.proxyUrl) {
        return t('settings.proxyDiagActive', {
          url: ps.proxyUrl,
          source: ps.source || 'proxy',
        });
      }
      return t('settings.proxyDiagDirect');
    }
    if (typeof us?.proxySummary === 'string' && us.proxySummary.trim()) {
      const sum = us.proxySummary.trim();
      if (sum === 'direct') {
        return t('settings.proxyDiagDirect');
      }
      const colonIdx = sum.indexOf(':');
      if (colonIdx > 0) {
        return t('settings.proxyDiagActive', {
          source: sum.slice(0, colonIdx),
          url: sum.slice(colonIdx + 1),
        });
      }
    }
    return '';
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================

  function fmtReleaseDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function extractLocalizedReleaseLines(markdownText, lang) {
    const normalized = String(markdownText || '').replace(/\r\n?/g, '\n');
    const allLines = normalized.split('\n');

    const sections = [];
    let currentSec = null;
    for (const line of allLines) {
      const h2Match = line.match(/^##\s+(.+?)\s*$/);
      if (h2Match) {
        const heading = h2Match[1].trim();
        let secLang = '';
        if (/^(?:中文|简体中文|zh(?:-cn)?)\b/i.test(heading) || heading.includes('中文')) {
          secLang = 'zh';
        } else if (/^(?:english|en)\b/i.test(heading)) {
          secLang = 'en';
        }
        if (secLang) {
          currentSec = { lang: secLang, lines: [] };
          sections.push(currentSec);
          continue;
        }
      }
      if (currentSec) {
        currentSec.lines.push(line);
      }
    }

    const targetLang = lang === 'en' ? 'en' : 'zh';
    const matchedSec = sections.find(
      (s) => s.lang === targetLang && s.lines.some((l) => l.trim().length > 0),
    );
    const chosenLines = matchedSec ? matchedSec.lines : allLines;

    // Strip trailing/embedded Installation / Checksum / Technical Details sections, SHA-256 lines, and horizontal rules
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Strip checksum/verification/technical sections and standalone SHA-256 lines from release notes, and parse inline code/link tokens nested inside **bold** markdown.
// ============================================================================
    const filtered = [];
    let skippingInstallLevel = 0;
    const skipHeadingRe = /^(?:installation|install\b|安装方式|安装说明|安装指南|安装$|package\s+checksum|archive\s+checksum|checksum|verification|technical\s+details|发布包校验|文件校验|校验信息|验证情况|技术细节)/i;
    const shaLabelRe = /^\s*(?:[-*•]\s*)?(?:\*\*)?(?:archive\s+|压缩包\s*)?sha-?256(?:\*\*)?\s*[:：]/i;
    const shaHexRe = /^\s*(?:[-*•]\s*)?`?[0-9a-f]{64}`?\s*$/i;
    for (const line of chosenLines) {
      const hMatch = line.match(/^(#{1,4})\s+(.+?)\s*$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const hTitle = hMatch[2].trim();
        if (skipHeadingRe.test(hTitle)) {
          skippingInstallLevel = level;
          continue;
        }
        if (skippingInstallLevel > 0 && level <= skippingInstallLevel) {
          skippingInstallLevel = 0;
        }
      }
      if (skippingInstallLevel > 0) continue;
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue;
      if (shaLabelRe.test(line) || shaHexRe.test(line)) continue;
      filtered.push(line);
    }

    return filtered;
  }

  function parseCodeAndLinkTokens(segment) {
    const raw = String(segment || '');
    const parts = [];
    const tokenRe = /`([^`]+)`|\[([^\]]+)\]\([^)]+\)/g;
    let lastIdx = 0;
    let match;
    while ((match = tokenRe.exec(raw)) !== null) {
      if (match.index > lastIdx) {
        parts.push(raw.slice(lastIdx, match.index));
      }
      if (match[1] !== undefined) {
        parts.push(el('code', { className: 'update-notes-code', textContent: match[1] }));
      } else if (match[2] !== undefined) {
        parts.push(match[2]);
      }
      lastIdx = tokenRe.lastIndex;
    }
    if (lastIdx < raw.length) {
      parts.push(raw.slice(lastIdx));
    }
    return parts.length > 0 ? parts : [raw];
  }

  function parseInlineMarkdownTokens(lineText) {
    const raw = String(lineText || '');
    const parts = [];
    const boldRe = /\*\*([^*]+)\*\*/g;
    let lastIdx = 0;
    let match;
    while ((match = boldRe.exec(raw)) !== null) {
      if (match.index > lastIdx) {
        parts.push(...parseCodeAndLinkTokens(raw.slice(lastIdx, match.index)));
      }
      parts.push(el('strong', null, parseCodeAndLinkTokens(match[1])));
      lastIdx = boldRe.lastIndex;
    }
    if (lastIdx < raw.length) {
      parts.push(...parseCodeAndLinkTokens(raw.slice(lastIdx)));
    }
    return parts.length > 0 ? parts : [raw];
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================

  function renderReleaseNotesDom(container, markdownText, lang) {
    if (!container) return;
    const lines = extractLocalizedReleaseLines(markdownText, lang);
    const nodes = [];
    let bulletItems = [];

    const flushBullets = () => {
      if (bulletItems.length > 0) {
        nodes.push(el('ul', { className: 'update-notes-list' }, bulletItems));
        bulletItems = [];
      }
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        flushBullets();
        continue;
      }

      const headingMatch = trimmed.match(/^#{1,4}\s+(.+?)\s*$/);
      if (headingMatch) {
        flushBullets();
        const headingText = headingMatch[1].trim();
        if (/^(?:中文|简体中文|english)\s*$/i.test(headingText)) {
          continue;
        }
        nodes.push(el('h3', { className: 'update-notes-h' }, parseInlineMarkdownTokens(headingText)));
        continue;
      }

      const bulletMatch = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
      if (bulletMatch) {
        bulletItems.push(
          el('li', { className: 'update-notes-item' }, parseInlineMarkdownTokens(bulletMatch[1].trim())),
        );
        continue;
      }

      flushBullets();
      nodes.push(el('p', { className: 'update-notes-p' }, parseInlineMarkdownTokens(trimmed)));
    }
    flushBullets();

    if (nodes.length === 0) {
      container.replaceChildren(
        el('div', { className: 'update-notes-empty', textContent: t('update.emptyNotes') }),
      );
      return;
    }
    container.replaceChildren(...nodes);
  }

  function renderUpdatePill(snap) {
    const pillBtn = $('btn-update-pill');
    if (!pillBtn) return;

    const us = snap?.updateStatus || state.activeUpdateStatus || null;
    const shouldShow = Boolean(us?.shouldPrompt && (us?.latestVersion || us?.latestTag));
    pillBtn.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) return;

    const cleanVer = String(us.latestVersion || us.latestTag || '').trim().replace(/^[vV]/, '');
    const tagLabel = us.latestTag || `v${cleanVer}`;
    const sig = `${state.lang}:${cleanVer}:${tagLabel}`;
    if (state.lastUpdatePillSig !== sig || pillBtn.childElementCount === 0) {
      state.lastUpdatePillSig = sig;
      const tipText = t('update.pillTitle', { tag: tagLabel });
      pillBtn.title = tipText;
      pillBtn.setAttribute('aria-label', tipText);
      pillBtn.replaceChildren(
        el('span', { className: 'update-pill-dot', 'aria-hidden': 'true' }),
        el('span', { className: 'update-pill-text', textContent: t('update.pillText', { ver: cleanVer }) }),
      );
    }
  }

  function renderUpdateCheckStatus() {
    const statusEl = $('update-version-status');
    const checkBtn = $('btn-check-update');
    if (!statusEl) return;

    const curVer = getCurrentAppVersion();
    const us = getEffectiveUpdateStatus();
    const isChecking = Boolean(state.updateChecking || us?.checking);
    const isApplying = Boolean(state.updateApplying || us?.applying);

    if (checkBtn) {
      checkBtn.disabled = isChecking || isApplying;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:22:23
// Description: Mount refresh SVG icon inside #btn-check-update via setIconButtonContent.
// ============================================================================
      setIconButtonContent(
        checkBtn,
        'refresh',
        isChecking ? t('settings.checkingUpdateBtn') : t('settings.checkUpdateBtn'),
        12,
      );
// ============================================================================
// [MODIFIED END] 2026-11-20 10:22:23
// ============================================================================
    }

    const hasUpdate = Boolean(us?.hasUpdate && (us?.latestTag || us?.latestVersion));
    if (isChecking) {
      statusEl.className = 'pricing-sync-status muted-hint tabular-nums';
      statusEl.textContent = t('settings.verChecking');
      statusEl.title = '';
      statusEl.removeAttribute('role');
      statusEl.removeAttribute('tabindex');
      return;
    }

    if (hasUpdate) {
      const cleanNext = String(us.latestVersion || us.latestTag || '').trim().replace(/^[vV]/, '');
      const tag = us.latestTag || `v${cleanNext}`;
      const skipped = Boolean(us.isSkipped);
      statusEl.className = `pricing-sync-status muted-hint tabular-nums is-clickable${skipped ? '' : ' is-ok'}`;
      statusEl.textContent = skipped
        ? t('settings.verSkipped', { cur: curVer, tag })
        : t('settings.verAvailable', { cur: curVer, tag });
      statusEl.title = t('update.pillTitle', { tag });
      statusEl.setAttribute('role', 'button');
      statusEl.setAttribute('tabindex', '0');
      return;
    }

    statusEl.removeAttribute('role');
    statusEl.removeAttribute('tabindex');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Show update check error status for any recent error regardless of prior lastCheckedAtMs and localize tooltip diagnostics.
// ============================================================================
    if (us?.error) {
      const friendlyErr = formatUpdateErrorMessage(us.error, us.errorCode || '');
      const rawErr = String(us.error).trim();
      statusEl.className = 'pricing-sync-status muted-hint tabular-nums is-offline';
      statusEl.textContent = t('settings.verCheckError', { cur: curVer });
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Append proxy diagnostic hint to update check error tooltip via formatProxyDiagHint.
// ============================================================================
      const baseTip = rawErr && rawErr !== friendlyErr
        ? `${friendlyErr} (${rawErr})`
        : friendlyErr;
      const proxyHint = formatProxyDiagHint(us);
      statusEl.title = proxyHint ? `${baseTip} · ${proxyHint}` : baseTip;
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================
      return;
    }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================

    statusEl.className = 'pricing-sync-status muted-hint tabular-nums';
    statusEl.textContent = t('settings.verUpToDate', { cur: curVer });
    statusEl.title = '';
  }

  function setUpdateModalFeedback(mode, message = '', fallbackUrl = '') {
    const box = $('update-modal-feedback');
    if (!box) return;
    if (mode === 'hidden' || !message) {
      box.className = 'update-modal-feedback hidden';
      box.replaceChildren();
      return;
    }

    const cls = mode === 'error' ? 'is-error' : 'is-progress';
    box.className = `update-modal-feedback ${cls}`;
    const children = [el('span', { textContent: message })];
    const trimmedUrl = String(fallbackUrl || '').trim();
    if (/^https:\/\//i.test(trimmedUrl)) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:22:23
// Description: Replace Unicode external arrow with stroke SVG external icon on update fallback link.
// ============================================================================
      children.push(
        el('a', {
          className: 'update-fallback-link',
          href: trimmedUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
          icon('external', 12),
          t('update.fallbackLink'),
        ),
      );
// ============================================================================
// [MODIFIED END] 2026-11-20 10:22:23
// ============================================================================
    }
    box.replaceChildren(...children);
  }

  function syncUpdateModalControls() {
    const busy = Boolean(state.updateApplying);
    const confirmBtn = $('btn-update-confirm');
    const skipBtn = $('btn-update-skip');
    const closeBtn = $('btn-update-close');
    if (confirmBtn) {
      confirmBtn.disabled = busy;
      confirmBtn.textContent = busy ? t('update.confirmApplying') : t('update.confirmBtn');
    }
    if (skipBtn) skipBtn.disabled = busy;
    if (closeBtn) closeBtn.disabled = busy;
  }

  function renderUpdateModalContent() {
    const us = getEffectiveUpdateStatus();
    if (!us) return;

    const curVer = String(us.currentVersion || getCurrentAppVersion()).trim().replace(/^[vV]/, '');
    const nextVer = String(us.latestVersion || us.latestTag || '').trim().replace(/^[vV]/, '');
    const verEl = $('update-modal-ver');
    if (verEl) {
      verEl.textContent = nextVer ? t('update.verRange', { cur: curVer, next: nextVer }) : `v${curVer}`;
    }

    const dateEl = $('update-modal-date');
    if (dateEl) {
      const dateStr = fmtReleaseDate(us.publishedAt);
      if (dateStr) {
        dateEl.textContent = t('update.publishedAt', { date: dateStr });
        dateEl.classList.remove('hidden');
      } else {
        dateEl.textContent = '';
        dateEl.classList.add('hidden');
      }
    }

    renderReleaseNotesDom($('update-notes-body'), us.releaseNotes || '', state.lang);
    syncUpdateModalControls();
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: B5 — Add modal focus capture/restore and Tab focus-trap helpers for accessible dialogs.
// ============================================================================
  function captureModalReturnFocus() {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    state.modalReturnFocusEl = active && typeof active.focus === 'function' ? active : null;
  }

  function restoreModalReturnFocus(fallbackId = '') {
    const target =
      (state.modalReturnFocusEl && state.modalReturnFocusEl.isConnected !== false ? state.modalReturnFocusEl : null) ||
      (fallbackId ? $(fallbackId) : null);
    state.modalReturnFocusEl = null;
    if (target && typeof target.focus === 'function') {
      try {
        target.focus();
      } catch {
        // Ignore focus errors in headless environments
      }
    }
  }

  function trapModalTabKey(modalEl, event) {
    if (!modalEl || typeof modalEl.querySelectorAll !== 'function') return;
    const focusables = Array.from(
      modalEl.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter((node) => !node.classList?.contains('hidden') && node.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !modalEl.contains?.(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !modalEl.contains?.(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  function openUpdateModal(customStatus = null) {
    const us = customStatus || getEffectiveUpdateStatus();
    if (!us) return;
    captureModalReturnFocus();
    state.activeUpdateStatus = us;
    state.updateModalOpen = true;
    if (!state.updateApplying) {
      setUpdateModalFeedback('hidden');
    }
    renderUpdateModalContent();
    $('update-modal')?.classList.remove('hidden');
    $('btn-update-confirm')?.focus();
  }

  function closeUpdateModal() {
    if (state.updateApplying) return;
    state.updateModalOpen = false;
    $('update-modal')?.classList.add('hidden');
    restoreModalReturnFocus('btn-update-pill');
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================

  async function handleSkipUpdateClick() {
    if (state.updateApplying) return;
    const us = getEffectiveUpdateStatus();
    const cleanNext = String(us?.latestVersion || us?.latestTag || '').trim().replace(/^[vV]/, '');
    const tag = String(us?.latestTag || (cleanNext ? `v${cleanNext}` : '')).trim();
    if (!tag) {
      closeUpdateModal();
      return;
    }

    if (state.snapshot) {
      if (state.snapshot.prefs) state.snapshot.prefs.skippedReleaseTag = tag;
      if (state.snapshot.updateStatus) {
        state.snapshot.updateStatus = {
          ...state.snapshot.updateStatus,
          isSkipped: true,
          shouldPrompt: false,
        };
      }
    }
    if (state.activeUpdateStatus) {
      state.activeUpdateStatus = {
        ...state.activeUpdateStatus,
        isSkipped: true,
        shouldPrompt: false,
      };
    }

    closeUpdateModal();
    if (state.snapshot) renderHeader(state.snapshot);
    else renderUpdatePill(null);
    renderUpdateCheckStatus();

    await patchPrefs({ skippedReleaseTag: tag });
    showToast(t('update.skipToast', { tag }));
    pollSnapshot(true);
  }

  async function handleCheckUpdateClick() {
    if (state.updateChecking || state.updateApplying) return;
    state.updateChecking = true;
    renderUpdateCheckStatus();
    try {
      const res = await apiFetch('/api/check-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!state.snapshot) state.snapshot = {};
      if (data?.appVersion) state.snapshot.appVersion = data.appVersion;
      if (data?.bootId) state.snapshot.bootId = data.bootId;
      if (data?.updateStatus) {
        state.snapshot.updateStatus = data.updateStatus;
        state.activeUpdateStatus = data.updateStatus;
      }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:27:50
// Description: Store returned proxyStatus from /api/check-update before calling renderUpdateCheckStatus.
// ============================================================================
      if (data?.proxyStatus) {
        state.snapshot.proxyStatus = data.proxyStatus;
      }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:27:50
// ============================================================================

      state.updateChecking = false;
      const us = data?.updateStatus || state.activeUpdateStatus;
      if (us?.hasUpdate) {
        if (us.isSkipped || state.snapshot?.prefs?.skippedReleaseTag) {
          await patchPrefs({ skippedReleaseTag: '' });
          us.isSkipped = false;
          us.shouldPrompt = true;
          if (state.snapshot?.prefs) state.snapshot.prefs.skippedReleaseTag = '';
          if (state.snapshot?.updateStatus) {
            state.snapshot.updateStatus.isSkipped = false;
            state.snapshot.updateStatus.shouldPrompt = true;
          }
        }
        renderUpdateCheckStatus();
        if (state.snapshot) renderHeader(state.snapshot);
        else renderUpdatePill({ updateStatus: us });
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Clear stale drawer feedback when an update is found.
// ============================================================================
        const feedbackOnFound = $('settings-feedback');
        if (state.drawerOpen && feedbackOnFound) {
          feedbackOnFound.textContent = '';
          feedbackOnFound.className = 'settings-feedback';
        }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
        openUpdateModal(us);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Format update check failure/up-to-date messages with error toast tone and mirror into #settings-feedback when drawer is open.
// ============================================================================
      } else if (data?.ok === false) {
        renderUpdateCheckStatus();
        const friendlyErr = formatUpdateErrorMessage(
          us?.error || data?.error || 'error',
          us?.errorCode || '',
        );
        const failedMsg = t('settings.checkUpdateFailedToast', { msg: friendlyErr });
        showToast(failedMsg, 'error');
        const feedbackEl = $('settings-feedback');
        if (state.drawerOpen && feedbackEl) {
          feedbackEl.textContent = failedMsg;
          feedbackEl.className = 'settings-feedback is-error';
        }
      } else {
        renderUpdateCheckStatus();
        const curVer = String(data?.appVersion || us?.currentVersion || getCurrentAppVersion())
          .trim()
          .replace(/^[vV]/, '');
        const upToDateMsg = t('settings.upToDateToast', { cur: curVer });
        showToast(upToDateMsg);
        const feedbackEl = $('settings-feedback');
        if (state.drawerOpen && feedbackEl) {
          feedbackEl.textContent = upToDateMsg;
          feedbackEl.className = 'settings-feedback is-ok';
        }
      }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
      lastEtag = '';
      pollSnapshot(true);
    } catch (err) {
      state.updateChecking = false;
      renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Format caught update check errors with error toast tone and mirror into #settings-feedback when drawer is open.
// ============================================================================
      const friendlyErr = formatUpdateErrorMessage(err?.message || 'error');
      const failedMsg = t('settings.checkUpdateFailedToast', { msg: friendlyErr });
      showToast(failedMsg, 'error');
      const feedbackEl = $('settings-feedback');
      if (state.drawerOpen && feedbackEl) {
        feedbackEl.textContent = failedMsg;
        feedbackEl.className = 'settings-feedback is-error';
      }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
    }
  }

  function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForRestartedSidecar(prevBootId, targetVersion) {
    const cleanTarget = String(targetVersion || '').trim().replace(/^[vV]/, '');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Increase sidecar restart polling budget (45 attempts x 3500ms timeout) for high-load restarts.
// ============================================================================
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await sleepMs(400);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      try {
        const res = await apiFetch(
          `/api/snapshot?conv=${encodeURIComponent(selectedConv)}&etag=`,
          { method: 'GET', signal: ctrl.signal },
        );
        if (res.ok) {
          const snap = await res.json();
          const bootChanged = Boolean(prevBootId && snap?.bootId && snap.bootId !== prevBootId);
          const snapVer = String(snap?.appVersion || '').trim().replace(/^[vV]/, '');
          const verMatched = Boolean(cleanTarget && snapVer === cleanTarget);
          if (bootChanged || verMatched) {
            return true;
          }
        }
      } catch {
        // Sidecar is restarting; continue polling every 400ms
      } finally {
        clearTimeout(timer);
      }
    }
    return false;
  }

  async function handleConfirmUpdateClick() {
    if (state.updateApplying) return;
    state.updateApplying = true;
    syncUpdateModalControls();
    renderUpdateCheckStatus();
    setUpdateModalFeedback('progress', t('update.downloading'));

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Hoist parsed response data so both !data?.ok and catch branches can resolve updateStatus.errorCode.
// ============================================================================
    let data = null;
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
    try {
      const res = await apiFetch('/api/apply-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok && !data) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!data?.ok) {
        state.updateApplying = false;
        if (data?.updateStatus) {
          state.activeUpdateStatus = data.updateStatus;
          if (state.snapshot) state.snapshot.updateStatus = data.updateStatus;
        }
        syncUpdateModalControls();
        renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Format hot-update apply failure messages via formatUpdateErrorMessage with errorCode context.
// ============================================================================
        const rawErrMsg = data?.error || `HTTP ${res.status}`;
        const errMsg = formatUpdateErrorMessage(
          rawErrMsg,
          data?.updateStatus?.errorCode || state.activeUpdateStatus?.errorCode,
        );
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
        const fallbackUrl = data?.fallbackUrl || state.activeUpdateStatus?.htmlUrl || '';
        setUpdateModalFeedback('error', t('update.applyFailed', { msg: errMsg }), fallbackUrl);
        return;
      }

      const prevBootId = state.snapshot?.bootId || data?.bootId || '';
      const rawTargetVer =
        data?.targetVersion ||
        state.activeUpdateStatus?.latestVersion ||
        state.activeUpdateStatus?.latestTag ||
        '';
      const cleanTargetVer = String(rawTargetVer).trim().replace(/^[vV]/, '');

      // Pause normal snapshot polling while the sidecar process restarts
      if (state.pollTimer) {
        clearTimeout(state.pollTimer);
        state.pollTimer = null;
      }
      if (state.activePollController) {
        try {
          state.activePollController.abort('hot-update-restart');
        } catch {
          // Ignore abort error
        }
      }

      setUpdateModalFeedback('progress', t('update.restarting'));
      await waitForRestartedSidecar(prevBootId, cleanTargetVer);

      try {
        if (cleanTargetVer) {
          sessionStorage.setItem('tm_updated_version', cleanTargetVer);
        }
        sessionStorage.setItem('tm_updated_lang', state.lang);
      } catch {
        // Ignore restricted sessionStorage in sandboxed contexts
      }
      window.location.reload();
    } catch (err) {
      state.updateApplying = false;
      syncUpdateModalControls();
      renderUpdateCheckStatus();
      const fallbackUrl = state.activeUpdateStatus?.htmlUrl || '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Format caught hot-update apply errors via formatUpdateErrorMessage with errorCode context.
// ============================================================================
      const errMsg = formatUpdateErrorMessage(
        err?.message || 'error',
        data?.updateStatus?.errorCode || state.activeUpdateStatus?.errorCode,
      );
      setUpdateModalFeedback(
        'error',
        t('update.applyFailed', { msg: errMsg }),
        fallbackUrl,
      );
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
      scheduleNextPoll(POLL_INTERVAL_MS, true);
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 18:58:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Implement v0.2.9 session checkout receipt modal (#receipt-modal) controller, flicker-free dirty signature check, synchronous ClipboardItem PNG copy, and PNG download.
// ============================================================================
  // ---------------- Session Checkout Receipt Modal ----------------
  function computeReceiptDataSig(current, prefs) {
    if (!current) return '';
    const scopeObj =
      state.receiptScope === 'today'
        ? current.receipt?.today
        : current.receipt?.all;
    return JSON.stringify([
      state.lang,
      prefs?.currency || 'USD',
      num(prefs?.cnyRate, 0),
      state.receiptScope,
      state.receiptDetailMode,
      current.conversationId || '',
      current.title || '',
      isChildSessionView(current),
      scopeObj
        ? [
            Boolean(scopeObj.hasData),
            scopeObj.startDate || '',
            scopeObj.endDate || '',
            num(scopeObj.startedAtMs, 0),
            num(scopeObj.endedAtMs, 0),
            Math.round(num(scopeObj.activeDurationMs, 0) / 60000),
            num(scopeObj.compactionsCount, 0),
            scopeObj.primaryModel?.model || '',
            scopeObj.primaryModel?.profileLabel || '',
            num(scopeObj.subagentsCount, 0),
            num(scopeObj.grandTotal?.stepsCount, 0),
            num(scopeObj.grandTotal?.totalTokens, 0),
            num(scopeObj.grandTotal?.costActual, 0),
            Array.isArray(scopeObj.children) ? scopeObj.children.length : 0,
          ]
        : [
            num(current.totals?.withChildren?.stepsCount, 0),
            num(current.totals?.withChildren?.totalTokens, 0),
            num(current.totals?.withChildren?.costActual, 0),
            num(current.totals?.mainOnly?.stepsCount, 0),
            num(current.totals?.mainOnly?.costActual, 0),
            Array.isArray(current.children) ? current.children.length : 0,
          ],
    ]);
  }

  function renderReceiptModal() {
    const current = state.snapshot?.current;
    const receiptApi = window.TokenMonitorReceipt;
    if (!current || !receiptApi) return false;

    const btnToday = $('btn-receipt-scope-today');
    const btnAll = $('btn-receipt-scope-all');
    const btnCompact = $('btn-receipt-mode-compact');
    const btnFull = $('btn-receipt-mode-full');

    if (btnToday) btnToday.classList.toggle('active', state.receiptScope === 'today');
    if (btnAll) btnAll.classList.toggle('active', state.receiptScope === 'all');
    if (btnCompact) btnCompact.classList.toggle('active', state.receiptDetailMode === 'compact');
    if (btnFull) btnFull.classList.toggle('active', state.receiptDetailMode === 'full');

    const sessionTitle =
      localizeConvTitle(current.title) ||
      t('common.sessionPrefix', { id: shortId(current.conversationId) });
    const isChildView = isChildSessionView(current);

    const vm = receiptApi.buildReceiptViewModel(current, state.snapshot?.prefs, {
      lang: state.lang,
      scope: state.receiptScope,
      detailMode: state.receiptDetailMode,
      sessionTitle,
      isChildView,
    });
    const canvas = receiptApi.renderReceiptCanvas(vm, { scale: 3 });

    state.lastReceiptCanvas = canvas;
    state.lastReceiptVm = vm;
    state.lastReceiptDataSig = computeReceiptDataSig(current, state.snapshot?.prefs);

    const imgEl = $('receipt-preview-img');
    if (imgEl && canvas && typeof canvas.toDataURL === 'function') {
      imgEl.src = canvas.toDataURL('image/png');
      imgEl.alt = vm?.title || t('receipt.modalTitle');
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Add syncReceiptCopyControl, sync copy button in render/open modal, upgrade handleCopyReceiptClick with /api/copy-receipt sidecar fallback, and remove handleSaveReceiptClick.
// ============================================================================
    syncReceiptCopyControl();
    return true;
  }

  function syncReceiptCopyControl() {
    const btn = $('btn-receipt-copy');
    if (!btn) return;
    btn.disabled = Boolean(state.receiptCopying);
    btn.textContent = state.receiptCopying
      ? t('receipt.copyingBtn')
      : t('receipt.copyBtn');
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: B5 — Capture trigger focus when opening #receipt-modal and restore focus on close.
// ============================================================================
  function openReceiptModal() {
    const current = state.snapshot?.current;
    const receiptApi = window.TokenMonitorReceipt;
    if (!current || !receiptApi) {
      showToast(t('receipt.unavailableToast'), 'warn');
      return;
    }
    captureModalReturnFocus();
    state.receiptScope = current.receipt?.today?.hasData ? 'today' : 'all';
    state.receiptModalOpen = true;
    renderReceiptModal();
    syncReceiptCopyControl();
    $('receipt-modal')?.classList.remove('hidden');
    $('btn-receipt-copy')?.focus();
  }

  function closeReceiptModal() {
    state.receiptModalOpen = false;
    $('receipt-modal')?.classList.add('hidden');
    restoreModalReturnFocus('btn-checkout');
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================

  async function handleCopyReceiptClick() {
    if (state.receiptCopying) return;
    const receiptApi = window.TokenMonitorReceipt;
    const canvas = state.lastReceiptCanvas;
    if (!canvas || !receiptApi) return;

    state.receiptCopying = true;
    syncReceiptCopyControl();

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function' &&
        typeof ClipboardItem === 'function' &&
        typeof receiptApi.canvasToBlob === 'function'
      ) {
        try {
          const blobPromise = receiptApi.canvasToBlob(canvas);
          let item;
          try {
            item = new ClipboardItem({ 'image/png': blobPromise });
          } catch {
            const resolvedBlob = await blobPromise;
            item = new ClipboardItem({ 'image/png': resolvedBlob });
          }
          await navigator.clipboard.write([item]);
          showToast(t('receipt.copiedToast'), 'ok');
          return;
        } catch {
          // Fall back to native sidecar clipboard write in restricted iframe environments.
        }
      }

      const imageBase64 =
        typeof canvas.toDataURL === 'function' ? canvas.toDataURL('image/png') : '';
      if (!imageBase64) {
        throw new Error('Canvas export unavailable');
      }
      const res = await apiFetch('/api/copy-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      showToast(t('receipt.copiedToast'), 'ok');
    } catch (err) {
      showToast(t('receipt.copyFailedToast', { msg: err?.message || 'error' }), 'error');
    } finally {
      state.receiptCopying = false;
      syncReceiptCopyControl();
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================

  // ---------------- Render Header & Stopwatch ----------------
  function formatStatusText(current) {
    if (!current) return t('header.waiting');
    if (current.status === 'GENERATING') {
      const elapsed = fmtElapsed(current.generatingSinceMs);
      return elapsed ? `${t('header.generating')} ${elapsed}` : t('header.generating');
    }
    if (current.status === 'RUNNING_TOOLS') {
      const prog = current.toolProgress;
      const countPart = prog && Number.isFinite(prog.total)
        ? `(${num(prog.done, 0)}/${num(prog.total, 0)})`
        : '';
      const label = current.activeToolLabel ? `: ${current.activeToolLabel}` : '';
      return `${t('header.tools')} ${countPart}${label}`.trim();
    }
    return t('header.idle');
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Add Scheme A canonical model formatters (formatHeaderModelDisplay, formatModelBreakdownRowDisplay) and show activeRawModel in #model-pill tooltip.
// ============================================================================
  function formatHeaderModelDisplay(current) {
    if (!current || typeof current !== 'object') return '—';
    const explicitLabel = String(current.activeModelLabel || '').trim();
    if (explicitLabel) {
      if (/^auto(?:\s*[（(].*)?$/i.test(explicitLabel)) {
        return state.lang === 'en' ? 'Auto' : 'Auto (默认)';
      }
      return explicitLabel;
    }
    const rawActive = String(current.activeModel || '').trim();
    if (!rawActive) return '—';
    if (/^auto(?:\s*[（(].*)?$/i.test(rawActive) || /^unknown$/i.test(rawActive)) {
      return state.lang === 'en' ? 'Auto' : 'Auto (默认)';
    }
    const profId = matchProfileIdForModel(rawActive);
    if (profId && profId !== 'auto') {
      const enMeta = MODEL_PROFILE_EN[profId];
      if (enMeta?.label) return enMeta.label;
      const catalogItem = getCatalogList().find((item) => item.id === profId);
      if (catalogItem?.label) return catalogItem.label;
    }
    return rawActive;
  }

  function formatModelBreakdownRowDisplay(row) {
    const rawModelText = String(row?.model || '').trim() || 'Auto';
    const isAutoRow =
      (row?.profileId === 'auto' || !row?.profileId) &&
      /^auto(?:\s*[（(]|$)/i.test(rawModelText);
    const displayModel = isAutoRow
      ? (state.lang === 'en' ? 'Auto' : 'Auto (默认)')
      : rawModelText;
    const rawSlugs = Array.isArray(row?.rawModels)
      ? row.rawModels.map((s) => String(s || '').trim()).filter(Boolean)
      : [];
    const rawSummary = rawSlugs.length > 0 ? rawSlugs.join(', ') : displayModel;
    const tipModel =
      rawSlugs.length > 0 && rawSummary.toLowerCase() !== displayModel.toLowerCase()
        ? `${displayModel} (${rawSummary})`
        : displayModel;
    const profLabel =
      state.lang === 'en' && row?.profileId && MODEL_PROFILE_EN[row.profileId]
        ? MODEL_PROFILE_EN[row.profileId].label
        : row?.profileLabel;
    const title = profLabel
      ? t('childrenModels.rateTip', {
          model: tipModel,
          profile: profLabel,
          rate: row?.rateDisplay || '',
        })
      : tipModel;
    return { displayModel, title };
  }

  function renderHeader(snap) {
    const current = snap?.current || null;
    const statusPill = $('status-pill');
    const statusText = $('status-text');
    const modelText = $('model-text');

    let statusClass = 'status-empty';
    if (current?.status === 'GENERATING') statusClass = 'status-generating';
    else if (current?.status === 'RUNNING_TOOLS') statusClass = 'status-tools';
    else if (current) statusClass = 'status-idle';

    statusPill.className = `status-pill ${statusClass}`;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:30:56
// Description: Sync status-pill stroke icon (sparkle/wrench) and model-dot --model-accent with defensive guards for minimal DOM hosts.
// ============================================================================
    const wantedStatusIcon =
      current?.status === 'GENERATING'
        ? 'sparkle'
        : current?.status === 'RUNNING_TOOLS'
          ? 'wrench'
          : '';
    if (typeof statusPill.querySelector === 'function' && typeof statusPill.insertBefore === 'function') {
      const existingStatusIcon = statusPill.querySelector('.tm-icon');
      if (wantedStatusIcon) {
        if (!existingStatusIcon || existingStatusIcon.dataset?.iconName !== wantedStatusIcon) {
          if (existingStatusIcon && typeof existingStatusIcon.remove === 'function') {
            existingStatusIcon.remove();
          }
          const svgIcon = icon(wantedStatusIcon, 12);
          if (svgIcon.dataset) svgIcon.dataset.iconName = wantedStatusIcon;
          statusPill.insertBefore(svgIcon, statusText);
        }
      } else if (existingStatusIcon && typeof existingStatusIcon.remove === 'function') {
        existingStatusIcon.remove();
      }
    }
    const nextText = formatStatusText(current);
    statusText.textContent = nextText;
    statusPill.title = nextText;
    state.lastStopwatchText = nextText;

    const displayName = formatHeaderModelDisplay(current);
    const rawModel = String(current?.activeRawModel || current?.activeModel || '').trim();
    modelText.textContent = displayName;
    const modelPillEl = $('model-pill');
    const modelDot = typeof modelPillEl?.querySelector === 'function' ? modelPillEl.querySelector('.model-dot') : null;
    if (modelDot && modelDot.style) {
      const modelAccent = displayName !== '—' ? getModelAccent(displayName, rawModel) : '';
      if (modelAccent) {
        if (typeof modelDot.style.setProperty === 'function') {
          modelDot.style.setProperty('--model-accent', modelAccent);
        } else {
          modelDot.style['--model-accent'] = modelAccent;
        }
      } else if (typeof modelDot.style.removeProperty === 'function') {
        modelDot.style.removeProperty('--model-accent');
      } else {
        delete modelDot.style['--model-accent'];
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 10:30:56
// ============================================================================
    if (displayName !== '—') {
      const showRaw = Boolean(
        rawModel &&
        rawModel.toLowerCase() !== displayName.toLowerCase() &&
        !(/^auto$/i.test(rawModel) && /^auto(?:\s*[（(]|$)/i.test(displayName)),
      );
      const titleModel = showRaw ? `${displayName} (${rawModel})` : displayName;
      $('model-pill').title = t('header.modelTitle', { model: titleModel });
    } else {
      $('model-pill').title = t('header.currentModel');
    }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Show Side Question inspection banner and Back to Main Chat label even when directly bound to a Side Question, and restore Back to Current label otherwise.
// ============================================================================
    // Non-bound & Side Question conversation banner
    const banner = $('nonbound-banner');
    const backBtn = $('btn-back-bound');
    const viewingId = current?.conversationId || selectedConv;
    const isSideQuestionWithParent = Boolean(
      current?.childKind === 'side_question' && current?.parentConversationId,
    );
    const isNonBound = Boolean(
      state.homeConvId && viewingId && viewingId !== state.homeConvId,
    );
    const showBanner = isSideQuestionWithParent || isNonBound;
    banner.classList.toggle('hidden', !showBanner);
    banner.classList.toggle('is-side-question', isSideQuestionWithParent);
    if (showBanner) {
      const label = localizeConvTitle(current?.title) || shortId(viewingId);
      $('nonbound-label').textContent = isSideQuestionWithParent
        ? t('sideQuestions.viewingBanner', { label })
        : t('header.viewing', { label });
      $('nonbound-label').title = `${label} (${viewingId})`;
      if (backBtn) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:22:23
// Description: Mount back SVG icon inside #btn-back-bound instead of plain text/arrow.
// ============================================================================
        setIconButtonContent(
          backBtn,
          'back',
          isSideQuestionWithParent
            ? t('sideQuestions.backToParent')
            : t('header.backToCurrent'),
          12,
        );
      }
    } else if (backBtn) {
      setIconButtonContent(backBtn, 'back', t('header.backToCurrent'), 12);
// ============================================================================
// [MODIFIED END] 2026-11-20 10:22:23
// ============================================================================
    }
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Remove obsolete tab conversation count badge DOM update from renderHeader.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Sync header release update pill visibility and version label in renderHeader.
// ============================================================================
    renderUpdatePill(snap);
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A5 — Sync on-demand stopwatch timer when header status changes.
// ============================================================================
    syncStopwatchLoop();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: A5 — Run the 100ms live stopwatch interval only when live timer targets exist and self-stop at idle.
// ============================================================================
  function hasLiveStopwatchTargets() {
    if (document.hidden) return false;
    const current = state.snapshot?.current;
    if (!current) return false;
    if (current.status === 'GENERATING' && current.generatingSinceMs) return true;
    if (state.activeTab !== 'current') return false;
    if (
      Array.isArray(current.children) &&
      current.children.some((c) => !c.killed && c.status === 'GENERATING' && c.generatingSinceMs)
    ) {
      return true;
    }
    if (
      Array.isArray(current.sideQuestions) &&
      current.sideQuestions.some((sq) => sq.status === 'GENERATING' && sq.generatingSinceMs)
    ) {
      return true;
    }
    return false;
  }

  function syncStopwatchLoop() {
    if (!hasLiveStopwatchTargets()) {
      if (state.stopwatchTimer) {
        clearInterval(state.stopwatchTimer);
        state.stopwatchTimer = null;
      }
      return;
    }
    if (!state.stopwatchTimer) {
      state.stopwatchTimer = setInterval(tickLiveStopwatch, STOPWATCH_INTERVAL_MS);
    }
  }

  function tickLiveStopwatch() {
    if (!hasLiveStopwatchTargets()) {
      syncStopwatchLoop();
      return;
    }
    const current = state.snapshot?.current;
    if (current?.status === 'GENERATING' && current?.generatingSinceMs) {
      const nextText = formatStatusText(current);
      if (nextText !== state.lastStopwatchText) {
        $('status-text').textContent = nextText;
        state.lastStopwatchText = nextText;
      }
    }

    if (state.activeTab === 'current') {
      const childTimers = document.querySelectorAll('[data-child-since]');
      for (const node of childTimers) {
        const since = Number(node.dataset.childSince);
        if (!Number.isFinite(since) || since <= 0) continue;
        const next = fmtElapsed(since);
        if (node.textContent !== next) {
          node.textContent = next;
        }
      }
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Localize Tab 1 cards (Speed, Cost, Context, Cache, Children), add one-click
// /compact button with clipboard copy + warning/critical highlight, and remove cluttered
// cache-saved cost displays from Cost card.
// ============================================================================
  // ---------------- Render Tab 1: Current Conversation ----------------
  function renderSpeedCard(current) {
    const card = $('card-speed');
    const speed = current.speed || {};
    const recent = Array.isArray(speed.recentSteps) ? speed.recentSteps : [];
    const latestRate = fmtRate(speed.latestStepTokPerSec);
    const avgRate = fmtRate(speed.weightedAvgTokPerSec);
    const peakRate = fmtRate(speed.peakTokPerSec);
    const outTok = num(speed.latestStepOutputTokens, 0);
    const durSec = Number(speed.latestStepDurationSec);
    const latestStepDetail = outTok > 0 && Number.isFinite(durSec) && durSec > 0
      ? `${fmtInt(outTok)} tok / ${durSec.toFixed(1)}s`
      : '—';

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add dirty-signature memoization in renderSpeedCard to skip unchanged DOM rebuilds.
// ============================================================================
    const sig = JSON.stringify([
      state.lang,
      current.conversationId || '',
      num(speed.measuredStepsCount, 0),
      num(speed.latestStepTokPerSec, 0),
      num(speed.weightedAvgTokPerSec, 0),
      num(speed.peakTokPerSec, 0),
      outTok,
      Number.isFinite(durSec) ? durSec : null,
      recent.map((s, idx) => [
        num(s?.stepIndex, idx),
        num(s?.tokPerSec, 0),
        num(s?.outputTokens, 0),
        num(s?.durationSec, 0),
        s?.model || '',
      ]),
    ]);
    if (card.childElementCount > 0 && state.cardRenderSigs.speed === sig) return;
    state.cardRenderSigs.speed = sig;
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Wire slot-roll text animations and smooth spark-bar height gliding
// in renderSpeedCard, and isolate Subagent/Swarm Worker Equivalent Cost view +
// rolling metrics in renderCostCard.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Key sparkline bars by stable stepIndex, align header steps badge right, and lock Speed sub-stats to 2 fixed .sub-stats-line rows inside .sub-stats-speed.
// ============================================================================
    const maxRate = recent.reduce((m, s) => Math.max(m, num(s.tokPerSec, 0)), 0);
    const sparkBars = recent.length > 0
      ? recent.map((s, idx) => {
          const r = num(s.tokPerSec, 0);
          const pct = maxRate > 0 ? Math.max(10, Math.round((r / maxRate) * 100)) : 12;
          const isLast = idx === recent.length - 1;
          const stepKey = num(s.stepIndex, idx);
          const tip = `#${stepKey}: ${fmtRate(r)} tok/s (${fmtInt(s.outputTokens)} tok / ${num(s.durationSec, 0).toFixed(1)}s)${s.model ? ' · ' + s.model : ''}`;
          return applySmoothBarSize(
            el('span', {
              className: `spark-bar${isLast ? ' latest' : ''}`,
              title: tip,
            }),
            `cur:spark:step:${stepKey}`,
            'height',
            pct,
          );
        })
      : [el('span', { className: 'empty-inline', textContent: t('speed.empty') })];

    card.replaceChildren(
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:22:23
// Description: Replace .card-title-dot with speed SVG icon in renderSpeedCard.
// ============================================================================
          icon('speed', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:22:23
// ============================================================================
          t('speed.title'),
        ),
        renderRollingText(
          'cur:speed:steps',
          t('speed.measuredSteps', { count: fmtInt(speed.measuredStepsCount) }),
          num(speed.measuredStepsCount, 0),
          { className: 'muted-hint tabular-nums', alignEnd: true },
        ),
      ),
      el('div', { className: 'hero-value-row tabular-nums' },
        renderRollingText(
          'cur:speed:latest',
          latestRate,
          Number(speed.latestStepTokPerSec) > 0 ? Number(speed.latestStepTokPerSec) : null,
          { className: 'hero-value' },
        ),
        el('span', { className: 'hero-unit', textContent: 'tok/s' }),
      ),
      el('div', { className: 'sub-stats-speed tabular-nums' },
        el('div', { className: 'sub-stats-line' },
          el('span', { className: 'sub-stat' },
            t('speed.weightedAvg'),
            el('strong', null,
              renderRollingText(
                'cur:speed:avg',
                `${avgRate} tok/s`,
                Number(speed.weightedAvgTokPerSec) > 0 ? Number(speed.weightedAvgTokPerSec) : null,
              ),
            ),
          ),
          el('span', { className: 'sub-stat' },
            t('speed.peak'),
            el('strong', null,
              renderRollingText(
                'cur:speed:peak',
                `${peakRate} tok/s`,
                Number(speed.peakTokPerSec) > 0 ? Number(speed.peakTokPerSec) : null,
              ),
            ),
          ),
        ),
        el('div', { className: 'sub-stats-line' },
          el('span', { className: 'sub-stat' },
            t('speed.latest'),
            el('strong', null,
              renderRollingText(
                'cur:speed:detail',
                latestStepDetail,
                outTok > 0 ? outTok : null,
              ),
            ),
          ),
        ),
      ),
      el('div', { className: 'sparkline-wrap' },
        el('div', { className: 'sparkline', 'aria-label': t('speed.sparkAria') }, sparkBars),
        recent.length > 0
          ? el('div', { className: 'spark-caption tabular-nums' },
              el('span', { textContent: t('speed.lastSteps', { count: recent.length }) }),
              el('span', { textContent: `Peak ${peakRate} tok/s` }),
            )
          : null,
      ),
    );
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
  }

  function renderCostCard(current, prefs) {
    const card = $('card-cost');
    const totals = current.totals || {};
    const currency = prefs?.currency || 'USD';
    const hasChildren = Array.isArray(current.children) && current.children.length > 0;
    const isChildView = isChildSessionView(current);
    const scopeKey = isChildView
      ? 'mainOnly'
      : (state.costScope === 'mainOnly' ? 'mainOnly' : 'withChildren');
    const scopeData = isChildView
      ? (totals.mainOnly || {})
      : (totals[scopeKey] || totals.mainOnly || totals.withChildren || {});

    const costActual = num(scopeData.costActual, 0);
    const totalTokens = num(
      scopeData.totalTokens,
      num(scopeData.inputUncachedTokens, 0) + num(scopeData.cacheReadTokens, 0) + num(scopeData.outputTokens, 0),
    );

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add dirty-signature memoization and single-line sub-stats lock in renderCostCard.
// ============================================================================
    const sig = JSON.stringify([
      state.lang,
      state.tokenUnit,
      currency,
      num(prefs?.cnyRate, 0),
      current.conversationId || '',
      isChildView,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Include childKind in Cost card dirty signature and show Side Question Only isolated cost badge when viewing a Side Question.
// ============================================================================
      current?.childKind || '',
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================
      hasChildren ? current.children.length : 0,
      scopeKey,
      costActual,
      totalTokens,
      num(scopeData.stepsCount, 0),
      num(scopeData.cacheHitRatePct, 0),
      num(scopeData.outputTokens, 0),
      num(scopeData.cacheReadTokens, 0),
      num(scopeData.inputUncachedTokens, 0),
    ]);
    if (card.childElementCount > 0 && state.cardRenderSigs.cost === sig) return;
    state.cardRenderSigs.cost = sig;

    const headRight = isChildView
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:19:40
// Description: Render dedicated isolated cost badge text and violet accent for Side Question child views.
// ============================================================================
      ? el('span', {
          className: current?.childKind === 'side_question'
            ? 'child-cost-badge is-side-question'
            : 'child-cost-badge',
          textContent: current?.childKind === 'side_question'
            ? t('sideQuestions.isolatedCostBadge')
            : t('cost.childIsolatedBadge'),
        })
// ============================================================================
// [MODIFIED END] 2026-11-19 20:19:40
// ============================================================================
      : el('div', { className: 'seg-toggle', role: 'group', 'aria-label': t('cost.scopeAria') },
          el('button', {
            type: 'button',
            className: `seg-btn${scopeKey === 'withChildren' ? ' active' : ''}`,
            textContent: hasChildren
              ? t('cost.withChildrenCount', { count: current.children.length })
              : t('cost.withChildren'),
            onClick: () => {
              if (state.costScope !== 'withChildren') {
                state.costScope = 'withChildren';
                if (state.snapshot?.current) renderCostCard(state.snapshot.current, state.snapshot.prefs);
              }
            },
          }),
          el('button', {
            type: 'button',
            className: `seg-btn${scopeKey === 'mainOnly' ? ' active' : ''}`,
            textContent: t('cost.mainOnly'),
            onClick: () => {
              if (state.costScope !== 'mainOnly') {
                state.costScope = 'mainOnly';
                if (state.snapshot?.current) renderCostCard(state.snapshot.current, state.snapshot.prefs);
              }
            },
          }),
        );

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:22:23
// Description: Split hero cost into .hero-currency + rolling integer/fraction parts, replace card-title-dot with cost icon, and add .btn-soft + receipt icon to #btn-checkout.
// ============================================================================
    const fullCostText = fmtCost(costActual, currency);
    const costMatch = fullCostText.match(/^([^0-9]*?)([0-9,]+)(\.[0-9]+)?$/);
    const heroCostNode = costMatch
      ? el('span', { className: 'hero-value' },
          costMatch[1] ? el('span', { className: 'hero-currency', textContent: costMatch[1] }) : null,
          renderRollingText('cur:cost:hero:int', costMatch[2], costActual),
          costMatch[3]
            ? renderRollingText('cur:cost:hero:frac', costMatch[3], costActual, { className: 'hero-frac' })
            : null,
        )
      : renderRollingText('cur:cost:hero', fullCostText, costActual, { className: 'hero-value' });

    card.replaceChildren(
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
          icon('cost', 14, 'card-title-icon'),
          t('cost.title'),
        ),
        headRight,
      ),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Render Zero-CLS .hero-value-row.has-action with right-aligned #btn-checkout button in renderCostCard.
// ============================================================================
      el('div', { className: 'hero-value-row has-action tabular-nums' },
        heroCostNode,
        el('button', {
          id: 'btn-checkout',
          type: 'button',
          className: 'checkout-btn btn-soft',
          title: t('receipt.checkoutTitle'),
          onClick: () => openReceiptModal(),
        },
          icon('receipt', 13),
          t('receipt.checkoutBtn'),
        ),
      ),
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:22:23
// ============================================================================
      el('div', { className: 'sub-stats tabular-nums is-single-line' },
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
        el('span', { className: 'sub-stat' },
          t('cost.steps'),
          el('strong', null, renderRollingText('cur:cost:steps', fmtInt(scopeData.stepsCount), num(scopeData.stepsCount, 0))),
        ),
        el('span', { className: 'sub-stat', title: fmtInt(totalTokens) },
          t('cost.totalTokens'),
          el('strong', null, renderRollingText('cur:cost:totalTok', fmtTokens(totalTokens), totalTokens)),
        ),
      ),
      el('div', { className: 'mini-chips tabular-nums' },
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cost.chipHitRate') }),
          renderRollingText('cur:cost:hitRate', fmtPct(scopeData.cacheHitRatePct), num(scopeData.cacheHitRatePct, 0), { className: 'mini-chip-val' }),
        ),
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cost.chipOutput') }),
          renderRollingText('cur:cost:out', fmtTokens(scopeData.outputTokens), num(scopeData.outputTokens, 0), {
            className: 'mini-chip-val',
            title: fmtInt(scopeData.outputTokens),
          }),
        ),
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cost.chipCacheRead') }),
          renderRollingText('cur:cost:cache', fmtTokens(scopeData.cacheReadTokens), num(scopeData.cacheReadTokens, 0), {
            className: 'mini-chip-val',
            title: fmtInt(scopeData.cacheReadTokens),
          }),
        ),
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cost.chipUncached') }),
          renderRollingText('cur:cost:uncached', fmtTokens(scopeData.inputUncachedTokens), num(scopeData.inputUncachedTokens, 0), {
            className: 'mini-chip-val',
            title: fmtInt(scopeData.inputUncachedTokens),
          }),
        ),
      ),
    );
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================

  function renderContextCard(current) {
    const card = $('card-context');
    const ctx = current.context || {};
    const currentTotal = num(ctx.currentTotal, 0);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Update renderContextCard default soft/hard limits to 409600 / 512000 and align empty usageLevel fallback.
// ============================================================================
    const rawSoft = Number(ctx.softLimit);
    const rawHard = Number(ctx.hardLimit);
    const softLimit = Number.isFinite(rawSoft) && rawSoft > 0 ? rawSoft : 409600;
    const hardLimit = Number.isFinite(rawHard) && rawHard > 0 ? rawHard : 512000;
    const hardPct = num(ctx.hardUsagePct, (currentTotal / hardLimit) * 100);
    const softPct = num(ctx.softUsagePct, (currentTotal / softLimit) * 100);
    const rawLevel = ctx.usageLevel;
    const level = ['HEALTHY', 'WARNING', 'CRITICAL'].includes(rawLevel)
      ? rawLevel
      : (currentTotal >= hardLimit ? 'CRITICAL' : currentTotal >= softLimit ? 'WARNING' : 'HEALTHY');
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add dirty-signature memoization in renderContextCard (including tokenUnit and compactCopied state).
// ============================================================================
    const isCopied = state.compactCopiedUntil > Date.now();
    const sig = JSON.stringify([
      state.lang,
      state.tokenUnit,
      current.conversationId || '',
      isCopied,
      currentTotal,
      softLimit,
      hardLimit,
      hardPct,
      softPct,
      level,
      Boolean(ctx.compactedPendingTurn),
      num(ctx.compactedPreTotal, 0),
      num(ctx.compactionSummaryTokens, currentTotal),
    ]);
    if (card.childElementCount > 0 && state.cardRenderSigs.context === sig) return;
    state.cardRenderSigs.context = sig;
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================

    const softMarkerPct = Math.min(100, Math.max(0, (softLimit / hardLimit) * 100));
    const totalBarPct = Math.min(100, Math.max(0, (currentTotal / hardLimit) * 100));
    const healthyPct = level === 'HEALTHY'
      ? totalBarPct
      : Math.min(totalBarPct, softMarkerPct);
    const overflowPct = Math.max(0, totalBarPct - healthyPct);

    const levelMessages = {
      HEALTHY: t('context.healthy', { soft: fmtTokens(softLimit), softPct: softPct.toFixed(1) }),
      WARNING: t('context.warning', { soft: fmtTokens(softLimit) }),
      CRITICAL: t('context.critical', { hard: fmtTokens(hardLimit) }),
    };

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Add .btn-soft and compress/check SVG icon to compact button in renderContextCard.
// ============================================================================
    const compactClasses = [
      'compact-btn',
      'btn-soft',
      level === 'WARNING' ? 'is-warning' : level === 'CRITICAL' ? 'is-critical' : '',
      isCopied ? 'is-copied' : '',
    ].filter(Boolean).join(' ');

    const compactBtn = el('button', {
      type: 'button',
      className: compactClasses,
      title: t('context.compactTitle'),
      onClick: async () => {
        const copied = await copyTextToClipboard('/compact');
        state.compactCopiedUntil = Date.now() + 1800;
        if (state.compactTimer) clearTimeout(state.compactTimer);
        state.compactTimer = setTimeout(() => {
          state.compactCopiedUntil = 0;
          if (state.snapshot?.current) renderContextCard(state.snapshot.current);
        }, 1800);
        if (state.snapshot?.current) renderContextCard(state.snapshot.current);

        const viewingId = current.conversationId || selectedConv;
        const isNonBound = Boolean(
          state.homeConvId && viewingId && viewingId !== state.homeConvId,
        );
        if (isNonBound && typeof window.sidecar?.ui?.toggleConversation === 'function') {
          window.sidecar.ui.toggleConversation(viewingId);
        }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:36
// Description: Use warn tone when copying /compact to clipboard fails.
// ============================================================================
        showToast(
          copied ? t('context.compactToast') : t('context.compactFailed'),
          copied ? 'ok' : 'warn',
        );
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:36
// ============================================================================
      },
    },
      icon(isCopied ? 'check' : 'compress', 13),
      isCopied ? t('context.compactCopied') : t('context.compactBtn'),
    );
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Wire slot-roll text animations and smooth bar width gliding in renderContextCard.
// ============================================================================
    let overflowSegNode = null;
    if (overflowPct > 0) {
      overflowSegNode = applySmoothBarSize(
        el('div', {
          className: `ctx-seg-overflow ${level === 'CRITICAL' ? 'is-critical' : 'is-warning'}`,
        }),
        'cur:ctx:barOverflow',
        'width',
        overflowPct,
      );
    } else {
      setBoundedMotionMemory(barMetricMemory, 'cur:ctx:barOverflow', 0);
    }

    card.replaceChildren(
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Replace .card-title-dot with context SVG icon in renderContextCard.
// ============================================================================
          icon('context', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================
          t('context.title'),
        ),
        el('div', { className: 'ctx-head-right' },
          renderRollingText(
            'cur:ctx:summary',
            `${fmtTokens(currentTotal)} / ${fmtTokens(hardLimit)} (${hardPct.toFixed(1)}%)`,
            currentTotal,
            {
              className: 'ctx-summary-num tabular-nums',
              title: `${fmtInt(currentTotal)} / ${fmtInt(hardLimit)} tokens`,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Set alignEnd: true on right-aligned cur:ctx:summary rolling header value.
// ============================================================================
              alignEnd: true,
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
            },
          ),
          compactBtn,
        ),
      ),
      el('div', { className: 'ctx-bar-wrap' },
        el('div', { className: 'ctx-bar-track', role: 'progressbar', 'aria-valuenow': Math.round(hardPct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
          applySmoothBarSize(
            el('div', { className: 'ctx-seg-healthy' }),
            'cur:ctx:barHealthy',
            'width',
            healthyPct,
          ),
          overflowSegNode,
        ),
        el('div', {
          className: 'ctx-soft-tick',
          style: { left: `${softMarkerPct.toFixed(2)}%` },
          title: t('context.tickTitle', { soft: fmtInt(softLimit), pct: softMarkerPct.toFixed(1) }),
        }),
      ),
      el('div', { className: 'ctx-scale-row tabular-nums' },
        renderRollingText('cur:ctx:currentTok', t('context.currentTok', { tokens: fmtInt(currentTotal) }), currentTotal),
        el('span', { textContent: t('context.limitsRow', { soft: fmtTokens(softLimit), hard: fmtTokens(hardLimit) }) }),
      ),
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:08:00
// Description: Render post-compaction banner inside .level-banner when ctx.compactedPendingTurn is true.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Prepend check/alert SVG icon in context .level-banner (uppercase prefixes dropped from I18N).
// ============================================================================
      el('div', { className: `level-banner ${level}` },
        icon(Boolean(ctx.compactedPendingTurn) || level === 'HEALTHY' ? 'check' : 'alert', 14),
        el('span', {
          textContent: Boolean(ctx.compactedPendingTurn)
            ? t('context.compactedBanner', {
                preTotal: fmtInt(num(ctx.compactedPreTotal, 0)),
                summary: fmtInt(num(ctx.compactionSummaryTokens, currentTotal)),
              })
            : levelMessages[level],
        }),
      ),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 16:08:00
// ============================================================================
    );
  }

  function renderCacheCard(current) {
    const card = $('card-cache');
    const ctx = current.context || {};
    const cacheRead = num(ctx.latestCacheRead, 0);
    const uncached = num(ctx.latestInputUncached, 0);
    const hitPct = num(ctx.latestCacheHitRatePct, 0);
    const netDelta = num(ctx.latestNetDelta, 0);
    const spikes = Array.isArray(ctx.topSpikes) ? ctx.topSpikes : [];

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add dirty-signature memoization in renderCacheCard.
// ============================================================================
    const sig = JSON.stringify([
      state.lang,
      state.tokenUnit,
      state.spikesExpanded,
      current.conversationId || '',
      cacheRead,
      uncached,
      hitPct,
      netDelta,
      spikes.map((sp) => [
        num(sp?.stepIndex, 0),
        num(sp?.deltaTokens, 0),
        num(sp?.totalAfter, 0),
        sp?.triggerSummary || '',
      ]),
    ]);
    if (card.childElementCount > 0 && state.cardRenderSigs.cache === sig) return;
    state.cardRenderSigs.cache = sig;
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================

    const totalLatest = cacheRead + uncached;
    const hitBarPct = totalLatest > 0 ? (cacheRead / totalLatest) * 100 : 0;
    const missBarPct = totalLatest > 0 ? 100 - hitBarPct : 0;

    const visibleSpikes = state.spikesExpanded ? spikes : spikes.slice(0, 3);
    const canToggleSpikes = spikes.length > 3;

    const spikesSection = el('div', null,
      el('div', { className: 'spikes-header' },
        el('span', {
          className: 'spikes-title',
          textContent: t('cache.spikesTitle', { count: spikes.length ? ` · ${spikes.length}` : '' }),
        }),
        canToggleSpikes
          ? el('button', {
              type: 'button',
              className: 'mini-btn',
              textContent: state.spikesExpanded
                ? t('cache.collapse')
                : t('cache.expandAll', { count: spikes.length }),
              onClick: () => {
                state.spikesExpanded = !state.spikesExpanded;
                if (state.snapshot?.current) renderCacheCard(state.snapshot.current);
              },
            })
          : null,
      ),
      spikes.length > 0
        ? el('div', { className: 'spikes-list' },
            visibleSpikes.map((sp) => {
              const summary = sp.triggerSummary || 'Context jump';
              return el('div', { className: 'spike-row', title: summary },
                el('div', { className: 'spike-left' },
                  el('span', { className: 'spike-step tabular-nums', textContent: `#${num(sp.stepIndex, 0)}` }),
                  el('span', { className: 'spike-summary', textContent: summary }),
                ),
                el('div', {
                  className: 'spike-right tabular-nums',
                  title: `+${fmtInt(sp.deltaTokens)} → ${fmtInt(sp.totalAfter)}`,
                },
                  `+${fmtTokens(sp.deltaTokens)}`,
                  el('span', { className: 'spike-after', textContent: `→ ${fmtTokens(sp.totalAfter)}` }),
                ),
              );
            }),
          )
        : el('div', { className: 'empty-inline', textContent: t('cache.spikesEmpty') }),
    );

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Wire slot-roll text animations and smooth hit/miss bar gliding in renderCacheCard.
// ============================================================================
    card.replaceChildren(
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Replace .card-title-dot with cache SVG icon in renderCacheCard.
// ============================================================================
          icon('cache', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================
          t('cache.title'),
        ),
        renderRollingText('cur:cache:headRate', t('cache.hitRate', { pct: hitPct.toFixed(1) }), hitPct, {
          className: 'muted-hint tabular-nums',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Set alignEnd: true on right-aligned cur:cache:headRate rolling header value.
// ============================================================================
          alignEnd: true,
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
        }),
      ),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: B6 — Localize cache segment track hover tooltip via cache.trackTip.
// ============================================================================
      el('div', { className: 'cache-seg-track', title: t('cache.trackTip', { cached: fmtInt(cacheRead), uncached: fmtInt(uncached) }) },
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================
        applySmoothBarSize(el('div', { className: 'cache-seg-hit' }), 'cur:cache:barHit', 'width', hitBarPct),
        applySmoothBarSize(el('div', { className: 'cache-seg-miss' }), 'cur:cache:barMiss', 'width', missBarPct),
      ),
      el('div', { className: 'cache-metrics-row tabular-nums' },
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cache.chipHit') }),
          renderRollingText('cur:cache:chipHit', `${fmtTokens(cacheRead)} (${hitPct.toFixed(1)}%)`, cacheRead, {
            className: 'mini-chip-val',
            title: fmtInt(cacheRead),
          }),
        ),
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cache.chipUncached') }),
          renderRollingText('cur:cache:chipUncached', fmtTokens(uncached), uncached, {
            className: 'mini-chip-val',
            title: fmtInt(uncached),
          }),
        ),
        el('div', { className: 'mini-chip' },
          el('span', { className: 'mini-chip-label', textContent: t('cache.chipNetDelta') }),
          renderRollingText('cur:cache:chipDelta', fmtDeltaTokens(netDelta), netDelta, {
            className: 'mini-chip-val',
            title: fmtInt(netDelta),
          }),
        ),
      ),
      spikesSection,
    );
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Add safe SVG dual-chevron builder, model breakdown sorter, sort toggle,
// and sortable table header builder for both Tab 1 and Tab 2 model tables.
// ============================================================================
  function createDualChevronSvg(isActive, dir) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 10 14');
    svg.setAttribute('width', '9');
    svg.setAttribute('height', '12');
    svg.setAttribute('class', 'sort-chevron-svg');
    svg.setAttribute('aria-hidden', 'true');

    const up = document.createElementNS(SVG_NS, 'path');
    up.setAttribute('d', 'M2 5.2L5 2L8 5.2');
    up.setAttribute(
      'class',
      `sort-chevron-up${isActive ? (dir === 'asc' ? ' is-lit' : ' is-dim') : ''}`,
    );

    const down = document.createElementNS(SVG_NS, 'path');
    down.setAttribute('d', 'M2 8.8L5 12L8 8.8');
    down.setAttribute(
      'class',
      `sort-chevron-down${isActive ? (dir === 'desc' ? ' is-lit' : ' is-dim') : ''}`,
    );

    svg.appendChild(up);
    svg.appendChild(down);
    return svg;
  }

  function toggleModelSort(colKey) {
    if (!VALID_MODEL_SORT_KEYS.includes(colKey)) return;
    if (state.modelSortBy === colKey) {
      state.modelSortDir = state.modelSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.modelSortBy = colKey;
      state.modelSortDir = 'desc';
    }
    if (state.snapshot?.prefs) {
      state.snapshot.prefs.modelSortBy = state.modelSortBy;
      state.snapshot.prefs.modelSortDir = state.modelSortDir;
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 — Render only the active tab on model sort toggle (inactive tab updates via signature on tab switch).
// ============================================================================
    if (state.snapshot) {
      renderActiveTab(state.snapshot);
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
    patchPrefs({
      modelSortBy: state.modelSortBy,
      modelSortDir: state.modelSortDir,
    });
  }

  function sortModelBreakdownRows(rows, getTotalTokens) {
    const list = Array.isArray(rows) ? [...rows] : [];
    const sortBy = state.modelSortBy === 'total' ? 'total' : 'cost';
    const dirSign = state.modelSortDir === 'asc' ? 1 : -1;
    const getTotal = typeof getTotalTokens === 'function'
      ? getTotalTokens
      : (r) => num(r?.totalTokens, 0);

    list.sort((a, b) => {
      const aCost = num(a?.costActual, 0);
      const bCost = num(b?.costActual, 0);
      const aTotal = getTotal(a);
      const bTotal = getTotal(b);
      const primary = sortBy === 'total' ? (aTotal - bTotal) : (aCost - bCost);
      if (primary !== 0) return primary * dirSign;
      const secondary = sortBy === 'total' ? (bCost - aCost) : (bTotal - aTotal);
      if (secondary !== 0) return secondary;
      return String(a?.model || '').localeCompare(String(b?.model || ''));
    });
    return list;
  }

  function createSortableHeaderCell({ colKey, label, baseTitle = '', extraClass = '' }) {
    const isActive = state.modelSortBy === colKey;
    const dir = state.modelSortDir === 'asc' ? 'asc' : 'desc';
    const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const tipKey = isActive
      ? (dir === 'asc' ? 'childrenModels.sortAscTip' : 'childrenModels.sortDescTip')
      : 'childrenModels.sortIdleTip';
    const sortTip = t(tipKey, { col: label });
    const fullTitle = baseTitle ? `${baseTitle} · ${sortTip}` : sortTip;
    const thClass = ['num', extraClass].filter(Boolean).join(' ');

    const btn = el('button', {
      type: 'button',
      className: `th-sort-btn${isActive ? ' is-active' : ''}`,
      title: fullTitle,
      'aria-label': `${label} — ${sortTip}`,
      onClick: () => toggleModelSort(colKey),
    },
      el('span', { textContent: label }),
      createDualChevronSvg(isActive, dir),
    );

    return el('th', { className: thClass, 'aria-sort': ariaSort }, btn);
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:20:30
// Description: Add getModelRowCacheHitMeta(row) helper for per-model cache hit rate display, tiering, and tooltips in Tab 1 and Tab 2 tables.
// ============================================================================
  function getModelRowCacheHitMeta(row) {
    const uncached = num(row?.inputUncachedTokens ?? row?.inputTokens, 0);
    const cached = num(row?.cacheReadTokens, 0);
    const totalIn = uncached + cached;
    const rawPct = row?.cacheHitRatePct;
    const pct =
      rawPct !== null && rawPct !== undefined && rawPct !== '' && Number.isFinite(Number(rawPct))
        ? Number(rawPct)
        : (totalIn > 0 ? (cached / totalIn) * 100 : 0);
    const hasInput = totalIn > 0;
    const tierClass = !hasInput
      ? 'is-none'
      : pct >= 75
        ? 'is-high'
        : pct >= 40
          ? 'is-mid'
          : 'is-low';
    const text = hasInput ? fmtPct(pct) : '—';
    const title = hasInput
      ? t('childrenModels.colCacheHitCellTip', {
          cached: fmtInt(cached),
          totalIn: fmtInt(totalIn),
          pct: fmtPct(pct),
        })
      : '';
    return { hasInput, pct, tierClass, text, title };
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 20:20:30
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Add sortChildrenForDisplay helper and upgrade renderChildrenAndModelsCard with Top-5 active folding, 400px scrollable expansion + scroll preservation, relative time, and Ended status badge.
// ============================================================================
  function getChildActivityTier(ch) {
    if (!ch?.killed && ch?.status === 'GENERATING') return 0;
    if (!ch?.killed && ch?.status === 'RUNNING_TOOLS') return 1;
    return 2;
  }

  function sortChildrenForDisplay(children) {
    if (!Array.isArray(children) || children.length <= 1) {
      return Array.isArray(children) ? [...children] : [];
    }
    return children
      .map((ch, idx) => ({ ch, idx }))
      .sort((a, b) => {
        const tierDiff = getChildActivityTier(a.ch) - getChildActivityTier(b.ch);
        if (tierDiff !== 0) return tierDiff;
        const timeDiff = num(b.ch?.updatedAtMs, 0) - num(a.ch?.updatedAtMs, 0);
        if (timeDiff !== 0) return timeDiff;
        return a.idx - b.idx;
      })
      .map((entry) => entry.ch);
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================

  function renderChildrenAndModelsCard(current, prefs) {
    const card = $('card-children-models');
    const currency = prefs?.currency || 'USD';
    const children = Array.isArray(current.children) ? current.children : [];
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Sort children by live activity tier + recency before memoization and rendering.
// ============================================================================
    const sortedChildren = sortChildrenForDisplay(children);
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Prefer isolated totals.mainOnlyByModel when inspecting a child session with no children.
// ============================================================================
    const isChildView = isChildSessionView(current);
    const byModel =
      isChildView && children.length === 0 && Array.isArray(current.totals?.mainOnlyByModel)
        ? current.totals.mainOnlyByModel
        : (Array.isArray(current.totals?.byModel) ? current.totals.byModel : []);
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Add dirty-signature memoization in renderChildrenAndModelsCard covering sort order, currency/FX, tokenUnit, children, and model breakdown rows.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Include childrenExpanded, killed flag, and formatted relative time in childrenModels dirty signature, and preserve expanded scroll offset across re-renders.
// ============================================================================
    const sig = JSON.stringify([
      state.lang,
      state.tokenUnit,
      currency,
      num(prefs?.cnyRate, 0),
      state.modelSortBy,
      state.modelSortDir,
      Boolean(state.childrenExpanded),
      current.conversationId || '',
      isChildView,
      sortedChildren.map((ch) => [
        ch?.conversationId || '',
        ch?.kind || '',
        ch?.status || '',
        Boolean(ch?.killed),
        ch?.updatedAtMs ? fmtRelTime(ch.updatedAtMs) : '',
        num(ch?.generatingSinceMs, 0),
        ch?.name || '',
        ch?.role || '',
        ch?.model || '',
        num(ch?.contextTotal, 0),
        num(ch?.latestTokPerSec, 0),
        num(ch?.outputTokens, 0),
        num(ch?.costActual, 0),
      ]),
      byModel.map((row) => [
        row?.model || '',
        row?.profileId || '',
        row?.profileLabel || '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Include merged row.rawModels in childrenModels dirty signature.
// ============================================================================
        Array.isArray(row?.rawModels) ? row.rawModels.join(',') : '',
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
        row?.rateDisplay || '',
        num(row?.stepsCount, 0),
        num(row?.inputUncachedTokens, 0),
        num(row?.cacheReadTokens, 0),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:20:30
// Description: Include per-model cacheHitRatePct in Tab 1 childrenModels dirty signature.
// ============================================================================
        num(row?.cacheHitRatePct, 0),
// ============================================================================
// [MODIFIED END] 2026-11-19 20:20:30
// ============================================================================
        num(row?.outputTokens, 0),
        num(row?.totalTokens, 0),
        num(row?.costActual, 0),
      ]),
    ]);
    if (card.childElementCount > 0 && state.cardRenderSigs.childrenModels === sig) return;
    state.cardRenderSigs.childrenModels = sig;

    if (state.childrenExpanded) {
      const prevList = card.querySelector('.children-list.is-expanded');
      if (prevList) {
        state.childrenScrollTop = prevList.scrollTop;
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================

    const nodes = [
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Replace .card-title-dot with agents SVG icon in renderChildrenAndModelsCard.
// ============================================================================
          icon('agents', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================
          t('childrenModels.title'),
        ),
        sortedChildren.length > 0
          ? el('span', {
              className: 'muted-hint tabular-nums',
              textContent: t('childrenModels.membersCount', { count: sortedChildren.length }),
            })
          : null,
      ),
    ];

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Render Top-5 recent active subagent/swarm list with header/footer expand controls, 400px scrollable container, relative timestamps, and Ended badge.
// ============================================================================
    const canToggleChildren = sortedChildren.length > MAX_COLLAPSED_CHILDREN;
    const isExpanded = canToggleChildren && Boolean(state.childrenExpanded);
    const visibleChildren = isExpanded
      ? sortedChildren
      : sortedChildren.slice(0, MAX_COLLAPSED_CHILDREN);
    const hiddenCount = Math.max(0, sortedChildren.length - MAX_COLLAPSED_CHILDREN);
    let childrenListEl = null;

    if (sortedChildren.length > 0) {
      const handleToggleChildrenExpand = () => {
        if (state.childrenExpanded) {
          state.childrenExpanded = false;
          state.childrenScrollTop = 0;
        } else {
          state.childrenExpanded = true;
        }
        const latestCurrent = state.snapshot?.current || current;
        const latestPrefs = state.snapshot?.prefs || prefs;
        renderChildrenAndModelsCard(latestCurrent, latestPrefs);
      };

      const subheadText = canToggleChildren && !isExpanded
        ? t('childrenModels.liveSubheadFolded', {
            shown: visibleChildren.length,
            total: sortedChildren.length,
          })
        : t('childrenModels.liveSubhead');

      const childrenHead = el('div', { className: 'children-head' },
        el('div', { className: 'section-subhead', textContent: subheadText }),
        canToggleChildren
          ? el('button', {
              type: 'button',
              className: 'mini-btn',
              textContent: isExpanded
                ? t('childrenModels.collapse')
                : t('childrenModels.expandAll', { count: sortedChildren.length }),
              onClick: handleToggleChildrenExpand,
            })
          : null,
      );

      childrenListEl = el(
        'div',
        { className: isExpanded ? 'children-list is-expanded' : 'children-list' },
        visibleChildren.map((ch) => {
          const isKilled = Boolean(ch.killed);
          const kind = ch.kind === 'swarm' ? 'swarm' : 'subagent';
          const status = ch.status || 'IDLE';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Render child status with stroke SVG icons (sparkle/wrench) and separate [data-child-since] timer span without emoji.
// ============================================================================
          const statusSpan = isKilled
            ? el('span', {
                className: 'child-status tabular-nums ENDED',
                textContent: t('childrenModels.childEnded'),
              })
            : status === 'GENERATING' && ch.generatingSinceMs
              ? el('span', { className: 'child-status tabular-nums GENERATING' },
                  icon('sparkle', 12),
                  el('span', {
                    dataset: { childSince: String(ch.generatingSinceMs) },
                    textContent: fmtElapsed(ch.generatingSinceMs),
                  }),
                )
              : status === 'GENERATING'
                ? el('span', { className: 'child-status tabular-nums GENERATING' },
                    icon('sparkle', 12),
                    t('childrenModels.childGenerating'),
                  )
                : status === 'RUNNING_TOOLS'
                  ? el('span', { className: 'child-status tabular-nums RUNNING_TOOLS' },
                      icon('wrench', 12),
                      t('childrenModels.childRunning'),
                    )
                  : el('span', {
                      className: `child-status tabular-nums ${status}`,
                      textContent: t('childrenModels.childIdle'),
                    });
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================

          const updatedAtNum = Number(ch.updatedAtMs);
          const hasValidUpdatedAt = Number.isFinite(updatedAtNum) && updatedAtNum > 0;
          const relTime = hasValidUpdatedAt ? fmtRelTime(updatedAtNum) : '';
          const topRight = el(
            'div',
            { className: 'child-top-right tabular-nums' },
            relTime
              ? el('span', {
                  className: 'child-rel-time muted-hint',
                  textContent: relTime,
                  title: new Date(updatedAtNum).toLocaleString(),
                })
              : null,
            statusSpan,
          );

          return el('div', { className: isKilled ? 'child-row is-ended' : 'child-row' },
            el('div', { className: 'child-top' },
              el('div', { className: 'child-id-group' },
                el('span', { className: 'child-name', textContent: ch.name || shortId(ch.conversationId) }),
                el('span', { className: `kind-badge ${kind}`, textContent: kind === 'swarm' ? 'Swarm' : 'Subagent' }),
                ch.role && ch.role !== ch.name
                  ? el('span', { className: 'muted-hint', textContent: ch.role })
                  : null,
              ),
              topRight,
            ),
            el('div', { className: 'child-meta' },
              el('div', { className: 'child-stats tabular-nums' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:28:34
// Description: Prepend model identity .model-dot next to child row model name.
// ============================================================================
                el('span', null,
                  createModelDot(ch.modelLabel || ch.model, ch.rawModel),
                  ch.model || 'Auto',
                ),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:28:34
// ============================================================================
                el('span', { title: fmtInt(ch.contextTotal), textContent: `Ctx ${fmtTokens(ch.contextTotal)}` }),
                el('span', { textContent: `${fmtRate(ch.latestTokPerSec)} tok/s` }),
                el('span', { title: fmtInt(ch.outputTokens), textContent: `Out ${fmtTokens(ch.outputTokens)}` }),
                el('span', { textContent: fmtCost(ch.costActual, currency) }),
              ),
              el('div', { className: 'child-actions' },
                el('button', {
                  type: 'button',
                  className: 'mini-btn accent',
                  textContent: t('childrenModels.inspectBtn'),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Record inspected child conversation ID in state.inspectedChildIds before switching view.
// ============================================================================
                  onClick: () => {
                    const cid = String(ch.conversationId || '').toLowerCase();
                    if (cid) state.inspectedChildIds.add(cid);
                    selectConversation(ch.conversationId);
                  },
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
                }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: B6 — Align child row Open Chat button with v0.5.0 .btn-soft + external stroke SVG icon.
// ============================================================================
                el('button', {
                  type: 'button',
                  className: 'mini-btn btn-soft',
                  onClick: () => openConversationInHost(ch.conversationId),
                },
                  icon('external', 12),
                  t('childrenModels.openChatBtn'),
                ),
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================
              ),
            ),
          );
        }),
      );

      if (isExpanded) {
        childrenListEl.addEventListener(
          'scroll',
          () => {
            state.childrenScrollTop = childrenListEl.scrollTop;
          },
          { passive: true },
        );
      }

      const toggleFooter = canToggleChildren
        ? el('button', {
            type: 'button',
            className: 'children-toggle-bar',
            textContent: isExpanded
              ? t('childrenModels.collapseFooter', { shown: MAX_COLLAPSED_CHILDREN })
              : t('childrenModels.expandMoreFooter', {
                  rest: hiddenCount,
                  total: sortedChildren.length,
                }),
            onClick: handleToggleChildrenExpand,
          })
        : null;

      nodes.push(
        el('div', { className: 'children-section' },
          childrenHead,
          childrenListEl,
          toggleFooter,
        ),
      );
    }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

    // ============================================================================
    // [MODIFIED BEGIN] 2026-11-16 21:11:00
    // Description: Expand Tab 1 per-model breakdown table to 7 columns with 总计 (input + cache + output total throughput tokens) and raw model ID display.
    // ============================================================================
    // ============================================================================
    // [MODIFIED BEGIN] 2026-11-17 10:15:00
    // Description: Localize Tab 1 per-model table headers, tooltips, and empty label.
    // ============================================================================
    // ============================================================================
    // [MODIFIED BEGIN] 2026-11-17 20:29:41
    // Description: Wire sortable Total and Cost column headers and row sorting in Tab 1 model table.
    // ============================================================================
    const getTab1TotalTokens = (row) => num(
      row?.totalTokens ?? (num(row?.inputUncachedTokens, 0) + num(row?.cacheReadTokens, 0) + num(row?.outputTokens, 0)),
      0,
    );
    const sortedByModel = sortModelBreakdownRows(byModel, getTab1TotalTokens);

    nodes.push(
      el('div', { className: 'section-subhead', textContent: t('childrenModels.modelsSubhead') }),
      sortedByModel.length > 0
        ? el('div', { className: 'table-scroll' },
            el('table', { className: 'data-table tabular-nums' },
              el('thead', null,
                el('tr', null,
                  el('th', null, t('childrenModels.colModel')),
                  el('th', { className: 'num' }, t('childrenModels.colSteps')),
                  el('th', { className: 'num' }, t('childrenModels.colInput')),
                  el('th', { className: 'num' }, t('childrenModels.colCache')),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:20:30
// Description: Insert per-model Cache Hit Rate column right after Cache in Tab 1 model table.
// ============================================================================
                  el('th', { className: 'num cache-hit-col', title: t('childrenModels.colCacheHitTip') }, t('childrenModels.colCacheHit')),
// ============================================================================
// [MODIFIED END] 2026-11-19 20:20:30
// ============================================================================
                  el('th', { className: 'num' }, t('childrenModels.colOutput')),
                  createSortableHeaderCell({
                    colKey: 'total',
                    label: t('childrenModels.colTotal'),
                    baseTitle: t('childrenModels.colTotalTip'),
                    extraClass: 'total-col',
                  }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:11
// Description: Move currency unit into Tab 1 model table Cost header via table.costWithCurrency.
// ============================================================================
                  createSortableHeaderCell({
                    colKey: 'cost',
                    label: t('table.costWithCurrency', { currency }),
                  }),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================
                ),
              ),
              el('tbody', null,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Format Tab 1 byModel canonical model display and merged rawModels tooltip.
// ============================================================================
                sortedByModel.map((row) => {
                  const { displayModel, title: rateTip } = formatModelBreakdownRowDisplay(row);
                  const totalTok = getTab1TotalTokens(row);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:20:30
// Description: Compute and render per-model cache hit rate cell in Tab 1 model table.
// ============================================================================
                  const hitMeta = getModelRowCacheHitMeta(row);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:28:34
// Description: Add model identity .model-dot directly inside Tab 1 td.model-cell (matches .model-cell > .model-dot & ellipsis) and show numeric-only cost cell.
// ============================================================================
                  return el('tr', null,
                    el('td', { className: 'model-cell', title: rateTip },
                      createModelDot(row.profileId || displayModel, Array.isArray(row.rawModels) ? row.rawModels[0] : ''),
                      displayModel,
                    ),
                    el('td', { className: 'num', textContent: fmtInt(row.stepsCount) }),
                    el('td', { className: 'num', title: fmtInt(row.inputUncachedTokens), textContent: fmtTokens(row.inputUncachedTokens) }),
                    el('td', { className: 'num', title: fmtInt(row.cacheReadTokens), textContent: fmtTokens(row.cacheReadTokens) }),
                    el('td', {
                      className: `num cache-hit-col ${hitMeta.tierClass}`,
                      title: hitMeta.title || undefined,
                      textContent: hitMeta.text,
                    }),
                    el('td', { className: 'num', title: fmtInt(row.outputTokens), textContent: fmtTokens(row.outputTokens) }),
                    el('td', { className: 'num total-col', title: fmtInt(totalTok), textContent: fmtTokens(totalTok) }),
                    el('td', { className: 'num', title: fmtCost(row.costActual, currency), textContent: fmtCostNumber(row.costActual) }),
                  );
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:20:30
// ============================================================================
                }),
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
              ),
            ),
          )
        : el('div', { className: 'empty-inline', textContent: t('childrenModels.modelsEmpty') }),
    );
    // ============================================================================
    // [MODIFIED END] 2026-11-17 20:29:41
    // ============================================================================
    // ============================================================================
    // [MODIFIED END] 2026-11-17 10:15:00
    // ============================================================================
    // ============================================================================
    // [MODIFIED END] 2026-11-16 21:11:00
    // ============================================================================

    card.replaceChildren(...nodes);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:00
// Description: Restore expanded subagent/swarm list scroll offset right after DOM replacement.
// ============================================================================
    if (isExpanded && childrenListEl) {
      childrenListEl.scrollTop = state.childrenScrollTop;
    }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:00
// ============================================================================
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:20:30
// Description: Implement standalone Side Questions card renderer (#card-side-questions) with dirty-signature memoization, Top-5 folding, scroll preservation, click-to-inspect, and one-click Open Chat action.
// ============================================================================
  function renderSideQuestionsCard(current, prefs) {
    const card = $('card-side-questions');
    if (!card) return;
    const sideQuestions = Array.isArray(current?.sideQuestions) ? current.sideQuestions : [];
    if (sideQuestions.length === 0) {
      card.classList.add('hidden');
      state.cardRenderSigs.sideQuestions = '';
      card.replaceChildren();
      return;
    }

    card.classList.remove('hidden');
    const currency = prefs?.currency || 'USD';
    const rawTot = current.sideQuestionsTotals && typeof current.sideQuestionsTotals === 'object'
      ? current.sideQuestionsTotals
      : null;

    const totCount = num(rawTot?.count, sideQuestions.length);
    const totSteps = rawTot
      ? num(rawTot.stepsCount, 0)
      : sideQuestions.reduce((acc, q) => acc + num(q?.stepsCount, 0), 0);
    const totUncached = rawTot
      ? num(rawTot.inputUncachedTokens, 0)
      : sideQuestions.reduce((acc, q) => acc + num(q?.inputUncachedTokens, 0), 0);
    const totCached = rawTot
      ? num(rawTot.cacheReadTokens, 0)
      : sideQuestions.reduce((acc, q) => acc + num(q?.cacheReadTokens, 0), 0);
    const totOut = rawTot
      ? num(rawTot.outputTokens, 0)
      : sideQuestions.reduce((acc, q) => acc + num(q?.outputTokens, 0), 0);
    const totTokens = rawTot
      ? num(rawTot.totalTokens, totUncached + totCached + totOut)
      : sideQuestions.reduce((acc, q) => acc + num(q?.totalTokens, 0), 0);
    const totCost = rawTot
      ? num(rawTot.costActual, 0)
      : sideQuestions.reduce((acc, q) => acc + num(q?.costActual, 0), 0);
    const totIn = totUncached + totCached;
    const rawTotHit = rawTot?.cacheHitRatePct;
    const totHitPct =
      rawTotHit !== null && rawTotHit !== undefined && rawTotHit !== '' && Number.isFinite(Number(rawTotHit))
        ? Number(rawTotHit)
        : (totIn > 0 ? (totCached / totIn) * 100 : 0);

    const sig = JSON.stringify([
      state.lang,
      state.tokenUnit,
      currency,
      num(prefs?.cnyRate, 0),
      Boolean(state.sideQuestionsExpanded),
      current.conversationId || '',
      totCount,
      totSteps,
      totTokens,
      totCost,
      totHitPct,
      sideQuestions.map((sq) => [
        sq?.conversationId || '',
        sq?.title || '',
        sq?.model || '',
        sq?.rawModel || '',
        sq?.status || '',
        num(sq?.generatingSinceMs, 0),
        num(sq?.stepsCount, 0),
        num(sq?.inputUncachedTokens, 0),
        num(sq?.cacheReadTokens, 0),
        num(sq?.outputTokens, 0),
        num(sq?.totalTokens, 0),
        num(sq?.cacheHitRatePct, 0),
        num(sq?.costActual, 0),
        sq?.updatedAtMs ? fmtRelTime(sq.updatedAtMs) : '',
      ]),
    ]);
    if (card.childElementCount > 0 && state.cardRenderSigs.sideQuestions === sig) return;
    state.cardRenderSigs.sideQuestions = sig;

    if (state.sideQuestionsExpanded) {
      const prevList = card.querySelector('.side-questions-list.is-expanded');
      if (prevList) {
        state.sideQuestionsScrollTop = prevList.scrollTop;
      }
    }

    const canToggle = sideQuestions.length > MAX_COLLAPSED_SIDE_QUESTIONS;
    const isExpanded = canToggle && Boolean(state.sideQuestionsExpanded);
    const visibleItems = isExpanded
      ? sideQuestions
      : sideQuestions.slice(0, MAX_COLLAPSED_SIDE_QUESTIONS);
    const hiddenCount = Math.max(0, sideQuestions.length - MAX_COLLAPSED_SIDE_QUESTIONS);

    const handleToggleExpand = () => {
      if (state.sideQuestionsExpanded) {
        state.sideQuestionsExpanded = false;
        state.sideQuestionsScrollTop = 0;
      } else {
        state.sideQuestionsExpanded = true;
      }
      const latestCurrent = state.snapshot?.current || current;
      const latestPrefs = state.snapshot?.prefs || prefs;
      renderSideQuestionsCard(latestCurrent, latestPrefs);
    };

    const summaryText = t('sideQuestions.summaryMeta', {
      tokens: fmtTokens(totTokens),
      cost: fmtCost(totCost, currency),
    });
    const summaryTip = t('sideQuestions.summaryTip', {
      count: fmtInt(totCount),
      steps: fmtInt(totSteps),
      hit: totIn > 0 ? fmtPct(totHitPct) : '—',
    });

    const headEl = el('div', { className: 'card-head' },
      el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Replace .card-title-dot with branch SVG icon in renderSideQuestionsCard.
// ============================================================================
        icon('branch', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
        t('sideQuestions.title'),
        el('span', {
          className: 'kind-badge side-question tabular-nums',
          textContent: t('sideQuestions.countBadge', { count: fmtInt(totCount) }),
        }),
      ),
      el('div', { className: 'side-questions-head-right' },
        el('span', {
          className: 'side-questions-summary tabular-nums',
          textContent: summaryText,
          title: summaryTip,
        }),
        canToggle
          ? el('button', {
              type: 'button',
              className: 'mini-btn',
              textContent: isExpanded
                ? t('sideQuestions.collapse')
                : t('sideQuestions.expandAll', { count: sideQuestions.length }),
              onClick: handleToggleExpand,
            })
          : null,
      ),
    );

    const listEl = el(
      'div',
      { className: isExpanded ? 'side-questions-list is-expanded' : 'side-questions-list' },
      visibleItems.map((sq) => {
        const sqTitle =
          localizeConvTitle(sq.title) ||
          t('common.sessionPrefix', { id: shortId(sq.conversationId) });
        const status = sq.status || 'IDLE';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Render Side Question status with stroke SVG icons and separate [data-child-since] timer span.
// ============================================================================
        const statusSpan = status === 'GENERATING' && sq.generatingSinceMs
          ? el('span', { className: 'child-status tabular-nums GENERATING' },
              icon('sparkle', 12),
              el('span', {
                dataset: { childSince: String(sq.generatingSinceMs) },
                textContent: fmtElapsed(sq.generatingSinceMs),
              }),
            )
          : status === 'GENERATING'
            ? el('span', { className: 'child-status tabular-nums GENERATING' },
                icon('sparkle', 12),
                t('childrenModels.childGenerating'),
              )
            : status === 'RUNNING_TOOLS'
              ? el('span', { className: 'child-status tabular-nums RUNNING_TOOLS' },
                  icon('wrench', 12),
                  t('childrenModels.childRunning'),
                )
              : el('span', {
                  className: `child-status tabular-nums ${status}`,
                  textContent: t('childrenModels.childIdle'),
                });
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================

        const updatedAtNum = Number(sq.updatedAtMs);
        const hasValidUpdatedAt = Number.isFinite(updatedAtNum) && updatedAtNum > 0;
        const relTime = hasValidUpdatedAt ? fmtRelTime(updatedAtNum) : '';

        const sqModel = sq.model || 'Auto';
        const sqModelTip = sq.rawModel && sq.rawModel !== sqModel
          ? `${sqModel} (${sq.rawModel})`
          : sqModel;
        const sqHitMeta = getModelRowCacheHitMeta(sq);
        const sqTotalTokens = num(
          sq.totalTokens,
          num(sq.inputUncachedTokens, 0) + num(sq.cacheReadTokens, 0) + num(sq.outputTokens, 0),
        );

        const inspectSideQuestion = () => {
          const cid = String(sq.conversationId || '').toLowerCase();
          if (cid) state.inspectedChildIds.add(cid);
          selectConversation(sq.conversationId);
        };

        return el('div', {
          className: 'side-q-row',
          role: 'button',
          tabIndex: 0,
          title: t('sideQuestions.inspectTip'),
          onClick: inspectSideQuestion,
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inspectSideQuestion();
            }
          },
        },
          el('div', { className: 'side-q-top' },
            el('span', { className: 'side-q-title', textContent: sqTitle, title: sqTitle }),
            el('div', { className: 'child-top-right tabular-nums' },
              relTime
                ? el('span', {
                    className: 'child-rel-time muted-hint',
                    textContent: relTime,
                    title: new Date(updatedAtNum).toLocaleString(),
                  })
                : null,
              statusSpan,
            ),
          ),
          el('div', { className: 'side-q-meta' },
            el('div', { className: 'side-q-stats tabular-nums' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:28:34
// Description: Add model identity .model-dot to side-question rows and .btn-soft + external icon to open-session button.
// ============================================================================
              el('span', { title: sqModelTip },
                createModelDot(sqModel, sq.rawModel),
                sqModel,
              ),
              el('span', { textContent: t('global.stepsCount', { count: fmtInt(sq.stepsCount) }) }),
              el('span', { title: fmtInt(sqTotalTokens), textContent: fmtTokens(sqTotalTokens) }),
              sqHitMeta.hasInput
                ? el('span', {
                    title: sqHitMeta.title || undefined,
                    textContent: t('sideQuestions.hitStat', { pct: sqHitMeta.text }),
                  })
                : null,
              el('span', { textContent: fmtCost(sq.costActual, currency) }),
            ),
            el('button', {
              type: 'button',
              className: 'mini-btn accent btn-soft side-q-open-btn',
              title: t('sideQuestions.openTip'),
              onClick: (e) => {
                e.stopPropagation();
                openConversationInHost(sq.conversationId);
              },
              onKeyDown: (e) => {
                e.stopPropagation();
              },
            },
              icon('external', 12),
              t('sideQuestions.openBtn'),
            ),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
          ),
        );
      }),
    );

    if (isExpanded) {
      listEl.addEventListener(
        'scroll',
        () => {
          state.sideQuestionsScrollTop = listEl.scrollTop;
        },
        { passive: true },
      );
    }

    const toggleFooter = canToggle
      ? el('button', {
          type: 'button',
          className: 'children-toggle-bar',
          textContent: isExpanded
            ? t('sideQuestions.collapseFooter', { shown: MAX_COLLAPSED_SIDE_QUESTIONS })
            : t('sideQuestions.expandMoreFooter', {
                rest: hiddenCount,
                total: sideQuestions.length,
              }),
          onClick: handleToggleExpand,
        })
      : null;

    card.replaceChildren(...[headEl, listEl, toggleFooter].filter(Boolean));
    if (isExpanded) {
      listEl.scrollTop = state.sideQuestionsScrollTop;
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 20:20:30
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Integrate in-panel Pixel Office renderer, hit-test inspector, collapse toggle, and adaptive zero-idle-CPU animation loop.
// ============================================================================
  function stopPixelOfficeLoop() {
    if (state.pixelOfficeTimer) {
      clearInterval(state.pixelOfficeTimer);
      state.pixelOfficeTimer = null;
    }
    state.pixelOfficeIntervalMs = 0;
  }

  function getPixelOfficeCanvasCssWidth(canvas) {
    const wrap = canvas?.parentElement;
    const wrapRectW = typeof wrap?.getBoundingClientRect === 'function'
      ? Number(wrap.getBoundingClientRect()?.width)
      : 0;
    const canvasRectW = typeof canvas?.getBoundingClientRect === 'function'
      ? Number(canvas.getBoundingClientRect()?.width)
      : 0;
    const cardEl = $('card-pixel-office');
    const cardW = Number(cardEl?.clientWidth) > 24 ? Number(cardEl.clientWidth) - 24 : 0;
    const rawW =
      wrapRectW > 40 ? wrapRectW :
      Number(wrap?.clientWidth) > 40 ? Number(wrap.clientWidth) :
      canvasRectW > 40 ? canvasRectW :
      Number(canvas?.clientWidth) > 40 ? Number(canvas.clientWidth) :
      cardW > 40 ? cardW :
      (typeof window !== 'undefined' && Number(window.innerWidth) > 40
        ? Math.max(256, Math.min(900, Number(window.innerWidth) - 48))
        : 380);
    return Math.max(240, Math.min(920, Math.round(rawW)));
  }

  function drawPixelOfficeFrame() {
    const api = window.TokenMonitorPixelOffice;
    const canvas = state.pixelOfficeCanvas;
    const officeModel = state.pixelOfficeModel;
    if (!api || !canvas || !officeModel || state.pixelOfficeCollapsed) return;

    const dark = Boolean(api.detectDarkTheme(document));
    const cssWidth = getPixelOfficeCanvasCssWidth(canvas);
    const rawDpr = typeof window !== 'undefined' ? Number(window.devicePixelRatio) : 1;
    const dpr = Number.isFinite(rawDpr) && rawDpr >= 1 ? Math.min(3, rawDpr) : 1;

    const res = api.renderOfficeCanvas(canvas, officeModel, {
      tick: state.pixelOfficeTick,
      selectedKey: state.pixelOfficeSelectedKey,
      lang: state.lang,
      dark,
      cssWidth,
      dpr,
    });
    state.pixelOfficeHitBoxes = Array.isArray(res?.hitBoxes) ? res.hitBoxes : [];
    state.pixelOfficeLogicalWidth = Number(res?.logicalWidth) || cssWidth;
    state.pixelOfficeLogicalHeight = Number(res?.logicalHeight) || 0;

    if (state.pixelOfficeInspectorCanvas && state.pixelOfficeSelectedKey) {
      const selectedSlot = officeModel.slots.find((s) => s.key === state.pixelOfficeSelectedKey) || null;
      if (selectedSlot) {
        api.renderInspectorPortrait(state.pixelOfficeInspectorCanvas, selectedSlot, {
          tick: state.pixelOfficeTick,
          dark,
        });
      }
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:38:42
// Description: A6 — Redraw idle Pixel Office at 3s frame cadence (tick += 6) and stop loop under prefers-reduced-motion.
// ============================================================================
  function isReducedMotionPreferred() {
    return Boolean(
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }

  function syncPixelOfficeLoop() {
    const shouldRun = Boolean(
      !document.hidden &&
      !isReducedMotionPreferred() &&
      state.activeTab === 'current' &&
      !state.pixelOfficeCollapsed &&
      state.snapshot?.current &&
      state.pixelOfficeCanvas &&
      window.TokenMonitorPixelOffice,
    );
    if (!shouldRun) {
      stopPixelOfficeLoop();
      return;
    }
    const isActive = Boolean(state.pixelOfficeModel?.hasActive);
    const nextMs = isActive ? 110 : 3000;
    if (state.pixelOfficeTimer && state.pixelOfficeIntervalMs === nextMs) {
      return;
    }
    stopPixelOfficeLoop();
    state.pixelOfficeIntervalMs = nextMs;
    const tickStep = isActive ? 1 : 6;
    state.pixelOfficeTimer = setInterval(() => {
      if (document.hidden || isReducedMotionPreferred() || state.activeTab !== 'current' || state.pixelOfficeCollapsed) {
        stopPixelOfficeLoop();
        return;
      }
      state.pixelOfficeTick = (state.pixelOfficeTick + tickStep) & 0x7fffffff;
      drawPixelOfficeFrame();
    }, nextMs);
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:38:42
// ============================================================================

  function expandChildrenFromPixelOffice() {
    state.childrenExpanded = true;
    const latestCurrent = state.snapshot?.current || state.pixelOfficeLastCurrent;
    const latestPrefs = state.snapshot?.prefs || state.pixelOfficeLastPrefs;
    if (latestCurrent) {
      renderChildrenAndModelsCard(latestCurrent, latestPrefs);
    }
    const childrenCard = $('card-children-models');
    if (childrenCard && typeof childrenCard.scrollIntoView === 'function') {
      childrenCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function createPixelOfficeCanvas() {
    const canvas = el('canvas', {
      className: 'pixel-office-canvas',
      title: t('pixelOffice.clickHint'),
      'aria-label': t('pixelOffice.title'),
    });
    canvas.addEventListener('click', (e) => {
      const api = window.TokenMonitorPixelOffice;
      if (!api || !Array.isArray(state.pixelOfficeHitBoxes) || state.pixelOfficeHitBoxes.length === 0) {
        return;
      }
      const rect = typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 };
      const rawX = num(e?.clientX, 0) - num(rect?.left, 0);
      const rawY = num(e?.clientY, 0) - num(rect?.top, 0);
      const scaleX = rect?.width > 0 && state.pixelOfficeLogicalWidth > 0
        ? state.pixelOfficeLogicalWidth / rect.width
        : 1;
      const scaleY = rect?.height > 0 && state.pixelOfficeLogicalHeight > 0
        ? state.pixelOfficeLogicalHeight / rect.height
        : 1;
      const hit = api.hitTest(state.pixelOfficeHitBoxes, rawX * scaleX, rawY * scaleY);
      if (!hit) return;
      if (hit.type === 'slot') {
        state.pixelOfficeSelectedKey = hit.key === state.pixelOfficeSelectedKey ? '' : hit.key;
        const latestCurrent = state.snapshot?.current || state.pixelOfficeLastCurrent;
        const latestPrefs = state.snapshot?.prefs || state.pixelOfficeLastPrefs;
        if (latestCurrent) {
          renderPixelOfficeCard(latestCurrent, latestPrefs);
        } else {
          drawPixelOfficeFrame();
        }
      } else if (hit.type === 'overflow') {
        expandChildrenFromPixelOffice();
      }
    });
    return canvas;
  }

  function buildPixelInspector(slot, current, prefs, api) {
    const isChildView = isChildSessionView(current);
    const displayName = slot.isMain
      ? (localizeConvTitle(slot.name || current.title) || t('common.sessionPrefix', { id: shortId(slot.conversationId || current.conversationId) }))
      : (slot.name || shortId(slot.conversationId));

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Display Side Question kind badge and parent fallback back button inside Pixel Inspector when viewing a Side Question session.
// ============================================================================
    const isSideQuestionView = current?.childKind === 'side_question';
    const kindClass = slot.isMain
      ? (isChildView
          ? (isSideQuestionView
              ? 'kind-badge side-question'
              : (current?.childKind === 'swarm' ? 'kind-badge swarm' : 'kind-badge'))
          : 'kind-badge main')
      : (slot.kind === 'swarm' ? 'kind-badge swarm' : 'kind-badge');
    const kindLabel = slot.isMain
      ? (isChildView
          ? (isSideQuestionView
              ? t('sideQuestions.badge')
              : (current?.childKind === 'swarm' ? t('pixelOffice.kindSwarm') : t('pixelOffice.kindSubagent')))
          : t('pixelOffice.kindMain'))
      : (slot.kind === 'swarm' ? t('pixelOffice.kindSwarm') : t('pixelOffice.kindSubagent'));
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================

    const showRole = Boolean(
      !slot.isMain &&
      slot.role &&
      slot.role !== slot.name &&
      slot.role.toLowerCase() !== kindLabel.toLowerCase(),
    );

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Clean up Pixel Inspector to show only canonical model pill (no cat nickname, no .pixel-inspector-trait) while preserving raw slug in .pixel-inspector-model.
// ============================================================================
    const arch = slot.archetype || api.resolveCatArchetype(slot.modelLabel || slot.model || slot.rawModel);
    const fallbackProfileId =
      !slot.modelLabel && !arch?.modelNameEn && !arch?.modelNameZh && slot.model
        ? matchProfileIdForModel(slot.model)
        : '';
    const rawPillLabel = String(
      slot.modelLabel ||
      (state.lang === 'en' ? arch?.modelNameEn : arch?.modelNameZh) ||
      (fallbackProfileId && fallbackProfileId !== 'auto' ? MODEL_PROFILE_EN[fallbackProfileId]?.label : '') ||
      slot.model ||
      'Auto',
    ).trim() || 'Auto';
    const modelPillLabel = /^auto(?:\s*[（(].*)?$/i.test(rawPillLabel)
      ? (state.lang === 'en' ? (arch?.modelNameEn || 'Auto') : (arch?.modelNameZh || 'Auto (默认)'))
      : rawPillLabel;
    const rawSlug = slot.rawModel || slot.model || 'Auto';
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Pass deskAccent via --model-accent on portraitCanvas and add stroke icon metadata for Pixel Inspector status.
// ============================================================================
    const deskAccent = arch?.deskAccent || getModelAccent(modelPillLabel, rawSlug);
    let statusText = t('pixelOffice.statusIdle');
    let statusClass = 'is-idle';
    let statusIconName = '';
    if (slot.killed || slot.status === 'ENDED') {
      statusText = t('pixelOffice.statusEnded');
      statusClass = 'is-ended';
    } else if (slot.status === 'GENERATING') {
      statusText = t('pixelOffice.statusGenerating');
      statusClass = 'is-generating';
      statusIconName = 'sparkle';
    } else if (slot.status === 'RUNNING_TOOLS') {
      statusText = slot.activeToolLabel
        ? t('pixelOffice.statusToolsLabel', { tool: slot.activeToolLabel })
        : t('pixelOffice.statusTools');
      statusClass = 'is-tools';
      statusIconName = 'wrench';
    }

    const portraitCanvas = el('canvas', {
      className: 'pixel-inspector-portrait',
      width: 96,
      height: 96,
      'aria-hidden': 'true',
      style: deskAccent ? { '--model-accent': deskAccent } : null,
    });
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
    portraitCanvas.width = 96;
    portraitCanvas.height = 96;

    const currency = prefs?.currency || 'USD';
    const statsRow = el('div', { className: 'pixel-inspector-stats tabular-nums' },
      el('div', { className: 'pixel-inspector-stat', title: fmtInt(slot.contextTotal) },
        el('span', { className: 'pixel-inspector-stat-label', textContent: t('pixelOffice.statCtx') }),
        el('span', { className: 'pixel-inspector-stat-val', textContent: fmtTokens(slot.contextTotal) }),
      ),
      el('div', { className: 'pixel-inspector-stat' },
        el('span', { className: 'pixel-inspector-stat-label', textContent: t('pixelOffice.statSpeed') }),
        el('span', { className: 'pixel-inspector-stat-val', textContent: `${fmtRate(slot.tokPerSec)} tok/s` }),
      ),
      el('div', { className: 'pixel-inspector-stat', title: fmtInt(slot.outputTokens) },
        el('span', { className: 'pixel-inspector-stat-label', textContent: t('pixelOffice.statOut') }),
        el('span', { className: 'pixel-inspector-stat-val', textContent: fmtTokens(slot.outputTokens) }),
      ),
      el('div', { className: 'pixel-inspector-stat' },
        el('span', { className: 'pixel-inspector-stat-label', textContent: t('pixelOffice.statCost') }),
        el('span', { className: 'pixel-inspector-stat-val', textContent: fmtCost(slot.costActual, currency) }),
      ),
    );

    const actions = [];
    if (!slot.isMain && slot.conversationId) {
      actions.push(
        el('button', {
          type: 'button',
          className: 'mini-btn accent',
          textContent: t('pixelOffice.inspectBtn'),
          onClick: () => {
            const cid = String(slot.conversationId || '').toLowerCase();
            if (cid) state.inspectedChildIds.add(cid);
            selectConversation(slot.conversationId);
          },
        }),
        el('button', {
          type: 'button',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Add .btn-soft + external icon to Pixel Inspector Open Chat button.
// ============================================================================
          className: 'mini-btn btn-soft',
          onClick: () => openConversationInHost(slot.conversationId),
        },
          icon('external', 12),
          t('pixelOffice.openChatBtn'),
        ),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
      );
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Support returning to parentConversationId when inspecting a Side Question directly in Pixel Inspector.
// ============================================================================
    } else if (slot.isMain && isChildView) {
      const viewingId = current?.conversationId || selectedConv;
      const backTargetId =
        isSideQuestionView && current?.parentConversationId && (!state.homeConvId || state.homeConvId === viewingId)
          ? current.parentConversationId
          : (state.homeConvId || (isSideQuestionView ? current?.parentConversationId : ''));
      if (backTargetId) {
        actions.push(
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Prepend back SVG icon to Pixel Inspector back button.
// ============================================================================
          el('button', {
            type: 'button',
            className: 'mini-btn accent',
            onClick: () => {
              if (backTargetId !== selectedConv) {
                clearCurrentSessionMotionMemory();
              }
              selectConversation(backTargetId);
            },
          },
            icon('back', 12),
            isSideQuestionView ? t('sideQuestions.backToParent') : t('pixelOffice.backToMain'),
          ),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
        );
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================

    const inspectorEl = el('div', { className: 'pixel-inspector', role: 'region', 'aria-label': displayName },
      el('div', { className: 'pixel-inspector-top' },
        portraitCanvas,
        el('div', { className: 'pixel-inspector-main' },
          el('div', { className: 'pixel-inspector-head' },
            el('div', { className: 'pixel-inspector-title-row' },
              el('span', { className: 'pixel-inspector-name', textContent: displayName, title: displayName }),
              el('span', { className: kindClass, textContent: kindLabel }),
              showRole ? el('span', { className: 'muted-hint', textContent: slot.role }) : null,
            ),
            el('button', {
              type: 'button',
              className: 'pixel-inspector-close',
              textContent: '×',
              'aria-label': t('pixelOffice.closeInspector'),
              title: t('pixelOffice.closeInspector'),
              onClick: () => {
                state.pixelOfficeSelectedKey = '';
                const latestCurrent = state.snapshot?.current || current;
                const latestPrefs = state.snapshot?.prefs || prefs;
                renderPixelOfficeCard(latestCurrent, latestPrefs);
              },
            }),
          ),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Render canonical model pill only (omit .pixel-inspector-trait) and display rawSlug in .pixel-inspector-model.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Use .model-dot with --model-accent (deskAccent) in Pixel Inspector model chip and prepend stroke status icon.
// ============================================================================
          el('div', { className: 'pixel-inspector-persona-row' },
            el('span', { className: 'pixel-inspector-persona-badge', title: modelPillLabel },
              el('span', {
                className: 'model-dot',
                'aria-hidden': 'true',
                style: deskAccent ? { '--model-accent': deskAccent } : null,
              }),
              el('span', { textContent: modelPillLabel }),
            ),
          ),
          el('div', { className: 'pixel-inspector-status-row' },
            el('span', { className: `pixel-inspector-status ${statusClass}`, title: statusText },
              statusIconName ? icon(statusIconName, 12) : null,
              statusText,
            ),
            el('span', { className: 'pixel-inspector-model', textContent: rawSlug, title: rawSlug }),
          ),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
        ),
      ),
      statsRow,
      actions.length > 0 ? el('div', { className: 'pixel-inspector-actions' }, actions) : null,
    );

    return { inspectorEl, portraitCanvas };
  }

  function renderPixelOfficeCard(current, prefs) {
    const card = $('card-pixel-office');
    if (!card) return;
    const api = window.TokenMonitorPixelOffice;
    if (!api || !current) {
      card.classList.add('hidden');
      state.pixelOfficeModel = null;
      state.pixelOfficeHitBoxes = [];
      state.pixelOfficeCanvas = null;
      state.pixelOfficeInspectorCanvas = null;
      state.pixelOfficeLastCurrent = null;
      state.pixelOfficeLastPrefs = null;
      stopPixelOfficeLoop();
      return;
    }

    state.pixelOfficeLastCurrent = current;
    state.pixelOfficeLastPrefs = prefs;
    card.classList.remove('hidden');
    const collapsed = Boolean(state.pixelOfficeCollapsed);
    card.classList.toggle('is-collapsed', collapsed);

    const children = Array.isArray(current.children) ? current.children : [];
    const sortedChildren = sortChildrenForDisplay(children);
    const officeModel = api.buildOfficeModel(current, sortedChildren, state.lang);
    state.pixelOfficeModel = officeModel;

    if (
      state.pixelOfficeSelectedKey &&
      !officeModel.slots.some((s) => s.key === state.pixelOfficeSelectedKey)
    ) {
      state.pixelOfficeSelectedKey = '';
    }
    const selectedSlot = state.pixelOfficeSelectedKey
      ? (officeModel.slots.find((s) => s.key === state.pixelOfficeSelectedKey) || null)
      : null;

    const currency = prefs?.currency || 'USD';
    const isChildView = isChildSessionView(current);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Expand pixelOffice dirty signature with userTurnTimestampsMs, activeModelLabel/activeRawModel, and child createdAtMs/rawModel/modelLabel fields for deterministic round/model re-rendering.
// ============================================================================
    const userTurnCount = Array.isArray(current.userTurnTimestampsMs) ? current.userTurnTimestampsMs.length : 0;
    const latestUserTurnMs = userTurnCount > 0 ? num(current.userTurnTimestampsMs[userTurnCount - 1], 0) : 0;
    const sig = JSON.stringify([
      state.lang,
      currency,
      state.tokenUnit,
      num(prefs?.cnyRate, 0),
      collapsed,
      state.pixelOfficeSelectedKey || '',
      current.conversationId || '',
      isChildView,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Include childKind and parentConversationId in Pixel Office dirty signature.
// ============================================================================
      current?.childKind || '',
      current?.parentConversationId || '',
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================
      Boolean(state.homeConvId),
      userTurnCount,
      latestUserTurnMs,
      current.activeModel || '',
      current.activeModelLabel || '',
      current.activeRawModel || '',
      officeModel.overflowCount,
      officeModel.totalChildren,
      sortedChildren.map((ch) => [
        ch?.conversationId || '',
        num(ch?.createdAtMs, 0),
        ch?.rawModel || '',
        ch?.modelLabel || '',
        ch?.model || '',
        ch?.status || '',
        Boolean(ch?.killed),
      ]),
      officeModel.slots.map((s) => [
        s.key,
        Boolean(s.isMain),
        s.conversationId || '',
        s.name || '',
        s.role || '',
        s.kind || '',
        s.status || '',
        Boolean(s.killed),
        s.model || '',
        s.modelLabel || '',
        s.rawModel || '',
        s.archetype?.id || '',
        s.activeToolLabel || '',
        num(s.tokPerSec, 0),
        num(s.contextTotal, 0),
        num(s.outputTokens, 0),
        num(s.costActual, 0),
      ]),
    ]);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
    if (card.childElementCount > 0 && state.cardRenderSigs.pixelOffice === sig) {
      syncPixelOfficeLoop();
      return;
    }
    state.cardRenderSigs.pixelOffice = sig;

    const subSlotsCount = Math.max(0, officeModel.slots.length - 1);
    const countLabel = subSlotsCount > 0
      ? t('pixelOffice.slotsCount', { count: subSlotsCount })
      : t('pixelOffice.slotsMainOnly');

    const overflowBadge = officeModel.overflowCount > 0
      ? el('button', {
          type: 'button',
          className: 'pixel-office-overflow-badge tabular-nums',
          textContent: t('pixelOffice.overflowPill', { count: officeModel.overflowCount }),
          title: t('pixelOffice.overflowTitle', { count: officeModel.overflowCount }),
          onClick: expandChildrenFromPixelOffice,
        })
      : null;

    const toggleBtn = el('button', {
      id: 'btn-pixel-office-toggle',
      type: 'button',
      className: 'mini-btn pixel-office-toggle-btn',
      'aria-expanded': String(!collapsed),
      textContent: collapsed ? t('pixelOffice.expand') : t('pixelOffice.collapse'),
      onClick: () => {
        state.pixelOfficeCollapsed = !state.pixelOfficeCollapsed;
        if (state.snapshot?.prefs) {
          state.snapshot.prefs.pixelOfficeCollapsed = state.pixelOfficeCollapsed;
        }
        state.cardRenderSigs.pixelOffice = '';
        const latestCurrent = state.snapshot?.current || current;
        const latestPrefs = state.snapshot?.prefs || prefs;
        renderPixelOfficeCard(latestCurrent, latestPrefs);
        patchPrefs({ pixelOfficeCollapsed: state.pixelOfficeCollapsed });
      },
    });

    const headEl = el('div', { className: 'card-head' },
      el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:23:58
// Description: Replace .card-title-dot with office SVG icon in renderPixelOfficeCard.
// ============================================================================
        icon('office', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:23:58
// ============================================================================
        t('pixelOffice.title'),
      ),
      el('div', { className: 'pixel-office-head-right' },
        el('span', { className: 'pixel-office-count tabular-nums', textContent: countLabel }),
        overflowBadge,
        toggleBtn,
      ),
    );

    if (collapsed) {
      state.pixelOfficeCanvas = null;
      state.pixelOfficeInspectorCanvas = null;
      state.pixelOfficeHitBoxes = [];
      card.replaceChildren(headEl);
      stopPixelOfficeLoop();
      return;
    }

    const canvasEl = state.pixelOfficeCanvas || createPixelOfficeCanvas();
    canvasEl.title = t('pixelOffice.clickHint');
    canvasEl.setAttribute('aria-label', t('pixelOffice.title'));
    state.pixelOfficeCanvas = canvasEl;

    let bodyFooter = el('div', { className: 'pixel-office-hint', textContent: t('pixelOffice.clickHint') });
    if (selectedSlot) {
      const built = buildPixelInspector(selectedSlot, current, prefs, api);
      state.pixelOfficeInspectorCanvas = built.portraitCanvas;
      bodyFooter = built.inspectorEl;
    } else {
      state.pixelOfficeInspectorCanvas = null;
    }

    card.replaceChildren(
      headEl,
      el('div', { className: 'pixel-office-canvas-wrap' }, canvasEl),
      bodyFooter,
    );
    drawPixelOfficeFrame();
    syncPixelOfficeLoop();
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Localize fallback session title in renderCurrentTab.
// ============================================================================
  function renderCurrentTab(snap) {
    const emptyEl = $('current-empty');
    const contentEl = $('current-content');
    const current = snap?.current || null;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Clear current-session motion memory whenever rendered conversation ID changes.
// ============================================================================
    if (current?.conversationId && current.conversationId !== state.lastRenderedConvId) {
      clearCurrentSessionMotionMemory();
      state.lastRenderedConvId = current.conversationId;
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================

    if (!current) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Reset Tab 1 card memoization signatures when active session becomes null.
// ============================================================================
      resetCardRenderSigs();
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Clear Pixel Office canvas/model references and stop animation timer when no active session exists.
// ============================================================================
      state.pixelOfficeModel = null;
      state.pixelOfficeHitBoxes = [];
      state.pixelOfficeCanvas = null;
      state.pixelOfficeInspectorCanvas = null;
      state.pixelOfficeLastCurrent = null;
      state.pixelOfficeLastPrefs = null;
      stopPixelOfficeLoop();
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Hide #card-side-questions and #conv-kind-badge when active session is empty.
// ============================================================================
      const emptySideQCard = $('card-side-questions');
      if (emptySideQCard) {
        emptySideQCard.classList.add('hidden');
        emptySideQCard.replaceChildren();
      }
      const emptyKindBadge = $('conv-kind-badge');
      if (emptyKindBadge) {
        emptyKindBadge.classList.add('hidden');
        emptyKindBadge.textContent = '';
      }
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const titleText = localizeConvTitle(current.title) || t('common.sessionPrefix', { id: shortId(current.conversationId) });
    $('conv-title').textContent = titleText;
    $('conv-title').title = `${titleText} (${current.conversationId})`;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Toggle #conv-kind-badge visibility and label when viewing a Side Question session.
// ============================================================================
    const kindBadge = $('conv-kind-badge');
    if (kindBadge) {
      const isSideQ = current?.childKind === 'side_question';
      kindBadge.classList.toggle('hidden', !isSideQ);
      kindBadge.textContent = isSideQ ? t('sideQuestions.badge') : '';
    }
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================

    const wsBase = workspaceBase(current.workspace);
    $('conv-workspace').textContent = wsBase;
    $('conv-workspace').title = current.workspace || '';

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Render in-panel Pixel Office card right below #conv-strip in renderCurrentTab.
// ============================================================================
    renderPixelOfficeCard(current, snap.prefs);
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
    renderSpeedCard(current);
    renderCostCard(current, snap.prefs);
    renderContextCard(current);
    renderCacheCard(current);
    renderChildrenAndModelsCard(current, snap.prefs);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Render standalone Side Questions card right after Children & Models card in Tab 1.
// ============================================================================
    renderSideQuestionsCard(current, snap.prefs);
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A5 — Sync on-demand stopwatch timer after rendering Tab 1 cards.
// ============================================================================
    syncStopwatchLoop();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 — Helper to render only the currently visible tab (Tab 1 or Tab 2).
// ============================================================================
  function renderActiveTab(snap) {
    if (!snap) return;
    if (state.activeTab === 'current') {
      renderCurrentTab(snap);
    } else if (state.isDraggingTrend) {
      state.pendingGlobalRerender = true;
    } else {
      renderGlobalTab(snap);
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Add Tab 2 bilingual translation (resolving period name via rangeKey),
// 4-mode token unit toggle pill in Usage Summary header, muted avg-daily-cost sub-line,
// horizontally scrollable & mouse-draggable trend bar chart with scroll preservation,
// and EN/ZH header toggle binding.
// ============================================================================
  function attachTrendChartInteractions(scrollEl) {
    let isDown = false;
    let dragged = false;
    let startX = 0;
    let startScrollLeft = 0;
    let activePointerId = null;
    let suppressClickUntil = 0;

    scrollEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      dragged = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startScrollLeft = scrollEl.scrollLeft;
    });

    scrollEl.addEventListener('pointermove', (e) => {
      if (!isDown || e.pointerId !== activePointerId) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) > 5) {
        dragged = true;
        state.isDraggingTrend = true;
        scrollEl.classList.add('is-dragging');
        try {
          scrollEl.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if detached
        }
      }
      if (dragged) {
        scrollEl.scrollLeft = startScrollLeft - dx;
        state.trendScrollLeft = scrollEl.scrollLeft;
      }
    });

    const endDrag = (e) => {
      if (!isDown || (e.pointerId !== undefined && e.pointerId !== activePointerId)) return;
      isDown = false;
      activePointerId = null;
      state.isDraggingTrend = false;
      scrollEl.classList.remove('is-dragging');
      if (e.pointerId !== undefined) {
        try {
          if (scrollEl.hasPointerCapture?.(e.pointerId)) {
            scrollEl.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore release errors
        }
      }
      if (dragged) {
        suppressClickUntil = Date.now() + 80;
      }
      if (state.pendingGlobalRerender && state.snapshot) {
        state.pendingGlobalRerender = false;
        renderGlobalTab(state.snapshot);
      }
    };

    scrollEl.addEventListener('pointerup', endDrag);
    scrollEl.addEventListener('pointercancel', endDrag);
    scrollEl.addEventListener('pointerleave', () => {
      if (isDown && !dragged) {
        isDown = false;
        activePointerId = null;
      }
    });

    scrollEl.addEventListener(
      'click',
      (e) => {
        if (dragged || Date.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
          dragged = false;
        }
      },
      true,
    );

    scrollEl.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY !== 0 && scrollEl.scrollWidth > scrollEl.clientWidth) {
          e.preventDefault();
          scrollEl.scrollLeft += e.deltaY;
          state.trendScrollLeft = scrollEl.scrollLeft;
        }
      },
      { passive: false },
    );

    scrollEl.addEventListener('scroll', () => {
      if (!state.trendNeedsRightAlign && scrollEl.scrollWidth > 0) {
        state.trendScrollLeft = scrollEl.scrollLeft;
      }
    });
  }

  function syncTrendScrollPosition() {
    if (state.activeTab !== 'global') return;
    const scrollEl = $('global-content')?.querySelector('.trend-scroll');
    if (!scrollEl) return;
    const apply = () => {
      if (!scrollEl.isConnected || state.activeTab !== 'global') return;
      if (state.trendNeedsRightAlign) {
        scrollEl.scrollLeft = scrollEl.scrollWidth;
        state.trendScrollLeft = scrollEl.scrollLeft;
        state.trendNeedsRightAlign = false;
      } else {
        scrollEl.scrollLeft = state.trendScrollLeft;
      }
    };
    apply();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(apply);
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:43:31
// Description: A4 & C2 — Add persistent Tab 2 DOM container helper (ensureGlobalDom), dirty-signature builders (buildGlobalTopSig / buildGlobalListSig), and in-memory session-list filter helpers so typing in the search box never loses focus/caret/value across polls.
// ============================================================================
  function ensureGlobalDom(container) {
    if (!container) return null;
    const isMounted = Boolean(
      state.globalDom &&
      state.globalDom.rootContainer === container &&
      (typeof container.contains === 'function'
        ? container.contains(state.globalDom.recentCard)
        : Array.isArray(container.children) && container.children.includes(state.globalDom.recentCard)),
    );
    if (isMounted) return state.globalDom;

    const topStack = el('div', { className: 'view-stack' });
    const recentHead = el('div', { className: 'card-head' });
    const searchInput = el('input', {
      type: 'search',
      className: 'list-search-input',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    searchInput.value = state.globalSearchQuery;

    const modelSelect = el('select', { className: 'list-filter-select' });
    const activeChip = el('button', {
      type: 'button',
      className: `list-filter-chip${state.globalActiveOnly ? ' active' : ''}`,
      'aria-pressed': String(state.globalActiveOnly),
    });

    const filterBar = el('div', { className: 'list-filter-bar' }, searchInput, modelSelect, activeChip);
    const recentListWrap = el('div', { className: 'recent-list-wrap' });
    const recentCard = el('article', { className: 'card' }, recentHead, filterBar, recentListWrap);

    const triggerListFilter = () => {
      const snap = state.snapshot || state.globalLastSnap;
      if (snap) renderGlobalSessionListSection(dom, snap);
    };

    searchInput.addEventListener('input', () => {
      state.globalSearchQuery = String(searchInput.value || '');
      triggerListFilter();
    });
    modelSelect.addEventListener('change', () => {
      state.globalModelFilter = String(modelSelect.value || '');
      triggerListFilter();
    });
    activeChip.addEventListener('click', () => {
      state.globalActiveOnly = !state.globalActiveOnly;
      activeChip.classList.toggle('active', state.globalActiveOnly);
      activeChip.setAttribute('aria-pressed', String(state.globalActiveOnly));
      triggerListFilter();
    });

    const dom = {
      rootContainer: container,
      topStack,
      recentCard,
      recentHead,
      filterBar,
      searchInput,
      modelSelect,
      activeChip,
      recentListWrap,
      modelOptionsSig: '',
    };
    state.globalDom = dom;
    state.cardRenderSigs.globalTop = '';
    state.cardRenderSigs.globalList = '';
    container.replaceChildren(topStack, recentCard);
    return dom;
  }

  function resolveGlobalPeriodContext(snap) {
    const g = snap?.global || {};
    const currency = snap?.prefs?.currency || 'USD';
    const periods = g.periods || {};
    const periodKey = ['today', '7d', '30d', 'all'].includes(state.globalPeriod)
      ? state.globalPeriod
      : 'today';

    const fallbackToday = {
      rangeKey: 'today',
      startDate: g.todayDate || '',
      endDate: g.todayDate || '',
      spanDaysCount: 1,
      activeDaysCount: num(g.todayConversationsCount, 0) > 0 ? 1 : 0,
      conversationsCount: num(g.todayConversationsCount, 0),
      archivedConversationsCount: 0,
      stepsCount: 0,
      inputTokens: num(g.todayInputTokens, 0),
      cacheReadTokens: num(g.todayCacheReadTokens, 0),
      outputTokens: num(g.todayOutputTokens, 0),
      totalTokens: num(g.todayInputTokens, 0) + num(g.todayCacheReadTokens, 0) + num(g.todayOutputTokens, 0),
      cacheHitRatePct: num(g.todayCacheHitRatePct, 0),
      costActual: num(g.todayCostActual, 0),
      avgDailyCost: num(g.todayCostActual, 0),
      avgDailyTokens: num(g.todayInputTokens, 0) + num(g.todayCacheReadTokens, 0) + num(g.todayOutputTokens, 0),
      trendGranularity: 'hour',
      series: [],
      byModel: Array.isArray(g.todayByModel) ? g.todayByModel : [],
      byWorkspace: Array.isArray(g.todayByWorkspace) ? g.todayByWorkspace : [],
      topConversations: [],
      subscription: null,
    };

    const period = periods[periodKey] || periods.today || fallbackToday;
    const effectiveRangeKey = period.rangeKey || periodKey;
    const periodTitle = getPeriodLabel(effectiveRangeKey);
    const recent = Array.isArray(g.recentConversations) ? g.recentConversations : [];
    const viewingId = snap?.current?.conversationId || selectedConv;
    return { g, currency, periods, periodKey, period, effectiveRangeKey, periodTitle, recent, viewingId };
  }

  function buildGlobalTopSig(ctx) {
    const { g, currency, periodKey, effectiveRangeKey, period } = ctx;
    const sub = period.subscription || null;
    const series = Array.isArray(period.series) ? period.series : [];
    const byModel = Array.isArray(period.byModel) ? period.byModel : [];
    const byWs = Array.isArray(period.byWorkspace) ? period.byWorkspace : [];
    return JSON.stringify([
      state.lang,
      state.tokenUnit,
      currency,
      periodKey,
      effectiveRangeKey,
      state.trendMetric,
      state.modelSortBy,
      state.modelSortDir,
      state.workspacesExpanded,
      Boolean(g.ledgerSync?.syncing || g.ledgerSync?.pendingCount),
      period.startDate || '',
      period.endDate || '',
      num(period.spanDaysCount, 0),
      num(period.activeDaysCount, 0),
      num(period.conversationsCount, 0),
      num(period.archivedConversationsCount, 0),
      num(period.stepsCount, 0),
      num(period.inputTokens, 0),
      num(period.cacheReadTokens, 0),
      num(period.outputTokens, 0),
      num(period.totalTokens, 0),
      num(period.cacheHitRatePct, 0),
      num(period.costActual, 0),
      num(period.avgDailyCost, 0),
      num(period.avgDailyTokens, 0),
      period.trendGranularity || '',
      sub
        ? [
            sub.planId,
            sub.planLabel,
            Boolean(sub.isAutoDetected),
            num(sub.monthlyFee, 0),
            num(sub.proratedFee, 0),
            num(sub.tokenCost, 0),
            num(sub.netSavings, 0),
            num(sub.roiMultiplier, 0),
            num(sub.proratedDays, 0),
            num(sub.paybackPct, 0),
            Boolean(sub.isPaidOff),
          ]
        : null,
      series.map((b) => [
        b.key || b.label || '',
        b.rangeText || '',
        num(b.costActual, 0),
        num(b.totalTokens, 0),
        num(b.outputTokens, 0),
      ]),
      byModel.map((r) => [
        r.profileId || r.model || '',
        r.model || '',
        Array.isArray(r.rawModels) ? r.rawModels.join(',') : '',
        num(r.conversationsCount, 0),
        num(r.inputTokens, 0),
        num(r.cacheReadTokens, 0),
        num(r.outputTokens, 0),
        num(r.totalTokens, 0),
        r.cacheHitRatePct ?? '',
        num(r.costActual, 0),
      ]),
      byWs.map((w) => [
        w.workspace || '',
        num(w.conversationsCount, 0),
        num(w.inputTokens, 0),
        num(w.cacheReadTokens, 0),
        num(w.outputTokens, 0),
        num(w.totalTokens, 0),
        w.cacheHitRatePct ?? '',
        num(w.costActual, 0),
      ]),
    ]);
  }

  function renderGlobalSessionListSection(dom, snap, preCtx = null) {
    if (!dom) return;
    const ctx = preCtx || resolveGlobalPeriodContext(snap);
    const { currency, period, periodTitle, recent, viewingId } = ctx;
    const listMode = state.convListMode === 'top' ? 'top' : 'recent';
    const topConvs = Array.isArray(period.topConversations) ? period.topConversations : [];
    const listItems = listMode === 'top' ? topConvs : recent;

    // Keep persistent filter controls' labels & options synchronized in place without destroying DOM/focus.
    const nextPlaceholder = t('global.searchPlaceholder');
    if (dom.searchInput.placeholder !== nextPlaceholder) {
      dom.searchInput.placeholder = nextPlaceholder;
    }
    const nextSearchAria = t('global.searchAria');
    if (dom.searchInput.getAttribute('aria-label') !== nextSearchAria) {
      dom.searchInput.setAttribute('aria-label', nextSearchAria);
    }
    if (document.activeElement !== dom.searchInput && dom.searchInput.value !== state.globalSearchQuery) {
      dom.searchInput.value = state.globalSearchQuery;
    }

    const nextModelAria = t('global.filterModelAria');
    if (dom.modelSelect.getAttribute('aria-label') !== nextModelAria) {
      dom.modelSelect.setAttribute('aria-label', nextModelAria);
    }
    const modelSet = new Set();
    for (const item of listItems) {
      modelSet.add(String(item?.activeModel || 'Auto'));
    }
    if (state.globalModelFilter) {
      modelSet.add(state.globalModelFilter);
    }
    const sortedModels = Array.from(modelSet).sort((a, b) => a.localeCompare(b));
    const nextModelOptSig = `${state.lang}|${sortedModels.join('\u0001')}`;
    if (dom.modelOptionsSig !== nextModelOptSig) {
      dom.modelOptionsSig = nextModelOptSig;
      const optAll = el('option', { value: '', textContent: t('global.filterAllModels') });
      optAll.value = '';
      const modelOpts = sortedModels.map((m) => {
        const opt = el('option', { value: m, textContent: m });
        opt.value = m;
        return opt;
      });
      dom.modelSelect.replaceChildren(optAll, ...modelOpts);
      dom.modelSelect.value = state.globalModelFilter;
    } else if (dom.modelSelect.value !== state.globalModelFilter) {
      dom.modelSelect.value = state.globalModelFilter;
    }

    const nextActiveLabel = t('global.filterActiveOnly');
    if (dom.activeChip.textContent !== nextActiveLabel) {
      dom.activeChip.textContent = nextActiveLabel;
    }
    dom.activeChip.classList.toggle('active', state.globalActiveOnly);
    dom.activeChip.setAttribute('aria-pressed', String(state.globalActiveOnly));

    const queryLower = state.globalSearchQuery.trim().toLowerCase();
    const modelFilter = state.globalModelFilter;
    const activeOnly = state.globalActiveOnly;
    const hasActiveFilter = Boolean(queryLower || modelFilter || activeOnly);

    dom.filterBar.classList.toggle('hidden', listItems.length === 0 && !hasActiveFilter);

    const listSig = JSON.stringify([
      state.lang,
      state.tokenUnit,
      currency,
      listMode,
      periodTitle,
      viewingId || '',
      queryLower,
      modelFilter,
      activeOnly,
      listItems.map((item) => [
        item.conversationId || '',
        item.onDisk !== false,
        Boolean(item.isToday),
        item.status || 'IDLE',
        item.activeModel || 'Auto',
        item.workspace || '',
        item.title || '',
        num(item.updatedAtMs, 0),
        num(item.contextTotal, 0),
        num(item.latestTokPerSec, 0),
        num(item.outputTokens, 0),
        num(item.totalTokens, 0),
        num(item.costActual, 0),
      ]),
    ]);
    if (dom.recentListWrap.childElementCount > 0 && state.cardRenderSigs.globalList === listSig) {
      return;
    }
    state.cardRenderSigs.globalList = listSig;

    const filteredItems = hasActiveFilter
      ? listItems.filter((item) => {
          const onDisk = item.onDisk !== false;
          const itemStatus = item.status || 'IDLE';
          if (activeOnly && (!onDisk || (itemStatus !== 'GENERATING' && itemStatus !== 'RUNNING_TOOLS'))) {
            return false;
          }
          const itemModel = String(item.activeModel || 'Auto');
          if (modelFilter && itemModel !== modelFilter) {
            return false;
          }
          if (queryLower) {
            const locTitle = localizeConvTitle(item.title) || t('common.sessionPrefix', { id: shortId(item.conversationId) });
            const ws = workspaceBase(item.workspace);
            const hay = `${locTitle}\n${item.title || ''}\n${ws}\n${item.workspace || ''}\n${itemModel}\n${item.conversationId || ''}`.toLowerCase();
            if (!hay.includes(queryLower)) return false;
          }
          return true;
        })
      : listItems;

    const countDisplay = hasActiveFilter
      ? `${filteredItems.length}/${listItems.length}`
      : listItems.length;

    const listToggle = el('div', { className: 'seg-toggle', role: 'group', 'aria-label': t('global.convSortAria') },
      el('button', {
        type: 'button',
        className: `seg-btn${listMode === 'recent' ? ' active' : ''}`,
        textContent: t('global.sortRecent'),
        onClick: () => {
          if (state.convListMode !== 'recent') {
            state.convListMode = 'recent';
            const s = state.snapshot || state.globalLastSnap;
            if (s) renderGlobalSessionListSection(dom, s);
          }
        },
      }),
      el('button', {
        type: 'button',
        className: `seg-btn${listMode === 'top' ? ' active' : ''}`,
        textContent: t('global.sortTop'),
        onClick: () => {
          if (state.convListMode !== 'top') {
            state.convListMode = 'top';
            const s = state.snapshot || state.globalLastSnap;
            if (s) renderGlobalSessionListSection(dom, s);
          }
        },
      }),
    );

    dom.recentHead.replaceChildren(
      el('div', { className: 'card-title' },
        icon('receipt', 14, 'card-title-icon'),
        listMode === 'top'
          ? t('global.topConvsTitle', { period: periodTitle, count: countDisplay })
          : t('global.recentConvsTitle', { count: countDisplay }),
      ),
      listToggle,
    );

    const listBodyNode = filteredItems.length > 0
      ? el('div', { className: 'recent-list' },
          filteredItems.map((item) => {
            const onDisk = item.onDisk !== false;
            const isSelected = onDisk && viewingId && item.conversationId === viewingId;
            const title = localizeConvTitle(item.title) || t('common.sessionPrefix', { id: shortId(item.conversationId) });
            const ws = workspaceBase(item.workspace);
            const itemStatus = item.status || 'IDLE';
            const itemTotalTok = num(item.totalTokens, num(item.outputTokens, 0));

            const rowProps = {
              className: `recent-item${isSelected ? ' is-selected' : ''}${onDisk ? '' : ' is-archived'}`,
              title: `${title}\n${item.workspace || ''}\n${item.conversationId}`,
            };
            if (onDisk) {
              rowProps.role = 'button';
              rowProps.tabIndex = 0;
              rowProps.onClick = () => selectConversation(item.conversationId);
              rowProps.onKeyDown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectConversation(item.conversationId);
                }
              };
            }

            return el('div', rowProps,
              el('div', { className: 'recent-top' },
                el('div', { className: 'recent-title-wrap' },
                  !onDisk
                    ? el('span', { className: 'archived-pill', textContent: t('global.badgeArchived') })
                    : item.isToday
                      ? el('span', { className: 'today-pill', textContent: t('global.badgeToday') })
                      : null,
                  el('span', { className: 'recent-title', textContent: title }),
                ),
                onDisk
                  ? el('button', {
                      type: 'button',
                      className: 'mini-btn btn-soft',
                      onClick: (e) => {
                        e.stopPropagation();
                        openConversationInHost(item.conversationId);
                      },
                      onKeyDown: (e) => {
                        e.stopPropagation();
                      },
                    },
                      icon('external', 12),
                      t('global.openChat'),
                    )
                  : null,
              ),
              el('div', { className: 'recent-meta tabular-nums' },
                el('div', { className: 'recent-stats' },
                  onDisk
                    ? el('span', { className: `child-status ${itemStatus}` },
                        itemStatus === 'GENERATING'
                          ? icon('sparkle', 12)
                          : itemStatus === 'RUNNING_TOOLS'
                            ? icon('wrench', 12)
                            : null,
                        itemStatus === 'GENERATING'
                          ? t('global.itemGenerating')
                          : itemStatus === 'RUNNING_TOOLS'
                            ? t('global.itemTools')
                            : t('global.itemIdle'),
                      )
                    : null,
                  el('span', null,
                    createModelDot(item.activeModel),
                    ' ',
                    item.activeModel || 'Auto',
                  ),
                  ws ? el('span', { textContent: ws }) : null,
                  el('span', { textContent: fmtRelTime(item.updatedAtMs) }),
                ),
                el('div', { className: 'recent-stats' },
                  onDisk ? el('span', { title: fmtInt(item.contextTotal), textContent: `Ctx ${fmtTokens(item.contextTotal)}` }) : null,
                  onDisk ? el('span', { textContent: `${fmtRate(item.latestTokPerSec)} tok/s` }) : null,
                  el('span', { title: fmtInt(item.outputTokens), textContent: `Out ${fmtTokens(item.outputTokens)}` }),
                  el('span', { title: fmtInt(itemTotalTok), textContent: `${t('global.itemTotalPrefix')} ${fmtTokens(itemTotalTok)}` }),
                  el('span', { textContent: fmtCostCompact(item.costActual, currency) }),
                ),
              ),
            );
          }),
        )
      : el('div', {
          className: listItems.length > 0 ? 'empty-inline list-filter-empty' : 'empty-inline',
          textContent: listItems.length > 0 ? t('global.filterEmpty') : t('global.convsEmpty'),
        });

    dom.recentListWrap.replaceChildren(listBodyNode);
  }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:43:31
// ============================================================================

  // ---------------- Render Tab 2: Multi-Period Usage Statistics ----------------
  function renderGlobalTab(snap) {
    const container = $('global-content');
    if (!container) return;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:43:31
// Description: A4 — Mount persistent Tab 2 DOM skeleton and skip rebuilding upper Tab 2 cards when globalTop signature is unchanged.
// ============================================================================
    state.globalLastSnap = snap;
    const dom = ensureGlobalDom(container);
    if (!dom) return;
    const ctx = resolveGlobalPeriodContext(snap);
    const { g, currency, periodKey, period, effectiveRangeKey, periodTitle } = ctx;
    const topSig = buildGlobalTopSig(ctx);
    const needTopRender = dom.topStack.childElementCount === 0 || state.cardRenderSigs.globalTop !== topSig;
    if (needTopRender) {
      state.cardRenderSigs.globalTop = topSig;
// ============================================================================
// [MODIFIED END] 2026-11-20 15:43:31
// ============================================================================

    // 1. Period Switcher Bar
    const periodDefs = [
      { key: 'today', label: getPeriodLabel('today') },
      { key: '7d', label: getPeriodLabel('7d') },
      { key: '30d', label: getPeriodLabel('30d') },
      { key: 'all', label: getPeriodLabel('all') },
    ];
    const dateRangeLabel =
      period.startDate && period.endDate && period.startDate !== period.endDate
        ? `${period.startDate} ~ ${period.endDate}`
        : period.startDate || g.todayDate || getPeriodLabel('today');

    const periodBar = el('div', { className: 'period-bar' },
      el('div', { className: 'period-tabs', role: 'group', 'aria-label': t('periods.aria') },
        periodDefs.map((d) => el('button', {
          type: 'button',
          className: `period-btn${periodKey === d.key ? ' active' : ''}`,
          textContent: d.label,
          onClick: () => {
            if (state.globalPeriod !== d.key) {
              state.globalPeriod = d.key;
              state.selectedSeriesIdx = null;
              state.workspacesExpanded = false;
              const s = state.snapshot || state.globalLastSnap;
              if (s) renderGlobalTab(s);
            }
          },
        })),
      ),
      el('span', { className: 'period-range-text tabular-nums', textContent: dateRangeLabel }),
    );

    // 2. Subscription Value & Savings Card
    const sub = period.subscription || null;
    let subRoiCard = null;
    if (sub) {
      const planName = getPlanLabel(sub.planId, sub.planLabel);
      const planBadgeText = sub.isAutoDetected
        ? t('roi.autoBadge', { plan: planName, fee: fmtCostCompact(sub.monthlyFee, currency) })
        : t('roi.manualBadge', { plan: planName, fee: fmtCostCompact(sub.monthlyFee, currency) });

      let heroNode;
      let barPct = 0;
      let barClass = 'roi-fill';
      let captionText = '';

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Wire slot-roll animations and smooth ROI/KPI/trend bar transitions in renderGlobalTab.
// ============================================================================
      if (sub.monthlyFee <= 0) {
        barPct = 100;
        barClass = 'roi-fill is-paid';
        rollingMetricMemory.delete('glb:roi:sub');
        heroNode = el('div', { className: 'roi-hero is-paid tabular-nums' },
          renderRollingText(
            'glb:roi:hero',
            t('roi.freeHero', { cost: fmtCostCompact(sub.tokenCost, currency) }),
            num(sub.tokenCost, 0),
          ),
        );
        captionText = t('roi.freeCaption', {
          period: periodTitle,
          cost: fmtCostCompact(sub.tokenCost, currency),
          zero: fmtCostCompact(0, currency),
        });
      } else if (sub.isPaidOff) {
        barPct = 100;
        barClass = 'roi-fill is-paid';
        const multText = Number.isFinite(sub.roiMultiplier)
          ? t('roi.multBadge', { mult: sub.roiMultiplier.toFixed(2) })
          : '';
        if (!multText) rollingMetricMemory.delete('glb:roi:sub');
        heroNode = el('div', { className: 'roi-hero-row tabular-nums' },
          renderRollingText(
            'glb:roi:hero',
            t('roi.netSaved', { cost: fmtCostCompact(sub.netSavings, currency) }),
            num(sub.netSavings, 0),
            { className: 'roi-hero is-paid' },
          ),
          multText
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Set alignEnd: true on right-aligned Tab 2 ROI badges, steps count, reset card render sigs on unit toggle, and render two-line .kpi-sub-stack / .kpi-sub-line KPI sub-stats.
// ============================================================================
            ? renderRollingText('glb:roi:sub', multText, Number(sub.roiMultiplier), { className: 'roi-mult-badge', alignEnd: true })
            : null,
        );
        captionText = t('roi.paidCaption', {
          period: periodTitle,
          cost: fmtCostCompact(sub.tokenCost, currency),
          prorated: fmtCostCompact(sub.proratedFee, currency),
          monthly: fmtCostCompact(sub.monthlyFee, currency),
        });
      } else {
        barPct = Math.min(100, Math.max(0, num(sub.paybackPct, 0)));
        heroNode = el('div', { className: 'roi-hero-row tabular-nums' },
          renderRollingText(
            'glb:roi:hero',
            t('roi.paybackPct', { pct: barPct.toFixed(1) }),
            barPct,
            { className: 'roi-hero' },
          ),
          renderRollingText(
            'glb:roi:sub',
            t('roi.toBreakEven', { cost: fmtCostCompact(-sub.netSavings, currency) }),
            -num(sub.netSavings, 0),
            { className: 'muted-hint', alignEnd: true },
          ),
        );
        captionText = t('roi.paidCaption', {
          period: periodTitle,
          cost: fmtCostCompact(sub.tokenCost, currency),
          prorated: fmtCostCompact(sub.proratedFee, currency),
          monthly: fmtCostCompact(sub.monthlyFee, currency),
        });
      }

      subRoiCard = el('article', { className: 'card sub-roi-card' },
        el('div', { className: 'card-head' },
          el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:24:50
// Description: Replace .card-title-dot with wallet SVG icon in Tab 2 ROI card.
// ============================================================================
            icon('wallet', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:24:50
// ============================================================================
            t('roi.title'),
          ),
          el('button', {
            type: 'button',
            className: 'mini-btn accent tabular-nums',
            textContent: planBadgeText,
            title: t('roi.badgeTitle'),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Focus #pref-sub-plan selector when opening drawer from ROI badge click.
// ============================================================================
            onClick: () => {
              setDrawerOpen(true);
              $('pref-sub-plan')?.focus();
            },
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
          }),
        ),
        heroNode,
        el('div', { className: 'roi-track' },
          applySmoothBarSize(el('div', { className: barClass }), 'glb:roi:bar', 'width', barPct),
        ),
        el('div', { className: 'roi-caption tabular-nums', textContent: captionText }),
      );
    }

    // 3. Period KPI Strip + 4-mode Unit Switcher Pill
    const unitDefs = [
      { key: 'auto', label: 'K/M' },
      { key: 'wan_yi', label: '万/亿' },
      { key: 'exact', label: '1,234' },
      { key: 'm', label: 'M' },
    ];
    const unitToggle = el('div', { className: 'seg-toggle unit-toggle', role: 'group', 'aria-label': t('global.unitAria') },
      unitDefs.map((u) => el('button', {
        type: 'button',
        className: `seg-btn${state.tokenUnit === u.key ? ' active' : ''}`,
        textContent: u.label,
        onClick: () => {
          if (state.tokenUnit !== u.key) {
            state.tokenUnit = u.key;
            resetCardRenderSigs();
            const unitSelect = $('pref-token-unit');
            if (unitSelect) unitSelect.value = u.key;
            if (state.snapshot?.prefs) state.snapshot.prefs.tokenUnit = u.key;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:43:31
// Description: A4 — Re-render only the active tab on token unit toggle (inactive tab updates on switch via cleared sigs).
// ============================================================================
            const s = state.snapshot || state.globalLastSnap;
            if (s) {
              renderActiveTab(s);
            }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:43:31
// ============================================================================
            patchPrefs({ tokenUnit: u.key });
          }
        },
      })),
    );

    const convSubLines = period.archivedConversationsCount > 0
      ? [
          el('span', {
            className: 'kpi-sub-line',
            textContent: t('global.activeDaysLine', { active: fmtInt(period.activeDaysCount) }),
          }),
          el('span', {
            className: 'kpi-sub-line',
            textContent: t('global.archivedLine', { archived: fmtInt(period.archivedConversationsCount) }),
          }),
        ]
      : [
          el('span', {
            className: 'kpi-sub-line',
            textContent: t('global.activeDays', {
              active: fmtInt(period.activeDaysCount),
              span: fmtInt(period.spanDaysCount),
            }),
          }),
        ];

    const summaryCard = el('article', { className: 'card' },
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:24:50
// Description: Replace .card-title-dot with cost SVG icon in Tab 2 Usage Summary card.
// ============================================================================
          icon('cost', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:24:50
// ============================================================================
          t('global.summaryTitle', { period: periodTitle }),
        ),
        el('div', { className: 'summary-head-right' },
          renderRollingText(
            'glb:sum:steps',
            t('global.stepsCount', { count: fmtInt(period.stepsCount) }),
            num(period.stepsCount, 0),
            { className: 'muted-hint tabular-nums', alignEnd: true },
          ),
          unitToggle,
        ),
      ),
      el('div', { className: 'kpi-strip tabular-nums' },
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiSessions') }),
          renderRollingText('glb:kpi:sessions', fmtInt(period.conversationsCount), num(period.conversationsCount, 0), {
            className: 'kpi-val',
          }),
          el('div', { className: 'kpi-sub-stack' }, convSubLines),
        ),
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiTotalTokens') }),
          renderRollingText('glb:kpi:tokens', fmtTokens(period.totalTokens), num(period.totalTokens, 0), {
            className: 'kpi-val',
            title: fmtInt(period.totalTokens),
          }),
          el('div', { className: 'kpi-sub-stack' },
            renderRollingText(
              'glb:kpi:tokensAvg',
              t('global.avgSubLine', { avg: fmtTokens(period.avgDailyTokens) }),
              num(period.avgDailyTokens, 0),
              {
                className: 'kpi-sub-line',
                title: fmtInt(period.avgDailyTokens),
              },
            ),
            renderRollingText(
              'glb:kpi:tokensOut',
              t('global.outSubLine', { out: fmtTokens(period.outputTokens) }),
              num(period.outputTokens, 0),
              {
                className: 'kpi-sub-line',
                title: fmtInt(period.outputTokens),
              },
            ),
          ),
        ),
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiCacheHit') }),
          renderRollingText('glb:kpi:cacheHit', fmtPct(period.cacheHitRatePct), num(period.cacheHitRatePct, 0), {
            className: 'kpi-val',
          }),
          el('div', { className: 'kpi-sub-stack' },
            renderRollingText(
              'glb:kpi:cacheSub',
              t('global.uncachedSub', { input: fmtTokens(period.inputTokens) }),
              num(period.inputTokens, 0),
              {
                className: 'kpi-sub-line',
                title: fmtInt(period.inputTokens),
              },
            ),
          ),
        ),
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiEstCost') }),
          renderRollingText('glb:kpi:cost', fmtCostCompact(period.costActual, currency), num(period.costActual, 0), {
            className: 'kpi-val',
          }),
          el('div', { className: 'kpi-sub-stack' },
            renderRollingText(
              'glb:kpi:costSub',
              t('global.avgDailyCost', { cost: fmtCostCompact(period.avgDailyCost, currency) }),
              num(period.avgDailyCost, 0),
              { className: 'kpi-sub-line' },
            ),
          ),
        ),
      ),
    );
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================

    // 4. Adaptive Horizontally Scrollable & Mouse-Draggable Trend Bar Chart Card
    const series = Array.isArray(period.series) ? period.series : [];
    const metricKey = state.trendMetric === 'tokens' ? 'tokens' : 'cost';
    const isWeekly = period.trendGranularity === 'week';
    const trendTitle =
      period.trendGranularity === 'hour'
        ? t('global.trendHourTitle')
        : isWeekly
          ? t('global.trendWeekTitle')
          : t('global.trendDayTitle', { period: periodTitle });

    const nextScrollKey = `${periodKey}:${series.length}`;
    if (state.trendScrollKey !== nextScrollKey) {
      state.trendScrollKey = nextScrollKey;
      state.trendNeedsRightAlign = true;
    }

    const metricToggle = el('div', { className: 'seg-toggle', role: 'group', 'aria-label': t('global.trendMetricAria') },
      el('button', {
        type: 'button',
        className: `seg-btn${metricKey === 'cost' ? ' active' : ''}`,
        textContent: t('global.metricCost'),
        onClick: () => {
          if (state.trendMetric !== 'cost') {
            state.trendMetric = 'cost';
            if (state.snapshot) renderGlobalTab(state.snapshot);
          }
        },
      }),
      el('button', {
        type: 'button',
        className: `seg-btn${metricKey === 'tokens' ? ' active' : ''}`,
        textContent: t('global.metricTokens'),
        onClick: () => {
          if (state.trendMetric !== 'tokens') {
            state.trendMetric = 'tokens';
            if (state.snapshot) renderGlobalTab(state.snapshot);
          }
        },
      }),
    );

    const seriesValues = series.map((s) =>
      metricKey === 'tokens' ? num(s.totalTokens, 0) : num(s.costActual, 0),
    );
    const maxSeriesVal = seriesValues.reduce((m, v) => Math.max(m, v), 0);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Compute trend chart nice ceiling scale and render pinned left Y-axis
// alongside horizontally scrollable bar viewport (.trend-chart-box).
// ============================================================================
    const { axisMax, midVal, zeroVal } = computeTrendAxisScale(maxSeriesVal, metricKey);
    const fmtAxisTick = metricKey === 'tokens'
      ? (val) => fmtAxisTokens(val)
      : (val) => fmtAxisCost(val, currency);

    let defaultActiveIdx = series.length > 0 ? series.length - 1 : -1;
    if (defaultActiveIdx >= 0 && seriesValues[defaultActiveIdx] === 0) {
      for (let idx = series.length - 1; idx >= 0; idx--) {
        if (seriesValues[idx] > 0) {
          defaultActiveIdx = idx;
          break;
        }
      }
    }
    const activeIdx =
      state.selectedSeriesIdx !== null &&
      state.selectedSeriesIdx >= 0 &&
      state.selectedSeriesIdx < series.length
        ? state.selectedSeriesIdx
        : defaultActiveIdx;

    const formatBucketDetail = (bucket) => {
      if (!bucket) return t('global.trendPrompt');
      return t('global.bucketDetail', {
        range: bucket.rangeText || bucket.label,
        cost: fmtCostCompact(bucket.costActual, currency),
        total: fmtTokens(bucket.totalTokens),
        out: fmtTokens(bucket.outputTokens),
      });
    };

    const detailStrip = el('div', {
      className: 'trend-detail tabular-nums',
      textContent: activeIdx >= 0 ? formatBucketDetail(series[activeIdx]) : t('global.trendEmptyDetail'),
    });

    let trendChartEl = null;
    if (series.length > 0) {
      const trendScrollEl = el('div', { className: 'trend-scroll' },
        el('div', { className: 'trend-track' },
          series.map((bucket, idx) => {
            const v = seriesValues[idx];
            const hPct = v > 0 ? Math.min(100, Math.max(5, Math.round((v / axisMax) * 100))) : 3;
            const isZero = v <= 0;
            const isSelected = idx === activeIdx;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:43:31
// Description: B7 — Sync Tab 2 trend detail strip on keyboard focus and allow clicking the pinned bar again to unpin back to the default latest bucket.
// ============================================================================
            const barBtn = el('button', {
              type: 'button',
              className: `trend-col${isWeekly ? ' is-weekly' : ''}${isZero ? ' is-zero' : ''}${isSelected ? ' is-selected' : ''}`,
              'aria-pressed': String(isSelected),
              title: formatBucketDetail(bucket),
              onMouseEnter: () => {
                if (!state.isDraggingTrend) {
                  detailStrip.textContent = formatBucketDetail(bucket);
                }
              },
              onFocus: () => {
                detailStrip.textContent = formatBucketDetail(bucket);
              },
              onClick: () => {
                const nextIdx = state.selectedSeriesIdx === idx ? null : idx;
                state.selectedSeriesIdx = nextIdx;
                const effectiveIdx = nextIdx !== null ? nextIdx : defaultActiveIdx;
                detailStrip.textContent = effectiveIdx >= 0
                  ? formatBucketDetail(series[effectiveIdx])
                  : t('global.trendEmptyDetail');
                barBtn.parentElement?.querySelectorAll('.trend-col').forEach((n, i) => {
                  const sel = i === effectiveIdx;
                  n.classList.toggle('is-selected', sel);
                  n.setAttribute('aria-pressed', String(sel));
                });
              },
            },
// ============================================================================
// [MODIFIED END] 2026-11-20 15:43:31
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Apply smooth bar height gliding to Tab 2 trend bars via applySmoothBarSize.
// ============================================================================
              el('div', { className: 'trend-bar-track' },
                applySmoothBarSize(
                  el('div', { className: 'trend-bar-fill' }),
                  `glb:trend:${periodKey}:${bucket.key || bucket.label || idx}`,
                  'height',
                  hPct,
                ),
              ),
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
              el('span', { className: 'trend-col-label tabular-nums', textContent: bucket.label }),
            );
            return barBtn;
          }),
        ),
      );
      attachTrendChartInteractions(trendScrollEl);

      const yAxisEl = el('div', { className: 'trend-yaxis tabular-nums', 'aria-hidden': 'true' },
        el('div', { className: 'trend-yaxis-plot' },
          el('span', { className: 'trend-yaxis-tick', textContent: fmtAxisTick(axisMax) }),
          el('span', { className: 'trend-yaxis-tick', textContent: fmtAxisTick(midVal) }),
          el('span', { className: 'trend-yaxis-tick', textContent: fmtAxisTick(zeroVal) }),
        ),
      );

      trendChartEl = el('div', { className: 'trend-chart-box' },
        yAxisEl,
        trendScrollEl,
      );
    }

    const trendCard = el('article', { className: 'card' },
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:24:50
// Description: Replace .card-title-dot with trend SVG icon in Tab 2 Trend card.
// ============================================================================
          icon('trend', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:24:50
// ============================================================================
          trendTitle,
        ),
        metricToggle,
      ),
      trendChartEl
        ? [trendChartEl, detailStrip]
        : el('div', { className: 'empty-inline', textContent: t('global.trendEmpty') }),
    );
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

    // ============================================================================
    // [MODIFIED BEGIN] 2026-11-16 21:11:00
    // Description: Expand Tab 2 multi-period model breakdown table to 7 columns with 总计 (input + cache + output total throughput tokens) and raw model ID display.
    // ============================================================================
    // ============================================================================
    // [MODIFIED BEGIN] 2026-11-17 10:15:00
    // Description: Localize Tab 2 per-model breakdown card title, column headers, tooltips, and empty label.
    // ============================================================================
    // ============================================================================
    // [MODIFIED BEGIN] 2026-11-17 20:29:41
    // Description: Wire sortable Total and Cost column headers and row sorting in Tab 2 model table.
    // ============================================================================
    // 5. Period By-Model Breakdown Card
    const periodByModel = Array.isArray(period.byModel) ? period.byModel : [];
    const getTab2TotalTokens = (row) => num(
      row?.totalTokens ?? (num(row?.inputTokens, 0) + num(row?.cacheReadTokens, 0) + num(row?.outputTokens, 0)),
      0,
    );
    const sortedPeriodByModel = sortModelBreakdownRows(periodByModel, getTab2TotalTokens);

    const modelCard = el('article', { className: 'card' },
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:24:50
// Description: Replace .card-title-dot with agents SVG icon in Tab 2 Model Breakdown card.
// ============================================================================
          icon('agents', 14, 'card-title-icon'),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:24:50
// ============================================================================
          t('global.modelsTitle', { period: periodTitle }),
        ),
      ),
      sortedPeriodByModel.length > 0
        ? el('div', { className: 'table-scroll' },
            el('table', { className: 'data-table tabular-nums' },
              el('thead', null,
                el('tr', null,
                  el('th', null, t('childrenModels.colModel')),
                  el('th', { className: 'num' }, t('global.colChats')),
                  el('th', { className: 'num' }, t('childrenModels.colInput')),
                  el('th', { className: 'num' }, t('childrenModels.colCache')),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Insert per-model Cache Hit Rate column right after Cache in Tab 2 model table.
// ============================================================================
                  el('th', { className: 'num cache-hit-col', title: t('childrenModels.colCacheHitTip') }, t('childrenModels.colCacheHit')),
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================
                  el('th', { className: 'num' }, t('childrenModels.colOutput')),
                  createSortableHeaderCell({
                    colKey: 'total',
                    label: t('childrenModels.colTotal'),
                    baseTitle: t('childrenModels.colTotalTip'),
                    extraClass: 'total-col',
                  }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:24:50
// Description: Move currency unit into Tab 2 model table Cost header via table.costWithCurrency.
// ============================================================================
                  createSortableHeaderCell({
                    colKey: 'cost',
                    label: t('table.costWithCurrency', { currency }),
                  }),
// ============================================================================
// [MODIFIED END] 2026-11-20 10:24:50
// ============================================================================
                ),
              ),
              el('tbody', null,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:28:17
// Description: Format Tab 2 byModel canonical model display and merged rawModels tooltip.
// ============================================================================
                sortedPeriodByModel.map((row) => {
                  const { displayModel, title: rateTip } = formatModelBreakdownRowDisplay(row);
                  const totalTok = getTab2TotalTokens(row);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Compute and render per-model cache hit rate cell in Tab 2 model table.
// ============================================================================
                  const hitMeta = getModelRowCacheHitMeta(row);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:28:34
// Description: Add model identity .model-dot directly inside Tab 2 td.model-cell (matches .model-cell > .model-dot & ellipsis) and show numeric-only cost cell.
// ============================================================================
                  return el('tr', null,
                    el('td', { className: 'model-cell', title: rateTip },
                      createModelDot(row.profileId || displayModel, Array.isArray(row.rawModels) ? row.rawModels[0] : ''),
                      displayModel,
                    ),
                    el('td', { className: 'num', textContent: fmtInt(row.conversationsCount) }),
                    el('td', { className: 'num', title: fmtInt(row.inputTokens), textContent: fmtTokens(row.inputTokens) }),
                    el('td', { className: 'num', title: fmtInt(row.cacheReadTokens), textContent: fmtTokens(row.cacheReadTokens) }),
                    el('td', {
                      className: `num cache-hit-col ${hitMeta.tierClass}`,
                      title: hitMeta.title || undefined,
                      textContent: hitMeta.text,
                    }),
                    el('td', { className: 'num', title: fmtInt(row.outputTokens), textContent: fmtTokens(row.outputTokens) }),
                    el('td', { className: 'num total-col', title: fmtInt(totalTok), textContent: fmtTokens(totalTok) }),
                    el('td', { className: 'num', title: fmtCost(row.costActual, currency), textContent: fmtCostCompactNumber(row.costActual) }),
                  );
// ============================================================================
// [MODIFIED END] 2026-11-20 10:24:50
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================
                }),
// ============================================================================
// [MODIFIED END] 2026-11-19 13:28:17
// ============================================================================
              ),
            ),
          )
        : el('div', { className: 'empty-inline', textContent: t('global.modelsEmpty') }),
    );
    // ============================================================================
    // [MODIFIED END] 2026-11-17 20:29:41
    // ============================================================================
    // ============================================================================
    // [MODIFIED END] 2026-11-17 10:15:00
    // ============================================================================
    // ============================================================================
    // [MODIFIED END] 2026-11-16 21:11:00
    // ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:43:31
// Description: C1 — Render Tab 2 By Project (#card-global-projects) 5-column breakdown card with Top-8 fold right after Model Breakdown, and mount topStack before refreshing persistent session-list section (A4/C2).
// ============================================================================
      // 5b. By Project / Workspace Breakdown Card (C1)
      const workspaces = Array.isArray(period.byWorkspace) ? period.byWorkspace : [];
      const canToggleWorkspaces = workspaces.length > MAX_COLLAPSED_WORKSPACES;
      const visibleWorkspaces = canToggleWorkspaces && !state.workspacesExpanded
        ? workspaces.slice(0, MAX_COLLAPSED_WORKSPACES)
        : workspaces;
      const hiddenWorkspacesCount = Math.max(0, workspaces.length - visibleWorkspaces.length);

      const projectCard = el('article', { className: 'card', id: 'card-global-projects' },
        el('div', { className: 'card-head' },
          el('div', { className: 'card-title' },
            icon('folder', 14, 'card-title-icon'),
            t('projects.title', { period: periodTitle }),
          ),
        ),
        workspaces.length > 0
          ? el('div', { className: 'table-scroll' },
              el('table', { className: 'data-table tabular-nums' },
                el('thead', null,
                  el('tr', null,
                    el('th', { textContent: t('projects.colProject') }),
                    el('th', { className: 'num', textContent: t('projects.colChats') }),
                    el('th', { className: 'num total-col', textContent: t('childrenModels.colTotal') }),
                    el('th', {
                      className: 'num cache-hit-col',
                      title: t('childrenModels.colCacheHitTip'),
                      textContent: t('childrenModels.colCacheHit'),
                    }),
                    el('th', { className: 'num cost-col', textContent: t('table.costWithCurrency', { currency }) }),
                  ),
                ),
                el('tbody', null,
                  visibleWorkspaces.map((row) => {
                    const rawWs = String(row.workspace || '').trim();
                    const wsLabel = rawWs ? (workspaceBase(rawWs) || rawWs) : t('projects.ungrouped');
                    const totalTok = num(
                      row.totalTokens,
                      num(row.inputTokens, 0) + num(row.cacheReadTokens, 0) + num(row.outputTokens, 0),
                    );
                    const hitMeta = getModelRowCacheHitMeta(row);
                    return el('tr', null,
                      el('td', {
                        className: rawWs ? 'model-cell project-cell' : 'model-cell project-cell is-ungrouped',
                        title: rawWs || wsLabel,
                        textContent: wsLabel,
                      }),
                      el('td', { className: 'num', textContent: fmtInt(row.conversationsCount) }),
                      el('td', { className: 'num total-col', title: fmtInt(totalTok), textContent: fmtTokens(totalTok) }),
                      el('td', {
                        className: `num cache-hit-col ${hitMeta.tierClass}`,
                        title: hitMeta.title || undefined,
                        textContent: hitMeta.text,
                      }),
                      el('td', { className: 'num cost-col', title: fmtCost(row.costActual, currency), textContent: fmtCostCompactNumber(row.costActual) }),
                    );
                  }),
                ),
              ),
            )
          : el('div', { className: 'empty-inline', textContent: t('projects.empty') }),
        canToggleWorkspaces
          ? el('button', {
              type: 'button',
              className: 'children-toggle-bar',
              textContent: state.workspacesExpanded
                ? t('projects.collapseFooter', { shown: MAX_COLLAPSED_WORKSPACES })
                : t('projects.expandMoreFooter', { rest: hiddenWorkspacesCount, total: workspaces.length }),
              onClick: () => {
                state.workspacesExpanded = !state.workspacesExpanded;
                const s = state.snapshot || state.globalLastSnap;
                if (s) renderGlobalTab(s);
              },
            })
          : null,
      );

      const topNodes = [periodBar, subRoiCard, summaryCard, trendCard, modelCard, projectCard].filter(Boolean);
      dom.topStack.replaceChildren(...topNodes);
      syncTrendScrollPosition();
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:43:31
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Localize Recent/Top 20 conversations card, sync trend scroll position,
// sync language/tokenUnit preferences in pollSnapshot, and bind EN/ZH header toggle.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:43:31
// Description: A4, B5, B6 & C2 — Delegate Tab 2 Conversations list card rendering to persistent filter-bar section (renderGlobalSessionListSection).
// ============================================================================
    renderGlobalSessionListSection(dom, snap, ctx);
// ============================================================================
// [MODIFIED END] 2026-11-20 15:43:31
// ============================================================================
  }

  // ---------------- Polling Loop ----------------
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Implement serial polling scheduler and pollSnapshot with 15s
// AbortController timeout, detailed HTTP error parsing, conversation-epoch
// abort handling, and adaptive 350ms chunked ledger-sync polling.
// ============================================================================
  function scheduleNextPoll(delayMs, force = false) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Pause scheduled normal polling while sidecar hot-update restart is in progress.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 — Pause scheduled snapshot polling while document.hidden is true.
// ============================================================================
    if (state.updateApplying || document.hidden) {
      if (state.pollTimer) {
        clearTimeout(state.pollTimer);
        state.pollTimer = null;
      }
      return;
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
    const ms = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : POLL_INTERVAL_MS;
    state.pollTimer = setTimeout(() => {
      state.pollTimer = null;
      pollSnapshot(Boolean(force));
    }, ms);
  }

  async function pollSnapshot(force = false) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Skip normal snapshot polling while waitForRestartedSidecar owns restart polling.
// ============================================================================
    if (state.updateApplying) return;
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 — Skip background snapshot fetch while document.hidden unless forced.
// ============================================================================
    if (document.hidden && !force) return;
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
    if (state.pollInFlight) {
      if (state.inFlightConv === selectedConv) {
        if (force) state.pendingForcePoll = true;
        return;
      }
      if (state.activePollController) {
        try {
          state.activePollController.abort('conversation-switch');
        } catch {
          // Ignore abort errors
        }
      }
    }

    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }

    const epoch = state.convEpoch;
    const reqConv = selectedConv;
    const reqEtag = force ? '' : lastEtag;
    const reqPrefSeq = prefMutationSeq;
    const controller = new AbortController();
    let timedOut = false;
    let ledgerSyncing = false;

    state.pollInFlight = true;
    state.inFlightConv = reqConv;
    state.activePollController = controller;
    state.pendingForcePoll = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, POLL_TIMEOUT_MS);

    try {
      const url = `/api/snapshot?conv=${encodeURIComponent(reqConv)}&etag=${encodeURIComponent(reqEtag)}`;
      const res = await apiFetch(url, { method: 'GET', signal: controller.signal });
      if (!res.ok) {
        let detail = '';
        try {
          const errTxt = await res.text();
          try {
            const parsedErr = JSON.parse(errTxt);
            if (parsedErr?.error) detail = String(parsedErr.error);
          } catch {
            if (errTxt && errTxt.trim()) detail = errTxt.trim().slice(0, 140);
          }
        } catch {
          // Ignore body read error
        }
        throw new Error(detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Discard stale responses after conversation switch
      if (epoch !== state.convEpoch || reqConv !== selectedConv) {
        return;
      }

      if (Number.isFinite(Number(data?.serverTimeMs))) {
        state.serverClockOffsetMs = Number(data.serverTimeMs) - Date.now();
      }

      if (state.lastError) {
        state.lastError = '';
        $('error-banner').classList.add('hidden');
      }

      $('loading-state').classList.add('hidden');

      if (data?.unchanged === true) {
        if (data.etag) lastEtag = String(data.etag);
        ledgerSyncing = Boolean(
          state.snapshot?.global?.ledgerSync?.syncing || state.snapshot?.ledgerSync?.syncing,
        );
        return;
      }

      ledgerSyncing = Boolean(data?.global?.ledgerSync?.syncing || data?.ledgerSync?.syncing);

      lastEtag = String(data?.etag || '');
      state.snapshot = data;
      if (!state.homeConvId) {
        state.homeConvId = boundConvId || data?.boundConversationId || data?.current?.conversationId || '';
      }

      if (state.pendingPrefSaves === 0 && reqPrefSeq === prefMutationSeq && data?.prefs) {
        const nextLang = VALID_LANGUAGES.includes(data.prefs.language) ? data.prefs.language : 'zh';
        const nextUnit = VALID_TOKEN_UNITS.includes(data.prefs.tokenUnit) ? data.prefs.tokenUnit : 'auto';
        if (nextLang !== state.lang) {
          state.lang = nextLang;
          applyStaticTranslations();
        }
        state.tokenUnit = nextUnit;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:41
// Description: Sync modelSortBy and modelSortDir preferences from snapshot in pollSnapshot.
// ============================================================================
        state.modelSortBy = VALID_MODEL_SORT_KEYS.includes(data.prefs.modelSortBy)
          ? data.prefs.modelSortBy
          : 'cost';
        state.modelSortDir = VALID_MODEL_SORT_DIRS.includes(data.prefs.modelSortDir)
          ? data.prefs.modelSortDir
          : 'desc';
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Sync persisted pixelOfficeCollapsed preference from snapshot inside pendingPrefSaves guard.
// ============================================================================
        if (typeof data.prefs.pixelOfficeCollapsed === 'boolean') {
          state.pixelOfficeCollapsed = data.prefs.pixelOfficeCollapsed;
        }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================
      }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================

      if (!state.drawerOpen && data?.prefs) {
        populateSettingsForm(data.prefs);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Refresh auto-mode FX input live if drawer is open during background sync.
// ============================================================================
      } else if (state.drawerOpen && $('pref-cny-rate-mode')?.value !== 'manual') {
        const syncedFx = Number(data?.pricingSync?.usdToCnyRate);
        if (Number.isFinite(syncedFx) && syncedFx > 0 && $('pref-cny-rate')) {
          $('pref-cny-rate').value = syncedFx;
          renderCatalogPreviewTable();
        }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
      }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Keep #pricing-sync-status live even when settings drawer is open,
// without clobbering in-progress form edits.
// ============================================================================
      renderPricingSyncStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Sync activeUpdateStatus, settings version check bar, and open update modal on snapshot arrival.
// ============================================================================
      if (data?.updateStatus) {
        state.activeUpdateStatus = data.updateStatus;
      }
      renderUpdateCheckStatus();
      if (state.updateModalOpen && !state.updateApplying) {
        renderUpdateModalContent();
      }
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 & A5 — Render header + only the active tab on snapshot arrival and sync stopwatch loop.
// ============================================================================
      renderHeader(data);
      renderActiveTab(data);
      syncStopwatchLoop();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:43:00
// Description: Sync open #receipt-modal on snapshot arrival only when receipt-relevant data signature changes to prevent flickering.
// ============================================================================
      if (state.receiptModalOpen) {
        if (!data?.current) {
          closeReceiptModal();
        } else {
          const nextReceiptSig = computeReceiptDataSig(data.current, data.prefs);
          if (nextReceiptSig !== state.lastReceiptDataSig) {
            renderReceiptModal();
          }
        }
      }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:43:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Surface HTTP error details and 15s timeout cleanly in #error-banner
// while ignoring switch-aborted requests, and schedule next serial poll in finally.
// ============================================================================
    } catch (err) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Suppress transient fetch error banner while hot-update sidecar restart is active.
// ============================================================================
      if (state.updateApplying) return;
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================
      if (epoch !== state.convEpoch || reqConv !== selectedConv || (!timedOut && controller.signal.aborted)) {
        return;
      }
      $('loading-state').classList.add('hidden');
      state.lastError = timedOut
        ? t('common.backendTimeout')
        : (err?.message || (typeof err === 'string' ? err : '') || t('common.backendConnFailed'));
      const errBanner = $('error-banner');
      errBanner.textContent = t('common.fetchErrorPrefix', { msg: state.lastError });
      errBanner.classList.remove('hidden');
    } finally {
      clearTimeout(timeoutId);
      if (state.activePollController === controller) {
        state.pollInFlight = false;
        state.activePollController = null;
        state.inFlightConv = '';
        const shouldForce = state.pendingForcePoll;
        state.pendingForcePoll = false;
        const nextDelay = shouldForce ? 0 : (ledgerSyncing ? LEDGER_SYNC_POLL_MS : POLL_INTERVAL_MS);
        scheduleNextPoll(nextDelay, shouldForce);
      }
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================

  // ---------------- Event Bindings & Bootstrap ----------------
  function init() {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Check sessionStorage tm_updated_version on reload to show post-update toast,
// re-translate update UI on language toggle, and bind update pill/settings/modal listeners.
// ============================================================================
    let pendingUpdatedVer = '';
    try {
      const savedLang = sessionStorage.getItem('tm_updated_lang');
      if (savedLang && VALID_LANGUAGES.includes(savedLang)) {
        state.lang = savedLang;
      }
      sessionStorage.removeItem('tm_updated_lang');
      pendingUpdatedVer = sessionStorage.getItem('tm_updated_version') || '';
      if (pendingUpdatedVer) {
        sessionStorage.removeItem('tm_updated_version');
      }
    } catch {
      // Ignore restricted sessionStorage access
    }

    applyStaticTranslations();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:30:56
// Description: Mount v0.5.0 stroke empty-state SVG icon via icon('empty', 28) on startup with defensive querySelector guard.
// ============================================================================
    const emptyIconHost = typeof document.querySelector === 'function'
      ? document.querySelector('#current-empty .empty-icon')
      : null;
    if (emptyIconHost && typeof emptyIconHost.replaceChildren === 'function') {
      emptyIconHost.replaceChildren(icon('empty', 28));
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 10:30:56
// ============================================================================

    if (pendingUpdatedVer) {
      const cleanVer = pendingUpdatedVer.trim().replace(/^[vV]/, '');
      if (cleanVer) {
        showToast(t('update.updatedToast', { ver: cleanVer }));
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================

    $('btn-lang-toggle').addEventListener('click', () => {
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      applyStaticTranslations();
      if (state.snapshot?.prefs) {
        state.snapshot.prefs.language = state.lang;
      }
      if (state.lastError) {
        $('error-banner').textContent = t('common.fetchErrorPrefix', { msg: state.lastError });
      }
      if (state.snapshot) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Suppress slot-roll/bar animation during language toggle while updating stored memory.
// ============================================================================
        state.suppressMotionOnce = true;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:07:46
// Description: Invalidate Tab 1 card render signatures on language switch so labels re-translate immediately.
// ============================================================================
        resetCardRenderSigs();
// ============================================================================
// [MODIFIED END] 2026-11-17 22:07:46
// ============================================================================
        try {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4 — Render only the active tab on language toggle (inactive tab refreshes on switch via cleared sigs).
// ============================================================================
          renderHeader(state.snapshot);
          renderActiveTab(state.snapshot);
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
        } finally {
          state.suppressMotionOnce = false;
        }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
      }
      if (state.drawerOpen) {
        renderModelSelectOptions();
        updateConditionalSettingsFields();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Re-translate #pricing-sync-status when toggling language with drawer open.
// ============================================================================
        renderPricingSyncStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Re-translate #update-version-status when toggling language with drawer open.
// ============================================================================
        renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================
      }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Re-render localized release notes & labels when toggling language with update modal open.
// ============================================================================
      if (state.updateModalOpen) {
        renderUpdateModalContent();
      }
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:43:00
// Description: Re-render localized thermal receipt canvas immediately when toggling EN/ZH with #receipt-modal open.
// ============================================================================
      if (state.receiptModalOpen) {
        renderReceiptModal();
      }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Sync #btn-receipt-copy text on language toggle even while copying or modal closed.
// ============================================================================
      syncReceiptCopyControl();
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:43:00
// ============================================================================
      patchPrefs({ language: state.lang });
    });

    $('tabbtn-current').addEventListener('click', () => setActiveTab('current'));
    $('tabbtn-global').addEventListener('click', () => setActiveTab('global'));
    $('btn-goto-global').addEventListener('click', () => setActiveTab('global'));

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:00
// Description: Route #btn-back-bound to parentConversationId when directly viewing a Side Question (homeConvId === viewingId or !homeConvId), otherwise keep returning to homeConvId.
// ============================================================================
    $('btn-back-bound').addEventListener('click', () => {
      const cur = state.snapshot?.current;
      const viewingId = cur?.conversationId || selectedConv;
      const isSideQuestionWithParent = Boolean(
        cur?.childKind === 'side_question' && cur?.parentConversationId,
      );
      const targetConvId =
        isSideQuestionWithParent && (!state.homeConvId || state.homeConvId === viewingId)
          ? cur.parentConversationId
          : (state.homeConvId || (isSideQuestionWithParent ? cur.parentConversationId : ''));
      if (targetConvId) {
        if (targetConvId !== selectedConv) {
          clearCurrentSessionMotionMemory();
        }
        selectConversation(targetConvId);
      }
    });
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:00
// ============================================================================

    $('btn-settings').addEventListener('click', () => setDrawerOpen(!state.drawerOpen));
    $('btn-settings-cancel').addEventListener('click', () => setDrawerOpen(false));
    $('settings-form').addEventListener('submit', saveSettings);

    $('pref-currency').addEventListener('change', updateConditionalSettingsFields);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:48:00
// Description: Bind #pref-cny-rate-mode change listener to toggle auto vs manual FX input.
// ============================================================================
    $('pref-cny-rate-mode')?.addEventListener('change', updateConditionalSettingsFields);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
    $('pref-cny-rate').addEventListener('input', renderCatalogPreviewTable);
    $('pref-sub-plan').addEventListener('change', updateConditionalSettingsFields);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Fix #pref-model-select change handler bug, preserve select options on
// model reset, and bind #btn-sync-pricing click handler.
// ============================================================================
    $('pref-model-select').addEventListener('change', (e) => {
      const nextProfileId = e.target.value;
      if (!nextProfileId || nextProfileId === state.selectedProfileId) return;
      stageCurrentProfileFromInputs();
      state.selectedProfileId = nextProfileId;
      $('pref-model-select').value = nextProfileId;
      loadSelectedProfileInputs();
    });

    ['pref-input-price', 'pref-cached-price', 'pref-output-price'].forEach((id) => {
      $(id).addEventListener('input', stageCurrentProfileFromInputs);
    });
    $('pref-long-tier').addEventListener('change', stageCurrentProfileFromInputs);

    $('btn-reset-model').addEventListener('click', () => {
      delete state.draftModelOverrides[state.selectedProfileId];
      syncModelSelectOptionBadges();
      loadSelectedProfileInputs();
    });

    $('btn-reset-all-models').addEventListener('click', () => {
      state.draftModelOverrides = {};
      syncModelSelectOptionBadges();
      loadSelectedProfileInputs();
    });

    $('btn-sync-pricing')?.addEventListener('click', handleSyncPricingClick);
    renderPricingSyncStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================

    $('btn-resync-ledger').addEventListener('click', handleResyncLedgerClick);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:00
// Description: Bind release update pill, settings manual check bar, and hot-update modal controls.
// ============================================================================
    $('btn-update-pill')?.addEventListener('click', () => openUpdateModal());
    $('btn-check-update')?.addEventListener('click', handleCheckUpdateClick);
    $('update-version-status')?.addEventListener('click', () => {
      const us = getEffectiveUpdateStatus();
      if (us?.hasUpdate && !state.updateChecking) {
        openUpdateModal(us);
      }
    });
    $('update-version-status')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const us = getEffectiveUpdateStatus();
        if (us?.hasUpdate && !state.updateChecking) {
          e.preventDefault();
          openUpdateModal(us);
        }
      }
    });
    $('btn-update-close')?.addEventListener('click', closeUpdateModal);
    $('btn-update-skip')?.addEventListener('click', handleSkipUpdateClick);
    $('btn-update-confirm')?.addEventListener('click', handleConfirmUpdateClick);
    $('update-modal')?.addEventListener('click', (e) => {
      if (e.target === $('update-modal')) {
        closeUpdateModal();
      }
    });
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: B5 — Consolidate #update-modal Escape handling into the single priority keydown handler below so one Escape press closes only one layer.
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
    renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:43:00
// Description: Bind #receipt-modal scope/detail switches, copy/save buttons, backdrop click, and Escape shortcut.
// ============================================================================
    $('btn-receipt-close')?.addEventListener('click', closeReceiptModal);
    $('btn-receipt-scope-today')?.addEventListener('click', () => {
      if (state.receiptScope !== 'today') {
        state.receiptScope = 'today';
        renderReceiptModal();
      }
    });
    $('btn-receipt-scope-all')?.addEventListener('click', () => {
      if (state.receiptScope !== 'all') {
        state.receiptScope = 'all';
        renderReceiptModal();
      }
    });
    $('btn-receipt-mode-compact')?.addEventListener('click', () => {
      if (state.receiptDetailMode !== 'compact') {
        state.receiptDetailMode = 'compact';
        renderReceiptModal();
      }
    });
    $('btn-receipt-mode-full')?.addEventListener('click', () => {
      if (state.receiptDetailMode !== 'full') {
        state.receiptDetailMode = 'full';
        renderReceiptModal();
      }
    });
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Remove obsolete #btn-receipt-save listener in v0.3.1.
// ============================================================================
    $('btn-receipt-copy')?.addEventListener('click', handleCopyReceiptClick);
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
    $('receipt-modal')?.addEventListener('click', (e) => {
      if (e.target === $('receipt-modal')) {
        closeReceiptModal();
      }
    });
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: B5 — Unified Tab focus-trap for open dialogs and Escape handling for receipt modal, settings drawer, and Pixel Office inspector.
// ============================================================================
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (state.receiptModalOpen) {
          trapModalTabKey($('receipt-modal'), e);
        } else if (state.updateModalOpen) {
          trapModalTabKey($('update-modal'), e);
        }
        return;
      }
      if (e.key !== 'Escape') return;
      if (state.receiptModalOpen) {
        e.preventDefault();
        closeReceiptModal();
      } else if (state.updateModalOpen && !state.updateApplying) {
        e.preventDefault();
        closeUpdateModal();
      } else if (e.target?.classList?.contains?.('list-search-input')) {
        return;
      } else if (state.drawerOpen) {
        e.preventDefault();
        setDrawerOpen(false);
        $('btn-settings')?.focus?.();
      } else if (
        state.activeTab === 'current' &&
        !state.pixelOfficeCollapsed &&
        state.pixelOfficeSelectedKey
      ) {
        e.preventDefault();
        state.pixelOfficeSelectedKey = '';
        const latestCurrent = state.snapshot?.current || state.pixelOfficeLastCurrent;
        const latestPrefs = state.snapshot?.prefs || state.pixelOfficeLastPrefs;
        if (latestCurrent) {
          renderPixelOfficeCard(latestCurrent, latestPrefs);
        }
      }
    });
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:43:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A4, A5 & A6 — Pause polling & timers on document.hidden, fetch+render immediately on visible, and subscribe to prefers-reduced-motion changes.
// ============================================================================
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (state.pollTimer) {
          clearTimeout(state.pollTimer);
          state.pollTimer = null;
        }
      } else {
        tickLiveStopwatch();
        if (state.snapshot) {
          renderActiveTab(state.snapshot);
        }
        drawPixelOfficeFrame();
        if (!state.pollInFlight && !state.updateApplying) {
          pollSnapshot(false);
        }
      }
      syncStopwatchLoop();
      syncPixelOfficeLoop();
    });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onReducedMotionChange = () => {
        syncPixelOfficeLoop();
        drawPixelOfficeFrame();
      };
      if (typeof reducedMotionMq?.addEventListener === 'function') {
        reducedMotionMq.addEventListener('change', onReducedMotionChange);
      } else if (typeof reducedMotionMq?.addListener === 'function') {
        reducedMotionMq.addListener(onReducedMotionChange);
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:06
// Description: Debounced resize redraw for Pixel Office canvas.
// ============================================================================
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      let pixelOfficeResizeTimer = null;
      window.addEventListener('resize', () => {
        if (pixelOfficeResizeTimer) clearTimeout(pixelOfficeResizeTimer);
        pixelOfficeResizeTimer = setTimeout(() => {
          pixelOfficeResizeTimer = null;
          if (!document.hidden && state.activeTab === 'current' && !state.pixelOfficeCollapsed) {
            drawPixelOfficeFrame();
          }
        }, 90);
      });
    }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:06
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Trigger initial snapshot poll once and rely on serial scheduleNextPoll
// instead of overlapping setInterval polling (keep stopwatch interval).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:24
// Description: A5 — Replace always-on 100ms stopwatch setInterval with on-demand syncStopwatchLoop().
// ============================================================================
    pollSnapshot(true);
    syncStopwatchLoop();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:24
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 17:18:17
// ============================================================================
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ============================================================================
// [MODIFIED END] 2026-11-16 20:23:00
// ============================================================================
