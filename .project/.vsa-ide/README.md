# Wails 3 IDE Vertical Slice

This folder plans the first end-to-end proof that a new user repository can
run `npx fwyml` and materialize one of three physically distinct Wails 3
products from FW registry data.

The existing IDE BuildY is evidence only. It is not generated output and is
not modified by this extraction except for the explicitly requested local
staging reservation under `IDEBuildY/.temp`.

## Target products

| Id | UI runtime | Present | Physically absent |
| --- | --- | --- | --- |
| `workshop-templ` | Go Templ | workspace, explorer, editor, Git, browser | agent runtime, chat surface, Svelte, Solid |
| `workshop-svelte-agent` | Svelte 5 | workspace, explorer, EditorY, Git, agent chat | browser, WebView2 adapter, Solid, Templ |
| `assistant-solid-browser` | SolidJS | agent chat, native browser | workspace, code editor, explorer, Git, language tools, Svelte, Templ |

The first target exposes an unresolved contract question: a Wails WebView
still executes browser-side code. Templ can own generated markup, but an IDE
editor equivalent to CodeMirror is not "pure Go." The target remains blocked
until the product chooses either:

1. a deliberately limited Templ/textarea editor with no CodeMirror claim; or
2. a browser-side editor adapter, while "Go Templ" describes the application
   UI authoring/runtime rather than zero JavaScript.

No implementation may hide this distinction.

## Evidence

- IDE BuildY supplies the Wails 3 host, portable delivery, workspace, Git,
  browser/WebView2, Solid primitives, chat surface, and agent event contract
  candidates.
- ContentlY supplies the canonical Wails 3 + Svelte composition, Svelte
  primitives, UI8PX/Retag rules, and validation pipeline.
- SvelteCMS rules remain canonical for spec-driven Svelte admin composition.
- UI8Kit Codegen supplies generated Templ, Svelte, and Solid primitive hosts.
- EditorY supplies the Svelte editor package, but its current package release
  and contract must be registered and verified independently.

Source identity and freshness are recorded in `intake.yaml`.

## Ownership

This VSA produces three plans, not three hardcoded CLI branches:

- FW receives contracts, registry kinds, conformance, and source records.
- `fwyml` receives generic local-registry, resolver, materialization,
  guidance, validator, context-pack, and absence-check behavior.
- adapters and reusable slices leave source products as separate packages or
  repositories; they are staged locally before publication.
- generated user repositories contain only their selected graph.

## Files

| File | Purpose |
| --- | --- |
| `intake.yaml` | evidence refs, freshness, classification, and known gaps |
| `matrix.yaml` | capability, artifact, validator, and absence matrix |
| `fw.plan.md` | exact work for `buildytech/fw` |
| `fwyml.plan.md` | exact work for the CLI |
| `acceptance.md` | end-to-end and physical-absence gates |
| `manifests/*.yaml` | draft user manifests for the three products |

## Delivery sequence

1. Correct FW/FWYML ownership vocabulary before adding implementation.
2. Publish draft schemas and registry kinds in FW.
3. Implement the smallest `fwyml` path: registry load, resolve, lock,
   materialize, guidance, verify, context.
4. Extract or generate local artifacts into `IDEBuildY/.temp/fwyml-vsa-ide`.
5. Materialize one new repository per manifest.
6. Make each selected composition build with Wails 3.
7. Prove absent capabilities are absent from source, dependency files, and
   delivery artifacts.
8. Replace local sources with immutable package/repository releases without
   changing product manifests other than source resolution and lock data.

