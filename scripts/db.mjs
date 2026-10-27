import { loadEnvFile } from 'node:process';
import pg from 'pg';

export function environment() {
  loadEnvFile('.env.local');
  return process.env;
}

export async function connectDatabase() {
  const env = environment();
  const url = new URL(env.POOLER_URL || env.DATABASE_URL);
  if (!url.href.includes('rceoboibijmwtxmevash')) throw new Error('Unexpected database project');
  // Avoid pg URL parameters replacing the explicit TLS settings below.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const client = new pg.Client({
    connectionString: url.href,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: env.DB_ALLOW_INSECURE_TLS !== '1' },
  });
  await client.connect();
  return client;
}
