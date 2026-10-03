# Drivetime Padding

Drivetime Padding is a Google Workspace Marketplace add-on that automatically creates and maintains travel-time events around qualifying Google Calendar events.

When a timed Out of Office event has a destination in its `location` field, the add-on calculates the driving duration and creates two companion events: an outbound block ending when the appointment begins, and a return block starting when it ends. Both stay synchronized as the source event moves, changes, or is cancelled.

## Status

**Design complete, implementation not started.**

The documentation set is normative and ready to build against, with two exceptions that block implementation:

| Spike | Question |
|---|---|
| Spike 1 | Can a Marketplace-installed add-on create installable Calendar triggers? |
| Spike 2 | What is the minimum viable OAuth scope set, and its verification tier? |

Broker authentication is also unresolved, but it blocks public release rather than implementation — phases 1 through 3 use a fixed travel duration and never call the broker, and Phase 4 is where the broker is deployed and the fixed duration replaced.

See [`docs/open-questions.md`](docs/open-questions.md) for the full list.

## MVP scope

- Google Apps Script runtime, distributed through Google Workspace Marketplace
- Consumer and Workspace Google accounts
- Primary calendar only
- Real Out of Office events by default, with optional subject-pattern matching
- Driving routes only, via a Cloud Run routing broker
- Configurable origins, buffer, and planning window
- 60-day forward reconciliation window with an 8-hour lookback
- Recurring events via instance reconciliation

Explicitly out of scope: destination inference, multiple calendars, non-driving modes, traffic-aware rescheduling, and billing.

## The core idea

> Generated events are disposable derived state, and reconciliation is the product.

Source calendar events are authoritative. Generated events can be deleted or corrupted at any time and a later reconciliation restores them. There is no external database. The engine compares the state that should exist against the state that does, and applies the smallest safe diff.

Route results are derived state under the same rule: discarding the route cache may cost broker calls, but must never change the resulting Calendar state.

## Documentation

Read in this order:

| Document | Purpose |
|---|---|
| [Engineering handoff](docs/engineering-handoff.md) | Orientation — start here |
| [Architecture](docs/architecture/architecture.md) | System design and rationale |
| [Technical design](docs/technical-design/technical-design.md) | Implementation contracts — normative |
| [Requirements](docs/requirements/requirements.md) | Numbered, testable behavior |
| [Acceptance scenarios](docs/requirements/acceptance-scenarios.md) | Given/When/Then coverage |
| [Developer guide](docs/developer-guide/developer-guide.md) | Environment and workflow |
| [Planning](docs/planning/planning.md) | Milestones, spikes, backlog |
| [ADRs](docs/adrs/README.md) | Decisions with tradeoffs |
| [Open questions](docs/open-questions.md) | What is not decided |

Architecture §25 defines the canonical implementation phase order.

## Repository layout

```text
docs/                   Product, architecture, and decision documentation
src/apps-script/        Google Apps Script add-on
cloud/routing-broker/   Cloud Run routing service
test/                   Test plan (suite not yet present; see test/README.md)
.github/workflows/      CI
```

## License

MIT. See [LICENSE](LICENSE).
