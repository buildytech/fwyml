import { createSignal } from "solid-js";

export function Browse() {
  const [url, setUrl] = createSignal("https://example.com");
  const [loaded, setLoaded] = createSignal("https://example.com");

  const go = () => {
    const next = url().trim() || "https://example.com";
    setUrl(next);
    setLoaded(next);
  };

  return (
    <div class="browse" data-surface="browser">
      <div class="browse-header">Browse</div>
      <div class="browse-urlbar">
        <input
          type="url"
          value={url()}
          aria-label="Browse URL"
          placeholder="https://"
          onInput={(event) => setUrl(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              go();
            }
          }}
        />
        <button type="button" onClick={go}>
          Go
        </button>
      </div>
      <div class="browse-stage" role="region" aria-label="Browse preview">
        <div>
          <strong>Browse chrome ready</strong>
          Native WebView2 / host browse binds on Windows delivery.
          <br />
          Current URL: {loaded()}
        </div>
      </div>
    </div>
  );
}
