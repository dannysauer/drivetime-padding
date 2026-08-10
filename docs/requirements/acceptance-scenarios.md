# Acceptance Scenarios

This document provides behavior-oriented scenarios for the MVP. Scenario identifiers map to the requirements traceability matrix.

---

## AC-INSTALL-001: First-time setup

**Given** a user has installed and authorized the add-on  
**And** no settings exist  
**When** the user opens the home card  
**Then** the add-on displays default settings  
**And** indicates that a default origin is required  
**And** does not create generated events until configuration is valid.

## AC-INSTALL-002: Trigger repair

**Given** the user has valid settings  
**And** the Calendar trigger is missing  
**When** the user runs Repair automation  
**Then** exactly one required Calendar trigger exists  
**And** exactly one required daily trigger exists  
**And** the UI reports success.

---

## AC-OOO-001: Create travel events for timed OOO event

**Given** automation is enabled  
**And** the default origin is configured  
**And** a timed OOO event is within the planning window  
**And** the event has a resolvable location  
**And** outbound route duration is 20 minutes  
**And** return route duration is 25 minutes  
**And** the configured buffer is 7 minutes  
**When** reconciliation runs  
**Then** an outbound OOO event exists from 27 minutes before the source start until the source start  
**And** a return OOO event exists from the source end until 32 minutes after the source end  
**And** both generated events contain private ownership metadata.

## AC-OOO-002: No duplicate writes

**Given** the generated events from AC-OOO-001 match desired state  
**When** reconciliation runs again without input changes  
**Then** no generated event is created, updated, or deleted  
**And** zero broker route calls are made, because both cached route entries are valid.

The broker-call assertion is part of this scenario, not a separate concern. A run that makes ten route calls and writes nothing still costs money on every trigger firing.

## AC-OOO-007: In-progress source event

**Given** a timed OOO event running 10:00–11:00 with matching generated events  
**And** the outbound block 09:28–10:00 has already ended  
**When** reconciliation runs at 10:15  
**Then** the outbound block is still within the read window and observed  
**And** no duplicate outbound event is created  
**And** the return block is preserved rather than treated as an orphan.

## AC-OOO-008: Route exceeds maximum supported travel

**Given** an eligible event whose location is an eight-hour drive from the resolved origin  
**When** reconciliation runs  
**Then** planning reports `ROUTE_TOO_LONG`  
**And** no generated events are created for that source  
**And** any pre-existing generated events for that source are preserved  
**And** the event diagnostic card explains the destination is beyond the supported range.

## AC-OOO-003: Source time changed

**Given** a source event has matching generated events  
**When** the user moves the source event by one hour  
**And** reconciliation runs  
**Then** the existing generated events are updated to surround the new time  
**And** no duplicate companions remain.

## AC-OOO-004: Source duration changed

**Given** a source event has matching generated events  
**When** the user extends the source end time  
**And** reconciliation runs  
**Then** the outbound event remains aligned to the source start  
**And** the return event begins at the new source end.

## AC-OOO-005: Source location changed

**Given** a source event has matching generated events  
**When** the source location changes  
**And** route durations change  
**Then** both generated events are recalculated and updated.

## AC-OOO-006: Source deleted

**Given** a source event has managed outbound and return events  
**When** the source is deleted  
**And** reconciliation runs  
**Then** both managed generated events are deleted.

---

## AC-ELIG-001: All-day event ignored

**Given** an all-day OOO event has a location  
**When** reconciliation runs  
**Then** no generated events are created  
**And** diagnostics state that all-day events are unsupported.

## AC-ELIG-002: Missing location ignored

**Given** a timed OOO event has no Calendar location  
**When** reconciliation runs  
**Then** no generated events are created  
**And** diagnostics state that a location is required.

## AC-ELIG-003: Ordinary event ignored by default

**Given** a timed ordinary event has a location  
**And** optional subject matching is disabled  
**When** reconciliation runs  
**Then** no generated events are created.

## AC-ELIG-004: Ordinary event included by pattern

**Given** optional subject matching is enabled with `^OOO:`  
**And** an ordinary timed event is named `OOO: Dentist`  
**And** it has a location  
**When** reconciliation runs  
**Then** ordinary outbound and return events are generated  
**And** they are not converted to OOO event type.

## AC-ELIG-005: Per-event off directive

**Given** an otherwise eligible event  
**And** its description contains `drivetime padding: off`  
**When** reconciliation runs  
**Then** no desired generated events exist for that source  
**And** any previously managed companions are deleted.

---

## AC-DIRECTIVE-001: Buffer override

**Given** an eligible source event  
**And** default buffer is 7 minutes  
**And** the description contains `drivetime padding: buffer=15m`  
**When** reconciliation runs  
**Then** 15 minutes is added to each direction rather than 7 minutes.

## AC-DIRECTIVE-002: Home origin override

**Given** default and home origins are configured  
**And** the description contains `drivetime padding: origin=home`  
**When** reconciliation runs  
**Then** both route calculations use the home origin.

## AC-DIRECTIVE-003: Invalid directive

**Given** an eligible source event  
**And** the description contains `drivetime padding: buffer=banana`  
**When** reconciliation runs  
**Then** the invalid directive is ignored  
**And** the default buffer is used  
**And** a non-fatal warning is available in diagnostics.

---

## AC-ORIGIN-001: Working from home

**Given** working-location selection is enabled  
**And** the source time overlaps a home working-location event  
**And** home origin is configured  
**When** reconciliation runs  
**Then** home origin is used.

## AC-ORIGIN-002: Working from office

**Given** working-location selection is enabled  
**And** the source time overlaps an office working-location event  
**And** office origin is configured  
**When** reconciliation runs  
**Then** office origin is used.

## AC-ORIGIN-003: Missing selected origin falls back

**Given** working-location resolves to office  
**And** office origin is not configured  
**And** default origin is configured  
**When** reconciliation runs  
**Then** default origin is used.

## AC-ORIGIN-004: Missing default origin blocks writes

**Given** no default origin is configured  
**When** reconciliation runs  
**Then** no generated events are created or deleted  
**And** the run reports invalid configuration.

---

## AC-REC-001: Simple recurring instances

**Given** a weekly recurring eligible event has four instances inside the window  
**When** reconciliation runs  
**Then** each instance has one outbound and one return event  
**And** all generated events are non-recurring.

## AC-REC-002: Move one instance

**Given** a weekly recurring event has generated companions  
**When** one instance is moved  
**And** reconciliation runs  
**Then** only the moved instance's generated companions change.

## AC-REC-003: Cancel one instance

**Given** a weekly recurring event has generated companions  
**When** one instance is cancelled  
**And** reconciliation runs  
**Then** only that instance's generated companions are deleted.

## AC-REC-004: Change one instance location

**Given** a weekly recurring event has generated companions  
**When** one instance receives a different location  
**And** reconciliation runs  
**Then** only that instance's routes and companions are recalculated.

## AC-REC-005: Window advances

**Given** a recurring instance is initially outside the 60-day window  
**When** the daily window advances to include it  
**Then** the next reconciliation creates its generated companions.

---

## AC-RECOVERY-001: Generated event deleted manually

**Given** a source event remains eligible  
**And** its outbound generated event is manually deleted  
**When** reconciliation runs  
**Then** the outbound event is recreated  
**And** the matching return event is not duplicated.

## AC-RECOVERY-002a: Moved event whose fingerprint still matches

**Given** a generated event that the user has dragged to a different time  
**And** the source event is unchanged, so the desired fingerprint equals the stored fingerprint  
**When** reconciliation runs  
**Then** the observed owned fields are compared against the desired specification  
**And** the mismatch is detected despite the matching fingerprint  
**And** the event is restored to its desired time.

Calendar preserves private extended properties through a user edit, so the stored fingerprint survives exactly the tampering it would need to detect. A fingerprint-only comparison would classify this as `unchanged` and silently fail AC-RECOVERY-002.

## AC-RECOVERY-002: Generated event moved manually

**Given** a source event remains eligible  
**And** a generated event is manually moved  
**When** reconciliation runs  
**Then** the event is restored to desired time.

## AC-RECOVERY-003: Metadata removed

**Given** a generated-looking event has had all Drivetime Padding metadata removed  
**When** reconciliation runs  
**Then** that event is not deleted based on title  
**And** a new managed event is created if required.

## AC-RECOVERY-004: Route broker temporary failure

**Given** a source event remains eligible  
**And** valid generated events already exist  
**When** the route broker returns a transient error  
**Then** existing generated events are preserved  
**And** the run reports a planning error  
**And** a later reconciliation retries.

## AC-RECOVERY-005: Partial write failure

**Given** neither generated event exists  
**When** outbound creation succeeds and return creation fails  
**Then** the run reports partial success  
**And** the next reconciliation creates the missing return event without duplicating outbound.

---

## AC-CACHE-001: Expired cache, immaterial change

**Given** generated events whose cached route entries are older than 24 hours  
**And** the broker now returns 1455 seconds where it previously returned 1440  
**When** reconciliation runs  
**Then** both values quantize to 1500 seconds  
**And** the fingerprint is unchanged  
**And** the diff records a **metadata patch**, not an update and not `unchanged`  
**And** the patch body contains only `routeSecs` and `routeAt`  
**And** the event's start, end, summary, event type, and transparency are not written  
**And** a subsequent run within 24 hours makes zero broker calls.

The final assertion is the point of the scenario. Classifying this as `unchanged` and skipping the write would leave `routeAt` permanently stale, so every later run would call the broker again — reintroducing exactly the unbounded cost the cache exists to prevent. The write is required; what makes it safe is that the user sees nothing.

## AC-CACHE-002: Selective invalidation

**Given** eligible events resolving to a mix of the default origin and the home origin  
**When** the user changes only the home origin  
**Then** route cache entries for home-origin events are invalidated  
**And** cache entries for default-origin events remain valid and cause no broker calls.

## AC-CACHE-003: Route budget prevents stampede

**Given** more eligible events than `MAX_ROUTE_CALLS_PER_RUN` allows after a settings change invalidates every cache entry  
**When** reconciliation runs  
**Then** the run stops planning at the ceiling and reports `partial`  
**And** unplanned events retain their existing generated events rather than having them deleted  
**And** subsequent runs drain the remainder.

## AC-CACHE-004: Diagnostic card budget

**Given** a user has opened diagnostic cards enough times to reach the hourly route ceiling  
**When** another diagnostic card is opened for an unplanned event  
**Then** eligibility, directives, and resolved origin are still displayed  
**And** no broker call is made  
**And** the card reports that timing is temporarily unavailable.

## AC-OOO-010: Long-running in-progress source

**Given** a timed OOO source event running 01:00–18:00 with matching generated events  
**And** the current time is 12:00, so the source started before the 8-hour lookback  
**When** reconciliation runs  
**Then** the source is planned, because it overlaps the planning range  
**And** it is **not** reported `OUTSIDE_WINDOW`  
**And** its return block at 18:00 is preserved rather than deleted as ineligible.

A start-time containment test would fail this scenario, and because ineligibility carries deletion authority the failure would delete a needed return block mid-appointment.

## AC-REC-006: Cancelled tombstone without timestamps

**Given** a cancelled recurring instance returned by `showDeleted: true`  
**And** the tombstone carries only identity, recurrence linkage, and original start — no `start` or `end`  
**When** eligibility is evaluated  
**Then** cancellation is recognized before any timestamp is read  
**And** normalization does not throw on the missing values  
**And** the reason is `CANCELLED_EVENT`, granting deletion authority  
**And** the instance's companions are deleted.

## AC-RECOVERY-006: Source moved outside the observation range

**Given** generated events whose source has been moved far beyond `observeEnd`  
**And** the scan completes successfully  
**When** reconciliation runs  
**Then** the companions are treated as orphaned and deleted  
**And** they are not preserved indefinitely on the grounds that their parent was not evaluated.

**Given** the same state but a scan truncated by pagination failure or execution budget  
**When** reconciliation runs  
**Then** the companions are preserved  
**And** the run records `scanComplete: false`.

## AC-RECOVERY-007: Marker removed between read and write

**Given** a generated event queued for deletion  
**And** a concurrent client removes its `dtp` marker after the read but before the write  
**When** the diff is applied  
**Then** the delete does not remove the event  
**And** the run records the conflict rather than silently succeeding.

## AC-CACHE-007: Corrupt cached duration is not trusted

**Given** a generated event whose `routeHash` matches and whose `routeAt` is fresh  
**And** whose `routeSecs` holds a negative, non-numeric, or non-integer value  
**When** reconciliation runs  
**Then** the entry is treated as absent  
**And** the broker is called  
**And** no companion time is derived from the corrupt value.

## AC-CACHE-008: Diagnostics warm an ephemeral cache

**Given** an eligible event with no generated events yet  
**When** the diagnostic card is opened twice within the ephemeral cache TTL  
**Then** the first open calls the broker and writes the ephemeral cache  
**And** the second open makes no broker call  
**And** neither open creates a Calendar event.

## AC-OOO-011: Extending only the source end

**Given** a source event with matching outbound and return blocks  
**When** the user extends only the source end time  
**Then** the return block is updated  
**And** the outbound block is **not** written, because its fingerprint does not include the source end.

## AC-ELIG-007: Out of Office inclusion disabled

**Given** an otherwise eligible real OOO event with a location  
**And** `eligibility.includeOutOfOffice` is false  
**And** title-pattern matching is disabled  
**When** reconciliation runs  
**Then** the reason is `OUT_OF_OFFICE_DISABLED`, not `TITLE_PATTERN_NO_MATCH`  
**And** no generated events are created  
**And** any existing companions for that source are deleted, because the source is ineligible rather than failed.

**Given** the same event  
**And** title-pattern matching is enabled with a pattern its title matches  
**When** reconciliation runs  
**Then** the event qualifies through the pattern  
**And** the companions are ordinary events, not `outOfOffice`, because the provider received `matchedBy: "titlePattern"` and keys the type on the match rather than the source type.

The toggle governs automatic OOO treatment, not just inclusion. Keying the companion type on the source's event type would emit exactly the OOO blocks the user switched off.

## AC-ELIG-008: Blank summary does not match a broad pattern

**Given** a timed OOO event with a location and an empty summary  
**And** title-pattern matching is enabled with a pattern that matches the text `Untitled event`  
**When** eligibility is evaluated  
**Then** matching is performed against the raw empty summary  
**And** the event does not qualify through the pattern.

**Given** the same event qualifying through its OOO event type instead  
**When** generated events are produced  
**Then** their subjects use the display fallback  
**And** read `[Drivetime Padding] Travel to Untitled event`.

## AC-CACHE-009: Provider can reach the observed cache

**Given** a source event whose companions carry valid `routeHash`, `routeSecs`, and `routeAt`  
**When** reconciliation plans that source  
**Then** the planning context receives those cache entries keyed by role  
**And** the routing client reuses them  
**And** zero broker calls are made  
**And** each `RouteResult` reports `source: "durable"`.

This scenario exists because the cache is only reachable if observed companions are indexed before planning. An implementation that builds the provider context from the source event alone passes every other cache scenario in this document while calling the broker on every run.

## AC-RECOVERY-008: Reminders re-enabled on a travel block

**Given** a generated travel block created with reminders suppressed  
**And** the user enables a 10-minute popup reminder on it  
**And** the source event is otherwise unchanged, so the fingerprint still matches  
**When** reconciliation runs  
**Then** the owned-field comparison detects the reminder difference  
**And** the event is updated to restore suppression  
**And** the user does not receive an alert for the travel block on the next run.

Reminder state is not a planning input, so the fingerprint cannot detect this. It is caught only because reminders are in the owned-field set — the same reason a manual time change is caught.

## AC-CACHE-010: Route age survives the ephemeral cache

**Given** the diagnostic card warms the ephemeral cache for an unplanned event at 09:00  
**And** reconciliation consumes that entry at 12:00 and creates the companions  
**When** the durable cache entry is written  
**Then** `routeAt` records 09:00, the time the broker produced the duration  
**And** not 12:00, the time the entry was read  
**And** the entry expires 24 hours after 09:00 rather than after 12:00.

Stamping the read time would let a duration live up to one ephemeral TTL longer than `ROUTE_CACHE_MAX_AGE_HOURS` permits.

## AC-CONFIG-002: Reducing the planning window

**Given** `windowDays` is 180  
**And** generated events exist for a source event 90 days out  
**When** the user reduces `windowDays` to 7  
**And** reconciliation runs  
**Then** the ownership-filtered cleanup pass reads the span between the new horizon and the previous high-water mark  
**And** the companions 90 days out are deleted  
**And** the high-water mark is lowered only after those deletions succeed.

**Given** the same shrink but a cleanup pass that fails partway  
**When** reconciliation runs again  
**Then** the high-water mark is still high  
**And** the remaining stranded companions are found and deleted.

Without the high-water mark the contracted observation range never reads those events, so they would survive until the rolling window grew back out to them — roughly 82 days here, during which the setting appears to do nothing.

## AC-CACHE-011: Reschedule costs no broker calls

**Given** a source event with matching companions and valid route cache entries  
**When** the user moves the event two hours later without changing its location  
**And** reconciliation runs  
**Then** both companions are updated to surround the new time  
**And** zero broker calls are made, because the route input hash excludes source times  
**And** both refreshed companions retain their cached durations.

Rescheduling is the most common calendar edit. If it cost two broker calls, the cache would only protect calendars nobody touches.

## AC-CACHE-012: Corrupt hash is repaired, not just refreshed

**Given** a generated event whose `routeHash` is missing or corrupted while its visible fields are correct  
**When** reconciliation runs  
**Then** the cache entry fails validation and the broker is called once per direction  
**And** the metadata patch persists `routeHash`, `routeSecs`, and `routeAt` together  
**And** the next run makes zero broker calls.

Patching only the duration and timestamp would leave the bad hash in place, so the entry would fail validation again on every subsequent run — a freshly stamped cache that never becomes usable.

## AC-RECOVERY-009: Incomplete scan does not create duplicates

**Given** a source event with existing companions  
**And** an observation scan that fails after reading the source but before reaching its return block  
**When** reconciliation runs  
**Then** the run records `scanComplete: false`  
**And** no create is performed for the seemingly missing return block  
**And** no orphan deletion is performed  
**And** updates and metadata patches for events that were read proceed normally  
**And** the run reports `partial`.

Creates and deletes both act on absence, and a truncated scan proves only that an event was not reached — not that it does not exist.

## AC-ORIGIN-005: Place ID origin survives the return route

**Given** the effective origin is configured as a Place ID  
**When** both routes are calculated  
**Then** the return request carries the Place ID with its type intact as the destination endpoint  
**And** the return cache entry is keyed on the typed endpoint pair  
**And** the Place ID is never flattened to an address string.

## AC-CACHE-005: Buffer change costs no broker calls

**Given** eligible events with valid route cache entries  
**When** the user changes only `defaultBufferMinutes`  
**Then** no cache entry is invalidated, because the route input hash excludes the buffer  
**And** zero broker calls are made  
**And** generated events are updated, because the buffer changes event times and therefore the fingerprint.

## AC-CACHE-006: Partial run continues without waiting a day

**Given** an origin change invalidating more route directions than `MAX_ROUTE_CALLS_PER_RUN` allows  
**When** reconciliation runs and stops at the ceiling  
**Then** the run reports `partial`  
**And** a continuation is scheduled rather than the work deferring to the next daily run  
**And** the continuation completes the remaining events  
**And** events already processed cost no broker calls, because their cache entries are now valid  
**And** consecutive continuations stop at the documented cap.

## AC-OOO-009: Source event straddling the far window edge

**Given** a timed source event starting shortly before `planEnd` and ending after it  
**And** matching generated events already exist  
**When** reconciliation runs  
**Then** the source is planned, because its start falls inside the planning range  
**And** its return block — which begins after `planEnd` — is still observed  
**And** no duplicate return event is created.

Without the observation range extending past `planEnd`, `timeMax` would exclude the return block while still returning its source, and a duplicate would be created on every run. This is the mirror image of AC-OOO-007.

## AC-ELIG-006: Overlong timed source event

**Given** a timed source event lasting more than `MAX_SOURCE_DURATION_MINUTES`  
**When** eligibility is evaluated  
**Then** the reason is `SOURCE_TOO_LONG`  
**And** no generated events are created.

## AC-CONFIG-001: Malformed persisted settings

**Given** User Properties containing the string `"false"` where `eligibility.titlePatternEnabled` expects a boolean  
**When** settings are loaded  
**Then** validation fails with a type error for that field rather than treating the value as truthy  
**And** write-mode reconciliation is blocked  
**And** dry-run diagnostics still run so the user can see the problem.

**Given** a non-string `origins.default.value`  
**When** settings are loaded  
**Then** validation fails before any route hashing is attempted, rather than throwing inside a trigger.

## AC-INSTALL-003: Trigger verification

**Given** a fresh Marketplace installation  
**When** installation completes  
**Then** the required Calendar and daily triggers exist  
**And** each executes under the installing user's authorization context  
**And** the home card reports both as installed.

> Depends on Prototype Spike 1. If Marketplace-installed add-ons cannot create installable triggers, this scenario and the architecture behind it must be redesigned.

## AC-DRYRUN-001: Dry run

**Given** an eligible event has no generated companions  
**When** dry-run reconciliation executes  
**Then** the result reports two creates  
**And** Calendar remains unchanged  
**And** stored automation state — the last-run record, the window high-water mark, and the continuation counter — is unchanged, so a preview never alters how a later real run classifies or reports.

---

## AC-PRIV-001: Broker payload minimization

**Given** a route request is made  
**When** the broker request is inspected  
**Then** it contains origin, destination, mode, and optional correlation data only  
**And** contains no event title, description, attendee, or recurrence data.

## AC-SEC-001: Invalid broker authentication

**Given** a broker request has invalid authentication  
**When** the broker receives it  
**Then** the broker rejects it before calling Google Maps  
**And** records an authentication-failure metric without logging secrets.

---

## AC-ELIG-009: Qualification path changes the companion event type

**Given** a source event whose companions were created as `outOfOffice` events  
**And** the user disables `includeOutOfOffice` while the source still matches the title pattern  
**When** reconciliation runs  
**Then** each companion is deleted and recreated as an ordinary event  
**And** no patch attempts to change `eventType` in place  
**And** the run counts one replacement per companion, not an unrelated delete and create.

Calendar declares `eventType` immutable after creation. A patch carrying a different type fails identically on every run, leaving the companion permanently wrong.

## AC-RECOVERY-010: A rejected write is reported, not absorbed

**Given** a reconciliation diff proposing two creates  
**And** Calendar rejects one of them  
**When** the run completes  
**Then** the stored last-run record counts one create and one failed write  
**And** the run status is `partial`, not `success`  
**And** the failure's error record appears in the result.

Status is built from what Calendar accepted, not from what the diff proposed. Self-healing on the next run excuses the missing rollback, never the missing report.

## AC-RECOVERY-011: Overlong source's stale companions are removed

**Given** a source event that had companions created while it was eligible  
**And** the source is later extended beyond `MAX_SOURCE_DURATION_MINUTES` — as a timed event or by conversion into a multi-day all-day event  
**And** enough time passes that at least one companion falls before `observeStart` while the source remains in the observation range  
**When** reconciliation runs  
**Then** the source is classified ineligible (`SOURCE_TOO_LONG` or `ALL_DAY_EVENT`)  
**And** its companions are located by ownership and parent metadata outside the window bounds  
**And** all of them are deleted in that same run  
**And** no event id appears in the delete list twice, even when one companion was also queued by the ordinary comparison.

Definitive ineligibility carries deletion authority, but the window scan cannot reach companions the overlong source stranded behind `observeStart`. The lookup keys on the duration, not the classification reason — the all-day check runs before the duration check, so a multi-day all-day conversion never reports `SOURCE_TOO_LONG` — and fires when either role is missing, so a half-stranded pair is cleaned in one run.

## AC-CACHE-013: Zero-second route is cached and reused

**Given** a source event whose origin and destination resolve to coincident endpoints  
**And** the broker returns a zero-second duration  
**When** reconciliation runs twice within the carrying tier's lifetime — the durable cache age limit when a companion exists to carry the entry, or the shorter ephemeral TTL when the zero-padding rule (§12.5) emitted no companions  
**Then** the second run makes no broker call  
**And** the cached zero is accepted by validation rather than treated as absent  
**And** the entry is served from the tier that carries it.

Zero is a legitimate duration. A truthiness check on the cached value would reject it before validation, forcing a broker call and metadata rewrite on every run. The two tiers have different lifetimes: the ephemeral tier is capped by CacheService well under `ROUTE_CACHE_MAX_AGE_HOURS` (§20.3), so a companion-less zero route re-fetched after ephemeral eviction is conformant — §12.5's bound is two broker calls per ephemeral TTL, not per durable lifetime.

## AC-CONFIG-003: Companion spanning the reduced horizon is not double-handled

**Given** `windowDays` is reduced  
**And** a managed companion starts before the new `observeEnd` but ends after it  
**When** reconciliation runs  
**Then** the shrink cleanup pass excludes that companion  
**And** only the ordinary comparison decides whether it is updated, unchanged, or deleted  
**And** no delete and update are queued for the same event in one run.

`Events.list` bounds `timeMin` on event end, so a boundary-spanning event is visible to both the observation read and the cleanup scan; without the start filter, a cleanup delete races the comparator's repair and the delete-first write order wins.

## AC-ELIG-010: Special event types cannot qualify by title pattern

**Given** a timed `fromGmail` event with a location whose title matches the enabled pattern  
**When** eligibility is evaluated  
**Then** the reason is `UNSUPPORTED_EVENT_TYPE`  
**And** the title pattern is never consulted  
**And** no generated events are created.

Pattern inclusion is limited to ordinary events. Without a type gate ahead of pattern matching, `UNSUPPORTED_EVENT_TYPE` is unreachable and special-type sources silently gain default-typed companions.

## AC-CACHE-014: Ephemeral hit still repairs the durable cache

**Given** a diagnostic has warmed the ephemeral cache for a route  
**And** the companion's durable cache entry is expired  
**When** reconciliation plans that source  
**Then** no broker call is made  
**And** the `RouteResult` reports `source: "ephemeral"`  
**And** the durable triplet is patched onto the companion, so the run after ephemeral eviction also makes no broker call.

An ephemeral hit avoids the broker call, not the metadata patch. A boolean cached/not-cached flag conflates the tiers and strands the stale durable entry.

## AC-CACHE-015: Transient retries spend the route budget

**Given** a run whose broker calls each receive a 503 and succeed on the immediate retry  
**When** the run reaches the per-run route ceiling  
**Then** the total HTTP attempts made, including retries, do not exceed `MAX_ROUTE_CALLS_PER_RUN`  
**And** remaining events are left unplanned as `ROUTE_BUDGET_EXCEEDED`  
**And** their existing companions are preserved.

The ceiling bounds wire traffic. Counting logical calls instead would double the spend exactly when the broker is struggling.

## AC-CONFIG-004: Remove-all reaches events outside the window

**Given** managed events exist both inside the observation range and far outside it (aged out, or beyond a shrunken horizon)  
**And** the user confirms "Remove all generated events and disable automation"  
**When** the action runs  
**Then** the card action returns within the callback budget, having persisted `settings.enabled` as `false`, removed the triggers, and enqueued the cleanup worker  
**And** the worker deletes every managed event in budget-bounded passes, including events no window-bounded scan would read, re-enqueueing itself until the scan completes  
**And** cumulative progress is persisted and shown by the home card while cleanup is running  
**And** on every terminal outcome except a user-initiated abort — success and failure alike — the stored settings are replaced with a minimal disabled tombstone, removing configured origin addresses  
**And** the final record reports deleted and failed counts, with a retry offered when any deletion failed  
**And** a later manual synchronization or trigger repair does not regenerate events or triggers.

"All" must mean all: the ordinary scans are bounded by the rolling window, and a cleanup built on them silently misses history and stranded events. And the deletions cannot live in the card callback — its execution budget is fixed while the user's history is not, and a timeout mid-cleanup would leave events and personal settings behind at exactly the moment the user is preparing to uninstall.

## AC-RECOVERY-012: Companion dragged outside the window is restored

**Given** a source event with a managed return block  
**And** the user drags that return block months into the future, beyond `observeEnd`  
**When** reconciliation runs with a complete scan  
**Then** no new return block is created  
**And** the moved managed event is located by ownership and parent metadata without time bounds  
**And** it is updated back to the desired time.

Duplicate convergence cannot help here: one copy is outside every range the ordinary read covers. The create path must look before it leaps.

## AC-RECOVERY-013: Execution cutoff does not orphan unplanned sources

**Given** a run whose observation scan completed  
**And** the execution-time threshold is reached partway through planning  
**When** the run stops planning and applies its diff  
**Then** every unprocessed source carries a `failed` planning outcome (`EXECUTION_BUDGET_EXCEEDED`)  
**And** none of their existing companions are deleted as orphans  
**And** the run reports `partial`.

Absence from `planningOutcomes` plus a complete scan means orphan. Sources skipped for time must be marked, or the degradation path deletes travel blocks because the run was slow.

## AC-RECOVERY-014: A run-wide failure is recorded, not swallowed

**Given** persisted settings that fail validation  
**When** a trigger fires reconciliation  
**Then** the run returns a structured result with status `failed` and an `INVALID_SETTINGS` error  
**And** the stored last-run record reflects that failure  
**And** the home card does not continue to display the previous run's success.

## AC-OOO-012: Coincident endpoints with zero buffer produce no blocks

**Given** an eligible source event whose origin and destination coincide (zero-second route)  
**And** the effective buffer is 0 minutes  
**When** reconciliation runs  
**Then** no companion is created for either direction  
**And** any existing companions for that source are deleted as orphans of a planned parent  
**And** no insert of a zero-length event is ever attempted.

Calendar rejects zero-length events; without this rule every reconciliation would end `partial` on an insert that can never succeed.

## AC-CONFIG-005: Diagnosing an event outside the window reports the reason

**Given** a source event starting beyond the planning horizon  
**When** the user opens the event diagnostic card  
**Then** the event is fetched by id rather than through the window scan  
**And** the card reports `OUTSIDE_WINDOW`  
**And** no full window listing is performed for the card open.

A window-scan-based diagnostic would return silence for exactly the events users most wonder about.

## AC-RECOVERY-015: Companion stranded by a deleted source is swept

**Given** a managed companion dragged outside the observation range  
**And** its source event deleted before any reconciliation runs  
**When** the next daily maintenance run executes  
**Then** the ownership sweep finds the companion via its persisted `anchor`  
**And** a point read confirms the parent no longer exists  
**And** the companion is deleted  
**And** historical companions whose anchors lie outside the slacked planning range trigger no parent lookups.

**Given** instead the source still exists but was moved outside the planning range together with its companion  
**When** the next daily maintenance run executes  
**Then** the point read finds the live parent, sees it was not evaluated this run, and the companion is deleted — an out-of-window source's desired state is no companions, and they regenerate when it re-enters the window.

Restoration (AC-RECOVERY-012) is driven by a pending create, which requires a live parent planning inside the window; a deleted or out-of-window parent leaves nothing pending and the stray invisible to the bounded scan. Only a scan independent of desired state can find it, and the anchor is what keeps that scan from probing every historical event daily.
