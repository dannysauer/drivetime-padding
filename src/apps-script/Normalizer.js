/**
 * Raw Calendar event to NormalizedEvent. Technical Design section 8.
 *
 * Must not convert timestamps into the script project timezone. Retain the
 * Calendar-provided ISO strings and their offsets.
 */

function normalizeCalendarEvent(rawEvent) {
  throw new Error('Not implemented: Technical Design section 8');
}
