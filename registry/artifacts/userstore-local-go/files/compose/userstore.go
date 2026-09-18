package compose

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"example.com/app/internal/userstore"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// UserState is the UI-safe durable prefs + recent + recovery snapshot.
type UserState struct {
	PrefsJSON string                     `json:"prefsJSON"`
	Recent    []userstore.RecentPublic   `json:"recent"`
	Recovery  []userstore.RecoveryBuffer `json:"recovery"`
}

// UserStoreService exposes userstore@0 over Wails (prefs/layout/recovery/recent).
type UserStoreService struct {
	mu    sync.Mutex
	store *userstore.Store
	wsKey string
}

var attachedUserStore *UserStoreService

func init() {
	service := &UserStoreService{}
	dir, root := defaultUserStorePaths()
	store, err := openUserStore(dir, root)
	if err == nil {
		service.store = store
	}
	attachedUserStore = service
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(service))
	})
}

func defaultUserStorePaths() (dir, root string) {
	exe, err := os.Executable()
	if err != nil {
		cfg, _ := os.UserConfigDir()
		if cfg == "" {
			cfg = os.TempDir()
		}
		return filepath.Join(cfg, "ide-solid-full", "state"), ""
	}
	root = filepath.Dir(exe)
	return filepath.Join(root, "data", "state"), root
}

func openUserStore(dir, root string) (*userstore.Store, error) {
	if root != "" {
		return userstore.OpenPortable(dir, root)
	}
	return userstore.OpenAt(dir)
}

func (service *UserStoreService) Runtime() string { return "userstore@0" }

func (service *UserStoreService) current() *userstore.Store {
	service.mu.Lock()
	defer service.mu.Unlock()
	return service.store
}

func (service *UserStoreService) workspaceKeyLocked() string {
	if service.wsKey != "" {
		return service.wsKey
	}
	root, err := AttachedRoot()
	if err != nil || root.Empty() {
		return ""
	}
	if service.store == nil {
		return userstore.WorkspaceKey(root.Abs)
	}
	return service.store.WorkspaceKey(root.Abs)
}

func (service *UserStoreService) LoadUserState() (UserState, error) {
	store := service.current()
	if store == nil {
		return UserState{}, nil
	}
	prefs, err := store.LoadPrefsJSON()
	if err != nil {
		return UserState{}, err
	}
	recent, err := store.Recent()
	if err != nil {
		return UserState{}, err
	}
	recovery, err := store.LoadRecovery()
	if err != nil {
		return UserState{}, err
	}
	service.mu.Lock()
	key := service.workspaceKeyLocked()
	service.mu.Unlock()
	return UserState{
		PrefsJSON: prefs,
		Recent:    recent,
		Recovery:  userstore.FilterRecovery(recovery, key),
	}, nil
}

func (service *UserStoreService) SaveUserPrefs(raw string) error {
	store := service.current()
	if store == nil {
		return nil
	}
	return store.SavePrefsJSON(userstore.SanitizePrefsJSON(raw))
}

func (service *UserStoreService) SaveRecovery(raw string) error {
	store := service.current()
	if store == nil {
		return nil
	}
	var items []userstore.RecoveryBuffer
	if raw != "" {
		if err := json.Unmarshal([]byte(raw), &items); err != nil {
			return err
		}
	}
	service.mu.Lock()
	key := service.workspaceKeyLocked()
	service.mu.Unlock()
	for i := range items {
		if items[i].WorkspaceKey == "" {
			items[i].WorkspaceKey = key
		}
	}
	return store.SaveRecovery(items)
}

func (service *UserStoreService) ClearRecovery() error {
	store := service.current()
	if store == nil {
		return nil
	}
	return store.ClearRecovery()
}

func (service *UserStoreService) LoadWorkspaceLayout() (userstore.SessionLayout, error) {
	store := service.current()
	if store == nil {
		return userstore.SessionLayout{}, nil
	}
	service.mu.Lock()
	key := service.workspaceKeyLocked()
	service.mu.Unlock()
	return store.LoadLayout(key)
}

func (service *UserStoreService) SaveWorkspaceLayout(raw string) error {
	store := service.current()
	if store == nil {
		return nil
	}
	var layout userstore.SessionLayout
	if raw != "" {
		if err := json.Unmarshal([]byte(raw), &layout); err != nil {
			return err
		}
	}
	service.mu.Lock()
	key := service.workspaceKeyLocked()
	service.mu.Unlock()
	return store.SaveLayout(key, layout)
}

// RememberCurrent records the attached workspace folder in recent list.
func (service *UserStoreService) RememberCurrent() ([]userstore.RecentPublic, error) {
	store := service.current()
	if store == nil {
		return nil, nil
	}
	root, err := AttachedRoot()
	if err != nil {
		return store.Recent()
	}
	service.mu.Lock()
	service.wsKey = store.WorkspaceKey(root.Abs)
	service.mu.Unlock()
	return store.Remember(root.Abs, root.Label)
}

// OpenRecentWorkspace attaches a remembered folder by opaque id via WorkspaceService.
func (service *UserStoreService) OpenRecentWorkspace(id string) (WorkspaceSnapshot, error) {
	store := service.current()
	if store == nil {
		return WorkspaceSnapshot{}, errString("userstore unavailable")
	}
	abs, err := store.Resolve(id)
	if err != nil {
		return WorkspaceSnapshot{}, err
	}
	snap, err := OpenAttached(abs)
	if err != nil {
		return WorkspaceSnapshot{}, err
	}
	_, _ = service.RememberCurrent()
	return snap, nil
}

// ReopenLastWorkspace attaches the most recent existing folder, if any.
func (service *UserStoreService) ReopenLastWorkspace() (WorkspaceSnapshot, error) {
	store := service.current()
	if store == nil {
		return WorkspaceSnapshot{}, nil
	}
	abs, err := store.LastAbs()
	if err != nil || abs == "" {
		return WorkspaceSnapshot{}, err
	}
	snap, err := OpenAttached(abs)
	if err != nil {
		return WorkspaceSnapshot{}, err
	}
	_, _ = service.RememberCurrent()
	return snap, nil
}
