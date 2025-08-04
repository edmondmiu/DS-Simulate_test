/**
 * AI Editing Integration Tests
 * 
 * Comprehensive test suite for AI-friendly editing interface
 * Tests all aspects of AI token editing workflow including:
 * - Session management
 * - Programmatic editing validation
 * - Automatic consolidation workflows
 * - Metadata preservation
 * - Complete workflow integration
 * 
 * Requirements tested: 6.1, 6.2, 6.3, 6.4, 6.5
 */

const fs = require('fs').promises;
const path = require('path');
const ModularEditingManager = require('../src/ModularEditingManager');
const AIWorkflowCommands = require('../scripts/ai-workflow-commands');
const WorkflowCommands = require('../scripts/workflow-commands');

describe('AI Editing Integration Tests', () => {
  let manager;
  let aiWorkflow;
  let workflow;
  let testTokensDir;
  let testSourcePath;
  let originalTokensDir;
  let originalSourcePath;

  beforeAll(async () => {
    // Setup test environment
    testTokensDir = path.join(__dirname, '..', '.temp', 'test-tokens');
    testSourcePath = path.join(__dirname, '..', '.temp', 'test-tokensource.json');
    
    // Store original paths
    originalTokensDir = 'tokens';
    originalSourcePath = 'tokensource.json';

    // Create test directory
    await fs.mkdir(path.dirname(testTokensDir), { recursive: true });

    // Initialize managers with test paths
    manager = new ModularEditingManager(testTokensDir);
    aiWorkflow = new AIWorkflowCommands();
    workflow = new WorkflowCommands();

    // Override paths for testing
    aiWorkflow.tokensDir = testTokensDir;
    aiWorkflow.sourcePath = testSourcePath;
    workflow.tokensDir = testTokensDir;
    workflow.sourcePath = testSourcePath;
  });

  beforeEach(async () => {
    // Clean test environment
    try {
      await fs.rm(testTokensDir, { recursive: true, force: true });
      await fs.rm(testSourcePath, { force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Create test source file
    const testSource = {
      "core": {
        "color": {
          "primary": {
            "$type": "color",
            "$value": "#007bff",
            "$description": "Primary brand color"
          },
          "secondary": {
            "$type": "color", 
            "$value": "#6c757d",
            "$description": "Secondary color"
          }
        },
        "spacing": {
          "base": {
            "$type": "dimension",
            "$value": "16px",
            "$description": "Base spacing unit"
          }
        }
      },
      "global": {
        "color": {
          "text": {
            "primary": {
              "$type": "color",
              "$value": "{core.color.primary}",
              "$description": "Primary text color"
            }
          },
          "background": {
            "primary": {
              "$type": "color",
              "$value": "#ffffff",
              "$description": "Primary background color"
            }
          }
        }
      },
      "$metadata": {
        "tokenSetOrder": ["core", "global"]
      },
      "$themes": [
        {
          "id": "light",
          "name": "Light",
          "selectedTokenSets": {
            "core": "source",
            "global": "enabled"
          }
        }
      ]
    };

    await fs.writeFile(testSourcePath, JSON.stringify(testSource, null, 2));

    // Split source to create tokens directory
    const splitResult = await workflow.splitSourceToTokens({ verbose: false });
    expect(splitResult.success).toBe(true);
  });

  afterEach(async () => {
    // Cleanup after each test
    if (manager) {
      await manager.cleanup();
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await fs.rm(path.dirname(testTokensDir), { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('AI Editing Session Management', () => {
    test('should initialize AI editing session successfully', async () => {
      const result = await aiWorkflow.initializeAIEditingSession({
        sessionId: 'test-session-001',
        verbose: false
      });

      expect(result.success).toBe(true);
      expect(result.details.sessionId).toBe('test-session-001');
      expect(result.details.tokensDirectory).toBe(testTokensDir);
      expect(result.details.availableFiles).toContain('core.json');
      expect(result.details.availableFiles).toContain('global.json');
      expect(result.details.initialValidation.isValid).toBe(true);
      expect(result.details.aiGuidelines).toEqual({
        preserveDescriptions: true,
        validateReferences: true,
        maintainTokenTypes: true,
        useSemanticNaming: true
      });
    });

    test('should handle session initialization with invalid tokens directory', async () => {
      // Remove tokens directory
      await fs.rm(testTokensDir, { recursive: true, force: true });

      const result = await aiWorkflow.initializeAIEditingSession({
        sessionId: 'test-session-002',
        verbose: false
      });

      // Should still succeed by creating tokens from source
      expect(result.success).toBe(true);
      expect(result.details.availableFiles.length).toBeGreaterThan(0);
    });

    test('should track session information correctly', async () => {
      const sessionId = 'test-session-003';
      
      await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });

      const sessionInfo = manager.getSessionInfo(sessionId);
      expect(sessionInfo).toBeTruthy();
      expect(sessionInfo.id).toBe(sessionId);
      expect(sessionInfo.status).toBe('active');
      expect(sessionInfo.options.autoValidate).toBe(true);
      expect(sessionInfo.options.preserveMetadata).toBe(true);
      expect(sessionInfo.options.trackChanges).toBe(true);
    });
  });

  describe('Programmatic Editing Validation', () => {
    let sessionId;

    beforeEach(async () => {
      sessionId = 'validation-test-session';
      const initResult = await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });
      expect(initResult.success).toBe(true);
    });

    test('should validate AI changes successfully', async () => {
      const result = await aiWorkflow.validateAIChanges({
        sessionId,
        verbose: false,
        comprehensive: true
      });

      expect(result.success).toBe(true);
      expect(result.validation.overallValid).toBe(true);
      expect(result.validation.totalIssues).toBe(0);
      expect(result.validation.criticalIssues).toBe(0);
      expect(result.validation.aiSpecificChecks.metadataPreserved).toBe(true);
      expect(result.validation.aiSpecificChecks.referencesValid).toBe(true);
      expect(result.validation.aiSpecificChecks.typesConsistent).toBe(true);
    });

    test('should detect validation issues in AI-modified tokens', async () => {
      // Introduce validation issues
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      
      // Remove required properties
      delete content.color.primary.$type;
      delete content.color.secondary.$description;
      
      // Add invalid reference
      content.color.invalid = {
        "$type": "color",
        "$value": "{nonexistent.token}",
        "$description": "Invalid reference"
      };

      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      const result = await aiWorkflow.validateAIChanges({
        sessionId,
        verbose: false
      });

      expect(result.success).toBe(false);
      expect(result.validation.overallValid).toBe(false);
      expect(result.validation.totalIssues).toBeGreaterThan(0);
      expect(result.validation.aiSpecificChecks.referencesValid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should provide AI-specific suggestions for improvements', async () => {
      // Create tokens without descriptions
      const globalFile = path.join(testTokensDir, 'global.json');
      const content = JSON.parse(await fs.readFile(globalFile, 'utf8'));
      
      // Remove descriptions
      delete content.color.text.primary.$description;
      delete content.color.background.primary.$description;

      await fs.writeFile(globalFile, JSON.stringify(content, null, 2));

      const result = await aiWorkflow.validateAIChanges({
        sessionId,
        verbose: false
      });

      expect(result.suggestions).toContain('Add $description properties to tokens for better documentation');
    });

    test('should validate token references correctly', async () => {
      const globalFile = path.join(testTokensDir, 'global.json');
      const content = JSON.parse(await fs.readFile(globalFile, 'utf8'));

      // Test valid reference resolution
      const reference = content.color.text.primary.$value; // "{core.color.primary}"
      const resolution = await manager.resolveTokenReference(reference, globalFile);

      expect(resolution.resolved).toBe(true);
      expect(resolution.value).toEqual({
        "$type": "color",
        "$value": "#007bff",
        "$description": "Primary brand color"
      });
      expect(resolution.tokenSet).toBe('core');
    });

    test('should preserve metadata during AI edits', async () => {
      const originalToken = {
        "$type": "color",
        "$value": "#007bff",
        "$description": "Primary brand color",
        "$extensions": {
          "figma": { "styleId": "S:abc123" }
        }
      };

      const aiModification = {
        "$type": "color",
        "$value": "#0066cc"
      };

      const preserved = manager.preserveTokenMetadata(originalToken, aiModification);

      expect(preserved.$type).toBe("color");
      expect(preserved.$value).toBe("#0066cc");
      expect(preserved.$description).toBe("Primary brand color");
      expect(preserved.$extensions).toEqual({
        "figma": { "styleId": "S:abc123" }
      });
    });
  });

  describe('Automatic Consolidation Workflows', () => {
    let sessionId;

    beforeEach(async () => {
      sessionId = 'consolidation-test-session';
      const initResult = await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });
      expect(initResult.success).toBe(true);
    });

    test('should perform automatic consolidation successfully', async () => {
      // Make some AI modifications
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      
      content.color.primary.$value = '#0066cc';
      content.color.accent = {
        "$type": "color",
        "$value": "{core.color.primary}",
        "$description": "Accent color derived from primary"
      };

      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      // Track the change
      await manager.trackChange(sessionId, coreFile, {
        type: 'ai_modification',
        tokens: ['color.primary', 'color.accent'],
        description: 'AI-generated color updates'
      });

      const result = await aiWorkflow.autoConsolidate({
        sessionId,
        verbose: false,
        validateBefore: true,
        validateAfter: true
      });

      expect(result.success).toBe(true);
      expect(result.consolidation.tokensCount).toBeGreaterThan(0);
      expect(result.metadata.preserved).toBe(true);

      // Verify changes were consolidated to source
      const sourceContent = JSON.parse(await fs.readFile(testSourcePath, 'utf8'));
      expect(sourceContent.core.color.primary.$value).toBe('#0066cc');
      expect(sourceContent.core.color.accent).toBeDefined();
      expect(sourceContent.core.color.accent.$description).toBe('Accent color derived from primary');
    });

    test('should handle consolidation with validation issues', async () => {
      // Introduce validation issues
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      
      // Add invalid token
      content.color.invalid = {
        "$value": "{nonexistent.token}"
        // Missing $type and $description
      };

      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      const result = await aiWorkflow.autoConsolidate({
        sessionId,
        verbose: false,
        validateBefore: true,
        validateAfter: true
      });

      // Should still consolidate but with warnings
      expect(result.success).toBe(true); // Consolidation succeeds
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should create backups during consolidation', async () => {
      const result = await aiWorkflow.autoConsolidate({
        sessionId,
        verbose: false,
        createBackup: true
      });

      expect(result.success).toBe(true);
      expect(result.consolidation.backupPath).toBeDefined();
      
      // Verify backup was created
      const backupExists = await fs.access(result.consolidation.backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should validate metadata preservation after consolidation', async () => {
      // Modify tokens while preserving metadata
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      
      content.color.primary.$value = '#0066cc';
      // Keep description intact

      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      const result = await aiWorkflow.autoConsolidate({
        sessionId,
        verbose: false
      });

      expect(result.success).toBe(true);
      expect(result.metadata.preserved).toBe(true);
      expect(result.metadata.preservationRate).toBeGreaterThan(80);

      // Verify descriptions were preserved in source
      const sourceContent = JSON.parse(await fs.readFile(testSourcePath, 'utf8'));
      expect(sourceContent.core.color.primary.$description).toBe('Primary brand color');
    });
  });

  describe('Complete AI Workflow Integration', () => {
    test('should execute complete AI workflow successfully', async () => {
      const result = await aiWorkflow.testAIWorkflow({
        includePerformanceTest: true,
        testModifications: true,
        verbose: false
      });

      expect(result.success).toBe(true);
      expect(result.testResults.stages.sessionInitialization.success).toBe(true);
      expect(result.testResults.stages.modifications.success).toBe(true);
      expect(result.testResults.stages.validation.success).toBe(true);
      expect(result.testResults.stages.consolidation.success).toBe(true);
      expect(result.performance.totalDuration).toBeGreaterThan(0);
      expect(result.performance.tokensPerSecond).toBeGreaterThan(0);
    });

    test('should handle workflow performance metrics', async () => {
      const result = await aiWorkflow.testAIWorkflow({
        includePerformanceTest: true,
        verbose: false
      });

      expect(result.performance).toBeDefined();
      expect(result.performance.totalDuration).toBeGreaterThan(0);
      expect(result.performance.stageBreakdown).toBeDefined();
      expect(result.performance.stageBreakdown.initialization).toBeGreaterThan(0);
      expect(result.performance.stageBreakdown.validation).toBeGreaterThan(0);
      expect(result.performance.stageBreakdown.consolidation).toBeGreaterThan(0);
      expect(result.performance.tokensPerSecond).toBeGreaterThan(0);
      expect(result.performance.memoryUsage).toBeDefined();
    });

    test('should provide workflow recommendations', async () => {
      const result = await aiWorkflow.testAIWorkflow({
        verbose: false
      });

      expect(result.testResults.recommendations).toBeDefined();
      expect(Array.isArray(result.testResults.recommendations)).toBe(true);
    });

    test('should handle workflow errors gracefully', async () => {
      // Remove source file to cause error
      await fs.rm(testSourcePath, { force: true });

      const result = await aiWorkflow.testAIWorkflow({
        verbose: false
      });

      expect(result.success).toBe(false);
      expect(result.testResults.issues.length).toBeGreaterThan(0);
    });
  });

  describe('AI Editing Session Lifecycle', () => {
    test('should manage complete session lifecycle', async () => {
      const sessionId = 'lifecycle-test-session';

      // 1. Initialize session
      const initResult = await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });
      expect(initResult.success).toBe(true);

      // 2. Verify session is active
      const sessionInfo = manager.getSessionInfo(sessionId);
      expect(sessionInfo.status).toBe('active');

      // 3. Make modifications
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      content.color.primary.$value = '#0066cc';
      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      // 4. Track changes
      await manager.trackChange(sessionId, coreFile, {
        type: 'test_modification',
        description: 'Lifecycle test modification'
      });

      // 5. Validate changes
      const validation = await manager.validateTokenFile(coreFile, sessionId);
      expect(validation.isValid).toBe(true);

      // 6. Finalize session
      const finalization = await manager.finalizeEditingSession(sessionId);
      expect(finalization.success).toBe(true);
      expect(finalization.summary.changesCount).toBe(1);
      expect(finalization.summary.filesModified).toContain(coreFile);

      // 7. Verify session is finalized
      const finalSessionInfo = manager.getSessionInfo(sessionId);
      expect(finalSessionInfo).toBeNull(); // Session should be cleaned up
    });

    test('should handle multiple concurrent sessions', async () => {
      const session1 = 'concurrent-session-1';
      const session2 = 'concurrent-session-2';

      // Initialize both sessions
      const init1 = await aiWorkflow.initializeAIEditingSession({
        sessionId: session1,
        verbose: false
      });
      const init2 = await aiWorkflow.initializeAIEditingSession({
        sessionId: session2,
        verbose: false
      });

      expect(init1.success).toBe(true);
      expect(init2.success).toBe(true);

      // Verify both sessions are active
      const activeSessions = manager.listActiveSessions();
      expect(activeSessions.length).toBe(2);
      expect(activeSessions.map(s => s.id)).toContain(session1);
      expect(activeSessions.map(s => s.id)).toContain(session2);

      // Finalize sessions
      await manager.finalizeEditingSession(session1);
      await manager.finalizeEditingSession(session2);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle file system errors gracefully', async () => {
      // Create session with non-existent directory
      const invalidManager = new ModularEditingManager('/nonexistent/path');
      
      const result = await invalidManager.initializeEditingSession('error-test', {
        autoValidate: false
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should recover from validation errors', async () => {
      const sessionId = 'recovery-test-session';
      
      await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });

      // Create invalid token structure
      const coreFile = path.join(testTokensDir, 'core.json');
      const invalidContent = {
        "invalid": "structure"
      };
      await fs.writeFile(coreFile, JSON.stringify(invalidContent, null, 2));

      const validation = await manager.validateTokenFile(coreFile, sessionId);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.suggestions.length).toBeGreaterThan(0);
    });

    test('should handle circular reference detection', async () => {
      const sessionId = 'circular-ref-test';
      
      await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });

      // Create circular references
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      
      content.color.tokenA = {
        "$type": "color",
        "$value": "{core.color.tokenB}",
        "$description": "Token A"
      };
      
      content.color.tokenB = {
        "$type": "color", 
        "$value": "{core.color.tokenA}",
        "$description": "Token B"
      };

      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      const validation = await aiWorkflow.validateAIChanges({
        sessionId,
        verbose: false
      });

      expect(validation.success).toBe(false);
      expect(validation.validation.aiSpecificChecks.referencesValid).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large token sets efficiently', async () => {
      // Create a large token set
      const coreFile = path.join(testTokensDir, 'core.json');
      const content = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      
      // Add 100 tokens
      for (let i = 0; i < 100; i++) {
        content.color[`token${i}`] = {
          "$type": "color",
          "$value": `#${i.toString(16).padStart(6, '0')}`,
          "$description": `Generated token ${i}`
        };
      }

      await fs.writeFile(coreFile, JSON.stringify(content, null, 2));

      const startTime = Date.now();
      
      const validation = await aiWorkflow.validateAIChanges({
        verbose: false,
        comprehensive: true
      });

      const duration = Date.now() - startTime;
      
      expect(validation.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain performance with complex reference chains', async () => {
      const coreFile = path.join(testTokensDir, 'core.json');
      const globalFile = path.join(testTokensDir, 'global.json');
      
      const coreContent = JSON.parse(await fs.readFile(coreFile, 'utf8'));
      const globalContent = JSON.parse(await fs.readFile(globalFile, 'utf8'));

      // Create reference chain: base -> level1 -> level2 -> level3
      coreContent.color.base = {
        "$type": "color",
        "$value": "#007bff",
        "$description": "Base color"
      };

      globalContent.color.level1 = {
        "$type": "color",
        "$value": "{core.color.base}",
        "$description": "Level 1 reference"
      };

      globalContent.color.level2 = {
        "$type": "color",
        "$value": "{global.color.level1}",
        "$description": "Level 2 reference"
      };

      globalContent.color.level3 = {
        "$type": "color",
        "$value": "{global.color.level2}",
        "$description": "Level 3 reference"
      };

      await fs.writeFile(coreFile, JSON.stringify(coreContent, null, 2));
      await fs.writeFile(globalFile, JSON.stringify(globalContent, null, 2));

      const startTime = Date.now();
      
      const resolution = await manager.resolveTokenReference(
        "{global.color.level3}",
        globalFile
      );

      const duration = Date.now() - startTime;

      expect(resolution.resolved).toBe(true);
      expect(resolution.value.$value).toBe("#007bff");
      expect(duration).toBeLessThan(1000); // Should resolve quickly
    });
  });
});