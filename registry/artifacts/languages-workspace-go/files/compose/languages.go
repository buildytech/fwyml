package compose

import (
	"example.com/app/internal/language"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// LanguageService exposes languages@0 document operations over the attached workspace.
type LanguageService struct{}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&LanguageService{}))
	})
}

func (service *LanguageService) Runtime() string { return "languages@0" }

func (service *LanguageService) Status(rel string) (language.LanguageStatus, error) {
	root, err := AttachedRoot()
	if err != nil {
		return language.LanguageStatus{}, err
	}
	return language.LanguageForPath(root.Abs, rel), nil
}

func (service *LanguageService) Format(rel, text string) (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return language.FormatText(root.Abs, rel, text)
}

func (service *LanguageService) Definition(rel, text string, line, column int) ([]language.LanguageHit, error) {
	root, err := AttachedRoot()
	if err != nil {
		return nil, err
	}
	return language.FindDefinitions(root.Abs, rel, text, line, column)
}

func (service *LanguageService) Hover(rel, text string, line, column int) (string, error) {
	root, err := AttachedRoot()
	if err != nil {
		return "", err
	}
	return language.HoverText(root.Abs, rel, text, line, column)
}

func (service *LanguageService) Diagnostics(rel string) ([]language.LanguageHit, error) {
	root, err := AttachedRoot()
	if err != nil {
		return nil, err
	}
	return language.FileDiagnostics(root.Abs, rel)
}

func (service *LanguageService) Complete(rel, text string, line, column int) ([]language.LanguageHit, error) {
	root, err := AttachedRoot()
	if err != nil {
		return nil, err
	}
	return language.Completions(root.Abs, rel, text, line, column)
}

// CancelValidation is a no-op placeholder (ide BFF cancels long-running validation tasks).
func (service *LanguageService) CancelValidation() error { return nil }

