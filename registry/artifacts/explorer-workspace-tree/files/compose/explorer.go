package compose

import (
	"example.com/app/internal/workspace"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ExplorerService exposes the workspace tree for the explorer@0 port.
type ExplorerService struct{}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&ExplorerService{}))
	})
}

// Tree returns the recursive workspace file tree (workspace.ListTree).
func (service *ExplorerService) Tree() ([]workspace.TreeNode, error) {
	root, err := AttachedRoot()
	if err != nil {
		return nil, err
	}
	return workspace.ListTree(root.Abs)
}
