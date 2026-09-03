import { useState } from "react";

export const BrowserPane: React.FC = () => {
  const [url, setUrl] = useState("https://example.com");
  const [input, setInput] = useState("https://example.com");
  const [isLoading, setIsLoading] = useState(false);

  const handleGo = (e?: React.FormEvent) => {
    e?.preventDefault();
    let next = input.trim();
    if (!next) return;
    if (!/^https?:\/\//i.test(next)) next = "https://" + next;
    setIsLoading(true);
    setUrl(next);
    // iframe will fire onLoad to clear
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // force reload via key change: append cache buster then strip? simplest re-set
    const cur = url;
    setUrl("");
    requestAnimationFrame(() => setUrl(cur));
  };

  return (
    <div className="pane-browser">
      <div className="browser-toolbar">
        <div className="browser-nav-btns">
          <button className="browser-nav-btn" onClick={handleRefresh} title="Reload" aria-label="Reload">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 12A8 8 0 1 1 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M20 4V8H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <form className="browser-url-form" onSubmit={handleGo}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="browser-url-icon">
            <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="browser-url-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://…"
            spellCheck={false}
          />
          <button type="submit" className="browser-go-btn" disabled={isLoading}>
            Go
          </button>
        </form>
      </div>
      <div className="browser-viewport">
        {url ? (
          <iframe
            key={url}
            src={url}
            className="browser-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            title="In-app browser"
          />
        ) : (
          <div className="browser-placeholder">Loading…</div>
        )}
        {isLoading && <div className="browser-loading">Loading…</div>}
      </div>
      <div className="browser-hint">
        In-app browser · Some sites block iframes via `X-Frame-Options`. For full browser, Tauri `opener` plugin will open externally.
      </div>
    </div>
  );
};
