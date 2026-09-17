package delivery

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBesideExecutableLayout(t *testing.T) {
	root := t.TempDir()
	exe := filepath.Join(root, "app.exe")
	paths := BesideExecutable(exe)
	if paths.Root != root || filepath.Base(paths.Logs) != "logs" {
		t.Fatalf("paths: %+v", paths)
	}
	if err := paths.Prepare(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(paths.State); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(paths.Data, "browser")); err == nil {
		t.Fatal("delivery must not create browser storage")
	}
}
