package workspace

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// CreateFile writes an empty UTF-8 file if the path does not exist.
func CreateFile(rootAbs, rel string) (FileBody, error) {
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return FileBody{}, err
	}
	if slash == "" || strings.HasSuffix(rel, "/") {
		return FileBody{}, userErr("file", "name a file, not a folder")
	}
	if _, err := os.Stat(abs); err == nil {
		return FileBody{}, userErr("conflict", "destination already exists")
	}
	result, err := WriteTextAt(rootAbs, rel, "", "", false)
	if err != nil {
		return FileBody{}, err
	}
	if !result.OK {
		return FileBody{}, userErr("conflict", "destination already exists")
	}
	return result.Body, nil
}

// CreateDir creates a workspace-relative directory.
func CreateDir(rootAbs, rel string) error {
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return err
	}
	if slash == "" {
		return userErr("directory", "path is the workspace root")
	}
	if err := os.MkdirAll(abs, 0o700); err != nil {
		return mapIOError(err)
	}
	return nil
}

// RenameRel moves a workspace-relative path.
func RenameRel(rootAbs, from, to string) error {
	src, fromSlash, err := RelSafe(rootAbs, from)
	if err != nil {
		return err
	}
	dst, toSlash, err := RelSafe(rootAbs, to)
	if err != nil {
		return err
	}
	if fromSlash == "" || toSlash == "" {
		return userErr("directory", "cannot rename the workspace root")
	}
	if _, err := os.Stat(dst); err == nil {
		return userErr("conflict", "destination already exists")
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return mapIOError(err)
	}
	if err := os.Rename(src, dst); err != nil {
		return mapIOError(err)
	}
	return nil
}

// TrashRel moves a path into .ide-trash so it can be restored from disk.
func TrashRel(rootAbs, rel string) (string, error) {
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return "", err
	}
	if slash == "" {
		return "", userErr("directory", "cannot delete the workspace root")
	}
	trashRoot := filepath.Join(rootAbs, ".ide-trash")
	if err := os.MkdirAll(trashRoot, 0o700); err != nil {
		return "", mapIOError(err)
	}
	entry, err := os.MkdirTemp(trashRoot, "entry-")
	if err != nil {
		return "", mapIOError(err)
	}
	destRel := ".ide-trash/" + filepath.Base(entry) + "/" + slash
	destAbs, _, err := RelSafe(rootAbs, destRel)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(destAbs), 0o700); err != nil {
		return "", mapIOError(err)
	}
	if err := os.Rename(abs, destAbs); err != nil {
		return "", mapIOError(err)
	}
	return destRel, nil
}

// RevealRel opens the host file manager on a workspace path.
func RevealRel(rootAbs, rel string) error {
	abs := rootAbs
	if strings.TrimSpace(rel) != "" {
		next, slash, err := RelSafe(rootAbs, rel)
		if err != nil {
			return err
		}
		if slash != "" {
			abs = next
		}
	}
	if runtime.GOOS == "windows" {
		cmd := exec.Command("explorer.exe", "/select,"+abs)
		return cmd.Start()
	}
	cmd := exec.Command("xdg-open", filepath.Dir(abs))
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", "-R", abs)
	}
	return cmd.Start()
}

// RestoreRel moves a .ide-trash entry back to its original relative path.
func RestoreRel(rootAbs, trashRel string) (string, error) {
	src, slash, err := RelSafe(rootAbs, trashRel)
	if err != nil {
		return "", err
	}
	const prefix = ".ide-trash/"
	if !strings.HasPrefix(slash, prefix) {
		return "", userErr("directory", "path is not in the workspace trash")
	}
	rest := strings.TrimPrefix(slash, prefix)
	stamp, orig, ok := strings.Cut(rest, "/")
	if !ok || stamp == "" || orig == "" {
		return "", userErr("directory", "trash path is incomplete")
	}
	dst, origSlash, err := RelSafe(rootAbs, orig)
	if err != nil {
		return "", err
	}
	if origSlash == "" {
		return "", userErr("directory", "cannot restore onto the workspace root")
	}
	if _, err := os.Stat(dst); err == nil {
		return "", userErr("conflict", "destination already exists")
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return "", mapIOError(err)
	}
	if err := os.Rename(src, dst); err != nil {
		return "", mapIOError(err)
	}
	return origSlash, nil
}
