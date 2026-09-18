package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCheckedWriteDetectsSameSizeSameTimestampEdit(t *testing.T) {
	root := t.TempDir()
	original, err := WriteText(root, "a.ts", "const a = 1;\n")
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "a.ts")
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("const a = 2;\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, info.ModTime(), info.ModTime()); err != nil {
		t.Fatal(err)
	}
	result, err := WriteTextAt(root, "a.ts", "local edit", original.Revision, false)
	if err != nil {
		t.Fatal(err)
	}
	if result.OK || result.Conflict != "changed" || result.Disk.Text != "const a = 2;\n" {
		t.Fatalf("missed external edit: %+v", result)
	}
}

func TestSaveDoesNotClobberExistingTempNamedFile(t *testing.T) {
	root := t.TempDir()
	other := filepath.Join(root, "a.ts.ide-tmp")
	if err := os.WriteFile(other, []byte("user content"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := WriteText(root, "a.ts", "saved"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(other)
	if err != nil || string(data) != "user content" {
		t.Fatalf("clobbered sibling: %q %v", data, err)
	}
}

func TestRepeatedTrashKeepsBothVersions(t *testing.T) {
	root := t.TempDir()
	if _, err := WriteText(root, "a.ts", "first"); err != nil {
		t.Fatal(err)
	}
	first, err := TrashRel(root, "a.ts")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := WriteText(root, "a.ts", "second"); err != nil {
		t.Fatal(err)
	}
	second, err := TrashRel(root, "a.ts")
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("trash entries collide")
	}
	for path, expected := range map[string]string{first: "first", second: "second"} {
		body, err := ReadText(root, path)
		if err != nil || body.Text != expected {
			t.Fatalf("lost trashed version: %+v %v", body, err)
		}
	}
	if _, err := RestoreRel(root, first); err != nil {
		t.Fatal(err)
	}
	if _, err := RestoreRel(root, second); err == nil {
		t.Fatal("restore overwrote existing file")
	}
}
