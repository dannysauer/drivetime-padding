# ADR 0001: Use Google Apps Script

**Status:** Accepted  
**Date:** 2026-08-03

Problem: easy Marketplace installation versus Python.

Alternatives: Cloud Run app, self-hosted service, Apps Script.

Decision: Use Apps Script.

Why: Native Calendar triggers, CardService UI, and minimal operations outweighed the preference for Python.

Tradeoffs: JavaScript and execution limits are accepted for dramatically simpler deployment. This ADR cites installable triggers as a reason to choose Apps Script, and that capability is not yet validated for Marketplace-installed add-ons — see Prototype Spike 1 in `docs/open-questions.md`. A negative result would undermine part of this decision's rationale.
