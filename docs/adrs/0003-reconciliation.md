# ADR 0003: Reconciliation

**Status:** Accepted  
**Date:** 2026-08-03

Problem: Calendar triggers do not identify the changed event.

Alternatives: Delta processing, mapping database, reconciliation.

Decision: Use bounded desired-versus-observed reconciliation.

Why: Idempotent, self-healing, naturally handles retries, recurring exceptions, and partial failures.

Tradeoffs: Every run costs a full window read regardless of how little changed. This is the direct cause of the route-spend problem addressed by ADR 0011, and it puts a hard floor under per-run execution time.
