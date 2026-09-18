package workspace

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRelSafeRejectsEscape(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if _, _, err := RelSafe(root, "../outside"); err == nil {
		t.Fatal("expected escape to fail")
	}
	if _, _, err := RelSafe(root, `C:\Windows`); err == nil {
		t.Fatal("expected absolute path to fail")
	}
	if err := RevealRel(root, "../outside"); err == nil {
		t.Fatal("reveal must refuse an escaped path")
	}
}

func TestListTreeSkipsVendorAndReadsText(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "node_modules", "x"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "main.go"), []byte("package main\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "node_modules", "x", "index.js"), []byte("nope"), 0o600); err != nil {
		t.Fatal(err)
	}
	tree, err := ListTree(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, node := range tree {
		if node.Name == "node_modules" {
			t.Fatal("node_modules must be skipped")
		}
	}
	if len(tree) != 1 || tree[0].Name != "src" || !tree[0].Dir {
		t.Fatalf("tree=%+v", tree)
	}
	if len(tree[0].Children) != 1 || tree[0].Children[0].Path != "src/main.go" {
		t.Fatalf("children=%+v", tree[0].Children)
	}
	body, err := ReadText(root, "src/main.go")
	if err != nil {
		t.Fatal(err)
	}
	if body.Text != "package main\n" || body.Path != "src/main.go" {
		t.Fatalf("body=%+v", body)
	}
	written, err := WriteText(root, "src/main.go", "package demo\n")
	if err != nil || written.Text != "package demo\n" {
		t.Fatalf("write=%+v err=%v", written, err)
	}
	again, err := ReadText(root, "src/main.go")
	if err != nil || again.Text != "package demo\n" {
		t.Fatalf("reread=%+v err=%v", again, err)
	}
	if written.Revision == "" || again.Revision == "" {
		t.Fatal("write and read must return a revision")
	}
}

func TestWriteTextAtRejectsStaleRevision(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	first, err := WriteText(root, "src/a.ts", "const A = 1;\n")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "a.ts"), []byte("const A = 99;\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	stale, err := WriteTextAt(root, "src/a.ts", "const A = 1;\n", first.Revision, false)
	if err != nil {
		t.Fatal(err)
	}
	if stale.OK || stale.Conflict != "changed" || stale.Disk.Text != "const A = 99;\n" {
		t.Fatalf("stale=%+v", stale)
	}
	disk, err := ReadText(root, "src/a.ts")
	if err != nil || disk.Text != "const A = 99;\n" {
		t.Fatalf("disk must keep the external edit: %+v err=%v", disk, err)
	}
	forced, err := WriteTextAt(root, "src/a.ts", "const A = 1;\n", first.Revision, true)
	if err != nil || !forced.OK || forced.Body.Text != "const A = 1;\n" {
		t.Fatalf("overwrite=%+v err=%v", forced, err)
	}
}

func TestSearchLiteralAndTrash(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "a.ts"), []byte("const token = 1;\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	created, err := CreateFile(root, "src/new.ts")
	if err != nil || created.Path != "src/new.ts" {
		t.Fatalf("create=%+v err=%v", created, err)
	}
	if _, err := CreateFile(root, "src/new.ts"); err == nil {
		t.Fatal("create must reject an existing file")
	}
	hits, err := SearchLiteral(root, "token", true)
	if err != nil || len(hits) != 1 || hits[0].Path != "src/a.ts" || hits[0].Line != 1 {
		t.Fatalf("hits=%+v err=%v", hits, err)
	}
	if err := os.WriteFile(filepath.Join(root, "src", "b.go"), []byte("const token = 2;\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	onlyTS, err := SearchLiteralFilter(root, "token", true, "*.ts", "")
	if err != nil || len(onlyTS) != 1 || onlyTS[0].Path != "src/a.ts" {
		t.Fatalf("include=%+v err=%v", onlyTS, err)
	}
	noTS, err := SearchLiteralFilter(root, "token", true, "", "*.ts")
	if err != nil || len(noTS) != 1 || noTS[0].Path != "src/b.go" {
		t.Fatalf("exclude=%+v err=%v", noTS, err)
	}
	dest, err := TrashRel(root, "src/a.ts")
	if err != nil || !strings.HasPrefix(dest, ".ide-trash/") {
		t.Fatalf("trash=%q err=%v", dest, err)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "a.ts")); !os.IsNotExist(err) {
		t.Fatal("source must be gone")
	}
	orig, err := RestoreRel(root, dest)
	if err != nil || orig != "src/a.ts" {
		t.Fatalf("restore=%q err=%v", orig, err)
	}
	if _, err := os.Stat(filepath.Join(root, "src", "a.ts")); err != nil {
		t.Fatal(err)
	}
	tree, err := ListTree(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, node := range tree {
		if node.Name == ".ide-trash" {
			t.Fatal("trash folder must stay out of the tree")
		}
	}
}

func TestWriteTextAtRejectsMissingFile(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	first, err := WriteText(root, "src/gone.ts", "ok\n")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(root, "src", "gone.ts")); err != nil {
		t.Fatal(err)
	}
	missing, err := WriteTextAt(root, "src/gone.ts", "ok\n", first.Revision, false)
	if err != nil {
		t.Fatal(err)
	}
	if missing.OK || missing.Conflict != "missing" {
		t.Fatalf("missing=%+v", missing)
	}
}
