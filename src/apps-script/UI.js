/**
 * CardService cards and action responses only. No business logic.
 * Technical Design section 3.1, Architecture section 5.2.
 *
 * Manual synchronization must not run reconciliation inline: card callbacks
 * have a short execution budget and a full window reconcile will exceed it.
 * Enqueue and return.
 */

function buildHomeCard() {
  throw new Error('Not implemented: Architecture section 5.2');
}

/**
 * Current-event diagnostic card. Checks e.calendar.calendarId BEFORE
 * invoking the engine: the eventOpen trigger fires for secondary and
 * shared calendars too, and an unchecked pass-through would look the id
 * up in primary and report EVENT_NOT_FOUND for an event the user is
 * looking at. Compare against the RESOLVED primary-calendar id (the
 * user's email, e.g. CalendarApp.getDefaultCalendar().getId()) -- the
 * literal 'primary' alias never appears in trigger payloads, and a
 * literal comparison would classify the user's own calendar as foreign
 * and break every card open. Foreign calendars render
 * UNSUPPORTED_CALENDAR (via buildUnresolvedEventDiagnostics) directly,
 * with no engine run and no budget spend. Otherwise invokes a dry run
 * with eventIdFilter AND reason 'event-diagnostic' (the engine rejects
 * either half without the other -- budgeting keys on the reason) and
 * renders EXHAUSTIVELY over the statuses a scoped run can return, in
 * precedence order: result.eventDiagnostics when present (planned,
 * ineligible, disabled, not-found all carry it, as do the two
 * synthesized give-up reasons, EXECUTION_BUDGET_EXCEEDED and
 * UNEXPECTED_ERROR -- 4.5, 17.1); else 'skipped' (lock
 * contention) renders "synchronization in progress, reopen shortly" --
 * no eligibility answer exists while another run holds the lock, an
 * exception REQ-UI-012 carries; else 'failed' renders the result's
 * errors (the 5.3 validation list for INVALID_SETTINGS, the 18.3 message
 * otherwise). A blank card is never acceptable.
 * Technical Design sections 17.1, 17.6, 20.3.
 */
function buildEventCard(e) {
  throw new Error('Not implemented: Technical Design section 20.3');
}

/**
 * "Synchronize now" action handler. Enqueues a one-off trigger invoking
 * runManualReconciliation and returns "Synchronization started" within the
 * callback budget. Does not stack: one pending run covers any number of
 * clicks, because reconciliation is idempotent.
 * Technical Design section 19.5 (subject to Prototype Spike 1).
 */
function onSynchronizeNow(e) {
  throw new Error('Not implemented: Technical Design section 19.5');
}
