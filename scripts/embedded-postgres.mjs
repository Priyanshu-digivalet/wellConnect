import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = new URL('../.pgdata', import.meta.url).pathname;
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'wellconnect',
  password: 'wellconnect',
  port: 5432,
  persistent: true,
});

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(`${databaseDir}/PG_VERSION`))) {
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase('wellconnect');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.toLowerCase().includes('already')) {
    throw error;
  }
}

console.log('postgres_ready');
setInterval(() => {}, 60_000);
