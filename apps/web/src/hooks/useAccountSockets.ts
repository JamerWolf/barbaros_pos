import { useEffect, useRef } from 'react';
import { useAccountStore } from '../store/accountStore.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

export function useAccountSockets() {
  const ws = useRef<WebSocket | null>(null);
  const { setAccounts, addAccount, updateAccount, removeAccount } = useAccountStore();

  useEffect(() => {
    // Connect WebSocket
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = async () => {
      console.log('WebSocket connected. Fetching accounts...');
      try {
        const res = await fetch(`${API_URL}/accounts`);
        if (res.ok) {
          const accounts = await res.json();
          setAccounts(accounts);
        }
      } catch (err) {
        console.error('Failed to fetch initial accounts:', err);
      }
    };

    ws.current.onmessage = (message) => {
      try {
        const { event, data } = JSON.parse(message.data);
        if (event === 'account:created') {
          addAccount(data);
        } else if (event === 'account:updated') {
          updateAccount(data);
        } else if (event === 'account:deleted') {
          removeAccount(data); // data is the accountId
        } else if (event === 'payment:created') {
          // Update account with new payment data
          if (data.account) {
            updateAccount(data.account);
          }
        }
      } catch (err) {
        console.error('Error parsing websocket message', err);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.current?.close();
    };
  }, [setAccounts, addAccount, updateAccount, removeAccount]);
}
