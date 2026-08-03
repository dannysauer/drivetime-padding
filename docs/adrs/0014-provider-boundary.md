# ADR 0014: Providers Return Specifications

**Status:** Accepted  
**Date:** 2026-08-03

Problem: where the boundary sits between padding calculation and Calendar mutation.

Alternatives: Providers write their own events, providers return patch operations, or providers return desired-state specifications.

Decision: Providers return immutable `GeneratedEventSpec` objects and never call the Calendar API.

Why: Reconciliation, idempotency, metadata, and deletion safety stay in one place. A provider that cannot write cannot violate ADR 0009, and provider logic stays pure enough to unit test without Calendar.

Tradeoffs: Providers cannot express operations that do not fit the spec shape. For the drivetime provider — two events with times, a type, and metadata — that has not been a constraint.
