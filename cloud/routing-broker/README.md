# Routing Broker

Authenticated Cloud Run service that calls the Google Maps Routes API on behalf of the add-on.

Full contract in Technical Design §21. Rationale in the [routing-broker ADR](../../docs/adrs/2026-08-03-routing-broker.md).

## Status

Not implemented. **Authentication is unresolved and blocks public release** (Technical Design §21.7).

Implementation phases 1 through 3 use a fixed travel duration and never call this service, so the engine can be built and proven while this stays open; Phase 4 deploys and authenticates it.

## API

```text
POST /v1/route-duration
Content-Type: application/json
Authorization: <mechanism not yet selected>
X-Request-ID: <the add-on run's correlation ID -- an opaque UUID>
```

`X-Request-ID` is the add-on run's correlation ID, shared by every request of one run and stored in the add-on's last-run record (Technical Design §20.2, §21.1). Echo it in the response and log it with each request.

Request:

```json
{
  "origin": { "type": "address", "value": "123 Main Street" },
  "destination": { "type": "address", "value": "456 Clinic Road" },
  "travelMode": "DRIVE"
}
```

Response:

```json
{
  "durationSeconds": 1420,
  "distanceMeters": 18300
}
```

Errors use normalized codes: `INVALID_REQUEST`, `INVALID_ORIGIN`, `INVALID_DESTINATION`, `NO_ROUTE`, `RATE_LIMITED`, `AUTHENTICATION_FAILED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR`.

## Input limits

The broker enforces two limits, the same constants the add-on's `Constants.js` defines (Technical Design §11.1, §21.3; `tools/check_td_snippets.py` keeps the values in step):

- `MAX_ROUTE_ENDPOINT_VALUE_CHARS` (1000): the most UTF-16 code units (JavaScript `String.length`) an `origin.value` or `destination.value` may hold.
- `MAX_ROUTE_REQUEST_BODY_BYTES` (16384): the most UTF-8 bytes a request body may hold — room for two maximal values under worst-case JSON escaping, plus the envelope.

Which code a rejection carries is part of the contract, because the add-on treats the codes very differently:

- A problem with one endpoint's **value** — empty, over `MAX_ROUTE_ENDPOINT_VALUE_CHARS`, or unresolvable — is `INVALID_ORIGIN` or `INVALID_DESTINATION`, naming the wire field (`origin` or `destination`); the add-on re-codes it by which endpoint is the event location, so on a return route a bad `origin` is reported as the destination. The add-on treats it as a fact about the route input: it remembers the failure for that input and tells the user to fix the location or origin.
- A problem with the **envelope** — a body over `MAX_ROUTE_REQUEST_BODY_BYTES`, unparseable JSON, a missing or unknown field, an unsupported endpoint `type`, a travel mode other than `DRIVE` — is `INVALID_REQUEST`. The add-on maps it to a deployment-level protocol error, never remembered per input, so it must never be used for a value the user typed.

The add-on refuses an over-long value itself before sending (Technical Design §11.1 step 0), so in normal operation the value limit is never hit here; it is enforced as defence in depth.

## Responsibilities

- Authenticate add-on requests.
- Validate inputs, including maximum body size and string lengths (Input limits, above).
- Keep Maps credentials in Secret Manager, never in Apps Script.
- Request only duration and distance via field mask.
- Normalize Google duration formats to integer seconds.
- Enforce rate limits and quotas against uncontrolled Maps cost.
- Emit structured logs and cost metrics: request ID (`X-Request-ID`), response code, latency, normalized error code, and Maps billable count only (Technical Design §21.6).

## Privacy

Per the [route-data-minimization ADR](../../docs/adrs/2026-08-03-route-data-minimization.md), the broker receives only origin, destination, travel mode, and an opaque correlation ID, plus the authentication credential it verifies. It never receives event titles, descriptions, attendees, or calendar identifiers, does not log raw addresses by default, and never logs the caller's identity — no authenticated principal, installation identifier, or credential. Rate limiting may key on the principal in its own short-lived state, never in logs.

This backs a user-facing claim in the Marketplace listing. Changing the payload changes what the product promises.

## Cost

The add-on caches route results as derived state ([route-plan-cache ADR](../../docs/adrs/2026-08-03-route-plan-cache.md)), bounding steady-state load at two calls per eligible event per day rather than per trigger firing. The broker should still enforce its own limits — the cache is a client-side optimization and cannot be relied on for abuse prevention.
