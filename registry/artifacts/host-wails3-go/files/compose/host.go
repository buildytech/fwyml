package compose

import "github.com/wailsapp/wails/v3/pkg/application"

// HostService exposes application lifecycle over IPC.
type HostService struct{}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&HostService{}))
	})
}

func (service *HostService) Runtime() string {
	return "host@0"
}
