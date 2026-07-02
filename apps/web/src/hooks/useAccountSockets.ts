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

          // Merge positions: DB is source of truth, localStorage fills gaps
          const uiState = useAccountUIStore.getState();
          const positions = { ...uiState.nodePositions };
          const cardSizes = { ...uiState.cardSizes };
          let positionsChanged = false;
          let sizesChanged = false;

          for (const acc of accounts) {
            const hasDBPosition = acc.posX != null && acc.posY != null;
            const hasLocalPosition = uiState.nodePositions[acc.id] != null;

            if (hasDBPosition) {
              positions[acc.id] = { x: acc.posX, y: acc.posY };
              positionsChanged = true;
            } else if (hasLocalPosition) {
              const localPos = uiState.nodePositions[acc.id];
              positions[acc.id] = localPos;
              positionsChanged = true;
              fetch(`${API_URL}/accounts/${acc.id}/position`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posX: localPos.x, posY: localPos.y }),
              }).catch(() => {});
            }

            const hasDBSize = acc.cardSize != null && acc.cardSize !== '';
            const hasLocalSize = uiState.cardSizes[acc.id] != null;

            if (hasDBSize) {
              cardSizes[acc.id] = acc.cardSize;
              sizesChanged = true;
            } else if (hasLocalSize) {
              const localSize = uiState.cardSizes[acc.id];
              cardSizes[acc.id] = localSize;
              sizesChanged = true;
              fetch(`${API_URL}/accounts/${acc.id}/card-size`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardSize: localSize }),
              }).catch(() => {});
            }
          }

          const updates: Record<string, any> = {};
          if (positionsChanged) updates.nodePositions = positions;
          if (sizesChanged) updates.cardSizes = cardSizes;
          if (positionsChanged || sizesChanged) {
            useAccountUIStore.setState(updates);
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
          // Update card position from other clients
          const { id, posX, posY } = data;
          if (posX != null && posY != null) {
            useAccountUIStore.setState({
              nodePositions: {
                ...useAccountUIStore.getState().nodePositions,
                [id]: { x: posX, y: posY },
              },
            });
          }
        } else if (event === 'account:card-size') {
          // Update card size from other clients (only when explicitly changed)
          const { id, cardSize } = data;
          if (cardSize != null && cardSize !== '') {
            const uiState = useAccountUIStore.getState();
            useAccountUIStore.setState({
              cardSizes: { ...uiState.cardSizes, [id]: cardSize },
            });
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
