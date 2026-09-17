// Package delivery owns portable on-disk layout beside the executable.
// Extracted from the reference desktop host. It does not create capability
// storage (browser, workspace caches) unless those adapters add it later.
package delivery

import (
	"fmt"
	"os"
	"path/filepath"
)

type Paths struct {
	Root, Data, State, WebView, Temp, Cache, Logs string
}

func BesideExecutable(executable string) Paths {
	root := filepath.Dir(executable)
	data := filepath.Join(root, "data")
	return Paths{
		Root:    root,
		Data:    data,
		State:   filepath.Join(data, "state"),
		WebView: filepath.Join(data, "webview"),
		Temp:    filepath.Join(data, "tmp"),
		Cache:   filepath.Join(data, "cache"),
		Logs:    filepath.Join(data, "logs"),
	}
}

func (p Paths) Prepare() error {
	for _, dir := range []string{p.State, p.WebView, p.Temp, p.Cache, p.Logs} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return fmt.Errorf("portable directory %s: %w", dir, err)
		}
	}
	probe, err := os.CreateTemp(p.Data, ".write-check-")
	if err != nil {
		return fmt.Errorf("portable data directory must be writable: %w", err)
	}
	name := probe.Name()
	_ = probe.Close()
	return os.Remove(name)
}
