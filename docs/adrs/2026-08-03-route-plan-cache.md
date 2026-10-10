# ADR: Route results are derived state

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | How route durations are cached, how long they are trusted, and what bounds route spend per run. |
| Related | [reconciliation ADR](2026-08-03-reconciliation.md), [fingerprints ADR](2026-08-03-fingerprints.md), [derived-state ADR](2026-08-03-derived-state.md); Technical Design §11.1, §12.3, §13.3, and §23.3; REQ-PERF-009 through REQ-PERF-012 |

## Business driver

Reconciliation recomputes every eligible source on every run, and the calendar trigger fires on calendar changes. Route calls happen before fingerprint comparison, so fingerprints cannot prevent them. Without a cache, route spend scales with editing activity rather than with appointments and is bounded by nothing the user can see.

## Constraints

- Discarding cached route data MUST NOT change the resulting Calendar state ([derived-state ADR](2026-08-03-derived-state.md)).
- Steady-state route spend MUST be bounded per eligible event per day, not per trigger firing, except that a direction with no companion to carry a durable entry (a zero-padding or ended role) relies on the ephemeral tier below and is hard-bounded only by the per-run ceiling (REQ-PERF-009, REQ-PERF-010).
- No storage system beyond Calendar, the add-on's own User Properties, and Apps Script's best-effort `CacheService` may be introduced.

## Decision

**Y statement:** We will cache a route plan (input hash, raw duration, and calculation time) in the generated event's own private metadata and reuse it while the hash matches and the entry is under 24 hours old because that bounds steady-state cost at two route calls per eligible event per day without a new storage system, so route spend follows appointments rather than edits.

The bound is enforced by a per-run route ceiling (Technical Design §23.3). A best-effort `CacheService` tier keyed by the same route input hash sits in front of the durable entry (Technical Design §11.1 and §20.3): the routing client writes every broker result to it, so diagnostics and directions with no durable carrier reuse a route within its short TTL without a Calendar write. Losing that tier costs broker calls and nothing else. There is no near-departure refresh in the MVP.

## Consequences

- Durations go stale by up to a day. That is acceptable only because MVP routing is not traffic-aware.
- A refresh that returns a slightly different duration would rewrite the event, so durations are quantized to 5-minute buckets to absorb the noise (Technical Design §12.3).
- Settings changes invalidate many entries at once, which the per-run route ceiling turns into several runs instead of a stampede.
- Deterministic route failures are cached as well, so an unroutable address costs one attempt per day rather than one per run (Technical Design §11.1).

## Alternatives considered

### Keep the current approach: route on every run

Rejected: unbounded spend that scales with trigger frequency, the one cost nobody can see or cap.

### Broker-side rate limits only

Rejected on its own: a rate limit turns overspend into failed runs rather than removing the cause. The broker keeps per-caller limiting as a backstop.

### Cache durations in a durable side store

Rejected as the durable carrier: a second store with its own consistency and cleanup, when the generated event already carries private metadata that travels with it. The ephemeral `CacheService` tier is not this: it is best-effort, expires on its own, and is never authoritative.

### Near-departure refresh

Refresh entries every 15 to 30 minutes inside the last 24 hours before a trip. Rejected: it reimplements continuous traffic-aware rescheduling, an explicit non-goal (Architecture §2.1) and a future item (Architecture §27), and it would move the user's travel blocks repeatedly on the day of the appointment.
