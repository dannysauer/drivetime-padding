/**
 * Last-run persistence and user diagnostics. Technical Design section 20.
 *
 * Stores counts and opaque identifiers only. No addresses, titles, or
 * descriptions (ADR 0010).
 */

/**
 * Persists the compact 20.2 record: status, timestamps, reason, the
 * seven APPLIED counts (zero when result.applied is null -- never
 * dereferenced), the error count, and the partial run's continuation
 * DISPOSITION copied from diagnostics.continuation, which the engine
 * sets at the enqueue site ("scheduled", "capReached", "enqueueFailed",
 * "notUseful"), COALESCED TO NULL when absent -- 4.11 leaves the field
 * undefined on non-partial runs, and JSON serialization would drop the
 * key where 20.2 promises an explicit null. It must
 * survive here because the trigger handler's return value is discarded,
 * and a bare boolean -- or a disposition derived from one at persist
 * time -- would have the home card promise a continuation that will
 * never fire (19.6, 20.2). Called only through saveRunStatusGuarded
 * (18.2).
 */
function saveRunStatus(result) {
  throw new Error('Not implemented: Technical Design section 20.2');
}

function loadRunStatus() {
  throw new Error('Not implemented: Technical Design section 20.2');
}

/**
 * RESERVE half of the hourly diagnostic route allowance
 * (DIAGNOSTIC_ROUTE_CALLS_PER_HOUR), backed by an hour-bucketed counter
 * under DIAGNOSTIC_SPEND_KEY. Called by the engine BEFORE any broker
 * call: writes the whole remaining allowance as used and returns the
 * grant, which feeds the run's RouteBudget when reason is
 * event-diagnostic -- the ceiling must be the budget the routing client
 * decrements, or it is a constant with no mechanism. Reserve-then-refund
 * rather than spend-then-record: a post-call write failure would leave
 * the stored count stale while the calls already happened, re-granting
 * spent allowance to the next card open. Read/written under the user
 * lock the run already holds.
 *
 * FAILS CLOSED: any Properties error -- read or write -- returns 0,
 * never a fresh allowance (Technical Design section 18.2).
 * Technical Design section 20.3.
 */
function reserveDiagnosticAllowance(now) {
  throw new Error('Not implemented: Technical Design section 20.3');
}

/**
 * REFUND half: returns the unspent remainder of the reservation, called
 * from the engine's finally -- a diagnostic that throws after its broker
 * calls still spent them, and the unspent grant should come back either
 * way. A throw HERE is caught by the engine and logged
 * (DIAGNOSTIC_SPEND_RECORD_FAILED) -- it must not replace the run's
 * result or strand the lock, and a lost refund is the SAFE side of the
 * reservation: the hour under-grants until the bucket rolls over, it
 * never over-spends. Technical Design section 20.3.
 */
function refundDiagnosticAllowance(unspentCount, now) {
  throw new Error('Not implemented: Technical Design section 20.3');
}

/**
 * Shrink high-water mark (OBSERVE_HIGH_WATER_KEY): the furthest
 * observeEnd ever used. User Properties, engine policy -- NOT in
 * CalendarRepository, so repository fakes carry no Properties state.
 * The load never throws; the CONSUMER hardens the value --
 * findStrandedCompanions treats an absent or unparseable mark as
 * absent, so its advance branch overwrites a corrupt key with a valid
 * one. The engine lowers the mark only after applyDiff confirms every
 * stranded event resolved on a complete, non-dry cleanup scan.
 * Technical Design section 7.6.
 */
function loadHighWater() {
  throw new Error('Not implemented: Technical Design section 7.6');
}

function saveHighWater(observeEnd) {
  throw new Error('Not implemented: Technical Design section 7.6');
}

/**
 * Sweep watermark (SWEEP_COMPLETED_AT_KEY): the injected `now` of the
 * last sweep whose listing and window scan both completed, written by
 * the engine only after applyDiff confirms deletedAll(sweep.events) --
 * application-gated like the high-water mark, because continuations
 * cannot re-run the daily-gated sweep. Technical Design section 15.2.8.
 */
function loadSweepWatermark() {
  throw new Error('Not implemented: Technical Design section 15.2.8');
}

function saveSweepWatermark(now) {
  throw new Error('Not implemented: Technical Design section 15.2.8');
}

/**
 * Window-scan cursor (WINDOW_SCAN_CURSOR_KEY): { pageToken,
 * observeStart, observeEnd, pivot }, pinned to the range and segment
 * split that produced it; pageToken is the repository's opaque resume
 * token, never read here.
 * The load NEVER THROWS and validates the stored shape -- absent,
 * malformed, or unreadable cursors return null, degrading to a fresh
 * scan, never a failed run (AC-RECOVERY-017). WHEN to save or clear is
 * engine policy (saves application-gated, clears also on an
 * out-of-time skip, the rejected dead token's clear eager at listing
 * time); these are the storage primitives only. Technical Design
 * section 7.2.1.
 */
function loadWindowScanCursor() {
  throw new Error('Not implemented: Technical Design section 7.2.1');
}

function saveWindowScanCursor(cursor) {
  throw new Error('Not implemented: Technical Design section 7.2.1');
}

function clearWindowScanCursor() {
  throw new Error('Not implemented: Technical Design section 7.2.1');
}

/**
 * Installed daily trigger record (DAILY_TRIGGER_KEY): { utcHour,
 * triggerUid }. Written by ensureTriggers right after it creates the
 * daily trigger (before it deletes the others, so a repair pass never
 * leaves the record pointing at a trigger it just deleted); CLEARED by
 * the disabled branch of repair and by remove-all when they delete the
 * daily trigger, so a dangling record arises only from a crash, which
 * the next pass reads as a mismatch. Read by repair to identify the
 * installed trigger and decide whether its hour is stale. The load
 * never throws -- an absent or malformed record reads as null, which
 * repair treats as a mismatch (replace), the safe direction.
 * Technical Design sections 19.2, 19.3.
 */
function loadDailyTriggerRecord() {
  throw new Error('Not implemented: Technical Design section 19.3');
}

function saveDailyTriggerRecord(record) {
  throw new Error('Not implemented: Technical Design section 19.3');
}

/**
 * Console/log-only diagnostic for failures that occur after a run's
 * result is built -- the finally-block spend refund (20.3), the daily
 * handler's post-run trigger repair (19.2). `detail` is an Error, an
 * AppErrorRecord, or a TriggerHealth report. The line carries the
 * record's [code], message, and retryability (an operator must be able
 * to tell a transient quota failure from a permanent authorization
 * one, REQ-TRIGGER-007), plus -- for a report -- its own state fields
 * (which trigger was left unrepaired), since on the automatic daily
 * path this line is the only surface they ever reach. NEVER throws:
 * every caller is a guard whose whole purpose is to keep a secondary
 * failure from replacing a primary result, so even a failure to
 * describe the detail still logs the code. Technical Design 18.2.
 */
function logWarning(code, detail) {
  try {
    console.warn(code + ': ' + describeWarningDetail_(detail));
  } catch (describeError) {
    console.warn(code);  // the detail could not be described; the code still logs
  }
}

/**
 * One-line description of a logWarning detail. A TriggerHealth report
 * nests its AppErrorRecord under `error`; an Error or AppErrorRecord IS
 * the record. Error's own properties are non-enumerable, so name,
 * message, and stack are read explicitly rather than serialized.
 */
function describeWarningDetail_(detail) {
  if (!detail || typeof detail !== 'object') {
    return String(detail);
  }
  const record = detail.error && typeof detail.error === 'object'
    ? detail.error
    : detail;
  const parts = [];
  if (record.code) parts.push('[' + record.code + ']');
  if (record.name && !record.code) parts.push(record.name);
  if (record.message) parts.push(record.message);
  if (typeof record.retryable === 'boolean') {
    parts.push('(retryable: ' + record.retryable + ')');
  }
  if (record !== detail) {
    const state = {};
    Object.keys(detail).forEach(function (key) {
      if (key !== 'error') state[key] = detail[key];
    });
    parts.push(safeJson_(state));
  } else if (parts.length === 0) {
    parts.push(safeJson_(detail));
  }
  let text = parts.join(' ');
  if (record.stack) text += '\n' + record.stack;
  return text;
}

function safeJson_(value) {
  try {
    return JSON.stringify(value);
  } catch (serializeError) {
    return String(value);  // cyclic graph, BigInt, throwing toJSON
  }
}
