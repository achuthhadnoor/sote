import { useState, useRef, useEffect } from "react";

export const TerminalPane: React.FC = () => {
  const [lines, setLines] = useState<string[]>([
    "snipnote terminal — local PTY coming soon",
    "folder: ~/Documents/notes",
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
      next.push("~/Documents/notes");
    } else if (cmd.startsWith("echo ")) {
      next.push(cmd.slice(5));
    } else {
      next.push(`(mock) ran: ${cmd} — wire to Tauri PTY in v4`);
    }
    setLines((prev) => [...prev, ...next]);
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col bg-sidebar-translucent p-3 font-mono text-xs overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-1 select-text" ref={scrollRef}>
        {lines.map((l, i) => (
          <div key={i} className="leading-relaxed text-foreground opacity-90 break-words">
            {l || "\u00A0"}
          </div>
        ))}
      </div>
      <form className="mt-2 flex items-center gap-2 border-t border-border-translucent pt-2" onSubmit={handleSubmit}>
        <span className="text-muted-foreground font-semibold select-none">$</span>
        <input
          className="flex-1 bg-transparent border-0 outline-none text-foreground text-xs font-mono placeholder:text-muted-foreground focus:ring-0"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="type a command…"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
      <div className="mt-1.5 text-[10px] text-muted-foreground opacity-70">
        Local PTY not connected — mock only. Tauri shell plugin will replace this in v4.
      </div>
    </div>
  );
};
