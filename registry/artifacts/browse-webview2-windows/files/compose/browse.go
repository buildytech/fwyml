package compose

import (
	"example.com/app/internal/browse"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type BrowseService struct {
	hub *browse.Hub
}

func init() {
	Attach(func(app *application.App) {
		app.RegisterService(application.NewService(&BrowseService{hub: browse.New()}))
	})
}

func (service *BrowseService) Navigate(id, url string) error {
	return service.hub.Navigate(id, url)
}

func (service *BrowseService) Close(id string) {
	service.hub.Close(id)
}
