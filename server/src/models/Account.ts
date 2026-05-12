import { getDb, runInTransaction } from '../database';
import { Account, ImportRequest, ImportResult, PaginatedResponse } from '../types';
import { TagModel } from './Tag';

const tagModel = new TagModel();

export class AccountModel {
  async list(page = 1, pageSize = 20, search = ''): Promise<PaginatedResponse<Account>> {
    const offset = (page - 1) * pageSize;
    let where = '';
    const params: string[] = [];

    if (search) {
      where = 'WHERE email LIKE ?';
      params.push(`%${search}%`);
    }

    const totalRow = await getDb().get<{ c: number }>(`SELECT COUNT(*) as c FROM accounts ${where}`, ...params);
    const list = (await getDb().all<Account[]>(
      `SELECT * FROM accounts ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    )) as Account[];
    const listWithTags = await Promise.all(
      list.map(async (account) => ({
        ...account,
        tags: await tagModel.getTagsByAccountId(account.id),
      })),
    );

    return { list: listWithTags as Account[], total: totalRow?.c ?? 0, page, pageSize };
  }

  async getById(id: number): Promise<Account | undefined> {
    const account = (await getDb().get<Account>('SELECT * FROM accounts WHERE id = ?', id)) ?? undefined;
    if (!account) {
      return undefined;
    }

    return {
      ...account,
      tags: await tagModel.getTagsByAccountId(account.id),
    } as Account;
  }

  async create(data: Partial<Account>): Promise<Account> {
    const result = await getDb().run(
      'INSERT INTO accounts (email, password, client_id, refresh_token) VALUES (?, ?, ?, ?)',
      data.email,
      data.password || '',
      data.client_id,
      data.refresh_token,
    );
    return (await this.getById(result.lastID!))!;
  }

  async update(id: number, data: Partial<Account>): Promise<Account | undefined> {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    for (const [key, value] of Object.entries(data)) {
      if (['email', 'password', 'client_id', 'refresh_token', 'remark', 'status', 'token_refreshed_at'].includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value as string | number | null);
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await getDb().run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return this.getById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await getDb().run('DELETE FROM accounts WHERE id = ?', id);
    return (result.changes ?? 0) > 0;
  }

  async batchDelete(ids: number[]): Promise<number> {
    const placeholders = ids.map(() => '?').join(',');
    const result = await getDb().run(`DELETE FROM accounts WHERE id IN (${placeholders})`, ...ids);
    return result.changes ?? 0;
  }

  async importPreview(req: ImportRequest): Promise<{ newItems: any[]; duplicates: any[]; errors: string[] }> {
    const { content, separator = '----', format = ['email', 'password', 'client_id', 'refresh_token'] } = req;
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    const newItems: any[] = [];
    const duplicates: any[] = [];
    const errors: string[] = [];

    for (let index = 0; index < lines.length; index++) {
      const parts = lines[index].split(separator);
      const record: Record<string, string> = {};
      format.forEach((field, fieldIndex) => {
        record[field] = (parts[fieldIndex] || '').trim();
      });

      if (!record.email || !record.client_id || !record.refresh_token) {
        errors.push(`Line ${index + 1}: missing required fields`);
        continue;
      }

      const existing = await getDb().get<{ id: number }>('SELECT id FROM accounts WHERE email = ?', record.email);
      const item = { line: index + 1, ...record };
      if (existing) {
        duplicates.push(item);
      } else {
        newItems.push(item);
      }
    }

    return { newItems, duplicates, errors };
  }

  async importConfirm(req: ImportRequest & { mode: 'skip' | 'overwrite' }): Promise<ImportResult> {
    const { content, separator = '----', format = ['email', 'password', 'client_id', 'refresh_token'], mode } = req;
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    await runInTransaction(async (db) => {
      for (let index = 0; index < lines.length; index++) {
        const parts = lines[index].split(separator);
        const record: Record<string, string> = {};
        format.forEach((field, fieldIndex) => {
          record[field] = (parts[fieldIndex] || '').trim();
        });

        if (!record.email || !record.client_id || !record.refresh_token) {
          errors.push(`Line ${index + 1}: missing required fields`);
          continue;
        }

        const existing = await db.get<{ id: number }>('SELECT id FROM accounts WHERE email = ?', record.email);
        if (existing) {
          if (mode === 'overwrite') {
            await db.run(
              'UPDATE accounts SET password = ?, client_id = ?, refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
              record.password || '',
              record.client_id,
              record.refresh_token,
              record.email,
            );
            imported++;
          } else {
            skipped++;
          }
        } else {
          await db.run(
            'INSERT OR IGNORE INTO accounts (email, password, client_id, refresh_token) VALUES (?, ?, ?, ?)',
            record.email,
            record.password || '',
            record.client_id,
            record.refresh_token,
          );
          imported++;
        }
      }
    });

    return { imported, skipped, errors };
  }

  async import(req: ImportRequest): Promise<ImportResult> {
    const { content, separator = '----', format = ['email', 'password', 'client_id', 'refresh_token'] } = req;
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    await runInTransaction(async (db) => {
      for (let index = 0; index < lines.length; index++) {
        const parts = lines[index].split(separator);
        const record: Record<string, string> = {};
        format.forEach((field, fieldIndex) => {
          record[field] = (parts[fieldIndex] || '').trim();
        });

        if (!record.email || !record.client_id || !record.refresh_token) {
          errors.push(`Line ${index + 1}: missing required fields`);
          continue;
        }

        const result = await db.run(
          'INSERT OR IGNORE INTO accounts (email, password, client_id, refresh_token) VALUES (?, ?, ?, ?)',
          record.email,
          record.password || '',
          record.client_id,
          record.refresh_token,
        );

        if ((result.changes ?? 0) > 0) {
          imported++;
        } else {
          skipped++;
        }
      }
    });

    return { imported, skipped, errors };
  }

  async export(ids?: number[], separator = '----', format = ['email', 'password', 'client_id', 'refresh_token']): Promise<string> {
    let accounts: Account[];

    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      accounts = (await getDb().all<Account[]>(`SELECT * FROM accounts WHERE id IN (${placeholders})`, ...ids)) as Account[];
    } else {
      accounts = (await getDb().all<Account[]>('SELECT * FROM accounts')) as Account[];
    }

    return accounts
      .map((account) => format.map((field) => String((account as unknown as Record<string, unknown>)[field] ?? '')).join(separator))
      .join('\n');
  }

  async updateSyncTime(id: number): Promise<void> {
    await getDb().run('UPDATE accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?', id);
  }

  async updateTokenRefreshTime(id: number, newRefreshToken?: string): Promise<void> {
    if (newRefreshToken) {
      await getDb().run(
        'UPDATE accounts SET token_refreshed_at = CURRENT_TIMESTAMP, refresh_token = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        newRefreshToken,
        'active',
        id,
      );
      return;
    }

    await getDb().run(
      'UPDATE accounts SET token_refreshed_at = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      'active',
      id,
    );
  }

  async markError(id: number): Promise<void> {
    await getDb().run('UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 'error', id);
  }

  async getAll(): Promise<Account[]> {
    return (await getDb().all<Account[]>('SELECT * FROM accounts ORDER BY id DESC')) as Account[];
  }
}
