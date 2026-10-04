import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const url = (process.env.DATABASE_URL || '').trim();
const isLocal =
  !url || url.includes('localhost') || url.includes('127.0.0.1');

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  (!isLocal && process.env.DATABASE_SSL !== 'false');

/** CLI migrations / seed. Runtime Equb is in-memory. */
export default new DataSource({
  type: 'postgres',
  url: url || undefined,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  extra: useSsl
    ? { max: 5, connectionTimeoutMillis: 10_000 }
    : undefined,
});
