# Project Planning and Backlog

## Vision

Deliver an installable Google Workspace Marketplace add-on that automatically maintains travel-time padding around qualifying Google Calendar events, with minimal configuration and operational overhead.

## Guiding principles

- Ship a narrow MVP.
- Preserve architectural quality.
- Favor deterministic reconciliation over heuristics.
- Keep generated events disposable.
- Defer optional features until core synchronization is proven.
- Validate platform assumptions before building on them.

## Relationship to the other documents

Architecture §25 defines the **implementation phases** — what gets built in what order, and why Phase 3 uses a fixed duration to prove the engine before the broker exists. That sequence is canonical.

This document tracks **milestones, spikes, backlog, and exit criteria**. Where the two overlap, Architecture §25 wins.

---

## M0 Prototype spikes

Runs before implementation. Both spikes can proceed in parallel; neither depends on any code being written.

| Spike | Question | Blocks |
|---|---|---|
| Spike 1 | Can Marketplace-installed add-ons create installable Calendar triggers, and how often do they fire? | Architecture §15/§16, TD §19, ADR 0001 |
| Spike 2 | Scope classification and minimum viable scope set | Manifest, ADR 0013, Marketplace timeline |

Full question lists in [`../open-questions.md`](../open-questions.md).

**Exit:** both spikes reported. Spike 1 either confirms the trigger model or produces a redesign proposal. Spike 2 produces a scope set and moves ADR 0013 to Accepted.

Spike 1 is the higher risk of the two. A negative result invalidates the trigger lifecycle, the concurrency model, window advancement, and part of the runtime decision — so it is worth answering before anything is built on top of it.

## M1 Repository bootstrap

Work: repository, documentation set, CI, project skeleton.

**Exit:** architecture and technical design approved; documentation merged; Apps Script project compiles and deploys to a development account.

## M2 Foundation

Work: settings load/save/validate/migrate; trigger installation and repair; run status; locking; structured logging.

**Exit:** a manual synchronization entry point exists and records a run status.

## M3 Calendar engine

Work: `CalendarRepository` with pagination; normalization; eligibility with reason codes; directive parsing; fingerprints; dry-run reconciliation.

**Exit:** a complete diff is produced with zero writes, including for the in-progress-event case.

## M4 Generated events

Work: fixed-duration provider; create, update, delete; orphan cleanup; recurring instance support; duplicate convergence.

**Exit:** synchronization proven end to end **without any routing**. This milestone is deliberately routing-free, so the engine can be validated while broker authentication is still unresolved.

## M5 Routing

Work: Cloud Run broker; Routes API integration; route plan cache; per-run route ceiling; duration quantization; origin resolution; working location.

**Exit:** real travel durations, and a measured route-call count per reconciliation matching the cost model in Technical Design §23.3.

## M6 Marketplace

Work: OAuth verification; privacy policy; support documentation; listing assets; beta.

**Exit:** public beta available.

Cannot start until broker authentication is resolved — it is a hard release blocker (Technical Design §21.7).

---

## Backlog

**Priority 0** — core reconciliation; trigger lifecycle; event metadata; route broker; route plan cache.

**Priority 1** — working location; Place IDs; richer diagnostics; cleanup UI.

**Priority 2** — additional travel modes; multiple calendars; smarter buffering.

**Priority 3** — additional providers; organization policy; analytics.

---

## Risks

| Risk | Mitigation | Status |
|---|---|---|
| Installable triggers unavailable to Marketplace add-ons | Spike 1 before implementation | **Open — highest** |
| Broker authentication unsolved | Phases 1–4 avoid the broker entirely | Open — blocks release only |
| Route spend scaling with trigger frequency | Route plan cache and per-run ceiling (ADR 0011) | Mitigated in design, unmeasured |
| Scope tier affecting verification cost | Spike 2 | Open |
| Apps Script quotas over the widened window | Beta measurement; execution budget with partial runs | Open |
| Calendar API edge cases, especially OOO writes | Live-account validation list in open-questions | Open |
| Marketplace review delays | Begin verification during M5 | Open |

Standing mitigations: dry-run mode, daily reconciliation, fingerprints, bounded window, route cache.

---

## Success metrics

- Installation under five minutes.
- Zero manual cleanup in ordinary use.
- Reconciliation under 10 seconds for a typical calendar.
- No duplicate generated events, including for in-progress appointments.
- Automatic recovery after failures.
- Steady-state route calls at two per eligible event per day, not per trigger firing.

## Definition of done

Architecture implemented; requirements satisfied; unit and integration tests passing; the 19 checks in Technical Design §25 met; Marketplace documentation complete; beta validation complete.

## Future roadmap

After MVP: additional providers; more routing modes; shared calendars; rule engine; traffic-aware refresh near departure (explicitly excluded from the MVP by ADR 0011).
