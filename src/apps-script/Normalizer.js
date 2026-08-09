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
