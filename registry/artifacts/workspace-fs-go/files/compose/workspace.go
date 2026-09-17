package compose

import (
	"sync"

	"example.com/app/internal/workspace"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type WorkspaceSnapshot struct {
	Attached bool   `json:"attached"`
	Label    string `json:"label"`
}

type WorkspaceService struct {
	mu   sync.Mutex
	root workspace.Root
}

var attachedWorkspace *WorkspaceService

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

func (service *WorkspaceService) ReadFile(rel string) (workspace.FileBody, error) {
	service.mu.Lock()
	root := service.root
	service.mu.Unlock()
	if root.Empty() {
		return workspace.FileBody{}, errNoWorkspace
	}
	return workspace.ReadText(root.Abs, rel)
}

func (service *WorkspaceService) WriteFile(rel, text, revision string) (workspace.WriteResult, error) {
	service.mu.Lock()
	root := service.root
	service.mu.Unlock()
	if root.Empty() {
		return workspace.WriteResult{}, errNoWorkspace
	}
	return workspace.WriteTextAt(root.Abs, rel, text, revision, false)
}

var errNoWorkspace = errString("no-workspace: no workspace folder")
