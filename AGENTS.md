# Agent notes

`fwyml` is a generic YAML compiler. It validates, resolves, fetches, syncs,
verifies, generates, and emits context. It does not know which product
types or stacks it will produce.

`fw` owns the contract (schemas, ports, conformance). This repository pins
those schemas for offline parse. Adapter pins and product catalogs live in
an **external** registry. The bundled snapshot is an empty envelope.

Public commands: [`README.md`](README.md).
Extraction procedure: [`.project/.harness/README.md`](.project/.harness/README.md).
Always-on rule: [`.cursor/rules/framework-extraction-harness.mdc`](.cursor/rules/framework-extraction-harness.mdc).
Architecture: the sibling `fw` repository, especially `fw/.project/intent.md`.

## Do

- Keep the resolver generic: kind, source kind, compatibility terms only.
- Take registry data from `--registry` or the product manifest.
- Preserve physical absence. Do not invent files for unselected ports.
- Keep schema `$id` and `schemaVersion` as URNs (`urn:fwyml:*`).

## Do not

- Vendor adapters, port catalogs, UI kits, or host SDKs.
- Add product or stack special cases (`wails`, `svelte`, SiteStarter, IDE).
- Treat source products as templates or copy them into this repo.
- Refresh the network implicitly. `fetch` is the only source-acquisition
  command.
