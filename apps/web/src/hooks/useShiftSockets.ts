import { useEffect, useRef, useCallback } from 'react';

import API_URL from '../utils/apiUrl.js';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;

/** Events that should trigger a shift detail refresh */
const SHIFT_EVENTS = new Set([
  'account:created',
  'account:updated',
  'account:deleted',
  'payment:created',
  'discount:updated',
  'shift:opened',
  'shift:closed',
]);

/**
 * Hook that listens to WebSocket events relevant to shift detail.
 * Calls `onShiftChange` when any shift-related event arrives.
 */
export function useShiftSockets(onShiftChange: () => void) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_DELAY);
  const callbackRef = useRef(onShiftChange);
  callbackRef.current = onShiftChange;

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      reconnectDelay.current = RECONNECT_DELAY;
    };

    ws.current.onmessage = (message) => {
      try {
        const { event } = JSON.parse(message.data);
        if (SHIFT_EVENTS.has(event)) {
          callbackRef.current();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
        connect();
      }, reconnectDelay.current);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    connect();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const state = ws.current?.readyState;
        if (state === WebSocket.CLOSED || state === WebSocket.CLOSING) {
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
