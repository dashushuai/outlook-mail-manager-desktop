import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem('theme');
  return isTheme(stored) ? stored : null;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
}

function getDesktopShell() {
  return typeof window !== 'undefined' ? window.desktopShell : undefined;
}

const initialTheme = getStoredTheme() || 'dark';

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });

    const desktopShell = getDesktopShell();
    if (desktopShell?.updateSettings) {
      void desktopShell.updateSettings({ theme });
      return;
    }

    localStorage.setItem('theme', theme);
  },
}));

applyTheme(initialTheme);

const desktopShell = getDesktopShell();
if (desktopShell?.getSettings) {
  void desktopShell.getSettings().then((settings) => {
    if (!isTheme(settings.theme)) {
      return;
    }

    applyTheme(settings.theme);
    useThemeStore.setState({ theme: settings.theme });
  });
}
