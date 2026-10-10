# Technical Design Interface Reference

This file collects the principal function contracts from the technical design.

`compareDesiredAndObserved` takes planning outcomes as well as specs: it may only delete generated events whose parent planned successfully or was ruled ineligible (§17.4), or whose parent is absent from a **complete** scan (§15.2.3) — and never a concluded record (§15.2.9: ended before the run's injected `now`, undisplaced from its persisted anchor). On matched branches a concluded record splits on **anchor equality**, a route-free test, read together with the spec's **`pinned` flag** (§4.8): the desired spec's source anchor equals the record's persisted anchor **and** the spec is pinned — the provider pins exactly when the role is not provably live (`endedSpanRouteFree` answered `ended` or `band`) — → same occurrence → `unchanged` (a past block is never updated, replaced, or metadata-patched, and routing is short-circuited for the role); anchors equal but the spec **unpinned** → the role is provably live (a just-ended meeting's return block dragged into the past), and the ordinary branches apply, whose update restores the block (REQ-GEN-014); anchors differ → the record matches nothing: the key falls through to the create branch when the desired span still lies ahead — and when the desired span has already ended with no same-anchor companion observed, the provider emits no spec at all (§12.5's ended rule), so the comparator sees only different-anchor or anchorless companions of that role, stale and deleted subject to the lenient record test (a same-anchor non-record companion is observed by the provider too, which then emits the spec that restores it — save a zero total whose empty span has ended, recorded `ended` with that undisplaced live block in hand: the comparator then applies §12.5's **shared rule** for an `ended` role exactly as the §15.2.3 and §15.2.10 passes do when pagination splits the block off — the parent's undisplaced same-anchor block is kept, every other companion of the role deleted — so co-observation cannot change the block's fate) — the record staying as history either way. The concluded tests are why the comparator takes `now`.

Write operations take the observed event rather than an event ID, so the ownership marker and version can be verified at write time rather than trusted from read time (§16.5.1).

```javascript
// Settings
// Never throws on validation problems: the engine branches on the tiers
// (structurallyValid gates every run, writeReady gates writes -- 5.3).
// Never throws on a corrupt document either: malformed stored JSON and
// unmigratable schemas both come back as structural INVALID_SETTINGS
// errors (5.4); an absent document loads the 5.2 defaults. Order: parse,
// migrate, merge, normalize origins, validate (5.5): the merge fills only
// ABSENT defaultable keys -- a missing or corrupt required field (enabled,
// windowDays, eligibility.*, origins.default, workingLocation.enabled --
// a defaulted smaller window would trigger 7.6's shrink) is reported,
// never healed; whitespace-only origins.*.value becomes ''
loadSettings() -> { settings: UserSettings, validation: ValidationResult }
// Same origin normalization (5.5), then validation; NEVER throws on a
// validation problem. Persists only a structurally valid document:
// settings is the normalized document as stored (writeReady may still be
// false -- a blank default origin is structurally valid and IS
// persisted, 5.3), null when nothing was written; validation is the 5.3
// result whose errors the settings card renders (REQ-UI-011)
saveSettings(settings) -> { settings: UserSettings | null, validation: ValidationResult }
validateSettings(settings) -> ValidationResult

// Directives
// description may be HTML (the Calendar web UI stores it so): parsed over
// its plain text (6); malformed prefixed lines warn, never fail (6.4);
// total -- never throws
parseDirectives(description) -> ParsedDirectives
// Plain text for the grammar (6): CRLF/CR to LF; <br> and block tags to
// LF; other tags removed; entities decoded once, after (a numeric one
// only when a Unicode scalar value, 1..0x10FFFF minus surrogates, else
// left as written -- total, never throws); U+00A0 to space.
// A tag is 6's shape only (listed name, one line); other '<...>' is text.
// Private helper (TD 2): called only by parseDirectives
descriptionToText_(description) -> string

// Calendar
// ORDERED upcoming-first across pages (7.2.1, 23.2): a forward segment
// [pivot, observeEnd) is listed first, then a backward one
// [observeStart, pivot), each orderBy startTime -- so a truncated
// prefix holds the imminent appointments, not Calendar's unspecified
// default page order; pivot is the chain's pinned `now`. The two
// queries overlap on pivot-spanning events (timeMin filters END,
// timeMax START), so results are partitioned by ownership -- end
// after pivot belongs to the forward segment, backward pages are
// filtered to end <= pivot, the end read with the normalizer's
// parse-or-null (8.1) -- and whatever the rule cannot place (no or
// unparseable end, all-day date-only ends) is kept where returned and
// deduplicated by id within the listing: every timed event is listed
// once, the rest harmlessly at most once per slice.
// Deadline-aware: checks shouldStop between pages and returns the
// retrieved prefix with scanComplete false when it fires -- truncation
// is a first-class state downstream (7.2.1). RESUMABLE: nextPageToken is
// an OPAQUE resume token (segment + Calendar page token, the segment
// boundary itself a resumable point) the engine persists unread,
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
listWindowEvents(calendarId, observeStart, observeEnd, pivot,
                 shouldStop, resumeToken)
  -> { events: RawCalendarEvent[], scanComplete: boolean,
       nextPageToken: string | null, resumed: boolean }
// resumed reports whether the resumeToken was HONORED: false ONLY
// when none was given or the token was ATTEMPTED and rejected, falling
// back to the SAME requested range from page one -- the discriminator
// the engine's offered-cursor semantics and eager dead-token clear
// read. A token never attempted (shouldStop already true at entry,
// zero pages fetched) is NOT a rejection: the call returns resumed
// true with the untouched token as nextPageToken, or the eager clear
// would delete a live chain cursor on a starved run; the engine then
// writes no cursor at all, leaving the stored token and its holds
// count as they were (7.2.1). Nor is a
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
// timeZone is the events.list response's top-level calendar zone, which
// places all-day working locations (7.5, 10.3); null when omitted
listWorkingLocationEvents(calendarId, start, end)
  -> { events: RawCalendarEvent[], timeZone: string | null }
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
// Every write against an observed event is CONDITIONAL (16.5.1):
// If-Match on the observed ETag, or -- where the runtime cannot send
// it -- an immediate marker re-read before the write. A 412 proves
// only that the event changed, so the repository re-reads and splits:
// marker gone -> OWNERSHIP_LOST (apply failure, not retried -- the
// event is the user's now); marker intact -> CONCURRENT_EDIT (apply
// failure, retryable -- stale snapshot, re-planned next run). A
// pre-write re-read answering "marker gone" is OWNERSHIP_LOST; "no
// event" (404 or cancelled tombstone) is the user's DELETION, never
// ownership loss -- an ordinary CALENDAR_WRITE_FAILED that the next
// run, no longer observing the block, converges past; any re-read
// that THROWS is CALENDAR_READ_FAILED.
// Either outcome on the
// delete half of a replace aborts the replace. An unconditional update
// or patch would re-stamp managed metadata onto an event the user just
// un-managed (private-metadata ADR)
updateGeneratedEvent(observed, spec) -> RawCalendarEvent
patchGeneratedEventMetadata(observed, privateProperties) -> RawCalendarEvent
deleteGeneratedEvent(observed) -> void

// Normalization and eligibility
normalizeCalendarEvent(rawEvent) -> NormalizedEvent
// Raw generated resources must be flattened before indexing or comparison;
// the comparator and cache lookup consume this shape, not raw Calendar JSON.
// routeSecs: numeric only when the raw string is non-empty and entirely
// numeric; everything else maps to null, never 0 (technical design 13.3).
// updatedMs: Calendar's `updated` via parseInstantOrNull, null when
// absent or unparseable -- the 13.5 "most recently updated" key (4.9).
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
// The ONE instant parser (8.1): every instant string the add-on reads
// -- raw Calendar timestamps, cursor instants, the high-water mark,
// route-cache stamps, anchors -- goes through it, so a malformed value
// degrades to null identically everywhere and no second parser can
// throw; the normalizer runs it once and stores startMs/endMs (4.3)
parseInstantOrNull(iso) -> number | null   // epoch ms, the *Ms unit
// The one statement of 8.2's rule -- non-cancelled, NOT all-day (9.2
// step 4 rejects all-day events on isAllDay alone), a null start or
// end instant -- applied by the planning loop (a retryable
// CALENDAR_EVENT_INVALID failed outcome, companions preserved) and by
// the 15.2.3 live-parent evaluation (candidate preserved this run)
hasUnreadableTimestamps(event) -> boolean
// The title pattern compiled ONCE per run by the engine after
// validateSettings passed it (9.3) -- { test(summary) -> boolean },
// null when disabled. A bound-free regex test with ONE caller, 9.2
// step 11, which checks the subject bound first (summary.length over
// MAX_TITLE_PATTERN_SUBJECT_CHARS is TITLE_TOO_LONG, never truncated --
// a cut manufactures anchors); the bound has one owner, not two
compileTitleMatcher(settings) -> TitleMatcher | null
// titleMatcher from compileTitleMatcher: evaluation never compiles and
// never meets an unvalidated pattern (9.1). Enabledness is the SETTING,
// never the matcher's nullness: titlePatternEnabled && !titleMatcher is
// a programming error that THROWS -- into the planning loop's
// per-event containment or 15.2.3's per-candidate one -- not a
// disabled pattern (which would delete the pattern's companions)
evaluateEligibility(event, directives, settings, window, titleMatcher)
  -> EligibilityResult
// The 4.5 EligibilityReason enum as DATA, verbatim and in order; the
// card renders exhaustively over it
ELIGIBILITY_REASONS: readonly string[]
// The explicit, short list of planning-failure codes that double as
// reasons; the 17.1 synthesis passes a failed outcome's code through
// iff it is here, every other code clamping to UNEXPECTED_ERROR (a
// registry code sharing a reason's name must not borrow its meaning)
SYNTHESIS_REASONS: readonly string[]  // EXECUTION_BUDGET_EXCEEDED, CALENDAR_EVENT_INVALID
// null when every fallback bottoms out at a blank default (10.4): the
// engine records a per-event failed outcome (MISSING_DEFAULT_ORIGIN)
// instead of routing -- reachable only on dry runs, since writeReady
// gates write mode on a configured default
// workingLocations: WorkingLocationSpan[] from fetchWorkingLocationsSafely
// (10.3); the overlap compares their instants with the source's
resolveOrigin(event, directives, settings, workingLocations)
  -> ResolvedOrigin | null
// An honored `origin=default` directive resolves with source "directive",
// name "default"; source "default" is the priority-3 fallback only (10.2)
// Wraps listWorkingLocationEvents: a read failure records
// WORKING_LOCATION_UNAVAILABLE (18.2) and returns [], so origin resolution
// degrades to the default origin instead of failing the run (7.5).
// Places each event with workingLocationSpan_ and drops unplaceable ones
fetchWorkingLocationsSafely(start, end) -> WorkingLocationSpan[]
// WorkingLocationSpan = { event: RawCalendarEvent, startMs, endMs }.
// Timed: parseInstantOrNull of the dateTimes (8.1). All-day: 00:00 on
// start.date to 00:00 on end.date as wall-clock times in
// calendarTimeZone -- never the nominal UTC-midnight instants (a gap
// midnight resolves to the first instant after it); null when an
// instant is unreadable or an all-day event has no usable zone (10.3).
// Private helper (TD 2): called only by fetchWorkingLocationsSafely
workingLocationSpan_(rawEvent, calendarTimeZone)
  -> { startMs: number, endMs: number } | null

// Routing and provider
// requestContext carries { role, cacheEntry, now, budget, correlationId };
// cacheEntry is null when the role has no observed companion (12.1).
// correlationId is the run's ID (17.2), sent as X-Request-ID on every
// attempt and stamped on every AppErrorRecord the client raises (21.1);
// the client consults the cache before the network and reports provenance as
// result.source ('durable' | 'ephemeral' | 'broker') -- anything other than
// 'durable' needs persisting (11.1). budget.remaining is decremented per
// HTTP attempt, retries included (11.2). First, before any tier: a
// from/to value over MAX_ROUTE_ENDPOINT_VALUE_CHARS UTF-16 code units
// (trimmed) throws INVALID_ORIGIN / INVALID_DESTINATION -- no attempt,
// not memoized, not negative-cached, not productive (11.1 step 0).
// Both INVALID_* codes, step 0's and the broker's, name the endpoint
// ROLE, not the wire field (11.5): INVALID_DESTINATION is the event
// location, INVALID_ORIGIN the effective origin, so on a return route
// (from = location) the broker's wire codes are swapped.
// Then, by route input hash: durable entry; the failure memo budget.failedRoutes (a hit rethrows
// the memoized NO_ROUTE / INVALID_ORIGIN / INVALID_DESTINATION, no
// attempt spent), seeded on the client's first lookup of the run from
// the persisted negative cache dtp.routeFailureCache (unexpired
// entries, ROUTE_FAILURE_CACHE_TTL_HOURS); the ephemeral tier; the
// broker. The client is the ONLY reader and writer of the ephemeral
// tier and of the negative cache: it puts { secs, at } for
// EPHEMERAL_ROUTE_CACHE_TTL_SECONDS after EVERY broker success
// (best-effort, 20.3), and records a deterministic failure in the memo
// AND writes it through to the negative cache (best-effort, bounded at
// ROUTE_FAILURE_CACHE_MAX_ENTRIES, hash -> code only) before throwing
// it -- so instances of one recurring series cost one attempt per run,
// and a known failure none until it expires; a fixed location changes
// the hash and misses the cache. Transient and deployment-level
// failures enter neither tier. Increments budget.productive for every
// attempt that returned a route or a newly recorded deterministic
// failure (the engine copies it to routeAttemptsProductive, 4.11).
// Before EVERY attempt, first or retry, compares Date.now() with
// budget.attemptDeadlineMs (11.2): past it, starts nothing and throws
// EXECUTION_BUDGET_EXCEEDED (nothing spent, memoized, or productive) --
// UrlFetchApp has no per-call timeout, so admission is the only bound.
// The result carries the whole cache triplet on every source (4.7):
// routeHash (expectedHash), durationSeconds, calculatedAt -- a broker
// result's calculatedAt is requestContext.now.toISOString(), the run's
// injected clock, never a wall-clock read, so the run's own later
// reads validate it (ageMs >= 0) and tests are deterministic
getRouteDuration(from, to, requestContext) -> RouteResult
// The ONE mapping from a RouteResult to the stored cache triplet (4.7):
// { routeHash, routeSecs: String(durationSeconds), routeAt:
// calculatedAt }. The provider merges it into the privateProperties of
// every spec it emits for a routed role -- a copy, never a staleness
// decision (12.1.1); creates, updates and metadata patches all write
// these values (15.2.2, 16.1, 16.6)
routeCacheProperties(routeResult)
  -> { routeHash: string, routeSecs: string, routeAt: string }
// context carries the RESOLVED observed companions per role
// (context.observedCompanions, 12.1.1): the provider applies the
// 15.2.9 freeze (strictly concluded record + anchor equality + a role
// NOT provably live, endedSpanRouteFree answering "ended" or "band" ->
// unchanged, routing short-circuited) BEFORE routing -- a frozen role
// emits a spec flagged pinned: true (4.8, the comparator's freeze
// signal) carrying the 14.1 anchor and the record's observed fields
// verbatim, no route resolved and the role omitted from
// outcome.routes (fields never consulted: anchor equality on a pinned
// spec classifies unchanged first; the spec exists so the key stays
// desired). A same-anchor record of a provably LIVE role (a just-ended
// meeting's return block dragged into the past) is not frozen: the
// role is routed and its UNPINNED spec restores the block. Emits NO
// spec for a role whose computed span has already ended (12.5's ended
// rule -- outbound decided route-free; return route-free too past
// source.end + MAX_TRAVEL_MINUTES + buffer, routed only inside the
// band -- endedSpanRouteFree below) nor for a zeroed one, recording
// each non-emission on outcome.suppressed with its reason (a zero
// total whose empty span has ended is "ended", never "zero"). Every
// spec emitted unpinned while the answer was "band" carries inBand:
// true (4.8), read by the 15.2.7 lookup -- and still passes
// the cache TRIPLETS through to the routing client uninspected --
// staleness policy stays in one place (13.3). ROUTING FAILURES ARE
// RETURNED (12.1.2): a getRouteDuration throw carrying a registry code
// (registryCodeOf non-null -- INVALID_*, NO_ROUTE, BROKER_*,
// ROUTE_BUDGET_EXCEEDED, the attempt-deadline EXECUTION_BUDGET_EXCEEDED)
// is caught and returned as { state: "failed", specs: [], routes
// resolved before it, error: the thrown record, sourceEventId set },
// planning of the source stopping there; only an uncoded throw
// propagates (the engine's containment, UNEXPECTED_ERROR). Every
// emitted unpinned spec's start/end use 12.5's canonical serialization:
// RFC 3339, whole seconds, the anchor boundary's own offset
getGeneratedEventSpecs(context) -> PlanningOutcome

// Context construction -- observed companions must be indexed before planning
// so their route caches, observed fields, and anchors (the latter two
// for the 15.2.9 freeze) are reachable (technical design 12.1.1). The
// index keeps EVERY companion of a key -- a collision is never
// collapsed here, because the per-role choice needs the source's
// anchors, which only companionsFor below has
indexByGeneratedKey(observedEvents) -> Map<string, ObservedGeneratedEvent[]>
// Assembles the DrivetimeContext (12.1) from NAMED fields -- never a
// positional list, which a new field would silently shift -- and
// attaches the routing client
buildProviderContext(fields) -> DrivetimeContext
// The ONE shape of a failed planning outcome (17.4) -- { state:
// "failed", specs: [], error: buildAppError(code, event, details) } --
// used by every ENGINE site that records one (unreadable timestamps,
// missing default origin, the per-event catch, the planning-tier
// cut-off; the provider's returned routing failure keeps the client's
// own record and its routes instead, 12.1.2);
// details is the optional offending-value bag (the unreadable
// start/end strings for CALENDAR_EVENT_INVALID) -> AppErrorRecord.details
failedOutcome(code, event, details) -> PlanningOutcome
// The resolved companions themselves, not just their cache triplets --
// a triplet-only context could not recognize a concluded record
// (12.1.1, 15.2.9). Per role, in order: a same-anchor companion --
// persisted anchor equal to the role's 14.1 source anchor AS AN
// INSTANT -- ranked (co-observed copies of one trip exist by design,
// 15.2.9) undisplaced concluded record, then undisplaced live copy,
// then displaced copy, ties (here and in the fallback below) to the
// greatest updatedMs (null lowest), then the smallest id -- 13.5's
// selection without its fingerprint rule, so the provider freezes the
// record the pinned-spec comparator and 15.2.7 rule (2) keep, and a
// displaced copy never hides the record; whatever its state, the
// same-anchor pick is the trip's own block, the one 12.5's
// ended rule and the freeze ask about (a different-anchor pick would
// hide the block the spec exists to restore); with no same-anchor
// companion, a LIVE
// non-concluded one over a concluded record (the ~40h post-reschedule
// overlap 15.2.9 creates by design -- the live block owns the key's
// cache, and a record shadowing it would re-call the broker every run,
// route-plan-cache ADR, REQ-PERF-015); a record only when nothing else carries the
// key. Liveness is judged with the injected run clock `now`, the same
// one the provider and comparator use
companionsFor(observedByKey, event, now)
  -> { outbound: ObservedGeneratedEvent|null,
       return: ObservedGeneratedEvent|null }

// Route plan cache (derived state, stored on generated events)
// Endpoints are { type, value } in BOTH directions; the return route swaps
// them, so a typed-origin/string-destination signature breaks (13.3)
routeInputHash(fromEndpoint, toEndpoint, travelMode) -> string
// metadata is the normalized RouteCacheEntry OR null (no companion,
// 12.1): null answers false before any field is read (13.3)
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
// The load returns null ONLY for a positively absent or malformed mark;
// a Properties READ FAILURE throws (run-wide: nothing applied, no
// reconciliation state written -- only the boundary's failed last-run
// record, 17.2 -- and the next run retries) -- never null, or the
// advance branch would
// overwrite a wider stored horizon and strand the vacated range. The
// CONSUMER hardens the value: an absent or unparseable stored mark
// (parseInstantOrNull -> null, 8.1) takes the advance branch, which
// overwrites the corrupt key with a valid mark (7.6)
loadHighWater() / saveHighWater(observeEnd)                           // 7.6

// The ONE desired-role derivation (12.5, 15.2.3): a pure function of an
// ALREADY-COMPUTED EligibilityResult (overlap and 9.2 eligibility are
// evaluated once, by the caller) -- which roles the source WANTS,
// nothing about time of day. Both roles for every eligible source
// today (the 6 grammar has no per-role directive); the one place such
// a directive would land. The engine computes it and passes it as
// DrivetimeContext.desiredRoles; the 15.2.3 evaluation computes it for
// a fetched parent, so the two can never disagree about the role set
routeFreeDesiredRoles(eligibility)
  -> { outbound: boolean, return: boolean }
// The directive override or the settings default (12.2) -- the one
// place the effective buffer is derived; the planning loop and
// endedSpanRouteFree both call it
effectiveBufferMinutes(directives, settings) -> number
// The time test of the 12.5 ended rule, shared by the provider and the
// 15.2.3 evaluation: outbound "ended" iff source.start < now; return
// "live" when source.end + buffer >= now, "ended" when source.end +
// MAX_TRAVEL_MINUTES + buffer < now, "band" between (route needed) --
// minutes converted to the implementation's time unit; buffer from
// effectiveBufferMinutes
endedSpanRouteFree(event, directives, settings, role, now)
  -> "live" | "ended" | "band"

// Comparison helpers
// Takes the ObservedGeneratedEvent -- NOT its fields bag -- and reads
// observed.observedFields against the spec's owned fields (15.2.1),
// the same first-argument shape as every other observed-side helper.
// start and end compare as INSTANTS: both sides through
// parseInstantOrNull (8.1), equal milliseconds match, an unparseable
// observed time never does -- never as strings, since Calendar
// re-serializes dateTime in its own zone while the spec carries the
// anchor's offset (12.5), and a string test would update every block
// on every run
ownedFieldsMatch(observed, desiredSpec) -> boolean
// The 15.2.9 concluded-record test: observed end before `now`, the
// persisted ANCHOR instant itself before `now` (a future meeting's
// block dragged into the past is live state, not a record), AND
// observed times within the anchor's companion span (undisplaced, the
// 15.2.8 moved-test). PARENT-LESS -- companion and clock only, as the
// deletion paths need -- so not by itself the write-side freeze, which
// additionally requires the role NOT to be provably live
// (endedSpanRouteFree anything but "live"; a just-ended meeting's
// return block has a past anchor and a live span, and dragged into the
// past it is a record here yet restored by the comparator, the
// provider having emitted its spec UNPINNED). The STRICT test -- a
// valid anchor is required;
// the deletion paths additionally preserve an ended ANCHORLESS
// companion conservatively (a stray that persists beats erased
// history), while the write-side rules (matched-branch anchor-equality
// freeze on a pinned spec, 15.2.7 record classification) use the
// strict test, never the lenient one, so an
// anchorless match follows the DESIRED span: a live desired span emits
// the spec and the update restores it (however far into the past it
// was dragged); an ended desired span with no undisplaced same-anchor
// block emits none, and an ended anchorless block is simply left as
// it is. Anchor
// equality compares INSTANTS, never strings (15.2.9). Shared
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
// freshRoute: planningOutcomes.get(desired.parentEventId).routes entry
// for desired.role (17.4). true when freshRoute.source !== 'durable'
// (11.1) OR observed.routeCache differs from the triplet in
// desired.privateProperties (a duplicate set's canonical companion need
// not be the one the durable entry was read from) -- compared on the
// STORED STRINGS (13.2, 15.2.2): it matches iff no observed member is
// null, routeHash and routeAt are ===, and
// String(observed.routeCache.routeSecs) === desired routeSecs (the
// parsed number re-serialized as routeCacheProperties does), never the
// number against the string; false when
// freshRoute is absent (a pinned spec routed nothing). The patch copies
// the three keys from desired.privateProperties (15.2.2)
routeCacheNeedsPersisting(observed, desired, freshRoute) -> boolean
// Upcoming first, then in-progress and lookback -- API response order would
// spend the route budget on the past (23.2); called before the planning loop
orderForPlanning(normalizedEvents, now) -> NormalizedEvent[]
// Overlong-source cleanup gate (technical design 15.2.6): duration-keyed,
// reason-agnostic; fires when either companion role is unobserved AND
// the source is not known clean at its current version; an
// all-day source with unreadable dates (null instants, 8.1) counts as
// exceeding -- one conservative point read
sourceExceedsDurationCap(event) -> boolean
bothRolesObserved(observedByKey, parentEventId) -> boolean  // non-empty list per role
// True when the clean list (loadOverlongLookupClean) pairs event.id with
// an etag equal to event.rawEtag -- an earlier lookup at this version
// returned nothing but preserved records, and no companion is generated
// for an overlong (always ineligible) source, so the lookup would find
// nothing new. False when event.rawEtag is null. Without it every
// multi-day all-day event (PTO, a conference) would cost one lookup per
// run for its whole stay in range (15.2.6)
overlongLookupKnownClean(cleanEntries, event) -> boolean

// Fingerprint and comparison
fingerprintSpec(input) -> string
// Several observed copies of a desired key converge to the canonical
// one (13.5) -- except under a PINNED spec, where the freeze decides:
// ONE same-anchor concluded record -- the one 13.5's selection keeps
// among them (updatedMs, then id; the record companionsFor gave the
// provider) -- is unchanged, and every other copy is a duplicate
// DELETED, never updated to the pinned spec's copied fields: further
// same-anchor records (redundant copies of the same trip -- redundancy
// is not record), displaced, live, different-anchor, anchorless.
// Preserved records are excepted, except a redundant same-anchor copy
// of the kept record. The same outcome as 15.2.7 rule (2) on another
// slice (15.2)
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
// unplanned work. STATUS (17.5, the ONE rule, closed and complete):
// partial when ANY holds -- diff.diagnostics.scanComplete false (every
// cursor-offered run included), diff.diagnostics.suppressedCreates or
// suppressedDeletes > 0, a failed write, a deferred op, an application
// skipped for time (applied null), or a retryable failed outcome --
// EVEN WHEN NOTHING WAS ACCEPTED (failed is only for
// buildFailureResult's results) -- else success. Also derives
// result.summary (17.2, REQ-OBS-002) -- the source/eligible/planned/
// ignored/failed counts -- from the same outcomes before they are
// dropped, the one path by which those counts reach saveRunStatus and
// the 20.2 record -- and, from the same outcomes,
// diagnostics.continuableFailures (4.11): the failed outcomes whose
// error is continuable (18.2), the one carrier by which they reach
// continuationStillUseful (23.4 cause 5). Like every builder, sets result.reason from
// options.reason, result.correlationId from the run's ID,
// result.startedAt from the run-scoped start instant
// beginRunCorrelation holds, and result.completedAt from the clock now;
// validationErrors null
buildRunResult(diff, applied, planningOutcomes, options, eventDiagnostics)
  -> ReconciliationResult
// Failed result for two kinds of exit, told apart by the THIRD
// argument, never by the first argument's shape. (1) Top-level error
// boundary and contract rejection: buildFailureResult(error, options)
// -- a run-wide throw (window read, unexpected) becomes one
// AppErrorRecord, registryCodeOf(error) || UNEXPECTED_ERROR, and
// reaches the stored record (arch 14.2); validationErrors null.
// (2) Settings gates: buildFailureResult(null, options, validation)
// with the 5.3 ValidationResult -- errors = [one INVALID_SETTINGS
// record], validationErrors = validation.errors verbatim (the
// structural list, or the write-readiness gate's single
// MISSING_DEFAULT_ORIGIN entry, 5.3, 17.2). Both: diff empty, applied
// null, result.reason = options.reason (null when absent), summary
// null; startedAt/correlationId from the run-scoped holder,
// completedAt now
buildFailureResult(error, options, validation) -> ReconciliationResult
// Complete ReconciliationResult for skipped/disabled outcomes -- bare
// status objects would make callers special-case those states (17.2).
// result.reason = options.reason (null when absent): the run's reason,
// the only reason the 20.2 record stores; summary null, validationErrors
// null; startedAt/correlationId from the run-scoped holder, completedAt
// now
buildStatusOnlyResult(status, options) -> ReconciliationResult
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
// suppressed-role lookups last of all: their chronic population never
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
// Every marked outcome is built through failedOutcome(
// "EXECUTION_BUDGET_EXCEEDED", event) -- failed outcomes MUST have
// error populated (17.4): the buildRunResult fold and the 17.1
// scoped-diagnostic synthesis both read it
markRemainingSourcesFailed(orderedSources, currentEvent, planningOutcomes) -> void
// Resets the run-scoped warning buffer. The engine's FIRST statement,
// before even the lock attempt -- every result builder (the
// lock-contention skip included) installs the buffer by reference as
// diagnostics.warnings, and pre-comparator warning sites (daily counter
// reset, cursor persistence, working-location fetch) append to it
beginRunWarnings() -> void
// Creates the run's opaque correlation ID (Utilities.getUuid(),
// REQ-OBS-004) and holds it run-scoped, as beginRunWarnings holds the
// warning buffer, together with the run's START INSTANT (wall clock,
// ISO 8601 UTC, read once here -- never options.now). Called right
// after beginRunWarnings, before the lock attempt, so every result
// builder -- the lock-contention skip included -- copies them into
// result.correlationId and result.startedAt (17.2); the engine passes
// the returned value into every DrivetimeContext, the routing client
// sends it as X-Request-ID, and the 20.2 record stores it (17.2)
beginRunCorrelation() -> string
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
// message, retryable and continuable from the registry entry (18.1,
// 18.2), sourceEventId from the event, details copied verbatim when
// given -- no per-code special casing. Used by the engine's per-event
// failure paths, e.g. the MISSING_DEFAULT_ORIGIN outcome (10.4)
buildAppError(code, event, details) -> AppErrorRecord
// The ONE place a code's attributes live (18.1, 18.2); buildAppError
// copies all three; buildRunResult counts continuable off failed
// planning outcomes into diagnostics.continuableFailures (23.4). Total:
// the 18.2 table gives both flags for every code. retryable (does a
// failed planning outcome block success) is true for every code that
// leaves a source unprocessed -- every code 11.5 maps a broker
// response to included; 11.5's last column is the immediate HTTP
// retry only, never this flag
registryEntry(code) -> { message: string, retryable: boolean, continuable: boolean }
// Recognizes a throw that already carries an 18.2 registry code (a
// repository read surfacing CALENDAR_READ_FAILED, say), so the
// per-event planning containment preserves the registry's
// transient-vs-permanent classification and retryability instead of
// blanket UNEXPECTED_ERROR; null for unrecognized throws (arch 14.2)
registryCodeOf(error) -> string | null
// Engine post-pass on the diff: one unbounded parent lookup per pending
// create; cancelled tombstones among the returns are passed over, and
// a PROVABLY concluded record is classified as the comparator would
// classify it co-observed (15.2.7, 15.2.9): a DIFFERENT-anchor record
// is passed over (restoring a past trip's record to a rescheduled
// occurrence would rewrite history; the create proceeds); a
// SAME-anchor record is restored when the spec is unflagged (the role
// is provably live) and FROZEN when the spec carries inBand (4.8 --
// not provably live): the create is withdrawn, no write, not counted
// as suppressed, the record stays. An anchorless match restores while
// the desired span is live, rewriting its metadata; an ended desired
// span emits no spec for it, nor for a DISPLACED same-anchor block,
// which the orphan path deletes. SEVERAL same-key matches resolve as
// 13.5's convergence would co-observed: different-anchor records
// excluded first; an inBand spec with a same-anchor record left
// freezes (create withdrawn, ONE same-anchor record -- 13.5's canonical
// pick among them -- stays; further same-anchor records are redundant
// copies of that trip); otherwise exactly ONE match -- 13.5's canonical
// selection: matching fingerprint, then greatest updatedMs (4.9; null
// lowest), then smallest id -- is restored. Under either branch every
// match not kept (under the freeze, every match but the kept record)
// is a duplicate that joins diff.deletes, deduplicated by id, preserved
// records excepted -- but not a redundant same-anchor copy of the kept
// record, which 13.5 deletes (planned-parent authority); a create is resolved whole or suppressed
// whole. The record tests read `now` -- the run's injected clock, never
// a wall-clock read, so this pass classifies a record exactly as the
// comparator and provider do -- which is why the signature carries it
// (APPENDED, so a caller of the old order cannot shift dryRun or
// shouldStop). The restored match
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
resolveOutOfWindowCompanions(diff, cleanup, dryRun, shouldStop,
                             now) -> void
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
// leaves the record sharing the key with the new block by design).
// SATISFIED = held by an in-window event the comparator matches to
// the key's desired spec, never by a concluded record whose anchor
// differs (as an instant) from that spec's: it matches nothing
// (15.2.9), the key's create is pending, and 15.2.7 may be restoring
// this very candidate. The ENGINE then drops from sweep.events every
// id a restoration targets (the observed side of an update or replace
// in the diff -- the sweep runs after 15.2.7) before deduping against
// diff.deletes and before the watermark's deletedAll check: deletes
// apply first, so a colliding delete would destroy the restored
// event; a
// suppressed role's stray is the 15.2.10 lookup's, which reaches it
// through an unbounded per-parent read no watermark gates, on this
// run or its continuation, so the sweep states no second rule for it;
// failed preserves --
// restoration is create-driven and cannot reach a stray whose parent no
// longer plans. Candidate selection skips keyless listing returns
// (unrecoverable parent, 8.1) like anchorless ones -- no parent to
// point-read; the null-id read could throw, deterministically failing
// every sweep over the same event. Runs only on a COMPLETE window
// scan; takes the full
// observed list (observedAll -- keyless corrupt events included, 8.1),
// never the key index: the id test must not read a window-observed
// keyless event, whose deletion the engine already queued, as absent
// from the window -- and the run's injected `now`
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
// the desired role set): no desired companion for the key ->
// delete, whatever page the parent sat on (a stale companion split
// from its live source by pagination must not survive on liveness
// alone); key desired but its desired span ENDED (endedSpanRouteFree
// answers "ended" -- the time test shared with the provider, 12.5) ->
// 12.5's SHARED RULE, since the parent's slice emits no spec and no
// 15.2.7 restoration will come: the parent's UNDISPLACED same-anchor
// block is kept (a record, or about to become one), every other
// companion of the role -- a displaced same-anchor block included -- is
// stale and deleted, the lenient record test excepted; key desired and
// still live, or in the return band -> preserve this run, the parent's
// own slice owns it (through the 15.2.7 lookup if it emits a spec,
// through the 15.2.10 lookup if it records the role ended); a PRESERVED record
// (15.2.9's deletion-side test: concluded, or ended with an unusable
// anchor) is spared without a read, which is why the signature carries
// `now`; a read the guard cut
// off preserves the candidate and counts in suppressedDeletes
resolveUnmatchedCompanions(diff, planningOutcomes, window, settings,
                           now, shouldStop, titleMatcher) -> void
// titleMatcher is APPENDED, not inserted: a positional insertion would
// silently shift now and shouldStop for any caller written to the old
// order
// titleMatcher: the run's once-compiled pattern (9.1), handed to the
// live-parent evaluation so it never compiles or meets an unvalidated
// one; each parent is evaluated inside a PER-CANDIDATE containment (a
// throw preserves that candidate and logs UNEXPECTED_ERROR, never
// fails the run); the fetched parent is NORMALIZED first (8.1), and a
// live parent with unreadable timestamps (hasUnreadableTimestamps)
// preserves the candidate this run like a failed parent (17.3)
// Suppressed-role cleanup (15.2.10):
// for every PLANNED outcome, keys whose role the provider recorded on
// PlanningOutcome.suppressed -- reason "zero" OR "ended" (both mean no
// spec, no pending create, no restoration; an unrouted role appears in
// neither list and proves nothing). A "zero" key enters when it has no
// LIVE observed companion (a record-only key stays in -- the comparator
// preserves the record and cannot reach an unobserved stale block
// sharing the key); EVERY "ended" key enters -- the provider's
// emission rule is the test (it records "ended" only with no
// UNDISPLACED same-anchor companion in its context, 12.5), so the pass
// repeats none, and the cost bound rests on 12.5, not on a filter
// here (a rule admitting every ended role would enter every meeting
// that ever ended, a dozen reads a run). WHATEVER the route's
// provenance (a provenance filter would hide suppressed keys from
// their own retry). Keys grouped by parent, ONE listCompanionsByParent
// per PARENT -- the read returns both roles, and the canonical zero
// case zeroes both roles of one parent, so per-key lookups would
// double the reads; matches for
// the suppressed roles join diff.deletes, deduplicated by id, preserved
// records excepted (15.2.9). Planned-parent deletion authority (17.3)
// -- the provider suppressed the role (zeroed by its route, or ended
// with no undisplaced same-anchor companion), so desired state
// provably contains no block for it; the route-free 15.2.3 evaluation
// must preserve through both ambiguities. Matches follow 12.5's shared
// rule: for an "ended" key the parent's UNDISPLACED same-anchor block
// is kept (a record, or about to become one); every other match --
// a displaced same-anchor block included -- is stale. Runs on
// incomplete scans, daily runs, AND continuations; LAST on the
// evidence tier, behind the sweep (23.1). shouldStop checked between
// lookups; keys cut off count in suppressedDeletes while the
// population's cycle is open (below) -- the deadline-starved engine
// branch invokes this same pass with the guard already true (zero
// lookups, every pending key counted while the cycle is open), so no
// second population computation exists to drift (15.2.4, 15.2.10).
// ROTATED PER POPULATION (15.2.10): resumePoints is a list of
// [point, origin] entries (loadSuppressedLookupResume; on a daily run
// the engine passes every entry REOPENED, origin := point). Parents
// are walked in parent-id order, wrapping, starting after the point
// of the first entry whose point is a parent of THIS pass's
// population -- on a chain, one slice's -- or at its lowest parent id
// when none is. CYCLE-BOUNDED: origin is the open cycle's start (a
// parent id, or "" for the front; no member entry reads as "") or
// null once closed; the cycle closes when the walk looks up the last
// parent at or before origin in wrapped sort order ("" : the highest
// parent id), and the walk goes on while the guard allows. Cut-off
// keys count only while the cycle is open after the walk, so a
// chronic population drives at most one cycle of passes a day.
// Returns { resumePoints }, which the engine persists post-apply only
// when nothing was deferred: the input with every entry whose point is
// in this population removed, then -- when at least one lookup
// completed -- [last parent whose lookup completed, origin after the
// pass] prepended; the INPUT list unchanged when the guard cut the
// pass off before any lookup completed (guard true at entry -- the
// deadline-starved branch, or a daily run whose sweep spent the tier).
// Entries of other populations pass through untouched, so one slice's
// pass never moves or clears another slice's entry
resolveSuppressedRoleCompanions(diff, planningOutcomes, observedByKey,
                              now, shouldStop, resumePoints)
  -> { resumePoints: Array<[string, string | null]> }
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
// end -- a fallback always, an honored token only once the drain gate
// releases that final slice), by a fresh COMPLETE non-dry scan,
// and by remove-all (19.4); dry runs never touch it. SAVES are
// APPLICATION-GATED: the decision is computed at listing time
// (pendingCursorWrite) but persisted only after applyDiff ran with
// NOTHING DEFERRED, so a run that throws or times out between listing
// and application -- or defers mid-apply -- never advances past a
// slice whose operations did not land (write failures do not hold the
// save: they retry when the slice is re-read, while a persistent
// rejection would freeze the chain) -- and DRAIN-GATED: an undrained
// slice is held, bounded by progress and MAX_SLICE_HOLDS (sliceDrained
// and shouldHoldSlice below) -- the chain's FINAL slice included: its
// completion clear is the advance past it, so a hold re-saves the
// honored offered cursor at holds + 1 instead of clearing, an
// out-of-time skip leaves it stored, and either way chainFinished is
// false. A fresh complete scan's CLEAR executes at the same
// post-application point but also when application was skipped for
// time -- it is skip-safe, and a moot cursor retained across an
// out-of-time complete scan would capture that run's continuation for
// the stale span -- and the rejected dead
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
// The three instants come back as Dates, rehydrated through
// parseInstantOrNull (8.1): Properties round-trips strings, and a
// string pivot against a Date end coerces to NaN and silently empties
// the backward segment; unparseable or out-of-order instants (anything
// but observeStart < pivot < observeEnd) make the cursor malformed
// `holds` is the drain gate's consecutive-hold count for this cursor
// position (7.2.1): absent loads as 0; present but not a non-negative
// integer makes the cursor malformed
loadWindowScanCursor()
  -> { pageToken, observeStart, observeEnd, pivot, holds } | null
  // pageToken opaque
// Instants are saved as ISO strings (Date#toISOString) -- the one
// on-disk unit the load's parseInstantOrNull rehydration expects; epoch
// numbers would read as malformed on every load and re-scan from page
// one, the spin the cursor exists to prevent
saveWindowScanCursor(cursor) / clearWindowScanCursor()
// The cursor-save drain test (7.2.1): true when application ran and
// deferred nothing, no EXECUTION_BUDGET_EXCEEDED or ROUTE_BUDGET_EXCEEDED
// outcome exists, and no create was withheld for want of its 15.2.7
// lookup. Suppressed absence-gated deletes never hold the cursor
sliceDrained(applied, planningOutcomes, diff) -> boolean
// The BOUNDED hold decision (7.2.1), evaluated post-apply on a run whose
// application ran: true -- keep the cursor on this slice -- only when
// the slice did NOT drain, AND the run made forward progress on it
// (Calendar accepted at least one write, or some planning outcome lists
// a routes[] entry with source "broker"), AND holds < MAX_SLICE_HOLDS,
// AND reason is not "daily-trigger". Deterministic route failures
// (NO_ROUTE, INVALID_*) are not progress, even when newly written to
// the negative cache (11.1), so they never hold the chain; the daily
// run never holds, so each daily cycle
// advances the chain (REQ-TRIGGER-002). holds is the offered cursor's
// count on an honored token, 0 otherwise. A hold re-saves the honored
// cursor with holds + 1; every advance saves the next one at 0. The
// chain's final slice is no exception: held, it re-saves the same
// honored cursor (holds + 1) instead of clearing, and the chain stays
// unfinished (chainFinished false); released, the cursor clears
shouldHoldSlice(applied, planningOutcomes, diff, reason, holds) -> boolean
// 15.2.10 rotation entries: [point, origin] pairs -- point a parent
// id, origin a parent id or "" (cycle open) or null (cycle closed) --
// most recent first, at most SUPPRESSED_LOOKUP_RESUME_MAX (32), one
// per population, found by membership of point; [] when none (or
// malformed, any entry not of that shape). Fed to
// resolveSuppressedRoleCompanions as resumePoints (reopened on a daily
// run) and saved from its returned { resumePoints } post-apply, only
// when nothing was deferred; the save truncates to the cap, oldest
// dropped; [] clears. Remove-all's fully-successful terminal clears it
// too (19.4)
loadSuppressedLookupResume() -> Array<[string, string | null]>
saveSuppressedLookupResume(resumePoints) -> void
// 15.2.6 overlong-lookup clean list: [parentId, etag] pairs, most
// recent first, at most OVERLONG_LOOKUP_CLEAN_MAX_ENTRIES (80); []
// when none, malformed, or the read throws (costs lookups, never misses
// one). A lookup returning nothing but preserved
// records records the source at its rawEtag; one returning anything
// else removes its entry; a failed one changes nothing. Saved with the
// post-apply bookkeeping whether or not application ran (an entry
// asserts only what a lookup read), non-dry only, guarded; a complete
// scan drops entries whose parent its listing did not return; the save
// truncates to the cap, oldest dropped. Remove-all's fully-successful
// terminal clears it (19.4)
loadOverlongLookupClean() -> Array<[string, string]>
saveOverlongLookupClean(entries) -> void
// Whether a non-dry partial run's remaining causes are ones another
// pass can drain. 23.4 is the ONE complete statement of the causes;
// this contract restates none of them. Its inputs are the result's
// own fields -- applied.deferredOps, applied (null when application
// was skipped for time), diagnostics.routeBudgetExhausted with
// routeAttemptsProductive, diagnostics.continuableFailures (the
// failed planning outcomes whose registry entry is continuable: true,
// counted by buildRunResult, 4.11), diagnostics.coveredCurrentWindow
// (engine-written: the current-window condition of causes 4 and 5),
// and the evidence-tier cut-off counts diagnostics.suppressedCreates
// and suppressedDeletes -- plus chainFinished. It never reads planning outcomes
// (not retained, 17.2), never result.errors (apply failures and
// planning aggregates mixed, 20.2), and never a list of codes. False
// records "notUseful" (4.11, 19.6, 23.4)
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
// result is built (the finally-block spend write, the daily handler's
// trigger repair) -- never throws, and still logs the code when the
// detail cannot be described. detail: an Error, an AppErrorRecord, or
// a TriggerHealth report; the line carries the record's [code],
// message, and retryability, plus a report's own state fields (which
// trigger was left unrepaired) -- on the daily path nothing else sees
// them
logWarning(code, detail) -> void
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
// resolved nothing, 17.1), EXECUTION_BUDGET_EXCEEDED,
// CALENDAR_EVENT_INVALID or UNEXPECTED_ERROR (engine-side, the single
// post-loop synthesis site reads the target's FAILED outcome and
// passes its code when it is in SYNTHESIS_REASONS, else
// UNEXPECTED_ERROR -- the planning-tier boundary marked it, the 8.2
// unreadable-timestamp rule recorded CALENDAR_EVENT_INVALID, or its
// iteration threw into the per-event containment; the truthful answer
// is "the run gave up on this event", never "this event does not
// exist", 4.5/17.1), DISABLED_GLOBALLY
// (engine-side, the disabled
// gate precedes the targeted read on a scoped run, 17.1), or
// UNSUPPORTED_CALENDAR (card-side, opened calendar differs from the
// resolved primary id, BEFORE any engine run, 20.3) -- the card must
// never render silence for exactly the events users most wonder about.
// Accepts exactly these seven reasons. Takes no event, so EVERY payload
// it builds has destination, directives, origin and
// effectiveBufferMinutes null, routes empty and outcome null -- the
// give-up payloads for an event the targeted read did return included
// (17.6); the card renders a null destination as absent
buildUnresolvedEventDiagnostics(eventId, reason) -> EventDiagnostics

// Triggers
// Repair (19.3), standing triggers only (one-offs belong to their
// enqueue/collapse rules). Structurally invalid settings: mutate
// nothing, report unhealthy with the validation error. Valid and
// disabled: create nothing, DELETE orphan standing triggers. Calendar
// trigger: create when missing, keep one. Daily trigger, ONE RULE:
// desired = dailyHourUtc_ for the current Calendar time zone at the
// NEXT firing after `now`; installed = the daily-handler trigger whose
// getUniqueId() matches the persisted dtp.dailyTrigger.triggerUid at
// the record's utcHour; missing trigger, missing record, or stale hour
// -> CREATE the replacement, PERSIST { utcHour, triggerUid }, DELETE
// every other daily-handler trigger by uid (a mid-repair failure leaves
// a transient duplicate, never no daily trigger; a persist failure
// rolls the create back and reports error, so nothing accumulates).
// Calendar time zone unreadable or unrecognized: hour underivable, the
// daily trigger and record are left untouched (no create/delete/write,
// never a guessed hour), the calendar-trigger step still runs, and the
// report is unhealthy with error CALENDAR_READ_FAILED -- never a throw.
// Mutations under the user lock with a bounded wait
// (MANUAL_ENQUEUE_LOCK_MS); on contention report-only (contended, not
// a failure). `now` injected by the caller. Runs from homepage open,
// settings save, AND every daily firing -- the automatic path that
// realigns the schedule after a DST transition or time-zone change
// within one cycle (19.2, REQ-TIME-013)
ensureTriggers(now) -> TriggerHealth
// The UTC hour of the NEXT instant after `now` at which userTimeZone's
// wall clock reads desiredLocalHour:00 -- the next firing's instant at
// the offset in effect then (today's date would cost a second cycle
// where a transition crosses the maintenance hour); a nonexistent wall
// time resolves to the first instant after the gap, an ambiguous one
// to its first occurrence; half- and quarter-hour offset zones FLOOR
// to the containing UTC hour -- a bucket, since atHour fires at an
// unspecified minute within it (19.2); userTimeZone is always a
// recognized zone -- ensureTriggers never calls it without one (19.3).
// Private helper (TD 2): called only by ensureTriggers
dailyHourUtc_(userTimeZone, desiredLocalHour, now) -> number
// { utcHour, triggerUid } persisted beside the other Status keys; the
// load never throws (absent/malformed -> null -> mismatch -> replace)
// (19.3)
loadDailyTriggerRecord() -> { utcHour, triggerUid } | null
saveDailyTriggerRecord(record) -> void
// Card action: bounded work only -- under the user lock it REPLACES the
// settings document with the disabled tombstone (the 5.2 defaults with
// enabled=false, destroying origin addresses -- REQ-PRIV-006), removes
// triggers (clearing dtp.dailyTrigger with the daily one, 19.3),
// initializes progress, and enqueues the cleanup worker; the
// unbounded scan-and-delete lives in the worker (19.4). A duplicate
// click (cleanup live, settings disabled) still rewrites the tombstone
// and removes triggers -- disabled is not proof of the tombstone
// (REQ-CONFIG-004) -- and skips only the progress init and the enqueue
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
// Reset by any successful non-dry run AND unconditionally at the start of
// every daily run (the episode boundary, 19.6); cap enforced at enqueue
// time; the
// enqueue return value is how the diagnostics.continuation disposition (4.11)
// reaches the run result. BOTH call sites guard it -- trigger creation
// can throw (per-user quota): the engine's partial-run call keeps the
// truthful applied result and records a CONTINUATION_ENQUEUE_FAILED
// warning plus the "enqueueFailed" disposition (4.11), never a false
// failure record; the handler's skip-path
// re-enqueue logs the same code (log-only -- skipped results are never
// persisted or rendered, so a warning on one reaches nobody). Deferred
// work falls to the daily backstop (19.6)
enqueueContinuation() -> { scheduled: boolean, capReached: boolean }
incrementContinuationCount() / resetContinuationCount()
runContinuationReconciliation(e) -> ReconciliationResult
```
