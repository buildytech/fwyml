package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenAndSafePath(t *testing.T) {
	root := t.TempDir()
	opened, err := Open(root)
	if err != nil || opened.Empty() {
		t.Fatalf("open: %+v %v", opened, err)
	}
	if _, _, err := RelSafe(opened.Abs, "../escape"); err == nil {
		t.Fatal("escape must fail")
	}
}

func TestRevisionWrite(t *testing.T) {
	root := t.TempDir()
	first, err := WriteTextAt(root, "a.txt", "one", "", true)
	if err != nil || !first.OK {
		t.Fatalf("write: %+v %v", first, err)
	}
	stale, err := WriteTextAt(root, "a.txt", "two", "stale", false)
	if err != nil || stale.OK || stale.Conflict != "changed" {
		t.Fatalf("stale: %+v %v", stale, err)
	}
	ok, err := WriteTextAt(root, "a.txt", "two", first.Body.Revision, false)
	if err != nil || !ok.OK {
		t.Fatalf("checked write: %+v %v", ok, err)
	}
	data, _ := os.ReadFile(filepath.Join(root, "a.txt"))
	if string(data) != "two" {
		t.Fatalf("disk %q", data)
	}
}
