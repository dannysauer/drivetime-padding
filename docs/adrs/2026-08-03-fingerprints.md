# ADR: Canonical fingerprints

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | How reconciliation decides whether a generated event needs a Calendar write. |
| Related | [route-plan-cache ADR](2026-08-03-route-plan-cache.md); Technical Design §13.2, §14 and §15.2; Architecture §13 |

## Business driver

Reconciliation recomputes every generated event on every run. Without a cheap equality test, every run would rewrite every event, and each write fires the calendar trigger again.

## Constraints

- Unchanged generated events MUST NOT be written.
- The comparison MUST survive Calendar's own re-serialization of what the add-on wrote.

## Decision

**Y statement:** We will store a canonical fingerprint of each generated event's planning inputs in its private metadata and compare fingerprints before writing because a stable hash eliminates unnecessary Calendar writes and the trigger churn they cause, so steady-state runs are read-mostly.

The fingerprint covers planning inputs; owned fields are additionally compared directly so a user edit to a field the fingerprint does not cover is still restored (Technical Design §15.2.1).

## Consequences

- Fingerprints are computed after routing, so they protect Calendar writes but not broker calls. The [route-plan-cache ADR](2026-08-03-route-plan-cache.md) covers that gap.
- Any change to canonicalization (Technical Design §14.2) invalidates every stored fingerprint and forces a one-time rewrite of all generated events.

## Alternatives considered

### Always patch

Write every generated event on every run. Rejected: write quota, trigger churn, and visible calendar activity on every run.

### Compare fields manually without a stored hash

Rejected on its own: it needs the full desired spec and the full observed event for every comparison and is the part of the comparison that is error-prone. It is kept as the second line of defense beside the fingerprint, not instead of it.
