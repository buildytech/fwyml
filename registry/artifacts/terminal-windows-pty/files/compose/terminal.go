package compose

import (
	"encoding/base64"
	"fmt"
	"sync"

	"example.com/app/internal/terminal"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// TerminalService wraps ide internal/terminal (Windows ConPTY). On !windows, Start fails honestly.
type TerminalService struct {
	mu       sync.Mutex
	sessions map[string]*terminal.Session
	seq      int
}

type TerminalOutput struct {
	Data string `json:"data"`
	Done bool   `json:"done"`
}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&TerminalService{sessions: map[string]*terminal.Session{}}))
	})
}

func (service *TerminalService) Runtime() string { return "terminal@0" }

func (service *TerminalService) Environments() []map[string]string {
	// Windows shells; availability is host-dependent. Linux products should select terminal-memory-go.
	return []map[string]string{
		{"id": "powershell", "label": "PowerShell"},
		{"id": "cmd", "label": "Command Prompt"},
		{"id": "bash", "label": "Bash"},
		{"id": "wsl", "label": "WSL"},
	}
}

func (service *TerminalService) Start(command, cwd string, cols, rows int) (map[string]string, error) {
	if cols < 2 || rows < 2 {
		return nil, fmt.Errorf("invalid terminal dimensions")
	}
	if cwd == "" {
		root, err := AttachedRoot()
		if err != nil {
			return nil, err
		}
		cwd = root.Abs
	}
	session, err := terminal.Start(command, cwd, cols, rows)
	if err != nil {
		return nil, err
	}
	service.mu.Lock()
	defer service.mu.Unlock()
	service.seq++
	id := fmt.Sprintf("pty-%d", service.seq)
	service.sessions[id] = session
	return map[string]string{"id": id}, nil
}

func (service *TerminalService) Read(id string) (TerminalOutput, error) {
	service.mu.Lock()
	session := service.sessions[id]
	service.mu.Unlock()
	if session == nil {
		return TerminalOutput{Done: true}, nil
	}
	raw, done := session.Read()
	return TerminalOutput{Data: base64.StdEncoding.EncodeToString(raw), Done: done}, nil
}

func (service *TerminalService) Write(id, input string) error {
	service.mu.Lock()
	session := service.sessions[id]
	service.mu.Unlock()
	if session == nil {
		return fmt.Errorf("terminal session not found")
	}
	return session.Input(input)
}

func (service *TerminalService) Resize(id string, cols, rows int) error {
	service.mu.Lock()
	session := service.sessions[id]
	service.mu.Unlock()
	if session == nil {
		return nil
	}
	return session.Resize(cols, rows)
}

func (service *TerminalService) Close(id string) {
	service.mu.Lock()
	session := service.sessions[id]
	delete(service.sessions, id)
	service.mu.Unlock()
	if session != nil {
		session.Close()
	}
}
