# Drivetime Padding Technical Design

**Document version:** 1.0-draft  
**Status:** Implementation blueprint  
**Depends on:** `docs/architecture/architecture.md`

---

## 1. Purpose

This document translates the approved architecture into concrete implementation contracts. It specifies the internal data structures, module APIs, Calendar API mappings, metadata schema, route-broker protocol, reconciliation algorithm, error model, and test seams required to build the MVP.

The design intentionally favors a small number of explicit modules over a large framework. The core implementation centers on a reconciliation engine that converts source events into deterministic generated-event specifications, compares those specifications with observed generated events, and applies the smallest safe diff.

The technical design is normative for the MVP unless implementation testing reveals a Google API limitation that requires revision.

---

## 2. Runtime and Language Constraints

The add-on runs in the Google Apps Script V8 runtime.

Implications:

- JavaScript is the implementation language.
- Apps Script globals such as `Calendar`, `CardService`, `PropertiesService`, `LockService`, `ScriptApp`, `Utilities`, and `UrlFetchApp` are available at runtime.
- Native ES modules are not assumed.
- Source files share one Apps Script global namespace after deployment.
- Module boundaries are therefore enforced by naming conventions, small public APIs, and test bundling rather than runtime imports.
- Business logic should avoid Apps Script globals wherever possible so it can be unit tested under Node.js.

Recommended conventions:

- functions ending in `_` are module-private by convention;
- public functions use stable names required by triggers or CardService actions;
- pure logic functions accept ordinary objects and return ordinary objects;
- infrastructure wrappers isolate Apps Script services.

---

## 3. Source Layout

```text
src/apps-script/
├── appsscript.json
├── Constants.js
├── Code.js
├── Settings.js
├── Triggers.js
├── UI.js
├── ReconciliationEngine.js
├── CalendarRepository.js
├── DrivetimeProvider.js
├── RoutingClient.js
├── Normalizer.js
├── Eligibility.js
├── Directives.js
├── Fingerprint.js
├── Status.js
└── Errors.js
```

### 3.1 Responsibilities

| File | Responsibility |
|---|---|
| `Constants.js` | Shared bounds and tuning values referenced across modules |
| `Code.js` | Trigger and command entrypoints only |
| `Settings.js` | Defaults, persistence, validation, migration |
| `Triggers.js` | Install, inspect, deduplicate, and repair triggers |
| `UI.js` | CardService cards and action responses |
| `ReconciliationEngine.js` | End-to-end orchestration and diff application |
| `CalendarRepository.js` | Advanced Calendar API reads and writes |
| `DrivetimeProvider.js` | Origin resolution and generated-event calculations |
| `RoutingClient.js` | Broker HTTP request/response handling |
| `Normalizer.js` | Raw Calendar event to normalized source event |
| `Eligibility.js` | Eligibility decisions and reason codes |
| `Directives.js` | Description directive grammar and parsing |
| `Fingerprint.js` | Canonical serialization and SHA-256 hashing |
| `Status.js` | Last-run persistence and user diagnostics |
| `Errors.js` | Stable application error types and codes |

The initial implementation should not split these files further unless a file becomes difficult to navigate or test.

---

## 4. Core Data Types

The codebase uses plain JavaScript objects. The following TypeScript-like definitions are documentation contracts, not a requirement to compile TypeScript.

### 4.1 UserSettings

```typescript
interface UserSettings {
  schemaVersion: number;
  enabled: boolean;
  windowDays: number;
  defaultBufferMinutes: number;
  eligibility: {
    includeOutOfOffice: boolean;
    titlePatternEnabled: boolean;
    titlePattern: string;
    caseSensitive: boolean;
  };
  origins: {
    default: OriginSetting;
    home: OriginSetting;
    office: OriginSetting;
  };
  workingLocation: {
    enabled: boolean;
    fallbackToDefault: boolean;
  };
  generatedEvents: {
    titlePrefix: string;
  };
}
```

### 4.2 OriginSetting

```typescript
interface OriginSetting {
  type: "address" | "placeId";
  value: string;
}
```

An empty optional origin is represented by an empty `value`. The default origin must be non-empty before synchronization may write events.

### 4.3 NormalizedEvent

```typescript
interface NormalizedEvent {
  id: string;
  iCalUID: string | null;
  recurringEventId: string | null;
  originalStartTime: string | null;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  timeZone: string | null;
  eventType: string;
  transparency: "opaque" | "transparent" | null;
  status: string;
  isAllDay: boolean;
  privateProperties: Record<string, string>;
  rawEtag: string | null;
}
```

All date-time values are ISO-8601 strings including an offset whenever provided by Calendar. Normalization must not convert to the script project timezone prematurely.

### 4.4 ParsedDirectives

```typescript
interface ParsedDirectives {
  disabled: boolean;
  bufferMinutes: number | null;
  origin: "home" | "office" | "default" | null;
  warnings: string[];
}
```

### 4.5 EligibilityResult

```typescript
interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
  matchedBy: "outOfOffice" | "titlePattern" | null;
}
```

Stable reason values:

```text
ELIGIBLE_OUT_OF_OFFICE
ELIGIBLE_TITLE_PATTERN
DISABLED_GLOBALLY
GENERATED_EVENT
ALL_DAY_EVENT
CANCELLED_EVENT
MISSING_LOCATION
DISABLED_BY_DIRECTIVE
UNSUPPORTED_EVENT_TYPE
SOURCE_TOO_LONG
TITLE_PATTERN_DISABLED
TITLE_PATTERN_NO_MATCH
INVALID_TITLE_PATTERN
OUTSIDE_WINDOW
```

### 4.6 ResolvedOrigin

```typescript
interface ResolvedOrigin {
  source: "directive" | "workingLocation" | "default";
  name: "home" | "office" | "default";
  type: "address" | "placeId";
  value: string;
}
```

### 4.7 RouteResult

```typescript
interface RouteResult {
  durationSeconds: number;
  distanceMeters: number | null;
}
```

### 4.8 GeneratedEventSpec

```typescript
interface GeneratedEventSpec {
  key: string;
  role: "outbound" | "return";
  parentEventId: string;
  parentICalUID: string | null;
  parentOriginalStart: string | null;
  summary: string;
  start: string;
  end: string;
  eventType: string;
  transparency: "opaque" | "transparent" | null;
  privateProperties: Record<string, string>;
  fingerprint: string;
}
```

`key` is internal and deterministic:

```text
<parentEventId>|<role>
```

### 4.9 ObservedGeneratedEvent

```typescript
interface ObservedGeneratedEvent {
  id: string;
  key: string;
  role: string;
  parentEventId: string;
  fingerprint: string | null;
  /** Owned fields as they currently stand, for the 15.2.1 comparison. */
  observedFields: {
    start: string;
    end: string;
    summary: string;
    eventType: string;
    transparency: "opaque" | "transparent" | null;
  };
  routeCache: {
    routeHash: string | null;
    routeSecs: number | null;
    routeAt: string | null;
  };
  rawEvent: object;
}
```

### 4.10 ReconciliationDiff

```typescript
interface ReconciliationDiff {
  creates: GeneratedEventSpec[];
  updates: Array<{
    observed: ObservedGeneratedEvent;
    desired: GeneratedEventSpec;
  }>;
  /** Private-property writes only. No user-visible change. See 15.2.2. */
  metadataPatches: Array<{
    observed: ObservedGeneratedEvent;
    privateProperties: Record<string, string>;
  }>;
  deletes: ObservedGeneratedEvent[];
  unchanged: Array<{
    observed: ObservedGeneratedEvent;
    desired: GeneratedEventSpec;
  }>;
  /** Preserved because the parent's planning failed. Never deleted. */
  preserved: ObservedGeneratedEvent[];
  diagnostics: ReconciliationDiagnostics;
}
```

---

## 5. Settings Storage and Migration

### 5.1 Storage key

Use one User Properties key:

```text
dtp.settings
```

Store the entire JSON document rather than independent properties. This ensures an atomic read and simplifies migration.

### 5.2 Defaults

```javascript
function defaultSettings_() {
  return {
    schemaVersion: 1,
    enabled: true,
    windowDays: 60,
    defaultBufferMinutes: 7,
    eligibility: {
      includeOutOfOffice: true,
      titlePatternEnabled: false,
      titlePattern: '^OOO(?::|\\b)',
      caseSensitive: false,
    },
    origins: {
      default: { type: 'address', value: '' },
      home: { type: 'address', value: '' },
      office: { type: 'address', value: '' },
    },
    workingLocation: {
      enabled: true,
      fallbackToDefault: true,
    },
    generatedEvents: {
      titlePrefix: '[Drivetime Padding]',
    },
  };
}
```

### 5.3 Validation rules

Validation returns all errors rather than failing after the first error.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}
```

Validation covers the **complete** `UserSettings` schema, not a selected subset. Settings arrive from User Properties, which can hold anything a corrupted write or a faulty migration left behind, and every field is consumed later without further checking.

Type checks are not pedantry here. Two concrete failure modes:

- JSON round-tripping or a bad migration can leave the **string** `"false"` where a boolean belongs. It is truthy, so `titlePatternEnabled` or `workingLocation.enabled` would silently switch on behavior the user never asked for.
- A non-string `origins.default.value` reaches `routeInputHash()`, where `.trim()` throws — inside a trigger, where the user never sees it.

Rules:

| Field | Rule |
|---|---|
| `schemaVersion` | integer, one of the supported versions |
| `enabled` | boolean — strictly, not truthy |
| `windowDays` | integer, 7 through 180 |
| `defaultBufferMinutes` | integer, 0 through `MAX_BUFFER_MINUTES` |
| `eligibility.includeOutOfOffice` | boolean |
| `eligibility.titlePatternEnabled` | boolean |
| `eligibility.caseSensitive` | boolean |
| `eligibility.titlePattern` | string; must compile as a regex when `titlePatternEnabled` |
| `origins.{default,home,office}` | object with exactly `type` and `value` |
| `origins.*.type` | string, `address` or `placeId` |
| `origins.*.value` | string; may be empty for `home` and `office` |
| `origins.default.value` | non-empty string required for write-mode reconciliation |
| `workingLocation.enabled` | boolean |
| `workingLocation.fallbackToDefault` | boolean |
| `generatedEvents.titlePrefix` | non-empty string, recommended maximum 80 characters |

Every boolean is checked with `typeof value === 'boolean'`. Every string is checked with `typeof value === 'string'`. Coercion is not applied — a wrong type is a validation error, because coercing hides the corruption that produced it.

Unknown top-level keys are preserved but ignored, so a downgrade after a future migration does not destroy data.

A validation failure blocks write-mode reconciliation and surfaces in the UI. Dry-run diagnostics still run, so a user can see what is wrong.

### 5.4 Migration contract

```javascript
function migrateSettings_(settings) {
  let migrated = deepClone_(settings);
  while (migrated.schemaVersion < CURRENT_SETTINGS_SCHEMA) {
    migrated = SETTINGS_MIGRATIONS[migrated.schemaVersion](migrated);
  }
  return migrated;
}
```

Migrations must be deterministic, sequential, and covered by unit tests.

---

## 6. Directive Grammar

The parser is line-oriented. Leading and trailing whitespace is ignored.

### 6.1 EBNF

```ebnf
document        = { line } ;
line            = off-directive
                | buffer-directive
                | origin-directive
                | shorthand-buffer
                | other-line ;

off-directive   = prefix, ":", whitespace, "off" ;
buffer-directive= prefix, ":", whitespace, "buffer", "=", integer, ["m"] ;
origin-directive= prefix, ":", whitespace, "origin", "=", origin-name ;
shorthand-buffer= prefix, whitespace, "+", integer, "m" ;
prefix          = "drivetime padding" ;
origin-name     = "home" | "office" | "default" ;
integer         = digit, { digit } ;
whitespace      = { " " | "\t" } ;
```

Matching is case-insensitive.

### 6.2 Conflict resolution

If a description contains the same directive multiple times, the last valid occurrence wins.

`off` always disables the event regardless of other directives.

Buffer values must be constrained to 0 through 120. Out-of-range values are ignored with a warning.

### 6.3 Examples

```text
Patient intake notes

drivetime padding: buffer=15m
drivetime padding: origin=office
```

Result:

```json
{
  "disabled": false,
  "bufferMinutes": 15,
  "origin": "office",
  "warnings": []
}
```

---

## 7. Calendar Read Design

### 7.1 Primary calendar ID

Use the literal Calendar API calendar identifier:

```text
primary
```

This is preferable to resolving an email address and is supported by Calendar API operations.

### 7.2 Window bounds

There are **two** ranges, and conflating them causes duplicate creation at both ends of the window.

- The **planning range** decides which source events are evaluated.
- The **observation range** decides which generated events are read.

The observation range must be strictly wider, because a generated event can fall outside its own source's position in time: outbound blocks start before their source, and return blocks end after it.

```javascript
const MAX_TRAVEL_MINUTES = 360;              // 6 hours
const MAX_BUFFER_MINUTES = 120;              // matches settings validation
const MAX_SOURCE_DURATION_MINUTES = 1440;    // 24 hours; longer timed events are ineligible

// The furthest a companion event can sit from its source.
const COMPANION_SPAN_MINUTES =
  MAX_TRAVEL_MINUTES + MAX_BUFFER_MINUTES;   // 480 minutes / 8 hours

const RECONCILIATION_LOOKBACK_MINUTES = COMPANION_SPAN_MINUTES;

function calculateWindow(windowDays, now) {
  const planStart = now.getTime() - RECONCILIATION_LOOKBACK_MINUTES * 60000;
  const planEnd = now.getTime() + windowDays * 86400000;

  return {
    planStart: new Date(planStart),
    planEnd: new Date(planEnd),
    observeStart: new Date(planStart - COMPANION_SPAN_MINUTES * 60000),
    observeEnd: new Date(
      planEnd +
        (MAX_SOURCE_DURATION_MINUTES + COMPANION_SPAN_MINUTES) * 60000
    ),
  };
}
```

#### Why each bound is what it is

`Events.list` is asymmetric: `timeMin` bounds an event's **end** time, `timeMax` bounds its **start** time. Both edges of a naive window therefore leak, in mirror-image ways.

**Near edge.** An outbound block that has already finished is excluded by `timeMin`, while its source event — still running — is returned and still eligible. Reconciliation wants the outbound block, cannot see it, and creates a duplicate on every run.

**Far edge.** A source starting just before `planEnd` but ending after it is returned, because `timeMax` bounds start time. Its return block starts at `source.end`, past `planEnd`, and is excluded. Same failure, same unbounded duplication.

Neither case is caught by duplicate convergence (§13.5), because the duplicates are outside the range being read.

#### Completeness

A source is planned when `planStart <= source.start < planEnd`. For any such source, both companions lie inside the observation range:

```text
outbound.start >= source.start - COMPANION_SPAN
               >= planStart - COMPANION_SPAN
               =  observeStart                              ✓

return.end     <= source.end + COMPANION_SPAN
               <= source.start + MAX_SOURCE_DURATION + COMPANION_SPAN
               <  planEnd + MAX_SOURCE_DURATION + COMPANION_SPAN
               =  observeEnd                                ✓
```

The `MAX_SOURCE_DURATION_MINUTES` term is what makes the far-edge bound provable rather than approximate. It is also why timed source events longer than 24 hours are ineligible (`SOURCE_TOO_LONG`) — without that cap the observation range would be unbounded.

Source events that have already started are still planned: their return blocks are in the future and still required, and dropping them from desired state would orphan-delete those blocks mid-appointment.

#### 7.2.1 Event listing request

Use Advanced Calendar service `Calendar.Events.list` with:

```javascript
{
  timeMin: window.observeStart.toISOString(),
  timeMax: window.observeEnd.toISOString(),
  singleEvents: true,
  showDeleted: true,
  maxResults: 2500
}
```

One call covers both ranges. Read over the **observation** range, then apply the planning range when deciding which source events to evaluate — a source outside `[planStart, planEnd)` is reported `OUTSIDE_WINDOW`.

Pagination must be supported using `nextPageToken`.

`singleEvents: true` expands recurring series into instances and sorts by start time when `orderBy: 'startTime'` is supplied.

### 7.3 Why show deleted events

Cancelled recurring instances may appear with status `cancelled`. Including them improves cleanup diagnostics. The desired-state algorithm still removes generated events because cancelled source events are ineligible.

### 7.4 Generated event detection

A raw event is generated only when:

```javascript
event.extendedProperties?.private?.dtp === '1'
```

Do not identify generated events by title prefix.

### 7.5 Working-location events

Working-location events should be queried separately if required, because their visibility and event-type filtering may differ from ordinary events.

The repository should expose:

```javascript
listWorkingLocationEvents(calendarId, timeMin, timeMax)
```

The exact Calendar API fields returned must be validated with real accounts during implementation. Unsupported or unavailable working-location data must degrade to default origin rather than fail synchronization.

---

## 8. Normalization

### 8.1 Function contract

```javascript
function normalizeCalendarEvent(rawEvent) -> NormalizedEvent
```

### 8.2 Date handling

Timed events use `start.dateTime` and `end.dateTime`.

All-day events use `start.date` and `end.date` and set `isAllDay: true`.

The normalizer must not invent a timezone offset. It should retain Calendar-provided ISO strings.

### 8.3 Summary fallback

If summary is absent or blank, use:

```text
Untitled event
```

This is only for generated subject display and diagnostics.

### 8.4 Location normalization

Trim leading and trailing whitespace. Preserve internal formatting because address normalization belongs to the routing backend.

### 8.5 Private properties

Copy private properties into a new object. Do not retain a mutable reference to the raw Calendar response.

---

## 9. Eligibility Evaluation

### 9.1 Contract

```javascript
function evaluateEligibility(event, directives, settings, window)
  -> EligibilityResult
```

`window` supplies `planStart` and `planEnd`. The observation bounds are not an eligibility input.

### 9.2 Evaluation order

Order matters because diagnostics should return the most useful reason.

1. globally disabled;
2. outside planning window;
3. generated event;
4. cancelled event;
5. all-day event;
6. timed event longer than `MAX_SOURCE_DURATION_MINUTES`;
7. missing location;
8. disabled by directive;
9. real OOO event accepted;
10. optional title pattern accepted;
11. otherwise reject.

Step 2 uses the **planning** range, not the observation range (§7.2). Step 6 is what keeps the observation range bounded.

### 9.3 Title pattern

Compile the regex once per reconciliation, not once per event.

Flags:

- case-sensitive: no flag;
- case-insensitive: `i`.

A regex compile error is a settings validation error and blocks write-mode reconciliation.

---

## 10. Origin Resolution

### 10.1 Contract

```javascript
function resolveOrigin(event, directives, settings, workingLocations)
  -> ResolvedOrigin
```

### 10.2 Per-event override

A directive selects a named configured origin. If the selected optional origin is empty, fall back to default and emit a diagnostic warning.

### 10.3 Working-location overlap

An overlapping working-location event is one where:

```text
working.start < source.end
AND working.end > source.start
```

If multiple working-location events overlap, choose the one with the most specific or latest start after sorting. The exact tie-breaker should be documented after observing real API behavior.

### 10.4 Default fallback

Default origin is required for write mode. Dry-run diagnostics may continue and report `MISSING_DEFAULT_ORIGIN` without writing.

---

## 11. Routing Client Design

### 11.1 Public function

```javascript
function getRouteDuration(origin, destination, requestContext)
  -> RouteResult
```

`requestContext` may contain an opaque correlation ID but no calendar title or description.

### 11.2 Request timeout and retries

Apps Script `UrlFetchApp` does not expose fine-grained retry middleware. The client should perform at most one immediate retry for clearly transient broker errors such as 502, 503, or 504.

Do not retry:

- invalid origin;
- invalid destination;
- no route;
- authentication failure;
- rate limit unless a future `Retry-After` policy is implemented.

### 11.3 Response validation

Success is valid only when:

- HTTP status is 200;
- JSON parses;
- `durationSeconds` is a finite non-negative integer;
- `distanceMeters`, if present, is finite and non-negative.

Invalid broker responses become `BROKER_PROTOCOL_ERROR`.

### 11.4 Route direction

The provider requests two routes:

1. effective origin to event location;
2. event location to effective origin.

The MVP must not assume symmetry.

---

## 12. Drivetime Provider Design

### 12.1 Input context

```typescript
interface DrivetimeContext {
  event: NormalizedEvent;
  settings: UserSettings;
  directives: ParsedDirectives;
  origin: ResolvedOrigin;
  routingClient: {
    getRouteDuration(origin, destination, requestContext): RouteResult;
  };
}
```

### 12.2 Effective buffer

```text
if directive.bufferMinutes is not null:
    use directive value
else:
    use settings.defaultBufferMinutes
```

The buffer is applied independently to outbound and return blocks.

### 12.3 Route duration granularity

Raw broker durations are rounded **up** to a 5-minute granularity before any other use:

```javascript
const ROUTE_GRANULARITY_SECONDS = 300;

function quantizeDuration_(seconds) {
  return Math.ceil(seconds / ROUTE_GRANULARITY_SECONDS) * ROUTE_GRANULARITY_SECONDS;
}
```

The quantized value is what feeds event times **and** the fingerprint. This is what makes the daily cache refresh (§23.3) safe: traffic noise of a few seconds or minutes lands in the same bucket, produces an identical fingerprint, and causes no Calendar write.

Quantization is a pure function of the duration, so it requires no comparison against stored state and cannot drift. Rounding up rather than to nearest errs toward allowing more travel time.

The raw unrounded duration is still stored in the route cache, so that changing the granularity later does not require re-calling the broker.

### 12.4 Maximum supported travel

```javascript
if (quantizedSeconds > MAX_TRAVEL_MINUTES * 60) { /* ... */ }
```

A route exceeding `MAX_TRAVEL_MINUTES` (360) produces:

- planning outcome `failed` with error code `ROUTE_TOO_LONG`;
- **no** generated events for that source event;
- an explicit user-visible diagnostic on the event card;
- no deletion of existing generated events for that source (this is a planning failure, not an ineligibility — see §17.3).

The cap exists both to keep the product inside its intended use case and to make the reconciliation lookback (§7.2) provably sufficient. A route longer than the lookback would reintroduce the duplicate-creation bug the lookback exists to prevent.

### 12.5 Time calculations

Outbound:

```text
end = source.start
start = source.start - quantize(outboundRoute.duration) - buffer
```

Return:

```text
start = source.end
end = source.end + quantize(returnRoute.duration) + buffer
```

Use integer seconds internally to avoid drift. Because durations are quantized to 5 minutes and buffers are whole minutes, generated timestamps land on whole minutes whenever the source event does.

### 12.6 Generated type

If source `eventType === 'outOfOffice'`:

```text
generated eventType = outOfOffice
```

Otherwise:

```text
generated eventType = default
transparency = source transparency when supported
```

The exact Calendar API write contract for OOO events must be validated in a prototype before public release.

### 12.7 Summary construction

Outbound:

```text
<prefix> Travel to <source summary>
```

Return:

```text
<prefix> Return from <source summary>
```

Summary generation must be deterministic because it contributes to the fingerprint.

---

## 13. Metadata Schema

### 13.1 Schema version 1

```json
{
  "dtp": "1",
  "schema": "1",
  "parent": "source-instance-id",
  "ical": "source-ical-uid",
  "originalStart": "2026-07-24T14:00:00-05:00",
  "role": "outbound",
  "fingerprint": "hex-sha256",
  "routeHash": "hex-sha256",
  "routeSecs": "1440",
  "routeAt": "2026-07-30T14:00:00Z"
}
```

### 13.2 Required keys

Required:

- `dtp`;
- `schema`;
- `parent`;
- `role`;
- `fingerprint`.

Optional:

- `ical`;
- `originalStart`;
- `routeHash`, `routeSecs`, `routeAt` — the route plan cache (§13.3). Absent entries simply cause a broker call.

All values are strings; Calendar private extended properties are string-typed. `routeSecs` stores the **raw** unquantized duration.

### 13.3 Route plan cache

Each generated event caches the route for its own direction: the outbound event caches origin → destination, the return event caches destination → origin. The two are never assumed symmetrical.

The cache is derived state (ADR 0011). Deleting it is always safe.

#### Route input hash

```javascript
function routeInputHash_(origin, destination, travelMode) {
  return sha256Hex_(canonicalJson_({
    origin: { type: origin.type, value: origin.value.trim() },
    destination: destination.trim(),
    travelMode: travelMode,
  }));
}
```

The hash deliberately **excludes source start and end times**. MVP routing is not traffic-aware, so moving an appointment does not change its route, and rescheduling should not force a broker call. When traffic-aware routing is introduced, a departure-time bucket joins the hash inputs.

It also excludes the buffer: the buffer is applied after routing and is already a fingerprint input.

#### Reuse rule

```javascript
function cachedRouteIsUsable_(meta, expectedHash, now) {
  if (!meta.routeHash || meta.routeHash !== expectedHash) return false;
  if (!meta.routeAt || !meta.routeSecs) return false;
  const ageMs = now.getTime() - Date.parse(meta.routeAt);
  return ageMs >= 0 && ageMs < ROUTE_CACHE_MAX_AGE_HOURS * 3600000;
}
```

```javascript
const ROUTE_CACHE_MAX_AGE_HOURS = 24;
```

A usable entry supplies the duration with no broker call. Otherwise the broker is called and the entry rewritten. There is no near-departure refresh tier — see §23.3.

This bounds steady-state cost at two route calls per eligible event per day regardless of trigger frequency.

#### Invalidation and stampede control

Changing the default origin or any configured origin value changes the route input hash for many events at once, so the next reconciliation would re-route the entire window in one run.

Buffer changes do **not** appear in this list. The route input hash deliberately excludes the buffer, so changing `defaultBufferMinutes` invalidates no cache entries and costs no broker calls — only Calendar writes, since the buffer does affect event times and therefore the fingerprint.

Required behavior:

- settings writes that change any origin **mark the cache generation**, they do not eagerly clear it;
- reconciliation honors the per-run route-call ceiling `MAX_ROUTE_CALLS_PER_RUN` (recommended 60);
- when the ceiling is reached, remaining events are left unplanned for that run with status `partial`, and existing generated events for them are preserved (planning failure, not ineligibility);
- a run that ends `partial` schedules a continuation rather than waiting for the next daily run (§23.4).

### 13.4 Role values

MVP values:

```text
outbound
return
```

Unknown roles from future versions should be treated as managed generated events but may be preserved rather than modified if the current version cannot interpret them safely.

### 13.5 Matching key

```javascript
function generatedKey(parentEventId, role) {
  return `${parentEventId}|${role}`;
}
```

If duplicate observed events share the same key, retain one canonical event and mark the others for deletion. Canonical selection should prefer:

1. matching fingerprint;
2. otherwise most recently updated event;
3. otherwise lexicographically smallest event ID for deterministic behavior.

---

## 14. Fingerprint Specification

### 14.1 Canonical payload

```json
{
  "schema": 1,
  "parentEventId": "abc123",
  "role": "outbound",
  "sourceStart": "2026-07-24T14:00:00-05:00",
  "sourceEnd": "2026-07-24T15:00:00-05:00",
  "origin": {
    "type": "address",
    "value": "123 Main Street"
  },
  "destination": "456 Clinic Road",
  "routeDurationSeconds": 1500,
  "bufferSeconds": 420,
  "summary": "[Drivetime Padding] Travel to Doctor appointment",
  "eventType": "outOfOffice",
  "transparency": null
}
```

`routeDurationSeconds` is the **quantized** duration (§12.3), never the raw broker value. This is what allows the daily cache refresh to run without rewriting events: a duration that moves from 1420s to 1447s quantizes to 1500s both times, so the fingerprint is unchanged and no write occurs.

### 14.2 Canonicalization

- recursively sort object keys;
- preserve array order;
- trim strings used as addresses and summaries;
- serialize with JSON without insignificant whitespace;
- encode UTF-8;
- compute SHA-256;
- store lowercase hexadecimal.

### 14.3 Apps Script implementation

Use:

```javascript
Utilities.computeDigest(
  Utilities.DigestAlgorithm.SHA_256,
  canonicalJson,
  Utilities.Charset.UTF_8
)
```

Convert signed byte values to two-digit hexadecimal.

---

## 15. Desired vs Observed Comparison

### 15.1 Inputs

- desired specs indexed by generated key;
- observed generated events indexed by generated key.

### 15.2 Algorithm

For every desired key:

- no observed event: **create**;
- one observed event, fingerprint matches **and** owned fields match: **unchanged**;
- one observed event, fingerprint matches but owned fields differ: **update** (see §15.2.1);
- one observed event, cache metadata is stale but everything else matches: **metadata patch** (see §15.2.2);
- one observed event, fingerprint differs or is missing: **update**;
- multiple observed events: select canonical, apply the above, delete duplicates.

For every observed key absent from desired:

- **delete only if the parent's planning outcome is `planned` or `ineligible`**;
- if the parent's outcome is `failed`, or the parent was never evaluated, **preserve**.

#### 15.2.1 Fingerprint alone is not sufficient

A matching fingerprint means *the desired state has not changed*. It does not mean *the observed event still matches that desired state*. Those are different questions, and only the second one detects user tampering.

The fingerprint is written at create time and stored in the event's own metadata. When a user drags a generated event to a new time, resizes it, or renames it, Calendar preserves the private extended properties — so the stored fingerprint still equals the freshly computed desired fingerprint, while the event itself now sits at the wrong time.

Treating that as `unchanged` would silently break the restoration behavior promised by Architecture §17.4 and AC-RECOVERY-002.

Comparison must therefore verify the **owned fields** on the observed event against the desired specification:

```text
start
end
summary
eventType
transparency
```

These are exactly the fields §16.5 permits patching. Fields the add-on does not own are neither compared nor written.

The fingerprint remains valuable as the cheap first check — it answers "do I need to recompute anything?" — but the owned-field comparison is what makes reconciliation self-healing.

#### 15.2.2 Metadata-only patches

Route cache entries live in the same private extended properties. When a cache entry is refreshed but the quantized duration lands in the same bucket, the event's owned fields are unchanged and only `routeSecs` and `routeAt` need to be written.

This is a distinct diff category. It must not be folded into `unchanged`, because skipping the write would leave `routeAt` permanently stale and force a broker call on every subsequent run — defeating the cost bound the cache exists to provide. It must not be folded into `update` either, since it changes nothing the user can see.

See §16.6.

### 15.3 Safety rule

Delete only events carrying valid private property `dtp === '1'`.

Never delete based on title prefix.

### 15.4 Dry run

The comparator always creates a complete diff object. Application of that diff is a separate step. Dry-run mode simply skips application.

---

## 16. Calendar Write Mapping

### 16.1 Ordinary event body

Representative structure:

```json
{
  "summary": "[Drivetime Padding] Travel to Appointment",
  "start": {
    "dateTime": "2026-07-24T13:29:00-05:00"
  },
  "end": {
    "dateTime": "2026-07-24T14:00:00-05:00"
  },
  "transparency": "opaque",
  "extendedProperties": {
    "private": {
      "dtp": "1",
      "schema": "1",
      "parent": "abc123",
      "role": "outbound",
      "fingerprint": "..."
    }
  }
}
```

### 16.2 OOO body

Representative structure:

```json
{
  "summary": "[Drivetime Padding] Travel to Appointment",
  "eventType": "outOfOffice",
  "start": {
    "dateTime": "2026-07-24T13:29:00-05:00"
  },
  "end": {
    "dateTime": "2026-07-24T14:00:00-05:00"
  },
  "outOfOfficeProperties": {
    "autoDeclineMode": "declineNone"
  },
  "extendedProperties": {
    "private": {
      "dtp": "1",
      "schema": "1",
      "parent": "abc123",
      "role": "outbound",
      "fingerprint": "..."
    }
  }
}
```

The exact accepted `outOfOfficeProperties` values must be verified against current Calendar API behavior before finalizing code. Generated OOO blocks should avoid auto-declining unrelated meetings unless explicitly desired.

### 16.3 Reminder behavior

Generated events should explicitly disable reminders unless product testing indicates users expect them:

```json
{
  "reminders": {
    "useDefault": false,
    "overrides": []
  }
}
```

This prevents duplicate or noisy alerts for travel blocks.

### 16.4 Insert behavior

Use `sendUpdates: 'none'` where supported. Generated events have no attendees, but the flag makes intent explicit.

### 16.5 Patch behavior

Patch only fields owned by Drivetime Padding:

- summary;
- start;
- end;
- event type and relevant properties;
- transparency;
- reminders;
- private extended properties.

Do not overwrite unrelated fields if a later version adds them.

### 16.6 Metadata-only patch

Refreshing an expired route cache entry writes `routeSecs` and `routeAt` and nothing else:

```json
{
  "extendedProperties": {
    "private": {
      "routeSecs": "1455",
      "routeAt": "2026-07-31T14:00:00Z"
    }
  }
}
```

Start, end, summary, event type, and transparency are omitted from the patch body, so the event does not move and the user sees nothing.

This write is **required**, not optional. `routeAt` is what makes the cache entry valid; if it is not persisted, the entry stays expired and every subsequent run calls the broker again — which is precisely the unbounded cost the cache exists to prevent.

The resulting cost profile:

| Cache state | Broker calls | Calendar writes |
|---|---|---|
| Valid, nothing changed | 0 | 0 |
| Expired, duration in same bucket | 2 | 1 metadata patch per direction |
| Expired, duration in a new bucket | 2 | 1 full update per direction |
| Source event changed | 2 | 1 full update per direction |

One metadata patch per direction per day is a bounded and acceptable cost. Two broker calls per run is not, which is the trade being made.

---

## 17. Reconciliation Engine API

### 17.1 Entry function

```javascript
function runReconciliation(options)
```

Options:

```typescript
interface ReconciliationOptions {
  dryRun?: boolean;
  now?: Date;
  eventIdFilter?: string | null;
  reason?: "calendar-trigger" | "daily-trigger" | "manual" | "event-diagnostic";
}
```

`now` injection supports deterministic tests.

`eventIdFilter` may optimize current-event diagnostics, but full trigger reconciliation does not depend on it.

### 17.2 Return value

```typescript
interface ReconciliationResult {
  status: "success" | "partial" | "failed" | "disabled" | "skipped";
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  diagnostics: ReconciliationDiagnostics;
  diff: ReconciliationDiff;
  errors: AppErrorRecord[];
}
```

### 17.3 Routing failure policy

A route failure for one source event should not necessarily abort all other events.

Recommended behavior:

- record a per-event error;
- produce no desired specs for that source event in the current run;
- **do not delete existing generated events for that source solely because route calculation failed**.

This requires distinguishing:

- source event is ineligible: desired state is empty, delete existing generated events;
- source event is eligible but planning failed: desired state is unknown, preserve existing generated events and report error.

This distinction is critical to prevent transient broker failures from deleting valid travel blocks.

### 17.4 Planning outcome

Use:

```typescript
interface PlanningOutcome {
  state: "planned" | "ineligible" | "failed";
  specs: GeneratedEventSpec[];
  error?: AppErrorRecord;
}
```

The comparator receives deletion authority only for `planned` and `ineligible` events. Failed events are excluded from orphan deletion for that run.

`failed` covers every reason planning could not complete, including `ROUTE_TOO_LONG` and `ROUTE_BUDGET_EXCEEDED`. A source event skipped because the run hit its route ceiling must never have its existing travel blocks deleted as orphans.

---

## 18. Error Model

### 18.1 AppError

```typescript
interface AppErrorRecord {
  code: string;
  message: string;
  retryable: boolean;
  sourceEventId?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}
```

### 18.2 Stable codes

Settings:

```text
INVALID_SETTINGS
MISSING_DEFAULT_ORIGIN
INVALID_TITLE_PATTERN
```

Calendar:

```text
CALENDAR_READ_FAILED
CALENDAR_WRITE_FAILED
CALENDAR_EVENT_INVALID
```

Routing:

```text
INVALID_ORIGIN
INVALID_DESTINATION
NO_ROUTE
ROUTE_TOO_LONG
BROKER_AUTH_FAILED
BROKER_RATE_LIMITED
BROKER_UNAVAILABLE
BROKER_PROTOCOL_ERROR
```

Runtime:

```text
LOCK_CONTENTION
EXECUTION_BUDGET_EXCEEDED
ROUTE_BUDGET_EXCEEDED
UNEXPECTED_ERROR
```

`ROUTE_TOO_LONG` and `ROUTE_BUDGET_EXCEEDED` are both **planning failures**, not ineligibility. Per §17.3 they preserve existing generated events rather than deleting them.

### 18.3 User messages

Internal details should be logged with opaque identifiers. UI messages should be actionable and avoid exposing raw stack traces.

---

## 19. Trigger Design

> **Blocked on Prototype Spike 1.** Everything in this section assumes a Marketplace-installed Workspace Add-on can create installable Calendar triggers for the user. That has not been validated. Do not implement against this section until the spike reports. See `docs/open-questions.md`.

### 19.1 Calendar trigger handler

```javascript
function onPrimaryCalendarChanged() {
  return runReconciliation({ reason: 'calendar-trigger' });
}
```

### 19.2 Daily handler

```javascript
function runScheduledReconciliation() {
  return runReconciliation({ reason: 'daily-trigger' });
}
```

#### Scheduling time

`ScriptApp` time-based triggers resolve `atHour()` against the **script project** timezone, not the user's. A manifest `timeZone` of `America/Chicago` would fire every user's daily reconciliation at 3am Central regardless of where they live.

The manifest therefore declares `Etc/UTC`, and the daily hour is computed per user from their Calendar timezone at trigger-installation time:

```javascript
function dailyHourUtc_(userTimeZone, desiredLocalHour) {
  // Convert desiredLocalHour in userTimeZone into the equivalent UTC hour.
}
```

Two caveats, both requiring prototype confirmation:

- fixed-offset conversion drifts by an hour across daylight-saving transitions; the daily trigger should be re-evaluated during trigger repair rather than assumed stable;
- if `atHour` semantics do not behave as documented under add-on authorization, fall back to an every-6-hours schedule, which makes local clock time irrelevant at the cost of extra runs.

### 19.3 Trigger repair

`ensureTriggers()` must:

- identify all project triggers for known handlers;
- delete duplicates;
- create missing triggers;
- preserve unrelated project triggers;
- return a health report.

### 19.4 Uninstall considerations

Apps Script add-ons do not provide a universally reliable uninstall cleanup hook for all desired behavior. The product should include a manual action:

```text
Remove all generated events and disable automation
```

This action must require explicit confirmation.

---

## 20. Status and Diagnostics

### 20.1 Status key

```text
dtp.lastRun
```

### 20.2 Stored record

Store only compact operational data, not addresses or event titles.

```json
{
  "status": "success",
  "startedAt": "2026-07-30T14:00:00Z",
  "completedAt": "2026-07-30T14:00:04Z",
  "reason": "calendar-trigger",
  "sourceEventsChecked": 18,
  "eligibleEvents": 4,
  "plannedEvents": 8,
  "created": 2,
  "updated": 1,
  "deleted": 0,
  "errors": 0
}
```

### 20.3 Event diagnostic mode

The current-event card may invoke dry-run planning for one event. It should display:

- eligibility result;
- directive interpretation;
- selected origin name, but avoid displaying a sensitive full address unless the user is in settings;
- route durations;
- buffer;
- desired timestamps;
- whether current generated events match.

#### Diagnostic route-call budget

Opening the card on an event that has no generated events yet means there is no cache to read, so a naive implementation costs two broker calls per card open. Scrolling through a day of appointments would run up the bill with no reconciliation involved.

Required controls:

```javascript
const DIAGNOSTIC_ROUTE_CALLS_PER_HOUR = 20;
```

- diagnostics consult the route cache first, exactly as reconciliation does;
- diagnostic broker calls are counted per user per hour against the ceiling;
- on exceeding it, the card renders eligibility, directives, and resolved origin — everything that needs no route — and reports that timing is temporarily unavailable;
- diagnostic calls write to the same route cache, so a card open warms the next reconciliation rather than duplicating its work.

---

## 21. Routing Broker Technical Contract

### 21.1 HTTP API

```text
POST /v1/route-duration
Content-Type: application/json
Authorization: <selected mechanism>
X-Request-ID: opaque UUID
```

### 21.2 Request schema

```json
{
  "origin": {
    "type": "address",
    "value": "123 Main Street, Florence, CO"
  },
  "destination": {
    "type": "address",
    "value": "456 Clinic Road, Pueblo, CO"
  },
  "travelMode": "DRIVE"
}
```

### 21.3 Validation

- maximum request body size;
- supported origin/destination types;
- non-empty values;
- maximum string lengths;
- travel mode exactly `DRIVE` for MVP;
- reject unknown fields if strict schema validation is selected.

### 21.4 Google Routes mapping

The broker should request only required fields, using a field mask for duration and distance.

The broker normalizes Google duration formats into integer seconds.

### 21.5 Response headers

Recommended:

```text
Cache-Control: no-store
Content-Type: application/json
X-Request-ID: same opaque request ID
```

### 21.6 Logging

Log:

- request ID;
- authenticated principal or installation identifier;
- response code;
- latency;
- normalized error code;
- Maps billable request count.

Do not log raw addresses by default.

### 21.7 Authentication decision gate

Public Marketplace release is blocked until broker authentication is selected and tested.

Private prototype options may use a shared secret, but the secret must be treated as disposable and rate-limited.

---

## 22. Idempotency and Partial Failure Semantics

### 22.1 Idempotency invariant

For stable external inputs:

```text
reconcile(reconcile(calendar)) == reconcile(calendar)
```

The second run produces zero writes.

### 22.2 Partial writes

No rollback transaction is attempted across Calendar events.

The engine records successful and failed operations independently. A later run repairs remaining differences.

### 22.3 Transient planning failures

As specified earlier, transient route failures preserve existing generated events for affected parents. This prevents a backend outage from erasing travel blocks.

### 22.4 Manual deletion

Manual deletion produces a create operation on the next successful run.

### 22.5 Duplicate generated events

Duplicate generated events are converged to one canonical event.

---

## 23. Execution Budget and Degradation

### 23.1 Budget checks

Track elapsed runtime inside the reconciliation loop.

If nearing a conservative execution threshold:

- stop planning new source events;
- apply already-computed safe diffs if sufficient time remains;
- record partial status;
- allow daily or subsequent trigger execution to continue.

### 23.2 Ordering

Process **upcoming events first**: source events starting at or after `now` in ascending start order, then in-progress and lookback events.

Plain ascending start order is wrong now that the window extends backward — it would spend the execution budget on events that have already begun before reaching the appointments the user is about to travel to.

### 23.3 Route-call minimization

Route caching is **required for the MVP**. See §13.3 for the cache contract and §21 of the architecture for the rationale.

The essential point is one of ordering: fingerprints are computed *after* routing, so they can only prevent Calendar writes, never broker calls. Cost is driven by trigger frequency, and the calendar trigger fires on calendar changes rather than on a schedule, so without a cache the spend is unbounded by anything the user can observe.

Per-run controls:

```javascript
const MAX_ROUTE_CALLS_PER_RUN = 60;
```

- consult the route cache before every broker call;
- count broker calls against the per-run ceiling;
- on reaching the ceiling, stop planning further events, return status `partial`, and preserve existing generated events for unplanned sources;
- record the number of cache hits, cache misses, and skipped events in the run status.

Cost model in steady state, with the cache working:

```text
2 route calls per eligible event per day
```

not

```text
2 route calls per eligible event per trigger firing
```

### 23.4 Continuation after a partial run

A run that stops at `MAX_ROUTE_CALLS_PER_RUN` leaves real work undone. Relying on the next daily trigger to pick it up does not hold: with 60 calls per run, an origin change across 100 eligible events needs four passes, which is four days — and calendar triggers cannot be counted on to fill the gap, since they are best-effort and may be coalesced or missed entirely.

A run ending with status `partial` must therefore schedule its own continuation:

- create a one-off time-based trigger a few minutes out;
- the continuation is an ordinary reconciliation, not a resumed cursor — reconciliation is idempotent, and the events completed in the previous pass now have valid cache entries, so they cost nothing;
- do not stack continuations: if one is already pending, do not create another;
- cap consecutive continuations (recommended 10) so a persistent failure cannot loop indefinitely, and report the cap in run status.

This makes convergence a function of total work rather than of the daily cycle, which is what REQ-TRIGGER-002 promises.

Continuations depend on one-off trigger creation and are therefore **subject to Prototype Spike 1**. If that mechanism is unavailable, the eventual-consistency guarantee in REQ-TRIGGER-002 must be narrowed to "one daily cycle per `MAX_ROUTE_CALLS_PER_RUN` units of deferred work" and the ceiling raised as far as quota measurement allows.

---

## 24. Test Architecture

### 24.1 Pure tests

Under Node.js, test pure modules with Apps Script globals replaced by adapters.

Priority suites:

- settings migration and validation;
- directive parsing;
- normalization;
- eligibility;
- origin resolution;
- fingerprint canonicalization;
- comparison;
- provider time calculations.

### 24.2 Fake repository

Define an in-memory repository implementing the same methods as `CalendarRepository`.

This permits end-to-end reconciliation tests without Google Calendar.

### 24.3 Fake routing client

Provide deterministic route results keyed by origin/destination.

Support injected failures for transient and permanent error tests.

### 24.4 Golden fixtures

Store raw Calendar event JSON and expected normalized objects for recurring scenarios.

### 24.5 Contract tests

The Cloud Run broker should have independent tests validating:

- request schema;
- authentication;
- field mask;
- upstream normalization;
- error mapping;
- privacy-safe logs.

---

## 25. MVP Definition of Done

The technical MVP is complete when:

1. a user can configure a default origin and buffer;
2. automation triggers can be installed and repaired;
3. real timed OOO events with locations produce outbound and return OOO blocks;
4. ordinary events may optionally qualify by title pattern;
5. all-day and locationless events remain untouched;
6. source edits update generated events;
7. source deletion or ineligibility removes generated events;
8. recurring instances, moved exceptions, and cancelled instances reconcile correctly;
9. per-event off, buffer, and origin directives work;
10. generated events are identified by private metadata;
11. fingerprints prevent no-op writes;
12. transient route failures do not delete existing blocks;
13. dry-run diagnostics explain planned actions;
14. the routing credential is not embedded in Apps Script for public release;
15. a user can remove all generated events through an explicit cleanup action;
16. an unchanged reconciliation makes zero broker calls while cached routes remain valid;
17. a source event already in progress does not produce duplicate outbound events;
18. a route exceeding `MAX_TRAVEL_MINUTES` yields a diagnostic and no malformed event;
19. the daily trigger fires at the user's local maintenance hour, not the script project's.

---

## 26. Technical Decisions Requiring Prototype Validation

The following details must be validated with working prototypes before the design is marked final:

1. **installable trigger feasibility for Marketplace-installed add-ons** — Prototype Spike 1, blocking §19 and architecture §15/§16;
2. **OAuth scope classification and minimum viable scope set** — Prototype Spike 2, blocking the manifest and Marketplace planning;
3. exact Calendar API fields required to create OOO events without unwanted auto-decline behavior;
4. working-location event availability and response shapes across consumer and Workspace accounts, including office-type and custom-office matching;
5. practical Apps Script runtime and Calendar quota behavior for a 60-day forward window plus the 8-hour lookback;
6. public-safe authentication from Apps Script to Cloud Run;
7. whether explicit reminder suppression behaves consistently for OOO events;
8. whether `showDeleted` plus `singleEvents` returns enough information for cancelled recurring cleanup across all tested cases;
9. whether `ScriptApp` time-based trigger hour semantics support the per-user UTC conversion in §19.2.

Item 5 of the previous revision — seconds versus whole-minute timestamps — is resolved by §12.3: 5-minute duration quantization plus whole-minute buffers means generated timestamps inherit the source event's precision.

Prototype findings should be recorded as ADR updates or technical-design revisions. The full list with owners and blocking relationships is tracked in `docs/open-questions.md`.
