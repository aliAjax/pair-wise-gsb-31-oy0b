export enum ExchangeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  SETTLED_ELSEWHERE = 'settled_elsewhere',
  WITHDRAWN = 'withdrawn',
  COMPLETED = 'completed',
}

export const EXCHANGE_STATUS_OPTIONS = [
  { label: '待确认', value: ExchangeStatus.PENDING },
  { label: '已同意', value: ExchangeStatus.ACCEPTED },
  { label: '已拒绝', value: ExchangeStatus.REJECTED },
  { label: '交换已另行达成', value: ExchangeStatus.SETTLED_ELSEWHERE },
  { label: '已撤回', value: ExchangeStatus.WITHDRAWN },
  { label: '已完成', value: ExchangeStatus.COMPLETED },
];

export const EXCHANGE_ACTION_FLOW: Record<ExchangeStatus, ExchangeStatus[]> = {
  [ExchangeStatus.PENDING]: [ExchangeStatus.ACCEPTED, ExchangeStatus.REJECTED],
  [ExchangeStatus.ACCEPTED]: [ExchangeStatus.WITHDRAWN, ExchangeStatus.COMPLETED],
  [ExchangeStatus.REJECTED]: [],
  [ExchangeStatus.SETTLED_ELSEWHERE]: [],
  [ExchangeStatus.WITHDRAWN]: [],
  [ExchangeStatus.COMPLETED]: [],
};

export const EXCHANGE_STORAGE_HINTS = {
  statusKey: 'reswap:exchanges',
  statusTouchedBy: ['models/exchange.ts', 'stores/exchangeStore.ts', 'components/common/ExchangeCard.vue'],
};
