package userstore

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	prefsFile   = "prefs.json"
	recentFile  = "recent.json"
	recoverFile = "recovery.json"
	layoutDir   = "layouts"
	maxRecent   = 12
	// RecoveryWindowMS is the UI flush interval that crash restore can rely on.
	// 0 means the editor writes a snapshot on each dirty change.
	RecoveryWindowMS = 0
)

type SessionLayout struct {
	TreePct       float64           `json:"treePct"`
	ChatPct       float64           `json:"chatPct"`
	Tabs          []string          `json:"tabs"`
	Active        string            `json:"active"`
	Line          int               `json:"line"`
	Column        int               `json:"column"`
	BottomTab     string            `json:"bottomTab"`
	BottomVisible bool              `json:"bottomVisible"`
	ChatVisible   bool              `json:"chatVisible"`
	Markdown      map[string]string `json:"markdown,omitempty"`
}

type RecentPublic struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type recentRecord struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Abs   string `json:"abs"`
}

type RecoveryBuffer struct {
	WorkspaceKey string `json:"workspaceKey"`
	Path         string `json:"path"`
	Text         string `json:"text"`
	Revision     string `json:"revision"`
	Untitled     bool   `json:"untitled"`
}

type Store struct {
	mu           sync.Mutex
	dir          string
	portableRoot string
}

func OpenAt(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	return &Store{dir: dir}, nil
}

// OpenPortable stores projects under the application folder as relative paths.
func OpenPortable(dir, root string) (*Store, error) {
	store, err := OpenAt(dir)
	if err != nil {
		return nil, err
	}
	store.portableRoot = filepath.Clean(root)
	return store, nil
}
func (store *Store) portablePath(abs string) string {
	if store.portableRoot != "" {
		rel, err := filepath.Rel(store.portableRoot, abs)
		if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel) {
			return filepath.ToSlash(rel)
		}
	}
	return abs
}
func (store *Store) resolvePath(path string) string {
	if store.portableRoot != "" && !filepath.IsAbs(path) {
		return filepath.Join(store.portableRoot, filepath.FromSlash(path))
	}
	return path
}
func (store *Store) WorkspaceKey(abs string) string { return WorkspaceKey(store.portablePath(abs)) }

func WorkspaceKey(abs string) string {
	sum := sha1.Sum([]byte(filepath.Clean(abs)))
	return hex.EncodeToString(sum[:8])
}

func (store *Store) LoadPrefsJSON() (string, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	raw, err := os.ReadFile(filepath.Join(store.dir, prefsFile))
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func (store *Store) SavePrefsJSON(raw string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	return writeAtomic(filepath.Join(store.dir, prefsFile), []byte(raw))
}

func (store *Store) Remember(abs, label string) ([]RecentPublic, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	abs = filepath.Clean(abs)
	if abs == "" || abs == "." {
		return store.recentLocked()
	}
	if label == "" {
		label = filepath.Base(abs)
	}
	id := store.WorkspaceKey(abs)
	list, err := store.readRecent()
	if err != nil {
		return nil, err
	}
	next := []recentRecord{{ID: id, Label: label, Abs: store.portablePath(abs)}}
	for _, item := range list {
		if item.ID == id {
			continue
		}
		next = append(next, item)
		if len(next) >= maxRecent {
			break
		}
	}
	if err := store.writeRecent(next); err != nil {
		return nil, err
	}
	return publicRecent(next), nil
}

func (store *Store) Recent() ([]RecentPublic, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.recentLocked()
}

func (store *Store) recentLocked() ([]RecentPublic, error) {
	list, err := store.readRecent()
	if err != nil {
		return nil, err
	}
	return publicRecent(list), nil
}

// LastAbs returns the most recent workspace folder if it still exists.
func (store *Store) LastAbs() (string, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	list, err := store.readRecent()
	if err != nil || len(list) == 0 {
		return "", err
	}
	abs := store.resolvePath(list[0].Abs)
	info, err := os.Stat(abs)
	if err != nil || !info.IsDir() {
		return "", nil
	}
	return abs, nil
}

func (store *Store) Resolve(id string) (string, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	list, err := store.readRecent()
	if err != nil {
		return "", err
	}
	for _, item := range list {
		if item.ID == id {
			return store.resolvePath(item.Abs), nil
		}
	}
	return "", os.ErrNotExist
}

func (store *Store) SaveRecovery(items []RecoveryBuffer) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	raw, err := json.Marshal(items)
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(store.dir, recoverFile), raw)
}

func (store *Store) LoadRecovery() ([]RecoveryBuffer, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	raw, err := os.ReadFile(filepath.Join(store.dir, recoverFile))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var items []RecoveryBuffer
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (store *Store) SaveLayout(key string, layout SessionLayout) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if key == "" {
		return nil
	}
	raw, err := json.Marshal(layout)
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(store.dir, layoutDir, key+".json"), raw)
}

func (store *Store) LoadLayout(key string) (SessionLayout, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if key == "" {
		return SessionLayout{}, nil
	}
	raw, err := os.ReadFile(filepath.Join(store.dir, layoutDir, key+".json"))
	if os.IsNotExist(err) {
		return SessionLayout{}, nil
	}
	if err != nil {
		return SessionLayout{}, err
	}
	var layout SessionLayout
	if err := json.Unmarshal(raw, &layout); err != nil {
		return SessionLayout{}, err
	}
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err == nil {
		if _, ok := probe["bottomVisible"]; !ok {
			layout.BottomVisible = true
		}
	}
	return layout, nil
}

func (store *Store) ClearRecovery() error {
	store.mu.Lock()
	defer store.mu.Unlock()
	err := os.Remove(filepath.Join(store.dir, recoverFile))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func (store *Store) readRecent() ([]recentRecord, error) {
	raw, err := os.ReadFile(filepath.Join(store.dir, recentFile))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var list []recentRecord
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (store *Store) writeRecent(list []recentRecord) error {
	raw, err := json.Marshal(list)
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(store.dir, recentFile), raw)
}

func publicRecent(list []recentRecord) []RecentPublic {
	out := make([]RecentPublic, 0, len(list))
	for _, item := range list {
		out = append(out, RecentPublic{ID: item.ID, Label: item.Label})
	}
	return out
}

func writeAtomic(path string, raw []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp := path + ".tmp"
	file, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := file.Write(raw); err != nil {
		file.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func FilterRecovery(items []RecoveryBuffer, workspaceKey string) []RecoveryBuffer {
	if workspaceKey == "" {
		var out []RecoveryBuffer
		for _, item := range items {
			if item.Untitled || item.WorkspaceKey == "" {
				out = append(out, item)
			}
		}
		return out
	}
	var out []RecoveryBuffer
	for _, item := range items {
		if item.WorkspaceKey == workspaceKey || item.Untitled {
			out = append(out, item)
		}
	}
	return out
}

func SanitizePrefsJSON(raw string) string {
	return strings.TrimSpace(raw)
}
