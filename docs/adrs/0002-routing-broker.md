# ADR 0002: Cloud Run Routing Broker

**Status:** Accepted  
**Date:** 2026-08-03

Problem: protect Maps credentials.

Alternatives: Direct Routes API from Apps Script, embedded API key, Cloud Run broker.

Decision: Use a Cloud Run broker.

Why: Centralizes credentials, billing, quotas, logging, and response normalization.

Tradeoffs: The project takes on an availability dependency, an operational surface, and a Maps bill that scales with adoption rather than with the user's own quota. Public-release authentication remains unresolved and is a release blocker (Technical Design §21.7).
