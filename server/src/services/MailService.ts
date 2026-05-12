import { AccountModel } from '../models/Account';
import { MailCacheModel } from '../models/MailCache';
import { FetchMailsResult } from '../types';
import logger from '../utils/logger';
import { GraphApiService } from './GraphApiService';
import { ImapService } from './ImapService';
import { OAuthService } from './OAuthService';

const accountModel = new AccountModel();
const cacheModel = new MailCacheModel();
const oauthService = new OAuthService();
const graphService = new GraphApiService();
const imapService = new ImapService();

export class MailService {
  async fetchMails(accountId: number, mailbox: string, proxyId?: number, top = 50): Promise<FetchMailsResult> {
    const account = await accountModel.getById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    try {
      const token = await oauthService.refreshGraphToken(account.client_id, account.refresh_token, proxyId);
      await accountModel.updateTokenRefreshTime(accountId, token.refresh_token);

      if (token.has_mail_scope) {
        const mails = await graphService.fetchMails(token.access_token, mailbox, top, proxyId);
        await cacheModel.upsert(accountId, mailbox, mails);
        await accountModel.updateSyncTime(accountId);
        return { mails: mails as any, total: mails.length, protocol: 'graph', cached: false };
      }
      logger.warn(`Graph API no Mail.Read scope for ${account.email}, falling back to IMAP`);
    } catch (err: any) {
      logger.warn(`Graph API failed for ${account.email}: ${err.message}, falling back to IMAP`);
    }

    try {
      const freshAccount = await accountModel.getById(accountId);
      const refreshToken = freshAccount?.refresh_token || account.refresh_token;

      const token = await oauthService.refreshImapToken(account.client_id, refreshToken, proxyId);
      await accountModel.updateTokenRefreshTime(accountId, token.refresh_token);

      const authString = imapService.generateAuthString(account.email, token.access_token);
      const mails = await imapService.fetchMails(account.email, authString, mailbox, top);
      await cacheModel.upsert(accountId, mailbox, mails);
      await accountModel.updateSyncTime(accountId);
      return { mails: mails as any, total: mails.length, protocol: 'imap', cached: false };
    } catch (err: any) {
      logger.error(`IMAP also failed for ${account.email}: ${err.message}`);

      await accountModel.markError(accountId);

      const cached = await cacheModel.getByAccount(accountId, mailbox, 1, top);
      if (cached.list.length > 0) {
        return { mails: cached.list, total: cached.total, protocol: 'graph', cached: true };
      }
      throw new Error(`Both Graph API and IMAP failed: ${err.message}`);
    }
  }

  async clearMailbox(accountId: number, mailbox: string, proxyId?: number): Promise<void> {
    const account = await accountModel.getById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    try {
      const token = await oauthService.refreshGraphToken(account.client_id, account.refresh_token, proxyId);
      await accountModel.updateTokenRefreshTime(accountId, token.refresh_token);

      if (token.has_mail_scope) {
        await graphService.deleteAllMails(token.access_token, mailbox, proxyId);
        return;
      }
    } catch (err: any) {
      logger.warn(`Graph delete failed for ${account.email}: ${err.message}, trying IMAP`);
    }

    const freshAccount = await accountModel.getById(accountId);
    const refreshToken = freshAccount?.refresh_token || account.refresh_token;

    const token = await oauthService.refreshImapToken(account.client_id, refreshToken, proxyId);
    await accountModel.updateTokenRefreshTime(accountId, token.refresh_token);

    const authString = imapService.generateAuthString(account.email, token.access_token);
    await imapService.clearMailbox(account.email, authString, mailbox);
  }
}
