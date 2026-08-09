# Requirements Traceability Matrix

This matrix links requirement groups to architecture components, technical-design areas, and acceptance scenarios.

| Requirement group | Primary architecture component | Technical design focus | Acceptance scenarios |
|---|---|---|---|
| Installation | Apps Script add-on, Marketplace | Manifest, trigger setup | AC-INSTALL-001, AC-INSTALL-002 |
| Configuration | Settings service | Settings schema and validation | AC-INSTALL-001, AC-ORIGIN-004 |
| Eligibility | Reconciliation engine | Normalizer and eligibility evaluator | AC-ELIG-001 through AC-ELIG-005 |
| Destination | Drivetime provider | Source-event mapping | AC-ELIG-002, AC-OOO-005 |
| Origin | Origin resolution | Provider context | AC-ORIGIN-001 through AC-ORIGIN-004 |
| Buffer/timing | Drivetime provider | Generated event calculations | AC-OOO-001, AC-DIRECTIVE-001 |
| Directives | Directive parser | EBNF and parser contract | AC-DIRECTIVE-001 through AC-DIRECTIVE-003 |
| Routing | Routing client and broker | Broker API and errors | AC-OOO-001, AC-RECOVERY-004, AC-SEC-001 |
| Generated events | Calendar repository | Calendar write mapping and metadata | AC-OOO-001 through AC-OOO-006 |
| Metadata/fingerprint | Reconciliation engine | Canonicalization and hashing | AC-OOO-002, AC-RECOVERY-002, AC-RECOVERY-003 |
| Recurrence | Calendar repository and engine | Instance expansion | AC-REC-001 through AC-REC-005 |
| Reconciliation | Reconciliation engine | Diff algorithm | AC-OOO-002, AC-RECOVERY-001 through AC-RECOVERY-005 |
| Triggers | Trigger manager | Install and repair contracts | AC-INSTALL-002 |
| UI | CardService UI | Home, settings, diagnostics | AC-INSTALL-001 and all diagnostic outcomes |
| Error recovery | Engine and broker | Error taxonomy | AC-RECOVERY-004, AC-RECOVERY-005 |
| Security | Apps Script and broker | OAuth, auth, secrets | AC-SEC-001 |
| Privacy | Broker and documentation | Payload minimization | AC-PRIV-001 |
| Dry run | Reconciliation engine | No-write execution | AC-DRYRUN-001 |
| Route caching | Routing client and provider | Route plan cache, quantization | AC-OOO-002, AC-CACHE-001 through AC-CACHE-004 |
| Window bounds | Reconciliation engine | Lookback derivation | AC-OOO-007, AC-REC-005 |
| Travel limits | Drivetime provider | Maximum supported travel | AC-OOO-008 |

## MVP verification gates

| Gate | Evidence required |
|---|---|
| Settings gate | Automated validation tests and first-run demonstration |
| Calendar gate | Test account demonstration of create/update/delete |
| Recurrence gate | Automated fixtures plus live moved/cancelled instance test |
| Recovery gate | Manual deletion, manual movement, and partial failure tests |
| Routing gate | Authenticated broker integration and normalized error tests |
| Privacy gate | Payload capture proving minimization and approved privacy text |
| Marketplace gate | OAuth verification requirements satisfied and tester install succeeds |
| Cost gate | Measured broker calls per reconciliation match the model in Technical Design §23.3 — two per eligible event per day, not per trigger firing |
| Spike gate | Prototype Spikes 1 and 2 reported before implementation begins |

## Requirements added in the second review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-PERF-009 | Route plan cache | AC-OOO-002, AC-CACHE-001 |
| REQ-PERF-010 | Bounded route spend and per-run ceiling | AC-CACHE-003 |
| REQ-PERF-011 | Diagnostic route budget | AC-CACHE-004 |
| REQ-PERF-012 | Duration quantization | AC-CACHE-001 |
| REQ-TIME-011 | Reconciliation lookback | AC-OOO-007 |
| REQ-TIME-012 | Maximum supported travel | AC-OOO-008 |
| REQ-TIME-013 | Daily maintenance hour | — pending Spike 1 |
| REQ-SEC-002a | Scope selection as an architectural decision | — pending Spike 2 |

## Requirements added in the third review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-PERF-015 | Cache reachability from the planning path | AC-CACHE-009 |
| REQ-ELIG-001 (extended) | `includeOutOfOffice` actually governs eligibility | AC-ELIG-007 |
| REQ-ELIG-012 | Title matching uses the raw summary | AC-ELIG-008 |
| REQ-CONFIG-014a | No eligible source types is surfaced, not silent | — UI |
| REQ-META-009 (narrowed) | Fingerprint match alone does not license skipping a write | AC-RECOVERY-002a |

## Requirements added in the fourth review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-CONFIG-006a | Window reduction actually removes distant companions | AC-CONFIG-002 |
| REQ-GEN-009a / REQ-GEN-014b | Reminder suppression is maintained, not creation-time | AC-RECOVERY-008 |
| REQ-PERF-016 | Route age measured from calculation, not from cache read | AC-CACHE-010 |

## Requirements added in the fifth review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-RECON-013 | Absence-based writes require a complete scan | AC-RECOVERY-009 |
| REQ-PERF-017 | Schedule-only changes cost no broker calls | AC-CACHE-011 |
| REQ-PERF-014 (extended) | Cache repair persists the full triplet including the hash | AC-CACHE-012 |
| REQ-ROUTE-011 | Uniform typed endpoints in both directions | AC-ORIGIN-005 |
