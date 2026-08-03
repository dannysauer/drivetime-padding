# ADR 0012: Reconciliation Lower Boundary

**Status:** Accepted  
**Date:** 2026-08-03

Problem: outbound travel blocks start before their source event, so a block for an in-progress appointment has already ended and is invisible to a `timeMin: now` query — while its source event is still returned and still eligible. Reconciliation creates a duplicate on every run.

Alternatives: Skip planning source events that have already started, special-case in-progress events, or extend the read window backward.

Decision: Extend the read window backward by `MAX_TRAVEL_MINUTES + maxBufferMinutes` (360 + 120 = 480 minutes) and keep planning source events that have already started.

Why: Symmetry is not just tidier here, it is required. Skipping past-start sources would empty their desired state and orphan-delete their return blocks mid-appointment. Deriving the lookback from the maximum supported travel makes it provably sufficient rather than a guess — an earlier proposal of three hours was already too small given the 120-minute maximum buffer.

Tradeoffs: Every run reads and re-plans up to eight hours of past events. The route cache makes re-planning nearly free, but the listing is larger and the execution budget must prioritize upcoming events over ones already underway.

## Dependency

This ADR is why `MAX_TRAVEL_MINUTES` exists as a hard cap rather than a guideline. A route longer than the lookback would reintroduce the duplicate-creation bug, so routes exceeding six hours produce a diagnostic and no generated events.
