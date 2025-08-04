# Bidirectional Theme Sync

This document explains the bidirectional sync capability that allows seamless synchronization between the monolithic `tokensource.json` and the modular tokens folder structure.

## Overview

The bidirectional sync system provides workflow flexibility by supporting both:
- **Monolithic editing**: Working directly with `tokensource.json` for comprehensive changes
- **Modular editing**: Working with individual files in the `tokens/` folder for targeted modifications

## Architecture

```
tokensource.json (themes section)
         ↕️ bidirectional sync
tokens/semantic/theme-colors.json
```

Both sources maintain the same theme structure but serve different editing workflows:
- `tokensource.json`: Complete token system in one file
- `tokens/semantic/theme-colors.json`: Theme tokens only, organized for modular editing

## Available Commands

### Sync Commands

```bash
# Sync from tokensource.json to tokens folder
npm run sync-themes-to-tokens

# Sync from tokens folder back to tokensource.json  
npm run sync-themes-to-source

# Check consistency between both sources
npm run validate-theme-sync

# Show sync status and recommendations
npm run theme-sync-status

# Test the bidirectional sync functionality
npm run test-bidirectional-sync
```

### Direct Script Usage

```bash
# Using the script directly
node scripts/sync-themes-bidirectional.js <command>

# Available commands:
# - sync-to-tokens
# - sync-to-source  
# - validate
# - status
```

## Workflow Examples

### Scenario 1: Making Changes in tokensource.json

When you modify themes in `tokensource.json`:

1. **Make your changes** in `tokensource.json`
2. **Sync to tokens folder**: `npm run sync-themes-to-tokens`
3. **Validate consistency**: `npm run validate-theme-sync`

```bash
# Example workflow
vim tokensource.json                    # Edit themes
npm run sync-themes-to-tokens          # Sync changes
npm run validate-theme-sync            # Verify consistency
```

### Scenario 2: Making Changes in tokens/ folder

When you modify `tokens/semantic/theme-colors.json`:

1. **Make your changes** in `tokens/semantic/theme-colors.json`
2. **Sync to source**: `npm run sync-themes-to-source`
3. **Validate consistency**: `npm run validate-theme-sync`

```bash
# Example workflow
vim tokens/semantic/theme-colors.json  # Edit theme tokens
npm run sync-themes-to-source         # Sync changes back
npm run validate-theme-sync           # Verify consistency
```

### Scenario 3: AI-Assisted Editing

For AI tools working with modular files:

1. **Check status**: `npm run theme-sync-status`
2. **Ensure tokens folder is current**: `npm run sync-themes-to-tokens`
3. **Let AI modify** `tokens/semantic/theme-colors.json`
4. **Sync changes back**: `npm run sync-themes-to-source`
5. **Validate**: `npm run validate-theme-sync`

## Status and Recommendations

The `theme-sync-status` command provides helpful information:

```bash
npm run theme-sync-status
```

Output includes:
- File existence status
- Last modification times
- Sync recommendations based on which file is newer
- Quick validation results

Example output:
```
📊 Theme sync status:

tokensource.json: ✓ exists
theme-colors.json: ✓ exists

Last modified:
  tokensource.json: 2025-07-17T23:11:13.012Z
  theme-colors.json: 2025-07-17T23:11:18.299Z

💡 theme-colors.json is newer - consider running sync-to-source
✓ All themes are consistent between sources
```

## Validation

The validation system checks for:
- **Structural consistency**: Both sources have the same theme structure
- **Token completeness**: All tokens exist in both sources
- **Value consistency**: Token values match between sources
- **Reference integrity**: All tokens reference valid core colors

### Validation Errors

Common validation issues and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| Missing theme in source | Theme exists in one file but not the other | Run appropriate sync command |
| Token value mismatch | Same token has different values | Check which source is correct and sync |
| Missing token | Token exists in one source but not the other | Ensure both sources are up to date |
| Invalid core reference | Token doesn't reference core colors | Fix the token reference |

## Integration with Build Pipeline

The bidirectional sync integrates with the existing build pipeline:

```bash
# Current build process
npm run transform    # Processes tokensource.json
npm run build       # Builds final tokens

# With bidirectional sync
npm run sync-themes-to-source  # Consolidate changes first
npm run transform              # Then process as usual
npm run build
```

## Best Practices

### 1. Always Validate After Changes
```bash
# After any manual changes
npm run validate-theme-sync
```

### 2. Check Status Before Major Changes
```bash
# Before starting work
npm run theme-sync-status
```

### 3. Use Appropriate Workflow
- **Large structural changes**: Work in `tokensource.json`
- **Targeted token updates**: Work in `tokens/semantic/theme-colors.json`
- **AI-assisted editing**: Use modular tokens folder

### 4. Regular Consistency Checks
```bash
# Add to your development workflow
npm run validate-theme-sync
```

## Error Handling

The sync system includes comprehensive error handling:

- **File not found**: Clear error messages with suggestions
- **JSON parsing errors**: Detailed error information
- **Validation failures**: Specific issue descriptions
- **Write permission errors**: Helpful troubleshooting guidance

## Testing

Test the bidirectional sync functionality:

```bash
npm run test-bidirectional-sync
```

This test:
1. Creates backups of both sources
2. Makes test changes in both directions
3. Verifies sync functionality works correctly
4. Validates consistency throughout
5. Restores original state

## Troubleshooting

### Common Issues

**Issue**: Sync command fails with "file not found"
**Solution**: Ensure both `tokensource.json` and `tokens/semantic/theme-colors.json` exist

**Issue**: Validation shows inconsistencies
**Solution**: Run `npm run theme-sync-status` to see which file is newer, then sync accordingly

**Issue**: Changes not appearing after sync
**Solution**: Check file permissions and ensure you're editing the correct file

### Recovery

If sync gets into an inconsistent state:

1. **Identify the authoritative source** (usually the one you were editing)
2. **Force sync from that source**:
   ```bash
   # If tokensource.json is correct
   npm run sync-themes-to-tokens
   
   # If theme-colors.json is correct  
   npm run sync-themes-to-source
   ```
3. **Validate the result**: `npm run validate-theme-sync`

## Future Enhancements

The bidirectional sync system is designed to be extensible:

- **Conflict resolution**: Automatic handling of conflicting changes
- **Change tracking**: History of sync operations
- **Partial sync**: Sync only specific theme sections
- **Watch mode**: Automatic sync on file changes
- **Integration with version control**: Git hooks for automatic validation

## API Reference

### ThemeSyncManager Class

The core functionality is provided by the `ThemeSyncManager` class:

```javascript
const { ThemeSyncManager } = require('./scripts/sync-themes-bidirectional');

const syncManager = new ThemeSyncManager();

// Sync methods
syncManager.syncToTokensFolder();  // tokensource.json → tokens/
syncManager.syncToSource();        // tokens/ → tokensource.json
syncManager.validate();            // Check consistency
syncManager.getStatus();           // Show status
```

This enables integration with other tools and custom workflows.