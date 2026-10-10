# ADR: Reconciliation over delta processing

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | How the add-on decides what to create, update, and delete on each run. |
| Related | [derived-state ADR](2026-08-03-derived-state.md), [route-plan-cache ADR](2026-08-03-route-plan-cache.md); Architecture §5 and §14; Technical Design §15 |

## Business driver

Calendar triggers tell the add-on that something on the calendar changed, not which event changed. Any design that processes "the change" first has to find it, and a change it misses stays missed.

## Constraints

- A missed trigger, a failed run, or a partial run MUST NOT leave generated events permanently wrong.
- Retries MUST be safe to repeat.
- Recurring-event exceptions and manual edits to generated events MUST converge without special cases per change type.

## Decision

**Y statement:** We will run a bounded desired-versus-observed reconciliation on every trigger because Calendar triggers do not identify the changed event, so every run is idempotent and self-healing and handles retries, recurring exceptions, and partial failures by the same path.

Each run computes the desired generated events for every eligible source in the planning range, reads the generated events in the observation range, and applies the difference (Technical Design §15).

## Consequences

- Every run costs a full window read regardless of how little changed, which puts a hard floor under per-run execution time and is the direct cause of the route-spend problem the [route-plan-cache ADR](2026-08-03-route-plan-cache.md) solves.
- The engine needs an execution budget and resumable scans (Technical Design §7.2.1 and §23) for calendars too large for one execution.
- No per-event mapping database is needed; the [derived-state ADR](2026-08-03-derived-state.md) follows from this choice.

## Alternatives considered

### Delta processing

React only to the event that changed. Rejected: triggers do not say which event changed, and any inference would miss edits made while the add-on was not running.

### Mapping database

Keep an external table of source-to-generated event links and update it on each change. Rejected: it introduces a consistency problem between the table and Calendar that the rest of the design avoids, and it still cannot identify the changed event.
