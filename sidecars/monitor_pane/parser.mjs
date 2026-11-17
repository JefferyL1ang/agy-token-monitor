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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
export const LEDGER_SCHEMA_VERSION = 4;
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
  [1667, 'gemini-pro-orchestrator'],
  [1669, 'gemini-flash-worker-agy'],
];
const SEEDED_ENUM_IDS = new Set(SEEDED_ENUM_ENTRIES.map(([k]) => k));
export const MODEL_ENUM_MAP = new Map(SEEDED_ENUM_ENTRIES);

export const MODEL_PRICING_CATALOG = Object.freeze([
  Object.freeze({
    id: 'gemini-4-argon',
    group: 'Gemini 系列',
    label: 'Gemini 4 Argon',
    hint: '含 High/Med/Low · Orchestrator (Argon)',
    inputPer1M: 2.0,
    cachedPer1M: 0.2,
    outputPer1M: 10.0,
    longContextTier: true,
    longInputMultiplier: 2.0,
    longOutputMultiplier: 1.5,
    pattern: /gemini[\s-]*4[\s-]*argon|orchestrator[\s(-]*argon|gemini-pro-orchestrator-argon/i,
  }),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:40:00
// Description: Add dedicated gemini-3.1-pro profile before gemini-4-carbon
// and remove 3.1/pro-default matching from gemini-4-carbon's pattern.
// ============================================================================
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
    id: 'gemini-4-carbon',
    group: 'Gemini 系列',
    label: 'Gemini 4 Carbon',
    hint: '含 High/Med/Low · Orchestrator (Carbon)',
    inputPer1M: 2.0,
    cachedPer1M: 0.2,
    outputPer1M: 10.0,
    longContextTier: true,
    longInputMultiplier: 2.0,
    longOutputMultiplier: 1.5,
    pattern:
      /gemini[\s-]*4[\s-]*carbon|orchestrator[\s(-]*carbon|gemini-pro-orchestrator(?!-argon)|^gemini[\s-]*pro$|gemini[\s-]*[23].*pro|^pro$/i,
  }),
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================
  Object.freeze({
    id: 'gemini-4-hydrogen',
    group: 'Gemini 系列',
    label: 'Gemini 4 Hydrogen',
    hint: '含 XHigh/High/Med/Low',
    inputPer1M: 1.5,
    cachedPer1M: 0.15,
    outputPer1M: 7.5,
    longContextTier: true,
    longInputMultiplier: 2.0,
    longOutputMultiplier: 1.5,
    pattern: /gemini[\s-]*4[\s-]*hydrogen/i,
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
    pattern: /gemini.*flash|^flash(?:_lite)?$/i,
  }),
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
    group: '其他在役模型',
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
    cachedPer1M: 0.2,
    outputPer1M: 10.0,
    longContextTier: true,
    longInputMultiplier: 2.0,
    longOutputMultiplier: 1.5,
    pattern: null,
  }),
]);

const PROFILE_BY_ID = new Map(MODEL_PRICING_CATALOG.map((p) => [p.id, p]));

export const SUBSCRIPTION_CATALOG = Object.freeze({
  auto: Object.freeze({ id: 'auto', label: '自动识别', monthlyUsd: null }),
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

export const DEFAULT_PREFS = Object.freeze({
  softContextLimit: 400000,
  hardContextLimit: 500000,
  currency: 'USD',
  cnyRate: 7.25,
  tokenUnit: 'auto',
  language: 'zh',
  subscriptionPlan: 'auto',
  customSubscriptionMonthlyUsd: 99.99,
  longContextThreshold: 200000,
  modelOverrides: Object.freeze({}),
});

const transcriptCache = new Map(); // cacheId -> { key, parsed }
const MAX_TRANSCRIPT_CACHE = 128;
const summariesDbCache = new Map(); // sumDbPath -> { key, byConvId }

/**
 * Normalizes backend model slugs and UI display names into canonical tier-free raw model IDs.
 * Preserves backend variant/worker slugs (e.g. gemini-3.8-flash-n, gemini-flash-worker-agy,
 * gemini-pro-orchestrator, gemini-4-argon-trial) while stripping thinking/effort tiers.
 */
export function normalizeModelId(rawModel, fallbackDisplay = '') {
  const raw = typeof rawModel === 'string' ? rawModel.trim() : '';
  if (raw && !/\s/.test(raw) && raw.includes('-') && !AUTO_UNKNOWN_RE.test(raw)) {
    let slug = raw.toLowerCase();
    while (TIER_SUFFIX_RE.test(slug)) {
      slug = slug.replace(TIER_SUFFIX_RE, '');
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

  const fb = typeof fallbackDisplay === 'string' ? fallbackDisplay.trim() : '';
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

  if (/orchestrator\s*\(\s*argon\s*\)/i.test(candidate)) return 'gemini-pro-orchestrator-argon';
  if (/orchestrator\s*\(\s*carbon\s*\)/i.test(candidate)) return 'gemini-pro-orchestrator';
  if (/gemini[\s-]*4[\s-]*argon/i.test(candidate)) return 'gemini-4-argon';
  if (/gemini[\s-]*4[\s-]*carbon/i.test(candidate)) return 'gemini-4-carbon';
  if (/gemini[\s-]*4[\s-]*hydrogen/i.test(candidate)) return 'gemini-4-hydrogen';
  if (/gemini[\s-]*3\.?8[\s-]*flash|^gemini\s+flash$|^flash(?:_lite)?$/i.test(candidate)) {
    return 'gemini-3.8-flash';
  }
  if (/^pro$/i.test(candidate)) return 'gemini-4-carbon';
  if (/claude[\s-]*opus[\s-]*4[\s.-]*6/i.test(candidate)) return 'claude-opus-4-6';
  if (/claude[\s-]*opus/i.test(candidate)) return 'claude-opus-5-5';
  if (/claude[\s-]*sonnet[\s-]*5[\s.-]*5|claude[\s-]*sonnet|claude[\s-]*haiku/i.test(candidate)) {
    return 'claude-sonnet-5-5';
  }
  if (/gpt[\s-]*oss/i.test(candidate)) return 'gpt-oss-120b';

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
}

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

function parseTimestampMs(ts) {
  if (typeof ts !== 'string' || !ts.trim()) return null;
  const ms = Date.parse(ts.trim());
  return Number.isFinite(ms) ? ms : null;
}

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
  return sec * 1000 + Math.round((Number.isFinite(nanos) ? nanos : 0) / 1e6);
}

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

      const genEntry = {
        genIdx: Number(row.idx),
        stepIndices,
        modelEnumId,
        rawModelId,
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
      const createdAtIso = createdAtMs !== null ? new Date(createdAtMs).toISOString() : '';

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
      const syntheticIdx =
        genEntry.stepIndices.length > 0 ? genEntry.stepIndices[0] : -1000 - genEntry.genIdx;
      const orphanStep = {
        step_index: syntheticIdx,
        type: 'COMPACTION_SUMMARY',
        status: 'DONE',
        created_at: new Date(orphanCreatedAtMs).toISOString(),
        createdAtMs: orphanCreatedAtMs,
        firstTokenAtMs: null,
        completedAtMs: null,
        hasTokenTelemetry: true,
        input_tokens: genEntry.inputTokens,
        cache_read_tokens: genEntry.cacheReadTokens,
        output_tokens: genEntry.outputTokens,
        dbModel,
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

/**
 * Reads `<appData>/conversation_summaries.db` in read-only mode, cached by `.db` + `.db-wal` stat.
 */
function readConversationSummariesMap(appDataDirs) {
  const combined = new Map();
  for (const appData of appDataDirs || []) {
    const sumDbPath = join(appData, 'conversation_summaries.db');
    const sumWalPath = `${sumDbPath}-wal`;
    const dbStat = statOf(sumDbPath);
    if (dbStat.size < 0) continue;
    const walStat = statOf(sumWalPath);
    const statKey = `${dbStat.mtimeMs}:${dbStat.size}|${walStat.mtimeMs}:${walStat.size}`;

    let cached = summariesDbCache.get(sumDbPath);
    if (!cached || cached.key !== statKey) {
      let db = null;
      try {
        db = new DatabaseSync(sumDbPath, { readOnly: true, timeout: 2500 });
        let rows;
        try {
          rows = db
            .prepare(
              'SELECT conversation_id, title, preview, workspace_uris, agent_name, parent_conversation_id FROM conversation_summaries',
            )
            .all();
        } catch {
          rows = db
            .prepare(
              'SELECT conversation_id, title, workspace_uris, agent_name, parent_conversation_id FROM conversation_summaries',
            )
            .all();
        }
        const byConvId = new Map();
        for (const r of rows) {
          const cid = typeof r.conversation_id === 'string' ? r.conversation_id.trim() : '';
          if (!isValidConversationId(cid)) continue;
          byConvId.set(cid, {
            title: typeof r.title === 'string' && r.title.trim() ? oneLine(r.title, 64) : '',
            preview:
              typeof r.preview === 'string' && r.preview.trim() ? oneLine(r.preview, 56) : '',
            workspace: parseWorkspaceUrisField(r.workspace_uris),
            agentName: typeof r.agent_name === 'string' ? r.agent_name.trim() : '',
            parentConversationId:
              typeof r.parent_conversation_id === 'string' ? r.parent_conversation_id.trim() : '',
          });
        }
        cached = { key: statKey, byConvId };
        summariesDbCache.set(sumDbPath, cached);
      } catch {
        // Keep previous cached map if SQLite is momentarily busy.
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

    if (cached?.byConvId) {
      for (const [cid, meta] of cached.byConvId) {
        if (!combined.has(cid)) combined.set(cid, meta);
      }
    }
  }
  return combined;
}

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
      if (modelChanges.length === 0 && trunc.includes('content')) {
        fullStep = loadFullStep(i, stepIndex);
        if (fullStep) {
          modelChanges = extractModelChangesFromContent(fullStep.content);
        }
      }
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
      const hasSubagentCall = toolCalls.some((tc) => tc?.name === 'invoke_subagent');
      if (hasSubagentCall && trunc.includes('tool_calls')) {
        const fullStep = loadFullStep(i, stepIndex);
        if (fullStep && Array.isArray(fullStep.tool_calls)) {
          toolCalls = fullStep.tool_calls;
        }
      }
      lastPlannerHadSubagent = hasSubagentCall;

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

  let lastUserIdx = -1;
  let lastPlannerIdx = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (lastUserIdx < 0 && steps[i].type === 'USER_INPUT') lastUserIdx = i;
    if (lastPlannerIdx < 0 && steps[i].type === 'PLANNER_RESPONSE') lastPlannerIdx = i;
    if (lastUserIdx >= 0 && lastPlannerIdx >= 0) break;
  }

  if (lastPlannerIdx < 0) {
    if (lastUserIdx >= 0) {
      return {
        status: 'GENERATING',
        generatingSinceMs: steps[lastUserIdx].createdAtMs ?? statMtimeMs,
        toolProgress: null,
        activeToolLabel: '',
      };
    }
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

  if (lastUserIdx > lastPlannerIdx) {
    return {
      status: 'GENERATING',
      generatingSinceMs: steps[lastUserIdx].createdAtMs ?? statMtimeMs,
      toolProgress: null,
      activeToolLabel: '',
    };
  }

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
    const exact = list.find((p) => typeof p?.id === 'string' && p.id.toLowerCase() === lower);
    if (exact) {
      return exact;
    }
    for (const profile of list) {
      if (!profile) continue;
      let re = null;
      if (profile.pattern instanceof RegExp) {
        re = profile.pattern;
      } else if (typeof profile.patternStr === 'string' && profile.patternStr) {
        try {
          re = new RegExp(profile.patternStr, 'i');
        } catch {
          re = null;
        }
      }
      if (re && re.test(s)) {
        return profile;
      }
    }
  }
  return list.find((p) => p?.id === 'auto') || PROFILE_BY_ID.get('auto');
}

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

/**
 * Infers subscription plan ID from observed active model profile IDs.
 */
export function detectSubscriptionPlanFromProfiles(profileIds) {
  const set = profileIds instanceof Set ? profileIds : new Set(profileIds || []);
  if (set.has('gemini-4-carbon') || set.has('claude-opus-5-5')) {
    return 'ultra_5x';
  }
  if (set.has('gemini-4-argon') || set.has('gemini-3.1-pro') || set.has('claude-sonnet-5-5')) {
    return 'pro';
  }
  return 'free';
}
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================

/**
 * Resolves the active subscription plan details and monthly fee in display currency.
 */
export function resolveSubscriptionInfo(prefs = DEFAULT_PREFS, observedProfileIds = new Set()) {
  const mode =
    typeof prefs?.subscriptionPlan === 'string' && SUBSCRIPTION_CATALOG[prefs.subscriptionPlan]
      ? prefs.subscriptionPlan
      : 'auto';
  const currency = prefs?.currency === 'CNY' ? 'CNY' : 'USD';
  const fx =
    currency === 'CNY' ? Math.max(0.01, Number(prefs?.cnyRate) || DEFAULT_PREFS.cnyRate) : 1;

  const detectedPlanId = detectSubscriptionPlanFromProfiles(observedProfileIds);
  const effectivePlanId = mode === 'auto' ? detectedPlanId : mode;
  const planMeta = SUBSCRIPTION_CATALOG[effectivePlanId] || SUBSCRIPTION_CATALOG.free;

  let monthlyUsd = 0;
  if (effectivePlanId === 'custom') {
    const customVal = Number(prefs?.customSubscriptionMonthlyUsd);
    monthlyUsd = Number.isFinite(customVal) && customVal >= 0 ? customVal : 0;
  } else if (Number.isFinite(planMeta.monthlyUsd)) {
    monthlyUsd = planMeta.monthlyUsd;
  }

  const detectedMeta = SUBSCRIPTION_CATALOG[detectedPlanId] || SUBSCRIPTION_CATALOG.free;
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
export function resolveModelTimeline(parsed, defaultModel = 'Auto') {
  let currentModel = normalizeModelId(defaultModel);
  const modelByStepIdx = new Map();
  for (const step of parsed?.steps || []) {
    if (step.type === 'USER_INPUT' && step.modelChange) {
      currentModel = normalizeModelId(step.modelChange);
    } else if (step.type === 'PLANNER_RESPONSE' || step.type === 'COMPACTION_SUMMARY') {
      if (step.dbModel && step.dbModel !== 'Auto') {
        currentModel = normalizeModelId(step.dbModel);
      }
      modelByStepIdx.set(step.step_index, currentModel);
    }
  }
  return { activeModel: currentModel, modelByStepIdx };
}

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

  const tokenIndices = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].type === 'PLANNER_RESPONSE' && steps[i].hasTokenTelemetry) {
      tokenIndices.push(i);
    }
  }

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
    };
  }

  const latest = steps[tokenIndices[tokenIndices.length - 1]];
  const prev = tokenIndices.length >= 2 ? steps[tokenIndices[tokenIndices.length - 2]] : null;

  const currentTotal = latest.input_tokens + latest.cache_read_tokens;
  const prevTotal = prev ? prev.input_tokens + prev.cache_read_tokens : 0;
  const latestInputUncached = latest.input_tokens;
  const latestCacheRead = latest.cache_read_tokens;
  const latestCacheHitRatePct = currentTotal > 0 ? (latestCacheRead / currentTotal) * 100 : 0;
  const latestNetDelta = prev ? currentTotal - prevTotal : 0;

  const hardUsagePct = hardLimit > 0 ? (currentTotal / hardLimit) * 100 : 0;
  const softUsagePct = softLimit > 0 ? (currentTotal / softLimit) * 100 : 0;
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
      let entry = byModelMap.get(model);
      if (!entry) {
        entry = {
          model,
          profileId: pricing.profileId,
          profileLabel: pricing.profileLabel,
          rateDisplay: formatRateSummary(pricing),
          stepsCount: 0,
          inputUncachedTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costActual: 0,
        };
        byModelMap.set(model, entry);
      }
      entry.stepsCount += 1;
      entry.inputUncachedTokens += step.input_tokens;
      entry.cacheReadTokens += step.cache_read_tokens;
      entry.outputTokens += step.output_tokens;
      entry.totalTokens += step.input_tokens + step.cache_read_tokens + step.output_tokens;
      entry.costActual += costActual;
    }
  }
}

function readRosterSafe(membersPath) {
  if (!existsSync(membersPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(membersPath, 'utf-8'));
    if (!raw || typeof raw !== 'object') return null;
    const members = raw.members && typeof raw.members === 'object' ? raw.members : {};
    return { title: typeof raw.title === 'string' ? raw.title : '', members };
  } catch {
    return null;
  }
}

function listAllSwarms(appDataDirs) {
  const swarms = [];
  const seen = new Set();
  for (const appData of appDataDirs) {
    for (const id of safeReaddir(join(appData, 'brain'))) {
      if (!isValidConversationId(id) || seen.has(id)) continue;
      const membersPath = join(appData, 'brain', id, '.system_generated', 'swarm', 'members.json');
      const roster = readRosterSafe(membersPath);
      if (roster) {
        seen.add(id);
        swarms.push({ coordinatorId: id, appData, roster });
      }
    }
  }
  return swarms;
}

function findSwarmMembership(convId, appDataDirs) {
  const ownPaths = resolveConversationPaths(convId, appDataDirs);
  if (ownPaths) {
    const ownRoster = readRosterSafe(ownPaths.swarmMembersPath);
    if (ownRoster) {
      return { coordinatorId: convId, roster: ownRoster, isCoordinator: true };
    }
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

function extractSubagentCallDescriptors(parsed, modelByStepIdx) {
  const steps = parsed?.steps || [];
  const out = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== 'PLANNER_RESPONSE') continue;
    const calls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
    const subIndices = [];
    for (let c = 0; c < calls.length; c++) {
      if (calls[c]?.name === 'invoke_subagent') subIndices.push(c);
    }
    if (subIndices.length === 0) continue;

    const generics = [];
    for (let j = i + 1; j < steps.length; j++) {
      if (steps[j].type === 'PLANNER_RESPONSE' || steps[j].type === 'USER_INPUT') break;
      if (steps[j].type === 'GENERIC') generics.push(steps[j]);
    }

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
        out.push({
          conversationId: childId,
          kind: 'subagent',
          name: rawName || summaryLabel || childId.slice(0, 8),
          role: rawRole || 'subagent',
          defaultModel: resolvedModel,
        });
      });
    }
  }
  return out;
}

/**
 * Discovers subagents and swarm members for a conversation, avoiding cycles.
 */
export function resolveChildrenAndSwarm(convId, parsed, modelByStepIdx, appDataDirs) {
  const swarmInfo = findSwarmMembership(convId, appDataDirs);
  const directDescriptors = [];
  const seen = new Set([convId.toLowerCase()]);

  for (const desc of extractSubagentCallDescriptors(parsed, modelByStepIdx)) {
    const key = desc.conversationId.toLowerCase();
    if (!isValidConversationId(desc.conversationId) || seen.has(key)) continue;
    seen.add(key);
    directDescriptors.push(desc);
  }

  if (swarmInfo?.roster?.members) {
    for (const [memberName, member] of Object.entries(swarmInfo.roster.members)) {
      const mId = member?.conversation_id;
      if (!isValidConversationId(mId)) continue;
      const key = mId.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      directDescriptors.push({
        conversationId: mId,
        kind: 'swarm',
        name: memberName,
        role: typeof member.role === 'string' && member.role ? member.role : 'worker',
        defaultModel: normalizeModelId(
          member.model || member.applied_model || member.desired_model || 'Auto',
        ),
        killed: Boolean(member.killed),
      });
    }
  }

  return { swarmInfo, directDescriptors };
}

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

  function get(convId, { schedule = true, appDataDirs } = {}) {
    if (!isValidConversationId(convId)) return { title: '', workspace: '' };
    const dirs = appDataDirs || discoverAppDataDirs(options);
    const summaries = readConversationSummariesMap(dirs);
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
    if (schedule && !options.disableAgentApi && !inFlight.has(convId)) {
      inFlight.add(convId);
      queue.push(convId);
      pump();
    }
    return hit || { title: '', workspace: '' };
  }

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

function findSubagentParentHint(convId, appDataDirs, visited = new Set()) {
  const targetLower = convId.toLowerCase();
  if (visited.has(targetLower)) return null;
  visited.add(targetLower);

  // Fast pass through already-cached transcripts first.
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
          if (reMatched) return reMatched;
        }
      }
      return match;
    }
  }

  // Fallback scan on brain transcripts containing the child UUID.
  for (const appData of appDataDirs) {
    const brainDir = join(appData, 'brain');
    for (const candidateId of safeReaddir(brainDir)) {
      if (!isValidConversationId(candidateId) || candidateId.toLowerCase() === targetLower) {
        continue;
      }
      const paths = resolveConversationPaths(candidateId, [appData]);
      if (!paths || !existsSync(paths.transcriptPath)) continue;
      const cacheId = paths.dbPath || paths.transcriptPath;
      if (!transcriptCache.has(cacheId)) {
        let rawText = '';
        try {
          rawText = readFileSync(paths.transcriptPath, 'utf-8');
        } catch {
          continue;
        }
        if (!rawText.toLowerCase().includes(targetLower)) continue;
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
            if (reMatched) return reMatched;
          }
        }
        return match;
      }
    }
  }
  return null;
}

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
  const appDataDirs = discoverAppDataDirs(options);
  const paths = resolveConversationPaths(convId, appDataDirs);
  if (!paths) return null;

  const parsed = parseTranscript(convId, paths);
  if (!parsed) return null;

  const swarmInfo = findSwarmMembership(convId, appDataDirs);
  let defaultModel = normalizeModelId(options.defaultModel || 'Auto');
  let subagentHint = null;
  if (defaultModel === 'Auto' && swarmInfo && !swarmInfo.isCoordinator && swarmInfo.selfMember) {
    defaultModel = normalizeModelId(
      swarmInfo.selfMember.model ||
        swarmInfo.selfMember.applied_model ||
        swarmInfo.selfMember.desired_model ||
        'Auto',
    );
  }
  if (defaultModel === 'Auto' && !swarmInfo && !parsed.hasDbTelemetry) {
    subagentHint = findSubagentParentHint(convId, appDataDirs);
    if (subagentHint?.defaultModel) {
      defaultModel = normalizeModelId(subagentHint.defaultModel);
    }
  }

  const { activeModel, modelByStepIdx } = resolveModelTimeline(parsed, defaultModel);
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
  const withChildren = emptyBucket();
  const byModelMap = new Map();
  const localObservedProfiles = new Set([resolveModelProfile(activeModel, runtimeCatalog).id]);
  const mainSeenBotIds = new Set();
  const withChildrenSeenBotIds = new Set();

  accumulateStepsInto(
    mainOnly,
    null,
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
        children.push({
          conversationId: desc.conversationId,
          kind: desc.kind,
          name: desc.name,
          role: desc.role,
          model: normalizeModelId(desc.defaultModel || 'Auto'),
          status: 'IDLE',
          generatingSinceMs: null,
          contextTotal: 0,
          latestTokPerSec: null,
          outputTokens: 0,
          costActual: 0,
        });
        continue;
      }

      childEtagParts.push(`${desc.conversationId}:${childParsed.cacheKey}`);
      const childTimeline = resolveModelTimeline(childParsed, desc.defaultModel || 'Auto');
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

      children.push({
        conversationId: desc.conversationId,
        kind: desc.kind,
        name: desc.name,
        role: desc.role,
        model: childTimeline.activeModel,
        status: desc.killed ? 'IDLE' : childLive.status,
        generatingSinceMs: desc.killed ? null : childLive.generatingSinceMs,
        contextTotal: childContext.currentTotal,
        latestTokPerSec: childSpeed.latestStepTokPerSec,
        outputTokens: childBucket.outputTokens,
        costActual: childBucket.costActual,
      });

      collectDescendants(childParsed, childTimeline.modelByStepIdx, depth + 1);
    }
  }

  collectDescendants(parsed, modelByStepIdx, 0);
  finalizeBucket(withChildren);

  const byModel = [...byModelMap.values()]
    .map((entry) => ({
      ...entry,
      totalTokens: entry.inputUncachedTokens + entry.cacheReadTokens + entry.outputTokens,
    }))
    .sort((a, b) => b.costActual - a.costActual || b.totalTokens - a.totalTokens);

  const subProfiles =
    options.observedProfiles instanceof Set && options.observedProfiles.size > 0
      ? options.observedProfiles
      : localObservedProfiles;
  const subInfo = resolveSubscriptionInfo(effectivePrefs, subProfiles);
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

  const summaries = readConversationSummariesMap(appDataDirs);
  const sumMeta = summaries.get(convId);
  const storeMeta = options.metadataStore?.get?.(convId, { appDataDirs }) || {
    title: '',
    workspace: '',
  };
  const metaTitle = storeMeta.title || sumMeta?.title || '';
  const metaWorkspace = storeMeta.workspace || sumMeta?.workspace || '';

  if (!subagentHint && !swarmInfo && !metaTitle && !parsed.firstUserPrompt) {
    subagentHint = findSubagentParentHint(convId, appDataDirs);
  }

  const title = buildConversationTitle({
    convId,
    metaTitle,
    swarmInfo,
    hintName: options.hintName || subagentHint?.name,
    metaAgentName: sumMeta?.agentName || storeMeta.agentName || '',
    metaPreview: sumMeta?.preview || storeMeta.preview || '',
    parsed,
  });

  const activeWatchIds = [convId, ...children.map((c) => c.conversationId)];

  return {
    conversationId: convId,
    title,
    workspace: metaWorkspace,
    activeModel,
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
    },
    children,
    _etagPart: `${parsed.cacheKey}|${childEtagParts.join(',')}`,
    _activeWatchIds: activeWatchIds,
  };
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

function addDatedStepToDays(days, stepMs, stepModel, step, threshold) {
  const dateKey = formatLocalDate(stepMs);
  const hourKey = String(new Date(stepMs).getHours());
  if (!days[dateKey]) {
    days[dateKey] = { byModel: {}, hours: {} };
  }
  if (!days[dateKey].byModel[stepModel]) {
    days[dateKey].byModel[stepModel] = emptyRawTokenCounts();
  }
  addStepToRawCounts(days[dateKey].byModel[stepModel], step, threshold);

  if (!days[dateKey].hours[hourKey]) {
    days[dateKey].hours[hourKey] = {};
  }
  if (!days[dateKey].hours[hourKey][stepModel]) {
    days[dateKey].hours[hourKey][stepModel] = emptyRawTokenCounts();
  }
  addStepToRawCounts(days[dateKey].hours[hourKey][stepModel], step, threshold);
}

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

      // Deleted parent conversation not present on disk or in archived ledger — synthesize entry.
      const canonicalId = group.canonicalId;
      const days = {};
      const observedProfiles = new Set();
      let totalOutputTokens = 0;
      let latestContextTotal = 0;
      let activeModel = 'Auto';
      let maxUpdatedAtMs = 0;

      const sortedItems = [...group.items].sort(
        (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0) || a.step_index - b.step_index,
      );
      for (const item of sortedItems) {
        const stepModel = normalizeModelId(item.model || 'Auto');
        if (stepModel !== 'Auto') activeModel = stepModel;
        observedProfiles.add(resolveModelProfile(stepModel).id);
        if (item.isPlanner) {
          latestContextTotal = (item.input_tokens || 0) + (item.cache_read_tokens || 0);
        }
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

    if (needRebuild.length > 0) {
      // If a parent DB was updated/rewound, also refresh any on-disk child fork referencing it.
      const rebuiltLowers = new Set(needRebuild.map((c) => c.convId.toLowerCase()));
      const needRebuildSet = new Set(needRebuild.map((c) => c.convId));
      for (const c of candidates) {
        if (needRebuildSet.has(c.convId)) continue;
        const prev = data.conversations[c.convId];
        if (
          Array.isArray(prev?.parentCascadeIds) &&
          prev.parentCascadeIds.some((pid) => rebuiltLowers.has(pid))
        ) {
          needRebuild.push(c);
          needRebuildSet.add(c.convId);
        }
      }

      const swarms = listAllSwarms(appDataDirs);
      const swarmMemberLookup = new Map();
      const swarmTitleByCoord = new Map();
      for (const s of swarms) {
        if (s.roster.title) swarmTitleByCoord.set(s.coordinatorId, s.roster.title);
        for (const [mName, member] of Object.entries(s.roster.members || {})) {
          if (isValidConversationId(member?.conversation_id)) {
            swarmMemberLookup.set(member.conversation_id, {
              coordinatorId: s.coordinatorId,
              swarmTitle: s.roster.title || '',
              name: mName,
              model: normalizeModelId(
                member.model || member.applied_model || member.desired_model || '',
              ),
            });
          }
        }
      }

      // Collect subagent parent hints when transcript-only conversations are rebuilt.
      const subagentHintMap = new Map();
      const hasTranscriptOnlyRebuild = needRebuild.some((c) => !c.hasDb);
      if (hasTranscriptOnlyRebuild) {
        for (const c of candidates) {
          if (!existsSync(c.paths.transcriptPath)) continue;
          const parsedParent = parseTranscript(c.convId, c.paths);
          if (!parsedParent) continue;
          const memberMeta = swarmMemberLookup.get(c.convId);
          const seedModel = memberMeta?.model || 'Auto';
          const { modelByStepIdx } = resolveModelTimeline(parsedParent, seedModel);
          for (const desc of extractSubagentCallDescriptors(parsedParent, modelByStepIdx)) {
            const key = desc.conversationId.toLowerCase();
            if (!subagentHintMap.has(key)) subagentHintMap.set(key, desc);
          }
        }
      }

      const forkedRebuilds = [];

      for (const c of needRebuild) {
        const parsed = parseTranscript(c.convId, c.paths);
        if (!parsed) continue;
        const convLower = c.convId.toLowerCase();
        const memberMeta = swarmMemberLookup.get(c.convId);
        let subHint = subagentHintMap.get(convLower);
        if (!subHint && !c.hasDb && !memberMeta) {
          subHint = findSubagentParentHint(c.convId, appDataDirs);
        }
        const defaultModel = normalizeModelId(
          memberMeta?.model || subHint?.defaultModel || 'Auto',
        );
        const { activeModel, modelByStepIdx } = resolveModelTimeline(parsed, defaultModel);
        const live = computeLiveStatus(parsed);
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
          if (step.type === 'PLANNER_RESPONSE' && step.hasTokenTelemetry) {
            latestContextTotal = step.input_tokens + step.cache_read_tokens;
          }
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
                input_tokens: step.input_tokens,
                cache_read_tokens: step.cache_read_tokens,
                output_tokens: step.output_tokens,
                isPlanner: step.type === 'PLANNER_RESPONSE',
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

    if (needRebuild.length > 0 || diskTopologyChanged) {
      rebuildRecoveredParents(diskByLower, summariesMap, threshold);
    }

    return { candidates, onDiskCount: candidates.length };
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
}) {
  const pricingByModel = new Map();
  const getPricing = (modelName) => {
    if (!pricingByModel.has(modelName)) {
      pricingByModel.set(modelName, resolveModelPricing(modelName, prefs));
    }
    return pricingByModel.get(modelName);
  };

  const activeDayKeys = new Set();
  const byModelMap = new Map();
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

      for (const [rawModelName, raw] of Object.entries(dayObj?.byModel || {})) {
        const modelName = normalizeModelId(rawModelName);
        const pricing = getPricing(modelName);
        const priced = priceBucketWithProfile(raw, pricing);
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

        let mEntry = byModelMap.get(modelName);
        if (!mEntry) {
          mEntry = {
            model: modelName,
            profileId: pricing.profileId,
            profileLabel: pricing.profileLabel,
            rateDisplay: formatRateSummary(pricing),
            convIds: new Set(),
            inputTokens: 0,
            cacheReadTokens: 0,
            outputTokens: 0,
            costActual: 0,
          };
          byModelMap.set(modelName, mEntry);
        }
        mEntry.convIds.add(convId);
        mEntry.inputTokens += rawIn;
        mEntry.cacheReadTokens += rawCache;
        mEntry.outputTokens += rawOut;
        mEntry.costActual += priced.costActual;
      }

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
          ? metadataStore?.get?.(convId, { schedule: false, appDataDirs }) || {
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
      const title = conv.title || conv.fallbackTitle || convId.slice(0, 8);
      convSummaries.push({
        conversationId: convId,
        title,
        workspace: conv.workspace || '',
        activeModel: normalizeModelId(conv.activeModel || 'Auto'),
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

  let trendGranularity = 'day';
  let series = [];
  const spanDaysCount = Math.max(1, daysBetweenLocalDates(startDate, endDate) + 1);

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

  const byModel = [...byModelMap.values()]
    .map((m) => ({
      model: m.model,
      profileId: m.profileId,
      profileLabel: m.profileLabel,
      rateDisplay: m.rateDisplay,
      conversationsCount: m.convIds.size,
      inputTokens: m.inputTokens,
      cacheReadTokens: m.cacheReadTokens,
      outputTokens: m.outputTokens,
      totalTokens: m.inputTokens + m.cacheReadTokens + m.outputTokens,
      costActual: m.costActual,
    }))
    .sort((a, b) => b.costActual - a.costActual || b.totalTokens - a.totalTokens);

  convSummaries.sort((a, b) => b.costActual - a.costActual || b.totalTokens - a.totalTokens);
  const topConversations = convSummaries.slice(0, 20);

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
  const { onDiskCount } = ledger.sync({
    appDataDirs,
    env: options.env,
    homeDir: options.homeDir,
    timingStore: options.timingStore,
    threshold: Number(effectivePrefs.longContextThreshold) || DEFAULT_PREFS.longContextThreshold,
  });

  const conversations = ledger.getData().conversations;
  const observedProfiles = new Set();
  const observedRawModels = new Set();
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
      if (dk < earliestDate) earliestDate = dk;
      for (const rawModelName of Object.keys(dayObj?.byModel || {})) {
        const nm = normalizeModelId(rawModelName);
        if (nm && !AUTO_UNKNOWN_RE.test(nm)) observedRawModels.add(nm);
      }
    }
    if (conv.onDisk !== false) {
      onDiskEntries.push([convId, conv]);
    }
  }

  const subInfo = resolveSubscriptionInfo(effectivePrefs, observedProfiles);
  const start7d = shiftLocalDate(todayDate, -6);
  const start30d = shiftLocalDate(todayDate, -29);
  const allSpanDays = Math.max(1, daysBetweenLocalDates(earliestDate, todayDate) + 1);

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
  });

  // Top 20 most recently updated on-disk conversations with lifetime totals.
  onDiskEntries.sort((a, b) => (b[1].updatedAtMs || 0) - (a[1].updatedAtMs || 0));
  const recentTop20 = onDiskEntries.slice(0, 20);
  const pricingByModel = new Map();
  const getPricing = (m) => {
    if (!pricingByModel.has(m)) pricingByModel.set(m, resolveModelPricing(m, effectivePrefs));
    return pricingByModel.get(m);
  };

  const recentConversations = recentTop20.map(([convId, conv]) => {
    const meta = options.metadataStore?.get?.(convId, { schedule: true, appDataDirs }) || {
      title: '',
      workspace: '',
    };
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
    return {
      conversationId: convId,
      title: conv.title || conv.fallbackTitle || convId.slice(0, 8),
      workspace: conv.workspace || '',
      activeModel: normalizeModelId(conv.activeModel || 'Auto'),
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
    recentConversations,
    subscription: subInfo,
    periods: {
      today: todayPeriod,
      '7d': period7d,
      '30d': period30d,
      all: periodAll,
    },
    _observedProfiles: observedProfiles,
    _observedRawModels: [...observedRawModels],
    _etagPart: `${todayDate}|${onDiskCount}|${Object.keys(conversations).length}|${etagParts.join(',')}`,
  };
// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================
}

// ============================================================================
// [MODIFIED END] 2026-11-16 21:20:00
// ============================================================================
