/**
 * Origin resolution and generated-event calculations.
 * Architecture section 5.5, Technical Design section 12.
 *
 * Returns a PlanningOutcome, never writes to Calendar (ADR 0014).
 */

/**
 * context carries the RESOLVED observed companions per role
 * (context.observedCompanions) and an injected clock, not just the
 * event and settings.
 *
 * Without them the cache is unreachable: it lives on the observed generated
 * events, which the comparator matches to specs only AFTER planning. Every
 * run would call the broker and the cost bound in ADR 0011 would be
 * unimplementable. Technical Design section 12.1.1.
 *
 * The whole companion, not just its cache triplet, because the provider
 * applies the 15.2.9 FREEZE before routing: a strictly concluded record
 * (valid anchor, ended, undisplaced) whose anchor equals the role's
 * 14.1 source anchor is the same occurrence -- the role's routing is
 * short-circuited, so no broker budget is spent re-estimating a trip
 * that already happened. A frozen role's emission is PINNED (15.2.9):
 * a spec carrying the 14.1 anchor and the record's observed fields
 * verbatim, with no route resolved and the role omitted from
 * outcome.routes. The copied fields are never consulted -- anchor
 * equality classifies the pair unchanged before any field or
 * fingerprint comparison -- the spec exists so the key stays desired
 * (matched, never an orphan-path candidate) and spec-counting
 * bookkeeping sees the role emitted. A
 * triplet-only context could not recognize the record.
 *
 * The cache TRIPLETS are still passed through to the routing client
 * uninspected -- staleness is decided in RoutingClient so there is one
 * place for the policy.
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
 * This is what makes the daily cache refresh safe: traffic noise lands in
 * the same bucket, so the fingerprint is unchanged and nothing
 * user-visible changes -- the refreshed cache triplet still lands via a
 * metadata-only patch (section 15.2.2), a write the user never sees.
 *
 * Zero stays zero (coincident endpoints). The provider must then emit NO
 * spec for a role whose quantized duration plus buffer is zero -- Calendar
 * rejects zero-length events, and a zero-minute drive with zero buffer
 * needs no block. Technical Design section 12.5.
 *
 * Domain guard, defense in depth behind 11.3's broker validation and
 * 13.3's parse-or-null cache triplets: a negative input would quantize
 * to -0 and a non-finite one to NaN, which the 12.4 ceiling comparison
 * cannot catch -- the spec's times would become Invalid Date and
 * Calendar would reject the write on every run. Throwing lands in the
 * engine's per-event containment instead: a failed outcome, companions
 * preserved (Architecture 14.2).
 */
function quantizeDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError('quantizeDuration: seconds must be a finite, non-negative number');
  }
  return Math.ceil(seconds / ROUTE_GRANULARITY_SECONDS) * ROUTE_GRANULARITY_SECONDS;
}
