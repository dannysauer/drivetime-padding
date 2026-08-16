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
 * RESERVE half of the hourly diagnostic route allowance
 * (DIAGNOSTIC_ROUTE_CALLS_PER_HOUR), backed by an hour-bucketed counter
 * under DIAGNOSTIC_SPEND_KEY. Called by the engine BEFORE any broker
 * call: writes the whole remaining allowance as used and returns the
 * grant, which feeds the run's RouteBudget when reason is
 * event-diagnostic -- the ceiling must be the budget the routing client
 * decrements, or it is a constant with no mechanism. Reserve-then-refund
 * rather than spend-then-record: a post-call write failure would leave
 * the stored count stale while the calls already happened, re-granting
 * spent allowance to the next card open. Read/written under the user
 * lock the run already holds.
 *
 * FAILS CLOSED: any Properties error -- read or write -- returns 0,
 * never a fresh allowance (Technical Design section 18.2).
 * Technical Design section 20.3.
 */
function reserveDiagnosticAllowance(now) {
  throw new Error('Not implemented: Technical Design section 20.3');
}

/**
 * REFUND half: returns the unspent remainder of the reservation, called
 * from the engine's finally -- a diagnostic that throws after its broker
 * calls still spent them, and the unspent grant should come back either
 * way. A throw HERE is caught by the engine and logged
 * (DIAGNOSTIC_SPEND_RECORD_FAILED) -- it must not replace the run's
 * result or strand the lock, and a lost refund is the SAFE side of the
 * reservation: the hour under-grants until the bucket rolls over, it
 * never over-spends. Technical Design section 20.3.
 */
function refundDiagnosticAllowance(unspentCount, now) {
  throw new Error('Not implemented: Technical Design section 20.3');
}
