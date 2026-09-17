package compose

import "github.com/wailsapp/wails/v3/pkg/application"

// Prepare is set by a selected delivery adapter. Nil means no portable layout.
var Prepare func(executable string) error

var attachers []func(*application.App)

// Attach registers a typed Wails service from a selected adapter or slice.
func Attach(fn func(*application.App)) {
	if fn == nil {
		return
	}
	attachers = append(attachers, fn)
}

// Bind attaches every selected service to the host.
func Bind(app *application.App) {
	for _, fn := range attachers {
		fn(app)
	}
}

type errString string

func (err errString) Error() string { return string(err) }
