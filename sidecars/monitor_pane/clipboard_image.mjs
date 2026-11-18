// ============================================================================
// [MODIFIED BEGIN] 2026-11-18 16:21:00
// Description: Zero-dependency cross-platform PNG clipboard writer and base64
// data URL validator for agy-token-monitor v0.3.1 checkout receipt copy.
// ============================================================================

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MAX_CLIPBOARD_PNG_BYTES = 4 * 1024 * 1024;
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const MAX_BASE64_LENGTH = Math.ceil((MAX_CLIPBOARD_PNG_BYTES * 4) / 3) + 128;

/**
 * Decodes and validates a PNG image payload from either a `data:image/png;base64,...`
 * data URL or a raw base64 string.
 */
export function decodeAndValidatePngBase64(rawInput) {
  if (typeof rawInput !== 'string') {
    return { ok: false, error: 'Image payload must be a base64 string.' };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Image payload is empty.' };
  }

  let payload = trimmed;
  if (/^data:/i.test(trimmed)) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx < 0) {
      return { ok: false, error: 'Invalid image data URL.' };
    }
    const header = trimmed.slice(5, commaIdx);
    const parts = header
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    const mime = (parts[0] || '').toLowerCase();
    if (mime !== 'image/png') {
      return { ok: false, error: 'Only image/png data URLs are supported.' };
    }
    const params = parts.slice(1).map((p) => p.toLowerCase());
    if (!params.includes('base64')) {
      return { ok: false, error: 'PNG data URL must be base64-encoded.' };
    }
    for (const p of params) {
      if (p !== 'base64' && !/^charset=[^;,\s]+$/i.test(p)) {
        return { ok: false, error: 'Unsupported PNG data URL parameter.' };
      }
    }
    payload = trimmed.slice(commaIdx + 1).trim();
  }

  const b64 = payload.replace(/[\r\n]+/g, '');
  if (!b64) {
    return { ok: false, error: 'Image base64 payload is empty.' };
  }
  if (b64.length > MAX_BASE64_LENGTH) {
    return {
      ok: false,
      error: `Image payload exceeds ${MAX_CLIPBOARD_PNG_BYTES} byte limit.`,
    };
  }
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(b64) ||
    b64.length % 4 === 1 ||
    (b64.includes('=') && b64.length % 4 !== 0)
  ) {
    return { ok: false, error: 'Invalid base64 characters in image payload.' };
  }

  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 24) {
    return { ok: false, error: 'Decoded PNG payload is too small.' };
  }
  if (buf.length > MAX_CLIPBOARD_PNG_BYTES) {
    return {
      ok: false,
      error: `Decoded PNG size (${buf.length} bytes) exceeds ${MAX_CLIPBOARD_PNG_BYTES} byte limit.`,
    };
  }
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ok: false, error: 'Decoded payload is not a valid PNG image.' };
  }

  return { ok: true, buffer: buf };
}

function runExec(execFileImpl, cmd, args, opts, stdinBuffer = null) {
  return new Promise((resolve, reject) => {
    const child = execFileImpl(cmd, args, opts, (err, stdout = '', stderr = '') => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
    if (stdinBuffer && child && child.stdin && typeof child.stdin.end === 'function') {
      child.stdin.on('error', () => {});
      child.stdin.end(stdinBuffer);
    }
  });
}

/**
 * Copies a validated PNG Buffer to the OS clipboard using native platform helpers
 * without interpolating file paths into shell strings.
 */
export async function copyPngToSystemClipboard(pngBuffer, options = {}) {
  const {
    platform = process.platform,
    env = process.env,
    execFileImpl = execFile,
    tempDir = tmpdir(),
  } = options || {};

  if (!Buffer.isBuffer(pngBuffer)) {
    return { ok: false, error: 'PNG buffer must be a Node Buffer.' };
  }
  if (pngBuffer.length < 24 || pngBuffer.length > MAX_CLIPBOARD_PNG_BYTES) {
    return {
      ok: false,
      error: `PNG buffer size must be between 24 and ${MAX_CLIPBOARD_PNG_BYTES} bytes.`,
    };
  }
  if (!pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ok: false, error: 'Buffer does not have a valid PNG signature.' };
  }

  let tmpPath = '';
  try {
    mkdirSync(tempDir, { recursive: true });
    tmpPath = join(tempDir, `agy-receipt-${process.pid}-${randomUUID()}.png`);
    writeFileSync(tmpPath, pngBuffer, { mode: 0o600 });

    const execEnv = { ...(env || {}), AGY_CLIP_PNG_PATH: tmpPath };

    if (platform === 'win32') {
      const psScript = [
        "$ErrorActionPreference = 'Stop'",
        '$path = $env:AGY_CLIP_PNG_PATH',
        "if (-not $path -or -not (Test-Path -LiteralPath $path)) { throw 'Missing AGY_CLIP_PNG_PATH' }",
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '$bytes = [System.IO.File]::ReadAllBytes($path)',
        '$imgStream = $null',
        '$pngStream = $null',
        '$img = $null',
        'try {',
        '  $imgStream = [System.IO.MemoryStream]::new($bytes)',
        '  $img = [System.Drawing.Image]::FromStream($imgStream)',
        '  $pngStream = [System.IO.MemoryStream]::new($bytes)',
        '  $data = [System.Windows.Forms.DataObject]::new()',
        '  $data.SetImage($img)',
        "  $data.SetData('PNG', $false, $pngStream)",
        '  [System.Windows.Forms.Clipboard]::SetDataObject($data, $true)',
        '} finally {',
        '  if ($null -ne $img) { $img.Dispose() }',
        '  if ($null -ne $imgStream) { $imgStream.Dispose() }',
        '  if ($null -ne $pngStream) { $pngStream.Dispose() }',
        '}',
      ].join('\n');

      const psArgs = ['-NoProfile', '-NonInteractive', '-STA', '-Command', psScript];
      const psOpts = { env: execEnv, timeout: 10000, windowsHide: true };
      try {
        await runExec(execFileImpl, 'powershell.exe', psArgs, psOpts);
      } catch (err) {
        if (err?.code === 'ENOENT') {
          const fallbackPs = join(
            env?.SystemRoot || 'C:\\Windows',
            'System32',
            'WindowsPowerShell',
            'v1.0',
            'powershell.exe',
          );
          await runExec(execFileImpl, fallbackPs, psArgs, psOpts);
        } else {
          throw err;
        }
      }
      return { ok: true, platform };
    }

    if (platform === 'darwin') {
      await runExec(
        execFileImpl,
        '/usr/bin/osascript',
        [
          '-e',
          'set the clipboard to (read (POSIX file (system attribute "AGY_CLIP_PNG_PATH")) as «class PNGf»)',
        ],
        { env: execEnv, timeout: 8000 },
      );
      return { ok: true, platform };
    }

    try {
      await runExec(
        execFileImpl,
        'wl-copy',
        ['--type', 'image/png'],
        { env: execEnv, timeout: 8000 },
        pngBuffer,
      );
      return { ok: true, platform };
    } catch (wlErr) {
      try {
        await runExec(
          execFileImpl,
          'xclip',
          ['-selection', 'clipboard', '-t', 'image/png', '-i', tmpPath],
          { env: execEnv, timeout: 8000 },
        );
        return { ok: true, platform };
      } catch (xclipErr) {
        if ((wlErr?.code === 'ENOENT' || !env?.WAYLAND_DISPLAY) && xclipErr?.code === 'ENOENT') {
          return {
            ok: false,
            error: 'Clipboard image helper unavailable (install wl-copy or xclip)',
          };
        }
        const activeErr = xclipErr?.code === 'ENOENT' ? wlErr : xclipErr;
        return {
          ok: false,
          error: activeErr?.message
            ? String(activeErr.message)
            : 'Clipboard image helper unavailable (install wl-copy or xclip)',
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message ? String(err.message) : 'Clipboard write failed.',
    };
  } finally {
    if (tmpPath) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore temp cleanup failure.
      }
    }
  }
}

// ============================================================================
// [MODIFIED END] 2026-11-18 16:21:00
// ============================================================================
