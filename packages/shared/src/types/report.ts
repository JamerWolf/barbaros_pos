export type PaymentMethodType = 'CASH' | 'TRANSFER' | 'CARD';

export interface ShiftReport {
  shiftId: string
  openedAt: Date
  closedAt?: Date
  totalSales: number
  totalPaid: number
  pendingAmount: number
  paymentsByMethod: Record<string, number>
}

export interface ShiftListItem {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  accountsCount: number;
  totalSales: number;
  totalPaid: number;
}

export interface ShiftSummary {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  accountsCount: number;
  totalSales: number;
  totalPaid: number;
  pendingAmount: number;
  paymentsByMethod: Record<PaymentMethodType, number>;
  accounts: ShiftAccountSummary[];
}

export interface ShiftAccountSummary {
  id: string;
  number: number;
  name: string;
  status: 'OPEN' | 'CLOSED';
  total: number;
  paid: number;
  pendingAmount: number;
}
