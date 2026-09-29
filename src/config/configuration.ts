export default function configuration() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '1mb',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    authDevMode: process.env.AUTH_DEV_MODE === 'true',
    demoMode: (process.env.DEMO_MODE ?? 'true') === 'true',
    aiProvider: process.env.AI_PROVIDER ?? 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ?? '',
    quietHoursStart: parseInt(process.env.QUIET_HOURS_START ?? '22', 10),
    quietHoursEnd: parseInt(process.env.QUIET_HOURS_END ?? '7', 10),
    recommendationCooldownHours: parseInt(
      process.env.RECOMMENDATION_COOLDOWN_HOURS ?? '20',
      10,
    ),
    notificationCooldownHours: parseInt(
      process.env.NOTIFICATION_COOLDOWN_HOURS ?? '4',
      10,
    ),
    recommendationTtlHours: parseInt(
      process.env.RECOMMENDATION_TTL_HOURS ?? '24',
      10,
    ),
  };
}

export type AppConfiguration = ReturnType<typeof configuration>;
