# 🚀 Upstash Deployment - Step-by-Step Guide

Complete deployment guide from zero to production in **30 minutes**.

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Vercel account (free)
- [ ] Email for Upstash signup
- [ ] Email for Jina AI signup
- [ ] 30 minutes of time

**No credit card required!** Everything uses free tiers.

## ⏱️ Quick Start (30 Minutes)

| Step | Time | Task |
|------|------|------|
| 1 | 5 min | Create Upstash account & Redis |
| 2 | 3 min | Enable QStash |
| 3 | 5 min | Create Vector index |
| 4 | 3 min | Get Jina AI key |
| 5 | 5 min | Configure Vercel |
| 6 | 5 min | Deploy & test |
| 7 | 4 min | Index initial data |

## 🎯 Step 1: Create Upstash Account (5 min)

### 1.1 Sign Up

1. Go to: https://console.upstash.com
2. Click **Sign Up**
3. Choose method:
   - GitHub (fastest)
   - Email + password
4. Verify email (if using email method)
5. Login to dashboard

### 1.2 Create Redis Database

1. Click **Redis** tab
2. Click **Create Database**
3. Configure:
   ```
   Name: nova-sound-production
   Type: Global (for worldwide edge)
   Region: Choose closest to your users
         (eu-west-1 for Europe, us-east-1 for USA)
   Primary: Enabled
   Read Regions: Select 2-3 regions where users are
   ```
4. Click **Create**
5. **Copy credentials** (click "eye" icon to reveal):
   ```bash
   UPSTASH_REDIS_REST_URL=https://gusc1-xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AXXxxxxxxxxxxxxxxxx
   ```
6. Save to a temporary text file

✅ **Checkpoint**: You should have Redis URL + Token

## 🎯 Step 2: Enable QStash (3 min)

### 2.1 Activate QStash

1. Click **QStash** tab
2. Click **Get Started** (if first time)
3. **Copy credentials**:
   ```bash
   QSTASH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   QSTASH_CURRENT_SIGNING_KEY=sig_xxxxxxxxxx
   QSTASH_NEXT_SIGNING_KEY=sig_yyyyyyyyyy
   ```
4. Save to temporary text file

✅ **Checkpoint**: You should have QStash token + 2 signing keys

## 🎯 Step 3: Create Vector Index (5 min)

### 3.1 Create Index

1. Click **Vector** tab
2. Click **Create Index**
3. Configure:
   ```
   Name: nova-sound-tracks
   Region: Same as Redis (e.g., eu-west-1)
   Dimensions: 1024
   Similarity Metric: COSINE
   ```
4. Click **Create**
5. **Copy credentials**:
   ```bash
   UPSTASH_VECTOR_REST_URL=https://vector-xxx.upstash.io
   UPSTASH_VECTOR_REST_TOKEN=AXXxxxxxxxxxxxxxxxx
   ```
6. Save to temporary text file

### 3.2 Verify

- Index should show: **0 vectors** (normal, we'll index later)
- Status should be: **Ready**

✅ **Checkpoint**: You should have Vector URL + Token

## 🎯 Step 4: Get Jina AI Key (3 min)

### 4.1 Sign Up

1. Go to: https://jina.ai/embeddings/
2. Click **Get Started Free**
3. Sign up with:
   - Email + password
   - OR GitHub
4. Verify email

### 4.2 Get API Key

1. Go to: https://jina.ai/api-keys/ (or check welcome email)
2. Click **Create API Key**
3. Name it: `nova-sound-production`
4. **Copy key**:
   ```bash
   JINA_API_KEY=jina_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. Save to temporary text file

### 4.3 Verify

Test with curl:
```bash
curl -X POST https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"test","model":"jina-embeddings-v3"}'
```

Should return: JSON with embeddings array

✅ **Checkpoint**: You should have Jina API key working

## 🎯 Step 5: Configure Vercel (5 min)

### 5.1 Access Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your **nova-sound** project
3. Click **Settings** tab
4. Click **Environment Variables** (left sidebar)

### 5.2 Add Variables

Add each variable with this configuration:
- **Value**: Paste from your temporary text file
- **Environments**: Check ✅ Production, ✅ Preview, ✅ Development

**Add these 8 variables:**

```bash
UPSTASH_REDIS_REST_URL
Value: https://gusc1-xxx.upstash.io
Environments: ✅ Production ✅ Preview ✅ Development

UPSTASH_REDIS_REST_TOKEN
Value: AXXxxxxxxxxxxxxxxxx
Environments: ✅ Production ✅ Preview ✅ Development

QSTASH_TOKEN
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Environments: ✅ Production ✅ Preview ✅ Development

QSTASH_CURRENT_SIGNING_KEY
Value: sig_xxxxxxxxxx
Environments: ✅ Production ✅ Preview ✅ Development

QSTASH_NEXT_SIGNING_KEY
Value: sig_yyyyyyyyyy
Environments: ✅ Production ✅ Preview ✅ Development

UPSTASH_VECTOR_REST_URL
Value: https://vector-xxx.upstash.io
Environments: ✅ Production ✅ Preview ✅ Development

UPSTASH_VECTOR_REST_TOKEN
Value: AXXxxxxxxxxxxxxxxxx
Environments: ✅ Production ✅ Preview ✅ Development

JINA_API_KEY
Value: jina_xxxxxxxxxxxxxxxxxxxxxxxx
Environments: ✅ Production ✅ Preview ✅ Development
```

### 5.3 Verify

After adding all variables, you should see **8 environment variables** in the list.

✅ **Checkpoint**: All 8 variables added to Vercel

## 🎯 Step 6: Deploy & Test (5 min)

### 6.1 Deploy

**Option A: Automatic (Recommended)**
```bash
# Push to GitHub
git add .
git commit -m "Add Upstash ecosystem integration"
git push origin main
```
Vercel will auto-deploy.

**Option B: Manual**
```bash
# Via Vercel CLI
vercel --prod
```

**Option C: Dashboard**
1. Go to Vercel dashboard
2. Click **Deployments** tab
3. Click **Redeploy** on latest deployment
4. Check **Use existing Build Cache** ❌ (uncheck)
5. Click **Redeploy**

### 6.2 Wait for Deployment

- Should take **2-3 minutes**
- Watch logs for errors
- Wait for ✅ **Ready** status

### 6.3 Test Endpoints

Replace `yourdomain.com` with your Vercel URL:

**Test Redis:**
```bash
curl https://yourdomain.com/api/health/redis
```
Expected:
```json
{
  "status": "ok",
  "redis": "connected",
  "timestamp": "2026-01-18T...",
  "latency": 15
}
```

**Test Vector:**
```bash
curl https://yourdomain.com/api/vector/stats
```
Expected:
```json
{
  "success": true,
  "stats": {
    "count": 0,
    "namespaces": [],
    "dimension": 1024
  }
}
```

**Test QStash (via webhook):**

This will be called automatically by QStash when tasks are published. You can verify by checking Vercel logs later.

✅ **Checkpoint**: All endpoints return success

## 🎯 Step 7: Index Initial Data (4 min)

### 7.1 Index Sample Tracks

```bash
# Replace with your domain
curl -X POST https://yourdomain.com/api/vector/index \
  -H "Content-Type: application/json" \
  -d '{
    "type": "track",
    "data": [
      {
        "id": "track-1",
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "album": "A Night at the Opera",
        "genre": "Rock",
        "year": 1975
      },
      {
        "id": "track-2",
        "title": "Stairway to Heaven",
        "artist": "Led Zeppelin",
        "album": "Led Zeppelin IV",
        "genre": "Rock",
        "year": 1971
      },
      {
        "id": "track-3",
        "title": "Imagine",
        "artist": "John Lennon",
        "album": "Imagine",
        "genre": "Pop",
        "year": 1971
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "indexed": 3,
  "ids": ["track-1", "track-2", "track-3"]
}
```

### 7.2 Verify Indexing

```bash
curl https://yourdomain.com/api/vector/stats
```

Should now show:
```json
{
  "stats": {
    "count": 3,  // ← Should be 3 now!
    "namespaces": ["tracks"]
  }
}
```

### 7.3 Test Search

```bash
curl "https://yourdomain.com/api/vector/search?q=epic rock ballad&limit=2"
```

Expected: Returns Bohemian Rhapsody and Stairway to Heaven

✅ **Checkpoint**: Tracks indexed and searchable

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ Redis health check returns "connected"
- ✅ Vector stats show count > 0
- ✅ Semantic search returns relevant results
- ✅ No errors in Vercel logs
- ✅ Upstash dashboards show activity

## 📊 Monitor Deployments

### Vercel Logs

1. Go to Vercel dashboard
2. Click **Deployments** tab
3. Click on latest deployment
4. Check **Build Logs** and **Function Logs**

Look for:
```
✅ [Redis] Connected
✅ [Vector] Initialized
✅ [QStash] Ready
```

### Upstash Dashboards

**Redis**: https://console.upstash.com/redis
- Should see requests coming in
- Latency should be < 50ms

**Vector**: https://console.upstash.com/vector
- Should see 3+ vectors
- Query latency < 100ms

**QStash**: https://console.upstash.com/qstash
- Will show activity when tasks are published

## 🐛 Troubleshooting

### Deployment Failed

**Check build logs:**
1. Go to Vercel > Deployments
2. Click on failed deployment
3. Read error message

**Common issues:**
- TypeScript errors → Fix and commit
- Missing dependencies → Run `npm install`
- Build timeout → Upgrade Vercel plan or optimize build

### Redis Connection Failed

**Check environment variables:**
```bash
# Via Vercel CLI
vercel env ls

# Should show all 8 variables
```

**Fix:**
1. Verify UPSTASH_REDIS_REST_URL is set
2. Verify UPSTASH_REDIS_REST_TOKEN is set
3. Check for typos (common: missing `https://`)
4. Redeploy

### Vector Returns No Results

**Possible causes:**
1. **Not indexed yet** → Run indexing command (Step 7.1)
2. **Wrong namespace** → Check namespace in request
3. **Poor query** → Try broader search terms
4. **Jina API error** → Check JINA_API_KEY is valid

**Debug:**
```bash
# Check vector count
curl https://yourdomain.com/api/vector/stats

# If count = 0, index some data
curl -X POST https://yourdomain.com/api/vector/index ...
```

### QStash Signature Error

**Cause**: Wrong signing keys

**Fix:**
1. Go to Upstash QStash dashboard
2. Copy fresh signing keys
3. Update Vercel env vars
4. Redeploy

### 401 Unauthorized

**Cause**: Missing or invalid token

**Fix:**
1. Check env var name (exact spelling matters!)
2. Check token format (should start with `AXX` or `AYA` for Upstash)
3. Regenerate token if needed
4. Update Vercel
5. Redeploy

## 🔄 Redeployment Process

If you need to redeploy after fixing issues:

```bash
# Option 1: Git push (automatic)
git add .
git commit -m "Fix: description"
git push origin main

# Option 2: Vercel CLI
vercel --prod

# Option 3: Vercel dashboard
# Click Deployments > Redeploy
```

**Important**: After changing environment variables, you MUST redeploy for changes to take effect.

## 📈 Post-Deployment

### 1. Index Your Library

```bash
# Get all tracks from your database
# Then bulk index to Vector

curl -X POST https://yourdomain.com/api/vector/index \
  -H "Content-Type: application/json" \
  -d '{"type":"track","data":[...]}'
```

### 2. Enable Features in UI

Update your search component to use Vector:

```typescript
// Before (text search)
const results = tracks.filter(t => 
  t.title.toLowerCase().includes(query.toLowerCase())
);

// After (semantic search)
const results = await fetch(
  `/api/vector/search?q=${query}&limit=20`
).then(r => r.json());
```

### 3. Add Nexus RAG

```typescript
// In your AI assistant
const { context } = await fetch("/api/vector/rag", {
  method: "POST",
  body: JSON.stringify({ query: userQuestion })
}).then(r => r.json());

// Send context + question to LLM
const answer = await llm.generate(`Context: ${context}\n\nQ: ${userQuestion}`);
```

### 4. Set Up Monitoring

Add to your dashboard:
- Redis connection status
- Vector index size
- QStash message count
- Search query latency

### 5. Configure Alerts (Optional)

Set up alerts for:
- Redis latency > 100ms
- Vector query errors
- QStash delivery failures
- Free tier limits approaching

## 📚 Next Steps

- 📖 Read [UPSTASH_COMPLETE.md](./UPSTASH_COMPLETE.md) for full architecture
- 🔧 Check [UPSTASH_ENV_VARS.md](./UPSTASH_ENV_VARS.md) for all variables
- 🚀 See [VECTOR_INTEGRATION.md](./VECTOR_INTEGRATION.md) for Vector details
- 📋 Review [QSTASH_INTEGRATION.md](./QSTASH_INTEGRATION.md) for QStash usage
- 🔄 Read [WORKFLOW_INTEGRATION.md](./WORKFLOW_INTEGRATION.md) for workflows

## 🎯 Deployment Checklist

Copy this to track your deployment:

```markdown
## Pre-Deployment
- [ ] Upstash account created
- [ ] Redis database created (Global)
- [ ] QStash enabled
- [ ] Vector index created (1024 dim, COSINE)
- [ ] Jina AI API key obtained

## Environment Variables
- [ ] UPSTASH_REDIS_REST_URL
- [ ] UPSTASH_REDIS_REST_TOKEN
- [ ] QSTASH_TOKEN
- [ ] QSTASH_CURRENT_SIGNING_KEY
- [ ] QSTASH_NEXT_SIGNING_KEY
- [ ] UPSTASH_VECTOR_REST_URL
- [ ] UPSTASH_VECTOR_REST_TOKEN
- [ ] JINA_API_KEY

## Deployment
- [ ] All env vars added to Vercel
- [ ] Code committed and pushed
- [ ] Deployment successful (no errors)
- [ ] Redis health check passes
- [ ] Vector stats endpoint works

## Post-Deployment
- [ ] Sample tracks indexed
- [ ] Semantic search works
- [ ] Upstash dashboards show activity
- [ ] No errors in Vercel logs
- [ ] Monitoring configured

## Production
- [ ] Full library indexed
- [ ] UI updated to use semantic search
- [ ] Nexus RAG enabled
- [ ] Documentation updated
- [ ] Team notified
```

## 🆘 Getting Help

If you get stuck:

1. **Check troubleshooting section above** ⬆️
2. **Review logs**: Vercel Function Logs
3. **Check Upstash status**: https://status.upstash.com
4. **Read docs**:
   - Upstash: https://upstash.com/docs
   - Jina AI: https://jina.ai/embeddings/
5. **Community**:
   - Upstash Discord: https://upstash.com/discord
   - GitHub Issues: Create issue in your repo

## 🎉 Congratulations!

You've successfully deployed the complete Upstash ecosystem! 🚀

**Your app now has:**
- ⚡ Edge caching (Redis)
- 🔄 Reliable task queue (QStash)
- 🎯 Multi-step workflows (Workflow)
- 🔍 Semantic search (Vector)
- 🤖 AI-powered RAG (Jina + Vector)

**Time to celebrate!** 🎊

---

**Need to redeploy?** Just follow Step 6 again.  
**Want to optimize?** Read [UPSTASH_COMPLETE.md](./UPSTASH_COMPLETE.md) for advanced patterns.  
**Ready for scale?** Check cost analysis in complete guide.

**Bonne chance!** 🎵
