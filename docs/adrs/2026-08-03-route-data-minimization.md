# ADR: Route data minimization

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | What the add-on sends to the routing broker and what the broker records. |
| Related | [routing-broker ADR](2026-08-03-routing-broker.md); Technical Design §11, §17.2, §20.2, §21.1, and §21.6; Architecture §19.5 and §20.4; REQ-PRIV-005 |

## Business driver

The broker is a third destination for the user's calendar data, after Google and the user's own devices. The Marketplace listing makes a privacy claim about what leaves the user's Google account, and that claim has to be true by construction.

## Constraints

- Event titles, descriptions, attendees, and calendar identifiers MUST NOT leave the user's Google account.
- A user report MUST be traceable to the broker's request logs.
- Broker logs MUST NOT identify the caller.

## Decision

**Y statement:** We will send the broker only origin, destination, travel mode, and an opaque per-run correlation ID because the broker needs nothing else to compute a route, so the privacy claim in the Marketplace listing and Architecture §20.4 holds by construction.

The request also carries the broker authentication credential (Architecture §19.5). The broker verifies it and never logs it or the identity it carries: no principal or installation identifier appears in broker logs (Technical Design §21.6). Per-caller rate limiting may key on that identity in its own short-lived state only.

The correlation ID is the only link between the two sides: the engine creates one random UUID per run, the routing client sends it as `X-Request-ID`, the broker logs it, and the add-on's last-run record stores it (Technical Design §17.2, §20.2, §21.1).

## Consequences

- Broker-side debugging is harder without event context, and correlating a user report to a request depends on the opaque ID alone. Accepted deliberately.
- Broker logs record no caller identity, so a request cannot be traced to an account from the broker side alone.
- Changing the broker payload changes what the product promises and requires updating the listing and Architecture §20.4 in the same change.

## Alternatives considered

### Send the full event for context

Easier broker-side debugging. Rejected: it sends exactly the data the privacy claim says never leaves the account.

### Resolve routes entirely client-side

Rejected: the Maps credential cannot live in the add-on ([routing-broker ADR](2026-08-03-routing-broker.md)).
