# PairWithCode - Production Deployment Checklist

**Purpose:** Complete guide for preparing the extension and backend for production deployment.

**Status:** Ready for deployment  
**Last Updated:** 2026-06-12

---

## 📋 PHASE 1: WHAT WE'VE COMPLETED (Already Done)

✅ **Code Quality & Security**
- Fixed all 68+ TypeScript compilation errors
- Security audit run: 0 vulnerabilities in frontend
- Removed all hardcoded secrets
- Fixed npm dependencies vulnerabilities

✅ **Full Implementation**
- All 8 feature modules implemented and tested
- All 10 WebView panels functional
- Complete backend with 11 API routes
- Database migrations ready
- Docker Compose setup

✅ **Git & Version Control**
- All code committed (Phase 7)
- Clean working directory
- Ready for production build

---

## 👤 PHASE 2: WHAT YOU NEED TO DO BEFORE PRODUCTION

### Step 1: **Azure DevOps Setup** (30 minutes)

#### Create Azure DevOps Account
1. Go to https://dev.azure.com
2. Sign in with Microsoft account (create one if needed)
3. Create new organization: `pair-with-code-org`
4. Create new project: `pair-with-code-extension`

#### Create Personal Access Token
1. Go to https://dev.azure.com → Settings (bottom left) → Personal access tokens
2. Click **+ New Token**
3. Set:
   - **Name:** `vsce-publish-token`
   - **Scopes:** Check "Marketplace: Publish"
   - **Expiration:** 1 year
4. **Copy token immediately** (can't retrieve later)
5. Save securely (you'll use this in Step 8)

**Store token in a safe place** (password manager, not in code)

---

### Step 2: **GitHub Setup** (Optional but Recommended)

#### Create GitHub OAuth App
1. Go to https://github.com/settings/developers → OAuth Apps
2. Click **New OAuth App**
3. Set:
   - **Application name:** `Pair With Code`
   - **Homepage URL:** `https://github.com/yourusername/pair-with-code`
   - **Authorization callback URL:** `http://localhost:3000/auth/github/callback`
4. Click **Register application**
5. Copy:
   - **Client ID**
   - **Client Secret** (generate if needed)

#### Create GitLab OAuth App (Optional)
1. Go to https://gitlab.com/-/oauth/applications
2. Click **New application**
3. Set:
   - **Name:** `Pair With Code`
   - **Redirect URI:** `http://localhost:3000/auth/gitlab/callback`
   - **Scopes:** `api` and `read_repository`
4. Click **Save application**
5. Copy:
   - **Application ID**
   - **Secret**

---

### Step 3: **Production Environment Setup** (20 minutes)

#### Update `.env` for Production

```bash
# Backend Config
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (Update with your production database)
DATABASE_URL=postgresql://prod_user:STRONG_PASSWORD@prod-db.example.com:5432/pairwithcode_prod
REDIS_URL=redis://prod-redis.example.com:6379

# JWT Security (Generate new secrets!)
JWT_SECRET=$(openssl rand -base64 32)  # Generate random 32-char secret
JWT_EXPIRY=7d

# OAuth Credentials (from Step 2)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret

# Server URLs
PRODUCTION_URL=https://your-domain.com
EXTENSION_REPO_URL=https://github.com/yourusername/pair-with-code

# Security
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com
HELMET_ENABLED=true
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

**IMPORTANT:** Never commit `.env` to git! Keep these values secure.

---

### Step 4: **Choose Hosting Provider** (Research - 1 hour)

Pick one for backend:

| Provider | Free Tier | Ease | Recommendation |
|----------|-----------|------|-----------------|
| **Heroku** | Yes (limited) | ⭐⭐⭐⭐⭐ | **Easiest for first-time** |
| **Railway** | Yes ($5/mo) | ⭐⭐⭐⭐ | Great alternative |
| **AWS** | Yes (1 year) | ⭐⭐⭐ | Most powerful, complex |
| **DigitalOcean** | No ($5/mo) | ⭐⭐⭐⭐ | Solid choice |
| **Render** | Yes (limited) | ⭐⭐⭐⭐⭐ | Good balance |

**Recommended:** Start with **Heroku** or **Render** for simplicity

---

### Step 5: **Deploy Backend** (Varies by provider)

#### Example: Heroku Deployment (30 minutes)

```bash
# 1. Install Heroku CLI
npm install -g heroku

# 2. Login to Heroku
heroku login

# 3. Create app
heroku create your-app-name

# 4. Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# 5. Add Redis
heroku addons:create heroku-redis:premium-0

# 6. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set GITHUB_CLIENT_ID=your_id
heroku config:set GITHUB_CLIENT_SECRET=your_secret
# ... repeat for all .env variables

# 7. Deploy
git push heroku main

# 8. Run migrations
heroku run npm run db:migrate

# 9. View logs
heroku logs --tail
```

**After deployment:**
- Backend URL: `https://your-app-name.herokuapp.com`
- Update `PRODUCTION_URL` in `.env` with this URL

---

### Step 6: **Update Extension Configuration** (10 minutes)

1. Update `src/extension.ts` default server URL:

```typescript
// Before (development)
default: "http://localhost:3000"

// After (production)
default: "https://your-app-name.herokuapp.com"
```

2. Update `package.json`:
   - `repository.url` → your GitHub repo URL
   - `publisher` → your Azure DevOps organization name

3. Optional: Update `README.md` with:
   - Production URL
   - Feature screenshots
   - Installation instructions
   - Contribution guidelines

---

### Step 7: **Final Testing** (30 minutes)

Before publishing, test everything:

```bash
# 1. Recompile with production config
npm run compile

# 2. Run extension in debug mode
# Press F5 in VS Code

# 3. Test with production backend
# Update settings to point to production URL
# Join a room and verify:
- [ ] Connection established
- [ ] Typing broadcast works
- [ ] Chat messages sync
- [ ] Code review works
- [ ] All features respond correctly
```

---

### Step 8: **Publish to VS Code Marketplace** (Final Step)

```bash
# 1. Install vsce (VS Code Extension CLI)
npm install -g vsce

# 2. Create a PAT token (if not done in Step 1)
# Go to https://dev.azure.com → Settings → Personal access tokens
# Token with "Marketplace: Publish" scope

# 3. Authenticate with token
vsce login LJ-Tech  # Your publisher name (from Azure DevOps)
# Paste token when prompted

# 4. Package extension
vsce package
# Creates: pair-with-code-1.0.2.vsix

# 5. Test package locally (optional)
code --install-extension pair-with-code-1.0.2.vsix

# 6. Publish to marketplace
vsce publish
# Or with specific version:
vsce publish 1.0.3

# 7. Verify on marketplace
# Go to https://marketplace.visualstudio.com
# Search for "Pair With Code"
# Should appear within 5-10 minutes
```

**✅ Done! Your extension is now available to download!**

---

## 🚀 PHASE 3: PRODUCTION DEPLOYMENT WORKFLOW

### Backend Deployment Checklist

- [ ] Database created and migrations applied
- [ ] Redis cache configured
- [ ] Environment variables set
- [ ] CORS URLs configured
- [ ] OAuth credentials verified
- [ ] SSL/HTTPS enabled
- [ ] Logging configured
- [ ] Health check endpoint tested: `GET /health`
- [ ] Error handling verified
- [ ] Rate limiting configured

### Extension Publishing Checklist

- [ ] All tests passing
- [ ] No console errors in debug mode
- [ ] Version bumped (semantic versioning)
- [ ] CHANGELOG.md updated
- [ ] README.md up-to-date
- [ ] Icons/screenshots included
- [ ] No hardcoded secrets in code
- [ ] No sensitive data in logs
- [ ] Dependencies audited
- [ ] Package published successfully

---

## 📱 PHASE 4: POST-LAUNCH MONITORING

### Monitor Backend

```bash
# View production logs
heroku logs --tail  # or equivalent for your provider

# Check performance
# Backend dashboard in hosting provider
# - CPU usage
# - Memory usage
# - Database connections
# - Error rates
```

### Monitor Extension

1. VS Code Marketplace dashboard
   - Download counts
   - User ratings
   - Bug reports

2. GitHub Issues
   - Create GitHub repo for bug tracking
   - Tag issues as `bug`, `feature`, `enhancement`

3. Analytics (Optional)
   - Add telemetry to track:
     - Feature usage
     - Session duration
     - Error frequency
     - Performance metrics

---

## 🔐 SECURITY BEST PRACTICES

### Before Going Live

✅ **Secrets Management**
- [ ] No `.env` file committed to git
- [ ] No API keys in code
- [ ] Environment variables used for all secrets
- [ ] JWT secret is cryptographically random

✅ **Data Protection**
- [ ] End-to-end encryption enabled
- [ ] Database passwords strong (16+ chars)
- [ ] HTTPS/SSL enforced
- [ ] CORS properly configured

✅ **Access Control**
- [ ] OAuth working for GitHub/GitLab
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (using parameterized queries)

✅ **Monitoring**
- [ ] Error logging enabled
- [ ] Failed login attempts logged
- [ ] Suspicious activity monitored
- [ ] Backup strategy in place

---

## 💰 COST ESTIMATES

| Component | Free Tier | Paid/Month | Notes |
|-----------|-----------|-----------|-------|
| **Heroku** | ~$7 | $50-200 | PostgreSQL + Redis add-ons |
| **Database** | 10GB free | $15-50 | Depends on size |
| **Redis Cache** | Limited | $5-30 | Optional optimization |
| **Domain** | - | $10-15 | Optional, use Heroku domain initially |
| **CDN/Storage** | - | $0-20 | For file uploads (optional) |
| **Monitoring** | Free | $0-50 | Optional tools |
| **TOTAL** | **$7/mo** | **$50-365/mo** | Start small, scale as needed |

**Recommendation:** Start with free tier ($7/mo), upgrade as user base grows

---

## 🎯 FINAL CHECKLIST

### Before You Click "Publish"

- [ ] Backend deployed and tested
- [ ] All environment variables configured
- [ ] OAuth credentials working
- [ ] Extension compiles without errors
- [ ] All features tested
- [ ] README and documentation updated
- [ ] Package.json version bumped
- [ ] Azure DevOps account created
- [ ] Personal access token created
- [ ] vsce authenticated
- [ ] Extension packaged locally
- [ ] Local package tested

### After Publishing

- [ ] Marketplace shows extension (5-10 min wait)
- [ ] Download link works
- [ ] Installation in VS Code succeeds
- [ ] Extension activates properly
- [ ] Connection to backend established
- [ ] Can create/join rooms
- [ ] Chat works
- [ ] All features functional

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue:** "Failed to connect to backend"
- **Solution:** Verify `PRODUCTION_URL` in extension settings points to correct deployed backend

**Issue:** "OAuth login fails"
- **Solution:** Check OAuth credentials in .env match GitHub/GitLab app settings

**Issue:** "Database connection refused"
- **Solution:** Verify DATABASE_URL is correct and database is running

**Issue:** "Extension won't install from marketplace"
- **Solution:** Clear VS Code cache, try reinstalling, check for conflicts

**Issue:** "Port 3000 already in use"
- **Solution:** Change PORT in .env or kill existing process

---

## 🎉 YOU'RE READY FOR PRODUCTION!

Once you complete all steps above, your extension will be:
- ✅ Published on VS Code Marketplace
- ✅ Deployed to production servers
- ✅ Secure and monitored
- ✅ Available to thousands of developers
- ✅ Scalable and maintainable

**Time to complete:** 2-4 hours total
**Next steps:** Monitor usage, fix bugs, iterate based on user feedback
