package workspace

import (
	"errors"
	"os"
	"path"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

const searchMaxHits = 200

// SearchHit is one literal match in a UTF-8 file.
type SearchHit struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Preview string `json:"preview"`
}

// SearchLiteral walks listable text files for a case-sensitive or insensitive literal.
func SearchLiteral(rootAbs, query string, caseSensitive bool) ([]SearchHit, error) {
	return SearchLiteralFilter(rootAbs, query, caseSensitive, "", "")
}

// SearchLiteralFilter is SearchLiteral with include/exclude path globs (comma or space separated).
func SearchLiteralFilter(rootAbs, query string, caseSensitive bool, include, exclude string) ([]SearchHit, error) {
	needle := strings.TrimSpace(query)
	if needle == "" {
		return nil, nil
	}
	if !caseSensitive {
		needle = strings.ToLower(needle)
	}
	includePat := splitPatterns(include)
	excludePat := splitPatterns(exclude)
	var hits []SearchHit
	err := walkListed(rootAbs, "", includePat, func(abs, slash string, info os.FileInfo) error {
		if info.IsDir() || info.Size() > FileMaxBytes || info.Size() == 0 {
			return nil
		}
		if !allowSearchPath(slash, includePat, excludePat) {
			return nil
		}
		raw, err := os.ReadFile(abs)
		if err != nil || !utf8.Valid(raw) {
			return nil
		}
		text := string(raw)
		search := text
		if !caseSensitive {
			search = strings.ToLower(text)
		}
		offset := 0
		line := 1
		lineStart := 0
		for offset < len(search) {
			at := strings.Index(search[offset:], needle)
			if at < 0 {
				break
			}
			at += offset
			for i := lineStart; i < at; i++ {
				if text[i] == '\n' {
					line++
					lineStart = i + 1
				}
			}
			end := lineStart
			for end < len(text) && text[end] != '\n' {
				end++
			}
			preview := strings.TrimRight(text[lineStart:end], "\r")
			if len(preview) > 160 {
				preview = preview[:160]
			}
			hits = append(hits, SearchHit{Path: slash, Line: line, Column: at - lineStart + 1, Preview: preview})
			if len(hits) >= searchMaxHits {
				return errSearchDone
			}
			offset = at + len(needle)
		}
		return nil
	})
	if err == errSearchDone {
		return hits, nil
	}
	return hits, err
}

var errSearchDone = errors.New("search limit")

func splitPatterns(raw string) []string {
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == ' ' || r == '\t'
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			out = append(out, filepath.ToSlash(part))
		}
	}
	return out
}

func allowSearchPath(slash string, include, exclude []string) bool {
	if matchesPathGlob(slash, exclude) {
		return false
	}
	if len(include) == 0 {
		return true
	}
	return matchesPathGlob(slash, include)
}

func matchesPathGlob(slash string, patterns []string) bool {
	base := path.Base(slash)
	for _, pattern := range patterns {
		if ok, err := path.Match(pattern, slash); err == nil && ok {
			return true
		}
		if ok, err := path.Match(pattern, base); err == nil && ok {
			return true
		}
		prefix := strings.TrimSuffix(strings.TrimSuffix(pattern, "/**"), "/*")
		if prefix != "" && (slash == prefix || strings.HasPrefix(slash, prefix+"/")) {
			return true
		}
	}
	return false
}

func listedForSearch(name, relDir string, include []string) bool {
	if name == ".ide-trash" {
		return false
	}
	if _, skip := treeSkip[name]; !skip {
		return true
	}
	child := name
	if relDir != "" {
		child = relDir + "/" + name
	}
	return includeReaches(child, name, include)
}

func includeReaches(slash, name string, include []string) bool {
	for _, pattern := range include {
		if strings.Contains(pattern, name) {
			return true
		}
		prefix := strings.TrimSuffix(strings.TrimSuffix(pattern, "/**"), "/*")
		if prefix != "" && (slash == prefix || strings.HasPrefix(slash, prefix+"/") || strings.HasPrefix(prefix, slash+"/")) {
			return true
		}
	}
	return false
}

func walkListed(rootAbs, relDir string, include []string, visit func(abs, slash string, info os.FileInfo) error) error {
	absDir := rootAbs
	if relDir != "" {
		absDir = filepath.Join(rootAbs, filepath.FromSlash(relDir))
	}
	entries, err := os.ReadDir(absDir)
	if err != nil {
		return mapIOError(err)
	}
	for _, entry := range entries {
		name := entry.Name()
		if !listedForSearch(name, relDir, include) {
			continue
		}
		childRel := name
		if relDir != "" {
			childRel = relDir + "/" + name
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.Mode()&os.ModeSymlink != 0 {
			continue
		}
		abs := filepath.Join(absDir, name)
		if err := visit(abs, childRel, info); err != nil {
			return err
		}
		if info.IsDir() {
			if err := walkListed(rootAbs, childRel, include, visit); err != nil {
				return err
			}
		}
	}
	return nil
}
