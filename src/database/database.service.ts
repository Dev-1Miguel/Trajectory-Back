import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { inspect } from 'node:util';
import * as sql from 'mssql/msnodesqlv8';

import databaseConfig from '../config/database.config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
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
    this.poolConnectPromise = this.pool
      .connect()
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

  private createPoolConfig(): sql.config & { connectionString?: string } {
    return {
      driver: 'msnodesqlv8',
      server: this.dbConfig.host,
      database: this.dbConfig.database,
      connectionString: this.createConnectionString(),
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
  }

  private createConnectionString(): string {
    const values = [
      ['Driver', `{${this.dbConfig.driver}}`],
      ['Server', this.getServerValue()],
      ['Database', this.dbConfig.database],
    ];

    if (this.dbConfig.trustedConnection) {
      values.push(['Trusted_Connection', 'Yes']);
    } else {
      values.push(['Uid', this.dbConfig.user ?? '']);
      values.push(['Pwd', this.dbConfig.password ?? '']);
    }

    if (this.dbConfig.encrypt) {
      values.push(['Encrypt', 'Yes']);
      values.push([
        'TrustServerCertificate',
        this.dbConfig.trustServerCertificate ? 'Yes' : 'No',
      ]);
    }

    return values.map(([key, value]) => `${key}=${value}`).join(';');
  }

  private getServerValue(): string {
    if (this.dbConfig.useNamedPipe && this.dbConfig.instanceName) {
      return `np:\\\\.\\pipe\\MSSQL$${this.dbConfig.instanceName}\\sql\\query`;
    }

    if (this.dbConfig.instanceName) {
      return `${this.dbConfig.host}\\${this.dbConfig.instanceName}`;
    }

    return `${this.dbConfig.host},${this.dbConfig.port}`;
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
