/**
 * Eligibility decisions and stable reason codes. Technical Design section 9.
 *
 * Evaluation order matters: diagnostics should surface the most useful reason,
 * not merely the first failing condition.
 *
 * Steps 1-3 (disabled, generated, cancelled) must read NO timestamps -- a
 * cancelled tombstone may carry neither start nor end.
 *
 * OOO acceptance is gated on settings.eligibility.includeOutOfOffice. A
 * settings field no step consults is not a setting, it is a control that
 * silently does nothing. Technical Design section 9.2, REQ-ELIG-001.
 *
 * Pattern matching uses event.summary (raw), never displaySummary.
 */

function evaluateEligibility(event, directives, settings, window) {
  throw new Error('Not implemented: Technical Design section 9.2');
}
