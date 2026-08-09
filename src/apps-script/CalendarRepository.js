/**
 * Advanced Calendar API reads and writes. Nothing else calls Calendar.*
 * Technical Design sections 7 and 16.
 */

/**
 * Lists every event in the window, following nextPageToken to completion.
 *
 * Pagination is not optional. Silent truncation would make source events
 * invisible while their generated events remain observed, and the comparator
 * would delete those as orphans.
 */
function listWindowEvents(calendarId, start, end) {
  throw new Error('Not implemented: Technical Design section 7.2.1');
}

function listWorkingLocationEvents(calendarId, start, end) {
  throw new Error('Not implemented: Technical Design section 7.5');
}

function createGeneratedEvent(spec) {
  throw new Error('Not implemented: Technical Design section 16');
}

function updateGeneratedEvent(eventId, spec) {
  throw new Error('Not implemented: Technical Design section 16.5');
}

/**
 * Takes the OBSERVED event, not a bare id.
 *
 * The user lock serializes this add-on's executions, not concurrent Calendar
 * edits from the web UI, a phone, or another API client. A user can strip the
 * dtp marker between the read and the write, and an id-only delete would
 * remove the event anyway -- breaching ADR 0009.
 *
 * Delete conditionally on the observed ETag where the runtime allows it,
 * otherwise re-read and re-verify the marker immediately before deleting.
 * Technical Design section 16.5.1.
 */
function deleteGeneratedEvent(observed) {
  throw new Error('Not implemented: Technical Design section 16.5.1');
}

/** ADR 0009: metadata only. Never match on title. */
function isGeneratedEvent(rawEvent) {
  const props =
    rawEvent &&
    rawEvent.extendedProperties &&
    rawEvent.extendedProperties.private;
  return Boolean(props && props[GENERATED_FLAG_KEY] === GENERATED_FLAG_VALUE);
}
