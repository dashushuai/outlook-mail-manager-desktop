import { AccountModel } from '../models/Account';
import { MailCacheModel } from '../models/MailCache';
import { ProxyModel } from '../models/Proxy';
import { DashboardStats } from '../types';

const accountModel = new AccountModel();
const cacheModel = new MailCacheModel();
const proxyModel = new ProxyModel();

export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const accounts = await accountModel.getAll();
    const proxies = await proxyModel.list();
    const recentMails = await cacheModel.getRecent(5);

    const accountStats = await Promise.all(
      accounts.map(async (account) => ({
        account_id: account.id,
        email: account.email,
        inbox_count: await cacheModel.countByAccount(account.id, 'INBOX'),
        junk_count: await cacheModel.countByAccount(account.id, 'Junk'),
      })),
    );

    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((account) => account.status === 'active').length,
      totalInboxMails: await cacheModel.countAll('INBOX'),
      totalJunkMails: await cacheModel.countAll('Junk'),
      totalProxies: proxies.length,
      activeProxies: proxies.filter((proxy) => proxy.status === 'active').length,
      recentMails,
      accountStats,
      expiringTokens: accounts.filter((account) => {
        if (!account.token_refreshed_at) {
          return false;
        }
        return now - new Date(account.token_refreshed_at).getTime() > sixtyDaysMs;
      }).length,
      errorAccounts: accounts.filter((account) => account.status === 'error').length,
      unusedAccounts: accounts.filter((account) => !account.token_refreshed_at).length,
    };
  }
}
