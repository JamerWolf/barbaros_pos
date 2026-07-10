import { useEffect, useRef, useCallback } from 'react';
import { useAccountStore } from '../store/accountStore.js';
import { useAccountUIStore } from '../store/accountUIStore.js';
import API_URL from '../utils/apiUrl.js';

const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;

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
        const cardDimensions = { ...uiState.cardDimensions };
        let positionsChanged = false;
        let sizesChanged = false;
        let dimsChanged = false;

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

          // Merge custom card dimensions from DB
          if (acc.cardWidth != null && acc.cardHeight != null) {
            cardDimensions[acc.id] = { w: acc.cardWidth, h: acc.cardHeight };
            dimsChanged = true;
          }
        }

        const updates: Record<string, any> = {};
        if (positionsChanged) updates.nodePositions = positions;
        if (sizesChanged) updates.cardSizes = cardSizes;
        if (dimsChanged) updates.cardDimensions = cardDimensions;
        if (positionsChanged || sizesChanged || dimsChanged) {
          useAccountUIStore.setState(updates);
        }
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
          const { id, cardSize, cardWidth, cardHeight } = data;
          const uiState = useAccountUIStore.getState();
          const updates: Record<string, any> = {};
          if (cardSize != null && cardSize !== '') {
            updates.cardSizes = { ...uiState.cardSizes, [id]: cardSize };
          }
          if (cardWidth != null && cardHeight != null) {
            updates.cardDimensions = { ...uiState.cardDimensions, [id]: { w: cardWidth, h: cardHeight } };
          } else if (cardWidth === null || cardHeight === null) {
            // Preset was set — clear custom dims
            const { [id]: _, ...rest } = uiState.cardDimensions;
            updates.cardDimensions = rest;
          }
          if (Object.keys(updates).length > 0) {
            useAccountUIStore.setState(updates);
          }
        } else if (event === 'account:card-dimensions') {
          const { id, cardWidth, cardHeight } = data;
          const uiState = useAccountUIStore.getState();
          if (cardWidth != null && cardHeight != null) {
            useAccountUIStore.setState({
              cardDimensions: { ...uiState.cardDimensions, [id]: { w: cardWidth, h: cardHeight } },
            });
          } else {
            const { [id]: _, ...rest } = uiState.cardDimensions;
            useAccountUIStore.setState({ cardDimensions: rest });
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
