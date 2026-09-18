package language

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIdentifierAtAndDefinitions(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	src := "export function greet() {\n  return 1;\n}\nconst x = greet();\n"
	if err := os.WriteFile(filepath.Join(root, "src", "app.ts"), []byte(src), 0o600); err != nil {
		t.Fatal(err)
	}
	if IdentifierAt(src, 4, 12) != "greet" {
		t.Fatalf("ident=%q", IdentifierAt(src, 4, 12))
	}
	hits, err := FindDefinitions(root, "src/app.ts", src, 4, 12)
	if err != nil || len(hits) == 0 || hits[0].Line != 1 {
		t.Fatalf("hits=%+v err=%v", hits, err)
	}
	hover, err := HoverText(root, "src/app.ts", src, 4, 12)
	if err != nil || hover == "" {
		t.Fatalf("hover=%q err=%v", hover, err)
	}
	status := LanguageForPath(root, "src/app.ts")
	if status.Language != "typescript" {
		t.Fatalf("status=%+v", status)
	}
	if status.Ready {
		t.Fatal("typescript without local tsc must not claim a ready type service")
	}
	if err := os.MkdirAll(filepath.Join(root, "node_modules", "typescript", "bin"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "node_modules", "typescript", "bin", "tsc"), []byte("#!/bin/sh\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	ready := LanguageForPath(root, "src/app.ts")
	if !ready.Diagnostics {
		t.Fatalf("tsc must enable diagnostics, status=%+v", ready)
	}
	if ready.Ready && !tsqueryAvailable(root) {
		t.Fatalf("Ready without a TypeScript checker, status=%+v", ready)
	}
}

func TestLanguageStatusPlaintextIsHonest(t *testing.T) {
	t.Parallel()
	status := LanguageForPath(t.TempDir(), "notes.txt")
	if status.Language != "plaintext" || status.Ready {
		t.Fatalf("status=%+v", status)
	}
}
