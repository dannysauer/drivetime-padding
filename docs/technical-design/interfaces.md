# Technical Design Interface Reference

This file collects the principal function contracts from the technical design.

`compareDesiredAndObserved` takes planning outcomes as well as specs: it may only delete generated events whose parent planned successfully or was ruled ineligible (§17.4), or whose parent is absent from a **complete** scan (§15.2.3).

Write operations take the observed event rather than an event ID, so the ownership marker and version can be verified at write time rather than trusted from read time (§16.5.1).

```javascript
// Settings
loadSettings() -> UserSettings
saveSettings(settings) -> UserSettings
validateSettings(settings) -> ValidationResult

// Directives
parseDirectives(description) -> ParsedDirectives

// Calendar
listWindowEvents(calendarId, observeStart, observeEnd)
  -> { events: RawCalendarEvent[], scanComplete: boolean }
listWorkingLocationEvents(calendarId, start, end) -> RawCalendarEvent[]
// Ownership-filtered (privateExtendedProperty=dtp=1), paginated to
// completion with completeness reported -- a truncated shrink scan must
// not lower the high-water mark (technical design 7.6)
listGeneratedEventsBetween(calendarId, start, end)
  -> { events: ObservedGeneratedEvent[], scanComplete: boolean }
// Ownership + parent filtered, no time bounds, EXCLUDES cancelled
// tombstones (a deleted companion keeps its dtp metadata and must read as
// absent). Used by the overlong-source cleanup (15.2.6) and the
// out-of-window restoration pass (15.2.7)
listCompanionsByParent(calendarId, parentEventId) -> ObservedGeneratedEvent[]
// Unbounded ownership scan for "remove all generated events" -- window
// scans miss events that aged out of the rolling range (19.4)
listAllGeneratedEvents(calendarId)
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
resolveOrigin(event, directives, settings, workingLocations) -> ResolvedOrigin

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
findStrandedCompanions(window, settings)
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
// the proposed diff (technical design 17.5, REQ-ERROR-006)
applyDiff(diff) -> ApplyResult
buildRunResult(diff, applied, options) -> ReconciliationResult   // applied null on dry run
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
// Engine post-pass on the diff: one unbounded parent lookup per pending
// create; a same-key match converts the create to an update -- a dragged
// companion is restored, not duplicated. Restoration supersedes the shrink
// cleanup: a matched event is removed from diff.deletes AND cleanup.events
// (15.2.7)
resolveOutOfWindowCompanions(diff, cleanup, repository) -> void
// Hourly diagnostic allowance (20.3): budget the routing client actually
// decrements when reason === 'event-diagnostic'; spend recorded even on
// dry runs -- the broker calls happened
diagnosticBudgetRemaining(now) -> number
recordDiagnosticRouteSpend(count, now) -> void

// Triggers
ensureTriggers() -> TriggerHealth
removeAutomation() -> CleanupResult
// Manual sync enqueues -- card callbacks cannot fit a full reconcile
// (technical design 19.5; one-off trigger, subject to Spike 1)
onSynchronizeNow(e) -> ActionResponse
runManualReconciliation(e) -> ReconciliationResult
// Partial-run continuation worker (19.6): counter incremented on entry,
// refunded on lock-contention skips, reset by any successful non-dry run,
// cap enforced at enqueue time. Called by the ENGINE after a partial run;
// the return value is how continuationCapReached reaches run status.
enqueueContinuation() -> { scheduled: boolean, capReached: boolean }
resetContinuationCount() / decrementContinuationCount()
runContinuationReconciliation(e) -> ReconciliationResult
```
