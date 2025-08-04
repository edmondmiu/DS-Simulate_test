# Troubleshooting Guide

## Overview

This guide covers common issues and solutions for the Token Studio Native Workflow system. It's organized by problem type with step-by-step solutions and prevention strategies.

## Quick Diagnostics

### System Health Check
```bash
# Run comprehensive system validation
npm run validate-workflow-integrity

# Check individual components
npm run validate:comprehensive
npm run validate:themes
npm run validate:references
```

### Common Commands for Debugging
```bash
# View system status
npm run workflow:status

# Test error handling
npm run error-handling:demo

# Get detailed help
npm run help

# View migration status
npm run migrate:status
```

## Token File Issues

### Issue: "Token file not found" Error

**Symptoms:**
- Missing token files in `tokens/` directory
- Import/export operations fail
- Validation reports missing files

**Solutions:**

1. **Regenerate token structure:**
   ```bash
   npm run split-source-to-tokens
   ```

2. **Check tokensource.json exists:**
   ```bash
   ls -la tokensource.json
   ```

3. **Verify metadata configuration:**
   ```bash
   cat tokens/\$metadata.json
   ```

4. **Reset to clean state:**
   ```bash
   git checkout main
   git pull origin main
   npm run split-source-to-tokens
   ```

**Prevention:**
- Always run `npm run split-source-to-tokens` after pulling changes
- Don't manually delete files from `tokens/` directory
- Use `npm run workflow:start` for complete setup

### Issue: "Invalid JSON format" Error

**Symptoms:**
- JSON parsing errors during validation
- Malformed token files
- Syntax errors in token definitions

**Solutions:**

1. **Identify problematic file:**
   ```bash
   npm run validate:comprehensive
   # Look for specific file mentioned in error
   ```

2. **Validate JSON syntax:**
   ```bash
   # Use jq or online JSON validator
   cat tokens/core.json | jq .
   ```

3. **Common JSON fixes:**
   - Remove trailing commas
   - Ensure proper quote matching
   - Check bracket/brace matching
   - Verify escape characters

4. **Restore from backup:**
   ```bash
   git checkout HEAD -- tokens/problematic-file.json
   ```

**Prevention:**
- Use JSON-aware editors with syntax highlighting
- Enable JSON validation in your editor
- Run validation frequently during editing

### Issue: "Token reference not found" Error

**Symptoms:**
- Unresolved token references like `{color.primary}`
- Build failures due to missing references
- Circular reference warnings

**Solutions:**

1. **Check reference syntax:**
   ```bash
   # References should use {path.to.token} format
   grep -r "{.*}" tokens/
   ```

2. **Verify referenced token exists:**
   ```bash
   # Search for the token definition
   grep -r "primary" tokens/core.json
   ```

3. **Check token set order:**
   ```bash
   cat tokens/\$metadata.json
   # Ensure referenced token sets are loaded first
   ```

4. **Resolve circular references:**
   ```bash
   npm run validate:references
   # Follow the dependency chain shown in output
   ```

**Prevention:**
- Use consistent token naming conventions
- Document token dependencies
- Validate references after making changes

## Theme and Metadata Issues

### Issue: "Invalid theme configuration" Error

**Symptoms:**
- Theme switching doesn't work in Token Studio
- Missing theme definitions
- Figma style references broken

**Solutions:**

1. **Check theme file structure:**
   ```bash
   cat tokens/\$themes.json | jq .
   ```

2. **Verify theme token set references:**
   ```bash
   # Ensure all referenced token sets exist
   npm run validate:themes
   ```

3. **Regenerate theme configuration:**
   ```bash
   npm run consolidate-to-source
   npm run split-source-to-tokens
   ```

4. **Reset theme to defaults:**
   ```bash
   git checkout HEAD -- tokens/\$themes.json
   ```

**Prevention:**
- Don't manually edit `$themes.json` unless necessary
- Use theme management commands when available
- Validate themes after modifications

### Issue: "Token set order invalid" Error

**Symptoms:**
- Tokens load in wrong order
- Reference resolution fails
- Dependency issues between token sets

**Solutions:**

1. **Check metadata file:**
   ```bash
   cat tokens/\$metadata.json
   ```

2. **Verify all token sets exist:**
   ```bash
   # Check that all files in tokenSetOrder exist
   ls tokens/*.json
   ```

3. **Fix token set order:**
   ```bash
   # Edit $metadata.json to correct order
   # Core tokens should come before semantic tokens
   ```

4. **Regenerate metadata:**
   ```bash
   npm run split-source-to-tokens --regenerate-metadata
   ```

**Prevention:**
- Understand token dependencies (core → semantic → brand)
- Don't reorder token sets without understanding impact
- Use provided commands rather than manual editing

## Build and Validation Issues

### Issue: "Build process fails" Error

**Symptoms:**
- Style Dictionary build errors
- Missing output files in `dist/`
- Platform-specific build failures

**Solutions:**

1. **Check token validation first:**
   ```bash
   npm run validate:comprehensive
   # Fix any token issues before building
   ```

2. **Clean and rebuild:**
   ```bash
   npm run clean
   npm run build
   ```

3. **Check Style Dictionary config:**
   ```bash
   # Verify configuration files exist
   ls style-dictionary*.js
   ```

4. **Debug specific platform:**
   ```bash
   # Build individual platforms
   npm run build:css
   npm run build:js
   npm run build:ios
   npm run build:android
   ```

**Prevention:**
- Always validate tokens before building
- Keep Style Dictionary configs in sync
- Test builds after token changes

### Issue: "Validation takes too long" Error

**Symptoms:**
- Validation commands hang or timeout
- Performance degradation with large token sets
- Memory issues during processing

**Solutions:**

1. **Use incremental validation:**
   ```bash
   npm run validate:incremental
   ```

2. **Check for circular references:**
   ```bash
   npm run validate:references --detect-cycles
   ```

3. **Optimize token structure:**
   - Reduce deeply nested token hierarchies
   - Minimize complex reference chains
   - Split large token files

4. **Increase memory limit:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run validate:comprehensive
   ```

**Prevention:**
- Keep token files reasonably sized
- Avoid overly complex reference chains
- Use efficient token organization

## Git and Collaboration Issues

### Issue: "Merge conflicts in tokensource.json" Error

**Symptoms:**
- Git merge conflicts in the monolithic token file
- Difficult to resolve conflicts manually
- Lost changes during conflict resolution

**Solutions:**

1. **Use modular conflict resolution:**
   ```bash
   # Don't resolve tokensource.json directly
   git checkout --theirs tokensource.json
   npm run split-source-to-tokens
   # Resolve conflicts in individual token files
   # Then consolidate
   npm run consolidate-to-source
   ```

2. **Reset and reapply changes:**
   ```bash
   git stash
   git pull origin main
   npm run split-source-to-tokens
   # Manually reapply your changes to token files
   npm run consolidate-to-source
   git stash drop
   ```

3. **Use three-way merge:**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   # Resolve conflicts in modular files
   ```

**Prevention:**
- Always pull latest changes before starting work
- Use feature branches for token changes
- Communicate with team about major token modifications

### Issue: "Sync issues between team members" Error

**Symptoms:**
- Team members have different token versions
- Inconsistent token behavior across environments
- Designer imports don't match engineering tokens

**Solutions:**

1. **Verify everyone uses same source:**
   ```bash
   # Check current commit hash
   git rev-parse HEAD
   # Ensure all team members are on same commit
   ```

2. **Clear local caches:**
   ```bash
   rm -rf tokens/
   npm run split-source-to-tokens
   ```

3. **Standardize workflow:**
   - Use same npm script commands
   - Follow documented workflow procedures
   - Validate before committing

4. **Check import URLs:**
   ```bash
   # Verify designers use correct GitHub URL
   curl https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
   ```

**Prevention:**
- Document and follow standard workflows
- Use consistent branch strategies
- Regular team sync on token changes

## Performance Issues

### Issue: "Slow token processing" Error

**Symptoms:**
- Commands take longer than expected
- High memory usage during operations
- Timeouts in CI/CD pipelines

**Solutions:**

1. **Profile performance:**
   ```bash
   npm run validate:comprehensive --profile
   ```

2. **Use parallel processing:**
   ```bash
   npm run build:parallel
   ```

3. **Optimize token structure:**
   - Reduce token file sizes
   - Minimize reference depth
   - Remove unused tokens

4. **Increase system resources:**
   ```bash
   # Increase Node.js memory
   export NODE_OPTIONS="--max-old-space-size=8192"
   ```

**Prevention:**
- Monitor token set sizes
- Regular cleanup of unused tokens
- Use efficient token organization patterns

## AI and Automation Issues

### Issue: "AI editing session fails" Error

**Symptoms:**
- AI workflow commands fail
- Session management errors
- Metadata preservation issues

**Solutions:**

1. **Check AI workflow status:**
   ```bash
   npm run ai-workflow:status
   ```

2. **Reset AI session:**
   ```bash
   npm run ai-workflow:cleanup
   npm run ai-workflow:start
   ```

3. **Validate AI changes:**
   ```bash
   npm run ai-workflow:validate
   ```

4. **Manual session cleanup:**
   ```bash
   # Clear any stuck sessions
   rm -rf .ai-sessions/
   ```

**Prevention:**
- Always finalize AI sessions properly
- Monitor AI session status
- Use AI workflow validation

## Emergency Recovery

### Complete System Reset

If the system is in an unrecoverable state:

```bash
# 1. Backup current work
cp -r tokens/ tokens-backup/

# 2. Reset to clean state
git checkout main
git pull origin main
git clean -fd

# 3. Reinstall dependencies
rm -rf node_modules/
npm install

# 4. Regenerate token structure
npm run split-source-to-tokens

# 5. Validate system
npm run validate-workflow-integrity

# 6. Restore your changes manually if needed
# Compare tokens-backup/ with tokens/
```

### Rollback to Previous Version

```bash
# Find last working commit
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>

# Or rollback specific file
git checkout HEAD~1 -- tokensource.json
```

## Getting Additional Help

### Diagnostic Information

When reporting issues, include:

```bash
# System information
npm run system:info

# Error logs
npm run validate:comprehensive > validation-log.txt 2>&1

# Token structure
npm run workflow:status > status-log.txt

# Git status
git status > git-status.txt
```

### Support Channels

1. **Documentation**: Check all guides in `docs/` folder
2. **Interactive Help**: Run `npm run help` for guided assistance
3. **Error Demo**: Run `npm run error-handling:demo` to see error handling
4. **Migration Help**: See `docs/MIGRATION_GUIDE.md` for migration issues

### Prevention Best Practices

1. **Regular Validation**: Run validation frequently during development
2. **Consistent Workflows**: Follow documented procedures
3. **Version Control**: Use proper Git practices
4. **Team Communication**: Coordinate token changes with team
5. **Backup Strategy**: Keep backups of working configurations
6. **Testing**: Test changes in isolated environments first

This troubleshooting guide covers the most common issues you'll encounter. Most problems can be resolved by following the systematic approaches outlined above.