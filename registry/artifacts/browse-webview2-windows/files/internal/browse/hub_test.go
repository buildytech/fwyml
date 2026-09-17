package browse

import "testing"

func TestSessionDispose(t *testing.T) {
	hub := New()
	if err := hub.Navigate("browser:1", "https://example.com"); err != nil {
		t.Fatal(err)
	}
	if hub.URL("browser:1") == "" {
		t.Fatal("expected session")
	}
	hub.Close("browser:1")
	if hub.URL("browser:1") != "" {
		t.Fatal("session must be disposed")
	}
}
