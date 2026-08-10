# Drivetime Padding Requirements Specification

**Document version:** 1.0-draft  
**Project:** Drivetime Padding  
**Status:** Proposed MVP requirements  
**Related documents:** Architecture Book, Technical Design Book

---

## 1. Purpose

This specification defines the functional, user-experience, reliability, security, privacy, performance, operational, and release requirements for the Drivetime Padding minimum viable product.

The document is normative. Statements using **must**, **shall**, or **required** describe behavior necessary for MVP acceptance. Statements using **should** describe strongly preferred behavior that may be deferred only with an explicit decision. Statements using **may** describe optional behavior.

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

The system shall automatically create calendar blocks for travel to and from eligible source events.

### REQ-GOAL-002: Minimal user maintenance

After initial configuration, the system shall maintain generated events without requiring routine manual cleanup.

### REQ-GOAL-003: Predictable behavior

The system shall use explicit source-event fields and configured settings rather than guessing origins, destinations, or intent.

### REQ-GOAL-004: Broad account support

The product shall be designed for both consumer Google accounts and Google Workspace accounts, subject to Google API and Marketplace limitations discovered during implementation and review.

### REQ-GOAL-005: Recoverable state

The system shall be able to reconstruct generated events from source events and settings without relying on an external event-mapping database.

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

The production product shall be distributed as a Google Workspace Marketplace add-on.

### REQ-INSTALL-002: Consumer account intent

The product shall not intentionally depend on an organization-only identity or administration feature unless no technically viable consumer-compatible alternative exists.

### REQ-INSTALL-003: Workspace administration

Documentation shall state that Workspace administrators may restrict Marketplace installation or OAuth scopes.

### REQ-INSTALL-004: Primary calendar only

The MVP shall manage only the authenticated user's primary calendar.

### REQ-INSTALL-005: Uninstallation and cleanup

The product shall provide a documented method to remove generated events. Cleanup may be exposed before uninstall, through a dedicated add-on action, or through a documented reinstallation workflow if Marketplace uninstall hooks are insufficient.

Published documentation shall not state or imply that uninstalling removes generated events. It shall state that cleanup must be run before uninstalling, and shall document the reinstall-and-clean recovery path for users who uninstall first.

### REQ-INSTALL-006: Trigger ownership

Installable triggers shall be created under the installing user's authorization context.

---

## 7. Configuration Requirements

### REQ-CONFIG-001: Persistent per-user settings

The add-on shall persist settings per user using Apps Script User Properties or an equivalent per-user store.

### REQ-CONFIG-002: Settings schema

Stored settings shall include a schema version.

### REQ-CONFIG-003: Automatic migration

Older supported settings schemas shall be migrated automatically when loaded.

### REQ-CONFIG-004: Enable switch

The user shall be able to enable or disable automatic synchronization without deleting settings.

### REQ-CONFIG-005: Default planning window

The default planning window shall be 60 days from the current time.

### REQ-CONFIG-006: Configurable planning window

The user shall be able to configure the planning window within bounded limits.

Recommended MVP bounds:

- minimum: 7 days;
- maximum: 180 days.

### REQ-CONFIG-007: Default buffer

The default buffer shall be configurable in whole minutes.

### REQ-CONFIG-008: Buffer bounds

The default buffer shall be validated within a safe bounded range.

Recommended MVP range:

- minimum: 0 minutes;
- maximum: 120 minutes.

### REQ-CONFIG-009: Required default origin

Synchronization shall not create travel events until a valid default origin is configured.

### REQ-CONFIG-010: Optional home origin

The user may configure a home origin.

### REQ-CONFIG-011: Optional office origin

The user may configure an office origin.

### REQ-CONFIG-012: Origin types

Each origin shall support:

- plain address text; and
- Google Place ID.

### REQ-CONFIG-013: Working-location toggle

The user shall be able to enable or disable working-location-based origin selection.

### REQ-CONFIG-014a: No eligible source types

Configuration in which `eligibility.includeOutOfOffice` is false and `eligibility.titlePatternEnabled` is false makes every source event ineligible.

This shall not be treated as an error, but the UI shall surface it, since the resulting behavior is indistinguishable from a malfunction.

### REQ-CONFIG-014: Optional title pattern

The user shall be able to enable an optional subject-matching pattern for non-OOO events.

### REQ-CONFIG-006a: Window reduction takes effect

Reducing the planning window shall remove generated events that fall beyond the new horizon.

A contracted observation range no longer reads those events, so they cannot be classified as outside-window by the ordinary pass. The implementation shall retain a record of the furthest horizon previously used and perform an ownership-filtered cleanup over the vacated span, lowering that record only after the deletions succeed.

Without this, a user who narrows the window sees generated events persist for as long as the original horizon, and the setting appears not to work.

### REQ-CONFIG-015: Pattern validation

The add-on shall validate the configured pattern before saving or using it.

### REQ-CONFIG-016: Case sensitivity

The title-pattern configuration shall define whether matching is case-sensitive. The default shall be case-insensitive.

### REQ-CONFIG-017: Safe invalid configuration behavior

Invalid configuration shall prevent Calendar writes and shall produce a visible diagnostic message.

### REQ-CONFIG-018: Settings reset

The UI should provide a way to reset settings to defaults, with confirmation before destructive replacement.

---

## 8. Source Event Eligibility Requirements

### REQ-ELIG-001: Real OOO default

A timed event with Calendar event type `outOfOffice` shall be eligible by default when all other required conditions are met.

Eligibility by event type shall be governed by the `eligibility.includeOutOfOffice` setting. When that setting is false, a real OOO event shall not qualify on the strength of its event type alone, and the reason reported shall distinguish this from a failed title-pattern match.

A settings field that no evaluation step consults is not a setting; it is a control that silently does nothing.

### REQ-ELIG-002: Pattern-based inclusion

When optional title-pattern matching is enabled, an ordinary event whose summary matches the pattern shall be eligible when all other required conditions are met.

"Ordinary" is enforced by a type gate ahead of pattern matching: only `default` and `outOfOffice` event types may reach pattern acceptance. Special Calendar types (`focusTime`, `workingLocation`, `birthday`, `fromGmail`) are rejected as `UNSUPPORTED_EVENT_TYPE` even when timed, located, and pattern-matching.

### REQ-ELIG-003: All-day exclusion

Events represented with date-only start/end values shall be ineligible.

### REQ-ELIG-004: Location required

An event shall be ineligible when its Calendar `location` field is empty or missing.

### REQ-ELIG-005: Generated-event exclusion

An event marked as generated by Drivetime Padding shall never be treated as a source event.

### REQ-ELIG-006: Per-event disable

A recognized `off` directive shall make the source event ineligible.

### REQ-ELIG-007: Planning-window inclusion

Only source events intersecting the active planning window shall be considered for generation.

### REQ-ELIG-008: Cancelled-event exclusion

Cancelled events shall not produce desired generated events.

### REQ-ELIG-009: Eligibility diagnostics

The system shall be able to state a specific reason when an event is ineligible.

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

A pattern-matched ordinary event shall produce ordinary generated events rather than OOO generated events.

### REQ-ELIG-011: OOO type preservation

A real OOO source event shall produce real OOO generated events if supported by the Calendar API behavior validated during implementation.

If the API cannot reliably create the required event type, the implementation shall document the limitation and obtain an explicit product decision before release.

---

## 9. Destination Requirements

### REQ-DEST-001: Location field only

The destination shall come only from the source event's Calendar `location` field.

### REQ-ELIG-012: Title matching uses the raw summary

Title-pattern matching shall be performed against the source event's summary exactly as Calendar returned it.

Any display fallback substituted for a blank summary shall not participate in eligibility, so that an event whose title was never set cannot be matched by a pattern that happens to match the fallback text.

### REQ-DEST-002: No description inference

The system shall not infer a destination from the event description.

### REQ-DEST-003: No attendee inference

The system shall not infer a destination from attendees, organizer details, or contact addresses.

### REQ-DEST-004: No conferencing inference

The system shall not infer a destination from Google Meet or other conferencing data.

### REQ-DEST-005: Unresolvable destination

When the routing service cannot resolve the destination, the system shall report a planning error and shall not create travel events using a guessed duration.

---

## 10. Origin Resolution Requirements

### REQ-ORIGIN-001: Deterministic priority

The system shall choose origin using this priority:

1. recognized per-event origin override;
2. matching working-location state when enabled;
3. configured default origin.

### REQ-ORIGIN-002: Per-event choices

The MVP shall recognize per-event origin values:

- `home`;
- `office`;
- `default`.

### REQ-ORIGIN-003: Missing selected origin fallback

If a selected home or office origin is not configured, the system shall fall back to the default origin.

### REQ-ORIGIN-004: Missing default origin

If the default origin is unavailable, planning shall fail without creating or deleting generated events for otherwise eligible sources.

### REQ-ORIGIN-005: Working-location overlap

Working-location selection shall use a working-location event applicable to the source event's time.

### REQ-ORIGIN-006: Unsupported working location

Unsupported or ambiguous working-location types shall fall back to the default origin.

### REQ-ORIGIN-007: Same return endpoint

The return route shall end at the same effective origin selected for the outbound route.

### REQ-ORIGIN-008: Visible effective origin

Event diagnostics shall show whether the effective origin came from an override, home working location, office working location, or default fallback.

---

## 11. Buffer and Timing Requirements

### REQ-TIME-001: Outbound duration

Outbound generated-event duration shall equal outbound route duration plus the effective buffer.

### REQ-TIME-002: Return duration

Return generated-event duration shall equal return route duration plus the effective buffer.

### REQ-TIME-003: Outbound alignment

The outbound generated event shall end exactly at the source event start.

### REQ-TIME-004: Return alignment

The return generated event shall begin exactly at the source event end.

### REQ-TIME-005: Independent route calculations

The MVP shall permit outbound and return durations to differ.

### REQ-TIME-006: Overlap allowed

The system shall create generated events even when they overlap other calendar events.

### REQ-TIME-007: Per-event buffer override

A recognized per-event buffer directive shall replace the configured default buffer for that source event.

### REQ-TIME-008: Buffer units

Buffer values shall be interpreted as whole minutes.

### REQ-TIME-009: Invalid buffer directive

An invalid buffer directive shall be ignored and surfaced as a non-fatal diagnostic warning.

### REQ-TIME-010: Time zones

Generated event start and end values shall preserve the correct absolute times and Calendar time-zone semantics of the source event.

### REQ-TIME-011: Reconciliation lookback

The reconciliation read window shall extend backward from the current time by at least the maximum supported travel duration plus the maximum configurable buffer.

Source events that have already started shall continue to be planned while any part of their padding remains in the future. They shall not be excluded from desired state, because doing so would orphan and delete their still-required return blocks.

Planning eligibility shall be determined by temporal intersection with the planning range, not by source start time alone. A source that began before the lookback but is still running remains eligible.

### REQ-TIME-014: Observation range completeness

The range used to read generated events shall be wide enough that every companion event of every planned source event is observed.

Because outbound blocks begin before their source and return blocks end after it, and because the Calendar API bounds start and end times asymmetrically, a single window leaks at both edges and causes repeated duplicate creation.

Timed source events longer than `MAX_SOURCE_DURATION_MINUTES` shall be ineligible, so that the observation range remains finite.

### REQ-TIME-012: Maximum supported travel

The product shall define a maximum supported one-way travel duration, initially six hours.

A route exceeding it shall produce an explicit user-visible diagnostic and no generated events, shall be treated as a planning failure rather than ineligibility, and shall not cause deletion of existing generated events.

### REQ-TIME-013: Daily maintenance hour

Scheduled reconciliation shall occur at a time appropriate to the user's own Calendar time zone.

The script project time zone shall not determine when a user's daily reconciliation runs.

---

## 12. Per-Event Directive Requirements

### REQ-DIRECTIVE-001: Description parsing

Directives shall be parsed only from the source event description.

### REQ-DIRECTIVE-002: Line-oriented grammar

Each directive shall occupy one logical line.

### REQ-DIRECTIVE-003: Case-insensitive keywords

Directive keywords shall be case-insensitive.

### REQ-DIRECTIVE-004: Disable grammar

The following form shall disable generation:

```text
drivetime padding: off
```

### REQ-DIRECTIVE-005: Buffer grammar

The following form shall override the buffer:

```text
drivetime padding: buffer=10m
```

### REQ-DIRECTIVE-006: Buffer shorthand

The MVP may support:

```text
drivetime padding +7m
```

When supported, it shall replace rather than add to the default buffer.

### REQ-DIRECTIVE-007: Origin grammar

The following forms shall be recognized:

```text
drivetime padding: origin=home
drivetime padding: origin=office
drivetime padding: origin=default
```

### REQ-DIRECTIVE-008: Unknown directives

Unknown directive forms shall not make the entire event fail.

### REQ-DIRECTIVE-009: Provider isolation

The routing and event-generation components shall consume parsed directives rather than parsing raw descriptions themselves.

---

## 13. Routing Requirements

### REQ-ROUTE-001: Driving only

The MVP shall request driving routes only.

### REQ-ROUTE-002: Broker usage

Production Marketplace releases shall obtain route calculations through a controlled backend rather than embedding a shared Maps credential in Apps Script.

### REQ-ROUTE-003: Minimum route response

The broker shall return at least:

- duration in seconds;
- distance in meters, when available.

### REQ-ROUTE-004: Direction-specific requests

The system shall be able to request:

- origin to destination; and
- destination to origin.

### REQ-ROUTE-011: Uniform endpoint representation

Both ends of every route request shall carry an explicit endpoint type (address or Place ID) in both travel directions.

The return route swaps the endpoints of the outbound route. A representation that types only the origin would, in the return direction, lose whether the configured origin is a Place ID — degrading a precise place reference into address parsing, or failing outright.

### REQ-ROUTE-005: No guessed fallback

A failed route lookup shall not silently fall back to a fixed or guessed duration in production.

### REQ-ROUTE-006: Normalized errors

The broker shall expose stable application-level error codes rather than raw upstream Maps errors.

### REQ-ROUTE-007: Data minimization

Broker requests shall not include source-event summaries, descriptions, attendees, calendar IDs, or recurrence rules.

### REQ-ROUTE-008: Authentication

The public-production broker shall authenticate requests using a mechanism suitable for a Marketplace-distributed client.

A single long-lived secret embedded in distributed client code shall not be considered sufficient for public production.

### REQ-ROUTE-009: Quota protection

The broker shall include controls capable of limiting abuse and excessive cost.

### REQ-ROUTE-010: Logging privacy

The broker shall not log raw origin and destination values by default.

---

## 14. Generated Event Requirements

### REQ-GEN-001: Exactly two generated events

For a successfully planned MVP drivetime source event, the desired state shall contain one outbound and one return event.

### REQ-GEN-002: Predictable subjects

Generated-event summaries shall use a predictable, human-readable prefix.

Recommended default:

```text
[Drivetime Padding]
```

### REQ-GEN-003: Outbound summary

The outbound summary should communicate travel to the source event.

### REQ-GEN-004: Return summary

The return summary should communicate return from the source event.

### REQ-GEN-005: No attendees

Generated events shall not copy source-event attendees.

### REQ-GEN-006: No conferencing

Generated events shall not copy conference data.

### REQ-GEN-007: No attachments

Generated events shall not copy attachments.

### REQ-GEN-008: No guest notifications

Creating or updating generated events shall not send source-event guest notifications.

### REQ-GEN-009: Source description not copied

Generated events shall not copy the source event description by default.

### REQ-GEN-009a: Reminder suppression

Generated events shall not carry reminders, so that travel blocks do not produce alerts of their own.

Suppression shall be maintained rather than applied only at creation: see REQ-GEN-014b.

### REQ-GEN-010: Private metadata

Generated events shall contain private extended properties sufficient to identify ownership, source linkage, role, schema, and fingerprint.

### REQ-GEN-011: Metadata authority

The system shall identify managed events through private metadata, not title text.

### REQ-GEN-012: Stable role values

The MVP role values shall be:

- `outbound`;
- `return`.

### REQ-GEN-013: Manual deletion recovery

If a managed generated event is manually deleted while its source remains eligible, a later reconciliation shall recreate it.

### REQ-GEN-014a: Owned-field verification

Reconciliation shall compare the observed generated event's owned fields against the desired specification, and shall not treat a matching stored fingerprint as sufficient evidence that the event is correct.

A manually moved, resized, or renamed generated event retains its private metadata, so its stored fingerprint still matches. Restoration therefore depends on comparing the fields themselves.

### REQ-GEN-014: Manual modification recovery

If a managed generated event is manually moved, resized, or renamed, a later reconciliation shall restore desired state.

### REQ-GEN-014b: Owned fields include reminders

Reminder state on generated events shall be compared and restored along with the other owned fields.

Reminder suppression (REQ-GEN-009a) is a maintained property, not a creation-time gesture. A field the system writes but never compares can be changed permanently by the user without reconciliation noticing.

### REQ-GEN-015: Removed metadata safety

An event with no recognizable Drivetime Padding metadata shall not be deleted based only on its title.

Deletion shall verify the ownership marker at the moment of deletion, not only at the moment the event was read. Concurrent Calendar edits are not serialized by the add-on's own locking, so an event may lose its marker between read and write.

### REQ-GEN-016: Cleanup when ineligible

When a previously eligible source becomes definitively ineligible, its managed generated events shall be deleted.

### REQ-GEN-017: Preserve on planning failure

When a source remains eligible but desired-state calculation fails transiently, existing generated events shall be preserved.

---

## 15. Metadata and Fingerprint Requirements

### REQ-META-001: Ownership marker

Generated metadata shall include an application ownership marker.

### REQ-META-002: Metadata schema

Generated metadata shall include a schema version.

### REQ-META-003: Parent linkage

Generated metadata shall include the source instance event ID.

### REQ-META-004: Role

Generated metadata shall include the generated-event role.

### REQ-META-005: Fingerprint

Generated metadata shall include a deterministic fingerprint of all inputs that affect generated Calendar state.

Fingerprint inputs shall be role-specific. A fingerprint shall not include a source boundary that cannot affect the companion it identifies, because doing so would force writes to events that are already correct and violate REQ-RECON-007.

### REQ-META-006: Optional recurrence diagnostics

Metadata should include source `iCalUID` and original start when useful for diagnosing recurring instances.

### REQ-META-007: Canonical serialization

Fingerprint input shall be canonically serialized before hashing.

### REQ-META-008: Hash algorithm

The MVP shall use SHA-256 or an equivalently stable available hash.

### REQ-META-009: No-write match

When the desired and observed fingerprints match **and** the observed event's owned fields match the desired specification, reconciliation shall not update the generated event.

A matching fingerprint alone is not sufficient grounds to skip a write. Calendar preserves private metadata through a user edit, so a moved, resized, or renamed generated event still carries a matching fingerprint while sitting in the wrong place. Skipping the write in that case would forbid the restoration REQ-GEN-014 and REQ-GEN-014a require.

Refreshing an expired route cache entry is a metadata patch rather than an update, and is permitted under this requirement (REQ-PERF-014).

### REQ-META-010: Unknown metadata preservation

Updates should preserve unrecognized private metadata keys where doing so does not compromise ownership or schema correctness.

---

## 16. Recurring Event Requirements

### REQ-RECURRENCE-001: Instance expansion

Recurring source events shall be expanded into concrete instances within the planning window.

### REQ-RECURRENCE-002: One-off generated companions

Generated outbound and return events shall be non-recurring events linked to individual source instances.

### REQ-RECURRENCE-003: Moved instance

Moving one recurring instance shall update only that instance's generated companions.

### REQ-RECURRENCE-004: Cancelled instance

Cancelling one recurring instance shall remove only that instance's generated companions.

### REQ-RECURRENCE-005: Location exception

Changing the location of one recurring instance shall recalculate only that instance's routes and generated events.

### REQ-RECURRENCE-006: Series split

A "this and following" edit shall be handled through the concrete instances returned by Calendar without maintaining a mirrored recurrence graph.

### REQ-RECURRENCE-007: Window advancement

The daily scheduled reconciliation shall create generated events for newly visible future instances as the rolling window advances.

### REQ-RECURRENCE-008: No indefinite pre-generation

The system shall not generate companion events indefinitely beyond the configured planning window.

---

## 17. Reconciliation Requirements

### REQ-RECON-001: Desired-state model

The system shall reconcile desired generated-event state against observed managed events.

### REQ-RECON-002: Trigger independence

The reconciliation algorithm shall not require the identity of the event that caused the trigger.

### REQ-RECON-003: Idempotency

Repeated reconciliation with unchanged inputs shall produce no additional Calendar changes.

### REQ-RECON-004: Bounded scope

Each ordinary reconciliation shall operate within the configured planning window.

### REQ-RECON-005: Locking

Only one reconciliation shall modify a given user's calendar at a time.

### REQ-RECON-006: Lock contention

When the user lock cannot be acquired within a short bounded interval, the run shall exit safely without Calendar writes.

### REQ-RECON-007: Minimal writes

The engine shall classify managed events into create, update, delete, and ignore operations and apply only necessary writes.

### REQ-RECON-008: Partial failure recovery

The system shall rely on later reconciliation to repair partial writes rather than requiring transactional rollback across Calendar events.

### REQ-RECON-009: Orphan cleanup

Managed generated events with no desired eligible source shall be deleted, except when desired-state planning for the source failed transiently.

A generated event whose source event is absent from a **complete** scan shall be treated as orphaned and deleted. A generated event whose source is absent from an **incomplete** scan shall be preserved, because an incomplete scan establishes only that the source was not reached, not that it is gone.

Preservation shall not be extended to every unevaluated parent. Doing so would strand generated events whose source moved outside the read range, leaving stale travel blocks that age out of view without ever being removed.

### REQ-RECON-013: Absence-based writes require a complete scan

Creates and orphan deletions shall be performed only when the observation scan that failed to find the corresponding event completed successfully.

Both operations act on absence, and a truncated scan can cut between a source event and its own companion — planning the source while its existing companion sits on an unretrieved page, so an absence-gated create would duplicate it on every partial run. Operations based on events actually read (updates, metadata patches) may proceed.

### REQ-RECON-010: Dry-run support

The engine shall support a mode that computes eligibility, desired state, and the diff without applying Calendar writes.

### REQ-RECON-011: Shared execution path

Calendar-trigger, daily-trigger, manual-sync, and dry-run commands shall reuse the same reconciliation core.

### REQ-RECON-012: Run status

Each run shall produce a structured result containing at least:

- status;
- source events checked;
- eligible events;
- created count;
- updated count;
- replaced count;
- deleted count;
- ignored count;
- failed-write count;
- error count;
- start and completion timestamps.

Write counts shall reflect operations Calendar **accepted**, taken from the diff application result, not operations the diff proposed. A run with one or more failed writes shall not report success (REQ-ERROR-006). Dry runs report proposal counts, marked as such, and shall not overwrite the stored last-run record.

### REQ-RECON-014: Event type changes are applied by replacement

When a generated event's desired `eventType` differs from its observed `eventType`, reconciliation shall delete the observed event and create a new one from the desired specification, rather than patching the type.

Calendar declares `eventType` immutable after creation. Folding the difference into an update produces a patch that fails identically on every reconciliation, leaving the companion permanently in the wrong state. The type remains a compared owned field; replacement is its write path.

### REQ-RECON-015: Companions of overlong sources are located outside the window

When an ineligible source event's observed duration exceeds `MAX_SOURCE_DURATION_MINUTES` — regardless of its ineligibility reason — and either companion role is missing from the observed index, reconciliation shall locate its companions by ownership and parent metadata without time bounds, and delete them.

The observation range's completeness guarantee assumes sources respect the duration cap. A source edited past the cap after planning keeps itself readable while its companions fall behind `observeStart` permanently; only a targeted lookup can reach them. The trigger is the duration, not the classification: a multi-day all-day conversion strands companions identically but is classified `ALL_DAY_EVENT` before the duration test runs. The gate is "either role missing" rather than "no companions observed" so a half-stranded pair does not wait an extra run for cleanup.

### REQ-RECON-016: Companions moved outside the window are restored, not duplicated

Before creating a generated event for a desired key with no observed match, reconciliation shall look up managed companions for that parent without time bounds; a managed event matching the absent key shall be updated to the desired specification instead of a new event being created.

A complete window scan cannot see a companion the user dragged beyond the observation range. A blind create manufactures a permanent duplicate and abandons the moved event, violating the manual-move restoration guarantee (REQ-GEN-014).

### REQ-RECON-017: Companions of unplanned sources are swept from outside the window

The daily maintenance run shall discover managed events outside the observation range whose persisted source anchor lies within the current planning range — slacked by the source duration cap plus a discovery margin covering the interval between daily firings — and shall delete those whose parent, established by a point read, is absent, cancelled, live but outside the planning range, or ineligible. Companions of planned parents shall be left to the restoration path unless an in-window event already satisfies their key (a stranded duplicate); companions of failed parents shall be preserved.

REQ-RECON-016's restoration is driven by a pending create, which requires a live parent planning inside the window. Deleting the source — or moving it out of the window along with its companion — leaves nothing pending and the stray invisible to the bounded scan; without a discovery pass independent of desired state, and one that decides on the parent's *state* rather than bare existence, the stray persists forever, in violation of REQ-RECON-009. The anchor selection is what bounds the sweep's cost: historical companions whose parents simply aged out are excluded without any per-event lookup.

---

## 18. Trigger Requirements

### REQ-TRIGGER-001: Calendar trigger

The add-on shall install an event-update trigger for the primary calendar.

### REQ-TRIGGER-002: Daily repair trigger

The add-on shall install a daily time-based reconciliation trigger.

The daily run is the product's eventual-consistency guarantee. Regardless of missed triggers, partial writes, transient broker failures, or manual edits, a correct state shall be reached within one daily cycle without user intervention.

Work deferred by the per-run route ceiling is excluded from the one-cycle bound. A run that ends `partial` shall schedule a continuation so that convergence remains a function of the deferred work rather than of the daily schedule (REQ-PERF-013). Where continuation is unavailable, the bound is one daily cycle per `MAX_ROUTE_CALLS_PER_RUN` units of deferred work.

### REQ-TRIGGER-003: Duplicate prevention

Trigger repair shall remove or otherwise resolve duplicate Drivetime Padding triggers.

### REQ-TRIGGER-004: Missing trigger repair

The user shall have an action to create missing required triggers.

### REQ-TRIGGER-005: Trigger health display

The UI shall display whether required triggers are present.

### REQ-TRIGGER-006: Same reconciliation logic

Both trigger types shall invoke the same reconciliation implementation.

### REQ-TRIGGER-007: Permission failure visibility

If trigger installation fails due to authorization or policy, the UI shall present a clear remediation message.

---

## 19. User Interface Requirements

### 19.1 Home card

### REQ-UI-001: Enabled status

The home card shall show whether automation is enabled.

### REQ-UI-002: Core settings summary

The home card shall show at least:

- planning window;
- default buffer;
- whether a default origin is configured;
- optional pattern enabled/disabled.

### REQ-UI-003: Synchronize action

The home card shall provide a manual synchronization action.

### REQ-UI-004: Settings navigation

The home card shall provide access to settings.

### REQ-UI-005: Trigger repair action

The home card shall provide an automation repair action.

### REQ-UI-006: Last-run status

The home card shall display the last known run status and timestamp.

### 19.2 Settings card

### REQ-UI-007: General settings

The settings UI shall expose:

- enable/disable;
- planning-window days;
- default buffer minutes.

### REQ-UI-008: Origin settings

The settings UI shall expose default, home, and office origin values and origin types.

### REQ-UI-009: Eligibility settings

The settings UI shall expose optional title-pattern enablement and value.

### REQ-UI-010: Working-location setting

The settings UI shall expose working-location-based origin selection.

### REQ-UI-011: Validation feedback

Settings validation errors shall be shown near the relevant control or in a clear summary.

### 19.3 Event diagnostic card

### REQ-UI-012: Eligibility status

When an event is opened, the add-on shall show whether the event is eligible.

### REQ-UI-013: Ineligibility reason

For ineligible events, the add-on shall show the reason.

### REQ-UI-014: Effective calculation

For eligible events, the diagnostic card should show:

- selected origin category;
- destination;
- outbound duration;
- return duration;
- effective buffer;
- desired outbound start/end;
- desired return start/end.

### REQ-UI-015: No-write diagnostic

Opening or refreshing diagnostics shall not write generated events unless the user explicitly invokes synchronization.

### REQ-UI-016: Mobile limitation documentation

If Google does not support the add-on UI in mobile Calendar clients, Marketplace and support documentation shall state that limitation clearly while noting that installed automation still runs server-side.

### REQ-UI-017: Manual synchronization is asynchronous

The "Synchronize now" action shall enqueue reconciliation and return within the CardService callback budget, rather than running the full window inline.

An inline run succeeds only on calendars small enough not to need it. The action reports that synchronization has started; completion surfaces through the stored last-run record. The enqueue mechanism shares the one-off trigger machinery of partial-run continuations and is subject to Prototype Spike 1.

---

## 20. Error and Recovery Requirements

### REQ-ERROR-001: Error categories

The application shall distinguish at least:

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

User-visible messages shall explain the likely remediation without exposing stack traces or secrets.

### REQ-ERROR-003: No destructive response to transient planning error

A transient route or planning failure shall not cause deletion of existing generated events for the affected source.

### REQ-ERROR-004: Failed source isolation

Failure to plan one source event should not prevent reconciliation of unrelated source events unless the failure indicates a global condition such as invalid settings or Calendar authorization loss.

### REQ-ERROR-005: Automatic retry

Later Calendar, daily, or manual synchronization shall retry recoverable failures.

### REQ-ERROR-006: No fabricated success

The UI shall not report synchronization success when one or more required operations failed.

### REQ-ERROR-007: Partial-success result

The run-result model shall support partial success with error counts and summaries.

---

## 21. Security Requirements

### REQ-SEC-001: Least practical OAuth access

The project shall request only OAuth scopes required for documented behavior.

### REQ-SEC-002a: Scope selection is an architectural decision

The OAuth scope set shall be selected deliberately, recorded in an ADR, and verified against Google's current published scope classification before implementation.

No scope shall be added speculatively to support an undecided mechanism. In particular `openid` shall not appear in the manifest until broker authentication is selected.

### REQ-SEC-002: Explicit scopes

OAuth scopes shall be explicitly declared in the Apps Script manifest.

### REQ-SEC-003: Secret storage

Maps credentials and production broker secrets shall be stored in Secret Manager or an equivalent protected server-side secret store.

### REQ-SEC-004: No Maps key in distributed source

The production Maps API key shall not be embedded in Apps Script source or user-visible configuration.

### REQ-SEC-005: Input validation

The broker shall validate request structure, size, supported origin types, and travel mode.

### REQ-SEC-006: Abuse controls

The broker shall support rate limits, quotas, or equivalent safeguards against uncontrolled Maps cost.

### REQ-SEC-007: Authentication failure handling

Unauthenticated or invalid requests shall be rejected without invoking Maps.

### REQ-SEC-008: No unsafe HTML

User-derived event text displayed in CardService UI shall be escaped or handled using APIs that prevent markup injection.

### REQ-SEC-009: Dependency review

External dependencies shall be minimized and reviewed before Marketplace production release.

### REQ-SEC-010: Logging secrets

Logs shall not include access tokens, API keys, authorization headers, or complete secret values.

---

## 22. Privacy Requirements

### REQ-PRIV-001: Data minimization

Only data required to compute the route shall leave Apps Script for the routing backend.

### REQ-PRIV-002: No event content transmission

The routing backend shall not receive event summaries, descriptions, attendees, or conferencing data.

### REQ-PRIV-003: Clear disclosure

Marketplace and support documentation shall disclose that origins and destinations are processed by the project's routing backend and Google Maps.

### REQ-PRIV-004: No route retention by default

The broker shall not retain raw origins and destinations beyond what is technically necessary to process a request, unless a future retention feature is separately documented and consented to.

### REQ-PRIV-005: Aggregate metrics

Operational metrics shall use aggregate counts and non-sensitive labels.

### REQ-PRIV-006: User cleanup

Users shall have documented means to remove generated events and stored add-on settings.

### REQ-PRIV-007: Privacy policy

A publicly accessible privacy policy shall be available before Marketplace production submission.

---

## 23. Performance and Quota Requirements

### REQ-PERF-001: Bounded reconciliation

Ordinary reconciliation shall remain bounded by the configured planning window.

### REQ-PERF-002: No-write optimization

Unchanged generated events shall not be rewritten.

### REQ-PERF-003: Route request economy

The implementation shall avoid route calls when eligibility, source data, or cached planning inputs demonstrate that no recalculation is needed, provided correctness is preserved.

This is mandatory for the MVP, not an optimization. Fingerprints are computed after routing and therefore cannot prevent broker calls; see REQ-PERF-009.

### REQ-PERF-004: Execution measurement

Beta releases shall record reconciliation duration and event counts in non-sensitive structured logs or run status.

### REQ-PERF-005: Apps Script limits

The beta program shall validate practical behavior against Apps Script execution and service quotas.

### REQ-PERF-006: Pagination

Calendar listing shall handle API pagination.

### REQ-PERF-007: Broker timeout

Broker requests shall use bounded timeouts and shall not leave reconciliation hanging indefinitely.

### REQ-PERF-008: Scale target

The MVP should reliably handle an ordinary personal calendar with up to several hundred events in the planning window and a materially smaller subset of eligible travel events.

A precise supported maximum shall be established from beta measurements rather than assumed.

### REQ-PERF-009: Route plan cache

Route results shall be cached as derived state alongside the generated event they produced, keyed by a route input hash and stamped with a calculation time.

A cached result shall be reused when the route input hash is unchanged and the entry is less than 24 hours old. Reconciliation shall not refresh a route more than once per day per direction.

The cache shall never be authoritative. Discarding it may increase broker calls but shall not change the resulting Calendar state.

### REQ-PERF-010: Bounded route spend

Steady-state route consumption shall be bounded by the number of eligible events per day, not by trigger frequency.

Each reconciliation run shall enforce a maximum number of broker calls. On reaching that ceiling the run shall report `partial`, leave remaining events unplanned, and preserve their existing generated events.

The ceiling counts **HTTP attempts, including transient retries**, not logical route requests. A ceiling enforced above the retry layer would permit up to double the spend during a broker outage — exactly when the bound matters.

### REQ-PERF-011: Diagnostic route budget

Event-diagnostic route calls shall be counted against a per-user hourly ceiling and shall consult and populate the same route cache used by reconciliation.

When the ceiling is exceeded the diagnostic card shall still report eligibility, directives, and resolved origin, and shall indicate that timing is temporarily unavailable.

### REQ-PERF-013: Continuation after a partial run

A reconciliation run that stops at the per-run route ceiling shall schedule a continuation rather than deferring its remaining work to the next daily run.

Consecutive continuations shall be capped and the cap reported in run status, so that a persistent failure cannot loop indefinitely.

### REQ-PERF-017: Schedule-only changes cost no broker calls

A change to a source event that does not alter its route inputs — rescheduling, renaming, or any edit leaving location and effective origin unchanged — shall not cause broker calls while the cached route remains valid.

The route input hash excludes source times for exactly this reason. Rescheduling is the most common calendar edit; charging it two broker calls would waste quota and could push a cheap change into the per-run ceiling.

### REQ-PERF-016: Route age measured from calculation

A cached route duration shall carry the time the route was calculated, not the time it was read from any cache.

Where a duration passes through more than one cache, the original calculation time shall be preserved, so that freshness is measured from when the broker produced the value rather than from when it was most recently observed.

### REQ-PERF-015: Cache reachability

The planning path shall have access to the route cache entries of the observed companions for the source event being planned, and to an injected clock.

Cache entries live on generated events, which are matched to desired specifications only after planning. Unless observed companions are indexed before planning begins, no cache lookup is possible and REQ-PERF-009 and REQ-PERF-010 cannot be satisfied.

### REQ-PERF-014: Route cache persistence

A refreshed route cache entry shall be persisted even when the generated event's user-visible fields are unchanged, and shall include the complete cache record: route hash, duration, and calculation time.

Persisting only on user-visible change would leave the cache timestamp permanently stale. Persisting the duration and timestamp without the hash would leave a missing or corrupted hash in place, so the entry fails validation again on the next run despite the refresh. Either omission causes a broker call on every subsequent run, defeating REQ-PERF-010.

### REQ-PERF-012: Duration quantization

Route durations shall be rounded up to a 5-minute granularity before being used for generated event times or fingerprint computation.

Quantization exists so that refreshing an expired cache entry does not rewrite unchanged events or visibly move a user's travel blocks.

---

## 24. Observability and Support Requirements

### REQ-OBS-001: Last-run record

The application shall persist a compact per-user last-run record.

### REQ-OBS-002: Aggregate run counts

The run record shall include source, eligible, create, update, delete, ignore, and error counts.

### REQ-OBS-003: Trigger status

The add-on shall expose required trigger presence.

### REQ-OBS-004: Correlation identifier

Each reconciliation run should have an opaque correlation identifier usable across Apps Script and broker logs.

### REQ-OBS-005: Sensitive-data avoidance

Routine logs shall not include raw event titles, descriptions, or route addresses.

### REQ-OBS-006: Support diagnostics

The add-on should provide a user-copyable diagnostic summary containing versions, trigger health, counts, and normalized errors without exposing sensitive data.

### REQ-OBS-007: Broker metrics

The broker shall expose request count, latency, normalized errors, authentication failures, and quota/cost indicators.

---

## 25. Compatibility Requirements

### REQ-COMPAT-001: Apps Script V8

The Apps Script project shall use the V8 runtime.

### REQ-COMPAT-002: Advanced Calendar service

The implementation shall use the Advanced Calendar service or direct Calendar API where required for event types and private extended properties.

### REQ-COMPAT-003: Account capability variation

The implementation shall handle missing working-location support gracefully.

### REQ-COMPAT-004: Localization-safe metadata

Internal matching shall not depend on localized generated-event titles.

### REQ-COMPAT-005: Time-zone correctness

Behavior shall remain correct for users and events outside the project's development time zone.

### REQ-COMPAT-006: Marketplace review changes

If Marketplace policy requires scope or architecture adjustments, changes shall preserve the normative product behavior where possible and be documented through an ADR.

---

## 26. Release Requirements

### REQ-REL-001: Development environment

The project shall support a non-production Apps Script deployment and routing backend.

### REQ-REL-002: Beta environment

A limited tester release shall precede public production release.

### REQ-REL-003: Production isolation

Production broker credentials and billing controls shall be isolated from development where practical.

### REQ-REL-004: Version identification

User diagnostics shall identify the add-on release or deployment version.

### REQ-REL-005: CI validation

CI shall at minimum validate JSON, JavaScript formatting or linting, and pure unit tests before merge.

### REQ-REL-006: Marketplace materials

Production submission shall include:

- listing description;
- icons and screenshots;
- privacy policy;
- support URL;
- OAuth consent configuration;
- test instructions or accounts as required;
- accurate disclosure of data use.

### REQ-REL-007: Rollback capability

The deployment process shall support returning to a previously known-good Apps Script deployment and broker revision.

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

Material decisions should be captured in an ADR.
