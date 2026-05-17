import { registerAs } from '@nestjs/config';

const parseBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
};

const parsePort = (value: string | undefined): number => {
  const parsedPort = Number(value);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 1433;
};

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parsePort(process.env.DB_PORT),
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || 'Trayectoria',
  instanceName: process.env.DB_INSTANCE || undefined,
  driver: process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server',
  encrypt: parseBoolean(process.env.DB_ENCRYPT, false),
  trustServerCertificate: parseBoolean(
    process.env.DB_TRUST_SERVER_CERTIFICATE,
    true,
  ),
  trustedConnection: parseBoolean(process.env.DB_TRUSTED_CONNECTION, false),
  useNamedPipe: parseBoolean(process.env.DB_USE_NAMED_PIPE, false),
}));
