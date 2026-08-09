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
// Ownership-filtered (privateExtendedProperty=dtp=1); used for the
// window-shrink cleanup pass in technical design 7.6
listGeneratedEventsBetween(calendarId, start, end) -> ObservedGeneratedEvent[]
createGeneratedEvent(spec) -> RawCalendarEvent
updateGeneratedEvent(observed, spec) -> RawCalendarEvent
patchGeneratedEventMetadata(observed, privateProperties) -> RawCalendarEvent
deleteGeneratedEvent(observed) -> void   // conditional; see 16.5.1

// Normalization and eligibility
normalizeCalendarEvent(rawEvent) -> NormalizedEvent
// Raw generated resources must be flattened before indexing or comparison;
// the comparator and cache lookup consume this shape, not raw Calendar JSON
normalizeObservedGeneratedEvent(rawEvent) -> ObservedGeneratedEvent
evaluateEligibility(event, directives, settings, window) -> EligibilityResult
resolveOrigin(event, directives, settings, workingLocations) -> ResolvedOrigin

// Routing and provider
// requestContext carries { role, cacheEntry, now, correlationId }; the client
// consults the cache before the network and reports fromCache on the result.
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
findStrandedCompanions(window, settings) -> { shrunk, events }        // 7.6
// engine lowers the high-water mark only after applyDiff confirms every
// stranded delete succeeded, never on dry run
loadHighWater() / saveHighWater(observeEnd)                           // 7.6

// Comparison helpers
ownedFieldsMatch(observedFields, desiredSpec) -> boolean
routeCacheNeedsPersisting(observed, freshRoute, now) -> boolean

// Fingerprint and comparison
fingerprintSpec(input) -> string
compareDesiredAndObserved(desiredSpecs, observedEvents, planningOutcomes, scanComplete)
  -> ReconciliationDiff

// Reconciliation
runReconciliation(options) -> ReconciliationResult

// Triggers
ensureTriggers() -> TriggerHealth
removeAutomation() -> CleanupResult
```
