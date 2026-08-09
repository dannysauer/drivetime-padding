/**
 * Origin resolution and generated-event calculations.
 * Architecture section 5.5, Technical Design section 12.
 *
 * Returns a PlanningOutcome, never writes to Calendar (ADR 0014).
 */

/**
 * context carries the observed companions' route cache entries and an
 * injected clock, not just the event and settings.
 *
 * Without them the cache is unreachable: it lives on the observed generated
 * events, which the comparator matches to specs only AFTER planning. Every
 * run would call the broker and the cost bound in ADR 0011 would be
 * unimplementable. Technical Design section 12.1.1.
 *
 * The provider passes cache entries through and never inspects them --
 * staleness is decided in RoutingClient so there is one place for the policy.
 */
function getGeneratedEventSpecs(context) {
  throw new Error('Not implemented: Technical Design section 12');
}

function resolveOrigin(event, directives, settings, workingLocations) {
  throw new Error('Not implemented: Technical Design section 10');
}

/**
 * Rounds up to a 5-minute bucket. Technical Design section 12.3.
 *
 * This is what makes the daily cache refresh safe: traffic noise lands in the
 * same bucket, so the fingerprint is unchanged and no Calendar write occurs.
 */
function quantizeDuration(seconds) {
  return Math.ceil(seconds / ROUTE_GRANULARITY_SECONDS) * ROUTE_GRANULARITY_SECONDS;
}
