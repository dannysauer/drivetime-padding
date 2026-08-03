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
