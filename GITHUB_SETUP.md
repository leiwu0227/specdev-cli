# GitHub Setup Guide

## 🚀 Quick Upload to GitHub

### Step 1: Create GitHub Repository

1. Go to: https://github.com/new
2. Fill in:
   - **Repository name:** `specdev-cli`
   - **Description:** "CLI to initialize SpecDev workflow system"
   - **Visibility:** ✅ **Public**
   - **Initialize:** ❌ Don't add README/gitignore (we have them)
3. Click **"Create repository"**

### Step 2: Upload Your Code

Run these commands in your terminal:

```bash
cd /mnt/h/oceanwave/lib/specdev-cli

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: SpecDev CLI v1.0.0"

# Add GitHub remote (REPLACE 'YOUR_USERNAME' with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/specdev-cli.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Update README

After uploading, replace `YOUR_USERNAME` in README.md with your actual GitHub username:

```bash
# Find and replace YOUR_USERNAME with your actual username
# For example, if your username is "johndoe":
sed -i 's/YOUR_USERNAME/johndoe/g' README.md

# Commit the update
git add README.md
git commit -m "Update installation instructions with GitHub username"
git push
```

---

## 📦 How Others Will Use It

Once uploaded to GitHub, anyone can use your CLI in these ways:

### Method 1: Install Globally from GitHub
```bash
npm install -g github:YOUR_USERNAME/specdev-cli
specdev init
```

### Method 2: Clone and Link
```bash
git clone https://github.com/YOUR_USERNAME/specdev-cli.git
cd specdev-cli
npm install
npm link
specdev init
```

### Method 3: Use npx (No Installation)
```bash
npx github:YOUR_USERNAME/specdev-cli init
```

---

## ✅ Verification Steps

After uploading, verify it works:

1. **Check GitHub:** Visit https://github.com/YOUR_USERNAME/specdev-cli
2. **Test Installation:**
   ```bash
   # In a new terminal/directory
   npm install -g github:YOUR_USERNAME/specdev-cli

   # Test it
   mkdir test-project
   cd test-project
   specdev init
   ```

3. **Check Created Files:**
   ```bash
   ls -la .specdev/
   ```

---

## 🔧 Troubleshooting

### Issue: "Permission denied" when pushing
**Solution:** Set up SSH keys or use Personal Access Token
- SSH: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- Token: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token

### Issue: "Repository not found"
**Solution:**
- Double-check the repository URL
- Make sure you replaced YOUR_USERNAME with your actual username
- Verify the repository is public on GitHub

### Issue: "npm install from GitHub fails"
**Solution:**
- Make sure package.json has correct "bin" entry
- Verify node version: `node --version` (need >=18)
- Try: `npm install -g github:YOUR_USERNAME/specdev-cli#main`

---

## 🎯 Next Steps (Optional)

### Add GitHub Topics
Go to your repo → Settings → Topics, add:
- `cli`
- `workflow`
- `nodejs`
- `development-tools`
- `markdown`

### Add Repository Description
Edit the "About" section on your GitHub repo page

### Enable GitHub Pages (for documentation)
Settings → Pages → Deploy from branch → main → /docs

### Add Badges to README
```markdown
![GitHub](https://img.shields.io/github/license/YOUR_USERNAME/specdev-cli)
![npm](https://img.shields.io/npm/v/@specdev/cli)
![Node](https://img.shields.io/node/v/@specdev/cli)
```

---

## 📝 Publishing to npm (Later)

When you're ready to publish to npm registry:

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

Then users can use:
```bash
npx @specdev/cli init
```

---

## 🎉 You're Done!

Your CLI is now:
- ✅ On GitHub (public)
- ✅ Installable by anyone
- ✅ Ready to use worldwide

Share your repo: `https://github.com/YOUR_USERNAME/specdev-cli`
