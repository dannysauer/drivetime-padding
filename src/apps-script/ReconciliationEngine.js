/**
 * End-to-end orchestration and diff application.
 * Architecture section 14, Technical Design section 17.
 *
 * Two invariants worth restating here because violating either is destructive:
 *
 *   1. Only events carrying dtp === '1' may be deleted (ADR 0009).
 *   2. A source event whose planning FAILED must keep its existing generated
 *      events. Deletion authority applies only to 'planned' and 'ineligible'
 *      outcomes (Technical Design section 17.4). A broker outage must never
 *      erase a user's travel blocks.
 */

function runReconciliation(options) {
  throw new Error('Not implemented: Technical Design section 17');
}

/** Window spans the lookback as well as the forward horizon. ADR 0012. */
function calculateWindow(windowDays, now) {
  return {
    start: new Date(now.getTime() - RECONCILIATION_LOOKBACK_MINUTES * 60000),
    end: new Date(now.getTime() + windowDays * 86400000),
  };
}

/**
 * Upcoming events first, then in-progress and lookback events.
 * Plain ascending order would spend the execution budget on the past.
 * Technical Design section 23.2.
 */
function orderForPlanning_(events, now) {
  throw new Error('Not implemented: Technical Design section 23.2');
}

function compareDesiredAndObserved(desiredSpecs, observedEvents, planningOutcomes) {
  throw new Error('Not implemented: Technical Design section 15');
}
