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
  };

  const I18N = {
    zh: {
      'header.waiting': '等待会话',
      'header.generating': '⚡ Generating',
      'header.tools': '🔧 Tools',
      'header.idle': '● Idle',
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
      'context.compactBtn': '⚡ 压缩 /compact',
      'context.compactCopied': '✓ 已复制',
      'context.compactTitle': '复制 /compact 命令并在聊天框发送',
      'context.compactToast': '已复制 /compact，在聊天输入框 Ctrl+V 回车即可压缩上下文',
      'context.compactFailed': '复制失败，请手动在聊天框输入 /compact',
      'context.tickTitle': '提醒线: {soft} ({pct}%)',
      'context.currentTok': '当前 {tokens} tok',
      'context.limitsRow': '提醒线 {soft} · 最大窗口 {hard}',
      'context.healthy': 'HEALTHY · 上下文充裕 (提醒线 {soft} 已用 {softPct}%)',
      'context.warning': 'WARNING · 已超提醒线 ({soft})，建议适时执行 /compact',
      'context.critical': 'CRITICAL · 逼近最大窗口 ({hard})，强烈建议立即执行 /compact',
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
      'childrenModels.childGenerating': '⚡ Generating',
      'childrenModels.childRunning': '🔧 Running',
      'childrenModels.childIdle': '● Idle',
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
      'roi.freeHero': '🎉 零月费已抵扣 {cost}',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'roi.freeCaption': '{period}按量等效 {cost} · 订阅成本 {zero}',
      'roi.netSaved': '🎉 已净省 {cost}',
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
      'global.kpiTotalTokens': '总吞吐 Tokens',
      'global.avgOutSub': '日均 {avg} · Out {out}',
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
      'global.itemGenerating': '⚡ 生成中',
      'global.itemTools': '🔧 工具中',
      'global.itemIdle': '● 空闲',
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
      'settings.syncPricingBtn': '↻ 立即同步',
      'settings.syncPricingTitle': '立即同步官方模型单价与最新 USD/CNY 汇率',
      'settings.syncingBtn': '↻ 同步中…',
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
      'settings.checkUpdateBtn': '↻ 检查更新',
      'settings.checkUpdateTitle': '立即检查 GitHub Release 最新版本',
      'settings.checkingUpdateBtn': '↻ 检查中…',
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
      'update.confirmBtn': '立即热更新',
      'update.confirmApplying': '热更新中…',
      'update.downloading': '正在下载并校验 SHA-256...',
      'update.restarting': '正在重启服务并刷新界面...',
      'update.applyFailed': '热更新未完成: {msg}',
      'update.updatedToast': '✓ 已热更新至 v{ver}',
      'update.fallbackLink': '前往 GitHub Release 手动下载',
      'update.emptyNotes': '暂无详细更新说明，可前往 GitHub Release 查看详情。',
// ============================================================================
// [MODIFIED END] 2026-11-17 18:57:00
// ============================================================================
    },
    en: {
      'header.waiting': 'Waiting',
      'header.generating': '⚡ Generating',
      'header.tools': '🔧 Tools',
      'header.idle': '● Idle',
      'header.currentModel': 'Current Model',
      'header.modelTitle': 'Model: {model}',
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
      'context.compactBtn': '⚡ Compact',
      'context.compactCopied': '✓ Copied',
      'context.compactTitle': 'Copy /compact command to paste in chat',
      'context.compactToast': 'Copied /compact — paste (Ctrl+V) and press Enter in chat',
      'context.compactFailed': 'Copy failed — please type /compact in chat',
      'context.tickTitle': 'Alert limit: {soft} ({pct}%)',
      'context.currentTok': 'Current {tokens} tok',
      'context.limitsRow': 'Alert {soft} · Max {hard}',
      'context.healthy': 'HEALTHY · Context healthy ({softPct}% of {soft} alert limit)',
      'context.warning': 'WARNING · Exceeded {soft} alert limit — consider /compact',
      'context.critical': 'CRITICAL · Approaching {hard} max window — run /compact now',
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
      'childrenModels.childGenerating': '⚡ Generating',
      'childrenModels.childRunning': '🔧 Running',
      'childrenModels.childIdle': '● Idle',
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
      'roi.freeHero': '🎉 $0 plan covered {cost}',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:41
// ============================================================================
      'roi.freeCaption': '{period} est. API {cost} · Plan cost {zero}',
      'roi.netSaved': '🎉 Net Saved {cost}',
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
      'global.kpiTotalTokens': 'Total Tokens',
      'global.avgOutSub': 'Avg/d {avg} · Out {out}',
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
      'global.itemGenerating': '⚡ Generating',
      'global.itemTools': '🔧 Tools',
      'global.itemIdle': '● Idle',
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
      'settings.syncPricingBtn': '↻ Sync Now',
      'settings.syncPricingTitle': 'Sync latest official model rates & USD/CNY FX rate now',
      'settings.syncingBtn': '↻ Syncing…',
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
      'settings.checkUpdateBtn': '↻ Check Update',
      'settings.checkUpdateTitle': 'Check GitHub Releases for updates now',
      'settings.checkingUpdateBtn': '↻ Checking…',
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
      'update.confirmBtn': 'Update Now',
      'update.confirmApplying': 'Updating…',
      'update.downloading': 'Downloading & verifying SHA-256...',
      'update.restarting': 'Restarting sidecar & reloading...',
      'update.applyFailed': 'Hot update failed: {msg}',
      'update.updatedToast': '✓ Updated to v{ver}',
      'update.fallbackLink': 'Download on GitHub Releases',
      'update.emptyNotes': 'No release notes provided. View details on GitHub Releases.',
// ============================================================================
// [MODIFIED END] 2026-11-17 18:57:00
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
    for (const node of document.querySelectorAll('[data-i18n]')) {
      const key = node.getAttribute('data-i18n');
      if (key) node.textContent = t(key);
    }
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

  function setBoundedMotionMemory(map, key, value) {
    if (map.has(key)) {
      map.delete(key);
    } else if (map.size >= MAX_MOTION_MEMORY) {
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) map.delete(oldestKey);
    }
    map.set(key, value);
  }

  function clearCurrentSessionMotionMemory() {
    for (const key of rollingMetricMemory.keys()) {
      if (key.startsWith('cur:')) rollingMetricMemory.delete(key);
    }
    for (const key of barMetricMemory.keys()) {
      if (key.startsWith('cur:')) barMetricMemory.delete(key);
    }
  }

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

  function renderRollingText(metricKey, nextText, rawNumVal = null, props = null) {
    const str = String(nextText ?? '');
    const prev = rollingMetricMemory.get(metricKey);
    const numVal =
      rawNumVal !== null && rawNumVal !== undefined && Number.isFinite(Number(rawNumVal))
        ? Number(rawNumVal)
        : parseLeadingMetricNumber(str);
    setBoundedMotionMemory(rollingMetricMemory, metricKey, { text: str, numVal });

    const baseProps = {};
    if (props && typeof props === 'object') {
      for (const [k, v] of Object.entries(props)) {
        if (k === 'textContent') continue;
        baseProps[k] = v;
      }
    }

    if (!prev || prev.text === str || !shouldAnimateMetrics()) {
      return el('span', Object.keys(baseProps).length > 0 ? baseProps : null, str);
    }

    const isDown =
      numVal !== null &&
      prev.numVal !== null &&
      Number.isFinite(numVal) &&
      Number.isFinite(prev.numVal) &&
      numVal < prev.numVal;
    const dir = isDown ? 'down' : 'up';
    const { prefix, prevMid, nextMid, suffix } = splitRollingAffixes(prev.text, str);

    const animProps = {};
    for (const [k, v] of Object.entries(baseProps)) {
      if (k === 'className') continue;
      animProps[k] = v;
    }
    const existingClass = baseProps.className ? String(baseProps.className).trim() : '';
    animProps.className = existingClass ? `${existingClass} roll-val is-${dir}` : `roll-val is-${dir}`;
    animProps['aria-label'] = str;

    const children = [];
    if (prefix) {
      children.push(el('span', { className: 'roll-static', 'aria-hidden': 'true' }, prefix));
    }

    if (prevMid.length === nextMid.length && nextMid.length > 0 && nextMid.length <= 14) {
      for (let i = 0; i < nextMid.length; i += 1) {
        if (prevMid[i] === nextMid[i]) {
          children.push(el('span', { className: 'roll-static', 'aria-hidden': 'true' }, nextMid[i]));
        } else {
          children.push(
            el('span', {
              className: 'roll-col',
              'aria-hidden': 'true',
              style: { '--roll-delay': `${Math.min(i * 14, 70)}ms` },
            },
              el('span', { className: 'roll-old' }, prevMid[i]),
              el('span', { className: 'roll-new' }, nextMid[i]),
            ),
          );
        }
      }
    } else {
      children.push(
        el('span', { className: 'roll-col is-chunk', 'aria-hidden': 'true' },
          el('span', { className: 'roll-old' }, prevMid.join('')),
          el('span', { className: 'roll-new' }, nextMid.join('')),
        ),
      );
    }

    if (suffix) {
      children.push(el('span', { className: 'roll-static', 'aria-hidden': 'true' }, suffix));
    }

    const wrapper = el('span', animProps, children);
    const hadAriaLabel = Object.prototype.hasOwnProperty.call(baseProps, 'aria-label');
    setTimeout(() => {
      if (wrapper.isConnected) {
        wrapper.classList.remove('roll-val', 'is-up', 'is-down');
        if (!hadAriaLabel) {
          wrapper.removeAttribute('aria-label');
        }
        wrapper.textContent = str;
      }
    }, 410);
    return wrapper;
  }

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
    return Boolean(current?.isChildSession || (cid && state.inspectedChildIds.has(cid)));
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

  function showToast(msg) {
    const banner = $('toast-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.remove('hidden');
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 2600);
  }

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
      showToast(t('settings.saveFailed', { msg: err?.message || 'error' }));
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
    if (/carbon|orchestrator|gemini[\s-]*(?:[23][\w.-]*[\s-]*)?pro|^pro$/.test(s)) return 'gemini-4-carbon';
    if (/hydrogen/.test(s)) return 'gemini-4-hydrogen';
    if (/flash/.test(s)) return 'gemini-3-8-flash';
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
    if (!isCurr) {
      syncTrendScrollPosition();
    }
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
      return {
        inputPer1M: 2,
        cachedPer1M: 0.2,
        outputPer1M: 10,
        longContextTier: true,
        isOverridden: false,
        defaultUsd: { inputPer1M: 2, cachedPer1M: 0.2, outputPer1M: 10, longContextTier: true },
      };
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
    $('pref-soft-limit').value = num(prefs.softContextLimit, 400000);
    $('pref-hard-limit').value = num(prefs.hardContextLimit, 500000);
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
      lastEtag = '';
      setDrawerOpen(false);
      showToast(t('settings.savedToast'));
      await pollSnapshot(true);
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
      syncBtn.textContent = isSyncing ? t('settings.syncingBtn') : t('settings.syncPricingBtn');
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

      state.pricingSyncing = false;
      renderModelSelectOptions();
      loadSelectedProfileInputs();
      updateConditionalSettingsFields();
      renderPricingSyncStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 15:48:00
// ============================================================================
      lastEtag = '';
      if (state.snapshot) {
        renderCurrentTab(state.snapshot);
        renderGlobalTab(state.snapshot);
      }
      if (data?.ok) {
        const discoveredCount = num(data?.pricingSync?.discoveredCount, 0);
        showToast(
          discoveredCount > 0
            ? t('settings.syncSuccessDiscoveredToast', { count: discoveredCount })
            : t('settings.syncSuccessToast'),
        );
      } else {
        const errMsg = data?.pricingSync?.error || t('settings.syncOfflineHint');
        showToast(t('settings.syncFailedToast', { msg: errMsg }));
      }
      await pollSnapshot(true);
    } catch (err) {
      state.pricingSyncing = false;
      renderPricingSyncStatus();
      showToast(t('settings.syncFailedToast', { msg: err?.message || 'error' }));
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
  function getCurrentAppVersion() {
    const raw =
      state.snapshot?.appVersion ||
      state.snapshot?.updateStatus?.currentVersion ||
      state.activeUpdateStatus?.currentVersion ||
      '0.2.4';
    return String(raw).trim().replace(/^[vV]/, '') || '0.2.4';
  }

  function getEffectiveUpdateStatus() {
    return state.snapshot?.updateStatus || state.activeUpdateStatus || null;
  }

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

    // Strip trailing/embedded Installation / 安装方式 sections and horizontal rules
    const filtered = [];
    let skippingInstallLevel = 0;
    for (const line of chosenLines) {
      const hMatch = line.match(/^(#{1,4})\s+(.+?)\s*$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const hTitle = hMatch[2].trim();
        if (/^(?:installation|install\b|安装方式|安装说明|安装指南|安装$)/i.test(hTitle)) {
          skippingInstallLevel = level;
          continue;
        }
        if (skippingInstallLevel > 0 && level <= skippingInstallLevel) {
          skippingInstallLevel = 0;
        }
      }
      if (skippingInstallLevel > 0) continue;
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue;
      filtered.push(line);
    }

    return filtered;
  }

  function parseInlineMarkdownTokens(lineText) {
    const raw = String(lineText || '');
    const parts = [];
    const tokenRe = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]+\)/g;
    let lastIdx = 0;
    let match;
    while ((match = tokenRe.exec(raw)) !== null) {
      if (match.index > lastIdx) {
        parts.push(raw.slice(lastIdx, match.index));
      }
      if (match[1] !== undefined) {
        parts.push(el('strong', { textContent: match[1] }));
      } else if (match[2] !== undefined) {
        parts.push(el('code', { className: 'update-notes-code', textContent: match[2] }));
      } else if (match[3] !== undefined) {
        parts.push(match[3]);
      }
      lastIdx = tokenRe.lastIndex;
    }
    if (lastIdx < raw.length) {
      parts.push(raw.slice(lastIdx));
    }
    return parts.length > 0 ? parts : [raw];
  }

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
      checkBtn.textContent = isChecking ? t('settings.checkingUpdateBtn') : t('settings.checkUpdateBtn');
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
    if (us?.error && !us?.lastCheckedAtMs) {
      statusEl.className = 'pricing-sync-status muted-hint tabular-nums is-offline';
      statusEl.textContent = t('settings.verCheckError', { cur: curVer });
      statusEl.title = String(us.error);
      return;
    }

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
      children.push(
        el('a', {
          className: 'update-fallback-link',
          href: trimmedUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          textContent: `↗ ${t('update.fallbackLink')}`,
        }),
      );
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

  function openUpdateModal(customStatus = null) {
    const us = customStatus || getEffectiveUpdateStatus();
    if (!us) return;
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
  }

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
        openUpdateModal(us);
      } else if (data?.ok === false && us?.error) {
        renderUpdateCheckStatus();
        showToast(t('settings.checkUpdateFailedToast', { msg: us.error }));
      } else {
        renderUpdateCheckStatus();
        const curVer = String(data?.appVersion || us?.currentVersion || getCurrentAppVersion())
          .trim()
          .replace(/^[vV]/, '');
        showToast(t('settings.upToDateToast', { cur: curVer }));
      }
      lastEtag = '';
      pollSnapshot(true);
    } catch (err) {
      state.updateChecking = false;
      renderUpdateCheckStatus();
      showToast(t('settings.checkUpdateFailedToast', { msg: err?.message || 'error' }));
    }
  }

  function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForRestartedSidecar(prevBootId, targetVersion) {
    const cleanTarget = String(targetVersion || '').trim().replace(/^[vV]/, '');
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await sleepMs(400);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
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

    try {
      const res = await apiFetch('/api/apply-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      let data = null;
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
        const errMsg = data?.error || `HTTP ${res.status}`;
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
      setUpdateModalFeedback(
        'error',
        t('update.applyFailed', { msg: err?.message || 'error' }),
        fallbackUrl,
      );
      scheduleNextPoll(POLL_INTERVAL_MS, true);
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 18:58:00
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
    const nextText = formatStatusText(current);
    statusText.textContent = nextText;
    statusPill.title = nextText;
    state.lastStopwatchText = nextText;

    const modelName = current?.activeModel || '—';
    modelText.textContent = modelName;
    $('model-pill').title = modelName !== '—'
      ? t('header.modelTitle', { model: modelName })
      : t('header.currentModel');

    // Non-bound conversation banner
    const banner = $('nonbound-banner');
    const viewingId = current?.conversationId || selectedConv;
    const isNonBound = Boolean(
      state.homeConvId && viewingId && viewingId !== state.homeConvId
    );
    banner.classList.toggle('hidden', !isNonBound);
    if (isNonBound) {
      const label = localizeConvTitle(current?.title) || shortId(viewingId);
      $('nonbound-label').textContent = t('header.viewing', { label });
      $('nonbound-label').title = `${label} (${viewingId})`;
    }

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
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

  function tickLiveStopwatch() {
    if (document.hidden) return;
    const current = state.snapshot?.current;
    if (current?.status === 'GENERATING' && current?.generatingSinceMs) {
      const nextText = formatStatusText(current);
      if (nextText !== state.lastStopwatchText) {
        $('status-text').textContent = nextText;
        state.lastStopwatchText = nextText;
      }
    }

    const childTimers = document.querySelectorAll('[data-child-since]');
    for (const node of childTimers) {
      const since = Number(node.dataset.childSince);
      if (!Number.isFinite(since) || since <= 0) continue;
      const next = `⚡ ${fmtElapsed(since)}`;
      if (node.textContent !== next) {
        node.textContent = next;
      }
    }
  }

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
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Wire slot-roll text animations and smooth spark-bar height gliding
// in renderSpeedCard, and isolate Subagent/Swarm Worker Equivalent Cost view +
// rolling metrics in renderCostCard.
// ============================================================================
    const maxRate = recent.reduce((m, s) => Math.max(m, num(s.tokPerSec, 0)), 0);
    const sparkBars = recent.length > 0
      ? recent.map((s, idx) => {
          const r = num(s.tokPerSec, 0);
          const pct = maxRate > 0 ? Math.max(10, Math.round((r / maxRate) * 100)) : 12;
          const isLast = idx === recent.length - 1;
          const tip = `#${num(s.stepIndex, idx)}: ${fmtRate(r)} tok/s (${fmtInt(s.outputTokens)} tok / ${num(s.durationSec, 0).toFixed(1)}s)${s.model ? ' · ' + s.model : ''}`;
          return applySmoothBarSize(
            el('span', {
              className: `spark-bar${isLast ? ' latest' : ''}`,
              title: tip,
            }),
            `cur:spark:${idx}`,
            'height',
            pct,
          );
        })
      : [el('span', { className: 'empty-inline', textContent: t('speed.empty') })];

    card.replaceChildren(
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
          el('span', { className: 'card-title-dot' }),
          t('speed.title'),
        ),
        renderRollingText(
          'cur:speed:steps',
          t('speed.measuredSteps', { count: fmtInt(speed.measuredStepsCount) }),
          num(speed.measuredStepsCount, 0),
          { className: 'muted-hint tabular-nums' },
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
      el('div', { className: 'sub-stats tabular-nums' },
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

    const headRight = isChildView
      ? el('span', { className: 'child-cost-badge', textContent: t('cost.childIsolatedBadge') })
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

    card.replaceChildren(
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
          el('span', { className: 'card-title-dot' }),
          t('cost.title'),
        ),
        headRight,
      ),
      el('div', { className: 'hero-value-row tabular-nums' },
        renderRollingText('cur:cost:hero', fmtCost(costActual, currency), costActual, { className: 'hero-value' }),
      ),
      el('div', { className: 'sub-stats tabular-nums' },
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
    const softLimit = Math.max(1, num(ctx.softLimit, 400000));
    const hardLimit = Math.max(1, num(ctx.hardLimit, 500000));
    const hardPct = num(ctx.hardUsagePct, (currentTotal / hardLimit) * 100);
    const softPct = num(ctx.softUsagePct, (currentTotal / softLimit) * 100);
    const rawLevel = ctx.usageLevel;
    const level = ['HEALTHY', 'WARNING', 'CRITICAL'].includes(rawLevel)
      ? rawLevel
      : 'HEALTHY';

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

    const isCopied = state.compactCopiedUntil > Date.now();
    const compactClasses = [
      'compact-btn',
      level === 'WARNING' ? 'is-warning' : level === 'CRITICAL' ? 'is-critical' : '',
      isCopied ? 'is-copied' : '',
    ].filter(Boolean).join(' ');

    const compactBtn = el('button', {
      type: 'button',
      className: compactClasses,
      title: t('context.compactTitle'),
      textContent: isCopied ? t('context.compactCopied') : t('context.compactBtn'),
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
        showToast(copied ? t('context.compactToast') : t('context.compactFailed'));
      },
    });

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
          el('span', { className: 'card-title-dot' }),
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
      el('div', { className: `level-banner ${level}` },
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
          el('span', { className: 'card-title-dot' }),
          t('cache.title'),
        ),
        renderRollingText('cur:cache:headRate', t('cache.hitRate', { pct: hitPct.toFixed(1) }), hitPct, {
          className: 'muted-hint tabular-nums',
        }),
      ),
      el('div', { className: 'cache-seg-track', title: `Cache Read ${fmtInt(cacheRead)} / Uncached ${fmtInt(uncached)}` },
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
    if (state.snapshot) {
      renderCurrentTab(state.snapshot);
      renderGlobalTab(state.snapshot);
    }
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

  function renderChildrenAndModelsCard(current, prefs) {
    const card = $('card-children-models');
    const currency = prefs?.currency || 'USD';
    const children = Array.isArray(current.children) ? current.children : [];
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

    const nodes = [
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
          el('span', { className: 'card-title-dot' }),
          t('childrenModels.title'),
        ),
        children.length > 0
          ? el('span', {
              className: 'muted-hint tabular-nums',
              textContent: t('childrenModels.membersCount', { count: children.length }),
            })
          : null,
      ),
    ];

    if (children.length > 0) {
      nodes.push(
        el('div', { className: 'children-section' },
          el('div', { className: 'section-subhead', textContent: t('childrenModels.liveSubhead') }),
          el('div', { className: 'children-list' },
            children.map((ch) => {
              const kind = ch.kind === 'swarm' ? 'swarm' : 'subagent';
              const status = ch.status || 'IDLE';
              const statusSpan = el('span', {
                className: `child-status tabular-nums ${status}`,
                textContent: status === 'GENERATING' && ch.generatingSinceMs
                  ? `⚡ ${fmtElapsed(ch.generatingSinceMs)}`
                  : status === 'GENERATING'
                    ? t('childrenModels.childGenerating')
                    : status === 'RUNNING_TOOLS'
                      ? t('childrenModels.childRunning')
                      : t('childrenModels.childIdle'),
              });
              if (status === 'GENERATING' && ch.generatingSinceMs) {
                statusSpan.dataset.childSince = String(ch.generatingSinceMs);
              }

              return el('div', { className: 'child-row' },
                el('div', { className: 'child-top' },
                  el('div', { className: 'child-id-group' },
                    el('span', { className: 'child-name', textContent: ch.name || shortId(ch.conversationId) }),
                    el('span', { className: `kind-badge ${kind}`, textContent: kind === 'swarm' ? 'Swarm' : 'Subagent' }),
                    ch.role && ch.role !== ch.name
                      ? el('span', { className: 'muted-hint', textContent: ch.role })
                      : null,
                  ),
                  statusSpan,
                ),
                el('div', { className: 'child-meta' },
                  el('div', { className: 'child-stats tabular-nums' },
                    el('span', { textContent: ch.model || 'Auto' }),
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
                    el('button', {
                      type: 'button',
                      className: 'mini-btn',
                      textContent: t('childrenModels.openChatBtn'),
                      onClick: () => openConversationInHost(ch.conversationId),
                    }),
                  ),
                ),
              );
            }),
          ),
        ),
      );
    }
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
                  el('th', { className: 'num' }, t('childrenModels.colOutput')),
                  createSortableHeaderCell({
                    colKey: 'total',
                    label: t('childrenModels.colTotal'),
                    baseTitle: t('childrenModels.colTotalTip'),
                    extraClass: 'total-col',
                  }),
                  createSortableHeaderCell({
                    colKey: 'cost',
                    label: t('childrenModels.colCost'),
                  }),
                ),
              ),
              el('tbody', null,
                sortedByModel.map((row) => {
                  const profLabel = state.lang === 'en' && row.profileId && MODEL_PROFILE_EN[row.profileId]
                    ? MODEL_PROFILE_EN[row.profileId].label
                    : row.profileLabel;
                  const rateTip = profLabel
                    ? t('childrenModels.rateTip', {
                        model: row.model || 'Auto',
                        profile: profLabel,
                        rate: row.rateDisplay || '',
                      })
                    : row.model || 'Auto';
                  const totalTok = getTab1TotalTokens(row);
                  return el('tr', null,
                    el('td', { className: 'model-cell', title: rateTip, textContent: row.model || 'Auto' }),
                    el('td', { className: 'num', textContent: fmtInt(row.stepsCount) }),
                    el('td', { className: 'num', title: fmtInt(row.inputUncachedTokens), textContent: fmtTokens(row.inputUncachedTokens) }),
                    el('td', { className: 'num', title: fmtInt(row.cacheReadTokens), textContent: fmtTokens(row.cacheReadTokens) }),
                    el('td', { className: 'num', title: fmtInt(row.outputTokens), textContent: fmtTokens(row.outputTokens) }),
                    el('td', { className: 'num total-col', title: fmtInt(totalTok), textContent: fmtTokens(totalTok) }),
                    el('td', { className: 'num', textContent: fmtCost(row.costActual, currency) }),
                  );
                }),
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
  }

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
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const titleText = localizeConvTitle(current.title) || t('common.sessionPrefix', { id: shortId(current.conversationId) });
    $('conv-title').textContent = titleText;
    $('conv-title').title = `${titleText} (${current.conversationId})`;

    const wsBase = workspaceBase(current.workspace);
    $('conv-workspace').textContent = wsBase;
    $('conv-workspace').title = current.workspace || '';

    renderSpeedCard(current);
    renderCostCard(current, snap.prefs);
    renderContextCard(current);
    renderCacheCard(current);
    renderChildrenAndModelsCard(current, snap.prefs);
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
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

  // ---------------- Render Tab 2: Multi-Period Usage Statistics ----------------
  function renderGlobalTab(snap) {
    const container = $('global-content');
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
      topConversations: [],
      subscription: null,
    };

    const period = periods[periodKey] || periods.today || fallbackToday;
    const effectiveRangeKey = period.rangeKey || periodKey;
    const periodTitle = getPeriodLabel(effectiveRangeKey);
    const recent = Array.isArray(g.recentConversations) ? g.recentConversations : [];
    const viewingId = snap?.current?.conversationId || selectedConv;

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
              if (state.snapshot) renderGlobalTab(state.snapshot);
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
            ? renderRollingText('glb:roi:sub', multText, Number(sub.roiMultiplier), { className: 'roi-mult-badge' })
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
            { className: 'muted-hint' },
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
            el('span', { className: 'card-title-dot' }),
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
            const unitSelect = $('pref-token-unit');
            if (unitSelect) unitSelect.value = u.key;
            if (state.snapshot?.prefs) state.snapshot.prefs.tokenUnit = u.key;
            if (state.snapshot) {
              renderCurrentTab(state.snapshot);
              renderGlobalTab(state.snapshot);
            }
            patchPrefs({ tokenUnit: u.key });
          }
        },
      })),
    );

    const convSubHint =
      period.archivedConversationsCount > 0
        ? t('global.activeWithArchived', {
            active: fmtInt(period.activeDaysCount),
            archived: fmtInt(period.archivedConversationsCount),
          })
        : t('global.activeDays', {
            active: fmtInt(period.activeDaysCount),
            span: fmtInt(period.spanDaysCount),
          });

    const summaryCard = el('article', { className: 'card' },
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
          el('span', { className: 'card-title-dot' }),
          t('global.summaryTitle', { period: periodTitle }),
        ),
        el('div', { className: 'summary-head-right' },
          renderRollingText(
            'glb:sum:steps',
            t('global.stepsCount', { count: fmtInt(period.stepsCount) }),
            num(period.stepsCount, 0),
            { className: 'muted-hint tabular-nums' },
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
          el('span', { className: 'muted-hint', textContent: convSubHint }),
        ),
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiTotalTokens') }),
          renderRollingText('glb:kpi:tokens', fmtTokens(period.totalTokens), num(period.totalTokens, 0), {
            className: 'kpi-val',
            title: fmtInt(period.totalTokens),
          }),
          renderRollingText(
            'glb:kpi:tokensSub',
            t('global.avgOutSub', {
              avg: fmtTokens(period.avgDailyTokens),
              out: fmtTokens(period.outputTokens),
            }),
            num(period.avgDailyTokens, 0),
            {
              className: 'muted-hint',
              title: `${fmtInt(period.avgDailyTokens)} / ${fmtInt(period.outputTokens)}`,
            },
          ),
        ),
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiCacheHit') }),
          renderRollingText('glb:kpi:cacheHit', fmtPct(period.cacheHitRatePct), num(period.cacheHitRatePct, 0), {
            className: 'kpi-val',
          }),
          renderRollingText(
            'glb:kpi:cacheSub',
            t('global.uncachedSub', { input: fmtTokens(period.inputTokens) }),
            num(period.inputTokens, 0),
            {
              className: 'muted-hint',
              title: fmtInt(period.inputTokens),
            },
          ),
        ),
        el('div', { className: 'kpi-tile' },
          el('span', { className: 'kpi-label', textContent: t('global.kpiEstCost') }),
          renderRollingText('glb:kpi:cost', fmtCostCompact(period.costActual, currency), num(period.costActual, 0), {
            className: 'kpi-val',
          }),
          renderRollingText(
            'glb:kpi:costSub',
            t('global.avgDailyCost', { cost: fmtCostCompact(period.avgDailyCost, currency) }),
            num(period.avgDailyCost, 0),
            { className: 'muted-hint' },
          ),
        ),
      ),
    );
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
            const barBtn = el('button', {
              type: 'button',
              className: `trend-col${isWeekly ? ' is-weekly' : ''}${isZero ? ' is-zero' : ''}${isSelected ? ' is-selected' : ''}`,
              title: formatBucketDetail(bucket),
              onMouseEnter: () => {
                if (!state.isDraggingTrend) {
                  detailStrip.textContent = formatBucketDetail(bucket);
                }
              },
              onClick: () => {
                state.selectedSeriesIdx = idx;
                detailStrip.textContent = formatBucketDetail(bucket);
                barBtn.parentElement?.querySelectorAll('.trend-col').forEach((n, i) => {
                  n.classList.toggle('is-selected', i === idx);
                });
              },
            },
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
          el('span', { className: 'card-title-dot' }),
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
          el('span', { className: 'card-title-dot' }),
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
                  el('th', { className: 'num' }, t('childrenModels.colOutput')),
                  createSortableHeaderCell({
                    colKey: 'total',
                    label: t('childrenModels.colTotal'),
                    baseTitle: t('childrenModels.colTotalTip'),
                    extraClass: 'total-col',
                  }),
                  createSortableHeaderCell({
                    colKey: 'cost',
                    label: t('childrenModels.colCost'),
                  }),
                ),
              ),
              el('tbody', null,
                sortedPeriodByModel.map((row) => {
                  const profLabel = state.lang === 'en' && row.profileId && MODEL_PROFILE_EN[row.profileId]
                    ? MODEL_PROFILE_EN[row.profileId].label
                    : row.profileLabel;
                  const rateTip = profLabel
                    ? t('childrenModels.rateTip', {
                        model: row.model || 'Auto',
                        profile: profLabel,
                        rate: row.rateDisplay || '',
                      })
                    : row.model || 'Auto';
                  const totalTok = getTab2TotalTokens(row);
                  return el('tr', null,
                    el('td', { className: 'model-cell', title: rateTip, textContent: row.model || 'Auto' }),
                    el('td', { className: 'num', textContent: fmtInt(row.conversationsCount) }),
                    el('td', { className: 'num', title: fmtInt(row.inputTokens), textContent: fmtTokens(row.inputTokens) }),
                    el('td', { className: 'num', title: fmtInt(row.cacheReadTokens), textContent: fmtTokens(row.cacheReadTokens) }),
                    el('td', { className: 'num', title: fmtInt(row.outputTokens), textContent: fmtTokens(row.outputTokens) }),
                    el('td', { className: 'num total-col', title: fmtInt(totalTok), textContent: fmtTokens(totalTok) }),
                    el('td', { className: 'num', textContent: fmtCostCompact(row.costActual, currency) }),
                  );
                }),
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
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Localize Recent/Top 20 conversations card, sync trend scroll position,
// sync language/tokenUnit preferences in pollSnapshot, and bind EN/ZH header toggle.
// ============================================================================
    // 6. Conversations List Card (Recent Active | Top Cost in Period)
    const listMode = state.convListMode === 'top' ? 'top' : 'recent';
    const topConvs = Array.isArray(period.topConversations) ? period.topConversations : [];
    const listItems = listMode === 'top' ? topConvs : recent;

    const listToggle = el('div', { className: 'seg-toggle', role: 'group', 'aria-label': t('global.convSortAria') },
      el('button', {
        type: 'button',
        className: `seg-btn${listMode === 'recent' ? ' active' : ''}`,
        textContent: t('global.sortRecent'),
        onClick: () => {
          if (state.convListMode !== 'recent') {
            state.convListMode = 'recent';
            if (state.snapshot) renderGlobalTab(state.snapshot);
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
            if (state.snapshot) renderGlobalTab(state.snapshot);
          }
        },
      }),
    );

    const recentCard = el('article', { className: 'card' },
      el('div', { className: 'card-head' },
        el('div', { className: 'card-title' },
          el('span', { className: 'card-title-dot' }),
          listMode === 'top'
            ? t('global.topConvsTitle', { period: periodTitle, count: listItems.length })
            : t('global.recentConvsTitle', { count: listItems.length }),
        ),
        listToggle,
      ),
      listItems.length > 0
        ? el('div', { className: 'recent-list' },
            listItems.map((item) => {
              const onDisk = item.onDisk !== false;
              const isSelected = onDisk && viewingId && item.conversationId === viewingId;
              const title = localizeConvTitle(item.title) || t('common.sessionPrefix', { id: shortId(item.conversationId) });
              const ws = workspaceBase(item.workspace);
              const itemStatus = item.status || 'IDLE';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Compute per-conversation totalTokens for Tab 2 list items.
// ============================================================================
              const itemTotalTok = num(item.totalTokens, num(item.outputTokens, 0));
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================

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
                        className: 'mini-btn',
                        textContent: t('global.openChat'),
                        onClick: (e) => {
                          e.stopPropagation();
                          openConversationInHost(item.conversationId);
                        },
                      })
                    : null,
                ),
                el('div', { className: 'recent-meta tabular-nums' },
                  el('div', { className: 'recent-stats' },
                    onDisk
                      ? el('span', {
                          className: `child-status ${itemStatus}`,
                          textContent: itemStatus === 'GENERATING'
                            ? t('global.itemGenerating')
                            : itemStatus === 'RUNNING_TOOLS'
                              ? t('global.itemTools')
                              : t('global.itemIdle'),
                        })
                      : null,
                    el('span', { textContent: item.activeModel || 'Auto' }),
                    ws ? el('span', { textContent: ws }) : null,
                    el('span', { textContent: fmtRelTime(item.updatedAtMs) }),
                  ),
                  el('div', { className: 'recent-stats' },
                    onDisk ? el('span', { title: fmtInt(item.contextTotal), textContent: `Ctx ${fmtTokens(item.contextTotal)}` }) : null,
                    onDisk ? el('span', { textContent: `${fmtRate(item.latestTokPerSec)} tok/s` }) : null,
                    el('span', { title: fmtInt(item.outputTokens), textContent: `Out ${fmtTokens(item.outputTokens)}` }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:35:00
// Description: Display per-conversation Total Tokens alongside Ctx / tok/s / Out in Tab 2 rows.
// ============================================================================
                    el('span', { title: fmtInt(itemTotalTok), textContent: `${t('global.itemTotalPrefix')} ${fmtTokens(itemTotalTok)}` }),
// ============================================================================
// [MODIFIED END] 2026-11-17 11:35:00
// ============================================================================
                    el('span', { textContent: fmtCostCompact(item.costActual, currency) }),
                  ),
                ),
              );
            }),
          )
        : el('div', { className: 'empty-inline', textContent: t('global.convsEmpty') }),
    );

    const nodes = [periodBar, subRoiCard, summaryCard, trendCard, modelCard, recentCard].filter(Boolean);
    container.replaceChildren(...nodes);
    syncTrendScrollPosition();
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
    if (state.updateApplying) return;
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

      renderHeader(data);
      renderCurrentTab(data);
      if (state.isDraggingTrend) {
        state.pendingGlobalRerender = true;
      } else {
        renderGlobalTab(data);
      }
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
        try {
          renderHeader(state.snapshot);
          renderCurrentTab(state.snapshot);
          renderGlobalTab(state.snapshot);
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
      patchPrefs({ language: state.lang });
    });

    $('tabbtn-current').addEventListener('click', () => setActiveTab('current'));
    $('tabbtn-global').addEventListener('click', () => setActiveTab('global'));
    $('btn-goto-global').addEventListener('click', () => setActiveTab('global'));

    $('btn-back-bound').addEventListener('click', () => {
      if (state.homeConvId) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:45
// Description: Clear current-session motion memory when returning to home conversation.
// ============================================================================
        if (state.homeConvId !== selectedConv) {
          clearCurrentSessionMotionMemory();
        }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:45
// ============================================================================
        selectConversation(state.homeConvId);
      }
    });

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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.updateModalOpen && !state.updateApplying) {
        e.preventDefault();
        closeUpdateModal();
      }
    });
    renderUpdateCheckStatus();
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:00
// ============================================================================

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        tickLiveStopwatch();
      }
    });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:18:17
// Description: Trigger initial snapshot poll once and rely on serial scheduleNextPoll
// instead of overlapping setInterval polling (keep stopwatch interval).
// ============================================================================
    pollSnapshot(true);
    setInterval(tickLiveStopwatch, STOPWATCH_INTERVAL_MS);
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
