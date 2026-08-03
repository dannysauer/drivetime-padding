# ADR 0007: Simplify Architecture

**Status:** Accepted  
**Date:** 2026-08-03

Problem: Planner and Capability abstractions increased complexity.

Alternatives: Keep abstractions or simplify.

Decision: Remove Planner and Capability layers from the MVP.

Why: ProviderContext plus direct GeneratedEventSpec output preserves flexibility with much lower complexity.

Tradeoffs: A second padding provider will need this boundary revisited. The bet is that reintroducing an abstraction against two real providers is cheaper than carrying a speculative one against zero.
