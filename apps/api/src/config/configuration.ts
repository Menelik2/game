export default () => {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  const isLocal =
    !databaseUrl ||
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1');

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    API_PREFIX: process.env.API_PREFIX || 'api',
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
    CORS_ORIGINS:
      process.env.CORS_ORIGINS ||
      process.env.APP_URL ||
      'http://localhost:3000,http://localhost:3002,https://abelgame.vercel.app',
    API_URL: process.env.API_URL || 'http://localhost:3001',
    DEMO_MODE: process.env.DEMO_MODE !== 'false',
    REAL_MONEY_ENABLED: process.env.REAL_MONEY_ENABLED === 'true',
    DATABASE_URL: databaseUrl,
    DATABASE_SSL:
      process.env.DATABASE_SSL === 'true' ||
      (!isLocal && process.env.DATABASE_SSL !== 'false'),
    REDIS_URL: process.env.REDIS_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-insecure-change-me-equb',
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET || 'dev-insecure-refresh-equb',
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || 'localhost',
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
    RATE_LIMIT_TTL: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    RATE_LIMIT_LIMIT: parseInt(process.env.RATE_LIMIT_LIMIT || '200', 10),
    SEED_DEMO_CREDITS: parseInt(process.env.SEED_DEMO_CREDITS || '10000', 10),
  };
};
