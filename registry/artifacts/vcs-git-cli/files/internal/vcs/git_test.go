package vcs

import (
	"fmt"
	"strings"
	"testing"
)

func TestParsePorcelainRenameAndDelete(t *testing.T) {
	t.Parallel()
	raw := "R  src/b.ts\x00src/a.ts\x00 D gone.go\x00"
	files := parsePorcelain(raw)
	if len(files) != 2 {
		t.Fatalf("files=%+v", files)
	}
	if files[0].Path != "src/b.ts" || files[0].Orig != "src/a.ts" || files[0].Kind != "renamed" {
		t.Fatalf("rename=%+v", files[0])
	}
	if files[1].Path != "gone.go" || files[1].Kind != "deleted" {
		t.Fatalf("delete=%+v", files[1])
	}
}

func TestClassifyGitAuthVsNoRepo(t *testing.T) {
	t.Parallel()
	noRepo := classifyGit(fmt.Errorf("fatal: not a git repository (or any of the parent directories): .git"))
	if noRepo == nil || !strings.Contains(noRepo.Error(), "no-repo:") {
		t.Fatalf("no-repo=%v", noRepo)
	}
	auth := classifyGit(fmt.Errorf("git: could not read Username for 'https://example.com': terminal prompts disabled"))
	if auth == nil || !strings.Contains(auth.Error(), "auth:") {
		t.Fatalf("auth=%v", auth)
	}
	identity := classifyGit(fmt.Errorf("Author identity unknown\n*** Please tell me who you are."))
	if identity == nil || !strings.Contains(identity.Error(), "identity:") {
		t.Fatalf("identity=%v", identity)
	}
}

func TestParseAheadBehind(t *testing.T) {
	t.Parallel()
	ahead, behind := parseAheadBehind("3\t1\n")
	if ahead != 3 || behind != 1 {
		t.Fatalf("ahead=%d behind=%d", ahead, behind)
	}
}
