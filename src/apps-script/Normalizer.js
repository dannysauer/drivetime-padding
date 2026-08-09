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

function normalizeCalendarEvent(rawEvent) {
  throw new Error('Not implemented: Technical Design section 8');
}

/**
 * Flattens a raw generated-event resource into the ObservedGeneratedEvent
 * contract: key, parentEventId, fingerprint, observedFields, routeCache.
 *
 * Must run before indexing or comparison. The comparator matches on `key`
 * and reads `observedFields`; the cache lookup reads `routeCache`. Handing
 * either one a raw Calendar resource matches nothing, so every companion
 * looks absent -- duplicates from the comparator, broker calls from the
 * cache. Technical Design sections 4.9 and 15.1.
 */
function normalizeObservedGeneratedEvent(rawEvent) {
  throw new Error('Not implemented: Technical Design section 4.9');
}
