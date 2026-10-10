# ADR: Cloud Run routing broker

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | Where route durations are computed and where Maps credentials live. The broker payload is the [route-data-minimization ADR](2026-08-03-route-data-minimization.md); broker authentication is an open question (Technical Design §21.7). |
| Related | Technical Design §11 and §21; [Open questions](../open-questions.md), routing broker |

## Business driver

Travel durations come from the Google Maps Routes API, which is billed and keyed. An Apps Script add-on is distributed to every installing user, so any credential it carries is effectively public.

## Constraints

- Maps credentials MUST NOT be present in the add-on or in any user-visible deployment.
- Route spend MUST be attributable and limitable centrally.
- Route responses MUST be normalized into one error vocabulary (Technical Design §11.5) regardless of the upstream API.

## Decision

**Y statement:** We will route every Maps call through a Cloud Run broker owned by the project because the credential cannot live in the add-on, so credentials, billing, quotas, logging, and response normalization are centralized in one service.

The add-on calls only the broker (Technical Design §11); the broker alone calls the Routes API.

## Consequences

- The project takes on an availability dependency, an operational surface, and a Maps bill that scales with adoption rather than with each user's own quota.
- Public-release authentication from Apps Script to the broker is unresolved and is a release blocker (Technical Design §21.7). Implementation phases 1 through 3 (Architecture §25) use a fixed duration and never call the broker.
- The broker needs the `script.external_request` scope in the manifest, and its URL prefix in `urlFetchWhitelist` once chosen (Technical Design §11.2).

## Alternatives considered

### Direct Routes API calls from Apps Script

Simplest to build. Rejected: it requires the Maps credential in the add-on, where every user can read it.

### Embedded API key with referrer restrictions

Rejected: Apps Script requests carry no referrer the key could be restricted to, so the key would be unrestricted in practice.
