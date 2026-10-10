# ADR: Primary calendar only

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | Which calendars the MVP reads and writes. |
| Related | Technical Design §7.1 and §20.3; REQ-INSTALL-004 |

## Business driver

Users can hold appointments on any number of calendars, including calendars they do not own. Each additional calendar adds configuration, permission questions, trigger handling, and read cost.

## Constraints

- The add-on MUST NOT act on events the user does not own.
- Cleanup and trigger behavior MUST be predictable for every installation.

## Decision

**Y statement:** We will manage only the authenticated user's primary calendar because it keeps configuration, permissions, triggers, and cleanup predictable and avoids reasoning about events the user does not own, so the MVP has one calendar to read and one to write.

The event card checks the opened calendar and reports `UNSUPPORTED_CALENDAR` for any other (Technical Design §20.3).

## Consequences

- Users who keep appointments on a secondary calendar get nothing from the product.
- Adding calendars later means a settings migration and a larger read cost per reconciliation.

## Alternatives considered

### All accessible calendars

Rejected: shared and subscribed calendars contain events the user cannot or should not pad, and the read cost scales with calendars the user never asked about.

### User-selected calendars

Rejected for the MVP: it needs calendar-selection UI, per-calendar triggers, and per-calendar cleanup before the core engine has been proven.
