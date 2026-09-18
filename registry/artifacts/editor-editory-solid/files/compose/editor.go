package compose

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// EditorService exposes a document buffer over IPC (editory-solid visual markdown + editor@0 document buffer).
type EditorService struct {
	mu   sync.Mutex
	path string
	text string
}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&EditorService{}))
	})
}

func (service *EditorService) Runtime() string { return "editor@0" }

func (service *EditorService) Open(path, text string) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.path = path
	service.text = text
}

func (service *EditorService) Document() map[string]string {
	service.mu.Lock()
	defer service.mu.Unlock()
	return map[string]string{"path": service.path, "text": service.text}
}

func (service *EditorService) Write(text string) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.text = text
}
