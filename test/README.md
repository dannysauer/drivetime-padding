# Tests

Test strategy is specified in Technical Design §24.

## Layout

```text
test/
├── unit/          Pure functions, no Apps Script globals
├── integration/   Reconciliation against fakes
└── fixtures/      Raw Calendar JSON and expected normalized output
```

## Running under Node

Apps Script has no module system — source files share one global namespace after deployment — so tests load `src/apps-script/*.js` into a context with Apps Script globals replaced by adapters. Keep business logic free of `Calendar`, `PropertiesService`, `UrlFetchApp`, and friends so it stays testable this way.

## Priority suites

Pure units:

- settings validation and migration
- directive parsing, including malformed input and warnings
- normalization
- eligibility and reason codes
- origin resolution
- fingerprint canonicalization
- duration quantization
- desired-versus-observed comparison
- window derivation, including the lookback

Integration, against a fake repository and fake routing client:

1. no generated events exist
2. outbound exists, return missing
3. both exist and match — asserts zero writes **and zero broker calls**
4. source time changed
5. source location changed
6. source becomes ineligible
7. source deleted
8. generated event manually moved
9. generated event metadata removed
10. route broker fails — existing events preserved
11. concurrent invocation skipped
12. dry run produces no writes
13. source event in progress — no duplicate outbound
14. route exceeds maximum supported travel
15. expired cache, immaterial duration change — no write
16. route ceiling reached — partial status, nothing deleted

## Recurring fixtures

Permanent fixtures for: simple weekly recurrence, moved single instance, cancelled instance, changed location on one instance, split "this and following", cancelled entire series.

## Fakes

- **Fake repository** — in-memory, same interface as `CalendarRepository`.
- **Fake routing client** — deterministic durations keyed by origin and destination, with injectable transient and permanent failures, and a call counter for the cost assertions.

Inject `now` rather than reading the clock, so window and cache-age behavior is deterministic.
