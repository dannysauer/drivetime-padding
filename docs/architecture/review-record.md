# Architecture Review Record

This record captures refinements made while expanding and reviewing the initial design.

## Accepted refinements

- Rename the central component to `ReconciliationEngine`.
- Treat generated events as disposable derived state.
- Keep a Calendar repository abstraction.
- Keep immutable generated-event specifications.
- Keep fingerprints.
- Keep dry-run support.
- Keep provider context as a stable API.
- Keep a Cloud Run routing broker.
- Use recurring instance reconciliation rather than mirrored series.
- Surface trigger health and last-run status.

## Simplifications

The following proposed abstractions were removed from the MVP architecture:

- a separate Planner layer;
- a generalized Capability registry;
- provider version metadata;
- a large initial module tree;
- namespaced planning IDs.

These may be introduced later if concrete requirements justify them.

---

## Second review round

A subsequent review found four issues in the expanded design. All four were accepted and are now incorporated.

### Route-call volume was unbounded

Fingerprints prevent Calendar writes but are computed *after* routing, so they could never prevent broker calls. With a trigger that fires on calendar changes, route spend scaled with editing activity rather than with appointments.

Resolved by ADR 0011: route results become cached derived state, reused while the route input hash matches and the entry is under 24 hours old.

A proposed near-departure refresh tier was rejected — it would have reimplemented continuous traffic-aware rescheduling, an explicit non-goal.

### The near window edge created duplicates

Outbound blocks start before their source event, and `timeMin` bounds an event's *end* time, so the outbound block of an in-progress appointment was invisible while its source remained eligible. Reconciliation recreated it on every run, and duplicate convergence could not help because the duplicates fell outside the read window.

Resolved by ADR 0012: the read window extends backward by `MAX_TRAVEL_MINUTES + maxBufferMinutes`. An initially proposed three-hour lookback was rejected as unsound given the 120-minute maximum buffer.

### Trigger feasibility was assumed, never validated

The design asserted installable Calendar triggers throughout and omitted the question from the prototype-validation list, while ADR 0001 cited those triggers as a *reason* to choose Apps Script.

Resolved by promoting it to Prototype Spike 1, ahead of implementation.

### Scope strategy was a manifest detail, not a decision

The manifest requested the broad `calendar` scope by default. Scope tier drives verification cost and timeline, and potentially the viability of a free add-on.

Resolved by ADR 0013 and Prototype Spike 2.

Note that an intermediate claim during review — that `auth/calendar` is a *restricted* scope requiring a CASA assessment with annual renewal — is probably wrong and has been corrected in ADR 0013. Calendar scopes are believed to be sensitive, which means verification time but not a paid annual assessment. Neither position has been verified against Google's current published list, which is precisely why it became a spike rather than a conclusion.

### Also corrected

- The manifest's hardcoded `America/Chicago` timezone would have run every user's daily reconciliation at 3am Central. Replaced with `Etc/UTC` plus per-user hour conversion.
- `openid` will not be added to the manifest until broker authentication is chosen.
- Duration quantization added, so refreshing an expired cache entry does not rewrite unchanged events or visibly move travel blocks.
- Execution-budget ordering changed to upcoming-events-first, since the widened window means plain ascending start order would begin in the past.

---

## Open implementation questions

Consolidated in [`../open-questions.md`](../open-questions.md), which is the single source of truth for unresolved items.

Two spikes block implementation: trigger feasibility and scope classification. Broker authentication blocks public release but not Phases 1–4.
