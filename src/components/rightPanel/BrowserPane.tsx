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
    <div className="flex-1 flex flex-col overflow-hidden bg-sidebar-translucent">
      <div className="flex items-center gap-2 p-2 border-b border-border-translucent">
        <div className="flex items-center">
          <button
            className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-muted-foreground hover:bg-muted-translucent hover:text-foreground transition-colors cursor-pointer"
            onClick={handleRefresh}
            title="Reload"
            aria-label="Reload"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 12A8 8 0 1 1 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M20 4V8H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <form className="flex-1 flex items-center gap-1.5 bg-muted-translucent border border-border-translucent rounded-[var(--radius-sm)] px-2 py-1" onSubmit={handleGo}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted-foreground shrink-0">
            <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground focus:ring-0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://…"
            spellCheck={false}
          />
          <button
            type="submit"
            className="text-[11px] px-2 py-0.5 rounded-[var(--radius-sm)] bg-accent text-accent-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            disabled={isLoading}
          >
            Go
          </button>
        </form>
      </div>
      <div className="flex-1 relative overflow-hidden bg-background">
        {url ? (
          <iframe
            key={url}
            src={url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            title="In-app browser"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Loading…</div>
        )}
        {isLoading && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-[11px] text-muted-foreground shadow-sm">
            Loading…
          </div>
        )}
      </div>
      <div className="p-2 border-t border-border-translucent text-[10px] text-muted-foreground opacity-75">
        In-app browser · Some sites block iframes via `X-Frame-Options`. For full browser, Tauri `opener` plugin will open externally.
      </div>
    </div>
  );
};
