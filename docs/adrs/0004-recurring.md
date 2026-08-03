# ADR 0004: Recurring Instances

**Status:** Accepted  
**Date:** 2026-08-03

Problem: recurring travel synchronization.

Alternatives: Mirror recurring travel series or reconcile expanded instances.

Decision: Expand recurring instances.

Why: Avoids maintaining a second recurrence graph and exception logic.

Tradeoffs: Generated-event count grows linearly with instances inside the window, and a long window on a daily series produces many one-off events. Bounded by the planning window rather than by series count.
