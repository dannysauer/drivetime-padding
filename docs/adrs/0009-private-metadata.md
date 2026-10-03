# ADR 0009: Private Metadata Is the Deletion-Safety Boundary

**Status:** Accepted  
**Date:** 2026-08-03

Problem: reconciliation must delete generated events without ever deleting a user's own events.

Alternatives: Match on title prefix, maintain an external event-ID mapping, or use Calendar private extended properties.

Decision: Identify managed events solely by the private extended property `dtp === '1'`.

Why: Titles are user-editable and localized; an external mapping introduces a consistency problem the rest of the design avoids. Private metadata is stable, invisible to the user, and travels with the event.

Tradeoffs: If a user strips the metadata the event becomes permanently unmanaged and a duplicate will be created alongside it. That is the deliberate safe direction: orphaning is recoverable, deleting someone's real event is not.

## Consequence

This is a safety rule, not a convention. Technical Design §15.3 states it as a hard constraint:

> Delete only events carrying valid private property `dtp === '1'`. Never delete based on title prefix.

Any future code path that deletes Calendar events must be checked against this ADR.
