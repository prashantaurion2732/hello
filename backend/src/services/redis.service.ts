import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';
import { User, MatchRequest } from '../types';

class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  // User management
  async setUser(userId: string, user: User): Promise<void> {
    await this.client.setEx(
      `user:${userId}`,
      config.session.timeoutMs / 1000,
      JSON.stringify(user)
    );
  }

  async getUser(userId: string): Promise<User | null> {
    const data = await this.client.get(`user:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.del(`user:${userId}`);
  }

  async updateUserActivity(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.lastActivity = new Date();
      await this.setUser(userId, user);
    }
  }

  // Socket ID to User ID mapping
  async setSocketUser(socketId: string, userId: string): Promise<void> {
    await this.client.setEx(
      `socket:${socketId}`,
      config.session.timeoutMs / 1000,
      userId
    );
  }

  async getUserBySocket(socketId: string): Promise<string | null> {
    return await this.client.get(`socket:${socketId}`);
  }

  async deleteSocketUser(socketId: string): Promise<void> {
    await this.client.del(`socket:${socketId}`);
  }

  // Matching queue management
  async addToMatchQueue(request: MatchRequest): Promise<void> {
    const key = request.interests.length > 0
      ? `queue:${request.interests.sort().join(',')}`
      : 'queue:general';

    await this.client.lPush(key, JSON.stringify(request));
    await this.client.expire(key, config.session.matchingTimeoutMs / 1000);
  }

  async findMatch(interests: string[]): Promise<MatchRequest | null> {
    // Try exact interest match first
    if (interests.length > 0) {
      const key = `queue:${interests.sort().join(',')}`;
      const data = await this.client.rPop(key);
      if (data) {
        return JSON.parse(data);
      }

      // Try partial matches (any common interest)
      const keys = await this.client.keys('queue:*');
      for (const queueKey of keys) {
        if (queueKey === 'queue:general') continue;

        const queueInterests = queueKey.replace('queue:', '').split(',');
        const hasCommonInterest = interests.some(i => queueInterests.includes(i));

        if (hasCommonInterest) {
          const data = await this.client.rPop(queueKey);
          if (data) {
            return JSON.parse(data);
          }
        }
      }
    }

    // Fall back to general queue
    const data = await this.client.rPop('queue:general');
    return data ? JSON.parse(data) : null;
  }

  async removeFromMatchQueue(userId: string, interests: string[]): Promise<void> {
    const keys = interests.length > 0
      ? [`queue:${interests.sort().join(',')}`, 'queue:general']
      : ['queue:general'];

    for (const key of keys) {
      const length = await this.client.lLen(key);
      for (let i = 0; i < length; i++) {
        const item = await this.client.lIndex(key, i);
        if (item) {
          const request: MatchRequest = JSON.parse(item);
          if (request.userId === userId) {
            await this.client.lRem(key, 1, item);
            break;
          }
        }
      }
    }
  }

  async getQueueLength(): Promise<number> {
    const keys = await this.client.keys('queue:*');
    let total = 0;
    for (const key of keys) {
      total += await this.client.lLen(key);
    }
    return total;
  }

  // Session management
  async createSession(sessionId: string, user1Id: string, user2Id: string): Promise<void> {
    const session = {
      id: sessionId,
      user1Id,
      user2Id,
      startedAt: new Date().toISOString(),
      messageCount: 0,
    };
    await this.client.setEx(
      `session:${sessionId}`,
      config.session.timeoutMs / 1000,
      JSON.stringify(session)
    );
    await this.client.setEx(`user:${user1Id}:session`, config.session.timeoutMs / 1000, sessionId);
    await this.client.setEx(`user:${user2Id}:session`, config.session.timeoutMs / 1000, sessionId);
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async getUserSession(userId: string): Promise<string | null> {
    return await this.client.get(`user:${userId}:session`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.client.del(`session:${sessionId}`);
      await this.client.del(`user:${session.user1Id}:session`);
      await this.client.del(`user:${session.user2Id}:session`);
    }
  }

  async incrementSessionMessages(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.messageCount++;
      await this.client.setEx(
        `session:${sessionId}`,
        config.session.timeoutMs / 1000,
        JSON.stringify(session)
      );
    }
  }

  // Statistics
  async getActiveUsersCount(): Promise<number> {
    const keys = await this.client.keys('user:*');
    return keys.filter(k => !k.includes(':session')).length;
  }

  async getActiveSessionsCount(): Promise<number> {
    const keys = await this.client.keys('session:*');
    return keys.length;
  }

  // Rate limiting helper
  async checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<boolean> {
    const key = `ratelimit:${identifier}`;
    const current = await this.client.incr(key);

    if (current === 1) {
      await this.client.expire(key, Math.ceil(windowMs / 1000));
    }

    return current <= limit;
  }

  // Clean up expired data
  async cleanup(): Promise<void> {
    logger.info('Running Redis cleanup...');

    // Clean up expired users
    const userKeys = await this.client.keys('user:*');
    for (const key of userKeys) {
      const ttl = await this.client.ttl(key);
      if (ttl === -1) {
        await this.client.del(key);
      }
    }

    logger.info('Redis cleanup completed');
  }
}

export default new RedisService();
