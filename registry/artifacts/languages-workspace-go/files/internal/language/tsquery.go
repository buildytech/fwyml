package language

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

//go:embed tsquery.mjs
var tsqueryJS []byte

var tsqueryOnce sync.Once
var tsqueryFile string
var tsqueryErr error

func tsqueryAvailable(rootAbs string) bool {
	if _, err := exec.LookPath("node"); err != nil {
		return false
	}
	return fileExists(filepath.Join(rootAbs, "node_modules", "typescript", "lib", "typescript.js")) ||
		fileExists(filepath.Join(rootAbs, "node_modules", "typescript", "bin", "tsc"))
}

func ensureTsquery() (string, error) {
	tsqueryOnce.Do(func() {
		dir := filepath.Join(os.TempDir(), "ide-buildy")
		if err := os.MkdirAll(dir, 0o700); err != nil {
			tsqueryErr = err
			return
		}
		tsqueryFile = filepath.Join(dir, "tsquery.mjs")
		tsqueryErr = os.WriteFile(tsqueryFile, tsqueryJS, 0o600)
	})
	return tsqueryFile, tsqueryErr
}

func tsQuery(rootAbs, rel, verb string, line, column int) (string, error) {
	script, err := ensureTsquery()
	if err != nil {
		return "", err
	}
	cmd := exec.Command("node", script, verb, rootAbs, filepath.ToSlash(rel), strconv.Itoa(line), strconv.Itoa(column))
	cmd.Dir = rootAbs
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func tsDefinition(rootAbs, rel string, line, column int) ([]LanguageHit, error) {
	raw, err := tsQuery(rootAbs, rel, "definition", line, column)
	if err != nil || raw == "" {
		return nil, err
	}
	hit, ok := parseGoplsLocation(rootAbs, raw)
	if !ok {
		return nil, nil
	}
	return []LanguageHit{hit}, nil
}

func tsHover(rootAbs, rel string, line, column int) (string, error) {
	return tsQuery(rootAbs, rel, "hover", line, column)
}

func tsDiagnostics(rootAbs, rel string) ([]LanguageHit, error) {
	raw, err := tsQuery(rootAbs, rel, "diagnostics", 1, 1)
	if err != nil {
		return nil, err
	}
	return parseDiagnosticLines(rootAbs, raw), nil
}
