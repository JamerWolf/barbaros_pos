import assert from 'node:assert';
import { useAccountStore } from './store/accountStore.js';
import type { IAccount } from '@barbaros/shared';
import { DiscountType } from '@barbaros/shared';

function runStoreTests() {
  console.log('--- Test 4.3: Zustand Store Updates and Deletes ---');
  const store = useAccountStore.getState();

  const mockAccount: IAccount = {
    id: '123',
    shiftId: 'shift-1',
    number: 1,
    name: 'Mesa 1',
    status: 'OPEN',
    discountType: DiscountType.NONE,
    discountValue: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Add
  store.addAccount(mockAccount);
  assert.strictEqual(Object.keys(useAccountStore.getState().accounts).length, 1);
  assert.strictEqual(useAccountStore.getState().accounts['123'].name, 'Mesa 1');
  console.log('✅ Add Account OK');

  // Update
  store.updateAccount({ ...mockAccount, status: 'CLOSED' });
  assert.strictEqual(useAccountStore.getState().accounts['123'].status, 'CLOSED');
  console.log('✅ Update Account OK');

  // Delete
  store.removeAccount('123');
  assert.strictEqual(Object.keys(useAccountStore.getState().accounts).length, 0);
  console.log('✅ Remove Account OK');
  
  console.log('All Store Tests Passed.');
}

runStoreTests();
