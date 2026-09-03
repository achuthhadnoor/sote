import { useEffect } from "react";
import { Theme, useThemeStore } from "../../stores/useThemeStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

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
