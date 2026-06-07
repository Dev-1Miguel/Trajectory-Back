const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const envPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    process.env[key] = value;
  }
}

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
};

const parsePort = (value) => {
  const parsedPort = Number(value);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 1433;
};

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: parsePort(process.env.DB_PORT),
  database: process.env.DB_NAME || 'Trayectoria',
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  options: {
    encrypt: parseBoolean(process.env.DB_ENCRYPT, false),
    trustServerCertificate: parseBoolean(
      process.env.DB_TRUST_SERVER_CERTIFICATE,
      true,
    ),
  },
};

if (process.env.DB_INSTANCE) {
  delete config.port;
  config.options.instanceName = process.env.DB_INSTANCE;
}

(async () => {
  let pool;

  try {
    pool = await sql.connect(config);
    const result = await pool.request().query('SELECT DB_NAME() AS databaseName');
    console.log('Conexion OK');
    console.log(result.recordset);
  } catch (error) {
    console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
})();
