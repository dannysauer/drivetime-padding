# ADR: OAuth scope strategy

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Proposed |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | Which Calendar OAuth scopes the manifest requests, and the verification tier that follows from them. Broker authentication scopes are a separate open question (Technical Design §21.7). |
| Related | [Open questions](../open-questions.md), Prototype Spike 2; Technical Design §7.1, §11.2, §19.2, and §20.3; Architecture §20.1; REQ-SEC-002a |
| Revisit when | Prototype Spike 2 reports Google's current classification of each Calendar scope and a scope set verified against every Calendar call the code makes |

## Business driver

The manifest requests `https://www.googleapis.com/auth/calendar`, the broadest Calendar scope. Scope tier drives OAuth verification cost and timeline, and could decide whether a free Marketplace add-on is viable at all.

## Constraints

- A scope MUST NOT be added speculatively while this decision is open (REQ-SEC-002a).
- The chosen set MUST authorize every Calendar call the code makes, not only event reads and writes.
- The add-on MUST read the user's Calendar time zone and the primary calendar's id, two reads that fall outside event-level scopes.

## Decision

**Y statement:** We will defer the scope decision until Prototype Spike 2 reports because the decision needs facts the project does not have, Google's current classification of each Calendar scope and the scope each required read actually needs, so the manifest is finalized from evidence rather than from the default that produced the current one.

While the decision is open:

- `openid` MUST NOT appear in the manifest until broker authentication is chosen (Technical Design §21.7), because adding it would commit to one candidate mechanism.
- `https://www.googleapis.com/auth/calendar.addons.execute` stays. Google requires it of every Calendar add-on; the manifest's `eventOpenTrigger` and `currentEventAccess` do not run without it. It is an execution scope, not a data scope, and does not move the verification tier.
- `https://www.googleapis.com/auth/script.external_request` stays. The routing-broker call is the product ([routing-broker ADR](2026-08-03-routing-broker.md)); only its URL and authentication are open. A published deployment also needs the broker's URL prefix in `urlFetchWhitelist`, added when the URL is chosen (Technical Design §11.2).

## Consequences

- The manifest and firm Marketplace planning stay open until Spike 2 completes. Accepted because guessing has a worse expected cost.
- Google classifies scopes as basic, sensitive, or restricted. The CASA third-party assessment with annual renewal applies to the restricted tier, which centers on Gmail and Drive; Calendar scopes are believed to be sensitive, needing OAuth verification and review time but no paid annual assessment. Neither belief is verified against Google's current published list, and no budget or scope conclusion may be drawn before Spike 2 verifies it.

## Spike 2 inputs

Two non-event reads constrain any narrowed set:

- **The daily-hour derivation reads the user's Calendar time zone** (`Calendar.Settings.get('timezone')`, Technical Design §19.2) on every daily firing. The full `calendar` scope covers that read; `calendar.events` does not, while `https://www.googleapis.com/auth/calendar.settings.readonly` exists for exactly it. Narrowing therefore means keeping a settings-capable scope (the read-only settings scope is the data-minimizing candidate) or sourcing the zone another way, such as the add-on event object's `userTimezone` on card paths (which requires `script.locale` and `useLocaleFromApp`, the trade-off Architecture §20.1 records) cached for the daily path. Without one of those, every daily repair fails with insufficient permission and the schedule never realigns.
- **The event card resolves the primary calendar's id** before invoking the engine (Technical Design §7.1 and §20.3), for example via `CalendarApp.getDefaultCalendar().getId()`. `CalendarApp` requires the full `calendar` scope or `calendar.readonly`; neither `calendar.events` nor `calendar.settings.readonly` grants it. A narrowed set built only from the event reads and the settings read would fail every `eventOpen` card with an authorization error before the unsupported-calendar check runs. Narrowing means keeping a scope that covers `CalendarApp` or replacing the read with one whose scope Spike 2 verifies (for example, an Advanced Calendar call for the `primary` calendar's metadata) and updating §20.3 to name it.

Spike 2 verifies a candidate set against every Calendar call the code makes.

## Alternatives considered

### Keep the current approach: the broad `calendar` scope

Plausible if Calendar scopes are sensitive rather than restricted. Not decided: the classification is unverified, and the broad scope requests more than the product needs.

### Narrow to `calendar.events`

The data-minimizing candidate for event access. Not decided: it does not cover the time-zone read or `CalendarApp`, so it works only with a companion scope or replacement reads that Spike 2 verifies.

### Decompose into the narrowest working set

The likely outcome. Not decided: the set cannot be named before each call's scope requirement is verified on a live account.
