# fwyml: Declarative CLI Runner for the BuildY Ecosystem

**The declarative YAML runner for [BuildY Framework](https://github.com/buildytech/fw).**

Package: [fwyml on npm](https://www.npmjs.com/package/fwyml).  
Source: [github.com/buildytech/fwyml](https://github.com/buildytech/fwyml).

`fwyml` reads a product manifest and invokes `buildytech/fw` packages. It does
not embed adapters, host runtimes, or UI kits. If a capability is not in the
manifest, `fwyml` does not pull that package — absence is physical.

License: [Apache License 2.0](LICENSE).

## Why fwyml?

`fw` is the contract: ports, DTOs, invariants, and a conformance suite.
`fwyml` is the command that turns that contract into a composition root.

You describe the product in YAML. `fwyml` resolves the selected `fw`
packages, scaffolds the root, and runs verify or delivery through those
packages. No per-stack init scripts. No feature flags that leave unused
code in the tree.

## Install

No global install required:

```bash
npx fwyml init
npx fwyml sync
npx fwyml verify
```

## Manifest

```yaml
product: wp-theme-studio
contract: 1.x
capabilities:
  workspace: { adapter: fs-local }
  ui:        { adapter: ui-latte }
  host:      { adapter: host-php-cli }
  preview:   { adapter: pack-nginx-mariadb }
delivery: portable-windows
```

The manifest is the only place where concrete technologies meet. `fwyml`
forwards each selected capability to the matching `fw` package. Unlisted
capabilities are not downloaded, generated, or linked.

## Commands

| Command | Role |
| --- | --- |
| `fwyml init` | scaffold a product root from the manifest |
| `fwyml sync` | reconcile the root after a manifest change |
| `fwyml verify` | run `fw` conformance for selected capabilities |
| `fwyml up` | assemble and start the selected composition |
| `fwyml pack` | produce the delivery artifact |

## What this is not

- not a UI framework and not an IDE
- not a runtime plugin loader
- not a wrapper that vendors every adapter into one binary

Architecture lives in `fw`. `fwyml` is the runner.

## License

Copyright 2026 BuildY.

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
