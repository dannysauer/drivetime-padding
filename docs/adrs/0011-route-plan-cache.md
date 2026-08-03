# ADR 0011: Route Results Are Derived State

**Status:** Accepted  
**Date:** 2026-08-03

Problem: route calls happen before fingerprint comparison, so fingerprints cannot prevent them. With a trigger that fires on calendar changes, route spend is unbounded by anything the user can see.

Alternatives: Defer the problem, cap spend with broker-side rate limits only, cache route durations in a side store, or cache a route plan alongside the generated event.

Decision: Cache a route plan — input hash, raw duration, and calculation time — in the generated event's own private metadata, reused while the hash matches and the entry is under 24 hours old.

Why: It bounds steady-state cost at two route calls per eligible event per day instead of per trigger firing, and it does so without a new storage system. Treating the cache as derived state keeps it consistent with ADR 0005: discarding it may cost broker calls but cannot change the resulting Calendar state.

Tradeoffs: Durations go stale by up to a day, which is acceptable only because MVP routing is not traffic-aware. A refresh that returns a different duration would rewrite the event, so durations are quantized to 5-minute buckets to absorb the noise. Settings changes invalidate many entries at once, requiring a per-run route ceiling to prevent a stampede.

## Rejected: near-departure refresh

An earlier proposal tiered the cache age by proximity, refreshing every 15–30 minutes inside 24 hours. That was rejected: it reimplements continuous traffic-aware rescheduling, which is an explicit non-goal (Architecture §2.1) and a future item (§27), and it would move the user's travel blocks repeatedly on the day of the appointment.

There is no near-departure refresh in the MVP.
