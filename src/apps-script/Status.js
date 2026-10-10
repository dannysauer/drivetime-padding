/**
 * Last-run persistence and user diagnostics. Technical Design section 20.
 *
 * Stores counts and opaque identifiers only. No addresses, titles, or
 * descriptions (route-data-minimization ADR).
 */

/**
 * Persists the compact 20.2 record: status, timestamps, the run's reason
 * (result.reason, 17.2 -- set by EVERY builder from options.reason, so
 * status-only and failure results carry it; null when absent), the run's
 * correlationId (result.correlationId, REQ-OBS-004), the run summary
 * (result.summary -- the source/eligible/planned/ignored/failed counts,
 * REQ-OBS-002; zero counts when null), the seven APPLIED counts (zero
 * when result.applied is null -- never dereferenced), errorCounts and
 * errors, and the partial run's continuation DISPOSITION.
 *
 * errorCounts SUMS (rec.occurrences ?? 1) per code over EVERY record in
 * result.errors -- never assigns: only failed planning outcomes arrive
 * aggregated (17.4); apply failures arrive one record each (17.5), and
 * one code can appear both ways. Keys are distinct registry codes, so
 * the map is bounded by the registry; the card names what a notUseful
 * partial waits on from it. errors is the total occurrence count, the
 * sum of errorCounts' values -- not the number of records.
 * result.validationErrors (17.2) is NOT persisted: a settings-gate
 * failure stores INVALID_SETTINGS: 1 and the field list stays with the
 * returned result.
 *
 * The last-run record is the only run record; there is no last-success
 * timestamp, so the home card's "Last sync" line is this record's
 * status and completedAt, whatever the status (20.2).
 *
 * The disposition is copied from diagnostics.continuation, which the
 * engine sets at the enqueue site ("scheduled", "capReached",
 * "enqueueFailed", "notUseful"), COALESCED TO NULL when absent -- 4.11
 * leaves the field undefined on non-partial runs, and JSON serialization
 * would drop the key where 20.2 promises an explicit null. It must
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
 * Shrink high-water mark (OBSERVE_HIGH_WATER_KEY): the furthest observeEnd ever
 * used. User Properties, engine policy -- NOT in CalendarRepository, so
 * repository fakes carry no Properties state. The load returns null ONLY
 * for a positively absent or malformed mark; a Properties READ FAILURE
 * throws (run-wide -- a null would take the advance branch and overwrite
 * a wider stored horizon, stranding the vacated range). The
 * CONSUMER hardens the value -- findStrandedCompanions reads it through
 * parseInstantOrNull (8.1) and treats an absent or unparseable mark as absent,
 * so its advance branch overwrites a corrupt key with a valid one. The engine
 * lowers the mark only after applyDiff confirms every stranded event resolved
 * on a complete, non-dry cleanup scan.
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
 * Window-scan cursor (WINDOW_SCAN_CURSOR_KEY): { pageToken, observeStart,
 * observeEnd, pivot, holds }, pinned to the range and segment split that
 * produced it; pageToken is the repository's opaque resume token, never
 * read here; the three
 * instants are SAVED as ISO strings (Date#toISOString -- epoch numbers would
 * read as malformed on every load and re-scan from page one) and rehydrated as
 * Dates (parseInstantOrNull, 8.1, then new Date(ms)) -- Properties round-trips
 * strings, and a string pivot compared against a Date end would coerce to NaN
 * and silently empty the backward segment. holds is the drain gate's
 * consecutive-hold count for this position (7.2.1, MAX_SLICE_HOLDS):
 * absent loads as 0 (a cursor saved before the field existed); present
 * but not a non-negative integer makes the cursor malformed.
 * The load NEVER THROWS and validates the stored shape -- absent,
 * malformed (unparseable or out-of-order instants included -- anything
 * but observeStart < pivot < observeEnd would pin the chain to a
 * listing Calendar rejects, retained forever), or unreadable cursors
 * return null, degrading to a fresh
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
 * message, and stack are read explicitly rather than serialized. Both
 * 18.1 flags are rendered -- continuable is what decides a notUseful
 * disposition, so a log that showed only retryable would mislead -- and
 * `details` is serialized: it is the one place an offending value (an
 * unreadable timestamp, 8.2) reaches a human, the card being reason-only.
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
  if (typeof record.continuable === 'boolean') {
    parts.push('(continuable: ' + record.continuable + ')');
  }
  if (record.details && typeof record.details === 'object') {
    parts.push('details=' + safeJson_(record.details));  // 18.1: the offending values
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

/**
 * Suppressed-role lookup rotation entries (SUPPRESSED_LOOKUP_RESUME_KEY):
 * an array of [point, origin] pairs, most recent first, at most
 * SUPPRESSED_LOOKUP_RESUME_MAX -- point a parent id, origin the
 * population's cycle state: a parent id or '' while the cycle is open,
 * null once it closed. [] when none is stored or the stored value is
 * malformed (any entry not of that shape). One entry per POPULATION,
 * not one global point: on a chain each 15.2.10 pass sees one slice's
 * population, and a single value would be overwritten or cleared by
 * other slices' passes. The engine passes the list to
 * resolveSuppressedRoleCompanions as resumePoints -- on a daily run with
 * every entry reopened (origin set to its point), so a chronic
 * population drives at most one cycle of continuations a day -- and
 * saves the pass's returned resumePoints post-apply only when nothing
 * was deferred -- unchanged when the guard cut the pass off before any
 * lookup completed; dry runs never write. The save truncates to the
 * cap, oldest dropped; [] clears. Remove-all's fully-successful
 * terminal clears it too (19.4).
 * Technical Design section 15.2.10.
 */
function loadSuppressedLookupResume() {
  throw new Error('Not implemented: Technical Design section 15.2.10');
}

function saveSuppressedLookupResume(resumePoints) {
  throw new Error('Not implemented: Technical Design section 15.2.10');
}

/**
 * Overlong-lookup clean list (OVERLONG_LOOKUP_CLEAN_KEY): [parentId,
 * etag] pairs, most recent first, at most
 * OVERLONG_LOOKUP_CLEAN_MAX_ENTRIES; [] when none is stored, the
 * stored value is malformed, or the read throws (a lost list costs
 * repeated lookups, never a missed one). The engine records a source
 * whose 15.2.6 lookup returned nothing but preserved records at its
 * NormalizedEvent
 * rawEtag, removes a source whose lookup returned anything else, and
 * saves post-apply -- whether or not application ran, since an entry
 * asserts only what a lookup read -- non-dry only, guarded
 * (BOOKKEEPING_PERSIST_FAILED). A complete scan drops the entries whose
 * parent its listing did not return; the save truncates to the cap,
 * oldest dropped. Remove-all's fully-successful terminal clears it
 * (19.4). Technical Design section 15.2.6.
 */
function loadOverlongLookupClean() {
  throw new Error('Not implemented: Technical Design section 15.2.6');
}

function saveOverlongLookupClean(entries) {
  throw new Error('Not implemented: Technical Design section 15.2.6');
}
