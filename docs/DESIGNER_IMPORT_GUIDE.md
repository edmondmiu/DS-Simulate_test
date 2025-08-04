# Designer Import Guide

## Overview

This guide shows Figma designers how to import and use design tokens from the DS-Simulate_test repository using Token Studio. The system provides a single, consistent import URL that always contains the latest approved design tokens.

## Quick Start

### Import URL
```
https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
```

### One-Time Setup

1. **Install Token Studio Plugin**:
   - Open Figma
   - Go to Plugins → Browse all plugins
   - Search for "Figma Tokens" or "Token Studio"
   - Install the plugin

2. **Import Design Tokens**:
   - Open Token Studio plugin in Figma
   - Click "Settings" (gear icon)
   - Select "GitHub" as sync provider
   - Enter the import URL above
   - Click "Save"

3. **Verify Import**:
   - You should see token sets: Core, Global, Simulate, Components
   - Themes should be available in the theme dropdown
   - All tokens should load without errors

## Using Design Tokens

### Theme Switching

The system includes multiple themes that you can switch between:

1. **Base Theme**: Default theme with standard token mappings
2. **Simulate Theme**: Brand-specific customizations for Simulate

To switch themes:
1. Open Token Studio plugin
2. Use the theme dropdown at the top
3. Select your desired theme
4. Tokens will automatically update to reflect theme values

### Token Categories

#### Core Tokens (Foundation)
- **Color Ramps**: Complete color scales (Neutral, Red, Green, Blue, etc.)
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: Consistent spacing scale (4px, 8px, 16px, etc.)
- **Border Radius**: Consistent corner radius values
- **Shadows**: Elevation and depth effects

#### Global Tokens (Semantic)
- **Text Styles**: Header styles (H1-H6), body text, labels
- **Color Roles**: Primary, secondary, error, warning, success colors
- **Component Styles**: Button styles, form elements, cards
- **Layout**: Margins, padding, grid systems

#### Simulate Tokens (Brand)
- **Brand Colors**: Simulate-specific color palette
- **App Background**: Application-specific backgrounds
- **Custom Components**: Simulate-specific UI elements

#### Component Tokens
- **Button Variants**: Primary, secondary, tertiary button styles
- **Form Elements**: Input fields, dropdowns, checkboxes
- **Navigation**: Menu items, tabs, breadcrumbs
- **Cards**: Content cards, info panels, modals

### Applying Tokens

#### Method 1: Direct Application
1. Select a layer or text element
2. Open Token Studio plugin
3. Browse to the appropriate token category
4. Click the token to apply it

#### Method 2: Bulk Application
1. Select multiple elements
2. Use Token Studio's bulk apply feature
3. Choose tokens for fill, stroke, typography, etc.

#### Method 3: Style Creation
1. Apply tokens to create Figma styles
2. Use "Create Styles" feature in Token Studio
3. Generated styles will be linked to tokens
4. Style updates automatically when tokens change

### Token Reference Format

Tokens use a hierarchical naming structure:
- `color.primary` - Primary brand color
- `spacing.medium` - Medium spacing value
- `typography.header.h1` - H1 header style
- `component.button.primary.background` - Primary button background

### Working with Token References

Some tokens reference other tokens:
- `semantic.color.text.primary` might reference `color.neutral.1200`
- This creates a system where changing core tokens updates all dependent tokens
- References are shown in Token Studio with `{}` notation

## Staying Updated

### Getting Latest Tokens

The import URL always provides the latest approved tokens. To update:

1. **Manual Update**:
   - Open Token Studio plugin
   - Click "Sync" or refresh button
   - Latest tokens will be downloaded

2. **Automatic Updates**:
   - Token Studio can be configured to check for updates
   - Enable auto-sync in settings for seamless updates

### Understanding Changes

When tokens are updated:
- **New tokens**: Will appear in the appropriate categories
- **Modified tokens**: Values will update automatically
- **Deprecated tokens**: Will be marked or removed (with migration guidance)
- **Theme changes**: New themes or theme modifications will be available

### Change Notifications

Engineers will communicate major token changes through:
- Design system documentation updates
- Team notifications for breaking changes
- Migration guides for deprecated tokens

## Best Practices

### 1. Use Semantic Tokens When Possible
- Prefer `semantic.color.text.primary` over `color.neutral.1200`
- Semantic tokens adapt better to theme changes
- They express intent rather than specific values

### 2. Maintain Token Consistency
- Use the same tokens across similar UI elements
- Don't create custom values that duplicate existing tokens
- Follow the established token hierarchy

### 3. Document Token Usage
- Add comments in Figma explaining token choices
- Document any custom token applications
- Share token usage patterns with the team

### 4. Test Across Themes
- Switch between available themes to test designs
- Ensure designs work well in all supported themes
- Report any theme-specific issues to engineers

### 5. Collaborate with Engineers
- Discuss new token needs before creating custom values
- Provide feedback on token usability and naming
- Share design requirements for new token categories

## Troubleshooting

### Common Issues

#### 1. Import URL Not Working
- **Check URL**: Ensure you're using the exact URL provided
- **Network Issues**: Try importing from a different network
- **Repository Access**: Verify the repository is publicly accessible
- **Token Studio Version**: Update to the latest Token Studio version

#### 2. Tokens Not Loading
- **Clear Cache**: Clear Token Studio cache and re-import
- **Check Format**: Verify the token file format is valid
- **Plugin Restart**: Restart Figma and Token Studio plugin
- **Browser Issues**: Try in a different browser or incognito mode

#### 3. Theme Switching Not Working
- **Theme Configuration**: Verify themes are properly configured
- **Token References**: Check that theme tokens reference valid base tokens
- **Plugin Update**: Update Token Studio to the latest version
- **Re-import**: Try removing and re-importing the token source

#### 4. Missing Tokens
- **Recent Changes**: Check if tokens were recently modified or moved
- **Theme Context**: Ensure you're viewing the correct theme
- **Token Path**: Verify the token path and naming
- **Sync Status**: Ensure you have the latest token version

### Getting Help

1. **Check Token Studio Documentation**: [Token Studio Docs](https://docs.tokens.studio/)
2. **Verify Import URL**: Test the URL in a browser to ensure it loads
3. **Contact Engineering Team**: Report persistent issues to the design system team
4. **Check System Status**: Verify if there are known issues with the token system

## Advanced Usage

### Custom Token Applications

For advanced use cases:
1. **Computed Values**: Some tokens may use mathematical expressions
2. **Conditional Tokens**: Tokens that change based on context
3. **Animation Tokens**: Duration and easing values for animations
4. **Responsive Tokens**: Values that adapt to different screen sizes

### Token Studio Features

Take advantage of Token Studio's advanced features:
1. **Token Sets**: Organize tokens into logical groups
2. **Aliases**: Create shortcuts to frequently used tokens
3. **Math Operations**: Use calculations in token values
4. **Conditional Logic**: Apply tokens based on conditions

### Integration with Design Systems

The token system integrates with:
1. **Figma Variables**: Tokens can be converted to Figma variables
2. **Component Libraries**: Tokens power component variants
3. **Design Documentation**: Tokens are documented in design specs
4. **Development Handoff**: Tokens provide exact values for developers

## Token Categories Reference

### Color Tokens
- **Primary Colors**: Main brand colors and variations
- **Neutral Colors**: Grays and neutral tones for text and backgrounds
- **Semantic Colors**: Success, error, warning, info colors
- **Surface Colors**: Background and surface colors for different elevations

### Typography Tokens
- **Font Families**: Primary and secondary font stacks
- **Font Sizes**: Consistent size scale from small to display sizes
- **Font Weights**: Light, regular, medium, bold, black
- **Line Heights**: Optimal line spacing for different text sizes
- **Letter Spacing**: Character spacing for improved readability

### Spacing Tokens
- **Base Unit**: 4px base unit for consistent spacing
- **Scale**: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- **Component Spacing**: Specific spacing for UI components
- **Layout Spacing**: Margins and padding for page layouts

### Component Tokens
- **Buttons**: All button variants with states (hover, active, disabled)
- **Forms**: Input fields, labels, validation states
- **Navigation**: Menu items, tabs, pagination
- **Feedback**: Alerts, toasts, modals, tooltips

This guide ensures designers can effectively use the token system while maintaining consistency with the engineering workflow. The single import URL approach eliminates confusion and ensures everyone is always working with the latest approved tokens.