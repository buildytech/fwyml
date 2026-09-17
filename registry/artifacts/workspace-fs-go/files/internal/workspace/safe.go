package workspace

import (
	"fmt"
	"path/filepath"
	"strings"
)

func RelSafe(rootAbs, rel string) (abs string, slash string, err error) {
	cleaned := filepath.Clean(filepath.FromSlash(strings.TrimSpace(rel)))
	if cleaned == "." {
		return rootAbs, "", nil
	}
	if filepath.IsAbs(cleaned) || strings.HasPrefix(cleaned, "..") {
		return "", "", fmt.Errorf("unsafe path")
	}
	abs = filepath.Join(rootAbs, cleaned)
	relToRoot, err := filepath.Rel(rootAbs, abs)
	if err != nil || strings.HasPrefix(relToRoot, "..") {
		return "", "", fmt.Errorf("unsafe path")
	}
	return abs, filepath.ToSlash(relToRoot), nil
}
