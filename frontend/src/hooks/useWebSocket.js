import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (url, onMessage) => {
  const [status, setStatus] = useState('Disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  // Store onMessage in a ref so the connect callback doesn't depend on it,
  // preventing reconnection loops when the parent re-renders.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('Connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection opened.');
      setStatus('Connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (onMessageRef.current) {
          onMessageRef.current(payload);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    ws.onclose = (event) => {
      console.log(`WebSocket connection closed: ${event.reason} (code ${event.code})`);
      setStatus('Disconnected');
      wsRef.current = null;

      // Exponential backoff reconnect strategy
      const backoffIntervals = [1000, 2000, 5000, 10000];
      const delay = backoffIntervals[reconnectAttemptsRef.current] || 10000;
      reconnectAttemptsRef.current = Math.min(reconnectAttemptsRef.current + 1, backoffIntervals.length - 1);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      setStatus('Reconnecting');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    status,
    reconnect: connect
  };
};
