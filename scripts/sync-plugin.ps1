# ============================================================================
# [MODIFIED BEGIN] 2026-11-16 11:48:00
# Description: Sync agy-token-monitor plugin files to global Antigravity config and verify read-only discovery
# ============================================================================
[CmdletBinding()]
param(
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'

$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$PluginDirName = 'agy-token-monitor'
$TargetRoot = Join-Path $env:USERPROFILE ".gemini\config\plugins\$PluginDirName"

$ManagedFiles = @('plugin.json', 'README.md')
$ManagedDirs = @('assets', 'skills', 'sidecars')
$JsonCandidates = @(
    'plugin.json',
    'sidecars\monitor_pane\sidecar.json',
    'sidecars\monitor_pane\package.json'
)

function Test-JsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [switch]$Required
    )

    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        if ($Required) {
            throw "Required JSON file missing: $FilePath"
        }
        return $false
    }

    $raw = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "JSON file is empty: $FilePath"
    }

    try {
        $null = $raw | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Invalid JSON syntax in '$FilePath': $($_.Exception.Message)"
    }

    return $true
}

Write-Output "[sync-plugin] Source: $SourceRoot"
Write-Output "[sync-plugin] Target: $TargetRoot"

# 1. Validate JSON syntax in source repository before syncing
$validatedCount = 0
foreach ($relPath in $JsonCandidates) {
    $fullPath = Join-Path $SourceRoot $relPath
    $isReq = ($relPath -eq 'plugin.json')
    if (Test-JsonFile -FilePath $fullPath -Required:$isReq) {
        Write-Output "[sync-plugin] JSON OK (source): $relPath"
        $validatedCount++
    }
    else {
        Write-Output "[sync-plugin] JSON skipped (not present yet): $relPath"
    }
}

if (-not $VerifyOnly) {
    if (-not (Test-Path -LiteralPath $TargetRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $TargetRoot -Force | Out-Null
    }

    # Replace only managed top-level files inside the plugin directory
    foreach ($fileName in $ManagedFiles) {
        $srcFile = Join-Path $SourceRoot $fileName
        if (-not (Test-Path -LiteralPath $srcFile -PathType Leaf)) {
            throw "Managed source file missing: $srcFile"
        }
        $dstFile = Join-Path $TargetRoot $fileName
        Copy-Item -LiteralPath $srcFile -Destination $dstFile -Force
        Write-Output "[sync-plugin] Copied file: $fileName"
    }

# ============================================================================
# [MODIFIED BEGIN] 2026-11-16 20:27:00
# Description: Sync agy-token-monitor plugin files in-place without failing on Windows CWD directory locks
# ============================================================================
    # Cleanly sync managed subdirectories in-place (avoids Windows CWD folder lock on running sidecars)
    foreach ($dirName in $ManagedDirs) {
        $srcDir = Join-Path $SourceRoot $dirName
        if (-not (Test-Path -LiteralPath $srcDir -PathType Container)) {
            throw "Managed source directory missing: $srcDir"
        }
        $dstDir = Join-Path $TargetRoot $dirName
        if (-not (Test-Path -LiteralPath $dstDir -PathType Container)) {
            New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        }
        Copy-Item -Path (Join-Path $srcDir '*') -Destination $dstDir -Recurse -Force
        Write-Output "[sync-plugin] Synced directory: $dirName"
    }
# ============================================================================
# [MODIFIED END] 2026-11-16 20:27:00
# ============================================================================

    # Validate deployed JSON files at target
    foreach ($relPath in $JsonCandidates) {
        $dstJson = Join-Path $TargetRoot $relPath
        if (Test-JsonFile -FilePath $dstJson -Required:($relPath -eq 'plugin.json')) {
            Write-Output "[sync-plugin] JSON OK (target): $relPath"
        }
    }
}
else {
    Write-Output "[sync-plugin] VerifyOnly mode: skipped file copy."
    if (Test-Path -LiteralPath $TargetRoot -PathType Container) {
        foreach ($relPath in $JsonCandidates) {
            $dstJson = Join-Path $TargetRoot $relPath
            if (Test-JsonFile -FilePath $dstJson -Required:($relPath -eq 'plugin.json')) {
                Write-Output "[sync-plugin] JSON OK (target): $relPath"
            }
        }
    }
    else {
        Write-Output "[sync-plugin] Target plugin directory does not exist yet: $TargetRoot"
    }
}

# 2. Read-only GetAllPlugins discovery verification (never dump unfiltered output)
if ($env:ANTIGRAVITY_LS_ADDRESS -and $env:ANTIGRAVITY_CSRF_TOKEN) {
    $rpcUrl = "http://$($env:ANTIGRAVITY_LS_ADDRESS)/exa.language_server_pb.LanguageServerService/GetAllPlugins"
    $headers = @{
        'Content-Type'        = 'application/json'
        'x-codeium-csrf-token' = $env:ANTIGRAVITY_CSRF_TOKEN
    }
    $body = '{"workspaceUris":[]}'

    $foundPlugin = $null
    $maxAttempts = if ($VerifyOnly) { 1 } else { 2 }

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $resp = Invoke-RestMethod -Uri $rpcUrl -Method Post -Headers $headers -Body $body -TimeoutSec 5
            if ($resp -and $resp.plugins) {
                $match = $resp.plugins | Where-Object {
                    $dirSeg = ($_.path -split '[\\/]' | Where-Object { $_ } | Select-Object -Last 1)
                    ($_.name -eq $PluginDirName) -or ($dirSeg -eq $PluginDirName)
                } | Select-Object -First 1

                if ($match) {
                    $dirSeg = ($match.path -split '[\\/]' | Where-Object { $_ } | Select-Object -Last 1)
                    $skillNames = @()
                    if ($match.skills) {
                        $skillNames = @($match.skills | Where-Object { $_ -and $_.name } | ForEach-Object { $_.name })
                    }
                    $foundPlugin = [PSCustomObject]@{
                        name     = $match.name
                        dir      = $dirSeg
                        disabled = [bool]$match.disabled
                        isGlobal = [bool]$match.isGlobal
                        skills   = $skillNames
                    }
                    break
                }
            }
        }
        catch {
            Write-Warning "[sync-plugin] Read-only GetAllPlugins check failed: $($_.Exception.Message)"
            break
        }

        if ($attempt -lt $maxAttempts) {
            Start-Sleep -Milliseconds 350
        }
    }

    if ($foundPlugin) {
        Write-Output "[sync-plugin] GetAllPlugins discovered (filtered):"
        $foundPlugin | ConvertTo-Json -Depth 3
    }
    else {
        Write-Warning "[sync-plugin] GetAllPlugins completed, but '$PluginDirName' was not listed yet."
    }
}
else {
    Write-Output "[sync-plugin] ANTIGRAVITY_LS_ADDRESS or ANTIGRAVITY_CSRF_TOKEN not set; skipped GetAllPlugins RPC check."
}
# ============================================================================
# [MODIFIED END] 2026-11-16 11:48:00
# ============================================================================
