# Plan for `buildytech/fw`

FW owns the vocabulary, registry source, specifications, and conformance. It
does not implement Wails, Templ, Svelte, Solid, WebView2, EditorY, or an agent
runtime.

## P0 — Correct ownership

The current FW planning documents still describe `fw new`, `fw sync`,
`fw verify`, and a generator inside `buildytech/fw`. Reconcile them with the
accepted boundary:

- FW publishes schemas, specs, registry records, and conformance assets.
- `fwyml` is the only CLI and materializer.
- adapter and vertical-slice implementations remain external artifacts.

Exit: no FW document assigns product materialization commands to an FW
executable.

## P1 — Publish draft schemas

Create versioned schemas for:

1. **Product manifest**
   - metadata;
   - explicit registry sources;
   - selected capabilities and adapters;
   - selected vertical slices;
   - guidance and validators;
   - required and forbidden technologies/capabilities.
2. **Registry envelope**
   - stable id, kind, version, contract range;
   - immutable source and integrity;
   - dependencies, conflicts, provides, and requirements;
   - platform/runtime compatibility;
   - generated or installed artifact ownership.
3. **Lock**
   - resolved registry snapshot;
   - exact npm, Go, Composer, Cargo, git, and generated artifact refs;
   - source and output digests;
   - conformance provenance.
4. **Harness result**
   - command, version, inputs, exit semantics, diagnostics, evidence.

Required registry kinds:

| Kind | Purpose |
| --- | --- |
| `capability` | stack-neutral port and conformance reference |
| `adapter` | one concrete implementation of one capability |
| `generator` | external code generator such as UI8Kit Codegen |
| `validator` | external executable check such as UI8PX or `svelte-check` |
| `guidance` | rules/spec files copied into the user repository |
| `vertical-slice` | selected UI/orchestration glue over declared ports |
| `product-template` | minimal composition root, not a finished product |
| `delivery` | package layout and build output contract |

Exit: all three manifests in this folder validate without naming a special IDE
schema.

## P2 — Define composition semantics

Vertical slices are registry data, not FW capabilities. Each slice declares:

- required capabilities;
- provided surfaces;
- compatible UI and host families;
- required adapters or abstract adapter constraints;
- generated/copied files it owns;
- dependencies and conflicts;
- removal behavior;
- guidance and validators it contributes.

Removal must be deterministic. A removed slice leaves no owned file, dependency,
menu item, route, generated binding, or delivery artifact.

The product manifest selects one UI runtime. A slice may support multiple
runtimes through separate artifacts, but a product resolves exactly one.

Exit: the same `agent-chat-surface` contract can resolve to Svelte or Solid
without FW importing either framework.

## P3 — Draft the required capabilities

Define six obligations for the initial VSA ports:

| Port | Key contract boundary |
| --- | --- |
| `host@0` | application lifecycle, native window, IPC, events, asset serving |
| `ui@0` | one selected runtime, semantic primitives, generated ownership |
| `workspace@0` | folder authority, safe paths, revision-checked writes |
| `editor@0` | buffer/document value, selection, change and lifetime |
| `explorer@0` | workspace tree projection and open intent |
| `vcs@0` | status, diff, stage, commit, fetch/pull/push failures |
| `agent@0` | closed event stream, prompt, abort, capabilities, opaque runtime |
| `browse@0` | native view lifecycle, navigation, inspect, isolated storage |
| `delivery@0` | reproducible on-disk artifact and portable state layout |

Non-obligations must be explicit:

- `ui` does not require a framework or ship primitives;
- `host` does not require Wails;
- `editor` does not promise CodeMirror or visual Markdown;
- `agent` does not promise a provider;
- `browse` does not promise full-browser DevTools or device emulation;
- `delivery` does not prescribe Windows except in its adapter.

## P4 — Define external tool records

FW records existing tools rather than replacing them.

Example responsibilities:

- UI8Kit Codegen record: package/version, runtime selector, output ownership,
  verify command, and generated-file policy.
- UI8PX record: package/version, preparation command, scan inputs, policy
  paths, diagnostics, and exit semantics.
- Retag record: rule pack plus validator command; no duplicate implementation
  in FW or `fwyml`.
- Wails record: required CLI version, binding generation, build commands, and
  output.
- Templ, `svelte-check`, TypeScript, Go test/vet, ARIA, and locale validators:
  exact commands and prerequisites.

Exit: `fwyml` can install or invoke every selected tool from registry data
without an id-specific branch.

## P5 — Add local draft registry records

Create records for the artifacts listed in `matrix.yaml`. During this VSA they
resolve from `IDEBuildY/.temp/fwyml-vsa-ide/artifacts`. Every local record still
has:

- source path;
- source repository and commit;
- public surface digest;
- output digest;
- supported contract range;
- readiness (`draft`, `verified`, or `blocked`);
- validator and conformance refs.

Blocked records resolve only in planning/dry-run mode. `sync`, `verify`, and
`pack` must not represent them as working.

## P6 — Conformance and drift

Add conformance scenarios for:

- Wails process and window lifecycle;
- one selected UI runtime and zero foreign UI runtimes;
- workspace path/revision invariants;
- normalized agent events;
- isolated browser sessions and process disposal;
- portable delivery;
- vertical-slice removal and physical absence.

Adopt the diagnostic classes in `.project/.harness/drift.md`. In particular,
an EditorY rewrite with unchanged declared contract but a changed artifact
digest becomes `FWYML_REVERIFY_REQUIRED`; changed public behavior requires a
contract version change.

Exit: a changed or unverified local artifact cannot silently update a generated
user repository.

