import { useEffect, useState, useCallback } from 'react';
import socketService from '../services/socket.service';
import { ConnectionState, MatchData, ErrorData, ServerStats } from '../types';

export const useSocket = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [userId, setUserId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);

  useEffect(() => {
    const socket = socketService.connect();

    // Connection events
    socket.on('connect', () => {
      setConnectionState(ConnectionState.CONNECTED);
      setError('');
    });

    socket.on('disconnect', () => {
      setConnectionState(ConnectionState.DISCONNECTED);
    });

    socket.on('connect_error', () => {
      setConnectionState(ConnectionState.ERROR);
      setError('Failed to connect to server');
    });

    // User joined event
    socket.on('user_joined', (data: any) => {
      setUserId(data.userId);

      // Set up ICE servers
      const servers: RTCIceServer[] = [];

      if (data.stunServers) {
        data.stunServers.forEach((url: string) => {
          servers.push({ urls: url });
        });
      }

      if (data.turnServer) {
        servers.push(data.turnServer);
      }

      setIceServers(servers);
    });

    // Error handling
    socket.on('error', (data: ErrorData) => {
      setError(data.error);
      console.error('Socket error:', data);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const startSearch = useCallback((interests: string[]) => {
    setConnectionState(ConnectionState.SEARCHING);
    setError('');
    socketService.startSearch(interests);
  }, []);

  const stopSearch = useCallback(() => {
    setConnectionState(ConnectionState.CONNECTED);
    socketService.stopSearch();
  }, []);

  const skipPartner = useCallback(() => {
    socketService.skipPartner();
  }, []);

  const endChat = useCallback(() => {
    setConnectionState(ConnectionState.CONNECTED);
    socketService.endChat();
  }, []);

  return {
    connectionState,
    setConnectionState,
    userId,
    error,
    setError,
    iceServers,
    startSearch,
    stopSearch,
    skipPartner,
    endChat,
  };
};
