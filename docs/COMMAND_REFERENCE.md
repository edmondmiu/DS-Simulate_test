# Command Reference Card

## 🎯 Essential Commands (Print This!)

### 🎨 For Designers
```
Import URL: https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
```
**That's it!** Paste this URL in Token Studio → Settings → GitHub sync

### 👨‍💻 For Developers
```bash
# Get tokens
curl -o tokens.css https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/dist/css/tokens.css

# Use in CSS
.button { background: var(--semantic-color-action-primary-default); }
```

### 🔧 For Engineers
```bash
# Complete editing workflow
npm run workflow:start     # Pull latest + split to modular
# Edit tokens/core.json, tokens/global.json, etc.
npm run workflow:finish    # Consolidate + validate

# Individual commands
npm run split-source-to-tokens      # Split for editing
npm run consolidate-to-source       # Merge back to source
npm run validate-workflow-integrity # Test everything
npm run build                       # Generate outputs
```

### 🤖 For AI Tools
```bash
npm run ai-init-session        # Initialize AI editing
# Edit tokens/*.json files
npm run ai-validate-changes    # Check changes
npm run ai-auto-consolidate    # Merge to source
```

---

## 📋 All Available Commands

### 🔄 Core Workflow
| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run workflow:start` | Complete setup for editing | Start of editing session |
| `npm run workflow:finish` | Consolidate and validate | End of editing session |
| `npm run split-source-to-tokens` | Split tokensource.json to modular | Before editing tokens |
| `npm run consolidate-to-source` | Merge modular back to source | After editing tokens |
| `npm run sync-from-github` | Pull latest and split | Get latest changes |
| `npm run validate-workflow-integrity` | Test complete workflow | Before committing |

### 🏗️ Build & Output
| Command | Purpose |
|---------|---------|
| `npm run build` | Generate all platform outputs |
| `npm run build:themes` | Build theme-specific outputs |
| `npm run build:all` | Build everything (styles + themes) |
| `npm run build:watch` | Watch for changes and rebuild |
| `npm run clean` | Clean build outputs |

### ✅ Validation & Testing
| Command | Purpose |
|---------|---------|
| `npm run validate:comprehensive` | Full system validation |
| `npm run test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:watch` | Run tests in watch mode |

### 🐙 GitHub Integration
| Command | Purpose |
|---------|---------|
| `npm run generate-github-url` | Generate designer import URL |
| `npm run validate-github-integration` | Test GitHub integration |
| `npm run test-designer-import` | Test Token Studio import |
| `npm run manage-branch` | Manage workflow branches |

### 🤖 AI Workflow
| Command | Purpose |
|---------|---------|
| `npm run ai-init-session` | Initialize AI editing session |
| `npm run ai-validate-changes` | Validate AI-made changes |
| `npm run ai-auto-consolidate` | Auto-consolidate AI changes |
| `npm run ai-test-workflow` | Test AI workflow integration |

### 🔄 Migration
| Command | Purpose |
|---------|---------|
| `npm run migrate` | Migrate to new workflow |
| `npm run migrate:validate` | Check migration readiness |
| `npm run migrate:status` | Check migration status |
| `npm run migrate:rollback` | Rollback migration |

### 🛠️ Utilities
| Command | Purpose |
|---------|---------|
| `npm run help` | Show interactive help |
| `npm run publish` | Publish tokens to distribution |
| `npm run demo:error-handling` | Demo error handling |

---

## 🗂️ File Structure Quick Reference

```
├── tokensource.json          # 🎯 Single source of truth
├── tokens/                   # 🔧 Modular editing structure
│   ├── $metadata.json        #   ├── Token set configuration
│   ├── $themes.json          #   ├── Theme definitions  
│   ├── core.json             #   ├── Foundation tokens
│   ├── global.json           #   ├── Semantic tokens
│   ├── simulate.json         #   ├── Brand tokens
│   └── components.json       #   └── Component tokens
├── dist/                     # 📦 Generated outputs
│   ├── css/tokens.css        #   ├── CSS custom properties
│   ├── js/tokens.js          #   ├── JavaScript modules
│   ├── ios/                  #   ├── iOS Swift files
│   └── android/              #   └── Android XML
└── docs/                     # 📚 Documentation
```

---

## 🚦 Workflow Patterns

### Pattern 1: Quick Token Edit
```bash
npm run workflow:start
# Edit tokens/global.json
npm run workflow:finish
git add . && git commit -m "Update button colors" && git push
```

### Pattern 2: Major Token Restructure
```bash
npm run sync-from-github
npm run split-source-to-tokens
# Edit multiple token files
npm run validate:comprehensive
npm run consolidate-to-source
npm run validate-workflow-integrity
npm run build
git add . && git commit -m "Restructure color system" && git push
```

### Pattern 3: AI Token Generation
```bash
npm run ai-init-session
# AI edits tokens/core.json, tokens/global.json
npm run ai-validate-changes
npm run ai-auto-consolidate
npm run ai-test-workflow
```

### Pattern 4: Designer Import Test
```bash
npm run test-designer-import
npm run generate-github-url
# Share URL with designers
```

---

## 🎨 Token Usage Patterns

### CSS Usage
```css
/* Semantic tokens (preferred) */
.button-primary {
  background: var(--semantic-color-action-primary-default);
  color: var(--semantic-color-text-inverse);
}

/* Theme-aware styles */
[data-theme="dark"] {
  background: var(--themes-dark-surface-primary);
}
```

### JavaScript Usage
```javascript
import tokens from './dist/js/tokens.js';

const styles = {
  color: tokens.semantic.color.text.primary,
  spacing: tokens.spacing.md
};
```

### Token Studio Usage
```
Apply tokens by browsing:
Global → Color → Text → primary
Global → Spacing → md
Components → Button → Primary → background
```

---

## 🚨 Emergency Commands

### System Broken?
```bash
npm run validate-workflow-integrity  # Check what's wrong
npm run clean                        # Clean everything
npm install                          # Reinstall dependencies
npm run workflow:start               # Fresh start
```

### Git Conflicts?
```bash
git pull origin main
npm run split-source-to-tokens       # Resolve in modular files
npm run consolidate-to-source        # Merge back
```

### Token Studio Not Working?
```bash
npm run test-designer-import         # Test the import URL
npm run generate-github-url          # Get fresh URL
npm run validate-github-integration  # Check GitHub access
```

---

## 💡 Pro Tips

1. **Always validate before committing**: `npm run validate-workflow-integrity`
2. **Use workflow:start/finish for complete sessions**: Handles everything automatically
3. **Edit in modular format**: Much easier than editing tokensource.json directly
4. **Test designer import regularly**: Ensure designers can always import
5. **Keep tokensource.json as source of truth**: Never edit it directly
6. **Use semantic tokens in code**: More maintainable than core tokens

---

**📖 Need more details?** Check the full documentation in the `docs/` folder or run `npm run help`