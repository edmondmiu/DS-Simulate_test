# Migration Guide: GitHub-Centered Token Studio Workflow

This guide provides step-by-step instructions for migrating from the previous token workflow to the new GitHub-centered Token Studio workflow.

## Overview

The new workflow simplifies token management by:
- Using Token Studio's native format for modular editing
- Maintaining tokensource.json as the single source of truth
- Enabling direct designer import from GitHub
- Providing AI-friendly editing capabilities
- Streamlining script management

## Pre-Migration Checklist

Before starting the migration, ensure:

- [ ] Your tokensource.json file is valid and contains your current tokens
- [ ] You have committed all current changes to version control
- [ ] You have Node.js 14+ installed
- [ ] All team members are aware of the upcoming workflow change
- [ ] You have tested that existing build processes work

## Migration Process

### Step 1: Automatic Migration

The migration system handles most of the process automatically:

```bash
# Run the migration (dry run first to see what will happen)
npm run migrate -- --dry-run

# If dry run looks good, run the actual migration
npm run migrate
```

The migration will:
1. Validate your current setup
2. Create a comprehensive backup
3. Update package.json scripts
4. Test the new workflow
5. Validate that everything works correctly

### Step 2: Manual Verification

After migration, verify the new workflow:

```bash
# Test the complete workflow
npm run validate-workflow-integrity

# Test splitting tokens
npm run split-source-to-tokens

# Test consolidating back
npm run consolidate-to-source

# Test GitHub sync (if you have git configured)
npm run sync-from-github
```

### Step 3: Team Training

Update your team on the new commands:

#### For Engineers

**Old Workflow:**
```bash
npm run transform        # ❌ Removed
npm run build:source     # ❌ Removed  
npm run sync:bidirectional # ❌ Removed
```

**New Workflow:**
```bash
# Start editing session
npm run workflow:start

# Edit tokens in tokens/ folder using AI or manual editing

# Finish editing session
npm run workflow:finish

# Or use individual commands:
npm run split-source-to-tokens    # Split for editing
npm run consolidate-to-source     # Merge changes back
npm run sync-from-github          # Pull latest from GitHub
```

#### For Designers

**Import URL:** Use this URL in Token Studio to import tokens:
```
https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
```

**Process:**
1. Open Token Studio in Figma
2. Go to Settings → Import
3. Paste the GitHub URL above
4. Import tokens and themes
5. Re-import anytime to get latest changes

## New File Structure

After migration, your project will have:

```
project/
├── tokensource.json              # Single source of truth (unchanged)
├── tokens/                       # Modular editing format
│   ├── $metadata.json           # Token set order
│   ├── $themes.json             # Theme configurations  
│   ├── core.json                # Foundation tokens
│   ├── global.json              # Semantic tokens
│   └── simulate.json            # Brand tokens
├── scripts/
│   ├── workflow-commands.js     # New workflow commands
│   └── ai-workflow-commands.js  # AI-specific commands
├── src/
│   ├── TokenTransformationEngine.js
│   ├── FileStructureManager.js
│   ├── ValidationSystem.js
│   ├── ModularEditingManager.js
│   └── MigrationSystem.js       # Migration utilities
└── .backups/                    # Automatic backups
    └── migration-backup-[timestamp]/
```

## Workflow Comparison

### Old Workflow
1. Edit tokensource.json directly
2. Run transform scripts
3. Build outputs
4. Manual sync with designers

### New Workflow
1. `npm run workflow:start` - Pull latest and split for editing
2. Edit modular files in tokens/ folder
3. `npm run workflow:finish` - Consolidate and validate
4. Commit changes
5. Designers auto-import from GitHub URL

## AI Integration

The new workflow is optimized for AI tools:

```bash
# Initialize AI editing session
npm run ai-init-session

# AI edits files in tokens/ folder

# Validate AI changes
npm run ai-validate-changes

# Auto-consolidate AI changes
npm run ai-auto-consolidate
```

## Troubleshooting

### Migration Issues

If migration fails:

```bash
# Check migration status
node -e "console.log(require('./.kiro/migration-state.json'))"

# Manual rollback if needed
npm run migrate:rollback
```

### Workflow Issues

If the new workflow doesn't work:

```bash
# Validate complete workflow
npm run validate-workflow-integrity

# Check individual components
npm run split-source-to-tokens --verbose
npm run consolidate-to-source --verbose
```

### Common Problems

**Problem:** Split command fails
**Solution:** Check that tokensource.json is valid JSON and contains token data

**Problem:** Consolidate creates different output
**Solution:** Run `npm run validate-workflow-integrity` to check roundtrip integrity

**Problem:** Designers can't import tokens
**Solution:** Verify the GitHub URL is accessible and tokensource.json is in the main branch

**Problem:** AI tools can't edit tokens
**Solution:** Ensure tokens/ folder exists and contains valid Token Studio format files

## Rollback Process

If you need to rollback the migration:

### Automatic Rollback

```bash
# Rollback using migration system
npm run migrate:rollback
```

### Manual Rollback

1. Restore files from `.backups/migration-backup-[timestamp]/`
2. Copy backup files back to project root
3. Restore package.json from backup
4. Remove new workflow files if needed

## Validation Commands

Use these commands to validate your migration:

```bash
# Complete workflow validation
npm run validate-workflow-integrity

# Validate Token Studio structure
npm run validate:comprehensive

# Test designer import
npm run test-designer-import

# Test AI workflow
npm run ai-test-workflow
```

## Support

If you encounter issues during migration:

1. Check the migration logs in `.kiro/migration-state.json`
2. Review backup files in `.backups/migration-backup-[timestamp]/`
3. Run validation commands to identify specific issues
4. Use rollback if necessary to restore previous state

## Post-Migration Benefits

After successful migration, you'll have:

- ✅ Simplified workflow with fewer commands
- ✅ Direct designer access via GitHub URL
- ✅ AI-friendly modular token editing
- ✅ Automatic backup and validation
- ✅ Improved error handling and recovery
- ✅ Streamlined script management
- ✅ Better team collaboration

## Next Steps

1. Update team documentation with new workflow
2. Train designers on GitHub URL import process
3. Configure AI tools to use new modular format
4. Set up automated testing with new validation commands
5. Consider setting up GitHub Actions for automated validation

---

For technical details about the migration system, see the source code in `src/MigrationSystem.js`.