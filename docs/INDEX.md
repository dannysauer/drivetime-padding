# Documentation Index

| # | Document | Kind | Role |
|---|---|---|---|
| 0 | [Engineering handoff](engineering-handoff.md) | Orientation | Read first. |
| 1 | [Architecture](architecture/architecture.md) | Living page | System design and rationale |
| 2 | [Technical design](technical-design/technical-design.md) | Living page | Implementation contracts. **Normative.** |
| 3 | [Requirements](requirements/requirements.md) | Living page with requirements | Numbered, testable behavior |
| 4 | [Developer guide](developer-guide/developer-guide.md) | Living page | Environment and workflow |
| 5 | [Planning](planning/planning.md) | Planning | Milestones, spikes, backlog |
| 6 | [ADRs](adrs/README.md) | Decision records | One durable decision each, with the alternatives it beat |
| — | [Open questions](open-questions.md) | Planning | What is **not** decided |

## Supporting documents

- [Architecture diagrams](architecture/diagrams.md)
- [Manifest example](architecture/appsscript-manifest.example.json) — kept identical to `src/apps-script/appsscript.json` by CI
- [Interface reference](technical-design/interfaces.md)
- [Worked examples](technical-design/examples.md)
- [Acceptance scenarios](requirements/acceptance-scenarios.md)
- [Traceability matrix](requirements/traceability.md)
- [Design docs](design/README.md) — open or contested choices worked through before a decision; none yet
- [Evidence](planning/evidence/README.md) — dated receipts that prove a claim; none yet

## Document kinds

The documents follow the trellis document model. Each kind has one job, and the job decides how it changes:

- An **ADR** records one durable decision. It is edited freely while Draft or Proposed and append-only once Accepted; a changed decision is a new record that supersedes the old one.
- A **living page** describes the system as it is now and is rewritten to match reality. It never accumulates dated history; the history goes to an ADR, an evidence receipt, or the git log.
- A **requirement** lives inside a living page, states one testable obligation with a stable `REQ-<AREA>-NNN` ID and an RFC 2119 keyword, and is edited in place. Its ID never changes and is never reused.
- A **design doc** works through a choice before it is decided, then freezes and is linked from the resulting ADR.
- **Evidence** is a dated receipt and is never edited.

## Precedence

When documents disagree:

1. An **Accepted ADR** wins. A living page is supposed to describe the accepted decision, so a conflict means the page is wrong or a superseding record is missing.
2. **Living pages** describe the current system and outrank direction-only documents. Among them, the technical design is normative for implementation contracts, the architecture for structure and rationale, the requirements for observable behavior, and Architecture §25 for implementation phase order; planning milestones defer to it.
3. A **Proposed ADR** (today, the [oauth-scope-strategy ADR](adrs/2026-08-03-oauth-scope-strategy.md)) or an open design doc describes direction only.

Anything in [open-questions.md](open-questions.md) is undecided and overrides an apparently confident statement elsewhere. Report a conflict rather than silently resolving it.
