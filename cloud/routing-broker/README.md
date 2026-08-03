# Routing Broker

Authenticated Cloud Run service that calls the Google Maps Routes API on behalf of the add-on.

Full contract in Technical Design §21. Rationale in ADR 0002.

## Status

Not implemented. **Authentication is unresolved and blocks public release** (Technical Design §21.7).

Implementation phases 1 through 4 use a fixed travel duration and never call this service, so the engine can be built and proven while this stays open.

## API

```text
POST /v1/route-duration
Content-Type: application/json
Authorization: <mechanism not yet selected>
X-Request-ID: opaque UUID
```

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

## Responsibilities

- Authenticate add-on requests.
- Validate inputs, including maximum body size and string lengths.
- Keep Maps credentials in Secret Manager, never in Apps Script.
- Request only duration and distance via field mask.
- Normalize Google duration formats to integer seconds.
- Enforce rate limits and quotas against uncontrolled Maps cost.
- Emit structured logs and cost metrics.

## Privacy

Per ADR 0010, the broker receives only origin, destination, travel mode, and an opaque correlation ID. It never receives event titles, descriptions, attendees, or calendar identifiers, and does not log raw addresses by default.

This backs a user-facing claim in the Marketplace listing. Changing the payload changes what the product promises.

## Cost

The add-on caches route results as derived state (ADR 0011), bounding steady-state load at two calls per eligible event per day rather than per trigger firing. The broker should still enforce its own limits — the cache is a client-side optimization and cannot be relied on for abuse prevention.
