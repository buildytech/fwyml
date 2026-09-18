package compose

import (
	"example.com/app/internal/vcs"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// VCSService exposes git CLI operations for the attached workspace (extracted from ide packages/go/vcs).
type VCSService struct{}

type GitFile = vcs.GitFile
type GitSnapshot = vcs.GitSnapshot

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&VCSService{}))
	})
}

func (service *VCSService) Status() (GitSnapshot, error) {
	root, err := AttachedRoot()
	if err != nil {
		return GitSnapshot{}, err
	}
	return vcs.Status(root.Abs)
}

func (service *VCSService) Stage(path string) error {
	root, err := AttachedRoot()
	if err != nil {
		return err
	}
	return vcs.Stage(root.Abs, path)
}

func (service *VCSService) Unstage(path string) error {
	root, err := AttachedRoot()
	if err != nil {
		return err
	}
	return vcs.Unstage(root.Abs, path)
}

func (service *VCSService) Commit(message string) (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return vcs.Commit(root.Abs, message)
}

func (service *VCSService) Push() (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return vcs.Push(root.Abs)
}

func (service *VCSService) Fetch() (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return vcs.Fetch(root.Abs)
}

func (service *VCSService) Pull() (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return vcs.Pull(root.Abs)
}

func (service *VCSService) Diff(path string, staged bool) (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return vcs.Diff(root.Abs, path, staged)
}
