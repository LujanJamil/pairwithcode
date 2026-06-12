# 🚀 VS Code Marketplace Publishing Guide

**Complete step-by-step guide to publish Pair With Code PRO to the VS Code Marketplace.**

---

## ✅ PRE-PUBLICATION CHECKLIST

- [x] Extension compiles without errors
- [x] All features tested and working
- [x] Professional UI styling applied
- [x] Marketplace metadata updated in `package.json`
- [x] README with proper formatting created
- [x] CHANGELOG with version history created
- [x] Extension icon (128x128) created
- [x] Repository URL configured
- [x] Bug tracking configured
- [x] License file included

---

## 📝 STEP 1: Prepare Your Files

### 1.1 Extension Icon
**File**: `images/icon.png`
- Size: **128x128 pixels** (PNG format)
- Create a professional icon for your extension
- Should be recognizable and match your branding

### 1.2 Verify package.json
```json
{
  "name": "pair-with-code",
  "displayName": "Pair With Code PRO",
  "publisher": "LJ-Tech",
  "version": "1.0.3",
  "description": "Real-time collaborative IDE...",
  "repository": {
    "url": "https://github.com/LujanJamil/pairwithcode"
  },
  "icon": "images/icon.png",
  "galleryBanner": {
    "color": "#6366f1",
    "theme": "dark"
  }
}
```

### 1.3 Check Files Exist
```
✓ README.md (marketplace copy)
✓ CHANGELOG.md (version history)
✓ LICENSE (MIT, Apache, etc.)
✓ images/icon.png (128x128)
✓ images/banner.png (1200x75, optional)
✓ .vscodeignore (exclude from package)
```

---

## 🔐 STEP 2: Create Microsoft Account & Publisher

### 2.1 Create Microsoft Account
1. Go to https://azure.microsoft.com
2. Sign up for a free account
3. Verify email

### 2.2 Create Publisher Profile
1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with Microsoft account
3. Click **"Create publisher"**
4. Fill in:
   - **Publisher ID**: `LJ-Tech` *(must be unique)*
   - **Publisher Name**: `LJ Tech`
5. Click **Create**

### 2.3 Get Personal Access Token (PAT)
1. Go to https://dev.azure.com
2. Click **User settings** (top right)
3. Select **Personal access tokens**
4. Click **New Token**
5. Fill in:
   - **Name**: `vsce-publish-token`
   - **Expiration**: 1 year
   - **Scopes**: Select **Marketplace (Publish)**
6. Click **Create**
7. **Copy the token** (you won't see it again!)

---

## 📦 STEP 3: Install & Configure vsce

### 3.1 Install vsce (Visual Studio Code Extension CLI)
```bash
npm install -g @vscode/vsce
```

### 3.2 Verify Installation
```bash
vsce --version
```

You should see: `version X.X.X`

### 3.3 Login to Marketplace
```bash
vsce login LJ-Tech
```

When prompted:
- **Publisher name**: `LJ-Tech`
- **Personal Access Token**: *(paste your token from Step 2.3)*

✅ You'll see: `The token was successfully verified`

---

## 🎁 STEP 4: Package Extension

### 4.1 Create .vscodeignore
File: `.vscodeignore`
```
.git
.gitignore
node_modules
src
tsconfig.json
webpack.config.js
**/*.ts
**/*.map
.DS_Store
.claude
```

### 4.2 Package the Extension
```bash
vsce package
```

**Expected output:**
```
Publishing LJ-Tech/pair-with-code v1.0.3...
 WARN  A bundled extension should have a .vscodeignore file. Learn more about vscodeignore on https://code.visualstudio.com/api/working-with-extensions/publishing-extension#\_vscodeignore
Created: /path/to/pair-with-code-1.0.3.vsix
```

✅ You now have: `pair-with-code-1.0.3.vsix`

---

## 🚀 STEP 5: Publish to Marketplace

### Option A: Publish Directly (Easiest)
```bash
vsce publish
```

OR with version bump:
```bash
vsce publish minor
```

**Expected output:**
```
Publishing LJ-Tech/pair-with-code v1.0.3...
 ✓ Packaged: /path/to/pair-with-code-1.0.3.vsix (2.5MB)
 ✓ Published to the Visual Studio Code Marketplace
Your extension has been published. You can see it at:
https://marketplace.visualstudio.com/items?itemName=LJ-Tech.pair-with-code
```

### Option B: Publish from VSIX File
```bash
vsce publish -i pair-with-code-1.0.3.vsix
```

---

## ✅ STEP 6: Verify Publication

### 6.1 Check on Marketplace
Visit: `https://marketplace.visualstudio.com/items?itemName=LJ-Tech.pair-with-code`

You should see:
- ✓ Extension name
- ✓ Description
- ✓ Icon
- ✓ Download button
- ✓ README preview
- ✓ Version info

### 6.2 Install from VS Code
1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions panel)
3. Search: `pair with code`
4. Click **Install**

### 6.3 Verify Installation
1. Open Command Palette: `Ctrl+Shift+P`
2. Search: `Pair Tool`
3. You should see all commands listed

✅ **Success! Your extension is published!**

---

## 🔄 STEP 7: Update in Future

### Bump Version
```bash
vsce publish patch   # 1.0.3 → 1.0.4
vsce publish minor   # 1.0.3 → 1.1.0
vsce publish major   # 1.0.3 → 2.0.0
```

### Update CHANGELOG
1. Update `CHANGELOG.md` with new features
2. Update `package.json` version number
3. Commit and push to GitHub
4. Run: `vsce publish`

---

## 📊 STEP 8: Monitor & Maintain

### Track Stats
- Visit: https://marketplace.visualstudio.com/manage
- View:
  - Downloads
  - Ratings & Reviews
  - Activity timeline

### Respond to Reviews
1. Check Reviews tab regularly
2. Reply to user feedback
3. Fix reported bugs quickly

### Update Regularly
- Push updates every 2-4 weeks
- Fix bugs immediately
- Add requested features

---

## 🎯 Marketing Tips

### After Publication

#### 1. Share on Social Media
```
🚀 Just published "Pair With Code PRO" to VS Code Marketplace!

Real-time collaborative coding for teams.
📊 Live analytics
🔍 Code review
💬 Chat & presence
🤖 AI conflict resolution

Get it here: [marketplace link]
#vscode #collaboration #productivity
```

#### 2. GitHub Announcement
- Create a release on GitHub
- Link to marketplace
- Copy changelog
- Add download instructions

#### 3. Reddit/Dev Communities
- Post on r/vscode
- Share on Dev.to
- Post in relevant communities

#### 4. Personal Network
- Share with your team
- Ask for reviews
- Request feedback

---

## 🐛 Troubleshooting

### Issue: "Publisher not found"
```bash
# Solution: Verify publisher exists
vsce publishers
```

### Issue: "Token expired"
```bash
# Solution: Create new PAT and re-login
vsce login LJ-Tech
```

### Issue: "File too large"
```bash
# Solution: Check .vscodeignore excludes node_modules
# Or use webpack to bundle
```

### Issue: "Cannot publish - already exists"
```bash
# Solution: Bump version number in package.json
# Then try again: vsce publish
```

---

## 📚 Resources

- **VS Code Extension Docs**: https://code.visualstudio.com/api
- **Publishing Guide**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **Marketplace**: https://marketplace.visualstudio.com
- **vsce Documentation**: https://github.com/microsoft/vscode-vsce

---

## ✨ Final Checklist

Before publishing:
- [ ] Extension compiles without errors
- [ ] All tests pass
- [ ] README is professional
- [ ] CHANGELOG is updated
- [ ] Icon is 128x128 PNG
- [ ] package.json metadata is complete
- [ ] .vscodeignore file exists
- [ ] Repository URL is correct
- [ ] License file included
- [ ] VERSION bumped in package.json

**Ready to publish? Run:**
```bash
vsce publish
```

---

## 🎉 You're All Set!

Your extension is now available to **millions of developers worldwide** on the VS Code Marketplace!

Happy coding! 🚀

---

**Questions?** Check the [official VS Code docs](https://code.visualstudio.com/api) or GitHub Issues.
