# Eval fixtures

Consuming-repository assumptions live here and under `tests/fixtures/`,
never in canonical skill logic.

| Path                                   | Language / state                                  | Used by                           |
| -------------------------------------- | ------------------------------------------------- | --------------------------------- |
| `tests/fixtures/repos/valid`           | TypeScript monorepo with Package Layout           | setup, audit, architecture        |
| `tests/fixtures/repos/placeholder`     | TODO responsibilities, no Dependency Direction    | audit/architecture stop cases     |
| `evals/fixtures/repos/fix-ready`       | Audit run with INDEX + action items + source      | ep-fix batch / decision           |
| `evals/fixtures/repos/fix-interrupted` | `001` is `in_progress` with a partial source diff | ep-fix resume                     |
| `evals/fixtures/repos/fix-no-index`    | Audit dir without INDEX.md                        | ep-fix stop                       |
| `tests/fixtures/audit-runs/*`          | findings.md unit seams                            | audit-state tests, not ep-fix e2e |

Assertion types: `consent_asked`, `allowed_write`, `forbidden_write`,
`stop_message`, `status`, `no_source_edit`, `no_git_add_all`,
`forbidden_skill`, `advisory`, `writes_only_declared_files`.
