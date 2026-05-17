const fs = require('node:fs');
const path = require('node:path');
const sql = require('msnodesqlv8');

const envPath = path.join(process.cwd(), '.env');

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

const host = process.env.DB_HOST || 'localhost';
const instance = process.env.DB_INSTANCE;
const database = process.env.DB_NAME || 'Trayectoria';
const server = instance ? `${host}\\${instance}` : host;
const pipeServer = instance
  ? `np:\\\\.\\pipe\\MSSQL$${instance}\\sql\\query`
  : undefined;

const cases = [
  {
    name: 'ODBC 17 - instancia - trusted',
    connectionString: [
      'Driver={ODBC Driver 17 for SQL Server}',
      `Server=${server}`,
      `Database=${database}`,
      'Trusted_Connection=Yes',
      'Connection Timeout=5',
    ].join(';'),
  },
  pipeServer && {
    name: 'ODBC 17 - named pipe - trusted',
    connectionString: [
      'Driver={ODBC Driver 17 for SQL Server}',
      `Server=${pipeServer}`,
      `Database=${database}`,
      'Trusted_Connection=Yes',
      'Connection Timeout=5',
    ].join(';'),
  },
  {
    name: 'ODBC 17 - instancia - SSPI',
    connectionString: [
      'Driver={ODBC Driver 17 for SQL Server}',
      `Server=${server}`,
      `Database=${database}`,
      'Integrated Security=SSPI',
      'Connection Timeout=5',
    ].join(';'),
  },
  {
    name: 'ODBC 18 - instancia - trusted',
    connectionString: [
      'Driver={ODBC Driver 18 for SQL Server}',
      `Server=${server}`,
      `Database=${database}`,
      'Trusted_Connection=Yes',
      'Connection Timeout=5',
    ].join(';'),
  },
  pipeServer && {
    name: 'ODBC 18 - named pipe - trusted',
    connectionString: [
      'Driver={ODBC Driver 18 for SQL Server}',
      `Server=${pipeServer}`,
      `Database=${database}`,
      'Trusted_Connection=Yes',
      'Connection Timeout=5',
    ].join(';'),
  },
].filter(Boolean);

const stringifyError = (error) =>
  JSON.stringify(error, Object.getOwnPropertyNames(error), 2);

const runCase = (testCase) =>
  new Promise((resolve) => {
    sql.open(testCase.connectionString, (error, connection) => {
      console.log(`\n=== ${testCase.name} ===`);

      if (error) {
        console.log(stringifyError(error));
        resolve(false);
        return;
      }

      connection.query('SELECT DB_NAME() AS databaseName', (queryError, rows) => {
        if (queryError) {
          console.log(stringifyError(queryError));
          connection.close(() => resolve(false));
          return;
        }

        console.log('Conexion OK');
        console.log(rows);
        connection.close(() => resolve(true));
      });
    });
  });

(async () => {
  let connected = false;

  for (const testCase of cases) {
    // eslint-disable-next-line no-await-in-loop
    connected = (await runCase(testCase)) || connected;
  }

  process.exitCode = connected ? 0 : 1;
})();
