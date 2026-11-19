// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:22:38
// Description: Zero-dependency OS and environment HTTP(S) proxy auto-detection
// and Node global proxy dispatcher manager for pricing sync and release checks.
// ============================================================================

import http from 'node:http';
import { execFileSync } from 'node:child_process';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:51
// Description: Import join from node:path for Windows System32 reg.exe fallback lookup.
// ============================================================================
import { join } from 'node:path';
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:51
// ============================================================================

export const LOOPBACK_NO_PROXY = '127.0.0.1,localhost,::1';
// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:51
// Description: Export default 15-minute max dispatcher age threshold for proxy pool rebuilds.
// ============================================================================
export const DEFAULT_MAX_DISPATCHER_AGE_MS = 15 * 60 * 1000;
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:51
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Export DEFAULT_OS_LOOKUP_TIMEOUT_MS (4000ms) and isTransientLookupError()
// to distinguish transient OS/process failures from normal non-zero exits.
// ============================================================================
export const DEFAULT_OS_LOOKUP_TIMEOUT_MS = 4000;

const TRANSIENT_LOOKUP_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'EAGAIN',
  'ENOMEM',
  'ENOBUFS',
  'ENOENT',
]);

function normalizeLookupTimeoutMs(lookupTimeoutMs) {
  const n = Number(lookupTimeoutMs);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_OS_LOOKUP_TIMEOUT_MS;
}

/**
 * Return true only for transient OS/process failures (timeouts, resource exhaustion,
 * missing binary, or killed/signaled process), never normal non-zero exit statuses.
 */
export function isTransientLookupError(err) {
  if (!err || typeof err !== 'object') return false;
  if (
    typeof err.code === 'string' &&
    TRANSIENT_LOOKUP_ERROR_CODES.has(err.code.toUpperCase())
  ) {
    return true;
  }
  if (err.killed === true) return true;
  if (Boolean(err.signal)) return true;
  return false;
}
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================

const UNSUPPORTED_PROXY_SCHEME_RE =
  /^(?:socks4a?|socks5h?|socks|pac(?:\+[a-z0-9.+-]+)?|ftp|ws|wss):\/\//i;
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normalize an HTTP/HTTPS proxy endpoint string into a clean URL without trailing slash.
 * Rejects unsupported schemes such as socks5:// or pac+http://.
 */
export function normalizeHttpProxyUrl(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!trimmed) return '';
  if (UNSUPPORTED_PROXY_SCHEME_RE.test(trimmed)) return '';

  const candidate = HAS_SCHEME_RE.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '';
  }
  if (!parsed.hostname || !parsed.host) {
    return '';
  }
  if (parsed.port) {
    const portNum = Number(parsed.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return '';
    }
  }

  let authPart = '';
  if (parsed.username || parsed.password) {
    authPart = parsed.password
      ? `${parsed.username}:${parsed.password}@`
      : `${parsed.username}@`;
  }
  return `${parsed.protocol}//${authPart}${parsed.host}`;
}

/**
 * Return a safe display URL with any embedded proxy credentials masked as ***.
 */
export function redactProxyUrl(rawUrl) {
  const normalized = normalizeHttpProxyUrl(rawUrl);
  if (!normalized) return '';
  try {
    const u = new URL(normalized);
    if (u.username || u.password) {
      return `${u.protocol}//***@${u.host}`;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

/**
 * Expand <local>, deduplicate NO_PROXY entries preserving order, and guarantee
 * loopback addresses remain bypassed so local sidecar/LS calls never traverse a proxy.
 */
export function ensureLoopbackNoProxy(rawNoProxy) {
  const text = typeof rawNoProxy === 'string' ? rawNoProxy : '';
  const expanded = text.replace(/<local>/gi, 'localhost,127.0.0.1,::1');
  const seen = new Set();
  const items = [];

  for (const rawItem of expanded.split(/[;,\s]+/)) {
    const item = rawItem.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  for (const required of ['127.0.0.1', 'localhost', '::1']) {
    const key = required.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(required);
    }
  }

  return items.join(',');
}

/**
 * Parse `reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings"` stdout.
 */
export function parseWindowsRegProxyOutput(stdout) {
  if (typeof stdout !== 'string' || !stdout) {
    return {
      enabled: false,
      httpProxy: '',
      httpsProxy: '',
      noProxy: LOOPBACK_NO_PROXY,
    };
  }

  const enableMatch = stdout.match(
    /^\s*ProxyEnable\s+REG_DWORD\s+(0x[0-9a-fA-F]+|\d+)/mi,
  );
  if (!enableMatch || Number(enableMatch[1]) === 0) {
    return {
      enabled: false,
      httpProxy: '',
      httpsProxy: '',
      noProxy: LOOPBACK_NO_PROXY,
    };
  }

  const overrideMatch = stdout.match(/^\s*ProxyOverride\s+REG_SZ\s+([^\r\n]+)/mi);
  const noProxy = ensureLoopbackNoProxy(overrideMatch ? overrideMatch[1] : '');

  const serverMatch = stdout.match(/^\s*ProxyServer\s+REG_SZ\s+([^\r\n]+)/mi);
  const rawServer = serverMatch ? serverMatch[1].trim() : '';
  if (!rawServer) {
    return {
      enabled: false,
      httpProxy: '',
      httpsProxy: '',
      noProxy,
    };
  }

  let httpProxy = '';
  let httpsProxy = '';

  if (rawServer.includes('=')) {
    const map = {};
    for (const part of rawServer.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const scheme = trimmed.slice(0, eqIdx).trim().toLowerCase();
      const endpoint = trimmed.slice(eqIdx + 1).trim();
      if ((scheme === 'http' || scheme === 'https' || scheme === 'all') && endpoint) {
        map[scheme] = endpoint;
      }
    }
    httpProxy = normalizeHttpProxyUrl(map.http || map.all || '');
    httpsProxy = normalizeHttpProxyUrl(map.https || map.http || map.all || '');
  } else {
    httpProxy = normalizeHttpProxyUrl(rawServer);
    httpsProxy = httpProxy;
  }

  if (!httpProxy && !httpsProxy) {
    return {
      enabled: false,
      httpProxy: '',
      httpsProxy: '',
      noProxy,
    };
  }

  return {
    enabled: true,
    httpProxy: httpProxy || httpsProxy,
    httpsProxy: httpsProxy || httpProxy,
    noProxy,
  };
}

function buildScutilEndpoint(hostRaw, portRaw) {
  const host = typeof hostRaw === 'string' ? hostRaw.trim() : '';
  if (!host) return '';
  const port = typeof portRaw === 'string' ? portRaw.trim() : '';
  const isBareIpv6 =
    host.includes(':') &&
    !host.startsWith('[') &&
    !HAS_SCHEME_RE.test(host) &&
    host.indexOf(':') !== host.lastIndexOf(':');
  const formattedHost = isBareIpv6 ? `[${host}]` : host;
  const endpoint = `${formattedHost}${port && port !== '0' ? `:${port}` : ''}`;
  return normalizeHttpProxyUrl(endpoint);
}

/**
 * Parse macOS `scutil --proxy` output into normalized HTTP/HTTPS proxy settings.
 */
export function parseMacScutilProxyOutput(stdout) {
  if (typeof stdout !== 'string' || !stdout) {
    return {
      enabled: false,
      httpProxy: '',
      httpsProxy: '',
      noProxy: LOOPBACK_NO_PROXY,
    };
  }

  const kv = {};
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const [, key, val] = m;
    if (/^(?:<[^>]+>\s*)?\{$/i.test(val)) continue;
    kv[key] = val;
  }

  const exceptionsMatch = stdout.match(/ExceptionsList(?:\s*:\s*<array>)?\s*\{([\s\S]*?)\}/i);
  const exceptionItems = [];
  if (exceptionsMatch) {
    for (const line of exceptionsMatch[1].split(/\r?\n/)) {
      const m = line.match(/^\s*\d+\s*:\s*(.+?)\s*$/);
      if (m && m[1]) {
        exceptionItems.push(m[1].trim());
      }
    }
  }
  const noProxy = ensureLoopbackNoProxy(exceptionItems.join(','));

  const httpProxy =
    kv.HTTPEnable === '1' && kv.HTTPProxy
      ? buildScutilEndpoint(kv.HTTPProxy, kv.HTTPPort)
      : '';
  const httpsProxy =
    kv.HTTPSEnable === '1' && kv.HTTPSProxy
      ? buildScutilEndpoint(kv.HTTPSProxy, kv.HTTPSPort)
      : '';

  return {
    enabled: Boolean(httpProxy || httpsProxy),
    httpProxy: httpProxy || httpsProxy,
    httpsProxy: httpsProxy || httpProxy,
    noProxy,
  };
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:51
// Description: Add parseWindowsUserEnvProxyOutput, resilient Windows reg.exe
// query helper with System32 fallback, and resolveLiveOsSystemProxy helper.
// ============================================================================
/**
 * Parse `reg.exe query HKCU\Environment` stdout into normalized HTTP/HTTPS proxy settings.
 */
export function parseWindowsUserEnvProxyOutput(stdout) {
  if (typeof stdout !== 'string' || !stdout) {
    return {
      enabled: false,
      httpProxy: '',
      httpsProxy: '',
      noProxy: LOOPBACK_NO_PROXY,
    };
  }

  const exactVars = Object.create(null);
  const lowerVars = Object.create(null);
  const lineRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/;
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(lineRe);
    if (!match) continue;
    const name = match[1];
    const value = match[2].trim();
    if (!value) continue;
    exactVars[name] = value;
    const lowerName = name.toLowerCase();
    if (!(lowerName in lowerVars)) {
      lowerVars[lowerName] = value;
    }
  }

  const pickVar = (upperName) => {
    const lowerName = upperName.toLowerCase();
    return exactVars[upperName] || exactVars[lowerName] || lowerVars[lowerName] || '';
  };

  const noProxy = ensureLoopbackNoProxy(pickVar('NO_PROXY'));
  const custom = normalizeHttpProxyUrl(pickVar('AGY_TOKEN_MONITOR_PROXY'));
  if (custom) {
    return {
      enabled: true,
      httpProxy: custom,
      httpsProxy: custom,
      noProxy,
    };
  }

  const envHttps = normalizeHttpProxyUrl(pickVar('HTTPS_PROXY'));
  const envHttp = normalizeHttpProxyUrl(pickVar('HTTP_PROXY'));
  const envAll = normalizeHttpProxyUrl(pickVar('ALL_PROXY'));
  const httpProxy = envHttp || envAll;
  const httpsProxy = envHttps || envAll;

  if (httpProxy || httpsProxy) {
    return {
      enabled: true,
      httpProxy: httpProxy || httpsProxy,
      httpsProxy: httpsProxy || httpProxy,
      noProxy,
    };
  }

  return {
    enabled: false,
    httpProxy: '',
    httpsProxy: '',
    noProxy,
  };
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Add configurable lookupTimeoutMs (default 4000ms), detailed live OS
// probe status, and transient lookup error propagation in resolveProxyConfig.
// ============================================================================
/**
 * Query a Windows registry key via reg.exe, retrying via System32\reg.exe on ENOENT.
 */
function queryWindowsRegistryKey(
  execFileSyncImpl,
  regKeyPath,
  safeEnv,
  lookupTimeoutMs = DEFAULT_OS_LOOKUP_TIMEOUT_MS,
) {
  const execOpts = {
    encoding: 'utf-8',
    timeout: normalizeLookupTimeoutMs(lookupTimeoutMs),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  };
  try {
    return execFileSyncImpl('reg.exe', ['query', regKeyPath], execOpts);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      const systemRoot =
        typeof safeEnv?.SystemRoot === 'string' && safeEnv.SystemRoot.trim()
          ? safeEnv.SystemRoot.trim()
          : 'C:\\Windows';
      return execFileSyncImpl(
        join(systemRoot, 'System32', 'reg.exe'),
        ['query', regKeyPath],
        execOpts,
      );
    }
    throw err;
  }
}

/**
 * Resolve live OS-level system proxy settings with transient lookup failure detail.
 */
function resolveLiveOsSystemProxyDetailed({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  lookupTimeoutMs = DEFAULT_OS_LOOKUP_TIMEOUT_MS,
} = {}) {
  const safeEnv = env || {};
  const baseNoProxy = ensureLoopbackNoProxy(safeEnv.NO_PROXY || safeEnv.no_proxy || '');
  const timeoutMs = normalizeLookupTimeoutMs(lookupTimeoutMs);

  if (platform === 'win32') {
    try {
      const stdout = queryWindowsRegistryKey(
        execFileSyncImpl,
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        safeEnv,
        timeoutMs,
      );
      const parsed = parseWindowsRegProxyOutput(stdout);
      if (parsed.enabled) {
        return {
          proxy: {
            ...parsed,
            noProxy: ensureLoopbackNoProxy(`${baseNoProxy},${parsed.noProxy}`),
            source: 'win-registry',
          },
          failed: false,
        };
      }
      return { proxy: null, failed: false };
    } catch (err) {
      return { proxy: null, failed: isTransientLookupError(err) };
    }
  }

  if (platform === 'darwin') {
    try {
      const stdout = execFileSyncImpl('/usr/sbin/scutil', ['--proxy'], {
        encoding: 'utf-8',
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const parsed = parseMacScutilProxyOutput(stdout);
      if (parsed.enabled) {
        return {
          proxy: {
            ...parsed,
            noProxy: ensureLoopbackNoProxy(`${baseNoProxy},${parsed.noProxy}`),
            source: 'mac-scutil',
          },
          failed: false,
        };
      }
      return { proxy: null, failed: false };
    } catch (err) {
      return { proxy: null, failed: isTransientLookupError(err) };
    }
  }

  return { proxy: null, failed: false };
}

/**
 * Resolve live OS-level system proxy settings (Windows Internet Settings or macOS scutil).
 * Returns null if disabled, unsupported, or lookup fails.
 */
export function resolveLiveOsSystemProxy({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  lookupTimeoutMs = DEFAULT_OS_LOOKUP_TIMEOUT_MS,
} = {}) {
  return resolveLiveOsSystemProxyDetailed({
    env,
    platform,
    execFileSyncImpl,
    lookupTimeoutMs,
  }).proxy;
}
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:51
// ============================================================================

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:51
// Description: Document HKCU\Environment fallback in resolveProxyConfig JSDoc.
// ============================================================================
/**
 * Resolve effective proxy config in priority order:
 * 1) AGY_TOKEN_MONITOR_PROXY
 * 2) HTTPS_PROXY / HTTP_PROXY / ALL_PROXY (and lowercase variants)
 * 3) Windows Registry (Internet Settings, then HKCU\Environment) or macOS scutil system proxy
 * 4) Direct fallback
 */
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:51
// ============================================================================
export function resolveProxyConfig({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  disableOsLookup = false,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Accept optional lookupTimeoutMs in resolveProxyConfig.
// ============================================================================
  lookupTimeoutMs = DEFAULT_OS_LOOKUP_TIMEOUT_MS,
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
} = {}) {
  const safeEnv = env || {};
  const noProxy = ensureLoopbackNoProxy(safeEnv.NO_PROXY || safeEnv.no_proxy || '');

  const custom = normalizeHttpProxyUrl(safeEnv.AGY_TOKEN_MONITOR_PROXY || '');
  if (custom) {
    return {
      enabled: true,
      source: 'custom-env',
      httpProxy: custom,
      httpsProxy: custom,
      noProxy,
    };
  }

  const envHttps = normalizeHttpProxyUrl(safeEnv.HTTPS_PROXY || safeEnv.https_proxy || '');
  const envHttp = normalizeHttpProxyUrl(safeEnv.HTTP_PROXY || safeEnv.http_proxy || '');
  const envAll = normalizeHttpProxyUrl(safeEnv.ALL_PROXY || safeEnv.all_proxy || '');
  const httpProxy = envHttp || envAll;
  const httpsProxy = envHttps || envAll;

  if (httpProxy || httpsProxy) {
    return {
      enabled: true,
      source: 'env',
      httpProxy: httpProxy || httpsProxy,
      httpsProxy: httpsProxy || httpProxy,
      noProxy,
    };
  }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:51
// Description: Use resolveLiveOsSystemProxy and add Windows HKCU\Environment fallback.
// ============================================================================
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Track transient OS lookup failures across Internet Settings,
// macOS scutil, and HKCU\Environment and surface lookupFailed only when true.
// ============================================================================
  let osLookupFailed = false;
  if (!disableOsLookup && safeEnv.DISABLE_SYSTEM_PROXY_LOOKUP !== '1') {
    const liveOsResult = resolveLiveOsSystemProxyDetailed({
      env: safeEnv,
      platform,
      execFileSyncImpl,
      lookupTimeoutMs,
    });
    if (liveOsResult.proxy && liveOsResult.proxy.enabled) {
      return liveOsResult.proxy;
    }
    if (liveOsResult.failed) {
      osLookupFailed = true;
    }

    if (platform === 'win32') {
      try {
        const envStdout = queryWindowsRegistryKey(
          execFileSyncImpl,
          'HKCU\\Environment',
          safeEnv,
          lookupTimeoutMs,
        );
        const userEnvParsed = parseWindowsUserEnvProxyOutput(envStdout);
        if (userEnvParsed.enabled) {
          return {
            ...userEnvParsed,
            noProxy: ensureLoopbackNoProxy(`${noProxy},${userEnvParsed.noProxy}`),
            source: 'win-user-env',
          };
        }
      } catch (err) {
        if (isTransientLookupError(err)) {
          osLookupFailed = true;
        }
      }
    }
  }
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:51
// ============================================================================

  return {
    enabled: false,
    source: 'direct',
    httpProxy: '',
    httpsProxy: '',
    noProxy,
    ...(osLookupFailed ? { lookupFailed: true } : {}),
  };
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
}

// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 15:28:51
// Description: Add readGlobalUndiciDispatcher helper and upgrade createSystemProxyManager
// with forced/max-age dispatcher rebuilds, old dispatcher close() drain, and
// recoverFromTransportFailure() live OS proxy drift recovery.
// ============================================================================
function readGlobalUndiciDispatcher() {
  return (
    globalThis[Symbol.for('undici.globalDispatcher.1')] ||
    globalThis[Symbol.for('undici.globalDispatcher.2')] ||
    null
  );
}

/**
 * Create a TTL-cached system proxy manager that applies, rebuilds, drains, and restores
 * Node's global HTTP/HTTPS proxy dispatcher cleanly across OS or env proxy changes.
 */
export function createSystemProxyManager(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    execFileSyncImpl = execFileSync,
    setGlobalProxyFn = http.setGlobalProxyFromEnv,
    nowFn = Date.now,
    cacheTtlMs = 300_000,
    maxDispatcherAgeMs = DEFAULT_MAX_DISPATCHER_AGE_MS,
    disableOsLookup = false,
// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Accept configurable lookupTimeoutMs in createSystemProxyManager.
// ============================================================================
    lookupTimeoutMs = DEFAULT_OS_LOOKUP_TIMEOUT_MS,
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================
  } = options || {};

  let lastResolvedAtMs = null;
  let lastAppliedAtMs = null;
  let rebuildCount = 0;
  let activeSig = 'direct';
  let restoreFn = null;
  let activeDispatcher = null;
  let activeConfig = {
    enabled: false,
    source: 'direct',
    httpProxy: '',
    httpsProxy: '',
    noProxy: ensureLoopbackNoProxy(env?.NO_PROXY || env?.no_proxy || ''),
  };

  function getStatus() {
    return {
      enabled: Boolean(activeConfig.enabled),
      source: activeConfig.source || 'direct',
      proxyUrl: redactProxyUrl(activeConfig.httpsProxy || activeConfig.httpProxy),
      noProxy: activeConfig.noProxy || LOOPBACK_NO_PROXY,
      rebuildCount,
      lastAppliedAtMs,
    };
  }

  function clearActiveRestore() {
    const prevDispatcher = activeDispatcher;
    activeDispatcher = null;
    if (typeof restoreFn === 'function') {
      try {
        restoreFn();
      } catch {
        // Ignore restore failure during proxy switch or disposal.
      }
    }
    restoreFn = null;

    const restoredDispatcher = readGlobalUndiciDispatcher();
    if (
      prevDispatcher &&
      prevDispatcher !== restoredDispatcher &&
      typeof prevDispatcher.close === 'function'
    ) {
      try {
        Promise.resolve(prevDispatcher.close()).catch(() => {});
      } catch {
        // Ignore dispatcher close/drain failure.
      }
    }
  }

  function applyProxyConfig(next, nextSig, isRebuild) {
    // Restore and drain previous global dispatcher before applying a new one to prevent nested wrapping.
    clearActiveRestore();
    if (next.enabled && typeof setGlobalProxyFn === 'function') {
      try {
        const beforeDisp = readGlobalUndiciDispatcher();
        const maybeRestore = setGlobalProxyFn({
          HTTP_PROXY: next.httpProxy,
          HTTPS_PROXY: next.httpsProxy,
          NO_PROXY: next.noProxy,
          http_proxy: next.httpProxy,
          https_proxy: next.httpsProxy,
          no_proxy: next.noProxy,
        });
        const afterDisp = readGlobalUndiciDispatcher();
        activeDispatcher = afterDisp && afterDisp !== beforeDisp ? afterDisp : null;
        restoreFn = typeof maybeRestore === 'function' ? maybeRestore : null;
        activeSig = nextSig;
        activeConfig = { ...next };
        lastAppliedAtMs = nowFn();
        if (isRebuild) {
          rebuildCount += 1;
        }
      } catch {
        restoreFn = null;
        activeDispatcher = null;
        activeSig = 'direct';
        activeConfig = {
          enabled: false,
          source: 'direct',
          httpProxy: '',
          httpsProxy: '',
          noProxy: next.noProxy || LOOPBACK_NO_PROXY,
        };
        lastAppliedAtMs = null;
      }
    } else {
      activeSig = !next.enabled ? 'direct' : nextSig;
      activeConfig = { ...next };
      lastAppliedAtMs = null;
    }
  }

  function refresh(refreshOpts = {}) {
    const { force = false, rebuild = false } = refreshOpts || {};
    const ageExceeded = Boolean(
      activeConfig.enabled &&
        lastAppliedAtMs !== null &&
        maxDispatcherAgeMs > 0 &&
        nowFn() - lastAppliedAtMs >= maxDispatcherAgeMs,
    );
    if (
      !force &&
      !rebuild &&
      !ageExceeded &&
      lastResolvedAtMs !== null &&
      nowFn() - lastResolvedAtMs < cacheTtlMs
    ) {
      return getStatus();
    }

// ============================================================================
// [MODIFIED BEGIN] 2026-11-19 11:47:54
// Description: Harden refresh() against transient OS proxy lookup failures
// (anti-flap preservation of active proxy and no 5-min failure caching) and
// propagate lookupTimeoutMs into resolveProxyConfig and recoverFromTransportFailure.
// ============================================================================
    const next = resolveProxyConfig({
      env,
      platform,
      execFileSyncImpl,
      disableOsLookup,
      lookupTimeoutMs,
    });

    if (next.lookupFailed === true) {
      lastResolvedAtMs = null;
      if (activeConfig.enabled === true) {
        if (force || rebuild || ageExceeded) {
          applyProxyConfig(activeConfig, activeSig, true);
        }
        return getStatus();
      }
      return getStatus();
    }

    lastResolvedAtMs = nowFn();
    const nextSig = next.enabled ? `${next.httpProxy}|${next.httpsProxy}|${next.noProxy}` : 'direct';
    const sigChanged = nextSig !== activeSig;
    const shouldRebuildSameProxy = !sigChanged && next.enabled && (force || rebuild || ageExceeded);

    if (sigChanged || shouldRebuildSameProxy) {
      applyProxyConfig(
        next,
        nextSig,
        shouldRebuildSameProxy || (sigChanged && activeSig !== 'direct' && next.enabled),
      );
    } else {
      activeConfig = { ...next };
    }

    return getStatus();
  }

  function recoverFromTransportFailure() {
    // SECURITY INVARIANT: NEVER bypass an explicitly configured proxy to direct!
    if (
      activeConfig.source === 'env' &&
      !disableOsLookup &&
      env?.DISABLE_SYSTEM_PROXY_LOOKUP !== '1'
    ) {
      const liveOs = resolveLiveOsSystemProxy({
        env,
        platform,
        execFileSyncImpl,
        lookupTimeoutMs,
      });
      if (liveOs && liveOs.enabled) {
        const liveSig = `${liveOs.httpProxy}|${liveOs.httpsProxy}|${liveOs.noProxy}`;
        if (liveSig !== activeSig) {
          lastResolvedAtMs = nowFn();
          applyProxyConfig(liveOs, liveSig, true);
          return getStatus();
        }
      }
    }
// ============================================================================
// [MODIFIED END] 2026-11-19 11:47:54
// ============================================================================

    if (activeConfig.enabled) {
      return refresh({ force: true, rebuild: true });
    }
    return refresh({ force: true });
  }

  function dispose() {
    clearActiveRestore();
    lastResolvedAtMs = null;
    lastAppliedAtMs = null;
    activeSig = 'direct';
    activeConfig = {
      enabled: false,
      source: 'direct',
      httpProxy: '',
      httpsProxy: '',
      noProxy: activeConfig.noProxy || LOOPBACK_NO_PROXY,
    };
  }

  return {
    refresh,
    recoverFromTransportFailure,
    getStatus,
    dispose,
  };
}
// ============================================================================
// [MODIFIED END] 2026-11-18 15:28:51
// ============================================================================

// ============================================================================
// [MODIFIED END] 2026-11-18 10:22:38
// ============================================================================
