# ADR: Expand recurring instances

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | How recurring source events produce generated events. |
| Related | [reconciliation ADR](2026-08-03-reconciliation.md); Technical Design §7.3 |

## Business driver

Recurring appointments are common, and their instances move, get cancelled, and get edited individually. Travel blocks have to follow each instance.

## Constraints

- A moved or cancelled instance MUST change only its own travel blocks.
- The add-on MUST NOT maintain its own copy of recurrence rules or exception lists.

## Decision

**Y statement:** We will read recurring sources as expanded single instances (`singleEvents: true`) and reconcile each instance on its own because mirroring a recurrence rule would mean maintaining a second recurrence graph with its own exception logic, so every instance inside the window gets ordinary one-off travel blocks.

## Consequences

- Generated-event count grows linearly with the instances inside the window; a long window on a daily series produces many one-off events. The count is bounded by the planning window, not by series count.
- Instance identity, moved instances, and cancelled tombstones follow the Calendar API's expanded-instance semantics (Technical Design §7.3 and §8.2), which an open question verifies on a live account.

## Alternatives considered

### Mirror recurring travel series

Create one recurring travel series per recurring source. Rejected: every exception on the source would need a matching exception on two travel series, duplicating Calendar's recurrence logic inside the add-on.
