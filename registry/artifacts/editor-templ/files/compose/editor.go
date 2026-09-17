package compose

import "github.com/wailsapp/wails/v3/pkg/application"

// EditorService is a document buffer. This adapter is a textarea-level
// implementation and must not be treated as a CodeMirror-equivalent editor.
type EditorService struct {
	Value     string `json:"value"`
	Selection [2]int `json:"selection"`
}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&EditorService{}))
	})
}

func (service *EditorService) Kind() string {
	return "textarea"
}

func (service *EditorService) Open(value string) EditorService {
	service.Value = value
	service.Selection = [2]int{0, 0}
	return *service
}

func (service *EditorService) Update(value string, start, end int) EditorService {
	service.Value = value
	service.Selection = [2]int{start, end}
	return *service
}
