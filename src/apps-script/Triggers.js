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

function removeAutomation() {
  throw new Error('Not implemented: Technical Design section 19.4');
}

/**
 * One-off trigger handler behind the "Synchronize now" card action. Deletes
 * its own trigger, then runs the shared engine with reason 'manual'
 * (REQ-RECON-011). On a lock-contention skip it re-enqueues: the user was
 * told "Synchronization started" and the pending trigger is already
 * deleted -- dropping the run here silently breaks that promise.
 * Technical Design section 19.5.
 */
function runManualReconciliation(e) {
  throw new Error('Not implemented: Technical Design section 19.5');
}

/**
 * One-off trigger handler behind partial-run continuations. Deletes its
 * own trigger, then runs the shared engine. The counter increment lives
 * in the ENGINE, under the user lock, before substantive work -- a
 * handler-side increment races the reset a concurrent successful run
 * performs. A lock-contention skip never reached the counter, so the
 * handler just re-enqueues; the counter resets to 0 on any successful
 * non-dry run; the cap is enforced at enqueue time. Technical Design
 * section 19.6.
 */
function runContinuationReconciliation(e) {
  throw new Error('Not implemented: Technical Design section 19.6');
}
