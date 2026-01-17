import { MeiliSearch } from 'meilisearch';

const MEILI_HOST = process.env.MEILI_HOST || process.env.MEILISEARCH_HOST;
const MEILI_API_KEY = process.env.MEILI_API_KEY || process.env.MEILISEARCH_API_KEY;
const MEILI_INDEX_PREFIX =
  process.env.MEILI_INDEX_PREFIX || process.env.MEILISEARCH_INDEX_PREFIX || 'nexus';

export function isMeiliConfigured(): boolean {
  return Boolean(MEILI_HOST);
}

export function getMeiliClient(): MeiliSearch | null {
  if (!MEILI_HOST) return null;
  return new MeiliSearch({
    host: MEILI_HOST,
    apiKey: MEILI_API_KEY,
  });
}

export function getMeiliIndexName(name: string): string {
  const prefix = MEILI_INDEX_PREFIX?.trim();
  if (!prefix) return name;
  return `${prefix}_${name}`;
}
