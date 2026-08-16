/**
 * Broker HTTP request and response handling. Technical Design section 11.
 *
 * Broker authentication is UNRESOLVED and blocks public release
 * (Technical Design section 21.7). Phases 1 through 4 use a fixed duration and
 * never reach this module.
 */

/**
 * requestContext = { role, cacheEntry, now, budget, correlationId }.
 *
 * Consults the cache before the network. Cache policy lives here rather than
 * in the provider so there is exactly one place that decides staleness.
 *
 * Returns RouteResult with source set to 'durable' | 'ephemeral' | 'broker'
 * AND calculatedAt: when the BROKER produced the duration, never when a
 * cache was read -- routeAt is written from it, so omitting it invalidates
 * every persisted entry and stamping read time overshoots the 24h bound.
 * Anything other than 'durable' needs persisting: an ephemeral hit (section
 * 20.3) avoids the broker call but the companion's durable entry is still
 * stale -- a boolean fromCache would conflate the tiers and strand the
 * stale entry.
 *
 * Decrements requestContext.budget.remaining for EVERY HTTP attempt,
 * retries included (section 11.2). The ceiling bounds wire traffic, not
 * logical calls; enforcing it above the retry layer would double the spend
 * during a broker outage.
 *
 * Every fetch sets muteHttpExceptions: true (section 11.5). Without it,
 * UrlFetchApp throws on any non-2xx, the status/body mapping table is
 * never consulted, and non-retryable validation and auth failures are
 * misclassified as retryable BROKER_UNAVAILABLE. The no-response mapping
 * is reserved for actual transport exceptions.
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
