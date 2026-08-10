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
 *
 * The outcome also reports every route it resolved (role, raw and quantized
 * seconds, provenance tier) on PlanningOutcome.routes -- the diagnostic
 * payload is built from it, and specs cannot carry it: provenance never
 * reaches privateProperties, and a zero-emission role has no spec at all.
 * Technical Design sections 17.4, 17.6.
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
 *
 * Zero stays zero (coincident endpoints). The provider must then emit NO
 * spec for a role whose quantized duration plus buffer is zero -- Calendar
 * rejects zero-length events, and a zero-minute drive with zero buffer
 * needs no block. Technical Design section 12.5.
 */
function quantizeDuration(seconds) {
  return Math.ceil(seconds / ROUTE_GRANULARITY_SECONDS) * ROUTE_GRANULARITY_SECONDS;
}
