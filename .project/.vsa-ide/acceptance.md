# VSA Acceptance

This slice is complete only when three clean user repositories are produced by
the same generic `fwyml` binary and FW registry schema.

## 1. Bootstrap

From an empty git repository:

```text
copy one draft manifest to fw.yaml
set FWYML_VSA_REGISTRY to the local registry index
npx fwyml validate
npx fwyml resolve
npx fwyml sync --dry-run
npx fwyml sync
npx fwyml context
npx fwyml verify --strict
```

No source file from IDE BuildY or ContentlY is copied by an undocumented step.
Every file and dependency comes from a resolved registry record and appears in
the lock ownership map.

## 2. Shared Wails 3 gate

Every product:

- has a Go composition root;
- pins a Wails 3 contract-compatible release;
- generates bindings from its selected service surface;
- embeds only its selected frontend output;
- starts one native application window;
- exits without orphan selected sidecars or browser processes;
- passes `go test`, `go vet`, registered UI checks, and Wails build;
- produces the registered portable Windows layout.

Product names, menu entries, services, and routes are supplied by selected
template/slice records, not hardcoded in `fwyml`.

## 3. Product behavior

### `workshop-templ`

- Wails 3 starts with Templ-owned application markup.
- Workspace open, tree, editor, Git, and native browser behaviors pass their
  selected contracts.
- No chat surface or agent runtime starts or ships.
- The editor acceptance level is declared honestly. A textarea implementation
  cannot claim CodeMirror parity.

### `workshop-svelte-agent`

- Wails 3 starts with one Svelte 5 application shell.
- EditorY Svelte loads and preserves its registered document contract.
- Agent events stream through the closed agent contract.
- The browser surface, WebView2 browser adapter, browser bindings, and browser
  storage are absent.

### `assistant-solid-browser`

- Wails 3 starts with one Solid application shell.
- Chat and native WebView2 browser compose without an editor tab abstraction.
- Browser navigation, inspect-to-chat, hard reload, isolated storage, and close
  disposal pass.
- Workspace, file tree, file operations, CodeMirror/EditorY, Git, languages,
  and terminal are absent.

## 4. Physical absence

For each forbidden capability, verify all levels:

1. no selected graph node;
2. no lock entry;
3. no package-manager dependency;
4. no owned source or generated file;
5. no generated binding or native menu entry;
6. no runtime process or storage directory;
7. no delivery artifact;
8. no active guidance or validator for the absent capability.

Documentation may name absent capabilities only in the generated absence
report and non-obligations.

## 5. External tool delegation

Inspect the resolved plan and prove:

- UI8Kit Codegen generated only the selected runtime;
- UI8PX ran its own registered command and version;
- Retag/ARIA checks came from their registered tools or rule packs;
- Svelte, Solid, Templ, Go, and Wails checks ran only where selected;
- no implementation of those tools exists in `fwyml`.

## 6. Change and drift

Required regression scenarios:

- rewrite an adapter implementation without changing its public contract:
  `FWYML_REVERIFY_REQUIRED`;
- change EditorY public behavior without changing its declared contract:
  reject the registry update;
- publish a compatible contract minor: report update, preserve current lock;
- publish an incompatible major: require explicit manifest migration;
- edit a generated owned file: refuse silent overwrite;
- remove `browse` or `agent`: delete only owned artifacts and prove absence;
- modify a local staged artifact after lock: `FWYML_SOURCE_DRIFT`;
- remove integrity or conformance provenance: strict verification fails.

## 7. Context pack

For each repository, the generated context pack enables an external LLM or QA
operator to answer without inspecting the source products:

- what was selected and why;
- which concrete packages and source refs implement it;
- which contracts and non-obligations apply;
- which files are generated or user-owned;
- which commands verify the product;
- which capabilities must be absent;
- which blockers remain.

The context pack must not contain specs for unselected adapters.

## 8. Promotion gate

Local `.temp` sources are development-only. Publication is complete when:

- every selected reusable artifact has an immutable package/repository ref;
- registry integrity and conformance match that ref;
- the bundled `fwyml` snapshot contains the verified records;
- all three products regenerate without local absolute paths;
- `pack` refuses any unresolved, blocked, dirty, or local artifact.

