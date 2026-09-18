// Package vcs adapts the Git command-line client to structured workspace operations.
package vcs

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"example.com/app/packages/go/process"
)

var ErrNoWorkspace = errors.New("no-workspace: no workspace folder")

type GitFile struct {
	Path     string `json:"path"`
	Orig     string `json:"orig"`
	Index    string `json:"index"`
	Worktree string `json:"worktree"`
	Kind     string `json:"kind"`
}
type GitSnapshot struct {
	Branch   string    `json:"branch"`
	Upstream string    `json:"upstream"`
	Ahead    int       `json:"ahead"`
	Behind   int       `json:"behind"`
	Files    []GitFile `json:"files"`
}

func Run(root string, args ...string) (string, error) {
	if root == "" {
		return "", ErrNoWorkspace
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "GCM_INTERACTIVE=never")
	process.Hide(cmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", classifyGit(fmt.Errorf("git: %s: %w", strings.TrimSpace(string(output)), err))
	}
	return string(output), nil
}

// Status returns branch, tracking, and file state for one workspace root.
func Status(root string) (GitSnapshot, error) {
	raw, err := Run(root, "status", "--porcelain=v1", "-z", "--untracked-files=normal")
	if err != nil {
		return GitSnapshot{}, err
	}
	branch, err := Run(root, "symbolic-ref", "--short", "-q", "HEAD")
	if err != nil {
		branch, _ = Run(root, "rev-parse", "--short", "HEAD")
	}
	result := GitSnapshot{Branch: strings.TrimSpace(branch), Files: parsePorcelain(raw)}
	result.Upstream, result.Ahead, result.Behind = gitTracking(root)
	return result, nil
}

func gitTracking(root string) (string, int, int) {
	up, err := Run(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
	if err != nil {
		return "", 0, 0
	}
	upstream := strings.TrimSpace(up)
	counts, err := Run(root, "rev-list", "--left-right", "--count", "HEAD...@{upstream}")
	if err != nil {
		return upstream, 0, 0
	}
	ahead, behind := parseAheadBehind(counts)
	return upstream, ahead, behind
}

func parseAheadBehind(raw string) (int, int) {
	parts := strings.Fields(strings.TrimSpace(raw))
	if len(parts) < 2 {
		return 0, 0
	}
	var ahead, behind int
	fmt.Sscanf(parts[0], "%d", &ahead)
	fmt.Sscanf(parts[1], "%d", &behind)
	return ahead, behind
}

func parsePorcelain(raw string) []GitFile {
	var files []GitFile
	rows := strings.Split(raw, "\x00")
	for i := 0; i < len(rows); i++ {
		row := rows[i]
		if len(row) < 4 {
			continue
		}
		file := GitFile{Path: row[3:], Index: row[:1], Worktree: row[1:2], Kind: gitKind(row[:2])}
		if strings.ContainsAny(row[:2], "RC") && i+1 < len(rows) {
			file.Orig = rows[i+1]
			if file.Kind == "" {
				file.Kind = "renamed"
			}
			i++
		}
		files = append(files, file)
	}
	return files
}

func gitKind(xy string) string {
	if strings.Contains(xy, "U") || xy == "AA" || xy == "DD" {
		return "conflict"
	}
	if strings.ContainsAny(xy, "D") {
		return "deleted"
	}
	if strings.ContainsAny(xy, "R") {
		return "renamed"
	}
	if strings.Contains(xy, "?") {
		return "untracked"
	}
	if strings.ContainsAny(xy, "A") {
		return "added"
	}
	if strings.ContainsAny(xy, "M") {
		return "modified"
	}
	return "changed"
}

func classifyGit(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	low := strings.ToLower(msg)
	if strings.Contains(low, "not a git repository") {
		return fmt.Errorf("no-repo: this folder is not a Git repository")
	}
	if strings.Contains(low, "author identity unknown") || strings.Contains(low, "please tell me who you are") {
		return fmt.Errorf("identity: Git needs user.name and user.email in this environment")
	}
	if strings.Contains(low, "could not read username") || strings.Contains(low, "authentication failed") || strings.Contains(low, "terminal prompts disabled") {
		return fmt.Errorf("auth: Git needs credentials. Sign in with the OS credential helper, then push again.")
	}
	return err
}

// Stage adds a changed path after checking it against the current status.
func Stage(root, path string) error {
	// Only paths returned by status are accepted; never interpret pathspec magic.
	status, err := Status(root)
	if err != nil {
		return err
	}
	for _, file := range status.Files {
		if file.Path == path {
			_, err = Run(root, "--literal-pathspecs", "add", "--", path)
			return err
		}
	}
	return fmt.Errorf("file is no longer in the change list")
}

// Commit creates one commit with a non-empty message.
func Commit(root, message string) (string, error) {
	if strings.TrimSpace(message) == "" {
		return "", fmt.Errorf("commit message is required")
	}
	return Run(root, "commit", "-m", message)
}

// Unstage resets a changed path after checking it against the current status.
func Unstage(root, path string) error {
	status, err := Status(root)
	if err != nil {
		return err
	}
	for _, file := range status.Files {
		if file.Path == path {
			_, err = Run(root, "--literal-pathspecs", "reset", "--", path)
			return err
		}
	}
	return fmt.Errorf("file is no longer in the change list")
}

func Push(root string) (string, error) { return Run(root, "push") }

func Fetch(root string) (string, error) { return Run(root, "fetch") }

func Pull(root string) (string, error) { return Run(root, "pull", "--ff-only") }

func Diff(root, path string, staged bool) (string, error) {
	if staged {
		return Run(root, "--literal-pathspecs", "diff", "--cached", "--", path)
	}
	return Run(root, "--literal-pathspecs", "diff", "--", path)
}
