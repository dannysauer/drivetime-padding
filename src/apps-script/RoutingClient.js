/**
 * Broker HTTP request and response handling. Technical Design section 11.
 *
 * Broker authentication is UNRESOLVED and blocks public release
 * (Technical Design section 21.7). Implementation phases 1 through 3 use a
 * fixed duration and never reach this module; Phase 4 (Architecture
 * section 25) deploys and authenticates the broker and implements this
 * module.
 */

/**
 * requestContext = { role, cacheEntry, now, budget, correlationId }.
 * cacheEntry is null when the role has no observed companion -- every
 * new meeting and a fresh install (12.1); cachedRouteIsUsable answers
 * false for it, so the client falls through to the other tiers.
 * correlationId is the run's ID (17.2): sent as X-Request-ID on every
 * attempt, retries included, and stamped on every AppErrorRecord this
 * client raises, so the stored record links to the broker logs (21.1).
 *
 * First (section 11.1 step 0), before any tier: an endpoint value
 * (trimmed, as routeInputHash uses it) longer than
 * MAX_ROUTE_ENDPOINT_VALUE_CHARS UTF-16 code units -- the broker's own
 * limit (21.3) -- throws by ENDPOINT ROLE (below): no attempt spent,
 * not productive, and neither memoized nor negative-cached (a pure
 * function of the input, re-derived for the cost of a length; an entry
 * would only crowd out a broker-learned failure). So a long pasted
 * location fails as INVALID_DESTINATION on either route, pointing the
 * user at the location, and never reaches the broker as a request it
 * would reject (which the client could only map to the
 * deployment-level BROKER_PROTOCOL_ERROR, 11.5).
 *
 * ENDPOINT ROLE, NOT WIRE FIELD (11.5): INVALID_DESTINATION always
 * means the event location, INVALID_ORIGIN the effective origin. On an
 * outbound request (from = origin) step 0 and the broker's wire codes
 * agree; on a return request (requestContext.role 'return', from =
 * location) the client SWAPS them -- a bad from is INVALID_DESTINATION.
 * Both memo tiers store the translated code. Otherwise a bad location
 * met first on the return route (a started meeting's outbound is
 * route-free, 12.5) would blame the user's origin.
 *
 * Consults the cache before the network. Cache policy lives here rather than
 * in the provider so there is exactly one place that decides staleness.
 * Fixed order (section 11.1), keyed by expectedHash =
 * routeInputHash(from, to, ROUTE_TRAVEL_MODE):
 * (1) the durable entry via cachedRouteIsUsable -> 'durable'; (2) the
 * failure memo budget.failedRoutes -> rethrow the memoized
 * NO_ROUTE / INVALID_ORIGIN / INVALID_DESTINATION, no attempt spent;
 * (3) the ephemeral tier, CacheService.getUserCache(), validated like a
 * durable entry -> 'ephemeral'; (4) the broker -> 'broker'.
 *
 * This client is the ephemeral tier's ONLY reader and writer (20.3): it
 * puts { secs, at: calculatedAt } under expectedHash for
 * EPHEMERAL_ROUTE_CACHE_TTL_SECONDS after EVERY broker success -- it
 * cannot know whether the role will end with a durable carrier, and the
 * provider never sees cache data (provider-boundary ADR). Best-effort: a
 * CacheService failure on read or write is swallowed, never a routing
 * failure.
 *
 * A deterministic broker failure (NO_ROUTE, INVALID_ORIGIN,
 * INVALID_DESTINATION) is recorded in budget.failedRoutes (hash -> code)
 * before it is thrown, so every source sharing the hash -- the instances
 * of one recurring series -- costs one attempt per run, not one each.
 * The memo lives on the run's RouteBudget and is touched by nothing but
 * this client. It has a PERSISTED tier, the negative route cache
 * (ROUTE_FAILURE_CACHE_KEY, also this client's alone): the client seeds
 * the memo with the store's unexpired entries on its first lookup of
 * the run and writes every new failure through to it, so a known
 * failure costs no attempt for ROUTE_FAILURE_CACHE_TTL_HOURS -- without
 * it, a window's unroutable front would spend every run's ceiling in
 * the same upcoming-first order and starve every source behind it,
 * forever. Keyed by route input hash only: a fixed location or origin
 * changes the hash and is routed on the next run. Bounded at
 * ROUTE_FAILURE_CACHE_MAX_ENTRIES (expired entries dropped first, then
 * the oldest); best-effort both ways, like the ephemeral tier; written
 * on every path, dry runs included. Transient and deployment-level
 * failures enter neither tier.
 *
 * Increments budget.productive for every attempt that returned a
 * validated route or a deterministic failure newly recorded: the engine
 * copies it to diagnostics.routeAttemptsProductive, and an exhausted
 * budget is a continuation cause only when it is non-zero (23.4) -- a
 * ceiling burned on BROKER_AUTH_FAILED or an outage bought nothing a
 * pass keeps. The client counts nothing else: per-tier hit and miss
 * counts are not recorded (23.3).
 *
 * Returns RouteResult with source set to 'durable' | 'ephemeral' | 'broker'
 * AND calculatedAt: when the BROKER produced the duration, never when a
 * cache was read -- routeAt is written from it, so omitting it invalidates
 * every persisted entry and stamping read time overshoots the 24h bound.
 * A broker result is stamped requestContext.now.toISOString() -- the
 * run's injected clock, NEVER a wall-clock read: the run's own later
 * reads validate against that same now (ageMs >= 0), so a wall stamp
 * would reject every entry the run wrote and re-route each instance of
 * a recurring series; and tests freezing now get fixed values. The
 * negative cache's epochMinutes uses the same clock.
 * The result also carries routeHash (expectedHash) on EVERY source: with
 * durationSeconds and calculatedAt it is the cache triplet, which the
 * provider copies into spec.privateProperties via routeCacheProperties
 * (4.7) -- the one carrier from this client to Calendar.
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
 * Before EVERY attempt, first or retry, compares Date.now() (the wall
 * clock the elapsed-budget guards read, not the injected now) with
 * budget.attemptDeadlineMs: past it, starts nothing and throws
 * EXECUTION_BUDGET_EXCEEDED -- no attempt spent, nothing memoized, not
 * productive. UrlFetchApp has no per-call timeout (each fetch waits up
 * to the platform deadline, ~60s), so admission is the only bound the
 * client can enforce: one worst-case attempt must still fit before
 * EXECUTION_BUDGET_MS. It cannot cancel a fetch in flight (11.2).
 *
 * Every fetch sets muteHttpExceptions: true (section 11.5). Without it,
 * UrlFetchApp throws on any non-2xx, the status/body mapping table is
 * never consulted, and validation and auth failures are misclassified
 * as BROKER_UNAVAILABLE and retried. The no-response mapping is reserved
 * for actual transport exceptions. A 401/403 with no recognized broker
 * code (an authenticating front end such as Cloud Run IAM answered) is
 * BROKER_AUTH_FAILED, like a recognized AUTHENTICATION_FAILED (11.5
 * rule 2). A 400 INVALID_REQUEST is an envelope fault -> the
 * deployment-level BROKER_PROTOCOL_ERROR; the broker codes a rejected
 * endpoint VALUE (empty, over-long) as INVALID_ORIGIN /
 * INVALID_DESTINATION by wire field, which the client re-codes by
 * endpoint role and memoizes like any per-input failure (11.5, 21.3).
 * The table's retry column is the immediate HTTP retry only; the
 * registry's retryable flag is true for every code it maps to (18.2).
 */
function getRouteDuration(from, to, requestContext) {
  throw new Error('Not implemented: broker authentication unresolved');
}

/**
 * Route cache key. The route-plan-cache ADR, Technical Design section 13.3.
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
 *
 * metadata is the normalized RouteCacheEntry OR null: the request
 * context carries null for a role with no observed companion (12.1).
 * Null answers false BEFORE any field is read -- reading routeHash off
 * null would throw, and every new meeting would fail planning with
 * UNEXPECTED_ERROR and never get a travel block. Section 13.3.
 */
function cachedRouteIsUsable(metadata, expectedHash, now) {
  throw new Error('Not implemented: Technical Design section 13.3');
}
