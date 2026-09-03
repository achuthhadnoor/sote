import { useState, useRef, useEffect } from "react";

export const TerminalPane: React.FC = () => {
  const [lines, setLines] = useState<string[]>([
    "snipnote terminal — local PTY coming soon",
    "vault: ~/snipnote-vault",
    'hint: type "help" for mock commands',
    "",
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    const next: string[] = [`$ ${cmd}`];
    if (cmd === "help") {
      next.push("mock commands: clear, ls, pwd, echo <text>");
    } else if (cmd === "clear") {
      setLines([]);
      setInput("");
      return;
    } else if (cmd === "ls") {
      next.push("Daily Notes/  Projects/  Website Redesign/  Tech Stack Decisions.md");
    } else if (cmd === "pwd") {
      next.push("~/snipnote-vault");
    } else if (cmd.startsWith("echo ")) {
      next.push(cmd.slice(5));
    } else {
      next.push(`(mock) ran: ${cmd} — wire to Tauri PTY in v4`);
    }
    setLines((prev) => [...prev, ...next]);
    setInput("");
  };

  return (
    <div className="pane-terminal">
      <div className="terminal-output" ref={scrollRef}>
        {lines.map((l, i) => (
          <div key={i} className="terminal-line">
            {l || "\u00A0"}
          </div>
        ))}
      </div>
      <form className="terminal-input-row" onSubmit={handleSubmit}>
        <span className="terminal-prompt">$</span>
        <input
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="type a command…"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
      <div className="terminal-hint">Local PTY not connected — mock only. Tauri shell plugin will replace this in v4.</div>
    </div>
  );
};
