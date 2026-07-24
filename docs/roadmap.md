# Roadmap

## Milestone 1: Project bootstrap

- Capture product requirements and architecture.
- Record major design decisions as ADRs.
- Establish Apps Script source layout and manifest.
- Define planning work and acceptance criteria.

## Milestone 2: Add-on foundation

- Implement CardService home and settings cards.
- Persist validated settings in User Properties.
- Install, inspect, and repair Calendar and daily triggers.
- Add user-facing synchronization status.

## Milestone 3: Calendar reconciliation

- List primary-calendar events in a rolling window.
- Normalize one-off and recurring instances.
- Apply OOO and optional subject-pattern eligibility.
- Parse per-event directives.
- Upsert generated events with private metadata.
- Remove orphaned or no-longer-eligible generated events.

## Milestone 4: Drivetime provider

- Resolve default, home, and office origins.
- Read working-location events where available.
- Implement outbound and return event plans.
- Add route duration and buffer calculations.
- Preserve OOO behavior for real OOO source events.

## Milestone 5: Routing broker

- Deploy an authenticated Cloud Run service.
- Integrate Google Maps Routes API.
- Store credentials in Secret Manager.
- Add quotas, validation, structured logs, and cost monitoring.

## Milestone 6: Quality and Marketplace

- Add unit tests around normalization, directives, fingerprints, and planning.
- Add integration-test fixtures for recurring event exceptions.
- Prepare OAuth consent, privacy policy, support documentation, and listing assets.
- Complete Marketplace verification and staged release.

## MVP exit criteria

The MVP is ready for a limited external test when a user can install the add-on, configure an origin, and reliably maintain outbound and return padding for real OOO events—including moved and cancelled recurring instances—without manual cleanup.
