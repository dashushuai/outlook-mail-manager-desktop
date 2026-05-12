import { getDb, runInTransaction } from '../database';
import { MailMessage } from '../types';

function normalizeMailMessage(mail: MailMessage): MailMessage {
  return {
    ...mail,
    is_read: Boolean(mail.is_read),
  };
}

export class MailCacheModel {
  async getByAccount(accountId: number, mailbox: string, page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const totalRow = await getDb().get<{ c: number }>(
      'SELECT COUNT(*) as c FROM mail_cache WHERE account_id = ? AND mailbox = ?',
      accountId,
      mailbox,
    );
    const list = ((await getDb().all<MailMessage[]>(
      'SELECT * FROM mail_cache WHERE account_id = ? AND mailbox = ? ORDER BY mail_date DESC LIMIT ? OFFSET ?',
      accountId,
      mailbox,
      pageSize,
      offset,
    )) as MailMessage[]).map(normalizeMailMessage);

    return { list, total: totalRow?.c ?? 0, page, pageSize };
  }

  async upsert(accountId: number, mailbox: string, mails: Partial<MailMessage>[]): Promise<void> {
    await runInTransaction(async (db) => {
      for (const mail of mails) {
        await db.run(
          `
            INSERT INTO mail_cache (account_id, mailbox, mail_id, sender, sender_name, subject, text_content, html_content, mail_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account_id, mailbox, mail_id) WHERE mail_id <> '' DO UPDATE SET
              sender = excluded.sender,
              sender_name = excluded.sender_name,
              subject = excluded.subject,
              text_content = excluded.text_content,
              html_content = excluded.html_content,
              mail_date = excluded.mail_date,
              cached_at = CURRENT_TIMESTAMP
          `,
          accountId,
          mailbox,
          mail.mail_id || '',
          mail.sender || '',
          mail.sender_name || '',
          mail.subject || '',
          mail.text_content || '',
          mail.html_content || '',
          mail.mail_date || null,
        );
      }
    });
  }

  async clearByAccount(accountId: number, mailbox: string): Promise<void> {
    await getDb().run('DELETE FROM mail_cache WHERE account_id = ? AND mailbox = ?', accountId, mailbox);
  }

  async getRecent(limit = 5): Promise<MailMessage[]> {
    return ((await getDb().all<MailMessage[]>(
      'SELECT mc.*, a.email as account_email FROM mail_cache mc JOIN accounts a ON mc.account_id = a.id ORDER BY mc.mail_date DESC LIMIT ?',
      limit,
    )) as MailMessage[]).map(normalizeMailMessage);
  }

  async countByAccount(accountId: number, mailbox: string): Promise<number> {
    const row = await getDb().get<{ c: number }>(
      'SELECT COUNT(*) as c FROM mail_cache WHERE account_id = ? AND mailbox = ?',
      accountId,
      mailbox,
    );
    return row?.c ?? 0;
  }

  async countAll(mailbox: string): Promise<number> {
    const row = await getDb().get<{ c: number }>('SELECT COUNT(*) as c FROM mail_cache WHERE mailbox = ?', mailbox);
    return row?.c ?? 0;
  }
}
