/**
 * Trigger and command entrypoints only. Technical Design section 3.1.
 *
 * Function names here are referenced by the manifest and by installed
 * triggers, so they are part of the deployed contract.
 */

function onPrimaryCalendarChanged() {
  const now = new Date();  // the handler is the clock boundary
  return runReconciliation({ reason: 'calendar-trigger', now });
}

function runScheduledReconciliation() {
  const now = new Date();  // the handler is the clock boundary
  const result = runReconciliation({ reason: 'daily-trigger', now });
  if (result.status === 'skipped') {
    // Another execution holds the user lock: the daily run itself waited
    // for tomorrow, and so does its repair (Technical Design 19.2's accepted residual).
    return result;
  }
  // The AUTOMATIC trigger-repair path (Technical Design 19.3): every daily firing
  // re-derives the maintenance hour from the user's current Calendar
  // time zone and replaces a daily trigger whose installed hour no
  // longer matches. After the run, so a repair failure never costs the
  // reconciliation; guarded, because ScriptApp trigger writes can throw
  // (quota, transient error) and the run's result is already persisted.
  // An unhealthy REPORT is logged too -- authorization and policy
  // failures are report fields, not throws (REQ-TRIGGER-007), and on
  // this path nothing else would ever see them -- but a merely
  // CONTENDED report is not a failure: nothing broke, the next path to
  // run repairs.
  try {
    const health = ensureTriggers(now);
    if (!health.healthy && !health.contended) {
      logWarning(ERROR_CODES.TRIGGER_REPAIR_FAILED, health);
    }
  } catch (repairError) {
    logWarning(ERROR_CODES.TRIGGER_REPAIR_FAILED, repairError);
  }
  return result;
}
