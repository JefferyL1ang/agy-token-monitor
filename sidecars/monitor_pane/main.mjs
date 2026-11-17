// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 21:25:00
// Description: Sidecar backend entrypoint for Token Monitor v1.2.0. Manages
// monitor_state.json and schema-v2 usage_ledger.json persistence, SQLite DB +
// WAL + transcript live stat watching, per-model pricing prefs, subscription
// ROI comparison, /api/resync-ledger, and code hot-reload.
// ============================================================================

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:45:00
// Description: Import homedir to resolve user sidecar_sdk path portably.
// ============================================================================
import { homedir, tmpdir } from 'node:os';
// ============================================================================
// [MODIFIED END] 2026-11-17 10:45:00
// ============================================================================
import { dirname, join } from 'node:path';
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
  VALID_LANGUAGES,
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
} from './parser.mjs';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Import createPricingSyncManager for dual-channel official
// model & pricing auto-sync and dynamic profile ID validation.
// ============================================================================
import { createPricingSyncManager } from './pricing_sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
// [MODIFIED BEGIN] 2026-11-17 10:26:00
// Description: Bump PREFS_SCHEMA_VERSION to 3 so v1/v2 states with default
// softContextLimit=250000 and hardContextLimit=1000000 or 500000 migrate to 400k/500k.
// ============================================================================
const PREFS_SCHEMA_VERSION = 3;
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
// [MODIFIED BEGIN] 2026-11-17 11:42:00
// Description: Initialize pricingSync & observedRawModels, validate dynamic
// profile IDs with PROFILE_ID_RE, and preserve saved user modelOverrides across
// upstream pricing updates.
// ============================================================================
const observedRawModels = new Set();
const pricingSync = createPricingSyncManager({
  stateDir,
  baseCatalog: MODEL_PRICING_CATALOG,
});

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
    tokenUnit: DEFAULT_PREFS.tokenUnit,
    language: DEFAULT_PREFS.language,
    subscriptionPlan: DEFAULT_PREFS.subscriptionPlan,
    customSubscriptionMonthlyUsd: DEFAULT_PREFS.customSubscriptionMonthlyUsd,
    longContextThreshold: DEFAULT_PREFS.longContextThreshold,
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
      const isUntouchedSoft = rawSoft === undefined || Number(rawSoft) === 250000;
      const isLegacyHard =
        rawHard === undefined || Number(rawHard) === 1000000 || Number(rawHard) === 500000;
      if (isUntouchedSoft && isLegacyHard) {
        prefs.softContextLimit = 400000;
        prefs.hardContextLimit = 500000;
      }
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

function writeAtomicJson(targetPath, payload) {
  mkdirSync(stateDir, { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(payload), 'utf-8');
  renameSync(tmpPath, targetPath);
}

function persistStateNow() {
  try {
    mkdirSync(stateDir, { recursive: true });
    const tmpPath = `${statePath}.tmp`;
    writeFileSync(
      tmpPath,
      JSON.stringify(
        {
          prefsSchemaVersion: PREFS_SCHEMA_VERSION,
          stepEndTimes: state.stepEndTimes,
          prefs: state.prefs,
        },
        null,
        2,
      ),
      'utf-8',
    );
    renameSync(tmpPath, statePath);
    stateDirty = false;
    lastSavedMs = Date.now();
  } catch (err) {
    console.error(`[monitor_pane] failed to persist state: ${err.message}`);
  }
}

if (loadedState.migrated) {
  persistStateNow();
}
// ============================================================================
// [MODIFIED END] 2026-11-17 10:14:00
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

// Live transcript watcher state
const watchedConvIds = new Set();
if (isValidConversationId(app.config.conversationId)) {
  watchedConvIds.add(app.config.conversationId);
}
const watcherLastStat = new Map(); // convId -> statKey
const watcherSeenSteps = new Map(); // convId -> Set<step_index>

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

app.api(
  '/api/snapshot',
  (data) => {
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

    let runtimeCatalog = pricingSync.getRuntimeCatalog([...observedRawModels]);

    let globalRaw = summarizeGlobalAndRecent({
      prefs: state.prefs,
      timingStore,
      metadataStore,
      ledger: usageLedger,
      runtimeCatalog,
    });

    if (usageLedger.isDirty() && Date.now() - lastLedgerSavedMs >= 2000) {
      persistLedgerNow();
    }

    const targetConv =
      requestedConv ||
      boundConversationId ||
      (isStandalone ? globalRaw.recentConversations[0]?.conversationId || '' : '');

    if (targetConv) watchedConvIds.add(targetConv);

    let currentRaw = targetConv
      ? analyzeConversation(targetConv, {
          prefs: state.prefs,
          timingStore,
          metadataStore,
          observedProfiles: globalRaw._observedProfiles,
          runtimeCatalog,
        })
      : null;

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
        });
        if (targetConv) {
          currentRaw = analyzeConversation(targetConv, {
            prefs: state.prefs,
            timingStore,
            metadataStore,
            observedProfiles: globalRaw._observedProfiles,
            runtimeCatalog,
          });
        }
      } else {
        runtimeCatalog = nextCatalog;
      }
    }

    pricingSync.maybeTriggerDailySync([...observedRawModels], () => {
      prefsVersion += 1;
    });

    if (currentRaw?._activeWatchIds) {
      for (const id of currentRaw._activeWatchIds) {
        if (isValidConversationId(id)) watchedConvIds.add(id);
      }
    }

    const etag = [
      targetConv || '-',
      `p${prefsVersion}`,
      `m${metadataStore.getVersion()}`,
      currentRaw?._etagPart || '-',
      globalRaw._etagPart || '-',
    ].join('|');

    const serverTimeMs = Date.now();
    if (data?.etag && data.etag === etag) {
      return { unchanged: true, etag, serverTimeMs };
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
      ...global
    } = globalRaw;

    return {
      unchanged: false,
      etag,
      serverTimeMs,
      boundConversationId,
      prefs: state.prefs,
      pricingSync: pricingSync.getPublicStatus(),
      pricingCatalog: buildEffectivePricingCatalog(state.prefs, runtimeCatalog),
      subscriptionCatalog: SUBSCRIPTION_CATALOG,
      current,
      global,
    };
  },
  'GET',
);

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
    const syncRes = await pricingSync.syncNow([...observedRawModels]);
    prefsVersion += 1;
    return {
      ok: syncRes.ok,
      pricingSync: syncRes.status,
      pricingCatalog: buildEffectivePricingCatalog(state.prefs, syncRes.runtimeCatalog),
    };
  },
  'POST',
);
// ============================================================================
// [MODIFIED END] 2026-11-17 11:42:00
// ============================================================================

app.api(
  '/api/resync-ledger',
  () => {
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
  clearInterval(watcherTimer);
  if (codeReloadTimer) clearInterval(codeReloadTimer);
  if (stateDirty) persistStateNow();
  if (usageLedger.isDirty()) persistLedgerNow();
  app.close().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.run();

// ============================================================================
// [MODIFIED END] 2026-11-16 21:25:00
// ============================================================================
