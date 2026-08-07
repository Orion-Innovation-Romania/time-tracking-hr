export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: number;
  refreshTtl: number;
}

export interface AppConfiguration {
  port: number;
  tz: string;
  jwt: JwtConfig;
  cookieSecure: boolean;
  login: { maxAttempts: number; lockMinutes: number };
  usersConfigPath: string;
  uploadTmpDir: string;
  retentionMonths: number;
}

export default (): AppConfiguration => ({
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  tz: process.env.TZ ?? 'Europe/Bucharest',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '604800', 10),
  },
  cookieSecure: (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
  login: {
    maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? '5', 10),
    lockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES ?? '15', 10),
  },
  usersConfigPath: process.env.USERS_CONFIG_PATH ?? './config/users.yml',
  uploadTmpDir: process.env.UPLOAD_TMP_DIR ?? './.uploads',
  retentionMonths: parseInt(process.env.DATA_RETENTION_MONTHS ?? '24', 10),
});
