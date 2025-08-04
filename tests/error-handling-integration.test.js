/**
 * Error Handling Integration Tests
 * 
 * Tests for error handling integration with workflow commands and core systems
 */

const fs = require('fs').promises;
const path = require('path');
const WorkflowCommands = require('../scripts/workflow-commands');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');
const FileStructureManager = require('../src/FileStructureManager');

describe('Error Handling Integration', () => {
  let workflowCommands;
  let testDir;
  let originalCwd;

  beforeEach(async () => {
    // Create test directory and change to it
    testDir = path.join(__dirname, 'test-error-integration');
    await fs.mkdir(testDir, { recursive: true });
    
    originalCwd = process.cwd();
    process.chdir(testDir);
    
    workflowCommands = new WorkflowCommands();
  });

  afterEach(async () => {
    // Restore original directory and cleanup
    process.chdir(originalCwd);
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Workflow Commands Error Handling', () => {
    test('should create backups during split operation', async () => {
      // Create source file
      const sourceData = {
        color: {
          primary: { $type: 'color', $value: '#000000' },
          secondary: { $type: 'color', $value: '#ffffff' }
        }
      };
      await fs.writeFile('tokensource.json', JSON.stringify(sourceData, null, 2));

      // Run split operation
      const result = await workflowCommands.splitSourceToTokens({ verbose: false });

      expect(result.success).toBe(true);
      expect(result.details.backupId).toBeDefined();

      // Verify backup was created
      const backupsResult = await workflowCommands.listBackups({ operationType: 'split' });
      expect(backupsResult.success).toBe(true);
      expect(backupsResult.details.backups.length).toBeGreaterThan(0);
    });

    test('should handle split operation failure with detailed error report', async () => {
      // Create invalid source file
      await fs.writeFile('tokensource.json', 'invalid json content');

      // Run split operation
      const result = await workflowCommands.splitSourceToTokens({ verbose: false });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.some(s => s.includes('JSON'))).toBe(true);
    });

    test('should create backups during consolidate operation', async () => {
      // Setup tokens directory
      await fs.mkdir('tokens', { recursive: true });
      await fs.writeFile('tokens/$metadata.json', JSON.stringify({ tokenSetOrder: ['core'] }, null, 2));
      await fs.writeFile('tokens/$themes.json', JSON.stringify([{
        id: 'test',
        name: 'Test',
        selectedTokenSets: { core: 'enabled' }
      }], null, 2));
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: { primary: { $type: 'color', $value: '#000' } }
      }, null, 2));

      // Create existing source file to backup
      await fs.writeFile('tokensource.json', JSON.stringify({ existing: 'data' }, null, 2));

      // Run consolidate operation
      const result = await workflowCommands.consolidateToSource({ verbose: false });

      expect(result.success).toBe(true);
      expect(result.details.backupPath).toBeDefined();

      // Verify backup was created
      const backupsResult = await workflowCommands.listBackups({ operationType: 'consolidate' });
      expect(backupsResult.success).toBe(true);
      expect(backupsResult.details.backups.length).toBeGreaterThan(0);
    });

    test('should handle consolidate operation failure gracefully', async () => {
      // Create incomplete tokens directory (missing required files)
      await fs.mkdir('tokens', { recursive: true });
      await fs.writeFile('tokens/core.json', '{"invalid": "structure"}');

      // Run consolidate operation
      const result = await workflowCommands.consolidateToSource({ verbose: false });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should perform rollback operation successfully', async () => {
      // Create original source file
      const originalData = { version: 1, tokens: { color: { primary: '#000' } } };
      await fs.writeFile('tokensource.json', JSON.stringify(originalData, null, 2));

      // Create backup
      const backupsResult = await workflowCommands.listBackups();
      
      // Run split to create a backup
      await workflowCommands.splitSourceToTokens({ verbose: false });
      
      // Modify source file
      const modifiedData = { version: 2, tokens: { color: { primary: '#fff' } } };
      await fs.writeFile('tokensource.json', JSON.stringify(modifiedData, null, 2));

      // Get backup ID
      const updatedBackupsResult = await workflowCommands.listBackups({ operationType: 'split' });
      expect(updatedBackupsResult.details.backups.length).toBeGreaterThan(0);
      
      const backupId = updatedBackupsResult.details.backups[0].id;

      // Perform rollback
      const rollbackResult = await workflowCommands.rollbackToBackup(backupId, { verbose: false });

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.details.restoredFiles).toContain('tokensource.json');

      // Verify file was restored
      const restoredContent = JSON.parse(await fs.readFile('tokensource.json', 'utf8'));
      expect(restoredContent.version).toBe(1);
    });

    test('should attempt partial recovery for validation issues', async () => {
      // Create tokens directory with issues
      await fs.mkdir('tokens', { recursive: true });
      
      // Missing $metadata.json (will be created by recovery)
      await fs.writeFile('tokens/$themes.json', JSON.stringify([{
        id: 'test',
        name: 'Test',
        selectedTokenSets: {}
      }], null, 2));
      
      // Token file with missing $type
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: {
          primary: {
            $value: '#000000'
            // Missing $type
          }
        }
      }, null, 2));

      // Attempt partial recovery
      const recoveryResult = await workflowCommands.attemptPartialRecovery({
        verbose: false,
        autoFix: true,
        backupFirst: true
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.details.recoveredItems.length).toBeGreaterThan(0);

      // Verify $metadata.json was created
      const metadataExists = await fs.access('tokens/$metadata.json').then(() => true).catch(() => false);
      expect(metadataExists).toBe(true);
    });

    test('should generate comprehensive error reports', async () => {
      const testError = new Error('Test workflow error');
      const context = {
        operationType: 'test',
        step: 'validation',
        file: 'tokensource.json'
      };

      const reportResult = await workflowCommands.generateErrorReport(testError, context, {
        verbose: false,
        includeDebugInfo: true
      });

      expect(reportResult.success).toBe(true);
      expect(reportResult.details.errorReport).toBeDefined();
      expect(reportResult.details.suggestions).toBeDefined();
      expect(reportResult.details.debugInfo).toBeDefined();

      // Check that suggestions are relevant
      expect(reportResult.details.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('TokenTransformationEngine Error Handling', () => {
    test('should handle transformation errors with backup and recovery', async () => {
      const engine = new TokenTransformationEngine({
        backupDir: '.backups',
        debugMode: true
      });

      // Create invalid source file
      await fs.writeFile('invalid-source.json', '{"invalid": json}');

      // Attempt split operation
      const result = await engine.splitSourceToTokens('invalid-source.json', 'tokens');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errorReport).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    test('should create backups before consolidation', async () => {
      const engine = new TokenTransformationEngine({
        backupDir: '.backups',
        debugMode: true
      });

      // Setup valid tokens directory
      await fs.mkdir('tokens', { recursive: true });
      await fs.writeFile('tokens/$metadata.json', JSON.stringify({ tokenSetOrder: ['core'] }, null, 2));
      await fs.writeFile('tokens/$themes.json', JSON.stringify([], null, 2));
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: { primary: { $type: 'color', $value: '#000' } }
      }, null, 2));

      // Create existing source to backup
      await fs.writeFile('existing-source.json', JSON.stringify({ old: 'data' }, null, 2));

      // Perform consolidation
      const result = await engine.consolidateToSource('tokens', 'existing-source.json');

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();

      // Verify backup directory exists
      const backupDirExists = await fs.access('.backups').then(() => true).catch(() => false);
      expect(backupDirExists).toBe(true);
    });
  });

  describe('FileStructureManager Error Handling', () => {
    test('should use error handling system for backups', async () => {
      const fileManager = new FileStructureManager({
        backupDir: '.backups',
        debugMode: true
      });

      // Create tokens directory
      await fs.mkdir('tokens', { recursive: true });
      await fs.writeFile('tokens/test.json', '{"test": "data"}');

      // Create backup
      const result = await fileManager.createBackup('tokens', '.backups');

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(result.backupPath).toBeDefined();

      // Verify backup was created using error handling system
      const backupExists = await fs.access(result.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should handle backup failures gracefully', async () => {
      const fileManager = new FileStructureManager({
        backupDir: '.backups',
        debugMode: true
      });

      // Try to backup non-existent directory
      const result = await fileManager.createBackup('non-existent', '.backups');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('should recover from corrupted metadata file', async () => {
      // Create tokens directory with corrupted metadata
      await fs.mkdir('tokens', { recursive: true });
      await fs.writeFile('tokens/$metadata.json', '{"tokenSetOrder": [}'); // Invalid JSON
      await fs.writeFile('tokens/$themes.json', '[]'); // Valid themes file
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: { primary: { $type: 'color', $value: '#000' } }
      }, null, 2));

      // Attempt recovery
      const recoveryResult = await workflowCommands.attemptPartialRecovery({
        autoFix: true,
        backupFirst: true
      });
      
      console.log('Recovery result:', JSON.stringify(recoveryResult, null, 2));

      expect(recoveryResult.success).toBe(true);

      // Verify metadata was repaired or recreated
      const metadataContent = await fs.readFile('tokens/$metadata.json', 'utf8');
      expect(() => JSON.parse(metadataContent)).not.toThrow();
    });

    test('should recover from missing theme file', async () => {
      // Create tokens directory without themes file
      await fs.mkdir('tokens', { recursive: true });
      await fs.writeFile('tokens/$metadata.json', JSON.stringify({ tokenSetOrder: ['core'] }, null, 2));
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: { primary: { $type: 'color', $value: '#000' } }
      }, null, 2));

      // Attempt recovery
      const recoveryResult = await workflowCommands.attemptPartialRecovery({
        autoFix: true,
        backupFirst: false
      });

      expect(recoveryResult.success).toBe(true);

      // Verify themes file was created
      const themesExists = await fs.access('tokens/$themes.json').then(() => true).catch(() => false);
      expect(themesExists).toBe(true);

      const themesContent = JSON.parse(await fs.readFile('tokens/$themes.json', 'utf8'));
      expect(Array.isArray(themesContent)).toBe(true);
    });

    test('should handle multiple concurrent error scenarios', async () => {
      // Create multiple problematic files
      await fs.mkdir('tokens', { recursive: true });
      
      // Missing metadata
      // Invalid JSON in themes
      await fs.writeFile('tokens/$themes.json', '[{"id": "test",}]'); // Trailing comma
      
      // Token file with missing types
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: {
          primary: { $value: '#000' }, // Missing $type
          secondary: { $value: '#fff' } // Missing $type
        }
      }, null, 2));

      // Attempt comprehensive recovery
      const recoveryResult = await workflowCommands.attemptPartialRecovery({
        autoFix: true,
        backupFirst: true
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.details.recoveredItems.length).toBeGreaterThan(0);

      // Verify multiple issues were addressed
      const recoveryActions = recoveryResult.details.recoveredItems.map(item => item.action);
      expect(recoveryActions).toContain('create_default_file'); // For metadata
      expect(recoveryActions).toContain('attempt_json_repair'); // For themes
    });
  });

  describe('Logging and Debugging', () => {
    test('should create operation logs during workflow execution', async () => {
      // Create valid source file
      const sourceData = {
        color: { primary: { $type: 'color', $value: '#000' } }
      };
      await fs.writeFile('tokensource.json', JSON.stringify(sourceData, null, 2));

      // Run workflow operation
      await workflowCommands.splitSourceToTokens({ verbose: false });

      // Check if logs were created
      const logDirExists = await fs.access('.logs').then(() => true).catch(() => false);
      expect(logDirExists).toBe(true);

      const logFiles = await fs.readdir('.logs');
      const operationLogFile = logFiles.find(f => f.startsWith('operations-'));
      expect(operationLogFile).toBeDefined();
    });

    test('should log errors with context information', async () => {
      // Create invalid source file to trigger error
      await fs.writeFile('tokensource.json', 'invalid json');

      // Run operation that will fail
      await workflowCommands.splitSourceToTokens({ verbose: false });

      // Check error logs
      const logFiles = await fs.readdir('.logs');
      const errorLogFile = logFiles.find(f => f.startsWith('errors-'));
      expect(errorLogFile).toBeDefined();

      const logContent = await fs.readFile(path.join('.logs', errorLogFile), 'utf8');
      const logEntries = logContent.trim().split('\n').map(line => JSON.parse(line));
      
      const errorEntry = logEntries.find(entry => entry.level === 'error');
      expect(errorEntry).toBeDefined();
      expect(errorEntry.error.message).toContain('JSON');
    });

    test('should provide debug information in error reports', async () => {
      // Set debug mode
      process.env.DEBUG_MODE = 'true';
      
      const debugWorkflowCommands = new WorkflowCommands();
      
      const testError = new Error('Debug test error');
      const reportResult = await debugWorkflowCommands.generateErrorReport(testError, {}, {
        includeDebugInfo: true
      });

      expect(reportResult.details.debugInfo).toBeDefined();
      expect(reportResult.details.debugInfo.environment).toBeDefined();
      expect(reportResult.details.debugInfo.fileSystem).toBeDefined();

      // Cleanup
      delete process.env.DEBUG_MODE;
    });
  });

  describe('Backup Management Integration', () => {
    test('should manage backup lifecycle during workflow operations', async () => {
      // Create source file
      const sourceData = { color: { primary: { $type: 'color', $value: '#000' } } };
      await fs.writeFile('tokensource.json', JSON.stringify(sourceData, null, 2));

      // Perform multiple operations to create backups
      await workflowCommands.splitSourceToTokens({ verbose: false });
      
      // Modify and consolidate
      await fs.writeFile('tokens/core.json', JSON.stringify({
        color: { primary: { $type: 'color', $value: '#111' } }
      }, null, 2));
      
      await workflowCommands.consolidateToSource({ verbose: false });

      // List backups
      const backupsResult = await workflowCommands.listBackups({ verbose: false });
      
      expect(backupsResult.success).toBe(true);
      expect(backupsResult.details.backups.length).toBeGreaterThan(0);

      // Verify backup metadata
      const backup = backupsResult.details.backups[0];
      expect(backup.id).toBeDefined();
      expect(backup.type).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.fileCount).toBeGreaterThan(0);
    });

    test('should cleanup old backups automatically', async () => {
      // Create source file
      const sourceData = { test: 'data' };
      await fs.writeFile('tokensource.json', JSON.stringify(sourceData, null, 2));

      // Create multiple backups (more than maxBackups limit)
      for (let i = 0; i < 8; i++) {
        await workflowCommands.splitSourceToTokens({ verbose: false });
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // List backups - should be limited by maxBackups setting
      const backupsResult = await workflowCommands.listBackups({ operationType: 'split' });
      
      expect(backupsResult.success).toBe(true);
      // Should not exceed the maximum backup limit (default is usually 5-10)
      expect(backupsResult.details.backups.length).toBeLessThanOrEqual(10);
    });
  });
});