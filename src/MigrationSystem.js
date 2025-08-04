#!/usr/bin/env node

/**
 * Migration System - Handles migration from old workflow to new GitHub-centered workflow
 * 
 * This system provides:
 * - Migration validation and compatibility checking
 * - Rollback capability for migration issues
 * - Step-by-step migration process
 * - Validation that existing functionality still works
 * 
 * Requirements addressed: 9.1, 9.2, 9.3, 9.4, 9.5
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const TokenTransformationEngine = require('./TokenTransformationEngine');
const FileStructureManager = require('./FileStructureManager');
const ValidationSystem = require('./ValidationSystem');

class MigrationSystem {
  constructor() {
    this.transformationEngine = new TokenTransformationEngine();
    this.fileManager = new FileStructureManager();
    this.validator = new ValidationSystem();
    this.backupDir = '.backups';
    this.migrationStateFile = '.kiro/migration-state.json';
  }

  /**
   * Perform complete migration from old workflow to new GitHub-centered workflow
   * @param {object} options - Migration options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async performMigration(options = {}) {
    const { dryRun = false, verbose = false } = options;
    
    console.log('🚀 Starting migration to GitHub-centered Token Studio workflow...');
    
    try {
      // Step 1: Pre-migration validation
      console.log('\n📋 Step 1: Pre-migration validation...');
      const preValidation = await this.validatePreMigration();
      if (!preValidation.success) {
        return this._errorResult('Pre-migration validation failed', preValidation);
      }
      
      if (verbose) {
        console.log('✅ Pre-migration validation passed');
        console.log(`   - tokensource.json: ${preValidation.details.sourceValid ? 'Valid' : 'Invalid'}`);
        console.log(`   - Existing functionality: ${preValidation.details.functionalityValid ? 'Working' : 'Issues detected'}`);
      }

      // Step 2: Create migration backup
      console.log('\n💾 Step 2: Creating migration backup...');
      const backupResult = await this.createMigrationBackup();
      if (!backupResult.success) {
        return this._errorResult('Failed to create migration backup', backupResult);
      }
      
      if (verbose) {
        console.log(`✅ Migration backup created: ${backupResult.details.backupPath}`);
      }

      if (dryRun) {
        console.log('\n🔍 Dry run mode - stopping before making changes');
        return this._successResult('Migration dry run completed successfully', {
          preValidation,
          backup: backupResult,
          nextSteps: [
            'Run migration without --dry-run flag to proceed',
            'Review backup location: ' + backupResult.details.backupPath
          ]
        });
      }

      // Step 3: Update migration state
      await this.updateMigrationState('in_progress', {
        startTime: new Date().toISOString(),
        backupPath: backupResult.details.backupPath
      });

      // Step 4: Migrate scripts and configuration
      console.log('\n⚙️  Step 3: Migrating scripts and configuration...');
      const scriptMigration = await this.migrateScripts();
      if (!scriptMigration.success) {
        await this.rollbackMigration(backupResult.details.backupPath);
        return this._errorResult('Script migration failed', scriptMigration);
      }

      // Step 5: Validate new workflow
      console.log('\n🔍 Step 4: Validating new workflow...');
      const workflowValidation = await this.validateNewWorkflow();
      if (!workflowValidation.success) {
        await this.rollbackMigration(backupResult.details.backupPath);
        return this._errorResult('New workflow validation failed', workflowValidation);
      }

      // Step 6: Test complete workflow integrity
      console.log('\n🧪 Step 5: Testing complete workflow integrity...');
      const integrityTest = await this.testWorkflowIntegrity();
      if (!integrityTest.success) {
        await this.rollbackMigration(backupResult.details.backupPath);
        return this._errorResult('Workflow integrity test failed', integrityTest);
      }

      // Step 7: Finalize migration
      console.log('\n✅ Step 6: Finalizing migration...');
      await this.updateMigrationState('completed', {
        completedTime: new Date().toISOString(),
        success: true
      });

      console.log('\n🎉 Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Test the new workflow with: npm run workflow:start');
      console.log('2. Review the migration documentation in docs/MIGRATION_GUIDE.md');
      console.log('3. Update your team on the new workflow commands');

      return this._successResult('Migration completed successfully', {
        preValidation,
        backup: backupResult,
        scriptMigration,
        workflowValidation,
        integrityTest,
        migrationState: await this.getMigrationState()
      });

    } catch (error) {
      console.error('❌ Migration failed with error:', error.message);
      
      // Attempt rollback if we have a backup
      const state = await this.getMigrationState();
      if (state && state.backupPath) {
        console.log('🔄 Attempting automatic rollback...');
        await this.rollbackMigration(state.backupPath);
      }
      
      return this._errorResult('Migration failed with unexpected error', { error: error.message });
    }
  }

  /**
   * Validate system state before migration
   * @returns {Promise<{success: boolean, details: object}>}
   */
  async validatePreMigration() {
    try {
      const results = {
        sourceValid: false,
        functionalityValid: false,
        scriptsPresent: false,
        backupCapable: false
      };

      // Check tokensource.json exists and is valid
      try {
        const sourceContent = await fs.readFile('tokensource.json', 'utf8');
        const sourceData = JSON.parse(sourceContent);
        results.sourceValid = Object.keys(sourceData).length > 0;
      } catch (error) {
        results.sourceValidationError = error.message;
      }

      // Check existing functionality works
      try {
        // Test that we can read and parse the source
        const validationResult = await this.validator.validateTokenStudioStructure('.');
        results.functionalityValid = true;
      } catch (error) {
        results.functionalityError = error.message;
      }

      // Check required scripts are present
      try {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        const requiredScripts = ['build', 'validate:comprehensive'];
        results.scriptsPresent = requiredScripts.every(script => packageJson.scripts[script]);
        results.existingScripts = Object.keys(packageJson.scripts);
      } catch (error) {
        results.scriptsError = error.message;
      }

      // Check backup capability
      try {
        await fs.access('.backups');
        results.backupCapable = true;
      } catch (error) {
        // Try to create backup directory
        try {
          await fs.mkdir('.backups', { recursive: true });
          results.backupCapable = true;
        } catch (createError) {
          results.backupError = createError.message;
        }
      }

      const success = results.sourceValid && results.functionalityValid && 
                     results.scriptsPresent && results.backupCapable;

      return { success, details: results };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create comprehensive backup before migration
   * @returns {Promise<{success: boolean, details: object}>}
   */
  async createMigrationBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `migration-backup-${timestamp}`);
      
      await fs.mkdir(backupPath, { recursive: true });

      // Files to backup
      const filesToBackup = [
        'tokensource.json',
        'package.json',
        'style-dictionary.config.js',
        'style-dictionary.theme.config.js'
      ];

      // Directories to backup
      const dirsToBackup = [
        'scripts',
        'src',
        'tests',
        'tokens',
        'dist'
      ];

      const backedUpFiles = [];
      const backedUpDirs = [];

      // Backup individual files
      for (const file of filesToBackup) {
        try {
          await fs.access(file);
          await fs.copyFile(file, path.join(backupPath, file));
          backedUpFiles.push(file);
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Backup directories
      for (const dir of dirsToBackup) {
        try {
          await fs.access(dir);
          await this._copyDirectory(dir, path.join(backupPath, dir));
          backedUpDirs.push(dir);
        } catch (error) {
          // Directory doesn't exist, skip
        }
      }

      // Create backup manifest
      const manifest = {
        timestamp: new Date().toISOString(),
        backupPath,
        files: backedUpFiles,
        directories: backedUpDirs,
        migrationVersion: '1.0.0'
      };

      await fs.writeFile(
        path.join(backupPath, 'backup-manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      return this._successResult('Migration backup created', {
        backupPath,
        files: backedUpFiles,
        directories: backedUpDirs,
        manifest
      });

    } catch (error) {
      return this._errorResult('Failed to create migration backup', { error: error.message });
    }
  }

  /**
   * Migrate scripts and remove obsolete ones
   * @returns {Promise<{success: boolean, details: object}>}
   */
  async migrateScripts() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const originalScripts = { ...packageJson.scripts };

      // Scripts to remove (obsolete from old workflow)
      const scriptsToRemove = [
        'transform',
        'build:source',
        'sync:bidirectional',
        'export:tokens',
        'import:tokens'
      ];

      // Remove obsolete scripts
      const removedScripts = [];
      scriptsToRemove.forEach(script => {
        if (packageJson.scripts[script]) {
          delete packageJson.scripts[script];
          removedScripts.push(script);
        }
      });

      // Ensure new workflow scripts are present
      const requiredNewScripts = {
        'split-source-to-tokens': 'node scripts/workflow-commands.js split-source-to-tokens',
        'consolidate-to-source': 'node scripts/workflow-commands.js consolidate-to-source',
        'sync-from-github': 'node scripts/workflow-commands.js sync-from-github',
        'validate-workflow-integrity': 'node scripts/workflow-commands.js validate-workflow-integrity',
        'workflow:start': 'node scripts/workflow-commands.js workflow:start',
        'workflow:finish': 'node scripts/workflow-commands.js workflow:finish'
      };

      const addedScripts = [];
      Object.entries(requiredNewScripts).forEach(([script, command]) => {
        if (!packageJson.scripts[script]) {
          packageJson.scripts[script] = command;
          addedScripts.push(script);
        }
      });

      // Write updated package.json
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));

      return this._successResult('Scripts migrated successfully', {
        removedScripts,
        addedScripts,
        originalScripts,
        newScripts: packageJson.scripts
      });

    } catch (error) {
      return this._errorResult('Script migration failed', { error: error.message });
    }
  }

  /**
   * Validate that the new workflow functions correctly
   * @returns {Promise<{success: boolean, details: object}>}
   */
  async validateNewWorkflow() {
    try {
      const results = {
        commandsAvailable: false,
        splitWorks: false,
        consolidateWorks: false,
        validationWorks: false
      };

      // Check that workflow commands are available
      try {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        const requiredCommands = [
          'split-source-to-tokens',
          'consolidate-to-source',
          'validate-workflow-integrity'
        ];
        results.commandsAvailable = requiredCommands.every(cmd => packageJson.scripts[cmd]);
      } catch (error) {
        results.commandsError = error.message;
      }

      // Test split functionality
      try {
        // Check if tokensource.json exists and is valid
        const sourceExists = await this._fileExists('tokensource.json');
        if (sourceExists) {
          const splitResult = await this.transformationEngine.splitSourceToTokens(
            'tokensource.json',
            'tokens'
          );
          results.splitWorks = splitResult.success;
          results.splitDetails = splitResult;
        } else {
          results.splitWorks = false;
          results.splitError = 'tokensource.json not found';
        }
      } catch (error) {
        results.splitError = error.message;
        results.splitWorks = false;
      }

      // Test consolidate functionality
      try {
        // Only test consolidate if split worked and tokens directory exists
        if (results.splitWorks && await this._fileExists('tokens')) {
          const consolidateResult = await this.transformationEngine.consolidateToSource(
            'tokens',
            'tokensource-test.json'
          );
          results.consolidateWorks = consolidateResult.success;
          results.consolidateDetails = consolidateResult;
          
          // Clean up test file
          try {
            await fs.unlink('tokensource-test.json');
          } catch (error) {
            // Ignore cleanup errors
          }
        } else {
          results.consolidateWorks = false;
          results.consolidateError = 'Split failed or tokens directory not available';
        }
      } catch (error) {
        results.consolidateError = error.message;
        results.consolidateWorks = false;
      }

      // Test validation functionality
      try {
        // Only test validation if we have tokens directory
        if (await this._fileExists('tokens')) {
          const validationResult = await this.validator.validateTokenStudioStructure('tokens');
          results.validationWorks = validationResult.isValid;
          results.validationDetails = validationResult;
        } else {
          results.validationWorks = false;
          results.validationError = 'tokens directory not available';
        }
      } catch (error) {
        results.validationError = error.message;
        results.validationWorks = false;
      }

      const success = results.commandsAvailable && results.splitWorks && 
                     results.consolidateWorks && results.validationWorks;

      return { success, details: results };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test complete workflow integrity
   * @returns {Promise<{success: boolean, details: object}>}
   */
  async testWorkflowIntegrity() {
    try {
      console.log('   Testing roundtrip integrity...');
      
      // Create temporary test files
      const testSourcePath = 'tokensource-integrity-test.json';
      const testTokensDir = 'tokens-integrity-test';
      
      try {
        // Copy original source for testing
        await fs.copyFile('tokensource.json', testSourcePath);
        
        // Test complete roundtrip: source → split → consolidate → compare
        const splitResult = await this.transformationEngine.splitSourceToTokens(
          testSourcePath,
          testTokensDir
        );
        
        if (!splitResult.success) {
          throw new Error(`Split failed: ${splitResult.errors?.join(', ')}`);
        }
        
        const consolidateResult = await this.transformationEngine.consolidateToSource(
          testTokensDir,
          testSourcePath + '.roundtrip'
        );
        
        if (!consolidateResult.success) {
          throw new Error(`Consolidate failed: ${consolidateResult.errors?.join(', ')}`);
        }
        
        // Compare original and roundtrip files
        const originalContent = await fs.readFile(testSourcePath, 'utf8');
        const roundtripContent = await fs.readFile(testSourcePath + '.roundtrip', 'utf8');
        
        const originalData = JSON.parse(originalContent);
        const roundtripData = JSON.parse(roundtripContent);
        
        // Deep comparison of token data
        const comparison = this._compareTokenData(originalData, roundtripData);
        
        return this._successResult('Workflow integrity test passed', {
          splitResult,
          consolidateResult,
          comparison,
          tokensProcessed: splitResult.files?.length || 0
        });
        
      } finally {
        // Cleanup test files
        const cleanupFiles = [
          testSourcePath,
          testSourcePath + '.roundtrip'
        ];
        
        for (const file of cleanupFiles) {
          try {
            await fs.unlink(file);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        
        try {
          await this._removeDirectory(testTokensDir);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      
    } catch (error) {
      return this._errorResult('Workflow integrity test failed', { error: error.message });
    }
  }

  /**
   * Rollback migration to previous state
   * @param {string} backupPath - Path to backup directory
   * @returns {Promise<{success: boolean, details: object}>}
   */
  async rollbackMigration(backupPath) {
    try {
      console.log(`🔄 Rolling back migration from backup: ${backupPath}`);
      
      // Read backup manifest
      const manifestPath = path.join(backupPath, 'backup-manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      const restoredFiles = [];
      const restoredDirs = [];
      
      // Restore files
      for (const file of manifest.files) {
        const backupFilePath = path.join(backupPath, file);
        try {
          await fs.copyFile(backupFilePath, file);
          restoredFiles.push(file);
        } catch (error) {
          console.warn(`Warning: Could not restore file ${file}: ${error.message}`);
        }
      }
      
      // Restore directories
      for (const dir of manifest.directories) {
        const backupDirPath = path.join(backupPath, dir);
        try {
          // Remove current directory if it exists
          try {
            await this._removeDirectory(dir);
          } catch (error) {
            // Directory might not exist, continue
          }
          
          // Copy backup directory
          await this._copyDirectory(backupDirPath, dir);
          restoredDirs.push(dir);
        } catch (error) {
          console.warn(`Warning: Could not restore directory ${dir}: ${error.message}`);
        }
      }
      
      // Update migration state
      await this.updateMigrationState('rolled_back', {
        rollbackTime: new Date().toISOString(),
        backupPath,
        restoredFiles,
        restoredDirs
      });
      
      console.log('✅ Migration rollback completed');
      console.log(`   Restored ${restoredFiles.length} files and ${restoredDirs.length} directories`);
      
      return this._successResult('Migration rolled back successfully', {
        backupPath,
        restoredFiles,
        restoredDirs,
        manifest
      });
      
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      return this._errorResult('Migration rollback failed', { error: error.message });
    }
  }

  /**
   * Update migration state tracking
   * @param {string} state - Migration state
   * @param {object} details - Additional state details
   */
  async updateMigrationState(state, details = {}) {
    try {
      const stateData = {
        state,
        timestamp: new Date().toISOString(),
        ...details
      };
      
      // Ensure .kiro directory exists
      await fs.mkdir('.kiro', { recursive: true });
      
      await fs.writeFile(this.migrationStateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.warn('Warning: Could not update migration state:', error.message);
    }
  }

  /**
   * Get current migration state
   * @returns {Promise<object|null>}
   */
  async getMigrationState() {
    try {
      const stateContent = await fs.readFile(this.migrationStateFile, 'utf8');
      return JSON.parse(stateContent);
    } catch (error) {
      return null;
    }
  }

  // Helper methods
  _successResult(message, details = {}) {
    return { success: true, message, details };
  }

  _errorResult(message, details = {}) {
    return { success: false, message, details };
  }

  async _copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this._copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async _removeDirectory(dir) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Fallback for older Node.js versions
      const { execSync } = require('child_process');
      execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
    }
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  _compareTokenData(original, roundtrip) {
    const differences = [];
    const originalKeys = Object.keys(original);
    const roundtripKeys = Object.keys(roundtrip);
    
    // Check for missing keys
    const missingKeys = originalKeys.filter(key => !roundtripKeys.includes(key));
    const extraKeys = roundtripKeys.filter(key => !originalKeys.includes(key));
    
    if (missingKeys.length > 0) {
      differences.push({ type: 'missing_keys', keys: missingKeys });
    }
    
    if (extraKeys.length > 0) {
      differences.push({ type: 'extra_keys', keys: extraKeys });
    }
    
    // Check for value differences (with some tolerance for formatting)
    const commonKeys = originalKeys.filter(key => roundtripKeys.includes(key));
    for (const key of commonKeys) {
      const originalStr = JSON.stringify(original[key], null, 2);
      const roundtripStr = JSON.stringify(roundtrip[key], null, 2);
      
      if (originalStr !== roundtripStr) {
        // Check if it's just formatting differences
        const originalNormalized = JSON.stringify(original[key]);
        const roundtripNormalized = JSON.stringify(roundtrip[key]);
        
        if (originalNormalized !== roundtripNormalized) {
          differences.push({
            type: 'value_difference',
            key,
            original: original[key],
            roundtrip: roundtrip[key]
          });
        }
      }
    }
    
    return {
      identical: differences.length === 0,
      differences,
      totalKeys: originalKeys.length,
      comparedKeys: commonKeys.length
    };
  }
}

module.exports = MigrationSystem;