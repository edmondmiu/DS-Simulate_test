/**
 * Migration Integration Tests
 * 
 * Tests the complete migration system including:
 * - Pre-migration validation
 * - Migration process
 * - Rollback capability
 * - Post-migration validation
 * 
 * Requirements tested: 9.1, 9.2, 9.3, 9.4, 9.5
 */

const fs = require('fs').promises;
const path = require('path');
const MigrationSystem = require('../src/MigrationSystem');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');

describe('Migration Integration Tests', () => {
  let migration;
  let testDir;
  let originalCwd;

  beforeAll(async () => {
    migration = new MigrationSystem();
    originalCwd = process.cwd();
    
    // Create test directory
    testDir = path.join(__dirname, 'temp-migration-test');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Create test files
    await setupTestEnvironment();
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Reset test environment for each test
    await cleanupTestFiles();
    await setupTestEnvironment();
  });

  describe('Pre-migration Validation', () => {
    test('should validate system readiness for migration', async () => {
      const result = await migration.validatePreMigration();
      
      expect(result.success).toBe(true);
      expect(result.details.sourceValid).toBe(true);
      expect(result.details.functionalityValid).toBe(true);
      expect(result.details.scriptsPresent).toBe(true);
      expect(result.details.backupCapable).toBe(true);
    });

    test('should detect missing tokensource.json', async () => {
      await fs.unlink('tokensource.json');
      
      const result = await migration.validatePreMigration();
      
      expect(result.success).toBe(false);
      expect(result.details.sourceValid).toBe(false);
    });

    test('should detect invalid tokensource.json', async () => {
      await fs.writeFile('tokensource.json', 'invalid json content');
      
      const result = await migration.validatePreMigration();
      
      expect(result.success).toBe(false);
      expect(result.details.sourceValid).toBe(false);
      expect(result.details.sourceValidationError).toBeDefined();
    });

    test('should detect missing required scripts', async () => {
      const packageJson = {
        name: 'test',
        scripts: {
          // Missing required scripts
        }
      };
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
      
      const result = await migration.validatePreMigration();
      
      expect(result.success).toBe(false);
      expect(result.details.scriptsPresent).toBe(false);
    });
  });

  describe('Migration Backup System', () => {
    test('should create comprehensive migration backup', async () => {
      const result = await migration.createMigrationBackup();
      
      expect(result.success).toBe(true);
      expect(result.details.backupPath).toBeDefined();
      expect(result.details.files).toContain('tokensource.json');
      expect(result.details.files).toContain('package.json');
      
      // Verify backup files exist
      const backupPath = result.details.backupPath;
      const backupManifest = JSON.parse(
        await fs.readFile(path.join(backupPath, 'backup-manifest.json'), 'utf8')
      );
      
      expect(backupManifest.timestamp).toBeDefined();
      expect(backupManifest.files).toEqual(expect.arrayContaining(['tokensource.json', 'package.json']));
      
      // Verify actual backup files
      const backupTokensource = await fs.readFile(path.join(backupPath, 'tokensource.json'), 'utf8');
      const originalTokensource = await fs.readFile('tokensource.json', 'utf8');
      expect(backupTokensource).toBe(originalTokensource);
    });

    test('should backup directories when they exist', async () => {
      // Create test directories
      await fs.mkdir('scripts', { recursive: true });
      await fs.writeFile('scripts/test.js', 'console.log("test");');
      
      const result = await migration.createMigrationBackup();
      
      expect(result.success).toBe(true);
      expect(result.details.directories).toContain('scripts');
      
      // Verify directory backup
      const backupScriptFile = await fs.readFile(
        path.join(result.details.backupPath, 'scripts', 'test.js'),
        'utf8'
      );
      expect(backupScriptFile).toBe('console.log("test");');
    });
  });

  describe('Script Migration', () => {
    test('should remove obsolete scripts and add new ones', async () => {
      // Setup package.json with old scripts
      const packageJson = {
        name: 'test',
        scripts: {
          build: 'echo build',
          transform: 'echo old transform',
          'build:source': 'echo old build source',
          'sync:bidirectional': 'echo old sync'
        }
      };
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
      
      const result = await migration.migrateScripts();
      
      expect(result.success).toBe(true);
      expect(result.details.removedScripts).toContain('transform');
      expect(result.details.removedScripts).toContain('build:source');
      expect(result.details.removedScripts).toContain('sync:bidirectional');
      
      expect(result.details.addedScripts).toContain('split-source-to-tokens');
      expect(result.details.addedScripts).toContain('consolidate-to-source');
      expect(result.details.addedScripts).toContain('workflow:start');
      
      // Verify updated package.json
      const updatedPackageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      expect(updatedPackageJson.scripts.transform).toBeUndefined();
      expect(updatedPackageJson.scripts['split-source-to-tokens']).toBeDefined();
      expect(updatedPackageJson.scripts.build).toBe('echo build'); // Preserved
    });

    test('should preserve existing new workflow scripts', async () => {
      const packageJson = {
        name: 'test',
        scripts: {
          'split-source-to-tokens': 'custom command',
          'consolidate-to-source': 'another custom command'
        }
      };
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
      
      const result = await migration.migrateScripts();
      
      expect(result.success).toBe(true);
      expect(result.details.addedScripts).not.toContain('split-source-to-tokens');
      expect(result.details.addedScripts).not.toContain('consolidate-to-source');
      
      // Verify custom commands are preserved
      const updatedPackageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      expect(updatedPackageJson.scripts['split-source-to-tokens']).toBe('custom command');
      expect(updatedPackageJson.scripts['consolidate-to-source']).toBe('another custom command');
    });
  });

  describe('New Workflow Validation', () => {
    test('should validate new workflow functionality', async () => {
      // Setup proper package.json
      const packageJson = {
        name: 'test',
        scripts: {
          'split-source-to-tokens': 'node scripts/workflow-commands.js split-source-to-tokens',
          'consolidate-to-source': 'node scripts/workflow-commands.js consolidate-to-source',
          'validate-workflow-integrity': 'node scripts/workflow-commands.js validate-workflow-integrity'
        }
      };
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
      
      const result = await migration.validateNewWorkflow();
      
      expect(result.success).toBe(true);
      expect(result.details.commandsAvailable).toBe(true);
      expect(result.details.splitWorks).toBe(true);
      expect(result.details.consolidateWorks).toBe(true);
      expect(result.details.validationWorks).toBe(true);
    });

    test('should detect missing workflow commands', async () => {
      const packageJson = {
        name: 'test',
        scripts: {
          build: 'echo build'
          // Missing workflow commands
        }
      };
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
      
      const result = await migration.validateNewWorkflow();
      
      expect(result.success).toBe(false);
      expect(result.details.commandsAvailable).toBe(false);
    });
  });

  describe('Workflow Integrity Testing', () => {
    test('should test complete workflow roundtrip', async () => {
      const result = await migration.testWorkflowIntegrity();
      
      expect(result.success).toBe(true);
      expect(result.details.splitResult.success).toBe(true);
      expect(result.details.consolidateResult.success).toBe(true);
      expect(result.details.comparison.identical).toBe(true);
      expect(result.details.tokensProcessed).toBeGreaterThan(0);
    });

    test('should detect roundtrip differences', async () => {
      // Create a tokensource that might have roundtrip issues
      const problematicSource = {
        'test-token': {
          '$type': 'color',
          '$value': '#ffffff',
          '$description': 'Test token with special characters: "quotes" and \\backslashes\\'
        }
      };
      await fs.writeFile('tokensource.json', JSON.stringify(problematicSource, null, 2));
      
      const result = await migration.testWorkflowIntegrity();
      
      // Should still succeed but might have warnings
      expect(result.success).toBe(true);
      expect(result.details.comparison).toBeDefined();
    });
  });

  describe('Migration Rollback', () => {
    test('should rollback migration successfully', async () => {
      // Create backup first
      const backupResult = await migration.createMigrationBackup();
      expect(backupResult.success).toBe(true);
      
      // Modify files to simulate migration
      await fs.writeFile('tokensource.json', '{"modified": true}');
      const modifiedPackageJson = {
        name: 'test',
        scripts: {
          'new-script': 'echo new'
        }
      };
      await fs.writeFile('package.json', JSON.stringify(modifiedPackageJson, null, 2));
      
      // Rollback
      const rollbackResult = await migration.rollbackMigration(backupResult.details.backupPath);
      
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.details.restoredFiles).toContain('tokensource.json');
      expect(rollbackResult.details.restoredFiles).toContain('package.json');
      
      // Verify files are restored
      const restoredTokensource = JSON.parse(await fs.readFile('tokensource.json', 'utf8'));
      expect(restoredTokensource.modified).toBeUndefined();
      expect(restoredTokensource['Color Ramp']).toBeDefined(); // Original content
      
      const restoredPackageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      expect(restoredPackageJson.scripts['new-script']).toBeUndefined();
      expect(restoredPackageJson.scripts.build).toBeDefined(); // Original content
    });

    test('should handle rollback when backup is missing', async () => {
      const result = await migration.rollbackMigration('/nonexistent/backup/path');
      
      expect(result.success).toBe(false);
      expect(result.details.error).toBeDefined();
    });
  });

  describe('Migration State Management', () => {
    test('should track migration state', async () => {
      await migration.updateMigrationState('test_state', {
        testData: 'test value'
      });
      
      const state = await migration.getMigrationState();
      
      expect(state.state).toBe('test_state');
      expect(state.testData).toBe('test value');
      expect(state.timestamp).toBeDefined();
    });

    test('should return null for missing migration state', async () => {
      // Ensure no state file exists
      try {
        await fs.unlink('.kiro/migration-state.json');
      } catch (error) {
        // File might not exist
      }
      
      const state = await migration.getMigrationState();
      expect(state).toBeNull();
    });
  });

  describe('Complete Migration Process', () => {
    test('should perform complete migration successfully', async () => {
      const result = await migration.performMigration({ dryRun: false, verbose: false });
      
      expect(result.success).toBe(true);
      expect(result.details.preValidation.success).toBe(true);
      expect(result.details.backup.success).toBe(true);
      expect(result.details.scriptMigration.success).toBe(true);
      expect(result.details.workflowValidation.success).toBe(true);
      expect(result.details.integrityTest.success).toBe(true);
      
      // Verify migration state
      const state = await migration.getMigrationState();
      expect(state.state).toBe('completed');
      expect(state.success).toBe(true);
    });

    test('should perform dry run without making changes', async () => {
      const originalTokensource = await fs.readFile('tokensource.json', 'utf8');
      const originalPackageJson = await fs.readFile('package.json', 'utf8');
      
      const result = await migration.performMigration({ dryRun: true, verbose: false });
      
      expect(result.success).toBe(true);
      expect(result.details.nextSteps).toBeDefined();
      
      // Verify no changes were made
      const currentTokensource = await fs.readFile('tokensource.json', 'utf8');
      const currentPackageJson = await fs.readFile('package.json', 'utf8');
      
      expect(currentTokensource).toBe(originalTokensource);
      expect(currentPackageJson).toBe(originalPackageJson);
    });

    test('should rollback automatically on migration failure', async () => {
      // Create a scenario that will cause migration to fail
      await fs.writeFile('tokensource.json', 'invalid json');
      
      const result = await migration.performMigration({ dryRun: false, verbose: false });
      
      expect(result.success).toBe(false);
      
      // Verify rollback occurred
      const state = await migration.getMigrationState();
      expect(state?.state).toBe('rolled_back');
    });
  });

  // Helper functions
  async function setupTestEnvironment() {
    // Create test tokensource.json
    const testTokensource = {
      'Color Ramp': {
        'Primary': {
          'Primary 500': {
            '$type': 'color',
            '$value': '#0066cc',
            '$description': 'Primary brand color'
          }
        }
      },
      'Global': {
        'Text': {
          'Primary': {
            '$type': 'color',
            '$value': '{Color Ramp.Primary.Primary 500}',
            '$description': 'Primary text color'
          }
        }
      }
    };
    
    await fs.writeFile('tokensource.json', JSON.stringify(testTokensource, null, 2));
    
    // Create test package.json
    const testPackageJson = {
      name: 'test-migration',
      version: '1.0.0',
      scripts: {
        build: 'echo build',
        'validate:comprehensive': 'echo validate'
      }
    };
    
    await fs.writeFile('package.json', JSON.stringify(testPackageJson, null, 2));
    
    // Create .kiro directory
    await fs.mkdir('.kiro', { recursive: true });
    
    // Create .backups directory
    await fs.mkdir('.backups', { recursive: true });
  }

  async function cleanupTestFiles() {
    const filesToClean = [
      'tokensource.json',
      'package.json',
      'tokensource-test.json',
      'tokensource-integrity-test.json',
      'tokensource-integrity-test.json.roundtrip'
    ];
    
    const dirsToClean = [
      'tokens',
      'tokens-test',
      'tokens-integrity-test',
      '.kiro',
      '.backups'
    ];
    
    for (const file of filesToClean) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // File might not exist
      }
    }
    
    for (const dir of dirsToClean) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
    }
  }
});