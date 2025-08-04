# Token Pipeline Workflow

## Current Pipeline Overview

The token pipeline transforms design tokens from engineer-friendly format to Figma-ready format, with manual review and transformation by design system engineers.

## Pipeline Flow

```
Design Engineer       Design System Engineer       Figma Designer/Developers
      ↓                        ↓                        ↓
tokensource.json  →  npm run transform  →  tokens.json  →  Multi-platform outputs
  (Token Studio)      (Manual Review)      (Figma Ready)      (CSS/JS/iOS/Android)
```

## Detailed Workflow

### Step 1: Design Engineer Updates Tokens

**File**: `tokensource.json`
**Format**: Token Studio compatible JSON

Design engineers work directly in the Token Studio format:

```json
{
  "core": {
    "Color Ramp": {
      "Neutral": {
        "Neutral 500": {
          "$value": "#aeb4b9",
          "$type": "color",
          "$description": "Neutral 500 with 3.66:1 contrast"
        }
      }
    }
  },
  "semantic": {
    "color": {
      "text": {
        "primary": {
          "$value": "{core.Color Ramp.Neutral.Neutral 600}",
          "$type": "color",
          "$description": "Primary text color"
        }
      }
    }
  }
}
```

### Step 2: Design System Engineer Review & Transform

**Manual Process** - requires human intervention:

1. **Review Changes**: 
   - Check `tokensource.json` for new/modified tokens
   - Verify token references are valid
   - Ensure mathematical expressions are correct
   - Validate WCAG compliance documentation

2. **Run Transformation**:
   ```bash
   npm run transform
   ```
   This generates `tokens.json` with:
   - Resolved token references
   - Flattened structure for Figma
   - Evaluated mathematical expressions
   - Separated theme structures

3. **Verify Output**:
   - Check `tokens.json` is correctly generated
   - Verify no broken references
   - Test theme switching functionality

4. **Build Platform Outputs** (optional):
   ```bash
   npm run build:all
   ```

5. **Publish to Consumption Repository**:
   ```bash
   npm run publish
   ```

### Step 3: Figma Designer Consumption

**File**: `tokens.json`
**Format**: Figma-ready flattened structure

Figma designers import tokens from the public repository:

**URL**: `https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json`

The transformed tokens have a flattened structure optimized for Figma:

```json
{
  "meta": {
    "version": "1.0.0",
    "generated": "2025-07-16T13:26:05.428Z",
    "source": "tokensource.json"
  },
  "tokens": {
    "core": {
      "core.Color Ramp.Neutral.Neutral 500": {
        "value": "#aeb4b9",
        "type": "color",
        "description": "Neutral 500 with 3.66:1 contrast"
      }
    }
  },
  "themes": {
    "dark": {
      "dark.text.primary": {
        "value": "#dee2e7",
        "type": "color",
        "description": "Dark theme primary text"
      }
    }
  }
}
```

## Available Scripts

### Primary Commands
- **`npm run transform`** - Transform tokensource.json to tokens.json
- **`npm run build`** - Build Style Dictionary outputs (CSS, JS, etc.)
- **`npm run build:themes`** - Build theme-specific outputs
- **`npm run build:all`** - Transform + build all outputs including themes
- **`npm run publish`** - Publish tokens to public consumption repository

### Development Commands
- **`npm run watch`** - Watch for changes and auto-build
- **`npm run test`** - Run token validation tests
- **`npm run lint`** - Validate JSON syntax and token structure

## Manual Steps Explained

### Why Manual Transformation?

The current pipeline requires manual intervention because:

1. **Quality Control**: Design system engineers review all token changes
2. **Validation**: Human verification of token references and mathematical expressions
3. **Documentation**: Ensuring proper WCAG compliance and descriptions
4. **Breaking Changes**: Careful review of changes that might impact existing components

### What Gets Transformed?

1. **Token References**: `{core.Color Ramp.Neutral.Neutral 600}` → `#dee2e7`
2. **Mathematical Expressions**: `{spacing.lg} + {spacing.xs}` → `32`
3. **Structure Flattening**: Nested objects → dot notation paths
4. **Theme Separation**: Themes extracted to separate objects
5. **Metadata Addition**: Version, generation time, source tracking

## Token Features in Pipeline

### Reference Resolution
```json
// Before transformation
{
  "semantic": {
    "color": {
      "text": {
        "primary": {
          "$value": "{core.Color Ramp.Neutral.Neutral 600}",
          "$type": "color"
        }
      }
    }
  }
}

// After transformation
{
  "semantic.color.text.primary": {
    "value": "#dee2e7",
    "type": "color"
  }
}
```

### Mathematical Expression Evaluation
```json
// Before transformation
{
  "spacing": {
    "xl": {
      "$value": "roundTo({spacing.lg} * 1.5, 0)",
      "$type": "spacing"
    }
  }
}

// After transformation
{
  "spacing.xl": {
    "value": "36",
    "type": "spacing"
  }
}
```

### Theme Processing
```json
// Before transformation
{
  "themes": {
    "dark": {
      "surface": {
        "primary": {
          "$value": "{core.Color Ramp.Surface.Surface 000}",
          "$type": "color"
        }
      }
    }
  }
}

// After transformation - separate theme object
{
  "themes": {
    "dark": {
      "dark.surface.primary": {
        "value": "#17181c",
        "type": "color"
      }
    }
  }
}
```

## Best Practices

### For Design Engineers
1. **Use Token Studio format** with `$value`, `$type`, `$description`
2. **Reference core tokens** in semantic tokens when possible
3. **Document accessibility** with contrast ratios in descriptions
4. **Test mathematical expressions** before committing
5. **Communicate changes** to design system team

### For Design System Engineers
1. **Review all changes** before transformation
2. **Test locally** before publishing
3. **Verify references** don't create circular dependencies
4. **Check mathematical expressions** resolve correctly
5. **Validate WCAG compliance** in color descriptions
6. **Test theme switching** functionality

### For Figma Designers
1. **Pull latest tokens** before starting new designs
2. **Use semantic tokens** rather than core tokens when possible
3. **Test in both themes** (light/dark)
4. **Report missing tokens** to design system team

## Troubleshooting

### Common Issues

**"Circular reference detected"**
- Check for tokens that reference themselves
- Verify dependency chain doesn't create loops

**"Token not found"**
- Ensure referenced token exists in tokensource.json
- Check token path syntax matches exactly
- Verify proper nesting structure

**"Mathematical expression error"**
- Verify all referenced tokens in expression exist
- Check for proper mathematical syntax
- Ensure numeric values for calculations

**"Theme tokens not resolving"**
- Ensure core tokens exist for theme references
- Check theme structure matches expected format
- Verify theme token paths are correct

### Debug Process
1. Check console output for specific error messages
2. Validate JSON syntax in tokensource.json
3. Test individual token references in isolation
4. Review generated tokens.json for unexpected values
5. Contact design system team for complex issues

## Future Pipeline Automation

See [docs-archive/future-ideas/FUTURE_PIPELINE_PLANNING.md](../docs-archive/future-ideas/FUTURE_PIPELINE_PLANNING.md) for planned automation features that will:

- Enable direct designer editing via GitHub web interface
- Automate validation and processing of changes
- Provide real-time deployment to Firebase CDN
- Add approval workflows for breaking changes

## Integration Points

### GitHub Actions
- Builds are triggered on changes to token files
- Validates JSON syntax and token structure
- Deploys to Firebase hosting
- Creates versioned releases

### Firebase CDN
- Hosts public tokens.json for Figma consumption
- Provides versioned endpoints for rollback
- Global CDN for fast token delivery

### Style Dictionary
- Transforms tokens to multi-platform outputs
- Handles mathematical expressions
- Generates CSS, JavaScript, iOS, Android formats
- Supports custom transformation functions