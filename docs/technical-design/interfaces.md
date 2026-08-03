# Technical Design Interface Reference

This file collects the principal function contracts from the technical design.

`compareDesiredAndObserved` takes planning outcomes as well as specs: it may only delete generated events whose parent planned successfully or was ruled ineligible (§17.4).

```javascript
// Settings
loadSettings() -> UserSettings
saveSettings(settings) -> UserSettings
validateSettings(settings) -> ValidationResult

// Directives
parseDirectives(description) -> ParsedDirectives

// Calendar
listWindowEvents(calendarId, start, end) -> RawCalendarEvent[]
listWorkingLocationEvents(calendarId, start, end) -> RawCalendarEvent[]
createGeneratedEvent(spec) -> RawCalendarEvent
updateGeneratedEvent(eventId, spec) -> RawCalendarEvent
deleteGeneratedEvent(eventId) -> void

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

// Window
calculateWindow(windowDays, now) -> { start: Date, end: Date }

// Fingerprint and comparison
fingerprintSpec(input) -> string
compareDesiredAndObserved(desiredSpecs, observedEvents, planningOutcomes) -> ReconciliationDiff

// Reconciliation
runReconciliation(options) -> ReconciliationResult

// Triggers
ensureTriggers() -> TriggerHealth
removeAutomation() -> CleanupResult
```
