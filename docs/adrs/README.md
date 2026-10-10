# Architecture Decision Records

Each record holds one durable decision: the driver, the constraints, the decision as a Y statement, its consequences, and the alternatives it beat. Records are named `YYYY-MM-DD-short-title.md` by decision date and are cited elsewhere as "the *short-title* ADR".

A record is edited freely while Draft or Proposed. Once Accepted it is append-only: a change to the decision itself is a new record that supersedes the old one, never an amendment. Supporting detail belongs in the architecture or technical-design documents.

| Record | Decision | Status |
|---|---|---|
| [apps-script-runtime](2026-08-03-apps-script-runtime.md) | Use Google Apps Script | Accepted |
| [routing-broker](2026-08-03-routing-broker.md) | Cloud Run routing broker | Accepted |
| [reconciliation](2026-08-03-reconciliation.md) | Reconciliation over delta processing | Accepted |
| [recurring-instances](2026-08-03-recurring-instances.md) | Expand recurring instances | Accepted |
| [derived-state](2026-08-03-derived-state.md) | Generated events are derived state | Accepted |
| [fingerprints](2026-08-03-fingerprints.md) | Canonical fingerprints | Accepted |
| [simplified-architecture](2026-08-03-simplified-architecture.md) | No Planner or Capability layers in the MVP | Accepted |
| [primary-calendar](2026-08-03-primary-calendar.md) | Primary calendar only | Accepted |
| [private-metadata](2026-08-03-private-metadata.md) | Private metadata is the deletion-safety boundary | Accepted |
| [route-data-minimization](2026-08-03-route-data-minimization.md) | Route data minimization | Accepted |
| [route-plan-cache](2026-08-03-route-plan-cache.md) | Route results are derived state | Accepted |
| [window-boundaries](2026-08-03-window-boundaries.md) | Reconciliation window boundaries | Accepted |
| [oauth-scope-strategy](2026-08-03-oauth-scope-strategy.md) | OAuth scope strategy | **Proposed**, revisit when Prototype Spike 2 reports |
| [provider-boundary](2026-08-03-provider-boundary.md) | Providers return specifications | Accepted |

## Load-bearing records

Two records are load-bearing: any code that touches Calendar deletion or route spend is checked against them.

- **private-metadata**: never delete an event that does not carry `dtp === '1'`. Title matching is prohibited.
- **route-plan-cache**: route results are cached derived state; discarding the cache may cost broker calls but must never change Calendar state.

The project's two non-negotiable safety constraints are stated in [`CONTRIBUTING.md`](../../CONTRIBUTING.md): the private-metadata rule above, and the rule that a planning failure never deletes existing generated events (Technical Design §17.4, a consequence of the [provider-boundary ADR](2026-08-03-provider-boundary.md)).

Open questions and prototype spikes are tracked in [`../open-questions.md`](../open-questions.md).
