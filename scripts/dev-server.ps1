param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("start", "stop", "restart", "status")]
  [string]$Action,
  [int]$Port = 3001,
  [string]$BindHost = "127.0.0.1",
  [ValidateSet("turbopack", "webpack")]
  [string]$Bundler = "turbopack"
)

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logRoot = Join-Path $env:TEMP "minhhong-next-dev"
$stdoutLog = Join-Path $logRoot "dev-$Port.out.log"
$stderrLog = Join-Path $logRoot "dev-$Port.err.log"
$stateFile = Join-Path $logRoot "dev-$Port.state.json"

function Get-PortProcessId {
  $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" } |
    Select-Object -First 1

  if ($connection) {
    return $connection.OwningProcess
  }

  return $null
}

function Show-Status {
  $serverPid = Get-PortProcessId

  if (-not $serverPid) {
    Write-Output "Dev server tren port $Port dang dung."
    Write-Output "Stdout: $stdoutLog"
    Write-Output "Stderr: $stderrLog"
    return
  }

  $process = Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq $serverPid }
  $detectedBundler = $Bundler
  if (Test-Path $stateFile) {
    try {
      $state = Get-Content $stateFile | ConvertFrom-Json
      if ($state.Bundler) {
        $detectedBundler = $state.Bundler
      }
    } catch {
      # Ignore malformed state and fall back to the requested bundler.
    }
  }
  Write-Output "Dev server dang chay tren http://$BindHost`:$Port"
  Write-Output "Bundler: $detectedBundler"
  Write-Output "PID: $serverPid"
  if ($process) {
    Write-Output "Command: $($process.CommandLine)"
  }
  Write-Output "Stdout: $stdoutLog"
  Write-Output "Stderr: $stderrLog"
}

function Stop-Server {
  $serverPid = Get-PortProcessId

  if (-not $serverPid) {
    Write-Output "Khong co dev server nao dang nghe port $Port."
    return
  }

  Stop-Process -Id $serverPid -Force

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 300
    if (-not (Get-PortProcessId)) {
      Write-Output "Da dung dev server tren port $Port."
      return
    }
  }

  throw "Khong dung duoc dev server tren port $Port."
}

function Start-Server {
  $existingPid = Get-PortProcessId
  if ($existingPid) {
    Write-Output "Dev server tren port $Port da dang chay voi PID $existingPid."
    Show-Status
    return
  }

  New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
  if (Test-Path $stdoutLog) { Remove-Item -LiteralPath $stdoutLog -Force }
  if (Test-Path $stderrLog) { Remove-Item -LiteralPath $stderrLog -Force }
  if (Test-Path $stateFile) { Remove-Item -LiteralPath $stateFile -Force }

  $nodeExe = (Get-Command node).Source
  $nextCli = Join-Path $projectRoot "node_modules\next\dist\bin\next"
  $argumentList = @($nextCli, "dev")
  $argumentList += if ($Bundler -eq "webpack") { "--webpack" } else { "--turbopack" }
  $argumentList += @("--hostname", $BindHost, "--port", "$Port")
  $process = Start-Process `
    -FilePath $nodeExe `
    -ArgumentList $argumentList `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    if (Get-PortProcessId) {
      @{
        BindHost = $BindHost
        Bundler = $Bundler
        Port = $Port
      } | ConvertTo-Json | Set-Content -LiteralPath $stateFile
      Write-Output "Da khoi dong dev server tren http://$BindHost`:$Port"
      Write-Output "Bundler: $Bundler"
      Write-Output "PID: $($process.Id)"
      Write-Output "Stdout: $stdoutLog"
      Write-Output "Stderr: $stderrLog"
      return
    }
  }

  throw "Dev server khong len duoc tren port $Port. Xem log: $stderrLog"
}

switch ($Action) {
  "start" {
    Start-Server
  }
  "stop" {
    Stop-Server
  }
  "restart" {
    Stop-Server
    Start-Server
  }
  "status" {
    Show-Status
  }
}
