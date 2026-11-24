// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 21:20:00
// Description: Upgrade Token Monitor parser to v1.2.0 — add read-only SQLite
// conversations/<id>.db primary telemetry & zero-dependency Protobuf wire decoder
// (eliminating Auto fallbacks, capturing step_type=23 compaction tokens, and never
// adding field_1 model enum IDs to token counts), tier-free normalizeModelId(),
// fast conversation_summaries.db metadata lookup, totalTokens in byModel, and
// usage_ledger.json schema version 2 auto-migration.
// ============================================================================

import { execFile } from 'node:child_process';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Import mkdirSync, renameSync, unlinkSync, and writeFileSync for
// the shared Windows-safe atomic file writer (writeAtomicFileSafe / writeAtomicJsonSafe).
// ============================================================================
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const ID_RE = /^[0-9a-f-]{8,}$/i;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MODEL_CHANGE_RE =
  /<USER_SETTINGS_CHANGE>[\s\S]*?Model Selection`? from .+? to ([^\n<]+?)(?:\.(?=\s|$|<)|\s*<\/USER_SETTINGS_CHANGE>|\n|$)/g;
const CREATED_AT_HEADER_RE = /^Created At:\s*([^\r\n]+)/m;
const COMPLETED_AT_HEADER_RE = /^Completed At:\s*([^\r\n]+)/gm;

const TIER_SUFFIX_RE = /-(?:xhigh|high|medium|med|low|thinking|nothinking)$/i;
const AUTO_UNKNOWN_RE = /^(?:auto|unknown|none)$/i;
const UTF8_DECODER = new TextDecoder('utf-8');

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Bump LEDGER_SCHEMA_VERSION to 3 so duplicate-counted v1.2.0
// forked-conversation ledgers automatically rebuild cleanly on startup.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Bump LEDGER_SCHEMA_VERSION to 4 so v3 ledgers rebuild with
// gemini-pro-default mapped to canonical gemini-3.1-pro.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:30:45
// Description: Bump LEDGER_SCHEMA_VERSION to 5 so v4 ledgers rebuild cleanly
// separating 11/16+ Gemini 4 Hydrogen (Orchestrator) from 11/13-14 Gemini Flash.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Bump LEDGER_SCHEMA_VERSION to 6 so existing v5 ledgers rebuild
// cleanly once with per-raw-model daily buckets (byRawModel) and activeRawModel.
// ============================================================================
export const LEDGER_SCHEMA_VERSION = 6;
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:30:45
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

const SEEDED_ENUM_ENTRIES = [
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Map model enum 1016 from legacy gemini-pro-default to gemini-3.1-pro.
// ============================================================================
  [1016, 'gemini-3.1-pro'],
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================
  [1026, 'claude-opus-4-6'],
  [1318, 'gemini-3.8-flash-n'],
  [1319, 'gemini-3.8-flash'],
  [1322, 'gemini-3.8-flash-tiered'],
  [1402, 'claude-opus-5-5'],
  [1417, 'gemini-4-argon'],
  [1419, 'gemini-4-argon'],
  [1427, 'gemini-4-carbon'],
  [1525, 'gemini-4-hydrogen'],
  [1528, 'gemini-4-hydrogen'],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:30:55
// Description: Seed additional live-observed Gemini 4 Neon enum IDs (1532, 1533)
// and keep immutable SEEDED_ENUM_MAP for rawDbModel enum fallback lookups.
// ============================================================================
  [1532, 'gemini-4-neon'],
  [1533, 'gemini-4-neon'],
// ============================================================================
// [MODIFIED END] 2026-11-19 13:30:55
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Seed observed Gemini 4 Neon and Orchestrator (Neon) enum IDs (1535, 1537).
// ============================================================================
  [1535, 'gemini-4-neon'],
  [1537, 'gemini-pro-orchestrator-neon'],
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
  [1667, 'gemini-pro-orchestrator'],
  [1669, 'gemini-flash-worker-agy'],
];
const SEEDED_ENUM_IDS = new Set(SEEDED_ENUM_ENTRIES.map(([k]) => k));
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:30:55
// Description: Preserve immutable seeded enum -> raw slug map before display overrides.
// ============================================================================
const SEEDED_ENUM_MAP = new Map(SEEDED_ENUM_ENTRIES);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:30:55
// ============================================================================
export const MODEL_ENUM_MAP = new Map(SEEDED_ENUM_ENTRIES);

export const MODEL_PRICING_CATALOG = Object.freeze([
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Order Gemini series strictly top-to-bottom by performance tier
// (4 Carbon > 4 Argon > 4 Hydrogen > 3.1 Pro > 3.8 Flash) and decouple
// catch-all fallback regexes into fallbackPattern so specific models never shadow.
// ============================================================================
  Object.freeze({
    id: 'gemini-4-carbon',
    group: 'Gemini 系列',
    label: 'Gemini 4 Carbon',
    hint: '含 High/Med/Low · Orchestrator (Carbon)',
    inputPer1M: 2.0,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:20:16
// Description: Update gemini-4-carbon built-in offline rates to Google
// Standard Paid Tier (95% cache discount, 1M flat unified context).
// ============================================================================
    cachedPer1M: 0.1,
    outputPer1M: 10.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
// ============================================================================
// [MODIFIED END] 2026-11-19 14:20:16
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Tighten gemini-4-carbon pattern so gemini-pro-orchestrator-neon
// is never hijacked into Carbon, and add first-class gemini-4-neon profile.
// ============================================================================
    pattern: /gemini[\s-]*4[\s-]*carbon|orchestrator[\s(-]*carbon|gemini-pro-orchestrator(?=$|[\s)]|-carbon(?=$|[-_\s]))/i,
    fallbackPattern: /^gemini[\s-]*pro$|gemini[\s-]*[23](?!\.?1[\s_-]*pro).*pro|^pro$/i,
  }),
  Object.freeze({
    id: 'gemini-4-neon',
    group: 'Gemini 系列',
    label: 'Gemini 4 Neon',
    hint: '含 High/Med/Low · Orchestrator (Neon)',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:20:16
// Description: Update gemini-4-neon built-in offline rates to Google Standard
// Paid Tier ($3.0 / $0.15 / $15.0, 95% cache discount, 1M flat unified context).
// ============================================================================
    inputPer1M: 3.0,
    cachedPer1M: 0.15,
    outputPer1M: 15.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
// ============================================================================
// [MODIFIED END] 2026-11-19 14:20:16
// ============================================================================
    pattern: /gemini[\s_-]*4[\s_-]*neon|orchestrator[\s(-]*neon|gemini-pro-orchestrator-neon/i,
  }),
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
  Object.freeze({
    id: 'gemini-4-argon',
    group: 'Gemini 系列',
    label: 'Gemini 4 Argon',
    hint: '含 High/Med/Low · Orchestrator (Argon)',
    inputPer1M: 2.0,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:20:16
// Description: Update gemini-4-argon built-in offline rates to Google
// Standard Paid Tier (95% cache discount, 1M flat unified context).
// ============================================================================
    cachedPer1M: 0.1,
    outputPer1M: 10.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
// ============================================================================
// [MODIFIED END] 2026-11-19 14:20:16
// ============================================================================
    pattern: /gemini[\s-]*4[\s-]*argon|orchestrator[\s(-]*argon|gemini-pro-orchestrator-argon/i,
  }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:00
// Description: Move gemini-flash-worker pattern from gemini-3-8-flash into
// gemini-4-hydrogen with Orchestrator Worker hint.
// ============================================================================
  Object.freeze({
    id: 'gemini-4-hydrogen',
    group: 'Gemini 系列',
    label: 'Gemini 4 Hydrogen',
    hint: '含 XHigh/High/Med/Low · Orchestrator Worker',
    inputPer1M: 1.5,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:20:16
// Description: Update gemini-4-hydrogen built-in offline rates to Google
// Standard Paid Tier (95% cache discount, 1M flat unified context).
// ============================================================================
    cachedPer1M: 0.075,
    outputPer1M: 7.5,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
// ============================================================================
// [MODIFIED END] 2026-11-19 14:20:16
// ============================================================================
    pattern: /gemini[\s_-]*4[\s_-]*hydrogen|gemini-flash-worker/i,
  }),
  Object.freeze({
    id: 'gemini-3.1-pro',
    group: 'Gemini 系列',
    label: 'Gemini 3.1 Pro',
    hint: '含 Pro Preview / Default · ≤200k 标准档',
    inputPer1M: 2.0,
    cachedPer1M: 0.2,
    outputPer1M: 12.0,
    longContextTier: true,
    longInputMultiplier: 2.0,
    longOutputMultiplier: 1.5,
    pattern: /gemini[\s_-]*3\.?1[\s_-]*pro|gemini-pro-default/i,
  }),
  Object.freeze({
    id: 'gemini-3-8-flash',
    group: 'Gemini 系列',
    label: 'Gemini 3.8 Flash',
    hint: '含 High/Med/Low · 子代理 Flash',
    inputPer1M: 0.75,
    cachedPer1M: 0.075,
    outputPer1M: 3.75,
    longContextTier: false,
    longInputMultiplier: 2.0,
    longOutputMultiplier: 1.5,
    pattern: /gemini[\s_-]*3\.?8[\s_-]*flash/i,
    fallbackPattern: /gemini.*flash|^flash(?:_lite)?$/i,
  }),
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================
  Object.freeze({
    id: 'claude-opus-5-5',
    group: 'Claude 系列',
    label: 'Claude Opus 5.5',
    hint: '含 5.5 / 4.6 · High/Med/Low',
    inputPer1M: 4.0,
    cachedPer1M: 0.2,
    outputPer1M: 20.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
    pattern: /claude[\s-]*opus/i,
  }),
  Object.freeze({
    id: 'claude-sonnet-5-5',
    group: 'Claude 系列',
    label: 'Claude Sonnet 5.5',
    hint: '含 High/Med/Low',
    inputPer1M: 2.0,
    cachedPer1M: 0.1,
    outputPer1M: 10.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
    pattern: /claude[\s-]*(?:sonnet|haiku)/i,
  }),
  Object.freeze({
    id: 'gpt-oss-120b',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Rename model group label from 其他在役模型 to 其他现役模型.
// ============================================================================
    group: '其他现役模型',
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
    label: 'GPT-OSS 120B',
    hint: 'Medium',
    inputPer1M: 0.15,
    cachedPer1M: 0.075,
    outputPer1M: 0.6,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
    pattern: /gpt[\s-]*oss/i,
  }),
  Object.freeze({
    id: 'auto',
    group: '默认回退',
    label: 'Auto (默认)',
    hint: '未显式指定模型时使用',
    inputPer1M: 2.0,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:20:16
// Description: Update auto fallback profile rates to match Gemini 4 Standard
// Paid Tier (95% cache discount, 1M flat unified context).
// ============================================================================
    cachedPer1M: 0.1,
    outputPer1M: 10.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
// ============================================================================
// [MODIFIED END] 2026-11-19 14:20:16
// ============================================================================
    pattern: null,
  }),
]);

const PROFILE_BY_ID = new Map(MODEL_PRICING_CATALOG.map((p) => [p.id, p]));

export const SUBSCRIPTION_CATALOG = Object.freeze({
  auto: Object.freeze({ id: 'auto', label: '自动识别', monthlyUsd: null }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Add Jio AI Pro ($0/mo carrier plan) alongside Free for v0.2.5.
// ============================================================================
  jio_pro: Object.freeze({ id: 'jio_pro', label: 'Jio AI Pro', monthlyUsd: 0 }),
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
  free: Object.freeze({ id: 'free', label: 'Free', monthlyUsd: 0 }),
  pro: Object.freeze({ id: 'pro', label: 'Google AI Pro', monthlyUsd: 19.99 }),
  ultra_5x: Object.freeze({ id: 'ultra_5x', label: 'Google AI Ultra 5x', monthlyUsd: 99.99 }),
  ultra_20x: Object.freeze({ id: 'ultra_20x', label: 'Google AI Ultra 20x', monthlyUsd: 199.99 }),
  custom: Object.freeze({ id: 'custom', label: '自定义月费', monthlyUsd: null }),
});

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Export VALID_TOKEN_UNITS and VALID_LANGUAGES, upgrade DEFAULT_PREFS
// to 400k/500k context limits with tokenUnit/language defaults, and normalize
// gemini-pro-default / Gemini 3.1 Pro variants to canonical gemini-3.1-pro.
// ============================================================================
export const VALID_TOKEN_UNITS = Object.freeze(['auto', 'wan_yi', 'exact', 'm']);
export const VALID_LANGUAGES = Object.freeze(['zh', 'en']);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:43:00
// Description: Add VALID_CNY_RATE_MODES and cnyRateMode: 'auto' default for
// daily automatic USD-to-CNY exchange rate synchronization.
// ============================================================================
export const VALID_CNY_RATE_MODES = Object.freeze(['auto', 'manual']);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Export VALID_MODEL_SORT_KEYS and VALID_MODEL_SORT_DIRS for v0.2.5
// model breakdown sorting preferences.
// ============================================================================
export const VALID_MODEL_SORT_KEYS = Object.freeze(['cost', 'total']);
export const VALID_MODEL_SORT_DIRS = Object.freeze(['desc', 'asc']);
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 21:53:10
// Description: Export COLLAPSIBLE_CARD_IDS allowlist covering all 13 cards
// across Tab 1 and Tab 2 for v0.5.3 collapsible card persistence.
// ============================================================================
export const COLLAPSIBLE_CARD_IDS = Object.freeze([
  'pixel-office',
  'speed',
  'cost',
  'context',
  'cache',
  'children-models',
  'side-questions',
  'global-roi',
  'global-summary',
  'global-trend',
  'global-models',
  'global-projects',
  'global-recent',
]);
// ============================================================================
// [MODIFIED END] 2026-11-23 21:53:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Export VALID_MODEL_NAME_MODES ('canonical' | 'routed') for v0.5.4
// configurable model name display mode preference.
// ============================================================================
export const VALID_MODEL_NAME_MODES = Object.freeze(['canonical', 'routed']);
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================

export const DEFAULT_PREFS = Object.freeze({
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:10
// Description: Update default context limits to 409600 / 512000.
// ============================================================================
  softContextLimit: 409600,
  hardContextLimit: 512000,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:10
// ============================================================================
  currency: 'USD',
  cnyRate: 7.25,
  cnyRateMode: 'auto',
  tokenUnit: 'auto',
  language: 'zh',
  subscriptionPlan: 'auto',
  customSubscriptionMonthlyUsd: 99.99,
  longContextThreshold: 200000,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:55:00
// Description: Add skippedReleaseTag default preference for v0.2.4 release hot-update prompt skipping.
// ============================================================================
  skippedReleaseTag: '',
// ============================================================================
// [MODIFIED END] 2026-11-17 18:55:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Add modelSortBy and modelSortDir defaults to DEFAULT_PREFS.
// ============================================================================
  modelSortBy: 'cost',
  modelSortDir: 'desc',
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Add pixelOfficeCollapsed default preference to DEFAULT_PREFS.
// ============================================================================
  pixelOfficeCollapsed: false,
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 21:53:10
// Description: Add collapsedCards default map to DEFAULT_PREFS while keeping
// pixelOfficeCollapsed for backward compatibility (v0.5.3).
// ============================================================================
  collapsedCards: Object.freeze({}),
// ============================================================================
// [MODIFIED END] 2026-11-23 21:53:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Add modelNameMode default ('canonical') to DEFAULT_PREFS for v0.5.4.
// ============================================================================
  modelNameMode: 'canonical',
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
  modelOverrides: Object.freeze({}),
});
// ============================================================================
// [MODIFIED END] 2026-11-17 15:43:00
// ============================================================================

const transcriptCache = new Map(); // cacheId -> { key, parsed }
const MAX_TRANSCRIPT_CACHE = 128;
const summariesDbCache = new Map(); // sumDbPath -> { key, bundle }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Add bounded caches for combined multi-dir summaries bundles,
// mtime-validated roster files, and short-TTL brain-dir swarm listings (A1/A2).
// ============================================================================
const combinedSummariesBundleCache = new Map(); // combinedKey -> frozen bundle
const MAX_COMBINED_SUMMARIES_CACHE = 16;
const rosterFileCache = new Map(); // membersPath -> { key, roster }
const MAX_ROSTER_FILE_CACHE = 512;
const swarmsListCache = new Map(); // brainDir -> { brainMtimeMs, fetchedAtMs, entries }
const SWARM_LIST_CACHE_TTL_MS = 2000;
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Add module-level subagentDescCache for O(1) parent-subagent
// descriptor reuse across chunked ledger sync batches.
// ============================================================================
const subagentDescCache = new Map(); // parentConvId -> { cacheKey, descriptors }
const MAX_SUBAGENT_DESC_CACHE = 2048;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Add bounded transcriptInvokeScanCache keyed by transcript stat
// mtime:size to skip unchanged non-parent transcripts during findSubagentParentHint.
// ============================================================================
const transcriptInvokeScanCache = new Map(); // transcriptPath -> { tKey, hasInvokeSubagent, uuidsLower }

function setTranscriptInvokeScanCache(transcriptPath, entry) {
  if (transcriptInvokeScanCache.has(transcriptPath)) {
    transcriptInvokeScanCache.delete(transcriptPath);
  } else if (transcriptInvokeScanCache.size >= MAX_SUBAGENT_DESC_CACHE) {
    const oldestKey = transcriptInvokeScanCache.keys().next().value;
    if (oldestKey !== undefined) transcriptInvokeScanCache.delete(oldestKey);
  }
  transcriptInvokeScanCache.set(transcriptPath, entry);
}
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================

function setSubagentDescCache(parentConvId, entry) {
  if (subagentDescCache.has(parentConvId)) {
    subagentDescCache.delete(parentConvId);
  } else if (subagentDescCache.size >= MAX_SUBAGENT_DESC_CACHE) {
    const oldestKey = subagentDescCache.keys().next().value;
    if (oldestKey !== undefined) subagentDescCache.delete(oldestKey);
  }
  subagentDescCache.set(parentConvId, entry);
}
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:20
// Description: Extract normalizeExplicitDisplayName() and check fallbackDisplay
// first for gemini-flash-worker slugs before returning tier-stripped slug.
// ============================================================================
function normalizeExplicitDisplayName(candidate) {
  if (!candidate || AUTO_UNKNOWN_RE.test(candidate)) return '';
  if (
    candidate === 'gemini-pro-default' ||
    /^gemini[\s_-]*pro[\s_-]*default$/i.test(candidate) ||
    /gemini[\s_-]*3\.?1[\s_-]*pro/i.test(candidate)
  ) {
    return 'gemini-3.1-pro';
  }
  if (/orchestrator\s*\(\s*argon\s*\)/i.test(candidate)) return 'gemini-pro-orchestrator-argon';
  if (/orchestrator\s*\(\s*carbon\s*\)/i.test(candidate)) return 'gemini-pro-orchestrator';
  if (/orchestrator\s*\(\s*neon\s*\)/i.test(candidate)) return 'gemini-pro-orchestrator-neon';
  if (/gemini[\s-]*4[\s-]*argon/i.test(candidate)) return 'gemini-4-argon';
  if (/gemini[\s-]*4[\s-]*carbon/i.test(candidate)) return 'gemini-4-carbon';
  if (/gemini[\s-]*4[\s-]*neon/i.test(candidate)) return 'gemini-4-neon';
  if (/gemini[\s-]*4[\s-]*hydrogen/i.test(candidate)) return 'gemini-4-hydrogen';
  if (
    /gemini[\s-]*3\.?8[\s-]*flash|^gemini\s+flash(?:\s*\((?:x?high|med(?:ium)?|low|thinking|nothinking)\))?$|^flash(?:_lite)?$/i.test(
      candidate,
    )
  ) {
    return 'gemini-3.8-flash';
  }
  if (/^pro$/i.test(candidate)) return 'gemini-pro';
  if (/claude[\s-]*opus[\s-]*4[\s.-]*6/i.test(candidate)) return 'claude-opus-4-6';
  if (/claude[\s-]*opus/i.test(candidate)) return 'claude-opus-5-5';
  if (/claude[\s-]*sonnet[\s-]*5[\s.-]*5|claude[\s-]*sonnet|claude[\s-]*haiku/i.test(candidate)) {
    return 'claude-sonnet-5-5';
  }
  if (/gpt[\s-]*oss/i.test(candidate)) return 'gpt-oss-120b';
  return '';
}
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:20
// ============================================================================

/**
 * Normalizes backend model slugs and UI display names into canonical tier-free raw model IDs.
 * Preserves backend variant/worker slugs (e.g. gemini-3.8-flash-n, gemini-flash-worker-agy,
 * gemini-pro-orchestrator, gemini-4-argon-trial) while stripping thinking/effort tiers.
 */
export function normalizeModelId(rawModel, fallbackDisplay = '') {
  const raw = typeof rawModel === 'string' ? rawModel.trim() : '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:20
// Description: Check fallbackDisplay explicit display rules first when raw
// or stripped slug matches gemini-flash-worker.
// ============================================================================
  const fb = typeof fallbackDisplay === 'string' ? fallbackDisplay.trim() : '';
  const isFlashWorkerRaw = /^gemini[\s_-]*flash[\s_-]*worker/i.test(raw);
  if (raw && !/\s/.test(raw) && raw.includes('-') && !AUTO_UNKNOWN_RE.test(raw)) {
    let slug = raw.toLowerCase();
    while (TIER_SUFFIX_RE.test(slug)) {
      slug = slug.replace(TIER_SUFFIX_RE, '');
    }
    if (isFlashWorkerRaw || /^gemini[\s_-]*flash[\s_-]*worker/i.test(slug)) {
      if (fb && !AUTO_UNKNOWN_RE.test(fb)) {
        const explicit = normalizeExplicitDisplayName(fb);
        if (explicit) return explicit;
      }
      return slug || 'Auto';
    }
    if (
      slug === 'gemini-pro-default' ||
      /^gemini[\s_-]*pro[\s_-]*default$/i.test(slug) ||
      /gemini[\s_-]*3\.?1[\s_-]*pro/i.test(slug)
    ) {
      return 'gemini-3.1-pro';
    }
    return slug || 'Auto';
  }

  if (isFlashWorkerRaw) {
    if (fb && !AUTO_UNKNOWN_RE.test(fb)) {
      const explicit = normalizeExplicitDisplayName(fb);
      if (explicit) return explicit;
    }
    let slug = raw.toLowerCase().replace(/[\s_]+/g, '-');
    while (TIER_SUFFIX_RE.test(slug)) {
      slug = slug.replace(TIER_SUFFIX_RE, '');
    }
    return slug || 'Auto';
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:20
// ============================================================================

  const candidate = fb && !AUTO_UNKNOWN_RE.test(fb) ? fb : raw;
  if (!candidate || AUTO_UNKNOWN_RE.test(candidate)) {
    return 'Auto';
  }

  if (
    candidate === 'gemini-pro-default' ||
    /^gemini[\s_-]*pro[\s_-]*default$/i.test(candidate) ||
    /gemini[\s_-]*3\.?1[\s_-]*pro/i.test(candidate)
  ) {
    return 'gemini-3.1-pro';
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:20
// Description: Delegate explicit display-name matching to shared normalizeExplicitDisplayName().
// ============================================================================
  const explicitCandidate = normalizeExplicitDisplayName(candidate);
  if (explicitCandidate) return explicitCandidate;
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:20
// ============================================================================

  let cleaned = candidate
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s+(?:xhigh|high|medium|med|low|thinking)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  while (TIER_SUFFIX_RE.test(cleaned)) {
    cleaned = cleaned.replace(TIER_SUFFIX_RE, '');
  }

  if (!cleaned || AUTO_UNKNOWN_RE.test(cleaned)) return 'Auto';
  return cleaned;
}

/**
 * Validates that a conversation ID is safe to join into filesystem paths.
 */
export function isValidConversationId(convId) {
  return typeof convId === 'string' && ID_RE.test(convId);
}

/**
 * Clears internal parsed transcript and SQLite summary caches (useful for isolated tests).
 */
export function clearParserCache() {
  transcriptCache.clear();
  summariesDbCache.clear();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Clear subagentDescCache inside clearParserCache for test isolation.
// ============================================================================
  subagentDescCache.clear();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Clear transcriptInvokeScanCache inside clearParserCache for test isolation.
// ============================================================================
  transcriptInvokeScanCache.clear();
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Clear combinedSummariesBundleCache, rosterFileCache, and
// swarmsListCache inside clearParserCache() for deterministic test isolation.
// ============================================================================
  combinedSummariesBundleCache.clear();
  rosterFileCache.clear();
  swarmsListCache.clear();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Add shared Windows-safe atomic file/JSON writer with EPERM/EACCES/EBUSY
// fallback and guaranteed .tmp cleanup for state, ledger, and pricing cache writes (B1).
// ============================================================================
const WINDOWS_RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

export function writeAtomicFileSafe(targetPath, content, options = {}) {
  const {
    encoding = 'utf-8',
    tmpSuffix = `.${process.pid}.tmp`,
    fsOps = null,
  } = options || {};
  const mkdirFn = fsOps?.mkdirSync || mkdirSync;
  const writeFn = fsOps?.writeFileSync || writeFileSync;
  const renameFn = fsOps?.renameSync || renameSync;
  const existsFn = fsOps?.existsSync || existsSync;
  const unlinkFn = fsOps?.unlinkSync || unlinkSync;

  const dir = dirname(targetPath);
  mkdirFn(dir, { recursive: true });
  const tmpPath = `${targetPath}${tmpSuffix}`;
  try {
    writeFn(tmpPath, content, encoding);
    try {
      renameFn(tmpPath, targetPath);
      return { ok: true, usedFallback: false };
    } catch (renameErr) {
      try {
        if (existsFn(tmpPath)) unlinkFn(tmpPath);
      } catch {
        // Ignore temp cleanup failure.
      }
      if (renameErr && WINDOWS_RETRYABLE_RENAME_CODES.has(renameErr.code)) {
        writeFn(targetPath, content, encoding);
        return { ok: true, usedFallback: true, fallbackCode: renameErr.code };
      }
      throw renameErr;
    }
  } catch (err) {
    try {
      if (existsFn(tmpPath)) unlinkFn(tmpPath);
    } catch {
      // Ignore temp cleanup failure.
    }
    throw err;
  }
}

export function writeAtomicJsonSafe(targetPath, payload, options = {}) {
  const space = options?.pretty ? 2 : undefined;
  const serialized = JSON.stringify(payload, null, space);
  return writeAtomicFileSafe(targetPath, serialized, options);
}
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:28
// Description: Export syncWatchState() helper to synchronize watchedConvIds
// with active conversation IDs and prune stale watcherLastStat/watcherSeenSteps (A3).
// ============================================================================
export function syncWatchState(watchedSet, statMap, seenMap, nextIds) {
  const allowed = new Set();
  for (const id of nextIds || []) {
    if (isValidConversationId(id)) allowed.add(id);
  }
  for (const existing of [...watchedSet]) {
    if (!allowed.has(existing)) {
      watchedSet.delete(existing);
    }
  }
  for (const id of allowed) {
    watchedSet.add(id);
  }
  if (statMap && typeof statMap.keys === 'function') {
    for (const id of [...statMap.keys()]) {
      if (!watchedSet.has(id)) {
        statMap.delete(id);
      }
    }
  }
  if (seenMap && typeof seenMap.keys === 'function') {
    for (const id of [...seenMap.keys()]) {
      if (!watchedSet.has(id)) {
        seenMap.delete(id);
      }
    }
  }
  return watchedSet;
}
// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:28
// ============================================================================

function safeReaddir(dirPath) {
  try {
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

function statOf(filePath) {
  if (!filePath) return { mtimeMs: 0, size: -1 };
  try {
    const s = statSync(filePath);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return { mtimeMs: 0, size: -1 };
  }
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Enforce [2000-01-01, 2100-01-01] timestamp bounds and add
// safeIsoString() so zero/corrupt timestamps cannot trigger RangeError.
// ============================================================================
const MIN_VALID_TS_MS = 946684800000; // 2000-01-01T00:00:00Z
const MAX_VALID_TS_MS = 4102444800000; // 2100-01-01T00:00:00Z

function safeIsoString(ms) {
  return Number.isFinite(ms) && ms >= MIN_VALID_TS_MS && ms <= MAX_VALID_TS_MS
    ? new Date(ms).toISOString()
    : '';
}

function parseTimestampMs(ts) {
  if (typeof ts !== 'string' || !ts.trim()) return null;
  const ms = Date.parse(ts.trim());
  return Number.isFinite(ms) && ms >= MIN_VALID_TS_MS && ms <= MAX_VALID_TS_MS ? ms : null;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

export function formatLocalDate(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function unquote(v) {
  if (typeof v !== 'string') return v == null ? '' : String(v);
  const s = v.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    try {
      return String(JSON.parse(s));
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

function oneLine(str, maxLen = 88) {
  const clean = String(str || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1).trimEnd()}…` : clean;
}

function parseWorkspaceUri(uri) {
  if (typeof uri !== 'string' || !uri.trim()) return '';
  let decoded = uri.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw URI if malformed percent encoding.
  }
  decoded = decoded.replace(/^file:\/\/\/?/i, '').replace(/\/+$/, '');
  if (!decoded) return '';
  const base = basename(decoded);
  return base || decoded;
}

function parseWorkspaceUrisField(rawField) {
  if (typeof rawField !== 'string' || !rawField.trim()) return '';
  const trimmed = rawField.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && typeof arr[0] === 'string') {
        return parseWorkspaceUri(arr[0]);
      }
    } catch {
      return '';
    }
    return '';
  }
  return parseWorkspaceUri(trimmed);
}

/**
 * Produces a concise human-readable label for a tool call.
 */
export function describeToolCall(tc) {
  const name = tc?.name || '';
  if (!name) return 'tool';
  const args = tc.args && typeof tc.args === 'object' ? tc.args : {};
  const summary = unquote(args.toolSummary);
  if (summary) return oneLine(summary);
  const action = unquote(args.toolAction);
  if (action) return oneLine(action);
  const targetPath = unquote(
    args.Path || args.AbsolutePath || args.TargetFile || args.path || args.file || '',
  );
  if (targetPath) {
    const base = basename(targetPath);
    if (base) {
      const verbMap = {
        read_file: 'Read',
        write_file: 'Write',
        edit_file: 'Edit',
      };
      const verb = verbMap[name];
      return verb ? `${verb} ${base}` : `${name} ${base}`;
    }
  }
  return name;
}

/**
 * Discovers Antigravity appData directories containing `brain/` or `conversations/`.
 * If ANTIGRAVITY_EXECUTABLE_DATA_DIR is set, walks ancestors to find `sidecar_data`
 * and adds its parent as primary appData, then also scans `~/.gemini/<product>`.
 */
export function discoverAppDataDirs(options = {}) {
  if (Array.isArray(options.appDataDirs)) {
    return dedupeExistingBrainParents(options.appDataDirs);
  }
  const env = options.env || process.env;
  const home = options.homeDir || homedir();
  const candidates = [];

  const dataDir = env?.ANTIGRAVITY_EXECUTABLE_DATA_DIR;
  if (typeof dataDir === 'string' && dataDir.trim()) {
    let cur = resolve(dataDir);
    while (true) {
      if (basename(cur) === 'sidecar_data') {
        candidates.push(dirname(cur));
        break;
      }
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }

  const geminiRoot = join(home, '.gemini');
  for (const name of safeReaddir(geminiRoot).sort()) {
    candidates.push(join(geminiRoot, name));
  }

  return dedupeExistingBrainParents(candidates);
}

function dedupeExistingBrainParents(candidates) {
  const seen = new Set();
  const out = [];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const resolved = resolve(raw);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    if (existsSync(join(resolved, 'brain')) || existsSync(join(resolved, 'conversations'))) {
      seen.add(key);
      out.push(resolved);
    }
  }
  return out;
}

/**
 * Resolves SQLite DB, WAL, transcript, and swarm paths for a validated conversation ID.
 */
export function resolveConversationPaths(convId, appDataDirs) {
  if (!isValidConversationId(convId)) return null;
  let fallback = null;
  for (const appData of appDataDirs) {
    const dbPath = join(appData, 'conversations', `${convId}.db`);
    const walPath = `${dbPath}-wal`;
    const convDir = join(appData, 'brain', convId);
    const logsDir = join(convDir, '.system_generated', 'logs');
    const transcriptPath = join(logsDir, 'transcript.jsonl');
    const fullTranscriptPath = join(logsDir, 'transcript_full.jsonl');
    const swarmMembersPath = join(convDir, '.system_generated', 'swarm', 'members.json');
    const entry = {
      appData,
      convDir,
      dbPath,
      walPath,
      transcriptPath,
      fullTranscriptPath,
      swarmMembersPath,
    };
    if (existsSync(dbPath) || existsSync(transcriptPath)) {
      return entry;
    }
    if (!fallback && existsSync(convDir)) {
      fallback = entry;
    }
  }
  return fallback;
}

// ============================================================================
// Zero-dependency Protobuf Wire-Format Reader & Read-Only SQLite Parsers
// ============================================================================

function readProtoVarint(buf, offset, end = buf.length) {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < end) {
    const byte = buf[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: Number(result), next: pos };
    }
    shift += 7n;
    if (shift > 70n) return null;
  }
  return null;
}

function decodeProtoFields(buf, start = 0, end = buf.length) {
  const fields = [];
  let pos = start;
  while (pos < end) {
    const tagRes = readProtoVarint(buf, pos, end);
    if (!tagRes) break;
    pos = tagRes.next;
    const fieldNo = tagRes.value >>> 3;
    const wire = tagRes.value & 0x7;
    if (fieldNo === 0) break;

    if (wire === 0) {
      const valRes = readProtoVarint(buf, pos, end);
      if (!valRes) break;
      pos = valRes.next;
      fields.push({ fieldNo, wire, value: valRes.value });
    } else if (wire === 2) {
      const lenRes = readProtoVarint(buf, pos, end);
      if (!lenRes || lenRes.value < 0) break;
      pos = lenRes.next;
      const sliceEnd = pos + lenRes.value;
      if (sliceEnd > end) break;
      fields.push({ fieldNo, wire, bytes: buf.subarray(pos, sliceEnd) });
      pos = sliceEnd;
    } else if (wire === 1) {
      pos += 8;
      if (pos > end) break;
    } else if (wire === 5) {
      pos += 4;
      if (pos > end) break;
    } else {
      break;
    }
  }
  return fields;
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Clamp decoded protobuf timestamps to [MIN_VALID_TS_MS, MAX_VALID_TS_MS]
// to reject Go zero-time and unsigned-varint negative values.
// ============================================================================
function decodeProtoTimestampMs(bytes) {
  if (!bytes || bytes.length === 0) return null;
  let sec = 0;
  let nanos = 0;
  for (const f of decodeProtoFields(bytes)) {
    if (f.wire !== 0) continue;
    if (f.fieldNo === 1) sec = f.value;
    else if (f.fieldNo === 2) nanos = f.value;
  }
  if (!Number.isFinite(sec) || sec <= 0) return null;
  const ms = sec * 1000 + Math.round((Number.isFinite(nanos) ? nanos : 0) / 1e6);
  return Number.isFinite(ms) && ms >= MIN_VALID_TS_MS && ms <= MAX_VALID_TS_MS ? ms : null;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

function decodeProtoDurationSec(bytes) {
  if (!bytes || bytes.length === 0) return 0;
  let sec = 0;
  let nanos = 0;
  for (const f of decodeProtoFields(bytes)) {
    if (f.wire !== 0) continue;
    if (f.fieldNo === 1) sec = f.value;
    else if (f.fieldNo === 2) nanos = f.value;
  }
  return (Number.isFinite(sec) ? sec : 0) + (Number.isFinite(nanos) ? nanos : 0) / 1e9;
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Decode globally unique botId (TokenUsage field 7) and step provenance
// originCascadeId (steps.metadata field 20.4 & gen_metadata field 1.20 cascade_id)
// to detect cloned parent steps in forked conversations.
// ============================================================================
/**
 * Decodes TokenUsage protobuf message.
 * CRITICAL: field 1 is modelEnumId and MUST NEVER be added to token counts!
 * Field 7 (wire type 2) is botId (globally unique per LLM API call).
 */
function decodeProtoTokenUsage(bytes) {
  if (!bytes || bytes.length === 0) return null;
  let modelEnumId = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let botId = '';
  for (const f of decodeProtoFields(bytes)) {
    if (f.wire === 0) {
      if (f.fieldNo === 1) modelEnumId = f.value;
      else if (f.fieldNo === 2) inputTokens = f.value;
      else if (f.fieldNo === 3) outputTokens = f.value;
      else if (f.fieldNo === 5) cacheReadTokens = f.value;
    } else if (f.wire === 2 && f.fieldNo === 7) {
      botId = UTF8_DECODER.decode(f.bytes).trim();
    }
  }
  return {
    modelEnumId,
    inputTokens: Math.max(0, Number(inputTokens) || 0),
    outputTokens: Math.max(0, Number(outputTokens) || 0),
    cacheReadTokens: Math.max(0, Number(cacheReadTokens) || 0),
    botId,
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

function mapDbStepStatus(statusInt) {
  if (statusInt === 3) return 'DONE';
  if (statusInt === 6) return 'RUNNING';
  if (statusInt === 7) return 'ERROR';
  return String(statusInt || '');
}

/**
 * Reads `<appData>/conversations/<convId>.db` in strict `readOnly: true` mode.
 * Returns null on SQLITE_BUSY / corrupt / open failure so callers fallback gracefully.
 */
export function parseConversationDb(convId, dbPath, walPath = '') {
  if (!isValidConversationId(convId) || !dbPath) return null;
  const dbStat = statOf(dbPath);
  if (dbStat.size < 0) return null;
  const walStat = walPath ? statOf(walPath) : { mtimeMs: 0, size: -1 };
  const dbMtimeMs = Math.max(dbStat.mtimeMs, walStat.mtimeMs);

  let db = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true, timeout: 2500 });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Extract botId and originCascadeId from gen_metadata and steps.metadata,
// marking steps cloned from ancestor conversations with isClonedFromParent = true.
// ============================================================================
    const convIdLower = convId.toLowerCase();
    const convEnumMap = new Map(MODEL_ENUM_MAP);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:50
// Description: Track raw backend enum slugs separately from display-overridden
// convEnumMap so genEntry.rawDbModel preserves raw model slugs.
// ============================================================================
    const convRawEnumMap = new Map(SEEDED_ENUM_MAP);
    const resolveRawEnumSlug = (enumId) =>
      enumId !== null
        ? convRawEnumMap.get(enumId) || SEEDED_ENUM_MAP.get(enumId) || convEnumMap.get(enumId) || ''
        : '';
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:50
// ============================================================================
    const genByIdx = new Map();
    const stepIdxToGen = new Map();

    const genRows = db
      .prepare('SELECT idx, data FROM gen_metadata WHERE data IS NOT NULL ORDER BY idx ASC')
      .all();

    for (const row of genRows) {
      if (!row?.data || row.data.length === 0) continue;
      const topFields = decodeProtoFields(row.data);
      const stepIndices = [];
      let modelEnumId = null;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadTokens = 0;
      let botId = '';
      let originCascadeId = '';
      let ttftSec = 0;
      let streamSec = 0;
      let rawModelId = '';
      let displayModel = '';

      for (const tf of topFields) {
        if (tf.fieldNo === 2 && tf.wire === 2) {
          let p = 0;
          while (p < tf.bytes.length) {
            const vr = readProtoVarint(tf.bytes, p, tf.bytes.length);
            if (!vr) break;
            stepIndices.push(vr.value);
            p = vr.next;
          }
        } else if (tf.fieldNo === 2 && tf.wire === 0) {
          stepIndices.push(tf.value);
        } else if (tf.fieldNo === 1 && tf.wire === 2) {
          for (const inf of decodeProtoFields(tf.bytes)) {
            if (inf.fieldNo === 4 && inf.wire === 2) {
              const usage = decodeProtoTokenUsage(inf.bytes);
              if (usage) {
                modelEnumId = usage.modelEnumId;
                inputTokens = usage.inputTokens;
                outputTokens = usage.outputTokens;
                cacheReadTokens = usage.cacheReadTokens;
                if (usage.botId) botId = usage.botId;
              }
            } else if (inf.fieldNo === 11 && inf.wire === 2) {
              ttftSec = decodeProtoDurationSec(inf.bytes);
            } else if (inf.fieldNo === 12 && inf.wire === 2) {
              streamSec = decodeProtoDurationSec(inf.bytes);
            } else if (inf.fieldNo === 19 && inf.wire === 2) {
              rawModelId = UTF8_DECODER.decode(inf.bytes).trim();
            } else if (inf.fieldNo === 20 && inf.wire === 2) {
              let kvKey = '';
              let kvVal = '';
              for (const kv of decodeProtoFields(inf.bytes)) {
                if (kv.wire !== 2) continue;
                if (kv.fieldNo === 1) kvKey = UTF8_DECODER.decode(kv.bytes).trim();
                else if (kv.fieldNo === 2) kvVal = UTF8_DECODER.decode(kv.bytes).trim();
              }
              if (kvKey === 'cascade_id' && kvVal) {
                originCascadeId = kvVal;
              }
            } else if (inf.fieldNo === 21 && inf.wire === 2) {
              displayModel = UTF8_DECODER.decode(inf.bytes).trim();
            }
          }
        }
      }

      if (modelEnumId !== null && rawModelId) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:55
// Description: Record rawModelId before display override on convRawEnumMap and genEntry.rawDbModel.
// ============================================================================
        convRawEnumMap.set(modelEnumId, rawModelId);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:55
// ============================================================================
        const normFromRaw = normalizeModelId(rawModelId, displayModel);
        if (normFromRaw && normFromRaw !== 'Auto') {
          convEnumMap.set(modelEnumId, normFromRaw);
          if (!SEEDED_ENUM_IDS.has(modelEnumId)) {
            MODEL_ENUM_MAP.set(modelEnumId, normFromRaw);
          }
        }
      }

      const normalizedModel = normalizeModelId(
        rawModelId || (modelEnumId !== null ? convEnumMap.get(modelEnumId) : ''),
        displayModel,
      );
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:55
// Description: Preserve rawDbModel on genEntry before display override.
// ============================================================================
      const rawDbModel = rawModelId || resolveRawEnumSlug(modelEnumId);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:55
// ============================================================================

      const genEntry = {
        genIdx: Number(row.idx),
        stepIndices,
        modelEnumId,
        rawModelId,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:31:55
// Description: Attach rawDbModel field onto genEntry.
// ============================================================================
        rawDbModel,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:31:55
// ============================================================================
        displayModel,
        normalizedModel,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        botId,
        originCascadeId,
        ttftSec,
        streamSec,
        matched: false,
      };
      genByIdx.set(genEntry.genIdx, genEntry);
      for (const si of stepIndices) {
        stepIdxToGen.set(si, genEntry);
      }
    }

    const stepRows = db
      .prepare('SELECT idx, step_type, status, metadata FROM steps ORDER BY idx ASC')
      .all();

    const plannerByStepIdx = new Map();
    const compactionSteps = [];
    const rawSynthesized = [];
    const createdAtByStepIdx = new Map();
    const originCascadeByStepIdx = new Map();
    let lastSeenDbModel = '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:15
// Description: Track lastSeenRawDbModel for step fallback raw slug retention.
// ============================================================================
    let lastSeenRawDbModel = '';
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:15
// ============================================================================

    for (const row of stepRows) {
      const stepIndex = Number(row.idx);
      const stepType = Number(row.step_type);
      const rawStatus = Number(row.status);
      const statusStr = mapDbStepStatus(rawStatus);

      let createdAtMs = null;
      let firstTokenAtMs = null;
      let completedAtMs = null;
      let usage9 = null;
      let field20 = null;

      if (row.metadata && row.metadata.length > 0) {
        for (const mf of decodeProtoFields(row.metadata)) {
          if (mf.wire !== 2) continue;
          if (mf.fieldNo === 1) {
            createdAtMs = decodeProtoTimestampMs(mf.bytes);
          } else if (mf.fieldNo === 6) {
            firstTokenAtMs = decodeProtoTimestampMs(mf.bytes);
          } else if (mf.fieldNo === 7) {
            completedAtMs = decodeProtoTimestampMs(mf.bytes);
          } else if (mf.fieldNo === 9) {
            usage9 = decodeProtoTokenUsage(mf.bytes);
          } else if (mf.fieldNo === 20) {
            let sIdx = stepIndex;
            let gIdx = 0; // Proto3 omits field 3 when gen_idx === 0
            let origCid = '';
            for (const f20 of decodeProtoFields(mf.bytes)) {
              if (f20.wire === 0) {
                if (f20.fieldNo === 2) sIdx = f20.value;
                else if (f20.fieldNo === 3) gIdx = f20.value;
              } else if (f20.wire === 2 && f20.fieldNo === 4) {
                origCid = UTF8_DECODER.decode(f20.bytes).trim();
              }
            }
            field20 = { stepIdx: sIdx, genIdx: gIdx, originCascadeId: origCid };
            if (origCid) {
              originCascadeByStepIdx.set(stepIndex, origCid);
            }
          }
        }
      }

      if (createdAtMs !== null) {
        createdAtByStepIdx.set(stepIndex, createdAtMs);
      }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Format createdAtIso via safeIsoString() so out-of-range dates never throw.
// ============================================================================
      const createdAtIso = safeIsoString(createdAtMs);
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

      if (stepType === 15) {
        const genEntry =
          stepIdxToGen.get(stepIndex) ||
          (field20 !== null
            ? genByIdx.get(field20.genIdx)
            : !genByIdx.get(0)?.matched
              ? genByIdx.get(0)
              : null);
        if (genEntry) genEntry.matched = true;

        const u9Total = usage9
          ? usage9.inputTokens + usage9.cacheReadTokens + usage9.outputTokens
          : 0;
        const genTotal = genEntry
          ? genEntry.inputTokens + genEntry.cacheReadTokens + genEntry.outputTokens
          : 0;
        const inputTokens = u9Total > 0 ? usage9.inputTokens : genEntry?.inputTokens || 0;
        const cacheReadTokens = u9Total > 0 ? usage9.cacheReadTokens : genEntry?.cacheReadTokens || 0;
        const outputTokens = u9Total > 0 ? usage9.outputTokens : genEntry?.outputTokens || 0;
        const hasTokenTelemetry = Boolean(usage9 || genTotal > 0);

        const enumId = genEntry?.modelEnumId ?? usage9?.modelEnumId ?? null;
        const dbModel = normalizeModelId(
          genEntry?.rawModelId || (enumId !== null ? convEnumMap.get(enumId) : '') || lastSeenDbModel,
          genEntry?.displayModel || '',
        );
        if (dbModel && dbModel !== 'Auto') {
          lastSeenDbModel = dbModel;
        }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:20
// Description: Preserve rawDbModel on plannerStep before display override.
// ============================================================================
        const rawDbModel =
          genEntry?.rawDbModel ||
          genEntry?.rawModelId ||
          resolveRawEnumSlug(enumId) ||
          lastSeenRawDbModel;
        if (rawDbModel && !AUTO_UNKNOWN_RE.test(rawDbModel)) {
          lastSeenRawDbModel = rawDbModel;
        }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:20
// ============================================================================

        if (
          completedAtMs === null &&
          createdAtMs !== null &&
          genEntry &&
          genEntry.ttftSec + genEntry.streamSec > 0
        ) {
          completedAtMs = createdAtMs + Math.round((genEntry.ttftSec + genEntry.streamSec) * 1000);
        }

        const botId = usage9?.botId || genEntry?.botId || '';
        const originCascadeId = field20?.originCascadeId || genEntry?.originCascadeId || '';
        const isClonedFromParent = Boolean(
          originCascadeId && originCascadeId.toLowerCase() !== convIdLower,
        );

        const plannerStep = {
          step_index: stepIndex,
          type: 'PLANNER_RESPONSE',
          status: statusStr,
          created_at: createdAtIso,
          createdAtMs,
          firstTokenAtMs,
          completedAtMs,
          hasTokenTelemetry,
          input_tokens: inputTokens,
          cache_read_tokens: cacheReadTokens,
          output_tokens: outputTokens,
          dbModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:20
// Description: Attach rawDbModel to synthesized plannerStep.
// ============================================================================
          rawDbModel,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:20
// ============================================================================
          botId,
          originCascadeId,
          isClonedFromParent,
          tool_calls: [],
        };
        plannerByStepIdx.set(stepIndex, plannerStep);
        rawSynthesized.push({ rawType: 15, rawStatus, step: plannerStep });
        continue;
      }

      if (stepType === 23) {
        const inputTokens = usage9?.inputTokens || 0;
        const cacheReadTokens = usage9?.cacheReadTokens || 0;
        const outputTokens = usage9?.outputTokens || 0;
        if (inputTokens + cacheReadTokens + outputTokens > 0) {
          const enumId = usage9?.modelEnumId ?? null;
          const dbModel = normalizeModelId(
            (enumId !== null ? convEnumMap.get(enumId) : '') || lastSeenDbModel,
          );
          if (dbModel && dbModel !== 'Auto') {
            lastSeenDbModel = dbModel;
          }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:20
// Description: Preserve rawDbModel on compaction step.
// ============================================================================
          const rawDbModel = resolveRawEnumSlug(enumId) || lastSeenRawDbModel;
          if (rawDbModel && !AUTO_UNKNOWN_RE.test(rawDbModel)) {
            lastSeenRawDbModel = rawDbModel;
          }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:20
// ============================================================================
          const botId = usage9?.botId || '';
          const originCascadeId = field20?.originCascadeId || '';
          const isClonedFromParent = Boolean(
            originCascadeId && originCascadeId.toLowerCase() !== convIdLower,
          );
          const compStep = {
            step_index: stepIndex,
            type: 'COMPACTION_SUMMARY',
            status: statusStr,
            created_at: createdAtIso,
            createdAtMs,
            firstTokenAtMs,
            completedAtMs,
            hasTokenTelemetry: true,
            input_tokens: inputTokens,
            cache_read_tokens: cacheReadTokens,
            output_tokens: outputTokens,
            dbModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:20
// Description: Attach rawDbModel to synthesized compStep.
// ============================================================================
            rawDbModel,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:20
// ============================================================================
            botId,
            originCascadeId,
            isClonedFromParent,
          };
          compactionSteps.push(compStep);
          rawSynthesized.push({ rawType: 23, rawStatus, step: compStep });
        }
        continue;
      }

      if (stepType === 14) {
        rawSynthesized.push({
          rawType: 14,
          rawStatus,
          step: {
            step_index: stepIndex,
            type: 'USER_INPUT',
            status: statusStr,
            created_at: createdAtIso,
            createdAtMs,
            modelChange: null,
          },
        });
        continue;
      }

      if (stepType === 132) {
        rawSynthesized.push({
          rawType: 132,
          rawStatus,
          step: {
            step_index: stepIndex,
            type: 'GENERIC',
            status: statusStr,
            created_at: createdAtIso,
            createdAtMs,
            genericCreatedAtMs: createdAtMs,
            genericCompletedAtMs: completedAtMs,
            uuids: [],
          },
        });
        continue;
      }

      if (stepType === 101) {
        rawSynthesized.push({
          rawType: 101,
          rawStatus,
          step: {
            step_index: stepIndex,
            type: 'SYSTEM_MESSAGE',
            status: statusStr,
            created_at: createdAtIso,
            createdAtMs,
            isWakeupMessage: false,
          },
        });
        continue;
      }
    }

    // Preserve any unmatched gen_metadata row with non-zero tokens so 0 tokens are ever dropped.
    const orphanSteps = [];
    for (const genEntry of genByIdx.values()) {
      if (genEntry.matched) continue;
      const total = genEntry.inputTokens + genEntry.cacheReadTokens + genEntry.outputTokens;
      if (total <= 0) continue;

      let orphanCreatedAtMs = null;
      for (const si of genEntry.stepIndices) {
        if (createdAtByStepIdx.has(si)) {
          orphanCreatedAtMs = createdAtByStepIdx.get(si);
          break;
        }
      }
      if (orphanCreatedAtMs === null) {
        for (const [, ms] of createdAtByStepIdx) {
          orphanCreatedAtMs = ms;
        }
      }
      if (orphanCreatedAtMs === null) {
        orphanCreatedAtMs = dbMtimeMs;
      }

      let originCascadeId = genEntry.originCascadeId || '';
      if (!originCascadeId) {
        for (const si of genEntry.stepIndices) {
          if (originCascadeByStepIdx.has(si)) {
            originCascadeId = originCascadeByStepIdx.get(si);
            break;
          }
        }
      }
      const botId = genEntry.botId || '';
      const isClonedFromParent = Boolean(
        originCascadeId && originCascadeId.toLowerCase() !== convIdLower,
      );

      const dbModel =
        genEntry.normalizedModel && genEntry.normalizedModel !== 'Auto'
          ? genEntry.normalizedModel
          : normalizeModelId(lastSeenDbModel);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:30
// Description: Preserve rawDbModel on orphan compaction steps.
// ============================================================================
      const rawDbModel =
        genEntry.rawDbModel ||
        genEntry.rawModelId ||
        resolveRawEnumSlug(genEntry.modelEnumId) ||
        lastSeenRawDbModel;
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:30
// ============================================================================
      const syntheticIdx =
        genEntry.stepIndices.length > 0 ? genEntry.stepIndices[0] : -1000 - genEntry.genIdx;
      const orphanStep = {
        step_index: syntheticIdx,
        type: 'COMPACTION_SUMMARY',
        status: 'DONE',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Format orphanStep.created_at via safeIsoString() so zero/invalid dates never throw.
// ============================================================================
        created_at: safeIsoString(orphanCreatedAtMs),
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
        createdAtMs: orphanCreatedAtMs,
        firstTokenAtMs: null,
        completedAtMs: null,
        hasTokenTelemetry: true,
        input_tokens: genEntry.inputTokens,
        cache_read_tokens: genEntry.cacheReadTokens,
        output_tokens: genEntry.outputTokens,
        dbModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:30
// Description: Attach rawDbModel onto orphanStep.
// ============================================================================
        rawDbModel,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:30
// ============================================================================
        botId,
        originCascadeId,
        isClonedFromParent,
      };
      orphanSteps.push(orphanStep);
      compactionSteps.push(orphanStep);
    }
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

    // Build synthesized steps for DB-only conversations (handling active RUNNING tool calls cleanly).
    const synthesizedSteps = [];
    for (let i = 0; i < rawSynthesized.length; i++) {
      const item = rawSynthesized[i];
      if (item.rawType === 15) {
        const trailing132 = [];
        for (let j = i + 1; j < rawSynthesized.length; j++) {
          if (rawSynthesized[j].rawType === 132) trailing132.push(rawSynthesized[j]);
          else if (rawSynthesized[j].rawType === 15 || rawSynthesized[j].rawType === 14) break;
        }
        const hasRunningTool = trailing132.some((t) => t.rawStatus === 6);
        const clonedPlanner = hasRunningTool
          ? {
              ...item.step,
              tool_calls: trailing132.map((_, k) => ({ name: `tool_${k + 1}`, args: {} })),
            }
          : item.step;
        synthesizedSteps.push(clonedPlanner);
      } else if (item.rawType === 132 && item.rawStatus === 6) {
        // Running tool step is omitted from completed GENERIC count so RUNNING_TOOLS triggers.
        continue;
      } else {
        synthesizedSteps.push(item.step);
      }
    }
    for (const orphan of orphanSteps) {
      synthesizedSteps.push(orphan);
    }
    synthesizedSteps.sort((a, b) => a.step_index - b.step_index);

    return {
      dbMtimeMs,
      dbSize: dbStat.size,
      plannerByStepIdx,
      compactionSteps,
      synthesizedSteps,
      lastSeenDbModel,
    };
  } catch {
    return null;
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors on read-only handle.
      }
    }
  }
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Add bounds-checked parseRawSummarySideQuestions() protobuf wire
// reader and cached readConversationSummariesBundle() extracting Side Question
// parent links and official field 15.18 titles from conversation_summaries.db.
// ============================================================================
/**
 * Extracts Side Question conversation IDs (`field 15.17`) and official Antigravity
 * titles (`field 15.18`: `{ field 1: convId, field 2: title }`) from `raw_summary`
 * protobuf bytes using zero-dependency bounds-checked varint decoding.
 */
export function parseRawSummarySideQuestions(rawSummaryBuf) {
  const sideQuestionIds = [];
  const titlesById = new Map();
  if (!rawSummaryBuf) return { sideQuestionIds, titlesById };

  let bytes = null;
  if (rawSummaryBuf instanceof Uint8Array) {
    bytes = rawSummaryBuf;
  } else if (rawSummaryBuf instanceof ArrayBuffer) {
    bytes = new Uint8Array(rawSummaryBuf);
  } else if (ArrayBuffer.isView(rawSummaryBuf)) {
    bytes = new Uint8Array(
      rawSummaryBuf.buffer,
      rawSummaryBuf.byteOffset,
      rawSummaryBuf.byteLength,
    );
  }
  if (!bytes || bytes.length === 0) return { sideQuestionIds, titlesById };

  const canonicalByLower = new Map();
  const addId = (rawId) => {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!isValidConversationId(id)) return '';
    const lower = id.toLowerCase();
    const existing = canonicalByLower.get(lower);
    if (existing) return existing;
    canonicalByLower.set(lower, id);
    sideQuestionIds.push(id);
    return id;
  };

  try {
    for (const top of decodeProtoFields(bytes)) {
      if (top.fieldNo !== 15 || top.wire !== 2 || !top.bytes || top.bytes.length === 0) continue;
      for (const sf of decodeProtoFields(top.bytes)) {
        if (sf.wire !== 2 || !sf.bytes || sf.bytes.length === 0) continue;
        if (sf.fieldNo === 17) {
          addId(UTF8_DECODER.decode(sf.bytes));
        } else if (sf.fieldNo === 18) {
          let entryConvId = '';
          let entryTitle = '';
          for (const mf of decodeProtoFields(sf.bytes)) {
            if (mf.wire !== 2 || !mf.bytes || mf.bytes.length === 0) continue;
            if (mf.fieldNo === 1) {
              entryConvId = UTF8_DECODER.decode(mf.bytes).trim();
            } else if (mf.fieldNo === 2) {
              entryTitle = UTF8_DECODER.decode(mf.bytes);
            }
          }
          const validId = addId(entryConvId);
          if (validId) {
            const cleaned = oneLine(entryTitle, 96);
            if (cleaned) {
              titlesById.set(validId, cleaned);
            }
          }
        }
      }
    }
  } catch {
    // Ignore malformed protobuf payloads and return any valid fields decoded so far.
  }

  return { sideQuestionIds, titlesById };
}

/**
 * Reads `<appData>/conversation_summaries.db` in read-only mode (cached by `.db` + `.db-wal` stat),
 * returning `{ byConvId, sideQuestionsByParent, sideQuestionParentById }`.
 */
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Make cached conversation_summaries bundles read-only via
// freezeReadOnlyMap() and return cached single/multi-dir bundles directly on
// cache hit without O(N) per-call Map cloning (A2).
// ============================================================================
function freezeReadOnlyMap(map) {
  const throwImmutable = () => {
    throw new TypeError('Cached summaries map is read-only');
  };
  Object.defineProperties(map, {
    set: { value: throwImmutable, enumerable: false, configurable: false },
    delete: { value: throwImmutable, enumerable: false, configurable: false },
    clear: { value: throwImmutable, enumerable: false, configurable: false },
  });
  return Object.freeze(map);
}

const EMPTY_SUMMARIES_BUNDLE = Object.freeze({
  byConvId: freezeReadOnlyMap(new Map()),
  sideQuestionsByParent: freezeReadOnlyMap(new Map()),
  sideQuestionParentById: freezeReadOnlyMap(new Map()),
});

export function readConversationSummariesBundle(appDataDirs) {
  const activeEntries = [];

  for (const appData of appDataDirs || []) {
    const sumDbPath = join(appData, 'conversation_summaries.db');
    const sumWalPath = `${sumDbPath}-wal`;
    const dbStat = statOf(sumDbPath);
    if (dbStat.size < 0) continue;
    const walStat = statOf(sumWalPath);
    const statKey = `${dbStat.mtimeMs}:${dbStat.size}|${walStat.mtimeMs}:${walStat.size}`;

    let cached = summariesDbCache.get(sumDbPath);
    if (!cached || cached.key !== statKey || !cached.bundle) {
      let db = null;
      try {
        db = new DatabaseSync(sumDbPath, { readOnly: true, timeout: 2500 });
        const summaryQueries = [
          'SELECT conversation_id, title, preview, workspace_uris, agent_name, parent_conversation_id, raw_summary FROM conversation_summaries',
          'SELECT conversation_id, title, workspace_uris, agent_name, parent_conversation_id, raw_summary FROM conversation_summaries',
          'SELECT conversation_id, title, preview, workspace_uris, agent_name, parent_conversation_id FROM conversation_summaries',
          'SELECT conversation_id, title, workspace_uris, agent_name, parent_conversation_id FROM conversation_summaries',
        ];
        let rows = [];
        let summaryLoaded = false;
        for (const sql of summaryQueries) {
          try {
            rows = db.prepare(sql).all();
            summaryLoaded = true;
            break;
          } catch (err) {
            if (!/no such (?:column|table)/i.test(String(err?.message || ''))) {
              throw err;
            }
          }
        }
        if (!summaryLoaded) {
          try {
            const infoRows = db.prepare('PRAGMA table_info(conversation_summaries)').all();
            const allowedCols = [
              'conversation_id',
              'title',
              'preview',
              'workspace_uris',
              'agent_name',
              'parent_conversation_id',
              'raw_summary',
            ];
            const present = new Set(infoRows.map((c) => String(c?.name || '').toLowerCase()));
            const selected = allowedCols.filter((c) => present.has(c));
            if (selected.includes('conversation_id')) {
              rows = db.prepare(`SELECT ${selected.join(', ')} FROM conversation_summaries`).all();
            }
          } catch (err) {
            if (!/no such (?:column|table)/i.test(String(err?.message || ''))) {
              throw err;
            }
          }
        }

        let parentRows = [];
        try {
          parentRows = db
            .prepare('SELECT conversation_id, parent_id FROM conversation_parents')
            .all();
        } catch (err) {
          if (!/no such (?:column|table)/i.test(String(err?.message || ''))) {
            throw err;
          }
        }

        const byConvId = new Map();
        const dbParentMaps = new Map();
        const dbParentCanonical = new Map();
        const dbParentById = new Map();
        const dbSqLowerIndex = new Map();

        const registerDbSq = (parentId, sqId, officialTitle = '') => {
          if (!isValidConversationId(parentId) || !isValidConversationId(sqId)) return;
          const parentLower = parentId.toLowerCase();
          const sqLower = sqId.toLowerCase();
          if (parentLower === sqLower) return;

          const canonicalParent = dbParentCanonical.get(parentLower) || parentId;
          if (!dbParentCanonical.has(parentLower)) {
            dbParentCanonical.set(parentLower, canonicalParent);
          }

          const cleanTitle = typeof officialTitle === 'string' ? officialTitle.trim() : '';

          let childMap = dbParentMaps.get(canonicalParent);
          if (!childMap) {
            childMap = new Map();
            dbParentMaps.set(canonicalParent, childMap);
          }
          const prevChild = childMap.get(sqLower);
          if (!prevChild) {
            childMap.set(sqLower, { conversationId: sqId, title: cleanTitle });
          } else if (cleanTitle && !prevChild.title) {
            prevChild.title = cleanTitle;
          }

          const existingSqKey = dbSqLowerIndex.get(sqLower);
          if (!existingSqKey) {
            dbSqLowerIndex.set(sqLower, sqId);
            dbParentById.set(sqId, { parentId: canonicalParent, title: cleanTitle });
          } else {
            const prevRev = dbParentById.get(existingSqKey);
            if (prevRev && cleanTitle && !prevRev.title) {
              prevRev.title = cleanTitle;
            }
          }
        };

        for (const r of rows) {
          const cid = typeof r.conversation_id === 'string' ? r.conversation_id.trim() : '';
          if (!isValidConversationId(cid)) continue;
          dbParentCanonical.set(cid.toLowerCase(), cid);
          byConvId.set(
            cid,
            Object.freeze({
              title: typeof r.title === 'string' && r.title.trim() ? oneLine(r.title, 64) : '',
              preview:
                typeof r.preview === 'string' && r.preview.trim() ? oneLine(r.preview, 56) : '',
              workspace: parseWorkspaceUrisField(r.workspace_uris),
              agentName: typeof r.agent_name === 'string' ? r.agent_name.trim() : '',
              parentConversationId:
                typeof r.parent_conversation_id === 'string'
                  ? r.parent_conversation_id.trim()
                  : '',
            }),
          );

          if (r.raw_summary) {
            const rawSq = parseRawSummarySideQuestions(r.raw_summary);
            for (const sqId of rawSq.sideQuestionIds) {
              registerDbSq(cid, sqId, rawSq.titlesById.get(sqId) || '');
            }
          }
        }

        for (const pr of parentRows) {
          const sqId = typeof pr.conversation_id === 'string' ? pr.conversation_id.trim() : '';
          const parentId = typeof pr.parent_id === 'string' ? pr.parent_id.trim() : '';
          if (!isValidConversationId(sqId) || !isValidConversationId(parentId)) continue;
          registerDbSq(parentId, sqId, '');
        }

        const sideQuestionsByParent = new Map();
        for (const [parentId, childMap] of dbParentMaps) {
          sideQuestionsByParent.set(
            parentId,
            Object.freeze([...childMap.values()].map((item) => Object.freeze({ ...item }))),
          );
        }
        for (const [sqId, rev] of dbParentById) {
          dbParentById.set(sqId, Object.freeze({ ...rev }));
        }

        const bundle = Object.freeze({
          byConvId: freezeReadOnlyMap(byConvId),
          sideQuestionsByParent: freezeReadOnlyMap(sideQuestionsByParent),
          sideQuestionParentById: freezeReadOnlyMap(dbParentById),
        });
        cached = {
          path: sumDbPath,
          key: statKey,
          bundle,
        };
        summariesDbCache.set(sumDbPath, cached);
      } catch {
        // Keep previous cached bundle if SQLite is momentarily busy.
      } finally {
        if (db) {
          try {
            db.close();
          } catch {
            // Ignore close errors.
          }
        }
      }
    }

    if (cached?.bundle) {
      activeEntries.push(cached);
    }
  }

  if (activeEntries.length === 0) {
    return EMPTY_SUMMARIES_BUNDLE;
  }
  if (activeEntries.length === 1) {
    return activeEntries[0].bundle;
  }

  const combinedKey = activeEntries.map((entry) => `${entry.path}=${entry.key}`).join('||');
  const combinedHit = combinedSummariesBundleCache.get(combinedKey);
  if (combinedHit) {
    combinedSummariesBundleCache.delete(combinedKey);
    combinedSummariesBundleCache.set(combinedKey, combinedHit);
    return combinedHit;
  }

  const combinedByConvId = new Map();
  const combinedParentMaps = new Map(); // parentId -> Map<sqLower, { conversationId, title }>
  const combinedParentCanonical = new Map(); // parentLower -> parentId
  const combinedParentById = new Map(); // sqId -> { parentId, title }
  const combinedSqLowerIndex = new Map(); // sqLower -> sqId

  const mergeSideQuestionLink = (parentId, sqId, title = '') => {
    if (!isValidConversationId(parentId) || !isValidConversationId(sqId)) return;
    const parentLower = parentId.toLowerCase();
    const sqLower = sqId.toLowerCase();
    if (parentLower === sqLower) return;

    const canonicalParent = combinedParentCanonical.get(parentLower) || parentId;
    if (!combinedParentCanonical.has(parentLower)) {
      combinedParentCanonical.set(parentLower, canonicalParent);
    }

    const cleanTitle = typeof title === 'string' ? title.trim() : '';

    let childMap = combinedParentMaps.get(canonicalParent);
    if (!childMap) {
      childMap = new Map();
      combinedParentMaps.set(canonicalParent, childMap);
    }
    const prevChild = childMap.get(sqLower);
    if (!prevChild) {
      childMap.set(sqLower, { conversationId: sqId, title: cleanTitle });
    } else if (cleanTitle && !prevChild.title) {
      prevChild.title = cleanTitle;
    }

    const existingSqKey = combinedSqLowerIndex.get(sqLower);
    if (!existingSqKey) {
      combinedSqLowerIndex.set(sqLower, sqId);
      combinedParentById.set(sqId, { parentId: canonicalParent, title: cleanTitle });
    } else {
      const prevRev = combinedParentById.get(existingSqKey);
      if (prevRev && cleanTitle && !prevRev.title) {
        prevRev.title = cleanTitle;
      }
    }
  };

  for (const entry of activeEntries) {
    const b = entry.bundle;
    for (const [cid, meta] of b.byConvId) {
      if (!combinedByConvId.has(cid)) {
        combinedByConvId.set(cid, meta);
        combinedParentCanonical.set(cid.toLowerCase(), cid);
      }
    }
    for (const [parentId, list] of b.sideQuestionsByParent) {
      for (const item of list) {
        mergeSideQuestionLink(parentId, item.conversationId, item.title);
      }
    }
    for (const [sqId, meta] of b.sideQuestionParentById) {
      mergeSideQuestionLink(meta.parentId, sqId, meta.title);
    }
  }

  const combinedSideQuestionsByParent = new Map();
  for (const [parentId, childMap] of combinedParentMaps) {
    combinedSideQuestionsByParent.set(
      parentId,
      Object.freeze([...childMap.values()].map((item) => Object.freeze({ ...item }))),
    );
  }
  for (const [sqId, rev] of combinedParentById) {
    combinedParentById.set(sqId, Object.freeze({ ...rev }));
  }

  const frozenCombined = Object.freeze({
    byConvId: freezeReadOnlyMap(combinedByConvId),
    sideQuestionsByParent: freezeReadOnlyMap(combinedSideQuestionsByParent),
    sideQuestionParentById: freezeReadOnlyMap(combinedParentById),
  });
  if (combinedSummariesBundleCache.size >= MAX_COMBINED_SUMMARIES_CACHE) {
    const oldestKey = combinedSummariesBundleCache.keys().next().value;
    if (oldestKey !== undefined) combinedSummariesBundleCache.delete(oldestKey);
  }
  combinedSummariesBundleCache.set(combinedKey, frozenCombined);
  return frozenCombined;
}
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================

/**
 * Reads `<appData>/conversation_summaries.db` in read-only mode, cached by `.db` + `.db-wal` stat.
 */
function readConversationSummariesMap(appDataDirs) {
  return readConversationSummariesBundle(appDataDirs).byConvId;
}
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================

function extractModelChangesFromContent(content) {
  if (typeof content !== 'string' || !content.includes('<USER_SETTINGS_CHANGE>')) {
    return [];
  }
  const matches = [];
  MODEL_CHANGE_RE.lastIndex = 0;
  let m;
  while ((m = MODEL_CHANGE_RE.exec(content)) !== null) {
    const val = m[1]?.trim();
    if (val) matches.push(val);
  }
  return matches;
}

function extractFirstUserPrompt(content) {
  if (typeof content !== 'string') return '';
  const m = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i.exec(content);
  const body = (m ? m[1] : content)
    .replace(/@\[[^\]]+\]/g, '')
    .replace(/<\/?[A-Z_]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return body ? oneLine(body, 56) : '';
}

function parseGenericHeaders(content) {
  if (typeof content !== 'string' || !content) {
    return { createdAtMs: null, completedAtMs: null };
  }
  const head = content.slice(0, 600);
  const createdMatch = CREATED_AT_HEADER_RE.exec(head);
  const createdAtMs = createdMatch ? parseTimestampMs(createdMatch[1]) : null;

  let completedAtMs = null;
  COMPLETED_AT_HEADER_RE.lastIndex = 0;
  let m;
  while ((m = COMPLETED_AT_HEADER_RE.exec(head)) !== null) {
    const ms = parseTimestampMs(m[1]);
    if (ms !== null && (completedAtMs === null || ms > completedAtMs)) {
      completedAtMs = ms;
    }
  }
  return { createdAtMs, completedAtMs };
}

function extractUuids(text, excludeId) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  const seen = new Set();
  UUID_RE.lastIndex = 0;
  let m;
  while ((m = UUID_RE.exec(text)) !== null) {
    const id = m[0].toLowerCase();
    if (excludeId && id === excludeId.toLowerCase()) continue;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(m[0]);
    }
  }
  return out;
}

/**
 * Parses conversation telemetry from SQLite `conversations/<id>.db` + `transcript.jsonl`,
 * with 4-file stat caching (`.db` + `.db-wal` + `transcript.jsonl` + `transcript_full.jsonl`).
 */
export function parseTranscript(convId, paths) {
  if (!paths || !isValidConversationId(convId)) return null;
  const { dbPath, walPath, transcriptPath, fullTranscriptPath } = paths;

  const dbStat = statOf(dbPath);
  const walStat = statOf(walPath);
  const tStat = statOf(transcriptPath);
  const fullStat = statOf(fullTranscriptPath);

  if (dbStat.size < 0 && tStat.size < 0) return null;

  const primaryKey = `${dbStat.mtimeMs}:${dbStat.size}|${walStat.mtimeMs}:${walStat.size}|${tStat.mtimeMs}:${tStat.size}`;
  const cacheKey = `${primaryKey}|${fullStat.mtimeMs}:${fullStat.size}`;
  const cacheId = dbPath || transcriptPath;

  const hit = transcriptCache.get(cacheId);
  if (hit && hit.key === cacheKey) {
    transcriptCache.delete(cacheId);
    transcriptCache.set(cacheId, hit);
    return hit.parsed;
  }

  let dbParsed = null;
  let dbReadFailed = false;
  if (dbStat.size >= 0) {
    dbParsed = parseConversationDb(convId, dbPath, walPath);
    if (!dbParsed) {
      dbReadFailed = true;
      if (tStat.size < 0) {
        return hit?.parsed || null;
      }
      if (hit?.parsed?.hasDbTelemetry && hit.tKey === `${tStat.mtimeMs}:${tStat.size}`) {
        return hit.parsed;
      }
    }
  }

  const statMtimeMs = Math.max(dbStat.mtimeMs, walStat.mtimeMs, tStat.mtimeMs);

  // DB-only conversation (no transcript.jsonl on disk)
  if (tStat.size < 0) {
    if (!dbParsed) return null;
    const parsed = {
      convId,
      transcriptPath: transcriptPath || dbPath,
      dbPath,
      statMtimeMs,
      statSize: dbStat.size,
      cacheKey,
      fullKey: cacheKey,
      hasDbTelemetry: true,
      firstUserPrompt: '',
      steps: dbParsed.synthesizedSteps,
    };
    if (transcriptCache.size >= MAX_TRANSCRIPT_CACHE) {
      const oldestKey = transcriptCache.keys().next().value;
      if (oldestKey !== undefined) transcriptCache.delete(oldestKey);
    }
    transcriptCache.set(cacheId, { key: cacheKey, tKey: '-1:-1', parsed });
    return parsed;
  }

  let rawText;
  try {
    rawText = readFileSync(transcriptPath, 'utf-8');
  } catch {
    if (dbParsed) {
      return {
        convId,
        transcriptPath: dbPath,
        dbPath,
        statMtimeMs,
        statSize: dbStat.size,
        cacheKey,
        fullKey: cacheKey,
        hasDbTelemetry: true,
        firstUserPrompt: '',
        steps: dbParsed.synthesizedSteps,
      };
    }
    return hit?.parsed || null;
  }

  const rawLines = rawText.split(/\r?\n/);
  let fullLinesCache = null;

  function loadFullStep(lineIdx, stepIndex) {
    if (fullStat.size < 0) return null;
    if (fullLinesCache === null) {
      try {
        fullLinesCache = readFileSync(fullTranscriptPath, 'utf-8').split(/\r?\n/);
      } catch {
        fullLinesCache = [];
      }
    }
    if (lineIdx >= 0 && lineIdx < fullLinesCache.length && fullLinesCache[lineIdx].trim()) {
      try {
        const candidate = JSON.parse(fullLinesCache[lineIdx]);
        if (
          candidate &&
          typeof candidate === 'object' &&
          (candidate.step_index === undefined || candidate.step_index === stepIndex)
        ) {
          return candidate;
        }
      } catch {
        // Fallback to scanning by step_index below.
      }
    }
    for (const fl of fullLinesCache) {
      if (!fl.trim()) continue;
      try {
        const candidate = JSON.parse(fl);
        if (candidate && candidate.step_index === stepIndex) return candidate;
      } catch {
        // Ignore unparseable line.
      }
    }
    return null;
  }

  const steps = [];
  const stepPosByIndex = new Map();
  let firstUserPrompt = '';
  let lastPlannerHadSubagent = false;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:15:00
// Description: Replace duplicate step_index entries in-place when append-only
// transcript.jsonl contains pre-rewind lines, and treat SQLite dbParsed as
// authoritative for hasTokenTelemetry when conversations/<id>.db is present.
// ============================================================================
  function upsertTranscriptStep(stepIndex, stepObj) {
    const existingPos = stepPosByIndex.get(stepIndex);
    if (existingPos !== undefined) {
      steps[existingPos] = stepObj;
    } else {
      stepPosByIndex.set(stepIndex, steps.length);
      steps.push(stepObj);
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-16 22:15:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Avoid unnecessary multi-MB transcript_full.jsonl reads for mid-session
// truncated USER_INPUT steps when SQLite dbParsed already provides planner models.
// ============================================================================
  let lastPlannerLineIdx = -1;
  if (dbParsed && dbParsed.plannerByStepIdx.size > 0) {
    for (let k = rawLines.length - 1; k >= 0; k--) {
      if (
        rawLines[k].includes('PLANNER_RESPONSE') &&
        /"type"\s*:\s*"PLANNER_RESPONSE"/.test(rawLines[k])
      ) {
        lastPlannerLineIdx = k;
        break;
      }
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line.trim()) continue;
    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      // Torn line being written; skip gracefully.
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;

    const type = String(raw.type || '');
    const stepIndex = Number.isFinite(Number(raw.step_index)) ? Number(raw.step_index) : i;
    const status = String(raw.status || '');
    const createdAt = String(raw.created_at || '');
    const createdAtMs = parseTimestampMs(createdAt);
    const trunc = Array.isArray(raw.truncated_fields) ? raw.truncated_fields : [];

    if (type === 'USER_INPUT') {
      lastPlannerHadSubagent = false;
      let modelChanges = extractModelChangesFromContent(raw.content);
      let fullStep = null;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Skip loadFullStep on truncated USER_INPUT when SQLite planner telemetry
// covers earlier steps and firstUserPrompt is already resolved or extractable.
// ============================================================================
      const shouldLoadFullUserInput =
        !dbParsed ||
        dbParsed.plannerByStepIdx.size === 0 ||
        i > lastPlannerLineIdx ||
        (!firstUserPrompt && !extractFirstUserPrompt(raw.content));
      if (modelChanges.length === 0 && trunc.includes('content') && shouldLoadFullUserInput) {
        fullStep = loadFullStep(i, stepIndex);
        if (fullStep) {
          modelChanges = extractModelChangesFromContent(fullStep.content);
        }
      }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
      if (!firstUserPrompt) {
        const promptContent = fullStep?.content ?? raw.content;
        firstUserPrompt = extractFirstUserPrompt(promptContent);
      }
      const rawChange = modelChanges.length > 0 ? modelChanges[modelChanges.length - 1] : null;
      upsertTranscriptStep(stepIndex, {
        step_index: stepIndex,
        type,
        status,
        created_at: createdAt,
        createdAtMs,
        modelChange: rawChange ? normalizeModelId(rawChange) : null,
      });
      continue;
    }

    if (type === 'PLANNER_RESPONSE') {
      let toolCalls = Array.isArray(raw.tool_calls) ? raw.tool_calls : [];
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Load full tool_calls from transcript_full.jsonl for truncated
// manage_subagents steps alongside invoke_subagent so kill actions are preserved.
// ============================================================================
      const hasSubagentCall = toolCalls.some((tc) => tc?.name === 'invoke_subagent');
      const hasManageSubagentsCall = toolCalls.some((tc) => tc?.name === 'manage_subagents');
      if ((hasSubagentCall || hasManageSubagentsCall) && trunc.includes('tool_calls')) {
        const fullStep = loadFullStep(i, stepIndex);
        if (fullStep && Array.isArray(fullStep.tool_calls)) {
          toolCalls = fullStep.tool_calls;
        }
      }
      lastPlannerHadSubagent = hasSubagentCall;
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Initialize and merge botId, originCascadeId, and isClonedFromParent
// across hybrid transcript.jsonl + SQLite conversations/<id>.db steps.
// ============================================================================
      const hasTokenTelemetry =
        raw.input_tokens != null || raw.cache_read_tokens != null || raw.output_tokens != null;
      upsertTranscriptStep(stepIndex, {
        step_index: stepIndex,
        type,
        status,
        created_at: createdAt,
        createdAtMs,
        hasTokenTelemetry,
        input_tokens: Number(raw.input_tokens) || 0,
        cache_read_tokens: Number(raw.cache_read_tokens) || 0,
        output_tokens: Number(raw.output_tokens) || 0,
        botId: '',
        originCascadeId: '',
        isClonedFromParent: false,
        tool_calls: toolCalls,
      });
      continue;
    }

    if (type === 'CHECKPOINT') {
      const inTok = Number(raw.input_tokens) || 0;
      const cacheTok = Number(raw.cache_read_tokens) || 0;
      const outTok = Number(raw.output_tokens) || 0;
      if (inTok + cacheTok + outTok > 0) {
        upsertTranscriptStep(stepIndex, {
          step_index: stepIndex,
          type: 'COMPACTION_SUMMARY',
          status,
          created_at: createdAt,
          createdAtMs,
          hasTokenTelemetry: true,
          input_tokens: inTok,
          cache_read_tokens: cacheTok,
          output_tokens: outTok,
          botId: '',
          originCascadeId: '',
          isClonedFromParent: false,
        });
        continue;
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

    if (type === 'GENERIC') {
      const contentStr = typeof raw.content === 'string' ? raw.content : '';
      const headers = parseGenericHeaders(contentStr);
      let uuids = [];
      if (lastPlannerHadSubagent) {
        let searchContent = contentStr;
        if (trunc.includes('content')) {
          const fullStep = loadFullStep(i, stepIndex);
          if (fullStep && typeof fullStep.content === 'string') {
            searchContent = fullStep.content;
          }
        }
        uuids = extractUuids(searchContent, convId);
      }
      upsertTranscriptStep(stepIndex, {
        step_index: stepIndex,
        type,
        status,
        created_at: createdAt,
        createdAtMs,
        genericCreatedAtMs: headers.createdAtMs,
        genericCompletedAtMs: headers.completedAtMs,
        uuids,
      });
      continue;
    }

    if (type === 'SYSTEM_MESSAGE') {
      const contentStr = typeof raw.content === 'string' ? raw.content : '';
      upsertTranscriptStep(stepIndex, {
        step_index: stepIndex,
        type,
        status,
        created_at: createdAt,
        createdAtMs,
        isWakeupMessage: contentStr.includes('[Message]'),
      });
      continue;
    }

    upsertTranscriptStep(stepIndex, {
      step_index: stepIndex,
      type,
      status,
      created_at: createdAt,
      createdAtMs,
    });
  }

  // Merge primary SQLite telemetry into transcript steps when DB was read cleanly
  if (dbParsed) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:15:00
// Description: Copy SQLite step provenance (botId, originCascadeId, isClonedFromParent)
// and clear stale pre-rewind transcript token steps absent from SQLite DB.
// ============================================================================
    let insertedExtra = false;
    const dbVerifiedStepIndices = new Set();

    for (const [sIdx, dbPlanner] of dbParsed.plannerByStepIdx) {
      dbVerifiedStepIndices.add(sIdx);
      const pos = stepPosByIndex.get(sIdx);
      if (pos !== undefined && steps[pos].type === 'PLANNER_RESPONSE') {
        const target = steps[pos];
        target.dbModel = dbPlanner.dbModel;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:30
// Description: Copy rawDbModel from SQLite planner telemetry onto merged step.
// ============================================================================
        target.rawDbModel = dbPlanner.rawDbModel || '';
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:30
// ============================================================================
        target.botId = dbPlanner.botId || '';
        target.originCascadeId = dbPlanner.originCascadeId || '';
        target.isClonedFromParent = Boolean(dbPlanner.isClonedFromParent);
        if (dbPlanner.createdAtMs !== null) target.createdAtMs = dbPlanner.createdAtMs;
        if (dbPlanner.firstTokenAtMs !== null) target.firstTokenAtMs = dbPlanner.firstTokenAtMs;
        if (dbPlanner.completedAtMs !== null) target.completedAtMs = dbPlanner.completedAtMs;
        target.hasTokenTelemetry = Boolean(dbPlanner.hasTokenTelemetry);
        if (dbPlanner.hasTokenTelemetry) {
          target.input_tokens = dbPlanner.input_tokens;
          target.cache_read_tokens = dbPlanner.cache_read_tokens;
          target.output_tokens = dbPlanner.output_tokens;
        }
      } else if (pos !== undefined) {
        steps[pos] = dbPlanner;
      } else {
        stepPosByIndex.set(sIdx, steps.length);
        steps.push(dbPlanner);
        insertedExtra = true;
      }
    }

    for (const comp of dbParsed.compactionSteps) {
      dbVerifiedStepIndices.add(comp.step_index);
      const pos = stepPosByIndex.get(comp.step_index);
      if (pos !== undefined && steps[pos].type !== 'PLANNER_RESPONSE') {
        steps[pos] = comp;
      } else if (pos === undefined) {
        stepPosByIndex.set(comp.step_index, steps.length);
        steps.push(comp);
        insertedExtra = true;
      }
    }

    for (const st of steps) {
      if (
        (st.type === 'PLANNER_RESPONSE' || st.type === 'COMPACTION_SUMMARY') &&
        !dbVerifiedStepIndices.has(st.step_index)
      ) {
        st.hasTokenTelemetry = false;
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-16 22:15:00
// ============================================================================

    if (insertedExtra) {
      steps.sort((a, b) => a.step_index - b.step_index);
    }
  }

  const parsed = {
    convId,
    transcriptPath,
    dbPath,
    statMtimeMs,
    statSize: tStat.size,
    cacheKey,
    fullKey: cacheKey,
    hasDbTelemetry: Boolean(dbParsed),
    firstUserPrompt,
    steps,
  };

  if (!dbReadFailed) {
    if (transcriptCache.size >= MAX_TRANSCRIPT_CACHE) {
      const oldestKey = transcriptCache.keys().next().value;
      if (oldestKey !== undefined) transcriptCache.delete(oldestKey);
    }
    transcriptCache.set(cacheId, {
      key: cacheKey,
      tKey: `${tStat.mtimeMs}:${tStat.size}`,
      parsed,
    });
  }
  return parsed;
}

/**
 * Computes the live execution status state machine on newest transcript steps.
 */
export function computeLiveStatus(parsed) {
  const steps = parsed?.steps || [];
  const statMtimeMs = parsed?.statMtimeMs || Date.now();
  if (steps.length === 0) {
    return {
      status: 'IDLE',
      generatingSinceMs: null,
      toolProgress: null,
      activeToolLabel: '',
    };
  }

  const last = steps[steps.length - 1];
  if (last.type === 'USER_INPUT') {
    return {
      status: 'GENERATING',
      generatingSinceMs: last.createdAtMs ?? statMtimeMs,
      toolProgress: null,
      activeToolLabel: '',
    };
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:09:30
// Description: Resolve post-/compact live status to IDLE when a completed
// COMPACTION_SUMMARY follows the latest USER_INPUT with no subsequent wakeup.
// ============================================================================
  let lastUserIdx = -1;
  let lastPlannerIdx = -1;
  let lastCompactionIdx = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (lastUserIdx < 0 && steps[i].type === 'USER_INPUT') lastUserIdx = i;
    if (lastPlannerIdx < 0 && steps[i].type === 'PLANNER_RESPONSE') lastPlannerIdx = i;
    if (lastCompactionIdx < 0 && steps[i].type === 'COMPACTION_SUMMARY') lastCompactionIdx = i;
    if (lastUserIdx >= 0 && lastPlannerIdx >= 0 && lastCompactionIdx >= 0) break;
  }

  if (lastUserIdx > lastPlannerIdx) {
    if (lastCompactionIdx > lastUserIdx && steps[lastCompactionIdx].status === 'DONE') {
      const postCompactionWakeup = steps
        .slice(lastCompactionIdx + 1)
        .find((s) => s.type === 'SYSTEM_MESSAGE' && s.isWakeupMessage);
      if (postCompactionWakeup) {
        return {
          status: 'GENERATING',
          generatingSinceMs: postCompactionWakeup.createdAtMs ?? statMtimeMs,
          toolProgress: null,
          activeToolLabel: '',
        };
      }
      return { status: 'IDLE', generatingSinceMs: null, toolProgress: null, activeToolLabel: '' };
    }
    return {
      status: 'GENERATING',
      generatingSinceMs: steps[lastUserIdx].createdAtMs ?? statMtimeMs,
      toolProgress: null,
      activeToolLabel: '',
    };
  }

  if (lastPlannerIdx < 0) {
    if (last.type === 'SYSTEM_MESSAGE') {
      return {
        status: 'GENERATING',
        generatingSinceMs: last.createdAtMs ?? statMtimeMs,
        toolProgress: null,
        activeToolLabel: '',
      };
    }
    return { status: 'IDLE', generatingSinceMs: null, toolProgress: null, activeToolLabel: '' };
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 16:09:30
// ============================================================================

  const planner = steps[lastPlannerIdx];
  const calls = Array.isArray(planner.tool_calls) ? planner.tool_calls : [];
  const totalTools = calls.length;
  const postSteps = steps.slice(lastPlannerIdx + 1);
  const generics = postSteps.filter((s) => s.type === 'GENERIC');
  const doneTools = generics.length;

  if (totalTools === 0) {
    const wakeup = postSteps.find((s) => s.type === 'SYSTEM_MESSAGE' && s.isWakeupMessage);
    if (wakeup) {
      return {
        status: 'GENERATING',
        generatingSinceMs: wakeup.createdAtMs ?? statMtimeMs,
        toolProgress: null,
        activeToolLabel: '',
      };
    }
    return { status: 'IDLE', generatingSinceMs: null, toolProgress: null, activeToolLabel: '' };
  }

  const waitIdx = calls.findIndex((tc) => tc?.name === 'swarm_wait');
  if (waitIdx >= 0 && doneTools > waitIdx && generics[waitIdx]?.status === 'DONE') {
    const waitStepPos = postSteps.indexOf(generics[waitIdx]);
    const postWaitWakeup = postSteps
      .slice(waitStepPos + 1)
      .find((s) => s.type === 'SYSTEM_MESSAGE' && s.isWakeupMessage);
    if (postWaitWakeup) {
      return {
        status: 'GENERATING',
        generatingSinceMs: postWaitWakeup.createdAtMs ?? statMtimeMs,
        toolProgress: null,
        activeToolLabel: '',
      };
    }
    return { status: 'IDLE', generatingSinceMs: null, toolProgress: null, activeToolLabel: '' };
  }

  if (doneTools < totalTools) {
    const currentCall = calls[doneTools] || calls[0];
    return {
      status: 'RUNNING_TOOLS',
      generatingSinceMs: null,
      toolProgress: { done: doneTools, total: totalTools },
      activeToolLabel: describeToolCall(currentCall),
    };
  }

  let maxCompletedMs = null;
  for (const g of generics) {
    if (
      g.genericCompletedAtMs !== null &&
      (maxCompletedMs === null || g.genericCompletedAtMs > maxCompletedMs)
    ) {
      maxCompletedMs = g.genericCompletedAtMs;
    }
  }
  return {
    status: 'GENERATING',
    generatingSinceMs: maxCompletedMs ?? statMtimeMs,
    toolProgress: null,
    activeToolLabel: '',
  };
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:40:00
// Description: Support dynamic runtimeCatalog in resolveModelProfile,
// resolveModelPricing, and buildEffectivePricingCatalog, and classify
// gemini-3.1-pro under Pro subscription auto-detection.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Implement 3-pass resolveModelProfile (exact id/label -> specific
// pattern -> fallbackPattern -> auto) and export scoreModelPerformance /
// compareModelsByPerformance for capability-first catalog sorting.
// ============================================================================
const GROUP_SORT_ORDER = Object.freeze({
  'Gemini 系列': 0,
  'Claude 系列': 1,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Use 其他现役模型 rank 2 and keep 其他在役模型 as legacy alias.
// ============================================================================
  '其他现役模型': 2,
  '其他在役模型': 2,
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
  '默认回退': 3,
});

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

/**
 * Computes a numeric capability score within a model family for descending sort.
 */
export function scoreModelPerformance(item) {
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
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Score Gemini 4 Neon at sub = 85 between Carbon (90) and Argon (80).
// ============================================================================
    else if (/(?:^|[^a-z0-9])neon(?=$|[^a-z0-9])/i.test(s)) sub = 85;
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
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

/**
 * Comparator sorting models by group priority, capability score, rates desc, and id asc.
 */
export function compareModelsByPerformance(a, b) {
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
}

function resolveProfileRegex(profile, reKey, strKey) {
  const direct = profile?.[reKey];
  if (direct instanceof RegExp) return direct;
  const raw = profile?.[strKey];
  if (typeof raw === 'string' && raw) {
    try {
      return new RegExp(raw, 'i');
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resolves the pricing catalog profile matching an Antigravity model display name or ID.
 */
export function resolveModelProfile(modelName, runtimeCatalog = null) {
  const list =
    Array.isArray(runtimeCatalog) && runtimeCatalog.length > 0
      ? runtimeCatalog
      : MODEL_PRICING_CATALOG;
  const s = typeof modelName === 'string' ? modelName.trim() : '';
  if (s) {
    const lower = s.toLowerCase();
    // Pass 0: Exact match on lowercase id or lowercase label.
    const exactId = list.find((p) => typeof p?.id === 'string' && p.id.toLowerCase() === lower);
    if (exactId) return exactId;
    const exactLabel = list.find(
      (p) => typeof p?.label === 'string' && p.label.trim().toLowerCase() === lower,
    );
    if (exactLabel) return exactLabel;

    // Pass 1: Specific profile pattern.
    for (const profile of list) {
      if (!profile) continue;
      const re = resolveProfileRegex(profile, 'pattern', 'patternStr');
      if (re && re.test(s)) {
        return profile;
      }
    }

    // Pass 2: Catch-all fallback pattern.
    for (const profile of list) {
      if (!profile) continue;
      const re = resolveProfileRegex(profile, 'fallbackPattern', 'fallbackPatternStr');
      if (re && re.test(s)) {
        return profile;
      }
    }
  }
  return list.find((p) => p?.id === 'auto') || PROFILE_BY_ID.get('auto');
}
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================

/**
 * Resolves effective per-million token rates (and CNY conversion) for a model and prefs.
 */
export function resolveModelPricing(modelName, prefs = DEFAULT_PREFS) {
  const runtimeCatalog =
    Array.isArray(prefs?._runtimeCatalog) && prefs._runtimeCatalog.length > 0
      ? prefs._runtimeCatalog
      : null;
  const profile = resolveModelProfile(modelName, runtimeCatalog);
  const override =
    prefs?.modelOverrides && typeof prefs.modelOverrides === 'object'
      ? prefs.modelOverrides[profile.id]
      : null;

  const hasLegacyFlat =
    !override &&
    profile.id === 'auto' &&
    prefs &&
    (prefs.inputPer1M !== undefined ||
      prefs.cachedPer1M !== undefined ||
      prefs.outputPer1M !== undefined);

  const fx =
    prefs?.currency === 'CNY'
      ? Math.max(0.01, Number(prefs?.cnyRate) || DEFAULT_PREFS.cnyRate)
      : 1;

  const usdInput =
    override && Number.isFinite(Number(override.inputPer1M))
      ? Number(override.inputPer1M)
      : hasLegacyFlat && Number.isFinite(Number(prefs.inputPer1M))
        ? Number(prefs.inputPer1M)
        : profile.inputPer1M;
  const usdCached =
    override && Number.isFinite(Number(override.cachedPer1M))
      ? Number(override.cachedPer1M)
      : hasLegacyFlat && Number.isFinite(Number(prefs.cachedPer1M))
        ? Number(prefs.cachedPer1M)
        : profile.cachedPer1M;
  const usdOutput =
    override && Number.isFinite(Number(override.outputPer1M))
      ? Number(override.outputPer1M)
      : hasLegacyFlat && Number.isFinite(Number(prefs.outputPer1M))
        ? Number(prefs.outputPer1M)
        : profile.outputPer1M;
  const longContextTier =
    override && typeof override.longContextTier === 'boolean'
      ? override.longContextTier
      : hasLegacyFlat && typeof prefs.longContextTier === 'boolean'
        ? prefs.longContextTier
        : profile.longContextTier;

  const longInputMultiplier =
    Number(override?.longInputMultiplier) ||
    Number(prefs?.longInputMultiplier) ||
    profile.longInputMultiplier ||
    2.0;
  const longOutputMultiplier =
    Number(override?.longOutputMultiplier) ||
    Number(prefs?.longOutputMultiplier) ||
    profile.longOutputMultiplier ||
    1.5;

  return {
    profileId: profile.id,
    profileLabel: profile.label,
    group: profile.group,
    hint: profile.hint,
    isOverridden: Boolean(override),
    currency: prefs?.currency === 'CNY' ? 'CNY' : 'USD',
    fx,
    usdInputPer1M: usdInput,
    usdCachedPer1M: usdCached,
    usdOutputPer1M: usdOutput,
    inputPer1M: usdInput * fx,
    cachedPer1M: usdCached * fx,
    outputPer1M: usdOutput * fx,
    longContextTier,
    longContextThreshold:
      Number(prefs?.longContextThreshold) || DEFAULT_PREFS.longContextThreshold,
    longInputMultiplier,
    longOutputMultiplier,
  };
}

/**
 * Returns effective pricing metadata for all active catalog models for UI rendering.
 */
export function buildEffectivePricingCatalog(prefs = DEFAULT_PREFS, runtimeCatalog = null) {
  const list =
    Array.isArray(runtimeCatalog) && runtimeCatalog.length > 0
      ? runtimeCatalog
      : Array.isArray(prefs?._runtimeCatalog) && prefs._runtimeCatalog.length > 0
        ? prefs._runtimeCatalog
        : MODEL_PRICING_CATALOG;
  const effectivePrefs = { ...(prefs || DEFAULT_PREFS), _runtimeCatalog: list };
  return list.map((p) => {
    const resolved = resolveModelPricing(p.id, effectivePrefs);
    return {
      id: p.id,
      group: p.group,
      label: p.label,
      hint: p.hint,
      isOverridden: resolved.isOverridden,
      defaultUsd: {
        inputPer1M: p.inputPer1M,
        cachedPer1M: p.cachedPer1M,
        outputPer1M: p.outputPer1M,
        longContextTier: p.longContextTier,
      },
      usd: {
        inputPer1M: resolved.usdInputPer1M,
        cachedPer1M: resolved.usdCachedPer1M,
        outputPer1M: resolved.usdOutputPer1M,
        longContextTier: resolved.longContextTier,
      },
      display: {
        currency: resolved.currency,
        inputPer1M: resolved.inputPer1M,
        cachedPer1M: resolved.cachedPer1M,
        outputPer1M: resolved.outputPer1M,
      },
    };
  });
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Implement raw-model-gated detectSubscriptionPlanFromModels() with
// Jio AI Pro ($0/mo) default tier and keep detectSubscriptionPlanFromProfiles()
// delegating for backward compatibility.
// ============================================================================
const ULTRA_RAW_MODEL_RE = /^(?:gemini-4-carbon(?:-|$)|gemini-pro-orchestrator$)/i;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Include gemini-4-neon and gemini-pro-orchestrator-neon in PAID_PRO_RAW_MODEL_RE.
// ============================================================================
const PAID_PRO_RAW_MODEL_RE =
  /^(?:gemini-4-neon(?:-|$)|gemini-pro-orchestrator-neon$|gemini-4-argon(?:-|$)|gemini-pro-orchestrator-argon$|gemini-4-hydrogen(?:-|$)|gemini-3\.1-pro(?:-|$)|claude-(?:opus|sonnet)-5[-.]5(?:-|$))/i;
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================

/**
 * Infers subscription plan ID from observed normalized/raw model slugs.
 */
export function detectSubscriptionPlanFromModels(rawModels) {
  const items =
    rawModels?.[Symbol.iterator] && typeof rawModels !== 'string' ? rawModels : [];
  let hasPaidPro = false;
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || AUTO_UNKNOWN_RE.test(trimmed)) continue;
    const normalized = normalizeModelId(trimmed);
    if (ULTRA_RAW_MODEL_RE.test(trimmed) || ULTRA_RAW_MODEL_RE.test(normalized)) {
      return 'ultra_5x';
    }
    if (PAID_PRO_RAW_MODEL_RE.test(trimmed) || PAID_PRO_RAW_MODEL_RE.test(normalized)) {
      hasPaidPro = true;
    }
  }
  return hasPaidPro ? 'pro' : 'jio_pro';
}

/**
 * Infers subscription plan ID from observed active model identifiers (compat wrapper).
 */
export function detectSubscriptionPlanFromProfiles(profileIds) {
  return detectSubscriptionPlanFromModels(profileIds);
}
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Update resolveSubscriptionInfo to infer tier from raw model slugs
// via detectSubscriptionPlanFromModels and fall back to SUBSCRIPTION_CATALOG.jio_pro.
// ============================================================================
/**
 * Resolves the active subscription plan details and monthly fee in display currency.
 */
export function resolveSubscriptionInfo(prefs = DEFAULT_PREFS, observedModels = new Set()) {
  const mode =
    typeof prefs?.subscriptionPlan === 'string' && SUBSCRIPTION_CATALOG[prefs.subscriptionPlan]
      ? prefs.subscriptionPlan
      : 'auto';
  const currency = prefs?.currency === 'CNY' ? 'CNY' : 'USD';
  const fx =
    currency === 'CNY' ? Math.max(0.01, Number(prefs?.cnyRate) || DEFAULT_PREFS.cnyRate) : 1;

  const detectedPlanId = detectSubscriptionPlanFromModels(observedModels);
  const effectivePlanId = mode === 'auto' ? detectedPlanId : mode;
  const planMeta = SUBSCRIPTION_CATALOG[effectivePlanId] || SUBSCRIPTION_CATALOG.jio_pro;

  let monthlyUsd = 0;
  if (effectivePlanId === 'custom') {
    const customVal = Number(prefs?.customSubscriptionMonthlyUsd);
    monthlyUsd = Number.isFinite(customVal) && customVal >= 0 ? customVal : 0;
  } else if (Number.isFinite(planMeta.monthlyUsd)) {
    monthlyUsd = planMeta.monthlyUsd;
  }

  const detectedMeta = SUBSCRIPTION_CATALOG[detectedPlanId] || SUBSCRIPTION_CATALOG.jio_pro;
  return {
    mode,
    planId: effectivePlanId,
    planLabel: planMeta.label,
    isAutoDetected: mode === 'auto',
    detectedPlanId,
    detectedPlanLabel: detectedMeta.label,
    detectedMonthlyUsd: detectedMeta.monthlyUsd ?? 0,
    currency,
    monthlyUsd,
    monthlyFee: monthlyUsd * fx,
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================

/**
 * Compares period token cost against prorated subscription fee to measure net savings and ROI.
 */
export function computeSubscriptionComparison(tokenCost, proratedDays, subInfo) {
  const days = Math.max(1, Number(proratedDays) || 1);
  const monthlyFee = Math.max(0, Number(subInfo?.monthlyFee) || 0);
  const proratedFee = monthlyFee * (days / 30);
  const cost = Math.max(0, Number(tokenCost) || 0);
  const netSavings = cost - proratedFee;
  const roiMultiplier = proratedFee > 0 ? cost / proratedFee : null;
  const paybackPct = proratedFee > 0 ? (cost / proratedFee) * 100 : cost > 0 ? 100 : 0;
  return {
    planId: subInfo?.planId || 'free',
    planLabel: subInfo?.planLabel || 'Free',
    isAutoDetected: Boolean(subInfo?.isAutoDetected),
    detectedPlanId: subInfo?.detectedPlanId || subInfo?.planId || 'free',
    detectedPlanLabel: subInfo?.detectedPlanLabel || subInfo?.planLabel || 'Free',
    monthlyFee,
    proratedFee,
    proratedDays: days,
    tokenCost: cost,
    netSavings,
    roiMultiplier,
    paybackPct,
    isPaidOff: cost >= proratedFee,
  };
}

function priceBucketWithProfile(counts, resolvedPricing) {
  const stdIn = counts.stdIn || 0;
  const stdCache = counts.stdCache || 0;
  const stdOut = counts.stdOut || 0;
  const longIn = counts.longIn || 0;
  const longCache = counts.longCache || 0;
  const longOut = counts.longOut || 0;

  const inRate = resolvedPricing.inputPer1M;
  const cacheRate = resolvedPricing.cachedPer1M;
  const outRate = resolvedPricing.outputPer1M;
  const inMult = resolvedPricing.longContextTier ? resolvedPricing.longInputMultiplier : 1;
  const outMult = resolvedPricing.longContextTier ? resolvedPricing.longOutputMultiplier : 1;

  const costActual =
    (stdIn / 1e6) * inRate +
    (stdCache / 1e6) * cacheRate +
    (stdOut / 1e6) * outRate +
    (longIn / 1e6) * (inRate * inMult) +
    (longCache / 1e6) * (cacheRate * inMult) +
    (longOut / 1e6) * (outRate * outMult);

  const costUncachedBaseline =
    ((stdIn + stdCache) / 1e6) * inRate +
    (stdOut / 1e6) * outRate +
    ((longIn + longCache) / 1e6) * (inRate * inMult) +
    (longOut / 1e6) * (outRate * outMult);

  const costSavedByCache = Math.max(0, costUncachedBaseline - costActual);
  return { costActual, costUncachedBaseline, costSavedByCache };
}

/**
 * Calculates per-step API cost and prompt cache baseline savings using per-model pricing.
 */
export function computeStepCost(step, prefs = DEFAULT_PREFS, modelName = 'Auto') {
  const input = Number(step?.input_tokens) || 0;
  const cacheRead = Number(step?.cache_read_tokens) || 0;
  const output = Number(step?.output_tokens) || 0;
  const stepContextTotal = input + cacheRead;
  const pricing = resolveModelPricing(modelName, prefs);
  const isLong = stepContextTotal > pricing.longContextThreshold;

  const counts = isLong
    ? { stdIn: 0, stdCache: 0, stdOut: 0, longIn: input, longCache: cacheRead, longOut: output }
    : { stdIn: input, stdCache: cacheRead, stdOut: output, longIn: 0, longCache: 0, longOut: 0 };

  const res = priceBucketWithProfile(counts, pricing);
  return { ...res, profileId: pricing.profileId, profileLabel: pricing.profileLabel };
}

/**
 * Resolves normalized model timeline across steps (preferring SQLite `step.dbModel`).
 */
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:32:45
// Description: Track activeRawModel alongside activeModel and modelByStepIdx
// in resolveModelTimeline().
// ============================================================================
export function resolveModelTimeline(parsed, defaultModel = 'Auto') {
  let currentModel = normalizeModelId(defaultModel);
  let currentRawModel =
    typeof defaultModel === 'string' &&
    defaultModel.trim() &&
    !AUTO_UNKNOWN_RE.test(defaultModel.trim())
      ? defaultModel.trim()
      : currentModel;
  if (AUTO_UNKNOWN_RE.test(currentRawModel)) currentRawModel = currentModel;
  const modelByStepIdx = new Map();
  for (const step of parsed?.steps || []) {
    if (step.type === 'USER_INPUT' && step.modelChange) {
      currentModel = normalizeModelId(step.modelChange);
      currentRawModel = currentModel;
    } else if (step.type === 'PLANNER_RESPONSE' || step.type === 'COMPACTION_SUMMARY') {
      const hasRaw =
        typeof step.rawDbModel === 'string' &&
        step.rawDbModel.trim() &&
        !AUTO_UNKNOWN_RE.test(step.rawDbModel.trim());
      const hasDb =
        typeof step.dbModel === 'string' &&
        step.dbModel.trim() &&
        step.dbModel !== 'Auto' &&
        !AUTO_UNKNOWN_RE.test(step.dbModel.trim());
      if (hasDb) {
        currentModel = normalizeModelId(step.dbModel);
      }
      if (hasRaw) {
        currentRawModel = step.rawDbModel.trim();
      } else if (hasDb) {
        currentRawModel = step.dbModel.trim();
      }
      modelByStepIdx.set(step.step_index, currentModel);
    }
  }
  return {
    activeModel: currentModel,
    activeRawModel: currentRawModel || currentModel,
    modelByStepIdx,
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-19 13:32:45
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Exclude steps cloned from parent conversations (isClonedFromParent)
// from per-conversation generation speed calculation while keeping all PLANNER_RESPONSE
// steps in computeContext() so forked sessions reflect live inherited context window size.
// ============================================================================
/**
 * Computes generation speed metrics (tok/s) from own PLANNER_RESPONSE steps.
 */
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Fix computeSpeed tEnd priority (SQLite completedAtMs beats
// timingStore; never fallback to statMtimeMs when hasDbTelemetry is true) and
// accept activeModel for per-model speed scoping.
// ============================================================================
export function computeSpeed(parsed, convId, modelByStepIdx, timingStore, activeModel = '') {
  const steps = parsed?.steps || [];
  const measured = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== 'PLANNER_RESPONSE' || step.isClonedFromParent) continue;

    const tStart = step.createdAtMs;
    if (tStart === null) continue;

    let tEnd = null;
    if (Number.isFinite(step.completedAtMs) && step.completedAtMs > tStart) {
      tEnd = step.completedAtMs;
    } else {
      const liveEnd = timingStore?.getEndMs?.(convId, step.step_index);
      if (Number.isFinite(liveEnd) && liveEnd > tStart) {
        tEnd = liveEnd;
      } else if (i + 1 < steps.length && steps[i + 1].type === 'GENERIC') {
        tEnd = steps[i + 1].genericCreatedAtMs ?? steps[i + 1].createdAtMs;
      } else if (!parsed.hasDbTelemetry && i === steps.length - 1) {
        tEnd = parsed.statMtimeMs;
      }
    }

    if (!Number.isFinite(tEnd)) continue;
    const durationSec = (tEnd - tStart) / 1000;
    const outputTokens = step.output_tokens || 0;
    if (durationSec >= 0.2 && outputTokens > 0) {
      const stepModel = normalizeModelId(
        step.dbModel || modelByStepIdx?.get?.(step.step_index) || activeModel || 'Auto',
      );
      measured.push({
        stepIndex: step.step_index,
        tokPerSec: outputTokens / durationSec,
        outputTokens,
        durationSec,
        model: stepModel,
      });
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================

  if (measured.length === 0) {
    const lastPlanner = [...steps]
      .reverse()
      .find((s) => s.type === 'PLANNER_RESPONSE' && !s.isClonedFromParent);
    return {
      latestStepTokPerSec: null,
      latestStepOutputTokens: lastPlanner?.output_tokens || 0,
      latestStepDurationSec: null,
      weightedAvgTokPerSec: null,
      peakTokPerSec: null,
      measuredStepsCount: 0,
      recentSteps: [],
    };
  }
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Scope speed stats and recentSteps to activeModel (falling back
// to all measured steps when the newly selected model has no measured steps yet).
// ============================================================================
  const normActive = activeModel ? normalizeModelId(activeModel) : '';
  const scoped =
    normActive && normActive !== 'Auto' ? measured.filter((m) => m.model === normActive) : [];
  const pool = scoped.length > 0 ? scoped : measured;

  const latest = pool[pool.length - 1];
  let totalOut = 0;
  let totalDur = 0;
  let peak = 0;
  for (const m of pool) {
    totalOut += m.outputTokens;
    totalDur += m.durationSec;
    if (m.tokPerSec > peak) peak = m.tokPerSec;
  }

  return {
    latestStepTokPerSec: latest.tokPerSec,
    latestStepOutputTokens: latest.outputTokens,
    latestStepDurationSec: latest.durationSec,
    weightedAvgTokPerSec: totalDur > 0 ? totalOut / totalDur : null,
    peakTokPerSec: peak,
    measuredStepsCount: pool.length,
    recentSteps: pool.slice(-20),
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================

function summarizeTriggerBetween(steps, prevIdx, currIdx) {
  const prevStep = steps[prevIdx];
  let hasUserInput = false;
  for (let i = prevIdx + 1; i < currIdx; i++) {
    if (steps[i].type === 'USER_INPUT') {
      hasUserInput = true;
      break;
    }
  }
  const calls = Array.isArray(prevStep?.tool_calls) ? prevStep.tool_calls : [];
  if (calls.length > 0) {
    const labels = calls.slice(0, 3).map(describeToolCall);
    if (calls.length > 3) labels.push(`+${calls.length - 3}`);
    const toolText = oneLine(labels.join(', '), 72);
    return hasUserInput ? `${toolText} + User prompt` : toolText;
  }
  return hasUserInput ? 'User prompt' : 'Context step';
}

/**
 * Computes context usage, cache hit rate, threshold level, and top 5 context spikes.
 * Strictly filters `step.type === 'PLANNER_RESPONSE'` so compaction steps do not inflate post-compaction context.
 */
export function computeContext(parsed, prefs = DEFAULT_PREFS) {
  const steps = parsed?.steps || [];
  const softLimit = Number(prefs.softContextLimit) || DEFAULT_PREFS.softContextLimit;
  const hardLimit = Number(prefs.hardContextLimit) || DEFAULT_PREFS.hardContextLimit;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:09:30
// Description: Surface post-/compact summary tokens as currentTotal when a
// DONE COMPACTION_SUMMARY follows the latest PLANNER_RESPONSE, while keeping
// pre-compaction cache telemetry and topSpikes intact.
// ============================================================================
  const tokenIndices = [];
  let lastCompactionIdx = -1;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Count own completed COMPACTION_SUMMARY steps as compactionsCount
// and expose compactionsCount on both return paths of computeContext().
// ============================================================================
  let compactionsCount = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].type === 'PLANNER_RESPONSE' && steps[i].hasTokenTelemetry) {
      tokenIndices.push(i);
    }
    if (steps[i].type === 'COMPACTION_SUMMARY' && steps[i].status === 'DONE') {
      lastCompactionIdx = i;
      if (!steps[i].isClonedFromParent) {
        compactionsCount += 1;
      }
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

  if (tokenIndices.length === 0) {
    return {
      currentTotal: 0,
      latestInputUncached: 0,
      latestCacheRead: 0,
      latestCacheHitRatePct: 0,
      latestNetDelta: 0,
      softLimit,
      hardLimit,
      hardUsagePct: 0,
      softUsagePct: 0,
      usageLevel: 'HEALTHY',
      watermarkLevel: 'HEALTHY',
      topSpikes: [],
      compactedPendingTurn: false,
      compactedPreTotal: 0,
      compactionSummaryTokens: 0,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Include compactionsCount on empty-telemetry context return.
// ============================================================================
      compactionsCount,
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
    };
  }

  const latestTokenIdx = tokenIndices[tokenIndices.length - 1];
  const latest = steps[latestTokenIdx];
  const prev = tokenIndices.length >= 2 ? steps[tokenIndices[tokenIndices.length - 2]] : null;

  const latestPlannerTotal = latest.input_tokens + latest.cache_read_tokens;
  const prevTotal = prev ? prev.input_tokens + prev.cache_read_tokens : 0;
  const latestInputUncached = latest.input_tokens;
  const latestCacheRead = latest.cache_read_tokens;
  const latestCacheHitRatePct =
    latestPlannerTotal > 0 ? (latestCacheRead / latestPlannerTotal) * 100 : 0;

  const compactedPendingTurn = lastCompactionIdx > latestTokenIdx;
  const compactedPreTotal = compactedPendingTurn ? latestPlannerTotal : 0;
  const compactionSummaryTokens = compactedPendingTurn
    ? Math.max(0, Number(steps[lastCompactionIdx].output_tokens) || 0)
    : 0;
  const currentTotal = compactedPendingTurn ? compactionSummaryTokens : latestPlannerTotal;
  const latestNetDelta = compactedPendingTurn ? 0 : prev ? currentTotal - prevTotal : 0;

  const hardUsagePct = hardLimit > 0 ? (currentTotal / hardLimit) * 100 : 0;
  const softUsagePct = softLimit > 0 ? (currentTotal / softLimit) * 100 : 0;
// ============================================================================
// [MODIFIED END] 2026-11-17 16:09:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Replace hardcoded 0.8*hardLimit with 3-tier criticalThreshold
// so 400k/500k defaults retain HEALTHY (<400k), WARNING (400k..459,999), and
// CRITICAL (>=460k).
// ============================================================================
  const criticalThreshold =
    hardLimit > softLimit
      ? Math.max(hardLimit * 0.92, softLimit + (hardLimit - softLimit) * 0.6)
      : hardLimit;
  const usageLevel =
    currentTotal >= criticalThreshold
      ? 'CRITICAL'
      : currentTotal >= softLimit
        ? 'WARNING'
        : 'HEALTHY';
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================

  const spikes = [];
  for (let j = 1; j < tokenIndices.length; j++) {
    const prevIdx = tokenIndices[j - 1];
    const currIdx = tokenIndices[j];
    const prevSum = steps[prevIdx].input_tokens + steps[prevIdx].cache_read_tokens;
    const currSum = steps[currIdx].input_tokens + steps[currIdx].cache_read_tokens;
    const deltaTokens = currSum - prevSum;
    if (deltaTokens > 0) {
      spikes.push({
        stepIndex: steps[currIdx].step_index,
        deltaTokens,
        totalAfter: currSum,
        triggerSummary: summarizeTriggerBetween(steps, prevIdx, currIdx),
      });
    }
  }
  spikes.sort((a, b) => b.deltaTokens - a.deltaTokens || b.stepIndex - a.stepIndex);

  return {
    currentTotal,
    latestInputUncached,
    latestCacheRead,
    latestCacheHitRatePct,
    latestNetDelta,
    softLimit,
    hardLimit,
    hardUsagePct,
    softUsagePct,
    usageLevel,
    watermarkLevel: usageLevel,
    topSpikes: spikes.slice(0, 5),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:09:30
// Description: Expose post-compaction banner metadata on computeContext().
// ============================================================================
    compactedPendingTurn,
    compactedPreTotal,
    compactionSummaryTokens,
// ============================================================================
// [MODIFIED END] 2026-11-17 16:09:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Expose compactionsCount on normal computeContext() return.
// ============================================================================
    compactionsCount,
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
  };
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:40:00
// Description: Track session totalTokens in emptyBucket() and finalizeBucket().
// ============================================================================
function emptyBucket() {
  return {
    stepsCount: 0,
    inputUncachedTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheHitRatePct: 0,
    costActual: 0,
    costUncachedBaseline: 0,
    costSavedByCache: 0,
    costSavedPct: 0,
  };
}

function finalizeBucket(b) {
  const totalIn = b.inputUncachedTokens + b.cacheReadTokens;
  b.totalTokens = totalIn + b.outputTokens;
  b.cacheHitRatePct = totalIn > 0 ? (b.cacheReadTokens / totalIn) * 100 : 0;
  b.costSavedByCache = Math.max(0, b.costUncachedBaseline - b.costActual);
  b.costSavedPct = b.costUncachedBaseline > 0 ? (b.costSavedByCache / b.costUncachedBaseline) * 100 : 0;
  return b;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================

function formatRateSummary(pricing) {
  const f = (n) => {
    const v = Number(n) || 0;
    return v >= 1 ? v.toFixed(2) : v >= 0.1 ? v.toFixed(3).replace(/0$/, '') : v.toFixed(3);
  };
  return `${pricing.currency} ${f(pricing.inputPer1M)} / ${f(pricing.cachedPer1M)} / ${f(pricing.outputPer1M)}`;
}

function isBillableTokenStep(step) {
  return (
    (step.type === 'PLANNER_RESPONSE' || step.type === 'COMPACTION_SUMMARY') &&
    Boolean(step.hasTokenTelemetry)
  );
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:33:00
// Description: Merge byModel rows by canonical profileId/label (keeping unknown
// models separate) while accumulating underlying raw slugs and step models.
// ============================================================================
function resolveByModelMergeIdentity(pricing, modelName) {
  const isKnown = Boolean(pricing?.profileId && pricing.profileId !== 'auto');
  return {
    mergeKey: isKnown ? pricing.profileId : modelName,
    mergedLabel: isKnown ? pricing.profileLabel : modelName,
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-19 13:33:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Add shared resolveModelNameMode() and resolveCanonicalModelLabel()
// helpers for v0.5.4 canonical vs routed display mode across Tab 1 & Tab 2.
// ============================================================================
function resolveModelNameMode(prefs) {
  return prefs?.modelNameMode === 'routed' ? 'routed' : 'canonical';
}

function resolveCanonicalModelLabel(modelId, rawSlug = '', runtimeCatalog = null) {
  const candidate = typeof modelId === 'string' ? modelId.trim() : '';
  if (!candidate || AUTO_UNKNOWN_RE.test(candidate)) return 'Auto';
  const profile = resolveModelProfile(candidate, runtimeCatalog);
  if (profile && profile.id !== 'auto') return profile.label;
  const raw = typeof rawSlug === 'string' ? rawSlug.trim() : '';
  if (raw && raw !== candidate && !AUTO_UNKNOWN_RE.test(raw)) {
    const rawProfile = resolveModelProfile(raw, runtimeCatalog);
    if (rawProfile && rawProfile.id !== 'auto') return rawProfile.label;
  }
  return candidate;
}
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Skip cloned parent steps (isClonedFromParent) and deduplicate by
// botId when accumulating conversation and descendant token/cost buckets.
// ============================================================================
function accumulateStepsInto(
  bucket,
  byModelMap,
  observedProfiles,
  parsed,
  modelByStepIdx,
  prefs,
  seenBotIds = null,
) {
  for (const step of parsed?.steps || []) {
    if (!isBillableTokenStep(step) || step.isClonedFromParent) continue;
    if (seenBotIds && step.botId) {
      if (seenBotIds.has(step.botId)) continue;
      seenBotIds.add(step.botId);
    }
    const model = normalizeModelId(step.dbModel || modelByStepIdx.get(step.step_index) || 'Auto');
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================
    const pricing = resolveModelPricing(model, prefs);
    if (observedProfiles) observedProfiles.add(pricing.profileId);

    const { costActual, costUncachedBaseline, costSavedByCache } = computeStepCost(
      step,
      prefs,
      model,
    );

    bucket.stepsCount += 1;
    bucket.inputUncachedTokens += step.input_tokens;
    bucket.cacheReadTokens += step.cache_read_tokens;
    bucket.outputTokens += step.output_tokens;
    bucket.costActual += costActual;
    bucket.costUncachedBaseline += costUncachedBaseline;
    bucket.costSavedByCache += costSavedByCache;

    if (byModelMap) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:33:00
// Description: Accumulate Tab 1 byModel rows under canonical profile key/label
// and track _rawModels / _stepModels Sets.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Split Tab 1 byModel/mainOnlyByModel rows by exact routed rawSlug
// when prefs.modelNameMode === 'routed' while preserving canonical pricing.
// ============================================================================
      const isRoutedMode = resolveModelNameMode(prefs) === 'routed';
      const rawCandidate = typeof step.rawDbModel === 'string' ? step.rawDbModel.trim() : '';
      const rawSlug =
        rawCandidate && !AUTO_UNKNOWN_RE.test(rawCandidate) ? rawCandidate : model;
      const { mergeKey, mergedLabel } = isRoutedMode
        ? {
            mergeKey: `raw:${rawSlug.toLowerCase()}`,
            mergedLabel: rawSlug,
          }
        : resolveByModelMergeIdentity(pricing, model);
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
      let entry = byModelMap.get(mergeKey);
      if (!entry) {
        entry = {
          model: mergedLabel,
          profileId: pricing.profileId,
          profileLabel: pricing.profileLabel,
          rateDisplay: formatRateSummary(pricing),
          _rawModels: new Set(),
          _stepModels: new Set(),
          stepsCount: 0,
          inputUncachedTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costActual: 0,
        };
        byModelMap.set(mergeKey, entry);
      }
      if (rawSlug && !AUTO_UNKNOWN_RE.test(rawSlug)) {
        entry._rawModels.add(rawSlug);
      }
      if (model && !AUTO_UNKNOWN_RE.test(model)) {
        entry._stepModels.add(model);
      }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:33:00
// ============================================================================
      entry.stepsCount += 1;
      entry.inputUncachedTokens += step.input_tokens;
      entry.cacheReadTokens += step.cache_read_tokens;
      entry.outputTokens += step.output_tokens;
      entry.totalTokens += step.input_tokens + step.cache_read_tokens + step.output_tokens;
      entry.costActual += costActual;
    }
  }
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Mtime-cache readRosterSafe(), add O(1) readOwnSwarmCoordinatorInfo(),
// add short-TTL + mtime-validated listAllSwarms() cache, and export
// findSwarmMembership() so full-disk fallback runs only when needed (A1).
// ============================================================================
function readRosterSafe(membersPath) {
  const st = statOf(membersPath);
  if (st.size < 0) {
    rosterFileCache.delete(membersPath);
    return null;
  }
  const key = `${st.mtimeMs}:${st.size}`;
  const hit = rosterFileCache.get(membersPath);
  if (hit && hit.key === key) {
    rosterFileCache.delete(membersPath);
    rosterFileCache.set(membersPath, hit);
    return hit.roster;
  }
  try {
    const raw = JSON.parse(readFileSync(membersPath, 'utf-8'));
    if (!raw || typeof raw !== 'object') return null;
    const members = raw.members && typeof raw.members === 'object' ? raw.members : {};
    const roster = { title: typeof raw.title === 'string' ? raw.title : '', members };
    if (rosterFileCache.size >= MAX_ROSTER_FILE_CACHE) {
      const oldestKey = rosterFileCache.keys().next().value;
      if (oldestKey !== undefined) rosterFileCache.delete(oldestKey);
    }
    rosterFileCache.set(membersPath, { key, roster });
    return roster;
  } catch {
    return null;
  }
}

function readOwnSwarmCoordinatorInfo(convId, appDataDirs) {
  const ownPaths = resolveConversationPaths(convId, appDataDirs);
  if (!ownPaths) return null;
  const ownRoster = readRosterSafe(ownPaths.swarmMembersPath);
  if (!ownRoster) return null;
  return { coordinatorId: convId, roster: ownRoster, isCoordinator: true };
}

function listAllSwarms(appDataDirs) {
  const swarms = [];
  const seen = new Set();
  const nowMs = Date.now();
  for (const appData of appDataDirs || []) {
    const brainDir = join(appData, 'brain');
    const brainStat = statOf(brainDir);
    if (brainStat.size < 0) {
      swarmsListCache.delete(brainDir);
      continue;
    }

    const cached = swarmsListCache.get(brainDir);
    let entries = null;
    if (
      cached &&
      cached.brainMtimeMs === brainStat.mtimeMs &&
      nowMs - cached.fetchedAtMs < SWARM_LIST_CACHE_TTL_MS
    ) {
      let allFresh = true;
      const refreshed = [];
      for (const item of cached.entries) {
        const st = statOf(item.membersPath);
        if (st.size < 0) {
          allFresh = false;
          break;
        }
        const mKey = `${st.mtimeMs}:${st.size}`;
        if (mKey === item.rosterKey) {
          refreshed.push(item);
        } else {
          const updatedRoster = readRosterSafe(item.membersPath);
          if (updatedRoster) {
            refreshed.push({
              coordinatorId: item.coordinatorId,
              appData,
              membersPath: item.membersPath,
              rosterKey: mKey,
              roster: updatedRoster,
            });
          } else {
            allFresh = false;
            break;
          }
        }
      }
      if (allFresh) {
        cached.entries = refreshed;
        entries = refreshed;
      }
    }

    if (!entries) {
      entries = [];
      for (const id of safeReaddir(brainDir)) {
        if (!isValidConversationId(id)) continue;
        const membersPath = join(brainDir, id, '.system_generated', 'swarm', 'members.json');
        const st = statOf(membersPath);
        if (st.size < 0) continue;
        const roster = readRosterSafe(membersPath);
        if (roster) {
          entries.push({
            coordinatorId: id,
            appData,
            membersPath,
            rosterKey: `${st.mtimeMs}:${st.size}`,
            roster,
          });
        }
      }
      swarmsListCache.set(brainDir, {
        brainMtimeMs: brainStat.mtimeMs,
        fetchedAtMs: nowMs,
        entries,
      });
    }

    for (const item of entries) {
      if (seen.has(item.coordinatorId)) continue;
      seen.add(item.coordinatorId);
      swarms.push({
        coordinatorId: item.coordinatorId,
        appData: item.appData,
        roster: item.roster,
      });
    }
  }
  return swarms;
}

export function findSwarmMembership(convId, appDataDirs) {
  const ownCoord = readOwnSwarmCoordinatorInfo(convId, appDataDirs);
  if (ownCoord) {
    return ownCoord;
  }
  for (const s of listAllSwarms(appDataDirs)) {
    for (const [name, member] of Object.entries(s.roster.members)) {
      if (member?.conversation_id === convId) {
        return {
          coordinatorId: s.coordinatorId,
          roster: s.roster,
          isCoordinator: false,
          selfName: name,
          selfMember: member,
        };
      }
    }
  }
  return null;
}
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================

function parseSubagentSpecsFromCall(tc) {
  const args = tc?.args && typeof tc.args === 'object' ? tc.args : {};
  const rawSubs = args.Subagents ?? args.subagents;
  if (rawSubs !== undefined) {
    let parsedSubs = rawSubs;
    if (typeof rawSubs === 'string') {
      try {
        parsedSubs = JSON.parse(rawSubs);
      } catch {
        parsedSubs = null;
      }
    }
    if (Array.isArray(parsedSubs) && parsedSubs.length > 0) {
      return parsedSubs.map((item) => (item && typeof item === 'object' ? item : {}));
    }
  }
  return [args];
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Track subagent spawnOrder, invokedAtMs, and manage_subagents
// kill/kill_all actions; expose Swarm phase/desired_state KILLED & lastSeq;
// add computeChildUpdatedAtMs() and sortChildrenByActivity().
// ============================================================================
function parseManageSubagentsTargetIds(rawIds) {
  if (Array.isArray(rawIds)) {
    return rawIds
      .map((item) => unquote(item).trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof rawIds === 'string' && rawIds.trim()) {
    const trimmed = rawIds.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => unquote(item).trim().toLowerCase())
          .filter(Boolean);
      }
      if (typeof parsed === 'string' && parsed.trim()) {
        return [parsed.trim().toLowerCase()];
      }
    } catch {
      // Fallback to whitespace/comma splitting when rawIds is not JSON.
    }
    return trimmed
      .split(/[\s,]+/)
      .map((item) => unquote(item).trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function extractSubagentCallDescriptors(parsed, modelByStepIdx) {
  const steps = parsed?.steps || [];
  const out = [];
  const spawnedEntries = [];
  const explicitlyKilledIds = new Set();
  let nextSpawnOrder = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== 'PLANNER_RESPONSE') continue;
    const calls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
    const subIndices = [];
    const manageCalls = [];
    for (let c = 0; c < calls.length; c++) {
      if (calls[c]?.name === 'invoke_subagent') subIndices.push(c);
      else if (calls[c]?.name === 'manage_subagents') manageCalls.push(calls[c]);
    }

    if (subIndices.length > 0) {
      const generics = [];
      for (let j = i + 1; j < steps.length; j++) {
        if (steps[j].type === 'PLANNER_RESPONSE' || steps[j].type === 'USER_INPUT') break;
        if (steps[j].type === 'GENERIC') generics.push(steps[j]);
      }

      const rawInvokedMs = step.completedAtMs ?? step.createdAtMs ?? null;
      const invokedAtMs =
        Number.isFinite(rawInvokedMs) &&
        rawInvokedMs >= MIN_VALID_TS_MS &&
        rawInvokedMs <= MAX_VALID_TS_MS
          ? rawInvokedMs
          : null;
      const parentModel = modelByStepIdx.get(step.step_index) || 'Auto';

      for (const callIdx of subIndices) {
        const tc = calls[callIdx];
        const specs = parseSubagentSpecsFromCall(tc);
        const summaryLabel = unquote(tc.args?.toolSummary || tc.args?.toolAction || '').replace(
          /^Spawn\s+/i,
          '',
        );

        const targetGenerics = generics[callIdx] !== undefined ? [generics[callIdx]] : generics;
        const foundIds = [];
        for (const g of targetGenerics) {
          for (const id of g.uuids || []) {
            if (!foundIds.includes(id)) foundIds.push(id);
          }
        }
        if (foundIds.length === 0 && subIndices.length === 1 && targetGenerics !== generics) {
          for (const g of generics) {
            for (const id of g.uuids || []) {
              if (!foundIds.includes(id)) foundIds.push(id);
            }
          }
        }

        foundIds.forEach((childId, idx) => {
          const spec = specs[idx] || specs[0] || {};
          const rawModel = unquote(spec.Model || spec.model || '');
          const resolvedModel =
            !rawModel || rawModel.toLowerCase() === 'inherit'
              ? parentModel
              : normalizeModelId(rawModel);
          const rawName = unquote(spec.Name || spec.SubagentName || spec.Type || spec.name || '');
          const rawRole = unquote(spec.Role || spec.role || spec.Type || '');
          const desc = {
            conversationId: childId,
            kind: 'subagent',
            name: rawName || summaryLabel || childId.slice(0, 8),
            role: rawRole || 'subagent',
            defaultModel: resolvedModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Preserve rawDefaultModel on subagent call descriptors for routed mode.
// ============================================================================
            rawDefaultModel:
              rawModel && rawModel.toLowerCase() !== 'inherit' && !AUTO_UNKNOWN_RE.test(rawModel)
                ? rawModel
                : '',
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
            killed: false,
            spawnOrder: nextSpawnOrder++,
            invokedAtMs,
          };
          out.push(desc);
          spawnedEntries.push({ desc, stepIdx: i });
        });
      }
    }

    for (const tc of manageCalls) {
      const args = tc?.args && typeof tc.args === 'object' ? tc.args : {};
      const action = unquote(args.Action ?? args.action ?? '').trim().toLowerCase();
      if (action === 'kill') {
        const targetIds = parseManageSubagentsTargetIds(
          args.ConversationIds ?? args.conversationIds,
        );
        for (const tid of targetIds) {
          explicitlyKilledIds.add(tid);
        }
        if (targetIds.length > 0) {
          const targetSet = new Set(targetIds);
          for (const entry of spawnedEntries) {
            if (targetSet.has(entry.desc.conversationId.toLowerCase())) {
              entry.desc.killed = true;
            }
          }
        }
      } else if (action === 'kill_all') {
        for (const entry of spawnedEntries) {
          if (entry.stepIdx < i) {
            entry.desc.killed = true;
          }
        }
      }
    }
  }

  if (explicitlyKilledIds.size > 0) {
    for (const desc of out) {
      if (explicitlyKilledIds.has(desc.conversationId.toLowerCase())) {
        desc.killed = true;
      }
    }
  }

  return out;
}
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

/**
 * Discovers subagents and swarm members for a conversation, avoiding cycles.
 */
export function resolveChildrenAndSwarm(convId, parsed, modelByStepIdx, appDataDirs) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Read only convId's own roster for the coordinator check in
// resolveChildrenAndSwarm() instead of triggering full-disk listAllSwarms() (A1).
// ============================================================================
  const swarmInfo = readOwnSwarmCoordinatorInfo(convId, appDataDirs);
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
  const directDescriptors = [];
  const seen = new Set([convId.toLowerCase()]);

  for (const desc of extractSubagentCallDescriptors(parsed, modelByStepIdx)) {
    const key = desc.conversationId.toLowerCase();
    if (!isValidConversationId(desc.conversationId) || seen.has(key)) continue;
    seen.add(key);
    directDescriptors.push(desc);
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Only attach swarm roster members as children of the Swarm
// Coordinator so inspecting an individual Swarm Worker never leaks siblings.
// ============================================================================
  if (swarmInfo?.isCoordinator && swarmInfo?.roster?.members) {
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
    for (const [memberName, member] of Object.entries(swarmInfo.roster.members)) {
      const mId = member?.conversation_id;
      if (!isValidConversationId(mId)) continue;
      const key = mId.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Detect killed Swarm workers via member.killed, phase === 'KILLED',
// or desired_state === 'KILLED', and capture lastSeq and spawnOrder.
// ============================================================================
      const phaseStr = String(member?.phase || '').toUpperCase();
      const desiredStr = String(member?.desired_state || '').toUpperCase();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Preserve rawDefaultModel on swarm member descriptors for routed mode.
// ============================================================================
      const rawMemberModel = String(
        member?.model || member?.applied_model || member?.desired_model || '',
      ).trim();
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
      directDescriptors.push({
        conversationId: mId,
        kind: 'swarm',
        name: memberName,
        role: typeof member?.role === 'string' && member.role ? member.role : 'worker',
        defaultModel: normalizeModelId(rawMemberModel || 'Auto'),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Attach rawDefaultModel on swarm member descriptor.
// ============================================================================
        rawDefaultModel:
          rawMemberModel && !AUTO_UNKNOWN_RE.test(rawMemberModel) ? rawMemberModel : '',
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
        killed: Boolean(member?.killed || phaseStr === 'KILLED' || desiredStr === 'KILLED'),
        lastSeq: Math.max(
          Number(member?.last_read_seq) || 0,
          Number(member?.last_nudged_seq) || 0,
          Number(member?.wait_since) || 0,
        ),
        spawnOrder: directDescriptors.length,
        invokedAtMs: null,
      });
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
    }
  }

  return { swarmInfo, directDescriptors };
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Compute child last-activity timestamp from own non-cloned steps,
// live generatingSinceMs, statMtimeMs, and parent invocation fallback, and sort
// children by live execution tier then most-recent activity.
// ============================================================================
function findLastClonedStepIdx(steps) {
  let lastCloned = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]?.isClonedFromParent) {
      lastCloned = i;
    }
  }
  return lastCloned;
}

function computeChildUpdatedAtMs(childParsed, childLive, isKilled, fallbackMs = null) {
  const childSteps = childParsed?.steps || [];
  const lastClonedIdx = findLastClonedStepIdx(childSteps);
  let maxOwnStepMs = 0;
  for (let i = 0; i < childSteps.length; i++) {
    const s = childSteps[i];
    if (!s || s.isClonedFromParent || i <= lastClonedIdx) continue;
    const candidates = [
      s.completedAtMs,
      s.genericCompletedAtMs,
      s.genericCreatedAtMs,
      s.createdAtMs,
    ];
    for (const ts of candidates) {
      if (Number.isFinite(ts) && ts >= MIN_VALID_TS_MS && ts <= MAX_VALID_TS_MS && ts > maxOwnStepMs) {
        maxOwnStepMs = ts;
      }
    }
  }

  const statMs =
    Number.isFinite(childParsed?.statMtimeMs) &&
    childParsed.statMtimeMs >= MIN_VALID_TS_MS &&
    childParsed.statMtimeMs <= MAX_VALID_TS_MS
      ? childParsed.statMtimeMs
      : 0;
  const genMs =
    !isKilled &&
    Number.isFinite(childLive?.generatingSinceMs) &&
    childLive.generatingSinceMs >= MIN_VALID_TS_MS &&
    childLive.generatingSinceMs <= MAX_VALID_TS_MS
      ? childLive.generatingSinceMs
      : 0;

  if (!isKilled && (childLive?.status === 'GENERATING' || childLive?.status === 'RUNNING_TOOLS')) {
    return Math.max(maxOwnStepMs, genMs, statMs) || null;
  }
  if (maxOwnStepMs > 0) return maxOwnStepMs;
  if (statMs > 0) return statMs;
  return Number.isFinite(fallbackMs) &&
    fallbackMs >= MIN_VALID_TS_MS &&
    fallbackMs <= MAX_VALID_TS_MS
    ? fallbackMs
    : null;
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:33:30
// Description: Add computeChildCreatedAtMs() to resolve earliest valid child
// creation timestamp for round-scoped Pixel Office filtering.
// ============================================================================
function isValidTimestampMs(ms) {
  return Number.isFinite(ms) && ms >= MIN_VALID_TS_MS && ms <= MAX_VALID_TS_MS;
}

function computeChildCreatedAtMs(childParsed, fallbackMs = null, updatedAtMs = null) {
  const candidates = [];
  if (isValidTimestampMs(fallbackMs)) {
    candidates.push(fallbackMs);
  }
  const childSteps = childParsed?.steps || [];
  const lastClonedIdx = findLastClonedStepIdx(childSteps);
  for (let i = 0; i < childSteps.length; i++) {
    const s = childSteps[i];
    if (!s || s.isClonedFromParent || i <= lastClonedIdx) continue;
    if (isValidTimestampMs(s.createdAtMs)) {
      candidates.push(s.createdAtMs);
      break;
    }
  }
  if (isValidTimestampMs(updatedAtMs)) {
    candidates.push(updatedAtMs);
  }
  if (candidates.length === 0) {
    for (const s of childSteps) {
      if (s && isValidTimestampMs(s.createdAtMs)) {
        candidates.push(s.createdAtMs);
        break;
      }
    }
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
}
// ============================================================================
// [MODIFIED END] 2026-11-19 13:33:30
// ============================================================================

function getChildActivityTierRank(ch) {
  if (!ch?.killed && ch?.status === 'GENERATING') return 0;
  if (!ch?.killed && ch?.status === 'RUNNING_TOOLS') return 1;
  return 2;
}

/**
 * Sorts child subagent/swarm entries by live activity tier first, then most recent activity.
 */
export function sortChildrenByActivity(list) {
  if (!Array.isArray(list)) return [];
  const target = Object.isFrozen(list) ? [...list] : list;
  return target.sort((a, b) => {
    const tierDiff = getChildActivityTierRank(a) - getChildActivityTierRank(b);
    if (tierDiff !== 0) return tierDiff;

    const updDiff = (Number(b?.updatedAtMs) || 0) - (Number(a?.updatedAtMs) || 0);
    if (updDiff !== 0) return updDiff;

    const seqDiff = (Number(b?._lastSeq) || 0) - (Number(a?._lastSeq) || 0);
    if (seqDiff !== 0) return seqDiff;

    const spawnDiff = (Number(b?._spawnOrder) || 0) - (Number(a?._spawnOrder) || 0);
    if (spawnDiff !== 0) return spawnDiff;

    const nameCmp = String(a?.name || '').localeCompare(String(b?.name || ''));
    if (nameCmp !== 0) return nameCmp;

    return String(a?.conversationId || '').localeCompare(String(b?.conversationId || ''));
  });
}
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

/**
 * Metadata store backed primarily by local `conversation_summaries.db` (read-only),
 * falling back to non-blocking `agentapi get-conversation-metadata` only when missing from SQLite.
 */
export function createMetadataStore(options = {}) {
  const cache = new Map(); // convId -> { title, workspace, fetchedAt }
  const inFlight = new Set();
  const queue = [];
  let running = 0;
  let version = 0;
  const MAX_CONCURRENCY = 4;
  const TTL_MS = 5 * 60 * 1000;

  function extractFields(stdout) {
    const md = JSON.parse(stdout || '{}');
    const meta = md?.response?.conversationMetadata?.metadata || md?.metadata || md || {};
    const convMeta = md?.response?.conversationMetadata || {};
    const rawTitle =
      md.title ||
      md.summary ||
      md.name ||
      convMeta.title ||
      convMeta.summary ||
      meta.title ||
      md?.conversation?.title ||
      meta?.subagentSpec?.role ||
      meta?.subagentSpec?.typeName ||
      '';
    const wsUri =
      meta?.workspaces?.[0]?.workspaceFolderAbsoluteUri || meta?.workspaceUris?.[0] || '';
    return {
      title: typeof rawTitle === 'string' ? oneLine(rawTitle, 64) : '',
      workspace: parseWorkspaceUri(wsUri),
    };
  }

  function pump() {
    while (running < MAX_CONCURRENCY && queue.length > 0) {
      const convId = queue.shift();
      running += 1;
      const exe = process.env.ANTIGRAVITY_AGENTAPI_EXE;
      const file = exe || 'agentapi';
      const args = [...(exe ? ['agentapi'] : []), 'get-conversation-metadata', convId];
      execFile(file, args, { encoding: 'utf-8', timeout: 2000 }, (err, stdout) => {
        running -= 1;
        inFlight.delete(convId);
        let entry = { title: '', workspace: '', fetchedAt: Date.now() };
        if (!err && stdout) {
          try {
            entry = { ...extractFields(stdout), fetchedAt: Date.now() };
          } catch {
            // Keep empty fallback on invalid JSON.
          }
        }
        const prev = cache.get(convId);
        cache.set(convId, entry);
        if (!prev || prev.title !== entry.title || prev.workspace !== entry.workspace) {
          version += 1;
        }
        pump();
      });
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Skip agentapi execFile fallback when hasFallback is true and
// conversation metadata is missing from conversation_summaries.db.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Accept optional pre-fetched summariesMap in metadataStore.get()
// so summarizeGlobalAndRecent/buildPeriodSummary reuse one cached map (A2).
// ============================================================================
  function get(convId, { schedule = true, hasFallback = false, appDataDirs, summariesMap } = {}) {
    if (!isValidConversationId(convId)) return { title: '', workspace: '' };
    const summaries =
      summariesMap || readConversationSummariesMap(appDataDirs || discoverAppDataDirs(options));
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
    if (summaries.has(convId)) {
      const s = summaries.get(convId);
      return {
        title: s.title || '',
        workspace: s.workspace || '',
        agentName: s.agentName || '',
        preview: s.preview || '',
      };
    }

    const hit = cache.get(convId);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
      return hit;
    }
    if (hasFallback) {
      return hit || { title: '', workspace: '' };
    }
    if (schedule && !options.disableAgentApi && !inFlight.has(convId)) {
      inFlight.add(convId);
      queue.push(convId);
      pump();
    }
    return hit || { title: '', workspace: '' };
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

  return {
    get,
    getVersion: () => version,
  };
}

function buildConversationTitle({
  convId,
  metaTitle,
  swarmInfo,
  hintName,
  metaAgentName,
  metaPreview,
  parsed,
}) {
  if (metaTitle) return metaTitle;
  if (swarmInfo) {
    if (swarmInfo.isCoordinator && swarmInfo.roster?.title) {
      return swarmInfo.roster.title;
    }
    if (!swarmInfo.isCoordinator && swarmInfo.selfName) {
      const st = swarmInfo.roster?.title;
      return st ? `${swarmInfo.selfName} · ${st}` : swarmInfo.selfName;
    }
  }
  if (hintName) return hintName;
  if (metaAgentName) return metaAgentName;
  if (parsed?.firstUserPrompt) return parsed.firstUserPrompt;
  if (metaPreview) return metaPreview;
  return convId.slice(0, 8);
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Check subagentDescCache first in O(1), avoid redundant disk reads
// via transcriptInvokeScanCache, and attach parentConversationId on matched hints.
// ============================================================================
function findSubagentParentHint(convId, appDataDirs, visited = new Set()) {
  const targetLower = convId.toLowerCase();
  if (visited.has(targetLower)) return null;
  visited.add(targetLower);

  // Fast pass through already-cached subagent descriptor index first.
  for (const [parentId, cached] of subagentDescCache) {
    if (!parentId || parentId.toLowerCase() === targetLower) continue;
    const match = cached?.descriptors?.find(
      (d) => typeof d?.conversationId === 'string' && d.conversationId.toLowerCase() === targetLower,
    );
    if (match) {
      return { ...match, parentConversationId: parentId };
    }
  }

  // Fast pass through already-cached transcripts.
  for (const [, hit] of transcriptCache) {
    const parsed = hit?.parsed;
    if (!parsed || parsed.convId.toLowerCase() === targetLower) continue;
    const { modelByStepIdx } = resolveModelTimeline(parsed, 'Auto');
    const descs = extractSubagentCallDescriptors(parsed, modelByStepIdx);
    const match = descs.find((d) => d.conversationId.toLowerCase() === targetLower);
    if (match) {
      if (match.defaultModel === 'Auto') {
        const parentHint = findSubagentParentHint(parsed.convId, appDataDirs, visited);
        if (parentHint?.defaultModel) {
          const parentTimeline = resolveModelTimeline(parsed, parentHint.defaultModel);
          const reMatched = extractSubagentCallDescriptors(
            parsed,
            parentTimeline.modelByStepIdx,
          ).find((d) => d.conversationId.toLowerCase() === targetLower);
          if (reMatched) return { ...reMatched, parentConversationId: parsed.convId };
        }
      }
      return { ...match, parentConversationId: parsed.convId };
    }
  }

  const isUuid36 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    targetLower,
  );

  // Fallback scan on brain transcripts containing the child UUID.
  for (const appData of appDataDirs) {
    const brainDir = join(appData, 'brain');
    for (const candidateId of safeReaddir(brainDir)) {
      if (!isValidConversationId(candidateId) || candidateId.toLowerCase() === targetLower) {
        continue;
      }
      const paths = resolveConversationPaths(candidateId, [appData]);
      if (!paths) continue;
      const tStat = statOf(paths.transcriptPath);
      if (tStat.size < 0) continue;
      const tKey = `${tStat.mtimeMs}:${tStat.size}`;
      const cacheId = paths.dbPath || paths.transcriptPath;
      const tHit = transcriptCache.get(cacheId);
      if (tHit && tHit.parsed && tHit.tKey === tKey) {
        // Already checked in the transcriptCache pass above.
        continue;
      }

      const scanHit = transcriptInvokeScanCache.get(paths.transcriptPath);
      if (scanHit && scanHit.tKey === tKey) {
        if (!scanHit.hasInvokeSubagent) continue;
        if (isUuid36 && scanHit.uuidsLower && !scanHit.uuidsLower.has(targetLower)) continue;
      } else {
        let rawText = '';
        try {
          rawText = readFileSync(paths.transcriptPath, 'utf-8');
        } catch {
          continue;
        }
        const hasInvokeSubagent = rawText.includes('invoke_subagent');
        const uuidsLower = hasInvokeSubagent
          ? new Set((rawText.match(UUID_RE) || []).map((u) => u.toLowerCase()))
          : null;
        setTranscriptInvokeScanCache(paths.transcriptPath, {
          tKey,
          hasInvokeSubagent,
          uuidsLower,
        });
        if (!hasInvokeSubagent || !rawText.toLowerCase().includes(targetLower)) continue;
      }

      const parentParsed = parseTranscript(candidateId, paths);
      if (!parentParsed) continue;
      const { modelByStepIdx } = resolveModelTimeline(parentParsed, 'Auto');
      const descs = extractSubagentCallDescriptors(parentParsed, modelByStepIdx);
      const match = descs.find((d) => d.conversationId.toLowerCase() === targetLower);
      if (match) {
        if (match.defaultModel === 'Auto') {
          const parentHint = findSubagentParentHint(candidateId, appDataDirs, visited);
          if (parentHint?.defaultModel) {
            const parentTimeline = resolveModelTimeline(parentParsed, parentHint.defaultModel);
            const reMatched = extractSubagentCallDescriptors(
              parentParsed,
              parentTimeline.modelByStepIdx,
            ).find((d) => d.conversationId.toLowerCase() === targetLower);
            if (reMatched) return { ...reMatched, parentConversationId: candidateId };
          }
        }
        return { ...match, parentConversationId: candidateId };
      }
    }
  }
  return null;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Add computeMergedActiveDurationMs() and receipt accumulation/
// finalization helpers for Today and All-Time session checkout receipts.
// ============================================================================
/**
 * Merges overlapping or nearby timestamp intervals (gap <= maxGapMs) into total active ms.
 */
export function computeMergedActiveDurationMs(intervals, maxGapMs = 30 * 60 * 1000) {
  if (!Array.isArray(intervals) || intervals.length === 0) return 0;
  const gapLimit =
    Number.isFinite(Number(maxGapMs)) && Number(maxGapMs) >= 0
      ? Number(maxGapMs)
      : 30 * 60 * 1000;
  const valid = [];
  for (const item of intervals) {
    const rawStart = Array.isArray(item) ? item[0] : item?.start;
    const rawEnd = Array.isArray(item) ? item[1] : item?.end;
    const s = Number(rawStart);
    if (!Number.isFinite(s) || s < MIN_VALID_TS_MS || s > MAX_VALID_TS_MS) continue;
    const rawE = Number(rawEnd);
    const e = Number.isFinite(rawE) && rawE >= s && rawE <= MAX_VALID_TS_MS ? rawE : s;
    valid.push([s, e]);
  }
  if (valid.length === 0) return 0;

  valid.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let totalMs = 0;
  let curS = valid[0][0];
  let curE = valid[0][1];
  for (let i = 1; i < valid.length; i++) {
    const [s, e] = valid[i];
    if (s - curE <= gapLimit) {
      if (e > curE) curE = e;
    } else {
      totalMs += curE - curS;
      curS = s;
      curE = e;
    }
  }
  totalMs += curE - curS;
  return Math.max(0, totalMs);
}

function createReceiptScopeState() {
  return {
    seenBotIds: new Set(),
    intervals: [],
    compactionsCount: 0,
    main: emptyBucket(),
    childrenById: new Map(), // convIdLower -> { meta, bucket }
    byModelMap: new Map(),
  };
}

function addStepIntoReceiptState(state, step, model, pricing, stepCost, childMeta) {
  if (step.botId) {
    if (state.seenBotIds.has(step.botId)) return;
    state.seenBotIds.add(step.botId);
  }

  let targetBucket = state.main;
  if (childMeta) {
    const childKey = childMeta.conversationId.toLowerCase();
    let childEntry = state.childrenById.get(childKey);
    if (!childEntry) {
      childEntry = {
        meta: {
          conversationId: childMeta.conversationId,
          kind: childMeta.kind,
          name: childMeta.name,
          role: childMeta.role,
          model: childMeta.model,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Preserve rawModel and modelLabel on receipt child metadata.
// ============================================================================
          rawModel: childMeta.rawModel || childMeta.model,
          modelLabel: childMeta.modelLabel || '',
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
        },
        bucket: emptyBucket(),
      };
      state.childrenById.set(childKey, childEntry);
    }
    targetBucket = childEntry.bucket;
  }

  const inTok = Number(step.input_tokens) || 0;
  const cacheTok = Number(step.cache_read_tokens) || 0;
  const outTok = Number(step.output_tokens) || 0;

  targetBucket.stepsCount += 1;
  targetBucket.inputUncachedTokens += inTok;
  targetBucket.cacheReadTokens += cacheTok;
  targetBucket.outputTokens += outTok;
  targetBucket.costActual += stepCost.costActual;
  targetBucket.costUncachedBaseline += stepCost.costUncachedBaseline;
  targetBucket.costSavedByCache += stepCost.costSavedByCache;

  let modelEntry = state.byModelMap.get(model);
  if (!modelEntry) {
    modelEntry = {
      model,
      profileId: pricing.profileId,
      profileLabel: pricing.profileLabel,
      totalTokens: 0,
      costActual: 0,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Track per-raw-slug usage inside receipt byModelMap entries so
// receipt.{today,all}.primaryModel exposes the exact routed rawModel slug.
// ============================================================================
      rawMap: new Map(),
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
    };
    state.byModelMap.set(model, modelEntry);
  }
  modelEntry.totalTokens += inTok + cacheTok + outTok;
  modelEntry.costActual += stepCost.costActual;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Accumulate routed rawSlug tokens and cost on receipt modelEntry.
// ============================================================================
  const rawCandidate = typeof step?.rawDbModel === 'string' ? step.rawDbModel.trim() : '';
  const rawSlug = rawCandidate && !AUTO_UNKNOWN_RE.test(rawCandidate) ? rawCandidate : model;
  const rawKey = rawSlug.toLowerCase();
  let rawEntry = modelEntry.rawMap.get(rawKey);
  if (!rawEntry) {
    rawEntry = {
      rawModel: rawSlug,
      totalTokens: 0,
      costActual: 0,
    };
    modelEntry.rawMap.set(rawKey, rawEntry);
  }
  rawEntry.totalTokens += inTok + cacheTok + outTok;
  rawEntry.costActual += stepCost.costActual;
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
}

function addBucketInto(dst, src) {
  dst.stepsCount += src.stepsCount || 0;
  dst.inputUncachedTokens += src.inputUncachedTokens || 0;
  dst.cacheReadTokens += src.cacheReadTokens || 0;
  dst.outputTokens += src.outputTokens || 0;
  dst.costActual += src.costActual || 0;
  dst.costUncachedBaseline += src.costUncachedBaseline || 0;
  dst.costSavedByCache += src.costSavedByCache || 0;
}

function accumulateReceiptConversation(
  convParsed,
  convModelMap,
  prefs,
  todayDate,
  todayStartMs,
  todayEndMs,
  allState,
  todayState,
  childMeta = null,
) {
  const steps = convParsed?.steps || [];
  if (steps.length === 0) return;

  const lastClonedIdx = findLastClonedStepIdx(steps);
  const fallbackConvMs =
    Number.isFinite(convParsed?.statMtimeMs) &&
    convParsed.statMtimeMs >= MIN_VALID_TS_MS &&
    convParsed.statMtimeMs <= MAX_VALID_TS_MS
      ? convParsed.statMtimeMs
      : null;

  let hasAnyDatedBillable = false;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || s.isClonedFromParent || i <= lastClonedIdx) continue;
    if (
      isBillableTokenStep(s) &&
      Number.isFinite(s.createdAtMs) &&
      s.createdAtMs >= MIN_VALID_TS_MS &&
      s.createdAtMs <= MAX_VALID_TS_MS
    ) {
      hasAnyDatedBillable = true;
      break;
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step || step.isClonedFromParent || i <= lastClonedIdx) continue;

    const rawStart = step.createdAtMs ?? step.genericCreatedAtMs ?? null;
    if (
      Number.isFinite(rawStart) &&
      rawStart >= MIN_VALID_TS_MS &&
      rawStart <= MAX_VALID_TS_MS
    ) {
      const tStart = rawStart;
      const tEndCandidate =
        step.completedAtMs ?? step.genericCompletedAtMs ?? step.genericCreatedAtMs ?? tStart;
      const tEnd =
        Number.isFinite(tEndCandidate) &&
        tEndCandidate >= tStart &&
        tEndCandidate <= MAX_VALID_TS_MS
          ? tEndCandidate
          : tStart;

      allState.intervals.push([tStart, tEnd]);

      const startIsToday = formatLocalDate(tStart) === todayDate;
      const endIsToday = tEnd !== tStart ? formatLocalDate(tEnd) === todayDate : startIsToday;
      if (startIsToday) {
        const clampedEnd = Math.min(tEnd, todayEndMs);
        todayState.intervals.push([tStart, Math.max(tStart, clampedEnd)]);
      } else if (endIsToday) {
        const clampedStart = Math.max(tStart, todayStartMs);
        todayState.intervals.push([clampedStart, Math.max(clampedStart, tEnd)]);
      }
    }

    if (!childMeta && step.type === 'COMPACTION_SUMMARY' && step.status === 'DONE') {
      allState.compactionsCount += 1;
      const compMs =
        Number.isFinite(step.createdAtMs) &&
        step.createdAtMs >= MIN_VALID_TS_MS &&
        step.createdAtMs <= MAX_VALID_TS_MS
          ? step.createdAtMs
          : !hasAnyDatedBillable
            ? fallbackConvMs
            : null;
      if (compMs !== null && formatLocalDate(compMs) === todayDate) {
        todayState.compactionsCount += 1;
      }
    }

    if (!isBillableTokenStep(step)) continue;

    const model = normalizeModelId(step.dbModel || convModelMap?.get?.(step.step_index) || 'Auto');
    const pricing = resolveModelPricing(model, prefs);
    const stepCost = computeStepCost(step, prefs, model);
    const stepMs =
      Number.isFinite(step.createdAtMs) &&
      step.createdAtMs >= MIN_VALID_TS_MS &&
      step.createdAtMs <= MAX_VALID_TS_MS
        ? step.createdAtMs
        : !hasAnyDatedBillable
          ? fallbackConvMs
          : null;
    const isTodayStep = stepMs !== null && formatLocalDate(stepMs) === todayDate;

    addStepIntoReceiptState(allState, step, model, pricing, stepCost, childMeta);
    if (isTodayStep) {
      addStepIntoReceiptState(todayState, step, model, pricing, stepCost, childMeta);
    }
  }
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Accept activeRawModel fallback in finalizeReceiptScope() and
// expose primaryModel.rawModel for v0.5.4 routed model name display on receipts.
// ============================================================================
function finalizeReceiptScope(
  scope,
  state,
  todayDate,
  activeModel,
  effectivePrefs,
  totalChildrenCount,
  activeRawModel = '',
) {
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
  let startedAtMs = null;
  let endedAtMs = null;
  for (let i = 0; i < state.intervals.length; i++) {
    const [s, e] = state.intervals[i];
    if (startedAtMs === null || s < startedAtMs) startedAtMs = s;
    if (endedAtMs === null || e > endedAtMs) endedAtMs = e;
  }

  const main = finalizeBucket(state.main);
  const activeChildrenList = [];
  for (const { meta, bucket } of state.childrenById.values()) {
    finalizeBucket(bucket);
    if (bucket.stepsCount > 0 || bucket.totalTokens > 0 || bucket.costActual > 0) {
      activeChildrenList.push({
        ...meta,
        ...bucket,
      });
    }
  }
  activeChildrenList.sort(
    (a, b) =>
      b.costActual - a.costActual ||
      b.totalTokens - a.totalTokens ||
      String(a.name || '').localeCompare(String(b.name || '')) ||
      String(a.conversationId || '').localeCompare(String(b.conversationId || '')),
  );

  const childrenSubtotal = emptyBucket();
  for (const ch of activeChildrenList) {
    addBucketInto(childrenSubtotal, ch);
  }
  finalizeBucket(childrenSubtotal);

  const grandTotal = emptyBucket();
  addBucketInto(grandTotal, main);
  addBucketInto(grandTotal, childrenSubtotal);
  finalizeBucket(grandTotal);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Populate primaryModel.rawModel from top raw slug in scope
// (with activeRawModel fallback) for routed receipt rendering.
// ============================================================================
  const cleanActiveRaw =
    typeof activeRawModel === 'string' &&
    activeRawModel.trim() &&
    !AUTO_UNKNOWN_RE.test(activeRawModel.trim())
      ? activeRawModel.trim()
      : '';
  let primaryModel = null;
  if (state.byModelMap.size > 0) {
    const sortedModels = [...state.byModelMap.values()].sort(
      (a, b) =>
        b.costActual - a.costActual ||
        b.totalTokens - a.totalTokens ||
        String(a.model || '').localeCompare(String(b.model || '')),
    );
    const top = sortedModels[0];
    let topRawModel = '';
    if (top.rawMap && top.rawMap.size > 0) {
      const sortedRaws = [...top.rawMap.values()].sort(
        (a, b) =>
          b.costActual - a.costActual ||
          b.totalTokens - a.totalTokens ||
          String(a.rawModel || '').localeCompare(String(b.rawModel || '')),
      );
      topRawModel = sortedRaws[0]?.rawModel || '';
    }
    primaryModel = {
      model: top.model,
      rawModel: topRawModel || cleanActiveRaw || top.model,
      profileId: top.profileId,
      profileLabel: top.profileLabel,
    };
  } else {
    const fallbackModel = normalizeModelId(activeModel || 'Auto');
    const fallbackPricing = resolveModelPricing(fallbackModel, effectivePrefs);
    primaryModel = {
      model: fallbackModel,
      rawModel: cleanActiveRaw || fallbackModel,
      profileId: fallbackPricing.profileId,
      profileLabel: fallbackPricing.profileLabel,
    };
  }
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================

  return {
    scope,
    hasData: grandTotal.stepsCount > 0 || grandTotal.totalTokens > 0,
    startDate: startedAtMs ? formatLocalDate(startedAtMs) : todayDate,
    endDate: endedAtMs
      ? formatLocalDate(endedAtMs)
      : startedAtMs
        ? formatLocalDate(startedAtMs)
        : todayDate,
    startedAtMs,
    endedAtMs,
    activeDurationMs: computeMergedActiveDurationMs(state.intervals, 30 * 60 * 1000),
    compactionsCount: state.compactionsCount,
    primaryModel,
    subagentsCount: scope === 'today' ? activeChildrenList.length : totalChildrenCount,
    main,
    children: activeChildrenList,
    childrenSubtotal,
    grandTotal,
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Add resolveSideQuestions() to discover linked Side Questions,
// compute fork-deduplicated incremental usage without mutating parent totals,
// sort by live activity, and compute sideQuestionsTotals and ETag parts.
// ============================================================================
function resolveSideQuestions({
  convId,
  summariesBundle,
  children,
  mainSeenBotIds,
  appDataDirs,
  effectivePrefs,
  resolveLabel,
}) {
  const emptyTotals = {
    count: 0,
    stepsCount: 0,
    inputUncachedTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheHitRatePct: 0,
    costActual: 0,
  };
  const linked = summariesBundle?.sideQuestionsByParent?.get(convId);
  if (!Array.isArray(linked) || linked.length === 0) {
    return { sideQuestions: [], sideQuestionsTotals: emptyTotals, sqEtagParts: [] };
  }

  const convIdLower = convId.toLowerCase();
  const childIdsLower = new Set(
    (children || [])
      .map((c) => (typeof c?.conversationId === 'string' ? c.conversationId.toLowerCase() : ''))
      .filter(Boolean),
  );
  const seenSqLower = new Set();
  const sideQuestions = [];
  const sqEtagParts = [];
  const sqTotBucket = emptyBucket();

  for (const sqMeta of linked) {
    const sqId = typeof sqMeta?.conversationId === 'string' ? sqMeta.conversationId.trim() : '';
    if (!isValidConversationId(sqId)) continue;
    const sqLower = sqId.toLowerCase();
    if (sqLower === convIdLower || childIdsLower.has(sqLower) || seenSqLower.has(sqLower)) {
      continue;
    }
    seenSqLower.add(sqLower);

    const sqPaths = resolveConversationPaths(sqId, appDataDirs);
    if (!sqPaths) continue;
    const sqParsed = parseTranscript(sqId, sqPaths);
    if (!sqParsed) continue;

    const sqTimeline = resolveModelTimeline(sqParsed, 'Auto');
    const sqLive = computeLiveStatus(sqParsed);

    const sqBucket = emptyBucket();
    const sqSeenBotIds = new Set(mainSeenBotIds);
    accumulateStepsInto(
      sqBucket,
      null,
      null,
      sqParsed,
      sqTimeline.modelByStepIdx,
      effectivePrefs,
      sqSeenBotIds,
    );
    finalizeBucket(sqBucket);
    addBucketInto(sqTotBucket, sqBucket);

    const sqSteps = sqParsed.steps || [];
    let lastClonedIdx = findLastClonedStepIdx(sqSteps);
    for (let i = 0; i < sqSteps.length; i++) {
      const s = sqSteps[i];
      if (s?.botId && mainSeenBotIds.has(s.botId) && i > lastClonedIdx) {
        lastClonedIdx = i;
      }
    }

    let sqCreatedAtMs = null;
    let sqUpdatedAtMs = null;
    for (let i = lastClonedIdx + 1; i < sqSteps.length; i++) {
      const s = sqSteps[i];
      if (!s || s.isClonedFromParent) continue;
      if (sqCreatedAtMs === null && isValidTimestampMs(s.createdAtMs)) {
        sqCreatedAtMs = s.createdAtMs;
      }
      const ts = isValidTimestampMs(s.completedAtMs)
        ? s.completedAtMs
        : isValidTimestampMs(s.genericCompletedAtMs)
          ? s.genericCompletedAtMs
          : isValidTimestampMs(s.createdAtMs)
            ? s.createdAtMs
            : isValidTimestampMs(s.genericCreatedAtMs)
              ? s.genericCreatedAtMs
              : null;
      if (ts !== null && (sqUpdatedAtMs === null || ts > sqUpdatedAtMs)) {
        sqUpdatedAtMs = ts;
      }
    }
    const fallbackStatMs = isValidTimestampMs(sqParsed.statMtimeMs)
      ? sqParsed.statMtimeMs
      : isValidTimestampMs(sqParsed.mtimeMs)
        ? sqParsed.mtimeMs
        : null;
    if (sqUpdatedAtMs === null) {
      sqUpdatedAtMs = fallbackStatMs;
    }
    if (sqCreatedAtMs === null) {
      sqCreatedAtMs = sqUpdatedAtMs;
    }

    const sqSummaryMeta = summariesBundle?.byConvId?.get(sqId);
    const officialTitle = typeof sqMeta.title === 'string' ? sqMeta.title.trim() : '';
    const title =
      officialTitle ||
      buildConversationTitle({
        convId: sqId,
        metaTitle: sqSummaryMeta?.title || '',
        metaPreview: sqSummaryMeta?.preview || '',
        parsed: sqParsed,
      });

    sqEtagParts.push(`${sqId}:${sqParsed.cacheKey}`);
    if (officialTitle) {
      sqEtagParts.push(`t:${officialTitle}`);
    }

    sideQuestions.push({
      conversationId: sqId,
      title,
      model: resolveLabel(sqTimeline.activeModel, sqTimeline.activeRawModel),
      rawModel: sqTimeline.activeRawModel || sqTimeline.activeModel,
      status: sqLive.status,
      generatingSinceMs: sqLive.generatingSinceMs,
      stepsCount: sqBucket.stepsCount,
      inputUncachedTokens: sqBucket.inputUncachedTokens,
      cacheReadTokens: sqBucket.cacheReadTokens,
      outputTokens: sqBucket.outputTokens,
      totalTokens: sqBucket.totalTokens,
      cacheHitRatePct: sqBucket.cacheHitRatePct,
      costActual: sqBucket.costActual,
      updatedAtMs: sqUpdatedAtMs,
      createdAtMs: sqCreatedAtMs,
    });
  }

  const getSqTier = (item) =>
    item.status === 'GENERATING' ? 0 : item.status === 'RUNNING_TOOLS' ? 1 : 2;
  sideQuestions.sort((a, b) => {
    const tierDiff = getSqTier(a) - getSqTier(b);
    if (tierDiff !== 0) return tierDiff;
    const updDiff = (Number(b.updatedAtMs) || 0) - (Number(a.updatedAtMs) || 0);
    if (updDiff !== 0) return updDiff;
    const createdDiff = (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0);
    if (createdDiff !== 0) return createdDiff;
    return String(a.conversationId || '').localeCompare(String(b.conversationId || ''));
  });

  finalizeBucket(sqTotBucket);
  const sideQuestionsTotals = {
    count: sideQuestions.length,
    stepsCount: sqTotBucket.stepsCount,
    inputUncachedTokens: sqTotBucket.inputUncachedTokens,
    cacheReadTokens: sqTotBucket.cacheReadTokens,
    outputTokens: sqTotBucket.outputTokens,
    totalTokens: sqTotBucket.totalTokens,
    cacheHitRatePct: sqTotBucket.cacheHitRatePct,
    costActual: sqTotBucket.costActual,
  };

  return { sideQuestions, sideQuestionsTotals, sqEtagParts };
}
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================

/**
 * Analyzes a conversation and its subagent/swarm descendants cleanly without cycles.
 */
export function analyzeConversation(convId, options = {}) {
  if (!isValidConversationId(convId)) return null;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:40:00
// Description: Attach optional runtimeCatalog via shallow effectivePrefs copy
// in analyzeConversation without mutating caller's prefs.
// ============================================================================
  const prefs = { ...DEFAULT_PREFS, ...(options.prefs || {}) };
  const runtimeCatalog =
    Array.isArray(options?.runtimeCatalog) && options.runtimeCatalog.length > 0
      ? options.runtimeCatalog
      : null;
  const effectivePrefs = runtimeCatalog ? { ...prefs, _runtimeCatalog: runtimeCatalog } : prefs;
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:00
// Description: Add resolveLabel() helper to map normalized model IDs to
// canonical profile labels via runtimeCatalog.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Delegate resolveLabel() to shared resolveCanonicalModelLabel().
// ============================================================================
  const resolveLabel = (modelId, rawSlug = '') =>
    resolveCanonicalModelLabel(modelId, rawSlug, runtimeCatalog);
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:00
// ============================================================================
  const appDataDirs = discoverAppDataDirs(options);
  const paths = resolveConversationPaths(convId, appDataDirs);
  if (!paths) return null;

  const parsed = parseTranscript(convId, paths);
  if (!parsed) return null;

  const swarmInfo = findSwarmMembership(convId, appDataDirs);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Read conversation_summaries.db once early to resolve
// isSwarmWorker and summaryParentId alongside subagent parent discovery.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Read cached conversation_summaries bundle (including Side
// Questions parent/child maps) once early in analyzeConversation().
// ============================================================================
  const summariesBundle = readConversationSummariesBundle(appDataDirs);
  const summaries = summariesBundle.byConvId;
  const sumMeta = summaries.get(convId);
  const sqParentMeta = summariesBundle.sideQuestionParentById.get(convId) || null;
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================
  const isSwarmWorker = Boolean(swarmInfo && !swarmInfo.isCoordinator);
  const summaryParentId =
    typeof sumMeta?.parentConversationId === 'string' &&
    isValidConversationId(sumMeta.parentConversationId)
      ? sumMeta.parentConversationId
      : '';
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
  let defaultModel = normalizeModelId(options.defaultModel || 'Auto');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Track rawDefaultModel alongside normalized defaultModel so
// conversations without DB steps yet retain exact routed fallback slug.
// ============================================================================
  let rawDefaultModel =
    typeof options.defaultModel === 'string' &&
    options.defaultModel.trim() &&
    !AUTO_UNKNOWN_RE.test(options.defaultModel.trim())
      ? options.defaultModel.trim()
      : '';
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
  let subagentHint = null;
  if (defaultModel === 'Auto' && swarmInfo && !swarmInfo.isCoordinator && swarmInfo.selfMember) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Capture raw swarm selfMember model before normalization.
// ============================================================================
    const rawSelfModel = String(
      swarmInfo.selfMember.model ||
        swarmInfo.selfMember.applied_model ||
        swarmInfo.selfMember.desired_model ||
        '',
    ).trim();
    if (rawSelfModel && !AUTO_UNKNOWN_RE.test(rawSelfModel)) {
      rawDefaultModel = rawSelfModel;
    }
    defaultModel = normalizeModelId(rawSelfModel || 'Auto');
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
  }
  if (defaultModel === 'Auto' && !swarmInfo && !parsed.hasDbTelemetry) {
    subagentHint = findSubagentParentHint(convId, appDataDirs);
    if (subagentHint?.defaultModel) {
      defaultModel = normalizeModelId(subagentHint.defaultModel);
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:05
// Description: Capture activeRawModel from resolveModelTimeline().
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Pass rawDefaultModel when present into resolveModelTimeline().
// ============================================================================
  const { activeModel, activeRawModel, modelByStepIdx } = resolveModelTimeline(
    parsed,
    rawDefaultModel || defaultModel,
  );
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:05
// ============================================================================
  const live = computeLiveStatus(parsed);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Pass activeModel to computeSpeed in analyzeConversation.
// ============================================================================
  const speed = computeSpeed(parsed, convId, modelByStepIdx, options.timingStore, activeModel);
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================
  const context = computeContext(parsed, effectivePrefs);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Track seenBotIds across mainOnly, childBucket, and withChildren
// accumulation so forked descendants never double-count any LLM API call.
// ============================================================================
  const mainOnly = emptyBucket();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Accumulate isolated mainOnlyByModelMap alongside mainOnly.
// ============================================================================
  const mainOnlyByModelMap = new Map();
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
  const withChildren = emptyBucket();
  const byModelMap = new Map();
  const localObservedProfiles = new Set([resolveModelProfile(activeModel, runtimeCatalog).id]);
  const mainSeenBotIds = new Set();
  const withChildrenSeenBotIds = new Set();

  accumulateStepsInto(
    mainOnly,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Populate mainOnlyByModelMap from main conversation's own steps.
// ============================================================================
    mainOnlyByModelMap,
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
    localObservedProfiles,
    parsed,
    modelByStepIdx,
    effectivePrefs,
    mainSeenBotIds,
  );
  accumulateStepsInto(
    withChildren,
    byModelMap,
    localObservedProfiles,
    parsed,
    modelByStepIdx,
    effectivePrefs,
    withChildrenSeenBotIds,
  );
  finalizeBucket(mainOnly);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Initialize Today and All-Time receipt scope states and accumulate
// main conversation steps with exact botId fork-deduplication.
// ============================================================================
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const todayDate = formatLocalDate(nowMs);
  const { y: ty, m: tm, d: td } = parseLocalDateParts(todayDate);
  const todayStartMs = new Date(ty, tm - 1, td, 0, 0, 0, 0).getTime();
  const todayEndMs = new Date(ty, tm - 1, td, 23, 59, 59, 999).getTime();
  const allReceiptState = createReceiptScopeState();
  const todayReceiptState = createReceiptScopeState();
  accumulateReceiptConversation(
    parsed,
    modelByStepIdx,
    effectivePrefs,
    todayDate,
    todayStartMs,
    todayEndMs,
    allReceiptState,
    todayReceiptState,
    null,
  );
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

  const children = [];
  const childEtagParts = [];
  const visited = new Set([convId.toLowerCase()]);

  function collectDescendants(parentParsed, parentModelMap, depth) {
    if (depth > 4) return;
    const { directDescriptors } = resolveChildrenAndSwarm(
      parentParsed.convId,
      parentParsed,
      parentModelMap,
      appDataDirs,
    );
    for (const desc of directDescriptors) {
      const key = desc.conversationId.toLowerCase();
      if (visited.has(key)) continue;
      visited.add(key);

      const childPaths = resolveConversationPaths(desc.conversationId, appDataDirs);
      const childParsed = childPaths ? parseTranscript(desc.conversationId, childPaths) : null;
      if (!childParsed) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Include missing-child killed state in childEtagParts and attach
// killed, updatedAtMs, and temporary sort keys on missing-transcript children.
// ============================================================================
        const isMissingKilled = Boolean(desc.killed);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:15
// Description: Expose rawModel, modelLabel, and createdAtMs on missing-transcript
// child entries for Scheme A attribution and round-scoped Pixel Office filtering.
// ============================================================================
        const missingModel = normalizeModelId(desc.defaultModel || 'Auto');
        const missingRawModel =
          (typeof desc.rawDefaultModel === 'string' && desc.rawDefaultModel.trim()) ||
          missingModel ||
          'Auto';
        const missingUpdatedAtMs = computeChildUpdatedAtMs(
          null,
          null,
          isMissingKilled,
          desc.invokedAtMs,
        );
        const missingCreatedAtMs = computeChildCreatedAtMs(
          null,
          desc.invokedAtMs,
          missingUpdatedAtMs,
        );
        childEtagParts.push(`${desc.conversationId}:missing:${isMissingKilled ? 1 : 0}`);
        children.push({
          conversationId: desc.conversationId,
          kind: desc.kind,
          name: desc.name,
          role: desc.role,
          model: missingModel,
          rawModel: missingRawModel,
          modelLabel: resolveLabel(missingModel, missingRawModel),
          status: 'IDLE',
          killed: isMissingKilled,
          createdAtMs: missingCreatedAtMs,
          updatedAtMs: missingUpdatedAtMs,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:15
// ============================================================================
          generatingSinceMs: null,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Include empty activeToolLabel on missing-transcript child entries.
// ============================================================================
          activeToolLabel: '',
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
          contextTotal: 0,
          latestTokPerSec: null,
          outputTokens: 0,
          costActual: 0,
          _lastSeq: desc.lastSeq || 0,
          _spawnOrder: desc.spawnOrder ?? 0,
        });
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
        continue;
      }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Include child killed state in childEtagParts so killing a worker
// or subagent immediately invalidates the /api/snapshot ETag.
// ============================================================================
      const isChildKilled = Boolean(desc.killed);
      childEtagParts.push(`${desc.conversationId}:${childParsed.cacheKey}:${isChildKilled ? 1 : 0}`);
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Pass desc.rawDefaultModel into child resolveModelTimeline() so
// freshly spawned children without DB steps preserve exact routed fallback slug.
// ============================================================================
      const childTimeline = resolveModelTimeline(
        childParsed,
        desc.rawDefaultModel || desc.defaultModel || 'Auto',
      );
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
      localObservedProfiles.add(resolveModelProfile(childTimeline.activeModel, runtimeCatalog).id);
      const childLive = computeLiveStatus(childParsed);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Pass childTimeline.activeModel to computeSpeed for descendants.
// ============================================================================
      const childSpeed = computeSpeed(
        childParsed,
        desc.conversationId,
        childTimeline.modelByStepIdx,
        options.timingStore,
        childTimeline.activeModel,
      );
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================
      const childContext = computeContext(childParsed, effectivePrefs);
      const childBucket = emptyBucket();
      accumulateStepsInto(
        childBucket,
        null,
        localObservedProfiles,
        childParsed,
        childTimeline.modelByStepIdx,
        effectivePrefs,
        new Set(),
      );
      finalizeBucket(childBucket);
      accumulateStepsInto(
        withChildren,
        byModelMap,
        localObservedProfiles,
        childParsed,
        childTimeline.modelByStepIdx,
        effectivePrefs,
        withChildrenSeenBotIds,
      );
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Accumulate descendant receipt telemetry and expose killed,
// updatedAtMs, and temporary activity sort keys on child entries.
// ============================================================================
      accumulateReceiptConversation(
        childParsed,
        childTimeline.modelByStepIdx,
        effectivePrefs,
        todayDate,
        todayStartMs,
        todayEndMs,
        allReceiptState,
        todayReceiptState,
        {
          conversationId: desc.conversationId,
          kind: desc.kind,
          name: desc.name,
          role: desc.role,
          model: childTimeline.activeModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Attach rawModel and modelLabel onto receipt child metadata.
// ============================================================================
          rawModel: childTimeline.activeRawModel || childTimeline.activeModel || 'Auto',
          modelLabel: resolveLabel(
            childTimeline.activeModel,
            childTimeline.activeRawModel || childTimeline.activeModel || 'Auto',
          ),
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
        },
      );

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:20
// Description: Expose rawModel, modelLabel, and createdAtMs on parsed child
// entries for Scheme A attribution and round-scoped Pixel Office filtering.
// ============================================================================
      const childUpdatedAtMs = computeChildUpdatedAtMs(
        childParsed,
        childLive,
        isChildKilled,
        desc.invokedAtMs,
      );
      const childCreatedAtMs = computeChildCreatedAtMs(
        childParsed,
        desc.invokedAtMs,
        childUpdatedAtMs,
      );
      const childRawModel = childTimeline.activeRawModel || childTimeline.activeModel || 'Auto';

      children.push({
        conversationId: desc.conversationId,
        kind: desc.kind,
        name: desc.name,
        role: desc.role,
        model: childTimeline.activeModel,
        rawModel: childRawModel,
        modelLabel: resolveLabel(childTimeline.activeModel, childRawModel),
        status: isChildKilled ? 'IDLE' : childLive.status,
        killed: isChildKilled,
        createdAtMs: childCreatedAtMs,
        updatedAtMs: childUpdatedAtMs,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:20
// ============================================================================
        generatingSinceMs: isChildKilled ? null : childLive.generatingSinceMs,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Expose live activeToolLabel on child conversation entries (empty when killed).
// ============================================================================
        activeToolLabel: isChildKilled ? '' : (childLive.activeToolLabel || ''),
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
        contextTotal: childContext.currentTotal,
        latestTokPerSec: childSpeed.latestStepTokPerSec,
        outputTokens: childBucket.outputTokens,
        costActual: childBucket.costActual,
        _lastSeq: desc.lastSeq || 0,
        _spawnOrder: desc.spawnOrder ?? 0,
      });
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================

      collectDescendants(childParsed, childTimeline.modelByStepIdx, depth + 1);
    }
  }

  collectDescendants(parsed, modelByStepIdx, 0);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Sort children by live activity tier and recency, strip internal
// sort keys, and finalize Today and All-Time checkout receipt payloads.
// ============================================================================
  sortChildrenByActivity(children);
  for (const ch of children) {
    delete ch._lastSeq;
    delete ch._spawnOrder;
  }
  const receipt = {
    todayDate,
    today: finalizeReceiptScope(
      'today',
      todayReceiptState,
      todayDate,
      activeModel,
      effectivePrefs,
      children.length,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Pass activeRawModel fallback to finalizeReceiptScope() for today & all scopes.
// ============================================================================
      activeRawModel,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
    ),
    all: finalizeReceiptScope(
      'all',
      allReceiptState,
      todayDate,
      activeModel,
      effectivePrefs,
      children.length,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Pass activeRawModel fallback to finalizeReceiptScope() for all scope.
// ============================================================================
      activeRawModel,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
    ),
  };
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
  finalizeBucket(withChildren);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Format both byModel and mainOnlyByModel with identical sorting,
// detect isChildSession/childKind/parentConversationId across all 3 sources,
// and expose them on analyzeConversation().
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:25
// Description: Serialize rawModels onto byModel/mainOnlyByModel rows and strip
// internal _rawModels/_stepModels Sets.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Add per-model cacheHitRatePct to Tab 1 byModel and mainOnlyByModel rows.
// ============================================================================
  const formatByModelList = (modelMap) =>
    [...modelMap.values()]
      .map(({ _rawModels, _stepModels, ...entry }) => {
        const totalIn = entry.inputUncachedTokens + entry.cacheReadTokens;
        return {
          ...entry,
          rawModels: [...(_rawModels || [])].filter((x) => x && !AUTO_UNKNOWN_RE.test(x)).sort(),
          totalTokens: totalIn + entry.outputTokens,
          cacheHitRatePct: totalIn > 0 ? (entry.cacheReadTokens / totalIn) * 100 : 0,
        };
      })
      .sort((a, b) => b.costActual - a.costActual || b.totalTokens - a.totalTokens);
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:25
// ============================================================================
  const byModel = formatByModelList(byModelMap);
  const mainOnlyByModel = formatByModelList(mainOnlyByModelMap);
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Collect localRawModels from activeModel, byModelMap keys, and
// children models and prioritize observedSubscriptionModels over observedProfiles.
// ============================================================================
  const localRawModels = new Set();
  const addLocalSubscriptionModel = (rawModel) => {
    const nm = normalizeModelId(rawModel || '');
    if (nm && !AUTO_UNKNOWN_RE.test(nm)) localRawModels.add(nm);
  };
  addLocalSubscriptionModel(activeModel);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:25
// Description: Collect underlying _stepModels from merged byModelMap entries
// instead of merged profileId keys so fallback profiles (e.g. gemini-pro)
// never falsely trigger higher subscription tiers.
// ============================================================================
  for (const entry of byModelMap.values()) {
    for (const sm of entry._stepModels || []) addLocalSubscriptionModel(sm);
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:25
// ============================================================================
  for (const child of children) addLocalSubscriptionModel(child?.model);

  const subModels =
    options.observedSubscriptionModels instanceof Set &&
    options.observedSubscriptionModels.size > 0
      ? options.observedSubscriptionModels
      : options.observedProfiles instanceof Set && options.observedProfiles.size > 0
        ? options.observedProfiles
        : localRawModels;
  const subInfo = resolveSubscriptionInfo(effectivePrefs, subModels);
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
  const subscription = {
    planId: subInfo.planId,
    planLabel: subInfo.planLabel,
    isAutoDetected: subInfo.isAutoDetected,
    monthlyFee: subInfo.monthlyFee,
    mainOnlySharePct:
      subInfo.monthlyFee > 0 ? (mainOnly.costActual / subInfo.monthlyFee) * 100 : null,
    withChildrenSharePct:
      subInfo.monthlyFee > 0 ? (withChildren.costActual / subInfo.monthlyFee) * 100 : null,
  };

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Reuse early summaries/sumMeta, complete subagent parent discovery
// across all 3 read-only sources, and expose isChildSession/childKind/
// parentConversationId and totals.mainOnlyByModel.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Detect Side Question child sessions (childKind='side_question')
// with official field 15.18 metaTitle fallback, resolve linked Side Questions
// without mutating parent totals/receipt, and include them in _activeWatchIds.
// ============================================================================
  const isSideQuestion = Boolean(sqParentMeta && !isSwarmWorker);
  const storeMeta = options.metadataStore?.get?.(convId, {
    appDataDirs,
    hasFallback: Boolean(isSideQuestion && sqParentMeta?.title),
  }) || {
    title: '',
    workspace: '',
  };
  const metaTitle =
    storeMeta.title || sumMeta?.title || (isSideQuestion ? sqParentMeta.title : '') || '';
  const metaWorkspace = storeMeta.workspace || sumMeta?.workspace || '';

  if (!isSwarmWorker && !isSideQuestion && !summaryParentId && !subagentHint) {
    subagentHint = findSubagentParentHint(convId, appDataDirs);
  } else if (
    !subagentHint &&
    !swarmInfo &&
    !isSideQuestion &&
    !metaTitle &&
    !parsed.firstUserPrompt
  ) {
    subagentHint = findSubagentParentHint(convId, appDataDirs);
  }

  const isChildSession = Boolean(
    isSwarmWorker || isSideQuestion || summaryParentId || subagentHint,
  );
  const childKind = isSwarmWorker
    ? 'swarm'
    : isSideQuestion
      ? 'side_question'
      : isChildSession
        ? 'subagent'
        : null;
  const parentConversationId = isSwarmWorker
    ? swarmInfo.coordinatorId || ''
    : isSideQuestion
      ? sqParentMeta.parentId
      : summaryParentId || subagentHint?.parentConversationId || '';

  const { sideQuestions, sideQuestionsTotals, sqEtagParts } = resolveSideQuestions({
    convId,
    summariesBundle,
    children,
    mainSeenBotIds,
    appDataDirs,
    effectivePrefs,
    resolveLabel,
  });

  const title = buildConversationTitle({
    convId,
    metaTitle,
    swarmInfo,
    hintName: options.hintName || subagentHint?.name,
    metaAgentName: sumMeta?.agentName || storeMeta.agentName || '',
    metaPreview: sumMeta?.preview || storeMeta.preview || '',
    parsed,
  });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Only include non-ended (!killed) children in _activeWatchIds so
// the 400ms background watcher stops polling historical killed workers (A3).
// ============================================================================
  const activeWatchIds = [
    convId,
    ...children.filter((c) => !c.killed).map((c) => c.conversationId),
    ...sideQuestions.map((sq) => sq.conversationId),
  ];
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:34:30
// Description: Compute ascending userTurnTimestampsMs and expose
// activeModelLabel, activeRawModel, and userTurnTimestampsMs on analyzeConversation().
// ============================================================================
  const userTurnTimestampsMs = parsed.steps
    .filter((s) => s?.type === 'USER_INPUT' && isValidTimestampMs(s.createdAtMs))
    .map((s) => s.createdAtMs)
    .sort((a, b) => a - b);

  return {
    conversationId: convId,
    title,
    workspace: metaWorkspace,
    activeModel,
    activeModelLabel: resolveLabel(activeModel, activeRawModel),
    activeRawModel: activeRawModel || activeModel,
    userTurnTimestampsMs,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:34:30
// ============================================================================
    isChildSession,
    childKind,
    parentConversationId,
    status: live.status,
    generatingSinceMs: live.generatingSinceMs,
    toolProgress: live.toolProgress,
    activeToolLabel: live.activeToolLabel,
    speed,
    context,
    subscription,
    totals: {
      mainOnly,
      withChildren,
      byModel,
      mainOnlyByModel,
    },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:41:14
// Description: Expose Today + All-Time checkout receipt payload on analyzeConversation().
// ============================================================================
    receipt,
// ============================================================================
// [MODIFIED END] 2026-11-18 11:41:14
// ============================================================================
    children,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Expose sideQuestions and sideQuestionsTotals on analyzeConversation()
// and include Side Question cache keys and titles in _etagPart.
// ============================================================================
    sideQuestions,
    sideQuestionsTotals,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Include modelNameMode in analyzeConversation _etagPart so mode
// changes invalidate snapshots immediately.
// ============================================================================
    _etagPart: `${parsed.cacheKey}|${childEtagParts.join(',')}|${sqEtagParts.join(',')}|${isChildSession ? `${childKind}:${parentConversationId}${isSideQuestion && sqParentMeta?.title ? `:${sqParentMeta.title}` : ''}` : ''}|mn:${resolveModelNameMode(effectivePrefs)}`,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================
    _activeWatchIds: activeWatchIds,
  };
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
}

function parseLocalDateParts(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

function shiftLocalDate(dateStr, deltaDays) {
  const { y, m, d } = parseLocalDateParts(dateStr);
  const dt = new Date(y, m - 1, d + deltaDays);
  return formatLocalDate(dt.getTime());
}

function daysBetweenLocalDates(startStr, endStr) {
  const a = parseLocalDateParts(startStr);
  const b = parseLocalDateParts(endStr);
  const utcA = Date.UTC(a.y, a.m - 1, a.d);
  const utcB = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((utcB - utcA) / 86400000);
}

function emptyRawTokenCounts() {
  return { steps: 0, stdIn: 0, stdCache: 0, stdOut: 0, longIn: 0, longCache: 0, longOut: 0 };
}

function addStepToRawCounts(bucket, step, threshold) {
  const input = Number(step.input_tokens) || 0;
  const cache = Number(step.cache_read_tokens) || 0;
  const output = Number(step.output_tokens) || 0;
  bucket.steps += 1;
  if (input + cache > threshold) {
    bucket.longIn += input;
    bucket.longCache += cache;
    bucket.longOut += output;
  } else {
    bucket.stdIn += input;
    bucket.stdCache += cache;
    bucket.stdOut += output;
  }
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:04:00
// Description: Upgrade createUsageLedger to schema version 3 — count strictly each
// conversation's own steps (!step.isClonedFromParent) while recovering deleted or
// rewound parent steps surviving inside child forks deduplicated globally by botId.
// ============================================================================
function makeStepDedupeKey(convIdLower, step) {
  return step.botId || `${convIdLower}:${step.step_index}:${step.createdAtMs ?? 0}`;
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Reject out-of-range timestamps and use Object.hasOwn + defineProperty
// in addDatedStepToDays so prototype keys (constructor, toString, __proto__) are safe.
// ============================================================================
function defineOwnModelBucket(target, key) {
  Object.defineProperty(target, key, {
    value: emptyRawTokenCounts(),
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function addDatedStepToDays(days, stepMs, stepModel, step, threshold) {
  if (!Number.isFinite(stepMs) || stepMs < MIN_VALID_TS_MS || stepMs > MAX_VALID_TS_MS) {
    return;
  }
  const dateKey = formatLocalDate(stepMs);
  const hourKey = String(new Date(stepMs).getHours());
  if (!Object.hasOwn(days, dateKey)) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Initialize byRawModel alongside byModel and hours in daily
// ledger records (schema v6) for routed-mode Tab 2 table splitting.
// ============================================================================
    days[dateKey] = { byModel: {}, byRawModel: {}, hours: {} };
  }
  if (
    !Object.hasOwn(days[dateKey], 'byRawModel') ||
    !days[dateKey].byRawModel ||
    typeof days[dateKey].byRawModel !== 'object'
  ) {
    days[dateKey].byRawModel = {};
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
  }
  if (!Object.hasOwn(days[dateKey].byModel, stepModel)) {
    defineOwnModelBucket(days[dateKey].byModel, stepModel);
  }
  addStepToRawCounts(days[dateKey].byModel[stepModel], step, threshold);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:35:00
// Description: Record underlying rawDbModel slugs on daily ledger byModel
// buckets so Tab 2 preserves rawModels across canonical profile merges.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Normalize rawSlug fallback (ignoring Auto/unknown rawDbModel)
// and populate prototype-safe days[dateKey].byRawModel[rawSlug] with
// canonicalModel (plus rare same-day byCanonical split guard) for exact
// routed vs canonical Tab 2 cost conservation.
// ============================================================================
  const rawCandidate = typeof step?.rawDbModel === 'string' ? step.rawDbModel.trim() : '';
  const rawSlug =
    rawCandidate && !AUTO_UNKNOWN_RE.test(rawCandidate) ? rawCandidate : stepModel;
  if (rawSlug && !AUTO_UNKNOWN_RE.test(rawSlug)) {
    const modelBucket = days[dateKey].byModel[stepModel];
    if (!Array.isArray(modelBucket.rawModels)) {
      modelBucket.rawModels = [];
    }
    if (!modelBucket.rawModels.includes(rawSlug)) {
      modelBucket.rawModels.push(rawSlug);
    }
  }

  if (!Object.hasOwn(days[dateKey].byRawModel, rawSlug)) {
    const initRawBucket = emptyRawTokenCounts();
    initRawBucket.canonicalModel = stepModel;
    Object.defineProperty(days[dateKey].byRawModel, rawSlug, {
      value: initRawBucket,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  const rawBucket = days[dateKey].byRawModel[rawSlug];
  if (rawBucket.canonicalModel !== stepModel) {
    if (!rawBucket.byCanonical || typeof rawBucket.byCanonical !== 'object') {
      const prevCanonical = rawBucket.canonicalModel || stepModel;
      const byCanonical = {};
      Object.defineProperty(byCanonical, prevCanonical, {
        value: {
          steps: rawBucket.steps,
          stdIn: rawBucket.stdIn,
          stdCache: rawBucket.stdCache,
          stdOut: rawBucket.stdOut,
          longIn: rawBucket.longIn,
          longCache: rawBucket.longCache,
          longOut: rawBucket.longOut,
        },
        writable: true,
        enumerable: true,
        configurable: true,
      });
      rawBucket.byCanonical = byCanonical;
    }
    if (!Object.hasOwn(rawBucket.byCanonical, stepModel)) {
      defineOwnModelBucket(rawBucket.byCanonical, stepModel);
    }
    addStepToRawCounts(rawBucket.byCanonical[stepModel], step, threshold);
  } else if (rawBucket.byCanonical && typeof rawBucket.byCanonical === 'object') {
    if (!Object.hasOwn(rawBucket.byCanonical, stepModel)) {
      defineOwnModelBucket(rawBucket.byCanonical, stepModel);
    }
    addStepToRawCounts(rawBucket.byCanonical[stepModel], step, threshold);
  }
  addStepToRawCounts(rawBucket, step, threshold);
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:35:00
// ============================================================================

  if (!Object.hasOwn(days[dateKey].hours, hourKey)) {
    days[dateKey].hours[hourKey] = {};
  }
  if (!Object.hasOwn(days[dateKey].hours[hourKey], stepModel)) {
    defineOwnModelBucket(days[dateKey].hours[hourKey], stepModel);
  }
  addStepToRawCounts(days[dateKey].hours[hourKey][stepModel], step, threshold);
}
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

/**
 * Creates a persistent incremental usage ledger (schema version 4).
 * Automatically migrates/rebuilds stale v1/v2/v3 ledgers cleanly from SQLite + transcripts,
 * deduplicating forked conversations while preserving orphan/rewound parent steps once.
 */
export function createUsageLedger(initialData = null) {
  const data = {
    version: LEDGER_SCHEMA_VERSION,
    threshold: DEFAULT_PREFS.longContextThreshold,
    conversations: {},
  };

  const runtimeOwnKeysCache = new Map(); // convIdLower -> { cacheKey, keysSet }

  let dirty = false;
  if (initialData && typeof initialData === 'object') {
    if (Number.isFinite(Number(initialData.threshold)) && Number(initialData.threshold) > 0) {
      data.threshold = Number(initialData.threshold);
    }
    if (
      initialData.version === LEDGER_SCHEMA_VERSION &&
      initialData.conversations &&
      typeof initialData.conversations === 'object'
    ) {
      data.conversations = initialData.conversations;
    } else {
      // Stale v1/v2 ledger detected — discard duplicate-counted conversations and rebuild cleanly.
      dirty = true;
    }
  }

  function getOwnKeysForCandidate(cand) {
    const lower = cand.convId.toLowerCase();
    const hit = runtimeOwnKeysCache.get(lower);
    if (hit && hit.cacheKey === cand.cacheKey) {
      return hit.keysSet;
    }
    const parsed = parseTranscript(cand.convId, cand.paths);
    const keysSet = new Set();
    if (parsed) {
      for (const s of parsed.steps) {
        if (isBillableTokenStep(s) && !s.isClonedFromParent) {
          keysSet.add(makeStepDedupeKey(lower, s));
        }
      }
    }
    runtimeOwnKeysCache.set(lower, { cacheKey: cand.cacheKey, keysSet });
    return keysSet;
  }

  function rebuildRecoveredParents(diskByLower, summariesMap, threshold) {
    // 1. Remove previously synthesized recovered-parent entries and restore any ownDays snapshots.
    for (const [cid, entry] of Object.entries(data.conversations)) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.cacheKey === 'recovered-parent') {
        delete data.conversations[cid];
        continue;
      }
      if (entry.ownDays) {
        entry.days = structuredClone(entry.ownDays);
        entry.totalOutputTokens = entry.ownOutputTokens ?? 0;
        entry.observedProfiles = Array.isArray(entry.ownObservedProfiles)
          ? [...entry.ownObservedProfiles]
          : [];
        delete entry.ownDays;
        delete entry.ownOutputTokens;
        delete entry.ownObservedProfiles;
      }
    }

    const existingByLower = new Map();
    for (const [cid, entry] of Object.entries(data.conversations)) {
      if (entry && typeof entry === 'object') {
        existingByLower.set(cid.toLowerCase(), { cid, entry });
      }
    }

    // 2. Group orphan/rewound parent steps across child forks, globally deduplicating by botId.
    const groupedOrphans = new Map(); // originLower -> { canonicalId, items: [] }
    const seenOrphanKeys = new Set();

    for (const entry of Object.values(data.conversations)) {
      if (!entry || !Array.isArray(entry.orphanInheritedSteps)) continue;
      for (const item of entry.orphanInheritedSteps) {
        if (!item || !isValidConversationId(item.originCascadeId)) continue;
        const originLower = item.originCascadeId.toLowerCase();
        const dedupeKey =
          item.botId || `${originLower}:${item.step_index}:${item.createdAtMs ?? 0}`;
        if (seenOrphanKeys.has(dedupeKey)) continue;
        seenOrphanKeys.add(dedupeKey);

        let group = groupedOrphans.get(originLower);
        if (!group) {
          group = { canonicalId: item.originCascadeId, items: [] };
          groupedOrphans.set(originLower, group);
        }
        group.items.push(item);
      }
    }

    // 3. Materialize recovered steps either into rewound parent entry or archived recovered-parent.
    for (const [originLower, group] of groupedOrphans) {
      const existing = existingByLower.get(originLower);
      if (existing) {
        const rewoundItems = diskByLower.has(originLower)
          ? group.items
          : group.items.filter((it) => it.rewound === true);
        if (rewoundItems.length === 0) continue;

        const target = existing.entry;
        target.ownDays = structuredClone(target.days || {});
        target.ownOutputTokens = target.totalOutputTokens || 0;
        target.ownObservedProfiles = Array.isArray(target.observedProfiles)
          ? [...target.observedProfiles]
          : [];

        const profileSet = new Set(target.observedProfiles || []);
        for (const item of rewoundItems) {
          const stepModel = normalizeModelId(item.model || 'Auto');
          profileSet.add(resolveModelProfile(stepModel).id);
          target.totalOutputTokens = (target.totalOutputTokens || 0) + (item.output_tokens || 0);
          const stepMs = Number.isFinite(item.createdAtMs)
            ? item.createdAtMs
            : target.updatedAtMs || Date.now();
          addDatedStepToDays(target.days, stepMs, stepModel, item, threshold);
        }
        target.observedProfiles = [...profileSet];
        dirty = true;
        continue;
      }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Defer recovered-parent synthesis when an on-disk parent is still
// queued in a later chunked rebuild batch.
// ============================================================================
      if (diskByLower.has(originLower) && !existing) {
        continue;
      }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

      // Deleted parent conversation not present on disk or in archived ledger — synthesize entry.
      const canonicalId = group.canonicalId;
      const days = {};
      const observedProfiles = new Set();
      let totalOutputTokens = 0;
      let latestContextTotal = 0;
      let activeModel = 'Auto';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Track activeRawModel on synthesized recovered-parent ledger records.
// ============================================================================
      let activeRawModel = 'Auto';
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
      let maxUpdatedAtMs = 0;

      const sortedItems = [...group.items].sort(
        (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0) || a.step_index - b.step_index,
      );
      for (const item of sortedItems) {
        const stepModel = normalizeModelId(item.model || 'Auto');
        if (stepModel !== 'Auto') activeModel = stepModel;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Capture latest non-Auto rawDbModel slug for recovered-parent activeRawModel.
// ============================================================================
        const itemRawCandidate =
          typeof item.rawDbModel === 'string' ? item.rawDbModel.trim() : '';
        const itemRawModel =
          itemRawCandidate && !AUTO_UNKNOWN_RE.test(itemRawCandidate)
            ? itemRawCandidate
            : stepModel;
        if (itemRawModel && !AUTO_UNKNOWN_RE.test(itemRawModel)) {
          activeRawModel = itemRawModel;
        }
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
        observedProfiles.add(resolveModelProfile(stepModel).id);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:09:30
// Description: Update recovered-parent latestContextTotal on DONE compaction
// summary items in sortedItems.
// ============================================================================
        if (item.isPlanner) {
          latestContextTotal = (item.input_tokens || 0) + (item.cache_read_tokens || 0);
        } else if (item.isCompactionDone) {
          latestContextTotal = Math.max(0, Number(item.output_tokens) || 0);
        }
// ============================================================================
// [MODIFIED END] 2026-11-17 16:09:30
// ============================================================================
        totalOutputTokens += item.output_tokens || 0;
        const stepMs = Number.isFinite(item.createdAtMs)
          ? item.createdAtMs
          : item.fallbackMs || Date.now();
        if (stepMs > maxUpdatedAtMs) maxUpdatedAtMs = stepMs;
        addDatedStepToDays(days, stepMs, stepModel, item, threshold);
      }

      const sumEntry = summariesMap.get(canonicalId) || summariesMap.get(originLower);
      data.conversations[canonicalId] = {
        cacheKey: 'recovered-parent',
        updatedAtMs: maxUpdatedAtMs,
        onDisk: false,
        activeModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Persist activeRawModel on recovered-parent ledger records.
// ============================================================================
        activeRawModel: activeRawModel || activeModel,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
        latestContextTotal,
        latestTokPerSec: null,
        status: 'ARCHIVED',
        totalOutputTokens,
        title: sumEntry?.title || '',
        workspace: sumEntry?.workspace || '',
        fallbackTitle:
          sumEntry?.agentName ||
          sumEntry?.preview ||
          `已归档父会话 ${canonicalId.slice(0, 8)}`,
        observedProfiles: [...observedProfiles],
        days,
      };
      dirty = true;
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Add makeEmptyConvEntry and getSubagentDescriptorsForCandidate helpers
// for fault-isolated ledger entries and O(1) parent-subagent descriptor caching.
// ============================================================================
  function makeEmptyConvEntry(cand, summariesMap) {
    const sumEntry = summariesMap.get(cand.convId);
    return {
      cacheKey: cand.cacheKey,
      updatedAtMs: cand.updatedAtMs,
      onDisk: true,
      activeModel: 'Auto',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Initialize activeRawModel on empty fallback ledger entries.
// ============================================================================
      activeRawModel: 'Auto',
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
      latestContextTotal: 0,
      latestTokPerSec: null,
      status: 'IDLE',
      totalOutputTokens: 0,
      title: sumEntry?.title || '',
      workspace: sumEntry?.workspace || '',
      fallbackTitle: cand.convId.slice(0, 8),
      observedProfiles: [],
      days: {},
    };
  }

  function getSubagentDescriptorsForCandidate(cand, swarmMemberLookup) {
    if (!cand || !existsSync(cand.paths.transcriptPath)) return [];
    const memberMeta = swarmMemberLookup.get(cand.convId);
    const seedModel = memberMeta?.model || 'Auto';
    const descKey = `${cand.cacheKey}|${seedModel}`;
    const cached = subagentDescCache.get(cand.convId);
    if (cached && cached.cacheKey === descKey) {
      subagentDescCache.delete(cand.convId);
      subagentDescCache.set(cand.convId, cached);
      return cached.descriptors;
    }

    const cacheId = cand.paths.dbPath || cand.paths.transcriptPath;
    let parsedParent = null;
    const tHit = transcriptCache.get(cacheId);
    if (tHit && tHit.key === cand.cacheKey) {
      parsedParent = tHit.parsed;
    } else {
      let rawText = '';
      try {
        rawText = readFileSync(cand.paths.transcriptPath, 'utf-8');
      } catch {
        rawText = '';
      }
      if (!rawText.includes('invoke_subagent')) {
        setSubagentDescCache(cand.convId, { cacheKey: descKey, descriptors: [] });
        return [];
      }
      parsedParent = parseTranscript(cand.convId, cand.paths);
    }

    if (!parsedParent) {
      setSubagentDescCache(cand.convId, { cacheKey: descKey, descriptors: [] });
      return [];
    }
    const { modelByStepIdx } = resolveModelTimeline(parsedParent, seedModel);
    const descriptors = extractSubagentCallDescriptors(parsedParent, modelByStepIdx);
    setSubagentDescCache(cand.convId, { cacheKey: descKey, descriptors });
    return descriptors;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

  function sync(options = {}) {
    const appDataDirs = discoverAppDataDirs(options);
    const threshold = Number(options.threshold) || DEFAULT_PREFS.longContextThreshold;
    if (data.threshold !== threshold) {
      data.threshold = threshold;
      data.conversations = {};
      runtimeOwnKeysCache.clear();
      dirty = true;
    }

    const summariesMap = readConversationSummariesMap(appDataDirs);
    const seenConvs = new Set();
    const candidates = [];

    for (const appData of appDataDirs) {
      const convsDir = join(appData, 'conversations');
      const brainDir = join(appData, 'brain');
      const candidateIds = new Set();

      for (const file of safeReaddir(convsDir)) {
        if (file.endsWith('.db')) {
          const id = file.slice(0, -3);
          if (isValidConversationId(id)) candidateIds.add(id);
        }
      }
      for (const id of safeReaddir(brainDir)) {
        if (isValidConversationId(id)) candidateIds.add(id);
      }

      for (const id of candidateIds) {
        const lower = id.toLowerCase();
        if (seenConvs.has(lower)) continue;

        const dbPath = join(convsDir, `${id}.db`);
        const walPath = `${dbPath}-wal`;
        const convDir = join(brainDir, id);
        const logsDir = join(convDir, '.system_generated', 'logs');
        const transcriptPath = join(logsDir, 'transcript.jsonl');
        const fullTranscriptPath = join(logsDir, 'transcript_full.jsonl');
        const swarmMembersPath = join(convDir, '.system_generated', 'swarm', 'members.json');

        const dbStat = statOf(dbPath);
        const tStat = statOf(transcriptPath);
        if (dbStat.size < 0 && tStat.size < 0) continue;

        const walStat = statOf(walPath);
        const fullStat = statOf(fullTranscriptPath);

        seenConvs.add(lower);
        const updatedAtMs = Math.max(dbStat.mtimeMs, walStat.mtimeMs, tStat.mtimeMs);
        const cacheKey = `${dbStat.mtimeMs}:${dbStat.size}|${walStat.mtimeMs}:${walStat.size}|${tStat.mtimeMs}:${tStat.size}|${fullStat.mtimeMs}:${fullStat.size}`;
        candidates.push({
          convId: id,
          hasDb: dbStat.size >= 0,
          updatedAtMs,
          cacheKey,
          paths: {
            appData,
            convDir,
            dbPath,
            walPath,
            transcriptPath,
            fullTranscriptPath,
            swarmMembersPath,
          },
        });
      }
    }

    candidates.sort((a, b) => b.updatedAtMs - a.updatedAtMs);

    const diskIds = new Set(candidates.map((c) => c.convId));
    const diskByLower = new Map(candidates.map((c) => [c.convId.toLowerCase(), c]));
    let diskTopologyChanged = false;

    for (const [existingId, entry] of Object.entries(data.conversations)) {
      if (
        !diskIds.has(existingId) &&
        entry &&
        entry.cacheKey !== 'recovered-parent' &&
        entry.onDisk !== false
      ) {
        entry.onDisk = false;
        dirty = true;
        diskTopologyChanged = true;
      }
    }

    const needRebuild = [];
    for (const c of candidates) {
      const prev = data.conversations[c.convId];
      if (!prev || prev.cacheKey !== c.cacheKey) {
        needRebuild.push(c);
        if (!prev || prev.cacheKey === 'recovered-parent') {
          diskTopologyChanged = true;
        }
      } else {
        if (prev.onDisk !== true) {
          prev.onDisk = true;
          dirty = true;
          diskTopologyChanged = true;
        }
        if (prev.updatedAtMs !== c.updatedAtMs) {
          prev.updatedAtMs = c.updatedAtMs;
          dirty = true;
        }
        const sumEntry = summariesMap.get(c.convId);
        if (sumEntry) {
          if (sumEntry.title && prev.title !== sumEntry.title) {
            prev.title = sumEntry.title;
            dirty = true;
          }
          if (sumEntry.workspace && prev.workspace !== sumEntry.workspace) {
            prev.workspace = sumEntry.workspace;
            dirty = true;
          }
        }
      }
    }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Support chunked cold-start batching (maxRebuildBatch + priorityConvId),
// O(1) parent-subagent descriptor lookup, and per-conversation try/catch isolation.
// ============================================================================
    let batch = [];
    if (needRebuild.length > 0) {
      const maxBatch =
        Number.isFinite(Number(options.maxRebuildBatch)) && Number(options.maxRebuildBatch) > 0
          ? Math.floor(Number(options.maxRebuildBatch))
          : 0;
      const priorityLower =
        typeof options.priorityConvId === 'string' &&
        isValidConversationId(options.priorityConvId.trim())
          ? options.priorityConvId.trim().toLowerCase()
          : '';

      if (maxBatch > 0 && needRebuild.length > maxBatch) {
        batch = needRebuild.slice(0, maxBatch);
        if (priorityLower && !batch.some((c) => c.convId.toLowerCase() === priorityLower)) {
          const priorityCand = needRebuild.find((c) => c.convId.toLowerCase() === priorityLower);
          if (priorityCand) {
            batch.push(priorityCand);
          }
        }
      } else {
        batch = [...needRebuild];
      }

      // If a parent DB in this batch is being rebuilt/rewound, also refresh any cached on-disk child fork referencing it.
      const batchLowers = new Set(batch.map((c) => c.convId.toLowerCase()));
      const needRebuildSet = new Set(needRebuild.map((c) => c.convId));
      const batchSet = new Set(batch.map((c) => c.convId));
      for (const c of candidates) {
        if (batchSet.has(c.convId)) continue;
        const prev = data.conversations[c.convId];
        if (
          Array.isArray(prev?.parentCascadeIds) &&
          prev.parentCascadeIds.some((pid) => batchLowers.has(pid))
        ) {
          if (!needRebuildSet.has(c.convId)) {
            needRebuild.push(c);
            needRebuildSet.add(c.convId);
            batch.push(c);
            batchSet.add(c.convId);
          } else if (maxBatch === 0 || needRebuild.length <= maxBatch) {
            batch.push(c);
            batchSet.add(c.convId);
          }
        }
      }

      const swarms = listAllSwarms(appDataDirs);
      const swarmMemberLookup = new Map();
      const swarmTitleByCoord = new Map();
      for (const s of swarms) {
        if (s.roster.title) swarmTitleByCoord.set(s.coordinatorId, s.roster.title);
        for (const [mName, member] of Object.entries(s.roster.members || {})) {
          if (isValidConversationId(member?.conversation_id)) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Preserve rawModel on swarmMemberLookup entries in ledger sync().
// ============================================================================
            const rawSwarmModel = String(
              member.model || member.applied_model || member.desired_model || '',
            ).trim();
            swarmMemberLookup.set(member.conversation_id, {
              coordinatorId: s.coordinatorId,
              swarmTitle: s.roster.title || '',
              name: mName,
              model: normalizeModelId(rawSwarmModel),
              rawModel:
                rawSwarmModel && !AUTO_UNKNOWN_RE.test(rawSwarmModel) ? rawSwarmModel : '',
            });
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
          }
        }
      }

      // Collect subagent parent hints when transcript-only conversations are rebuilt.
      // Check summariesMap.parentConversationId first in O(1), then fall back to cached descriptor index.
      const directSubagentHints = new Map();
      const unresolvedTranscriptOnly = [];
      for (const c of batch) {
        if (c.hasDb || swarmMemberLookup.has(c.convId)) continue;
        const convLower = c.convId.toLowerCase();
        const parentId = summariesMap.get(c.convId)?.parentConversationId;
        if (parentId && isValidConversationId(parentId)) {
          const parentCand = diskByLower.get(parentId.toLowerCase());
          if (parentCand) {
            const match = getSubagentDescriptorsForCandidate(parentCand, swarmMemberLookup).find(
              (d) => d.conversationId.toLowerCase() === convLower,
            );
            if (match) {
              directSubagentHints.set(convLower, match);
              continue;
            }
          }
        }
        unresolvedTranscriptOnly.push(convLower);
      }

      const subagentHintMap = new Map();
      if (unresolvedTranscriptOnly.length > 0) {
        for (const c of candidates) {
          for (const desc of getSubagentDescriptorsForCandidate(c, swarmMemberLookup)) {
            const key = desc.conversationId.toLowerCase();
            if (!subagentHintMap.has(key)) subagentHintMap.set(key, desc);
          }
        }
      }

      const forkedRebuilds = [];

      for (const c of batch) {
        try {
          const parsed = parseTranscript(c.convId, c.paths);
          if (!parsed) {
            data.conversations[c.convId] = makeEmptyConvEntry(c, summariesMap);
            dirty = true;
            continue;
          }
          const convLower = c.convId.toLowerCase();
          const memberMeta = swarmMemberLookup.get(c.convId);
          const subHint = directSubagentHints.get(convLower) || subagentHintMap.get(convLower);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Pass raw default model into resolveModelTimeline() and capture
// activeRawModel when syncing ledger entries (schema v6).
// ============================================================================
          const defaultRawModel =
            memberMeta?.rawModel ||
            memberMeta?.model ||
            subHint?.rawDefaultModel ||
            subHint?.defaultModel ||
            'Auto';
          const { activeModel, activeRawModel, modelByStepIdx } = resolveModelTimeline(
            parsed,
            defaultRawModel,
          );
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
          const live = computeLiveStatus(parsed);
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Pass activeModel to computeSpeed when updating ledger entries.
// ============================================================================
        const speed = computeSpeed(
          parsed,
          c.convId,
          modelByStepIdx,
          options.timingStore,
          activeModel,
        );
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================

        let latestContextTotal = 0;
        let totalOutputTokens = 0;
        const days = {};
        const observedProfiles = new Set();
        const ownKeysSet = new Set();
        const parentCascadeIdSet = new Set();
        const clonedStepsRaw = [];

        for (const step of parsed.steps) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:09:30
// Description: Reset Tab 2 ledger latestContextTotal to summary output_tokens
// on DONE COMPACTION_SUMMARY and propagate isCompactionDone for cloned steps.
// ============================================================================
          if (step.type === 'PLANNER_RESPONSE' && step.hasTokenTelemetry) {
            latestContextTotal = step.input_tokens + step.cache_read_tokens;
          } else if (step.type === 'COMPACTION_SUMMARY' && step.status === 'DONE') {
            latestContextTotal = Math.max(0, Number(step.output_tokens) || 0);
          }
// ============================================================================
// [MODIFIED END] 2026-11-17 16:09:30
// ============================================================================
          if (!isBillableTokenStep(step)) continue;

          const stepModel = normalizeModelId(
            step.dbModel || modelByStepIdx.get(step.step_index) || 'Auto',
          );

          if (step.isClonedFromParent) {
            if (isValidConversationId(step.originCascadeId)) {
              parentCascadeIdSet.add(step.originCascadeId.toLowerCase());
              clonedStepsRaw.push({
                originCascadeId: step.originCascadeId,
                botId: step.botId || '',
                step_index: step.step_index,
                createdAtMs: step.createdAtMs,
                fallbackMs: c.updatedAtMs,
                model: stepModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:35:05
// Description: Preserve rawDbModel on cloned inherited steps for recovered parents.
// ============================================================================
                rawDbModel: step.rawDbModel || '',
// ============================================================================
// [MODIFIED END] 2026-11-19 13:35:05
// ============================================================================
                input_tokens: step.input_tokens,
                cache_read_tokens: step.cache_read_tokens,
                output_tokens: step.output_tokens,
                isPlanner: step.type === 'PLANNER_RESPONSE',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:09:30
// Description: Record whether cloned step is a completed COMPACTION_SUMMARY.
// ============================================================================
                isCompactionDone: step.type === 'COMPACTION_SUMMARY' && step.status === 'DONE',
// ============================================================================
// [MODIFIED END] 2026-11-17 16:09:30
// ============================================================================
              });
            }
            continue;
          }

          const ownKey = makeStepDedupeKey(convLower, step);
          if (ownKeysSet.has(ownKey)) continue;
          ownKeysSet.add(ownKey);

          observedProfiles.add(resolveModelProfile(stepModel).id);
          totalOutputTokens += step.output_tokens;

          if (step.createdAtMs === null) continue;
          addDatedStepToDays(days, step.createdAtMs, stepModel, step, threshold);
        }

        // Preserve any undated own steps against updatedAtMs date if conversation has no dated own steps.
        if (Object.keys(days).length === 0) {
          const undatedSeen = new Set();
          const undatedSteps = parsed.steps.filter(
            (s) => isBillableTokenStep(s) && !s.isClonedFromParent && s.createdAtMs === null,
          );
          if (undatedSteps.length > 0) {
            for (const step of undatedSteps) {
              const ownKey = makeStepDedupeKey(convLower, step);
              if (undatedSeen.has(ownKey)) continue;
              undatedSeen.add(ownKey);
              const stepModel = normalizeModelId(
                step.dbModel || modelByStepIdx.get(step.step_index) || 'Auto',
              );
              addDatedStepToDays(days, c.updatedAtMs, stepModel, step, threshold);
            }
          }
        }

        runtimeOwnKeysCache.set(convLower, { cacheKey: c.cacheKey, keysSet: ownKeysSet });

        const sumEntry = summariesMap.get(c.convId);
        const coordTitle = swarmTitleByCoord.get(c.convId);
        const fallbackMemberTitle = memberMeta
          ? memberMeta.coordinatorId === c.convId
            ? memberMeta.swarmTitle
            : memberMeta.swarmTitle
              ? `${memberMeta.name} · ${memberMeta.swarmTitle}`
              : memberMeta.name
          : '';
        const prevEntry = data.conversations[c.convId];
        const nextEntry = {
          cacheKey: c.cacheKey,
          updatedAtMs: c.updatedAtMs,
          onDisk: true,
          activeModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Persist activeRawModel on ledger conversation records (schema v6).
// ============================================================================
          activeRawModel: activeRawModel || activeModel,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
          latestContextTotal,
          latestTokPerSec: speed.latestStepTokPerSec,
          status: live.status,
          totalOutputTokens,
          title: sumEntry?.title || prevEntry?.title || '',
          workspace: sumEntry?.workspace || prevEntry?.workspace || '',
          fallbackTitle:
            coordTitle ||
            fallbackMemberTitle ||
            subHint?.name ||
            sumEntry?.agentName ||
            parsed.firstUserPrompt ||
            sumEntry?.preview ||
            c.convId.slice(0, 8),
          observedProfiles: [...observedProfiles],
          days,
        };
        if (parentCascadeIdSet.size > 0) {
          nextEntry.parentCascadeIds = [...parentCascadeIdSet];
          forkedRebuilds.push({ entry: nextEntry, clonedStepsRaw });
        }
        data.conversations[c.convId] = nextEntry;
        dirty = true;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Isolate malformed conversation errors inside chunked rebuild loop,
// run rebuildRecoveredParents on batch progress, and return pendingRebuildCount.
// ============================================================================
        } catch (err) {
          console.error(
            `[monitor_pane] skipping malformed conversation ${c.convId}: ${err?.message || err}`,
          );
          data.conversations[c.convId] = makeEmptyConvEntry(c, summariesMap);
          dirty = true;
        }
      }

      // Filter cloned steps to ONLY genuinely orphaned (deleted-parent or rewound-parent) steps.
      for (const { entry, clonedStepsRaw } of forkedRebuilds) {
        const orphanInheritedSteps = [];
        for (const item of clonedStepsRaw) {
          const originLower = item.originCascadeId.toLowerCase();
          const parentCand = diskByLower.get(originLower);
          if (parentCand) {
            const parentOwnKeys = getOwnKeysForCandidate(parentCand);
            const stepKey =
              item.botId || `${originLower}:${item.step_index}:${item.createdAtMs ?? 0}`;
            if (!parentOwnKeys.has(stepKey)) {
              orphanInheritedSteps.push({ ...item, rewound: true });
            }
          } else {
            orphanInheritedSteps.push({ ...item, rewound: false });
          }
        }
        if (orphanInheritedSteps.length > 0) {
          entry.orphanInheritedSteps = orphanInheritedSteps;
        }
      }
    }

    if (batch.length > 0 || diskTopologyChanged) {
      rebuildRecoveredParents(diskByLower, summariesMap, threshold);
    }

    return {
      candidates,
      onDiskCount: candidates.length,
      pendingRebuildCount: Math.max(0, needRebuild.length - batch.length),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Return read-only summariesMap from ledger.sync() so
// summarizeGlobalAndRecent() reuses one cached map across all period rollups (A2).
// ============================================================================
      summariesMap,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
    };
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
  }

  function resyncFromDisk(options = {}) {
    data.version = LEDGER_SCHEMA_VERSION;
    data.conversations = {};
    runtimeOwnKeysCache.clear();
    dirty = true;
    return sync(options);
  }
// ============================================================================
// [MODIFIED END] 2026-11-16 22:04:00
// ============================================================================

  return {
    getData: () => data,
    isDirty: () => dirty,
    markSaved: () => {
      dirty = false;
    },
    markDirty: () => {
      dirty = true;
    },
    sync,
    resyncFromDisk,
  };
}

function buildPeriodSummary({
  rangeKey,
  label,
  startDate,
  endDate,
  proratedDays,
  todayDate,
  conversations,
  prefs,
  subInfo,
  metadataStore,
  appDataDirs,
  ledger,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Accept reused summariesMap in buildPeriodSummary() (A2) and
// initialize byWorkspaceMap for per-period project/workspace aggregation (C1).
// ============================================================================
  summariesMap,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
}) {
  const pricingByModel = new Map();
  const getPricing = (modelName) => {
    if (!pricingByModel.has(modelName)) {
      pricingByModel.set(modelName, resolveModelPricing(modelName, prefs));
    }
    return pricingByModel.get(modelName);
  };
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Resolve modelNameMode and runtimeCatalog once per buildPeriodSummary()
// for Tab 2 routed-mode splitting and canonical activeModelLabel derivation.
// ============================================================================
  const isRoutedMode = resolveModelNameMode(prefs) === 'routed';
  const runtimeCatalog =
    Array.isArray(prefs?._runtimeCatalog) && prefs._runtimeCatalog.length > 0
      ? prefs._runtimeCatalog
      : null;
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================

  const activeDayKeys = new Set();
  const byModelMap = new Map();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Track per-workspace aggregates alongside byModelMap in buildPeriodSummary() (C1).
// ============================================================================
  const byWorkspaceMap = new Map();
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
  const convSummaries = [];
  const dayBuckets = new Map();
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
    key: String(h).padStart(2, '0'),
    label: `${String(h).padStart(2, '0')}:00`,
    rangeText: `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`,
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costActual: 0,
  }));

  let conversationsCount = 0;
  let archivedConversationsCount = 0;
  let stepsCount = 0;
  let inputTokens = 0;
  let cacheReadTokens = 0;
  let outputTokens = 0;
  let costActual = 0;
  let costUncachedBaseline = 0;

  for (const [convId, conv] of Object.entries(conversations)) {
    if (!conv || typeof conv !== 'object') continue;
    const days = conv.days || {};
    let convSteps = 0;
    let convIn = 0;
    let convCache = 0;
    let convOut = 0;
    let convCost = 0;

    for (const [dateKey, dayObj] of Object.entries(days)) {
      if (dateKey < startDate || dateKey > endDate) continue;
      activeDayKeys.add(dateKey);

      let dBucket = dayBuckets.get(dateKey);
      if (!dBucket) {
        dBucket = { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, costActual: 0 };
        dayBuckets.set(dateKey, dBucket);
      }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: In routed mode, iterate dayObj.byRawModel (falling back to
// dayObj.byModel on legacy synthetic buckets), price with canonicalModel
// (or per-canonical split buckets) for exact cost conservation, and group
// byModelMap by raw:<slug.toLowerCase()> preserving canonical profile metadata.
// ============================================================================
      const hasRawBuckets =
        isRoutedMode &&
        dayObj?.byRawModel &&
        typeof dayObj.byRawModel === 'object' &&
        Object.keys(dayObj.byRawModel).length > 0;
      const modelEntries = Object.entries(
        hasRawBuckets ? dayObj.byRawModel : dayObj?.byModel || {},
      );

      for (const [entryKey, raw] of modelEntries) {
        let modelName;
        let pricing;
        let priced;
        if (hasRawBuckets) {
          modelName = normalizeModelId(raw?.canonicalModel || entryKey);
          pricing = getPricing(modelName);
          if (raw?.byCanonical && typeof raw.byCanonical === 'object') {
            priced = { costActual: 0, costUncachedBaseline: 0, costSavedByCache: 0 };
            for (const [cModel, cCounts] of Object.entries(raw.byCanonical)) {
              const cPriced = priceBucketWithProfile(cCounts, getPricing(normalizeModelId(cModel)));
              priced.costActual += cPriced.costActual;
              priced.costUncachedBaseline += cPriced.costUncachedBaseline;
              priced.costSavedByCache += cPriced.costSavedByCache;
            }
          } else {
            priced = priceBucketWithProfile(raw, pricing);
          }
        } else {
          modelName = normalizeModelId(entryKey);
          pricing = getPricing(modelName);
          priced = priceBucketWithProfile(raw, pricing);
        }
        const rawIn = (raw.stdIn || 0) + (raw.longIn || 0);
        const rawCache = (raw.stdCache || 0) + (raw.longCache || 0);
        const rawOut = (raw.stdOut || 0) + (raw.longOut || 0);

        stepsCount += raw.steps || 0;
        inputTokens += rawIn;
        cacheReadTokens += rawCache;
        outputTokens += rawOut;
        costActual += priced.costActual;
        costUncachedBaseline += priced.costUncachedBaseline;

        convSteps += raw.steps || 0;
        convIn += rawIn;
        convCache += rawCache;
        convOut += rawOut;
        convCost += priced.costActual;

        dBucket.inputTokens += rawIn;
        dBucket.cacheReadTokens += rawCache;
        dBucket.outputTokens += rawOut;
        dBucket.costActual += priced.costActual;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:35:10
// Description: Merge Tab 2 period byModel rows by canonical profileId/label
// (keeping unknown models separate) and accumulate underlying rawModels.
// ============================================================================
        let mergeKey;
        let mergedLabel;
        if (isRoutedMode) {
          const rawSlug =
            typeof entryKey === 'string' && entryKey.trim() ? entryKey.trim() : modelName;
          mergeKey = `raw:${rawSlug.toLowerCase()}`;
          mergedLabel = rawSlug;
        } else {
          ({ mergeKey, mergedLabel } = resolveByModelMergeIdentity(pricing, modelName));
        }

        let mEntry = byModelMap.get(mergeKey);
        if (!mEntry) {
          mEntry = {
            model: mergedLabel,
            profileId: pricing.profileId,
            profileLabel: pricing.profileLabel,
            rateDisplay: formatRateSummary(pricing),
            _latestDateKey: dateKey,
            _rawModels: new Set(),
            convIds: new Set(),
            inputTokens: 0,
            cacheReadTokens: 0,
            outputTokens: 0,
            costActual: 0,
          };
          byModelMap.set(mergeKey, mEntry);
        } else if (
          isRoutedMode &&
          dateKey > (mEntry._latestDateKey || '') &&
          pricing.profileId !== 'auto'
        ) {
          mEntry.profileId = pricing.profileId;
          mEntry.profileLabel = pricing.profileLabel;
          mEntry.rateDisplay = formatRateSummary(pricing);
          mEntry._latestDateKey = dateKey;
        }
        if (isRoutedMode) {
          if (mergedLabel && !AUTO_UNKNOWN_RE.test(mergedLabel)) {
            mEntry._rawModels.add(mergedLabel);
          }
        } else if (Array.isArray(raw?.rawModels) && raw.rawModels.length > 0) {
          for (const rm of raw.rawModels) {
            if (typeof rm === 'string' && rm && !AUTO_UNKNOWN_RE.test(rm)) {
              mEntry._rawModels.add(rm);
            }
          }
        } else if (entryKey && !AUTO_UNKNOWN_RE.test(entryKey)) {
          mEntry._rawModels.add(entryKey);
        }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:35:10
// ============================================================================
        mEntry.convIds.add(convId);
        mEntry.inputTokens += rawIn;
        mEntry.cacheReadTokens += rawCache;
        mEntry.outputTokens += rawOut;
        mEntry.costActual += priced.costActual;
      }
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================

      if (rangeKey === 'today' && dayObj?.hours) {
        for (const [hrStr, hrModels] of Object.entries(dayObj.hours)) {
          const hr = Number(hrStr);
          if (!Number.isInteger(hr) || hr < 0 || hr > 23) continue;
          const hb = hourBuckets[hr];
          for (const [rawModelName, raw] of Object.entries(hrModels || {})) {
            const modelName = normalizeModelId(rawModelName);
            const priced = priceBucketWithProfile(raw, getPricing(modelName));
            const rawIn = (raw.stdIn || 0) + (raw.longIn || 0);
            const rawCache = (raw.stdCache || 0) + (raw.longCache || 0);
            const rawOut = (raw.stdOut || 0) + (raw.longOut || 0);
            hb.inputTokens += rawIn;
            hb.cacheReadTokens += rawCache;
            hb.outputTokens += rawOut;
            hb.totalTokens += rawIn + rawCache + rawOut;
            hb.costActual += priced.costActual;
          }
        }
      }
    }

    if (convSteps > 0) {
      conversationsCount += 1;
      if (conv.onDisk === false) archivedConversationsCount += 1;

      const meta =
        conv.onDisk !== false
          ? metadataStore?.get?.(convId, { schedule: false, appDataDirs, summariesMap }) || {
              title: '',
              workspace: '',
            }
          : { title: '', workspace: '' };
      if (meta.title && conv.title !== meta.title) {
        conv.title = meta.title;
        ledger?.markDirty?.();
      }
      if (meta.workspace && conv.workspace !== meta.workspace) {
        conv.workspace = meta.workspace;
        ledger?.markDirty?.();
      }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Accumulate per-workspace conversation, step, token, and cost
// totals (empty workspace mapped to '') inside buildPeriodSummary() (C1).
// ============================================================================
      const wsKey = typeof conv.workspace === 'string' ? conv.workspace.trim() : '';
      let wsEntry = byWorkspaceMap.get(wsKey);
      if (!wsEntry) {
        wsEntry = {
          workspace: wsKey,
          conversationsCount: 0,
          stepsCount: 0,
          inputTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
          costActual: 0,
        };
        byWorkspaceMap.set(wsKey, wsEntry);
      }
      wsEntry.conversationsCount += 1;
      wsEntry.stepsCount += convSteps;
      wsEntry.inputTokens += convIn;
      wsEntry.cacheReadTokens += convCache;
      wsEntry.outputTokens += convOut;
      wsEntry.costActual += convCost;
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
      const title = conv.title || conv.fallbackTitle || convId.slice(0, 8);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Expose activeModelLabel and activeRawModel on Tab 2 period
// convSummaries / topConversations items for canonical vs routed UI rendering.
// ============================================================================
      const convActiveModel = normalizeModelId(conv.activeModel || 'Auto');
      const convRawCandidate =
        typeof conv.activeRawModel === 'string' ? conv.activeRawModel.trim() : '';
      const convActiveRawModel =
        convRawCandidate && !AUTO_UNKNOWN_RE.test(convRawCandidate)
          ? convRawCandidate
          : convActiveModel;
      const convActiveModelLabel = resolveCanonicalModelLabel(
        convActiveModel,
        convActiveRawModel,
        runtimeCatalog,
      );
      convSummaries.push({
        conversationId: convId,
        title,
        workspace: conv.workspace || '',
        activeModel: convActiveModel,
        activeModelLabel: convActiveModelLabel,
        activeRawModel: convActiveRawModel,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
        status: conv.onDisk === false ? 'ARCHIVED' : conv.status || 'IDLE',
        onDisk: conv.onDisk !== false,
        contextTotal: conv.latestContextTotal || 0,
        latestTokPerSec: conv.latestTokPerSec ?? null,
        outputTokens: convOut,
        totalTokens: convIn + convCache + convOut,
        costActual: convCost,
        updatedAtMs: conv.updatedAtMs || 0,
        isToday: Boolean(days[todayDate]),
      });
    }
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Clamp buildPeriodSummary date span to MAX_SPAN_DAYS (3650) so
// corrupted historical dates cannot trigger unbounded trend series loops.
// ============================================================================
  const MAX_SPAN_DAYS = 3650;
  let trendGranularity = 'day';
  let series = [];
  if (daysBetweenLocalDates(startDate, endDate) + 1 > MAX_SPAN_DAYS) {
    startDate = shiftLocalDate(endDate, -(MAX_SPAN_DAYS - 1));
  }
  const spanDaysCount = Math.max(1, daysBetweenLocalDates(startDate, endDate) + 1);
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

  if (rangeKey === 'today') {
    trendGranularity = 'hour';
    series = hourBuckets;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:13:00
// Description: Widen daily trend granularity threshold from 60d to 180d.
// ============================================================================
  } else if (spanDaysCount <= 180) {
// ============================================================================
// [MODIFIED END] 2026-11-17 10:13:00
// ============================================================================
    trendGranularity = 'day';
    for (let i = 0; i < spanDaysCount; i++) {
      const dk = shiftLocalDate(startDate, i);
      const b = dayBuckets.get(dk);
      const inT = b?.inputTokens || 0;
      const cacheT = b?.cacheReadTokens || 0;
      const outT = b?.outputTokens || 0;
      series.push({
        key: dk,
        label: dk.slice(5),
        rangeText: dk,
        inputTokens: inT,
        cacheReadTokens: cacheT,
        outputTokens: outT,
        totalTokens: inT + cacheT + outT,
        costActual: b?.costActual || 0,
      });
    }
  } else {
    trendGranularity = 'week';
    for (let offset = 0; offset < spanDaysCount; offset += 7) {
      const wStart = shiftLocalDate(startDate, offset);
      const wEndOffset = Math.min(spanDaysCount - 1, offset + 6);
      const wEnd = shiftLocalDate(startDate, wEndOffset);
      let inT = 0;
      let cacheT = 0;
      let outT = 0;
      let wCost = 0;
      for (let d = offset; d <= wEndOffset; d++) {
        const dk = shiftLocalDate(startDate, d);
        const b = dayBuckets.get(dk);
        if (!b) continue;
        inT += b.inputTokens;
        cacheT += b.cacheReadTokens;
        outT += b.outputTokens;
        wCost += b.costActual;
      }
      series.push({
        key: `${wStart}..${wEnd}`,
        label: wStart.slice(5),
        rangeText: `${wStart} ~ ${wEnd}`,
        inputTokens: inT,
        cacheReadTokens: cacheT,
        outputTokens: outT,
        totalTokens: inT + cacheT + outT,
        costActual: wCost,
      });
    }
  }

  const totalTokens = inputTokens + cacheReadTokens + outputTokens;
  const totalIn = inputTokens + cacheReadTokens;
  const cacheHitRatePct = totalIn > 0 ? (cacheReadTokens / totalIn) * 100 : 0;
  const costSavedByCache = Math.max(0, costUncachedBaseline - costActual);
  const costSavedPct =
    costUncachedBaseline > 0 ? (costSavedByCache / costUncachedBaseline) * 100 : 0;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:35:15
// Description: Serialize sorted non-Auto rawModels onto Tab 2 periods.*.byModel rows.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Add per-model cacheHitRatePct to Tab 2 periods.*.byModel rows.
// ============================================================================
  const byModel = [...byModelMap.values()]
    .map((m) => {
      const totalIn = m.inputTokens + m.cacheReadTokens;
      return {
        model: m.model,
        profileId: m.profileId,
        profileLabel: m.profileLabel,
        rateDisplay: m.rateDisplay,
        rawModels: [...m._rawModels].filter((x) => x && !AUTO_UNKNOWN_RE.test(x)).sort(),
        conversationsCount: m.convIds.size,
        inputTokens: m.inputTokens,
        cacheReadTokens: m.cacheReadTokens,
        outputTokens: m.outputTokens,
        totalTokens: totalIn + m.outputTokens,
        cacheHitRatePct: totalIn > 0 ? (m.cacheReadTokens / totalIn) * 100 : 0,
        costActual: m.costActual,
      };
    })
    .sort((a, b) => b.costActual - a.costActual || b.totalTokens - a.totalTokens);
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 13:35:15
// ============================================================================

  convSummaries.sort((a, b) => b.costActual - a.costActual || b.totalTokens - a.totalTokens);
  const topConversations = convSummaries.slice(0, 20);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Finalize and sort byWorkspace rows (with cacheHitRatePct, sorted
// by costActual desc then totalTokens desc) and expose on period summary (C1).
// ============================================================================
  const byWorkspace = [...byWorkspaceMap.values()]
    .map((w) => {
      const totalIn = w.inputTokens + w.cacheReadTokens;
      return {
        workspace: w.workspace,
        conversationsCount: w.conversationsCount,
        stepsCount: w.stepsCount,
        inputTokens: w.inputTokens,
        cacheReadTokens: w.cacheReadTokens,
        outputTokens: w.outputTokens,
        totalTokens: totalIn + w.outputTokens,
        cacheHitRatePct: totalIn > 0 ? (w.cacheReadTokens / totalIn) * 100 : 0,
        costActual: w.costActual,
      };
    })
    .sort(
      (a, b) =>
        b.costActual - a.costActual ||
        b.totalTokens - a.totalTokens ||
        a.workspace.localeCompare(b.workspace),
    );
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================

  return {
    rangeKey,
    label,
    startDate,
    endDate,
    spanDaysCount,
    activeDaysCount: activeDayKeys.size,
    conversationsCount,
    archivedConversationsCount,
    stepsCount,
    inputTokens,
    cacheReadTokens,
    outputTokens,
    totalTokens,
    cacheHitRatePct,
    costActual,
    costUncachedBaseline,
    costSavedByCache,
    costSavedPct,
    avgDailyCost: costActual / Math.max(1, proratedDays),
    avgDailyTokens: totalTokens / Math.max(1, proratedDays),
    trendGranularity,
    series,
    byModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Include byWorkspace breakdown in period summary payload (C1).
// ============================================================================
    byWorkspace,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
    topConversations,
    subscription: computeSubscriptionComparison(costActual, proratedDays, subInfo),
  };
}

/**
 * Scans conversations via incremental ledger and returns multi-period global stats + top 20 recent sessions.
 */
export function summarizeGlobalAndRecent(options = {}) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:40:00
// Description: Support optional runtimeCatalog in summarizeGlobalAndRecent,
// add totalTokens to recentConversations, and return _observedRawModels.
// ============================================================================
  const prefs = { ...DEFAULT_PREFS, ...(options.prefs || {}) };
  const runtimeCatalog =
    Array.isArray(options?.runtimeCatalog) && options.runtimeCatalog.length > 0
      ? options.runtimeCatalog
      : null;
  const effectivePrefs = runtimeCatalog ? { ...prefs, _runtimeCatalog: runtimeCatalog } : prefs;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const todayDate = formatLocalDate(nowMs);
  const appDataDirs = discoverAppDataDirs(options);

  const ledger = options.ledger || createUsageLedger();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Forward chunked batching options to ledger.sync() and validate
// date keys (>= 2000-01-01) when tracking earliestDate.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Capture summariesMap returned by ledger.sync() so
// summarizeGlobalAndRecent() reuses one read-only map across all rollups (A2).
// ============================================================================
  const {
    onDiskCount,
    pendingRebuildCount = 0,
    summariesMap: syncedSummariesMap,
  } = ledger.sync({
    appDataDirs,
    env: options.env,
    homeDir: options.homeDir,
    timingStore: options.timingStore,
    threshold: Number(effectivePrefs.longContextThreshold) || DEFAULT_PREFS.longContextThreshold,
    maxRebuildBatch: options.maxRebuildBatch,
    priorityConvId: options.priorityConvId,
  });
  const summariesMap = syncedSummariesMap || readConversationSummariesMap(appDataDirs);
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================

  const conversations = ledger.getData().conversations;
  const observedProfiles = new Set();
  const observedRawModels = new Set();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Collect normalized non-Auto models per valid date up to todayDate
// for 14-day window subscription detection without historical tier pollution.
// ============================================================================
  const cutoff14d = shiftLocalDate(todayDate, -13);
  const modelsByDate = new Map();
  let earliestDate = todayDate;
  const onDiskEntries = [];

  for (const [convId, conv] of Object.entries(conversations)) {
    if (!conv || typeof conv !== 'object') continue;
    for (const pid of conv.observedProfiles || []) {
      observedProfiles.add(pid);
    }
    if (typeof conv.activeModel === 'string' && conv.activeModel.trim()) {
      const nm = normalizeModelId(conv.activeModel);
      if (nm && !AUTO_UNKNOWN_RE.test(nm)) observedRawModels.add(nm);
    }
    for (const [dk, dayObj] of Object.entries(conv.days || {})) {
      const validDk = /^\d{4}-\d{2}-\d{2}$/.test(dk) && dk >= '2000-01-01';
      if (validDk && dk < earliestDate) {
        earliestDate = dk;
      }
      const inHistoryWindow = validDk && dk <= todayDate;
      let dateModels = inHistoryWindow ? modelsByDate.get(dk) : null;
      for (const rawModelName of Object.keys(dayObj?.byModel || {})) {
        const nm = normalizeModelId(rawModelName);
        if (!nm || AUTO_UNKNOWN_RE.test(nm)) continue;
        observedRawModels.add(nm);
        if (inHistoryWindow) {
          if (!dateModels) {
            dateModels = new Set();
            modelsByDate.set(dk, dateModels);
          }
          dateModels.add(nm);
        }
      }
    }
    if (conv.onDisk !== false) {
      onDiskEntries.push([convId, conv]);
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Resolve subscription info from 14-day window models with fallback
// to latest 14 active dates and recent on-disk activeModel entries.
// ============================================================================
  const recentSubscriptionModels = new Set();
  for (const [dk, modelSet] of modelsByDate.entries()) {
    if (dk >= cutoff14d) {
      for (const m of modelSet) recentSubscriptionModels.add(m);
    }
  }
  if (recentSubscriptionModels.size === 0 && modelsByDate.size > 0) {
    const latestActiveDates = [...modelsByDate.keys()].sort().reverse().slice(0, 14);
    for (const dk of latestActiveDates) {
      for (const m of modelsByDate.get(dk)) recentSubscriptionModels.add(m);
    }
  }
  if (recentSubscriptionModels.size === 0 && onDiskEntries.length > 0) {
    const recentOnDisk = onDiskEntries.filter(([, conv]) => {
      const updMs = Number(conv.updatedAtMs) || 0;
      if (updMs <= 0) return false;
      const updDate = formatLocalDate(updMs);
      return updDate >= cutoff14d && updDate <= todayDate;
    });
    const fallbackEntries = recentOnDisk.length > 0 ? recentOnDisk : onDiskEntries;
    for (const [, conv] of fallbackEntries) {
      const nm = normalizeModelId(conv.activeModel || '');
      if (nm && !AUTO_UNKNOWN_RE.test(nm)) recentSubscriptionModels.add(nm);
    }
  }

  const subInfo = resolveSubscriptionInfo(effectivePrefs, recentSubscriptionModels);
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
  const start7d = shiftLocalDate(todayDate, -6);
  const start30d = shiftLocalDate(todayDate, -29);
  const allSpanDays = Math.max(1, daysBetweenLocalDates(earliestDate, todayDate) + 1);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Pass reused summariesMap to all 4 buildPeriodSummary() calls
// and recentTop20 metadataStore lookups (A2).
// ============================================================================
  const todayPeriod = buildPeriodSummary({
    rangeKey: 'today',
    label: '今日',
    startDate: todayDate,
    endDate: todayDate,
    proratedDays: 1,
    todayDate,
    conversations,
    prefs: effectivePrefs,
    subInfo,
    metadataStore: options.metadataStore,
    appDataDirs,
    ledger,
    summariesMap,
  });

  const period7d = buildPeriodSummary({
    rangeKey: '7d',
    label: '近 7 天',
    startDate: start7d,
    endDate: todayDate,
    proratedDays: 7,
    todayDate,
    conversations,
    prefs: effectivePrefs,
    subInfo,
    metadataStore: options.metadataStore,
    appDataDirs,
    ledger,
    summariesMap,
  });

  const period30d = buildPeriodSummary({
    rangeKey: '30d',
    label: '近 30 天',
    startDate: start30d,
    endDate: todayDate,
    proratedDays: 30,
    todayDate,
    conversations,
    prefs: effectivePrefs,
    subInfo,
    metadataStore: options.metadataStore,
    appDataDirs,
    ledger,
    summariesMap,
  });

  const periodAll = buildPeriodSummary({
    rangeKey: 'all',
    label: '全部历史',
    startDate: earliestDate,
    endDate: todayDate,
    proratedDays: allSpanDays,
    todayDate,
    conversations,
    prefs: effectivePrefs,
    subInfo,
    metadataStore: options.metadataStore,
    appDataDirs,
    ledger,
    summariesMap,
  });
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================

  // Top 20 most recently updated on-disk conversations with lifetime totals.
  onDiskEntries.sort((a, b) => (b[1].updatedAtMs || 0) - (a[1].updatedAtMs || 0));
  const recentTop20 = onDiskEntries.slice(0, 20);
  const pricingByModel = new Map();
  const getPricing = (m) => {
    if (!pricingByModel.has(m)) pricingByModel.set(m, resolveModelPricing(m, effectivePrefs));
    return pricingByModel.get(m);
  };

  const recentConversations = recentTop20.map(([convId, conv]) => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Pass hasFallback to metadataStore.get() when title or fallbackTitle
// already exists so agentapi CLI fallback is skipped on cold start.
// ============================================================================
    const meta = options.metadataStore?.get?.(convId, {
      schedule: true,
      hasFallback: Boolean(conv.title || conv.fallbackTitle),
      appDataDirs,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Reuse pre-fetched summariesMap in recentTop20 metadata lookup (A2).
// ============================================================================
      summariesMap,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
    }) || {
      title: '',
      workspace: '',
    };
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
    if (meta.title && conv.title !== meta.title) {
      conv.title = meta.title;
      ledger.markDirty();
    }
    if (meta.workspace && conv.workspace !== meta.workspace) {
      conv.workspace = meta.workspace;
      ledger.markDirty();
    }
    let totalIn = 0;
    let totalCache = 0;
    let totalOut = 0;
    let totalCost = 0;
    for (const dayObj of Object.values(conv.days || {})) {
      for (const [rawModelName, raw] of Object.entries(dayObj?.byModel || {})) {
        const modelName = normalizeModelId(rawModelName);
        totalIn += (raw.stdIn || 0) + (raw.longIn || 0);
        totalCache += (raw.stdCache || 0) + (raw.longCache || 0);
        totalOut += (raw.stdOut || 0) + (raw.longOut || 0);
        totalCost += priceBucketWithProfile(raw, getPricing(modelName)).costActual;
      }
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Expose activeModelLabel and activeRawModel on Tab 2 recentConversations
// items so UI rows and C2 model filter switch cleanly between canonical and routed modes.
// ============================================================================
    const convActiveModel = normalizeModelId(conv.activeModel || 'Auto');
    const convRawCandidate =
      typeof conv.activeRawModel === 'string' ? conv.activeRawModel.trim() : '';
    const convActiveRawModel =
      convRawCandidate && !AUTO_UNKNOWN_RE.test(convRawCandidate)
        ? convRawCandidate
        : convActiveModel;
    const convActiveModelLabel = resolveCanonicalModelLabel(
      convActiveModel,
      convActiveRawModel,
      runtimeCatalog,
    );
    return {
      conversationId: convId,
      title: conv.title || conv.fallbackTitle || convId.slice(0, 8),
      workspace: conv.workspace || '',
      activeModel: convActiveModel,
      activeModelLabel: convActiveModelLabel,
      activeRawModel: convActiveRawModel,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
      status: conv.status || 'IDLE',
      onDisk: true,
      contextTotal: conv.latestContextTotal || 0,
      latestTokPerSec: conv.latestTokPerSec ?? null,
      outputTokens: totalOut,
      totalTokens: totalIn + totalCache + totalOut,
      costActual: totalCost,
      updatedAtMs: conv.updatedAtMs || 0,
      isToday: Boolean(conv.days?.[todayDate]),
    };
  });

  const etagParts = onDiskEntries.slice(0, 30).map(([id, c]) => `${id}:${c.cacheKey}`);

  return {
    todayDate,
    todayConversationsCount: todayPeriod.conversationsCount,
    todayInputTokens: todayPeriod.inputTokens,
    todayCacheReadTokens: todayPeriod.cacheReadTokens,
    todayOutputTokens: todayPeriod.outputTokens,
    todayCacheHitRatePct: todayPeriod.cacheHitRatePct,
    todayCostActual: todayPeriod.costActual,
    todayCostSavedByCache: todayPeriod.costSavedByCache,
    todayByModel: todayPeriod.byModel,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:35:18
// Description: Expose todayByWorkspace alongside todayByModel on global summary (C1).
// ============================================================================
    todayByWorkspace: todayPeriod.byWorkspace,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:35:18
// ============================================================================
    recentConversations,
    subscription: subInfo,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:19:56
// Description: Expose ledgerSync chunked sync status and include pendingRebuildCount
// in _etagPart so chunk progress invalidates ETag cleanly.
// ============================================================================
    ledgerSync: {
      syncing: pendingRebuildCount > 0,
      pendingCount: pendingRebuildCount,
      onDiskCount,
    },
    periods: {
      today: todayPeriod,
      '7d': period7d,
      '30d': period30d,
      all: periodAll,
    },
    _observedProfiles: observedProfiles,
    _observedRawModels: [...observedRawModels],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:29:19
// Description: Expose _recentSubscriptionModels for /api/snapshot conversation sync.
// ============================================================================
    _recentSubscriptionModels: recentSubscriptionModels,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:29:19
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-24 09:50:59
// Description: Include modelNameMode in summarizeGlobalAndRecent _etagPart so
// mode switches invalidate snapshots immediately.
// ============================================================================
    _etagPart: `${todayDate}|${onDiskCount}|${Object.keys(conversations).length}|p${pendingRebuildCount}|mn:${resolveModelNameMode(effectivePrefs)}|${etagParts.join(',')}`,
// ============================================================================
// [MODIFIED END] 2026-11-24 09:50:59
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 17:19:56
// ============================================================================
  };
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================
}

// ============================================================================
// [MODIFIED END] 2026-11-16 21:20:00
// ============================================================================
