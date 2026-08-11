# Technical Design Interface Reference

This file collects the principal function contracts from the technical design.

`compareDesiredAndObserved` takes planning outcomes as well as specs: it may only delete generated events whose parent planned successfully or was ruled ineligible (§17.4), or whose parent is absent from a **complete** scan (§15.2.3).

Write operations take the observed event rather than an event ID, so the ownership marker and version can be verified at write time rather than trusted from read time (§16.5.1).

```javascript
// Settings
// Never throws on validation problems: the engine branches on the tiers
// (structurallyValid gates every run, writeReady gates writes -- 5.3)
loadSettings() -> { settings: UserSettings, validation: ValidationResult }
saveSettings(settings) -> UserSettings
validateSettings(settings) -> ValidationResult

// Directives
parseDirectives(description) -> ParsedDirectives

// Calendar
// Deadline-aware: checks shouldStop between pages and returns the
// retrieved prefix with scanComplete false when it fires -- truncation
// is a first-class state downstream (7.2.1)
listWindowEvents(calendarId, observeStart, observeEnd, shouldStop)
  -> { events: RawCalendarEvent[], scanComplete: boolean }
listWorkingLocationEvents(calendarId, start, end) -> RawCalendarEvent[]
// Ownership-filtered (privateExtendedProperty=dtp=1), paginated until
// done or shouldStop fires, completeness reported -- a truncated shrink
// scan must not lower the high-water mark, and a large vacated range
// must not spend the deadline inside one call (technical design 7.6)
listGeneratedEventsBetween(calendarId, start, end, shouldStop)
  -> { events: ObservedGeneratedEvent[], scanComplete: boolean }
// Ownership + parent filtered, no time bounds, EXCLUDES cancelled
// tombstones (a deleted companion keeps its dtp metadata and must read as
// absent). Used by the overlong-source cleanup (15.2.6) and the
// out-of-window restoration pass (15.2.7)
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
fetchWorkingLocationsSafely(repository, start, end) -> RawCalendarEvent[]

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
// eventIdFilter runs, where it becomes result.eventDiagnostics (17.6)
buildRunResult(diff, applied, options, eventDiagnostics) -> ReconciliationResult
// Top-level error boundary: a run-wide throw (settings, window read)
// becomes a failed result and reaches the stored record (arch 14.2)
buildFailureResult(error, options) -> ReconciliationResult
// Complete ReconciliationResult for skipped/disabled outcomes -- bare
// status objects would make callers special-case those states (17.2)
buildStatusOnlyResult(status, reason, options) -> ReconciliationResult
// Execution-budget degradation (23.1): wall-clock check plus marking every
// unprocessed source failed (EXECUTION_BUDGET_EXCEEDED) before the loop
// stops -- a bare break orphans their companions
elapsedExceedsExecutionBudget(runStartMs) -> boolean
markRemainingSourcesFailed(orderedSources, currentEvent, planningOutcomes) -> void
// Non-fatal run warnings (codes from the 18.2 registry, e.g.
// WORKING_LOCATION_UNAVAILABLE): appends to
// ReconciliationDiagnostics.warnings (4.11) without failing the run
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
// applied blindly (15.2.7)
resolveOutOfWindowCompanions(diff, cleanup, repository, shouldStop) -> void
// Daily-run ownership sweep (15.2.8): updatedMin-bounded listing (a
// stray was necessarily moved, and moves bump `updated`; cancelled
// tombstones excluded; stops early when shouldStop fires),
// anchor-selected candidates (event id absent from the window read,
// anchor inside the slacked planning range), one getEventById per
// candidate parent, then a parent-STATE decision: absent/cancelled,
// live-but-out-of-window, and in-window ineligible all delete; planned
// keeps its candidates (restoration owns them) unless the key is already
// satisfied in-window (stranded duplicate); failed preserves --
// restoration is create-driven and cannot reach a stray whose parent no
// longer plans. Runs only on a COMPLETE window scan; takes the full
// observed list, never the key index (the id test must see in-window
// duplicates the index collapsed away) and the run's injected `now`
// (updatedMin, the anchor band, and the dtp.sweepCompletedAt watermark
// all derive from it -- a wall-clock read would unpin them)
sweepOutOfWindowCompanions(observedGenerated, planningOutcomes, window,
                           now, repository, shouldStop)
  -> ObservedGeneratedEvent[]
// Hourly diagnostic allowance (20.3): budget the routing client actually
// decrements when reason === 'event-diagnostic'; spend recorded even on
// dry runs -- the broker calls happened. The read FAILS CLOSED (returns
// 0 on a Properties error) so an outage that breaks spend writes cannot
// simultaneously mint fresh allowances (18.2)
diagnosticBudgetRemaining(now) -> number
recordDiagnosticRouteSpend(count, now) -> void
// Console/log-only diagnostic for failures that occur after the run's
// result is built (e.g. the finally-block spend write) -- never throws
logWarning(code, error) -> void
// Assembles the per-event diagnostic payload (17.6) for eventIdFilter
// runs; origin and outcome are null when eligibility already rejected;
// routes copied from outcome.routes (17.4). effectiveBufferMinutes is
// passed in by the engine (directive override or settings default) --
// it must be displayable even when planning failed before any spec
// existed to infer it from
captureEventDiagnostics(event, eligibility, directives, origin, outcome,
                        effectiveBufferMinutes)
  -> EventDiagnostics
// Fallback payload when the diagnostic flow cannot evaluate the opened
// event: a synthesized ineligible EligibilityResult with reason
// EVENT_NOT_FOUND or PARENT_NOT_FOUND (engine-side, targeted read
// resolved nothing, 17.1) or UNSUPPORTED_CALENDAR (card-side, opened
// calendar differs from the resolved primary id, BEFORE any engine run,
// 20.3) -- the card must never render silence for exactly the events
// users most wonder about
buildUnresolvedEventDiagnostics(eventId, reason) -> EventDiagnostics

// Triggers
ensureTriggers() -> TriggerHealth
// Card action: bounded work only -- under the user lock it persists
// enabled=false, removes triggers, and enqueues the cleanup worker; the
// unbounded scan-and-delete lives in the worker (19.4)
removeAutomation() -> ActionResponse
// Budget-bounded cleanup passes: pages and deletes interleaved (fetch a
// page, delete it, re-fetch -- deletions shrink the set, so retries
// resume with no persisted cursor), persists cumulative counts in
// CleanupProgress (dtp.removalProgress), re-enqueues until the scan
// completes (capped at MAX_REMOVAL_PASSES; contention retries bounded
// separately); every terminal outcome except a user abort writes the
// settings tombstone -- REQ-PRIV-006 cannot be conditional on Calendar
// accepting every delete (19.4)
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
// reaches the run result.
enqueueContinuation() -> { scheduled: boolean, capReached: boolean }
incrementContinuationCount() / resetContinuationCount()
runContinuationReconciliation(e) -> ReconciliationResult
```
