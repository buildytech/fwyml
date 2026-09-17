# Plan for `buildytech/fwyml`

`fwyml` is a generic compiler from a product YAML plus FW registries into a
concrete user repository. It does not implement the selected tools.

## C0 — Publish a real CLI package

Add:

- a `bin` entry for `fwyml`;
- Node 22+ runtime declaration;
- typed source and build output;
- deterministic JSON output mode and documented exit codes;
- unit and fixture test commands;
- package contents limited to CLI code, schemas required to parse input, and a
  pinned offline registry snapshot.

Generic parser/schema dependencies are allowed. Wails, Templ, Svelte, Solid,
UI8Kit, UI8PX, EditorY, WebView2, and agent SDKs are not CLI dependencies.

Exit:

```text
npx fwyml --version
npx fwyml validate --manifest fw.yaml
```

work without installing an adapter.

## C1 — Registry and manifest loading

Support registry sources in explicit precedence order:

1. `--registry <file-or-url>`;
2. manifest-declared registries;
3. pinned bundled snapshot.

For this VSA:

```text
FWYML_VSA_REGISTRY=<absolute path>/IDEBuildY/.temp/fwyml-vsa-ide/registry/index.yaml
```

Network refresh is explicit. Normal validate/resolve/sync/verify uses the lock
and does not silently fetch new registry data.

Required commands:

```text
fwyml validate
fwyml resolve
fwyml sync --dry-run
fwyml sync
fwyml verify
fwyml context
```

`up` and `pack` wait until one generated product passes build conformance.

## C2 — Generic graph resolver

Resolve only registry semantics:

- dependencies and transitive dependencies;
- exactly one adapter per single-provider capability;
- platform/runtime requirements;
- conflicts and forbidden capabilities;
- vertical-slice requirements;
- generator outputs;
- guidance and validators;
- blocked/unverified status;
- integrity and contract ranges.

The resolver must not contain branches for IDE, Wails, Svelte, Solid, Templ,
UI8Kit, or any registry id. All differences come from data.

Resolution outputs:

- normalized graph;
- diagnostics with stable codes;
- proposed lock;
- file/dependency/tool plan;
- explicit absent capability set.

## C3 — Safe materialization

Materializers are generic by artifact source kind:

| Source kind | Initial behavior |
| --- | --- |
| `npm` | add exact dependency/devDependency to user `package.json` |
| `go-module` | add module requirement; local draft may add a generated replace |
| `git` | resolve immutable commit and declared subpath/archive |
| `local` | use an explicit absolute source for development only |
| `generated` | invoke the registered external generator with declared args |
| `files` | copy declared template/rule files with integrity |

`fwyml` records every owned output. `sync` may update or delete only files that
the prior lock says it owns. A user-modified generated file causes a conflict,
not silent overwrite.

Before mutation, emit the same plan used by `--dry-run`. Install/package-manager
execution is explicit and its stdout, stderr, and exit status enter the report.

For local development:

- npm artifacts may use `file:` sources;
- Go artifacts may use generated `replace` directives;
- local absolute paths are marked non-portable in the lock;
- `pack` refuses local sources;
- switching to published immutable records removes local overrides.

## C4 — Tool and guidance orchestration

`fwyml` does not replace external tools.

For a selected UI runtime it prepares only what registry records declare:

- package and generator references;
- config and script fragments;
- generated ownership;
- `.cursor/rules` or other guidance files;
- command ordering and working directories;
- expected machine-readable output and exit semantics.

Examples:

- invoke UI8Kit Codegen for exactly `templ`, `svelte`, or `solid`;
- install and invoke UI8PX at its pinned version;
- install Retag rules/validator rather than reproducing its checks;
- preserve required `svelte.config.js`, Solid TypeScript config, or Templ
  generation steps through selected guidance;
- invoke Wails binding generation only after registered service surfaces exist.

No validator logic is rewritten in `fwyml`.

## C5 — LLM context pack

`fwyml context` deterministically emits:

- normalized selected graph and lock;
- selected FW port specs and non-obligations;
- selected slice specs;
- package/repository/source map;
- generated-file ownership;
- active guidance;
- validator commands;
- explicit absent capabilities and forbidden technologies;
- unresolved blockers and drift diagnostics.

The command makes no model call. It provides complete grounded input for an
external agent, trainee, or QA workflow.

## C6 — Verification

`fwyml verify` executes selected registered validators and FW conformance in
dependency order. It also verifies:

- materialized package manifests match the lock;
- generated/copied files match ownership and integrity;
- no forbidden package, directory, binding, route, or delivery artifact exists;
- local sources have not drifted from recorded digests;
- every selected adapter covers the required contract;
- blocked or unverified records cannot pass strict verification.

Use `.project/.harness/cases/drift.yaml` as the initial diagnostic fixture.

## C7 — VSA fixture products

Materialize each manifest into a clean directory under local staging:

```text
products/workshop-templ
products/workshop-svelte-agent
products/assistant-solid-browser
```

Tests compare:

- dependency manifests;
- generated tree;
- rules and scripts;
- lock and context pack;
- selected validators;
- physical-absence report.

The fixture names must not appear in resolver or materializer source code.

## C8 — Promotion

After local products pass:

1. extract each reusable artifact into its intended repository/package;
2. publish immutable versions;
3. add verified FW registry records;
4. refresh the bundled CLI registry snapshot;
5. regenerate user products without local sources;
6. verify tree shape is unchanged except for lock/source provenance.

