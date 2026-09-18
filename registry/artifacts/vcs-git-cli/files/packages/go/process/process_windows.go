package process

import (
	"os/exec"
	"strconv"
	"syscall"
)

func Hide(cmd *exec.Cmd) { cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true} }

func HideTask(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x00000200}
}

func KillTask(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	kill := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))
	Hide(kill)
	if err := kill.Run(); err != nil {
		return cmd.Process.Kill()
	}
	return nil
}
