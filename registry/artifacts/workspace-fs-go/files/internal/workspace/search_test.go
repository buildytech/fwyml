package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSearchIncludeReachesSkippedFolder(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	hidden := filepath.Join(root, "node_modules", "pkg")
	if err := os.MkdirAll(hidden, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(hidden, "hidden.ts"), []byte("const hiddenToken = 3;\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	skipped, err := SearchLiteral(root, "hiddenToken", true)
	if err != nil || len(skipped) != 0 {
		t.Fatalf("default search must skip node_modules: %+v err=%v", skipped, err)
	}
	included, err := SearchLiteralFilter(root, "hiddenToken", true, "node_modules", "")
	if err != nil || len(included) != 1 || included[0].Path != "node_modules/pkg/hidden.ts" {
		t.Fatalf("include skip dir=%+v err=%v", included, err)
	}
}
