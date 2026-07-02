import { useEffect, useRef } from 'react';
import { useShapeStore } from '../store/shapeStore.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

export function useShapeSockets() {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onmessage = (message) => {
      try {
        const { event, data } = JSON.parse(message.data);
        const state = useShapeStore.getState();

        if (event === 'shape:created') {
          // Avoid duplicate
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
