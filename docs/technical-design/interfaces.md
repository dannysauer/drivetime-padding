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
createGeneratedEvent(spec) -> RawCalendarEvent
updateGeneratedEvent(observed, spec) -> RawCalendarEvent
patchGeneratedEventMetadata(observed, privateProperties) -> RawCalendarEvent
deleteGeneratedEvent(observed) -> void   // conditional; see 16.5.1

// Normalization and eligibility
normalizeCalendarEvent(rawEvent) -> NormalizedEvent
evaluateEligibility(event, directives, settings, window) -> EligibilityResult
resolveOrigin(event, directives, settings, workingLocations) -> ResolvedOrigin

// Routing and provider
getRouteDuration(origin, destination, requestContext) -> RouteResult
getGeneratedEventSpecs(context) -> PlanningOutcome

// Route plan cache (derived state, stored on generated events)
routeInputHash(origin, destination, travelMode) -> string
cachedRouteIsUsable(metadata, expectedHash, now) -> boolean
quantizeDuration(seconds) -> number

// Window -- two ranges, see technical design 7.2
calculateWindow(windowDays, now)
  -> { planStart: Date, planEnd: Date, observeStart: Date, observeEnd: Date }
overlapsPlanningRange(event, window) -> boolean   // intersection, not start-containment

// Comparison helpers
ownedFieldsMatch(observedFields, desiredSpec) -> boolean
routeCacheNeedsPersisting(observed, freshRoute, now) -> boolean

// Fingerprint and comparison
fingerprintSpec(input) -> string
compareDesiredAndObserved(desiredSpecs, observedEvents, planningOutcomes) -> ReconciliationDiff

// Reconciliation
runReconciliation(options) -> ReconciliationResult

// Triggers
ensureTriggers() -> TriggerHealth
removeAutomation() -> CleanupResult
```
