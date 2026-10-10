# ADR: Reconciliation window boundaries

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | Which source events each run plans, which generated events each run reads, and the duration caps that make both ranges finite. |
| Related | [reconciliation ADR](2026-08-03-reconciliation.md); Technical Design §7.2; REQ-ELIG-007, REQ-TIME-011, REQ-TIME-012, REQ-TIME-014 |

## Business driver

`Events.list` bounds `timeMin` on an event's end time and `timeMax` on its start time. Generated events sit outside their source in time, so a naive window of `[now, now + windowDays)` leaks at both edges: the outbound block of an in-progress appointment has already ended and is invisible while its source is still returned, and the return block of a source that runs past the horizon starts beyond `timeMax` while its source is returned. In both cases reconciliation cannot see the block it wants and creates a duplicate on every run, and duplicate convergence cannot help because the duplicates are outside the range being read.

## Constraints

- Every companion of a planned source MUST be inside the range the run reads, or the run will duplicate it.
- A source still in progress MUST keep its return block; skipping past-start sources would empty their desired state and orphan-delete their return blocks mid-appointment.
- Both ranges MUST be finite and derivable from constants, not tuned by example.

## Decision

**Y statement:** We will keep two ranges, a planning range that decides which sources are evaluated and a strictly wider observation range that decides which generated events are read, with eligibility by temporal intersection and a symmetric observation margin derived from the duration caps, because the leak is symmetric and the margin has to be provable, so every companion of every planned source is inside what the run reads.

```text
COMPANION_SPAN  = MAX_TRAVEL_MINUTES + MAX_BUFFER_MINUTES          = 480 minutes
OBSERVE_MARGIN  = MAX_SOURCE_DURATION + COMPANION_SPAN            = 1920 minutes

planStart       = now - COMPANION_SPAN
planEnd         = now + windowDays
observeStart    = planStart - OBSERVE_MARGIN
observeEnd      = planEnd   + OBSERVE_MARGIN

planned iff     source.end > planStart  AND  source.start < planEnd
```

Technical Design §7.2 carries the completeness derivation showing that both companions of any planned source, with duration bounded by `MAX_SOURCE_DURATION`, lie inside the observation range. Any change to either range MUST be checked against that derivation rather than against an example.

Eligibility is intersection, not start time, because a long-running source that began before the lookback is still in progress (at noon, an 01:00 to 18:00 event) and still needs its return block; a start-time test would mark it outside the window, and ineligibility carries deletion authority.

## Consequences

- Every run reads and re-plans up to eight hours of past sources and reads generated events from 40 hours back to 32 hours past the planning horizon. The route cache makes re-planning nearly free, but the listing is larger and the execution budget orders upcoming sources ahead of ones already underway (Technical Design §23.2).
- `MAX_TRAVEL_MINUTES` (six hours) is a hard cap, not a guideline: a route longer than the companion span would reintroduce the duplicate, so longer routes produce a diagnostic and no generated events (REQ-TIME-012).
- `MAX_SOURCE_DURATION_MINUTES` (24 hours) bounds how far a companion can sit from the planning range; timed sources longer than that are ineligible with reason `SOURCE_TOO_LONG` (REQ-TIME-014). Without it the observation range has no finite bound.

## Alternatives considered

### Keep the current approach: a single forward window

Rejected: duplicates at both edges on every run, uncatchable by convergence.

### Skip sources that have already started

Rejected: it empties the desired state of an in-progress appointment and deletes its still-needed return block.

### Extend only the near edge, by a fixed lookback

A three-hour lookback, or one equal to the companion span, fixes the near edge alone. Rejected: the far edge leaks in mirror image, a fixed figure smaller than the companion span is provably insufficient, and a lookback without a wider observation range still cannot see companions of long sources.

### Eligibility by start time inside the planning range

Rejected: it excludes an in-progress source that started before the lookback and, because ineligibility carries deletion authority, deletes its return block mid-appointment.
