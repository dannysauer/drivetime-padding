# ADR: Generated events are derived state

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | The authority relationship between source events and the events the add-on creates. |
| Related | [reconciliation ADR](2026-08-03-reconciliation.md), [private-metadata ADR](2026-08-03-private-metadata.md), [route-plan-cache ADR](2026-08-03-route-plan-cache.md); Architecture §3.4, §26.4 and §28 |

## Business driver

Generated events will be deleted, moved, and edited by users, lost to failed runs, and stranded by changing settings. The product promises that none of that needs manual cleanup.

## Constraints

- Source calendar events MUST remain authoritative.
- Recovery MUST NOT depend on state held outside the user's Google account.

## Decision

**Y statement:** We will treat generated events as disposable derived state because the source events and settings fully determine them, so reconciliation can recreate, repair, or delete any generated event at any time without an external mapping database.

A concluded record of a trip already taken is the one exception to disposal: deletion authority stops at the past (Technical Design §15.2.9).

## Consequences

- Anything a user does to an owned field of a live generated event — its times, title, event type, transparency, reminders or auto-decline mode (Technical Design §15.2.1) — is reverted on the next run. Fields the add-on does not own are neither compared nor written (§15.2.1, §16.5), so an added description or color survives an update but not a replacement. That is correct but can feel unresponsive, and the directive syntax (Technical Design §6) is the supported way to change a block.
- Recovery depends entirely on the ownership metadata surviving on the generated event; the [private-metadata ADR](2026-08-03-private-metadata.md) makes that the safety boundary.
- Anything else the add-on stores beside a generated event, such as the route plan cache, inherits this rule: discarding it may cost work but may not change the resulting Calendar state.

## Alternatives considered

### External mapping database

Record each generated event's source in a store the add-on owns. Rejected: a second source of truth that can disagree with Calendar, needs its own hosting, and does not survive the user deleting an event the store still lists.
