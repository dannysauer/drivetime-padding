# ADR: Use Google Apps Script

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | The runtime the add-on itself runs on. The routing broker's runtime is the [routing-broker ADR](2026-08-03-routing-broker.md). |
| Related | [Open questions](../open-questions.md), Prototype Spike 1; Architecture §15 and §16 |
| Revisit when | Prototype Spike 1 finds that a Marketplace-installed add-on cannot create installable Calendar triggers |

## Business driver

The product is a Google Workspace Marketplace add-on that reacts to calendar changes and keeps travel blocks current. Users install it from the Marketplace in minutes and never operate a server. The maintainer's language preference is Python, which no Marketplace add-on runtime offers.

## Constraints

- Installation MUST be a Marketplace install with no self-hosted component for the user.
- The add-on MUST react to calendar changes without polling from an external service.
- The add-on MUST render its settings and diagnostics inside Calendar.

## Decision

**Y statement:** We will build the add-on on Google Apps Script because it is the only runtime with native Calendar triggers, the CardService UI, and Marketplace installation built in, so deployment and operations stay minimal at the cost of writing JavaScript under Apps Script's execution limits.

The decision rests on installable Calendar triggers being available to a Marketplace-installed add-on. That capability is not yet validated; Prototype Spike 1 in [open-questions.md](../open-questions.md) tests it before implementation, and a negative result reopens this decision.

## Consequences

- JavaScript rather than Python, and the Apps Script execution-time, quota, and library limits that the technical design's execution budget (§23) is built around.
- Dramatically simpler deployment: no hosting, no server-side scheduler, no separate authentication for the user interface.
- The Maps credentials cannot live in the add-on, so routing needs the broker in the [routing-broker ADR](2026-08-03-routing-broker.md).

## Alternatives considered

### Cloud Run application

Would allow Python and a conventional service. Rejected: the user would still need something inside Calendar to react to changes, and a Marketplace add-on is the only installable surface, so the service would duplicate the add-on rather than replace it.

### Self-hosted service

Rejected: operating a server is exactly the burden the product removes for its users, and Marketplace installation would be impossible.
