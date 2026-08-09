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

function buildEventCard() {
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
