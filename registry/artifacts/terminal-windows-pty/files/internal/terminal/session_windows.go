package terminal

import (
	"bytes"
	"io"
	"os"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Session owns a Windows pseudoconsole and its process tree.
type Session struct {
	mu      sync.Mutex
	output  bytes.Buffer
	input   *os.File
	console windows.Handle
	process windows.Handle
	job     windows.Handle
	closed  bool
	done    bool
	exited  chan struct{}
}

func Start(command, cwd string, cols, rows int) (*Session, error) {
	inputRead, inputWrite, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	defer inputRead.Close()
	outputRead, outputWrite, err := os.Pipe()
	if err != nil {
		inputWrite.Close()
		return nil, err
	}
	defer outputWrite.Close()
	s := &Session{input: inputWrite, exited: make(chan struct{})}
	fail := func(err error) (*Session, error) {
		inputWrite.Close()
		outputRead.Close()
		if s.console != 0 {
			windows.ClosePseudoConsole(s.console)
		}
		if s.job != 0 {
			windows.CloseHandle(s.job)
		}
		return nil, err
	}
	err = windows.CreatePseudoConsole(windows.Coord{X: int16(cols), Y: int16(rows)}, windows.Handle(inputRead.Fd()), windows.Handle(outputWrite.Fd()), 0, &s.console)
	if err != nil {
		return fail(err)
	}
	attrs, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		return fail(err)
	}
	defer attrs.Delete()
	// This attribute takes the opaque handle value, not a pointer to a handle.
	// https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session
	update := windows.NewLazySystemDLL("kernel32.dll").NewProc("UpdateProcThreadAttribute")
	if ok, _, callErr := update.Call(uintptr(unsafe.Pointer(attrs.List())), 0, windows.PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, uintptr(s.console), unsafe.Sizeof(s.console), 0, 0); ok == 0 {
		return fail(callErr)
	}
	startup := windows.StartupInfoEx{}
	startup.Cb = uint32(unsafe.Sizeof(startup))
	// Null standard handles let ConPTY supply its own streams even when the
	// host was launched from a console (including go test).
	startup.Flags = windows.STARTF_USESTDHANDLES
	startup.ProcThreadAttributeList = attrs.List()
	cmd, err := windows.UTF16PtrFromString(command)
	if err != nil {
		return fail(err)
	}
	dir, err := windows.UTF16PtrFromString(cwd)
	if err != nil {
		return fail(err)
	}
	s.job, err = windows.CreateJobObject(nil, nil)
	if err != nil {
		return fail(err)
	}
	limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	if _, err = windows.SetInformationJobObject(s.job, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&limits)), uint32(unsafe.Sizeof(limits))); err != nil {
		return fail(err)
	}
	var proc windows.ProcessInformation
	err = windows.CreateProcess(nil, cmd, nil, nil, false, windows.EXTENDED_STARTUPINFO_PRESENT|windows.CREATE_UNICODE_ENVIRONMENT|windows.CREATE_SUSPENDED, nil, dir, &startup.StartupInfo, &proc)
	if err != nil {
		return fail(err)
	}
	s.process = proc.Process
	defer windows.CloseHandle(proc.Thread)
	if err = windows.AssignProcessToJobObject(s.job, proc.Process); err != nil {
		windows.TerminateProcess(proc.Process, 1)
		windows.CloseHandle(proc.Process)
		return fail(err)
	}
	if _, err = windows.ResumeThread(proc.Thread); err != nil {
		windows.TerminateProcess(proc.Process, 1)
		windows.CloseHandle(proc.Process)
		return fail(err)
	}
	outputDone := make(chan struct{})
	go func() { defer close(outputDone); defer outputRead.Close(); _, _ = io.Copy(s, outputRead) }()
	go func() {
		windows.WaitForSingleObject(proc.Process, windows.INFINITE)
		windows.TerminateJobObject(s.job, 0)
		windows.ClosePseudoConsole(s.console)
		<-outputDone
		close(s.exited)
		s.mu.Lock()
		s.done = true
		s.mu.Unlock()
	}()
	return s, nil
}

func (s *Session) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Bound unread output when the WebView is suspended.
	if s.output.Len() > 2*1024*1024 {
		s.output.Reset()
	}
	return s.output.Write(p)
}
func (s *Session) Read() ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data := append([]byte(nil), s.output.Bytes()...)
	s.output.Reset()
	return data, s.done
}
func (s *Session) Input(data string) error { _, err := io.WriteString(s.input, data); return err }
func (s *Session) Resize(cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return os.ErrClosed
	}
	return windows.ResizePseudoConsole(s.console, windows.Coord{X: int16(cols), Y: int16(rows)})
}
func (s *Session) Close() {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.closed = true
	s.mu.Unlock()
	s.input.Close()
	windows.TerminateJobObject(s.job, 0)
	<-s.exited
	windows.CloseHandle(s.process)
	windows.CloseHandle(s.job)
}
