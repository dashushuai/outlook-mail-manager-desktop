const DESKTOP_SERVER_URL_ARG_PREFIX = '--desktop-server-url=';

export function resolveDesktopServerUrl(argv: readonly string[] = process.argv): string | null {
  for (const arg of argv) {
    const normalizedArg = arg.trim();

    if (!normalizedArg.startsWith(DESKTOP_SERVER_URL_ARG_PREFIX)) {
      continue;
    }

    const url = normalizedArg.slice(DESKTOP_SERVER_URL_ARG_PREFIX.length).trim().replace(/\/+$/, '');
    return url || null;
  }

  return null;
}
