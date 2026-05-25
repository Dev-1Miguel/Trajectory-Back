const bcrypt = require('bcrypt');

const password = process.env.AUTH_HASH_PASSWORD;
const correo = process.env.AUTH_HASH_CORREO;
const saltRounds = Number(process.env.AUTH_HASH_SALT_ROUNDS || 10);

if (!password || !correo) {
  console.error(
    [
      'Faltan variables requeridas.',
      'PowerShell:',
      "  $env:AUTH_HASH_PASSWORD='123456'",
      "  $env:AUTH_HASH_CORREO='miguel.andrade@email.com'",
      '  npm run auth:hash',
    ].join('\n'),
  );
  process.exit(1);
}

if (!Number.isInteger(saltRounds) || saltRounds < 10) {
  console.error('AUTH_HASH_SALT_ROUNDS debe ser un entero mayor o igual a 10.');
  process.exit(1);
}

const escapeSqlString = (value) => value.replace(/'/g, "''");

async function main() {
  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Hash bcrypt generado. Ejecuta este UPDATE en SQL Server:');
  console.log('');
  console.log('UPDATE Soporte.Usuario');
  console.log(`SET PasswordHash = N'${escapeSqlString(hash)}',`);
  console.log('    FechaModificacion = SYSDATETIME()');
  console.log(`WHERE Correo = N'${escapeSqlString(correo)}';`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
