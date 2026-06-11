# 🧪 Pair With Code - Complete Testing Guide

## ✅ Prerequisites

- Docker + Docker Compose installed
- VS Code 1.85+
- Node.js 18+
- Git

---

## 🚀 QUICK START (5 minutes)

### Step 1: Clone & Setup
```bash
cd /path/to/pairwithcode
cp .env.example .env

# Verify .env has these (default values are fine):
# DB_USER=pairwithcode
# DB_PASSWORD=pairwithcode123
# DB_NAME=pairwithcode
# REDIS_HOST=localhost
# JWT_SECRET=your-super-secret-jwt-key-change-this
```

### Step 2: Start Backend Services
```bash
# This starts PostgreSQL, Redis, and backend server
docker-compose up -d

# Verify services are running
docker ps
# Should see: pair-with-code-postgres, pair-with-code-redis, pair-with-code-backend

# Check PostgreSQL is ready
docker-compose logs postgres | tail -20
# Look for: "database system is ready to accept connections"

# Check Redis is ready
docker-compose logs redis | tail -5
# Look for: "Ready to accept connections"

# Check backend server started
docker-compose logs backend | tail -20
# Look for: "Server running on http://localhost:3000"
```

### Step 3: Launch VS Code Extension (Debug Mode)
```bash
# From root directory
code .

# Press F5 to launch extension in debug
# Or: Run → Start Debugging
# A new VS Code window will open with the extension active
```

### Step 4: Join a Collaboration Room
```
In the debug window:
1. Command Palette (Cmd+Shift+P)
2. Type "Pair Tool: Menu"
3. Select "Copy Room ID"
4. You'll be prompted to join/create a room
   - Enter: test-room-1
5. Wait for "✅ Connected to session!" message
```

---

## 🧪 TESTING CHECKLIST

### Phase 1: Connection & Basic Setup ✅

**[TEST 1] Extension Loads**
- [ ] F5 launches debug window
- [ ] No errors in console
- [ ] Status bar shows "Pair: Ready"

**[TEST 2] Connect to Room**
- [ ] Run "Pair Tool: Menu" command
- [ ] Status bar changes to "Pair: Online" (green dot)
- [ ] Toast: "✅ Connected to session!"

**[TEST 3] Connection Persists**
- [ ] Make an edit in a file (add a comment)
- [ ] Status bar stays "Pair: Online"
- [ ] No errors in console (F1 → Open Debug Console)

---

### Phase 2: Chat Panel 💬

**[TEST 4] Open Chat Panel**
```
Cmd+Shift+P → "Pair Tool: Open Chat"
```
- [ ] Chat panel opens in right sidebar
- [ ] Shows "No messages yet. Start typing!"
- [ ] Input box says "Type a message..."

**[TEST 5] Send a Message**
```
Type: "Hello from client 1" → Press Enter
```
- [ ] Message appears in bubble (blue, right-aligned)
- [ ] Shows current timestamp
- [ ] Input clears after send
- [ ] No errors in backend logs: `docker-compose logs backend | grep -i error`

**[TEST 6] Multi-client Chat**
```
In same room from another VS Code instance:
1. Repeat steps 1-4 from QUICK START
2. Send message: "Hello from client 2"
3. Both clients should see both messages
```
- [ ] Client 1 sees Client 2's message (gray, left-aligned)
- [ ] Client 2 sees Client 1's message (blue, right-aligned)
- [ ] Messages are in correct order
- [ ] Timestamps are accurate

**[TEST 7] Typing Indicator** (Optional - depends on Socket.io relay)
- [ ] When typing, other client might see "✍️ typing" indicator

---

### Phase 3: Inline Remote Cursors 👁️

**[TEST 8] Cursor Rendering**
```
Client 1 in same file:
1. Click at different lines
2. Move cursor around
```
- [ ] Client 2 sees colored cursor line (left margin)
- [ ] User name appears above cursor
- [ ] Cursor moves smoothly (not jumpy)

**[TEST 9] Selection Highlighting**
```
Client 1:
1. Select multiple lines of code
```
- [ ] Client 2 sees semi-transparent highlight
- [ ] Color matches cursor color

**[TEST 10] Multi-Cursor Support**
```
Get 3+ clients in same room and file
```
- [ ] Each has different cursor color
- [ ] All cursors visible simultaneously
- [ ] No cursor color conflicts

---

### Phase 4: Presence Panel 👥

**[TEST 11] Open Presence Panel**
```
Cmd+Shift+P → "Pair Tool: Show Collaborators"
```
- [ ] Panel opens in right sidebar
- [ ] Shows "Room: test-room-1"
- [ ] Lists all connected users
- [ ] Shows status (✨ Active, ✍️ Typing, 💤 Idle)
- [ ] Displays current file + line number

**[TEST 12] Real-time Updates**
```
Client 1: Switch files
Client 2: Watch Presence panel
```
- [ ] Client 2's file updates immediately
- [ ] Line number changes when cursor moves

**[TEST 13] Copy Room ID**
```
Click "Copy Room ID" in Presence panel
```
- [ ] Toast: "Room ID copied to clipboard!"
- [ ] Can paste into another terminal

---

### Phase 5: Settings Panel ⚙️

**[TEST 14] Open Settings**
```
Cmd+Shift+P → "Pair Tool: Settings"
```
- [ ] Panel opens
- [ ] Shows: Server URL, Display Name, Theme
- [ ] Shows toggles: Auto-join, Follow mode, Auto-reconnect

**[TEST 15] Theme Switching**
```
Select "Dark" → "Light" → "Auto"
```
- [ ] Chat panel theme changes instantly
- [ ] All panels update colors
- [ ] Dark mode has good contrast

**[TEST 16] Settings Persistence**
```
Change Display Name to "Alice"
Close and reopen extension
```
- [ ] Name is saved
- [ ] Persists across sessions

---

### Phase 6: Shortcuts Panel ⌨️

**[TEST 17] Open Shortcuts**
```
Cmd+Shift+P → "Pair Tool: Keyboard Shortcuts"
```
- [ ] Panel shows all commands
- [ ] Lists keybindings (Ctrl+Shift+C, etc.)
- [ ] Organized by category

---

### Phase 7: Backend API Testing 🔌

**[TEST 18] Health Check**
```bash
curl http://localhost:3000/health
```
- [ ] Returns: `{"status":"ok","timestamp":"...",...}`

**[TEST 19] Message API**
```bash
# Create message
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-room-1",
    "userId": "user-123",
    "userName": "Alice",
    "content": "Hello via API"
  }'
```
- [ ] Returns 201 with message object
- [ ] Check backend logs: `docker-compose logs backend`

**[TEST 20] Get Messages**
```bash
curl http://localhost:3000/api/messages/test-room-1
```
- [ ] Returns array of messages
- [ ] Messages are in reverse chronological order
- [ ] Includes reactions: `[]`

**[TEST 21] Create Session**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "new-session",
    "ownerId": "user-123",
    "isPublic": true
  }'
```
- [ ] Returns 201 with session object
- [ ] Session ID is a UUID

**[TEST 22] Get Session**
```bash
curl http://localhost:3000/api/sessions/{SESSION_ID}
```
- [ ] Returns session details
- [ ] Shows participant count

**[TEST 23] Analytics Endpoint**
```bash
curl -X POST http://localhost:3000/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-room-1",
    "userId": "user-123",
    "eventType": "typing"
  }'
```
- [ ] Returns 201 with success: true

---

## 🐛 DEBUGGING TIPS

### Check if Services are Running
```bash
# PostgreSQL
docker-compose logs postgres | tail -20

# Redis  
docker-compose logs redis | tail -20

# Backend
docker-compose logs backend | tail -50
docker-compose logs backend | grep -i error
```

### Check Database Directly
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U pairwithcode -d pairwithcode

# Then in psql:
SELECT * FROM messages LIMIT 10;
SELECT * FROM sessions LIMIT 10;
SELECT * FROM session_participants LIMIT 10;
\q
```

### Monitor Socket.io Events
In debug console of VS Code (F1 → Open Debug Console):
```javascript
// Will show socket events if you add logging
```

### Check Extension Logs
```bash
F1 → "Developer: Open Extension Logs"
# Look for errors and debug output
```

### Stop & Restart Services
```bash
# Stop all
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

---

## ❌ TROUBLESHOOTING

### "Failed to connect"
```bash
# Check backend is running
docker ps | grep backend

# Check logs
docker-compose logs backend | tail -20

# Restart
docker-compose restart backend
```

### "Connection refused"
```bash
# Verify port 3000 is open
lsof -i :3000

# Or start backend manually:
cd backend
npm install
npm run dev
```

### "Database connection error"
```bash
# Check PostgreSQL
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d

# Wait 10 seconds, then try reconnecting in VS Code
```

### "Socket.io timeout"
```bash
# Check server URL in settings
Cmd+Shift+P → "Pair Tool: Settings"
# Should be: https://pairwithcode.onrender.com (or localhost:3000)

# Test connection:
curl http://localhost:3000/health
```

### Chat messages not appearing
```bash
# Check backend logs for message creation
docker-compose logs backend | grep -i message

# Check database
docker-compose exec postgres psql -U pairwithcode -d pairwithcode
SELECT COUNT(*) FROM messages;
```

---

## 📊 EXPECTED BEHAVIOR

### Session Starts
```
VS Code Extension starts
  ↓
Prompt for Room ID
  ↓
Enter: test-room-1
  ↓
Status: "Connecting..."
  ↓
Backend receives JOIN_ROOM event
  ↓
Database records session_participants entry
  ↓
Status: "Online" (green dot)
  ↓
Toast: "✅ Connected to session!"
```

### User Sends Message
```
Client A types in chat panel
  ↓
Extension sends SEND_MESSAGE via Socket.io
  ↓
Backend receives event
  ↓
Backend stores in messages table
  ↓
Backend broadcasts to all clients in room
  ↓
Client A: Message appears in blue bubble (right)
  ↓
Client B: Message appears in gray bubble (left)
```

### Cursor Moves
```
Client A clicks in editor
  ↓
Extension captures cursor position
  ↓
Sends REMOTE_CURSOR via Socket.io
  ↓
Backend broadcasts to room
  ↓
Client B receives event
  ↓
Cursor renderer creates decoration
  ↓
Client B sees colored cursor with name
```

---

## ✅ FULL TEST RUN (20 minutes)

1. **[TESTS 1-3]** Connection & Setup (3 min)
2. **[TESTS 4-7]** Chat Panel (5 min)
3. **[TESTS 8-10]** Inline Cursors (4 min)
4. **[TESTS 11-13]** Presence Panel (4 min)
5. **[TESTS 14-16]** Settings (2 min)
6. **[TESTS 17]** Shortcuts (1 min)
7. **[TESTS 18-23]** API Verification (6 min)

**If all tests pass: ✅ Phase 1 is fully functional**

---

## 🎯 WHAT'S READY TO TEST

✅ Chat messages (full end-to-end)  
✅ Inline cursors (real-time)  
✅ Presence tracking  
✅ Settings persistence  
✅ Backend API routes  
✅ Database storage  
✅ Dark mode + animations  
✅ Multi-client synchronization

---

## 🚀 WHAT'S COMING NEXT (Phase 2)

- Session Recording & Playback
- Code Review Annotations
- Session Analytics Dashboard
- GitHub/GitLab OAuth
- Audio/Video calling
- End-to-End Encryption
- AI-Assisted Conflict Resolution
