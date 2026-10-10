# ADR: Private metadata is the deletion-safety boundary

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | How the add-on recognizes the events it owns, and therefore which events it may ever delete or rewrite. |
| Related | [derived-state ADR](2026-08-03-derived-state.md); Technical Design §15.3 and §16.5.1; [Open questions](../open-questions.md), Calendar API item 5 |

## Business driver

Reconciliation deletes generated events routinely. Deleting a user's own appointment is the one unrecoverable mistake the product can make.

## Constraints

- The add-on MUST NOT delete or rewrite an event it did not create.
- Ownership MUST be decidable from the event alone, with no external store.
- The marker MUST NOT be something a user edits in ordinary use.

## Decision

**Y statement:** We will identify managed events solely by the private extended property `dtp === '1'` because titles are user-editable and localized and an external mapping introduces a consistency problem the rest of the design avoids, so the deletion boundary is a stable marker that is invisible to the user and travels with the event.

This is a safety rule, not a convention. Technical Design §15.3 states it as a hard constraint:

> Delete only events carrying valid private property `dtp === '1'`. Never delete based on title prefix.

Every write against an observed event is conditional on the marker still being present at write time (Technical Design §16.5.1), because a user can strip it between the read and the write. Any future code path that deletes or rewrites Calendar events MUST be checked against this record.

## Consequences

- If a user strips the metadata, the event becomes permanently unmanaged and a duplicate is created beside it. That is the deliberate safe direction: orphaning is recoverable, deleting someone's real event is not.
- The boundary holds only if out-of-office events carry private extended properties as ordinary events do. That is unverified and is the first Calendar API question to test (open questions, item 5); a negative result changes the design materially.

## Alternatives considered

### Match on title prefix

Rejected: titles are user-editable and localized, so a user renaming an event, or naming their own event with the prefix, would move it across the deletion boundary.

### External event-ID mapping

Rejected: a store the add-on owns can disagree with Calendar, and an event deleted by the user while still listed in the store would be "owned" by a record that no longer corresponds to anything.
