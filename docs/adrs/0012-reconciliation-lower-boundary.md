# ADR 0012: Reconciliation Window Boundaries

**Status:** Accepted  
**Date:** 2026-08-03

Problem: outbound travel blocks start before their source event, so a block for an in-progress appointment has already ended and is invisible to a `timeMin: now` query — while its source event is still returned and still eligible. Reconciliation creates a duplicate on every run.

Alternatives: Skip planning source events that have already started, special-case in-progress events, or extend the read window backward.

Decision: Extend the read window backward by `MAX_TRAVEL_MINUTES + maxBufferMinutes` (360 + 120 = 480 minutes) and keep planning source events that have already started.

Why: Symmetry is not just tidier here, it is required. Skipping past-start sources would empty their desired state and orphan-delete their return blocks mid-appointment. Deriving the lookback from the maximum supported travel makes it provably sufficient rather than a guess — an earlier proposal of three hours was already too small given the 120-minute maximum buffer.

Tradeoffs: Every run reads and re-plans up to eight hours of past events. The route cache makes re-planning nearly free, but the listing is larger and the execution budget must prioritize upcoming events over ones already underway.

## Amendment: the far edge leaks too

Review of PR #2 found the mirror-image bug at the other end of the window, which this ADR originally missed.

`Events.list` bounds `timeMin` on an event's **end** time but `timeMax` on its **start** time. A source event starting just before the window closes but running past it is returned, while its return block — starting at `source.end`, beyond `timeMax` — is not. Same unbounded duplicate creation as the near edge, same inability of duplicate convergence to catch it.

Extending the window backward was therefore only half the fix. The decision is now stated in terms of **two ranges**:

```text
planStart    = now - COMPANION_SPAN
planEnd      = now + windowDays
observeStart = planStart - COMPANION_SPAN
observeEnd   = planEnd + MAX_SOURCE_DURATION + COMPANION_SPAN
```

Source events are planned by start time within `[planStart, planEnd)`; generated events are read over the observation range. Technical Design §7.2 carries the completeness derivation showing every companion of a planned source falls inside it.

## Dependency

This ADR is why `MAX_TRAVEL_MINUTES` exists as a hard cap rather than a guideline: a route longer than the span would reintroduce the duplicate-creation bug, so routes exceeding six hours produce a diagnostic and no generated events.

The amendment adds a second cap for the same reason. `MAX_SOURCE_DURATION_MINUTES` (24 hours) bounds how far past `planEnd` a return block can land; without it the observation range has no finite upper bound. Timed source events longer than a day are ineligible with reason `SOURCE_TOO_LONG`.
