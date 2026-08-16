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
- **any name that appears in the interface reference (`interfaces.md`) or the architecture pseudocode is written without the suffix, everywhere** — in this document's snippets and in the source skeletons alike. Apps Script's syntax check does not catch unresolved globals, so a pseudocode call and a stub definition that differ only by a trailing underscore fail at first runtime rather than at review. The `_` suffix is reserved for genuinely file-private helpers no other document references (e.g. `manualRunPending_`, `deepClone_`);
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
  };
  generatedEvents: {
    titlePrefix: string;
  };
}
```

There is deliberately no `workingLocation.fallbackToDefault` toggle. Falling back to the default origin when a working-location origin is missing or unsupported is fixed behavior (§10.4), not a preference — an earlier draft carried the flag with no behavioral consumer anywhere in the design, and a validated setting nothing reads is a lie in the schema: the user flips it and nothing changes.

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
  /** Raw Calendar summary, possibly empty. Eligibility matches on this. */
  summary: string;
  /** summary, or "Untitled event" when blank. Display only. See 8.3. */
  displaySummary: string;
  description: string;
  location: string;
  /** Null for cancelled tombstones, which may omit both. See 8.2. */
  start: string | null;
  end: string | null;
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
OUT_OF_OFFICE_DISABLED
TITLE_PATTERN_DISABLED
TITLE_PATTERN_NO_MATCH
INVALID_TITLE_PATTERN
OUTSIDE_WINDOW
EVENT_NOT_FOUND
PARENT_NOT_FOUND
UNSUPPORTED_CALENDAR
```

`EVENT_NOT_FOUND` and `PARENT_NOT_FOUND` are synthesized only by diagnostic runs when the targeted read resolves nothing (§17.1); the eligibility evaluator itself never produces them — an event it is handed necessarily exists. `DISABLED_GLOBALLY` has **two producers**: §9.2's evaluator lists the global-disable check as its step 1 — the reason's ordinary home, kept as defense in depth — and the engine's **disabled gate** synthesizes it via `buildUnresolvedEventDiagnostics` on a scoped run, because the gate precedes the targeted read (the evaluator never runs there) and the card still owes the opened event an answer (§17.1, REQ-UI-012). The two produce the same reason for the same state; neither contradicts the other. `UNSUPPORTED_CALENDAR` is synthesized only by the **card flow** via `buildUnresolvedEventDiagnostics`, before the engine is ever invoked, when the event was opened from a calendar whose id differs from the resolved primary-calendar id (§20.3 — never a comparison against the literal `"primary"` alias, which trigger payloads do not contain). The engine's contract stays primary-only.

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
  durationSeconds: number;      // raw broker seconds, unquantized
  distanceMeters: number | null;
  /**
   * Where the duration came from. Anything other than "durable" means the
   * durable entry on the companion is stale or missing and must be
   * (re)written — an ephemeral hit avoids the broker call, not the
   * metadata patch. See 11.1, 20.3.
   */
  source: "durable" | "ephemeral" | "broker";
  /**
   * When the broker produced this duration — never when it was read from a
   * cache. This is what is written to routeAt, so a duration ages from its
   * true origin no matter how many caches it passed through. See 20.3.
   */
  calculatedAt: string;
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
  /** Always suppressed for the MVP. Owned, compared, and restored. */
  reminders: RemindersSetting;
  /** Non-null exactly when eventType is "outOfOffice"; the constant 16.2
      body for the MVP. Owned, compared, and restored (15.2.1). */
  outOfOfficeProperties: OutOfOfficeProperties | null;
  privateProperties: Record<string, string>;
  fingerprint: string;
}

interface RemindersSetting {
  useDefault: boolean;
  overrides: Array<{ method: string; minutes: number }>;
}

interface OutOfOfficeProperties {
  autoDeclineMode: string;
}
```

`reminders` is constant across every generated event (`{ useDefault: false, overrides: [] }`), so it is not a fingerprint input — it cannot vary with planning inputs. It is still owned state, because the *user* can change it. That distinction is why the fingerprint alone cannot decide whether a write is needed (§15.2.1).

`outOfOfficeProperties` follows the same rule. It is fully determined by `eventType` — the constant §16.2 body (`{ autoDeclineMode: "declineNone" }`) when the generated event is OOO, `null` otherwise — so it adds nothing to the fingerprint beyond what `eventType` already contributes. But the user can flip auto-decline on a generated block, and a block that silently starts declining meetings breaks the §16.2 promise, so it is owned state and must be compared and restored.

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
    /** Owned because 16.3 suppresses them; users can re-enable. */
    reminders: RemindersSetting;
    /** Owned alongside eventType; null on ordinary events (16.2). */
    outOfOfficeProperties: OutOfOfficeProperties | null;
  };
  routeCache: {
    routeHash: string | null;
    routeSecs: number | null;
    routeAt: string | null;
  };
  /** Persisted 14.1 source anchor from metadata (13.2); null when missing
      or unparseable, which excludes the event from the 15.2.8 sweep. */
  anchor: string | null;
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
  /** Delete + recreate. eventType is immutable after creation. See 15.2.5. */
  replaces: Array<{
    observed: ObservedGeneratedEvent;
    desired: GeneratedEventSpec;
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

### 4.11 ReconciliationDiagnostics

```typescript
interface ReconciliationDiagnostics {
  /** From the window read (7.2.1); gates absence-based operations. */
  scanComplete: boolean;
  /** Absence-based operations withheld on an incomplete scan (15.2.4). */
  suppressedCreates: number;
  suppressedDeletes: number;
  /** Route economics for the run (13.3, 23.3). */
  cacheHits: number;
  cacheMisses: number;
  routeAttemptsUsed: number;
  /** Assigned on every non-dry partial run: true when the continuation
      CAP declined scheduling, false when a pass was scheduled or already
      pending (19.6). Absent on other runs -- and on the partial run whose
      enqueue THREW, which is reported as a CONTINUATION_ENQUEUE_FAILED
      warning instead: the cap is a policy decision, the throw an
      infrastructure failure, and the UI renders them differently. */
  continuationCapReached?: boolean;
  /** Daily runs only: whether the 15.2.8 sweep ran to completion. False
      distinguishes "gave up under the budget" from "found nothing". */
  sweepComplete?: boolean;
  /** Non-fatal degradations, e.g. WORKING_LOCATION_UNAVAILABLE (18.2). */
  warnings: Array<{ code: string; message: string }>;
}
```

`warnings` is the sanctioned home for problems that degrade a run without failing it — an optional read that threw, a fallback that fired. `recordRunWarning(code, error)` appends here; warning codes live in the §18.2 registry like every other stable code, because an ad-hoc string is unfindable by the diagnostics UI and untestable by fixtures.

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
  /** Types, ranges, regex compile. Gates EVERY run, including dry runs. */
  structurallyValid: boolean;
  /** structurallyValid AND a non-blank default origin. Gates writes only. */
  writeReady: boolean;
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}
```

The two tiers exist because their consumers differ. Structurally invalid settings — a string where a boolean belongs, a regex that will not compile — cannot be planned against at all, so every run stops and returns the errors. A **missing default origin** is different: the settings are perfectly interpretable, only writes are unsafe, and §10.4 explicitly promises that dry-run diagnostics continue and report `MISSING_DEFAULT_ORIGIN` per event. Folding it into a single `valid` flag would block exactly the diagnostic that tells a new user what to configure.

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
| `origins.*.value` | string; may be empty for `home` and `office` — **whitespace-only values are normalized to empty**, so the fallback-to-default path fires instead of a blank endpoint reaching the broker |
| `origins.default.value` | non-blank after `trim()` required for write-mode reconciliation (`writeReady`) — route hashing trims the value, so a whitespace-only "configured" default would pass a bare non-empty check and then hash and route an empty endpoint |
| `workingLocation.enabled` | boolean |
| `generatedEvents.titlePrefix` | non-empty string, recommended maximum 80 characters |

Every boolean is checked with `typeof value === 'boolean'`. Every string is checked with `typeof value === 'string'`. Coercion is not applied — a wrong type is a validation error, because coercing hides the corruption that produced it.

Unknown top-level keys are preserved but ignored, so a downgrade after a future migration does not destroy data.

A validation failure blocks write-mode reconciliation and surfaces in the UI. A dry-run diagnostic against invalid settings returns a `failed` result **carrying the full validation error list** (§17.2), and the diagnostic card renders those errors — the user sees exactly what is wrong, even though planning cannot proceed on unvalidated settings.

### 5.4 Migration contract

```javascript
function migrateSettings_(settings) {
  // Validate BEFORE indexing SETTINGS_MIGRATIONS: persisted properties
  // can hold anything a corrupted write left behind (schemaVersion -1,
  // null, "2"), and indexing the table with such a value invokes
  // undefined -- loadSettings would throw instead of returning the
  // structural validation errors 5.3 promises for exactly this state.
  const version = settings ? settings.schemaVersion : null;
  if (!Number.isInteger(version) ||
      version < 1 || version > CURRENT_SETTINGS_SCHEMA) {
    return { unsupportedSchema: true, version: version };
  }
  let migrated = deepClone_(settings);
  let from = version;
  try {
    while (migrated.schemaVersion < CURRENT_SETTINGS_SCHEMA) {
      from = migrated.schemaVersion;
      migrated = SETTINGS_MIGRATIONS[from](migrated);
      // Each step must advance EXACTLY one version. Returning the input
      // version (or a non-integer) would loop here until the execution
      // ceiling hard-kills the trigger; skipping ahead would silently
      // bypass a chain step the completeness check above verified
      // exists, leaving fields untransformed for the deep-merge to
      // paper over with defaults.
      if (migrated.schemaVersion !== from + 1) {
        return { unsupportedSchema: true, version: from };
      }
    }
  } catch (err) {
    // Migrations run BEFORE validation -- 5.3 validates the migrated
    // result -- so they receive unvalidated input. A migration written
    // against the complete old schema can throw on a structurally
    // partial document at a valid old version (a truncated write, a
    // hand-edited store); a MISSING chain entry (a deploy that forgot a
    // migration) lands here too, since calling the undefined table slot
    // throws. Both are 5.3's to report as INVALID_SETTINGS, not a
    // TypeError inside a trigger. `from` is the step that failed, not
    // the stored version -- the card names the version the chain could
    // not get past.
    return { unsupportedSchema: true, version: from };
  }
  return migrated;
}
```

`migrateSettings_` is never called for an **absent** document. `loadSettings` reads the stored document first; when User Properties holds no `dtp.settings` at all, the §5.2 defaults apply directly — a fresh install loads defaults, it is not a validation failure and no `INVALID_SETTINGS` results. The `settings ? … : null` branch above is defense against an explicitly stored `null` or non-object document (corruption), not the fresh-install path.

**Deserialization is guarded the same way the migration chain is.** The stored value is arbitrary text — a truncated write leaves `dtp.settings` holding malformed JSON, and `JSON.parse` then throws *before* migration or structural validation ever runs, turning exactly the corrupted-state case this section promises to handle into an unexpected run failure with no reset path. `loadSettings` catches the parse failure and returns a structurally invalid `ValidationResult` (`INVALID_SETTINGS`, field `settings`, "stored document is not valid JSON"), so the settings card presents the same reset-to-defaults offer as every other unrecoverable-document state — never a throw.

An `unsupportedSchema` result flows into `loadSettings`' returned `validation` as a structural error (`INVALID_SETTINGS`, field `schemaVersion`) — never a throw. The diagnostic card then shows the corrupt version value, and the settings card offers the reset-to-defaults path (REQ-CONFIG-018).

The three guards close different holes, and all are needed. The version guard handles values that cannot start the chain at all (`-1`, `null`, `"2"`). The in-loop step assertion handles a buggy migration that does not advance exactly one version: returning the input version never throws, so the catch cannot see it — it loops until the execution ceiling hard-kills the trigger — while skipping ahead would exit the loop looking migrated with a chain step silently bypassed and its transformations missing. The catch handles everything that *does* throw: a valid old version on a structurally partial document (the migration dereferences fields the document never had) and a missing intermediate chain entry (calling the undefined table slot throws — a deploy bug, not data corruption, but equally unable to reach the current schema). All three funnel to the same structural `INVALID_SETTINGS`, because all three are the same user-facing fact: the persisted state cannot be brought to the current schema — and the reported version names the step the chain could not get past, so a bug report locates the failure precisely.

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

// How far the observation range extends beyond the planning range at each end.
const OBSERVE_MARGIN_MINUTES =
  MAX_SOURCE_DURATION_MINUTES + COMPANION_SPAN_MINUTES;  // 1920 minutes / 32 hours

function calculateWindow(windowDays, now) {
  const planStart = now.getTime() - RECONCILIATION_LOOKBACK_MINUTES * 60000;
  const planEnd = now.getTime() + windowDays * 86400000;
  const margin = OBSERVE_MARGIN_MINUTES * 60000;

  return {
    planStart: new Date(planStart),
    planEnd: new Date(planEnd),
    observeStart: new Date(planStart - margin),
    observeEnd: new Date(planEnd + margin),
  };
}
```

#### Planning eligibility is temporal intersection

A source event is planned when it **overlaps** the planning range:

```text
source.end > planStart  AND  source.start < planEnd
```

Not when its start falls inside the range. The difference matters for long-running events: at noon, a source running 01:00–18:00 started nine hours ago, outside an eight-hour lookback, but its return block at 18:00 is still in the future and still required. A start-time test would mark it `OUTSIDE_WINDOW`, and since ineligibility carries deletion authority (§15.2), its return block would be deleted while the appointment is still running.

Intersection is also what REQ-ELIG-007 has always specified.

#### Why each bound is what it is

`Events.list` is asymmetric: `timeMin` bounds an event's **end** time, `timeMax` bounds its **start** time. Both edges of a naive window therefore leak, in mirror-image ways.

**Near edge.** An outbound block that has already finished is excluded by `timeMin`, while its source event — still running — is returned and still eligible. Reconciliation wants the outbound block, cannot see it, and creates a duplicate on every run.

**Far edge.** A source starting just before `planEnd` but ending after it is returned, because `timeMax` bounds start time. Its return block starts at `source.end`, past `planEnd`, and is excluded. Same failure, same unbounded duplication.

Neither case is caught by duplicate convergence (§13.5), because the duplicates are outside the range being read.

#### Completeness

For any source overlapping the planning range, with duration bounded by `MAX_SOURCE_DURATION`, both companions lie inside the observation range:

```text
source.start   >  source.end - MAX_SOURCE_DURATION
               >  planStart - MAX_SOURCE_DURATION

outbound.start >= source.start - COMPANION_SPAN
               >  planStart - MAX_SOURCE_DURATION - COMPANION_SPAN
               =  planStart - OBSERVE_MARGIN
               =  observeStart                              ✓

source.end     <  source.start + MAX_SOURCE_DURATION
               <  planEnd + MAX_SOURCE_DURATION

return.end     <= source.end + COMPANION_SPAN
               <  planEnd + MAX_SOURCE_DURATION + COMPANION_SPAN
               =  planEnd + OBSERVE_MARGIN
               =  observeEnd                                ✓
```

The margin is symmetric because the failure is symmetric: a long source can reach backward past `planStart` just as it can reach forward past `planEnd`.

`MAX_SOURCE_DURATION_MINUTES` is what makes both bounds provable rather than approximate. It is also why timed source events longer than 24 hours are ineligible (`SOURCE_TOO_LONG`) — without that cap the observation range would be unbounded in both directions.

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

One call covers both ranges. Read over the **observation** range, then apply the planning range when deciding which source events to evaluate — a source that does not overlap `[planStart, planEnd)` is reported `OUTSIDE_WINDOW`.

The scan is driven to completion **when time permits**, and its completeness is reported rather than assumed: `listWindowEvents(calendarId, observeStart, observeEnd, shouldStop)` checks the guard between pages and, when the execution deadline nears, returns the safely retrieved prefix with `scanComplete: false` instead of consuming every `nextPageToken` unconditionally. A busy 180-day calendar (or a slow Calendar API) can span enough pages that a paginate-to-completion contract would spend the whole runtime inside one repository call, hard-killing the execution before any of the engine's own budget checks — no partial result, no continuation. A truncated read is already a first-class state everywhere downstream: absence-based operations are suppressed (§15.2.4), the sweep is skipped (§15.2.8), and the high-water mark stays put (§7.6), so returning early degrades the run to `partial` rather than to nothing.

Whether every page was retrieved determines if an unmatched companion can safely be treated as an orphan (§15.2.3), so the repository reports scan completeness alongside the events.

Pagination must be supported using `nextPageToken`.

`singleEvents: true` expands recurring series into instances and sorts by start time when `orderBy: 'startTime'` is supplied.

### 7.3 Why show deleted events

Cancelled recurring instances may appear with status `cancelled`. Including them improves cleanup diagnostics. The desired-state algorithm still removes generated events because cancelled source events are ineligible.

`showDeleted` applies to **generated** events too, and there the tombstones must be treated oppositely: a manually deleted companion comes back with its `dtp` metadata intact and status `cancelled`. Normalizing it into `observedGenerated` would present a deleted event as an existing companion — the comparator would classify the desired key as present, suppress the recreate the deletion calls for (breaking §17.4's restoration promise), or try to update a deleted resource; and since tombstones may omit `start`/`end`, `normalizeObservedGeneratedEvent` could not even build `observedFields`. Cancelled generated resources are therefore **excluded before normalization** — deleted means absent, and absence is what makes reconciliation recreate. Source tombstones continue through eligibility unchanged (§9.2 step 3).

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

### 7.6 Stranded companions after a window shrink

The observation range is derived from the *current* `windowDays`, so reducing that setting contracts `observeEnd` immediately — and companions already generated between the old and new horizons fall outside the read entirely. They are never listed, never classified `OUTSIDE_WINDOW`, and never deleted.

Reducing the window from 180 days to 7 leaves a travel block 90 days out sitting on the calendar for roughly another 82 days, until the rolling window creeps back out to reach it. To the user the setting simply does not work.

Widening the general read is the wrong fix — it would cost a large listing on every run to handle a rare event. Instead, reconciliation keeps a high-water mark and runs a targeted, ownership-filtered pass when the horizon has retreated:

```javascript
const OBSERVE_HIGH_WATER_KEY = 'dtp.observeHighWater';

function findStrandedCompanions(window, settings, dryRun, shouldStop) {
  const highWater = loadHighWater();            // ISO string or null
  if (!highWater || Date.parse(highWater) <= window.observeEnd.getTime()) {
    // ADVANCING the mark is a persistence too, and dry runs persist
    // nothing: a preview that raised the mark would change whether a
    // later reduced-window run classifies as a shrink and performs
    // cleanup -- a dry run altering real behavior.
    if (!dryRun) {
      saveHighWater(window.observeEnd);
    }
    return { shrunk: false, events: [], scanComplete: true };
  }

  // Owned events only: privateExtendedProperty filters server-side, so this
  // returns companions rather than the user's entire calendar.
  //
  // The start filter is a correctness condition, not tidiness. Events.list
  // bounds timeMin on event END, so a companion spanning the new horizon --
  // a user resize can produce one -- is returned by this scan AND by the
  // ordinary observation read. The comparator may queue an update to repair
  // it while this pass queues its deletion, and with the delete-first write
  // order (Architecture 14.5) the event would be removed instead of
  // repaired. Stranded means wholly beyond the horizon: start at or after
  // observeEnd. Anything spanning the boundary is visible to the ordinary
  // read, which alone decides its fate.
  // Paginated until done or the deadline guard fires, and completeness is
  // reported. This scan has the same truncation hazard as the main window
  // read (delete one page, satisfy deletedAll, lower the mark -- and
  // every later page is permanently outside all future scans) AND the
  // same runtime hazard: a large horizon reduction can leave enough
  // events in the vacated range that paginating to completion spends the
  // remaining execution budget inside this one call, hard-killing the
  // run before status or continuation. Early return with scanComplete
  // false is already safe -- the mark is retained and the next run
  // retries.
  const scan = listGeneratedEventsBetween(
    'primary',
    window.observeEnd,
    new Date(Date.parse(highWater)),
    shouldStop
  );
  const stranded = scan.events.filter(function (event) {
    return Date.parse(event.observedFields.start) >= window.observeEnd.getTime();
  });

  // Deliberately does NOT lower the mark here. The stranded events have
  // only been found, not deleted; the engine lowers the mark after
  // applyDiff confirms every one of them was removed -- and only when the
  // scan that found them was complete.
  return { shrunk: true, events: stranded, scanComplete: scan.scanComplete };
}
```

The return shape is the point. This function is a *finder*; the deletions happen later, inside `applyDiff`, and only their success justifies lowering the mark. Merging the events into the delete list and discarding the `shrunk` flag would leave no execution path that ever lowers the mark, so every subsequent run would repeat the full filtered scan of the vacated range — correct results, quietly unbounded cost. The engine therefore keeps the cleanup state alongside the diff:

```javascript
const cleanup = findStrandedCompanions(
  window, settings, options.dryRun,
  () => elapsedExceedsExecutionBudget(runStart));
diff.deletes.push(...cleanup.events);

if (!options.dryRun) {
  const applied = applyDiff(diff, runStart);
  if (cleanup.shrunk && cleanup.scanComplete && applied.deletedAll(cleanup.events)) {
    saveHighWater(window.observeEnd);
  }
}
```

Rules:

- the high-water mark records the furthest `observeEnd` ever used, and is persisted alongside settings;
- a run whose `observeEnd` is at or beyond the mark simply advances it and does no extra work — the common case costs one property read;
- a run whose `observeEnd` is short of the mark performs the filtered scan and reports the stranded events; the **engine** lowers the mark to the current `observeEnd` only after `applyDiff` confirms every stranded delete succeeded **and the scan itself was complete** — a truncated scan can delete its one retrieved page, satisfy `deletedAll`, and strand every later page outside all future scans — and never on a dry run;
- the scan uses `privateExtendedProperty=dtp=1`, so it lists managed events rather than the whole calendar, and §15.3's safety rule still applies to every deletion;
- only events **starting** at or after the new `observeEnd` count as stranded — an event spanning the boundary appears in the ordinary observation read too, and queuing it here as well would race a cleanup delete against the comparator's repair.

Lowering the mark only on success matters: a failed or partial cleanup leaves the mark high, so the next run tries again. That keeps the behavior self-healing in the same way as the rest of reconciliation, rather than depending on a single run to get it right.

The same mechanism covers a window shrink that happens while automation is disabled, since the mark is compared on the next run regardless of what caused the gap.

---

## 8. Normalization

### 8.1 Function contract

```javascript
function normalizeCalendarEvent(rawEvent) -> NormalizedEvent
```

### 8.2 Date handling

Timed events use `start.dateTime` and `end.dateTime`.

All-day events use `start.date` and `end.date` and set `isAllDay: true`.

**Cancelled tombstones may have neither.** When `showDeleted: true` returns a cancelled instance, Calendar may supply only `id`, `status`, `recurringEventId`, and `originalStartTime`. `NormalizedEvent.start` and `.end` are therefore nullable, and normalization must not throw on their absence. Eligibility recognizes cancellation before it reads any timestamp (§9.2).

The normalizer must not invent a timezone offset. It should retain Calendar-provided ISO strings.

### 8.3 Summary and display fallback

`NormalizedEvent` carries **two** summary fields:

| Field | Value | Used by |
|---|---|---|
| `summary` | the raw Calendar summary, possibly empty | title-pattern eligibility, and nothing else |
| `displaySummary` | `summary`, or `Untitled event` when blank | generated event subjects, diagnostics |

The split is not cosmetic. Substituting the fallback into `summary` would make a blank-titled event match any configured pattern that happens to match `Untitled event` — including a broad pattern like `.*` — and generate travel blocks for an event whose title never contained that text. The earlier wording said the fallback was "only for display," but with a single field there was no way for an implementation to honor that, since eligibility consumes the same normalized object.

Eligibility matches against `summary` exactly as Calendar returned it. A blank summary simply does not match a pattern unless the pattern matches the empty string.

The fingerprint uses the generated subject, which derives from `displaySummary`, so a blank-titled eligible event still produces a stable fingerprint.

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
2. generated event;
3. **cancelled event**;
4. outside planning window;
5. all-day event;
6. timed event longer than `MAX_SOURCE_DURATION_MINUTES`;
7. **unsupported event type** — only `default` and `outOfOffice` proceed;
8. missing location;
9. disabled by directive;
10. real OOO event accepted **when `eligibility.includeOutOfOffice` is true**;
11. optional title pattern accepted;
12. otherwise reject.

Step 7 is what makes `UNSUPPORTED_EVENT_TYPE` reachable, and what keeps the title pattern inside its charter. Calendar has special event types beyond OOO — `focusTime`, `workingLocation`, `birthday`, `fromGmail` — and a timed `fromGmail` event can carry a location and a pattern-matching title. REQ-ELIG-002 limits pattern inclusion to **ordinary** events; without this gate the pattern would accept the special type and §12.6 would silently manufacture a default-typed companion for it. Anything that is neither `default` nor `outOfOffice` reports `UNSUPPORTED_EVENT_TYPE` before pattern matching is ever consulted.

Step 10 must consult the setting. It is a user-facing toggle in the persisted schema, so accepting every OOO event regardless would mean a user who switches it off sees no change and their companions keep being maintained. A real OOO event rejected because the toggle is off reports `OUT_OF_OFFICE_DISABLED`, which is distinct from `TITLE_PATTERN_NO_MATCH` so the diagnostic card can say which control is responsible.

A real OOO event may still qualify at step 11 through the title pattern; the toggle governs only automatic OOO inclusion, not the event type.

Steps 1–3 must not read timestamps. Everything from step 4 onward may.

That ordering is a correctness constraint, not a preference. With `showDeleted: true` the listing includes cancelled tombstones, and a cancelled instance may carry only its identity, recurrence linkage, and original start — `start` and `end` can be absent entirely. A window check placed ahead of the cancellation check would therefore throw or misclassify on exactly the events whose companions most need deleting, leaving orphaned travel blocks behind and breaking AC-REC-003.

A cancelled tombstone needs no timestamps to do its job: it yields empty desired state, and its companions are matched by parent ID.

Step 4 uses the **planning** range as a temporal intersection, not the observation range (§7.2). Step 6 is what keeps the observation range bounded.

A source rejected at step 5 or 6 whose duration exceeds `MAX_SOURCE_DURATION_MINUTES` additionally triggers the stranded-companion lookup of §15.2.6 — the duration cap is the precondition of the §7.2 observability proof, and a source that outgrew it may have left companions behind `observeStart` where the ordinary read cannot reach them.

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
  -> ResolvedOrigin | null
```

`null` means no usable origin exists after every fallback — the chain bottomed out at a default origin that is blank (§10.4). It is not an error inside the resolver; the engine decides what a missing origin means for the run.

### 10.2 Per-event override

A directive selects a named configured origin. If the selected optional origin is empty, fall back to default and emit a diagnostic warning — concretely: the **engine** records `DIRECTIVE_ORIGIN_UNCONFIGURED` (§18.2) whenever `directives.origin` is set but the resolved origin's `name` differs from the requested one. The comparison is by **name**, not by `source`: an honored `origin=default` directive resolves to the very origin it asked for and must not warn, and the design deliberately does not pin whether that case reports `source: "directive"` or `source: "default"`. The resolver itself stays a pure lookup; the warning travels in `ReconciliationDiagnostics.warnings` (§4.11), and the event card explains the ignored selection from there plus the origin in the diagnostic payload (§17.6).

### 10.3 Working-location overlap

An overlapping working-location event is one where:

```text
working.start < source.end
AND working.end > source.start
```

If multiple working-location events overlap, choose the one with the most specific or latest start after sorting. The exact tie-breaker should be documented after observing real API behavior.

### 10.4 Default fallback

Default origin is required for write mode. Dry-run diagnostics may continue and report `MISSING_DEFAULT_ORIGIN` without writing.

That promise needs a concrete carrier in the planning path, not just a validation tier. When `resolveOrigin` returns `null` — every fallback exhausted, default blank — the engine does **not** call the provider (there is nothing to route from). It records a per-event **failed** planning outcome carrying a `MISSING_DEFAULT_ORIGIN` error (§17.4, §18.2), and on `eventIdFilter` runs captures the diagnostic payload with `origin: null` and that outcome, so the card renders the actionable reason instead of the run dying in the top-level catch before anything was captured. `failed` is the correct state: existing companions are preserved, exactly as for any other planning failure (§17.3).

The path is reachable only on dry runs by construction — `writeReady` gates write-mode runs on a configured default origin (§5.3) — which is why the outcome must flow through the diagnostic payload rather than relying on the write-gate failure record.

---

## 11. Routing Client Design

### 11.1 Public function

```javascript
function getRouteDuration(from, to, requestContext)
  -> RouteResult
```

`requestContext` is a `RouteRequestContext` (§12.1): role, the observed cache entry for that role, the injected clock, the run's shared HTTP-attempt budget (§11.2), and an optional opaque correlation ID. It carries no calendar title, description, or attendee data.

The client consults the cache before the network:

```text
cachedRouteIsUsable(requestContext.cacheEntry, expectedHash, requestContext.now)
  -> reuse the cached duration, no broker call
  -> otherwise call the broker and return a result marked for persistence
```

Cache policy lives here rather than in the provider, so there is exactly one place that decides whether an entry is stale. `RouteResult` therefore reports its own provenance:

The return shape is the canonical `RouteResult` **defined once in §4.7** — `durationSeconds` (raw, unquantized), `distanceMeters`, `source`, and `calculatedAt` — not restated here as a second competing definition: this interface has already drifted once by being copied.

`calculatedAt` is part of that contract, not an optional nicety: an ephemeral hit must carry the broker's *original* calculation time into the durable `routeAt`, and a client that omitted the field (making the persisted entry invalid on every later read) or stamped the cache-read time (letting a duration outlive `ROUTE_CACHE_MAX_AGE_HOURS`) would defeat the freshness bound from opposite directions.

`source` is what lets the engine decide between a metadata patch and no write at all (§15.2.2), and what the tests in §24.3 assert against when checking that an unchanged run makes zero broker calls. The rule is: **anything other than `"durable"` needs persisting.** A boolean `fromCache` would conflate the two cache tiers — a diagnostic-warmed ephemeral hit (§20.3) avoids the broker call, but the companion's durable entry is still stale, and folding that hit into "cached, no write" would leave the stale entry in place and cost another broker call after ephemeral eviction. The durable check runs first, so an ephemeral or broker result is by construction one whose durable entry failed validation.

### 11.2 Request timeout and retries

Apps Script `UrlFetchApp` does not expose fine-grained retry middleware. The client should perform at most one immediate retry for clearly transient broker errors such as 502, 503, or 504.

**Retries spend the same budget as first attempts.** The per-run ceiling (`MAX_ROUTE_CALLS_PER_RUN`, §13.3) bounds **HTTP attempts**, not logical `getRouteDuration` calls: the shared budget counter travels in `RouteRequestContext.budget`, and the client decrements it for every request it puts on the wire, including the transient retry. Counting logical calls instead would let a run admitted for 60 misses issue 120 attempts — doubling the spend precisely during a broker outage, when the quota matters most. A budget exhausted mid-call yields `ROUTE_BUDGET_EXCEEDED`, an ordinary planning failure (§17.4).

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

The provider requests two routes, each as a pair of `RouteEndpoint`s (§13.3) in travel order:

1. outbound: `from` = effective origin, `to` = `{ type: "address", value: source.location }`;
2. return: `from` = the event-location endpoint, `to` = the effective origin.

The same endpoint objects flow into `routeInputHash` and the broker request, so the configured origin keeps its `placeId` type in both directions.

The MVP must not assume symmetry.

### 11.5 Broker error mapping

The broker's wire vocabulary (Architecture §19.4) and the application's error codes (§18.2) are different namespaces, and the routing client is the single place they meet. The mapping is normative — without it an implementation can propagate wire codes the UI does not recognize, or misclassify a retryable outage as a protocol error:

| HTTP status | Broker `code` | Application code | Retryable (§11.2) |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | `BROKER_PROTOCOL_ERROR` | no |
| 400 | `INVALID_ORIGIN` | `INVALID_ORIGIN` | no |
| 400 | `INVALID_DESTINATION` | `INVALID_DESTINATION` | no |
| 404 / 400 | `NO_ROUTE` | `NO_ROUTE` | no |
| 401 / 403 | `AUTHENTICATION_FAILED` | `BROKER_AUTH_FAILED` | no |
| 429 | `RATE_LIMITED` | `BROKER_RATE_LIMITED` | no (until a `Retry-After` policy exists) |
| 502 / 503 / 504 | `UPSTREAM_UNAVAILABLE` | `BROKER_UNAVAILABLE` | yes — one immediate retry |
| 500 | `INTERNAL_ERROR` | `BROKER_UNAVAILABLE` | yes — one immediate retry |
| 500 / 502 / 503 / 504 | body missing, unparseable, or code unrecognized | `BROKER_UNAVAILABLE` | yes — one immediate retry |
| 429 | body missing, unparseable, or code unrecognized | `BROKER_RATE_LIMITED` | no (same policy as the recognized-body row) |
| *(no response)* | `UrlFetchApp` throw — timeout, DNS failure, connection reset | `BROKER_UNAVAILABLE` | yes — one immediate retry |
| any other | body missing, unparseable, or code unrecognized | `BROKER_PROTOCOL_ERROR` | no |

The table is reachable only if non-2xx responses come back as *responses*: every broker request **must set `muteHttpExceptions: true`**. Without it, `UrlFetchApp.fetch` throws on 400, 401, 404, 429, and 503 alike, so the status and body rows above are never consulted — every HTTP error collapses into the *(no response)* transport row and is classified retryable `BROKER_UNAVAILABLE`, including the validation and authorization failures the table marks explicitly non-retryable. The option is part of the routing-client contract, and the *(no response)* row is reserved for **actual transport exceptions** — timeout, DNS failure, connection reset — the only failures that still throw with the option set.

The transport row matters as much as the HTTP rows: a fetch exception is the single most transient failure class, and routing it through the body-missing catch-all would classify an ordinary outage as a non-retryable protocol error.

The mapping's **precedence order** resolves every status/code combination, including pairs no table row names:

1. **On an error status, a recognized broker `code` is authoritative.** It necessarily came from the broker's own error writer, and is more specific than the transport status — a 500 whose body carries `RATE_LIMITED` classifies `BROKER_RATE_LIMITED`, not a retryable outage; retrying a rate-limited backend burns budget against exactly the backend asking for less traffic. A **2xx** is different: success bodies are governed by §11.3's validation, and a 200 carrying an error code — or anything else that fails that validation — is `BROKER_PROTOCOL_ERROR`, because the broker's contract never pairs error codes with success statuses.
2. **The status classifies bodies that carry no recognized code.** A 5xx or 429 is frequently emitted by infrastructure that never reached the broker's JSON error writer — Cloud Run's own front end, a proxy, a load balancer shedding load — as a bare or HTML body. Requiring a parseable body would misclassify exactly those responses as permanent `BROKER_PROTOCOL_ERROR`: for the 5xx family that contradicts §11.2's immediate-retry policy, and for a bare 429 it would blame the wire contract for what is rate limiting — and permanently sideline the table's own hook for a future `Retry-After` policy from the infrastructure-emitted 429s that need it most. So a code-less 500/502/503/504 maps to `BROKER_UNAVAILABLE` and a code-less 429 to `BROKER_RATE_LIMITED`.
3. **Everything else is `BROKER_PROTOCOL_ERROR`.** An unrecognized code, or a missing/unparseable body, on a status the table does not otherwise recognize — *including a 2xx*: a response the client cannot interpret is not a success.

The **application code decides retryability and user messaging**; the HTTP status and broker code are inputs to the mapping, never consulted downstream.

---

## 12. Drivetime Provider Design

### 12.1 Input context

```typescript
interface DrivetimeContext {
  event: NormalizedEvent;
  settings: UserSettings;
  directives: ParsedDirectives;
  origin: ResolvedOrigin;
  /**
   * Which eligibility path accepted this source. Decides the companion
   * type (12.6): an OOO source qualified through the title pattern gets
   * ordinary companions, and only this field can tell the paths apart.
   */
  matchedBy: "outOfOffice" | "titlePattern";
  /** Injected clock. Cache age is time-dependent; tests must control it. */
  now: Date;
  /**
   * The run's shared HTTP-attempt budget, created once by the engine
   * (starting at MAX_ROUTE_CALLS_PER_RUN) and passed through to every
   * RouteRequestContext. Without this field the retry-inclusive ceiling
   * (11.2) has no path to the routing client.
   */
  routeBudget: RouteBudget;
  /**
   * Route cache entries from the observed companions for this source,
   * keyed by role. Null when no companion exists yet. See 12.1.1.
   */
  observedRouteCache: {
    outbound: RouteCacheEntry | null;
    return: RouteCacheEntry | null;
  };
  routingClient: {
    getRouteDuration(from, to, requestContext): RouteResult;
  };
}

interface RouteCacheEntry {
  routeHash: string | null;
  routeSecs: number | null;
  routeAt: string | null;
}
```

The `requestContext` passed to `getRouteDuration` carries the cache entry and clock through to the routing client:

```typescript
interface RouteRequestContext {
  role: "outbound" | "return";
  cacheEntry: RouteCacheEntry | null;
  now: Date;
  /**
   * Shared per-run HTTP-attempt budget. One counter for the whole run,
   * decremented by the routing client for every request put on the wire,
   * retries included (11.2). The planning layer cannot enforce the ceiling
   * alone because it cannot see retries.
   */
  budget: RouteBudget;
  correlationId?: string;
}

interface RouteBudget {
  /** Attempts remaining this run. Starts at MAX_ROUTE_CALLS_PER_RUN. */
  remaining: number;
}
```

#### 12.1.1 Why the cache reaches the provider at all

Without these fields the cache is unreachable and the cost bound is unimplementable.

The cache lives in the observed companion's private metadata (§13.3), but the provider runs *before* the comparator matches specs to observed events — so under a context of `{event, settings, directives, origin, routingClient}` alone, nothing in the planning path can see a cache entry. Every reconciliation would call the broker, defeating ADR 0011, REQ-PERF-009, and REQ-PERF-010 while the documents still claimed a bound.

The engine therefore resolves observed companions by `parentEventId|role` *before* planning and passes their cache entries down. That ordering is not an optimization; it is what makes the cache exist.

**Cache policy stays in the routing client.** The provider passes the entry through and never inspects it: `cachedRouteIsUsable` and the reuse rule live in `RoutingClient` (§13.3), so there is one place where staleness is decided. This preserves ADR 0014 — the provider computes desired state and knows nothing about infrastructure — while giving the routing layer the data it needs.

`now` is injected rather than read from the clock so that cache-age behavior is deterministic under test (§17.1, §24.1).

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

function quantizeDuration(seconds) {
  return Math.ceil(seconds / ROUTE_GRANULARITY_SECONDS) * ROUTE_GRANULARITY_SECONDS;
}
```

The quantized value is what feeds event times **and** the fingerprint. This is what makes the daily cache refresh (§23.3) safe: traffic noise of a few seconds or minutes lands in the same bucket, produces an identical fingerprint, and causes no user-visible update — the refreshed cache triplet still lands via a metadata-only patch (§15.2.2), which is invisible to the user but is a Calendar write.

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

**Zero-length blocks are never emitted.** A zero-second route (coincident endpoints, §13.3) with a zero-minute buffer — both explicitly allowed — makes `quantize(duration) + buffer === 0`, and the formulas above would produce a companion whose start equals its end. Calendar rejects zero-length events, so every reconciliation would end `partial` on an insert that can never succeed. When a direction's total padding is zero, the provider emits **no spec for that role**: a zero-minute drive with zero buffer needs no travel block. The outcome is still `planned`, so a stale companion for that role is cleaned up through the ordinary orphan path — desired state genuinely contains no block.

No companion also means **no durable cache carrier** — the route cache lives in companion metadata (§13.3). A broker result with no durable home is written to the **ephemeral cache** (§20.3; entries are keyed by the same route input hash and interchangeable between tiers), which in the expected case holds the degenerate case to two broker calls per ephemeral TTL instead of two per run; with any nonzero buffer a block exists and the durable tier carries the entry as usual.

This is a **stated exception to REQ-PERF-009's once-per-day refresh bound**, not a silent violation of it — and it is **per direction**, because the cache carrier is (§13.3): with a zero buffer and asymmetric routes, an outbound that quantizes to zero has no companion while the nonzero return does, and the return's companion caches only its own direction — the outbound result is ephemeral-only even though a companion exists for the other role. The ephemeral TTL is well under 24 hours, so an affected direction under continuous trigger activity re-calls the broker after each eviction — typically a handful of calls per day for that direction. And since `CacheService` is **best-effort** (entries can be evicted before their TTL under cache pressure), the TTL figure is the expected case, not a platform guarantee: the *hard* ceiling remains the per-run route budget times trigger frequency (REQ-PERF-010), which is what actually bounds spend. The exception is accepted rather than engineered away because the alternative is real machinery for a vanishing case: a companion-less durable store (User Properties keyed by route hash) needs its own pruning discipline to avoid unbounded growth, for route directions that arise only when the drive **quantizes to zero** *and* the buffer is zero — and the first broker call is what discovers that. REQ-PERF-009 carries the same exception in its own text, so the requirement and this design cannot drift apart on it.

### 12.6 Generated type

The companion type follows the **eligibility match provenance**, not the source's event type:

If `matchedBy === 'outOfOffice'` (automatic OOO inclusion, §9.2 step 10):

```text
generated eventType = outOfOffice
```

If `matchedBy === 'titlePattern'`:

```text
generated eventType = default
transparency = source transparency when supported
```

The distinction matters for exactly one case: a real OOO source that qualifies **through the pattern** because `includeOutOfOffice` is off. Keying on the source type would emit OOO companions the toggle was switched off to prevent; AC-ELIG-007 requires ordinary companions on that path, and the toggle governs automatic OOO *treatment*, not just automatic OOO *inclusion*. This is why `matchedBy` travels in the provider context (§12.1) — without it the provider cannot distinguish the two paths.

A `default`-typed source can only ever have matched by pattern, and eligibility step 7 (§9.2) has already rejected every other special type as `UNSUPPORTED_EVENT_TYPE`, so the provider never sees a `fromGmail` or `focusTime` source to silently convert.

The exact Calendar API write contract for OOO events must be validated in a prototype before public release.

### 12.7 Summary construction

Outbound:

```text
<prefix> Travel to <source displaySummary>
```

Return:

```text
<prefix> Return from <source displaySummary>
```

Uses `displaySummary`, not `summary` (§8.3), so a blank-titled source produces a readable subject rather than a dangling preposition.

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
  "anchor": "2026-07-24T14:00:00-05:00",
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
- `anchor` — written unconditionally by the current schema, but its absence never invalidates the metadata or removes the event from management: an anchor-less event is merely excluded from the §15.2.8 sweep;
- `routeHash`, `routeSecs`, `routeAt` — the route plan cache (§13.3). Absent entries simply cause a broker call.

All values are strings; Calendar private extended properties are string-typed. `routeSecs` stores the **raw** unquantized duration.

`anchor` persists the §14.1 source anchor — the one source boundary this companion depends on: `source.start` for outbound, `source.end` for return, exactly as it entered the fingerprint. It exists for the daily orphan sweep (§15.2.8): a companion moved outside the observation range whose parent was then deleted is discoverable only by an ownership scan, and the anchor is the only way that scan can tell such a stray (parent time inside the current planning range) from ordinary aged-out history without paying a parent lookup per historical event. An event with a missing or unparseable `anchor` is never treated as a sweep candidate — the conservative failure is a stray that persists, not history that gets probed.

### 13.3 Route plan cache

Each generated event caches the route for its own direction: the outbound event caches origin → destination, the return event caches destination → origin. The two are never assumed symmetrical.

The cache is derived state (ADR 0011). Deleting it is always safe.

#### Route endpoints

Both ends of a route share one shape:

```typescript
interface RouteEndpoint {
  type: "address" | "placeId";
  value: string;
}
```

The source event's location becomes `{ type: "address", value: location }`; a configured origin is already `{ type, value }`. This uniformity is load-bearing, not stylistic. The return route **swaps** the endpoints — the event location becomes the start and the configured origin becomes the end — so a signature that assumed "first argument is an object, second is a string" would, in the return direction, either call `.value.trim()` on a string or flatten the configured origin to a string and silently discard whether it was a Place ID. Place IDs are a supported origin type; losing the type either breaks return routing or degrades a precise place reference into address-parsing guesswork. The broker request schema (§21.2) already uses `{ type, value }` for both ends, so the client-side shapes now match the wire.

#### Route input hash

```javascript
function routeInputHash(from, to, travelMode) {
  return sha256Hex_(canonicalJson_({
    from: { type: from.type, value: from.value.trim() },
    to: { type: to.type, value: to.value.trim() },
    travelMode: travelMode,
  }));
}
```

`from` and `to` are `RouteEndpoint`s in travel order, so the outbound and return entries hash differently — as they must, since the two directions are cached independently and never assumed symmetrical.

The hash deliberately **excludes source start and end times**. MVP routing is not traffic-aware, so moving an appointment does not change its route, and rescheduling should not force a broker call. When traffic-aware routing is introduced, a departure-time bucket joins the hash inputs.

It also excludes the buffer: the buffer is applied after routing and is already a fingerprint input.

#### Reuse rule

```javascript
function cachedRouteIsUsable(meta, expectedHash, now) {
  if (!meta.routeHash || meta.routeHash !== expectedHash) return false;
  if (!meta.routeAt) return false;

  // Presence check, not truthiness. Zero is a legitimate duration -- the
  // broker returns 0 seconds for coincident endpoints -- and a normalized
  // cache entry carries routeSecs as a number, so `!meta.routeSecs` would
  // treat a valid zero as absent and call the broker on every run for
  // exactly the route the cache handles cheapest.
  if (meta.routeSecs === null || meta.routeSecs === undefined) {
    return false;
  }

  // Cached durations get the same validation as broker responses (11.3).
  // Extended properties are strings and externally writable, so a corrupted
  // entry could otherwise inject a negative or non-finite duration and
  // produce invalid companion times.
  const seconds = Number(meta.routeSecs);
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds) || seconds < 0) {
    return false;
  }

  const ageMs = now.getTime() - Date.parse(meta.routeAt);
  if (!Number.isFinite(ageMs)) return false;
  return ageMs >= 0 && ageMs < ROUTE_CACHE_MAX_AGE_HOURS * 3600000;
}
```

`meta` is the **normalized** cache entry (§4.9), and the normalization rule is load-bearing now that zero is a legal value. Extended properties are strings (§13.1); `normalizeObservedGeneratedEvent` converts `routeSecs` to a number **only when the raw string is non-empty and entirely numeric**, and maps everything else — empty, whitespace, garbage — to `null`. A naive `Number(raw)` would turn an externally blanked property into `0` (`Number('')` and `Number('  ')` are both zero), and the presence check above would then trust corruption as a real zero-second route for up to 24 hours. Zero is legitimate only when the broker actually said zero; it must never be manufactured by coercion.

A cache entry that fails any of these checks is treated as absent: the broker is called and the entry rewritten. Discarding a corrupt entry is always safe, which is the whole point of ADR 0011 — but only if the corrupt entry is never trusted in the first place. Cached durations must clear the same bar as fresh broker responses (§11.3), because an unvalidated cache read is a path around that validation.

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
  "sourceAnchor": "2026-07-24T14:00:00-05:00",
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

`routeDurationSeconds` is the **quantized** duration (§12.3), never the raw broker value. This is what allows the daily cache refresh to run without rewriting events: a duration that moves from 1420s to 1447s quantizes to 1500s both times, so the fingerprint is unchanged and no user-visible update occurs — the refreshed cache triplet still lands via the metadata-only patch (§15.2.2, AC-CACHE-001).

#### Fingerprints are role-specific

`sourceAnchor` carries only the source boundary that companion actually depends on:

| Role | Anchor | Derivation |
|---|---|---|
| `outbound` | `source.start` | ends at the source start |
| `return` | `source.end` | begins at the source end |

Including both boundaries in both fingerprints would violate the minimal-write requirement. Extending a meeting by fifteen minutes changes `source.end` and nothing else; the outbound block's times, summary, and type are all unaffected — but a fingerprint containing `sourceEnd` would change, and §15.2 would mandate a full outbound update for a block that is already correct. The inverse applies when only the source start moves.

Each fingerprint covers exactly the inputs that can change its own companion, so a write happens only when that companion is genuinely stale.

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

- no observed event: **out-of-window lookup, then create** — the engine checks for a managed companion the scan cannot see before creating (§15.2.7), and creates only when the scan was complete (§15.2.4);
- one observed event, desired `eventType` differs from observed: **replace** — delete and recreate (see §15.2.5). The same branch fires for an `outOfOfficeProperties` difference **if** the open patchability question resolves against patching the field (§16.5, `docs/open-questions.md`): a difference whose only write path is replacement must classify as replace here, or the update branch below issues a patch Calendar rejects identically on every run — the permanent failure loop §15.2.5 exists to prevent;
- one observed event, fingerprint matches **and** owned fields match, **and** the route cache needs persisting: **metadata patch** (see §15.2.2);
- one observed event, fingerprint matches **and** owned fields match, cache fine: **unchanged**;
- one observed event, fingerprint matches but owned fields differ: **update** (see §15.2.1);
- one observed event, fingerprint differs or is missing: **update**;
- multiple observed events: select canonical, apply the above, delete duplicates.

Two orderings in that list are load-bearing, not stylistic:

- The `eventType` test comes before every other branch because it overrides them: when the type differs, an update is not merely suboptimal, it is impossible (§15.2.5).
- The **metadata-patch test comes before `unchanged`**. A refreshed route whose quantized duration lands in the same bucket changes no owned field and no fingerprint — so an `unchanged`-first ordering classifies exactly the events that need the cache triplet written as needing nothing, the refreshed `routeHash`/`routeSecs`/`routeAt` are never persisted, and every subsequent trigger repeats the broker call. Cache persistence must be evaluated before `unchanged` is ever returned.

For every observed key absent from desired, decide by the parent's planning outcome (§15.2.3):

| Parent outcome | Action |
|---|---|
| `planned` or `ineligible` | **delete** |
| `failed` | **preserve** |
| absent from a **complete** scan | **delete** — genuinely orphaned |
| absent from an **incomplete** scan | **preserve** |

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
reminders
outOfOfficeProperties
```

Every compared field must have a write path that can realign it, or the comparison is theater: a field the add-on **writes** but does not **compare** is one the user can change permanently, and a field it **compares** but cannot **write** is a difference it detects and then cannot fix. For all fields except `eventType` that write path is §16.5's patch, and the **user-visible** entries of the patch list and this comparison set must stay identical — §16.5 also patches private extended properties (the route-cache triplet, §16.6), but those are the add-on's own metadata, not user-editable owned state, so they are repaired by the metadata-patch path (§15.2.2) rather than compared here. `eventType` is compared here but realigned by **replacement** (§15.2.5), because Calendar will not patch it. `outOfOfficeProperties` **is** in §16.5's patch list and repaired in place — with one caveat: whether Calendar accepts the field in a patch body is unverified (`docs/open-questions.md`), and if it does not, realignment falls back to the same replacement path as `eventType`. Either way the difference has a write path.

`reminders` is the case that proves it. §16.3 suppresses reminders on generated events so travel blocks do not fire alerts, and §16.5 lists reminders as owned — but an earlier revision omitted them from this comparison. A user who switched reminders on for a travel block would have kept them forever: the fingerprint is unaffected (reminder state is not a planning input), and the owned-field check did not look, so the event was classified `unchanged` on every subsequent run.

Fields the add-on does not own are neither compared nor written.

The fingerprint remains valuable as the cheap first check — it answers "do I need to recompute anything?" — but the owned-field comparison is what makes reconciliation self-healing.

#### 15.2.2 Metadata-only patches

Route cache entries live in the same private extended properties. When a cache entry is refreshed but the quantized duration lands in the same bucket, the event's owned fields are unchanged and only the route cache triplet — `routeHash`, `routeSecs`, and `routeAt` — needs to be written. The full triplet, not just the two time-varying fields: a missing or corrupted hash must be repaired by the same patch, or the entry fails validation on every later read and the broker is called daily (§16.6, AC-CACHE-012).

This is a distinct diff category. It must not be folded into `unchanged`, because skipping the write would leave `routeAt` permanently stale and force a broker call on every subsequent run — defeating the cost bound the cache exists to provide. It must not be folded into `update` either, since it changes nothing the user can see.

See §16.6.

#### 15.2.3 Absent parents

"Preserve anything whose parent was not evaluated" is too broad, and would strand generated events permanently.

A source event can leave the observation range entirely — moved months out, or deleted. Its old companions stay behind inside the range. If an absent parent always meant preserve, those companions would never be deleted; they would simply age out of the read range still sitting on the user's calendar, violating REQ-RECON-009.

So an absent parent means **orphaned**, and orphans are deleted — but only when the scan that failed to find the parent was complete. A run truncated by pagination failure or execution budget has not established that the parent is gone, only that it was not reached.

```text
scanComplete && parent not found   ->  orphan, delete
!scanComplete && parent not found  ->  unknown, preserve
```

The distinction that matters is *evaluated and failed* versus *not present at all*. Only the former is a planning failure; the latter is ordinary cleanup.

`ReconciliationDiff.diagnostics` records `scanComplete`, so a dry run shows why deletions were or were not proposed.

#### 15.2.4 Absence is evidence only when the scan was complete

The rule §15.2.3 states for deletes applies with equal force to creates, because both are **absence-based**: they act on what the scan failed to find rather than on anything it read.

A truncated scan can cut between a source event and its own companion. Pagination fails after the page carrying the source but before the page carrying its return block; the source is planned, the desired return spec finds no observed match, and an absence-gated-only-for-deletes comparator creates a second return block. Every partial run repeats it, and §13.5's duplicate convergence cannot help until a *complete* scan finally reads both copies — this is the same blindness that produced the window-edge duplicates, arriving through a different door.

So the diff outcomes divide by what they rely on:

| Operation | Based on | On incomplete scan |
|---|---|---|
| create | absence | **suppressed** |
| delete (orphan) | absence | **suppressed** (§15.2.3) |
| update | an observed event | proceeds |
| replace (§15.2.5) | an observed event | proceeds |
| metadata patch | an observed event | proceeds |
| unchanged | an observed event | proceeds |

Presence-based operations proceed because the events they touch were actually read — their data is real regardless of what the scan missed. Suppressing them too would discard sound work and make a flaky page fetch cost a whole run.

A run with suppressed operations reports `partial`, records the suppressed counts in diagnostics, and relies on retry — the next trigger, continuation, or daily run — to complete the scan and perform them.

Replacements proceed on an incomplete scan for the same reason updates do: both halves of a replacement act on an event the scan actually read.

#### 15.2.5 Replacement when eventType differs

The Calendar API declares `eventType` **immutable after creation**. A companion created as `outOfOffice` cannot be patched into an ordinary event, nor the reverse.

The desired type can legitimately change while the parent key stays the same: a source event qualifies as a real OOO event one run (companions are `outOfOffice`, §12.6) and by title pattern the next — the user toggled `includeOutOfOffice` off, or converted the source event's type. The comparator then matches the old companion by `parent + role` and, if the type difference were folded into `update`, would emit a patch Calendar rejects. The patch fails identically on every subsequent reconciliation, the run reports an error each time, and the companion sits permanently in the wrong state — a persistent failure loop, not a transient one.

An `eventType` difference is therefore a **replace**: delete the observed event, create from the desired spec. And if the Spike resolves that `outOfOfficeProperties` cannot be patched either (§16.5), an `outOfOfficeProperties` difference joins this branch under the same rule — the classification must route every difference to a write path that can actually realign it, and for an unpatchable field that path is replacement. This is a classification-time decision keyed on the Spike's answer, not a runtime retry: an update that waits for Calendar to reject its patch would repeat the rejected write on every run. Both operations already exist in the diff vocabulary; `replaces` records them as one intent so run reporting counts a replacement rather than an unrelated delete plus create, and so application can order the delete before the create (Architecture §14.5), leaving at worst a brief gap rather than a brief duplicate.

Replacement authority is deletion authority: the observed event is removed, so the parent's planning outcome must be `planned` (it is, by construction — a desired spec exists). The safety rule §15.3 applies to the delete half unchanged.

#### 15.2.6 Companions of overlong sources

The §7.2 completeness proof guarantees a source's companions are observable **only while the source respects `MAX_SOURCE_DURATION`**. A source event edited after planning to exceed 24 hours can violate that precondition: its end keeps it inside the read range (`timeMin` bounds event end) while the companions generated before the edit sit earlier than `observeStart`.

Such a source is definitively ineligible, which carries deletion authority — but the comparator can only delete events the scan observed, and these companions were not. Without a supplementary read they are stranded permanently: the observation range tracks `now` forward, so events behind `observeStart` never re-enter it.

The trigger condition is the **duration**, not the ineligibility reason. A timed source over the cap is classified `SOURCE_TOO_LONG`, but a source converted into a multi-day **all-day** event breaks the same precondition and never reaches the duration test — §9.2 step 5 classifies it `ALL_DAY_EVENT` first. Keying the lookup on `SOURCE_TOO_LONG` alone would leave the all-day conversion stranding companions in exactly the way this section exists to prevent. The rule is therefore:

> For each ineligible source whose observed duration exceeds `MAX_SOURCE_DURATION_MINUTES`, when **either** companion role is missing from the observed index, perform a targeted, ownership-filtered lookup outside the window bounds.

```javascript
listCompanionsByParent('primary', event.id)
// privateExtendedProperty: dtp=1 AND parent=<event.id>; no time bounds
```

"Either role missing" rather than "no companions observed": the stale departure block can fall behind `observeStart` while the stale return block is still inside the range. Gating on total absence would skip the lookup, delete only the observed one through the ordinary path, and leave the stranded one waiting for a later run — a delay with no bound under flaky pagination, since the ordinary delete is absence-based and suppressed on incomplete scans (§15.2.4). One cheap extra list call removes the dependency.

The returned events join `diff.deletes`, **deduplicated by event id against deletes already queued**. The lookup runs when *either* role is missing, so in the half-stranded case it returns the observed companion too — and the comparator has already queued that one under its ineligible parent. Queuing the same id twice makes the second delete fail with 404 inside `applyDiff`, which would mark an otherwise clean cleanup run `partial` on every occurrence.

They were actually read — by the targeted query rather than the window scan — so this is presence-based deletion and does not depend on `scanComplete`; §15.3's marker rule and §16.5.1's conditional delete apply unchanged. If the lookup itself fails, the run records the error and retries next run, like any other read failure.

Cost is bounded and rare: one extra `Events.list` per overlong source per run, only while such a source sits in the observation range with a companion unaccounted for. Cancelled tombstones are excluded — they may carry no timestamps (§9.2), so their duration is untestable; a source made overlong and then cancelled inside the stranding gap is a residual edge this design accepts rather than paying a per-tombstone list call on every run.

#### 15.2.7 Companions moved outside the observation range

A user can drag a managed companion **out of** the observation range entirely — a travel block pushed months ahead, or into the deep past. A complete scan still cannot see it, so the desired key comes up absent, and a blind create manufactures a replacement while the moved managed event sits stranded at its new time: a permanent duplicate, and a broken promise — the documented recovery for a manual move (§15.2.1, AC-RECOVERY-002) is restoration, not duplication. Duplicate convergence (§13.5) cannot help, because one of the two copies is outside every range the ordinary read covers.

Before creating an absent desired role, the **engine** therefore runs the same unbounded parent lookup as §15.2.6:

```javascript
listCompanionsByParent('primary', spec.parentEventId)
```

Any returned managed event whose `parent|role` key matches the absent desired key is **updated** to the desired specification — the standard restoration path, applied to an event found by targeted read instead of window scan. Only when the lookup finds nothing does the create proceed.

The comparator stays pure: it has no repository access, so it emits the create and the engine post-processes the diff, converting creates to updates where the lookup finds a match — the same engine-side pattern as the overlong and window-shrink cleanups. One lookup covers both roles of a parent. (It is never shared with a §15.2.6 lookup: that pass fires only for ineligible parents, while a pending create requires a planned one — the two conditions are mutually exclusive per parent.)

Cost: one `Events.list` per parent with an absent desired role. For a genuinely new source the lookup returns nothing and the create proceeds — that is the common case, and it prices each new eligible event at one extra list call at creation time, once. Calendar list quota is not the scarce resource; broker calls are, and this path spends none.

The pass is **budget-aware internally**: it takes a `shouldStop` guard and checks it between lookups, because a diff with many pending creates multiplies the per-parent lookups past what any single up-front check can bound — the same one-gate-cannot-cover-a-loop reasoning as `applyDiff` (§17.5). When the guard fires, the pass stops issuing lookups and the engine re-evaluates the execution budget before application: a create whose lookup never ran must not be applied blindly (that is the duplicate this section exists to prevent), and with the deadline reached the run skips application entirely, reports `partial`, and lets the continuation recompute the diff.

**Scoped diagnostic runs skip this pass entirely.** The §17.1 targeted read already performed this exact lookup — `listCompanionsByParent` for the one parent the run compares — so every managed companion, in-window or not, is already in the observed set and no pending create can have a match the pass could find. Running it again would pay a redundant Calendar round trip on the latency-sensitive card-open path, and a failure of that redundant call would convert an otherwise complete diagnosis into a run-wide failure. The diff a diagnostic renders is unaffected: the lookup could only convert a create to an update, and the conversion already happened implicitly by reading the companion into observation.

Two interactions need pinning:

- **The lookup excludes cancelled tombstones.** `listCompanionsByParent` must filter `status: "cancelled"` — a manually deleted companion comes back with its `dtp` metadata intact (§7.3), and matching it here would convert the recreate into an update of a deleted resource, breaking restoration on every run. The same exclusion protects §15.2.6's delete path from 404s on tombstones.
- **Restoration supersedes the shrink cleanup.** The matched event can already sit in the delete list: shrink the window, then drag a companion into the vacated range beyond the new horizon, and §7.6's cleanup queues its deletion while this pass wants to restore it. The engine removes the event from `diff.deletes` **and** from the cleanup's stranded list before converting the create to an update — its parent is planned and its desired position is inside the window, so it is not stranded, and leaving it in the cleanup list would either delete the freshly restored event or leave the high-water mark permanently unlowered when `deletedAll` can never be satisfied.

#### 15.2.8 Companions orphaned outside the observation range

§15.2.7's restoration is driven by a **pending create**, so it fires only while the parent still exists and plans. Delete the source in the gap between the drag and the next run and no create ever pends: the bounded scan sees neither resource, the absence logic has nothing to act on, and the companion sits outside every range the ordinary read covers — a permanent stray, in violation of REQ-RECON-009's cleanup promise.

Discovery therefore cannot be driven by desired specs. The **daily maintenance run** (`reason === "daily-trigger"`, never dry) performs an ownership sweep:

1. list ownership-filtered events **updated since the sweep watermark**: `listGeneratedEventsUpdatedSince(calendarId, updatedMin, shouldStop)`, with `updatedMin` the *earlier* of `now − SWEEP_UPDATED_LOOKBACK_MINUTES` (recommended 4320 — 72 hours, the anchor discovery slack plus one daily cycle) and the persisted **last-completed-sweep timestamp** (`dtp.sweepCompletedAt`, written by the **engine, after `applyDiff` confirms every swept delete succeeded** — `applied.deletedAll(sweep.events)`, the same application-gated rule as the shrink high-water mark in §7.6 — and only when the window scan, listing, and parent point reads all completed on a non-dry run. Advancing on a merely-*computed* diff would be fatal: a deferred or skipped application leaves the stray on the calendar while the advanced watermark shrinks the next sweep's bounds past its `updated` timestamp and anchor, stranding permanently the very event this sweep just found. Absent on a fresh install, where `now − SWEEP_UPDATED_LOOKBACK_MINUTES` applies — a new install has no older strays). `now` is the run's injected clock, threaded into the sweep — reading the wall clock here would unpin the lookback boundary from the anchor band derived from the same `now`. Every stray this section hunts was *manually moved* — that is what put it outside the observation range — and a move bumps the event's `updated` timestamp, so `updatedMin` filters server-side to exactly the recently-touched events among which strays can exist. **Cancelled tombstones are excluded** before candidate selection: an `updatedMin` listing force-includes deleted entries, and a companion the engine itself just deleted has a bumped `updated`, an intact anchor, and a cancelled parent — it would otherwise re-enter the diff as a 404-bound delete for days after every routine cleanup. A full-history scan is not just expensive, it is **unresumable**: a read-only pass deletes nothing and persists no cursor, so a budget-truncated unbounded listing would return the same prefix every day while a stray on a later page aged out of the anchor band unexamined, permanently. The watermark closes the mirror-image gap: skipped or truncated sweeps (missed daily triggers, incomplete window scans) leave `dtp.sweepCompletedAt` behind, so the next completed sweep reaches back over the whole gap instead of only 72 hours;
2. a returned event is a **candidate** when no event with its **id** appears in the window read (identity, not `parent|role` key — a key test would hide exactly the out-of-window *duplicate* whose key an in-window copy satisfies) *and* its `anchor` (§13.2) falls within `[planStart − (MAX_SOURCE_DURATION + SWEEP_DISCOVERY_SLACK_MINUTES), now + MAX_WINDOW_DAYS·1d + MAX_SOURCE_DURATION)`. The **upper bound is the maximal configurable horizon, not the current `planEnd`**: `planEnd = now + windowDays` (§7.2), so no legitimately-created companion can carry an anchor beyond `MAX_WINDOW_DAYS` past its creation-time `now` plus the duration cap (a return companion of a maximal source starting at the horizon's edge anchors at `source.end ≤ planEnd + MAX_SOURCE_DURATION`), and the wide bound admits nothing spurious. The bound is anchored at `now`, not `planStart`: `planStart` sits `RECONCILIATION_LOOKBACK_MINUTES` *behind* `now`, and a `planStart`-anchored bound would fall short by exactly that offset, rejecting a legitimate far-edge stray on the same-day sweep — while a `planEnd`-based bound would silently exclude the shrink case, where a companion of a source inside an old 180-day window is dragged beyond the old high-water mark (its update trigger missed), the window then shrinks to 7 days, the §7.6 shrink scan ends *before* the moved event, and a 7-day anchor band would reject the source's anchor forever. The lower duration term covers whichever source boundary the role anchors — the two differ by at most the cap, and an outbound anchor sits a full duration behind the source's end. `SWEEP_DISCOVERY_SLACK_MINUTES` (recommended 2880 — 48 hours, two daily cycles) covers the time between the stray's creation and its discovery: `planStart` advances continuously, so a sweep bounded only by the duration cap would out-run an outbound anchor before the next daily firing. When the sweep watermark shows a longer gap (skipped or incomplete sweeps), the effective slack widens to `max(SWEEP_DISCOVERY_SLACK_MINUTES, now − sweepCompletedAt)` — the anchor band and the `updatedMin` bound stretch over the same gap together, or a past-anchored stray from early in the gap would be listed but no longer selected. Events with a missing or unparseable anchor are skipped;
3. one `getEventById` per unique candidate parent — **checking `shouldStop` between point reads**: a bulk move or API rewrite can bump `updated` on many companions at once, yielding a parent list long enough that an unguarded read loop consumes the remaining runtime after both paged listings behaved. When the guard fires, the sweep acts only on candidates whose parents were already read and drops the rest. The sweep returns `{ events, sweepComplete }` — `sweepComplete` false whenever the listing was truncated *or* the read loop was cut short — and the engine records it as `diagnostics.sweepComplete` (§4.11), so fixtures and operators can tell "found nothing" from "gave up". Each read then feeds a decision on the **parent's state**, not bare existence:
   - parent **absent or a cancelled tombstone** → the parent's candidates join `diff.deletes`, deduplicated by event id exactly as §15.2.6;
   - parent **live but not evaluated this run** (it sits outside the planning range — moved beyond the horizon or into the deep past together with its companion) → the candidates are **deleted too**. An out-of-window source's desired state is no companions (`OUTSIDE_WINDOW` carries deletion authority, §15.2), ordinary planning cannot see the source to say so, and once the anchor ages past the discovery slack the sweep never looks again — "parent exists, leave it" would make this stray exactly as permanent as the deleted-parent one. The companions regenerate when the source re-enters the window;
   - parent **evaluated this run** (it was in the window read, so `planningOutcomes` has it): `ineligible` → delete the candidates — ineligibility carries deletion authority and the comparator could not reach these out-of-range events; `planned` → delete a candidate only when its `parent|role` key is already satisfied by an in-window observed event (the candidate is then a stranded duplicate §13.5 can never reach) and otherwise leave it — §15.2.7's restoration is updating that very event this run; `failed` → preserve, like every companion of a failed parent (§17.3).

The **absent-parent** rule is safe without `scanComplete`: the swept events were **read** (by the unbounded scan), and the parent's absence comes from a **point read** — `getEventById` returning nothing means the resource is gone, not that a page went unretrieved. §15.3's marker rule and §16.5.1's conditional delete apply unchanged. The **state-keyed** rules are different: "not evaluated this run" is trustworthy only when the window read actually evaluated everything in the window, so **the sweep runs only when the window scan reported `scanComplete`**. On a truncated read, an in-window source sitting on the unretrieved page has no planning outcome, its healthy or restorable companion looks like an out-of-window candidate, and the live-but-unevaluated rule would delete it — the same absence-under-truncation hazard §15.2.4 guards the comparator against. A sweep skipped for an incomplete scan retries tomorrow, like every other deferral in this section.

Steady-state cost is one small `updatedMin`-bounded listing per day — recently-patched in-window companions (excluded by the id test at no further cost) plus any strays — and a small band of point reads: the discovery slack deliberately reaches behind the observation range, so recently-updated companions of sources that ended roughly 40–80 hours ago can be candidates until their anchors age out of the band, a handful of lookups each finding a live parent and skipping. Beyond that, the §7.2 completeness proof applies: a companion whose anchor lies inside the range sits inside the observation range *unless it was moved out*, so the remaining lookups are proportional to anomalies, normally zero.

The sweep is **budget-aware at every unbounded point**: it runs only when `elapsedExceedsExecutionBudget` is still false when its turn comes (after the restoration pass), its listing stops paging early when the budget nears, its parent point-read loop checks the same `shouldStop` guard **between reads**, and the engine re-evaluates the budget after the sweep before applying the diff (§23.1). A sweep cut short at any of those points is *incomplete* (`sweepComplete: false`) — the watermark stays put, so the next completed sweep's bounds stretch back over the unprocessed candidates. And even a complete sweep advances the watermark **only after its deletes actually applied**: application can be skipped (out of time) or defer the deletes, and continuations cannot re-run the sweep (it is daily-gated), so an application-blind advance would strand the found strays exactly as permanently as never finding them. A truncated listing is safe to act on: candidate selection only *finds* strays, and each deletion decision rests on its own point read — truncation merely means some strays wait for tomorrow's sweep. A sweep skipped or cut short costs nothing, while an unbounded listing racing the execution ceiling into `applyDiff` risks the hard-kill-mid-apply failure the budget gate exists to prevent.

Why daily only: a per-calendar-trigger sweep would pay the unbounded listing on every edit, and a stray outside the observation range is invisible in the user's near-term view — a one-day discovery bound matches the daily cycle that already backstops eventual consistency (REQ-TRIGGER-002). The residual case — source deleted and automation disabled before the next daily run ever fires — is accepted; the remove-all action's unbounded cleanup (§19.4) still reaches such events.

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
      "anchor": "2026-07-24T14:00:00-05:00",
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
      "anchor": "2026-07-24T14:00:00-05:00",
      "role": "outbound",
      "fingerprint": "..."
    }
  }
}
```

The exact accepted `outOfOfficeProperties` values must be verified against current Calendar API behavior before finalizing code. Generated OOO blocks should avoid auto-declining unrelated meetings unless explicitly desired.

That promise is **maintained**, not merely set at creation. `outOfOfficeProperties` is owned state carried through the desired spec and the observed fields (§4.8, §4.9) and sits in the §15.2.1 comparison set, so a user who flips auto-decline on a generated block has the change reverted on the next reconciliation — exactly as re-enabled reminders are reverted (§16.3). The value is constant per event type — every generated OOO block carries the body shown above — so it is not a fingerprint input, and the owned-field comparison is the only thing that catches the change.

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

Suppression is **maintained**, not merely set at creation. Reminders are owned state (§15.2.1), so a user who re-enables them on a generated block has that change reverted on the next reconciliation, exactly as a manual time change is reverted. Declaring a field owned and then not comparing it would make the suppression a one-time gesture rather than a guarantee.

### 16.4 Insert behavior

Use `sendUpdates: 'none'` where supported. Generated events have no attendees, but the flag makes intent explicit.

### 16.5 Patch behavior

Patch only fields owned by Drivetime Padding:

- summary;
- start;
- end;
- transparency;
- reminders;
- `outOfOfficeProperties` (on OOO events);
- private extended properties.

`eventType` is **not** in the patch body: Calendar declares it immutable after creation, so a patch carrying a different type is rejected. The type is still owned and still compared (§15.2.1) — a difference is realigned by replacement (§15.2.5), never by patch.

`outOfOfficeProperties` is in the patch body so a user-flipped auto-decline mode is repaired in place — but whether Calendar accepts the field in a patch on an existing OOO event is unverified (`docs/open-questions.md`). If it rejects the patch, realignment falls back to replacement (§15.2.5), the same path that already handles `eventType`; type-specific properties travel with the create a replacement performs, so the fallback loses nothing.

Do not overwrite unrelated fields if a later version adds them.

### 16.5.1 Conditional delete

`deleteGeneratedEvent` must not take a bare event ID.

The user lock (§16 of the architecture) serializes this add-on's executions against each other. It does nothing about concurrent edits from Calendar's own UI, a phone, or another API client. Between the moment reconciliation reads an event and the moment it applies the diff, a user can strip the `dtp` marker or repurpose the event entirely — and a delete keyed only on ID would remove it anyway.

That is a direct breach of ADR 0009, which is a safety boundary rather than a preference, so the check has to happen at the moment of deletion rather than at the moment of reading:

```javascript
deleteGeneratedEvent(observed)   // observed carries id, etag, and marker
```

Preferred mechanism is a conditional delete carrying the observed ETag as `If-Match`, so Calendar itself rejects the delete if the event changed after it was read.

If the Advanced Calendar service cannot set that header — unverified, and listed in `docs/open-questions.md` — the fallback is to re-read the event immediately before deleting and confirm `dtp === '1'`. That narrows the race to the gap between re-read and delete rather than closing it; the residual window is small but real, and the limitation must be documented rather than assumed away.

The same reasoning applies to updates and metadata patches: a patch that lands on an event the user has since taken ownership of is a smaller harm than a delete, but the ETag should be carried wherever the runtime allows.

### 16.6 Metadata-only patch

Refreshing a route cache entry writes the **complete cache triplet** and nothing else:

```json
{
  "extendedProperties": {
    "private": {
      "routeHash": "hex-sha256",
      "routeSecs": "1455",
      "routeAt": "2026-07-31T14:00:00Z"
    }
  }
}
```

Every owned field — start, end, summary, event type, transparency, reminders, `outOfOfficeProperties` — is omitted from the patch body, so the event does not move and the user sees nothing.

`routeHash` is in the patch for a reason that is easy to miss: expiry is not the only way an entry becomes unusable. §13.3 also rejects an entry whose hash is missing, corrupted, or mismatched. If the repair wrote only `routeSecs` and `routeAt`, the bad hash would survive the refresh, the entry would fail the hash check again on the very next run, and the broker would be called every time — a freshly stamped cache that never validates. Writing the triplet atomically means one repair heals every miss cause.

This write is **required**, not optional. A valid `routeHash` and fresh `routeAt` are jointly what make the entry usable; persist either without the other and the cost bound quietly fails.

The resulting cost profile:

| Cache state | Broker calls | Calendar writes |
|---|---|---|
| Valid, nothing changed | 0 | 0 |
| Expired, duration in same bucket | 2 | 1 metadata patch per direction |
| Expired, duration in a new bucket | 2 | 1 full update per direction |
| Source rescheduled or renamed (route inputs unchanged), cache valid | **0** | 1 full update per direction |
| Source location or effective origin changed | 2 | 1 full update per direction |

The rescheduled row is the payoff of excluding source times from the route input hash (§13.3). Moving an appointment changes the companions' desired times — so the fingerprints change and both events are rewritten — but the drive itself is the same drive, the hash still matches, and the cached duration is reused. A reschedule costs Calendar writes only. Charging it two broker calls, as an earlier revision of this table did, would waste quota on the single most common edit a calendar sees and could push an otherwise cheap change into the per-run ceiling.

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
  reason?: "calendar-trigger" | "daily-trigger" | "manual" | "continuation" | "event-diagnostic";
}
```

`now` injection supports deterministic tests.

`eventIdFilter` scopes a run to one source event, and is how the event diagnostic card (§20.3) avoids spending its 20-attempt hourly allowance planning unrelated events before reaching the one that was opened. When set:

- the **window scan is replaced by a targeted read**: the opened event via `getEventById` plus its managed companions via `listCompanionsByParent`. This is a correctness requirement, not just economy — an event beyond the observation range is invisible to the bounded listing, so a window-scan-based filter would leave the card with silence instead of the `OUTSIDE_WINDOW` reason the user needs; and it removes the full window listing from the hot card-open path. Eligibility still evaluates against the planning range, so the out-of-range diagnosis is reported correctly;
- when the opened event is itself a **generated companion**, the filter is redirected to its `parent` id before the targeted read. The companion is derived state with no planning story of its own; diagnosing it literally would classify it as an unparented orphan and, on a hypothetical write run, propose deleting the very event the user asked about. The parent id is **validated before it is used** — a non-empty string, or the redirect resolves nothing: `dtp === '1'` does not guarantee the rest of the metadata survived, and a blank or missing `parent` handed to the point read or the companion listing can throw before the `PARENT_NOT_FOUND` fallback is ever built. An unresolvable redirect issues no further repository calls and reports `PARENT_NOT_FOUND` for the clicked event. The working-location fetch is likewise scoped to the diagnosed event's span rather than the observation range;
- when **automation is disabled**, the disabled gate — which precedes the targeted read — still returns the payload: a synthesized ineligible result with reason `DISABLED_GLOBALLY`. `buildEventCard` renders `result.eventDiagnostics`, and REQ-UI-012 promises every opened event an eligibility answer; a bare status-only result would render a blank card for exactly the state the user most needs explained;
- the card's rendering is **exhaustive over the statuses a scoped run can return**, in precedence order: `eventDiagnostics` when present (the planned, ineligible, disabled, and not-found cases all carry it); otherwise `skipped` (lock contention — the exit that precedes everything, including the diagnostics synthesis) renders "synchronization in progress — reopen shortly", because no eligibility answer exists while another run holds the lock and inventing one would misreport (REQ-UI-012 carries this exception); otherwise `failed` renders the result's errors — the §5.3 validation list for `INVALID_SETTINGS`, the §18.3 message for a contract rejection or boundary failure. No engine exit leaves the card blank;
- when the targeted read resolves **no source event** — the id no longer exists, or a companion's `parent` reference points at a purged event — the result still carries a diagnostic payload: `eventDiagnostics` holds a synthesized ineligible `EligibilityResult` with reason `EVENT_NOT_FOUND` (or `PARENT_NOT_FOUND` when a companion redirect failed) and null/empty remaining fields. Silence is the failure mode the targeted read exists to eliminate, and an orphaned companion is exactly the event a user most needs explained. The dry-run diff may simultaneously propose deleting such a companion; that is honest reporting — with its parent gone it *is* an orphan — and the card presents the reason alongside it;
- planning and comparison therefore naturally cover only that parent — nothing else was read, so nothing else can be misreported as an orphan;
- the cleanup passes (window-shrink, overlong) are skipped — the card cannot act on or display them, and the shrink scan costs real Calendar quota on the hot card-open path;
- the **§15.2.7 restoration pass is skipped too**: the targeted read above already performed that pass's exact lookup — `listCompanionsByParent` for the one parent this run compares — so every managed companion, in-window or not, is already observed and no pending create can have a match the pass could find. Re-querying would pay a redundant round trip on the latency-sensitive card path, and a failure of the redundant call would fail an otherwise complete diagnosis;
- the engine **rejects the option unless the run is both dry and carries `reason: "event-diagnostic"` — and rejects that reason on any run that is not a scoped dry run**. The invariant is bidirectional: a scoped run without the diagnostic reason would draw the ordinary per-run route budget on every card open with none of the spend recorded, bypassing the §20.3 hourly ceiling (which keys on the reason); the reason without the scope would point a full — even write-mode — reconcile at the shared 20-attempt hourly allowance and drain it for every genuine card open that hour; and a write-mode run scoped to one event would carry deletion authority over a comparison that deliberately cannot see everything else. The rejection is a returned failed result, not silent acceptance;
- the result carries the per-event diagnostic payload (§17.6) the card renders.

Full trigger reconciliation never sets it.

### 17.2 Return value

```typescript
interface ReconciliationResult {
  status: "success" | "partial" | "failed" | "disabled" | "skipped";
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  diagnostics: ReconciliationDiagnostics;
  diff: ReconciliationDiff;
  /** What Calendar ACCEPTED, summarized from the ApplyResult (17.5):
      accepted counts per operation, plus failedWrites (the size of the
      failure list) and deferredOps. This is the contract-defined path by
      which applied counts reach saveRunStatus and the 20.2 stored
      record; without it the result exposes only the PROPOSED diff, and
      persistence could not distinguish accepted operations from rejected
      or deferred ones (REQ-RECON-012, REQ-ERROR-006). Null whenever no
      application ran — dry runs, status-only results, failure results
      (the validation gates and the error boundary), and write runs out
      of time before application. */
  applied: {
    creates: number; updates: number; metadataPatches: number;
    replaces: number; deletes: number;
    failedWrites: number; deferredOps: number;
  } | null;
  errors: AppErrorRecord[];
}
```

A run that fails before producing a diff still returns this shape. Settings validation failure is handled **explicitly**: it returns a `failed` result carrying the validation errors, so the diagnostic card can show the user what is wrong (§5.3) rather than a bare `INVALID_SETTINGS`. Everything else run-wide — the window read, an unexpected throw — is caught by the engine's top-level error boundary (Architecture §14.2) and normalized into `status: "failed"` with an empty diff and the error record in `errors` (`CALENDAR_READ_FAILED`, `UNEXPECTED_ERROR`, §18.2). Either failure is persisted as the last-run record by write-mode runs only; dry runs return it without persisting, like every other dry-run result (§17.5). A `try`/`finally` with no `catch` would return nothing structured and leave the home card reporting a stale prior success over a run that never happened.

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
  /** Route resolutions performed during planning, with provenance. Present
      whenever a route was resolved, including roles the zero-padding rule
      (§12.5) emitted no spec for and routes fetched before a later failure;
      empty when planning failed before routing. The diagnostic payload
      (§17.6) is built from this — specs cannot carry it: provenance never
      reaches `privateProperties`, and a zero-emission role has no spec. */
  routes?: Array<{
    role: "outbound" | "return";
    durationSeconds: number;                // raw
    quantizedSeconds: number;
    source: "durable" | "ephemeral" | "broker";
  }>;
  error?: AppErrorRecord;
}
```

The comparator receives deletion authority only for `planned` and `ineligible` events. Failed events are excluded from orphan deletion for that run.

`failed` covers every reason planning could not complete, including `ROUTE_TOO_LONG` and `ROUTE_BUDGET_EXCEEDED`. A source event skipped because the run hit its route ceiling must never have its existing travel blocks deleted as orphans.

### 17.5 Diff application result

`applyDiff` does not mutate the diff it is given. It returns its own record of what happened:

```typescript
interface ApplyResult {
  /** Counts of operations that Calendar accepted. */
  applied: { creates: number; updates: number; metadataPatches: number;
             replaces: number; deletes: number };
  /** Every operation Calendar rejected, with the event it targeted. */
  failures: Array<{
    op: "create" | "update" | "metadataPatch" | "replace" | "delete";
    observed?: ObservedGeneratedEvent;
    spec?: GeneratedEventSpec;
    error: AppErrorRecord;
  }>;
  /** Operations never attempted: the execution budget expired
      mid-application (§23.1). Not failures — nothing was rejected. */
  deferredOps: number;
  /** True when every one of the given observed events was deleted. */
  deletedAll(events: ObservedGeneratedEvent[]): boolean;
}
```

`applyDiff(diff, runStart)` is itself budget-aware: it checks `elapsedExceedsExecutionBudget` **between operations** and stops when the budget nears, counting the remainder as `deferredOps`. The engine's single pre-application check is necessary but not sufficient — a diff with many writes can pass it and still cross the Apps Script hard deadline partway through application, and a hard kill bypasses the catch, the status write, and continuation scheduling: exactly the failure the gate exists to prevent, reintroduced one layer down. A run with `deferredOps > 0` reports `partial` (the deferred work is real, just postponed), the continuation machinery reschedules it, and the recomputed diff on the next pass picks up whatever was deferred — reconciliation is idempotent, so nothing is lost. Deferred operations are never merged into `failures`: nothing was rejected, and counting them as failures would make a clean budget-bounded run look broken.

The `ReconciliationResult` and the stored last-run record (§20.2) are built **from this object**, not from the proposed diff — concretely, `buildRunResult` summarizes it into `ReconciliationResult.applied` (§17.2), which is what `saveRunStatus` reads. The distinction is REQ-ERROR-006: the diff says what the run intended, the `ApplyResult` says what Calendar accepted, and only the second can honestly claim success. A run whose `failures` list is non-empty reports `partial` (or `failed` when nothing applied), merges each failure's `AppErrorRecord` into `errors`, and counts it in the stored record — otherwise a rejected write vanishes: the UI shows success, and nothing distinguishes "done" from "silently dropped".

A write-mode run can also end with no `ApplyResult`: when the execution budget expires after the diff is computed but before application (§23.1), the engine skips `applyDiff` rather than risk a hard kill mid-apply, and `buildRunResult(diff, null, options, null)` on a non-dry run reports `partial` — the diff was proposed, nothing was applied, and the continuation machinery reschedules it.

On a dry run there is no `ApplyResult`; the result is built from the diff, carries `dryRun: true`, and is **returned but never persisted**. The stored last-run record is what the home card presents as the last outcome (§19.5, §20.2), and the event diagnostic card runs dry-run planning routinely — letting it overwrite the record would replace real applied counts with proposal counts moments after a genuine run.

### 17.6 Per-event diagnostic payload

The aggregate result cannot feed the event card: §20.3 requires eligibility, directive interpretation, selected origin, effective buffer, and route durations for the opened event, and all of those are planning-loop locals that appear nowhere in `ReconciliationResult` or the diff. Without a defined carrier, `buildEventCard` would have to reimplement planning to display what the engine just computed.

On `eventIdFilter` runs the engine therefore captures them:

```typescript
interface EventDiagnostics {
  eventId: string;
  eligibility: EligibilityResult;
  directives: ParsedDirectives | null;      // null when never parsed
  /** The normalized event's location (trimmed, 8.4; empty string when
      the source has none — the MISSING_LOCATION ineligible case) — the
      destination REQ-UI-014 requires the card to show. Null only in the
      synthesized fallback payloads, where no event was ever read
      (not-found, disabled, unsupported-calendar). Diagnostics run
      dry-only and are never persisted (17.5), so the address renders
      in-card and lands in no stored record. */
  destination: string | null;
  origin: ResolvedOrigin | null;            // null when ineligible
  /** Directive override or settings default, supplied by the engine at
      capture time — never inferred from spec timestamps, which do not
      exist when planning failed before producing specs. */
  effectiveBufferMinutes: number | null;
  /** Copied from PlanningOutcome.routes (§17.4) — the provider is the only
      layer that sees provenance. Empty when the outcome is null or planning
      failed before routing. */
  routes: Array<{
    role: "outbound" | "return";
    durationSeconds: number;                // raw
    quantizedSeconds: number;
    source: "durable" | "ephemeral" | "broker";
  }>;
  outcome: PlanningOutcome | null;
}
```

`ReconciliationResult` gains an optional field, populated only when `eventIdFilter` was set:

```typescript
eventDiagnostics?: EventDiagnostics;
```

Unfiltered runs never populate it — capturing per-event detail for a whole window would bloat every result for one consumer that never reads it there.

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

Warnings (non-fatal; surface in `ReconciliationDiagnostics.warnings`, §4.11):

```text
WORKING_LOCATION_UNAVAILABLE
DIRECTIVE_ORIGIN_UNCONFIGURED
DIAGNOSTIC_SPEND_RECORD_FAILED
STATUS_PERSIST_FAILED
BOOKKEEPING_PERSIST_FAILED
CONTINUATION_ENQUEUE_FAILED
MANUAL_ENQUEUE_FAILED
```

`DIRECTIVE_ORIGIN_UNCONFIGURED`: a directive named a `home` or `office` origin that is not configured, and resolution fell back to the default (§10.2). Recorded by the **engine** after `resolveOrigin` — the resolver stays a pure lookup — whenever `directives.origin` is set but the resolved origin's `name` differs from the requested one (never for an honored `origin=default`). Without a registered code the fallback §10.2 requires would have no carrier, and the event card could not explain that the user's explicit selection was ignored.

`STATUS_PERSIST_FAILED`: `saveRunStatus` threw. **Every** persistence site is guarded — the success path, the error boundary, and both validation-gate branches (structural invalidity and write-readiness) — through one shared wrapper, `saveRunStatusGuarded(result)`, which is the *only* way the engine calls `saveRunStatus`: four hand-rolled copies of the same guard would drift apart the first time one is tweaked. A run's returned result must survive a Properties outage whichever exit it takes, so the wrapper joins the code to the *returned* result's `warnings` (the result is still in hand at all four sites, unlike the finally-block spend record) as well as logging it. Each site's guard protects something specific. The success path: an unguarded save throwing into the boundary would rebuild a run Calendar fully accepted as `failed`, and — should Properties recover for the boundary's retry — persist an affirmatively **false** failure record with zero applied counts (REQ-ERROR-006 violated in storage). The validation gates: the throw would *replace* the `INVALID_SETTINGS` result, and with it the full validation error list that carries the card's reset guidance, with a generic persistence failure. The boundary's own save: retrying an unavailable write unguarded would throw past the boundary, leaving trigger callers with no structured result at all. A persistence outage therefore degrades to "truthful result returned, stored record stale until the next successful persist, warning attached" — never to a lie about what Calendar did.

`BOOKKEEPING_PERSIST_FAILED`: a post-apply bookkeeping write threw — the shrink high-water mark, the sweep watermark, or the continuation-counter reset. Guarded because Calendar has already accepted the run's operations by the time these fire: an escaping throw would rebuild an applied run as a failure with an empty diff. Losing any of them is **safe by construction** — an unlowered mark re-scans and retries next run, an unadvanced watermark widens the next sweep's bounds over the gap, and a stale continuation counter costs at most one episode's allowance (§19.6). All three sites use `recordRunWarning`, which appends *and* logs; the run's diagnostics object is created once and carried by reference into the built result, so the one mechanism works before and after `buildRunResult` — three hand-rolled variants would drift exactly as the shared `saveRunStatusGuarded` rationale warns.

`CONTINUATION_ENQUEUE_FAILED`: `enqueueContinuation`'s trigger creation threw (per-user trigger quota, transient ScriptApp error). Emitted from **two call sites with different carriers** (§19.6): the engine's partial-run call joins the returned result's `warnings` — the run's applied operations are real, and rebuilding it as a failure would be a false record — while the handler's skip-path re-enqueue is **log-only**, because a lock-contention skip did no work and has no persisted result to carry the code. Either way the deferred work falls to the daily backstop (REQ-TRIGGER-002).

`MANUAL_ENQUEUE_FAILED`: the manual handler's skip-path re-enqueue threw (§19.5) — the same throwable trigger-creation API, guarded for the same reason. **Log-only**: a skipped run's result is never persisted or rendered. The failure stays honest without a carrier because manual pendingness is *derived* from the trigger list — the home card shows no run pending and the button invites a retry. The card action's own enqueue is deliberately unguarded: it fails synchronously in front of the user as the action's error response, which is the correct surface.

`DIAGNOSTIC_SPEND_RECORD_FAILED`: the hourly diagnostic-spend write threw inside the engine's `finally`. The failure is caught and **logged** with this code rather than rethrown — an accounting error must not replace the run's already-built structured result or strand the user lock (Architecture §14.2). It cannot retroactively join that run's `warnings`: the result was assembled and persisted before the `finally` ran. The ceiling is protected from the other side instead — `diagnosticBudgetRemaining` **fails closed**, returning `0` when its own Properties read throws, so an outage that breaks spend *writes* (the same service) cannot simultaneously mint fresh allowances; at worst one run's spend goes unrecorded against a working counter.

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

- **create nothing when `settings.enabled` is false** — after the remove-all action persists the disabled state (§19.4), repair invoked from the homepage or a settings save must not resurrect the triggers the user just removed; it reports the disabled state instead. Re-enabling runs `ensureTriggers()` as part of the enable flow;
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

**"All" means all, not "all within the current window."** Managed events age out of the rolling observation range but stay on the calendar as history, and a window shrink or an old overlong source can leave managed events far outside any range a reconciliation run reads. A cleanup built on the window-bounded scans would silently miss them. The repository therefore exposes an **unbounded, ownership-filtered, paginated** scan for exactly this action:

```javascript
// One page at a time -- the CONSUMER owns the paging loop and its budget
// checks. A paginate-to-completion contract would hide a multi-page scan
// behind a single call, ahead of any deadline check (19.4 step 4).
listGeneratedEventsPage(calendarId, pageToken)
  -> { events: ObservedGeneratedEvent[], nextPageToken: string | null }
// privateExtendedProperty: dtp=1; no timeMin/timeMax
```

The unbounded scan plus one conditional delete per historical companion **cannot live inside the card callback**. CardService actions have the same short execution budget that already forced manual synchronization to enqueue (§19.5), and this action's work grows with the user's entire history — an established user with hundreds of aged-out companions would hit the ceiling mid-cleanup, losing the confirmation card and leaving events and personal settings behind at exactly the moment the user is preparing to uninstall. The action therefore splits into a cheap synchronous half and an enqueued worker.

**The card action** (`removeAutomation`, behind the confirmation) does only bounded work:

1. **acquire the same user lock reconciliation uses** (§16 of the architecture), with a generous wait. If the lock cannot be acquired, report that a synchronization is in progress and ask the user to retry — the disable must not race a run;
2. **replace the settings document with the disabled tombstone** — the §5.2 defaults with `enabled: false` — under the lock, not merely flip the flag. The tombstone is **schema-complete by construction**, so what later runs read is exactly what was written. A minimal `{ schemaVersion, enabled: false }` fragment would in fact *load* — §5's deep-merge fills missing fields from defaults before validation runs — but the disabled state the user just confirmed should not depend on read-time healing: the fragment's effective content would be computed against whatever defaults the *reading* version ships, and the engine validates structurally before it checks the disabled gate (Architecture §14.2), so the disabled report would rest on the merge always reconstructing a validatable document. Writing the complete defaults makes the stored document self-contained. They carry empty origin values, so replacing the document still destroys the configured addresses. Trigger removal alone is temporary: the engine's own first check is `settings.enabled`, `ensureTriggers()` is explicitly required to recreate missing triggers, and a later manual synchronization or trigger repair against an enabled settings object would regenerate everything the user just asked to remove; the persisted disabled state is what makes "disable automation" mean disabled, and what makes the enqueued cleanup safe to run outside this lock hold (any run starting after this point exits at the disabled gate). Writing the **tombstone** here rather than after cleanup is the REQ-PRIV-006 move: configured origins are personal data (home and office addresses), the user has just confirmed removal, and destroying them must not be conditional on Calendar accepting every later delete or on the worker ever winning the lock again — a user whose cleanup ends `failed` and who proceeds to uninstall must not leave their home address in User Properties indefinitely. Nothing downstream needs the addresses: the cleanup scan is ownership-filtered and deletion needs only the events themselves. The tombstone rather than full deletion is what keeps trigger repair gated on the disabled flag (§19.3): a deleted document reads back as fresh defaults with `enabled: true` (§5.2), resurrecting exactly the automation the user just removed. (A user who re-enables mid-cleanup re-enters their origins — the acceptable cost of having confirmed a destructive action;)
3. **remove the add-on's reconciliation triggers**;
4. **initialize the persisted progress record** (below) and **enqueue the cleanup worker** — a one-off trigger, same mechanism as §19.5 — then release the lock and return "Removal started". The card does not pretend the deletions happened inside the callback.

**The cleanup worker** (`runRemovalCleanup`, one-off trigger handler):

1. deletes every pending trigger for its own handler (the §19.5 collapse rule);
2. acquires the user lock with a generous wait; on failure increments the progress record's `contentionRetries`, re-enqueues itself, and exits. Contention retries do **not** count against the pass cap — no work was done — but are bounded separately by `MAX_REMOVAL_CONTENTION_RETRIES` (recommended 10), past which the record is marked `failed`. The contention-cap terminal path needs no settings handling at all: the tombstone was written by the card action, under its lock, before the worker ever existed — REQ-PRIV-006 is already satisfied however the cleanup ends. Without their own bound, a persistently contended lock would chain re-enqueues forever with the record showing `running`; counting them as passes would instead let zero-work retries exhaust the cap and report failure when nothing went wrong. Genuine long contention is already unlikely: the tombstone is persisted by the time the worker exists, so post-disable runs exit at the gate in seconds;
3. re-checks `settings.enabled`: if the user re-enabled the add-on between passes, the cleanup **aborts** and marks the progress record `aborted` — deleting companions a re-enabled automation is actively maintaining would just churn recreations against the user's changed intent;
4. **interleaves paging and deletion** rather than scanning to completion first: fetch one ownership-filtered page (`listGeneratedEventsPage`), delete its events through `deleteGeneratedEvent` — §15.3's marker rule and §16.5.1's conditional delete apply unchanged — checking `elapsedExceedsExecutionBudget` between pages and between deletions (§23.1). A materialize-everything-then-delete contract would put the entire multi-page scan ahead of the first budget check: a history large enough to spend the deadline on pagination alone would hard-kill the worker mid-scan, and — with no cursor to resume from — every retry would repeat the same full scan and die the same way, forever. The walk order within a pass: attempt every event on the fetched page that has not already failed this pass; if the page produced **any successful deletion**, re-fetch from the start (the set shrank, and the first page now holds fresh work); if it produced **none** — every event on it already failed — advance via `nextPageToken` instead (the **no-progress guard**: re-fetching an all-failing first page would spin forever). The scan is **complete only when this walk runs off the end of the listing** — a fetch yields no attemptable events *and* no `nextPageToken` — meaning every remaining managed event was attempted this pass and either deleted or recorded as a failure; an all-failing first page is *not* completion, it is the cue to advance to the pages behind it. Interleaving needs no persisted cursor: each deletion shrinks the result set, so re-fetching the first page after a kill or a re-enqueue naturally resumes where the deletions stopped, and cross-pass, failed events are simply retried. When the budget expires with work remaining, the worker folds the pass's counts into the progress record, re-enqueues itself, and exits;
5. working passes are capped at `MAX_REMOVAL_PASSES` (recommended 20 — a generous multiple of any realistic history at ~thousands of deletions per pass). At the cap the record is marked failed with the counts so far; the action can be offered again;
6. on the **fully-successful** terminal outcome (scan complete, zero failures), clear the remaining stored state — the high-water mark, the continuation counter, the diagnostic spend counter, the sweep watermark, the last-run record. A `failed` outcome retains those alongside `CleanupProgress` for the retry. **The worker never writes the settings document** — the tombstone was the card action's step 2, so no terminal path (including the contention cap) has settings work left to do, no path can clobber a mid-flow re-enable's freshly-entered configuration, and the old unlocked-tombstone race is gone by construction.

**The enable flow acquires the same user lock before persisting `enabled = true`** (and is rejected with a cleanup-in-progress notice while a pass holds it), so a re-enable can only land between passes, where the next pass's step-3 check sees it and aborts.

**Progress is persisted, not held in memory** — it must survive the worker's own re-enqueues and be visible between passes:

```typescript
// User Properties, key dtp.removalProgress
interface CleanupProgress {
  state: "running" | "complete" | "failed" | "aborted";
  passes: number;                // lock-holding passes only
  contentionRetries: number;     // lock-contention re-enqueues (step 2)
  triggersRemoved: number;
  eventsDeleted: number;         // cumulative across passes
  failedDeletes: number;         // cumulative across passes
  /** False when the final scan was truncated; some events may remain. */
  scanComplete: boolean;
  startedAt: string;
  updatedAt: string;
}
```

The home card is the status surface, and it derives liveness the same way manual pendingness is derived (§19.5) — from the trigger list, never from the stored state alone: a record saying `running` **with no pending `runRemovalCleanup` trigger is treated as failed**, shown with its counts, and the action is offered again. The worker can die without ceremony — an uncaught throw after deleting its own trigger, a platform kill mid-deletion, or the card action's own enqueue failing against the trigger quota (which the card action must also catch, marking the record `failed` immediately) — and a stored `running` that nothing can update must not lock the user out of retrying forever. Otherwise: `running` with a pending trigger shows cleanup-in-progress with the cumulative count; `complete` shows the final counts; `failed` or `aborted` shows the counts, states that some events may remain when `failedDeletes > 0` or `scanComplete` is false, and offers the action again — the whole flow is idempotent, so re-running it retries only what remains. A partial failure is **reported, not absorbed**. Automation stays disabled from the card action's step 2 regardless of cleanup outcome; a failed cleanup must never leave triggers running against a user who asked to stop.

Like §19.5 and §19.6, the worker depends on one-off trigger creation and is **subject to Prototype Spike 1**. The fallback if the spike fails is the §19.5 pattern's inverse: bounded inline passes from the card, each deleting until near the callback budget and reporting remaining work with a "continue removal" action — worse, and to be called out in the spike report rather than silently adopted.

### 19.5 Manual synchronization entry point

The home card's "Synchronize now" button must not run reconciliation inline. CardService action callbacks have a short execution budget, and a full-window reconcile on a busy calendar will exceed it — the user would see a spinner, then a timeout, and learn that the button breaks exactly when the calendar is big enough to need it.

The button therefore **enqueues** and returns, using the same one-off time-based trigger mechanism as partial-run continuations (§23.4):

```javascript
// CardService action handler. Must return within the callback budget.
function onSynchronizeNow(e) {
  enqueueManualRun_();
  return buildNotificationResponse_('Synchronization started.');
}

// Pendingness is DERIVED from the trigger list, never stored. A persisted
// flag needs a failure-path clear: if the run throws after its trigger is
// deleted, or the container dies mid-run, a stored flag stays set forever
// and every later click silently no-ops while still toasting success. The
// trigger list cannot go stale that way -- the handler deletes its trigger
// on entry, so a crashed run leaves pendingness false and the button live.
function manualRunPending_() {
  return ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'runManualReconciliation';
  });
}

function enqueueManualRun_() {
  // Do not stack: if a manual run trigger is already pending, this is a
  // no-op -- same rule as continuations (23.4). Reconciliation is
  // idempotent, so one pending run covers any number of clicks.
  //
  // The check-and-create is SERIALIZED under the user lock: two rapid
  // clicks (double-click, two tabs) can otherwise both observe pending as
  // false before either creates its trigger. The lock is held for
  // milliseconds here, so the short wait resolves click-vs-click races.
  // When the wait fails, a reconciliation is holding the lock for its
  // whole run -- fall through and create unserialized rather than drop
  // the click (the card already said "started", and a run in progress may
  // have read the window before the user's change). The bounded residue
  // -- two clicks during an active run both slipping past the check --
  // is collapsed by the handler, which deletes EVERY pending manual
  // trigger on entry, not just its own.
  const lock = LockService.getUserLock();
  const locked = lock.tryLock(MANUAL_ENQUEUE_LOCK_MS);   // recommended 2000
  try {
    if (manualRunPending_()) return;
    ScriptApp.newTrigger('runManualReconciliation')
      .timeBased()
      .after(MANUAL_RUN_DELAY_MS)    // recommended 1000; minimum granularity applies
      .create();
  } finally {
    if (locked) lock.releaseLock();
  }
}

// One-off trigger handler. Deletes EVERY pending manual trigger FIRST --
// its own plus any duplicate that slipped past the enqueue check while a
// run held the lock -- which both clears pendingness and collapses a
// stacked pair into this one execution. Then runs the same engine as
// every other entry point (REQ-RECON-011).
function runManualReconciliation(e) {
  deleteTriggersByHandler_('runManualReconciliation');
  const result = runReconciliation({ reason: 'manual' });

  // Lock contention did no work, but the user was already told
  // "Synchronization started" -- and this handler just deleted the only
  // pending trigger. Re-enqueue, exactly like the continuation handler:
  // contention is transient (locks release when the holding execution
  // ends), and dropping the run here would silently break the promise
  // the card made.
  //
  // Guarded like both 19.6 call sites: trigger creation is the same
  // throwable API (per-user quota, transient ScriptApp error), and an
  // escape here is an uncaught throw inside a trigger handler after the
  // pending trigger was already deleted. Log-only -- a skipped run's
  // result is never persisted or rendered -- and the failure is honest
  // downstream: pendingness is DERIVED from the trigger list, so the
  // home card shows no run pending and the button invites a retry, with
  // the daily cycle as the backstop (REQ-TRIGGER-002).
  if (result.status === 'skipped') {
    try {
      enqueueManualRun_();
    } catch (enqueueError) {
      logWarning('MANUAL_ENQUEUE_FAILED', enqueueError);
    }
  }
  return result;
}
```

The home card reflects progress through the stored last-run record (§20.2) plus `manualRunPending_()`. "Synchronization started" is honest — the card does not pretend the work finished inside the callback.

The **card action's own enqueue** needs no catch: it runs synchronously with the user present, so a trigger-creation throw surfaces as the action's error response — the user sees the failure instead of a false "started" toast, and can retry. The handler's re-enqueue is the site with nobody watching, which is why it logs `MANUAL_ENQUEUE_FAILED` (§18.2) instead of throwing.

Like continuations, this depends on one-off trigger creation and is therefore **subject to Prototype Spike 1**. If the spike finds one-off triggers unavailable to Marketplace add-ons, the fallback is an inline run with the per-run route ceiling lowered far enough to fit the callback budget, ending `partial` and relying on the daily cycle for the remainder — a worse experience that must be called out in the spike report rather than silently adopted.

### 19.6 Continuation entry point

§23.4 promises that a `partial` run schedules its own continuation, with a do-not-stack rule and a cap of `MAX_CONSECUTIVE_CONTINUATIONS`. This section is the worker behind that promise — without it, the constant and the requirement exist but nothing can enforce either rule.

The trigger machinery mirrors manual synchronization (§19.5): pendingness derived from the trigger list, handler deletes its own trigger on entry.

```javascript
function continuationPending_() {
  return ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'runContinuationReconciliation';
  });
}

// Called by the ENGINE after a non-dry run ends `partial` (see the
// architecture §14.2 pseudocode). Returns what happened so the engine can
// record continuationCapReached on the run status -- a void decline would
// leave diagnostics unable to say why work is waiting for the daily run.
function enqueueContinuation() {
  if (continuationPending_()) {
    return { scheduled: true, capReached: false };          // a pass is already coming
  }
  const count = Number(
    PropertiesService.getUserProperties().getProperty(CONTINUATION_COUNT_KEY)
  ) || 0;
  if (count >= MAX_CONSECUTIVE_CONTINUATIONS) {
    return { scheduled: false, capReached: true };          // daily run takes over
  }
  ScriptApp.newTrigger('runContinuationReconciliation')
    .timeBased()
    .after(CONTINUATION_DELAY_MS)                           // recommended 5 minutes
    .create();
  return { scheduled: true, capReached: false };
}

// One-off trigger handler. Deletes every pending trigger for this handler
// (its own, plus any duplicate the unserialized skip-path re-enqueue let
// slip -- same collapse rule as §19.5), then runs the shared engine
// (REQ-RECON-011). The counter increment happens INSIDE the engine,
// under the user lock -- see the lifecycle rules below.
function runContinuationReconciliation(e) {
  deleteTriggersByHandler_('runContinuationReconciliation');
  const result = runReconciliation({ reason: 'continuation' });

  // Lock contention did no work and never reached the counter (the
  // increment lives behind the lock), so there is nothing to refund --
  // just retry. This cannot loop unboundedly: Apps Script locks release
  // when the holding execution ends (hard 6-minute execution ceiling),
  // so contention is inherently transient.
  //
  // Guarded like the engine's call: trigger creation is the same
  // throwable API (per-user quota), and an escape here is an uncaught
  // throw inside a trigger handler. Log-only -- a skipped run has no
  // applied results to protect; the dropped re-enqueue falls to the
  // daily backstop (REQ-TRIGGER-002).
  if (result.status === 'skipped') {
    try {
      enqueueContinuation();
    } catch (enqueueError) {
      logWarning('CONTINUATION_ENQUEUE_FAILED', enqueueError);
    }
  }
  return result;
}
```

The **counter lifecycle** is what makes the cap enforceable:

- stored in User Properties under `dtp.continuationCount` — unlike pendingness it cannot be derived, because it must survive across runs;
- **incremented by the engine, under the user lock, after the cheap gate checks and before the window read** (`reason === 'continuation'`, non-dry): the lock is what serializes the counter against the concurrent successful run that resets it — a handler-side increment races that reset, losing it or leaving a stale refund. Counting before substantive work preserves crash-safety: a continuation that dies mid-run still counted itself. The gate checks it sits behind cannot loop on the allowance either — each one either terminates the episode (a failed result schedules nothing) or is transient (a skip re-enqueues without counting);
- a `skipped` run never touched the counter (the increment is behind the lock it failed to take), so there is no refund path — the handler simply re-enqueues;
- reset to `0` by any **non-dry** run that completes with status `success`, whatever its reason — success means the deferred work drained, so the next `partial` episode starts a fresh allowance. Increment and reset are both under the lock, so they cannot interleave;
- when the cap is reached, `enqueueContinuation` returns `capReached: true` and the engine records it as `diagnostics.continuationCapReached` on the run result — the field's home in the §4.11 contract, which is where status persistence and the UI read it;
- the engine's call is **guarded**: `ScriptApp.newTrigger(...).create()` can throw — the per-user trigger quota is the obvious case — and the partial result in hand describes operations Calendar already *accepted*. An unguarded throw would reach the error boundary and rebuild the run as a generic failure with an empty diff, discarding the true applied counts (the same false-record hazard as an unguarded status save). The engine catches the failure, keeps the truthful partial result, records a `CONTINUATION_ENQUEUE_FAILED` warning (§18.2), and lets the deferred work wait for the daily backstop (REQ-TRIGGER-002).

**Dry runs are exempt from all of this.** A diagnostic dry run that would end `partial` neither schedules a continuation nor resets the counter — a diagnostic must not mutate trigger state (see the engine pseudocode, Architecture §14.2).

A stale counter is bounded harm in both directions: a crash before reset costs at most one episode's allowance (the next successful run clears it), and the daily run remains the eventual-consistency backstop either way (REQ-TRIGGER-002).

Like §19.5, this depends on one-off trigger creation — **subject to Prototype Spike 1** — and §23.4 already states the narrowed guarantee if the spike fails.

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
  "metadataPatches": 1,
  "replaced": 0,
  "deleted": 0,
  "failedWrites": 0,
  "deferredOps": 0,
  "errors": 0
}
```

The write counts are **applied** counts taken from the `ApplyResult` (§17.5) via `ReconciliationResult.applied` (§17.2), not proposal counts taken from the diff. `failedWrites` is the size of the failure list; any non-zero value forces `status` to `partial` or `failed`, so the home card can never display success over rejected writes. The record carries **all seven** of the carrier's counts: without `metadataPatches`, a run whose only accepted operations were cache-triplet patches would store all-zero write counts and read as a no-op; without `deferredOps`, a budget-bounded run with no failures would store `partial` with nothing in the record explaining why.

A persisted result can carry `applied: null` — a failure result from a validation gate or the boundary, or a write run whose budget expired *before* application (§17.5). The record then stores **zero for all seven counts**, and the status plus `errors` carry the story: `failed` with zero counts is a run that never applied anything, and `partial` with all-zero counts and no errors is precisely the computed-but-never-applied case — the diff was proposed, application was skipped for time, and the continuation reschedules it. `saveRunStatus` must handle the null without dereferencing it.

Dry runs never write this record (§17.5). Every **non-dry** run's result is persisted — including failures and never-applied partials, via the guarded save at each engine exit — and the zero counts plus status are what distinguish those from runs that applied work.

### 20.3 Event diagnostic mode

The current-event card invokes a dry-run reconcile scoped by `eventIdFilter` **with `reason: "event-diagnostic"`** — the engine rejects either half without the other, in both directions (§17.1): budgeting keys on the reason, so a scoped run without it would draw the ordinary per-run budget on every card open unrecorded, while the reason on an unscoped run would drain the shared hourly allowance with a full reconcile — and renders `ReconciliationResult.eventDiagnostics` (§17.6), the defined carrier for the per-event fields below, which are otherwise planning-loop locals the card could not reach without reimplementing planning.

Rendering is **exhaustive over the statuses a scoped run can return**, in the precedence order §17.1 states: `eventDiagnostics` when present — the planned, ineligible, disabled (`DISABLED_GLOBALLY`, synthesized by the disabled gate), and not-found cases all carry it; otherwise `skipped` (lock contention) renders "synchronization in progress — reopen shortly", the REQ-UI-012 exception, because no eligibility answer exists while another run holds the lock; otherwise `failed` renders the result's errors (the §5.3 validation list for `INVALID_SETTINGS`, the §18.3 message for a boundary failure). A blank card is never an outcome.

The card flow also checks **which calendar the event was opened from, before invoking the engine**: the `eventOpen` trigger fires for events on secondary and shared calendars too, while the MVP manages only the primary calendar (REQ-INSTALL-004). An unchecked pass-through would look the opened id up in the primary calendar and report `EVENT_NOT_FOUND` for an event the user is looking at. The comparison is against the **resolved primary-calendar id** — the user's own calendar id (their email address), obtained once, e.g. via `CalendarApp.getDefaultCalendar().getId()` — **never the literal string `"primary"`**: that alias is request-side sugar the trigger payload does not contain, so a literal comparison would classify the user's own primary calendar as foreign and break every card open. When `e.calendar.calendarId` differs from the resolved id, the card renders an explicit **unsupported-calendar** explanation directly — the payload synthesized by `buildUnresolvedEventDiagnostics(eventId, "UNSUPPORTED_CALENDAR")`, the same card-side synthesizer as the not-found reasons — with no engine run, no budget spend, and no misleading not-found diagnosis.

It should display:

- eligibility result;
- directive interpretation;
- selected origin name, but avoid displaying a sensitive full address unless the user is in settings;
- destination — carried as `EventDiagnostics.destination` (§17.6), copied from the source event's location at capture time; nothing else in the result retains it, and diagnostics are never persisted, so the address renders in-card only;
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
- on exceeding it, the card renders eligibility, directives, and resolved origin — everything that needs no route — and reports that timing is temporarily unavailable.

**Enforcement is through the same `RouteBudget` the run already carries** (§11.2, §12.1) — the ceiling must be the budget the routing client decrements, or it is a constant with no mechanism. When `reason === 'event-diagnostic'`, the engine initializes the budget from the hourly allowance instead of `MAX_ROUTE_CALLS_PER_RUN`:

```javascript
// Hour-bucketed counter in User Properties: { "bucket": "2026-08-09T22", "used": 3 }.
// Read and written under the user lock the run already holds, so the
// read-modify-write is serialized without extra machinery.
diagnosticBudgetRemaining(now)
  -> Math.max(0, DIAGNOSTIC_ROUTE_CALLS_PER_HOUR - usedThisHour)

// Engine, when building the run's budget:
const routeBudget = {
  remaining: options.reason === 'event-diagnostic'
    ? diagnosticBudgetRemaining(now)
    : MAX_ROUTE_CALLS_PER_RUN,
};

// After the run (diagnostic reason only): persist what was spent.
recordDiagnosticRouteSpend(initialRemaining - routeBudget.remaining, now);
```

The spend is recorded even though diagnostics are dry runs — the broker calls happened regardless of whether Calendar was written, and the counter exists to bound exactly those calls. A fresh hour bucket resets the allowance; without the ceiling, reopening the card across a day of appointments issues up to 60 attempts per open with no cumulative bound.

#### Where diagnostic routes are cached

The generated-event cache (§13.3) cannot serve this path. Diagnostics are most useful on an event that has *no* companions yet, and diagnostics run as a dry run — so there is no metadata to write into, and creating an event to hold the cache would violate the no-write contract.

Repeated card opens on an unplanned event would therefore call the broker every time.

Diagnostics use a second, ephemeral cache instead:

```javascript
// calculatedAt is stored as-is: RouteResult.calculatedAt is already the
// canonical ISO-8601 string (4.7) -- calling .toISOString() on it would
// throw and the cache would never warm.
CacheService.getUserCache().put(
  routeInputHash,
  JSON.stringify({ secs: rawSeconds, at: calculatedAt }),
  ttlSeconds
);
```

- keyed by the same route input hash, so entries are interchangeable with the generated-event cache;
- TTL bounded by `CacheService`'s own maximum, which is well under `ROUTE_CACHE_MAX_AGE_HOURS`;
- read by both diagnostics and reconciliation, written by both;
- values validated on read exactly as in §13.3 — an ephemeral store is no more trustworthy than a durable one.

#### The calculation time must travel with the duration

Storing only the duration loses `routeAt`, and both ways of recovering it are wrong:

- **Omit the timestamp** when persisting to the durable cache, and the entry is never valid — so the next run after ephemeral eviction calls the broker anyway, and the warming did nothing.
- **Stamp the read time** instead, and a route calculated up to one ephemeral TTL ago is recorded as fresh. The 24-hour reuse rule then measures from the wrong instant, and a duration can survive meaningfully longer than `ROUTE_CACHE_MAX_AGE_HOURS`.

The second is the worse failure, because it silently weakens the freshness bound rather than merely wasting a call.

So the entry carries `{ secs, at }`, and `RouteResult` (§4.7, the single canonical definition) carries `calculatedAt` through to the engine.

`calculatedAt` is what gets written to `routeAt` in the durable cache. A duration is exactly as old as the moment the broker computed it, regardless of how many caches it passed through on the way.

An ephemeral hit reports `source: "ephemeral"`, which the engine treats as "needs persisting" exactly like a broker call (§11.1): the client only reached the ephemeral tier because the durable entry failed validation, so the warmed duration still has to land in the companion's metadata or the next post-eviction run pays the broker again.

This keeps the derived-state invariant intact: flushing it may cost broker calls and can never change Calendar state. It is a cache in front of a cache, which is worth the small complexity only because the alternative is an unbounded per-card-open cost on the one path with no durable place to write.

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

- stop planning new source events — **but first mark every unprocessed source** with a planning outcome of `failed` (`EXECUTION_BUDGET_EXCEEDED`), so the comparator preserves their existing companions;
- apply already-computed safe diffs if sufficient time remains — and the application itself re-checks the budget **between operations**, deferring the remainder (`ApplyResult.deferredOps`, §17.5) rather than trusting one pre-application check to cover an arbitrarily large diff;
- record partial status;
- allow daily or subsequent trigger execution to continue.

Marking the skipped sources is the load-bearing step, not bookkeeping. The observation scan has usually **completed** by the time planning runs out of budget, and §15.2.3's complete-scan rule treats a companion whose parent is absent from `planningOutcomes` as a genuine orphan. Breaking out of the loop with a bare `break` would therefore hand deletion authority over every unplanned source's companions to the very degradation path that exists to protect them — the run would delete travel blocks *because* it ran out of time. `failed` is the outcome that carries no deletion authority (§17.4), which is exactly the semantics of "not evaluated."

### 23.2 Ordering

Process **upcoming events first**: source events starting at or after `now` in ascending start order, then in-progress and lookback events.

Plain ascending start order is wrong now that the window extends backward — it would spend the execution budget on events that have already begun before reaching the appointments the user is about to travel to.

Events **without timestamps sort last**. Ordering runs on normalized events before eligibility, and cancelled tombstones may carry no `start` at all (§8.2) — a naive time comparison against `now` turns those into NaN comparisons and arbitrary sort placement. Last is the correct position, not just a safe one: a tombstone consumes no route budget and no broker call; its only work is yielding deletion intent, which loses nothing by running after the planning that competes for the budget.

### 23.3 Route-call minimization

Route caching is **required for the MVP**. See §13.3 for the cache contract and §21 of the architecture for the rationale.

The essential point is one of ordering: fingerprints are computed *after* routing, so they can only prevent Calendar writes, never broker calls. Cost is driven by trigger frequency, and the calendar trigger fires on calendar changes rather than on a schedule, so without a cache the spend is unbounded by anything the user can observe.

Per-run controls:

```javascript
const MAX_ROUTE_CALLS_PER_RUN = 60;
```

- consult the route cache before every broker call;
- count **HTTP attempts, retries included,** against the per-run ceiling (§11.2) — the shared `RouteBudget` counter is created by the engine and travels through the provider context;
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

The worker, the do-not-stack check, and the counter lifecycle that enforces the cap are specified in §19.6.

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
