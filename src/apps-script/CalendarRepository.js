/**
 * Advanced Calendar API reads and writes. Nothing else calls Calendar.*
 * Technical Design sections 7 and 16.
 */

/**
 * Lists every event in the observation range, following nextPageToken
 * until done OR shouldStop() fires, returning
 * { events, scanComplete, nextPageToken } -- nextPageToken non-null
 * exactly when the listing stopped early, so the ENGINE can persist it
 * and a continuation can resume the scan instead of re-reading the same
 * prefix forever on a calendar too large for one execution budget
 * (section 7.2.1). resumeToken, when provided, starts the listing there
 * -- valid only for the SAME query (the engine pins the stored
 * observation range); an expired or rejected token falls back to a
 * fresh scan from the first page, never a thrown run.
 *
 * Pagination is not optional, and scanComplete is not decoration. Silent
 * truncation would make source events invisible while their companions remain
 * observed; the comparator uses scanComplete to decide whether an unmatched
 * companion is genuinely orphaned or merely unreached (section 15.2.3).
 * Deadline-aware because a busy 180-day calendar can span enough pages to
 * spend the whole runtime inside this one call, ahead of every engine-side
 * budget check -- an early return with scanComplete false degrades the run
 * to partial instead of a hard kill (section 7.2.1).
 */
function listWindowEvents(
    calendarId, observeStart, observeEnd, shouldStop, resumeToken) {
  throw new Error('Not implemented: Technical Design section 7.2.1');
}

function listWorkingLocationEvents(calendarId, start, end) {
  throw new Error('Not implemented: Technical Design section 7.5');
}

/**
 * Ownership-filtered listing (privateExtendedProperty=dtp=1), paginated
 * until done or shouldStop() fires, returning { events, scanComplete }.
 *
 * Used by the window-shrink cleanup pass: when windowDays is reduced, the
 * observation range contracts and companions beyond the new horizon are never
 * read, so they can never be classified outside-window and deleted. Filtering
 * server-side keeps that pass cheap.
 *
 * scanComplete matters here just like the main window read: a truncated
 * scan could delete its one retrieved page, satisfy deletedAll, and lower
 * the high-water mark with later pages stranded outside every future scan.
 * Deadline-aware for the same reason as listWindowEvents: a large horizon
 * reduction can leave enough events in the vacated range to spend the
 * whole runtime inside this one call; early return with scanComplete
 * false retains the mark and the next run retries.
 * Technical Design section 7.6.
 */
function listGeneratedEventsBetween(calendarId, start, end, shouldStop) {
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

/**
 * One page of the unbounded ownership scan (dtp=1, no time bounds). The
 * CONSUMER owns the paging loop and its budget checks -- a paginate-to-
 * completion contract hides a multi-page scan behind a single call, ahead
 * of any deadline check. The removal worker interleaves this with
 * deletion: each delete shrinks the set, so re-fetching the first page
 * resumes with no persisted cursor. Technical Design section 19.4.
 */
function listGeneratedEventsPage(calendarId, pageToken) {
  throw new Error('Not implemented: Technical Design section 19.4');
}

/**
 * Ownership-filtered listing bounded by updatedMin, for the daily orphan
 * sweep. A stray exists only because it was manually MOVED out of the
 * observation range, and a move bumps the event's `updated` timestamp --
 * so the server-side bound returns just the recently-touched events among
 * which strays can exist, instead of the full history a read-only pass
 * could never resume through. EXCLUDES cancelled tombstones: updatedMin
 * listings force deleted entries in, and a companion the engine just
 * deleted (bumped `updated`, intact anchor, cancelled parent) would
 * otherwise re-enter the diff as a 404-bound delete for days. Pages until
 * done or shouldStop() fires, reporting truncation via scanComplete.
 * Technical Design section 15.2.8.
 */
function listGeneratedEventsUpdatedSince(calendarId, updatedMin, shouldStop) {
  throw new Error('Not implemented: Technical Design section 15.2.8');
}

/**
 * Targeted single-event fetch (Calendar.Events.get), used by diagnostic
 * runs instead of the window scan: an event beyond the observation range
 * is invisible to the bounded listing, and the card must be able to say
 * OUTSIDE_WINDOW rather than nothing. Returns null when the event does
 * not exist. Technical Design section 17.1.
 */
function getEventById(calendarId, eventId) {
  throw new Error('Not implemented: Technical Design section 17.1');
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
