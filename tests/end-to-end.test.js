/**
 * End-to-End Integration Tests
 * 
 * Comprehensive end-to-end testing covering:
 * - Complete workflow from GitHub sync to designer import
 * - Real Token Studio format compatibility
 * - Multi-user collaboration scenarios
 * - Error recovery and rollback scenarios
 * - Production-like data volumes and complexity
 * 
 * Requirements tested: All requirements - comprehensive validation
 */

const fs = require('fs').promises;
const path = require('path');
const WorkflowCommands = require('../scripts/workflow-commands');
const AIWorkflowCommands = require('../scripts/ai-workflow-commands');
const MigrationSystem = require('../src/MigrationSystem');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');
const ValidationSystem = require('../src/ValidationSystem');
const FileStructureManager = require('../src/FileStructureManager');
const ModularEditingManager = require('../src/ModularEditingManager');

// Mock child_process for git operations
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const { execSync } = require('child_process');

describe('End-to-End Integration Tests', () => {
  let tempDir;
  let workflow;
  let aiWorkflow;
  let migration;
  let engine;
  let validator;
  let fileManager;
  let editingManager;
  let originalPaths;

  beforeAll(async () => {
    tempDir = await testUtils.createTempDir('e2e');
    
    // Initialize all components
    workflow = new WorkflowCommands();
    aiWorkflow = new AIWorkflowCommands();
    migration = new MigrationSystem();
    engine = new TokenTransformationEngine();
    validator = new ValidationSystem();
    fileManager = new FileStructureManager();
    editingManager = new ModularEditingManager(path.join(tempDir, 'tokens'));

    // Store original paths and override for testing
    originalPaths = {
      sourcePath: workflow.sourcePath,
      tokensDir: workflow.tokensDir,
      backupDir: workflow.backupDir
    };

    const testSourcePath = path.join(tempDir, 'tokensource.json');
    const testTokensDir = path.join(tempDir, 'tokens');
    const testBackupDir = path.join(tempDir, '.backups');

    workflow.sourcePath = testSourcePath;
    workflow.tokensDir = testTokensDir;
    workflow.backupDir = testBackupDir;

    aiWorkflow.sourcePath = testSourcePath;
    aiWorkflow.tokensDir = testTokensDir;
    aiWorkflow.backupDir = testBackupDir;

    // Create comprehensive test token source
    const comprehensiveSource = createComprehensiveTokenSource();
    await testUtils.writeJsonFile(testSourcePath, comprehensiveSource);
  });

  afterAll(async () => {
    // Restore original paths
    workflow.sourcePath = originalPaths.sourcePath;
    workflow.tokensDir = originalPaths.tokensDir;
    workflow.backupDir = originalPaths.backupDir;

    aiWorkflow.sourcePath = originalPaths.sourcePath;
    aiWorkflow.tokensDir = originalPaths.tokensDir;
    aiWorkflow.backupDir = originalPaths.backupDir;

    if (editingManager) {
      await editingManager.cleanup();
    }
    
    await testUtils.cleanupTempDir(tempDir);
  });

  beforeEach(() => {
    // Reset mocks
    execSync.mockClear();
    jest.clearAllMocks();
  });

  describe('Complete Workflow Integration', () => {
    test('should execute complete GitHub-centered workflow', async () => {
      // Mock git operations
      execSync
        .mockReturnValueOnce('') // git status --porcelain
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('https://github.com/edmondmiu/DS-Simulate_test.git') // remote URL
        .mockReturnValueOnce('main') // current branch
        .mockReturnValueOnce('Already up to date.\n'); // git pull

      // Step 1: Sync from GitHub
      const syncResult = await workflow.syncFromGithub({ verbose: false });
      expect(syncResult.success).toBe(true);
      expect(syncResult.details.importUrl).toContain('githubusercontent.com');

      // Step 2: Split source to modular format
      const splitResult = await workflow.splitSourceToTokens({ verbose: false });
      expect(splitResult.success).toBe(true);
      expect(splitResult.details.filesCreated).toBeGreaterThan(0);

      // Verify modular files were created
      const tokensDir = workflow.tokensDir;
      expect(await testUtils.fileExists(path.join(tokensDir, '$metadata.json'))).toBe(true);
      expect(await testUtils.fileExists(path.join(tokensDir, '$themes.json'))).toBe(true);
      expect(await testUtils.fileExists(path.join(tokensDir, 'core.json'))).toBe(true);

      // Step 3: Validate modular structure
      const structureValidation = await validator.validateTokenStudioStructure(tokensDir);
      expect(structureValidation.isValid).toBe(true);
      expect(structureValidation.issues).toHaveLength(0);

      // Step 4: Validate token references
      const referenceValidation = await validator.validateTokenReferences(tokensDir);
      expect(referenceValidation.isValid).toBe(true);
      expect(referenceValidation.unresolvedReferences).toHaveLength(0);

      // Step 5: Consolidate back to source
      const consolidateResult = await workflow.consolidateToSource({ 
        backup: true, 
        verbose: false 
      });
      expect(consolidateResult.success).toBe(true);
      expect(consolidateResult.details.tokensCount).toBeGreaterThan(0);
      expect(consolidateResult.details.backupPath).toBeDefined();

      // Step 6: Validate workflow integrity
      const integrityResult = await workflow.validateWorkflowIntegrity({ verbose: false });
      expect(integrityResult.success).toBe(true);

      // Step 7: Test designer import readiness
      execSync
        .mockReturnValueOnce('') // git status
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('https://github.com/edmondmiu/DS-Simulate_test.git') // remote
        .mockReturnValueOnce('main'); // branch

      const importTest = await workflow.testDesignerImport({ verbose: false });
      expect(importTest.success).toBe(true);
      expect(importTest.details.designerReadiness.canImport).toBe(true);
    }, TEST_CONSTANTS.TIMEOUT.LONG);

    test('should handle complete AI editing workflow', async () => {
      // Initialize workflow
      const startResult = await workflow.workflowStart({ sync: false, verbose: false });
      expect(startResult.success).toBe(true);

      // Initialize AI editing session
      const sessionId = 'e2e-ai-session';
      const aiInitResult = await aiWorkflow.initializeAIEditingSession({
        sessionId,
        verbose: false
      });
      expect(aiInitResult.success).toBe(true);
      expect(aiInitResult.details.sessionId).toBe(sessionId);

      // Simulate AI modifications
      const coreFile = path.join(workflow.tokensDir, 'core.json');
      const coreContent = await testUtils.readJsonFile(coreFile);
      
      // Add new tokens
      coreContent.color.accent = {
        "$type": "color",
        "$value": "#ff6600",
        "$description": "AI-generated accent color"
      };
      
      // Modify existing token
      coreContent.color.primary["500"].$value = "#0066cc";
      
      await testUtils.writeJsonFile(coreFile, coreContent);

      // Track changes
      await editingManager.trackChange(sessionId, coreFile, {
        type: 'ai_modification',
        tokens: ['color.accent', 'color.primary.500'],
        description: 'AI-generated color updates for better accessibility'
      });

      // Validate AI changes
      const validationResult = await aiWorkflow.validateAIChanges({
        sessionId,
        verbose: false,
        comprehensive: true
      });
      expect(validationResult.success).toBe(true);
      expect(validationResult.validation.overallValid).toBe(true);

      // Auto-consolidate changes
      const consolidateResult = await aiWorkflow.autoConsolidate({
        sessionId,
        verbose: false,
        validateBefore: true,
        validateAfter: true,
        createBackup: true
      });
      expect(consolidateResult.success).toBe(true);
      expect(consolidateResult.metadata.preserved).toBe(true);

      // Finalize workflow
      const finishResult = await workflow.workflowFinish({ verbose: false });
      expect(finishResult.success).toBe(true);
      expect(finishResult.details.readyForCommit).toBe(true);

      // Verify changes were preserved in source
      const finalSource = await testUtils.readJsonFile(workflow.sourcePath);
      expect(finalSource.core.color.accent).toBeDefined();
      expect(finalSource.core.color.accent.$value).toBe("#ff6600");
      expect(finalSource.core.color.primary["500"].$value).toBe("#0066cc");
    }, TEST_CONSTANTS.TIMEOUT.LONG);

    test('should handle migration workflow end-to-end', async () => {
      // Create old-style package.json
      const oldPackageJson = {
        name: 'test-migration',
        scripts: {
          build: 'echo build',
          transform: 'echo old transform',
          'build:source': 'echo old build source',
          'sync:bidirectional': 'echo old sync'
        }
      };
      
      const packageJsonPath = path.join(tempDir, 'package.json');
      await testUtils.writeJsonFile(packageJsonPath, oldPackageJson);

      // Override migration paths
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        // Pre-migration validation
        const preValidation = await migration.validatePreMigration();
        expect(preValidation.success).toBe(true);

        // Perform migration
        const migrationResult = await migration.performMigration({ 
          dryRun: false, 
          verbose: false 
        });
        expect(migrationResult.success).toBe(true);
        expect(migrationResult.details.scriptMigration.success).toBe(true);

        // Verify new scripts are present
        const updatedPackageJson = await testUtils.readJsonFile(packageJsonPath);
        expect(updatedPackageJson.scripts['split-source-to-tokens']).toBeDefined();
        expect(updatedPackageJson.scripts['consolidate-to-source']).toBeDefined();
        expect(updatedPackageJson.scripts.transform).toBeUndefined();

        // Test new workflow functionality
        const workflowValidation = await migration.validateNewWorkflow();
        expect(workflowValidation.success).toBe(true);

        // Test workflow integrity
        const integrityTest = await migration.testWorkflowIntegrity();
        expect(integrityTest.success).toBe(true);
        expect(integrityTest.details.comparison.identical).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    }, TEST_CONSTANTS.TIMEOUT.LONG);
  });

  describe('Multi-User Collaboration Scenarios', () => {
    test('should handle concurrent designer and engineer workflows', async () => {
      // Engineer workflow: Split and modify tokens
      const splitResult = await workflow.splitSourceToTokens({ verbose: false });
      expect(splitResult.success).toBe(true);

      // Engineer modifies tokens
      const globalFile = path.join(workflow.tokensDir, 'global.json');
      const globalContent = await testUtils.readJsonFile(globalFile);
      
      globalContent.component.button.borderRadius = {
        "$type": "dimension",
        "$value": "{core.spacing.sm}",
        "$description": "Button border radius"
      };
      
      await testUtils.writeJsonFile(globalFile, globalContent);

      // Engineer consolidates changes
      const consolidateResult = await workflow.consolidateToSource({ verbose: false });
      expect(consolidateResult.success).toBe(true);

      // Simulate designer import test
      execSync
        .mockReturnValueOnce('') // git status
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('https://github.com/edmondmiu/DS-Simulate_test.git') // remote
        .mockReturnValueOnce('main'); // branch

      const designerImportTest = await workflow.testDesignerImport({ verbose: false });
      expect(designerImportTest.success).toBe(true);
      expect(designerImportTest.details.designerReadiness.canImport).toBe(true);

      // Verify engineer changes are available for designer
      const finalSource = await testUtils.readJsonFile(workflow.sourcePath);
      expect(finalSource.global.component.button.borderRadius).toBeDefined();
    });

    test('should handle multiple AI editing sessions', async () => {
      // Start workflow
      await workflow.splitSourceToTokens({ verbose: false });

      // Initialize multiple AI sessions
      const session1 = 'multi-ai-session-1';
      const session2 = 'multi-ai-session-2';

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

      // Session 1: Modify core tokens
      const coreFile = path.join(workflow.tokensDir, 'core.json');
      const coreContent = await testUtils.readJsonFile(coreFile);
      
      coreContent.color.success = {
        "$type": "color",
        "$value": "#10b981",
        "$description": "Success color from AI session 1"
      };
      
      await testUtils.writeJsonFile(coreFile, coreContent);
      await editingManager.trackChange(session1, coreFile, {
        type: 'ai_addition',
        token: 'color.success'
      });

      // Session 2: Modify global tokens
      const globalFile = path.join(workflow.tokensDir, 'global.json');
      const globalContent = await testUtils.readJsonFile(globalFile);
      
      globalContent.semantic.success = {
        "$type": "color",
        "$value": "{core.color.success}",
        "$description": "Semantic success color from AI session 2"
      };
      
      await testUtils.writeJsonFile(globalFile, globalContent);
      await editingManager.trackChange(session2, globalFile, {
        type: 'ai_addition',
        token: 'semantic.success'
      });

      // Validate both sessions
      const validation1 = await aiWorkflow.validateAIChanges({
        sessionId: session1,
        verbose: false
      });
      const validation2 = await aiWorkflow.validateAIChanges({
        sessionId: session2,
        verbose: false
      });

      expect(validation1.success).toBe(true);
      expect(validation2.success).toBe(true);

      // Consolidate changes from both sessions
      const consolidate1 = await aiWorkflow.autoConsolidate({
        sessionId: session1,
        verbose: false
      });
      const consolidate2 = await aiWorkflow.autoConsolidate({
        sessionId: session2,
        verbose: false
      });

      expect(consolidate1.success).toBe(true);
      expect(consolidate2.success).toBe(true);

      // Verify both changes are in final source
      const finalSource = await testUtils.readJsonFile(workflow.sourcePath);
      expect(finalSource.core.color.success).toBeDefined();
      expect(finalSource.global.semantic.success).toBeDefined();
      expect(finalSource.global.semantic.success.$value).toBe("{core.color.success}");
    });
  });

  describe('Error Recovery and Rollback Scenarios', () => {
    test('should recover from validation failures', async () => {
      // Start with valid workflow
      const splitResult = await workflow.splitSourceToTokens({ verbose: false });
      expect(splitResult.success).toBe(true);

      // Introduce validation errors
      const coreFile = path.join(workflow.tokensDir, 'core.json');
      const invalidContent = {
        "invalid": {
          "token": {
            // Missing $type and $value
            "$description": "Invalid token"
          }
        },
        "circular1": {
          "$type": "color",
          "$value": "{circular2}",
          "$description": "Circular reference 1"
        },
        "circular2": {
          "$type": "color", 
          "$value": "{circular1}",
          "$description": "Circular reference 2"
        }
      };
      
      await testUtils.writeJsonFile(coreFile, invalidContent);

      // Validation should detect issues
      const validation = await validator.validateTokenStudioStructure(workflow.tokensDir);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);

      const referenceValidation = await validator.validateTokenReferences(workflow.tokensDir);
      expect(referenceValidation.isValid).toBe(false);

      // Attempt consolidation (should handle errors gracefully)
      const consolidateResult = await workflow.consolidateToSource({ 
        backup: true, 
        verbose: false 
      });
      
      // Consolidation might succeed but with warnings
      if (consolidateResult.success) {
        expect(consolidateResult.details.backupPath).toBeDefined();
      }

      // Restore from backup if needed
      if (consolidateResult.details.backupPath) {
        const backupFiles = await fs.readdir(consolidateResult.details.backupPath);
        expect(backupFiles).toContain('tokensource.json');
      }
    });

    test('should handle migration rollback scenario', async () => {
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        // Create package.json for migration
        const packageJson = {
          name: 'rollback-test',
          scripts: {
            build: 'echo build',
            transform: 'echo old transform'
          }
        };
        await testUtils.writeJsonFile('package.json', packageJson);

        // Create backup
        const backupResult = await migration.createMigrationBackup();
        expect(backupResult.success).toBe(true);

        // Perform migration
        const migrationResult = await migration.performMigration({ 
          dryRun: false, 
          verbose: false 
        });
        expect(migrationResult.success).toBe(true);

        // Verify migration occurred
        const migratedPackageJson = await testUtils.readJsonFile('package.json');
        expect(migratedPackageJson.scripts['split-source-to-tokens']).toBeDefined();
        expect(migratedPackageJson.scripts.transform).toBeUndefined();

        // Perform rollback
        const rollbackResult = await migration.rollbackMigration(backupResult.details.backupPath);
        expect(rollbackResult.success).toBe(true);

        // Verify rollback
        const rolledBackPackageJson = await testUtils.readJsonFile('package.json');
        expect(rolledBackPackageJson.scripts.transform).toBe('echo old transform');
        expect(rolledBackPackageJson.scripts['split-source-to-tokens']).toBeUndefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    test('should handle file system errors gracefully', async () => {
      // Test with read-only directory
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      
      // Create a file and make directory read-only
      const testFile = path.join(readOnlyDir, 'test.json');
      await testUtils.writeJsonFile(testFile, { test: 'data' });
      
      try {
        await fs.chmod(readOnlyDir, 0o444); // Read-only

        // Attempt operations that should fail gracefully
        const splitResult = await workflow.splitSourceToTokens({ 
          outputDir: readOnlyDir,
          verbose: false 
        });
        
        // Should handle the error gracefully
        expect(typeof splitResult.success).toBe('boolean');
        if (!splitResult.success) {
          expect(splitResult.message).toContain('failed');
        }
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });
  });

  describe('Production-Scale Data Testing', () => {
    test('should handle enterprise-scale token system', async () => {
      // Create enterprise-scale token source
      const enterpriseSource = createEnterpriseScaleTokenSource();
      const enterpriseSourcePath = path.join(tempDir, 'enterprise-source.json');
      await testUtils.writeJsonFile(enterpriseSourcePath, enterpriseSource);

      // Override source path temporarily
      const originalSourcePath = workflow.sourcePath;
      workflow.sourcePath = enterpriseSourcePath;

      try {
        // Test complete workflow with large dataset
        const splitResult = await workflow.splitSourceToTokens({ verbose: false });
        expect(splitResult.success).toBe(true);
        expect(splitResult.details.filesCreated).toBeGreaterThan(10);

        // Validate structure
        const structureValidation = await validator.validateTokenStudioStructure(workflow.tokensDir);
        expect(structureValidation.isValid).toBe(true);

        // Test consolidation
        const consolidateResult = await workflow.consolidateToSource({ verbose: false });
        expect(consolidateResult.success).toBe(true);
        expect(consolidateResult.details.tokensCount).toBeGreaterThan(1000);

        // Test integrity
        const integrityResult = await workflow.validateWorkflowIntegrity({ verbose: false });
        expect(integrityResult.success).toBe(true);
      } finally {
        workflow.sourcePath = originalSourcePath;
      }
    }, TEST_CONSTANTS.TIMEOUT.LONG);

    test('should handle complex theme configurations', async () => {
      // Create source with multiple complex themes
      const complexThemeSource = createComplexThemeSource();
      const complexSourcePath = path.join(tempDir, 'complex-themes-source.json');
      await testUtils.writeJsonFile(complexSourcePath, complexThemeSource);

      const originalSourcePath = workflow.sourcePath;
      workflow.sourcePath = complexSourcePath;

      try {
        const splitResult = await workflow.splitSourceToTokens({ verbose: false });
        expect(splitResult.success).toBe(true);

        // Validate themes
        const themeValidation = await validator.validateThemeCompleteness(workflow.tokensDir);
        expect(themeValidation.isValid).toBe(true);
        expect(themeValidation.incompleteThemes).toHaveLength(0);

        // Test designer import with complex themes
        execSync
          .mockReturnValueOnce('')
          .mockReturnValueOnce('')
          .mockReturnValueOnce('https://github.com/edmondmiu/DS-Simulate_test.git')
          .mockReturnValueOnce('main');

        const importTest = await workflow.testDesignerImport({ verbose: false });
        expect(importTest.success).toBe(true);
        expect(importTest.details.structureRequirements.themes.length).toBeGreaterThan(5);
      } finally {
        workflow.sourcePath = originalSourcePath;
      }
    });
  });

  describe('Real Token Studio Compatibility', () => {
    test('should generate Token Studio compatible structure', async () => {
      const splitResult = await workflow.splitSourceToTokens({ verbose: false });
      expect(splitResult.success).toBe(true);

      // Verify Token Studio required files
      const tokensDir = workflow.tokensDir;
      const metadataFile = path.join(tokensDir, '$metadata.json');
      const themesFile = path.join(tokensDir, '$themes.json');

      expect(await testUtils.fileExists(metadataFile)).toBe(true);
      expect(await testUtils.fileExists(themesFile)).toBe(true);

      // Verify metadata structure
      const metadata = await testUtils.readJsonFile(metadataFile);
      expect(metadata).toHaveProperty('tokenSetOrder');
      expect(Array.isArray(metadata.tokenSetOrder)).toBe(true);

      // Verify themes structure
      const themes = await testUtils.readJsonFile(themesFile);
      expect(Array.isArray(themes)).toBe(true);
      
      if (themes.length > 0) {
        const theme = themes[0];
        expect(theme).toHaveProperty('id');
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('selectedTokenSets');
        expect(typeof theme.selectedTokenSets).toBe('object');
      }

      // Verify token file structure
      const coreFile = path.join(tokensDir, 'core.json');
      if (await testUtils.fileExists(coreFile)) {
        const coreTokens = await testUtils.readJsonFile(coreFile);
        
        // Check for Token Studio format
        const findTokens = (obj, path = []) => {
          const tokens = [];
          for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object') {
              if (value.$type && value.$value !== undefined) {
                tokens.push({ path: [...path, key], token: value });
              } else {
                tokens.push(...findTokens(value, [...path, key]));
              }
            }
          }
          return tokens;
        };

        const tokens = findTokens(coreTokens);
        expect(tokens.length).toBeGreaterThan(0);
        
        // Verify token format
        tokens.forEach(({ token }) => {
          expect(token).toHaveProperty('$type');
          expect(token).toHaveProperty('$value');
        });
      }
    });

    test('should maintain Figma references in themes', async () => {
      const splitResult = await workflow.splitSourceToTokens({ verbose: false });
      expect(splitResult.success).toBe(true);

      const themesFile = path.join(workflow.tokensDir, '$themes.json');
      const themes = await testUtils.readJsonFile(themesFile);

      // Check for Figma references
      const themesWithFigmaRefs = themes.filter(theme => 
        theme.$figmaStyleReferences || theme.$figmaVariableReferences
      );

      if (themesWithFigmaRefs.length > 0) {
        const theme = themesWithFigmaRefs[0];
        
        if (theme.$figmaStyleReferences) {
          expect(typeof theme.$figmaStyleReferences).toBe('object');
        }
        
        if (theme.$figmaVariableReferences) {
          expect(typeof theme.$figmaVariableReferences).toBe('object');
        }
      }

      // Test consolidation preserves Figma references
      const consolidateResult = await workflow.consolidateToSource({ verbose: false });
      expect(consolidateResult.success).toBe(true);

      const finalSource = await testUtils.readJsonFile(workflow.sourcePath);
      if (finalSource.$themes && finalSource.$themes.length > 0) {
        const consolidatedTheme = finalSource.$themes.find(t => 
          t.$figmaStyleReferences || t.$figmaVariableReferences
        );
        
        if (consolidatedTheme) {
          expect(consolidatedTheme.$figmaStyleReferences || consolidatedTheme.$figmaVariableReferences).toBeDefined();
        }
      }
    });
  });

  // Helper functions
  function createComprehensiveTokenSource() {
    return {
      "core": {
        "color": {
          "primary": {
            "50": { "$type": "color", "$value": "#eff6ff", "$description": "Primary 50" },
            "100": { "$type": "color", "$value": "#dbeafe", "$description": "Primary 100" },
            "200": { "$type": "color", "$value": "#bfdbfe", "$description": "Primary 200" },
            "300": { "$type": "color", "$value": "#93c5fd", "$description": "Primary 300" },
            "400": { "$type": "color", "$value": "#60a5fa", "$description": "Primary 400" },
            "500": { "$type": "color", "$value": "#3b82f6", "$description": "Primary 500" },
            "600": { "$type": "color", "$value": "#2563eb", "$description": "Primary 600" },
            "700": { "$type": "color", "$value": "#1d4ed8", "$description": "Primary 700" },
            "800": { "$type": "color", "$value": "#1e40af", "$description": "Primary 800" },
            "900": { "$type": "color", "$value": "#1e3a8a", "$description": "Primary 900" }
          },
          "neutral": {
            "50": { "$type": "color", "$value": "#f9fafb" },
            "100": { "$type": "color", "$value": "#f3f4f6" },
            "200": { "$type": "color", "$value": "#e5e7eb" },
            "300": { "$type": "color", "$value": "#d1d5db" },
            "400": { "$type": "color", "$value": "#9ca3af" },
            "500": { "$type": "color", "$value": "#6b7280" },
            "600": { "$type": "color", "$value": "#4b5563" },
            "700": { "$type": "color", "$value": "#374151" },
            "800": { "$type": "color", "$value": "#1f2937" },
            "900": { "$type": "color", "$value": "#111827" }
          }
        },
        "spacing": {
          "0": { "$type": "dimension", "$value": "0px" },
          "1": { "$type": "dimension", "$value": "4px" },
          "2": { "$type": "dimension", "$value": "8px" },
          "3": { "$type": "dimension", "$value": "12px" },
          "4": { "$type": "dimension", "$value": "16px" },
          "5": { "$type": "dimension", "$value": "20px" },
          "6": { "$type": "dimension", "$value": "24px" },
          "8": { "$type": "dimension", "$value": "32px" },
          "10": { "$type": "dimension", "$value": "40px" },
          "12": { "$type": "dimension", "$value": "48px" }
        },
        "typography": {
          "fontFamily": {
            "sans": { "$type": "fontFamily", "$value": "Inter, system-ui, sans-serif" },
            "serif": { "$type": "fontFamily", "$value": "Georgia, serif" },
            "mono": { "$type": "fontFamily", "$value": "JetBrains Mono, monospace" }
          },
          "fontSize": {
            "xs": { "$type": "dimension", "$value": "12px" },
            "sm": { "$type": "dimension", "$value": "14px" },
            "base": { "$type": "dimension", "$value": "16px" },
            "lg": { "$type": "dimension", "$value": "18px" },
            "xl": { "$type": "dimension", "$value": "20px" },
            "2xl": { "$type": "dimension", "$value": "24px" },
            "3xl": { "$type": "dimension", "$value": "30px" },
            "4xl": { "$type": "dimension", "$value": "36px" }
          },
          "fontWeight": {
            "light": { "$type": "fontWeight", "$value": "300" },
            "normal": { "$type": "fontWeight", "$value": "400" },
            "medium": { "$type": "fontWeight", "$value": "500" },
            "semibold": { "$type": "fontWeight", "$value": "600" },
            "bold": { "$type": "fontWeight", "$value": "700" }
          }
        }
      },
      "global": {
        "semantic": {
          "primary": { "$type": "color", "$value": "{core.color.primary.500}" },
          "background": { "$type": "color", "$value": "{core.color.neutral.50}" },
          "surface": { "$type": "color", "$value": "#ffffff" },
          "text": {
            "primary": { "$type": "color", "$value": "{core.color.neutral.900}" },
            "secondary": { "$type": "color", "$value": "{core.color.neutral.600}" },
            "muted": { "$type": "color", "$value": "{core.color.neutral.400}" }
          }
        },
        "component": {
          "button": {
            "padding": {
              "sm": { "$type": "dimension", "$value": "{core.spacing.2} {core.spacing.3}" },
              "md": { "$type": "dimension", "$value": "{core.spacing.3} {core.spacing.4}" },
              "lg": { "$type": "dimension", "$value": "{core.spacing.4} {core.spacing.6}" }
            },
            "background": {
              "primary": { "$type": "color", "$value": "{global.semantic.primary}" },
              "secondary": { "$type": "color", "$value": "{core.color.neutral.100}" }
            },
            "text": {
              "primary": { "$type": "color", "$value": "#ffffff" },
              "secondary": { "$type": "color", "$value": "{global.semantic.text.primary}" }
            }
          },
          "card": {
            "padding": { "$type": "dimension", "$value": "{core.spacing.6}" },
            "background": { "$type": "color", "$value": "{global.semantic.surface}" },
            "border": { "$type": "color", "$value": "{core.color.neutral.200}" }
          }
        }
      },
      "simulate": {
        "brand": {
          "primary": { "$type": "color", "$value": "{global.semantic.primary}" },
          "accent": { "$type": "color", "$value": "{core.color.primary.100}" }
        }
      },
      "$metadata": {
        "tokenSetOrder": ["core", "global", "simulate"]
      },
      "$themes": [
        {
          "id": "light-theme",
          "name": "Light Theme",
          "selectedTokenSets": {
            "core": "source",
            "global": "enabled",
            "simulate": "enabled"
          },
          "$figmaStyleReferences": {
            "core.color.primary.500": "S:abc123",
            "global.semantic.primary": "S:def456"
          }
        },
        {
          "id": "dark-theme",
          "name": "Dark Theme",
          "selectedTokenSets": {
            "core": "source",
            "global": "enabled",
            "simulate": "disabled"
          }
        }
      ]
    };
  }

  function createEnterpriseScaleTokenSource() {
    const source = createComprehensiveTokenSource();
    
    // Add multiple brand variations
    const brands = ['brand-a', 'brand-b', 'brand-c', 'brand-d'];
    brands.forEach(brand => {
      source[brand] = {
        color: {
          primary: { "$type": "color", "$value": `{core.color.primary.${Math.floor(Math.random() * 9 + 1) * 100}}` },
          secondary: { "$type": "color", "$value": `{core.color.neutral.${Math.floor(Math.random() * 9 + 1) * 100}}` }
        }
      };
    });

    // Add component variations
    const components = ['button', 'card', 'input', 'modal', 'nav', 'footer', 'header', 'sidebar'];
    source.components = {};
    components.forEach(component => {
      source.components[component] = {
        background: { "$type": "color", "$value": "{global.semantic.surface}" },
        border: { "$type": "color", "$value": "{core.color.neutral.200}" },
        padding: { "$type": "dimension", "$value": "{core.spacing.4}" }
      };
    });

    // Update metadata and themes
    source.$metadata.tokenSetOrder = ['core', 'global', ...brands, 'components', 'simulate'];
    
    // Add more themes
    brands.forEach(brand => {
      source.$themes.push({
        id: `${brand}-theme`,
        name: `${brand.replace('-', ' ').toUpperCase()} Theme`,
        selectedTokenSets: {
          core: 'source',
          global: 'enabled',
          [brand]: 'enabled',
          components: 'enabled'
        }
      });
    });

    return source;
  }

  function createComplexThemeSource() {
    const source = createComprehensiveTokenSource();
    
    // Add more complex themes
    const additionalThemes = [
      {
        id: 'high-contrast',
        name: 'High Contrast',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled'
        }
      },
      {
        id: 'mobile-optimized',
        name: 'Mobile Optimized',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled',
          simulate: 'enabled'
        }
      },
      {
        id: 'print-friendly',
        name: 'Print Friendly',
        selectedTokenSets: {
          core: 'source',
          global: 'disabled',
          simulate: 'disabled'
        }
      },
      {
        id: 'accessibility-enhanced',
        name: 'Accessibility Enhanced',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled',
          simulate: 'enabled'
        },
        "$figmaStyleReferences": {
          "core.color.primary.500": "S:accessibility-primary",
          "global.semantic.text.primary": "S:accessibility-text"
        }
      }
    ];

    source.$themes.push(...additionalThemes);
    return source;
  }
}, TEST_CONSTANTS.TIMEOUT.LONG);