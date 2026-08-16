# Technical Design Interface Reference

This file collects the principal function contracts from the technical design.

`compareDesiredAndObserved` takes planning outcomes as well as specs: it may only delete generated events whose parent planned successfully or was ruled ineligible (§17.4), or whose parent is absent from a **complete** scan (§15.2.3).

Write operations take the observed event rather than an event ID, so the ownership marker and version can be verified at write time rather than trusted from read time (§16.5.1).

```javascript
// Settings
// Never throws on validation problems: the engine branches on the tiers
// (structurallyValid gates every run, writeReady gates writes -- 5.3).
// Never throws on a corrupt document either: malformed stored JSON and
// unmigratable schemas both come back as structural INVALID_SETTINGS
// errors (5.4); an absent document loads the 5.2 defaults
loadSettings() -> { settings: UserSettings, validation: ValidationResult }
saveSettings(settings) -> UserSettings
validateSettings(settings) -> ValidationResult

// Directives
parseDirectives(description) -> ParsedDirectives

// Calendar
// Deadline-aware: checks shouldStop between pages and returns the
// retrieved prefix with scanComplete false when it fires -- truncation
// is a first-class state downstream (7.2.1). RESUMABLE: nextPageToken is
// non-null exactly when the listing stopped early; the engine persists
// it (dtp.windowScanCursor, pinned to the range that produced it) and a
// continuation passes it back as resumeToken so successive passes tile
// the range instead of re-reading the same prefix until the cap. An
// expired or rejected resumeToken falls back to a fresh scan, never a
// thrown run
listWindowEvents(calendarId, observeStart, observeEnd, shouldStop,
                 resumeToken)
  -> { events: RawCalendarEvent[], scanComplete: boolean,
       nextPageToken: string | null, resumed: boolean }
// resumed reports whether the resumeToken was HONORED: false when none
// was given or the token was expired/rejected and the call fell back to
// a fresh scan from page one. The engine keys slice semantics on it --
// forcing scanComplete false, chainFinished, point-read deletes -- so a
// fallback fresh scan that walks off the end keeps full complete-scan
// credit instead of being misclassified as a slice
listWorkingLocationEvents(calendarId, start, end) -> RawCalendarEvent[]
// Ownership-filtered (privateExtendedProperty=dtp=1), paginated until
// done or shouldStop fires, completeness reported -- a truncated shrink
// scan must not lower the high-water mark, and a large vacated range
// must not spend the deadline inside one call (technical design 7.6)
listGeneratedEventsBetween(calendarId, start, end, shouldStop)
  -> { events: ObservedGeneratedEvent[], scanComplete: boolean }
// Ownership + parent filtered, no time bounds, EXCLUDES cancelled
// tombstones (a deleted companion keeps its dtp metadata and must read as
// absent). Used by the overlong-source cleanup (15.2.6), the
// out-of-window restoration pass (15.2.7), AND the 17.1 targeted
// diagnostic read -- which is why scoped diagnostics may skip 15.2.7:
// the unbounded, tombstone-filtered semantics here are load-bearing for
// that skip, so narrowing them breaks it
listCompanionsByParent(calendarId, parentEventId) -> ObservedGeneratedEvent[]
// Targeted single-event fetch for diagnostic runs (17.1): the window scan
// cannot see an event beyond the observation range, and the card must be
// able to say OUTSIDE_WINDOW rather than nothing
getEventById(calendarId, eventId) -> RawCalendarEvent | null
// One page of the unbounded ownership scan; the consumer owns the paging
// loop and its budget checks. The removal worker interleaves this with
// deletion so retries resume without a persisted cursor (19.4)
listGeneratedEventsPage(calendarId, pageToken)
  -> { events: ObservedGeneratedEvent[], nextPageToken: string | null }
// Ownership-filtered, updatedMin-bounded listing for the 15.2.8 sweep: a
// stray exists only because it was MOVED, and a move bumps `updated`, so
// the server-side bound keeps the sweep small and resumable where a
// read-only full-history scan would return the same truncated prefix
// forever. EXCLUDES cancelled tombstones -- updatedMin listings force
// deleted entries in, and a just-deleted companion would re-enter the
// diff as a 404-bound delete. Pages until done or shouldStop() fires
// (scanComplete reports truncation)
listGeneratedEventsUpdatedSince(calendarId, updatedMin, shouldStop)
  -> { events: ObservedGeneratedEvent[], scanComplete: boolean }
createGeneratedEvent(spec) -> RawCalendarEvent
updateGeneratedEvent(observed, spec) -> RawCalendarEvent
patchGeneratedEventMetadata(observed, privateProperties) -> RawCalendarEvent
deleteGeneratedEvent(observed) -> void   // conditional; see 16.5.1

// Normalization and eligibility
normalizeCalendarEvent(rawEvent) -> NormalizedEvent
// Raw generated resources must be flattened before indexing or comparison;
// the comparator and cache lookup consume this shape, not raw Calendar JSON.
// routeSecs: numeric only when the raw string is non-empty and entirely
// numeric; everything else maps to null, never 0 (technical design 13.3)
normalizeObservedGeneratedEvent(rawEvent) -> ObservedGeneratedEvent
evaluateEligibility(event, directives, settings, window) -> EligibilityResult
// null when every fallback bottoms out at a blank default (10.4): the
// engine records a per-event failed outcome (MISSING_DEFAULT_ORIGIN)
// instead of routing -- reachable only on dry runs, since writeReady
// gates write mode on a configured default
resolveOrigin(event, directives, settings, workingLocations)
  -> ResolvedOrigin | null
// Wraps listWorkingLocationEvents: a read failure records
// WORKING_LOCATION_UNAVAILABLE (18.2) and returns [], so origin resolution
// degrades to the default origin instead of failing the run (7.5)
fetchWorkingLocationsSafely(start, end) -> RawCalendarEvent[]

// Routing and provider
// requestContext carries { role, cacheEntry, now, budget, correlationId };
// the client consults the cache before the network and reports provenance as
// result.source ('durable' | 'ephemeral' | 'broker') -- anything other than
// 'durable' needs persisting (11.1). budget.remaining is decremented per
// HTTP attempt, retries included (11.2).
getRouteDuration(from, to, requestContext) -> RouteResult
getGeneratedEventSpecs(context) -> PlanningOutcome

// Context construction -- observed companions must be indexed before planning
// so their route caches are reachable (technical design 12.1.1)
indexByGeneratedKey(observedEvents) -> Map<string, ObservedGeneratedEvent>
routeCacheFor(observedByKey, parentEventId)
  -> { outbound: RouteCacheEntry|null, return: RouteCacheEntry|null }

// Route plan cache (derived state, stored on generated events)
// Endpoints are { type, value } in BOTH directions; the return route swaps
// them, so a typed-origin/string-destination signature breaks (13.3)
routeInputHash(fromEndpoint, toEndpoint, travelMode) -> string
cachedRouteIsUsable(metadata, expectedHash, now) -> boolean
quantizeDuration(seconds) -> number

// Window -- two ranges, see technical design 7.2
calculateWindow(windowDays, now)
  -> { planStart: Date, planEnd: Date, observeStart: Date, observeEnd: Date }
overlapsPlanningRange(event, window) -> boolean   // intersection, not start-containment
// Stranded = start at or after the new horizon; a companion SPANNING the
// boundary is visible to the ordinary read, which alone decides its fate
// dryRun suppresses even the mark-ADVANCE on the common path -- a preview
// must not change whether a later run classifies as a shrink. shouldStop
// bounds the vacated-range scan like every other paged read; early return
// reports scanComplete false and retains the mark
findStrandedCompanions(window, settings, dryRun, shouldStop)
  -> { shrunk, events, scanComplete }                                  // 7.6
// engine lowers the high-water mark only after applyDiff confirms every
// stranded delete succeeded AND the cleanup scan was complete, never on
// dry run
loadHighWater() / saveHighWater(observeEnd)                           // 7.6

// Comparison helpers
ownedFieldsMatch(observedFields, desiredSpec) -> boolean
// true when freshRoute.source !== 'durable' (11.1, 15.2.2)
routeCacheNeedsPersisting(observed, freshRoute, now) -> boolean
// Upcoming first, then in-progress and lookback -- API response order would
// spend the route budget on the past (23.2); called before the planning loop
orderForPlanning(normalizedEvents, now) -> NormalizedEvent[]
// Overlong-source cleanup gate (technical design 15.2.6): duration-keyed,
// reason-agnostic; fires when either companion role is unobserved
sourceExceedsDurationCap(event) -> boolean
bothRolesObserved(observedByKey, parentEventId) -> boolean

// Fingerprint and comparison
fingerprintSpec(input) -> string
compareDesiredAndObserved(desiredSpecs, observedEvents, planningOutcomes, scanComplete)
  -> ReconciliationDiff

// Reconciliation
runReconciliation(options) -> ReconciliationResult
// Returns what Calendar ACCEPTED; run status is built from this, not from
// the proposed diff (technical design 17.5, REQ-ERROR-006). Budget-aware:
// checks elapsedExceedsExecutionBudget between operations and defers the
// remainder (deferredOps -- not failures; deferred > 0 reports partial)
applyDiff(diff, runStartMs) -> ApplyResult
// applied null on dry run; eventDiagnostics null except on
// eventIdFilter runs, where it becomes result.eventDiagnostics (17.6).
// Summarizes the ApplyResult into result.applied (17.2) -- the
// contract-defined path by which ACCEPTED counts reach saveRunStatus
// and the 20.2 record; the diff alone is only the proposal
buildRunResult(diff, applied, options, eventDiagnostics) -> ReconciliationResult
// Top-level error boundary: a run-wide throw (settings, window read)
// becomes a failed result and reaches the stored record (arch 14.2)
buildFailureResult(error, options) -> ReconciliationResult
// Complete ReconciliationResult for skipped/disabled outcomes -- bare
// status objects would make callers special-case those states (17.2)
buildStatusOnlyResult(status, reason, options) -> ReconciliationResult
// THE guarded persistence wrapper -- the only way the engine calls
// saveRunStatus. On a throw it pushes STATUS_PERSIST_FAILED onto the
// result's diagnostics.warnings and logs, never rethrows (18.2). One
// shared helper for all four call sites (both validation gates, the
// success path, the error boundary) so the guard cannot drift between
// hand-rolled copies
saveRunStatusGuarded(result) -> void
// Execution-budget degradation (23.1): wall-clock check plus marking every
// unprocessed source failed (EXECUTION_BUDGET_EXCEEDED) before the loop
// stops -- a bare break orphans their companions
elapsedExceedsExecutionBudget(runStartMs) -> boolean
markRemainingSourcesFailed(orderedSources, currentEvent, planningOutcomes) -> void
// Non-fatal run warnings (codes from the 18.2 registry, e.g.
// WORKING_LOCATION_UNAVAILABLE): appends to the run's WARNING BUFFER
// (4.11) AND logs via logWarning, without failing the run. The buffer
// is one array the engine creates at run start; the comparator installs
// THAT ARRAY by reference as diff.diagnostics.warnings and every result
// builder carries it into the result -- which is why warnings recorded
// BEFORE the comparator (cursor persistence, the daily counter reset)
// and AFTER the result is built (post-apply bookkeeping, the enqueue
// guard) all land in the same persisted diagnostics. One mechanism for
// every engine warning site; saveRunStatusGuarded embeds the same
// append+log internally for STATUS_PERSIST_FAILED
recordRunWarning(code, error) -> void
// Constructs an AppErrorRecord (18.1) from a registry code (18.2):
// message and retryability from the registry entry, sourceEventId from
// the event. Used by the engine's per-event failure paths, e.g. the
// MISSING_DEFAULT_ORIGIN outcome (10.4)
buildAppError(code, event) -> AppErrorRecord
// Engine post-pass on the diff: one unbounded parent lookup per pending
// create; a same-key match converts the create to an update -- a dragged
// companion is restored, not duplicated. Restoration supersedes the shrink
// cleanup: a matched event is removed from diff.deletes AND cleanup.events.
// Checks shouldStop between lookups; when it fires the engine re-evaluates
// the budget and skips application -- an unresolved create must never be
// applied blindly (15.2.7). SKIPPED on scoped diagnostic runs: the 17.1
// targeted read already performed this exact lookup for the one parent,
// so re-querying is a redundant round trip whose failure would fail an
// otherwise complete diagnosis
resolveOutOfWindowCompanions(diff, cleanup, shouldStop) -> void
// Daily-run ownership sweep (15.2.8): updatedMin-bounded listing (a
// stray was necessarily moved, and moves bump `updated`; cancelled
// tombstones excluded; stops early when shouldStop fires),
// anchor-selected candidates (event id absent from the window read,
// anchor inside the maximal anchor band: from planStart minus the
// discovery slack and duration cap up to NOW + MAX_WINDOW_DAYS + the
// duration cap -- upper bound anchored at now, NOT planStart, which
// sits a lookback behind and would reject a far-edge stray; the
// current planEnd would let a window shrink hide one, 15.2.8),
// one getEventById per
// candidate parent -- shouldStop checked BETWEEN reads too, and a sweep
// cut short anywhere never writes the watermark -- then a parent-STATE
// decision: absent/cancelled,
// live-but-out-of-window, and in-window ineligible all delete; planned
// keeps its candidates (restoration owns them) unless the key is already
// satisfied in-window (stranded duplicate); failed preserves --
// restoration is create-driven and cannot reach a stray whose parent no
// longer plans. Runs only on a COMPLETE window scan; takes the full
// observed list, never the key index (the id test must see in-window
// duplicates the index collapsed away) and the run's injected `now`
// (updatedMin, the anchor band, and the dtp.sweepCompletedAt watermark
// all derive from it -- a wall-clock read would unpin them).
// sweepComplete false = listing truncated or read loop cut short; the
// engine records it as diagnostics.sweepComplete and writes the
// watermark only after applyDiff confirms deletedAll(events) -- the
// same application-gated rule as the shrink high-water mark
sweepOutOfWindowCompanions(observedGenerated, planningOutcomes, window,
                           now, shouldStop)
  -> { events: ObservedGeneratedEvent[], sweepComplete: boolean }
loadSweepWatermark() / saveSweepWatermark(now)                    // 15.2.8
// Incomplete-scan orphan resolution (15.2.3, 15.2.4): reads its
// candidates from diff.preserved -- only companions whose parent has NO
// planningOutcomes entry (a failed parent's outcome is known; no read).
// One parent point read per candidate, shouldStop checked BETWEEN reads
// -- absent/cancelled parent proves the orphan and MOVES it from
// preserved into diff.deletes; a LIVE parent preserves it this run
// (unread page and moved-out-of-range are indistinguishable here); a
// read the guard cut off preserves it and counts in suppressedDeletes
resolveUnmatchedCompanions(diff, planningOutcomes, shouldStop) -> void
// Window-scan cursor persistence (7.2.1) -- User Properties, engine
// policy, stubs live beside the other Status persistence, NOT in
// CalendarRepository. Saved when a truncated non-dry scan STARTS or
// ADVANCES a chain (a fresh truncated run never overwrites a pending
// cursor -- the chain owns it); resumed by continuation and daily runs;
// cleared by chain completion, by a fresh COMPLETE non-dry scan, and by
// remove-all (19.4); dry runs never touch it. A resumed run is treated
// as scanComplete false downstream regardless -- its coverage is a
// slice by construction. The load NEVER THROWS and validates the stored
// shape: absent, malformed, or unreadable cursors return null,
// degrading to a fresh scan -- never a failed run (AC-RECOVERY-017)
loadWindowScanCursor()
  -> { pageToken, observeStart, observeEnd } | null
saveWindowScanCursor(cursor) / clearWindowScanCursor()
// Whether a partial run's remaining causes are ones another pass can
// drain: deferred operations, an application skipped for time, an
// exhausted route budget, or an unfinished scan chain. False when the
// only cause is scan coverage after a FINISHED chain -- a fresh chain
// would re-tile identical work (a pass justified by other causes may
// re-tile as a side effect, bounded by the day's remaining allowance)
// (19.6, 23.4)
continuationStillUseful(result, chainFinished) -> boolean
// Hourly diagnostic allowance (20.3), RESERVE-then-REFUND: the reserve
// writes the whole remaining allowance as used BEFORE any broker call
// and returns the grant (the run's RouteBudget when reason ===
// 'event-diagnostic'); the refund returns the unspent remainder in the
// engine's finally. Reservation order is the safety property: a failed
// reserve grants 0 (FAILS CLOSED on any Properties error), a failed
// refund under-grants until the bucket rolls over -- neither direction
// can exceed the ceiling, unlike spend-then-record, where a post-call
// write failure re-grants already-spent allowance (18.2)
reserveDiagnosticAllowance(now) -> number
// The refund is a DECREMENT (used = max(0, used - unspentCount)), never
// an absolute write, and a no-op at unspentCount 0 -- so a reservation
// that failed closed (granted 0, spent 0) cannot have its refund clobber
// the bucket when Properties recovers; the engine additionally skips the
// call entirely when nothing was granted
refundDiagnosticAllowance(unspentCount, now) -> void
// Console/log-only diagnostic for failures that occur after the run's
// result is built (e.g. the finally-block spend write) -- never throws
logWarning(code, error) -> void
// Assembles the per-event diagnostic payload (17.6) for eventIdFilter
// runs; origin and outcome are null when eligibility already rejected;
// routes copied from outcome.routes (17.4). effectiveBufferMinutes is
// passed in by the engine (directive override or settings default) --
// it must be displayable even when planning failed before any spec
// existed to infer it from. destination is the NORMALIZED location
// (trimmed, 8.4; empty string when the source has none; null only in
// the synthesized fallback payloads) -- REQ-UI-014: nothing downstream
// retains it, and without the capture the card would need a second
// Calendar read to show it. Diagnostics are dry-only and never
// persisted, so the address stays in-card
captureEventDiagnostics(event, eligibility, directives, origin, outcome,
                        effectiveBufferMinutes)
  -> EventDiagnostics
// Fallback payload when the diagnostic flow cannot evaluate the opened
// event: a synthesized ineligible EligibilityResult with reason
// EVENT_NOT_FOUND or PARENT_NOT_FOUND (engine-side, targeted read
// resolved nothing, 17.1), DISABLED_GLOBALLY (engine-side, the disabled
// gate precedes the targeted read on a scoped run, 17.1), or
// UNSUPPORTED_CALENDAR (card-side, opened calendar differs from the
// resolved primary id, BEFORE any engine run, 20.3) -- the card must
// never render silence for exactly the events users most wonder about
buildUnresolvedEventDiagnostics(eventId, reason) -> EventDiagnostics

// Triggers
ensureTriggers() -> TriggerHealth
// Card action: bounded work only -- under the user lock it REPLACES the
// settings document with the disabled tombstone (the 5.2 defaults with
// enabled=false, destroying origin addresses -- REQ-PRIV-006), removes
// triggers, initializes progress, and enqueues the cleanup worker; the
// unbounded scan-and-delete lives in the worker (19.4)
removeAutomation() -> ActionResponse
// Budget-bounded cleanup passes: pages and deletes interleaved (fetch a
// page, delete it, re-fetch -- deletions shrink the set, so retries
// resume with no persisted cursor), persists cumulative counts in
// CleanupProgress (dtp.removalProgress), re-enqueues until the scan
// completes (capped at MAX_REMOVAL_PASSES; contention retries bounded
// separately). NEVER writes the settings document: the card action wrote
// the disabled tombstone under its lock before the worker existed, so
// REQ-PRIV-006 holds on every outcome including a worker that never
// wins the lock again (19.4)
runRemovalCleanup(e) -> CleanupProgress
// Manual sync enqueues -- card callbacks cannot fit a full reconcile
// (technical design 19.5; one-off trigger, subject to Spike 1). The
// pending-check-and-create is serialized under the user lock; handlers
// delete every pending trigger for their handler on entry, collapsing
// duplicates that slip through while a run holds the lock
onSynchronizeNow(e) -> ActionResponse
runManualReconciliation(e) -> ReconciliationResult
// Partial-run continuation worker (19.6). The counter is incremented by
// the ENGINE under the user lock (a handler-side increment races the
// reset a concurrent successful run performs); skipped runs never reach
// the counter, so no refund path exists -- the handler just re-enqueues.
// Reset by any successful non-dry run; cap enforced at enqueue time; the
// enqueue return value is how diagnostics.continuationCapReached (4.11)
// reaches the run result. BOTH call sites guard it -- trigger creation
// can throw (per-user quota): the engine's partial-run call keeps the
// truthful applied result and records a CONTINUATION_ENQUEUE_FAILED
// warning, never a false failure record; the handler's skip-path
// re-enqueue logs the same code (log-only -- skipped results are never
// persisted or rendered, so a warning on one reaches nobody). Deferred
// work falls to the daily backstop (19.6)
enqueueContinuation() -> { scheduled: boolean, capReached: boolean }
incrementContinuationCount() / resetContinuationCount()
runContinuationReconciliation(e) -> ReconciliationResult
```
