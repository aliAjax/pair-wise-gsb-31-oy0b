import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { message } from '@/utils/message';

export const useExchangeStore = defineStore('exchanges', {
  state: () => ({
    exchanges: [] as Exchange[],
    statusFilter: 'all' as ExchangeStatus | 'all',
    loading: false,
  }),
  getters: {
    sent: (state) => (userId: string) => state.exchanges.filter((item) => item.from_user_id === userId),
    received: (state) => (userId: string) => state.exchanges.filter((item) => item.to_user_id === userId),
    filtered: (state) => {
      if (state.statusFilter === 'all') return state.exchanges;
      return state.exchanges.filter((item) => item.status === state.statusFilter);
    },
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
      } finally {
        this.loading = false;
      }
    },
    async create(draft: ExchangeDraft) {
      const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
      this.exchanges = await exchangeApi.list();
      message('交换请求已发出', 'success');
      return exchange;
    },
    async accept(id: string) {
      try {
        await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      } catch (error) {
        message(error instanceof Error ? error.message : '同意失败', 'error');
        return;
      }
      this.exchanges = await exchangeApi.list();
      message('已同意交换，两件物品进入交换中', 'success');
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      this.exchanges = await exchangeApi.list();
      message('已拒绝交换', 'success');
    },
    async withdraw(id: string, userId: string) {
      const target = this.exchanges.find((item) => item.id === id);
      if (!target || (target.from_user_id !== userId && target.to_user_id !== userId)) {
        message('只有交换双方可以撤回', 'error');
        return;
      }
      try {
        await exchangeApi.transition(id, ExchangeStatus.WITHDRAWN);
      } catch (error) {
        message(error instanceof Error ? error.message : '撤回失败', 'error');
        return;
      }
      this.exchanges = await exchangeApi.list();
      message('交换已撤回，两件物品恢复可交换', 'success');
    },
    async confirmComplete(id: string, userId: string) {
      let updated: Exchange;
      try {
        updated = await exchangeApi.confirmCompletion(id, userId);
      } catch (error) {
        message(error instanceof Error ? error.message : '确认失败', 'error');
        return;
      }
      this.exchanges = await exchangeApi.list();
      if (updated.status === ExchangeStatus.COMPLETED) {
        message('双方已确认，交换完成，两件物品已标记为已交换', 'success');
      } else {
        message('已确认完成，等待对方确认', 'success');
      }
    },
  },
});
