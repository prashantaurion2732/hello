export interface User {
  id: string;
  socketId: string;
  interests: string[];
  connectedAt: Date;
  isSearching: boolean;
  partnerId?: string;
  lastActivity: Date;
}

export interface ChatSession {
  id: string;
  user1Id: string;
  user2Id: string;
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
}

export interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system';
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

export interface MatchRequest {
  userId: string;
  interests: string[];
  timestamp: Date;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  sessionId: string;
  reason: string;
  timestamp: Date;
  resolved: boolean;
}

export enum SocketEvents {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',

  // Matching events
  START_SEARCH = 'start_search',
  STOP_SEARCH = 'stop_search',
  MATCH_FOUND = 'match_found',
  MATCH_FAILED = 'match_failed',

  // Chat events
  SEND_MESSAGE = 'send_message',
  RECEIVE_MESSAGE = 'receive_message',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',

  // Session events
  SKIP_PARTNER = 'skip_partner',
  END_CHAT = 'end_chat',
  PARTNER_DISCONNECTED = 'partner_disconnected',

  // WebRTC signaling events
  WEBRTC_OFFER = 'webrtc_offer',
  WEBRTC_ANSWER = 'webrtc_answer',
  WEBRTC_ICE_CANDIDATE = 'webrtc_ice_candidate',

  // User events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',

  // Moderation events
  REPORT_USER = 'report_user',
  REPORT_SUBMITTED = 'report_submitted',

  // Error events
  ERROR = 'error',

  // System events
  PING = 'ping',
  PONG = 'pong',
  STATS = 'stats'
}

export interface ServerStats {
  activeUsers: number;
  activeSessions: number;
  waitingUsers: number;
  totalConnections: number;
  uptime: number;
}

export interface ErrorResponse {
  error: string;
  code: string;
  timestamp: Date;
}
