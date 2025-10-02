# 🚀 Quick Start: Upload to GitHub

## The Fastest Way to Get Started

### Option 1: Automated Setup (Recommended)

```bash
cd /mnt/h/oceanwave/lib/specdev-cli
./setup-github.sh
```

This script will:
1. Initialize git (if needed)
2. Ask for your GitHub username
3. Update README with your username
4. Configure git remote
5. Show you the next steps

Then follow the on-screen instructions to create the GitHub repo and push.

---

### Option 2: Manual Setup

```bash
cd /mnt/h/oceanwave/lib/specdev-cli

# 1. Initialize git
git init
git add .
git commit -m "Initial commit: SpecDev CLI v1.0.0"

# 2. Create repo on GitHub
# Go to: https://github.com/new
# Name: specdev-cli
# Visibility: Public
# Don't initialize with README

# 3. Push to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/specdev-cli.git
git branch -M main
git push -u origin main

# 4. Update README
sed -i 's/YOUR_USERNAME/your-actual-username/g' README.md
git add README.md
git commit -m "Update installation instructions"
git push
```

---

## 📦 How Others Will Install It

After uploading, share these commands with others:

### Install Globally:
```bash
npm install -g github:YOUR_USERNAME/specdev-cli
specdev init
```

### Use Without Installing:
```bash
npx github:YOUR_USERNAME/specdev-cli init
```

---

## ✅ Test Your Upload

After pushing to GitHub, test that it works:

```bash
# In a new directory
mkdir ~/test-specdev
cd ~/test-specdev

# Install from your GitHub
npm install -g github:YOUR_USERNAME/specdev-cli

# Run it
specdev init

# Check it worked
ls -la .specdev/
```

You should see:
```
.specdev/
├── router.md
├── generic_guides/
├── project_notes/
├── templates/
└── features/
    └── 000_example_feature/
```

---

## 🎉 Share Your Work!

Your CLI is now public! Share it:
- GitHub URL: `https://github.com/YOUR_USERNAME/specdev-cli`
- Installation: `npm install -g github:YOUR_USERNAME/specdev-cli`
- Usage: `specdev init`

---

## 📚 Full Documentation

For more details, see:
- `GITHUB_SETUP.md` - Complete GitHub upload guide
- `README.md` - Full CLI documentation
- `SETUP.md` - Development and publishing guide
