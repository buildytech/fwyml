# Framework Extraction Harness

This directory is the durable operating contract for studying real products
and evolving BuildY Framework and `fwyml` without collapsing them into one
repository or one stack.

It guides the agent. It is not a public FW contract, a registry bundle, or CLI
runtime behavior.

## Fixed boundaries

| Owner | May contain | Must not contain |
| --- | --- | --- |
| `fw` | schemas, port specs, conformance scenarios | adapter implementations, adapter pins or product verticals |
| `fwyml` | generic YAML resolver, pinned schemas, empty registry envelope, diagnostics, runner | adapter/runtime dependencies or product special cases |
| external registry | adapter, generator, validator and preset records | compiler or FW contract ownership |
| source product | concrete stack, business slices, implementation, tests | authority over the framework vocabulary |
| user product | selected packages, generated glue, product code, lock and CI | unselected capabilities in its dependency graph or artifact |

The source product being inspected is evidence. It is never modified during
framework extraction unless the user explicitly requests product work.

## Authority and corrections

The latest user request controls the immediate scope. It does not silently
overturn these boundaries. If a request conflicts with the harness, report the
conflict and require an explicit architecture decision before changing the
boundary.

Current canonical evidence:

- SvelteCMS `.cursor/rules` for spec-driven admin structure, repository-owned
  transport, UI8Kit composition, Retag, UI8PX, accessibility, and validation.
- ContentlY `.cursor/rules` for portable workshop ownership, Codex/FormSet
  boundaries, file authority, derived indexes, Svelte DX, UI8Kit, Retag,
  UI8PX, and accessibility.

Canonical means authoritative for the applicable pattern, not universally
newer or correct for every product. Freshness must be established on every
intake.

## Intake sequence

1. Identify the source repository, requested scope, and applicable canonical
   sources.
2. Establish freshness using the procedure in `workflow.md`. Never call a
   source current when its upstream status is unknown.
3. Read active rules, manifests, public contracts, validators, tests, and
   package boundaries before implementation details.
4. Decompose evidence using the classification in `policy.yaml`.
5. Compare candidates with existing FW records and `fwyml` behavior.
6. Produce a bounded extraction report before edits.
7. Update in order: FW contract, external registry and pinned schemas, generic CLI
   behavior, tests and fixtures.
8. Run the affected source validators plus FW and CLI harness checks.
9. Record source references and contract digests so later drift is detectable.

## Non-negotiable gates

- A product-specific concept remains a product slice or preset.
- A stack-specific implementation remains an adapter record.
- A rule becomes an FW invariant only when it is observable across
  implementations.
- A validator is registered as an executable tool with inputs, outputs, exit
  semantics, and version; its prose rule alone is insufficient.
- `fwyml` gains code only for generic schema, resolution, materialization,
  diagnostics, or harness behavior.
- A registry change must not install anything until selected by a user
  manifest.
- Contract drift follows `drift.md`; changed public behavior is never hidden by
  a registry metadata update.

## Files

Current extraction plan: [SiteStarter conveyor](intakes/site-conveyor/plan.md).
It separates implemented compiler fixes from product work awaiting plan
acceptance and from unresolved release gates.

| File | Role |
| --- | --- |
| `policy.yaml` | machine-readable operating policy and ownership map |
| `workflow.md` | source freshness, decomposition, update, and verification flow |
| `drift.md` | contract drift classes and required CLI diagnostics |
| `intake.template.yaml` | repeatable evidence record for one source product |
| `cases/drift.yaml` | executable-spec fixtures for future CLI drift tests |
