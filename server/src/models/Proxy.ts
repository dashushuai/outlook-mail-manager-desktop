import { getDb, runInTransaction } from '../database';
import { Proxy } from '../types';

function normalizeProxy(proxy: Proxy): Proxy {
  return {
    ...proxy,
    is_default: Boolean(proxy.is_default),
  };
}

export class ProxyModel {
  async list(): Promise<Proxy[]> {
    return ((await getDb().all<Proxy[]>('SELECT * FROM proxies ORDER BY id DESC')) as Proxy[]).map(normalizeProxy);
  }

  async getById(id: number): Promise<Proxy | undefined> {
    const proxy = (await getDb().get<Proxy>('SELECT * FROM proxies WHERE id = ?', id)) ?? undefined;
    return proxy ? normalizeProxy(proxy) : undefined;
  }

  async getDefault(): Promise<Proxy | undefined> {
    const proxy = (await getDb().get<Proxy>('SELECT * FROM proxies WHERE is_default = 1 LIMIT 1')) ?? undefined;
    return proxy ? normalizeProxy(proxy) : undefined;
  }

  async create(data: Partial<Proxy>): Promise<Proxy> {
    const result = await getDb().run(
      'INSERT INTO proxies (name, type, host, port, username, password, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
      data.name || '',
      data.type,
      data.host,
      data.port,
      data.username || '',
      data.password || '',
      data.is_default ? 1 : 0,
    );
    return (await this.getById(result.lastID!))!;
  }

  async update(id: number, data: Partial<Proxy>): Promise<Proxy | undefined> {
    const fields: string[] = [];
    const values: Array<string | number> = [];

    for (const [key, value] of Object.entries(data)) {
      if (['name', 'type', 'host', 'port', 'username', 'password', 'is_default'].includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'is_default' ? (value ? 1 : 0) : (value as string | number));
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    await getDb().run(`UPDATE proxies SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return this.getById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await getDb().run('DELETE FROM proxies WHERE id = ?', id);
    return (result.changes ?? 0) > 0;
  }

  async setDefault(id: number): Promise<Proxy | undefined> {
    return runInTransaction(async (db) => {
      const target = (await db.get<Proxy>('SELECT * FROM proxies WHERE id = ?', id)) ?? undefined;
      if (!target) {
        return undefined;
      }

      await db.run('UPDATE proxies SET is_default = 0 WHERE is_default = 1');
      await db.run('UPDATE proxies SET is_default = 1 WHERE id = ?', id);

      return {
        ...target,
        is_default: true,
      };
    });
  }

  async updateTestResult(id: number, ip: string, status: 'active' | 'failed'): Promise<void> {
    await getDb().run(
      'UPDATE proxies SET last_tested_at = CURRENT_TIMESTAMP, last_test_ip = ?, status = ? WHERE id = ?',
      ip,
      status,
      id,
    );
  }
}
