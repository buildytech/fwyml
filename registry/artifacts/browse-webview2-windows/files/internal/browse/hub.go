package browse

import "fmt"

// Hub is the extracted native-view lifecycle. The full WebView2 engine stays
// in the source product until this adapter is verified.
type Hub struct {
	sessions map[string]string
}

func New() *Hub {
	return &Hub{sessions: map[string]string{}}
}

func (hub *Hub) Navigate(id, url string) error {
	if hub == nil {
		return fmt.Errorf("browse hub closed")
	}
	if hub.sessions == nil {
		hub.sessions = map[string]string{}
	}
	hub.sessions[id] = url
	return nil
}

func (hub *Hub) Close(id string) {
	delete(hub.sessions, id)
}

func (hub *Hub) URL(id string) string {
	return hub.sessions[id]
}
