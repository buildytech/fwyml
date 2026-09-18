package compose

import (
	"path/filepath"
	"runtime"

	"example.com/app/internal/workspace"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// HostService exposes application lifecycle, native dialogs, and menu IPC over Wails.
type HostService struct {
	app *application.App
}

func init() {
	Attach(func(app *application.App) {
		service := &HostService{app: app}
		app.RegisterService(application.NewService(service))
		service.installMenus()
	})
}

func (service *HostService) Runtime() string {
	return "host@0"
}

func (service *HostService) emit(name string, data ...any) {
	if service.app == nil {
		return
	}
	service.app.Event.Emit(name, data...)
}

func (service *HostService) PickFolder() (string, error) {
	if service.app == nil {
		return "", errString("host is not ready")
	}
	return service.app.Dialog.OpenFile().
		SetTitle("Open folder").
		CanChooseDirectories(true).
		CanChooseFiles(false).
		PromptForSingleSelection()
}

func (service *HostService) PickFile() (string, error) {
	if service.app == nil {
		return "", errString("host is not ready")
	}
	return service.app.Dialog.OpenFile().
		SetTitle("Open file").
		CanChooseDirectories(false).
		CanChooseFiles(true).
		PromptForSingleSelection()
}

func (service *HostService) PickSave(name, directory string) (string, error) {
	if service.app == nil {
		return "", errString("host is not ready")
	}
	dialog := service.app.Dialog.SaveFile().
		SetMessage("Save file").
		SetFilename(name).
		CanCreateDirectories(true)
	if directory != "" {
		dialog.SetDirectory(directory)
	}
	return dialog.PromptForSingleSelection()
}

// SaveFileAs opens a native Save dialog and writes text under the attached workspace.
func (service *HostService) SaveFileAs(text, suggested string) (workspace.FileBody, error) {
	root, err := AttachedRoot()
	if err != nil {
		return workspace.FileBody{}, err
	}
	name := filepath.Base(filepath.FromSlash(suggested))
	if name == "" || name == "." || name == string(filepath.Separator) {
		name = "untitled.txt"
	}
	path, err := service.PickSave(name, root.Abs)
	if err != nil || path == "" {
		return workspace.FileBody{}, err
	}
	rel, err := workspace.RelUnder(root.Abs, path)
	if err != nil {
		return workspace.FileBody{}, errString("save-as: choose a path inside the open workspace")
	}
	return workspace.WriteText(root.Abs, rel, text)
}

// OpenPickedFile opens a native Open File dialog and reads the selection when it is under the workspace.
func (service *HostService) OpenPickedFile() (workspace.FileBody, error) {
	root, err := AttachedRoot()
	if err != nil {
		return workspace.FileBody{}, err
	}
	path, err := service.PickFile()
	if err != nil || path == "" {
		return workspace.FileBody{}, err
	}
	rel, err := workspace.RelUnder(root.Abs, path)
	if err != nil {
		return workspace.FileBody{}, errString("open-file: choose a path inside the open workspace")
	}
	return workspace.ReadText(root.Abs, rel)
}

func (service *HostService) Exit() {
	if service.app != nil {
		service.app.Quit()
	}
}

// InstallMenus wires native File/View commands that emit ide:* events for listenHost.
func (service *HostService) installMenus() {
	if service.app == nil {
		return
	}
	menu := service.app.NewMenu()
	if runtime.GOOS == "darwin" {
		menu.AddRole(application.AppMenu)
	}
	file := menu.AddSubmenu("File")
	file.Add("New File").SetAccelerator("Ctrl+N").OnClick(func(*application.Context) {
		service.emit("ide:command", "new")
	})
	file.Add("Open File").SetAccelerator("Ctrl+O").OnClick(func(*application.Context) {
		service.emit("ide:command", "open-file")
	})
	file.Add("Open Folder").SetAccelerator("Ctrl+Shift+O").OnClick(func(*application.Context) {
		service.emit("ide:command", "open-folder")
	})
	file.AddSeparator()
	file.Add("Save").SetAccelerator("Ctrl+S").OnClick(func(*application.Context) {
		service.emit("ide:save")
	})
	file.Add("Save All").OnClick(func(*application.Context) {
		service.emit("ide:command", "save-all")
	})
	file.Add("Close Editor").SetAccelerator("Ctrl+W").OnClick(func(*application.Context) {
		service.emit("ide:command", "close")
	})
	file.Add("Save As").SetAccelerator("Ctrl+Shift+S").OnClick(func(*application.Context) {
		service.emit("ide:save-as")
	})
	file.AddSeparator()
	file.Add("Settings").SetAccelerator("Ctrl+,").OnClick(func(*application.Context) {
		service.emit("ide:settings")
	})
	if runtime.GOOS != "darwin" {
		file.AddSeparator()
		file.Add("Exit").SetAccelerator("Ctrl+Q").OnClick(func(*application.Context) {
			service.emit("ide:command", "exit")
		})
	}
	menu.AddRole(application.EditMenu)
	view := menu.AddSubmenu("View")
	view.Add("Command Palette").SetAccelerator("Ctrl+Shift+P").OnClick(func(*application.Context) {
		service.emit("ide:command", "palette")
	})
	view.Add("Find File").SetAccelerator("Ctrl+P").OnClick(func(*application.Context) {
		service.emit("ide:command", "quick-open")
	})
	view.Add("Toggle Explorer").SetAccelerator("Ctrl+B").OnClick(func(*application.Context) {
		service.emit("ide:command", "explorer")
	})
	view.Add("Toggle Terminal").SetAccelerator("Ctrl+`").OnClick(func(*application.Context) {
		service.emit("ide:command", "terminal")
	})
	view.Add("Problems").SetAccelerator("Ctrl+Shift+M").OnClick(func(*application.Context) {
		service.emit("ide:command", "problems")
	})
	view.AddSeparator()
	view.AddCheckbox("Hide Header", false).OnClick(func(ctx *application.Context) {
		service.emit("ide:view-header", map[string]any{"hidden": ctx.IsChecked()})
	})
	view.AddSeparator()
	view.AddRadio("Default", true).OnClick(func(*application.Context) {
		service.emit("ide:view-palette", map[string]any{"palette": "default"})
	})
	view.AddRadio("HinddY", false).OnClick(func(*application.Context) {
		service.emit("ide:view-palette", map[string]any{"palette": "hinddy"})
	})
	service.app.Menu.Set(menu)
}

