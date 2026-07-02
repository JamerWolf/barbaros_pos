import { useEffect, useRef } from 'react';
import { useAccountStore } from '../store/accountStore.js';
import { useAccountUIStore } from '../store/accountUIStore.js';

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

          // Sync positions from backend into UI store
          const uiState = useAccountUIStore.getState();
          const positions = { ...uiState.nodePositions };
          const cardSizes = { ...uiState.cardSizes };
          let changed = false;
          for (const acc of accounts) {
            if (acc.posX != null && acc.posY != null) {
              // Backend has position — use it (authoritative)
              positions[acc.id] = { x: acc.posX, y: acc.posY };
              changed = true;
            }
            if (acc.cardSize) {
              cardSizes[acc.id] = acc.cardSize;
              changed = true;
            }
          }
          if (changed) {
            useAccountUIStore.setState({ nodePositions: positions, cardSizes });
          }
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
        } else if (event === 'account:position') {
          // Update card position/size from other clients
          const { id, posX, posY, cardSize } = data;
          const uiState = useAccountUIStore.getState();
          const updates: Record<string, any> = {};
          if (posX !== undefined && posY !== undefined) {
            updates.nodePositions = {
              ...uiState.nodePositions,
              [id]: { x: posX, y: posY },
            };
          }
          if (cardSize !== undefined) {
            updates.cardSizes = {
              ...uiState.cardSizes,
              [id]: cardSize,
            };
          }
          useAccountUIStore.setState(updates);
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
