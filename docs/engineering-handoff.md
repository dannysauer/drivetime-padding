# Engineering Handoff

## Executive Summary

Drivetime Padding is intentionally a small, focused Google Workspace Marketplace add-on. Its purpose is to create and maintain travel-time events around qualifying Google Calendar events.

The most important architectural idea is:

> Generated events are **derived state**.

Source calendar events are authoritative. Generated events may be deleted, recreated, or repaired at any time through reconciliation.

## Read This First

1. This handoff guide
2. [`open-questions.md`](open-questions.md) — what is not decided, and what blocks you
3. [Architecture](architecture/architecture.md)
4. [Technical design](technical-design/technical-design.md)
5. [Requirements](requirements/requirements.md)
6. Remaining documents as needed

## Before You Write Code

Two prototype spikes block implementation. Neither requires any code from this repository.

- **Spike 1 — installable triggers.** The whole synchronization model assumes a Marketplace-installed add-on can create Calendar triggers on the user's behalf. That has never been tested, and ADR 0001 cites those triggers as a reason to choose Apps Script. A negative result reopens the runtime decision.
- **Spike 2 — OAuth scopes.** Scope tier drives verification cost and timeline.

Broker authentication is unresolved too, but it blocks *release*, not implementation. Phases 1 through 4 use a fixed 15-minute travel duration and never call the broker — that sequencing is deliberate, so the engine can be proven while the hardest external question stays open.

## What Matters Most

- Reconciliation is the product.
- Do not build delta-processing logic.
- Keep Apps Script thin.
- Treat Calendar as the source of truth.
- Keep routing behind the Cloud Run broker.
- Minimize Calendar writes using fingerprints.
- Minimize *broker calls* using the route plan cache — fingerprints cannot do this, because they are computed after routing.

## Two Rules That Are Safety Constraints

Everything else is a preference. These two are not.

**Never delete an event that does not carry `dtp === '1'`** (ADR 0009). Not by title, not by prefix, not by any heuristic. Orphaning a generated event is recoverable; deleting someone's real appointment is not.

**A planning failure must never delete existing generated events** (Technical Design §17.4). Only `planned` and `ineligible` outcomes grant deletion authority. If the broker is down, or a route is too long, or the run hit its route ceiling, the user's existing travel blocks stay exactly where they are. A backend outage must not erase a calendar.

## Important Design Changes

During architecture review we intentionally simplified the design:

- Removed the separate Planner layer.
- Removed the generalized Capability framework.
- Kept a CalendarRepository abstraction.
- Kept ProviderContext.
- Kept fingerprints.
- Renamed the core orchestrator to ReconciliationEngine.

A second review round added four more, all incorporated:

- **Route results are cached derived state** (ADR 0011). Without this, every reconciliation cost two broker calls per eligible event, and the calendar trigger fires on calendar changes — so spend scaled with editing activity rather than with appointments.
- **The read window extends backward** by `MAX_TRAVEL_MINUTES + maxBufferMinutes`, currently 8 hours (ADR 0012). Outbound blocks start before their source, so without a lookback an in-progress appointment's outbound block was invisible and got recreated on every run.
- **Durations quantize to 5-minute buckets** before reaching event times or fingerprints, so refreshing an expired cache entry does not rewrite unchanged events.
- **Trigger feasibility and scope strategy became spikes** rather than assumptions.

The review record in [architecture/review-record.md](architecture/review-record.md) has the full account.

## Open Questions

Tracked in [`open-questions.md`](open-questions.md). The short version:

- Spike 1: installable trigger feasibility — blocks implementation.
- Spike 2: OAuth scope classification — blocks the manifest.
- Broker authentication — blocks public release.
- Calendar API semantics for creating OOO events, especially whether they carry private extended properties. If they do not, ADR 0009's safety boundary does not hold for the product's primary event type.
- Working-location behavior across consumer and Workspace accounts.
- Apps Script quota measurement during beta.

## Coding Order

Architecture §25 is canonical. Expanded:

1. Settings — load, validate, migrate
2. Trigger installation *(after Spike 1 reports)*
3. CalendarRepository, with pagination from the start
4. Event normalization
5. Eligibility with reason codes
6. Directive parser
7. Fingerprint generation
8. ReconciliationEngine, dry-run first
9. Fixed-duration provider — proves the whole engine with no broker
10. Routing broker
11. Route plan cache and per-run ceiling
12. Real route durations
13. UI polish

Steps 1 through 9 need no broker and no Maps billing. Get to a green dry-run diff before anything talks to the network.

## Testing Priorities

Highest ROI:

- Reconciliation engine
- Recurring event fixtures
- Fingerprints
- Directive parsing

Lower priority:

- CardService UI

## Marketplace Checklist

- OAuth verified
- Privacy Policy
- Support URL
- Listing assets
- Cloud Run deployed
- Secret Manager configured

## Known Risks

- Calendar trigger feasibility — highest, unvalidated, and load-bearing
- Apps Script quotas over the widened window
- Routing costs — mitigated in design by ADR 0011, but unmeasured
- Marketplace review time
- OOO event write semantics, including whether extended properties survive

## Success Criteria

A successful MVP allows a user to:

- install from Marketplace;
- configure an origin;
- create an OOO event;
- receive travel events automatically;
- move or cancel the appointment;
- have travel events update automatically;
- never manually maintain generated events.

## Advice to Future Maintainers

Resist adding features before proving the synchronization engine.

If a future feature complicates reconciliation, reconsider the feature rather than weakening reconciliation.

Always optimize for correctness before optimization.

Keep generated events disposable.

That philosophy has the highest long-term payoff.
