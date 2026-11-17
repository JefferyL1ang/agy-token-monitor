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
import { spawn } from 'node:child_process';
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
import { createServer } from 'node:http';
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
  computeSpeed,
  computeStepCost,
  computeSubscriptionComparison,
  createMetadataStore,
  createUsageLedger,
  detectSubscriptionPlanFromProfiles,
  discoverAppDataDirs,
  formatLocalDate,
  isValidConversationId,
  normalizeModelId,
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
  compareSemver,
  createReleaseUpdater,
  normalizeReleaseTag,
  parseSemver,
  parseZipBuffer,
} from '../sidecars/monitor_pane/release_updater.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-17 18:54:00
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
    const byModelNames = res.totals.byModel.map((m) => m.model).sort();
    assert.deepEqual(byModelNames, ['gemini-2.5-pro', 'gemini-3.8-flash']);

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
    assert.equal(DEFAULT_PREFS.softContextLimit, 400000);
    assert.equal(DEFAULT_PREFS.hardContextLimit, 500000);
    assert.equal(DEFAULT_PREFS.tokenUnit, 'auto');
    assert.equal(DEFAULT_PREFS.language, 'zh');
    assert.deepEqual([...VALID_TOKEN_UNITS], ['auto', 'wan_yi', 'exact', 'm']);
    assert.deepEqual([...VALID_LANGUAGES], ['zh', 'en']);

    // HEALTHY (< 400k)
    writeConversation(appData, convId, { compactLines: makeLines(150000) });
    const h = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(h.context.usageLevel, 'HEALTHY');
    assert.equal(h.context.watermarkLevel, 'HEALTHY');
    assert.equal(h.context.softLimit, 400000);
    assert.equal(h.context.hardLimit, 500000);
    assert.equal(h.context.currentTotal, 150000);
    assert.equal(h.context.latestCacheHitRatePct, 40);
    assert.equal(h.context.latestNetDelta, 80000);
    assert.equal(h.context.topSpikes[0].stepIndex, 5);
    assert.equal(h.context.topSpikes[0].deltaTokens, 80000);
    assert.equal(h.context.topSpikes[0].triggerSummary, 'Dump huge build log');
    assert.equal(h.context.topSpikes[1].triggerSummary, 'Read big1.ts');

    // Still HEALTHY just below 400k
    writeConversation(appData, convId, {
      compactLines: makeLines(399999),
      mtimeMs: Date.now() + 1000,
    });
    const hBorder = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(hBorder.context.usageLevel, 'HEALTHY');

    // WARNING (>= 400k, < 460k)
    writeConversation(appData, convId, {
      compactLines: makeLines(430000),
      mtimeMs: Date.now() + 2000,
    });
    const w = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(w.context.usageLevel, 'WARNING');
    assert.equal(w.context.watermarkLevel, 'WARNING');

    // CRITICAL (>= 460k, i.e. 92% of 500k)
    writeConversation(appData, convId, {
      compactLines: makeLines(460000),
      mtimeMs: Date.now() + 4000,
    });
    const c = analyzeConversation(convId, { appDataDirs: [appData], disableAgentApi: true });
    assert.equal(c.context.usageLevel, 'CRITICAL');
    assert.equal(c.context.watermarkLevel, 'CRITICAL');
    assert.equal(c.context.hardUsagePct, 92);
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
  assert.equal(MODEL_PRICING_CATALOG.length, 9);
  assert.equal(resolveModelProfile('Gemini 3.1 Pro (High)').id, 'gemini-3.1-pro');
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
  assert.equal(resolveModelProfile('Gemini 4 Carbon (High)').id, 'gemini-4-carbon');
  assert.equal(resolveModelProfile('Orchestrator (Carbon)').id, 'gemini-4-carbon');
  assert.equal(resolveModelProfile('Gemini 4 Argon (Low)').id, 'gemini-4-argon');
  assert.equal(resolveModelProfile('Orchestrator (Argon)').id, 'gemini-4-argon');
  assert.equal(resolveModelProfile('Gemini 4 Hydrogen (XHigh)').id, 'gemini-4-hydrogen');
  assert.equal(resolveModelProfile('Gemini 3.8 Flash (High)').id, 'gemini-3-8-flash');
  assert.equal(resolveModelProfile('gemini-flash-worker-agy').id, 'gemini-3-8-flash');
  assert.equal(resolveModelProfile('Claude Opus 5.5 (High)').id, 'claude-opus-5-5');
  assert.equal(resolveModelProfile('Claude Sonnet 5.5 (Medium)').id, 'claude-sonnet-5-5');
  assert.equal(resolveModelProfile('GPT-OSS 120B (Medium)').id, 'gpt-oss-120b');
  assert.equal(resolveModelProfile('Auto').id, 'auto');

  const step200k = {
    input_tokens: 50000,
    cache_read_tokens: 150000,
    output_tokens: 10000,
  };
  // Gemini 4 Carbon <= 200k: (50k/1M)*2.0 + (150k/1M)*0.20 + (10k/1M)*10.0 = 0.10 + 0.03 + 0.10 = 0.23
  const carbonBase = computeStepCost(step200k, DEFAULT_PREFS, 'Gemini 4 Carbon (High)');
  assert.ok(Math.abs(carbonBase.costActual - 0.23) < 1e-9);

  // Claude Opus 5.5 (4.0 / 0.20 / 20.0, flat >200k): (50k/1M)*4 + (150k/1M)*0.2 + (10k/1M)*20 = 0.2 + 0.03 + 0.2 = 0.43
  const opusCost = computeStepCost(step200k, DEFAULT_PREFS, 'Claude Opus 5.5 (High)');
  assert.ok(Math.abs(opusCost.costActual - 0.43) < 1e-9);

  // Claude Sonnet 5.5 (2.0 / 0.10 / 10.0): 0.10 + 0.015 + 0.10 = 0.215
  const sonnetCost = computeStepCost(step200k, DEFAULT_PREFS, 'Claude Sonnet 5.5 (High)');
  assert.ok(Math.abs(sonnetCost.costActual - 0.215) < 1e-9);

  // Long-context tier (> 200k) on Gemini 4 Carbon triggers 2.0x input/cached and 1.5x output
  const longStep = {
    input_tokens: 100000,
    cache_read_tokens: 200000,
    output_tokens: 10000,
  };
  // (100k/1M)*4.0 + (200k/1M)*0.40 + (10k/1M)*15.0 = 0.40 + 0.08 + 0.15 = 0.63
  const carbonLong = computeStepCost(longStep, DEFAULT_PREFS, 'Gemini 4 Carbon (High)');
  assert.ok(Math.abs(carbonLong.costActual - 0.63) < 1e-9);

  // Disabling longContextTier via modelOverrides on gemini-4-carbon
  const noLongPrefs = {
    ...DEFAULT_PREFS,
    modelOverrides: {
      'gemini-4-carbon': { inputPer1M: 2.0, cachedPer1M: 0.2, outputPer1M: 10.0, longContextTier: false },
    },
  };
  // (100k/1M)*2.0 + (200k/1M)*0.20 + (10k/1M)*10.0 = 0.20 + 0.04 + 0.10 = 0.34
  const flatCarbon = computeStepCost(longStep, noLongPrefs, 'Gemini 4 Carbon (High)');
  assert.ok(Math.abs(flatCarbon.costActual - 0.34) < 1e-9);

  // CNY currency conversion scales by cnyRate
  const cnyPrefs = { ...DEFAULT_PREFS, currency: 'CNY', cnyRate: 7.25 };
  const opusCny = computeStepCost(step200k, cnyPrefs, 'Claude Opus 5.5 (High)');
  assert.ok(Math.abs(opusCny.costActual - 0.43 * 7.25) < 1e-9);
});

test('subscription auto-detection and prorated netSavings / ROI comparison', () => {
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-4-carbon'])), 'ultra_5x');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['claude-opus-5-5'])), 'ultra_5x');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-4-argon'])), 'pro');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['claude-sonnet-5-5'])), 'pro');
  assert.equal(detectSubscriptionPlanFromProfiles(new Set(['gemini-3-8-flash'])), 'free');

  const subUltra = resolveSubscriptionInfo(DEFAULT_PREFS, new Set(['claude-opus-5-5', 'gemini-4-hydrogen']));
  assert.equal(subUltra.planId, 'ultra_5x');
  assert.equal(subUltra.monthlyUsd, 99.99);
  assert.equal(subUltra.isAutoDetected, true);

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
});

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
    assert.equal(snap.prefs.softContextLimit, 400000);
    assert.equal(snap.prefs.hardContextLimit, 500000);
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
        hardContextLimit: 500000,
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
    assert.equal(saved.prefsSchemaVersion, 3);
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
    assert.equal(snap3.pricingCatalog.length, 9);
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
  assert.equal(normalizeModelId('gemini-flash-worker-agy', 'Gemini 4 Hydrogen (Orchestrator)'), 'gemini-flash-worker-agy');
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
  assert.equal(normalizeModelId('Pro'), 'gemini-4-carbon');
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
// [MODIFIED BEGIN] 2026-11-17 11:50:00
// Description: Verify gemini-3.1-pro and gemini-pro-default resolve to dedicated gemini-3.1-pro tier.
// ============================================================================
  assert.equal(resolveModelProfile('gemini-3.1-pro').id, 'gemini-3.1-pro');
  assert.equal(resolveModelProfile('gemini-pro-default').id, 'gemini-3.1-pro');
// ============================================================================
// [MODIFIED END] 2026-11-17 11:50:00
// ============================================================================
  assert.equal(resolveModelProfile('gemini-3.8-flash-n').id, 'gemini-3-8-flash');
  assert.equal(resolveModelProfile('gemini-flash-worker-agy').id, 'gemini-3-8-flash');
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
    assert.equal(rHybrid.totals.byModel[0].model, 'gemini-4-carbon');
    assert.equal(rHybrid.totals.byModel[0].totalTokens, 119000 + 206000 + 5500);

    // Verify DB-only conversation works in Tab 1 without transcript.jsonl
    const rDbOnly = analyzeConversation(convDbOnly, {
      appDataDirs: [appData],
      metadataStore,
      disableAgentApi: true,
    });
    assert.ok(rDbOnly);
    assert.equal(rDbOnly.activeModel, 'gemini-flash-worker-agy');
    assert.equal(rDbOnly.title, 'WorkerSwarmAgent');
    assert.equal(rDbOnly.workspace, 'FiberBoard2026');
    // Verify enumId 1669 is NOT added to tokens: 8000 + 2000 + 400 = 10400
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
    assert.deepEqual(modelsToday.sort(), ['gemini-4-carbon', 'gemini-flash-worker-agy']);
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
test('createUsageLedger auto-migrates stale v1/v2/v3 ledgers to v4 and normalizes enum 1016 to gemini-3.1-pro', () => {
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

    assert.equal(LEDGER_SCHEMA_VERSION, 4);

    // 1) Stale v1 ledger auto-migrates to v4
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
    assert.equal(migratedFromV1.getData().version, 4);
    assert.equal(migratedFromV1.isDirty(), true);
    assert.deepEqual(migratedFromV1.getData().conversations, {});

    // 2) Stale v3 ledger carrying gemini-pro-default auto-migrates to v4 -> gemini-3.1-pro
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
    assert.deepEqual(modelsAll, ['claude-opus-5-5', 'gemini-3.1-pro']);
    assert.equal(modelsAll.includes('gemini-pro-default'), false);
    const proRow = global.periods.all.byModel.find((m) => m.model === 'gemini-3.1-pro');
    assert.equal(proRow.totalTokens, 6500);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
test('main.mjs PREFS_SCHEMA_VERSION = 3 auto-migrates 250k/(1M|500k) while preserving custom limits', async () => {
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

  // Case 1: Legacy v1 untouched 250k/1M migrates to 400k/500k and persists prefsSchemaVersion = 3
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
  assert.equal(resUntouched.snap.prefs.softContextLimit, 400000);
  assert.equal(resUntouched.snap.prefs.hardContextLimit, 500000);
  assert.equal(resUntouched.snap.prefs.currency, 'CNY');
  assert.equal(resUntouched.snap.prefs.tokenUnit, 'auto');
  assert.equal(resUntouched.snap.prefs.language, 'zh');
  assert.equal(resUntouched.persisted.prefsSchemaVersion, 3);
  assert.equal(resUntouched.persisted.prefs.softContextLimit, 400000);
  assert.equal(resUntouched.persisted.prefs.hardContextLimit, 500000);
  assert.equal(resUntouched.persisted.stepEndTimes['abc:1'], 1700000000000);

  // Case 2: v2 state with default softContextLimit=250k and hardContextLimit=500k migrates to 400k/500k
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
  assert.equal(resV2Half.snap.prefs.softContextLimit, 400000);
  assert.equal(resV2Half.snap.prefs.hardContextLimit, 500000);
  assert.equal(resV2Half.persisted.prefsSchemaVersion, 3);
  assert.equal(resV2Half.persisted.prefs.softContextLimit, 400000);
  assert.equal(resV2Half.persisted.prefs.hardContextLimit, 500000);

  // Case 3: User-customized limits (180k/360k and 250k/800k) are preserved while bumping prefsSchemaVersion = 3
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
  assert.equal(resCustom.persisted.prefsSchemaVersion, 3);
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
  assert.equal(resCustomHard.persisted.prefsSchemaVersion, 3);
});
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
    assert.equal(g1.periods.all.byModel[0].model, 'gemini-4-argon');
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
    assert.equal(preDecGoogle.profileRates['gemini-4-carbon'].inputPer1M, 2.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-carbon'].outputPer1M, 10.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-argon'].inputPer1M, 2.0);
    assert.equal(preDecGoogle.profileRates['gemini-4-argon'].outputPer1M, 10.0);
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

  await new Promise((resolveListen) => mockServer.listen(0, '127.0.0.1', resolveListen));
  const mockAddr = mockServer.address();
  const mockBase = `http://127.0.0.1:${mockAddr.port}`;

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
    assert.equal(snap1.pricingCatalog.length, 9);
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
  assert.deepEqual(geminiIds, [
    'gemini-4-carbon',
    'gemini-4-argon',
    'gemini-4-hydrogen',
    'gemini-3.1-pro',
    'gemini-3-8-flash',
  ]);
  assert.deepEqual(
    MODEL_PRICING_CATALOG.map((m) => m.id),
    [
      'gemini-4-carbon',
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
    { id: 'gpt-oss-120b', group: '其他在役模型', label: 'GPT-OSS 120B', outputPer1M: 0.6, inputPer1M: 0.15 },
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
    assert.deepEqual(geminiIds, [
      'gemini-4-carbon',
      'gemini-4-argon',
      'gemini-4-hydrogen',
      'gemini-3.1-pro',
      'gemini-3-8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ]);

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
    assert.equal(resolveModelProfile('gemini-flash-worker-agy', runtimeCatalog).id, 'gemini-3-8-flash');
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

    const proBucket = global.periods.all.byModel.find((m) => m.model === 'gemini-3.1-pro');
    assert.ok(proBucket, 'Normal Conv C should still be included despite corrupt Conv B');
    assert.equal(proBucket.totalTokens, 5200);

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
        prefsSchemaVersion: 3,
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

  await new Promise((resolveListen) => mockServer.listen(0, '127.0.0.1', resolveListen));
  mockPort = mockServer.address().port;

  // Pick an ephemeral free port for standalone sidecar
  const portProbe = createServer();
  await new Promise((r) => portProbe.listen(0, '127.0.0.1', r));
  const sidecarPort = portProbe.address().port;
  await new Promise((r) => portProbe.close(() => r()));

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
