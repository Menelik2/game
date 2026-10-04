/** Lightweight Postgres ping — no TypeORM required. */
export async function pingDatabase(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    return { configured: false, connected: false };
  }

  try {
    const { Client } = await import('pg');
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    const useSsl =
      process.env.DATABASE_SSL === 'true' ||
      (!isLocal && process.env.DATABASE_SSL !== 'false');

    const client = new Client({
      connectionString: url,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5_000,
    });

    await client.connect();
    await client.query('SELECT 1 AS ok');
    await client.end();
    return { configured: true, connected: true };
  } catch (e: any) {
    return {
      configured: true,
      connected: false,
      error: (e?.message || String(e)).slice(0, 200),
    };
  }
}
