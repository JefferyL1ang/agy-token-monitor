// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:40:00
// Description: Implement dual-channel official model & pricing sync manager
// (Channel 1: models.dev with litellm fallback; Channel 2: Google Gemini API
// official pricing page with effective-date awareness), non-chat filtering,
// new model auto-discovery, local observed slug promotion, and atomic cache.
// ============================================================================

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Import compareModelsByPerformance for performance-tier catalog sorting.
// ============================================================================
import { MODEL_PRICING_CATALOG, compareModelsByPerformance, formatLocalDate } from './parser.mjs';
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================

const DEFAULT_GOOGLE_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const DEFAULT_MODELS_DEV_URL = 'https://models.dev/api.json';
const DEFAULT_LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:43:00
// Description: Add dual-source public USD-to-CNY FX endpoints (ECB Frankfurter
// primary + Open ER API fallback) for daily exchange rate synchronization.
// ============================================================================
const DEFAULT_FX_PRIMARY_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY';
const DEFAULT_FX_FALLBACK_URL = 'https://open.er-api.com/v6/latest/USD';
// ============================================================================
// [MODIFIED END] 2026-11-17 15:43:00
// ============================================================================

const FETCH_TIMEOUT_MS = 4500;
const RETRY_COOLDOWN_MS = 15 * 60 * 1000;
const CACHE_SCHEMA_VERSION = 1;

const NON_CHAT_MODEL_RE =
  /embed|tts|speech|audio|imagen|image|veo|video|live|realtime|robotics|learnlm|gemma|moderation|transcribe|whisper|computer-use|aqa|bison|gecko|gemini-1\.[05]|2\.0-flash-lite/i;

const NEW_GEMINI_DISCOVERY_RE = /^(?:models\/)?gemini-(?:3\.[2-9]|[4-9](?:\.\d+)?)-/i;

const MONTH_INDEX_MAP = Object.freeze({
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
});

const MONTH_PATTERN =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const STARTING_DATE_RE = new RegExp(`\\bstarting\\s+(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i');
const THROUGH_DATE_RE = new RegExp(
  `\\b(?:through|until|before|thru)\\s+(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
  'i',
);

const UPPER_TOKENS = new Map([
  ['gpt', 'GPT'],
  ['oss', 'OSS'],
  ['agy', 'AGY'],
  ['api', 'API'],
]);

function roundPrice(val) {
  const n = Number(val);
  return Number.isFinite(n) ? Number(n.toFixed(6)) : NaN;
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileModelPattern(patternStr, fallbackId = '') {
  if (typeof patternStr === 'string' && patternStr) {
    try {
      return new RegExp(patternStr, 'i');
    } catch {
      // Fallback to literal ID matcher below.
    }
  }
  if (fallbackId) {
    const escaped = escapeRegex(fallbackId).replace(/-/g, '[\\s_-]*');
    return new RegExp(`^${escaped}$`, 'i');
  }
  return null;
}

function formatModelDisplayName(slug) {
  const cleaned = String(slug || '').trim();
  if (!cleaned) return 'Unknown Model';
  return cleaned
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (UPPER_TOKENS.has(lower)) return UPPER_TOKENS.get(lower);
      if (/^\d+[a-z]$/i.test(part)) return part.toUpperCase();
      if (/^\d/.test(part)) return part;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Add normalizeModelGroupName helper and update inferModelGroup
// from 其他在役模型 to 其他现役模型.
// ============================================================================
function normalizeModelGroupName(group) {
  return group === '其他在役模型' ? '其他现役模型' : group;
}

function inferModelGroup(slug) {
  const s = String(slug || '').toLowerCase();
  if (s.startsWith('gemini')) return 'Gemini 系列';
  if (s.startsWith('claude')) return 'Claude 系列';
  return '其他现役模型';
}
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================

function cleanUpstreamSlug(rawId) {
  return String(rawId || '')
    .trim()
    .replace(/^(?:openrouter|groq|together_ai|togetherai|fireworks_ai|deepinfra|bedrock|azure|vertex_ai|google-vertex|google|anthropic|openai|gemini|models)\//i, '')
    .replace(/^(?:google|anthropic|openai|models)\//i, '')
    .replace(/@.+$/, '')
    .trim()
    .toLowerCase();
}

function validateAndNormalizeRates({
  inputPer1M,
  cachedPer1M,
  outputPer1M,
  longInputPer1M,
  longOutputPer1M,
  longContextTier,
  longInputMultiplier,
  longOutputMultiplier,
  isGemini = false,
  modelId = '',
}) {
  const inp = roundPrice(inputPer1M);
  const out = roundPrice(outputPer1M);
  if (!Number.isFinite(inp) || inp <= 0 || inp > 500) return null;
  if (!Number.isFinite(out) || out <= 0 || out > 2000) return null;

  let cached;
  if (cachedPer1M === undefined || cachedPer1M === null || cachedPer1M === '') {
    cached = isGemini ? Number((inp * 0.1).toFixed(4)) : inp;
  } else {
    cached = roundPrice(cachedPer1M);
  }
  if (!Number.isFinite(cached) || cached < 0 || cached > inp) return null;

  const hasLongInput = Number.isFinite(Number(longInputPer1M)) && Number(longInputPer1M) > inp;
  const hasLongOutput = Number.isFinite(Number(longOutputPer1M)) && Number(longOutputPer1M) > out;

  let tier = Boolean(longContextTier || hasLongInput || hasLongOutput);
  if (!tier && isGemini && !/flash|lite/i.test(modelId)) {
    tier = true;
  }

  let inMult =
    Number.isFinite(Number(longInputMultiplier)) && Number(longInputMultiplier) > 0
      ? Number(longInputMultiplier)
      : null;
  let outMult =
    Number.isFinite(Number(longOutputMultiplier)) && Number(longOutputMultiplier) > 0
      ? Number(longOutputMultiplier)
      : null;

  if (hasLongInput) {
    inMult = Number((Number(longInputPer1M) / inp).toFixed(4));
  }
  if (hasLongOutput) {
    outMult = Number((Number(longOutputPer1M) / out).toFixed(4));
  }

  if (tier) {
    inMult = inMult || 2.0;
    outMult = outMult || 1.5;
  } else {
    inMult = inMult || 1.0;
    outMult = outMult || 1.0;
  }

  return {
    inputPer1M: inp,
    cachedPer1M: cached,
    outputPer1M: out,
    longContextTier: tier,
    longInputMultiplier: inMult,
    longOutputMultiplier: outMult,
  };
}

/**
 * Excludes non-chat, multimodal non-text, audio/video/image-gen, embedding,
 * and legacy models so only active chat/coding candidates enter the catalog.
 */
export function isChatModelCandidate(modelId, meta = null) {
  if (typeof modelId !== 'string') return false;
  const s = modelId.trim();
  if (!s) return false;
  if (NON_CHAT_MODEL_RE.test(s)) return false;

  if (meta && typeof meta === 'object') {
    if (typeof meta.id === 'string' && NON_CHAT_MODEL_RE.test(meta.id)) {
      return false;
    }
    if (
      typeof meta.mode === 'string' &&
      meta.mode.trim() &&
      !/^(?:chat|responses|completion)$/i.test(meta.mode.trim())
    ) {
      return false;
    }
    const outModalities = meta?.modalities?.output;
    if (Array.isArray(outModalities) && !outModalities.includes('text')) {
      return false;
    }
  }
  return true;
}

function mapBaseProfileMatches(upstreamPool, gptOssBest) {
  const profileRates = {};
  const assignIfPresent = (profileId, slugCandidates) => {
    for (const slug of slugCandidates) {
      if (upstreamPool[slug]) {
        profileRates[profileId] = { ...upstreamPool[slug] };
        return;
      }
    }
  };

  assignIfPresent('gemini-4-argon', ['gemini-4-argon']);
  assignIfPresent('gemini-3.1-pro', [
    'gemini-3.1-pro',
    'gemini-3.1-pro-preview',
    'gemini-3.1-pro-preview-customtools',
  ]);
  assignIfPresent('gemini-4-carbon', ['gemini-4-carbon']);
  assignIfPresent('gemini-4-hydrogen', ['gemini-4-hydrogen']);
  assignIfPresent('gemini-3-8-flash', ['gemini-3.8-flash', 'gemini-3-8-flash']);
  assignIfPresent('claude-opus-5-5', ['claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-6']);
  assignIfPresent('claude-sonnet-5-5', ['claude-sonnet-5-5', 'claude-sonnet-5', 'claude-sonnet-4-6']);

  if (gptOssBest) {
    profileRates['gpt-oss-120b'] = { ...gptOssBest };
  } else {
    assignIfPresent('gpt-oss-120b', ['gpt-oss-120b']);
  }

  return profileRates;
}

/**
 * Parses `models.dev/api.json` across Google, Anthropic, OpenAI, and open-weight
 * providers into normalized built-in profile rates, upstreamPool, and Gemini candidates.
 */
export function parseModelsDevCatalog(json) {
  const upstreamPool = {};
  const googleCandidateMap = new Map();
  if (!json || typeof json !== 'object') {
    return { profileRates: {}, upstreamPool, googleCandidates: [] };
  }

  const orderedProviders = [
    'google',
    'google-vertex',
    'anthropic',
    'google-vertex-anthropic',
    'openai',
    'openrouter',
    'groq',
    'togetherai',
    'fireworks-ai',
    'deepinfra',
    'cerebras',
  ];
  const providerList = [...orderedProviders];
  for (const key of Object.keys(json)) {
    if (!providerList.includes(key)) providerList.push(key);
  }

  let gptOssBest = null;
  let gptOssScore = -1;

  for (const provId of providerList) {
    const prov = json[provId];
    const models = prov?.models && typeof prov.models === 'object' ? prov.models : null;
    if (!models) continue;

    const isGoogleProv = provId === 'google' || provId === 'google-vertex';
    const isAnthropicProv = provId === 'anthropic' || provId === 'google-vertex-anthropic';
    const isOpenAiProv = provId === 'openai';

    for (const [rawKey, meta] of Object.entries(models)) {
      if (!meta || typeof meta !== 'object') continue;
      const slug = cleanUpstreamSlug(meta.id || rawKey);
      if (!slug) continue;

      const isGptOss = /^gpt-oss/i.test(slug);
      if (!isGoogleProv && !isAnthropicProv && !isOpenAiProv && !isGptOss) {
        continue;
      }
      if (!isChatModelCandidate(slug, meta)) continue;

      const cost = meta.cost && typeof meta.cost === 'object' ? meta.cost : null;
      if (!cost) continue;

      const over200 =
        cost.context_over_200k ||
        (Array.isArray(cost.tiers)
          ? cost.tiers.find((t) => t?.tier?.type === 'context' && Number(t?.tier?.size) >= 150000)
          : null);

      const isGemini = slug.startsWith('gemini');
      const normalized = validateAndNormalizeRates({
        inputPer1M: cost.input,
        cachedPer1M: cost.cache_read,
        outputPer1M: cost.output,
        longInputPer1M: over200?.input,
        longOutputPer1M: over200?.output,
        longContextTier: Boolean(over200),
        isGemini,
        modelId: slug,
      });
      if (!normalized) continue;

      const entry = {
        id: slug,
        label:
          typeof meta.name === 'string' && meta.name.trim()
            ? meta.name.trim()
            : formatModelDisplayName(slug),
        group: inferModelGroup(slug),
        ...normalized,
        provider: provId,
        source: 'models.dev',
      };

      if (!upstreamPool[slug]) {
        upstreamPool[slug] = entry;
      }

      if (isGoogleProv && /^gemini-/i.test(slug) && !googleCandidateMap.has(slug)) {
        googleCandidateMap.set(slug, entry);
      }

      if (slug === 'gpt-oss-120b') {
        const hasCache = cost.cache_read !== undefined && cost.cache_read !== null;
        let score = hasCache ? 10 : 1;
        if (provId === 'openai') score += 100;
        else if (provId === 'openrouter' || provId === 'groq') score += 50;
        else if (provId === 'togetherai') score += 30;
        else if (provId === 'google-vertex') score += 10;
        if (score > gptOssScore) {
          gptOssScore = score;
          gptOssBest = entry;
          upstreamPool[slug] = entry;
        }
      }
    }
  }

  const profileRates = mapBaseProfileMatches(upstreamPool, gptOssBest);
  return {
    profileRates,
    upstreamPool,
    googleCandidates: [...googleCandidateMap.values()],
  };
}

/**
 * Parses LiteLLM `model_prices_and_context_window.json` fallback catalog
 * (multiplying per-token USD rates by 1e6 into USD/1M).
 */
export function parseLiteLlmCatalog(json) {
  const upstreamPool = {};
  const googleCandidateMap = new Map();
  if (!json || typeof json !== 'object') {
    return { profileRates: {}, upstreamPool, googleCandidates: [] };
  }

  const entryPriority = new Map();
  let gptOssBest = null;
  let gptOssScore = -1;

  for (const [rawKey, meta] of Object.entries(json)) {
    if (rawKey === 'sample_spec' || !meta || typeof meta !== 'object') continue;
    const slug = cleanUpstreamSlug(rawKey);
    if (!slug) continue;

    const prov = String(meta.litellm_provider || '').toLowerCase();
    const isGoogle =
      slug.startsWith('gemini-') ||
      /^(?:gemini|vertex_ai)\//i.test(rawKey) ||
      /google|gemini|vertex/i.test(prov);
    const isAnthropic =
      slug.startsWith('claude-') ||
      /^anthropic\//i.test(rawKey) ||
      /anthropic/i.test(prov);
    const isOpenAiOrOss =
      slug.startsWith('gpt-') ||
      /^o[134](?:-|$)/i.test(slug) ||
      /^openai\//i.test(rawKey) ||
      /openai/i.test(prov);

    if (!isGoogle && !isAnthropic && !isOpenAiOrOss) continue;
    if (!isChatModelCandidate(slug, meta)) continue;

    const rawIn = Number(meta.input_cost_per_token);
    const rawOut = Number(meta.output_cost_per_token);
    if (!Number.isFinite(rawIn) || !Number.isFinite(rawOut)) continue;

    const isGemini = slug.startsWith('gemini');
    const rawCache =
      meta.cache_read_input_cost_per_token !== undefined &&
      meta.cache_read_input_cost_per_token !== null
        ? Number(meta.cache_read_input_cost_per_token) * 1e6
        : undefined;
    const longIn =
      meta.input_cost_per_token_above_200k_tokens !== undefined &&
      meta.input_cost_per_token_above_200k_tokens !== null
        ? Number(meta.input_cost_per_token_above_200k_tokens) * 1e6
        : undefined;
    const longOut =
      meta.output_cost_per_token_above_200k_tokens !== undefined &&
      meta.output_cost_per_token_above_200k_tokens !== null
        ? Number(meta.output_cost_per_token_above_200k_tokens) * 1e6
        : undefined;

    const normalized = validateAndNormalizeRates({
      inputPer1M: rawIn * 1e6,
      cachedPer1M: rawCache,
      outputPer1M: rawOut * 1e6,
      longInputPer1M: longIn,
      longOutputPer1M: longOut,
      longContextTier: Number.isFinite(longIn) || Number.isFinite(longOut),
      isGemini,
      modelId: slug,
    });
    if (!normalized) continue;

    let priority = 10;
    if (/^(?:gemini|anthropic|openai)\//i.test(rawKey) || !rawKey.includes('/')) priority = 80;
    else if (/^vertex_ai\//i.test(rawKey)) priority = 50;
    else if (/^(?:openrouter|groq)\//i.test(rawKey)) priority = 40;
    if (rawCache !== undefined) priority += 5;

    const entry = {
      id: slug,
      label: formatModelDisplayName(slug),
      group: inferModelGroup(slug),
      ...normalized,
      provider: prov || 'litellm',
      source: 'litellm',
    };

    if ((entryPriority.get(slug) || -1) < priority) {
      entryPriority.set(slug, priority);
      upstreamPool[slug] = entry;
      if (isGoogle && /^gemini-/i.test(slug)) {
        googleCandidateMap.set(slug, entry);
      }
    }

    if (slug === 'gpt-oss-120b' && priority > gptOssScore) {
      gptOssScore = priority;
      gptOssBest = entry;
    }
  }

  const profileRates = mapBaseProfileMatches(upstreamPool, gptOssBest);
  return {
    profileRates,
    upstreamPool,
    googleCandidates: [...googleCandidateMap.values()],
  };
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    });
}

function parseMonthDayYearUtcMs(monthStr, dayStr, yearStr) {
  const mIdx = MONTH_INDEX_MAP[String(monthStr || '').toLowerCase()];
  const day = Number(dayStr);
  const year = Number(yearStr);
  if (mIdx === undefined || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  return Date.UTC(year, mIdx, day);
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:55:00
// Description: Keep multi-line <tr> table cells on one logical line with `; `
// breaks and decode HTML entities ONLY after all HTML tag stripping completes
// so decoded `&lt;= 200k` / `&gt; 200k` text is never eaten by `<[^>]+>`.
// ============================================================================
function extractLinesFromGoogleHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return [];
  let text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
      const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return plain ? `\n[H${lvl}] ${plain}\n` : '\n';
    })
    .replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_, rowHtml) => {
      const cells = [];
      const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm;
      while ((cm = cellRe.exec(rowHtml)) !== null) {
        const cellText = cm[1]
          .replace(/<br\s*\/?>/gi, '; ')
          .replace(/<\/(?:p|div|li)\s*>/gi, '; ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/(?:;\s*){2,}/g, '; ')
          .replace(/^[;\s]+|[;\s]+$/g, '')
          .trim();
        if (cellText) cells.push(cellText);
      }
      if (cells.length > 0) {
        return `\n${cells.join(' | ')}\n`;
      }
      const fallbackRow = rowHtml
        .replace(/<br\s*\/?>/gi, '; ')
        .replace(/<\/(?:p|div|li)\s*>/gi, '; ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return fallbackRow ? `\n${fallbackRow}\n` : '\n';
    })
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<\/(?:td|th)\s*>/gi, ' | ')
    .replace(/<\/(?:tr|p|div|li|section|article|table|thead|tbody|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').replace(/\|\s*\|/g, '|').trim())
    .filter(Boolean);
}
// ============================================================================
// [MODIFIED END] 2026-11-17 11:55:00
// ============================================================================

function mapGoogleHeadingToModelInfo(rawHeading) {
  const withoutTag = rawHeading.replace(/^\[H[1-6]\]\s*/, '').replace(/^#{1,6}\s*/, '').trim();
  const stripped = withoutTag
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*[-—–:]\s*(?:Paid|Free|Standard|Pricing|Interactive).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped || stripped.length > 64 || /\$/.test(stripped)) return null;
  if (/^Gemini\s+API\b/i.test(stripped)) return null;

  const match = /^(Gemini\s+(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9.-]*(?:\s+[A-Za-z0-9.-]+){0,3}))$/i.exec(
    stripped,
  );
  if (!match) return null;

  const cleanLabel = match[1].replace(/\s+/g, ' ').trim();
  const slugRaw = cleanLabel.toLowerCase().replace(/\s+/g, '-');
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:53:00
// Description: Reject non-chat headings (TTS/Image/Live/Audio/Embedding/etc.)
// before stripping suffix into built-in chat profile aliases.
// ============================================================================
  if (!isChatModelCandidate(slugRaw) || NON_CHAT_MODEL_RE.test(cleanLabel)) {
    return null;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:53:00
// ============================================================================

  let profileId = slugRaw;
  let canonicalLabel = cleanLabel;
  if (/^Gemini\s+4\s+Argon\b/i.test(cleanLabel)) {
    profileId = 'gemini-4-argon';
    canonicalLabel = 'Gemini 4 Argon';
  } else if (/^Gemini\s+3\.?1\s+Pro\b/i.test(cleanLabel)) {
    profileId = 'gemini-3.1-pro';
    canonicalLabel = 'Gemini 3.1 Pro';
  } else if (/^Gemini\s+4\s+Carbon\b/i.test(cleanLabel)) {
    profileId = 'gemini-4-carbon';
    canonicalLabel = 'Gemini 4 Carbon';
  } else if (/^Gemini\s+4\s+Hydrogen\b/i.test(cleanLabel)) {
    profileId = 'gemini-4-hydrogen';
    canonicalLabel = 'Gemini 4 Hydrogen';
  } else if (/^Gemini\s+3\.?8\s+Flash\b/i.test(cleanLabel)) {
    profileId = 'gemini-3-8-flash';
    canonicalLabel = 'Gemini 3.8 Flash';
  } else {
    profileId = slugRaw.replace(/-(?:preview|experimental)$/i, '');
    canonicalLabel = cleanLabel.replace(/\s+(?:Preview|Experimental)$/i, '');
  }

  return {
    profileId,
    slug: profileId === 'gemini-3-8-flash' ? 'gemini-3.8-flash' : profileId,
    label: canonicalLabel,
    isPreview: /\b(?:preview|experimental)\b/i.test(cleanLabel),
  };
}

function splitByMetricLabels(segment) {
  const labelRe =
    /(?:^|(?<=[\s,;|/()]))(?:context\s+cach(?:ing|e)|cached(?:\s+input)?|cache\s+read|caching|input(?:\s+price|\s+tokens)?|output(?:\s+price|\s+tokens)?)(?=\s*(?:[:|(/]|\$|\(|<=|=<|>|free|not))/gi;
  const starts = [];
  let m;
  while ((m = labelRe.exec(segment)) !== null) {
    const matchedLower = m[0].toLowerCase();
    // Avoid splitting inside "cached input" or "context caching input".
    if (matchedLower.startsWith('input') && m.index > 0) {
      const before = segment.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
      if (/\bcached\s*$/.test(before)) continue;
    }
    starts.push(m.index);
  }
  if (starts.length <= 1) return [segment];
  const parts = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : segment.length;
    parts.push(segment.slice(starts[i], end).trim());
  }
  return parts.filter(Boolean);
}

function detectMetricKind(text) {
  if (/\b(?:context\s+cach(?:ing|e)|cached(?:\s+input)?|cache\s+read|caching)\b/i.test(text)) {
    return 'cached';
  }
  if (/\binput\b/i.test(text)) return 'input';
  if (/\boutput\b/i.test(text)) return 'output';
  return null;
}

const GT_200K_RE = /(?:>|above|over|greater\s+than)\s*200\s*(?:k|,?000)\b/i;
const LE_200K_RE = /(?:<=|=<|up\s+to|less\s+than)\s*200\s*(?:k|,?000)\b/i;

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:51:00
// Description: Filter storage/per-hour/grounding/tuning per semicolon clause
// instead of discarding whole mixed Context Caching rows, and preserve
// blockInheritedMetric across continuation lines.
// ============================================================================
const STORAGE_OR_NON_TOKEN_RE = /\b(?:storage|per\s+hour|grounding|fine-?tun|tuning)\b/i;

function extractPricesFromClause(clauseText, bucket, inheritedMetric = null) {
  if (!clauseText) {
    return inheritedMetric;
  }

  // Strip Free Tier middle column in 3+ column markdown/pipe rows (`Metric | Free of charge | $2.00`).
  let normalizedClause = clauseText;
  let rowHeaderMetric = null;
  if (clauseText.includes('|')) {
    const cells = clauseText.split('|').map((c) => c.trim());
    if (STORAGE_OR_NON_TOKEN_RE.test(cells[0])) {
      return inheritedMetric;
    }
    rowHeaderMetric = detectMetricKind(cells[0]);
    if (
      cells.length >= 3 &&
      /^(?:free(?:\s+of\s+charge)?|not\s+available|n\/a|\$0+(?:\.0+)?)$/i.test(cells[1])
    ) {
      normalizedClause = [cells[0], ...cells.slice(2)].join(' | ');
    }
  }

  let lastMetric = rowHeaderMetric || inheritedMetric;
  for (const semiGroup of normalizedClause.split(';')) {
    const trimmedGroup = semiGroup.trim();
    if (!trimmedGroup || STORAGE_OR_NON_TOKEN_RE.test(trimmedGroup)) continue;
    const subParts = splitByMetricLabels(trimmedGroup);

    // Precompute explicit tier tag per subPart so shared trailing tags like
    // `Input $5.00, Output $22.50 (prompts > 200k)` propagate backwards in the group.
    const partTags = subParts.map((p) => ({
      gt: GT_200K_RE.exec(p),
      le: LE_200K_RE.exec(p),
    }));

    for (let i = 0; i < subParts.length; i++) {
      const part = subParts[i];
      if (STORAGE_OR_NON_TOKEN_RE.test(part)) continue;
      const metric = detectMetricKind(part) || lastMetric;
      if (!metric) continue;
      lastMetric = metric;

      const dollars = [...part.matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((m) => ({
        val: Number(m[1]),
        index: m.index ?? 0,
      }));
      if (dollars.length === 0) continue;

      let gtMatch = partTags[i].gt;
      let leMatch = partTags[i].le;
      if (!gtMatch && !leMatch) {
        for (let j = i + 1; j < partTags.length; j++) {
          if (partTags[j].gt || partTags[j].le) {
            gtMatch = partTags[j].gt;
            leMatch = partTags[j].le;
            break;
          }
        }
      }

      let stdVal = null;
      let longVal = null;

      if (gtMatch && !leMatch && dollars.length === 1) {
        longVal = dollars[0].val;
      } else if (gtMatch && dollars.length >= 2) {
        if (leMatch && gtMatch.index < leMatch.index) {
          longVal = dollars[0].val;
          stdVal = dollars[1].val;
        } else {
          stdVal = dollars[0].val;
          longVal = dollars[1].val;
        }
      } else {
        stdVal = dollars[0].val;
      }

      if (stdVal !== null && Number.isFinite(stdVal)) {
        bucket[metric] = stdVal;
      }
      if (longVal !== null && Number.isFinite(longVal)) {
        if (metric === 'input') bucket.longInput = longVal;
        else if (metric === 'output') bucket.longOutput = longVal;
        else if (metric === 'cached') bucket.longCached = longVal;
      }
    }
  }
  return lastMetric;
}

function splitEffectiveDateClauses(line) {
  if (!STARTING_DATE_RE.test(line)) {
    return [{ text: line, effMs: null }];
  }

  // Split around `;`, `|`, ` / `, or immediately after `through/until/before <Month Day, Year>)`
  // or between an introductory price clause and a following `$X starting <Date>` clause.
  const throughSplitRe = new RegExp(
    `(\\b(?:through|until|before|thru)\\s+(?:${MONTH_PATTERN})\\s+\\d{1,2},?\\s+\\d{4}\\)?)[,;\\s]+`,
    'gi',
  );
  let prepared = line.replace(throughSplitRe, '$1\u0000');
  prepared = prepared.replace(
    /(\$\s*\d+(?:\.\d+)?(?:\s*\([^)]*\))?(?:\s*(?:introductory|promo(?:tional)?|preview|current))?)\s*(?:,|—|–)\s*(?=\$\s*\d+(?:\.\d+)?\s+(?:\([^)]*\)\s*)?starting\b)/gi,
    '$1\u0000',
  );
  const rawParts = prepared
    .split(/\u0000|[;|]|\s+\/\s+|,\s*(?=starting\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:53:00
// Description: Keep `<=200k` and `>200k starting <Date>` clauses paired across
// `<br>` semicolon splits so both tiers attach to the scheduled effective date.
// ============================================================================
  const mergedParts = [];
  for (let i = 0; i < rawParts.length; i++) {
    const cur = rawParts[i];
    const nxt = i + 1 < rawParts.length ? rawParts[i + 1] : '';
    if (
      nxt &&
      LE_200K_RE.test(cur) &&
      !THROUGH_DATE_RE.test(cur) &&
      !STARTING_DATE_RE.test(cur) &&
      !/\b(?:introductory|promo(?:tional)?|preview)\b/i.test(cur) &&
      GT_200K_RE.test(nxt) &&
      STARTING_DATE_RE.test(nxt)
    ) {
      mergedParts.push(`${cur}; ${nxt}`);
      i += 1;
    } else {
      mergedParts.push(cur);
    }
  }

  return mergedParts.map((part) => {
    const sm = STARTING_DATE_RE.exec(part);
    if (!sm) return { text: part, effMs: null };
    const effMs = parseMonthDayYearUtcMs(sm[1], sm[2], sm[3]);
    return { text: part.replace(sm[0], ' ').trim(), effMs };
  });
// ============================================================================
// [MODIFIED END] 2026-11-17 11:53:00
// ============================================================================
}

function parseGoogleModelBlock(lines, nowMs) {
  const introBucket = {};
  const scheduledList = [];
  let currentScheduled = null;
  let inBatchSection = false;
  let blockInheritedMetric = null;

  const getOrCreateScheduled = (effMs) => {
    let found = scheduledList.find((s) => s.effMs === effMs);
    if (!found) {
      found = { effMs, bucket: {} };
      scheduledList.push(found);
    }
    return found;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\[H[1-6]\]\s*/, '').trim();
    if (!line) continue;

    if (/^(?:batch(?:\s+api)?(?:\s+pricing)?)$/i.test(line)) {
      inBatchSection = true;
      blockInheritedMetric = null;
      continue;
    }
    if (/^(?:standard(?:\s+pricing)?|interactive|paid\s+tier)$/i.test(line)) {
      inBatchSection = false;
      blockInheritedMetric = null;
      continue;
    }
    if (inBatchSection) continue;
    if (/\b(?:credit|trial|billing|free\s+tier\s+limit)\b/i.test(line)) {
      blockInheritedMetric = null;
      continue;
    }

    // Check section-level period switch without inline dollar amounts before `starting`.
    const startMatch = STARTING_DATE_RE.exec(line);
    const hasDollarBeforeStart =
      startMatch && /\$\s*\d/.test(line.slice(0, startMatch.index));

    if (startMatch && !hasDollarBeforeStart) {
      const effMs = parseMonthDayYearUtcMs(startMatch[1], startMatch[2], startMatch[3]);
      if (effMs !== null) {
        currentScheduled = getOrCreateScheduled(effMs);
        const remainder = line
          .slice(startMatch.index + startMatch[0].length)
          .replace(/^[:,;\s-]+/, '')
          .trim();
        if (remainder && /\$\s*\d/.test(remainder)) {
          blockInheritedMetric = extractPricesFromClause(
            remainder,
            currentScheduled.bucket,
            blockInheritedMetric,
          );
        } else {
          blockInheritedMetric = null;
        }
        continue;
      }
    }

    if (!startMatch && THROUGH_DATE_RE.test(line) && !/\$\s*\d/.test(line)) {
      currentScheduled = null;
      blockInheritedMetric = null;
      continue;
    }

    if (
      !detectMetricKind(line) &&
      !/^(?:\$|starting\b|through\b|until\b|prompts?\b|<=|>|for\s+prompts)/i.test(line)
    ) {
      blockInheritedMetric = null;
    }

    const clauses = splitEffectiveDateClauses(line);
    let inheritedMetric = blockInheritedMetric;
    for (const clause of clauses) {
      if (clause.effMs !== null) {
        const sched = getOrCreateScheduled(clause.effMs);
        inheritedMetric = extractPricesFromClause(clause.text, sched.bucket, inheritedMetric);
      } else if (currentScheduled) {
        inheritedMetric = extractPricesFromClause(
          clause.text,
          currentScheduled.bucket,
          inheritedMetric,
        );
      } else {
        inheritedMetric = extractPricesFromClause(clause.text, introBucket, inheritedMetric);
      }
    }
    blockInheritedMetric = inheritedMetric;
  }

  const effective = { ...introBucket };
  scheduledList.sort((a, b) => a.effMs - b.effMs);
  for (const item of scheduledList) {
    if (nowMs >= item.effMs) {
      Object.assign(effective, item.bucket);
    }
  }

  return effective;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 11:51:00
// ============================================================================

/**
 * Parses Google Gemini API official pricing HTML (`https://ai.google.dev/gemini-api/docs/pricing`)
 * into per-model Paid Tier USD/1M rates with effective-date awareness (`starting <Month Day, Year>`).
 */
export function parseGoogleOfficialPricingHtml(html, nowMs = Date.now()) {
  const profileRates = {};
  const models = [];
  if (typeof html !== 'string' || !html.trim()) {
    return { profileRates, models };
  }

  const lines = extractLinesFromGoogleHtml(html);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const isTagHeading = /^\[H[1-6]\]/.test(line);
    const plainHeading = line.replace(/^\[H[1-6]\]\s*/, '').trim();
    const looksLikeHeading =
      isTagHeading ||
      (/^#{1,6}\s+/.test(plainHeading)) ||
      (plainHeading.length <= 56 &&
        !/\$/.test(plainHeading) &&
        /^Gemini\s+\d+(?:\.\d+)?\s+[A-Za-z]/i.test(plainHeading));

    if (looksLikeHeading) {
      const modelInfo = mapGoogleHeadingToModelInfo(line);
      if (modelInfo) {
        if (!isChatModelCandidate(modelInfo.slug)) {
          current = null;
          continue;
        }
        current = { info: modelInfo, lines: [] };
        blocks.push(current);
        continue;
      }
      if (
        (isTagHeading &&
          /^(?:related\s+guides|what'?s\s+next|faq|rate\s+limits|billing|terms)/i.test(
            plainHeading,
          )) ||
        /^(?:Gemini\s+\d|Imagen\b|Veo\b|Gemma\b|LearnLM\b|Lyria\b|Embedding\b)/i.test(plainHeading)
      ) {
        current = null;
        continue;
      }
    }

    if (current) {
      current.lines.push(line);
    }
  }

  const seenProfileIds = new Map();

  for (const block of blocks) {
    const rawRates = parseGoogleModelBlock(block.lines, nowMs);
    const validated = validateAndNormalizeRates({
      inputPer1M: rawRates.input,
      cachedPer1M: rawRates.cached,
      outputPer1M: rawRates.output,
      longInputPer1M: rawRates.longInput,
      longOutputPer1M: rawRates.longOutput,
      longContextTier:
        Number.isFinite(rawRates.longInput) || Number.isFinite(rawRates.longOutput),
      isGemini: true,
      modelId: block.info.slug,
    });
    if (!validated) continue;

    const prev = seenProfileIds.get(block.info.profileId);
    if (prev && !prev.isPreview && block.info.isPreview) {
      continue;
    }
    seenProfileIds.set(block.info.profileId, block.info);

    const record = {
      id: block.info.profileId,
      slug: block.info.slug,
      label: block.info.label,
      group: 'Gemini 系列',
      ...validated,
      source: 'google-official',
    };
    profileRates[block.info.profileId] = record;
  }

  for (const rec of Object.values(profileRates)) {
    models.push(rec);
  }

  return { profileRates, models };
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:51:00
// Description: Prevent broad family fallback regexes (gemini[\s-]*[23].*pro,
// gemini.*flash) in base profiles from shadowing newly discovered/observed
// Gemini models like gemini-3.2-pro or gemini-4-flash.
// ============================================================================
const EXPLICIT_BASE_ALIAS_PATTERNS = new Map([
  ['gemini-4-argon', /^(?:gemini[\s_-]*4[\s_-]*argon(?:$|[-_\s])|gemini-pro-orchestrator-argon$)/i],
  ['gemini-3.1-pro', /^(?:gemini[\s_-]*3\.?1[\s_-]*pro(?:$|[-_\s])|gemini-pro-default$)/i],
  [
    'gemini-4-carbon',
    /^(?:gemini[\s_-]*4[\s_-]*carbon(?:$|[-_\s])|gemini-pro-orchestrator$|gemini[\s_-]*(?:2(?:\.\d+)?|3(?:\.0)?)[\s_-]*pro(?:$|[-_\s])|gemini[\s_-]*pro$|pro$)/i,
  ],
  ['gemini-4-hydrogen', /^gemini[\s_-]*4[\s_-]*hydrogen(?:$|[-_\s])/i],
  [
    'gemini-3-8-flash',
    /^(?:gemini[\s_-]*3\.?8[\s_-]*flash(?:$|[-_\s])|gemini[\s_-]*flash(?:[-_](?:worker|lite|latest)(?:[-_][a-z0-9]+)?)?$|flash(?:_lite)?$|gemini[\s_-]*(?:2(?:\.\d+)?|3(?:\.0)?)[\s_-]*flash(?:$|[-_\s]))/i,
  ],
  ['claude-opus-5-5', /^claude[\s_-]*opus/i],
  ['claude-sonnet-5-5', /^claude[\s_-]*(?:sonnet|haiku)/i],
  ['gpt-oss-120b', /^gpt[\s_-]*oss/i],
]);

function matchesCatalogProfileExplicitly(slug, profile) {
  if (!profile || profile.id === 'auto') return false;
  const lower = String(slug || '').toLowerCase();
  if (profile.id.toLowerCase() === lower) return true;
  const explicitRe = EXPLICIT_BASE_ALIAS_PATTERNS.get(profile.id);
  if (explicitRe) {
    return explicitRe.test(lower);
  }
  return profile.pattern instanceof RegExp && profile.pattern.test(slug);
}

function matchesBaseCatalog(slug, baseCatalog) {
  for (const p of baseCatalog) {
    if (matchesCatalogProfileExplicitly(slug, p)) return true;
  }
  return false;
}
// ============================================================================
// [MODIFIED END] 2026-11-17 11:51:00
// ============================================================================

function deriveFamilyBaseline(slug) {
  const s = String(slug || '').toLowerCase();
  if (s.startsWith('gemini')) {
    if (/flash|lite/i.test(s)) {
      return {
        group: 'Gemini 系列',
        inputPer1M: 0.75,
        cachedPer1M: 0.075,
        outputPer1M: 3.75,
        longContextTier: false,
        longInputMultiplier: 1.0,
        longOutputMultiplier: 1.0,
      };
    }
    if (/hydrogen/i.test(s)) {
      return {
        group: 'Gemini 系列',
        inputPer1M: 1.5,
        cachedPer1M: 0.15,
        outputPer1M: 7.5,
        longContextTier: true,
        longInputMultiplier: 2.0,
        longOutputMultiplier: 1.5,
      };
    }
    return {
      group: 'Gemini 系列',
      inputPer1M: 2.0,
      cachedPer1M: 0.2,
      outputPer1M: 10.0,
      longContextTier: true,
      longInputMultiplier: 2.0,
      longOutputMultiplier: 1.5,
    };
  }
  if (s.startsWith('claude')) {
    if (/opus/i.test(s)) {
      return {
        group: 'Claude 系列',
        inputPer1M: 4.0,
        cachedPer1M: 0.2,
        outputPer1M: 20.0,
        longContextTier: false,
        longInputMultiplier: 1.0,
        longOutputMultiplier: 1.0,
      };
    }
    return {
      group: 'Claude 系列',
      inputPer1M: 2.0,
      cachedPer1M: 0.1,
      outputPer1M: 10.0,
      longContextTier: false,
      longInputMultiplier: 1.0,
      longOutputMultiplier: 1.0,
    };
  }
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Update fallback baseline group labels from 其他在役模型 to 其他现役模型.
// ============================================================================
  if (/gpt[\s-]*oss/i.test(s)) {
    return {
      group: '其他现役模型',
      inputPer1M: 0.15,
      cachedPer1M: 0.075,
      outputPer1M: 0.6,
      longContextTier: false,
      longInputMultiplier: 1.0,
      longOutputMultiplier: 1.0,
    };
  }
  return {
    group: '其他现役模型',
    inputPer1M: 2.0,
    cachedPer1M: 0.2,
    outputPer1M: 10.0,
    longContextTier: false,
    longInputMultiplier: 1.0,
    longOutputMultiplier: 1.0,
  };
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:44:00
// Description: Add parseUsdToCnyRateJson helper, persist synced USD-to-CNY FX
// rate fields in pricing_cache.json, and expose getSyncedCnyRate().
// ============================================================================
export function parseUsdToCnyRateJson(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const candidate =
    obj?.rates?.CNY ?? obj?.rates?.cny ?? obj?.conversion_rates?.CNY ?? obj?.usd?.cny ?? null;
  const rate = Number(candidate);
  if (!Number.isFinite(rate) || rate < 1.0 || rate > 50.0) {
    return null;
  }
  return Number(rate.toFixed(4));
}

function emptyCacheState() {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    lastSyncLocalDate: '',
    lastSyncAtMs: null,
    lastAttemptAtMs: null,
    status: 'idle',
    sources: [],
    error: '',
    usdToCnyRate: null,
    fxSource: '',
    fxLastSyncLocalDate: '',
    fxAttemptLocalDate: '',
    syncedRates: {},
    upstreamPool: {},
    discoveredModels: [],
  };
}

function loadPricingCache(cachePath) {
  const fallback = emptyCacheState();
  if (!cachePath || !existsSync(cachePath)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
    if (!raw || typeof raw !== 'object' || raw.schemaVersion !== CACHE_SCHEMA_VERSION) {
      return fallback;
    }
    const rawFx = Number(raw.usdToCnyRate);
    const validFx = Number.isFinite(rawFx) && rawFx >= 1.0 && rawFx <= 50.0 ? Number(rawFx.toFixed(4)) : null;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Normalize cached upstreamPool entry group labels from legacy
// 其他在役模型 to 其他现役模型 when loading pricing_cache.json.
// ============================================================================
    const rawUpstreamPool =
      raw.upstreamPool && typeof raw.upstreamPool === 'object' && !Array.isArray(raw.upstreamPool)
        ? raw.upstreamPool
        : {};
    const upstreamPool = {};
    for (const [key, item] of Object.entries(rawUpstreamPool)) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        upstreamPool[key] =
          typeof item.group === 'string'
            ? { ...item, group: normalizeModelGroupName(item.group) }
            : item;
      } else {
        upstreamPool[key] = item;
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      lastSyncLocalDate: typeof raw.lastSyncLocalDate === 'string' ? raw.lastSyncLocalDate : '',
      lastSyncAtMs: Number.isFinite(Number(raw.lastSyncAtMs)) ? Number(raw.lastSyncAtMs) : null,
      lastAttemptAtMs: Number.isFinite(Number(raw.lastAttemptAtMs))
        ? Number(raw.lastAttemptAtMs)
        : null,
      status:
        typeof raw.status === 'string' && ['idle', 'ok', 'cached', 'offline'].includes(raw.status)
          ? raw.status
          : 'idle',
      sources: Array.isArray(raw.sources)
        ? raw.sources.filter((s) => typeof s === 'string')
        : [],
      error: typeof raw.error === 'string' ? raw.error : '',
      usdToCnyRate: validFx,
      fxSource: typeof raw.fxSource === 'string' ? raw.fxSource : '',
      fxLastSyncLocalDate: typeof raw.fxLastSyncLocalDate === 'string' ? raw.fxLastSyncLocalDate : '',
      fxAttemptLocalDate: typeof raw.fxAttemptLocalDate === 'string' ? raw.fxAttemptLocalDate : '',
      syncedRates:
        raw.syncedRates && typeof raw.syncedRates === 'object' && !Array.isArray(raw.syncedRates)
          ? raw.syncedRates
          : {},
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Persist normalized upstreamPool map from loadPricingCache().
// ============================================================================
      upstreamPool,
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
      discoveredModels: Array.isArray(raw.discoveredModels) ? raw.discoveredModels : [],
    };
  } catch {
    return fallback;
  }
}

function persistPricingCache(stateDir, cachePath, cache) {
  if (!stateDir || !cachePath) return;
  try {
    mkdirSync(stateDir, { recursive: true });
    const tmpPath = `${cachePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2), 'utf-8');
    renameSync(tmpPath, cachePath);
  } catch (err) {
    console.error(`[monitor_pane] failed to persist pricing cache: ${err.message}`);
  }
}

/**
 * Creates the dual-channel pricing synchronization manager with daily cadence,
 * offline fallback, new Gemini auto-discovery, local observed model promotion,
 * and daily USD-to-CNY exchange rate synchronization.
 */
export function createPricingSyncManager({
  stateDir,
  baseCatalog = MODEL_PRICING_CATALOG,
  fetchImpl = globalThis.fetch,
  nowFn = Date.now,
  googlePricingUrl = process.env.PRICING_SYNC_GOOGLE_URL || DEFAULT_GOOGLE_PRICING_URL,
  modelsDevUrl = process.env.PRICING_SYNC_MODELS_DEV_URL || DEFAULT_MODELS_DEV_URL,
  liteLlmUrl = process.env.PRICING_SYNC_LITELLM_URL || DEFAULT_LITELLM_URL,
  fxPrimaryUrl = process.env.PRICING_SYNC_FX_URL || DEFAULT_FX_PRIMARY_URL,
  fxFallbackUrl = process.env.PRICING_SYNC_FX_FALLBACK_URL || DEFAULT_FX_FALLBACK_URL,
  autoSyncDisabled = process.env.PRICING_SYNC_DISABLE_AUTO === '1',
} = {}) {
  const catalogBase =
    Array.isArray(baseCatalog) && baseCatalog.length > 0 ? baseCatalog : MODEL_PRICING_CATALOG;
  const cachePath = stateDir ? join(stateDir, 'pricing_cache.json') : '';
  const cache = loadPricingCache(cachePath);
  let inFlightPromise = null;

  function getSyncedCnyRate() {
    return Number.isFinite(cache.usdToCnyRate) && cache.usdToCnyRate > 0
      ? cache.usdToCnyRate
      : null;
  }

  function getPublicStatus() {
    return {
      lastSyncLocalDate: cache.lastSyncLocalDate,
      lastSyncAtMs: cache.lastSyncAtMs,
      lastAttemptAtMs: cache.lastAttemptAtMs,
      status: cache.status,
      sources: [...cache.sources],
      error: cache.error,
      syncing: Boolean(inFlightPromise),
      discoveredCount: Array.isArray(cache.discoveredModels) ? cache.discoveredModels.length : 0,
      usdToCnyRate: getSyncedCnyRate(),
      fxSource: cache.fxSource || '',
      fxLastSyncLocalDate: cache.fxLastSyncLocalDate || '',
    };
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:44:00
// ============================================================================

  function getRuntimeCatalog(observedModelIds = []) {
    const autoBase =
      catalogBase.find((p) => p.id === 'auto') ||
      MODEL_PRICING_CATALOG.find((p) => p.id === 'auto');

    const baseEntries = [];
    const seenIds = new Set();

    for (const p of catalogBase) {
      if (!p || p.id === 'auto') continue;
      const synced = cache.syncedRates?.[p.id];
      const entry = {
        id: p.id,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Normalize base entry group via normalizeModelGroupName().
// ============================================================================
        group: normalizeModelGroupName(p.group),
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
        label: p.label,
        hint: p.hint,
        inputPer1M:
          synced && Number.isFinite(Number(synced.inputPer1M))
            ? Number(synced.inputPer1M)
            : p.inputPer1M,
        cachedPer1M:
          synced && Number.isFinite(Number(synced.cachedPer1M))
            ? Number(synced.cachedPer1M)
            : p.cachedPer1M,
        outputPer1M:
          synced && Number.isFinite(Number(synced.outputPer1M))
            ? Number(synced.outputPer1M)
            : p.outputPer1M,
        longContextTier:
          synced && typeof synced.longContextTier === 'boolean'
            ? synced.longContextTier
            : Boolean(p.longContextTier),
        longInputMultiplier:
          synced && Number.isFinite(Number(synced.longInputMultiplier))
            ? Number(synced.longInputMultiplier)
            : p.longInputMultiplier || (p.longContextTier ? 2.0 : 1.0),
        longOutputMultiplier:
          synced && Number.isFinite(Number(synced.longOutputMultiplier))
            ? Number(synced.longOutputMultiplier)
            : p.longOutputMultiplier || (p.longContextTier ? 1.5 : 1.0),
        pattern:
          p.pattern instanceof RegExp ? p.pattern : compileModelPattern(p.patternStr, p.id),
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Preserve fallbackPattern when cloning base catalog entries.
// ============================================================================
        fallbackPattern:
          p.fallbackPattern instanceof RegExp
            ? p.fallbackPattern
            : compileModelPattern(p.fallbackPatternStr, ''),
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================
      };
      baseEntries.push(entry);
      seenIds.add(entry.id.toLowerCase());
    }

    const discoveredEntries = [];
    for (const d of cache.discoveredModels || []) {
      if (!d || typeof d.id !== 'string' || !d.id.trim()) continue;
      const cleanId = d.id.trim();
      const lower = cleanId.toLowerCase();
      if (seenIds.has(lower) || matchesBaseCatalog(cleanId, catalogBase)) continue;

      const validated = validateAndNormalizeRates({
        inputPer1M: d.inputPer1M,
        cachedPer1M: d.cachedPer1M,
        outputPer1M: d.outputPer1M,
        longContextTier: d.longContextTier,
        longInputMultiplier: d.longInputMultiplier,
        longOutputMultiplier: d.longOutputMultiplier,
        isGemini: true,
        modelId: cleanId,
      });
      if (!validated) continue;

      seenIds.add(lower);
      discoveredEntries.push({
        id: cleanId,
        group: 'Gemini 系列',
        label:
          typeof d.label === 'string' && d.label.trim()
            ? d.label.trim()
            : formatModelDisplayName(cleanId),
        hint: typeof d.hint === 'string' && d.hint.trim() ? d.hint.trim() : '官方自动同步模型',
        ...validated,
        pattern: compileModelPattern(d.patternStr, cleanId),
      });
    }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:51:00
// Description: Match base entries via non-shadowing explicit aliases inside
// matchExisting so observed models like gemini-3.2-pro and gemini-4-flash
// auto-promote cleanly when not already discovered.
// ============================================================================
    const matchExisting = (slug) => {
      const lower = slug.toLowerCase();
      for (const p of baseEntries) {
        if (matchesCatalogProfileExplicitly(lower, p)) return true;
      }
      for (const p of discoveredEntries) {
        if (p.id.toLowerCase() === lower) return true;
        if (p.pattern instanceof RegExp && p.pattern.test(slug)) return true;
      }
      return false;
    };
// ============================================================================
// [MODIFIED END] 2026-11-17 11:51:00
// ============================================================================

    const promotedEntries = [];
    const promotedSeen = new Set();
    for (const rawObs of observedModelIds || []) {
      const slug = typeof rawObs === 'string' ? rawObs.trim() : '';
      if (!slug || /^(?:auto|unknown|none)$/i.test(slug)) continue;
      const lower = slug.toLowerCase();
      if (seenIds.has(lower) || promotedSeen.has(lower) || matchExisting(slug)) continue;

      promotedSeen.add(lower);
      const upstream = cache.upstreamPool?.[lower] || null;
      const baseline = upstream
        ? {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 21:28:27
// Description: Normalize upstream group via normalizeModelGroupName() in getRuntimeCatalog().
// ============================================================================
            group: normalizeModelGroupName(upstream.group || inferModelGroup(lower)),
// ============================================================================
// [MODIFIED END] 2026-11-17 21:28:27
// ============================================================================
            inputPer1M: Number(upstream.inputPer1M),
            cachedPer1M: Number(upstream.cachedPer1M),
            outputPer1M: Number(upstream.outputPer1M),
            longContextTier: Boolean(upstream.longContextTier),
            longInputMultiplier: Number(upstream.longInputMultiplier) || 1.0,
            longOutputMultiplier: Number(upstream.longOutputMultiplier) || 1.0,
          }
        : deriveFamilyBaseline(lower);

      promotedEntries.push({
        id: slug,
        group: baseline.group,
        label:
          upstream && typeof upstream.label === 'string' && upstream.label.trim()
            ? upstream.label.trim()
            : formatModelDisplayName(slug),
        hint: '本地观测模型',
        inputPer1M: baseline.inputPer1M,
        cachedPer1M: baseline.cachedPer1M,
        outputPer1M: baseline.outputPer1M,
        longContextTier: baseline.longContextTier,
        longInputMultiplier: baseline.longInputMultiplier,
        longOutputMultiplier: baseline.longOutputMultiplier,
        pattern: compileModelPattern('', slug),
      });
    }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Sort all Gemini, Claude, and other runtime entries strictly by
// performance tier using compareModelsByPerformance (fallbackPattern is decoupled
// in 3-pass resolveModelProfile, so order reflects capability top-to-bottom).
// ============================================================================
    const geminiList = [];
    const claudeList = [];
    const otherList = [];
    for (const entry of [...baseEntries, ...discoveredEntries, ...promotedEntries]) {
      if (entry.group === 'Gemini 系列') geminiList.push(entry);
      else if (entry.group === 'Claude 系列') claudeList.push(entry);
      else otherList.push(entry);
    }
    geminiList.sort(compareModelsByPerformance);
    claudeList.sort(compareModelsByPerformance);
    otherList.sort(compareModelsByPerformance);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================

    const carbonRates = cache.syncedRates?.['gemini-4-carbon'] || cache.syncedRates?.['auto'];
    const autoEntry = {
      id: 'auto',
      group: autoBase?.group || '默认回退',
      label: autoBase?.label || 'Auto (默认)',
      hint: autoBase?.hint || '未显式指定模型时使用',
      inputPer1M:
        carbonRates && Number.isFinite(Number(carbonRates.inputPer1M))
          ? Number(carbonRates.inputPer1M)
          : autoBase?.inputPer1M ?? 2.0,
      cachedPer1M:
        carbonRates && Number.isFinite(Number(carbonRates.cachedPer1M))
          ? Number(carbonRates.cachedPer1M)
          : autoBase?.cachedPer1M ?? 0.2,
      outputPer1M:
        carbonRates && Number.isFinite(Number(carbonRates.outputPer1M))
          ? Number(carbonRates.outputPer1M)
          : autoBase?.outputPer1M ?? 10.0,
      longContextTier:
        carbonRates && typeof carbonRates.longContextTier === 'boolean'
          ? carbonRates.longContextTier
          : autoBase?.longContextTier ?? true,
      longInputMultiplier:
        carbonRates && Number.isFinite(Number(carbonRates.longInputMultiplier))
          ? Number(carbonRates.longInputMultiplier)
          : autoBase?.longInputMultiplier ?? 2.0,
      longOutputMultiplier:
        carbonRates && Number.isFinite(Number(carbonRates.longOutputMultiplier))
          ? Number(carbonRates.longOutputMultiplier)
          : autoBase?.longOutputMultiplier ?? 1.5,
      pattern: null,
    };

    return [...geminiList, ...claudeList, ...otherList, autoEntry];
  }

  async function fetchChannel1() {
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch unavailable');
    }
    const errors = [];

    if (modelsDevUrl) {
      try {
        const res = await fetchImpl(modelsDevUrl, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        });
        if (!res || !res.ok) {
          throw new Error(`models.dev HTTP ${res?.status || 'ERR'}`);
        }
        const json = await res.json();
        const parsed = parseModelsDevCatalog(json);
        if (
          Object.keys(parsed.profileRates).length > 0 ||
          Object.keys(parsed.upstreamPool).length > 0
        ) {
          return { source: 'models.dev', parsed };
        }
        throw new Error('models.dev returned 0 usable entries');
      } catch (err) {
        errors.push(err?.message || 'models.dev failed');
      }
    }

    if (liteLlmUrl) {
      try {
        const res = await fetchImpl(liteLlmUrl, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        });
        if (!res || !res.ok) {
          throw new Error(`litellm HTTP ${res?.status || 'ERR'}`);
        }
        const json = await res.json();
        const parsed = parseLiteLlmCatalog(json);
        if (
          Object.keys(parsed.profileRates).length > 0 ||
          Object.keys(parsed.upstreamPool).length > 0
        ) {
          return { source: 'litellm', parsed };
        }
        throw new Error('litellm returned 0 usable entries');
      } catch (err) {
        errors.push(err?.message || 'litellm failed');
      }
    }

    throw new Error(errors.join('; ') || 'channel 1 failed');
  }

  async function fetchChannel2(nowMs) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch unavailable');
    }
    if (!googlePricingUrl) {
      throw new Error('googlePricingUrl unset');
    }
    const res = await fetchImpl(googlePricingUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res || !res.ok) {
      throw new Error(`google HTTP ${res?.status || 'ERR'}`);
    }
    const html = await res.text();
    const parsed = parseGoogleOfficialPricingHtml(html, nowMs);
    if (Object.keys(parsed.profileRates).length === 0 && parsed.models.length === 0) {
      throw new Error('google HTML matched 0 pricing blocks');
    }
    return { source: 'google-official', parsed };
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:44:00
// Description: Fetch USD-to-CNY exchange rate concurrently during daily sync
// with fallback, preserve cached FX rate offline, and trigger once if FX was
// not yet attempted today.
// ============================================================================
  async function fetchFxChannel() {
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch unavailable');
    }
    const candidates = [
      [fxPrimaryUrl, 'frankfurter.dev'],
      [fxFallbackUrl, 'open.er-api.com'],
    ];
    const errors = [];
    for (const [url, source] of candidates) {
      if (!url) continue;
      try {
        const res = await fetchImpl(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        });
        if (!res || !res.ok) {
          throw new Error(`${source} HTTP ${res?.status || 'ERR'}`);
        }
        const payload =
          typeof res.json === 'function'
            ? await res.json()
            : typeof res.text === 'function'
              ? await res.text()
              : null;
        const rate = parseUsdToCnyRateJson(payload);
        if (rate !== null) {
          return { source, rate };
        }
        throw new Error(`${source} invalid CNY rate`);
      } catch (err) {
        errors.push(err?.message || `${source} failed`);
      }
    }
    throw new Error(errors.join('; ') || 'FX channel failed');
  }

  async function executeSync(observedModelIds) {
    const nowMs = nowFn();
    const todayLocal = formatLocalDate(nowMs);
    const [ch1Res, ch2Res, fxRes] = await Promise.allSettled([
      fetchChannel1(),
      fetchChannel2(nowMs),
      fetchFxChannel(),
    ]);

    const ch1Ok = ch1Res.status === 'fulfilled';
    const ch2Ok = ch2Res.status === 'fulfilled';
    const fxOk = fxRes.status === 'fulfilled';
    cache.fxAttemptLocalDate = todayLocal;

    if (fxOk) {
      cache.usdToCnyRate = fxRes.value.rate;
      cache.fxSource = fxRes.value.source;
      cache.fxLastSyncLocalDate = todayLocal;
    }

    if (!ch1Ok && !ch2Ok) {
      const errs = [
        ch2Res.status === 'rejected' ? ch2Res.reason?.message : '',
        ch1Res.status === 'rejected' ? ch1Res.reason?.message : '',
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 240);
      cache.lastAttemptAtMs = nowMs;
      cache.status = cache.lastSyncAtMs ? 'cached' : 'offline';
      cache.error = errs || 'all pricing channels failed';
      persistPricingCache(stateDir, cachePath, cache);
      return {
        ok: false,
        updated: fxOk,
        status: getPublicStatus(),
        runtimeCatalog: getRuntimeCatalog(observedModelIds),
      };
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:44:00
// ============================================================================

    const activeSources = [];
    const nextSyncedRates = ch1Ok ? {} : { ...(cache.syncedRates || {}) };
    const nextUpstreamPool = ch1Ok ? {} : { ...(cache.upstreamPool || {}) };
    const discoveredMap = new Map();

    const maybeRegisterDiscovered = (candidate) => {
      if (!candidate) return;
      const slug = String(candidate.slug || candidate.id || '')
        .replace(/^models\//i, '')
        .trim()
        .toLowerCase();
      if (!slug || !NEW_GEMINI_DISCOVERY_RE.test(slug)) return;
      if (!isChatModelCandidate(slug, candidate)) return;
      if (matchesBaseCatalog(slug, catalogBase)) return;

      const patternStr = `^${escapeRegex(slug).replace(/-/g, '[\\s_-]*')}$`;
      discoveredMap.set(slug, {
        id: slug,
        group: 'Gemini 系列',
        label: candidate.label || formatModelDisplayName(slug),
        hint: '官方自动同步模型',
        inputPer1M: candidate.inputPer1M,
        cachedPer1M: candidate.cachedPer1M,
        outputPer1M: candidate.outputPer1M,
        longContextTier: Boolean(candidate.longContextTier),
        longInputMultiplier: Number(candidate.longInputMultiplier) || 2.0,
        longOutputMultiplier: Number(candidate.longOutputMultiplier) || 1.5,
        patternStr,
      });
    };

    if (ch1Ok) {
      const { source, parsed } = ch1Res.value;
      activeSources.push(source);
      Object.assign(nextSyncedRates, parsed.profileRates);
      Object.assign(nextUpstreamPool, parsed.upstreamPool);
      for (const cand of parsed.googleCandidates || []) {
        maybeRegisterDiscovered(cand);
      }
    }

    if (ch2Ok) {
      const { source, parsed } = ch2Res.value;
      activeSources.unshift(source);
      for (const [pid, rec] of Object.entries(parsed.profileRates || {})) {
        nextSyncedRates[pid] = { ...rec };
        const poolKey = String(rec.slug || pid).toLowerCase();
        nextUpstreamPool[poolKey] = {
          id: poolKey,
          label: rec.label,
          group: 'Gemini 系列',
          inputPer1M: rec.inputPer1M,
          cachedPer1M: rec.cachedPer1M,
          outputPer1M: rec.outputPer1M,
          longContextTier: rec.longContextTier,
          longInputMultiplier: rec.longInputMultiplier,
          longOutputMultiplier: rec.longOutputMultiplier,
          provider: 'google',
          source: 'google-official',
        };
      }
      for (const cand of parsed.models || []) {
        maybeRegisterDiscovered(cand);
      }
    }

    cache.syncedRates = nextSyncedRates;
    cache.upstreamPool = nextUpstreamPool;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:15:00
// Description: Sort discoveredModels by performance tier before persisting cache.
// ============================================================================
    cache.discoveredModels = [...discoveredMap.values()].sort(compareModelsByPerformance);
// ============================================================================
// [MODIFIED END] 2026-11-17 15:15:00
// ============================================================================
    cache.lastSyncLocalDate = formatLocalDate(nowMs);
    cache.lastSyncAtMs = nowMs;
    cache.lastAttemptAtMs = nowMs;
    cache.status = 'ok';
    cache.sources = activeSources;
    cache.error = '';

    persistPricingCache(stateDir, cachePath, cache);
    return {
      ok: true,
      updated: true,
      status: getPublicStatus(),
      runtimeCatalog: getRuntimeCatalog(observedModelIds),
    };
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 11:51:00
// Description: Clear inFlightPromise before returning resolved syncNow result
// and always notify onUpdated when daily background sync settles (including
// offline/cached transitions) so snapshot ETag clears syncing=true in UI.
// ============================================================================
  function syncNow(observedModelIds = []) {
    if (!inFlightPromise) {
      inFlightPromise = executeSync(observedModelIds).finally(() => {
        inFlightPromise = null;
      });
    }
    return inFlightPromise.then((res) => {
      inFlightPromise = null;
      return {
        ...res,
        status: getPublicStatus(),
        runtimeCatalog: getRuntimeCatalog(observedModelIds),
      };
    });
  }

  function maybeTriggerDailySync(observedModelIds = [], onUpdated = null) {
    if (autoSyncDisabled || inFlightPromise) return false;
    const nowMs = nowFn();
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:44:00
// Description: Also trigger daily sync once if fxAttemptLocalDate is not yet
// today (e.g. upgrading from a cache created before FX sync existed).
// ============================================================================
    const todayLocal = formatLocalDate(nowMs);
    if (cache.lastSyncLocalDate === todayLocal && cache.fxAttemptLocalDate === todayLocal) {
      return false;
    }
// ============================================================================
// [MODIFIED END] 2026-11-17 15:44:00
// ============================================================================
    if (cache.lastAttemptAtMs !== null && nowMs - cache.lastAttemptAtMs < RETRY_COOLDOWN_MS) {
      return false;
    }

    syncNow(observedModelIds)
      .then((res) => {
        onUpdated?.(res);
      })
      .catch(() => {
        onUpdated?.({
          ok: false,
          updated: false,
          status: getPublicStatus(),
          runtimeCatalog: getRuntimeCatalog(observedModelIds),
        });
      });
    return true;
  }
// ============================================================================
// [MODIFIED END] 2026-11-17 11:51:00
// ============================================================================

  return {
    getPublicStatus,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 15:44:00
// Description: Export getSyncedCnyRate on pricingSync manager instance.
// ============================================================================
    getSyncedCnyRate,
// ============================================================================
// [MODIFIED END] 2026-11-17 15:44:00
// ============================================================================
    getRuntimeCatalog,
    syncNow,
    maybeTriggerDailySync,
  };
}

// ============================================================================
// [MODIFIED END] 2026-11-17 11:40:00
// ============================================================================
