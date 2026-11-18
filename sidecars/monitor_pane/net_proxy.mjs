// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 10:22:38
// Description: Zero-dependency OS and environment HTTP(S) proxy auto-detection
// and Node global proxy dispatcher manager for pricing sync and release checks.
// ============================================================================

import http from 'node:http';
import { execFileSync } from 'node:child_process';

export const LOOPBACK_NO_PROXY = '127.0.0.1,localhost,::1';

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

/**
 * Resolve effective proxy config in priority order:
 * 1) AGY_TOKEN_MONITOR_PROXY
 * 2) HTTPS_PROXY / HTTP_PROXY / ALL_PROXY (and lowercase variants)
 * 3) Windows Registry or macOS scutil system proxy
 * 4) Direct fallback
 */
export function resolveProxyConfig({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  disableOsLookup = false,
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

  if (!disableOsLookup && safeEnv.DISABLE_SYSTEM_PROXY_LOOKUP !== '1') {
    if (platform === 'win32') {
      try {
        const stdout = execFileSyncImpl(
          'reg.exe',
          ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
          {
            encoding: 'utf-8',
            timeout: 1200,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
          },
        );
        const parsed = parseWindowsRegProxyOutput(stdout);
        if (parsed.enabled) {
          return {
            ...parsed,
            noProxy: ensureLoopbackNoProxy(`${noProxy},${parsed.noProxy}`),
            source: 'win-registry',
          };
        }
      } catch {
        // Ignore OS registry lookup failure and fall back to direct mode.
      }
    } else if (platform === 'darwin') {
      try {
        const stdout = execFileSyncImpl('/usr/sbin/scutil', ['--proxy'], {
          encoding: 'utf-8',
          timeout: 1200,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const parsed = parseMacScutilProxyOutput(stdout);
        if (parsed.enabled) {
          return {
            ...parsed,
            noProxy: ensureLoopbackNoProxy(`${noProxy},${parsed.noProxy}`),
            source: 'mac-scutil',
          };
        }
      } catch {
        // Ignore OS scutil lookup failure and fall back to direct mode.
      }
    }
  }

  return {
    enabled: false,
    source: 'direct',
    httpProxy: '',
    httpsProxy: '',
    noProxy,
  };
}

/**
 * Create a TTL-cached system proxy manager that applies/restores Node's global
 * HTTP/HTTPS proxy dispatcher cleanly when OS or env proxy settings change.
 */
export function createSystemProxyManager(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    execFileSyncImpl = execFileSync,
    setGlobalProxyFn = http.setGlobalProxyFromEnv,
    nowFn = Date.now,
    cacheTtlMs = 300_000,
    disableOsLookup = false,
  } = options || {};

  let lastResolvedAtMs = null;
  let activeSig = 'direct';
  let restoreFn = null;
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
    };
  }

  function clearActiveRestore() {
    if (typeof restoreFn === 'function') {
      try {
        restoreFn();
      } catch {
        // Ignore restore failure during proxy switch or disposal.
      }
    }
    restoreFn = null;
  }

  function refresh({ force = false } = {}) {
    if (!force && lastResolvedAtMs !== null && nowFn() - lastResolvedAtMs < cacheTtlMs) {
      return getStatus();
    }

    lastResolvedAtMs = nowFn();
    const next = resolveProxyConfig({
      env,
      platform,
      execFileSyncImpl,
      disableOsLookup,
    });
    const nextSig = next.enabled ? `${next.httpProxy}|${next.httpsProxy}|${next.noProxy}` : 'direct';

    if (nextSig !== activeSig) {
      // Restore previous global dispatcher before applying a new one to prevent nested wrapping.
      clearActiveRestore();
      if (next.enabled && typeof setGlobalProxyFn === 'function') {
        try {
          const maybeRestore = setGlobalProxyFn({
            HTTP_PROXY: next.httpProxy,
            HTTPS_PROXY: next.httpsProxy,
            NO_PROXY: next.noProxy,
            http_proxy: next.httpProxy,
            https_proxy: next.httpsProxy,
            no_proxy: next.noProxy,
          });
          restoreFn = typeof maybeRestore === 'function' ? maybeRestore : null;
          activeSig = nextSig;
          activeConfig = { ...next };
        } catch {
          restoreFn = null;
          activeSig = 'direct';
          activeConfig = {
            enabled: false,
            source: 'direct',
            httpProxy: '',
            httpsProxy: '',
            noProxy: next.noProxy || LOOPBACK_NO_PROXY,
          };
        }
      } else {
        activeSig = nextSig;
        activeConfig = { ...next };
      }
    } else {
      activeConfig = { ...next };
    }

    return getStatus();
  }

  function dispose() {
    clearActiveRestore();
    lastResolvedAtMs = null;
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
    getStatus,
    dispose,
  };
}

// ============================================================================
// [MODIFIED END] 2026-11-18 10:22:38
// ============================================================================
