# Open Questions and Prototype Spikes

This file tracks what is **not** decided. Everything here blocks something; nothing here is a nice-to-have.

The documentation set is otherwise normative. When an item below is resolved, update the owning document and record the outcome as an ADR or a technical-design revision, then remove it from this file.

---

## Blocking spikes

These run **before** implementation, not alongside it.

### Spike 1 — Installable trigger feasibility

**Blocks:** Architecture §15, §16, §10.4; Technical Design §19; AC-INSTALL-002; AC-INSTALL-003; [apps-script-runtime ADR](adrs/2026-08-03-apps-script-runtime.md)'s rationale.

The entire synchronization model assumes a Marketplace-installed Google Workspace Add-on can create installable Calendar triggers on the user's behalf. This has never been tested. The [apps-script-runtime ADR](adrs/2026-08-03-apps-script-runtime.md) cites installable triggers as a *reason* to choose Apps Script, so a negative result reopens the runtime decision itself.

Questions:

1. Can a Marketplace-installed add-on create installable Calendar triggers at all?
2. Under whose authorization context do they execute?
3. Does this work identically on consumer and Workspace accounts?
4. How often does `onEventUpdated` actually fire — one event per edit, or coalesced? *This number is the multiplier on the entire route-cost model.*
5. Do triggers survive add-on version updates and re-authorization?
6. What is the per-user trigger quota?
7. What happens to triggers on uninstall?
8. Can `ensureTriggers(now)` reliably detect and repair missing or duplicate triggers?

**Exit:** a written finding for each question, and either confirmation of the current design or a redesign proposal.

### Spike 2 — OAuth scope classification and minimum scope set

**Blocks:** the manifest; [oauth-scope-strategy ADR](adrs/2026-08-03-oauth-scope-strategy.md); Marketplace planning; REQ-SEC-002a.

Questions:

1. What is Google's **current** published classification for each Calendar scope — basic, sensitive, or restricted?
2. Does the restricted-tier CASA assessment apply here at all? (Believed not — Calendar is thought to be sensitive — but unverified either way. See the [oauth-scope-strategy ADR](adrs/2026-08-03-oauth-scope-strategy.md).)
3. Is `calendar.events` sufficient, or is the broader `calendar` scope actually required?
4. Which scope do working-location reads require?
5. What is the realistic verification timeline for the resulting set?
6. Does the product need host locale? If so, `script.locale` joins the set and `useLocaleFromApp` can be re-enabled; it is currently `false` precisely to avoid declaring that scope ahead of the decision.
7. Which scope does the daily path's Calendar time-zone read (`Calendar.Settings.get('timezone')`, TD §19.2) require — is `calendar.settings.readonly` sufficient — or is the zone sourced another way? ([oauth-scope-strategy ADR](adrs/2026-08-03-oauth-scope-strategy.md).)
8. Which scope does the event card's primary-calendar-id read (TD §7.1, §20.3) require? `CalendarApp.getDefaultCalendar()` needs `calendar` or `calendar.readonly`, which `calendar.events` does not grant; if the set is narrowed, which replacement read works under it? ([oauth-scope-strategy ADR](adrs/2026-08-03-oauth-scope-strategy.md).)
9. Does the candidate set authorize **every** Calendar call the code makes — event reads and writes, working-location reads, and both non-event reads above — verified by exercising each call under the candidate manifest?

**Exit:** a scope set written into the manifest, the [oauth-scope-strategy ADR](adrs/2026-08-03-oauth-scope-strategy.md) moved to Accepted, and a verification timeline in the plan.

---

## Calendar API behavior — requires a live account

| # | Question | Blocks |
|---|---|---|
| 1 | Exact request shape to create an OOO event, and which `outOfOfficeProperties` values are accepted | TD §16.2 |
| 1a | Whether `outOfOfficeProperties` can be patched on an existing OOO event — verified by **reading the value back** after the patch, not by request success alone: a patch Calendar accepts (200) but silently ignores would leave the owned-field mismatch permanently un-healable (patch rejected *or* ignored → realign by replacement) | TD §16.5, §15.2.1, §15.2.5 |
| 2 | Whether `autoDeclineMode: declineNone` reliably prevents generated blocks from declining meetings | TD §16.2, REQ-ELIG-011 |
| 3 | Whether explicit reminder suppression behaves consistently on OOO events | TD §16.3 |
| 4 | Whether `showDeleted` + `singleEvents` is sufficient to detect all cancelled recurring instances — and whether `orderBy: "startTime"` (TD §7.2.1) returns cancelled instances, which may carry no `start`, at all and in a stable position | TD §7.2.1, §7.3, AC-REC-003 |
| 5 | Whether extended properties survive on OOO events as they do on ordinary events | [private-metadata ADR](adrs/2026-08-03-private-metadata.md) — safety-critical |
| 6 | Whether the Advanced Calendar service can send `If-Match` for conditional writes — delete, update, and metadata patch alike, every write against an observed event | TD §16.5.1 — safety-critical |
| 7 | Exactly which fields a cancelled recurring tombstone carries when `showDeleted: true` | TD §8.2, §9.2 |

Item 6 decides whether the ownership-safety boundary can be enforced atomically or only narrowed — for every write against an observed event, not deletes alone. If conditional writes are unavailable, the fallback — re-read and re-verify the marker immediately before each delete, update, and metadata patch — leaves a small residual race that must be documented rather than assumed away; where `If-Match` is available, a rejected write is re-read to tell ownership loss from a concurrent edit (TD §16.5.1).

Item 5 is the one to test first. If OOO events cannot carry private extended properties, the deletion-safety boundary in the [private-metadata ADR](adrs/2026-08-03-private-metadata.md) does not hold for the product's primary event type, and the design changes materially.

## Working location — requires consumer and Workspace accounts

| # | Question | Blocks |
|---|---|---|
| 1 | Availability on consumer accounts | REQ-ORIGIN-005 |
| 2 | Availability on Workspace accounts | REQ-ORIGIN-005 |
| 3 | Actual API response shape | TD §7.5 |
| 4 | Office-type matching, including custom office names | TD §10.3 |
| 5 | Tie-breaker when multiple working-location events overlap | TD §10.3 |

Degradation to the default origin is already specified, so these block the feature rather than the release.

## Routing broker

| # | Question | Blocks |
|---|---|---|
| 1 | Public-safe authentication from Apps Script to Cloud Run | **Public release** — TD §21.7 |
| 2 | Whether `ScriptApp.getIdentityToken()` yields a token the broker can validate | Auth candidate evaluation |
| 3 | Current Routes API pricing, to convert the cost model into real numbers | Planning |

Question 1 is the single hardest open item. It does not block Phases 1–3, which use a fixed duration and no broker.

## Runtime and quota

| # | Question | Blocks |
|---|---|---|
| 1 | Real Apps Script runtime for the full observation read: 60-day forward window **plus 32-hour margins at both ends** — the Calendar query starts 40 hours in the past (8-hour planning lookback + 32-hour observe margin) and ends 32 hours past the planning horizon, per TD §7.2 | REQ-PERF-005 |
| 2 | Whether `MAX_ROUTE_CALLS_PER_RUN = 60` is the right ceiling | TD §23.3 |
| 3 | Whether `ScriptApp` `atHour()` supports the per-user UTC conversion in TD §19.2 | REQ-TIME-013 |
| 4 | Practical event count before pagination and execution budget interact badly | REQ-PERF-008 |

---

## Deferred decisions

Decided for now, with a named point at which the choice is reopened.

| Choice | Current design | Revisit |
|---|---|---|
| Regex title pattern versus a linear-time glob subset | An allowlist regex subset with caps, a subject bound and a cost argument (TD §9.3) | **Before the first release.** A glob or word matcher would remove all of that at the price of regex expressiveness, and the design predates any stored pattern, so the switch is still free |
