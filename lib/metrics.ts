type CounterKey = string;

interface MetricsSnapshot {
  counters: Record<CounterKey, number>;
  updatedAt: string;
}

const counters: Record<CounterKey, number> = {};

function increment(key: CounterKey, by: number = 1) {
  counters[key] = (counters[key] || 0) + by;
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
