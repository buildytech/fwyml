package userstore

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMovePortableFolderKeepsRecentRecoveryAndLayout(t *testing.T) {
	parent := t.TempDir()
	old := filepath.Join(parent, "old-drive", "buildy")
	project := filepath.Join(old, "workspaces", "demo")
	if err := os.MkdirAll(project, 0700); err != nil {
		t.Fatal(err)
	}
	store, err := OpenPortable(filepath.Join(old, "data", "state"), old)
	if err != nil {
		t.Fatal(err)
	}
	recent, err := store.Remember(project, "demo")
	if err != nil {
		t.Fatal(err)
	}
	key := store.WorkspaceKey(project)
	if err := store.SaveLayout(key, SessionLayout{Active: "a.ts", Tabs: []string{"a.ts"}}); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveRecovery([]RecoveryBuffer{{WorkspaceKey: key, Path: "a.ts", Text: "draft"}}); err != nil {
		t.Fatal(err)
	}
	moved := filepath.Join(parent, "new-drive", "buildy")
	if err := os.MkdirAll(filepath.Dir(moved), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(old, moved); err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenPortable(filepath.Join(moved, "data", "state"), moved)
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(moved, "workspaces", "demo")
	got, err := reopened.Resolve(recent[0].ID)
	if err != nil || got != want {
		t.Fatalf("resolve %s %v", got, err)
	}
	got, err = reopened.LastAbs()
	if err != nil || got != want {
		t.Fatalf("last %s %v", got, err)
	}
	if reopened.WorkspaceKey(want) != key {
		t.Fatal("layout key changed")
	}
	layout, err := reopened.LoadLayout(key)
	if err != nil || layout.Active != "a.ts" {
		t.Fatalf("layout %+v %v", layout, err)
	}
	recovery, err := reopened.LoadRecovery()
	if err != nil || len(FilterRecovery(recovery, key)) != 1 {
		t.Fatalf("recovery %+v %v", recovery, err)
	}
}
