import { useEffect, useRef, useState } from "react";
import { Theme, useThemeStore } from "../../stores/useThemeStore";
import { useSpellCheckStore } from "../../stores/useSpellCheckStore";
import { formatLogsAsText, getRecentLogs, getBackendLogPath, createLogger, isStreamLogs, setStreamLogs } from "../../lib/logger";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { modShortcut } from "../../utils/platform";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-0.5 text-[12px] font-medium text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-[10px] border border-border-translucent bg-[color-mix(in_srgb,var(--muted)_55%,transparent)]">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  title,
  description,
  control,
  children,
  last = false,
}: {
  title: string;
  description: string;
  control?: React.ReactNode;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn(!last && "border-b border-border-translucent")}>
      <div className="flex items-center justify-between gap-6 px-4 py-3.5">
        <div className="min-w-0 flex flex-col gap-0.5 pr-2">
          <span className="text-[13px] font-medium text-foreground leading-snug">{title}</span>
          <span className="text-[12px] text-muted-foreground leading-snug">{description}</span>
        </div>
        {control ? <div className="shrink-0 flex items-center justify-end">{control}</div> : null}
      </div>
      {children ? <div className="px-4 pb-3.5 -mt-1">{children}</div> : null}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg bg-background/60 p-0.5 border border-border-translucent"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors",
              active
                ? "bg-muted text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CompactSlider(props: React.ComponentProps<typeof Slider> & { valueLabel?: string }) {
  const { valueLabel, className, ...rest } = props;
  return (
    <div className="flex items-center gap-2.5 min-w-[160px] max-w-[200px]">
      <Slider {...rest} className={cn("w-[140px]", className)} />
      {valueLabel != null ? (
        <span className="w-9 text-right text-[12px] tabular-nums text-muted-foreground">{valueLabel}</span>
      ) : null}
    </div>
  );
}

export const SettingsView: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const bgOpacity = useThemeStore((s) => s.bgOpacity);
  const setBgOpacity = useThemeStore((s) => s.setBgOpacity);
  const tintHue = useThemeStore((s) => s.tintHue);
  const setTintHue = useThemeStore((s) => s.setTintHue);
  const tintAmount = useThemeStore((s) => s.tintAmount);
  const setTintAmount = useThemeStore((s) => s.setTintAmount);
  const spellCheckEnabled = useSpellCheckStore((s) => s.enabled);
  const setSpellCheckEnabled = useSpellCheckStore((s) => s.setEnabled);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<string | null>(null);
  const [streamToTerminal, setStreamToTerminal] = useState(isStreamLogs());
  const lastTranslucentOpacity = useRef(bgOpacity < 100 ? bgOpacity : 72);
  const log = createLogger("settings");

  const reduceTransparency = bgOpacity >= 100;
  const tintPercent = Math.round((tintAmount / 40) * 100);

  useEffect(() => {
    if (bgOpacity < 100) lastTranslucentOpacity.current = bgOpacity;
  }, [bgOpacity]);

  useEffect(() => {
    (async () => {
      try {
        const { isEnabled } = await import("@tauri-apps/plugin-autostart");
        setAutostartEnabled(await isEnabled());
      } catch {}
    })();
    (async () => {
      const p = await getBackendLogPath();
      if (p) setLogPath(p);
    })();
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateStatus("Checking…");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setUpdateStatus("Up to date");
        setTimeout(() => setUpdateStatus(null), 3000);
        return;
      }
      const install = window.confirm(
        `Update ${update.version} is available.\n\nDownload and install now? The app will restart when finished.`,
      );
      if (!install) {
        setUpdateStatus(`Update ${update.version} available`);
        setTimeout(() => setUpdateStatus(null), 5000);
        return;
      }
      setUpdateStatus(`Downloading ${update.version}…`);
      await update.downloadAndInstall();
      setUpdateStatus("Installed — restarting…");
      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch {
        setUpdateStatus("Installed — restart snipnote to finish");
      }
    } catch (e: any) {
      setUpdateStatus(`Check failed: ${e?.message || e}`);
      setTimeout(() => setUpdateStatus(null), 4000);
    } finally {
      setChecking(false);
    }
  };

  const toggleAutostart = async (checked?: boolean) => {
    try {
      const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
      const next = checked ?? !autostartEnabled;
      if (next) await enable();
      else await disable();
      setAutostartEnabled(await isEnabled());
    } catch {}
  };

  return (
    <section className="flex-1 overflow-y-auto flex justify-center py-10 px-8 sm:px-6 scroll-smooth">
      <div className="w-full max-w-[640px] m-auto flex flex-col gap-7 pb-16">
        <header className="flex flex-col gap-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-[13px] text-muted-foreground">
            Appearance and behavior. Press {modShortcut(",")} again to close.
          </p>
        </header>

        <SettingsSection title="Appearance">
          <SettingsRow
            title="Theme"
            description="Light, dark, or follow the system appearance"
            control={
              <SegmentedControl
                value={theme}
                options={THEME_OPTIONS}
                onChange={setTheme}
                ariaLabel="Theme"
              />
            }
          />
          <SettingsRow
            title="Hue"
            description="Choose a tint color"
            control={
              <div className="flex items-center gap-3">
                <CompactSlider
                  value={tintHue}
                  min={0}
                  max={360}
                  step={1}
                  onChange={setTintHue}
                  aria-label="Tint hue"
                />
                <span
                  className="w-5 h-5 rounded-full border border-border-translucent shrink-0 shadow-xs"
                  style={{ background: "var(--accent)" }}
                  title={`${tintHue}°`}
                  aria-label={`Accent preview ${tintHue} degrees`}
                />
              </div>
            }
          />
          <SettingsRow
            title="Intensity"
            description="Control how strongly the tint is applied"
            control={
              <CompactSlider
                value={tintAmount}
                min={0}
                max={40}
                step={1}
                onChange={setTintAmount}
                aria-label="Tint intensity"
                valueLabel={`${tintPercent}%`}
              />
            }
          />
          <SettingsRow
            title="Reduce Transparency"
            description="Replace translucent surfaces with opaque backgrounds"
            last
            control={
              <Switch
                checked={reduceTransparency}
                onCheckedChange={(checked) => {
                  if (checked) {
                    if (bgOpacity < 100) lastTranslucentOpacity.current = bgOpacity;
                    setBgOpacity(100);
                  } else {
                    setBgOpacity(lastTranslucentOpacity.current || 72);
                  }
                }}
                aria-label="Reduce transparency"
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="Writing">
          <SettingsRow
            title="Spellcheck"
            description="Underline misspellings using the system dictionary"
            last
            control={
              <Switch
                checked={spellCheckEnabled}
                onCheckedChange={setSpellCheckEnabled}
                aria-label="Spellcheck"
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="System">
          <SettingsRow
            title="Launch at Login"
            description="Open snipnote when you sign in to this Mac"
            control={
              <Switch
                checked={autostartEnabled}
                onCheckedChange={(checked) => void toggleAutostart(checked)}
                aria-label="Launch at login"
              />
            }
          />
          <SettingsRow
            title="Check for Updates"
            description={updateStatus || "Look for a newer version"}
            last
            control={
              <button
                type="button"
                onClick={() => void checkForUpdates()}
                disabled={checking}
                className="h-7 px-3 rounded-md border border-border-translucent bg-background/50 text-[12px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {checking ? "Checking…" : "Check"}
              </button>
            }
          />
        </SettingsSection>

        <SettingsSection title="Diagnostics">
          <SettingsRow
            title="Stream Logs to Terminal"
            description="Forward frontend logs to the log file and dev terminal"
            control={
              <Switch
                checked={streamToTerminal}
                onCheckedChange={(checked) => {
                  setStreamLogs(checked);
                  setStreamToTerminal(checked);
                }}
                aria-label="Stream logs to terminal"
              />
            }
          />
          <SettingsRow
            title="Log File"
            description={logPath || "Resolving log path…"}
            last
            control={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-7 px-3 rounded-md border border-border-translucent bg-background/50 text-[12px] font-medium text-foreground hover:bg-muted"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(formatLogsAsText(getRecentLogs(200)));
                      setLogStatus("Copied");
                    } catch (e) {
                      log.error("Copy logs failed", e);
                      setLogStatus("Copy failed");
                    }
                    setTimeout(() => setLogStatus(null), 2500);
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="h-7 px-3 rounded-md border border-border-translucent bg-background/50 text-[12px] font-medium text-foreground hover:bg-muted"
                  onClick={async () => {
                    try {
                      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
                      const p = logPath || (await getBackendLogPath());
                      if (p) await revealItemInDir(p);
                      else setLogStatus("Unavailable");
                    } catch (e) {
                      log.error("Reveal log file failed", e);
                      setLogStatus("Reveal failed");
                    }
                    setTimeout(() => setLogStatus(null), 2500);
                  }}
                >
                  Show
                </button>
                {logStatus ? (
                  <span className="text-[11px] text-muted-foreground">{logStatus}</span>
                ) : null}
              </div>
            }
          />
        </SettingsSection>

        <p className="px-0.5 text-[12px] text-muted-foreground leading-relaxed">
          snipnote · local-first markdown notes. Theme and tint preferences save automatically.
        </p>
      </div>
    </section>
  );
};
