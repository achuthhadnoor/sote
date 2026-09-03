import { useEffect, useState } from "react";
import { Theme, useThemeStore } from "../../stores/useThemeStore";
import { useSpellCheckStore } from "../../stores/useSpellCheckStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);
  const setSpellCheckEnabled = useSpellCheckStore((s) => s.setEnabled);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);

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
  }, [isOpen]);

  if (!isOpen) return null;

  const Option = ({ value, label, desc }: { value: Theme; label: string; desc: string }) => {
    const active = theme === value;
    return (
      <button
        className={`settings-option ${active ? "is-active" : ""}`}
        onClick={() => setTheme(value)}
        aria-pressed={active}
      >
        <div className="settings-option-main">
          <span className="settings-option-label">{label}</span>
          <span className="settings-option-desc">{desc}</span>
        </div>
        <span className={`settings-radio ${active ? "is-checked" : ""}`} aria-hidden="true">
          {active && <span className="settings-radio-dot" />}
        </span>
      </button>
    );
  };

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="settings-header">
          <div>
            <h2 className="settings-title">Settings</h2>
            <p className="settings-subtitle">Manage appearance and behavior. Press Esc to close.</p>
          </div>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 1V3M12 21V23M4.2 4.2L5.6 5.6M18.4 18.4L19.8 19.8M1 12H3M21 12H23M4.2 19.8L5.6 18.4M18.4 5.6L19.8 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Appearance
            </h3>
            <p className="settings-section-desc">
              Choose how snipnote looks. <code>System</code> follows your OS light/dark setting and keeps the vibrant Sidebar/Mica in sync.
            </p>

            <div className="settings-options">
              <Option value="light" label="Light" desc="Monochrome white, translucent over Sidebar/Mica" />
              <Option value="dark" label="Dark" desc="Near-black with muted grays, keeps contrast" />
              <Option value="system" label="System" desc="Follow macOS / Windows appearance automatically" />
            </div>

            <div className="settings-hint">
              Shortcut: <kbd className="settings-kbd">⌘,</kbd> or <kbd className="settings-kbd">Ctrl ,</kbd> to open settings. Theme persists in localStorage <code>snipnote-theme</code>.
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7V17M20 7V17M8 7V17M12 7V17M16 7V17M4 12H20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
              </svg>
              Writing
            </h3>
            <p className="settings-section-desc">
              Editor spellcheck uses your OS dictionary. Toggle persists in <code>snipnote-spellcheck</code>.
            </p>
            <div className="settings-options">
              <button
                className="settings-option"
                onClick={() => setSpellCheckEnabled(!spellCheckEnabled)}
                aria-pressed={spellCheckEnabled}
                aria-label="Spellcheck toggle"
              >
                <div className="settings-option-main">
                  <span className="settings-option-label">Spellcheck</span>
                  <span className="settings-option-desc">Underline misspellings and show suggestions on right-click</span>
                </div>
                <span className={`settings-toggle ${spellCheckEnabled ? "is-on" : ""}`} aria-hidden="true">
                  <span className="settings-toggle-knob" />
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3V13M12 3L7 8M12 3L17 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16V19A2 2 0 0 0 6 21H18A2 2 0 0 0 20 19V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Updates & System
            </h3>
            <p className="settings-section-desc">
              Keep snipnote fresh and launch at login. Checks are manual for v1.
            </p>
            <div className="settings-options">
              <button
                className="settings-option"
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
                <div className="settings-option-main">
                  <span className="settings-option-label">Check for Updates</span>
                  <span className="settings-option-desc">{updateStatus || "Manual check via updater plugin"}</span>
                </div>
                <span className="settings-option-hint" aria-hidden="true">
                  {checking ? "Checking…" : "Check"}
                </span>
              </button>
              <button
                className="settings-option"
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
                aria-pressed={autostartEnabled}
                aria-label="Launch at login toggle"
              >
                <div className="settings-option-main">
                  <span className="settings-option-label">Launch at Login</span>
                  <span className="settings-option-desc">Open snipnote when you log in (LaunchAgent)</span>
                </div>
                <span className={`settings-toggle ${autostartEnabled ? "is-on" : ""}`} aria-hidden="true">
                  <span className="settings-toggle-knob" />
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">About</h3>
            <p className="settings-section-desc">
              snipnote · local-first markdown companion for Claude Code. Vibrant window via <code>EffectsBuilder</code> (Sidebar on macOS, Mica on Windows).
            </p>
          </section>
        </div>

        <div className="settings-footer">
          <span className="settings-footer-hint">Press ⌘, again to close</span>
          <button className="btn-primary settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
