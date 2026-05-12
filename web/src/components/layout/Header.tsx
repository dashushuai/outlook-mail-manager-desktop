import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor, Menu, Settings2 } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import {
  finalizeAutomaticCheckIntervalInput,
  isDesktopShellAvailable,
  parseAutomaticCheckIntervalInput,
  useDesktopSettingsStore,
} from '../../stores/desktopSettings';
import { useDesktopUpdaterStore } from '../../stores/desktopUpdater';

interface Props {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: Props) {
  const { theme, setTheme } = useThemeStore();
  const { settings, loadSettings, updateSettings } = useDesktopSettingsStore();
  const {
    status: updateStatus,
    loadStatus,
    checkForUpdates,
    installUpdate,
    subscribeToUpdates,
  } = useDesktopUpdaterStore();
  const desktopAvailable = typeof window !== 'undefined' && isDesktopShellAvailable(window);
  const [intervalDraft, setIntervalDraft] = useState(String(settings.automaticCheckIntervalMinutes));

  useEffect(() => {
    if (!desktopAvailable) {
      return;
    }

    void loadSettings().then((loadedSettings) => {
      setIntervalDraft(String(loadedSettings.automaticCheckIntervalMinutes));
    });
    void loadStatus();
    return subscribeToUpdates();
  }, [desktopAvailable, loadSettings, loadStatus, subscribeToUpdates]);

  useEffect(() => {
    if (!desktopAvailable) {
      return;
    }

    setIntervalDraft(String(settings.automaticCheckIntervalMinutes));
  }, [desktopAvailable, settings.automaticCheckIntervalMinutes]);

  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <button onClick={onMenuClick} className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-secondary transition-colors">
        <Menu className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex items-center gap-2 ml-auto">
        {desktopAvailable ? (
          <details className="relative">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border hover:bg-secondary transition-colors"
              title="桌面设置"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="absolute right-0 top-11 z-20 w-64 rounded-md border border-border bg-card p-4 shadow-lg">
              <div className="mb-3">
                <p className="text-sm font-medium text-foreground">桌面设置</p>
                <p className="text-xs text-muted-foreground">控制开机自启动、托盘行为和自动检查频率。</p>
              </div>
              <label className="mb-3 flex items-center justify-between gap-3 text-sm text-foreground">
                <span>开机自启动</span>
                <input
                  type="checkbox"
                  checked={settings.openAtLogin}
                  onChange={(event) => {
                    void updateSettings({ openAtLogin: event.target.checked });
                  }}
                  className="h-4 w-4 rounded border-border"
                />
              </label>
              <label className="mb-3 flex items-center justify-between gap-3 text-sm text-foreground">
                <span>最小化到托盘</span>
                <input
                  type="checkbox"
                  checked={settings.minimizeToTray}
                  onChange={(event) => {
                    void updateSettings({ minimizeToTray: event.target.checked });
                  }}
                  className="h-4 w-4 rounded border-border"
                />
              </label>
              <label className="mb-4 flex items-center justify-between gap-3 text-sm text-foreground">
                <span>自动检查间隔</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={intervalDraft}
                  onChange={(event) => {
                    const nextDraft = event.target.value;
                    setIntervalDraft(nextDraft);

                    const parsed = parseAutomaticCheckIntervalInput(nextDraft);
                    if (parsed !== null) {
                      void updateSettings({ automaticCheckIntervalMinutes: parsed });
                    }
                  }}
                  onBlur={() => {
                    setIntervalDraft(
                      finalizeAutomaticCheckIntervalInput(intervalDraft, settings.automaticCheckIntervalMinutes),
                    );
                  }}
                  className="h-9 w-20 rounded-md border border-border bg-background px-2 text-right text-sm text-foreground"
                />
              </label>
              <div className="border-t border-border pt-3 text-sm text-foreground">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span>自动更新</span>
                  <button
                    type="button"
                    disabled={updateStatus.checking}
                    onClick={() => {
                      void checkForUpdates();
                    }}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updateStatus.checking ? '检查中' : '检查更新'}
                  </button>
                </div>
                {updateStatus.version ? (
                  <p className="mb-1 text-xs text-muted-foreground">发现新版本 {updateStatus.version}</p>
                ) : null}
                {updateStatus.progress !== null ? (
                  <p className="mb-1 text-xs text-muted-foreground">下载进度 {updateStatus.progress}%</p>
                ) : null}
                {updateStatus.error ? (
                  <p className="mb-1 text-xs text-destructive">更新失败：{updateStatus.error}</p>
                ) : null}
                {updateStatus.downloaded ? (
                  <button
                    type="button"
                    onClick={() => {
                      void installUpdate();
                    }}
                    className="mt-2 w-full rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                  >
                    重启安装
                  </button>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}
        <button
          onClick={cycleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-secondary transition-colors"
          title={`当前: ${theme === 'dark' ? '暗色' : theme === 'light' ? '亮色' : '跟随系统'}`}
        >
          <ThemeIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
