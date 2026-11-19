// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:39:00
// Description: Implement Session Checkout Receipt view-model builder, high-DPI
// thermal-paper Canvas 2D renderer, and PNG Blob export helper for v0.2.9.
// ============================================================================
(function (root) {
  'use strict';

  const SANS_FONT_FAMILY =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, -apple-system, sans-serif';
  const MONO_FONT_FAMILY =
    '"JetBrains Mono", "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';
  const MIXED_VALUE_FONT_FAMILY = `${MONO_FONT_FAMILY}, ${SANS_FONT_FAMILY}`;

  const KNOWN_MODEL_SLUGS = Object.freeze([
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:48:32
// Description: Tighten Gemini 4 Carbon regex boundary and add Gemini 4 Neon /
// Orchestrator (Neon) display label mapping.
// ============================================================================
    [/gemini[\s_-]*4[\s_-]*carbon|orchestrator[\s(-]*carbon|gemini-pro-orchestrator(?=$|[\s)]|-carbon(?=$|[-_\s]))/i, 'Gemini 4 Carbon'],
    [/gemini[\s_-]*4[\s_-]*neon|orchestrator[\s(-]*neon|gemini-pro-orchestrator-neon/i, 'Gemini 4 Neon'],
// ============================================================================
// [MODIFIED END] 2026-11-19 11:48:32
// ============================================================================
    [/gemini[\s_-]*4[\s_-]*argon|orchestrator[\s(-]*argon|gemini-pro-orchestrator-argon/i, 'Gemini 4 Argon'],
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 13:26:49
// Description: Move gemini-flash-worker attribution from Gemini 3.8 Flash to
// Gemini 4 Hydrogen in KNOWN_MODEL_SLUGS.
// ============================================================================
    [/gemini[\s_-]*4[\s_-]*hydrogen|gemini[\s_-]*flash[\s_-]*worker/i, 'Gemini 4 Hydrogen'],
    [/gemini[\s_-]*3\.?1[\s_-]*pro|gemini-pro-default/i, 'Gemini 3.1 Pro'],
    [/gemini[\s_-]*3[._-]?8[\s_-]*flash/i, 'Gemini 3.8 Flash'],
// ============================================================================
// [MODIFIED END] 2026-11-19 13:26:49
// ============================================================================
    [/claude[\s_-]*opus[\s_-]*5[._-]*5/i, 'Claude Opus 5.5'],
    [/claude[\s_-]*opus[\s_-]*4[._-]*6/i, 'Claude Opus 4.6'],
    [/claude[\s_-]*opus/i, 'Claude Opus 5.5'],
    [/claude[\s_-]*sonnet[\s_-]*5[._-]*5/i, 'Claude Sonnet 5.5'],
    [/claude[\s_-]*sonnet[\s_-]*4[._-]*5/i, 'Claude Sonnet 4.5'],
    [/claude[\s_-]*sonnet/i, 'Claude Sonnet 5.5'],
    [/claude[\s_-]*haiku/i, 'Claude Haiku'],
    [/gpt[\s_-]*oss[\s_-]*120b/i, 'GPT-OSS 120B'],
    [/gpt[\s_-]*oss/i, 'GPT-OSS'],
  ]);

  function formatIntWithCommas(intStr) {
    return String(intStr).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtReceiptTokens(val) {
    const raw = Number(val);
    if (!Number.isFinite(raw) || raw <= 0) return '0';
    const rounded = Math.round(raw);
    if (rounded <= 0) return '0';
    return formatIntWithCommas(String(rounded));
  }

  function fmtReceiptCost(val, currency = 'USD') {
    const sym = currency === 'CNY' ? '¥' : '$';
    const raw = Number(val);
    const n = Number.isFinite(raw) && raw > 0 ? raw : 0;
    if (n === 0) return `${sym}0.00`;
    if (n >= 0.01) {
      const fixed = n.toFixed(2);
      const parts = fixed.split('.');
      return `${sym}${formatIntWithCommas(parts[0])}.${parts[1]}`;
    }
    let s = n.toFixed(4);
    while (s.length > 4 && s.endsWith('0')) {
      s = s.slice(0, -1);
    }
    return `${sym}${s}`;
  }

  function formatLocalYmd(ms) {
    const d = new Date(Number.isFinite(ms) ? ms : Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatLocalHm(ms) {
    const d = new Date(ms);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function formatReceiptDateRange(startDate, endDate, fallbackYmd) {
    const start = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())
      ? startDate.trim()
      : '';
    const end = typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())
      ? endDate.trim()
      : '';
    if (start && end && start !== end) {
      const sParts = start.split('-');
      const eParts = end.split('-');
      if (sParts[0] === eParts[0]) {
        return `${sParts[0]}.${sParts[1]}.${sParts[2]} - ${eParts[1]}.${eParts[2]}`;
      }
      return `${start.replace(/-/g, '.')} - ${end.replace(/-/g, '.')}`;
    }
    const single = end || start || fallbackYmd;
    return String(single).replace(/-/g, '.');
  }

  function formatReceiptTimeRange(startedAtMs, endedAtMs) {
    const sOk = Number.isFinite(startedAtMs) && startedAtMs > 0;
    const eOk = Number.isFinite(endedAtMs) && endedAtMs > 0;
    if (!sOk && !eOk) return '—';
    const startMs = sOk ? startedAtMs : endedAtMs;
    const endMs = eOk && endedAtMs >= startMs ? endedAtMs : startMs;
    return `${formatLocalHm(startMs)}-${formatLocalHm(endMs)}`;
  }

  function humanizeSlug(slug) {
    return String(slug || '')
      .trim()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => {
        if (/^(?:gpt|oss|ai|api)$/i.test(part)) return part.toUpperCase();
        if (/^\d/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  function formatReceiptModelLabel(scopeObj, current, lang) {
    const rawProfileLabel = String(scopeObj?.primaryModel?.profileLabel || '').trim();
    const rawSlug = String(
      scopeObj?.primaryModel?.profileId ||
      scopeObj?.primaryModel?.model ||
      current?.activeModel ||
      '',
    ).trim();

    let candidate = rawProfileLabel || rawSlug || 'Auto';

    // Strip verbose reasoning/tier suffixes such as " (高推理)" or " (High)"
    candidate = candidate
      .replace(/\s*[（(]\s*(?:极高|高|中|低)?(?:推理|思考)[^）)]*[）)]/g, '')
      .trim();

    if (/^auto(?:\s*[（(].*[）)])?$/i.test(candidate) || /^unknown$/i.test(candidate)) {
      if (lang === 'en') return 'Auto';
      return rawProfileLabel === 'Auto (默认)' ? 'Auto (默认)' : 'Auto';
    }

    for (const [pattern, cleanName] of KNOWN_MODEL_SLUGS) {
      if (pattern.test(candidate) || (rawSlug && pattern.test(rawSlug))) {
        return cleanName;
      }
    }

    if (lang === 'en') {
      candidate = candidate.replace(/\s*[（(][^\x00-\x7F]+[）)]/g, '').trim();
    }

    if (/^[a-z0-9._-]+$/i.test(candidate) && candidate.includes('-')) {
      return humanizeSlug(candidate) || 'Auto';
    }

    return candidate || 'Auto';
  }

  function sumBucketTokens(bucket) {
    if (!bucket || typeof bucket !== 'object') return 0;
    const explicit = Number(bucket.totalTokens);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    return (
      Math.max(0, Number(bucket.inputUncachedTokens) || 0) +
      Math.max(0, Number(bucket.cacheReadTokens) || 0) +
      Math.max(0, Number(bucket.outputTokens) || 0)
    );
  }

  function buildFallbackScope(current, scope, isChildView) {
    const todayDate = current?.receipt?.todayDate || formatLocalYmd(Date.now());
    const mainOnly = current?.totals?.mainOnly || {};
    const withChildren = current?.totals?.withChildren || mainOnly;

    const mainTok = sumBucketTokens(mainOnly);
    const mainCost = Math.max(0, Number(mainOnly.costActual) || 0);
    const mainSteps = Math.max(0, Number(mainOnly.stepsCount) || 0);

    const rawChildren = isChildView || !Array.isArray(current?.children) ? [] : current.children;
    const mappedChildren = rawChildren
      .map((ch) => {
        const totalTokens = sumBucketTokens(ch);
        const costActual = Math.max(0, Number(ch?.costActual) || 0);
        const stepsCount = Math.max(0, Number(ch?.stepsCount) || 0);
        return {
          conversationId: ch?.conversationId || '',
          kind: ch?.kind || 'subagent',
          name: ch?.name || '',
          role: ch?.role || '',
          totalTokens,
          costActual,
          stepsCount,
        };
      })
      .filter((ch) => ch.totalTokens > 0 || ch.costActual > 0 || ch.stepsCount > 0)
      .sort(
        (a, b) =>
          b.costActual - a.costActual ||
          b.totalTokens - a.totalTokens ||
          String(a.name || '').localeCompare(String(b.name || '')),
      );

    const sumChildTok = mappedChildren.reduce((acc, c) => acc + c.totalTokens, 0);
    const sumChildCost = mappedChildren.reduce((acc, c) => acc + c.costActual, 0);

    const grandTok = isChildView
      ? mainTok
      : Math.max(mainTok + sumChildTok, sumBucketTokens(withChildren));
    const grandCost = isChildView
      ? mainCost
      : Math.max(
          0,
          Number.isFinite(Number(withChildren.costActual))
            ? Number(withChildren.costActual)
            : mainCost + sumChildCost,
        );
    const subTok = isChildView ? 0 : Math.max(sumChildTok, Math.max(0, grandTok - mainTok));
    const subCost = isChildView ? 0 : Math.max(sumChildCost, Math.max(0, grandCost - mainCost));

    const modelList = isChildView
      ? current?.totals?.mainOnlyByModel || current?.totals?.byModel
      : current?.totals?.byModel;
    const topModel = Array.isArray(modelList) && modelList.length > 0 ? modelList[0] : null;

    return {
      scope,
      hasData: mainSteps > 0 || grandTok > 0 || grandCost > 0,
      startDate: todayDate,
      endDate: todayDate,
      startedAtMs: null,
      endedAtMs: null,
      activeDurationMs: 0,
      compactionsCount: Math.max(0, Number(current?.context?.compactionsCount) || 0),
      primaryModel: topModel
        ? {
            model: topModel.model || current?.activeModel || '',
            profileId: topModel.profileId || '',
            profileLabel: topModel.profileLabel || topModel.label || '',
          }
        : {
            model: current?.activeModel || '',
            profileId: '',
            profileLabel: '',
          },
      subagentsCount: isChildView ? 0 : rawChildren.length,
      main: {
        totalTokens: mainTok,
        costActual: mainCost,
        stepsCount: mainSteps,
      },
      children: mappedChildren,
      childrenSubtotal: {
        totalTokens: subTok,
        costActual: subCost,
      },
      grandTotal: {
        totalTokens: grandTok,
        costActual: grandCost,
        stepsCount: Math.max(mainSteps, Number(withChildren.stepsCount) || 0),
      },
    };
  }

  function formatChildMemberLabel(baseNameRaw, lang) {
    const fallback = lang === 'en' ? 'Worker' : '成员';
    const raw = String(baseNameRaw || '').trim() || fallback;
    if (lang === 'en') {
      if (/^子代理[\s·:：-]*/.test(raw)) {
        const stripped = raw.replace(/^子代理[\s·:：-]*/, '').trim() || fallback;
        return `Sub·${stripped}`;
      }
      if (/^(?:subagent|sub)(?:[\s·:：-]+|$)/i.test(raw)) {
        return raw;
      }
      return `Sub·${raw}`;
    }
    if (/^子代理/.test(raw)) {
      return raw;
    }
    if (/^(?:subagent|sub)[\s·:：-]+/i.test(raw)) {
      const stripped = raw.replace(/^(?:subagent|sub)[\s·:：-]+/i, '').trim() || fallback;
      return `子代理·${stripped}`;
    }
    return `子代理·${raw}`;
  }

  function truncateDisplayUnits(str, maxAsciiUnits = 24) {
    const clean = String(str || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const chars = Array.from(clean);
    let totalUnits = 0;
    for (const ch of chars) {
      totalUnits += ch.codePointAt(0) > 0xff ? 1.5 : 1;
    }
    if (totalUnits <= maxAsciiUnits) return clean;
    const targetUnits = Math.max(3, maxAsciiUnits - 1.5);
    let used = 0;
    let out = '';
    for (const ch of chars) {
      const w = ch.codePointAt(0) > 0xff ? 1.5 : 1;
      if (used + w > targetUnits) break;
      out += ch;
      used += w;
    }
    return `${out.trimEnd()}…`;
  }

  function extractShortChildName(current, sessionTitle, lang) {
    const rawCandidate = String(
      current?.agentName ||
      String(current?.title || sessionTitle || '').split('·')[0] ||
      (current?.conversationId ? String(current.conversationId).slice(0, 6) : ''),
    )
      .replace(/^(?:子代理[\s·:：-]*|(?:subagent|sub)[\s·:：-]+)/i, '')
      .trim();
    const cleaned = truncateDisplayUnits(rawCandidate, 16);
    return cleaned || (lang === 'en' ? 'Worker' : '成员');
  }

  function extractMmdd(endDateStr, fallbackYmd) {
    const src = String(endDateStr || fallbackYmd || '');
    const m = src.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (m) return `${m[1]}${m[2]}`;
    const fb = String(fallbackYmd || formatLocalYmd(Date.now())).match(/^\d{4}-(\d{2})-(\d{2})$/);
    return fb ? `${fb[1]}${fb[2]}` : '0101';
  }

  function buildReceiptViewModel(current, prefs, options = {}) {
    const lang = options?.lang === 'en' ? 'en' : 'zh';
    const scope = options?.scope === 'all' ? 'all' : 'today';
    const detailMode = options?.detailMode === 'full' ? 'full' : 'compact';
    const sessionTitle = typeof options?.sessionTitle === 'string' ? options.sessionTitle : '';
    const isChildView =
      options?.isChildView !== undefined
        ? Boolean(options.isChildView)
        : Boolean(current?.isChildSession);
    const currency = prefs?.currency === 'CNY' ? 'CNY' : 'USD';

    const fallbackYmd = current?.receipt?.todayDate || formatLocalYmd(Date.now());
    const rawScopeObj = scope === 'today' ? current?.receipt?.today : current?.receipt?.all;
    const scopeObj = rawScopeObj || buildFallbackScope(current, scope, isChildView);

    const hasData = Boolean(scopeObj?.hasData);
    const endDate = scopeObj?.endDate || scopeObj?.startDate || fallbackYmd;
    const startDate = scopeObj?.startDate || endDate;
    const dateStr = formatReceiptDateRange(startDate, endDate, fallbackYmd);
    const timeRangeStr = formatReceiptTimeRange(scopeObj?.startedAtMs, scopeObj?.endedAtMs);
    const modelLabel = formatReceiptModelLabel(scopeObj, current, lang);

    const activeDurationMs = Math.max(0, Number(scopeObj?.activeDurationMs) || 0);
    let durationMins = 0;
    let durationStr = lang === 'en' ? '0 min' : '0 分钟';
    if (hasData || activeDurationMs > 0) {
      durationMins = Math.max(1, Math.round(activeDurationMs / 60000));
      if (durationMins < 60) {
        durationStr = lang === 'en' ? `${durationMins} min` : `${durationMins} 分钟`;
      } else {
        const h = Math.floor(durationMins / 60);
        const m = durationMins % 60;
        if (lang === 'en') {
          durationStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
        } else {
          durationStr = m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
        }
      }
    }

    const subagentsCount = isChildView
      ? 0
      : Math.max(0, Math.round(Number(scopeObj?.subagentsCount) || 0));
    const subagentsVal = lang === 'en' ? String(subagentsCount) : `${subagentsCount} 位`;

    const compactionsCount = Math.max(
      0,
      Math.round(Number(scopeObj?.compactionsCount ?? current?.context?.compactionsCount) || 0),
    );
    const compactionsVal = lang === 'en' ? String(compactionsCount) : `${compactionsCount} 次`;

    const metaRows = [
      { key: 'date', label: lang === 'en' ? 'Date' : '日期', value: dateStr },
      { key: 'timeRange', label: lang === 'en' ? 'Time' : '时段', value: timeRangeStr },
      { key: 'primaryModel', label: lang === 'en' ? 'Primary Model' : '主力模型', value: modelLabel },
      { key: 'duration', label: lang === 'en' ? 'Duration' : '会话时长', value: durationStr },
      { key: 'subagents', label: lang === 'en' ? 'Subagents' : '子代理', value: subagentsVal },
      { key: 'compactions', label: lang === 'en' ? 'Compactions' : '上下文压缩', value: compactionsVal },
    ];

    const mainRawTokens = Math.max(0, Number(scopeObj?.main?.totalTokens) || 0);
    const mainRawCost = Math.max(0, Number(scopeObj?.main?.costActual) || 0);
    const mainLabel = isChildView
      ? formatChildMemberLabel(extractShortChildName(current, sessionTitle, lang), lang)
      : lang === 'en'
        ? 'Main Agent'
        : '主代理';

    const items = [
      {
        kind: 'main',
        label: mainLabel,
        rawTokens: mainRawTokens,
        rawCost: mainRawCost,
        tokensText: fmtReceiptTokens(mainRawTokens),
        costText: fmtReceiptCost(mainRawCost, currency),
      },
    ];

    const childList = !isChildView && Array.isArray(scopeObj?.children) ? scopeObj.children : [];
    if (childList.length > 0) {
      if (detailMode === 'compact' && childList.length > 6) {
        const topFive = childList.slice(0, 5);
        for (const ch of topFive) {
          const baseName = String(
            ch?.name || ch?.role || (ch?.conversationId ? String(ch.conversationId).slice(0, 6) : '') || '',
          ).trim();
          const rawTokens = Math.max(0, Number(ch?.totalTokens) || 0);
          const rawCost = Math.max(0, Number(ch?.costActual) || 0);
          items.push({
            kind: 'child',
            label: formatChildMemberLabel(baseName, lang),
            rawTokens,
            rawCost,
            tokensText: fmtReceiptTokens(rawTokens),
            costText: fmtReceiptCost(rawCost, currency),
          });
        }
        const rest = childList.slice(5);
        const restCount = rest.length;
        const restTokens = rest.reduce((acc, ch) => acc + Math.max(0, Number(ch?.totalTokens) || 0), 0);
        const restCost = rest.reduce((acc, ch) => acc + Math.max(0, Number(ch?.costActual) || 0), 0);
        items.push({
          kind: 'others',
          label: lang === 'en' ? `+${restCount} Others` : `其余 ${restCount} 位子代理`,
          rawTokens: restTokens,
          rawCost: restCost,
          tokensText: fmtReceiptTokens(restTokens),
          costText: fmtReceiptCost(restCost, currency),
        });
      } else {
        for (const ch of childList) {
          const baseName = String(
            ch?.name || ch?.role || (ch?.conversationId ? String(ch.conversationId).slice(0, 6) : '') || '',
          ).trim();
          const rawTokens = Math.max(0, Number(ch?.totalTokens) || 0);
          const rawCost = Math.max(0, Number(ch?.costActual) || 0);
          items.push({
            kind: 'child',
            label: formatChildMemberLabel(baseName, lang),
            rawTokens,
            rawCost,
            tokensText: fmtReceiptTokens(rawTokens),
            costText: fmtReceiptCost(rawCost, currency),
          });
        }
      }
    }

    let subtotalRow = null;
    let subTok = 0;
    let subCost = 0;
    if (!isChildView && childList.length > 0) {
      subTok = Math.max(
        0,
        Number(
          scopeObj?.childrenSubtotal?.totalTokens ??
            childList.reduce((acc, ch) => acc + Math.max(0, Number(ch?.totalTokens) || 0), 0),
        ) || 0,
      );
      subCost = Math.max(
        0,
        Number(
          scopeObj?.childrenSubtotal?.costActual ??
            childList.reduce((acc, ch) => acc + Math.max(0, Number(ch?.costActual) || 0), 0),
        ) || 0,
      );
      subtotalRow = {
        label: lang === 'en' ? 'Subagents Subtotal' : '子代理小计',
        tokensText: fmtReceiptTokens(subTok),
        costText: fmtReceiptCost(subCost, currency),
        rawTokens: subTok,
        rawCost: subCost,
      };
    }

    const grandTok = isChildView
      ? mainRawTokens
      : Math.max(0, Number(scopeObj?.grandTotal?.totalTokens ?? mainRawTokens + subTok) || 0);
    const grandCost = isChildView
      ? mainRawCost
      : Math.max(0, Number(scopeObj?.grandTotal?.costActual ?? mainRawCost + subCost) || 0);

    const totalRow = {
      label: lang === 'en' ? 'Session Total' : '会话合计',
      tokensText: fmtReceiptTokens(grandTok),
      costText: fmtReceiptCost(grandCost, currency),
      rawTokens: grandTok,
      rawCost: grandCost,
    };

    const rawTitleSource = sessionTitle || current?.title || '';
    const shortTitle =
      truncateDisplayUnits(rawTitleSource, 24) ||
      (lang === 'en' ? 'Active Session' : '当前会话');
    const scopePrefix =
      scope === 'today'
        ? lang === 'en'
          ? 'Today · '
          : '今日 · '
        : lang === 'en'
          ? 'All-Time · '
          : '';
    const footerLine1 =
      lang === 'en'
        ? `Currency ${currency} · ${scopePrefix}${shortTitle}`
        : `金额单位 ${currency} · ${scopePrefix}${shortTitle}`;

    const mmdd = extractMmdd(endDate, fallbackYmd);
    const nnn =
      durationMins > 0 && durationMins <= 999
        ? String(durationMins).padStart(3, '0')
        : String((Number(scopeObj?.grandTotal?.stepsCount) || 1) % 1000).padStart(3, '0');
    const serialCode = `AGY-${mmdd}-${nnn}`;
    const suggestedFilename = `${serialCode}.png`;

    return {
      lang,
      scope,
      detailMode,
      currency,
      hasData,
      isChildView,
      title: lang === 'en' ? 'Session Receipt' : '收工票根',
      subtitle: 'agy-token-monitor',
      tableHeaders: {
        member: lang === 'en' ? 'Member' : '成员',
        tokens: lang === 'en' ? 'Tokens' : 'Token 小计',
        cost: lang === 'en' ? 'API Cost' : 'API 等效金额',
      },
      metaRows,
      items,
      subtotalRow,
      totalRow,
      shortTitle,
      footerLine1,
      serialCode,
      suggestedFilename,
      durationMins,
      subagentsCount,
      compactionsCount,
    };
  }

  function estimateTextWidthFallback(str, fontPx) {
    let w = 0;
    for (const ch of Array.from(String(str || ''))) {
      w += ch.codePointAt(0) > 0xff ? fontPx * 1.02 : fontPx * 0.6;
    }
    return w;
  }

  function measureWidth(ctx, str, fontPx) {
    if (ctx && typeof ctx.measureText === 'function') {
      const m = ctx.measureText(String(str || ''));
      if (m && Number.isFinite(m.width) && m.width >= 0) return m.width;
    }
    return estimateTextWidthFallback(str, fontPx);
  }

  function truncateCanvasText(ctx, text, maxWidth, fontPx) {
    const str = String(text || '');
    if (!str || maxWidth <= 0) return '';
    if (measureWidth(ctx, str, fontPx) <= maxWidth) return str;
    const ellipsis = '…';
    const ellW = measureWidth(ctx, ellipsis, fontPx);
    if (ellW >= maxWidth) return ellipsis;
    const chars = Array.from(str);
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const slice = chars.slice(0, mid).join('');
      if (measureWidth(ctx, slice, fontPx) + ellW <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return `${chars.slice(0, lo).join('').trimEnd()}${ellipsis}`;
  }

  function fitFontDown(ctx, text, weight, startPx, minPx, family, maxWidth) {
    let px = startPx;
    while (px > minPx) {
      ctx.font = `${weight} ${px}px ${family}`;
      if (measureWidth(ctx, text, px) <= maxWidth) {
        return px;
      }
      px = Math.max(minPx, Number((px - 0.5).toFixed(1)));
    }
    ctx.font = `${weight} ${minPx}px ${family}`;
    return minPx;
  }

  function hashSeedFromString(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || 'AGY-RECEIPT');
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h || 123456789;
  }

  function drawPaperTexture(ctx, paperX, paperY, paperW, paperH, seedStr) {
    let seed = hashSeedFromString(seedStr);
    const nextRand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const areaScale = Math.max(0.6, Math.min(2.5, (paperW * paperH) / (352 * 620)));
    const darkDots = Math.round(420 * areaScale);
    const lightDots = Math.round(280 * areaScale);
    const fibers = Math.round(48 * areaScale);

    ctx.fillStyle = 'rgba(20, 22, 26, 0.013)';
    for (let i = 0; i < darkDots; i += 1) {
      const x = paperX + nextRand() * (paperW - 1);
      const y = paperY + nextRand() * (paperH - 1);
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    for (let i = 0; i < lightDots; i += 1) {
      const x = paperX + nextRand() * (paperW - 1);
      const y = paperY + nextRand() * (paperH - 1);
      ctx.fillRect(x, y, 1.1, 1.1);
    }

    ctx.fillStyle = 'rgba(24, 26, 30, 0.009)';
    for (let i = 0; i < fibers; i += 1) {
      const len = 3 + nextRand() * 7;
      const x = paperX + nextRand() * Math.max(1, paperW - len - 1);
      const y = paperY + nextRand() * (paperH - 1);
      ctx.fillRect(x, y, len, 0.75);
    }
  }

  function drawDashedRule(ctx, x1, x2, y) {
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([5, 4.4]);
    }
    ctx.strokeStyle = '#555a64';
    ctx.lineWidth = 1.1;
    const py = Math.round(y) + 0.5;
    ctx.moveTo(x1, py);
    ctx.lineTo(x2, py);
    ctx.stroke();
    ctx.restore();
  }

  function drawSolidRule(ctx, x1, x2, y) {
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#1c1e22';
    ctx.lineWidth = 1.5;
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  function renderReceiptCanvas(viewModel, options = {}) {
    const vm = viewModel || buildReceiptViewModel(null, null);
    const rawScale = Number(options?.scale);
    const scale = Math.max(1, Math.min(4, Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 3));

    const padX = 34;
    const padTop = 30;
    const padBottom = 34;
    const paperW = 352;
    const canvasW = paperW + padX * 2; // 420 logical px

    const inX = 28;
    const inTop = 38;
    const inBottom = 34;

    const metaRows = Array.isArray(vm.metaRows) ? vm.metaRows : [];
    const items = Array.isArray(vm.items) ? vm.items : [];
    const hasSubtotal = Boolean(vm.subtotalRow);

    const headerTitleBlockH = 34;
    const headerSubBlockH = 29;
    const afterTopDashH = 17;
    const metaRowH = 27;
    const beforeSecondDashH = 10;
    const afterSecondDashH = 18;
    const tableHeaderH = 26;
    const afterTableHeaderGap = 5;
    const itemRowH = 27;
    const subtotalPreGap = hasSubtotal ? 10 : 0;
    const subtotalRowH = hasSubtotal ? 28 : 0;
    const beforeSolidRuleGap = 10;
    const afterSolidRuleGap = 10;
    const totalRowH = 34;
    const footerPreGap = 28;
    const footerLine1H = 20;
    const serialCodeH = 16;

    const paperH =
      inTop +
      headerTitleBlockH +
      headerSubBlockH +
      afterTopDashH +
      metaRows.length * metaRowH +
      beforeSecondDashH +
      afterSecondDashH +
      tableHeaderH +
      afterTableHeaderGap +
      items.length * itemRowH +
      subtotalPreGap +
      subtotalRowH +
      beforeSolidRuleGap +
      afterSolidRuleGap +
      totalRowH +
      footerPreGap +
      footerLine1H +
      serialCodeH +
      inBottom;

    const canvasH = paperH + padTop + padBottom;
    const physW = Math.round(canvasW * scale);
    const physH = Math.round(canvasH * scale);

    const canvas =
      typeof options?.createCanvas === 'function'
        ? options.createCanvas(physW, physH)
        : root.document.createElement('canvas');

    canvas.width = physW;
    canvas.height = physH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    ctx.save();
    if (typeof ctx.scale === 'function') {
      ctx.scale(scale, scale);
    }

    // 1. Outer studio mat backdrop
    if (typeof ctx.createLinearGradient === 'function') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
      bgGrad.addColorStop(0, '#e9eaec');
      bgGrad.addColorStop(1, '#dfe1e4');
      ctx.fillStyle = bgGrad;
    } else {
      ctx.fillStyle = '#e5e6e9';
    }
    ctx.fillRect(0, 0, canvasW, canvasH);

    const paperX = padX;
    const paperY = padTop;
    const contentW = paperW - inX * 2; // 296
    const xLeft = paperX + inX;
    const xMidRight = paperX + inX + 192;
    const xRight = paperX + paperW - inX;
    const xCenter = paperX + paperW / 2;

    // 2. Multi-pass soft elevation shadow + sharp-cornered thermal paper slip
    ctx.save();
    ctx.shadowColor = 'rgba(15, 18, 24, 0.11)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(paperX, paperY, paperW, paperH);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(15, 18, 24, 0.05)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(paperX, paperY, paperW, paperH);
    ctx.restore();

    // Subtle paper surface sheen + procedural fiber texture + crisp hairline edge
    if (typeof ctx.createLinearGradient === 'function') {
      const paperGrad = ctx.createLinearGradient(0, paperY, 0, paperY + paperH);
      paperGrad.addColorStop(0, '#fbfbfa');
      paperGrad.addColorStop(0.5, '#fafaf9');
      paperGrad.addColorStop(1, '#f7f7f5');
      ctx.fillStyle = paperGrad;
      ctx.fillRect(paperX, paperY, paperW, paperH);
    }
    drawPaperTexture(ctx, paperX, paperY, paperW, paperH, vm.serialCode || 'AGY');

    ctx.save();
    ctx.strokeStyle = 'rgba(15, 18, 24, 0.045)';
    ctx.lineWidth = 0.75;
    ctx.strokeRect(paperX + 0.375, paperY + 0.375, paperW - 0.75, paperH - 0.75);
    ctx.restore();

    ctx.textBaseline = 'alphabetic';
    let curY = paperY + inTop;

    // 3. Header Title & Subtitle
    ctx.save();
    ctx.fillStyle = '#141619';
    ctx.textAlign = 'center';
    const titleFontPx = vm.lang === 'en' ? 23 : 26;
    ctx.font = `700 ${titleFontPx}px ${SANS_FONT_FAMILY}`;
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = vm.lang === 'zh' ? '1.5px' : '0.3px';
    }
    ctx.fillText(vm.title || '收工票根', xCenter, curY + 24);
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = '0px';
    }
    ctx.restore();
    curY += headerTitleBlockH;

    ctx.save();
    ctx.fillStyle = '#2b2f36';
    ctx.textAlign = 'center';
    ctx.font = `500 14px ${MONO_FONT_FAMILY}`;
    ctx.fillText(vm.subtitle || 'agy-token-monitor', xCenter, curY + 13);
    ctx.restore();
    curY += headerSubBlockH;

    // 4. First dashed divider
    drawDashedRule(ctx, xLeft, xRight, curY);
    curY += afterTopDashH;

    // 5. 6 Metadata Rows
    for (const row of metaRows) {
      const rowBaseline = curY + 18;
      ctx.fillStyle = '#1e2024';
      ctx.textAlign = 'left';
      ctx.font = `500 13.5px ${SANS_FONT_FAMILY}`;
      const labelText = String(row.label || '');
      ctx.fillText(labelText, xLeft, rowBaseline);
      const labelW = measureWidth(ctx, labelText, 13.5);

      const maxValW = Math.max(96, contentW - labelW - 14);
      const valStr = String(row.value ?? '');
      const valPx = fitFontDown(ctx, valStr, 500, 13.5, 11.5, MIXED_VALUE_FONT_FAMILY, maxValW);
      const fittedVal = truncateCanvasText(ctx, valStr, maxValW, valPx);
      ctx.fillStyle = '#181a1e';
      ctx.textAlign = 'right';
      ctx.fillText(fittedVal, xRight, rowBaseline);

      curY += metaRowH;
    }

    // 6. Second dashed divider
    curY += beforeSecondDashH;
    drawDashedRule(ctx, xLeft, xRight, curY);
    curY += afterSecondDashH;

    // 7. Table Header
    {
      const hdrBaseline = curY + 16;
      const hdrs = vm.tableHeaders || {
        member: '成员',
        tokens: 'Token 小计',
        cost: 'API 等效金额',
      };
      ctx.fillStyle = '#1e2024';
      ctx.font = `600 13px ${SANS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(hdrs.member, xLeft, hdrBaseline);

      ctx.textAlign = 'right';
      fitFontDown(ctx, hdrs.tokens, 600, 13, 11.5, SANS_FONT_FAMILY, 86);
      ctx.fillText(hdrs.tokens, xMidRight, hdrBaseline);

      fitFontDown(ctx, hdrs.cost, 600, 13, 11.5, SANS_FONT_FAMILY, 94);
      ctx.fillText(hdrs.cost, xRight, hdrBaseline);

      curY += tableHeaderH + afterTableHeaderGap;
    }

    // Helper for 3-column data/summary rows
    const drawThreeColRow = ({
      label,
      tokensText,
      costText,
      baselineY,
      weight = 500,
      basePx = 13.5,
      color = '#1e2024',
      stepDownLabel = false,
    }) => {
      // Right column: API Cost (max 88px)
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      const costPx = fitFontDown(ctx, costText, weight, basePx, 11.5, MONO_FONT_FAMILY, 88);
      const safeCost = truncateCanvasText(ctx, costText, 92, costPx);
      ctx.fillText(safeCost, xRight, baselineY);

      // Middle column: Tokens (max 82px)
      const tokPx = fitFontDown(ctx, tokensText, weight, basePx, 11.5, MONO_FONT_FAMILY, 82);
      const safeTok = truncateCanvasText(ctx, tokensText, 84, tokPx);
      const tokRenderedW = measureWidth(ctx, safeTok, tokPx);
      ctx.fillText(safeTok, xMidRight, baselineY);

      // Left column: Member / Subtotal / Total label — never overlaps middle column
      const maxLeftW = Math.max(82, xMidRight - xLeft - tokRenderedW - 10);
      ctx.textAlign = 'left';
      let lblPx = basePx;
      if (stepDownLabel) {
        lblPx = fitFontDown(ctx, label, weight, basePx, 12, SANS_FONT_FAMILY, maxLeftW);
      } else {
        ctx.font = `${weight} ${basePx}px ${SANS_FONT_FAMILY}`;
      }
      const safeLabel = truncateCanvasText(ctx, label, maxLeftW, lblPx);
      ctx.fillText(safeLabel, xLeft, baselineY);
    };

    // 8. Line Item Rows
    for (const item of items) {
      const isOthers = item.kind === 'others';
      drawThreeColRow({
        label: item.label,
        tokensText: item.tokensText,
        costText: item.costText,
        baselineY: curY + 18,
        weight: 500,
        basePx: 13.5,
        color: isOthers ? '#4a4f58' : '#1e2024',
        stepDownLabel: false,
      });
      curY += itemRowH;
    }

    // 9. Optional Subagents Subtotal Row
    if (vm.subtotalRow) {
      curY += subtotalPreGap;
      drawThreeColRow({
        label: vm.subtotalRow.label,
        tokensText: vm.subtotalRow.tokensText,
        costText: vm.subtotalRow.costText,
        baselineY: curY + 18,
        weight: 500,
        basePx: 13.5,
        color: '#1e2024',
        stepDownLabel: true,
      });
      curY += subtotalRowH;
    }

    // 10. Solid Divider + Session Total Row
    curY += beforeSolidRuleGap;
    drawSolidRule(ctx, xLeft, xRight, curY);
    curY += afterSolidRuleGap;

    if (vm.totalRow) {
      drawThreeColRow({
        label: vm.totalRow.label,
        tokensText: vm.totalRow.tokensText,
        costText: vm.totalRow.costText,
        baselineY: curY + 21,
        weight: 700,
        basePx: 16.5,
        color: '#111317',
        stepDownLabel: true,
      });
    }
    curY += totalRowH;

    // 11. Footer Metadata & Serial Code
    curY += footerPreGap;
    {
      const f1 = String(vm.footerLine1 || '');
      ctx.fillStyle = '#2d3138';
      ctx.textAlign = 'center';
      const f1Px = fitFontDown(ctx, f1, 500, 12, 10.5, SANS_FONT_FAMILY, contentW);
      const safeF1 = truncateCanvasText(ctx, f1, contentW, f1Px);
      ctx.fillText(safeF1, xCenter, curY + 12);
      curY += footerLine1H;
    }

    {
      ctx.save();
      ctx.fillStyle = '#2d3138';
      ctx.textAlign = 'center';
      ctx.font = `500 12.5px ${MONO_FONT_FAMILY}`;
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = '0.5px';
      }
      ctx.fillText(String(vm.serialCode || ''), xCenter, curY + 12);
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = '0px';
      }
      ctx.restore();
    }

    ctx.restore();
    return canvas;
  }

  function dataUrlToPngBlob(dataUrl) {
    const str = String(dataUrl || '');
    const commaIdx = str.indexOf(',');
    if (commaIdx < 0) {
      throw new Error('Malformed canvas data URL');
    }
    const meta = str.slice(0, commaIdx);
    const body = str.slice(commaIdx + 1);
    const mimeMatch = meta.match(/^data:([^;,]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    if (/;base64/i.test(meta)) {
      let binary = '';
      if (typeof root.atob === 'function') {
        binary = root.atob(body);
      } else if (typeof Buffer === 'function') {
        const buf = Buffer.from(body, 'base64');
        return new Blob([buf], { type: mime });
      }
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (!canvas || (typeof canvas.toBlob !== 'function' && typeof canvas.toDataURL !== 'function')) {
        reject(new Error('Invalid canvas element'));
        return;
      }

      const fallbackViaDataUrl = () => {
        try {
          if (typeof canvas.toDataURL !== 'function') {
            reject(new Error('Canvas PNG export returned empty blob'));
            return;
          }
          const blob = dataUrlToPngBlob(canvas.toDataURL('image/png'));
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      };

      if (typeof canvas.toBlob === 'function') {
        try {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              fallbackViaDataUrl();
            }
          }, 'image/png');
        } catch {
          fallbackViaDataUrl();
        }
        return;
      }

      fallbackViaDataUrl();
    });
  }

  root.TokenMonitorReceipt = {
    fmtReceiptTokens,
    fmtReceiptCost,
    buildReceiptViewModel,
    renderReceiptCanvas,
    canvasToBlob,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
// ============================================================================
// [MODIFIED END] 2026-11-18 11:39:00
// ============================================================================
