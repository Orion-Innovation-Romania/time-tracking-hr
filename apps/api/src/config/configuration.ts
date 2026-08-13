export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: number;
  refreshTtl: number;
}

export interface MailGraphEnvConfig {
  authority: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  senderMailbox: string;
  fromAddress: string;
  fromName: string;
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
  mail: MailGraphEnvConfig;
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
  mail: {
    authority:
      process.env.GRAPH_AUTHORITY ||
      'https://login.microsoftonline.com/adbbbd82-76e5-4952-8531-3cc59f3c1fdd/',
    clientId: process.env.GRAPH_CLIENT_ID || 'b903c612-e24c-4dfa-a9d2-5e907f492460',
    clientSecret: process.env.GRAPH_CLIENT_SECRET || '',
    scope: process.env.GRAPH_SCOPE || 'https://graph.microsoft.com/.default',
    senderMailbox: process.env.MAIL_SENDER_MAILBOX || 'dpd-rou.inventory-smb@orioninc.com',
    fromAddress: process.env.MAIL_FROM_ADDRESS || 'dpd-rou.inventory.no-reply@orioninc.com',
    fromName: process.env.MAIL_FROM_NAME || 'DPD-ROU-Hr-Recruitment',
  },
});
