// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 21:27:00
// Description: Upgrade Token Monitor unit tests for v1.2.0 — verify normalizeModelId
// tier-free raw slug normalization, read-only SQLite conversations/<id>.db +
// conversation_summaries.db Protobuf decoding (eliminating Auto, excluding field_1
// enum IDs from token counts, accounting step_type=23 compaction without inflating
// context.currentTotal), totalTokens in byModel, and ledger v1->v2 auto-migration.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:37:27
// Description: Import spawnSync alongside spawn for optional git check-ignore portability checks.
// ============================================================================
import { spawn, spawnSync } from 'node:child_process';
// ============================================================================
// [MODIFIED END] 2026-11-17 21:37:27
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:54:00
// Description: Import createHash, cpSync, and readdirSync for v0.2.4 release
// hot-update SHA-256 verification and isolated plugin directory E2E tests.
// ============================================================================
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
// ============================================================================
// [MODIFIED END] 2026-11-17 18:54:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Import node:http for local mock HTTP E2E tests of pricing sync.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:33:22
// Description: Also import default http export for real http.setGlobalProxyFromEnv NO_PROXY loopback tests.
// ============================================================================
import http, { createServer } from 'node:http';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Import connect from node:net for v0.3.0 live TCP CONNECT proxy blackhole E2E recovery tests.
// ============================================================================
import { connect as netConnect } from 'node:net';
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 10:33:22
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:06:00
// Description: Import homedir to locate sidecar_sdk cleanly in isolated child tests.
// ============================================================================
import { homedir, tmpdir } from 'node:os';
// ============================================================================
// [MODIFIED END] 2026-11-17 11:06:00
// ============================================================================
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:14:47
// Description: Import node:vm for v0.2.7 headless Node VM behavioral tests of renderRollingText and card memoization.
// ============================================================================
import vm from 'node:vm';
// ============================================================================
// [MODIFIED END] 2026-11-17 22:14:47
// ============================================================================
import {
  DEFAULT_PREFS,
  LEDGER_SCHEMA_VERSION,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Import MODEL_ENUM_MAP, VALID_LANGUAGES, and VALID_TOKEN_UNITS
// for v0.2.2 preference & model normalization tests.
// ============================================================================
  MODEL_ENUM_MAP,
  MODEL_PRICING_CATALOG,
  SUBSCRIPTION_CATALOG,
  VALID_LANGUAGES,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:27:23
// Description: Import VALID_MODEL_SORT_DIRS and VALID_MODEL_SORT_KEYS for v0.2.5 sort preference validation tests.
// ============================================================================
  VALID_MODEL_SORT_DIRS,
  VALID_MODEL_SORT_KEYS,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:27:23
// ============================================================================
  VALID_TOKEN_UNITS,
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================
  analyzeConversation,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Import buildEffectivePricingCatalog, resolveModelPricing, and
// pricing_sync exports for v0.2.3 pricing sync unit & E2E tests.
// ============================================================================
  buildEffectivePricingCatalog,
  clearParserCache,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Import compareModelsByPerformance and scoreModelPerformance for
// performance-tier sorting and 3-pass model resolution unit tests.
// ============================================================================
  compareModelsByPerformance,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================
  computeContext,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:08:26
// Description: Import computeLiveStatus for post-/compact state machine unit tests.
// ============================================================================
  computeLiveStatus,
// ============================================================================
// [MODIFIED END] 2026-11-17 16:08:26
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Import computeMergedActiveDurationMs and sortChildrenByActivity for v0.2.9 active-duration merging and subagent/swarm activity sorting tests.
// ============================================================================
  computeMergedActiveDurationMs,
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================
  computeSpeed,
  computeStepCost,
  computeSubscriptionComparison,
  createMetadataStore,
  createUsageLedger,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:27:23
// Description: Import detectSubscriptionPlanFromModels for v0.2.5 raw-model subscription tier tests.
// ============================================================================
  detectSubscriptionPlanFromModels,
// ============================================================================
// [MODIFIED END] 2026-11-17 20:27:23
// ============================================================================
  detectSubscriptionPlanFromProfiles,
  discoverAppDataDirs,
  formatLocalDate,
  isValidConversationId,
  normalizeModelId,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Import parseRawSummarySideQuestions for v0.4.1 Side Questions protobuf & SQLite tests.
// ============================================================================
  parseRawSummarySideQuestions,
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
  parseTranscript,
  resolveConversationPaths,
  resolveModelPricing,
  resolveModelProfile,
  resolveSubscriptionInfo,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Import scoreModelPerformance for capability score tests.
// ============================================================================
  scoreModelPerformance,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Import sortChildrenByActivity for v0.2.9 Top-5 recent-active child ordering tests.
// ============================================================================
  sortChildrenByActivity,
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================
  summarizeGlobalAndRecent,
} from '../sidecars/monitor_pane/parser.mjs';
import {
  createPricingSyncManager,
  isChatModelCandidate,
  parseGoogleOfficialPricingHtml,
  parseLiteLlmCatalog,
  parseModelsDevCatalog,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Import parseUsdToCnyRateJson for FX synchronization tests.
// ============================================================================
  parseUsdToCnyRateJson,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
} from '../sidecars/monitor_pane/pricing_sync.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:54:00
// Description: Import release_updater exports for v0.2.4 semver, ZIP archive
// security, ETag 304 caching, and SHA-256 hot-update unit & E2E tests.
// ============================================================================
import {
  buildZipBuffer,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:33:22
// Description: Import classifyFetchError for v0.2.8 fetch/undici error classification tests.
// ============================================================================
  classifyFetchError,
// ============================================================================
// [MODIFIED END] 2026-11-18 10:33:22
// ============================================================================
  compareSemver,
  createReleaseUpdater,
  normalizeReleaseTag,
  parseSemver,
  parseZipBuffer,
} from '../sidecars/monitor_pane/release_updater.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-17 18:54:00
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:33:22
// Description: Import net_proxy exports for v0.2.8 OS/env HTTP(S) proxy auto-detection and NO_PROXY loopback tests.
// ============================================================================
import {
  LOOPBACK_NO_PROXY,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Import DEFAULT_MAX_DISPATCHER_AGE_MS, parseWindowsUserEnvProxyOutput,
// and resolveLiveOsSystemProxy for v0.3.0 net_proxy lifecycle and fallback tests.
// ============================================================================
  DEFAULT_MAX_DISPATCHER_AGE_MS,
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Import DEFAULT_OS_LOOKUP_TIMEOUT_MS and isTransientLookupError
// for v0.4.0 high-CPU system proxy anti-flap tests.
// ============================================================================
  DEFAULT_OS_LOOKUP_TIMEOUT_MS,
  isTransientLookupError,
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
  normalizeHttpProxyUrl,
  redactProxyUrl,
  ensureLoopbackNoProxy,
  parseWindowsRegProxyOutput,
  parseMacScutilProxyOutput,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Import parseWindowsUserEnvProxyOutput and resolveLiveOsSystemProxy for v0.3.0 tests.
// ============================================================================
  parseWindowsUserEnvProxyOutput,
  resolveLiveOsSystemProxy,
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
  resolveProxyConfig,
  createSystemProxyManager,
} from '../sidecars/monitor_pane/net_proxy.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-18 10:33:22
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Import clipboard_image helpers for v0.3.1 PNG validation and
// cross-platform OS clipboard copy tests.
// ============================================================================
import {
  MAX_CLIPBOARD_PNG_BYTES,
  PNG_SIGNATURE,
  decodeAndValidatePngBase64,
  copyPngToSystemClipboard,
} from '../sidecars/monitor_pane/clipboard_image.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:42:45
// Description: Add WHATWG-fetch-safe loopback port helpers to avoid flaky Error: bad port
// when Windows dynamic ports (1024-15000) allocate Fetch-blocked ports such as 10080 or 6000.
// ============================================================================
const WHATWG_FETCH_BAD_PORTS = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
]);

async function listenOnFetchSafePort(server) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address()?.port;
    if (port > 1024 && !WHATWG_FETCH_BAD_PORTS.has(port)) {
      return port;
    }
    await new Promise((r) => server.close(() => r()));
  }
  throw new Error('Unable to allocate a WHATWG-fetch-safe loopback port');
}

async function pickFetchSafeFreePort() {
  const heldBadProbes = [];
  try {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const probe = createServer();
      await new Promise((r) => probe.listen(0, '127.0.0.1', r));
      const port = probe.address()?.port;
      if (port > 1024 && !WHATWG_FETCH_BAD_PORTS.has(port)) {
        await new Promise((r) => probe.close(() => r()));
        return port;
      }
      heldBadProbes.push(probe);
    }
    throw new Error('Unable to allocate a WHATWG-fetch-safe ephemeral port');
  } finally {
    await Promise.all(heldBadProbes.map((p) => new Promise((r) => p.close(() => r()))));
  }
}
// ============================================================================
// [MODIFIED END] 2026-11-17 21:42:45
// ============================================================================

function makeTempEnv() {
  const root = mkdtempSync(join(tmpdir(), 'agy-token-monitor-test-'));
  const appData = join(root, 'antigravity');
  mkdirSync(join(appData, 'brain'), { recursive: true });
  return { root, appData };
}

function writeConversation(appData, convId, { compactLines, fullLines, members, mtimeMs } = {}) {
  const logsDir = join(appData, 'brain', convId, '.system_generated', 'logs');
  mkdirSync(logsDir, { recursive: true });
  const compactPath = join(logsDir, 'transcript.jsonl');
  writeFileSync(
    compactPath,
    (compactLines || []).map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n',
    'utf-8',
  );
  if (fullLines) {
    const fullPath = join(logsDir, 'transcript_full.jsonl');
    writeFileSync(
      fullPath,
      fullLines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n',
      'utf-8',
    );
  }
  if (members) {
    const swarmDir = join(appData, 'brain', convId, '.system_generated', 'swarm');
    mkdirSync(swarmDir, { recursive: true });
    writeFileSync(join(swarmDir, 'members.json'), JSON.stringify(members, null, 2), 'utf-8');
  }
  if (mtimeMs) {
    const sec = mtimeMs / 1000;
    utimesSync(compactPath, sec, sec);
  }
  return compactPath;
}

test('conversation ID validation & appDataDirs discovery', () => {
  assert.equal(isValidConversationId('5a0ffe7b-cb3e-4b63-9c62-e2df8ce808f5'), true);
  assert.equal(isValidConversationId('1234abcd'), true);
  assert.equal(isValidConversationId('../escape'), false);
  assert.equal(isValidConversationId('short'), false);
  assert.equal(isValidConversationId('tempmediaStorage'), false);

  const { root, appData } = makeTempEnv();
  try {
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });

    const homeRoot = join(root, 'home');
    const otherAppData = join(homeRoot, '.gemini', 'other_product');
    mkdirSync(join(otherAppData, 'brain'), { recursive: true });
    const dupAppData = join(homeRoot, '.gemini', 'antigravity');
    mkdirSync(join(dupAppData, 'brain'), { recursive: true });

    const discovered = discoverAppDataDirs({
      env: { ANTIGRAVITY_EXECUTABLE_DATA_DIR: dataDir },
      homeDir: homeRoot,
    });
    assert.equal(discovered[0], appData);
    assert.ok(discovered.includes(otherAppData));
    assert.ok(discovered.includes(dupAppData));
    assert.equal(discovered.length, 3);

    assert.equal(resolveConversationPaths('../bad', [appData]), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('live status state machine: GENERATING, RUNNING_TOOLS, and IDLE transitions', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    // 1. Last step USER_INPUT -> GENERATING
    const c1 = '11111111-1111-4111-8111-111111111111';
    writeConversation(appData, c1, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-16T04:00:00Z',
          content: '<USER_REQUEST>hello</USER_REQUEST>',
        },
      ],
    });
    const r1 = analyzeConversation(c1, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(r1.status, 'GENERATING');
    assert.equal(r1.generatingSinceMs, Date.parse('2026-11-16T04:00:00Z'));

    // 2. Last step PLANNER_RESPONSE with 0 tool_calls -> IDLE
    const c2 = '22222222-2222-4222-8222-222222222222';
    writeConversation(appData, c2, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-16T04:00:00Z',
          content: 'hi',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T04:00:02Z',
          input_tokens: 1000,
          cache_read_tokens: 500,
          output_tokens: 200,
          tool_calls: [],
        },
      ],
    });
    const r2 = analyzeConversation(c2, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(r2.status, 'IDLE');
    assert.equal(r2.generatingSinceMs, null);

    // 3. Last PLANNER_RESPONSE with 3 tool_calls and 1 GENERIC -> RUNNING_TOOLS
    const c3 = '33333333-3333-4333-8333-333333333333';
    writeConversation(appData, c3, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T04:00:00Z',
          input_tokens: 1000,
          cache_read_tokens: 0,
          output_tokens: 100,
          tool_calls: [
            { name: 'read_file', args: { Path: '/tmp/a.js' } },
            { name: 'edit_file', args: { toolSummary: '"Patch parser logic"', Path: '/tmp/b.js' } },
            { name: 'run_command', args: { toolAction: 'Running tests' } },
          ],
        },
        {
          step_index: 1,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T04:00:02Z',
          content: 'Created At: 2026-11-16T04:00:02Z\nCompleted At: 2026-11-16T04:00:03Z\nok',
        },
      ],
    });
    const r3 = analyzeConversation(c3, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(r3.status, 'RUNNING_TOOLS');
    assert.deepEqual(r3.toolProgress, { done: 1, total: 3 });
    assert.equal(r3.activeToolLabel, 'Patch parser logic');

    // 4. All tools completed (k >= N) -> GENERATING with max Completed At timestamp
    const c4 = '44444444-4444-4444-8444-444444444444';
    writeConversation(appData, c4, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T04:00:00Z',
          input_tokens: 1000,
          cache_read_tokens: 0,
          output_tokens: 100,
          tool_calls: [{ name: 'read_file' }, { name: 'run_command' }],
        },
        {
          step_index: 1,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T04:00:02Z',
          content: 'Created At: 2026-11-16T04:00:02Z\nCompleted At: 2026-11-16T04:00:05Z\nok',
        },
        {
          step_index: 2,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T04:00:03Z',
          content: 'Created At: 2026-11-16T04:00:03Z\nCompleted At: 2026-11-16T04:00:08Z\nok',
        },
      ],
    });
    const r4 = analyzeConversation(c4, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(r4.status, 'GENERATING');
    assert.equal(r4.generatingSinceMs, Date.parse('2026-11-16T04:00:08Z'));

    // 5. swarm_wait with DONE -> IDLE
    const c5 = '55555555-5555-4555-8555-555555555555';
    writeConversation(appData, c5, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T04:00:00Z',
          input_tokens: 1000,
          cache_read_tokens: 0,
          output_tokens: 50,
          tool_calls: [{ name: 'post_message' }, { name: 'swarm_wait' }],
        },
        {
          step_index: 1,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T04:00:01Z',
          content: 'posted',
        },
        {
          step_index: 2,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T04:00:01Z',
          content: 'waiting',
        },
      ],
    });
    const r5 = analyzeConversation(c5, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(r5.status, 'IDLE');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('speed (tok/s) priority rules, filtering <0.2s, weighted average, and 20-step cap', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convId = '66666666-6666-4666-8666-666666666666';
    const baseMs = Date.parse('2026-11-16T05:00:00Z');
    const lines = [];
    // 22 measured PLANNER_RESPONSE steps + 1 unmeasured fast step (0.1s)
    for (let i = 0; i < 22; i++) {
      const tStart = new Date(baseMs + i * 10000).toISOString();
      const tEndHeader = new Date(baseMs + i * 10000 + 2000).toISOString(); // 2.0s
      lines.push({
        step_index: i * 2,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: tStart,
        input_tokens: 1000,
        cache_read_tokens: 1000,
        output_tokens: i === 5 ? 400 : 100, // step 10 has 200 tok/s peak
        tool_calls: [{ name: 'read_file' }],
      });
      lines.push({
        step_index: i * 2 + 1,
        type: 'GENERIC',
        status: 'DONE',
        created_at: new Date(baseMs + i * 10000 + 5000).toISOString(),
        content: `Created At: ${tEndHeader}\nCompleted At: ${tEndHeader}\nok`,
      });
    }
    // Step with 0.1s duration (<0.2s) must be excluded from tok/s
    const fastIdx = 44;
    lines.push({
      step_index: fastIdx,
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      created_at: new Date(baseMs + 220000).toISOString(),
      input_tokens: 1000,
      cache_read_tokens: 1000,
      output_tokens: 50,
      tool_calls: [{ name: 'read_file' }],
    });
    lines.push({
      step_index: fastIdx + 1,
      type: 'GENERIC',
      status: 'DONE',
      created_at: new Date(baseMs + 220100).toISOString(),
      content: `Created At: ${new Date(baseMs + 220100).toISOString()}\nok`,
    });
    // Final 0-tool step whose end time comes from stat.mtimeMs (last line)
    const lastStepIdx = 46;
    const lastStartMs = baseMs + 230000;
    const fileMtimeMs = lastStartMs + 4000; // 4.0s -> 200 / 4.0 = 50 tok/s
    lines.push({
      step_index: lastStepIdx,
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      created_at: new Date(lastStartMs).toISOString(),
      input_tokens: 1000,
      cache_read_tokens: 1000,
      output_tokens: 200,
      tool_calls: [],
    });

    writeConversation(appData, convId, { compactLines: lines, mtimeMs: fileMtimeMs });

    // Without timingStore override: last line uses stat.mtimeMs (4s -> 50 tok/s)
    const res1 = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(res1.speed.measuredStepsCount, 23);
    assert.equal(res1.speed.recentSteps.length, 20);
    assert.equal(res1.speed.latestStepTokPerSec, 50);
    assert.equal(res1.speed.peakTokPerSec, 200);
    // totalOut = 21*100 + 400 + 200 = 2700; totalDur = 22*2 + 4 = 48s -> 56.25 tok/s
    assert.ok(Math.abs(res1.speed.weightedAvgTokPerSec - 2700 / 48) < 1e-6);

    // With timingStore override on step 0 (1.0s instead of 2.0s -> 100 tok/s) & last step (2.0s -> 100 tok/s)
    const timingMap = new Map([
      [`${convId}:0`, baseMs + 1000],
      [`${convId}:${lastStepIdx}`, lastStartMs + 2000],
    ]);
    const timingStore = { getEndMs: (c, s) => timingMap.get(`${c}:${s}`) };
    const res2 = analyzeConversation(convId, {
      appDataDirs: [appData],
      timingStore,
      disableAgentApi: true,
    });
    assert.equal(res2.speed.latestStepTokPerSec, 100);
    assert.equal(res2.speed.latestStepDurationSec, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('<USER_SETTINGS_CHANGE> timeline and transcript_full.jsonl fallback + stat cache', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convId = '77777777-7777-4777-8777-777777777777';
    const fullLine0 = {
      step_index: 0,
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: '2026-11-16T06:00:00Z',
      content:
        '<USER_REQUEST>Initial prompt</USER_REQUEST>\n<USER_SETTINGS_CHANGE>\nThe user changed setting `Model Selection` from None to Gemini 3.8 Flash (High). No need to comment on this change.\n</USER_SETTINGS_CHANGE>',
    };
    const compactLine0 = {
      ...fullLine0,
      content: '<USER_REQUEST>Initial prompt</USER_REQUEST>\n<truncated 300 bytes>',
      truncated_fields: ['content'],
    };
    const step1 = {
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      created_at: '2026-11-16T06:00:02Z',
      input_tokens: 5000,
      cache_read_tokens: 0,
      output_tokens: 100,
      tool_calls: [],
    };
    const step2 = {
      step_index: 2,
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: '2026-11-16T06:01:00Z',
      content:
        '<USER_REQUEST>Switch model</USER_REQUEST>\n<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from Gemini 3.8 Flash (High) to Gemini 2.5 Pro.</USER_SETTINGS_CHANGE>',
    };
    const step3 = {
      step_index: 3,
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      created_at: '2026-11-16T06:01:02Z',
      input_tokens: 2000,
      cache_read_tokens: 4000,
      output_tokens: 150,
      tool_calls: [],
    };

    const transcriptPath = writeConversation(appData, convId, {
      compactLines: [compactLine0, step1, step2, step3],
      fullLines: [fullLine0, step1, step2, step3],
      mtimeMs: Date.parse('2026-11-16T06:01:04Z'),
    });

    const res = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(res.activeModel, 'gemini-2.5-pro');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert Scheme A canonical byModel labels and rawModels preservation.
// ============================================================================
    const byModelNames = res.totals.byModel.map((m) => m.model).sort();
    assert.deepEqual(byModelNames, ['Gemini 3.8 Flash', 'Gemini 4 Carbon']);
    const rawModelsFlat = res.totals.byModel.flatMap((m) => m.rawModels || []).sort();
    assert.deepEqual(rawModelsFlat, ['gemini-2.5-pro', 'gemini-3.8-flash']);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================

    // Verify stat-based caching returns exact same parsed reference when unchanged
    const paths = resolveConversationPaths(convId, [appData]);
    const p1 = parseTranscript(convId, paths);
    const p2 = parseTranscript(convId, paths);
    assert.equal(p1, p2);

    // Updating transcript invalidates cache cleanly
    const step4 = {
      step_index: 4,
      type: 'USER_INPUT',
      status: 'DONE',
      created_at: '2026-11-16T06:02:00Z',
      content:
        '<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from Gemini 2.5 Pro to Auto</USER_SETTINGS_CHANGE>',
    };
    writeFileSync(
      transcriptPath,
      [compactLine0, step1, step2, step3, step4].map((x) => JSON.stringify(x)).join('\n') + '\n',
      'utf-8',
    );
    const p3 = parseTranscript(convId, paths);
    assert.notEqual(p3, p1);
    const resUpdated = analyzeConversation(convId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(resUpdated.activeModel, 'Auto');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('context threshold levels (usageLevel & watermarkLevel alias) and top 5 spikes', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convId = '88888888-8888-4888-8888-888888888888';
    const makeLines = (finalTotal) => [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: '2026-11-16T07:00:00Z',
        content: 'start',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-16T07:00:01Z',
        input_tokens: 10000,
        cache_read_tokens: 0,
        output_tokens: 100,
        tool_calls: [{ name: 'read_file', args: { Path: '/src/big1.ts' } }],
      },
      { step_index: 2, type: 'GENERIC', status: 'DONE', created_at: '2026-11-16T07:00:02Z', content: 'ok' },
      {
        step_index: 3,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-16T07:00:03Z',
        input_tokens: 20000,
        cache_read_tokens: 50000,
        output_tokens: 100,
        tool_calls: [{ name: 'run_command', args: { toolSummary: 'Dump huge build log' } }],
      },
      { step_index: 4, type: 'GENERIC', status: 'DONE', created_at: '2026-11-16T07:00:04Z', content: 'ok' },
      {
        step_index: 5,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-16T07:00:05Z',
        input_tokens: finalTotal - 60000,
        cache_read_tokens: 60000,
        output_tokens: 100,
        tool_calls: [],
      },
    ];

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Update context threshold assertions for v0.2.2 defaults
// (400k WARNING, 460k CRITICAL, 500k max window) and verify DEFAULT_PREFS.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update default context limits to 409600/512000 and critical threshold to 471040 (92%).
// ============================================================================
    assert.equal(DEFAULT_PREFS.softContextLimit, 409600);
    assert.equal(DEFAULT_PREFS.hardContextLimit, 512000);
    assert.equal(DEFAULT_PREFS.tokenUnit, 'auto');
    assert.equal(DEFAULT_PREFS.language, 'zh');
    assert.deepEqual([...VALID_TOKEN_UNITS], ['auto', 'wan_yi', 'exact', 'm']);
    assert.deepEqual([...VALID_LANGUAGES], ['zh', 'en']);

    // HEALTHY (< 409.6k)
    writeConversation(appData, convId, { compactLines: makeLines(150000) });
    const h = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(h.context.usageLevel, 'HEALTHY');
    assert.equal(h.context.watermarkLevel, 'HEALTHY');
    assert.equal(h.context.softLimit, 409600);
    assert.equal(h.context.hardLimit, 512000);
    assert.equal(h.context.currentTotal, 150000);
    assert.equal(h.context.latestCacheHitRatePct, 40);
    assert.equal(h.context.latestNetDelta, 80000);
    assert.equal(h.context.topSpikes[0].stepIndex, 5);
    assert.equal(h.context.topSpikes[0].deltaTokens, 80000);
    assert.equal(h.context.topSpikes[0].triggerSummary, 'Dump huge build log');
    assert.equal(h.context.topSpikes[1].triggerSummary, 'Read big1.ts');

    // Still HEALTHY just below 409,600
    writeConversation(appData, convId, {
      compactLines: makeLines(409599),
      mtimeMs: Date.now() + 1000,
    });
    const hBorder = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(hBorder.context.usageLevel, 'HEALTHY');

    // WARNING (>= 409,600, < 471,040)
    writeConversation(appData, convId, {
      compactLines: makeLines(430000),
      mtimeMs: Date.now() + 2000,
    });
    const w = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(w.context.usageLevel, 'WARNING');
    assert.equal(w.context.watermarkLevel, 'WARNING');

    // Still WARNING right below 471,040
    writeConversation(appData, convId, {
      compactLines: makeLines(471039),
      mtimeMs: Date.now() + 3000,
    });
    const wBorder = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(wBorder.context.usageLevel, 'WARNING');

    // CRITICAL (>= 471,040, i.e. Math.max(512000*0.92, 409600 + (512000-409600)*0.6))
    writeConversation(appData, convId, {
      compactLines: makeLines(471040),
      mtimeMs: Date.now() + 4000,
    });
    const c = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(c.context.usageLevel, 'CRITICAL');
    assert.equal(c.context.watermarkLevel, 'CRITICAL');
    assert.equal(c.context.hardUsagePct, 92);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('active per-model pricing (incl. Claude Opus/Sonnet 5.5), overrides, CNY conversion, and >200k tier', () => {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Update expected catalog length to 9 with dedicated gemini-3.1-pro.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Update expected catalog length to 10 with first-class gemini-4-neon.
// ============================================================================
  assert.equal(MODEL_PRICING_CATALOG.length, 10);
  assert.equal(resolveModelProfile('Gemini 3.1 Pro (High)').id, 'gemini-3.1-pro');
  assert.equal(resolveModelProfile('Gemini 4 Neon (High)').id, 'gemini-4-neon');
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
  assert.equal(resolveModelProfile('Gemini 4 Carbon (High)').id, 'gemini-4-carbon');
  assert.equal(resolveModelProfile('Orchestrator (Carbon)').id, 'gemini-4-carbon');
  assert.equal(resolveModelProfile('Gemini 4 Argon (Low)').id, 'gemini-4-argon');
  assert.equal(resolveModelProfile('Orchestrator (Argon)').id, 'gemini-4-argon');
  assert.equal(resolveModelProfile('Gemini 4 Hydrogen (XHigh)').id, 'gemini-4-hydrogen');
  assert.equal(resolveModelProfile('Gemini 3.8 Flash (High)').id, 'gemini-3-8-flash');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update bare gemini-flash-worker-agy profile resolution to gemini-4-hydrogen.
// ============================================================================
  assert.equal(resolveModelProfile('gemini-flash-worker-agy').id, 'gemini-4-hydrogen');
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
  assert.equal(resolveModelProfile('Claude Opus 5.5 (High)').id, 'claude-opus-5-5');
  assert.equal(resolveModelProfile('Claude Sonnet 5.5 (Medium)').id, 'claude-sonnet-5-5');
  assert.equal(resolveModelProfile('GPT-OSS 120B (Medium)').id, 'gpt-oss-120b');
  assert.equal(resolveModelProfile('Auto').id, 'auto');

  const step200k = {
    input_tokens: 50000,
    cache_read_tokens: 150000,
    output_tokens: 10000,
  };
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:26:51
// Description: Update Gemini 4 Carbon cached rate (95% discount, $0.10/1M),
// verify flat 1M context on Gemini 4 Carbon, and test >200k tier + override on Gemini 3.1 Pro.
// ============================================================================
  // Gemini 4 Carbon (2.0 / 0.10 / 10.0): (50k/1M)*2.0 + (150k/1M)*0.10 + (10k/1M)*10.0 = 0.10 + 0.015 + 0.10 = 0.215
  const carbonBase = computeStepCost(step200k, DEFAULT_PREFS, 'Gemini 4 Carbon (High)');
  assert.ok(Math.abs(carbonBase.costActual - 0.215) < 1e-9);

  // Claude Opus 5.5 (4.0 / 0.20 / 20.0, flat >200k): (50k/1M)*4 + (150k/1M)*0.2 + (10k/1M)*20 = 0.2 + 0.03 + 0.2 = 0.43
  const opusCost = computeStepCost(step200k, DEFAULT_PREFS, 'Claude Opus 5.5 (High)');
  assert.ok(Math.abs(opusCost.costActual - 0.43) < 1e-9);

  // Claude Sonnet 5.5 (2.0 / 0.10 / 10.0): 0.10 + 0.015 + 0.10 = 0.215
  const sonnetCost = computeStepCost(step200k, DEFAULT_PREFS, 'Claude Sonnet 5.5 (High)');
  assert.ok(Math.abs(sonnetCost.costActual - 0.215) < 1e-9);

  // Gemini 4 Carbon is flat across 1M context (longContextTier: false):
  // (100k/1M)*2.0 + (200k/1M)*0.10 + (10k/1M)*10.0 = 0.20 + 0.02 + 0.10 = 0.32
  const longStep = {
    input_tokens: 100000,
    cache_read_tokens: 200000,
    output_tokens: 10000,
  };
  const carbonLong = computeStepCost(longStep, DEFAULT_PREFS, 'Gemini 4 Carbon (High)');
  assert.ok(Math.abs(carbonLong.costActual - 0.32) < 1e-9);

  // Long-context tier (> 200k) on Gemini 3.1 Pro triggers 2.0x input/cached and 1.5x output:
  // (100k/1M)*4.0 + (200k/1M)*0.40 + (10k/1M)*18.0 = 0.40 + 0.08 + 0.18 = 0.66
  const gemini31Long = computeStepCost(longStep, DEFAULT_PREFS, 'Gemini 3.1 Pro (High)');
  assert.ok(Math.abs(gemini31Long.costActual - 0.66) < 1e-9);

  // Disabling longContextTier via modelOverrides on gemini-3.1-pro
  const noLongPrefs = {
    ...DEFAULT_PREFS,
    modelOverrides: {
      'gemini-3.1-pro': { inputPer1M: 2.0, cachedPer1M: 0.2, outputPer1M: 12.0, longContextTier: false },
    },
  };
  // (100k/1M)*2.0 + (200k/1M)*0.20 + (10k/1M)*12.0 = 0.20 + 0.04 + 0.12 = 0.36
  const flat31Pro = computeStepCost(longStep, noLongPrefs, 'Gemini 3.1 Pro (High)');
  assert.ok(Math.abs(flat31Pro.costActual - 0.36) < 1e-9);
// ============================================================================
// [MODIFIED END] 2026-11-19 14:26:51
// ============================================================================

  // CNY currency conversion scales by cnyRate
  const cnyPrefs = { ...DEFAULT_PREFS, currency: 'CNY', cnyRate: 7.25 };
  const opusCny = computeStepCost(step200k, cnyPrefs, 'Claude Opus 5.5 (High)');
  assert.ok(Math.abs(opusCny.costActual - 0.43 * 7.25) < 1e-9);
});

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:27:23
// Description: Update subscription tier detection assertions for v0.2.5 model rules
// (ultra_5x, pro, jio_pro) and verify jio_pro ($0/mo), pro ($19.99/mo), and ultra_5x ($99.99/mo) ROI math.
// ============================================================================
test('subscription auto-detection and prorated netSavings / ROI comparison', () => {
  // Ultra 5x ($99.99/mo): Gemini 4 Carbon / Orchestrator (Carbon)
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-4-carbon'])), 'ultra_5x');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-pro-orchestrator'])), 'ultra_5x');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-4-carbon'])), 'ultra_5x');

  // Google AI Pro ($19.99/mo): Claude 5.5 Opus/Sonnet, Argon, Hydrogen, Gemini 3.1 Pro
  assert.equal(detectSubscriptionPlanFromModels(new Set(['claude-opus-5-5'])), 'pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['claude-sonnet-5-5'])), 'pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-4-argon'])), 'pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-pro-orchestrator-argon'])), 'pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-4-hydrogen'])), 'pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-3.1-pro'])), 'pro');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-4-argon'])), 'pro');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['claude-sonnet-5-5'])), 'pro');

  // Jio AI Pro ($0/mo): Flash variants, GPT-OSS, legacy 4.6/2.5/generic pro, Auto, empty
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-3.8-flash'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-3-8-flash'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-3.8-flash-control'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gpt-oss-120b'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['claude-opus-4-6'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-2.5-pro'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['gemini-pro'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set(['Auto'])), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(new Set()), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-3-8-flash'])), 'jio_pro');

  const subUltra = resolveSubscriptionInfo(DEFAULT_PREFS, new Set(['gemini-4-carbon', 'gemini-4-hydrogen']));
  assert.equal(subUltra.planId, 'ultra_5x');
  assert.equal(subUltra.monthlyUsd, 99.99);
  assert.equal(subUltra.isAutoDetected, true);

  const subPro = resolveSubscriptionInfo(DEFAULT_PREFS, new Set(['claude-opus-5-5']));
  assert.equal(subPro.planId, 'pro');
  assert.equal(subPro.monthlyUsd, 19.99);
  assert.equal(subPro.isAutoDetected, true);

  const subJio = resolveSubscriptionInfo(DEFAULT_PREFS, new Set(['gemini-3.8-flash-control', 'gpt-oss-120b']));
  assert.equal(subJio.planId, 'jio_pro');
  assert.equal(subJio.monthlyUsd, 0);
  assert.equal(subJio.monthlyFee, 0);
  assert.equal(subJio.isAutoDetected, true);

  const explicitFree = resolveSubscriptionInfo({ ...DEFAULT_PREFS, subscriptionPlan: 'free' }, new Set(['gemini-4-carbon']));
  assert.equal(explicitFree.planId, 'free');
  assert.equal(explicitFree.monthlyUsd, 0);
  assert.equal(explicitFree.isAutoDetected, false);

  // 30d comparison uses full monthly fee
  const roi30d = computeSubscriptionComparison(299.97, 30, subUltra);
  assert.ok(Math.abs(roi30d.proratedFee - 99.99) < 1e-9);
  assert.ok(Math.abs(roi30d.netSavings - 199.98) < 1e-9);
  assert.ok(Math.abs(roi30d.roiMultiplier - 3.0) < 1e-9);
  assert.equal(roi30d.isPaidOff, true);

  // 7d prorates 99.99 * (7/30)
  const roi7d = computeSubscriptionComparison(10.0, 7, subUltra);
  const expected7dFee = 99.99 * (7 / 30);
  assert.ok(Math.abs(roi7d.proratedFee - expected7dFee) < 1e-9);
  assert.ok(Math.abs(roi7d.netSavings - (10.0 - expected7dFee)) < 1e-9);
  assert.equal(roi7d.isPaidOff, false);

  // Custom USD + CNY conversion
  const customSub = resolveSubscriptionInfo(
    { ...DEFAULT_PREFS, currency: 'CNY', cnyRate: 7.0, subscriptionPlan: 'custom', customSubscriptionMonthlyUsd: 50 },
    new Set(['gemini-4-carbon']),
  );
  assert.equal(customSub.planId, 'custom');
  assert.equal(customSub.monthlyFee, 350);
  assert.equal(SUBSCRIPTION_CATALOG.pro.monthlyUsd, 19.99);
  assert.equal(SUBSCRIPTION_CATALOG.jio_pro.monthlyUsd, 0);
  assert.equal(SUBSCRIPTION_CATALOG.jio_pro.label, 'Jio AI Pro');
});
// ============================================================================
// [MODIFIED END] 2026-11-17 20:27:23
// ============================================================================

test('subagent & swarm aggregation isolates main contextTotal and avoids cycles', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const subId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const workerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    writeConversation(appData, parentId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-16T08:00:00Z',
          content:
            '<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from None to Gemini Pro.</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T08:00:01Z',
          input_tokens: 10000,
          cache_read_tokens: 40000,
          output_tokens: 500,
          tool_calls: [
            {
              name: 'invoke_subagent',
              args: {
                Subagents: JSON.stringify([{ Model: 'Gemini Flash', Name: 'Researcher' }]),
                toolSummary: '"Spawn Researcher"',
              },
            },
          ],
        },
        {
          step_index: 2,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T08:00:02Z',
          content: `Created At: 2026-11-16T08:00:02Z\nCompleted At: 2026-11-16T08:00:03Z\n{"conversationId":"${subId}"}`,
        },
      ],
      members: {
        title: 'Swarm Test',
        members: {
          coordinator: { conversation_id: parentId, role: 'coordinator', model: 'Gemini Pro' },
          backend: { conversation_id: workerId, role: 'worker', model: 'gemini-flash-worker' },
        },
      },
      mtimeMs: Date.parse('2026-11-16T08:00:05Z'),
    });

    // Subagent also mentions parentId in a GENERIC output to ensure cycle detection works
    writeConversation(appData, subId, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T08:00:03Z',
          input_tokens: 20000,
          cache_read_tokens: 100000,
          output_tokens: 1200,
          tool_calls: [{ name: 'send_message' }],
        },
        {
          step_index: 1,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-16T08:00:05Z',
          content: `Message sent to ${parentId}`,
        },
      ],
      mtimeMs: Date.parse('2026-11-16T08:00:06Z'),
    });

    writeConversation(appData, workerId, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-16T08:00:04Z',
          input_tokens: 5000,
          cache_read_tokens: 10000,
          output_tokens: 300,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse('2026-11-16T08:00:06Z'),
    });

    const res = analyzeConversation(parentId, { appDataDirs: [appData], disableAgentApi: true });
    // Strict main context isolation: 10k + 40k = 50k (NOT 50k + 120k + 15k)
    assert.equal(res.context.currentTotal, 50000);
    assert.equal(res.totals.mainOnly.outputTokens, 500);
    assert.equal(res.totals.withChildren.outputTokens, 500 + 1200 + 300);
    assert.equal(res.totals.withChildren.stepsCount, 3);
    assert.equal(res.children.length, 2);

    const subChild = res.children.find((c) => c.conversationId === subId);
    assert.equal(subChild.kind, 'subagent');
    assert.equal(subChild.name, 'Researcher');
    assert.equal(subChild.model, 'gemini-3.8-flash');
    assert.equal(subChild.contextTotal, 120000);

    const swarmChild = res.children.find((c) => c.conversationId === workerId);
    assert.equal(swarmChild.kind, 'swarm');
    assert.equal(swarmChild.name, 'backend');
    assert.equal(swarmChild.model, 'gemini-flash-worker');

    // Direct inspection of subagent inherits its normalized Model arg from parent
    const directSub = analyzeConversation(subId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(directSub.activeModel, 'gemini-3.8-flash');

    // Global summary checks today's local date filtering
    const todayAnchorMs = Date.parse('2026-11-16T09:00:00Z');
    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: todayAnchorMs,
      disableAgentApi: true,
    });
    assert.equal(global.todayDate, formatLocalDate(todayAnchorMs));
    assert.equal(global.todayConversationsCount, 3);
    assert.equal(global.todayOutputTokens, 2000);
    assert.equal(global.recentConversations.length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('summarizeGlobalAndRecent isolates local date steps and caps recentConversations at 20', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const todayAnchorMs = Date.parse('2026-11-16T06:00:00Z');
    const yesterdayTs = new Date(todayAnchorMs - 24 * 3600 * 1000).toISOString();
    const todayTs = new Date(todayAnchorMs - 60 * 1000).toISOString();

    for (let i = 0; i < 23; i++) {
      const hex = i.toString(16).padStart(2, '0');
      const convId = `dddd00${hex}-0000-4000-8000-0000000000${hex}`;
      const lines = [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: yesterdayTs,
          input_tokens: 1000,
          cache_read_tokens: 0,
          output_tokens: 100,
          tool_calls: [],
        },
      ];
      if (i === 0) {
        lines.push({
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: todayTs,
          input_tokens: 2000,
          cache_read_tokens: 8000,
          output_tokens: 250,
          tool_calls: [],
        });
      }
      writeConversation(appData, convId, {
        compactLines: lines,
        mtimeMs: todayAnchorMs - i * 10000,
      });
    }

    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: todayAnchorMs,
      disableAgentApi: true,
    });
    assert.equal(global.todayConversationsCount, 1);
    assert.equal(global.todayInputTokens, 2000);
    assert.equal(global.todayCacheReadTokens, 8000);
    assert.equal(global.todayOutputTokens, 250);
    assert.equal(global.recentConversations.length, 20);
    assert.ok(global.recentConversations[0].updatedAtMs >= global.recentConversations[19].updatedAtMs);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('main.mjs --standalone serves /api/snapshot, etag caching, and /api/prefs persistence', async () => {
  const { root, appData } = makeTempEnv();
  const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(dataDir, { recursive: true });
  const fakeHome = join(root, 'home');
  mkdirSync(fakeHome, { recursive: true });

  const convId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  writeConversation(appData, convId, {
    compactLines: [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: '2026-11-16T08:00:00Z',
        content: '<USER_REQUEST>Test standalone sidecar</USER_REQUEST>',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-16T08:00:01Z',
        input_tokens: 3000,
        cache_read_tokens: 9000,
        output_tokens: 400,
        tool_calls: [],
      },
    ],
    mtimeMs: Date.parse('2026-11-16T08:00:03Z'),
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
  const port = 19837;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:06:00
// Description: Pass real SIDECAR_SDK_PATH to isolated child tests and guard
// child exit waits against already-exited processes to prevent test hangs.
// ============================================================================
  const sdkFallback = join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs');
  const env = { ...process.env };
  delete env.ANTIGRAVITY_LS_ADDRESS;
  delete env.ANTIGRAVITY_CSRF_TOKEN;
  delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
  delete env.ANTIGRAVITY_CONVERSATION_ID;
  delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
  if (existsSync(sdkFallback)) {
    env.SIDECAR_SDK_PATH = sdkFallback;
  }
  env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
  env.USERPROFILE = fakeHome;
  env.HOME = fakeHome;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Disable background live pricing sync in deterministic child test.
// ============================================================================
  env.PRICING_SYNC_DISABLE_AUTO = '1';
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================

  const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });
// ============================================================================
// [MODIFIED END] 2026-11-17 11:06:00
// ============================================================================

    const base = `http://127.0.0.1:${port}`;
    const snapRes = await fetch(`${base}/api/snapshot`);
    assert.equal(snapRes.status, 200);
    const snap = await snapRes.json();
    assert.equal(snap.unchanged, false);
    assert.equal(snap.current.conversationId, convId);
    assert.equal(snap.current.context.currentTotal, 12000);
    assert.equal(snap.current.speed.latestStepTokPerSec, 200);

    // Etag unchanged short-circuit
    const snap2Res = await fetch(
      `${base}/api/snapshot?conv=${encodeURIComponent(convId)}&etag=${encodeURIComponent(snap.etag)}`,
    );
    const snap2 = await snap2Res.json();
    assert.equal(snap2.unchanged, true);

    // Invalid conv rejected cleanly
    const badConvRes = await fetch(`${base}/api/snapshot?conv=${encodeURIComponent('../bad')}`);
    assert.equal(badConvRes.status, 400);

    // Invalid prefs rejected cleanly
    const badPrefRes = await fetch(`${base}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ softContextLimit: -10 }),
    });
    assert.equal(badPrefRes.status, 400);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Verify default v0.2.2 prefs, invalid tokenUnit/language 400
// rejection, and persistence of tokenUnit/language + prefsSchemaVersion = 2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert initial 409600/512000 limits and prefsSchemaVersion === 4.
// ============================================================================
    assert.equal(snap.prefs.softContextLimit, 409600);
    assert.equal(snap.prefs.hardContextLimit, 512000);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
    assert.equal(snap.prefs.tokenUnit, 'auto');
    assert.equal(snap.prefs.language, 'zh');

    const badUnitRes = await fetch(`${base}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenUnit: 'gigatokens' }),
    });
    assert.equal(badUnitRes.status, 400);

    const badLangRes = await fetch(`${base}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'fr' }),
    });
    assert.equal(badLangRes.status, 400);

    // Valid prefs update & persistence (per-model override + subscription + CNY + tokenUnit + language)
    const prefRes = await fetch(`${base}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        softContextLimit: 10000,
        hardContextLimit: 512000,
        currency: 'CNY',
        cnyRate: 7.25,
        tokenUnit: 'wan_yi',
        language: 'en',
        subscriptionPlan: 'pro',
        modelOverrides: {
          auto: { inputPer1M: 0.5, cachedPer1M: 0.1, outputPer1M: 2.5, longContextTier: false },
        },
      }),
    });
    assert.equal(prefRes.status, 200);
    const prefBody = await prefRes.json();
    assert.equal(prefBody.ok, true);
    assert.equal(prefBody.prefs.currency, 'CNY');
    assert.equal(prefBody.prefs.tokenUnit, 'wan_yi');
    assert.equal(prefBody.prefs.language, 'en');
    assert.equal(prefBody.prefs.subscriptionPlan, 'pro');
    assert.equal(prefBody.prefs.softContextLimit, 10000);
    assert.equal(prefBody.prefs.modelOverrides.auto.inputPer1M, 0.5);

    const stateFile = join(dataDir, 'monitor_state.json');
    assert.equal(existsSync(stateFile), true);
    const saved = JSON.parse(readFileSync(stateFile, 'utf-8'));
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:26:00
// Description: Assert bumped prefsSchemaVersion === 3 in standalone prefs test.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert bumped prefsSchemaVersion === 4 in standalone prefs test.
// ============================================================================
    assert.equal(saved.prefsSchemaVersion, 4);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:26:00
// ============================================================================
    assert.equal(saved.prefs.currency, 'CNY');
    assert.equal(saved.prefs.tokenUnit, 'wan_yi');
    assert.equal(saved.prefs.language, 'en');
    assert.equal(saved.prefs.subscriptionPlan, 'pro');
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

    // Context threshold reflects updated softContextLimit=10000 -> WARNING (12000 >= 10000)
    const snap3Res = await fetch(`${base}/api/snapshot?conv=${encodeURIComponent(convId)}`);
    const snap3 = await snap3Res.json();
    assert.equal(snap3.current.context.usageLevel, 'WARNING');
    assert.equal(snap3.current.context.watermarkLevel, 'WARNING');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Update expected runtime pricingCatalog length to 9 (with gemini-3.1-pro).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Update expected runtime pricingCatalog length to 10 (with gemini-4-neon).
// ============================================================================
    assert.equal(snap3.pricingCatalog.length, 10);
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
    assert.ok(snap3.global.periods['7d']);
    assert.ok(snap3.global.periods['30d']);
    assert.ok(snap3.global.periods.all);
    assert.equal(existsSync(join(dataDir, 'usage_ledger.json')), true);

    // Deleting transcript preserves archived usage in ledger until /api/resync-ledger
    rmSync(join(appData, 'brain', convId), { recursive: true, force: true });
    const snapAfterDelete = await (await fetch(`${base}/api/snapshot`)).json();
    assert.equal(snapAfterDelete.global.periods['30d'].archivedConversationsCount, 1);
    assert.equal(snapAfterDelete.global.periods['30d'].conversationsCount, 1);

    const resyncRes = await fetch(`${base}/api/resync-ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(resyncRes.status, 200);
    const resyncBody = await resyncRes.json();
    assert.equal(resyncBody.ok, true);
    assert.equal(resyncBody.conversationsCount, 0);
  } finally {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:06:00
// Description: Avoid deadlocking on child exit if the child already terminated.
// ============================================================================
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
    rmSync(root, { recursive: true, force: true });
// ============================================================================
// [MODIFIED END] 2026-11-17 11:06:00
// ============================================================================
  }
});

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Verify all-period daily trend up to 180d and weekly trend >180d.
// ============================================================================
test('multi-period buckets (today 24h, 7d, 30d, all <=180d daily & >180d weekly) and persistent ledger retention', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const nowMs = Date.parse('2026-11-16T08:00:00Z');
    const cToday = 'f1111111-1111-4111-8111-111111111111';
    const c5d = 'f2222222-2222-4222-8222-222222222222';
    const c20d = 'f3333333-3333-4333-8333-333333333333';
    const c75d = 'f4444444-4444-4444-8444-444444444444';
    const c200d = 'f5555555-5555-4555-8555-555555555555';

    const mkConv = (id, daysAgo, modelLabel, outTok) => {
      const ts = new Date(nowMs - daysAgo * 86400 * 1000).toISOString();
      writeConversation(appData, id, {
        compactLines: [
          {
            step_index: 0,
            type: 'USER_INPUT',
            status: 'DONE',
            created_at: ts,
            content: `<USER_SETTINGS_CHANGE>Model Selection from None to ${modelLabel}</USER_SETTINGS_CHANGE>`,
          },
          {
            step_index: 1,
            type: 'PLANNER_RESPONSE',
            status: 'DONE',
            created_at: ts,
            input_tokens: 100000,
            cache_read_tokens: 0,
            output_tokens: outTok,
            tool_calls: [],
          },
        ],
        mtimeMs: Date.parse(ts),
      });
    };

    mkConv(cToday, 0, 'Claude Opus 5.5 (High)', 10000);
    mkConv(c5d, 5, 'Gemini 4 Hydrogen (High)', 5000);
    mkConv(c20d, 20, 'Gemini 3.8 Flash (High)', 4000);
    mkConv(c75d, 75, 'Gemini 4 Carbon (High)', 2000);

    const ledger = createUsageLedger();
    const g1 = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, ledger, disableAgentApi: true });

    assert.equal(g1.periods.today.trendGranularity, 'hour');
    assert.equal(g1.periods.today.series.length, 24);
    assert.equal(g1.periods.today.conversationsCount, 1);

    assert.equal(g1.periods['7d'].trendGranularity, 'day');
    assert.equal(g1.periods['7d'].series.length, 7);
    assert.equal(g1.periods['7d'].conversationsCount, 2);

    assert.equal(g1.periods['30d'].trendGranularity, 'day');
    assert.equal(g1.periods['30d'].series.length, 30);
    assert.equal(g1.periods['30d'].conversationsCount, 3);

    // 75 days ago -> 76-day span (<= 180d) outputs daily bars
    assert.equal(g1.periods.all.trendGranularity, 'day');
    assert.equal(g1.periods.all.series.length, 76);
    assert.equal(g1.periods.all.conversationsCount, 4);
    assert.equal(g1.periods.all.topConversations[0].conversationId, cToday);

    // Delete 20-day-old transcript from disk; persistent ledger retains its 30d/all usage
    rmSync(join(appData, 'brain', c20d), { recursive: true, force: true });
    const g2 = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, ledger, disableAgentApi: true });
    assert.equal(g2.periods['30d'].conversationsCount, 3);
    assert.equal(g2.periods['30d'].archivedConversationsCount, 1);
    assert.equal(g2.periods['30d'].outputTokens, 10000 + 5000 + 4000);

    // Explicit resync drops deleted conversation cleanly
    ledger.resyncFromDisk({ appDataDirs: [appData] });
    const g3 = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, ledger, disableAgentApi: true });
    assert.equal(g3.periods['30d'].conversationsCount, 2);
    assert.equal(g3.periods['30d'].archivedConversationsCount, 0);

    // Conversation > 180 days ago switches all-time trend to weekly granularity
    mkConv(c200d, 200, 'Gemini 4 Carbon (High)', 1000);
    const g4 = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, ledger, disableAgentApi: true });
    assert.equal(g4.periods.all.trendGranularity, 'week');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

function encodeVarint(num) {
  let v = BigInt(num);
  const out = [];
  while (v >= 0x80n) {
    out.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  out.push(Number(v));
  return Buffer.from(out);
}

function encodeVarintField(fieldNo, val) {
  return Buffer.concat([encodeVarint((fieldNo << 3) | 0), encodeVarint(val)]);
}

function encodeBytesField(fieldNo, buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf-8');
  return Buffer.concat([encodeVarint((fieldNo << 3) | 2), encodeVarint(b.length), b]);
}

function encodeTimestampMs(ms) {
  const sec = Math.floor(ms / 1000);
  const nanos = (ms % 1000) * 1000000;
  const parts = [encodeVarintField(1, sec)];
  if (nanos > 0) parts.push(encodeVarintField(2, nanos));
  return Buffer.concat(parts);
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:08:00
// Description: Support botId (TokenUsage field 7) and originCascadeId (field 20.4
// & gen_metadata 1.20 cascade_id) in Protobuf test encoders.
// ============================================================================
function encodeTokenUsage({ enumId = null, input = 0, output = 0, cacheRead = 0, botId = '' }) {
  const parts = [];
  if (enumId !== null) parts.push(encodeVarintField(1, enumId));
  if (input > 0) parts.push(encodeVarintField(2, input));
  if (output > 0) parts.push(encodeVarintField(3, output));
  if (cacheRead > 0) parts.push(encodeVarintField(5, cacheRead));
  if (botId) parts.push(encodeBytesField(7, botId));
  return Buffer.concat(parts);
}

function encodeStepField20({ stepIdx = 0, genIdx = 0, originCascadeId = '' }) {
  const parts = [encodeVarintField(2, stepIdx)];
  if (genIdx > 0) parts.push(encodeVarintField(3, genIdx));
  if (originCascadeId) parts.push(encodeBytesField(4, originCascadeId));
  return Buffer.concat(parts);
}

function encodeGenKv(key, value) {
  return Buffer.concat([encodeBytesField(1, key), encodeBytesField(2, value)]);
}
// ============================================================================
// [MODIFIED END] 2026-11-16 22:08:00
// ============================================================================

test('normalizeModelId strips thinking/effort tiers while preserving variant & worker raw IDs', () => {
  // Raw backend slugs: strip effort/thinking suffixes, preserve variant/worker slugs
  assert.equal(normalizeModelId('claude-opus-5-5-high', 'Claude Opus 5.5 (High)'), 'claude-opus-5-5');
  assert.equal(normalizeModelId('claude-opus-4-6-thinking', ''), 'claude-opus-4-6');
  assert.equal(normalizeModelId('gemini-4-carbon-high'), 'gemini-4-carbon');
  assert.equal(normalizeModelId('gemini-4-hydrogen-xhigh'), 'gemini-4-hydrogen');
  assert.equal(normalizeModelId('gemini-4-argon-low'), 'gemini-4-argon');
  assert.equal(normalizeModelId('gpt-oss-120b-medium'), 'gpt-oss-120b');

  // Preserve distinct backend variants & worker slugs
  assert.equal(normalizeModelId('gemini-3.8-flash'), 'gemini-3.8-flash');
  assert.equal(normalizeModelId('gemini-3.8-flash-n'), 'gemini-3.8-flash-n');
  assert.equal(normalizeModelId('gemini-3.8-flash-tiered'), 'gemini-3.8-flash-tiered');
  assert.equal(normalizeModelId('gemini-4-argon-trial'), 'gemini-4-argon-trial');
  assert.equal(normalizeModelId('gemini-4-argon-b', 'Gemini 4 Argon (High)'), 'gemini-4-argon-b');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert display-first normalization for gemini-flash-worker-agy
// (Hydrogen Orchestrator vs historical Gemini Flash vs empty fallback).
// ============================================================================
  assert.equal(normalizeModelId('gemini-flash-worker-agy', 'Gemini 4 Hydrogen (Orchestrator)'), 'gemini-4-hydrogen');
  assert.equal(normalizeModelId('gemini-flash-worker-agy', 'Gemini Flash'), 'gemini-3.8-flash');
  assert.equal(normalizeModelId('gemini-flash-worker-agy', ''), 'gemini-flash-worker-agy');
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
  assert.equal(normalizeModelId('gemini-pro-orchestrator', 'Orchestrator (Carbon)'), 'gemini-pro-orchestrator');
  assert.equal(normalizeModelId('gemini-pro-orchestrator-argon', 'Orchestrator (Argon)'), 'gemini-pro-orchestrator-argon');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Verify gemini-pro-default and Gemini 3.1 Pro normalize to
// gemini-3.1-pro and enum 1016 maps to gemini-3.1-pro.
// ============================================================================
  assert.equal(normalizeModelId('gemini-pro-default'), 'gemini-3.1-pro');
  assert.equal(normalizeModelId('gemini-pro-default-high'), 'gemini-3.1-pro');
  assert.equal(normalizeModelId('Gemini Pro Default'), 'gemini-3.1-pro');
  assert.equal(normalizeModelId('gemini-3.1-pro-high'), 'gemini-3.1-pro');
  assert.equal(normalizeModelId('', 'Gemini 3.1 Pro (High)'), 'gemini-3.1-pro');
  assert.equal(MODEL_ENUM_MAP.get(1016), 'gemini-3.1-pro');
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

  // Display / settings-change labels
  assert.equal(normalizeModelId('', 'Orchestrator (Argon)'), 'gemini-pro-orchestrator-argon');
  assert.equal(normalizeModelId('', 'Orchestrator (Carbon)'), 'gemini-pro-orchestrator');
  assert.equal(normalizeModelId('Gemini 4 Argon (High)'), 'gemini-4-argon');
  assert.equal(normalizeModelId('Gemini 4 Carbon (High)'), 'gemini-4-carbon');
  assert.equal(normalizeModelId('Gemini 4 Hydrogen (XHigh)'), 'gemini-4-hydrogen');
  assert.equal(normalizeModelId('Gemini 3.8 Flash (High)'), 'gemini-3.8-flash');
  assert.equal(normalizeModelId('Gemini Flash'), 'gemini-3.8-flash');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:27:23
// Description: Assert generic 'Pro' normalizes to 'gemini-pro' instead of faking 'gemini-4-carbon'.
// ============================================================================
  assert.equal(normalizeModelId('Pro'), 'gemini-pro');
// ============================================================================
// [MODIFIED END] 2026-11-17 20:27:23
// ============================================================================
  assert.equal(normalizeModelId('Claude Opus 4.6 (Thinking)'), 'claude-opus-4-6');
  assert.equal(normalizeModelId('Claude Opus 5.5 (High)'), 'claude-opus-5-5');
  assert.equal(normalizeModelId('Claude Sonnet 5.5 (Medium)'), 'claude-sonnet-5-5');
  assert.equal(normalizeModelId('GPT-OSS 120B (Medium)'), 'gpt-oss-120b');
  assert.equal(normalizeModelId('Auto'), 'Auto');
  assert.equal(normalizeModelId('', ''), 'Auto');
  assert.equal(normalizeModelId('unknown', 'auto'), 'Auto');

  // Pricing catalog matches normalized raw IDs 100%
  assert.equal(resolveModelProfile('claude-opus-4-6').id, 'claude-opus-5-5');
  assert.equal(resolveModelProfile('claude-opus-5-5').id, 'claude-opus-5-5');
  assert.equal(resolveModelProfile('gemini-pro-orchestrator-argon').id, 'gemini-4-argon');
  assert.equal(resolveModelProfile('gemini-pro-orchestrator').id, 'gemini-4-carbon');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:27:23
// Description: Assert generic 'gemini-pro' still maps to 'gemini-4-carbon' pricing profile via fallbackPattern.
// ============================================================================
  assert.equal(resolveModelProfile('gemini-pro').id, 'gemini-4-carbon');
// ============================================================================
// [MODIFIED END] 2026-11-17 20:27:23
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Verify gemini-3.1-pro and gemini-pro-default resolve to dedicated gemini-3.1-pro tier.
// ============================================================================
  assert.equal(resolveModelProfile('gemini-3.1-pro').id, 'gemini-3.1-pro');
  assert.equal(resolveModelProfile('gemini-pro-default').id, 'gemini-3.1-pro');
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
  assert.equal(resolveModelProfile('gemini-3.8-flash-n').id, 'gemini-3-8-flash');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert bare gemini-flash-worker-agy maps to gemini-4-hydrogen profile.
// ============================================================================
  assert.equal(resolveModelProfile('gemini-flash-worker-agy').id, 'gemini-4-hydrogen');
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
  const opusCatalogEntry = MODEL_PRICING_CATALOG.find((p) => p.id === 'claude-opus-5-5');
  assert.equal(opusCatalogEntry.hint, '含 5.5 / 4.6 · High/Med/Low');
});

test('SQLite conversations/<id>.db + conversation_summaries.db telemetry, compaction accounting, and totalTokens', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });

    const convHybrid = '99991111-1111-4111-8111-111111111111';
    const convDbOnly = '99992222-2222-4222-8222-222222222222';
    const baseMs = Date.parse('2026-11-16T10:00:00Z');

    // Create conversation_summaries.db with fast local titles and workspace URIs
    const sumDb = new DatabaseSync(join(appData, 'conversation_summaries.db'));
    sumDb.exec(`
      CREATE TABLE conversation_summaries (
        conversation_id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT "",
        workspace_uris TEXT NOT NULL DEFAULT "",
        agent_name TEXT NOT NULL DEFAULT "",
        parent_conversation_id TEXT NOT NULL DEFAULT ""
      );
    `);
    const insSum = sumDb.prepare(
      'INSERT INTO conversation_summaries (conversation_id, title, workspace_uris, agent_name, parent_conversation_id) VALUES (?, ?, ?, ?, ?)',
    );
    insSum.run(
      convHybrid,
      'SQLite Hybrid Telemetry Session',
      JSON.stringify(['file:///f%3A/Other%20Items/agy-token-monitor']),
      '',
      '',
    );
    insSum.run(
      convDbOnly,
      '',
      JSON.stringify(['file:///d%3A/FPGAcodes/FiberBoard2026']),
      'WorkerSwarmAgent',
      convHybrid,
    );
    sumDb.close();

    // 1) Hybrid conversation: transcript.jsonl has NO <USER_SETTINGS_CHANGE> (would have been "Auto" in v1.1!),
    // while SQLite conversations/<id>.db has exact gen_metadata + step_type=15 + step_type=23 compaction.
    writeConversation(appData, convHybrid, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs).toISOString(),
          content: '<USER_REQUEST>Run complex refactor</USER_REQUEST>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 1000).toISOString(),
          input_tokens: 100000,
          cache_read_tokens: 50000,
          output_tokens: 2000,
          tool_calls: [],
        },
        {
          step_index: 3,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 10000).toISOString(),
          input_tokens: 15000,
          cache_read_tokens: 10000,
          output_tokens: 500,
          tool_calls: [],
        },
      ],
      mtimeMs: baseMs + 15000,
    });

    const db1 = new DatabaseSync(join(convsDir, `${convHybrid}.db`));
    db1.exec(`
      CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
    `);

    // gen 0 -> step 1 (enum 1427 = gemini-4-carbon, raw 1.19 = gemini-4-carbon-high)
    const gen0Inner = Buffer.concat([
      encodeBytesField(4, encodeTokenUsage({ enumId: 1427, input: 100000, output: 2000, cacheRead: 50000 })),
      encodeBytesField(19, 'gemini-4-carbon-high'),
      encodeBytesField(21, 'Gemini 4 Carbon (High)'),
    ]);
    const gen0Top = Buffer.concat([
      encodeBytesField(1, gen0Inner),
      encodeBytesField(2, encodeVarint(1)),
    ]);
    // gen 1 -> step 3 (enum 1427, post-compaction step)
    const gen1Inner = Buffer.concat([
      encodeBytesField(4, encodeTokenUsage({ enumId: 1427, input: 15000, output: 500, cacheRead: 10000 })),
      encodeBytesField(19, 'gemini-4-carbon'),
      encodeBytesField(21, 'Gemini 4 Carbon (High)'),
    ]);
    const gen1Top = Buffer.concat([
      encodeBytesField(1, gen1Inner),
      encodeBytesField(2, encodeVarint(3)),
    ]);
    const insGen1 = db1.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)');
    insGen1.run(0, gen0Top, gen0Top.length);
    insGen1.run(1, gen1Top, gen1Top.length);

    const insStep1 = db1.prepare('INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)');
    // step 0: USER_INPUT
    insStep1.run(0, 14, 3, encodeBytesField(1, encodeTimestampMs(baseMs)));
    // step 1: PLANNER_RESPONSE (gen_idx 0 omitted in proto3 field 20!)
    insStep1.run(
      1,
      15,
      3,
      Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(baseMs + 1000)),
        encodeBytesField(6, encodeTimestampMs(baseMs + 1500)),
        encodeBytesField(7, encodeTimestampMs(baseMs + 3500)), // 2.5s -> 2000 / 2.5 = 800 tok/s
        encodeBytesField(9, encodeTokenUsage({ enumId: 1427, input: 100000, output: 2000, cacheRead: 50000 })),
        encodeBytesField(20, encodeVarintField(2, 1)), // gen_idx === 0 omitted by proto3
      ]),
    );
    // step 2: step_type = 23 Context Compaction (<CONTEXT_SUMMARY>) with non-zero field_1 enumId 1427!
    insStep1.run(
      2,
      23,
      3,
      Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(baseMs + 6000)),
        encodeBytesField(7, encodeTimestampMs(baseMs + 9000)),
        encodeBytesField(9, encodeTokenUsage({ enumId: 1427, input: 4000, output: 3000, cacheRead: 146000 })),
      ]),
    );
    // step 3: post-compaction PLANNER_RESPONSE (25,000 total context)
    insStep1.run(
      3,
      15,
      3,
      Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(baseMs + 10000)),
        encodeBytesField(6, encodeTimestampMs(baseMs + 10300)),
        encodeBytesField(7, encodeTimestampMs(baseMs + 11000)), // 1.0s -> 500 tok/s
        encodeBytesField(9, encodeTokenUsage({ enumId: 1427, input: 15000, output: 500, cacheRead: 10000 })),
        encodeBytesField(20, Buffer.concat([encodeVarintField(2, 3), encodeVarintField(3, 1)])),
      ]),
    );
    db1.close();

    // 2) DB-only conversation (no transcript.jsonl on disk!) using enum 1669 (gemini-flash-worker-agy)
    const db2 = new DatabaseSync(join(convsDir, `${convDbOnly}.db`));
    db2.exec(`
      CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
    `);
    const genDbOnlyInner = Buffer.concat([
      encodeBytesField(4, encodeTokenUsage({ enumId: 1669, input: 8000, output: 400, cacheRead: 2000 })),
      encodeBytesField(19, 'gemini-flash-worker-agy'),
      encodeBytesField(21, 'Gemini Flash'),
    ]);
    const genDbOnlyTop = Buffer.concat([
      encodeBytesField(1, genDbOnlyInner),
      encodeBytesField(2, encodeVarint(1)),
    ]);
    db2.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)').run(0, genDbOnlyTop, genDbOnlyTop.length);
    const insStep2 = db2.prepare('INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)');
    insStep2.run(0, 14, 3, encodeBytesField(1, encodeTimestampMs(baseMs + 2000)));
    insStep2.run(
      1,
      15,
      3,
      Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(baseMs + 2500)),
        encodeBytesField(7, encodeTimestampMs(baseMs + 4500)),
        encodeBytesField(9, encodeTokenUsage({ enumId: 1669, input: 8000, output: 400, cacheRead: 2000 })),
        encodeBytesField(20, encodeVarintField(2, 1)),
      ]),
    );
    db2.close();

    const metadataStore = createMetadataStore({ appDataDirs: [appData], disableAgentApi: true });

    // Verify hybrid conversation analysis
    const rHybrid = analyzeConversation(convHybrid, {
      appDataDirs: [appData],
      metadataStore,
      disableAgentApi: true,
    });
    assert.equal(rHybrid.activeModel, 'gemini-4-carbon');
    assert.equal(rHybrid.title, 'SQLite Hybrid Telemetry Session');
    assert.equal(rHybrid.workspace, 'agy-token-monitor');
    // Post-compaction context MUST reflect step 3 (15000 + 10000 = 25000), NOT step 2 compaction!
    assert.equal(rHybrid.context.currentTotal, 25000);
    // Speed uses SQLite completedAtMs on step 3 (500 tok / 1.0s = 500 tok/s)
    assert.equal(rHybrid.speed.latestStepTokPerSec, 500);

    // Totals MUST include step 1 + step 2 (compaction) + step 3, and NEVER add enumId 1427!
    // Input = 100000 + 4000 + 15000 = 119000; Cache = 50000 + 146000 + 10000 = 206000; Out = 2000 + 3000 + 500 = 5500
    assert.equal(rHybrid.totals.mainOnly.stepsCount, 3);
    assert.equal(rHybrid.totals.mainOnly.inputUncachedTokens, 119000);
    assert.equal(rHybrid.totals.mainOnly.cacheReadTokens, 206000);
    assert.equal(rHybrid.totals.mainOnly.outputTokens, 5500);
    assert.equal(rHybrid.totals.byModel.length, 1);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert Scheme A canonical byModel labels, rawModels arrays, and
// historical 11/13-14 Gemini Flash preservation when displayModel is Gemini Flash.
// ============================================================================
    assert.equal(rHybrid.totals.byModel[0].model, 'Gemini 4 Carbon');
    assert.equal(rHybrid.totals.byModel[0].profileId, 'gemini-4-carbon');
    assert.deepEqual(rHybrid.totals.byModel[0].rawModels, ['gemini-4-carbon', 'gemini-4-carbon-high']);
    assert.equal(rHybrid.totals.byModel[0].totalTokens, 119000 + 206000 + 5500);

    // Verify DB-only conversation works in Tab 1 without transcript.jsonl
    const rDbOnly = analyzeConversation(convDbOnly, {
      appDataDirs: [appData],
      metadataStore,
      disableAgentApi: true,
    });
    assert.ok(rDbOnly);
    assert.equal(rDbOnly.activeModel, 'gemini-3.8-flash');
    assert.equal(rDbOnly.activeRawModel, 'gemini-flash-worker-agy');
    assert.equal(rDbOnly.activeModelLabel, 'Gemini 3.8 Flash');
    assert.equal(rDbOnly.title, 'WorkerSwarmAgent');
    assert.equal(rDbOnly.workspace, 'FiberBoard2026');
    // Verify enumId 1669 is NOT added to tokens: 8000 + 2000 + 400 = 10400
    assert.equal(rDbOnly.totals.byModel[0].model, 'Gemini 3.8 Flash');
    assert.deepEqual(rDbOnly.totals.byModel[0].rawModels, ['gemini-flash-worker-agy']);
    assert.equal(rDbOnly.totals.byModel[0].totalTokens, 10400);

    // Verify Tab 2 ledger discovers union of DB-only + hybrid, eliminates Auto, and computes totalTokens
    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: baseMs + 20000,
      metadataStore,
      disableAgentApi: true,
    });
    assert.equal(global.periods.today.conversationsCount, 2);
    const modelsToday = global.periods.today.byModel.map((m) => m.model);
    assert.equal(modelsToday.includes('Auto'), false);
    assert.deepEqual(modelsToday.sort(), ['Gemini 3.8 Flash', 'Gemini 4 Carbon']);
    const flashToday = global.periods.today.byModel.find((m) => m.profileId === 'gemini-3-8-flash');
    assert.deepEqual(flashToday?.rawModels, ['gemini-flash-worker-agy']);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
    for (const row of global.periods.today.byModel) {
      assert.equal(row.totalTokens, row.inputTokens + row.cacheReadTokens + row.outputTokens);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ============================================================================
// [MODIFIED BEGIN] 2026-11-16 22:08:00
// Description: Add v1.2.1 unit tests for ledger v1/v2 -> v3 auto-migration,
// forked-conversation duplicate token elimination (parentId.db + forkChildId.db),
// and single-instance preservation of orphan parent steps cloned into sibling forks.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:15:00
// Description: Update ledger auto-migration test for LEDGER_SCHEMA_VERSION = 4
// (verifying v1/v2/v3 -> v4 rebuilds replace gemini-pro-default with gemini-3.1-pro)
// and add v0.2.2 tests for computeSpeed SQLite priority + activeModel scoping and
// PREFS_SCHEMA_VERSION = 2 migration (preserving custom limits).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update ledger auto-migration test to LEDGER_SCHEMA_VERSION === 5
// and Scheme A canonical byModel labels + rawModels.
// ============================================================================
test('createUsageLedger auto-migrates stale v1/v2/v3/v4 ledgers to v5 and normalizes enum 1016 to gemini-3.1-pro', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convId = '99993333-3333-4333-8333-333333333333';
    const convEnum1016 = '99993334-3334-4334-8334-333333333334';
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });
    const nowMs = Date.parse('2026-11-16T11:00:00Z');
    const todayKey = formatLocalDate(nowMs);

    writeConversation(appData, convId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(nowMs).toISOString(),
          content:
            '<USER_SETTINGS_CHANGE>Model Selection from None to Claude Opus 5.5 (High)</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(nowMs + 1000).toISOString(),
          input_tokens: 10000,
          cache_read_tokens: 5000,
          output_tokens: 1000,
          tool_calls: [],
        },
      ],
      mtimeMs: nowMs + 2000,
    });

    // DB conversation using legacy enum 1016 / gemini-pro-default
    const db1016 = new DatabaseSync(join(convsDir, `${convEnum1016}.db`));
    db1016.exec(`
      CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
    `);
    const usage1016 = encodeTokenUsage({
      enumId: 1016,
      input: 4000,
      cacheRead: 2000,
      output: 500,
      botId: 'bot-1016',
    });
    const genTop1016 = Buffer.concat([
      encodeBytesField(
        1,
        Buffer.concat([
          encodeBytesField(4, usage1016),
          encodeBytesField(19, 'gemini-pro-default'),
          encodeBytesField(21, 'Gemini 3.1 Pro (High)'),
        ]),
      ),
      encodeBytesField(2, encodeVarint(1)),
    ]);
    db1016.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)').run(0, genTop1016, genTop1016.length);
    db1016
      .prepare('INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)')
      .run(
        1,
        15,
        3,
        Buffer.concat([
          encodeBytesField(1, encodeTimestampMs(nowMs + 3000)),
          encodeBytesField(7, encodeTimestampMs(nowMs + 5000)),
          encodeBytesField(9, usage1016),
          encodeBytesField(20, encodeVarintField(2, 1)),
        ]),
      );
    db1016.close();

    assert.equal(LEDGER_SCHEMA_VERSION, 5);

    // 1) Stale v1 ledger auto-migrates to v5
    const staleV1Data = {
      version: 1,
      threshold: 200000,
      conversations: {
        'deadbeef-0000-4000-8000-000000000000': {
          cacheKey: 'stale',
          updatedAtMs: nowMs,
          onDisk: false,
          activeModel: 'Auto',
          days: {
            [todayKey]: {
              byModel: {
                Auto: { steps: 9, stdIn: 999999, stdCache: 0, stdOut: 99999, longIn: 0, longCache: 0, longOut: 0 },
              },
              hours: {},
            },
          },
        },
      },
    };
    const migratedFromV1 = createUsageLedger(staleV1Data);
    assert.equal(migratedFromV1.getData().version, 5);
    assert.equal(migratedFromV1.isDirty(), true);
    assert.deepEqual(migratedFromV1.getData().conversations, {});

    // 2) Stale v3 ledger carrying gemini-pro-default auto-migrates to v5 -> Gemini 3.1 Pro
    const staleV3Data = {
      version: 3,
      threshold: 200000,
      conversations: {
        [convEnum1016]: {
          cacheKey: 'stale-v3-pro-default',
          updatedAtMs: nowMs,
          onDisk: true,
          activeModel: 'gemini-pro-default',
          days: {
            [todayKey]: {
              byModel: {
                'gemini-pro-default': {
                  steps: 1,
                  stdIn: 4000,
                  stdCache: 2000,
                  stdOut: 500,
                  longIn: 0,
                  longCache: 0,
                  longOut: 0,
                },
              },
              hours: {},
            },
          },
        },
      },
    };

    const migratedLedger = createUsageLedger(staleV3Data);
    assert.equal(migratedLedger.getData().version, LEDGER_SCHEMA_VERSION);
    assert.equal(migratedLedger.isDirty(), true);
    assert.deepEqual(migratedLedger.getData().conversations, {});

    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: nowMs + 8000,
      ledger: migratedLedger,
      disableAgentApi: true,
    });
    assert.equal(global.periods.all.conversationsCount, 2);
    const modelsAll = global.periods.all.byModel.map((m) => m.model).sort();
    assert.deepEqual(modelsAll, ['Claude Opus 5.5', 'Gemini 3.1 Pro']);
    assert.equal(modelsAll.includes('gemini-pro-default'), false);
    const proRow = global.periods.all.byModel.find((m) => m.profileId === 'gemini-3.1-pro');
    assert.ok(proRow);
    assert.deepEqual(proRow.rawModels, ['gemini-pro-default']);
    assert.equal(proRow.totalTokens, 6500);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================

test('computeSpeed prioritizes SQLite completedAtMs over timingStore and scopes stats to activeModel', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });
    const convId = '9999aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const baseMs = Date.parse('2026-11-17T01:00:00Z');

    const db = new DatabaseSync(join(convsDir, `${convId}.db`));
    db.exec(`
      CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
    `);
    const insGen = db.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)');
    const insStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)');

    const stepsSpec = [
      // Earlier Flash worker step: 200 tok / 1.0s = 200 tok/s
      {
        genIdx: 0,
        stepIdx: 1,
        enumId: 1669,
        rawModel: 'gemini-flash-worker-agy',
        displayModel: 'Gemini Flash',
        botId: 'bot-flash-1',
        input: 5000,
        cacheRead: 5000,
        output: 200,
        createdMs: baseMs,
        firstTokenMs: baseMs + 200,
        completedMs: baseMs + 1000,
      },
      // Carbon step 3: 500 tok / 10.0s = 50 tok/s (poisoned timingStore has firstTokenAtMs 0.4s -> 1250 tok/s!)
      {
        genIdx: 1,
        stepIdx: 3,
        enumId: 1427,
        rawModel: 'gemini-4-carbon-high',
        displayModel: 'Gemini 4 Carbon (High)',
        botId: 'bot-carbon-1',
        input: 10000,
        cacheRead: 20000,
        output: 500,
        createdMs: baseMs + 5000,
        firstTokenMs: baseMs + 5400,
        completedMs: baseMs + 15000,
      },
      // Carbon step 5: 600 tok / 10.0s = 60 tok/s (poisoned timingStore has firstTokenAtMs 0.5s -> 1200 tok/s!)
      {
        genIdx: 2,
        stepIdx: 5,
        enumId: 1427,
        rawModel: 'gemini-4-carbon-high',
        displayModel: 'Gemini 4 Carbon (High)',
        botId: 'bot-carbon-2',
        input: 12000,
        cacheRead: 24000,
        output: 600,
        createdMs: baseMs + 20000,
        firstTokenMs: baseMs + 20500,
        completedMs: baseMs + 30000,
      },
    ];

    for (const s of stepsSpec) {
      const usageBuf = encodeTokenUsage({
        enumId: s.enumId,
        input: s.input,
        cacheRead: s.cacheRead,
        output: s.output,
        botId: s.botId,
      });
      const genInner = Buffer.concat([
        encodeBytesField(4, usageBuf),
        encodeBytesField(19, s.rawModel),
        encodeBytesField(21, s.displayModel),
      ]);
      const genTop = Buffer.concat([
        encodeBytesField(1, genInner),
        encodeBytesField(2, encodeVarint(s.genIdx === 0 ? 1 : s.stepIdx)),
      ]);
      insGen.run(s.genIdx, genTop, genTop.length);

      const metaBuf = Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(s.createdMs)),
        encodeBytesField(6, encodeTimestampMs(s.firstTokenMs)),
        encodeBytesField(7, encodeTimestampMs(s.completedMs)),
        encodeBytesField(9, usageBuf),
        encodeBytesField(
          20,
          encodeStepField20({ stepIdx: s.stepIdx, genIdx: s.genIdx, originCascadeId: convId }),
        ),
      ]);
      insStep.run(s.stepIdx, 15, 3, metaBuf);
    }

    // Add a still-streaming DB step 7 (completedMs omitted) to verify statMtimeMs is NOT used for DB telemetry
    const streamingUsage = encodeTokenUsage({
      enumId: 1427,
      input: 15000,
      cacheRead: 24000,
      output: 468,
      botId: 'bot-carbon-streaming',
    });
    const gen3Top = Buffer.concat([
      encodeBytesField(
        1,
        Buffer.concat([
          encodeBytesField(4, streamingUsage),
          encodeBytesField(19, 'gemini-4-carbon-high'),
          encodeBytesField(21, 'Gemini 4 Carbon (High)'),
        ]),
      ),
      encodeBytesField(2, encodeVarint(7)),
    ]);
    insGen.run(3, gen3Top, gen3Top.length);
    insStep.run(
      7,
      15,
      6,
      Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(baseMs + 35000)),
        encodeBytesField(6, encodeTimestampMs(baseMs + 35500)),
        encodeBytesField(9, streamingUsage),
        encodeBytesField(20, encodeStepField20({ stepIdx: 7, genIdx: 3, originCascadeId: convId })),
      ]),
    );
    db.close();

    // Set DB mtime to 1s after step 7 createdAtMs so old statMtimeMs fallback would have caused 468 tok/s
    const dbFile = join(convsDir, `${convId}.db`);
    const bogusSec = (baseMs + 36000) / 1000;
    utimesSync(dbFile, bogusSec, bogusSec);

    const poisonedTimingMap = new Map([
      [`${convId}:3`, baseMs + 5400],
      [`${convId}:5`, baseMs + 20500],
    ]);
    const timingStore = { getEndMs: (c, s) => poisonedTimingMap.get(`${c}:${s}`) };

    const res = analyzeConversation(convId, {
      appDataDirs: [appData],
      timingStore,
      disableAgentApi: true,
    });
    assert.equal(res.activeModel, 'gemini-4-carbon');
    // Step 5 (600 / 10s = 60 tok/s) beats poisoned timingStore; step 7 streaming is excluded;
    // Flash step 1 (200 tok/s) is excluded from gemini-4-carbon scoped metrics!
    assert.equal(res.speed.latestStepTokPerSec, 60);
    assert.equal(res.speed.peakTokPerSec, 60);
    assert.equal(res.speed.measuredStepsCount, 2);
    assert.ok(Math.abs(res.speed.weightedAvgTokPerSec - (500 + 600) / 20) < 1e-6);
    assert.equal(res.speed.recentSteps.length, 2);
    assert.ok(res.speed.recentSteps.every((s) => s.model === 'gemini-4-carbon'));

    // Switching to a model with 0 measured steps yet gracefully falls back to all measured steps
    const paths = resolveConversationPaths(convId, [appData]);
    const parsed = parseTranscript(convId, paths);
    const switchedSpeed = computeSpeed(parsed, convId, new Map(), timingStore, 'claude-opus-5-5');
    assert.equal(switchedSpeed.measuredStepsCount, 3);
    assert.equal(switchedSpeed.peakTokPerSec, 200);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 10:26:00
// Description: Verify PREFS_SCHEMA_VERSION = 3 migration for v1 250k/1M,
// v2 250k/500k, and preservation of custom limits (180k/360k & 250k/800k).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update PREFS_SCHEMA_VERSION = 4 migration tests (v1/v2 250k/(1M|500k)
// and v3 400k/500k -> 409600/512000 while preserving custom limits 180k/360k, 250k/800k, 400k/600k).
// ============================================================================
test('main.mjs PREFS_SCHEMA_VERSION = 4 auto-migrates 250k/400k + (1M|500k) to 409600/512000 while preserving custom limits', async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');

  async function runWithInitialState(initialState, port) {
    const { root, appData } = makeTempEnv();
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });
    const fakeHome = join(root, 'home');
    mkdirSync(fakeHome, { recursive: true });
    const stateFile = join(dataDir, 'monitor_state.json');
    writeFileSync(stateFile, JSON.stringify(initialState, null, 2), 'utf-8');

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:06:00
// Description: Pass real SIDECAR_SDK_PATH and guard child exit waits against
// already-exited processes in PREFS_SCHEMA_VERSION migration tests.
// ============================================================================
    const sdkFallback = join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs');
    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    if (existsSync(sdkFallback)) {
      env.SIDECAR_SDK_PATH = sdkFallback;
    }
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Disable background live pricing sync in deterministic schema migration child test.
// ============================================================================
    env.PRICING_SYNC_DISABLE_AUTO = '1';
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================

    const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await new Promise((resolveReady, rejectReady) => {
        if (child.exitCode !== null) {
          rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
          return;
        }
        const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
          if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
            clearTimeout(timer);
            resolveReady();
          }
        });
        child.stderr.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
        });
      });

      const snap = await (await fetch(`http://127.0.0.1:${port}/api/snapshot`)).json();
      const persisted = JSON.parse(readFileSync(stateFile, 'utf-8'));
      return { snap, persisted };
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise((r) => {
          if (child.exitCode !== null || child.signalCode !== null) return r();
          const t = setTimeout(r, 3000);
          child.once('exit', () => {
            clearTimeout(t);
            r();
          });
        });
      }
      rmSync(root, { recursive: true, force: true });
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:06:00
// ============================================================================
  }

  // Case 1: Legacy v1 untouched 250k/1M migrates to 409600/512000 and persists prefsSchemaVersion = 4
  const resUntouched = await runWithInitialState(
    {
      stepEndTimes: { 'abc:1': 1700000000000 },
      prefs: {
        softContextLimit: 250000,
        hardContextLimit: 1000000,
        currency: 'CNY',
        cnyRate: 7.3,
      },
    },
    19838,
  );
  assert.equal(resUntouched.snap.prefs.softContextLimit, 409600);
  assert.equal(resUntouched.snap.prefs.hardContextLimit, 512000);
  assert.equal(resUntouched.snap.prefs.currency, 'CNY');
  assert.equal(resUntouched.snap.prefs.tokenUnit, 'auto');
  assert.equal(resUntouched.snap.prefs.language, 'zh');
  assert.equal(resUntouched.persisted.prefsSchemaVersion, 4);
  assert.equal(resUntouched.persisted.prefs.softContextLimit, 409600);
  assert.equal(resUntouched.persisted.prefs.hardContextLimit, 512000);
  assert.equal(resUntouched.persisted.stepEndTimes['abc:1'], 1700000000000);

  // Case 2: v2 state with default softContextLimit=250k and hardContextLimit=500k migrates to 409600/512000
  const resV2Half = await runWithInitialState(
    {
      prefsSchemaVersion: 2,
      stepEndTimes: {},
      prefs: {
        softContextLimit: 250000,
        hardContextLimit: 500000,
        tokenUnit: 'auto',
        language: 'zh',
      },
    },
    19839,
  );
  assert.equal(resV2Half.snap.prefs.softContextLimit, 409600);
  assert.equal(resV2Half.snap.prefs.hardContextLimit, 512000);
  assert.equal(resV2Half.persisted.prefsSchemaVersion, 4);
  assert.equal(resV2Half.persisted.prefs.softContextLimit, 409600);
  assert.equal(resV2Half.persisted.prefs.hardContextLimit, 512000);

  // Case 2b: v3 state with untouched 400k/500k migrates to 409600/512000
  const resV3Default = await runWithInitialState(
    {
      prefsSchemaVersion: 3,
      stepEndTimes: {},
      prefs: {
        softContextLimit: 400000,
        hardContextLimit: 500000,
        tokenUnit: 'auto',
        language: 'zh',
      },
    },
    19842,
  );
  assert.equal(resV3Default.snap.prefs.softContextLimit, 409600);
  assert.equal(resV3Default.snap.prefs.hardContextLimit, 512000);
  assert.equal(resV3Default.persisted.prefsSchemaVersion, 4);
  assert.equal(resV3Default.persisted.prefs.softContextLimit, 409600);
  assert.equal(resV3Default.persisted.prefs.hardContextLimit, 512000);

  // Case 3: User-customized limits (180k/360k, 250k/800k, and 400k/600k) are preserved while bumping prefsSchemaVersion = 4
  const resCustom = await runWithInitialState(
    {
      prefsSchemaVersion: 2,
      stepEndTimes: {},
      prefs: {
        softContextLimit: 180000,
        hardContextLimit: 360000,
        language: 'en',
        tokenUnit: 'm',
      },
    },
    19840,
  );
  assert.equal(resCustom.snap.prefs.softContextLimit, 180000);
  assert.equal(resCustom.snap.prefs.hardContextLimit, 360000);
  assert.equal(resCustom.snap.prefs.language, 'en');
  assert.equal(resCustom.snap.prefs.tokenUnit, 'm');
  assert.equal(resCustom.persisted.prefsSchemaVersion, 4);
  assert.equal(resCustom.persisted.prefs.softContextLimit, 180000);
  assert.equal(resCustom.persisted.prefs.hardContextLimit, 360000);

  const resCustomHard = await runWithInitialState(
    {
      prefsSchemaVersion: 2,
      stepEndTimes: {},
      prefs: {
        softContextLimit: 250000,
        hardContextLimit: 800000,
      },
    },
    19841,
  );
  assert.equal(resCustomHard.snap.prefs.softContextLimit, 250000);
  assert.equal(resCustomHard.snap.prefs.hardContextLimit, 800000);
  assert.equal(resCustomHard.persisted.prefsSchemaVersion, 4);

  const resV3CustomHard = await runWithInitialState(
    {
      prefsSchemaVersion: 3,
      stepEndTimes: {},
      prefs: {
        softContextLimit: 400000,
        hardContextLimit: 600000,
      },
    },
    19843,
  );
  assert.equal(resV3CustomHard.snap.prefs.softContextLimit, 400000);
  assert.equal(resV3CustomHard.snap.prefs.hardContextLimit, 600000);
  assert.equal(resV3CustomHard.persisted.prefsSchemaVersion, 4);
});
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:26:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 10:15:00
// ============================================================================

test('forked conversations deduplicate cloned parent steps in Tab 1 & Tab 2 while preserving orphan parents once', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });

    const parentId = '99994444-4444-4444-8444-444444444444';
    const forkChildId = '99995555-5555-4555-8555-555555555555';
    const baseMs = Date.parse('2026-11-16T12:00:00Z');

    function writePlannerDb(dbPath, stepSpecs) {
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
      `);
      const insGen = db.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)');
      const insStep = db.prepare(
        'INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)',
      );

      stepSpecs.forEach((spec, genIdx) => {
        const usageBuf = encodeTokenUsage({
          enumId: spec.enumId ?? 1419,
          input: spec.input,
          cacheRead: spec.cacheRead,
          output: spec.output,
          botId: spec.botId,
        });
        const genInner = Buffer.concat([
          encodeBytesField(4, usageBuf),
          encodeBytesField(19, spec.rawModel || 'gemini-4-argon-high'),
          encodeBytesField(20, encodeGenKv('cascade_id', spec.originCascadeId)),
          encodeBytesField(21, spec.displayModel || 'Gemini 4 Argon (High)'),
        ]);
        const genTop = Buffer.concat([
          encodeBytesField(1, genInner),
          encodeBytesField(2, encodeVarint(spec.stepIdx)),
        ]);
        insGen.run(genIdx, genTop, genTop.length);

        const metaBuf = Buffer.concat([
          encodeBytesField(1, encodeTimestampMs(spec.createdMs)),
          encodeBytesField(7, encodeTimestampMs(spec.createdMs + (spec.durationMs || 2000))),
          encodeBytesField(9, usageBuf),
          encodeBytesField(
            20,
            encodeStepField20({
              stepIdx: spec.stepIdx,
              genIdx,
              originCascadeId: spec.originCascadeId,
            }),
          ),
        ]);
        insStep.run(spec.stepIdx, 15, 3, metaBuf);
      });
      db.close();
    }

    // 1) parentId.db: 2 steps (bot-1 = 25,000 tokens; bot-2 = 25,000 tokens -> 50,000 total on gemini-4-argon)
    const parentSteps = [
      {
        stepIdx: 1,
        originCascadeId: parentId,
        botId: 'bot-1',
        input: 15000,
        cacheRead: 5000,
        output: 5000,
        createdMs: baseMs + 1000,
        durationMs: 2000, // 2500 tok/s
      },
      {
        stepIdx: 3,
        originCascadeId: parentId,
        botId: 'bot-2',
        input: 10000,
        cacheRead: 10000,
        output: 5000,
        createdMs: baseMs + 5000,
        durationMs: 2000, // 2500 tok/s
      },
    ];
    writePlannerDb(join(convsDir, `${parentId}.db`), parentSteps);

    // 2) forkChildId.db: clones bot-1 & bot-2 (cascade_id = parentId) + 1 own step bot-3 (10,000 tokens)
    writePlannerDb(join(convsDir, `${forkChildId}.db`), [
      ...parentSteps,
      {
        stepIdx: 5,
        originCascadeId: forkChildId,
        botId: 'bot-3',
        input: 2000,
        cacheRead: 6000,
        output: 2000,
        createdMs: baseMs + 10000,
        durationMs: 4000, // 500 tok/s
      },
    ]);

    // Also link forkChildId in swarm members.json on parentId to verify withChildren deduplication
    const swarmDir = join(appData, 'brain', parentId, '.system_generated', 'swarm');
    mkdirSync(swarmDir, { recursive: true });
    writeFileSync(
      join(swarmDir, 'members.json'),
      JSON.stringify({
        title: 'Fork Swarm Test',
        members: {
          coordinator: { conversation_id: parentId, role: 'coordinator', model: 'gemini-4-argon' },
          forkedWorker: { conversation_id: forkChildId, role: 'worker', model: 'gemini-4-argon' },
        },
      }),
      'utf-8',
    );

    // Tab 1 check on forkChildId:
    // - context.currentTotal reflects latest step (2000 + 6000 = 8000)
    // - totals.mainOnly counts ONLY bot-3 (10,000 tokens, NOT 60,000!)
    // - speed measures ONLY bot-3 (1 step @ 500 tok/s, NOT parent's 2500 tok/s!)
    const rFork = analyzeConversation(forkChildId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(rFork.activeModel, 'gemini-4-argon');
    assert.equal(rFork.context.currentTotal, 8000);
    assert.equal(rFork.totals.mainOnly.stepsCount, 1);
    assert.equal(rFork.totals.mainOnly.inputUncachedTokens, 2000);
    assert.equal(rFork.totals.mainOnly.cacheReadTokens, 6000);
    assert.equal(rFork.totals.mainOnly.outputTokens, 2000);
    assert.equal(
      rFork.totals.mainOnly.inputUncachedTokens +
        rFork.totals.mainOnly.cacheReadTokens +
        rFork.totals.mainOnly.outputTokens,
      10000,
    );
    assert.equal(rFork.speed.measuredStepsCount, 1);
    assert.equal(rFork.speed.latestStepTokPerSec, 500);

    // Tab 1 withChildren check on parentId: 50,000 + 10,000 = 60,000 (NOT 110,000!)
    const rParent = analyzeConversation(parentId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(rParent.totals.mainOnly.stepsCount, 2);
    assert.equal(rParent.totals.withChildren.stepsCount, 3);
    assert.equal(rParent.totals.byModel.length, 1);
    assert.equal(rParent.totals.byModel[0].totalTokens, 60000);

    // Tab 2 global ledger check: 50,000 + 10,000 = 60,000 total tokens (NOT 110,000!)
    const ledger = createUsageLedger();
    const g1 = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: baseMs + 20000,
      ledger,
      disableAgentApi: true,
    });
    assert.equal(g1.periods.all.totalTokens, 60000);
    assert.equal(g1.periods.all.byModel.length, 1);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert Scheme A canonical label 'Gemini 4 Argon' and rawModels on Tab 2 byModel.
// ============================================================================
    assert.equal(g1.periods.all.byModel[0].model, 'Gemini 4 Argon');
    assert.equal(g1.periods.all.byModel[0].profileId, 'gemini-4-argon');
    assert.deepEqual(g1.periods.all.byModel[0].rawModels, ['gemini-4-argon-high']);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
    assert.equal(g1.periods.all.byModel[0].totalTokens, 60000);

    // Verify unchanged incremental sync stays clean (dirty === false)
    ledger.markSaved();
    ledger.sync({ appDataDirs: [appData] });
    assert.equal(ledger.isDirty(), false);

    // 3) Orphan parent deletedParentId cloned into TWO sibling forks (forkA.db & forkB.db)
    // where deletedParentId.db does NOT exist on disk:
    // bot-orphan (20,000 tokens) MUST be preserved EXACTLY ONCE (not 0 times and not 2 times)!
    const deletedParentId = '99996666-6666-4666-8666-666666666666';
    const forkAId = '99997777-7777-4777-8777-777777777777';
    const forkBId = '99998888-8888-4888-8888-888888888888';

    const orphanStep = {
      stepIdx: 1,
      originCascadeId: deletedParentId,
      botId: 'bot-orphan',
      input: 12000,
      cacheRead: 6000,
      output: 2000, // 20,000 tokens
      createdMs: baseMs + 2000,
      durationMs: 1000,
    };
    writePlannerDb(join(convsDir, `${forkAId}.db`), [
      orphanStep,
      {
        stepIdx: 3,
        originCascadeId: forkAId,
        botId: 'bot-fork-a',
        input: 3000,
        cacheRead: 1000,
        output: 1000, // 5,000 tokens
        createdMs: baseMs + 12000,
        durationMs: 1000,
      },
    ]);
    writePlannerDb(join(convsDir, `${forkBId}.db`), [
      orphanStep,
      {
        stepIdx: 3,
        originCascadeId: forkBId,
        botId: 'bot-fork-b',
        input: 4000,
        cacheRead: 2000,
        output: 1000, // 7,000 tokens
        createdMs: baseMs + 14000,
        durationMs: 1000,
      },
    ]);

    const g2 = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: baseMs + 30000,
      ledger,
      disableAgentApi: true,
    });
    // Expected total: 60,000 (parent + forkChild) + 20,000 (deletedParent once!) + 5,000 (forkA) + 7,000 (forkB) = 92,000
    assert.equal(g2.periods.all.totalTokens, 92000);
    assert.equal(g2.periods.all.byModel[0].totalTokens, 92000);
    assert.equal(g2.periods.all.archivedConversationsCount, 1);

    const recoveredEntry = ledger.getData().conversations[deletedParentId];
    assert.ok(recoveredEntry);
    assert.equal(recoveredEntry.onDisk, false);
    assert.equal(recoveredEntry.cacheKey, 'recovered-parent');
    assert.equal(recoveredEntry.fallbackTitle, `已归档父会话 ${deletedParentId.slice(0, 8)}`);

    // Even after resyncFromDisk, deletedParentId's bot-orphan surviving inside forkA & forkB is preserved once!
    ledger.resyncFromDisk({ appDataDirs: [appData] });
    const g3 = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: baseMs + 35000,
      ledger,
      disableAgentApi: true,
    });
    assert.equal(g3.periods.all.totalTokens, 92000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-16 22:08:00
// ============================================================================

// ============================================================================
// [MODIFIED END] 2026-11-16 21:27:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:51:00
// Description: Add v0.2.3 unit & standalone HTTP E2E tests covering dedicated
// gemini-3.1-pro pricing, session totalTokens, dual-channel official pricing sync
// (effective dates, non-chat filtering, model discovery, observed slug promotion,
// daily dedupe, offline fallback), and /api/sync-pricing + /api/prefs overrides.
// ============================================================================
test('dedicated gemini-3.1-pro pricing, pro detection, and session totalTokens in Tab 1 & Tab 2', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const step200k = { input_tokens: 100000, cache_read_tokens: 50000, output_tokens: 10000 };
    // gemini-3.1-pro <=200k: (100k*2.0 + 50k*0.20 + 10k*12.0)/1M = 0.20 + 0.01 + 0.12 = 0.33
    const proStd = computeStepCost(step200k, DEFAULT_PREFS, 'gemini-3.1-pro');
    assert.equal(proStd.profileId, 'gemini-3.1-pro');
    assert.ok(Math.abs(proStd.costActual - 0.33) < 1e-9);
    const proDefaultStd = computeStepCost(step200k, DEFAULT_PREFS, 'gemini-pro-default');
    assert.equal(proDefaultStd.profileId, 'gemini-3.1-pro');
    assert.ok(Math.abs(proDefaultStd.costActual - 0.33) < 1e-9);

    const stepOver200k = { input_tokens: 100000, cache_read_tokens: 200000, output_tokens: 10000 };
    // gemini-3.1-pro >200k: (100k*4.0 + 200k*0.40 + 10k*18.0)/1M = 0.40 + 0.08 + 0.18 = 0.66
    const proLong = computeStepCost(stepOver200k, DEFAULT_PREFS, 'gemini-3.1-pro');
    assert.equal(proLong.profileId, 'gemini-3.1-pro');
    assert.ok(Math.abs(proLong.costActual - 0.66) < 1e-9);

    assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-3.1-pro'])), 'pro');

    const parentId = 'e1111111-1111-4111-8111-111111111111';
    const childId = 'e2222222-2222-4222-8222-222222222222';
    const baseMs = Date.parse('2026-11-17T08:00:00Z');

    writeConversation(appData, parentId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs).toISOString(),
          content:
            '<USER_REQUEST>Analyze Gemini 3.1 Pro totals</USER_REQUEST>\n<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from Auto to Gemini 3.1 Pro (High).</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 1000).toISOString(),
          input_tokens: 100000,
          cache_read_tokens: 50000,
          output_tokens: 10000,
          tool_calls: [{ name: 'invoke_subagent', args: { Subagents: JSON.stringify([{ Model: 'Gemini 3.8 Flash', Name: 'Worker' }]) } }],
        },
        {
          step_index: 2,
          type: 'GENERIC',
          status: 'DONE',
          created_at: new Date(baseMs + 2000).toISOString(),
          content: `Created At: ${new Date(baseMs + 2000).toISOString()}\nCompleted At: ${new Date(baseMs + 4000).toISOString()}\n{"conversationId":"${childId}"}`,
        },
      ],
      mtimeMs: baseMs + 5000,
    });

    writeConversation(appData, childId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 2500).toISOString(),
          content:
            'Child task\n<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from Auto to Gemini 3.8 Flash (High).</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 3000).toISOString(),
          input_tokens: 20000,
          cache_read_tokens: 10000,
          output_tokens: 5000,
          tool_calls: [],
        },
      ],
      mtimeMs: baseMs + 4000,
    });

    const analysis = analyzeConversation(parentId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(analysis.activeModel, 'gemini-3.1-pro');
    assert.equal(analysis.totals.mainOnly.totalTokens, 160000);
    assert.equal(analysis.totals.withChildren.totalTokens, 195000);
    assert.ok(Math.abs(analysis.totals.mainOnly.costActual - 0.33) < 1e-9);

    const ledger = createUsageLedger();
    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: baseMs + 10000,
      ledger,
      disableAgentApi: true,
    });
    const parentRecent = global.recentConversations.find((c) => c.conversationId === parentId);
    const childRecent = global.recentConversations.find((c) => c.conversationId === childId);
    assert.ok(parentRecent);
    assert.ok(childRecent);
    assert.equal(parentRecent.totalTokens, 160000);
    assert.equal(childRecent.totalTokens, 35000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('pricing_sync unit tests: dual-channel merge, effective dates, non-chat filter, discovery, daily dedupe, offline cache, and override priority', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tm-sync-unit-'));
  const stateDir = join(root, 'state');
  mkdirSync(stateDir, { recursive: true });

  try {
    // Non-chat modality filtering
    assert.equal(isChatModelCandidate('gemini-3.8-flash'), true);
    assert.equal(isChatModelCandidate('gemini-3.8-flash-tts'), false);
    assert.equal(isChatModelCandidate('text-embedding-004'), false);
    assert.equal(isChatModelCandidate('imagen-3'), false);
    assert.equal(isChatModelCandidate('gemini-next-audio', { mode: 'audio' }), false);
    assert.equal(
      isChatModelCandidate('gemini-next-img', { mode: 'chat', modalities: { output: ['image'] } }),
      false,
    );

    const mockGoogleHtml = `
      <html><body>
        <h3>Gemini 3.1 Pro Preview</h3>
        <table>
          <tr><td>Input price</td><td>Not available</td><td>$2.00, prompts &lt;= 200k tokens<br>$4.00, prompts &gt; 200k tokens</td></tr>
          <tr><td>Output price</td><td>Not available</td><td>$12.00, prompts &lt;= 200k tokens<br>$18.00, prompts &gt; 200k tokens</td></tr>
          <tr><td>Context caching</td><td>Not available</td><td>$0.20, prompts &lt;= 200k tokens<br>$4.50 / 1,000,000 tokens per hour (storage)</td></tr>
        </table>
        <h3>Gemini 4 Carbon</h3>
        <table>
          <tr><td>Input price</td><td>Free of charge</td><td>$2.00 (through Nov 30, 2026)<br>$4.00 starting December 1, 2026</td></tr>
          <tr><td>Output price</td><td>Free of charge</td><td>$10.00 (through Nov 30, 2026)<br>$20.00 starting December 1, 2026</td></tr>
        </table>
        <h3>Gemini 4 Argon</h3>
        <table>
          <tr><td>Input price</td><td>Free</td><td>$2.00 (introductory), $4.00 starting December 1, 2026</td></tr>
          <tr><td>Output price</td><td>Free</td><td>$10.00 (introductory), $20.00 starting December 1, 2026</td></tr>
        </table>
        <h3>Gemini 3.8 Flash</h3>
        <table>
          <tr><td>Input price</td><td>Free</td><td>$0.70</td></tr>
          <tr><td>Output price</td><td>Free</td><td>$3.50</td></tr>
        </table>
        <h3>Gemini 3.8 Flash TTS</h3>
        <table>
          <tr><td>Input price</td><td>Free</td><td>$1.00</td></tr>
          <tr><td>Output price</td><td>Free</td><td>$20.00</td></tr>
        </table>
      </body></html>
    `;

    const mockModelsDev = {
      google: {
        models: {
          'gemini-3.1-pro': {
            id: 'gemini-3.1-pro',
            name: 'Gemini 3.1 Pro',
            cost: {
              input: 2.0,
              cache_read: 0.2,
              output: 12.0,
              context_over_200k: { input: 4.0, output: 18.0 },
            },
          },
          'gemini-4-carbon': {
            id: 'gemini-4-carbon',
            name: 'Gemini 4 Carbon',
            // Intentionally different from Google HTML so Channel 2 override precedence is verifiable
            cost: { input: 1.5, cache_read: 0.15, output: 8.5 },
          },
          'gemini-4.5-pro': {
            id: 'gemini-4.5-pro',
            name: 'Gemini 4.5 Pro',
            cost: { input: 3.0, cache_read: 0.3, output: 15.0 },
          },
          'gemini-3.2-pro': {
            id: 'gemini-3.2-pro',
            name: 'Gemini 3.2 Pro',
            cost: { input: 2.5, cache_read: 0.25, output: 14.0 },
          },
          'gemini-4-flash': {
            id: 'gemini-4-flash',
            name: 'Gemini 4 Flash',
            cost: { input: 0.5, cache_read: 0.05, output: 2.5 },
          },
          'gemini-3.8-flash-tts': {
            id: 'gemini-3.8-flash-tts',
            name: 'Gemini 3.8 Flash TTS',
            cost: { input: 1.0, output: 20.0 },
          },
          'text-embedding-004': {
            id: 'text-embedding-004',
            name: 'Text Embedding 004',
            cost: { input: 0.01, output: 0.01 },
          },
          'imagen-3': {
            id: 'imagen-3',
            name: 'Imagen 3',
            cost: { input: 0.04, output: 0.04 },
          },
        },
      },
      anthropic: {
        models: {
          'claude-opus-5-5': {
            id: 'claude-opus-5-5',
            name: 'Claude Opus 5.5',
            cost: { input: 5.0, cache_read: 0.25, output: 25.0 },
          },
        },
      },
      openai: {
        models: {
          'gpt-oss-120b': {
            id: 'gpt-oss-120b',
            name: 'GPT-OSS 120B',
            cost: { input: 0.2, cache_read: 0.1, output: 0.8 },
          },
        },
      },
    };

    const mockLiteLlm = {
      'anthropic/claude-opus-5-5': {
        litellm_provider: 'anthropic',
        mode: 'chat',
        input_cost_per_token: 4.5e-6,
        cache_read_input_cost_per_token: 0.22e-6,
        output_cost_per_token: 22.5e-6,
      },
      'gemini/gemini-4.5-pro': {
        litellm_provider: 'gemini',
        mode: 'chat',
        input_cost_per_token: 3.1e-6,
        cache_read_input_cost_per_token: 0.31e-6,
        output_cost_per_token: 15.5e-6,
      },
    };

    // Verify effective-date guard directly on Google HTML before vs on/after 2026-12-01
    const preDecGoogle = parseGoogleOfficialPricingHtml(mockGoogleHtml, Date.UTC(2026, 10, 17, 12, 0, 0));
    assert.equal(preDecGoogle.profileRates['gemini-3.1-pro'].inputPer1M, 2.0);
    assert.equal(preDecGoogle.profileRates['gemini-3.1-pro'].cachedPer1M, 0.2);
    assert.equal(preDecGoogle.profileRates['gemini-3.1-pro'].outputPer1M, 12.0);
    assert.equal(preDecGoogle.profileRates['gemini-3.1-pro'].longInputMultiplier, 2.0);
    assert.equal(preDecGoogle.profileRates['gemini-3.1-pro'].longOutputMultiplier, 1.5);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:26:51
// Description: Assert Gemini 4 Carbon/Argon remain flat-context while Gemini 3.1 Pro keeps longContextTier=true.
// ============================================================================
    assert.equal(preDecGoogle.profileRates['gemini-3.1-pro'].longContextTier, true);
    assert.equal(preDecGoogle.profileRates['gemini-4-carbon'].inputPer1M, 2.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-carbon'].outputPer1M, 10.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-carbon'].longContextTier, false);
    assert.equal(preDecGoogle.profileRates['gemini-4-argon'].inputPer1M, 2.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-argon'].outputPer1M, 10.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-argon'].longContextTier, false);
// ============================================================================
// [MODIFIED END] 2026-11-19 14:26:51
// ============================================================================
    assert.equal(preDecGoogle.profileRates['gemini-3-8-flash'].inputPer1M, 0.7);
    assert.equal(preDecGoogle.profileRates['gemini-3-8-flash'].outputPer1M, 3.5);
    assert.equal(preDecGoogle.profileRates['gemini-3.8-flash-tts'], undefined);

    const postDecGoogle = parseGoogleOfficialPricingHtml(mockGoogleHtml, Date.UTC(2026, 11, 1, 0, 0, 0));
    assert.equal(postDecGoogle.profileRates['gemini-4-carbon'].inputPer1M, 4.0);
    assert.equal(postDecGoogle.profileRates['gemini-4-carbon'].outputPer1M, 20.0);
    assert.equal(postDecGoogle.profileRates['gemini-4-argon'].inputPer1M, 4.0);
    assert.equal(postDecGoogle.profileRates['gemini-4-argon'].outputPer1M, 20.0);

    // Verify parseModelsDevCatalog & parseLiteLlmCatalog standalone
    const parsedDev = parseModelsDevCatalog(mockModelsDev);
    assert.equal(parsedDev.profileRates['claude-opus-5-5'].inputPer1M, 5.0);
    assert.equal(parsedDev.profileRates['gpt-oss-120b'].outputPer1M, 0.8);
    assert.equal(parsedDev.upstreamPool['text-embedding-004'], undefined);
    assert.equal(parsedDev.upstreamPool['imagen-3'], undefined);

    const parsedLite = parseLiteLlmCatalog(mockLiteLlm);
    assert.equal(parsedLite.profileRates['claude-opus-5-5'].inputPer1M, 4.5);
    assert.equal(parsedLite.upstreamPool['gemini-4.5-pro'].outputPer1M, 15.5);

    // Manager test: offline start -> cooldown -> recovery -> same-day dedupe -> date rollover -> offline cache retention
    let nowMs = Date.UTC(2026, 10, 17, 10, 0, 0);
    let mode = 'offline';
    let fetchCalls = 0;

    const mgr = createPricingSyncManager({
      stateDir,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => nowMs,
      autoSyncDisabled: false,
      fetchImpl: async (url) => {
        fetchCalls += 1;
        if (mode === 'offline') {
          throw new Error('simulated offline');
        }
        if (url.includes('models.dev')) {
          if (mode === 'litellm-fallback') {
            return { ok: false, status: 503, json: async () => ({}) };
          }
          return { ok: true, status: 200, json: async () => mockModelsDev };
        }
        if (url.includes('litellm')) {
          return { ok: true, status: 200, json: async () => mockLiteLlm };
        }
        return { ok: true, status: 200, text: async () => mockGoogleHtml };
      },
    });

    // Initial offline auto-sync must invoke onUpdated so UI never sticks in syncing=true
    let updatedCalls = 0;
    let settledResolve;
    const settledPromise = new Promise((r) => {
      settledResolve = r;
    });
    const triggeredOffline = mgr.maybeTriggerDailySync([], () => {
      updatedCalls += 1;
      settledResolve();
    });
    assert.equal(triggeredOffline, true);
    await settledPromise;
    assert.equal(updatedCalls, 1);
    assert.equal(mgr.getPublicStatus().syncing, false);
    assert.equal(mgr.getPublicStatus().status, 'offline');

    // Within 15-minute cooldown, maybeTriggerDailySync skips fetching
    const callsAfterOffline = fetchCalls;
    assert.equal(mgr.maybeTriggerDailySync([], () => {}), false);
    assert.equal(fetchCalls, callsAfterOffline);

    // Advance past 15-minute cooldown, switch online, and sync
    nowMs += 16 * 60 * 1000;
    mode = 'online';
    let onlineSettled;
    const onlinePromise = new Promise((r) => {
      onlineSettled = r;
    });
    assert.equal(
      mgr.maybeTriggerDailySync(['custom-local-coder-70b', 'Auto'], () => {
        updatedCalls += 1;
        onlineSettled();
      }),
      true,
    );
    await onlinePromise;

    const statusOk = mgr.getPublicStatus();
    assert.equal(statusOk.status, 'ok');
    assert.equal(statusOk.lastSyncLocalDate, formatLocalDate(nowMs));
    assert.deepEqual(statusOk.sources.sort(), ['google-official', 'models.dev']);

    const runtimeCat = mgr.getRuntimeCatalog(['custom-local-coder-70b', 'Auto']);
    const byId = new Map(runtimeCat.map((m) => [m.id, m]));
    assert.equal(runtimeCat[runtimeCat.length - 1].id, 'auto');

    // Channel 2 (Google Official) overrides Channel 1 on Gemini models before Dec 1
    assert.equal(byId.get('gemini-4-carbon').inputPer1M, 2.0);
    assert.equal(byId.get('gemini-4-carbon').outputPer1M, 10.0);
    assert.equal(byId.get('auto').outputPer1M, 10.0);
    // Channel 1 updates Anthropic & OpenAI models
    assert.equal(byId.get('claude-opus-5-5').inputPer1M, 5.0);
    assert.equal(byId.get('gpt-oss-120b').outputPer1M, 0.8);
    // New flagship Gemini chat discovery + non-chat exclusion + observed local slug promotion
    assert.equal(byId.get('gemini-4.5-pro').inputPer1M, 3.0);
    assert.equal(byId.get('gemini-3.2-pro').inputPer1M, 2.5);
    assert.equal(byId.get('gemini-4-flash').inputPer1M, 0.5);
    assert.equal(byId.get('gemini-3.8-flash-tts'), undefined);
    assert.equal(byId.get('text-embedding-004'), undefined);
    assert.equal(byId.get('imagen-3'), undefined);
    assert.equal(byId.get('custom-local-coder-70b').hint, '本地观测模型');

    // Same-day deduplication: second maybeTriggerDailySync on same local day makes 0 requests
    const callsAfterSuccess = fetchCalls;
    assert.equal(mgr.maybeTriggerDailySync([], () => {}), false);
    assert.equal(fetchCalls, callsAfterSuccess);

    // Manual prefs.modelOverrides takes highest priority over synced official rates until reset
    const effectivePrefs = {
      ...DEFAULT_PREFS,
      _runtimeCatalog: runtimeCat,
      modelOverrides: {
        'gemini-3.1-pro': { inputPer1M: 9.9, cachedPer1M: 0.9, outputPer1M: 29.9, longContextTier: true },
        'gemini-4.5-pro': { inputPer1M: 8.8, cachedPer1M: 0.8, outputPer1M: 28.8, longContextTier: false },
      },
    };
    const over31 = resolveModelPricing('gemini-3.1-pro', effectivePrefs);
    assert.equal(over31.isOverridden, true);
    assert.equal(over31.usdInputPer1M, 9.9);
    const over45 = resolveModelPricing('gemini-4.5-pro', effectivePrefs);
    assert.equal(over45.isOverridden, true);
    assert.equal(over45.usdOutputPer1M, 28.8);

    const effCatWithOv = buildEffectivePricingCatalog(effectivePrefs, runtimeCat);
    assert.equal(effCatWithOv.find((m) => m.id === 'gemini-4.5-pro').isOverridden, true);
    delete effectivePrefs.modelOverrides['gemini-3.1-pro'];
    const reverted31 = resolveModelPricing('gemini-3.1-pro', effectivePrefs);
    assert.equal(reverted31.isOverridden, false);
    assert.equal(reverted31.usdOutputPer1M, 12.0);

    // LiteLLM fallback works when models.dev fails
    mode = 'litellm-fallback';
    const liteRes = await mgr.syncNow([]);
    assert.equal(liteRes.ok, true);
    assert.equal(liteRes.status.sources.includes('litellm'), true);
    assert.equal(liteRes.runtimeCatalog.find((m) => m.id === 'claude-opus-5-5').inputPer1M, 4.5);

    // Next day offline preserves cached synced rates & transitions status to 'cached'
    nowMs = Date.UTC(2026, 10, 18, 10, 0, 0);
    mode = 'offline';
    const offlineCachedRes = await mgr.syncNow([]);
    assert.equal(offlineCachedRes.ok, false);
    assert.equal(offlineCachedRes.status.status, 'cached');
    assert.equal(offlineCachedRes.runtimeCatalog.find((m) => m.id === 'gemini-4.5-pro').inputPer1M, 3.1);

    // On/after 2026-12-01 online sync switches Carbon & Argon to $4 / $20
    nowMs = Date.UTC(2026, 11, 1, 10, 0, 0);
    mode = 'online';
    const decRes = await mgr.syncNow([]);
    assert.equal(decRes.ok, true);
    assert.equal(decRes.runtimeCatalog.find((m) => m.id === 'gemini-4-carbon').inputPer1M, 4.0);
    assert.equal(decRes.runtimeCatalog.find((m) => m.id === 'gemini-4-carbon').outputPer1M, 20.0);
    assert.equal(decRes.runtimeCatalog.find((m) => m.id === 'gemini-4-argon').inputPer1M, 4.0);
    assert.equal(decRes.runtimeCatalog.find((m) => m.id === 'gemini-4-argon').outputPer1M, 20.0);
    assert.equal(decRes.runtimeCatalog.find((m) => m.id === 'auto').outputPer1M, 20.0);

    // Reload manager from disk cache verifies pricing_cache.json persistence
    assert.equal(existsSync(join(stateDir, 'pricing_cache.json')), true);
    const mgrReloaded = createPricingSyncManager({
      stateDir,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => nowMs,
      autoSyncDisabled: true,
    });
    assert.equal(mgrReloaded.getPublicStatus().status, 'ok');
    assert.equal(mgrReloaded.getRuntimeCatalog().find((m) => m.id === 'gemini-4-carbon').outputPer1M, 20.0);
    assert.equal(mgrReloaded.getRuntimeCatalog().find((m) => m.id === 'gemini-4.5-pro').inputPer1M, 3.0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('standalone HTTP E2E: POST /api/sync-pricing, dynamic & gemini-3.1-pro overrides via POST /api/prefs, and restart persistence', async () => {
  const { root, appData } = makeTempEnv();
  const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(dataDir, { recursive: true });
  const fakeHome = join(root, 'home');
  mkdirSync(fakeHome, { recursive: true });

  const convId = 'd4444444-4444-4444-8444-444444444444';
  writeConversation(appData, convId, {
    compactLines: [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: '2026-11-17T09:00:00Z',
        content: '<USER_REQUEST>Check E2E pricing sync</USER_REQUEST>',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-17T09:00:05Z',
        model: 'gemini-3.1-pro',
        input_tokens: 40000,
        cache_read_tokens: 60000,
        output_tokens: 5000,
        tool_calls: [],
      },
    ],
    mtimeMs: Date.parse('2026-11-17T09:00:06Z'),
  });

  const mockHtml = `
    <h3>Gemini 3.1 Pro Preview</h3>
    <table>
      <tr><td>Input price</td><td>Not available</td><td>$2.00</td></tr>
      <tr><td>Output price</td><td>Not available</td><td>$12.00</td></tr>
      <tr><td>Context caching</td><td>Not available</td><td>$0.20</td></tr>
    </table>
  `;
  const mockModelsDev = {
    google: {
      models: {
        'gemini-3.1-pro': {
          id: 'gemini-3.1-pro',
          name: 'Gemini 3.1 Pro',
          cost: { input: 2.0, cache_read: 0.2, output: 12.0 },
        },
        'gemini-4.5-pro': {
          id: 'gemini-4.5-pro',
          name: 'Gemini 4.5 Pro',
          cost: { input: 3.5, cache_read: 0.35, output: 17.5 },
        },
        'gemini-3.8-flash-tts': {
          id: 'gemini-3.8-flash-tts',
          name: 'Gemini 3.8 Flash TTS',
          cost: { input: 1.0, output: 20.0 },
        },
      },
    },
  };

  const mockServer = createServer((req, res) => {
    if (req.url === '/google-pricing') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(mockHtml);
      return;
    }
    if (req.url === '/models-dev.json') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(mockModelsDev));
      return;
    }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Serve deterministic mock USD-to-CNY FX endpoint in E2E server.
// ============================================================================
    if (req.url === '/fx-usd.json') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ base: 'USD', date: '2026-11-17', rates: { CNY: 6.6688 } }));
      return;
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
    res.writeHead(404);
    res.end('not found');
  });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:42:45
// Description: Ensure mock pricing server avoids WHATWG Fetch blocked ports on Windows.
// ============================================================================
  const mockPort = await listenOnFetchSafePort(mockServer);
  const mockBase = `http://127.0.0.1:${mockPort}`;
// ============================================================================
// [MODIFIED END] 2026-11-17 21:42:45
// ============================================================================

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
  const sdkFallback = join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs');

  async function spawnSidecar(port) {
    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    if (existsSync(sdkFallback)) {
      env.SIDECAR_SDK_PATH = sdkFallback;
    }
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;
    env.PRICING_SYNC_DISABLE_AUTO = '1';
    env.PRICING_SYNC_GOOGLE_URL = `${mockBase}/google-pricing`;
    env.PRICING_SYNC_MODELS_DEV_URL = `${mockBase}/models-dev.json`;
    env.PRICING_SYNC_LITELLM_URL = `${mockBase}/missing-litellm.json`;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Point FX primary & fallback URLs to deterministic mock server.
// ============================================================================
    env.PRICING_SYNC_FX_URL = `${mockBase}/missing-fx-primary.json`;
    env.PRICING_SYNC_FX_FALLBACK_URL = `${mockBase}/fx-usd.json`;
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================

    const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });
    return child;
  }

  async function stopChild(child) {
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
  }

  let child1 = null;
  let child2 = null;
  try {
    const port1 = 19842;
    child1 = await spawnSidecar(port1);
    const base1 = `http://127.0.0.1:${port1}`;

    const snap1 = await (await fetch(`${base1}/api/snapshot?conv=${encodeURIComponent(convId)}`)).json();
    assert.equal(snap1.pricingSync.status, 'idle');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Update expected initial snapshot pricingCatalog length to 10 (with gemini-4-neon).
// ============================================================================
    assert.equal(snap1.pricingCatalog.length, 10);
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
    assert.equal(snap1.current.totals.mainOnly.totalTokens, 105000);
    assert.equal(snap1.global.recentConversations[0].totalTokens, 105000);

    // Trigger POST /api/sync-pricing against local mock server
    const syncRes = await fetch(`${base1}/api/sync-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.equal(syncBody.ok, true);
    assert.equal(syncBody.pricingSync.status, 'ok');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Verify automatic USD-to-CNY FX sync (with fallback), manual FX
// lock priority across syncs/restarts, and auto-mode restoration.
// ============================================================================
    assert.equal(parseUsdToCnyRateJson({ rates: { CNY: 6.66654 } }), 6.6665);
    assert.equal(parseUsdToCnyRateJson({ rates: { CNY: 0.2 } }), null);
    assert.equal(parseUsdToCnyRateJson({ rates: { CNY: 99 } }), null);
    assert.equal(syncBody.pricingSync.usdToCnyRate, 6.6688);
    assert.equal(syncBody.pricingSync.fxSource, 'open.er-api.com');
    assert.equal(syncBody.prefs.cnyRateMode, 'auto');
    assert.equal(syncBody.prefs.cnyRate, 6.6688);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
    assert.ok(syncBody.pricingSync.discoveredCount >= 1);
    assert.ok(syncBody.pricingCatalog.some((m) => m.id === 'gemini-4.5-pro'));
    assert.equal(syncBody.pricingCatalog.some((m) => m.id === 'gemini-3.8-flash-tts'), false);
    assert.equal(existsSync(join(dataDir, 'pricing_cache.json')), true);

    // Invalid profile ID rejected cleanly
    const badOvRes = await fetch(`${base1}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelOverrides: { '../bad': { inputPer1M: 1, cachedPer1M: 0.1, outputPer1M: 2 } },
      }),
    });
    assert.equal(badOvRes.status, 400);

    // Save overrides on gemini-3.1-pro and synced dynamic model gemini-4.5-pro
    const ovRes = await fetch(`${base1}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Lock manual FX rate (7.15) and verify preservation across sync & restart.
// ============================================================================
        currency: 'CNY',
        cnyRateMode: 'manual',
        cnyRate: 7.15,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
        modelOverrides: {
          'gemini-3.1-pro': { inputPer1M: 7.5, cachedPer1M: 0.75, outputPer1M: 27.5, longContextTier: true },
          'gemini-4.5-pro': { inputPer1M: 8.5, cachedPer1M: 0.85, outputPer1M: 35.0, longContextTier: false },
        },
      }),
    });
    assert.equal(ovRes.status, 200);
    const ovBody = await ovRes.json();
    assert.equal(ovBody.ok, true);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Assert manual FX rate is saved and preserved across re-sync & restart,
// then snaps back to synced 6.6688 when cnyRateMode is switched back to 'auto'.
// ============================================================================
    assert.equal(ovBody.prefs.cnyRateMode, 'manual');
    assert.equal(ovBody.prefs.cnyRate, 7.15);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
    assert.equal(ovBody.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').isOverridden, true);
    assert.equal(ovBody.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').usd.inputPer1M, 7.5);
    assert.equal(ovBody.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').isOverridden, true);
    assert.equal(ovBody.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').usd.outputPer1M, 35.0);

    // Re-syncing upstream must preserve manual overrides
    const syncAgain = await (
      await fetch(`${base1}/api/sync-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).json();
    assert.equal(syncAgain.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').usd.inputPer1M, 7.5);
    assert.equal(syncAgain.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').usd.outputPer1M, 35.0);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Verify manual cnyRate (7.15) is not overwritten by /api/sync-pricing.
// ============================================================================
    assert.equal(syncAgain.prefs.cnyRateMode, 'manual');
    assert.equal(syncAgain.prefs.cnyRate, 7.15);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================

    await stopChild(child1);
    child1 = null;

    // Restart sidecar against same dataDir and verify both synced cache & manual overrides persist
    const port2 = 19843;
    child2 = await spawnSidecar(port2);
    const base2 = `http://127.0.0.1:${port2}`;
    const snapRestart = await (await fetch(`${base2}/api/snapshot?conv=${encodeURIComponent(convId)}`)).json();
    assert.equal(snapRestart.pricingSync.status, 'ok');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Verify persisted manual FX mode across restart and auto-mode snap back.
// ============================================================================
    assert.equal(snapRestart.pricingSync.usdToCnyRate, 6.6688);
    assert.equal(snapRestart.prefs.cnyRateMode, 'manual');
    assert.equal(snapRestart.prefs.cnyRate, 7.15);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
    assert.equal(snapRestart.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').isOverridden, true);
    assert.equal(snapRestart.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').usd.inputPer1M, 7.5);
    assert.equal(snapRestart.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').isOverridden, true);
    assert.equal(snapRestart.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').usd.outputPer1M, 35.0);

    // Reset both overrides via null
    const resetRes = await (
      await fetch(`${base2}/api/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Switch cnyRateMode back to 'auto' and verify cnyRate adopts synced 6.6688.
// ============================================================================
          cnyRateMode: 'auto',
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
          modelOverrides: {
            'gemini-3.1-pro': null,
            'gemini-4.5-pro': null,
          },
        }),
      })
    ).json();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:51:00
// Description: Assert cnyRate snapped back to synced 6.6688 upon returning to 'auto'.
// ============================================================================
    assert.equal(resetRes.prefs.cnyRateMode, 'auto');
    assert.equal(resetRes.prefs.cnyRate, 6.6688);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:51:00
// ============================================================================
    assert.equal(resetRes.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').isOverridden, false);
    assert.equal(resetRes.pricingCatalog.find((m) => m.id === 'gemini-3.1-pro').usd.inputPer1M, 2.0);
    assert.equal(resetRes.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').isOverridden, false);
    assert.equal(resetRes.pricingCatalog.find((m) => m.id === 'gemini-4.5-pro').usd.outputPer1M, 17.5);
  } finally {
    await stopChild(child1);
    await stopChild(child2);
    await new Promise((r) => mockServer.close(() => r()));
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-17 11:51:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Add unit tests for capability-first Gemini catalog sorting,
// scoreModelPerformance / compareModelsByPerformance, discovered Flash tier
// ordering, and 3-pass resolveModelProfile (exact -> pattern -> fallbackPattern).
// ============================================================================
test('built-in MODEL_PRICING_CATALOG orders Gemini series top-to-bottom by performance tier', () => {
  const geminiIds = MODEL_PRICING_CATALOG
    .filter((m) => m.group === 'Gemini 系列')
    .map((m) => m.id);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Include first-class gemini-4-neon between Carbon and Argon in MODEL_PRICING_CATALOG order checks.
// ============================================================================
  assert.deepEqual(geminiIds, [
    'gemini-4-carbon',
    'gemini-4-neon',
    'gemini-4-argon',
    'gemini-4-hydrogen',
    'gemini-3.1-pro',
    'gemini-3-8-flash',
  ]);
  assert.deepEqual(
    MODEL_PRICING_CATALOG.map((m) => m.id),
    [
      'gemini-4-carbon',
      'gemini-4-neon',
      'gemini-4-argon',
      'gemini-4-hydrogen',
      'gemini-3.1-pro',
      'gemini-3-8-flash',
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'gpt-oss-120b',
      'auto',
    ],
  );
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
});

test('scoreModelPerformance & compareModelsByPerformance rank versions, tiers, preview penalties, and groups accurately', () => {
  assert.ok(
    scoreModelPerformance({ id: 'gemini-3-8-flash', group: 'Gemini 系列', label: 'Gemini 3.8 Flash' }) >
      scoreModelPerformance({ id: 'gemini-3.7-flash', group: 'Gemini 系列', label: 'Gemini 3.7 Flash' }),
  );
  assert.ok(
    scoreModelPerformance({ id: 'gemini-3.7-flash', group: 'Gemini 系列', label: 'Gemini 3.7 Flash' }) >
      scoreModelPerformance({
        id: 'gemini-3.5-flash-lite',
        group: 'Gemini 系列',
        label: 'Gemini 3.5 Flash Lite',
      }),
  );
  assert.ok(
    scoreModelPerformance({ id: 'gemini-3.1-pro', group: 'Gemini 系列', label: 'Gemini 3.1 Pro' }) >
      scoreModelPerformance({
        id: 'gemini-3.1-pro-preview',
        group: 'Gemini 系列',
        label: 'Gemini 3.1 Pro Preview',
      }),
  );
  assert.ok(
    scoreModelPerformance({
      id: 'gemini-3.1-pro-preview',
      group: 'Gemini 系列',
      label: 'Gemini 3.1 Pro Preview',
    }) > scoreModelPerformance({ id: 'gemini-3.0-pro', group: 'Gemini 系列', label: 'Gemini 3.0 Pro' }),
  );
  assert.ok(
    scoreModelPerformance({ id: 'claude-opus-5-5', group: 'Claude 系列', label: 'Claude Opus 5.5' }) >
      scoreModelPerformance({ id: 'claude-sonnet-5-5', group: 'Claude 系列', label: 'Claude Sonnet 5.5' }),
  );
  assert.ok(
    scoreModelPerformance({ id: 'claude-sonnet-5-5', group: 'Claude 系列', label: 'Claude Sonnet 5.5' }) >
      scoreModelPerformance({ id: 'claude-haiku-4-5', group: 'Claude 系列', label: 'Claude Haiku 4.5' }),
  );

  const shuffled = [
    { id: 'auto', group: '默认回退', label: 'Auto (默认)', outputPer1M: 10, inputPer1M: 2 },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:37:27
// Description: Update group label expectation from 其他在役模型 to 其他现役模型 for v0.2.6.
// ============================================================================
    { id: 'gpt-oss-120b', group: '其他现役模型', label: 'GPT-OSS 120B', outputPer1M: 0.6, inputPer1M: 0.15 },
// ============================================================================
// [MODIFIED END] 2026-11-17 21:37:27
// ============================================================================
    { id: 'claude-sonnet-5-5', group: 'Claude 系列', label: 'Claude Sonnet 5.5', outputPer1M: 10, inputPer1M: 2 },
    { id: 'claude-opus-5-5', group: 'Claude 系列', label: 'Claude Opus 5.5', outputPer1M: 20, inputPer1M: 4 },
    { id: 'gemini-3.5-flash-lite', group: 'Gemini 系列', label: 'Gemini 3.5 Flash Lite', outputPer1M: 0.4, inputPer1M: 0.1 },
    { id: 'gemini-3-8-flash', group: 'Gemini 系列', label: 'Gemini 3.8 Flash', outputPer1M: 3.75, inputPer1M: 0.75 },
    { id: 'gemini-4-carbon', group: 'Gemini 系列', label: 'Gemini 4 Carbon', outputPer1M: 10, inputPer1M: 2 },
    { id: 'gemini-3.1-pro', group: 'Gemini 系列', label: 'Gemini 3.1 Pro', outputPer1M: 12, inputPer1M: 2 },
  ];
  shuffled.sort(compareModelsByPerformance);
  assert.deepEqual(
    shuffled.map((m) => m.id),
    [
      'gemini-4-carbon',
      'gemini-3.1-pro',
      'gemini-3-8-flash',
      'gemini-3.5-flash-lite',
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'gpt-oss-120b',
      'auto',
    ],
  );
});

test('pricing_sync discovers 3.5-3.7 Flash models sorted by capability and resolves 3-pass profiles without shadowing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tm-sort-resolve-'));
  const stateDir = join(root, 'state');
  mkdirSync(stateDir, { recursive: true });
  try {
    const mockModelsDev = {
      google: {
        models: {
          'gemini-3.5-flash-lite': {
            id: 'gemini-3.5-flash-lite',
            name: 'Gemini 3.5 Flash Lite',
            cost: { input: 0.1, cache_read: 0.01, output: 0.4 },
          },
          'gemini-3.5-flash': {
            id: 'gemini-3.5-flash',
            name: 'Gemini 3.5 Flash',
            cost: { input: 0.3, cache_read: 0.03, output: 1.5 },
          },
          'gemini-3.7-flash': {
            id: 'gemini-3.7-flash',
            name: 'Gemini 3.7 Flash',
            cost: { input: 0.5, cache_read: 0.05, output: 2.5 },
          },
          'gemini-3.6-flash': {
            id: 'gemini-3.6-flash',
            name: 'Gemini 3.6 Flash',
            cost: { input: 0.4, cache_read: 0.04, output: 2.0 },
          },
        },
      },
    };

    const mgr = createPricingSyncManager({
      stateDir,
      baseCatalog: MODEL_PRICING_CATALOG,
      googlePricingUrl: '',
      liteLlmUrl: '',
      autoSyncDisabled: true,
      fetchImpl: async (url) => {
        if (url.includes('models.dev')) {
          return { ok: true, status: 200, json: async () => mockModelsDev };
        }
        return { ok: false, status: 404, text: async () => '' };
      },
    });

    const syncRes = await mgr.syncNow([]);
    assert.equal(syncRes.ok, true);

    const runtimeCatalog = mgr.getRuntimeCatalog([]);
    const geminiIds = runtimeCatalog.filter((m) => m.group === 'Gemini 系列').map((m) => m.id);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Include gemini-4-neon in runtime catalog Gemini series order check.
// ============================================================================
    assert.deepEqual(geminiIds, [
      'gemini-4-carbon',
      'gemini-4-neon',
      'gemini-4-argon',
      'gemini-4-hydrogen',
      'gemini-3.1-pro',
      'gemini-3-8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]);
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================

    const cacheJson = JSON.parse(readFileSync(join(stateDir, 'pricing_cache.json'), 'utf-8'));
    assert.deepEqual(
      cacheJson.discoveredModels.map((m) => m.id),
      ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'],
    );

    // Verify 3-pass lookup: exact id/label -> specific pattern -> catch-all fallbackPattern
    assert.equal(resolveModelProfile('Gemini 3.7 Flash', runtimeCatalog).id, 'gemini-3.7-flash');
    assert.equal(resolveModelProfile('Gemini 3.1 Pro (High)', runtimeCatalog).id, 'gemini-3.1-pro');
    assert.equal(resolveModelProfile('Gemini 2.5 Pro', runtimeCatalog).id, 'gemini-4-carbon');
    assert.equal(resolveModelProfile('Gemini Flash', runtimeCatalog).id, 'gemini-3-8-flash');
    assert.equal(resolveModelProfile('Pro', runtimeCatalog).id, 'gemini-4-carbon');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update runtimeCatalog profile resolution for gemini-flash-worker-agy to gemini-4-hydrogen.
// ============================================================================
    assert.equal(resolveModelProfile('gemini-flash-worker-agy', runtimeCatalog).id, 'gemini-4-hydrogen');
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 16:08:26
// Description: Add unit and integration tests for post-/compact live status
// IDLE recovery, provisional summary context tracking (compactedPendingTurn),
// post-compaction PLANNER_RESPONSE reset, billable totals preservation, and
// zh/en I18N key parity for context.compactedBanner.
// ============================================================================
test('computeLiveStatus settles to IDLE after /compact USER_INPUT + DONE COMPACTION_SUMMARY and stays GENERATING until DONE', () => {
  const t0 = Date.parse('2026-11-17T07:50:00Z');
  const t1 = Date.parse('2026-11-17T07:51:00Z');
  const t2 = Date.parse('2026-11-17T07:51:05Z');
  const t3 = Date.parse('2026-11-17T07:52:00Z');

  // 1. /compact USER_INPUT with NO COMPACTION_SUMMARY (DONE) after it yet -> GENERATING
  const pendingCompactParsed = {
    statMtimeMs: t1 + 1000,
    steps: [
      {
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        createdAtMs: t0,
        hasTokenTelemetry: true,
        input_tokens: 2507,
        cache_read_tokens: 482200,
        output_tokens: 200,
        tool_calls: [],
      },
      {
        step_index: 1,
        type: 'USER_INPUT',
        status: 'DONE',
        createdAtMs: t1,
      },
    ],
  };
  const pendingRes = computeLiveStatus(pendingCompactParsed);
  assert.equal(pendingRes.status, 'GENERATING');
  assert.equal(pendingRes.generatingSinceMs, t1);
  assert.equal(pendingRes.toolProgress, null);
  assert.equal(pendingRes.activeToolLabel, '');

  // 2. Same /compact USER_INPUT followed by COMPACTION_SUMMARY with status !== 'DONE' -> still GENERATING
  const runningCompactParsed = {
    statMtimeMs: t2,
    steps: [
      ...pendingCompactParsed.steps,
      {
        step_index: 2,
        type: 'COMPACTION_SUMMARY',
        status: 'RUNNING',
        createdAtMs: t2,
        hasTokenTelemetry: true,
        input_tokens: 3091,
        cache_read_tokens: 483328,
        output_tokens: 3739,
      },
    ],
  };
  assert.equal(computeLiveStatus(runningCompactParsed).status, 'GENERATING');

  // 3. /compact USER_INPUT followed by COMPACTION_SUMMARY with status === 'DONE' (no newer USER_INPUT or wakeup) -> IDLE
  const doneCompactParsed = {
    statMtimeMs: t2,
    steps: [
      ...pendingCompactParsed.steps,
      {
        step_index: 2,
        type: 'COMPACTION_SUMMARY',
        status: 'DONE',
        createdAtMs: t2,
        hasTokenTelemetry: true,
        input_tokens: 3091,
        cache_read_tokens: 483328,
        output_tokens: 3739,
      },
    ],
  };
  assert.deepEqual(computeLiveStatus(doneCompactParsed), {
    status: 'IDLE',
    generatingSinceMs: null,
    toolProgress: null,
    activeToolLabel: '',
  });

  // 4. Newer USER_INPUT after DONE COMPACTION_SUMMARY -> GENERATING again
  const postCompactUserParsed = {
    statMtimeMs: t3,
    steps: [
      ...doneCompactParsed.steps,
      {
        step_index: 3,
        type: 'USER_INPUT',
        status: 'DONE',
        createdAtMs: t3,
      },
    ],
  };
  const postUserRes = computeLiveStatus(postCompactUserParsed);
  assert.equal(postUserRes.status, 'GENERATING');
  assert.equal(postUserRes.generatingSinceMs, t3);

  // 5. Wakeup SYSTEM_MESSAGE after DONE COMPACTION_SUMMARY -> GENERATING again
  const postCompactWakeupParsed = {
    statMtimeMs: t3,
    steps: [
      ...doneCompactParsed.steps,
      {
        step_index: 3,
        type: 'SYSTEM_MESSAGE',
        status: 'DONE',
        createdAtMs: t3,
        isWakeupMessage: true,
      },
    ],
  };
  const wakeupRes = computeLiveStatus(postCompactWakeupParsed);
  assert.equal(wakeupRes.status, 'GENERATING');
  assert.equal(wakeupRes.generatingSinceMs, t3);
});

test('computeContext switches to provisional summary tokens after /compact and resets on next PLANNER_RESPONSE while preserving billable totals', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convId = 'd1d1d1d1-1111-4111-8111-111111111111';
    const baseMs = Date.parse('2026-11-17T08:00:00Z');

    // Step 0..2: Pre-compaction CRITICAL PLANNER_RESPONSE (2507 + 482200 = 484707), /compact USER_INPUT, DONE CHECKPOINT
    const preAndCompactionLines = [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: new Date(baseMs).toISOString(),
        content: '<USER_REQUEST>Long session work</USER_REQUEST>',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date(baseMs + 1000).toISOString(),
        input_tokens: 2507,
        cache_read_tokens: 482200,
        output_tokens: 200,
        tool_calls: [],
      },
      {
        step_index: 2,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: new Date(baseMs + 2000).toISOString(),
        content: '/compact',
      },
      {
        step_index: 3,
        type: 'CHECKPOINT',
        status: 'DONE',
        created_at: new Date(baseMs + 5000).toISOString(),
        input_tokens: 3091,
        cache_read_tokens: 483328,
        output_tokens: 3739,
      },
    ];

    writeConversation(appData, convId, {
      compactLines: preAndCompactionLines,
      mtimeMs: baseMs + 6000,
    });

    const paths = resolveConversationPaths(convId, [appData]);
    const parsedCompacted = parseTranscript(convId, paths);
    assert.deepEqual(computeLiveStatus(parsedCompacted), {
      status: 'IDLE',
      generatingSinceMs: null,
      toolProgress: null,
      activeToolLabel: '',
    });

    const ctxCompacted = computeContext(parsedCompacted, DEFAULT_PREFS);
    assert.equal(ctxCompacted.compactedPendingTurn, true);
    assert.equal(ctxCompacted.compactedPreTotal, 484707);
    assert.equal(ctxCompacted.compactionSummaryTokens, 3739);
    assert.equal(ctxCompacted.currentTotal, 3739);
    assert.equal(ctxCompacted.usageLevel, 'HEALTHY');
    assert.equal(ctxCompacted.watermarkLevel, 'HEALTHY');
    assert.equal(ctxCompacted.latestNetDelta, 0);

    // analyzeConversation must reflect IDLE + HEALTHY compacted context AND billable compaction tokens
    const analyzedCompacted = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(analyzedCompacted.status, 'IDLE');
    assert.equal(analyzedCompacted.context.compactedPendingTurn, true);
    assert.equal(analyzedCompacted.context.compactedPreTotal, 484707);
    assert.equal(analyzedCompacted.context.compactionSummaryTokens, 3739);
    assert.equal(analyzedCompacted.context.currentTotal, 3739);
    assert.equal(analyzedCompacted.context.usageLevel, 'HEALTHY');
    assert.equal(analyzedCompacted.context.latestNetDelta, 0);
    const plannerTotal = 2507 + 482200 + 200;
    const compactionBillable = 3091 + 483328 + 3739;
    assert.equal(analyzedCompacted.totals.mainOnly.stepsCount, 2);
    assert.equal(analyzedCompacted.totals.mainOnly.inputUncachedTokens, 2507 + 3091);
    assert.equal(analyzedCompacted.totals.mainOnly.cacheReadTokens, 482200 + 483328);
    assert.equal(analyzedCompacted.totals.mainOnly.outputTokens, 200 + 3739);
    assert.equal(analyzedCompacted.totals.mainOnly.totalTokens, plannerTotal + compactionBillable);

    // Next turn arrives after compaction: new PLANNER_RESPONSE resets provisional compaction flags
    const postTurnLines = [
      ...preAndCompactionLines,
      {
        step_index: 4,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: new Date(baseMs + 10000).toISOString(),
        content: '<USER_REQUEST>Continue after compact</USER_REQUEST>',
      },
      {
        step_index: 5,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date(baseMs + 12000).toISOString(),
        input_tokens: 29507,
        cache_read_tokens: 0,
        output_tokens: 173,
        tool_calls: [],
      },
    ];

    writeConversation(appData, convId, {
      compactLines: postTurnLines,
      mtimeMs: baseMs + 13000,
    });

    const parsedPostTurn = parseTranscript(convId, paths);
    const ctxPostTurn = computeContext(parsedPostTurn, DEFAULT_PREFS);
    assert.equal(ctxPostTurn.compactedPendingTurn, false);
    assert.equal(ctxPostTurn.compactedPreTotal, 0);
    assert.equal(ctxPostTurn.compactionSummaryTokens, 0);
    assert.equal(ctxPostTurn.currentTotal, 29507);
    assert.equal(ctxPostTurn.usageLevel, 'HEALTHY');
    assert.equal(ctxPostTurn.watermarkLevel, 'HEALTHY');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('app.js I18N zh/en tables maintain 100% key parity including context.compactedBanner', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const appSource = readFileSync(join(testDir, '..', 'sidecars', 'monitor_pane', 'app.js'), 'utf-8');
  const zhStart = appSource.indexOf('const I18N = {');
  assert.ok(zhStart >= 0, 'I18N object should exist in app.js');
  const zhBlockMatch = appSource.slice(zhStart).match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(zhBlockMatch, 'Both zh and en blocks should be extractable from I18N');

  const extractKeys = (block) => {
    const keys = [];
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:/gm)) {
      keys.push(match[1]);
    }
    return keys;
  };

  const zhKeys = extractKeys(zhBlockMatch[1]);
  const enKeys = extractKeys(zhBlockMatch[2]);
  assert.ok(zhKeys.includes('context.compactedBanner'));
  assert.ok(enKeys.includes('context.compactedBanner'));
  assert.deepEqual([...zhKeys].sort(), [...enKeys].sort());
});
// ============================================================================
// [MODIFIED END] 2026-11-17 16:08:26
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 17:27:07
// Description: Add v0.2.3 regression tests for zero-timestamp & prototype-key
// safety, malformed SQLite isolation, chunked cold-start usageLedger.sync with
// priorityConvId, standalone HTTP /api/snapshot & /_sidecar/get-conversation-metadata
// fast-path, and app.js static serial-polling & DOM safety invariants.
// ============================================================================
test('zero-timestamp filtering, prototype-key safety (constructor), and malformed DB isolation', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });

    const convA = 'a1a1a1a1-1111-4111-8111-111111111111';
    const convB = 'b2b2b2b2-2222-4222-8222-222222222222';
    const convC = 'c3c3c3c3-3333-4333-8333-333333333333';
    const nowMs = Date.parse('2026-11-17T09:00:00Z');
    const validTs = '2026-11-17T08:00:00Z';

    // Conv A: Go zero-time "0001-01-01T00:00:00Z" + model ID "constructor" alongside valid 2026-11-17 step
    writeConversation(appData, convA, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '0001-01-01T00:00:00Z',
          content:
            '<USER_REQUEST>Zero-timestamp prototype test</USER_REQUEST>\n<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from None to constructor.</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '0001-01-01T00:00:00Z',
          input_tokens: 1000,
          cache_read_tokens: 0,
          output_tokens: 50,
          tool_calls: [],
        },
        {
          step_index: 2,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: validTs,
          input_tokens: 4000,
          cache_read_tokens: 1000,
          output_tokens: 500,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse(validTs) + 1000,
    });

    // Conv B: corrupt/unreadable SQLite .db file with invalid header
    writeFileSync(
      join(convsDir, `${convB}.db`),
      Buffer.from('CORRUPT_SQLITE_HEADER_BYTES_NOT_A_VALID_DATABASE_FILE'),
    );

    // Conv C: normal healthy conversation
    writeConversation(appData, convC, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-17T08:05:00Z',
          content:
            '<USER_REQUEST>Normal conversation C</USER_REQUEST>\n<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from None to Gemini 3.1 Pro (High).</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:05:05Z',
          input_tokens: 2000,
          cache_read_tokens: 3000,
          output_tokens: 200,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:05:06Z'),
    });

    const resA = analyzeConversation(convA, { appDataDirs: [appData], disableAgentApi: true });
    assert.ok(resA);
    assert.equal(resA.activeModel, 'constructor');
    const resB = analyzeConversation(convB, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(resB, null);
    const resC = analyzeConversation(convC, { appDataDirs: [appData], disableAgentApi: true });
    assert.ok(resC);
    assert.equal(resC.activeModel, 'gemini-3.1-pro');
    assert.equal(resC.totals.mainOnly.totalTokens, 5200);

    const ledger = createUsageLedger();
    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs,
      ledger,
      disableAgentApi: true,
    });

    assert.ok(global.periods.all.series.length >= 1);
    assert.ok(global.periods.all.series.length <= 20);
    assert.ok(global.periods.all.startDate >= '2000-01-01');
    assert.equal(global.periods.all.conversationsCount, 2);

    const ctorBucket = global.periods.all.byModel.find((m) => m.model === 'constructor');
    assert.ok(ctorBucket, 'Model ID "constructor" should be tracked as own property');
    assert.equal(ctorBucket.totalTokens, 5500);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Match canonical profileId/model label for Gemini 3.1 Pro in Tab 2 byModel.
// ============================================================================
    const proBucket = global.periods.all.byModel.find((m) => m.profileId === 'gemini-3.1-pro');
    assert.ok(proBucket, 'Normal Conv C should still be included despite corrupt Conv B');
    assert.equal(proBucket.model, 'Gemini 3.1 Pro');
    assert.deepEqual(proBucket.rawModels, ['gemini-3.1-pro']);
    assert.equal(proBucket.totalTokens, 5200);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================

    // Ensure Object.prototype was not corrupted
    assert.equal(Object.prototype.constructor, Object);
    assert.equal(({}).constructor, Object);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('chunked cold-start usageLedger.sync prioritizes priorityConvId and converges to full rebuild totals', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const nowMs = Date.parse('2026-11-17T09:00:00Z');
    const dayOffsets = [0, 0, 1, 2, 4, 6, 8, 12, 18, 25, 35, 70];
    const convIds = [];

    for (let i = 0; i < dayOffsets.length; i++) {
      const hex = (i + 1).toString(16).padStart(2, '0');
      const convId = `c01d00${hex}-0000-4000-8000-0000000000${hex}`;
      convIds.push(convId);
      const stepMs = nowMs - dayOffsets[i] * 86400 * 1000 - i * 60000;
      const iso = new Date(stepMs).toISOString();
      const modelLabel = i % 2 === 0 ? 'Gemini 3.1 Pro (High)' : 'Gemini 4 Carbon (High)';
      writeConversation(appData, convId, {
        compactLines: [
          {
            step_index: 0,
            type: 'USER_INPUT',
            status: 'DONE',
            created_at: iso,
            content: `<USER_REQUEST>Session ${i}</USER_REQUEST>\n<USER_SETTINGS_CHANGE>Model Selection from None to ${modelLabel}</USER_SETTINGS_CHANGE>`,
          },
          {
            step_index: 1,
            type: 'PLANNER_RESPONSE',
            status: 'DONE',
            created_at: iso,
            input_tokens: 1000 * (i + 1),
            cache_read_tokens: 500 * (i + 1),
            output_tokens: 100 * (i + 1),
            tool_calls: [],
          },
        ],
        mtimeMs: stepMs + 1000,
      });
    }

    const oldestId = convIds[convIds.length - 1];
    const chunkLedger = createUsageLedger();

    // First chunked call: maxRebuildBatch = 4 with priorityConvId = oldestId
    const first = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs,
      ledger: chunkLedger,
      maxRebuildBatch: 4,
      priorityConvId: oldestId,
      disableAgentApi: true,
    });
    assert.equal(first.ledgerSync.syncing, true);
    assert.ok(first.ledgerSync.pendingCount > 0);
    assert.equal(first.ledgerSync.onDiskCount, 12);
    assert.ok(chunkLedger.getData().conversations[oldestId], 'priorityConvId must be indexed on first call');
    assert.ok(Object.keys(chunkLedger.getData().conversations[oldestId].days).length > 0);

    // Continue chunked sync until complete
    let latest = first;
    let guard = 0;
    while (latest.ledgerSync.syncing && guard < 10) {
      guard += 1;
      latest = summarizeGlobalAndRecent({
        appDataDirs: [appData],
        nowMs,
        ledger: chunkLedger,
        maxRebuildBatch: 4,
        disableAgentApi: true,
      });
    }
    assert.equal(latest.ledgerSync.syncing, false);
    assert.equal(latest.ledgerSync.pendingCount, 0);
    assert.equal(latest.ledgerSync.onDiskCount, 12);

    const oneShot = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs,
      disableAgentApi: true,
    });
    assert.equal(oneShot.ledgerSync.syncing, false);
    assert.equal(oneShot.ledgerSync.pendingCount, 0);

    for (const p of ['today', '7d', '30d', 'all']) {
      assert.equal(latest.periods[p].conversationsCount, oneShot.periods[p].conversationsCount);
      assert.equal(latest.periods[p].stepsCount, oneShot.periods[p].stepsCount);
      assert.equal(latest.periods[p].inputTokens, oneShot.periods[p].inputTokens);
      assert.equal(latest.periods[p].cacheReadTokens, oneShot.periods[p].cacheReadTokens);
      assert.equal(latest.periods[p].outputTokens, oneShot.periods[p].outputTokens);
      assert.equal(latest.periods[p].totalTokens, oneShot.periods[p].totalTokens);
      assert.ok(Math.abs(latest.periods[p].costActual - oneShot.periods[p].costActual) < 1e-9);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('standalone HTTP E2E cold-start chunked sync, corrupt DB resilience, and fast /_sidecar/get-conversation-metadata', async () => {
  const { root, appData } = makeTempEnv();
  const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(dataDir, { recursive: true });
  const convsDir = join(appData, 'conversations');
  mkdirSync(convsDir, { recursive: true });
  const fakeHome = join(root, 'home');
  mkdirSync(fakeHome, { recursive: true });

  const baseMs = Date.parse('2026-11-17T08:00:00Z');
  let latestConvId = '';
  for (let i = 0; i < 30; i++) {
    const hex = (i + 1).toString(16).padStart(2, '0');
    const cid = `e2e000${hex}-0000-4000-8000-0000000000${hex}`;
    if (i === 29) latestConvId = cid;
    const ts = new Date(baseMs + i * 10000).toISOString();
    writeConversation(appData, cid, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: ts,
          content: `<USER_REQUEST>Cold start ${i}</USER_REQUEST>\n<USER_SETTINGS_CHANGE>Model Selection from None to Gemini 3.1 Pro (High)</USER_SETTINGS_CHANGE>`,
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: ts,
          input_tokens: 1000,
          cache_read_tokens: 2000,
          output_tokens: 100,
          tool_calls: [],
        },
      ],
      mtimeMs: baseMs + i * 10000 + 500,
    });
  }
  const corruptId = 'e2e0bad0-0000-4000-8000-000000000bad';
  const corruptDbPath = join(convsDir, `${corruptId}.db`);
  writeFileSync(corruptDbPath, Buffer.from('BAD_SQLITE_HEADER'));
  utimesSync(corruptDbPath, (baseMs - 5000) / 1000, (baseMs - 5000) / 1000);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
  const sdkFallback = join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs');
  const port = 19844;

  const env = { ...process.env };
  delete env.ANTIGRAVITY_LS_ADDRESS;
  delete env.ANTIGRAVITY_CSRF_TOKEN;
  delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
  delete env.ANTIGRAVITY_CONVERSATION_ID;
  delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
  delete env.ANTIGRAVITY_AGENTAPI_EXE;
  if (existsSync(sdkFallback)) {
    env.SIDECAR_SDK_PATH = sdkFallback;
  }
  env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
  env.USERPROFILE = fakeHome;
  env.HOME = fakeHome;
  env.PRICING_SYNC_DISABLE_AUTO = '1';

  const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });

    const base = `http://127.0.0.1:${port}`;
    const snapRes = await fetch(`${base}/api/snapshot`);
    assert.equal(snapRes.status, 200);
    let snap = await snapRes.json();
    assert.equal(snap.unchanged, false);
    assert.equal(typeof snap.global?.ledgerSync?.syncing, 'boolean');
    assert.equal(snap.global.ledgerSync.syncing, true);
    assert.equal(snap.global.ledgerSync.pendingCount, 6);
    assert.equal(snap.global.ledgerSync.onDiskCount, 31);
    assert.equal(snap.current?.conversationId, latestConvId);

    // Background ledger pump should finish syncing all 31 conversations cleanly without HTTP 500
    for (let attempt = 0; attempt < 40 && snap.global?.ledgerSync?.syncing; attempt++) {
      await new Promise((r) => setTimeout(r, 50));
      const pollRes = await fetch(`${base}/api/snapshot`);
      assert.equal(pollRes.status, 200);
      snap = await pollRes.json();
    }
    assert.equal(snap.global.ledgerSync.syncing, false);
    assert.equal(snap.global.ledgerSync.pendingCount, 0);
    assert.equal(snap.global.ledgerSync.onDiskCount, 31);
    assert.equal(snap.global.periods.all.conversationsCount, 30);

    // Explicitly querying the corrupt DB conversation returns HTTP 200 (current: null), never HTTP 500
    const badSnapRes = await fetch(`${base}/api/snapshot?conv=${encodeURIComponent(corruptId)}`);
    assert.equal(badSnapRes.status, 200);
    const badSnap = await badSnapRes.json();
    assert.equal(badSnap.current, null);

    // /_sidecar/get-conversation-metadata fast-path responds HTTP 200 quickly without agentapi
    const t0 = Date.now();
    const metaRes = await fetch(`${base}/_sidecar/get-conversation-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: latestConvId }),
    });
    const elapsedMs = Date.now() - t0;
    assert.equal(metaRes.status, 200);
    const metaJson = await metaRes.json();
    assert.ok(metaJson?.response?.conversationMetadata);
    assert.ok(elapsedMs < 2000, `Expected fast response without agentapi, took ${elapsedMs}ms`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('app.js static polling safety: serial polling, zero requestSeq, I18N parity, and zero unsafe DOM calls', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const appSource = readFileSync(join(testDir, '..', 'sidecars', 'monitor_pane', 'app.js'), 'utf-8');

  assert.equal(/setInterval\s*\([^)]*pollSnapshot/.test(appSource), false);
  assert.equal(appSource.includes('if (seq !== state.requestSeq'), false);
  assert.equal(/\brequestSeq\b/.test(appSource), false);
  assert.ok(appSource.includes('POLL_TIMEOUT_MS'));
  assert.ok(appSource.includes('state.convEpoch'));
  assert.equal(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(appSource), false);

  const zhStart = appSource.indexOf('const I18N = {');
  assert.ok(zhStart >= 0, 'I18N object should exist in app.js');
  const zhBlockMatch = appSource
    .slice(zhStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(zhBlockMatch, 'Both zh and en blocks should be extractable from I18N');

  const extractKeys = (block) => [...block.matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]);
  const zhKeys = extractKeys(zhBlockMatch[1]);
  const enKeys = extractKeys(zhBlockMatch[2]);
  assert.ok(zhKeys.includes('common.backendTimeout'));
  assert.ok(enKeys.includes('common.backendTimeout'));
  assert.deepEqual([...zhKeys].sort(), [...enKeys].sort());
});
// ============================================================================
// [MODIFIED END] 2026-11-17 17:27:07
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:54:00
// Description: Add v0.2.4 unit and standalone HTTP E2E tests for release_updater
// semver comparison & tag normalization, buildZipBuffer/parseZipBuffer prefix
// stripping & Zip-Slip rejection, SHA-256/manifest/.git guards, ETag 304 Not
// Modified cache preservation, and end-to-end skip + hot-update preserving user prefs.
// ============================================================================
test('release_updater semver parsing, comparison, and release tag normalization', () => {
  const parsed = parseSemver('v0.2.5');
  assert.ok(parsed);
  assert.equal(parsed.major, 0);
  assert.equal(parsed.minor, 2);
  assert.equal(parsed.patch, 5);

  const parsedBeta = parseSemver('V0.2.5-beta.1');
  assert.ok(parsedBeta);
  assert.equal(parsedBeta.major, 0);
  assert.equal(parsedBeta.minor, 2);
  assert.equal(parsedBeta.patch, 5);
  assert.equal(parseSemver('not-a-semver'), null);

  assert.equal(compareSemver('v0.2.5', '0.2.4'), 1);
  assert.equal(compareSemver('0.2.4', 'v0.2.5'), -1);
  assert.equal(compareSemver('0.2.5', '0.2.5-beta.1'), 1);
  assert.equal(compareSemver('0.2.5-beta.1', '0.2.5'), -1);
  assert.equal(compareSemver('0.2.5-beta.1', '0.2.4'), 1);
  assert.equal(compareSemver('v0.2.4', '0.2.4'), 0);
  assert.equal(compareSemver('0.10.0', '0.2.9'), 1);

  assert.equal(normalizeReleaseTag('V0.2.5'), 'v0.2.5');
  assert.equal(normalizeReleaseTag('0.2.5'), 'v0.2.5');
  assert.equal(normalizeReleaseTag('  v0.2.5  '), 'v0.2.5');
  assert.equal(normalizeReleaseTag(''), '');
  assert.equal(DEFAULT_PREFS.skippedReleaseTag, '');
});

test('buildZipBuffer & parseZipBuffer round-trip prefix stripping and Zip-Slip / path-whitelist guards', () => {
  const manifestStr = JSON.stringify({ name: 'agy-token-monitor', version: '0.2.5' }, null, 2);
  const readmeStr = '# Token Monitor v0.2.5\n\n## 中文\n- 极速热更新校验\n';
  const mainStr = 'console.log("token-monitor-v0.2.5");\n';

  const zipBuf = buildZipBuffer([
    { name: 'agy-token-monitor/plugin.json', data: manifestStr },
    { name: 'agy-token-monitor/README.md', data: readmeStr },
    { name: 'agy-token-monitor/sidecars/monitor_pane/main.mjs', data: Buffer.from(mainStr, 'utf-8') },
  ]);
  assert.ok(Buffer.isBuffer(zipBuf));
  assert.ok(zipBuf.length > 0);

  const extracted = parseZipBuffer(zipBuf);
  const byRel = new Map(extracted.map((e) => [e.relPath, e.data.toString('utf-8')]));
  assert.deepEqual([...byRel.keys()].sort(), [
    'README.md',
    'plugin.json',
    'sidecars/monitor_pane/main.mjs',
  ]);
  assert.equal(byRel.get('plugin.json'), manifestStr);
  assert.equal(byRel.get('README.md'), readmeStr);
  assert.equal(byRel.get('sidecars/monitor_pane/main.mjs'), mainStr);

  // Zip-Slip, absolute path, Windows drive, .git, and unmanaged top-level directory rejections
  const forbiddenPaths = [
    '../evil.mjs',
    'agy-token-monitor/../evil.mjs',
    '/abs/path',
    'C:\\evil',
    '.git/config',
    'agy-token-monitor/.git/config',
    'unmanaged_dir/foo.txt',
    'agy-token-monitor/unmanaged_dir/foo.txt',
    'sidecar_data/monitor_state.json',
    'plugin.json\0.txt',
  ];
  for (const badName of forbiddenPaths) {
    const badZip = buildZipBuffer([{ name: badName, data: 'forbidden' }]);
    assert.throws(() => parseZipBuffer(badZip), `Expected parseZipBuffer to reject "${badName}"`);
  }

  // Archive entry-count cap guard
  assert.throws(() => parseZipBuffer(zipBuf, { maxEntries: 2 }));
});

test('createReleaseUpdater enforces .git guard, SHA-256 integrity, plugin.json manifest checks, and ETag 304 caching', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tm-release-updater-guards-'));
  try {
    const validZip025 = buildZipBuffer([
      {
        name: 'agy-token-monitor/plugin.json',
        data: JSON.stringify({ name: 'agy-token-monitor', version: '0.2.5' }),
      },
      { name: 'agy-token-monitor/sidecars/monitor_pane/main.mjs', data: '// v0.2.5\n' },
    ]);
    const validSha025 = createHash('sha256').update(validZip025).digest('hex');
    const ghAssetUrl =
      'https://github.com/JefferyL1ang/agy-token-monitor/releases/download/v0.2.5/agy-token-monitor-v0.2.5.zip';
    const ghHtmlUrl = 'https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/v0.2.5';

    const buildReleasePayload = ({ tag = 'v0.2.5', digest = `sha256:${validSha025}`, size = validZip025.length, body = '## English\n- Notes' } = {}) => ({
      tag_name: tag,
      name: `Release ${tag}`,
      published_at: '2026-11-17T10:00:00Z',
      html_url: ghHtmlUrl,
      body,
      assets: [
        {
          name: `agy-token-monitor-${tag}.zip`,
          size,
          digest,
          browser_download_url: ghAssetUrl,
        },
      ],
    });

    // 1. Refuses overwriting a directory containing .git when allowGitRepoOverwrite is false
    const gitPluginRoot = join(root, 'plugin-with-git');
    const gitStateDir = join(root, 'state-git');
    mkdirSync(join(gitPluginRoot, '.git'), { recursive: true });
    writeFileSync(
      join(gitPluginRoot, 'plugin.json'),
      JSON.stringify({ name: 'agy-token-monitor', version: '0.2.4' }),
      'utf-8',
    );
    const gitUpdater = createReleaseUpdater({
      stateDir: gitStateDir,
      pluginRoot: gitPluginRoot,
      currentVersion: '0.2.4',
      allowGitRepoOverwrite: false,
      fetchImpl: async (url) => {
        if (String(url).includes('/releases/latest')) {
          return new Response(JSON.stringify(buildReleasePayload()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(validZip025, { status: 200 });
      },
    });
    const gitRes = await gitUpdater.applyLatestUpdate();
    assert.equal(gitRes.ok, false);
    assert.equal(gitRes.reason, 'git_repo');
    assert.ok(typeof gitRes.fallbackUrl === 'string' && gitRes.fallbackUrl.startsWith('https://github.com/'));

    // 2. Rejects SHA-256 digest mismatch with reason === 'integrity_failed'
    const cleanPluginRoot = join(root, 'plugin-clean');
    mkdirSync(join(cleanPluginRoot, 'sidecars', 'monitor_pane'), { recursive: true });
    writeFileSync(
      join(cleanPluginRoot, 'plugin.json'),
      JSON.stringify({ name: 'agy-token-monitor', version: '0.2.4' }),
      'utf-8',
    );
    writeFileSync(join(cleanPluginRoot, 'sidecars', 'monitor_pane', 'main.mjs'), '// v0.2.4\n', 'utf-8');

    const badDigestUpdater = createReleaseUpdater({
      stateDir: join(root, 'state-bad-digest'),
      pluginRoot: cleanPluginRoot,
      currentVersion: '0.2.4',
      fetchImpl: async (url) => {
        if (String(url).includes('/releases/latest')) {
          return new Response(
            JSON.stringify(buildReleasePayload({ digest: `sha256:${'0'.repeat(64)}` })),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(validZip025, { status: 200 });
      },
    });
    const badDigestRes = await badDigestUpdater.applyLatestUpdate();
    assert.equal(badDigestRes.ok, false);
    assert.equal(badDigestRes.reason, 'integrity_failed');
    assert.equal(JSON.parse(readFileSync(join(cleanPluginRoot, 'plugin.json'), 'utf-8')).version, '0.2.4');

    // 3. Rejects archive missing plugin.json even when SHA-256 matches
    const missingManifestZip = buildZipBuffer([
      { name: 'agy-token-monitor/sidecars/monitor_pane/main.mjs', data: '// missing plugin.json\n' },
    ]);
    const missingManifestSha = createHash('sha256').update(missingManifestZip).digest('hex');
    const missingManifestUpdater = createReleaseUpdater({
      stateDir: join(root, 'state-no-manifest'),
      pluginRoot: cleanPluginRoot,
      currentVersion: '0.2.4',
      fetchImpl: async (url) => {
        if (String(url).includes('/releases/latest')) {
          return new Response(
            JSON.stringify(
              buildReleasePayload({
                digest: `sha256:${missingManifestSha}`,
                size: missingManifestZip.length,
              }),
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(missingManifestZip, { status: 200 });
      },
    });
    const missingManifestRes = await missingManifestUpdater.applyLatestUpdate();
    assert.equal(missingManifestRes.ok, false);
    assert.equal(JSON.parse(readFileSync(join(cleanPluginRoot, 'plugin.json'), 'utf-8')).version, '0.2.4');

    // 4. Rejects downgrade plugin.json (version 0.2.3 <= 0.2.4) even when tag_name is v0.2.5 and SHA-256 matches
    const downgradeZip = buildZipBuffer([
      {
        name: 'agy-token-monitor/plugin.json',
        data: JSON.stringify({ name: 'agy-token-monitor', version: '0.2.3' }),
      },
      { name: 'agy-token-monitor/sidecars/monitor_pane/main.mjs', data: '// downgrade\n' },
    ]);
    const downgradeSha = createHash('sha256').update(downgradeZip).digest('hex');
    const downgradeUpdater = createReleaseUpdater({
      stateDir: join(root, 'state-downgrade'),
      pluginRoot: cleanPluginRoot,
      currentVersion: '0.2.4',
      fetchImpl: async (url) => {
        if (String(url).includes('/releases/latest')) {
          return new Response(
            JSON.stringify(
              buildReleasePayload({
                digest: `sha256:${downgradeSha}`,
                size: downgradeZip.length,
              }),
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(downgradeZip, { status: 200 });
      },
    });
    const downgradeRes = await downgradeUpdater.applyLatestUpdate();
    assert.equal(downgradeRes.ok, false);
    assert.equal(JSON.parse(readFileSync(join(cleanPluginRoot, 'plugin.json'), 'utf-8')).version, '0.2.4');

    // 5. ETag 304 Not Modified preserves cached latestTag, hasUpdate, and releaseNotes without re-downloading
    let nowMs = 1_760_000_000_000;
    let apiCalls = 0;
    let zipDownloads = 0;
    let capturedIfNoneMatch = '';
    const notesText = '## English\n- Cached notes preserved\n\n## 中文\n- 保留缓存更新日志';
    const etagStateDir = join(root, 'state-etag');

    const etagUpdater = createReleaseUpdater({
      stateDir: etagStateDir,
      pluginRoot: cleanPluginRoot,
      currentVersion: '0.2.4',
      nowFn: () => nowMs,
      fetchImpl: async (url, init = {}) => {
        if (String(url).includes('/releases/latest')) {
          apiCalls += 1;
          const rawHeaders = init.headers || {};
          if (rawHeaders instanceof Headers) {
            capturedIfNoneMatch = rawHeaders.get('if-none-match') || '';
          } else {
            const matchEntry = Object.entries(rawHeaders).find(
              ([k]) => k.toLowerCase() === 'if-none-match',
            );
            capturedIfNoneMatch = matchEntry ? String(matchEntry[1]) : '';
          }
          if (apiCalls === 1) {
            return new Response(JSON.stringify(buildReleasePayload({ body: notesText })), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ETag: '"etag-v025-cached"',
              },
            });
          }
          return new Response(null, {
            status: 304,
            headers: { ETag: '"etag-v025-cached"' },
          });
        }
        zipDownloads += 1;
        return new Response(validZip025, { status: 200 });
      },
    });

    const firstCheck = await etagUpdater.checkForUpdatesNow();
    assert.equal(firstCheck.ok, true);
    assert.equal(firstCheck.status.latestTag, 'v0.2.5');
    assert.equal(firstCheck.status.hasUpdate, true);
    assert.equal(firstCheck.status.releaseNotes, notesText);
    assert.equal(zipDownloads, 0);

    nowMs += 5 * 60 * 60 * 1000;
    const secondCheck = await etagUpdater.checkForUpdatesNow();
    assert.equal(secondCheck.ok, true);
    assert.equal(apiCalls, 2);
    assert.equal(capturedIfNoneMatch, '"etag-v025-cached"');
    assert.equal(zipDownloads, 0);

    const statusAfter304 = etagUpdater.getPublicStatus();
    assert.equal(statusAfter304.latestTag, 'v0.2.5');
    assert.equal(statusAfter304.hasUpdate, true);
    assert.equal(statusAfter304.releaseNotes, notesText);
    assert.equal(statusAfter304.lastCheckedAtMs, nowMs);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('standalone HTTP E2E hot-update lifecycle: check-update, skip-version, next-release unskip, and SHA-256 apply-update preserving user prefs', async () => {
  const { root, appData } = makeTempEnv();
  const tempStateDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(tempStateDir, { recursive: true });
  const fakeHome = join(root, 'home');
  mkdirSync(fakeHome, { recursive: true });

  // Pre-seed custom user preferences in tempStateDir/monitor_state.json
  writeFileSync(
    join(tempStateDir, 'monitor_state.json'),
    JSON.stringify(
      {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Seed pre-upgrade prefsSchemaVersion: 4 in hot-update E2E test.
// ============================================================================
        prefsSchemaVersion: 4,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
        stepEndTimes: {},
        prefs: {
          ...DEFAULT_PREFS,
          currency: 'CNY',
          cnyRateMode: 'manual',
          cnyRate: 7.18,
          tokenUnit: 'exact',
        },
      },
      null,
      2,
    ),
    'utf-8',
  );

  // Copy current plugin files into isolated tempPluginDir (NO .git folder!)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(__dirname, '..');
  const tempPluginDir = join(root, 'temp-plugin');
  mkdirSync(tempPluginDir, { recursive: true });
  cpSync(join(repoRoot, 'plugin.json'), join(tempPluginDir, 'plugin.json'));
  cpSync(join(repoRoot, 'README.md'), join(tempPluginDir, 'README.md'));
  cpSync(join(repoRoot, 'assets'), join(tempPluginDir, 'assets'), { recursive: true });
  cpSync(join(repoRoot, 'skills'), join(tempPluginDir, 'skills'), { recursive: true });
  cpSync(
    join(repoRoot, 'sidecars', 'monitor_pane'),
    join(tempPluginDir, 'sidecars', 'monitor_pane'),
    { recursive: true },
  );
  assert.equal(existsSync(join(tempPluginDir, '.git')), false);

  const sidecarDir = join(tempPluginDir, 'sidecars', 'monitor_pane');
  const origPluginJson = JSON.parse(readFileSync(join(tempPluginDir, 'plugin.json'), 'utf-8'));
  const origReadme = readFileSync(join(tempPluginDir, 'README.md'), 'utf-8');
  const sidecarFiles = readdirSync(sidecarDir);

  function buildReleaseBundle(version, notesBody) {
    const entries = [
      {
        name: 'agy-token-monitor/plugin.json',
        data: JSON.stringify({ ...origPluginJson, version }, null, 2) + '\n',
      },
      {
        name: 'agy-token-monitor/README.md',
        data: `${origReadme}\n<!-- release-${version} -->\n`,
      },
    ];
    for (const file of sidecarFiles) {
      const fullPath = join(sidecarDir, file);
      const rawBuf = readFileSync(fullPath);
      if (file === 'main.mjs') {
        const markedMain = `// HOT_UPDATE_E2E_MARKER_${version}\n${rawBuf.toString('utf-8')}`;
        entries.push({
          name: `agy-token-monitor/sidecars/monitor_pane/${file}`,
          data: Buffer.from(markedMain, 'utf-8'),
        });
      } else {
        entries.push({
          name: `agy-token-monitor/sidecars/monitor_pane/${file}`,
          data: rawBuf,
        });
      }
    }
    const zipBuf = buildZipBuffer(entries);
    const sha256Hex = createHash('sha256').update(zipBuf).digest('hex');
    return { version, tag: `v${version}`, notesBody, zipBuf, sha256Hex };
  }

  let activeBundle = buildReleaseBundle(
    '0.9.9',
    '## English\n- Fast update\n\n## 中文\n- 极速热更新',
  );
  let mockPort = 0;

  const mockServer = createServer((req, res) => {
    if (req.url === '/releases/latest') {
      const payload = {
        tag_name: activeBundle.tag,
        name: `Token Monitor ${activeBundle.tag}`,
        published_at: '2026-11-17T10:30:00Z',
        html_url: `https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/${activeBundle.tag}`,
        body: activeBundle.notesBody,
        assets: [
          {
            name: `agy-token-monitor-${activeBundle.tag}.zip`,
            size: activeBundle.zipBuf.length,
            digest: `sha256:${activeBundle.sha256Hex}`,
            browser_download_url: `http://127.0.0.1:${mockPort}/asset.zip`,
          },
        ],
      };
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: `"etag-${activeBundle.tag}"`,
      });
      res.end(JSON.stringify(payload));
      return;
    }
    if (req.url === '/asset.zip') {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': String(activeBundle.zipBuf.length),
      });
      res.end(activeBundle.zipBuf);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:42:45
// Description: Ensure mock update server and standalone sidecar avoid WHATWG Fetch blocked ports.
// ============================================================================
  mockPort = await listenOnFetchSafePort(mockServer);

  // Pick an ephemeral fetch-safe free port for standalone sidecar
  const sidecarPort = await pickFetchSafeFreePort();
// ============================================================================
// [MODIFIED END] 2026-11-17 21:42:45
// ============================================================================

  const sdkCandidates = [
    join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
  ].filter((p) => existsSync(p));

  const env = { ...process.env };
  delete env.ANTIGRAVITY_LS_ADDRESS;
  delete env.ANTIGRAVITY_CSRF_TOKEN;
  delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
  delete env.ANTIGRAVITY_CONVERSATION_ID;
  delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
  delete env.ANTIGRAVITY_AGENTAPI_EXE;
  delete env.ENABLE_STANDALONE_UPDATE_EXIT;
  if (sdkCandidates[0]) {
    env.SIDECAR_SDK_PATH = sdkCandidates[0];
  }
  env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = tempStateDir;
  env.RELEASE_UPDATE_API_URL = `http://127.0.0.1:${mockPort}/releases/latest`;
  env.RELEASE_UPDATE_ALLOW_LOOPBACK = '1';
  env.PRICING_SYNC_DISABLE_AUTO = '1';
  env.USERPROFILE = fakeHome;
  env.HOME = fakeHome;

  const tempMainPath = join(sidecarDir, 'main.mjs');
  const child = spawn(process.execPath, [tempMainPath, '--standalone', String(sidecarPort)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${sidecarPort}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });

    const base = `http://127.0.0.1:${sidecarPort}`;

    // a) POST /api/check-update detects v0.9.9 and prompts user
    const check1Res = await fetch(`${base}/api/check-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(check1Res.status, 200);
    const check1 = await check1Res.json();
    assert.equal(check1.ok, true);
    assert.equal(check1.updateStatus.hasUpdate, true);
    assert.equal(check1.updateStatus.latestTag, 'v0.9.9');
    assert.equal(check1.updateStatus.isSkipped, false);
    assert.equal(check1.updateStatus.shouldPrompt, true);
    assert.ok(check1.updateStatus.releaseNotes.includes('极速热更新'));

    // b) POST /api/prefs with { skippedReleaseTag: 'v0.9.9' } -> snapshot suppresses prompt
    const skipRes = await fetch(`${base}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skippedReleaseTag: 'v0.9.9' }),
    });
    assert.equal(skipRes.status, 200);
    const skipBody = await skipRes.json();
    assert.equal(skipBody.ok, true);
    assert.equal(skipBody.prefs.skippedReleaseTag, 'v0.9.9');

    const snapSkippedRes = await fetch(`${base}/api/snapshot`);
    assert.equal(snapSkippedRes.status, 200);
    const snapSkipped = await snapSkippedRes.json();
    assert.equal(snapSkipped.updateStatus.hasUpdate, true);
    assert.equal(snapSkipped.updateStatus.isSkipped, true);
    assert.equal(snapSkipped.updateStatus.shouldPrompt, false);
    assert.equal(snapSkipped.prefs.cnyRate, 7.18);

    // c) Advance mock server to v0.10.0 -> check-update prompts again (v0.10.0 !== skipped v0.9.9)
    activeBundle = buildReleaseBundle(
      '0.10.0',
      '## English\n- Next release v0.10.0\n\n## 中文\n- 下一版本 v0.10.0 热更新',
    );
    const check2Res = await fetch(`${base}/api/check-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(check2Res.status, 200);
    const check2 = await check2Res.json();
    assert.equal(check2.ok, true);
    assert.equal(check2.updateStatus.latestTag, 'v0.10.0');
    assert.equal(check2.updateStatus.hasUpdate, true);
    assert.equal(check2.updateStatus.isSkipped, false);
    assert.equal(check2.updateStatus.shouldPrompt, true);

    // d) POST /api/apply-update verifies SHA-256, writes v0.10.0 to tempPluginDir, clears skippedReleaseTag, preserves cnyRate=7.18
    const applyRes = await fetch(`${base}/api/apply-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(applyRes.status, 200);
    const applyBody = await applyRes.json();
    assert.equal(applyBody.ok, true);
    assert.equal(applyBody.targetVersion, '0.10.0');

    const updatedManifest = JSON.parse(readFileSync(join(tempPluginDir, 'plugin.json'), 'utf-8'));
    assert.equal(updatedManifest.version, '0.10.0');

    const updatedMainSource = readFileSync(tempMainPath, 'utf-8');
    assert.ok(updatedMainSource.includes('// HOT_UPDATE_E2E_MARKER_0.10.0'));

    const persistedState = JSON.parse(readFileSync(join(tempStateDir, 'monitor_state.json'), 'utf-8'));
    assert.equal(persistedState.prefs.skippedReleaseTag, '');
    assert.equal(persistedState.prefs.currency, 'CNY');
    assert.equal(persistedState.prefs.cnyRateMode, 'manual');
    assert.equal(persistedState.prefs.cnyRate, 7.18);
    assert.equal(persistedState.prefs.tokenUnit, 'exact');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
    await new Promise((r) => mockServer.close(() => r()));
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-17 18:54:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 20:28:05
// Description: Add v0.2.5 regression tests for 14-day subscription window
// isolation and active-date fallback, modelSortBy/modelSortDir/jio_pro prefs
// validation & persistence in standalone main.mjs, and frontend static/DOM/I18N parity.
// ============================================================================
test('v0.2.5 14-day subscription window isolates historical models and falls back to latest 14 active dates', () => {
  clearParserCache();
  const nowMs = Date.parse('2026-11-17T12:00:00Z');
  const writeModelSession = (appData, convId, isoTs, modelSlug, tokens = 1000) => {
    writeConversation(appData, convId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: isoTs,
          content: `<USER_REQUEST>Session ${convId}</USER_REQUEST>\n<USER_SETTINGS_CHANGE>The user changed setting \`Model Selection\` from None to ${modelSlug}.</USER_SETTINGS_CHANGE>`,
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: isoTs,
          input_tokens: tokens,
          cache_read_tokens: 0,
          output_tokens: 100,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse(isoTs) + 1000,
    });
  };

  // Part A: 30-day-old Carbon/Opus-4.6 must NOT pollute recent 14-day Jio AI Pro sessions
  const { root, appData } = makeTempEnv();
  try {
    writeModelSession(appData, '14d00001-0000-4000-8000-000000000001', '2026-10-05T12:00:00Z', 'gemini-4-carbon');
    writeModelSession(appData, '14d00002-0000-4000-8000-000000000002', '2026-10-05T14:00:00Z', 'claude-opus-4-6');
    writeModelSession(appData, '14d00003-0000-4000-8000-000000000003', '2026-11-16T12:00:00Z', 'gemini-3.8-flash-control');
    writeModelSession(appData, '14d00004-0000-4000-8000-000000000004', '2026-11-17T08:00:00Z', 'gpt-oss-120b');

    const gJio = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, disableAgentApi: true });
    assert.equal(gJio.subscription.planId, 'jio_pro');
    assert.equal(gJio.subscription.monthlyUsd, 0);
    assert.equal(gJio.subscription.isAutoDetected, true);

    // Adding a recent session using Argon -> 'pro' ($19.99/mo)
    writeModelSession(appData, '14d00005-0000-4000-8000-000000000005', '2026-11-17T09:00:00Z', 'gemini-4-argon');
    const gProArgon = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, disableAgentApi: true });
    assert.equal(gProArgon.subscription.planId, 'pro');
    assert.equal(gProArgon.subscription.monthlyUsd, 19.99);

    // Adding a recent session using Claude Opus 5.5 (without Carbon) -> still 'pro' ($19.99/mo)
    writeModelSession(appData, '14d00006-0000-4000-8000-000000000006', '2026-11-17T09:30:00Z', 'claude-opus-5-5');
    const gProOpus = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, disableAgentApi: true });
    assert.equal(gProOpus.subscription.planId, 'pro');
    assert.equal(gProOpus.subscription.monthlyUsd, 19.99);

    // Adding a recent session using Carbon -> 'ultra_5x' ($99.99/mo)
    writeModelSession(appData, '14d00007-0000-4000-8000-000000000007', '2026-11-17T10:00:00Z', 'gemini-4-carbon');
    const gUltra = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs, disableAgentApi: true });
    assert.equal(gUltra.subscription.planId, 'ultra_5x');
    assert.equal(gUltra.subscription.monthlyUsd, 99.99);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  // Part B: All conversations older than 14 days -> falls back to latest 14 active dates only
  const { root: rootOld, appData: appDataOld } = makeTempEnv();
  try {
    // 15th oldest active date used Carbon, while latest 14 active dates (Oct 10..23) only used Flash/Argon
    writeModelSession(appDataOld, '14d10000-0000-4000-8000-000000000000', '2026-09-10T12:00:00Z', 'gemini-4-carbon');
    for (let day = 10; day <= 23; day++) {
      const hex = day.toString(16).padStart(2, '0');
      const model = day === 23 ? 'gemini-4-argon' : 'gemini-3.8-flash-control';
      writeModelSession(
        appDataOld,
        `14d100${hex}-0000-4000-8000-0000000000${hex}`,
        `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`,
        model,
      );
    }
    const gFallback14 = summarizeGlobalAndRecent({ appDataDirs: [appDataOld], nowMs, disableAgentApi: true });
    assert.equal(gFallback14.subscription.planId, 'pro');
    assert.equal(gFallback14.subscription.monthlyUsd, 19.99);
  } finally {
    rmSync(rootOld, { recursive: true, force: true });
  }

  // Part C: Only 1 old conversation (>14 days) using Carbon -> fallback uses that active date -> 'ultra_5x'
  const { root: rootSingleOld, appData: appDataSingleOld } = makeTempEnv();
  try {
    writeModelSession(
      appDataSingleOld,
      '14d20001-0000-4000-8000-000000000001',
      '2026-10-05T12:00:00Z',
      'gemini-4-carbon',
    );
    const gFallbackSingle = summarizeGlobalAndRecent({ appDataDirs: [appDataSingleOld], nowMs, disableAgentApi: true });
    assert.equal(gFallbackSingle.subscription.planId, 'ultra_5x');
    assert.equal(gFallbackSingle.subscription.monthlyUsd, 99.99);
  } finally {
    rmSync(rootSingleOld, { recursive: true, force: true });
  }
});

test('v0.2.5 preferences & standalone /api/prefs validation for jio_pro, modelSortBy, and modelSortDir', async () => {
  assert.equal(DEFAULT_PREFS.modelSortBy, 'cost');
  assert.equal(DEFAULT_PREFS.modelSortDir, 'desc');
  assert.deepEqual([...VALID_MODEL_SORT_KEYS], ['cost', 'total']);
  assert.deepEqual([...VALID_MODEL_SORT_DIRS], ['desc', 'asc']);

  const { root, appData } = makeTempEnv();
  const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(dataDir, { recursive: true });
  const fakeHome = join(root, 'home');
  mkdirSync(fakeHome, { recursive: true });

  const nowMs = Date.now();
  const oldIso = new Date(nowMs - 30 * 86400 * 1000).toISOString();
  const recentIso = new Date(nowMs - 60 * 1000).toISOString();

  writeConversation(appData, 'f0250001-0000-4000-8000-000000000001', {
    compactLines: [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: oldIso,
        content:
          '<USER_REQUEST>Old Carbon session</USER_REQUEST>\n<USER_SETTINGS_CHANGE>Model Selection from None to gemini-4-carbon.</USER_SETTINGS_CHANGE>',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: oldIso,
        input_tokens: 1000,
        cache_read_tokens: 0,
        output_tokens: 100,
        tool_calls: [],
      },
    ],
    mtimeMs: Date.parse(oldIso) + 500,
  });

  writeConversation(appData, 'f0250002-0000-4000-8000-000000000002', {
    compactLines: [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: recentIso,
        content:
          '<USER_REQUEST>Recent Flash Control session</USER_REQUEST>\n<USER_SETTINGS_CHANGE>Model Selection from None to gemini-3.8-flash-control.</USER_SETTINGS_CHANGE>',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: recentIso,
        input_tokens: 2000,
        cache_read_tokens: 1000,
        output_tokens: 200,
        tool_calls: [],
      },
    ],
    mtimeMs: Date.parse(recentIso) + 500,
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
  const sdkCandidates = [
    join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
  ].filter((p) => existsSync(p));

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:42:45
// Description: Use pickFetchSafeFreePort to avoid flaky WHATWG bad port rejections in fetch().
// ============================================================================
  async function pickFreePort() {
    return pickFetchSafeFreePort();
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:42:45
// ============================================================================

  async function spawnStandalone(port) {
    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    delete env.ANTIGRAVITY_AGENTAPI_EXE;
    if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.PRICING_SYNC_DISABLE_AUTO = '1';
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;

    const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });
    return child;
  }

  async function stopStandalone(child) {
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
  }

  let child1 = null;
  let child2 = null;
  try {
    const port1 = await pickFreePort();
    child1 = await spawnStandalone(port1);
    const base1 = `http://127.0.0.1:${port1}`;

    const initialSnap = await (await fetch(`${base1}/api/snapshot`)).json();
    assert.equal(initialSnap.prefs.modelSortBy, 'cost');
    assert.equal(initialSnap.prefs.modelSortDir, 'desc');
    assert.equal(initialSnap.global.subscription.planId, 'jio_pro');
    assert.equal(initialSnap.global.subscription.monthlyUsd, 0);
    assert.equal(initialSnap.current.subscription.planId, 'jio_pro');

    const badSortKey = await fetch(`${base1}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelSortBy: 'tokens' }),
    });
    assert.equal(badSortKey.status, 400);

    const badSortDir = await fetch(`${base1}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelSortDir: 'sideways' }),
    });
    assert.equal(badSortDir.status, 400);

    const validPrefsRes = await fetch(`${base1}/api/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionPlan: 'jio_pro',
        modelSortBy: 'total',
        modelSortDir: 'asc',
      }),
    });
    assert.equal(validPrefsRes.status, 200);
    const validPrefsBody = await validPrefsRes.json();
    assert.equal(validPrefsBody.ok, true);
    assert.equal(validPrefsBody.prefs.subscriptionPlan, 'jio_pro');
    assert.equal(validPrefsBody.prefs.modelSortBy, 'total');
    assert.equal(validPrefsBody.prefs.modelSortDir, 'asc');

    const stateJson = JSON.parse(readFileSync(join(dataDir, 'monitor_state.json'), 'utf-8'));
    assert.equal(stateJson.prefs.subscriptionPlan, 'jio_pro');
    assert.equal(stateJson.prefs.modelSortBy, 'total');
    assert.equal(stateJson.prefs.modelSortDir, 'asc');

    await stopStandalone(child1);
    child1 = null;

    const port2 = await pickFreePort();
    child2 = await spawnStandalone(port2);
    const base2 = `http://127.0.0.1:${port2}`;
    const restartedSnap = await (await fetch(`${base2}/api/snapshot`)).json();
    assert.equal(restartedSnap.prefs.subscriptionPlan, 'jio_pro');
    assert.equal(restartedSnap.prefs.modelSortBy, 'total');
    assert.equal(restartedSnap.prefs.modelSortDir, 'asc');
    assert.equal(restartedSnap.global.subscription.planId, 'jio_pro');
    assert.equal(restartedSnap.global.subscription.isAutoDetected, false);
  } finally {
    await stopStandalone(child1);
    await stopStandalone(child2);
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.5 frontend static contracts, I18N key/placeholder parity, and DOM safety', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');

  const bannedTerm = '\u6c34\u4f4d';

  // index.html contracts
  assert.equal(indexHtml.includes('tab-today-badge'), false);
  assert.equal(indexHtml.includes('<option value="jio_pro"'), true);
  assert.equal(indexHtml.includes(bannedTerm), false);

  // styles.css contracts
  assert.equal(/\.tab-badge\b/.test(stylesCss), false);
  assert.equal(stylesCss.includes('.th-sort-btn'), true);
  assert.equal(stylesCss.includes('.trend-yaxis'), true);
  assert.equal(stylesCss.includes(bannedTerm), false);

  // app.js symbol & DOM safety contracts
  for (const sym of [
    'createDualChevronSvg',
    'sortModelBreakdownRows',
    'computeTrendAxisScale',
    'fmtAxisCost',
    'fmtAxisTokens',
  ]) {
    assert.equal(appSource.includes(sym), true, `Expected ${sym} in app.js`);
  }
  assert.equal(appSource.includes('tab-today-badge'), false);
  assert.equal(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(appSource), false);
  assert.equal(appSource.includes(bannedTerm), false);

  // I18N zh/en key and {placeholder} parity
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object should exist in app.js');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks should be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };

  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());

  for (const expectedKey of [
    'roi.freeHero',
    'settings.subJioPro',
    'childrenModels.sortDescTip',
    'childrenModels.sortAscTip',
    'childrenModels.sortIdleTip',
  ]) {
    assert.equal(zhEntries.has(expectedKey), true, `Missing zh key ${expectedKey}`);
    assert.equal(enEntries.has(expectedKey), true, `Missing en key ${expectedKey}`);
  }

  const extractPlaceholders = (str) => [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    const enVal = enEntries.get(key);
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enVal),
      `Placeholder mismatch for I18N key "${key}"`,
    );
  }

  const planStart = appSource.indexOf('const PLAN_LABELS = {');
  assert.ok(planStart >= 0, 'PLAN_LABELS object should exist in app.js');
  const planMatch = appSource
    .slice(planStart)
    .match(/zh:\s*\{([\s\S]*?)\},\s*\n\s*en:\s*\{([\s\S]*?)\}/);
  assert.ok(planMatch, 'PLAN_LABELS zh/en blocks should exist');
  assert.equal(planMatch[1].includes('jio_pro'), true);
  assert.equal(planMatch[2].includes('jio_pro'), true);
});
// ============================================================================
// [MODIFIED END] 2026-11-17 20:28:05
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:37:27
// Description: Add v0.2.6 unit and static contract tests for isChildSession /
// childKind / parentConversationId isolation across Swarm and subagents,
// 现役模型 catalog & pricing_cache.json migration, slot-roll / child-badge UI
// safety, and git-ignored private maintainer script isolation.
// ============================================================================
test('v0.2.6 isChildSession, childKind, parentConversationId, and isolated swarm worker / subagent costs', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });

    function writeSingleStepPlannerDb(dbPath, spec) {
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
      `);
      const usageBuf = encodeTokenUsage({
        enumId: spec.enumId ?? 1419,
        input: spec.input,
        cacheRead: spec.cacheRead,
        output: spec.output,
        botId: spec.botId || '',
      });
      const genInner = Buffer.concat([
        encodeBytesField(4, usageBuf),
        encodeBytesField(19, spec.rawModel || 'gemini-3.8-flash'),
        encodeBytesField(20, encodeGenKv('cascade_id', spec.originCascadeId)),
        encodeBytesField(21, spec.displayModel || 'Gemini 3.8 Flash'),
      ]);
      const genTop = Buffer.concat([
        encodeBytesField(1, genInner),
        encodeBytesField(2, encodeVarint(spec.stepIdx)),
      ]);
      db.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)').run(
        0,
        genTop,
        genTop.length,
      );
      const metaBuf = Buffer.concat([
        encodeBytesField(1, encodeTimestampMs(spec.createdMs)),
        encodeBytesField(7, encodeTimestampMs(spec.createdMs + (spec.durationMs || 2000))),
        encodeBytesField(9, usageBuf),
        encodeBytesField(
          20,
          encodeStepField20({
            stepIdx: spec.stepIdx,
            genIdx: 0,
            originCascadeId: spec.originCascadeId,
          }),
        ),
      ]);
      db.prepare('INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)').run(
        spec.stepIdx,
        15,
        3,
        metaBuf,
      );
      db.close();
    }

    // 1. Swarm coordinator with two workers (workerA, workerB)
    const coordinatorId = 'd1111111-1111-4111-8111-111111111111';
    const workerAId = 'd2222222-2222-4222-8222-222222222222';
    const workerBId = 'd3333333-3333-4333-8333-333333333333';

    writeConversation(appData, coordinatorId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-17T08:00:00Z',
          content:
            '<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from None to Gemini 3.1 Pro.</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:00:05Z',
          input_tokens: 10000,
          cache_read_tokens: 20000,
          output_tokens: 500,
          tool_calls: [],
        },
      ],
      members: {
        title: 'v0.2.6 Swarm Isolation Test',
        members: {
          coordinator: { conversation_id: coordinatorId, role: 'coordinator', model: 'Gemini 3.1 Pro' },
          workerA: { conversation_id: workerAId, role: 'worker', model: 'Claude Opus 5.5' },
          workerB: { conversation_id: workerBId, role: 'worker', model: 'Claude Sonnet 5.5' },
        },
      },
      mtimeMs: Date.parse('2026-11-17T08:00:20Z'),
    });

    writeConversation(appData, workerAId, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:00:10Z',
          input_tokens: 15000,
          cache_read_tokens: 30000,
          output_tokens: 800,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:00:21Z'),
    });

    writeConversation(appData, workerBId, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:00:12Z',
          input_tokens: 50000,
          cache_read_tokens: 100000,
          output_tokens: 2000,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:00:22Z'),
    });

    // Cold inspection of workerA first: must stay strictly isolated from workerB and coordinator
    const coldWorkerA = analyzeConversation(workerAId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(coldWorkerA.isChildSession, true);
    assert.equal(coldWorkerA.childKind, 'swarm');
    assert.equal(coldWorkerA.parentConversationId, coordinatorId);
    assert.equal(coldWorkerA.children.length, 0);
    assert.equal(coldWorkerA.totals.withChildren.costActual, coldWorkerA.totals.mainOnly.costActual);
    assert.equal(coldWorkerA.totals.mainOnly.outputTokens, 800);
    assert.equal(coldWorkerA.totals.withChildren.outputTokens, 800);
    assert.equal(coldWorkerA.totals.mainOnlyByModel.length, 1);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert Scheme A canonical label 'Claude Opus 5.5' and rawModels on mainOnlyByModel.
// ============================================================================
    assert.equal(coldWorkerA.totals.mainOnlyByModel[0].model, 'Claude Opus 5.5');
    assert.equal(coldWorkerA.totals.mainOnlyByModel[0].profileId, 'claude-opus-5-5');
    assert.deepEqual(coldWorkerA.totals.mainOnlyByModel[0].rawModels, ['claude-opus-5-5']);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
    assert.deepEqual(coldWorkerA.totals.mainOnlyByModel, coldWorkerA.totals.byModel);

    // Coordinator inspection: not a child, aggregates both workers
    const coordRes = analyzeConversation(coordinatorId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(coordRes.isChildSession, false);
    assert.equal(coordRes.childKind, null);
    assert.equal(coordRes.parentConversationId, '');
    assert.ok(coordRes.children.length >= 2);
    assert.ok(coordRes.totals.withChildren.costActual > coordRes.totals.mainOnly.costActual);
    assert.equal(coordRes.totals.mainOnlyByModel.length, 1);
    assert.equal(coordRes.totals.byModel.length, 3);

    // Warm re-inspection of workerA after coordinator warmed caches
    const warmWorkerA = analyzeConversation(workerAId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(warmWorkerA.isChildSession, true);
    assert.equal(warmWorkerA.childKind, 'swarm');
    assert.equal(warmWorkerA.parentConversationId, coordinatorId);
    assert.equal(warmWorkerA.children.length, 0);
    assert.equal(warmWorkerA.totals.withChildren.costActual, warmWorkerA.totals.mainOnly.costActual);
    assert.deepEqual(warmWorkerA.totals.mainOnlyByModel, warmWorkerA.totals.byModel);

    // 2. Regular parent spawning subagents WITHOUT conversation_summaries.db (transcript parent discovery)
    const parentNoDbId = 'e1111111-1111-4111-8111-111111111111';
    const subNoDbId = 'e2222222-2222-4222-8222-222222222222';
    const subNoDbSqlId = 'e3333333-3333-4333-8333-333333333333';

    writeConversation(appData, parentNoDbId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-17T08:10:00Z',
          content:
            '<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from None to Gemini 3.1 Pro.</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:10:02Z',
          input_tokens: 12000,
          cache_read_tokens: 24000,
          output_tokens: 600,
          tool_calls: [
            {
              name: 'invoke_subagent',
              args: {
                Subagents: JSON.stringify([{ Model: 'Gemini 3.8 Flash', Name: 'TranscriptSub' }]),
                toolSummary: '"Spawn TranscriptSub"',
              },
            },
            {
              name: 'invoke_subagent',
              args: {
                Subagents: JSON.stringify([{ Model: 'Gemini 3.8 Flash', Name: 'SqliteSub' }]),
                toolSummary: '"Spawn SqliteSub"',
              },
            },
          ],
        },
        {
          step_index: 2,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-17T08:10:03Z',
          content: `{"conversationId":"${subNoDbId}"}`,
        },
        {
          step_index: 3,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-17T08:10:04Z',
          content: `{"conversationId":"${subNoDbSqlId}"}`,
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:10:30Z'),
    });

    writeConversation(appData, subNoDbId, {
      compactLines: [
        {
          step_index: 0,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:10:06Z',
          input_tokens: 8000,
          cache_read_tokens: 16000,
          output_tokens: 400,
          tool_calls: [],
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:10:31Z'),
    });

    writeConversation(appData, subNoDbSqlId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-17T08:10:07Z',
          content: '<USER_REQUEST>Run isolated task</USER_REQUEST>',
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:10:32Z'),
    });
    writeSingleStepPlannerDb(join(convsDir, `${subNoDbSqlId}.db`), {
      stepIdx: 1,
      originCascadeId: subNoDbSqlId,
      botId: 'bot-sub-nodb-sql',
      rawModel: 'gemini-3.8-flash',
      displayModel: 'Gemini 3.8 Flash',
      input: 6000,
      cacheRead: 14000,
      output: 350,
      createdMs: Date.parse('2026-11-17T08:10:08Z'),
    });

    clearParserCache();
    // Cold discovery without conversation_summaries.db (transcript-only & SQLite-backed subagents)
    const coldSubNoDb = analyzeConversation(subNoDbId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(coldSubNoDb.isChildSession, true);
    assert.equal(coldSubNoDb.childKind, 'subagent');
    assert.equal(coldSubNoDb.parentConversationId, parentNoDbId);
    assert.equal(coldSubNoDb.children.length, 0);
    assert.equal(coldSubNoDb.totals.withChildren.costActual, coldSubNoDb.totals.mainOnly.costActual);
    assert.deepEqual(coldSubNoDb.totals.mainOnlyByModel, coldSubNoDb.totals.byModel);

    const coldSubNoDbSql = analyzeConversation(subNoDbSqlId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(coldSubNoDbSql.isChildSession, true);
    assert.equal(coldSubNoDbSql.childKind, 'subagent');
    assert.equal(coldSubNoDbSql.parentConversationId, parentNoDbId);
    assert.equal(coldSubNoDbSql.children.length, 0);
    assert.equal(
      coldSubNoDbSql.totals.withChildren.costActual,
      coldSubNoDbSql.totals.mainOnly.costActual,
    );
    assert.deepEqual(coldSubNoDbSql.totals.mainOnlyByModel, coldSubNoDbSql.totals.byModel);

    const parentNoDbRes = analyzeConversation(parentNoDbId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(parentNoDbRes.isChildSession, false);
    assert.equal(parentNoDbRes.childKind, null);
    assert.equal(parentNoDbRes.children.length, 2);
    assert.ok(parentNoDbRes.totals.withChildren.costActual > parentNoDbRes.totals.mainOnly.costActual);

    // Warm re-check hits subagentDescCache O(1) lookup path
    const warmSubNoDb = analyzeConversation(subNoDbId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(warmSubNoDb.isChildSession, true);
    assert.equal(warmSubNoDb.childKind, 'subagent');
    assert.equal(warmSubNoDb.parentConversationId, parentNoDbId);
    assert.equal(warmSubNoDb.children.length, 0);

    // 3. Regular parent + subagent WITH conversation_summaries.db parent_conversation_id
    const parentWithDbId = 'f1111111-1111-4111-8111-111111111111';
    const subWithDbId = 'f2222222-2222-4222-8222-222222222222';

    const sumDb = new DatabaseSync(join(appData, 'conversation_summaries.db'));
    sumDb.exec(`
      CREATE TABLE conversation_summaries (
        conversation_id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT "",
        workspace_uris TEXT NOT NULL DEFAULT "",
        agent_name TEXT NOT NULL DEFAULT "",
        parent_conversation_id TEXT NOT NULL DEFAULT ""
      );
    `);
    const insSum = sumDb.prepare(
      'INSERT INTO conversation_summaries (conversation_id, title, workspace_uris, agent_name, parent_conversation_id) VALUES (?, ?, ?, ?, ?)',
    );
    insSum.run(parentWithDbId, 'Parent With DB', '[]', '', '');
    insSum.run(subWithDbId, 'Subagent With DB', '[]', 'DbWorker', parentWithDbId);
    sumDb.close();

    writeConversation(appData, parentWithDbId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-17T08:20:00Z',
          content:
            '<USER_SETTINGS_CHANGE>The user changed setting `Model Selection` from None to Gemini 3.1 Pro.</USER_SETTINGS_CHANGE>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: '2026-11-17T08:20:02Z',
          input_tokens: 9000,
          cache_read_tokens: 18000,
          output_tokens: 450,
          tool_calls: [
            {
              name: 'invoke_subagent',
              args: {
                Subagents: JSON.stringify([{ Model: 'Claude Sonnet 5.5', Name: 'DbWorker' }]),
                toolSummary: '"Spawn DbWorker"',
              },
            },
          ],
        },
        {
          step_index: 2,
          type: 'GENERIC',
          status: 'DONE',
          created_at: '2026-11-17T08:20:03Z',
          content: `{"conversationId":"${subWithDbId}"}`,
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:20:20Z'),
    });

    writeConversation(appData, subWithDbId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: '2026-11-17T08:20:04Z',
          content: '<USER_REQUEST>Execute child task</USER_REQUEST>',
        },
      ],
      mtimeMs: Date.parse('2026-11-17T08:20:21Z'),
    });
    writeSingleStepPlannerDb(join(convsDir, `${subWithDbId}.db`), {
      stepIdx: 1,
      originCascadeId: subWithDbId,
      botId: 'bot-sub-with-db',
      rawModel: 'claude-sonnet-5-5',
      displayModel: 'Claude Sonnet 5.5',
      input: 11000,
      cacheRead: 22000,
      output: 700,
      createdMs: Date.parse('2026-11-17T08:20:06Z'),
    });

    clearParserCache();
    const dbSubRes = analyzeConversation(subWithDbId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(dbSubRes.isChildSession, true);
    assert.equal(dbSubRes.childKind, 'subagent');
    assert.equal(dbSubRes.parentConversationId, parentWithDbId);
    assert.equal(dbSubRes.children.length, 0);
    assert.equal(dbSubRes.totals.withChildren.costActual, dbSubRes.totals.mainOnly.costActual);
    assert.equal(dbSubRes.totals.mainOnly.outputTokens, 700);
    assert.equal(dbSubRes.totals.mainOnlyByModel.length, 1);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Assert Scheme A canonical label 'Claude Sonnet 5.5' and rawModels on mainOnlyByModel.
// ============================================================================
    assert.equal(dbSubRes.totals.mainOnlyByModel[0].model, 'Claude Sonnet 5.5');
    assert.equal(dbSubRes.totals.mainOnlyByModel[0].profileId, 'claude-sonnet-5-5');
    assert.deepEqual(dbSubRes.totals.mainOnlyByModel[0].rawModels, ['claude-sonnet-5-5']);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
    assert.deepEqual(dbSubRes.totals.mainOnlyByModel, dbSubRes.totals.byModel);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.6 现役模型 terminology, pricing_cache.json migration, and static wording scan', () => {
  const gptOss = MODEL_PRICING_CATALOG.find((p) => p.id === 'gpt-oss-120b');
  assert.ok(gptOss, 'gpt-oss-120b should exist in MODEL_PRICING_CATALOG');
  assert.equal(gptOss.group, '其他现役模型');

  const legacyTerm = '\u5728\u5f79\u6a21\u578b';
  const legacyGroup = `\u5176\u4ed6${legacyTerm}`;
  const stateDir = mkdtempSync(join(tmpdir(), 'tm-v026-cache-migrate-'));
  try {
    writeFileSync(
      join(stateDir, 'pricing_cache.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          lastSyncLocalDate: '2026-11-17',
          status: 'ok',
          sources: ['models.dev'],
          syncedRates: {},
          upstreamPool: {
            'custom-model-1': {
              group: legacyGroup,
              inputPer1M: 1.0,
              cachedPer1M: 0.25,
              outputPer1M: 4.0,
              longContextTier: false,
              longInputMultiplier: 1.0,
              longOutputMultiplier: 1.0,
            },
          },
          discoveredModels: [],
        },
        null,
        2,
      ),
      'utf-8',
    );

    const mgr = createPricingSyncManager({ stateDir, autoSyncDisabled: true });
    const runtimeCatalog = mgr.getRuntimeCatalog(['custom-model-1']);
    const customEntry = runtimeCatalog.find((p) => p.id === 'custom-model-1');
    assert.ok(customEntry, 'custom-model-1 should be promoted from upstreamPool');
    assert.equal(customEntry.group, '其他现役模型');

    const runtimeGptOss = runtimeCatalog.find((p) => p.id === 'gpt-oss-120b');
    assert.equal(runtimeGptOss?.group, '其他现役模型');
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }

  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');
  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');

  assert.equal(indexHtml.includes(legacyTerm), false, 'index.html must not contain legacy wording');
  assert.equal(readmeMd.includes(legacyTerm), false, 'README.md must not contain legacy wording');
  assert.equal(skillMd.includes(legacyTerm), false, 'SKILL.md must not contain legacy wording');

  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object should exist in app.js');
  const zhMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{/);
  assert.ok(zhMatch, 'I18N.zh block should be extractable');
  assert.equal(zhMatch[1].includes(legacyTerm), false, 'I18N.zh must not contain legacy wording');
});

test('v0.2.6 slot-roll motion, child badge, DOM/I18N safety, and private maintainer script isolation', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  const bannedTerm = '\u6c34\u4f4d';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['parser.mjs', parserSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['main.mjs', mainSource],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    assert.equal(src.includes(bannedTerm), false, `${label} must not contain banned term`);
  }

  for (const fnName of [
    'splitRollingAffixes',
    'renderRollingText',
    'applySmoothBarSize',
    'clearCurrentSessionMotionMemory',
    'isChildSessionView',
  ]) {
    assert.equal(
      new RegExp(`function\\s+${fnName}\\s*\\(`).test(appSource),
      true,
      `app.js must define function ${fnName}()`,
    );
  }
  assert.equal(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(appSource), false);

  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object should exist in app.js');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks should be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());
  assert.equal(zhEntries.get('cost.childIsolatedBadge'), '子代理独立计费');
  assert.equal(enEntries.get('cost.childIsolatedBadge'), 'Subagent Only');

  const extractPlaceholders = (str) => [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `Placeholder mismatch for I18N key "${key}"`,
    );
  }

  // styles.css slot-roll & child badge contracts
  for (const selector of [
    '.roll-col',
    '.roll-col.is-chunk',
    '.child-cost-badge',
    '@media (prefers-reduced-motion: reduce)',
  ]) {
    assert.equal(stylesCss.includes(selector), true, `styles.css must define ${selector}`);
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:14:47
// Description: Update manifest version assertion from 0.2.6 to 0.2.7 and add v0.2.7 Zero-Layout-Shift (CLS=0), anti-clipping, I18N, and headless VM behavioral tests.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:33:22
// Description: Bump current manifest version assertion from 0.2.7 to 0.2.8.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Bump current manifest version assertion from 0.2.8 to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Bump current manifest version assertion from 0.2.9 to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Bump current manifest version assertion from 0.3.0 to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump current manifest version assertion from 0.3.1 to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump current manifest version assertion from 0.3.2 to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump current manifest version assertion from 0.4.0 to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump current manifest version assertion from 0.4.1 to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump current manifest version assertion from 0.5.0 to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump current manifest version assertion from 0.5.1 to 0.5.2.
// ============================================================================
  // Manifests bumped to 0.5.2 without comment corruption
  const pluginJson = JSON.parse(readFileSync(join(repoRoot, 'plugin.json'), 'utf-8'));
  const packageJson = JSON.parse(readFileSync(join(paneDir, 'package.json'), 'utf-8'));
  assert.equal(pluginJson.version, '0.5.2');
  assert.equal(packageJson.version, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 10:33:22
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-17 22:14:47
// ============================================================================

  // Private maintainer script isolation in .gitignore (portable without requiring git.exe on PATH)
  const gitignorePath = join(repoRoot, '.gitignore');
  assert.equal(existsSync(gitignorePath), true, '.gitignore must exist');
  const gitignoreLines = readFileSync(gitignorePath, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  assert.equal(gitignoreLines.includes('maintainer/'), true, '.gitignore must include maintainer/');
  assert.equal(
    gitignoreLines.some((line) => /^!maintainer(?:\/|$)/i.test(line)),
    false,
    '.gitignore must not un-ignore maintainer/',
  );

  const maintainerScriptPath = join(repoRoot, 'maintainer', 'sync-github-about.ps1');
  if (existsSync(maintainerScriptPath)) {
    const scriptText = readFileSync(maintainerScriptPath, 'utf-8');
    assert.equal(scriptText.includes(bannedTerm), false);
    assert.equal(scriptText.includes('DryRun'), true);
    if (existsSync(join(repoRoot, '.git'))) {
      const gitCheck = spawnSync('git', ['check-ignore', '-q', 'maintainer/sync-github-about.ps1'], {
        cwd: repoRoot,
        stdio: 'ignore',
      });
      if (!gitCheck.error) {
        assert.equal(gitCheck.status, 0, 'git check-ignore must confirm maintainer/sync-github-about.ps1 is ignored');
      }
    }
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-17 21:37:27
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 22:14:47
// Description: Add v0.2.7 Zero-Layout-Shift (CLS=0) static CSS/JS/I18N/version
// contract tests and headless Node VM behavioral tests for renderRollingText
// and per-card dirty-signature memoization.
// ============================================================================
test('v0.2.7 Zero-Layout-Shift (CLS = 0) CSS, app.js memoization, sparkline key, two-line KPI, I18N, and version contracts', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const releaseUpdaterSource = readFileSync(join(paneDir, 'release_updater.mjs'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  const bannedTerm = '\u6c34\u4f4d';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['main.mjs', mainSource],
    ['parser.mjs', parserSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    assert.equal(src.includes(bannedTerm), false, `${label} must not contain banned term`);
  }

  // Strip CSS comments so regexes assert actual rules rather than comments
  const stylesNoComments = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const getRuleBody = (selectorRegex) => {
    const match = stylesNoComments.match(selectorRegex);
    assert.ok(match, `styles.css must define rule matching ${selectorRegex}`);
    return match[1];
  };

  // .roll-val, .roll-static, .roll-col, .roll-old/.roll-new Zero-CLS geometry
  const rollValBody = getRuleBody(/(?:^|\n)\s*\.roll-val\s*\{([^}]*)\}/);
  assert.match(rollValBody, /display\s*:\s*inline-flex\b/);
  assert.match(rollValBody, /align-items\s*:\s*baseline\b/);
  assert.match(rollValBody, /vertical-align\s*:\s*baseline\b/);

  const rollStaticBody = getRuleBody(/(?:^|\n)\s*\.roll-static\s*\{([^}]*)\}/);
  assert.match(rollStaticBody, /display\s*:\s*inline-block\b/);
  assert.doesNotMatch(rollStaticBody, /overflow\s*:\s*hidden\b/);

  const rollColBody = getRuleBody(/(?:^|\n)\s*\.roll-col\s*\{([^}]*)\}/);
  assert.match(rollColBody, /display\s*:\s*inline-grid\b/);
  assert.doesNotMatch(rollColBody, /display\s*:\s*inline-block\b/);
  assert.match(rollColBody, /align-items\s*:\s*baseline\b/);
  assert.match(rollColBody, /overflow\s*:\s*clip\b/);

  const rollOldNewBody = getRuleBody(/(?:^|\n)\s*\.roll-old\s*,\s*\r?\n?\s*\.roll-new\s*\{([^}]*)\}/);
  assert.match(rollOldNewBody, /grid-area\s*:\s*1\s*\/\s*1\b/);
  assert.doesNotMatch(rollOldNewBody, /position\s*:\s*absolute\b/);
  assert.doesNotMatch(stylesNoComments, /\.roll-old\b[^}]*position\s*:\s*absolute\b/);

  assert.equal(stylesNoComments.includes('.roll-col.is-whole'), true, 'styles.css must define .roll-col.is-whole');
  assert.equal(stylesNoComments.includes('.roll-col.is-whole.is-end'), true, 'styles.css must define .roll-col.is-whole.is-end');

  // Header, Tab 1, and Tab 2 anti-wrapping / anti-clipping locks
  const headerPillsBody = getRuleBody(/(?:^|\n)\s*\.header-pills\s*\{([^}]*)\}/);
  assert.match(headerPillsBody, /flex-wrap\s*:\s*nowrap\b/);
  assert.doesNotMatch(headerPillsBody, /flex-wrap\s*:\s*wrap\b/);
  assert.match(headerPillsBody, /overflow\s*:\s*hidden\b/);

  const modelPillBody = getRuleBody(/(?:^|\n)\s*\.model-pill\s*\{([^}]*)\}/);
  assert.match(modelPillBody, /max-width\s*:\s*48%/);

  const convStripBody = getRuleBody(/(?:^|\n)\s*\.conv-strip\s*\{([^}]*)\}/);
  assert.match(convStripBody, /flex-wrap\s*:\s*nowrap\b/);
  assert.doesNotMatch(convStripBody, /flex-wrap\s*:\s*wrap\b/);
  assert.match(convStripBody, /overflow\s*:\s*hidden\b/);

  const heroValueRowBody = getRuleBody(/(?:^|\n)\s*\.hero-value-row\s*\{([^}]*)\}/);
  assert.match(heroValueRowBody, /flex-wrap\s*:\s*nowrap\b/);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:33:27
// Description: Update Zero-CLS .hero-value-row min-height assertion from 29px to v0.5.0 32px hero scale.
// ============================================================================
  assert.match(heroValueRowBody, /min-height\s*:\s*32px\b/);
// ============================================================================
// [MODIFIED END] 2026-11-20 10:33:27
// ============================================================================

  const ctxScaleRowBody = getRuleBody(/(?:^|\n)\s*\.ctx-scale-row\s*\{([^}]*)\}/);
  assert.match(ctxScaleRowBody, /flex-wrap\s*:\s*nowrap\b/);

  assert.match(stylesNoComments, /@media\s*\(min-width:\s*350px\)\s*\{[\s\S]*?\.card-head\s*\{[^}]*flex-wrap\s*:\s*nowrap/);
  assert.match(stylesNoComments, /\.sub-stats\.is-single-line\s*\{[^}]*flex-wrap\s*:\s*nowrap/);
  assert.equal(stylesNoComments.includes('.sub-stats-speed'), true, 'styles.css must define .sub-stats-speed');
  assert.equal(stylesNoComments.includes('.sub-stats-line'), true, 'styles.css must define .sub-stats-line');
  assert.equal(stylesNoComments.includes('.kpi-sub-stack'), true, 'styles.css must define .kpi-sub-stack');
  assert.equal(stylesNoComments.includes('.kpi-sub-line'), true, 'styles.css must define .kpi-sub-line');

  const kpiStripBody = getRuleBody(/(?:^|\n)\s*\.kpi-strip\s*\{([^}]*)\}/);
  assert.match(kpiStripBody, /minmax\(\s*136px\s*,\s*1fr\s*\)/);
  assert.doesNotMatch(kpiStripBody, /minmax\(\s*112px\s*,\s*1fr\s*\)/);

  // app.js static memoization, sparkline key, two-line KPI, alignEnd, and DOM safety contracts
  assert.match(appSource, /function\s+resetCardRenderSigs\s*\(/);
  const sigInitMatch = appSource.match(/cardRenderSigs\s*:\s*\{([\s\S]*?)\}/);
  assert.ok(sigInitMatch, 'app.js must define state.cardRenderSigs');
  for (const cardKey of ['speed', 'cost', 'context', 'cache', 'childrenModels']) {
    assert.equal(
      new RegExp(`\\b${cardKey}\\s*:`).test(sigInitMatch[1]),
      true,
      `state.cardRenderSigs must include "${cardKey}"`,
    );
    assert.equal(
      new RegExp(`card\\.childElementCount\\s*>\\s*0\\s*&&\\s*state\\.cardRenderSigs\\.${cardKey}\\s*===\\s*sig`).test(appSource),
      true,
      `Tab 1 renderer for "${cardKey}" must short-circuit on matching cardRenderSigs.${cardKey}`,
    );
  }

  assert.equal(appSource.includes('cur:spark:step:'), true, 'Sparkline bars must use cur:spark:step: key');
  assert.equal(appSource.includes('cur:spark:${idx}'), false, 'Sparkline bars must not use index-based cur:spark:${idx}');
  assert.equal(appSource.includes('glb:kpi:tokensAvg'), true, 'app.js must define glb:kpi:tokensAvg');
  assert.equal(appSource.includes('glb:kpi:tokensOut'), true, 'app.js must define glb:kpi:tokensOut');
  assert.equal(appSource.includes('kpi-sub-stack'), true, 'app.js must use .kpi-sub-stack');
  assert.equal(appSource.includes('kpi-sub-line'), true, 'app.js must use .kpi-sub-line');
  assert.equal(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(appSource), false);

  for (const rightMetricKey of ['cur:speed:steps', 'cur:ctx:summary', 'cur:cache:headRate', 'glb:roi:sub', 'glb:sum:steps']) {
    assert.equal(
      appSource.includes(rightMetricKey),
      true,
      `app.js must retain right-aligned rolling metric "${rightMetricKey}"`,
    );
  }

  // I18N zh/en key & {placeholder} parity including v0.2.7 two-line KPI keys
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object should exist in app.js');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks should be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());

  for (const [key, expectedZh, expectedEn] of [
    ['global.avgSubLine', '日均 {avg}', 'Avg/d {avg}'],
    ['global.outSubLine', 'Out {out}', 'Out {out}'],
    ['global.activeDaysLine', '活跃 {active} 天', 'Active {active}d'],
    ['global.archivedLine', '含 {archived} 已归档', '{archived} archived'],
  ]) {
    assert.equal(zhEntries.get(key), expectedZh, `I18N.zh["${key}"] mismatch`);
    assert.equal(enEntries.get(key), expectedEn, `I18N.en["${key}"] mismatch`);
  }

  const extractPlaceholders = (str) => [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `Placeholder mismatch for I18N key "${key}"`,
    );
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:33:22
// Description: Bump current manifest, fallback version, and documentation assertions from 0.2.7 to 0.2.8.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.2.8 to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.2.9 to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.3.0 to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.3.1 to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.3.2 to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.4.0 to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.4.1 to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.5.0 to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump current manifest, fallback version (main.mjs, release_updater.mjs, app.js), and documentation assertions from 0.5.1 to 0.5.2.
// ============================================================================
  // Version & docs consistency for current v0.5.2 release
  const pluginJson = JSON.parse(readFileSync(join(repoRoot, 'plugin.json'), 'utf-8'));
  const packageJson = JSON.parse(readFileSync(join(paneDir, 'package.json'), 'utf-8'));
  assert.equal(pluginJson.version, '0.5.2');
  assert.equal(packageJson.version, '0.5.2');
  assert.equal(pluginJson.description.includes('v0.5.2 beta'), true);
  assert.equal(packageJson.description.includes('v0.5.2 beta'), true);
  assert.equal(mainSource.includes("return '0.5.2'"), true);
  assert.equal(releaseUpdaterSource.includes(": '0.5.2'"), true);
  assert.equal(appSource.includes("'0.5.2'"), true);
  assert.equal(skillMd.includes('# Token Monitor (v0.5.2 Beta)'), true);
  assert.equal(readmeMd.includes('agy-token-monitor-v0.5.2.zip'), true);
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 10:33:22
// ============================================================================
});

test('v0.2.7 headless Node VM behavioral tests: renderRollingText CLS=0 transitions and per-card memoization', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const appPath = join(testDir, '..', 'sidecars', 'monitor_pane', 'app.js');
  const appSource = readFileSync(appPath, 'utf-8');

  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0, 'app.js must end with IIFE closing })();');

  const instrumentedSource =
    appSource.slice(0, iifeCloseIdx) +
    `\n  globalThis.__tmExports = {\n` +
    `    state,\n` +
    `    rollingMetricMemory,\n` +
    `    barMetricMemory,\n` +
    `    resetCardRenderSigs,\n` +
    `    renderRollingText,\n` +
    `    renderSpeedCard,\n` +
    `    renderCostCard,\n` +
    `    renderContextCard,\n` +
    `    renderCacheCard,\n` +
    `    renderChildrenAndModelsCard,\n` +
    `    renderGlobalTab,\n` +
    `  };\n` +
    appSource.slice(iifeCloseIdx);

  // Minimal fake DOM supporting parent/child tracking, className/classList sync, and isConnected
  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }

  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }

  let fakeDocument = null;

  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.type = '';
      this.role = '';
      this.value = '';
      this.tabIndex = 0;
      this.lang = '';
      this.scrollLeft = 0;
      this.scrollWidth = 0;
      this.clientWidth = 0;
      this.style = {
        cssText: '',
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
        toggle: (tok, force) => {
          const key = String(tok || '');
          const shouldAdd = force === undefined ? !this._classSet.has(key) : Boolean(force);
          if (shouldAdd) this._classSet.add(key);
          else this._classSet.delete(key);
          return shouldAdd;
        },
      };
    }

    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }

    get children() {
      return this.childNodes.filter((n) => n instanceof FakeElement);
    }
    get childElementCount() {
      return this.children.length;
    }
    get parentElement() {
      return this.parentNode instanceof FakeElement ? this.parentNode : null;
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === fakeDocument || cur === fakeDocument?.documentElement || cur === fakeDocument?.body) {
          return true;
        }
        cur = cur.parentNode;
      }
      return false;
    }

    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') {
        this.appendChild(new FakeTextNode(str));
      }
    }

    setAttribute(name, val) {
      const k = String(name);
      const v = String(val);
      if (k === 'class') {
        this.className = v;
        return;
      }
      if (k === 'title') this.title = v;
      this.attributes.set(k, v);
    }
    getAttribute(name) {
      const k = String(name);
      if (k === 'class') return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(name) {
      const k = String(name);
      if (k === 'class') return this._classSet.size > 0;
      return this.attributes.has(k);
    }
    removeAttribute(name) {
      const k = String(name);
      if (k === 'class') {
        this.className = '';
        return;
      }
      this.attributes.delete(k);
    }

    appendChild(child) {
      if (child.parentNode && child.parentNode !== this) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx >= 0) child.parentNode.childNodes.splice(idx, 1);
      } else if (child.parentNode === this) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.childNodes.indexOf(this);
        if (idx >= 0) this.parentNode.childNodes.splice(idx, 1);
        this.parentNode = null;
      }
    }

    replaceChildren(...nodes) {
      for (const oldChild of this.childNodes) {
        oldChild.parentNode = null;
      }
      this.childNodes = [];
      for (const n of nodes) {
        if (n === null || n === undefined) continue;
        this.appendChild(typeof n === 'string' ? new FakeTextNode(n) : n);
      }
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }

    querySelectorAll(selector) {
      const results = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (selector.startsWith('.')) {
            const required = selector.slice(1).split('.').filter(Boolean);
            if (required.every((cls) => child.classList.contains(cls))) {
              results.push(child);
            }
          } else if (selector.startsWith('#')) {
            if (child.getAttribute('id') === selector.slice(1)) {
              results.push(child);
            }
          }
          visit(child);
        }
      };
      visit(this);
      return results;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  const elementsById = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);

  fakeDocument = {
    readyState: 'loading',
    hidden: false,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const key = String(id);
      if (!elementsById.has(key)) {
        const elem = new FakeElement('div');
        elem.setAttribute('id', key);
        rootBody.appendChild(elem);
        elementsById.set(key, elem);
      }
      return elementsById.get(key);
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  let nextTimerId = 1;
  const pendingTimeouts = new Map();
  const fakeSetTimeout = (fn, ms = 0) => {
    const id = nextTimerId++;
    pendingTimeouts.set(id, { id, fn, ms: Number(ms) || 0 });
    return id;
  };
  const fakeClearTimeout = (id) => {
    pendingTimeouts.delete(id);
  };
  const flushTimeouts = (maxDelayMs = Infinity) => {
    for (const [id, entry] of [...pendingTimeouts.entries()]) {
      if (entry.ms <= maxDelayMs) {
        pendingTimeouts.delete(id);
        entry.fn();
      }
    }
  };

  const sandbox = {
    Node: FakeNode,
    document: fakeDocument,
    window: {
      addEventListener: () => {},
      matchMedia: () => ({ matches: false }),
      sidecar: { conversationId: 'conv-vm-root' },
      location: { reload: () => {} },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: 'rgb(246, 247, 249)' }),
    AbortController,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    requestAnimationFrame: (cb) => fakeSetTimeout(cb, 16),
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: () => nextTimerId++,
    clearInterval: () => {},
    console,
    URLSearchParams,
    Intl,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(instrumentedSource, sandbox);
  const exports = sandbox.__tmExports;
  assert.ok(exports, 'VM execution must expose __tmExports');

  // 1. Equal-length update ('USD 133.4947' -> 'USD 133.5120')
  const rollHost = fakeDocument.getElementById('vm-roll-host');
  const firstCostRoll = exports.renderRollingText('cur:cost:hero', 'USD 133.4947', 133.4947, {
    className: 'hero-value',
  });
  assert.equal(firstCostRoll.classList.contains('roll-val'), true);
  assert.equal(firstCostRoll.textContent, 'USD 133.4947');

  const secondCostRoll = exports.renderRollingText('cur:cost:hero', 'USD 133.5120', 133.512, {
    className: 'hero-value',
  });
  rollHost.replaceChildren(secondCostRoll);
  assert.equal(secondCostRoll.isConnected, true);
  assert.equal(secondCostRoll.classList.contains('hero-value'), true);
  assert.equal(secondCostRoll.classList.contains('roll-val'), true);
  assert.equal(secondCostRoll.classList.contains('is-up'), true);
  assert.equal(secondCostRoll.children.length, 12);

  const staticChildren = secondCostRoll.children.filter((c) => c.classList.contains('roll-static'));
  const colChildren = secondCostRoll.children.filter((c) => c.classList.contains('roll-col'));
  assert.deepEqual(
    staticChildren.map((c) => c.textContent),
    ['U', 'S', 'D', ' ', '1', '3', '3', '.'],
  );
  assert.equal(colChildren.length, 4);
  assert.equal(colChildren.some((c) => c.classList.contains('is-whole')), false);
  assert.deepEqual(
    colChildren.map((c) => [c.querySelector('.roll-old')?.textContent, c.querySelector('.roll-new')?.textContent]),
    [
      ['4', '5'],
      ['9', '1'],
      ['4', '2'],
      ['7', '0'],
    ],
  );
  assert.deepEqual(
    colChildren.map((c) => c.style['--roll-delay']),
    ['0ms', '14ms', '28ms', '42ms'],
  );

  // After cleanup timer fires (~410ms), roll-val MUST remain (0 display-mode flip!)
  flushTimeouts(410);
  assert.equal(secondCostRoll.classList.contains('roll-val'), true);
  assert.equal(secondCostRoll.classList.contains('is-up'), false);
  assert.equal(secondCostRoll.classList.contains('is-down'), false);
  assert.equal(secondCostRoll.getAttribute('aria-label'), null);
  assert.equal(secondCostRoll.textContent, 'USD 133.5120');
  assert.equal(secondCostRoll.children.length, 0);

  // 2. Different-length unit switch ('2.69B' -> '2,688,473,661')
  const firstTokRoll = exports.renderRollingText('glb:kpi:tokens', '2.69B', 2688473661, {
    className: 'kpi-val',
  });
  assert.equal(firstTokRoll.classList.contains('roll-val'), true);

  const secondTokRoll = exports.renderRollingText('glb:kpi:tokens', '2,688,473,661', 2688473661, {
    className: 'kpi-val',
  });
  rollHost.replaceChildren(secondTokRoll);
  assert.equal(secondTokRoll.classList.contains('roll-val'), true);
  assert.equal(secondTokRoll.querySelectorAll('.roll-static').length, 0, 'Must NOT slice partial "2" prefix');
  assert.equal(secondTokRoll.children.length, 1);
  const wholeCol = secondTokRoll.children[0];
  assert.equal(wholeCol.classList.contains('roll-col'), true);
  assert.equal(wholeCol.classList.contains('is-whole'), true);
  assert.equal(wholeCol.querySelector('.roll-old')?.textContent, '2.69B');
  assert.equal(wholeCol.querySelector('.roll-new')?.textContent, '2,688,473,661');

  flushTimeouts(410);
  assert.equal(secondTokRoll.classList.contains('roll-val'), true);
  assert.equal(secondTokRoll.textContent, '2,688,473,661');

  // Verify alignEnd adds .is-end without leaking an alignEnd HTML attribute
  exports.renderRollingText('cur:speed:steps', '10 steps', 10, { className: 'muted-hint', alignEnd: true });
  const endStepRoll = exports.renderRollingText('cur:speed:steps', '100 steps', 100, {
    className: 'muted-hint',
    alignEnd: true,
  });
  rollHost.replaceChildren(endStepRoll);
  assert.equal(endStepRoll.hasAttribute('alignEnd'), false);
  assert.equal(endStepRoll.hasAttribute('alignend'), false);
  assert.equal(endStepRoll.children.length, 1);
  assert.equal(endStepRoll.children[0].classList.contains('is-whole'), true);
  assert.equal(endStepRoll.children[0].classList.contains('is-end'), true);
  flushTimeouts(410);

  // 3. Per-card memoization: calling renderSpeedCard & renderCostCard (plus remaining Tab 1 cards)
  // twice with identical data preserves exact child DOM node object references
  const baseCurrent = {
    conversationId: 'conv-vm-1',
    title: 'Zero CLS Demo',
    workspace: 'f:/Other Items/agy-token-monitor',
    isChildSession: false,
    speed: {
      measuredStepsCount: 2,
      latestStepTokPerSec: 88.4,
      weightedAvgTokPerSec: 79.2,
      peakTokPerSec: 94.1,
      latestStepOutputTokens: 420,
      latestStepDurationSec: 4.75,
      recentSteps: [
        { stepIndex: 6, tokPerSec: 70.0, outputTokens: 350, durationSec: 5.0, model: 'gemini-3-8-flash' },
        { stepIndex: 7, tokPerSec: 88.4, outputTokens: 420, durationSec: 4.75, model: 'gemini-3-8-flash' },
      ],
    },
    totals: {
      withChildren: {
        costActual: 1.2345,
        totalTokens: 150000,
        stepsCount: 12,
        cacheHitRatePct: 68.5,
        outputTokens: 4500,
        cacheReadTokens: 100000,
        inputUncachedTokens: 45500,
      },
      mainOnly: {
        costActual: 1.2345,
        totalTokens: 150000,
        stepsCount: 12,
        cacheHitRatePct: 68.5,
        outputTokens: 4500,
        cacheReadTokens: 100000,
        inputUncachedTokens: 45500,
      },
      byModel: [
        {
          model: 'gemini-3-8-flash',
          profileId: 'gemini-3-8-flash',
          profileLabel: 'Gemini 3.8 Flash',
          rateDisplay: '$0.1/$1',
          stepsCount: 12,
          inputUncachedTokens: 45500,
          cacheReadTokens: 100000,
          outputTokens: 4500,
          totalTokens: 150000,
          costActual: 1.2345,
        },
      ],
    },
    context: {
      currentTotal: 120000,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update v0.2.7 VM context limits to 409600/512000.
// ============================================================================
      softLimit: 409600,
      hardLimit: 512000,
      hardUsagePct: 23.4375,
      softUsagePct: 29.296875,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
      usageLevel: 'HEALTHY',
      compactedPendingTurn: false,
      latestCacheRead: 100000,
      latestInputUncached: 45500,
      latestCacheHitRatePct: 68.7,
      latestNetDelta: 1500,
      topSpikes: [{ stepIndex: 7, deltaTokens: 1500, totalAfter: 120000, triggerSummary: 'Read logs' }],
    },
    children: [],
  };
  const basePrefs = { currency: 'USD', cnyRate: 7.2 };

  exports.resetCardRenderSigs();
  exports.renderSpeedCard(baseCurrent);
  exports.renderCostCard(baseCurrent, basePrefs);
  exports.renderContextCard(baseCurrent);
  exports.renderCacheCard(baseCurrent);
  exports.renderChildrenAndModelsCard(baseCurrent, basePrefs);

  const speedCard = fakeDocument.getElementById('card-speed');
  const costCard = fakeDocument.getElementById('card-cost');
  const contextCard = fakeDocument.getElementById('card-context');
  const cacheCard = fakeDocument.getElementById('card-cache');
  const modelsCard = fakeDocument.getElementById('card-children-models');

  assert.equal(speedCard.querySelectorAll('.sub-stats-speed').length, 1);
  assert.equal(speedCard.querySelectorAll('.sub-stats-line').length, 2);
  assert.equal(costCard.querySelectorAll('.sub-stats.is-single-line').length, 1);
  assert.equal(exports.barMetricMemory.has('cur:spark:step:7'), true);
  assert.equal(exports.barMetricMemory.has('cur:spark:0'), false);

  const speedChildrenBefore = [...speedCard.children];
  const costChildrenBefore = [...costCard.children];
  const contextChildrenBefore = [...contextCard.children];
  const cacheChildrenBefore = [...cacheCard.children];
  const modelsChildrenBefore = [...modelsCard.children];
  assert.ok(speedChildrenBefore.length > 0 && costChildrenBefore.length > 0);

  // Re-render with deep-cloned identical data -> exact child DOM node identity must be preserved
  const clonedCurrent = JSON.parse(JSON.stringify(baseCurrent));
  const clonedPrefs = JSON.parse(JSON.stringify(basePrefs));
  exports.renderSpeedCard(clonedCurrent);
  exports.renderCostCard(clonedCurrent, clonedPrefs);
  exports.renderContextCard(clonedCurrent);
  exports.renderCacheCard(clonedCurrent);
  exports.renderChildrenAndModelsCard(clonedCurrent, clonedPrefs);

  assert.equal(speedCard.children.length, speedChildrenBefore.length);
  for (let i = 0; i < speedChildrenBefore.length; i += 1) {
    assert.strictEqual(speedCard.children[i], speedChildrenBefore[i], `speedCard child[${i}] rebuilt unnecessarily`);
  }
  assert.equal(costCard.children.length, costChildrenBefore.length);
  for (let i = 0; i < costChildrenBefore.length; i += 1) {
    assert.strictEqual(costCard.children[i], costChildrenBefore[i], `costCard child[${i}] rebuilt unnecessarily`);
  }
  for (let i = 0; i < contextChildrenBefore.length; i += 1) {
    assert.strictEqual(contextCard.children[i], contextChildrenBefore[i]);
  }
  for (let i = 0; i < cacheChildrenBefore.length; i += 1) {
    assert.strictEqual(cacheCard.children[i], cacheChildrenBefore[i]);
  }
  for (let i = 0; i < modelsChildrenBefore.length; i += 1) {
    assert.strictEqual(modelsCard.children[i], modelsChildrenBefore[i]);
  }

  // Invalidating signatures forces fresh DOM rebuild on next render
  exports.resetCardRenderSigs();
  exports.renderSpeedCard(clonedCurrent);
  exports.renderCostCard(clonedCurrent, clonedPrefs);
  assert.notStrictEqual(speedCard.children[0], speedChildrenBefore[0]);
  assert.notStrictEqual(costCard.children[0], costChildrenBefore[0]);

  // Verify Tab 2 two-line KPI sub-stats (.kpi-sub-stack / .kpi-sub-line)
  exports.renderGlobalTab({
    prefs: basePrefs,
    current: baseCurrent,
    global: {
      todayDate: '2026-11-17',
      periods: {
        today: {
          rangeKey: 'today',
          startDate: '2026-11-17',
          endDate: '2026-11-17',
          spanDaysCount: 1,
          activeDaysCount: 1,
          conversationsCount: 5,
          archivedConversationsCount: 2,
          stepsCount: 30,
          inputTokens: 45500,
          cacheReadTokens: 100000,
          outputTokens: 4500,
          totalTokens: 150000,
          cacheHitRatePct: 68.7,
          costActual: 1.2345,
          avgDailyCost: 1.2345,
          avgDailyTokens: 150000,
          trendGranularity: 'hour',
          series: [],
          byModel: [],
          topConversations: [],
          subscription: null,
        },
      },
      recentConversations: [],
    },
  });
  const globalContent = fakeDocument.getElementById('global-content');
  assert.ok(globalContent.querySelectorAll('.kpi-sub-stack').length >= 4);
  const subLineTexts = globalContent.querySelectorAll('.kpi-sub-line').map((n) => n.textContent);
  assert.equal(subLineTexts.includes('活跃 1 天'), true);
  assert.equal(subLineTexts.includes('含 2 已归档'), true);
  assert.equal(subLineTexts.includes('日均 150.0k'), true);
  assert.equal(subLineTexts.includes('Out 4.5k'), true);

  pendingTimeouts.clear();
});
// ============================================================================
// [MODIFIED END] 2026-11-17 22:14:47
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:34:16
// Description: Add v0.2.8 unit, E2E, static, and headless VM tests for OS/env
// HTTP(S) proxy auto-detection & NO_PROXY loopback protection, 3-channel release
// check & SHA-256 verified jsDelivr CDN hot-update fallback, and frontend toast
// tones, localized diagnostics, and update status bar error retention.
// ============================================================================
test('v0.2.8 net_proxy unit tests: URL normalization, redaction, loopback NO_PROXY, Windows/macOS parsers, and priority resolution', () => {
  assert.equal(LOOPBACK_NO_PROXY, '127.0.0.1,localhost,::1');

  // normalizeHttpProxyUrl: valid HTTP/HTTPS/bare host:port/credentials vs rejected schemes
  assert.equal(normalizeHttpProxyUrl('http://127.0.0.1:7890'), 'http://127.0.0.1:7890');
  assert.equal(normalizeHttpProxyUrl('https://proxy.example:8443/'), 'https://proxy.example:8443');
  assert.equal(normalizeHttpProxyUrl('127.0.0.1:7890'), 'http://127.0.0.1:7890');
  assert.equal(normalizeHttpProxyUrl('  "127.0.0.1:7890"  '), 'http://127.0.0.1:7890');
  assert.equal(
    normalizeHttpProxyUrl('http://user:pass@host:8080/'),
    'http://user:pass@host:8080',
  );
  for (const invalidProxy of [
    'socks5://127.0.0.1:7891',
    'socks5h://127.0.0.1:7891',
    'socks4://127.0.0.1:7891',
    'socks://127.0.0.1:7891',
    'pac+http://127.0.0.1/proxy.pac',
    'ftp://proxy.example:21',
    'ws://proxy.example:80',
    '',
    '   ',
    null,
    undefined,
    'http://host:99999',
    'not a valid proxy url!!',
  ]) {
    assert.equal(
      normalizeHttpProxyUrl(invalidProxy),
      '',
      `Expected normalizeHttpProxyUrl(${String(invalidProxy)}) to reject`,
    );
  }

  // redactProxyUrl masks embedded credentials cleanly
  assert.equal(redactProxyUrl('http://user:pass@host:8080'), 'http://***@host:8080');
  assert.equal(redactProxyUrl('http://user@host:8080'), 'http://***@host:8080');
  assert.equal(redactProxyUrl('http://127.0.0.1:7890'), 'http://127.0.0.1:7890');
  assert.equal(redactProxyUrl('socks5://127.0.0.1:7891'), '');

  // ensureLoopbackNoProxy expands <local>, normalizes ; and whitespace, deduplicates case-insensitively
  assert.equal(ensureLoopbackNoProxy(''), LOOPBACK_NO_PROXY);
  assert.equal(
    ensureLoopbackNoProxy(' <LOCAL> ; *.corp.internal ; LocalHost ; 10.0.0.0/8 ; *.CORP.INTERNAL '),
    'localhost,127.0.0.1,::1,*.corp.internal,10.0.0.0/8',
  );
  assert.equal(ensureLoopbackNoProxy('example.com;LOCALHOST'), 'example.com,LOCALHOST,127.0.0.1,::1');

  // parseWindowsRegProxyOutput: single endpoint, per-protocol (ignoring socks), and ProxyEnable 0x0
  const winSingle = parseWindowsRegProxyOutput(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    127.0.0.1:7890
    ProxyOverride    REG_SZ    localhost;127.*;10.*;<local>
`);
  assert.equal(winSingle.enabled, true);
  assert.equal(winSingle.httpProxy, 'http://127.0.0.1:7890');
  assert.equal(winSingle.httpsProxy, 'http://127.0.0.1:7890');
  assert.equal(winSingle.noProxy.includes('10.*'), true);
  assert.equal(winSingle.noProxy.includes('127.0.0.1'), true);
  assert.equal(winSingle.noProxy.includes('localhost'), true);
  assert.equal(winSingle.noProxy.includes('::1'), true);

  const winPerProto = parseWindowsRegProxyOutput(`
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    http=127.0.0.1:7890;https=127.0.0.1:7891;socks=127.0.0.1:7892
`);
  assert.equal(winPerProto.enabled, true);
  assert.equal(winPerProto.httpProxy, 'http://127.0.0.1:7890');
  assert.equal(winPerProto.httpsProxy, 'http://127.0.0.1:7891');

  const winDisabled = parseWindowsRegProxyOutput(`
    ProxyEnable    REG_DWORD    0x0
    ProxyServer    REG_SZ    127.0.0.1:7890
`);
  assert.deepEqual(winDisabled, {
    enabled: false,
    httpProxy: '',
    httpsProxy: '',
    noProxy: LOOPBACK_NO_PROXY,
  });

  // parseMacScutilProxyOutput: enabled HTTP/HTTPS + ExceptionsList vs disabled
  const macEnabled = parseMacScutilProxyOutput(`
<dictionary> {
  ExceptionsList : <array> {
    0 : *.local
    1 : 169.254/16
  }
  HTTPEnable : 1
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7891
  HTTPSProxy : 127.0.0.1
}
`);
  assert.equal(macEnabled.enabled, true);
  assert.equal(macEnabled.httpProxy, 'http://127.0.0.1:7890');
  assert.equal(macEnabled.httpsProxy, 'http://127.0.0.1:7891');
  assert.equal(macEnabled.noProxy.includes('*.local'), true);
  assert.equal(macEnabled.noProxy.includes('169.254/16'), true);
  assert.equal(macEnabled.noProxy.includes('::1'), true);

  const macDisabled = parseMacScutilProxyOutput(`
<dictionary> {
  HTTPEnable : 0
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 0
}
`);
  assert.equal(macDisabled.enabled, false);
  assert.equal(macDisabled.httpProxy, '');
  assert.equal(macDisabled.httpsProxy, '');

  // resolveProxyConfig priority order: AGY_TOKEN_MONITOR_PROXY > env > OS lookup > direct
  let osCalls = 0;
  const mockWinExec = () => {
    osCalls += 1;
    return `
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    127.0.0.1:7899
`;
  };

  const p1 = resolveProxyConfig({
    env: {
      AGY_TOKEN_MONITOR_PROXY: 'https://custom.proxy:9443/',
      HTTPS_PROXY: 'http://env.proxy:8080',
      HTTP_PROXY: 'http://env.proxy:8081',
      ALL_PROXY: 'http://all.proxy:8082',
    },
    platform: 'win32',
    execFileSyncImpl: mockWinExec,
  });
  assert.equal(p1.enabled, true);
  assert.equal(p1.source, 'custom-env');
  assert.equal(p1.httpProxy, 'https://custom.proxy:9443');
  assert.equal(p1.httpsProxy, 'https://custom.proxy:9443');
  assert.equal(osCalls, 0);

  const p2 = resolveProxyConfig({
    env: {
      HTTPS_PROXY: 'http://env-https:8443',
      HTTP_PROXY: 'http://env-http:8080',
    },
    platform: 'win32',
    execFileSyncImpl: mockWinExec,
  });
  assert.equal(p2.enabled, true);
  assert.equal(p2.source, 'env');
  assert.equal(p2.httpProxy, 'http://env-http:8080');
  assert.equal(p2.httpsProxy, 'http://env-https:8443');
  assert.equal(osCalls, 0);

  // socks5:// in ALL_PROXY safely ignored and falls through to OS lookup
  const pSocksFallback = resolveProxyConfig({
    env: { ALL_PROXY: 'socks5://127.0.0.1:7891' },
    platform: 'win32',
    execFileSyncImpl: mockWinExec,
  });
  assert.equal(pSocksFallback.enabled, true);
  assert.equal(pSocksFallback.source, 'win-registry');
  assert.equal(pSocksFallback.httpsProxy, 'http://127.0.0.1:7899');
  assert.equal(osCalls, 1);

  // macOS scutil resolution
  let macExecCmd = '';
  const pMac = resolveProxyConfig({
    env: {},
    platform: 'darwin',
    execFileSyncImpl: (cmd) => {
      macExecCmd = cmd;
      return `
HTTPEnable : 1
HTTPProxy : 127.0.0.1
HTTPPort : 6152
HTTPSEnable : 1
HTTPSProxy : 127.0.0.1
HTTPSPort : 6153
`;
    },
  });
  assert.equal(macExecCmd, '/usr/sbin/scutil');
  assert.equal(pMac.enabled, true);
  assert.equal(pMac.source, 'mac-scutil');
  assert.equal(pMac.httpProxy, 'http://127.0.0.1:6152');
  assert.equal(pMac.httpsProxy, 'http://127.0.0.1:6153');

  // DISABLE_SYSTEM_PROXY_LOOKUP: '1' skips OS exec and returns direct
  let skippedOsCalls = 0;
  const pDisabledLookup = resolveProxyConfig({
    env: { DISABLE_SYSTEM_PROXY_LOOKUP: '1' },
    platform: 'win32',
    execFileSyncImpl: () => {
      skippedOsCalls += 1;
      return 'ProxyEnable REG_DWORD 0x1\nProxyServer REG_SZ 127.0.0.1:7890\n';
    },
  });
  assert.equal(skippedOsCalls, 0);
  assert.deepEqual(pDisabledLookup, {
    enabled: false,
    source: 'direct',
    httpProxy: '',
    httpsProxy: '',
    noProxy: LOOPBACK_NO_PROXY,
  });
});

test('v0.2.8 createSystemProxyManager lifecycle, TTL cache, restore-before-set order, and real loopback NO_PROXY protection', async () => {
  // Part A: Lifecycle & TTL cache transitions with spy setGlobalProxyFn
  const envObj = { DISABLE_SYSTEM_PROXY_LOOKUP: '1' };
  let nowMs = 1_000_000;
  const events = [];

  const mgr = createSystemProxyManager({
    env: envObj,
    platform: 'win32',
    cacheTtlMs: 300_000,
    nowFn: () => nowMs,
    setGlobalProxyFn: (proxyEnv) => {
      const tag = proxyEnv.HTTPS_PROXY;
      events.push(`set:${tag}`);
      return () => {
        events.push(`restore:${tag}`);
      };
    },
  });

  // 1. Initial direct state
  const s0 = mgr.refresh();
  assert.equal(s0.enabled, false);
  assert.equal(s0.source, 'direct');
  assert.equal(s0.proxyUrl, '');
  assert.deepEqual(events, []);

  // 2. direct -> proxyA
  envObj.AGY_TOKEN_MONITOR_PROXY = 'http://user:secret@127.0.0.1:7890';
  const s1 = mgr.refresh({ force: true });
  assert.equal(s1.enabled, true);
  assert.equal(s1.source, 'custom-env');
  assert.equal(s1.proxyUrl, 'http://***@127.0.0.1:7890');
  assert.deepEqual(events, ['set:http://user:secret@127.0.0.1:7890']);

  // 3. Cached within cacheTtlMs (non-force refresh ignores env change while TTL valid)
  envObj.AGY_TOKEN_MONITOR_PROXY = 'http://127.0.0.1:8888';
  nowMs += 60_000;
  const sCached = mgr.refresh();
  assert.equal(sCached.proxyUrl, 'http://***@127.0.0.1:7890');
  assert.deepEqual(events, ['set:http://user:secret@127.0.0.1:7890']);

  // 4. Force refresh proxyA -> proxyB: MUST call restoreA BEFORE setB
  const s2 = mgr.refresh({ force: true });
  assert.equal(s2.enabled, true);
  assert.equal(s2.proxyUrl, 'http://127.0.0.1:8888');
  assert.deepEqual(events, [
    'set:http://user:secret@127.0.0.1:7890',
    'restore:http://user:secret@127.0.0.1:7890',
    'set:http://127.0.0.1:8888',
  ]);

  // 5. proxyB -> direct: MUST call restoreB and leave zero active proxy
  delete envObj.AGY_TOKEN_MONITOR_PROXY;
  const s3 = mgr.refresh({ force: true });
  assert.equal(s3.enabled, false);
  assert.equal(s3.source, 'direct');
  assert.equal(s3.proxyUrl, '');
  assert.deepEqual(events, [
    'set:http://user:secret@127.0.0.1:7890',
    'restore:http://user:secret@127.0.0.1:7890',
    'set:http://127.0.0.1:8888',
    'restore:http://127.0.0.1:8888',
  ]);
  mgr.dispose();

  // Part B: Real http.setGlobalProxyFromEnv + local loopback server with unreachable proxy port
  const localServer = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  const localPort = await listenOnFetchSafePort(localServer);
  const deadProxyPort = await pickFetchSafeFreePort();

  const realMgr = createSystemProxyManager({
    env: {
      HTTPS_PROXY: `http://127.0.0.1:${deadProxyPort}`,
      HTTP_PROXY: `http://127.0.0.1:${deadProxyPort}`,
      DISABLE_SYSTEM_PROXY_LOOKUP: '1',
    },
    setGlobalProxyFn: http.setGlobalProxyFromEnv,
  });

  try {
    const realStatus = realMgr.refresh({ force: true });
    assert.equal(realStatus.enabled, true);
    assert.equal(realStatus.noProxy, LOOPBACK_NO_PROXY);

    const loopbackRes = await fetch(`http://127.0.0.1:${localPort}/loopback-ping`);
    assert.equal(loopbackRes.status, 200);
    const loopbackBody = await loopbackRes.json();
    assert.deepEqual(loopbackBody, { ok: true, path: '/loopback-ping' });
  } finally {
    realMgr.dispose();
    await new Promise((r) => localServer.close(() => r()));
  }

  // Part C: Standalone main.mjs child process respects DISABLE_SYSTEM_PROXY_LOOKUP and NO_PROXY loopback
  const { root, appData } = makeTempEnv();
  const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(dataDir, { recursive: true });
  const fakeHome = join(root, 'home');
  mkdirSync(fakeHome, { recursive: true });

  const mockUpdateServer = createServer((req, res) => {
    if (req.url === '/releases/latest') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          tag_name: 'v0.9.5',
          name: 'Token Monitor v0.9.5',
          published_at: '2026-11-18T00:00:00Z',
          html_url: 'https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/v0.9.5',
          body: '## English\n- Loopback test',
          assets: [],
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  const mockUpdatePort = await listenOnFetchSafePort(mockUpdateServer);
  const sidecarPort = await pickFetchSafeFreePort();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
  const sdkCandidates = [
    join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
  ].filter((p) => existsSync(p));

  const env = { ...process.env };
  delete env.ANTIGRAVITY_LS_ADDRESS;
  delete env.ANTIGRAVITY_CSRF_TOKEN;
  delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
  delete env.ANTIGRAVITY_CONVERSATION_ID;
  delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
  delete env.ANTIGRAVITY_AGENTAPI_EXE;
  delete env.AGY_TOKEN_MONITOR_PROXY;
  delete env.NO_PROXY;
  delete env.no_proxy;
  if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];
  env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
  env.USERPROFILE = fakeHome;
  env.HOME = fakeHome;
  env.PRICING_SYNC_DISABLE_AUTO = '1';
  env.DISABLE_SYSTEM_PROXY_LOOKUP = '1';
  env.HTTPS_PROXY = `http://127.0.0.1:${deadProxyPort}`;
  env.HTTP_PROXY = `http://127.0.0.1:${deadProxyPort}`;
  env.RELEASE_UPDATE_API_URL = `http://127.0.0.1:${mockUpdatePort}/releases/latest`;
  env.RELEASE_UPDATE_ALLOW_LOOPBACK = '1';

  const child = spawn(process.execPath, [mainPath, '--standalone', String(sidecarPort)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${sidecarPort}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });

    const base = `http://127.0.0.1:${sidecarPort}`;
    const snapRes = await fetch(`${base}/api/snapshot`);
    assert.equal(snapRes.status, 200);
    const snap = await snapRes.json();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Update standalone /api/snapshot appVersion assertion to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Update standalone /api/snapshot appVersion assertion to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Update standalone /api/snapshot appVersion assertion to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Update standalone /api/snapshot appVersion assertion to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Update standalone /api/snapshot appVersion assertion to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Update standalone /api/snapshot appVersion assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Update standalone /api/snapshot appVersion assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Update standalone /api/snapshot appVersion assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Update standalone /api/snapshot appVersion assertion from 0.5.1 to 0.5.2.
// ============================================================================
    assert.equal(snap.appVersion, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================

    const checkRes = await fetch(`${base}/api/check-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(checkRes.status, 200);
    const checkBody = await checkRes.json();
    assert.equal(checkBody.ok, true);
    assert.equal(checkBody.updateStatus.latestTag, 'v0.9.5');
    assert.equal(checkBody.updateStatus.checkSource, 'github-api');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
    await new Promise((r) => mockUpdateServer.close(() => r()));
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.8 release_updater classifyFetchError, 3-channel fallback check, and SHA-256 verified CDN hot update', async () => {
  // 1. classifyFetchError mapping
  const cTimeout = classifyFetchError(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  assert.equal(cTimeout.errorCode, 'timeout');

  const cNetwork = classifyFetchError(
    new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:443' } }),
  );
  assert.equal(cNetwork.errorCode, 'network');
  assert.equal(cNetwork.message.includes('ECONNREFUSED'), true);

  const cRate = classifyFetchError(new Error('Release check HTTP 403'));
  assert.equal(cRate.errorCode, 'rate_limit');

  const cHttp = classifyFetchError(new Error('Release check HTTP 502'));
  assert.equal(cHttp.errorCode, 'http_error');

  // 2. checkForUpdatesNow 3-channel fallback:
  //    a) Channel 1 timeout -> Channel 2 (github-web 302) succeeds and clears stale releaseNotes/assetDigest on tag change
  const { root, appData } = makeTempEnv();
  try {
    const stateDirA = join(appData, 'check-a');
    mkdirSync(stateDirA, { recursive: true });
    let phase = 'seed';
    const updaterA = createReleaseUpdater({
      stateDir: stateDirA,
      currentVersion: '0.2.8',
      enableFallbackChannels: true,
      fetchImpl: async (url) => {
        if (phase === 'seed' && url.includes('api.github.com')) {
          return new Response(
            JSON.stringify({
              tag_name: 'v0.9.0',
              name: 'v0.9.0',
              body: 'Stale notes for v0.9.0',
              published_at: '2026-11-01T00:00:00Z',
              assets: [
                {
                  name: 'agy-token-monitor-v0.9.0.zip',
                  size: 123,
                  digest: `sha256:${'a'.repeat(64)}`,
                  browser_download_url:
                    'https://github.com/JefferyL1ang/agy-token-monitor/releases/download/v0.9.0/agy-token-monitor-v0.9.0.zip',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"etag-090"' } },
          );
        }
        if (phase === 'ch2' && url.includes('api.github.com')) {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        if (phase === 'ch2' && url.includes('github.com/JefferyL1ang/agy-token-monitor/releases/latest')) {
          return new Response(null, {
            status: 302,
            headers: {
              location: 'https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/v0.9.8',
            },
          });
        }
        if (phase === 'ch3' && url.includes('api.github.com')) {
          return new Response('rate limit exceeded', { status: 403 });
        }
        if (phase === 'ch3' && url.includes('github.com/JefferyL1ang/agy-token-monitor/releases/latest')) {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        if (phase === 'ch3' && url.includes('data.jsdelivr.com')) {
          return new Response(
            JSON.stringify({
              versions: ['0.2.7', '0.9.9', '0.9.9-rc.1', 'not-semver'],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (phase === 'allfail' && url.includes('api.github.com')) {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        if (phase === 'allfail' && url.includes('github.com/JefferyL1ang/agy-token-monitor/releases/latest')) {
          return new Response('Bad Gateway', { status: 502 });
        }
        if (phase === 'allfail' && url.includes('data.jsdelivr.com')) {
          throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET', message: 'socket hang up' } });
        }
        throw new Error(`Unexpected URL ${url}`);
      },
    });

    const seedRes = await updaterA.checkForUpdatesNow();
    assert.equal(seedRes.ok, true);
    assert.equal(seedRes.status.releaseNotes, 'Stale notes for v0.9.0');
    assert.equal(seedRes.status.checkSource, 'github-api');

    phase = 'ch2';
    const ch2Res = await updaterA.checkForUpdatesNow();
    assert.equal(ch2Res.ok, true);
    assert.equal(ch2Res.status.checkSource, 'github-web');
    assert.equal(ch2Res.status.latestVersion, '0.9.8');
    assert.equal(ch2Res.status.hasUpdate, true);
    assert.equal(ch2Res.status.error, '');
    assert.equal(ch2Res.status.errorCode, '');
    assert.equal(ch2Res.status.releaseNotes, '');
    const cacheAfterCh2 = JSON.parse(readFileSync(join(stateDirA, 'update_cache.json'), 'utf-8'));
    assert.equal(cacheAfterCh2.assetDigest, '');
    assert.equal(cacheAfterCh2.releaseNotes, '');

    //    b) Channel 1 403 + Channel 2 timeout -> Channel 3 jsDelivr picks highest stable SemVer 0.9.9
    phase = 'ch3';
    const ch3Res = await updaterA.checkForUpdatesNow();
    assert.equal(ch3Res.ok, true);
    assert.equal(ch3Res.status.checkSource, 'jsdelivr');
    assert.equal(ch3Res.status.latestVersion, '0.9.9');
    assert.equal(ch3Res.status.hasUpdate, true);

    //    c) All 3 channels fail -> ok === false, errorCode === 'timeout' from Channel 1 primaryErr
    phase = 'allfail';
    const failRes = await updaterA.checkForUpdatesNow();
    assert.equal(failRes.ok, false);
    assert.equal(failRes.status.errorCode, 'timeout');

    // 3. applyLatestUpdate CDN fallback scenarios
    const b64Sha256 = (buf) => createHash('sha256').update(buf).digest('base64');

    //    a) Primary ZIP timeout -> jsDelivr /flat + cdn.jsdelivr fails -> fastly.jsdelivr succeeds,
    //       skipping .gitignore, maintainer/, tests/
    const pluginRootCdn = join(root, 'plugin-cdn-ok');
    const stateDirCdn = join(appData, 'state-cdn-ok');
    mkdirSync(join(pluginRootCdn, 'sidecars', 'monitor_pane'), { recursive: true });
    mkdirSync(stateDirCdn, { recursive: true });
    writeFileSync(
      join(pluginRootCdn, 'plugin.json'),
      JSON.stringify({ name: 'agy-token-monitor', version: '0.2.8' }),
      'utf-8',
    );
    writeFileSync(join(pluginRootCdn, 'sidecars', 'monitor_pane', 'main.mjs'), '// orig 0.2.8\n', 'utf-8');

    const filesV099 = {
      'plugin.json': Buffer.from(JSON.stringify({ name: 'agy-token-monitor', version: '0.9.9' }), 'utf-8'),
      'README.md': Buffer.from('# agy-token-monitor v0.9.9\n', 'utf-8'),
      'sidecars/monitor_pane/main.mjs': Buffer.from('// upgraded via fastly cdn 0.9.9\n', 'utf-8'),
      'sidecars/monitor_pane/net_proxy.mjs': Buffer.from('export const PROXY_VER = "0.9.9";\n', 'utf-8'),
    };
    const skippedFiles = {
      '.gitignore': Buffer.from('maintainer/\n', 'utf-8'),
      'maintainer/secret.ps1': Buffer.from('# secret\n', 'utf-8'),
      'tests/parser.test.mjs': Buffer.from('// skipped test file\n', 'utf-8'),
    };
    const requestedSkippedUrls = [];

    const cdnUpdater = createReleaseUpdater({
      stateDir: stateDirCdn,
      pluginRoot: pluginRootCdn,
      currentVersion: '0.2.8',
      enableFallbackChannels: true,
      fetchImpl: async (url) => {
        if (url.includes('api.github.com')) {
          return new Response('rate limit', { status: 403 });
        }
        if (url.includes('github.com/JefferyL1ang/agy-token-monitor/releases/latest')) {
          throw new DOMException('timed out', 'TimeoutError');
        }
        if (url === 'https://data.jsdelivr.com/v1/package/gh/JefferyL1ang/agy-token-monitor') {
          return new Response(JSON.stringify({ versions: ['0.9.9'] }), { status: 200 });
        }
        if (url.includes('/releases/download/')) {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        if (url === 'https://data.jsdelivr.com/v1/package/gh/JefferyL1ang/agy-token-monitor@0.9.9/flat') {
          const allFlat = [...Object.entries(filesV099), ...Object.entries(skippedFiles)].map(
            ([rel, buf]) => ({
              name: `/${rel}`,
              size: buf.length,
              hash: b64Sha256(buf),
            }),
          );
          return new Response(JSON.stringify({ files: allFlat }), { status: 200 });
        }
        if (
          url.includes('/.gitignore') ||
          url.includes('/maintainer/') ||
          url.includes('/tests/')
        ) {
          requestedSkippedUrls.push(url);
          return new Response('should not be downloaded', { status: 404 });
        }
        if (url.startsWith('https://cdn.jsdelivr.net/')) {
          return new Response('CDN edge error', { status: 502 });
        }
        if (url.startsWith('https://fastly.jsdelivr.net/gh/JefferyL1ang/agy-token-monitor@0.9.9/')) {
          const rel = url.slice(
            'https://fastly.jsdelivr.net/gh/JefferyL1ang/agy-token-monitor@0.9.9/'.length,
          );
          const buf = filesV099[rel];
          if (buf) return new Response(buf, { status: 200 });
        }
        return new Response('not found', { status: 404 });
      },
    });

    const preCheck = await cdnUpdater.checkForUpdatesNow();
    assert.equal(preCheck.ok, true);
    const cdnApplyRes = await cdnUpdater.applyLatestUpdate();
    assert.equal(cdnApplyRes.ok, true);
    assert.equal(cdnApplyRes.targetVersion, '0.9.9');
    assert.equal(requestedSkippedUrls.length, 0, 'Skipped paths must never be downloaded');
    assert.equal(
      JSON.parse(readFileSync(join(pluginRootCdn, 'plugin.json'), 'utf-8')).version,
      '0.9.9',
    );
    assert.equal(
      readFileSync(join(pluginRootCdn, 'README.md'), 'utf-8'),
      '# agy-token-monitor v0.9.9\n',
    );
    assert.equal(
      readFileSync(join(pluginRootCdn, 'sidecars', 'monitor_pane', 'main.mjs'), 'utf-8'),
      '// upgraded via fastly cdn 0.9.9\n',
    );
    assert.equal(
      readFileSync(join(pluginRootCdn, 'sidecars', 'monitor_pane', 'net_proxy.mjs'), 'utf-8'),
      'export const PROXY_VER = "0.9.9";\n',
    );
    assert.equal(existsSync(join(pluginRootCdn, '.gitignore')), false);
    assert.equal(existsSync(join(pluginRootCdn, 'maintainer', 'secret.ps1')), false);
    assert.equal(existsSync(join(pluginRootCdn, 'tests', 'parser.test.mjs')), false);

    //    b) Primary ZIP timeout -> tampered CDN bytes -> rejected with integrity_failed, local files untouched
    const pluginRootTamper = join(root, 'plugin-cdn-tamper');
    const stateDirTamper = join(appData, 'state-cdn-tamper');
    mkdirSync(join(pluginRootTamper, 'sidecars', 'monitor_pane'), { recursive: true });
    mkdirSync(stateDirTamper, { recursive: true });
    writeFileSync(
      join(pluginRootTamper, 'plugin.json'),
      JSON.stringify({ name: 'agy-token-monitor', version: '0.2.8' }),
      'utf-8',
    );
    writeFileSync(
      join(pluginRootTamper, 'sidecars', 'monitor_pane', 'main.mjs'),
      '// untouched local 0.2.8\n',
      'utf-8',
    );

    const tamperUpdater = createReleaseUpdater({
      stateDir: stateDirTamper,
      pluginRoot: pluginRootTamper,
      currentVersion: '0.2.8',
      enableFallbackChannels: true,
      fetchImpl: async (url) => {
        if (url === 'https://api.github.com/repos/JefferyL1ang/agy-token-monitor/releases/latest') {
          return new Response(
            JSON.stringify({
              tag_name: 'v0.9.9',
              assets: [
                {
                  name: 'agy-token-monitor-v0.9.9.zip',
                  size: 100,
                  browser_download_url:
                    'https://github.com/JefferyL1ang/agy-token-monitor/releases/download/v0.9.9/agy-token-monitor-v0.9.9.zip',
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/releases/download/')) {
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        if (url.endsWith('/flat')) {
          return new Response(
            JSON.stringify({
              files: Object.entries(filesV099).map(([rel, buf]) => ({
                name: `/${rel}`,
                size: buf.length,
                hash: b64Sha256(buf),
              })),
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/sidecars/monitor_pane/main.mjs')) {
          return new Response(Buffer.from('// TAMPERED MALICIOUS BYTES\n', 'utf-8'), { status: 200 });
        }
        for (const [rel, buf] of Object.entries(filesV099)) {
          if (url.endsWith(`/${rel}`)) return new Response(buf, { status: 200 });
        }
        return new Response('not found', { status: 404 });
      },
    });
    await tamperUpdater.checkForUpdatesNow();
    const tamperRes = await tamperUpdater.applyLatestUpdate();
    assert.equal(tamperRes.ok, false);
    assert.equal(tamperRes.reason, 'integrity_failed');
    assert.equal(
      JSON.parse(readFileSync(join(pluginRootTamper, 'plugin.json'), 'utf-8')).version,
      '0.2.8',
    );
    assert.equal(
      readFileSync(join(pluginRootTamper, 'sidecars', 'monitor_pane', 'main.mjs'), 'utf-8'),
      '// untouched local 0.2.8\n',
    );

    //    c) Primary ZIP HTTP 200 OK with mismatched assetDigest -> integrity_failed, MUST NOT fall back to CDN
    const pluginRootNoFallback = join(root, 'plugin-no-cdn-fallback');
    const stateDirNoFallback = join(appData, 'state-no-cdn-fallback');
    mkdirSync(join(pluginRootNoFallback, 'sidecars', 'monitor_pane'), { recursive: true });
    mkdirSync(stateDirNoFallback, { recursive: true });
    writeFileSync(
      join(pluginRootNoFallback, 'plugin.json'),
      JSON.stringify({ name: 'agy-token-monitor', version: '0.2.8' }),
      'utf-8',
    );
    writeFileSync(
      join(pluginRootNoFallback, 'sidecars', 'monitor_pane', 'main.mjs'),
      '// untouched 0.2.8\n',
      'utf-8',
    );

    const validZip = buildZipBuffer([
      { name: 'agy-token-monitor/plugin.json', data: filesV099['plugin.json'] },
      { name: 'agy-token-monitor/sidecars/monitor_pane/main.mjs', data: filesV099['sidecars/monitor_pane/main.mjs'] },
    ]);
    let cdnRequestsOn200Fail = 0;

    const noFallbackUpdater = createReleaseUpdater({
      stateDir: stateDirNoFallback,
      pluginRoot: pluginRootNoFallback,
      currentVersion: '0.2.8',
      enableFallbackChannels: true,
      fetchImpl: async (url) => {
        if (url.includes('jsdelivr.net')) {
          cdnRequestsOn200Fail += 1;
          return new Response('unexpected cdn request', { status: 500 });
        }
        if (url === 'https://api.github.com/repos/JefferyL1ang/agy-token-monitor/releases/latest') {
          return new Response(
            JSON.stringify({
              tag_name: 'v0.9.9',
              assets: [
                {
                  name: 'agy-token-monitor-v0.9.9.zip',
                  size: validZip.length,
                  digest: `sha256:${'f'.repeat(64)}`,
                  browser_download_url:
                    'https://github.com/JefferyL1ang/agy-token-monitor/releases/download/v0.9.9/agy-token-monitor-v0.9.9.zip',
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/releases/download/')) {
          return new Response(validZip, { status: 200 });
        }
        return new Response('not found', { status: 404 });
      },
    });
    await noFallbackUpdater.checkForUpdatesNow();
    const digestMismatchRes = await noFallbackUpdater.applyLatestUpdate();
    assert.equal(digestMismatchRes.ok, false);
    assert.equal(digestMismatchRes.reason, 'integrity_failed');
    assert.equal(cdnRequestsOn200Fail, 0, 'Must NOT fall back to CDN when primary ZIP returns 200 OK');
    assert.equal(
      JSON.parse(readFileSync(join(pluginRootNoFallback, 'plugin.json'), 'utf-8')).version,
      '0.2.8',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.8 toast tones, I18N update error parity, static hygiene, SQLite invariants, and annotation balance', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const netProxySource = readFileSync(join(paneDir, 'net_proxy.mjs'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const releaseUpdaterSource = readFileSync(join(paneDir, 'release_updater.mjs'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  // CSS toast tones and Zero-CLS .roll-col preserved
  const stylesNoComments = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const rollColMatch = stylesNoComments.match(/(?:^|\n)\s*\.roll-col\s*\{([^}]*)\}/);
  assert.ok(rollColMatch, 'styles.css must preserve .roll-col');
  assert.match(rollColMatch[1], /display\s*:\s*inline-grid\b/);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:33:27
// Description: Update toast tone token assertions from legacy --tm-amber/--tm-rose to v0.5.0 --tm-warning/--tm-danger.
// ============================================================================
  const warnToastMatch = stylesNoComments.match(/(?:^|\n)\s*\.toast-banner\.is-warn\s*\{([^}]*)\}/);
  assert.ok(warnToastMatch, 'styles.css must define .toast-banner.is-warn');
  assert.match(warnToastMatch[1], /--tm-warning\b/);

  const errToastMatch = stylesNoComments.match(/(?:^|\n)\s*\.toast-banner\.is-error\s*\{([^}]*)\}/);
  assert.ok(errToastMatch, 'styles.css must define .toast-banner.is-error');
  assert.match(errToastMatch[1], /--tm-danger\b/);
// ============================================================================
// [MODIFIED END] 2026-11-20 10:33:27
// ============================================================================

  // I18N zh/en parity + v0.2.8 update diagnostic keys
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object should exist in app.js');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks should be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());

  for (const key of ['update.errTimeout', 'update.errRateLimit', 'update.errNetwork']) {
    assert.ok(zhEntries.has(key) && zhEntries.get(key).length > 0, `I18N.zh must define ${key}`);
    assert.ok(enEntries.has(key) && enEntries.get(key).length > 0, `I18N.en must define ${key}`);
  }

  const extractPlaceholders = (str) => [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `Placeholder mismatch for I18N key "${key}"`,
    );
  }

  // Zero unsafe DOM APIs in app.js
  assert.equal(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(appSource), false);

  // Zero banned strings across all files including net_proxy.mjs & release_updater.mjs
  const bannedTerm = '\u6c34\u4f4d';
  const legacyUiTerm = '\u5728\u5f79\u6a21\u578b';
  const legacyDocPhrase = 'Dedicated ' + 'Gemini 3.1 Pro';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['main.mjs', mainSource],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Include clipboard_image.mjs in balanced annotation checks.
// ============================================================================
    ['clipboard_image.mjs', readFileSync(join(paneDir, 'clipboard_image.mjs'), 'utf-8')],
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
    ['net_proxy.mjs', netProxySource],
    ['parser.mjs', parserSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    assert.equal(src.includes(bannedTerm), false, `${label} must not contain banned term`);
  }
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['I18N.zh', i18nMatch[1]],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
  ]) {
    assert.equal(src.includes(legacyUiTerm), false, `${label} must not contain legacy active-model term`);
  }
  assert.equal(readmeMd.includes(legacyDocPhrase), false);
  assert.equal(skillMd.includes(legacyDocPhrase), false);

  // Balanced code-modification annotations across all modified files
  const modBeginMarker = '[' + 'MODIFIED BEGIN]';
  const modEndMarker = '[' + 'MODIFIED END]';
  for (const [label, src] of [
    ['net_proxy.mjs', netProxySource],
    ['main.mjs', mainSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    let depth = 0;
    let minDepth = 0;
    let begins = 0;
    let ends = 0;
    for (const line of src.split(/\r?\n/)) {
      if (line.includes(modBeginMarker)) {
        depth += 1;
        begins += 1;
      }
      if (line.includes(modEndMarker)) {
        depth -= 1;
        ends += 1;
        if (depth < minDepth) minDepth = depth;
      }
    }
    assert.ok(begins > 0, `${label} must contain modification annotations`);
    assert.equal(begins, ends, `${label} begin/end annotation count mismatch`);
    assert.equal(depth, 0, `${label} unclosed modification annotation (depth=${depth})`);
    assert.equal(minDepth, 0, `${label} unmatched end annotation (minDepth=${minDepth})`);
  }

  // SQLite read-only invariant and strict JSON manifest validation
  assert.match(parserSource, /new\s+DatabaseSync\([^)]*\{\s*readOnly:\s*true\s*,\s*timeout:\s*2500\s*\}/);
  const pluginJson = JSON.parse(readFileSync(join(repoRoot, 'plugin.json'), 'utf-8'));
  const packageJson = JSON.parse(readFileSync(join(paneDir, 'package.json'), 'utf-8'));
  const sidecarJson = JSON.parse(readFileSync(join(paneDir, 'sidecar.json'), 'utf-8'));
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump current manifest version assertions in v0.2.8 hygiene test to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump current manifest version assertions in v0.2.8 hygiene test from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(pluginJson.version, '0.5.2');
  assert.equal(packageJson.version, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================
  assert.ok(sidecarJson && typeof sidecarJson === 'object');
});

test('v0.2.8 headless Node VM behavioral tests: formatUpdateErrorMessage, showToast tone/ARIA/timer, and renderUpdateCheckStatus', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const appPath = join(testDir, '..', 'sidecars', 'monitor_pane', 'app.js');
  const appSource = readFileSync(appPath, 'utf-8');

  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0, 'app.js must end with IIFE closing })();');

  const instrumentedSource =
    appSource.slice(0, iifeCloseIdx) +
    `\n  globalThis.__tmV028Exports = {\n` +
    `    state,\n` +
    `    t,\n` +
    `    showToast,\n` +
    `    formatUpdateErrorMessage,\n` +
    `    getCurrentAppVersion,\n` +
    `    renderUpdateCheckStatus,\n` +
    `  };\n` +
    appSource.slice(iifeCloseIdx);

  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }

  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }

  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.disabled = false;
      this.style = {
        cssText: '',
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
      };
    }

    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }

    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') {
        const tn = new FakeTextNode(str);
        tn.parentNode = this;
        this.childNodes.push(tn);
      }
    }

    setAttribute(name, val) {
      this.attributes.set(String(name), String(val));
    }
    getAttribute(name) {
      const k = String(name);
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    removeAttribute(name) {
      this.attributes.delete(String(name));
    }
    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    remove() {
      this.parentNode = null;
    }
  }

  const elementsById = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);

  const fakeDocument = {
    readyState: 'loading',
    hidden: false,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const key = String(id);
      if (!elementsById.has(key)) {
        const elem = new FakeElement('div');
        elem.setAttribute('id', key);
        rootBody.appendChild(elem);
        elementsById.set(key, elem);
      }
      return elementsById.get(key);
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  let nextTimerId = 1;
  const scheduledTimeouts = [];
  const pendingTimeouts = new Map();
  const fakeSetTimeout = (fn, ms = 0) => {
    const id = nextTimerId++;
    const delay = Number(ms) || 0;
    scheduledTimeouts.push(delay);
    pendingTimeouts.set(id, { id, fn, ms: delay });
    return id;
  };
  const fakeClearTimeout = (id) => {
    pendingTimeouts.delete(id);
  };
  const flushTimeouts = (maxDelayMs = Infinity) => {
    for (const [id, entry] of [...pendingTimeouts.entries()]) {
      if (entry.ms <= maxDelayMs) {
        pendingTimeouts.delete(id);
        entry.fn();
      }
    }
  };

  const sandbox = {
    Node: FakeNode,
    document: fakeDocument,
    window: {
      addEventListener: () => {},
      matchMedia: () => ({ matches: false }),
      sidecar: { conversationId: 'conv-vm-v028' },
      location: { reload: () => {} },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: 'rgb(246, 247, 249)' }),
    AbortController,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    requestAnimationFrame: (cb) => fakeSetTimeout(cb, 16),
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    setInterval: () => nextTimerId++,
    clearInterval: () => {},
    console,
    URLSearchParams,
    Intl,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(instrumentedSource, sandbox);
  const exports = sandbox.__tmV028Exports;
  assert.ok(exports, 'VM execution must expose __tmV028Exports');

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:58:45
// Description: Update getCurrentAppVersion fallback assertion to 0.2.9.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Update getCurrentAppVersion fallback assertion to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Update getCurrentAppVersion fallback assertion to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Update getCurrentAppVersion fallback assertion to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Update getCurrentAppVersion fallback assertion in v0.2.8 VM test to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Update getCurrentAppVersion fallback assertion in v0.2.8 VM test to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Update getCurrentAppVersion fallback assertion in v0.2.8 VM test to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Update getCurrentAppVersion fallback assertion in v0.2.8 VM test to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Update getCurrentAppVersion fallback assertion in v0.2.8 VM test from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(exports.getCurrentAppVersion(), '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:58:45
// ============================================================================

  // 1. formatUpdateErrorMessage in zh & en
  exports.state.lang = 'zh';
  assert.equal(
    exports.formatUpdateErrorMessage('The operation was aborted due to timeout', 'timeout'),
    exports.t('update.errTimeout'),
  );
  assert.equal(
    exports.formatUpdateErrorMessage('Release check HTTP 403', 'rate_limit'),
    exports.t('update.errRateLimit'),
  );
  assert.equal(
    exports.formatUpdateErrorMessage('fetch failed', 'network'),
    exports.t('update.errNetwork'),
  );

  exports.state.lang = 'en';
  assert.equal(
    exports.formatUpdateErrorMessage('The operation was aborted due to timeout', 'timeout'),
    exports.t('update.errTimeout'),
  );
  assert.equal(
    exports.formatUpdateErrorMessage('Release check HTTP 429', 'rate_limit'),
    exports.t('update.errRateLimit'),
  );
  assert.equal(
    exports.formatUpdateErrorMessage('connect ECONNREFUSED', ''),
    exports.t('update.errNetwork'),
  );

  // 2. showToast tones, ARIA roles, and 4200ms vs 2600ms timeouts
  const banner = fakeDocument.getElementById('toast-banner');

  scheduledTimeouts.length = 0;
  exports.showToast('Update check failed', 'error');
  assert.equal(banner.className, 'toast-banner is-error');
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.equal(banner.textContent, 'Update check failed');
  assert.equal(scheduledTimeouts[scheduledTimeouts.length - 1], 4200);
  flushTimeouts(2600);
  assert.equal(banner.classList.contains('hidden'), false, 'error toast must stay visible at 2600ms');
  flushTimeouts(4200);
  assert.equal(banner.classList.contains('hidden'), true, 'error toast must hide at 4200ms');

  scheduledTimeouts.length = 0;
  exports.showToast('Sync warning', 'warn');
  assert.equal(banner.className, 'toast-banner is-warn');
  assert.equal(banner.getAttribute('role'), 'status');
  assert.equal(scheduledTimeouts[scheduledTimeouts.length - 1], 4200);

  scheduledTimeouts.length = 0;
  exports.showToast('Saved');
  assert.equal(banner.className, 'toast-banner');
  assert.equal(banner.getAttribute('role'), 'status');
  assert.equal(scheduledTimeouts[scheduledTimeouts.length - 1], 2600);

  // 3. renderUpdateCheckStatus keeps is-offline error status even when lastCheckedAtMs is non-null
  const statusEl = fakeDocument.getElementById('update-version-status');
  exports.state.updateChecking = false;
  exports.state.updateApplying = false;
  exports.state.activeUpdateStatus = {
    currentVersion: '0.2.8',
    hasUpdate: false,
    lastCheckedAtMs: Date.now() - 60_000,
    error: 'The operation was aborted due to timeout',
    errorCode: 'timeout',
  };

  exports.state.lang = 'en';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.classList.contains('is-offline'), true);
  assert.equal(statusEl.textContent, exports.t('settings.verCheckError', { cur: '0.2.8' }));
  assert.equal(statusEl.title.includes(exports.t('update.errTimeout')), true);

  exports.state.lang = 'zh';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.classList.contains('is-offline'), true);
  assert.equal(statusEl.textContent, exports.t('settings.verCheckError', { cur: '0.2.8' }));
  assert.equal(statusEl.title.includes(exports.t('update.errTimeout')), true);

  // Clearing error restores up-to-date state
  exports.state.activeUpdateStatus.error = '';
  exports.state.activeUpdateStatus.errorCode = '';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.classList.contains('is-offline'), false);
  assert.equal(statusEl.textContent, exports.t('settings.verUpToDate', { cur: '0.2.8' }));

  pendingTimeouts.clear();
});
// ============================================================================
// [MODIFIED END] 2026-11-18 10:34:16
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 12:01:00
// Description: Add comprehensive v0.2.9 unit, standalone HTTP, static hygiene, and
// headless Node VM tests for sortChildrenByActivity, Swarm + manage_subagents
// killed detection & ETag invalidation, computeMergedActiveDurationMs, compactionsCount,
// dual-scope receipt (today + all) with fork-deduplication parity, receipt.js
// Canvas renderer + /receipt.js route, Top-5 children folding + 400px scroll
// preservation, and #receipt-modal workflow.
// ============================================================================
test('v0.2.9 backend sortChildrenByActivity, Swarm + manage_subagents killed detection, updatedAtMs, and ETag invalidation', () => {
  clearParserCache();

  // 1. Direct unit tests for sortChildrenByActivity:
  // Tier 0 (GENERATING, !killed) -> Tier 1 (RUNNING_TOOLS, !killed) -> Tier 2 (IDLE or killed),
  // sorted strictly by updatedAtMs descending within each tier (with _lastSeq, _spawnOrder, name tie-breakers).
  assert.deepEqual(sortChildrenByActivity(null), []);
  const frozenSample = Object.freeze([
    { conversationId: 'c-audit', name: 'audit', status: 'IDLE', killed: true, updatedAtMs: 1000 },
    { conversationId: 'c-ship', name: 'v028ship', status: 'IDLE', killed: false, updatedAtMs: 8000 },
    { conversationId: 'c-killed-gen', name: 'killedGen', status: 'GENERATING', killed: true, updatedAtMs: 6000 },
    { conversationId: 'c-tools-old', name: 'toolsOld', status: 'RUNNING_TOOLS', killed: false, updatedAtMs: 3000 },
    { conversationId: 'c-gen-old', name: 'genOld', status: 'GENERATING', killed: false, updatedAtMs: 4000 },
    { conversationId: 'c-tools-new', name: 'toolsNew', status: 'RUNNING_TOOLS', killed: false, updatedAtMs: 9000 },
    { conversationId: 'c-gen-new', name: 'genNew', status: 'GENERATING', killed: false, updatedAtMs: 5000 },
    { conversationId: 'c-seq-low', name: 'seqLow', status: 'IDLE', killed: false, updatedAtMs: 2000, _lastSeq: 80, _spawnOrder: 5 },
    { conversationId: 'c-seq-high', name: 'seqHigh', status: 'IDLE', killed: false, updatedAtMs: 2000, _lastSeq: 120, _spawnOrder: 1 },
  ]);
  const sortedFrozen = sortChildrenByActivity(frozenSample);
  assert.deepEqual(
    sortedFrozen.map((c) => c.name),
    [
      'genNew',
      'genOld',
      'toolsNew',
      'toolsOld',
      'v028ship',
      'killedGen',
      'seqHigh',
      'seqLow',
      'audit',
    ],
  );
  // Explicitly verify old killed 'audit' sinks below newer 'v028ship'
  assert.ok(
    sortedFrozen.findIndex((c) => c.name === 'v028ship') <
      sortedFrozen.findIndex((c) => c.name === 'audit'),
    'Newer v028ship must rank above old killed audit',
  );

  // 2. analyzeConversation() on a Swarm coordinator (members.json killed, phase: KILLED, desired_state: KILLED, active workers) + ETag invalidation
  const { root, appData } = makeTempEnv();
  try {
    const baseMs = Date.parse('2026-11-18T02:00:00Z');
    const coordId = '02900000-0000-4000-8000-000000000001';
    const wGenId = '02900000-0000-4000-8000-000000000002';
    const wToolsId = '02900000-0000-4000-8000-000000000003';
    const wShipId = '02900000-0000-4000-8000-000000000004';
    const wPhaseKilledId = '02900000-0000-4000-8000-000000000005';
    const wAuditId = '02900000-0000-4000-8000-000000000006';
    const wDesiredKilledId = '02900000-0000-4000-8000-000000000007'; // intentionally missing transcript

    const initialMembers = {
      title: 'v0.2.9 Swarm Killed & Activity Test',
      members: {
        coordinator: { conversation_id: coordId, role: 'coordinator', model: 'gemini-4-argon' },
        audit: {
          conversation_id: wAuditId,
          role: 'worker',
          model: 'gemini-3.8-flash',
          killed: true,
          last_read_seq: 12,
        },
        wPhaseKilled: {
          conversation_id: wPhaseKilledId,
          role: 'worker',
          model: 'gemini-3.8-flash',
          phase: 'KILLED',
        },
        wDesiredKilled: {
          conversation_id: wDesiredKilledId,
          role: 'worker',
          model: 'gemini-3.8-flash',
          desired_state: 'KILLED',
        },
        v028ship: {
          conversation_id: wShipId,
          role: 'worker',
          model: 'gemini-4-carbon',
          killed: false,
          state: 'waiting',
          last_read_seq: 99,
        },
        wTools: {
          conversation_id: wToolsId,
          role: 'worker',
          model: 'gemini-4-carbon',
          state: 'working',
        },
        wGen: {
          conversation_id: wGenId,
          role: 'worker',
          model: 'gemini-4-argon',
          state: 'working',
        },
      },
    };

    writeConversation(appData, coordId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs).toISOString(),
          content: '<USER_REQUEST>Coordinate v0.2.9 swarm</USER_REQUEST>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 2000).toISOString(),
          input_tokens: 5000,
          cache_read_tokens: 1000,
          output_tokens: 400,
        },
      ],
      members: initialMembers,
      mtimeMs: baseMs + 2000,
    });

    // wGen: ends on USER_INPUT -> GENERATING
    writeConversation(appData, wGenId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 90_000).toISOString(),
          content: 'Generate tests',
        },
      ],
      mtimeMs: baseMs + 90_000,
    });

    // wTools: ends on PLANNER_RESPONSE with pending tool_calls -> RUNNING_TOOLS
    writeConversation(appData, wToolsId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 75_000).toISOString(),
          content: 'Run checks',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 80_000).toISOString(),
          input_tokens: 3000,
          cache_read_tokens: 0,
          output_tokens: 200,
          tool_calls: [{ name: 'run_command', args: { toolSummary: 'Run test suite' } }],
        },
      ],
      mtimeMs: baseMs + 80_000,
    });

    // v028ship: active waiting worker, IDLE, newer updatedAtMs (baseMs + 70_000)
    writeConversation(appData, wShipId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 68_000).toISOString(),
          content: 'Ship release',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 70_000).toISOString(),
          input_tokens: 4000,
          cache_read_tokens: 2000,
          output_tokens: 300,
        },
      ],
      mtimeMs: baseMs + 70_000,
    });

    // wPhaseKilled: phase === 'KILLED', even though transcript ends on USER_INPUT -> must report status === 'IDLE' and killed === true
    writeConversation(appData, wPhaseKilledId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 60_000).toISOString(),
          content: 'Aborted worker',
        },
      ],
      mtimeMs: baseMs + 60_000,
    });

    // audit: killed === true, older updatedAtMs (baseMs + 20_000)
    writeConversation(appData, wAuditId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 18_000).toISOString(),
          content: 'Old audit',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 20_000).toISOString(),
          input_tokens: 2000,
          cache_read_tokens: 0,
          output_tokens: 150,
        },
      ],
      mtimeMs: baseMs + 20_000,
    });

    const swarmRes1 = analyzeConversation(coordId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(swarmRes1.children.length, 6);
    assert.deepEqual(
      swarmRes1.children.map((c) => c.name),
      ['wGen', 'wTools', 'v028ship', 'wPhaseKilled', 'audit', 'wDesiredKilled'],
    );

    const byName1 = new Map(swarmRes1.children.map((c) => [c.name, c]));
    assert.equal(byName1.get('wGen').status, 'GENERATING');
    assert.equal(byName1.get('wGen').killed, false);
    assert.equal(byName1.get('wGen').updatedAtMs, baseMs + 90_000);

    assert.equal(byName1.get('wTools').status, 'RUNNING_TOOLS');
    assert.equal(byName1.get('wTools').killed, false);
    assert.equal(byName1.get('wTools').updatedAtMs, baseMs + 80_000);

    assert.equal(byName1.get('v028ship').status, 'IDLE');
    assert.equal(byName1.get('v028ship').killed, false);
    assert.equal(byName1.get('v028ship').updatedAtMs, baseMs + 70_000);

    // Backward compatibility: killed workers expose status === 'IDLE' and generatingSinceMs === null
    assert.equal(byName1.get('wPhaseKilled').status, 'IDLE');
    assert.equal(byName1.get('wPhaseKilled').killed, true);
    assert.equal(byName1.get('wPhaseKilled').generatingSinceMs, null);
    assert.equal(byName1.get('wPhaseKilled').updatedAtMs, baseMs + 60_000);

    assert.equal(byName1.get('audit').status, 'IDLE');
    assert.equal(byName1.get('audit').killed, true);
    assert.equal(byName1.get('audit').updatedAtMs, baseMs + 20_000);

    assert.equal(byName1.get('wDesiredKilled').status, 'IDLE');
    assert.equal(byName1.get('wDesiredKilled').killed, true);
    assert.equal(byName1.get('wDesiredKilled').updatedAtMs, null);

    for (const ch of swarmRes1.children) {
      assert.equal('_lastSeq' in ch, false, 'Internal _lastSeq key must be stripped');
      assert.equal('_spawnOrder' in ch, false, 'Internal _spawnOrder key must be stripped');
    }

    // Flip v028ship to killed: true in members.json without modifying any transcript -> _etagPart MUST change immediately!
    const etagBeforeKill = swarmRes1._etagPart;
    assert.equal(etagBeforeKill.includes(`${wShipId}:`), true);
    assert.equal(etagBeforeKill.includes(`${wDesiredKilledId}:missing:1`), true);

    const updatedMembers = JSON.parse(JSON.stringify(initialMembers));
    updatedMembers.members.v028ship.killed = true;
    writeFileSync(
      join(appData, 'brain', coordId, '.system_generated', 'swarm', 'members.json'),
      JSON.stringify(updatedMembers, null, 2),
      'utf-8',
    );

    const swarmRes2 = analyzeConversation(coordId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.notEqual(
      swarmRes2._etagPart,
      etagBeforeKill,
      '_etagPart must invalidate when members.json flips a worker to killed: true',
    );
    const shipAfter = swarmRes2.children.find((c) => c.name === 'v028ship');
    assert.equal(shipAfter.killed, true);
    assert.equal(shipAfter.status, 'IDLE');

    // 3. analyzeConversation() on a parent session calling manage_subagents (kill & kill_all, including truncated tool_calls)
    const subParentId = '02910000-0000-4000-8000-000000000001';
    const sub1Id = '02910000-0000-4000-8000-000000000011';
    const sub2Id = '02910000-0000-4000-8000-000000000012';
    const sub3Id = '02910000-0000-4000-8000-000000000013';
    const sub4Id = '02910000-0000-4000-8000-000000000014';
    const sub5Id = '02910000-0000-4000-8000-000000000015'; // alive, missing transcript -> fallback invokedAtMs

    const compactParentSteps = [
      {
        step_index: 0,
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: new Date(baseMs + 1000).toISOString(),
        content: '<USER_REQUEST>Spawn subagents</USER_REQUEST>',
      },
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date(baseMs + 5000).toISOString(),
        input_tokens: 2000,
        cache_read_tokens: 0,
        output_tokens: 100,
        tool_calls: [
          {
            name: 'invoke_subagent',
            args: {
              Subagents: [
                { Name: 'subOne', Model: 'gemini-3.8-flash' },
                { Name: 'subTwo', Model: 'gemini-3.8-flash' },
              ],
            },
          },
        ],
      },
      {
        step_index: 2,
        type: 'GENERIC',
        status: 'DONE',
        created_at: new Date(baseMs + 6000).toISOString(),
        content: `Spawned ${sub1Id} and ${sub2Id}`,
      },
      {
        step_index: 3,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date(baseMs + 25_000).toISOString(),
        input_tokens: 2500,
        cache_read_tokens: 1500,
        output_tokens: 80,
        tool_calls: [
          {
            name: 'manage_subagents',
            args: { Action: 'kill_all' },
          },
        ],
      },
      {
        step_index: 4,
        type: 'GENERIC',
        status: 'DONE',
        created_at: new Date(baseMs + 26_000).toISOString(),
        content: 'Killed all active subagents',
      },
      {
        step_index: 5,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date(baseMs + 55_000).toISOString(),
        input_tokens: 3000,
        cache_read_tokens: 2000,
        output_tokens: 120,
        tool_calls: [
          {
            name: 'invoke_subagent',
            args: {
              Subagents: [
                { Name: 'subThree', Model: 'gemini-4-carbon' },
                { Name: 'subFour', Model: 'gemini-4-carbon' },
                { Name: 'subFiveAlive', Model: 'gemini-4-argon' },
              ],
            },
          },
        ],
      },
      {
        step_index: 6,
        type: 'GENERIC',
        status: 'DONE',
        created_at: new Date(baseMs + 56_000).toISOString(),
        content: `Spawned ${sub3Id}, ${sub4Id}, and ${sub5Id}`,
      },
      {
        step_index: 7,
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: new Date(baseMs + 85_000).toISOString(),
        input_tokens: 3500,
        cache_read_tokens: 2500,
        output_tokens: 90,
        truncated_fields: ['tool_calls'],
        tool_calls: [{ name: 'manage_subagents', args: {} }],
      },
      {
        step_index: 8,
        type: 'GENERIC',
        status: 'DONE',
        created_at: new Date(baseMs + 86_000).toISOString(),
        content: 'Killed selected subagents',
      },
    ];

    const fullParentSteps = compactParentSteps.map((s) =>
      s.step_index === 7
        ? {
            ...s,
            truncated_fields: undefined,
            tool_calls: [
              {
                name: 'manage_subagents',
                args: { Action: 'kill', ConversationIds: JSON.stringify([sub3Id]) },
              },
              {
                name: 'manage_subagents',
                args: { action: 'kill', conversationIds: [sub4Id] },
              },
            ],
          }
        : s,
    );

    writeConversation(appData, subParentId, {
      compactLines: compactParentSteps,
      fullLines: fullParentSteps,
      mtimeMs: baseMs + 86_000,
    });

    for (const [cid, offsetMs, endsGenerating] of [
      [sub1Id, 15_000, false],
      [sub2Id, 22_000, false],
      [sub3Id, 72_000, true],
      [sub4Id, 78_000, false],
    ]) {
      writeConversation(appData, cid, {
        compactLines: endsGenerating
          ? [
              {
                step_index: 0,
                type: 'USER_INPUT',
                status: 'DONE',
                created_at: new Date(baseMs + offsetMs).toISOString(),
                content: 'Still had pending prompt before kill',
              },
            ]
          : [
              {
                step_index: 0,
                type: 'USER_INPUT',
                status: 'DONE',
                created_at: new Date(baseMs + offsetMs - 1000).toISOString(),
                content: 'Subagent task',
              },
              {
                step_index: 1,
                type: 'PLANNER_RESPONSE',
                status: 'DONE',
                created_at: new Date(baseMs + offsetMs).toISOString(),
                input_tokens: 1200,
                cache_read_tokens: 0,
                output_tokens: 100,
              },
            ],
        mtimeMs: baseMs + offsetMs,
      });
    }

    const subParentRes = analyzeConversation(subParentId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(subParentRes.children.length, 5);
    const subMap = new Map(subParentRes.children.map((c) => [c.name, c]));

    // subOne & subTwo killed via kill_all (stepIdx < 3)
    assert.equal(subMap.get('subOne').killed, true);
    assert.equal(subMap.get('subOne').status, 'IDLE');
    assert.equal(subMap.get('subTwo').killed, true);
    assert.equal(subMap.get('subTwo').status, 'IDLE');

    // subThree & subFour killed via manage_subagents kill recovered from transcript_full.jsonl; subFiveAlive survives!
    assert.equal(subMap.get('subThree').killed, true);
    assert.equal(subMap.get('subThree').status, 'IDLE');
    assert.equal(subMap.get('subThree').generatingSinceMs, null);
    assert.equal(subMap.get('subFour').killed, true);
    assert.equal(subMap.get('subFour').status, 'IDLE');

    assert.equal(subMap.get('subFiveAlive').killed, false);
    assert.equal(subMap.get('subFiveAlive').status, 'IDLE');
    assert.equal(subMap.get('subFiveAlive').updatedAtMs, baseMs + 55_000);
    assert.equal(subParentRes._etagPart.includes(`${sub5Id}:missing:0`), true);
    assert.equal(subParentRes._etagPart.includes(':1'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.9 computeMergedActiveDurationMs, compactionsCount, and dual-scope receipt (today + all) with fork-deduplication parity', () => {
  clearParserCache();

  // 1. Direct unit tests for computeMergedActiveDurationMs (<= 30m gap merged, 2h break excluded, unsorted & overlapping intervals)
  assert.equal(computeMergedActiveDurationMs([]), 0);
  assert.equal(computeMergedActiveDurationMs(null), 0);

  const B = new Date(2026, 10, 18, 9, 0, 0, 0).getTime();
  const MIN = 60_000;
  const intervals = [
    // Afternoon block after a 2h (120m > 30m) idle break — unsorted + overlapping + object form
    { start: B + 190 * MIN, end: B + 205 * MIN },
    [B + 185 * MIN, B + 195 * MIN],
    // Morning block: [0, 10], [15, 25] (5m gap), and [55, 65] (exact 30m gap!) -> merges to [0, 65] = 65m
    [B + 55 * MIN, B + 65 * MIN],
    [B + 15 * MIN, B + 25 * MIN],
    [B + 0 * MIN, B + 10 * MIN],
  ];
  // Expected: 65m morning + 20m ([185m, 205m]) afternoon = 85m (2h break from 65m..185m excluded!)
  assert.equal(computeMergedActiveDurationMs(intervals), 85 * MIN);

  // 2. Multi-day SQLite conversation (yesterday + today with 2 today COMPACTION_SUMMARY steps, 8 workers, and fork deduplication)
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });

    const parentId = '02920000-0000-4000-8000-000000000001';
    const workerIds = Array.from({ length: 8 }, (_, idx) =>
      `02920000-0000-4000-8000-00000000010${idx + 1}`,
    );

    const yTime = (h, m) => new Date(2026, 10, 17, h, m, 0, 0).getTime(); // 2026-11-17 local
    const tTime = (h, m) => new Date(2026, 10, 18, h, m, 0, 0).getTime(); // 2026-11-18 local
    const nowMs = tTime(16, 30);

    function writeDbSteps(dbPath, stepSpecs) {
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
      `);
      const insGen = db.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)');
      const insStep = db.prepare(
        'INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)',
      );

      stepSpecs.forEach((spec, genIdx) => {
        const usageBuf = encodeTokenUsage({
          enumId: spec.enumId ?? 1419,
          input: spec.input,
          cacheRead: spec.cacheRead,
          output: spec.output,
          botId: spec.botId,
        });
        if ((spec.stepType ?? 15) !== 23) {
          const genInner = Buffer.concat([
            encodeBytesField(4, usageBuf),
            encodeBytesField(19, spec.rawModel || 'gemini-4-argon-high'),
            encodeBytesField(20, encodeGenKv('cascade_id', spec.originCascadeId)),
            encodeBytesField(21, spec.displayModel || 'Gemini 4 Argon (High)'),
          ]);
          const genTop = Buffer.concat([
            encodeBytesField(1, genInner),
            encodeBytesField(2, encodeVarint(spec.stepIdx)),
          ]);
          insGen.run(genIdx, genTop, genTop.length);
        }

        const metaBuf = Buffer.concat([
          encodeBytesField(1, encodeTimestampMs(spec.createdMs)),
          encodeBytesField(7, encodeTimestampMs(spec.completedMs)),
          encodeBytesField(9, usageBuf),
          encodeBytesField(
            20,
            encodeStepField20({
              stepIdx: spec.stepIdx,
              genIdx,
              originCascadeId: spec.originCascadeId,
            }),
          ),
        ]);
        insStep.run(spec.stepIdx, spec.stepType ?? 15, 3, metaBuf);
      });
      db.close();
    }

    // Parent steps:
    // - Yesterday (2026-11-17): 1 planner step (10:00..10:05) + 1 COMPACTION_SUMMARY (10:20..10:21) -> 21m merged
    // - Today (2026-11-18):
    //   Morning: 09:00..09:10 + COMPACTION_SUMMARY #1 at 09:25..09:26 -> 26m merged
    //   2h+ idle break (09:26 -> 11:30)
    //   Afternoon: 11:30..11:40 + COMPACTION_SUMMARY #2 at 11:45..11:46 (extended to 11:50 by w1 -> 20m merged)
    const parentSteps = [
      {
        stepIdx: 1,
        stepType: 15,
        originCascadeId: parentId,
        botId: 'bot-main-y1',
        input: 20_000,
        cacheRead: 10_000,
        output: 4_000,
        createdMs: yTime(10, 0),
        completedMs: yTime(10, 5),
      },
      {
        stepIdx: 2,
        stepType: 23, // COMPACTION_SUMMARY (yesterday)
        originCascadeId: parentId,
        botId: 'bot-comp-y1',
        input: 30_000,
        cacheRead: 0,
        output: 1_500,
        createdMs: yTime(10, 20),
        completedMs: yTime(10, 21),
      },
      {
        stepIdx: 3,
        stepType: 15,
        originCascadeId: parentId,
        botId: 'bot-main-t1',
        input: 12_000,
        cacheRead: 8_000,
        output: 3_000,
        createdMs: tTime(9, 0),
        completedMs: tTime(9, 10),
      },
      {
        stepIdx: 4,
        stepType: 23, // COMPACTION_SUMMARY #1 today
        originCascadeId: parentId,
        botId: 'bot-comp-t1',
        input: 20_000,
        cacheRead: 0,
        output: 1_000,
        createdMs: tTime(9, 25),
        completedMs: tTime(9, 26),
      },
      {
        stepIdx: 5,
        stepType: 15,
        originCascadeId: parentId,
        botId: 'bot-main-t2',
        input: 15_000,
        cacheRead: 25_000,
        output: 5_000,
        createdMs: tTime(11, 30),
        completedMs: tTime(11, 40),
      },
      {
        stepIdx: 6,
        stepType: 23, // COMPACTION_SUMMARY #2 today
        originCascadeId: parentId,
        botId: 'bot-comp-t2',
        input: 40_000,
        cacheRead: 0,
        output: 1_200,
        createdMs: tTime(11, 45),
        completedMs: tTime(11, 46),
      },
    ];
    writeDbSteps(join(convsDir, `${parentId}.db`), parentSteps);

    // Worker 1 (w1): forked from coordinator (clones parentSteps[0..2] with originCascadeId: parentId) + own today step extending afternoon to 11:50
    writeDbSteps(join(convsDir, `${workerIds[0]}.db`), [
      ...parentSteps.slice(0, 3),
      {
        stepIdx: 10,
        stepType: 15,
        originCascadeId: workerIds[0],
        botId: 'bot-w1-own',
        input: 18_000,
        cacheRead: 12_000,
        output: 4_000,
        createdMs: tTime(11, 35),
        completedMs: tTime(11, 50),
      },
    ]);

    // Worker 2 (w2): includes a duplicate botId ('bot-w1-own') shared with w1 + its own unique today step ('bot-w2-own')
    writeDbSteps(join(convsDir, `${workerIds[1]}.db`), [
      {
        stepIdx: 1,
        stepType: 15,
        originCascadeId: workerIds[1],
        botId: 'bot-w1-own', // duplicate botId across workers -> must be deduplicated in both withChildren and receipt!
        input: 18_000,
        cacheRead: 12_000,
        output: 4_000,
        createdMs: tTime(11, 36),
        completedMs: tTime(11, 38),
      },
      {
        stepIdx: 2,
        stepType: 15,
        originCascadeId: workerIds[1],
        botId: 'bot-w2-own',
        input: 10_000,
        cacheRead: 5_000,
        output: 2_500,
        createdMs: tTime(11, 38),
        completedMs: tTime(11, 44),
      },
    ]);

    // Workers 3..7 (indices 2..6): active today within 11:32..11:48
    for (let idx = 2; idx <= 6; idx += 1) {
      writeDbSteps(join(convsDir, `${workerIds[idx]}.db`), [
        {
          stepIdx: 1,
          stepType: 15,
          originCascadeId: workerIds[idx],
          botId: `bot-w${idx + 1}-own`,
          rawModel: 'gemini-3.8-flash',
          displayModel: 'Gemini 3.8 Flash',
          enumId: 1669,
          input: 4_000 + idx * 1000,
          cacheRead: 2_000,
          output: 800 + idx * 100,
          createdMs: tTime(11, 32 + idx),
          completedMs: tTime(11, 36 + idx),
        },
      ]);
    }

    // Worker 8 (index 7): active ONLY yesterday (2026-11-17 10:05..10:15, inside yesterday's 10:00..10:21 window)
    writeDbSteps(join(convsDir, `${workerIds[7]}.db`), [
      {
        stepIdx: 1,
        stepType: 15,
        originCascadeId: workerIds[7],
        botId: 'bot-w8-yesterday',
        rawModel: 'gemini-3.8-flash',
        displayModel: 'Gemini 3.8 Flash',
        enumId: 1669,
        input: 9_000,
        cacheRead: 3_000,
        output: 1_000,
        createdMs: yTime(10, 5),
        completedMs: yTime(10, 15),
      },
    ]);

    const membersObj = {
      title: 'Multi-Day Receipt Swarm',
      members: {
        coordinator: { conversation_id: parentId, role: 'coordinator', model: 'gemini-4-argon' },
      },
    };
    workerIds.forEach((wid, idx) => {
      membersObj.members[`worker${idx + 1}`] = {
        conversation_id: wid,
        role: 'worker',
        model: idx <= 1 ? 'gemini-4-argon' : 'gemini-3.8-flash',
      };
    });
    const swarmDir = join(appData, 'brain', parentId, '.system_generated', 'swarm');
    mkdirSync(swarmDir, { recursive: true });
    writeFileSync(join(swarmDir, 'members.json'), JSON.stringify(membersObj, null, 2), 'utf-8');

    const res = analyzeConversation(parentId, {
      nowMs,
      appDataDirs: [appData],
      disableAgentApi: true,
      prefs: { ...DEFAULT_PREFS, currency: 'CNY', cnyRate: 7.25 },
    });

    assert.equal(res.children.length, 8);
    assert.equal(res.context.compactionsCount, 3, 'Context compactionsCount must reflect 1 yesterday + 2 today');
    assert.equal(res.receipt.todayDate, '2026-11-18');

    // Exact fork-deduplication parity between receipt.all.grandTotal and totals.withChildren!
    assert.equal(res.receipt.all.grandTotal.totalTokens, res.totals.withChildren.totalTokens);
    assert.ok(
      Math.abs(res.receipt.all.grandTotal.costActual - res.totals.withChildren.costActual) < 1e-9,
      `Expected cost parity, got receipt=${res.receipt.all.grandTotal.costActual} vs withChildren=${res.totals.withChildren.costActual}`,
    );
    assert.equal(res.receipt.all.grandTotal.stepsCount, res.totals.withChildren.stepsCount);

    // All-time scope checks
    assert.equal(res.receipt.all.startDate, '2026-11-17');
    assert.equal(res.receipt.all.endDate, '2026-11-18');
    assert.equal(res.receipt.all.compactionsCount, 3);
    assert.equal(res.receipt.all.subagentsCount, 8);
    assert.equal(res.receipt.all.children.length, 8);
    assert.equal(res.receipt.all.activeDurationMs, (21 + 26 + 20) * MIN); // 67m total

    // Today scope checks: strictly today's steps, 2 compactions, 7 active today workers (excluding worker8), 46m active duration
    assert.equal(res.receipt.today.hasData, true);
    assert.equal(res.receipt.today.startDate, '2026-11-18');
    assert.equal(res.receipt.today.endDate, '2026-11-18');
    assert.equal(res.receipt.today.compactionsCount, 2);
    assert.equal(res.receipt.today.subagentsCount, 7);
    assert.equal(res.receipt.today.children.length, 7);
    assert.equal(res.receipt.today.children.some((c) => c.name === 'worker8'), false);
    assert.equal(res.receipt.today.main.stepsCount, 4); // stepIdx 3, 4, 5, 6 today
    assert.equal(res.receipt.today.activeDurationMs, (26 + 20) * MIN); // 46m today (excludes 2h break & yesterday)
    assert.ok(res.receipt.today.grandTotal.totalTokens < res.receipt.all.grandTotal.totalTokens);

    // Isolated child inspection: subagentsCount === 0 and children.length === 0, cloned parent steps excluded
    const childRes = analyzeConversation(workerIds[0], {
      nowMs,
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    assert.equal(childRes.isChildSession, true);
    assert.equal(childRes.receipt.today.subagentsCount, 0);
    assert.equal(childRes.receipt.today.children.length, 0);
    assert.equal(childRes.receipt.all.subagentsCount, 0);
    assert.equal(childRes.receipt.all.children.length, 0);
    assert.equal(childRes.receipt.all.main.stepsCount, 1);
    assert.equal(childRes.receipt.all.grandTotal.totalTokens, 34_000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.9 receipt.js VM unit tests (view-model, formatting, mock canvas, PNG blob) and standalone GET /receipt.js HTTP route', async () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const receiptPath = join(paneDir, 'receipt.js');
  const mainPath = join(paneDir, 'main.mjs');
  const receiptSource = readFileSync(receiptPath, 'utf-8');

  // 1. Evaluate receipt.js in Node vm
  const vmSandbox = {
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Promise,
  };
  vmSandbox.window = vmSandbox;
  vmSandbox.globalThis = vmSandbox;
  vm.runInNewContext(receiptSource, vmSandbox);

  const api = vmSandbox.TokenMonitorReceipt;
  assert.ok(api, 'receipt.js must attach TokenMonitorReceipt to global root');
  assert.equal(api.fmtReceiptTokens(128640), '128,640');
  assert.equal(api.fmtReceiptTokens(0), '0');
  assert.equal(api.fmtReceiptTokens(-42), '0');
  assert.equal(api.fmtReceiptCost(2.31, 'CNY'), '¥2.31');
  assert.equal(api.fmtReceiptCost(0.0042, 'CNY'), '¥0.0042');
  assert.equal(api.fmtReceiptCost(0.005, 'CNY'), '¥0.005');
  assert.equal(api.fmtReceiptCost(0, 'USD'), '$0.00');
  assert.equal(api.fmtReceiptCost(1250.5, 'USD'), '$1,250.50');

  const eightChildren = Array.from({ length: 8 }, (_, idx) => ({
    conversationId: `02930000-0000-4000-8000-00000000000${idx + 1}`,
    kind: 'swarm',
    name: `worker${idx + 1}`,
    role: 'worker',
    totalTokens: (8 - idx) * 10_000,
    costActual: Number(((8 - idx) * 0.25).toFixed(2)),
    stepsCount: 3,
  }));
  const childSumTok = eightChildren.reduce((s, c) => s + c.totalTokens, 0); // 360,000
  const childSumCost = eightChildren.reduce((s, c) => s + c.costActual, 0); // 9.00

  const sampleCurrent = {
    conversationId: '02930000-0000-4000-8000-000000000000',
    title: 'MMDCT Control Optimization',
    activeModel: 'gemini-4-argon',
    isChildSession: false,
    receipt: {
      todayDate: '2026-11-18',
      today: {
        scope: 'today',
        hasData: true,
        startDate: '2026-11-18',
        endDate: '2026-11-18',
        startedAtMs: new Date(2026, 10, 18, 9, 5, 0).getTime(),
        endedAtMs: new Date(2026, 10, 18, 11, 50, 0).getTime(),
        activeDurationMs: 46 * 60_000,
        compactionsCount: 2,
        primaryModel: {
          model: 'gemini-4-argon',
          profileId: 'gemini-4-argon',
          profileLabel: 'Gemini 4 Argon (高推理)',
        },
        subagentsCount: 8,
        main: { totalTokens: 128_640, costActual: 2.31, stepsCount: 6 },
        children: eightChildren,
        childrenSubtotal: { totalTokens: childSumTok, costActual: childSumCost },
        grandTotal: { totalTokens: 128_640 + childSumTok, costActual: 2.31 + childSumCost, stepsCount: 30 },
      },
      all: {
        scope: 'all',
        hasData: true,
        startDate: '2026-11-17',
        endDate: '2026-11-18',
        startedAtMs: new Date(2026, 10, 17, 10, 0, 0).getTime(),
        endedAtMs: new Date(2026, 10, 18, 11, 50, 0).getTime(),
        activeDurationMs: 135 * 60_000,
        compactionsCount: 4,
        primaryModel: {
          model: 'gemini-4-argon',
          profileId: 'gemini-4-argon',
          profileLabel: 'Gemini 4 Argon (High)',
        },
        subagentsCount: 8,
        main: { totalTokens: 250_000, costActual: 4.5, stepsCount: 12 },
        children: eightChildren,
        childrenSubtotal: { totalTokens: childSumTok, costActual: childSumCost },
        grandTotal: { totalTokens: 250_000 + childSumTok, costActual: 4.5 + childSumCost, stepsCount: 36 },
      },
    },
  };

  // zh / CNY / today / compact (8 children -> top 5 + 其余 3 位子代理 + 子代理小计)
  const vmZhCompact = api.buildReceiptViewModel(
    sampleCurrent,
    { currency: 'CNY' },
    { lang: 'zh', scope: 'today', detailMode: 'compact', sessionTitle: sampleCurrent.title },
  );
  assert.equal(vmZhCompact.title, '收工票根');
  assert.equal(vmZhCompact.currency, 'CNY');
  assert.equal(vmZhCompact.items.length, 7); // 1 main + 5 top children + 1 others
  assert.equal(vmZhCompact.items[0].label, '主代理');
  assert.equal(vmZhCompact.items[0].tokensText, '128,640');
  assert.equal(vmZhCompact.items[0].costText, '¥2.31');
  assert.equal(vmZhCompact.items[6].kind, 'others');
  assert.equal(vmZhCompact.items[6].label, '其余 3 位子代理');
  assert.equal(vmZhCompact.subtotalRow.label, '子代理小计');
  assert.equal(vmZhCompact.totalRow.label, '会话合计');
  assert.equal(vmZhCompact.serialCode, 'AGY-1118-046');
  assert.equal(vmZhCompact.suggestedFilename, 'AGY-1118-046.png');
  assert.equal(vmZhCompact.metaRows.find((r) => r.key === 'primaryModel').value, 'Gemini 4 Argon');

  // en / USD / all / compact (8 children -> top 5 + '+3 Others' + 'Subagents Subtotal')
  const vmEnCompact = api.buildReceiptViewModel(
    sampleCurrent,
    { currency: 'USD' },
    { lang: 'en', scope: 'all', detailMode: 'compact', sessionTitle: sampleCurrent.title },
  );
  assert.equal(vmEnCompact.title.toUpperCase(), 'SESSION RECEIPT');
  assert.equal(vmEnCompact.currency, 'USD');
  assert.equal(vmEnCompact.items.length, 7);
  assert.equal(vmEnCompact.items[0].label, 'Main Agent');
  assert.equal(vmEnCompact.items[6].label, '+3 Others');
  assert.equal(vmEnCompact.subtotalRow.label, 'Subagents Subtotal');
  assert.equal(vmEnCompact.totalRow.label, 'Session Total');
  assert.equal(vmEnCompact.serialCode, 'AGY-1118-135');
  assert.match(vmEnCompact.metaRows.find((r) => r.key === 'date').value, /2026\.11\.17 - 11\.18/);

  // full mode: all 8 children listed individually (1 main + 8 children = 9 items, no 'others')
  const vmZhFull = api.buildReceiptViewModel(
    sampleCurrent,
    { currency: 'CNY' },
    { lang: 'zh', scope: 'today', detailMode: 'full', sessionTitle: sampleCurrent.title },
  );
  assert.equal(vmZhFull.items.length, 9);
  assert.equal(vmZhFull.items.some((i) => i.kind === 'others'), false);
  assert.ok(vmZhFull.subtotalRow);

  // 0 children -> subtotalRow === null
  const zeroChildrenCurrent = {
    ...sampleCurrent,
    receipt: {
      todayDate: '2026-11-18',
      today: {
        ...sampleCurrent.receipt.today,
        subagentsCount: 0,
        children: [],
        childrenSubtotal: { totalTokens: 0, costActual: 0 },
        grandTotal: { totalTokens: 128_640, costActual: 2.31, stepsCount: 6 },
      },
    },
  };
  const vmZeroChildren = api.buildReceiptViewModel(
    zeroChildrenCurrent,
    { currency: 'USD' },
    { lang: 'en', scope: 'today', detailMode: 'compact' },
  );
  assert.equal(vmZeroChildren.items.length, 1);
  assert.equal(vmZeroChildren.subtotalRow, null);

  // renderReceiptCanvas + canvasToBlob with injected mock canvas
  const drawnTexts = [];
  function createMockCanvas(w, h) {
    const ctx = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'left',
      textBaseline: 'alphabetic',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      letterSpacing: '0px',
      save() {},
      restore() {},
      scale() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillRect() {},
      strokeRect() {},
      setLineDash() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
      measureText(str) {
        return { width: String(str || '').length * 7 };
      },
      fillText(str) {
        drawnTexts.push(String(str));
      },
    };
    return {
      width: w,
      height: h,
      getContext(kind) {
        return kind === '2d' ? ctx : null;
      },
      toDataURL(mime = 'image/png') {
        const b64 = Buffer.from(`MOCK_PNG:${this.width}x${this.height}`).toString('base64');
        return `data:${mime};base64,${b64}`;
      },
    };
  }

  const renderedCanvas = api.renderReceiptCanvas(vmZhCompact, {
    scale: 3,
    createCanvas: createMockCanvas,
  });
  assert.equal(renderedCanvas.width, 1260);
  assert.ok(renderedCanvas.height > 1500);
  for (const expectedText of [
    '收工票根',
    'agy-token-monitor',
    '主代理',
    '其余 3 位子代理',
    '子代理小计',
    '会话合计',
    'AGY-1118-046',
  ]) {
    assert.equal(
      drawnTexts.some((t) => t.includes(expectedText)),
      true,
      `Canvas must draw "${expectedText}"`,
    );
  }

  // Test canvasToBlob via toDataURL fallback AND via direct canvas.toBlob
  const fallbackBlob = await api.canvasToBlob(renderedCanvas);
  assert.equal(fallbackBlob.type, 'image/png');
  assert.ok(fallbackBlob.size > 0);

  const directBlobCanvas = {
    toBlob(cb, mime) {
      cb(new Blob([Buffer.from('DIRECT_PNG_BYTES')], { type: mime || 'image/png' }));
    },
  };
  const directBlob = await api.canvasToBlob(directBlobCanvas);
  assert.equal(directBlob.type, 'image/png');
  assert.equal(directBlob.size, 'DIRECT_PNG_BYTES'.length);

  // 2. Verify standalone sidecar serves GET /receipt.js with HTTP 200 and TokenMonitorReceipt
  const { root, appData } = makeTempEnv();
  const port = await pickFetchSafeFreePort();
  const stateDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
  mkdirSync(stateDir, { recursive: true });
  const fakeHome = join(root, 'fake_home');
  mkdirSync(fakeHome, { recursive: true });

  const sdkCandidates = [
    process.env.SIDECAR_SDK_PATH,
    join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
  ].filter((p) => typeof p === 'string' && p.trim() && existsSync(p));

  const env = {
    ...process.env,
    ANTIGRAVITY_EXECUTABLE_DATA_DIR: stateDir,
    USERPROFILE: fakeHome,
    HOME: fakeHome,
    PRICING_SYNC_DISABLE_AUTO: '1',
    RELEASE_UPDATE_DISABLE_AUTO: '1',
    DISABLE_SYSTEM_PROXY_LOOKUP: '1',
  };
  if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];

  const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolveReady, rejectReady) => {
      if (child.exitCode !== null) {
        rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
        return;
      }
      const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
        if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
      });
    });

    const receiptHttpRes = await fetch(`http://127.0.0.1:${port}/receipt.js`);
    assert.equal(receiptHttpRes.status, 200);
    assert.match(receiptHttpRes.headers.get('content-type') || '', /javascript/i);
    const receiptBody = await receiptHttpRes.text();
    assert.equal(receiptBody.includes('TokenMonitorReceipt'), true);
    assert.equal(receiptBody.includes('renderReceiptCanvas'), true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.2.9 frontend static hygiene, CSS/HTML contracts, I18N parity, banned-term zero tolerance, and balanced annotations', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const netProxySource = readFileSync(join(paneDir, 'net_proxy.mjs'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const releaseUpdaterSource = readFileSync(join(paneDir, 'release_updater.mjs'), 'utf-8');
  const syncPluginPs1 = readFileSync(join(repoRoot, 'scripts', 'sync-plugin.ps1'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const pluginJsonRaw = readFileSync(join(repoRoot, 'plugin.json'), 'utf-8');
  const packageJsonRaw = readFileSync(join(paneDir, 'package.json'), 'utf-8');
  const sidecarJsonRaw = readFileSync(join(paneDir, 'sidecar.json'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  // 1. index.html script ordering & #receipt-modal elements
  const receiptScriptIdx = indexHtml.indexOf('<script src="/receipt.js"></script>');
  const appScriptIdx = indexHtml.indexOf('<script src="/app.js"></script>');
  assert.ok(receiptScriptIdx > 0, 'index.html must include <script src="/receipt.js"></script>');
  assert.ok(receiptScriptIdx < appScriptIdx, '/receipt.js must load before /app.js');
  for (const requiredId of [
    'id="receipt-modal"',
    'id="receipt-preview-img"',
    'id="btn-receipt-scope-today"',
    'id="btn-receipt-scope-all"',
    'id="btn-receipt-mode-compact"',
    'id="btn-receipt-mode-full"',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Update receipt modal button ID checks for v0.3.1 removal of #btn-receipt-save.
// ============================================================================
    'id="btn-receipt-copy"',
    'id="btn-receipt-close"',
  ]) {
    assert.equal(indexHtml.includes(requiredId), true, `index.html must contain ${requiredId}`);
  }
  assert.equal(
    indexHtml.includes('id="btn-receipt-save"'),
    false,
    'index.html must not contain removed #btn-receipt-save in v0.3.1',
  );
  assert.equal(
    indexHtml.includes('id="btn-receipt-copy"'),
    true,
    'index.html must contain #btn-receipt-copy in v0.3.1',
  );
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================

  // 2. styles.css v0.2.9 selectors & Zero-CLS .roll-col preserved
  const stylesNoComments = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const expandedListMatch = stylesNoComments.match(
    /(?:^|\n)\s*\.children-list\.is-expanded\s*\{([^}]*)\}/,
  );
  assert.ok(expandedListMatch, 'styles.css must define .children-list.is-expanded');
  assert.match(expandedListMatch[1], /max-height\s*:\s*400px\b/);
  assert.match(expandedListMatch[1], /overflow-y\s*:\s*auto\b/);

  for (const selector of [
    '.children-toggle-bar',
    '.child-status.ENDED',
    '.child-row.is-ended',
    '.hero-value-row.has-action',
    '.checkout-btn',
    '.receipt-modal-card',
    '.receipt-preview-img',
  ]) {
    assert.equal(stylesNoComments.includes(selector), true, `styles.css must define ${selector}`);
  }
  const rollColMatch = stylesNoComments.match(/(?:^|\n)\s*\.roll-col\s*\{([^}]*)\}/);
  assert.ok(rollColMatch, 'styles.css must preserve .roll-col');
  assert.match(rollColMatch[1], /display\s*:\s*inline-grid\b/);

  // 3. 100% I18N.zh / I18N.en key & {placeholder} parity + v0.2.9 keys
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0);
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks must be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());

  for (const key of [
    'childrenModels.liveSubheadFolded',
    'childrenModels.expandAll',
    'childrenModels.collapse',
    'childrenModels.expandMoreFooter',
    'childrenModels.collapseFooter',
    'childrenModels.childEnded',
    'receipt.checkoutBtn',
    'receipt.modalTitle',
    'receipt.scopeToday',
    'receipt.scopeAll',
    'receipt.modeCompact',
    'receipt.modeFull',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Update receipt I18N key checks for v0.3.1 direct clipboard copy
// (replacing receipt.saveBtn with receipt.copyingBtn and receipt.copyFailedToast).
// ============================================================================
    'receipt.copyBtn',
    'receipt.copyingBtn',
    'receipt.copyFailedToast',
  ]) {
    assert.ok(zhEntries.has(key) && zhEntries.get(key).length > 0, `I18N.zh must define ${key}`);
    assert.ok(enEntries.has(key) && enEntries.get(key).length > 0, `I18N.en must define ${key}`);
  }
  for (const removedKey of ['receipt.saveBtn', 'receipt.savedToast', 'receipt.copyFallbackToast']) {
    assert.equal(zhEntries.has(removedKey), false, `I18N.zh must remove ${removedKey}`);
    assert.equal(enEntries.has(removedKey), false, `I18N.en must remove ${removedKey}`);
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================

  const extractPlaceholders = (str) =>
    [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `Placeholder mismatch for I18N key "${key}"`,
    );
  }

  // 4. Zero unsafe DOM APIs across BOTH app.js and receipt.js
  const unsafeDomRe = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/;
  assert.equal(unsafeDomRe.test(appSource), false, 'app.js must contain 0 unsafe DOM APIs');
  assert.equal(unsafeDomRe.test(receiptSource), false, 'receipt.js must contain 0 unsafe DOM APIs');

  // 5. Zero banned strings across ALL repo files
  const bannedTerm = '\u6c34\u4f4d';
  const legacyDocPhrase = 'Dedicated ' + 'Gemini 3.1 Pro';
  const legacyUiTerm = '\u5728\u5f79\u6a21\u578b';

  function listAllRepoFiles(dir) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...listAllRepoFiles(fullPath));
      } else if (entry.isFile()) {
        found.push(fullPath);
      }
    }
    return found;
  }

  const allRepoFiles = listAllRepoFiles(repoRoot);
  assert.ok(allRepoFiles.length >= 18, 'Repository file walk must discover all tracked files');
  for (const filePath of allRepoFiles) {
    const content = readFileSync(filePath, 'utf-8');
    assert.equal(content.includes(bannedTerm), false, `${filePath} must not contain banned term`);
    assert.equal(
      content.includes(legacyDocPhrase),
      false,
      `${filePath} must not contain legacy doc phrase`,
    );
  }

  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['receipt.js', receiptSource],
    ['I18N.zh', i18nMatch[1]],
    ['plugin.json', pluginJsonRaw],
    ['package.json', packageJsonRaw],
    ['sidecar.json', sidecarJsonRaw],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
  ]) {
    assert.equal(src.includes(legacyUiTerm), false, `${label} must not contain legacy UI term`);
  }

  // 6. Balanced [MODIFIED BEGIN/END] annotations across all code files + createReleaseUpdater 0.2.9 default
  const modBeginMarker = '[' + 'MODIFIED BEGIN]';
  const modEndMarker = '[' + 'MODIFIED END]';
  const annotatedTargets = [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['receipt.js', receiptSource],
    ['parser.mjs', parserSource],
    ['main.mjs', mainSource],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Include clipboard_image.mjs in balanced annotation checks.
// ============================================================================
    ['clipboard_image.mjs', readFileSync(join(paneDir, 'clipboard_image.mjs'), 'utf-8')],
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
    ['net_proxy.mjs', netProxySource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['scripts/sync-plugin.ps1', syncPluginPs1],
    ['tests/parser.test.mjs', selfSource],
  ];
  const maintainerScriptPath = join(repoRoot, 'maintainer', 'sync-github-about.ps1');
  if (existsSync(maintainerScriptPath)) {
    annotatedTargets.push(['maintainer/sync-github-about.ps1', readFileSync(maintainerScriptPath, 'utf-8')]);
  }

  for (const [label, src] of annotatedTargets) {
    let depth = 0;
    let minDepth = 0;
    let begins = 0;
    let ends = 0;
    for (const line of src.split(/\r?\n/)) {
      if (line.includes(modBeginMarker)) {
        depth += 1;
        begins += 1;
      }
      if (line.includes(modEndMarker)) {
        depth -= 1;
        ends += 1;
        if (depth < minDepth) minDepth = depth;
      }
    }
    assert.ok(begins > 0, `${label} must contain modification annotations`);
    assert.equal(begins, ends, `${label} begin/end annotation count mismatch`);
    assert.equal(depth, 0, `${label} unclosed modification annotation (depth=${depth})`);
    assert.equal(minDepth, 0, `${label} unmatched end annotation (minDepth=${minDepth})`);
  }

  const defaultUpdater = createReleaseUpdater({ stateDir: '' });
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.3.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:26:30
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump createReleaseUpdater default currentVersion assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump createReleaseUpdater default currentVersion assertion from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(defaultUpdater.getPublicStatus().currentVersion, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:26:30
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================
});

test('v0.2.9 headless Node VM integration: Top-5 children folding, 400px scroll preservation, Ended badge, and #receipt-modal workflow', async () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');

  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0, 'app.js must end with IIFE closing })();');

  const instrumentedApp =
    appSource.slice(0, iifeCloseIdx) +
    `\n  globalThis.__tmV029Exports = {\n` +
    `    state,\n` +
    `    t,\n` +
    `    init,\n` +
    `    renderCurrentTab,\n` +
    `    renderCostCard,\n` +
    `    renderChildrenAndModelsCard,\n` +
    `    renderReceiptModal,\n` +
    `    openReceiptModal,\n` +
    `    closeReceiptModal,\n` +
    `  };\n` +
    appSource.slice(iifeCloseIdx);

  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }

  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }

  let fakeDocument = null;
  let lastCanvasTexts = [];

  function matchesSimpleSelector(elNode, selector) {
    const s = selector.trim();
    if (!s) return false;
    if (s.startsWith('[') && s.endsWith(']')) {
      const attrName = s.slice(1, -1).split('=')[0].trim();
      if (attrName.startsWith('data-')) {
        const camel = attrName
          .slice(5)
          .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        return elNode.hasAttribute(attrName) || elNode.dataset[camel] !== undefined;
      }
      return elNode.hasAttribute(attrName);
    }
    if (s.startsWith('#')) {
      return elNode.getAttribute('id') === s.slice(1);
    }
    if (s.startsWith('.')) {
      const classes = s.slice(1).split('.').filter(Boolean);
      return classes.every((cls) => elNode.classList.contains(cls));
    }
    const dotParts = s.split('.');
    const tagPart = dotParts[0].toUpperCase();
    if (tagPart && elNode.tagName !== tagPart) return false;
    return dotParts.slice(1).every((cls) => elNode.classList.contains(cls));
  }

  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.type = '';
      this.role = '';
      this.value = '';
      this.src = '';
      this.alt = '';
      this.href = '';
      this.download = '';
      this.disabled = false;
      this.checked = false;
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.width = 0;
      this.height = 0;
      this._canvasTexts = [];
      this.style = {
        cssText: '',
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
        toggle: (tok, force) => {
          const key = String(tok || '');
          const shouldAdd = force === undefined ? !this._classSet.has(key) : Boolean(force);
          if (shouldAdd) this._classSet.add(key);
          else this._classSet.delete(key);
          return shouldAdd;
        },
      };
    }

    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }

    get children() {
      return this.childNodes.filter((n) => n instanceof FakeElement);
    }
    get childElementCount() {
      return this.children.length;
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === fakeDocument || cur === fakeDocument?.documentElement || cur === fakeDocument?.body) {
          return true;
        }
        cur = cur.parentNode;
      }
      return false;
    }

    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') {
        this.appendChild(new FakeTextNode(str));
      }
    }

    setAttribute(name, val) {
      const k = String(name);
      const v = String(val);
      if (k === 'class') {
        this.className = v;
        return;
      }
      if (k === 'title') this.title = v;
      if (k === 'href') this.href = v;
      if (k === 'download') this.download = v;
      this.attributes.set(k, v);
    }
    getAttribute(name) {
      const k = String(name);
      if (k === 'class') return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(name) {
      const k = String(name);
      if (k === 'class') return this._classSet.size > 0;
      return this.attributes.has(k);
    }
    removeAttribute(name) {
      const k = String(name);
      if (k === 'class') {
        this.className = '';
        return;
      }
      this.attributes.delete(k);
    }

    appendChild(child) {
      if (child.parentNode && child.parentNode !== this) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx >= 0) child.parentNode.childNodes.splice(idx, 1);
      } else if (child.parentNode === this) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.childNodes.indexOf(this);
        if (idx >= 0) this.parentNode.childNodes.splice(idx, 1);
        this.parentNode = null;
      }
    }

    replaceChildren(...nodes) {
      for (const oldChild of this.childNodes) {
        oldChild.parentNode = null;
      }
      this.childNodes = [];
      for (const n of nodes) {
        if (n === null || n === undefined) continue;
        this.appendChild(typeof n === 'string' ? new FakeTextNode(n) : n);
      }
    }

    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }

    click() {
      const handlers = this.listeners.get('click') || [];
      const evt = {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
      };
      for (const fn of handlers) fn(evt);
    }

    focus() {
      if (fakeDocument) fakeDocument.activeElement = this;
    }

    querySelectorAll(selector) {
      const parts = String(selector || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (parts.length === 0) return [];

      const findMatchingDescendants = (rootNode, simpleSel) => {
        const out = [];
        const visit = (n) => {
          for (const child of n.children) {
            if (matchesSimpleSelector(child, simpleSel)) out.push(child);
            visit(child);
          }
        };
        visit(rootNode);
        return out;
      };

      let currentSet = [this];
      for (const part of parts) {
        const nextSet = [];
        const seen = new Set();
        for (const baseNode of currentSet) {
          for (const m of findMatchingDescendants(baseNode, part)) {
            if (!seen.has(m)) {
              seen.add(m);
              nextSet.push(m);
            }
          }
        }
        currentSet = nextSet;
      }
      return currentSet;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    getContext(kind) {
      if (this.tagName !== 'CANVAS' || kind !== '2d') return null;
      this._canvasTexts = [];
      const targetArr = this._canvasTexts;
      return {
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        letterSpacing: '0px',
        save() {},
        restore() {},
        scale() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fillRect() {},
        strokeRect() {},
        setLineDash() {},
        createLinearGradient() {
          return { addColorStop() {} };
        },
        measureText(str) {
          return { width: String(str || '').length * 7 };
        },
        fillText(str) {
          targetArr.push(String(str));
          lastCanvasTexts = targetArr;
        },
      };
    }

    toDataURL(mime = 'image/png') {
      const summary = `${this.width}x${this.height}:${this._canvasTexts.join('|')}`;
      const b64 = Buffer.from(summary, 'utf-8').toString('base64');
      return `data:${mime};base64,${b64}`;
    }
  }

  const elementsById = new Map();
  const docListeners = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);

  fakeDocument = {
    readyState: 'loading',
    hidden: false,
    activeElement: null,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const key = String(id);
      const inTree = rootHtml.querySelector(`#${key}`);
      if (inTree) return inTree;
      if (!elementsById.has(key)) {
        const elem = new FakeElement('div');
        elem.setAttribute('id', key);
        if (key === 'receipt-modal' || key === 'update-modal' || key === 'toast-banner') {
          elem.classList.add('hidden');
        }
        rootBody.appendChild(elem);
        elementsById.set(key, elem);
      }
      return elementsById.get(key);
    },
    querySelectorAll: (sel) => rootHtml.querySelectorAll(sel),
    querySelector: (sel) => rootHtml.querySelector(sel),
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      for (const fn of docListeners.get(evt.type) || []) fn(evt);
    },
  };

  const nowMs = Date.now();
  const makeTwelveChildren = (extraOut = 0) =>
    Array.from({ length: 12 }, (_, idx) => {
      const isGen = idx === 0;
      const isTools = idx === 1;
      const isEndedTop = idx === 2; // in Top 5!
      const isEndedFolded = idx >= 9; // folded in 6..12
      const isKilled = isEndedTop || isEndedFolded;
      return {
        conversationId: `02940000-0000-4000-8000-0000000000${String(idx + 1).padStart(2, '0')}`,
        kind: idx % 2 === 0 ? 'swarm' : 'subagent',
        name: `member-${idx + 1}`,
        role: 'worker',
        model: idx < 4 ? 'gemini-4-argon' : 'gemini-3.8-flash',
        status: isKilled ? 'IDLE' : isGen ? 'GENERATING' : isTools ? 'RUNNING_TOOLS' : 'IDLE',
        killed: isKilled,
        updatedAtMs: nowMs - (idx + 1) * 15_000,
        generatingSinceMs: isGen ? nowMs - 15_000 : null,
        contextTotal: 25_000 + idx * 1000,
        latestTokPerSec: 85 + idx,
        outputTokens: 1200 + idx * 100 + (idx === 0 ? extraOut : 0),
        costActual: Number((0.15 + idx * 0.05 + (idx === 0 ? extraOut * 0.0001 : 0)).toFixed(4)),
      };
    });

  const buildSnapshotPayload = (extraOut = 0) => {
    const children = makeTwelveChildren(extraOut);
    const receiptChildren = children.map((c) => ({
      conversationId: c.conversationId,
      kind: c.kind,
      name: c.name,
      role: c.role,
      totalTokens: c.contextTotal + c.outputTokens,
      costActual: c.costActual,
      stepsCount: 3,
    }));
    const subTok = receiptChildren.reduce((s, c) => s + c.totalTokens, 0);
    const subCost = receiptChildren.reduce((s, c) => s + c.costActual, 0);
    return {
      unchanged: false,
      etag: `etag-${extraOut}`,
      serverTimeMs: nowMs,
      appVersion: '0.2.9',
      bootId: 'boot-v029',
      boundConversationId: '02940000-0000-4000-8000-000000000000',
      prefs: { ...DEFAULT_PREFS, currency: 'CNY', cnyRate: 7.25, language: 'zh' },
      pricingCatalog: buildEffectivePricingCatalog({
        ...DEFAULT_PREFS,
        currency: 'CNY',
        cnyRate: 7.25,
        language: 'zh',
      }),
      subscriptionCatalog: SUBSCRIPTION_CATALOG,
      current: {
        conversationId: '02940000-0000-4000-8000-000000000000',
        title: 'v0.2.9 Coordinator Session',
        workspace: 'f:/Other Items/agy-token-monitor',
        activeModel: 'gemini-4-argon',
        isChildSession: false,
        status: 'IDLE',
        generatingSinceMs: null,
        speed: {
          measuredStepsCount: 5,
          latestStepTokPerSec: 92.4,
          weightedAvgTokPerSec: 88.1,
          peakTokPerSec: 110.2,
          latestStepOutputTokens: 640,
          latestStepDurationSec: 6.9,
          recentSteps: [{ stepIndex: 1, tokPerSec: 92.4, outputTokens: 640 }],
        },
        context: {
          currentTotal: 120_000,
          latestInputUncached: 20_000,
          latestCacheRead: 100_000,
          latestCacheHitRatePct: 83.3,
          latestNetDelta: 4_000,
          softLimit: 400_000,
          hardLimit: 500_000,
          hardUsagePct: 24,
          softUsagePct: 30,
          usageLevel: 'HEALTHY',
          compactionsCount: 2,
          topSpikes: [],
        },
        subscription: {
          planId: 'ultra_20x',
          planLabel: 'Google AI Ultra 20x',
          isAutoDetected: true,
          monthlyFee: 1449.93,
          mainOnlySharePct: 0.2,
          withChildrenSharePct: 0.8,
        },
        totals: {
          mainOnly: {
            stepsCount: 5,
            inputUncachedTokens: 40_000,
            cacheReadTokens: 80_000,
            outputTokens: 8_640,
            totalTokens: 128_640,
            cacheHitRatePct: 66.7,
            costActual: 2.31,
            costUncachedBaseline: 3.8,
            costSavedByCache: 1.49,
          },
          withChildren: {
            stepsCount: 41,
            inputUncachedTokens: 200_000,
            cacheReadTokens: 220_000,
            outputTokens: 30_000 + extraOut,
            totalTokens: 128_640 + subTok,
            cacheHitRatePct: 52.4,
            costActual: Number((2.31 + subCost).toFixed(4)),
            costUncachedBaseline: 15.2,
            costSavedByCache: 4.1,
          },
          byModel: [
            {
              model: 'gemini-4-argon',
              profileId: 'gemini-4-argon',
              profileLabel: 'Gemini 4 Argon',
              rateDisplay: '$3/$0.3/$15',
              stepsCount: 41,
              inputUncachedTokens: 200_000,
              cacheReadTokens: 220_000,
              outputTokens: 30_000 + extraOut,
              totalTokens: 128_640 + subTok,
              costActual: Number((2.31 + subCost).toFixed(4)),
            },
          ],
          mainOnlyByModel: [],
        },
        receipt: {
          todayDate: '2026-11-18',
          today: {
            scope: 'today',
            hasData: true,
            startDate: '2026-11-18',
            endDate: '2026-11-18',
            startedAtMs: nowMs - 3600_000,
            endedAtMs: nowMs - 60_000,
            activeDurationMs: 42 * 60_000,
            compactionsCount: 1,
            primaryModel: {
              model: 'gemini-4-argon',
              profileId: 'gemini-4-argon',
              profileLabel: 'Gemini 4 Argon',
            },
            subagentsCount: 12,
            main: { totalTokens: 128_640, costActual: 2.31, stepsCount: 5 },
            children: receiptChildren,
            childrenSubtotal: { totalTokens: subTok, costActual: subCost },
            grandTotal: {
              totalTokens: 128_640 + subTok,
              costActual: Number((2.31 + subCost).toFixed(4)),
              stepsCount: 41,
            },
          },
          all: {
            scope: 'all',
            hasData: true,
            startDate: '2026-11-17',
            endDate: '2026-11-18',
            startedAtMs: nowMs - 90_000_000,
            endedAtMs: nowMs - 60_000,
            activeDurationMs: 125 * 60_000,
            compactionsCount: 2,
            primaryModel: {
              model: 'gemini-4-argon',
              profileId: 'gemini-4-argon',
              profileLabel: 'Gemini 4 Argon',
            },
            subagentsCount: 12,
            main: { totalTokens: 240_000, costActual: 5.12, stepsCount: 11 },
            children: receiptChildren,
            childrenSubtotal: { totalTokens: subTok, costActual: subCost },
            grandTotal: {
              totalTokens: 240_000 + subTok,
              costActual: Number((5.12 + subCost).toFixed(4)),
              stepsCount: 47,
            },
          },
        },
        children,
      },
      global: {
        activeRangeKey: 'today',
        periods: {
          today: {
            rangeKey: 'today',
            label: '今日',
            startDate: '2026-11-18',
            endDate: '2026-11-18',
            activeDaysCount: 1,
            conversationsCount: 1,
            archivedCount: 0,
            stepsCount: 41,
            inputUncachedTokens: 200_000,
            cacheReadTokens: 220_000,
            outputTokens: 30_000,
            totalTokens: 450_000,
            costActual: 8.5,
            avgDailyCost: 8.5,
            avgDailyTokens: 450_000,
            trendGranularity: 'hour',
            trend: [],
            byModel: [],
            subscription: {
              planId: 'ultra_20x',
              planLabel: 'Google AI Ultra 20x',
              isAutoDetected: true,
              monthlyFee: 1449.93,
              proratedFee: 48.33,
              proratedDays: 1,
              tokenCost: 8.5,
              netSavings: -39.83,
              roiMultiplier: 0.18,
              paybackPct: 17.6,
              isPaidOff: false,
            },
          },
        },
        recentConversations: [],
        ledgerSync: { syncing: false, pendingRebuildCount: 0 },
      },
    };
  };

  let currentMockSnap = buildSnapshotPayload(0);
  const clipboardItemsWritten = [];
  const createdObjectUrls = [];
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Track /api/copy-receipt fallback calls and configurable response
// in v0.2.9/v0.3.1 VM receipt test.
// ============================================================================
  const copyReceiptCalls = [];
  let copyReceiptMockResult = { ok: true, status: 200, body: { ok: true, bytes: 128 } };
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================

  const sandbox = {
    Node: FakeNode,
    Blob,
    Buffer,
    Uint8Array,
    ClipboardItem: class FakeClipboardItem {
      constructor(items) {
        this.items = items;
      }
    },
    URL: {
      createObjectURL: (blob) => {
        const u = `blob:mock/${createdObjectUrls.length + 1}:${blob?.size || 0}`;
        createdObjectUrls.push(u);
        return u;
      },
      revokeObjectURL: () => {},
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    document: fakeDocument,
    window: null,
    navigator: {
      clipboard: {
        writeText: async () => {},
        write: async (items) => {
          clipboardItemsWritten.push(...items);
        },
      },
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: 'rgb(246, 247, 249)' }),
    AbortController,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Intercept POST /api/copy-receipt in VM fetch mock.
// ============================================================================
    fetch: async (url, opts) => {
      if (String(url).includes('/api/snapshot')) {
        return { ok: true, status: 200, json: async () => currentMockSnap };
      }
      if (String(url).includes('/api/copy-receipt')) {
        let parsedBody = null;
        try {
          parsedBody = opts?.body ? JSON.parse(opts.body) : null;
        } catch {
          parsedBody = null;
        }
        copyReceiptCalls.push({ method: opts?.method || 'GET', body: parsedBody });
        return {
          ok: copyReceiptMockResult.ok,
          status: copyReceiptMockResult.status,
          json: async () => copyReceiptMockResult.body,
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, prefs: currentMockSnap.prefs }) };
    },
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
    URLSearchParams,
    Intl,
  };
  sandbox.window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    sidecar: { conversationId: '02940000-0000-4000-8000-000000000000' },
    location: { reload: () => {} },
  };
  sandbox.globalThis = sandbox;

  // Load receipt.js first, attach TokenMonitorReceipt onto window, then load app.js
  vm.runInNewContext(receiptSource, sandbox);
  sandbox.window.TokenMonitorReceipt = sandbox.TokenMonitorReceipt;
  vm.runInNewContext(instrumentedApp, sandbox);

  const exports = sandbox.__tmV029Exports;
  assert.ok(exports, 'VM execution must expose __tmV029Exports');

  // Fire DOMContentLoaded -> binds all event listeners and runs initial pollSnapshot(true)
  fakeDocument.dispatchEvent({ type: 'DOMContentLoaded' });
  await new Promise((r) => setImmediate(r));

  const cardChildren = fakeDocument.getElementById('card-children-models');
  const cardCost = fakeDocument.getElementById('card-cost');

  // --- Workflow 1: 12 children -> Top-5 collapsed -> Expand 12 -> 400px scrollTop=160 preserved across live update -> Collapse -> Ended badge & relative time ---
  assert.equal(
    cardChildren.querySelectorAll('.child-row').length,
    5,
    'Collapsed view must render exactly Top 5 .child-row items',
  );
  assert.equal(cardChildren.querySelector('.children-list.is-expanded'), null);

  const topExpandBtn = cardChildren.querySelector('.children-head .mini-btn');
  const bottomExpandBtn = cardChildren.querySelector('.children-toggle-bar');
  assert.ok(topExpandBtn, 'Collapsed view with 12 children must render top expand button');
  assert.ok(bottomExpandBtn, 'Collapsed view with 12 children must render bottom .children-toggle-bar');
  assert.match(topExpandBtn.textContent, /12/);
  assert.match(bottomExpandBtn.textContent, /7/);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:33:27
// Description: Update v0.2.9 ended badge assertion to v0.5.0 clean text ('已结束', no leading ● prefix).
// ============================================================================
  // Verify killed: true child in zh renders .child-status.ENDED ('已结束', no ● prefix) and relative time
  const endedBadgesZh = cardChildren.querySelectorAll('.child-status.ENDED');
  assert.ok(endedBadgesZh.length >= 1, 'Ended worker in Top 5 must render .child-status.ENDED');
  assert.equal(endedBadgesZh[0].textContent, '已结束');
  assert.doesNotMatch(endedBadgesZh[0].textContent, /^[●⚡🔧]/);
// ============================================================================
// [MODIFIED END] 2026-11-20 10:33:27
// ============================================================================
  const relTimesZh = cardChildren.querySelectorAll('.child-rel-time');
  assert.ok(relTimesZh.length === 5 && relTimesZh[0].textContent.length > 0, 'Each visible child must render relative time');

  // Click expand -> all 12 items rendered inside .children-list.is-expanded
  topExpandBtn.click();
  assert.equal(cardChildren.querySelectorAll('.child-row').length, 12);
  const expandedListBefore = cardChildren.querySelector('.children-list.is-expanded');
  assert.ok(expandedListBefore, 'Expanded list must carry .is-expanded class');

  // Scroll to 160px, then inject live snapshot update that mutates child metrics and forces DOM rebuild
  expandedListBefore.scrollTop = 160;
  currentMockSnap = buildSnapshotPayload(500);
  exports.state.snapshot = currentMockSnap;
  exports.renderCurrentTab(currentMockSnap);

  const expandedListAfter = cardChildren.querySelector('.children-list.is-expanded');
  assert.ok(expandedListAfter, 'Expanded list must remain expanded after live snapshot update');
  assert.notEqual(expandedListAfter, expandedListBefore, 'Live update with changed tokens must replace list DOM');
  assert.equal(expandedListAfter.scrollTop, 160, 'scrollTop === 160 must be preserved across live snapshot re-render');

  // Click collapse footer -> back to 5 items
  const collapseFooterBtn = cardChildren.querySelector('.children-toggle-bar');
  assert.ok(collapseFooterBtn);
  collapseFooterBtn.click();
  assert.equal(cardChildren.querySelectorAll('.child-row').length, 5);
  assert.equal(cardChildren.querySelector('.children-list.is-expanded'), null);

  // --- Workflow 2: Click #btn-checkout -> #receipt-modal preview PNG, toggle today/all & compact/full, and re-render on #btn-lang-toggle ---
  const receiptModal = fakeDocument.getElementById('receipt-modal');
  const previewImg = fakeDocument.getElementById('receipt-preview-img');
  const checkoutBtn = fakeDocument.getElementById('btn-checkout');
  assert.ok(checkoutBtn, 'Equivalent Cost card must render #btn-checkout');
  assert.ok(cardCost.querySelector('.hero-value-row.has-action'), 'Cost hero row must have .has-action');
  assert.equal(receiptModal.classList.contains('hidden'), true);

  checkoutBtn.click();
  assert.equal(receiptModal.classList.contains('hidden'), false, '#receipt-modal must open on #btn-checkout click');
  assert.equal(previewImg.src.startsWith('data:image/png;base64,'), true);
  assert.equal(previewImg.alt, '收工票根');
  assert.equal(lastCanvasTexts.includes('收工票根'), true);
  assert.equal(lastCanvasTexts.some((s) => s.includes('其余 7 位子代理')), true);
  const srcTodayCompactZh = previewImg.src;

  // Toggle today -> all
  const btnScopeAll = fakeDocument.getElementById('btn-receipt-scope-all');
  const btnScopeToday = fakeDocument.getElementById('btn-receipt-scope-today');
  btnScopeAll.click();
  assert.equal(btnScopeAll.classList.contains('active'), true);
  assert.equal(btnScopeToday.classList.contains('active'), false);
  const srcAllCompactZh = previewImg.src;
  assert.notEqual(srcAllCompactZh, srcTodayCompactZh, 'Switching today -> all must re-render PNG data URL');

  // Toggle compact -> full (all 12 children listed, no 其余 row)
  const btnModeFull = fakeDocument.getElementById('btn-receipt-mode-full');
  btnModeFull.click();
  assert.equal(btnModeFull.classList.contains('active'), true);
  assert.equal(lastCanvasTexts.some((s) => s.includes('其余')), false);
  const srcAllFullZh = previewImg.src;
  assert.notEqual(srcAllFullZh, srcAllCompactZh, 'Switching compact -> full must re-render PNG data URL');

  // Click #btn-lang-toggle -> switches UI to English ('● Ended' + relative time) AND immediately re-renders open receipt modal!
  fakeDocument.getElementById('btn-lang-toggle').click();
  assert.equal(exports.state.lang, 'en');
  assert.equal(previewImg.alt, 'Session Receipt');
  assert.notEqual(previewImg.src, srcAllFullZh, 'Language toggle must immediately re-render #receipt-preview-img');
  assert.equal(lastCanvasTexts.includes('Session Receipt'), true);
  assert.equal(lastCanvasTexts.includes('Session Total'), true);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:33:27
// Description: Update v0.2.9 English ended badge assertion to v0.5.0 clean text ('Ended', no leading ● prefix).
// ============================================================================
  const endedBadgesEn = cardChildren.querySelectorAll('.child-status.ENDED');
  assert.ok(endedBadgesEn.length >= 1);
  assert.equal(endedBadgesEn[0].textContent, 'Ended');
  assert.doesNotMatch(endedBadgesEn[0].textContent, /^[●⚡🔧]/);
// ============================================================================
// [MODIFIED END] 2026-11-20 10:33:27
// ============================================================================
  const relTimesEn = cardChildren.querySelectorAll('.child-rel-time');
  assert.ok(relTimesEn.length === 5 && /ago|just now/i.test(relTimesEn[0].textContent));

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Verify #btn-receipt-save removal, #btn-receipt-copy ClipboardItem
// write, NotAllowedError -> POST /api/copy-receipt fallback success & error toast.
// ============================================================================
  assert.equal(fakeDocument.querySelector('#btn-receipt-save'), null);

  fakeDocument.getElementById('btn-receipt-copy').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(clipboardItemsWritten.length, 1);
  assert.equal(copyReceiptCalls.length, 0);
  const toastBanner = fakeDocument.getElementById('toast-banner');
  assert.equal(toastBanner.textContent, exports.t('receipt.copiedToast'));
  assert.equal(toastBanner.classList.contains('is-error'), false);

  // Fallback to POST /api/copy-receipt when navigator.clipboard.write throws NotAllowedError
  sandbox.navigator.clipboard.write = async () => {
    throw Object.assign(new Error('Clipboard write blocked'), { name: 'NotAllowedError' });
  };
  copyReceiptMockResult = { ok: true, status: 200, body: { ok: true, bytes: 256 } };
  fakeDocument.getElementById('btn-receipt-copy').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(copyReceiptCalls.length, 1);
  assert.equal(copyReceiptCalls[0].method, 'POST');
  assert.equal(typeof copyReceiptCalls[0].body?.imageBase64, 'string');
  assert.equal(copyReceiptCalls[0].body.imageBase64.startsWith('data:image/png;base64,'), true);
  assert.equal(toastBanner.textContent, exports.t('receipt.copiedToast'));
  assert.equal(toastBanner.classList.contains('is-error'), false);

  // Error toast when /api/copy-receipt fails
  copyReceiptMockResult = { ok: false, status: 500, body: { ok: false, error: 'clipboard daemon offline' } };
  fakeDocument.getElementById('btn-receipt-copy').click();
  await new Promise((r) => setImmediate(r));
  assert.equal(copyReceiptCalls.length, 2);
  assert.equal(toastBanner.classList.contains('is-error'), true);
  assert.equal(
    toastBanner.textContent,
    exports.t('receipt.copyFailedToast', { msg: 'clipboard daemon offline' }),
  );
  assert.equal(fakeDocument.getElementById('btn-receipt-copy').disabled, false);
  assert.equal(fakeDocument.getElementById('btn-receipt-copy').textContent, exports.t('receipt.copyBtn'));
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================

  fakeDocument.dispatchEvent({ key: 'Escape', type: 'keydown', preventDefault() {} });
  assert.equal(receiptModal.classList.contains('hidden'), true, 'Escape must close #receipt-modal');
});
// ============================================================================
// [MODIFIED END] 2026-11-18 12:01:00
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:38:33
// Description: Add v0.3.0 Suites A, B, and C covering net_proxy forced/max-age
// pool rebuild, dispatcher .close() drain, HKCU\Environment & System32\reg.exe
// ENOENT fallbacks, recoverFromTransportFailure, live TCP CONNECT half-open
// blackhole E2E recovery, release_updater transport/concurrent retry hooks,
// standalone /api/snapshot & /api/check-update proxyStatus, and VM Settings
// tooltip proxy diagnostics + I18N/annotation hygiene.
// ============================================================================
test('v0.3.0 net_proxy forced same-signature rebuild, old dispatcher .close() drain, maxDispatcherAgeMs rotation, HKCU\\Environment fallback, ENOENT System32\\reg.exe fallback, and recoverFromTransportFailure', async () => {
  assert.equal(DEFAULT_MAX_DISPATCHER_AGE_MS, 15 * 60 * 1000);

  // 1. parseWindowsUserEnvProxyOutput: empty, REG_SZ, REG_EXPAND_SZ, priority, socks5 rejection, NO_PROXY loopback merge
  assert.deepEqual(parseWindowsUserEnvProxyOutput(''), {
    enabled: false,
    httpProxy: '',
    httpsProxy: '',
    noProxy: LOOPBACK_NO_PROXY,
  });

  const userEnvCustom = parseWindowsUserEnvProxyOutput(`
HKEY_CURRENT_USER\\Environment
    AGY_TOKEN_MONITOR_PROXY    REG_EXPAND_SZ    https://custom-user-env:9443/
    HTTPS_PROXY    REG_SZ    http://127.0.0.1:7890
    HTTP_PROXY    REG_SZ    http://127.0.0.1:7891
    ALL_PROXY    REG_SZ    http://127.0.0.1:7892
    NO_PROXY    REG_EXPAND_SZ    <local>;*.internal
`);
  assert.equal(userEnvCustom.enabled, true);
  assert.equal(userEnvCustom.httpProxy, 'https://custom-user-env:9443');
  assert.equal(userEnvCustom.httpsProxy, 'https://custom-user-env:9443');
  assert.equal(userEnvCustom.noProxy.includes('*.internal'), true);
  assert.equal(userEnvCustom.noProxy.includes('127.0.0.1'), true);
  assert.equal(userEnvCustom.noProxy.includes('localhost'), true);
  assert.equal(userEnvCustom.noProxy.includes('::1'), true);

  const userEnvStandard = parseWindowsUserEnvProxyOutput(`
    HTTPS_PROXY    REG_SZ    http://127.0.0.1:7891
    HTTP_PROXY    REG_EXPAND_SZ    http://127.0.0.1:7890
    ALL_PROXY    REG_SZ    http://127.0.0.1:7892
    NO_PROXY    REG_SZ    corp.local
`);
  assert.equal(userEnvStandard.enabled, true);
  assert.equal(userEnvStandard.httpProxy, 'http://127.0.0.1:7890');
  assert.equal(userEnvStandard.httpsProxy, 'http://127.0.0.1:7891');
  assert.equal(userEnvStandard.noProxy, 'corp.local,127.0.0.1,localhost,::1');

  const userEnvAllOnly = parseWindowsUserEnvProxyOutput(`
    ALL_PROXY    REG_EXPAND_SZ    127.0.0.1:8080
`);
  assert.equal(userEnvAllOnly.enabled, true);
  assert.equal(userEnvAllOnly.httpProxy, 'http://127.0.0.1:8080');
  assert.equal(userEnvAllOnly.httpsProxy, 'http://127.0.0.1:8080');

  const userEnvSocksRejected = parseWindowsUserEnvProxyOutput(`
    HTTPS_PROXY    REG_SZ    socks5h://127.0.0.1:7891
    HTTP_PROXY    REG_SZ    socks5://127.0.0.1:7891
    ALL_PROXY    REG_SZ    socks5://127.0.0.1:7892
`);
  assert.deepEqual(userEnvSocksRejected, {
    enabled: false,
    httpProxy: '',
    httpsProxy: '',
    noProxy: LOOPBACK_NO_PROXY,
  });

  // 2. resolveProxyConfig HKCU\Environment fallback when Internet Settings ProxyEnable = 0x0
  const fallbackQueries = [];
  const winUserEnvResolved = resolveProxyConfig({
    env: {},
    platform: 'win32',
    execFileSyncImpl: (cmd, args) => {
      fallbackQueries.push([cmd, args[1]]);
      if (args[1].endsWith('Internet Settings')) {
        return '    ProxyEnable    REG_DWORD    0x0\n    ProxyServer    REG_SZ    127.0.0.1:7890\n';
      }
      if (args[1] === 'HKCU\\Environment') {
        return '    HTTPS_PROXY    REG_SZ    http://127.0.0.1:7898\n    NO_PROXY    REG_SZ    intranet.local\n';
      }
      return '';
    },
  });
  assert.equal(winUserEnvResolved.enabled, true);
  assert.equal(winUserEnvResolved.source, 'win-user-env');
  assert.equal(winUserEnvResolved.httpProxy, 'http://127.0.0.1:7898');
  assert.equal(winUserEnvResolved.httpsProxy, 'http://127.0.0.1:7898');
  assert.equal(winUserEnvResolved.noProxy.includes('intranet.local'), true);
  assert.equal(winUserEnvResolved.noProxy.includes('::1'), true);
  assert.deepEqual(fallbackQueries, [
    ['reg.exe', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
    ['reg.exe', 'HKCU\\Environment'],
  ]);

  // 3. ENOENT fallback to %SystemRoot%\System32\reg.exe in resolveLiveOsSystemProxy and resolveProxyConfig
  const expectedSystem32Reg = join('D:\\WinTest', 'System32', 'reg.exe');
  const enoentLiveCalls = [];
  const liveViaSystem32 = resolveLiveOsSystemProxy({
    env: { SystemRoot: 'D:\\WinTest' },
    platform: 'win32',
    execFileSyncImpl: (cmd, args) => {
      enoentLiveCalls.push([cmd, args[1]]);
      if (cmd === 'reg.exe') {
        const err = new Error('spawn reg.exe ENOENT');
        err.code = 'ENOENT';
        throw err;
      }
      assert.equal(cmd, expectedSystem32Reg);
      return '    ProxyEnable    REG_DWORD    0x1\n    ProxyServer    REG_SZ    127.0.0.1:7897\n';
    },
  });
  assert.equal(liveViaSystem32?.enabled, true);
  assert.equal(liveViaSystem32?.source, 'win-registry');
  assert.equal(liveViaSystem32?.httpsProxy, 'http://127.0.0.1:7897');
  assert.deepEqual(enoentLiveCalls, [
    ['reg.exe', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
    [expectedSystem32Reg, 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
  ]);

  const enoentFallbackCalls = [];
  const userEnvViaSystem32 = resolveProxyConfig({
    env: { SystemRoot: 'D:\\WinTest', NO_PROXY: 'env.local' },
    platform: 'win32',
    execFileSyncImpl: (cmd, args) => {
      enoentFallbackCalls.push([cmd, args[1]]);
      if (cmd === 'reg.exe') {
        const err = new Error('spawn reg.exe ENOENT');
        err.code = 'ENOENT';
        throw err;
      }
      assert.equal(cmd, expectedSystem32Reg);
      if (args[1].endsWith('Internet Settings')) {
        return '    ProxyEnable    REG_DWORD    0x0\n';
      }
      if (args[1] === 'HKCU\\Environment') {
        return '    HTTP_PROXY    REG_EXPAND_SZ    http://127.0.0.1:7895\n';
      }
      return '';
    },
  });
  assert.equal(userEnvViaSystem32.enabled, true);
  assert.equal(userEnvViaSystem32.source, 'win-user-env');
  assert.equal(userEnvViaSystem32.httpProxy, 'http://127.0.0.1:7895');
  assert.equal(userEnvViaSystem32.noProxy.includes('env.local'), true);
  assert.equal(userEnvViaSystem32.noProxy.includes('127.0.0.1'), true);
  assert.deepEqual(enoentFallbackCalls, [
    ['reg.exe', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
    [expectedSystem32Reg, 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
    ['reg.exe', 'HKCU\\Environment'],
    [expectedSystem32Reg, 'HKCU\\Environment'],
  ]);

  // 4. createSystemProxyManager same-signature forced rebuild & maxDispatcherAgeMs rotation
  let nowMs = 5_000_000;
  const events = [];
  const sameSigMgr = createSystemProxyManager({
    env: {
      AGY_TOKEN_MONITOR_PROXY: 'http://127.0.0.1:7890',
      DISABLE_SYSTEM_PROXY_LOOKUP: '1',
    },
    platform: 'win32',
    cacheTtlMs: 300_000,
    maxDispatcherAgeMs: DEFAULT_MAX_DISPATCHER_AGE_MS,
    nowFn: () => nowMs,
    setGlobalProxyFn: (proxyEnv) => {
      const tag = proxyEnv.HTTPS_PROXY;
      events.push(`set:${tag}`);
      return () => {
        events.push(`restore:${tag}`);
      };
    },
  });

  const stInit = sameSigMgr.refresh();
  assert.equal(stInit.enabled, true);
  assert.equal(stInit.proxyUrl, 'http://127.0.0.1:7890');
  assert.equal(stInit.rebuildCount, 0);
  assert.deepEqual(events, ['set:http://127.0.0.1:7890']);

  // Normal refresh within TTL (and even past cacheTtlMs while < maxDispatcherAgeMs) does NOT rebuild
  nowMs += 60_000;
  assert.equal(sameSigMgr.refresh().rebuildCount, 0);
  nowMs += 300_000;
  assert.equal(sameSigMgr.refresh().rebuildCount, 0);
  assert.deepEqual(events, ['set:http://127.0.0.1:7890']);

  // Forced rebuild with identical signature executes restore -> set and increments rebuildCount
  const stForced = sameSigMgr.refresh({ force: true });
  assert.equal(stForced.rebuildCount, 1);
  assert.deepEqual(events, [
    'set:http://127.0.0.1:7890',
    'restore:http://127.0.0.1:7890',
    'set:http://127.0.0.1:7890',
  ]);

  // Advancing nowMs by >= maxDispatcherAgeMs triggers automatic rotation on normal refresh()
  nowMs += DEFAULT_MAX_DISPATCHER_AGE_MS;
  const stRotated = sameSigMgr.refresh();
  assert.equal(stRotated.rebuildCount, 2);
  assert.deepEqual(events, [
    'set:http://127.0.0.1:7890',
    'restore:http://127.0.0.1:7890',
    'set:http://127.0.0.1:7890',
    'restore:http://127.0.0.1:7890',
    'set:http://127.0.0.1:7890',
  ]);
  sameSigMgr.dispose();

  // 5. Real http.setGlobalProxyFromEnv replacement calls .close() on replaced EnvHttpProxyAgent (closed === true)
  const realCloseMgr = createSystemProxyManager({
    env: {
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      HTTP_PROXY: 'http://127.0.0.1:7890',
      DISABLE_SYSTEM_PROXY_LOOKUP: '1',
    },
    setGlobalProxyFn: http.setGlobalProxyFromEnv,
  });

  try {
    realCloseMgr.refresh({ force: true });
    const firstWrapper = globalThis[Symbol.for('undici.globalDispatcher.1')];
    const firstAgent =
      globalThis[Symbol.for('undici.globalDispatcher.2')] ||
      globalThis[Symbol.for('undici.globalDispatcher.1')];
    assert.ok(firstWrapper && typeof firstWrapper.close === 'function');
    assert.ok(firstAgent);
    assert.equal(firstAgent.closed, false);

    let closeCallCount = 0;
    const origWrapperClose = firstWrapper.close.bind(firstWrapper);
    firstWrapper.close = (...args) => {
      closeCallCount += 1;
      return origWrapperClose(...args);
    };

    const stRealRebuild = realCloseMgr.refresh({ force: true });
    await new Promise((r) => setImmediate(r));
    const secondAgent =
      globalThis[Symbol.for('undici.globalDispatcher.2')] ||
      globalThis[Symbol.for('undici.globalDispatcher.1')];

    assert.equal(stRealRebuild.rebuildCount, 1);
    assert.ok(closeCallCount >= 1, 'Replacing active dispatcher must invoke .close() on old dispatcher');
    assert.equal(firstAgent.closed, true, 'Replaced EnvHttpProxyAgent must be closed === true');
    assert.notEqual(secondAgent, firstAgent);
    assert.equal(secondAgent.closed, false);

    realCloseMgr.dispose();
    await new Promise((r) => setImmediate(r));
    assert.equal(secondAgent.closed, true, 'Disposing proxy manager must close active EnvHttpProxyAgent');
  } finally {
    realCloseMgr.dispose();
  }

  // 6. recoverFromTransportFailure():
  //    a) source === 'env' fails & live win-registry has ProxyEnable = 0x1 -> switches to win-registry
  const recDriftEvents = [];
  const recDriftMgr = createSystemProxyManager({
    env: {
      HTTPS_PROXY: 'http://127.0.0.1:10809',
      HTTP_PROXY: 'http://127.0.0.1:10809',
    },
    platform: 'win32',
    execFileSyncImpl: () => '    ProxyEnable    REG_DWORD    0x1\n    ProxyServer    REG_SZ    127.0.0.1:7890\n',
    setGlobalProxyFn: (proxyEnv) => {
      const tag = proxyEnv.HTTPS_PROXY;
      recDriftEvents.push(`set:${tag}`);
      return () => {
        recDriftEvents.push(`restore:${tag}`);
      };
    },
  });
  const initDrift = recDriftMgr.refresh();
  assert.equal(initDrift.source, 'env');
  assert.equal(initDrift.proxyUrl, 'http://127.0.0.1:10809');
  const recoveredDrift = recDriftMgr.recoverFromTransportFailure();
  assert.equal(recoveredDrift.enabled, true);
  assert.equal(recoveredDrift.source, 'win-registry');
  assert.equal(recoveredDrift.proxyUrl, 'http://127.0.0.1:7890');
  assert.equal(recoveredDrift.rebuildCount, 1);
  assert.deepEqual(recDriftEvents, [
    'set:http://127.0.0.1:10809',
    'restore:http://127.0.0.1:10809',
    'set:http://127.0.0.1:7890',
  ]);
  recDriftMgr.dispose();

  //    b) source === 'env' fails & live win-registry has ProxyEnable = 0x0 -> NEVER drops to direct; rebuilds env
  const recKeepEvents = [];
  const recKeepMgr = createSystemProxyManager({
    env: {
      HTTPS_PROXY: 'http://127.0.0.1:10809',
      HTTP_PROXY: 'http://127.0.0.1:10809',
    },
    platform: 'win32',
    execFileSyncImpl: () => '    ProxyEnable    REG_DWORD    0x0\n',
    setGlobalProxyFn: (proxyEnv) => {
      const tag = proxyEnv.HTTPS_PROXY;
      recKeepEvents.push(`set:${tag}`);
      return () => {
        recKeepEvents.push(`restore:${tag}`);
      };
    },
  });
  const initKeep = recKeepMgr.refresh();
  assert.equal(initKeep.source, 'env');
  const recoveredKeep = recKeepMgr.recoverFromTransportFailure();
  assert.equal(recoveredKeep.enabled, true, 'Must NEVER drop configured env proxy to direct');
  assert.equal(recoveredKeep.source, 'env');
  assert.equal(recoveredKeep.proxyUrl, 'http://127.0.0.1:10809');
  assert.equal(recoveredKeep.rebuildCount, 1);
  assert.deepEqual(recKeepEvents, [
    'set:http://127.0.0.1:10809',
    'restore:http://127.0.0.1:10809',
    'set:http://127.0.0.1:10809',
  ]);
  recKeepMgr.dispose();
});

test('v0.3.0 live TCP CONNECT proxy half-open blackhole E2E recovery + release_updater onTransportFailure, proxySummary, and concurrent manual checkPromise retry', async () => {
  // Part A: Live local HTTP target server (Keep-Alive: timeout=600) + local CONNECT/HTTP proxy half-open blackhole E2E
  const targetSockets = new Set();
  const targetServer = createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
      'Keep-Alive': 'timeout=600',
    });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });
  targetServer.on('connection', (sock) => {
    targetSockets.add(sock);
    sock.on('close', () => targetSockets.delete(sock));
  });
  const targetPort = await listenOnFetchSafePort(targetServer);

  const directAgent = new http.Agent({ keepAlive: false });
  const proxyClientSockets = new Set();
  const upstreamTunnelSockets = new Set();
  const blackholedSockets = new Set();

  const proxyServer = createServer((req, res) => {
    if (blackholedSockets.has(req.socket)) {
      return;
    }
    const parsed = new URL(req.url);
    const fwd = http.request(
      {
        host: '127.0.0.1',
        port: targetPort,
        path: `${parsed.pathname}${parsed.search}`,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
        agent: directAgent,
      },
      (pres) => {
        res.writeHead(pres.statusCode || 200, {
          ...pres.headers,
          Connection: 'keep-alive',
          'Keep-Alive': 'timeout=600',
        });
        pres.pipe(res);
      },
    );
    fwd.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(fwd);
  });

  proxyServer.on('connection', (sock) => {
    proxyClientSockets.add(sock);
    sock.on('close', () => proxyClientSockets.delete(sock));
  });

  proxyServer.on('connect', (_req, clientSocket, head) => {
    proxyClientSockets.add(clientSocket);
    clientSocket.on('close', () => proxyClientSockets.delete(clientSocket));
    if (blackholedSockets.has(clientSocket)) {
      return;
    }
    const upstream = netConnect(targetPort, '127.0.0.1', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) upstream.write(head);
      clientSocket.on('data', (chunk) => {
        if (!blackholedSockets.has(clientSocket)) {
          upstream.write(chunk);
        }
      });
      upstream.on('data', (chunk) => {
        if (!blackholedSockets.has(clientSocket)) {
          clientSocket.write(chunk);
        }
      });
    });
    upstreamTunnelSockets.add(upstream);
    upstream.on('close', () => upstreamTunnelSockets.delete(upstream));
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
  });

  const proxyPort = await listenOnFetchSafePort(proxyServer);
  const proxyUrl = `http://127.0.0.1:${proxyPort}`;

  const proxyMgr = createSystemProxyManager({
    env: {
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      DISABLE_SYSTEM_PROXY_LOOKUP: '1',
    },
    setGlobalProxyFn: http.setGlobalProxyFromEnv,
  });

  try {
    const initProxy = proxyMgr.refresh({ force: true });
    assert.equal(initProxy.enabled, true);
    assert.equal(initProxy.proxyUrl, proxyUrl);

    // 1. Initial proxied fetch succeeds over the tunnel/proxy connection
    const firstRes = await fetch(`http://remote.test:${targetPort}/initial`, {
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(firstRes.status, 200);
    const firstBody = await firstRes.json();
    assert.deepEqual(firstBody, { ok: true, path: '/initial' });

    await new Promise((r) => setTimeout(r, 30));
    assert.ok(proxyClientSockets.size >= 1, 'Initial proxied fetch must open at least 1 proxy socket');

    // 2. Blackhole the pooled tunnel/proxy socket(s) without closing them
    for (const sock of proxyClientSockets) {
      blackholedSockets.add(sock);
    }

    // 3. Un-rebuilt fetch reuses the half-open blackholed socket and throws TimeoutError
    await assert.rejects(
      () =>
        fetch(`http://remote.test:${targetPort}/blackhole`, {
          signal: AbortSignal.timeout(400),
        }),
      (err) => err?.name === 'TimeoutError',
    );

    // 4. Forced refresh on the exact same proxy URL closes stale pool and restores fast 200 OK
    const rebuiltStatus = proxyMgr.refresh({ force: true });
    assert.equal(rebuiltStatus.proxyUrl, proxyUrl);
    assert.equal(rebuiltStatus.rebuildCount, 1);

    const t0 = Date.now();
    const recoveredRes = await fetch(`http://remote.test:${targetPort}/recovered`, {
      signal: AbortSignal.timeout(2000),
    });
    const elapsedMs = Date.now() - t0;
    assert.equal(recoveredRes.status, 200);
    assert.deepEqual(await recoveredRes.json(), { ok: true, path: '/recovered' });
    assert.ok(elapsedMs < 1000, `Recovered fetch should finish rapidly, took ${elapsedMs}ms`);
  } finally {
    proxyMgr.dispose();
    directAgent.destroy();
    for (const sock of [...proxyClientSockets, ...upstreamTunnelSockets, ...targetSockets]) {
      sock.destroy();
    }
    proxyServer.closeAllConnections?.();
    targetServer.closeAllConnections?.();
    await new Promise((r) => proxyServer.close(() => r()));
    await new Promise((r) => targetServer.close(() => r()));
  }

  // Part B: release_updater onTransportFailure hook ordering, proxySummary, and concurrent manual checkPromise retry
  const { root, appData } = makeTempEnv();
  try {
    // B1. Channel 1 TimeoutError invokes onTransportFailure BEFORE Channel 2/3 and exposes proxySummary
    const stateDirHook = join(appData, 'hook-order');
    mkdirSync(stateDirHook, { recursive: true });
    const hookEvents = [];
    let currentProxy = { enabled: true, source: 'env', proxyUrl: 'http://127.0.0.1:10809' };

    const hookUpdater = createReleaseUpdater({
      stateDir: stateDirHook,
      currentVersion: '0.2.9',
      enableFallbackChannels: true,
      getProxyStatus: () => currentProxy,
      beforeNetworkCheck: ({ manual }) => {
        hookEvents.push(`before:${manual}`);
      },
      onTransportFailure: (info) => {
        hookEvents.push(`recover:${info.errorCode}`);
        currentProxy = { enabled: true, source: 'win-registry', proxyUrl: 'http://127.0.0.1:7890' };
      },
      fetchImpl: async (url) => {
        if (url.includes('api.github.com')) {
          hookEvents.push('ch1');
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        if (url.includes('releases/latest')) {
          hookEvents.push('ch2');
          return new Response(null, {
            status: 302,
            headers: { location: 'https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/v0.3.1' },
          });
        }
        hookEvents.push('ch3');
        return new Response('unexpected', { status: 500 });
      },
    });

    const hookRes = await hookUpdater.checkForUpdatesNow({ manual: true });
    assert.equal(hookRes.ok, true);
    assert.equal(hookRes.status.checkSource, 'github-web');
    assert.equal(hookRes.status.latestVersion, '0.3.1');
    assert.equal(hookRes.status.proxySummary, 'win-registry:http://127.0.0.1:7890');
    assert.deepEqual(hookEvents, ['before:true', 'ch1', 'recover:timeout', 'ch2']);

    const hookCache = JSON.parse(readFileSync(join(stateDirHook, 'update_cache.json'), 'utf-8'));
    assert.equal(hookCache.proxySummary, 'win-registry:http://127.0.0.1:7890');

    // B2. Concurrent manual checkForUpdatesNow({ manual: true }) retries cleanly when in-flight background check fails
    const stateDirRetry = join(appData, 'concurrent-retry');
    mkdirSync(stateDirRetry, { recursive: true });
    const beforeCalls = [];
    let releaseBgGate;
    const bgGate = new Promise((r) => {
      releaseBgGate = r;
    });
    let fetchAttempt = 0;

    const retryUpdater = createReleaseUpdater({
      stateDir: stateDirRetry,
      currentVersion: '0.2.9',
      autoCheckDisabled: false,
      enableFallbackChannels: false,
      getProxyStatus: () => ({ enabled: false, source: 'direct', proxyUrl: '' }),
      beforeNetworkCheck: ({ manual }) => {
        beforeCalls.push(manual);
      },
      fetchImpl: async () => {
        fetchAttempt += 1;
        if (fetchAttempt === 1) {
          await bgGate;
          throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET', message: 'stale socket' } });
        }
        return new Response(
          JSON.stringify({
            tag_name: 'v0.3.0',
            name: 'Token Monitor v0.3.0',
            published_at: '2026-11-18T00:00:00Z',
            html_url: 'https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/v0.3.0',
            assets: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    const bgStarted = retryUpdater.maybeCheckForUpdates();
    assert.equal(bgStarted, true);
    assert.equal(retryUpdater.getPublicStatus().checking, true);

    const manualPromise = retryUpdater.checkForUpdatesNow({ manual: true });
    releaseBgGate();
    const manualRes = await manualPromise;

    assert.deepEqual(beforeCalls, [false, true]);
    assert.equal(manualRes.ok, true);
    assert.equal(manualRes.status.latestVersion, '0.3.0');
    assert.equal(manualRes.status.latestTag, 'v0.3.0');
    assert.equal(manualRes.status.error, '');
    assert.equal(manualRes.status.proxySummary, 'direct');

    // Part C: Standalone main.mjs /api/snapshot and /api/check-update expose proxyStatus
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });
    const fakeHome = join(root, 'home');
    mkdirSync(fakeHome, { recursive: true });

    const mockUpdateServer = createServer((req, res) => {
      if (req.url === '/releases/latest') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            tag_name: 'v0.3.1',
            name: 'Token Monitor v0.3.1',
            published_at: '2026-11-18T00:00:00Z',
            html_url: 'https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/v0.3.1',
            assets: [],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });
    const mockUpdatePort = await listenOnFetchSafePort(mockUpdateServer);
    const deadProxyPort = await pickFetchSafeFreePort();
    const sidecarPort = await pickFetchSafeFreePort();

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
    const sdkCandidates = [
      join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
      join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    ].filter((p) => existsSync(p));

    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    delete env.ANTIGRAVITY_AGENTAPI_EXE;
    delete env.HTTP_PROXY;
    delete env.http_proxy;
    delete env.HTTPS_PROXY;
    delete env.https_proxy;
    delete env.ALL_PROXY;
    delete env.all_proxy;
    delete env.NO_PROXY;
    delete env.no_proxy;
    if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;
    env.PRICING_SYNC_DISABLE_AUTO = '1';
    env.RELEASE_UPDATE_DISABLE_AUTO = '1';
    env.DISABLE_SYSTEM_PROXY_LOOKUP = '1';
    env.AGY_TOKEN_MONITOR_PROXY = `http://user:secret@127.0.0.1:${deadProxyPort}`;
    env.RELEASE_UPDATE_API_URL = `http://127.0.0.1:${mockUpdatePort}/releases/latest`;
    env.RELEASE_UPDATE_ALLOW_LOOPBACK = '1';

    const child = spawn(process.execPath, [mainPath, '--standalone', String(sidecarPort)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      await new Promise((resolveReady, rejectReady) => {
        if (child.exitCode !== null) {
          rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
          return;
        }
        const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
          if (out.includes(`[sidecar] listening on 127.0.0.1:${sidecarPort}`)) {
            clearTimeout(timer);
            resolveReady();
          }
        });
        child.stderr.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
        });
      });

      const base = `http://127.0.0.1:${sidecarPort}`;
      const expectedMaskedProxy = `http://***@127.0.0.1:${deadProxyPort}`;

      const snapRes = await fetch(`${base}/api/snapshot`);
      assert.equal(snapRes.status, 200);
      const snap = await snapRes.json();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Bump standalone /api/snapshot appVersion assertion to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump standalone /api/snapshot appVersion assertion to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump standalone /api/snapshot appVersion assertion to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump standalone /api/snapshot appVersion assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump standalone /api/snapshot appVersion assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump standalone /api/snapshot appVersion assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump standalone /api/snapshot appVersion assertion from 0.5.1 to 0.5.2.
// ============================================================================
      assert.equal(snap.appVersion, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================
      assert.ok(snap.proxyStatus && typeof snap.proxyStatus === 'object');
      assert.equal(snap.proxyStatus.enabled, true);
      assert.equal(snap.proxyStatus.source, 'custom-env');
      assert.equal(snap.proxyStatus.proxyUrl, expectedMaskedProxy);
      assert.equal(snap.proxyStatus.noProxy, LOOPBACK_NO_PROXY);
      assert.equal(snap.proxyStatus.rebuildCount, 0);

      const checkRes = await fetch(`${base}/api/check-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(checkRes.status, 200);
      const checkBody = await checkRes.json();
      assert.equal(checkBody.ok, true);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Bump standalone /api/check-update appVersion assertion to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump standalone /api/check-update appVersion assertion to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump standalone /api/check-update appVersion assertion to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump standalone /api/check-update appVersion assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump standalone /api/check-update appVersion assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump standalone /api/check-update appVersion assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump standalone /api/check-update appVersion assertion from 0.5.1 to 0.5.2.
// ============================================================================
      assert.equal(checkBody.appVersion, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================
      assert.ok(checkBody.proxyStatus && typeof checkBody.proxyStatus === 'object');
      assert.equal(checkBody.proxyStatus.enabled, true);
      assert.equal(checkBody.proxyStatus.source, 'custom-env');
      assert.equal(checkBody.proxyStatus.proxyUrl, expectedMaskedProxy);
      assert.equal(checkBody.proxyStatus.rebuildCount, 1);
      assert.equal(checkBody.updateStatus.proxySummary, `custom-env:${expectedMaskedProxy}`);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise((r) => {
          if (child.exitCode !== null || child.signalCode !== null) return r();
          const t = setTimeout(r, 3000);
          child.once('exit', () => {
            clearTimeout(t);
            r();
          });
        });
      }
      await new Promise((r) => mockUpdateServer.close(() => r()));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.3.0 headless Node VM Settings tooltip proxy diagnostics and static I18N/annotation hygiene', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const netProxySource = readFileSync(join(paneDir, 'net_proxy.mjs'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const releaseUpdaterSource = readFileSync(join(paneDir, 'release_updater.mjs'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  // 1. Static I18N parity for v0.3.0 proxy diagnostic tooltip keys and placeholder parity
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object must exist in app.js');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks must be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());

  assert.equal(zhEntries.get('settings.proxyDiagActive'), '代理: {url} ({source})');
  assert.equal(enEntries.get('settings.proxyDiagActive'), 'Proxy: {url} ({source})');
  assert.equal(zhEntries.get('settings.proxyDiagDirect'), '直连模式 (未检测到系统代理)');
  assert.equal(enEntries.get('settings.proxyDiagDirect'), 'Direct connection (no proxy detected)');

  const extractPlaceholders = (str) =>
    [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const key of ['settings.proxyDiagActive', 'settings.proxyDiagDirect']) {
    assert.deepEqual(
      extractPlaceholders(zhEntries.get(key)),
      extractPlaceholders(enEntries.get(key)),
      `Placeholder mismatch for ${key}`,
    );
  }
  assert.deepEqual(extractPlaceholders(enEntries.get('settings.proxyDiagActive')), ['source', 'url']);
  assert.deepEqual(extractPlaceholders(enEntries.get('settings.proxyDiagDirect')), []);

  // 2. Balanced [MODIFIED BEGIN/END] annotations across all v0.3.0 modified files
  const modBeginMarker = '[' + 'MODIFIED BEGIN]';
  const modEndMarker = '[' + 'MODIFIED END]';
  for (const [label, src] of [
    ['net_proxy.mjs', netProxySource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['main.mjs', mainSource],
    ['app.js', appSource],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    let depth = 0;
    let minDepth = 0;
    let begins = 0;
    let ends = 0;
    for (const line of src.split(/\r?\n/)) {
      if (line.includes(modBeginMarker)) {
        depth += 1;
        begins += 1;
      }
      if (line.includes(modEndMarker)) {
        depth -= 1;
        ends += 1;
        if (depth < minDepth) minDepth = depth;
      }
    }
    assert.ok(begins > 0, `${label} must contain modification annotations`);
    assert.equal(begins, ends, `${label} begin/end annotation count mismatch`);
    assert.equal(depth, 0, `${label} unclosed modification annotation (depth=${depth})`);
    assert.equal(minDepth, 0, `${label} unmatched end annotation (minDepth=${minDepth})`);
  }

  // 3. Headless Node VM behavioral tests for renderUpdateCheckStatus() proxy diagnostics tooltip in zh & en
  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0, 'app.js must end with IIFE closing })();');

  const instrumentedSource =
    appSource.slice(0, iifeCloseIdx) +
    `\n  globalThis.__tmV030Exports = {\n` +
    `    state,\n` +
    `    t,\n` +
    `    getCurrentAppVersion,\n` +
    `    formatProxyDiagHint,\n` +
    `    renderUpdateCheckStatus,\n` +
    `  };\n` +
    appSource.slice(iifeCloseIdx);

  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }
  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }
  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.disabled = false;
      this.style = {
        cssText: '',
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
      };
    }
    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }
    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') {
        const tn = new FakeTextNode(str);
        tn.parentNode = this;
        this.childNodes.push(tn);
      }
    }
    setAttribute(name, val) {
      this.attributes.set(String(name), String(val));
    }
    getAttribute(name) {
      const k = String(name);
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    removeAttribute(name) {
      this.attributes.delete(String(name));
    }
    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    remove() {
      this.parentNode = null;
    }
  }

  const elementsById = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);
  const fakeDocument = {
    readyState: 'loading',
    hidden: false,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const key = String(id);
      if (!elementsById.has(key)) {
        const elem = new FakeElement('div');
        elem.setAttribute('id', key);
        rootBody.appendChild(elem);
        elementsById.set(key, elem);
      }
      return elementsById.get(key);
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  const sandbox = {
    Node: FakeNode,
    document: fakeDocument,
    window: {
      addEventListener: () => {},
      matchMedia: () => ({ matches: false }),
      sidecar: { conversationId: 'conv-vm-v030' },
      location: { reload: () => {} },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: 'rgb(246, 247, 249)' }),
    AbortController,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
    URLSearchParams,
    Intl,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(instrumentedSource, sandbox);
  const exports = sandbox.__tmV030Exports;
  assert.ok(exports, 'VM execution must expose __tmV030Exports');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Bump getCurrentAppVersion fallback assertion to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Bump getCurrentAppVersion fallback assertion to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Bump getCurrentAppVersion fallback assertion to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump getCurrentAppVersion fallback assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump getCurrentAppVersion fallback assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump getCurrentAppVersion fallback assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump getCurrentAppVersion fallback assertion from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(exports.getCurrentAppVersion(), '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================

  const statusEl = fakeDocument.getElementById('update-version-status');
  exports.state.updateChecking = false;
  exports.state.updateApplying = false;

  // Case A: Active proxy from state.snapshot.proxyStatus (en & zh)
  exports.state.snapshot = {
    appVersion: '0.3.0',
    proxyStatus: {
      enabled: true,
      source: 'win-registry',
      proxyUrl: 'http://127.0.0.1:7890',
    },
    updateStatus: {
      currentVersion: '0.3.0',
      hasUpdate: false,
      lastCheckedAtMs: Date.now() - 10_000,
      error: 'The operation was aborted due to timeout',
      errorCode: 'timeout',
    },
  };

  exports.state.lang = 'en';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.classList.contains('is-offline'), true);
  assert.equal(statusEl.title.includes(exports.t('update.errTimeout')), true);
  assert.equal(statusEl.title.includes('Proxy: http://127.0.0.1:7890 (win-registry)'), true);

  exports.state.lang = 'zh';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes(exports.t('update.errTimeout')), true);
  assert.equal(statusEl.title.includes('代理: http://127.0.0.1:7890 (win-registry)'), true);

  // Case B: Direct connection from state.snapshot.proxyStatus (en & zh)
  exports.state.snapshot.proxyStatus = {
    enabled: false,
    source: 'direct',
    proxyUrl: '',
  };

  exports.state.lang = 'en';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes('Direct connection (no proxy detected)'), true);

  exports.state.lang = 'zh';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes('直连模式 (未检测到系统代理)'), true);

  // Case C: Fallback to updateStatus.proxySummary when snapshot.proxyStatus is absent
  exports.state.snapshot = null;
  exports.state.activeUpdateStatus = {
    currentVersion: '0.3.0',
    hasUpdate: false,
    error: 'fetch failed',
    errorCode: 'network',
    proxySummary: 'win-user-env:http://127.0.0.1:7898',
  };

  exports.state.lang = 'en';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes('Proxy: http://127.0.0.1:7898 (win-user-env)'), true);

  exports.state.lang = 'zh';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes('代理: http://127.0.0.1:7898 (win-user-env)'), true);

  exports.state.activeUpdateStatus.proxySummary = 'direct';
  exports.state.lang = 'en';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes(exports.t('settings.proxyDiagDirect')), true);

  exports.state.lang = 'zh';
  exports.renderUpdateCheckStatus();
  assert.equal(statusEl.title.includes(exports.t('settings.proxyDiagDirect')), true);
});
// ============================================================================
// [MODIFIED END] 2026-11-18 15:38:33
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:27:30
// Description: Add v0.3.1 test suite covering decodeAndValidatePngBase64,
// copyPngToSystemClipboard (win32/ENOENT/darwin/linux/finally cleanup),
// standalone main.mjs POST /api/copy-receipt HTTP 400 validation, and
// clipboard_image.mjs syntax/annotation/banned-term hygiene.
// ============================================================================
test('v0.3.1 decodeAndValidatePngBase64 validates PNG data URLs, raw base64, headers, signature, and size bounds', () => {
  const validPng = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(16, 0x41)]);
  const validB64 = validPng.toString('base64');

  for (const input of [
    `data:image/png;base64,${validB64}`,
    `data:image/png;charset=utf-8;base64,${validB64}`,
    `DATA:IMAGE/PNG;BASE64,${validB64}`,
    validB64,
  ]) {
    const res = decodeAndValidatePngBase64(input);
    assert.equal(res.ok, true, `Expected valid PNG payload to pass: ${input.slice(0, 32)}`);
    assert.equal(Buffer.isBuffer(res.buffer), true);
    assert.equal(res.buffer.equals(validPng), true);
  }

  const tooSmallPng = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(15, 0x41)]);
  const badSigPng = Buffer.alloc(24, 0x5a);
  const oversizedPng = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(MAX_CLIPBOARD_PNG_BYTES, 0x41)]);

  for (const badInput of [
    '',
    '   ',
    null,
    undefined,
    12345,
    { imageBase64: validB64 },
    `data:image/jpeg;base64,${validB64}`,
    `data:image/png;base64,${badSigPng.toString('base64')}`,
    `data:image/png;base64,${tooSmallPng.toString('base64')}`,
    `data:image/png;base64,${oversizedPng.toString('base64')}`,
  ]) {
    const res = decodeAndValidatePngBase64(badInput);
    assert.equal(res.ok, false);
    assert.equal(typeof res.error, 'string');
    assert.ok(res.error.length > 0);
  }
});

test('v0.3.1 copyPngToSystemClipboard handles win32/ENOENT fallback, darwin, linux missing helpers, and finally temp cleanup', async () => {
  const validPng = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(24, 0x42)]);
  const tempRoot = mkdtempSync(join(tmpdir(), 'tm-v031-clip-'));

  try {
    // 1. win32 happy path: -NoProfile -NonInteractive -STA -Command, AGY_CLIP_PNG_PATH, temp cleaned up
    const winDir = join(tempRoot, 'win-ok');
    mkdirSync(winDir, { recursive: true });
    let capturedWinCall = null;
    const winRes = await copyPngToSystemClipboard(validPng, {
      platform: 'win32',
      tempDir: winDir,
      execFileImpl(cmd, args, opts, cb) {
        const clipPath = opts?.env?.AGY_CLIP_PNG_PATH;
        capturedWinCall = {
          cmd,
          args,
          clipPath,
          existsDuringExec: Boolean(clipPath && existsSync(clipPath)),
          bytesMatch: Boolean(clipPath && readFileSync(clipPath).equals(validPng)),
        };
        cb(null, '', '');
      },
    });
    assert.deepEqual(winRes, { ok: true, platform: 'win32' });
    assert.equal(capturedWinCall.cmd, 'powershell.exe');
    assert.deepEqual(capturedWinCall.args.slice(0, 4), [
      '-NoProfile',
      '-NonInteractive',
      '-STA',
      '-Command',
    ]);
    assert.equal(capturedWinCall.args[4].includes('$env:AGY_CLIP_PNG_PATH'), true);
    assert.equal(capturedWinCall.args[4].includes(capturedWinCall.clipPath), false);
    assert.equal(capturedWinCall.existsDuringExec, true);
    assert.equal(capturedWinCall.bytesMatch, true);
    assert.equal(capturedWinCall.clipPath.endsWith('.png'), true);
    assert.deepEqual(readdirSync(winDir), []);

    // 2. win32 ENOENT fallback to SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe
    const winEnoentDir = join(tempRoot, 'win-enoent');
    mkdirSync(winEnoentDir, { recursive: true });
    const enoentCmds = [];
    const winEnoentRes = await copyPngToSystemClipboard(validPng, {
      platform: 'win32',
      env: { SystemRoot: 'C:\\CustomWinRoot' },
      tempDir: winEnoentDir,
      execFileImpl(cmd, args, opts, cb) {
        enoentCmds.push({ cmd, args });
        if (enoentCmds.length === 1) {
          cb(Object.assign(new Error('spawn powershell.exe ENOENT'), { code: 'ENOENT' }));
          return;
        }
        cb(null, '', '');
      },
    });
    assert.deepEqual(winEnoentRes, { ok: true, platform: 'win32' });
    assert.equal(enoentCmds.length, 2);
    assert.equal(enoentCmds[0].cmd, 'powershell.exe');
    assert.equal(
      enoentCmds[1].cmd,
      join('C:\\CustomWinRoot', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    );
    assert.deepEqual(readdirSync(winEnoentDir), []);

    // 3. Failure path guarantees tempDir .png cleanup inside finally
    const winFailDir = join(tempRoot, 'win-fail');
    mkdirSync(winFailDir, { recursive: true });
    let sawTempDuringFail = false;
    const winFailRes = await copyPngToSystemClipboard(validPng, {
      platform: 'win32',
      tempDir: winFailDir,
      execFileImpl(cmd, args, opts, cb) {
        sawTempDuringFail = Boolean(opts?.env?.AGY_CLIP_PNG_PATH && existsSync(opts.env.AGY_CLIP_PNG_PATH));
        cb(new Error('SetDataObject failed'));
      },
    });
    assert.equal(sawTempDuringFail, true);
    assert.equal(winFailRes.ok, false);
    assert.equal(winFailRes.error, 'SetDataObject failed');
    assert.deepEqual(readdirSync(winFailDir), []);

    // 4. darwin /usr/bin/osascript
    const macDir = join(tempRoot, 'mac-ok');
    mkdirSync(macDir, { recursive: true });
    let capturedMacCall = null;
    const macRes = await copyPngToSystemClipboard(validPng, {
      platform: 'darwin',
      tempDir: macDir,
      execFileImpl(cmd, args, opts, cb) {
        capturedMacCall = {
          cmd,
          args,
          existsDuringExec: Boolean(
            opts?.env?.AGY_CLIP_PNG_PATH && existsSync(opts.env.AGY_CLIP_PNG_PATH),
          ),
        };
        cb(null, '', '');
      },
    });
    assert.deepEqual(macRes, { ok: true, platform: 'darwin' });
    assert.equal(capturedMacCall.cmd, '/usr/bin/osascript');
    assert.equal(capturedMacCall.args[0], '-e');
    assert.equal(capturedMacCall.args[1].includes('AGY_CLIP_PNG_PATH'), true);
    assert.equal(capturedMacCall.existsDuringExec, true);
    assert.deepEqual(readdirSync(macDir), []);

    // 5. linux missing wl-copy & xclip graceful { ok: false } + cleanup
    const linuxDir = join(tempRoot, 'linux-missing');
    mkdirSync(linuxDir, { recursive: true });
    const linuxCalls = [];
    const linuxRes = await copyPngToSystemClipboard(validPng, {
      platform: 'linux',
      env: {},
      tempDir: linuxDir,
      execFileImpl(cmd, args, opts, cb) {
        linuxCalls.push({ cmd, args });
        cb(Object.assign(new Error(`${cmd} ENOENT`), { code: 'ENOENT' }));
      },
    });
    assert.equal(linuxCalls.length, 2);
    assert.equal(linuxCalls[0].cmd, 'wl-copy');
    assert.deepEqual(linuxCalls[0].args, ['--type', 'image/png']);
    assert.equal(linuxCalls[1].cmd, 'xclip');
    assert.equal(linuxCalls[1].args[0], '-selection');
    assert.equal(linuxRes.ok, false);
    assert.match(linuxRes.error, /wl-copy or xclip/);
    assert.deepEqual(readdirSync(linuxDir), []);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('v0.3.1 standalone main.mjs POST /api/copy-receipt rejects missing, non-PNG, and oversized payloads with HTTP 400', async () => {
  const { root, appData } = makeTempEnv();
  try {
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });
    const fakeHome = join(root, 'home');
    mkdirSync(fakeHome, { recursive: true });

    const sidecarPort = await pickFetchSafeFreePort();
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
    const sdkCandidates = [
      join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
      join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    ].filter((p) => existsSync(p));

    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    delete env.ANTIGRAVITY_AGENTAPI_EXE;
    if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;
    env.PRICING_SYNC_DISABLE_AUTO = '1';
    env.RELEASE_UPDATE_DISABLE_AUTO = '1';
    env.DISABLE_SYSTEM_PROXY_LOOKUP = '1';

    const child = spawn(process.execPath, [mainPath, '--standalone', String(sidecarPort)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      await new Promise((resolveReady, rejectReady) => {
        if (child.exitCode !== null) {
          rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
          return;
        }
        const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 5000);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
          if (out.includes(`[sidecar] listening on 127.0.0.1:${sidecarPort}`)) {
            clearTimeout(timer);
            resolveReady();
          }
        });
        child.stderr.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
        });
      });

      const endpoint = `http://127.0.0.1:${sidecarPort}/api/copy-receipt`;
      const validPngB64 = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(16, 0x41)]).toString('base64');
      const oversizedPayload =
        'data:image/png;base64,' +
        Buffer.concat([PNG_SIGNATURE, Buffer.alloc(MAX_CLIPBOARD_PNG_BYTES, 0x41)]).toString('base64');

      for (const payload of [
        {},
        { imageBase64: '' },
        { imageBase64: `data:image/jpeg;base64,${validPngB64}` },
        { imageBase64: `data:image/png;base64,${Buffer.alloc(32, 0x22).toString('base64')}` },
        { imageBase64: oversizedPayload },
      ]) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.ok, false);
        assert.equal(typeof body.error, 'string');
        assert.ok(body.error.length > 0);
      }
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise((r) => {
          if (child.exitCode !== null || child.signalCode !== null) return r();
          const t = setTimeout(r, 3000);
          child.once('exit', () => {
            clearTimeout(t);
            r();
          });
        });
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.3.1 clipboard_image.mjs syntax, balanced annotations, and banned-term checks', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const clipboardImagePath = join(testDir, '..', 'sidecars', 'monitor_pane', 'clipboard_image.mjs');
  const syntaxRes = spawnSync(process.execPath, ['--check', clipboardImagePath], { encoding: 'utf-8' });
  assert.equal(syntaxRes.status, 0, `clipboard_image.mjs syntax check failed: ${syntaxRes.stderr}`);

  const src = readFileSync(clipboardImagePath, 'utf-8');
  const modBeginMarker = '[' + 'MODIFIED BEGIN]';
  const modEndMarker = '[' + 'MODIFIED END]';
  let depth = 0;
  let minDepth = 0;
  let begins = 0;
  let ends = 0;
  for (const line of src.split(/\r?\n/)) {
    if (line.includes(modBeginMarker)) {
      depth += 1;
      begins += 1;
    }
    if (line.includes(modEndMarker)) {
      depth -= 1;
      ends += 1;
      if (depth < minDepth) minDepth = depth;
    }
  }
  assert.ok(begins > 0, 'clipboard_image.mjs must contain modification annotations');
  assert.equal(begins, ends, 'clipboard_image.mjs begin/end annotation count mismatch');
  assert.equal(depth, 0, `clipboard_image.mjs unclosed modification annotation (depth=${depth})`);
  assert.equal(minDepth, 0, `clipboard_image.mjs unmatched end annotation (minDepth=${minDepth})`);

  const bannedTerm = '\u6c34\u4f4d';
  const legacyDocPhrase = 'Dedicated ' + 'Gemini 3.1 Pro';
  assert.equal(src.includes(bannedTerm), false);
  assert.equal(src.includes(legacyDocPhrase), false);
});
// ============================================================================
// [MODIFIED END] 2026-11-18 16:27:30
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:40:11
// Description: Add v0.3.2 standalone E2E test verifying constant 43-char SHA-256 base64url /api/snapshot etag prevents HTTP 431 with 140+ swarm members and invalidates cleanly on members.json kill update.
// ============================================================================
test('v0.3.2 constant 43-char SHA-256 base64url /api/snapshot etag prevents HTTP 431 with 140+ swarm members and invalidates cleanly', async () => {
  const { root, appData } = makeTempEnv();
  try {
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });
    const fakeHome = join(root, 'home');
    mkdirSync(fakeHome, { recursive: true });

    const baseMs = Date.parse('2026-11-18T06:00:00Z');
    const coordId = '03200000-0000-4000-8000-000000000000';
    const workerCount = 140;
    const members = {
      coordinator: {
        conversation_id: coordId,
        role: 'coordinator',
        model: 'gemini-4-argon',
      },
    };

    for (let i = 1; i <= workerCount; i += 1) {
      const workerId = `03200000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const workerName = `w${String(i).padStart(3, '0')}`;
      members[workerName] = {
        conversation_id: workerId,
        role: 'worker',
        model: 'gemini-3.8-flash',
        killed: false,
        state: 'waiting',
      };
      writeConversation(appData, workerId, {
        compactLines: [
          {
            step_index: 0,
            type: 'USER_INPUT',
            status: 'DONE',
            created_at: new Date(baseMs + i * 1000).toISOString(),
            content: `Worker ${workerName} task`,
          },
          {
            step_index: 1,
            type: 'PLANNER_RESPONSE',
            status: 'DONE',
            created_at: new Date(baseMs + i * 1000 + 500).toISOString(),
            input_tokens: 1500,
            cache_read_tokens: 500,
            output_tokens: 120,
          },
        ],
        fullLines: [
          {
            step_index: 0,
            type: 'USER_INPUT',
            status: 'DONE',
            created_at: new Date(baseMs + i * 1000).toISOString(),
            content: `Worker ${workerName} full task payload`,
          },
        ],
        mtimeMs: baseMs + i * 1000 + 500,
      });
    }

    const swarmMembersObj = {
      title: 'v0.3.2 140+ Swarm ETag Overflow Prevention Test',
      members,
    };

    writeConversation(appData, coordId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs).toISOString(),
          content: '<USER_REQUEST>Coordinate 140 swarm workers</USER_REQUEST>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 500).toISOString(),
          input_tokens: 4000,
          cache_read_tokens: 1000,
          output_tokens: 300,
        },
      ],
      members: swarmMembersObj,
      mtimeMs: baseMs + 500,
    });

    // Confirm raw unhashed _etagPart + global _etagPart would exceed Node's 16 KB HTTP header limit when URL-encoded in /api/snapshot?etag=.
    const rawCoord = analyzeConversation(coordId, {
      appDataDirs: [appData],
      disableAgentApi: true,
    });
    const rawGlobal = summarizeGlobalAndRecent({
      appDataDirs: [appData],
    });
    assert.equal(rawCoord.children.length, workerCount);
    const simulatedUnhashedQuery = encodeURIComponent(
      `${coordId}|p0|m0|${rawCoord._etagPart}|${rawGlobal._etagPart}|u::0:0`,
    );
    assert.ok(
      simulatedUnhashedQuery.length > 16384,
      `Expected URL-encoded unhashed rawEtag (> 16 KB) to overflow HTTP headers, got ${simulatedUnhashedQuery.length}`,
    );

    const sidecarPort = await pickFetchSafeFreePort();
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
    const sdkCandidates = [
      join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
      join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    ].filter((p) => existsSync(p));

    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    delete env.ANTIGRAVITY_AGENTAPI_EXE;
    if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;
    env.PRICING_SYNC_DISABLE_AUTO = '1';
    env.RELEASE_UPDATE_DISABLE_AUTO = '1';
    env.DISABLE_SYSTEM_PROXY_LOOKUP = '1';

    const child = spawn(process.execPath, [mainPath, '--standalone', String(sidecarPort)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      await new Promise((resolveReady, rejectReady) => {
        if (child.exitCode !== null) {
          rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
          return;
        }
        const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 10000);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
          if (out.includes(`[sidecar] listening on 127.0.0.1:${sidecarPort}`)) {
            clearTimeout(timer);
            resolveReady();
          }
        });
        child.stderr.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
        });
      });

      const base = `http://127.0.0.1:${sidecarPort}`;

      // Finish cold-start ledger sync and drain initial metadataStore fallback lookups so background versions stabilize before timed polls
      const resyncRes = await fetch(`${base}/api/resync-ledger`, { method: 'POST' });
      assert.equal(resyncRes.status, 200);
      const resyncBody = await resyncRes.json();
      assert.equal(resyncBody.ok, true);
      assert.equal(resyncBody.conversationsCount, workerCount + 1);

      let warmEtag = '';
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const warmRes = await fetch(
          `${base}/api/snapshot?conv=${encodeURIComponent(coordId)}&etag=${encodeURIComponent(warmEtag)}`,
        );
        assert.equal(warmRes.status, 200);
        const warmBody = await warmRes.json();
        if (warmBody.unchanged === true) break;
        warmEtag = warmBody.etag || '';
        await new Promise((r) => setTimeout(r, 100));
      }

      // 1. Initial poll: returns 200, full payload, and constant 43-char SHA-256 base64url etag
      const snapRes1 = await fetch(`${base}/api/snapshot?conv=${encodeURIComponent(coordId)}&etag=`);
      assert.equal(snapRes1.status, 200);
      const snap = await snapRes1.json();
      assert.equal(snap.unchanged, false);
      assert.equal(typeof snap.etag, 'string');
      assert.equal(snap.etag.length, 43);
      assert.match(snap.etag, /^[A-Za-z0-9_-]{43}$/);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:06:21
// Description: Update v0.3.2 ETag test standalone appVersion assertion to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Update v0.3.2 ETag test standalone appVersion assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Update v0.3.2 ETag test standalone appVersion assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Update v0.3.2 ETag test standalone appVersion assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Update v0.3.2 ETag test standalone appVersion assertion from 0.5.1 to 0.5.2.
// ============================================================================
      assert.equal(snap.appVersion, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 12:06:21
// ============================================================================
      assert.equal(snap.current?.children?.length, workerCount);

      // 2. Second poll with etag + realistic ~1.5 KB request headers -> must return 200 (never 431) and unchanged: true
      const snapRes2 = await fetch(
        `${base}/api/snapshot?conv=${encodeURIComponent(coordId)}&etag=${encodeURIComponent(snap.etag)}`,
        {
          headers: {
            Referer: `${base}/?session=${'r'.repeat(480)}`,
            'User-Agent': `Mozilla/5.0 (${'u'.repeat(500)})`,
            'X-Extra-Test': 'x'.repeat(500),
          },
        },
      );
      assert.equal(snapRes2.status, 200);
      const snap2 = await snapRes2.json();
      assert.equal(snap2.unchanged, true);
      assert.equal(snap2.etag, snap.etag);

      // 3. Flip one worker in members.json to killed: true -> etag invalidates cleanly to a new 43-char digest
      const membersPath = join(appData, 'brain', coordId, '.system_generated', 'swarm', 'members.json');
      const mutatedMembers = JSON.parse(JSON.stringify(swarmMembersObj));
      mutatedMembers.members.w001.killed = true;
      writeFileSync(membersPath, JSON.stringify(mutatedMembers, null, 2), 'utf-8');

      const snapRes3 = await fetch(
        `${base}/api/snapshot?conv=${encodeURIComponent(coordId)}&etag=${encodeURIComponent(snap.etag)}`,
      );
      assert.equal(snapRes3.status, 200);
      const snap3 = await snapRes3.json();
      assert.equal(snap3.unchanged, false);
      assert.equal(typeof snap3.etag, 'string');
      assert.equal(snap3.etag.length, 43);
      assert.match(snap3.etag, /^[A-Za-z0-9_-]{43}$/);
      assert.notEqual(snap3.etag, snap.etag);
      const w001After = snap3.current?.children?.find((c) => c.name === 'w001');
      assert.ok(w001After, 'w001 must remain present in children after kill');
      assert.equal(w001After.killed, true);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise((r) => {
          if (child.exitCode !== null || child.signalCode !== null) return r();
          const t = setTimeout(r, 3000);
          child.once('exit', () => {
            clearTimeout(t);
            r();
          });
        });
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-18 16:40:11
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 12:09:01
// Description: Add comprehensive v0.4.0 regression suite covering Gemini 4 Neon /
// Orchestrator (Neon) unification, pixel_office.js engine (10 archetypes, 160-sprite
// cache, 1+8 cap, activeToolLabel, hitTest across 280/380/560px), backend prefs &
// /pixel_office.js HTTP route, net_proxy high-CPU anti-flap hardening, update modal
// nested markdown & section filtering, Pixel Office VM integration, I18N parity,
// banned terms, and annotation balance.
// ============================================================================
test('v0.4.0 Gemini 4 Neon & Orchestrator (Neon) unification across parser, pricing_sync, subscription, receipt, pixel_office, and app.js', async () => {
  // 1. Enum map & normalizeModelId
  assert.equal(MODEL_ENUM_MAP.get(1535), 'gemini-4-neon');
  assert.equal(MODEL_ENUM_MAP.get(1537), 'gemini-pro-orchestrator-neon');

  assert.equal(normalizeModelId('Orchestrator (Neon)'), 'gemini-pro-orchestrator-neon');
  assert.equal(normalizeModelId('Gemini 4 Neon (High)'), 'gemini-4-neon');
  assert.equal(normalizeModelId('gemini-pro-orchestrator-neon'), 'gemini-pro-orchestrator-neon');
  assert.equal(normalizeModelId('gemini-4-neon-high'), 'gemini-4-neon');
  assert.equal(normalizeModelId('Orchestrator (Carbon)'), 'gemini-pro-orchestrator');
  assert.equal(normalizeModelId('Orchestrator (Argon)'), 'gemini-pro-orchestrator-argon');

  // 2. resolveModelProfile unification (never shadowed by Carbon or Auto)
  for (const neonInput of [
    'Gemini 4 Neon (High)',
    'Orchestrator (Neon)',
    'gemini-4-neon',
    'gemini-pro-orchestrator-neon',
  ]) {
    const profile = resolveModelProfile(neonInput);
    assert.equal(profile.id, 'gemini-4-neon', `Expected ${neonInput} -> gemini-4-neon, got ${profile.id}`);
    assert.notEqual(profile.id, 'gemini-4-carbon');
    assert.notEqual(profile.id, 'auto');
  }

  for (const carbonInput of ['gemini-pro-orchestrator', 'Orchestrator (Carbon)', 'Gemini 4 Carbon (High)']) {
    assert.equal(resolveModelProfile(carbonInput).id, 'gemini-4-carbon');
  }
  for (const argonInput of ['gemini-pro-orchestrator-argon', 'Orchestrator (Argon)', 'Gemini 4 Argon (Low)']) {
    assert.equal(resolveModelProfile(argonInput).id, 'gemini-4-argon');
  }

  // Performance tier ordering: Carbon > Neon > Argon > Hydrogen > 3.1 Pro > 3.8 Flash
  assert.ok(
    scoreModelPerformance({ id: 'gemini-4-carbon', group: 'Gemini 系列', label: 'Gemini 4 Carbon' }) >
      scoreModelPerformance({ id: 'gemini-4-neon', group: 'Gemini 系列', label: 'Gemini 4 Neon' }),
  );
  assert.ok(
    scoreModelPerformance({ id: 'gemini-4-neon', group: 'Gemini 系列', label: 'Gemini 4 Neon' }) >
      scoreModelPerformance({ id: 'gemini-4-argon', group: 'Gemini 系列', label: 'Gemini 4 Argon' }),
  );

  // 3. pricingSync.getRuntimeCatalog merges both observed slugs cleanly without duplicate promoted entries
  const stateDir = mkdtempSync(join(tmpdir(), 'tm-v040-neon-pricing-'));
  try {
    const mgr = createPricingSyncManager({
      stateDir,
      baseCatalog: MODEL_PRICING_CATALOG,
      googlePricingUrl: '',
      liteLlmUrl: '',
      autoSyncDisabled: true,
      fetchImpl: async (url) => {
        if (url.includes('models.dev')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              google: {
                models: {
                  'gemini-4-neon': {
                    id: 'gemini-4-neon',
                    name: 'Gemini 4 Neon',
                    cost: { input: 2.2, cache_read: 0.22, output: 11.0 },
                  },
                },
              },
            }),
          };
        }
        return { ok: false, status: 404, text: async () => '' };
      },
    });

    const beforeSyncCatalog = mgr.getRuntimeCatalog(['gemini-4-neon', 'gemini-pro-orchestrator-neon']);
    assert.equal(beforeSyncCatalog.filter((m) => m.id === 'gemini-4-neon').length, 1);
    assert.equal(beforeSyncCatalog.some((m) => m.id === 'gemini-pro-orchestrator-neon'), false);
    assert.equal(beforeSyncCatalog.some((m) => m.hint === '本地观测模型'), false);

    await mgr.syncNow(['gemini-4-neon', 'gemini-pro-orchestrator-neon']);
    const afterSyncCatalog = mgr.getRuntimeCatalog(['gemini-4-neon', 'gemini-pro-orchestrator-neon']);
    assert.equal(afterSyncCatalog.filter((m) => m.id === 'gemini-4-neon').length, 1);
    assert.equal(afterSyncCatalog.some((m) => m.id === 'gemini-pro-orchestrator-neon'), false);
    assert.equal(afterSyncCatalog.some((m) => m.hint === '本地观测模型'), false);
    assert.equal(afterSyncCatalog.find((m) => m.id === 'gemini-4-neon')?.inputPer1M, 2.2);
    assert.equal(resolveModelProfile('gemini-pro-orchestrator-neon', afterSyncCatalog).id, 'gemini-4-neon');
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }

  // 4. Subscription auto-detection maps Neon slugs to 'pro' (not jio_pro, not ultra_5x)
  for (const neonModel of [
    'gemini-4-neon',
    'gemini-pro-orchestrator-neon',
    'Orchestrator (Neon)',
    'Gemini 4 Neon (High)',
  ]) {
    const detected = detectSubscriptionPlanFromModels([neonModel]);
    assert.equal(detected, 'pro', `Expected ${neonModel} subscription -> pro, got ${detected}`);
    assert.notEqual(detected, 'jio_pro');
    assert.notEqual(detected, 'ultra_5x');
  }
  assert.equal(detectSubscriptionPlanFromModels(['gemini-pro-orchestrator']), 'ultra_5x');
  assert.equal(detectSubscriptionPlanFromModels(['gemini-flash-worker-agy']), 'jio_pro');

  // 5. receipt.js formats gemini-pro-orchestrator-neon and Orchestrator (Neon) as 'Gemini 4 Neon'
  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');

  const uiSandbox = {
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Promise,
    Map,
    Set,
    RegExp,
    performance,
  };
  uiSandbox.window = uiSandbox;
  uiSandbox.globalThis = uiSandbox;
  vm.runInNewContext(receiptSource, uiSandbox);
  vm.runInNewContext(pixelOfficeSource, uiSandbox);

  const receiptApi = uiSandbox.TokenMonitorReceipt;
  const pixelApi = uiSandbox.TokenMonitorPixelOffice;
  assert.ok(receiptApi, 'receipt.js must expose TokenMonitorReceipt');
  assert.ok(pixelApi, 'pixel_office.js must expose TokenMonitorPixelOffice');

  for (const modelCase of [
    { model: 'gemini-pro-orchestrator-neon', profileId: '', profileLabel: '' },
    { model: 'Orchestrator (Neon)', profileId: '', profileLabel: '' },
    { model: 'gemini-4-neon', profileId: 'gemini-4-neon', profileLabel: 'Gemini 4 Neon (High)' },
  ]) {
    const vmReceipt = receiptApi.buildReceiptViewModel(
      {
        conversationId: '04000000-0000-4000-8000-000000000001',
        title: 'Neon Receipt Test',
        activeModel: modelCase.model,
        receipt: {
          todayDate: '2026-11-19',
          today: {
            scope: 'today',
            hasData: true,
            startDate: '2026-11-19',
            endDate: '2026-11-19',
            startedAtMs: Date.parse('2026-11-19T01:00:00Z'),
            endedAtMs: Date.parse('2026-11-19T02:00:00Z'),
            activeDurationMs: 600_000,
            compactionsCount: 0,
            primaryModel: modelCase,
            subagentsCount: 0,
            main: { totalTokens: 1000, costActual: 0.01, stepsCount: 1 },
            children: [],
            childrenSubtotal: { totalTokens: 0, costActual: 0 },
            grandTotal: { totalTokens: 1000, costActual: 0.01, stepsCount: 1 },
          },
        },
      },
      { currency: 'USD' },
      { lang: 'en', scope: 'today', detailMode: 'compact' },
    );
    assert.equal(
      vmReceipt.metaRows.find((r) => r.key === 'primaryModel')?.value,
      'Gemini 4 Neon',
      `receipt.js must format ${modelCase.model} as Gemini 4 Neon`,
    );
  }

  // Carbon and Argon remain distinct in receipt.js
  const carbonVm = receiptApi.buildReceiptViewModel(
    {
      conversationId: '04000000-0000-4000-8000-000000000002',
      activeModel: 'gemini-pro-orchestrator',
      receipt: {
        todayDate: '2026-11-19',
        today: {
          scope: 'today',
          hasData: true,
          primaryModel: { model: 'gemini-pro-orchestrator', profileId: '', profileLabel: '' },
          main: { totalTokens: 100, costActual: 0.001, stepsCount: 1 },
          children: [],
          childrenSubtotal: { totalTokens: 0, costActual: 0 },
          grandTotal: { totalTokens: 100, costActual: 0.001, stepsCount: 1 },
        },
      },
    },
    { currency: 'USD' },
    { lang: 'en', scope: 'today', detailMode: 'compact' },
  );
  assert.equal(carbonVm.metaRows.find((r) => r.key === 'primaryModel')?.value, 'Gemini 4 Carbon');

  // 6. pixel_office.js resolveCatArchetype maps Neon slugs to 'gemini-4-neon'
  assert.equal(pixelApi.resolveCatArchetype('gemini-pro-orchestrator-neon').id, 'gemini-4-neon');
  assert.equal(pixelApi.resolveCatArchetype('Orchestrator (Neon)').id, 'gemini-4-neon');
  assert.equal(pixelApi.resolveCatArchetype('Gemini 4 Neon (High)').id, 'gemini-4-neon');
  assert.equal(pixelApi.resolveCatArchetype('gemini-4-neon').id, 'gemini-4-neon');
  assert.equal(pixelApi.resolveCatArchetype('gemini-pro-orchestrator').id, 'gemini-4-carbon');
  assert.equal(pixelApi.resolveCatArchetype('gemini-pro-orchestrator-argon').id, 'gemini-4-argon');
});

test('v0.4.0 pixel_office.js engine: 10 archetypes, 160-sprite cache (32x32/24x24), 1+8 workstation cap, activeToolLabel, hitTest, and portrait', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const pixelOfficeSource = readFileSync(
    join(testDir, '..', 'sidecars', 'monitor_pane', 'pixel_office.js'),
    'utf-8',
  );

  function createMockCanvas(w = 0, h = 0) {
    const drawnTexts = [];
    const fillRectCalls = [];
    const drawImageCalls = [];
    const ctx = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'left',
      textBaseline: 'alphabetic',
      imageSmoothingEnabled: true,
      setTransform() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
      measureText(str) {
        return { width: String(str || '').length * 6.5 };
      },
      fillRect(x, y, rw, rh) {
        fillRectCalls.push({ x, y, rw, rh, fillStyle: this.fillStyle });
      },
      strokeRect() {},
      fillText(str) {
        drawnTexts.push(String(str));
      },
      drawImage(img, dx, dy, dw, dh) {
        drawImageCalls.push({ img, dx, dy, dw, dh });
      },
    };
    return {
      width: w,
      height: h,
      clientWidth: w,
      _drawnTexts: drawnTexts,
      _fillRectCalls: fillRectCalls,
      _drawImageCalls: drawImageCalls,
      getContext(kind) {
        return kind === '2d' ? ctx : null;
      },
    };
  }

  let cssBgValue = '#f6f7f9';
  let dataThemeAttr = '';
  let mediaDark = false;
  const mockDocument = {
    documentElement: {
      getAttribute(name) {
        return name === 'data-theme' ? dataThemeAttr : null;
      },
    },
    createElement(tag) {
      return tag === 'canvas' ? createMockCanvas(0, 0) : {};
    },
  };
  const sandbox = {
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    performance,
    module: { exports: {} },
    document: mockDocument,
    getComputedStyle: () => ({
      getPropertyValue(prop) {
        return prop === '--tm-bg' ? cssBgValue : '';
      },
    }),
    matchMedia: () => ({ matches: mediaDark }),
  };
  mockDocument.defaultView = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(pixelOfficeSource, sandbox);
  const api = sandbox.TokenMonitorPixelOffice;
  assert.ok(api, 'pixel_office.js must attach TokenMonitorPixelOffice');
  assert.equal(sandbox.module.exports, api, 'pixel_office.js must also populate module.exports');
  assert.equal(api.MAX_SUBAGENTS, 8);
  assert.equal(api.MODEL_ARCHETYPES.length, 10);
  assert.equal(Object.isFrozen(api.MODEL_ARCHETYPES), true);

  // 1. resolveCatArchetype across all 9 active models + aliases + Auto/empty
  const archetypeCases = [
    ['gemini-pro-orchestrator', 'gemini-4-carbon'],
    ['Orchestrator (Carbon)', 'gemini-4-carbon'],
    ['gemini-4-carbon', 'gemini-4-carbon'],
    ['gemini-pro-orchestrator-argon', 'gemini-4-argon'],
    ['Orchestrator (Argon)', 'gemini-4-argon'],
    ['gemini-4-argon', 'gemini-4-argon'],
    ['gemini-pro-orchestrator-neon', 'gemini-4-neon'],
    ['Orchestrator (Neon)', 'gemini-4-neon'],
    ['Gemini 4 Neon (High)', 'gemini-4-neon'],
    ['gemini-4-hydrogen', 'gemini-4-hydrogen'],
    ['gemini-pro-default', 'gemini-3.1-pro'],
    ['gemini-3.1-pro', 'gemini-3.1-pro'],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update pixel_office resolveCatArchetype expectation for gemini-flash-worker-agy to gemini-4-hydrogen.
// ============================================================================
    ['gemini-flash-worker-agy', 'gemini-4-hydrogen'],
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
    ['gemini-3-8-flash', 'gemini-3.8-flash'],
    ['claude-opus-4-6', 'claude-opus-5-5'],
    ['claude-opus-5-5', 'claude-opus-5-5'],
    ['claude-haiku', 'claude-sonnet-5-5'],
    ['claude-sonnet-5-5', 'claude-sonnet-5-5'],
    ['gpt-5', 'gpt-oss-120b'],
    ['o3', 'gpt-oss-120b'],
    ['gpt-oss-120b', 'gpt-oss-120b'],
    ['Auto', 'auto'],
    ['Auto (默认)', 'auto'],
    ['', 'auto'],
    [null, 'auto'],
  ];
  for (const [input, expectedId] of archetypeCases) {
    assert.equal(
      api.resolveCatArchetype(input).id,
      expectedId,
      `resolveCatArchetype(${String(input)}) expected ${expectedId}`,
    );
  }

  // 2. ensureSpriteCache creates 160 sprites (10 * 2 * 4 * 2) with 32x32 Main and 24x24 Sub dimensions
  const createdCanvases = [];
  const spriteFactory = (w, h) => {
    const c = createMockCanvas(w, h);
    createdCanvases.push(c);
    return c;
  };
  const spritePack1 = api.ensureSpriteCache(spriteFactory);
  assert.equal(spritePack1.size, 160);
  assert.equal(spritePack1.cache.size, 160);
  assert.equal(spritePack1.mainSize, 32);
  assert.equal(spritePack1.subSize, 24);
  assert.equal(createdCanvases.length, 160);

  let mainCount = 0;
  let subCount = 0;
  for (const [key, spriteCanvas] of spritePack1.cache.entries()) {
    assert.ok(spriteCanvas._fillRectCalls.length > 0, `Sprite ${key} must have pixel draws`);
    if (key.startsWith('main:')) {
      mainCount += 1;
      assert.equal(spriteCanvas.width, 32);
      assert.equal(spriteCanvas.height, 32);
    } else if (key.startsWith('sub:')) {
      subCount += 1;
      assert.equal(spriteCanvas.width, 24);
      assert.equal(spriteCanvas.height, 24);
    }
  }
  assert.equal(mainCount, 80);
  assert.equal(subCount, 80);

  // Subsequent call with same factory hits cache without re-baking
  const spritePack2 = api.ensureSpriteCache(spriteFactory);
  assert.equal(spritePack2.cache, spritePack1.cache);
  assert.equal(createdCanvases.length, 160);

  // 3. detectDarkTheme precedence (--tm-bg -> data-theme -> matchMedia)
  cssBgValue = '#0f172a';
  assert.equal(api.detectDarkTheme(mockDocument), true);
  cssBgValue = '#f6f7f9';
  assert.equal(api.detectDarkTheme(mockDocument), false);
  cssBgValue = '';
  dataThemeAttr = 'dark';
  assert.equal(api.detectDarkTheme(mockDocument), true);
  dataThemeAttr = '';
  mediaDark = true;
  assert.equal(api.detectDarkTheme(mockDocument), true);

  // 4. buildOfficeModel & renderOfficeCanvas enforce MAX_SUBAGENTS === 8, prioritize active, activeToolLabel, hitTest
  const baseMs = Date.parse('2026-11-19T03:00:00Z');
  const twelveRawChildren = [
    ...Array.from({ length: 8 }, (_, idx) => ({
      conversationId: `04010000-0000-4000-8000-00000000000${idx + 1}`,
      kind: 'swarm',
      name: `idle-${idx + 1}`,
      role: 'worker',
      model: 'gemini-3.8-flash',
      status: 'IDLE',
      killed: idx === 0,
      activeToolLabel: idx === 0 ? 'should_be_cleared_when_killed' : '',
      updatedAtMs: baseMs + 90_000 + idx * 1000,
      latestTokPerSec: null,
      contextTotal: 1000 + idx,
      outputTokens: 200,
      costActual: 0.01,
    })),
    {
      conversationId: '04010000-0000-4000-8000-000000000011',
      kind: 'swarm',
      name: 'active-gen',
      role: 'coder',
      model: 'gemini-pro-orchestrator-neon',
      status: 'GENERATING',
      killed: false,
      activeToolLabel: '',
      updatedAtMs: baseMs + 1000,
      latestTokPerSec: 95,
      contextTotal: 25_000,
      outputTokens: 1200,
      costActual: 0.12,
    },
    {
      conversationId: '04010000-0000-4000-8000-000000000012',
      kind: 'subagent',
      name: 'active-tool',
      role: 'verifier',
      model: 'claude-opus-4-6',
      status: 'RUNNING_TOOLS',
      killed: false,
      activeToolLabel: 'Read parser.mjs',
      updatedAtMs: baseMs + 2000,
      latestTokPerSec: 40,
      contextTotal: 18_000,
      outputTokens: 800,
      costActual: 0.18,
    },
    {
      conversationId: '04010000-0000-4000-8000-000000000013',
      kind: 'swarm',
      name: 'killed-tool-stale',
      role: 'worker',
      model: 'gpt-5',
      status: 'RUNNING_TOOLS',
      killed: true,
      activeToolLabel: 'stale_tool_should_clear',
      updatedAtMs: baseMs + 3000,
      latestTokPerSec: null,
      contextTotal: 5_000,
      outputTokens: 100,
      costActual: 0.01,
    },
    {
      conversationId: '04010000-0000-4000-8000-000000000014',
      kind: 'swarm',
      name: 'active-gen-2',
      role: 'tester',
      model: 'gemini-pro-orchestrator-argon',
      status: 'GENERATING',
      killed: false,
      activeToolLabel: '',
      updatedAtMs: baseMs + 4000,
      latestTokPerSec: 88,
      contextTotal: 12_000,
      outputTokens: 400,
      costActual: 0.05,
    },
  ];
  assert.equal(twelveRawChildren.length, 12);

  const sortedTwelve = sortChildrenByActivity(twelveRawChildren);
  const officeModel = api.buildOfficeModel(
    {
      conversationId: '04010000-0000-4000-8000-000000000000',
      title: 'Pixel Office Root',
      activeModel: 'gemini-pro-orchestrator-neon',
      status: 'GENERATING',
      speed: { latestStepTokPerSec: 112 },
      context: { currentTotal: 80_000 },
      totals: { mainOnly: { outputTokens: 3200, costActual: 0.45 } },
    },
    sortedTwelve,
    'zh',
  );

  assert.equal(officeModel.slots.length, 9);
  assert.equal(officeModel.overflowCount, 4);
  assert.equal(officeModel.totalChildren, 12);
  assert.equal(officeModel.hasActive, true);
  assert.equal(officeModel.slots[0].archetype.id, 'gemini-4-neon');

  const subNames = officeModel.slots.slice(1).map((s) => s.name);
  assert.equal(subNames.includes('active-gen'), true);
  assert.equal(subNames.includes('active-tool'), true);
  assert.equal(subNames.includes('active-gen-2'), true);

  const toolSlot = officeModel.slots.find((s) => s.name === 'active-tool');
  assert.equal(toolSlot.status, 'RUNNING_TOOLS');
  assert.equal(toolSlot.activeToolLabel, 'Read parser.mjs');
  assert.equal(toolSlot.archetype.id, 'claude-opus-5-5');

  // Verify killed child clears activeToolLabel and flips status to ENDED inside buildOfficeModel
  const killedDirectModel = api.buildOfficeModel(
    { conversationId: 'main-direct', activeModel: 'Auto', status: 'IDLE' },
    [twelveRawChildren[10]],
    'en',
  );
  assert.equal(killedDirectModel.slots[1].killed, true);
  assert.equal(killedDirectModel.slots[1].status, 'ENDED');
  assert.equal(killedDirectModel.slots[1].activeToolLabel, '');

  // Render & hitTest across narrow/wide widths (280, 380, 560)
  for (const width of [280, 380, 560]) {
    const canvas = createMockCanvas(width, 200);
    const renderRes = api.renderOfficeCanvas(canvas, officeModel, {
      cssWidth: width,
      dpr: 2,
      dark: width === 380,
      tick: 5,
      selectedKey: toolSlot.key,
    });
    assert.equal(renderRes.logicalWidth, width);
    assert.ok(renderRes.logicalHeight > 120);
    assert.equal(canvas.width, width * 2);
    assert.equal(canvas.height, renderRes.logicalHeight * 2);

    const slotBoxes = renderRes.hitBoxes.filter((b) => b.type === 'slot');
    const overflowBoxes = renderRes.hitBoxes.filter((b) => b.type === 'overflow');
    assert.equal(slotBoxes.length, 9, `Width ${width} must emit 9 slot hitBoxes (1 Main + 8 Sub)`);
    assert.equal(overflowBoxes.length, 1, `Width ${width} must emit 1 overflow hitBox`);

    // Assert every box stays within bounds and does not overlap any other box
    for (let i = 0; i < renderRes.hitBoxes.length; i += 1) {
      const a = renderRes.hitBoxes[i];
      assert.ok(a.w > 0 && a.h > 0);
      assert.ok(a.x >= 0 && a.y >= 0);
      assert.ok(a.x + a.w <= renderRes.logicalWidth);
      assert.ok(a.y + a.h <= renderRes.logicalHeight);
      for (let j = i + 1; j < renderRes.hitBoxes.length; j += 1) {
        const b = renderRes.hitBoxes[j];
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        assert.equal(
          overlapX > 0 && overlapY > 0,
          false,
          `HitBoxes ${a.key} and ${b.key} overlap at width=${width}`,
        );
      }

      const hit = api.hitTest(renderRes.hitBoxes, a.x + a.w / 2, a.y + a.h / 2);
      assert.ok(hit, `hitTest must hit ${a.key} at width=${width}`);
      assert.equal(hit.key, a.key);
      assert.equal(hit.type, a.type);
    }

    assert.equal(api.hitTest(renderRes.hitBoxes, -10, -10), null);
    assert.equal(canvas._drawnTexts.includes('+4'), true, `Width ${width} must draw +4 overflow pill`);
    assert.equal(
      canvas._drawnTexts.some((t) => t.includes('Read')),
      true,
      `Width ${width} must draw activeToolLabel bubble`,
    );
  }

  // Portrait rendering
  const portraitCanvas = createMockCanvas(96, 96);
  const portraitOk = api.renderInspectorPortrait(portraitCanvas, toolSlot, { tick: 1, dark: false });
  assert.equal(portraitOk, true);
  assert.ok(portraitCanvas._drawImageCalls.length === 1);
  assert.ok(portraitCanvas._fillRectCalls.length > 0);
});

test('v0.4.0 backend DEFAULT_PREFS.pixelOfficeCollapsed, child activeToolLabel, GET /pixel_office.js, and POST /api/prefs validation & persistence', async () => {
  assert.equal(DEFAULT_PREFS.pixelOfficeCollapsed, false);

  const { root, appData } = makeTempEnv();
  try {
    const baseMs = Date.parse('2026-11-19T03:30:00Z');
    const parentId = '04020000-0000-4000-8000-000000000000';
    const liveWorkerId = '04020000-0000-4000-8000-000000000001';
    const killedWorkerId = '04020000-0000-4000-8000-000000000002';
    const missingWorkerId = '04020000-0000-4000-8000-000000000003';

    writeConversation(appData, liveWorkerId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 1000).toISOString(),
          content: 'Run tests',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 2000).toISOString(),
          input_tokens: 1200,
          cache_read_tokens: 300,
          output_tokens: 90,
          tool_calls: [
            {
              name: 'run_command',
              args: { toolSummary: 'Execute Node Test Suite' },
            },
          ],
        },
      ],
      mtimeMs: baseMs + 2000,
    });

    writeConversation(appData, killedWorkerId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs + 3000).toISOString(),
          content: 'Edit file then killed',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 4000).toISOString(),
          input_tokens: 900,
          cache_read_tokens: 100,
          output_tokens: 60,
          tool_calls: [
            {
              name: 'edit_file',
              args: { Path: 'f:\\repo\\main.mjs' },
            },
          ],
        },
      ],
      mtimeMs: baseMs + 4000,
    });

    writeConversation(appData, parentId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs).toISOString(),
          content: 'Coordinate Neon test swarm',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 500).toISOString(),
          input_tokens: 2000,
          cache_read_tokens: 500,
          output_tokens: 150,
        },
      ],
      members: {
        title: 'v0.4.0 activeToolLabel check',
        members: {
          coordinator: { conversation_id: parentId, role: 'coordinator', model: 'gemini-pro-orchestrator-neon' },
          liveWorker: {
            conversation_id: liveWorkerId,
            role: 'tester',
            model: 'gemini-4-neon',
            killed: false,
            state: 'working',
          },
          killedWorker: {
            conversation_id: killedWorkerId,
            role: 'editor',
            model: 'claude-opus-5-5',
            killed: true,
            state: 'killed',
          },
          missingWorker: {
            conversation_id: missingWorkerId,
            role: 'ghost',
            model: 'gemini-3.8-flash',
            killed: false,
            state: 'waiting',
          },
        },
      },
      mtimeMs: baseMs + 500,
    });

    const analyzed = analyzeConversation(parentId, { appDataDirs: [appData], disableAgentApi: true });
    const liveChild = analyzed.children.find((c) => c.name === 'liveWorker');
    const killedChild = analyzed.children.find((c) => c.name === 'killedWorker');
    const missingChild = analyzed.children.find((c) => c.name === 'missingWorker');

    assert.equal(liveChild.status, 'RUNNING_TOOLS');
    assert.equal(liveChild.killed, false);
    assert.equal(liveChild.activeToolLabel, 'Execute Node Test Suite');
    assert.equal(killedChild.status, 'IDLE');
    assert.equal(killedChild.killed, true);
    assert.equal(killedChild.activeToolLabel, '');
    assert.equal(missingChild.activeToolLabel, '');

    // Standalone main.mjs HTTP checks for GET /pixel_office.js and POST /api/prefs pixelOfficeCollapsed
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });
    const fakeHome = join(root, 'home');
    mkdirSync(fakeHome, { recursive: true });

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const mainPath = join(__dirname, '..', 'sidecars', 'monitor_pane', 'main.mjs');
    const sdkCandidates = [
      process.env.SIDECAR_SDK_PATH,
      join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
      join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    ].filter((p) => typeof p === 'string' && p.trim() && existsSync(p));

    const baseEnv = { ...process.env };
    delete baseEnv.ANTIGRAVITY_LS_ADDRESS;
    delete baseEnv.ANTIGRAVITY_CSRF_TOKEN;
    delete baseEnv.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete baseEnv.ANTIGRAVITY_CONVERSATION_ID;
    delete baseEnv.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    delete baseEnv.ANTIGRAVITY_AGENTAPI_EXE;
    if (sdkCandidates[0]) baseEnv.SIDECAR_SDK_PATH = sdkCandidates[0];
    baseEnv.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    baseEnv.USERPROFILE = fakeHome;
    baseEnv.HOME = fakeHome;
    baseEnv.PRICING_SYNC_DISABLE_AUTO = '1';
    baseEnv.RELEASE_UPDATE_DISABLE_AUTO = '1';
    baseEnv.DISABLE_SYSTEM_PROXY_LOOKUP = '1';

    async function bootSidecar(port) {
      const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
        env: baseEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await new Promise((resolveReady, rejectReady) => {
        if (child.exitCode !== null) {
          rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
          return;
        }
        const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 10000);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
          if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
            clearTimeout(timer);
            resolveReady();
          }
        });
        child.stderr.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
        });
      });
      return child;
    }

    async function stopChild(child) {
      if (!child || child.exitCode !== null || child.signalCode !== null) return;
      child.kill();
      await new Promise((r) => {
        if (child.exitCode !== null || child.signalCode !== null) return r();
        const t = setTimeout(r, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }

    let child1 = null;
    let child2 = null;
    try {
      const port1 = await pickFetchSafeFreePort();
      child1 = await bootSidecar(port1);
      const base1 = `http://127.0.0.1:${port1}`;

      const pixelJsRes = await fetch(`${base1}/pixel_office.js`);
      assert.equal(pixelJsRes.status, 200);
      assert.match(pixelJsRes.headers.get('content-type') || '', /javascript/i);
      const pixelJsBody = await pixelJsRes.text();
      assert.equal(pixelJsBody.includes('TokenMonitorPixelOffice'), true);
      assert.equal(pixelJsBody.includes('resolveCatArchetype'), true);

      const initialSnap = await (await fetch(`${base1}/api/snapshot?conv=${encodeURIComponent(parentId)}`)).json();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump v0.4.0 backend standalone /api/snapshot appVersion assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump v0.4.0 backend standalone /api/snapshot appVersion assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump v0.4.0 backend standalone /api/snapshot appVersion assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump v0.4.0 backend standalone /api/snapshot appVersion assertion from 0.5.1 to 0.5.2.
// ============================================================================
      assert.equal(initialSnap.appVersion, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================
      assert.equal(initialSnap.prefs.pixelOfficeCollapsed, false);

      const badPrefRes = await fetch(`${base1}/api/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixelOfficeCollapsed: 'yes' }),
      });
      assert.equal(badPrefRes.status, 400);
      const badPrefBody = await badPrefRes.json();
      assert.equal(badPrefBody.error, 'pixelOfficeCollapsed must be a boolean.');

      const okPrefRes = await fetch(`${base1}/api/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixelOfficeCollapsed: true }),
      });
      assert.equal(okPrefRes.status, 200);
      const okPrefBody = await okPrefRes.json();
      assert.equal(okPrefBody.ok, true);
      assert.equal(okPrefBody.prefs.pixelOfficeCollapsed, true);

      const snapAfterSave = await (await fetch(`${base1}/api/snapshot?conv=${encodeURIComponent(parentId)}`)).json();
      assert.equal(snapAfterSave.prefs.pixelOfficeCollapsed, true);

      await stopChild(child1);
      child1 = null;

      // Restart against same dataDir and verify pixelOfficeCollapsed persisted on reload
      const port2 = await pickFetchSafeFreePort();
      child2 = await bootSidecar(port2);
      const snapReloaded = await (
        await fetch(`http://127.0.0.1:${port2}/api/snapshot?conv=${encodeURIComponent(parentId)}`)
      ).json();
      assert.equal(snapReloaded.prefs.pixelOfficeCollapsed, true);
    } finally {
      await stopChild(child1);
      await stopChild(child2);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.4.0 net_proxy high-CPU system proxy anti-flap: 4000ms timeout, transient error preservation, forced rebuild, no negative TTL, and clean ProxyEnable=0x0 switch', () => {
  assert.equal(DEFAULT_OS_LOOKUP_TIMEOUT_MS, 4000);

  // 1. isTransientLookupError classification
  for (const err of [
    { code: 'ETIMEDOUT' },
    { code: 'etimedout' },
    { code: 'EAGAIN' },
    { code: 'ENOMEM' },
    { code: 'ENOBUFS' },
    { code: 'ENOENT' },
    { killed: true },
    { signal: 'SIGTERM' },
  ]) {
    assert.equal(isTransientLookupError(err), true);
  }
  for (const nonTransient of [{ status: 1 }, new Error('reg query failed'), null, undefined]) {
    assert.equal(isTransientLookupError(nonTransient), false);
  }

  // 2. timeout: 4000 passed to execFileSyncImpl on Windows and macOS
  const winTimeoutCalls = [];
  const winProbe = resolveProxyConfig({
    env: {},
    platform: 'win32',
    execFileSyncImpl: (cmd, args, opts) => {
      winTimeoutCalls.push({ cmd, key: args[1], timeout: opts?.timeout });
      if (args[1].endsWith('Internet Settings')) {
        return '    ProxyEnable    REG_DWORD    0x0\n';
      }
      return '';
    },
  });
  assert.deepEqual(Object.keys(winProbe).sort(), ['enabled', 'httpProxy', 'httpsProxy', 'noProxy', 'source']);
  assert.equal(Object.hasOwn(winProbe, 'lookupFailed'), false);
  assert.equal(winTimeoutCalls.length, 2);
  assert.equal(winTimeoutCalls[0].timeout, 4000);
  assert.equal(winTimeoutCalls[1].timeout, 4000);

  const macTimeoutCalls = [];
  const macProbe = resolveProxyConfig({
    env: {},
    platform: 'darwin',
    execFileSyncImpl: (cmd, args, opts) => {
      macTimeoutCalls.push({ cmd, args, timeout: opts?.timeout });
      return '<dictionary> {\n  HTTPEnable : 0\n  HTTPSEnable : 0\n}\n';
    },
  });
  assert.deepEqual(Object.keys(macProbe).sort(), ['enabled', 'httpProxy', 'httpsProxy', 'noProxy', 'source']);
  assert.equal(Object.hasOwn(macProbe, 'lookupFailed'), false);
  assert.equal(macTimeoutCalls.length, 1);
  assert.equal(macTimeoutCalls[0].cmd, '/usr/sbin/scutil');
  assert.equal(macTimeoutCalls[0].timeout, 4000);

  // 3. Active win-registry proxy followed by ETIMEDOUT: preserves active proxy, allows forced rebuild, no 5-min negative TTL
  let nowMs = 10_000_000;
  let winMode = 'active-7890';
  let winExecCalls = 0;
  const winEvents = [];
  const winMgr = createSystemProxyManager({
    env: {},
    platform: 'win32',
    cacheTtlMs: 300_000,
    maxDispatcherAgeMs: 15 * 60_000,
    nowFn: () => nowMs,
    execFileSyncImpl: (_cmd, args, opts) => {
      winExecCalls += 1;
      assert.equal(opts?.timeout, 4000);
      if (winMode === 'etimedout') {
        const err = new Error('reg.exe ETIMEDOUT');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      if (args[1].endsWith('Internet Settings')) {
        if (winMode === 'active-7890') {
          return '    ProxyEnable    REG_DWORD    0x1\n    ProxyServer    REG_SZ    127.0.0.1:7890\n';
        }
        if (winMode === 'active-7899') {
          return '    ProxyEnable    REG_DWORD    0x1\n    ProxyServer    REG_SZ    127.0.0.1:7899\n';
        }
        return '    ProxyEnable    REG_DWORD    0x0\n';
      }
      return '';
    },
    setGlobalProxyFn: (proxyEnv) => {
      const tag = proxyEnv.HTTPS_PROXY;
      winEvents.push(`set:${tag}`);
      return () => {
        winEvents.push(`restore:${tag}`);
      };
    },
  });

  const st1 = winMgr.refresh();
  assert.equal(st1.enabled, true);
  assert.equal(st1.source, 'win-registry');
  assert.equal(st1.proxyUrl, 'http://127.0.0.1:7890');
  assert.equal(st1.rebuildCount, 0);

  // Advance past TTL and hit ETIMEDOUT -> active proxy MUST be preserved (not downgraded to direct)
  nowMs += 305_000;
  winMode = 'etimedout';
  const stTimeout = winMgr.refresh();
  assert.equal(stTimeout.enabled, true);
  assert.equal(stTimeout.source, 'win-registry');
  assert.equal(stTimeout.proxyUrl, 'http://127.0.0.1:7890');
  assert.equal(stTimeout.rebuildCount, 0);
  assert.deepEqual(winEvents, ['set:http://127.0.0.1:7890']);

  // Forced rebuild while ETIMEDOUT still occurs -> preserves active proxy AND increments rebuildCount
  const stForcedRebuild = winMgr.refresh({ force: true, rebuild: true });
  assert.equal(stForcedRebuild.enabled, true);
  assert.equal(stForcedRebuild.source, 'win-registry');
  assert.equal(stForcedRebuild.proxyUrl, 'http://127.0.0.1:7890');
  assert.equal(stForcedRebuild.rebuildCount, 1);
  assert.deepEqual(winEvents, [
    'set:http://127.0.0.1:7890',
    'restore:http://127.0.0.1:7890',
    'set:http://127.0.0.1:7890',
  ]);

  // CPU recovers immediately -> next refresh() (0ms later!) re-probes immediately (no 5-min negative TTL)
  winMode = 'active-7899';
  const callsBeforeRecover = winExecCalls;
  const stRecovered = winMgr.refresh();
  assert.ok(winExecCalls > callsBeforeRecover, 'refresh() after ETIMEDOUT must re-probe immediately without negative TTL');
  assert.equal(stRecovered.enabled, true);
  assert.equal(stRecovered.source, 'win-registry');
  assert.equal(stRecovered.proxyUrl, 'http://127.0.0.1:7899');
  assert.equal(stRecovered.rebuildCount, 2);

  // Genuine ProxyEnable = 0x0 and empty HKCU\Environment -> clean switch back to direct
  nowMs += 305_000;
  winMode = 'disabled';
  const stDisabled = winMgr.refresh();
  assert.equal(stDisabled.enabled, false);
  assert.equal(stDisabled.source, 'direct');
  assert.equal(stDisabled.proxyUrl, '');
  winMgr.dispose();

  // 4. Active mac-scutil proxy followed by ETIMEDOUT -> preserves active proxy, forced rebuild, immediate recovery
  let macNow = 20_000_000;
  let macMode = 'active-8888';
  let macExecCalls = 0;
  const macMgr = createSystemProxyManager({
    env: {},
    platform: 'darwin',
    cacheTtlMs: 300_000,
    nowFn: () => macNow,
    execFileSyncImpl: (_cmd, _args, opts) => {
      macExecCalls += 1;
      assert.equal(opts?.timeout, 4000);
      if (macMode === 'etimedout') {
        const err = new Error('scutil ETIMEDOUT');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      const port = macMode === 'active-8899' ? 8899 : 8888;
      return `<dictionary> {\n  HTTPEnable : 1\n  HTTPProxy : 127.0.0.1\n  HTTPPort : ${port}\n  HTTPSEnable : 1\n  HTTPSProxy : 127.0.0.1\n  HTTPSPort : ${port}\n}\n`;
    },
    setGlobalProxyFn: () => () => {},
  });
  const macInit = macMgr.refresh();
  assert.equal(macInit.enabled, true);
  assert.equal(macInit.source, 'mac-scutil');
  assert.equal(macInit.proxyUrl, 'http://127.0.0.1:8888');

  macNow += 305_000;
  macMode = 'etimedout';
  const macHold = macMgr.refresh();
  assert.equal(macHold.enabled, true);
  assert.equal(macHold.source, 'mac-scutil');
  assert.equal(macHold.proxyUrl, 'http://127.0.0.1:8888');
  const macForceHold = macMgr.refresh({ force: true, rebuild: true });
  assert.equal(macForceHold.enabled, true);
  assert.equal(macForceHold.rebuildCount, 1);

  macMode = 'active-8899';
  const macCallsBefore = macExecCalls;
  const macRec = macMgr.refresh();
  assert.ok(macExecCalls > macCallsBefore);
  assert.equal(macRec.proxyUrl, 'http://127.0.0.1:8899');
  assert.equal(macRec.rebuildCount, 2);
  macMgr.dispose();

  // 5. Cold-boot ETIMEDOUT -> direct is NOT locked into 5-min cache; immediate retry after recovery switches to system proxy
  let coldBootMode = 'etimedout';
  let coldCalls = 0;
  const coldNow = 30_000_000;
  const coldMgr = createSystemProxyManager({
    env: {},
    platform: 'win32',
    cacheTtlMs: 300_000,
    nowFn: () => coldNow,
    execFileSyncImpl: (_cmd, args) => {
      coldCalls += 1;
      if (coldBootMode === 'etimedout') {
        const err = new Error('reg.exe ETIMEDOUT');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      if (args[1].endsWith('Internet Settings')) {
        return '    ProxyEnable    REG_DWORD    0x1\n    ProxyServer    REG_SZ    127.0.0.1:7890\n';
      }
      return '';
    },
    setGlobalProxyFn: () => () => {},
  });

  const cold1 = coldMgr.refresh();
  assert.equal(cold1.enabled, false);
  assert.equal(cold1.source, 'direct');

  // Recover CPU with 0ms clock advance -> immediate retry must re-probe and enable proxy
  coldBootMode = 'active';
  const coldCallsBefore = coldCalls;
  const cold2 = coldMgr.refresh();
  assert.ok(coldCalls > coldCallsBefore);
  assert.equal(cold2.enabled, true);
  assert.equal(cold2.source, 'win-registry');
  assert.equal(cold2.proxyUrl, 'http://127.0.0.1:7890');
  coldMgr.dispose();
});

test('v0.4.0 update modal nested markdown & section filtering, Pixel Office VM integration, I18N parity, and static hygiene', async () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const netProxySource = readFileSync(join(paneDir, 'net_proxy.mjs'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const releaseUpdaterSource = readFileSync(join(paneDir, 'release_updater.mjs'), 'utf-8');
  const clipboardImageSource = readFileSync(join(paneDir, 'clipboard_image.mjs'), 'utf-8');
  const syncPluginPs1 = readFileSync(join(repoRoot, 'scripts', 'sync-plugin.ps1'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const pluginJsonRaw = readFileSync(join(repoRoot, 'plugin.json'), 'utf-8');
  const packageJsonRaw = readFileSync(join(paneDir, 'package.json'), 'utf-8');
  const sidecarJsonRaw = readFileSync(join(paneDir, 'sidecar.json'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  // 1. index.html Pixel Office & plain-language update button contracts
  const convStripIdx = indexHtml.indexOf('id="conv-strip"');
  const pixelCardIdx = indexHtml.indexOf('id="card-pixel-office"');
  const heroGridIdx = indexHtml.indexOf('class="hero-grid"');
  assert.ok(convStripIdx > 0 && pixelCardIdx > convStripIdx && heroGridIdx > pixelCardIdx);
  const receiptScriptIdx = indexHtml.indexOf('<script src="/receipt.js"></script>');
  const pixelScriptIdx = indexHtml.indexOf('<script src="/pixel_office.js"></script>');
  const appScriptIdx = indexHtml.indexOf('<script src="/app.js"></script>');
  assert.ok(receiptScriptIdx > 0 && pixelScriptIdx > receiptScriptIdx && appScriptIdx > pixelScriptIdx);
  assert.match(indexHtml, /id="btn-update-confirm"[^>]*>立即更新</);

  // 2. I18N.zh / I18N.en 100% key and {placeholder} parity + v0.4.0 plain-language update & pixelOffice keys
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0);
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks must be extractable from I18N');

  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());

  const extractPlaceholders = (str) =>
    [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `Placeholder mismatch for I18N key "${key}"`,
    );
  }

  assert.equal(zhEntries.get('update.confirmBtn'), '立即更新');
  assert.equal(enEntries.get('update.confirmBtn'), 'Update Now');

  for (const key of [
    'update.confirmApplying',
    'update.downloading',
    'update.restarting',
    'update.applyFailed',
    'update.updatedToast',
    'update.errRateLimit',
    'pixelOffice.title',
    'pixelOffice.slotsMainOnly',
    'pixelOffice.slotsCount',
    'pixelOffice.overflowPill',
    'pixelOffice.overflowTitle',
    'pixelOffice.collapse',
    'pixelOffice.expand',
    'pixelOffice.clickHint',
    'pixelOffice.mainRole',
    'pixelOffice.kindMain',
    'pixelOffice.kindSwarm',
    'pixelOffice.kindSubagent',
    'pixelOffice.statusGenerating',
    'pixelOffice.statusTools',
    'pixelOffice.statusToolsLabel',
    'pixelOffice.statusIdle',
    'pixelOffice.statusEnded',
    'pixelOffice.closeInspector',
    'pixelOffice.backToMain',
    'pixelOffice.inspectBtn',
    'pixelOffice.openChatBtn',
    'pixelOffice.statCtx',
    'pixelOffice.statSpeed',
    'pixelOffice.statOut',
    'pixelOffice.statCost',
  ]) {
    assert.ok(zhEntries.has(key) && zhEntries.get(key).length > 0, `I18N.zh missing ${key}`);
    assert.ok(enEntries.has(key) && enEntries.get(key).length > 0, `I18N.en missing ${key}`);
  }

  // 3. Zero unsafe DOM APIs across app.js, receipt.js, and pixel_office.js
  const unsafeDomRe = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/;
  assert.equal(unsafeDomRe.test(appSource), false, 'app.js must contain 0 unsafe DOM APIs');
  assert.equal(unsafeDomRe.test(receiptSource), false, 'receipt.js must contain 0 unsafe DOM APIs');
  assert.equal(unsafeDomRe.test(pixelOfficeSource), false, 'pixel_office.js must contain 0 unsafe DOM APIs');

  // 4. Zero banned terms across frontend, backend, docs, and pixel_office.js
  const bannedTerm = '\u6c34\u4f4d';
  const legacyDocPhrase = 'Dedicated ' + 'Gemini 3.1 Pro';
  const legacyUiTerm = '\u5728\u5f79\u6a21\u578b';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['parser.mjs', parserSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['main.mjs', mainSource],
    ['net_proxy.mjs', netProxySource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['clipboard_image.mjs', clipboardImageSource],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['plugin.json', pluginJsonRaw],
    ['package.json', packageJsonRaw],
    ['sidecar.json', sidecarJsonRaw],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    assert.equal(src.includes(bannedTerm), false, `${label} must not contain banned term`);
    assert.equal(src.includes(legacyDocPhrase), false, `${label} must not contain legacy doc phrase`);
  }
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['I18N.zh', i18nMatch[1]],
    ['plugin.json', pluginJsonRaw],
    ['package.json', packageJsonRaw],
    ['sidecar.json', sidecarJsonRaw],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
  ]) {
    assert.equal(src.includes(legacyUiTerm), false, `${label} must not contain legacy UI term`);
  }

  // 5. Balanced [MODIFIED BEGIN/END] annotations across all modified files including pixel_office.js
  const modBeginMarker = '[' + 'MODIFIED BEGIN]';
  const modEndMarker = '[' + 'MODIFIED END]';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['parser.mjs', parserSource],
    ['main.mjs', mainSource],
    ['clipboard_image.mjs', clipboardImageSource],
    ['net_proxy.mjs', netProxySource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['scripts/sync-plugin.ps1', syncPluginPs1],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    let depth = 0;
    let minDepth = 0;
    let begins = 0;
    let ends = 0;
    for (const line of src.split(/\r?\n/)) {
      if (line.includes(modBeginMarker)) {
        depth += 1;
        begins += 1;
      }
      if (line.includes(modEndMarker)) {
        depth -= 1;
        ends += 1;
        if (depth < minDepth) minDepth = depth;
      }
    }
    assert.ok(begins > 0, `${label} must contain modification annotations`);
    assert.equal(begins, ends, `${label} begin/end annotation count mismatch`);
    assert.equal(depth, 0, `${label} unclosed modification annotation (depth=${depth})`);
    assert.equal(minDepth, 0, `${label} unmatched end annotation (minDepth=${minDepth})`);
  }

  // 6. VM DOM Sandbox for app.js: nested markdown rendering, release line filtering, and Pixel Office integration
  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0, 'app.js must end with IIFE closing })();');

  const instrumentedApp =
    appSource.slice(0, iifeCloseIdx) +
    `\n  globalThis.__tmV040Exports = {\n` +
    `    state,\n` +
    `    t,\n` +
    `    init,\n` +
    `    getCurrentAppVersion,\n` +
    `    matchProfileIdForModel,\n` +
    `    extractLocalizedReleaseLines,\n` +
    `    renderReleaseNotesDom,\n` +
    `    renderPixelOfficeCard,\n` +
    `    renderCurrentTab,\n` +
    `    setActiveTab,\n` +
    `    syncPixelOfficeLoop,\n` +
    `    stopPixelOfficeLoop,\n` +
    `  };\n` +
    appSource.slice(iifeCloseIdx);

  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }
  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }
  let fakeDocument = null;
  function matchesSimpleSelector(elNode, selector) {
    const s = selector.trim();
    if (!s) return false;
    if (s.startsWith('#')) return elNode.getAttribute('id') === s.slice(1);
    if (s.startsWith('.')) {
      return s.slice(1).split('.').filter(Boolean).every((cls) => elNode.classList.contains(cls));
    }
    const dotParts = s.split('.');
    const tagPart = dotParts[0].toUpperCase();
    if (tagPart && elNode.tagName !== tagPart) return false;
    return dotParts.slice(1).every((cls) => elNode.classList.contains(cls));
  }
  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.type = '';
      this.role = '';
      this.value = '';
      this.disabled = false;
      this.checked = false;
      this.scrollTop = 0;
      this.width = 0;
      this.height = 0;
      this.clientWidth = 380;
      this._ctx2d = null;
      this.style = {
        cssText: '',
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
        toggle: (tok, force) => {
          const key = String(tok || '');
          const shouldAdd = force === undefined ? !this._classSet.has(key) : Boolean(force);
          if (shouldAdd) this._classSet.add(key);
          else this._classSet.delete(key);
          return shouldAdd;
        },
      };
    }
    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }
    get children() {
      return this.childNodes.filter((n) => n instanceof FakeElement);
    }
    get childElementCount() {
      return this.children.length;
    }
    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') this.appendChild(new FakeTextNode(str));
    }
    setAttribute(name, val) {
      const k = String(name);
      const v = String(val);
      if (k === 'class') {
        this.className = v;
        return;
      }
      if (k === 'title') this.title = v;
      this.attributes.set(k, v);
    }
    getAttribute(name) {
      const k = String(name);
      if (k === 'class') return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(name) {
      return name === 'class' ? this._classSet.size > 0 : this.attributes.has(String(name));
    }
    removeAttribute(name) {
      if (name === 'class') this.className = '';
      else this.attributes.delete(String(name));
    }
    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx >= 0) child.parentNode.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.childNodes.indexOf(this);
        if (idx >= 0) this.parentNode.childNodes.splice(idx, 1);
        this.parentNode = null;
      }
    }
    replaceChildren(...nodes) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      for (const n of nodes) {
        if (n === null || n === undefined) continue;
        this.appendChild(typeof n === 'string' ? new FakeTextNode(n) : n);
      }
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    click(extraProps = {}) {
      const evt = {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...extraProps,
      };
      for (const fn of this.listeners.get('click') || []) fn(evt);
    }
    getBoundingClientRect() {
      const w = this.clientWidth || 380;
      const h =
        this.tagName === 'CANVAS' && this.width > 0 && this.height > 0
          ? Math.round(w * (this.height / this.width))
          : 200;
      return { left: 0, top: 0, width: w, height: h };
    }
    scrollIntoView() {}
    querySelectorAll(selector) {
      const out = [];
      const visit = (node) => {
        for (const ch of node.children) {
          if (matchesSimpleSelector(ch, selector)) out.push(ch);
          visit(ch);
        }
      };
      visit(this);
      return out;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    getContext(kind) {
      if (this.tagName !== 'CANVAS' || kind !== '2d') return null;
      if (!this._ctx2d) {
        this._ctx2d = {
          font: '',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          textAlign: 'left',
          textBaseline: 'alphabetic',
          imageSmoothingEnabled: true,
          setTransform() {},
          save() {},
          restore() {},
          scale() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          stroke() {},
          fillRect() {},
          strokeRect() {},
          setLineDash() {},
          createLinearGradient() {
            return { addColorStop() {} };
          },
          measureText(str) {
            return { width: String(str || '').length * 6.5 };
          },
          fillText() {},
          drawImage() {},
        };
      }
      return this._ctx2d;
    }
    toDataURL(mime = 'image/png') {
      return `data:${mime};base64,${Buffer.from('MOCK_PNG').toString('base64')}`;
    }
  }

  const elementsById = new Map();
  const docListeners = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);
  fakeDocument = {
    readyState: 'loading',
    hidden: false,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const k = String(id);
      if (!elementsById.has(k)) {
        const node = new FakeElement(k.includes('card') ? 'article' : 'div');
        node.setAttribute('id', k);
        rootBody.appendChild(node);
        elementsById.set(k, node);
      }
      return elementsById.get(k);
    },
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
  };

  const postedPrefs = [];
  const activeTimers = new Map();
  let nextTimerId = 1;
  let vmMockSnap = { unchanged: true };

  const sandbox = {
    Node: FakeNode,
    document: fakeDocument,
    innerWidth: 400,
    devicePixelRatio: 2,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    sidecar: { conversationId: 'conv-vm-v040' },
    location: { reload: () => {} },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({
      color: 'rgb(246, 247, 249)',
      getPropertyValue: (p) => (p === '--tm-bg' ? '#f6f7f9' : ''),
    }),
    AbortController,
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    JSON,
    Promise,
    performance,
    URLSearchParams,
    Intl,
    fetch: async (url, init) => {
      if (String(url).includes('/api/prefs') && init?.body) {
        postedPrefs.push(JSON.parse(init.body));
      }
      if (String(url).includes('/api/snapshot')) {
        return { ok: true, status: 200, json: async () => vmMockSnap };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: (fn, ms) => {
      const id = nextTimerId++;
      activeTimers.set(id, { fn, ms });
      return id;
    },
    clearInterval: (id) => {
      activeTimers.delete(id);
    },
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  fakeDocument.defaultView = sandbox;

  vm.runInNewContext(receiptSource, sandbox);
  vm.runInNewContext(pixelOfficeSource, sandbox);
  vm.runInNewContext(instrumentedApp, sandbox);

  const exports = sandbox.__tmV040Exports;
  assert.ok(exports, 'VM execution must expose __tmV040Exports');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:31:27
// Description: Bump v0.4.0 VM getCurrentAppVersion fallback assertion to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump v0.4.0 VM getCurrentAppVersion fallback assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump v0.4.0 VM getCurrentAppVersion fallback assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump v0.4.0 VM getCurrentAppVersion fallback assertion from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(exports.getCurrentAppVersion(), '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-19 20:31:27
// ============================================================================

  // Test matchProfileIdForModel for Neon
  assert.equal(exports.matchProfileIdForModel('Orchestrator (Neon)'), 'gemini-4-neon');
  assert.equal(exports.matchProfileIdForModel('gemini-pro-orchestrator-neon'), 'gemini-4-neon');
  assert.equal(exports.matchProfileIdForModel('Gemini 4 Neon (High)'), 'gemini-4-neon');
  assert.equal(exports.matchProfileIdForModel('Orchestrator (Carbon)'), 'gemini-4-carbon');
  assert.equal(exports.matchProfileIdForModel('Orchestrator (Argon)'), 'gemini-4-argon');

  // Test renderReleaseNotesDom nested code inside **bold** with zero raw backticks
  const notesBox = fakeDocument.createElement('div');
  exports.renderReleaseNotesDom(
    notesBox,
    '## 中文\n\n- **固定长度 `/api/snapshot` ETag（修复 `HTTP 431` 报错）**',
    'zh',
  );
  const strongNode = notesBox.querySelector('strong');
  assert.ok(strongNode, 'renderReleaseNotesDom must produce <strong> element');
  const nestedCodeNodes = strongNode.querySelectorAll('code.update-notes-code');
  assert.equal(nestedCodeNodes.length, 2, '<strong> must contain two <code class="update-notes-code"> nodes');
  assert.equal(nestedCodeNodes[0].textContent, '/api/snapshot');
  assert.equal(nestedCodeNodes[1].textContent, 'HTTP 431');
  assert.equal(notesBox.textContent.includes('`'), false, 'Rendered DOM textContent must contain ZERO raw backticks');

  // Also test paragraph form without bullet
  const notesParaBox = fakeDocument.createElement('div');
  exports.renderReleaseNotesDom(
    notesParaBox,
    '**固定长度 `/api/snapshot` ETag（修复 `HTTP 431` 报错）**',
    'zh',
  );
  assert.equal(notesParaBox.querySelector('strong')?.querySelectorAll('code.update-notes-code').length, 2);
  assert.equal(notesParaBox.textContent.includes('`'), false);

  // Test extractLocalizedReleaseLines strips checksum / technical / verification sections & SHA-256 lines
  const dummyHashA = 'a'.repeat(64);
  const dummyHashB = 'b'.repeat(64);
  const bilingualNotes = [
    '## 中文',
    '',
    '### 新增功能',
    '- **像素工位猫猫**：实时展示主代理与子代理工作状态。',
    '',
    '### 发布包校验',
    `- Archive SHA-256: \`${dummyHashA}\``,
    dummyHashB,
    '',
    '### 技术细节',
    '- 内部实现细节不应显示给终端用户。',
    '',
    '### 验证情况',
    '- 测试计数 details',
    '',
    '## English',
    '',
    '### New Features',
    '- **Pixel Office Cats**: Live workstation monitor.',
    '',
    '### Package Checksum',
    `- SHA-256: \`${dummyHashA}\``,
    dummyHashB,
    '',
    '### Technical Details',
    '- Internal implementation detail should be stripped.',
    '',
    '### Verification',
    '- Internal test verification line.',
  ].join('\n');

  const zhLinesJoined = exports.extractLocalizedReleaseLines(bilingualNotes, 'zh').join('\n');
  assert.equal(zhLinesJoined.includes('像素工位猫猫'), true);
  assert.equal(zhLinesJoined.includes('发布包校验'), false);
  assert.equal(zhLinesJoined.includes('技术细节'), false);
  assert.equal(zhLinesJoined.includes('验证情况'), false);
  assert.equal(zhLinesJoined.includes(dummyHashA), false);
  assert.equal(zhLinesJoined.includes(dummyHashB), false);

  const enLinesJoined = exports.extractLocalizedReleaseLines(bilingualNotes, 'en').join('\n');
  assert.equal(enLinesJoined.includes('Pixel Office Cats'), true);
  assert.equal(enLinesJoined.includes('Package Checksum'), false);
  assert.equal(enLinesJoined.includes('Technical Details'), false);
  assert.equal(enLinesJoined.includes('Verification'), false);
  assert.equal(enLinesJoined.includes(dummyHashA), false);
  assert.equal(enLinesJoined.includes(dummyHashB), false);

  // Pixel Office UI VM Integration: render 10 children -> 9 slots + overflow badge, inspector, collapse toggle, idle loop
  const children10 = Array.from({ length: 10 }, (_, idx) => ({
    conversationId: `04030000-0000-4000-8000-00000000000${idx}`,
    kind: 'swarm',
    name: `cat-${idx}`,
    role: 'worker',
    model: idx === 0 ? 'gemini-pro-orchestrator-neon' : 'gemini-3.8-flash',
    status: idx === 0 ? 'RUNNING_TOOLS' : 'IDLE',
    killed: false,
    activeToolLabel: idx === 0 ? 'Read main.mjs' : '',
    updatedAtMs: Date.now() - idx * 1000,
    latestTokPerSec: idx === 0 ? 77 : null,
    contextTotal: 5000,
    outputTokens: 200,
    costActual: 0.02,
  }));

  const sampleSnap = {
    appVersion: '0.4.0',
    prefs: { ...DEFAULT_PREFS, pixelOfficeCollapsed: false },
    pricingCatalog: MODEL_PRICING_CATALOG,
    current: {
      conversationId: 'conv-vm-v040',
      title: 'VM Pixel Office Session',
      activeModel: 'gemini-pro-orchestrator-neon',
      status: 'GENERATING',
      speed: { latestStepTokPerSec: 92, weightedAvgTokPerSec: 85, maxStepTokPerSec: 110, steps: [] },
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:40:17
// Description: Update v0.4.0 VM sampleSnap context limits to 409600/512000.
// ============================================================================
      context: { currentTotal: 50_000, usageLevel: 'HEALTHY', softLimit: 409_600, hardLimit: 512_000 },
// ============================================================================
// [MODIFIED END] 2026-11-19 13:40:17
// ============================================================================
      cache: { hitRatePct: 80, cacheReadTokens: 40_000, inputUncachedTokens: 10_000, spikes: [] },
      totals: {
        mainOnly: { totalTokens: 52_000, outputTokens: 2000, costActual: 0.25, stepsCount: 3 },
        withChildren: { totalTokens: 100_000, outputTokens: 4000, costActual: 0.45, stepsCount: 13 },
      },
      children: children10,
      byModel: [],
    },
  };

  exports.init();
  await new Promise((r) => setImmediate(r));
  exports.state.snapshot = sampleSnap;
  exports.state.lang = 'zh';
  exports.state.activeTab = 'current';
  exports.state.pixelOfficeCollapsed = false;
  exports.renderCurrentTab(sampleSnap);

  const pixelCard = fakeDocument.getElementById('card-pixel-office');
  assert.equal(pixelCard.classList.contains('hidden'), false);
  assert.equal(pixelCard.classList.contains('is-collapsed'), false);
  assert.equal(pixelCard.querySelector('.pixel-office-count')?.textContent, '1 主 + 8 子');
  assert.equal(pixelCard.querySelector('.pixel-office-overflow-badge')?.textContent, '+2');
  assert.equal(exports.state.pixelOfficeHitBoxes.length, 10);
  assert.equal(exports.state.pixelOfficeIntervalMs, 110);

  // Click sub slot hitBox on canvas -> opens .pixel-inspector with 96x96 portrait canvas
  const subBox = exports.state.pixelOfficeHitBoxes.find((b) => b.type === 'slot' && b.key === children10[0].conversationId);
  assert.ok(subBox, 'First subagent slot hitBox must exist');
  exports.state.pixelOfficeCanvas.click({
    clientX: subBox.x + subBox.w / 2,
    clientY: subBox.y + subBox.h / 2,
  });
  const inspector = pixelCard.querySelector('.pixel-inspector');
  assert.ok(inspector, 'Clicking a cat slot must open .pixel-inspector');
  const portrait = inspector.querySelector('.pixel-inspector-portrait');
  assert.equal(portrait?.width, 96);
  assert.equal(portrait?.height, 96);
  assert.equal(inspector.textContent.includes('Gemini 4 Neon'), true);

  // Click collapse toggle -> collapses card, stops loop (0ms/cleared), posts pixelOfficeCollapsed: true
  const toggleBtn = pixelCard.querySelector('#btn-pixel-office-toggle');
  assert.ok(toggleBtn);
  toggleBtn.click();
  assert.equal(exports.state.pixelOfficeCollapsed, true);
  assert.equal(pixelCard.classList.contains('is-collapsed'), true);
  assert.equal(exports.state.pixelOfficeIntervalMs, 0);
  assert.equal(exports.state.pixelOfficeTimer, null);
  assert.deepEqual(postedPrefs[postedPrefs.length - 1], { pixelOfficeCollapsed: true });

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:45:47
// Description: A6 — Update Pixel Office idle cadence assertion from 500ms to 3000ms (3s frame step).
// ============================================================================
  // Uncollapse with idle slots -> runs at 3000ms (3s idle cadence), then tab switch & visibilitychange stop loop cleanly
  sampleSnap.current.status = 'IDLE';
  sampleSnap.current.children = [];
  exports.state.pixelOfficeCollapsed = false;
  exports.state.pixelOfficeSelectedKey = '';
  exports.renderCurrentTab(sampleSnap);
  assert.equal(exports.state.pixelOfficeIntervalMs, 3000);

  exports.setActiveTab('global');
  assert.equal(exports.state.pixelOfficeIntervalMs, 0);
  assert.equal(exports.state.pixelOfficeTimer, null);

  exports.setActiveTab('current');
  assert.equal(exports.state.pixelOfficeIntervalMs, 3000);
// ============================================================================
// [MODIFIED END] 2026-11-20 15:45:47
// ============================================================================

  fakeDocument.hidden = true;
  for (const fn of docListeners.get('visibilitychange') || []) fn();
  assert.equal(exports.state.pixelOfficeIntervalMs, 0);
  assert.equal(exports.state.pixelOfficeTimer, null);
});
// ============================================================================
// [MODIFIED END] 2026-11-19 12:09:01
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:43:05
// Description: Add Round-2 v0.4.0 regression tests covering (1) worker attribution,
// display-first normalization & Neon enum seeds, (2) Scheme A canonical byModel
// merging + ledger v5 rebuild + unknown model isolation, (3) round-scoped Pixel
// Office filtering, (4) Pixel Inspector cleanup & header #model-pill VM checks,
// and (5) 409600/512000 context limits + PREFS_SCHEMA_VERSION = 4 migration + hygiene.
// ============================================================================
test('v0.4.0-r2 Test 1: worker attribution, display-first normalization, Neon enum seeds, and cross-module gemini-flash-worker-agy unification', async () => {
  assert.equal(MODEL_ENUM_MAP.get(1532), 'gemini-4-neon');
  assert.equal(MODEL_ENUM_MAP.get(1533), 'gemini-4-neon');
  assert.equal(MODEL_ENUM_MAP.get(1535), 'gemini-4-neon');
  assert.equal(MODEL_ENUM_MAP.get(1537), 'gemini-pro-orchestrator-neon');

  assert.equal(
    normalizeModelId('gemini-flash-worker-agy', 'Gemini 4 Hydrogen (Orchestrator)'),
    'gemini-4-hydrogen',
  );
  assert.equal(
    normalizeModelId('gemini-flash-worker-agy-xhigh', 'Gemini 4 Hydrogen (Orchestrator)'),
    'gemini-4-hydrogen',
  );
  assert.equal(normalizeModelId('gemini-flash-worker-agy', 'Gemini Flash'), 'gemini-3.8-flash');
  assert.equal(normalizeModelId('gemini-flash-worker-agy', ''), 'gemini-flash-worker-agy');
  assert.equal(normalizeModelId('gemini-flash-worker-agy', 'Auto'), 'gemini-flash-worker-agy');
  assert.equal(normalizeModelId('gemini-flash-worker', 'Gemini 4 Neon (High)'), 'gemini-4-neon');
  assert.equal(normalizeModelId('gemini-flash-worker', 'Gemini 4 Argon (Low)'), 'gemini-4-argon');

  assert.equal(resolveModelProfile('gemini-flash-worker-agy').id, 'gemini-4-hydrogen');
  assert.equal(resolveModelProfile('gemini-3.8-flash').id, 'gemini-3-8-flash');
  assert.equal(resolveModelProfile('gemini-3-8-flash').id, 'gemini-3-8-flash');
  assert.equal(resolveModelProfile('Gemini Flash').id, 'gemini-3-8-flash');

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:26:51
// Description: Update Gemini 4 Hydrogen 95% cache discount ($0.075/1M) and
// flat 1M context (longContextTier=false) expectations in v0.4.0-r2 Test 1.
// ============================================================================
  const pricing = resolveModelPricing('gemini-flash-worker-agy', DEFAULT_PREFS);
  assert.equal(pricing.profileId, 'gemini-4-hydrogen');
  assert.equal(pricing.profileLabel, 'Gemini 4 Hydrogen');
  assert.equal(pricing.usdInputPer1M, 1.5);
  assert.equal(pricing.usdCachedPer1M, 0.075);
  assert.equal(pricing.usdOutputPer1M, 7.5);
  assert.equal(pricing.longContextTier, false);

  // Bare worker raw slug keeps jio_pro subscription detection while normalized gemini-4-hydrogen detects pro
  assert.equal(detectSubscriptionPlanFromModels(['gemini-flash-worker-agy']), 'jio_pro');
  assert.equal(detectSubscriptionPlanFromModels(['gemini-4-hydrogen']), 'pro');

  // pricing_sync.getRuntimeCatalog maps bare gemini-flash-worker-agy cleanly to gemini-4-hydrogen without duplicate promoted entry
  const stateDir = mkdtempSync(join(tmpdir(), 'tm-v040r2-t1-pricing-'));
  try {
    const mgr = createPricingSyncManager({ stateDir, autoSyncDisabled: true });
    const runtimeCatalog = mgr.getRuntimeCatalog(['gemini-flash-worker-agy']);
    assert.equal(runtimeCatalog.some((m) => m.id === 'gemini-flash-worker-agy'), false);
    assert.equal(runtimeCatalog.some((m) => m.hint === '本地观测模型'), false);
    assert.equal(resolveModelProfile('gemini-flash-worker-agy', runtimeCatalog).id, 'gemini-4-hydrogen');
    assert.equal(resolveModelProfile('Gemini Flash', runtimeCatalog).id, 'gemini-3-8-flash');

    // Hypothetical unknown flash-worker slug (if unmapped) derives Hydrogen baseline ($1.5/$0.075/$7.5, flat context)
    const promotedCatalog = mgr.getRuntimeCatalog(['gemini-flash-worker@custom']);
    const promotedEntry = promotedCatalog.find((m) => m.id === 'gemini-flash-worker@custom');
    assert.ok(promotedEntry);
    assert.equal(promotedEntry.inputPer1M, 1.5);
    assert.equal(promotedEntry.cachedPer1M, 0.075);
    assert.equal(promotedEntry.outputPer1M, 7.5);
    assert.equal(promotedEntry.longContextTier, false);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 14:26:51
// ============================================================================

  // receipt.js, pixel_office.js, and app.js VM checks for bare gemini-flash-worker-agy
  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');

  const sandbox = {
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Promise,
    Map,
    Set,
    RegExp,
    JSON,
    URLSearchParams,
    Intl,
    AbortController,
    performance,
    Node: class {},
    innerWidth: 400,
    devicePixelRatio: 2,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    sidecar: { conversationId: 'conv-r2-t1' },
    location: { reload: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: '#000', getPropertyValue: () => '' }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ unchanged: true }) }),
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
  };
  const dummyEl = () => ({
    style: { setProperty() {}, getPropertyValue: () => '' },
    classList: { add() {}, remove() {}, contains: () => false, toggle: () => false },
    setAttribute() {},
    getAttribute: () => null,
    addEventListener() {},
    appendChild() {},
    remove() {},
    scrollIntoView() {},
    replaceChildren() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    dataset: {},
    children: [],
    childElementCount: 0,
  });
  sandbox.document = {
    readyState: 'loading',
    hidden: false,
    documentElement: dummyEl(),
    body: dummyEl(),
    createElement: dummyEl,
    createElementNS: dummyEl,
    createTextNode: (t) => ({ textContent: String(t ?? '') }),
    getElementById: dummyEl,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  sandbox.document.defaultView = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const iifeCloseIdx = appSource.lastIndexOf('})();');
  const instrumentedApp =
    appSource.slice(0, iifeCloseIdx) +
    '\n  globalThis.__tmR2T1 = { state, matchProfileIdForModel };\n' +
    appSource.slice(iifeCloseIdx);

  vm.runInNewContext(receiptSource, sandbox);
  vm.runInNewContext(pixelOfficeSource, sandbox);
  vm.runInNewContext(instrumentedApp, sandbox);

  const workerReceipt = sandbox.TokenMonitorReceipt.buildReceiptViewModel(
    {
      conversationId: '04020001-0000-4000-8000-000000000001',
      activeModel: 'gemini-flash-worker-agy',
      receipt: {
        todayDate: '2026-11-19',
        today: {
          scope: 'today',
          hasData: true,
          primaryModel: { model: 'gemini-flash-worker-agy', profileId: '', profileLabel: '' },
          main: { totalTokens: 1000, costActual: 0.01, stepsCount: 1 },
          children: [],
          childrenSubtotal: { totalTokens: 0, costActual: 0 },
          grandTotal: { totalTokens: 1000, costActual: 0.01, stepsCount: 1 },
        },
      },
    },
    { currency: 'USD' },
    { lang: 'en', scope: 'today', detailMode: 'compact' },
  );
  assert.equal(
    workerReceipt.metaRows.find((r) => r.key === 'primaryModel')?.value,
    'Gemini 4 Hydrogen',
  );
  const flashReceipt = sandbox.TokenMonitorReceipt.buildReceiptViewModel(
    {
      conversationId: '04020001-0000-4000-8000-000000000002',
      activeModel: 'gemini-3-8-flash',
      receipt: {
        todayDate: '2026-11-19',
        today: {
          scope: 'today',
          hasData: true,
          primaryModel: { model: 'gemini-3-8-flash', profileId: '', profileLabel: '' },
          main: { totalTokens: 1000, costActual: 0.01, stepsCount: 1 },
          children: [],
          childrenSubtotal: { totalTokens: 0, costActual: 0 },
          grandTotal: { totalTokens: 1000, costActual: 0.01, stepsCount: 1 },
        },
      },
    },
    { currency: 'USD' },
    { lang: 'en', scope: 'today', detailMode: 'compact' },
  );
  assert.equal(
    flashReceipt.metaRows.find((r) => r.key === 'primaryModel')?.value,
    'Gemini 3.8 Flash',
  );

  assert.equal(sandbox.TokenMonitorPixelOffice.resolveCatArchetype('gemini-flash-worker-agy').id, 'gemini-4-hydrogen');
  assert.equal(sandbox.TokenMonitorPixelOffice.resolveCatArchetype('gemini-3-8-flash').id, 'gemini-3.8-flash');

  sandbox.__tmR2T1.state.snapshot = { pricingCatalog: MODEL_PRICING_CATALOG };
  assert.equal(sandbox.__tmR2T1.matchProfileIdForModel('gemini-flash-worker-agy'), 'gemini-4-hydrogen');
  assert.equal(sandbox.__tmR2T1.matchProfileIdForModel('Gemini 4 Hydrogen (Orchestrator)'), 'gemini-4-hydrogen');
  assert.equal(sandbox.__tmR2T1.matchProfileIdForModel('gemini-3-8-flash'), 'gemini-3-8-flash');
});

test('v0.4.0-r2 Test 2: Scheme A canonical byModel merging, unknown model isolation, and Ledger v5 auto-rebuild', () => {
  clearParserCache();
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });
    const baseMs = Date.parse('2026-11-19T04:00:00Z');
    const todayKey = formatLocalDate(baseMs);

    const coordId = '04020002-0000-4000-8000-000000000000';
    const childCarbonOrchId = '04020002-0000-4000-8000-000000000001';
    const childHydrogenWorkerId = '04020002-0000-4000-8000-000000000002';
    const childLegacyFlashId = '04020002-0000-4000-8000-000000000003';
    const childUnknownId = '04020002-0000-4000-8000-000000000004';

    function writeDbConv(cid, specs) {
      const db = new DatabaseSync(join(convsDir, `${cid}.db`));
      db.exec(`
        CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
      `);
      const insGen = db.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)');
      const insStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)');
      specs.forEach((sp, idx) => {
        const usageBuf = encodeTokenUsage({
          enumId: sp.enumId,
          input: sp.input,
          cacheRead: sp.cacheRead,
          output: sp.output,
          botId: sp.botId,
        });
        const genInner = Buffer.concat([
          encodeBytesField(4, usageBuf),
          encodeBytesField(19, sp.rawModel),
          encodeBytesField(20, encodeGenKv('cascade_id', cid)),
          encodeBytesField(21, sp.displayModel),
        ]);
        const genTop = Buffer.concat([
          encodeBytesField(1, genInner),
          encodeBytesField(2, encodeVarint(sp.stepIdx)),
        ]);
        insGen.run(idx, genTop, genTop.length);

        const metaBuf = Buffer.concat([
          encodeBytesField(1, encodeTimestampMs(sp.createdMs)),
          encodeBytesField(7, encodeTimestampMs(sp.createdMs + 1000)),
          encodeBytesField(9, usageBuf),
          encodeBytesField(20, encodeStepField20({ stepIdx: sp.stepIdx, genIdx: idx, originCascadeId: cid })),
        ]);
        insStep.run(sp.stepIdx, 15, 3, metaBuf);
      });
      db.close();
    }

    // Main coordinator uses Neon (1532 + 1537), Carbon (1427), Hydrogen (1525), and unknown gemini-5-quantum
    writeDbConv(coordId, [
      {
        stepIdx: 1,
        enumId: 1532,
        rawModel: 'gemini-4-neon',
        displayModel: 'Gemini 4 Neon (High)',
        botId: 'r2t2-bot-neon-1',
        input: 1000,
        cacheRead: 2000,
        output: 100,
        createdMs: baseMs + 1000,
      },
      {
        stepIdx: 3,
        enumId: 1537,
        rawModel: 'gemini-pro-orchestrator-neon',
        displayModel: 'Orchestrator (Neon)',
        botId: 'r2t2-bot-neon-2',
        input: 2000,
        cacheRead: 3000,
        output: 200,
        createdMs: baseMs + 2000,
      },
      {
        stepIdx: 5,
        enumId: 1427,
        rawModel: 'gemini-4-carbon',
        displayModel: 'Gemini 4 Carbon (High)',
        botId: 'r2t2-bot-carbon-1',
        input: 3000,
        cacheRead: 4000,
        output: 300,
        createdMs: baseMs + 3000,
      },
      {
        stepIdx: 7,
        enumId: 1525,
        rawModel: 'gemini-4-hydrogen',
        displayModel: 'Gemini 4 Hydrogen (High)',
        botId: 'r2t2-bot-hydro-1',
        input: 4000,
        cacheRead: 5000,
        output: 400,
        createdMs: baseMs + 4000,
      },
      {
        stepIdx: 9,
        enumId: 1999,
        rawModel: 'gemini-5-quantum',
        displayModel: 'Gemini 5 Quantum (High)',
        botId: 'r2t2-bot-quantum-1',
        input: 500,
        cacheRead: 500,
        output: 50,
        createdMs: baseMs + 5000,
      },
    ]);

    // Swarm members on coordinator
    writeConversation(appData, coordId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(baseMs).toISOString(),
          content: '<USER_REQUEST>Scheme A multi-model check</USER_REQUEST>',
        },
        {
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          status: 'DONE',
          created_at: new Date(baseMs + 1000).toISOString(),
          input_tokens: 1000,
          cache_read_tokens: 2000,
          output_tokens: 100,
          tool_calls: [],
        },
      ],
      members: {
        title: 'Scheme A Swarm',
        members: {
          coordinator: { conversation_id: coordId, role: 'coordinator', model: 'gemini-4-neon' },
          wCarbon: { conversation_id: childCarbonOrchId, role: 'worker', model: 'gemini-pro-orchestrator' },
          wHydrogen: { conversation_id: childHydrogenWorkerId, role: 'worker', model: 'gemini-flash-worker-agy' },
          wLegacyFlash: { conversation_id: childLegacyFlashId, role: 'worker', model: 'gemini-flash-worker-agy' },
          wUnknown: { conversation_id: childUnknownId, role: 'worker', model: 'gemini-5-quantum' },
        },
      },
      mtimeMs: baseMs + 5500,
    });

    writeDbConv(childCarbonOrchId, [
      {
        stepIdx: 1,
        enumId: 1667,
        rawModel: 'gemini-pro-orchestrator',
        displayModel: 'Orchestrator (Carbon)',
        botId: 'r2t2-bot-carbon-2',
        input: 6000,
        cacheRead: 7000,
        output: 600,
        createdMs: baseMs + 6000,
      },
    ]);

    writeDbConv(childHydrogenWorkerId, [
      {
        stepIdx: 1,
        enumId: 1669,
        rawModel: 'gemini-flash-worker-agy',
        displayModel: 'Gemini 4 Hydrogen (Orchestrator)',
        botId: 'r2t2-bot-hydro-2',
        input: 8000,
        cacheRead: 9000,
        output: 800,
        createdMs: baseMs + 7000,
      },
    ]);

    writeDbConv(childLegacyFlashId, [
      {
        stepIdx: 1,
        enumId: 1669,
        rawModel: 'gemini-flash-worker-agy',
        displayModel: 'Gemini Flash',
        botId: 'r2t2-bot-flash-1',
        input: 1000,
        cacheRead: 1000,
        output: 100,
        createdMs: baseMs + 8000,
      },
    ]);

    writeDbConv(childUnknownId, [
      {
        stepIdx: 1,
        enumId: 1999,
        rawModel: 'gemini-5-quantum',
        displayModel: 'Gemini 5 Quantum',
        botId: 'r2t2-bot-quantum-2',
        input: 1500,
        cacheRead: 1500,
        output: 150,
        createdMs: baseMs + 9000,
      },
    ]);

    const res = analyzeConversation(coordId, { appDataDirs: [appData], disableAgentApi: true });
    assert.ok(res);

    // Tab 1 withChildren byModel: 5 clean rows (4 canonical + 1 unknown gemini-5-quantum, ZERO 'Auto' merge)
    assert.equal(res.totals.byModel.length, 5);
    assert.deepEqual(
      res.totals.byModel.map((r) => r.model).sort(),
      ['Gemini 3.8 Flash', 'Gemini 4 Carbon', 'Gemini 4 Hydrogen', 'Gemini 4 Neon', 'gemini-5-quantum'],
    );
    const byModelByName = new Map(res.totals.byModel.map((r) => [r.model, r]));

    assert.equal(byModelByName.get('Gemini 4 Neon').profileId, 'gemini-4-neon');
    assert.deepEqual(byModelByName.get('Gemini 4 Neon').rawModels, [
      'gemini-4-neon',
      'gemini-pro-orchestrator-neon',
    ]);
    assert.equal(byModelByName.get('Gemini 4 Neon').totalTokens, 8300);

    assert.equal(byModelByName.get('Gemini 4 Carbon').profileId, 'gemini-4-carbon');
    assert.deepEqual(byModelByName.get('Gemini 4 Carbon').rawModels, [
      'gemini-4-carbon',
      'gemini-pro-orchestrator',
    ]);
    assert.equal(byModelByName.get('Gemini 4 Carbon').totalTokens, 20900);

    assert.equal(byModelByName.get('Gemini 4 Hydrogen').profileId, 'gemini-4-hydrogen');
    assert.deepEqual(byModelByName.get('Gemini 4 Hydrogen').rawModels, [
      'gemini-4-hydrogen',
      'gemini-flash-worker-agy',
    ]);
    assert.equal(byModelByName.get('Gemini 4 Hydrogen').totalTokens, 27200);

    assert.equal(byModelByName.get('Gemini 3.8 Flash').profileId, 'gemini-3-8-flash');
    assert.deepEqual(byModelByName.get('Gemini 3.8 Flash').rawModels, ['gemini-flash-worker-agy']);
    assert.equal(byModelByName.get('Gemini 3.8 Flash').totalTokens, 2100);

    const quantumRow = byModelByName.get('gemini-5-quantum');
    assert.ok(quantumRow, 'Unknown model gemini-5-quantum must stay in its own independent row');
    assert.equal(quantumRow.profileId, 'auto');
    assert.deepEqual(quantumRow.rawModels, ['gemini-5-quantum']);
    assert.equal(quantumRow.totalTokens, 4200);
    assert.equal(byModelByName.has('Auto'), false);
    assert.equal(byModelByName.has('Auto (默认)'), false);

    // Tab 1 mainOnlyByModel isolates main coordinator rows (excludes child-only Gemini 3.8 Flash)
    assert.deepEqual(
      res.totals.mainOnlyByModel.map((r) => r.model).sort(),
      ['Gemini 4 Carbon', 'Gemini 4 Hydrogen', 'Gemini 4 Neon', 'gemini-5-quantum'],
    );
    const mainQuantum = res.totals.mainOnlyByModel.find((r) => r.model === 'gemini-5-quantum');
    assert.equal(mainQuantum.totalTokens, 1050);

    // Verify LEDGER_SCHEMA_VERSION === 5 automatically rebuilds stale v4 ledger and fixes Hydrogen vs Flash attribution
    assert.equal(LEDGER_SCHEMA_VERSION, 5);
    const staleV4Ledger = {
      version: 4,
      threshold: 200000,
      conversations: {
        [childHydrogenWorkerId]: {
          cacheKey: 'stale-v4-misattributed-flash',
          updatedAtMs: baseMs + 7000,
          onDisk: true,
          activeModel: 'gemini-flash-worker-agy',
          days: {
            [todayKey]: {
              byModel: {
                'gemini-flash-worker-agy': {
                  steps: 1,
                  stdIn: 8000,
                  stdCache: 9000,
                  stdOut: 800,
                  longIn: 0,
                  longCache: 0,
                  longOut: 0,
                },
              },
              hours: {},
            },
          },
        },
      },
    };
    const ledger = createUsageLedger(staleV4Ledger);
    assert.equal(ledger.getData().version, 5);
    assert.equal(ledger.isDirty(), true);
    assert.deepEqual(ledger.getData().conversations, {});

    const global = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      nowMs: baseMs + 15000,
      ledger,
      disableAgentApi: true,
    });
    for (const periodKey of ['today', 'all']) {
      const rows = global.periods[periodKey].byModel;
      assert.equal(rows.length, 5);
      const map = new Map(rows.map((r) => [r.model, r]));
      assert.deepEqual([...map.keys()].sort(), [
        'Gemini 3.8 Flash',
        'Gemini 4 Carbon',
        'Gemini 4 Hydrogen',
        'Gemini 4 Neon',
        'gemini-5-quantum',
      ]);
      assert.deepEqual(map.get('Gemini 4 Neon').rawModels, [
        'gemini-4-neon',
        'gemini-pro-orchestrator-neon',
      ]);
      assert.deepEqual(map.get('Gemini 4 Carbon').rawModels, [
        'gemini-4-carbon',
        'gemini-pro-orchestrator',
      ]);
      assert.deepEqual(map.get('Gemini 4 Hydrogen').rawModels, [
        'gemini-4-hydrogen',
        'gemini-flash-worker-agy',
      ]);
      assert.equal(map.get('Gemini 4 Hydrogen').totalTokens, 27200);
      assert.deepEqual(map.get('Gemini 3.8 Flash').rawModels, ['gemini-flash-worker-agy']);
      assert.equal(map.get('Gemini 3.8 Flash').totalTokens, 2100);
      assert.equal(map.get('gemini-5-quantum').profileId, 'auto');
      assert.deepEqual(map.get('gemini-5-quantum').rawModels, ['gemini-5-quantum']);
      assert.equal(map.get('gemini-5-quantum').totalTokens, 4200);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.4.0-r2 Test 3: round-scoped Pixel Office filtering (selectRoundChildren / buildOfficeModel) and backend timestamps', () => {
  clearParserCache();
  const testDir = dirname(fileURLToPath(import.meta.url));
  const pixelOfficeSource = readFileSync(
    join(testDir, '..', 'sidecars', 'monitor_pane', 'pixel_office.js'),
    'utf-8',
  );
  const sandbox = {
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    performance,
    module: { exports: {} },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(pixelOfficeSource, sandbox);
  const api = sandbox.TokenMonitorPixelOffice;
  assert.equal(typeof api.selectRoundChildren, 'function');

  const day1 = Date.parse('2026-11-18T10:00:00Z');
  const day2 = Date.parse('2026-11-19T04:00:00Z');
  const turn1 = day1;
  const turn2 = day1 + 3600_000;
  const turn3 = day2;

  const standingMonitor = {
    conversationId: 'r2t3-monitor',
    name: 'monitor',
    role: 'monitor',
    model: 'gemini-4-hydrogen',
    status: 'IDLE',
    killed: false,
    createdAtMs: turn1 + 5000,
    updatedAtMs: turn3 + 20_000,
  };
  const oldRetired1 = {
    conversationId: 'r2t3-v032-1',
    name: 'v032-backend',
    role: 'worker',
    model: 'gemini-4-carbon',
    status: 'IDLE',
    killed: true,
    createdAtMs: turn2 + 5000,
    updatedAtMs: turn2 + 600_000,
  };
  const oldRetired2 = {
    conversationId: 'r2t3-v032-2',
    name: 'v032-ui',
    role: 'worker',
    model: 'gemini-4-argon',
    status: 'IDLE',
    killed: true,
    createdAtMs: turn2 + 10_000,
    updatedAtMs: turn2 + 620_000,
  };
  const round2CompletedA = {
    conversationId: 'r2t3-v040-a',
    name: 'v040r2backend',
    role: 'worker',
    model: 'gemini-4-carbon',
    status: 'IDLE',
    killed: true,
    createdAtMs: turn3 + 5000,
    updatedAtMs: turn3 + 120_000,
  };
  const round2CompletedB = {
    conversationId: 'r2t3-v040-b',
    name: 'v040r2ui',
    role: 'worker',
    model: 'gemini-4-neon',
    status: 'IDLE',
    killed: true,
    createdAtMs: turn3 + 6000,
    updatedAtMs: turn3 + 110_000,
  };

  const allHistoryChildren = [
    standingMonitor,
    round2CompletedA,
    round2CompletedB,
    oldRetired1,
    oldRetired2,
  ];

  // (a) Idle / Completed mode keeps ONLY latest round (v040*) + still-alive standing worker (monitor), hides v032*
  const idleCurrent = {
    conversationId: 'r2t3-main',
    status: 'IDLE',
    activeModel: 'gemini-4-hydrogen',
    userTurnTimestampsMs: [turn1, turn2, turn3],
  };
  const idleSelected = api.selectRoundChildren(idleCurrent, allHistoryChildren);
  assert.deepEqual(
    idleSelected.map((c) => c.name),
    ['monitor', 'v040r2backend', 'v040r2ui'],
  );
  const idleOffice = api.buildOfficeModel(idleCurrent, allHistoryChildren, 'zh');
  assert.equal(idleOffice.overflowCount, 0);
  assert.equal(idleOffice.totalChildren, 3);
  assert.equal(idleOffice.slots.length, 4);

  // (b) Working mode hides ALL earlier retired workers (v032*) while keeping alive standing + current-round workers
  const workingActive = {
    conversationId: 'r2t3-v040-live',
    name: 'v040r2test',
    role: 'tester',
    model: 'gemini-4-neon',
    status: 'RUNNING_TOOLS',
    killed: false,
    activeToolLabel: 'node --test',
    createdAtMs: turn3 + 8000,
    updatedAtMs: turn3 + 130_000,
  };
  const workingChildren = [workingActive, ...allHistoryChildren];
  const workingCurrent = {
    conversationId: 'r2t3-main',
    status: 'GENERATING',
    activeModel: 'gemini-4-hydrogen',
    userTurnTimestampsMs: [turn1, turn2, turn3],
  };
  const workingSelected = api.selectRoundChildren(workingCurrent, workingChildren);
  assert.deepEqual(
    workingSelected.map((c) => c.name),
    ['v040r2test', 'monitor', 'v040r2backend', 'v040r2ui'],
  );
  const workingOffice = api.buildOfficeModel(workingCurrent, workingChildren, 'en');
  assert.equal(workingOffice.hasActive, true);
  assert.equal(workingOffice.overflowCount, 0);
  assert.equal(workingOffice.slots.length, 5);

  // (c) Single active round with 12 subagents caps visible sub desks at 8 and sets overflowCount === 4
  const twelveCurrentRound = Array.from({ length: 12 }, (_, idx) => ({
    conversationId: `r2t3-12-${idx}`,
    name: `v040-sub-${idx + 1}`,
    role: 'worker',
    model: 'gemini-4-hydrogen',
    status: idx < 2 ? 'GENERATING' : 'IDLE',
    killed: idx >= 6,
    createdAtMs: turn3 + 1000 + idx * 100,
    updatedAtMs: turn3 + 20_000 + idx * 100,
  }));
  const twelveOffice = api.buildOfficeModel(workingCurrent, twelveCurrentRound, 'zh');
  assert.equal(twelveOffice.totalChildren, 12);
  assert.equal(twelveOffice.slots.length, 9); // 1 main + 8 sub desks
  assert.equal(twelveOffice.overflowCount, 4);

  // (d) Missing userTurnTimestampsMs fallback: 30-min window + timestamp-less legacy mock compatibility
  const noTurnsCurrent = { conversationId: 'r2t3-noturns', status: 'IDLE', activeModel: 'Auto' };
  const noTurnsSelected = api.selectRoundChildren(noTurnsCurrent, allHistoryChildren);
  assert.deepEqual(
    noTurnsSelected.map((c) => c.name),
    ['monitor', 'v040r2backend', 'v040r2ui'],
  );

  const legacyTimestampless = [
    { conversationId: 'leg-1', name: 'alive-leg', killed: false, status: 'IDLE' },
    { conversationId: 'leg-2', name: 'killed-leg', killed: true, status: 'IDLE' },
  ];
  assert.deepEqual(
    api.selectRoundChildren(noTurnsCurrent, legacyTimestampless).map((c) => c.name),
    ['alive-leg'],
  );
  const allKilledTimestampless = [
    { conversationId: 'leg-k1', name: 'killed-1', killed: true, status: 'IDLE' },
    { conversationId: 'leg-k2', name: 'killed-2', killed: true, status: 'IDLE' },
  ];
  assert.deepEqual(
    api.selectRoundChildren(noTurnsCurrent, allKilledTimestampless).map((c) => c.name),
    ['killed-1', 'killed-2'],
  );

  // Backend integration: analyzeConversation exposes sorted userTurnTimestampsMs and children[].createdAtMs
  const { root, appData } = makeTempEnv();
  try {
    const coordId = '04020003-0000-4000-8000-000000000000';
    const childId = '04020003-0000-4000-8000-000000000001';
    const u1 = Date.parse('2026-11-19T01:00:00Z');
    const u2 = Date.parse('2026-11-19T02:00:00Z');
    writeConversation(appData, childId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(u2 + 2000).toISOString(),
          content: 'Child turn',
        },
      ],
      mtimeMs: u2 + 5000,
    });
    writeConversation(appData, coordId, {
      compactLines: [
        {
          step_index: 0,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(u1).toISOString(),
          content: 'Turn 1',
        },
        {
          step_index: 1,
          type: 'USER_INPUT',
          status: 'DONE',
          created_at: new Date(u2).toISOString(),
          content: 'Turn 2',
        },
      ],
      members: {
        title: 'Round Turn Backend Test',
        members: {
          coordinator: { conversation_id: coordId, role: 'coordinator', model: 'gemini-4-neon' },
          worker: { conversation_id: childId, role: 'worker', model: 'gemini-flash-worker-agy' },
        },
      },
      mtimeMs: u2 + 6000,
    });
    const analyzed = analyzeConversation(coordId, { appDataDirs: [appData], disableAgentApi: true });
    assert.deepEqual(analyzed.userTurnTimestampsMs, [u1, u2]);
    assert.equal(analyzed.children[0].createdAtMs, u2 + 2000);
    assert.equal(analyzed.children[0].rawModel, 'gemini-flash-worker-agy');
    assert.equal(analyzed.children[0].modelLabel, 'Gemini 4 Hydrogen');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.4.0-r2 Test 4: Pixel Inspector cleanup, #model-pill canonical + raw tooltip, and Tab 1/Tab 2 model-cell tooltips in VM DOM', async () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');

  const iifeCloseIdx = appSource.lastIndexOf('})();');
  const instrumentedApp =
    appSource.slice(0, iifeCloseIdx) +
    '\n  globalThis.__tmR2T4 = { state, init, renderHeader, renderPixelOfficeCard, renderChildrenAndModelsCard, renderGlobalTab, renderCurrentTab };\n' +
    appSource.slice(iifeCloseIdx);

  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }
  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }
  function matchesSimpleSelector(elNode, selector) {
    const s = selector.trim();
    if (!s) return false;
    if (s.startsWith('#')) return elNode.getAttribute('id') === s.slice(1);
    if (s.startsWith('.')) {
      return s.slice(1).split('.').filter(Boolean).every((cls) => elNode.classList.contains(cls));
    }
    const dotParts = s.split('.');
    const tagPart = dotParts[0].toUpperCase();
    if (tagPart && elNode.tagName !== tagPart) return false;
    return dotParts.slice(1).every((cls) => elNode.classList.contains(cls));
  }
  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.type = '';
      this.role = '';
      this.value = '';
      this.disabled = false;
      this.checked = false;
      this.scrollTop = 0;
      this.clientWidth = 420;
      this.width = 0;
      this.height = 0;
      this.style = {
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
        toggle: (tok, force) => {
          const key = String(tok || '');
          const shouldAdd = force === undefined ? !this._classSet.has(key) : Boolean(force);
          if (shouldAdd) this._classSet.add(key);
          else this._classSet.delete(key);
          return shouldAdd;
        },
      };
    }
    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }
    get children() {
      return this.childNodes.filter((n) => n instanceof FakeElement);
    }
    get childElementCount() {
      return this.children.length;
    }
    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') this.appendChild(new FakeTextNode(str));
    }
    setAttribute(name, val) {
      const k = String(name);
      const v = String(val);
      if (k === 'class') {
        this.className = v;
        return;
      }
      if (k === 'title') this.title = v;
      this.attributes.set(k, v);
    }
    getAttribute(name) {
      const k = String(name);
      if (k === 'class') return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(name) {
      return name === 'class' ? this._classSet.size > 0 : this.attributes.has(String(name));
    }
    removeAttribute(name) {
      if (name === 'class') this.className = '';
      else this.attributes.delete(String(name));
    }
    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx >= 0) child.parentNode.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.childNodes.indexOf(this);
        if (idx >= 0) this.parentNode.childNodes.splice(idx, 1);
        this.parentNode = null;
      }
    }
    scrollIntoView() {}
    replaceChildren(...nodes) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      for (const n of nodes) {
        if (n === null || n === undefined) continue;
        this.appendChild(typeof n === 'string' ? new FakeTextNode(n) : n);
      }
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    click(extraProps = {}) {
      const evt = {
        type: 'click',
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        ...extraProps,
      };
      for (const fn of this.listeners.get('click') || []) fn(evt);
    }
    getBoundingClientRect() {
      const w = this.clientWidth || 420;
      const h =
        this.tagName === 'CANVAS' && this.width > 0 && this.height > 0
          ? Math.round(w * (this.height / this.width))
          : 200;
      return { left: 0, top: 0, width: w, height: h };
    }
    querySelectorAll(selector) {
      const out = [];
      const visit = (node) => {
        for (const ch of node.children) {
          if (matchesSimpleSelector(ch, selector)) out.push(ch);
          visit(ch);
        }
      };
      visit(this);
      return out;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    getContext(kind) {
      if (this.tagName !== 'CANVAS' || kind !== '2d') return null;
      return {
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        imageSmoothingEnabled: true,
        setTransform() {},
        createLinearGradient() {
          return { addColorStop() {} };
        },
        measureText(str) {
          return { width: String(str || '').length * 6.5 };
        },
        fillRect() {},
        strokeRect() {},
        fillText() {},
        drawImage() {},
      };
    }
  }

  const elementsById = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);
  const fakeDocument = {
    readyState: 'loading',
    hidden: false,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const k = String(id);
      if (!elementsById.has(k)) {
        const node = new FakeElement(k.includes('card') ? 'article' : 'div');
        node.setAttribute('id', k);
        rootBody.appendChild(node);
        elementsById.set(k, node);
      }
      return elementsById.get(k);
    },
    querySelectorAll: () => [],
    addEventListener() {},
  };

  const sandbox = {
    Node: FakeNode,
    document: fakeDocument,
    innerWidth: 420,
    devicePixelRatio: 2,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    sidecar: { conversationId: 'conv-r2t4' },
    location: { reload: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: 'rgb(246, 247, 249)', getPropertyValue: () => '#f6f7f9' }),
    AbortController,
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    JSON,
    Promise,
    performance,
    URLSearchParams,
    Intl,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ unchanged: true }) }),
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  fakeDocument.defaultView = sandbox;

  vm.runInNewContext(receiptSource, sandbox);
  vm.runInNewContext(pixelOfficeSource, sandbox);
  vm.runInNewContext(instrumentedApp, sandbox);

  const exports = sandbox.__tmR2T4;
  exports.init();
  await new Promise((r) => setImmediate(r));

  const mergedByModelRows = [
    {
      model: 'Gemini 4 Neon',
      profileId: 'gemini-4-neon',
      profileLabel: 'Gemini 4 Neon',
      rawModels: ['gemini-4-neon', 'gemini-pro-orchestrator-neon'],
      rateDisplay: 'USD 2.00 / 0.20 / 10.00',
      stepsCount: 4,
      conversationsCount: 2,
      inputUncachedTokens: 10_000,
      cacheReadTokens: 20_000,
      outputTokens: 1000,
      inputTokens: 10_000,
      totalTokens: 31_000,
      costActual: 0.034,
    },
    {
      model: 'Gemini 4 Hydrogen',
      profileId: 'gemini-4-hydrogen',
      profileLabel: 'Gemini 4 Hydrogen',
      rawModels: ['gemini-4-hydrogen', 'gemini-flash-worker-agy'],
      rateDisplay: 'USD 1.50 / 0.15 / 7.50',
      stepsCount: 3,
      conversationsCount: 1,
      inputUncachedTokens: 8000,
      cacheReadTokens: 9000,
      outputTokens: 800,
      inputTokens: 8000,
      totalTokens: 17_800,
      costActual: 0.01935,
    },
  ];

  const baseCurrent = {
    conversationId: 'conv-r2t4',
    title: 'R2 UI Verification',
    activeModel: 'gemini-4-neon',
    activeModelLabel: 'Gemini 4 Neon',
    activeRawModel: 'gemini-pro-orchestrator-neon',
    status: 'GENERATING',
    userTurnTimestampsMs: [Date.now() - 60_000],
    speed: { latestStepTokPerSec: 88, weightedAvgTokPerSec: 80, maxStepTokPerSec: 95, steps: [] },
    context: { currentTotal: 50_000, usageLevel: 'HEALTHY', softLimit: 409_600, hardLimit: 512_000 },
    cache: { hitRatePct: 75, cacheReadTokens: 30_000, inputUncachedTokens: 10_000, spikes: [] },
    totals: {
      mainOnly: { totalTokens: 31_000, outputTokens: 1000, costActual: 0.034, stepsCount: 4 },
      withChildren: { totalTokens: 48_800, outputTokens: 1800, costActual: 0.05335, stepsCount: 7 },
      byModel: mergedByModelRows,
      mainOnlyByModel: [mergedByModelRows[0]],
    },
    children: [
      {
        conversationId: 'conv-r2t4-child-1',
        kind: 'swarm',
        name: 'worker-hydro',
        role: 'worker',
        model: 'gemini-4-hydrogen',
        rawModel: 'gemini-flash-worker-agy',
        modelLabel: 'Gemini 4 Hydrogen',
        status: 'RUNNING_TOOLS',
        killed: false,
        activeToolLabel: 'Run tests',
        createdAtMs: Date.now() - 30_000,
        updatedAtMs: Date.now() - 1000,
        latestTokPerSec: 70,
        contextTotal: 17_000,
        outputTokens: 800,
        costActual: 0.01935,
      },
    ],
  };

  const snap = {
    appVersion: '0.4.0',
    prefs: { ...DEFAULT_PREFS, pixelOfficeCollapsed: false },
    pricingCatalog: MODEL_PRICING_CATALOG,
    current: baseCurrent,
    global: {
      todayDate: '2026-11-19',
      periods: {
        today: {
          rangeKey: 'today',
          startDate: '2026-11-19',
          endDate: '2026-11-19',
          spanDaysCount: 1,
          activeDaysCount: 1,
          conversationsCount: 2,
          archivedConversationsCount: 0,
          stepsCount: 7,
          inputTokens: 18_000,
          cacheReadTokens: 29_000,
          outputTokens: 1800,
          totalTokens: 48_800,
          cacheHitRatePct: 61.7,
          costActual: 0.05335,
          avgDailyCost: 0.05335,
          avgDailyTokens: 48_800,
          trendGranularity: 'hour',
          series: [],
          byModel: mergedByModelRows,
          topConversations: [],
          subscription: null,
        },
      },
      recentConversations: [],
    },
  };

  // 1. Header #model-pill verification (Neon, Hydrogen, Auto ZH/EN)
  exports.state.snapshot = snap;
  exports.state.lang = 'zh';
  exports.renderHeader(snap);
  assert.equal(fakeDocument.getElementById('model-text').textContent, 'Gemini 4 Neon');
  assert.equal(
    fakeDocument.getElementById('model-pill').title,
    '当前模型: Gemini 4 Neon (gemini-pro-orchestrator-neon)',
  );

  exports.state.lang = 'en';
  exports.renderHeader(snap);
  assert.equal(fakeDocument.getElementById('model-text').textContent, 'Gemini 4 Neon');
  assert.equal(
    fakeDocument.getElementById('model-pill').title,
    'Current Model: Gemini 4 Neon (gemini-pro-orchestrator-neon)',
  );

  // Hydrogen header pill check
  const hydroSnap = {
    ...snap,
    current: {
      ...baseCurrent,
      activeModel: 'gemini-4-hydrogen',
      activeModelLabel: 'Gemini 4 Hydrogen',
      activeRawModel: 'gemini-flash-worker-agy',
    },
  };
  exports.renderHeader(hydroSnap);
  assert.equal(fakeDocument.getElementById('model-text').textContent, 'Gemini 4 Hydrogen');
  assert.equal(
    fakeDocument.getElementById('model-pill').title,
    'Current Model: Gemini 4 Hydrogen (gemini-flash-worker-agy)',
  );

  // Auto header pill localization check (EN vs ZH)
  const autoSnap = {
    ...snap,
    current: {
      ...baseCurrent,
      activeModel: 'Auto',
      activeModelLabel: 'Auto',
      activeRawModel: 'Auto',
    },
  };
  exports.state.lang = 'zh';
  exports.renderHeader(autoSnap);
  assert.equal(fakeDocument.getElementById('model-text').textContent, 'Auto (默认)');
  assert.equal(fakeDocument.getElementById('model-pill').title, '当前模型: Auto (默认)');
  exports.state.lang = 'en';
  exports.renderHeader(autoSnap);
  assert.equal(fakeDocument.getElementById('model-text').textContent, 'Auto');
  assert.equal(fakeDocument.getElementById('model-pill').title, 'Current Model: Auto');

  // 2. Pixel Inspector cleanup on Main and Child desk clicks
  exports.state.lang = 'zh';
  exports.state.activeTab = 'current';
  exports.state.pixelOfficeCollapsed = false;
  exports.state.pixelOfficeSelectedKey = '';
  exports.state.snapshot = snap;
  exports.renderCurrentTab(snap);

  const pixelCard = fakeDocument.getElementById('card-pixel-office');
  const mainBox = exports.state.pixelOfficeHitBoxes.find((b) => b.type === 'slot' && b.key === 'main');
  const childBox = exports.state.pixelOfficeHitBoxes.find(
    (b) => b.type === 'slot' && b.key === 'conv-r2t4-child-1',
  );
  assert.ok(mainBox && childBox);

  // Click Main desk (Gemini 4 Neon)
  exports.state.pixelOfficeCanvas.click({
    clientX: mainBox.x + mainBox.w / 2,
    clientY: mainBox.y + mainBox.h / 2,
  });
  const mainBadge = pixelCard.querySelector('.pixel-inspector-persona-badge');
  assert.equal(mainBadge?.textContent, 'Gemini 4 Neon');
  assert.equal(mainBadge.textContent.includes('\u8d5b\u535a\u9713\u8679\u7535\u5149\u732b'), false);
  assert.equal(mainBadge.textContent.includes('·'), false);
  assert.equal(pixelCard.querySelectorAll('.pixel-inspector-trait').length, 0);
  assert.equal(
    pixelCard.querySelector('.pixel-inspector-model')?.textContent,
    'gemini-pro-orchestrator-neon',
  );

  // Click Child desk (Gemini 4 Hydrogen / gemini-flash-worker-agy)
  exports.state.pixelOfficeCanvas.click({
    clientX: childBox.x + childBox.w / 2,
    clientY: childBox.y + childBox.h / 2,
  });
  const childBadge = pixelCard.querySelector('.pixel-inspector-persona-badge');
  assert.equal(childBadge?.textContent, 'Gemini 4 Hydrogen');
  assert.equal(childBadge.textContent.includes('\u6c22\u4e91\u51b0\u84dd\u8f7b\u7fbd\u732b'), false);
  assert.equal(childBadge.textContent.includes('·'), false);
  assert.equal(pixelCard.querySelectorAll('.pixel-inspector-trait').length, 0);
  assert.equal(
    pixelCard.querySelector('.pixel-inspector-model')?.textContent,
    'gemini-flash-worker-agy',
  );

  // 3. Tab 1 and Tab 2 td.model-cell.title includes row.rawModels + rate summary
  const modelsCard = fakeDocument.getElementById('card-children-models');
  const tab1Cells = modelsCard.querySelectorAll('td.model-cell');
  assert.equal(tab1Cells.length, 2);
  assert.equal(tab1Cells[0].textContent, 'Gemini 4 Neon');
  assert.equal(tab1Cells[0].title.includes('gemini-4-neon, gemini-pro-orchestrator-neon'), true);
  assert.equal(tab1Cells[0].title.includes('USD 2.00 / 0.20 / 10.00'), true);
  assert.equal(tab1Cells[1].textContent, 'Gemini 4 Hydrogen');
  assert.equal(tab1Cells[1].title.includes('gemini-4-hydrogen, gemini-flash-worker-agy'), true);
  assert.equal(tab1Cells[1].title.includes('USD 1.50 / 0.15 / 7.50'), true);

  exports.renderGlobalTab(snap);
  const globalContent = fakeDocument.getElementById('global-content');
  const tab2Cells = globalContent.querySelectorAll('td.model-cell');
  assert.equal(tab2Cells.length, 2);
  assert.equal(tab2Cells[0].textContent, 'Gemini 4 Neon');
  assert.equal(tab2Cells[0].title.includes('gemini-4-neon, gemini-pro-orchestrator-neon'), true);
  assert.equal(tab2Cells[0].title.includes('USD 2.00 / 0.20 / 10.00'), true);
  assert.equal(tab2Cells[1].textContent, 'Gemini 4 Hydrogen');
  assert.equal(tab2Cells[1].title.includes('gemini-4-hydrogen, gemini-flash-worker-agy'), true);
  assert.equal(tab2Cells[1].title.includes('USD 1.50 / 0.15 / 7.50'), true);
});

test('v0.4.0-r2 Test 5: 409600/512000 context limits, PREFS_SCHEMA_VERSION = 4 migration, docs/index zero leftovers, banned terms, and I18N parity', async () => {
  assert.equal(DEFAULT_PREFS.softContextLimit, 409600);
  assert.equal(DEFAULT_PREFS.hardContextLimit, 512000);

  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');
  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const pluginJsonRaw = readFileSync(join(repoRoot, 'plugin.json'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  // Placeholders & 0 leftover 400000/500000 defaults in index.html & docs
  assert.match(indexHtml, /id="pref-soft-limit"[^>]*placeholder="409600"/);
  assert.match(indexHtml, /id="pref-hard-limit"[^>]*placeholder="512000"/);
  assert.equal(indexHtml.includes('400000'), false);
  assert.equal(indexHtml.includes('500000'), false);
  for (const [docName, docText] of [
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['plugin.json', pluginJsonRaw],
  ]) {
    for (const staleStr of ['400000', '500000', '400,000', '500,000', '400k', '500k', '460k']) {
      assert.equal(docText.includes(staleStr), false, `${docName} must not contain stale ${staleStr}`);
    }
  }

  // Banned terms check across all code, docs, and UI I18N
  const bannedTerm = '\u6c34\u4f4d';
  const legacyDocPhrase = 'Dedicated ' + 'Gemini 3.1 Pro';
  const legacyUiTerm = '\u5728\u5f79\u6a21\u578b';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['parser.mjs', parserSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['main.mjs', mainSource],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['plugin.json', pluginJsonRaw],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    assert.equal(src.includes(bannedTerm), false, `${label} must not contain banned term`);
    assert.equal(src.includes(legacyDocPhrase), false, `${label} must not contain legacy doc phrase`);
  }
  const i18nStart = appSource.indexOf('const I18N = {');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch);
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['I18N.zh', i18nMatch[1]],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['plugin.json', pluginJsonRaw],
  ]) {
    assert.equal(src.includes(legacyUiTerm), false, `${label} must not contain legacy UI term`);
  }

  // 100% I18N.zh / I18N.en key & placeholder parity
  const extractEntries = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(match[1], match[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());
  const extractPlaceholders = (str) =>
    [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `I18N placeholder mismatch for "${key}"`,
    );
  }

  // Standalone main.mjs startup migration for v3 untouched (400000/500000 -> 409600/512000) vs custom limits
  const mainPath = join(paneDir, 'main.mjs');
  const sdkCandidates = [
    process.env.SIDECAR_SDK_PATH,
    join(homedir(), '.gemini', 'antigravity', 'lib', 'node_modules', 'sidecar_sdk', 'index.mjs'),
    join(homedir(), '.gemini', 'config', 'node_modules', 'sidecar_sdk', 'index.mjs'),
  ].filter((p) => typeof p === 'string' && p.trim() && existsSync(p));

  async function runV3Startup(initialState) {
    const { root, appData } = makeTempEnv();
    const dataDir = join(appData, 'sidecar_data', 'agy-token-monitor', 'monitor_pane', 'data');
    mkdirSync(dataDir, { recursive: true });
    const fakeHome = join(root, 'home');
    mkdirSync(fakeHome, { recursive: true });
    const stateFile = join(dataDir, 'monitor_state.json');
    writeFileSync(stateFile, JSON.stringify(initialState, null, 2), 'utf-8');

    const port = await pickFetchSafeFreePort();
    const env = { ...process.env };
    delete env.ANTIGRAVITY_LS_ADDRESS;
    delete env.ANTIGRAVITY_CSRF_TOKEN;
    delete env.ANTIGRAVITY_SIDECAR_WEB_PORT;
    delete env.ANTIGRAVITY_CONVERSATION_ID;
    delete env.ANTIGRAVITY_SIDECAR_UI_TOKEN;
    delete env.ANTIGRAVITY_AGENTAPI_EXE;
    if (sdkCandidates[0]) env.SIDECAR_SDK_PATH = sdkCandidates[0];
    env.ANTIGRAVITY_EXECUTABLE_DATA_DIR = dataDir;
    env.USERPROFILE = fakeHome;
    env.HOME = fakeHome;
    env.PRICING_SYNC_DISABLE_AUTO = '1';
    env.RELEASE_UPDATE_DISABLE_AUTO = '1';
    env.DISABLE_SYSTEM_PROXY_LOOKUP = '1';

    const child = spawn(process.execPath, [mainPath, '--standalone', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await new Promise((resolveReady, rejectReady) => {
        if (child.exitCode !== null) {
          rejectReady(new Error(`Sidecar exited prematurely (${child.exitCode})`));
          return;
        }
        const timer = setTimeout(() => rejectReady(new Error('Sidecar startup timeout')), 10000);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
          if (out.includes(`[sidecar] listening on 127.0.0.1:${port}`)) {
            clearTimeout(timer);
            resolveReady();
          }
        });
        child.stderr.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          rejectReady(new Error(`Sidecar exited prematurely (${code}): ${out}`));
        });
      });
      const snap = await (await fetch(`http://127.0.0.1:${port}/api/snapshot`)).json();
      const persisted = JSON.parse(readFileSync(stateFile, 'utf-8'));
      return { snap, persisted };
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise((r) => {
          if (child.exitCode !== null || child.signalCode !== null) return r();
          const t = setTimeout(r, 3000);
          child.once('exit', () => {
            clearTimeout(t);
            r();
          });
        });
      }
      rmSync(root, { recursive: true, force: true });
    }
  }

  const migratedV3 = await runV3Startup({
    prefsSchemaVersion: 3,
    stepEndTimes: {},
    prefs: { softContextLimit: 400000, hardContextLimit: 500000 },
  });
  assert.equal(migratedV3.snap.prefs.softContextLimit, 409600);
  assert.equal(migratedV3.snap.prefs.hardContextLimit, 512000);
  assert.equal(migratedV3.persisted.prefsSchemaVersion, 4);

  const preservedCustomV3 = await runV3Startup({
    prefsSchemaVersion: 3,
    stepEndTimes: {},
    prefs: { softContextLimit: 320000, hardContextLimit: 500000 },
  });
  assert.equal(preservedCustomV3.snap.prefs.softContextLimit, 320000);
  assert.equal(preservedCustomV3.snap.prefs.hardContextLimit, 500000);
  assert.equal(preservedCustomV3.persisted.prefsSchemaVersion, 4);
});
// ============================================================================
// [MODIFIED END] 2026-11-19 13:43:05
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:26:51
// Description: Add test #71 verifying Gemini 4 flat-context 95% cache pricing,
// app.js empty-catalog fallback, models.dev / LiteLLM 5% fallback without forced
// >200k tier, Angular SPA <noscript><pre> Markdoc Google official parser across
// pre/post Dec 1 & Jan 1 schedules, and non-destructive pricing_cache v1->v2 migration.
// ============================================================================
test('v0.4.0 Gemini 4 flat-context pricing, 95% cache discount, LiteLLM 5% fallback, Markdoc Google official parser (pre/post Dec 1 & Jan 1), and pricing_cache v1->v2 migration', async () => {
  // (a) Built-in Catalog & 300k Flat Cost + app.js getEffectiveDraftUsd empty-catalog fallback
  const byCatalogId = new Map(MODEL_PRICING_CATALOG.map((m) => [m.id, m]));
  for (const [id, expIn, expCached, expOut] of [
    ['gemini-4-carbon', 2.0, 0.1, 10.0],
    ['gemini-4-argon', 2.0, 0.1, 10.0],
    ['gemini-4-neon', 3.0, 0.15, 15.0],
    ['gemini-4-hydrogen', 1.5, 0.075, 7.5],
    ['auto', 2.0, 0.1, 10.0],
  ]) {
    const entry = byCatalogId.get(id);
    assert.ok(entry, `Expected ${id} in MODEL_PRICING_CATALOG`);
    assert.equal(entry.inputPer1M, expIn);
    assert.equal(entry.cachedPer1M, expCached);
    assert.equal(entry.outputPer1M, expOut);
    assert.equal(entry.longContextTier, false);
    assert.equal(entry.longInputMultiplier, 1.0);
    assert.equal(entry.longOutputMultiplier, 1.0);
  }
  const g31Pro = byCatalogId.get('gemini-3.1-pro');
  assert.ok(g31Pro);
  assert.equal(g31Pro.inputPer1M, 2.0);
  assert.equal(g31Pro.cachedPer1M, 0.2);
  assert.equal(g31Pro.outputPer1M, 12.0);
  assert.equal(g31Pro.longContextTier, true);
  assert.equal(g31Pro.longInputMultiplier, 2.0);
  assert.equal(g31Pro.longOutputMultiplier, 1.5);

  const step300k = {
    input_tokens: 100000,
    cache_read_tokens: 200000,
    output_tokens: 10000,
  };
  assert.ok(Math.abs(computeStepCost(step300k, DEFAULT_PREFS, 'gemini-4-carbon').costActual - 0.32) < 1e-9);
  assert.ok(Math.abs(computeStepCost(step300k, DEFAULT_PREFS, 'gemini-4-argon').costActual - 0.32) < 1e-9);
  assert.ok(Math.abs(computeStepCost(step300k, DEFAULT_PREFS, 'gemini-4-neon').costActual - 0.48) < 1e-9);
  assert.ok(Math.abs(computeStepCost(step300k, DEFAULT_PREFS, 'gemini-4-hydrogen').costActual - 0.24) < 1e-9);
  assert.ok(Math.abs(computeStepCost(step300k, DEFAULT_PREFS, 'Auto').costActual - 0.32) < 1e-9);
  assert.ok(Math.abs(computeStepCost(step300k, DEFAULT_PREFS, 'gemini-3.1-pro').costActual - 0.66) < 1e-9);

  const testDir = dirname(fileURLToPath(import.meta.url));
  const paneDir = join(testDir, '..', 'sidecars', 'monitor_pane');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const dummyEl = () => ({
    style: { setProperty() {}, getPropertyValue: () => '' },
    classList: { add() {}, remove() {}, contains: () => false, toggle: () => false },
    setAttribute() {},
    getAttribute: () => null,
    addEventListener() {},
    appendChild() {},
    remove() {},
    scrollIntoView() {},
    replaceChildren() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    dataset: {},
    children: [],
    childElementCount: 0,
  });
  const appSandbox = {
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Promise,
    Map,
    Set,
    RegExp,
    JSON,
    URLSearchParams,
    Intl,
    AbortController,
    performance,
    Node: class {},
    innerWidth: 400,
    devicePixelRatio: 2,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    sidecar: { conversationId: 'conv-g4-pricing-vm' },
    location: { reload: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: '#000', getPropertyValue: () => '' }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ unchanged: true }) }),
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
    document: {
      readyState: 'loading',
      hidden: false,
      documentElement: dummyEl(),
      body: dummyEl(),
      createElement: dummyEl,
      createElementNS: dummyEl,
      createTextNode: (t) => ({ textContent: String(t ?? '') }),
      getElementById: dummyEl,
      querySelectorAll: () => [],
      addEventListener() {},
    },
  };
  appSandbox.document.defaultView = appSandbox;
  appSandbox.window = appSandbox;
  appSandbox.globalThis = appSandbox;
  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0);
  const instrumentedApp =
    appSource.slice(0, iifeCloseIdx) +
    '\n  globalThis.__tmG4Fallback = { state, getEffectiveDraftUsd };\n' +
    appSource.slice(iifeCloseIdx);
  vm.runInNewContext(receiptSource, appSandbox);
  vm.runInNewContext(pixelOfficeSource, appSandbox);
  vm.runInNewContext(instrumentedApp, appSandbox);

  appSandbox.__tmG4Fallback.state.snapshot = { pricingCatalog: [] };
  const emptyDraft = appSandbox.__tmG4Fallback.getEffectiveDraftUsd('gemini-4-carbon');
  assert.equal(emptyDraft.inputPer1M, 2);
  assert.equal(emptyDraft.cachedPer1M, 0.1);
  assert.equal(emptyDraft.outputPer1M, 10);
  assert.equal(emptyDraft.longContextTier, false);
  assert.deepEqual({ ...emptyDraft.defaultUsd }, {
    inputPer1M: 2,
    cachedPer1M: 0.1,
    outputPer1M: 10,
    longContextTier: false,
  });

  // (b) parseModelsDevCatalog & parseLiteLlmCatalog No-Force-longContextTier + 5% Cache Fallback
  const modelsDevParsed = parseModelsDevCatalog({
    google: {
      models: {
        'gemini-4-carbon': {
          id: 'gemini-4-carbon',
          name: 'Gemini 4 Carbon',
          cost: { input: 2.0, cache_read: 0.1, output: 10.0 },
        },
        'gemini-4-argon': {
          id: 'gemini-4-argon',
          name: 'Gemini 4 Argon',
          cost: { input: 2.0, cache_read: 0.1, output: 10.0 },
        },
        'gemini-4-neon': {
          id: 'gemini-4-neon',
          name: 'Gemini 4 Neon',
          cost: { input: 3.0, cache_read: 0.15, output: 15.0 },
        },
        'gemini-4-hydrogen': {
          id: 'gemini-4-hydrogen',
          name: 'Gemini 4 Hydrogen',
          cost: { input: 1.5, cache_read: 0.075, output: 7.5 },
        },
        'gemini-3.1-pro': {
          id: 'gemini-3.1-pro',
          name: 'Gemini 3.1 Pro',
          cost: {
            input: 2.0,
            cache_read: 0.2,
            output: 12.0,
            context_over_200k: { input: 4.0, output: 18.0 },
          },
        },
      },
    },
  });
  for (const pid of ['gemini-4-carbon', 'gemini-4-argon', 'gemini-4-neon', 'gemini-4-hydrogen']) {
    const rec = modelsDevParsed.profileRates[pid];
    assert.ok(rec, `Expected ${pid} in models.dev profileRates`);
    assert.equal(rec.longContextTier, false);
    assert.equal(rec.longInputMultiplier, 1.0);
    assert.equal(rec.longOutputMultiplier, 1.0);
  }
  assert.equal(modelsDevParsed.profileRates['gemini-3.1-pro'].longContextTier, true);
  assert.equal(modelsDevParsed.profileRates['gemini-3.1-pro'].longInputMultiplier, 2.0);
  assert.equal(modelsDevParsed.profileRates['gemini-3.1-pro'].longOutputMultiplier, 1.5);

  const liteLlmParsed = parseLiteLlmCatalog({
    'gemini/gemini-4-carbon': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      output_cost_per_token: 10.0e-6,
    },
    'gemini/gemini-4-argon': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      output_cost_per_token: 10.0e-6,
    },
    'gemini/gemini-4-neon': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 3.0e-6,
      output_cost_per_token: 15.0e-6,
    },
    'gemini/gemini-4-hydrogen': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 1.5e-6,
      output_cost_per_token: 7.5e-6,
    },
    'gemini/gemini-3-flash': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 0.5e-6,
      output_cost_per_token: 3.0e-6,
    },
    'vertex_ai/gemini-3.1-pro': {
      litellm_provider: 'vertex_ai-language-models',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_cost_per_token: 0.2e-6,
      output_cost_per_token: 12.0e-6,
      input_cost_per_token_above_200k_tokens: 4.0e-6,
      output_cost_per_token_above_200k_tokens: 18.0e-6,
    },
  });
  for (const [pid, expCached] of [
    ['gemini-4-carbon', 0.1],
    ['gemini-4-argon', 0.1],
    ['gemini-4-neon', 0.15],
    ['gemini-4-hydrogen', 0.075],
  ]) {
    const rec = liteLlmParsed.profileRates[pid];
    assert.ok(rec, `Expected ${pid} in LiteLLM profileRates`);
    assert.equal(rec.cachedPer1M, expCached);
    assert.equal(rec.longContextTier, false);
    assert.equal(rec.longInputMultiplier, 1.0);
    assert.equal(rec.longOutputMultiplier, 1.0);
  }
  assert.equal(liteLlmParsed.upstreamPool['gemini-3-flash'].cachedPer1M, 0.05);
  assert.equal(liteLlmParsed.upstreamPool['gemini-3-flash'].longContextTier, false);
  assert.equal(liteLlmParsed.profileRates['gemini-3.1-pro'].longContextTier, true);
  assert.equal(liteLlmParsed.profileRates['gemini-3.1-pro'].longInputMultiplier, 2.0);
  assert.equal(liteLlmParsed.profileRates['gemini-3.1-pro'].longOutputMultiplier, 1.5);

  // (c) parseGoogleOfficialPricingHtml Angular SPA <noscript><pre> Markdoc Fixture
  const rawMarkdocSource = [
    '# Gemini API Pricing',
    '',
    '## Gemini 4 Carbon {% id="gemini-4-carbon" %}',
    '{% tabs %}',
    '{% tab title="Standard" %}',
    '{% table %}',
    '* Feature',
    '* Free Tier',
    '* Paid Tier, per 1M tokens in USD',
    '---',
    '* Input price',
    '* Free of charge',
    '* $2.00 (through Nov 30, 2026)',
    '$4.00 starting December 1, 2026',
    '---',
    '* Output price{% sup %}*{% /sup %}',
    '* Free of charge',
    '* $10.00 (through Nov 30, 2026)',
    '$20.00 starting December 1, 2026',
    '---',
    '* Context caching',
    '* Free of charge',
    '* $0.10 (through Nov 30, 2026). $0.20 starting December 1, 2026',
    '$0.50/$1.00 per hour (storage price)',
    '{% /table %}',
    '{% /tab %}',
    '{% tab title="Batch" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $1.00',
    '---',
    '* Output price',
    '* Not available',
    '* $5.00',
    '{% /table %}',
    '{% /tab %}',
    '{% tab title="Flex" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $1.20',
    '---',
    '* Output price',
    '* Not available',
    '* $6.00',
    '{% /table %}',
    '{% /tab %}',
    '{% tab title="Priority" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $6.00',
    '---',
    '* Output price',
    '* Not available',
    '* $30.00',
    '{% /table %}',
    '{% /tab %}',
    '{% /tabs %}',
    '',
    '## Gemini 4 Argon',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:38:50
// Description: Add live-observed Markdoc prose cross-reference link and
// Contributor tab under Gemini 4 Argon to guard against heading/tab hijacking.
// ============================================================================
    '[Gemini 4 Carbon](https://ai.google.dev/gemini-api/docs/models#gemini-4-carbon) across complex coding, agentic,',
// ============================================================================
// [MODIFIED END] 2026-11-19 14:38:50
// ============================================================================
    '{% tabs %}',
    '{% tab title="Standard" %}',
    '{% table %}',
    '* Feature',
    '* Free Tier',
    '* Paid Tier, per 1M tokens in USD',
    '---',
    '* Input price',
    '* Free of charge',
    '* $2.00 (through November 30, 2026). $4.00 starting December 1, 2026',
    '---',
    '* Output price{% sup %}*{% /sup %}',
    '* Free of charge',
    '* $10.00 (through November 30, 2026). $20.00 starting December 1, 2026',
    '---',
    '* Context caching',
    '* Free of charge',
    '* Implicit caching only',
    '$0.50/$1.00 per hour (storage price)',
    '{% /table %}',
    '{% /tab %}',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:38:50
// Description: Add Contributor tab fixture under Gemini 4 Argon.
// ============================================================================
    '{% tab title="Contributor" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $0.50',
    '---',
    '* Output price',
    '* Not available',
    '* $2.50',
    '{% /table %}',
    '{% /tab %}',
// ============================================================================
// [MODIFIED END] 2026-11-19 14:38:50
// ============================================================================
    '{% tab title="Batch" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $1.00',
    '---',
    '* Output price',
    '* Not available',
    '* $5.00',
    '{% /table %}',
    '{% /tab %}',
    '{% /tabs %}',
    '',
    '## Gemini 4 Neon',
    '{% tabs %}',
    '{% tab title="Standard" %}',
    '{% table %}',
    '* Feature',
    '* Free Tier',
    '* Paid Tier, per 1M tokens in USD',
    '---',
    '* Input price',
    '* Not available',
    '* $3.00',
    '---',
    '* Output price{% sup %}*{% /sup %}',
    '* Not available',
    '* $15.00',
    '---',
    '* Context caching',
    '* Not available',
    '* $0.15',
    '$0.50/$1.00 per hour (storage price)',
    '{% /table %}',
    '{% /tab %}',
    '{% tab title="Priority" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $9.00',
    '---',
    '* Output price',
    '* Not available',
    '* $45.00',
    '{% /table %}',
    '{% /tab %}',
    '{% /tabs %}',
    '',
    '## Gemini 4 Hydrogen',
    '{% tabs %}',
    '{% tab title="Standard" %}',
    '{% table %}',
    '* Feature',
    '* Free Tier',
    '* Paid Tier, per 1M tokens in USD',
    '---',
    '* Input price',
    '* Free of charge',
    '* $1.50',
    '---',
    '* Output price',
    '* Free of charge',
    '* $7.50',
    '---',
    '* Context caching',
    '* Free of charge',
    '* Implicit caching only',
    '$0.50/$1.00 per hour (storage price)',
    '{% /table %}',
    '{% /tab %}',
    '{% tab title="Flex" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $0.75',
    '---',
    '* Output price',
    '* Not available',
    '* $3.75',
    '{% /table %}',
    '{% /tab %}',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:38:50
// Description: Add Contributor tab fixture under Gemini 4 Hydrogen.
// ============================================================================
    '{% tab title="Contributor" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $0.40',
    '---',
    '* Output price',
    '* Not available',
    '* $2.00',
    '{% /table %}',
    '{% /tab %}',
// ============================================================================
// [MODIFIED END] 2026-11-19 14:38:50
// ============================================================================
    '{% /tabs %}',
    '',
    '## Gemini 3.1 Pro Preview',
    '{% tabs %}',
    '{% tab title="Standard" %}',
    '{% table %}',
    '* Feature',
    '* Free Tier',
    '* Paid Tier, per 1M tokens in USD',
    '---',
    '* Input price',
    '* Not available',
    '* $2.00, prompts <= 200k tokens',
    '$4.00, prompts > 200k tokens',
    '---',
    '* Output price{% sup %}*{% /sup %}',
    '* Not available',
    '* $12.00, prompts <= 200k tokens',
    '$18.00, prompts > 200k tokens',
    '---',
    '* Context caching',
    '* Not available',
    '* $0.20, prompts <= 200k tokens',
    '$0.40, prompts > 200k tokens',
    '$4.50 / 1,000,000 tokens per hour (storage price)',
    '{% /table %}',
    '{% /tab %}',
    '{% /tabs %}',
    '',
    '## Gemini 3.8 Flash',
    '{% tabs %}',
    '{% tab title="Standard" %}',
    '{% table %}',
    '* Feature',
    '* Free Tier',
    '* Paid Tier, per 1M tokens in USD',
    '---',
    '* Input price',
    '* Free of charge',
    '* $0.75 (through December 31, 2026). $1.50 starting January 1, 2027',
    '---',
    '* Output price{% sup %}*{% /sup %}',
    '* Free of charge',
    '* $3.75 (through December 31, 2026). $7.50 starting January 1, 2027',
    '---',
    '* Context caching',
    '* Free of charge',
    '* $0.075 (through December 31, 2026). $0.15 starting January 1, 2027',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:38:50
// Description: Include scheduled slash-delimited storage price lines under Gemini 3.8 Flash.
// ============================================================================
    '$0.50 / 1,000,000 tokens per hour (storage price) through December 31, 2026.',
    '$1.00 / 1,000,000 tokens per hour (storage price) starting January 1, 2027.',
// ============================================================================
// [MODIFIED END] 2026-11-19 14:38:50
// ============================================================================
    '{% /table %}',
    '{% /tab %}',
    '{% tab title="Batch" %}',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $0.375',
    '---',
    '* Output price',
    '* Not available',
    '* $1.875',
    '{% /table %}',
    '{% /tab %}',
    '{% /tabs %}',
    '',
    '## Gemini Nano Banana 2.1',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $99.00',
    '---',
    '* Output price',
    '* Not available',
    '* $99.00',
    '{% /table %}',
    '',
    '## [Gemma 4](https://ai.google.dev/gemma)',
    '{% table %}',
    '* Input price',
    '* Free of charge',
    '* $88.00',
    '---',
    '* Output price',
    '* Free of charge',
    '* $88.00',
    '{% /table %}',
    '',
    '## Pricing for tools',
    '{% table %}',
    '* Input price',
    '* $77.00',
    '---',
    '* Output price',
    '* $77.00',
    '{% /table %}',
    '',
    '## Notes',
    'Output price $66.00 for custom enterprise grounding.',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:38:50
// Description: Add non-chat Image & TTS sections containing wrapped Markdoc prose
// cross-reference links (Gemini 3.1 Pro., Gemini 3.8 Flash ... and be, Gemini 3.5 Flash-Lite rates.)
// to verify explicit [H1..H6] headings suppress false plain-heading matches.
// ============================================================================
    '',
    '## Gemini 3 Pro Image',
    'See flagship reasoning rates for',
    '[Gemini 3.1 Pro](https://ai.google.dev/gemini-api/docs/models#gemini-3.1-pro).',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $0.0011',
    '---',
    '* Context caching',
    '* Not available',
    '* $0.0001',
    '---',
    '* Output price',
    '* Not available',
    '* $0.134',
    '{% /table %}',
    '',
    '## Gemini 2.5 Flash TTS',
    'Compare audio generation with',
    '[Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models#gemini-3.8-flash) (`gemini-3.8-flash`) and be',
    'sure to check',
    '[Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/pricing#lite) rates.',
    '{% table %}',
    '* Input price',
    '* Not available',
    '* $1.25, prompts <= 200k tokens',
    '$2.50, prompts > 200k tokens',
    '---',
    '* Context caching',
    '* Not available',
    '* $0.125, prompts <= 200k tokens',
    '$0.25, prompts > 200k tokens',
    '---',
    '* Output price',
    '* Not available',
    '* $10.00, prompts <= 200k tokens',
    '$15.00, prompts > 200k tokens',
    '{% /table %}',
// ============================================================================
// [MODIFIED END] 2026-11-19 14:38:50
// ============================================================================
  ].join('\n');

  const encodedMarkdoc = rawMarkdocSource
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  assert.equal(encodedMarkdoc.includes('&quot;'), true);
  assert.equal(encodedMarkdoc.includes('&lt;'), true);
  assert.equal(encodedMarkdoc.includes('&gt;'), true);

  const markdocSpaHtml = `<!doctype html><html><body><app-root></app-root><noscript><pre>${encodedMarkdoc}</pre></noscript></body></html>`;

  const parsedNov = parseGoogleOfficialPricingHtml(markdocSpaHtml, Date.UTC(2026, 10, 19, 12, 0, 0));
  assert.equal(parsedNov.models.length, 6);
  for (const [pid, expIn, expCached, expOut, expLong, expInM, expOutM] of [
    ['gemini-4-carbon', 2.0, 0.1, 10.0, false, 1.0, 1.0],
    ['gemini-4-argon', 2.0, 0.1, 10.0, false, 1.0, 1.0],
    ['gemini-4-neon', 3.0, 0.15, 15.0, false, 1.0, 1.0],
    ['gemini-4-hydrogen', 1.5, 0.075, 7.5, false, 1.0, 1.0],
    ['gemini-3.1-pro', 2.0, 0.2, 12.0, true, 2.0, 1.5],
    ['gemini-3-8-flash', 0.75, 0.075, 3.75, false, 1.0, 1.0],
  ]) {
    const rec = parsedNov.profileRates[pid];
    assert.ok(rec, `Expected ${pid} in Nov 2026 Markdoc parse`);
    assert.equal(rec.inputPer1M, expIn, `${pid} input`);
    assert.equal(rec.cachedPer1M, expCached, `${pid} cached`);
    assert.equal(rec.outputPer1M, expOut, `${pid} output`);
    assert.equal(rec.longContextTier, expLong, `${pid} longContextTier`);
    assert.equal(rec.longInputMultiplier, expInM, `${pid} longInputMultiplier`);
    assert.equal(rec.longOutputMultiplier, expOutM, `${pid} longOutputMultiplier`);
  }

  const parsedDec = parseGoogleOfficialPricingHtml(markdocSpaHtml, Date.UTC(2026, 11, 1, 0, 0, 0));
  assert.equal(parsedDec.profileRates['gemini-4-carbon'].inputPer1M, 4.0);
  assert.equal(parsedDec.profileRates['gemini-4-carbon'].cachedPer1M, 0.2);
  assert.equal(parsedDec.profileRates['gemini-4-carbon'].outputPer1M, 20.0);
  assert.equal(parsedDec.profileRates['gemini-4-carbon'].longContextTier, false);
  assert.equal(parsedDec.profileRates['gemini-4-argon'].inputPer1M, 4.0);
  assert.equal(parsedDec.profileRates['gemini-4-argon'].cachedPer1M, 0.2);
  assert.equal(parsedDec.profileRates['gemini-4-argon'].outputPer1M, 20.0);
  assert.equal(parsedDec.profileRates['gemini-4-argon'].longContextTier, false);
  assert.equal(parsedDec.profileRates['gemini-4-neon'].inputPer1M, 3.0);
  assert.equal(parsedDec.profileRates['gemini-4-hydrogen'].inputPer1M, 1.5);
  assert.equal(parsedDec.profileRates['gemini-3-8-flash'].inputPer1M, 0.75);
  assert.equal(parsedDec.profileRates['gemini-3-8-flash'].outputPer1M, 3.75);
  assert.equal(parsedDec.profileRates['gemini-nano-banana-2.1'], undefined);
  assert.equal(parsedDec.profileRates['gemma-4'], undefined);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 14:38:50
// Description: Verify prose cross-reference links and non-chat Image/TTS sections emit zero bogus keys.
// ============================================================================
  assert.equal(parsedNov.profileRates['gemini-3.5-flash-lite-rates.'], undefined);
  assert.equal(parsedNov.profileRates['gemini-3-pro-image'], undefined);
  assert.equal(parsedNov.profileRates['gemini-2.5-flash-tts'], undefined);
  assert.equal(parsedDec.profileRates['gemini-3.5-flash-lite-rates.'], undefined);
// ============================================================================
// [MODIFIED END] 2026-11-19 14:38:50
// ============================================================================

  const parsedJan = parseGoogleOfficialPricingHtml(markdocSpaHtml, Date.UTC(2027, 0, 1, 0, 0, 0));
  assert.equal(parsedJan.profileRates['gemini-3-8-flash'].inputPer1M, 1.5);
  assert.equal(parsedJan.profileRates['gemini-3-8-flash'].cachedPer1M, 0.15);
  assert.equal(parsedJan.profileRates['gemini-3-8-flash'].outputPer1M, 7.5);
  assert.equal(parsedJan.profileRates['gemini-3-8-flash'].longContextTier, false);

  // (d) Non-destructive pricing_cache.json schemaVersion: 1 -> 2 Migration
  const root = mkdtempSync(join(tmpdir(), 'tm-v040-cache-v1-v2-'));
  const stateDir = join(root, 'state');
  mkdirSync(stateDir, { recursive: true });
  try {
    const fixedNowMs = Date.now();
    const todayLocal = formatLocalDate(fixedNowMs);
    const legacyGroup = '\u5176\u4ed6\u5728\u5f79\u6a21\u578b';
    const cacheFilePath = join(stateDir, 'pricing_cache.json');
    writeFileSync(
      cacheFilePath,
      JSON.stringify(
        {
          schemaVersion: 1,
          lastSyncLocalDate: todayLocal,
          lastSyncAtMs: fixedNowMs - 60000,
          lastAttemptAtMs: fixedNowMs,
          status: 'ok',
          sources: ['google-official', 'models.dev'],
          error: '',
          usdToCnyRate: 7.1234,
          fxSource: 'frankfurter.dev',
          fxLastSyncLocalDate: todayLocal,
          fxAttemptLocalDate: todayLocal,
          syncedRates: {
            'gemini-4-carbon': {
              inputPer1M: 2.0,
              cachedPer1M: 0.1,
              outputPer1M: 10.0,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
            'gemini-4-argon': {
              inputPer1M: 2.0,
              cachedPer1M: 0.1,
              outputPer1M: 10.0,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
            'gemini-4-neon': {
              inputPer1M: 3.0,
              cachedPer1M: 0.15,
              outputPer1M: 15.0,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
            'gemini-4-hydrogen': {
              inputPer1M: 1.5,
              cachedPer1M: 0.075,
              outputPer1M: 7.5,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
          },
          upstreamPool: {
            'gemini-4-carbon': {
              id: 'gemini-4-carbon',
              label: 'Gemini 4 Carbon',
              group: 'Gemini 系列',
              inputPer1M: 2.0,
              cachedPer1M: 0.1,
              outputPer1M: 10.0,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
            'custom-legacy': {
              id: 'custom-legacy',
              label: 'Custom Legacy',
              group: legacyGroup,
              inputPer1M: 1.2,
              cachedPer1M: 0.12,
              outputPer1M: 4.8,
              longContextTier: false,
              longInputMultiplier: 1.0,
              longOutputMultiplier: 1.0,
            },
          },
          discoveredModels: [],
        },
        null,
        2,
      ),
      'utf-8',
    );

    let syncFetchCalls = 0;
    const mgr = createPricingSyncManager({
      stateDir,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => fixedNowMs,
      autoSyncDisabled: false,
      fetchImpl: async (url) => {
        syncFetchCalls += 1;
        if (url.includes('frankfurter') || url.includes('er-api')) {
          return { ok: true, status: 200, json: async () => ({ rates: { CNY: 7.1234 } }) };
        }
        if (url.includes('models.dev')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              google: {
                models: {
                  'gemini-4-carbon': {
                    id: 'gemini-4-carbon',
                    name: 'Gemini 4 Carbon',
                    cost: { input: 2.0, cache_read: 0.1, output: 10.0 },
                  },
                },
              },
            }),
          };
        }
        if (url.includes('litellm')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        return { ok: true, status: 200, text: async () => markdocSpaHtml };
      },
    });

    assert.equal(mgr.getSyncedCnyRate(), 7.1234);
    assert.equal(mgr.getPublicStatus().usdToCnyRate, 7.1234);
    assert.equal(mgr.getPublicStatus().fxSource, 'frankfurter.dev');

    const migratedCatalog = mgr.getRuntimeCatalog(['custom-legacy']);
    for (const pid of ['gemini-4-carbon', 'gemini-4-argon', 'gemini-4-neon', 'gemini-4-hydrogen']) {
      const entry = migratedCatalog.find((m) => m.id === pid);
      assert.ok(entry, `Expected ${pid} in migrated runtime catalog`);
      assert.equal(entry.longContextTier, false);
      assert.equal(entry.longInputMultiplier, 1.0);
      assert.equal(entry.longOutputMultiplier, 1.0);
    }
    const customLegacy = migratedCatalog.find((m) => m.id === 'custom-legacy');
    assert.ok(customLegacy, 'Expected custom-legacy promoted from migrated upstreamPool');
    assert.equal(customLegacy.group, '其他现役模型');

    // Verify upstreamPool['gemini-4-carbon'] was also sanitized during v1->v2 cache load
    const poolOnlyMgr = createPricingSyncManager({
      stateDir,
      baseCatalog: [MODEL_PRICING_CATALOG.at(-1)],
      nowFn: () => fixedNowMs,
      autoSyncDisabled: true,
    });
    const promotedG4Carbon = poolOnlyMgr
      .getRuntimeCatalog(['gemini-4-carbon'])
      .find((m) => m.id === 'gemini-4-carbon');
    assert.ok(promotedG4Carbon);
    assert.equal(promotedG4Carbon.longContextTier, false);
    assert.equal(promotedG4Carbon.longInputMultiplier, 1.0);
    assert.equal(promotedG4Carbon.longOutputMultiplier, 1.0);

    let syncSettledResolve;
    const syncSettled = new Promise((r) => {
      syncSettledResolve = r;
    });
    const triggeredImmediate = mgr.maybeTriggerDailySync(['custom-legacy'], (res) => {
      syncSettledResolve(res);
    });
    assert.equal(triggeredImmediate, true);
    const syncRes = await syncSettled;
    assert.equal(syncRes.ok, true);
    assert.ok(syncFetchCalls > 0);

    const persistedCache = JSON.parse(readFileSync(cacheFilePath, 'utf-8'));
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:21:36
// Description: Update persisted pricing_cache schemaVersion assertion from 2 to 3
// following CACHE_SCHEMA_VERSION bump for Claude/GPT-OSS cache healing & reseller cleanup.
// ============================================================================
    assert.equal(persistedCache.schemaVersion, 3);
// ============================================================================
// [MODIFIED END] 2026-11-23 10:21:36
// ============================================================================
    assert.equal(persistedCache.lastSyncLocalDate, todayLocal);
    assert.equal(persistedCache.usdToCnyRate, 7.1234);
    assert.equal(persistedCache.syncedRates['gemini-4-carbon'].longContextTier, false);
    assert.equal(persistedCache.syncedRates['gemini-4-carbon'].longInputMultiplier, 1.0);
    assert.equal(persistedCache.syncedRates['gemini-4-carbon'].longOutputMultiplier, 1.0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-19 14:26:51
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:33:24
// Description: Add v0.4.1 regression tests #72 (Side Questions protobuf/SQLite
// discovery, fork-deduped incremental totals, direct side_question inspection,
// Tab 1 & Tab 2 byModel cacheHitRatePct) and #73 (headless VM Side Questions
// card Top-5 fold, one-click open stopPropagation, inspect & back-to-parent,
// Tab 1 & Tab 2 8-col cache hit rate, I18N parity, and static hygiene).
// ============================================================================
test('v0.4.1 Side Questions protobuf/SQLite discovery, fork-deduped incremental totals, direct side_question inspection, and Tab 1 & Tab 2 byModel cacheHitRatePct', () => {
  clearParserCache();

  function encodeRawSummarySideQuestions({ ids17 = [], titled18 = [], includeNoise = true } = {}) {
    const f15Parts = [];
    if (includeNoise) {
      f15Parts.push(encodeVarintField(1, 42));
      f15Parts.push(encodeBytesField(2, 'unrelated-nested-payload'));
    }
    for (const id of ids17) {
      f15Parts.push(encodeBytesField(17, id));
    }
    for (const entry of titled18) {
      const mParts = [];
      if (entry.id !== undefined) mParts.push(encodeBytesField(1, entry.id));
      if (entry.title !== undefined) mParts.push(encodeBytesField(2, entry.title));
      f15Parts.push(encodeBytesField(18, Buffer.concat(mParts)));
    }
    const topParts = [];
    if (includeNoise) {
      topParts.push(encodeBytesField(1, 'Main v0.4.1 Session'));
      topParts.push(encodeVarintField(3, 999));
    }
    topParts.push(encodeBytesField(15, Buffer.concat(f15Parts)));
    return Buffer.concat(topParts);
  }

  // 1. Unit tests for parseRawSummarySideQuestions: valid 15.17 / 15.18, deduping, cleaning, & malformed resilience
  const protoIdA = '04100000-0000-4000-8000-00000000000a';
  const protoIdB = '04100000-0000-4000-8000-00000000000b';
  const protoIdC = '04100000-0000-4000-8000-00000000000c';
  const validRawBuf = encodeRawSummarySideQuestions({
    ids17: [protoIdA, protoIdA.toUpperCase(), '../invalid-id', 'short', protoIdC],
    titled18: [
      { id: protoIdA, title: '  `How does` **cache**   hit\nrate work?  ' },
      { id: protoIdB, title: 'Compare Gemini 4 Hydrogen latency' },
      { id: 'not-valid!', title: 'Should be ignored' },
    ],
  });

  const parsedBuf = parseRawSummarySideQuestions(validRawBuf);
  assert.deepEqual(parsedBuf.sideQuestionIds, [protoIdA, protoIdC, protoIdB]);
  assert.equal(parsedBuf.titlesById.get(protoIdA), 'How does cache hit rate work?');
  assert.equal(parsedBuf.titlesById.get(protoIdB), 'Compare Gemini 4 Hydrogen latency');
  assert.equal(parsedBuf.titlesById.has(protoIdC), false);
  assert.equal(parsedBuf.titlesById.size, 2);

  // Uint8Array & ArrayBuffer inputs behave identically
  const u8View = new Uint8Array(validRawBuf.buffer, validRawBuf.byteOffset, validRawBuf.byteLength);
  const parsedU8 = parseRawSummarySideQuestions(u8View);
  assert.deepEqual(parsedU8.sideQuestionIds, parsedBuf.sideQuestionIds);
  assert.equal(parsedU8.titlesById.get(protoIdA), 'How does cache hit rate work?');
  const exactAb = validRawBuf.buffer.slice(validRawBuf.byteOffset, validRawBuf.byteOffset + validRawBuf.byteLength);
  const parsedAb = parseRawSummarySideQuestions(exactAb);
  assert.deepEqual(parsedAb.sideQuestionIds, parsedBuf.sideQuestionIds);

  // Empty, nullish, malformed, and truncated buffers NEVER throw
  for (const badInput of [
    null,
    undefined,
    Buffer.alloc(0),
    Buffer.from([0x80, 0x80, 0x80]), // truncated varint
    Buffer.from([0x7a, 0x40, 0x01, 0x02]), // field 15 truncated length-delimited
    validRawBuf.subarray(0, Math.max(1, validRawBuf.length - 7)), // truncated mid-15.18
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0x7a, 0x7f, 0x92, 0x01, 0x50]), // garbage wire types/lengths
  ]) {
    let res = null;
    assert.doesNotThrow(() => {
      res = parseRawSummarySideQuestions(badInput);
    });
    assert.ok(Array.isArray(res.sideQuestionIds));
    assert.ok(res.titlesById instanceof Map);
  }

  // 2. Temp appData with conversation_summaries.db + SQLite DBs for mainId, sqA (IDLE), sqB (GENERATING)
  const { root, appData } = makeTempEnv();
  try {
    const convsDir = join(appData, 'conversations');
    mkdirSync(convsDir, { recursive: true });

    const now = new Date();
    const baseMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTime();
    const evalNowMs = baseMs + 300_000;

    const mainId = '04100000-0000-4000-8000-000000000001';
    const sqA = protoIdA;
    const sqB = protoIdB;
    const sqMissing = '04100000-0000-4000-8000-00000000000f';
    const sqATitle = 'How does cache hit rate work?';
    const sqBTitle = 'Compare Gemini 4 Hydrogen latency';

    const mainRawSummary = encodeRawSummarySideQuestions({
      ids17: [sqA, sqA.toUpperCase()],
      titled18: [
        { id: sqA, title: sqATitle },
        { id: sqB, title: sqBTitle },
      ],
    });

    const sumDb = new DatabaseSync(join(appData, 'conversation_summaries.db'));
    sumDb.exec(`
      CREATE TABLE conversation_summaries (
        conversation_id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT "",
        preview TEXT NOT NULL DEFAULT "",
        workspace_uris TEXT NOT NULL DEFAULT "",
        agent_name TEXT NOT NULL DEFAULT "",
        parent_conversation_id TEXT NOT NULL DEFAULT "",
        raw_summary BLOB
      );
      CREATE TABLE conversation_parents (
        conversation_id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL DEFAULT ""
      );
    `);
    sumDb
      .prepare(
        'INSERT INTO conversation_summaries (conversation_id, title, preview, workspace_uris, agent_name, parent_conversation_id, raw_summary) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        mainId,
        'Main v0.4.1 Session',
        'Investigating Side Questions and Cache Hit Rate',
        JSON.stringify(['file:///f%3A/Other%20Items/agy-token-monitor']),
        '',
        '',
        mainRawSummary,
      );
    const insParent = sumDb.prepare(
      'INSERT INTO conversation_parents (conversation_id, parent_id) VALUES (?, ?)',
    );
    insParent.run(sqA, mainId);
    insParent.run(sqB, mainId);
    insParent.run(sqMissing, mainId); // missing DB/transcript -> must be skipped
    insParent.run(mainId, mainId); // self-reference -> must be skipped
    sumDb.close();

    function writeSqTestDb(dbPath, { plannerSpecs = [], extraSteps = [] } = {}) {
      rmSync(dbPath, { force: true });
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB, size INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, metadata BLOB);
      `);
      const insGen = db.prepare('INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, ?)');
      const insStep = db.prepare(
        'INSERT INTO steps (idx, step_type, status, metadata) VALUES (?, ?, ?, ?)',
      );

      for (const extra of extraSteps) {
        const metaBuf = encodeBytesField(1, encodeTimestampMs(extra.createdMs));
        insStep.run(extra.stepIdx, extra.stepType ?? 14, extra.status ?? 3, metaBuf);
      }

      plannerSpecs.forEach((spec, genIdx) => {
        const usageBuf = encodeTokenUsage({
          enumId: spec.enumId,
          input: spec.input,
          cacheRead: spec.cacheRead,
          output: spec.output,
          botId: spec.botId,
        });
        const genInnerParts = [
          encodeBytesField(4, usageBuf),
          encodeBytesField(19, spec.rawModel),
          encodeBytesField(21, spec.displayModel),
        ];
        if (spec.originCascadeId) {
          genInnerParts.push(encodeBytesField(20, encodeGenKv('cascade_id', spec.originCascadeId)));
        }
        const genTop = Buffer.concat([
          encodeBytesField(1, Buffer.concat(genInnerParts)),
          encodeBytesField(2, encodeVarint(spec.stepIdx)),
        ]);
        insGen.run(genIdx, genTop, genTop.length);

        const metaBuf = Buffer.concat([
          encodeBytesField(1, encodeTimestampMs(spec.createdMs)),
          encodeBytesField(7, encodeTimestampMs(spec.createdMs + (spec.durationMs || 2000))),
          encodeBytesField(9, usageBuf),
          encodeBytesField(
            20,
            encodeStepField20({
              stepIdx: spec.stepIdx,
              genIdx,
              originCascadeId: spec.originCascadeId || '',
            }),
          ),
        ]);
        insStep.run(spec.stepIdx, 15, spec.status ?? 3, metaBuf);
      });
      db.close();
    }

    const parentClonedSpecs = [
      {
        stepIdx: 1,
        originCascadeId: mainId,
        botId: 'v041-main-bot-1',
        enumId: 1427,
        rawModel: 'gemini-4-carbon-high',
        displayModel: 'Gemini 4 Carbon (High)',
        input: 20_000,
        cacheRead: 80_000, // 80% high cache hit
        output: 2_000,
        createdMs: baseMs + 1_000,
        durationMs: 2_000,
      },
      {
        stepIdx: 3,
        originCascadeId: mainId,
        botId: 'v041-main-bot-2',
        enumId: 1525,
        rawModel: 'gemini-4-hydrogen-low',
        displayModel: 'Gemini 4 Hydrogen (Low)',
        input: 30_000,
        cacheRead: 10_000, // 25% low cache hit
        output: 1_000,
        createdMs: baseMs + 5_000,
        durationMs: 2_000,
      },
    ];

    // Main parent conversation DB: high cache hit (Carbon 80%), low cache hit (Hydrogen 25%), zero-input edge case (Claude Opus 5.5 0%)
    writeSqTestDb(join(convsDir, `${mainId}.db`), {
      extraSteps: [{ stepIdx: 0, stepType: 14, status: 3, createdMs: baseMs }],
      plannerSpecs: [
        ...parentClonedSpecs,
        {
          stepIdx: 5,
          originCascadeId: mainId,
          botId: 'v041-main-bot-3',
          enumId: 1402,
          rawModel: 'claude-opus-5-5-high',
          displayModel: 'Claude Opus 5.5 (High)',
          input: 0,
          cacheRead: 0, // zero-input edge case -> cacheHitRatePct === 0
          output: 500,
          createdMs: baseMs + 9_000,
          durationMs: 1_000,
        },
      ],
    });

    // Side Question A (IDLE, older): cloned parent steps + own Gemini 4 Carbon step (5k in, 15k cache, 1k out -> 75% hit, $0.0215)
    const sqADbPath = join(convsDir, `${sqA}.db`);
    const sqAOwnStep = {
      stepIdx: 5,
      originCascadeId: sqA,
      botId: 'v041-sqA-bot-1',
      enumId: 1427,
      rawModel: 'gemini-4-carbon-high',
      displayModel: 'Gemini 4 Carbon (High)',
      input: 5_000,
      cacheRead: 15_000,
      output: 1_000,
      createdMs: baseMs + 60_000,
      durationMs: 2_000,
    };
    writeSqTestDb(sqADbPath, {
      plannerSpecs: [...parentClonedSpecs, sqAOwnStep],
    });

    // Side Question B (GENERATING, newer): cloned parent steps + own Gemini 4 Hydrogen step (30k in, 10k cache, 2k out -> 25% hit, $0.06075) + active USER_INPUT
    const sqBDbPath = join(convsDir, `${sqB}.db`);
    writeSqTestDb(sqBDbPath, {
      plannerSpecs: [
        ...parentClonedSpecs,
        {
          stepIdx: 5,
          originCascadeId: sqB,
          botId: 'v041-sqB-bot-1',
          enumId: 1525,
          rawModel: 'gemini-4-hydrogen-medium',
          displayModel: 'Gemini 4 Hydrogen (Medium)',
          input: 30_000,
          cacheRead: 10_000,
          output: 2_000,
          createdMs: baseMs + 120_000,
          durationMs: 3_000,
        },
      ],
      extraSteps: [{ stepIdx: 6, stepType: 14, status: 3, createdMs: baseMs + 125_000 }],
    });

    // 3. Assert analyzeConversation(mainId)
    const mainRes = analyzeConversation(mainId, { appDataDirs: [appData], disableAgentApi: true });
    assert.ok(mainRes, 'analyzeConversation(mainId) must succeed');
    assert.equal(mainRes.isChildSession, false);
    assert.equal(mainRes.childKind, null);

    // Side Questions discovery, ordering (sqB GENERATING ahead of sqA IDLE), titles, models, non-cloned timestamps, fork-deduped incremental totals
    assert.equal(mainRes.sideQuestions.length, 2);
    const [firstSq, secondSq] = mainRes.sideQuestions;
    assert.equal(firstSq.conversationId, sqB);
    assert.equal(firstSq.status, 'GENERATING');
    assert.equal(firstSq.generatingSinceMs, baseMs + 125_000);
    assert.equal(firstSq.title, sqBTitle);
    assert.equal(firstSq.model, 'Gemini 4 Hydrogen');
    assert.equal(firstSq.stepsCount, 1);
    assert.equal(firstSq.inputUncachedTokens, 30_000);
    assert.equal(firstSq.cacheReadTokens, 10_000);
    assert.equal(firstSq.outputTokens, 2_000);
    assert.equal(firstSq.totalTokens, 42_000);
    assert.ok(Math.abs(firstSq.cacheHitRatePct - 25) < 1e-9);
    assert.ok(Math.abs(firstSq.costActual - 0.06075) < 1e-9);
    assert.equal(firstSq.createdAtMs, baseMs + 120_000);
    assert.equal(firstSq.updatedAtMs, baseMs + 125_000);

    assert.equal(secondSq.conversationId, sqA);
    assert.equal(secondSq.status, 'IDLE');
    assert.equal(secondSq.title, sqATitle);
    assert.equal(secondSq.model, 'Gemini 4 Carbon');
    assert.equal(secondSq.stepsCount, 1);
    assert.equal(secondSq.inputUncachedTokens, 5_000);
    assert.equal(secondSq.cacheReadTokens, 15_000);
    assert.equal(secondSq.outputTokens, 1_000);
    assert.equal(secondSq.totalTokens, 21_000);
    assert.ok(Math.abs(secondSq.cacheHitRatePct - 75) < 1e-9);
    assert.ok(Math.abs(secondSq.costActual - 0.0215) < 1e-9);
    assert.equal(secondSq.createdAtMs, baseMs + 60_000);
    assert.equal(secondSq.updatedAtMs, baseMs + 62_000);

    // Weighted sideQuestionsTotals (25,000 / 60,000 = 41.6666...%, NOT naive 50% average)
    assert.equal(mainRes.sideQuestionsTotals.count, 2);
    assert.equal(mainRes.sideQuestionsTotals.stepsCount, 2);
    assert.equal(mainRes.sideQuestionsTotals.inputUncachedTokens, 35_000);
    assert.equal(mainRes.sideQuestionsTotals.cacheReadTokens, 25_000);
    assert.equal(mainRes.sideQuestionsTotals.outputTokens, 3_000);
    assert.equal(mainRes.sideQuestionsTotals.totalTokens, 63_000);
    assert.ok(Math.abs(mainRes.sideQuestionsTotals.costActual - 0.08225) < 1e-9);
    assert.ok(Math.abs(mainRes.sideQuestionsTotals.cacheHitRatePct - (25_000 / 60_000) * 100) < 1e-9);

    // Main totals.withChildren, totals.byModel, totals.mainOnlyByModel, and receipt are 100% isolated from sqA/sqB
    assert.equal(mainRes.totals.withChildren.stepsCount, 3);
    assert.equal(mainRes.totals.withChildren.inputUncachedTokens, 50_000);
    assert.equal(mainRes.totals.withChildren.cacheReadTokens, 90_000);
    assert.equal(mainRes.totals.withChildren.outputTokens, 3_500);
    assert.equal(mainRes.totals.withChildren.totalTokens, 143_500);
    assert.ok(Math.abs(mainRes.totals.withChildren.costActual - 0.13125) < 1e-9);
    assert.equal(mainRes.receipt.all.grandTotal.stepsCount, 3);
    assert.equal(mainRes.receipt.all.grandTotal.totalTokens, 143_500);
    assert.ok(Math.abs(mainRes.receipt.all.grandTotal.costActual - 0.13125) < 1e-9);

    // Tab 1 totals.byModel & totals.mainOnlyByModel expose accurate cacheHitRatePct (incl. 0 for zero-input edge case)
    for (const modelList of [mainRes.totals.byModel, mainRes.totals.mainOnlyByModel]) {
      assert.equal(modelList.length, 3);
      const carbonRow = modelList.find((r) => r.profileId === 'gemini-4-carbon');
      const hydroRow = modelList.find((r) => r.profileId === 'gemini-4-hydrogen');
      const opusRow = modelList.find((r) => r.profileId === 'claude-opus-5-5');
      assert.ok(carbonRow && hydroRow && opusRow);
      assert.equal(carbonRow.totalTokens, 102_000); // isolated from sqA's 21k Carbon tokens
      assert.ok(Math.abs(carbonRow.cacheHitRatePct - 80) < 1e-9);
      assert.equal(hydroRow.totalTokens, 41_000); // isolated from sqB's 42k Hydrogen tokens
      assert.ok(Math.abs(hydroRow.cacheHitRatePct - 25) < 1e-9);
      assert.equal(opusRow.inputUncachedTokens, 0);
      assert.equal(opusRow.cacheReadTokens, 0);
      assert.equal(opusRow.outputTokens, 500);
      assert.equal(opusRow.cacheHitRatePct, 0);
    }

    // _etagPart includes both Side Question IDs, cache keys & official titles; _activeWatchIds contains sqA & sqB
    assert.equal(mainRes._etagPart.includes(`${sqA}:`), true);
    assert.equal(mainRes._etagPart.includes(`${sqB}:`), true);
    assert.equal(mainRes._etagPart.includes(`t:${sqATitle}`), true);
    assert.equal(mainRes._etagPart.includes(`t:${sqBTitle}`), true);
    assert.equal(mainRes._activeWatchIds.includes(mainId), true);
    assert.equal(mainRes._activeWatchIds.includes(sqA), true);
    assert.equal(mainRes._activeWatchIds.includes(sqB), true);

    // 4. Assert direct Side Question inspection: analyzeConversation(sqA)
    const sqARes = analyzeConversation(sqA, { appDataDirs: [appData], disableAgentApi: true });
    assert.ok(sqARes, 'analyzeConversation(sqA) must succeed');
    assert.equal(sqARes.isChildSession, true);
    assert.equal(sqARes.childKind, 'side_question');
    assert.equal(sqARes.parentConversationId, mainId);
    assert.equal(sqARes.title, sqATitle);
    assert.equal(sqARes.totals.mainOnly.stepsCount, 1);
    assert.equal(sqARes.totals.mainOnly.totalTokens, 21_000);
    assert.ok(Math.abs(sqARes.totals.mainOnlyByModel[0].cacheHitRatePct - 75) < 1e-9);

    // 5. Assert summarizeGlobalAndRecent Tab 2 periods.*.byModel expose accurate cacheHitRatePct
    const globalRes = summarizeGlobalAndRecent({ appDataDirs: [appData], nowMs: evalNowMs });
    for (const periodKey of ['today', '7d', '30d', 'all']) {
      const pByModel = globalRes.periods[periodKey]?.byModel || [];
      const gCarbon = pByModel.find((r) => r.profileId === 'gemini-4-carbon');
      const gHydro = pByModel.find((r) => r.profileId === 'gemini-4-hydrogen');
      const gOpus = pByModel.find((r) => r.profileId === 'claude-opus-5-5');
      assert.ok(gCarbon && gHydro && gOpus, `Period ${periodKey} must contain all 3 models`);
      // Carbon: main (20k in, 80k cache) + sqA (5k in, 15k cache) => 95k / 120k = 79.16666...%
      assert.equal(gCarbon.inputTokens, 25_000);
      assert.equal(gCarbon.cacheReadTokens, 95_000);
      assert.ok(Math.abs(gCarbon.cacheHitRatePct - (95_000 / 120_000) * 100) < 1e-9);
      // Hydrogen: main (30k in, 10k cache) + sqB (30k in, 10k cache) => 20k / 80k = 25%
      assert.equal(gHydro.inputTokens, 60_000);
      assert.equal(gHydro.cacheReadTokens, 20_000);
      assert.ok(Math.abs(gHydro.cacheHitRatePct - 25) < 1e-9);
      // Claude Opus 5.5: zero input -> 0%
      assert.equal(gOpus.inputTokens, 0);
      assert.equal(gOpus.cacheReadTokens, 0);
      assert.equal(gOpus.cacheHitRatePct, 0);
    }

    // 6. Verify second-prong matching botId deduplication (even without originCascadeId) & _etagPart invalidation
    const prevEtagPart = mainRes._etagPart;
    writeSqTestDb(sqADbPath, {
      plannerSpecs: [
        parentClonedSpecs[0],
        {
          ...parentClonedSpecs[1],
          originCascadeId: '', // omit originCascadeId; must still dedupe via matching mainSeenBotIds botId!
        },
        sqAOwnStep,
      ],
    });
    const bumpSec = (evalNowMs + 10_000) / 1000;
    utimesSync(sqADbPath, bumpSec, bumpSec);

    const mainResAfter = analyzeConversation(mainId, { appDataDirs: [appData], disableAgentApi: true });
    assert.notEqual(mainResAfter._etagPart, prevEtagPart, 'Mutating sqA DB must invalidate parent _etagPart');
    const sqAAfter = mainResAfter.sideQuestions.find((sq) => sq.conversationId === sqA);
    assert.equal(sqAAfter.stepsCount, 1);
    assert.equal(sqAAfter.totalTokens, 21_000);
    assert.ok(Math.abs(sqAAfter.cacheHitRatePct - 75) < 1e-9);
    assert.ok(Math.abs(sqAAfter.costActual - 0.0215) < 1e-9);
  } finally {
    clearParserCache();
    rmSync(root, { recursive: true, force: true });
  }
});

test('v0.4.1 headless VM Side Questions card (Top-5 fold, one-click open stopPropagation, inspect & back-to-parent), Tab 1 & Tab 2 8-col cache hit rate, I18N parity, and static hygiene', async () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');

  const indexHtml = readFileSync(join(paneDir, 'index.html'), 'utf-8');
  const stylesCss = readFileSync(join(paneDir, 'styles.css'), 'utf-8');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const receiptSource = readFileSync(join(paneDir, 'receipt.js'), 'utf-8');
  const pixelOfficeSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');
  const parserSource = readFileSync(join(paneDir, 'parser.mjs'), 'utf-8');
  const mainSource = readFileSync(join(paneDir, 'main.mjs'), 'utf-8');
  const releaseUpdaterSource = readFileSync(join(paneDir, 'release_updater.mjs'), 'utf-8');
  const pricingSyncSource = readFileSync(join(paneDir, 'pricing_sync.mjs'), 'utf-8');
  const netProxySource = readFileSync(join(paneDir, 'net_proxy.mjs'), 'utf-8');
  const clipboardImageSource = readFileSync(join(paneDir, 'clipboard_image.mjs'), 'utf-8');
  const syncPluginPs1 = readFileSync(join(repoRoot, 'scripts', 'sync-plugin.ps1'), 'utf-8');
  const readmeMd = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  const skillMd = readFileSync(join(repoRoot, 'skills', 'token-monitor', 'SKILL.md'), 'utf-8');
  const pluginJsonRaw = readFileSync(join(repoRoot, 'plugin.json'), 'utf-8');
  const packageJsonRaw = readFileSync(join(paneDir, 'package.json'), 'utf-8');
  const sidecarJsonRaw = readFileSync(join(paneDir, 'sidecar.json'), 'utf-8');
  const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');

  // ---------------- Part A: Headless Node VM Mock DOM ----------------
  const iifeCloseIdx = appSource.lastIndexOf('})();');
  assert.ok(iifeCloseIdx > 0, 'app.js must end with IIFE closing })();');

  const instrumentedApp =
    appSource.slice(0, iifeCloseIdx) +
    `\n  globalThis.__tmV041Exports = {\n` +
    `    state,\n` +
    `    t,\n` +
    `    init,\n` +
    `    getCurrentAppVersion,\n` +
    `    getModelRowCacheHitMeta,\n` +
    `    renderHeader,\n` +
    `    renderCurrentTab,\n` +
    `    renderCostCard,\n` +
    `    renderChildrenAndModelsCard,\n` +
    `    renderSideQuestionsCard,\n` +
    `    renderGlobalTab,\n` +
    `    selectConversation,\n` +
    `    setActiveTab,\n` +
    `  };\n` +
    appSource.slice(iifeCloseIdx);

  class FakeNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
    }
  }
  class FakeTextNode extends FakeNode {
    constructor(text) {
      super();
      this.nodeType = 3;
      this._text = String(text ?? '');
    }
    get textContent() {
      return this._text;
    }
    set textContent(v) {
      this._text = String(v ?? '');
    }
  }
  function matchesAtomSelector(elNode, atom) {
    const s = atom.trim();
    if (!s) return false;
    if (s.startsWith('#')) return elNode.getAttribute('id') === s.slice(1);
    if (s.startsWith('.')) {
      return s.slice(1).split('.').filter(Boolean).every((cls) => elNode.classList.contains(cls));
    }
    const dotParts = s.split('.');
    const tagPart = dotParts[0].toUpperCase();
    if (tagPart && elNode.tagName !== tagPart) return false;
    return dotParts.slice(1).every((cls) => elNode.classList.contains(cls));
  }
  function matchesDescendantSelector(elNode, selector, rootScope) {
    const parts = selector.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return false;
    if (!matchesAtomSelector(elNode, parts[parts.length - 1])) return false;
    let partIdx = parts.length - 2;
    let cur = elNode.parentNode;
    while (partIdx >= 0 && cur && cur !== rootScope) {
      if (cur instanceof FakeElement && matchesAtomSelector(cur, parts[partIdx])) {
        partIdx -= 1;
      }
      cur = cur.parentNode;
    }
    return partIdx < 0;
  }
  class FakeElement extends FakeNode {
    constructor(tagName, namespaceURI = 'http://www.w3.org/1999/xhtml') {
      super();
      this.nodeType = 1;
      this.tagName = String(tagName || 'div').toUpperCase();
      this.namespaceURI = namespaceURI;
      this._classSet = new Set();
      this.attributes = new Map();
      this.listeners = new Map();
      this.dataset = {};
      this.title = '';
      this.type = '';
      this.role = '';
      this.value = '';
      this.disabled = false;
      this.checked = false;
      this.scrollTop = 0;
      this.width = 0;
      this.height = 0;
      this.clientWidth = 380;
      this._ctx2d = null;
      this.style = {
        cssText: '',
        setProperty(name, val) {
          this[name] = String(val);
        },
        getPropertyValue(name) {
          return this[name] ?? '';
        },
      };
      this.classList = {
        add: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.add(part);
            }
          }
        },
        remove: (...tokens) => {
          for (const tok of tokens) {
            for (const part of String(tok || '').trim().split(/\s+/)) {
              if (part) this._classSet.delete(part);
            }
          }
        },
        contains: (tok) => this._classSet.has(String(tok || '')),
        toggle: (tok, force) => {
          const key = String(tok || '');
          const shouldAdd = force === undefined ? !this._classSet.has(key) : Boolean(force);
          if (shouldAdd) this._classSet.add(key);
          else this._classSet.delete(key);
          return shouldAdd;
        },
      };
    }
    get className() {
      return [...this._classSet].join(' ');
    }
    set className(val) {
      this._classSet.clear();
      for (const part of String(val || '').trim().split(/\s+/)) {
        if (part) this._classSet.add(part);
      }
    }
    get children() {
      return this.childNodes.filter((n) => n instanceof FakeElement);
    }
    get childElementCount() {
      return this.children.length;
    }
    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(val) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      const str = val === null || val === undefined ? '' : String(val);
      if (str !== '') this.appendChild(new FakeTextNode(str));
    }
    setAttribute(name, val) {
      const k = String(name);
      const v = String(val);
      if (k === 'class') {
        this.className = v;
        return;
      }
      if (k === 'title') this.title = v;
      this.attributes.set(k, v);
    }
    getAttribute(name) {
      const k = String(name);
      if (k === 'class') return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(name) {
      return name === 'class' ? this._classSet.size > 0 : this.attributes.has(String(name));
    }
    removeAttribute(name) {
      if (name === 'class') this.className = '';
      else this.attributes.delete(String(name));
    }
    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.childNodes.indexOf(child);
        if (idx >= 0) child.parentNode.childNodes.splice(idx, 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.childNodes.indexOf(this);
        if (idx >= 0) this.parentNode.childNodes.splice(idx, 1);
        this.parentNode = null;
      }
    }
    replaceChildren(...nodes) {
      for (const c of this.childNodes) c.parentNode = null;
      this.childNodes = [];
      for (const n of nodes) {
        if (n === null || n === undefined) continue;
        this.appendChild(typeof n === 'string' ? new FakeTextNode(n) : n);
      }
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent(type, extraProps = {}) {
      let stopped = false;
      let prevented = false;
      const evt = {
        type,
        target: this,
        currentTarget: this,
        preventDefault() {
          prevented = true;
        },
        stopPropagation() {
          stopped = true;
        },
        get defaultPrevented() {
          return prevented;
        },
        get propagationStopped() {
          return stopped;
        },
        ...extraProps,
      };
      let cur = this;
      while (cur) {
        evt.currentTarget = cur;
        for (const fn of cur.listeners?.get(type) || []) {
          fn(evt);
        }
        if (stopped) break;
        cur = cur.parentNode;
      }
      return evt;
    }
    click(extraProps = {}) {
      return this.dispatchEvent('click', extraProps);
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.clientWidth || 380, height: 180 };
    }
    scrollIntoView() {}
    querySelectorAll(selector) {
      const out = [];
      const visit = (node) => {
        for (const ch of node.children) {
          if (matchesDescendantSelector(ch, selector, this)) out.push(ch);
          visit(ch);
        }
      };
      visit(this);
      return out;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    getContext(kind) {
      if (this.tagName !== 'CANVAS' || kind !== '2d') return null;
      if (!this._ctx2d) {
        this._ctx2d = {
          font: '',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          textAlign: 'left',
          textBaseline: 'alphabetic',
          imageSmoothingEnabled: true,
          setTransform() {},
          save() {},
          restore() {},
          scale() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          stroke() {},
          fillRect() {},
          strokeRect() {},
          setLineDash() {},
          createLinearGradient() {
            return { addColorStop() {} };
          },
          measureText(str) {
            return { width: String(str || '').length * 6.5 };
          },
          fillText() {},
          drawImage() {},
        };
      }
      return this._ctx2d;
    }
  }

  const elementsById = new Map();
  const rootHtml = new FakeElement('html');
  const rootBody = new FakeElement('body');
  rootHtml.appendChild(rootBody);
  const fakeDocument = {
    readyState: 'loading',
    hidden: false,
    documentElement: rootHtml,
    body: rootBody,
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeTextNode(text),
    getElementById(id) {
      const k = String(id);
      if (!elementsById.has(k)) {
        const node = new FakeElement(k.includes('card') ? 'article' : 'div');
        node.setAttribute('id', k);
        rootBody.appendChild(node);
        elementsById.set(k, node);
      }
      return elementsById.get(k);
    },
    querySelectorAll: () => [],
    addEventListener() {},
  };

  const mainId = '04110000-0000-4000-8000-000000000001';
  const sqIds = Array.from({ length: 6 }, (_, i) => `04110000-0000-4000-8000-00000000001${i + 1}`);
  const toggledConversations = [];
  const fetchedConvs = [];
  const snapByConv = new Map();

  const sandbox = {
    Node: FakeNode,
    document: fakeDocument,
    innerWidth: 420,
    devicePixelRatio: 2,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    sidecar: {
      conversationId: mainId,
      ui: {
        toggleConversation(convId) {
          toggledConversations.push(convId);
        },
      },
    },
    location: { reload: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: () => ({ color: 'rgb(246, 247, 249)', getPropertyValue: () => '#f6f7f9' }),
    AbortController,
    Blob,
    Buffer,
    Uint8Array,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    JSON,
    Promise,
    performance,
    URLSearchParams,
    Intl,
    fetch: async (url) => {
      const parsedUrl = new URL(String(url), 'http://127.0.0.1');
      if (parsedUrl.pathname === '/api/snapshot') {
        const requestedConv = parsedUrl.searchParams.get('conv') || '';
        fetchedConvs.push(requestedConv);
        const mockSnap = snapByConv.get(requestedConv);
        return { ok: true, status: 200, json: async () => mockSnap || { unchanged: true } };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    requestAnimationFrame: (cb) => {
      cb();
      return 1;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  fakeDocument.defaultView = sandbox;

  vm.runInNewContext(receiptSource, sandbox);
  vm.runInNewContext(pixelOfficeSource, sandbox);
  vm.runInNewContext(instrumentedApp, sandbox);

  const exports = sandbox.__tmV041Exports;
  assert.ok(exports, 'VM execution must expose __tmV041Exports');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump v0.4.1 VM getCurrentAppVersion fallback assertion to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump v0.4.1 VM getCurrentAppVersion fallback assertion to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump v0.4.1 VM getCurrentAppVersion fallback assertion from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(exports.getCurrentAppVersion(), '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================

  exports.init();
  await new Promise((r) => setImmediate(r));
  fetchedConvs.length = 0;

  const modelRows4 = [
    {
      model: 'Gemini 4 Carbon',
      profileId: 'gemini-4-carbon',
      profileLabel: 'Gemini 4 Carbon',
      rawModels: ['gemini-4-carbon'],
      rateDisplay: 'USD 2.00 / 0.10 / 10.00',
      stepsCount: 4,
      conversationsCount: 2,
      inputUncachedTokens: 10_000,
      inputTokens: 10_000,
      cacheReadTokens: 90_000,
      outputTokens: 2_000,
      totalTokens: 102_000,
      cacheHitRatePct: 90,
      costActual: 0.049,
    },
    {
      model: 'Gemini 4 Neon',
      profileId: 'gemini-4-neon',
      profileLabel: 'Gemini 4 Neon',
      rawModels: ['gemini-4-neon'],
      rateDisplay: 'USD 3.00 / 0.15 / 15.00',
      stepsCount: 3,
      conversationsCount: 1,
      inputUncachedTokens: 45_000,
      inputTokens: 45_000,
      cacheReadTokens: 55_000,
      outputTokens: 1_500,
      totalTokens: 101_500,
      cacheHitRatePct: 55,
      costActual: 0.16575,
    },
    {
      model: 'Gemini 4 Hydrogen',
      profileId: 'gemini-4-hydrogen',
      profileLabel: 'Gemini 4 Hydrogen',
      rawModels: ['gemini-4-hydrogen'],
      rateDisplay: 'USD 1.50 / 0.075 / 7.50',
      stepsCount: 2,
      conversationsCount: 1,
      inputUncachedTokens: 80_000,
      inputTokens: 80_000,
      cacheReadTokens: 20_000,
      outputTokens: 1_000,
      totalTokens: 101_000,
      cacheHitRatePct: 20,
      costActual: 0.129,
    },
    {
      model: 'Claude Opus 5.5',
      profileId: 'claude-opus-5-5',
      profileLabel: 'Claude Opus 5.5',
      rawModels: ['claude-opus-5-5'],
      rateDisplay: 'USD 4.00 / 0.20 / 20.00',
      stepsCount: 1,
      conversationsCount: 1,
      inputUncachedTokens: 0,
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 500,
      totalTokens: 500,
      cacheHitRatePct: 0,
      costActual: 0.01,
    },
  ];
  // Sorted descending by costActual: Neon (55%, mid) -> Hydrogen (20%, low) -> Carbon (90%, high) -> Opus (0%, none)

  const makeMainSnap = (sideQuestions, sideQuestionsTotals) => ({
    appVersion: '0.4.1',
    prefs: { ...DEFAULT_PREFS, currency: 'USD', language: 'zh', pixelOfficeCollapsed: true },
    pricingCatalog: MODEL_PRICING_CATALOG,
    current: {
      conversationId: mainId,
      title: 'Main Session v0.4.1',
      activeModel: 'gemini-4-carbon',
      activeModelLabel: 'Gemini 4 Carbon',
      activeRawModel: 'gemini-4-carbon',
      isChildSession: false,
      childKind: null,
      parentConversationId: '',
      status: 'IDLE',
      speed: { latestStepTokPerSec: 85, weightedAvgTokPerSec: 80, peakTokPerSec: 95, recentSteps: [] },
      context: { currentTotal: 100_000, usageLevel: 'HEALTHY', softLimit: 409_600, hardLimit: 512_000 },
      cache: { hitRatePct: 75, cacheReadTokens: 75_000, inputUncachedTokens: 25_000, spikes: [] },
      totals: {
        mainOnly: { totalTokens: 305_000, outputTokens: 5_000, costActual: 0.35375, stepsCount: 10 },
        withChildren: { totalTokens: 305_000, outputTokens: 5_000, costActual: 0.35375, stepsCount: 10 },
        byModel: modelRows4,
        mainOnlyByModel: modelRows4,
      },
      children: [],
      sideQuestions,
      sideQuestionsTotals,
    },
    global: {
      todayDate: '2026-11-19',
      periods: {
        today: {
          rangeKey: 'today',
          startDate: '2026-11-19',
          endDate: '2026-11-19',
          spanDaysCount: 1,
          activeDaysCount: 1,
          conversationsCount: 4,
          archivedConversationsCount: 0,
          stepsCount: 10,
          inputTokens: 135_000,
          cacheReadTokens: 165_000,
          outputTokens: 5_000,
          totalTokens: 305_000,
          cacheHitRatePct: 55,
          costActual: 0.35375,
          avgDailyCost: 0.35375,
          avgDailyTokens: 305_000,
          trendGranularity: 'hour',
          series: [],
          byModel: modelRows4,
          topConversations: [],
          subscription: null,
        },
      },
      recentConversations: [],
    },
  });

  // 1. Zero Side Questions -> #card-side-questions has .hidden and empty content
  const emptySqSnap = makeMainSnap([], {
    count: 0,
    stepsCount: 0,
    inputUncachedTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheHitRatePct: 0,
    costActual: 0,
  });
  exports.state.homeConvId = mainId;
  exports.state.lang = 'zh';
  exports.state.snapshot = emptySqSnap;
  exports.renderHeader(emptySqSnap);
  exports.renderCurrentTab(emptySqSnap);

  const sqCard = fakeDocument.getElementById('card-side-questions');
  assert.equal(sqCard.classList.contains('hidden'), true);
  assert.equal(sqCard.childElementCount, 0);
  assert.equal(sqCard.textContent, '');
  assert.equal(fakeDocument.getElementById('conv-kind-badge').classList.contains('hidden'), true);

  // 2. 6 Side Questions -> Top-5 fold, expand/collapse, one-click open stopPropagation, row inspect
  const nowMs = Date.now();
  const sixSideQuestions = sqIds.map((sqId, idx) => ({
    conversationId: sqId,
    title: `Side Question #${idx + 1}`,
    model: idx % 2 === 0 ? 'Gemini 4 Carbon' : 'Gemini 4 Hydrogen',
    rawModel: idx % 2 === 0 ? 'gemini-4-carbon' : 'gemini-4-hydrogen',
    status: idx === 0 ? 'GENERATING' : 'IDLE',
    generatingSinceMs: idx === 0 ? nowMs - 4000 : null,
    stepsCount: idx + 1,
    inputUncachedTokens: 4_000,
    cacheReadTokens: 16_000,
    outputTokens: 1_000,
    totalTokens: 21_000,
    cacheHitRatePct: 80,
    costActual: 0.02,
    updatedAtMs: nowMs - idx * 5_000,
    createdAtMs: nowMs - (idx + 1) * 10_000,
  }));
  const sixTotals = {
    count: 6,
    stepsCount: 21,
    inputUncachedTokens: 24_000,
    cacheReadTokens: 96_000,
    outputTokens: 6_000,
    totalTokens: 126_000,
    cacheHitRatePct: 80,
    costActual: 0.12,
  };
  const sixSqSnap = makeMainSnap(sixSideQuestions, sixTotals);
  const sqDirectSnap = {
    appVersion: '0.4.1',
    prefs: { ...DEFAULT_PREFS, currency: 'USD', language: 'zh', pixelOfficeCollapsed: true },
    pricingCatalog: MODEL_PRICING_CATALOG,
    current: {
      conversationId: sqIds[0],
      title: 'Side Question #1',
      activeModel: 'gemini-4-carbon',
      activeModelLabel: 'Gemini 4 Carbon',
      activeRawModel: 'gemini-4-carbon',
      isChildSession: true,
      childKind: 'side_question',
      parentConversationId: mainId,
      status: 'IDLE',
      speed: { latestStepTokPerSec: 70, weightedAvgTokPerSec: 70, peakTokPerSec: 70, recentSteps: [] },
      context: { currentTotal: 20_000, usageLevel: 'HEALTHY', softLimit: 409_600, hardLimit: 512_000 },
      cache: { hitRatePct: 80, cacheReadTokens: 16_000, inputUncachedTokens: 4_000, spikes: [] },
      totals: {
        mainOnly: { totalTokens: 21_000, outputTokens: 1_000, costActual: 0.02, stepsCount: 1 },
        withChildren: { totalTokens: 21_000, outputTokens: 1_000, costActual: 0.02, stepsCount: 1 },
        byModel: [modelRows4[0]],
        mainOnlyByModel: [modelRows4[0]],
      },
      children: [],
      sideQuestions: [],
      sideQuestionsTotals: {
        count: 0,
        stepsCount: 0,
        inputUncachedTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheHitRatePct: 0,
        costActual: 0,
      },
    },
  };
  snapByConv.set(mainId, sixSqSnap);
  snapByConv.set(sqIds[0], sqDirectSnap);

  exports.state.snapshot = sixSqSnap;
  exports.renderHeader(sixSqSnap);
  exports.renderCurrentTab(sixSqSnap);

  assert.equal(sqCard.classList.contains('hidden'), false);
  assert.equal(sqCard.querySelectorAll('.side-q-row').length, 5, 'Collapsed Side Questions must show Top-5');
  assert.equal(sqCard.querySelector('.side-questions-list.is-expanded'), null);
  const headerToggleBtn = sqCard.querySelector('.side-questions-head-right .mini-btn');
  const footerToggleBtn = sqCard.querySelector('.children-toggle-bar');
  assert.equal(headerToggleBtn?.textContent, '展开全部 (6)');
  assert.equal(footerToggleBtn?.textContent, '展开其余 1 条支线（共 6 条）');

  // Expand to all 6 with .is-expanded, preserve scrollTop, then collapse cleanly back to Top-5
  headerToggleBtn.click();
  const expandedList = sqCard.querySelector('.side-questions-list.is-expanded');
  assert.ok(expandedList, 'Expanded Side Questions list must carry .is-expanded');
  assert.equal(sqCard.querySelectorAll('.side-q-row').length, 6);
  assert.equal(sqCard.querySelector('.side-questions-head-right .mini-btn')?.textContent, '收起');
  assert.equal(sqCard.querySelector('.children-toggle-bar')?.textContent, '收起至最近活跃 Top 5');
  expandedList.scrollTop = 128;
  expandedList.dispatchEvent('scroll');
  assert.equal(exports.state.sideQuestionsScrollTop, 128);

  sqCard.querySelector('.children-toggle-bar').click();
  assert.equal(sqCard.querySelectorAll('.side-q-row').length, 5);
  assert.equal(sqCard.querySelector('.side-questions-list.is-expanded'), null);
  assert.equal(exports.state.sideQuestionsScrollTop, 0);
  assert.equal(sqCard.querySelector('.side-questions-head-right .mini-btn')?.textContent, '展开全部 (6)');

  // Clicking .side-q-open-btn calls window.sidecar.ui.toggleConversation(sqId) and stops propagation (does NOT trigger selectConversation)
  toggledConversations.length = 0;
  fetchedConvs.length = 0;
  const firstRow = sqCard.querySelector('.side-q-row');
  const firstOpenBtn = firstRow.querySelector('.side-q-open-btn');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:33:27
// Description: Update Side Questions open-session button assertion to v0.5.0 clean label ('打开会话') + .btn-soft + SVG .tm-icon.
// ============================================================================
  assert.equal(firstOpenBtn?.textContent, '打开会话');
  assert.doesNotMatch(firstOpenBtn?.textContent || '', /^↗\s*/);
  assert.equal(firstOpenBtn?.classList.contains('btn-soft'), true);
  assert.ok(firstOpenBtn?.querySelector('.tm-icon'), '.side-q-open-btn must render SVG .tm-icon');
// ============================================================================
// [MODIFIED END] 2026-11-20 10:33:27
// ============================================================================
  const openClickEvt = firstOpenBtn.click();
  await new Promise((r) => setImmediate(r));
  assert.equal(openClickEvt.propagationStopped, true, '.side-q-open-btn must call stopPropagation()');
  assert.deepEqual(toggledConversations, [sqIds[0]]);
  assert.equal(fetchedConvs.length, 0, '.side-q-open-btn must NOT trigger selectConversation');

  // Clicking .side-q-row triggers selectConversation(sqId) without invoking toggleConversation again
  firstRow.click();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(toggledConversations, [sqIds[0]]);
  assert.equal(fetchedConvs.includes(sqIds[0]), true, 'Clicking .side-q-row must trigger selectConversation(sqId)');

  // 3. Direct Side Question inspection (childKind: 'side_question', even when homeConvId === viewingId)
  exports.state.homeConvId = sqIds[0];
  exports.state.lang = 'zh';
  exports.state.snapshot = sqDirectSnap;
  exports.renderHeader(sqDirectSnap);
  exports.renderCurrentTab(sqDirectSnap);

  const nonboundBanner = fakeDocument.getElementById('nonbound-banner');
  const nonboundLabel = fakeDocument.getElementById('nonbound-label');
  const backBtn = fakeDocument.getElementById('btn-back-bound');
  const kindBadge = fakeDocument.getElementById('conv-kind-badge');
  const costCard = fakeDocument.getElementById('card-cost');

  assert.equal(nonboundBanner.classList.contains('hidden'), false, '#nonbound-banner must be visible even when homeConvId === viewingId');
  assert.equal(nonboundBanner.classList.contains('is-side-question'), true);
  assert.equal(nonboundLabel.textContent, '支线问题：Side Question #1');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:33:27
// Description: Update #btn-back-bound assertions to v0.5.0 clean labels (no ← prefix) with SVG .tm-icon.
// ============================================================================
  assert.equal(backBtn.textContent, '返回主对话');
  assert.ok(backBtn.querySelector('.tm-icon'), '#btn-back-bound must render back SVG .tm-icon');
  assert.equal(kindBadge.classList.contains('hidden'), false);
  assert.equal(kindBadge.textContent, '支线问题');
  assert.equal(costCard.querySelector('.child-cost-badge.is-side-question')?.textContent, '支线独立计费');

  // English labels for Side Question inspection
  exports.state.lang = 'en';
  exports.renderHeader(sqDirectSnap);
  exports.renderCurrentTab(sqDirectSnap);
  assert.equal(nonboundLabel.textContent, 'Side Question: Side Question #1');
  assert.equal(backBtn.textContent, 'Back to Main Chat');
  assert.ok(backBtn.querySelector('.tm-icon'), '#btn-back-bound must render back SVG .tm-icon in en');
// ============================================================================
// [MODIFIED END] 2026-11-20 10:33:27
// ============================================================================
  assert.equal(kindBadge.textContent, 'Side Q');
  assert.equal(costCard.querySelector('.child-cost-badge.is-side-question')?.textContent, 'Side Question Only');

  // Clicking #btn-back-bound navigates back to parentConversationId (mainId)
  fetchedConvs.length = 0;
  backBtn.click();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchedConvs[fetchedConvs.length - 1], mainId, '#btn-back-bound must navigate to parentConversationId');

  // 4. Tab 1 & Tab 2 Model Tables: 8 columns, Hit % / 命中率 right after Cache / 缓存, exact %, —, tier classes, tooltips
  const expectedRowOrder = [
    { tier: 'is-mid', text: '55.0%', zhTip: '缓存读取 55,000 / 总输入 100,000 (55.0%)', enTip: 'Cache Read 55,000 / Total Input 100,000 (55.0%)' },
    { tier: 'is-low', text: '20.0%', zhTip: '缓存读取 20,000 / 总输入 100,000 (20.0%)', enTip: 'Cache Read 20,000 / Total Input 100,000 (20.0%)' },
    { tier: 'is-high', text: '90.0%', zhTip: '缓存读取 90,000 / 总输入 100,000 (90.0%)', enTip: 'Cache Read 90,000 / Total Input 100,000 (90.0%)' },
    { tier: 'is-none', text: '—', zhTip: '', enTip: '' },
  ];

  const assertModelTable8Cols = (containerEl, lang) => {
    const table = containerEl.querySelector('table.data-table');
    assert.ok(table, `Expected table.data-table in ${lang}`);
    const ths = table.querySelectorAll('thead th');
    assert.equal(ths.length, 8, `Model table must render exactly 8 columns (${lang})`);
    assert.equal(ths[3].textContent, lang === 'zh' ? '缓存' : 'Cache');
    assert.equal(ths[4].textContent, lang === 'zh' ? '命中率' : 'Hit %');
    assert.equal(ths[4].classList.contains('cache-hit-col'), true);
    assert.equal(ths[4].title.includes(lang === 'zh' ? '缓存命中率' : 'Cache hit rate'), true);
    assert.equal(ths[5].textContent, lang === 'zh' ? '输出' : 'Output');

    const rows = table.querySelectorAll('tbody tr');
    assert.equal(rows.length, 4);
    rows.forEach((tr, idx) => {
      const tds = tr.querySelectorAll('td');
      assert.equal(tds.length, 8, `Row ${idx} must render 8 cells (${lang})`);
      const hitCell = tds[4];
      const exp = expectedRowOrder[idx];
      assert.equal(hitCell.classList.contains('cache-hit-col'), true);
      assert.equal(hitCell.classList.contains(exp.tier), true, `Row ${idx} must have .${exp.tier}`);
      assert.equal(hitCell.textContent, exp.text);
      assert.equal(hitCell.title, lang === 'zh' ? exp.zhTip : exp.enTip);
    });
  };

  exports.state.homeConvId = mainId;
  exports.state.snapshot = sixSqSnap;
  exports.state.modelSortBy = 'cost';
  exports.state.modelSortDir = 'desc';

  for (const lang of ['zh', 'en']) {
    exports.state.lang = lang;
    exports.renderChildrenAndModelsCard(sixSqSnap.current, sixSqSnap.prefs);
    exports.renderGlobalTab(sixSqSnap);
    assertModelTable8Cols(fakeDocument.getElementById('card-children-models'), lang);
    assertModelTable8Cols(fakeDocument.getElementById('global-content'), lang);
  }

  // ---------------- Part B: Static Hygiene ----------------
  // 1. I18N.zh / I18N.en 100% key & {placeholder} parity + all 19 v0.4.1 keys present
  const i18nStart = appSource.indexOf('const I18N = {');
  assert.ok(i18nStart >= 0, 'I18N object must exist in app.js');
  const i18nMatch = appSource
    .slice(i18nStart)
    .match(/zh:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(i18nMatch, 'Both zh and en blocks must be extractable from I18N');
  const extractEntries = (block) => {
    const map = new Map();
    for (const m of block.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\.|[^'\\])*)'/gm)) {
      map.set(m[1], m[2]);
    }
    return map;
  };
  const zhEntries = extractEntries(i18nMatch[1]);
  const enEntries = extractEntries(i18nMatch[2]);
  assert.deepEqual([...zhEntries.keys()].sort(), [...enEntries.keys()].sort());
  const extractPlaceholders = (str) =>
    [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  for (const [key, zhVal] of zhEntries.entries()) {
    assert.deepEqual(
      extractPlaceholders(zhVal),
      extractPlaceholders(enEntries.get(key)),
      `I18N placeholder mismatch for "${key}"`,
    );
  }
  for (const v041Key of [
    'childrenModels.colCacheHit',
    'childrenModels.colCacheHitTip',
    'childrenModels.colCacheHitCellTip',
    'sideQuestions.title',
    'sideQuestions.countBadge',
    'sideQuestions.summaryMeta',
    'sideQuestions.summaryTip',
    'sideQuestions.openBtn',
    'sideQuestions.openTip',
    'sideQuestions.inspectTip',
    'sideQuestions.expandAll',
    'sideQuestions.collapse',
    'sideQuestions.expandMoreFooter',
    'sideQuestions.collapseFooter',
    'sideQuestions.badge',
    'sideQuestions.viewingBanner',
    'sideQuestions.backToParent',
    'sideQuestions.isolatedCostBadge',
    'sideQuestions.hitStat',
  ]) {
    assert.equal(zhEntries.has(v041Key), true, `I18N.zh missing ${v041Key}`);
    assert.equal(enEntries.has(v041Key), true, `I18N.en missing ${v041Key}`);
  }

  // 2. Zero unsafe DOM APIs across app.js, receipt.js, pixel_office.js
  const unsafeDomRe = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/;
  assert.equal(unsafeDomRe.test(appSource), false, 'app.js must contain 0 unsafe DOM APIs');
  assert.equal(unsafeDomRe.test(receiptSource), false, 'receipt.js must contain 0 unsafe DOM APIs');
  assert.equal(unsafeDomRe.test(pixelOfficeSource), false, 'pixel_office.js must contain 0 unsafe DOM APIs');

  // 3. Zero banned terms across all code, docs, manifests, and tests
  const bannedTerm = '\u6c34\u4f4d';
  const legacyDocPhrase = 'Dedicated ' + 'Gemini 3.1 Pro';
  const legacyUiTerm = '\u5728\u5f79\u6a21\u578b';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['parser.mjs', parserSource],
    ['main.mjs', mainSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['net_proxy.mjs', netProxySource],
    ['clipboard_image.mjs', clipboardImageSource],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['plugin.json', pluginJsonRaw],
    ['package.json', packageJsonRaw],
    ['sidecar.json', sidecarJsonRaw],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    assert.equal(src.includes(bannedTerm), false, `${label} must not contain banned term`);
    assert.equal(src.includes(legacyDocPhrase), false, `${label} must not contain legacy doc phrase`);
  }
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['I18N.zh', i18nMatch[1]],
    ['README.md', readmeMd],
    ['SKILL.md', skillMd],
    ['plugin.json', pluginJsonRaw],
    ['package.json', packageJsonRaw],
    ['sidecar.json', sidecarJsonRaw],
  ]) {
    assert.equal(src.includes(legacyUiTerm), false, `${label} must not contain legacy UI term`);
  }

  // 4. .roll-col { display: inline-grid } preserved in styles.css
  const stylesNoComments = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const rollColMatch = stylesNoComments.match(/(?:^|\n)\s*\.roll-col\s*\{([^}]*)\}/);
  assert.ok(rollColMatch, 'styles.css must preserve .roll-col rule');
  assert.match(rollColMatch[1], /display\s*:\s*inline-grid\b/);
  assert.doesNotMatch(rollColMatch[1], /display\s*:\s*inline-block\b/);

  // 5. Balanced [MODIFIED BEGIN/END] annotations across all modified files
  const modBeginMarker = '[' + 'MODIFIED BEGIN]';
  const modEndMarker = '[' + 'MODIFIED END]';
  for (const [label, src] of [
    ['index.html', indexHtml],
    ['styles.css', stylesCss],
    ['app.js', appSource],
    ['receipt.js', receiptSource],
    ['pixel_office.js', pixelOfficeSource],
    ['parser.mjs', parserSource],
    ['main.mjs', mainSource],
    ['release_updater.mjs', releaseUpdaterSource],
    ['pricing_sync.mjs', pricingSyncSource],
    ['net_proxy.mjs', netProxySource],
    ['clipboard_image.mjs', clipboardImageSource],
    ['scripts/sync-plugin.ps1', syncPluginPs1],
    ['tests/parser.test.mjs', selfSource],
  ]) {
    let depth = 0;
    let minDepth = 0;
    let begins = 0;
    let ends = 0;
    for (const line of src.split(/\r?\n/)) {
      if (line.includes(modBeginMarker)) {
        depth += 1;
        begins += 1;
      }
      if (line.includes(modEndMarker)) {
        depth -= 1;
        ends += 1;
        if (depth < minDepth) minDepth = depth;
      }
    }
    assert.ok(begins > 0, `${label} must contain modification annotations`);
    assert.equal(begins, ends, `${label} begin/end annotation count mismatch`);
    assert.equal(depth, 0, `${label} unclosed modification annotation (depth=${depth})`);
    assert.equal(minDepth, 0, `${label} unmatched end annotation (minDepth=${minDepth})`);
  }

  // 6. Manifests plugin.json & package.json version === "0.4.1" with 0 JSON comments
  for (const [label, rawJson] of [
    ['plugin.json', pluginJsonRaw],
    ['package.json', packageJsonRaw],
    ['sidecar.json', sidecarJsonRaw],
  ]) {
    assert.equal(/^\s*(?:\/\/|\/\*)/m.test(rawJson), false, `${label} must contain 0 JSON comments`);
    assert.equal(rawJson.includes(modBeginMarker), false, `${label} must not contain comment annotations`);
    assert.doesNotThrow(() => JSON.parse(rawJson), `${label} must be valid strict JSON`);
  }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump manifest version assertions in v0.4.1 static hygiene block to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump manifest version assertions in v0.4.1 static hygiene block to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:35:02
// Description: Bump manifest version assertions in v0.4.1 static hygiene block from 0.5.1 to 0.5.2.
// ============================================================================
  assert.equal(JSON.parse(pluginJsonRaw).version, '0.5.2');
  assert.equal(JSON.parse(packageJsonRaw).version, '0.5.2');
// ============================================================================
// [MODIFIED END] 2026-11-23 10:35:02
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 15:55:43
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-20 10:38:48
// ============================================================================
});
// ============================================================================
// [MODIFIED END] 2026-11-19 20:33:24
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:45:47
// Description: Add v0.5.1 headless VM behavioral test covering A4 (hidden poll pause, active-tab-only render, Tab 2 signature skip), A5 (on-demand stopwatch, setIconButtonContent sig skip), A6 (Pixel Office 3s idle cadence + prefers-reduced-motion), B5 (Escape stack + modal focus restore + Tab 2 Open Chat keydown stopPropagation), B6 (cache track tooltip localization + .btn-soft/external icon), B7 (trend bar focus + click-again unpin), C1 (By Project 5-col table + Top-8 fold + Ungrouped), and C2 (persistent Tab 2 filter bar preserving input identity/focus/value across live polls).
// ============================================================================
test('v0.5.1 headless VM: A4/A5/A6 render & timer gating, B5/B6/B7 a11y & UI polish, C1 By Project Top-8 fold, and C2 persistent session filter bar', async () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, '..');
  const paneDir = join(repoRoot, 'sidecars', 'monitor_pane');
  const appSource = readFileSync(join(paneDir, 'app.js'), 'utf-8');
  const pixelSource = readFileSync(join(paneDir, 'pixel_office.js'), 'utf-8');

  class FakeClassList {
    constructor(owner) {
      this._owner = owner;
      this._set = new Set();
    }
    _syncFromString(str) {
      this._set = new Set(String(str || '').split(/\s+/).filter(Boolean));
    }
    _syncToOwner() {
      this._owner._className = [...this._set].join(' ');
    }
    add(...cls) {
      for (const c of cls) if (c) this._set.add(c);
      this._syncToOwner();
    }
    remove(...cls) {
      for (const c of cls) this._set.delete(c);
      this._syncToOwner();
    }
    toggle(c, force) {
      if (force === undefined) {
        if (this._set.has(c)) this._set.delete(c);
        else this._set.add(c);
      } else if (force) {
        this._set.add(c);
      } else {
        this._set.delete(c);
      }
      this._syncToOwner();
      return this._set.has(c);
    }
    contains(c) {
      return this._set.has(c);
    }
  }

  class FakeNode {
    constructor(tag) {
      this.tagName = String(tag || 'DIV').toUpperCase();
      this.children = [];
      this.childNodes = this.children;
      this.parentElement = null;
      this._textContent = '';
      this._className = '';
      this.classList = new FakeClassList(this);
      this.dataset = {};
      this.style = {
        setProperty(k, v) { this[k] = String(v); },
        removeProperty(k) { delete this[k]; },
      };
      this.attributes = new Map();
      this.listeners = new Map();
      this.title = '';
      this.value = '';
      this.placeholder = '';
      this.disabled = false;
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.scrollWidth = 0;
      this.width = 0;
      this.height = 0;
      this.isConnected = true;
      this.offsetParent = {};
      this.replaceChildrenCalls = 0;
      this.focusCalls = 0;
    }
    get id() { return this.attributes.get('id') || ''; }
    set id(v) { this.attributes.set('id', String(v || '')); }
    get className() { return this._className; }
    set className(v) {
      this._className = String(v || '');
      this.classList._syncFromString(this._className);
    }
    get childElementCount() {
      return this.children.filter((c) => c.tagName !== '#TEXT').length;
    }
    get textContent() {
      if (this.children.length > 0) {
        return this.children.map((c) => c.textContent).join('');
      }
      return this._textContent;
    }
    set textContent(v) {
      this._textContent = String(v ?? '');
      this.children.length = 0;
    }
    setAttribute(name, val) {
      const k = String(name);
      const v = String(val);
      if (k === 'class') { this.className = v; return; }
      if (k === 'title') this.title = v;
      if (k === 'value') this.value = v;
      this.attributes.set(k, v);
    }
    getAttribute(name) {
      if (name === 'class') return this._className;
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }
    removeAttribute(name) { this.attributes.delete(name); }
    appendChild(child) {
      if (!child) return child;
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    insertBefore(newNode, refNode) {
      if (!newNode) return newNode;
      newNode.parentElement = this;
      const idx = this.children.indexOf(refNode);
      if (idx >= 0) this.children.splice(idx, 0, newNode);
      else this.children.push(newNode);
      return newNode;
    }
    remove() {
      if (!this.parentElement) return;
      const idx = this.parentElement.children.indexOf(this);
      if (idx >= 0) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
    replaceChildren(...nodes) {
      this.replaceChildrenCalls += 1;
      for (const old of this.children) old.parentElement = null;
      this.children.length = 0;
      this._textContent = '';
      for (const n of nodes) {
        if (n !== null && n !== undefined && n !== false) {
          this.appendChild(typeof n === 'string' ? fakeDocument.createTextNode(n) : n);
        }
      }
    }
    contains(target) {
      if (target === this) return true;
      for (const c of this.children) {
        if (c === target || (typeof c.contains === 'function' && c.contains(target))) return true;
      }
      return false;
    }
    focus() {
      this.focusCalls += 1;
      fakeDocument.activeElement = this;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent(type, ev = {}) {
      const event = {
        type,
        target: ev.target || this,
        key: ev.key || '',
        shiftKey: Boolean(ev.shiftKey),
        propagationStopped: false,
        defaultPrevented: false,
        stopPropagation() { this.propagationStopped = true; },
        preventDefault() { this.defaultPrevented = true; },
      };
      let cur = this;
      while (cur) {
        for (const fn of cur.listeners.get(type) || []) fn(event);
        if (event.propagationStopped) break;
        cur = cur.parentElement;
      }
      return event;
    }
    click() { return this.dispatchEvent('click'); }
    getContext() {
      return {
        imageSmoothingEnabled: false,
        setTransform() {},
        clearRect() {},
        fillRect() {},
        strokeRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {},
        stroke() {},
        arc() {},
        roundRect() {},
        drawImage() {},
        fillText() {},
        measureText: (txt) => ({ width: String(txt || '').length * 6 }),
        save() {},
        restore() {},
      };
    }
    _matches(sel) {
      const s = String(sel || '').trim();
      if (!s) return false;
      if (s.startsWith('#')) return this.id === s.slice(1);
      const parts = s.split('.');
      const tagPart = parts[0];
      if (tagPart && this.tagName !== tagPart.toUpperCase()) return false;
      for (let i = 1; i < parts.length; i++) {
        if (!this.classList.contains(parts[i])) return false;
      }
      return true;
    }
    querySelectorAll(selector) {
      const out = [];
      const selectors = String(selector).split(',').map((p) => p.trim()).filter(Boolean);
      const walk = (node) => {
        for (const c of node.children) {
          if (c.tagName !== '#TEXT') {
            for (const s of selectors) {
              const chain = s.split(/\s+/);
              if (c._matches(chain[chain.length - 1])) {
                let ok = true;
                if (chain.length > 1) {
                  let anc = c.parentElement;
                  for (let k = chain.length - 2; k >= 0; k--) {
                    while (anc && !anc._matches(chain[k])) anc = anc.parentElement;
                    if (!anc) { ok = false; break; }
                    anc = anc.parentElement;
                  }
                }
                if (ok) { out.push(c); break; }
              }
            }
            walk(c);
          }
        }
      };
      walk(this);
      return out;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }

  const elementsById = new Map();
  const rootBody = new FakeNode('BODY');
  const docListeners = new Map();
  let reducedMotion = false;
  let intervalSeq = 1;
  const activeIntervals = new Map();
  let timeoutSeq = 1;
  const activeTimeouts = new Map();
  const fetchCalls = [];
  const toggledChats = [];

  const fakeDocument = {
    hidden: false,
    readyState: 'complete',
    activeElement: null,
    documentElement: new FakeNode('HTML'),
    body: rootBody,
    createElement(tag) { return new FakeNode(tag); },
    createElementNS(_ns, tag) { return new FakeNode(tag); },
    createTextNode(txt) {
      const n = new FakeNode('#TEXT');
      n._textContent = String(txt ?? '');
      return n;
    },
    getElementById(id) {
      const k = String(id);
      if (!elementsById.has(k)) {
        const n = new FakeNode('DIV');
        n.id = k;
        rootBody.appendChild(n);
        elementsById.set(k, n);
      }
      return elementsById.get(k);
    },
    querySelector(sel) { return rootBody.querySelector(sel); },
    querySelectorAll(sel) { return rootBody.querySelectorAll(sel); },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
  };

  const makeSnap = (rev = 1, status = 'IDLE') => {
    const workspaces = Array.from({ length: 10 }, (_, idx) => ({
      workspace: idx === 0 ? '' : `F:\\Work\\project-${String(idx).padStart(2, '0')}`,
      conversationsCount: 10 - idx,
      stepsCount: (10 - idx) * 4,
      inputTokens: (10 - idx) * 1000,
      cacheReadTokens: (10 - idx) * 3000,
      outputTokens: (10 - idx) * 500,
      totalTokens: (10 - idx) * 4500,
      cacheHitRatePct: 75,
      costActual: Number(((10 - idx) * 0.5 + rev * 0.01).toFixed(4)),
    }));
    const recentConvs = [
      {
        conversationId: 'conv-alpha-11111111',
        title: 'Alpha Refactor',
        workspace: 'F:\\Work\\alpha-repo',
        activeModel: 'Gemini 4 Neon',
        status: 'GENERATING',
        onDisk: true,
        isToday: true,
        updatedAtMs: Date.now() - 2000,
        contextTotal: 32000,
        latestTokPerSec: 88,
        outputTokens: 1200 + rev * 10,
        totalTokens: 50000 + rev * 10,
        costActual: 0.42 + rev * 0.01,
      },
      {
        conversationId: 'conv-beta-22222222',
        title: 'Beta Bugfix',
        workspace: 'F:\\Work\\beta-repo',
        activeModel: 'Claude Opus 5.5',
        status: 'IDLE',
        onDisk: true,
        isToday: true,
        updatedAtMs: Date.now() - 60000,
        contextTotal: 14000,
        latestTokPerSec: 60,
        outputTokens: 800,
        totalTokens: 20000,
        costActual: 0.18,
      },
      {
        conversationId: 'conv-gamma-33333333',
        title: 'Gamma Tool Run',
        workspace: 'F:\\Work\\gamma-repo',
        activeModel: 'Gemini 4 Neon',
        status: 'RUNNING_TOOLS',
        onDisk: true,
        isToday: false,
        updatedAtMs: Date.now() - 120000,
        contextTotal: 9000,
        latestTokPerSec: 70,
        outputTokens: 400,
        totalTokens: 12000,
        costActual: 0.09,
      },
    ];
    const makePeriod = (rangeKey, wsSlice) => ({
      rangeKey,
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      spanDaysCount: 1,
      activeDaysCount: 1,
      conversationsCount: 3,
      archivedConversationsCount: 0,
      stepsCount: 12,
      inputTokens: 15000,
      cacheReadTokens: 45000,
      outputTokens: 2400 + rev * 10,
      totalTokens: 62400 + rev * 10,
      cacheHitRatePct: 75,
      costActual: 0.69 + rev * 0.01,
      avgDailyCost: 0.69 + rev * 0.01,
      avgDailyTokens: 62400 + rev * 10,
      trendGranularity: 'hour',
      series: [
        { key: '09', label: '09:00', rangeText: '09:00 - 10:00', costActual: 0.25, totalTokens: 20000, outputTokens: 900 },
        { key: '10', label: '10:00', rangeText: '10:00 - 11:00', costActual: 0.44 + rev * 0.01, totalTokens: 42400, outputTokens: 1500 },
      ],
      byModel: [
        {
          profileId: 'gemini-4-neon',
          model: 'Gemini 4 Neon',
          rawModels: ['gemini-4-neon'],
          conversationsCount: 2,
          inputTokens: 10000,
          cacheReadTokens: 30000,
          outputTokens: 1600,
          totalTokens: 41600,
          cacheHitRatePct: 75,
          costActual: 0.51,
        },
      ],
      byWorkspace: wsSlice,
      topConversations: recentConvs,
      subscription: null,
    });
    return {
      etag: `etag-v051-${rev}-${status}`,
      serverTimeMs: Date.now(),
      boundConversationId: 'conv-alpha-11111111',
      appVersion: '0.5.1',
      prefs: {
        currency: 'USD',
        language: 'zh',
        tokenUnit: 'auto',
        modelSortBy: 'cost',
        modelSortDir: 'desc',
        pixelOfficeCollapsed: false,
      },
      current: {
        conversationId: 'conv-alpha-11111111',
        title: 'Alpha Refactor',
        workspace: 'F:\\Work\\alpha-repo',
        status,
        generatingSinceMs: status === 'GENERATING' ? Date.now() - 3500 : null,
        activeModel: 'Gemini 4 Neon',
        activeRawModel: 'gemini-4-neon',
        speed: { latestStepTokPerSec: 88, weightedAvgTokPerSec: 82, peakTokPerSec: 95, recentSteps: [] },
        context: {
          contextTotal: 32000,
          contextMax: 512000,
          contextWarn: 409600,
          usageLevel: 'HEALTHY',
          cacheReadTokens: 30000,
          inputUncachedTokens: 10000,
          cacheHitRatePct: 75,
          netTokenDelta: 400,
          topSpikes: [],
        },
        totals: {
          withChildren: { stepsCount: 10, totalTokens: 50000, costActual: 0.42 },
          mainOnly: { stepsCount: 8, totalTokens: 40000, costActual: 0.35 },
        },
        children: [
          {
            conversationId: 'child-worker-1',
            name: 'worker-1',
            kind: 'swarm',
            status: 'IDLE',
            killed: false,
            model: 'Gemini 4 Hydrogen',
            rawModel: 'gemini-flash-worker-agy',
            contextTotal: 8000,
            latestTokPerSec: 50,
            outputTokens: 300,
            costActual: 0.07,
            updatedAtMs: Date.now() - 5000,
          },
        ],
        byModel: [],
        sideQuestions: [],
      },
      global: {
        todayDate: '2026-11-20',
        recentConversations: recentConvs,
        todayByWorkspace: workspaces,
        periods: {
          today: makePeriod('today', workspaces),
          '7d': makePeriod('7d', workspaces.slice(0, 3)),
          '30d': makePeriod('30d', workspaces),
          all: makePeriod('all', workspaces),
        },
      },
    };
  };

  let nextPollSnap = makeSnap(1, 'IDLE');

  const sandbox = {
    window: null,
    document: fakeDocument,
    Node: FakeNode,
    MutationObserver: class { observe() {} },
    AbortController: globalThis.AbortController,
    URLSearchParams: globalThis.URLSearchParams,
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Promise,
    Error,
    RegExp,
    Intl,
    encodeURIComponent,
    decodeURIComponent,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setInterval(fn, ms) {
      const id = intervalSeq++;
      activeIntervals.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) { activeIntervals.delete(id); },
    setTimeout(fn, ms) {
      const id = timeoutSeq++;
      activeTimeouts.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) { activeTimeouts.delete(id); },
    requestAnimationFrame(fn) { fn(); return 1; },
    getComputedStyle() {
      return { color: 'rgb(15, 23, 42)', backgroundColor: 'rgb(255, 255, 255)' };
    },
    navigator: { clipboard: {} },
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 480,
    devicePixelRatio: 1,
    matchMedia(q) {
      return {
        matches: String(q).includes('prefers-reduced-motion') ? reducedMotion : false,
        addEventListener() {},
      };
    },
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return { ok: true, status: 200, json: async () => nextPollSnap, text: async () => JSON.stringify(nextPollSnap) };
    },
  };
  sandbox.window = sandbox;
  sandbox.sidecar = {
    conversationId: 'conv-alpha-11111111',
    fetch: sandbox.fetch,
    ui: {
      toggleConversation(id) { toggledChats.push(id); },
    },
  };
  sandbox.TokenMonitorReceipt = {
    buildReceiptViewModel: () => ({ title: 'Receipt' }),
    renderReceiptCanvas: () => ({ toDataURL: () => 'data:image/png;base64,AA==' }),
  };

  vm.createContext(sandbox);
  vm.runInContext(pixelSource, sandbox);

  const exportTail = appSource.replace(
    /if\s*\(document\.readyState\s*===\s*'loading'\)/,
    'globalThis.__tmV051 = { state, init, pollSnapshot, renderHeader, renderCurrentTab, renderGlobalTab, renderCacheCard, renderChildrenAndModelsCard, setActiveTab, setDrawerOpen, openReceiptModal, closeReceiptModal, setIconButtonContent, syncStopwatchLoop, syncPixelOfficeLoop, tickLiveStopwatch };\n  if (document.readyState === \'loading\')',
  );
  // Prevent auto-init at load time so we control init explicitly
  const controlledSrc = exportTail.replace(
    /if\s*\(document\.readyState\s*===\s*'loading'\)\s*\{[\s\S]*?\}\s*else\s*\{\s*init\(\);\s*\}/,
    '/* manual init in test */',
  );
  vm.runInContext(controlledSrc, sandbox);
  const api = sandbox.__tmV051;
  assert.ok(api, 'VM must expose __tmV051');

  // Start app (status = IDLE)
  api.init();
  await new Promise((r) => setImmediate(r));

  // A4: Poll on Tab 1 must NOT render hidden Tab 2 (#global-content remains empty)
  const globalContent = fakeDocument.getElementById('global-content');
  assert.equal(globalContent.childElementCount, 0, 'A4: Tab 2 must not be rendered while Tab 1 is active');
  assert.equal(fetchCalls.length, 1);

  // A5: Stopwatch timer stays null at IDLE; starts on GENERATING; self-stops back at IDLE
  assert.equal(api.state.stopwatchTimer, null, 'A5: stopwatchTimer must remain null when IDLE');
  nextPollSnap = makeSnap(2, 'GENERATING');
  await api.pollSnapshot(true);
  assert.ok(api.state.stopwatchTimer !== null, 'A5: stopwatchTimer must start when status is GENERATING');
  nextPollSnap = makeSnap(3, 'IDLE');
  await api.pollSnapshot(true);
  assert.equal(api.state.stopwatchTimer, null, 'A5: stopwatchTimer must stop when returning to IDLE');

  // A5: setIconButtonContent skips replaceChildren on matching signature
  const testBtn = fakeDocument.createElement('button');
  api.setIconButtonContent(testBtn, 'refresh', 'Sync Now', 12);
  const callsAfterFirst = testBtn.replaceChildrenCalls;
  api.setIconButtonContent(testBtn, 'refresh', 'Sync Now', 12);
  assert.equal(testBtn.replaceChildrenCalls, callsAfterFirst, 'A5: identical setIconButtonContent call must skip DOM rebuild');
  api.setIconButtonContent(testBtn, 'refresh', 'Syncing...', 12);
  assert.equal(testBtn.replaceChildrenCalls, callsAfterFirst + 1, 'A5: changed label must update button DOM');

  // A6: Pixel Office idle cadence = 3000ms (tick += 6), reduced-motion stops loop
  assert.equal(api.state.pixelOfficeIntervalMs, 3000, 'A6: idle Pixel Office cadence must be 3000ms');
  const tickBefore = api.state.pixelOfficeTick;
  const idleIntervalObj = activeIntervals.get(api.state.pixelOfficeTimer);
  assert.ok(idleIntervalObj && idleIntervalObj.ms === 3000);
  idleIntervalObj.fn();
  assert.equal(api.state.pixelOfficeTick, tickBefore + 6, 'A6: idle 3000ms tick must advance by 6 to toggle idle frame');
  reducedMotion = true;
  api.syncPixelOfficeLoop();
  assert.equal(api.state.pixelOfficeIntervalMs, 0, 'A6: prefers-reduced-motion must stop Pixel Office loop');
  assert.equal(api.state.pixelOfficeTimer, null);
  reducedMotion = false;
  api.syncPixelOfficeLoop();

  // A4: document.hidden pauses polling & visibilitychange visible triggers immediate fetch
  fakeDocument.hidden = true;
  for (const fn of docListeners.get('visibilitychange') || []) fn();
  assert.equal(api.state.pollTimer, null, 'A4: pollTimer must be cleared while document.hidden');
  const fetchesBeforeHidden = fetchCalls.length;
  await api.pollSnapshot(false);
  assert.equal(fetchCalls.length, fetchesBeforeHidden, 'A4: pollSnapshot(false) must skip fetch while hidden');
  fakeDocument.hidden = false;
  for (const fn of docListeners.get('visibilitychange') || []) fn();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, fetchesBeforeHidden + 1, 'A4: visibility restore must trigger immediate fetch');

  // B6: Cache track localized tooltip (zh & en) + child Open Chat button uses .btn-soft + SVG icon
  const cacheTrackZh = fakeDocument.getElementById('card-cache').querySelector('.cache-seg-track');
  assert.ok(cacheTrackZh?.title.includes('缓存读取'), 'B6: zh cache track title must be localized');
  const childOpenBtn = fakeDocument.getElementById('card-children-models').querySelector('.child-actions .mini-btn.btn-soft');
  assert.ok(childOpenBtn && childOpenBtn.querySelector('.tm-icon'), 'B6: child Open Chat button must use .btn-soft + SVG icon');

  // B5: Escape closes one layer at a time (receipt modal -> settings drawer -> Pixel Inspector) and restores focus
  const triggerBtn = fakeDocument.getElementById('btn-checkout');
  triggerBtn.focus();
  api.openReceiptModal();
  assert.equal(api.state.receiptModalOpen, true);
  api.setDrawerOpen(true);
  api.state.pixelOfficeSelectedKey = 'main';
  const dispatchEsc = () => {
    const ev = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const fn of docListeners.get('keydown') || []) fn(ev);
    return ev;
  };
  dispatchEsc();
  assert.equal(api.state.receiptModalOpen, false, 'B5: 1st Esc closes receipt modal');
  assert.equal(fakeDocument.activeElement, triggerBtn, 'B5: closing modal restores focus to trigger');
  assert.equal(api.state.drawerOpen, true, 'B5: 1st Esc must NOT also close settings drawer underneath');
  dispatchEsc();
  assert.equal(api.state.drawerOpen, false, 'B5: 2nd Esc closes settings drawer');
  assert.equal(fakeDocument.activeElement, fakeDocument.getElementById('btn-settings'), 'B5: closing drawer restores focus to #btn-settings');
  assert.equal(api.state.pixelOfficeSelectedKey, 'main');
  dispatchEsc();
  assert.equal(api.state.pixelOfficeSelectedKey, '', 'B5: 3rd Esc clears Pixel Office inspector selection');

  // Switch to Tab 2 -> renders immediately (A4), check C1 + C2 + B5 + B6 + B7
  api.setActiveTab('global');
  assert.ok(globalContent.childElementCount > 0, 'A4: switching to Tab 2 renders global content immediately');

  // A4: Tab 2 signature-skip on unchanged snapshot
  const topStackBefore = api.state.globalDom.topStack;
  const topRebuildsBefore = topStackBefore.replaceChildrenCalls;
  const listRebuildsBefore = api.state.globalDom.recentListWrap.replaceChildrenCalls;
  api.renderGlobalTab(api.state.snapshot);
  assert.equal(topStackBefore.replaceChildrenCalls, topRebuildsBefore, 'A4: unchanged snapshot must skip Tab 2 topStack rebuild');
  assert.equal(api.state.globalDom.recentListWrap.replaceChildrenCalls, listRebuildsBefore, 'A4: unchanged snapshot must skip Tab 2 list rebuild');

  // C1: #card-global-projects renders 5 cols, maps '' -> 未分组, folds 10 -> Top 8, expands to 10, follows period
  const projCard = globalContent.querySelector('#card-global-projects');
  assert.ok(projCard, 'C1: #card-global-projects must render in Tab 2');
  const projHeaders = projCard.querySelectorAll('thead th');
  assert.equal(projHeaders.length, 5, 'C1: By Project table must have 5 columns');
  assert.equal(projHeaders[0].textContent, '项目');
  assert.equal(projHeaders[4].textContent, '费用 (USD)');
  let projRows = projCard.querySelectorAll('tbody tr');
  assert.equal(projRows.length, 8, 'C1: 10 projects must fold to Top 8 by default');
  assert.equal(projRows[0].querySelector('td.project-cell')?.textContent, '未分组', 'C1: empty workspace must label as 未分组 in zh');
  assert.equal(projRows[0].querySelector('td.project-cell')?.classList.contains('is-ungrouped'), true, 'C1/#282: empty workspace row must carry .is-ungrouped');
  assert.equal(projRows[1].querySelector('td.project-cell')?.classList.contains('is-ungrouped'), false, 'C1/#282: real project row must NOT carry .is-ungrouped');
  const projToggle = projCard.querySelector('.children-toggle-bar');
  assert.ok(projToggle, 'C1: fold toggle button must render when >8 projects');
  projToggle.click();
  projRows = globalContent.querySelector('#card-global-projects').querySelectorAll('tbody tr');
  assert.equal(projRows.length, 10, 'C1: clicking toggle must expand all 10 projects');

  // Switch to 7d period -> follows period (3 projects, no fold button, resets workspacesExpanded)
  const periodBtns = globalContent.querySelectorAll('.period-btn');
  periodBtns[1].click();
  assert.equal(api.state.workspacesExpanded, false, 'C1: switching period resets workspacesExpanded');
  assert.equal(globalContent.querySelector('#card-global-projects').querySelectorAll('tbody tr').length, 3, 'C1: By Project must follow selected 7d period');
  periodBtns[0].click();

  // B7: Trend bar focus updates detailStrip; click pins; second click unpins
  const trendCols = globalContent.querySelectorAll('.trend-col');
  const detailStrip = globalContent.querySelector('.trend-detail');
  assert.equal(trendCols.length, 2);
  trendCols[0].dispatchEvent('focus');
  assert.ok(detailStrip.textContent.includes('09:00'), 'B7: focusing trend bar updates detailStrip');
  trendCols[0].click();
  assert.equal(api.state.selectedSeriesIdx, 0, 'B7: 1st click pins bucket 0');
  trendCols[0].click();
  assert.equal(api.state.selectedSeriesIdx, null, 'B7: 2nd click unpins back to default latest bucket');
  assert.ok(detailStrip.textContent.includes('10:00'));

  // C2: Persistent filter bar (search + model + active-only + empty state + identity preserved across live polls!)
  const filterBar = globalContent.querySelector('.list-filter-bar');
  const searchInput = filterBar?.querySelector('.list-search-input');
  const modelSelect = filterBar?.querySelector('.list-filter-select');
  const activeChip = filterBar?.querySelector('.list-filter-chip');
  assert.ok(filterBar && searchInput && modelSelect && activeChip, 'C2: filter bar controls must exist');

  // Active-only chip filters to GENERATING + RUNNING_TOOLS (2 of 3)
  activeChip.click();
  assert.equal(activeChip.classList.contains('active'), true);
  assert.equal(globalContent.querySelectorAll('.recent-item').length, 2, 'C2: active-only filter must show 2 active sessions');

  // Model filter + search input (focus & identity preserved across live poll!)
  searchInput.focus();
  searchInput.value = 'gamma';
  searchInput.dispatchEvent('input');
  assert.equal(globalContent.querySelectorAll('.recent-item').length, 1, 'C2: search "gamma" must narrow to 1 matching session');

  // Simulate live poll arriving while user is typing in searchInput
  nextPollSnap = makeSnap(99, 'IDLE');
  await api.pollSnapshot(true);
  assert.equal(globalContent.querySelector('.list-search-input'), searchInput, 'C2: live poll MUST NOT rebuild .list-search-input');
  assert.equal(searchInput.value, 'gamma', 'C2: live poll MUST preserve search input value');
  assert.equal(fakeDocument.activeElement, searchInput, 'C2: live poll MUST preserve search input focus');

  // Zero-match filter shows .list-filter-empty
  searchInput.value = 'no-such-session-xyz';
  searchInput.dispatchEvent('input');
  assert.ok(globalContent.querySelector('.list-filter-empty'), 'C2: zero-match filter must render .list-filter-empty');

  // Clear filters and verify B5/B6 on Tab 2 Open Chat button (btn-soft + SVG + keydown stopPropagation)
  searchInput.value = '';
  searchInput.dispatchEvent('input');
  activeChip.click();
  modelSelect.value = 'Claude Opus 5.5';
  modelSelect.dispatchEvent('change');
  assert.equal(globalContent.querySelectorAll('.recent-item').length, 1, 'C2: model select must filter to Claude Opus 5.5');
  modelSelect.value = '';
  modelSelect.dispatchEvent('change');

  const recentOpenBtn = globalContent.querySelector('.recent-item .recent-top .mini-btn.btn-soft');
  assert.ok(recentOpenBtn && recentOpenBtn.querySelector('.tm-icon'), 'B6: Tab 2 Open Chat button must use .btn-soft + SVG icon');
  const fetchesBeforeKey = fetchCalls.length;
  const keyEv = recentOpenBtn.dispatchEvent('keydown', { key: 'Enter' });
  assert.equal(keyEv.propagationStopped, true, 'B5: Tab 2 Open Chat button must stop keydown propagation');
  assert.equal(fetchCalls.length, fetchesBeforeKey, 'B5: Enter on Open Chat button must NOT trigger selectConversation');

  // #283 fix verifications: (1) Esc inside .list-search-input is not swallowed when drawer open;
  // (2) Esc on Tab 2 does not clear hidden Tab 1 pixelOfficeSelectedKey;
  // (3) buildGlobalTopSig detects real period.subscription field changes (proratedFee/paybackPct).
  api.setDrawerOpen(true);
  const escInSearch = { key: 'Escape', target: searchInput, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  for (const fn of docListeners.get('keydown') || []) fn(escInSearch);
  assert.equal(escInSearch.defaultPrevented, false, '#283: Esc inside .list-search-input must not call preventDefault');
  assert.equal(api.state.drawerOpen, true, '#283: Esc inside .list-search-input must not close settings drawer');
  api.setDrawerOpen(false);

  api.state.pixelOfficeSelectedKey = 'main';
  dispatchEsc();
  assert.equal(api.state.pixelOfficeSelectedKey, 'main', '#283: Esc on Tab 2 must not deselect hidden Tab 1 Pixel Office');
  api.state.pixelOfficeSelectedKey = '';

  const subSnap = makeSnap(100, 'IDLE');
  subSnap.global.periods.today.subscription = {
    planId: 'ai_pro',
    planLabel: 'Google AI Pro',
    isAutoDetected: true,
    monthlyFee: 19.99,
    proratedFee: 0.67,
    tokenCost: 0.5,
    netSavings: -0.17,
    roiMultiplier: 0.75,
    proratedDays: 1,
    paybackPct: 75,
    isPaidOff: false,
  };
  api.state.snapshot = subSnap;
  api.renderGlobalTab(subSnap);
  const topBeforeSubMut = api.state.globalDom.topStack.replaceChildrenCalls;
  subSnap.global.periods.today.subscription = {
    ...subSnap.global.periods.today.subscription,
    proratedFee: 1.33,
    tokenCost: 2.0,
    roiMultiplier: 1.5,
    proratedDays: 2,
    paybackPct: 150,
    isPaidOff: true,
  };
  api.renderGlobalTab(subSnap);
  assert.equal(api.state.globalDom.topStack.replaceChildrenCalls, topBeforeSubMut + 1, '#283: subscription field updates must invalidate globalTop sig');

  // English localization check for C1 & B6
  api.state.lang = 'en';
  api.renderGlobalTab(api.state.snapshot);
  assert.equal(globalContent.querySelector('#card-global-projects td.project-cell')?.textContent, 'Ungrouped', 'C1: empty workspace must label as Ungrouped in en');
  api.renderCacheCard(api.state.snapshot.current);
  assert.ok(fakeDocument.getElementById('card-cache').querySelector('.cache-seg-track')?.title.includes('Cache Read'));
});
// ============================================================================
// [MODIFIED END] 2026-11-20 15:45:47
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:21:36
// Description: Add regression tests for LiteLLM cache_read_input_token_cost parsing
// & legacy fallback, official-vs-reseller provider priority, family default cache
// discount fallbacks, and pricing_cache schemaVersion 3 v1/v2 non-destructive migration.
// ============================================================================
test('parseLiteLlmCatalog reads cache_read_input_token_cost, preserves legacy cache_read_input_cost_per_token fallback, and derives >200k tier from cache cost', () => {
  const realKeyParsed = parseLiteLlmCatalog({
    'anthropic/claude-opus-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 4.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 20.0e-6,
    },
    'anthropic/claude-sonnet-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.1e-6,
      output_cost_per_token: 10.0e-6,
    },
    'anthropic/claude-opus-4-6': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 5.0e-6,
      cache_read_input_token_cost: 0.5e-6,
      output_cost_per_token: 25.0e-6,
    },
    'anthropic/claude-sonnet-4-6': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 3.0e-6,
      cache_read_input_token_cost: 0.3e-6,
      output_cost_per_token: 15.0e-6,
    },
    'groq/openai/gpt-oss-120b': {
      litellm_provider: 'groq',
      mode: 'chat',
      input_cost_per_token: 0.15e-6,
      cache_read_input_token_cost: 0.075e-6,
      output_cost_per_token: 0.6e-6,
    },
  });

  assert.equal(realKeyParsed.profileRates['claude-opus-5-5'].inputPer1M, 4);
  assert.equal(realKeyParsed.profileRates['claude-opus-5-5'].cachedPer1M, 0.2);
  assert.equal(realKeyParsed.profileRates['claude-opus-5-5'].outputPer1M, 20);

  assert.equal(realKeyParsed.profileRates['claude-sonnet-5-5'].inputPer1M, 2);
  assert.equal(realKeyParsed.profileRates['claude-sonnet-5-5'].cachedPer1M, 0.1);
  assert.equal(realKeyParsed.profileRates['claude-sonnet-5-5'].outputPer1M, 10);

  assert.equal(realKeyParsed.upstreamPool['claude-opus-4-6'].inputPer1M, 5);
  assert.equal(realKeyParsed.upstreamPool['claude-opus-4-6'].cachedPer1M, 0.5);
  assert.equal(realKeyParsed.upstreamPool['claude-opus-4-6'].outputPer1M, 25);

  assert.equal(realKeyParsed.upstreamPool['claude-sonnet-4-6'].inputPer1M, 3);
  assert.equal(realKeyParsed.upstreamPool['claude-sonnet-4-6'].cachedPer1M, 0.3);
  assert.equal(realKeyParsed.upstreamPool['claude-sonnet-4-6'].outputPer1M, 15);

  assert.equal(realKeyParsed.profileRates['gpt-oss-120b'].inputPer1M, 0.15);
  assert.equal(realKeyParsed.profileRates['gpt-oss-120b'].cachedPer1M, 0.075);
  assert.equal(realKeyParsed.profileRates['gpt-oss-120b'].outputPer1M, 0.6);
  assert.equal(realKeyParsed.upstreamPool['gpt-oss-120b'].cachedPer1M, 0.075);

  // Backward compatibility with legacy cache_read_input_cost_per_token, precedence, zero cache cost, and >200k cache tier
  const compatParsed = parseLiteLlmCatalog({
    'anthropic/claude-opus-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 4.0e-6,
      cache_read_input_cost_per_token: 0.24e-6,
      output_cost_per_token: 20.0e-6,
    },
    'anthropic/claude-sonnet-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.1e-6,
      cache_read_input_cost_per_token: 0.4e-6,
      output_cost_per_token: 10.0e-6,
    },
    'anthropic/claude-haiku-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 1.0e-6,
      cache_read_input_token_cost: 0,
      output_cost_per_token: 5.0e-6,
    },
    'gemini/gemini-3.1-pro': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      cache_read_input_token_cost_above_200k_tokens: 0.4e-6,
      output_cost_per_token: 12.0e-6,
    },
  });

  assert.equal(compatParsed.profileRates['claude-opus-5-5'].cachedPer1M, 0.24);
  assert.equal(compatParsed.profileRates['claude-sonnet-5-5'].cachedPer1M, 0.1);
  assert.equal(compatParsed.upstreamPool['claude-haiku-5-5'].cachedPer1M, 0);
  assert.equal(compatParsed.profileRates['gemini-3.1-pro'].longContextTier, true);
  assert.equal(compatParsed.profileRates['gemini-3.1-pro'].longInputMultiplier, 2);
  assert.equal(compatParsed.profileRates['gemini-3.1-pro'].longOutputMultiplier, 1.5);
});

test('parseLiteLlmCatalog and parseModelsDevCatalog enforce official provider priority over resellers for Gemini 3.1 Pro, Claude, and GPT-OSS 120B', () => {
  // (a) Same-slug competition: resellers listed first must still lose to gemini / vertex_ai / anthropic
  const sameSlugParsed = parseLiteLlmCatalog({
    'deepinfra/google/gemini-3.1-pro': {
      litellm_provider: 'deepinfra',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 12.0e-6,
    },
    'openrouter/google/gemini-3.1-pro': {
      litellm_provider: 'openrouter',
      mode: 'chat',
      input_cost_per_token: 2.5e-6,
      cache_read_input_token_cost: 0.25e-6,
      output_cost_per_token: 15.0e-6,
    },
    'vertex_ai/gemini-3.1-pro': {
      litellm_provider: 'vertex_ai-language-models',
      mode: 'chat',
      input_cost_per_token: 2.1e-6,
      cache_read_input_token_cost: 0.21e-6,
      output_cost_per_token: 12.1e-6,
      input_cost_per_token_above_200k_tokens: 4.2e-6,
      output_cost_per_token_above_200k_tokens: 18.15e-6,
    },
    'gemini/gemini-3.1-pro': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 12.0e-6,
      input_cost_per_token_above_200k_tokens: 4.0e-6,
      output_cost_per_token_above_200k_tokens: 18.0e-6,
    },
    'deepinfra/anthropic/claude-opus-5-5': {
      litellm_provider: 'deepinfra',
      mode: 'chat',
      input_cost_per_token: 4.8e-6,
      cache_read_input_token_cost: 0.48e-6,
      output_cost_per_token: 24.0e-6,
    },
    'openrouter/anthropic/claude-opus-5-5': {
      litellm_provider: 'openrouter',
      mode: 'chat',
      input_cost_per_token: 4.4e-6,
      cache_read_input_token_cost: 0.44e-6,
      output_cost_per_token: 22.0e-6,
    },
    'vertex_ai/claude-opus-5-5': {
      litellm_provider: 'vertex_ai-anthropic_models',
      mode: 'chat',
      input_cost_per_token: 4.4e-6,
      cache_read_input_token_cost: 0.22e-6,
      output_cost_per_token: 22.0e-6,
    },
    'anthropic/claude-opus-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 4.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 20.0e-6,
    },
    'openrouter/anthropic/claude-sonnet-5-5': {
      litellm_provider: 'openrouter',
      mode: 'chat',
      input_cost_per_token: 2.5e-6,
      cache_read_input_token_cost: 0.25e-6,
      output_cost_per_token: 12.5e-6,
    },
    'vertex_ai/claude-sonnet-5-5': {
      litellm_provider: 'vertex_ai-anthropic_models',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.1e-6,
      output_cost_per_token: 10.0e-6,
    },
  });

  assert.equal(sameSlugParsed.profileRates['gemini-3.1-pro'].provider, 'gemini');
  assert.equal(sameSlugParsed.profileRates['gemini-3.1-pro'].longContextTier, true);
  assert.equal(sameSlugParsed.profileRates['gemini-3.1-pro'].longInputMultiplier, 2);
  assert.equal(sameSlugParsed.profileRates['gemini-3.1-pro'].longOutputMultiplier, 1.5);

  assert.equal(sameSlugParsed.profileRates['claude-opus-5-5'].provider, 'anthropic');
  assert.equal(sameSlugParsed.profileRates['claude-opus-5-5'].inputPer1M, 4);
  assert.equal(sameSlugParsed.profileRates['claude-opus-5-5'].cachedPer1M, 0.2);
  assert.equal(sameSlugParsed.profileRates['claude-opus-5-5'].outputPer1M, 20);

  assert.equal(sameSlugParsed.profileRates['claude-sonnet-5-5'].provider, 'vertex_ai-anthropic_models');
  assert.equal(sameSlugParsed.profileRates['claude-sonnet-5-5'].inputPer1M, 2);
  assert.equal(sameSlugParsed.profileRates['claude-sonnet-5-5'].cachedPer1M, 0.1);
  assert.equal(sameSlugParsed.profileRates['claude-sonnet-5-5'].outputPer1M, 10);

  // (b) Cross-alias competition: official gemini/gemini-3.1-pro-preview beats reseller deepinfra/google/gemini-3.1-pro
  const crossAliasGemini = parseLiteLlmCatalog({
    'deepinfra/google/gemini-3.1-pro': {
      litellm_provider: 'deepinfra',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 12.0e-6,
    },
    'gemini/gemini-3.1-pro-preview': {
      litellm_provider: 'gemini',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 12.0e-6,
      input_cost_per_token_above_200k_tokens: 4.0e-6,
      output_cost_per_token_above_200k_tokens: 18.0e-6,
    },
  });

  assert.equal(crossAliasGemini.profileRates['gemini-3.1-pro'].provider, 'gemini');
  assert.equal(crossAliasGemini.profileRates['gemini-3.1-pro'].longContextTier, true);
  assert.equal(crossAliasGemini.profileRates['gemini-3.1-pro'].longInputMultiplier, 2);
  assert.equal(crossAliasGemini.profileRates['gemini-3.1-pro'].longOutputMultiplier, 1.5);
  assert.deepEqual(
    crossAliasGemini.googleCandidates.map((c) => c.id),
    ['gemini-3.1-pro-preview'],
  );

  // (c) Unprefixed reseller key with litellm_provider='openrouter' loses to vertex_ai preview alias
  const vertexVsReseller = parseLiteLlmCatalog({
    'gemini-3.1-pro': {
      litellm_provider: 'openrouter',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 12.0e-6,
    },
    'vertex_ai/gemini-3.1-pro-preview': {
      litellm_provider: 'vertex_ai-language-models',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      cache_read_input_token_cost: 0.2e-6,
      output_cost_per_token: 12.0e-6,
      input_cost_per_token_above_200k_tokens: 4.0e-6,
      output_cost_per_token_above_200k_tokens: 18.0e-6,
    },
  });

  assert.equal(vertexVsReseller.profileRates['gemini-3.1-pro'].provider, 'vertex_ai-language-models');
  assert.equal(vertexVsReseller.profileRates['gemini-3.1-pro'].longContextTier, true);
  assert.deepEqual(
    vertexVsReseller.googleCandidates.map((c) => c.id),
    ['gemini-3.1-pro-preview'],
  );

  // (d) models.dev gpt-oss-120b scoring: discounted Groq beats 0%-discount OpenRouter; OpenAI still beats both
  const devGroqVsOr = parseModelsDevCatalog({
    openrouter: {
      models: {
        'openai/gpt-oss-120b': {
          id: 'openai/gpt-oss-120b',
          name: 'GPT-OSS 120B (OR)',
          cost: { input: 0.05, cache_read: 0.05, output: 0.25 },
        },
      },
    },
    groq: {
      models: {
        'openai/gpt-oss-120b': {
          id: 'openai/gpt-oss-120b',
          name: 'GPT-OSS 120B (Groq)',
          cost: { input: 0.15, cache_read: 0.075, output: 0.6 },
        },
      },
    },
  });

  assert.equal(devGroqVsOr.profileRates['gpt-oss-120b'].provider, 'groq');
  assert.equal(devGroqVsOr.profileRates['gpt-oss-120b'].inputPer1M, 0.15);
  assert.equal(devGroqVsOr.profileRates['gpt-oss-120b'].cachedPer1M, 0.075);
  assert.equal(devGroqVsOr.profileRates['gpt-oss-120b'].outputPer1M, 0.6);

  const devOpenAiWins = parseModelsDevCatalog({
    openrouter: {
      models: {
        'openai/gpt-oss-120b': {
          id: 'openai/gpt-oss-120b',
          cost: { input: 0.05, cache_read: 0.05, output: 0.25 },
        },
      },
    },
    groq: {
      models: {
        'openai/gpt-oss-120b': {
          id: 'openai/gpt-oss-120b',
          cost: { input: 0.15, cache_read: 0.075, output: 0.6 },
        },
      },
    },
    openai: {
      models: {
        'gpt-oss-120b': {
          id: 'gpt-oss-120b',
          cost: { input: 0.14, cache_read: 0.07, output: 0.56 },
        },
      },
    },
  });

  assert.equal(devOpenAiWins.profileRates['gpt-oss-120b'].provider, 'openai');
  assert.equal(devOpenAiWins.profileRates['gpt-oss-120b'].cachedPer1M, 0.07);
});

test('missing cache_read fallback defaults to family discount rates (0.05x Opus/Sonnet 5.5, 0.10x older Claude/Haiku, 0.50x GPT-OSS, 1.0x unknown)', () => {
  // (a) Via parseLiteLlmCatalog when cache_read keys are absent
  const liteNoCache = parseLiteLlmCatalog({
    'anthropic/claude-opus-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 4.0e-6,
      output_cost_per_token: 20.0e-6,
    },
    'anthropic/claude-sonnet-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 2.0e-6,
      output_cost_per_token: 10.0e-6,
    },
    'anthropic/claude-opus-4-6': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 5.0e-6,
      output_cost_per_token: 25.0e-6,
    },
    'anthropic/claude-sonnet-4-6': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 3.0e-6,
      output_cost_per_token: 15.0e-6,
    },
    'anthropic/claude-haiku-5-5': {
      litellm_provider: 'anthropic',
      mode: 'chat',
      input_cost_per_token: 1.0e-6,
      output_cost_per_token: 5.0e-6,
    },
    'groq/openai/gpt-oss-120b': {
      litellm_provider: 'groq',
      mode: 'chat',
      input_cost_per_token: 0.15e-6,
      output_cost_per_token: 0.6e-6,
    },
    'openai/gpt-5.2': {
      litellm_provider: 'openai',
      mode: 'chat',
      input_cost_per_token: 2.5e-6,
      output_cost_per_token: 10.0e-6,
    },
  });

  assert.equal(liteNoCache.profileRates['claude-opus-5-5'].cachedPer1M, 0.2);
  assert.equal(liteNoCache.profileRates['claude-sonnet-5-5'].cachedPer1M, 0.1);
  assert.equal(liteNoCache.upstreamPool['claude-opus-4-6'].cachedPer1M, 0.5);
  assert.equal(liteNoCache.upstreamPool['claude-sonnet-4-6'].cachedPer1M, 0.3);
  assert.equal(liteNoCache.upstreamPool['claude-haiku-5-5'].cachedPer1M, 0.1);
  assert.equal(liteNoCache.profileRates['gpt-oss-120b'].cachedPer1M, 0.075);
  assert.equal(liteNoCache.upstreamPool['gpt-5.2'].cachedPer1M, 2.5);

  // (b) Via parseModelsDevCatalog when cost.cache_read is undefined / null / empty string
  const devNoCache = parseModelsDevCatalog({
    anthropic: {
      models: {
        'claude-opus-5-5': { id: 'claude-opus-5-5', cost: { input: 4.0, output: 20.0 } },
        'claude-sonnet-5-5': { id: 'claude-sonnet-5-5', cost: { input: 2.0, cache_read: null, output: 10.0 } },
        'claude-opus-4-6': { id: 'claude-opus-4-6', cost: { input: 5.0, cache_read: '', output: 25.0 } },
        'claude-haiku-5-5': { id: 'claude-haiku-5-5', cost: { input: 1.0, output: 5.0 } },
      },
    },
    groq: {
      models: {
        'gpt-oss-120b': { id: 'gpt-oss-120b', cost: { input: 0.15, output: 0.6 } },
      },
    },
    openai: {
      models: {
        'gpt-5.2': { id: 'gpt-5.2', cost: { input: 2.5, output: 10.0 } },
      },
    },
  });

  assert.equal(devNoCache.profileRates['claude-opus-5-5'].cachedPer1M, 0.2);
  assert.equal(devNoCache.profileRates['claude-sonnet-5-5'].cachedPer1M, 0.1);
  assert.equal(devNoCache.upstreamPool['claude-opus-4-6'].cachedPer1M, 0.5);
  assert.equal(devNoCache.upstreamPool['claude-haiku-5-5'].cachedPer1M, 0.1);
  assert.equal(devNoCache.profileRates['gpt-oss-120b'].cachedPer1M, 0.075);
  assert.equal(devNoCache.upstreamPool['gpt-5.2'].cachedPer1M, 2.5);
});

test('pricing_cache schemaVersion 3 non-destructive migration heals v1 and poisoned v2 caches offline and bills Claude cache reads accurately', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tm-v052-cache-v3-migrate-'));
  const fixedNowMs = Date.UTC(2026, 10, 23, 2, 0, 0);
  const todayLocal = formatLocalDate(fixedNowMs);
  try {
    // (a) v1 -> v3 migration: heals Gemini 4 longContextTier + poisoned Claude/GPT-OSS + reseller gemini-3.1-pro
    const dirV1 = join(root, 'v1');
    mkdirSync(dirV1, { recursive: true });
    writeFileSync(
      join(dirV1, 'pricing_cache.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          lastSyncLocalDate: todayLocal,
          lastSyncAtMs: fixedNowMs - 60000,
          lastAttemptAtMs: fixedNowMs,
          status: 'ok',
          sources: ['litellm'],
          error: '',
          usdToCnyRate: 7.2105,
          fxSource: 'frankfurter.dev',
          fxLastSyncLocalDate: todayLocal,
          fxAttemptLocalDate: todayLocal,
          syncedRates: {
            'gemini-4-carbon': {
              inputPer1M: 2.0,
              cachedPer1M: 0.1,
              outputPer1M: 10.0,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
            'claude-opus-5-5': {
              inputPer1M: 4.0,
              cachedPer1M: 4.0,
              outputPer1M: 20.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'claude-sonnet-5-5': {
              inputPer1M: 2.0,
              cachedPer1M: 2.0,
              outputPer1M: 10.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'gpt-oss-120b': {
              inputPer1M: 0.15,
              cachedPer1M: 0.15,
              outputPer1M: 0.6,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'groq',
              source: 'litellm',
            },
            'gemini-3.1-pro': {
              inputPer1M: 2.0,
              cachedPer1M: 0.2,
              outputPer1M: 12.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'deepinfra',
              source: 'litellm',
            },
          },
          upstreamPool: {
            'gemini-4-carbon': {
              id: 'gemini-4-carbon',
              label: 'Gemini 4 Carbon',
              group: 'Gemini 系列',
              inputPer1M: 2.0,
              cachedPer1M: 0.1,
              outputPer1M: 10.0,
              longContextTier: true,
              longInputMultiplier: 2,
              longOutputMultiplier: 1.5,
            },
            'claude-opus-4-6': {
              id: 'claude-opus-4-6',
              label: 'Claude Opus 4.6',
              group: 'Claude 系列',
              inputPer1M: 5.0,
              cachedPer1M: 5.0,
              outputPer1M: 25.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'claude-haiku-5-5': {
              id: 'claude-haiku-5-5',
              label: 'Claude Haiku 5.5',
              group: 'Claude 系列',
              inputPer1M: 1.0,
              cachedPer1M: 1.0,
              outputPer1M: 5.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
          },
          discoveredModels: [],
        },
        null,
        2,
      ),
      'utf-8',
    );

    const mgrV1 = createPricingSyncManager({
      stateDir: dirV1,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => fixedNowMs,
      autoSyncDisabled: true,
    });
    const statusV1 = mgrV1.getPublicStatus();
    assert.equal(statusV1.lastSyncLocalDate, '');
    assert.equal(statusV1.lastAttemptAtMs, null);
    assert.equal(statusV1.usdToCnyRate, 7.2105);
    assert.equal(statusV1.fxSource, 'frankfurter.dev');
    assert.equal(statusV1.fxLastSyncLocalDate, todayLocal);

    const catV1 = new Map(mgrV1.getRuntimeCatalog().map((m) => [m.id, m]));
    assert.equal(catV1.get('gemini-4-carbon').longContextTier, false);
    assert.equal(catV1.get('gemini-4-carbon').longInputMultiplier, 1);
    assert.equal(catV1.get('gemini-4-carbon').longOutputMultiplier, 1);
    assert.equal(catV1.get('claude-opus-5-5').cachedPer1M, 0.2);
    assert.equal(catV1.get('claude-sonnet-5-5').cachedPer1M, 0.1);
    assert.equal(catV1.get('gpt-oss-120b').cachedPer1M, 0.075);
    assert.equal(catV1.get('gemini-3.1-pro').longContextTier, true);
    assert.equal(catV1.get('gemini-3.1-pro').longInputMultiplier, 2);
    assert.equal(catV1.get('gemini-3.1-pro').longOutputMultiplier, 1.5);

    const poolOnlyV1 = createPricingSyncManager({
      stateDir: dirV1,
      baseCatalog: [MODEL_PRICING_CATALOG.at(-1)],
      nowFn: () => fixedNowMs,
      autoSyncDisabled: true,
    });
    const poolCatV1 = new Map(
      poolOnlyV1
        .getRuntimeCatalog(['gemini-4-carbon', 'claude-opus-4-6', 'claude-haiku-5-5'])
        .map((m) => [m.id, m]),
    );
    assert.equal(poolCatV1.get('gemini-4-carbon').longContextTier, false);
    assert.equal(poolCatV1.get('claude-opus-4-6').cachedPer1M, 0.5);
    assert.equal(poolCatV1.get('claude-haiku-5-5').cachedPer1M, 0.1);

    // (b) Poisoned v2 -> v3 migration: offline healing, computeStepCost billing, and immediate resync to v3
    const dirV2 = join(root, 'v2');
    mkdirSync(dirV2, { recursive: true });
    const v2CachePath = join(dirV2, 'pricing_cache.json');
    writeFileSync(
      v2CachePath,
      JSON.stringify(
        {
          schemaVersion: 2,
          lastSyncLocalDate: todayLocal,
          lastSyncAtMs: fixedNowMs - 60000,
          lastAttemptAtMs: fixedNowMs,
          status: 'ok',
          sources: ['litellm', 'google-official'],
          error: '',
          usdToCnyRate: 7.1888,
          fxSource: 'open.er-api.com',
          fxLastSyncLocalDate: todayLocal,
          fxAttemptLocalDate: todayLocal,
          syncedRates: {
            'claude-opus-5-5': {
              inputPer1M: 4.0,
              cachedPer1M: 4.0,
              outputPer1M: 20.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'claude-sonnet-5-5': {
              inputPer1M: 2.0,
              cachedPer1M: 2.0,
              outputPer1M: 10.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'gpt-oss-120b': {
              inputPer1M: 0.15,
              cachedPer1M: 0.15,
              outputPer1M: 0.6,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'groq',
              source: 'litellm',
            },
            'gemini-3.1-pro': {
              inputPer1M: 2.0,
              cachedPer1M: 0.2,
              outputPer1M: 12.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'deepinfra',
              source: 'litellm',
            },
          },
          upstreamPool: {
            'claude-opus-5-5': {
              id: 'claude-opus-5-5',
              label: 'Claude Opus 5.5',
              group: 'Claude 系列',
              inputPer1M: 4.0,
              cachedPer1M: 4.0,
              outputPer1M: 20.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'claude-sonnet-5-5': {
              id: 'claude-sonnet-5-5',
              label: 'Claude Sonnet 5.5',
              group: 'Claude 系列',
              inputPer1M: 2.0,
              cachedPer1M: 2.0,
              outputPer1M: 10.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'anthropic',
              source: 'litellm',
            },
            'gpt-oss-120b': {
              id: 'gpt-oss-120b',
              label: 'GPT-OSS 120B',
              group: '其他现役模型',
              inputPer1M: 0.15,
              cachedPer1M: 0.15,
              outputPer1M: 0.6,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'groq',
              source: 'litellm',
            },
            'gemini-3.1-pro': {
              id: 'gemini-3.1-pro',
              label: 'Gemini 3.1 Pro',
              group: 'Gemini 系列',
              inputPer1M: 2.0,
              cachedPer1M: 0.2,
              outputPer1M: 12.0,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'deepinfra',
              source: 'litellm',
            },
          },
          discoveredModels: [],
        },
        null,
        2,
      ),
      'utf-8',
    );

    const mgrV2Offline = createPricingSyncManager({
      stateDir: dirV2,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => fixedNowMs,
      autoSyncDisabled: true,
    });
    const statusV2 = mgrV2Offline.getPublicStatus();
    assert.equal(statusV2.lastSyncLocalDate, '');
    assert.equal(statusV2.lastAttemptAtMs, null);
    assert.equal(statusV2.usdToCnyRate, 7.1888);
    assert.equal(statusV2.fxSource, 'open.er-api.com');
    assert.equal(statusV2.fxLastSyncLocalDate, todayLocal);
    assert.equal(mgrV2Offline.getSyncedCnyRate(), 7.1888);

    const healedRuntimeCatalog = mgrV2Offline.getRuntimeCatalog();
    const catV2 = new Map(healedRuntimeCatalog.map((m) => [m.id, m]));
    assert.equal(catV2.get('claude-opus-5-5').inputPer1M, 4);
    assert.equal(catV2.get('claude-opus-5-5').cachedPer1M, 0.2);
    assert.equal(catV2.get('claude-opus-5-5').outputPer1M, 20);
    assert.equal(catV2.get('claude-sonnet-5-5').inputPer1M, 2);
    assert.equal(catV2.get('claude-sonnet-5-5').cachedPer1M, 0.1);
    assert.equal(catV2.get('claude-sonnet-5-5').outputPer1M, 10);
    assert.equal(catV2.get('gpt-oss-120b').inputPer1M, 0.15);
    assert.equal(catV2.get('gpt-oss-120b').cachedPer1M, 0.075);
    assert.equal(catV2.get('gpt-oss-120b').outputPer1M, 0.6);
    assert.equal(catV2.get('gemini-3.1-pro').inputPer1M, 2);
    assert.equal(catV2.get('gemini-3.1-pro').cachedPer1M, 0.2);
    assert.equal(catV2.get('gemini-3.1-pro').outputPer1M, 12);
    assert.equal(catV2.get('gemini-3.1-pro').longContextTier, true);
    assert.equal(catV2.get('gemini-3.1-pro').longInputMultiplier, 2);
    assert.equal(catV2.get('gemini-3.1-pro').longOutputMultiplier, 1.5);

    // Verify upstreamPool entries were also healed/dropped in v2 -> v3 load
    const poolOnlyV2 = createPricingSyncManager({
      stateDir: dirV2,
      baseCatalog: [MODEL_PRICING_CATALOG.at(-1)],
      nowFn: () => fixedNowMs,
      autoSyncDisabled: true,
    });
    const poolCatV2 = new Map(
      poolOnlyV2
        .getRuntimeCatalog(['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-oss-120b', 'gemini-3.1-pro'])
        .map((m) => [m.id, m]),
    );
    assert.equal(poolCatV2.get('claude-opus-5-5').cachedPer1M, 0.2);
    assert.equal(poolCatV2.get('claude-sonnet-5-5').cachedPer1M, 0.1);
    assert.equal(poolCatV2.get('gpt-oss-120b').cachedPer1M, 0.075);
    assert.equal(poolCatV2.get('gemini-3.1-pro').longContextTier, true);

    // Verify computeStepCost bills $0.20/1M (Opus 5.5) & $0.10/1M (Sonnet 5.5) on cache reads
    const healedPrefs = { ...DEFAULT_PREFS, _runtimeCatalog: healedRuntimeCatalog };
    const oneMillionCacheRead = { input_tokens: 0, cache_read_tokens: 1_000_000, output_tokens: 0 };

    const opusCacheCost = computeStepCost(oneMillionCacheRead, healedPrefs, 'claude-opus-5-5');
    assert.ok(Math.abs(opusCacheCost.costActual - 0.2) < 1e-9);
    assert.ok(Math.abs(opusCacheCost.costUncachedBaseline - 4.0) < 1e-9);
    assert.ok(Math.abs(opusCacheCost.costSavedByCache - 3.8) < 1e-9);

    const sonnetCacheCost = computeStepCost(oneMillionCacheRead, healedPrefs, 'claude-sonnet-5-5');
    assert.ok(Math.abs(sonnetCacheCost.costActual - 0.1) < 1e-9);
    assert.ok(Math.abs(sonnetCacheCost.costUncachedBaseline - 2.0) < 1e-9);
    assert.ok(Math.abs(sonnetCacheCost.costSavedByCache - 1.9) < 1e-9);

    const gptOssCacheCost = computeStepCost(oneMillionCacheRead, healedPrefs, 'gpt-oss-120b');
    assert.ok(Math.abs(gptOssCacheCost.costActual - 0.075) < 1e-9);

    const opusMixedCost = computeStepCost(
      { input_tokens: 100_000, cache_read_tokens: 1_000_000, output_tokens: 50_000 },
      healedPrefs,
      'claude-opus-5-5',
    );
    assert.ok(Math.abs(opusMixedCost.costActual - 1.6) < 1e-9);

    const g31LongCost = computeStepCost(
      { input_tokens: 100_000, cache_read_tokens: 200_000, output_tokens: 10_000 },
      healedPrefs,
      'gemini-3.1-pro',
    );
    assert.ok(Math.abs(g31LongCost.costActual - 0.66) < 1e-9);

    // Migrated v2 cache immediately triggers daily sync and persists schemaVersion === 3 while preserving FX
    const mgrV2Sync = createPricingSyncManager({
      stateDir: dirV2,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => fixedNowMs,
      autoSyncDisabled: false,
      fetchImpl: async (url) => {
        if (url.includes('models.dev')) {
          return { ok: false, status: 503, json: async () => ({}) };
        }
        if (url.includes('litellm')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              'anthropic/claude-opus-5-5': {
                litellm_provider: 'anthropic',
                mode: 'chat',
                input_cost_per_token: 4.0e-6,
                cache_read_input_token_cost: 0.2e-6,
                output_cost_per_token: 20.0e-6,
              },
              'anthropic/claude-sonnet-5-5': {
                litellm_provider: 'anthropic',
                mode: 'chat',
                input_cost_per_token: 2.0e-6,
                cache_read_input_token_cost: 0.1e-6,
                output_cost_per_token: 10.0e-6,
              },
            }),
          };
        }
        return { ok: false, status: 503, text: async () => '' };
      },
    });
    let resyncResolve;
    const resyncDone = new Promise((r) => {
      resyncResolve = r;
    });
    assert.equal(
      mgrV2Sync.maybeTriggerDailySync([], (res) => resyncResolve(res)),
      true,
    );
    const resyncRes = await resyncDone;
    assert.equal(resyncRes.ok, true);

    const persistedV3 = JSON.parse(readFileSync(v2CachePath, 'utf-8'));
    assert.equal(persistedV3.schemaVersion, 3);
    assert.equal(persistedV3.lastSyncLocalDate, todayLocal);
    assert.equal(persistedV3.usdToCnyRate, 7.1888);
    assert.equal(persistedV3.fxLastSyncLocalDate, todayLocal);
    assert.equal(persistedV3.syncedRates['claude-opus-5-5'].cachedPer1M, 0.2);
    assert.equal(persistedV3.syncedRates['claude-sonnet-5-5'].cachedPer1M, 0.1);

    // Reloading persisted v3 cache on the same day must preserve lastSyncLocalDate and skip redundant resync
    const mgrV3Reload = createPricingSyncManager({
      stateDir: dirV2,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => fixedNowMs,
      autoSyncDisabled: false,
      fetchImpl: async () => {
        throw new Error('should not fetch on same-day v3 cache');
      },
    });
    assert.equal(mgrV3Reload.getPublicStatus().lastSyncLocalDate, todayLocal);
    assert.equal(mgrV3Reload.maybeTriggerDailySync([], () => {}), false);

    // (c) Poisoned v2 models.dev openrouter 0%-discount gpt-oss-120b is dropped so base $0.15/$0.075/$0.60 applies
    const dirV2Or = join(root, 'v2-openrouter');
    mkdirSync(dirV2Or, { recursive: true });
    writeFileSync(
      join(dirV2Or, 'pricing_cache.json'),
      JSON.stringify(
        {
          schemaVersion: 2,
          lastSyncLocalDate: todayLocal,
          status: 'ok',
          sources: ['models.dev'],
          usdToCnyRate: 7.2,
          fxSource: 'frankfurter.dev',
          fxLastSyncLocalDate: todayLocal,
          fxAttemptLocalDate: todayLocal,
          syncedRates: {
            'gpt-oss-120b': {
              inputPer1M: 0.05,
              cachedPer1M: 0.05,
              outputPer1M: 0.25,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'openrouter',
              source: 'models.dev',
            },
          },
          upstreamPool: {
            'gpt-oss-120b': {
              id: 'gpt-oss-120b',
              label: 'GPT-OSS 120B',
              group: '其他现役模型',
              inputPer1M: 0.05,
              cachedPer1M: 0.05,
              outputPer1M: 0.25,
              longContextTier: false,
              longInputMultiplier: 1,
              longOutputMultiplier: 1,
              provider: 'openrouter',
              source: 'models.dev',
            },
          },
          discoveredModels: [],
        },
        null,
        2,
      ),
      'utf-8',
    );
    const mgrV2Or = createPricingSyncManager({
      stateDir: dirV2Or,
      baseCatalog: MODEL_PRICING_CATALOG,
      nowFn: () => fixedNowMs,
      autoSyncDisabled: true,
    });
    const orHealedGptOss = mgrV2Or.getRuntimeCatalog().find((m) => m.id === 'gpt-oss-120b');
    assert.equal(orHealedGptOss.inputPer1M, 0.15);
    assert.equal(orHealedGptOss.cachedPer1M, 0.075);
    assert.equal(orHealedGptOss.outputPer1M, 0.6);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
// ============================================================================
// [MODIFIED END] 2026-11-23 10:21:36
// ============================================================================
