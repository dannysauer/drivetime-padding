/**
 * End-to-end orchestration and diff application.
 * Architecture section 14, Technical Design section 17.
 *
 * Two invariants worth restating here because violating either is destructive:
 *
 *   1. Only events carrying dtp === '1' may be deleted (ADR 0009).
 *   2. A source event whose planning FAILED must keep its existing generated
 *      events. Deletion authority applies only to 'planned' and 'ineligible'
 *      outcomes (Technical Design section 17.4). A broker outage must never
 *      erase a user's travel blocks.
 */

function runReconciliation(options) {
  throw new Error('Not implemented: Technical Design section 17');
}

/**
 * Applies the diff and reports what Calendar ACCEPTED.
 *
 * The returned ApplyResult -- not the proposed diff -- is what run status
 * and the stored last-run record are built from. A rejected write that
 * never reaches the saved counts leaves the UI reporting success over
 * work that silently failed (REQ-ERROR-006).
 *
 * Replaces execute delete-then-create: eventType is immutable after
 * creation, so a type change cannot be patched (section 15.2.5).
 *
 * Budget-aware: checks elapsedExceedsExecutionBudget between operations
 * and defers the remainder as ApplyResult.deferredOps -- one pre-
 * application gate cannot cover an arbitrarily large diff, and a hard
 * kill mid-apply skips status persistence and continuation scheduling.
 * Deferred is not failed: nothing was rejected. Section 23.1.
 * Technical Design section 17.5.
 */
function applyDiff(diff, runStartMs) {
  throw new Error('Not implemented: Technical Design section 17.5');
}

/**
 * Two ranges, not one. ADR 0012, Technical Design section 7.2.
 *
 * Plan range decides which sources are evaluated; observe range decides which
 * generated events are read. The observe range must be wider, because
 * companions fall outside their source's own span and Events.list bounds
 * timeMin on end time but timeMax on start time -- so a single window leaks
 * at both edges and duplicates get created on every run.
 */
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

/**
 * Planning eligibility is temporal INTERSECTION, not start-time containment.
 *
 * A source running 01:00-18:00 evaluated at noon started before an 8h
 * lookback, but its return block at 18:00 is still needed. Testing
 * source.start alone would mark it OUTSIDE_WINDOW, and ineligibility carries
 * deletion authority -- so the return block would be deleted mid-appointment.
 *
 * Technical Design section 7.2, REQ-ELIG-007, REQ-TIME-011.
 */
function overlapsPlanningRange(event, window) {
  throw new Error('Not implemented: Technical Design section 7.2');
}

/**
 * A matching fingerprint means the DESIRED state is unchanged. It does not
 * mean the OBSERVED event still matches it -- Calendar preserves private
 * metadata when a user drags or renames an event, so the stored fingerprint
 * survives the tampering it would need to detect.
 *
 * Compares start, end, summary, eventType, transparency, reminders, AND
 * outOfOfficeProperties. That set must stay identical to the USER-VISIBLE
 * entries of the section 16.5 patch list plus the replacement-realigned
 * fields (eventType, and outOfOfficeProperties where Calendar will not
 * patch it); private extended properties are patched too but are the
 * add-on's own metadata (route cache, section 15.2.2), not compared owned
 * state. A field written but not compared is one the user can change
 * permanently, because nothing else in the pipeline looks at it.
 *
 * Takes the ObservedGeneratedEvent -- not its fields bag -- and reads
 * observed.observedFields (4.9) against the spec, the same
 * first-argument shape as the other observed-side helpers.
 *
 * Technical Design section 15.2.1, REQ-GEN-014a, REQ-GEN-014b,
 * REQ-GEN-014c.
 */
function ownedFieldsMatch(observed, desiredSpec) {
  throw new Error('Not implemented: Technical Design section 15.2.1');
}

/**
 * The section 15.2.9 concluded-record test: observed end before the
 * run's injected `now`, the persisted ANCHOR instant itself before `now`
 * (a future meeting's block dragged into the past is live state the
 * update restores, not a record), AND observed times within the
 * anchor's companion span (undisplaced -- the 15.2.8 moved-test).
 * PARENT-LESS -- companion and clock only, as the deletion paths need -- so not
 * by itself the write-side freeze, which additionally requires the role NOT to
 * be provably live (endedSpanRouteFree anything but "live"): a just-ended
 * meeting's return block has a past anchor and a live span, and dragged into
 * the past it is a record here yet restored by the comparator (15.2.9). A
 * concluded record is a trip that happened; every absence-of-desire deletion
 * path preserves it (comparator, 15.2.3 evaluation, 15.2.6 overlong lookup,
 * 15.2.8 sweep), the fallback suppressedDeletes counter excludes it,
 * and only in-window duplicate collapse among copies of one trip
 * (13.5) and remove-all still delete one -- the 15.2.8
 * stranded-duplicate rule passes over concluded candidates. This
 * helper is the STRICT test (valid anchor required). The deletion
 * paths additionally treat an ended ANCHORLESS companion as a record
 * (conservative preserve -- a stray that persists beats erased
 * history); the write-side rules (matched-branch freeze, 15.2.7
 * lookup exclusion) use the strict test alone, so an anchorless match
 * follows the DESIRED span: a live desired span emits the spec and the
 * update restores it however far into the past it was dragged; an ended
 * desired span with no undisplaced same-anchor block emits none, and
 * an ended anchorless block is left as it is (15.2.9). Anchor equality compares
 * INSTANTS, never strings.
 */
function isConcludedRecord(observedEvent, now) {
  throw new Error('Not implemented: Technical Design section 15.2.9');
}

/**
 * The DELETION-side (lenient) test: isConcludedRecord OR ended with a
 * missing/unparseable anchor. Every absence-of-desire deletion path
 * filters through this -- an ended anchorless companion is preserved
 * conservatively (displacement unprovable; a stray that persists beats
 * erased history) even though the strict test above, which the
 * write-side rules use, rejects it. Technical Design 15.2.9.
 */
function isPreservedRecord(observedEvent, now) {
  throw new Error('Not implemented: Technical Design section 15.2.9');
}

/**
 * Upcoming events first, then in-progress and lookback events.
 * Plain ascending order would spend the execution budget on the past.
 * Technical Design section 23.2.
 */
function orderForPlanning(events, now) {
  throw new Error('Not implemented: Technical Design section 23.2');
}

/**
 * scanComplete gates orphan DELETES only; creates are gated by the
 * section 15.2.7 per-parent lookup, which is complete for its parent
 * whatever the scan covered (15.2.4) -- that is what lets cursor-resumed
 * slices (7.2.1) create for sources the first slice never read. Orphan
 * deletes act on what the scan failed to find, and a truncated scan
 * proves only that an event was not reached. Presence-based operations
 * (update, metadata
 * patch, unchanged) proceed, because the events they touch were actually
 * read. A CONCLUDED record -- ended before the injected `now`,
 * undisplaced from its persisted anchor -- is never deleted on any
 * absence-of-desire path, and on matched branches splits on ANCHOR
 * EQUALITY (route-free): the desired spec's source anchor equals the
 * record's persisted anchor AND the spec carries the provider's
 * `pinned` flag (14 -- never inferred from the spec's times: a live
 * role's computed spec can end before `now` too; an unpinned spec
 * against a same-anchor record is a provably live role, a just-ended
 * meeting's return block dragged into the past, restored by the update
 * instead) -> same occurrence -> `unchanged`, never
 * update, replace, or metadata patch (a re-estimate or an edit to the
 * ended source must not rewrite a past block; routing is
 * short-circuited for the role); anchors differ -> the record matches
 * NOTHING -- the key falls through to create when the desired span
 * still lies ahead (a rescheduled occurrence gets fresh padding); a
 * desired span that has already ended never reaches the comparator --
 * the PROVIDER emitted no spec for it (12.5's ended rule) -- so the
 * comparator sees only different-anchor, anchorless, or DISPLACED
 * same-anchor companions of the role (an undisplaced same-anchor one
 * would have made the provider emit the spec that restores it), stale
 * and deleted subject to the lenient record test
 * (Technical Design 12.5, 15.2.9);
 * `now` is a parameter for the concluded-record tests. Duplicate convergence
 * collapses live same-key copies (and co-observed concluded copies of
 * ONE trip -- same key and same anchor) but never a record against the
 * new occurrence's block.
 * Technical Design sections 15.2.3, 15.2.4, 15.2.9, REQ-RECON-013.
 */
function compareDesiredAndObserved(desiredSpecs, observedEvents,
                                   planningOutcomes, scanComplete, now) {
  throw new Error('Not implemented: Technical Design section 15');
}

/**
 * Index observed companions by parentEventId|role BEFORE planning.
 *
 * Ordering is load-bearing, not an optimization: route cache entries live on
 * the observed companions, so unless they are resolved first the provider has
 * nothing to consult and every run calls the broker -- and the anchors
 * and observed fields feeding the 15.2.9 freeze live there too.
 *
 * Keeps EVERY companion of a key (Map<key, ObservedGeneratedEvent[]>).
 * A collision -- the post-reschedule record beside the new live block
 * (15.2.9), or a stale duplicate beside the trip's own block -- is
 * never collapsed here: the right pick per role depends on the
 * source's 14.1 anchors, which only companionsFor has in hand, and the
 * 15.2.10 membership tests ("no LIVE companion", "no SAME-ANCHOR
 * companion") need the full list, not a representative.
 * Technical Design section 12.1.1, REQ-PERF-015.
 */
function indexByGeneratedKey(observedEvents) {
  throw new Error('Not implemented: Technical Design section 12.1.1');
}

/**
 * The resolved observed companions per role for one source -- the whole
 * ObservedGeneratedEvent, not just its cache triplet: the provider
 * applies the 15.2.9 freeze (strictly concluded record + anchor
 * equality + ended desired span -> unchanged, routing short-circuited)
 * before routing, and a triplet-only context could not recognize the
 * record. The triplets still ride inside, passed to the routing client
 * uninspected.
 *
 * THE CHOICE is made here, per role, from the source's own 14.1
 * anchors (source.start for outbound, source.end for return): the
 * UNDISPLACED companion whose persisted anchor equals the role's anchor
 * AS AN INSTANT, then any same-anchor one (co-observed copies of one
 * trip exist by design, 15.2.9; a displaced copy must not hide the
 * record), whatever its state -- live, dragged, or a concluded record
 * -- is the trip's own block, the one 12.5's ended rule and the freeze
 * ask about (a different-anchor pick would hide the block the spec
 * exists to restore). With no same-anchor companion: a LIVE,
 * non-concluded one over a concluded record (the live block owns the
 * key's cache; a record shadowing it would re-call the broker every
 * run for a role with a valid entry -- ADR 0011, REQ-PERF-015), and a
 * record only when nothing else carries the key. Liveness is judged
 * with the injected run clock `now`, the same one the provider and
 * comparator use, so a block crossing its end mid-run is never a
 * record to one and live to another.
 * Technical Design sections 12.1.1, 15.2.9.
 */
function companionsFor(observedByKey, event, now) {
  throw new Error('Not implemented: Technical Design section 12.1.1');
}

/**
 * Assembles the DrivetimeContext (Technical Design 12.1) from NAMED
 * fields -- never a positional list, which a new field would silently
 * shift -- and attaches the routing client. The engine is the only
 * caller; the provider never builds its own context.
 */
function buildProviderContext(fields) {
  throw new Error('Not implemented: Technical Design section 12.1');
}

/**
 * The ONE shape of a failed planning outcome (Technical Design 17.4):
 * { state: 'failed', specs: [], error: buildAppError(code, event,
 * details) } -- details the optional offending-value bag (the
 * unreadable start/end strings for CALENDAR_EVENT_INVALID), copied
 * verbatim into AppErrorRecord.details (18.1), never special-cased by
 * code.
 * Every site that records one -- unreadable timestamps (8.2), missing
 * default origin (10.4), the per-event containment catch, the
 * planning-tier cut-off (markRemainingSourcesFailed below) -- builds it
 * here, so the outcome contract is one statement, not several
 * hand-written copies.
 */
function failedOutcome(code, event, details) {
  throw new Error('Not implemented: Technical Design section 17.4');
}

/**
 * Planning-tier cut-off (Technical Design 23.1): every source from
 * currentEvent to the end of the planning order gets
 * failedOutcome('EXECUTION_BUDGET_EXCEEDED', event) -- companions
 * preserved (17.3), the outcome folded into result.errors and, for a
 * filtered target, carried to the card by the 17.1 synthesis. Builds
 * each record through failedOutcome, never by hand.
 */
function markRemainingSourcesFailed(orderedSources, currentEvent,
                                    planningOutcomes) {
  throw new Error('Not implemented: Technical Design section 23.1');
}

/**
 * Engine post-pass on the diff: one unbounded parent lookup per pending
 * create. A managed companion the user dragged beyond the observation
 * range is invisible to a complete scan; creating blindly would strand it
 * as a permanent duplicate. A same parent|role match restores the dragged
 * companion, classified like an in-window match (Technical Design
 * 15.2.5): an update ordinarily, a REPLACE when eventType differs (or a
 * Spike-resolved unpatchable outOfOfficeProperties does, 16.5) -- the
 * field is immutable, so an unconditional conversion to update would emit
 * a patch Calendar rejects on every run.
 *
 * Restoration supersedes the shrink cleanup: a companion dragged into a
 * vacated range sits in cleanup.events AND matches a pending create.
 * Such colliding keys are resolved DIRECTLY against the in-memory
 * stranded event, before any lookups -- the match is already in hand,
 * so the budget guard can never leave it undecided. The matched event
 * is removed from diff.deletes (or applyDiff would delete the freshly
 * restored event) but STAYS in cleanup.events: the high-water gate
 * checks resolvedAll -- deleted, or restoration write applied -- so a
 * failed restoration holds the mark like a failed delete rather than
 * letting it lower past an event still beyond the horizon.
 *
 * The comparator stays pure; it has no repository access.
 *
 * Checks shouldStop -- the section 23.1 EVIDENCE threshold, a tier past
 * the bulk-listing one, which a too-large calendar's window listing
 * exhausts before this pass starts -- between lookups: one lookup per
 * pending create multiplies past what a single up-front gate can bound.
 * When it fires, the pass SUPPRESSES every unresolved create (out of
 * diff.creates, counted in diagnostics.suppressedCreates): application
 * legitimately proceeds with the headroom the evidence threshold
 * leaves, and a create whose lookup never ran must not be applied
 * blindly. Non-dry only -- a dry run applies nothing, so unresolved
 * creates stay in the preview diff, counted as unverified; dryRun is a
 * parameter for exactly this branch, like findStrandedCompanions'.
 *
 * SKIPPED on scoped diagnostic runs (eventIdFilter): the section 17.1
 * targeted read already performed this exact companion lookup for the one
 * parent the run compares, so every managed companion is already observed
 * -- re-querying pays a redundant round trip on the card-open path and a
 * failure would fail an otherwise complete diagnosis.
 * Technical Design section 15.2.7.
 */
function resolveOutOfWindowCompanions(diff, cleanup, dryRun, shouldStop) {
  throw new Error('Not implemented: Technical Design section 15.2.7');
}

/**
 * Engine post-pass for INCOMPLETE scans (Technical Design 15.2.3, 15.2.4):
 * upgrades orphan deletion to per-event evidence. One getEventById parent
 * point read per unmatched observed companion -- absent or cancelled proves
 * the orphan (the same rule the 15.2.8 sweep trusts) and moves it into
 * diff.deletes. A LIVE parent is NORMALIZED first (normalizeCalendarEvent,
 * 8.1 -- the predicate and every test below read normalized fields,
 * never the raw resource); one with unreadable timestamps
 * (hasUnreadableTimestamps) preserves the candidate this run like a
 * failed parent (17.3) -- never deletion on an unreadable instant (8.2).
 * Otherwise it is evaluated in place through the route-free
 * desired-state tests its own slice would apply (planning-range overlap
 * against window; eligibility against settings, which the sweep never needs
 * because its no-outcome parents all sit outside the PLANNING range -- some
 * read but unplanned, in the observation margin -- where position alone
 * carries deletion authority; a no-outcome parent HERE can sit inside the
 * planning range on an unread page, where only eligibility can decide;
 * the desired role set -- evaluateEligibility on the fetched parent, with
 * the run's once-compiled titleMatcher (9.1), then routeFreeDesiredRoles,
 * the same derivation the engine feeds the provider):
 * no desired companion for the key deletes, whatever page the
 * parent sat on -- a stale companion split from its live source by pagination
 * must not survive on liveness alone. For a desired role whose desired span
 * endedSpanRouteFree reports "ended" (the time test shared with the provider,
 * so the two cannot drift) the parent's slice emits no spec, and the candidate
 * follows 12.5's shared rule: the parent's UNDISPLACED same-anchor block is
 * kept (a record, or about to become one), every other companion of the role --
 * a displaced same-anchor block included -- is stale and deleted unless the
 * lenient record test spares it; a role still live, or in the return band,
 * preserves the candidate this run -- the parent's own slice owns it, through
 * the 15.2.7 lookup if it emits a spec, through the 15.2.10 lookup if it
 * records the role ended. A PRESERVED record (15.2.9's
 * deletion-side test: concluded, or ended with an unusable anchor) is spared
 * without spending a read. Checks shouldStop BETWEEN reads; companions whose
 * read never ran stay preserved and count in diagnostics.suppressedDeletes.
 * This is what keeps cleanup alive on calendars too large for any
 * single-budget scan (7.2.1).
 */
function resolveUnmatchedCompanions(diff, planningOutcomes, window,
                                    settings, now, shouldStop,
                                    titleMatcher) {
  throw new Error('Not implemented: Technical Design section 15.2.3');
}

/**
 * Suppressed-role cleanup pass (Technical Design section 15.2.10). A role
 * the provider suppressed under 12.5 -- zeroed out of existence by its
 * route, or already ended -- emits no spec, so it produces no pending
 * create (restoration never fires) and the route-free 15.2.3 evaluation
 * must preserve in its ambiguity; a displaced stale block the scan never
 * observed (split pagination slice, or beyond the observation range)
 * therefore has no other deletion path on a calendar that never
 * completes a scan.
 *
 * Population: for every PLANNED outcome, keys whose role the provider recorded
 * on PlanningOutcome.suppressed -- reason "zero" OR "ended": both mean no
 * spec, no pending create, no restoration, so only this targeted lookup can
 * reach a displaced stale block on a calendar that never completes a scan (an
 * unrouted role appears in neither list and proves nothing) -- whatever the
 * route's provenance (a provenance filter would hide previously-suppressed
 * keys from their own retry). observedByKey holds EVERY companion per
 * key (indexByGeneratedKey), so both membership tests below read the
 * full list. A "zero" key enters when it has no LIVE
 * observed companion (a record-only key stays in -- the comparator preserves
 * the record and cannot reach an unobserved stale block sharing the key,
 * 15.2.9); EVERY "ended" key enters -- the provider's emission rule is
 * the test (it records "ended" only with no UNDISPLACED same-anchor
 * companion in its context, 12.5), so this pass repeats none, and the
 * cost bound rests on 12.5, not on a filter here. Matches follow 12.5's
 * shared rule: for an "ended" key the parent's UNDISPLACED same-anchor
 * block is kept (a record, or about to become one), every other match
 * -- a displaced same-anchor block included -- is stale; for a "zero"
 * key every match is stale. Deletes
 * except preserved records, so a record is never touched. Keys grouped by
 * parent, ONE
 * listCompanionsByParent per PARENT -- the read returns both roles, and the
 * canonical zero case (a meeting at the origin with zero buffer) zeroes both
 * roles of one parent, so per-key lookups would double the reads; matches for
 * the suppressed roles join diff.deletes, deduplicated by id against
 * everything already queued, preserved records excepted (15.2.9).
 * Planned-parent deletion authority (17.3): desired state provably contains no
 * block for the role.
 *
 * Runs on incomplete scans, daily runs, AND continuations; LAST on the
 * evidence tier, behind the sweep (23.1) -- its chronic population of
 * standing zeroed keys never drains, so ahead of the sweep it would
 * starve the sweep permanently, while its own deferred work drains
 * through the sweep-less suppressed-work continuation. shouldStop is
 * checked between lookups; keys cut off count in
 * diagnostics.suppressedDeletes -- and the deadline-starved engine
 * branch invokes this same pass with the guard already true (zero
 * lookups, every pending key counted), so no second population
 * computation exists to drift (15.2.4).
 */
function resolveSuppressedRoleCompanions(
    diff, planningOutcomes, observedByKey, now, shouldStop) {
  throw new Error('Not implemented: Technical Design section 15.2.10');
}

/**
 * Daily orphan sweep (Technical Design section 15.2.8). Lists
 * ownership-filtered events updated since the sweep watermark (a stray was
 * necessarily moved, and moves bump `updated`; cancelled tombstones excluded),
 * selects candidates by event id absent from the window read plus anchor
 * inside the maximal anchor band -- from planStart minus the discovery slack
 * and duration cap up to NOW (not planStart) plus MAX_WINDOW_DAYS plus the
 * duration cap, so a window shrink cannot hide a stray and the lookback offset
 * cannot reject a far-edge one -- then decides per parent STATE via one point
 * read: absent/cancelled parents delete (concluded records excepted, 15.2.9 --
 * deleting a past meeting does not un-happen the trip); live-but-out-of-window
 * and in-window ineligible parents delete only DISPLACED candidates (observed
 * outside the persisted anchor's companion span -- undisplaced candidates aged
 * out naturally and stay as calendar history, however recently a patch bumped
 * `updated`); planned parents keep their candidates unless an in-window event
 * already satisfies the key AND the candidate is not a concluded record (a
 * reschedule leaves the record sharing the key with the new block by design),
 * (a suppressed role's stray is the 15.2.10 lookup's, reached through
 * an unbounded per-parent read no watermark gates, on this run or its
 * continuation -- one rule, one pass); failed parents preserve. Takes the FULL
 * observed list (observedAll -- keyless corrupt events included, 8.1): the id
 * test must not read a window-observed keyless event, whose deletion the
 * engine already queued, as absent from the window. Candidate selection skips
 * keyless LISTING returns like anchorless ones -- no parent to point-read, and
 * the null-id read could throw, deterministically failing every sweep over the
 * same event (8.1). Runs only on daily triggers with a COMPLETE window scan;
 * shouldStop is checked between pages AND between parent point reads (a bulk
 * move can yield many candidates). Returns { events, sweepComplete }; the
 * ENGINE records sweepComplete in diagnostics and writes the
 * dtp.sweepCompletedAt watermark only after applyDiff confirms
 * deletedAll(events) -- application-gated like the shrink high-water mark,
 * because continuations cannot re-run the daily-gated sweep and an
 * application-blind advance would strand the found strays. Takes the injected
 * `now`: updatedMin, the anchor band, and the watermark all derive from it,
 * and the watermark stretches the bounds over gaps of skipped or incomplete
 * sweeps.
 */
function sweepOutOfWindowCompanions(
    observedAll, planningOutcomes, window, now, shouldStop) {
  throw new Error('Not implemented: Technical Design section 15.2.8');
}

/**
 * Normalizes a run-wide failure (window read, unexpected throw) into a
 * failed ReconciliationResult so it reaches the stored record instead of
 * leaving the home card showing a stale success. Settings validation
 * failures are built from the validation result and carry its full error
 * list, so the diagnostic card can show what is wrong (section 5.3).
 * Technical Design section 17.2, Architecture section 14.2.
 */
function buildFailureResult(errorOrValidation, options) {
  throw new Error('Not implemented: Technical Design section 17.2');
}

/**
 * Companions stranded beyond a shrunken horizon.
 *
 * observeEnd is derived from the CURRENT windowDays, so reducing that setting
 * hides previously generated companions rather than deleting them. A
 * high-water mark of the furthest horizon ever used drives an
 * ownership-filtered cleanup over the vacated span.
 *
 * dryRun suppresses even the mark-ADVANCE on the common path: advancing is
 * a persistence too, and a preview that raised the mark would change
 * whether a later reduced-window run classifies as a shrink.
 *
 * Returns { shrunk, events, scanComplete } -- a FINDER, not a deleter.
 * The engine lowers the mark only after applyDiff confirms every stranded
 * event RESOLVED -- deleted, or realigned inside the window by an applied
 * write (resolvedAll, Technical Design 17.5) -- AND the scan itself was
 * complete (and never on dry run). A truncated scan could delete its one
 * retrieved page, satisfy the gate, and strand every later page outside
 * all future scans.
 * Merging the events into the delete list and dropping the flags leaves
 * no path that ever lowers the mark, so every later run repeats the full
 * scan of the vacated range.
 *
 * Stranded means START at or after the new horizon. Events.list bounds
 * timeMin on event end, so a companion spanning the boundary shows up in
 * this scan AND the ordinary observation read -- queuing it here would
 * race a cleanup delete against the comparator's repair, and delete-first
 * ordering means the delete wins.
 * Technical Design section 7.6, REQ-CONFIG-006a.
 */
function findStrandedCompanions(window, settings, dryRun, shouldStop) {
  throw new Error('Not implemented: Technical Design section 7.6');
}
