import { v4 as uuidv4 } from 'uuid';
import redisService from './redis.service';
import databaseService from './database.service';
import logger from '../utils/logger';
import { User, MatchRequest } from '../types';

class MatchingService {
  private matchingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async startSearch(user: User): Promise<void> {
    try {
      // Mark user as searching
      user.isSearching = true;
      await redisService.setUser(user.id, user);

      // Try to find an immediate match
      const match = await redisService.findMatch(user.interests);

      if (match && match.userId !== user.id) {
        // Found a match!
        await this.createMatch(user, match);
      } else {
        // Add to queue and wait
        const request: MatchRequest = {
          userId: user.id,
          interests: user.interests,
          timestamp: new Date(),
        };

        await redisService.addToMatchQueue(request);
        logger.info('User added to match queue', { userId: user.id, interests: user.interests });

        // Set timeout for matching
        this.setMatchTimeout(user.id);
      }
    } catch (error) {
      logger.error('Error in startSearch', { error, userId: user.id });
      throw error;
    }
  }

  async stopSearch(userId: string): Promise<void> {
    try {
      const user = await redisService.getUser(userId);
      if (!user) return;

      // Clear timeout
      this.clearMatchTimeout(userId);

      // Remove from queue
      await redisService.removeFromMatchQueue(userId, user.interests);

      // Update user status
      user.isSearching = false;
      await redisService.setUser(userId, user);

      logger.info('User stopped searching', { userId });
    } catch (error) {
      logger.error('Error in stopSearch', { error, userId });
    }
  }

  private async createMatch(user: User, matchRequest: MatchRequest): Promise<{ sessionId: string; partnerId: string } | null> {
    try {
      const partner = await redisService.getUser(matchRequest.userId);
      if (!partner) {
        logger.warn('Partner not found', { partnerId: matchRequest.userId });
        return null;
      }

      // Clear matching timeouts
      this.clearMatchTimeout(user.id);
      this.clearMatchTimeout(partner.id);

      // Create session
      const sessionId = uuidv4();
      await redisService.createSession(sessionId, user.id, partner.id);

      // Update users
      user.isSearching = false;
      user.partnerId = partner.id;
      partner.isSearching = false;
      partner.partnerId = user.id;

      await redisService.setUser(user.id, user);
      await redisService.setUser(partner.id, partner);

      // Log to database
      await databaseService.logSession(sessionId, user.id, partner.id, user.interests, partner.interests);
      await databaseService.logEvent('match_created', user.id, sessionId, {
        interests: user.interests,
        partnerInterests: partner.interests,
      });

      logger.info('Match created', {
        sessionId,
        user1: user.id,
        user2: partner.id,
        commonInterests: user.interests.filter(i => partner.interests.includes(i)),
      });

      return { sessionId, partnerId: partner.id };
    } catch (error) {
      logger.error('Error creating match', { error, userId: user.id });
      return null;
    }
  }

  async endSession(userId: string, sessionId: string): Promise<void> {
    try {
      const session = await redisService.getSession(sessionId);
      if (!session) {
        logger.warn('Session not found', { sessionId });
        return;
      }

      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;

      // Update users
      const user = await redisService.getUser(userId);
      const partner = await redisService.getUser(partnerId);

      if (user) {
        user.partnerId = undefined;
        user.isSearching = false;
        await redisService.setUser(userId, user);
      }

      if (partner) {
        partner.partnerId = undefined;
        partner.isSearching = false;
        await redisService.setUser(partnerId, partner);
      }

      // Log session end
      await databaseService.updateSessionEnd(sessionId, session.messageCount);
      await databaseService.logEvent('session_ended', userId, sessionId);

      // Delete session
      await redisService.deleteSession(sessionId);

      logger.info('Session ended', { sessionId, userId, partnerId });
    } catch (error) {
      logger.error('Error ending session', { error, userId, sessionId });
    }
  }

  async skipPartner(userId: string): Promise<void> {
    try {
      const sessionId = await redisService.getUserSession(userId);
      if (sessionId) {
        await this.endSession(userId, sessionId);
      }

      const user = await redisService.getUser(userId);
      if (user) {
        await databaseService.logEvent('partner_skipped', userId);
        // Automatically start new search
        await this.startSearch(user);
      }
    } catch (error) {
      logger.error('Error skipping partner', { error, userId });
    }
  }

  private setMatchTimeout(userId: string): void {
    const timeout = setTimeout(async () => {
      logger.info('Match timeout reached', { userId });
      await this.stopSearch(userId);

      const user = await redisService.getUser(userId);
      if (user) {
        // Notify user that no match was found
        logger.info('No match found for user', { userId });
      }
    }, 60000); // 60 second timeout

    this.matchingTimeouts.set(userId, timeout);
  }

  private clearMatchTimeout(userId: string): void {
    const timeout = this.matchingTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.matchingTimeouts.delete(userId);
    }
  }

  async getMatchingStats(): Promise<any> {
    try {
      const queueLength = await redisService.getQueueLength();
      const activeUsers = await redisService.getActiveUsersCount();
      const activeSessions = await redisService.getActiveSessionsCount();

      return {
        queueLength,
        activeUsers,
        activeSessions,
        waitingUsers: queueLength,
      };
    } catch (error) {
      logger.error('Error getting matching stats', error);
      return null;
    }
  }

  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.matchingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.matchingTimeouts.clear();
  }
}

export default new MatchingService();
