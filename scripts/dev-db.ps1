param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("up", "down", "logs", "ps", "restart", "reset")]
  [string]$Action
)

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$drive = $projectRoot.Substring(0, 1).ToLowerInvariant()
$rest = $projectRoot.Substring(2).Replace("\", "/")
$wslPath = "/mnt/$drive$rest"
$composeFile = "docker-compose.postgres.yml"

switch ($Action) {
  "up" {
    $command = "docker compose -f $composeFile up -d"
  }
  "down" {
    $command = "docker compose -f $composeFile down"
  }
  "logs" {
    $command = "docker compose -f $composeFile logs --tail=150 postgres"
  }
  "ps" {
    $command = "docker compose -f $composeFile ps"
  }
  "restart" {
    $command = "docker compose -f $composeFile down && docker compose -f $composeFile up -d"
  }
  "reset" {
    $command = "docker compose -f $composeFile down -v && docker compose -f $composeFile up -d"
  }
}

wsl bash -lc "cd '$wslPath' && $command"
