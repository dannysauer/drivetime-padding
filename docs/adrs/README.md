# Architecture Decision Records

Each ADR records the problem, the alternatives considered, the decision, the reasoning, and the tradeoffs accepted.

Amend an ADR only when the decision itself changes. Supporting detail belongs in the architecture or technical-design documents.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-apps-script-runtime.md) | Use Google Apps Script | Accepted |
| [0002](0002-routing-broker.md) | Cloud Run routing broker | Accepted |
| [0003](0003-reconciliation.md) | Reconciliation over delta processing | Accepted |
| [0004](0004-recurring.md) | Expand recurring instances | Accepted |
| [0005](0005-derived-state.md) | Generated events are derived state | Accepted |
| [0006](0006-fingerprints.md) | Canonical fingerprints | Accepted |
| [0007](0007-simplify.md) | Remove Planner and Capability layers | Accepted |
| [0008](0008-primary-calendar.md) | Primary calendar only | Accepted |
| [0009](0009-private-metadata.md) | Private metadata is the deletion-safety boundary | Accepted |
| [0010](0010-data-minimization.md) | Route data minimization | Accepted |
| [0011](0011-route-plan-cache.md) | Route results are derived state | Accepted |
| [0012](0012-reconciliation-lower-boundary.md) | Reconciliation lower boundary | Accepted |
| [0013](0013-oauth-scope-strategy.md) | OAuth scope strategy | **Proposed — blocked on Spike 2** |
| [0014](0014-provider-boundary.md) | Providers return specifications | Accepted |

## Load-bearing ADRs

Two of these are safety constraints rather than preferences, and any code that touches Calendar deletion or route spend should be checked against them:

- **0009** — never delete an event that does not carry `dtp === '1'`. Title matching is prohibited.
- **0011** — route results are cached derived state; discarding the cache may cost broker calls but must never change Calendar state.

Open questions and prototype spikes are tracked in [`../open-questions.md`](../open-questions.md).
