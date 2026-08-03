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
