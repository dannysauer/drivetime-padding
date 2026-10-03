# ADR 0010: Route Data Minimization

**Status:** Accepted  
**Date:** 2026-08-03

Problem: the broker is a third destination for user calendar data.

Alternatives: Send the full event for context, send origin/destination/mode only, or resolve routes entirely client-side.

Decision: Send only origin, destination, travel mode, and an opaque correlation ID.

Why: The broker needs nothing else to compute a route. Event titles, descriptions, attendees, and calendar identifiers never leave the user's Google account.

Tradeoffs: Broker-side debugging is harder without event context, and correlating a user report to a specific request depends on the opaque ID alone. Accepted deliberately.

## Consequence

This ADR backs a user-facing privacy claim in the Marketplace listing and in Architecture §20.4. Changing the broker payload changes what the product promises, and requires updating both.
