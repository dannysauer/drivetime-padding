# Drivetime Padding Requirements Specification

**Document version:** 1.0-draft  
**Project:** Drivetime Padding  
**Status:** Proposed MVP requirements  
**Related documents:** Architecture Book, Technical Design Book

---

## 1. Purpose

This specification defines the functional, user-experience, reliability, security, privacy, performance, operational, and release requirements for the Drivetime Padding minimum viable product.

The document is normative. The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL are to be interpreted as described in RFC 2119. MUST, SHALL and REQUIRED describe behavior mandatory for the release the requirement names — the MVP unless the requirement names a later release, as REQ-PERF-004, REQ-ROUTE-002 and REQ-ROUTE-008 do. SHOULD describes strongly preferred behavior that is deferred only with an explicit decision. MAY describes optional behavior.

Each requirement has a stable `REQ-<AREA>-NNN` identifier. An identifier never changes and is never reused; a requirement that no longer applies is retired in place with a note saying why. No requirement is verified yet, because there is no implementation. The [acceptance scenarios](acceptance-scenarios.md) describe the intended verification and the [traceability matrix](traceability.md) maps requirements to them. When a test or an evidence receipt naming a requirement's identifier exists, the requirement gets a *Verified by* line naming it.

The intended readers are:

- project maintainers;
- implementation engineers;
- reviewers;
- test authors;
- Marketplace reviewers;
- future contributors evaluating whether a change preserves product behavior.

---

## 2. Product Definition

Drivetime Padding is a Google Workspace Marketplace add-on that creates and maintains travel-time events around eligible Google Calendar events.

For each eligible source event, the system calculates driving duration from a selected origin to the event destination and back. It then creates:

1. an outbound event ending at the source event start; and
2. a return event beginning at the source event end.

The generated events are derived state. The source Calendar event remains authoritative.

---

## 3. Product Goals

### REQ-GOAL-001: Automatic travel blocking

The system SHALL automatically create calendar blocks for travel to and from eligible source events.

### REQ-GOAL-002: Minimal user maintenance

After initial configuration, the system SHALL maintain generated events without requiring routine manual cleanup.

### REQ-GOAL-003: Predictable behavior

The system SHALL use explicit source-event fields and configured settings rather than guessing origins, destinations, or intent.

### REQ-GOAL-004: Broad account support

The product SHALL be designed for both consumer Google accounts and Google Workspace accounts, subject to Google API and Marketplace limitations discovered during implementation and review.

### REQ-GOAL-005: Recoverable state

The system SHALL be able to reconstruct generated events from source events and settings without relying on an external event-mapping database.

---

## 4. User Personas

### 4.1 Primary user: individual power user

An individual who manages appointments and work availability in Google Calendar, understands Calendar concepts such as OOO events and locations, and is willing to configure one or more origin addresses.

Typical needs:

- protect travel time around appointments;
- keep colleagues from scheduling over travel;
- avoid manually updating travel blocks when appointments move;
- use home or office as the origin depending on working location;
- override behavior for exceptional events.

### 4.2 Secondary user: Google Workspace employee

An employee whose organization permits Marketplace add-ons and who uses OOO events to communicate temporary unavailability.

Additional concerns:

- organization-level Marketplace restrictions;
- OAuth scope transparency;
- predictable OOO behavior;
- privacy of calendar data.

### 4.3 Maintainer and support operator

A project maintainer responsible for deployment, Maps billing, support, incident diagnosis, and Marketplace compliance.

Needs:

- useful aggregate logs without sensitive event content;
- trigger health information;
- normalized broker errors;
- release and schema migration controls;
- abuse and quota protections.

---

## 5. Primary User Journeys

### 5.1 First-time installation

1. The user installs Drivetime Padding through Google Workspace Marketplace.
2. The user opens the add-on in Google Calendar.
3. The add-on explains required permissions and route-data handling.
4. The user enters a default origin.
5. The user optionally configures home and office origins.
6. The user reviews the default buffer and 60-day window.
7. The user enables automation.
8. The add-on installs or repairs required triggers.
9. The add-on performs an initial dry run or synchronization.
10. The user sees a clear success or remediation message.

### 5.2 Ordinary OOO appointment

1. The user creates a timed OOO event.
2. The user places a destination in the Calendar location field.
3. A Calendar trigger initiates reconciliation.
4. The system selects an origin.
5. The system obtains outbound and return route durations.
6. The system creates two generated OOO events.
7. The generated events appear in the primary calendar.

### 5.3 Appointment rescheduled

1. The user moves the source event.
2. Reconciliation recalculates the desired outbound and return times.
3. Existing generated events are updated, not duplicated.

### 5.4 Appointment cancelled

1. The user deletes or cancels the source event.
2. Reconciliation removes the generated outbound and return events.

### 5.5 Recurring event exception

1. A recurring source event exists within the planning window.
2. The user moves or cancels one occurrence.
3. Only generated events associated with that occurrence are changed or removed.
4. Other occurrences remain correct.

### 5.6 Temporary route failure

1. A source event is eligible and already has generated events.
2. The routing broker temporarily fails.
3. The system records a planning error.
4. Existing generated events are preserved rather than deleted.
5. A later reconciliation retries and corrects state.

---

## 6. Installation and Account Requirements

### REQ-INSTALL-001: Marketplace distribution

The production product SHALL be distributed as a Google Workspace Marketplace add-on.

### REQ-INSTALL-002: Consumer account intent

The product SHALL NOT intentionally depend on an organization-only identity or administration feature unless no technically viable consumer-compatible alternative exists.

### REQ-INSTALL-003: Workspace administration

Documentation SHALL state that Workspace administrators may restrict Marketplace installation or OAuth scopes.

### REQ-INSTALL-004: Primary calendar only

The MVP SHALL manage only the authenticated user's primary calendar.

### REQ-INSTALL-005: Uninstallation and cleanup

The product SHALL provide a documented method to remove generated events. Cleanup MAY be exposed before uninstall, through a dedicated add-on action, or through a documented reinstallation workflow if Marketplace uninstall hooks are insufficient.

Published documentation SHALL NOT state or imply that uninstalling removes generated events. It SHALL instruct users to run cleanup before uninstalling, and SHALL document the reinstall-and-clean recovery path for users who uninstall first.

### REQ-INSTALL-006: Trigger ownership

Installable triggers SHALL be created under the installing user's authorization context.

---

## 7. Configuration Requirements

### REQ-CONFIG-001: Persistent per-user settings

The add-on SHALL persist settings per user using Apps Script User Properties or an equivalent per-user store.

### REQ-CONFIG-002: Settings schema

Stored settings SHALL include a schema version.

### REQ-CONFIG-003: Automatic migration

Older supported settings schemas SHALL be migrated automatically when loaded.

### REQ-CONFIG-004: Enable switch

The user SHALL be able to enable or disable automatic synchronization without deleting settings.

### REQ-CONFIG-005: Default planning window

The default planning window SHALL be 60 days from the current time.

### REQ-CONFIG-006: Configurable planning window

The user SHALL be able to configure the planning window within bounded limits.

Recommended MVP bounds:

- minimum: 7 days;
- maximum: 180 days.

### REQ-CONFIG-007: Default buffer

The default buffer SHALL be configurable in whole minutes.

### REQ-CONFIG-008: Buffer bounds

The default buffer SHALL be validated within a safe bounded range.

Recommended MVP range:

- minimum: 0 minutes;
- maximum: 120 minutes.

### REQ-CONFIG-009: Required default origin

Synchronization SHALL NOT create travel events until a valid default origin is configured.

### REQ-CONFIG-010: Optional home origin

The user MAY configure a home origin.

### REQ-CONFIG-011: Optional office origin

The user MAY configure an office origin.

### REQ-CONFIG-012: Origin types

Each origin SHALL support:

- plain address text; and
- Google Place ID.

### REQ-CONFIG-013: Working-location toggle

The user SHALL be able to enable or disable working-location-based origin selection.

### REQ-CONFIG-014a: No eligible source types

Configuration in which `eligibility.includeOutOfOffice` is false and `eligibility.titlePatternEnabled` is false makes every source event ineligible.

This SHALL NOT be treated as an error, but the UI SHALL surface it, since the resulting behavior is indistinguishable from a malfunction.

### REQ-CONFIG-014: Optional title pattern

The user SHALL be able to enable an optional subject-matching pattern for non-OOO events.

### REQ-CONFIG-006a: Window reduction takes effect

Reducing the planning window SHALL remove generated events that fall beyond the new horizon.

A contracted observation range no longer reads those events, so they cannot be classified as outside-window by the ordinary pass. The implementation SHALL retain a record of the furthest horizon previously used and perform an ownership-filtered cleanup over the vacated span, lowering that record only after the deletions succeed.

Without this, a user who narrows the window sees generated events persist for as long as the original horizon, and the setting appears not to work.

### REQ-CONFIG-015: Pattern validation

The add-on SHALL validate the configured pattern before saving or using it: the pattern SHALL compile, and the cost of matching it SHALL be bounded regardless of the pattern's shape or the title's length — a pattern whose matching cost the add-on cannot bound SHALL be rejected like one that does not compile, with the reason named, and a title beyond the bound the add-on matches SHALL simply not match. The accepted pattern subset that establishes the bound is the Technical Design's (§9.3), defined as an allowlist so that unknown constructs are refused by construction; a disabled pattern is not consulted and not checked.

The runtime offers no regex timeout and matching is synchronous, so a catastrophically backtracking pattern that merely compiles would occupy an execution until the platform killed it — ahead of every budget guard and of status persistence — and the same calendar input would kill every later run.

### REQ-CONFIG-016: Case sensitivity

The title-pattern configuration SHALL define whether matching is case-sensitive. The default SHALL be case-insensitive.

### REQ-CONFIG-017: Safe invalid configuration behavior

Invalid configuration SHALL prevent Calendar writes and SHALL produce a visible diagnostic message. A stored setting that governs eligibility or automation (the enabled flag, the planning window, the eligibility toggles and title pattern, the default origin, the working-location toggle) that is missing or corrupt SHALL be reported as invalid configuration, never silently replaced by its default.

### REQ-CONFIG-018: Settings reset

The settings UI SHALL provide a reset-to-defaults action, with confirmation before destructive replacement. The action SHALL remain available when the stored document is structurally invalid (malformed JSON, an unsupported or corrupt `schemaVersion`, a missing required field), because the technical design (§5.4, §5.5) routes those states to it.

---

## 8. Source Event Eligibility Requirements

### REQ-ELIG-001: Real OOO default

A timed event with Calendar event type `outOfOffice` SHALL be eligible by default when all other required conditions are met.

Eligibility by event type SHALL be governed by the `eligibility.includeOutOfOffice` setting. When that setting is false, a real OOO event SHALL NOT qualify on the strength of its event type alone, and the reason reported SHALL distinguish this from a failed title-pattern match.

A settings field that no evaluation step consults is not a setting; it is a control that silently does nothing.

### REQ-ELIG-002: Pattern-based inclusion

When optional title-pattern matching is enabled, an ordinary event whose summary matches the pattern SHALL be eligible when all other required conditions are met. A summary longer than the bound REQ-CONFIG-015 places on matching SHALL NOT match — it is reported as too long, never truncated and matched — because a cut would manufacture anchors and word boundaries the real title lacks.

"Ordinary" is enforced by a type gate ahead of pattern matching: pattern matching SHALL be consulted only for `default` and `outOfOffice` event types. Every other Calendar event type (`focusTime`, `workingLocation`, `birthday`, `fromGmail`) SHALL be rejected as `UNSUPPORTED_EVENT_TYPE` before pattern matching is consulted, even when timed, located, and pattern-matching.

### REQ-ELIG-003: All-day exclusion

Events represented with date-only start/end values SHALL be ineligible.

### REQ-ELIG-004: Location required

An event SHALL be ineligible when its Calendar `location` field is empty or missing.

### REQ-ELIG-005: Generated-event exclusion

An event marked as generated by Drivetime Padding SHALL never be treated as a source event.

### REQ-ELIG-006: Per-event disable

A recognized `off` directive SHALL make the source event ineligible.

### REQ-ELIG-007: Planning-window inclusion

Only source events intersecting the active planning window SHALL be considered for generation.

### REQ-ELIG-008: Cancelled-event exclusion

Cancelled events SHALL NOT produce desired generated events.

### REQ-ELIG-009: Eligibility diagnostics

The system SHALL be able to state a specific reason when an event is ineligible.

Minimum reason categories:

- generated event;
- all-day event;
- missing location;
- disabled by directive;
- neither real OOO nor pattern match;
- outside planning window;
- cancelled event;
- invalid configuration.

### REQ-ELIG-010: Ordinary event type preservation

A pattern-matched ordinary event SHALL produce ordinary generated events rather than OOO generated events.

### REQ-ELIG-011: OOO type preservation

A real OOO source event SHALL produce real OOO generated events if supported by the Calendar API behavior validated during implementation.

If the API cannot reliably create the required event type, the implementation SHALL document the limitation and obtain an explicit product decision before release.

---

## 9. Destination Requirements

### REQ-DEST-001: Location field only

The destination SHALL come only from the source event's Calendar `location` field.

### REQ-ELIG-012: Title matching uses the raw summary

Title-pattern matching SHALL be performed against the source event's summary exactly as Calendar returned it.

Any display fallback substituted for a blank summary SHALL NOT participate in eligibility, so that an event whose title was never set cannot be matched by a pattern that happens to match the fallback text.

### REQ-DEST-002: No description inference

The system SHALL NOT infer a destination from the event description.

### REQ-DEST-003: No attendee inference

The system SHALL NOT infer a destination from attendees, organizer details, or contact addresses.

### REQ-DEST-004: No conferencing inference

The system SHALL NOT infer a destination from Google Meet or other conferencing data.

### REQ-DEST-005: Unresolvable destination

When the routing service cannot resolve the destination, the system SHALL report a planning error and SHALL NOT create travel events using a guessed duration.

---

## 10. Origin Resolution Requirements

### REQ-ORIGIN-001: Deterministic priority

The system SHALL choose origin using this priority:

1. recognized per-event origin override;
2. matching working-location state when enabled;
3. configured default origin.

### REQ-ORIGIN-002: Per-event choices

The MVP SHALL recognize per-event origin values:

- `home`;
- `office`;
- `default`.

### REQ-ORIGIN-003: Missing selected origin fallback

If a selected home or office origin is not configured, the system SHALL fall back to the default origin.

### REQ-ORIGIN-004: Missing default origin

If the default origin is unavailable, planning SHALL fail without creating or deleting generated events for otherwise eligible sources.

### REQ-ORIGIN-005: Working-location overlap

Working-location selection SHALL use a working-location event applicable to the source event's time. An all-day working-location event SHALL apply to that day as the user's calendar defines it — midnight to midnight in the calendar's time zone — not to a UTC day.

### REQ-ORIGIN-006: Unsupported working location

Unsupported or ambiguous working-location types SHALL fall back to the default origin.

### REQ-ORIGIN-007: Same return endpoint

The return route SHALL end at the same effective origin selected for the outbound route.

### REQ-ORIGIN-008: Visible effective origin

Event diagnostics SHALL show whether the effective origin came from an override, home working location, office working location, or default fallback.

---

## 11. Buffer and Timing Requirements

### REQ-TIME-001: Outbound duration

Outbound generated-event duration SHALL equal outbound route duration plus the effective buffer.

### REQ-TIME-002: Return duration

Return generated-event duration SHALL equal return route duration plus the effective buffer.

### REQ-TIME-003: Outbound alignment

The outbound generated event SHALL end exactly at the source event start.

### REQ-TIME-004: Return alignment

The return generated event SHALL begin exactly at the source event end.

### REQ-TIME-005: Independent route calculations

The MVP SHALL permit outbound and return durations to differ.

### REQ-TIME-006: Overlap allowed

The system SHALL create generated events even when they overlap other calendar events.

### REQ-TIME-007: Per-event buffer override

A recognized per-event buffer directive SHALL replace the configured default buffer for that source event.

### REQ-TIME-008: Buffer units

Buffer values SHALL be interpreted as whole minutes.

### REQ-TIME-009: Invalid buffer directive

An invalid buffer directive SHALL be ignored and surfaced as a non-fatal diagnostic warning.

### REQ-TIME-010: Time zones

Generated event start and end values SHALL preserve the correct absolute times and Calendar time-zone semantics of the source event.

### REQ-TIME-011: Reconciliation lookback

The reconciliation read window SHALL extend backward from the current time by at least the maximum supported travel duration plus the maximum configurable buffer.

Source events that have already started SHALL continue to be planned while any part of their padding remains in the future. They SHALL NOT be excluded from desired state, because doing so would orphan and delete their still-required return blocks.

Planning eligibility SHALL be determined by temporal intersection with the planning range, not by source start time alone. A source that began before the lookback but is still running remains eligible.

### REQ-TIME-014: Observation range completeness

The range used to read generated events SHALL be wide enough that every companion event of every planned source event is observed.

Because outbound blocks begin before their source and return blocks end after it, and because the Calendar API bounds start and end times asymmetrically, a single window leaks at both edges and causes repeated duplicate creation.

Timed source events longer than `MAX_SOURCE_DURATION_MINUTES` SHALL be ineligible, so that the observation range remains finite.

### REQ-TIME-012: Maximum supported travel

The product SHALL define a maximum supported one-way travel duration, initially six hours.

A route exceeding it SHALL produce an explicit user-visible diagnostic and no generated events, SHALL be treated as a planning failure rather than ineligibility, and SHALL NOT cause deletion of existing generated events.

### REQ-TIME-013: Daily maintenance hour

Scheduled reconciliation SHALL occur at a time appropriate to the user's own Calendar time zone.

The script project time zone SHALL NOT determine when a user's daily reconciliation runs.

The schedule SHALL re-derive itself after a daylight-saving transition or a change to the user's Calendar time zone **without user action**, converging on the intended local hour within one daily cycle — two when the daily firing collides with another execution holding the user lock, the same collision that already defers the daily run's own work: each daily run recomputes the hour and trigger repair replaces a daily trigger whose installed hour no longer matches.

---

## 12. Per-Event Directive Requirements

### REQ-DIRECTIVE-001: Description parsing

Directives SHALL be parsed only from the source event description.

### REQ-DIRECTIVE-002: Line-oriented grammar

Each directive SHALL occupy one logical line. Descriptions stored as HTML (as the Calendar web UI stores them) SHALL be converted to plain text before parsing, with `<br>` and block-element boundaries as line breaks, other tags removed, and entities decoded, so a directive typed on its own line in any Calendar client is recognized. Only text of HTML-tag shape with a known tag name on one line counts as a tag; a plain-text description containing a literal `<` or `>` SHALL keep that text and every line around it, so no directive is lost to tag removal.

### REQ-DIRECTIVE-003: Case-insensitive keywords

Directive keywords SHALL be case-insensitive.

### REQ-DIRECTIVE-004: Disable grammar

The following form SHALL disable generation:

```text
drivetime padding: off
```

### REQ-DIRECTIVE-005: Buffer grammar

The following form SHALL override the buffer:

```text
drivetime padding: buffer=10m
```

### REQ-DIRECTIVE-006: Buffer shorthand

The MVP MAY support:

```text
drivetime padding +7m
```

When supported, it SHALL replace rather than add to the default buffer.

### REQ-DIRECTIVE-007: Origin grammar

The following forms SHALL be recognized:

```text
drivetime padding: origin=home
drivetime padding: origin=office
drivetime padding: origin=default
```

### REQ-DIRECTIVE-008: Unknown directives

Unknown directive forms SHALL NOT make the entire event fail. A line that begins with the `drivetime padding` prefix but matches no directive form SHALL be ignored and surfaced as a non-fatal diagnostic warning.

### REQ-DIRECTIVE-009: Provider isolation

The routing and event-generation components SHALL consume parsed directives rather than parsing raw descriptions themselves.

---

## 13. Routing Requirements

### REQ-ROUTE-001: Driving only

The MVP SHALL request driving routes only.

### REQ-ROUTE-002: Broker usage

Production Marketplace releases SHALL obtain route calculations through a controlled backend rather than embedding a shared Maps credential in Apps Script.

### REQ-ROUTE-003: Minimum route response

The broker SHALL return at least:

- duration in seconds;
- distance in meters, when available.

### REQ-ROUTE-004: Direction-specific requests

The system SHALL be able to request:

- origin to destination; and
- destination to origin.

### REQ-ROUTE-011: Uniform endpoint representation

Both ends of every route request SHALL carry an explicit endpoint type (address or Place ID) in both travel directions.

The return route swaps the endpoints of the outbound route. A representation that types only the origin would, in the return direction, lose whether the configured origin is a Place ID — degrading a precise place reference into address parsing, or failing outright.

### REQ-ROUTE-005: No guessed fallback

A failed route lookup SHALL NOT silently fall back to a fixed or guessed duration in production.

### REQ-ROUTE-006: Normalized errors

The broker SHALL expose stable application-level error codes rather than raw upstream Maps errors.

### REQ-ROUTE-007: Data minimization

Broker requests SHALL NOT include source-event summaries, descriptions, attendees, calendar IDs, or recurrence rules.

### REQ-ROUTE-008: Authentication

The public-production broker SHALL authenticate requests using a mechanism suitable for a Marketplace-distributed client.

A single long-lived secret embedded in distributed client code SHALL NOT be considered sufficient for public production.

### REQ-ROUTE-009: Quota protection

The broker SHALL include controls capable of limiting abuse and excessive cost.

### REQ-ROUTE-010: Logging privacy

The broker SHALL NOT log raw origin and destination values by default.

---

## 14. Generated Event Requirements

### REQ-GEN-001: Exactly two generated events

For a successfully planned MVP drivetime source event, the desired state SHALL contain one outbound and one return event — **except** that a role whose quantized route duration plus effective buffer is zero SHALL contain no event for that role (Technical Design §12.5, AC-OOO-012), and that a role whose computed span has already ended, with no undisplaced companion at the same anchor observed for it, SHALL contain no event for that role either (Technical Design §12.5's ended rule, AC-OOO-013). Calendar rejects zero-length events, so mandating the pair unconditionally would force either a requirement violation or an insert that can never succeed; and creating a travel block that is already over documents no trip and only clutters the calendar's past.

### REQ-GEN-002: Predictable subjects

Generated-event summaries SHALL use a predictable, human-readable prefix.

Recommended default:

```text
[Drivetime Padding]
```

### REQ-GEN-003: Outbound summary

The outbound summary SHOULD communicate travel to the source event.

### REQ-GEN-004: Return summary

The return summary SHOULD communicate return from the source event.

### REQ-GEN-005: No attendees

Generated events SHALL NOT copy source-event attendees.

### REQ-GEN-006: No conferencing

Generated events SHALL NOT copy conference data.

### REQ-GEN-007: No attachments

Generated events SHALL NOT copy attachments.

### REQ-GEN-008: No guest notifications

Creating or updating generated events SHALL NOT send source-event guest notifications.

### REQ-GEN-009: Source description not copied

Generated events SHALL NOT copy the source event description by default.

### REQ-GEN-009a: Reminder suppression

Generated events SHALL NOT carry reminders, so that travel blocks do not produce alerts of their own.

Suppression SHALL be maintained rather than applied only at creation: see REQ-GEN-014b.

### REQ-GEN-010: Private metadata

Generated events SHALL contain private extended properties sufficient to identify ownership, source linkage, role, schema, and fingerprint.

### REQ-GEN-011: Metadata authority

The system SHALL identify managed events through private metadata, not title text.

### REQ-GEN-012: Stable role values

The MVP role values SHALL be:

- `outbound`;
- `return`.

### REQ-GEN-013: Manual deletion recovery

If a managed generated event is manually deleted while its source remains eligible, a later reconciliation SHALL recreate it — unless its role's computed span has already ended by then, in which case nothing is recreated (REQ-GEN-001's ended exception; Technical Design §12.5): a deleted block for a trip already over is not restored as a past-dated event.

### REQ-GEN-014a: Owned-field verification

Reconciliation SHALL compare the observed generated event's owned fields against the desired specification, and SHALL NOT treat a matching stored fingerprint as sufficient evidence that the event is correct.

A manually moved, resized, or renamed generated event retains its private metadata, so its stored fingerprint still matches. Restoration therefore depends on comparing the fields themselves.

Start and end times SHALL be compared as instants, not as text: the same instant written with a different UTC offset or format — as Calendar returns it in the calendar's own time zone — is a match, not a difference to restore.

### REQ-GEN-014: Manual modification recovery

If a managed generated event is manually moved, resized, or renamed, a later reconciliation SHALL restore desired state.

### REQ-GEN-014b: Owned fields include reminders

Reminder state on generated events SHALL be compared and restored along with the other owned fields.

Reminder suppression (REQ-GEN-009a) is a maintained property, not a creation-time gesture. A field the system writes but never compares can be changed permanently by the user without reconciliation noticing.

### REQ-GEN-014c: Owned fields include out-of-office properties

The auto-decline behavior on generated out-of-office events SHALL be compared and restored along with the other owned fields.

Generated OOO blocks promise not to decline unrelated meetings (REQ-ELIG-011). A user-flipped auto-decline mode that reconciliation never re-examines would break that promise permanently — the same one-time-gesture failure REQ-GEN-014b closes for reminders.

### REQ-GEN-015: Removed metadata safety

An event with no recognizable Drivetime Padding metadata SHALL NOT be deleted based only on its title.

Deletion SHALL verify the ownership marker at the moment of deletion, not only at the moment the event was read. Concurrent Calendar edits are not serialized by the add-on's own locking, so an event can lose its marker between read and write.

### REQ-GEN-016: Cleanup when ineligible

When a previously eligible source becomes definitively ineligible, its managed generated events SHALL be deleted — except a companion that is a concluded record of a trip already taken (an ended, undisplaced companion whose anchor has passed), which is preserved as history under REQ-RECON-009's record rule, as on every absence-of-desire deletion path.

### REQ-GEN-017: Preserve on planning failure

When a source remains eligible but desired-state calculation fails transiently, existing generated events SHALL be preserved.

---

## 15. Metadata and Fingerprint Requirements

### REQ-META-001: Ownership marker

Generated metadata SHALL include an application ownership marker.

### REQ-META-002: Metadata schema

Generated metadata SHALL include a schema version.

### REQ-META-003: Parent linkage

Generated metadata SHALL include the source instance event ID.

### REQ-META-004: Role

Generated metadata SHALL include the generated-event role.

### REQ-META-005: Fingerprint

Generated metadata SHALL include a deterministic fingerprint of all inputs that affect generated Calendar state.

Fingerprint inputs SHALL be role-specific. A fingerprint SHALL NOT include a source boundary that cannot affect the companion it identifies, because doing so would force writes to events that are already correct and violate REQ-RECON-007.

### REQ-META-006: Optional recurrence diagnostics

Metadata SHOULD include source `iCalUID` and original start when useful for diagnosing recurring instances.

### REQ-META-007: Canonical serialization

Fingerprint input SHALL be canonically serialized before hashing.

### REQ-META-008: Hash algorithm

The MVP SHALL use SHA-256 or an equivalently stable available hash.

### REQ-META-009: No-write match

When the desired and observed fingerprints match **and** the observed event's owned fields match the desired specification, reconciliation SHALL NOT update the generated event.

A matching fingerprint alone is not sufficient grounds to skip a write. Calendar preserves private metadata through a user edit, so a moved, resized, or renamed generated event still carries a matching fingerprint while sitting in the wrong place. Skipping the write in that case would forbid the restoration REQ-GEN-014 and REQ-GEN-014a require.

Refreshing an expired route cache entry is a metadata patch rather than an update, and is permitted under this requirement (REQ-PERF-014).

### REQ-META-010: Unknown metadata preservation

Updates SHOULD preserve unrecognized private metadata keys where doing so does not compromise ownership or schema correctness.

---

## 16. Recurring Event Requirements

### REQ-RECURRENCE-001: Instance expansion

Recurring source events SHALL be expanded into concrete instances within the planning window.

### REQ-RECURRENCE-002: One-off generated companions

Generated outbound and return events SHALL be non-recurring events linked to individual source instances.

### REQ-RECURRENCE-003: Moved instance

Moving one recurring instance SHALL update only that instance's generated companions.

### REQ-RECURRENCE-004: Cancelled instance

Cancelling one recurring instance SHALL remove only that instance's generated companions.

### REQ-RECURRENCE-005: Location exception

Changing the location of one recurring instance SHALL recalculate only that instance's routes and generated events.

### REQ-RECURRENCE-006: Series split

A "this and following" edit SHALL be handled through the concrete instances returned by Calendar without maintaining a mirrored recurrence graph.

### REQ-RECURRENCE-007: Window advancement

The daily scheduled reconciliation SHALL create generated events for newly visible future instances as the rolling window advances.

### REQ-RECURRENCE-008: No indefinite pre-generation

The system SHALL NOT generate companion events indefinitely beyond the configured planning window.

---

## 17. Reconciliation Requirements

### REQ-RECON-001: Desired-state model

The system SHALL reconcile desired generated-event state against observed managed events.

### REQ-RECON-002: Trigger independence

The reconciliation algorithm SHALL NOT require the identity of the event that caused the trigger.

### REQ-RECON-003: Idempotency

Repeated reconciliation with unchanged inputs SHALL produce no additional Calendar changes.

### REQ-RECON-004: Bounded scope

Each ordinary reconciliation SHALL operate within the configured planning window.

### REQ-RECON-005: Locking

Only one reconciliation SHALL modify a given user's calendar at a time.

### REQ-RECON-006: Lock contention

When the user lock cannot be acquired within a short bounded interval, the run SHALL exit safely without Calendar writes.

### REQ-RECON-007: Minimal writes

The engine SHALL classify managed events into create, update, delete, and ignore operations and apply only necessary writes.

### REQ-RECON-008: Partial failure recovery

The system SHALL rely on later reconciliation to repair partial writes rather than requiring transactional rollback across Calendar events.

### REQ-RECON-009: Orphan cleanup

Managed generated events with no desired eligible source SHALL be deleted, except when desired-state planning for the source failed transiently, and except concluded records of a trip (below), which no absence-of-desire path deletes.

A generated event whose source event is absent from a **complete** scan SHALL be treated as orphaned and deleted. A generated event whose source is absent from an **incomplete** scan SHALL be preserved unless per-event evidence proves deletion safe (REQ-RECON-013): the incomplete scan itself establishes only that the source was not reached, not that it is gone, but an individual point read can establish either its absence or that it desires no companion.

Preservation SHALL NOT be extended to every unevaluated parent. Doing so would strand generated events whose source moved outside the read range, leaving stale travel blocks that age out of view without ever being removed.

Deletion authority stops at the past: a companion that has already ended, whose anchor instant has itself passed (a block anchored to a meeting still ahead is live state however far into the past it was dragged, and is restored rather than frozen), and that still sits where its persisted anchor placed it is a **record of a trip** — preserved by every absence-of-desire deletion path (orphan cleanup and ineligible-parent cleanup included) and left unmodified while the desired specification remains anchored to the recorded occurrence **and the recorded role is not provably still live** (a record whose role is still wanted live — the return block of a meeting that ended moments ago, dragged into the past — is restored, not frozen): later edits to the ended source, refreshed route estimates, and setting changes do not rewrite what the trip was. A source *rescheduled* to a future occurrence stops matching its old records entirely — the new occurrence receives fresh companions while the records remain — and duplicate convergence never collapses a record against the new occurrence's block (it still collapses redundant live copies, and redundant records of one trip). The remove-all action deletes records too. The planning lookback is hours while the observation margin is over a day, so without this rule every travel block would be erased within a day of the trip and no history would ever age out. A *displaced* past companion (moved from its anchor) remains deletable stale state.

### REQ-RECON-013: Absence-based writes require complete evidence

Orphan deletions SHALL be performed only on complete evidence: a complete observation scan that did not contain the parent, or — on an incomplete scan — an individual point read proving the parent absent or cancelled, or a fetched live parent that route-free evaluation (planning-window overlap, eligibility, the desired role set) proves desires no companion for the key — or, for a desired role, a candidate that is not the parent's undisplaced same-anchor block and whose desired span has provably ended route-free (a stale block the parent's own planning will never emit a spec for — a same-anchor block moved off its anchor's span included); a live parent still desiring the key, or a point read that did not run, preserves the companion for that run — and a concluded record is preserved regardless of the evidence (REQ-RECON-009). Creates SHALL be performed only after an individually complete companion lookup for the parent (the REQ-RECON-016 lookup) found no existing companion for the desired key — evidence that is complete for that parent regardless of scan coverage; a create whose lookup did not run SHALL be withheld.

Both operations act on absence, and a truncated scan can cut between a source event and its own companion — planning the source while its existing companion sits on an unretrieved page. The per-parent lookup finds that companion and restores it — an update ordinarily, a replacement when an immutable field such as `eventType` differs — and the per-parent point read distinguishes a genuinely deleted parent from one merely unread — which together make creation and cleanup progress possible on calendars too large for any single scan. Evaluating the fetched live parent is part of the same guarantee: it is what removes a stale companion even when pagination forever splits it from a live source that no longer desires it. Operations based on events actually read (updates, metadata patches) MAY proceed.

### REQ-RECON-010: Dry-run support

The engine SHALL support a mode that computes eligibility, desired state, and the diff without applying Calendar writes.

### REQ-RECON-011: Shared execution path

Calendar-trigger, daily-trigger, manual-sync, and dry-run commands SHALL reuse the same reconciliation core.

### REQ-RECON-012: Run status

Each run SHALL produce a structured result containing at least:

- status;
- source events checked;
- eligible events;
- created count;
- updated count;
- metadata-patch count;
- replaced count;
- deleted count;
- ignored count;
- failed-write count;
- deferred-operation count;
- error count;
- start and completion timestamps.

Write counts SHALL reflect operations Calendar **accepted**, taken from the diff application result, not operations the diff proposed. One status rule governs every non-dry run that reaches result building (Technical Design §17.5): the run reports `partial` when its observation scan was incomplete (every resumed scan-chain slice included), when it withheld creates or deletes for want of per-event evidence, when a write failed, when an operation was deferred, when application was skipped for time, or when a retryable planning failure left a source unprocessed — and `success` only when none of these holds. A run with one or more failed writes SHALL NOT report success (REQ-ERROR-006); it reports `partial` even when no write was accepted, because `failed` is reserved for runs that never reached application (invalid settings, a rejected invocation, a run-wide failure), and a run with deferred work MUST keep its continuation. A run in which no application ran — a dry run, a failure before application, or a write run out of time before applying — carries a null application summary in its result; when persisted, the stored record's applied, failed-write, and deferred-operation counts are zero, with the status carrying the explanation (the out-of-time case is `partial` with zero counts and no errors — the continuation reschedules it). Dry runs report proposal counts, marked as such, and SHALL NOT overwrite the stored last-run record.

### REQ-RECON-014: Event type changes are applied by replacement

When a generated event's desired `eventType` differs from its observed `eventType`, reconciliation SHALL delete the observed event and create a new one from the desired specification, rather than patching the type.

Calendar declares `eventType` immutable after creation. Folding the difference into an update produces a patch that fails identically on every reconciliation, leaving the companion permanently in the wrong state. The type remains a compared owned field; replacement is its write path.

### REQ-RECON-015: Companions of overlong sources are located outside the window

When an ineligible source event's observed duration exceeds `MAX_SOURCE_DURATION_MINUTES` — regardless of its ineligibility reason — and either companion role is missing from the observed index, reconciliation SHALL locate its companions by ownership and parent metadata without time bounds, and delete them — except concluded records (REQ-RECON-009): a companion that has ended, whose anchor has passed, and that still sits where its anchor placed it documents a trip that happened, and the source growing overlong afterward does not un-happen it. A lookup that found nothing to delete SHALL NOT be repeated while the source is unchanged since that lookup (the same Calendar version): an overlong source is always ineligible, so no companion can be generated for it until it is edited, and an ordinary multi-day all-day event, which never had companions, SHALL cost one lookup per version rather than one per run.

The observation range's completeness guarantee assumes sources respect the duration cap. A source edited past the cap after planning keeps itself readable while its companions fall behind `observeStart` permanently; only a targeted lookup can reach them. The trigger is the duration, not the classification: a multi-day all-day conversion strands companions identically but is classified `ALL_DAY_EVENT` before the duration test runs. The gate is "either role missing" rather than "no companions observed" so a half-stranded pair does not wait an extra run for cleanup.

### REQ-RECON-016: Companions moved outside the window are restored, not duplicated

Before creating a generated event for a desired key with no observed match, reconciliation SHALL look up managed companions for that parent without time bounds; a managed event matching the absent key SHALL be restored to the desired specification instead of a new event being created — an update ordinarily, or a replacement (delete the recovered event, let the create proceed) when an immutable field such as `eventType` differs, since an update patch could never realign such a field and would be rejected on every run (REQ-RECON-013). Provably concluded records — valid anchor, undisplaced, ended — are treated by this lookup exactly as they would be if observed beside their parent (REQ-RECON-009): a record of a different occurrence is passed over — restoring a past trip's record to a rescheduled occurrence's time would rewrite history, so the create proceeds and the record stays — while a record of the same occurrence is restored when the role is provably still live (the return block of a meeting that ended moments ago, dragged into the past) and otherwise left as it is with no block created beside it; an anchorless ended match still restores normally, its metadata rewritten. When the lookup returns several companions for the one key, exactly one is restored (or, for a same-occurrence record left as it is, none — and of several same-occurrence records only the canonical one is left, the others being redundant copies of the same trip) — the one duplicate convergence (Technical Design §13.5's canonical choice) would keep had they been observed together — and every other match is deleted as a duplicate, except a record kept as history (a record of another occurrence, or a preserved record that is not a redundant copy of the kept one), so the lookup never leaves two blocks for one key or a copy stranded beyond observation.

A complete window scan cannot see a companion the user dragged beyond the observation range. A blind create manufactures a permanent duplicate and abandons the moved event, violating the manual-move restoration guarantee (REQ-GEN-014).

### REQ-RECON-017: Companions of unplanned sources are swept from outside the window

The daily maintenance run SHALL discover managed events outside the observation range whose persisted source anchor lies within the **maximal** planning band — from the current lookback (slacked by the source duration cap plus a discovery margin covering the interval between daily firings) out to the largest configurable horizon *plus the source duration cap* — a return companion of a maximal source starting at the horizon's edge anchors a full duration beyond it — and not merely the currently configured horizon, so that a window shrink cannot hide a stray dragged beyond the old one — and SHALL delete those whose parent, established by a point read, is absent or cancelled (concluded records excepted, REQ-RECON-009 — deleting a past meeting does not un-happen the trip) — and those whose parent is live but outside the planning range, or ineligible, **when the candidate is displaced from its persisted anchor** (observed outside the anchor's companion span): displacement is what distinguishes a moved stray from a companion that aged out of the window naturally, which SHALL be preserved as calendar history however recently it was patched. Companions of planned parents SHALL be left to the restoration path unless an in-window event already satisfies their key **and the candidate is not a concluded record** (after a reschedule the past trip's record shares the key with the new occurrence's block by design; only a displaced duplicate is stranded redundancy) — a record of a different occurrence satisfies no key, and the sweep SHALL never delete an event the same run is restoring; companions of failed parents SHALL be preserved.

REQ-RECON-016's restoration is driven by a pending create, which requires a live parent planning inside the window. Deleting the source — or moving it out of the window along with its companion — leaves nothing pending and the stray invisible to the bounded scan; without a discovery pass independent of desired state, and one that decides on the parent's *state* rather than bare existence, the stray persists forever, in violation of REQ-RECON-009. The anchor selection is what bounds the sweep's cost: historical companions whose parents simply aged out are excluded without any per-event lookup.

---

## 18. Trigger Requirements

### REQ-TRIGGER-001: Calendar trigger

The add-on SHALL install an event-update trigger for the primary calendar.

### REQ-TRIGGER-002: Daily repair trigger

The add-on SHALL install a daily time-based reconciliation trigger.

The daily run is the product's eventual-consistency guarantee. Regardless of missed triggers, partial writes, transient broker failures, or manual edits, a correct state SHALL be reached within one daily cycle without user intervention.

Work deferred by the per-run route ceiling is excluded from the one-cycle bound. A run that ends `partial` SHALL schedule a continuation whenever a further pass can still make progress on its remaining work — deferred writes, an application skipped for time, a productively spent route budget (REQ-PERF-013), an unfinished scan, or planning or lookups cut short — so that convergence remains a function of the deferred work rather than of the daily schedule. A run left `partial` only by failures a further pass would meet unchanged — an event that fails deterministically, a broker outage or rejected credential with no productive attempt, or rejected writes — schedules no continuation; it reports what remains, and the next run of any kind retries it. Where continuation is unavailable, the bound is one daily cycle per `MAX_ROUTE_CALLS_PER_RUN` units of deferred work.

Calendars whose observation range exceeds a single execution budget are bounded separately: reconciliation there proceeds through a resumable scan chain, and a daily run that finds an unfinished chain pending SHALL resume it rather than scan fresh — overwriting the chain would starve the calendar's tail permanently. In the compound-failure case where a truncated run's continuation could not be scheduled and its cursor waits for the daily run, that day's fresh-window pass — and, where a complete scan is achievable, the orphan sweep — defer until the chain completes: the bound for that work is one daily cycle after chain completion in every case — measured from the original deferral, that is two daily cycles total when the resumed chain finishes within the day's continuation allowance, and proportionally later for a chain that genuinely needs multiple days. (On calendars where no scan can ever complete, the sweep is excluded outright as the design's accepted residual; it is not covered by this bound.) Each daily cycle advances the chain by at least one slice — save when a rare window-shrink backlog transiently consumes the shared read region, a deferral that drains itself as the backlog's own deletions apply — and by a full day's allowance whenever continuations can be scheduled; under a persistently exhausted trigger quota the daily runs alone carry the chain, one slice per cycle. Re-reading a slice whose work was starved before the chain moves past it is bounded: it continues only while each re-read makes progress, for at most a fixed number of consecutive runs at one position, and never in place of the daily run's advance — so sources whose routes fail deterministically can never hold the chain.

### REQ-TRIGGER-003: Duplicate prevention

Trigger repair SHALL remove or otherwise resolve duplicate Drivetime Padding triggers.

### REQ-TRIGGER-004: Missing trigger repair

The user SHALL have an action to create missing required triggers.

### REQ-TRIGGER-005: Trigger health display

The UI SHALL display whether required triggers are present.

### REQ-TRIGGER-006: Same reconciliation logic

Both trigger types SHALL invoke the same reconciliation implementation.

### REQ-TRIGGER-007: Permission failure visibility

If trigger installation fails due to authorization or policy, the UI SHALL present a clear remediation message.

---

## 19. User Interface Requirements

### 19.1 Home card

### REQ-UI-001: Enabled status

The home card SHALL show whether automation is enabled.

### REQ-UI-002: Core settings summary

The home card SHALL show at least:

- planning window;
- default buffer;
- whether a default origin is configured;
- optional pattern enabled/disabled.

### REQ-UI-003: Synchronize action

The home card SHALL provide a manual synchronization action.

### REQ-UI-004: Settings navigation

The home card SHALL provide access to settings.

### REQ-UI-005: Trigger repair action

The home card SHALL provide an automation repair action.

### REQ-UI-006: Last-run status

The home card SHALL display the last known run status and timestamp.

### 19.2 Settings card

### REQ-UI-007: General settings

The settings UI SHALL expose:

- enable/disable;
- planning-window days;
- default buffer minutes.

### REQ-UI-008: Origin settings

The settings UI SHALL expose default, home, and office origin values and origin types.

### REQ-UI-009: Eligibility settings

The settings UI SHALL expose optional title-pattern enablement and value.

### REQ-UI-010: Working-location setting

The settings UI SHALL expose working-location-based origin selection.

### REQ-UI-011: Validation feedback

Settings validation errors SHALL be shown near the relevant control or in a clear summary.

### 19.3 Event diagnostic card

### REQ-UI-012: Eligibility status

When an event is opened, the add-on SHALL show whether the event is eligible.

**Exception:** while another reconciliation holds the user lock, no eligibility answer exists to show; the card SHALL state that a synchronization is in progress and invite reopening, never render blank. The same never-blank rule applies to failed runs, which render their errors.

### REQ-UI-013: Ineligibility reason

For ineligible events, the add-on SHALL show the reason.

### REQ-UI-014: Effective calculation

For eligible events, the diagnostic card SHOULD show:

- selected origin category;
- destination;
- outbound duration;
- return duration;
- effective buffer;
- desired outbound start/end;
- desired return start/end.

### REQ-UI-015: No-write diagnostic

Opening or refreshing diagnostics SHALL NOT write generated events unless the user explicitly invokes synchronization.

### REQ-UI-016: Mobile limitation documentation

If Google does not support the add-on UI in mobile Calendar clients, Marketplace and support documentation SHALL state that limitation clearly while noting that installed automation still runs server-side.

### REQ-UI-017: Manual synchronization is asynchronous

The "Synchronize now" action SHALL enqueue reconciliation and return within the CardService callback budget, rather than running the full window inline.

An inline run succeeds only on calendars small enough not to need it. The action reports that synchronization has started; completion surfaces through the stored last-run record. The enqueue mechanism shares the one-off trigger machinery of partial-run continuations and is subject to Prototype Spike 1.

---

## 20. Error and Recovery Requirements

### REQ-ERROR-001: Error categories

The application SHALL distinguish at least:

- configuration error;
- Calendar read error;
- Calendar write error;
- route input error;
- route no-result error;
- broker authentication error;
- route quota/rate-limit error;
- transient backend error;
- lock contention;
- unexpected internal error.

### REQ-ERROR-002: User-safe messages

User-visible messages SHALL explain the likely remediation without exposing stack traces or secrets.

### REQ-ERROR-003: No destructive response to transient planning error

A transient route or planning failure SHALL NOT cause deletion of existing generated events for the affected source.

### REQ-ERROR-004: Failed source isolation

Failure to plan one source event SHOULD NOT prevent reconciliation of unrelated source events unless the failure indicates a global condition such as invalid settings or Calendar authorization loss.

### REQ-ERROR-005: Automatic retry

Later Calendar, daily, or manual synchronization SHALL retry recoverable failures.

### REQ-ERROR-006: No fabricated success

The UI SHALL NOT report synchronization success when one or more required operations failed.

### REQ-ERROR-007: Partial-success result

The run-result model SHALL support partial success with error counts and summaries.

---

## 21. Security Requirements

### REQ-SEC-001: Least practical OAuth access

The project SHALL request only OAuth scopes required for documented behavior.

### REQ-SEC-002a: Scope selection is an architectural decision

The OAuth scope set SHALL be selected deliberately, recorded in an ADR, and verified against Google's current published scope classification before implementation.

No scope SHALL be added speculatively to support an undecided mechanism. In particular `openid` SHALL NOT appear in the manifest until broker authentication is selected.

### REQ-SEC-002: Explicit scopes

OAuth scopes SHALL be explicitly declared in the Apps Script manifest.

### REQ-SEC-003: Secret storage

Maps credentials and production broker secrets SHALL be stored in Secret Manager or an equivalent protected server-side secret store.

### REQ-SEC-004: No Maps key in distributed source

The production Maps API key SHALL NOT be embedded in Apps Script source or user-visible configuration.

### REQ-SEC-005: Input validation

The broker SHALL validate request structure, size, supported origin types, and travel mode.

### REQ-SEC-006: Abuse controls

The broker SHALL support rate limits, quotas, or equivalent safeguards against uncontrolled Maps cost.

### REQ-SEC-007: Authentication failure handling

Unauthenticated or invalid requests SHALL be rejected without invoking Maps.

### REQ-SEC-008: No unsafe HTML

User-derived event text displayed in CardService UI SHALL be escaped or handled using APIs that prevent markup injection.

### REQ-SEC-009: Dependency review

External dependencies SHALL be minimized and reviewed before Marketplace production release.

### REQ-SEC-010: Logging secrets

Logs SHALL NOT include access tokens, API keys, authorization headers, or complete secret values.

---

## 22. Privacy Requirements

### REQ-PRIV-001: Data minimization

Only data required to compute the route SHALL leave Apps Script for the routing backend.

### REQ-PRIV-002: No event content transmission

The routing backend SHALL NOT receive event summaries, descriptions, attendees, or conferencing data.

### REQ-PRIV-003: Clear disclosure

Marketplace and support documentation SHALL disclose that origins and destinations are processed by the project's routing backend and Google Maps.

### REQ-PRIV-004: No route retention by default

The broker SHALL NOT retain raw origins and destinations beyond what is technically necessary to process a request, unless a future retention feature is separately documented and consented to.

### REQ-PRIV-005: Aggregate metrics

Operational metrics SHALL use aggregate counts and non-sensitive labels.

### REQ-PRIV-006: User cleanup

Users SHALL have documented means to remove generated events and stored add-on settings.

### REQ-PRIV-007: Privacy policy

A publicly accessible privacy policy SHALL be available before Marketplace production submission.

---

## 23. Performance and Quota Requirements

### REQ-PERF-001: Bounded reconciliation

Ordinary reconciliation SHALL remain bounded by the configured planning window.

### REQ-PERF-002: No-write optimization

Unchanged generated events SHALL NOT be rewritten.

### REQ-PERF-003: Route request economy

The implementation SHALL avoid route calls when eligibility, source data, or cached planning inputs demonstrate that no recalculation is needed, provided correctness is preserved.

This is mandatory for the MVP, not an optimization. Fingerprints are computed after routing and therefore cannot prevent broker calls; see REQ-PERF-009.

### REQ-PERF-004: Execution measurement

Beta releases SHALL record reconciliation duration and event counts in non-sensitive structured logs or run status.

### REQ-PERF-005: Apps Script limits

The beta program SHALL validate practical behavior against Apps Script execution and service quotas.

### REQ-PERF-006: Pagination

Calendar listing SHALL handle API pagination.

### REQ-PERF-007: Broker timeout

Broker requests SHALL use bounded timeouts and SHALL NOT leave reconciliation hanging indefinitely.

### REQ-PERF-008: Scale target

The MVP SHOULD reliably handle an ordinary personal calendar with up to several hundred events in the planning window and a materially smaller subset of eligible travel events.

A precise supported maximum SHALL be established from beta measurements rather than assumed.

### REQ-PERF-009: Route plan cache

Route results SHALL be cached as derived state alongside the generated event they produced, keyed by a route input hash and stamped with a calculation time.

A cached result SHALL be reused when the route input hash is unchanged and the entry is less than 24 hours old. Reconciliation SHALL NOT refresh a route more than once per day per direction.

**Exception:** a route **direction** whose padding is zero produces no companion for that role (REQ-GEN-001 exception) — as does a direction whose computed span has already ended, whose return route is computed only inside the bounded band Technical Design §12.5 defines — so no durable carrier exists for that direction's cache entry — whether or not the opposite direction's companion exists, since each companion caches only its own direction. Such results are retained in the ephemeral tier, and their refresh frequency is governed by the ephemeral tier's behavior rather than the 24-hour rule: bounded by the ephemeral TTL in the expected case, and — because that tier is best-effort and may evict early — hard-bounded only by the per-run route ceiling (REQ-PERF-010). A deliberate trade documented in the technical design's zero-padding rule, accepted because a companion-less durable store would need its own pruning machinery for a case that requires a drive quantizing to zero with a zero buffer.

The cache SHALL never be authoritative. Discarding it may increase broker calls but SHALL NOT change the resulting Calendar state.

### REQ-PERF-010: Bounded route spend

Steady-state route consumption SHALL be bounded by the number of eligible events per day, not by trigger frequency.

**Exception:** a route direction with no durable cache carrier (the REQ-PERF-009 exception: a zero-padding direction, or the bounded ended-return band of Technical Design §12.5) relies on the best-effort ephemeral tier, so under early eviction its consumption can scale with trigger frequency, capped by the per-run ceiling below. The same trade, stated here so the two requirements carry it together.

Each reconciliation run SHALL enforce a maximum number of broker calls. On reaching that ceiling the run SHALL report `partial`, leave remaining events unplanned, and preserve their existing generated events.

The ceiling counts **HTTP attempts, including transient retries**, not logical route requests. A ceiling enforced above the retry layer would permit up to double the spend during a broker outage — exactly when the bound matters.

Within one run, a route input that the broker has already answered with a deterministic failure (no route, invalid origin, invalid destination) SHALL NOT be requested again: every source sharing that input — the instances of one recurring series — records the same failure without spending another attempt. Across runs, such a failure SHALL be remembered for a bounded time (Technical Design §11.1: 24 hours, keyed by the route input, a bounded number of entries, no address stored), so that sources whose routes fail deterministically cannot spend every run's ceiling and starve the sources planned after them; a corrected location or origin changes the route input and is routed on the next run. Transient and deployment-level broker failures SHALL NOT be remembered.

### REQ-PERF-011: Diagnostic route budget

Event-diagnostic route calls SHALL be counted against a per-user hourly ceiling and SHALL consult and populate the same route cache used by reconciliation.

When the ceiling is exceeded the diagnostic card SHALL still report eligibility, directives, and resolved origin, and SHALL indicate that timing is temporarily unavailable.

### REQ-PERF-013: Continuation after a partial run

A reconciliation run that stops at the per-run route ceiling SHALL schedule a continuation rather than deferring its remaining work to the next daily run, provided some of the run's broker attempts were productive — they returned a route, or a deterministic failure now remembered across runs. A ceiling spent entirely on failures a further pass would meet again (a misconfigured broker credential, an outage) justifies no continuation on its own.

Consecutive continuations SHALL be capped and the cap reported in run status, so that a persistent failure cannot loop indefinitely.

### REQ-PERF-017: Schedule-only changes cost no broker calls

A change to a source event that does not alter its route inputs — rescheduling, renaming, or any edit leaving location and effective origin unchanged — SHALL NOT cause broker calls while the cached route remains valid.

The route input hash excludes source times for exactly this reason. Rescheduling is the most common calendar edit; charging it two broker calls would waste quota and could push a cheap change into the per-run ceiling.

### REQ-PERF-016: Route age measured from calculation

A cached route duration SHALL carry the time the route was calculated, not the time it was read from any cache.

Where a duration passes through more than one cache, the original calculation time SHALL be preserved, so that freshness is measured from when the broker produced the value rather than from when it was most recently observed.

### REQ-PERF-015: Cache reachability

The planning path SHALL have access to the route cache entries of the observed companions for the source event being planned, and to an injected clock.

Cache entries live on generated events, which are matched to desired specifications only after planning. Unless observed companions are indexed before planning begins, no cache lookup is possible and REQ-PERF-009 and REQ-PERF-010 cannot be satisfied.

### REQ-PERF-014: Route cache persistence

A refreshed route cache entry SHALL be persisted even when the generated event's user-visible fields are unchanged, and SHALL include the complete cache record: route hash, duration, and calculation time.

Persisting only on user-visible change would leave the cache timestamp permanently stale. Persisting the duration and timestamp without the hash would leave a missing or corrupted hash in place, so the entry fails validation again on the next run despite the refresh. Either omission causes a broker call on every subsequent run, defeating REQ-PERF-010.

### REQ-PERF-012: Duration quantization

Route durations SHALL be rounded up to a 5-minute granularity before being used for generated event times or fingerprint computation.

Quantization exists so that refreshing an expired cache entry does not rewrite unchanged events or visibly move a user's travel blocks.

---

## 24. Observability and Support Requirements

### REQ-OBS-001: Last-run record

The application SHALL persist a compact per-user last-run record.

### REQ-OBS-002: Aggregate run counts

The run record SHALL include source, eligible, create, update, delete, ignore, and error counts.

### REQ-OBS-003: Trigger status

The add-on SHALL expose required trigger presence.

### REQ-OBS-004: Correlation identifier

Each reconciliation run SHOULD have an opaque correlation identifier usable across Apps Script and broker logs.

### REQ-OBS-005: Sensitive-data avoidance

Routine logs SHALL NOT include raw event titles, descriptions, or route addresses.

### REQ-OBS-006: Support diagnostics

The add-on SHOULD provide a user-copyable diagnostic summary containing versions, trigger health, counts, and normalized errors without exposing sensitive data.

### REQ-OBS-007: Broker metrics

The broker SHALL expose request count, latency, normalized errors, authentication failures, and quota/cost indicators.

---

## 25. Compatibility Requirements

### REQ-COMPAT-001: Apps Script V8

The Apps Script project SHALL use the V8 runtime.

### REQ-COMPAT-002: Advanced Calendar service

The implementation SHALL use the Advanced Calendar service or direct Calendar API where required for event types and private extended properties.

### REQ-COMPAT-003: Account capability variation

The implementation SHALL handle missing working-location support gracefully.

### REQ-COMPAT-004: Localization-safe metadata

Internal matching SHALL NOT depend on localized generated-event titles.

### REQ-COMPAT-005: Time-zone correctness

Behavior SHALL remain correct for users and events outside the project's development time zone.

### REQ-COMPAT-006: Marketplace review changes

If Marketplace policy requires scope or architecture adjustments, changes SHALL preserve the normative product behavior where possible and be documented through an ADR.

---

## 26. Release Requirements

### REQ-REL-001: Development environment

The project SHALL support a non-production Apps Script deployment and routing backend.

### REQ-REL-002: Beta environment

A limited tester release SHALL precede public production release.

### REQ-REL-003: Production isolation

Production broker credentials and billing controls SHALL be isolated from development where practical.

### REQ-REL-004: Version identification

User diagnostics SHALL identify the add-on release or deployment version.

### REQ-REL-005: CI validation

CI SHALL at minimum validate JSON, JavaScript formatting or linting, and pure unit tests before merge.

### REQ-REL-006: Marketplace materials

Production submission SHALL include:

- listing description;
- icons and screenshots;
- privacy policy;
- support URL;
- OAuth consent configuration;
- test instructions or accounts as required;
- accurate disclosure of data use.

### REQ-REL-007: Rollback capability

The deployment process SHALL support returning to a previously known-good Apps Script deployment and broker revision.

A release that bumps the settings schema is roll-forward-only for users who saved settings under it: the older deployment blocks their runs with a visible `INVALID_SETTINGS` error and leaves the stored document intact, so rolling forward again restores it (technical design §5.4). Preserving unknown settings keys is not a downgrade path.

---

## 27. MVP Acceptance Summary

The MVP is acceptable for limited external beta when all of the following are demonstrated:

1. A consumer or Workspace test user can install and authorize the add-on.
2. The user can configure a default origin, buffer, and window.
3. A timed OOO event with a location produces outbound and return events.
4. The generated events use the expected event type and timing.
5. Moving the source updates existing generated events without duplicates.
6. Changing the location recalculates both routes.
7. Deleting the source removes generated events.
8. One moved recurring instance updates only its companions.
9. One cancelled recurring instance removes only its companions.
10. Manual deletion of a generated event is repaired.
11. A transient route failure preserves existing generated events.
12. Trigger repair identifies and repairs missing triggers.
13. Dry-run mode reports the intended diff without writes.
14. User-visible diagnostics explain common ineligibility and failure cases.
15. No Maps credential is embedded in the distributed Apps Script project.
16. Privacy and support documents accurately describe data flow.

---

## 28. Explicitly Out of Scope for MVP

The following are excluded unless the scope is deliberately revised:

- multiple-calendar selection;
- shared calendars;
- travel modes other than driving;
- automatic destination inference;
- live continuous traffic monitoring;
- navigation instructions;
- attendee or organizer notifications;
- generalized padding-rule marketplace;
- preparation or decompression providers;
- billing or paid tiers;
- organization-wide policy administration;
- native mobile configuration UI controlled by this project;
- permanent route-history storage;
- automatic conflict resolution with other events.

---

## 29. Requirements Change Control

A change requires architecture or requirements review when it:

- changes authoritative source data;
- introduces a new external data processor;
- requests additional OAuth scopes;
- changes generated-event ownership or metadata;
- changes recurring-event strategy;
- introduces a persistent external user database;
- changes broker authentication;
- adds a new calendar or travel mode;
- weakens privacy or cleanup behavior;
- changes the definition of MVP acceptance.

Material decisions SHOULD be captured in an ADR.
