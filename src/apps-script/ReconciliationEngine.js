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

/**
 * Two ranges, not one. ADR 0012, Technical Design section 7.2.
 *
 * Plan range decides which sources are evaluated; observe range decides which
 * generated events are read. The observe range must be wider, because
 * companions fall outside their source's own span and Events.list bounds
 * timeMin on end time but timeMax on start time -- so a single window leaks
 * at both edges and duplicates get created on every run.
 */
function calculateWindow(windowDays, now) {
  const planStart = now.getTime() - RECONCILIATION_LOOKBACK_MINUTES * 60000;
  const planEnd = now.getTime() + windowDays * 86400000;

  return {
    planStart: new Date(planStart),
    planEnd: new Date(planEnd),
    observeStart: new Date(planStart - COMPANION_SPAN_MINUTES * 60000),
    observeEnd: new Date(
      planEnd + (MAX_SOURCE_DURATION_MINUTES + COMPANION_SPAN_MINUTES) * 60000
    ),
  };
}

/**
 * A matching fingerprint means the DESIRED state is unchanged. It does not
 * mean the OBSERVED event still matches it -- Calendar preserves private
 * metadata when a user drags or renames an event, so the stored fingerprint
 * survives the tampering it would need to detect.
 *
 * Technical Design section 15.2.1, REQ-GEN-014a.
 */
function ownedFieldsMatch_(observed, desired) {
  throw new Error('Not implemented: Technical Design section 15.2.1');
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
