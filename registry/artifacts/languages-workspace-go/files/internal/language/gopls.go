package language

import (
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"example.com/app/internal/workspace"
)

func goplsAvailable() bool {
	_, err := exec.LookPath("gopls")
	return err == nil
}

func goplsQuery(rootAbs, rel string, line, column int, verb string) (string, error) {
	abs := filepath.Join(rootAbs, filepath.FromSlash(rel))
	spec := abs + ":" + strconv.Itoa(line) + ":" + strconv.Itoa(column)
	cmd := exec.Command("gopls", verb, spec)
	cmd.Dir = rootAbs
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func parseGoplsLocation(rootAbs, raw string) (LanguageHit, bool) {
	// gopls definition prints: /abs/path.go:12:3-18
	line := strings.Split(raw, "\n")[0]
	line = strings.TrimSpace(line)
	if line == "" {
		return LanguageHit{}, false
	}
	colon := strings.LastIndex(line, ":")
	if colon < 0 {
		return LanguageHit{}, false
	}
	head := line[:colon]
	rest := line[colon+1:]
	// strip range suffix 3-18
	if dash := strings.Index(rest, "-"); dash >= 0 {
		rest = rest[:dash]
	}
	col, err := strconv.Atoi(rest)
	if err != nil {
		col = 1
	}
	colon2 := strings.LastIndex(head, ":")
	if colon2 < 0 {
		return LanguageHit{}, false
	}
	file := head[:colon2]
	ln, err := strconv.Atoi(head[colon2+1:])
	if err != nil {
		return LanguageHit{}, false
	}
	rel, err := workspace.RelUnder(rootAbs, file)
	if err != nil {
		rel = filepath.ToSlash(file)
	}
	return LanguageHit{Path: rel, Line: ln, Column: col, Preview: line}, true
}

func goplsDefinition(rootAbs, rel string, line, column int) ([]LanguageHit, error) {
	raw, err := goplsQuery(rootAbs, rel, line, column, "definition")
	if err != nil || raw == "" {
		return nil, err
	}
	hit, ok := parseGoplsLocation(rootAbs, raw)
	if !ok {
		return nil, nil
	}
	return []LanguageHit{hit}, nil
}

func goplsHover(rootAbs, rel string, line, column int) (string, error) {
	return goplsQuery(rootAbs, rel, line, column, "hover")
}

func goplsDiagnostics(rootAbs, rel string) ([]LanguageHit, error) {
	abs := filepath.Join(rootAbs, filepath.FromSlash(rel))
	cmd := exec.Command("gopls", "check", abs)
	cmd.Dir = rootAbs
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return nil, err
	}
	return parseDiagnosticLines(rootAbs, string(out)), nil
}
