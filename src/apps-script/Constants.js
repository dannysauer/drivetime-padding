/**
 * Shared constants.
 *
 * Values here are decided, not placeholders. See docs/adrs/ for the reasoning
 * behind MAX_TRAVEL_MINUTES (0012), the route cache (0011), and quantization.
 */

// Settings bounds. Technical Design section 5.3.
const MIN_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 180;
const MAX_BUFFER_MINUTES = 120;

// Title-pattern backtracking safety (Technical Design 9.3, the one statement of
// the rules: an allowlist grammar plus these caps). Apps Script has no regex
// timeout and matching is synchronous, so a catastrophic pattern would kill
// every run ahead of the budget guards; the bounds below keep matching cost
// bounded for any pattern that passes validation and any title (a longer title
// does not match).
const MAX_TITLE_PATTERN_LENGTH = 200;
const MAX_TITLE_PATTERN_QUANTIFIERS = 2;
const MAX_TITLE_PATTERN_ALTERNATIONS = 3;
const MAX_TITLE_PATTERN_SUBJECT_CHARS = 128;

// Maximum supported one-way travel. ADR 0012, REQ-TIME-012.
// Also bounds the observation range, so raising it widens every read.
const MAX_TRAVEL_MINUTES = 360;

// Longest timed source event we will plan. ADR 0012, REQ-TIME-014.
// Bounds how far past planEnd a return block can land. Without it the
// observation range has no finite upper bound.
const MAX_SOURCE_DURATION_MINUTES = 1440;

// Furthest a companion event can sit from its source, in either direction.
// Derived, not chosen. Technical Design section 7.2.
const COMPANION_SPAN_MINUTES = MAX_TRAVEL_MINUTES + MAX_BUFFER_MINUTES;
const RECONCILIATION_LOOKBACK_MINUTES = COMPANION_SPAN_MINUTES;

// How far the observation range extends past the planning range at EACH end.
// Symmetric, because a long source event can reach backward past planStart
// just as it can reach forward past planEnd.
const OBSERVE_MARGIN_MINUTES =
  MAX_SOURCE_DURATION_MINUTES + COMPANION_SPAN_MINUTES;

// Route plan cache. ADR 0011, Technical Design section 13.3.
const ROUTE_CACHE_MAX_AGE_HOURS = 24;
const ROUTE_GRANULARITY_SECONDS = 300;
const MAX_ROUTE_CALLS_PER_RUN = 60;
const MAX_CONSECUTIVE_CONTINUATIONS = 10;
const DIAGNOSTIC_ROUTE_CALLS_PER_HOUR = 20;

// The daily maintenance hour in the USER's Calendar time zone
// (REQ-TIME-013). Converted to a UTC hour per user -- the project time
// zone is Etc/UTC -- at install, and RE-DERIVED at every daily firing
// for the NEXT firing's offset, so a daylight-saving transition or a Calendar
// time-zone change realigns the trigger within one cycle without user
// action. Technical Design section 19.2.
const DAILY_LOCAL_HOUR = 3;

// Manual sync enqueues a one-off trigger rather than running inline in the
// card callback. Technical Design section 19.5.
const MANUAL_RUN_DELAY_MS = 1000;
// Serializes the pending-check-and-create against concurrent clicks. Held
// for milliseconds; a failed wait means a reconciliation run holds the
// lock, and the enqueue falls through unserialized (the handler collapses
// any resulting duplicates). Technical Design section 19.5.
const MANUAL_ENQUEUE_LOCK_MS = 2000;

// Partial runs schedule their own continuation. Technical Design 19.6/23.4.
const CONTINUATION_DELAY_MS = 5 * 60000;

// Conservative execution threshold the budget guards measure against:
// Apps Script hard-kills executions at 6 minutes, and the margin below
// it is what lets status persistence, continuation scheduling, and lock
// release run even on a run that used its whole budget. Technical
// Design 23.1.
const EXECUTION_BUDGET_MS = 4.5 * 60000;
// Bulk listings (window and shrink) stop at this fraction of
// EXECUTION_BUDGET_MS so planning and application keep headroom -- a
// read guarded by the full threshold returns with the same check
// already true, and everything it retrieved is marked failed and never
// applied. Deliberately coarse: it only guarantees later-phase
// headroom; applyDiff's between-operations checks handle a diff too
// large for the remainder. Technical Design 23.1.
const READ_BUDGET_FRACTION = 0.5;
// Planning stops STARTING new sources at this fraction (the remainder
// is marked EXECUTION_BUDGET_EXCEEDED, which preserves companions):
// route calls run seconds each, and a planning loop on the full
// threshold would burn straight through the evidence tier below.
// Technical Design 23.1.
const PLANNING_BUDGET_FRACTION = 0.75;
// Absence-evidence passes (15.2.7 restoration lookups, 15.2.3 orphan
// point reads, 15.2.8 daily sweep, 15.2.10 suppressed-role lookups --
// run order, suppressed-role LAST) stop at this later fraction. Each
// earlier phase stops short of the next tier's mark, so no phase
// starves its successors AS LONG AS PHASES RUN IN TIER ORDER -- and
// phases sharing a tier need their own ordering argument: the bulk
// reads run unresumable-but-self-draining first (the shrink listing,
// which progresses only through its applied deletions, then the
// region-consuming window scan, which resumes by cursor and loses
// nothing by running second), the evidence passes self-draining first
// and bounded-but-non-draining last (restoration lookups, then the
// orphan point reads on incomplete scans, then the daily sweep on
// complete daily scans, then the suppressed-role lookups LAST -- their
// chronic population never drains and ahead of the sweep would starve
// it permanently, while their own deferred work drains through the
// sweep-less continuation; deferral behind a self-draining
// predecessor is transient,
// a starved bulk read's is not). A same-threshold guard behind a phase that
// consumes the region every run is the failure mode throughout: zero
// reads, every absence-gated operation suppressed, on every slice,
// forever. Application keeps the final tenth plus applyDiff's
// between-operations deferral and the margin below the platform's
// hard kill. Technical Design 23.1.
const EVIDENCE_BUDGET_FRACTION = 0.9;

// Remove-all cleanup runs as budget-bounded worker passes, never inside the
// card callback. Lock-contention retries are bounded separately from
// working passes -- counting them together would let zero-work retries
// exhaust the cap; counting neither would re-enqueue forever. Technical
// Design section 19.4.
const MAX_REMOVAL_PASSES = 20;
const MAX_REMOVAL_CONTENTION_RETRIES = 10;
// Liveness threshold for the cleanup status card: a `running` record
// with no pending worker trigger is failed only when the FRESHEST
// liveness stamp -- the record's updatedAt or the lockless heartbeat's
// `at`, whichever is newer -- is older than this. The contention cap
// surfaces through the same rule (a capped worker stops re-enqueueing
// AND stamping, so staleness follows within minutes; the retained
// retries count labels that failure as contention, never overrides a
// fresh stamp -- the lockless count can be raced stale over a live
// pass's reset). An EXECUTING pass has already deleted
// its own trigger (collapse rule) and holds the user lock, so trigger
// absence alone would misreport every live pass. The 6-minute platform
// hard kill plus scheduling slack: a live pass re-stamps within one
// budget; a dead one crosses this within minutes. Technical Design
// section 19.4.
const REMOVAL_STALE_AFTER_MS = 10 * 60000;

// How far the daily orphan sweep's anchor band reaches behind planStart
// (together with MAX_SOURCE_DURATION; the band's upper bound is now +
// MAX_WINDOW_DAYS + the duration cap -- the maximal horizon, so a window
// shrink cannot hide a stray): two daily cycles, so an outbound anchor is
// not out-run by planStart's advance before the next firing, even with
// one missed run. Technical Design section 15.2.8.
const SWEEP_DISCOVERY_SLACK_MINUTES = 2880;
// updatedMin bound for the sweep's listing: a stray was necessarily MOVED,
// and a move bumps `updated`, so the sweep only lists recently-touched
// events -- the discovery slack plus one daily cycle. The persisted
// watermark below stretches both this bound and the anchor band over any
// gap of skipped or incomplete sweeps.
const SWEEP_UPDATED_LOOKBACK_MINUTES = SWEEP_DISCOVERY_SLACK_MINUTES + 1440;

// Storage keys.
const SETTINGS_KEY = 'dtp.settings';
const LAST_RUN_KEY = 'dtp.lastRun';
// NOTE: manual-run pendingness is derived from ScriptApp.getProjectTriggers()
// rather than stored -- a persisted flag with no failure-path clear would
// brick the button after one crashed run. Technical Design section 19.5.
// Furthest observeEnd ever used. Drives cleanup when windowDays shrinks.
const OBSERVE_HIGH_WATER_KEY = 'dtp.observeHighWater';
// Consecutive-continuation counter. Incremented by the ENGINE, under the
// user lock, before substantive work (a handler-side increment races the
// reset a concurrent successful run performs -- Technical Design 19.6);
// reset to 0 by any successful non-dry run, enforced at enqueue time.
// Unlike trigger pendingness this cannot be derived -- it must survive runs.
const CONTINUATION_COUNT_KEY = 'dtp.continuationCount';
// Hour-bucketed diagnostic broker spend: { bucket, used }. Read and written
// under the user lock; feeds the RouteBudget when reason is
// event-diagnostic. Reserve-then-refund: the whole remaining allowance
// is written as used BEFORE any broker call and the unspent remainder
// refunded in the engine's finally, so neither a failed reservation
// (grants 0) nor a failed refund (under-grants for the hour) can exceed
// the ceiling. Technical Design section 20.3.
const DIAGNOSTIC_SPEND_KEY = 'dtp.diagnosticRouteSpend';
// Remove-all cleanup progress: survives the worker's re-enqueues and feeds
// the home card's status surface. Written ONLY under the user lock --
// lockless writers use the heartbeat below, or a stale read-modify-write
// could clobber a concurrent pass's fold or revert a terminal record.
// Technical Design section 19.4.
const REMOVAL_PROGRESS_KEY = 'dtp.removalProgress';
// Lockless side channel { at, contentionRetries }: worker entry stamps
// `at` before the lock wait, contention re-enqueues increment the
// retries, a lock-winning pass resets both. The card's liveness rule
// reads the freshest of this and the record's updatedAt, and derives
// the contention-cap failure from the retries -- the lockless path
// never writes state. Technical Design section 19.4.
const REMOVAL_HEARTBEAT_KEY = 'dtp.removalHeartbeat';
// Injected `now` of the last sweep whose listing and window scan were both
// complete. Stretches the sweep's updatedMin bound and anchor band over
// gaps of skipped or incomplete sweeps. Technical Design section 15.2.8.
const SWEEP_COMPLETED_AT_KEY = 'dtp.sweepCompletedAt';
// Resumable window-scan cursor: { pageToken, observeStart, observeEnd,
// pivot } -- pageToken an opaque repository resume token (segment plus
// Calendar page token), pivot the chain's `now`, where the ordered
// forward and backward listing segments split (7.2.1).
// Saved when a truncated non-dry scan STARTS or ADVANCES a chain (a
// fresh truncated run never overwrites a pending cursor -- the chain
// owns it); resumed by continuation AND daily runs, PINNED to the stored
// range; cleared by chain completion, a fresh COMPLETE non-dry scan, and
// remove-all; dry runs never touch it. Without it a calendar too large
// for one execution budget makes every continuation re-read the same
// prefix until the cap. Technical Design section 7.2.1.
const WINDOW_SCAN_CURSOR_KEY = 'dtp.windowScanCursor';
// Installed daily trigger record: { utcHour, triggerUid }. ScriptApp
// does not expose an installed trigger's hour, so without the record
// repair could not tell a correctly scheduled daily trigger from one
// left stale by a DST transition or time-zone change -- it would have
// to replace it on every pass; the unique id is what tells the
// installed trigger from a stale or duplicate one, which are otherwise
// indistinguishable. Technical Design sections 19.2, 19.3.
const DAILY_TRIGGER_KEY = 'dtp.dailyTrigger';
const CURRENT_SETTINGS_SCHEMA = 1;

// Generated-event metadata. ADR 0009 -- this property is the deletion-safety
// boundary. Never identify a managed event by title.
const GENERATED_FLAG_KEY = 'dtp';
const GENERATED_FLAG_VALUE = '1';
