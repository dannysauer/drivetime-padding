/**
 * Last-run persistence and user diagnostics. Technical Design section 20.
 *
 * Stores counts and opaque identifiers only. No addresses, titles, or
 * descriptions (ADR 0010).
 */

function saveRunStatus(result) {
  throw new Error('Not implemented: Technical Design section 20.2');
}

function loadRunStatus() {
  throw new Error('Not implemented: Technical Design section 20.2');
}

/**
 * Hourly diagnostic route allowance (DIAGNOSTIC_ROUTE_CALLS_PER_HOUR),
 * backed by an hour-bucketed counter under DIAGNOSTIC_SPEND_KEY. Feeds the
 * run's RouteBudget when reason is event-diagnostic -- the ceiling must be
 * the budget the routing client decrements, or it is a constant with no
 * mechanism. Read/written under the user lock the run already holds.
 * Technical Design section 20.3.
 */
function diagnosticBudgetRemaining(now) {
  throw new Error('Not implemented: Technical Design section 20.3');
}

/**
 * Recorded from the engine's finally, not the success path: a diagnostic
 * that throws after its broker calls still spent them, and skipping the
 * record would hand every reopened card a fresh allowance.
 * Technical Design section 20.3.
 */
function recordDiagnosticRouteSpend(count, now) {
  throw new Error('Not implemented: Technical Design section 20.3');
}
