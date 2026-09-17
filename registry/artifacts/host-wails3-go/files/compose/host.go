package compose

import "github.com/wailsapp/wails/v3/pkg/application"

// HostService exposes application lifecycle over IPC.
type HostService struct {
	app *application.App
}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&HostService{app: app}))
	})
}

func (service *HostService) Runtime() string {
	return "host@0"
}

func (service *HostService) PickFolder() (string, error) {
	if service.app == nil {
		return "", errString("host is not ready")
	}
	return service.app.Dialog.OpenFile().
		SetTitle("Open folder").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
}
