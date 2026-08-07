import { neon } from '@neondatabase/serverless';

export function getDatabase() {
  const databaseUrl =
    process.env['DATABASE_URL'] ??
    process.env['POSTGRES_URL'] ??
    process.env['NEON_DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }

  return neon(databaseUrl);
}

export function isMissingTable(error: unknown): boolean {
  return (error as { code?: string })?.code === '42P01';
}
