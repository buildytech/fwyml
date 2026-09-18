package language

import (
	"runtime"
	"testing"
)

func TestParseGoplsLocationUnixAndWindows(t *testing.T) {
	t.Parallel()
	hit, ok := parseGoplsLocation("/proj", "/proj/pkg/main.go:12:5-10")
	if !ok || hit.Line != 12 || hit.Column != 5 {
		t.Fatalf("unix hit=%+v ok=%v", hit, ok)
	}
	if runtime.GOOS != "windows" && hit.Path != "pkg/main.go" {
		t.Fatalf("unix path=%q", hit.Path)
	}
	hit, ok = parseGoplsLocation(`E:\proj`, `E:\proj\pkg\main.go:8:1-4`)
	if !ok || hit.Line != 8 || hit.Column != 1 {
		t.Fatalf("windows hit=%+v ok=%v", hit, ok)
	}
}
