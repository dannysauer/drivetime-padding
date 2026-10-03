/**
 * Eligibility decisions and stable reason codes. Technical Design section 9.
 *
 * Evaluation order matters: diagnostics should surface the most useful reason,
 * not merely the first failing condition.
 *
 * Steps 1-4 (disabled, generated, cancelled, all-day) must read NO
 * timestamps -- a cancelled tombstone may carry neither start nor end,
 * and an all-day event is rejected on isAllDay alone, so one whose date
 * could not be read still lands at step 4 (Technical Design 9.2).
 *
 * OOO acceptance is gated on settings.eligibility.includeOutOfOffice. A
 * settings field no step consults is not a setting, it is a control that
 * silently does nothing. Technical Design section 9.2, REQ-ELIG-001.
 *
 * Pattern matching uses event.summary (raw), never displaySummary; the
 * subject bound and TITLE_TOO_LONG are stated once, at compileTitleMatcher
 * below and in Technical Design 9.2/9.3.
 */

/**
 * The title pattern compiled ONCE per run, after validateSettings
 * passed it (Technical Design 9.1, 9.3): { test(summary) -> boolean },
 * a bound-free regex test whose ONE caller is evaluateEligibility's
 * step 11, which checks the subject bound first and reports
 * TITLE_TOO_LONG -- the bound has one owner, so inclusive-vs-strict or
 * code-unit-vs-code-point can never drift between two checks; null
 * when the pattern is disabled -- but enabledness is the SETTING, not
 * this nullness: titlePatternEnabled && !titleMatcher at evaluation is
 * a programming error that throws into containment, never a silent
 * TITLE_PATTERN_DISABLED (which would delete the pattern's companions).
 * The
 * engine calls this and hands the result to every evaluateEligibility
 * call, so evaluation never compiles, never caches in module state,
 * and never meets an unvalidated pattern.
 */
function compileTitleMatcher(settings) {
  throw new Error('Not implemented: Technical Design section 9.3');
}

/**
 * The Technical Design 4.5 EligibilityReason enum as DATA, verbatim and
 * in order; the event card renders exhaustively over it (17.1).
 */
const ELIGIBILITY_REASONS = Object.freeze([
  'ELIGIBLE_OUT_OF_OFFICE',
  'ELIGIBLE_TITLE_PATTERN',
  'DISABLED_GLOBALLY',
  'GENERATED_EVENT',
  'ALL_DAY_EVENT',
  'CANCELLED_EVENT',
  'MISSING_LOCATION',
  'DISABLED_BY_DIRECTIVE',
  'UNSUPPORTED_EVENT_TYPE',
  'SOURCE_TOO_LONG',
  'OUT_OF_OFFICE_DISABLED',
  'TITLE_PATTERN_DISABLED',
  'TITLE_PATTERN_NO_MATCH',
  'TITLE_TOO_LONG',
  'OUTSIDE_WINDOW',
  'CALENDAR_EVENT_INVALID',
  'EVENT_NOT_FOUND',
  'PARENT_NOT_FOUND',
  'EXECUTION_BUDGET_EXCEEDED',
  'UNEXPECTED_ERROR',
  'UNSUPPORTED_CALENDAR',
]);

/**
 * The explicit, deliberately SHORT list of planning-failure codes that
 * double as eligibility reasons: the 17.1 synthesis passes a failed
 * outcome's code to the card iff it is here, every other code clamping
 * to UNEXPECTED_ERROR -- a registry code that merely shares a reason's
 * name (18.2) must not reach the card carrying the reason's meaning.
 */
const SYNTHESIS_REASONS = Object.freeze([
  'EXECUTION_BUDGET_EXCEEDED',
  'CALENDAR_EVENT_INVALID',
]);

function evaluateEligibility(event, directives, settings, window,
                             titleMatcher) {
  throw new Error('Not implemented: Technical Design section 9.2');
}
