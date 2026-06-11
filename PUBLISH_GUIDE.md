# 📢 HOW TO PUBLISH YOUR EXTENSION - STEP BY STEP

**Expected Time:** 1-2 hours  
**Difficulty:** Beginner-friendly

---

## ✅ PRE-REQUISITES (Do These FIRST)

### 1. **Microsoft Account** (5 minutes)
- Go to https://account.microsoft.com
- Create account if you don't have one
- Write down email (you'll use it everywhere)

### 2. **GitHub Account** (5 minutes)
- Go to https://github.com/signup
- Create account (use same email as Microsoft if possible)
- Create new repository named `pair-with-code` (public)
- Push your code to this repo

---

## 🎯 MAIN STEPS

### STEP 1: Create Azure DevOps Organization (10 minutes)

**What you're doing:** Creating the marketplace publisher account

1. **Go to:** https://dev.azure.com
2. **Click:** "Create new organization"
3. **Name it:** `pair-with-code` (no spaces)
4. **Click:** "Continue"
5. **Create new project:** Name it `pair-with-code-publisher`
6. **Click:** "Create project"

**✅ You now have a marketplace publisher!**

---

### STEP 2: Create Publisher PAT Token (5 minutes)

**What you're doing:** Creating authentication token for marketplace

1. **Go to:** https://dev.azure.com
2. **Click:** Settings (gear icon, bottom left)
3. **Click:** "Personal access tokens"
4. **Click:** "+ New Token"
5. **Fill in:**
   ```
   Name: vsce-publish-token
   Organization: All accessible organizations
   Scopes: Marketplace → Publish
   Expiration: 1 year
   ```
6. **Click:** "Create"
7. **Copy the token immediately** (appears only once!)
8. **Paste it somewhere safe** - you'll need it in Step 5

**✅ Token created and saved!**

---

### STEP 3: Setup GitHub OAuth (Optional but Recommended) (10 minutes)

**What you're doing:** Allow users to login via GitHub

1. **Go to:** https://github.com/settings/developers
2. **Click:** "OAuth Apps" → "New OAuth App"
3. **Fill in:**
   ```
   Application name: Pair With Code
   Homepage URL: https://github.com/yourusername/pair-with-code
   Authorization callback URL: http://localhost:3000/auth/github/callback
   ```
4. **Click:** "Register application"
5. **Copy:**
   - Client ID
   - Client Secret (click "Generate" if needed)
6. **Save these** - you'll use them in production .env

**✅ OAuth app created!**

---

### STEP 4: Deploy Backend to Production (30 minutes)

**What you're doing:** Put your backend server on the internet

#### Option A: Heroku (Easiest)

1. **Create account:** https://heroku.com
2. **Install Heroku CLI:**
   ```bash
   npm install -g heroku
   ```
3. **Login to Heroku:**
   ```bash
   heroku login
   ```
4. **Create app:**
   ```bash
   heroku create your-app-name-here
   ```
   (Replace `your-app-name-here` with unique name)

5. **Add database and cache:**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   heroku addons:create heroku-redis:premium-0
   ```

6. **Set environment variables:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=$(openssl rand -base64 32)
   heroku config:set GITHUB_CLIENT_ID=your_id_from_step3
   heroku config:set GITHUB_CLIENT_SECRET=your_secret_from_step3
   ```

7. **Deploy:**
   ```bash
   git push heroku main
   ```

8. **Copy your URL:**
   - Appears in console as: `https://your-app-name.herokuapp.com`
   - Save this - you'll need it in Step 5

**✅ Backend is live!**

#### Option B: Other Platforms
- **Railway:** https://railway.app (similar to Heroku)
- **Render:** https://render.com (free tier available)
- **DigitalOcean:** https://digitalocean.com ($5/month)

---

### STEP 5: Update Extension Configuration (5 minutes)

**What you're doing:** Point extension to your production backend

1. **Open** `src/extension.ts`
2. **Find this line:**
   ```typescript
   "serverUrl": {
     "type": "string",
     "default": "https://pairwithcode.onrender.com",
   ```
3. **Replace with your backend URL from Step 4:**
   ```typescript
   "serverUrl": {
     "type": "string",
     "default": "https://your-app-name.herokuapp.com",
   ```

4. **Open** `package.json`
5. **Update these fields:**
   ```json
   "publisher": "your-azure-org-name",
   "repository": {
     "type": "git",
     "url": "https://github.com/yourusername/pair-with-code"
   },
   ```

6. **Save both files**

**✅ Configuration updated!**

---

### STEP 6: Build and Package Extension (5 minutes)

**What you're doing:** Create the final .vsix file for marketplace

```bash
# Compile TypeScript
npm run compile

# Install vsce (packaging tool)
npm install -g vsce

# Login to marketplace
vsce login

# When prompted, enter your Azure DevOps organization name
# Then paste your PAT token from Step 2

# Package the extension
vsce package
```

**This creates:** `pair-with-code-1.0.2.vsix`

**✅ Extension packaged!**

---

### STEP 7: Test Locally (5 minutes)

**What you're doing:** Make sure it works before publishing

```bash
# Uninstall existing version
code --uninstall-extension LJ-Tech.pair-with-code

# Install local package
code --install-extension pair-with-code-1.0.2.vsix

# Launch VS Code and test:
# 1. Press F1 → type "Pair Tool: Menu"
# 2. Enter room ID
# 3. Should show "✅ Connected to session!"
```

**✅ Works locally!**

---

### STEP 8: Publish to Marketplace (2 minutes)

**What you're doing:** Make your extension available to millions of developers

```bash
# Make sure you're authenticated (from Step 6)
# If not, run: vsce login

# Publish!
vsce publish

# Or with new version:
vsce publish 1.0.3
```

**Wait 5-10 minutes...**

Then check: https://marketplace.visualstudio.com/search?term=pair%20with%20code

**✅ Your extension is live!**

---

## 📊 WHAT HAPPENS AFTER PUBLISHING

1. **Users can install from marketplace**
   - Search for "Pair With Code"
   - Click Install
   - Restart VS Code

2. **Updates go live automatically**
   - Edit code
   - Bump version in `package.json`
   - Run: `vsce publish 1.0.3`
   - Takes 5-10 minutes to appear

3. **Monitor your extension**
   - Downloads counter
   - User ratings
   - Bug reports on GitHub

---

## 🚨 TROUBLESHOOTING

### Issue: "vsce publish" fails with authentication error
**Solution:** Run `vsce logout` then `vsce login` again

### Issue: "Cannot find module 'tweetnacl'" during compile
**Solution:** Run `npm install` in project root

### Issue: Backend connection fails after publishing
**Solution:** 
1. Check backend is running: Visit `https://your-backend-url.herokuapp.com/health`
2. Update extension server URL to match your backend

### Issue: Extension won't install from marketplace
**Solution:**
1. Clear VS Code cache: Delete `~/.vscode`
2. Restart VS Code
3. Try installing again

---

## 🎯 SUCCESS CHECKLIST

Before you declare victory, verify:

- [ ] Extension published on marketplace
- [ ] Can search for "Pair With Code" and find it
- [ ] Installation from marketplace works
- [ ] Extension activates without errors
- [ ] Can join a room and connect
- [ ] Backend connection successful
- [ ] Chat messages sync between users
- [ ] All features working

---

## 📞 NEXT STEPS

1. **Share with users:** Post on Reddit r/neovim, Twitter, Dev.to
2. **Get feedback:** Monitor GitHub issues
3. **Fix bugs:** Create releases with fixes
4. **Add features:** Iterate based on user feedback
5. **Scale backend:** Monitor usage and upgrade as needed

---

## 🎉 CONGRATULATIONS!

You've successfully:
- ✅ Built a production-grade collaborative IDE extension
- ✅ Deployed a backend server
- ✅ Published to VS Code Marketplace
- ✅ Made your code available to thousands of developers

**Your journey as an extension publisher has begun!**

Need help? Check:
- GitHub: https://github.com/microsoft/vscode-extension-samples
- Docs: https://code.visualstudio.com/api
- Community: https://stackoverflow.com/questions/tagged/visual-studio-code

Happy coding! 🚀
