# Developer Guide

## Purpose

This guide explains how to contribute to Drivetime Padding.

Before writing implementation code, read [`../open-questions.md`](../open-questions.md). Two prototype spikes block implementation, and several sections of the technical design are marked as depending on their outcome.

## Repository Layout

- docs/
- src/apps-script/
- cloud/routing-broker/
- test/
- .github/

## Development Environment

1. Create a Google Cloud project.
2. Link the Apps Script project.
3. Enable the Calendar Advanced Service.
4. Enable the Calendar API.
5. Copy `src/apps-script/appsscript.json` into the Apps Script project, or push with `clasp`.

The broker setup below is only needed from implementation phase 5 onward — phases 1 through 4 use a fixed travel duration and never call the broker:

1. Deploy the Cloud Run routing broker.
2. Configure Secret Manager for Maps credentials.

`.clasp.json` is gitignored. Create your own with the script ID of your development deployment; never commit it.

## Constants You Should Not Change Casually

`src/apps-script/Constants.js` holds values that are decided, not arbitrary:

- `MAX_TRAVEL_MINUTES` (360) bounds the reconciliation lookback. Raising it widens every Calendar read (ADR 0012).
- `RECONCILIATION_LOOKBACK_MINUTES` is derived, not chosen. Do not set it directly.
- `ROUTE_CACHE_MAX_AGE_HOURS` (24) and `ROUTE_GRANULARITY_SECONDS` (300) work together — shortening the age without the quantization would cause visible calendar churn (ADR 0011).

## Coding Standards

- Keep business logic out of UI.
- Treat source events as authoritative.
- Generated events are derived state.
- Prefer pure functions for normalization, directives, eligibility, and fingerprint generation.

## Apps Script Modules

### ReconciliationEngine

Owns synchronization.

### CalendarRepository

Owns Calendar API interaction.

### DrivetimeProvider

Produces GeneratedEventSpec objects.

### RoutingClient

Communicates with the routing broker.

### Settings

Loads, validates, and migrates user configuration.

### UI

Builds CardService cards only.

## Development Workflow

1. Write or update architecture if behavior changes.
2. Update requirements if user-visible behavior changes.
3. Implement.
4. Add tests.
5. Verify recurring-event fixtures.
6. Submit PR.

## Testing

Unit:

- directives
- eligibility
- fingerprints
- settings

Integration:

- reconciliation
- recurring exceptions
- generated event lifecycle

End-to-end:

- install
- configure
- create OOO
- verify travel
- move
- cancel
- cleanup

## CI

CI runs `pre-commit run --all-files` and nothing else. The workflow holds no checks of its own, so local hooks and CI cannot drift apart.

`.pre-commit-config.yaml` currently covers:

- file hygiene — trailing whitespace, end-of-file, line endings, merge conflicts, case conflicts, large files
- JSON and YAML validity, with JSON reformatted to a canonical 2-space form
- Markdown linting via `markdownlint-cli2`, configured in `.markdownlint-cli2.yaml`
- `node --check` on every Apps Script source file, since there is no build step to catch a syntax error before deployment
- a diff asserting `src/apps-script/appsscript.json` matches the documented manifest example, so the architecture cannot become quietly wrong about the add-on's OAuth scopes

Two rules for adding to it: put the check in `.pre-commit-config.yaml`, and never let a step pass unconditionally. An earlier version of this workflow ended its only real step with `|| true`, which made a green check meaningless.

Add unit tests as soon as the first pure module lands. Markdown line-length (`MD013`) and table-column-style (`MD060`) are disabled deliberately — see the comments in `.markdownlint-cli2.yaml`.

## Marketplace Release

Checklist:

- Privacy Policy
- OAuth verification
- Screenshots
- Support URL
- Test account
- Cloud Run deployed

## Troubleshooting

Symptoms:

- Missing trigger
- OAuth revoked
- Invalid route
- Working location unavailable

The Home card should surface trigger health and last synchronization status.

## Future Contributors

Before introducing a new provider:

1. Update architecture.
2. Add ADR if architecture changes.
3. Add requirements.
4. Implement provider.
5. Extend tests.
6. Update documentation.
