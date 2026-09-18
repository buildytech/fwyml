package main

import (
	"embed"
	"log"
	"os"

	"example.com/app/compose"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	if compose.Prepare != nil {
		executable, err := os.Executable()
		if err != nil {
			log.Fatal(err)
		}
		if err := compose.Prepare(executable); err != nil {
			log.Fatal(err)
		}
	}

	host := application.New(application.Options{
		Name:        compose.ProductName,
		Description: compose.ProductName,
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})
	compose.Bind(host)
	host.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  compose.ProductName,
		Width:  1440,
		Height: 900,
	})
	if err := host.Run(); err != nil {
		log.Fatal(err)
	}
}
