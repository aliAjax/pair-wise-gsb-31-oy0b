import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { useAuthStore } from '@/stores/authStore';
import { useItemStore } from '@/stores/itemStore';
import { message } from '@/utils/message';

const runAction = async (task: () => Promise<void>, errorText: string) => {
  try {
    await task();
  } catch (error) {
    message(error instanceof Error ? error.message : errorText, 'error');
  }
};

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
      try {
        const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
        this.exchanges = await exchangeApi.list();
        message('交换请求已发出', 'success');
        return exchange;
      } catch (error) {
        message(error instanceof Error ? error.message : '交换请求发送失败', 'error');
        return null;
      }
    },
    async accept(id: string) {
      const authStore = useAuthStore();
      if (!authStore.currentUser) return;
      await runAction(async () => {
        await exchangeApi.accept(id, authStore.currentUser!.id);
        this.exchanges = await exchangeApi.list();
        const itemStore = useItemStore();
        await itemStore.hydrate();
        message('已同意交换，两件物品进入交换中', 'success');
      }, '同意交换失败');
    },
    async reject(id: string) {
      await runAction(async () => {
        await exchangeApi.transition(id, ExchangeStatus.REJECTED);
        this.exchanges = await exchangeApi.list();
        message('已拒绝交换', 'success');
      }, '拒绝交换失败');
    },
    async withdraw(id: string) {
      const authStore = useAuthStore();
      if (!authStore.currentUser) return;
      await runAction(async () => {
        await exchangeApi.withdraw(id, authStore.currentUser!.id);
        this.exchanges = await exchangeApi.list();
        const itemStore = useItemStore();
        await itemStore.hydrate();
        message('已撤回交换，两件物品恢复可交换', 'success');
      }, '撤回交换失败');
    },
    async confirmComplete(id: string) {
      const authStore = useAuthStore();
      if (!authStore.currentUser) return;
      await runAction(async () => {
        const exchange = await exchangeApi.confirmComplete(id, authStore.currentUser!.id);
        this.exchanges = await exchangeApi.list();
        const itemStore = useItemStore();
        await itemStore.hydrate();
        if (exchange.status === ExchangeStatus.COMPLETED) {
          message('双方已确认，交换完成', 'success');
        } else {
          message('已确认完成，等待对方确认', 'success');
        }
      }, '确认完成失败');
    },
  },
});
