# Linting rules for higher-accuracy audit findings

Honor the `linter-tighten` tick only. Omit when unticked, no linter, or
audit absent.

If ticked: read [linters.md](../linters.md) and enable only the in-place
rules for the detected linter. Do not add plugins or packages.

`record-result` immediately (`changed|skipped|failed` + path + remedy).
Do not install a new linter.
