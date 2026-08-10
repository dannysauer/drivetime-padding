/**
 * Install, inspect, deduplicate, and repair triggers.
 *
 * BLOCKED ON PROTOTYPE SPIKE 1. Whether a Marketplace-installed Workspace
 * Add-on can create installable Calendar triggers at all is unvalidated.
 * See docs/open-questions.md before implementing against this file.
 *
 * Note also that ScriptApp time-based triggers resolve atHour() against the
 * script project timezone, which the manifest sets to Etc/UTC. The daily hour
 * must be converted from the user's Calendar timezone at install time.
 * Technical Design section 19.2.
 */

function ensureTriggers() {
  throw new Error('Not implemented: blocked on Prototype Spike 1');
}

/**
 * Card action behind "Remove all generated events and disable automation".
 * Does only bounded work: under the user lock it persists enabled=false,
 * removes the reconciliation triggers, initializes the progress record,
 * and enqueues runRemovalCleanup. The unbounded scan-and-delete must NOT
 * run here -- card callbacks share the short execution budget that forced
 * manual sync to enqueue, and this action's work grows with the user's
 * entire history. Technical Design section 19.4.
 */
function removeAutomation() {
  throw new Error('Not implemented: Technical Design section 19.4');
}

/**
 * One-off trigger handler behind remove-all cleanup. Collapses its pending
 * triggers, takes the user lock (re-enqueues on contention, bounded by
 * MAX_REMOVAL_CONTENTION_RETRIES -- contention does not burn working
 * passes), aborts if the user re-enabled between passes, then deletes
 * scanned events until the execution budget nears -- folding counts into
 * dtp.removalProgress and re-enqueueing until the scan completes (capped
 * at MAX_REMOVAL_PASSES). Only a pass that finishes with zero failures
 * re-checks enabled one last time, clears stored state, and writes the
 * settings tombstone (REQ-PRIV-006). Technical Design 19.4.
 */
function runRemovalCleanup(e) {
  throw new Error('Not implemented: Technical Design section 19.4');
}

/**
 * One-off trigger handler behind the "Synchronize now" card action. Deletes
 * EVERY pending trigger for this handler -- its own plus any duplicate that
 * slipped past the lock-serialized enqueue check while a run held the user
 * lock -- then runs the shared engine with reason 'manual' (REQ-RECON-011).
 * On a lock-contention skip it re-enqueues: the user was told
 * "Synchronization started" and the pending trigger is already deleted --
 * dropping the run here silently breaks that promise.
 * Technical Design section 19.5.
 */
function runManualReconciliation(e) {
  throw new Error('Not implemented: Technical Design section 19.5');
}

/**
 * One-off trigger handler behind partial-run continuations. Deletes every
 * pending trigger for this handler (same collapse rule as manual sync),
 * then runs the shared engine. The counter increment lives in the ENGINE,
 * under the user lock, before substantive work -- a handler-side increment
 * races the reset a concurrent successful run performs. A lock-contention
 * skip never reached the counter, so the handler just re-enqueues; the
 * counter resets to 0 on any successful non-dry run; the cap is enforced
 * at enqueue time. Technical Design section 19.6.
 */
function runContinuationReconciliation(e) {
  throw new Error('Not implemented: Technical Design section 19.6');
}
