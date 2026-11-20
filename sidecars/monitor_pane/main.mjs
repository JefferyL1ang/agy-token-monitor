// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 21:25:00
// Description: Sidecar backend entrypoint for Token Monitor v1.2.0. Manages
// monitor_state.json and schema-v2 usage_ledger.json persistence, SQLite DB +
// WAL + transcript live stat watching, per-model pricing prefs, subscription
// ROI comparison, /api/resync-ledger, and code hot-reload.
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Import randomUUID and resolve for release hot-update bootId and pluginRoot resolution.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:37:35
// Description: Import createHash from node:crypto to hash /api/snapshot ETags to a constant 43-char URL-safe digest.
// ============================================================================
import { createHash, randomUUID } from 'node:crypto';
// ============================================================================
// [MODIFIED END] 2026-11-18 16:37:35
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Drop direct mkdirSync/renameSync/writeFileSync imports now that
// state and ledger writes go through shared writeAtomicJsonSafe() (B1).
// ============================================================================
import { existsSync, readFileSync, statSync } from 'node:fs';
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:45:00
// Description: Import homedir to resolve user sidecar_sdk path portably.
// ============================================================================
import { homedir, tmpdir } from 'node:os';
// ============================================================================
// [MODIFIED END] 2026-11-17 10:45:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Import resolve alongside dirname and join from node:path.
// ============================================================================
import { dirname, join, resolve } from 'node:path';
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEFAULT_PREFS,
  MODEL_PRICING_CATALOG,
  SUBSCRIPTION_CATALOG,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:14:00
// Description: Import VALID_LANGUAGES and VALID_TOKEN_UNITS and define
// PREFS_SCHEMA_VERSION = 2 for v0.2.2 preference validation and migration.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Import VALID_CNY_RATE_MODES for daily FX auto-sync vs manual lock.
// ============================================================================
  VALID_CNY_RATE_MODES,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================
  VALID_LANGUAGES,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Import VALID_MODEL_SORT_DIRS and VALID_MODEL_SORT_KEYS from parser.mjs.
// ============================================================================
  VALID_MODEL_SORT_DIRS,
  VALID_MODEL_SORT_KEYS,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
  VALID_TOKEN_UNITS,
// ============================================================================
// [MODIFIED END] 2026-11-17 10:14:00
// ============================================================================
  analyzeConversation,
  buildEffectivePricingCatalog,
  createMetadataStore,
  createUsageLedger,
  discoverAppDataDirs,
  isValidConversationId,
  parseTranscript,
  resolveConversationPaths,
  summarizeGlobalAndRecent,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Import shared Windows-safe writeAtomicJsonSafe() and syncWatchState() from parser.mjs (A3/B1).
// ============================================================================
  syncWatchState,
  writeAtomicJsonSafe,
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================
} from './parser.mjs';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Import createPricingSyncManager for dual-channel official
// model & pricing auto-sync and dynamic profile ID validation.
// ============================================================================
import { createPricingSyncManager } from './pricing_sync.mjs';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Import createReleaseUpdater and initialize pluginRoot, APP_VERSION,
// BOOT_ID, and SKIPPED_RELEASE_TAG_RE for v0.2.4 one-click hot updates.
// ============================================================================
import { createReleaseUpdater } from './release_updater.mjs';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:20
// Description: Import createSystemProxyManager for OS/env HTTP(S) proxy auto-detection.
// ============================================================================
import { createSystemProxyManager } from './net_proxy.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:20
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:30
// Description: Import clipboard_image helpers for /api/copy-receipt PNG validation and OS clipboard write.
// ============================================================================
import { copyPngToSystemClipboard, decodeAndValidatePngBase64 } from './clipboard_image.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:30
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, '..', '..');

function readPluginVersion(rootDir) {
  try {
    const raw = JSON.parse(readFileSync(join(rootDir, 'plugin.json'), 'utf-8'));
    if (typeof raw?.version === 'string' && raw.version.trim()) {
      return raw.version.trim();
    }
  } catch {
    // Fallback to default version below.
  }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:42:30
// Description: Update fallback plugin version string to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Update fallback plugin version string to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:30
// Description: Bump fallback plugin version string to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:37:35
// Description: Bump fallback plugin version string to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Bump fallback plugin version string to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Bump fallback plugin version string to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump fallback plugin version string to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump fallback plugin version string to 0.5.1.
// ============================================================================
  return '0.5.1';
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:21:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:37:35
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:42:30
// ============================================================================
}

const APP_VERSION = readPluginVersion(pluginRoot);
const BOOT_ID = randomUUID();
const SKIPPED_RELEASE_TAG_RE = /^(?:v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|)$/i;
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
const PROFILE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
// ============================================================================
// [MODIFIED END] 2026-11-17 11:42:00
// ============================================================================
const VALID_SUBSCRIPTION_PLANS = new Set(Object.keys(SUBSCRIPTION_CATALOG));
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:14:00
// Description: Add validation sets for tokenUnit/language and schema version 2.
// ============================================================================
const VALID_TOKEN_UNIT_SET = new Set(VALID_TOKEN_UNITS);
const VALID_LANGUAGE_SET = new Set(VALID_LANGUAGES);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Validate cnyRateMode ('auto' | 'manual').
// ============================================================================
const VALID_CNY_RATE_MODE_SET = new Set(VALID_CNY_RATE_MODES);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Create validation sets for modelSortBy and modelSortDir preferences.
// ============================================================================
const VALID_MODEL_SORT_KEY_SET = new Set(VALID_MODEL_SORT_KEYS);
const VALID_MODEL_SORT_DIR_SET = new Set(VALID_MODEL_SORT_DIRS);
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:26:00
// Description: Bump PREFS_SCHEMA_VERSION to 3 so v1/v2 states with default
// softContextLimit=250000 and hardContextLimit=1000000 or 500000 migrate to 400k/500k.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:30:19
// Description: Bump PREFS_SCHEMA_VERSION to 4 so untouched 250k/400k and
// 1M/500k context limits migrate to 409600/512000 while keeping custom limits.
// ============================================================================
const PREFS_SCHEMA_VERSION = 4;
// ============================================================================
// [MODIFIED END] 2026-11-19 13:30:19
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:26:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:14:00
// ============================================================================

function configureStandaloneEnv(argv) {
  let standalone = false;
  let portArg = '';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--standalone') {
      standalone = true;
      const next = argv[i + 1];
      if (next && /^\d+$/.test(next)) {
        portArg = next;
      }
      break;
    }
    if (arg.startsWith('--standalone=')) {
      standalone = true;
      const val = arg.slice('--standalone='.length);
      if (/^\d+$/.test(val)) portArg = val;
      break;
    }
  }
  if (!standalone) return false;

  if (!process.env.ANTIGRAVITY_LS_ADDRESS) {
    process.env.ANTIGRAVITY_LS_ADDRESS = '127.0.0.1:5387';
  }
  if (!process.env.ANTIGRAVITY_CSRF_TOKEN) {
    process.env.ANTIGRAVITY_CSRF_TOKEN = 'standalone';
  }
  if (!process.env.ANTIGRAVITY_SIDECAR_WEB_PORT) {
    process.env.ANTIGRAVITY_SIDECAR_WEB_PORT = String(portArg || 18923);
  }
  return true;
}

const isStandalone = configureStandaloneEnv(process.argv.slice(2));

let sdk;
try {
  sdk = await import('sidecar_sdk');
} catch {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:06:00
// Description: Resolve sidecar_sdk across explicit SIDECAR_SDK_PATH, homedir(),
// and plugin ancestor node_modules without hardcoded usernames.
// ============================================================================
  const sdkCandidates = [
    process.env.SIDECAR_SDK_PATH,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:17:13
// Description: Add Antigravity built-in sidecar_sdk path immediately after
// SIDECAR_SDK_PATH for portable launch without ~/.gemini/config copy.
// ============================================================================
    join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
// ============================================================================
// [MODIFIED END] 2026-11-17 17:17:13
// ============================================================================
    join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    join(__dirname, '..', '..', '..', '..', 'node_modules', 'sidecar_sdk', 'index.mjs'),
  ].filter((p) => typeof p === 'string' && p.trim() && existsSync(p));
  if (sdkCandidates.length === 0) {
    throw new Error('Unable to locate sidecar_sdk; set SIDECAR_SDK_PATH or install in ~/.gemini/config/node_modules/sidecar_sdk.');
  }
  sdk = await import(pathToFileURL(sdkCandidates[0]).href);
// ============================================================================
// [MODIFIED END] 2026-11-17 11:06:00
// ============================================================================
}
const { SidecarApp, Response } = sdk;

const stateDir =
  process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(tmpdir(), 'agy-token-monitor-state');
const statePath = join(stateDir, 'monitor_state.json');
const ledgerPath = join(stateDir, 'usage_ledger.json');

const MAX_TIMING_ENTRIES = 5000;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:20
// Description: Initialize systemProxy manager and resolve initial OS/env proxy
// before pricingSync and releaseUpdater background requests run.
// ============================================================================
const systemProxy = createSystemProxyManager();
systemProxy.refresh();
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:20
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Initialize pricingSync & observedRawModels, validate dynamic
// profile IDs with PROFILE_ID_RE, and preserve saved user modelOverrides across
// upstream pricing updates.
// ============================================================================
const observedRawModels = new Set();
const pricingSync = createPricingSyncManager({
  stateDir,
  baseCatalog: MODEL_PRICING_CATALOG,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Wire beforeNetworkSync hook so background and manual pricing
// syncs refresh TTL-cached proxy state before issuing requests.
// ============================================================================
  beforeNetworkSync: () => systemProxy.refresh(),
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
});
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Initialize releaseUpdater and hotUpdateInProgress flag so
// mid-extraction file writes do not trigger premature codeReloadTimer exit.
// ============================================================================
const releaseUpdater = createReleaseUpdater({
  stateDir,
  pluginRoot,
  currentVersion: APP_VERSION,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Wire proxy refresh/rebuild, transport-failure recovery, and proxy
// status diagnostics into releaseUpdater.
// ============================================================================
  beforeNetworkCheck: ({ manual } = {}) =>
    systemProxy.refresh(manual ? { force: true, rebuild: true } : {}),
  onTransportFailure: () => systemProxy.recoverFromTransportFailure(),
  getProxyStatus: () => systemProxy.getStatus(),
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
});
let hotUpdateInProgress = false;
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================

const FALLBACK_BASE_PROFILE = {
  inputPer1M: 2.0,
  cachedPer1M: 0.2,
  outputPer1M: 10.0,
  longContextTier: false,
};

function sanitizeModelOverrides(
  rawOverrides,
  baseOverrides = {},
  { pruneMatchingDefault = true } = {},
) {
  if (rawOverrides === null) return {};
  if (!rawOverrides || typeof rawOverrides !== 'object') {
    return { ...baseOverrides };
  }
  const runtimeCatalog = pricingSync.getRuntimeCatalog([...observedRawModels]);
  const next = { ...baseOverrides };
  for (const [profileId, rawVal] of Object.entries(rawOverrides)) {
    if (!PROFILE_ID_RE.test(profileId)) continue;
    if (rawVal === null) {
      delete next[profileId];
      continue;
    }
    if (!rawVal || typeof rawVal !== 'object') continue;
    const matchedProfile = runtimeCatalog.find((p) => p.id === profileId);
    const baseProfile = matchedProfile || FALLBACK_BASE_PROFILE;
    const prevOverride = next[profileId] || {};
    const entry = {
      inputPer1M: prevOverride.inputPer1M ?? baseProfile.inputPer1M,
      cachedPer1M: prevOverride.cachedPer1M ?? baseProfile.cachedPer1M,
      outputPer1M: prevOverride.outputPer1M ?? baseProfile.outputPer1M,
      longContextTier:
        typeof prevOverride.longContextTier === 'boolean'
          ? prevOverride.longContextTier
          : baseProfile.longContextTier,
    };
    if (rawVal.inputPer1M !== undefined) {
      const n = Number(rawVal.inputPer1M);
      if (Number.isFinite(n) && n >= 0 && n <= 10000) entry.inputPer1M = n;
    }
    if (rawVal.cachedPer1M !== undefined) {
      const n = Number(rawVal.cachedPer1M);
      if (Number.isFinite(n) && n >= 0 && n <= 10000) entry.cachedPer1M = n;
    }
    if (rawVal.outputPer1M !== undefined) {
      const n = Number(rawVal.outputPer1M);
      if (Number.isFinite(n) && n >= 0 && n <= 10000) entry.outputPer1M = n;
    }
    if (typeof rawVal.longContextTier === 'boolean') {
      entry.longContextTier = rawVal.longContextTier;
    }
    const matchesDefault =
      pruneMatchingDefault &&
      Boolean(matchedProfile) &&
      Math.abs(entry.inputPer1M - baseProfile.inputPer1M) < 1e-9 &&
      Math.abs(entry.cachedPer1M - baseProfile.cachedPer1M) < 1e-9 &&
      Math.abs(entry.outputPer1M - baseProfile.outputPer1M) < 1e-9 &&
      entry.longContextTier === baseProfile.longContextTier;
    if (matchesDefault) {
      delete next[profileId];
    } else {
      next[profileId] = entry;
    }
  }
  return next;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 11:42:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:14:00
// Description: Validate tokenUnit and language prefs, auto-migrate v1
// untouched 250k/1M defaults to 400k/500k (prefsSchemaVersion = 2), and persist
// migrated state immediately on startup.
// ============================================================================
function sanitizeLoadedPrefs(rawPrefs) {
  const merged = {
    softContextLimit: DEFAULT_PREFS.softContextLimit,
    hardContextLimit: DEFAULT_PREFS.hardContextLimit,
    currency: DEFAULT_PREFS.currency,
    cnyRate: DEFAULT_PREFS.cnyRate,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Include cnyRateMode default in sanitizeLoadedPrefs.
// ============================================================================
    cnyRateMode: DEFAULT_PREFS.cnyRateMode,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================
    tokenUnit: DEFAULT_PREFS.tokenUnit,
    language: DEFAULT_PREFS.language,
    subscriptionPlan: DEFAULT_PREFS.subscriptionPlan,
    customSubscriptionMonthlyUsd: DEFAULT_PREFS.customSubscriptionMonthlyUsd,
    longContextThreshold: DEFAULT_PREFS.longContextThreshold,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Include skippedReleaseTag default in sanitizeLoadedPrefs.
// ============================================================================
    skippedReleaseTag: DEFAULT_PREFS.skippedReleaseTag,
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Include modelSortBy and modelSortDir defaults in sanitizeLoadedPrefs.
// ============================================================================
    modelSortBy: DEFAULT_PREFS.modelSortBy,
    modelSortDir: DEFAULT_PREFS.modelSortDir,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Include pixelOfficeCollapsed default in sanitizeLoadedPrefs.
// ============================================================================
    pixelOfficeCollapsed: DEFAULT_PREFS.pixelOfficeCollapsed,
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
    modelOverrides: {},
  };
  if (!rawPrefs || typeof rawPrefs !== 'object') return merged;

  const numFields = [
    ['softContextLimit', 1, 100000000],
    ['hardContextLimit', 1, 100000000],
    ['cnyRate', 0.01, 1000],
    ['customSubscriptionMonthlyUsd', 0, 100000],
    ['longContextThreshold', 1, 100000000],
  ];
  for (const [key, min, max] of numFields) {
    const val = Number(rawPrefs[key]);
    if (Number.isFinite(val) && val >= min && val <= max) {
      merged[key] = val;
    }
  }
  if (merged.hardContextLimit < merged.softContextLimit) {
    merged.hardContextLimit = merged.softContextLimit;
  }
  if (rawPrefs.currency === 'USD' || rawPrefs.currency === 'CNY') {
    merged.currency = rawPrefs.currency;
  }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Restore persisted cnyRateMode when valid.
// ============================================================================
  if (
    typeof rawPrefs.cnyRateMode === 'string' &&
    VALID_CNY_RATE_MODE_SET.has(rawPrefs.cnyRateMode)
  ) {
    merged.cnyRateMode = rawPrefs.cnyRateMode;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================
  if (typeof rawPrefs.tokenUnit === 'string' && VALID_TOKEN_UNIT_SET.has(rawPrefs.tokenUnit)) {
    merged.tokenUnit = rawPrefs.tokenUnit;
  }
  if (typeof rawPrefs.language === 'string' && VALID_LANGUAGE_SET.has(rawPrefs.language)) {
    merged.language = rawPrefs.language;
  }
  if (
    typeof rawPrefs.subscriptionPlan === 'string' &&
    VALID_SUBSCRIPTION_PLANS.has(rawPrefs.subscriptionPlan)
  ) {
    merged.subscriptionPlan = rawPrefs.subscriptionPlan;
  }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Restore persisted skippedReleaseTag when valid semver tag or empty.
// ============================================================================
  if (typeof rawPrefs.skippedReleaseTag === 'string') {
    const trimmedSkipped = rawPrefs.skippedReleaseTag.trim();
    if (trimmedSkipped.length <= 64 && SKIPPED_RELEASE_TAG_RE.test(trimmedSkipped)) {
      merged.skippedReleaseTag = trimmedSkipped;
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Restore persisted modelSortBy and modelSortDir when valid.
// ============================================================================
  if (
    typeof rawPrefs.modelSortBy === 'string' &&
    VALID_MODEL_SORT_KEY_SET.has(rawPrefs.modelSortBy)
  ) {
    merged.modelSortBy = rawPrefs.modelSortBy;
  }
  if (
    typeof rawPrefs.modelSortDir === 'string' &&
    VALID_MODEL_SORT_DIR_SET.has(rawPrefs.modelSortDir)
  ) {
    merged.modelSortDir = rawPrefs.modelSortDir;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Restore persisted pixelOfficeCollapsed boolean in sanitizeLoadedPrefs.
// ============================================================================
  if (typeof rawPrefs.pixelOfficeCollapsed === 'boolean') {
    merged.pixelOfficeCollapsed = rawPrefs.pixelOfficeCollapsed;
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Preserve persisted user modelOverrides on load without pruning
// against updated upstream synced defaults.
// ============================================================================
  merged.modelOverrides = sanitizeModelOverrides(rawPrefs.modelOverrides, {}, {
    pruneMatchingDefault: false,
  });
// ============================================================================
// [MODIFIED END] 2026-11-17 11:42:00
// ============================================================================
  return merged;
}

function loadState() {
  const fallback = { stepEndTimes: {}, prefs: sanitizeLoadedPrefs(null), migrated: false };
  if (!existsSync(statePath)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
    if (!raw || typeof raw !== 'object') return fallback;
    const stepEndTimes = {};
    if (raw.stepEndTimes && typeof raw.stepEndTimes === 'object') {
      const entries = Object.entries(raw.stepEndTimes).slice(-MAX_TIMING_ENTRIES);
      for (const [k, v] of entries) {
        if (typeof k === 'string' && Number.isFinite(Number(v))) {
          stepEndTimes[k] = Number(v);
        }
      }
    }
    const prefs = sanitizeLoadedPrefs(raw.prefs);
    let migrated = false;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:26:00
// Description: Migrate v1/v2 states when softContextLimit is untouched 250k
// and hardContextLimit is 1M or 500k, while preserving other custom limits.
// ============================================================================
    const loadedSchemaVer = Number(raw.prefsSchemaVersion || 1);
    if (!Number.isFinite(loadedSchemaVer) || loadedSchemaVer < PREFS_SCHEMA_VERSION) {
      migrated = true;
      const rawSoft = raw.prefs?.softContextLimit;
      const rawHard = raw.prefs?.hardContextLimit;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:30:19
// Description: Migrate untouched v1/v2/v3 default context limits
// (250k/400k soft and 1M/500k hard) to 409600/512000.
// ============================================================================
      const isUntouchedSoft =
        rawSoft === undefined || Number(rawSoft) === 250000 || Number(rawSoft) === 400000;
      const isLegacyHard =
        rawHard === undefined || Number(rawHard) === 1000000 || Number(rawHard) === 500000;
      if (isUntouchedSoft && isLegacyHard) {
        prefs.softContextLimit = 409600;
        prefs.hardContextLimit = 512000;
      }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:30:19
// ============================================================================
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:26:00
// ============================================================================
    return {
      stepEndTimes,
      prefs,
      migrated,
    };
  } catch {
    return fallback;
  }
}

function loadLedgerInitial() {
  if (!existsSync(ledgerPath)) return null;
  try {
    return JSON.parse(readFileSync(ledgerPath, 'utf-8'));
  } catch {
    return null;
  }
}

const loadedState = loadState();
const state = {
  stepEndTimes: loadedState.stepEndTimes,
  prefs: loadedState.prefs,
};
const usageLedger = createUsageLedger(loadLedgerInitial());
let prefsVersion = 1;
let stateDirty = false;
let lastSavedMs = 0;
let lastLedgerSavedMs = 0;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Use shared writeAtomicJsonSafe() with Windows EPERM/EACCES/EBUSY
// fallback + .tmp cleanup for state and ledger persistence (B1).
// ============================================================================
function writeAtomicJson(targetPath, payload) {
  writeAtomicJsonSafe(targetPath, payload);
}

function persistStateNow() {
  try {
    writeAtomicJsonSafe(
      statePath,
      {
        prefsSchemaVersion: PREFS_SCHEMA_VERSION,
        stepEndTimes: state.stepEndTimes,
        prefs: state.prefs,
      },
      { pretty: true },
    );
    stateDirty = false;
    lastSavedMs = Date.now();
  } catch (err) {
    console.error(`[monitor_pane] failed to persist state: ${err.message}`);
  }
}
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================

if (loadedState.migrated) {
  persistStateNow();
}
// ============================================================================
// [MODIFIED END] 2026-11-17 10:14:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Sync state.prefs.cnyRate with pricingSync.getSyncedCnyRate()
// whenever cnyRateMode !== 'manual' and a valid online rate is available.
// ============================================================================
function applyAutoSyncedFxIfNeeded({ persistImmediately = false } = {}) {
  if (state.prefs.cnyRateMode === 'manual') return false;
  const syncedFx = pricingSync.getSyncedCnyRate();
  if (!Number.isFinite(syncedFx) || syncedFx <= 0) return false;
  if (Math.abs(Number(state.prefs.cnyRate) - syncedFx) <= 1e-6) return false;
  state.prefs.cnyRate = syncedFx;
  prefsVersion += 1;
  if (persistImmediately) {
    persistStateNow();
  } else {
    stateDirty = true;
  }
  return true;
}

applyAutoSyncedFxIfNeeded({ persistImmediately: true });
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================

function persistLedgerNow() {
  if (!usageLedger.isDirty()) return;
  try {
    writeAtomicJson(ledgerPath, usageLedger.getData());
    usageLedger.markSaved();
    lastLedgerSavedMs = Date.now();
  } catch (err) {
    console.error(`[monitor_pane] failed to persist ledger: ${err.message}`);
  }
}

function validateAndMergePrefs(currentPrefs, input) {
  if (!input || typeof input !== 'object') {
    return { error: 'Request body must be a JSON object.' };
  }
  const next = {
    ...currentPrefs,
    modelOverrides: { ...(currentPrefs.modelOverrides || {}) },
  };

  const parseNum = (key, min, max) => {
    if (input[key] === undefined) return true;
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < min || n > max) {
      return `${key} must be a finite number between ${min} and ${max}.`;
    }
    next[key] = n;
    return true;
  };

  const checks = [
    parseNum('softContextLimit', 1, 100000000),
    parseNum('hardContextLimit', 1, 100000000),
    parseNum('cnyRate', 0.01, 1000),
    parseNum('customSubscriptionMonthlyUsd', 0, 100000),
    parseNum('longContextThreshold', 1, 100000000),
  ];
  for (const c of checks) {
    if (c !== true) return { error: c };
  }

  if (next.hardContextLimit < next.softContextLimit) {
    return { error: 'hardContextLimit must be greater than or equal to softContextLimit.' };
  }

  if (input.currency !== undefined) {
    if (input.currency !== 'USD' && input.currency !== 'CNY') {
      return { error: 'currency must be USD or CNY.' };
    }
    next.currency = input.currency;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Validate optional cnyRateMode and apply synced FX rate when set to 'auto'.
// ============================================================================
  if (input.cnyRateMode !== undefined) {
    if (
      typeof input.cnyRateMode !== 'string' ||
      !VALID_CNY_RATE_MODE_SET.has(input.cnyRateMode)
    ) {
      return { error: 'cnyRateMode must be auto or manual.' };
    }
    next.cnyRateMode = input.cnyRateMode;
  }

  if (next.cnyRateMode !== 'manual') {
    const syncedFx = pricingSync.getSyncedCnyRate();
    if (Number.isFinite(syncedFx) && syncedFx > 0) {
      next.cnyRate = syncedFx;
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:14:00
// Description: Validate optional tokenUnit and language fields in /api/prefs.
// ============================================================================
  if (input.tokenUnit !== undefined) {
    if (typeof input.tokenUnit !== 'string' || !VALID_TOKEN_UNIT_SET.has(input.tokenUnit)) {
      return { error: 'tokenUnit must be one of auto, wan_yi, exact, or m.' };
    }
    next.tokenUnit = input.tokenUnit;
  }

  if (input.language !== undefined) {
    if (typeof input.language !== 'string' || !VALID_LANGUAGE_SET.has(input.language)) {
      return { error: 'language must be zh or en.' };
    }
    next.language = input.language;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:14:00
// ============================================================================

  if (input.subscriptionPlan !== undefined) {
    if (
      typeof input.subscriptionPlan !== 'string' ||
      !VALID_SUBSCRIPTION_PLANS.has(input.subscriptionPlan)
    ) {
      return { error: 'subscriptionPlan is invalid.' };
    }
    next.subscriptionPlan = input.subscriptionPlan;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Validate optional skippedReleaseTag preference in /api/prefs.
// ============================================================================
  if (input.skippedReleaseTag !== undefined) {
    if (typeof input.skippedReleaseTag !== 'string') {
      return { error: 'skippedReleaseTag must be a string.' };
    }
    const trimmedSkipped = input.skippedReleaseTag.trim();
    if (trimmedSkipped.length > 64 || !SKIPPED_RELEASE_TAG_RE.test(trimmedSkipped)) {
      return { error: 'skippedReleaseTag must be empty or a valid semver release tag.' };
    }
    next.skippedReleaseTag = trimmedSkipped;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Validate optional modelSortBy and modelSortDir fields in /api/prefs.
// ============================================================================
  if (input.modelSortBy !== undefined) {
    if (
      typeof input.modelSortBy !== 'string' ||
      !VALID_MODEL_SORT_KEY_SET.has(input.modelSortBy)
    ) {
      return { error: 'modelSortBy must be cost or total.' };
    }
    next.modelSortBy = input.modelSortBy;
  }
  if (input.modelSortDir !== undefined) {
    if (
      typeof input.modelSortDir !== 'string' ||
      !VALID_MODEL_SORT_DIR_SET.has(input.modelSortDir)
    ) {
      return { error: 'modelSortDir must be desc or asc.' };
    }
    next.modelSortDir = input.modelSortDir;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Validate optional pixelOfficeCollapsed boolean preference in /api/prefs.
// ============================================================================
  if (input.pixelOfficeCollapsed !== undefined) {
    if (typeof input.pixelOfficeCollapsed !== 'boolean') {
      return { error: 'pixelOfficeCollapsed must be a boolean.' };
    }
    next.pixelOfficeCollapsed = input.pixelOfficeCollapsed;
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================

  if (input.resetAllModels === true) {
    next.modelOverrides = {};
  } else if (input.modelOverrides !== undefined) {
    if (input.modelOverrides !== null && typeof input.modelOverrides !== 'object') {
      return { error: 'modelOverrides must be an object or null.' };
    }
    if (input.modelOverrides && typeof input.modelOverrides === 'object') {
      for (const [pid, val] of Object.entries(input.modelOverrides)) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Validate modelOverrides profile IDs dynamically via PROFILE_ID_RE.
// ============================================================================
        if (!PROFILE_ID_RE.test(pid)) {
          return { error: `Unknown model profile: ${pid}` };
        }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:42:00
// ============================================================================
        if (val !== null && typeof val === 'object') {
          for (const field of ['inputPer1M', 'cachedPer1M', 'outputPer1M']) {
            if (val[field] !== undefined) {
              const numVal = Number(val[field]);
              if (!Number.isFinite(numVal) || numVal < 0 || numVal > 10000) {
                return { error: `${pid}.${field} must be between 0 and 10000.` };
              }
            }
          }
          if (val.longContextTier !== undefined && typeof val.longContextTier !== 'boolean') {
            return { error: `${pid}.longContextTier must be a boolean.` };
          }
        }
      }
    }
    next.modelOverrides = sanitizeModelOverrides(input.modelOverrides, next.modelOverrides);
  }

  return { prefs: next };
}

const timingStore = {
  getEndMs(convId, stepIndex) {
    const v = state.stepEndTimes[`${convId}:${stepIndex}`];
    return Number.isFinite(v) ? v : undefined;
  },
  recordEndMs(convId, stepIndex, ms) {
    if (!Number.isFinite(ms)) return;
    const key = `${convId}:${stepIndex}`;
    if (Object.hasOwn(state.stepEndTimes, key)) return;
    const keys = Object.keys(state.stepEndTimes);
    if (keys.length >= MAX_TIMING_ENTRIES) {
      delete state.stepEndTimes[keys[0]];
    }
    state.stepEndTimes[key] = ms;
    stateDirty = true;
  },
};

const metadataStore = createMetadataStore();

function readStaticAsset(filename, contentType) {
  const filePath = join(__dirname, filename);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return new Response(content, { contentType });
  } catch {
    return new Response('Not found', { status: 404, contentType: 'text/plain; charset=utf-8' });
  }
}

const app = new SidecarApp();

app.page('/', () => readStaticAsset('index.html', 'text/html; charset=utf-8'));
app.page('/styles.css', () => readStaticAsset('styles.css', 'text/css; charset=utf-8'));
app.page('/app.js', () => readStaticAsset('app.js', 'application/javascript; charset=utf-8'));
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:42:30
// Description: Register static asset route /receipt.js for Session Checkout Receipt Canvas renderer.
// ============================================================================
app.page('/receipt.js', () => readStaticAsset('receipt.js', 'application/javascript; charset=utf-8'));
// ============================================================================
// [MODIFIED END] 2026-11-18 11:42:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Register static asset route /pixel_office.js for Pixel Office Canvas renderer.
// ============================================================================
app.page('/pixel_office.js', () => readStaticAsset('pixel_office.js', 'application/javascript; charset=utf-8'));
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================

// Live transcript watcher state
const watchedConvIds = new Set();
if (isValidConversationId(app.config.conversationId)) {
  watchedConvIds.add(app.config.conversationId);
}
const watcherLastStat = new Map(); // convId -> statKey
const watcherSeenSteps = new Map(); // convId -> Set<step_index>

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Replace unbounded watchedConvIds growth with syncWatchedConvIds()
// delegating to syncWatchState() so only active/non-ended conversations remain
// watched and stale entries are pruned from watcherLastStat and watcherSeenSteps (A3).
// ============================================================================
function syncWatchedConvIds(nextIds) {
  syncWatchState(watchedConvIds, watcherLastStat, watcherSeenSteps, nextIds);
}
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================

function statSig(filePath) {
  if (!filePath) return { mtimeMs: 0, size: -1 };
  try {
    const s = statSync(filePath);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return { mtimeMs: 0, size: -1 };
  }
}

function pollWatchedTranscripts() {
  if (watchedConvIds.size === 0) return;
  const appDataDirs = discoverAppDataDirs();
  for (const convId of watchedConvIds) {
    const paths = resolveConversationPaths(convId, appDataDirs);
    if (!paths) continue;
    const dbStat = statSig(paths.dbPath);
    const walStat = statSig(paths.walPath);
    const tStat = statSig(paths.transcriptPath);
    if (dbStat.size < 0 && tStat.size < 0) continue;

    const statKey = `${dbStat.mtimeMs}:${dbStat.size}|${walStat.mtimeMs}:${walStat.size}|${tStat.mtimeMs}:${tStat.size}`;
    if (watcherLastStat.get(convId) === statKey) continue;
    watcherLastStat.set(convId, statKey);

    const latestMtimeMs = Math.max(dbStat.mtimeMs, walStat.mtimeMs, tStat.mtimeMs);
    const parsed = parseTranscript(convId, paths);
    if (!parsed || parsed.steps.length === 0) continue;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:14:00
// Description: Prevent pollWatchedTranscripts from recording streaming
// stat.mtimeMs as stepEndTimes for DB-backed conversations (which causes
// premature firstTokenAtMs speed spikes); only record completedAtMs when present.
// ============================================================================
    const resolveWatcherEndMs = (step) => {
      const hasValidCompleted =
        Number.isFinite(step.completedAtMs) &&
        (step.createdAtMs === null || step.completedAtMs >= step.createdAtMs);
      if (parsed.hasDbTelemetry) {
        return hasValidCompleted ? step.completedAtMs : null;
      }
      return hasValidCompleted ? step.completedAtMs : latestMtimeMs;
    };

    let seenSet = watcherSeenSteps.get(convId);
    if (!seenSet) {
      seenSet = new Set(parsed.steps.map((s) => s.step_index));
      watcherSeenSteps.set(convId, seenSet);
      const last = parsed.steps[parsed.steps.length - 1];
      const endMs = resolveWatcherEndMs(last);
      if (
        last.type === 'PLANNER_RESPONSE' &&
        Number.isFinite(endMs) &&
        (last.createdAtMs === null || endMs >= last.createdAtMs)
      ) {
        timingStore.recordEndMs(convId, last.step_index, endMs);
      }
      continue;
    }

    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      if (seenSet.has(step.step_index)) continue;
      seenSet.add(step.step_index);
      if (step.type === 'PLANNER_RESPONSE') {
        const hasGenericAfter = parsed.steps.slice(i + 1).some((s) => s.type === 'GENERIC');
        const endMs = resolveWatcherEndMs(step);
        if (
          !hasGenericAfter &&
          Number.isFinite(endMs) &&
          (step.createdAtMs === null || endMs >= step.createdAtMs)
        ) {
          timingStore.recordEndMs(convId, step.step_index, endMs);
        }
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 10:14:00
// ============================================================================
  }

  if (stateDirty && Date.now() - lastSavedMs >= 500) {
    persistStateNow();
  }
}

const watcherTimer = setInterval(pollWatchedTranscripts, 400);

// Self-reload check when sidecar code files are updated on disk in Antigravity runtime.
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Watch pricing_sync.mjs for hot-reload and integrate dynamic
// runtimeCatalog, daily auto-sync, /api/snapshot pricingSync status, and
// POST /api/sync-pricing.
// ============================================================================
const watchedCodePaths = [
  join(__dirname, 'main.mjs'),
  join(__dirname, 'parser.mjs'),
  join(__dirname, 'pricing_sync.mjs'),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Watch release_updater.mjs and pause codeReloadTimer while
// hotUpdateInProgress is true so mid-update extraction completes atomically.
// ============================================================================
  join(__dirname, 'release_updater.mjs'),
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:20
// Description: Watch net_proxy.mjs for sidecar hot-reload on disk updates.
// ============================================================================
  join(__dirname, 'net_proxy.mjs'),
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:20
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:30
// Description: Watch clipboard_image.mjs for sidecar hot-reload on disk updates.
// ============================================================================
  join(__dirname, 'clipboard_image.mjs'),
// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:30
// ============================================================================
];
const initialCodeMtimes = new Map(
  watchedCodePaths.map((p) => {
    try {
      return [p, statSync(p).mtimeMs];
    } catch {
      return [p, 0];
    }
  }),
);
const codeReloadTimer = !isStandalone
  ? setInterval(() => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Guard codeReloadTimer callback against mid-extraction premature exit.
// ============================================================================
      if (hotUpdateInProgress) return;
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
      for (const p of watchedCodePaths) {
        try {
          const s = statSync(p);
          const init = initialCodeMtimes.get(p);
          if (s.size > 0 && init && s.mtimeMs !== init) {
            console.log(`[monitor_pane] code updated on disk (${p}), exiting for clean respawn`);
            shutdown();
            break;
          }
        } catch {
          // File temporarily absent during copy; check again next tick.
        }
      }
    }, 2000)
  : null;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:17:13
// Description: Add chunked background ledger pump and make /api/snapshot
// resilient (<200ms cold-start batching, global recent fallback, and try/catch
// error isolation for analyzeConversation and top-level snapshot handling).
// ============================================================================
const SNAPSHOT_SYNC_BATCH = 25;
const BG_LEDGER_BATCH = 25;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Throttle periodic streaming usage_ledger.json flushes to 8s
// while retaining immediate flush on rebuild completion, resync, and shutdown (B1).
// ============================================================================
const LEDGER_PERSIST_THROTTLE_MS = 8000;
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================
let bgLedgerTimer = null;
let isShuttingDown = false;

function scheduleBackgroundLedgerPump() {
  if (isShuttingDown || bgLedgerTimer) return;
  bgLedgerTimer = setTimeout(() => {
    bgLedgerTimer = null;
    if (isShuttingDown) return;
    try {
      const res = usageLedger.sync({
        threshold: state.prefs.longContextThreshold,
        timingStore,
        maxRebuildBatch: BG_LEDGER_BATCH,
      });
      if (res.pendingRebuildCount > 0) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Apply LEDGER_PERSIST_THROTTLE_MS (8s) during background rebuild batches (B1).
// ============================================================================
        if (usageLedger.isDirty() && Date.now() - lastLedgerSavedMs >= LEDGER_PERSIST_THROTTLE_MS) {
          persistLedgerNow();
        }
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================
        prefsVersion += 1;
        scheduleBackgroundLedgerPump();
      } else {
        if (usageLedger.isDirty()) persistLedgerNow();
        prefsVersion += 1;
      }
    } catch (err) {
      console.error('[monitor_pane] background ledger sync failed:', err?.message || err);
    }
  }, 15);
}

app.api(
  '/api/snapshot',
  (data) => {
    try {
      const boundConversationId = isValidConversationId(app.config.conversationId)
        ? app.config.conversationId
        : '';
      const requestedConv = typeof data?.conv === 'string' ? data.conv.trim() : '';
      if (requestedConv && !isValidConversationId(requestedConv)) {
        return new Response(JSON.stringify({ error: 'Invalid conversation ID' }), {
          status: 400,
          contentType: 'application/json',
        });
      }

      const prelimTargetConv = requestedConv || boundConversationId;
      let runtimeCatalog = pricingSync.getRuntimeCatalog([...observedRawModels]);

      let globalRaw = summarizeGlobalAndRecent({
        prefs: state.prefs,
        timingStore,
        metadataStore,
        ledger: usageLedger,
        runtimeCatalog,
        maxRebuildBatch: SNAPSHOT_SYNC_BATCH,
        priorityConvId: prelimTargetConv,
      });

      if (globalRaw.ledgerSync?.syncing) {
        scheduleBackgroundLedgerPump();
      }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Throttle streaming ledger persistence to LEDGER_PERSIST_THROTTLE_MS (8s)
// and defer watchedConvIds update to syncWatchedConvIds() after currentRaw builds (A3/B1).
// ============================================================================
      if (usageLedger.isDirty() && Date.now() - lastLedgerSavedMs >= LEDGER_PERSIST_THROTTLE_MS) {
        persistLedgerNow();
      }

      const targetConv =
        requestedConv ||
        boundConversationId ||
        globalRaw.recentConversations[0]?.conversationId ||
        '';
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================

      let currentRaw = null;
      if (targetConv) {
        try {
          currentRaw = analyzeConversation(targetConv, {
            prefs: state.prefs,
            timingStore,
            metadataStore,
            observedProfiles: globalRaw._observedProfiles,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Pass 14-day recent subscription raw models into first analyzeConversation call.
// ============================================================================
            observedSubscriptionModels: globalRaw._recentSubscriptionModels,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
            runtimeCatalog,
          });
        } catch (err) {
          console.error(
            `[monitor_pane] analyzeConversation(${targetConv}) failed: ${err?.stack || err}`,
          );
          currentRaw = null;
        }
      }

      const prevObservedSize = observedRawModels.size;
      if (Array.isArray(globalRaw._observedRawModels)) {
        for (const m of globalRaw._observedRawModels) {
          if (typeof m === 'string' && m.trim() && !/^(?:auto|unknown|none)$/i.test(m.trim())) {
            observedRawModels.add(m.trim());
          }
        }
      }
      if (Array.isArray(currentRaw?.totals?.byModel)) {
        for (const entry of currentRaw.totals.byModel) {
          const m = typeof entry?.model === 'string' ? entry.model.trim() : '';
          if (m && !/^(?:auto|unknown|none)$/i.test(m)) {
            observedRawModels.add(m);
          }
        }
      }
      if (currentRaw?.activeModel && !/^(?:auto|unknown|none)$/i.test(currentRaw.activeModel)) {
        observedRawModels.add(currentRaw.activeModel);
      }

      if (observedRawModels.size > prevObservedSize) {
        const nextCatalog = pricingSync.getRuntimeCatalog([...observedRawModels]);
        if (nextCatalog.length !== runtimeCatalog.length) {
          runtimeCatalog = nextCatalog;
          globalRaw = summarizeGlobalAndRecent({
            prefs: state.prefs,
            timingStore,
            metadataStore,
            ledger: usageLedger,
            runtimeCatalog,
            maxRebuildBatch: SNAPSHOT_SYNC_BATCH,
            priorityConvId: targetConv,
          });
          if (globalRaw.ledgerSync?.syncing) {
            scheduleBackgroundLedgerPump();
          }
          if (targetConv) {
            try {
              currentRaw = analyzeConversation(targetConv, {
                prefs: state.prefs,
                timingStore,
                metadataStore,
                observedProfiles: globalRaw._observedProfiles,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Pass 14-day recent subscription raw models into refreshed analyzeConversation call.
// ============================================================================
                observedSubscriptionModels: globalRaw._recentSubscriptionModels,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
                runtimeCatalog,
              });
            } catch (err) {
              console.error(
                `[monitor_pane] analyzeConversation(${targetConv}) failed: ${err?.stack || err}`,
              );
              currentRaw = null;
            }
          }
        } else {
          runtimeCatalog = nextCatalog;
        }
      }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:20
// Description: Refresh TTL-cached system proxy settings before daily sync and update checks.
// ============================================================================
      systemProxy.refresh();
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:20
// ============================================================================

      pricingSync.maybeTriggerDailySync([...observedRawModels], () => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Apply newly synced USD-to-CNY rate on background daily sync completion.
// ============================================================================
        applyAutoSyncedFxIfNeeded({ persistImmediately: true });
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================
        prefsVersion += 1;
      });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:39:50
// Description: Sync watchedConvIds to only current/bound conv + non-ended active
// watch IDs and prune stale watcherLastStat/watcherSeenSteps entries (A3).
// ============================================================================
      syncWatchedConvIds([
        boundConversationId,
        targetConv,
        ...(Array.isArray(currentRaw?._activeWatchIds) ? currentRaw._activeWatchIds : []),
      ]);
// ============================================================================
// [MODIFIED END] 2026-11-20 15:39:50
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Trigger periodic 4h background release check, compute updateStatus,
// include release state in snapshot ETag, and expose appVersion, bootId, and updateStatus.
// ============================================================================
      releaseUpdater.maybeCheckForUpdates(() => {
        prefsVersion += 1;
      });
      const updateStatus = releaseUpdater.getPublicStatus(state.prefs.skippedReleaseTag);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:37:35
// Description: Hash snapshot rawEtag with SHA-256 base64url to keep /api/snapshot query ETag at constant 43 chars and avoid exceeding Node.js 16 KB request header/URL limit.
// ============================================================================
      const rawEtag = [
        targetConv || '-',
        `p${prefsVersion}`,
        `m${metadataStore.getVersion()}`,
        currentRaw?._etagPart || '-',
        globalRaw._etagPart || '-',
        `u:${updateStatus.latestTag}:${updateStatus.shouldPrompt ? 1 : 0}:${updateStatus.checking ? 1 : 0}`,
      ].join('|');
      const etag = createHash('sha256').update(rawEtag).digest('base64url');
// ============================================================================
// [MODIFIED END] 2026-11-18 16:37:35
// ============================================================================

      const serverTimeMs = Date.now();
      if (data?.etag && data.etag === etag) {
        return { unchanged: true, etag, serverTimeMs, appVersion: APP_VERSION, bootId: BOOT_ID };
      }

      let current = null;
      if (currentRaw) {
        const { _etagPart, _activeWatchIds, ...restCurrent } = currentRaw;
        current = restCurrent;
      }
      const {
        _etagPart: _gEtag,
        _observedProfiles: _obs,
        _observedRawModels: _obsRaw,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:30:10
// Description: Strip internal _recentSubscriptionModels Set from /api/snapshot JSON payload.
// ============================================================================
        _recentSubscriptionModels: _recentSubModels,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:30:10
// ============================================================================
        ...global
      } = globalRaw;

      return {
        unchanged: false,
        etag,
        serverTimeMs,
        appVersion: APP_VERSION,
        bootId: BOOT_ID,
        boundConversationId,
        prefs: state.prefs,
        updateStatus,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Expose current proxyStatus diagnostics in /api/snapshot payload.
// ============================================================================
        proxyStatus: systemProxy.getStatus(),
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
        pricingSync: pricingSync.getPublicStatus(),
        pricingCatalog: buildEffectivePricingCatalog(state.prefs, runtimeCatalog),
        subscriptionCatalog: SUBSCRIPTION_CATALOG,
        current,
        global,
      };
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================
    } catch (err) {
      console.error(`[monitor_pane] /api/snapshot failed: ${err?.stack || err}`);
      return new Response(JSON.stringify({ error: err?.message || 'Internal snapshot error' }), {
        status: 500,
        contentType: 'application/json',
      });
    }
  },
  'GET',
);
// ============================================================================
// [MODIFIED END] 2026-11-17 17:17:13
// ============================================================================

app.api(
  '/api/prefs',
  (data) => {
    const result = validateAndMergePrefs(state.prefs, data);
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        contentType: 'application/json',
      });
    }
    state.prefs = result.prefs;
    prefsVersion += 1;
    persistStateNow();
    return {
      ok: true,
      prefs: state.prefs,
      pricingCatalog: buildEffectivePricingCatalog(
        state.prefs,
        pricingSync.getRuntimeCatalog([...observedRawModels]),
      ),
    };
  },
  'POST',
);

app.api(
  '/api/sync-pricing',
  async () => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Force-refresh and rebuild system proxy pool before manual pricing
// sync and include proxyStatus in response.
// ============================================================================
    systemProxy.refresh({ force: true, rebuild: true });
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
    const syncRes = await pricingSync.syncNow([...observedRawModels]);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:45:00
// Description: Update auto-mode cnyRate and return prefs from /api/sync-pricing.
// ============================================================================
    applyAutoSyncedFxIfNeeded({ persistImmediately: true });
    prefsVersion += 1;
    return {
      ok: syncRes.ok,
      prefs: state.prefs,
      pricingSync: syncRes.status,
      pricingCatalog: buildEffectivePricingCatalog(state.prefs, syncRes.runtimeCatalog),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Return current proxyStatus in /api/sync-pricing response.
// ============================================================================
      proxyStatus: systemProxy.getStatus(),
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
    };
// ============================================================================
// [MODIFIED END] 2026-11-17 15:45:00
// ============================================================================
  },
  'POST',
);
// ============================================================================
// [MODIFIED END] 2026-11-17 11:42:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 19:00:30
// Description: Add POST /api/check-update and POST /api/apply-update endpoints
// for manual release checks and one-click SHA-256 verified hot-update + clean respawn.
// ============================================================================
app.api(
  '/api/check-update',
  async () => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Run manual release check (triggering forced proxy pool rebuild via
// beforeNetworkCheck), log concise failure diagnostics, and return proxyStatus.
// ============================================================================
    const res = await releaseUpdater.checkForUpdatesNow({ manual: true });
    prefsVersion += 1;
    const updateStatus = releaseUpdater.getPublicStatus(state.prefs.skippedReleaseTag);
    const proxyStatus = systemProxy.getStatus();
    if (!res.ok) {
      console.warn(
        `[monitor_pane] check-update failed: code=${updateStatus.errorCode || 'unknown'} proxy=${proxyStatus.enabled ? `${proxyStatus.source}:${proxyStatus.proxyUrl}` : 'direct'} rebuilds=${proxyStatus.rebuildCount} err=${updateStatus.error || 'unknown'}`,
      );
    }
    return {
      ok: res.ok,
      appVersion: APP_VERSION,
      bootId: BOOT_ID,
      updateStatus,
      proxyStatus,
    };
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
  },
  'POST',
);

app.api(
  '/api/apply-update',
  async () => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Force-refresh and rebuild system proxy pool at start of hot-update
// apply and include proxyStatus across all success and error responses.
// ============================================================================
    systemProxy.refresh({ force: true, rebuild: true });
    hotUpdateInProgress = true;
    try {
      const res = await releaseUpdater.applyLatestUpdate();
      if (!res.ok) {
        hotUpdateInProgress = false;
        return {
          ...res,
          appVersion: APP_VERSION,
          bootId: BOOT_ID,
          updateStatus: releaseUpdater.getPublicStatus(state.prefs.skippedReleaseTag),
          proxyStatus: systemProxy.getStatus(),
        };
      }
      if (state.prefs.skippedReleaseTag) {
        state.prefs.skippedReleaseTag = '';
        persistStateNow();
      }
      prefsVersion += 1;
      if (!isStandalone || process.env.ENABLE_STANDALONE_UPDATE_EXIT === '1') {
        const exitTimer = setTimeout(() => shutdown(), 350);
        exitTimer.unref?.();
      } else {
        hotUpdateInProgress = false;
      }
      return {
        ...res,
        appVersion: APP_VERSION,
        bootId: BOOT_ID,
        updateStatus: releaseUpdater.getPublicStatus(state.prefs.skippedReleaseTag),
        proxyStatus: systemProxy.getStatus(),
      };
    } catch (err) {
      hotUpdateInProgress = false;
      return {
        ok: false,
        reason: 'apply_failed',
        error: err?.message || 'Failed to apply update.',
        appVersion: APP_VERSION,
        bootId: BOOT_ID,
        updateStatus: releaseUpdater.getPublicStatus(state.prefs.skippedReleaseTag),
        proxyStatus: systemProxy.getStatus(),
      };
    }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
  },
  'POST',
);
// ============================================================================
// [MODIFIED END] 2026-11-17 19:00:30
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:22:00
// Description: Add POST /api/copy-receipt route to validate PNG base64 image
// payload and write it to the OS system clipboard for v0.3.1.
// ============================================================================
app.api(
  '/api/copy-receipt',
  async (data) => {
    const rawImage = typeof data === 'string' ? data : data?.imageBase64;
    const decoded = decodeAndValidatePngBase64(rawImage);
    if (!decoded.ok) {
      return new Response(JSON.stringify({ ok: false, error: decoded.error }), {
        status: 400,
        contentType: 'application/json',
      });
    }

    const copyRes = await copyPngToSystemClipboard(decoded.buffer);
    if (!copyRes.ok) {
      const errMsg = copyRes.error || 'Clipboard write failed';
      console.warn(`[monitor_pane] /api/copy-receipt failed: ${errMsg}`);
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 500,
        contentType: 'application/json',
      });
    }

    return { ok: true, bytes: decoded.buffer.length };
  },
  'POST',
);
// ============================================================================
// [MODIFIED END] 2026-11-18 16:22:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:17:13
// Description: Cancel pending bgLedgerTimer in /api/resync-ledger and shutdown(),
// and override /_sidecar/get-conversation-metadata after app.run() so preload.js
// resolves projectId without blocking execFileSync.
// ============================================================================
app.api(
  '/api/resync-ledger',
  () => {
    if (bgLedgerTimer) {
      clearTimeout(bgLedgerTimer);
      bgLedgerTimer = null;
    }
    usageLedger.resyncFromDisk({
      threshold: state.prefs.longContextThreshold,
      timingStore,
    });
    persistLedgerNow();
    prefsVersion += 1;
    return {
      ok: true,
      conversationsCount: Object.keys(usageLedger.getData().conversations).length,
    };
  },
  'POST',
);

function shutdown() {
  isShuttingDown = true;
  clearInterval(watcherTimer);
  if (codeReloadTimer) clearInterval(codeReloadTimer);
  if (bgLedgerTimer) {
    clearTimeout(bgLedgerTimer);
    bgLedgerTimer = null;
  }
  if (stateDirty) persistStateNow();
  if (usageLedger.isDirty()) persistLedgerNow();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Dispose system proxy dispatcher cleanly during shutdown.
// ============================================================================
  try {
    systemProxy.dispose();
  } catch {
    // Ignore proxy disposal failure during shutdown.
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
  app.close().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.run();

app.api(
  '/_sidecar/get-conversation-metadata',
  () => ({
    response: {
      conversationMetadata: {
        metadata: {
          projectId: app.config.projectId || '',
        },
      },
    },
  }),
  'POST',
);
// ============================================================================
// [MODIFIED END] 2026-11-17 17:17:13
// ============================================================================

// ============================================================================
// [MODIFIED END] 2026-11-16 21:25:00
// ============================================================================
