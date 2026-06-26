import { create } from 'zustand';
import type { IAccount, IOrderItem, Payment } from '@barbaros/shared';

interface AccountWithItems extends IAccount {
  items: IOrderItem[];
  total: number;
  pendingAmount: number;
  payments: Payment[];
}

interface AccountState {
  accounts: Record<string, AccountWithItems>;
  setAccounts: (accounts: IAccount[]) => void;
  addAccount: (account: IAccount) => void;
  updateAccount: (account: IAccount | AccountWithItems) => void;
  removeAccount: (accountId: string) => void;
  addItem: (accountId: string, item: IOrderItem) => void;
  updateItem: (accountId: string, item: IOrderItem) => void;
  removeItem: (accountId: string, itemId: string) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: {},
  setAccounts: (accountsList) => set(() => {
    const newAccounts: Record<string, AccountWithItems> = {};
    for (const acc of accountsList) {
      const raw = acc as any;
      newAccounts[acc.id] = {
        ...raw,
        items: raw.items ?? raw.orderItems ?? [],
        total: raw.total || 0,
        pendingAmount: raw.pendingAmount ?? raw.total ?? 0,
        payments: raw.payments ?? [],
      };
    }
    return { accounts: newAccounts };
  }),
  addAccount: (account) => set((state) => ({
    accounts: { ...state.accounts, [account.id]: { ...account, items: [], total: 0, pendingAmount: 0, payments: [] } }
  })),
  updateAccount: (account) => set((state) => {
    const existing = state.accounts[account.id];
    const raw = account as any;
    // Prisma returns "orderItems", frontend uses "items"
    const items = raw.items ?? raw.orderItems ?? existing?.items ?? [];
    const withItems: AccountWithItems = {
      ...raw,
      items,
      total: raw.total ?? existing?.total ?? 0,
      pendingAmount: raw.pendingAmount ?? existing?.pendingAmount ?? 0,
      payments: raw.payments ?? existing?.payments ?? [],
    };
    return { accounts: { ...state.accounts, [account.id]: withItems } };
  }),
  removeAccount: (accountId) => set((state) => {
    const { [accountId]: _, ...rest } = state.accounts;
    return { accounts: rest };
  }),
  addItem: (accountId, item) => set((state) => {
    const account = state.accounts[accountId];
    if (!account) return state;
    const existing = account.items.find((i) => i.id === item.id);
    const items = existing
      ? account.items.map((i) => (i.id === item.id ? item : i))
      : [...account.items, item];
    const total = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    return { accounts: { ...state.accounts, [accountId]: { ...account, items, total } } };
  }),
  updateItem: (accountId, item) => set((state) => {
    const account = state.accounts[accountId];
    if (!account) return state;
    const items = account.items.map((i) => (i.id === item.id ? item : i));
    const total = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    return { accounts: { ...state.accounts, [accountId]: { ...account, items, total } } };
  }),
  removeItem: (accountId, itemId) => set((state) => {
    const account = state.accounts[accountId];
    if (!account) return state;
    const items = account.items.filter((i) => i.id !== itemId);
    const total = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    return { accounts: { ...state.accounts, [accountId]: { ...account, items, total } } };
  }),
}));
