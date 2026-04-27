/**
 * DDLJ Trading System — WebSocket Hook
 * =======================================
 * Real-time updates from the FastAPI WebSocket server.
 * Auto-reconnects with exponential backoff.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_URL } from '@/lib/api';
import { useDDLJStore } from '@/lib/store';

type WSMessageType =
  | 'status_update'
  | 'trade_update'
  | 'position_update'
  | 'signal'
  | 'config_change'
  | 'health_update'
  | 'risk_update';

interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: string;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const { setConnected, updateEngineStatus, addSignal, addTrade, addPosition, removePosition } = useDDLJStore();

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'status_update':
          updateEngineStatus(msg.data as Partial<import('@/lib/mock-data').EngineStatus>);
          break;
        case 'trade_update':
          addTrade(msg.data as import('@/lib/mock-data').Trade);
          break;
        case 'position_update': {
          const pos = msg.data as { action: 'add' | 'remove'; position: import('@/lib/mock-data').Position };
          if (pos.action === 'add') addPosition(pos.position);
          else if (pos.action === 'remove') removePosition(pos.position.id);
          break;
        }
        case 'signal':
          addSignal(msg.data as import('@/lib/mock-data').SignalLog);
          break;
        case 'config_change':
        case 'health_update':
        case 'risk_update':
          // These can be handled by polling or extending the store
          break;
      }
    } catch {
      // Non-JSON message — ignore
    }
  }, [updateEngineStatus, addSignal, addTrade, addPosition, removePosition]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setConnectionState('connecting');
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnectionState('connected');
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        setConnectionState('disconnected');
        setConnected(false);
        // Schedule reconnect inline to avoid circular dependency
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          maxReconnectDelay
        );
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(() => connect(), delay);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      setConnectionState('disconnected');
      setConnected(false);
      // Schedule reconnect inline
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current),
        maxReconnectDelay
      );
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(() => connect(), delay);
    }
  }, [handleMessage, setConnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');
    setConnected(false);
  }, [setConnected]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connectionState,
    reconnect: connect,
    disconnect,
    send,
  };
}
