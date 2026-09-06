import { useEffect, useState } from "react";
import { Theme, useThemeStore } from "../../stores/useThemeStore";
import { useSpellCheckStore } from "../../stores/useSpellCheckStore";
import { formatLogsAsText, getRecentLogs, getBackendLogPath, createLogger, isStreamLogs, setStreamLogs } from "../../lib/logger";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const bgOpacity = useThemeStore((s) => s.bgOpacity);
  const setBgOpacity = useThemeStore((s) => s.setBgOpacity);
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);
  const setSpellCheckEnabled = useSpellCheckStore((s) => s.setEnabled);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<string | null>(null);
  const [streamToTerminal, setStreamToTerminal] = useState(isStreamLogs());
  const log = createLogger("settings");

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // Load autostart state
    (async () => {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        const enabled = await isEnabled();
        setAutostartEnabled(enabled);
      } catch {}
    })();
    // Resolve backend log file location for debugging
    (async () => {
      const p = await getBackendLogPath();
      if (p) setLogPath(p);
    })();
  }, [isOpen]);

  const Option = ({ value, label, desc }: { value: Theme; label: string; desc: string }) => {
    const active = theme === value;
    return (
      <button
        className={cn(
          "flex items-center justify-between gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all duration-150",
          active
            ? "border-accent bg-accent-subtle shadow-xs"
            : "border-border bg-background hover:border-foreground/30 hover:bg-muted"
        )}
        onClick={() => setTheme(value)}
        aria-pressed={active}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground">{label}</span>
          <span className="text-[11px] text-muted-foreground leading-normal">{desc}</span>
        </div>
        <span
          className={cn(
            "w-[18px] h-[18px] rounded-full border-[1.5px] bg-background inline-flex items-center justify-center shrink-0",
            active ? "border-accent bg-accent" : "border-border"
          )}
          aria-hidden="true"
        >
          {active && <span className="w-[7px] h-[7px] rounded-full bg-background block" />}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-[560px] p-0 gap-0 bg-background sm:rounded-xl shadow-2xl border flex max-h-[80vh] flex-col overflow-hidden"
        style={{ display: "flex" } as React.CSSProperties}
        aria-describedby={undefined}
      >
        <DialogHeader className="p-5 pb-3.5 border-b border-border text-left space-y-0">
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">Settings</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">Manage appearance and behavior. Press Esc to close.</DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-background">
          <section className="flex flex-col gap-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 1V3M12 21V23M4.2 4.2L5.6 5.6M18.4 18.4L19.8 19.8M1 12H3M21 12H23M4.2 19.8L5.6 18.4M18.4 5.6L19.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Appearance
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Choose how snipnote looks. <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded border border-border">System</code> follows your OS light/dark setting and keeps the vibrant Sidebar/Mica in sync.
            </p>

            <div className="flex flex-col gap-2 mt-1">
              <Option value="light" label="Light" desc="Monochrome white, translucent over Sidebar/Mica" />
              <Option value="dark" label="Dark" desc="Near-black with muted grays, keeps contrast" />
              <Option value="system" label="System" desc="Follow macOS / Windows appearance automatically" />
            </div>

            <div className="mt-4 pt-4 border-t border-border-translucent">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[13px] font-medium text-foreground">Background Opacity</span>
                  <p className="text-[12px] text-muted-foreground">
                    Adjust the window translucency and vibrancy effect
                  </p>
                </div>
                <span className="text-[12px] font-mono font-medium text-muted-foreground px-2 py-0.5 rounded bg-muted-translucent">
                  {bgOpacity}%
                </span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] text-muted-foreground shrink-0">Translucent</span>
                <Slider
                  value={bgOpacity}
                  min={10}
                  max={100}
                  step={1}
                  onChange={setBgOpacity}
                  aria-label="Background Opacity"
                  className="flex-1"
                />
                <span className="text-[11px] text-muted-foreground shrink-0">Opaque</span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground leading-relaxed p-2.5 bg-muted-translucent border border-border-translucent rounded-md">
              Shortcut: <kbd className="font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded shadow-2xs text-foreground">⌘,</kbd> or <kbd className="font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded shadow-2xs text-foreground">Ctrl ,</kbd> to open settings. Theme and opacity persist automatically.
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7V17M20 7V17M8 7V17M12 7V17M16 7V17M4 12H20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
              </svg>
              Writing
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Editor spellcheck uses your OS dictionary. Toggle persists in <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded border border-border">snipnote-spellcheck</code>.
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background cursor-pointer hover:border-foreground/30 hover:bg-muted transition-all"
                role="button"
                tabIndex={0}
                onClick={() => setSpellCheckEnabled(!spellCheckEnabled)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSpellCheckEnabled(!spellCheckEnabled); }}}
                aria-pressed={spellCheckEnabled}
                aria-label="Spellcheck toggle"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground">Spellcheck</span>
                  <span className="text-[11px] text-muted-foreground leading-normal">Underline misspellings and show suggestions on right-click</span>
                </div>
                <Switch checked={spellCheckEnabled} onCheckedChange={setSpellCheckEnabled} onClick={(e) => e.stopPropagation()} aria-hidden="true" />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3V13M12 3L7 8M12 3L17 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16V19A2 2 0 0 0 6 21H18A2 2 0 0 0 20 19V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Updates & System
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Keep snipnote fresh and launch at login. Checks are manual for v1.
            </p>
            <div className="flex flex-col gap-2 mt-1">
              <button
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background text-left cursor-pointer hover:border-foreground/30 hover:bg-muted transition-all"
                onClick={async () => {
                  setChecking(true);
                  setUpdateStatus("Checking…");
                  try {
                    const { check } = await import("@tauri-apps/plugin-updater");
                    const update = await check();
                    if (!update) {
                      setUpdateStatus("Up to date ✓");
                      setTimeout(() => setUpdateStatus(null), 3000);
                    } else {
                      setUpdateStatus(`Update available ${update.version} — restart to update`);
                    }
                  } catch (e: any) {
                    setUpdateStatus(`Check failed: ${e?.message || e}`);
                    setTimeout(() => setUpdateStatus(null), 3000);
                  } finally {
                    setChecking(false);
                  }
                }}
                disabled={checking}
                aria-label="Check for updates"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground">Check for Updates</span>
                  <span className="text-[11px] text-muted-foreground leading-normal">{updateStatus || "Manual check via updater plugin"}</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">
                  {checking ? "Checking…" : "Check"}
                </span>
              </button>
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background cursor-pointer hover:border-foreground/30 hover:bg-muted transition-all"
                role="button"
                tabIndex={0}
                onClick={async () => {
                  try {
                    const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
                    if (autostartEnabled) {
                      await disable();
                    } else {
                      await enable();
                    }
                    const enabled = await isEnabled();
                    setAutostartEnabled(enabled);
                  } catch {}
                  try { (navigator as any).vibrate?.(10); } catch {}
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    try {
                      const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
                      if (autostartEnabled) await disable(); else await enable();
                      setAutostartEnabled(await isEnabled());
                    } catch {}
                  }
                }}
                aria-pressed={autostartEnabled}
                aria-label="Launch at login toggle"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-foreground">Launch at Login</span>
                  <span className="text-[11px] text-muted-foreground leading-normal">Open snipnote when you log in (LaunchAgent)</span>
                </div>
                <Switch
                  checked={autostartEnabled}
                  onCheckedChange={async (checked) => {
                    try {
                      const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
                      if (checked) await enable(); else await disable();
                      setAutostartEnabled(await isEnabled());
                    } catch {}
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-hidden="true"
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Diagnostics</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Debug logs live at <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded border border-border">{logPath || "…loading"}</code>
              {import.meta.env.DEV ? " (debug level in dev)" : " (info level in production)"}.
              Frontend warnings/errors are always appended to the same file.
            </p>
            <div
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background cursor-pointer hover:border-foreground/30 hover:bg-muted transition-all"
              role="button"
              tabIndex={0}
              onClick={() => {
                const next = !streamToTerminal;
                setStreamLogs(next);
                setStreamToTerminal(next);
                log.info(next ? "Log streaming to terminal enabled" : "Log streaming to terminal disabled");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const next = !streamToTerminal;
                  setStreamLogs(next);
                  setStreamToTerminal(next);
                }
              }}
              aria-pressed={streamToTerminal}
              aria-label="Stream logs to terminal toggle"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-foreground">Stream logs to terminal</span>
                <span className="text-[11px] text-muted-foreground leading-normal">Forward all frontend logs to the log file and dev terminal (on by default in dev)</span>
              </div>
              <Switch checked={streamToTerminal} onCheckedChange={(checked) => { setStreamLogs(checked); setStreamToTerminal(checked); }} onClick={(e) => e.stopPropagation()} aria-hidden="true" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(formatLogsAsText(getRecentLogs(200)));
                    setLogStatus("Copied recent logs ✓");
                  } catch (e) {
                    log.error("Copy logs failed", e);
                    setLogStatus("Copy failed");
                  }
                  setTimeout(() => setLogStatus(null), 2500);
                }}
              >
                Copy recent logs
              </Button>
              <Button
                variant="outline"
                className="text-xs"
                onClick={async () => {
                  try {
                    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
                    const p = logPath || (await getBackendLogPath());
                    if (p) await revealItemInDir(p);
                    else setLogStatus("Log path unavailable");
                  } catch (e) {
                    log.error("Reveal log file failed", e);
                    setLogStatus("Reveal failed");
                  }
                }}
              >
                Show log file
              </Button>
              {logStatus && <span className="text-[11px] text-muted-foreground self-center">{logStatus}</span>}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">About</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              snipnote · local-first markdown companion for Claude Code. Vibrant window via <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded border border-border">EffectsBuilder</code> (Sidebar on macOS, Mica on Windows).
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted p-3 px-5">
          <span className="text-[11px] text-muted-foreground">Press ⌘, again to close</span>
          <Button onClick={onClose} className="min-w-[72px]">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
