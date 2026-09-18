//go:build !windows

package process

import "os/exec"

func Hide(cmd *exec.Cmd) {}

func HideTask(cmd *exec.Cmd) {}

func KillTask(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}
