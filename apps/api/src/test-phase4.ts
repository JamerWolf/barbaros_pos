import assert from 'node:assert';
import { buildApp } from './app.js';
import { prisma } from './db/prisma.js';

async function runTests() {
  console.log('Building app...');
  const app = await buildApp();

  console.log('Cleaning up db...');
  await prisma.account.deleteMany();
  await prisma.shift.deleteMany();

  console.log('Opening a new shift...');
  const shiftRes = await app.inject({
    method: 'POST',
    url: '/shifts/open'
  });
  assert.strictEqual(shiftRes.statusCode, 201);
  const _shift = shiftRes.json();

  console.log('--- Test 4.1: 10 concurrent calls to POST /accounts ---');
  const createPromises = Array.from({ length: 10 }).map((_, i) => {
    return app.inject({
      method: 'POST',
      url: '/accounts',
      payload: { name: `Test Concurrent ${i}` }
    });
  });

  const responses = await Promise.all(createPromises);
  const createdAccounts = responses.map(res => res.json());
  
  const numbers = createdAccounts.map(a => a.number);
  const uniqueNumbers = new Set(numbers);
  
  assert.strictEqual(uniqueNumbers.size, 10, 'Should have 10 unique account numbers');
  console.log('✅ Test 4.1 Passed: No collisions in account numbers.');

  console.log('--- Test 4.2: Close account with total $0 deletes it ---');
  const accountToClose = createdAccounts[0];
  const closeRes = await app.inject({
    method: 'PUT',
    url: `/accounts/${accountToClose.id}/close`,
    payload: { total: 0 }
  });
  
  assert.strictEqual(closeRes.statusCode, 204, 'Should return 204 No Content for deletion');
  
  const checkDeleted = await prisma.account.findUnique({ where: { id: accountToClose.id } });
  assert.strictEqual(checkDeleted, null, 'Account should be physically deleted from DB');
  console.log('✅ Test 4.2 Passed: Account with $0 physically deleted.');

  // Store Test (4.3)
  console.log('--- Test 4.3: Zustand Store Test ---');
  // Dynamic import the Zustand store (needs to resolve without react errors)
  // We can just verify the logic locally since we don't have vitest.
  // Actually, let's write a dedicated script for the frontend store.

  await app.close();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed!', err);
  process.exit(1);
});
