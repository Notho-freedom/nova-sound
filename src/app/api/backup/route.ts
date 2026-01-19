import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const MAX_BACKUPS = 10;
const BACKUP_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getKeys(userId: string) {
  const base = `backup:${userId}`;
  return {
    indexKey: `${base}:index`,
    latestKey: `${base}:latest`,
    itemPrefix: `${base}:item`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, data, playlists, mode } = body ?? {};

    if (!userId || !data) {
      return NextResponse.json({ error: "userId and data are required" }, { status: 400 });
    }

    if (!redis) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }

    const redisClient = redis;
    const timestamp = Date.now();
    const backupId = `backup_appdata_${timestamp}`;
    const backup = {
      id: backupId,
      data,
      playlists,
      backupCreatedAt: new Date(timestamp).toISOString(),
      backupTimestamp: timestamp,
      version: data?.version ?? 1,
    };

    const { indexKey, latestKey, itemPrefix } = getKeys(userId);
    const itemKey = `${itemPrefix}:${backupId}`;

    // Always update latest snapshot
    await redisClient.setex(latestKey, BACKUP_TTL_SECONDS, JSON.stringify(backup));

    if (mode === "backup") {
      if (itemKey) {
        await redisClient.setex(itemKey, BACKUP_TTL_SECONDS, JSON.stringify(backup));
      }

      await redisClient.zadd(indexKey, { score: timestamp, member: backupId });

      const count = await redisClient.zcard(indexKey);
      if (count > MAX_BACKUPS) {
        const excess = count - MAX_BACKUPS;
        const oldIds = await redisClient.zrange(indexKey, 0, excess - 1);
        if (oldIds.length > 0) {
          await redisClient.zrem(indexKey, ...oldIds);
          const oldKeys = oldIds.map(id => `${itemPrefix}:${String(id)}`);
          await redisClient.del(...oldKeys);
        }
      }
    }

    return NextResponse.json({ success: true, backupId, timestamp });
  } catch (error: unknown) {
    console.error("[Backup API] Error creating backup:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save backup" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const backupId = searchParams.get("backupId");
    const list = searchParams.get("list") === "1";

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!redis) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }

    const redisClient = redis;
    const { indexKey, latestKey, itemPrefix } = getKeys(userId);

    if (backupId) {
      const backupRaw = await redisClient.get(`${itemPrefix}:${backupId}`);
      if (!backupRaw) {
        return NextResponse.json({ backup: null }, { status: 404 });
      }
      return NextResponse.json({ backup: JSON.parse(backupRaw as string) });
    }

    if (list) {
      const ids = await redisClient.zrange(indexKey, 0, MAX_BACKUPS - 1, { rev: true });
      const backups = await Promise.all(
        ids.map(async id => {
          const member = String(id);
          const score = await redisClient.zscore(indexKey, member);
          return {
            id: member,
            timestamp: Number(score || 0),
            date: new Date(Number(score || 0)).toISOString(),
          };
        })
      );
      return NextResponse.json({ backups });
    }

    const latestRaw = await redisClient.get(latestKey);
    if (!latestRaw) {
      return NextResponse.json({ backup: null });
    }

    return NextResponse.json({ backup: JSON.parse(latestRaw as string) });
  } catch (error: unknown) {
    console.error("[Backup API] Error fetching backup:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch backup" },
      { status: 500 }
    );
  }
}
