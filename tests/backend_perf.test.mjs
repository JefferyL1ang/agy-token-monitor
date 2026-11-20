// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:40:53
// Description: Add v0.5.1 backend optimization & feature tests covering A1
// swarm lookup equivalence, A2 zero-clone immutable summaries cache, A3 watcher
// pruning, B1 Windows atomic-write fallback, and C1 byWorkspace aggregation.
// ============================================================================

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PREFS,
  MODEL_PRICING_CATALOG,
  analyzeConversation,
  clearParserCache,
  createMetadataStore,
  createUsageLedger,
  findSwarmMembership,
  parseTranscript,
  readConversationSummariesBundle,
  resolveChildrenAndSwarm,
  resolveConversationPaths,
  summarizeGlobalAndRecent,
  syncWatchState,
  writeAtomicJsonSafe,
} from '../sidecars/monitor_pane/parser.mjs';

function makeTempDir(prefix = 'agy-tm-v051-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeTranscript(appDataDir, convId, steps) {
  const logsDir = join(appDataDir, 'brain', convId, '.system_generated', 'logs');
  mkdirSync(logsDir, { recursive: true });
  const lines = steps.map((s) => JSON.stringify(s)).join('\n') + '\n';
  const transcriptPath = join(logsDir, 'transcript.jsonl');
  writeFileSync(transcriptPath, lines, 'utf-8');
  return transcriptPath;
}

function writeSwarmRoster(appDataDir, coordId, roster) {
  const swarmDir = join(appDataDir, 'brain', coordId, '.system_generated', 'swarm');
  mkdirSync(swarmDir, { recursive: true });
  const membersPath = join(swarmDir, 'members.json');
  writeFileSync(membersPath, JSON.stringify(roster, null, 2), 'utf-8');
  return membersPath;
}

function createSummariesDb(appDataDir, rows = [], parentRows = []) {
  mkdirSync(appDataDir, { recursive: true });
  const dbPath = join(appDataDir, 'conversation_summaries.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        conversation_id TEXT PRIMARY KEY,
        title TEXT,
        preview TEXT,
        workspace_uris TEXT,
        agent_name TEXT,
        parent_conversation_id TEXT
      );
      CREATE TABLE IF NOT EXISTS conversation_parents (
        conversation_id TEXT,
        parent_id TEXT
      );
    `);
    const insRow = db.prepare(
      'INSERT OR REPLACE INTO conversation_summaries (conversation_id, title, preview, workspace_uris, agent_name, parent_conversation_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const r of rows) {
      insRow.run(
        r.conversation_id,
        r.title || '',
        r.preview || '',
        r.workspace_uris || '',
        r.agent_name || '',
        r.parent_conversation_id || '',
      );
    }
    const insParent = db.prepare(
      'INSERT INTO conversation_parents (conversation_id, parent_id) VALUES (?, ?)',
    );
    for (const p of parentRows) {
      insParent.run(p.conversation_id, p.parent_id);
    }
  } finally {
    db.close();
  }
  return dbPath;
}

test('A1: findSwarmMembership & resolveChildrenAndSwarm equivalence across coordinator, worker, and plain conv', () => {
  clearParserCache();
  const appData = makeTempDir('agy-tm-a1-');
  try {
    const coordId = '11111111-1111-4111-8111-111111111111';
    const workerAliveId = '22222222-2222-4222-8222-222222222222';
    const workerKilledId = '33333333-3333-4333-8333-333333333333';
    const grandchildId = '44444444-4444-4444-8444-444444444444';
    const plainId = '55555555-5555-4555-8555-555555555555';
    const nowIso = new Date().toISOString();

    const membersPath = writeSwarmRoster(appData, coordId, {
      title: 'v051 Test Swarm',
      members: {
        'worker-alive': {
          conversation_id: workerAliveId,
          role: 'worker',
          model: 'gemini-4-neon',
          killed: false,
          phase: 'WORKING',
        },
        'worker-killed': {
          conversation_id: workerKilledId,
          role: 'worker',
          model: 'gemini-4-hydrogen',
          killed: true,
          phase: 'KILLED',
        },
      },
    });

    writeTranscript(appData, coordId, [
      { step_index: 1, type: 'USER_INPUT', created_at: nowIso, content: 'Start swarm' },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: nowIso,
        status: 'DONE',
        content: 'Coordinating',
        input_tokens: 1000,
        cache_read_tokens: 4000,
        output_tokens: 200,
      },
    ]);

    writeTranscript(appData, workerAliveId, [
      { step_index: 1, type: 'USER_INPUT', created_at: nowIso, content: 'Do worker job' },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: nowIso,
        status: 'DONE',
        content: 'Spawning helper',
        input_tokens: 500,
        cache_read_tokens: 1500,
        output_tokens: 100,
        tool_calls: [{ name: 'invoke_subagent', args: { Name: 'helper-sub', Role: 'helper' } }],
      },
      {
        step_index: 3,
        type: 'GENERIC',
        created_at: nowIso,
        status: 'DONE',
        content: `Spawned subagent ${grandchildId}`,
      },
    ]);

    writeTranscript(appData, workerKilledId, [
      { step_index: 1, type: 'USER_INPUT', created_at: nowIso, content: 'Old worker' },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: nowIso,
        status: 'DONE',
        content: 'Finished',
        input_tokens: 300,
        cache_read_tokens: 900,
        output_tokens: 50,
      },
    ]);

    writeTranscript(appData, grandchildId, [
      { step_index: 1, type: 'USER_INPUT', created_at: nowIso, content: 'Sub task' },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: nowIso,
        status: 'DONE',
        content: 'Sub done',
        input_tokens: 200,
        cache_read_tokens: 600,
        output_tokens: 40,
      },
    ]);

    writeTranscript(appData, plainId, [
      { step_index: 1, type: 'USER_INPUT', created_at: nowIso, content: 'Standalone' },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: nowIso,
        status: 'DONE',
        content: 'Done',
        input_tokens: 400,
        cache_read_tokens: 800,
        output_tokens: 80,
      },
    ]);

    // 1. Coordinator membership & children
    const coordMembership = findSwarmMembership(coordId, [appData]);
    assert.equal(coordMembership?.isCoordinator, true);
    assert.equal(coordMembership?.coordinatorId, coordId);

    const coordParsed = parseTranscript(coordId, resolveConversationPaths(coordId, [appData]));
    const coordRes = resolveChildrenAndSwarm(coordId, coordParsed, new Map(), [appData]);
    assert.equal(coordRes.swarmInfo?.isCoordinator, true);
    assert.equal(coordRes.directDescriptors.length, 2);
    const byId = new Map(coordRes.directDescriptors.map((d) => [d.conversationId, d]));
    assert.equal(byId.get(workerAliveId)?.killed, false);
    assert.equal(byId.get(workerKilledId)?.killed, true);

    // 2. Worker membership uses fallback; resolveChildrenAndSwarm reads only own roster (no sibling leak)
    const workerMembership = findSwarmMembership(workerAliveId, [appData]);
    assert.equal(workerMembership?.isCoordinator, false);
    assert.equal(workerMembership?.coordinatorId, coordId);
    assert.equal(workerMembership?.selfName, 'worker-alive');

    const workerParsed = parseTranscript(
      workerAliveId,
      resolveConversationPaths(workerAliveId, [appData]),
    );
    const workerRes = resolveChildrenAndSwarm(workerAliveId, workerParsed, new Map(), [appData]);
    assert.equal(workerRes.swarmInfo, null);
    assert.deepEqual(
      workerRes.directDescriptors.map((d) => d.conversationId),
      [grandchildId],
    );

    // 3. Plain conversation
    assert.equal(findSwarmMembership(plainId, [appData]), null);
    const plainParsed = parseTranscript(plainId, resolveConversationPaths(plainId, [appData]));
    const plainRes = resolveChildrenAndSwarm(plainId, plainParsed, new Map(), [appData]);
    assert.equal(plainRes.swarmInfo, null);
    assert.deepEqual(plainRes.directDescriptors, []);

    // 4. Full analyzeConversation on worker preserves swarm parent & title semantics
    const workerAnalysis = analyzeConversation(workerAliveId, {
      appDataDirs: [appData],
      prefs: DEFAULT_PREFS,
    });
    assert.equal(workerAnalysis.isChildSession, true);
    assert.equal(workerAnalysis.childKind, 'swarm');
    assert.equal(workerAnalysis.parentConversationId, coordId);
    assert.match(workerAnalysis.title, /worker-alive/);

    // 5. A3 check on coordinator: _activeWatchIds excludes killed workers while keeping alive ones
    const coordAnalysis = analyzeConversation(coordId, {
      appDataDirs: [appData],
      prefs: DEFAULT_PREFS,
    });
    assert.equal(coordAnalysis._activeWatchIds.includes(coordId), true);
    assert.equal(coordAnalysis._activeWatchIds.includes(workerAliveId), true);
    assert.equal(coordAnalysis._activeWatchIds.includes(grandchildId), true);
    assert.equal(coordAnalysis._activeWatchIds.includes(workerKilledId), false);

    // 6. Cached listAllSwarms invalidates immediately when members.json changes
    writeSwarmRoster(appData, coordId, {
      title: 'v051 Test Swarm',
      members: {
        'worker-alive': {
          conversation_id: workerAliveId,
          role: 'worker',
          model: 'gemini-4-neon',
          killed: true,
          phase: 'KILLED',
        },
        'worker-killed': {
          conversation_id: workerKilledId,
          role: 'worker',
          model: 'gemini-4-hydrogen',
          killed: true,
          phase: 'KILLED',
        },
      },
    });
    const bumpTime = new Date(Date.now() + 2000);
    utimesSync(membersPath, bumpTime, bumpTime);
    const updatedMembership = findSwarmMembership(workerAliveId, [appData]);
    assert.equal(updatedMembership?.selfMember?.killed, true);
  } finally {
    clearParserCache();
    rmSync(appData, { recursive: true, force: true });
  }
});

test('A2: readConversationSummariesBundle returns zero-clone frozen cache hits and blocks mutation', () => {
  clearParserCache();
  const appData1 = makeTempDir('agy-tm-a2-1-');
  const appData2 = makeTempDir('agy-tm-a2-2-');
  try {
    const convA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const convB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const sqA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    createSummariesDb(
      appData1,
      [
        {
          conversation_id: convA,
          title: 'Alpha Session',
          workspace_uris: JSON.stringify(['file:///F:/Projects/alpha-repo']),
        },
      ],
      [{ conversation_id: sqA, parent_id: convA }],
    );

    createSummariesDb(appData2, [
      {
        conversation_id: convB,
        title: 'Beta Session',
        workspace_uris: JSON.stringify(['file:///F:/Projects/beta-repo']),
      },
    ]);

    // Single-dir cache hit must return identical frozen reference (zero cloning)
    const b1 = readConversationSummariesBundle([appData1]);
    const b2 = readConversationSummariesBundle([appData1]);
    assert.strictEqual(b1, b2);
    assert.strictEqual(b1.byConvId, b2.byConvId);
    assert.strictEqual(b1.sideQuestionsByParent, b2.sideQuestionsByParent);
    assert.strictEqual(b1.sideQuestionParentById, b2.sideQuestionParentById);

    assert.equal(b1.byConvId.get(convA)?.title, 'Alpha Session');
    assert.equal(b1.byConvId.get(convA)?.workspace, 'alpha-repo');
    assert.equal(b1.sideQuestionsByParent.get(convA)?.length, 1);

    // Mutation attempts on cached Maps, entries, arrays, and bundle must throw TypeError
    assert.throws(() => b1.byConvId.set(convB, { title: 'Injected' }), TypeError);
    assert.throws(() => b1.byConvId.delete(convA), TypeError);
    assert.throws(() => b1.byConvId.clear(), TypeError);
    assert.throws(() => {
      b1.byConvId.get(convA).title = 'Tampered';
    }, TypeError);
    assert.throws(() => b1.sideQuestionsByParent.set(convB, []), TypeError);
    assert.throws(() => {
      b1.sideQuestionsByParent.get(convA).push({ conversationId: convB, title: '' });
    }, TypeError);
    assert.throws(() => {
      b1.byConvId = new Map();
    }, TypeError);

    // Multi-dir combined cache hit also returns identical frozen reference
    const m1 = readConversationSummariesBundle([appData1, appData2]);
    const m2 = readConversationSummariesBundle([appData1, appData2]);
    assert.strictEqual(m1, m2);
    assert.strictEqual(m1.byConvId, m2.byConvId);
    assert.equal(m1.byConvId.get(convA)?.workspace, 'alpha-repo');
    assert.equal(m1.byConvId.get(convB)?.workspace, 'beta-repo');
    assert.throws(() => m1.byConvId.set('dddddddd-dddd-4ddd-8ddd-dddddddddddd', {}), TypeError);

    // metadataStore.get reuses pre-fetched summariesMap cleanly
    const metadataStore = createMetadataStore({ disableAgentApi: true });
    const meta = metadataStore.get(convA, {
      schedule: false,
      appDataDirs: [appData1],
      summariesMap: b1.byConvId,
    });
    assert.equal(meta.title, 'Alpha Session');
    assert.equal(meta.workspace, 'alpha-repo');
  } finally {
    clearParserCache();
    rmSync(appData1, { recursive: true, force: true });
    rmSync(appData2, { recursive: true, force: true });
  }
});

test('A3: syncWatchState tracks only active IDs and prunes watcherLastStat & watcherSeenSteps', () => {
  const activeA = '10000000-0000-4000-8000-000000000001';
  const activeB = '10000000-0000-4000-8000-000000000002';
  const endedC = '10000000-0000-4000-8000-000000000003';

  const watched = new Set([activeA, endedC]);
  const statMap = new Map([
    [activeA, 'stat-a'],
    [endedC, 'stat-c'],
  ]);
  const seenMap = new Map([
    [activeA, new Set([1, 2])],
    [endedC, new Set([1, 2, 3])],
  ]);

  syncWatchState(watched, statMap, seenMap, [activeA, activeB, 'invalid-id', '']);

  assert.deepEqual([...watched].sort(), [activeA, activeB].sort());
  assert.equal(statMap.has(activeA), true);
  assert.equal(statMap.get(activeA), 'stat-a');
  assert.equal(statMap.has(endedC), false);
  assert.equal(seenMap.has(activeA), true);
  assert.equal(seenMap.has(endedC), false);
});

test('B1: writeAtomicJsonSafe handles normal writes, Windows EPERM/EACCES/EBUSY fallbacks, and .tmp cleanup', () => {
  const dir = makeTempDir('agy-tm-b1-');
  try {
    // 1. Happy path atomic rename
    const normalPath = join(dir, 'state.json');
    const rNormal = writeAtomicJsonSafe(normalPath, { version: 1, ok: true }, { pretty: true });
    assert.equal(rNormal.ok, true);
    assert.equal(rNormal.usedFallback, false);
    assert.deepEqual(JSON.parse(readFileSync(normalPath, 'utf-8')), { version: 1, ok: true });
    assert.deepEqual(
      readdirSync(dir).filter((f) => f.endsWith('.tmp')),
      [],
    );

    // 2. Retryable Windows lock codes fall back to direct write and clean up .tmp
    for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
      const targetPath = join(dir, `fallback-${code}.json`);
      let unlinkCalls = 0;
      const res = writeAtomicJsonSafe(
        targetPath,
        { code, value: 42 },
        {
          tmpSuffix: `.test-${code}.tmp`,
          fsOps: {
            mkdirSync,
            writeFileSync,
            existsSync,
            unlinkSync(p) {
              unlinkCalls += 1;
              rmSync(p, { force: true });
            },
            renameSync() {
              const err = new Error(`Simulated ${code}`);
              err.code = code;
              throw err;
            },
          },
        },
      );
      assert.equal(res.ok, true);
      assert.equal(res.usedFallback, true);
      assert.equal(res.fallbackCode, code);
      assert.equal(unlinkCalls, 1);
      assert.deepEqual(JSON.parse(readFileSync(targetPath, 'utf-8')), { code, value: 42 });
      assert.equal(existsSync(`${targetPath}.test-${code}.tmp`), false);
    }

    // 3. Non-retryable rename error cleans up .tmp and rethrows
    const failPath = join(dir, 'fail.json');
    assert.throws(
      () =>
        writeAtomicJsonSafe(
          failPath,
          { bad: true },
          {
            tmpSuffix: '.fail.tmp',
            fsOps: {
              mkdirSync,
              writeFileSync,
              existsSync,
              unlinkSync(p) {
                rmSync(p, { force: true });
              },
              renameSync() {
                const err = new Error('Simulated ENOSPC');
                err.code = 'ENOSPC';
                throw err;
              },
            },
          },
        ),
      /ENOSPC/,
    );
    assert.equal(existsSync(`${failPath}.fail.tmp`), false);

    // 4. Verify main.mjs ledger flush throttle is within 5000..10000ms and pricing_sync.mjs uses writeAtomicJsonSafe
    const rootDir = join(fileURLToPath(new URL('..', import.meta.url)));
    const mainSrc = readFileSync(join(rootDir, 'sidecars', 'monitor_pane', 'main.mjs'), 'utf-8');
    const throttleMatch = mainSrc.match(/const\s+LEDGER_PERSIST_THROTTLE_MS\s*=\s*(\d+)/);
    assert.ok(throttleMatch, 'LEDGER_PERSIST_THROTTLE_MS should be defined in main.mjs');
    const throttleMs = Number(throttleMatch[1]);
    assert.ok(
      throttleMs >= 5000 && throttleMs <= 10000,
      `LEDGER_PERSIST_THROTTLE_MS (${throttleMs}) should be between 5000 and 10000`,
    );
    assert.match(mainSrc, /writeAtomicJsonSafe/);

    const pricingSrc = readFileSync(
      join(rootDir, 'sidecars', 'monitor_pane', 'pricing_sync.mjs'),
      'utf-8',
    );
    assert.match(pricingSrc, /writeAtomicJsonSafe/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('C1: summarizeGlobalAndRecent aggregates per-period byWorkspace with exact totals, cacheHitRatePct, sorting, and empty-key grouping', () => {
  clearParserCache();
  const appData = makeTempDir('agy-tm-c1-');
  try {
    const convAlpha1 = 'a1000000-0000-4000-8000-000000000001';
    const convAlpha2 = 'a2000000-0000-4000-8000-000000000002';
    const convBetaOld = 'b1000000-0000-4000-8000-000000000003';
    const convUngrouped = 'c1000000-0000-4000-8000-000000000004';

    const nowMs = Date.UTC(2026, 10, 20, 12, 0, 0); // 2026-11-20T12:00:00Z
    const todayIso = new Date(nowMs).toISOString();
    const tenDaysAgoIso = new Date(nowMs - 10 * 86400000).toISOString();

    createSummariesDb(appData, [
      {
        conversation_id: convAlpha1,
        title: 'Alpha 1',
        workspace_uris: JSON.stringify(['file:///F:/Work/project-alpha']),
      },
      {
        conversation_id: convAlpha2,
        title: 'Alpha 2',
        workspace_uris: JSON.stringify(['file:///F:/Work/project-alpha']),
      },
      {
        conversation_id: convBetaOld,
        title: 'Beta Old',
        workspace_uris: JSON.stringify(['file:///F:/Work/project-beta']),
      },
      {
        conversation_id: convUngrouped,
        title: 'No Workspace',
        workspace_uris: '',
      },
    ]);

    // Alpha 1 (today): high cost
    writeTranscript(appData, convAlpha1, [
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        created_at: todayIso,
        status: 'DONE',
        model: 'gemini-4-carbon',
        input_tokens: 100000,
        cache_read_tokens: 300000,
        output_tokens: 10000,
      },
    ]);
    // Alpha 2 (today): same workspace as Alpha 1, must merge
    writeTranscript(appData, convAlpha2, [
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        created_at: todayIso,
        status: 'DONE',
        model: 'gemini-4-carbon',
        input_tokens: 50000,
        cache_read_tokens: 150000,
        output_tokens: 5000,
      },
    ]);
    // Ungrouped (today): lower cost, empty workspace key ''
    writeTranscript(appData, convUngrouped, [
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        created_at: todayIso,
        status: 'DONE',
        model: 'gemini-4-hydrogen',
        input_tokens: 20000,
        cache_read_tokens: 80000,
        output_tokens: 2000,
      },
    ]);
    // Beta (10 days ago): highest cost overall, only appears in 30d and all
    writeTranscript(appData, convBetaOld, [
      {
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        created_at: tenDaysAgoIso,
        status: 'DONE',
        model: 'gemini-4-neon',
        input_tokens: 300000,
        cache_read_tokens: 700000,
        output_tokens: 30000,
      },
    ]);

    const metadataStore = createMetadataStore({ disableAgentApi: true });
    const ledger = createUsageLedger(null);
    const res = summarizeGlobalAndRecent({
      appDataDirs: [appData],
      prefs: DEFAULT_PREFS,
      metadataStore,
      ledger,
      runtimeCatalog: MODEL_PRICING_CATALOG,
      nowMs,
    });

    // todayByWorkspace mirrors periods.today.byWorkspace
    assert.deepEqual(res.todayByWorkspace, res.periods.today.byWorkspace);

    // Today has 2 workspaces: project-alpha (2 convs) then '' (1 conv)
    const todayWs = res.periods.today.byWorkspace;
    assert.equal(todayWs.length, 2);
    assert.equal(todayWs[0].workspace, 'project-alpha');
    assert.equal(todayWs[0].conversationsCount, 2);
    assert.equal(todayWs[0].stepsCount, 2);
    assert.equal(todayWs[0].inputTokens, 150000);
    assert.equal(todayWs[0].cacheReadTokens, 450000);
    assert.equal(todayWs[0].outputTokens, 15000);
    assert.equal(todayWs[0].totalTokens, 615000);
    assert.ok(Math.abs(todayWs[0].cacheHitRatePct - 75) < 1e-9);

    assert.equal(todayWs[1].workspace, '');
    assert.equal(todayWs[1].conversationsCount, 1);
    assert.equal(todayWs[1].totalTokens, 102000);
    assert.ok(Math.abs(todayWs[1].cacheHitRatePct - 80) < 1e-9);
    assert.ok(todayWs[0].costActual > todayWs[1].costActual);

    // 7d excludes project-beta (10 days ago); 30d & all include project-beta sorted first by cost
    assert.deepEqual(
      res.periods['7d'].byWorkspace.map((w) => w.workspace),
      ['project-alpha', ''],
    );
    assert.deepEqual(
      res.periods['30d'].byWorkspace.map((w) => w.workspace),
      ['project-beta', 'project-alpha', ''],
    );
    assert.deepEqual(
      res.periods.all.byWorkspace.map((w) => w.workspace),
      ['project-beta', 'project-alpha', ''],
    );

    // Conservation invariant across all 4 periods
    for (const key of ['today', '7d', '30d', 'all']) {
      const p = res.periods[key];
      const sumCost = p.byWorkspace.reduce((acc, w) => acc + w.costActual, 0);
      const sumTokens = p.byWorkspace.reduce((acc, w) => acc + w.totalTokens, 0);
      const sumConvs = p.byWorkspace.reduce((acc, w) => acc + w.conversationsCount, 0);
      const sumSteps = p.byWorkspace.reduce((acc, w) => acc + w.stepsCount, 0);
      assert.ok(Math.abs(sumCost - p.costActual) < 1e-9, `${key} cost mismatch`);
      assert.equal(sumTokens, p.totalTokens, `${key} tokens mismatch`);
      assert.equal(sumConvs, p.conversationsCount, `${key} conv count mismatch`);
      assert.equal(sumSteps, p.stepsCount, `${key} steps mismatch`);
    }
  } finally {
    clearParserCache();
    rmSync(appData, { recursive: true, force: true });
  }
});

// ============================================================================
// [MODIFIED END] 2026-11-20 15:40:53
// ============================================================================
