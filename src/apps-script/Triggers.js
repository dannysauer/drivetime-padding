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
 * (REQ-RECON-011). Technical Design section 19.5.
 */
function runManualReconciliation(e) {
  throw new Error('Not implemented: Technical Design section 19.5');
}
