import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import redisService from '../services/redis.service';
import matchingService from '../services/matching.service';
import databaseService from '../services/database.service';
import logger from '../utils/logger';
import { validateInterests, validateMessage, validateReportReason, sanitizeInterests } from '../utils/validators';
import { User, SocketEvents, Report, ServerStats } from '../types';
import { config } from '../config';

export class SocketController {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupMiddleware();
    this.setupConnectionHandler();
  }

  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        // Rate limiting
        const ip = socket.handshake.address;
        const allowed = await redisService.checkRateLimit(
          `socket:${ip}`,
          config.rateLimit.maxRequests,
          config.rateLimit.windowMs
        );

        if (!allowed) {
          logger.warn('Socket rate limit exceeded', { ip });
          return next(new Error('Rate limit exceeded'));
        }

        next();
      } catch (error) {
        logger.error('Socket middleware error', error);
        next(new Error('Internal server error'));
      }
    });
  }

  private setupConnectionHandler(): void {
    this.io.on(SocketEvents.CONNECTION, (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const userId = uuidv4();
    logger.info('User connected', { userId, socketId: socket.id });

    try {
      // Create user
      const user: User = {
        id: userId,
        socketId: socket.id,
        interests: [],
        connectedAt: new Date(),
        isSearching: false,
        lastActivity: new Date(),
      };

      await redisService.setUser(userId, user);
      await redisService.setSocketUser(socket.id, userId);

      // Send user their ID
      socket.emit(SocketEvents.USER_JOINED, {
        userId,
        stunServers: config.stunServers,
        turnServer: config.turn.url ? {
          urls: config.turn.url,
          username: config.turn.username,
          credential: config.turn.credential,
        } : null,
      });

      // Log analytics
      await databaseService.logEvent('user_connected', userId);

      // Setup event handlers
      this.setupUserHandlers(socket, userId);

      // Handle disconnect
      socket.on(SocketEvents.DISCONNECT, () => this.handleDisconnect(socket, userId));
    } catch (error) {
      logger.error('Error handling connection', { error, socketId: socket.id });
      socket.disconnect();
    }
  }

  private setupUserHandlers(socket: Socket, userId: string): void {
    // Matching events
    socket.on(SocketEvents.START_SEARCH, (data) => this.handleStartSearch(socket, userId, data));
    socket.on(SocketEvents.STOP_SEARCH, () => this.handleStopSearch(socket, userId));
    socket.on(SocketEvents.SKIP_PARTNER, () => this.handleSkipPartner(socket, userId));
    socket.on(SocketEvents.END_CHAT, () => this.handleEndChat(socket, userId));

    // Chat events
    socket.on(SocketEvents.SEND_MESSAGE, (data) => this.handleSendMessage(socket, userId, data));
    socket.on(SocketEvents.TYPING_START, () => this.handleTypingStart(socket, userId));
    socket.on(SocketEvents.TYPING_STOP, () => this.handleTypingStop(socket, userId));

    // WebRTC signaling events
    socket.on(SocketEvents.WEBRTC_OFFER, (data) => this.handleWebRTCOffer(socket, userId, data));
    socket.on(SocketEvents.WEBRTC_ANSWER, (data) => this.handleWebRTCAnswer(socket, userId, data));
    socket.on(SocketEvents.WEBRTC_ICE_CANDIDATE, (data) => this.handleWebRTCIceCandidate(socket, userId, data));

    // Moderation events
    socket.on(SocketEvents.REPORT_USER, (data) => this.handleReportUser(socket, userId, data));

    // System events
    socket.on(SocketEvents.PING, () => this.handlePing(socket, userId));
    socket.on(SocketEvents.STATS, () => this.handleStats(socket));
  }

  private async handleStartSearch(socket: Socket, userId: string, data: any): Promise<void> {
    try {
      const interests = sanitizeInterests(data?.interests || []);
      const validation = validateInterests(interests);

      if (!validation.valid) {
        socket.emit(SocketEvents.ERROR, { error: validation.error, code: 'INVALID_INTERESTS' });
        return;
      }

      const user = await redisService.getUser(userId);
      if (!user) {
        socket.emit(SocketEvents.ERROR, { error: 'User not found', code: 'USER_NOT_FOUND' });
        return;
      }

      // Check if already in a session
      const existingSession = await redisService.getUserSession(userId);
      if (existingSession) {
        socket.emit(SocketEvents.ERROR, { error: 'Already in a session', code: 'ALREADY_IN_SESSION' });
        return;
      }

      user.interests = interests;
      await redisService.setUser(userId, user);

      logger.info('User started search', { userId, interests });
      await databaseService.logEvent('search_started', userId, undefined, { interests });

      // Try to find match
      await matchingService.startSearch(user);

      // Check if match was found immediately
      const session = await redisService.getUserSession(userId);
      if (session) {
        const sessionData = await redisService.getSession(session);
        const partnerId = sessionData.user1Id === userId ? sessionData.user2Id : sessionData.user1Id;
        const partnerUser = await redisService.getUser(partnerId);

        if (partnerUser) {
          // Notify both users
          socket.emit(SocketEvents.MATCH_FOUND, {
            sessionId: session,
            partnerId,
            partnerInterests: partnerUser.interests,
          });

          this.io.to(partnerUser.socketId).emit(SocketEvents.MATCH_FOUND, {
            sessionId: session,
            partnerId: userId,
            partnerInterests: interests,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling start search', { error, userId });
      socket.emit(SocketEvents.ERROR, { error: 'Failed to start search', code: 'SEARCH_ERROR' });
    }
  }

  private async handleStopSearch(socket: Socket, userId: string): Promise<void> {
    try {
      await matchingService.stopSearch(userId);
      logger.info('User stopped search', { userId });
      await databaseService.logEvent('search_stopped', userId);
    } catch (error) {
      logger.error('Error handling stop search', { error, userId });
    }
  }

  private async handleSkipPartner(socket: Socket, userId: string): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) {
        socket.emit(SocketEvents.ERROR, { error: 'Not in a session', code: 'NOT_IN_SESSION' });
        return;
      }

      const session = await redisService.getSession(sessionId);
      if (session) {
        const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
        const partner = await redisService.getUser(partnerId);

        // Notify partner
        if (partner) {
          this.io.to(partner.socketId).emit(SocketEvents.PARTNER_DISCONNECTED, {
            reason: 'Partner skipped',
          });
        }

        // End session
        await matchingService.endSession(userId, sessionId);
      }

      logger.info('User skipped partner', { userId, sessionId });
      await databaseService.logEvent('partner_skipped', userId, sessionId);

      // Auto start new search
      socket.emit(SocketEvents.PARTNER_DISCONNECTED, { reason: 'You skipped' });

    } catch (error) {
      logger.error('Error handling skip partner', { error, userId });
      socket.emit(SocketEvents.ERROR, { error: 'Failed to skip partner', code: 'SKIP_ERROR' });
    }
  }

  private async handleEndChat(socket: Socket, userId: string): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) {
        return;
      }

      const session = await redisService.getSession(sessionId);
      if (session) {
        const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
        const partner = await redisService.getUser(partnerId);

        // Notify partner
        if (partner) {
          this.io.to(partner.socketId).emit(SocketEvents.PARTNER_DISCONNECTED, {
            reason: 'Partner ended chat',
          });
        }

        await matchingService.endSession(userId, sessionId);
      }

      logger.info('User ended chat', { userId, sessionId });
      await databaseService.logEvent('chat_ended', userId, sessionId);
    } catch (error) {
      logger.error('Error handling end chat', { error, userId });
    }
  }

  private async handleSendMessage(socket: Socket, userId: string, data: any): Promise<void> {
    try {
      const validation = validateMessage(data?.message);
      if (!validation.valid) {
        socket.emit(SocketEvents.ERROR, { error: validation.error, code: 'INVALID_MESSAGE' });
        return;
      }

      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) {
        socket.emit(SocketEvents.ERROR, { error: 'Not in a session', code: 'NOT_IN_SESSION' });
        return;
      }

      // Rate limit messages
      const allowed = await redisService.checkRateLimit(`msg:${userId}`, 10, 10000); // 10 msgs per 10 seconds
      if (!allowed) {
        socket.emit(SocketEvents.ERROR, { error: 'Sending too fast', code: 'RATE_LIMIT' });
        return;
      }

      const session = await redisService.getSession(sessionId);
      if (!session) {
        socket.emit(SocketEvents.ERROR, { error: 'Session not found', code: 'SESSION_NOT_FOUND' });
        return;
      }

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const partner = await redisService.getUser(partnerId);

      if (!partner) {
        socket.emit(SocketEvents.PARTNER_DISCONNECTED, { reason: 'Partner disconnected' });
        await matchingService.endSession(userId, sessionId);
        return;
      }

      // Update activity
      await redisService.updateUserActivity(userId);
      await redisService.incrementSessionMessages(sessionId);
      await databaseService.updateSessionMessageCount(sessionId);

      // Send message to partner
      this.io.to(partner.socketId).emit(SocketEvents.RECEIVE_MESSAGE, {
        message: data.message,
        timestamp: new Date(),
      });

      logger.debug('Message sent', { userId, partnerId, sessionId });
    } catch (error) {
      logger.error('Error handling send message', { error, userId });
      socket.emit(SocketEvents.ERROR, { error: 'Failed to send message', code: 'MESSAGE_ERROR' });
    }
  }

  private async handleTypingStart(socket: Socket, userId: string): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) return;

      const session = await redisService.getSession(sessionId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const partner = await redisService.getUser(partnerId);

      if (partner) {
        this.io.to(partner.socketId).emit(SocketEvents.TYPING_START);
      }
    } catch (error) {
      logger.error('Error handling typing start', { error, userId });
    }
  }

  private async handleTypingStop(socket: Socket, userId: string): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) return;

      const session = await redisService.getSession(sessionId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const partner = await redisService.getUser(partnerId);

      if (partner) {
        this.io.to(partner.socketId).emit(SocketEvents.TYPING_STOP);
      }
    } catch (error) {
      logger.error('Error handling typing stop', { error, userId });
    }
  }

  private async handleWebRTCOffer(socket: Socket, userId: string, data: any): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) return;

      const session = await redisService.getSession(sessionId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const partner = await redisService.getUser(partnerId);

      if (partner) {
        this.io.to(partner.socketId).emit(SocketEvents.WEBRTC_OFFER, {
          offer: data.offer,
          from: userId,
        });
        logger.debug('WebRTC offer sent', { userId, partnerId });
      }
    } catch (error) {
      logger.error('Error handling WebRTC offer', { error, userId });
    }
  }

  private async handleWebRTCAnswer(socket: Socket, userId: string, data: any): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) return;

      const session = await redisService.getSession(sessionId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const partner = await redisService.getUser(partnerId);

      if (partner) {
        this.io.to(partner.socketId).emit(SocketEvents.WEBRTC_ANSWER, {
          answer: data.answer,
          from: userId,
        });
        logger.debug('WebRTC answer sent', { userId, partnerId });
      }
    } catch (error) {
      logger.error('Error handling WebRTC answer', { error, userId });
    }
  }

  private async handleWebRTCIceCandidate(socket: Socket, userId: string, data: any): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) return;

      const session = await redisService.getSession(sessionId);
      if (!session) return;

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const partner = await redisService.getUser(partnerId);

      if (partner) {
        this.io.to(partner.socketId).emit(SocketEvents.WEBRTC_ICE_CANDIDATE, {
          candidate: data.candidate,
          from: userId,
        });
      }
    } catch (error) {
      logger.error('Error handling WebRTC ICE candidate', { error, userId });
    }
  }

  private async handleReportUser(socket: Socket, userId: string, data: any): Promise<void> {
    try {
      const validation = validateReportReason(data?.reason);
      if (!validation.valid) {
        socket.emit(SocketEvents.ERROR, { error: validation.error, code: 'INVALID_REASON' });
        return;
      }

      const sessionId = await redisService.getUserSession(userId);
      if (!sessionId) {
        socket.emit(SocketEvents.ERROR, { error: 'Not in a session', code: 'NOT_IN_SESSION' });
        return;
      }

      const session = await redisService.getSession(sessionId);
      if (!session) {
        socket.emit(SocketEvents.ERROR, { error: 'Session not found', code: 'SESSION_NOT_FOUND' });
        return;
      }

      const reportedUserId = session.user1Id === userId ? session.user2Id : session.user1Id;

      const report: Report = {
        id: uuidv4(),
        reporterId: userId,
        reportedUserId,
        sessionId,
        reason: data.reason,
        timestamp: new Date(),
        resolved: false,
      };

      await databaseService.createReport(report);
      await databaseService.logEvent('user_reported', userId, sessionId, { reportedUserId, reason: data.reason });

      socket.emit(SocketEvents.REPORT_SUBMITTED, { success: true });
      logger.info('User reported', { reporterId: userId, reportedUserId, sessionId });
    } catch (error) {
      logger.error('Error handling report user', { error, userId });
      socket.emit(SocketEvents.ERROR, { error: 'Failed to submit report', code: 'REPORT_ERROR' });
    }
  }

  private async handlePing(socket: Socket, userId: string): Promise<void> {
    await redisService.updateUserActivity(userId);
    socket.emit(SocketEvents.PONG);
  }

  private async handleStats(socket: Socket): Promise<void> {
    try {
      const stats: ServerStats = {
        activeUsers: await redisService.getActiveUsersCount(),
        activeSessions: await redisService.getActiveSessionsCount(),
        waitingUsers: await redisService.getQueueLength(),
        totalConnections: this.io.engine.clientsCount,
        uptime: process.uptime(),
      };

      socket.emit(SocketEvents.STATS, stats);
    } catch (error) {
      logger.error('Error handling stats request', error);
    }
  }

  private async handleDisconnect(socket: Socket, userId: string): Promise<void> {
    try {
      logger.info('User disconnected', { userId, socketId: socket.id });

      // Stop searching if searching
      const user = await redisService.getUser(userId);
      if (user?.isSearching) {
        await matchingService.stopSearch(userId);
      }

      // End session if in one
      const sessionId = await redisService.getUserSession(userId);
      if (sessionId) {
        const session = await redisService.getSession(sessionId);
        if (session) {
          const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
          const partner = await redisService.getUser(partnerId);

          if (partner) {
            this.io.to(partner.socketId).emit(SocketEvents.PARTNER_DISCONNECTED, {
              reason: 'Partner disconnected',
            });
          }

          await matchingService.endSession(userId, sessionId);
        }
      }

      // Clean up user data
      await redisService.deleteUser(userId);
      await redisService.deleteSocketUser(socket.id);

      await databaseService.logEvent('user_disconnected', userId);
    } catch (error) {
      logger.error('Error handling disconnect', { error, userId });
    }
  }
}
