# Contributing

## Setup

```bash
pip install pre-commit
pre-commit install
```

The same hooks run in CI via `pre-commit run --all-files`, so anything that passes locally passes there. Add new checks to `.pre-commit-config.yaml` rather than to the workflow — the workflow deliberately contains no checks of its own.

Today the hooks cover file hygiene, Markdown linting, Apps Script syntax, and the manifest-matches-docs invariant. A JavaScript linter and formatter following Google's JavaScript style guide will be added when implementation starts.

## Working here

1. Read the [architecture](docs/architecture/architecture.md) and [technical design](docs/technical-design/technical-design.md).
2. Check [open questions](docs/open-questions.md) — some sections are blocked on prototype spikes.
3. Update documentation before changing behavior.
4. Add or update tests with every behavioral change.
5. Reference requirement IDs (`REQ-*`) and scenarios (`AC-*`) in pull requests where they apply.
6. Keep reconciliation deterministic. Inject `now`; do not read the clock inside business logic.
7. Treat generated events as derived state — and route results likewise.
8. Submit focused pull requests.

## Two rules that are not negotiable

- **Never delete a Calendar event that does not carry the private property `dtp === '1'`** (ADR 0009). Title matching is prohibited.
- **A planning failure must not delete existing generated events** (Technical Design §17.4). Only `planned` and `ineligible` outcomes grant deletion authority.

Any pull request touching deletion logic should say explicitly how it honors both.

## Changing a decision

Decisions live in [ADRs](docs/adrs/README.md). If a change contradicts one, amend the ADR in the same pull request — including its tradeoffs — rather than leaving the record stale.
