# Product Intake Workflow

Use this workflow when the user supplies an IDE, CMS, editor, library, rule
set, package, validator, or completed product as evidence for the ecosystem.

## 1. Establish source identity

Record:

- repository and local path;
- branch, commit, package versions, and lockfile state;
- dirty/ahead/behind/unknown status;
- user-designated canonical sources for the applicable domain;
- exact surfaces being studied.

Local files prove local state only. If remote state was not checked, report
upstream freshness as `unknown`. A dirty working tree may be useful evidence,
but it must not be described as a released contract.

Freshness states:

| State | Meaning |
| --- | --- |
| `current` | configured upstream and selected release/ref agree |
| `ahead` | local evidence contains unreleased changes |
| `dirty` | uncommitted evidence is present |
| `behind` | a newer configured upstream ref exists |
| `unknown` | remote freshness was not established |
| `superseded` | a designated canonical source replaced this pattern |

Do not reject useful evidence only because it is old. Classify it as historical
and compare it with the current authority.

## 2. Inspect contracts before implementation

Read in this order:

1. active repository and agent rules;
2. intent, architecture, and decision records;
3. package manifests and exported public surfaces;
4. validators, test commands, and CI;
5. source-of-truth and ownership boundaries;
6. implementation only where needed to prove behavior.

Rules such as UI8PX or Retag are candidates, not automatically FW contracts.
Extract the observable invariant and executable validator separately.

Example:

```text
Product rule: views contain no raw layout tags
Contract candidate: UI composition zones are declared
Validator record: ui8px/retag command, version, input globs, exit semantics
Adapter detail: Svelte files are mirrored before scanning
```

## 3. Decompose evidence

Classify every candidate:

- **contract** — stack-neutral operation, event, invariant, or
  non-obligation;
- **registry** — versioned metadata for a real repository, package, adapter,
  rule set, validator, or harness;
- **conformance** — stack-neutral scenario with observable expectations;
- **validator** — executable stack-specific check;
- **adapter** — implementation of one contract on one stack;
- **slice/preset** — reusable vertical composition owned outside core;
- **product** — business model, copy, route, fixture, or workflow;
- **discard** — stale, duplicated, accidental, or unverifiable evidence.

Never promote a filename, framework convention, or product noun into a port
without a stack-neutral observable behavior.

## 4. Produce an extraction report

Before changing FW or `fwyml`, state:

- source identity and freshness;
- evidence read;
- candidates grouped by classification;
- existing records affected;
- proposed contract version effect;
- FW changes;
- registry changes;
- generic CLI changes, if any;
- tests and validators required;
- explicit non-goals and source products left untouched.

Use `intake.template.yaml` as the machine-readable companion.

## 5. Apply changes in ownership order

1. Add or revise FW schemas, specs, and conformance.
2. Add registry records for concrete packages, repositories, validators, and
   presets.
3. Produce a versioned registry snapshot with integrity metadata.
4. Change `fwyml` only when generic resolution, lock, diagnostics,
   materialization, context emission, or harness execution needs a new
   behavior.
5. Add fixture products that prove selection and physical absence.
6. Do not rewrite the source product as part of extraction.

One product must never create a CLI branch such as `if product == cms` or
`if adapter == svelte`. Differences belong in registry data and adapters.

## 6. Verify

Verification is proportional to the extracted evidence:

- run the source repository's canonical validators;
- run FW schema and conformance checks;
- run `fwyml` resolver, lock, snapshot, and diagnostics tests;
- materialize a fixture user product;
- prove selected artifacts exist;
- prove unselected packages, generated glue, and delivery files are absent;
- verify context-pack contains selected specs and explicit non-obligations;
- test drift diagnostics defined in `drift.md`.

If a source validator cannot run, record the missing prerequisite. Do not
replace it with an invented substitute.

## 7. Close the intake

Persist source refs and digests, the resulting FW record versions, conformance
results, and unresolved questions. Do not claim extraction complete while a
changed public contract lacks a migration or matching harness update.

