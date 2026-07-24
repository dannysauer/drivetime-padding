# Requirements

## Product goal

Automatically add and maintain travel-time calendar events before and after eligible Google Calendar events.

## MVP behavior

- Support consumer Google accounts and Google Workspace accounts.
- Distribute as a Google Workspace Marketplace add-on.
- Run in Google Apps Script.
- Manage the user's primary calendar only.
- Default to real Google Calendar out-of-office events.
- Optionally include events whose subject matches a user-configured pattern.
- Ignore all-day events.
- Require the destination to come from the Calendar `location` field.
- Calculate driving time only.
- Add a configurable buffer to each direction.
- Default the planning horizon to 60 days and allow a bounded user override.
- Create overlapping events when needed.
- Keep generated events synchronized when source events are moved, edited, cancelled, or made ineligible.
- Support recurring events by reconciling individual instances.

## Origins

Users may configure:

- required default origin
- optional home origin
- optional office origin

Origins may be plain addresses or Google Place IDs. When enabled, working-location events may select home or office; otherwise the default origin is used.

## Generated events

- Outbound event ends at the source event start.
- Return event begins at the source event end.
- Return destination is the same selected origin used for the outbound route.
- Real OOO source events produce real OOO generated events.
- Pattern-matched ordinary events produce ordinary generated events with matching transparency.
- Generated events do not copy attendees, conferencing, attachments, or guest notifications.
- Generated events use predictable subjects and private extended properties.

## Per-event directives

The source description may contain directives such as:

```text
drivetime padding: off
drivetime padding: buffer=10m
drivetime padding: origin=home
```

A shorthand `drivetime padding +7m` may be accepted as a buffer replacement.

## Non-functional requirements

- Idempotent reconciliation.
- Event-trigger runs must be safe to repeat.
- Daily scheduled repair must provide eventual consistency.
- Maps credentials must not be embedded in Apps Script.
- Calendar writes should be minimized with fingerprints.
- User-visible diagnostics should explain why an event is or is not eligible.
- Future padding providers must be possible without coupling reconciliation to driving logic.

## Out of scope for MVP

- Additional calendars.
- Transit, walking, bicycling, or mixed-mode routing.
- Traffic-aware departure scheduling beyond the Routes API result used at reconciliation time.
- Guessing destinations from descriptions, attendees, or conference links.
- Mirrored recurring padding series.
- Preparation, cooldown, airport, or arbitrary rule providers.
- Billing or premium plans.
