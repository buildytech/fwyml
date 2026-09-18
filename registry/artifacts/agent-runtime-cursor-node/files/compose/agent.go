package compose

import "github.com/wailsapp/wails/v3/pkg/application"

// AgentService is selected but blocked: the sidecar runtime is not extracted.
// Prompt/Abort/Status exist so the surface can show an honest offline contract.
type AgentService struct{}

const agentBlocked = "blocked: agent runtime sidecar is not extracted"

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&AgentService{}))
	})
}

func (service *AgentService) Runtime() string { return "agent@0" }

func (service *AgentService) Status() map[string]any {
	return map[string]any{
		"ready":  false,
		"reason": agentBlocked,
		"bridge": "cursor-node",
	}
}

func (service *AgentService) Prompt(sessionId, text string) (string, error) {
	return "", errString(agentBlocked)
}

func (service *AgentService) Abort(sessionId string) error {
	return errString(agentBlocked)
}
