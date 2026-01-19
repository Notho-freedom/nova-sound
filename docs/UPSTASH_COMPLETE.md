# 🚀 Upstash Ecosystem - Complete Integration Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Setup Guide](#setup-guide)
- [Deployment Checklist](#deployment-checklist)
- [API Reference](#api-reference)
- [Usage Patterns](#usage-patterns)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Cost Analysis](#cost-analysis)

## 🎯 Overview

Nova Sound uses the complete **Upstash serverless ecosystem** for:

| Service | Purpose | Status |
|---------|---------|--------|
| **Redis** | Edge caching, KV store, Streams | ✅ Production |
| **QStash** | Message queue, retry logic, scheduling | ✅ Integrated |
| **Workflow** | Multi-step orchestration | ✅ Integrated |
| **Vector** | Semantic search, RAG for AI | ✅ Integrated |

### Why Upstash?

- ✅ **Edge-first**: Sub-20ms latency worldwide
- ✅ **Serverless**: Pay only for what you use
- ✅ **No cold starts**: Always ready
- ✅ **DX-friendly**: Simple REST APIs
- ✅ **Generous free tier**: Start without credit card

## 🏗️ Architecture

### Complete System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    NOVA SOUND APPLICATION                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Browser   │  │  Next.js    │  │  Electron   │
│   Client    │  │  Edge API   │  │   Desktop   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│  UPSTASH REDIS   │          │  UPSTASH QSTASH  │
│  (Edge Cache)    │          │  (Task Queue)    │
├──────────────────┤          ├──────────────────┤
│ • L3 Cache       │          │ • Email delivery │
│ • KV Store       │          │ • Webhooks       │
│ • Event Streams  │          │ • Cron jobs      │
│ • Session data   │          │ • Retry logic    │
└────────┬─────────┘          └────────┬─────────┘
         │                              │
         │      ┌──────────────────┐    │
         └─────►│ HYBRID EVENT BUS │◄───┘
                │   (Intelligent   │
                │    Routing)      │
                └────────┬─────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
│ UPSTASH VECTOR  │ │   WORKFLOW  │ │   TASK      │
│ (Semantic)      │ │(Orchestrate)│ │  HANDLERS   │
├─────────────────┤ ├─────────────┤ ├─────────────┤
│ • Track search  │ │ • Onboarding│ │ • Execute   │
│ • RAG for AI    │ │ • YouTube   │ │ • Update    │
│ • Similarity    │ │   recovery  │ │ • Notify    │
│ • Duplicates    │ │ • State mgmt│ │ • Cleanup   │
└─────────────────┘ └─────────────┘ └─────────────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │   JINA AI API   │
                 │   (Embeddings)  │
                 └─────────────────┘
```

### Data Flow Examples

#### Example 1: User plays a track
```
1. User clicks play
2. Track event → Redis Streams (real-time)
3. Event consumed by analytics service
4. Stats updated in Redis KV
```

#### Example 2: Send welcome email
```
1. User signs up
2. Event → Hybrid Bus
3. Routed to QStash (critical with retry)
4. Task handler sends email
5. Status saved to Redis
```

#### Example 3: Search for "energetic rock"
```
1. User searches
2. Query → Vector API
3. Jina AI generates embeddings
4. Upstash Vector finds similar tracks
5. Results cached in Redis
6. Return to user
```

#### Example 4: 7-day onboarding flow
```
1. User signs up
2. Workflow started
3. Day 0: Welcome email
4. Day 1: Tips email
5. Day 7: Completion survey
6. State persisted in Redis throughout
```

## 📦 Services

### 1. Redis (Edge Cache)

**Purpose**: Fast distributed cache and KV store

**Key Features**:
- Sub-20ms latency globally
- Redis Streams for events
- TTL-based expiration
- Edge runtime compatible

**Use Cases**:
```typescript
// Cache YouTube metadata
await redis.setex(`yt:${videoId}`, 3600, metadata);

// Store user session
await redis.hset(`session:${userId}`, data);

// Publish event
await redis.xadd("events:tracks", "*", { type: "play", trackId });
```

**Documentation**: [REDIS_SETUP_COMPLETE.md](./REDIS_SETUP_COMPLETE.md)

### 2. QStash (Message Queue)

**Purpose**: Reliable task queue with automatic retry

**Key Features**:
- HTTP-based (no persistent connections)
- Automatic retries (exponential backoff)
- Scheduled tasks (cron syntax)
- Webhook signing

**Use Cases**:
```typescript
// Send email with retry
await qstash.email.send({
  to: "user@example.com",
  subject: "Welcome!",
  retries: 3
});

// Schedule daily cleanup
await qstash.schedule("0 2 * * *", "/api/cleanup");
```

**Documentation**: [QSTASH_INTEGRATION.md](./QSTASH_INTEGRATION.md)

### 3. Workflow (Orchestration)

**Purpose**: Multi-step processes with state persistence

**Key Features**:
- Sleep/wait between steps
- State persisted automatically
- Progress tracking
- Cancellable workflows

**Use Cases**:
```typescript
// 7-day onboarding
await workflows.start("onboarding", { userId });

// YouTube recovery pipeline
await workflows.start("youtube-recovery", { trackIds });
```

**Documentation**: [WORKFLOW_INTEGRATION.md](./WORKFLOW_INTEGRATION.md)

### 4. Vector (Semantic Search)

**Purpose**: Natural language search and RAG

**Key Features**:
- Semantic similarity search
- RAG for AI assistants
- Multi-namespace support
- COSINE similarity

**Use Cases**:
```typescript
// Natural language search
const tracks = await vectorHelpers.searchTracks("energetic rock song");

// Get context for AI
const context = await vectorHelpers.rag("How do I add tracks?");
```

**Documentation**: [VECTOR_INTEGRATION.md](./VECTOR_INTEGRATION.md)

## 🚀 Setup Guide

### Step 1: Create Upstash Account

1. Go to https://console.upstash.com
2. Sign up (free, no credit card required)
3. Verify email

### Step 2: Create Redis Database

1. Navigate to **Redis** tab
2. Click **Create Database**
3. Configure:
   - Name: `nova-sound-production`
   - Type: **Global** (for worldwide edge)
   - Region: Choose closest to users
4. Copy credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### Step 3: Enable QStash

1. Navigate to **QStash** tab
2. Click **Get Started**
3. Copy credentials:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`

### Step 4: Create Vector Index

1. Navigate to **Vector** tab
2. Click **Create Index**
3. Configure:
   - Name: `nova-sound-tracks`
   - Dimension: **1024** (for Jina AI)
   - Similarity: **COSINE**
   - Region: Choose closest to users
4. Copy credentials:
   - `UPSTASH_VECTOR_REST_URL`
   - `UPSTASH_VECTOR_REST_TOKEN`

### Step 5: Get Jina AI API Key

1. Go to https://jina.ai/embeddings/
2. Sign up for free
3. Copy API key: `JINA_API_KEY`
4. Free tier: 1M tokens/month

### Step 6: Configure Environment Variables

Add to Vercel (or `.env.local` for local):

```bash
# Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX...

# QStash
QSTASH_TOKEN=eyJ...
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...

# Vector
UPSTASH_VECTOR_REST_URL=https://xxx.upstash.io
UPSTASH_VECTOR_REST_TOKEN=AXX...

# Jina AI
JINA_API_KEY=jina_...
```

### Step 7: Test Integration

```bash
# Health check
curl https://yourdomain.com/api/health/redis

# Vector stats
curl https://yourdomain.com/api/vector/stats

# Send test email
curl -X POST https://yourdomain.com/api/qstash/tasks \
  -H "Content-Type: application/json" \
  -d '{"type":"email-send","data":{"to":"test@example.com"}}'
```

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] Create Upstash account
- [ ] Create Redis database (Global for edge)
- [ ] Enable QStash
- [ ] Create Vector index (dimension: 1024, similarity: COSINE)
- [ ] Get Jina AI API key
- [ ] Test all services locally

### Vercel Configuration

- [ ] Add Redis credentials to Vercel env vars
- [ ] Add QStash credentials to Vercel env vars
- [ ] Add Vector credentials to Vercel env vars
- [ ] Add Jina API key to Vercel env vars
- [ ] Configure QStash callback URLs:
  - `https://yourdomain.com/api/qstash/tasks`
  - `https://yourdomain.com/api/qstash/scheduled`
- [ ] Enable Edge runtime for API routes
- [ ] Set Node.js version to 18.x or higher

### Post-Deployment

- [ ] Verify Redis health: `GET /api/health/redis`
- [ ] Check Vector stats: `GET /api/vector/stats`
- [ ] Send test email via QStash
- [ ] Start test workflow
- [ ] Index sample tracks to Vector
- [ ] Test semantic search
- [ ] Monitor Upstash dashboards
- [ ] Check Vercel logs for errors

### Production Checklist

- [ ] Configure Redis TTL for all cache keys
- [ ] Set up QStash retry policies
- [ ] Configure Vector namespaces
- [ ] Index all tracks to Vector
- [ ] Index documentation for RAG
- [ ] Set up monitoring alerts
- [ ] Configure backup strategy
- [ ] Document runbook for incidents
- [ ] Load test critical endpoints
- [ ] Set up error tracking (Sentry)

## 📚 API Reference

### Redis Endpoints

```typescript
// Health check
GET /api/health/redis
Response: { status: "ok", redis: "connected", latency: 15 }

// Direct Redis operations
import { redis } from "@/lib/redis";
await redis.get("key");
await redis.set("key", "value", { ex: 3600 });
await redis.hset("hash", "field", "value");
```

### QStash Endpoints

```typescript
// Task callback (called by QStash)
POST /api/qstash/tasks
Body: { type: "email-send", data: {...} }

// Scheduled tasks callback
POST /api/qstash/scheduled
Body: { type: "daily-cleanup" }

// Publish task
import { qstash } from "@/lib/qstash-helpers";
await qstash.email.send({ to, subject, body });
await qstash.webhook.send({ url, data });
```

### Workflow Endpoints

```typescript
// Onboarding workflow
POST /api/workflows/onboarding
Body: { userId: "123", email: "user@example.com" }

// YouTube recovery workflow
POST /api/workflows/youtube-recovery
Body: { trackIds: ["id1", "id2"] }

// Helpers
import { workflows } from "@/lib/workflow";
const runId = await workflows.start("onboarding", data);
const status = await workflows.status(runId);
await workflows.cancel(runId);
```

### Vector Endpoints

```typescript
// Semantic search
GET /api/vector/search?q=energetic rock&limit=10&type=track

// Bulk indexing
POST /api/vector/index
Body: { type: "track", data: [...] }

// RAG for assistant
POST /api/vector/rag
Body: { query: "How do I add tracks?", topK: 5 }

// Statistics
GET /api/vector/stats
Response: { count: 1250, namespaces: ["tracks", "docs"] }
```

## 🎯 Usage Patterns

### Pattern 1: Cache with TTL

```typescript
import { redis } from "@/lib/redis";

async function getCachedData(key: string, fetcher: () => Promise<any>) {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  // Fetch and cache
  const data = await fetcher();
  await redis.setex(key, 3600, JSON.stringify(data));
  return data;
}
```

### Pattern 2: Reliable Email Delivery

```typescript
import { qstash } from "@/lib/qstash-helpers";

async function sendWelcomeEmail(userId: string, email: string) {
  await qstash.email.send({
    to: email,
    subject: "Welcome to Nova Sound!",
    body: "...",
    retries: 3,
    delay: 0
  });
}
```

### Pattern 3: Multi-Step Workflow

```typescript
import { workflows } from "@/lib/workflow";

async function startOnboarding(userId: string) {
  const runId = await workflows.start("onboarding", {
    userId,
    email: user.email
  });
  
  // Track progress
  const status = await workflows.status(runId);
  return { runId, status };
}
```

### Pattern 4: Semantic Search

```typescript
import { vectorHelpers } from "@/lib/vector-helpers";

async function searchTracks(query: string) {
  const results = await vectorHelpers.searchTracks(query, 20);
  
  // Cache results
  await redis.setex(
    `search:${query}`,
    300,
    JSON.stringify(results)
  );
  
  return results;
}
```

### Pattern 5: RAG-Enhanced AI

```typescript
import { vectorHelpers } from "@/lib/vector-helpers";

async function askNexus(question: string) {
  // Get relevant context
  const { context, suggestedPrompt } = await vectorHelpers.rag(question, 5);
  
  // Send to LLM
  const answer = await llm.generate(suggestedPrompt);
  
  return answer;
}
```

## 📊 Monitoring

### Upstash Dashboards

Each service has a dedicated dashboard:

**Redis**: https://console.upstash.com/redis
- Requests per second
- Latency (p50, p95, p99)
- Storage usage
- Command statistics

**QStash**: https://console.upstash.com/qstash
- Messages queued
- Messages delivered
- Retry attempts
- Failure rate

**Vector**: https://console.upstash.com/vector
- Vector count
- Query latency
- Storage usage
- Namespace distribution

### Application Monitoring

```typescript
// Add to your monitoring service
export async function checkUpstashHealth() {
  const checks = {
    redis: await redis.ping() === "PONG",
    vector: await vectorHelpers.getStats(),
    qstash: await qstash.ping() // Custom implementation
  };
  
  return checks;
}
```

### Metrics to Track

| Metric | Threshold | Action |
|--------|-----------|--------|
| Redis latency | > 100ms | Check region |
| Redis memory | > 80% | Scale up or cleanup |
| QStash failures | > 5% | Check webhooks |
| Vector queries | > 200ms | Optimize index |
| Vector storage | > 80% | Archive old data |

## 🐛 Troubleshooting

### Redis Connection Issues

```typescript
// Test connection
import { redis } from "@/lib/redis";

try {
  const result = await redis.ping();
  console.log("Redis:", result); // Should be "PONG"
} catch (error) {
  console.error("Redis error:", error);
  // Check UPSTASH_REDIS_REST_URL and TOKEN
}
```

### QStash Signature Verification Failed

```typescript
// Ensure you're using the correct signing keys
console.log(process.env.QSTASH_CURRENT_SIGNING_KEY);
console.log(process.env.QSTASH_NEXT_SIGNING_KEY);

// Both should start with "sig_"
```

### Vector Search Returns No Results

```typescript
// Check if vectors are indexed
const stats = await vectorHelpers.getStats();
console.log(`Vectors: ${stats.count}`); // Should be > 0

// If 0, index some data
await vectorHelpers.indexTracks(tracks);
```

### Workflow Not Starting

```typescript
// Check if workflow exists
try {
  const runId = await workflows.start("test-workflow", {});
  console.log("Workflow started:", runId);
} catch (error) {
  console.error("Workflow error:", error);
  // Check if workflow endpoint exists
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `XADD error` | Old Redis client | Use @upstash/redis |
| `401 Unauthorized` | Missing/invalid token | Check env vars |
| `404 Not Found` | Wrong URL | Verify endpoint |
| `429 Too Many Requests` | Rate limit exceeded | Upgrade plan or add delay |
| `No embeddings` | Jina API key missing | Add JINA_API_KEY |

## 💰 Cost Analysis

### Free Tier Limits

| Service | Free Tier | Overage Cost |
|---------|-----------|--------------|
| **Redis** | 10K commands/day | $0.20 per 100K |
| **QStash** | 500 messages/day | $1 per 1K messages |
| **Vector** | 10K vectors | $10/month per 100K |
| **Jina AI** | 1M tokens/month | $0.02 per 1M tokens |

### Estimated Costs (1,000 active users)

**Scenario: 1,000 users, 50 tracks each, 10 searches/day**

| Service | Usage | Cost/Month |
|---------|-------|------------|
| Redis | 300K commands/day | **Free** |
| QStash | 100 emails/day | **Free** |
| Vector | 50K vectors | $5 |
| Jina AI | 500K tokens/month | **Free** |
| **Total** | | **$5/month** |

**Scenario: 10,000 users, 100 tracks each, 20 searches/day**

| Service | Usage | Cost/Month |
|---------|-------|------------|
| Redis | 3M commands/day | $18 |
| QStash | 1,000 emails/day | $15 |
| Vector | 1M vectors | $100 |
| Jina AI | 10M tokens/month | $2 |
| **Total** | | **$135/month** |

### Cost Optimization Tips

1. **Redis**: Use TTL aggressively, cache hot data only
2. **QStash**: Batch messages when possible
3. **Vector**: Archive old/unused vectors
4. **Jina AI**: Cache embeddings in Redis

## 📖 Documentation Index

| Service | Integration Guide | Summary | Examples |
|---------|------------------|---------|----------|
| Redis | [Setup Guide](./REDIS_SETUP_COMPLETE.md) | [Quick Ref](./REDIS_QUICK_REFERENCE.md) | In setup doc |
| QStash | [Integration](./QSTASH_INTEGRATION.md) | [Summary](./QSTASH_SUMMARY.md) | [Examples](../src/lib/qstash-examples.ts) |
| Workflow | [Integration](./WORKFLOW_INTEGRATION.md) | [Summary](./WORKFLOW_SUMMARY.md) | [Examples](../src/lib/workflow-examples.ts) |
| Vector | [Integration](./VECTOR_INTEGRATION.md) | [Summary](./VECTOR_SUMMARY.md) | [Examples](../src/lib/vector-examples.ts) |

## 🎉 Success Criteria

Your Upstash integration is successful when:

- ✅ Redis health check returns "connected"
- ✅ Vector stats show indexed tracks
- ✅ Test email delivered via QStash
- ✅ Workflow completes successfully
- ✅ Semantic search returns relevant results
- ✅ RAG provides context for AI
- ✅ All services monitored
- ✅ No errors in production logs

## 🚀 What's Next?

1. **Index your library**: Run bulk indexing to Vector
2. **Enable semantic search**: Replace text search with Vector
3. **Enhance Nexus**: Add RAG-powered responses
4. **Set up monitoring**: Create alerts for failures
5. **Optimize costs**: Review usage and set budgets
6. **Scale gradually**: Monitor and adjust as you grow

---

**L'écosystème Upstash complet est prêt pour la production!** 🎊

Pour toute question:
- Upstash Discord: https://upstash.com/discord
- Upstash Docs: https://upstash.com/docs
- Jina AI Docs: https://jina.ai/embeddings/

**Bonne chance avec Nova Sound!** 🎵
