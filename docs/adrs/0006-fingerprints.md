# ADR 0006: Fingerprints

**Status:** Accepted  
**Date:** 2026-08-03

Problem: repeated reconciliation rewrites unchanged events.

Alternatives: Always patch, compare fields manually, fingerprints.

Decision: Store canonical fingerprints.

Why: Eliminates unnecessary Calendar writes and trigger churn.

Tradeoffs: Fingerprints are computed after routing, so they protect Calendar writes but not broker calls — the expensive operation happens before the optimization. ADR 0011 addresses that gap. Any change to canonicalization invalidates every stored fingerprint and forces a one-time rewrite of all generated events.
