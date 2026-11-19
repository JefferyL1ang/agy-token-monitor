// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:49:09
// Description: Implement zero-dependency offline Pixel Office Canvas 2D engine
// with 10 model cat personas (32x32 Main + 24x24 Subagent sprite bakers),
// adaptive 280px-900px studio layouts, live per-slot animations, inspector
// portrait rendering, theme detection, and reverse-order hit-testing.
// ============================================================================
(function (root) {
  'use strict';

  const MAX_SUBAGENTS = 8;

  const SANS_FONT_FAMILY =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, -apple-system, sans-serif';
  const MONO_FONT_FAMILY =
    '"JetBrains Mono", "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

  const SPRITE_STATES = Object.freeze(['GENERATING', 'RUNNING_TOOLS', 'IDLE', 'ENDED']);
  const OUTLINE = '#182030';

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:27:15
// Description: Add canonical modelNameZh and modelNameEn fields on every
// archetype so inspector pills display clean model names without nicknames.
// ============================================================================
  const MODEL_ARCHETYPES = Object.freeze([
    Object.freeze({
      id: 'gemini-4-carbon',
      short: '4 Carbon',
      modelNameZh: 'Gemini 4 Carbon',
      modelNameEn: 'Gemini 4 Carbon',
      nameZh: 'Gemini 4 Carbon · 曜石星冕黑猫',
      nameEn: 'Gemini 4 Carbon · Obsidian Crown Cat',
      traitZh: '黑丝绒毛色 + 蓝紫钻石四芒星王冠 + 异色星瞳 + 极光披肩',
      traitEn: 'Obsidian velvet coat + blue-violet star crown + heterochromia eyes + aurora mantle',
      dot: '#4285F4',
      fur: '#23293D',
      furLight: '#36405E',
      furShade: '#151926',
      chest: '#F8FAFC',
      earL: '#4285F4',
      earR: '#A855F7',
      innerEar: '#F472B6',
      eyeL: '#38BDF8',
      eyeR: '#C084FC',
      collar1: '#4285F4',
      collar2: '#9B72CB',
      collar3: '#EC4899',
      deskAccent: '#4285F4',
      gear: 'carbon_crown',
    }),
    Object.freeze({
      id: 'gemini-4-neon',
      short: '4 Neon',
      modelNameZh: 'Gemini 4 Neon',
      modelNameEn: 'Gemini 4 Neon',
      nameZh: 'Gemini 4 Neon · 赛博霓虹电光猫',
      nameEn: 'Gemini 4 Neon · Cyber Neon Cat',
      traitZh: '深靛夜行毛色 + 电光青/洋红双色霓虹耳麦与发光腮纹',
      traitEn: 'Deep indigo coat + cyan/magenta neon headset + glowing cheek stripes',
      dot: '#FF2E93',
      fur: '#1E1B4B',
      furLight: '#312E81',
      furShade: '#110E2E',
      chest: '#00F5D4',
      earL: '#00F5D4',
      earR: '#FF2E93',
      innerEar: '#FF70A6',
      eyeL: '#00F5D4',
      eyeR: '#FF2E93',
      collar1: '#00F5D4',
      collar2: '#7B2CBF',
      collar3: '#FF2E93',
      deskAccent: '#FF2E93',
      gear: 'neon_headset',
    }),
    Object.freeze({
      id: 'gemini-4-argon',
      short: '4 Argon',
      modelNameZh: 'Gemini 4 Argon',
      modelNameEn: 'Gemini 4 Argon',
      nameZh: 'Gemini 4 Argon · 氩紫等离子星猫',
      nameEn: 'Gemini 4 Argon · Argon Plasma Cat',
      traitZh: '银薰衣草毛色 + 悬浮紫晶菱星 + 奥术紫领结与等离子紫瞳',
      traitEn: 'Silver-lavender coat + floating amethyst crystal + arcane violet collar',
      dot: '#8B5CF6',
      fur: '#EEF2FF',
      furLight: '#FFFFFF',
      furShade: '#C7D2FE',
      chest: '#FFFFFF',
      earL: '#7C3AED',
      earR: '#A855F7',
      innerEar: '#F472B6',
      eyeL: '#6D28D9',
      eyeR: '#9333EA',
      collar1: '#6D28D9',
      collar2: '#A855F7',
      collar3: '#38BDF8',
      deskAccent: '#8B5CF6',
      gear: 'argon_crystal',
    }),
    Object.freeze({
      id: 'gemini-4-hydrogen',
      short: '4 Hydrogen',
      modelNameZh: 'Gemini 4 Hydrogen',
      modelNameEn: 'Gemini 4 Hydrogen',
      nameZh: 'Gemini 4 Hydrogen · 氢云冰蓝轻羽猫',
      nameEn: 'Gemini 4 Hydrogen · Hydrogen Cloud Cat',
      traitZh: '纯白云朵蓬松毛 + 冰晶蓝耳麦 + 悬浮氢气泡星环',
      traitEn: 'Cloud-white fluffy coat + ice-blue headset + floating hydrogen halo',
      dot: '#38BDF8',
      fur: '#F8FAFC',
      furLight: '#FFFFFF',
      furShade: '#DBEAFE',
      chest: '#FFFFFF',
      earL: '#0EA5E9',
      earR: '#38BDF8',
      innerEar: '#FDA4AF',
      eyeL: '#0284C7',
      eyeR: '#0EA5E9',
      collar1: '#38BDF8',
      collar2: '#60A5FA',
      collar3: '#BAE6FD',
      deskAccent: '#38BDF8',
      gear: 'hydrogen_halo',
    }),
    Object.freeze({
      id: 'gemini-3.1-pro',
      short: '3.1 Pro',
      modelNameZh: 'Gemini 3.1 Pro',
      modelNameEn: 'Gemini 3.1 Pro',
      nameZh: 'Gemini 3.1 Pro · 金丝眼镜学者猫',
      nameEn: 'Gemini 3.1 Pro · Scholar Glasses Cat',
      traitZh: '银白虎斑额纹 + 像素金丝圆框眼镜 + 经典双子星领章',
      traitEn: 'Silver tabby brow + gold-rimmed pixel glasses + classic star collar',
      dot: '#6366F1',
      fur: '#F1F5F9',
      furLight: '#FFFFFF',
      furShade: '#CBD5E1',
      chest: '#FFFFFF',
      earL: '#4285F4',
      earR: '#6366F1',
      innerEar: '#F472B6',
      eyeL: '#1D4ED8',
      eyeR: '#4F46E5',
      collar1: '#4285F4',
      collar2: '#6366F1',
      collar3: '#FBBF24',
      deskAccent: '#6366F1',
      gear: 'scholar_glasses',
    }),
    Object.freeze({
      id: 'gemini-3.8-flash',
      short: '3.8 Flash',
      modelNameZh: 'Gemini 3.8 Flash',
      modelNameEn: 'Gemini 3.8 Flash',
      nameZh: 'Gemini 3.8 Flash · 疾风闪电快猫',
      nameEn: 'Gemini 3.8 Flash · Lightning Flash Cat',
      traitZh: '金奶油闪电毛色 + 头顶金色闪电呆毛 + 额头极速风镜',
      traitEn: 'Golden cream coat + lightning ahoge + speed aviator goggles',
      dot: '#F59E0B',
      fur: '#FEF3C7',
      furLight: '#FFFBEB',
      furShade: '#FDE68A',
      chest: '#FFFFFF',
      earL: '#F59E0B',
      earR: '#EA580C',
      innerEar: '#FB7185',
      eyeL: '#0284C7',
      eyeR: '#0284C7',
      collar1: '#F59E0B',
      collar2: '#38BDF8',
      collar3: '#FBBF24',
      deskAccent: '#F59E0B',
      gear: 'flash_goggles',
    }),
    Object.freeze({
      id: 'claude-opus-5-5',
      short: 'Claude Opus',
      modelNameZh: 'Claude Opus 5.5',
      modelNameEn: 'Claude Opus 5.5',
      nameZh: 'Claude Opus 5.5 · 琥珀礼帽绅士猫',
      nameEn: 'Claude Opus 5.5 · Top-Hat Gentleman Cat',
      traitZh: 'Anthropic 暖陶土橘长毛 + 绅士高礼帽 + 单片金边眼镜',
      traitEn: 'Terracotta ginger coat + dapper top hat + gold-rimmed monocle',
      dot: '#D97757',
      fur: '#EA580C',
      furLight: '#FB923C',
      furShade: '#C2410C',
      chest: '#FFF7ED',
      earL: '#9A3412',
      earR: '#9A3412',
      innerEar: '#FDBA74',
      eyeL: '#F59E0B',
      eyeR: '#D97706',
      collar1: '#7C2D12',
      collar2: '#FBBF24',
      collar3: '#FED7AA',
      deskAccent: '#D97757',
      gear: 'opus_tophat',
    }),
    Object.freeze({
      id: 'claude-sonnet-5-5',
      short: 'Claude Sonnet',
      modelNameZh: 'Claude Sonnet 5.5',
      modelNameEn: 'Claude Sonnet 5.5',
      nameZh: 'Claude Sonnet 5.5 · 暖杏贝雷帽诗猫',
      nameEn: 'Claude Sonnet 5.5 · Apricot Beret Poet Cat',
      traitZh: '奶油杏橘三花毛色 + 斜戴画家贝雷帽 + 羽毛领结',
      traitEn: 'Apricot calico coat + tilted artist beret + warm cream collar',
      dot: '#FB923C',
      fur: '#FFEDD5',
      furLight: '#FFF7ED',
      furShade: '#FDBA74',
      chest: '#FFFFFF',
      earL: '#D97757',
      earR: '#78350F',
      innerEar: '#FDA4AF',
      eyeL: '#B45309',
      eyeR: '#B45309',
      collar1: '#D97757',
      collar2: '#FBBF24',
      collar3: '#FFFBEB',
      deskAccent: '#FB923C',
      gear: 'sonnet_beret',
    }),
    Object.freeze({
      id: 'gpt-oss-120b',
      short: 'GPT-OSS',
      modelNameZh: 'GPT-OSS 120B',
      modelNameEn: 'GPT-OSS 120B',
      nameZh: 'GPT-OSS 120B · 翡翠矩阵机械猫',
      nameEn: 'GPT-OSS 120B · Emerald Matrix Mecha Cat',
      traitZh: '钛银金属白装甲毛色 + 翡翠绿 LED 矩阵目镜 + 信号天线',
      traitEn: 'Titanium silver armor + emerald LED matrix visor + signal antenna',
      dot: '#10B981',
      fur: '#E2E8F0',
      furLight: '#F8FAFC',
      furShade: '#94A3B8',
      chest: '#10B981',
      earL: '#059669',
      earR: '#059669',
      innerEar: '#34D399',
      eyeL: '#10B981',
      eyeR: '#10B981',
      collar1: '#0F172A',
      collar2: '#10B981',
      collar3: '#34D399',
      deskAccent: '#10B981',
      gear: 'oss_visor',
    }),
    Object.freeze({
      id: 'auto',
      short: 'Auto',
      modelNameZh: 'Auto (默认)',
      modelNameEn: 'Auto',
      nameZh: 'Auto · 云白星徽初心猫',
      nameEn: 'Auto · Cloud-White Starter Cat',
      traitZh: '云朵纯白毛色 + 天空蓝靛双色尖耳 + 经典双子星领结',
      traitEn: 'Cloud-white starter coat + sky-indigo ears + subtle Gemini star collar',
      dot: '#64748B',
      fur: '#F8FAFC',
      furLight: '#FFFFFF',
      furShade: '#CBD5E1',
      chest: '#FFFFFF',
      earL: '#38BDF8',
      earR: '#818CF8',
      innerEar: '#FDA4AF',
      eyeL: '#0284C7',
      eyeR: '#4F46E5',
      collar1: '#38BDF8',
      collar2: '#6366F1',
      collar3: '#FBBF24',
      deskAccent: '#64748B',
      gear: 'auto_star',
    }),
  ]);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:27:15
// ============================================================================

  const ARCHETYPE_BY_ID = new Map(MODEL_ARCHETYPES.map((a) => [a.id, a]));
  const AUTO_ARCHETYPE = ARCHETYPE_BY_ID.get('auto');

  const MODEL_MATCH_RULES = Object.freeze([
    [
      'gemini-4-carbon',
      /gemini[\s_-]*4[\s_-]*carbon|orchestrator[\s(-]*carbon|gemini-pro-orchestrator(?=$|[\s)]|-carbon(?=$|[-_\s]))/i,
    ],
    [
      'gemini-4-neon',
      /gemini[\s_-]*4[\s_-]*neon|orchestrator[\s(-]*neon|gemini-pro-orchestrator-neon/i,
    ],
    [
      'gemini-4-argon',
      /gemini[\s_-]*4[\s_-]*argon|orchestrator[\s(-]*argon|gemini-pro-orchestrator-argon/i,
    ],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:27:15
// Description: Route gemini-flash-worker* slugs to gemini-4-hydrogen instead
// of gemini-3.8-flash and narrow flash matching to explicit 3.8/flash slugs.
// ============================================================================
    ['gemini-4-hydrogen', /gemini[\s_-]*4[\s_-]*hydrogen|gemini[\s_-]*flash[\s_-]*worker/i],
    [
      'gemini-3.1-pro',
      /gemini[\s_-]*3\.?1[\s_-]*pro|gemini-pro-default|^gemini-pro$|gemini[\s_-]*2\.?5[\s_-]*pro/i,
    ],
    [
      'gemini-3.8-flash',
      /gemini[\s_-]*3[._-]*8[\s_-]*flash|^gemini[\s_-]*flash(?:[-_](?:lite|latest))?$|^flash(?:_lite)?$/i,
    ],
// ============================================================================
// [MODIFIED END] 2026-11-19 13:27:15
// ============================================================================
    ['claude-opus-5-5', /claude[\s_-]*opus/i],
    ['claude-sonnet-5-5', /claude[\s_-]*sonnet|claude[\s_-]*haiku/i],
    ['gpt-oss-120b', /gpt[\s_-]*oss|gpt-|^(?:o1|o3|o4)(?:$|[-_])/i],
  ]);

  function resolveCatArchetype(rawModel) {
    let raw = '';
    if (typeof rawModel === 'string') {
      raw = rawModel;
    } else if (rawModel && typeof rawModel === 'object') {
      raw = String(rawModel.id || rawModel.model || rawModel.profileId || rawModel.label || '');
    } else if (rawModel != null) {
      raw = String(rawModel);
    }
    const candidate = raw.trim();
    if (!candidate || /^auto(?:\s*[（(].*)?$/i.test(candidate) || /^unknown$/i.test(candidate)) {
      return AUTO_ARCHETYPE;
    }
    for (const [id, pattern] of MODEL_MATCH_RULES) {
      if (pattern.test(candidate)) {
        return ARCHETYPE_BY_ID.get(id) || AUTO_ARCHETYPE;
      }
    }
    return AUTO_ARCHETYPE;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:27:15
// Description: Add round-scoped subagent filtering (selectRoundChildren) and
// populate canonical modelLabel / rawModel fields on main and child slots.
// ============================================================================
  function isIdleStatus(status) {
    return status !== 'GENERATING' && status !== 'RUNNING_TOOLS';
  }

  function childStartMs(ch) {
    const c = Number(ch?.createdAtMs);
    if (Number.isFinite(c) && c > 0) return c;
    const u = Number(ch?.updatedAtMs);
    if (Number.isFinite(u) && u > 0) return u;
    return 0;
  }

  function childEndMs(ch) {
    const u = Number(ch?.updatedAtMs);
    if (Number.isFinite(u) && u > 0) return u;
    const c = Number(ch?.createdAtMs);
    if (Number.isFinite(c) && c > 0) return c;
    return 0;
  }

  function selectRoundChildren(current, sortedChildren) {
    const list = Array.isArray(sortedChildren)
      ? sortedChildren.filter((ch) => ch && typeof ch === 'object')
      : [];
    if (list.length === 0) return [];

    const rawTurns = Array.isArray(current?.userTurnTimestampsMs) ? current.userTurnTimestampsMs : [];
    const userTurns = rawTurns
      .map((t) => Number(t))
      .filter((t) => Number.isFinite(t) && t > 0)
      .sort((a, b) => a - b);

    const findTurnAnchor = (ts) => {
      if (!(Number.isFinite(ts) && ts > 0) || userTurns.length === 0) return 0;
      let anchor = 0;
      for (let i = 0; i < userTurns.length; i += 1) {
        const t = userTurns[i];
        if (t <= ts + 2000) {
          anchor = t;
        } else {
          break;
        }
      }
      return anchor;
    };

    const latestUserTurnMs = userTurns.length > 0 ? userTurns[userTurns.length - 1] : 0;
    const hasRunningChild = list.some(
      (ch) => !ch?.killed && (ch.status === 'GENERATING' || ch.status === 'RUNNING_TOOLS'),
    );
    const hasLatestTurnChild =
      latestUserTurnMs > 0 && list.some((ch) => childStartMs(ch) >= latestUserTurnMs - 2000);
    const mainWorking = !isIdleStatus(current?.status) && hasLatestTurnChild;

    if (hasRunningChild || mainWorking) {
      let runningAnchorMs = 0;
      let maxStart = 0;
      for (const ch of list) {
        const startMs = childStartMs(ch);
        if (startMs > maxStart) maxStart = startMs;
        if (!ch?.killed && (ch.status === 'GENERATING' || ch.status === 'RUNNING_TOOLS')) {
          const anchor = findTurnAnchor(startMs);
          if (anchor > runningAnchorMs) {
            runningAnchorMs = anchor;
          }
        }
      }

      let workingAnchorMs = 0;
      if (hasLatestTurnChild) {
        workingAnchorMs = latestUserTurnMs;
      } else if (runningAnchorMs > 0) {
        workingAnchorMs = runningAnchorMs;
      } else if (userTurns.length === 0 && maxStart > 0) {
        workingAnchorMs = Math.max(1, maxStart - 30 * 60 * 1000);
      }

      return list.filter(
        (ch) =>
          !ch?.killed ||
          (workingAnchorMs > 0 && childStartMs(ch) > 0 && childStartMs(ch) >= workingAnchorMs - 2000),
      );
    }

    let latestSpawnMs = 0;
    for (const ch of list) {
      const startMs = childStartMs(ch);
      if (startMs > latestSpawnMs) latestSpawnMs = startMs;
    }

    if (latestSpawnMs > 0) {
      const lastRoundAnchorMs = findTurnAnchor(latestSpawnMs);
      if (lastRoundAnchorMs > 0) {
        return list.filter(
          (ch) => !ch?.killed || (childStartMs(ch) > 0 && childStartMs(ch) >= lastRoundAnchorMs - 2000),
        );
      }
      return list.filter(
        (ch) => !ch?.killed || (childEndMs(ch) > 0 && childEndMs(ch) >= latestSpawnMs - 30 * 60 * 1000),
      );
    }

    const alive = list.filter((ch) => !ch?.killed);
    return alive.length > 0 ? alive : list.slice();
  }

  function buildOfficeModel(current, sortedChildren, lang) {
    const cur = current && typeof current === 'object' ? current : {};
    const resolvedLang = lang === 'en' ? 'en' : 'zh';
    const roundChildren = selectRoundChildren(cur, sortedChildren);
    const totalChildren = roundChildren.length;
    const visibleChildren = roundChildren.slice(0, MAX_SUBAGENTS);
    const overflowCount = Math.max(0, totalChildren - MAX_SUBAGENTS);

    const mainArch = resolveCatArchetype(
      cur.activeModelLabel || cur.activeModel || cur.activeRawModel,
    );
    const mainRawModel = cur.activeRawModel || cur.activeModel || 'Auto';
    const mainModelLabel =
      cur.activeModelLabel ||
      (mainArch.id !== 'auto'
        ? (resolvedLang === 'en' ? mainArch.modelNameEn : mainArch.modelNameZh)
        : (cur.activeModel || 'Auto'));

    const mainSlot = {
      isMain: true,
      key: 'main',
      status: cur.status || 'IDLE',
      killed: false,
      conversationId: cur.conversationId || '',
      name: cur.title || 'Main',
      role: cur.isChildSession ? (cur.childKind === 'swarm' ? 'Swarm' : 'Subagent') : 'Main',
      model: mainModelLabel,
      modelLabel: mainModelLabel,
      rawModel: mainRawModel,
      archetype: mainArch,
      activeToolLabel: cur.activeToolLabel || '',
      tokPerSec: Number(cur.speed?.latestStepTokPerSec) || 0,
      contextTotal: Number(cur.context?.currentTotal) || 0,
      outputTokens: Number(cur.totals?.mainOnly?.outputTokens ?? cur.totals?.withChildren?.outputTokens) || 0,
      costActual: Number(cur.totals?.mainOnly?.costActual ?? cur.totals?.withChildren?.costActual) || 0,
    };

    const childSlots = visibleChildren.map((ch, i) => {
      const c = ch && typeof ch === 'object' ? ch : {};
      const killed = Boolean(c.killed);
      const childArch = resolveCatArchetype(c.modelLabel || c.model || c.rawModel);
      const childRawModel = c.rawModel || c.model || 'Auto';
      const childModelLabel =
        c.modelLabel ||
        (childArch.id !== 'auto'
          ? (resolvedLang === 'en' ? childArch.modelNameEn : childArch.modelNameZh)
          : (c.model || 'Auto'));
      return {
        isMain: false,
        key: c.conversationId || ('sub-' + i),
        status: killed ? 'ENDED' : (c.status || 'IDLE'),
        killed,
        conversationId: c.conversationId || '',
        name: c.name || c.conversationId || ('#' + (i + 1)),
        role: c.role || (c.kind === 'swarm' ? 'Swarm' : 'Subagent'),
        kind: c.kind || 'subagent',
        model: childModelLabel,
        modelLabel: childModelLabel,
        rawModel: childRawModel,
        archetype: childArch,
        activeToolLabel: killed ? '' : (c.activeToolLabel || ''),
        tokPerSec: Number(c.latestTokPerSec) || 0,
        contextTotal: Number(c.contextTotal) || 0,
        outputTokens: Number(c.outputTokens) || 0,
        costActual: Number(c.costActual) || 0,
      };
    });

    const slots = [mainSlot, ...childSlots];
    const hasActive = slots.some(
      (s) => !s.killed && (s.status === 'GENERATING' || s.status === 'RUNNING_TOOLS'),
    );

    return {
      slots,
      overflowCount,
      totalChildren,
      hasActive,
    };
  }
// ============================================================================
// [MODIFIED END] 2026-11-19 13:27:15
// ============================================================================

  // =========================================================================
  // Integer Pixel Grid Bakers (32x32 Main Cat & 24x24 Subagent Cat)
  // =========================================================================

  function createGrid(size, createCanvasFn) {
    const c = createCanvasFn(size, size);
    if (c) {
      c.width = size;
      c.height = size;
    }
    const ctx = c && typeof c.getContext === 'function' ? c.getContext('2d') : null;
    const px = (x, y, col) => {
      if (!ctx || !col || x < 0 || y < 0 || x >= size || y >= size) return;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    };
    const rect = (x, y, w, h, col) => {
      if (!ctx || !col || w <= 0 || h <= 0) return;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    const hline = (x1, x2, y, col) => rect(Math.min(x1, x2), y, Math.abs(x2 - x1) + 1, 1, col);
    const vline = (x, y1, y2, col) => rect(x, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1, col);
    return { canvas: c, px, rect, hline, vline };
  }

  function drawMainSleeping32(g, m, frame) {
    const { px, rect, hline, vline } = g;
    // Cozy bed cushion
    rect(3, 25, 26, 4, m.deskAccent);
    hline(3, 28, 25, OUTLINE);
    hline(2, 29, 28, OUTLINE);
    // Curled sleeping body
    rect(5, 16, 20, 9, m.fur);
    rect(7, 16, 16, 2, m.furLight);
    hline(6, 24, 24, m.furShade);
    hline(6, 23, 15, OUTLINE);
    vline(4, 17, 24, OUTLINE);
    vline(25, 17, 24, OUTLINE);
    hline(5, 24, 25, OUTLINE);
    // Tucked ears
    rect(7, 13, 3, 3, m.earL);
    px(8, 14, m.innerEar);
    rect(13, 13, 3, 3, m.earR);
    px(14, 14, m.innerEar);
    // Closed peaceful eyes & blush
    hline(8, 10, 19, OUTLINE);
    hline(13, 15, 19, OUTLINE);
    px(11, 20, '#F472B6');
    px(7, 20, '#F472B6');
    // Collar & curled tail
    hline(7, 17, 22, m.collar2);
    px(12, 22, '#FEF08A');
    rect(19, 21, 6, 3, m.earR);
    px(24, 21, m.collar3);
    // Floating zZ
    const zy = frame === 1 ? -1 : 0;
    hline(20, 22, 9 + zy, '#38BDF8');
    px(21, 10 + zy, '#38BDF8');
    hline(20, 22, 11 + zy, '#38BDF8');
    hline(24, 26, 5 + zy, '#94A3B8');
    px(25, 6 + zy, '#94A3B8');
    hline(24, 26, 7 + zy, '#94A3B8');
  }

  function drawMainHeadgear32(g, m, frame) {
    const { px, rect, hline, vline } = g;
    if (m.gear === 'carbon_crown') {
      const glow = frame === 1 ? '#FEF08A' : '#38BDF8';
      vline(15, 0, 4, glow);
      vline(16, 0, 4, '#A855F7');
      hline(13, 18, 2, glow);
      rect(15, 1, 2, 3, '#FFFFFF');
      px(11, 1 + frame, '#38BDF8');
      px(20, 2 - frame, '#EC4899');
    } else if (m.gear === 'neon_headset') {
      hline(9, 22, 8, '#00F5D4');
      hline(10, 21, 9, '#FF2E93');
      rect(3, 11, 3, 5, '#0F172A');
      rect(4, 12, 1, 3, '#00F5D4');
      rect(26, 11, 3, 5, '#0F172A');
      rect(27, 12, 1, 3, '#FF2E93');
      if (frame === 1) {
        px(15, 5, '#00F5D4');
        px(16, 4, '#FF2E93');
      }
    } else if (m.gear === 'argon_crystal') {
      rect(15, 1 + frame, 2, 5, '#A855F7');
      rect(14, 2 + frame, 4, 3, '#7C3AED');
      rect(15, 2 + frame, 2, 3, '#E9D5FF');
      px(15, 3 + frame, '#FFFFFF');
    } else if (m.gear === 'hydrogen_halo') {
      hline(9, 22, 8, '#38BDF8');
      rect(3, 12, 2, 4, '#0284C7');
      rect(27, 12, 2, 4, '#0284C7');
      rect(14, 2, 2, 2, '#BAE6FD');
      px(14, 2, '#FFFFFF');
      rect(18, 4 - frame, 2, 2, '#38BDF8');
    } else if (m.gear === 'scholar_glasses') {
      hline(7, 13, 12, '#D97706');
      hline(7, 13, 16, '#D97706');
      vline(7, 12, 16, '#D97706');
      vline(13, 12, 16, '#D97706');
      hline(14, 17, 14, '#FBBF24');
      hline(18, 24, 12, '#D97706');
      hline(18, 24, 16, '#D97706');
      vline(18, 12, 16, '#D97706');
      vline(24, 12, 16, '#D97706');
    } else if (m.gear === 'flash_goggles') {
      rect(8, 9, 6, 4, '#0F172A');
      rect(9, 10, 4, 2, '#38BDF8');
      px(9, 10, '#FFFFFF');
      rect(18, 9, 6, 4, '#0F172A');
      rect(19, 10, 4, 2, '#38BDF8');
      px(19, 10, '#FFFFFF');
      hline(14, 17, 10, '#F59E0B');
      hline(16, 18, 2, '#FDE047');
      hline(15, 17, 3, '#FBBF24');
      hline(14, 17, 4, '#F59E0B');
      hline(15, 16, 5, '#FEF08A');
    } else if (m.gear === 'opus_tophat') {
      hline(9, 22, 8, OUTLINE);
      rect(11, 2, 10, 6, '#1E293B');
      vline(10, 2, 7, OUTLINE);
      vline(21, 2, 7, OUTLINE);
      hline(11, 20, 1, OUTLINE);
      hline(11, 20, 6, '#FBBF24');
      hline(19, 24, 12, '#FBBF24');
      hline(19, 24, 16, '#FBBF24');
      vline(19, 12, 16, '#FBBF24');
      vline(24, 12, 18, '#FBBF24');
    } else if (m.gear === 'sonnet_beret') {
      rect(9, 6, 13, 3, '#D97757');
      rect(11, 5, 10, 2, '#EA580C');
      hline(8, 22, 9, OUTLINE);
      px(21, 4, '#FEF3C7');
      px(22, 3, '#FFFFFF');
    } else if (m.gear === 'oss_visor') {
      vline(15, 3, 8, '#64748B');
      vline(16, 4, 8, '#475569');
      rect(14, 1, 4, 3, frame === 1 ? '#34D399' : '#10B981');
      px(15, 1, '#FFFFFF');
    } else if (m.gear === 'auto_star') {
      px(15, 11, '#38BDF8');
      px(16, 11, '#818CF8');
    }
  }

  function bakeMain32(m, status, frame, createCanvasFn) {
    const g = createGrid(32, createCanvasFn);
    const { px, rect, hline, vline } = g;

    if (status === 'ENDED') {
      drawMainSleeping32(g, m, frame);
      return g.canvas;
    }

    // Swaying Tail
    const tailLift = frame === 1 ? -1 : 0;
    if (m.gear === 'flash_goggles') {
      rect(24, 23 + tailLift, 3, 2, '#F59E0B');
      rect(26, 21 + tailLift, 3, 2, '#FBBF24');
      rect(28, 19 + tailLift, 2, 2, '#FEF08A');
      px(29, 18 + tailLift, '#FFFFFF');
    } else {
      rect(23, 23, 3, 3, OUTLINE);
      rect(25, 21 + tailLift, 4, 4, OUTLINE);
      rect(27, 18 + tailLift, 4, 4, OUTLINE);
      rect(24, 24, 2, 1, m.furShade);
      rect(26, 22 + tailLift, 2, 2, m.earR);
      rect(28, 19 + tailLift, 2, 2, m.collar3);
      px(29, 19 + tailLift, '#FFFFFF');
    }

    // Pointy Cat Ears (Rows 5..10)
    hline(6, 7, 5, OUTLINE);
    hline(24, 25, 5, OUTLINE);
    px(5, 6, OUTLINE);
    rect(6, 6, 2, 1, m.earL);
    px(8, 6, OUTLINE);
    px(23, 6, OUTLINE);
    rect(24, 6, 2, 1, m.earR);
    px(26, 6, OUTLINE);
    px(4, 7, OUTLINE);
    rect(5, 7, 3, 1, m.earL);
    px(8, 7, m.fur);
    px(9, 7, OUTLINE);
    px(22, 7, OUTLINE);
    px(23, 7, m.fur);
    rect(24, 7, 3, 1, m.earR);
    px(27, 7, OUTLINE);

    for (let y = 8; y <= 10; y += 1) {
      px(4, y, OUTLINE);
      px(5, y, m.earL);
      rect(6, y, 2, 1, m.innerEar);
      rect(8, y, y - 6, 1, m.fur);
      px(8 + (y - 6), y, OUTLINE);
      px(27, y, OUTLINE);
      px(26, y, m.earR);
      rect(24, y, 2, 1, m.innerEar);
      rect(24 - (y - 6), y, y - 6, 1, m.fur);
      px(23 - (y - 6), y, OUTLINE);
    }

    // Head (Rows 9..20)
    hline(10, 21, 9, OUTLINE);
    rect(5, 10, 22, 9, m.fur);
    rect(7, 10, 18, 2, m.furLight);
    vline(4, 11, 17, OUTLINE);
    vline(27, 11, 17, OUTLINE);
    px(5, 18, OUTLINE);
    px(26, 18, OUTLINE);
    hline(6, 8, 19, OUTLINE);
    hline(23, 25, 19, OUTLINE);
    hline(9, 22, 20, OUTLINE);
    hline(6, 25, 18, m.furShade);
    hline(9, 22, 19, m.furShade);

    // Whiskers & Cheek Tufts
    hline(2, 4, 15, OUTLINE);
    hline(27, 29, 15, OUTLINE);
    hline(3, 4, 17, OUTLINE);
    hline(27, 28, 17, OUTLINE);
    if (m.gear === 'opus_tophat' || m.gear === 'flash_goggles') {
      px(3, 16, m.furLight);
      px(28, 16, m.furLight);
    }

    // Forehead Markings
    if (m.gear === 'scholar_glasses') {
      vline(13, 10, 12, '#94A3B8');
      vline(15, 10, 11, '#94A3B8');
      vline(16, 10, 11, '#94A3B8');
      vline(18, 10, 12, '#94A3B8');
    } else if (m.gear === 'carbon_crown') {
      px(15, 11, '#38BDF8');
      px(16, 11, '#38BDF8');
      px(15, 12, '#FEF08A');
      px(16, 12, '#FFFFFF');
    } else if (m.gear === 'neon_headset') {
      hline(6, 7, 17, '#00F5D4');
      hline(24, 25, 17, '#FF2E93');
    } else if (m.gear === 'sonnet_beret') {
      rect(20, 10, 5, 3, '#FB923C');
    }

    // Eyes & Expression
    if (m.gear === 'oss_visor') {
      rect(6, 13, 20, 4, '#0F172A');
      hline(7, 24, 12, '#334155');
      if (status === 'IDLE') {
        hline(9, 12, 14, '#10B981');
        hline(19, 22, 14, '#10B981');
        px(8, 15, '#10B981');
        px(13, 15, '#10B981');
        px(18, 15, '#10B981');
        px(23, 15, '#10B981');
      } else {
        rect(9, 14, 4, 2, '#10B981');
        rect(19, 14, 4, 2, '#10B981');
        px(9, 14, '#A7F3D0');
        px(19, 14, '#A7F3D0');
      }
    } else if (status === 'IDLE') {
      hline(9, 11, 14, OUTLINE);
      px(8, 15, OUTLINE);
      px(12, 15, OUTLINE);
      hline(20, 22, 14, OUTLINE);
      px(19, 15, OUTLINE);
      px(23, 15, OUTLINE);
    } else {
      const s = status === 'RUNNING_TOOLS' ? 1 : 0;
      rect(8 + s, 13, 4, 3, m.eyeL);
      rect(8 + s, 14, 4, 2, OUTLINE);
      rect(9 + s, 14, 3, 2, m.eyeL);
      px(8 + s, 13, '#FFFFFF');
      px(9 + s, 13, '#FFFFFF');
      rect(20 + s, 13, 4, 3, m.eyeR);
      rect(20 + s, 14, 4, 2, OUTLINE);
      rect(21 + s, 14, 3, 2, m.eyeR);
      px(20 + s, 13, '#FFFFFF');
      px(21 + s, 13, '#FFFFFF');
    }

    rect(6, 16, 2, 1, '#F472B6');
    rect(24, 16, 2, 1, '#F472B6');
    rect(15, 16, 2, 1, '#F472B6');
    hline(14, 17, 17, '#64748B');
    px(15, 16, '#FB7185');

    // Model Headgear
    drawMainHeadgear32(g, m, frame);

    // Aurora Mantle & Torso
    hline(8, 11, 20, m.collar1);
    hline(12, 19, 20, m.collar2);
    hline(20, 23, 20, m.collar3);
    hline(9, 22, 21, m.collar2);
    px(15, 21, '#FEF08A');
    px(16, 21, '#FEF08A');
    rect(8, 22, 16, 5, m.fur);
    vline(7, 21, 26, OUTLINE);
    vline(24, 21, 26, OUTLINE);
    rect(12, 22, 8, 4, m.chest);

    if (m.gear === 'auto_star') {
      px(15, 20, '#38BDF8');
      px(16, 20, '#818CF8');
      px(15, 21, frame === 1 ? '#FFFFFF' : '#FEF08A');
      px(16, 21, frame === 1 ? '#FEF08A' : '#FFFFFF');
      px(15, 22, '#6366F1');
      px(16, 22, '#38BDF8');
    }

    // Foreground Props
    if (status === 'GENERATING') {
      rect(5, 27, 22, 4, '#1E293B');
      hline(4, 27, 27, OUTLINE);
      hline(4, 27, 30, OUTLINE);
      for (let kx = 6; kx <= 24; kx += 3) {
        rect(kx, 28, 2, 1, (kx + frame * 3) % 6 === 0 ? '#38BDF8' : '#64748B');
      }
      const lY = frame === 0 ? 26 : 24;
      const rY = frame === 0 ? 24 : 26;
      rect(8, lY, 4, 3, m.chest);
      rect(7, lY, 1, 2, OUTLINE);
      rect(12, lY, 1, 2, OUTLINE);
      rect(20, rY, 4, 3, m.chest);
      rect(19, rY, 1, 2, OUTLINE);
      rect(24, rY, 1, 2, OUTLINE);
    } else if (status === 'RUNNING_TOOLS') {
      rect(17, 25, 11, 6, '#EF4444');
      hline(17, 27, 25, OUTLINE);
      hline(17, 27, 30, OUTLINE);
      vline(16, 25, 30, OUTLINE);
      vline(28, 25, 30, OUTLINE);
      hline(17, 27, 27, '#B91C1C');
      rect(21, 27, 3, 2, '#FBBF24');
      const wy = frame === 1 ? -1 : 0;
      rect(8, 24 + wy, 4, 3, m.chest);
      vline(10, 19 + wy, 24 + wy, '#94A3B8');
      vline(11, 19 + wy, 24 + wy, '#CBD5E1');
      rect(9, 18 + wy, 4, 2, '#38BDF8');
      px(10, 18 + wy, OUTLINE);
      px(11, 18 + wy, OUTLINE);
    } else {
      rect(12, 24, 7, 7, '#FFFFFF');
      hline(12, 18, 24, OUTLINE);
      hline(12, 18, 30, OUTLINE);
      vline(11, 24, 30, OUTLINE);
      vline(19, 24, 30, OUTLINE);
      rect(19, 26, 2, 3, OUTLINE);
      px(19, 27, '#FFFFFF');
      rect(14, 26, 3, 3, m.dot);
      px(15, 27, '#FEF08A');
      rect(9, 26, 3, 3, m.chest);
      rect(19, 26, 2, 2, m.chest);
      px(14, 22 - frame, '#94A3B8');
      px(16, 21 - frame, '#CBD5E1');
    }

    return g.canvas;
  }

  function bakeSub24(m, status, frame, createCanvasFn) {
    const g = createGrid(24, createCanvasFn);
    const { px, rect, hline, vline } = g;

    if (status === 'ENDED') {
      rect(3, 19, 18, 3, m.deskAccent);
      hline(2, 21, 21, OUTLINE);
      rect(5, 12, 14, 7, m.fur);
      hline(6, 17, 11, OUTLINE);
      hline(5, 18, 19, OUTLINE);
      vline(4, 13, 18, OUTLINE);
      vline(19, 13, 18, OUTLINE);
      rect(6, 10, 2, 2, m.earL);
      rect(11, 10, 2, 2, m.earR);
      px(7, 11, m.innerEar);
      hline(7, 8, 15, OUTLINE);
      hline(11, 12, 15, OUTLINE);
      px(9, 16, '#F472B6');
      rect(15, 16, 4, 2, m.earR);
      const zy = frame === 1 ? -1 : 0;
      hline(15, 17, 7 + zy, '#38BDF8');
      px(16, 8 + zy, '#38BDF8');
      hline(15, 17, 9 + zy, '#38BDF8');
      hline(18, 19, 4 + zy, '#94A3B8');
      hline(18, 19, 5 + zy, '#94A3B8');
      return g.canvas;
    }

    const tl = frame === 1 ? -1 : 0;
    rect(18, 17 + tl, 3, 2, OUTLINE);
    rect(19, 15 + tl, 3, 3, m.earR);
    px(21, 15 + tl, '#FFFFFF');

    px(5, 4, OUTLINE);
    px(6, 4, OUTLINE);
    px(17, 4, OUTLINE);
    px(18, 4, OUTLINE);
    for (let y = 5; y <= 7; y += 1) {
      px(4, y, OUTLINE);
      px(5, y, m.earL);
      px(6, y, m.innerEar);
      px(7, y, m.fur);
      px(8, y, OUTLINE);
      px(19, y, OUTLINE);
      px(18, y, m.earR);
      px(17, y, m.innerEar);
      px(16, y, m.fur);
      px(15, y, OUTLINE);
    }

    hline(8, 15, 7, OUTLINE);
    rect(5, 8, 14, 7, m.fur);
    rect(6, 8, 12, 2, m.furLight);
    vline(4, 8, 14, OUTLINE);
    vline(19, 8, 14, OUTLINE);
    hline(5, 18, 15, OUTLINE);
    hline(6, 17, 14, m.furShade);
    px(3, 12, OUTLINE);
    px(20, 12, OUTLINE);

    if (m.gear === 'oss_visor') {
      rect(5, 10, 14, 3, '#0F172A');
      rect(7, 11, 3, 1, '#10B981');
      rect(14, 11, 3, 1, '#10B981');
    } else if (status === 'IDLE') {
      hline(7, 9, 11, OUTLINE);
      hline(14, 16, 11, OUTLINE);
    } else {
      rect(7, 10, 3, 3, m.eyeL);
      px(7, 10, '#FFFFFF');
      rect(14, 10, 3, 3, m.eyeR);
      px(14, 10, '#FFFFFF');
    }
    px(6, 13, '#F472B6');
    px(17, 13, '#F472B6');
    rect(11, 12, 2, 1, '#F472B6');

    if (m.gear === 'carbon_crown') {
      vline(11, 1, 3, '#38BDF8');
      hline(10, 13, 2, '#FEF08A');
      px(11, 2, '#FFFFFF');
    } else if (m.gear === 'neon_headset') {
      hline(7, 16, 6, '#00F5D4');
      rect(3, 9, 2, 4, '#00F5D4');
      rect(19, 9, 2, 4, '#FF2E93');
    } else if (m.gear === 'argon_crystal') {
      rect(11, 1 + frame, 2, 3, '#A855F7');
      px(11, 2 + frame, '#FFFFFF');
    } else if (m.gear === 'hydrogen_halo') {
      hline(7, 16, 6, '#38BDF8');
      rect(3, 9, 2, 3, '#0EA5E9');
      rect(19, 9, 2, 3, '#0EA5E9');
    } else if (m.gear === 'scholar_glasses') {
      hline(6, 10, 9, '#FBBF24');
      hline(6, 10, 13, '#FBBF24');
      hline(11, 12, 11, '#FBBF24');
      hline(13, 17, 9, '#FBBF24');
      hline(13, 17, 13, '#FBBF24');
    } else if (m.gear === 'flash_goggles') {
      rect(7, 7, 4, 2, '#38BDF8');
      rect(13, 7, 4, 2, '#38BDF8');
      hline(11, 13, 2, '#FDE047');
      hline(10, 12, 3, '#F59E0B');
    } else if (m.gear === 'opus_tophat') {
      hline(7, 16, 6, OUTLINE);
      rect(9, 2, 6, 4, '#1E293B');
      hline(9, 14, 5, '#FBBF24');
    } else if (m.gear === 'sonnet_beret') {
      rect(7, 4, 10, 3, '#D97757');
      px(16, 3, '#FFFFFF');
    } else if (m.gear === 'oss_visor') {
      vline(11, 3, 6, '#64748B');
      rect(11, 1, 2, 2, '#10B981');
    } else if (m.gear === 'auto_star') {
      px(11, 9, '#38BDF8');
      px(12, 9, '#818CF8');
    }

    hline(7, 16, 16, m.collar1);
    px(11, 16, frame === 1 && m.gear === 'auto_star' ? '#FFFFFF' : '#FEF08A');
    px(12, 16, m.gear === 'auto_star' ? '#38BDF8' : '#FEF08A');
    rect(7, 17, 10, 4, m.fur);
    rect(9, 17, 6, 3, m.chest);
    vline(6, 16, 20, OUTLINE);
    vline(17, 16, 20, OUTLINE);

    if (status === 'GENERATING') {
      rect(4, 20, 16, 3, '#1E293B');
      for (let kx = 5; kx <= 17; kx += 3) {
        rect(kx, 21, 2, 1, (kx + frame * 3) % 6 === 0 ? '#38BDF8' : '#64748B');
      }
      rect(6, frame === 0 ? 19 : 18, 3, 2, m.chest);
      rect(15, frame === 0 ? 18 : 19, 3, 2, m.chest);
    } else if (status === 'RUNNING_TOOLS') {
      rect(13, 19, 8, 4, '#EF4444');
      px(16, 20, '#FBBF24');
      vline(8, 15 - frame, 19, '#CBD5E1');
      rect(7, 14 - frame, 3, 2, '#38BDF8');
    } else {
      rect(9, 18, 5, 5, '#FFFFFF');
      vline(8, 18, 22, OUTLINE);
      vline(14, 18, 22, OUTLINE);
      hline(9, 13, 23, OUTLINE);
      px(11, 20, m.dot);
      px(10, 16 - frame, '#94A3B8');
      px(12, 15 - frame, '#CBD5E1');
    }

    return g.canvas;
  }

  // =========================================================================
  // Lazy Sprite Cache (10 Archetypes * 2 Sizes * 4 States * 2 Frames = 160)
  // =========================================================================

  let cachedSprites = null;
  let cachedFactory = null;
  let cachedBakeMs = 0;

  function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function ensureSpriteCache(createCanvasFn) {
    const explicitFactory = typeof createCanvasFn === 'function' ? createCanvasFn : null;

    if (cachedSprites && cachedSprites.size === 160 && (!explicitFactory || explicitFactory === cachedFactory)) {
      return {
        cache: cachedSprites,
        size: cachedSprites.size,
        mainSize: 32,
        subSize: 24,
        bakeMs: cachedBakeMs,
      };
    }

    let factory = explicitFactory;
    if (!factory && root.document && typeof root.document.createElement === 'function') {
      factory = () => root.document.createElement('canvas');
    }

    if (!factory) {
      return {
        cache: cachedSprites || new Map(),
        size: cachedSprites ? cachedSprites.size : 0,
        mainSize: 32,
        subSize: 24,
        bakeMs: cachedBakeMs,
      };
    }

    const t0 = nowMs();
    const map = new Map();
    for (const m of MODEL_ARCHETYPES) {
      for (const st of SPRITE_STATES) {
        for (let f = 0; f < 2; f += 1) {
          map.set(`main:${m.id}:${st}:${f}`, bakeMain32(m, st, f, factory));
          map.set(`sub:${m.id}:${st}:${f}`, bakeSub24(m, st, f, factory));
        }
      }
    }
    const elapsed = Number((nowMs() - t0).toFixed(2));
    cachedSprites = map;
    cachedFactory = explicitFactory;
    cachedBakeMs = elapsed;

    return {
      cache: map,
      size: map.size,
      mainSize: 32,
      subSize: 24,
      bakeMs: elapsed,
    };
  }

  // =========================================================================
  // Theme Detection (--tm-bg luminance -> data-theme -> matchMedia)
  // =========================================================================

  function parseCssColorRgb(rawColor) {
    let str = String(rawColor || '').trim();
    if (!str) return null;

    // Unwrap CSS var(--token, fallback) chains if unresolved by a mock/engine
    for (let guard = 0; guard < 4 && /^var\(/i.test(str); guard += 1) {
      const commaIdx = str.indexOf(',');
      if (commaIdx < 0) return null;
      const inner = str.slice(commaIdx + 1, str.lastIndexOf(')')).trim();
      if (!inner) return null;
      str = inner;
    }

    if (str.startsWith('#')) {
      const hex = str.slice(1).trim();
      if (/^[0-9a-f]{3,4}$/i.test(hex)) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
        return a > 0 ? { r, g, b } : null;
      }
      if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{8}$/i.test(hex)) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return a > 0 ? { r, g, b } : null;
      }
      return null;
    }

    const rgbMatch = str.match(
      /^rgba?\(\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i,
    );
    if (rgbMatch) {
      const r = Number(rgbMatch[1]);
      const g = Number(rgbMatch[2]);
      const b = Number(rgbMatch[3]);
      let a = 1;
      if (rgbMatch[4] !== undefined) {
        a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : Number(rgbMatch[4]);
      }
      if ([r, g, b].every(Number.isFinite) && a > 0) {
        return { r, g, b };
      }
    }

    return null;
  }

  function detectDarkTheme(doc) {
    const d = doc || (typeof root.document !== 'undefined' ? root.document : null);
    if (!d) return false;

    const el = d.documentElement;
    const win = d.defaultView || root;
    if (el && win && typeof win.getComputedStyle === 'function') {
      try {
        const cs = win.getComputedStyle(el);
        const bg = cs && typeof cs.getPropertyValue === 'function' ? cs.getPropertyValue('--tm-bg') : '';
        const rgb = parseCssColorRgb(bg);
        if (rgb) {
          const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
          return lum < 0.5;
        }
      } catch {
        // Fall through to attribute / matchMedia checks
      }
    }

    if (el && typeof el.getAttribute === 'function') {
      const themeAttr = String(el.getAttribute('data-theme') || '').toLowerCase();
      if (themeAttr === 'dark') return true;
      if (themeAttr === 'light') return false;
    }

    const mm = (win && typeof win.matchMedia === 'function' ? win.matchMedia : null) ||
      (typeof root.matchMedia === 'function' ? root.matchMedia : null);
    if (mm) {
      try {
        return Boolean(mm('(prefers-color-scheme: dark)')?.matches);
      } catch {
        return false;
      }
    }

    return false;
  }

  // =========================================================================
  // Canvas Text & Drawing Primitives (Safe on Real Chromium & Mock Canvases)
  // =========================================================================

  function estimateTextWidthFallback(str, fontPx) {
    let w = 0;
    for (const ch of Array.from(String(str || ''))) {
      w += ch.codePointAt(0) > 0xff ? fontPx * 1.02 : fontPx * 0.6;
    }
    return w;
  }

  function measureTextWidth(ctx, str, fontPx) {
    if (ctx && typeof ctx.measureText === 'function') {
      try {
        const m = ctx.measureText(String(str || ''));
        if (m && Number.isFinite(m.width) && m.width >= 0) return m.width;
      } catch {
        // Fallback below
      }
    }
    return estimateTextWidthFallback(str, fontPx);
  }

  function truncateCanvasText(ctx, text, maxWidth, fontPx) {
    const str = String(text || '');
    if (!str || maxWidth <= 0) return '';
    if (measureTextWidth(ctx, str, fontPx) <= maxWidth) return str;
    const ellipsis = '…';
    const ellW = measureTextWidth(ctx, ellipsis, fontPx);
    if (ellW >= maxWidth) return ellipsis;
    const chars = Array.from(str);
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const slice = chars.slice(0, mid).join('');
      if (measureTextWidth(ctx, slice, fontPx) + ellW <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return `${chars.slice(0, lo).join('').trimEnd()}${ellipsis}`;
  }

  function safeStrokeRect(ctx, x, y, w, h) {
    if (typeof ctx.strokeRect === 'function') {
      ctx.strokeRect(x, y, w, h);
    }
  }

  function safeFillText(ctx, text, x, y) {
    if (typeof ctx.fillText === 'function') {
      ctx.fillText(text, x, y);
    }
  }

  function drawDesk(ctx, cx, deskY, deskW, isMain, accent, status, frame, dark) {
    const h = isMain ? 20 : 15;
    const x = Math.round(cx - deskW / 2);
    const y = Math.round(deskY);

    // Soft floor drop shadow
    ctx.fillStyle = dark ? 'rgba(2, 6, 23, 0.45)' : 'rgba(15, 23, 42, 0.08)';
    ctx.fillRect(x - 2, y + h - 2, deskW + 4, 5);

    // Desk surface & front apron
    ctx.fillStyle = dark ? '#1E293B' : '#E2E8F0';
    ctx.fillRect(x, y, deskW, h - 4);
    ctx.fillStyle = dark ? '#0F172A' : '#CBD5E1';
    ctx.fillRect(x, y + h - 4, deskW, 4);

    // Model-accent light strip along desk edge
    ctx.fillStyle = status === 'ENDED' ? (dark ? '#334155' : '#94A3B8') : accent;
    ctx.fillRect(x + 4, y + h - 4, Math.max(8, deskW - 8), 2);

    // Monitor on right edge of desk
    const mw = isMain ? 20 : 14;
    const mh = isMain ? 14 : 10;
    const mx = x + deskW - mw - 3;
    const my = y - mh + 3;
    ctx.fillStyle = '#334155';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = status === 'ENDED' ? '#090D16' : '#0F172A';
    ctx.fillRect(mx + 2, my + 2, mw - 4, mh - 4);

    if (status === 'ENDED') {
      // Dim standby LED when off duty
      ctx.fillStyle = '#334155';
      ctx.fillRect(mx + mw - 4, my + mh - 3, 1, 1);
    } else if (status === 'GENERATING') {
      ctx.fillStyle = accent;
      ctx.fillRect(mx + 3, my + 3, ((frame * 4 + 4) % Math.max(2, mw - 7)) + 2, 2);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(mx + 3, my + 6, ((frame * 3 + 6) % Math.max(2, mw - 7)) + 2, 2);
    } else if (status === 'RUNNING_TOOLS') {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(mx + 3, my + 3, mw - 6, 2);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(mx + 3 + frame * 2, my + 6, Math.max(3, mw - 8), 2);
    } else {
      // Calm standby pixel waveform
      ctx.fillStyle = accent;
      ctx.fillRect(mx + 3, my + Math.floor(mh / 2) - 1, Math.max(3, mw - 8), 1);
    }
  }

  function drawPixelPlant(ctx, x, y, dark) {
    // Leaves
    ctx.fillStyle = '#059669';
    ctx.fillRect(x + 4, y + 4, 8, 6);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(x + 2, y + 2, 4, 4);
    ctx.fillRect(x + 10, y + 1, 4, 5);
    ctx.fillStyle = '#34D399';
    ctx.fillRect(x + 6, y, 4, 4);
    // Terracotta pot
    ctx.fillStyle = dark ? '#9A3412' : '#C2410C';
    ctx.fillRect(x + 3, y + 10, 10, 2);
    ctx.fillStyle = '#D97757';
    ctx.fillRect(x + 4, y + 12, 8, 6);
    ctx.fillStyle = dark ? 'rgba(2,6,23,0.4)' : 'rgba(15,23,42,0.12)';
    ctx.fillRect(x + 3, y + 18, 10, 2);
  }

  function drawPixelSideConsole(ctx, x, y, dark) {
    // Cozy mini pixel shelf & glowing status tower
    ctx.fillStyle = dark ? '#1E293B' : '#CBD5E1';
    ctx.fillRect(x, y, 22, 24);
    ctx.fillStyle = dark ? '#0F172A' : '#E2E8F0';
    ctx.fillRect(x + 2, y + 2, 18, 8);
    ctx.fillRect(x + 2, y + 12, 18, 9);
    // Tiny books / server LEDs
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(x + 4, y + 4, 3, 5);
    ctx.fillStyle = '#A855F7';
    ctx.fillRect(x + 8, y + 5, 3, 4);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(x + 12, y + 4, 4, 5);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(x + 4, y + 15, 2, 2);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(x + 8, y + 15, 6, 2);
  }

  function getStatusDotColor(status) {
    if (status === 'GENERATING') return '#10B981';
    if (status === 'RUNNING_TOOLS') return '#F59E0B';
    if (status === 'ENDED') return '#64748B';
    return '#38BDF8';
  }

  function drawToolBubble(ctx, cx, bubbleY, maxW, label, accent, dark) {
    const fontPx = 9.5;
    ctx.font = `600 ${fontPx}px ${MONO_FONT_FAMILY}, ${SANS_FONT_FAMILY}`;
    const safeText = truncateCanvasText(ctx, label, Math.max(24, maxW - 16), fontPx);
    if (!safeText) return;
    const textW = measureTextWidth(ctx, safeText, fontPx);
    const bw = Math.min(maxW, Math.max(30, Math.round(textW + 14)));
    const bh = 13;
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(bubbleY);

    ctx.fillStyle = dark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1;
    safeStrokeRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1);

    // Small downward pointer pixel
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(Math.round(cx) - 1, by + bh, 3, 2);
    ctx.fillRect(bx + 4, by + 4, 4, 5);

    ctx.fillStyle = dark ? '#F8FAFC' : '#0F172A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    safeFillText(ctx, safeText, bx + 11, by + bh / 2 + 0.5);
  }

  function drawSpeedBadge(ctx, cx, badgeY, maxW, tokPerSec, accent, dark) {
    const speedText = `${Math.round(tokPerSec)}/s`;
    const fontPx = 9;
    ctx.font = `600 ${fontPx}px ${MONO_FONT_FAMILY}`;
    const textW = measureTextWidth(ctx, speedText, fontPx);
    const bw = Math.min(maxW, Math.round(textW + 13));
    const bh = 12;
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(badgeY);

    ctx.fillStyle = dark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.13)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1;
    safeStrokeRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1);

    ctx.fillStyle = '#10B981';
    ctx.fillRect(bx + 3, by + 4, 4, 4);
    ctx.fillStyle = dark ? '#A7F3D0' : '#065F46';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    safeFillText(ctx, speedText, bx + 9, by + bh / 2 + 0.5);
  }

  function getSlotFrame(slot, tick, slotIdx) {
    const status = slot.killed ? 'ENDED' : (slot.status || 'IDLE');
    if (status === 'GENERATING') {
      const speed = Math.max(20, Math.min(180, Number(slot.tokPerSec) || 60));
      const period = Math.max(1, Math.round(135 / speed));
      return Math.floor(tick / period) % 2;
    }
    return (Math.floor(tick / 6) + (slotIdx % 2)) % 2;
  }

  function drawSlotUnit(ctx, sprites, geom, slot, slotIdx, selectedKey, tick, dark) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:27:15
// Description: Resolve fallback slot archetype via modelLabel || model || rawModel.
// ============================================================================
    const arch =
      slot.archetype && slot.archetype.id
        ? slot.archetype
        : resolveCatArchetype(slot.modelLabel || slot.model || slot.rawModel);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:27:15
// ============================================================================
    const status = slot.killed ? 'ENDED' : (slot.status || 'IDLE');
    const frame = getSlotFrame(slot, tick, slotIdx);
    const isSel = Boolean(selectedKey) && slot.key === selectedKey;

    const { cx, cellW, boxX, boxY, boxW, boxH, spriteSize, sy, deskY, deskW, tagY, tagW, tagH, bubbleY } = geom;

    // Selection highlight bay behind desk/cat
    if (isSel) {
      ctx.fillStyle = dark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(2, 132, 199, 0.08)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = arch.dot;
      ctx.lineWidth = 1.5;
      safeStrokeRect(ctx, boxX + 0.75, boxY + 0.75, boxW - 1.5, boxH - 1.5);
    }

    // Floating Tool Bubble or Speed Chip above desk
    if (status === 'RUNNING_TOOLS' && slot.activeToolLabel) {
      drawToolBubble(ctx, cx, bubbleY, Math.max(54, cellW - 4), slot.activeToolLabel, arch.dot, dark);
    } else if (status === 'GENERATING' && slot.isMain && slot.tokPerSec > 0) {
      drawSpeedBadge(ctx, cx, bubbleY, Math.max(46, cellW - 8), slot.tokPerSec, arch.dot, dark);
    }

    // Desk
    drawDesk(ctx, cx, deskY, deskW, slot.isMain, arch.deskAccent, status, frame, dark);

    // Pre-rendered Pixel Cat Sprite
    const spriteKey = `${slot.isMain ? 'main' : 'sub'}:${arch.id}:${status}:${frame}`;
    const sprite = sprites ? sprites.get(spriteKey) : null;
    const sx = Math.round(cx - spriteSize / 2) - (slot.isMain ? 5 : 4);
    if (sprite && typeof ctx.drawImage === 'function') {
      try {
        ctx.drawImage(sprite, sx, sy, spriteSize, spriteSize);
      } catch {
        // Ignore headless mock canvas incompatibilities
      }
    }

    // Nameplate pill with live status dot & concise truncated label
    const tx = Math.round(cx - tagW / 2);
    const ty = Math.round(tagY);
    ctx.fillStyle = isSel
      ? (dark ? '#1E3A8A' : '#DBEAFE')
      : (dark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.94)');
    ctx.fillRect(tx, ty, tagW, tagH);
    ctx.strokeStyle = isSel ? arch.dot : (dark ? '#334155' : '#CBD5E1');
    ctx.lineWidth = isSel ? 1.5 : 1;
    safeStrokeRect(ctx, tx + 0.5, ty + 0.5, tagW - 1, tagH - 1);

    // Live status dot
    ctx.fillStyle = getStatusDotColor(status);
    ctx.fillRect(tx + 4, ty + Math.floor((tagH - 5) / 2), 5, 5);

    // Nameplate text
    let label = '';
    if (slot.isMain) {
      const base = slot.role && slot.role !== 'Main' ? slot.role : 'Main';
      label = `${base} · ${arch.short}`;
    } else {
      label =
        cellW >= 112 && slot.name && slot.name !== arch.short
          ? `${slot.name} · ${arch.short}`
          : (slot.name || arch.short);
    }
    const fontPx = slot.isMain ? 10 : 9.5;
    ctx.font = `${isSel ? 700 : 600} ${fontPx}px ${MONO_FONT_FAMILY}, ${SANS_FONT_FAMILY}`;
    const maxTextW = Math.max(16, tagW - 15);
    const safeLabel = truncateCanvasText(ctx, label, maxTextW, fontPx);
    ctx.fillStyle = dark ? '#F8FAFC' : '#0F172A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    safeFillText(ctx, safeLabel, tx + 11, ty + tagH / 2 + 0.5);

    return {
      type: 'slot',
      key: slot.key,
      slot,
      x: boxX,
      y: boxY,
      w: boxW,
      h: boxH,
    };
  }

  function computeLayout(logicalWidth, subCount, overflowCount) {
    const items = [];
    let logicalHeight = 132;
    let divider = null;
    let studioProps = false;

    if (subCount === 0) {
      logicalHeight = 132;
      studioProps = true;
      const cx = Math.round(logicalWidth / 2);
      const boxW = Math.min(logicalWidth - 16, 152);
      items.push({
        slotIdx: 0,
        cx,
        cellW: boxW,
        boxX: Math.round(cx - boxW / 2),
        boxY: 6,
        boxW,
        boxH: 118,
        spriteSize: 64,
        bubbleY: 7,
        sy: 21,
        deskY: 75,
        deskW: 96,
        tagY: 101,
        tagW: Math.min(126, boxW - 8),
        tagH: 17,
      });
    } else if (subCount <= 4 && logicalWidth >= 420) {
      logicalHeight = 148;
      const leftZoneW = Math.min(148, Math.max(118, Math.round(logicalWidth * 0.27)));
      const divX = leftZoneW + 4;
      divider = { orientation: 'v', pos: divX, start: 12, end: logicalHeight - 12 };
      const mainCx = Math.round(6 + (leftZoneW - 6) / 2);
      items.push({
        slotIdx: 0,
        cx: mainCx,
        cellW: leftZoneW - 8,
        boxX: 6,
        boxY: 8,
        boxW: leftZoneW - 8,
        boxH: logicalHeight - 16,
        spriteSize: 64,
        bubbleY: 10,
        sy: 26,
        deskY: 80,
        deskW: Math.min(94, leftZoneW - 16),
        tagY: 106,
        tagW: Math.min(112, leftZoneW - 14),
        tagH: 17,
      });

      const rightX = divX + 8;
      const rightW = logicalWidth - rightX - 6;
      const cellW = Math.floor(rightW / subCount);
      for (let i = 0; i < subCount; i += 1) {
        const bx = rightX + i * cellW + 2;
        const bw = cellW - 4;
        const cx = Math.round(bx + bw / 2);
        items.push({
          slotIdx: 1 + i,
          cx,
          cellW: bw,
          boxX: bx,
          boxY: 14,
          boxW: bw,
          boxH: logicalHeight - 28,
          spriteSize: 48,
          bubbleY: 18,
          sy: 34,
          deskY: 75,
          deskW: Math.min(72, bw - 4),
          tagY: 96,
          tagW: Math.min(82, bw - 4),
          tagH: 16,
        });
      }
    } else if (subCount <= 4) {
      // Narrow (< 420) collaborative stacked layout: Main top + subs row or 2x2 below
      const singleRow = subCount <= 2 || (subCount === 3 && logicalWidth >= 340);
      const cols = singleRow ? subCount : 2;
      const rows = singleRow ? 1 : 2;
      const rowH = singleRow ? 92 : 88;
      const subStartY = 120;
      logicalHeight = subStartY + rows * rowH + 8;

      const mainCx = Math.round(logicalWidth / 2);
      const mainBoxW = Math.min(logicalWidth - 16, 152);
      items.push({
        slotIdx: 0,
        cx: mainCx,
        cellW: mainBoxW,
        boxX: Math.round(mainCx - mainBoxW / 2),
        boxY: 6,
        boxW: mainBoxW,
        boxH: 106,
        spriteSize: 64,
        bubbleY: 6,
        sy: 18,
        deskY: 71,
        deskW: 92,
        tagY: 94,
        tagW: Math.min(120, mainBoxW - 10),
        tagH: 16,
      });

      divider = { orientation: 'h', pos: 115, start: 12, end: logicalWidth - 12 };
      const padX = 6;
      const cellW = Math.floor((logicalWidth - padX * 2) / cols);
      for (let i = 0; i < subCount; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rowTop = subStartY + row * rowH;
        const bx = padX + col * cellW + 2;
        const bw = cellW - 4;
        const cx = Math.round(bx + bw / 2);
        items.push({
          slotIdx: 1 + i,
          cx,
          cellW: bw,
          boxX: bx,
          boxY: rowTop,
          boxW: bw,
          boxH: rowH - 4,
          spriteSize: 48,
          bubbleY: rowTop + 2,
          sy: rowTop + 14,
          deskY: rowTop + 53,
          deskW: Math.min(72, bw - 6),
          tagY: rowTop + 70,
          tagW: Math.min(92, bw - 6),
          tagH: 15,
        });
      }
    } else if (logicalWidth >= 430) {
      // 5..8 subagents wide: Main left + 4x2 matrix right (logicalHeight = 244)
      logicalHeight = 244;
      const leftZoneW = Math.min(144, Math.max(114, Math.round(logicalWidth * 0.25)));
      const divX = leftZoneW + 4;
      divider = { orientation: 'v', pos: divX, start: 12, end: logicalHeight - 12 };

      const mainCx = Math.round(6 + (leftZoneW - 6) / 2);
      items.push({
        slotIdx: 0,
        cx: mainCx,
        cellW: leftZoneW - 8,
        boxX: 6,
        boxY: 12,
        boxW: leftZoneW - 8,
        boxH: logicalHeight - 24,
        spriteSize: 64,
        bubbleY: 56,
        sy: 72,
        deskY: 126,
        deskW: Math.min(94, leftZoneW - 14),
        tagY: 152,
        tagW: Math.min(110, leftZoneW - 12),
        tagH: 17,
      });

      const rightX = divX + 8;
      const rightW = logicalWidth - rightX - 6;
      const cols = 4;
      const cellW = Math.floor(rightW / cols);
      const rowTops = [10, 112];
      const rowBoxH = 96;
      for (let i = 0; i < subCount; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rowTop = rowTops[row];
        const bx = rightX + col * cellW + 2;
        const bw = cellW - 4;
        const cx = Math.round(bx + bw / 2);
        items.push({
          slotIdx: 1 + i,
          cx,
          cellW: bw,
          boxX: bx,
          boxY: rowTop,
          boxW: bw,
          boxH: rowBoxH,
          spriteSize: 48,
          bubbleY: rowTop + 2,
          sy: rowTop + 15,
          deskY: rowTop + 54,
          deskW: Math.min(72, bw - 4),
          tagY: rowTop + 73,
          tagW: Math.min(82, bw - 4),
          tagH: 16,
        });
      }
    } else {
      // 5..8 subagents narrow (< 430): Main top + 4x2 compact sub matrix below
      logicalHeight = overflowCount > 0 ? 304 : 284;
      const mainCx = Math.round(logicalWidth / 2);
      const mainBoxW = Math.min(logicalWidth - 16, 148);
      items.push({
        slotIdx: 0,
        cx: mainCx,
        cellW: mainBoxW,
        boxX: Math.round(mainCx - mainBoxW / 2),
        boxY: 5,
        boxW: mainBoxW,
        boxH: 98,
        spriteSize: 64,
        bubbleY: 4,
        sy: 16,
        deskY: 67,
        deskW: 90,
        tagY: 86,
        tagW: Math.min(116, mainBoxW - 10),
        tagH: 15,
      });

      divider = { orientation: 'h', pos: 106, start: 10, end: logicalWidth - 10 };
      const padX = 6;
      const cols = 4;
      const cellW = Math.floor((logicalWidth - padX * 2) / cols);
      const rowTops = [110, 194];
      const rowBoxH = 80;
      for (let i = 0; i < subCount; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rowTop = rowTops[row];
        const bx = padX + col * cellW + 1;
        const bw = cellW - 2;
        const cx = Math.round(bx + bw / 2);
        items.push({
          slotIdx: 1 + i,
          cx,
          cellW: bw,
          boxX: bx,
          boxY: rowTop,
          boxW: bw,
          boxH: rowBoxH,
          spriteSize: 48,
          bubbleY: rowTop,
          sy: rowTop + 11,
          deskY: rowTop + 49,
          deskW: Math.min(68, bw - 4),
          tagY: rowTop + 64,
          tagW: Math.min(76, bw - 4),
          tagH: 14,
        });
      }
    }

    return { logicalWidth, logicalHeight, items, divider, studioProps };
  }

  function renderOfficeCanvas(canvas, officeModel, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const tick = Number(options.tick) || 0;
    const selectedKey = String(options.selectedKey || '');
    const dark = typeof options.dark === 'boolean' ? options.dark : detectDarkTheme();
    const cssWidth = Math.max(240, Math.round(Number(options.cssWidth) || canvas?.clientWidth || 380));
    const dpr = Math.max(1, Math.min(4, Number(options.dpr) || (typeof root.devicePixelRatio === 'number' ? root.devicePixelRatio : 1) || 1));

    const model = officeModel && Array.isArray(officeModel.slots) && officeModel.slots.length > 0
      ? officeModel
      : buildOfficeModel(null, [], options.lang);
    const slots = model.slots;
    const subCount = Math.min(MAX_SUBAGENTS, Math.max(0, slots.length - 1));
    const overflowCount = Math.max(0, Number(model.overflowCount) || 0);

    const layout = computeLayout(cssWidth, subCount, overflowCount);
    const { logicalWidth, logicalHeight, items, divider, studioProps } = layout;

    if (!canvas || typeof canvas.getContext !== 'function') {
      return { hitBoxes: [], logicalWidth, logicalHeight };
    }

    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { hitBoxes: [], logicalWidth, logicalHeight };
    }

    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;

    const spritePack = ensureSpriteCache();
    const sprites = spritePack.cache;

    // 1. Studio Floor Backdrop + Subtle 16px Pixel Grid
    ctx.fillStyle = dark ? '#0B1120' : '#F8FAFC';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = dark ? 'rgba(51, 65, 85, 0.24)' : 'rgba(148, 163, 184, 0.16)';
    for (let gx = 0; gx < logicalWidth; gx += 16) {
      ctx.fillRect(gx, 0, 1, logicalHeight);
    }
    for (let gy = 0; gy < logicalHeight; gy += 16) {
      ctx.fillRect(0, gy, logicalWidth, 1);
    }

    // 2. Top Aurora Accent Bar
    if (typeof ctx.createLinearGradient === 'function') {
      const grad = ctx.createLinearGradient(0, 0, logicalWidth, 0);
      grad.addColorStop(0, '#4285F4');
      grad.addColorStop(0.5, '#9B72CB');
      grad.addColorStop(1, '#EC4899');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#4285F4';
    }
    ctx.fillRect(0, 0, logicalWidth, 3);

    // 3. Cozy Studio Rug & Corner Props in 0-Subagent Mode
    if (studioProps) {
      const mainCx = Math.round(logicalWidth / 2);
      const rugW = Math.min(logicalWidth - 24, 140);
      ctx.fillStyle = dark ? 'rgba(99, 102, 241, 0.13)' : 'rgba(99, 102, 241, 0.08)';
      ctx.fillRect(Math.round(mainCx - rugW / 2), 88, rugW, 18);
      if (logicalWidth >= 260) {
        drawPixelPlant(ctx, Math.max(10, mainCx - 114), 76, dark);
      }
      if (logicalWidth >= 300) {
        drawPixelSideConsole(ctx, Math.min(logicalWidth - 32, mainCx + 92), 70, dark);
      }
    }

    // 4. Soft Zone Divider between Main & Subagent Matrix
    if (divider) {
      ctx.fillStyle = dark ? 'rgba(99, 102, 241, 0.28)' : 'rgba(99, 102, 241, 0.20)';
      if (divider.orientation === 'v') {
        for (let dy = divider.start; dy < divider.end; dy += 8) {
          ctx.fillRect(divider.pos, dy, 2, 4);
        }
      } else {
        for (let dx = divider.start; dx < divider.end; dx += 8) {
          ctx.fillRect(dx, divider.pos, 4, 2);
        }
      }
    }

    // 5. Render Main + Visible Subagent Slots
    const hitBoxes = [];
    for (const geom of items) {
      const slot = slots[geom.slotIdx];
      if (!slot) continue;
      hitBoxes.push(drawSlotUnit(ctx, sprites, geom, slot, geom.slotIdx, selectedKey, tick, dark));
    }

    // 6. Clickable Overflow Pill (+N) in Bottom-Right Corner
    if (overflowCount > 0) {
      const pillText = `+${overflowCount}`;
      const fontPx = 10;
      ctx.font = `700 ${fontPx}px ${MONO_FONT_FAMILY}`;
      const tw = measureTextWidth(ctx, pillText, fontPx);
      const pw = Math.max(28, Math.round(tw + 14));
      const ph = 18;
      const px = logicalWidth - pw - 8;
      const py = logicalHeight - ph - 6;

      ctx.fillStyle = dark ? '#1E293B' : '#FFFFFF';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 1;
      safeStrokeRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1);

      ctx.fillStyle = dark ? '#C7D2FE' : '#4338CA';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      safeFillText(ctx, pillText, px + pw / 2, py + ph / 2 + 0.5);

      hitBoxes.push({
        type: 'overflow',
        key: 'overflow',
        x: px,
        y: py,
        w: pw,
        h: ph,
      });
    }

    return {
      hitBoxes,
      logicalWidth,
      logicalHeight,
    };
  }

  function renderInspectorPortrait(canvas, slot, opts) {
    if (!canvas || typeof canvas.getContext !== 'function') return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const options = opts && typeof opts === 'object' ? opts : {};
    const tick = Number(options.tick) || 0;
    const dark = typeof options.dark === 'boolean' ? options.dark : detectDarkTheme();
    const w = Number(canvas.width) || 96;
    const h = Number(canvas.height) || 96;

    const s = slot && typeof slot === 'object' ? slot : {};
    const isMain = Boolean(s.isMain);
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:27:15
// Description: Resolve fallback portrait archetype via modelLabel || model || rawModel.
// ============================================================================
    const arch =
      s.archetype && s.archetype.id
        ? s.archetype
        : resolveCatArchetype(s.modelLabel || s.model || s.rawModel);
// ============================================================================
// [MODIFIED END] 2026-11-19 13:27:15
// ============================================================================
    const status = s.killed ? 'ENDED' : (s.status || 'IDLE');
    const frame = getSlotFrame(s, tick, 0);

    const spritePack = ensureSpriteCache();
    const spriteKey = `${isMain ? 'main' : 'sub'}:${arch.id}:${status}:${frame}`;
    const sprite = spritePack.cache ? spritePack.cache.get(spriteKey) : null;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = dark ? '#0F172A' : '#F1F5F9';
    ctx.fillRect(0, 0, w, h);

    // Subtle 16px pixel grid backdrop
    ctx.fillStyle = dark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(148, 163, 184, 0.20)';
    const step = Math.max(8, Math.floor(w / 6));
    for (let gx = step; gx < w; gx += step) ctx.fillRect(gx, 0, 1, h);
    for (let gy = step; gy < h; gy += step) ctx.fillRect(0, gy, w, 1);

    // Subtle model accent corner pixels
    ctx.fillStyle = arch.dot;
    ctx.fillRect(0, 0, 6, 2);
    ctx.fillRect(0, 0, 2, 6);
    ctx.fillRect(w - 6, h - 2, 6, 2);
    ctx.fillRect(w - 2, h - 6, 2, 6);

    const baseGrid = isMain ? 32 : 24;
    const scale = Math.max(1, Math.floor(Math.min(w, h) / baseGrid));
    const drawSize = baseGrid * scale;
    const dx = Math.floor((w - drawSize) / 2);
    const dy = Math.floor((h - drawSize) / 2);

    if (sprite && typeof ctx.drawImage === 'function') {
      try {
        ctx.drawImage(sprite, dx, dy, drawSize, drawSize);
      } catch {
        // Ignore headless mock canvas incompatibilities
      }
    }

    return true;
  }

  function hitTest(hitBoxes, logicalX, logicalY) {
    if (!Array.isArray(hitBoxes)) return null;
    const x = Number(logicalX);
    const y = Number(logicalY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    for (let i = hitBoxes.length - 1; i >= 0; i -= 1) {
      const b = hitBoxes[i];
      if (!b) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  const api = {
    MAX_SUBAGENTS,
    MODEL_ARCHETYPES,
    resolveCatArchetype,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:27:15
// Description: Export selectRoundChildren on TokenMonitorPixelOffice API.
// ============================================================================
    selectRoundChildren,
// ============================================================================
// [MODIFIED END] 2026-11-19 13:27:15
// ============================================================================
    buildOfficeModel,
    ensureSpriteCache,
    detectDarkTheme,
    renderOfficeCanvas,
    renderInspectorPortrait,
    hitTest,
  };

  root.TokenMonitorPixelOffice = api;
  if (typeof module === 'object' && module !== null && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
// ============================================================================
// [MODIFIED END] 2026-11-19 11:49:09
// ============================================================================
