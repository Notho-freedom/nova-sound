# QStash Integration Guide

## 🎯 Overview

QStash est intégré dans Nova Sound pour gérer les tâches async avec retry automatique, webhooks, et scheduled jobs.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Code                         │
│  (Actions, API routes, Components)                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Event Bus (Hybrid)                         │
│  - Redis Streams: Real-time events                     │
│  - QStash: Critical tasks with retry                   │
└────────────────┬────────────────────────────────────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
       ▼                   ▼
┌─────────────┐    ┌──────────────┐
│Redis Streams│    │   QStash     │
│  Worker     │    │  (Serverless)│
└─────────────┘    └──────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │Callback Routes│
                  │ /api/qstash/* │
                  └───────────────┘
```

## 📦 Files Created

### Core Integration
- `src/lib/qstash.ts` - QStash client (foundation)
- `src/lib/qstash-helpers.ts` - Simplified API
- `src/lib/event-bus-hybrid.ts` - Hybrid event bus
- `src/lib/task-handlers.ts` - Shared task handlers

### API Routes
- `src/app/api/qstash/tasks/route.ts` - Task execution callback
- `src/app/api/qstash/scheduled/route.ts` - Cron job callback

### Updated Files
- `src/app/actions/spawn-task.ts` - Uses hybrid bus
- `src/app/api/tasks/route.ts` - Uses hybrid bus

## 🚀 Activation

### 1. Get QStash Token

```bash
# Go to Upstash Console
https://console.upstash.com/qstash

# Copy your token
QSTASH_TOKEN=xxxx_xxxxxxxxxxxxx
QSTASH_CURRENT_SIGNING_KEY=sig_xxxxx
QSTASH_NEXT_SIGNING_KEY=sig_xxxxx
```

### 2. Add to Vercel Environment

```bash
# In Vercel dashboard
QSTASH_TOKEN=xxxx_xxxxxxxxxxxxx
QSTASH_CURRENT_SIGNING_KEY=sig_xxxxx
QSTASH_NEXT_SIGNING_KEY=sig_xxxxx
NEXT_PUBLIC_FRONTEND_URL=https://yourdomain.com
```

### 3. Verify Installation

```bash
# Test QStash callback
curl -X POST https://yourdomain.com/api/qstash/tasks \
  -H "Content-Type: application/json" \
  -d '{"taskId": "test-123", "type": "test-task", "payload": {}}'
```

## 📝 Usage

### Simple Task Publishing

```typescript
import { qstash } from "@/lib/qstash-helpers";

// Send email with retry
await qstash.email.send({
  to: "user@example.com",
  subject: "Welcome!",
  body: "Hello world",
});

// Deliver webhook with retry
await qstash.webhook.deliver({
  url: "https://api.example.com/webhook",
  body: { event: "user.created", userId: "123" },
});

// Publish generic task
await qstash.task.publish("youtube-recovery", {
  trackIds: ["123", "456"],
});

// Publish task with delay (60 seconds)
await qstash.task.publishDelayed("daily-cleanup", {}, 60);
```

### Scheduled Tasks (Cron)

```typescript
import { qstash } from "@/lib/qstash-helpers";

// Daily at midnight UTC
await qstash.schedule.daily("daily-cleanup", {
  daysToKeep: 30,
});

// Hourly
await qstash.schedule.hourly("stats-aggregation", {});

// Weekly (Sunday midnight)
await qstash.schedule.weekly("weekly-report", {});

// Custom cron
await qstash.schedule.custom(
  "custom-task",
  "0 */6 * * *", // Every 6 hours
  { foo: "bar" }
);
```

### Smart Routing (Automatic)

```typescript
import { publishTaskSmart } from "@/lib/event-bus-hybrid";

// Auto-routes to QStash for critical tasks
await publishTaskSmart("email-send", { to: "user@example.com" });

// Auto-routes to Redis Streams for real-time events
await publishTaskSmart("notification", { message: "Hello" });
```

### Manual Routing

```typescript
import { publishTask } from "@/lib/event-bus-hybrid";

// Force QStash
await publishTask("any-task", payload, {
  useQStash: true,
  retries: 5,
  delay: 60, // 60 seconds delay
});

// Force Redis Streams
await publishTask("any-task", payload, {
  useQStash: false,
});
```

## 🎛️ Task Routing Rules

### QStash (Guaranteed Delivery)
✅ Use for:
- **email-send** - Email notifications
- **webhook-delivery** - External webhooks
- **payment-process** - Payment operations
- **subscription-update** - Subscription changes
- **youtube-recovery** - Long-running recovery
- **library-scan** - Large scans
- **file-import** - File uploads
- **daily-cleanup** - Scheduled cleanup
- **stats-aggregation** - Stats processing

### Redis Streams (Real-time)
✅ Use for:
- **notification** - Real-time notifications
- **track-play** - Play events
- **progress-update** - Live progress
- **ui-event** - UI interactions
- **analytics** - Analytics events

## 🔧 Adding New Task Handlers

1. **Create handler in** `src/lib/task-handlers.ts`:

```typescript
export const handleMyTask: TaskHandler = async (payload, meta) => {
  const { foo, bar } = payload;
  
  // Your logic here
  
  return {
    success: true,
    result: "...",
  };
};

// Register handler
export const TASK_HANDLERS: Record<string, TaskHandler> = {
  // ... existing handlers
  "my-task": handleMyTask,
};
```

2. **Add to routing rules** in `src/lib/event-bus-hybrid.ts`:

```typescript
export function shouldUseQStash(taskType: string): boolean {
  const qstashTasks = [
    // ... existing tasks
    "my-task", // ADD HERE
  ];
  
  return qstashTasks.includes(taskType);
}
```

3. **Use it**:

```typescript
import { qstash } from "@/lib/qstash-helpers";

await qstash.task.publish("my-task", { foo: "bar" });
```

## 🔍 Monitoring

### Health Check

```bash
# Check Redis connection
curl https://yourdomain.com/api/health/redis
```

### QStash Dashboard

```
https://console.upstash.com/qstash
```

View:
- Active messages
- Failed messages (DLQ)
- Scheduled jobs
- Metrics & analytics

### Logs

```typescript
// In Vercel logs, search for:
[QStash Tasks] Running task: email-send
[QStash Scheduled] Running task: daily-cleanup
```

## 🐛 Troubleshooting

### QStash Not Working

1. **Check env vars**:
   ```bash
   echo $QSTASH_TOKEN
   echo $QSTASH_CURRENT_SIGNING_KEY
   ```

2. **Verify signature validation**:
   ```typescript
   // In /api/qstash/tasks/route.ts
   const isValid = await verifyQStashSignature(req);
   console.log("Signature valid:", isValid);
   ```

3. **Check QStash dashboard**:
   - Failed messages in DLQ
   - Error messages
   - Retry attempts

### Task Not Executing

1. **Check task registration**:
   ```typescript
   // In src/lib/task-handlers.ts
   console.log(Object.keys(TASK_HANDLERS)); // Should include your task
   ```

2. **Check routing**:
   ```typescript
   // In src/lib/event-bus-hybrid.ts
   console.log(shouldUseQStash("your-task")); // true = QStash, false = Redis
   ```

3. **Check callback URL**:
   ```bash
   # Must be accessible from internet
   curl https://yourdomain.com/api/qstash/tasks
   ```

## 🔐 Security

### Signature Verification

All QStash callbacks **MUST** verify signatures:

```typescript
const isValid = await verifyQStashSignature(req);
if (!isValid) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

### Environment Variables

Never commit:
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`

## 📊 Cost Optimization

### Redis Streams vs QStash

| Scenario | Use | Why |
|----------|-----|-----|
| Real-time notifications | Redis Streams | Lower latency, free |
| Email sending | QStash | Guaranteed delivery |
| External webhooks | QStash | Automatic retry |
| Play events | Redis Streams | High volume, real-time |
| Payment processing | QStash | Critical, needs retry |
| UI events | Redis Streams | Low latency |
| Scheduled cleanup | QStash | Built-in cron |

### QStash Pricing

Free tier:
- 500 messages/day
- 100 scheduled jobs

Upgrade when needed:
- https://upstash.com/pricing/qstash

## 🎯 Next Steps

1. ✅ **Redis Integration** - Done
2. ✅ **QStash Foundation** - Done
3. 🟡 **Production Testing** - Test with real tasks
4. 🟡 **Workflow Integration** - Add for complex flows
5. 🟡 **Vector Integration** - Add for RAG/semantic search

## 📚 Resources

- [QStash Documentation](https://upstash.com/docs/qstash)
- [QStash REST API](https://upstash.com/docs/qstash/api/messages/create)
- [Cron Expression Generator](https://crontab.guru/)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
