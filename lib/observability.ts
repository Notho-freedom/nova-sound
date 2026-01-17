import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

interface RequestSpan {
  end: (status: number) => void;
  error: (status: number, error: unknown) => void;
}

function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || randomUUID();
}

export function startRequestSpan(request: NextRequest, name: string): RequestSpan {
  const requestId = getRequestId(request);
  const start = Date.now();

  console.info(JSON.stringify({
    event: 'request.start',
    requestId,
    name,
    method: request.method,
    path: request.nextUrl?.pathname,
    timestamp: new Date().toISOString(),
  }));

  const end = (status: number) => {
    const durationMs = Date.now() - start;
    console.info(JSON.stringify({
      event: 'request.end',
      requestId,
      name,
      method: request.method,
      path: request.nextUrl?.pathname,
      status,
      durationMs,
      timestamp: new Date().toISOString(),
    }));
  };

  const error = (status: number, err: unknown) => {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: 'request.error',
      requestId,
      name,
      method: request.method,
      path: request.nextUrl?.pathname,
      status,
      durationMs,
      message,
      timestamp: new Date().toISOString(),
    }));
  };

  return { end, error };
}
