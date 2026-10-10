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
**And** the outbound block is a same-anchor concluded record, so the §15.2.9 freeze fires before routing: the role is emitted as the pinned spec (never suppressed), no broker call is spent on it, and the key classifies `unchanged`  
**And** no duplicate outbound event is created  
**And** the return key matches its block as `unchanged`, preserved rather than treated as an orphan.

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

## AC-DIRECTIVE-004: Directives in an HTML description

**Given** an otherwise eligible event  
**And** its description, as the Calendar API returns it, is `<div>Patient notes<br>drivetime padding: off</div>`  
**And** another eligible event's description is `Notes<br><b>drivetime&nbsp;padding</b>: buffer=15m`  
**When** reconciliation runs  
**Then** the first event is disabled by directive and has no desired generated events  
**And** the second event uses a 15-minute buffer  
**And** neither event reports a directive warning.

## AC-DIRECTIVE-005: Malformed prefixed lines warn

**Given** an eligible source event with a default buffer of 7 minutes  
**And** its description contains, on separate lines, `drivetime padding: buffer=15m`, `drivetime padding buffer=30m`, `drivetime padding: origin=gym`, and `Remember drivetime padding: off is not wanted`  
**When** the event card's diagnostics run  
**Then** the buffer is 15 minutes — no malformed line overrides the valid one  
**And** the origin is resolved as if no origin directive were present  
**And** the directive warnings quote each of the two malformed lines — `drivetime padding buffer=30m` and `drivetime padding: origin=gym` — and there are exactly two  
**And** the last line, which does not begin with the prefix, is ordinary text: it neither disables the event nor produces a warning.

## AC-DIRECTIVE-006: Plain-text angle brackets are not tags

**Given** an otherwise eligible event whose description, as the Calendar API returns it, is the plain text `Parking <$10`, then on the next line `drivetime padding: off`, then on the next line `-> use entrance B`  
**And** another eligible event's plain-text description is `if a < b then <not a tag>`, then on the next line `drivetime padding: buffer=15m`, then on the next line `contact <pat@example.com>`  
**When** reconciliation runs  
**Then** the first event is disabled by directive and has no desired generated events — no span from `<` to a later `>` is removed across lines  
**And** the second event uses a 15-minute buffer  
**And** the extracted text of both keeps `<$10`, `a < b`, `<not a tag>` and `<pat@example.com>` as written  
**And** neither event reports a directive warning.

## AC-DIRECTIVE-007: An out-of-range numeric entity is left as written

**Given** an otherwise eligible event whose plain-text description is `ref &#99999999; and &#x110000; and &#xD800; and &#0;`, then on the next line `drivetime padding: off`  
**And** another eligible event's description is `caf&#233; &#x2014; notes`, then on the next line `drivetime padding: buffer=15m`  
**When** reconciliation runs  
**Then** the first event is disabled by directive and has no desired generated events — the run does not fail the event, report it `partial`, or raise `UNEXPECTED_ERROR`  
**And** its extracted text keeps `&#99999999;`, `&#x110000;`, `&#xD800;` and `&#0;` exactly as written, because none is a Unicode scalar value  
**And** the second event's extracted text decodes to `café — notes` and the event uses a 15-minute buffer.

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

**Given** the same source, but the outbound block is deleted after the source has started (`source.start < now`)  
**When** reconciliation runs  
**Then** the outbound role is `ended` and nothing is recreated — the block would end in the past (REQ-GEN-001's ended exception, AC-OOO-013)  
**And** the outcome is still `planned`, and a return block still ahead is maintained as usual.

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
**And** the patch body contains only the route cache triplet — `routeHash`, `routeSecs`, and `routeAt` — so a missing or mismatched hash is repaired in the same write  
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

**Given** the same state but an incomplete scan — the window listing stopped at its read-budget guard, or the run resumed a continuation cursor — that never reached the source  
**When** reconciliation runs  
**Then** the run records `scanComplete: false`  
**And** each unmatched companion's parent is point-read: the fetched source is live but beyond the planning range, so it desires no companion and the companions are deleted this run (§15.2.3)  
**And** only companions whose point read never ran — the evidence tier ran out first — are preserved, counted in `suppressedDeletes`, and resolved by a later run.

A page fetch that fails is not an incomplete scan: it fails the whole run (AC-RECOVERY-030).

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
**And** title-pattern matching is enabled with a pattern its title does not match, or the title is longer than `MAX_TITLE_PATTERN_SUBJECT_CHARS`  
**When** reconciliation runs  
**Then** the reason is still `OUT_OF_OFFICE_DISABLED`, not `TITLE_PATTERN_NO_MATCH` or `TITLE_TOO_LONG` — the toggle that declined the event's type is the control the card names.

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
**And** a stranded companion the run also matched to a planned key (restoration, or co-observation under a pinned scan cursor) is realigned inside the window instead of deleted  
**And** the high-water mark is lowered only after every stranded event is **resolved** — deleted, or realigned by an applied write; a failed or deferred realignment holds the mark exactly like a failed deletion.

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
**And** an observation scan that stops at its read-budget guard after reading the source but before reaching its return block  
**When** reconciliation runs  
**Then** the run records `scanComplete: false`  
**And** the pending create for the seemingly missing return block is resolved through the unbounded per-parent companion lookup, which finds the existing block — it is **updated**, never duplicated (classified through the same update-versus-replace rules as an in-window match)  
**And** creates the budget-cut lookup pass never resolved are withheld from application (`suppressedCreates`) while everything the pass did resolve still applies  
**And** orphan deletion proceeds only for unmatched companions with per-parent evidence: a point read proving the parent absent or cancelled, or a fetched live parent evaluated to desire no companion for the key; a live parent still desiring the key preserves its companion this run  
**And** updates and metadata patches for events that were read proceed normally  
**And** the run reports `partial`.

Creates and deletes both act on absence, and a truncated scan proves only that an event was not reached — not that it does not exist. Both upgrade to per-event evidence: the create's parent lookup is complete for that parent whatever the scan covered, and the delete's parent point read proves absence the same way the daily sweep's absent-parent rule does.

## AC-RECOVERY-017: Continuations advance through a calendar too large for one scan

**Given** a calendar whose observation range spans more pages than one execution budget can list  
**When** a run truncates its window scan and schedules a continuation  
**Then** the truncated run persists the listing cursor pinned to its observation range and pivot  
**And** the listing itself is ordered upcoming-first across pages — the forward segment from the pivot first, then the backward one, each by start time — so the truncated prefix holds the imminent appointments rather than an unspecified subset (§23.2)  
**And** a timed event spanning the pivot is listed once — owned by the forward segment and filtered from the backward one — so no source is planned twice and no companion is indexed as two copies; an all-day or end-less return is listed at most once per slice, harmlessly  
**And** the continuation resumes listing from that cursor instead of re-reading the same prefix  
**And** successive passes plan, update, and — through the per-parent lookup — create for successive slices of the calendar  
**And** unmatched companions in each slice are deleted only on per-parent evidence — a point read proving the parent absent or cancelled, or a fetched live parent evaluated to desire no companion for the key, so a stale companion split from its live source by a page boundary is still cleaned up — and preserved when the parent still desires the key or the read never ran  
**And** a chain longer than one day's continuation allowance survives the episode boundary: the daily run resets the allowance and resumes the pending cursor  
**And** when a chain is pending at daily time because its continuation could not be scheduled, the daily run resumes the chain rather than scanning fresh, and the deferred fresh-window pass completes within one daily cycle of the chain completing, in every case — two daily cycles *measured from the original deferral* when the resumed chain finishes within the day's allowance, the REQ-TRIGGER-002 carve-out for this compound failure (the daily sweep needs a complete scan, which a calendar this size never yields; its absence there is the design's accepted residual, not a failure of this bound)  
**And** intervening calendar-trigger runs scan fresh without overwriting the chain's pending cursor  
**And** a run that throws or times out after its listing never advances the cursor past its unapplied slice — cursor saves are application-gated, so a failed run's slice is re-read rather than skipped — while the skip-safe clear decisions still execute on a timed-out run (and a rejected dead token's eagerly, at listing time), so a stale chain cursor never captures the continuation a fresh complete scan schedules  
**And** a role the provider suppressed (§12.5 — zeroed out of existence by its route, or already ended with no undisplaced same-anchor companion observed) has its displaced stale split-slice companion removed through the targeted suppressed-role lookup, which needs no pending create and no complete scan  
**And** a lost or expired cursor degrades to a fresh scan from the front, never to an error.

Without the cursor, every continuation re-issues the same query from the first page, retrieves the same prefix, and truncates at the same depth — the chain reaches the continuation cap having repeated itself, and every source past the truncation point stays unreconciled indefinitely.

## AC-ORIGIN-005: Place ID origin survives the return route

**Given** the effective origin is configured as a Place ID  
**When** both routes are calculated  
**Then** the return request carries the Place ID with its type intact as the destination endpoint  
**And** the return cache entry is keyed on the typed endpoint pair  
**And** the Place ID is never flattened to an address string.

## AC-ORIGIN-006: All-day working location covers the user's own day

**Given** working-location selection is enabled with home and office origins configured  
**And** the calendar's time zone is `America/Los_Angeles` (UTC−7 in summer)  
**And** an all-day `Office` working location is set for Monday and an all-day `Home` one for Tuesday  
**And** eligible sources run Monday 18:00–19:00 and Tuesday 18:00–19:00 local time  
**When** reconciliation runs  
**Then** the Monday source routes from the office origin and the Tuesday source from the home origin  
**And** neither all-day working location is placed at UTC midnight, which would make Tuesday's `Home` cover Monday evening  
**And** when the working-location listing reports no time zone, the all-day events are dropped and both sources use the default origin.

## AC-ORIGIN-007: A whitespace-only optional origin falls back to the default

**Given** the default origin is configured  
**And** the stored `origins.home.value` is `"   "` (whitespace only)  
**And** an eligible event's description contains `drivetime padding: origin=home`  
**When** settings are loaded and reconciliation runs  
**Then** `loadSettings` returns `origins.home.value` as the empty string, and validation passes  
**And** both routes for the event use the default origin, not an empty endpoint  
**And** the event's diagnostics carry `DIRECTIVE_ORIGIN_UNCONFIGURED`, because the requested `home` origin was not used  
**And** no broker request is made with an empty origin and the event does not fail as an invalid origin.

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
**And** consecutive continuations stop at the documented cap  
**And** the continuation is scheduled even though every `ROUTE_BUDGET_EXCEEDED` outcome is registered `continuable: false`: the cause is the exhausted budget the engine records in the run's diagnostics (`routeBudgetExhausted`), spent productively — the attempts returned routes, so `routeAttemptsProductive` is non-zero — not the outcomes.

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
**And** a dry-run diagnostic does not plan against the settings: it returns `status: "failed"` with the type error in `validationErrors` (Technical Design §5.3, §17.2; as in AC-CONFIG-013), and the diagnostic card renders that list so the user can see the problem.

**Given** a non-string `origins.default.value`  
**When** settings are loaded  
**Then** validation fails before any route hashing is attempted, rather than throwing inside a trigger.

**Given** instead a stored document whose `schemaVersion` is `-1`, `null`, or the string `"2"`; or a valid old version whose migration chain is missing an intermediate entry; or a migration that throws on a structurally partial old document or returns without advancing the version  
**When** settings are loaded  
**Then** every one of those states is reported as a structural `INVALID_SETTINGS` error on `schemaVersion` naming the version the chain could not get past — never a throw inside a trigger and never an unterminated migration loop —  
**And** the settings card offers the reset-to-defaults path.

**Given** instead `dtp.settings` holding truncated or otherwise malformed JSON  
**When** settings are loaded  
**Then** the parse failure is caught and reported as a structural `INVALID_SETTINGS` error rather than throwing before validation can run  
**And** the settings card offers the same reset-to-defaults path.

**Given** instead no stored settings document at all  
**When** settings are loaded  
**Then** the defaults apply directly — a fresh install is not a validation failure.

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
**Then** it contains origin, destination, mode, and the run's opaque correlation ID (`X-Request-ID`) only, beside the authentication credential the broker verifies  
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
**And** the user had dragged one companion away from its computed time — outside its persisted anchor's companion span (displaced) — while the other still sits where its anchor placed it  
**When** reconciliation runs  
**Then** the source is classified ineligible (`SOURCE_TOO_LONG` or `ALL_DAY_EVENT`)  
**And** its companions are located by ownership and parent metadata outside the window bounds  
**And** the displaced companion is deleted in that same run, wherever it sits  
**And** the undisplaced one — ended, its anchor past — is a concluded record (§15.2.9) and is preserved, never deleted by the lookup or by the ordinary comparison  
**And** no event id appears in the delete list twice, even when a displaced companion inside the observation range was also queued by the ordinary comparison.

Definitive ineligibility carries deletion authority, but the window scan cannot reach companions the overlong source stranded behind `observeStart`. The lookup keys on the duration, not the classification reason — the all-day check runs before the duration check, so a multi-day all-day conversion never reports `SOURCE_TOO_LONG` — and fires when either role is missing, so a half-stranded pair is resolved in one run. Deletion authority still stops at the past: a companion stranded behind `observeStart` has necessarily ended, so unless it was moved it is the record of a trip that happened (REQ-RECON-009), and the source growing overlong afterward does not un-happen it.

## AC-CACHE-013: Zero-second route is cached and reused

**Given** a source event whose origin and destination resolve to coincident endpoints  
**And** the broker returns a zero-second duration  
**When** reconciliation runs twice within the carrying tier's lifetime — the durable cache age limit when a companion exists to carry the entry, or the shorter ephemeral TTL when the zero-padding rule (§12.5) emitted no companions  
**Then** the second run makes no broker call  
**And** the cached zero is accepted by validation rather than treated as absent  
**And** the entry is served from the tier that carries it.

Zero is a legitimate duration. A truthiness check on the cached value would reject it before validation, forcing a broker call and metadata rewrite on every run. The two tiers have different lifetimes: the ephemeral tier is capped by CacheService well under `ROUTE_CACHE_MAX_AGE_HOURS` (§20.3), so a companion-less zero route re-fetched after ephemeral eviction is conformant — §12.5's expected-case behavior is two broker calls per ephemeral TTL, not per durable lifetime, and because CacheService is best-effort the hard bound is the per-run ceiling (REQ-PERF-010 exception), not the TTL. A test must not assert the TTL figure as an invariant.

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

## AC-CACHE-016: A concluded record never shadows the live block's cache

**Given** a source rescheduled after its trip, so a concluded record and a live block share a `parent|role` key for the observation overlap  
**When** reconciliation indexes observed companions before planning  
**Then** the per-role resolution selects the live block by the same-anchor rule — it is the add-on's own block for the new occurrence and carries the current source anchor — never the record  
**And** the provider receives the live block's valid cache triplet and makes no broker call  
**And** when no companion carries the current anchor (a second reschedule before the block was realigned), the fallback prefers a live companion over a record, judged with the run's injected clock, the same `now` the provider and comparator use  
**And** when several companions carry the anchor, an undisplaced one is selected first, so a displaced copy can never hide the record or the block the spec exists to restore — and among undisplaced ones a concluded record before a live copy, ties to the most recently updated, then the smallest id (AC-CACHE-022)  
**And** a block that crosses its end during the run is classified consistently by index, provider, and comparator.

## AC-CONFIG-004: Remove-all reaches events outside the window

**Given** managed events exist both inside the observation range and far outside it (aged out, or beyond a shrunken horizon)  
**And** the user confirms "Remove all generated events and disable automation"  
**When** the action runs  
**Then** the card action returns within the callback budget, having **replaced the stored settings with the disabled tombstone** — the schema-complete defaults with `enabled: false`, removing configured origin addresses, under the lock, before any deletion work begins — removed the triggers, and enqueued the cleanup worker  
**And** the worker deletes every managed event in budget-bounded passes, including events no window-bounded scan would read, re-enqueueing itself until the scan completes — never writing the settings document itself  
**And** cumulative progress is persisted and shown by the home card while cleanup is running — including during an actively executing pass, whose own trigger is already consumed: the card reads the liveness stamp's freshness rather than misreporting a live pass as failed  
**And** the origin addresses are therefore gone on **every** cleanup outcome — success, failure, or a worker that never wins the lock again  
**And** the final record reports cumulative deletions and the outstanding failures from the last complete walk — a truncated final pass leaves the prior count standing, marked possibly stale by `scanComplete: false`, and a transient failure a later complete pass retried successfully leaves no residue — with a retry offered when any remain or the scan never completed  
**And** a later manual synchronization or trigger repair does not regenerate events or triggers.

"All" must mean all: the ordinary scans are bounded by the rolling window, and a cleanup built on them silently misses history and stranded events. And the deletions cannot live in the card callback — its execution budget is fixed while the user's history is not, and a timeout mid-cleanup would leave events and personal settings behind at exactly the moment the user is preparing to uninstall.

## AC-CONFIG-012: A repeated remove-all always destroys stored origins

**Given** the user confirmed "Remove all generated events and disable automation", and its cleanup is live — the progress record reads `running` with a fresh liveness stamp  
**And** between passes the user re-enabled automation, entered home and office addresses, then switched automation off with the ordinary switch, so the stored settings are disabled but hold the addresses  
**When** the user confirms "Remove all generated events and disable automation" again  
**Then** the action treats the click as a duplicate of the live cleanup: the progress record, its counts and the heartbeat are untouched, and no second worker is enqueued  
**And** the action still replaces the stored settings with the disabled tombstone and removes the reconciliation triggers, so the home and office addresses are gone however the cleanup later ends  
**And** the card reports removal in progress.

## AC-RECOVERY-012: Companion dragged outside the window is restored

**Given** a source event with a managed return block  
**And** the user drags that return block months into the future, beyond `observeEnd`  
**When** reconciliation runs with a complete scan  
**Then** no new return block is created  
**And** the moved managed event is located by ownership and parent metadata without time bounds  
**And** it is updated back to the desired time.

Duplicate convergence cannot help here: one copy is outside every range the ordinary read covers. The create path must look before it leaps. The restoration match is classified like an in-window match: when the desired `eventType` changed while the companion sat out of range, the match becomes a **replacement** rather than an update — an update patch on the immutable field would be rejected on every run.

## AC-RECOVERY-013: Execution cutoff does not orphan unplanned sources

**Given** a run whose observation scan completed  
**And** planning's time-tier boundary is reached partway through the planning loop  
**When** the run stops planning and applies its diff  
**Then** every unprocessed source carries a `failed` planning outcome (`EXECUTION_BUDGET_EXCEEDED`)  
**And** none of their existing companions are deleted as orphans  
**And** the run reports `partial`.

Absence from `planningOutcomes` plus a complete scan means orphan. Sources skipped for time must be marked, or the degradation path deletes travel blocks because the run was slow.

**Given** a scoped diagnostic run whose planning-tier boundary fires before the opened event's iteration runs  
**When** the diagnostic completes  
**Then** the card reports `EXECUTION_BUDGET_EXCEEDED` — the run gave up on the event — never `EVENT_NOT_FOUND` for an event the targeted read just returned.

**Given** a source event whose planning deterministically throws (malformed data the provider cannot process)  
**When** reconciliation runs  
**Then** the throw is contained per event: that source carries a `failed` outcome (`UNEXPECTED_ERROR`), logged, with its `AppErrorRecord` folded into the run's errors  
**And** its existing companions are preserved like any planning failure  
**And** the rest of the run proceeds, reporting at best `partial` — never `success` over the unplanned source  
**And** the window-scan chain is never frozen at the poisoned event's slice: the run completes and its application-gated cursor advances normally
**And** the poisoned outcome alone schedules no continuation: `UNEXPECTED_ERROR` is `continuable: false` (AC-RECOVERY-036).

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

## AC-OOO-013: A recently ended source with no companions creates nothing

**Given** an eligible source event that ended within the planning lookback, long enough ago that even the longest supported route plus its buffer would have ended (`source.end + MAX_TRAVEL_MINUTES + buffer < now`, minutes converted to the implementation's time unit)  
**And** no companion is observed for it — a fresh installation, or the user deleted the blocks  
**When** reconciliation runs  
**Then** the provider emits no spec for either role, both decided route-free — the outbound block would end at `source.start`, the return block before `now` even at the travel cap — and spends no broker call  
**And** no already-ended travel block is created  
**And** the outcome is still `planned`, with both roles recorded as suppressed for reason `ended`  
**And** a source that ended only minutes ago with a nonzero buffer keeps a **live** return role (`source.end + buffer ≥ now`, instants and durations in one time unit): it is routed normally and its block, still ahead, is created.

**Given** the same ended source *with* observed companions  
**When** reconciliation runs  
**Then** an undisplaced companion is a concluded record: the §15.2.9 freeze fires before routing, its role is emitted as the pinned spec (not recorded as suppressed), and it classifies `unchanged`  
**And** an undisplaced same-anchor companion the user had dragged a short distance, still live, makes the provider emit the spec, and the ordinary update restores it to its computed times (REQ-GEN-014)  
**And** a same-anchor companion dragged *outside* its anchor's companion span is stale state like any different-anchor or anchorless block of the role: no spec is emitted for its sake and the orphan path deletes it on a complete scan, the §15.2.3, §15.2.8 and §15.2.10 passes elsewhere, the lenient record test excepted  
**And** an edit to the ended meeting's location, or a route-cache miss, does not re-route a frozen role: the record stands in for the route, and the past block keeps its times.

**Given** a *future* meeting whose outbound block the user dragged several hours into the past, so the block has ended yet still lies within its anchor's span  
**When** reconciliation runs  
**Then** the block is not a record — its anchor instant is still ahead — so the §15.2.9 freeze does not fire  
**And** the desired span is live, the spec is emitted, the key matches, and the update restores the block to its computed times; the meeting keeps its padding.

**Given** a meeting that ended five minutes ago with a ten-minute buffer, whose return block the user dragged an hour into the past — ended, undisplaced, and anchored to `source.end`, which is itself past  
**When** reconciliation runs  
**Then** the block is a record by the parent-less §15.2.9 test, yet the role is provably live (`source.end + buffer ≥ now`), so the freeze does not fire  
**And** the role is routed, the computed spec is emitted **unpinned**, the key matches, and the update restores the block to its computed times — the comparator's anchor-equality freeze requires the `pinned` flag, so the still-wanted return padding is not silently stripped.

A trip already taken cannot be padded; a fresh past-dated block would be manufactured history. The rule applies whether or not a historical companion exists, not only against a concluded record with a different anchor.

## AC-CONFIG-005: Diagnosing an event outside the window reports the reason

**Given** a source event starting beyond the planning horizon  
**When** the user opens the event diagnostic card  
**Then** the event is fetched by id rather than through the window scan  
**And** the card reports `OUTSIDE_WINDOW`  
**And** no full window listing is performed for the card open.

A window-scan-based diagnostic would return silence for exactly the events users most wonder about.

## AC-CONFIG-006: Daily trigger realigns after a timezone-offset change

**Given** a daily trigger installed at the UTC hour derived for the user's Calendar time zone  
**And** a daylight-saving transition occurs, or the user changes their Calendar time zone  
**When** the next daily trigger fires, at the now-stale hour  
**Then** the reconciliation run completes normally  
**And** the daily handler re-derives the UTC hour for the current time zone at the next firing's instant  
**And** trigger repair creates the replacement at the derived hour first, persists the new record for it, then deletes the stale trigger by unique id, because the derived hour differs from the persisted `dtp.dailyTrigger` hour  
**And** when the derived hour lies later the same day, the replacement also fires that day — an accepted second run — and from the next day on the daily run fires at the intended local hour only, with no homepage open or settings save by the user  
**And** when the daily firing collides with another execution holding the user lock, the run and its repair are skipped together — nothing is logged as a failure — and the realignment completes on the next firing (two cycles, the accepted residual)  
**And** a repair failure is logged as `TRIGGER_REPAIR_FAILED` without affecting the run's result, and the next daily firing retries.

The trigger that fires the repair is the stale one — it still fires, an hour off — which is what makes the path automatic rather than dependent on the user noticing a schedule drift that has no visible symptom.

## AC-CONFIG-011: An unreadable Calendar time zone leaves the daily trigger in place

**Given** valid, enabled settings, a daily trigger installed at the UTC hour derived earlier, its record persisted, and the Calendar trigger missing  
**And** the Calendar time-zone read throws (insufficient permission under a narrowed manifest, or a transient error), or returns `null` or a value that names no recognized time zone  
**When** trigger repair runs, from the homepage or from the daily firing  
**Then** the Calendar trigger is created  
**And** the daily trigger and its persisted record are left exactly as they were — nothing is created, deleted or written for it, and no trigger is ever installed at a guessed hour  
**And** the health report is unhealthy, with the daily trigger reported installed at the recorded hour and an error carrying `CALENDAR_READ_FAILED`, which the home card renders with remediation and the Repair action  
**And** repair does not throw; on the daily firing the unhealthy report is logged as `TRIGGER_REPAIR_FAILED` and the run's result is unaffected  
**And** on a fresh install whose time-zone read fails, the daily trigger is reported missing rather than installed at any hour, until a later repair can derive the hour.

## AC-RECOVERY-015: Companion stranded by a deleted source is swept

**Given** a managed companion dragged outside the observation range  
**And** its source event deleted before any reconciliation runs  
**When** the next daily maintenance run executes  
**Then** the ownership sweep finds the companion via its persisted `anchor`  
**And** a point read confirms the parent no longer exists  
**And** the companion is deleted  
**And** historical companions whose anchors lie outside the sweep's anchor band trigger no parent lookups.

**Given** instead the source still exists but was moved outside the planning range together with its companion  
**When** the next daily maintenance run executes  
**Then** the point read finds the live parent, sees it was not evaluated this run, and the **displaced** companion (observed outside its persisted anchor's companion span — it was moved) is deleted — an out-of-window source's desired state is no companions, and they regenerate when it re-enters the window.

**Given** instead a companion whose trip has concluded, sitting exactly where its anchor placed it, its parent aged out of the planning range (or deleted after the fact)  
**When** any reconciliation runs while the companion is still inside the observation range  
**Then** the companion is preserved as a **record of the trip** — deletion authority stops at the past — and it ages out of the observation range untouched.

**Given** instead a concluded companion whose parent still plans (inside the lookback), the desired specification still anchored to the recorded occurrence  
**When** a location edit, buffer change, or refreshed route estimate would otherwise change the companion  
**Then** the record classifies as `unchanged` — no route call is spent on it — rather than being patched to times that never applied.

**Given** instead a concluded companion whose parent is rescheduled to a future occurrence  
**When** reconciliation runs  
**Then** the record matches nothing and the new occurrence gets fresh companions — the out-of-window lookup and duplicate convergence both pass over the different-anchor record — while the record stays on the calendar as history  
**And** an after-the-fact edit to an already-ended occurrence's times produces no write at all: a past trip cannot be padded, so no past-dated companion is manufactured.

**Given** instead a companion that aged out of the observation range naturally, its `updated` bumped by a settings-change patch in its final in-window days, its parent live behind the planning range  
**When** the next daily maintenance run executes  
**Then** the sweep lists it as a candidate but the displacement test finds it exactly where its anchor put it, and it is **preserved as calendar history** — record-keeping must not depend on how recently an event happened to be patched.

**Given** instead a companion dragged outside the observation range while the window was configured long, its parent's anchor far in the future  
**And** the user then shrinks `windowDays` so that anchor lies beyond the new planning range  
**When** the next daily maintenance run executes  
**Then** the anchor band still spans out to the largest configurable horizon, so the companion is found and the parent-state rule applies — a window shrink does not hide the stray.

Restoration (AC-RECOVERY-012) is driven by a pending create, which requires a live parent planning inside the window; a deleted or out-of-window parent leaves nothing pending and the stray invisible to the bounded scan. Only a scan independent of desired state can find it, and the anchor is what keeps that scan from probing every historical event daily.

## AC-RECOVERY-016: Auto-decline switched on a generated OOO block

**Given** a generated out-of-office travel block created with `autoDeclineMode: "declineNone"`  
**And** the user changes the block's auto-decline mode so it declines incoming meetings  
**And** the source event is otherwise unchanged, so the fingerprint still matches  
**When** reconciliation runs  
**Then** the owned-field comparison detects the auto-decline difference  
**And** the auto-decline mode is restored to `declineNone` — by patch where Calendar accepts `outOfOfficeProperties` in a patch body, by replacement otherwise  
**And** the block declines no unrelated meetings afterwards.

Auto-decline mode is not a planning input, so the fingerprint cannot detect this. Like reminders (AC-RECOVERY-008), it is caught only because `outOfOfficeProperties` is in the owned-field set.

## AC-RECOVERY-018: The stored record says what became of a partial run's continuation

**Given** a non-dry run that ends `partial`  
**When** its result is persisted  
**Then** the stored record's `continuation` field carries the disposition — `scheduled` when a pass was enqueued or already pending, `capReached` when `MAX_CONSECUTIVE_CONTINUATIONS` declined it, `enqueueFailed` when the trigger write threw (`CONTINUATION_ENQUEUE_FAILED`), `notUseful` when no pass could drain what remains — a finished chain's coverage gap (the daily run's job) or rejected writes alone (re-planned by the next run of any kind)  
**And** the home card renders each state distinctly, never promising a continuation that will not fire  
**And** a non-partial run stores `null`.

The trigger handler's return value is discarded, so the stored record is the only durable carrier; a single boolean would collapse three "no pass is coming" states into "not capped".

## AC-RECOVERY-019: A write against a changed event never lands blind

**Given** reconciliation has read a managed companion and queued an update, metadata patch, or delete for it  
**And** the user edits that event before the write applies  
**When** the write is attempted  
**Then** it is conditional — `If-Match` on the observed ETag, or an immediate marker re-read where the runtime cannot send the header  
**And** a rejected write is re-read: a stripped `dtp` marker records `OWNERSHIP_LOST` (not retried — the event is the user's now, and the next run plans the key against a fresh read), an intact marker records `CONCURRENT_EDIT` (retried next run against the fresh read)  
**And** neither outcome re-stamps managed metadata onto the event or deletes it  
**And** a target that has vanished (deleted by the user, or a cancelled tombstone) is never reported as ownership loss: it fails as an ordinary write failure, the run reports `partial`, and the next run — which no longer observes the block — converges on its own  
**And** on the delete half of a replace, either outcome aborts the replace — the create half does not run  
**And** the run reports `partial` with the failure counted.

A 412 proves only that the event changed; reporting it as ownership loss would tell the user the add-on lost an event it still manages.

## AC-CONFIG-007: A catastrophically backtracking title pattern is rejected

**Given** title-pattern matching is enabled with the pattern `^(a+)+$`  
**When** the settings are validated on save or on load  
**Then** the pattern compiles but falls outside the §9.3 accepted subset — a quantified group whose body contains a quantifier  
**And** the result is a structural validation error — field `eligibility.titlePattern`, code `INVALID_TITLE_PATTERN`, the message naming the construct and its position — inside an `INVALID_SETTINGS` run failure, exactly as a compile error would be  
**And** no reconciliation runs against the pattern, dry runs included, and the settings UI shows the error  
**And** the patterns `^OOO\b`, `\bOOO\b|\bout of office\b`, `(?:OOO|out of office)\b`, `.*?x`, `[(]a[+]` and `[\w\-]+` are accepted — escaped and class-contained metacharacters count toward no cap  
**And** `^*` and `[z-a]` are refused by compilation, which runs before the subset scan, with the compile error as the message  
**And** the check is an allowlist: `\\(a+)+`, `((a+)b)+`, `(a|ab)+` and `((a|ab)c)+` are refused (a quantified group holding a quantifier or an alternation), `(?<g>.+)\k<g>`, `(a)\1` and `\1` are refused (outside the grammar, whether or not a group exists), `(a|b)(a|b)(a|b)(a|b)` is refused (four alternation bars, more than three — short enough that only that rule fires), `.*.*.*x` is refused (three quantifiers, more than two), and `[^](a+)+]`, `[]a]`, `[\w-]` and `Team sync {` are refused because `[^]`, an empty or `]`-first class, a bare hyphen that is not a range, and a bare brace are not in the subset — V8 would compile all four, the first catastrophically  
**And** a summary longer than `MAX_TITLE_PATTERN_SUBJECT_CHARS` UTF-16 code units does not match at all, reported `TITLE_TOO_LONG` rather than `TITLE_PATTERN_NO_MATCH` so the card names the bound (the evaluator is the bound's one owner and the matcher's only caller — it checks the bound before calling the bound-free matcher; a summary of exactly the bound is still matched; with the pattern disabled the reason stays `TITLE_PATTERN_DISABLED` — for an ordinary event; a real OOO event the `includeOutOfOffice` toggle declined reports `OUT_OF_OFFICE_DISABLED` either way, AC-ELIG-007) — it is never truncated and matched, so `\bOOO\b` cannot match an over-long title with `OOO` as its last three code units before the bound, and `OOO$` cannot be defeated silently  
**And** the same pattern text with matching **disabled** is not checked and does not invalidate the settings  
**And** a stored pattern saved before the rule existed fails the same way on load — a visible structural error, never a silent disable that would delete the pattern's companions  
**And** the pattern is compiled once per run after validation and handed to every eligibility evaluation, never compiled per event.

Apps Script has no regex timeout; a pattern that merely compiles can otherwise kill every run on the same calendar input.

## AC-RECOVERY-020: An in-progress source is listed once on a fresh run

**Given** a meeting that started before `now` and ends after it, with its two travel blocks on the calendar  
**And** a fresh single-slice run whose window read fits one execution budget  
**When** the repository lists the forward segment from the pivot and then the backward segment  
**Then** the meeting — returned by both Calendar queries, since `timeMin` filters on end and `timeMax` on start — appears once in the listing, owned by the forward segment  
**And** its return block, ending after the pivot, is owned by the forward segment, while its outbound block — ending at the source start, before the pivot — is owned by the backward one; each appears once  
**And** the engine plans the source once, indexes one copy of each companion, and §13.5's duplicate convergence deletes nothing  
**And** a zero-duration event at exactly the pivot instant is the one accepted gap — unobserved by that run's chain, listed by the next fresh run with a new pivot.

The partition is not a chain-only concern: without it every ordinary run with a meeting underway would plan that meeting twice.

## AC-RECOVERY-021: A starved slice is re-read before the chain advances

**Given** a continuation resuming a chain slice whose run applied writes or obtained fresh broker routes, but whose planning hit the route budget or the planning-time cut-off, or withheld a create because its restoration lookup did not run
**When** the run persists its bookkeeping
**Then** the window-scan cursor is not advanced: it is re-saved at the same position with its hold count incremented, and the continuation re-reads the same slice, planning further on the caches the run warmed
**And** once a run drains the slice — nothing deferred, no budget cut-off, no withheld create — the cursor advances with its hold count reset to 0
**And** a run that made no progress on the slice — no accepted write, no fresh broker route — advances anyway, as does a run at a position already held `MAX_SLICE_HOLDS` times in a row, and every daily run, so no slice can freeze the chain
**And** the chain's final slice — the resumed listing walks off the end of the pinned span — is gated the same way: when the same conditions hold it, the cursor is not cleared but re-saved at the same position with its hold count incremented, the chain is not finished, and the stored `continuation` is `scheduled` (an unfinished scan), so the continuation re-reads the tail slice; only once that slice drains or its hold is released does the cursor clear and the chain finish
**And** a final slice whose application was skipped for time leaves its cursor stored, unchanged, and the chain unfinished.

## AC-RECOVERY-022: Suppressed-role lookups rotate through their population

**Given** a suppressed-role population larger than one pass's evidence budget, whose front is standing zeroed keys with nothing to delete
**When** successive passes run
**Then** each pass starts after the parent where the previous pass over the same population stopped, in parent-id order, wrapping around
**And** a later key with a stale out-of-range companion is reached within a bounded number of passes
**And** the resume entry is not advanced past a key whose delete was deferred, and a pass that completed lookups replaces its population's entry with the last parent it looked up and the cycle's origin — `null` once the cycle closed (AC-RECOVERY-039)
**And** a pass the evidence guard cuts off before its first lookup completes — on a daily run whose sweep spent the tier, or on the deadline-starved branch — leaves the stored resume entries unchanged (on a daily run, reopened) rather than dropping its own
**And** remove-all's fully-successful terminal clears the stored resume points with the rest of the add-on's stored state.

## AC-RECOVERY-023: Unroutable sources cannot pin the scan chain

**Given** a chain slice holding more unroutable sources with distinct locations than one run's route budget can attempt, each of which the broker answers with `NO_ROUTE` or `INVALID_DESTINATION`, plus earlier sources planned from warm caches (instances of one recurring source share a route input hash, so the failure memo of AC-CACHE-017 already holds them to one attempt per run)
**When** successive continuations resume the slice
**Then** a run that spends its route attempts on those failures and records `ROUTE_BUDGET_EXCEEDED` for the rest does not drain the slice
**And** the first run whose only effects are deterministic failures and cache-hit re-planning — no accepted write, no fresh broker route — advances the cursor to the next slice, even when it newly cached those failures
**And** no hold outlasts `MAX_SLICE_HOLDS` consecutive runs at one position, and a daily run resuming the chain always advances it, so the chain finishes and the daily fresh pass and sweep are not deferred indefinitely
**And** the slice's starved sources are re-planned when a run next reads that slice: the failures that spent the budget are in the negative route cache (AC-CACHE-018), so that read spends no attempt on them and routes the sources behind them.

## AC-CONFIG-008: A failed high-water read never lowers the mark

**Given** a stored high-water mark wider than the current horizon
**When** the User Properties read of that mark fails
**Then** the run fails as a run-wide read failure: nothing is applied and no reconciliation state — the mark, the scan cursor, the sweep watermark — is written
**And** the stored last-run record is the `failed` `CALENDAR_READ_FAILED` result, as for every run-wide failure (AC-RECOVERY-014), so the home card does not keep showing a stale success
**And** the mark is not overwritten with the current horizon, so the next successful run still finds and cleans the vacated range
**And** only a positively absent or malformed mark takes the advance branch.

## AC-CONFIG-009: Missing or corrupt safety-relevant settings are reported, never healed

**Given** a stored current-version settings document with `eligibility.titlePatternEnabled: true`, `eligibility.includeOutOfOffice: false`, and pattern-matched sources that have generated companions  
**And** a partial write has left the document with `eligibility` set to `null`  
**When** settings are loaded and a write-mode run starts  
**Then** validation reports a structural `INVALID_SETTINGS` entry on `eligibility`, and the run fails at the validation gate  
**And** no generated event is created, updated or deleted — the defaults (`titlePatternEnabled: false`, `includeOutOfOffice: true`) are never merged in, so no pattern-matched source becomes ineligible  
**And** the same holds when the `eligibility` object is present but lacks `titlePatternEnabled`, and when the document lacks `enabled`: each missing required field is its own entry naming its path  
**And** a document that lacks only `defaultBufferMinutes` loads with the §5.2 default buffer and validates.

## AC-CONFIG-010: A missing planning window is reported, never defaulted into a shrink

**Given** a stored current-version settings document with `windowDays: 180`, a persisted observation high-water mark about 181 days out, and generated companions for appointments 61 to 181 days out  
**And** a partial write has dropped the `windowDays` key, leaving every other field intact  
**When** settings are loaded and a write-mode run starts  
**Then** validation reports a structural `INVALID_SETTINGS` entry on `windowDays` (message "missing"), and the run fails at the validation gate before planning  
**And** the §5.2 default of 60 is never merged in, so neither the §7.6 shrink cleanup nor `OUTSIDE_WINDOW` classification runs: no generated event is deleted and the high-water mark is unchanged  
**And** once the user re-saves the setting (or resets to defaults, a deliberate change), runs resume and any shrink cleanup that follows is the user's choice.

## AC-RECOVERY-024: The sweep never deletes the block restoration is updating

**Given** a meeting whose blocks have become concluded records, rescheduled to a later day so a run created new blocks with the new anchor
**And** the user then drags the new outbound block beyond the observation range
**When** the next daily run performs a complete scan while the old record is still observed
**Then** the old record matches nothing, so the key's create is pending, and the out-of-window lookup passes over the different-anchor record and converts the create into an update of the dragged block
**And** the sweep lists the dragged block as a candidate, but the different-anchor record does not satisfy the key in-window, so the sweep leaves the block to restoration
**And** no event is ever both updated and deleted in one diff: the engine drops from the sweep's results every event a restoration in the same diff targets, before queueing deletes and before the sweep watermark's deleted-all check
**And** the dragged block is restored to its computed times, the record stays as history, and the run is not marked partial by a delete-then-404 update.

## AC-RECOVERY-025: A same-anchor record on another slice is treated as if co-observed

**Given** a calendar too large for a complete scan, and a meeting that ended five minutes ago with a ten-minute buffer, whose return block the user dragged a short distance into the past — ended, undisplaced, a record by the parent-less test — with pagination placing the block on a different slice from its parent
**When** the parent's slice is reconciled
**Then** the role is provably live, so the provider emits an unflagged spec and the comparator emits a create
**And** the out-of-window lookup finds the same-anchor record and restores it with an update instead of letting the create proceed, so no second return block is created
**And** on the block's own slice the parent point read finds the role still live and preserves the block for the parent's slice to reconcile.

**Given** instead that the role is not provably live (the return band: `source.end + buffer < now`), the route estimate still putting the computed span ahead, and the same split
**When** the parent's slice is reconciled
**Then** the provider emits the spec flagged `inBand` and the comparator emits a create
**And** the lookup finds the same-anchor record and withdraws the create — no write, not counted as suppressed — leaving the record where it is, exactly as the co-observed freeze would
**And** a different-anchor record found by the lookup is still passed over and the create proceeds.

**Given** instead a meeting that ended 30 minutes ago, so its outbound role is `ended`, whose outbound block the user dragged 20 hours earlier (displaced), with pagination placing the block on a different slice from its parent
**When** the block's slice is reconciled and the parent point read returns the live meeting
**Then** the role is desired but its desired span has ended, so the candidate follows the shared rule for an ended role: the displaced block is not the parent's undisplaced same-anchor block and is deleted on the spot
**And** it is not preserved for a restoration by the parent's slice, which emits no spec for an ended role.

## AC-OOO-014: A zero total over an ended span keeps the trip's own block wherever it is observed

**Given** an eligible source whose origin and destination coincide, which ended three minutes ago, whose undisplaced return block from an earlier nonzero buffer is still running
**And** the user sets the buffer to zero, so the return role's total is zero and its empty span has already ended
**When** reconciliation runs with the block observed beside its parent
**Then** the provider records the role `ended`, not `zero`, and emits no spec
**And** the comparator applies the shared rule for an ended role: the parent's undisplaced same-anchor block is kept, not deleted as an orphan
**And** when pagination instead places the block on another slice, the parent point read and the suppressed-role lookup keep it by the same rule, so the block's fate does not depend on pagination
**And** a block of the role that is displaced, or carries a different anchor, is deleted on every path, the lenient record test excepted.

## AC-CACHE-017: Routing owns the ephemeral tier and memoizes deterministic failures

**Given** an eligible source with no companion yet whose route the broker computes successfully
**When** reconciliation routes it
**Then** the routing client writes the result to the ephemeral tier under its route input hash with the client's own TTL, whatever the provider later decides about emitting the role
**And** a failure of that cache write is swallowed and the broker result is still returned.

**Given** a recurring series with many instances in the planning range whose location the broker answers with `NO_ROUTE`
**When** one reconciliation run plans them
**Then** the first instance spends one broker attempt and every later instance records the same `NO_ROUTE` failure from the memo without spending another attempt, so sources behind them are not starved into `ROUTE_BUDGET_EXCEEDED`
**And** the failure is written through to the negative route cache, so the next run records it again without a broker attempt until it expires (AC-CACHE-018)
**And** transient broker failures are not memoized in either tier: a later source sharing the input retries the broker within the same run.

## AC-RECOVERY-026: A run that applied nothing but rejected a write is partial, not failed

**Given** a write run whose only queued operation deletes a block the user removed seconds earlier
**When** the delete fails as an ordinary `CALENDAR_WRITE_FAILED`
**Then** the run reports `partial`, not `failed`, with every accepted count zero and `failedWrites: 1`
**And** the stored record's `continuation` is `notUseful`, because rejected writes alone never justify a pass.

**Given** instead a diff of one delete and eighty creates, where the delete — applied first, in the delete-then-create-then-update order (Architecture §14.5) — fails as an ordinary `CALENDAR_WRITE_FAILED` against a block the user just removed, and the execution budget then defers all eighty creates
**When** the run completes
**Then** the run reports `partial` with zero accepted counts, `failedWrites: 1` and `deferredOps: 80`
**And** a continuation is scheduled for the deferred creates, exactly as on a run that had applied work.

`failed` belongs only to runs that never reached application: the validation gates, a rejected invocation, and the error boundary.

## AC-RECOVERY-027: The stored error counts sum every record of a code

**Given** a write run in which Calendar rejects forty creates with `CALENDAR_WRITE_FAILED` and two sources fail planning with `CALENDAR_READ_FAILED`
**When** the result is persisted
**Then** the stored `errorCounts` is `{ CALENDAR_WRITE_FAILED: 40, CALENDAR_READ_FAILED: 2 }`, summing `occurrences` (absent meaning 1) over every record of each code
**And** the stored `errors` is 42, the total occurrence count.

## AC-RECOVERY-028: A status-only or failure record keeps the run's reason

**Given** automation is disabled and a leftover daily trigger fires
**When** the run persists its `disabled` result
**Then** the stored record's `reason` is `daily-trigger` and its event and write counts are zero
**And** an `INVALID_SETTINGS` failure from a calendar trigger, or a boundary failure from a manual run, likewise stores `calendar-trigger` or `manual`.

## AC-RECOVERY-029: A broker failure that answers "do not retry now" still blocks success

**Given** eligible sources with no companions yet
**And** the broker credential is misconfigured, so every route request fails `BROKER_AUTH_FAILED` (or the Maps quota is exhausted, so every request fails `BROKER_RATE_LIMITED`)
**When** a write run completes with no write failures and nothing deferred
**Then** the run reports `partial`, not `success`, with the code named in the stored `errorCounts`
**And** the routing client made no immediate HTTP retry for those responses — that column of the broker error mapping is not the registry's `retryable` flag
**And** for either code — both are `continuable: false` in the registry — the stored `continuation` is `notUseful`, however many eligible sources there are: the failed outcomes add nothing to `diagnostics.continuableFailures`, and when the failed requests exhaust the route budget, `routeBudgetExhausted` is true but no attempt was productive (`routeAttemptsProductive: 0`), so the exhausted budget is not a continuation cause and no pass is enqueued to send another ceiling's worth of requests certain to fail
**And** the same holds for a broker outage (every attempt `BROKER_UNAVAILABLE`, each retried once): `notUseful`, and the next calendar-trigger or daily run retries.

## AC-RECOVERY-030: A failed page fetch fails the run instead of truncating it

**Given** a write run whose window listing reads its first page  
**And** the fetch of a later page fails with any error other than Calendar's invalid-page-token rejection  
**When** reconciliation runs  
**Then** the listing throws `CALENDAR_READ_FAILED` rather than returning the pages already read as a truncated prefix  
**And** the run reports `failed` with an empty diff — no create, update, patch, or delete is applied  
**And** any stored continuation cursor is retained, so the retry resumes the same slice.

Only the read-budget guard (and a cursor-offered slice) produces `scanComplete: false`. Treating a fetch error as truncation would apply a diff planned from an arbitrary prefix, and would defeat the cursor-retention rule that depends on transient errors throwing (Technical Design §7.2.1, §17.2).

## AC-CACHE-018: Deterministic route failures are cached across runs, so they cannot starve later sources

**Given** about seventy upcoming eligible meetings whose locations are distinct strings the broker cannot route (per-meeting video links, "TBD" rooms), each answered `INVALID_DESTINATION`, ahead of a routable meeting in planning order
**When** a write run plans them and spends its whole route budget on those failures
**Then** each failure is written to the negative route cache under its route input hash with its code and the time the broker answered — no address, title or event id
**And** the run is `partial` with `routeBudgetExhausted` true and `routeAttemptsProductive` non-zero, so a continuation is scheduled
**And** the continuation records the cached failures again without spending an attempt, learns the remaining ones, and routes the meeting behind them
**And** for 24 hours (`ROUTE_FAILURE_CACHE_TTL_HOURS`) no run — continuation, calendar-trigger, manual or daily — sends a request for a cached input, after which one run asks the broker again.

**Given** the user corrects one of those meetings' location to a routable address
**When** the next run plans it
**Then** the corrected location produces a different route input hash, misses the negative cache, and is routed by that run.

**Given** the stored negative cache is unreadable, or its write fails
**When** a run routes
**Then** the run asks the broker as if nothing were cached, or keeps its in-run memo only, and no route fails because of the cache
**And** the store never holds more than `ROUTE_FAILURE_CACHE_MAX_ENTRIES` entries: a write drops expired entries first and then the oldest
**And** remove-all's fully-successful terminal clears the store with the rest of the add-on's stored state.

## AC-RECOVERY-031: Incomplete coverage keeps a run partial, so its continuation is scheduled

**Given** a calendar too large for one scan, and a continuation that resumes the scan cursor, lists the next slice (`scanComplete: false`), plans every retrieved source, and has Calendar accept every write with nothing deferred and no failed outcome
**When** the run's result is built
**Then** the run reports `partial`, not `success`, because its scan was incomplete
**And** the continuation counter is not reset, and a continuation is scheduled while the chain is unfinished.

**Given** instead a run whose scan covered the current window but whose restoration lookups were cut short at the evidence threshold, so `suppressedCreates` is non-zero, with every applied write accepted
**When** the run's result is built
**Then** the run reports `partial` and a continuation is scheduled to re-resolve the withheld creates
**And** a run with `suppressedDeletes` non-zero and nothing else outstanding likewise reports `partial`.

`success` means the run covered the whole window, withheld nothing, and left nothing failed, deferred or unplanned (Technical Design §17.5).

## AC-RECOVERY-032: A write-path read failure alone schedules no continuation

**Given** a write run on which no `If-Match` is available, whose only queued operation is an update
**And** the pre-write marker re-read for that update throws a transient error
**When** the run completes
**Then** the update is dropped and recorded in the apply failures as `CALENDAR_READ_FAILED`, and the run reports `partial` with `failedWrites: 1`
**And** the stored `continuation` is `notUseful`: apply failures never justify a pass, whatever their code — even though the registry marks `CALENDAR_READ_FAILED` `continuable: true` for its planning-side use
**And** a planning-side `CALENDAR_READ_FAILED` outcome on another run, whose scan covered the current window, does count as a continuation cause: `buildRunResult` counts it in `diagnostics.continuableFailures`, which never counts an apply failure.

## AC-RECOVERY-036: A failed planning outcome continues a run only when its code is continuable

**Given** a non-dry calendar-trigger run whose fresh scan covered the current window, with nothing deferred, nothing cut off at the evidence tier, and a route budget not exhausted
**When** its only unfinished work is one source whose planning deterministically throws, recorded `UNEXPECTED_ERROR`
**Then** the run is `partial`, `diagnostics.continuableFailures` is 0 and the stored `continuation` is `notUseful` — the same event would re-throw on a pass, so a poisoned event costs no continuation.

**Given** the same run, but with some sources failed `BROKER_UNAVAILABLE` beside a route budget spent to zero with `routeAttemptsProductive` non-zero
**Then** a continuation is scheduled — the cause is the productively exhausted budget, and that pass retries the outage failures; with `routeAttemptsProductive` 0 it would be `notUseful`.

**Given** the same run, but with planning cut short at its tier, so the remaining sources are `EXECUTION_BUDGET_EXCEEDED`
**Then** `diagnostics.continuableFailures` equals the number of those outcomes and a continuation is scheduled
**And** on a cursor-offered chain slice the same outcomes are no cause of their own: the unfinished chain schedules the pass — on the chain's final slice too, whose drain gate holds it while the run made progress (AC-RECOVERY-021), leaving the chain unfinished — and a final slice the drain gate released (no progress, `MAX_SLICE_HOLDS` reached, or a daily run) with only those outcomes finishes the chain and records `notUseful`.

## AC-SEC-002: A credential rejected before the broker runs is an authentication failure

**Given** the broker sits behind an authenticating front end (Cloud Run IAM, API Gateway, or Cloud Endpoints)
**When** that front end rejects a route request with a 401 or 403 whose body carries no broker error code
**Then** the routing client classifies it `BROKER_AUTH_FAILED`, exactly as a 401/403 carrying `AUTHENTICATION_FAILED`
**And** never `BROKER_PROTOCOL_ERROR`.

## AC-OBS-001: One correlation ID links a run's record to its broker requests

**Given** a write run that makes broker requests
**When** the run completes and its result is persisted
**Then** every broker request of the run, retries included, carried the same opaque `X-Request-ID`
**And** the stored last-run record's `correlationId` equals that value
**And** neither the ID nor the broker log line carries an address, title, or calendar identity.

## AC-OBS-002: Every result carries the run's true start instant

**Given** a manual synchronization, invoked with no `now` option, whose planning and application take several seconds  
**When** the run completes and its result is persisted  
**Then** the stored record's `startedAt` is the instant the run began, before the lock attempt, and precedes `completedAt` by the run's duration — never equal to it  
**And** a run that exits at the lock-contention skip, the validation gate, the disabled gate, or the error boundary also returns a `startedAt` taken from the same run-scoped start instant, never omitted.

## AC-CACHE-019: A meeting with no travel blocks yet is routed, not failed

**Given** a fresh install, or a newly created eligible meeting, so `companionsFor` resolves no companion for either role and each `RouteRequestContext.cacheEntry` is `null`
**When** reconciliation plans the meeting
**Then** `cachedRouteIsUsable(null, expectedHash, now)` answers false without reading any field
**And** the client falls through to the failure memo, the ephemeral tier and the broker as usual
**And** the meeting's outcome is `planned` with two specs, never a `failed` outcome carrying `UNEXPECTED_ERROR`
**And** a write run creates both travel blocks.

The null entry is the most common planning path there is. A reuse check that reads `meta.routeHash` before testing for null would throw on it, and the per-event containment would turn every new meeting into a failure that never gets a travel block.

## AC-CACHE-020: Created travel blocks carry the full cache triplet, stamped with the run's clock

**Given** a fresh install with a weekly recurring meeting that has 26 instances in the planning window, all sharing one route input hash per direction
**And** a run whose injected clock `now` is 09:00:00 while its broker responses arrive at 09:00:02 and later
**When** a write run plans and applies the window
**Then** the broker is called once per direction, two attempts in all: each later instance is served by the ephemeral entry the first wrote, because that entry's `at` is the run's `now` (09:00:00) and validates against the same `now`
**And** every created block's private properties hold `routeHash`, `routeSecs` (raw seconds) and `routeAt` (09:00:00), taken from the route's `RouteResult` through `routeCacheProperties`
**And** the next run makes zero broker calls, every `RouteResult` reporting `source: "durable"`.

**Given** a block whose `routeAt` expired and whose re-routed duration lands in the same quantization bucket
**When** reconciliation runs
**Then** the metadata patch writes the three keys copied from the desired spec, which equal the fresh `RouteResult`'s hash, raw seconds and `calculatedAt`.

A wall-clock stamp taken when the response arrives is always later than the run's `now`, so it would fail the `ageMs >= 0` check for the rest of the run, and each of the 26 instances would pay the broker: 52 attempts against a ceiling of 60 instead of 2.

## AC-ROUTE-001: A hung broker cannot carry a run past its execution budget

**Given** a calendar-trigger run whose fresh window listing covers the current window and ends at about 150 seconds
**And** a broker that accepts connections but never answers, so each `UrlFetchApp` attempt waits for the platform's fetch deadline (about 60 seconds)
**When** planning routes its first source at about 152 seconds
**Then** that attempt is admitted, because the wall clock is before `budget.attemptDeadlineMs` (`runStart + EXECUTION_BUDGET_MS - BROKER_ATTEMPT_ALLOWANCE_MS`, 210 seconds), and hangs until about 212 seconds
**And** its transport-timeout retry is refused, because the wall clock is now past 210 seconds: the client throws `EXECUTION_BUDGET_EXCEEDED` with no attempt spent, so the source records a `failed` outcome and its existing travel blocks are preserved
**And** every later source is marked `EXECUTION_BUDGET_EXCEEDED` by the planning tier (`PLANNING_BUDGET_FRACTION`, about 202 seconds, already passed), never routed
**And** application is **not** skipped: the budget has not expired at the application gate, so `applyDiff` runs and defers whatever its between-operations checks have not reached by `EXECUTION_BUDGET_MS` (270 seconds)
**And** the run persists a `partial` last-run record, schedules a continuation — the `EXECUTION_BUDGET_EXCEEDED` outcomes are continuable failures (`diagnostics.continuableFailures` non-zero) on a run whose scan covered the current window — and releases the lock, all before the platform's 6-minute hard kill.

**Given** instead an attempt admitted at about 209 seconds that hangs to about 269 seconds, so the run reaches the application gate with `EXECUTION_BUDGET_MS` spent
**Then** application is skipped for time (`applied: null`), and the run still persists `partial`, schedules a continuation and releases the lock before the hard kill.

**Given** the event card is opened on an unplanned event while the broker hangs
**When** the card's diagnostic run routes
**Then** no attempt starts after `DIAGNOSTIC_ATTEMPT_WINDOW_MS`, so a retry or the second route is not started after a slow first attempt
**And** a single hung attempt may still outlast the card callback, which is the accepted residual (Technical Design §11.2): the platform shows its timeout error, nothing is written, and reopening the card retries.

## AC-ROUTE-002: An over-long location never reaches the broker

**Given** three weekly recurring meetings with 26 instances each in the window, whose location fields hold a pasted block of directions longer than `MAX_ROUTE_ENDPOINT_VALUE_CHARS` (1000 UTF-16 code units after trimming)
**And** other eligible sources later in upcoming-first order whose routes are not cached
**When** a write run plans the window
**Then** the routing client refuses each instance's outbound route before any cache tier or broker attempt, with `INVALID_DESTINATION`: no attempt is spent, nothing is memoized or written to the negative route cache, and no attempt counts as productive
**And** each of the 78 instances records a `failed` outcome with its existing travel blocks preserved, and the stored `errorCounts` names `INVALID_DESTINATION`, never `BROKER_PROTOCOL_ERROR`
**And** the later sources are routed with the full `MAX_ROUTE_CALLS_PER_RUN` budget, never `ROUTE_BUDGET_EXCEEDED` because of the over-long locations
**And** the over-long failures are `continuable: false`, so they schedule no continuation on their own.

**Given** a broker that rejects an endpoint value as too long or empty
**When** it answers
**Then** it answers 400 `INVALID_ORIGIN` or `INVALID_DESTINATION` naming the wire field, which the client re-codes by endpoint role (AC-ROUTE-004) and memoizes like any per-input failure, and reserves `INVALID_REQUEST` (mapped to `BROKER_PROTOCOL_ERROR`) for envelope faults such as a body over `MAX_ROUTE_REQUEST_BODY_BYTES`.

`UrlFetchApp` has no per-call timeout, so the only bound the add-on can enforce is admission: an attempt starts only while one worst-case attempt still fits in the budget.

## AC-ROUTE-003: The provider returns routing failures, so the card still explains the event

**Given** an eligible event with no companion, opened in the event card when the hourly diagnostic allowance is exhausted, so the run's route budget is 0
**When** the card's diagnostic run routes the event's outbound role and the routing client throws `ROUTE_BUDGET_EXCEEDED`
**Then** the provider catches the throw and returns a `failed` outcome carrying the client's own `ROUTE_BUDGET_EXCEEDED` record, with no spec and no route resolved
**And** the engine captures the diagnostic payload in the planning loop, so the card shows the event's eligibility, directive interpretation and resolved origin and says timing is temporarily unavailable
**And** the reason is never clamped to `UNEXPECTED_ERROR`, and nothing is logged as an unexpected throw.

**Given** instead that the broker answers the event's return route with `NO_ROUTE` after the outbound route resolved
**Then** the returned `failed` outcome lists the outbound route on `routes` and names `NO_ROUTE`, and the card shows both.

**Given** instead that the card's attempt window refuses the event's broker attempt with `EXECUTION_BUDGET_EXCEEDED`
**Then** that failure is also returned and captured in the loop, not passed through the post-loop synthesis.

**Given** a provider step that throws an error carrying no registry code, such as `quantizeDuration`'s `RangeError`
**Then** the throw leaves the provider and the engine's per-event containment records `UNEXPECTED_ERROR`.

## AC-PRIV-002: Broker logs carry no caller identity

**Given** an authenticated broker, whichever Architecture §19.5 mechanism was selected
**When** it handles a route request, successful or failed, including an authentication failure
**Then** its request log line carries the request ID, response code, latency, normalized error code and Maps billable count only
**And** carries no authenticated principal, subject, email, installation identifier or credential, and no raw address
**And** any per-caller rate limiting keeps the principal in its own short-lived state, never in logs or metric labels.

The [route-data-minimization ADR](../adrs/2026-08-03-route-data-minimization.md)'s privacy claim and Technical Design §20.2's "no identity in either log" depend on it: the correlation ID is the only link from a user's last-run record to the broker's requests.

## AC-RECOVERY-033: One slice's suppressed-role pass never resets another slice's rotation

**Given** a calendar too large for any run to scan completely, whose front slice A has three suppressed-role keys and whose later slice B has 400, B's lowest parent ids being standing zeroed keys with nothing to delete
**And** one parent near the end of B's parent-id order has a displaced stale block for a zeroed role, split onto another slice
**When** B's suppressed-role pass is cut off by the evidence guard after some lookups, every fresh calendar-trigger run then re-reads and finishes A, and the chain later reaches B again
**Then** B's pass stores the last parent whose lookup completed as its entry's point
**And** each A pass finds no stored entry whose point is among its own parents (or finds A's own), walks A, completes, replaces only A's entry, and leaves B's entry stored unchanged
**And** B's next pass resumes after its own stored point, not at its front
**And** the late key's stale block is looked up and deleted within a bounded number of B passes, although no scan ever completes
**And** the stored list never holds more than `SUPPRESSED_LOOKUP_RESUME_MAX` entries, the oldest dropped first.

A single global resume point would be cleared by every A pass, so B would restart at its chronic front on every read and never reach its tail — and on such a calendar the sweep and the complete-scan orphan path never run, so nothing else would reach the stale block.

## AC-RECOVERY-034: The restoration lookup restores one copy of a key and converges the rest

**Given** a planned meeting whose live return role has no observed companion, so a create is pending
**And** two managed return blocks for that meeting, both live and both dragged beyond the observation range
**When** the restoration lookup returns both
**Then** exactly one is restored to the computed times — the one §13.5's canonical selection keeps (matching fingerprint, then most recently updated by Calendar's `updated` timestamp — `updatedMs` — then smallest id) — through an update, or a replace when an immutable field differs
**And** the other is queued for deletion as a duplicate, once, deduplicated by id against every delete already queued
**And** no new block is created
**And** when the pending spec carries `inBand` and one of the returned blocks is a same-anchor concluded record, the create is withdrawn and the record stays, while the other, non-record copy is deleted as a duplicate
**And** a concluded record of another occurrence among the matches is never deleted, nor is any other preserved record except a redundant same-anchor copy of the record kept under the freeze
**And** the record tests read the run's injected `now`, so a fixture that pins `now` gets the same classification from this pass as from the comparator.

The lookup is unbounded, so it can return every copy of a key. Restoring every copy would leave identical duplicates that a calendar never completing a scan may never see together again; restoring one and ignoring the others would leave them stranded beyond observation.

## AC-RECOVERY-035: An unchanged multi-day all-day event is looked up once, not on every run

**Given** a multi-day all-day event (a week of PTO) in the observation range that never had companions
**When** reconciliation runs repeatedly — calendar-trigger, daily and continuation runs — while the event is unchanged
**Then** the first run performs one overlong-source companion lookup, finds nothing, and records the event clean at its current etag
**And** later runs perform no lookup for it while its etag is unchanged
**And** after the user edits the event (a new etag), the next run looks it up again
**And** a lookup that finds a deletable companion records nothing, so the run after the delete applied looks again and only then records the event clean
**And** a lookup that fails records nothing and is retried next run
**And** dry runs read the clean list but never write it, a complete scan drops entries for events its listing no longer returned, the list never holds more than `OVERLONG_LOOKUP_CLEAN_MAX_ENTRIES` entries, and remove-all's fully-successful terminal clears it.

Without this memory both companion roles of such an event always read as missing, so the lookup would run on every run for months. Skipping on an unchanged etag is safe because an overlong source is ineligible whatever the settings: a companion can appear for it only after an edit that makes it short again, and that edit changes the etag.

## AC-ELIG-011: A transparent travel block is set back to busy

**Given** a title-pattern source marked Free, whose ordinary companions were created `transparent`
**And** the user then marks the source Busy, so the desired spec's `transparency` is `null`
**When** reconciliation runs
**Then** the comparator classifies each companion `update`, and the update patch carries `transparency: "opaque"` explicitly rather than omitting the field
**And** Calendar makes the companion opaque, and on the next run it reads back as `null`, so the pair is `unchanged` and no further write is issued.

**Given** instead that the user marks an opaque travel block Free
**Then** the same update realigns it to opaque once, and does not repeat.

A patch leaves an omitted field unchanged, so a patch that omitted `transparency` for a `null` spec would leave the block free while the comparison reported the same difference on every run.

## AC-CACHE-021: A valid cached route does not cause a metadata patch on every run

**Given** a companion whose stored route cache is `routeHash` H, `routeSecs` `"1455"` and `routeAt` T, valid for the current route input
**When** reconciliation plans its source, the routing client returns the durable entry (source `durable`, `durationSeconds` 1455), and the spec carries `routeSecs` `"1455"`
**Then** the observed triplet matches the spec's: the normalized `routeSecs` 1455 is compared as `String(1455)`, never as the number against the string
**And** the pair is `unchanged`, with no metadata patch and no Calendar write
**And** a companion whose stored `routeSecs` is blank or missing differs, so its triplet is repaired by a metadata patch.

## AC-RECOVERY-037: A frozen key's other copy is deleted, not updated

**Given** an ended meeting whose return block R is undisplaced and has ended, and whose return role is not provably live, so the provider emits a pinned spec for the key
**And** a second copy D of the same key, created by an earlier race and dragged 20 hours away, still inside the observation range
**When** a complete scan observes R and D together
**Then** R is `unchanged`
**And** D is deleted as a duplicate, never updated to the pinned spec's copied times
**And** when pagination puts R and D on different slices, the restoration lookup reaches the same outcome, so the block's fate does not depend on pagination
**And** a copy that is itself a preserved record, such as an ended anchorless block, is kept
**And** when a second same-anchor concluded record R2 of the same trip also exists, only the one §13.5's canonical selection keeps among R and R2 is `unchanged` and the other is deleted as a redundant copy — co-observed, or met together by the restoration lookup across slices.

## AC-RECOVERY-038: Continuation causes read the run's coverage from one field

**Given** a non-dry calendar-trigger run whose fresh window listing was complete, with no cursor offered
**When** the result is built
**Then** `diagnostics.coveredCurrentWindow` is true
**And** when the restoration or suppressed-role lookups were cut short at the evidence threshold (`suppressedCreates` or `suppressedDeletes` non-zero), or `diagnostics.continuableFailures` is non-zero, a continuation is scheduled.

**Given** instead a cursor-offered continuation slice, or a fresh run whose listing was truncated by the read budget
**Then** `diagnostics.coveredCurrentWindow` is false, its suppressed counts and continuable failures are no cause of their own, and a continuation is scheduled only for an unfinished scan (`chainFinished` false) or another cause
**And** a chain-finishing slice whose only other work is suppressed lookups — which never hold a slice — records `notUseful`.

**Given** a scoped diagnostic run, whose targeted read reports `scanComplete` true for one parent
**Then** `diagnostics.coveredCurrentWindow` is false.

## AC-RECOVERY-039: A chronic suppressed-role population costs at most one cycle of passes a day

**Given** a zero buffer and a weekday recurring meeting at the user's default origin, so about 128 planned parents in the window have both roles recorded `zero` with no live companion — more parents than one evidence tier's suppressed-role lookups can reach
**And** every scan covers the current window, and no other continuation cause exists
**When** the daily run's suppressed-role pass is cut off with keys pending
**Then** the pass counts the cut-off keys in `suppressedDeletes`, the run is `partial`, and a continuation is scheduled
**And** each continuation resumes after the stored point, and the pass that has looked up every parent since the daily run reopened the cycle stores its entry with origin `null`
**And** from then on the population's cut-off keys count nothing, so a pass cut off again is no continuation cause, and the run reports `success` when nothing else is pending
**And** the continuations driven by the population that day number at most ⌈n/k⌉ — never `MAX_CONSECUTIVE_CONTINUATIONS` every day — and the next daily run reopens the cycle
**And** a key that becomes suppressed after the cycle closed is still looked up by later passes, and at the latest by the next day's cycle.

## AC-RECOVERY-040: Generated start and end compare as instants

**Given** a travel block the add-on created from a spec whose `start` and `end` carry the source's `-05:00` offset in whole seconds
**And** Calendar returns the block with the same instants serialized differently — in UTC with a `Z` suffix, or in another offset after a DST change inside the block's span
**When** the next run compares the block with its unchanged spec
**Then** the owned-field comparison parses both sides with `parseInstantOrNull`, finds the instants equal, and classifies the block `unchanged`, writing nothing
**And** a block whose instants differ by any amount — dragged one minute — is classified an update and restored to the spec's times
**And** an observed start or end that does not parse never matches, so the update rewrites it.

## AC-CACHE-022: Same-anchor copies of one trip resolve to the record the comparator keeps

**Given** a meeting that ended two hours ago, whose return role `endedSpanRouteFree` answers `band`
**And** two copies of its return block left by a duplicated create, both carrying the meeting's end as their anchor and both undisplaced: R ended where it was planned and is a strict concluded record, L was dragged later and still ends after `now`
**When** `companionsFor` resolves the return role, in either index order
**Then** it selects R — an undisplaced concluded record ranks before an undisplaced live copy, and a displaced copy ranks last; ties go to the greatest `updatedMs`, `null` lowest, then the smallest id
**And** the provider freezes the role with a pinned spec and makes no broker call, and the comparator keeps R `unchanged` and deletes L as a duplicate
**And** with a second undisplaced record R2 of the same trip, the provider freezes the one ranked first, and the comparator — and §15.2.7's lookup when the copies are split across slices — keeps that same record and deletes the other as a redundant copy
**And** when the role is instead provably live, the freeze does not fire whichever copy is selected, and the role is routed.

## AC-ROUTE-004: A bad event location is reported as the destination on either route

**Given** a meeting already under way whose location field holds a pasted block of directions longer than `MAX_ROUTE_ENDPOINT_VALUE_CHARS`, so its outbound role is decided route-free and only the return route — whose `from` is the location — is attempted
**When** the routing client refuses the return route at step 0
**Then** it throws `INVALID_DESTINATION`, not `INVALID_ORIGIN`, the source's `failed` outcome and the stored `errorCounts` name `INVALID_DESTINATION`, and the user is pointed at the location
**And** when the broker instead rejects a return route's `from` as unresolvable with its wire code `INVALID_ORIGIN`, the client re-codes it `INVALID_DESTINATION` and memoizes and negative-caches it under that code
**And** a broker rejection of a return route's `to` — the effective origin — is reported `INVALID_ORIGIN`, as an outbound route's rejected `from` is.

## AC-OBS-003: The home card's last-sync line reports the last run, never a stale success

**Given** a daily run that ended `success` at 09:42
**And** a later calendar-trigger run that ended `partial` at 11:05 because one source failed `UNEXPECTED_ERROR`
**When** the user opens the home card
**Then** the "Last sync" line shows the stored record's `status` and `completedAt`: partial, at 11:05
**And** the card shows no "last successful sync" line or time, because no stored field carries one; it never shows 09:42 as a success, and it never labels 11:05 as one.

## AC-RECOVERY-041: An event with an unreadable timestamp is explained on the card

**Given** an eligible-looking event on the primary calendar whose `start.dateTime` Calendar returns in a form that does not parse
**When** the user opens it and the card runs the scoped diagnostic
**Then** the target's planning outcome is `failed` with `CALENDAR_EVENT_INVALID`, and the post-loop synthesis calls `buildUnresolvedEventDiagnostics(eventId, "CALENDAR_EVENT_INVALID")`, which accepts the reason and does not throw
**And** the card names the cause from `eventDiagnostics.eligibility.reason`, not `UNEXPECTED_ERROR` and not a generic failure
**And** the payload's `destination` is `null`, even though the targeted read returned the event, and the card leaves the destination out instead of showing `null`. The same holds for the `EXECUTION_BUDGET_EXCEEDED` and `UNEXPECTED_ERROR` give-up payloads.

## AC-CONFIG-013: A settings-gate failure carries its field list in `validationErrors`

**Given** a stored settings document whose `eligibility.titlePattern` does not compile
**When** a scoped diagnostic (dry run) runs
**Then** the engine calls `buildFailureResult(null, options, validation)` and returns `status: "failed"`, with `errors` holding exactly one `INVALID_SETTINGS` record and `validationErrors` equal to the §5.3 `ValidationResult.errors`, including the `eligibility.titlePattern` entry
**And** the diagnostic card lists `validationErrors`, and the settings card offers reset-to-defaults (REQ-CONFIG-018).

**Given** structurally valid settings whose default origin is blank
**When** a write run reaches the write-readiness gate
**Then** the result is `failed`, with `errors` holding one `INVALID_SETTINGS` record and `validationErrors` holding exactly `{ field: "origins.default.value", code: "MISSING_DEFAULT_ORIGIN", message: "missing" }`
**And** the stored record's `errorCounts` is `{ INVALID_SETTINGS: 1 }`, and `validationErrors` is not persisted
**And** a boundary failure (a thrown window read) built by `buildFailureResult(error, options)` has `validationErrors: null` and its own registry code in `errors`.

## AC-CONFIG-014: Rolling back across a settings-schema bump blocks runs without destroying settings

**Given** a user who saved settings under a release that raised `CURRENT_SETTINGS_SCHEMA` to 2, so `dtp.settings` holds `schemaVersion: 2` and an extra top-level key
**When** the deployment is rolled back to a release whose `CURRENT_SETTINGS_SCHEMA` is 1 and a run starts
**Then** `loadSettings` reports a structural `INVALID_SETTINGS` entry on `schemaVersion`, the run stops before planning, and nothing is created or deleted
**And** the stored document is left byte-for-byte unchanged; the extra key is not used as a downgrade path
**And** the document changes only if the user chooses reset-to-defaults. After a roll-forward to the release with schema 2, it loads intact.

## AC-CONFIG-015: No eligible source types is surfaced on the home card

**Given** a structurally valid settings document with `eligibility.includeOutOfOffice: false` and `eligibility.titlePatternEnabled: false`  
**When** the user opens the home card  
**Then** `loadSettings` reports no validation error and `writeReady` is true  
**And** the card renders a warning that no source types are enabled and no travel blocks will be created, derived from the loaded settings rather than from the last-run record, so it appears before any run has happened  
**And** enabling either toggle removes the warning on the next card render  
**And** a run against those settings completes with `status: "success"`, every source event ineligible, and nothing created (REQ-CONFIG-014a).
