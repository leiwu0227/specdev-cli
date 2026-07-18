# specdev-cli Setup Guide

## ✅ Package Complete!

Your CLI package is ready for publishing and use.

## 📦 Package Structure

```
specdev-cli/
├── bin/
│   └── specdev.js              # CLI entry point
├── src/
│   ├── commands/
│   │   ├── init.js             # Init command
│   │   └── help.js             # Help command
│   └── utils/
│       └── copy.js             # Copy utilities
├── templates/
│   └── .specdev/               # All markdown templates
│       ├── router.md
│       ├── generic_guides/
│       ├── project_notes/
│       ├── templates/
│       └── features/
│           └── 000_example_feature/
├── tests/
│   └── verify-output.js        # Test verification
├── .github/workflows/
│   ├── publish.yml             # Auto-publish on release
│   └── test.yml                # Run tests on PR/push
├── package.json
├── README.md
├── CHANGELOG.md
└── .gitignore
```

## 🚀 Quick Test

```bash
# Install dependencies (already done)
npm install

# Run tests
npm test

# Test locally
node ./bin/specdev.js init --target=./test-project
```

## 📝 Next Steps

### 1. Update Package Info
Edit `package.json`:
- Change `author` field
- Update repository URL in README.md
- Update GitHub links in help command

### 2. Initialize Git Repository
```bash
git init
git add .
git commit -m "Initial commit: specdev-cli v1.0.0"
```

### 3. Create GitHub Repository
```bash
# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/specdev-cli.git
git branch -M main
git push -u origin main
```

### 4. Test Locally (Optional)
```bash
# Link package globally
npm link

# Test in another directory
cd /path/to/test/project
specdev init

# Unlink when done
npm unlink -g @specdev/cli
```

### 5. Publish to npm

#### First Time Setup
```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami
```

#### Publish
```bash
# Publish package (public access)
npm publish --access public
```

#### Future Updates
```bash
# Patch version (1.0.0 -> 1.0.1)
npm run release

# Minor version (1.0.0 -> 1.1.0)
npm run release:minor

# Major version (1.0.0 -> 2.0.0)
npm run release:major
```

### 6. Set Up GitHub Actions (Optional)

Add npm token to GitHub secrets:
1. Go to https://github.com/yourusername/specdev-cli/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Your npm token (get from https://www.npmjs.com/settings/tokens)

Now releases will auto-publish to npm!

## 📖 Usage After Publishing

Users can run:
```bash
# One-time use (recommended)
npx @specdev/cli init

# Global install
npm install -g @specdev/cli
specdev init
```

## 🧪 Testing Commands

All commands are working:

```bash
# Help
node ./bin/specdev.js help

# Version
node ./bin/specdev.js --version

# Init with options
node ./bin/specdev.js init --target=./test
node ./bin/specdev.js init --dry-run
node ./bin/specdev.js init --force
```

## ✅ Pre-Publish Checklist

- [x] All tests passing (`npm test`)
- [x] README.md complete with examples
- [x] CHANGELOG.md updated
- [x] package.json has correct info
- [ ] Update author in package.json
- [ ] Update GitHub URLs
- [ ] Git repository initialized
- [ ] GitHub repository created
- [ ] npm account ready
- [ ] Published to npm

## 🔄 Maintenance

### Updating Templates

1. Edit files in `templates/.specdev/`
2. Test: `npm test`
3. Update CHANGELOG.md
4. Release: `npm run release`

### Adding New Commands

1. Create `src/commands/yourcommand.js`
2. Add case in `bin/specdev.js`
3. Update help text in `src/commands/help.js`
4. Add tests
5. Update README.md

## 📚 Resources

- npm publishing: https://docs.npmjs.com/cli/v8/commands/npm-publish
- GitHub Actions: https://docs.github.com/en/actions
- Semantic Versioning: https://semver.org/

## 🎉 Congratulations!

Your SpecDev CLI is ready to share with the world!
