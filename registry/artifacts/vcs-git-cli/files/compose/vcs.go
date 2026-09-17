package compose

import (
	"os/exec"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type VCSService struct{}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&VCSService{}))
	})
}

func (service *VCSService) Status() (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = root.Abs
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", errString("vcs: " + strings.TrimSpace(string(out)+" "+err.Error()))
	}
	return string(out), nil
}
