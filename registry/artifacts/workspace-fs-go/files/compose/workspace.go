package compose

import (
	"sync"

	"example.com/app/internal/workspace"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// WorkspaceSnapshot is the UI-safe identity of the selected workspace.
type WorkspaceSnapshot struct {
	Attached bool   `json:"attached"`
	Label    string `json:"label"`
}

// WorkspaceService is the Wails-facing workspace@0 adapter (extracted from ide packages/go/workspace).
type WorkspaceService struct {
	mu   sync.Mutex
	root workspace.Root
}

var attachedWorkspace *WorkspaceService

// AttachedRoot returns the currently attached workspace root for sibling adapters (explorer/vcs/terminal).
func AttachedRoot() (workspace.Root, error) {
	if attachedWorkspace == nil {
		return workspace.Root{}, errNoWorkspace
	}
	attachedWorkspace.mu.Lock()
	defer attachedWorkspace.mu.Unlock()
	if attachedWorkspace.root.Empty() {
		return workspace.Root{}, errNoWorkspace
	}
	return attachedWorkspace.root, nil
}

// OpenAttached opens a workspace path for sibling adapters (userstore recent/reopen).
func OpenAttached(path string) (WorkspaceSnapshot, error) {
	if attachedWorkspace == nil {
		return WorkspaceSnapshot{}, errNoWorkspace
	}
	return attachedWorkspace.OpenWorkspace(path)
}

func init() {
	service := &WorkspaceService{}
	attachedWorkspace = service
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(service))
	})
}

func (service *WorkspaceService) Workspace() WorkspaceSnapshot {
	service.mu.Lock()
	defer service.mu.Unlock()
	if service.root.Empty() {
		return WorkspaceSnapshot{}
	}
	return WorkspaceSnapshot{Attached: true, Label: service.root.Label}
}

func (service *WorkspaceService) OpenWorkspace(path string) (WorkspaceSnapshot, error) {
	root, err := workspace.Open(path)
	if err != nil {
		return WorkspaceSnapshot{}, err
	}
	service.mu.Lock()
	service.root = root
	service.mu.Unlock()
	return service.Workspace(), nil
}

func (service *WorkspaceService) Tree() ([]workspace.TreeNode, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return nil, err
	}
	return workspace.ListTree(root.Abs)
}

func (service *WorkspaceService) ReadFile(rel string) (workspace.FileBody, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return workspace.FileBody{}, err
	}
	return workspace.ReadText(root.Abs, rel)
}

func (service *WorkspaceService) WriteFile(rel, text, revision string) (workspace.WriteResult, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return workspace.WriteResult{}, err
	}
	return workspace.WriteTextAt(root.Abs, rel, text, revision, false)
}

func (service *WorkspaceService) WriteFileForce(rel, text string) (workspace.FileBody, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return workspace.FileBody{}, err
	}
	return workspace.WriteText(root.Abs, rel, text)
}

func (service *WorkspaceService) CreateFile(rel string) (workspace.FileBody, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return workspace.FileBody{}, err
	}
	return workspace.CreateFile(root.Abs, rel)
}

func (service *WorkspaceService) CreateDir(rel string) error {
	root, err := service.lockedRoot()
	if err != nil {
		return err
	}
	return workspace.CreateDir(root.Abs, rel)
}

func (service *WorkspaceService) RenamePath(from, to string) error {
	root, err := service.lockedRoot()
	if err != nil {
		return err
	}
	return workspace.RenameRel(root.Abs, from, to)
}

func (service *WorkspaceService) TrashPath(rel string) (string, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return "", err
	}
	return workspace.TrashRel(root.Abs, rel)
}

func (service *WorkspaceService) RestorePath(rel string) (string, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return "", err
	}
	return workspace.RestoreRel(root.Abs, rel)
}

func (service *WorkspaceService) RevealPath(rel string) error {
	root, err := service.lockedRoot()
	if err != nil {
		return err
	}
	return workspace.RevealRel(root.Abs, rel)
}

func (service *WorkspaceService) Search(query string, caseSensitive bool, include, exclude string) ([]workspace.SearchHit, error) {
	root, err := service.lockedRoot()
	if err != nil {
		return nil, err
	}
	return workspace.SearchLiteralFilter(root.Abs, query, caseSensitive, include, exclude)
}

func (service *WorkspaceService) lockedRoot() (workspace.Root, error) {
	service.mu.Lock()
	defer service.mu.Unlock()
	if service.root.Empty() {
		return workspace.Root{}, errNoWorkspace
	}
	return service.root, nil
}

var errNoWorkspace = errString("no-workspace: no workspace folder")
