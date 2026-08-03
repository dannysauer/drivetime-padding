# ADR 0008: Primary Calendar Only

**Status:** Accepted  
**Date:** 2026-08-03

Problem: which calendars the MVP manages.

Alternatives: All accessible calendars, user-selected calendars, primary only.

Decision: Manage only the authenticated user's primary calendar.

Why: Keeps configuration, permissions, triggers, and cleanup behavior predictable, and avoids reasoning about events the user does not own.

Tradeoffs: Users who keep appointments on a secondary calendar get nothing from the product. Adding calendars later means a settings migration and a larger read cost per reconciliation.
