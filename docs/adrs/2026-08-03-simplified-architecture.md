# ADR: No Planner or Capability layers in the MVP

## Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Status | Accepted |
| Owner | Project maintainer |
| Author | Danny Sauer |
| Scope | The internal layering between the reconciliation engine and the padding provider. |
| Related | [provider-boundary ADR](2026-08-03-provider-boundary.md); Architecture §5 |
| Revisit when | A second padding provider is being added |

## Business driver

The MVP has one provider (drivetime padding) and one capability (two travel blocks around a source). Abstractions sized for several of each cost complexity now against a need that may never arrive.

## Constraints

- The engine MUST stay testable without Calendar or the broker.
- Adding a provider later MUST NOT require rewriting the engine.

## Decision

**Y statement:** We will give the engine a single provider called through a stable `ProviderContext` that returns `GeneratedEventSpec` objects, with no separate Planner layer, Capability registry, provider version metadata, or large initial module tree, because one provider does not justify a framework, so the MVP stays small while the provider boundary keeps the door open.

## Consequences

- A second padding provider will need this boundary revisited. The bet is that reintroducing an abstraction against two real providers is cheaper than carrying a speculative one against zero.
- The provider boundary itself is fixed by the [provider-boundary ADR](2026-08-03-provider-boundary.md).

## Alternatives considered

### Planner and Capability layers

A Planner would coordinate several providers and a Capability registry would describe what each can do. Rejected for the MVP: they add indirection to every planning call to serve providers that do not exist.
