/**
 * Advanced Calendar API reads and writes. Nothing else calls Calendar.*
 * Technical Design sections 7 and 16.
 */

/**
 * Lists every event in the observation range, following nextPageToken to
 * completion. Returns { events, scanComplete }.
 *
 * Pagination is not optional, and scanComplete is not decoration. Silent
 * truncation would make source events invisible while their companions remain
 * observed; the comparator uses scanComplete to decide whether an unmatched
 * companion is genuinely orphaned or merely unreached (section 15.2.3).
 */
function listWindowEvents(calendarId, observeStart, observeEnd) {
  throw new Error('Not implemented: Technical Design section 7.2.1');
}

function listWorkingLocationEvents(calendarId, start, end) {
  throw new Error('Not implemented: Technical Design section 7.5');
}

/**
 * Ownership-filtered listing (privateExtendedProperty=dtp=1).
 *
 * Used by the window-shrink cleanup pass: when windowDays is reduced, the
 * observation range contracts and companions beyond the new horizon are never
 * read, so they can never be classified outside-window and deleted. Filtering
 * server-side keeps that pass cheap. Technical Design section 7.6.
 */
function listGeneratedEventsBetween(calendarId, start, end) {
  throw new Error('Not implemented: Technical Design section 7.6');
}

/**
 * Ownership + parent filtered (dtp=1 AND parent=<id>), no time bounds.
 *
 * A source edited to exceed MAX_SOURCE_DURATION breaks the section 7.2
 * observability guarantee: the source stays readable while its companions
 * fall behind observeStart forever. This targeted lookup is how those
 * companions get found and deleted. Technical Design section 15.2.6.
 */
function listCompanionsByParent(calendarId, parentEventId) {
  throw new Error('Not implemented: Technical Design section 15.2.6');
}

function createGeneratedEvent(spec) {
  throw new Error('Not implemented: Technical Design section 16');
}

/** Takes the observed event so the ETag can be carried. Section 16.5.1. */
function updateGeneratedEvent(observed, spec) {
  throw new Error('Not implemented: Technical Design section 16.5');
}

/**
 * Private-property write only -- no owned fields in the patch body, so the
 * event does not move and the user sees nothing. Required rather than
 * optional: skipping it leaves routeAt stale and every later run calls the
 * broker. Technical Design section 16.6.
 */
function patchGeneratedEventMetadata(observed, privateProperties) {
  throw new Error('Not implemented: Technical Design section 16.6');
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
