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
| REQ-TIME-013 | Daily maintenance hour | AC-CONFIG-006 (realignment after a DST or time-zone change; `atHour` semantics themselves still pending Spike 1) |
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
| REQ-RECON-013 | Absence-based writes require complete evidence (amended in the twentieth round: creates lookup-gated, deletions point-read-gated on incomplete scans; and in the twenty-second: a fetched live parent is evaluated in place, so a stale companion split from its live source by pagination is still removed) | AC-RECOVERY-009 |
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
| Planning order (TD §23.2, plumbed) | `orderForPlanning` applied before the route budget is spent; the window listing itself is segment-ordered (forward from the pinned pivot, then backward, `orderBy: startTime`) so the upcoming-first guarantee survives a truncated scan | AC-RECOVERY-017 |
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
| §19.6 / Architecture §14.2 (aligned) | The partial run's continuation outcome recorded under `diagnostics`, matching §17.2 — today the `continuation` disposition (`scheduled`, `capReached`, `enqueueFailed`, `notUseful`), which superseded the earlier boolean | AC-RECOVERY-018 |
| REQ-RECON-017 | Daily anchor-selected sweep deletes companions of deleted sources | AC-RECOVERY-015 |
| §13.2 (extended) | `anchor` persisted on every companion; sweeps cost nothing for history | AC-RECOVERY-015 |
| §19.5 (serialized) | Manual enqueue check-and-create under the user lock; handlers collapse duplicate triggers | — TD §19.5 |
| §19.4 (asynchronous) | Remove-all card action bounded; cleanup runs as budget-bounded worker passes with persisted progress | AC-CONFIG-004 |

## Requirements added in the twelfth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §10.4 (carried) | Missing default origin becomes a per-event failed outcome in the diagnostic payload, not a run-wide throw | — §20.3 card |
| §19.4 (resumable) | Cleanup pages and deletes interleaved; retries resume without a persisted cursor | AC-CONFIG-004 |
| REQ-RECON-017 (state-keyed) | Sweep decides on parent state: out-of-window and ineligible live parents delete too (amended in the twenty-second round: only *displaced* candidates — undisplaced aged-out companions are preserved as history) | AC-RECOVERY-015 |
| §17.5 (deferred) | `applyDiff` budget-aware between operations; remainder deferred, not failed | AC-RECOVERY-013 |
| REQ-PRIV-006 (unconditional) | Origin addresses destroyed regardless of how cleanup later ends (tombstone placement finalized in the sixteenth round: written by the card action, never by the worker) | AC-CONFIG-004 |

## Requirements added in the thirteenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §15.2.8 (bounded) | Sweep listing keyed on `updated` — strays are necessarily moved, so no unresumable full-history scan | AC-RECOVERY-015 |
| §15.2.7 (budget-aware) | Restoration lookups check the cutoff between lookups; unresolved creates never applied | AC-RECOVERY-013 |
| §7.2.1 (deadline-aware) | Window scan returns its prefix with `scanComplete: false` at the cutoff | AC-RECOVERY-013 |
| §17.6 (buffer carrier) | `effectiveBufferMinutes` passed into diagnostic capture by the engine | — §20.3 card |
| AC-CACHE-001 (aligned) | Cache-refresh patch carries the full triplet including `routeHash` | AC-CACHE-001, AC-CACHE-012 |
| Architecture §14.2 (guarded finally) | Spend-record failures become warnings; lock release in inner finally | — pseudocode |
| §10.2 (carried) | `DIRECTIVE_ORIGIN_UNCONFIGURED` registered and recorded by the engine | — §18.2 registry |
| REQ-GEN-001 (excepted) | Zero-padding roles emit no event; two-event rule no longer contradicts §12.5 | AC-OOO-012 |
| §2 (naming) | Cross-document names unsuffixed everywhere; `_` reserved for file-private helpers | — convention |

## Requirements added in the fourteenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §7.6 (deadline-aware) | Shrink scan takes the `shouldStop` guard; truncation retains the mark | AC-CONFIG-002 |
| §17.1 / §20.3 (bound) | Scoped runs must carry `reason: "event-diagnostic"`; budgeting cannot be bypassed | AC-CACHE-004 |
| §20.3 (calendar check) | Non-primary card opens render `UNSUPPORTED_CALENDAR` before the engine runs | — §20.3 card |

## Requirements added in the fifteenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §15.2.8 (guarded reads) | `shouldStop` checked between sweep parent point reads; cut-short sweeps never write the watermark | AC-RECOVERY-015 |
| §11.1 (aligned) | `calculatedAt` in the canonical `RouteResult` contract, matching §4.7/§20.3 | AC-CACHE-010 |
| Architecture §14.2 (guarded boundary) | Error-boundary status persistence guarded; `STATUS_PERSIST_FAILED` logged, result still returned | AC-RECOVERY-014 |
| §21.4 / §12.3 (clarified) | Same-bucket refresh is no *user-visible* update; the metadata patch still writes the triplet | AC-CACHE-001 |
| Architecture §5.4/§14.2 (global call) | `getGeneratedEventSpecs` called unqualified — no `DrivetimeProvider` object exists | — pseudocode |

## Requirements added in the sixteenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| Architecture §14.2 / TD (bare globals) | Repository and helper calls unqualified everywhere — no `repository` object exists in the shared Apps Script namespace | — pseudocode |
| §5.4 (validated) | Settings schema version validated before indexing the migration table; unsupported versions become structural `INVALID_SETTINGS`, never a throw | AC-CONFIG-001 |
| §19.4 (tombstone first) | Disabled tombstone written by the card action under its lock; the cleanup worker never writes settings, so REQ-PRIV-006 holds on every outcome | AC-CONFIG-004 |
| §19.6 (aligned) | Continuation counter read via `PropertiesService.getUserProperties()`, matching the §5.1 User Properties storage convention | — snippet |
| REQ-RECON-017 (maximal band) | Sweep anchor band reaches the largest configurable horizon, so a window shrink cannot hide a stray | AC-RECOVERY-015 |
| REQ-GEN-014c | `outOfOfficeProperties` owned, compared, and restored; patch where Calendar permits, replacement otherwise | AC-RECOVERY-016 |

## Requirements added in the seventeenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §17.1 (validated redirect) | Companion parent metadata validated before the diagnostic redirect; a blank or missing `parent` yields `PARENT_NOT_FOUND` with no repository calls on an invalid id | — §20.3 card |
| §11.5 (reachable) | `muteHttpExceptions: true` is part of the routing-client contract; the no-response mapping is reserved for actual transport exceptions | — §11.5 table |
| §20.3 (aligned) | Ephemeral cache stores `calculatedAt` as the canonical §4.7 ISO string, no `Date` conversion | AC-CACHE-010 |
| §19.6 (guarded enqueue) | Continuation trigger creation failures caught at both call sites; truthful partial result kept with `CONTINUATION_ENQUEUE_FAILED` warning; deferred work waits for the daily backstop | — §19.6 |
| §5.4 (guarded parse) | Malformed stored JSON caught in `loadSettings` and reported as structural `INVALID_SETTINGS` with the reset path | AC-CONFIG-001 |
| §15.2.7 (scoped skip) | Restoration pass skipped on scoped diagnostics — the targeted read already performed the same lookup | — §17.1 |

## Requirements added in the eighteenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §19.5 (guarded re-enqueue) | Manual handler's skip-path re-enqueue caught; `MANUAL_ENQUEUE_FAILED` logged; trigger-list-derived pendingness keeps the card honest | — §19.5 |
| §17.1 (disabled payload) | Scoped diagnostic against disabled automation returns a synthesized `DISABLED_GLOBALLY` payload; the card handles the `skipped` status explicitly, so no engine exit renders blank | — §20.3 card |
| §11.5 (transient-first) | Bare or non-JSON 5xx classified `BROKER_UNAVAILABLE` before the unparseable-body fallback; broker code refines only when present | — §11.5 table |
| REQ-PERF-009 (excepted) | Zero-padding routes have no durable carrier; ephemeral-TTL refresh bound stated as an explicit exception in requirement and design | AC-CACHE-013 |

## Requirements added in the nineteenth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §17.2 (applied carrier) | `ReconciliationResult.applied` summarizes the `ApplyResult` — the contract-defined path by which accepted counts reach `saveRunStatus` and the §20.2 record | AC-RECOVERY-010 |
| Architecture §14.2 (guarded gates) | Both validation-gate `saveRunStatus` sites guarded; the `INVALID_SETTINGS` result and its reset guidance survive a persistence outage | AC-RECOVERY-014 |
| §18.2 (`BOOKKEEPING_PERSIST_FAILED`) | Post-apply bookkeeping writes guarded (high-water mark, sweep watermark, continuation reset); each loss is safe by construction | — §18.2 registry |
| §17.6 (destination carried) | `EventDiagnostics.destination` copied from the source location at capture; the card shows REQ-UI-014's destination without a second read, never persisted | — §20.3 card |

## Requirements added in the twentieth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §20.3 (reserve-then-refund) | Diagnostic allowance reserved before any broker call and unspent remainder refunded; both failure directions land conservative — the ceiling is never exceeded by a lost write | AC-CACHE-004 |
| §7.2.1 (resumable scan) | Truncated window scans persist a chain-owned cursor pinned to their range; continuation and daily runs resume it, fresh runs never overwrite it, and the daily run's counter reset is the episode boundary — passes tile a too-large calendar instead of re-reading the same prefix until the cap | AC-RECOVERY-017 |
| REQ-RECON-013 (evidence-keyed) | Both absence operations upgrade to per-event evidence on incomplete scans: creates through the per-parent lookup, orphan deletions through a parent point read (absent/cancelled deletes; a live parent — evaluated in place since the twenty-second round — deletes when it desires no companion for the key, preserves otherwise) | AC-RECOVERY-009 |

## Requirements added in the twenty-first review round

| Requirement | Covers | Scenario |
|---|---|---|
| §23.1 (read budget) | Bulk listings stop at `READ_BUDGET_FRACTION` of the execution threshold (the per-event evidence passes *and the sweep* at the later `EVIDENCE_BUDGET_FRACTION` tier, added in the twenty-second round), reserving headroom to plan and apply what was retrieved — a truncated slice, sweep, or shrink pass is productive, not wasted, each on its own tier | AC-RECOVERY-013, AC-RECOVERY-017 |
| §15.2.8 / §7.6 (advancing truncation) | Applied deletions vanish from later listings, so truncated sweep and shrink retries reach past the applied prefix instead of re-retrieving it | AC-RECOVERY-015 |
| §7.2.1 (dead cursor replaced) | A rejected resume token's cursor is replaced by the fallback's own token (or cleared when the fallback covers the span); offered-cursor runs never claim current-window scan credit | AC-RECOVERY-017 |
| §20.2 (disabled persisted) | Non-dry disabled results persist through the guarded save; only the lock-contention skip is unpersisted | — §20.2 |
| Architecture §14.2 (buffer init) | `beginRunWarnings()` creates the run's warning buffer before any warning site can fire | — §18.2 |
| §16.1 (spec-driven transparency) | Ordinary-companion transparency built from `spec.transparency`; null omits the field and observed normalization maps default back to null | AC-ELIG-007 |

## Requirements added in the twenty-second review round

| Requirement | Covers | Scenario |
|---|---|---|
| §15.2.7 (suppressed creates) | A restoration pass cut short at the evidence threshold suppresses its unresolved creates instead of relying on the later execution-budget check — application proceeds with resolved work, never with an unresolved create; shrink-collision creates resolve directly against the in-memory stranded event, so the pass's guard can never suppress one (a run that hits the full deadline before the pass starts counts all pending creates, colliding included) | AC-RECOVERY-009 |
| §15.2.3 (live-parent evaluation) | A live parent found by the point read is evaluated through route-free desired-state tests; a companion its source no longer desires is deleted even when pagination forever splits the pair | AC-RECOVERY-009, AC-RECOVERY-017 |
| §15.2.5 / §15.2.7 (restoration classification) | Restoration matches classify through the same update-versus-replace rules as in-window matches — an `eventType` change while the companion sat out of range replaces instead of emitting a forever-rejected patch | AC-RECOVERY-012 |
| REQ-TRIGGER-002 (chain carve-out) | The §7.2.1 daily-resume residual is normative: a chain pending at daily time defers that day's fresh-window pass until the chain completes — one further cycle after completion, two cycles total when the chain finishes within the day's allowance | AC-RECOVERY-017 |
| §19.4 (liveness by freshness) | A `running` record with no pending worker trigger is failed only when the liveness stamp (freshest of `updatedAt` and the lockless heartbeat's `at`, stamped at worker entry) is stale past `REMOVAL_STALE_AFTER_MS` — an executing pass has already consumed its trigger and must not be misreported; the progress record itself is written only under the user lock | AC-CONFIG-004 |
| §19.4 (outstanding failures) | `failedDeletes` counts unresolved failures, replaced only by a complete walk and never zeroed at pass start — a retried deletion clears the failure it supersedes, keeping the zero-failures terminal satisfiable without truncated or dying passes understating what remains | AC-CONFIG-004 |
| §23.1 (planning tier) | Planning stops starting new sources at `PLANNING_BUDGET_FRACTION` (remainder marked `EXECUTION_BUDGET_EXCEEDED`), so route calls cannot burn through the evidence passes' region; time-starved planning joins the continuation causes on current-window runs | AC-RECOVERY-013 |
| §23.1 (evidence tier) | Absence-evidence work (restoration lookups, orphan point reads, the daily sweep) gets its own budget tier past the bulk-listing one, so an earlier phase that exhausts its region cannot starve it on the very calendars that need it; same-tier passes order self-draining first | AC-RECOVERY-009, AC-RECOVERY-017 |
| §7.6 / §17.5 (`resolvedAll`) | The shrink high-water gate counts a stranded event resolved by deletion or by an applied write that realigned it inside the window; the cleanup merge contributes only unobserved events, so a comparator classification of a co-observed event is never raced by a queued delete | AC-CONFIG-002, AC-RECOVERY-012 |
| REQ-RECON-017 (displacement) | The sweep's live-parent deletion rules act only on candidates displaced from their persisted anchors — the moved-test; a naturally aged-out companion is preserved as history however recently a patch bumped its `updated` | AC-RECOVERY-015 |
| REQ-RECON-009 (concluded records, §15.2.9) | Deletion authority stops at the past: an ended, undisplaced companion is a record of a trip, preserved by every reconciliation deletion path — without it the hours-long lookback against the day-long observation margin would erase every travel block within a day and nothing would ever age out as history | AC-RECOVERY-015 |

## Requirements added in the twenty-third review round

| Requirement | Covers | Scenario |
|---|---|---|
| §7.2.1 (application-gated cursor) | Window-scan cursor writes moved to the post-apply bookkeeping block — a run that throws or times out after its listing leaves the prior cursor, so the retry re-reads the slice instead of skipping it; the rejected dead token's clear stays eager at listing time, being skip-safe | AC-RECOVERY-017 |
| §15.2.9 / §12.1.1 (freeze plumbing) | The planning context carries the resolved observed companion per role, so `getGeneratedEventSpecs` applies the concluded-record freeze before routing instead of spending broker budget on a role the comparator freezes anyway | AC-RECOVERY-015 |
| §15.2.10 (suppressed-role lookup) | Roles §12.5 suppresses — zeroed out of existence, or (since the twenty-fifth round) already ended with no undisplaced same-anchor companion — produce no pending create, so restoration never fires; a targeted per-parent lookup on incomplete scans, daily runs, and continuations deletes the displaced stale block the route-free evaluation must preserve | AC-RECOVERY-017 |
| §17.1 (budget diagnostic) | A scoped diagnostic whose planning-tier boundary fires before the target is planned synthesizes `EXECUTION_BUDGET_EXCEEDED` instead of misreporting `EVENT_NOT_FOUND` for an event the targeted read just returned | AC-RECOVERY-013 |
| §8.1 / §14.2 (per-event containment) | The normalizer is total and a planning throw becomes that source's `failed` outcome (`UNEXPECTED_ERROR`, logged, capping the run at `partial`) — one poisoned event cannot fail the run, which application-gated cursor writes require lest a deterministic throw freeze the scan chain at its slice | AC-RECOVERY-013 |

## Requirements added in the twenty-fourth review round

| Requirement | Covers | Scenario |
|---|---|---|
| REQ-TIME-013 / §19.2 / §19.3 (schedule realignment) | The daily handler re-derives the maintenance hour from the user's current Calendar time zone at the next firing's instant on every run, and trigger repair replaces a daily trigger whose persisted installed hour (`dtp.dailyTrigger`) no longer matches — so a daylight-saving transition or time-zone change converges within one cycle with no user action, where previously only a homepage open or settings save could notice | AC-CONFIG-006 |

## Requirements added in the twenty-fifth review round

| Requirement | Covers | Scenario |
|---|---|---|
| §12.5 / §15.2.9 / §15.2.10 (ended rule) | A role whose computed span has already ended emits no spec, record or no record — the outbound test route-free — so a recently ended source with no companions creates no past-dated block; every non-emission is recorded on `PlanningOutcome.suppressed` with its reason, both reasons feed the §15.2.10 lookup, and the sweep deletes displaced candidates of suppressed roles instead of keeping them for a restoration that never comes | AC-OOO-013 |
| §12.1.1 (companion resolution) | `indexByGeneratedKey` keeps every companion of a key and `companionsFor` chooses per role — the same-anchor companion first, then live over record, judged with the injected run clock — so the provider sees the trip's own block and the fallback agrees with the provider and comparator about concludedness | AC-CACHE-016 |
| §20.2 (persisted continuation disposition) | The stored run record carries the partial run's continuation disposition (`scheduled`, `capReached`, `enqueueFailed`, `notUseful`), so the home card never promises a continuation that will not fire | AC-RECOVERY-018 |
| §16.5.1 (conditional writes) | Every write against an observed event is conditional — `If-Match`, or an immediate marker re-read — and a rejected write re-reads to split `OWNERSHIP_LOST` (marker gone, not retried) from `CONCURRENT_EDIT` (marker intact, retryable); either outcome on the delete half of a replace aborts the whole replace | AC-RECOVERY-019 |
| REQ-RECON-009 / §15.2.9 (anchor-past clause) | A companion is a record only when its anchor instant has itself passed — a future meeting's block dragged into the past is live state the update restores, never a frozen record that silently strips the meeting's padding; the write-side freeze additionally requires the role not to be provably live, so a just-ended meeting's still-wanted return block is restored too, while inside the return band the record stands in for the route and is never re-estimated | AC-OOO-013 |
| REQ-CONFIG-015 / §9.3 (backtracking safety) | The title pattern must lie in an accepted allowlist subset — bounded length, quantifier and alternation counts; a quantified group holds neither quantifier nor alternation; no lookarounds, backreferences, or Annex B literals — and a summary longer than the bound does not match at all (never truncated and matched), because Apps Script has no regex timeout | AC-CONFIG-007 |
| §7.2.1 (segment partition) | Pivot-spanning events are returned by both listing segments; ownership by end instant lists each once, so no source is planned twice and no companion is indexed twice | AC-RECOVERY-017, AC-RECOVERY-020 |
