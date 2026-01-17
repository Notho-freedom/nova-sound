import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createErrorResponse, ErrorCodes, isValidationError, validateQuery } from '~/lib/validation';
import { getMeiliClient, getMeiliIndexName, isMeiliConfigured } from '~/lib/meilisearch';
import { startRequestSpan } from '~/lib/observability';
import { recordError, recordRequest } from '~/lib/metrics';
import { requireAuth } from '~/lib/authz';

const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required'),
  index: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: NextRequest) {
  const span = startRequestSpan(request, 'search.meilisearch');
  try {
    const { error, status } = await requireAuth(request);
    if (error) {
      const statusCode = status || 401;
      recordRequest('/search', 'GET', statusCode);
      span.end(statusCode);
      return error;
    }

    if (!isMeiliConfigured()) {
      const response = createErrorResponse(
        ErrorCodes.FEATURE_DISABLED,
        'Search is not configured.',
        501
      );
      recordRequest('/search', 'GET', 501);
      span.end(501);
      return response;
    }

    const validation = validateQuery(searchQuerySchema, request.nextUrl.searchParams);
    if (isValidationError(validation)) {
      const response = createErrorResponse(
        validation.error.code,
        validation.error.message,
        400,
        validation.error.details
      );
      recordRequest('/search', 'GET', 400);
      span.end(400);
      return response;
    }

    const { q, index, limit } = validation.data;
    const client = getMeiliClient();
    if (!client) {
      const response = createErrorResponse(
        ErrorCodes.FEATURE_DISABLED,
        'Search client unavailable.',
        503
      );
      recordRequest('/search', 'GET', 503);
      span.end(503);
      return response;
    }

    const indexName = getMeiliIndexName(index || 'tracks');
    const results = await client.index(indexName).search(q, {
      limit: limit ?? 20,
    });

    recordRequest('/search', 'GET', 200);
    span.end(200);
    return NextResponse.json(results);
  } catch (err) {
    recordError('/search');
    span.error(500, err);
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Search failed', 500);
  }
}
