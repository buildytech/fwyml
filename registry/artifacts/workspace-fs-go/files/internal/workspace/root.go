// Package workspace canonicalizes the folder that becomes the agent cwd.
package workspace

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Root is a validated workspace directory. Abs is host-only.
type Root struct {
	Abs   string
	Label string
}

func (root Root) Empty() bool {
	return root.Abs == ""
}

// Open validates path as an existing directory and returns a stable root.
func Open(path string) (Root, error) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return Root{}, fmt.Errorf("workspace path is empty")
	}
	abs, err := filepath.Abs(trimmed)
	if err != nil {
		return Root{}, fmt.Errorf("workspace path: %w", err)
	}
	abs = filepath.Clean(abs)
	info, err := os.Stat(abs)
	if err != nil {
		return Root{}, fmt.Errorf("workspace path: %w", err)
	}
	if !info.IsDir() {
		return Root{}, fmt.Errorf("workspace path is not a directory")
	}
	label := filepath.Base(abs)
	if label == "" || label == string(filepath.Separator) {
		label = "workspace"
	}
	return Root{Abs: abs, Label: label}, nil
}
