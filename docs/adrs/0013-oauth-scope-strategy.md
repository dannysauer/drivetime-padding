# ADR 0013: OAuth Scope Strategy

**Status:** Proposed — blocked on Prototype Spike 2  
**Date:** 2026-08-03

Problem: the manifest requests `https://www.googleapis.com/auth/calendar`, chosen by default rather than by analysis. Scope tier drives verification cost and timeline, and could affect whether a free Marketplace add-on is viable.

Alternatives: Keep the broad `calendar` scope, narrow to `calendar.events`, or decompose into the narrowest working set.

Decision: Deferred pending Prototype Spike 2.

Why: The decision needs a fact this project does not yet have: Google's current classification of each Calendar scope, and which scope working-location reads actually require. Committing before checking is what produced the current manifest.

Tradeoffs: Leaving this open blocks finalizing the manifest and firm Marketplace planning. Accepted because guessing has a worse expected cost.

## Correction to an earlier assumption

An earlier review of this project asserted that `auth/calendar` is a *restricted* scope requiring a CASA third-party security assessment with annual renewal, and project planning briefly absorbed that as a budget risk.

That is probably wrong. Google classifies scopes as basic, sensitive, or restricted; the CASA assessment applies to the restricted tier, which centers on Gmail and Drive. Calendar scopes are believed to be **sensitive** — requiring OAuth verification and review time, but not a paid annual assessment.

Neither claim has been verified against Google's current published list. That verification is the first task of Spike 2, and no budget or scope conclusion should be drawn before it completes.

## Constraint while open

No scope may be added speculatively. `openid` must not appear in the manifest until broker authentication is chosen (Technical Design §21.7), because adding it would commit to one candidate mechanism.

`https://www.googleapis.com/auth/calendar.addons.execute` is not speculative and is outside this decision: Google requires it of every Calendar add-on — the `eventOpenTrigger` and `currentEventAccess` declared in the manifest do not run without it — so the manifest carries it whatever data-access tier Spike 2 settles on. It is an add-on execution scope, not a Calendar data scope, and does not move the verification tier.

**Spike 2 input — the daily-hour derivation reads the user's Calendar time zone** (`Calendar.Settings.get('timezone')`, Technical Design §19.2) on every daily firing. The full `calendar` scope covers that settings read; `calendar.events` does not, while the narrow `https://www.googleapis.com/auth/calendar.settings.readonly` exists for exactly it. Narrowing the manifest therefore means keeping a settings-capable scope (the read-only settings scope is the data-minimizing candidate) or sourcing the zone another way — the add-on event object's `userTimezone` on card paths (which requires `script.locale` and `useLocaleFromApp`, the trade-off Architecture §22 already records) cached for the daily path. Without one of those, every daily repair fails with insufficient permission and the schedule never realigns — the silent failure §19.2 exists to remove.
