# Figma Token Usage Guide

## Overview

This guide explains how to consume design tokens from the DS-Simulate public repository in Figma using the Figma Tokens plugin.

## Token URLs

### Direct JSON URL (for Figma Tokens plugin)
```
https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json
```

### GitHub Pages (for documentation)
```
https://edmondmiu.github.io/DS-Simulate-Consume/
```

## How to Use in Figma

### 1. Install Figma Tokens Plugin
- Go to Figma → Plugins → Browse all plugins
- Search for "Figma Tokens"
- Install the plugin by Jan Six

### 2. Configure Token Source
1. Open the Figma Tokens plugin
2. Click on Settings (gear icon)
3. Click "Add new" under Token Sets
4. Choose "URL" as the sync provider
5. Enter the token URL: `https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json`
6. Name your token set (e.g., "DS-Simulate Tokens")
7. Click "Save"

### 3. Import and Apply Tokens
1. Click "Pull from URL" to fetch the latest tokens
2. You'll see the token structure organized by:
   - **Core**: Foundation tokens (colors, spacing, typography)
   - **Themes**: Dark and light theme variations
3. Apply tokens to your Figma elements using the plugin interface

## Token Structure

### Core Tokens
- **Colors**: `core.Color Ramp.Neutral.Neutral 500` → `#aeb4b9`
- **Spacing**: `spacing.lg` → `24`
- **Typography**: `typography.fontSize.md` → `16`

### Theme Tokens
- **Dark Theme**: `dark.text.primary` → `#dee2e7`
- **Light Theme**: `light.text.primary` → `#222426`

## Publishing Workflow

### For Design System Engineers

1. **Update tokens** in private repo (`DS-Simulate`)
2. **Transform tokens**: `npm run transform`
3. **Publish to consumption repo**: `npm run publish`

### Complete workflow:
```bash
# Make changes to tokensource.json
npm run publish:full  # Transform + Publish in one command
```

## Token Updates

When tokens are updated:
1. The consumption repository is automatically updated
2. Figma designers can pull the latest tokens using the plugin
3. Changes are versioned and timestamped
4. GitHub Pages documentation is updated

## Repository Structure

```
DS-Simulate-Consume/
├── tokens.json          # Main token file for Figma
├── README.md           # Repository documentation
└── index.html          # GitHub Pages documentation
```

## Token Versioning

Each token publication includes:
- **Version**: Semantic versioning (e.g., 1.0.0)
- **Timestamp**: When tokens were published
- **Source**: Reference to private repository
- **Metadata**: Token counts and structure info

## Troubleshooting

### Common Issues

**"Cannot fetch tokens from URL"**
- Ensure the consumption repository is public
- Check the URL is correct
- Verify tokens.json is valid JSON

**"Tokens not updating"**
- Try "Pull from URL" again in the plugin
- Check if new tokens were actually published
- Clear plugin cache if needed

**"Invalid token format"**
- Ensure tokens follow Token Studio format
- Check for JSON syntax errors
- Verify token references are resolved

### Getting Help

1. Check the [GitHub Pages documentation](https://edmondmiu.github.io/DS-Simulate-Consume/)
2. Review the consumption repository's README
3. Contact the design system team for technical issues

## Best Practices

### For Figma Designers
1. Always pull the latest tokens before starting new designs
2. Use semantic tokens (theme-specific) rather than core tokens when possible
3. Test designs in both light and dark themes
4. Report missing or incorrect tokens to the design system team

### For Design System Engineers
1. Test token transformations locally before publishing
2. Use descriptive commit messages when publishing
3. Communicate major token changes to design teams
4. Monitor token usage and gather feedback

## Example Usage

### Using Core Tokens
```javascript
// In tokens.json
{
  "core.Color Ramp.Neutral.Neutral 500": {
    "value": "#aeb4b9",
    "type": "color",
    "description": "Neutral 500 with 3.66:1 contrast"
  }
}
```

### Using Theme Tokens
```javascript
// Dark theme
{
  "dark.text.primary": {
    "value": "#dee2e7",
    "type": "color",
    "description": "Dark theme primary text"
  }
}

// Light theme
{
  "light.text.primary": {
    "value": "#222426",
    "type": "color",
    "description": "Light theme primary text"
  }
}
```

## Automation

The token publication process is automated:
- Tokens are transformed from source format to Figma format
- Mathematical expressions are resolved
- Theme variations are generated
- Public repository is updated with latest tokens
- GitHub Pages documentation is refreshed

This ensures Figma designers always have access to the latest, correctly formatted design tokens.