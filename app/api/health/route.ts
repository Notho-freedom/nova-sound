import { NextResponse } from 'next/server';
import { qstash } from '@/lib/qstash-helpers';
import { redis } from '@/lib/redis';

async function ensureQStashSchedules(): Promise<void> {
  try {
    const lock = await redis.set('qstash:schedules:boot', new Date().toISOString(), {
      nx: true,
      ex: 60 * 60 * 24,
    });

    if (!lock) return;

    await qstash.schedule.daily('daily-cleanup', { daysToKeep: 30 });
    await qstash.schedule.hourly('stats-aggregation', {});
  } catch {
    // Non-blocking schedule failure
  }
}

export async function GET() {
  void ensureQStashSchedules();
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
}

