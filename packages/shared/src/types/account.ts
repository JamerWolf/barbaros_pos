import { IOrderItem } from './order-item.js';
import { DiscountType } from './discount.js';

export type AccountStatus = 'OPEN' | 'CLOSED';
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface IShift {
  id: string;
  status: ShiftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccount {
  id: string;
  shiftId: string;
  number: number;
  name: string;
  status: AccountStatus;
  hidden?: boolean;
  discountType: DiscountType;
  discountValue: number;
  posX?: number | null;
  posY?: number | null;
  cardSize?: string | null;
  items?: IOrderItem[];
  total?: number;
  pendingAmount?: number;
  payments?: any[];
  shift?: { id: string; createdAt: string; updatedAt: string; status: string };
  createdAt: Date;
  updatedAt: Date;
}
