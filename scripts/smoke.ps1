# Suite smoke (PowerShell)

# Same checks as README Development. Does not claim Windows skill support.
$ErrorActionPreference = "Stop"
function Invoke-Checked($command) {
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Invoke-Checked "pnpm check"
Invoke-Checked "pnpm test"
Invoke-Checked "pnpm dlx skills add . --list"
