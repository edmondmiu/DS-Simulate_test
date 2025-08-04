# AI-Friendly Token Editing Guide

## Overview

The Token Studio Native Workflow system provides a comprehensive AI-friendly editing interface that enables programmatic token management while maintaining design system integrity. This guide covers the complete workflow for AI tools to edit design tokens safely and efficiently.

## 🎯 Key Features for AI Tools

- **Modular File Structure**: Token Studio's native format optimized for targeted editing
- **Real-time Validation**: Immediate feedback on token changes and references
- **Automatic Consolidation**: Seamless integration back to single source of truth
- **Metadata Preservation**: Maintains human-readable descriptions and design context
- **Session Management**: Tracks changes and provides rollback capabilities
- **Reference Resolution**: Validates token relationships and dependencies

## 🏗️ Modular File Structure

### Directory Layout

```
tokens/
├── $metadata.json          # Token set order and configuration
├── $themes.json            # Theme definitions and Figma references
├── core.json               # Foundation tokens (Color Ramp, typography, spacing)
├── global.json             # Semantic tokens (color, dark, light themes)
├── simulate.json           # Brand-specific tokens
├── components.json         # Component-specific tokens (if needed)
└── [additional-sets].json  # Other token sets as needed
```

### File Structure Details

#### `$metadata.json` - Token Set Configuration
```json
{
  "tokenSetOrder": [
    "core",
    "global", 
    "simulate",
    "components"
  ]
}
```

**Purpose**: Defines the order in which token sets are processed and applied.
**AI Editing**: Generally should not be modified unless adding new token sets.

#### `$themes.json` - Theme Definitions
```json
[
  {
    "id": "light-theme",
    "name": "Light",
    "selectedTokenSets": {
      "core": "source",
      "global": "enabled",
      "simulate": "enabled"
    },
    "$figmaStyleReferences": {
      "color.text.primary": "S:figma-style-id"
    }
  }
]
```

**Purpose**: Defines theme configurations and Figma integration references.
**AI Editing**: Can be modified to add new themes or update theme configurations.

#### Token Set Files (e.g., `core.json`, `global.json`)
```json
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "#007bff",
      "$description": "Primary brand color used for main actions and highlights"
    },
    "text": {
      "primary": {
        "$type": "color",
        "$value": "{color.neutral.900}",
        "$description": "Primary text color for body content"
      }
    }
  }
}
```

**Purpose**: Contains actual token definitions with values, types, and descriptions.
**AI Editing**: Primary target for token modifications and additions.

## 🤖 AI Editing Workflow

### 1. Initialize Editing Session

```javascript
const ModularEditingManager = require('./src/ModularEditingManager');

const manager = new ModularEditingManager('tokens');

// Initialize AI editing session
const session = await manager.initializeEditingSession('ai-session-001', {
  autoValidate: true,        // Enable real-time validation
  preserveMetadata: true,    // Maintain descriptions and context
  trackChanges: true         // Track all modifications
});

if (!session.success) {
  console.error('Session initialization failed:', session.errors);
  return;
}

console.log('AI editing session started:', session.session.id);
```

### 2. Validate Token Files Before Editing

```javascript
// Validate specific token file
const validation = await manager.validateTokenFile('tokens/global.json');

if (!validation.isValid) {
  console.log('Validation issues found:');
  validation.issues.forEach(issue => {
    console.log(`- ${issue.severity}: ${issue.message}`);
    if (issue.suggestion) {
      console.log(`  💡 ${issue.suggestion}`);
    }
  });
}
```

### 3. Edit Token Files Programmatically

```javascript
const fs = require('fs').promises;

// Read current token file
const tokenFile = 'tokens/global.json';
const content = JSON.parse(await fs.readFile(tokenFile, 'utf8'));

// Make AI-driven modifications
content.color.primary = {
  "$type": "color",
  "$value": "#0066cc",
  "$description": "Updated primary color for better accessibility"
};

// Add new token
content.color.accent = {
  "$type": "color", 
  "$value": "{color.primary}",
  "$description": "Accent color derived from primary"
};

// Write changes back
await fs.writeFile(tokenFile, JSON.stringify(content, null, 2));

// Track the change
await manager.trackChange('ai-session-001', tokenFile, {
  type: 'token_modification',
  tokens: ['color.primary', 'color.accent'],
  description: 'Updated primary color and added accent variant'
});
```

### 4. Validate Changes in Real-time

```javascript
// Validate after modifications
const postEditValidation = await manager.validateTokenFile(tokenFile, 'ai-session-001');

if (!postEditValidation.isValid) {
  console.log('Post-edit validation failed:');
  postEditValidation.issues.forEach(issue => {
    console.log(`- ${issue.type}: ${issue.message}`);
  });
  
  // AI can use suggestions to fix issues
  console.log('Suggestions:');
  postEditValidation.suggestions.forEach(suggestion => {
    console.log(`- ${suggestion}`);
  });
}
```

### 5. Resolve Token References

```javascript
// Validate token references resolve correctly
const reference = "{color.primary}";
const resolution = await manager.resolveTokenReference(reference, tokenFile);

if (resolution.resolved) {
  console.log(`Reference ${reference} resolves to:`, resolution.value);
  console.log(`Found in token set:`, resolution.tokenSet);
} else {
  console.log(`Failed to resolve ${reference}:`, resolution.errors);
}
```

### 6. Finalize Editing Session

```javascript
// Complete the editing session
const sessionSummary = await manager.finalizeEditingSession('ai-session-001');

if (sessionSummary.success) {
  console.log('Session completed successfully:');
  console.log(`- Files modified: ${sessionSummary.summary.filesModified.length}`);
  console.log(`- Changes made: ${sessionSummary.summary.changesCount}`);
  console.log(`- Validation status: ${sessionSummary.summary.status}`);
} else {
  console.log('Session finalization failed:', sessionSummary.errors);
}
```

### 7. Consolidate Changes to Source

```javascript
const WorkflowCommands = require('./scripts/workflow-commands');
const workflow = new WorkflowCommands();

// Consolidate modular changes back to tokensource.json
const consolidation = await workflow.consolidateToSource({
  verbose: true,
  backup: true
});

if (consolidation.success) {
  console.log('Changes consolidated to tokensource.json');
  console.log(`Processed ${consolidation.details.tokensCount} tokens`);
} else {
  console.log('Consolidation failed:', consolidation.message);
}
```

## 🔧 Programmatic Editing Validation

### Token Structure Validation

The system validates Token Studio format compliance:

```javascript
// Valid token structure
const validToken = {
  "$type": "color",           // Required: token type
  "$value": "#007bff",        // Required: token value or reference
  "$description": "Primary brand color"  // Recommended: human-readable description
};

// Invalid structures will be flagged
const invalidToken = {
  "value": "#007bff",         // Missing $ prefix
  "type": "color"             // Missing $ prefix
};
```

### Reference Validation

Token references are validated to ensure they resolve correctly:

```javascript
// Valid reference formats
const validReferences = [
  "{color.primary}",          // Simple reference
  "{color.neutral.900}",      // Nested reference
  "{spacing.base}"            // Cross-category reference
];

// Invalid references will be flagged
const invalidReferences = [
  "color.primary",            // Missing braces
  "{nonexistent.token}",      // Reference to non-existent token
  "{color.primary.invalid}"   // Invalid path
];
```

### Metadata Preservation

The system automatically preserves important metadata:

```javascript
// Original token with metadata
const originalToken = {
  "$type": "color",
  "$value": "#007bff",
  "$description": "Primary brand color",
  "$extensions": {
    "figma": {
      "styleId": "S:abc123"
    }
  }
};

// AI modification
const aiModification = {
  "$type": "color",
  "$value": "#0066cc"  // Only changing the value
};

// System preserves metadata automatically
const preservedToken = manager.preserveTokenMetadata(originalToken, aiModification);
// Result includes original description and extensions
```

## 🔄 Automatic Consolidation Workflows

### Workflow Commands for AI Tools

```bash
# Prepare tokens for AI editing
npm run split-source-to-tokens

# AI performs edits on modular files
# ... AI editing process ...

# Consolidate changes back to source
npm run consolidate-to-source

# Validate complete workflow integrity
npm run validate-workflow-integrity
```

### Programmatic Workflow Management

```javascript
const workflow = new WorkflowCommands();

// Complete AI editing workflow
async function aiEditingWorkflow() {
  // 1. Prepare modular structure
  const split = await workflow.splitSourceToTokens({ verbose: true });
  if (!split.success) throw new Error(`Split failed: ${split.message}`);
  
  // 2. AI performs edits
  // ... AI editing logic here ...
  
  // 3. Consolidate changes
  const consolidate = await workflow.consolidateToSource({ verbose: true });
  if (!consolidate.success) throw new Error(`Consolidation failed: ${consolidate.message}`);
  
  // 4. Validate integrity
  const validation = await workflow.validateWorkflowIntegrity({ verbose: true });
  if (!validation.success) {
    console.warn('Validation issues detected:', validation.message);
  }
  
  return {
    success: true,
    tokensProcessed: consolidate.details.tokensCount,
    validationPassed: validation.success
  };
}
```

## 📊 AI Workflow Testing and Validation

### Comprehensive Testing Framework

```javascript
// Test AI editing scenarios
async function testAIEditingScenario() {
  const manager = new ModularEditingManager('tokens');
  
  // Initialize session
  const session = await manager.initializeEditingSession('test-session');
  
  // Simulate AI edits
  const testEdits = [
    {
      file: 'tokens/global.json',
      changes: {
        'color.primary': { '$value': '#0066cc' },
        'color.secondary': { '$value': '{color.primary}' }
      }
    }
  ];
  
  // Apply and validate each edit
  for (const edit of testEdits) {
    // Apply changes
    await applyTokenChanges(edit.file, edit.changes);
    
    // Validate immediately
    const validation = await manager.validateTokenFile(edit.file, session.session.id);
    
    if (!validation.isValid) {
      console.error(`Validation failed for ${edit.file}:`, validation.issues);
      return false;
    }
  }
  
  // Finalize session
  const summary = await manager.finalizeEditingSession('test-session');
  
  return summary.success && summary.summary.status === 'completed';
}
```

### Integration Testing

```javascript
// Test complete AI workflow integration
async function testCompleteAIWorkflow() {
  const workflow = new WorkflowCommands();
  
  // Test split operation
  const splitResult = await workflow.splitSourceToTokens({ verbose: false });
  if (!splitResult.success) return { success: false, stage: 'split' };
  
  // Simulate AI editing session
  const editingResult = await simulateAIEditing();
  if (!editingResult.success) return { success: false, stage: 'editing' };
  
  // Test consolidation
  const consolidateResult = await workflow.consolidateToSource({ verbose: false });
  if (!consolidateResult.success) return { success: false, stage: 'consolidation' };
  
  // Test validation
  const validationResult = await workflow.validateWorkflowIntegrity({ verbose: false });
  
  return {
    success: true,
    stages: {
      split: splitResult.success,
      editing: editingResult.success,
      consolidation: consolidateResult.success,
      validation: validationResult.success
    }
  };
}
```

## 🛡️ Error Handling and Recovery

### Common Error Scenarios

1. **Invalid Token Structure**
   ```javascript
   // Error: Missing required properties
   const invalidToken = { "value": "#fff" }; // Missing $type and $value
   
   // Solution: Add required properties
   const validToken = {
     "$type": "color",
     "$value": "#fff",
     "$description": "White color"
   };
   ```

2. **Unresolved References**
   ```javascript
   // Error: Reference to non-existent token
   const invalidRef = { "$value": "{color.nonexistent}" };
   
   // Solution: Create referenced token or fix reference
   const validRef = { "$value": "{color.primary}" };
   ```

3. **Circular References**
   ```javascript
   // Error: Circular dependency
   // token A references B, B references A
   
   // Solution: Break circular dependency by using base values
   ```

### Recovery Strategies

```javascript
// Automatic error recovery
async function recoverFromErrors(validationResult) {
  const fixes = [];
  
  for (const issue of validationResult.issues) {
    switch (issue.type) {
      case 'missing_token_type':
        // Auto-infer type from value
        const inferredType = inferTokenType(issue.value);
        fixes.push({
          path: issue.path,
          fix: { "$type": inferredType }
        });
        break;
        
      case 'unresolved_reference':
        // Suggest similar tokens
        const suggestions = findSimilarTokens(issue.reference);
        fixes.push({
          path: issue.path,
          suggestions: suggestions
        });
        break;
    }
  }
  
  return fixes;
}
```

## 📋 Best Practices for AI Tools

### 1. Always Initialize Sessions
- Use `ModularEditingManager` for session management
- Enable auto-validation for real-time feedback
- Track all changes for audit trails

### 2. Validate Before and After Edits
- Check file structure before making changes
- Validate token syntax and references after edits
- Use suggestions to fix validation issues

### 3. Preserve Human Context
- Maintain `$description` properties
- Preserve Figma style references
- Keep semantic naming conventions

### 4. Handle References Carefully
- Validate all token references resolve correctly
- Avoid creating circular dependencies
- Use reference resolution to understand token relationships

### 5. Test Changes Thoroughly
- Use roundtrip validation to ensure data integrity
- Test theme completeness after modifications
- Validate multi-platform output compatibility

### 6. Follow Consolidation Workflow
- Always consolidate changes back to `tokensource.json`
- Create backups before major operations
- Validate workflow integrity after consolidation

## 🔗 API Reference

### ModularEditingManager

#### Methods

- `initializeEditingSession(sessionId, options)` - Start AI editing session
- `validateTokenFile(filePath, sessionId)` - Validate token file structure
- `resolveTokenReference(reference, contextFile)` - Resolve token references
- `preserveTokenMetadata(originalToken, editedToken)` - Preserve metadata
- `trackChange(sessionId, filePath, change)` - Track modifications
- `finalizeEditingSession(sessionId)` - Complete editing session

### WorkflowCommands

#### Methods

- `splitSourceToTokens(options)` - Convert to modular format
- `consolidateToSource(options)` - Merge back to source
- `validateWorkflowIntegrity(options)` - Validate complete workflow

### ValidationSystem

#### Methods

- `generateValidationReport(tokensDir, sourcePath)` - Comprehensive validation
- `validateTokenStudioStructure(tokensDir)` - Structure validation
- `validateTokenReferences(tokensDir)` - Reference validation

## 🎯 Example AI Implementation

```javascript
class AITokenEditor {
  constructor() {
    this.manager = new ModularEditingManager('tokens');
    this.workflow = new WorkflowCommands();
    this.sessionId = `ai-session-${Date.now()}`;
  }
  
  async editTokens(modifications) {
    try {
      // 1. Initialize session
      const session = await this.manager.initializeEditingSession(this.sessionId, {
        autoValidate: true,
        preserveMetadata: true,
        trackChanges: true
      });
      
      if (!session.success) {
        throw new Error(`Session initialization failed: ${session.errors.join(', ')}`);
      }
      
      // 2. Apply modifications
      for (const mod of modifications) {
        await this.applyModification(mod);
        
        // Validate each change
        const validation = await this.manager.validateTokenFile(mod.file, this.sessionId);
        if (!validation.isValid) {
          console.warn(`Validation issues in ${mod.file}:`, validation.issues);
        }
      }
      
      // 3. Finalize session
      const summary = await this.manager.finalizeEditingSession(this.sessionId);
      
      // 4. Consolidate changes
      const consolidation = await this.workflow.consolidateToSource({
        verbose: false,
        backup: true
      });
      
      return {
        success: consolidation.success,
        sessionSummary: summary.summary,
        consolidationDetails: consolidation.details
      };
      
    } catch (error) {
      console.error('AI token editing failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  async applyModification(modification) {
    const fs = require('fs').promises;
    
    // Read current file
    const content = JSON.parse(await fs.readFile(modification.file, 'utf8'));
    
    // Apply changes
    for (const [path, value] of Object.entries(modification.changes)) {
      this.setNestedProperty(content, path, value);
    }
    
    // Write back
    await fs.writeFile(modification.file, JSON.stringify(content, null, 2));
    
    // Track change
    await this.manager.trackChange(this.sessionId, modification.file, {
      type: 'ai_modification',
      paths: Object.keys(modification.changes),
      description: modification.description || 'AI-generated modification'
    });
  }
  
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    // Preserve metadata if editing existing token
    if (current[keys[keys.length - 1]] && typeof current[keys[keys.length - 1]] === 'object') {
      const preserved = this.manager.preserveTokenMetadata(
        current[keys[keys.length - 1]], 
        value
      );
      current[keys[keys.length - 1]] = preserved;
    } else {
      current[keys[keys.length - 1]] = value;
    }
  }
}

// Usage example
const aiEditor = new AITokenEditor();

const modifications = [
  {
    file: 'tokens/global.json',
    changes: {
      'color.primary': {
        '$type': 'color',
        '$value': '#0066cc',
        '$description': 'Updated primary color for better accessibility'
      }
    },
    description: 'Accessibility improvement for primary color'
  }
];

aiEditor.editTokens(modifications).then(result => {
  if (result.success) {
    console.log('AI token editing completed successfully');
  } else {
    console.error('AI token editing failed:', result.error);
  }
});
```

This comprehensive guide provides AI tools with everything needed to safely and effectively edit design tokens while maintaining system integrity and design context.