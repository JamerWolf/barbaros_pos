import { useEffect, useRef } from 'react';

import API_URL from '../utils/apiUrl.js';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

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
  const callbackRef = useRef(onShiftChange);
  callbackRef.current = onShiftChange;

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);

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
      // Reconnect after 2s
      setTimeout(() => {
        if (ws.current?.readyState === WebSocket.CLOSED) {
          ws.current = new WebSocket(WS_URL);
        }
      }, 2000);
    };

    return () => {
      ws.current?.close();
    };
  }, []);
}
