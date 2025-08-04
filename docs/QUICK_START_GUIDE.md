# Quick Start Guide

## 🎯 Choose Your Path (30 seconds)

**I'm a Figma Designer** → [Jump to Designer Setup](#-figma-designer-5-minutes)  
**I'm a Frontend Developer** → [Jump to Developer Setup](#-frontend-developer-10-minutes)  
**I'm a Design System Engineer** → [Jump to Engineer Setup](#-design-system-engineer-15-minutes)  
**I'm using AI Tools** → [Jump to AI Setup](#-ai-tools-5-minutes)

## 🔄 How It All Works (Visual Overview)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   🎨 Designer   │    │  🔧 Engineer    │    │  👨‍💻 Developer  │
│                 │    │                 │    │                 │
│ Token Studio    │    │ Edit tokens/    │    │ Use CSS/JS      │
│ Import URL   ───┼────┤ core.json    ───┼────┤ tokens          │
│                 │    │ global.json     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────┤ tokensource.json├──────────────┘
                        │ (Single Source  │
                        │  of Truth)      │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   🤖 AI Tools   │
                        │                 │
                        │ Edit modular    │
                        │ token files     │
                        └─────────────────┘
```

**Key Insight**: Everyone works with the same tokens, just in different formats!

---

## 🎨 Figma Designer (5 minutes)

### Step 1: Install Token Studio Plugin
1. Open Figma
2. Go to **Plugins** → **Browse all plugins**
3. Search for **"Figma Tokens"** or **"Token Studio"**
4. Click **Install**

### Step 2: Import Design Tokens
1. Open Token Studio plugin in any Figma file
2. Click the **Settings** gear icon
3. Select **"GitHub"** as sync provider
4. Paste this URL:
   ```
   https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
   ```
5. Click **Save**

### Step 3: Start Using Tokens
1. Select any design element
2. In Token Studio, browse to **Global** → **Color** → **Text**
3. Click **primary** to apply the primary text color
4. Switch themes using the dropdown at the top

**✅ You're done!** The URL always has the latest tokens. Just click "Sync" to get updates.

**Need help?** → [Full Designer Guide](./DESIGNER_IMPORT_GUIDE.md)

---

## 👨‍💻 Frontend Developer (10 minutes)

### Step 1: Get the Tokens
```bash
# Option A: Clone the repository
git clone https://github.com/edmondmiu/DS-Simulate_test.git
cd DS-Simulate_test

# Option B: Download just the built tokens
curl -o tokens.css https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/dist/css/tokens.css
```

### Step 2: Use in Your Project
```css
/* Import the CSS custom properties */
@import './tokens.css';

/* Use semantic tokens */
.primary-button {
  background-color: var(--semantic-color-action-primary-default);
  color: var(--semantic-color-text-inverse);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
}

/* Theme switching */
[data-theme="dark"] {
  background-color: var(--themes-dark-surface-primary);
  color: var(--themes-dark-text-primary);
}
```

### Step 3: JavaScript Integration (Optional)
```javascript
// If you cloned the repo, you can also import JS tokens
import tokens from './dist/js/tokens.js';

const buttonStyles = {
  backgroundColor: tokens.semantic.color.action.primary.default,
  color: tokens.semantic.color.text.inverse,
  padding: tokens.spacing.md
};
```

**✅ You're done!** Tokens update automatically when designers make changes.

**Need more formats?** → [Style Dictionary Guide](./STYLE_DICTIONARY.md)

---

## 🔧 Design System Engineer (15 minutes)

### Step 1: Clone and Setup
```bash
git clone https://github.com/edmondmiu/DS-Simulate_test.git
cd DS-Simulate_test
npm install
```

### Step 2: Verify Everything Works
```bash
npm run validate-workflow-integrity
```
You should see: ✅ All validations passed

### Step 3: Try the Workflow
```bash
# Start editing session (pulls latest + splits to modular format)
npm run workflow:start

# Edit tokens in the tokens/ folder
# - tokens/core.json (foundation colors, spacing)
# - tokens/global.json (semantic tokens like button.primary)
# - tokens/simulate.json (brand-specific customizations)

# Finish editing session (consolidates back to tokensource.json)
npm run workflow:finish

# Build platform outputs
npm run build
```

### Step 4: Commit Your Changes
```bash
git add .
git commit -m "Update tokens: [describe your changes]"
git push origin main
```

**✅ You're done!** Designers will automatically get your changes via the import URL.

**Need the full workflow?** → [Engineer Workflow Guide](./ENGINEER_WORKFLOW_GUIDE.md)

---

## 🤖 AI Tools (5 minutes)

### Step 1: Initialize AI Session
```bash
npm run ai-init-session
```

### Step 2: Edit Token Files
AI tools can directly edit these files:
- `tokens/core.json` - Foundation tokens (colors, spacing, typography)
- `tokens/global.json` - Semantic tokens (button styles, text styles)
- `tokens/simulate.json` - Brand-specific tokens
- `tokens/components.json` - Component-specific tokens

### Step 3: Validate and Consolidate
```bash
# Validate your changes
npm run ai-validate-changes

# Consolidate back to source
npm run ai-auto-consolidate

# Test complete workflow
npm run ai-test-workflow
```

**✅ You're done!** Changes are now in tokensource.json and ready for designers.

**Need AI-specific guidance?** → [AI Editing Guide](./AI_EDITING_GUIDE.md)

---

## 🚨 Common Issues & Quick Fixes

### "Import URL not working" (Designers)
```bash
# Check if the URL loads in your browser:
https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json

# If it loads, try:
1. Clear Token Studio cache
2. Restart Figma
3. Try incognito/private browsing mode
```

### "Command not found" (Engineers)
```bash
# Make sure you're in the right directory and installed dependencies:
cd DS-Simulate_test
npm install

# Then try the command again
```

### "Validation failed" (Engineers/AI)
```bash
# Get detailed error information:
npm run validate:comprehensive

# Most common fixes:
1. Check for typos in token names
2. Ensure all referenced tokens exist
3. Verify JSON syntax is correct
```

### "Git conflicts in tokensource.json"
```bash
# Use the modular workflow to resolve conflicts:
git pull origin main
npm run split-source-to-tokens
# Resolve conflicts in individual token files (much easier!)
npm run consolidate-to-source
git add . && git commit -m "Resolve conflicts"
```

---

## 📚 Next Steps

### For Designers
- [Full Designer Import Guide](./DESIGNER_IMPORT_GUIDE.md) - Complete Figma integration
- [Figma Usage Guide](./FIGMA_USAGE.md) - Advanced Token Studio features

### For Developers  
- [Style Dictionary Guide](./STYLE_DICTIONARY.md) - Multi-platform token outputs
- [Token Architecture](./TOKEN_ARCHITECTURE.md) - Understanding the token system

### For Engineers
- [Engineer Workflow Guide](./ENGINEER_WORKFLOW_GUIDE.md) - Complete workflow documentation
- [Migration Guide](./MIGRATION_GUIDE.md) - Migrating from legacy systems

### For AI Tools
- [AI Editing Guide](./AI_EDITING_GUIDE.md) - Comprehensive AI workflow documentation
- [AI Workflow Complete](./AI_WORKFLOW_COMPLETE.md) - Advanced AI integration

### For Everyone
- [User Guide](./USER_GUIDE.md) - Comprehensive guide for all user types
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

---

## 🆘 Getting Help

1. **Quick Help**: Run `npm run help` for command reference
2. **Validation Issues**: Run `npm run validate:comprehensive` for detailed errors
3. **Documentation**: Check the `docs/` folder for detailed guides
4. **System Status**: Run `npm run validate-workflow-integrity` to check system health

**Remember**: The system is designed to be simple. Most workflows are just 2-3 commands!