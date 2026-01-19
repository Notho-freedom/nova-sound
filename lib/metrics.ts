type CounterKey = string;

interface MetricsSnapshot {
  counters: Record<CounterKey, number>;
  updatedAt: string;
}

const counters: Record<CounterKey, number> = {};
const METRICS_HASH_KEY = "metrics:counters";
const METRICS_UPDATED_KEY = "metrics:updatedAt";

async function incrementRemote(key: CounterKey, by: number): Promise<void> {
  try {
    const { redis } = await import("@/lib/redis");
    await redis.hincrby(METRICS_HASH_KEY, key, by);
    await redis.setex(METRICS_UPDATED_KEY, 60 * 60 * 24, new Date().toISOString());
  } catch {
    // Non-blocking metrics failure
  }
}

function increment(key: CounterKey, by: number = 1) {
  counters[key] = (counters[key] || 0) + by;
  void incrementRemote(key, by);
}

export function recordRequest(route: string, method: string, status: number) {
  increment(`requests.total`);
  increment(`requests.${method.toLowerCase()}`);
  increment(`requests.${route}.${status}`);
}

export function recordError(route: string) {
  increment(`errors.total`);
  increment(`errors.${route}`);
}

export function getMetrics(): MetricsSnapshot {
  return {
    counters: { ...counters },
    updatedAt: new Date().toISOString(),
  };
}

export async function getMetricsRemote(): Promise<MetricsSnapshot> {
  try {
    const { redis } = await import("@/lib/redis");
    const remote = await redis.hgetall<Record<string, number | string>>(METRICS_HASH_KEY);
    const updatedAt = (await redis.get(METRICS_UPDATED_KEY)) as string | null;

    const normalized: Record<string, number> = {};
    if (remote) {
      Object.entries(remote).forEach(([key, value]) => {
        const num = typeof value === "number" ? value : Number(value);
        normalized[key] = Number.isFinite(num) ? num : 0;
      });
    }

    return {
      counters: normalized,
      updatedAt: updatedAt || new Date().toISOString(),
    };
  } catch {
    return getMetrics();
  }
}
