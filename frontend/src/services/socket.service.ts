import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Event emitters
  startSearch(interests: string[]): void {
    this.socket?.emit('start_search', { interests });
  }

  stopSearch(): void {
    this.socket?.emit('stop_search');
  }

  skipPartner(): void {
    this.socket?.emit('skip_partner');
  }

  endChat(): void {
    this.socket?.emit('end_chat');
  }

  sendMessage(message: string): void {
    this.socket?.emit('send_message', { message });
  }

  sendTypingStart(): void {
    this.socket?.emit('typing_start');
  }

  sendTypingStop(): void {
    this.socket?.emit('typing_stop');
  }

  sendWebRTCOffer(offer: RTCSessionDescriptionInit): void {
    this.socket?.emit('webrtc_offer', { offer });
  }

  sendWebRTCAnswer(answer: RTCSessionDescriptionInit): void {
    this.socket?.emit('webrtc_answer', { answer });
  }

  sendWebRTCIceCandidate(candidate: RTCIceCandidate): void {
    this.socket?.emit('webrtc_ice_candidate', { candidate });
  }

  reportUser(reason: string): void {
    this.socket?.emit('report_user', { reason });
  }

  requestStats(): void {
    this.socket?.emit('stats');
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }

  once(event: string, callback: (...args: any[]) => void): void {
    this.socket?.once(event, callback);
  }
}

export default new SocketService();
