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
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    from_confirmed_at: null,
    to_confirmed_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'exchange_seed_rival',
    from_user_id: 'user_chen',
    to_user_id: 'user_lin',
    from_item_id: 'item_books',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '设计书也想换这台拍立得，同城可面交。',
    from_confirmed_at: null,
    to_confirmed_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

const touchesItem = (exchange: Exchange, itemIds: string[]) =>
  itemIds.includes(exchange.from_item_id) || itemIds.includes(exchange.to_item_id);

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges;
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
      from_confirmed_at: null,
      to_confirmed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async accept(id: string, operatorId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.to_user_id !== operatorId) throw new Error('只有物主可以同意交换');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(ExchangeStatus.ACCEPTED)) {
      throw new Error('当前状态不允许该操作');
    }
    const fromItem = await itemApi.detail(current.from_item_id);
    const toItem = await itemApi.detail(current.to_item_id);
    if (fromItem?.status !== ItemStatus.AVAILABLE || toItem?.status !== ItemStatus.AVAILABLE) {
      throw new Error('相关物品已进入其他交换，无法同意');
    }
    const now = new Date().toISOString();
    const lockedItemIds = [current.from_item_id, current.to_item_id];
    const nextExchanges = exchanges.map((item) => {
      if (item.id === id) {
        return { ...item, status: ExchangeStatus.ACCEPTED, updated_at: now };
      }
      if (item.status === ExchangeStatus.PENDING && touchesItem(item, lockedItemIds)) {
        return { ...item, status: ExchangeStatus.SUPERSEDED, updated_at: now };
      }
      return item;
    });
    await itemApi.setStatus(current.from_item_id, ItemStatus.BOOKED);
    await itemApi.setStatus(current.to_item_id, ItemStatus.BOOKED);
    await storage.set(STORAGE_KEYS.exchanges, nextExchanges);
    const accepted = nextExchanges.find((item) => item.id === id);
    if (!accepted) throw new Error('交换请求不存在');
    return accepted;
  },

  async withdraw(id: string, operatorId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.from_user_id !== operatorId && current.to_user_id !== operatorId) {
      throw new Error('只有交换双方可以撤回');
    }
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(ExchangeStatus.WITHDRAWN)) {
      throw new Error('当前状态不允许撤回');
    }
    const now = new Date().toISOString();
    const nextExchange: Exchange = { ...current, status: ExchangeStatus.WITHDRAWN, updated_at: now };
    await itemApi.setStatus(current.from_item_id, ItemStatus.AVAILABLE);
    await itemApi.setStatus(current.to_item_id, ItemStatus.AVAILABLE);
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  async confirmComplete(id: string, operatorId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.from_user_id !== operatorId && current.to_user_id !== operatorId) {
      throw new Error('只有交换双方可以确认完成');
    }
    if (current.status !== ExchangeStatus.ACCEPTED) {
      throw new Error('当前状态不允许确认完成');
    }
    if (
      (operatorId === current.from_user_id && current.from_confirmed_at) ||
      (operatorId === current.to_user_id && current.to_confirmed_at)
    ) {
      throw new Error('你已确认完成，等待对方确认');
    }
    const now = new Date().toISOString();
    const nextExchange: Exchange = { ...current, updated_at: now };
    if (operatorId === current.from_user_id) nextExchange.from_confirmed_at = now;
    if (operatorId === current.to_user_id) nextExchange.to_confirmed_at = now;
    if (nextExchange.from_confirmed_at && nextExchange.to_confirmed_at) {
      nextExchange.status = ExchangeStatus.COMPLETED;
      await itemApi.setStatus(current.from_item_id, ItemStatus.EXCHANGED);
      await itemApi.setStatus(current.to_item_id, ItemStatus.EXCHANGED);
    }
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },
};
