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

## Requirements added in the sixth review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-RECON-014 | Event type changes applied by replacement, not patch | AC-ELIG-009 |
| REQ-RECON-015 | Overlong source's companions located outside the window | AC-RECOVERY-011 |
| REQ-RECON-012 (extended) | Run status built from applied results, failed writes counted | AC-RECOVERY-010 |
| REQ-UI-017 | Manual synchronization enqueues rather than running inline | — UI, subject to Spike 1 |
| REQ-CONFIG-006a (clarified) | Shrink cleanup excludes boundary-spanning events | AC-CONFIG-003 |
| REQ-PERF-009 (clarified) | Zero-second cached routes are valid cache entries | AC-CACHE-013 |

## Requirements added in the seventh review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-ELIG-002 (enforced) | Type gate ahead of pattern matching; `UNSUPPORTED_EVENT_TYPE` reachable | AC-ELIG-010 |
| REQ-PERF-010 (extended) | Route ceiling counts HTTP attempts, retries included | AC-CACHE-015 |
| REQ-PERF-014 (clarified) | Route provenance distinguishes durable, ephemeral, broker | AC-CACHE-014 |
| REQ-RECON-015 (clarified) | Overlong-source deletions deduplicated by event id | AC-RECOVERY-011 |
| REQ-PERF-013 (specified) | Continuation worker and counter lifecycle | AC-CACHE-006 |
| Planning order (TD §23.2, plumbed) | `orderForPlanning` applied before the route budget is spent | — arch pseudocode |
| Working-location plumbing | `listWorkingLocationEvents` called and passed to origin resolution | AC-ORIGIN-001, AC-ORIGIN-002 |
| `workingLocation.fallbackToDefault` removed | Setting had no behavioral consumer; fallback is fixed behavior | AC-ORIGIN-003 |
| Remove-all cleanup contract | Unbounded ownership scan, ordered teardown, reported partial failure | AC-CONFIG-004 |

## Requirements added in the eighth review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-RECON-016 | Companions moved outside the window restored, not duplicated | AC-RECOVERY-012 |
| §23.1 (hardened) | Execution cutoff marks skipped sources `failed`, preserving companions | AC-RECOVERY-013 |
| §15.2 (reordered) | Metadata patch evaluated before `unchanged`, so same-bucket refreshes persist | AC-CACHE-001 |
| §7.3 (extended) | Cancelled generated tombstones excluded from observation | AC-RECOVERY-001 |
| Architecture §14.2 (boundary) | Run-wide throws become failed results in the stored record | AC-RECOVERY-014 |
| REQ-PERF-011 (enforced) | Diagnostic budget feeds the RouteBudget via an hourly counter | AC-CACHE-004 |
| §19.4 (extended) | Remove-all persists `enabled = false` before removing triggers | AC-CONFIG-004 |
| Architecture §14.2 (widened) | Working-location fetch covers evaluated sources' full spans | AC-ORIGIN-001, AC-ORIGIN-002 |

## Requirements added in the ninth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §7.6 (hardened) | Shrink cleanup scan paginated; truncation never lowers the high-water mark | AC-CONFIG-002 |
| §17.2 (completed) | Skipped and disabled runs return the full result shape | — REQ-RECON-012 |
| REQ-PRIV-006 (honored) | Remove-all replaces settings with a disabled tombstone, deleting origins | AC-CONFIG-004 |
| Spike 1 workload (corrected) | Quota measured against the 40-hour observation tail, not the 8-hour lookback | — open-questions |
| §17.1 (specified) | `eventIdFilter` scopes diagnostics to the opened event, dry-run only | AC-CACHE-004 |
| §5.3 (tiered) | Structural validity gates all runs; write-readiness gates writes; whitespace-only origins normalized | AC-ORIGIN-004 |
| §7.5 (enforced) | Working-location read failure degrades to default origin with a warning | AC-ORIGIN-003 |
| §23.1 (plumbed) | Execution cutoff implemented in the reconcile loop | AC-RECOVERY-013 |
| §11.5 (new) | Broker wire codes mapped to application codes, retryability decided once | AC-SEC-001, AC-RECOVERY-004 |

## Requirements added in the tenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §19.5 (hardened) | Manual run re-enqueued after a lock-contention skip | — TD §19.5 |
| §17.1 (targeted read) | Diagnostics fetch the opened event by id; OUTSIDE_WINDOW reportable | AC-CONFIG-005 |
| §12.5 (bounded) | Zero-length companions never emitted | AC-OOO-012 |
| §12.6 (provenance) | Companion type follows the eligibility match, not the source type | AC-ELIG-007, AC-ELIG-009 |
| §17.6 (new) | Per-event diagnostic payload carried on filtered results | AC-CONFIG-005 — §20.3 card |
| `loadSettings` contract aligned | Returns `{ settings, validation }` everywhere | — interfaces |
| §7.6 (dry-run safe) | Dry runs never advance the high-water mark | AC-DRYRUN-001 |
| §19.6 (serialized) | Continuation counter updated by the engine under the user lock | AC-CACHE-006 |
| Architecture §14.2 (renamed) | `normalizeCalendarEvent` used consistently | — pseudocode |

## Requirements added in the eleventh review round

| Requirement | Covers | Scenario |
|---|---|---|
| §19.6 / Architecture §14.2 (aligned) | `continuationCapReached` recorded under `diagnostics`, matching §17.2 | — contract |
| REQ-RECON-017 | Daily anchor-selected sweep deletes companions of deleted sources | AC-RECOVERY-015 |
| §13.2 (extended) | `anchor` persisted on every companion; sweeps cost nothing for history | AC-RECOVERY-015 |
| §19.5 (serialized) | Manual enqueue check-and-create under the user lock; handlers collapse duplicate triggers | — TD §19.5 |
| §19.4 (asynchronous) | Remove-all card action bounded; cleanup runs as budget-bounded worker passes with persisted progress | AC-CONFIG-004 |

## Requirements added in the twelfth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §10.4 (carried) | Missing default origin becomes a per-event failed outcome in the diagnostic payload, not a run-wide throw | — §20.3 card |
| §19.4 (resumable) | Cleanup pages and deletes interleaved; retries resume without a persisted cursor | AC-CONFIG-004 |
| REQ-RECON-017 (state-keyed) | Sweep decides on parent state: out-of-window and ineligible live parents delete too | AC-RECOVERY-015 |
| §17.5 (deferred) | `applyDiff` budget-aware between operations; remainder deferred, not failed | AC-RECOVERY-013 |
| REQ-PRIV-006 (unconditional) | Settings tombstone on every terminal cleanup outcome except user abort | AC-CONFIG-004 |
