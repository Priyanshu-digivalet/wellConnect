export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const databaseUrl = stringValue(config.DATABASE_URL);
  const jwtSecret = stringValue(config.JWT_SECRET);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET is required and must be at least 16 characters');
  }

  return config;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
