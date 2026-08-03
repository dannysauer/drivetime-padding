/**
 * Trigger and command entrypoints only. Technical Design section 3.1.
 *
 * Function names here are referenced by the manifest and by installed
 * triggers, so they are part of the deployed contract.
 */

function onPrimaryCalendarChanged() {
  return runReconciliation({ reason: 'calendar-trigger' });
}

function runScheduledReconciliation() {
  return runReconciliation({ reason: 'daily-trigger' });
}
