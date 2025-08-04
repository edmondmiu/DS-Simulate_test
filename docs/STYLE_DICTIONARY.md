# Style Dictionary Build System

## Overview

This project uses Style Dictionary to transform design tokens from Token Studio format into multi-platform outputs. The system supports a 3-tier token architecture with mathematical expressions and theme switching.

## Architecture

### Token Structure
```
core.json        → Foundation color ramps, typography scales
semantic.json    → Usage-based tokens that reference core
theme/           → Theme-specific overrides and variations
```

### Build Process
1. **Token Consolidation**: `build-tokens.js` merges modular JSON files
2. **Style Dictionary Transform**: Converts to multi-platform outputs
3. **Mathematical Evaluation**: Custom transforms handle expressions
4. **Theme Generation**: Separate builds for each theme

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
npm install
```

### Build Commands
```bash
# Build all tokens and themes
npm run build:all

# Build tokens only
npm run build

# Build themes only
npm run build:themes

# Watch for changes
npm run watch
```

## Token File Structure

### Core Tokens (`core.json`)
Foundation tokens with WCAG compliance documentation:
```json
{
  "core": {
    "Color Ramp": {
      "Neutral": {
        "Neutral 500": {
          "$value": "#aeb4b9",
          "$type": "color",
          "$description": "Neutral / Neutral 500\n#aeb4b9\n3.66:1\n(AA) Large text\n(N/A) Normal text"
        }
      }
    }
  }
}
```

### Semantic Tokens (`semantic.json`)
Usage-based tokens that reference core:
```json
{
  "semantic": {
    "color": {
      "text": {
        "primary": {
          "$value": "{core.Color Ramp.Neutral.Neutral 600}",
          "$type": "color",
          "$description": "Primary text color - high contrast"
        }
      }
    }
  }
}
```

### Theme Tokens (`theme/light.json`, `theme/dark.json`)
Theme-specific overrides:
```json
{
  "theme": {
    "light": {
      "background": {
        "primary": {
          "$value": "{core.Color Ramp.Neutral.Neutral 000}",
          "$type": "color"
        }
      }
    }
  }
}
```

## Mathematical Expressions

The system supports mathematical calculations in token values:

### Supported Functions
- `roundTo(value, decimals)` - Round to specified decimal places
- Basic arithmetic: `+`, `-`, `*`, `/`
- Parentheses for grouping

### Examples
```json
{
  "spacing": {
    "large": {
      "$value": "roundTo({spacing.base} * 2, 1)",
      "$type": "dimension"
    }
  }
}
```

## Output Formats

### CSS Variables (`dist/css/`)
```css
:root {
  --core-color-ramp-neutral-neutral-500: #aeb4b9;
  --semantic-color-text-primary: var(--core-color-ramp-neutral-neutral-600);
}
```

### JavaScript Modules (`dist/js/`)
```javascript
export const tokens = {
  core: {
    colorRamp: {
      neutral: {
        neutral500: '#aeb4b9'
      }
    }
  }
};
```

### iOS Swift (`dist/ios/`)
```swift
public struct DesignTokens {
    public static let coreColorRampNeutralNeutral500 = UIColor(hex: "#aeb4b9")
}
```

### Android XML (`dist/android/`)
```xml
<resources>
    <color name="core_color_ramp_neutral_neutral_500">#aeb4b9</color>
</resources>
```

## Theme Switching

### CSS Theme Classes
```css
.theme-light {
  --theme-background-primary: var(--core-color-ramp-neutral-neutral-000);
}

.theme-dark {
  --theme-background-primary: var(--core-color-ramp-neutral-neutral-900);
}
```

### JavaScript Theme Objects
```javascript
import { lightTheme, darkTheme } from './dist/js/themes.js';

// Switch themes
document.body.className = `theme-${currentTheme}`;
```

## Custom Transforms

### Mathematical Expression Evaluation
- Transform Name: `math/evaluate`
- Evaluates mathematical expressions in token values
- Supports nested references and complex calculations

### Typography Handling
- Transform Name: `css/typography`
- Converts typography objects to CSS shorthand
- Handles font-family, font-size, line-height, etc.

## Token Studio Compatibility

### Import/Export
- Tokens maintain Token Studio format (`$value`, `$type`, `$description`)
- Compatible with Figma Tokens plugin
- Supports design tool round-trip workflow

### Validation
Run compatibility tests:
```bash
npm run test:compatibility
```

## Development Workflow

### Adding New Tokens
1. Add to appropriate JSON file (core, semantic, or theme)
2. Use Token Studio format with `$value`, `$type`, `$description`
3. Run build to generate outputs
4. Test in target platforms

### Modifying Existing Tokens
1. Update source JSON files
2. Run build to regenerate outputs
3. Check for breaking changes in consuming applications
4. Update documentation if needed

### Creating New Themes
1. Create new theme file in `theme/` directory
2. Add theme configuration to `build-themes.js`
3. Update Style Dictionary config for new theme
4. Run theme build

## Testing

### Token Validation
- Verify all references resolve correctly
- Check mathematical expressions evaluate properly
- Validate output format consistency

### Platform Testing
- Test CSS variables in browsers
- Verify JavaScript imports work correctly
- Check iOS/Android resource generation

## Troubleshooting

### Common Issues

**Build Fails with "Token not found"**
- Check token references use correct path syntax
- Verify referenced tokens exist in source files
- Ensure proper JSON syntax

**Mathematical Expressions Not Evaluating**
- Check expression syntax matches supported functions
- Verify referenced values are numeric
- Test expressions in isolation

**Empty Output Files**
- Verify source JSON files have valid Token Studio format
- Check build-tokens.js consolidation script
- Ensure Style Dictionary config matches token structure

### Debug Mode
Run with verbose output:
```bash
DEBUG=style-dictionary* npm run build
```

## Performance Considerations

- Build time scales with token count
- Mathematical expressions add processing overhead
- Theme builds are independent and can be parallelized
- Output files are optimized for production use

## Integration with Design Tools

### Figma Tokens Plugin
- Export tokens from Figma using Token Studio format
- Import generated tokens back to Figma
- Maintain two-way synchronization

### Design System Updates
- Version control all token changes
- Use semantic versioning for breaking changes
- Document migration paths for major updates