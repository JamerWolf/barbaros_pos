import { useEffect, useRef, useCallback } from 'react';
import { useAccountStore } from '../store/accountStore.js';
import { useAccountUIStore } from '../store/accountUIStore.js';
import API_URL from '../utils/apiUrl.js';

const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;

const ADDED_ACCOUNTS_KEY = 'barbaros-added-accounts'

export function useAccountSockets() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_DELAY);
  const { setAccounts, addAccount, updateAccount, removeAccount } = useAccountStore();

  const fetchAccounts = useCallback(async () => {
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

        // Re-merge accounts added from other shifts (persisted in localStorage)
        try {
          const addedIds: string[] = JSON.parse(localStorage.getItem(ADDED_ACCOUNTS_KEY) || '[]');
          for (const id of addedIds) {
            if (!accounts.find((a: any) => a.id === id)) {
              // This account is not in the current shift, re-fetch and add it
              fetch(`${API_URL}/accounts/${id}`)
                .then((r) => { if (r.ok) return r.json(); throw new Error() })
                .then((data) => {
                  addAccount(data);
                  // If it has a local position but no DB position, save it
                  const ui = useAccountUIStore.getState();
                  const localPos = ui.nodePositions[id];
                  if (localPos && (data.posX == null || data.posY == null)) {
                    fetch(`${API_URL}/accounts/${id}/position`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ posX: localPos.x, posY: localPos.y }),
                    }).catch(() => {});
                  }
                })
                .catch(() => {});
            }
          }
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Failed to fetch initial accounts:', err);
    }
  }, [setAccounts]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = async () => {
      console.log('WebSocket connected');
      reconnectDelay.current = RECONNECT_DELAY;
      await fetchAccounts();
    };

    ws.current.onmessage = (message) => {
      try {
        const { event, data } = JSON.parse(message.data);
        if (event === 'account:created') {
          addAccount(data);
          if (data.cardSize) {
            const uiState = useAccountUIStore.getState();
            useAccountUIStore.setState({
              cardSizes: { ...uiState.cardSizes, [data.id]: data.cardSize },
            });
          }
        } else if (event === 'account:updated') {
          updateAccount(data);
        } else if (event === 'account:deleted') {
          removeAccount(data);
        } else if (event === 'payment:created') {
          if (data.account) {
            updateAccount(data.account);
          }
        } else if (event === 'account:position') {
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
      console.log('WebSocket disconnected, reconnecting...');
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
        connect();
      }, reconnectDelay.current);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [fetchAccounts, addAccount, updateAccount, removeAccount]);

  useEffect(() => {
    connect();

    // Reconnect when tab becomes visible again (user returns from another app)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const state = ws.current?.readyState;
        if (state === WebSocket.CLOSED || state === WebSocket.CLOSING) {
          console.log('Tab visible again, reconnecting WebSocket...');
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);
}
