# Agent instructions

## Design documents

Read [`docs/INDEX.md`](docs/INDEX.md) before changing the system's behavior. It lists every design document, which kind each one is, and which one wins when two disagree: an Accepted ADR in `docs/adrs/` wins over a living page, and a living page wins over a Proposed ADR or an open design doc. Anything in `docs/open-questions.md` is undecided. Report a conflict instead of silently resolving it.

Living pages describe the current state. When a change alters behavior, update the affected living pages in the same change, and put the history in an ADR, an evidence receipt, or the commit message. A change that contradicts an Accepted ADR needs a superseding record, not an amendment.

Requirements carry stable `REQ-<AREA>-NNN` IDs and RFC 2119 keywords in `docs/requirements/requirements.md`. A test that verifies a requirement names its ID in the test name or a comment, so the requirement can be traced to its proof. Settings for the trellis documentation skills are in `.trellis.yaml`.

## Working rules

The two safety constraints in [`CONTRIBUTING.md`](CONTRIBUTING.md) are not negotiable: never delete a Calendar event that does not carry the private property `dtp === '1'`, and never let a planning failure delete existing generated events.

Run `pre-commit run --all-files` before committing. The Apps Script sources are documented stubs; the hooks check their syntax, the shared global scope, the manifest copy, and the function bodies, eligibility-reason enum and cap literals the technical design duplicates from the sources (plus the broker README's two route-input caps).
