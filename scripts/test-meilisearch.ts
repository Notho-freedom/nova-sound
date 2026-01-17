/**
 * Test Meilisearch connectivity
 * Usage: npx tsx scripts/test-meilisearch.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { MeiliSearch } from 'meilisearch';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const host = process.env.MEILI_HOST || process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILI_API_KEY || process.env.MEILISEARCH_API_KEY;

  if (!host) {
    throw new Error('MEILI_HOST/MEILISEARCH_HOST manquant');
  }

  const client = new MeiliSearch({ host, apiKey });
  const health = await client.health();
  if (health.status !== 'available') {
    console.error('❌ Meilisearch indisponible:', health.status);
    process.exit(1);
  }
  console.log('✅ Meilisearch OK');
}

main().catch((err) => {
  console.error('❌ Meilisearch test failed');
  process.exit(1);
});
