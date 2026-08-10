# Technical Design Examples

## Example: one-off OOO appointment

Source:

```json
{
  "id": "source-123",
  "summary": "Doctor appointment",
  "location": "Pueblo Medical Center",
  "eventType": "outOfOffice",
  "start": {"dateTime": "2026-08-05T10:00:00-05:00"},
  "end": {"dateTime": "2026-08-05T11:00:00-05:00"}
}
```

Route results (raw broker values):

```json
{
  "outbound": {"durationSeconds": 1440},
  "return": {"durationSeconds": 1560}
}
```

Quantized to 5-minute granularity (§12.3):

```text
outbound  1440s (24m) -> 1500s (25m)
return    1560s (26m) -> 1800s (30m)
```

Buffer: 7 minutes.

Desired outbound:

```text
09:28–10:00     (25m travel + 7m buffer)
```

Desired return:

```text
11:00–11:37     (30m travel + 7m buffer)
```

The raw values are retained in the route cache as `routeSecs`; only the quantized values reach event times and fingerprints.

## Example: cached route on a later run

The same appointment is reconciled again four hours later. Nothing has changed.

- route input hash matches the value stored on each generated event;
- both cache entries are under 24 hours old;
- no broker call is made in either direction;
- fingerprints match observed metadata;
- zero creates, updates, or deletes.

The next day the cache ages past `ROUTE_CACHE_MAX_AGE_HOURS`. Both directions are re-routed. The broker returns 1455s outbound, which quantizes to 1500s — identical to the stored value — so the fingerprint is unchanged and still no Calendar write occurs. Only the route cache triplet — `routeHash`, `routeSecs`, and `routeAt` — is refreshed.

## Example: appointment already in progress

Source event runs 10:00–11:00. Current time is 10:15.

- outbound block 09:28–10:00 has already ended;
- the reconciliation lookback places `planStart` at 02:15 and `observeStart` earlier still, so the outbound block is returned by the listing;
- the source event is still planned, because its return block at 11:00–11:37 remains in the future and required;
- desired and observed match in both directions;
- no duplicate outbound event is created.

Without the lookback the outbound block would be invisible, its desired spec unmatched, and a duplicate created on every run.

## Example: route exceeds the supported maximum

A source event's location is an eight-hour drive from the resolved origin.

Expected result:

- planning outcome `failed` with `ROUTE_TOO_LONG`;
- no generated events created;
- any existing generated events for that source preserved, not deleted;
- the event card explains that the destination is beyond the supported travel range.

## Example: transient route failure

Observed Calendar already contains matching outbound and return blocks.

The source event remains eligible, but the broker returns `UPSTREAM_UNAVAILABLE`.

Expected result:

- record per-event planning failure;
- preserve both generated events;
- do not classify them as orphans;
- retry on the next trigger or daily run.

## Example: cancelled recurring instance

A generated outbound and return pair exists for one weekly instance. Calendar reports that source instance as cancelled.

Expected result:

- eligibility result is `CANCELLED_EVENT`;
- desired state for that parent is empty;
- delete both generated events.

## Example: user removed generated metadata

The user edited a generated event through an API client and removed private metadata.

Expected result:

- the altered event is treated as user-owned and unmanaged;
- it is not deleted;
- a new managed generated event is created if the source still qualifies.

## Example: source straddling the far window edge

`planEnd` falls at 2026-10-01T00:00. A source event runs 2026-09-30T23:30 to 2026-10-01T00:30.

- the source is returned by the listing and planned, because its start is inside the planning range;
- its return block runs 00:30–01:07, entirely past `planEnd`;
- `timeMax` bounds start time, so a listing that stopped at `planEnd` would return the source but not its return block;
- `observeEnd` sits `MAX_SOURCE_DURATION + COMPANION_SPAN` past `planEnd`, so the return block is observed;
- desired and observed match, and no duplicate is created.

This is the mirror image of the in-progress case. Both come from the same asymmetry: `timeMin` bounds an event's end, `timeMax` bounds its start.
