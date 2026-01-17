import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import yaml from 'yaml';

const openapiPath = path.resolve(process.cwd(), 'docs', 'openapi.yaml');
const appApiDir = path.resolve(process.cwd(), 'app', 'api');

function toRouteSegment(segment: string): string {
  if (segment.startsWith('{') && segment.endsWith('}')) {
    return `[${segment.slice(1, -1)}]`;
  }
  return segment;
}

function resolveRouteFile(apiPath: string): string {
  const segments = apiPath.split('/').filter(Boolean).map(toRouteSegment);
  return path.join(appApiDir, ...segments, 'route.ts');
}

describe('OpenAPI contract', () => {
  it('maps all OpenAPI paths to Next.js route files', () => {
    if (!fs.existsSync(openapiPath)) {
      throw new Error(`OpenAPI spec not found at ${openapiPath}`);
    }

    const raw = fs.readFileSync(openapiPath, 'utf-8');
    const spec = yaml.parse(raw) as { paths?: Record<string, unknown> };
    const paths = Object.keys(spec.paths || {});

    const missing: string[] = [];

    for (const apiPath of paths) {
      const routeFile = resolveRouteFile(apiPath);
      const routeFileJs = routeFile.replace(/\.ts$/, '.js');
      if (!fs.existsSync(routeFile) && !fs.existsSync(routeFileJs)) {
        missing.push(`${apiPath} -> ${path.relative(process.cwd(), routeFile)}`);
      }
    }

    expect(missing, `Missing route files:\n${missing.join('\n')}`).toEqual([]);
  });
});
