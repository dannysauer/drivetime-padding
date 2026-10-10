# ADR: Providers return specifications

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | The boundary between padding calculation and Calendar mutation. |
| Related | [simplified-architecture ADR](2026-08-03-simplified-architecture.md), [private-metadata ADR](2026-08-03-private-metadata.md), [route-plan-cache ADR](2026-08-03-route-plan-cache.md); Technical Design §12 and §17.4 |

## Business driver

Padding calculation needs route data and settings; Calendar mutation needs ownership checks, fingerprints, metadata, and deletion safety. Mixing the two puts the safety rules in every provider.

## Constraints

- Reconciliation, idempotency, metadata, and deletion safety MUST live in one place.
- Provider logic MUST be unit-testable without Calendar.
- A provider MUST NOT be able to violate the [private-metadata ADR](2026-08-03-private-metadata.md).

## Decision

**Y statement:** We will have providers return immutable `GeneratedEventSpec` objects and never call the Calendar API because a provider that cannot write cannot break the deletion boundary, so the safety rules stay in the engine and provider logic stays pure.

The provider computes desired state and knows nothing about infrastructure: it passes the observed route-cache entry through to the routing client, which alone decides whether a cached route is still usable (Technical Design §12.1 and §13.3), and the engine copies the route-cache metadata the provider returns into the event without inspecting it.

## Consequences

- Providers cannot express operations that do not fit the spec shape. For the drivetime provider, two events with times, a type, and metadata, that has not been a constraint.
- Planning failures are provider outcomes the engine records; only `planned` and `ineligible` outcomes grant deletion authority (Technical Design §17.4).

## Alternatives considered

### Providers write their own events

Rejected: every provider would reimplement ownership checks, fingerprints, and conditional writes, and one mistake in any of them deletes a user's event.

### Providers return patch operations

Rejected: the provider would need the observed state to compute a patch, pulling the comparison and its safety rules back into the provider.
