# Token System Architecture

## Overview

The DS-Simulate token system uses a 3-tier hierarchical architecture built for Token Studio compatibility and Style Dictionary transformation. The system supports mathematical expressions, token references, and multi-theme capabilities.

## Architecture Diagram

```
┌─────────────────┐
│   Theme Layer   │ ← Brand-specific implementations (dark/light)
├─────────────────┤
│  Semantic Layer │ ← Usage-based token definitions  
├─────────────────┤
│   Core Layer    │ ← Foundation color ramps & primitives
└─────────────────┘
```

## Layer Details

### 1. Core Layer
**Purpose**: Foundation tokens that provide the systematic base for all other tokens.

**Contents**:
- **Color Ramps**: Systematic color progressions (Neutral 000-1300, Action Primary, etc.)
- **Typography Primitives**: Base font families, weights, sizes
- **Spacing Scale**: Mathematical spacing progression
- **Border Radius**: Consistent radius values
- **Shadow System**: Elevation shadows

**Example**:
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

### 2. Semantic Layer
**Purpose**: Usage-based tokens that reference core tokens and provide meaningful context.

**Contents**:
- **Background Colors**: Primary, secondary, surface
- **Text Colors**: Primary, secondary, accent, muted
- **Action Colors**: Button states, interactive elements
- **Feedback Colors**: Success, error, warning, info

**Example**:
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

### 3. Theme Layer
**Purpose**: Complete theme implementations that provide semantic token overrides for different visual modes.

**Contents**:
- **Dark Theme**: Complete semantic overrides optimized for dark backgrounds
  - High contrast text colors for accessibility
  - Dark surface progression from darkest to elevated
  - Proper contrast ratios for all interactive elements
- **Light Theme**: Inverted semantic mappings optimized for light backgrounds
  - Dark text colors on light surfaces
  - Light surface progression from white to subtle grays
  - Consistent action colors across both themes

**Example**:
```json
{
  "themes": {
    "dark": {
      "text": {
        "primary": {
          "$value": "{core.colors.neutral.1200}",
          "$type": "color",
          "$description": "Dark theme primary text - #dee2e7\n4.95:1 contrast ratio\n(AAA) Large text (AA) Normal text\nMain Text Colour"
        }
      },
      "surface": {
        "primary": {
          "$value": "{core.colors.neutral.0000}",
          "$type": "color",
          "$description": "Dark theme primary surface - #17181c\nSite background - darkest surface"
        }
      }
    },
    "light": {
      "text": {
        "primary": {
          "$value": "{core.colors.neutral.0200}",
          "$type": "color",
          "$description": "Light theme primary text - #202225\n4.95:1 contrast ratio\n(AAA) Large text (AA) Normal text\nMain Text Colour"
        }
      },
      "surface": {
        "primary": {
          "$value": "{core.colors.neutral.1300}",
          "$type": "color",
          "$description": "Light theme primary surface - #ffffff\nSite background - lightest surface"
        }
      }
    }
  }
}
```

## Token Features

### Mathematical Expressions
Tokens support mathematical calculations using a custom evaluator:

```json
{
  "spacing": {
    "xl": {
      "$value": "{spacing.lg} + {spacing.xs}",
      "$type": "spacing",
      "$description": "32px (24 + 8)"
    }
  }
}
```

**Supported Operations**:
- Basic arithmetic: `+`, `-`, `*`, `/`
- Functions: `roundTo(value, decimals)`
- Parentheses for grouping

### Token References
Tokens can reference other tokens using dot notation:

```json
{
  "button": {
    "primary": {
      "background": {
        "$value": "{core.Color Ramp.Action Primary.Action Primary 500}",
        "$type": "color"
      }
    }
  }
}
```

### WCAG Compliance Documentation
Core color tokens include built-in accessibility information:

```
Format:
Color Name / Color Reference
#HEX_VALUE
CONTRAST_RATIO:1
(WCAG_LEVEL) Large text
(WCAG_LEVEL) Normal text
Usage Description
```

**Levels**:
- **(N/A)**: Below WCAG standards
- **(AA)**: WCAG AA compliant 
- **(AAA)**: WCAG AAA compliant

## File Structure

```
├── tokensource.json         # Source tokens (Token Studio format)
├── tokens.json             # Figma-ready flattened tokens
├── tokens/
│   ├── primitives/         # Core foundation tokens
│   ├── semantic/           # Usage-based tokens
│   └── themes/             # Theme-specific overrides
└── dist/                   # Built platform outputs
    ├── css/                # CSS custom properties
    ├── js/                 # JavaScript modules
    ├── ios/                # iOS Swift files
    └── android/            # Android XML resources
```

## Token Naming Conventions

### Core Tokens
- **Color Ramps**: `{core.Color Ramp.{Category}.{Name} {Number}}`
- **Typography**: `{core.{Type}.{Property}}`
- **Spacing**: `{core.spacing.{size}}`

### Semantic Tokens
- **Colors**: `{semantic.color.{usage}.{variant}}`
- **Typography**: `{semantic.typography.{component}.{property}}`
- **Layout**: `{semantic.layout.{component}.{property}}`

### Theme Tokens
- **Overrides**: `{themes.{theme}.{category}.{property}}`

## Token Types

The system supports all Token Studio token types:

- **color**: Color values with WCAG documentation
- **dimension**: Spacing, sizing, and layout values
- **fontFamily**: Font family definitions
- **fontWeight**: Font weight values (400, 500, 600, etc.)
- **fontSize**: Font size values in pixels
- **lineHeight**: Line height values (unitless or pixels)
- **borderRadius**: Border radius values
- **boxShadow**: Shadow definitions for elevation

## Benefits

### For Designers
- **Semantic naming** that matches design intent
- **Systematic color scales** with built-in contrast documentation
- **Theme switching** through simple token set changes
- **Token Studio compatibility** for visual editing

### For Developers
- **Predictable patterns** for consistent implementation
- **Multi-platform outputs** in various formats
- **Mathematical precision** reduces manual calculations
- **Legacy compatibility** for gradual migration

### For Design Systems
- **Scalable architecture** that grows with the system
- **Brand flexibility** through theme variations
- **Accessibility compliance** built into the foundation
- **Automated builds** reduce manual maintenance

## Extension Points

### Adding New Token Categories
1. Create tokens in appropriate layer (core/semantic/theme)
2. Follow established naming conventions
3. Include proper type and description metadata
4. Add mathematical references where beneficial

### Creating New Themes
1. Add theme object to themes section
2. Reference core/semantic tokens where appropriate
3. Define brand-specific overrides
4. Test with existing components

### Custom Mathematical Functions
The system can be extended to support additional mathematical functions in the transform pipeline.

## Next Steps

See the [Pipeline Workflow](./PIPELINE_WORKFLOW.md) for information on how tokens flow through the system, and [Style Dictionary Guide](./STYLE_DICTIONARY.md) for details on the build process.