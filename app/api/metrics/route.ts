import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '~/lib/metrics';
import { requireAuth } from '~/lib/authz';

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) {
    return error;
  }

  return NextResponse.json(getMetrics());
}
