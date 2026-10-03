/**
 * Stable application error codes. Technical Design section 18.
 *
 * ROUTE_TOO_LONG and ROUTE_BUDGET_EXCEEDED are planning failures, not
 * ineligibility: they must preserve existing generated events.
 *
 * Every registry entry -- registryEntry(code) below, the ONE place the
 * flags live -- carries two ORTHOGONAL flags (18.1, 18.2):
 * retryable (does the failure block success -- an unprocessed source
 * is retryable by definition, 17.4) and continuable (could another
 * pass in the same episode change it -- false for every deterministic
 * per-event failure and every write code; continuationStillUseful
 * reads it off each record instead of keeping a list of codes).
 * CALENDAR_EVENT_INVALID has one meaning and ONE producer: the 8.2
 * unreadable-timestamp branch. No repository throws it (a rejected
 * write is CALENDAR_WRITE_FAILED); retryable, not continuable.
 */

const ERROR_CODES = {
  INVALID_SETTINGS: 'INVALID_SETTINGS',
  MISSING_DEFAULT_ORIGIN: 'MISSING_DEFAULT_ORIGIN',
  INVALID_TITLE_PATTERN: 'INVALID_TITLE_PATTERN',

  CALENDAR_READ_FAILED: 'CALENDAR_READ_FAILED',
  CALENDAR_WRITE_FAILED: 'CALENDAR_WRITE_FAILED',
  CALENDAR_EVENT_INVALID: 'CALENDAR_EVENT_INVALID',
  // The re-read behind a conditional write found the marker gone: the
  // event is the user's now (ADR 0009). Apply failure, NOT retryable. A
  // VANISHED target is never this -- an ordinary CALENDAR_WRITE_FAILED
  // the next run converges past. Full rule: 16.5.1.
  OWNERSHIP_LOST: 'OWNERSHIP_LOST',
  // A conditional write was rejected (412) but the re-read found the
  // marker intact: stale snapshot of a block still managed. Apply
  // failure, RETRYABLE. A 412 alone is never ownership loss (16.5.1).
  CONCURRENT_EDIT: 'CONCURRENT_EDIT',

  INVALID_ORIGIN: 'INVALID_ORIGIN',
  INVALID_DESTINATION: 'INVALID_DESTINATION',
  NO_ROUTE: 'NO_ROUTE',
  ROUTE_TOO_LONG: 'ROUTE_TOO_LONG',
  BROKER_AUTH_FAILED: 'BROKER_AUTH_FAILED',
  BROKER_RATE_LIMITED: 'BROKER_RATE_LIMITED',
  BROKER_UNAVAILABLE: 'BROKER_UNAVAILABLE',
  BROKER_PROTOCOL_ERROR: 'BROKER_PROTOCOL_ERROR',

  LOCK_CONTENTION: 'LOCK_CONTENTION',
  EXECUTION_BUDGET_EXCEEDED: 'EXECUTION_BUDGET_EXCEEDED',
  ROUTE_BUDGET_EXCEEDED: 'ROUTE_BUDGET_EXCEEDED',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',

  // Non-fatal warnings: surface in ReconciliationDiagnostics.warnings
  // (Technical Design section 4.11), never fail the run.
  WORKING_LOCATION_UNAVAILABLE: 'WORKING_LOCATION_UNAVAILABLE',
  // Directive named an unconfigured home/office origin; resolution fell
  // back to default. Recorded by the engine, not the resolver (10.2).
  DIRECTIVE_ORIGIN_UNCONFIGURED: 'DIRECTIVE_ORIGIN_UNCONFIGURED',
  // The diagnostic-allowance REFUND threw in the engine finally; logged,
  // never rethrown -- accounting must not cost the run its result. Safe
  // by construction: the reservation was written before the first broker
  // call, so a lost refund under-grants until the hour bucket rolls
  // over, never over-spends (20.3).
  DIAGNOSTIC_SPEND_RECORD_FAILED: 'DIAGNOSTIC_SPEND_RECORD_FAILED',
  // saveRunStatus threw. EVERY persistence site is guarded -- success
  // path, error boundary, and both validation-gate branches; the code
  // joins the RETURNED result's warnings and is logged, never rethrown.
  // Guarding the success path keeps a Calendar-accepted run from being
  // stored as a false failure; guarding the gates keeps the
  // INVALID_SETTINGS result (and its reset guidance) from being replaced
  // by a generic persistence failure; guarding the boundary keeps its
  // return-a-result guarantee.
  STATUS_PERSIST_FAILED: 'STATUS_PERSIST_FAILED',
  // A bookkeeping write threw: shrink high-water mark, sweep watermark,
  // continuation-counter reset, or the window-scan cursor save/clear --
  // saves post-apply (committed at listing time they would skip an
  // unprocessed slice), clears also on an out-of-time skip and the
  // rejected dead token's eagerly at listing time (7.2.1). Guarded
  // because an escaping throw would falsify the run; losing each write
  // is safe by construction (re-scan, wider sweep, one episode's
  // allowance, a scan restarted from the front -- 18.2).
  BOOKKEEPING_PERSIST_FAILED: 'BOOKKEEPING_PERSIST_FAILED',
  // enqueueContinuation's trigger creation threw (per-user trigger quota,
  // transient ScriptApp error). Two guarded call sites, different
  // carriers (19.6): the engine's partial-run call keeps the truthful
  // applied result and joins its warnings -- an unguarded throw would
  // rebuild a Calendar-accepted run as a failure with an empty diff --
  // while the handler's skip-path re-enqueue is log-only: skipped
  // results are never persisted or rendered, so a warning on one would
  // reach nobody. Deferred work falls to the daily backstop
  // (REQ-TRIGGER-002).
  CONTINUATION_ENQUEUE_FAILED: 'CONTINUATION_ENQUEUE_FAILED',
  // The manual handler's skip-path re-enqueue threw (19.5) -- same
  // throwable trigger-creation API, guarded for the same reason.
  // Log-only: skipped results are never persisted or rendered, and
  // pendingness is derived from the trigger list, so the home card
  // honestly shows no run pending and the button invites a retry. The
  // card action's own enqueue stays unguarded on purpose -- it fails
  // synchronously in front of the user as the action's error response.
  MANUAL_ENQUEUE_FAILED: 'MANUAL_ENQUEUE_FAILED',
  // The daily handler's post-run ensureTriggers(now) threw, or returned
  // an unhealthy report that is not merely contended (19.2; authorization
  // and policy failures are report fields, not throws, REQ-TRIGGER-007;
  // contention is not a failure and logs nothing) -- the automatic repair
  // path that realigns a daily trigger left stale by a DST transition
  // or time-zone change. Log-only: the run's result is
  // already persisted and must not be rewritten over a trigger-write
  // failure; the next daily firing retries, and homepage open and
  // settings save remain the manual repair paths (19.3).
  TRIGGER_REPAIR_FAILED: 'TRIGGER_REPAIR_FAILED',
};

/**
 * The registry entry for a code (Technical Design 18.1, 18.2):
 * { message, retryable, continuable }. buildAppError copies all three
 * onto the AppErrorRecord; continuationStillUseful reads `continuable`
 * off each failure and failed outcome. ERROR_CODES above is the string
 * map; this is where the per-code attributes live, so a flag changes
 * in one place.
 */
function registryEntry(code) {
  throw new Error('Not implemented: Technical Design section 18.2');
}
