import { IAccount } from '../types/account.js';
import { IOrderItem } from '../types/order-item.js';
import { Payment } from '../types/payment.js';

export interface ServerToClientEvents {
  'account:created': (account: IAccount) => void;
  'account:updated': (account: IAccount & { items: IOrderItem[]; total: number }) => void;
  'account:deleted': (accountId: string) => void;
  'payment:created': (payload: { payment: Payment; pendingAmount: number; account: IAccount }) => void;
  'discount:updated': (payload: { accountId: string; total: number; pendingAmount: number; account: IAccount }) => void;
}
