package userstore

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRememberRecentAndResolve(t *testing.T) {
	t.Parallel()
	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	first, err := store.Remember(filepath.Join(t.TempDir(), "proj-a"), "proj-a")
	if err != nil || len(first) != 1 || first[0].Label != "proj-a" || first[0].ID == "" {
		t.Fatalf("first=%+v err=%v", first, err)
	}
	abs := filepath.Join(t.TempDir(), "proj-b")
	if err := os.MkdirAll(abs, 0o700); err != nil {
		t.Fatal(err)
	}
	list, err := store.Remember(abs, "proj-b")
	if err != nil || len(list) != 2 || list[0].Label != "proj-b" {
		t.Fatalf("list=%+v err=%v", list, err)
	}
	got, err := store.Resolve(list[0].ID)
	if err != nil || got != filepath.Clean(abs) {
		t.Fatalf("resolve=%q err=%v", got, err)
	}
	last, err := store.LastAbs()
	if err != nil || last != filepath.Clean(abs) {
		t.Fatalf("last=%q err=%v", last, err)
	}
	public, err := store.Recent()
	if err != nil || len(public) != 2 {
		t.Fatalf("public=%+v err=%v", public, err)
	}
	for _, item := range public {
		if item.ID == "" || item.Label == "" {
			t.Fatalf("leaky or empty %+v", item)
		}
	}
}

func TestRecoveryRoundTripDoesNotOverwriteUnlessSaved(t *testing.T) {
	t.Parallel()
	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	items := []RecoveryBuffer{{
		WorkspaceKey: "abc",
		Path:         "src/a.ts",
		Text:         "const A = 2;\n",
		Revision:     "1:12",
		Untitled:     false,
	}}
	if err := store.SaveRecovery(items); err != nil {
		t.Fatal(err)
	}
	got, err := store.LoadRecovery()
	if err != nil || len(got) != 1 || got[0].Text != "const A = 2;\n" {
		t.Fatalf("got=%+v err=%v", got, err)
	}
	if err := store.ClearRecovery(); err != nil {
		t.Fatal(err)
	}
	empty, err := store.LoadRecovery()
	if err != nil || len(empty) != 0 {
		t.Fatalf("cleared=%+v err=%v", empty, err)
	}
}

func TestOldLayoutMissingBottomVisibleDefaultsOpen(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	store, err := OpenAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := writeAtomic(filepath.Join(dir, layoutDir, "abc.json"), []byte(`{"treePct":20,"chatPct":28,"tabs":["a.ts"],"active":"a.ts","line":1,"column":1}`)); err != nil {
		t.Fatal(err)
	}
	got, err := store.LoadLayout("abc")
	if err != nil || !got.BottomVisible || got.ChatVisible {
		t.Fatalf("old layout defaults=%+v err=%v", got, err)
	}
}

func TestSessionLayoutRoundTrip(t *testing.T) {
	t.Parallel()
	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	want := SessionLayout{
		TreePct: 18, ChatPct: 24, Tabs: []string{"src/a.ts", "untitled:1"}, Active: "untitled:1",
		Line: 7, Column: 3, BottomTab: "terminal", BottomVisible: true, ChatVisible: true,
		Markdown: map[string]string{"readme.md": "source"},
	}
	if err := store.SaveLayout("abc", want); err != nil {
		t.Fatal(err)
	}
	got, err := store.LoadLayout("abc")
	if err != nil || got.Active != want.Active || got.TreePct != want.TreePct || len(got.Tabs) != 2 || got.Line != 7 || got.Column != 3 || got.BottomTab != "terminal" || !got.BottomVisible || !got.ChatVisible || got.Markdown["readme.md"] != "source" {
		t.Fatalf("got=%+v err=%v", got, err)
	}
}

func TestDurableStoreSurvivesKilledProcess(t *testing.T) {
	if os.Getenv("IDE_CRASH_HELPER") == "1" {
		store, err := OpenAt(os.Getenv("IDE_STORE"))
		if err != nil {
			os.Exit(3)
		}
		if err := store.SaveRecovery([]RecoveryBuffer{{
			Path: "draft.ts", Text: "const dirty = 1;\n", Untitled: true,
		}}); err != nil {
			os.Exit(3)
		}
		if err := store.SavePrefsJSON(`{"theme":"dark","uiZoom":200,"fontScale":"lg"}`); err != nil {
			os.Exit(3)
		}
		if err := store.SaveLayout("ws", SessionLayout{TreePct: 16, ChatPct: 30, Tabs: []string{"a.ts", "untitled:1"}, Active: "untitled:1", Line: 2, Column: 1, BottomTab: "problems", BottomVisible: true, ChatVisible: true}); err != nil {
			os.Exit(3)
		}
		os.Exit(2)
	}
	dir := t.TempDir()
	cmd := exec.Command(os.Args[0], "-test.run", "^TestDurableStoreSurvivesKilledProcess$")
	cmd.Env = append(os.Environ(), "IDE_CRASH_HELPER=1", "IDE_STORE="+dir)
	err := cmd.Run()
	if err == nil {
		t.Fatal("helper must exit abnormally")
	}
	if status, ok := err.(*exec.ExitError); !ok || status.ExitCode() != 2 {
		t.Fatalf("helper err=%v", err)
	}
	store, err := OpenAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	recovery, err := store.LoadRecovery()
	if err != nil || len(recovery) != 1 || recovery[0].Text != "const dirty = 1;\n" || !recovery[0].Untitled {
		t.Fatalf("recovery=%+v err=%v", recovery, err)
	}
	prefs, err := store.LoadPrefsJSON()
	if err != nil || prefs != `{"theme":"dark","uiZoom":200,"fontScale":"lg"}` {
		t.Fatalf("prefs=%q err=%v", prefs, err)
	}
	layout, err := store.LoadLayout("ws")
	if err != nil || layout.TreePct != 16 || layout.Active != "untitled:1" || layout.Line != 2 || layout.Tabs[0] != "a.ts" || !layout.BottomVisible || !layout.ChatVisible {
		t.Fatalf("layout=%+v err=%v", layout, err)
	}
}

func TestLastAbsSkipsMissingFolder(t *testing.T) {
	t.Parallel()
	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	gone := filepath.Join(t.TempDir(), "gone")
	if err := os.MkdirAll(gone, 0o700); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Remember(gone, "gone"); err != nil {
		t.Fatal(err)
	}
	if err := os.RemoveAll(gone); err != nil {
		t.Fatal(err)
	}
	abs, err := store.LastAbs()
	if err != nil || abs != "" {
		t.Fatalf("missing last=%q err=%v", abs, err)
	}
}

func TestFilterRecoveryByWorkspace(t *testing.T) {
	t.Parallel()
	items := []RecoveryBuffer{
		{WorkspaceKey: "aaa", Path: "a.ts", Text: "a"},
		{WorkspaceKey: "bbb", Path: "b.ts", Text: "b"},
		{Path: "untitled:1", Text: "draft", Untitled: true},
	}
	got := FilterRecovery(items, "aaa")
	if len(got) != 2 || got[0].Path != "a.ts" || !got[1].Untitled {
		t.Fatalf("got=%+v", got)
	}
}

func TestPrefsJSONPersists(t *testing.T) {
	t.Parallel()
	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SavePrefsJSON(`{"theme":"dark"}`); err != nil {
		t.Fatal(err)
	}
	raw, err := store.LoadPrefsJSON()
	if err != nil || raw != `{"theme":"dark"}` {
		t.Fatalf("prefs=%q err=%v", raw, err)
	}
}
