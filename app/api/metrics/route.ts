import { NextRequest, NextResponse } from 'next/server';
import { getMetricsRemote } from '~/lib/metrics';
import { requireAuth } from '~/lib/authz';

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const metrics = await getMetricsRemote();
  return NextResponse.json(metrics);
}
