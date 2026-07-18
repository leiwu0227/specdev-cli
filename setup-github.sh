#!/bin/bash

# SpecDev CLI - GitHub Setup Script

echo "🚀 SpecDev CLI - GitHub Setup"
echo "=============================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Adding files to git..."
    git add .

    echo "💾 Creating initial commit..."
    git commit -m "Initial commit: SpecDev CLI v1.0.0"
fi

# Ask for GitHub username
echo ""
read -p "Enter your GitHub username: " username

if [ -z "$username" ]; then
    echo "❌ Username cannot be empty"
    exit 1
fi

# Update README with username
echo "📝 Updating README with your GitHub username..."
sed -i.bak "s/YOUR_USERNAME/$username/g" README.md
rm README.md.bak 2>/dev/null || true

# Check if remote already exists
if git remote | grep -q "origin"; then
    echo "⚠️  Remote 'origin' already exists. Updating URL..."
    git remote set-url origin "https://github.com/$username/specdev-cli.git"
else
    echo "🔗 Adding GitHub remote..."
    git remote add origin "https://github.com/$username/specdev-cli.git"
fi

# Commit README update
if [ -n "$(git status --porcelain)" ]; then
    git add README.md
    git commit -m "Update installation instructions with GitHub username"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Go to: https://github.com/new"
echo "2. Create a new PUBLIC repository named: specdev-cli"
echo "3. Don't initialize with README (we have one)"
echo "4. After creating the repo, run:"
echo ""
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "🎉 Then your CLI will be available at:"
echo "   https://github.com/$username/specdev-cli"
echo ""
echo "📦 Others can install it with:"
echo "   npm install -g github:$username/specdev-cli"
echo ""
