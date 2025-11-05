export interface User {
  id: string;
  socketId: string;
  interests: string[];
}

export interface Message {
  text: string;
  sender: 'me' | 'stranger';
  timestamp: Date;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  SEARCHING = 'SEARCHING',
  MATCHED = 'MATCHED',
  IN_CHAT = 'IN_CHAT',
  ERROR = 'ERROR',
}

export interface ServerStats {
  activeUsers: number;
  activeSessions: number;
  waitingUsers: number;
  totalConnections: number;
  uptime: number;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface MatchData {
  sessionId: string;
  partnerId: string;
  partnerInterests: string[];
}

export interface ErrorData {
  error: string;
  code: string;
  timestamp?: Date;
}
