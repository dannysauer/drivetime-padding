/**
 * CardService cards and action responses only. No business logic.
 * Technical Design section 3.1, Architecture section 5.2.
 *
 * Manual synchronization must not run reconciliation inline: card callbacks
 * have a short execution budget and a full window reconcile will exceed it.
 * Enqueue and return.
 */

/**
 * Home card (Architecture 15.5, Technical Design 20.2). Renders the
 * stored last-run record and the trigger health report, never the
 * engine's return value (trigger handlers discard it). Two fields carry
 * states the counts alone cannot: each trigger line is one of Installed
 * / Missing / Scheduled hour out of date (repairing) from TriggerHealth
 * (19.3), with the Repair action offered for the latter two; and a
 * partial run's `continuation` disposition from the stored record (20.2)
 * renders four distinct lines -- scheduled ("Finishing remaining work
 * shortly"), capReached and enqueueFailed (each "the daily run will
 * finish the remaining work" in its own words), and notUseful ("no
 * follow-up pass scheduled -- the next run picks up what it can",
 * followed by the record's errorCounts when any exist, so a
 * cause that recurs until the user acts -- CALENDAR_EVENT_INVALID -- is
 * NAMED from data the card actually holds (20.2), never alluded to: a
 * finished chain's gap is the daily run's, rejected writes any run's,
 * and the line promises neither the daily run alone nor a self-healing
 * it cannot deliver) -- so the card never promises a continuation that
 * will not fire. Null renders
 * nothing. The "Last sync" line is the stored record's status and
 * completedAt -- the LAST run, whatever its status, never a "last
 * successful sync": no success timestamp is persisted (20.2). When the
 * loaded settings are structurally valid and both eligibility toggles
 * (includeOutOfOffice, titlePatternEnabled) are false, renders "No
 * source types are enabled -- no travel blocks will be created" from
 * the loaded settings, not the run record (REQ-CONFIG-014a; Architecture
 * section 15.5).
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
 * user's email, e.g. CalendarApp.getDefaultCalendar().getId(), which
 * needs the full calendar or calendar.readonly scope -- a Spike 2 scope
 * input, the oauth-scope-strategy ADR; calendar.events does not grant
 * it) -- the literal 'primary' alias never appears in trigger payloads,
 * and a
 * literal comparison would classify the user's own calendar as foreign
 * and break every card open. Foreign calendars render
 * UNSUPPORTED_CALENDAR (via buildUnresolvedEventDiagnostics) directly,
 * with no engine run and no budget spend. Otherwise invokes a dry run
 * with eventIdFilter AND reason 'event-diagnostic' (the engine rejects
 * either half without the other -- budgeting keys on the reason) and
 * renders EXHAUSTIVELY over the statuses a scoped run can return, in precedence
 * order: result.eventDiagnostics when present (planned, ineligible, disabled,
 * not-found all carry it, as do the three synthesized give-up reasons,
 * EXECUTION_BUDGET_EXCEEDED, CALENDAR_EVENT_INVALID and UNEXPECTED_ERROR --
 * 4.5, 17.1; every synthesized payload has a null destination, rendered
 * as absent, 17.6; the reason table renders every member of
 * ELIGIBILITY_REASONS,
 * TITLE_TOO_LONG included, naming the length bound rather than a mismatch;
 * a captured payload whose outcome is failed -- a routing failure the
 * provider returned, 12.1.2 -- renders everything that needs no route,
 * the routes resolved before it, and outcome.error.code:
 * ROUTE_BUDGET_EXCEEDED and EXECUTION_BUDGET_EXCEEDED as "timing
 * temporarily unavailable", any other code by its 18.3 message);
 * else 'skipped' (lock contention) renders "synchronization in progress, reopen
 * shortly" -- no eligibility answer exists while another run holds the lock, an
 * exception REQ-UI-012 carries; else 'failed' renders the result's errors
 * (result.validationErrors, the 5.3 list, for INVALID_SETTINGS; the 18.3
 * message otherwise). A
 * blank card is never acceptable.
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
