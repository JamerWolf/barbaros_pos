import { IAccount } from '../types/account';
import { IOrderItem } from '../types/order-item';
import { Payment } from '../types/payment';

export interface ServerToClientEvents {
  'account:created': (account: IAccount) => void;
  'account:updated': (account: IAccount & { items: IOrderItem[]; total: number }) => void;
  'account:deleted': (accountId: string) => void;
  'payment:created': (payload: { payment: Payment; pendingAmount: number; account: IAccount }) => void;
}
