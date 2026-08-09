/**
 * Broker HTTP request and response handling. Technical Design section 11.
 *
 * Broker authentication is UNRESOLVED and blocks public release
 * (Technical Design section 21.7). Phases 1 through 4 use a fixed duration and
 * never reach this module.
 */

/**
 * requestContext = { role, cacheEntry, now, correlationId }.
 *
 * Consults the cache before the network. Cache policy lives here rather than
 * in the provider so there is exactly one place that decides staleness.
 * Returns RouteResult with fromCache set, which is how the engine tells a
 * metadata patch apart from no write at all.
 */
function getRouteDuration(from, to, requestContext) {
  throw new Error('Not implemented: broker authentication unresolved');
}

/**
 * Route cache key. ADR 0011, Technical Design section 13.3.
 *
 * Both endpoints are { type, value } RouteEndpoints in travel order. The
 * return route swaps them, so a signature that types only the origin would
 * flatten a placeId configured origin to a string in one direction.
 *
 * Deliberately excludes source start and end times: MVP routing is not
 * traffic-aware, so rescheduling an appointment must not force a broker call.
 */
function routeInputHash(fromEndpoint, toEndpoint, travelMode) {
  throw new Error('Not implemented: Technical Design section 13.3');
}

/**
 * Cached durations get the same validation as broker responses (section 11.3).
 * Extended properties are strings on a user-editable event, so an unvalidated
 * cache read is a path around that validation.
 */
function cachedRouteIsUsable(metadata, expectedHash, now) {
  throw new Error('Not implemented: Technical Design section 13.3');
}
