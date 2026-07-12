param(
  [string]$RepoPath = (Join-Path $PSScriptRoot ".."),
  [switch]$Force,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Write-Info($Message) {
  if (-not $Quiet) {
    Write-Host $Message
  }
}

$root = (Resolve-Path -LiteralPath $RepoPath).Path
Push-Location $root

try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git command was not found."
  }

  if (-not (Get-Command gitnexus -ErrorAction SilentlyContinue)) {
    throw "gitnexus command was not found. Run npm/npx setup before using GitNexus."
  }

  $head = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $head) {
    throw "Unable to resolve current git HEAD."
  }

  $metaPath = Join-Path $root ".gitnexus\meta.json"
  $indexedCommit = $null

  if (Test-Path -LiteralPath $metaPath) {
    $meta = Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
    $indexedCommit = [string]$meta.lastCommit
  }

  if ($Force -or $indexedCommit -ne $head) {
    $from = if ($indexedCommit) { $indexedCommit.Substring(0, [Math]::Min(7, $indexedCommit.Length)) } else { "missing" }
    $to = $head.Substring(0, [Math]::Min(7, $head.Length))
    Write-Info "[gitnexus] refreshing index ($from -> $to)"
    $analyzeArgs = @("analyze", ".", "--skip-agents-md")
    if ($Force) {
      $analyzeArgs += "--force"
    }
    & gitnexus @analyzeArgs
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } else {
    Write-Info "[gitnexus] index up-to-date at $($head.Substring(0, 7))"
  }

  if (-not $Quiet) {
    gitnexus status
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }
} finally {
  Pop-Location
}
