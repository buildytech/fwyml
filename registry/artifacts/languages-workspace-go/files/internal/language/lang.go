// Package language contains IDE-specific language and task integrations.
package language

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"example.com/app/internal/workspace"
)

// LanguageStatus describes what the host can actually do for a file.
type LanguageStatus struct {
	Language    string `json:"language"`
	Ready       bool   `json:"ready"`
	Reason      string `json:"reason"`
	Format      bool   `json:"format"`
	Definition  bool   `json:"definition"`
	Hover       bool   `json:"hover"`
	Complete    bool   `json:"complete"`
	Diagnostics bool   `json:"diagnostics"`
}

// LanguageHit is a symbol location or completion.
type LanguageHit struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Text    string `json:"text"`
	Preview string `json:"preview"`
}

func languageOf(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".go":
		return "go"
	case ".ts", ".tsx", ".mts", ".cts":
		return "typescript"
	default:
		return ""
	}
}

// LanguageForPath reports tool availability without treating syntax highlighting as a service.
func LanguageForPath(rootAbs, rel string) LanguageStatus {
	lang := languageOf(rel)
	if lang == "" {
		return LanguageStatus{Language: "plaintext", Reason: "No project language service for this file."}
	}
	status := LanguageStatus{Language: lang, Definition: true, Hover: true, Complete: true}
	if lang == "go" {
		_, fmtErr := exec.LookPath("gofmt")
		status.Format = fmtErr == nil
		_, goErr := exec.LookPath("go")
		_, modErr := os.Stat(filepath.Join(rootAbs, "go.mod"))
		status.Diagnostics = goErr == nil && modErr == nil
		_, plsErr := exec.LookPath("gopls")
		if plsErr == nil {
			status.Ready = true
			status.Diagnostics = true
			status.Reason = "gopls is available. Format uses gofmt."
			return status
		}
		status.Ready = false
		if status.Format {
			status.Reason = "gofmt formats. Go to definition and hover use workspace symbols, not gopls types."
		} else {
			status.Reason = "Install Go (gofmt) to format. Definitions use workspace symbols only."
		}
		return status
	}
	tsc := filepath.Join(rootAbs, "node_modules", "typescript", "bin", "tsc")
	status.Diagnostics = fileExists(tsc) || tsqueryAvailable(rootAbs)
	status.Format = prettierBin(rootAbs) != ""
	status.Ready = tsqueryAvailable(rootAbs)
	if status.Ready {
		status.Reason = "Local TypeScript answers definition and hover from the project checker. Format uses prettier when installed."
	} else if status.Diagnostics {
		status.Reason = "Local tsc can check the project, but Node is required for type hover and definition."
	} else {
		status.Reason = "Install local typescript for diagnostics. Completion and definition use workspace symbols only."
	}
	return status
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func prettierBin(rootAbs string) string {
	base := filepath.Join(rootAbs, "node_modules", ".bin", "prettier")
	if fileExists(base) {
		return base
	}
	if fileExists(base + ".cmd") {
		return base + ".cmd"
	}
	return ""
}

// IdentifierAt returns the identifier under 1-based line/column.
func IdentifierAt(text string, line, column int) string {
	if line < 1 || column < 1 {
		return ""
	}
	rows := strings.Split(text, "\n")
	if line > len(rows) {
		return ""
	}
	row := strings.TrimRight(rows[line-1], "\r")
	runes := []rune(row)
	idx := column - 1
	if idx > len(runes) {
		idx = len(runes)
	}
	if idx == len(runes) && idx > 0 {
		idx--
	}
	if idx < 0 || idx >= len(runes) || !identRune(runes[idx]) {
		return ""
	}
	start, end := idx, idx+1
	for start > 0 && identRune(runes[start-1]) {
		start--
	}
	for end < len(runes) && identRune(runes[end]) {
		end++
	}
	return string(runes[start:end])
}

func identRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_'
}

// FindDefinitions lists workspace declarations of the identifier at the cursor.
func FindDefinitions(rootAbs, rel, text string, line, column int) ([]LanguageHit, error) {
	if languageOf(rel) == "go" && goplsAvailable() {
		hits, err := goplsDefinition(rootAbs, rel, line, column)
		if err == nil && len(hits) > 0 {
			ident := IdentifierAt(text, line, column)
			for i := range hits {
				hits[i].Text = ident
			}
			return hits, nil
		}
	}
	if languageOf(rel) == "typescript" && tsqueryAvailable(rootAbs) {
		hits, err := tsDefinition(rootAbs, rel, line, column)
		if err == nil && len(hits) > 0 {
			ident := IdentifierAt(text, line, column)
			for i := range hits {
				hits[i].Text = ident
			}
			return hits, nil
		}
	}
	ident := IdentifierAt(text, line, column)
	if ident == "" {
		return nil, nil
	}
	lang := languageOf(rel)
	hits, err := workspace.SearchLiteral(rootAbs, ident, true)
	if err != nil {
		return nil, err
	}
	var out []LanguageHit
	for _, hit := range hits {
		hitLang := languageOf(hit.Path)
		if lang != "" && hitLang != "" && hitLang != lang {
			continue
		}
		if !looksLikeDeclaration(hit.Preview, ident) {
			continue
		}
		out = append(out, LanguageHit{Path: hit.Path, Line: hit.Line, Column: hit.Column, Text: ident, Preview: hit.Preview})
		if len(out) >= 20 {
			break
		}
	}
	return out, nil
}

func looksLikeDeclaration(preview, ident string) bool {
	trim := strings.TrimSpace(preview)
	for _, n := range []string{
		"func " + ident, "function " + ident, "class " + ident, "type " + ident,
		"const " + ident, "let " + ident, "var " + ident, "interface " + ident,
		ident + " :=",
	} {
		if strings.Contains(trim, n) {
			return true
		}
	}
	return false
}

// FileDiagnostics returns project type errors for a saved file.
func FileDiagnostics(rootAbs, rel string) ([]LanguageHit, error) {
	lang := languageOf(rel)
	if lang == "typescript" && tsqueryAvailable(rootAbs) {
		return tsDiagnostics(rootAbs, rel)
	}
	if lang == "go" && goplsAvailable() {
		return goplsDiagnostics(rootAbs, rel)
	}
	return nil, nil
}

func parseDiagnosticLines(rootAbs, raw string) []LanguageHit {
	var out []LanguageHit
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		path, ln, col, message := splitDiagnostic(line)
		if path == "" || ln < 1 {
			continue
		}
		rel, err := workspace.RelUnder(rootAbs, path)
		if err != nil {
			rel = filepath.ToSlash(path)
		}
		out = append(out, LanguageHit{Path: rel, Line: ln, Column: col, Text: "error", Preview: message})
		if len(out) >= 50 {
			break
		}
	}
	return out
}

var diagnosticLine = regexp.MustCompile(`^(.*):(\d+):(\d+):(.*)$`)

func splitDiagnostic(line string) (string, int, int, string) {
	match := diagnosticLine.FindStringSubmatch(line)
	if match == nil {
		return "", 0, 0, ""
	}
	ln, err := strconv.Atoi(match[2])
	if err != nil {
		return "", 0, 0, ""
	}
	col, err := strconv.Atoi(match[3])
	if err != nil {
		col = 1
	}
	return match[1], ln, col, strings.TrimSpace(match[4])
}

// Completions returns identifier prefixes from the current file and nearby hits.
func Completions(rootAbs, rel, text string, line, column int) ([]LanguageHit, error) {
	ident := IdentifierAt(text, line, column)
	seen := map[string]struct{}{}
	var out []LanguageHit
	add := func(name string) {
		if name == "" || name == ident {
			return
		}
		if ident != "" && !strings.HasPrefix(name, ident) {
			return
		}
		if _, ok := seen[name]; ok {
			return
		}
		seen[name] = struct{}{}
		out = append(out, LanguageHit{Text: name, Path: rel, Line: line, Column: column})
	}
	for _, word := range identifierWords(text) {
		add(word)
		if len(out) >= 40 {
			return out, nil
		}
	}
	if ident != "" {
		hits, err := workspace.SearchLiteral(rootAbs, ident, true)
		if err == nil {
			for _, hit := range hits {
				for _, word := range identifierWords(hit.Preview) {
					add(word)
					if len(out) >= 40 {
						return out, nil
					}
				}
			}
		}
	}
	return out, nil
}

func identifierWords(text string) []string {
	var words []string
	var b strings.Builder
	flush := func() {
		if b.Len() >= 2 {
			words = append(words, b.String())
		}
		b.Reset()
	}
	for _, r := range text {
		if identRune(r) {
			b.WriteRune(r)
			continue
		}
		flush()
	}
	flush()
	return words
}

// HoverText returns the first declaration preview for the identifier.
func HoverText(rootAbs, rel, text string, line, column int) (string, error) {
	if languageOf(rel) == "go" && goplsAvailable() {
		raw, err := goplsHover(rootAbs, rel, line, column)
		if err == nil && raw != "" {
			return raw, nil
		}
	}
	if languageOf(rel) == "typescript" && tsqueryAvailable(rootAbs) {
		raw, err := tsHover(rootAbs, rel, line, column)
		if err == nil && raw != "" {
			return raw, nil
		}
	}
	hits, err := FindDefinitions(rootAbs, rel, text, line, column)
	if err != nil {
		return "", err
	}
	ident := IdentifierAt(text, line, column)
	if len(hits) == 0 {
		if ident == "" {
			return "", nil
		}
		return ident + " — no declaration found in the workspace index.", nil
	}
	return hits[0].Path + ":" + strconv.Itoa(hits[0].Line) + "  " + hits[0].Preview, nil
}

// FormatText formats Go with gofmt or TypeScript with local prettier.
func FormatText(rootAbs, rel, text string) (string, error) {
	lang := languageOf(rel)
	if lang == "go" {
		cmd := exec.Command("gofmt")
		cmd.Stdin = strings.NewReader(text)
		var stdout, stderr bytes.Buffer
		cmd.Stdout, cmd.Stderr = &stdout, &stderr
		if err := cmd.Run(); err != nil {
			msg := strings.TrimSpace(stderr.String())
			if msg == "" {
				msg = "gofmt is not available"
			}
			return "", workspace.NewUserError("tool-missing", msg)
		}
		out := stdout.String()
		if !utf8.ValidString(out) {
			return "", workspace.NewUserError("utf8", "formatted text is not UTF-8")
		}
		return out, nil
	}
	if lang == "typescript" {
		bin := prettierBin(rootAbs)
		if bin == "" {
			return "", workspace.NewUserError("tool-missing", "Install prettier in this workspace to format TypeScript.")
		}
		cmd := exec.Command(bin, "--stdin-filepath", rel)
		cmd.Dir = rootAbs
		cmd.Stdin = strings.NewReader(text)
		var stdout, stderr bytes.Buffer
		cmd.Stdout, cmd.Stderr = &stdout, &stderr
		if err := cmd.Run(); err != nil {
			msg := strings.TrimSpace(stderr.String())
			if msg == "" {
				msg = "prettier failed"
			}
			return "", workspace.NewUserError("tool-missing", msg)
		}
		return stdout.String(), nil
	}
	return "", workspace.NewUserError("unknown", "No formatter for this file.")
}
