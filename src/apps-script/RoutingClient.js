/**
 * Broker HTTP request and response handling. Technical Design section 11.
 *
 * Broker authentication is UNRESOLVED and blocks public release
 * (Technical Design section 21.7). Phases 1 through 4 use a fixed duration and
 * never reach this module.
 */

function getRouteDuration(origin, destination, requestContext) {
  throw new Error('Not implemented: broker authentication unresolved');
}

/**
 * Route cache key. ADR 0011, Technical Design section 13.3.
 *
 * Deliberately excludes source start and end times: MVP routing is not
 * traffic-aware, so rescheduling an appointment must not force a broker call.
 */
function routeInputHash(origin, destination, travelMode) {
  throw new Error('Not implemented: Technical Design section 13.3');
}

function cachedRouteIsUsable(metadata, expectedHash, now) {
  throw new Error('Not implemented: Technical Design section 13.3');
}
