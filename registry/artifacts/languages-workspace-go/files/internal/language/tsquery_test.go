package language

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func TestTsQueryDefinitionAndHover(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is required")
	}
	root := repoRoot(t)
	if !tsqueryAvailable(root) {
		t.Skip("local TypeScript is not installed")
	}
	rel := "src/lib/tab-label.ts"
	raw, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	hits, err := FindDefinitions(root, rel, text, 1, 17)
	if err != nil || len(hits) == 0 || hits[0].Line < 1 {
		t.Fatalf("definition=%+v err=%v", hits, err)
	}
	hover, err := HoverText(root, rel, text, 1, 17)
	if err != nil || hover == "" || !strings.Contains(strings.ToLower(hover), "string") {
		t.Fatalf("hover=%q err=%v", hover, err)
	}
	status := LanguageForPath(root, rel)
	if !status.Ready {
		t.Fatalf("status=%+v", status)
	}
}

func TestParseDiagnosticLineKeepsWindowsPath(t *testing.T) {
	t.Parallel()
	path, line, col, message := splitDiagnostic(`E:/proj/src/a.ts:4:2:Type 'string' is not assignable to type 'number'.`)
	if path != `E:/proj/src/a.ts` || line != 4 || col != 2 || !strings.Contains(message, "string") {
		t.Fatalf("got %q %d %d %q", path, line, col, message)
	}
}

func TestTsQueryDiagnosticsFindsTypeError(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is required")
	}
	root := repoRoot(t)
	if !tsqueryAvailable(root) {
		t.Skip("local TypeScript is not installed")
	}
	rel := "internal/workspace/testdata/broken.ts"
	hits, err := FileDiagnostics(root, rel)
	if err != nil || len(hits) == 0 {
		t.Fatalf("diagnostics=%+v err=%v", hits, err)
	}
	if hits[0].Line < 1 || hits[0].Preview == "" {
		t.Fatalf("hit=%+v", hits[0])
	}
}
