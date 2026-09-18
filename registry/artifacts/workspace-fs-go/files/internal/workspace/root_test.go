package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenRejectsEmptyAndFiles(t *testing.T) {
	t.Parallel()
	if _, err := Open("   "); err == nil {
		t.Fatal("expected empty path to fail")
	}
	file := filepath.Join(t.TempDir(), "notes.txt")
	if err := os.WriteFile(file, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(file); err == nil {
		t.Fatal("expected a file path to fail")
	}
}

func TestOpenDirectoryIsAgentCwd(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	root, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if root.Abs != filepath.Clean(dir) && root.Abs != dir {
		want, _ := filepath.Abs(dir)
		if root.Abs != filepath.Clean(want) {
			t.Fatalf("abs=%q dir=%q", root.Abs, dir)
		}
	}
	if root.Label != filepath.Base(root.Abs) {
		t.Fatalf("label=%q", root.Label)
	}
	if root.Empty() {
		t.Fatal("root should not be empty")
	}
}
