# Workflow Integration Guide

## 🎯 Overview

Workflows dans Nova Sound permettent de gérer des processus multi-étapes complexes avec état persistant, retry automatique, et orchestration.

## 🏗️ Architecture

```
Client Code
    ↓
workflows.startOnboarding()
    ↓
POST /api/workflows/onboarding
    ↓
Initialize State (Redis)
    ↓
Schedule Steps (QStash)
    ↓
┌───────────┬───────────┬───────────┐
│  Step 1   │  Step 2   │  Step 3   │
│ (2 min)   │ (1 day)   │ (7 days)  │
└─────┬─────┴─────┬─────┴─────┬─────┘
      ↓           ↓           ↓
Task Handlers (QStash callbacks)
      ↓           ↓           ↓
Update State (Redis)
```

## 📦 Files Created

### Workflows
- `src/lib/workflow.ts` - Workflow helpers
- `src/lib/workflow-examples.ts` - Usage examples
- `src/app/api/workflows/onboarding/route.ts` - User onboarding
- `src/app/api/workflows/youtube-recovery/route.ts` - YouTube recovery

### Task Handlers (Updated)
- `src/lib/task-handlers.ts` - Added onboarding handlers
  - `onboarding-welcome`
  - `onboarding-tips`
  - `onboarding-check-pro`

## 🚀 Available Workflows

### 1. User Onboarding

**Purpose:** Guide new users through first 7 days

**Steps:**
1. Send welcome email (after 2 minutes)
2. Send tips & tricks email (after 1 day)
3. Check Pro status (after 7 days)
4. Send upgrade reminder if not Pro

**Usage:**
```typescript
import { workflows } from "@/lib/workflow";

await workflows.startOnboarding({
  userId: "user-123",
  email: "user@example.com",
  name: "John Doe"
});
```

**State Structure:**
```typescript
{
  userId: string;
  email: string;
  name: string;
  welcomeEmailSent: boolean;
  tipsEmailSent: boolean;
  upgradeReminderSent: boolean;
  isPro: boolean;
  completedAt?: number;
}
```

### 2. YouTube Recovery

**Purpose:** Recover missing YouTube tracks with retry

**Steps:**
1. Validate track IDs
2. Fetch metadata from YouTube API
3. Download audio streams
4. Process audio (normalize, convert)
5. Extract metadata (title, artist, thumbnail)
6. Store in library
7. Update cache
8. Notify user

**Usage:**
```typescript
import { workflows } from "@/lib/workflow";

const workflowId = await workflows.startYouTubeRecovery({
  trackIds: ["abc123", "def456"],
  userId: "user-123",
  priority: "high"
});

// Check progress
const status = await workflows.getStatus("youtube-recovery", workflowId);
console.log(`Progress: ${status.progress}%`);
```

**State Structure:**
```typescript
{
  trackIds: string[];
  userId: string;
  totalTracks: number;
  processedTracks: number;
  recoveredTracks: number;
  failedTracks: number;
  startedAt: number;
  completedAt?: number;
  status: "queued" | "processing" | "completed" | "failed";
  steps: {
    validate?: boolean;
    fetch?: boolean;
    download?: boolean;
    process?: boolean;
    store?: boolean;
    notify?: boolean;
  };
}
```

## 📝 Usage Patterns

### Start Workflow

```typescript
import { workflows } from "@/lib/workflow";

// User onboarding
const userId = await workflows.startOnboarding({
  userId: "123",
  email: "user@example.com",
  name: "John Doe"
});

// YouTube recovery
const workflowId = await workflows.startYouTubeRecovery({
  trackIds: ["abc", "def"],
  userId: "123"
});
```

### Check Progress

```typescript
const status = await workflows.getStatus("youtube-recovery", "workflow-123");

console.log(`Status: ${status.state.status}`);
console.log(`Progress: ${status.progress}%`);
console.log(`Recovered: ${status.state.recoveredTracks}/${status.state.totalTracks}`);
```

### Cancel Workflow

```typescript
await workflows.cancel("youtube-recovery", "workflow-123");
```

### Batch Processing

```typescript
const trackIds = ["abc", "def", "ghi", "jkl", "mno"];
const batchSize = 10;

const workflowIds = [];

for (let i = 0; i < trackIds.length; i += batchSize) {
  const batch = trackIds.slice(i, i + batchSize);
  
  const workflowId = await workflows.startYouTubeRecovery({
    trackIds: batch,
    userId: "123"
  });
  
  workflowIds.push(workflowId);
}

// Monitor all workflows
const statuses = await Promise.all(
  workflowIds.map(id => workflows.getStatus("youtube-recovery", id))
);
```

### Real-time Progress Streaming

```typescript
async function* streamProgress(workflowId: string) {
  while (true) {
    const status = await workflows.getStatus("youtube-recovery", workflowId);
    
    yield status;
    
    if (status.state.status === "completed" || status.state.status === "failed") {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Usage
for await (const status of streamProgress("workflow-123")) {
  console.log(`Progress: ${status.progress}%`);
}
```

## 🎛️ Creating New Workflows

### 1. Create Workflow Endpoint

Create `src/app/api/workflows/my-workflow/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { qstash } from "@/lib/qstash-helpers";
import { redis } from "@/lib/redis";

export const runtime = "edge";

type MyWorkflowPayload = {
  userId: string;
  data: Record<string, unknown>;
};

type MyWorkflowState = {
  userId: string;
  status: "queued" | "processing" | "completed" | "failed";
  steps: {
    step1?: boolean;
    step2?: boolean;
  };
};

export async function POST(req: NextRequest) {
  const body: MyWorkflowPayload = await req.json();
  const { userId, data } = body;
  
  const workflowId = `my-workflow-${Date.now()}-${userId}`;
  
  // Initialize state
  const state: MyWorkflowState = {
    userId,
    status: "queued",
    steps: {},
  };
  
  await redis.set(
    `workflow:my-workflow:${workflowId}`,
    JSON.stringify(state),
    86400
  );
  
  // Schedule steps
  await qstash.task.publish("my-workflow-step1", {
    workflowId,
    userId,
    data,
  });
  
  return NextResponse.json({
    success: true,
    workflowId,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  
  if (!workflowId) {
    return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
  }
  
  const stateRaw = await redis.get(`workflow:my-workflow:${workflowId}`);
  if (!stateRaw) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  
  const state = JSON.parse(stateRaw as string);
  
  return NextResponse.json({
    success: true,
    state,
  });
}
```

### 2. Create Task Handlers

Add to `src/lib/task-handlers.ts`:

```typescript
export const handleMyWorkflowStep1: TaskHandler = async (payload, meta) => {
  const { workflowId, userId, data } = payload;
  
  // Your logic here
  console.log(`[my-workflow-step1] Processing for ${userId}`);
  
  // Update state
  const stateRaw = await redis.get(`workflow:my-workflow:${workflowId}`);
  if (stateRaw) {
    const state = JSON.parse(stateRaw);
    state.steps.step1 = true;
    await redis.set(
      `workflow:my-workflow:${workflowId}`,
      JSON.stringify(state),
      86400
    );
  }
  
  // Schedule next step
  await qstash.task.publish("my-workflow-step2", {
    workflowId,
    userId,
    data,
  });
  
  return { success: true };
};

// Register handler
export const TASK_HANDLERS: Record<string, TaskHandler> = {
  // ... existing handlers
  "my-workflow-step1": handleMyWorkflowStep1,
  "my-workflow-step2": handleMyWorkflowStep2,
};
```

### 3. Add Helper Function

Update `src/lib/workflow.ts`:

```typescript
export async function startMyWorkflow(params: {
  userId: string;
  data: Record<string, unknown>;
}): Promise<string> {
  const response = await fetch(`${baseUrl}/api/workflows/my-workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    throw new Error(`My workflow failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.workflowId;
}

// Add to exports
export const workflows = {
  // ... existing
  startMyWorkflow,
};
```

## 🔍 Monitoring

### Check Workflow Status

```typescript
const status = await workflows.getStatus("youtube-recovery", "workflow-123");

console.log({
  status: status.state.status,
  progress: status.progress,
  recovered: status.state.recoveredTracks,
  failed: status.state.failedTracks,
});
```

### List User Workflows

```typescript
const userWorkflows = await workflows.listUserWorkflows("user-123");

console.log(`User has ${userWorkflows.length} active workflows`);
```

### QStash Dashboard

View workflow tasks in QStash:
```
https://console.upstash.com/qstash
```

## 🐛 Troubleshooting

### Workflow Not Starting

1. **Check QStash configuration:**
   ```typescript
   console.log(process.env.QSTASH_TOKEN); // Should be set
   ```

2. **Verify endpoint exists:**
   ```bash
   curl https://yourdomain.com/api/workflows/onboarding
   ```

3. **Check Redis connection:**
   ```bash
   curl https://yourdomain.com/api/health/redis
   ```

### Workflow Stuck

1. **Check workflow state:**
   ```typescript
   const status = await workflows.getStatus("youtube-recovery", "workflow-123");
   console.log(status.state);
   ```

2. **Check QStash messages:**
   - Go to QStash dashboard
   - Look for failed messages in DLQ

3. **Cancel and restart:**
   ```typescript
   await workflows.cancel("youtube-recovery", "workflow-123");
   // Restart with same data
   ```

## ✨ Benefits

### Before (Manual Orchestration)
- ❌ Complex state management
- ❌ Manual retry logic
- ❌ No visibility into progress
- ❌ Hard to debug failures

### After (Workflow System)
- ✅ Automatic state persistence (Redis)
- ✅ Built-in retry per step (QStash)
- ✅ Easy progress tracking
- ✅ Clear failure points
- ✅ Can pause/resume workflows
- ✅ Type-safe helpers

## 📊 Performance

### State Storage (Redis)
- TTL: 24 hours (YouTube recovery)
- TTL: 7 days (onboarding)
- Size: ~1KB per workflow

### Task Execution (QStash)
- Retry: 3-5 attempts per step
- Delay: Configurable (seconds to days)
- Priority: low/normal/high

## 🔐 Security

- ✅ Workflow state stored in Redis (encrypted)
- ✅ QStash signature verification on callbacks
- ✅ User ID validation on workflow start
- ✅ Edge runtime (no Node.js APIs)

## 📚 Examples

Full examples: `src/lib/workflow-examples.ts`

## 🎯 Next Steps

1. ✅ **Workflow Foundation** - Done
2. 🟡 **Test Workflows** - Test onboarding & recovery
3. 🟡 **Add More Workflows** - File import, payment processing
4. 🟡 **Vector Integration** - Add for RAG/semantic search
5. 🟡 **Production Monitoring** - Track workflow metrics

## 🚀 Summary

Workflows are now fully integrated with:
- **State persistence** (Redis)
- **Task scheduling** (QStash)
- **Progress tracking** (GET endpoints)
- **Type-safe helpers** (workflows.*)

Ready for complex multi-step processes! 🧠
