# Engineer Workflow Guide

## Overview

This guide covers the complete workflow for design system engineers using the GitHub-centered Token Studio Native Workflow system. The workflow enables seamless collaboration between Figma designers and engineers while maintaining tokensource.json as the single source of truth.

## Quick Start

### Prerequisites
- Node.js 14+ installed
- Git access to the DS-Simulate_test repository
- Basic understanding of design tokens and Token Studio

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/edmondmiu/DS-Simulate_test.git
   cd DS-Simulate_test
   npm install
   ```

2. **Verify the system**:
   ```bash
   npm run validate-workflow-integrity
   ```

## Core Workflow Commands

### Primary Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run split-source-to-tokens` | Split tokensource.json into modular files | Before editing tokens |
| `npm run consolidate-to-source` | Merge modular files back to tokensource.json | After editing tokens |
| `npm run sync-from-github` | Pull latest and split for editing | Start of editing session |
| `npm run validate-workflow-integrity` | Test complete workflow | Before committing changes |

### Supporting Commands

| Command | Purpose |
|---------|---------|
| `npm run workflow:start` | Complete setup for editing session |
| `npm run workflow:finish` | Consolidate and validate for commit |
| `npm run build` | Generate platform outputs |
| `npm run validate:comprehensive` | Full system validation |

## Step-by-Step Workflows

### Workflow 1: Making Token Changes

1. **Start editing session**:
   ```bash
   npm run sync-from-github
   ```
   This pulls the latest tokensource.json and splits it into modular files in the `tokens/` folder.

2. **Edit tokens**:
   - Navigate to `tokens/` folder
   - Edit the Token Studio native files:
     - `core.json` - Foundation tokens (Color Ramp, typography primitives, spacing)
     - `global.json` - Semantic tokens (header, body, button styles)
     - `simulate.json` - Brand-specific tokens (appBackground, brand colors)
     - `components.json` - Component-specific tokens
     - `Content Typography.json` - Typography-specific tokens
   - These files match exactly what Token Studio exports

3. **Validate changes**:
   ```bash
   npm run validate:comprehensive
   ```

4. **Consolidate changes**:
   ```bash
   npm run consolidate-to-source
   ```
   This merges your modular changes back into tokensource.json.

5. **Final validation**:
   ```bash
   npm run validate-workflow-integrity
   ```

6. **Build outputs** (optional):
   ```bash
   npm run build
   ```

7. **Commit and push**:
   ```bash
   git add .
   git commit -m "Update tokens: [describe changes]"
   git push origin main
   ```

### Workflow 2: AI-Assisted Token Editing

1. **Initialize AI editing session**:
   ```bash
   npm run ai-workflow:start
   ```

2. **Let AI edit modular files**:
   - AI tools can directly edit files in `tokens/` folder
   - Real-time validation provides immediate feedback
   - Metadata and references are automatically preserved

3. **Review AI changes**:
   ```bash
   npm run ai-workflow:validate
   ```

4. **Finalize AI session**:
   ```bash
   npm run ai-workflow:finish
   ```

### Workflow 3: Handling Designer Updates

When designers make changes in Figma and update the repository:

1. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

2. **Split for review**:
   ```bash
   npm run split-source-to-tokens
   ```

3. **Review changes** in the `tokens/` folder to understand what changed

4. **Make additional engineering changes** if needed

5. **Consolidate and push** following Workflow 1 steps 4-7

## File Structure Understanding

### Repository Structure
```
├── tokensource.json          # Single source of truth
├── tokens/                   # Token Studio native modular structure
│   ├── $metadata.json        # Token set configuration
│   ├── $themes.json          # Theme definitions
│   ├── core.json             # Foundation tokens
│   ├── global.json           # Semantic tokens
│   ├── simulate.json         # Brand tokens
│   ├── components.json       # Component tokens
│   └── Content Typography.json # Typography-specific tokens
├── dist/                     # Generated platform outputs
├── src/                      # Workflow system code
├── scripts/                  # Workflow commands
└── docs/                     # Documentation
```

### Token File Purposes

- **core.json**: Foundation tokens like color ramps, base typography, spacing scales
- **global.json**: Semantic tokens that reference core tokens (button.primary.background)
- **simulate.json**: Brand-specific customizations and overrides
- **components.json**: Component-specific token definitions
- **$metadata.json**: Defines token set order and configuration
- **$themes.json**: Theme definitions with Figma references

## Token Editing Best Practices

### 1. Token Structure
```json
{
  "tokenGroup": {
    "tokenName": {
      "$type": "color|dimension|typography|etc",
      "$value": "#ffffff|16px|{reference.token}",
      "$description": "Clear description of token purpose"
    }
  }
}
```

### 2. Token References
- Use `{token.path}` format for references
- References are resolved across all token sets
- Example: `"$value": "{color.primary}"` references the primary color token

### 3. Token Types
- **color**: `#ffffff`, `rgb(255,255,255)`, `{color.reference}`
- **dimension**: `16px`, `1rem`, `{spacing.medium}`
- **typography**: Object with fontFamily, fontSize, fontWeight, etc.

### 4. Descriptions
Always include `$description` for:
- Token purpose and usage
- Accessibility considerations
- Design rationale

## Troubleshooting

### Common Issues

1. **"Token reference not found" errors**:
   - Check that referenced tokens exist in the token files
   - Verify token path spelling and structure
   - Run `npm run validate:comprehensive` for detailed error info

2. **"Invalid tokens directory structure" errors**:
   - Ensure `$metadata.json` and `$themes.json` exist
   - Check that all token sets listed in metadata have corresponding files
   - Run `npm run split-source-to-tokens` to regenerate structure

3. **Build failures**:
   - Validate tokens first: `npm run validate:comprehensive`
   - Check for circular references in token definitions
   - Ensure all token values are properly formatted

4. **Git conflicts in tokensource.json**:
   - Pull latest changes: `git pull origin main`
   - Split to modular format: `npm run split-source-to-tokens`
   - Resolve conflicts in individual token files (easier than monolithic file)
   - Consolidate: `npm run consolidate-to-source`
   - Commit resolved version

### Getting Help

1. **Check validation output**:
   ```bash
   npm run validate:comprehensive
   ```

2. **Test workflow integrity**:
   ```bash
   npm run validate-workflow-integrity
   ```

3. **View detailed error information**:
   ```bash
   npm run error-handling:demo
   ```

4. **Check system status**:
   ```bash
   npm run workflow:status
   ```

## Advanced Usage

### Custom Token Sets

To add a new token set:

1. Add the set name to `tokens/$metadata.json` tokenSetOrder
2. Create the corresponding JSON file (e.g., `custom.json`)
3. Update theme configurations in `tokens/$themes.json`
4. Run `npm run consolidate-to-source`

### Theme Management

Themes are defined in `tokens/$themes.json`:
```json
{
  "id": "theme-id",
  "name": "Theme Name",
  "selectedTokenSets": {
    "core": "source",
    "global": "enabled",
    "simulate": "enabled"
  }
}
```

### Performance Optimization

For large token sets:
- Use `npm run build:incremental` for faster builds
- Enable caching with `npm run workflow:cache-enable`
- Use parallel processing: `npm run build:parallel`

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Token Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run validate-workflow-integrity
      - run: npm run build
```

### Pre-commit Hooks

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run validate:comprehensive
if [ $? -ne 0 ]; then
  echo "Token validation failed. Please fix errors before committing."
  exit 1
fi
```

## Migration from Legacy Workflow

If migrating from the old bidirectional sync system:

1. **Run migration command**:
   ```bash
   npm run migrate:to-native-workflow
   ```

2. **Verify migration**:
   ```bash
   npm run validate:migration
   ```

3. **Update team workflows** using this guide

4. **Archive old scripts** (they're preserved in `scripts/legacy/`)

## Performance Expectations

- **Split operation**: < 2 seconds for typical token sets
- **Consolidate operation**: < 3 seconds for typical token sets
- **Full validation**: < 5 seconds for typical token sets
- **Build generation**: < 10 seconds for all platforms

## Support and Resources

- **Documentation**: Check `docs/` folder for detailed guides
- **Examples**: See `examples/` folder for common patterns
- **Troubleshooting**: Run `npm run help` for interactive assistance
- **Migration**: See `docs/MIGRATION_GUIDE.md` for detailed migration steps

This workflow system is designed to be intuitive and efficient. The modular approach makes token editing more manageable while maintaining the reliability of a single source of truth.