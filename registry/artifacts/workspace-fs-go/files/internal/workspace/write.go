package workspace

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type FileBody struct {
	Path     string `json:"path"`
	Text     string `json:"text"`
	Revision string `json:"revision"`
}

type WriteResult struct {
	OK       bool     `json:"ok"`
	Conflict string   `json:"conflict,omitempty"`
	Body     FileBody `json:"body"`
	Disk     FileBody `json:"disk"`
}

func revisionOf(text string, mod time.Time) string {
	sum := sha256.Sum256([]byte(text + "|" + mod.UTC().Format(time.RFC3339Nano)))
	return hex.EncodeToString(sum[:8])
}

func ReadText(rootAbs, rel string) (FileBody, error) {
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return FileBody{}, err
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return FileBody{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return FileBody{}, err
	}
	return FileBody{Path: slash, Text: string(data), Revision: revisionOf(string(data), info.ModTime())}, nil
}

func WriteTextAt(rootAbs, rel, text, expected string, force bool) (WriteResult, error) {
	abs, slash, err := RelSafe(rootAbs, rel)
	if err != nil {
		return WriteResult{}, err
	}
	if slash == "" {
		return WriteResult{}, fmt.Errorf("cannot write the workspace root")
	}
	if _, err := os.Stat(abs); err == nil && !force {
		current, readErr := ReadText(rootAbs, rel)
		if readErr != nil {
			return WriteResult{}, readErr
		}
		if expected == "" || current.Revision != expected {
			return WriteResult{OK: false, Conflict: "changed", Disk: current}, nil
		}
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o700); err != nil {
		return WriteResult{}, err
	}
	if err := os.WriteFile(abs, []byte(text), 0o600); err != nil {
		return WriteResult{}, err
	}
	body, err := ReadText(rootAbs, rel)
	if err != nil {
		return WriteResult{}, err
	}
	return WriteResult{OK: true, Body: body}, nil
}
