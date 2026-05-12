type AccountListResponse = {
  code?: number;
  data?: {
    list?: Array<{ id: number }>;
  };
};

type FetchJsonResponse = {
  json(): Promise<unknown>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<FetchJsonResponse>;
type LogError = (message: string, error: unknown) => void;
type NotifyNewMail = (count: number) => void;
type IntervalCallback = () => void | Promise<void>;
type IntervalHandle = ReturnType<typeof setInterval>;
type SetIntervalLike = (callback: IntervalCallback, delay: number) => IntervalHandle;
type ClearIntervalLike = (handle: IntervalHandle) => void;

type CreateMailPollerOptions = {
  serverUrl: string;
  fetch: FetchLike;
  setInterval: SetIntervalLike;
  clearInterval: ClearIntervalLike;
  notifyNewMail: NotifyNewMail;
  logError: LogError;
};

type MailPoller = {
  start(intervalMinutes: number): Promise<void>;
  updateIntervalMinutes(intervalMinutes: number): void;
  stop(): void;
  pollNow(): Promise<void>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumericCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

export function extractNewMailCount(payload: unknown): number {
  if (!isPlainObject(payload)) {
    return 0;
  }

  if ('code' in payload && payload.code !== 200) {
    return 0;
  }

  const data = payload.data;

  if (data == null) {
    return 0;
  }

  if (Array.isArray(data)) {
    return data.length;
  }

  const directCount = readNumericCount(data);

  if (directCount !== null) {
    return directCount;
  }

  if (!isPlainObject(data)) {
    return 0;
  }

  for (const key of ['newMailCount', 'count', 'new_count', 'total']) {
    const count = readNumericCount(data[key]);

    if (count !== null) {
      return count;
    }
  }

  return 0;
}

function extractLatestMailKey(payload: unknown): string | null {
  if (!isPlainObject(payload) || ('code' in payload && payload.code !== 200) || !isPlainObject(payload.data)) {
    return null;
  }

  for (const key of ['id', 'mail_id', 'messageId', 'internetMessageId']) {
    const value = payload.data[key];

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  return null;
}

export function createMailPoller(options: CreateMailPollerOptions): MailPoller {
  let intervalHandle: IntervalHandle | null = null;
  let activePoll: Promise<void> | null = null;
  const latestMailKeysByAccount = new Map<number, string>();

  const schedule = (intervalMinutes: number) => {
    if (intervalHandle !== null) {
      options.clearInterval(intervalHandle);
    }

    intervalHandle = options.setInterval(() => pollNow(), intervalMinutes * 60_000);
  };

  const fetchNewMailForAccount = async (accountId: number): Promise<number> => {
    try {
      const response = await options.fetch(`${options.serverUrl}/api/mails/fetch-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      const payload = await response.json();
      const latestMailKey = extractLatestMailKey(payload);

      if (latestMailKey) {
        const previousMailKey = latestMailKeysByAccount.get(accountId);
        latestMailKeysByAccount.set(accountId, latestMailKey);
        return previousMailKey && previousMailKey !== latestMailKey ? 1 : 0;
      }

      return extractNewMailCount(payload);
    } catch (error) {
      options.logError(`Failed to fetch new mail for account ${accountId}`, error);
      return 0;
    }
  };

  const readAccounts = async (): Promise<Array<{ id: number }>> => {
    const response = await options.fetch(`${options.serverUrl}/api/accounts`);
    const payload = await response.json() as AccountListResponse;

    if (payload.code !== undefined && payload.code !== 200) {
      throw new Error('Unexpected account list response');
    }

    if (!payload.data || !Array.isArray(payload.data.list)) {
      throw new Error('Unexpected account list response');
    }

    return payload.data.list;
  };

  const runPoll = async (): Promise<void> => {
    try {
      const accounts = await readAccounts();
      let newMailCount = 0;

      for (const account of accounts) {
        newMailCount += await fetchNewMailForAccount(account.id);
      }

      if (newMailCount > 0) {
        options.notifyNewMail(newMailCount);
      }
    } catch (error) {
      options.logError('Failed to run background mail check', error);
    }
  };

  const pollNow = async (): Promise<void> => {
    if (activePoll) {
      return activePoll;
    }

    activePoll = runPoll().finally(() => {
      activePoll = null;
    });
    return activePoll;
  };

  return {
    async start(intervalMinutes: number) {
      schedule(intervalMinutes);
      await pollNow();
    },
    updateIntervalMinutes(intervalMinutes: number) {
      schedule(intervalMinutes);
    },
    stop() {
      if (intervalHandle !== null) {
        options.clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },
    pollNow,
  };
}
