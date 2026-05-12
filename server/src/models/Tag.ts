import { getDb, runInTransaction } from '../database';
import { Tag } from '../types';

export class TagModel {
  async list(): Promise<Tag[]> {
    return (await getDb().all<Tag[]>('SELECT * FROM tags ORDER BY name')) as Tag[];
  }

  async getById(id: number): Promise<Tag | undefined> {
    return (await getDb().get<Tag>('SELECT * FROM tags WHERE id = ?', id)) ?? undefined;
  }

  async create(name: string, color = '#3B82F6'): Promise<Tag> {
    const result = await getDb().run('INSERT INTO tags (name, color) VALUES (?, ?)', name, color);
    return (await this.getById(result.lastID!))!;
  }

  async update(id: number, data: { name?: string; color?: string }): Promise<Tag | undefined> {
    const fields: string[] = [];
    const values: Array<string | number> = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.color !== undefined) {
      fields.push('color = ?');
      values.push(data.color);
    }
    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    await getDb().run(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return this.getById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await getDb().run('DELETE FROM tags WHERE id = ?', id);
    return (result.changes ?? 0) > 0;
  }

  async getTagsByAccountId(accountId: number): Promise<Tag[]> {
    return (await getDb().all<Tag[]>(`
      SELECT t.* FROM tags t
      JOIN account_tags at ON t.id = at.tag_id
      WHERE at.account_id = ?
      ORDER BY t.name
    `, accountId)) as Tag[];
  }

  async setAccountTags(accountId: number, tagIds: number[]): Promise<void> {
    await runInTransaction(async (db) => {
      await db.run('DELETE FROM account_tags WHERE account_id = ?', accountId);
      for (const tagId of tagIds) {
        await db.run('INSERT OR IGNORE INTO account_tags (account_id, tag_id) VALUES (?, ?)', accountId, tagId);
      }
    });
  }
}
