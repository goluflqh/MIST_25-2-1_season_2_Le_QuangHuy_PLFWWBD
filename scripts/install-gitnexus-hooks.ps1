param(
  [string]$RepoPath = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"

function ConvertTo-GitBashPath($Path) {
  $normalized = $Path.Replace("\", "/")
  if ($normalized -match "^([A-Za-z]):/(.*)$") {
    $drive = $Matches[1].ToLower()
    $rest = $Matches[2]
    $candidates = @("/mnt/$drive/$rest", "/$drive/$rest")

    if (Get-Command bash -ErrorAction SilentlyContinue) {
      foreach ($candidate in $candidates) {
        $escaped = $candidate.Replace("'", "'\''")
        $exists = bash -lc "test -e '$escaped' && echo yes"
        if ($exists -match "yes") {
          return $candidate
        }
      }
    }

    return $candidates[0]
  }

  return $normalized
}

$root = (Resolve-Path -LiteralPath $RepoPath).Path
Push-Location $root

try {
  $commonGitDir = (git rev-parse --git-common-dir).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $commonGitDir) {
    throw "Unable to resolve git common dir."
  }

  if (-not [System.IO.Path]::IsPathRooted($commonGitDir)) {
    $commonGitDir = Join-Path $root $commonGitDir
  }

  $hooksDir = Join-Path $commonGitDir "hooks"
  New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null

  $hookBody = @'
#!/bin/sh

if [ "$GITNEXUS_SKIP_AUTO_ANALYZE" = "1" ]; then
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if command -v cygpath >/dev/null 2>&1; then
  repo_root_win="$(cygpath -w "$repo_root")"
else
  repo_root_win="$repo_root"
fi

if command -v powershell.exe >/dev/null 2>&1 && [ -f "$repo_root/scripts/gitnexus-preflight.ps1" ]; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$repo_root_win/scripts/gitnexus-preflight.ps1" -RepoPath "$repo_root_win" -Quiet
elif command -v gitnexus >/dev/null 2>&1; then
  gitnexus analyze "$repo_root"
fi

exit 0
'@

  $hookNames = @("post-checkout", "post-merge", "post-commit", "post-rewrite")
  foreach ($hookName in $hookNames) {
    $hookPath = Join-Path $hooksDir $hookName
    Set-Content -LiteralPath $hookPath -Value $hookBody -Encoding ascii -NoNewline
  }

  if (Get-Command bash -ErrorAction SilentlyContinue) {
    foreach ($hookName in $hookNames) {
      $hookPath = ConvertTo-GitBashPath (Join-Path $hooksDir $hookName)
      bash -lc "chmod +x '$hookPath'"
    }
  }

  Write-Host "Installed GitNexus auto-refresh hooks in $hooksDir"
  Write-Host "Hooks: $($hookNames -join ', ')"
  Write-Host "Set GITNEXUS_SKIP_AUTO_ANALYZE=1 to skip auto-refresh for one git operation."
} finally {
  Pop-Location
}
