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

### Phase 1: Backend Health & Infrastructure Verification

**1.1 Verify Backend Service is Running**
```bash
# Check HTTP endpoint
curl -i https://pair-with-code-backend.onrender.com/health

# Expected response:
# HTTP/1.1 200 OK
# {"status": "ok", "timestamp": "2026-06-12T..."}
```

**1.2 Verify Database Connection**
- Check Render dashboard logs for the backend service
- Look for log line: `✓ Database pool initialized successfully` (or similar)
- If you see errors like "Cannot connect to database", check:
  - Database service is running (check Render dashboard)
  - DB credentials in environment variables are correct
  - Database is accessible from Render network (check security groups)

**1.3 Verify Redis Connection (if using)**
- Look for log line: `✓ Redis connected successfully`
- If Redis fails, system falls back to in-memory store (OK for testing, but won't scale)
- If you see "Unable to connect to Redis", either:
  - Fix Redis credentials, or
  - Continue testing with single-server mode (in-memory store)

**1.4 Check API Routes Are Registered**
```bash
# Test API endpoints exist
curl https://pair-with-code-backend.onrender.com/api/health
curl https://pair-with-code-backend.onrender.com/api/auth/status
```

---

### Phase 2: GitHub OAuth Authentication Setup

**2.1 Create GitHub OAuth App**
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** Pair With Code (Production)
   - **Homepage URL:** `https://pair-with-code-backend.onrender.com`
   - **Authorization callback URL:** `https://pair-with-code-backend.onrender.com/api/auth/github/callback`
4. GitHub generates `Client ID` and `Client Secret`
5. Copy both to Render dashboard environment variables:
   - `GITHUB_CLIENT_ID=<your-client-id>`
   - `GITHUB_CLIENT_SECRET=<your-client-secret>`
6. **Redeploy** the backend service (click "Redeploy" in Render dashboard)

**2.1a Also Set Up Local Development OAuth App (for Testing)**
For local testing during development, create a **separate** GitHub OAuth app:
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Fill in:
   - **Application name:** Pair With Code (Development)
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/github/callback`
3. Copy these credentials and use for `.env` in backend:
   ```
   GITHUB_CLIENT_ID_DEV=<your-dev-client-id>
   GITHUB_CLIENT_SECRET_DEV=<your-dev-client-secret>
   ```
4. The backend can detect environment (NODE_ENV) and use appropriate credentials

**2.2 Test GitHub Login Flow**
1. Recompile extension: `npm run compile` (in project root)
2. Start extension in debug mode: `F5`
3. Open Command Palette: `Ctrl+Shift+P`
4. Run: `Collaboration: Pair With Code: Sign in with GitHub`
5. A browser window should open to GitHub authorization page
6. Click "Authorize"
7. Extension should show "✓ Signed in as [your GitHub username]"
8. Check Render logs for: `✓ User [username] authenticated successfully`

---

### Phase 3: Room Creation & Collaboration Setup

**3.1 Create a Collaboration Room**
1. Open Command Palette: `Ctrl+Shift+P`
2. Run: `Collaboration: Pair With Code: Join Room`
3. Select option: **Create new room**
4. Enter room name: `test-room-1`
5. System generates a **Room ID** (8-character code)
6. **Copy this Room ID** - you'll share it with collaborators

**Expected UI:**
- Activity bar shows "Pair With Code" sidebar
- Status bar shows: "● Paired in room: test-room-1 (1 user)"
- Tree view shows room participants

**3.2 Verify Room Created in Database**
- Check Render database (PostgreSQL) for new record in `sessions` table
- Query: `SELECT id, name, created_by FROM sessions WHERE name = 'test-room-1'`

---

### Phase 4: Chat & Messaging

**4.1 Send Chat Messages**
1. In "Pair With Code" sidebar, find **Chat panel**
2. Type a test message: "Hello from production! 🎉"
3. Press Enter to send
4. Message should appear instantly in chat history
5. Check Render logs for: `✓ Message stored [timestamp]`

**4.2 Verify Chat Database Persistence**
- Query: `SELECT content, author FROM messages WHERE session_id = '<your-room-id>'`
- Your message should appear in results

**4.3 Test Chat with Multiple Users (Next Phase)**
- Once second user joins, messages should appear in real-time for both

---

### Phase 5: Code Review Features

**5.1 Create a Code Review Comment**
1. Open any file in editor
2. Right-click on a line of code
3. Select: `Pair With Code: Add Code Review Comment`
4. Enter comment: "This function should be refactored"
5. Comment should appear in code review panel
6. Line should be highlighted with color indicator

**5.2 Reply to Code Review Comments**
1. Hover over a code review comment
2. Click "Reply"
3. Type: "Good point! I'll create an issue for this."
4. Press Enter

**5.3 Change Comment Status**
1. Right-click on comment
2. Select status change: **Resolved** / **In Discussion** / **Blocked**
3. Status indicator should update in UI

**5.4 Generate Code Review Report**
1. Open Command Palette: `Ctrl+Shift+P`
2. Run: `Collaboration: Pair With Code: Code Review`
3. Select: **Generate Session Report**
4. System generates markdown report with all comments, replies, status
5. Save to file: `code-review-report.md`

**5.5 Verify Code Review Data Stored**
- Query: `SELECT * FROM code_review_comments WHERE session_id = '<your-room-id>'`
- All comments with timestamps should appear

---

### Phase 6: Session Recording

**6.1 Enable Recording**
1. Join room (see Phase 3)
2. Look for "Record" button in Pair With Code toolbar
3. Click to start recording
4. Status bar should show: "🔴 Recording in progress..."

**6.2 Perform Actions While Recording**
- Edit files
- Send chat messages
- Add code comments
- Terminal activity (if shared)
5 minutes of activity minimum

**6.3 Stop Recording**
1. Click "Stop Recording" button
2. System processes and saves video file
3. Check Render logs for: `✓ Recording saved: [filename]`
4. Recording file stored in backend storage (local or cloud)

**6.4 Verify Recording Playback**
1. Open Command Palette
2. Run: `Collaboration: Pair With Code: Recordings`
3. Select saved recording
4. Playback should work in VS Code or web interface

---

### Phase 7: Shared Terminal

**7.1 Start Shared Terminal**
1. Open integrated terminal in VS Code
2. Run: `Collaboration: Pair With Code: Start Shared Terminal`
3. Terminal session ID is generated
4. Collaborators can join with: `Collaboration: Join Terminal: <session-id>`

**7.2 Execute Commands in Shared Terminal**
1. Type any command: `npm --version`
2. Output should appear for all connected users in real-time
3. Check Render logs for Socket.io connections from multiple clients

**7.3 Terminal History & Replay**
1. Commands and output stored in database
2. Collaborators can access terminal history
3. Query: `SELECT * FROM terminal_sessions WHERE session_id = '<your-room-id>'`

---

### Phase 8: Activity Tracking & Presence

**8.1 View Participant Activity**
1. In Pair With Code sidebar, look at **Participants panel**
2. Each user shows:
   - Username
   - Current file
   - Cursor position
   - Last activity timestamp
3. When collaborator edits, their cursor should show in real-time

**8.2 Track File Changes**
1. Check Activity view: `Collaboration: Pair With Code: Activity`
2. Shows timeline of:
   - Who edited what file
   - When changes occurred
   - What was added/removed (diffs)

**8.3 Verify Activity in Database**
- Query: `SELECT * FROM activity_logs WHERE session_id = '<your-room-id>'`
- All file edits, chat messages, comments should be logged

---

### Phase 9: Command Palette - Full Feature Test

Open Command Palette (`Ctrl+Shift+P`) and verify these commands all work:

| Command | Expected Behavior |
|---------|-------------------|
| `Pair With Code: Sign in with GitHub` | Opens GitHub auth flow |
| `Pair With Code: Sign Out` | Clears auth token, shows signin button |
| `Pair With Code: Create Room` | Opens room creation dialog |
| `Pair With Code: Join Room` | Opens room selection/creation |
| `Pair With Code: Copy Room ID` | Copies current room ID to clipboard |
| `Pair With Code: Leave Room` | Disconnects from collaboration, closes panels |
| `Pair With Code: Settings` | Opens settings/preferences panel |
| `Pair With Code: Open Chat` | Shows/focuses chat panel |
| `Pair With Code: Add Code Review Comment` | Adds comment to selected code |
| `Pair With Code: Code Review` | Opens code review panel with session review |
| `Pair With Code: Start Session Recording` | Begins recording session |
| `Pair With Code: Stop Session Recording` | Ends recording, saves file |
| `Pair With Code: View Recordings` | Lists saved recordings |
| `Pair With Code: Start Shared Terminal` | Creates shareable terminal session |
| `Pair With Code: Debug Session` | Opens debugging tools for session |

---

### Phase 10: Multi-User Collaboration Testing

**10.1 Invite Second User**
1. User 1 (you): Create room "test-multi-user"
2. Copy Room ID
3. Send Room ID to User 2 (colleague, friend, or second browser tab)

**10.2 User 2 Joins**
1. User 2: Open extension, sign in with GitHub
2. Run: `Pair With Code: Join Room`
3. Paste Room ID from User 1
4. User 2 should instantly appear in Participants panel for User 1
5. User 1 should instantly appear in Participants panel for User 2

**10.3 Real-Time Synchronization Tests**
- **Chat**: User 1 sends message → appears instantly for User 2 ✓
- **Code edits**: User 1 edits file → User 2 sees cursor/changes in real-time ✓
- **Code comments**: User 1 adds comment → appears instantly for User 2 ✓
- **Cursor position**: User 1 moves cursor → shown to User 2 ✓
- **File switching**: User 1 opens different file → shown to User 2 ✓

**10.4 Conflict Resolution**
1. Both users edit same line at same time
2. System should show:
   - Conflict indicator in gutter
   - Option to accept User 1 / User 2 / Merge manually
   - Conflict resolution panel
3. Users can discuss in chat, agree on resolution, apply

**10.5 Verify Multi-User Data**
- Query: `SELECT username FROM session_participants WHERE session_id = '<room-id>'`
- Should show both User 1 and User 2
- Query: `SELECT COUNT(*) FROM activity_logs WHERE session_id = '<room-id>'`
- Should show activity from both users combined

---

### Phase 11: Performance & Stress Testing

**11.1 Chat Load Test**
1. Send 100 chat messages rapidly
2. All messages should appear in order without loss
3. Database should handle high insert rate
4. Check Render database CPU usage (should be <50%)

**11.2 Large File Editing**
1. Open large file (5000+ lines)
2. Make rapid edits/selections
3. Cursor tracking should remain smooth
4. No lag or desynchronization between users

**11.3 Long Session Stability**
1. Keep collaboration session open for 1+ hour
2. Verify no connection drops
3. Check Render logs for no errors or OOM conditions
4. Database connection pool healthy

---

### Phase 12: Final Integration & Production Checklist

**12.1 Verify All Features Working**
- [ ] GitHub OAuth login
- [ ] Room creation/joining
- [ ] Chat messaging
- [ ] Code review comments
- [ ] Session recording
- [ ] Shared terminal
- [ ] Activity tracking
- [ ] Multi-user sync
- [ ] All command palette commands functional
- [ ] No console errors in extension
- [ ] No errors in Render backend logs

**12.2 Performance Checks**
- [ ] Chat messages appear < 100ms latency
- [ ] Code edits sync < 200ms latency
- [ ] Cursor updates < 100ms latency
- [ ] No memory leaks (check browser DevTools)
- [ ] Database queries complete < 500ms
- [ ] Render service memory usage stable

**12.3 Database Integrity**
- [ ] All tables have data (sessions, users, messages, comments, etc.)
- [ ] No orphaned records (foreign keys intact)
- [ ] Timestamps are consistent and correct
- [ ] No duplicate entries

**12.4 Security Checks**
- [ ] JWT tokens valid and expiring correctly
- [ ] Passwords never logged or exposed
- [ ] CORS headers correct (only allow trusted origins)
- [ ] Rate limiting on auth endpoints active
- [ ] HTTPS enforced (no HTTP fallback)

**12.5 Documentation Update**
- [ ] Update `serverUrl` in marketplace docs
- [ ] Document OAuth setup steps for users
- [ ] Create troubleshooting guide for common issues
- [ ] Document features and limitations

---

## Testing Checklist Summary

```
Phase 1: Backend Infrastructure    ████████░░ 80%
├─ Health endpoint                 ✓
├─ Database connection             ✓
├─ Redis connection (optional)     ✓
└─ API routes registered           ✓

Phase 2: Authentication            ███░░░░░░░ 30%
├─ GitHub OAuth setup              ⧖ In Progress
├─ Login flow                       ○ Pending
└─ Token management                ○ Pending

Phase 3: Rooms & Collaboration     ░░░░░░░░░░ 0%
├─ Create room                     ○ Pending
├─ Join room                       ○ Pending
└─ Multi-user sync                 ○ Pending

Phase 4-11: Feature Validation     ░░░░░░░░░░ 0%
├─ Chat                            ○ Pending
├─ Code Review                     ○ Pending
├─ Recording                       ○ Pending
├─ Shared Terminal                 ○ Pending
├─ Activity Tracking               ○ Pending
├─ Commands                        ○ Pending
├─ Performance                     ○ Pending
└─ Multi-user Stability            ○ Pending

Phase 12: Production Ready         ░░░░░░░░░░ 0%
└─ All checks passing              ○ Pending
```

---

## What to Do If Tests Fail

**Chat not syncing:**
- Check Redis connection (or fall back to in-memory)
- Verify Socket.io not blocked by firewall
- Check WebSocket connection in browser DevTools (Network tab)

**Code comments not appearing:**
- Check database connection
- Verify `code_review_comments` table exists
- Look for query errors in Render logs

**Recording not working:**
- Verify `RECORDING_ENABLED=true` environment variable
- Check storage path is writable
- Verify ffmpeg available in Render container

**Multi-user desync:**
- Check Redis pub/sub working
- Verify room membership queries correct
- Look for race conditions in logs

**Performance issues:**
- Check database connection pool exhausted
- Monitor Render CPU/memory (may need upgrade)
- Verify query N+1 problems in logs
- Check WebSocket message frequency (may be too high)
