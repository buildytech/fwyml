package workspace

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"
)

const (
	FileMaxBytes = 1 << 20
	treeMaxNodes = 4000
)

var treeSkip = map[string]struct{}{
	".git": {}, ".next": {}, ".nuxt": {}, ".output": {}, ".pnpm-store": {},
	".turbo": {}, ".vercel": {}, ".ui8px": {}, "coverage": {}, "dist": {},
	"node_modules": {}, "bin": {}, ".ide-trash": {},
}

// UserError is a classified workspace error for the WebView.
type UserError struct {
	Code string
	Msg  string
}

func (err *UserError) Error() string {
	if err == nil {
		return ""
	}
	return err.Code + ": " + err.Msg
}

func userErr(code, msg string) error {
	return &UserError{Code: code, Msg: msg}
}

// NewUserError creates a workspace-compatible classified error for an adapter.
func NewUserError(code, message string) error {
	return userErr(code, message)
}

// TreeNode is a relative workspace entry. Path uses forward slashes.
type TreeNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	Dir      bool       `json:"dir"`
	Children []TreeNode `json:"children,omitempty"`
}

// FileBody is file text for the editor. Path is workspace-relative.
type FileBody struct {
	Path     string `json:"path"`
	Text     string `json:"text"`
	Revision string `json:"revision"`
}

// WriteResult is a checked write. Conflict is "changed" or "missing".
type WriteResult struct {
	OK       bool     `json:"ok"`
	Conflict string   `json:"conflict,omitempty"`
	Body     FileBody `json:"body"`
	Disk     FileBody `json:"disk"`
}

var writeGates sync.Map

func lockAbs(abs string) func() {
	held, _ := writeGates.LoadOrStore(abs, &sync.Mutex{})
	mu := held.(*sync.Mutex)
	mu.Lock()
	return mu.Unlock
}

func bodyAfterRead(_ string, slash, text string) (FileBody, error) {
	return FileBody{Path: slash, Text: text, Revision: fmt.Sprintf("%x", sha256.Sum256([]byte(text)))}, nil
}

func listedName(name string) bool {
	if _, skip := treeSkip[name]; skip {
		return false
	}
	return true
}

// RelSafe resolves a workspace-relative path. Empty rel is the root.
func RelSafe(rootAbs, rel string) (abs string, slash string, err error) {
	raw := strings.TrimSpace(strings.ReplaceAll(rel, "\x00", ""))
	rootAbs = filepath.Clean(rootAbs)
	if raw == "" || raw == "." || raw == "./" {
		return rootAbs, "", nil
	}
	if filepath.IsAbs(raw) || (len(raw) >= 2 && raw[1] == ':') {
		return "", "", fmt.Errorf("path must be relative")
	}
	norm := filepath.ToSlash(raw)
	if strings.HasPrefix(norm, "/") || strings.Contains(norm, "..") {
		return "", "", fmt.Errorf("path escapes workspace")
	}
	joined := filepath.Clean(filepath.Join(rootAbs, filepath.FromSlash(norm)))
	relToRoot, err := filepath.Rel(rootAbs, joined)
	if err != nil || strings.HasPrefix(relToRoot, "..") {
		return "", "", fmt.Errorf("path escapes workspace")
	}
	return joined, filepath.ToSlash(relToRoot), nil
}

// ListTree walks the workspace for the file sidebar.
func ListTree(rootAbs string) ([]TreeNode, error) {
	count := 0
	return listDir(rootAbs, "", &count)
}

func listDir(absDir, relDir string, count *int) ([]TreeNode, error) {
	entries, err := os.ReadDir(absDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool {
		a, b := entries[i], entries[j]
		if a.IsDir() != b.IsDir() {
			return a.IsDir()
		}
		return strings.ToLower(a.Name()) < strings.ToLower(b.Name())
	})
	out := make([]TreeNode, 0, len(entries))
	for _, entry := range entries {
		if *count >= treeMaxNodes {
			break
		}
		name := entry.Name()
		if !listedName(name) {
			continue
		}
		childRel := name
		if relDir != "" {
			childRel = relDir + "/" + name
		}
		node := TreeNode{Name: name, Path: childRel, Dir: entry.IsDir()}
		*count++
		if entry.IsDir() {
			info, err := entry.Info()
			if err != nil || !info.IsDir() {
				continue
			}
			if info.Mode()&os.ModeSymlink != 0 {
				continue
			}
			kids, err := listDir(filepath.Join(absDir, name), childRel, count)
			if err != nil {
				return nil, err
			}
			node.Children = kids
		}
		out = append(out, node)
	}
	return out, nil
}

// ReadText returns UTF-8 file bytes under the workspace root.
func ReadText(rootAbs, rel string) (FileBody, error) {
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return FileBody{}, err
	}
	if slash == "" {
		return FileBody{}, fmt.Errorf("path is a directory")
	}
	info, err := os.Stat(abs)
	if err != nil {
		return FileBody{}, mapIOError(err)
	}
	if info.IsDir() {
		return FileBody{}, userErr("directory", "path is a directory")
	}
	if info.Size() > FileMaxBytes {
		return FileBody{}, userErr("too-large", "file exceeds 1 MiB")
	}
	raw, err := os.ReadFile(abs)
	if err != nil {
		return FileBody{}, mapIOError(err)
	}
	if !utf8.Valid(raw) {
		return FileBody{}, userErr("utf8", "file is not UTF-8 text")
	}
	return bodyAfterRead(abs, slash, string(raw))
}

// RelUnder returns a workspace-relative slash path for an absolute file.
func RelUnder(rootAbs, fileAbs string) (string, error) {
	rootAbs = filepath.Clean(rootAbs)
	fileAbs = filepath.Clean(fileAbs)
	rel, err := filepath.Rel(rootAbs, fileAbs)
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("path escapes workspace")
	}
	if filepath.IsAbs(rel) {
		return "", fmt.Errorf("path escapes workspace")
	}
	return filepath.ToSlash(rel), nil
}

// WriteText writes UTF-8 text under the workspace root, replacing the file.
func WriteText(rootAbs, rel, text string) (FileBody, error) {
	result, err := WriteTextAt(rootAbs, rel, text, "", true)
	if err != nil {
		return FileBody{}, err
	}
	return result.Body, nil
}

// WriteTextAt writes UTF-8 text when expected matches the on-disk revision.
// An empty expected revision with overwrite false creates only if the path is free.
func WriteTextAt(rootAbs, rel, text, expected string, overwrite bool) (WriteResult, error) {
	if len(text) > FileMaxBytes {
		return WriteResult{}, userErr("too-large", "file exceeds 1 MiB")
	}
	if !utf8.ValidString(text) {
		return WriteResult{}, userErr("utf8", "file is not UTF-8 text")
	}
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return WriteResult{}, err
	}
	if slash == "" {
		return WriteResult{}, fmt.Errorf("path is a directory")
	}
	unlock := lockAbs(abs)
	defer unlock()
	info, statErr := os.Stat(abs)
	if statErr == nil && info.IsDir() {
		return WriteResult{}, fmt.Errorf("path is a directory")
	}
	if statErr == nil {
		if !overwrite {
			disk, readErr := ReadText(rootAbs, rel)
			if readErr != nil {
				return WriteResult{}, readErr
			}
			if expected != disk.Revision {
				return WriteResult{OK: false, Conflict: "changed", Disk: disk}, nil
			}
		}
	} else if !os.IsNotExist(statErr) {
		return WriteResult{}, statErr
	} else if !overwrite && expected != "" {
		return WriteResult{OK: false, Conflict: "missing", Disk: FileBody{Path: slash}}, nil
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o700); err != nil {
		return WriteResult{}, mapIOError(err)
	}
	temp, err := os.CreateTemp(filepath.Dir(abs), ".ide-save-*")
	if err != nil {
		return WriteResult{}, mapIOError(err)
	}
	tmp := temp.Name()
	defer os.Remove(tmp)
	if _, err = temp.WriteString(text); err != nil {
		temp.Close()
		return WriteResult{}, mapIOError(err)
	}
	if statErr == nil {
		if err = temp.Chmod(info.Mode().Perm()); err != nil {
			temp.Close()
			return WriteResult{}, mapIOError(err)
		}
	}
	if err = temp.Sync(); err != nil {
		temp.Close()
		return WriteResult{}, mapIOError(err)
	}
	if err = temp.Close(); err != nil {
		return WriteResult{}, mapIOError(err)
	}
	if err = os.Rename(tmp, abs); err != nil {
		return WriteResult{}, mapIOError(err)
	}
	body, err := bodyAfterRead(abs, slash, text)
	if err != nil {
		return WriteResult{}, err
	}
	return WriteResult{OK: true, Body: body}, nil
}

func mapIOError(err error) error {
	if err == nil {
		return nil
	}
	if os.IsNotExist(err) {
		return userErr("missing", "file does not exist")
	}
	if os.IsPermission(err) {
		return userErr("permission", err.Error())
	}
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "read-only") || strings.Contains(lower, "erofs") {
		return userErr("read-only", err.Error())
	}
	return err
}
