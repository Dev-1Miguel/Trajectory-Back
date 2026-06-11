import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { inspect } from 'node:util';
import * as sql from 'mssql';

import databaseConfig from '../config/database.config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly maxConnectionAttempts = 3;
  private readonly retryDelayMilliseconds = 1500;
  private readonly transientErrorCodes = new Set([
    'ETIMEDOUT',
    'ETIMEOUT',
    'ESOCKET',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
  ]);
  private pool: sql.ConnectionPool | null = null;
  private poolConnectPromise: Promise<sql.ConnectionPool> | null = null;

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly dbConfig: ConfigType<typeof databaseConfig>,
  ) {}

  async createRequest(): Promise<sql.Request> {
    const pool = await this.getPool();
    return pool.request();
  }

  async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool?.connected) {
      return this.pool;
    }

    if (this.poolConnectPromise) {
      return this.poolConnectPromise;
    }

    this.pool = new sql.ConnectionPool(this.createPoolConfig());
    this.poolConnectPromise = this.connectWithRetry(this.pool)
      .then((connectedPool) => {
        this.logger.log('SQL Server connection pool established');
        return connectedPool;
      })
      .catch((error: unknown) => {
        this.pool = null;
        this.poolConnectPromise = null;
        this.logger.error(
          'Could not connect to SQL Server',
          this.formatError(error),
        );
        throw error;
      });

    return this.poolConnectPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.close();
    this.pool = null;
    this.poolConnectPromise = null;
    this.logger.log('SQL Server connection pool closed');
  }

  private createPoolConfig(): sql.config {
    const config: sql.config = {
      server: this.dbConfig.host,
      port: this.dbConfig.port,
      database: this.dbConfig.database,
      user: this.dbConfig.user,
      password: this.dbConfig.password,
      connectionTimeout: 40000,
      options: {
        encrypt: this.dbConfig.encrypt,
        trustServerCertificate: this.dbConfig.trustServerCertificate,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    if (this.dbConfig.instanceName) {
      delete config.port;
      config.options = {
        ...config.options,
        instanceName: this.dbConfig.instanceName,
      };
    }

    return config;
  }

  private async connectWithRetry(
    pool: sql.ConnectionPool,
  ): Promise<sql.ConnectionPool> {
    for (let attempt = 1; attempt <= this.maxConnectionAttempts; attempt += 1) {
      try {
        return await pool.connect();
      } catch (error: unknown) {
        const canRetry =
          attempt < this.maxConnectionAttempts && this.isTransientError(error);

        if (!canRetry) {
          throw error;
        }

        this.logger.warn(
          `SQL Server connection attempt ${attempt} failed with transient error. Retrying in ${this.retryDelayMilliseconds}ms.`,
        );
        await this.delay(this.retryDelayMilliseconds);
      }
    }

    throw new Error('SQL Server connection retry loop exited unexpectedly');
  }

  private isTransientError(error: unknown): boolean {
    const codes = this.collectErrorCodes(error);

    return codes.some((code) => this.transientErrorCodes.has(code));
  }

  private collectErrorCodes(error: unknown): string[] {
    if (!error || typeof error !== 'object') {
      return [];
    }

    const codes: string[] = [];
    const errorRecord = error as Record<string, unknown>;

    if (typeof errorRecord.code === 'string') {
      codes.push(errorRecord.code);
    }

    if (typeof errorRecord.errno === 'string') {
      codes.push(errorRecord.errno);
    }

    if ('originalError' in errorRecord) {
      codes.push(...this.collectErrorCodes(errorRecord.originalError));
    }

    if ('precedingErrors' in errorRecord) {
      const precedingErrors = errorRecord.precedingErrors;

      if (Array.isArray(precedingErrors)) {
        for (const precedingError of precedingErrors) {
          codes.push(...this.collectErrorCodes(precedingError));
        }
      }
    }

    return codes;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const originalError =
        'originalError' in error ? inspect(error.originalError) : undefined;

      return [error.stack, originalError].filter(Boolean).join('\n');
    }

    return inspect(error, { depth: null });
  }
}
