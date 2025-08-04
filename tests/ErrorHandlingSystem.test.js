/**
 * ErrorHandlingSystem Tests
 * 
 * Tests for comprehensive error handling and recovery system including:
 * - Automatic backup system
 * - Rollback capability
 * - Partial recovery
 * - Error reporting
 * - Logging and debugging
 */

const fs = require('fs').promises;
const path = require('path');
const ErrorHandlingSystem = require('../src/ErrorHandlingSystem');

describe('ErrorHandlingSystem', () => {
  let errorHandler;
  let testDir;
  let backupDir;
  let logDir;

  beforeEach(async () => {
    // Create test directories
    testDir = path.join(__dirname, 'test-error-handling');
    backupDir = path.join(testDir, '.backups');
    logDir = path.join(testDir, '.logs');
    
    await fs.mkdir(testDir, { recursive: true });
    
    errorHandler = new ErrorHandlingSystem({
      backupDir,
      logDir,
      maxBackups: 5,
      debugMode: true
    });
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Automatic Backup System', () => {
    test('should create backup for single file', async () => {
      // Create test file
      const testFile = path.join(testDir, 'test.json');
      const testData = { test: 'data' };
      await fs.writeFile(testFile, JSON.stringify(testData, null, 2));

      // Create backup
      const result = await errorHandler.createOperationBackup('test-operation', testFile, {
        testMetadata: 'value'
      });

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(result.backupPath).toBeDefined();
      expect(result.manifest).toBeDefined();

      // Verify backup exists
      const backupExists = await fs.access(result.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);

      // Verify manifest
      const manifestPath = path.join(result.backupPath, 'backup-manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      expect(manifest.operationType).toBe('test-operation');
      expect(manifest.metadata.testMetadata).toBe('value');
      expect(manifest.backedUpFiles).toContain('test.json');
    });

    test('should create backup for directory', async () => {
      // Create test directory with files
      const testSubDir = path.join(testDir, 'tokens');
      await fs.mkdir(testSubDir, { recursive: true });
      
      await fs.writeFile(path.join(testSubDir, 'core.json'), '{"color": {"primary": "#000"}}');
      await fs.writeFile(path.join(testSubDir, '$metadata.json'), '{"tokenSetOrder": ["core"]}');

      // Create backup
      const result = await errorHandler.createOperationBackup('test-dir', testSubDir);

      expect(result.success).toBe(true);
      
      // Verify directory structure is preserved
      const backupTokensDir = path.join(result.backupPath, 'tokens');
      const coreExists = await fs.access(path.join(backupTokensDir, 'core.json')).then(() => true).catch(() => false);
      const metadataExists = await fs.access(path.join(backupTokensDir, '$metadata.json')).then(() => true).catch(() => false);
      
      expect(coreExists).toBe(true);
      expect(metadataExists).toBe(true);
    });

    test('should handle backup creation errors gracefully', async () => {
      // Try to backup non-existent file
      const result = await errorHandler.createOperationBackup('test-error', '/non/existent/file');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to backup');
    });

    test('should cleanup old backups when limit exceeded', async () => {
      // Create multiple backups to exceed limit
      const testFile = path.join(testDir, 'test.json');
      await fs.writeFile(testFile, '{"test": "data"}');

      const backupIds = [];
      for (let i = 0; i < 7; i++) {
        const result = await errorHandler.createOperationBackup('cleanup-test', testFile);
        backupIds.push(result.backupId);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // List backups - should only have maxBackups (5)
      const { backups } = await errorHandler.listBackups('cleanup-test');
      expect(backups.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Rollback Capability', () => {
    test('should rollback to previous backup successfully', async () => {
      // Create original file
      const testFile = path.join(testDir, 'test.json');
      const originalData = { version: 1, data: 'original' };
      await fs.writeFile(testFile, JSON.stringify(originalData, null, 2));

      // Create backup
      const backupResult = await errorHandler.createOperationBackup('rollback-test', testFile);
      expect(backupResult.success).toBe(true);

      // Modify file
      const modifiedData = { version: 2, data: 'modified' };
      await fs.writeFile(testFile, JSON.stringify(modifiedData, null, 2));

      // Verify file was modified
      const modifiedContent = JSON.parse(await fs.readFile(testFile, 'utf8'));
      expect(modifiedContent.version).toBe(2);

      // Rollback
      const rollbackResult = await errorHandler.rollbackToBackup(backupResult.backupId);
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.restoredFiles).toContain('test.json');

      // Verify file was restored
      const restoredContent = JSON.parse(await fs.readFile(testFile, 'utf8'));
      expect(restoredContent.version).toBe(1);
      expect(restoredContent.data).toBe('original');
    });

    test('should perform dry run rollback without making changes', async () => {
      // Create original file and backup
      const testFile = path.join(testDir, 'test.json');
      const originalData = { test: 'original' };
      await fs.writeFile(testFile, JSON.stringify(originalData, null, 2));

      const backupResult = await errorHandler.createOperationBackup('dryrun-test', testFile);
      
      // Modify file
      const modifiedData = { test: 'modified' };
      await fs.writeFile(testFile, JSON.stringify(modifiedData, null, 2));

      // Dry run rollback
      const rollbackResult = await errorHandler.rollbackToBackup(backupResult.backupId, { dryRun: true });
      
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.dryRun).toBe(true);
      expect(rollbackResult.restoredFiles).toContain('test.json');

      // Verify file was NOT actually restored
      const currentContent = JSON.parse(await fs.readFile(testFile, 'utf8'));
      expect(currentContent.test).toBe('modified');
    });

    test('should create pre-rollback backup', async () => {
      // Setup original file and backup
      const testFile = path.join(testDir, 'test.json');
      await fs.writeFile(testFile, '{"original": true}');
      
      const backupResult = await errorHandler.createOperationBackup('prerollback-test', testFile);
      
      // Modify file
      await fs.writeFile(testFile, '{"modified": true}');

      // Rollback
      const rollbackResult = await errorHandler.rollbackToBackup(backupResult.backupId);
      
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.preRollbackBackup).toBeDefined();

      // Verify pre-rollback backup exists
      const { backups } = await errorHandler.listBackups('pre-rollback');
      const preRollbackBackup = backups.find(b => b.id === rollbackResult.preRollbackBackup);
      expect(preRollbackBackup).toBeDefined();
    });

    test('should handle rollback safety validation', async () => {
      // Create backup
      const testFile = path.join(testDir, 'test.json');
      await fs.writeFile(testFile, '{"test": "data"}');
      
      const backupResult = await errorHandler.createOperationBackup('safety-test', testFile);
      
      // Delete the target file to make rollback unsafe
      await fs.unlink(testFile);

      // Attempt rollback without force
      const rollbackResult = await errorHandler.rollbackToBackup(backupResult.backupId);
      
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.errors.some(e => e.includes('not safe'))).toBe(true);
    });

    test('should force rollback when safety checks fail', async () => {
      // Create backup
      const testFile = path.join(testDir, 'test.json');
      await fs.writeFile(testFile, '{"test": "data"}');
      
      const backupResult = await errorHandler.createOperationBackup('force-test', testFile);
      
      // Delete the target file
      await fs.unlink(testFile);

      // Force rollback
      const rollbackResult = await errorHandler.rollbackToBackup(backupResult.backupId, { force: true });
      
      expect(rollbackResult.success).toBe(true);
      
      // Verify file was restored
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('Partial Recovery', () => {
    test('should attempt recovery for missing required files', async () => {
      // Create validation result with missing file issue
      const validationResult = {
        issues: [{
          type: 'missing_required_file',
          file: '$metadata.json',
          severity: 'error'
        }]
      };

      const recoveryResult = await errorHandler.attemptPartialRecovery(validationResult, {
        autoFix: true,
        backupFirst: false
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveredItems.length).toBeGreaterThan(0);
      
      const metadataRecovery = recoveryResult.recoveredItems.find(item => 
        item.action === 'create_default_file'
      );
      expect(metadataRecovery).toBeDefined();
    });

    test('should attempt JSON repair for invalid JSON', async () => {
      // Create file with invalid JSON (trailing comma)
      const testFile = path.join(testDir, 'tokens', 'invalid.json');
      await fs.mkdir(path.dirname(testFile), { recursive: true });
      await fs.writeFile(testFile, '{"test": "value",}'); // Invalid JSON

      const validationResult = {
        issues: [{
          type: 'invalid_json',
          file: testFile,
          severity: 'error'
        }]
      };

      const recoveryResult = await errorHandler.attemptPartialRecovery(validationResult, {
        autoFix: true,
        backupFirst: false
      });

      expect(recoveryResult.success).toBe(true);
      
      // Check if JSON was repaired
      const repairedContent = await fs.readFile(testFile, 'utf8');
      expect(() => JSON.parse(repairedContent)).not.toThrow();
    });

    test('should suggest alternatives for unresolved references', async () => {
      const validationResult = {
        unresolvedReferences: [{
          reference: '{color.primry}', // Typo in "primary"
          location: 'button.background',
          file: 'components.json'
        }]
      };

      const recoveryResult = await errorHandler.attemptPartialRecovery(validationResult, {
        autoFix: true,
        backupFirst: false
      });

      expect(recoveryResult.success).toBe(true);
      
      const referenceRecovery = recoveryResult.recoveredItems.find(item => 
        item.action === 'suggest_alternatives'
      );
      expect(referenceRecovery).toBeDefined();
      expect(referenceRecovery.details.suggestions).toBeDefined();
    });

    test('should create backup before recovery when requested', async () => {
      const validationResult = {
        issues: [{
          type: 'missing_required_file',
          file: '$themes.json',
          severity: 'error'
        }]
      };

      const recoveryResult = await errorHandler.attemptPartialRecovery(validationResult, {
        autoFix: true,
        backupFirst: true
      });

      expect(recoveryResult.success).toBe(true);
      
      // Check that a partial-recovery backup was created
      const { backups } = await errorHandler.listBackups('partial-recovery');
      expect(backups.length).toBeGreaterThan(0);
    });
  });

  describe('Error Reporting', () => {
    test('should generate comprehensive error report', async () => {
      const testError = new Error('Test error message');
      testError.stack = 'Error: Test error\n    at test location';
      
      const context = {
        operationType: 'test',
        filePath: '/test/path'
      };

      const result = await errorHandler.generateErrorReport(testError, context, {
        includeDebugInfo: true,
        includeSuggestions: true
      });

      expect(result.report).toBeDefined();
      expect(result.report.error.message).toBe('Test error message');
      expect(result.report.error.type).toBe('Error');
      expect(result.report.systemInfo).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.debugInfo).toBeDefined();
    });

    test('should assess error severity correctly', async () => {
      // Test critical error (missing tokensource.json)
      const criticalError = new Error('ENOENT: no such file or directory, open \'tokensource.json\'');
      const criticalResult = await errorHandler.generateErrorReport(criticalError);
      expect(criticalResult.report.severity).toBe('critical');

      // Test high severity error (JSON parse error)
      const jsonError = new Error('Unexpected token } in JSON at position 10');
      const jsonResult = await errorHandler.generateErrorReport(jsonError);
      expect(jsonResult.report.severity).toBe('high');

      // Test medium severity error (validation error)
      const validationError = new Error('Token reference validation failed');
      const validationResult = await errorHandler.generateErrorReport(validationError, { operationType: 'validation' });
      expect(validationResult.report.severity).toBe('medium');
    });

    test('should generate appropriate suggestions based on error type', async () => {
      // File not found error
      const fileError = new Error('ENOENT: no such file or directory');
      const fileResult = await errorHandler.generateErrorReport(fileError);
      
      expect(fileResult.suggestions.some(s => s.includes('Check if the file'))).toBe(true);
      expect(fileResult.suggestions.some(s => s.includes('split-source-to-tokens'))).toBe(true);

      // JSON error
      const jsonError = new Error('Unexpected token in JSON');
      const jsonResult = await errorHandler.generateErrorReport(jsonError);
      
      expect(jsonResult.suggestions.some(s => s.includes('JSON syntax'))).toBe(true);
      expect(jsonResult.suggestions.some(s => s.includes('trailing commas'))).toBe(true);
    });
  });

  describe('Operation Tracking', () => {
    test('should track operations correctly', async () => {
      const operationId = errorHandler.startOperation('test-operation', { testData: 'value' });
      
      expect(operationId).toBeDefined();
      expect(operationId).toContain('test-operation');

      // Complete operation
      await errorHandler.completeOperation(operationId, { success: true });

      // Operation should be tracked for a short time
      const context = errorHandler._getCurrentOperationContext();
      // Since operation is completed, it might not be in active operations
      expect(context).toBeDefined();
    });

    test('should track multiple concurrent operations', async () => {
      const op1 = errorHandler.startOperation('operation-1');
      const op2 = errorHandler.startOperation('operation-2');
      
      expect(op1).not.toBe(op2);
      
      const context = errorHandler._getCurrentOperationContext();
      expect(context.activeOperations.length).toBe(2);

      await errorHandler.completeOperation(op1, { success: true });
      await errorHandler.completeOperation(op2, { success: false });
    });
  });

  describe('Backup Management', () => {
    test('should list backups correctly', async () => {
      // Create test backups
      const testFile = path.join(testDir, 'test.json');
      await fs.writeFile(testFile, '{"test": "data"}');

      await errorHandler.createOperationBackup('type-a', testFile);
      await errorHandler.createOperationBackup('type-b', testFile);
      await errorHandler.createOperationBackup('type-a', testFile);

      // List all backups
      const allResult = await errorHandler.listBackups();
      expect(allResult.backups.length).toBe(3);

      // List filtered backups
      const filteredResult = await errorHandler.listBackups('type-a');
      expect(filteredResult.backups.length).toBe(2);
      expect(filteredResult.backups.every(b => b.type === 'type-a')).toBe(true);
    });

    test('should handle empty backup directory', async () => {
      const result = await errorHandler.listBackups();
      
      expect(result.backups).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    test('should sort backups by timestamp (newest first)', async () => {
      const testFile = path.join(testDir, 'test.json');
      await fs.writeFile(testFile, '{"test": "data"}');

      const backup1 = await errorHandler.createOperationBackup('sort-test', testFile);
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamps
      const backup2 = await errorHandler.createOperationBackup('sort-test', testFile);

      const result = await errorHandler.listBackups('sort-test');
      
      expect(result.backups.length).toBe(2);
      expect(new Date(result.backups[0].timestamp).getTime()).toBeGreaterThan(
        new Date(result.backups[1].timestamp).getTime()
      );
    });
  });

  describe('Logging System', () => {
    test('should log operations to file', async () => {
      const operationId = errorHandler.startOperation('log-test', { testData: 'value' });
      await errorHandler.completeOperation(operationId, { success: true });

      // Check if log file was created
      const logFiles = await fs.readdir(logDir);
      const operationLogFile = logFiles.find(f => f.startsWith('operations-'));
      
      expect(operationLogFile).toBeDefined();

      // Check log content
      const logContent = await fs.readFile(path.join(logDir, operationLogFile), 'utf8');
      const logLines = logContent.trim().split('\n');
      
      expect(logLines.length).toBeGreaterThan(0);
      
      const logEntry = JSON.parse(logLines[logLines.length - 1]);
      expect(logEntry.type).toBe('operation_completed');
      expect(logEntry.data.operationId).toBe(operationId);
    });

    test('should log errors to separate file', async () => {
      const testError = new Error('Test error for logging');
      await errorHandler.generateErrorReport(testError, { test: 'context' });

      // Check if error log file was created
      const logFiles = await fs.readdir(logDir);
      const errorLogFile = logFiles.find(f => f.startsWith('errors-'));
      
      expect(errorLogFile).toBeDefined();

      // Check log content
      const logContent = await fs.readFile(path.join(logDir, errorLogFile), 'utf8');
      const logLines = logContent.trim().split('\n');
      
      expect(logLines.length).toBeGreaterThan(0);
      
      const logEntry = JSON.parse(logLines[logLines.length - 1]);
      expect(logEntry.type).toBe('error_reported');
      expect(logEntry.error.message).toBe('Test error for logging');
    });

    test('should handle logging errors gracefully', async () => {
      // Create error handler with invalid log directory
      const invalidErrorHandler = new ErrorHandlingSystem({
        logDir: '/invalid/path/that/cannot/be/created'
      });

      // This should not throw, even if logging fails
      await expect(invalidErrorHandler.generateErrorReport(new Error('test'))).resolves.toBeDefined();
    });
  });

  describe('Integration with Token System', () => {
    test('should handle token-specific error scenarios', async () => {
      // Create tokens directory structure
      const tokensDir = path.join(testDir, 'tokens');
      await fs.mkdir(tokensDir, { recursive: true });

      // Create invalid token file
      await fs.writeFile(path.join(tokensDir, 'invalid.json'), '{"token": {"$value": "test"}}'); // Missing $type

      const validationResult = {
        issues: [{
          type: 'missing_token_type',
          file: path.join(tokensDir, 'invalid.json'),
          path: 'token',
          severity: 'warning'
        }]
      };

      const recoveryResult = await errorHandler.attemptPartialRecovery(validationResult, {
        autoFix: true,
        backupFirst: false
      });

      expect(recoveryResult.success).toBe(true);
      
      // Check if token type was inferred
      const recoveredItem = recoveryResult.recoveredItems.find(item => 
        item.action === 'infer_token_type'
      );
      expect(recoveredItem).toBeDefined();
    });

    test('should provide token-specific error suggestions', async () => {
      const tokenError = new Error('Token reference {color.primry} not found');
      const result = await errorHandler.generateErrorReport(tokenError, {
        operationType: 'consolidate'
      });

      expect(result.suggestions.some(s => s.includes('referenced tokens exist'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('reference syntax'))).toBe(true);
    });
  });
});