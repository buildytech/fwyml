# fwyml

Generic compiler from an [FW](https://github.com/buildytech/fw) product
manifest plus registry data into a user repository.

`fwyml` does not embed adapters, host runtimes, or UI kits. If a capability
is not selected, it is not downloaded, generated, or linked.

License: [Apache License 2.0](LICENSE).

## Runtime

Node 22 or newer. No adapter install is required to parse or validate a
manifest.

```bash
npx fwyml --version
npx fwyml validate --manifest fw.yaml
```

## Commands

| Command | Role |
| --- | --- |
| `fwyml validate` | check a manifest against the pinned FW schema |
| `fwyml resolve` | compute the graph, absences, and lock proposal |
| `fwyml fetch` | explicitly acquire selected pinned Git artifact sources |
| `fwyml sync --dry-run` | print the materialization plan |
| `fwyml sync` | write owned files, lock, and dependency manifests |
| `fwyml verify` | run lock, absence, and provenance checks |
| `fwyml verify --strict` | fail blocked or unverified records |
| `fwyml generate` | run selected generate-phase tools against a matching lock |
| `fwyml context` | emit a grounded pack; no model call |

`up` and `pack` wait until a generated product passes build conformance.

Registry precedence: `--registry`, then manifest `registries`, then the
bundled empty snapshot. Port specs, adapter pins, and product catalogs
live in FW and an external registry; this CLI does not vendor them. Network refresh is
never implicit. `fetch` is the only source-acquisition command; it
checks out an exact Git commit into `.fwyml/sources` by default.
For source trees whose layout differs from the materialized product,
`source.exports` maps each owned destination to its repository-relative file.

## Compatibility and locks

An adapter declares a contract and may declare neutral compatibility terms:
features, platforms, and runtimes. A manifest may require or forbid those
terms and may attach a contract range to a selected capability. Resolution
uses those declarations only; it has no product, package, or stack-name
branches.

`sync` writes a lock that binds the semantic manifest, loaded registry
documents, and materialization plan with SHA-256 digests. `verify` first
replays that lock; it does not run external validators when replay fails.
When a selection is removed, `sync` deletes only unchanged outputs that the
previous lock owned. A changed output is reported as a conflict.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | validation or resolution failure |
| 2 | verification failure |
| 3 | owned-file or lock conflict |
| 64 | usage |

`--json` prints a machine-readable report for every command.

## What this is not

- not a UI framework and not an IDE
- not a runtime plugin loader
- not a reimplementation of UI8Kit, UI8PX, Retag, Wails, or host SDKs

Architecture lives in `fw`. `fwyml` is the compiler.
