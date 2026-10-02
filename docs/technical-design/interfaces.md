# Technical Design Interface Reference

This file collects the principal function contracts from the technical design.

`compareDesiredAndObserved` takes planning outcomes as well as specs: it may only delete generated events whose parent planned successfully or was ruled ineligible (§17.4), or whose parent is absent from a **complete** scan (§15.2.3) — and never a concluded record (§15.2.9: ended before the run's injected `now`, undisplaced from its persisted anchor). On matched branches a concluded record splits on **anchor equality**, a route-free test: the desired spec's source anchor equals the record's persisted anchor → same occurrence → `unchanged` (a past block is never updated, replaced, or metadata-patched, and routing is short-circuited for the role); anchors differ → the record matches nothing: the key falls through to the create branch when the desired span still lies ahead, and produces no write at all when it has already ended (an after-the-fact tidy-up cannot be padded) — the record staying as history either way. The concluded tests are why the comparator takes `now`.

Write operations take the observed event rather than an event ID, so the ownership marker and version can be verified at write time rather than trusted from read time (§16.5.1).

```javascript
// Settings
// Never throws on validation problems: the engine branches on the tiers
// (structurallyValid gates every run, writeReady gates writes -- 5.3).
// Never throws on a corrupt document either: malformed stored JSON and
// unmigratable schemas both come back as structural INVALID_SETTINGS
// errors (5.4); an absent document loads the 5.2 defaults
loadSettings() -> { settings: UserSettings, validation: ValidationResult }
saveSettings(settings) -> UserSettings
validateSettings(settings) -> ValidationResult

// Directives
parseDirectives(description) -> ParsedDirectives

// Calendar
// Deadline-aware: checks shouldStop between pages and returns the
// retrieved prefix with scanComplete false when it fires -- truncation
// is a first-class state downstream (7.2.1). RESUMABLE: nextPageToken is
// non-null exactly when the listing stopped early AT A RESUMABLE POINT
// -- after a fetched page, or the untouched token of a never-attempted
// resume; a fresh listing stopped before its first page has no token
// and returns null with scanComplete false (nothing listed, the retry
// re-lists fresh). The engine persists
// it (dtp.windowScanCursor, pinned to the range that produced it) and a
// continuation passes it back as resumeToken so successive passes tile
// the range instead of re-reading the same prefix until the cap. An
// expired or rejected resumeToken falls back to a fresh scan, never a
// thrown run
listWindowEvents(calendarId, observeStart, observeEnd, shouldStop,
                 resumeToken)
  -> { events: RawCalendarEvent[], scanComplete: boolean,
       nextPageToken: string | null, resumed: boolean }
// resumed reports whether the resumeToken was HONORED: false ONLY
// when none was given or the token was ATTEMPTED and rejected, falling
// back to the SAME requested range from page one -- the discriminator
// the engine's offered-cursor semantics and eager dead-token clear
// read. A token never attempted (shouldStop already true at entry,
// zero pages fetched) is NOT a rejection: the call returns resumed
// true with the untouched token as nextPageToken, or the eager clear
// would delete a live chain cursor on a starved run. Nor is a
// transient failure of the resumed fetch: fallback fires ONLY on
// Calendar's specific invalid-page-token rejection; any other read
// failure throws CALENDAR_READ_FAILED, cursor retained (7.2.1). Any run that was
// OFFERED a cursor listed the chain's pinned -- possibly stale -- span,
// so it never claims complete-scan credit for the current window,
// honored or not; a rejected token's stored cursor is cleared EAGERLY
// at listing time (clearing is skip-safe; an eager replace is not) and
// the fallback's own nextPageToken saves through the application-gated
// path, restarting the chain over the same span (or the completion
// clear applies when the fallback walked off the end -- the pinned
// span is then fully covered and the chain done) (7.2.1)
listWorkingLocationEvents(calendarId, start, end) -> RawCalendarEvent[]
// Ownership-filtered (privateExtendedProperty=dtp=1), paginated until
// done or shouldStop fires, completeness reported -- a truncated shrink
// scan must not lower the high-water mark, and a large vacated range
// must not spend the deadline inside one call. EXCLUDES cancelled
// tombstones, like listCompanionsByParent below: a manually deleted
// stranded companion would 404 its queued delete on every run --
// resolvedAll never satisfiable, the mark frozen -- and the 15.2.7
// direct collision resolution would update a deleted resource
// (technical design 7.6)
// Every ObservedGeneratedEvent[] return below (this listing,
// listCompanionsByParent, listGeneratedEventsUpdatedSince,
// listGeneratedEventsPage) normalizes INSIDE the repository and
// null-filters the 8.1 id/marker-unrecoverable exclusions with the
// same logged warning -- no caller ever sees a null element. KEYLESS
// entries (unrecoverable parent/role, valid id+marker) ARE returned:
// real, addressable, deletable resources; key-matching consumers
// simply never match them (8.1)
listGeneratedEventsBetween(calendarId, start, end, shouldStop)
  -> { events: ObservedGeneratedEvent[], scanComplete: boolean }
// Ownership + parent filtered, no time bounds, EXCLUDES cancelled
// tombstones (a deleted companion keeps its dtp metadata and must read as
// absent). Used by the overlong-source cleanup (15.2.6), the
// out-of-window restoration pass (15.2.7), AND the 17.1 targeted
// diagnostic read -- which is why scoped diagnostics may skip 15.2.7:
// the unbounded, tombstone-filtered semantics here are load-bearing for
// that skip, so narrowing them breaks it
listCompanionsByParent(calendarId, parentEventId) -> ObservedGeneratedEvent[]
// Targeted single-event fetch for diagnostic runs (17.1): the window scan
// cannot see an event beyond the observation range, and the card must be
// able to say OUTSIDE_WINDOW rather than nothing
getEventById(calendarId, eventId) -> RawCalendarEvent | null
// One page of the unbounded ownership scan; the consumer owns the paging
// loop and its budget checks. The removal worker interleaves this with
// deletion so retries resume without a persisted cursor (19.4)
listGeneratedEventsPage(calendarId, pageToken)
  -> { events: ObservedGeneratedEvent[], nextPageToken: string | null }
// Ownership-filtered, updatedMin-bounded listing for the 15.2.8 sweep: a
// stray exists only because it was MOVED, and a move bumps `updated`, so
// the server-side bound keeps the sweep small and resumable where a
// read-only full-history scan would return the same truncated prefix
// forever. EXCLUDES cancelled tombstones -- updatedMin listings force
// deleted entries in, and a just-deleted companion would re-enter the
// diff as a 404-bound delete. Pages until done or shouldStop() fires
// (scanComplete reports truncation)
listGeneratedEventsUpdatedSince(calendarId, updatedMin, shouldStop)
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
// numeric; everything else maps to null, never 0 (technical design 13.3).
// TOTAL, like normalizeCalendarEvent: never throws (8.1) -- a throwing
// normalizer would fail the whole listing and, with cursor writes
// application-gated, freeze the scan chain at the malformed resource's
// slice. Content corruption degrades field-wise to null (the null
// fingerprint forces a whole rewrite when the key is desired).
// Identity corruption splits by what is lost (8.1): an unrecoverable
// id or ownership marker returns null and the engine excludes the
// resource with a logged warning (it cannot be safely deleted, 15.3 --
// defense in depth, since the ownership-filtered listings guarantee
// the marker); unrecoverable parentEventId/role with valid id+marker
// normalizes KEYLESS (key null) -- unmanageable, so the engine removes
// it from the observed set and queues its deletion on any scan
// (evidence in hand; the marker satisfies 15.3; self-healing, since a
// desired block is recreated cleanly by its parent's planning),
// preserved only when the lenient 15.2.9 deletion-side test keeps it
normalizeObservedGeneratedEvent(rawEvent)
  -> ObservedGeneratedEvent | null
evaluateEligibility(event, directives, settings, window) -> EligibilityResult
// null when every fallback bottoms out at a blank default (10.4): the
// engine records a per-event failed outcome (MISSING_DEFAULT_ORIGIN)
// instead of routing -- reachable only on dry runs, since writeReady
// gates write mode on a configured default
resolveOrigin(event, directives, settings, workingLocations)
  -> ResolvedOrigin | null
// Wraps listWorkingLocationEvents: a read failure records
// WORKING_LOCATION_UNAVAILABLE (18.2) and returns [], so origin resolution
// degrades to the default origin instead of failing the run (7.5)
fetchWorkingLocationsSafely(start, end) -> RawCalendarEvent[]

// Routing and provider
// requestContext carries { role, cacheEntry, now, budget, correlationId };
// the client consults the cache before the network and reports provenance as
// result.source ('durable' | 'ephemeral' | 'broker') -- anything other than
// 'durable' needs persisting (11.1). budget.remaining is decremented per
// HTTP attempt, retries included (11.2).
getRouteDuration(from, to, requestContext) -> RouteResult
// context carries the RESOLVED observed companions per role
// (context.observedCompanions, 12.1.1): the provider applies the
// 15.2.9 freeze (strictly concluded record + anchor equality ->
// unchanged, routing short-circuited) BEFORE routing -- a frozen role
// emits a spec carrying the 14.1 anchor and the record's observed
// fields verbatim, no route resolved and the role omitted from
// outcome.routes (fields never consulted: anchor equality classifies
// unchanged first; the spec exists so the key stays desired) -- and
// still passes
// the cache TRIPLETS through to the routing client uninspected --
// staleness policy stays in one place (13.3)
getGeneratedEventSpecs(context) -> PlanningOutcome

// Context construction -- observed companions must be indexed before planning
// so their route caches, observed fields, and anchors (the latter two
// for the 15.2.9 freeze) are reachable (technical design 12.1.1). THE
// INDEX makes the key-collision choice: a key shared by a concluded
// record and a live block (the ~40h post-reschedule overlap 15.2.9
// creates by design) indexes the LIVE, non-concluded companion -- it
// owns the key's cache (the record's triplet describes a trip already
// taken), and a live companion is never frozen; a key observed only as
// a record indexes the record, which is what the freeze reads. A
// last-wins collapse could leave the record shadowing the live block,
// re-calling the broker every run for a role with a valid cache
// (ADR 0011, REQ-PERF-015)
indexByGeneratedKey(observedEvents) -> Map<string, ObservedGeneratedEvent>
// The resolved companions themselves, not just their cache triplets --
// a triplet-only context could not recognize a concluded record
// (12.1.1, 15.2.9); reads the index's live-over-record collapse above
companionsFor(observedByKey, parentEventId)
  -> { outbound: ObservedGeneratedEvent|null,
       return: ObservedGeneratedEvent|null }

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
// dryRun suppresses even the mark-ADVANCE on the common path -- a preview
// must not change whether a later run classifies as a shrink. shouldStop
// bounds the vacated-range scan like every other paged read; early return
// reports scanComplete false and retains the mark
findStrandedCompanions(window, settings, dryRun, shouldStop)
  -> { shrunk, events, scanComplete }                                  // 7.6
// engine lowers the high-water mark only after applyDiff confirms every
// stranded event RESOLVED (resolvedAll: deleted, or realigned inside
// the window by an applied restoration write -- 15.2.7/17.5) AND the
// cleanup scan was complete, never on dry run
// The load never throws; the CONSUMER hardens the value: an absent or
// unparseable stored mark (Date.parse -> NaN) is treated as absent in
// findStrandedCompanions' test, so the advance branch overwrites the
// corrupt key with a valid mark -- self-healing, never a permanently
// failing shrink classification (7.6)
loadHighWater() / saveHighWater(observeEnd)                           // 7.6

// Comparison helpers
// Takes the ObservedGeneratedEvent -- NOT its fields bag -- and reads
// observed.observedFields against the spec's owned fields (15.2.1),
// the same first-argument shape as every other observed-side helper
ownedFieldsMatch(observed, desiredSpec) -> boolean
// The 15.2.9 concluded-record test: observed end before `now` AND
// observed times within the persisted anchor's companion span
// (undisplaced, the 15.2.8 moved-test). The STRICT test -- a valid
// anchor is required; the deletion paths additionally preserve an
// ended ANCHORLESS companion conservatively (a stray that persists
// beats erased history), while the write-side rules (matched-branch
// anchor-equality freeze, 15.2.7 lookup exclusion) use the strict
// test alone, so an anchorless match still restores normally. Shared
// by the comparator (deletion exceptions, the anchor-equality matched
// rule, and the pre-planning routing short-circuit for same-anchor
// roles), the 15.2.3 pass, the 15.2.6, 15.2.7, and 15.2.8 exceptions,
// and the engine's fallback suppressedDeletes counter; collapse of a
// record against the new occurrence's live block never happens (13.5),
// and remove-all ignores the test entirely
isConcludedRecord(observedEvent, now) -> boolean
// The DELETION-side lenient companion test: isConcludedRecord OR ended
// with a missing/unparseable anchor. Every absence-of-desire deletion
// path (comparator table, 15.2.3 pass, 15.2.6 merge, 15.2.8 sweep) and
// the fallback suppressedDeletes counter filter through THIS one; the
// write-side rules keep the strict test (15.2.9)
isPreservedRecord(observedEvent, now) -> boolean
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
compareDesiredAndObserved(desiredSpecs, observedEvents, planningOutcomes,
                          scanComplete, now)
  -> ReconciliationDiff

// Reconciliation
runReconciliation(options) -> ReconciliationResult
// Returns what Calendar ACCEPTED; run status is built from this, not from
// the proposed diff (technical design 17.5, REQ-ERROR-006). Budget-aware:
// checks elapsedExceedsExecutionBudget between operations and defers the
// remainder (deferredOps -- not failures; deferred > 0 reports partial)
applyDiff(diff, runStartMs) -> ApplyResult
// applied null on dry run; eventDiagnostics null except on
// eventIdFilter runs, where it becomes result.eventDiagnostics (17.6).
// Summarizes the ApplyResult into result.applied (17.2) -- the
// contract-defined path by which ACCEPTED counts reach saveRunStatus
// and the 20.2 record; the diff alone is only the proposal.
// planningOutcomes is the failed-outcome fold (17.4): the failed
// outcomes' AppErrorRecords merge into result.errors AGGREGATED PER
// CODE (one record per code, its `occurrences` field (18.1) carrying
// the count and sourceEventId the first aggregated source -- a
// budget-marked slice can hold hundreds of identical
// EXECUTION_BUDGET_EXCEEDED records), and any RETRYABLE failed
// outcome caps a non-dry run at partial (a non-retryable one --
// ROUTE_TOO_LONG's benign steady state -- reports its error without
// barring success, 17.4) -- without it a
// per-event containment failure or budget-marked remainder would be
// invisible to status and reset the continuation counter over
// unplanned work
buildRunResult(diff, applied, planningOutcomes, options, eventDiagnostics)
  -> ReconciliationResult
// Top-level error boundary: a run-wide throw (settings, window read)
// becomes a failed result and reaches the stored record (arch 14.2)
buildFailureResult(error, options) -> ReconciliationResult
// Complete ReconciliationResult for skipped/disabled outcomes -- bare
// status objects would make callers special-case those states (17.2)
buildStatusOnlyResult(status, reason, options) -> ReconciliationResult
// THE guarded persistence wrapper -- the only way the engine calls
// saveRunStatus. On a throw it pushes STATUS_PERSIST_FAILED onto the
// result's diagnostics.warnings and logs, never rethrows (18.2). One
// shared helper for all four call sites (both validation gates, the
// success path, the error boundary) so the guard cannot drift between
// hand-rolled copies
saveRunStatusGuarded(result) -> void
// The full execution threshold (23.1): gates application and is
// re-checked by applyDiff between operations. The planning loop broke
// on this guard historically; it now breaks on
// elapsedExceedsPlanningBudget below, which carries the
// mark-unprocessed-sources-failed obligation with it
elapsedExceedsExecutionBudget(runStartMs) -> boolean
// Tighter guard for BULK listings (window and shrink -- both run
// BEFORE planning; the shrink listing goes first because it has no
// cursor and progresses only through its applied deletions, while the
// window scan -- which consumes the whole region on oversized
// calendars -- resumes by cursor and loses nothing by running second):
// fires at
// READ_BUDGET_FRACTION of the execution threshold, reserving headroom
// to plan and APPLY what was read -- a read guarded by the full
// threshold returns with that check already true, and everything it
// retrieved is marked failed and never applied; on a resumable scan the
// cursor would advance past a slice nothing reconciled (23.1)
elapsedExceedsReadBudget(runStartMs) -> boolean
// Planning's tier: stops the loop STARTING new sources at
// PLANNING_BUDGET_FRACTION (remainder marked EXECUTION_BUDGET_EXCEEDED
// via markRemainingSourcesFailed) -- route calls run seconds each and a
// full-threshold planning loop would burn straight through the evidence
// tier below (23.1)
elapsedExceedsPlanningBudget(runStartMs) -> boolean
// Late tier for the absence-evidence passes, self-draining first and
// bounded-but-non-draining LAST: 15.2.7 restoration lookups (their
// queue shrinks across runs as resolved creates apply), then whichever
// of the 15.2.3 orphan point reads and the 15.2.8 daily sweep the
// scan's completeness selects (mutually exclusive per run) -- deferral
// behind a self-draining predecessor is transient -- and the 15.2.10
// zero-emission lookups last of all: their chronic population never
// drains, so ahead of the sweep they would starve it permanently,
// while their own deferred work drains through the sweep-less
// suppressed-work continuation. Fires at EVIDENCE_BUDGET_FRACTION of the
// execution threshold. No phase sits behind a same-threshold
// predecessor that consumes its region every run --
// the listing pages until the read threshold
// fires and planning stops only at ITS mark, so a shared guard would
// already be true at entry: zero lookups, every absence-gated operation
// suppressed, on every slice, forever (23.1)
elapsedExceedsEvidenceBudget(runStartMs) -> boolean
// Every marked outcome carries an EXECUTION_BUDGET_EXCEEDED
// AppErrorRecord -- failed outcomes MUST have error populated (17.4):
// the buildRunResult fold and the 17.1 scoped-diagnostic synthesis
// both read it
markRemainingSourcesFailed(orderedSources, currentEvent, planningOutcomes) -> void
// Resets the run-scoped warning buffer. The engine's FIRST statement,
// before even the lock attempt -- every result builder (the
// lock-contention skip included) installs the buffer by reference as
// diagnostics.warnings, and pre-comparator warning sites (daily counter
// reset, cursor persistence, working-location fetch) append to it
beginRunWarnings() -> void
// Non-fatal run warnings (codes from the 18.2 registry, e.g.
// WORKING_LOCATION_UNAVAILABLE): appends to the run's WARNING BUFFER
// (4.11) AND logs via logWarning, without failing the run. The buffer
// is one array the engine creates at run start; the comparator installs
// THAT ARRAY by reference as diff.diagnostics.warnings and every result
// builder carries it into the result -- which is why warnings recorded
// BEFORE the comparator (cursor persistence, the daily counter reset)
// and AFTER the result is built (post-apply bookkeeping, the enqueue
// guard) all land in the same persisted diagnostics. One mechanism for
// every engine warning site; saveRunStatusGuarded embeds the same
// append+log internally for STATUS_PERSIST_FAILED
recordRunWarning(code, error) -> void
// Constructs an AppErrorRecord (18.1) from a registry code (18.2):
// message and retryability from the registry entry, sourceEventId from
// the event. Used by the engine's per-event failure paths, e.g. the
// MISSING_DEFAULT_ORIGIN outcome (10.4)
buildAppError(code, event) -> AppErrorRecord
// Recognizes a throw that already carries an 18.2 registry code (a
// repository read surfacing CALENDAR_READ_FAILED, say), so the
// per-event planning containment preserves the registry's
// transient-vs-permanent classification and retryability instead of
// blanket UNEXPECTED_ERROR; null for unrecognized throws (arch 14.2)
registryCodeOf(error) -> string | null
// Engine post-pass on the diff: one unbounded parent lookup per pending
// create; cancelled tombstones and PROVABLY concluded records among
// the returns are passed over (15.2.7, 15.2.9 -- restoring a past
// trip's record to a rescheduled occurrence would rewrite history; an
// anchorless ended match still restores, rewriting its metadata); a
// same-key match
// restores the dragged companion, CLASSIFIED
// like an in-window match (15.2.5) -- an update ordinarily, a REPLACE
// when eventType (or Spike-resolved unpatchable outOfOfficeProperties)
// differs, since an update patch on the immutable field is rejected on
// every run. Restoration supersedes the shrink cleanup: a matched event
// is removed from diff.deletes but STAYS in cleanup.events -- the
// high-water gate checks resolvedAll (deleted OR restoration write
// applied), so a failed restoration holds the mark like a failed
// delete (in the replace case the event's deletion belongs to the
// replace's delete half). Checks shouldStop
// -- the 23.1 EVIDENCE threshold, its own tier past the bulk-listing
// one the window listing may have exhausted -- between lookups; when
// it fires the pass SUPPRESSES every unresolved create (out of
// diff.creates, counted in
// diff.diagnostics.suppressedCreates -- the diff it mutates carries the
// diagnostics object, which is the pass's output path; creates
// colliding with a shrink-cleanup delete were already resolved
// DIRECTLY against the in-memory stranded event before any lookups, so
// the GUARD can never suppress one -- a run that hits the full
// deadline before the pass starts counts every pending create,
// colliding included, since nothing of the pass ran, 15.2.7), because
// application
// legitimately proceeds with the headroom the evidence threshold
// leaves and must never apply a create whose lookup did not run.
// NON-DRY only: a dry run applies nothing, so unresolved creates stay
// in the preview diff, counted in suppressedCreates as unverified --
// the dryRun parameter exists for exactly this branch, like
// findStrandedCompanions' (15.2.7). SKIPPED on scoped diagnostic runs:
// the 17.1 targeted read already performed this exact
// lookup for the one parent, so re-querying is a redundant round trip
// whose failure would fail an otherwise complete diagnosis
resolveOutOfWindowCompanions(diff, cleanup, dryRun, shouldStop) -> void
// Daily-run ownership sweep (15.2.8): updatedMin-bounded listing (a
// stray was necessarily moved, and moves bump `updated`; cancelled
// tombstones excluded; stops early when shouldStop fires),
// anchor-selected candidates (event id absent from the window read,
// anchor inside the maximal anchor band: from planStart minus the
// discovery slack and duration cap up to NOW + MAX_WINDOW_DAYS + the
// duration cap -- upper bound anchored at now, NOT planStart, which
// sits a lookback behind and would reject a far-edge stray; the
// current planEnd would let a window shrink hide one, 15.2.8),
// one getEventById per
// candidate parent -- shouldStop checked BETWEEN reads too, and a sweep
// cut short anywhere never writes the watermark -- then a parent-STATE
// decision: absent/cancelled delete (concluded records excepted,
// 15.2.9); live-but-out-of-window and
// in-window ineligible delete only DISPLACED candidates (observed
// outside the persisted anchor's companion span -- the moved-test; an
// undisplaced candidate aged out naturally and is preserved as history
// however recently patched, 15.2.8/19.4); planned
// keeps its candidates (restoration owns them) unless the key is
// already satisfied in-window AND the candidate is not a concluded
// record (a stranded duplicate must be displaced -- a reschedule
// leaves the record sharing the key with the new block by design);
// failed preserves --
// restoration is create-driven and cannot reach a stray whose parent no
// longer plans. Candidate selection skips keyless listing returns
// (unrecoverable parent, 8.1) like anchorless ones -- no parent to
// point-read; the null-id read could throw, deterministically failing
// every sweep over the same event. Runs only on a COMPLETE window
// scan; takes the full
// observed list -- keyless corrupt events included, never the key
// index: the id test must see in-window duplicates the index collapsed
// away AND window-observed keyless events whose deletion is already
// queued (8.1) -- and the run's injected `now`
// (updatedMin, the anchor band, and the dtp.sweepCompletedAt watermark
// all derive from it -- a wall-clock read would unpin them).
// sweepComplete false = listing truncated or read loop cut short; the
// engine records it as diagnostics.sweepComplete and writes the
// watermark only after applyDiff confirms deletedAll(events) -- the
// same application-gated rule as the shrink high-water mark
sweepOutOfWindowCompanions(observedAll, planningOutcomes, window,
                           now, shouldStop)
  -> { events: ObservedGeneratedEvent[], sweepComplete: boolean }
loadSweepWatermark() / saveSweepWatermark(now)                    // 15.2.8
// Incomplete-scan orphan resolution (15.2.3, 15.2.4): reads its
// candidates from diff.preserved -- only companions whose parent has NO
// planningOutcomes entry (a failed parent's outcome is known; no read;
// disjoint from the shrink queue by construction -- 7.6's merge
// contributes only window-unobserved events while these are observed).
// One parent point read per candidate, shouldStop checked BETWEEN reads
// -- absent/cancelled parent proves the orphan and MOVES it from
// preserved into diff.deletes; a LIVE parent is evaluated in place
// through the route-free desired-state tests (planning-range overlap
// against `window`; 9.2 eligibility against `settings` -- needed here,
// unlike the sweep, because a no-outcome parent HERE can sit inside the
// planning range on an unread page, where position alone cannot decide,
// while the sweep's no-outcome parents are all outside the PLANNING
// range (some read but unplanned, in the observation margin), where
// OUTSIDE_WINDOW alone carries deletion authority;
// directive-derived roles): no desired companion for the key ->
// delete, whatever page the parent sat on (a stale companion split
// from its live source by pagination must not survive on liveness
// alone); key still desired -> preserve this run, the parent's own
// slice restores it through the 15.2.7 lookup; a PRESERVED record
// (15.2.9's deletion-side test: concluded, or ended with an unusable
// anchor) is spared without a read, which is why the signature carries
// `now`; a read the guard cut
// off preserves the candidate and counts in suppressedDeletes
resolveUnmatchedCompanions(diff, planningOutcomes, window, settings,
                           now, shouldStop) -> void
// Zero-emission cleanup (15.2.10): for every PLANNED outcome, keys
// whose role is PRESENT in PlanningOutcome.routes but ABSENT from
// outcome.specs (the pair is the test -- a zero route with nonzero
// buffer still emits a spec; an unrouted role proves nothing) and has
// no LIVE observed companion in the window read (a key observed only
// as a concluded record stays in -- the comparator preserves the
// record and cannot reach an unobserved stale block sharing the key),
// WHATEVER the route's
// provenance (a provenance filter would hide suppressed keys from
// their own retry). Keys grouped by parent, ONE listCompanionsByParent
// per PARENT -- the read returns both roles, and the canonical zero
// case zeroes both roles of one parent, so per-key lookups would
// double the reads; matches for
// the zeroed roles join diff.deletes, deduplicated by id, preserved
// records excepted (15.2.9). Planned-parent deletion authority (17.3)
// -- routing itself zeroed the role out of existence, which the
// route-free 15.2.3 evaluation must preserve through. Runs on
// incomplete scans, daily runs, AND continuations; LAST on the
// evidence tier, behind the sweep (23.1). shouldStop checked between
// lookups; keys cut off count in suppressedDeletes -- the
// deadline-starved engine branch invokes this same pass with the guard
// already true (zero lookups, every pending key counted), so no second
// population computation exists to drift (15.2.4, 15.2.10)
resolveZeroEmissionCompanions(diff, planningOutcomes, observedByKey,
                              now, shouldStop) -> void
// Window-scan cursor persistence (7.2.1) -- User Properties, engine
// policy, stubs live beside the other Status persistence, NOT in
// CalendarRepository. Saved when a truncated non-dry scan STARTS a
// chain (no cursor stored -- a fresh truncated run never overwrites a
// pending cursor, the chain owns it), ADVANCES one (honored token,
// truncated again), or RESTARTS one a rejected token's eager clear
// emptied (the truncated fallback's own token, through the same gated
// save -- there is no replace write); resumed by continuation and
// daily runs;
// cleared by chain completion (offered cursor, listing walked off the
// end -- honored or fallback alike), by a fresh COMPLETE non-dry scan,
// and by remove-all (19.4); dry runs never touch it. SAVES are
// APPLICATION-GATED: the decision is computed at listing time
// (pendingCursorWrite) but persisted only after applyDiff ran with
// NOTHING DEFERRED, so a run that throws or times out between listing
// and application -- or defers mid-apply -- never advances past a
// slice whose operations did not land (write failures do not hold the
// save: they retry when the slice is re-read, while a persistent
// rejection would freeze the chain). CLEARS execute at the same
// post-application point but also when application was skipped for
// time -- both clear decisions are skip-safe, and a moot cursor
// retained across an out-of-time complete scan would capture that
// run's continuation for the stale span -- and the rejected dead
// token's clear is EAGER at listing time: clearing is skip-safe (a
// lost cursor restarts the chain) where an eager replace could
// advance past the fallback's unprocessed pages, and a token left for
// the post-apply write would loop the dead token on every run that
// dies before application (7.2.1). Every
// cursor-OFFERED run is treated as scanComplete false downstream --
// it listed the pinned, possibly stale span, not the current window.
// The load NEVER THROWS and validates the stored shape: absent,
// malformed, or unreadable cursors return null, degrading to a fresh
// scan -- never a failed run (AC-RECOVERY-017)
loadWindowScanCursor()
  -> { pageToken, observeStart, observeEnd } | null
saveWindowScanCursor(cursor) / clearWindowScanCursor()
// Whether a partial run's remaining causes are ones another pass can
// drain: deferred operations, an application skipped for time, an
// exhausted route budget, an unfinished scan chain, or -- on a run
// whose scan covered the CURRENT window -- evidence-tier lookups cut
// short (restoration, orphan resolution, or zero-emission cleanup --
// never the daily-gated sweep) or planning cut short at its
// tier (EXECUTION_BUDGET_EXCEEDED outcomes; a continuation re-reads
// that window and retries them, while a chain slice's suppressed or
// time-starved work instead waits for the slice's next fresh read --
// 7.2.1's division of labor). A truncated SWEEP is never a cause: it
// is daily-gated, so no continuation can re-run it (15.2.8). False
// when the only cause is scan coverage after a FINISHED chain -- a fresh chain would re-tile
// identical work (a pass justified by other causes may re-tile as a
// side effect, bounded by the day's remaining allowance) (19.6, 23.4)
continuationStillUseful(result, chainFinished) -> boolean
// Hourly diagnostic allowance (20.3), RESERVE-then-REFUND: the reserve
// writes the whole remaining allowance as used BEFORE any broker call
// and returns the grant (the run's RouteBudget when reason ===
// 'event-diagnostic'); the refund returns the unspent remainder in the
// engine's finally. Reservation order is the safety property: a failed
// reserve grants 0 (FAILS CLOSED on any Properties error), a failed
// refund under-grants until the bucket rolls over -- neither direction
// can exceed the ceiling, unlike spend-then-record, where a post-call
// write failure re-grants already-spent allowance (18.2)
reserveDiagnosticAllowance(now) -> number
// The refund is a DECREMENT (used = max(0, used - unspentCount)), never
// an absolute write, and a no-op at unspentCount 0 -- so a reservation
// that failed closed (granted 0, spent 0) cannot have its refund clobber
// the bucket when Properties recovers; the engine additionally skips the
// call entirely when nothing was granted
refundDiagnosticAllowance(unspentCount, now) -> void
// Console/log-only diagnostic for failures that occur after the run's
// result is built (e.g. the finally-block spend write) -- never throws
logWarning(code, error) -> void
// Assembles the per-event diagnostic payload (17.6) for eventIdFilter
// runs; origin and outcome are null when eligibility already rejected;
// routes copied from outcome.routes (17.4). effectiveBufferMinutes is
// passed in by the engine (directive override or settings default) --
// it must be displayable even when planning failed before any spec
// existed to infer it from. destination is the NORMALIZED location
// (trimmed, 8.4; empty string when the source has none; null only in
// the synthesized fallback payloads) -- REQ-UI-014: nothing downstream
// retains it, and without the capture the card would need a second
// Calendar read to show it. Diagnostics are dry-only and never
// persisted, so the address stays in-card
captureEventDiagnostics(event, eligibility, directives, origin, outcome,
                        effectiveBufferMinutes)
  -> EventDiagnostics
// Fallback payload when the diagnostic flow cannot evaluate the opened
// event: a synthesized ineligible EligibilityResult with reason
// EVENT_NOT_FOUND or PARENT_NOT_FOUND (engine-side, targeted read
// resolved nothing, 17.1), EXECUTION_BUDGET_EXCEEDED or
// UNEXPECTED_ERROR (engine-side, the single post-loop synthesis site
// reads the target's FAILED outcome -- the planning-tier boundary
// marked it, or its iteration threw into the per-event containment;
// the truthful answer is "the run gave up on this event", never
// "this event does not exist", 4.5/17.1), DISABLED_GLOBALLY
// (engine-side, the disabled
// gate precedes the targeted read on a scoped run, 17.1), or
// UNSUPPORTED_CALENDAR (card-side, opened calendar differs from the
// resolved primary id, BEFORE any engine run, 20.3) -- the card must
// never render silence for exactly the events users most wonder about
buildUnresolvedEventDiagnostics(eventId, reason) -> EventDiagnostics

// Triggers
ensureTriggers() -> TriggerHealth
// Card action: bounded work only -- under the user lock it REPLACES the
// settings document with the disabled tombstone (the 5.2 defaults with
// enabled=false, destroying origin addresses -- REQ-PRIV-006), removes
// triggers, initializes progress, and enqueues the cleanup worker; the
// unbounded scan-and-delete lives in the worker (19.4)
removeAutomation() -> ActionResponse
// Budget-bounded cleanup passes: pages and deletes interleaved (fetch a
// page, delete it, re-fetch -- deletions shrink the set, so retries
// resume with no persisted cursor), persists progress in
// CleanupProgress (dtp.removalProgress, written ONLY under the user
// lock: deletions cumulative; failedDeletes per-pass OUTSTANDING --
// counted fresh in memory, never zeroed at pass start, and REPLACED
// only by a complete walk, so a retried deletion clears the failure it
// supersedes while truncated or dying passes leave the previous count
// visible) plus the LOCKLESS RemovalHeartbeat side key
// (dtp.removalHeartbeat: `at` stamped at worker ENTRY before the lock
// wait, contentionRetries incremented on contention re-enqueues, both
// reset by a lock-winning pass -- kept off the record so no lockless
// read-modify-write can clobber a fold or revert a terminal; the
// card's liveness test reads the freshest stamp against
// REMOVAL_STALE_AFTER_MS; the retries count only LABELS a
// staleness-derived failure as contention, never overrides a fresh
// stamp), re-enqueues until the scan completes (capped at
// MAX_REMOVAL_PASSES; contention retries bounded separately). NEVER
// writes the settings document: the card action wrote
// the disabled tombstone under its lock before the worker existed, so
// REQ-PRIV-006 holds on every outcome including a worker that never
// wins the lock again (19.4)
runRemovalCleanup(e) -> CleanupProgress
// Manual sync enqueues -- card callbacks cannot fit a full reconcile
// (technical design 19.5; one-off trigger, subject to Spike 1). The
// pending-check-and-create is serialized under the user lock; handlers
// delete every pending trigger for their handler on entry, collapsing
// duplicates that slip through while a run holds the lock
onSynchronizeNow(e) -> ActionResponse
runManualReconciliation(e) -> ReconciliationResult
// Partial-run continuation worker (19.6). The counter is incremented by
// the ENGINE under the user lock (a handler-side increment races the
// reset a concurrent successful run performs); skipped runs never reach
// the counter, so no refund path exists -- the handler just re-enqueues.
// Reset by any successful non-dry run; cap enforced at enqueue time; the
// enqueue return value is how diagnostics.continuationCapReached (4.11)
// reaches the run result. BOTH call sites guard it -- trigger creation
// can throw (per-user quota): the engine's partial-run call keeps the
// truthful applied result and records a CONTINUATION_ENQUEUE_FAILED
// warning, never a false failure record; the handler's skip-path
// re-enqueue logs the same code (log-only -- skipped results are never
// persisted or rendered, so a warning on one reaches nobody). Deferred
// work falls to the daily backstop (19.6)
enqueueContinuation() -> { scheduled: boolean, capReached: boolean }
incrementContinuationCount() / resetContinuationCount()
runContinuationReconciliation(e) -> ReconciliationResult
```
