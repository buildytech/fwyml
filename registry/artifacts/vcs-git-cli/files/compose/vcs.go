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

func (service *VCSService) Status(root string) (string, error) {
	if root == "" {
		return "", errString("no-workspace: no workspace folder")
	}
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", errString("vcs-remote: " + strings.TrimSpace(string(out)+" "+err.Error()))
	}
	return string(out), nil
}
