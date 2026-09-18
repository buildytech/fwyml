//go:build !windows

package terminal

import "fmt"

type Session struct{}

func Start(command, cwd string, cols, rows int) (*Session, error) {
	return nil, fmt.Errorf("integrated terminal currently requires Windows")
}
func (*Session) Read() ([]byte, bool)  { return nil, true }
func (*Session) Input(string) error    { return fmt.Errorf("terminal unavailable") }
func (*Session) Resize(int, int) error { return nil }
func (*Session) Close()                {}
