package compose

import "github.com/wailsapp/wails/v3/pkg/application"

// AgentService is selected but blocked: the sidecar runtime is not extracted.
// Prompt and abort exist so the surface compiles; runs fail closed.
type AgentService struct{}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&AgentService{}))
	})
}

func (service *AgentService) Prompt(sessionId, text string) (string, error) {
	return "", errString("blocked: agent runtime sidecar is not extracted")
}

func (service *AgentService) Abort(sessionId string) error {
	return errString("blocked: agent runtime sidecar is not extracted")
}
