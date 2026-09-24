import { EXCHANGE_ACTION_FLOW, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import type { Exchange, ExchangeDraft } from '@/models/exchange';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    to_item_id: 'item_camera',
    status: ExchangeStatus.SETTLED_ELSEWHERE,
    message: '露营椅换拍立得，可以同城当面交换。',
    confirmed_by: [],
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'exchange_seed_accepted',
    from_user_id: 'user_chen',
    to_user_id: 'user_me',
    from_item_id: 'item_books',
    to_item_id: 'item_chair',
    status: ExchangeStatus.ACCEPTED,
    message: '用整套设计书换你的露营椅，周末可以面交。',
    confirmed_by: ['user_chen'],
    created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
];

const withDefaults = (exchange: Exchange): Exchange => ({
  ...exchange,
  confirmed_by: exchange.confirmed_by ?? [],
});

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges.map(withDefaults);
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const offeredItem = await itemApi.detail(draft.from_item_id);
    if (!offeredItem || offeredItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('你拿出的物品当前不可交换');
    }
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      confirmed_by: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const now = new Date().toISOString();
    const lockedItemIds = [current.from_item_id, current.to_item_id];
    let nextExchanges = exchanges.map((item) => (item.id === id ? { ...item, status, updated_at: now } : item));

    if (status === ExchangeStatus.ACCEPTED) {
      const lockedItems = await Promise.all(lockedItemIds.map((itemId) => itemApi.detail(itemId)));
      if (lockedItems.some((item) => item?.status !== ItemStatus.AVAILABLE)) {
        throw new Error('两件物品都还处于可交换状态时才能同意');
      }
      for (const itemId of lockedItemIds) {
        await itemApi.setStatus(itemId, ItemStatus.EXCHANGING);
      }
      // 其他还在等这两件物品的请求，一律收到“交换已另行达成”，不能继续抢
      nextExchanges = nextExchanges.map((item) => {
        const isWaitingRival =
          item.id !== id &&
          item.status === ExchangeStatus.PENDING &&
          (lockedItemIds.includes(item.from_item_id) || lockedItemIds.includes(item.to_item_id));
        return isWaitingRival ? { ...item, status: ExchangeStatus.SETTLED_ELSEWHERE, updated_at: now } : item;
      });
    }

    if (status === ExchangeStatus.WITHDRAWN) {
      // 撤回只把仍处于交换中的两件物品放回可交换，先前被另行达成的请求不跟着复活
      const lockedItems = await Promise.all(lockedItemIds.map((itemId) => itemApi.detail(itemId)));
      for (const item of lockedItems) {
        if (item?.status === ItemStatus.EXCHANGING) {
          await itemApi.setStatus(item.id, ItemStatus.AVAILABLE);
        }
      }
    }

    if (status === ExchangeStatus.COMPLETED) {
      await itemApi.setStatus(current.from_item_id, ItemStatus.EXCHANGED);
      await itemApi.setStatus(current.to_item_id, ItemStatus.EXCHANGED);
    }

    await storage.set(STORAGE_KEYS.exchanges, nextExchanges);
    const next = nextExchanges.find((item) => item.id === id);
    if (!next) throw new Error('交换请求不存在');
    return next;
  },

  async confirmCompletion(id: string, userId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.status !== ExchangeStatus.ACCEPTED) throw new Error('当前状态不允许该操作');
    if (userId !== current.from_user_id && userId !== current.to_user_id) {
      throw new Error('只有交换双方可以确认完成');
    }
    const confirmedBy = Array.from(new Set([...current.confirmed_by, userId]));
    const bothConfirmed = [current.from_user_id, current.to_user_id].every((uid) => confirmedBy.includes(uid));
    const nextExchange: Exchange = {
      ...current,
      confirmed_by: confirmedBy,
      status: bothConfirmed ? ExchangeStatus.COMPLETED : current.status,
      updated_at: new Date().toISOString(),
    };
    if (bothConfirmed) {
      await itemApi.setStatus(current.from_item_id, ItemStatus.EXCHANGED);
      await itemApi.setStatus(current.to_item_id, ItemStatus.EXCHANGED);
    }
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },
};
