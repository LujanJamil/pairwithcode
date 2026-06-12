# Deploying to Render

## Prerequisites
- ✅ Render account (you have this)
- ✅ GitHub repo connected to Render (LujanJamil/pairwithcode)

## Step 1: Create a New Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. If prompted, authenticate with GitHub and authorize Render
5. Choose repository: **LujanJamil/pairwithcode**
6. Branch: **main** (or your deployment branch)

## Step 2: Configure the Web Service

**Basic Settings:**
- **Name:** `pair-with-code-backend` (or any name you prefer)
- **Root Directory:** `backend` (important!)
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Instance Type:** Free (for testing) or Starter (recommended for production)

## Step 3: Add Environment Variables

Click **"Advanced"** and add these environment variables:

```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,https://<your-render-domain>.onrender.com
DB_HOST=<your-postgres-host>
DB_PORT=5432
DB_USER=<your-postgres-user>
DB_PASSWORD=<your-postgres-password>
DB_NAME=<your-postgres-database>
DB_SSL=true
REDIS_HOST=<your-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<your-redis-password>
REDIS_DB=0
JWT_SECRET=<generate-a-secure-random-string-at-least-32-chars>
JWT_EXPIRES_IN=7d
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
STORAGE_TYPE=local
RECORDING_ENABLED=true
RECORDING_FPS=30
RECORDING_BITRATE=2500k
RECORDING_FORMAT=mp4
```

## Step 4: Set Up PostgreSQL Database

You need a PostgreSQL database. Options:

### Option A: Use Render's PostgreSQL (Easiest)
1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Name it `pair-with-code-db`
3. Region: Same as your web service
4. PostgreSQL Version: 14+
5. Create database
6. Render will provide connection details - copy them to your environment variables:
   - `DB_HOST`: (from "Connections" section, internal host)
   - `DB_USER`: postgres (default)
   - `DB_PASSWORD`: (Render generates this)
   - `DB_NAME`: postgres (or create a new database)

### Option B: Use External PostgreSQL
- If you have an existing database, just add the connection details

## Step 5: Set Up Redis (Optional for Single-Server)

Options:

### Option A: Use Render Redis (Recommended)
1. Click **"New +"** → **"Redis"**
2. Name it `pair-with-code-redis`
3. Region: Same as web service
4. Plan: Free or Starter
5. Create and copy connection details to:
   - `REDIS_HOST`: (from "Connections")
   - `REDIS_PORT`: (from "Connections")
   - `REDIS_PASSWORD`: (from "Connections")

### Option B: Use External Redis Service
- Upstash (free tier available): https://upstash.com
- Or any Redis hosting provider

### Option C: Skip for Now (Single-Server Mode)
- The backend runs in fallback mode without Redis
- Set `REDIS_HOST=localhost` and it will gracefully degrade
- **Note:** Collaboration features work but only for single server (no horizontal scaling)

## Step 6: Deploy

1. After adding all environment variables, click **"Deploy"**
2. Wait for build and deployment to complete (~3-5 minutes)
3. Once deployed, Render provides a public URL like: `https://pair-with-code-backend.onrender.com`
4. **Copy this URL** - you'll need it for the next step

## Step 7: Verify Backend is Running

Test the backend endpoint:
```bash
curl https://pair-with-code-backend.onrender.com/health
```

Should return a success response (200 OK or similar).

## Step 8: Update Extension Config

In VS Code extension (`package.json`):

1. Open `src/package.json` (in the root, NOT the backend)
2. Find line ~145: `"serverUrl": "https://pairwithcode.onrender.com"`
3. Replace with your actual Render backend URL:
   ```json
   "serverUrl": "https://pair-with-code-backend.onrender.com"
   ```
4. Save and recompile the extension

## Step 9: Test Connection

1. Recompile the extension: `npm run compile` (in root)
2. Start the extension in debug mode (F5)
3. Try the "Pair With Code: Join Room" command
4. Check the backend logs in Render dashboard for connection success

## Troubleshooting

### Deployment Fails
- Check build logs in Render dashboard
- Ensure Node version matches: `engines.node` in package.json

### Backend starts but shows errors
- Check environment variables are set correctly
- If DB/Redis fail, backend falls back to mock mode (logs show WARN messages)
- This is OK for testing, but data won't persist

### Extension can't connect to backend
- Verify the CORS_ORIGIN environment variable includes your extension's URL
- Check browser console for CORS errors
- Verify the serverUrl in extension package.json matches the Render domain exactly

### "Cold start" timeout
- Free Render instances spin down after inactivity (~15 min)
- First request after spin-down takes 30-60 seconds
- Upgrade to Starter tier for consistent availability

## Next Steps After Deployment

1. ✅ Verify backend is accessible
2. ✅ Test extension connects and joins a room
3. ✅ Improve UI/styling (chat, settings panels)
4. ✅ Make all command palette commands functional
5. ✅ Prepare for marketplace publishing
