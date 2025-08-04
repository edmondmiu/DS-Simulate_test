# DS-Simulate Design Token System

A comprehensive design token system for the DS-Simulate project, featuring **GitHub-centered workflow**, **Token Studio native format support**, and **AI-friendly modular editing** with Style Dictionary for multi-platform output generation.

## 🌟 Key Features

- **🌐 GitHub-Centered Workflow**: Single source of truth with seamless designer-engineer collaboration
- **🎨 Token Studio Native Format**: Work directly with Token Studio's modular export structure
- **🤖 AI-Friendly Editing**: Optimized modular structure for programmatic token maintenance
- **📱 Multi-Platform Outputs**: Automated builds for CSS, JavaScript, iOS Swift, and Android XML
- **♿ Accessibility Compliance**: Built-in WCAG contrast documentation and validation
- **🔄 Streamlined Pipeline**: Simplified workflow eliminates unnecessary transformation layers

## 🚀 Get Started in 5 Minutes

### 🎯 **Choose Your Role**

| Role | Time | Action |
|------|------|--------|
| **🎨 Figma Designer** | 2 min | [Import tokens →](#-figma-designer-2-minutes) |
| **👨‍💻 Frontend Developer** | 5 min | [Use tokens in code →](#-frontend-developer-5-minutes) |
| **🔧 Design System Engineer** | 10 min | [Manage token system →](#-design-system-engineer-10-minutes) |
| **🤖 AI Tools** | 3 min | [Edit tokens programmatically →](#-ai-tools-3-minutes) |

**📖 Need detailed guidance?** → **[Complete Quick Start Guide](./docs/QUICK_START_GUIDE.md)**

---

### 🎨 **Figma Designer (2 minutes)**

1. **Install Token Studio plugin** in Figma
2. **Paste this URL** in Token Studio settings:
   ```
   https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
   ```
3. **Start designing** with tokens like `text.primary`, `surface.interactive`

**✅ Done!** Tokens update automatically. **[Full guide →](./docs/DESIGNER_IMPORT_GUIDE.md)**

---

### 👨‍💻 **Frontend Developer (5 minutes)**

1. **Get the CSS tokens**:
   ```bash
   curl -o tokens.css https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/dist/css/tokens.css
   ```

2. **Use in your styles**:
   ```css
   .button { 
     background: var(--semantic-color-action-primary-default);
     color: var(--semantic-color-text-inverse);
   }
   ```

**✅ Done!** Tokens update automatically. **[Full guide →](./docs/STYLE_DICTIONARY.md)**

---

### 🔧 **Design System Engineer (10 minutes)**

1. **Clone and setup**:
   ```bash
   git clone https://github.com/edmondmiu/DS-Simulate_test.git
   cd DS-Simulate_test && npm install
   ```

2. **Try the workflow**:
   ```bash
   npm run workflow:start    # Pull latest + split to modular
   # Edit tokens/core.json, tokens/global.json, etc.
   npm run workflow:finish   # Consolidate + validate
   ```

**✅ Done!** Changes flow to designers automatically. **[Full guide →](./docs/ENGINEER_WORKFLOW_GUIDE.md)**

---

### 🤖 **AI Tools (3 minutes)**

1. **Initialize AI session**:
   ```bash
   npm run ai-init-session
   ```

2. **Edit token files** (`tokens/core.json`, `tokens/global.json`, etc.)

3. **Consolidate changes**:
   ```bash
   npm run ai-auto-consolidate
   ```

**✅ Done!** Changes are ready for designers. **[Full guide →](./docs/AI_EDITING_GUIDE.md)**

---

## 💡 **Why This System?**

- **🎯 Single Source of Truth**: One URL for designers, one file for engineers
- **🔄 Automatic Updates**: Changes flow seamlessly between design and code
- **🤖 AI-Friendly**: Modular structure perfect for programmatic editing
- **♿ Accessibility Built-in**: WCAG compliance and contrast validation
- **📱 Multi-Platform**: CSS, JavaScript, iOS, Android outputs
- **🚀 Zero Training**: Role-based quick starts get teams productive immediately

## 📁 Project Structure

```
├── tokensource.json          # 🎯 Single source of truth (Token Studio format)
├── tokens/                   # 🔧 Token Studio native modular structure
│   ├── $metadata.json        #   ├── Token set configuration
│   ├── $themes.json          #   ├── Theme definitions
│   ├── core.json             #   ├── Foundation tokens
│   ├── global.json           #   ├── Semantic tokens
│   ├── simulate.json         #   ├── Brand-specific tokens
│   ├── components.json       #   ├── Component tokens
│   └── Content Typography.json #   └── Typography-specific tokens
├── dist/                     # 📦 Multi-platform outputs
│   ├── css/                  #   ├── CSS custom properties
│   ├── js/                   #   ├── JavaScript modules
│   ├── ios/                  #   ├── iOS Swift files
│   └── android/              #   └── Android XML resources
├── src/                      # ⚙️ Workflow system components
├── scripts/                  # 🔧 Workflow commands
└── docs/                     # 📚 Complete documentation
```

## 🔄 GitHub-Centered Workflow

### Core Workflow Architecture

```
GitHub Repository (tokensource.json) ←→ Local Development (tokens/ folder) ←→ Figma Token Studio
         ↓                                        ↓                                    ↓
   Single source of truth              Token Studio native format              Designer import URL
   Always up-to-date                   Modular editing structure               Consistent experience
```

### Engineering Workflow

```
1. Pull from GitHub → 2. Split to modular → 3. Edit tokens → 4. Consolidate → 5. Push to GitHub
   git pull origin main   split-source-to-tokens   tokens/*.json   consolidate-to-source   git push
```

### Designer Workflow

```
GitHub tokensource.json → Token Studio Import → Design in Figma → Export/Sync → GitHub Update
https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
```

### AI Workflow

```
Split → Edit Modular Files → Validate → Consolidate → Verify
tokens/core.json, tokens/global.json, etc. → Real-time validation → Back to source
```

## 📖 Documentation

### **🚀 Start Here**
- **[Quick Start Guide](./docs/QUICK_START_GUIDE.md)** - Get productive in 5 minutes
- **[Command Reference](./docs/COMMAND_REFERENCE.md)** - Essential commands (bookmark this!)

### **📚 Complete Guides**
- **[Engineer Workflow Guide](./docs/ENGINEER_WORKFLOW_GUIDE.md)** - Complete workflow for engineers
- **[Designer Import Guide](./docs/DESIGNER_IMPORT_GUIDE.md)** - Figma Token Studio import instructions
- **[AI Editing Guide](./docs/AI_EDITING_GUIDE.md)** - AI-friendly editing workflows
- **[Troubleshooting Guide](./docs/TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions
- **[Migration Guide](./docs/MIGRATION_GUIDE.md)** - Migrating from legacy workflows

## 🚨 Quick Fixes

**Token Studio import not working?**
```bash
# Check if this URL loads in your browser:
https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json
```

**Commands not working?**
```bash
npm install  # Make sure dependencies are installed
npm run help # See all available commands
```

**System seems broken?**
```bash
npm run validate-workflow-integrity  # Check system health
```

## 🎯 Current System Features

- **3-tier architecture**: Core → Semantic → Theme layers
- **Token Studio compatible**: Full support for Token Studio format
- **Multi-platform outputs**: CSS, JavaScript, iOS Swift, Android XML
- **Mathematical expressions**: Support for calculations and references
- **Theme support**: Dark/light themes with automatic switching
- **WCAG compliance**: Built-in accessibility documentation
- **CI/CD pipeline**: Automated building and deployment

## 🛠️ Command Reference

### 🔄 **Primary Workflow Commands**

```bash
# GitHub-centered workflow
npm run sync-from-github          # Pull latest and split for editing
npm run split-source-to-tokens    # Split tokensource.json to modular files
npm run consolidate-to-source     # Merge modular changes back to source
npm run validate-workflow-integrity # Test complete workflow

# Convenience commands
npm run workflow:start            # Complete setup for editing session
npm run workflow:finish          # Consolidate and validate for commit
```

### 🏗️ **Build & Platform Commands**

```bash
# Platform outputs
npm run build                     # Generate all platform outputs (CSS, JS, iOS, Android)
npm run build:css                 # CSS custom properties only
npm run build:js                  # JavaScript modules only
npm run build:ios                 # iOS Swift files only
npm run build:android             # Android XML resources only
```

### ✅ **Validation Commands**

```bash
# Comprehensive validation
npm run validate:comprehensive    # Full system validation
npm run validate:themes          # Theme completeness validation
npm run validate:references      # Token reference validation
npm run validate:structure       # File structure validation
```

### 🤖 **AI Workflow Commands**

```bash
# AI-specific workflows
npm run ai-workflow:start        # Initialize AI editing session
npm run ai-workflow:validate     # Validate AI changes
npm run ai-workflow:finish       # Finalize AI editing session
```

### 🧹 **Utility Commands**

```bash
# System maintenance
npm run clean                    # Clean generated files
npm run help                     # Interactive help system
npm run system:info              # System diagnostic information
```

## 📋 Enhanced Token Categories

### 🎨 **Core Tokens** (Foundation Layer)

- **Color Ramps**: Systematic progressions (Neutral 0000-1300, Amber, Green, Red, Blue)
- **Typography**: Font families, sizes, weights, line heights, letter spacing
- **Spacing**: Mathematical spacing scale with base unit calculations
- **Border Radius**: Consistent radius values for components
- **Effects**: Elevation shadows and opacity values

### 🎯 **Semantic Tokens** (Usage Layer)

- **Text Colors**: Primary, secondary, tertiary, disabled, inverse
- **Surface Colors**: Primary, secondary, tertiary, interactive, button, inverse
- **Border Colors**: Default, subtle, strong, inverse
- **Action Colors**: Primary/secondary with default, hover, pressed, disabled states
- **Feedback Colors**: Success, error, warning, info with default and surface variants

### 🌓 **Theme Tokens** (Brand Layer)

- **Dark Theme**: Complete semantic overrides optimized for dark backgrounds
  - High contrast text colors (#dee2e7, #aeb4b9, #727284)
  - Dark surface progression (#17181c → #35383d)
  - Accessible border colors with proper contrast ratios
- **Light Theme**: Inverted semantic mappings optimized for light backgrounds
  - Dark text colors (#202225, #3a3d42, #484a55)
  - Light surface progression (#ffffff → #cccccc)
  - Consistent action colors across both themes

### 🔍 **WCAG Compliance Features**

- **Contrast Documentation**: Every color includes contrast ratio information
- **Accessibility Levels**: Clear AA/AAA compliance indicators
- **Usage Guidance**: Contextual descriptions for proper implementation
- **Validation Tools**: Automated checking of contrast requirements

## 🔗 External Resources

- **Token Consumption**: [DS-Simulate-Consume Repository](https://github.com/edmondmiu/DS-Simulate-Consume)
- **Figma Tokens**: [Direct JSON URL](https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json)
- **Token Studio**: [Figma Plugin](https://www.figma.com/community/plugin/843461159747178946/Figma-Tokens)

## 🔮 Future Enhancements

See [docs-archive/future-ideas/](./docs-archive/future-ideas/) for planned automation features including:

- Automated designer-to-developer pipeline
- Direct GitHub editing for designers
- Enhanced validation and approval workflows
- Real-time Firebase deployment

## 🆘 Getting Help

- Check the [docs/](./docs/) directory for detailed guides
- Review [docs-archive/](./docs-archive/) for historical context
- Contact the design system team for technical support

## 📊 System Status & Capabilities

### ✅ **Fully Implemented**

- **Dark/Light Theme System**: Complete semantic theme implementations with WCAG compliance
- **Bidirectional Sync**: Seamless synchronization between monolithic and modular editing
- **Token Studio Integration**: Full compatibility with Figma Token Studio plugin
- **Multi-Platform Builds**: Automated CSS, JavaScript, iOS Swift, and Android XML generation
- **Comprehensive Validation**: Automated testing for theme completeness, consistency, and compliance
- **AI-Friendly Architecture**: Modular structure optimized for programmatic editing

### ⚙️ **Operational Workflows**

- **Manual Pipeline**: Design system engineer oversight with quality control
- **Automated Builds**: Style Dictionary processing with mathematical expression evaluation
- **Public Distribution**: Figma-ready tokens via GitHub Pages and CDN
- **Validation Suite**: Comprehensive error detection and compliance checking

### 🚀 **Enhanced Capabilities**

- **Flexible Editing**: Choose between monolithic or modular workflows based on task
- **Theme Consistency**: Automated validation ensures both themes maintain semantic parity
- **Reference Integrity**: Validation of all token references and mathematical expressions
- **WCAG Compliance**: Built-in accessibility documentation and contrast validation

### 🔮 **Future Roadmap**

- **Automated Designer Pipeline**: Direct GitHub editing interface for designers
- **Real-time Validation**: Live feedback during token editing
- **Enhanced CI/CD**: Automated testing and deployment workflows
- **Advanced Theme Support**: Brand variations and custom theme generation

---

## 🎉 **Ready for Production Use**

This token system is **production-ready** with comprehensive theme support, validation tools, and flexible workflows that accommodate different team needs and editing preferences. The bidirectional sync capability ensures consistency while providing the flexibility to work in either monolithic or modular formats.
