# Wails bindings (generated)

Do **not** hand-edit files under this directory except this README.

After `fwyml sync`, regenerate:

```bash
task generate
# or: wails3 generate bindings -ts -names
```

Solid UI imports services from `frontend/bindings/example.com/app/compose/*` via `src/lib/host.ts` and `src/lib/workbench.ts`. Vite browser preview falls back to `preview-session` when `?preview=` is set or native host (`window.go` / `window.wails`) is absent.
