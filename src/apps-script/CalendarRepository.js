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

function deleteGeneratedEvent(eventId) {
  throw new Error('Not implemented: Technical Design section 16');
}

/** ADR 0009: metadata only. Never match on title. */
function isGeneratedEvent(rawEvent) {
  const props =
    rawEvent &&
    rawEvent.extendedProperties &&
    rawEvent.extendedProperties.private;
  return Boolean(props && props[GENERATED_FLAG_KEY] === GENERATED_FLAG_VALUE);
}
