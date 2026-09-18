package terminal

import (
	"strings"
	"testing"
	"time"
)

func TestInteractiveConsole(t *testing.T) {
	session, err := Start("cmd.exe /Q", t.TempDir(), 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	if err := session.Resize(100, 30); err != nil {
		t.Fatal(err)
	}
	if err := session.Input("echo BUILDY_%OS%_OK\r"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(10 * time.Second)
	var output strings.Builder
	for time.Now().Before(deadline) {
		data, _ := session.Read()
		output.Write(data)
		if strings.Contains(output.String(), "BUILDY_Windows_NT_OK") {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("console did not return command output: %q", output.String())
}
