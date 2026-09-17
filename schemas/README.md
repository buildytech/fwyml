# FW schemas

Canonical, versioned documents for `schemaVersion: fw.buildy.tech/v0alpha1`.

`fwyml` may pin copies for offline parse. This directory remains the source
of truth. None of these schemas name a product vertical.

| File | Kind |
| --- | --- |
| `product-manifest.schema.json` | user `fw.yaml` |
| `registry-envelope.schema.json` | registry index and records |
| `lock.schema.json` | resolved snapshot |
| `harness-result.schema.json` | command report |

Registry kinds are listed in `registry-kinds.md`.
