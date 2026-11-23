// ============================================================================
// [MODIFIED BEGIN] 2026-11-17 18:55:00
// Description: Zero-dependency GitHub Release checker, ZIP builder/extractor
// with Zip-Slip & Zip-Bomb guards, SHA-256 integrity verification, and atomic
// hot-updater for agy-token-monitor v0.2.4.
// ============================================================================

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const DEFAULT_RELEASE_API_URL =
  'https://api.github.com/repos/JefferyL1ang/agy-token-monitor/releases/latest';
const DEFAULT_RELEASES_HTML_URL =
  'https://github.com/JefferyL1ang/agy-token-monitor/releases/latest';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:31
// Description: Add multi-channel release check & jsDelivr CDN fallback endpoints
// and raise check/download timeouts to accommodate slower cross-region links.
// ============================================================================
const DEFAULT_RELEASES_LATEST_WEB_URL =
  'https://github.com/JefferyL1ang/agy-token-monitor/releases/latest';
const DEFAULT_JSDELIVR_PKG_URL =
  'https://data.jsdelivr.com/v1/package/gh/JefferyL1ang/agy-token-monitor';
const DEFAULT_JSDELIVR_CDN_BASES = Object.freeze([
  'https://cdn.jsdelivr.net/gh/JefferyL1ang/agy-token-monitor',
  'https://fastly.jsdelivr.net/gh/JefferyL1ang/agy-token-monitor',
]);

const CACHE_SCHEMA_VERSION = 1;
const BOOT_SKIP_WINDOW_MS = 60 * 1000;
const AUTO_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const RETRY_COOLDOWN_MS = 15 * 60 * 1000;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Tune primary and fallback release check timeouts to 8s / 6s.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Raise primary and fallback release check timeouts to 12s / 8s.
// ============================================================================
const CHECK_TIMEOUT_MS = 12000;
const FALLBACK_CHECK_TIMEOUT_MS = 8000;
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
const DOWNLOAD_TIMEOUT_MS = 30000;
const CDN_FILE_TIMEOUT_MS = 15000;
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:31
// ============================================================================
const MAX_RELEASE_NOTES_CHARS = 24000;

const DEFAULT_ZIP_LIMITS = Object.freeze({
  maxZipBytes: 10 * 1024 * 1024,
  maxEntryBytes: 5 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  maxEntries: 128,
});

const ALLOWED_TOP_SEGMENTS = new Set([
  'plugin.json',
  'README.md',
  'assets',
  'skills',
  'sidecars',
  'scripts',
  'tests',
]);

const ALLOWED_TOP_FILES = new Set(['plugin.json', 'README.md']);

const ZIP_LOCAL_FILE_HEADER_SIG = 0x04034b50;
const ZIP_CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_DOS_DEFAULT_DATE = 0x0021; // 1980-01-01

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Parses a SemVer string or release tag (stripping leading `v`/`V`).
 * Returns `{ major, minor, patch, prerelease, raw }` or `null` if invalid.
 */
export function parseSemver(versionOrTag) {
  if (typeof versionOrTag !== 'string') return null;
  const trimmed = versionOrTag.trim();
  if (!trimmed) return null;
  const match = /^[vV]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(
    trimmed,
  );
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null;
  }

  let prerelease = [];
  if (match[4] !== undefined) {
    prerelease = match[4].split('.');
    if (prerelease.some((id) => id.length === 0)) return null;
  }

  const raw = `${major}.${minor}.${patch}${prerelease.length > 0 ? `-${prerelease.join('.')}` : ''}`;
  return { major, minor, patch, prerelease, raw };
}

/**
 * Compares two SemVer strings/tags according to SemVer 2.0.0 precedence.
 * Returns `1` if `a > b`, `0` if equal (or unparseable), and `-1` if `a < b`.
 */
export function compareSemver(a, b) {
  const pa =
    a && typeof a === 'object' && Number.isSafeInteger(a.major) ? a : parseSemver(a);
  const pb =
    b && typeof b === 'object' && Number.isSafeInteger(b.major) ? b : parseSemver(b);
  if (!pa || !pb) return 0;

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;

  const preA = pa.prerelease || [];
  const preB = pb.prerelease || [];
  if (preA.length === 0 && preB.length === 0) return 0;
  if (preA.length === 0) return 1;
  if (preB.length === 0) return -1;

  const len = Math.min(preA.length, preB.length);
  for (let i = 0; i < len; i++) {
    const idA = preA[i];
    const idB = preB[i];
    if (idA === idB) continue;
    const aNum = /^\d+$/.test(idA);
    const bNum = /^\d+$/.test(idB);
    if (aNum && bNum) {
      const na = Number(idA);
      const nb = Number(idB);
      if (na !== nb) return na > nb ? 1 : -1;
    } else if (aNum && !bNum) {
      return -1;
    } else if (!aNum && bNum) {
      return 1;
    } else {
      return idA > idB ? 1 : -1;
    }
  }

  if (preA.length !== preB.length) {
    return preA.length > preB.length ? 1 : -1;
  }
  return 0;
}

/**
 * Trims and lowercases a release tag, normalizing `'0.2.5'` or `'V0.2.5'` to `'v0.2.5'`
 * (and `''` -> `''`).
 */
export function normalizeReleaseTag(tag) {
  if (typeof tag !== 'string') return '';
  const trimmed = tag.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

/**
 * Builds a standard ZIP archive Buffer from `Array<{ name: string, data: Buffer | string, method?: 0 | 8 }>`.
 */
export function buildZipBuffer(entries) {
  if (!Array.isArray(entries)) {
    throw new Error('buildZipBuffer requires an array of entries.');
  }

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const item of entries) {
    if (!item || typeof item.name !== 'string' || !item.name) {
      throw new Error('Each ZIP entry must have a non-empty string name.');
    }
    const normName = item.name.replace(/\\/g, '/');
    const nameBuf = Buffer.from(normName, 'utf-8');
    const isDir = normName.endsWith('/');

    const rawBuf = isDir
      ? Buffer.alloc(0)
      : Buffer.isBuffer(item.data)
        ? item.data
        : typeof item.data === 'string'
          ? Buffer.from(item.data, 'utf-8')
          : item.data instanceof Uint8Array
            ? Buffer.from(item.data)
            : Buffer.alloc(0);

    const crc = crc32(rawBuf);
    const useStore = isDir || rawBuf.length === 0 || item.method === 0;
    const method = useStore ? 0 : 8;
    const compBuf = useStore ? rawBuf : deflateRawSync(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(ZIP_DOS_DEFAULT_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(ZIP_CENTRAL_DIR_HEADER_SIG, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(ZIP_DOS_DEFAULT_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(centralHeader, nameBuf);
    localOffset += localHeader.length + nameBuf.length + compBuf.length;
  }

  const centralDirSize = centralParts.reduce((sum, b) => sum + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(ZIP_EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function normalizeAndValidateZipEntryPath(rawName) {
  if (typeof rawName !== 'string' || !rawName) {
    throw new Error('Invalid empty ZIP entry path.');
  }
  if (rawName.includes('\0')) {
    throw new Error('Unsafe ZIP entry path: null byte.');
  }
  if (rawName.includes(':')) {
    throw new Error(`Unsafe ZIP entry path (drive/colon): ${rawName}`);
  }

  let norm = rawName.replace(/\\/g, '/');
  if (norm.startsWith('/')) {
    throw new Error(`Unsafe ZIP entry path (leading slash): ${rawName}`);
  }

  const isDir = norm.endsWith('/');
  const withoutTrailing = isDir ? norm.slice(0, -1) : norm;
  if (!withoutTrailing) {
    return null;
  }
  if (withoutTrailing.includes('//')) {
    throw new Error(`Unsafe ZIP entry path (empty segment): ${rawName}`);
  }

  const rawSegments = withoutTrailing.split('/');
  if (rawSegments.some((seg) => !seg || seg === '.' || seg === '..')) {
    throw new Error(`Unsafe ZIP entry path traversal: ${rawName}`);
  }

  let stripped = withoutTrailing;
  if (stripped === 'agy-token-monitor') {
    if (isDir) return null;
    throw new Error(`Disallowed root file entry: ${rawName}`);
  }
  if (stripped.startsWith('agy-token-monitor/')) {
    stripped = stripped.slice('agy-token-monitor/'.length);
  }
  if (!stripped) {
    return null;
  }

  const segments = stripped.split('/');
  const topSeg = segments[0];
  if (topSeg === '.git' || topSeg === 'sidecar_data' || !ALLOWED_TOP_SEGMENTS.has(topSeg)) {
    throw new Error(`Disallowed top-level ZIP segment: ${topSeg}`);
  }

  if (isDir) {
    if (ALLOWED_TOP_FILES.has(topSeg)) {
      throw new Error(`Invalid directory entry for file segment: ${topSeg}`);
    }
    return null;
  }

  if (ALLOWED_TOP_FILES.has(topSeg) && segments.length !== 1) {
    throw new Error(`Invalid nested path under top-level file segment: ${stripped}`);
  }
  if (!ALLOWED_TOP_FILES.has(topSeg) && segments.length < 2) {
    throw new Error(`Expected directory path for segment: ${stripped}`);
  }

  return stripped;
}

/**
 * Parses and validates a ZIP archive Buffer with Zip-Slip, Zip-Bomb, and CRC32 checks.
 * Returns `Array<{ relPath: string, data: Buffer }>`.
 */
export function parseZipBuffer(zipBuf, limits = {}) {
  const buf = Buffer.isBuffer(zipBuf)
    ? zipBuf
    : zipBuf instanceof Uint8Array
      ? Buffer.from(zipBuf)
      : null;
  if (!buf) {
    throw new Error('ZIP input must be a Buffer or Uint8Array.');
  }

  const maxZipBytes = limits?.maxZipBytes ?? DEFAULT_ZIP_LIMITS.maxZipBytes;
  const maxEntryBytes = limits?.maxEntryBytes ?? DEFAULT_ZIP_LIMITS.maxEntryBytes;
  const maxTotalBytes = limits?.maxTotalBytes ?? DEFAULT_ZIP_LIMITS.maxTotalBytes;
  const maxEntries = limits?.maxEntries ?? DEFAULT_ZIP_LIMITS.maxEntries;

  if (buf.length > maxZipBytes) {
    throw new Error(`ZIP archive size (${buf.length}) exceeds limit (${maxZipBytes}).`);
  }
  if (buf.length < 22) {
    throw new Error('Invalid or truncated ZIP archive.');
  }

  const minEocdOffset = Math.max(0, buf.length - 65557);
  let eocdOffset = -1;
  for (let off = buf.length - 22; off >= minEocdOffset; off--) {
    if (buf.readUInt32LE(off) === ZIP_EOCD_SIG) {
      const commentLen = buf.readUInt16LE(off + 20);
      if (off + 22 + commentLen === buf.length) {
        eocdOffset = off;
        break;
      }
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP archive: End of Central Directory not found.');
  }

  const diskNo = buf.readUInt16LE(eocdOffset + 4);
  const cdDiskNo = buf.readUInt16LE(eocdOffset + 6);
  const diskEntries = buf.readUInt16LE(eocdOffset + 8);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  if (diskNo !== 0 || cdDiskNo !== 0 || diskEntries !== totalEntries) {
    throw new Error('Multi-disk ZIP archives are not supported.');
  }
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported.');
  }
  if (totalEntries > maxEntries) {
    throw new Error(`ZIP entry count (${totalEntries}) exceeds limit (${maxEntries}).`);
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new Error('Invalid ZIP Central Directory bounds.');
  }

  const extracted = [];
  const seenRelPaths = new Set();
  let totalUncompressedBytes = 0;
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > cdEnd || buf.readUInt32LE(pos) !== ZIP_CENTRAL_DIR_HEADER_SIG) {
      throw new Error('Corrupt ZIP Central Directory header.');
    }

    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const expectedCrc = buf.readUInt32LE(pos + 16);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);

    const nextPos = pos + 46 + nameLen + extraLen + commentLen;
    if (nextPos > cdEnd) {
      throw new Error('Truncated ZIP Central Directory entry.');
    }

    if ((flags & 0x0001) !== 0) {
      throw new Error('Encrypted ZIP entries are not supported.');
    }
    if (compSize === 0xffffffff || uncompSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new Error('ZIP64 entry fields are not supported.');
    }

    const rawName = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf-8');
    pos = nextPos;

    const relPath = normalizeAndValidateZipEntryPath(rawName);
    if (relPath === null) {
      continue;
    }

    const dedupeKey = relPath.toLowerCase();
    if (seenRelPaths.has(dedupeKey)) {
      throw new Error(`Duplicate ZIP entry path: ${relPath}`);
    }
    seenRelPaths.add(dedupeKey);

    if (uncompSize > maxEntryBytes) {
      throw new Error(`ZIP entry ${relPath} size (${uncompSize}) exceeds maxEntryBytes (${maxEntryBytes}).`);
    }
    if (compSize > maxZipBytes) {
      throw new Error(`ZIP entry ${relPath} compressed size exceeds archive limit.`);
    }
    if (totalUncompressedBytes + uncompSize > maxTotalBytes) {
      throw new Error(`Total uncompressed ZIP bytes exceed limit (${maxTotalBytes}).`);
    }

    if (
      localHeaderOffset + 30 > cdOffset ||
      buf.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIG
    ) {
      throw new Error(`Invalid local file header for ${relPath}.`);
    }

    const localMethod = buf.readUInt16LE(localHeaderOffset + 8);
    if (localMethod !== method) {
      throw new Error(`Compression method mismatch for ${relPath}.`);
    }
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > cdOffset) {
      throw new Error(`Compressed payload out of bounds for ${relPath}.`);
    }

    const compSlice = buf.subarray(dataStart, dataEnd);
    let data;
    if (method === 0) {
      data = Buffer.from(compSlice);
    } else if (method === 8) {
      data = inflateRawSync(compSlice, { maxOutputLength: maxEntryBytes });
    } else {
      throw new Error(`Unsupported ZIP compression method (${method}) for ${relPath}.`);
    }

    if (data.length !== uncompSize) {
      throw new Error(
        `Uncompressed size mismatch for ${relPath}: expected ${uncompSize}, got ${data.length}.`,
      );
    }
    const actualCrc = crc32(data);
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC32 checksum mismatch for ${relPath}.`);
    }

    totalUncompressedBytes += data.length;
    extracted.push({ relPath, data });
  }

  return extracted;
}

function getHeaderValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || '';
  }
  if (typeof headers === 'object') {
    const target = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === target && typeof v === 'string') return v;
    }
  }
  return '';
}

function isLoopbackUrlPrefix(rawUrl) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(String(rawUrl || '').trim());
}

function isAllowedAssetUrl(rawUrl, allowLoopback) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  const proto = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  if (
    proto === 'https:' &&
    (host === 'github.com' ||
      host.endsWith('.github.com') ||
      host.endsWith('.githubusercontent.com'))
  ) {
    return true;
  }
  if (
    allowLoopback &&
    (proto === 'http:' || proto === 'https:') &&
    (host === '127.0.0.1' || host === 'localhost')
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:31
// Description: Unwrap fetch/undici errors into structured errorCode categories
// (timeout, rate_limit, http_error, network, unknown) and concise user messages,
// and extend cache schema with errorCode and checkSource fields.
// ============================================================================
/**
 * Unwraps nested fetch/undici errors into `{ errorCode, message }` with message <= 240 chars.
 */
export function classifyFetchError(err) {
  const name = typeof err?.name === 'string' ? err.name : '';
  const message =
    typeof err === 'string'
      ? err
      : typeof err?.message === 'string'
        ? err.message
        : '';
  const code = typeof err?.code === 'string' ? err.code : '';
  const firstInner = Array.isArray(err?.cause?.errors) ? err.cause.errors[0] : null;
  const causeName = typeof err?.cause?.name === 'string' ? err.cause.name : '';
  const causeCode =
    (typeof err?.cause?.code === 'string' && err.cause.code) ||
    (typeof firstInner?.code === 'string' && firstInner.code) ||
    '';
  const causeMessage =
    (typeof err?.cause?.message === 'string' && err.cause.message) ||
    (typeof firstInner?.message === 'string' && firstInner.message) ||
    '';
  const combined = [name, causeName, code, causeCode, message, causeMessage]
    .filter(Boolean)
    .join(' ');

  if (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    causeName === 'TimeoutError' ||
    causeName === 'AbortError' ||
    /aborted due to timeout|timed?\s*out|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT/i.test(
      combined,
    )
  ) {
    return {
      errorCode: 'timeout',
      message: 'The operation was aborted due to timeout',
    };
  }

  if (/HTTP\s*(?:403|429)|rate\s*limit/i.test(combined)) {
    return {
      errorCode: 'rate_limit',
      message: String(message || combined || 'HTTP rate limit').slice(0, 240),
    };
  }

  if (/Release check HTTP \d+|HTTP \d{3}/i.test(combined)) {
    return {
      errorCode: 'http_error',
      message: String(message || combined || 'HTTP error').slice(0, 240),
    };
  }

  if (
    /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|ECONNABORTED|EPIPE|CERT_|UNABLE_TO_VERIFY|ERR_TLS/i.test(
      combined,
    )
  ) {
    const effectiveCode = causeCode || code;
    const detail = causeMessage || message || 'fetch failed';
    return {
      errorCode: 'network',
      message: effectiveCode
        ? `Network error (${effectiveCode}): ${detail}`.slice(0, 240)
        : String(message || 'Network request failed').slice(0, 240),
    };
  }

  return {
    errorCode: 'unknown',
    message: String(message || 'Release check failed').slice(0, 240),
  };
}

function createEmptyCache() {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    etag: '',
    checkedFromVersion: '',
    lastCheckedAtMs: null,
    lastAttemptAtMs: null,
    latestTag: '',
    latestVersion: '',
    releaseName: '',
    publishedAt: '',
    htmlUrl: '',
    assetName: '',
    assetSize: 0,
    assetUrl: '',
    assetDigest: '',
    releaseNotes: '',
    error: '',
    errorCode: '',
    checkSource: '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Persist proxySummary diagnostics in update_cache.json schema.
// ============================================================================
    proxySummary: '',
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
  };
}

function loadUpdateCache(cachePath) {
  const fallback = createEmptyCache();
  if (!cachePath || !existsSync(cachePath)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8'));
    if (!raw || typeof raw !== 'object' || raw.schemaVersion !== CACHE_SCHEMA_VERSION) {
      return fallback;
    }
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      etag: typeof raw.etag === 'string' ? raw.etag : '',
      checkedFromVersion:
        typeof raw.checkedFromVersion === 'string' ? raw.checkedFromVersion : '',
      lastCheckedAtMs: Number.isFinite(raw.lastCheckedAtMs) ? Number(raw.lastCheckedAtMs) : null,
      lastAttemptAtMs: Number.isFinite(raw.lastAttemptAtMs) ? Number(raw.lastAttemptAtMs) : null,
      latestTag: typeof raw.latestTag === 'string' ? raw.latestTag : '',
      latestVersion: typeof raw.latestVersion === 'string' ? raw.latestVersion : '',
      releaseName: typeof raw.releaseName === 'string' ? raw.releaseName : '',
      publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : '',
      htmlUrl: typeof raw.htmlUrl === 'string' ? raw.htmlUrl : '',
      assetName: typeof raw.assetName === 'string' ? raw.assetName : '',
      assetSize: Number.isFinite(raw.assetSize) && raw.assetSize >= 0 ? Number(raw.assetSize) : 0,
      assetUrl: typeof raw.assetUrl === 'string' ? raw.assetUrl : '',
      assetDigest: typeof raw.assetDigest === 'string' ? raw.assetDigest : '',
      releaseNotes:
        typeof raw.releaseNotes === 'string'
          ? raw.releaseNotes.slice(0, MAX_RELEASE_NOTES_CHARS)
          : '',
      error: typeof raw.error === 'string' ? raw.error : '',
      errorCode: typeof raw.errorCode === 'string' ? raw.errorCode : '',
      checkSource: typeof raw.checkSource === 'string' ? raw.checkSource : '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Restore truncated proxySummary string from update_cache.json.
// ============================================================================
      proxySummary: typeof raw.proxySummary === 'string' ? raw.proxySummary.slice(0, 160) : '',
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
    };
  } catch {
    return fallback;
  }
}
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:31
// ============================================================================

function persistUpdateCache(stateDir, cachePath, cache) {
  if (!stateDir || !cachePath) return;
  const tmpPath = `${cachePath}.upd-${process.pid}.tmp`;
  try {
    mkdirSync(stateDir, { recursive: true });
    const serialized = JSON.stringify(cache, null, 2);
    writeFileSync(tmpPath, serialized, 'utf-8');
    try {
      renameSync(tmpPath, cachePath);
    } catch (renameErr) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup failure.
      }
      if (
        renameErr &&
        (renameErr.code === 'EPERM' || renameErr.code === 'EACCES' || renameErr.code === 'EBUSY')
      ) {
        writeFileSync(cachePath, serialized, 'utf-8');
      } else {
        throw renameErr;
      }
    }
  } catch {
    // Non-fatal cache write failure.
  }
}

/**
 * Creates a GitHub Release update checker and atomic hot-update installer.
 */
export function createReleaseUpdater(options = {}) {
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 11:42:30
// Description: Update default initialVersion fallback to 0.2.9, accept fallback
// channel URLs, and compute backward-compatible enableFallbackChannels flag.
// ============================================================================
  const {
    stateDir = '',
    pluginRoot = '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Bump default initialVersion fallback to 0.3.0 and accept proxy
// lifecycle hooks (beforeNetworkCheck, onTransportFailure, getProxyStatus).
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:22:00
// Description: Bump default initialVersion fallback to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:37:35
// Description: Bump default initialVersion fallback to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Bump default initialVersion fallback to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Bump default initialVersion fallback to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump default initialVersion fallback to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump default initialVersion fallback to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:31:22
// Description: Bump default initialVersion fallback to 0.5.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 21:53:10
// Description: Bump default initialVersion fallback to 0.5.3.
// ============================================================================
    currentVersion: initialVersion = '0.5.3',
// ============================================================================
// [MODIFIED END] 2026-11-23 21:53:10
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-23 10:31:22
// ============================================================================
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
// [MODIFIED END] 2026-11-18 16:22:00
// ============================================================================
    fetchImpl = globalThis.fetch,
    nowFn = Date.now,
    releaseApiUrl = process.env.RELEASE_UPDATE_API_URL || DEFAULT_RELEASE_API_URL,
    releaseWebLatestUrl = DEFAULT_RELEASES_LATEST_WEB_URL,
    jsdelivrPkgUrl = DEFAULT_JSDELIVR_PKG_URL,
    jsdelivrCdnBases = DEFAULT_JSDELIVR_CDN_BASES,
    allowGitRepoOverwrite = process.env.ALLOW_GIT_REPO_HOT_UPDATE === '1',
    autoCheckDisabled = process.env.RELEASE_UPDATE_DISABLE_AUTO === '1',
    allowLoopbackDownload = process.env.RELEASE_UPDATE_ALLOW_LOOPBACK === '1',
    beforeNetworkCheck = null,
    onTransportFailure = null,
    getProxyStatus = null,
  } = options || {};

  const enableFallbackChannels =
    options?.enableFallbackChannels !== undefined
      ? Boolean(options.enableFallbackChannels)
      : !options?.releaseApiUrl && !process.env.RELEASE_UPDATE_API_URL && !options?.fetchImpl;
  const normalizedJsdelivrPkgUrl =
    typeof jsdelivrPkgUrl === 'string' ? jsdelivrPkgUrl.trim().replace(/\/+$/, '') : '';
  const normalizedCdnBases = (
    Array.isArray(jsdelivrCdnBases) && jsdelivrCdnBases.length > 0
      ? jsdelivrCdnBases
      : DEFAULT_JSDELIVR_CDN_BASES
  )
    .map((u) => String(u || '').trim().replace(/\/+$/, ''))
    .filter(Boolean);

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:22:00
// Description: Bump initialVersion string fallback to 0.3.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:37:35
// Description: Bump initialVersion string fallback to 0.3.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Bump initialVersion string fallback to 0.4.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 20:21:11
// Description: Bump initialVersion string fallback to 0.4.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 10:38:48
// Description: Bump initialVersion string fallback to 0.5.0.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-20 15:55:43
// Description: Bump initialVersion string fallback to 0.5.1.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 10:31:22
// Description: Bump initialVersion string fallback to 0.5.2.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-23 21:53:10
// Description: Bump initialVersion string fallback to 0.5.3.
// ============================================================================
  let currentVersion =
    typeof initialVersion === 'string' && initialVersion.trim() ? initialVersion.trim() : '0.5.3';
// ============================================================================
// [MODIFIED END] 2026-11-23 21:53:10
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-23 10:31:22
// ============================================================================
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
// [MODIFIED END] 2026-11-18 16:22:00
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 11:42:30
// ============================================================================
  const effectiveAllowLoopback = Boolean(
    allowLoopbackDownload || isLoopbackUrlPrefix(releaseApiUrl),
  );

  const cachePath = stateDir ? join(stateDir, 'update_cache.json') : '';
  const cache = loadUpdateCache(cachePath);

  let hasCheckedSinceBoot = false;
  let checkPromise = null;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Track whether in-flight checkPromise is manual and compute proxy
// summary string from getProxyStatus hook.
// ============================================================================
  let checkPromiseIsManual = false;
  let applyPromise = null;

  function computeProxySummary() {
    try {
      const st = getProxyStatus?.();
      if (st && typeof st === 'object') {
        return st.enabled && st.proxyUrl
          ? `${st.source || 'proxy'}:${st.proxyUrl}`
          : st.source || 'direct';
      }
    } catch {
      // Ignore proxy status lookup errors.
    }
    return '';
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================

  function getFallbackUrl() {
    if (typeof cache.htmlUrl === 'string' && /^https?:\/\//i.test(cache.htmlUrl.trim())) {
      return cache.htmlUrl.trim();
    }
    return DEFAULT_RELEASES_HTML_URL;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:31
// Description: Expose errorCode and checkSource in getPublicStatus and implement
// 3-channel release check (github-api -> github-web -> jsdelivr) with structured
// error classification and conditional metadata preservation.
// ============================================================================
  function getPublicStatus(skippedReleaseTag = '') {
    const hasAsset = Boolean(cache.assetUrl);
    const hasUpdate = Boolean(
      cache.latestVersion && compareSemver(cache.latestVersion, currentVersion) > 0,
    );
    const isSkipped = Boolean(
      hasUpdate &&
        skippedReleaseTag &&
        normalizeReleaseTag(skippedReleaseTag) === normalizeReleaseTag(cache.latestTag),
    );
    const shouldPrompt = Boolean(hasUpdate && !isSkipped);

    return {
      currentVersion,
      latestTag: cache.latestTag || '',
      latestVersion: cache.latestVersion || '',
      releaseName: cache.releaseName || '',
      publishedAt: cache.publishedAt || '',
      htmlUrl: getFallbackUrl(),
      assetName: cache.assetName || '',
      assetSize: Number(cache.assetSize) || 0,
      hasAsset,
      hasUpdate,
      isSkipped,
      shouldPrompt,
      checking: Boolean(checkPromise),
      applying: Boolean(applyPromise),
      lastCheckedAtMs: Number.isFinite(cache.lastCheckedAtMs) ? cache.lastCheckedAtMs : null,
      error: cache.error || '',
      errorCode:
        cache.errorCode ||
        (cache.error ? classifyFetchError(new Error(cache.error)).errorCode : ''),
      checkSource: cache.checkSource || '',
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Expose cached or live proxySummary in getPublicStatus().
// ============================================================================
      proxySummary: cache.proxySummary || computeProxySummary(),
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
      releaseNotes: cache.releaseNotes || '',
    };
  }

  function applyFallbackTagMetadata(tagName, parsedVer, source, nowMs) {
    const sameTag = normalizeReleaseTag(cache.latestTag) === normalizeReleaseTag(tagName);
    if (!sameTag) {
      cache.releaseNotes = '';
      cache.publishedAt = '';
      cache.assetDigest = '';
      cache.assetSize = 0;
    }
    cache.etag = '';
    cache.checkedFromVersion = currentVersion;
    cache.lastCheckedAtMs = nowMs;
    cache.latestTag = tagName;
    cache.latestVersion = parsedVer.raw;
    cache.releaseName = tagName;
    cache.htmlUrl = `https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/${encodeURIComponent(tagName)}`;
    cache.assetName = `agy-token-monitor-${tagName}.zip`;
    cache.assetUrl = `https://github.com/JefferyL1ang/agy-token-monitor/releases/download/${encodeURIComponent(tagName)}/agy-token-monitor-${encodeURIComponent(tagName)}.zip`;
    cache.checkSource = source;
    cache.error = '';
    cache.errorCode = '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Record proxySummary when persisting fallback release metadata.
// ============================================================================
    cache.proxySummary = computeProxySummary();
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
    persistUpdateCache(stateDir, cachePath, cache);
    return { ok: true };
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Invoke beforeNetworkCheck, record proxySummary on all cache
// writes, trigger onTransportFailure before fallback channels on Channel 1
// timeout/network errors, and prevent background vs manual checkPromise race.
// ============================================================================
  async function executeCheck({ manual = false } = {}) {
    const nowMs = nowFn();
    cache.lastAttemptAtMs = nowMs;

    if (typeof fetchImpl !== 'function') {
      cache.error = 'fetch unavailable';
      cache.errorCode = 'unknown';
      cache.proxySummary = computeProxySummary();
      persistUpdateCache(stateDir, cachePath, cache);
      return { ok: false };
    }

    try {
      beforeNetworkCheck?.({ manual });
    } catch {
      // Ignore pre-check hook errors.
    }

    let primaryErr = null;
    try {
      const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': `agy-token-monitor/${currentVersion}`,
      };
      if (cache.etag) {
        headers['If-None-Match'] = cache.etag;
      }

      const res = await fetchImpl(releaseApiUrl, {
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        headers,
      });

      if (res && res.status === 304) {
        const respEtag = getHeaderValue(res.headers, 'etag');
        if (respEtag) cache.etag = respEtag;
        cache.lastCheckedAtMs = nowMs;
        cache.checkedFromVersion = currentVersion;
        cache.checkSource = 'github-api';
        cache.error = '';
        cache.errorCode = '';
        cache.proxySummary = computeProxySummary();
        persistUpdateCache(stateDir, cachePath, cache);
        return { ok: true };
      }

      if (!res || !res.ok) {
        throw new Error(`Release check HTTP ${res?.status || 'ERR'}`);
      }

      const json = await res.json();
      if (!json || typeof json !== 'object') {
        throw new Error('Invalid JSON payload from release endpoint.');
      }
      if (json.draft === true) {
        throw new Error('Latest release entry is marked as draft.');
      }

      const tagName = typeof json.tag_name === 'string' ? json.tag_name.trim() : '';
      const parsedVer = parseSemver(tagName);
      if (!tagName || !parsedVer) {
        throw new Error('Invalid or missing semver tag_name in release metadata.');
      }

      const assets = Array.isArray(json.assets) ? json.assets : [];
      const zipAssets = assets.filter(
        (a) =>
          a &&
          typeof a.name === 'string' &&
          /\.zip$/i.test(a.name.trim()) &&
          typeof a.browser_download_url === 'string' &&
          a.browser_download_url.trim().length > 0,
      );
      const selectedAsset =
        zipAssets.find((a) => /^agy-token-monitor.*\.zip$/i.test(a.name.trim())) ||
        zipAssets[0] ||
        null;

      const respEtag = getHeaderValue(res.headers, 'etag');
      cache.etag = respEtag || '';
      cache.checkedFromVersion = currentVersion;
      cache.lastCheckedAtMs = nowMs;
      cache.latestTag = tagName;
      cache.latestVersion = parsedVer.raw;
      cache.releaseName =
        typeof json.name === 'string' && json.name.trim() ? json.name.trim() : tagName;
      cache.publishedAt =
        typeof json.published_at === 'string' ? json.published_at.trim() : '';
      cache.htmlUrl =
        typeof json.html_url === 'string' && json.html_url.trim()
          ? json.html_url.trim()
          : `https://github.com/JefferyL1ang/agy-token-monitor/releases/tag/${encodeURIComponent(tagName)}`;
      cache.assetName = selectedAsset ? selectedAsset.name.trim() : '';
      cache.assetSize =
        selectedAsset && Number.isFinite(Number(selectedAsset.size)) && Number(selectedAsset.size) >= 0
          ? Number(selectedAsset.size)
          : 0;
      cache.assetUrl = selectedAsset ? selectedAsset.browser_download_url.trim() : '';
      cache.assetDigest =
        selectedAsset && typeof selectedAsset.digest === 'string'
          ? selectedAsset.digest.trim()
          : '';
      cache.releaseNotes =
        typeof json.body === 'string' ? json.body.slice(0, MAX_RELEASE_NOTES_CHARS) : '';
      cache.checkSource = 'github-api';
      cache.error = '';
      cache.errorCode = '';
      cache.proxySummary = computeProxySummary();

      persistUpdateCache(stateDir, cachePath, cache);
      return { ok: true };
    } catch (err) {
      primaryErr = err;
    }

    const prelim = classifyFetchError(primaryErr);
    if (
      enableFallbackChannels &&
      (prelim.errorCode === 'timeout' || prelim.errorCode === 'network')
    ) {
      try {
        onTransportFailure?.(prelim);
      } catch {
        // Ignore transport recovery hook errors.
      }
      cache.proxySummary = computeProxySummary();
    }

    if (enableFallbackChannels) {
      if (releaseWebLatestUrl) {
        try {
          const webRes = await fetchImpl(releaseWebLatestUrl, {
            redirect: 'manual',
            signal: AbortSignal.timeout(FALLBACK_CHECK_TIMEOUT_MS),
            headers: {
              'User-Agent': `agy-token-monitor/${currentVersion}`,
            },
          });
          if (webRes && webRes.status >= 200 && webRes.status < 400) {
            const loc = getHeaderValue(webRes.headers, 'location') || webRes.url || '';
            const tagMatch = /\/releases\/tag\/([^/?#]+)/i.exec(loc);
            if (tagMatch && tagMatch[1]) {
              const rawTag = decodeURIComponent(tagMatch[1]).trim();
              const parsed = parseSemver(rawTag);
              if (parsed) {
                return applyFallbackTagMetadata(
                  normalizeReleaseTag(parsed.raw),
                  parsed,
                  'github-web',
                  nowMs,
                );
              }
            }
          }
        } catch {
          // Fall through to Channel 3.
        }
      }

      if (normalizedJsdelivrPkgUrl) {
        try {
          const cdnPkgRes = await fetchImpl(normalizedJsdelivrPkgUrl, {
            signal: AbortSignal.timeout(FALLBACK_CHECK_TIMEOUT_MS),
            headers: {
              Accept: 'application/json',
              'User-Agent': `agy-token-monitor/${currentVersion}`,
            },
          });
          if (cdnPkgRes && cdnPkgRes.ok) {
            const pkgJson = await cdnPkgRes.json();
            const parsedVersions = (Array.isArray(pkgJson?.versions) ? pkgJson.versions : [])
              .map((v) => parseSemver(v))
              .filter(Boolean);
            if (parsedVersions.length > 0) {
              parsedVersions.sort((a, b) => compareSemver(b, a));
              const top = parsedVersions[0];
              return applyFallbackTagMetadata(
                normalizeReleaseTag(top.raw),
                top,
                'jsdelivr',
                nowMs,
              );
            }
          }
        } catch {
          // Fall through to failure classification.
        }
      }
    }

    cache.error = prelim.message;
    cache.errorCode = prelim.errorCode;
    cache.proxySummary = computeProxySummary();
    persistUpdateCache(stateDir, cachePath, cache);
    return { ok: false };
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:31
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Prevent manual checkForUpdatesNow({ manual: true }) from joining
// and stopping on a failing background check without retrying cleanly.
// ============================================================================
  async function checkForUpdatesNow({ manual = false } = {}) {
    hasCheckedSinceBoot = true;
    if (!checkPromise) {
      checkPromiseIsManual = Boolean(manual);
      const p = executeCheck({ manual: Boolean(manual) }).then(
        (res) => {
          if (checkPromise === p) {
            checkPromise = null;
            checkPromiseIsManual = false;
          }
          return res;
        },
        (err) => {
          if (checkPromise === p) {
            checkPromise = null;
            checkPromiseIsManual = false;
          }
          throw err;
        },
      );
      checkPromise = p;
      const res = await p;
      return {
        ok: Boolean(res?.ok),
        status: getPublicStatus(),
      };
    }

    const inFlight = checkPromise;
    const joinedManual = checkPromiseIsManual;
    const firstRes = await inFlight;
    if (checkPromise === inFlight) {
      checkPromise = null;
      checkPromiseIsManual = false;
    }
    if (!firstRes?.ok && manual && !joinedManual) {
      return checkForUpdatesNow({ manual: true });
    }
    return {
      ok: Boolean(firstRes?.ok),
      status: getPublicStatus(),
    };
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================

  function maybeCheckForUpdates(onUpdated = null) {
    if (autoCheckDisabled || checkPromise || applyPromise) return false;
    const nowMs = nowFn();
    let shouldTrigger = false;

    if (!hasCheckedSinceBoot) {
      hasCheckedSinceBoot = true;
      const recentlyCheckedSameVersion =
        Number.isFinite(cache.lastCheckedAtMs) &&
        nowMs - cache.lastCheckedAtMs >= 0 &&
        nowMs - cache.lastCheckedAtMs < BOOT_SKIP_WINDOW_MS &&
        cache.checkedFromVersion === currentVersion;
      if (!recentlyCheckedSameVersion) {
        shouldTrigger = true;
      }
    } else {
      if (
        Number.isFinite(cache.lastAttemptAtMs) &&
        nowMs - cache.lastAttemptAtMs >= 0 &&
        nowMs - cache.lastAttemptAtMs < RETRY_COOLDOWN_MS
      ) {
        return false;
      }
      const lastOkAge = Number.isFinite(cache.lastCheckedAtMs)
        ? nowMs - cache.lastCheckedAtMs
        : Infinity;
      if (lastOkAge >= AUTO_CHECK_INTERVAL_MS || Boolean(cache.error)) {
        shouldTrigger = true;
      }
    }

    if (!shouldTrigger) return false;

    checkForUpdatesNow()
      .then(() => {
        onUpdated?.();
      })
      .catch(() => {
        onUpdated?.();
      });
    return true;
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:31
// Description: Factor out validateAndWriteExtractedEntries helper and add
// SHA-256 verified jsDelivr CDN fallback in executeApply when primary ZIP
// download fails network/HTTP status (never falling back after 200 OK failure).
// ============================================================================
  async function fetchEntriesFromJsdelivrCdn(latestVersion, latestTag) {
    if (!normalizedJsdelivrPkgUrl || normalizedCdnBases.length === 0) {
      return {
        ok: false,
        reason: 'download_failed',
        error: 'jsDelivr CDN endpoints are not configured.',
      };
    }

    const candidateRefs = [];
    const strippedVer =
      typeof latestVersion === 'string' ? latestVersion.trim().replace(/^[vV]/, '') : '';
    const normTag = normalizeReleaseTag(latestTag || latestVersion);
    for (const ref of [strippedVer, normTag]) {
      if (ref && !candidateRefs.includes(ref)) {
        candidateRefs.push(ref);
      }
    }
    if (candidateRefs.length === 0) {
      return {
        ok: false,
        reason: 'download_failed',
        error: 'Missing target release ref for CDN fallback.',
      };
    }

    let selectedRef = '';
    let flatFiles = null;
    for (const ref of candidateRefs) {
      const flatUrl = `${normalizedJsdelivrPkgUrl}@${encodeURIComponent(ref)}/flat`;
      try {
        const res = await fetchImpl(flatUrl, {
          signal: AbortSignal.timeout(CDN_FILE_TIMEOUT_MS),
          headers: {
            Accept: 'application/json',
            'User-Agent': `agy-token-monitor/${currentVersion}`,
          },
        });
        if (!res || !res.ok) continue;
        const json = await res.json();
        if (json && Array.isArray(json.files)) {
          selectedRef = ref;
          flatFiles = json.files;
          break;
        }
      } catch {
        // Try next candidate ref.
      }
    }

    if (!flatFiles || !selectedRef) {
      return {
        ok: false,
        reason: 'download_failed',
        error: 'Failed to fetch jsDelivr file manifest.',
      };
    }

    const plannedFiles = [];
    const seenRelPaths = new Set();
    let declaredTotalBytes = 0;

    for (const f of flatFiles) {
      const rawName = typeof f?.name === 'string' ? f.name : '';
      const rawRel = rawName.startsWith('/') ? rawName.slice(1) : rawName;
      if (!rawRel) continue;

      const normSegments = rawRel.replace(/\\/g, '/').split('/');
      const isDotSegment = normSegments.some(
        (seg) => seg.length > 1 && seg.startsWith('.') && seg !== '..',
      );
      if (
        isDotSegment ||
        normSegments[0] === 'maintainer' ||
        normSegments[0] === 'tests'
      ) {
        continue;
      }

      let relPath;
      try {
        relPath = normalizeAndValidateZipEntryPath(rawRel);
      } catch (pathErr) {
        return {
          ok: false,
          reason: 'invalid_archive',
          error: pathErr?.message || `Unsafe CDN manifest path: ${rawRel}`,
        };
      }
      if (!relPath) continue;

      const dedupeKey = relPath.toLowerCase();
      if (seenRelPaths.has(dedupeKey)) {
        return {
          ok: false,
          reason: 'invalid_archive',
          error: `Duplicate CDN entry path: ${relPath}`,
        };
      }
      seenRelPaths.add(dedupeKey);

      const expectedHash = typeof f.hash === 'string' ? f.hash.trim() : '';
      if (!/^[A-Za-z0-9+/]{43}=$/.test(expectedHash)) {
        return {
          ok: false,
          reason: 'integrity_failed',
          error: `Invalid or missing SHA-256 hash in CDN manifest for ${relPath}`,
        };
      }

      if (f.size !== undefined && f.size !== null) {
        const sizeNum = Number(f.size);
        if (!Number.isFinite(sizeNum) || sizeNum < 0 || sizeNum > DEFAULT_ZIP_LIMITS.maxEntryBytes) {
          return {
            ok: false,
            reason: 'invalid_archive',
            error: `CDN entry ${relPath} size (${f.size}) exceeds maxEntryBytes (${DEFAULT_ZIP_LIMITS.maxEntryBytes}).`,
          };
        }
        declaredTotalBytes += sizeNum;
        if (declaredTotalBytes > DEFAULT_ZIP_LIMITS.maxTotalBytes) {
          return {
            ok: false,
            reason: 'invalid_archive',
            error: `Total CDN manifest bytes exceed limit (${DEFAULT_ZIP_LIMITS.maxTotalBytes}).`,
          };
        }
      }

      plannedFiles.push({ relPath, expectedHash });
      if (plannedFiles.length > DEFAULT_ZIP_LIMITS.maxEntries) {
        return {
          ok: false,
          reason: 'invalid_archive',
          error: `CDN entry count exceeds limit (${DEFAULT_ZIP_LIMITS.maxEntries}).`,
        };
      }
    }

    if (!plannedFiles.some((item) => item.relPath === 'plugin.json')) {
      return {
        ok: false,
        reason: 'invalid_manifest',
        error: 'CDN manifest is missing plugin.json.',
      };
    }
    if (!plannedFiles.some((item) => item.relPath === 'sidecars/monitor_pane/main.mjs')) {
      return {
        ok: false,
        reason: 'invalid_archive',
        error: 'CDN manifest is missing sidecars/monitor_pane/main.mjs.',
      };
    }

    const entries = new Array(plannedFiles.length);
    let nextIdx = 0;
    let totalDownloadedBytes = 0;
    let abortedError = null;
    const workerCount = Math.min(4, plannedFiles.length);

    async function downloadWorker() {
      while (!abortedError) {
        const idx = nextIdx++;
        if (idx >= plannedFiles.length) break;
        const item = plannedFiles[idx];
        const encodedRelPath = item.relPath.split('/').map(encodeURIComponent).join('/');
        let downloaded = false;

        for (const base of normalizedCdnBases) {
          if (abortedError) break;
          const fileUrl = `${base}@${encodeURIComponent(selectedRef)}/${encodedRelPath}`;
          let fileRes = null;
          try {
            fileRes = await fetchImpl(fileUrl, {
              signal: AbortSignal.timeout(CDN_FILE_TIMEOUT_MS),
              headers: {
                'User-Agent': `agy-token-monitor/${currentVersion}`,
              },
            });
          } catch {
            continue;
          }
          if (!fileRes || !fileRes.ok) {
            continue;
          }

          const contentLenStr = getHeaderValue(fileRes.headers, 'content-length');
          if (contentLenStr && Number(contentLenStr) > DEFAULT_ZIP_LIMITS.maxEntryBytes) {
            abortedError = {
              ok: false,
              reason: 'invalid_archive',
              error: `CDN entry ${item.relPath} exceeds maxEntryBytes (${DEFAULT_ZIP_LIMITS.maxEntryBytes}).`,
            };
            break;
          }

          let buf;
          try {
            buf = Buffer.from(await fileRes.arrayBuffer());
          } catch {
            continue;
          }

          if (buf.length > DEFAULT_ZIP_LIMITS.maxEntryBytes) {
            abortedError = {
              ok: false,
              reason: 'invalid_archive',
              error: `CDN entry ${item.relPath} size (${buf.length}) exceeds maxEntryBytes (${DEFAULT_ZIP_LIMITS.maxEntryBytes}).`,
            };
            break;
          }
          if (totalDownloadedBytes + buf.length > DEFAULT_ZIP_LIMITS.maxTotalBytes) {
            abortedError = {
              ok: false,
              reason: 'invalid_archive',
              error: `Total downloaded CDN bytes exceed limit (${DEFAULT_ZIP_LIMITS.maxTotalBytes}).`,
            };
            break;
          }
          totalDownloadedBytes += buf.length;

          const actualHash = createHash('sha256').update(buf).digest('base64');
          if (actualHash !== item.expectedHash) {
            abortedError = {
              ok: false,
              reason: 'integrity_failed',
              error: `CDN file SHA-256 mismatch for ${item.relPath}`,
            };
            break;
          }

          entries[idx] = { relPath: item.relPath, data: buf };
          downloaded = true;
          break;
        }

        if (!downloaded && !abortedError) {
          abortedError = {
            ok: false,
            reason: 'download_failed',
            error: `Failed to download CDN file ${item.relPath}`,
          };
          break;
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => downloadWorker()));
    if (abortedError) {
      return abortedError;
    }

    return { ok: true, entries };
  }

  function validateAndWriteExtractedEntries(entries) {
    const fallbackUrl = getFallbackUrl();
    const manifestEntry = entries.find((e) => e.relPath === 'plugin.json');
    if (!manifestEntry) {
      return {
        ok: false,
        reason: 'invalid_manifest',
        error: 'Archive is missing plugin.json.',
        fallbackUrl,
      };
    }

    let manifest;
    try {
      manifest = JSON.parse(manifestEntry.data.toString('utf-8'));
    } catch {
      return {
        ok: false,
        reason: 'invalid_manifest',
        error: 'Archive plugin.json is not valid JSON.',
        fallbackUrl,
      };
    }

    if (!manifest || manifest.name !== 'agy-token-monitor') {
      return {
        ok: false,
        reason: 'invalid_manifest',
        error: 'Archive plugin.json name must be agy-token-monitor.',
        fallbackUrl,
      };
    }

    const manifestSemver = parseSemver(manifest.version);
    if (!manifestSemver || compareSemver(manifestSemver, currentVersion) <= 0) {
      return {
        ok: false,
        reason: 'downgrade_rejected',
        error: `Archive version (${manifest?.version || 'unknown'}) must be newer than ${currentVersion}.`,
        fallbackUrl,
      };
    }

    const mainEntry = entries.find((e) => e.relPath === 'sidecars/monitor_pane/main.mjs');
    if (!mainEntry || mainEntry.data.length === 0) {
      return {
        ok: false,
        reason: 'invalid_archive',
        error: 'Archive is missing sidecars/monitor_pane/main.mjs.',
        fallbackUrl,
      };
    }

    const resolvedRoot = resolve(pluginRoot);
    const rootPrefix =
      process.platform === 'win32'
        ? `${resolvedRoot.toLowerCase()}${sep}`
        : `${resolvedRoot}${sep}`;

    const sortedEntries = [...entries].sort((a, b) => {
      const aLast = a.relPath === 'sidecars/monitor_pane/main.mjs' ? 1 : 0;
      const bLast = b.relPath === 'sidecars/monitor_pane/main.mjs' ? 1 : 0;
      return aLast - bLast;
    });

    let writeSeq = 0;
    for (const entry of sortedEntries) {
      const destPath = resolve(resolvedRoot, ...entry.relPath.split('/'));
      const normDest = process.platform === 'win32' ? destPath.toLowerCase() : destPath;
      if (!normDest.startsWith(rootPrefix)) {
        throw new Error(`Refusing to write outside pluginRoot: ${entry.relPath}`);
      }

      mkdirSync(dirname(destPath), { recursive: true });
      const tmpPath = `${destPath}.upd-${process.pid}-${writeSeq++}.tmp`;
      try {
        writeFileSync(tmpPath, entry.data);
        renameSync(tmpPath, destPath);
      } catch (writeErr) {
        try {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        } catch {
          // Ignore temp cleanup failure.
        }
        if (
          writeErr &&
          (writeErr.code === 'EPERM' ||
            writeErr.code === 'EACCES' ||
            writeErr.code === 'EBUSY')
        ) {
          writeFileSync(destPath, entry.data);
        } else {
          throw writeErr;
        }
      }
    }

    const targetVersion = manifestSemver.raw;
    const targetTag = cache.latestTag || normalizeReleaseTag(targetVersion);
    currentVersion = targetVersion;
    cache.checkedFromVersion = currentVersion;
    cache.error = '';
    cache.errorCode = '';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Record proxySummary when persisting successful apply cache state.
// ============================================================================
    cache.proxySummary = computeProxySummary();
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
    persistUpdateCache(stateDir, cachePath, cache);

    return {
      ok: true,
      targetVersion,
      targetTag,
      filesWritten: sortedEntries.length,
      restarting: true,
    };
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:31
// ============================================================================

  async function executeApply() {
    try {
      if (cache.lastCheckedAtMs === null && !cache.latestVersion) {
        await checkForUpdatesNow();
      }

      const fallbackUrl = getFallbackUrl();
      const hasUpdate = Boolean(
        cache.latestVersion && compareSemver(cache.latestVersion, currentVersion) > 0,
      );
      if (!hasUpdate) {
        return {
          ok: false,
          reason: 'up_to_date',
          error: 'Already on the latest version.',
          fallbackUrl,
        };
      }

      if (!cache.assetUrl) {
        return {
          ok: false,
          reason: 'no_asset',
          error: 'Release archive asset not found.',
          fallbackUrl,
        };
      }

      if (!pluginRoot) {
        return {
          ok: false,
          reason: 'missing_plugin_root',
          error: 'Plugin root directory is not configured.',
          fallbackUrl,
        };
      }

      if (existsSync(join(pluginRoot, '.git')) && !allowGitRepoOverwrite) {
        return {
          ok: false,
          reason: 'git_repo',
          error: 'Running inside a Git working tree; auto-overwrite disabled.',
          fallbackUrl,
        };
      }

      if (!isAllowedAssetUrl(cache.assetUrl, effectiveAllowLoopback)) {
        return {
          ok: false,
          reason: 'unsafe_asset_url',
          error: 'Untrusted release asset download URL.',
          fallbackUrl,
        };
      }

      if (cache.assetSize > DEFAULT_ZIP_LIMITS.maxZipBytes) {
        return {
          ok: false,
          reason: 'asset_too_large',
          error: 'Release archive exceeds 10 MB limit.',
          fallbackUrl,
        };
      }

      if (typeof fetchImpl !== 'function') {
        return {
          ok: false,
          reason: 'network_error',
          error: 'fetch implementation is unavailable.',
          fallbackUrl,
        };
      }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:23:31
// Description: Attempt jsDelivr SHA-256 verified CDN fallback ONLY when primary
// ZIP fetch throws or returns !res.ok and enableFallbackChannels is active;
// preserve strict failure on any 200 OK ZIP integrity/manifest check and
// clear/classify errorCode cleanly.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Invoke beforeNetworkCheck({ manual: true }) before hot-update
// download and trigger onTransportFailure before jsDelivr CDN fallback on
// primary ZIP timeout/network failures.
// ============================================================================
      try {
        beforeNetworkCheck?.({ manual: true });
      } catch {
        // Ignore pre-download hook errors.
      }

      let res = null;
      let primaryFetchErr = null;
      try {
        res = await fetchImpl(cache.assetUrl, {
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
          headers: {
            Accept: 'application/octet-stream, application/zip, */*',
            'User-Agent': `agy-token-monitor/${currentVersion}`,
          },
        });
      } catch (fetchErr) {
        primaryFetchErr = fetchErr;
      }

      if (!res || !res.ok) {
        if (enableFallbackChannels && (cache.latestVersion || cache.latestTag)) {
          if (primaryFetchErr) {
            const prelim = classifyFetchError(primaryFetchErr);
            if (prelim.errorCode === 'timeout' || prelim.errorCode === 'network') {
              try {
                onTransportFailure?.(prelim);
              } catch {
                // Ignore transport recovery hook errors.
              }
              cache.proxySummary = computeProxySummary();
            }
          }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
          const cdnResult = await fetchEntriesFromJsdelivrCdn(
            cache.latestVersion,
            cache.latestTag,
          );
          if (cdnResult.ok) {
            return validateAndWriteExtractedEntries(cdnResult.entries);
          }
          if (cdnResult.reason === 'integrity_failed') {
            return {
              ok: false,
              reason: 'integrity_failed',
              error: cdnResult.error,
              fallbackUrl,
            };
          }
          const fallbackErrMsg =
            cdnResult.error ||
            (primaryFetchErr
              ? classifyFetchError(primaryFetchErr).message
              : `Failed to download release archive (HTTP ${res?.status || 'ERR'}).`);
          return {
            ok: false,
            reason: cdnResult.reason || 'download_failed',
            error: fallbackErrMsg,
            fallbackUrl,
          };
        }
        if (primaryFetchErr) {
          throw primaryFetchErr;
        }
        return {
          ok: false,
          reason: 'download_failed',
          error: `Failed to download release archive (HTTP ${res?.status || 'ERR'}).`,
          fallbackUrl,
        };
      }

      if (typeof res.url === 'string' && res.url.trim()) {
        if (!isAllowedAssetUrl(res.url, effectiveAllowLoopback)) {
          return {
            ok: false,
            reason: 'unsafe_asset_url',
            error: 'Redirected to an untrusted release asset host.',
            fallbackUrl,
          };
        }
      }

      const contentLenStr = getHeaderValue(res.headers, 'content-length');
      if (contentLenStr && Number(contentLenStr) > DEFAULT_ZIP_LIMITS.maxZipBytes) {
        return {
          ok: false,
          reason: 'asset_too_large',
          error: 'Release archive exceeds 10 MB limit.',
          fallbackUrl,
        };
      }

      const zipBuf = Buffer.from(await res.arrayBuffer());
      if (zipBuf.length === 0 || zipBuf.length > DEFAULT_ZIP_LIMITS.maxZipBytes) {
        return {
          ok: false,
          reason: 'invalid_archive',
          error: 'Downloaded archive is empty or exceeds 10 MB limit.',
          fallbackUrl,
        };
      }

      if (cache.assetDigest) {
        const digestMatch = /^sha256:([0-9a-f]{64})$/i.exec(cache.assetDigest.trim());
        if (!digestMatch) {
          return {
            ok: false,
            reason: 'integrity_failed',
            error: 'Invalid SHA-256 digest format in release metadata.',
            fallbackUrl,
          };
        }
        const expectedHex = digestMatch[1].toLowerCase();
        const actualHex = createHash('sha256').update(zipBuf).digest('hex').toLowerCase();
        if (actualHex !== expectedHex) {
          return {
            ok: false,
            reason: 'integrity_failed',
            error: 'SHA-256 digest mismatch.',
            fallbackUrl,
          };
        }
      }

      let entries;
      try {
        entries = parseZipBuffer(zipBuf, DEFAULT_ZIP_LIMITS);
      } catch (zipErr) {
        return {
          ok: false,
          reason: 'invalid_archive',
          error: zipErr?.message || 'Invalid ZIP archive.',
          fallbackUrl,
        };
      }

      return validateAndWriteExtractedEntries(entries);
    } catch (err) {
      const fallbackUrl = getFallbackUrl();
      const classified = classifyFetchError(err);
      const errMsg = err?.message || classified.message || 'Failed to apply release update.';
      cache.error = classified.message || errMsg.slice(0, 240);
      cache.errorCode = classified.errorCode;
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:03
// Description: Record proxySummary when persisting apply failure cache state.
// ============================================================================
      cache.proxySummary = computeProxySummary();
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:03
// ============================================================================
      persistUpdateCache(stateDir, cachePath, cache);
      return {
        ok: false,
        reason: err?.reason || 'apply_failed',
        error: errMsg,
        fallbackUrl,
      };
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 10:23:31
// ============================================================================

  function applyLatestUpdate() {
    if (applyPromise) {
      return Promise.resolve({
        ok: false,
        reason: 'already_applying',
        error: 'An update is already in progress.',
        fallbackUrl: getFallbackUrl(),
      });
    }
    const p = executeApply().finally(() => {
      if (applyPromise === p) applyPromise = null;
    });
    applyPromise = p;
    return p.then((res) => {
      applyPromise = null;
      return res;
    });
  }

  return {
    getPublicStatus,
    maybeCheckForUpdates,
    checkForUpdatesNow,
    applyLatestUpdate,
  };
}

// ============================================================================
// [MODIFIED END] 2026-11-17 18:55:00
// ============================================================================
