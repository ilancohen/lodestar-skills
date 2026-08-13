# Suite smoke (PowerShell)

# Same checks as README Development. Does not claim Windows skill support.
$ErrorActionPreference = "Stop"
function Invoke-Checked($command) {
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Invoke-Checked "node scripts/check_package.mjs"
Invoke-Checked "node --test tests/*.test.mjs"
Invoke-Checked "uvx --from skills-ref agentskills validate skills/ep-setup"
Invoke-Checked "uvx --from skills-ref agentskills validate skills/ep-audit"
Invoke-Checked "uvx --from skills-ref agentskills validate skills/ep-fix"
Invoke-Checked "uvx --from skills-ref agentskills validate skills/ep-review-architecture"
Invoke-Checked "npx --yes skills add . --list"
