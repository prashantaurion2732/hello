import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import logger from '../utils/logger';
import { Report } from '../types';

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('PostgreSQL connected successfully');
      client.release();
      await this.initializeTables();
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    logger.info('PostgreSQL pool closed');
  }

  private async initializeTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          user1_id VARCHAR(255) NOT NULL,
          user2_id VARCHAR(255) NOT NULL,
          started_at TIMESTAMP NOT NULL DEFAULT NOW(),
          ended_at TIMESTAMP,
          message_count INTEGER DEFAULT 0,
          user1_interests TEXT[],
          user2_interests TEXT[],
          duration_seconds INTEGER
        )
      `);

      // Reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id VARCHAR(255) PRIMARY KEY,
          reporter_id VARCHAR(255) NOT NULL,
          reported_user_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255),
          reason TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          resolved BOOLEAN DEFAULT FALSE,
          resolved_at TIMESTAMP,
          resolved_by VARCHAR(255),
          notes TEXT
        )
      `);

      // System logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_logs (
          id SERIAL PRIMARY KEY,
          level VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(100) NOT NULL,
          user_id VARCHAR(255),
          session_id VARCHAR(255),
          metadata JSONB,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_user1 ON sessions(user1_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user2 ON sessions(user2_id);
        CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp);
        CREATE INDEX IF NOT EXISTS idx_reports_resolved ON reports(resolved);
        CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
        CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
      `);

      await client.query('COMMIT');
      logger.info('Database tables initialized successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to initialize database tables', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Session logging
  async logSession(
    sessionId: string,
    user1Id: string,
    user2Id: string,
    user1Interests: string[],
    user2Interests: string[]
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO sessions (id, user1_id, user2_id, user1_interests, user2_interests)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, user1Id, user2Id, user1Interests, user2Interests]
      );
    } catch (error) {
      logger.error('Failed to log session', { error, sessionId });
    }
  }

  async updateSessionEnd(sessionId: string, messageCount: number): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE sessions
         SET ended_at = NOW(),
             message_count = $1,
             duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
         WHERE id = $2`,
        [messageCount, sessionId]
      );
    } catch (error) {
      logger.error('Failed to update session end', { error, sessionId });
    }
  }

  async updateSessionMessageCount(sessionId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE sessions SET message_count = message_count + 1 WHERE id = $1`,
        [sessionId]
      );
    } catch (error) {
      logger.error('Failed to update session message count', { error, sessionId });
    }
  }

  // Reports
  async createReport(report: Report): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO reports (id, reporter_id, reported_user_id, session_id, reason, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [report.id, report.reporterId, report.reportedUserId, report.sessionId, report.reason, report.timestamp]
      );
      logger.info('Report created', { reportId: report.id });
    } catch (error) {
      logger.error('Failed to create report', { error, reportId: report.id });
      throw error;
    }
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM reports WHERE reported_user_id = $1 ORDER BY timestamp DESC`,
        [userId]
      );
      return result.rows.map(row => ({
        id: row.id,
        reporterId: row.reporter_id,
        reportedUserId: row.reported_user_id,
        sessionId: row.session_id,
        reason: row.reason,
        timestamp: row.timestamp,
        resolved: row.resolved,
      }));
    } catch (error) {
      logger.error('Failed to get reports', { error, userId });
      return [];
    }
  }

  async getUnresolvedReports(limit: number = 100): Promise<Report[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM reports WHERE resolved = FALSE ORDER BY timestamp DESC LIMIT $1`,
        [limit]
      );
      return result.rows.map(row => ({
        id: row.id,
        reporterId: row.reporter_id,
        reportedUserId: row.reported_user_id,
        sessionId: row.session_id,
        reason: row.reason,
        timestamp: row.timestamp,
        resolved: row.resolved,
      }));
    } catch (error) {
      logger.error('Failed to get unresolved reports', error);
      return [];
    }
  }

  // Analytics
  async logEvent(eventType: string, userId?: string, sessionId?: string, metadata?: any): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO analytics (event_type, user_id, session_id, metadata)
         VALUES ($1, $2, $3, $4)`,
        [eventType, userId, sessionId, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      logger.error('Failed to log analytics event', { error, eventType });
    }
  }

  // Statistics
  async getSessionStats(startDate: Date, endDate: Date): Promise<any> {
    try {
      const result = await this.pool.query(
        `SELECT
          COUNT(*) as total_sessions,
          AVG(duration_seconds) as avg_duration,
          AVG(message_count) as avg_messages,
          COUNT(DISTINCT user1_id) + COUNT(DISTINCT user2_id) as unique_users
         FROM sessions
         WHERE started_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get session stats', error);
      return null;
    }
  }

  async getSystemHealth(): Promise<any> {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return { healthy: true, timestamp: result.rows[0].now };
    } catch (error) {
      logger.error('Database health check failed', error);
      return { healthy: false, error: error };
    }
  }
}

export default new DatabaseService();
