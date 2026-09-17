package compose

import (
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type TreeNode struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
}

type ExplorerService struct{}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&ExplorerService{}))
	})
}

func (service *ExplorerService) Tree(root string) ([]TreeNode, error) {
	opened, err := workspaceOpen(root)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(opened)
	if err != nil {
		return nil, err
	}
	nodes := make([]TreeNode, 0, len(entries))
	for _, entry := range entries {
		nodes = append(nodes, TreeNode{Path: entry.Name(), Name: entry.Name(), IsDir: entry.IsDir()})
	}
	return nodes, nil
}

func workspaceOpen(root string) (string, error) {
	if root == "" {
		return "", errString("no-workspace: no workspace folder")
	}
	return filepath.Clean(root), nil
}
