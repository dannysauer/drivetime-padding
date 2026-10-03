# Documentation Index

| # | Document | Role |
|---|---|---|
| 0 | [Engineering handoff](engineering-handoff.md) | Orientation. Read first. |
| 1 | [Architecture](architecture/architecture.md) | System design and rationale |
| 2 | [Technical design](technical-design/technical-design.md) | Implementation contracts. **Normative.** |
| 3 | [Requirements](requirements/requirements.md) | Numbered, testable behavior |
| 4 | [Developer guide](developer-guide/developer-guide.md) | Environment and workflow |
| 5 | [Planning](planning/planning.md) | Milestones, spikes, backlog |
| 6 | [ADRs](adrs/README.md) | Decisions with tradeoffs |
| — | [Open questions](open-questions.md) | What is **not** decided |

## Supporting documents

- [Architecture diagrams](architecture/diagrams.md)
- [Architecture review record](architecture/review-record.md) — what changed under review and why
- [Manifest example](architecture/appsscript-manifest.example.json) — kept identical to `src/apps-script/appsscript.json` by CI
- [Interface reference](technical-design/interfaces.md)
- [Worked examples](technical-design/examples.md)
- [Acceptance scenarios](requirements/acceptance-scenarios.md)
- [Traceability matrix](requirements/traceability.md)

## Precedence

When documents disagree:

1. Technical design is normative for implementation contracts.
2. Architecture is normative for structure and rationale.
3. Requirements are normative for observable behavior.
4. Architecture §25 is canonical for implementation phase order; planning milestones defer to it.

Anything in [open-questions.md](open-questions.md) is undecided and overrides an apparently confident statement elsewhere.
