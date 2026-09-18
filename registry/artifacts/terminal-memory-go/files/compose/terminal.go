package compose

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// TerminalService is an in-memory preview terminal (Linux-safe; not a PTY).
type TerminalService struct {
	mu      sync.Mutex
	session string
	output  string
	line    strings.Builder
	cols    int
	rows    int
}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&TerminalService{cols: 80, rows: 24}))
	})
}

func (service *TerminalService) Runtime() string { return "terminal@0" }

func (service *TerminalService) Environments() []map[string]string {
	return []map[string]string{{"id": "preview", "label": "Preview shell (in-memory)"}}
}

func (service *TerminalService) Start(env string) (map[string]string, error) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.session = fmt.Sprintf("term-%d", time.Now().UnixMilli())
	service.line.Reset()
	service.output = fmt.Sprintf(
		"TerminalService · in-memory (%s) · no PTY\r\nType help · clear · echo …\r\n$ ",
		env,
	)
	return map[string]string{"id": service.session, "env": env}, nil
}

func (service *TerminalService) Read() map[string]any {
	service.mu.Lock()
	defer service.mu.Unlock()
	out := service.output
	service.output = ""
	return map[string]any{"data": out, "done": false}
}

func (service *TerminalService) Write(input string) error {
	service.mu.Lock()
	defer service.mu.Unlock()
	for _, r := range input {
		switch r {
		case '\r', '\n':
			cmd := strings.TrimSpace(service.line.String())
			service.line.Reset()
			service.output += "\r\n"
			service.output += service.handleLine(cmd)
			service.output += "$ "
		case 0x7f, '\b': // backspace
			s := service.line.String()
			if len(s) == 0 {
				continue
			}
			service.line.Reset()
			service.line.WriteString(s[:len(s)-1])
			service.output += "\b \b"
		default:
			service.line.WriteRune(r)
			service.output += string(r)
		}
	}
	return nil
}

func (service *TerminalService) handleLine(cmd string) string {
	if cmd == "" {
		return ""
	}
	lower := strings.ToLower(cmd)
	switch {
	case lower == "help":
		return "in-memory shell (no PTY): help | clear | echo <text>\r\n"
	case lower == "clear":
		// ANSI clear screen + home — xterm understands this; still not a PTY.
		return "\x1b[2J\x1b[H"
	case strings.HasPrefix(lower, "echo ") || lower == "echo":
		return strings.TrimSpace(cmd[4:]) + "\r\n"
	default:
		return fmt.Sprintf("recorded (no PTY): %s\r\n", cmd)
	}
}

func (service *TerminalService) Resize(cols, rows int) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.cols, service.rows = cols, rows
}

func (service *TerminalService) Close() {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.session = ""
	service.output = ""
	service.line.Reset()
}
