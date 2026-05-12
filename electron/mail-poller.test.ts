import assert from 'node:assert/strict';
import test from 'node:test';

test('extractNewMailCount supports current and count-based response shapes', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.extractNewMailCount, 'function');

  if (typeof mailPollerModule.extractNewMailCount !== 'function') {
    return;
  }

  assert.equal(mailPollerModule.extractNewMailCount({ code: 200, data: null }), 0);
  assert.equal(mailPollerModule.extractNewMailCount({ code: 200, data: { id: 'mail-1' } }), 0);
  assert.equal(mailPollerModule.extractNewMailCount({ code: 200, data: [{ id: 'mail-1' }, { id: 'mail-2' }] }), 2);
  assert.equal(mailPollerModule.extractNewMailCount({ code: 200, data: { newMailCount: 3 } }), 3);
  assert.equal(mailPollerModule.extractNewMailCount({ code: 200, data: { count: 4 } }), 4);
  assert.equal(mailPollerModule.extractNewMailCount({ code: 500, data: { id: 'mail-1' } }), 0);
});

test('createMailPoller schedules polling from minutes and runs checks immediately and on interval', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  const intervalCallbacks: Array<() => void> = [];
  const intervalDelays: number[] = [];
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });

    if (url.endsWith('/api/accounts')) {
      return {
        json: async () => ({ data: { list: [{ id: 7 }] } }),
      };
    }

    return {
      json: async () => ({ code: 200, data: null }),
    };
  };

  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: fetchImpl,
    setInterval: (callback: () => void, delay: number) => {
      intervalCallbacks.push(callback);
      intervalDelays.push(delay);
      return Symbol('interval');
    },
    clearInterval: () => {},
    notifyNewMail: () => {
      throw new Error('notifyNewMail should not run when no mail is returned');
    },
    logError: () => {
      throw new Error('logError should not run for successful checks');
    },
  });

  await poller.start(5);

  assert.deepEqual(intervalDelays, [300_000]);
  assert.equal(fetchCalls.length, 2);

  await intervalCallbacks[0]?.();

  assert.equal(fetchCalls.length, 4);
});

test('createMailPoller reschedules polling without leaving duplicate timers behind', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  const intervalHandles = [Symbol('first'), Symbol('second')];
  const scheduled: Array<{ callback: () => void; delay: number; handle: symbol }> = [];
  const cleared: symbol[] = [];
  let nextHandleIndex = 0;

  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: async () => ({
      json: async () => ({ data: { list: [] } }),
    }),
    setInterval: (callback: () => void, delay: number) => {
      const handle = intervalHandles[nextHandleIndex++] ?? Symbol('extra');
      scheduled.push({ callback, delay, handle });
      return handle;
    },
    clearInterval: (handle: symbol) => {
      cleared.push(handle);
    },
    notifyNewMail: () => {},
    logError: () => {},
  });

  await poller.start(5);
  poller.updateIntervalMinutes(9);

  assert.deepEqual(cleared, [intervalHandles[0]]);
  assert.deepEqual(scheduled.map((entry) => entry.delay), [300_000, 540_000]);
});

test('pollNow fetches all accounts, requests new mail, and reports total new mail count', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const notifications: number[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });

    if (url.endsWith('/api/accounts')) {
      return {
        json: async () => ({ data: { list: [{ id: 11 }, { id: 12 }] } }),
      };
    }

    const request = init as RequestInit | undefined;
    const body = request?.body ? JSON.parse(String(request.body)) as { account_id: number } : { account_id: -1 };

    return {
      json: async () => (body.account_id === 11
        ? { code: 200, data: { newMailCount: 1 } }
        : { code: 200, data: { newMailCount: 2 } }),
    };
  };

  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: fetchImpl,
    setInterval: () => Symbol('interval'),
    clearInterval: () => {},
    notifyNewMail: (count: number) => {
      notifications.push(count);
    },
    logError: () => {
      throw new Error('logError should not run for successful checks');
    },
  });

  await poller.pollNow();

  assert.equal(fetchCalls[0]?.url, 'http://127.0.0.1:3000/api/accounts');
  assert.deepEqual(fetchCalls.slice(1).map(({ url, init }) => ({
    url,
    body: init?.body ? JSON.parse(String(init.body)) : null,
    method: init?.method,
    headers: init?.headers,
  })), [
    {
      url: 'http://127.0.0.1:3000/api/mails/fetch-new',
      body: { account_id: 11 },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      url: 'http://127.0.0.1:3000/api/mails/fetch-new',
      body: { account_id: 12 },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
  ]);
  assert.deepEqual(notifications, [3]);
});

test('pollNow logs per-account failures and still notifies for other successful checks', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  const errors: string[] = [];
  const notifications: number[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/accounts')) {
      return {
        json: async () => ({ data: { list: [{ id: 21 }, { id: 22 }] } }),
      };
    }

    const body = init?.body ? JSON.parse(String(init.body)) as { account_id: number } : { account_id: -1 };

    if (body.account_id === 21) {
      throw new Error('account offline');
    }

    return {
      json: async () => ({ code: 200, data: { newMailCount: 1 } }),
    };
  };

  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: fetchImpl,
    setInterval: () => Symbol('interval'),
    clearInterval: () => {},
    notifyNewMail: (count: number) => {
      notifications.push(count);
    },
    logError: (message: string, error: unknown) => {
      errors.push(`${message}:${error instanceof Error ? error.message : String(error)}`);
    },
  });

  await assert.doesNotReject(async () => {
    await poller.pollNow();
  });

  assert.deepEqual(notifications, [1]);
  assert.deepEqual(errors, ['Failed to fetch new mail for account 21:account offline']);
});

test('pollNow records latest mail baseline and does not repeat notifications for the same latest mail', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  const notifications: number[] = [];
  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: async (url: string) => ({
      json: async () => (url.endsWith('/api/accounts')
        ? { data: { list: [{ id: 31 }] } }
        : { code: 200, data: { id: 'latest-mail' } }),
    }),
    setInterval: () => Symbol('interval'),
    clearInterval: () => {},
    notifyNewMail: (count: number) => {
      notifications.push(count);
    },
    logError: () => {
      throw new Error('logError should not run for successful checks');
    },
  });

  await poller.pollNow();
  await poller.pollNow();

  assert.deepEqual(notifications, []);
});

test('pollNow skips overlapping runs to avoid duplicate scans and notifications', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  let releaseAccounts!: () => void;
  const accountsReady = new Promise<void>((resolve) => {
    releaseAccounts = resolve;
  });
  const fetchCalls: string[] = [];
  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: async (url: string) => {
      fetchCalls.push(url);

      if (url.endsWith('/api/accounts')) {
        await accountsReady;
        return {
          json: async () => ({ data: { list: [] } }),
        };
      }

      return {
        json: async () => ({ code: 200, data: null }),
      };
    },
    setInterval: () => Symbol('interval'),
    clearInterval: () => {},
    notifyNewMail: () => {
      throw new Error('notifyNewMail should not run with no accounts');
    },
    logError: () => {
      throw new Error('logError should not run for successful checks');
    },
  });

  const firstPoll = poller.pollNow();
  const secondPoll = poller.pollNow();
  releaseAccounts();

  await Promise.all([firstPoll, secondPoll]);

  assert.deepEqual(fetchCalls, ['http://127.0.0.1:3000/api/accounts']);
});

test('pollNow logs malformed account list responses instead of silently treating them as empty', async () => {
  const mailPollerModule = await import('./mail-poller');

  assert.equal(typeof mailPollerModule.createMailPoller, 'function');

  if (typeof mailPollerModule.createMailPoller !== 'function') {
    return;
  }

  const errors: string[] = [];
  const poller = mailPollerModule.createMailPoller({
    serverUrl: 'http://127.0.0.1:3000',
    fetch: async () => ({
      json: async () => ({ code: 500, message: 'failed' }),
    }),
    setInterval: () => Symbol('interval'),
    clearInterval: () => {},
    notifyNewMail: () => {
      throw new Error('notifyNewMail should not run when account list fails');
    },
    logError: (message: string, error: unknown) => {
      errors.push(`${message}:${error instanceof Error ? error.message : String(error)}`);
    },
  });

  await poller.pollNow();

  assert.deepEqual(errors, ['Failed to run background mail check:Unexpected account list response']);
});
