# ADR 0005: Derived State

**Status:** Accepted  
**Date:** 2026-08-03

Problem: generated events must recover automatically.

Alternatives: External mapping database or derived events.

Decision: Treat generated events as disposable derived state.

Why: Source events remain authoritative and reconciliation recreates missing generated events.

Tradeoffs: Anything the user does to a generated event is silently reverted, which is correct but can feel unresponsive. Recovery depends entirely on metadata surviving; see ADR 0009.
