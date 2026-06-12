# 🚀 CLOUD DEPLOYMENT GUIDE - Render.com

## STEP-BY-STEP DEPLOYMENT INSTRUCTIONS

### ✅ PART 1: SET UP RENDER.COM ACCOUNT

1. **Go to https://render.com**
2. **Sign up with GitHub** (easier - gives repo access)
3. **Authorize** the GitHub app

---

### ✅ PART 2: DEPLOY DATABASE

#### Option A: Render PostgreSQL (Recommended)
1. Dashboard → **New +** → **PostgreSQL**
2. Configuration:
   - **Name**: `pairwithcode-db`
   - **Database**: `pairwithcode`
   - **User**: `pairwithcode`
   - **Region**: Choose closest to you
   - **PostgreSQL Version**: 15
3. **Create Database**
4. ⏳ Wait 5-10 minutes for creation
5. **Copy connection details** (save for backend config):
   ```
   EXTERNAL DATABASE URL: postgresql://user:password@host:port/database
   ```

#### Option B: Neon.tech (Serverless - Free)
1. Go to https://neon.tech
2. Create account with GitHub
3. Create project → get connection string
4. Copy to notes

---

### ✅ PART 3: DEPLOY BACKEND SERVICE

1. **Dashboard → New +** → **Web Service**
2. **Connect Repository**:
   - Select `LujanJamil/pairwithcode` (your repo)
   - **Branch**: `master`
   - **Root Directory**: `backend`
3. **Configuration**:
   - **Name**: `pairwithcode-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter)
4. **Add Environment Variables** (click "Advanced"):
   ```
   NODE_ENV=production
   PORT=3000
   DB_HOST=<from PostgreSQL step above>
   DB_PORT=5432
   DB_USER=pairwithcode
   DB_PASSWORD=<from PostgreSQL step above>
   DB_NAME=pairwithcode
   DB_SSL=true
   REDIS_HOST=redis.render.com (or leave blank for now)
   REDIS_PORT=6379
   JWT_SECRET=your-super-secret-jwt-key-that-is-at-least-32-characters-long
   GITHUB_CLIENT_ID=<your GitHub OAuth app ID>
   GITHUB_CLIENT_SECRET=<your GitHub OAuth app secret>
   ```
5. **Create Web Service**
6. ⏳ Wait for deployment (5-10 minutes)
7. **Get your URL** from the dashboard:
   ```
   Example: https://pairwithcode-backend.onrender.com
   ```

---

### ✅ PART 4: RUN DATABASE MIGRATIONS

Once backend is deployed:

1. **In your local terminal**, connect to the production database:
   ```bash
   psql postgresql://user:password@host:5432/pairwithcode
   ```

2. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

3. **Verify tables created**:
   ```sql
   \dt
   ```

---

### ✅ PART 5: TEST BACKEND

Open your browser:
```
https://pairwithcode-backend.onrender.com/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2026-06-12T12:00:00Z",
  "nodeEnv": "production",
  "uptime": 123.45
}
```

✅ **If you see this, your backend is live!**

---

## 📝 IMPORTANT NOTES

### Environment Variables Needed:
- **Database**: Get from Render PostgreSQL
- **Redis**: Can use Render Redis or skip for now
- **JWT_SECRET**: Generate strong random string
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **GitHub OAuth**: Create app at https://github.com/settings/developers
  - Callback URL: `https://your-backend-url/api/auth/github/callback`

### Monitoring:
- Go to your service dashboard
- Click **Logs** to see real-time server output
- Click **Metrics** for CPU/Memory usage

### Common Issues:
1. **Service won't start**: Check logs in Render dashboard
2. **Database connection fails**: Verify DB_HOST matches Render PostgreSQL
3. **Out of memory**: Upgrade to Starter plan
4. **SSL certificate error**: Set `DB_SSL=true`

---

## 🔗 FINAL URLS TO USE

Once deployed, you'll have:
- **Backend API**: `https://pairwithcode-backend.onrender.com`
- **WebSocket**: `wss://pairwithcode-backend.onrender.com`
- **Health Check**: `https://pairwithcode-backend.onrender.com/health`

**Save these URLs! You'll need them for the extension config.**

---

## NEXT STEPS

Once backend is online:
1. ✅ Update `package.json` serverUrl
2. ✅ Rebuild extension
3. ✅ Improve UI
4. ✅ Add screenshots
5. ✅ Publish to Marketplace

Total time: **30-45 minutes** for full cloud deployment
