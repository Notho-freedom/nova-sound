# 🔐 Environment Variables - Complete Reference

Quick reference for all Upstash ecosystem environment variables.

## 📋 Required Variables

### Redis (Edge Cache)

```bash
# Get from: https://console.upstash.com/redis
UPSTASH_REDIS_REST_URL=https://your-redis-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX1234567890abcdefghijklmnop
```

**Purpose**: Edge caching, KV store, event streams  
**Free tier**: 10K commands/day  
**Setup**: Create Global database for worldwide edge

### QStash (Message Queue)

```bash
# Get from: https://console.upstash.com/qstash
QSTASH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
QSTASH_CURRENT_SIGNING_KEY=sig_1234567890abcdefghijklmnop
QSTASH_NEXT_SIGNING_KEY=sig_0987654321zyxwvutsrqponmlk
```

**Purpose**: Reliable task queue with automatic retry  
**Free tier**: 500 messages/day  
**Setup**: Enable QStash in Upstash console

### Vector (Semantic Search)

```bash
# Get from: https://console.upstash.com/vector
UPSTASH_VECTOR_REST_URL=https://your-vector-xxxxx.upstash.io
UPSTASH_VECTOR_REST_TOKEN=AXX1234567890abcdefghijklmnop

# Get from: https://jina.ai/embeddings/
JINA_API_KEY=jina_1234567890abcdefghijklmnopqrstuvwxyz
```

**Purpose**: Natural language search, RAG for AI  
**Free tier**: 10K vectors, 1M Jina tokens/month  
**Setup**: Create index with dimension=1024, similarity=COSINE

## 🔧 Optional Variables

### Workflow (Orchestration)

```bash
# Get from: https://console.upstash.com/workflow
# Only needed for complex workflows beyond basic QStash
WORKFLOW_CLIENT=your-workflow-client-id
```

**Purpose**: Multi-step processes with state  
**Note**: Most workflows work without this using QStash + Redis

### Alternative Embeddings

```bash
# OpenAI (higher quality, paid)
OPENAI_API_KEY=sk-proj-1234567890abcdefghijklmnop

# Cohere (alternative, paid)
COHERE_API_KEY=1234567890abcdefghijklmnop
```

**Purpose**: Alternative to Jina AI for embeddings  
**Cost**: OpenAI $0.02/1M tokens, Cohere varies  
**Note**: Choose ONE embedding provider, not all

## 🎯 Quick Setup Checklist

### 1. Create Accounts (5 minutes)

- [ ] Upstash: https://console.upstash.com (free, no CC)
- [ ] Jina AI: https://jina.ai/embeddings/ (free, no CC)

### 2. Create Resources (10 minutes)

- [ ] Redis database (Global for edge)
- [ ] Enable QStash
- [ ] Vector index (1024 dim, COSINE)
- [ ] Get Jina API key

### 3. Add to Vercel (5 minutes)

```bash
# Go to: Vercel Project > Settings > Environment Variables
# Add all 6 required variables above
# Deploy
```

### 4. Test (5 minutes)

```bash
# Health check
curl https://yourdomain.com/api/health/redis

# Vector stats
curl https://yourdomain.com/api/vector/stats

# Should see: status=ok, vectors=0 (before indexing)
```

## 📊 Environment Variable Matrix

| Variable | Required | Service | Free Tier | Used For |
|----------|----------|---------|-----------|----------|
| `UPSTASH_REDIS_REST_URL` | ✅ Yes | Redis | 10K/day | Caching, KV, Streams |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Yes | Redis | 10K/day | Authentication |
| `QSTASH_TOKEN` | ✅ Yes | QStash | 500/day | Publishing tasks |
| `QSTASH_CURRENT_SIGNING_KEY` | ✅ Yes | QStash | 500/day | Verify webhooks |
| `QSTASH_NEXT_SIGNING_KEY` | ✅ Yes | QStash | 500/day | Key rotation |
| `UPSTASH_VECTOR_REST_URL` | ✅ Yes | Vector | 10K vectors | Semantic search |
| `UPSTASH_VECTOR_REST_TOKEN` | ✅ Yes | Vector | 10K vectors | Authentication |
| `JINA_API_KEY` | ✅ Yes | Jina AI | 1M tokens/mo | Embeddings |
| `WORKFLOW_CLIENT` | ⚪ Optional | Workflow | - | Complex flows |
| `OPENAI_API_KEY` | ⚪ Optional | OpenAI | Paid | Alt embeddings |
| `COHERE_API_KEY` | ⚪ Optional | Cohere | Paid | Alt embeddings |

## 🔍 Verification Commands

### Check if variables are set (Vercel CLI)

```bash
vercel env ls
```

### Check in application (Node.js)

```bash
node -e "console.log({
  redis: !!process.env.UPSTASH_REDIS_REST_URL,
  qstash: !!process.env.QSTASH_TOKEN,
  vector: !!process.env.UPSTASH_VECTOR_REST_URL,
  jina: !!process.env.JINA_API_KEY
})"
```

### Test endpoints

```bash
# Redis
curl https://yourdomain.com/api/health/redis

# Vector
curl https://yourdomain.com/api/vector/stats

# QStash (will be called by QStash, not directly)
# Check Vercel logs for incoming webhook calls
```

## 🐛 Common Issues

### "Redis connection failed"

```bash
# Check if variables are set
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# Should both be set and start with correct prefixes
# URL: https://
# TOKEN: AXX or AYA
```

### "QStash signature verification failed"

```bash
# Check signing keys
echo $QSTASH_CURRENT_SIGNING_KEY
echo $QSTASH_NEXT_SIGNING_KEY

# Both should start with "sig_"
# Get fresh keys from Upstash console if rotated
```

### "Vector embeddings error"

```bash
# Check Jina API key
echo $JINA_API_KEY

# Should start with "jina_"
# Test with curl:
curl -X POST https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"test","model":"jina-embeddings-v3"}'
```

### "Environment variables not found"

```bash
# Vercel: Variables must be added via dashboard
# Local: Copy env.example to .env.local
cp env.example .env.local

# Then fill in values in .env.local
```

## 📝 Local Development Setup

### 1. Copy template

```bash
cp env.example .env.local
```

### 2. Fill in values

Edit `.env.local` with your credentials from Upstash console.

### 3. Restart dev server

```bash
# Kill existing server
pkill -f "next dev"

# Start fresh
npm run dev
```

### 4. Verify

```bash
# Should show all services connected
open http://localhost:3000/api/health/redis
```

## 🚀 Production Deployment (Vercel)

### Option 1: Via Dashboard (Recommended)

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings > Environment Variables
4. Add all 6 required variables
5. Select environments: Production, Preview, Development
6. Click "Save"
7. Redeploy

### Option 2: Via CLI

```bash
# Set for production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add QSTASH_TOKEN production
vercel env add QSTASH_CURRENT_SIGNING_KEY production
vercel env add QSTASH_NEXT_SIGNING_KEY production
vercel env add UPSTASH_VECTOR_REST_URL production
vercel env add UPSTASH_VECTOR_REST_TOKEN production
vercel env add JINA_API_KEY production

# Deploy
vercel --prod
```

### Option 3: Via .env file (Quick)

```bash
# Create .env.production
cat > .env.production << EOF
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AXX...
QSTASH_TOKEN=eyJ...
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=AXX...
JINA_API_KEY=jina_...
EOF

# Import to Vercel
vercel env pull .env.production
```

## 🔐 Security Best Practices

### ✅ DO

- ✅ Store secrets in Vercel environment variables
- ✅ Use `.env.local` for local development only
- ✅ Add `.env.local` to `.gitignore`
- ✅ Rotate keys if compromised
- ✅ Use different credentials for dev/prod
- ✅ Limit Upstash IP ranges if possible

### ❌ DON'T

- ❌ Commit `.env.local` to Git
- ❌ Share credentials in Slack/Discord
- ❌ Use production keys in development
- ❌ Store credentials in code comments
- ❌ Use NEXT_PUBLIC_ prefix for secrets
- ❌ Expose tokens in client-side code

## 📚 Documentation Links

- **env.example**: Full template with all variables
- **UPSTASH_COMPLETE.md**: Complete ecosystem guide
- **REDIS_SETUP_COMPLETE.md**: Redis setup details
- **QSTASH_INTEGRATION.md**: QStash implementation
- **VECTOR_INTEGRATION.md**: Vector search setup
- **Upstash Docs**: https://upstash.com/docs
- **Jina AI Docs**: https://jina.ai/embeddings/

## 🎯 Quick Copy-Paste Template

```bash
# ============================================
# UPSTASH ECOSYSTEM - PRODUCTION
# ============================================

# Redis (Edge Cache)
UPSTASH_REDIS_REST_URL=https://
UPSTASH_REDIS_REST_TOKEN=AXX

# QStash (Message Queue)
QSTASH_TOKEN=eyJ
QSTASH_CURRENT_SIGNING_KEY=sig_
QSTASH_NEXT_SIGNING_KEY=sig_

# Vector (Semantic Search)
UPSTASH_VECTOR_REST_URL=https://
UPSTASH_VECTOR_REST_TOKEN=AXX

# Jina AI (Embeddings)
JINA_API_KEY=jina_

# ============================================
# Ready to deploy! 🚀
# ============================================
```

---

**Need help?** Check the troubleshooting section or docs above! 🆘
