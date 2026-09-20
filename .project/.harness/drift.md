# Contract Drift and CLI Diagnostics

External registry records must make upstream change observable before a user product
is silently rebuilt against different behavior.

## Required provenance

Every registered artifact records:

- stable registry id and kind;
- source repository;
- immutable release, package version, or commit;
- contract id and supported version range;
- public contract surfaces and their SHA-256 digests;
- validator and harness ids with versions;
- conformance result for that exact source reference;
- dependency and conflict declarations.

Generated snapshots and lockfiles use immutable versions and integrity. A
floating branch may be used for discovery, never for reproducible sync or pack.

## Drift classes

| Class | Example | Required action |
| --- | --- | --- |
| metadata | corrected description, unchanged contract digest | republish registry revision |
| implementation | internal rewrite, unchanged public contract | rerun validators and conformance |
| compatible contract | optional field or operation with preserved defaults | bump capability minor and rerun consumers |
| breaking contract | removed field, changed behavior, new mandatory operation | bump capability major and publish migration |
| provenance | source or package changed without a new verified record | quarantine record; do not resolve in strict mode |
| superseded pattern | newer canonical rules replace an extracted invariant | deprecate old record and name replacement |

The declared version does not overrule evidence. If a public digest or
observable behavior changed, classifying it as metadata is a defect.

## Required `fwyml` diagnostics

Stable machine-readable codes:

| Code | Severity | Meaning |
| --- | --- | --- |
| `FWYML_UPDATE_AVAILABLE` | info | newer compatible registry record exists |
| `FWYML_SOURCE_DRIFT` | warning | discovered source differs from verified ref |
| `FWYML_REVERIFY_REQUIRED` | warning | implementation changed; conformance is stale |
| `FWYML_CONTRACT_DEPRECATED` | warning | selected contract has a named replacement |
| `FWYML_CONTRACT_INCOMPATIBLE` | error | selected adapter does not cover required contract |
| `FWYML_UNVERIFIED_ARTIFACT` | error in strict mode | version or integrity lacks conformance provenance |
| `FWYML_REGISTRY_INVALID` | error | registry schema, include, or source cannot be trusted |
| `FWYML_REGISTRY_AMBIGUITY` | error | one registry source declares an id more than once or includes cyclic data |
| `FWYML_SOURCE_MISSING` | error | selected artifact root or declared owned source file is absent |
| `FWYML_SOURCE_FETCH_FAILED` | error | a pinned Git artifact source cannot be acquired or cache identity differs |
| `FWYML_DEPENDENCY_CONFLICT` | error | selected records require different exact versions of one dependency |
| `FWYML_LOCK_MISMATCH` | error | materialized tree differs from the lock |
| `FWYML_ABSENCE_VIOLATION` | error | unselected capability is present |

Diagnostics include registry id, selected and discovered versions, contract
range, source ref, remediation, and whether lock or manifest must change.

## Update behavior

- Normal `sync`, `verify`, and `pack` are deterministic and use the lock.
- Registry refresh is explicit; no hidden network request changes resolution.
- A bundled registry snapshot provides offline operation.
- `update` may fetch newer registry metadata but must not rewrite the lock
  without an explicit apply/accept step.
- Major contract changes require an explicit manifest migration.
- Deprecated records continue resolving while their pinned artifacts remain
  verifiable.

## Change detection tests

For every drift class, fixtures must cover:

1. unchanged source and contract;
2. implementation-only source change;
3. compatible contract extension;
4. breaking contract change;
5. changed artifact with missing integrity;
6. selected deprecated record;
7. removed capability leaving a dependency or generated file behind.

Human-readable output may evolve. Diagnostic codes and JSON fields are public
CLI behavior and follow semantic versioning.
