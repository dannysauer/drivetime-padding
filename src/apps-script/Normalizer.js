/**
 * Raw Calendar event to NormalizedEvent. Technical Design section 8.
 *
 * Must not convert timestamps into the script project timezone. Retain the
 * Calendar-provided ISO strings and their offsets.
 *
 * Two fields carry the summary. `summary` is raw and may be empty --
 * eligibility matches patterns against it. `displaySummary` substitutes
 * "Untitled event" and is used only for generated subjects. Collapsing them
 * would let a blank-titled event match a pattern that happens to match the
 * fallback text. Technical Design section 8.3, REQ-ELIG-012.
 *
 * start and end are nullable: cancelled tombstones may carry neither.
 */

/**
 * TOTAL: never throws (Technical Design 8.1). Every field degrades
 * individually to its null/default form -- a throwing normalizer turns
 * one malformed resource into a failed listing, and with window-scan
 * cursor writes application-gated (7.2.1) a deterministic throw would
 * freeze the scan chain at that resource's slice forever.
 */
function normalizeCalendarEvent(rawEvent) {
  throw new Error('Not implemented: Technical Design section 8');
}

/**
 * Flattens a raw generated-event resource into the ObservedGeneratedEvent
 * contract (4.9): id, key, parentEventId, role, anchor, fingerprint,
 * observedFields, routeCache, updatedMs, rawEvent. The id feeds every
 * engine-side merge and dedup and the sweep's candidate test. updatedMs
 * is Calendar's `updated` through parseInstantOrNull (null when absent
 * or unparseable), the 13.5 "most recently updated" key.
 *
 * Must run before indexing or comparison. The comparator matches on `key`
 * and reads `observedFields`; the cache lookup reads `routeCache`. Handing
 * either one a raw Calendar resource matches nothing, so every companion
 * looks absent -- duplicates from the comparator, broker calls from the
 * cache. Technical Design sections 4.9 and 15.1.
 *
 * The anchor is load-bearing well beyond the sweep: the 15.2.9
 * concluded-record tests (anchor-equality freeze, displacement) all
 * read it.
 *
 * TOTAL, like normalizeCalendarEvent (8.1), with a null-return escape: content
 * corruption degrades field-wise within the 4.9 contract (routeSecs, anchor,
 * updatedMs, tombstone timestamps parse-or-null; the null fingerprint
 * forces the update path to rewrite the event whole when its key is
 * desired). Identity
 * corruption splits by what is lost (8.1): an unrecoverable id or ownership
 * marker returns NULL -- the engine excludes the resource with a logged
 * warning, since without the marker it cannot be safely deleted (15.3);
 * defense in depth, as the ownership-filtered listings guarantee the marker.
 * Unrecoverable parentEventId/role with valid id and marker normalizes KEYLESS
 * (key null): unmanageable, so the engine removes it from the observed set and
 * queues its deletion on any scan that observes it -- the corruption is
 * evidence in hand, the marker satisfies 15.3, and deletion is self-healing (a
 * desired block is recreated cleanly by its parent's own planning) --
 * preserved only when the lenient 15.2.9 deletion-side test keeps it
 * (concluded, or ended anchorless: possible history; ended but displaced
 * deletes like any stray). An out-of-range keyless stray is the accepted 8.1
 * residual; remove-all reaches it.
 */
function normalizeObservedGeneratedEvent(rawEvent) {
  throw new Error('Not implemented: Technical Design section 4.9');
}

/**
 * The ONE instant parser (Technical Design 8.1): every instant string
 * the add-on reads goes through it, once per reader, and it never
 * throws. Returns EPOCH MILLISECONDS or null (missing, non-string, or
 * unparseable input). The normalizer stores its result in
 * startMs/endMs beside the original strings; 8.1 carries the rules for
 * all-day events (nominal UTC midnight), timed-ness, and the 7.2.1
 * partition's presence-keyed use. This docblock states the contract,
 * not the argument, so the two cannot drift.
 */
function parseInstantOrNull(iso) {
  throw new Error('Not implemented: Technical Design section 8.1');
}

/**
 * The one statement of Technical Design 8.2's rule: status !==
 * 'cancelled' && !isAllDay && (startMs === null || endMs === null). The
 * planning loop records a retryable, non-continuable
 * CALENDAR_EVENT_INVALID failed outcome for it (companions preserved,
 * 17.3) and 15.2.3's live-parent evaluation preserves the candidate;
 * all-day events are excluded because 9.2 step 4 rejects them on
 * isAllDay alone. The argument lives in 8.1 and 8.2.
 */
function hasUnreadableTimestamps(event) {
  throw new Error('Not implemented: Technical Design section 8.2');
}
