/**
 * Test Sentry connectivity
 * Usage: npx tsx scripts/test-sentry.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import * as Sentry from '@sentry/node';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!dsn) {
  console.error('❌ SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN manquant');
  process.exit(1);
}

Sentry.init({
  dsn,
  environment: 'test',
  enabled: true,
  tracesSampleRate: 0.0,
});

async function main() {
  Sentry.captureMessage('Sentry test event from scripts/test-sentry.ts', 'info');
  await Sentry.flush(2000);
  console.log('✅ Sentry event sent');
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('❌ Sentry test failed:', message);
  process.exit(1);
});
