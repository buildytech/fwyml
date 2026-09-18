import { Chat } from "./surfaces/Chat.solid";
import { Browse } from "./surfaces/Browse.solid";

export function App() {
  return (
    <div class="shell" data-ui-runtime="solid" data-product="assistant-solid-browser">
      <header class="bar" role="banner">
        <h1>Assistant</h1>
        <span class="muted">Solid · chat + browse</span>
      </header>
      <main id="main-content" class="columns" role="main">
        <section class="pane" aria-label="Chat">
          <Chat />
        </section>
        <section class="pane" aria-label="Browse">
          <Browse />
        </section>
      </main>
    </div>
  );
}
