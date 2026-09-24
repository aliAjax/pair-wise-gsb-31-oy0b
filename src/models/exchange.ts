import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_item_id: string;
  to_item_id: string;
  status: ExchangeStatus;
  message: string;
  from_confirmed_at: string | null;
  to_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ExchangeDraft = Omit<Exchange, 'id' | 'status' | 'from_confirmed_at' | 'to_confirmed_at' | 'created_at' | 'updated_at'> & {
  status?: ExchangeStatus;
};
