import { useEffect, useRef, useCallback } from 'react';
import { useShapeStore } from '../store/shapeStore.js';
import API_URL from '../utils/apiUrl.js';

const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;

export function useShapeSockets() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(RECONNECT_DELAY);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('Shape WebSocket connected');
      reconnectDelay.current = RECONNECT_DELAY;
    };

    ws.current.onmessage = (message) => {
      try {
        const { event, data } = JSON.parse(message.data);
        const state = useShapeStore.getState();

        if (event === 'shape:created') {
          if (!state.shapes.find((s) => s.id === data.id)) {
            useShapeStore.setState({ shapes: [...state.shapes, data] });
          }
        } else if (event === 'shape:updated') {
          useShapeStore.setState({
            shapes: state.shapes.map((s) => (s.id === data.id ? data : s)),
          });
        } else if (event === 'shape:deleted') {
          useShapeStore.setState({
            shapes: state.shapes.filter((s) => s.id !== data.id),
          });
        }
      } catch {
        // ignore
      }
    };

    ws.current.onclose = () => {
      console.log('Shape WebSocket disconnected, reconnecting...');
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
