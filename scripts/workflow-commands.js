#!/usr/bin/env node

/**
 * Workflow Commands - GitHub-centered Token Studio workflow interface
 * 
 * This script provides the command interface for managing the Token Studio workflow:
 * - split-source-to-tokens: Convert tokensource.json to modular Token Studio format
 * - consolidate-to-source: Merge modular files back to tokensource.json
 * - sync-from-github: Pull latest changes and split for editing
 * - validate-workflow-integrity: Test complete workflow roundtrip
 * - workflow:start: Complete setup for editing session
 * - workflow:finish: Consolidate and validate for commit
 * 
 * Requirements addressed: 7.1, 7.2, 7.3, 7.4, 7.5
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');
const FileStructureManager = require('../src/FileStructureManager');
const ErrorHandlingSystem = require('../src/ErrorHandlingSystem');

class WorkflowCommands {
  constructor() {
    this.errorHandler = new ErrorHandlingSystem({
      backupDir: '.backups',
      debugMode: process.env.DEBUG_MODE === 'true'
    });
    this.transformationEngine = new TokenTransformationEngine({
      backupDir: '.backups',
      debugMode: process.env.DEBUG_MODE === 'true'
    });
    this.fileManager = new FileStructureManager({
      backupDir: '.backups',
      debugMode: process.env.DEBUG_MODE === 'true'
    });
    this.sourcePath = 'tokensource.json';
    this.tokensDir = 'tokens';
    this.backupDir = '.backups';
  }

  /**
   * Split tokensource.json into Token Studio modular format
   * @param {object} options - Command options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async splitSourceToTokens(options = {}) {
    const { verbose = false, clean = false } = options;
    
    this._logProgress('🔄 Starting split-source-to-tokens workflow...');

    try {
      // Step 1: Validate source file exists
      this._logProgress('📋 Validating source file...', verbose);
      const sourceExists = await this._fileExists(this.sourcePath);
      if (!sourceExists) {
        return this._errorResult(`Source file not found: ${this.sourcePath}`);
      }

      // Step 2: Clean tokens directory if requested
      if (clean) {
        this._logProgress('🧹 Cleaning tokens directory...', verbose);
        const cleanResult = await this.fileManager.cleanTokensDirectory(this.tokensDir, true);
        if (!cleanResult.success) {
          this._logWarning(`Clean operation had issues: ${cleanResult.errors.join(', ')}`);
        }
      }

      // Step 3: Initialize tokens folder structure
      this._logProgress('📁 Initializing tokens folder...', verbose);
      const initResult = await this.fileManager.initializeTokensFolder(this.tokensDir);
      if (!initResult.success) {
        return this._errorResult(`Failed to initialize tokens folder: ${initResult.errors.join(', ')}`);
      }

      // Step 4: Perform the split transformation
      this._logProgress('⚡ Splitting source to modular format...', verbose);
      const splitResult = await this.transformationEngine.splitSourceToTokens(this.sourcePath, this.tokensDir);
      
      if (!splitResult.success) {
        return this._errorResult(`Split operation failed: ${splitResult.errors.join(', ')}`);
      }

      // Step 5: Validate the resulting structure
      this._logProgress('✅ Validating output structure...', verbose);
      const validationResult = await this.fileManager.validateStructure(this.tokensDir);
      
      if (!validationResult.isValid) {
        this._logWarning(`Structure validation issues: ${validationResult.issues.join(', ')}`);
      }

      // Success summary
      const summary = {
        filesCreated: splitResult.files.length,
        files: splitResult.files.map(f => path.basename(f)),
        warnings: splitResult.warnings || [],
        validationIssues: validationResult.issues || []
      };

      this._logSuccess(`✨ Split completed successfully! Created ${summary.filesCreated} files.`);
      
      if (verbose) {
        console.log('📄 Files created:', summary.files.join(', '));
        if (summary.warnings.length > 0) {
          console.log('⚠️  Warnings:', summary.warnings.join(', '));
        }
      }

      return this._successResult('Source split to tokens completed successfully', {
        ...summary,
        backupId: splitResult.backupId
      });

    } catch (error) {
      return this._errorResult(`Unexpected error during split: ${error.message}`);
    }
  }

  /**
   * Consolidate modular Token Studio files back to tokensource.json
   * @param {object} options - Command options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async consolidateToSource(options = {}) {
    const { verbose = false, backup = true } = options;
    
    this._logProgress('🔄 Starting consolidate-to-source workflow...');

    try {
      // Step 1: Validate tokens directory structure
      this._logProgress('📋 Validating tokens directory...', verbose);
      const validationResult = await this.fileManager.validateStructure(this.tokensDir);
      
      if (!validationResult.isValid) {
        return this._errorResult(`Invalid tokens structure: ${validationResult.issues.join(', ')}`);
      }

      // Step 2: Create backup if requested
      let backupPath = null;
      if (backup && await this._fileExists(this.sourcePath)) {
        this._logProgress('💾 Creating backup...', verbose);
        const backupResult = await this.fileManager.createBackup('.', this.backupDir);
        
        if (backupResult.success) {
          backupPath = backupResult.backupPath;
          this._logProgress(`📦 Backup created: ${backupPath}`, verbose);
        } else {
          this._logWarning(`Backup failed: ${backupResult.errors.join(', ')}`);
        }
      }

      // Step 3: Perform consolidation
      this._logProgress('⚡ Consolidating modular files to source...', verbose);
      const consolidateResult = await this.transformationEngine.consolidateToSource(this.tokensDir, this.sourcePath);
      
      if (!consolidateResult.success) {
        return this._errorResult(`Consolidation failed: ${consolidateResult.errors.join(', ')}`);
      }

      // Step 4: Validate the consolidated source
      this._logProgress('✅ Validating consolidated source...', verbose);
      const sourceValidation = await this._validateSourceFile(this.sourcePath);
      
      if (!sourceValidation.isValid) {
        this._logWarning(`Source validation issues: ${sourceValidation.issues.join(', ')}`);
      }

      // Success summary
      const summary = {
        tokensCount: consolidateResult.tokensCount,
        backupPath,
        warnings: consolidateResult.warnings || [],
        validationIssues: sourceValidation.issues || []
      };

      this._logSuccess(`✨ Consolidation completed! Processed ${summary.tokensCount} tokens.`);
      
      if (verbose) {
        if (backupPath) {
          console.log('💾 Backup location:', backupPath);
        }
        if (summary.warnings.length > 0) {
          console.log('⚠️  Warnings:', summary.warnings.join(', '));
        }
      }

      return this._successResult('Tokens consolidated to source successfully', summary);

    } catch (error) {
      return this._errorResult(`Unexpected error during consolidation: ${error.message}`);
    }
  }

  /**
   * Pull latest changes from GitHub and split for editing
   * @param {object} options - Command options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async syncFromGithub(options = {}) {
    const { verbose = false, branch = 'main', createBranch = false, branchName = null } = options;
    
    this._logProgress('🔄 Starting sync-from-github workflow...');

    try {
      // Step 1: Check git status and repository info
      this._logProgress('📋 Checking git status and repository...', verbose);
      const gitStatus = await this._getGitStatus();
      const repoInfo = await this._getRepositoryInfo();
      
      if (!repoInfo.isGitRepo) {
        return this._errorResult('Not in a git repository');
      }
      
      if (gitStatus.hasUncommittedChanges) {
        this._logWarning('⚠️  You have uncommitted changes. Consider committing or stashing them first.');
        if (verbose) {
          console.log('Uncommitted files:', gitStatus.uncommittedFiles.join(', '));
        }
      }

      // Step 2: Handle branch management if requested
      if (createBranch && branchName) {
        this._logProgress(`🌿 Creating and switching to branch '${branchName}'...`, verbose);
        const branchResult = await this.manageBranch('create', branchName);
        
        if (!branchResult.success) {
          // If branch already exists, try to switch to it
          const switchResult = await this.manageBranch('switch', branchName);
          if (!switchResult.success) {
            return this._errorResult(`Branch management failed: ${branchResult.message}`);
          }
          this._logProgress(`🔄 Switched to existing branch '${branchName}'`, verbose);
        }
      }

      // Step 3: Pull latest changes
      this._logProgress(`📥 Pulling latest changes from ${branch}...`, verbose);
      const pullResult = await this._gitPull(branch);
      
      if (!pullResult.success) {
        return this._errorResult(`Git pull failed: ${pullResult.error}`);
      }

      // Step 3: Verify tokensource.json was updated
      this._logProgress('📋 Verifying source file...', verbose);
      const sourceExists = await this._fileExists(this.sourcePath);
      if (!sourceExists) {
        return this._errorResult(`Source file not found after pull: ${this.sourcePath}`);
      }

      // Step 4: Automatically split the updated source
      this._logProgress('⚡ Auto-splitting updated source...', verbose);
      const splitResult = await this.splitSourceToTokens({ verbose, clean: true });
      
      if (!splitResult.success) {
        return this._errorResult(`Auto-split failed: ${splitResult.message}`);
      }

      // Step 5: Confirm designer import readiness
      this._logProgress('✅ Verifying designer import readiness...', verbose);
      const importReadiness = await this._validateDesignerImport();

      // Success summary
      const summary = {
        pullInfo: pullResult.info,
        splitDetails: splitResult.details,
        importReady: importReadiness.isReady,
        importUrl: 'https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json'
      };

      this._logSuccess('✨ Sync completed! Ready for editing and designer import.');
      
      if (verbose) {
        console.log('📥 Pull info:', pullResult.info);
        console.log('🔗 Designer import URL:', summary.importUrl);
        console.log('📄 Files ready for editing:', splitResult.details.files.join(', '));
      }

      return this._successResult('GitHub sync and split completed successfully', summary);

    } catch (error) {
      return this._errorResult(`Unexpected error during sync: ${error.message}`);
    }
  }

  /**
   * Test complete workflow integrity with comprehensive validation
   * @param {object} options - Command options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async validateWorkflowIntegrity(options = {}) {
    const { verbose = false } = options;
    
    this._logProgress('🔄 Starting comprehensive workflow integrity validation...');

    try {
      const ValidationSystem = require('../src/ValidationSystem');
      const validator = new ValidationSystem();
      
      // Check if tokens directory exists
      const tokensDir = path.join(process.cwd(), this.tokensDir);
      const sourcePath = path.join(process.cwd(), this.sourcePath);
      
      this._logProgress('📋 Checking current workspace...', verbose);
      
      const sourceExists = await this._fileExists(sourcePath);
      const tokensExists = await this._fileExists(tokensDir);
      
      if (!sourceExists) {
        return this._errorResult(`Source file not found: ${sourcePath}`);
      }
      
      if (!tokensExists) {
        this._logProgress('⚡ Tokens directory not found, creating from source...', verbose);
        const splitResult = await this.splitSourceToTokens({ verbose: false });
        if (!splitResult.success) {
          return this._errorResult(`Failed to create tokens for validation: ${splitResult.message}`);
        }
      }
      
      // Generate comprehensive validation report
      this._logProgress('🔍 Running comprehensive validation suite...', verbose);
      const result = await validator.generateValidationReport(tokensDir, sourcePath);
      
      // Compile detailed summary
      const summary = {
        validationReport: result.report,
        overallValid: result.isValid,
        validationBreakdown: {
          structure: {
            valid: result.report.validations.structure.isValid,
            issues: result.report.validations.structure.issues?.length || 0,
            criticalIssues: result.report.validations.structure.issues?.filter(i => i.severity === 'error').length || 0
          },
          references: {
            valid: result.report.validations.references.isValid,
            unresolvedReferences: result.report.validations.references.unresolvedReferences?.length || 0,
            circularReferences: result.report.validations.references.circularReferences?.length || 0
          },
          themes: {
            valid: result.report.validations.themes.isValid,
            incompleteThemes: result.report.validations.themes.incompleteThemes?.length || 0,
            orphanedSets: result.report.validations.themes.orphanedSets?.length || 0
          },
          roundtrip: result.report.validations.roundtrip ? {
            valid: result.report.validations.roundtrip.isValid,
            differences: result.report.validations.roundtrip.differences?.length || 0,
            preservationIssues: result.report.validations.roundtrip.preservationIssues?.length || 0
          } : null
        },
        recommendations: result.report.summary.recommendations,
        totalIssues: result.report.summary.totalIssues,
        criticalIssues: result.report.summary.criticalIssues
      };

      if (result.isValid) {
        this._logSuccess('✨ Comprehensive workflow validation passed! All systems operational.');
        
        if (verbose) {
          console.log('📊 Validation Summary:');
          console.log(`   - Structure: ${summary.validationBreakdown.structure.valid ? '✅' : '❌'} (${summary.validationBreakdown.structure.issues} issues)`);
          console.log(`   - References: ${summary.validationBreakdown.references.valid ? '✅' : '❌'} (${summary.validationBreakdown.references.unresolvedReferences} unresolved)`);
          console.log(`   - Themes: ${summary.validationBreakdown.themes.valid ? '✅' : '❌'} (${summary.validationBreakdown.themes.incompleteThemes} incomplete)`);
          if (summary.validationBreakdown.roundtrip) {
            console.log(`   - Roundtrip: ${summary.validationBreakdown.roundtrip.valid ? '✅' : '❌'} (${summary.validationBreakdown.roundtrip.differences} differences)`);
          }
          console.log(`   - Total Issues: ${summary.totalIssues}`);
          console.log(`   - Critical Issues: ${summary.criticalIssues}`);
          
          if (summary.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            summary.recommendations.forEach(rec => {
              console.log(`   - ${rec}`);
            });
          }
        }
      } else {
        this._logError('❌ Workflow validation failed. Issues detected.');
        
        console.log('📊 Issues Summary:');
        console.log(`   - Total Issues: ${summary.totalIssues}`);
        console.log(`   - Critical Issues: ${summary.criticalIssues}`);
        
        // Show critical issues
        if (summary.criticalIssues > 0) {
          console.log('\n🚨 Critical Issues:');
          
          if (!summary.validationBreakdown.structure.valid) {
            const criticalStructureIssues = result.report.validations.structure.issues
              ?.filter(issue => issue.severity === 'error') || [];
            criticalStructureIssues.forEach(issue => {
              console.log(`   - ${issue.message}`);
              if (issue.suggestion) {
                console.log(`     💡 ${issue.suggestion}`);
              }
            });
          }
          
          if (!summary.validationBreakdown.references.valid) {
            const unresolvedRefs = result.report.validations.references.unresolvedReferences || [];
            unresolvedRefs.slice(0, 5).forEach(ref => { // Show first 5
              console.log(`   - ${ref.message}`);
              if (ref.suggestion) {
                console.log(`     💡 ${ref.suggestion}`);
              }
            });
            if (unresolvedRefs.length > 5) {
              console.log(`   - ... and ${unresolvedRefs.length - 5} more reference issues`);
            }
          }
        }
        
        // Show recommendations
        if (summary.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          summary.recommendations.forEach(rec => {
            console.log(`   - ${rec}`);
          });
        }
        
        if (verbose) {
          console.log('\n📋 Detailed Breakdown:');
          console.log(`   Structure Issues: ${summary.validationBreakdown.structure.issues}`);
          console.log(`   Unresolved References: ${summary.validationBreakdown.references.unresolvedReferences}`);
          console.log(`   Circular References: ${summary.validationBreakdown.references.circularReferences}`);
          console.log(`   Incomplete Themes: ${summary.validationBreakdown.themes.incompleteThemes}`);
          console.log(`   Orphaned Token Sets: ${summary.validationBreakdown.themes.orphanedSets}`);
          if (summary.validationBreakdown.roundtrip) {
            console.log(`   Roundtrip Differences: ${summary.validationBreakdown.roundtrip.differences}`);
            console.log(`   Preservation Issues: ${summary.validationBreakdown.roundtrip.preservationIssues}`);
          }
        }
      }
      
      return result.isValid 
        ? this._successResult('Comprehensive workflow validation passed', summary)
        : this._errorResult('Workflow validation failed - see issues above', summary);

    } catch (error) {
      return this._errorResult(`Unexpected error during validation: ${error.message}`);
    }
  }

  /**
   * Complete setup for editing session (convenience command)
   * @param {object} options - Command options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async workflowStart(options = {}) {
    const { verbose = false, sync = true } = options;
    
    this._logProgress('🚀 Starting workflow session...');

    try {
      let syncResult = null;
      
      // Step 1: Sync from GitHub if requested
      if (sync) {
        this._logProgress('📥 Syncing from GitHub...', verbose);
        syncResult = await this.syncFromGithub({ verbose });
        
        if (!syncResult.success) {
          // Try local split if sync fails
          this._logWarning('GitHub sync failed, attempting local split...');
          const splitResult = await this.splitSourceToTokens({ verbose, clean: true });
          
          if (!splitResult.success) {
            return this._errorResult(`Workflow start failed: ${splitResult.message}`);
          }
          
          syncResult = { success: true, message: 'Local split completed', details: splitResult.details };
        }
      } else {
        // Just do local split
        this._logProgress('⚡ Splitting local source...', verbose);
        syncResult = await this.splitSourceToTokens({ verbose, clean: true });
        
        if (!syncResult.success) {
          return this._errorResult(`Workflow start failed: ${syncResult.message}`);
        }
      }

      // Step 2: Validate everything is ready
      this._logProgress('✅ Validating session readiness...', verbose);
      const validationResult = await this.fileManager.validateStructure(this.tokensDir);
      
      const summary = {
        syncPerformed: sync,
        syncResult: syncResult.details,
        validationResult: {
          isValid: validationResult.isValid,
          issues: validationResult.issues || []
        },
        readyForEditing: validationResult.isValid,
        editingLocation: this.tokensDir
      };

      if (validationResult.isValid) {
        this._logSuccess('✨ Workflow session started! Ready for editing.');
        
        if (verbose) {
          console.log('📁 Edit tokens in:', this.tokensDir);
          console.log('📄 Available files:', syncResult.details.files.join(', '));
          console.log('💡 When done, run: npm run workflow:finish');
        }
      } else {
        this._logWarning('⚠️  Session started with validation issues.');
        if (verbose) {
          console.log('Issues:', validationResult.issues.join(', '));
        }
      }

      return this._successResult('Workflow session started', summary);

    } catch (error) {
      return this._errorResult(`Unexpected error starting workflow: ${error.message}`);
    }
  }

  /**
   * Consolidate and validate for commit (convenience command)
   * @param {object} options - Command options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async workflowFinish(options = {}) {
    const { verbose = false, validate = true } = options;
    
    this._logProgress('🏁 Finishing workflow session...');

    try {
      // Step 1: Consolidate changes
      this._logProgress('⚡ Consolidating changes...', verbose);
      const consolidateResult = await this.consolidateToSource({ verbose, backup: true });
      
      if (!consolidateResult.success) {
        return this._errorResult(`Consolidation failed: ${consolidateResult.message}`);
      }

      // Step 2: Validate integrity if requested
      let validationResult = null;
      if (validate) {
        this._logProgress('✅ Validating workflow integrity...', verbose);
        validationResult = await this.validateWorkflowIntegrity({ verbose });
        
        if (!validationResult.success) {
          this._logWarning('⚠️  Integrity validation failed, but consolidation completed.');
        }
      }

      // Step 3: Check git status and provide commit guidance
      this._logProgress('📋 Checking commit readiness...', verbose);
      const gitStatus = await this._getGitStatus();

      const summary = {
        consolidateResult: consolidateResult.details,
        validationResult: validationResult ? validationResult.details : null,
        gitStatus: {
          hasChanges: gitStatus.hasUncommittedChanges,
          changedFiles: gitStatus.uncommittedFiles
        },
        readyForCommit: consolidateResult.success,
        nextSteps: [
          'Review changes in tokensource.json',
          'Commit changes to repository',
          'Push to GitHub for designer access'
        ]
      };

      this._logSuccess('✨ Workflow session finished! Changes consolidated.');
      
      if (verbose) {
        console.log('💾 Backup created:', consolidateResult.details.backupPath);
        console.log('🔢 Tokens processed:', consolidateResult.details.tokensCount);
        
        if (gitStatus.hasUncommittedChanges) {
          console.log('📝 Files changed:', gitStatus.uncommittedFiles.join(', '));
          console.log('💡 Next: Review and commit your changes');
        } else {
          console.log('✅ No changes detected');
        }
      }

      return this._successResult('Workflow session finished successfully', summary);

    } catch (error) {
      return this._errorResult(`Unexpected error finishing workflow: ${error.message}`);
    }
  }

  /**
   * Rollback to a previous backup
   * @param {string} backupId - ID of the backup to restore
   * @param {object} options - Rollback options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async rollbackToBackup(backupId, options = {}) {
    const { verbose = false, force = false, dryRun = false } = options;
    
    this._logProgress(`🔄 Starting rollback to backup ${backupId}...`);

    try {
      const rollbackResult = await this.errorHandler.rollbackToBackup(backupId, {
        dryRun,
        force
      });

      if (rollbackResult.success) {
        const message = dryRun 
          ? `Rollback simulation completed for backup ${backupId}`
          : `Successfully rolled back to backup ${backupId}`;
        
        this._logSuccess(`✨ ${message}`);
        
        if (verbose) {
          console.log('📄 Files restored:', rollbackResult.restoredFiles.join(', '));
          if (rollbackResult.preRollbackBackup) {
            console.log('💾 Pre-rollback backup created:', rollbackResult.preRollbackBackup);
          }
        }

        return this._successResult(message, {
          restoredFiles: rollbackResult.restoredFiles,
          preRollbackBackup: rollbackResult.preRollbackBackup,
          dryRun
        });
      } else {
        return this._errorResult(`Rollback failed: ${rollbackResult.errors.join(', ')}`);
      }

    } catch (error) {
      return this._errorResult(`Unexpected error during rollback: ${error.message}`);
    }
  }

  /**
   * List available backups
   * @param {object} options - List options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async listBackups(options = {}) {
    const { operationType = null, verbose = false } = options;
    
    try {
      const backupsResult = await this.errorHandler.listBackups(operationType);
      
      if (backupsResult.errors.length > 0) {
        this._logWarning(`Issues listing backups: ${backupsResult.errors.join(', ')}`);
      }

      const backups = backupsResult.backups;
      
      if (backups.length === 0) {
        const message = operationType 
          ? `No backups found for operation type: ${operationType}`
          : 'No backups found';
        
        this._logProgress(message);
        return this._successResult(message, { backups: [] });
      }

      console.log(`\n📦 Available Backups (${backups.length}):`);
      console.log('─'.repeat(80));
      
      for (const backup of backups) {
        const date = new Date(backup.timestamp).toLocaleString();
        console.log(`🔹 ${backup.id}`);
        console.log(`   Type: ${backup.type}`);
        console.log(`   Date: ${date}`);
        console.log(`   Files: ${backup.fileCount}`);
        
        if (verbose && backup.metadata && Object.keys(backup.metadata).length > 0) {
          console.log(`   Metadata: ${JSON.stringify(backup.metadata, null, 2)}`);
        }
        console.log('');
      }

      return this._successResult(`Found ${backups.length} backups`, { backups });

    } catch (error) {
      return this._errorResult(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Attempt partial recovery from validation failures
   * @param {object} options - Recovery options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async attemptPartialRecovery(options = {}) {
    const { verbose = false, autoFix = true, backupFirst = true } = options;
    
    this._logProgress('🔄 Starting partial recovery analysis...');

    try {
      // First, run validation to identify issues
      const ValidationSystem = require('../src/ValidationSystem');
      const validator = new ValidationSystem();
      
      const tokensDir = path.join(process.cwd(), this.tokensDir);
      const sourcePath = path.join(process.cwd(), this.sourcePath);
      
      // Check if we have something to validate
      const tokensExists = await this._fileExists(tokensDir);
      const sourceExists = await this._fileExists(sourcePath);
      
      if (!tokensExists && !sourceExists) {
        return this._errorResult('No tokens directory or source file found to recover');
      }

      // Generate validation report to identify issues
      this._logProgress('🔍 Analyzing current state for recovery opportunities...', verbose);
      const validationResult = await validator.generateValidationReport(tokensDir, sourceExists ? sourcePath : null);
      
      if (validationResult.isValid) {
        this._logSuccess('✨ No issues found - system is already in good state!');
        return this._successResult('No recovery needed', { validationResult: validationResult.report });
      }

      // Attempt partial recovery
      this._logProgress('🛠️  Attempting partial recovery...', verbose);
      const recoveryResult = await this.errorHandler.attemptPartialRecovery(validationResult.report, {
        autoFix,
        backupFirst
      });

      if (recoveryResult.success) {
        this._logSuccess(`✨ Partial recovery completed! Recovered ${recoveryResult.recoveredItems.length} items.`);
        
        if (verbose) {
          console.log('🔧 Recovery actions taken:');
          for (const item of recoveryResult.recoveredItems) {
            console.log(`   - ${item.action}: ${item.issue} at ${item.path}`);
          }
        }

        // Re-run validation to show improvement
        const postRecoveryValidation = await validator.generateValidationReport(tokensDir, sourceExists ? sourcePath : null);
        
        return this._successResult('Partial recovery completed', {
          recoveredItems: recoveryResult.recoveredItems,
          preRecoveryIssues: validationResult.report.summary.totalIssues,
          postRecoveryIssues: postRecoveryValidation.report.summary.totalIssues,
          improvement: validationResult.report.summary.totalIssues - postRecoveryValidation.report.summary.totalIssues
        });
      } else {
        return this._errorResult(`Partial recovery failed: ${recoveryResult.errors.join(', ')}`);
      }

    } catch (error) {
      return this._errorResult(`Unexpected error during partial recovery: ${error.message}`);
    }
  }

  /**
   * Attempt partial recovery for validation issues
   * @param {object} options - Recovery options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async attemptPartialRecovery(options = {}) {
    const { verbose = false, autoFix = true, backupFirst = true } = options;
    
    try {
      this._logProgress('🔧 Attempting partial recovery...', verbose);
      
      // First, run validation to identify issues
      const ValidationSystem = require('../src/ValidationSystem');
      const validator = new ValidationSystem();
      
      const tokensExists = await this._directoryExists(this.tokensDir);
      const sourceExists = await this._fileExists(this.sourcePath);
      
      if (!tokensExists && !sourceExists) {
        return this._errorResult('No tokens directory or source file found to recover');
      }
      
      // Generate validation report to identify issues
      const validationResult = await validator.generateValidationReport(
        tokensExists ? this.tokensDir : null,
        sourceExists ? this.sourcePath : null
      );
      
      if (validationResult.isValid) {
        this._logSuccess('✨ No issues found - system is already in good state!');
        return this._successResult('No recovery needed', { 
          validationResult: validationResult.report,
          recoveredItems: []
        });
      }
      
      // Attempt recovery using error handling system
      const recoveryResult = await this.errorHandler.attemptPartialRecovery(validationResult.report, {
        autoFix,
        backupFirst
      });
      
      if (recoveryResult.success) {
        this._logSuccess(`✨ Partial recovery completed! Recovered ${recoveryResult.recoveredItems.length} items.`);
        
        if (verbose && recoveryResult.recoveredItems.length > 0) {
          console.log('\n🔧 Recovery Actions:');
          recoveryResult.recoveredItems.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.action}: ${item.issue || item.reference || item.file}`);
          });
        }
        
        return this._successResult('Partial recovery completed', {
          recoveredItems: recoveryResult.recoveredItems,
          totalAttempted: recoveryResult.totalAttempted,
          warnings: recoveryResult.warnings || []
        });
      } else {
        return this._errorResult(`Partial recovery failed: ${recoveryResult.errors.join(', ')}`);
      }

    } catch (error) {
      return this._errorResult(`Unexpected error during partial recovery: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive error report for debugging
   * @param {Error} error - Error to analyze
   * @param {object} context - Additional context
   * @param {object} options - Report options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async generateErrorReport(error, context = {}, options = {}) {
    const { verbose = false, includeDebugInfo = true } = options;
    
    try {
      const errorReport = await this.errorHandler.generateErrorReport(error, context, {
        includeDebugInfo,
        includeSuggestions: true
      });

      console.log('\n🚨 Error Report');
      console.log('─'.repeat(50));
      console.log(`Error: ${errorReport.report.error.message}`);
      console.log(`Type: ${errorReport.report.error.type}`);
      console.log(`Severity: ${errorReport.report.severity}`);
      console.log(`Time: ${errorReport.report.error.timestamp}`);

      if (errorReport.suggestions.length > 0) {
        console.log('\n💡 Suggestions:');
        for (const suggestion of errorReport.suggestions) {
          console.log(`   - ${suggestion}`);
        }
      }

      if (verbose && errorReport.debugInfo && Object.keys(errorReport.debugInfo).length > 0) {
        console.log('\n🔍 Debug Information:');
        console.log(JSON.stringify(errorReport.debugInfo, null, 2));
      }

      return this._successResult('Error report generated', {
        errorReport: errorReport.report,
        suggestions: errorReport.suggestions,
        debugInfo: errorReport.debugInfo
      });

    } catch (reportError) {
      return this._errorResult(`Failed to generate error report: ${reportError.message}`);
    }
  }

  // Private helper methods

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async _validateSourceFile(sourcePath) {
    const issues = [];
    
    try {
      const content = await fs.readFile(sourcePath, 'utf8');
      const parsed = JSON.parse(content);
      
      if (typeof parsed !== 'object' || parsed === null) {
        issues.push('Source file must contain a valid JSON object');
      }
      
      return { isValid: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Source file validation failed: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  async _getGitStatus() {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const uncommittedFiles = status.trim().split('\n')
        .filter(line => line.trim())
        .map(line => line.trim().substring(2).trim()); // Remove status codes (XY) and trim
      
      return {
        hasUncommittedChanges: uncommittedFiles.length > 0,
        uncommittedFiles
      };
    } catch (error) {
      return {
        hasUncommittedChanges: false,
        uncommittedFiles: [],
        error: error.message
      };
    }
  }

  async _gitPull(branch = 'main') {
    try {
      const output = execSync(`git pull origin ${branch}`, { encoding: 'utf8' });
      return {
        success: true,
        info: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _validateDesignerImport() {
    try {
      // Validate local source file exists
      const sourceExists = await this._fileExists(this.sourcePath);
      if (!sourceExists) {
        return {
          isReady: false,
          issues: ['Source file not available for import']
        };
      }

      // Validate source file structure for Token Studio compatibility
      const sourceValidation = await this._validateTokenStudioCompatibility(this.sourcePath);
      if (!sourceValidation.isValid) {
        return {
          isReady: false,
          issues: [`Source file not Token Studio compatible: ${sourceValidation.issues.join(', ')}`]
        };
      }

      // Validate GitHub URL accessibility (if in git repository)
      const githubValidation = await this._validateGitHubUrl();
      
      return {
        isReady: sourceValidation.isValid,
        issues: [...sourceValidation.issues, ...githubValidation.issues],
        githubUrl: githubValidation.url,
        githubAccessible: githubValidation.accessible
      };
    } catch (error) {
      return {
        isReady: false,
        issues: [`Import validation failed: ${error.message}`]
      };
    }
  }

  async _createTempWorkspace() {
    const tempDir = path.join('.temp', `workflow-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  async _cleanupTempWorkspace(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp workspace: ${error.message}`);
    }
  }

  async _validateTokenStudioCompatibility(sourcePath) {
    const issues = [];
    
    try {
      const content = await fs.readFile(sourcePath, 'utf8');
      const parsed = JSON.parse(content);
      
      // Basic Token Studio format validation
      if (!parsed || typeof parsed !== 'object') {
        issues.push('Invalid JSON structure for Token Studio import');
        return { isValid: false, issues };
      }
      
      // Check for token data (non-metadata keys)
      const tokenKeys = Object.keys(parsed).filter(key => !key.startsWith('$'));
      if (tokenKeys.length === 0) {
        issues.push('No token sets found for import');
      }
      
      // Validate token structure
      for (const tokenSetKey of tokenKeys) {
        const tokenSet = parsed[tokenSetKey];
        if (typeof tokenSet !== 'object' || tokenSet === null) {
          issues.push(`Invalid token set structure: ${tokenSetKey}`);
          continue;
        }
        
        // Check for valid token format within sets
        const hasValidTokens = this._validateTokenSetStructure(tokenSet, tokenSetKey);
        if (!hasValidTokens.isValid) {
          issues.push(...hasValidTokens.issues);
        }
      }
      
      // Check for $metadata if present
      if (parsed.$metadata) {
        const metadataValidation = this._validateMetadataStructure(parsed.$metadata);
        if (!metadataValidation.isValid) {
          issues.push(...metadataValidation.issues);
        }
      }
      
      // Check for $themes if present
      if (parsed.$themes) {
        const themesValidation = this._validateThemesStructure(parsed.$themes);
        if (!themesValidation.isValid) {
          issues.push(...themesValidation.issues);
        }
      }
      
      return { isValid: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Token Studio compatibility validation failed: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  _validateTokenSetStructure(tokenSet, tokenSetName) {
    const issues = [];
    
    const checkTokenStructure = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'object' && value !== null) {
          if (value.$type && value.$value !== undefined) {
            // This is a token - validate it
            if (typeof value.$type !== 'string') {
              issues.push(`Invalid $type in ${tokenSetName}.${currentPath}: must be string`);
            }
            // $value can be string, number, object, or reference
          } else if (!key.startsWith('$')) {
            // This is a group - recurse
            checkTokenStructure(value, currentPath);
          }
        }
      }
    };
    
    checkTokenStructure(tokenSet);
    return { isValid: issues.length === 0, issues };
  }

  _validateMetadataStructure(metadata) {
    const issues = [];
    
    if (typeof metadata !== 'object' || metadata === null) {
      issues.push('$metadata must be an object');
      return { isValid: false, issues };
    }
    
    if (metadata.tokenSetOrder && !Array.isArray(metadata.tokenSetOrder)) {
      issues.push('$metadata.tokenSetOrder must be an array');
    }
    
    return { isValid: issues.length === 0, issues };
  }

  _validateThemesStructure(themes) {
    const issues = [];
    
    if (!Array.isArray(themes)) {
      issues.push('$themes must be an array');
      return { isValid: false, issues };
    }
    
    themes.forEach((theme, index) => {
      if (typeof theme !== 'object' || theme === null) {
        issues.push(`Theme at index ${index} must be an object`);
        return;
      }
      
      if (!theme.id || typeof theme.id !== 'string') {
        issues.push(`Theme at index ${index} must have a string id`);
      }
      
      if (!theme.name || typeof theme.name !== 'string') {
        issues.push(`Theme at index ${index} must have a string name`);
      }
      
      if (!theme.selectedTokenSets || typeof theme.selectedTokenSets !== 'object') {
        issues.push(`Theme at index ${index} must have selectedTokenSets object`);
      }
    });
    
    return { isValid: issues.length === 0, issues };
  }

  async _validateGitHubUrl() {
    try {
      // Get repository information
      const repoInfo = await this._getRepositoryInfo();
      
      if (!repoInfo.isGitRepo) {
        return {
          accessible: false,
          issues: ['Not in a git repository'],
          url: null
        };
      }
      
      // Generate GitHub raw URL
      const githubUrl = this._generateGitHubRawUrl(repoInfo);
      
      if (!githubUrl) {
        return {
          accessible: false,
          issues: ['Could not generate GitHub URL - not a GitHub repository'],
          url: null
        };
      }
      
      // Test URL accessibility (basic validation)
      const urlValidation = this._validateUrl(githubUrl);
      
      return {
        accessible: urlValidation.isValid,
        issues: urlValidation.issues,
        url: githubUrl,
        repository: repoInfo.repository,
        branch: repoInfo.branch
      };
    } catch (error) {
      return {
        accessible: false,
        issues: [`GitHub URL validation failed: ${error.message}`],
        url: null
      };
    }
  }

  async _getRepositoryInfo() {
    try {
      // Check if we're in a git repository
      const isGitRepo = await this._isGitRepository();
      if (!isGitRepo) {
        return { isGitRepo: false };
      }
      
      // Get remote origin URL
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      
      // Get current branch
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      
      // Parse GitHub repository from remote URL
      const repository = this._parseGitHubRepository(remoteUrl);
      
      return {
        isGitRepo: true,
        remoteUrl,
        branch,
        repository
      };
    } catch (error) {
      return {
        isGitRepo: false,
        error: error.message
      };
    }
  }

  async _isGitRepository() {
    try {
      execSync('git rev-parse --git-dir', { encoding: 'utf8', stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  _parseGitHubRepository(remoteUrl) {
    // Handle both HTTPS and SSH URLs
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    const sshMatch = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    
    const match = httpsMatch || sshMatch;
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        fullName: `${match[1]}/${match[2]}`
      };
    }
    
    return null;
  }

  _generateGitHubRawUrl(repoInfo) {
    if (!repoInfo.repository) {
      return null;
    }
    
    const { owner, repo } = repoInfo.repository;
    const branch = repoInfo.branch || 'main';
    const filename = path.basename(this.sourcePath);
    
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`;
  }

  _validateUrl(url) {
    const issues = [];
    
    try {
      const parsedUrl = new URL(url);
      
      if (parsedUrl.protocol !== 'https:') {
        issues.push('URL must use HTTPS protocol');
      }
      
      if (parsedUrl.hostname !== 'raw.githubusercontent.com') {
        issues.push('URL must be from raw.githubusercontent.com');
      }
      
      if (!parsedUrl.pathname.endsWith('.json')) {
        issues.push('URL must point to a JSON file');
      }
      
      return { isValid: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Invalid URL format: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  async _simulateDesignerImport(sourcePath) {
    // This method simulates what Token Studio would do when importing
    const issues = [];
    
    try {
      const content = await fs.readFile(sourcePath, 'utf8');
      const parsed = JSON.parse(content);
      
      // Simulate Token Studio's import validation
      const compatibility = await this._validateTokenStudioCompatibility(sourcePath);
      
      if (!compatibility.isValid) {
        issues.push(...compatibility.issues);
      }
      
      // Additional simulation checks
      const tokenSets = Object.keys(parsed).filter(key => !key.startsWith('$'));
      if (tokenSets.length === 0) {
        issues.push('No token sets available for import');
      }
      
      // Check if themes are properly configured
      if (parsed.$themes && parsed.$themes.length > 0) {
        const themeValidation = this._validateThemeTokenSetReferences(parsed.$themes, tokenSets);
        if (!themeValidation.isValid) {
          issues.push(...themeValidation.issues);
        }
      }
      
      return { isValid: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Import simulation failed: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  _validateThemeTokenSetReferences(themes, availableTokenSets) {
    const issues = [];
    
    themes.forEach((theme, index) => {
      if (theme.selectedTokenSets) {
        const referencedSets = Object.keys(theme.selectedTokenSets);
        const missingRefs = referencedSets.filter(setName => !availableTokenSets.includes(setName));
        
        if (missingRefs.length > 0) {
          issues.push(`Theme "${theme.name}" references missing token sets: ${missingRefs.join(', ')}`);
        }
      }
    });
    
    return { isValid: issues.length === 0, issues };
  }

  _logProgress(message, verbose = true) {
    if (verbose) {
      console.log(message);
    }
  }

  _logSuccess(message) {
    console.log(`\x1b[32m${message}\x1b[0m`);
  }

  _logError(message) {
    console.error(`\x1b[31m${message}\x1b[0m`);
  }

  _logWarning(message) {
    console.warn(`\x1b[33m${message}\x1b[0m`);
  }

  _successResult(message, details = {}) {
    return { success: true, message, details };
  }

  _errorResult(message, details = {}) {
    return { 
      success: false, 
      message, 
      details,
      errors: [message],
      suggestions: this._generateErrorSuggestions(message, details)
    };
  }

  _generateErrorSuggestions(errorMessage, context = {}) {
    const suggestions = [];

    // File system errors
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      suggestions.push('Check if the file or directory exists');
      suggestions.push('Verify file paths are correct');
      suggestions.push('Run split-source-to-tokens to create missing token files');
    }

    if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      suggestions.push('Check file permissions');
      suggestions.push('Ensure you have write access to the directory');
    }

    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      suggestions.push('Validate JSON syntax in the affected file');
      suggestions.push('Use a JSON validator to check for syntax errors');
      suggestions.push('Check for trailing commas or missing quotes');
    }

    // Token Studio specific errors
    if (errorMessage.includes('token') && errorMessage.includes('reference')) {
      suggestions.push('Check that referenced tokens exist');
      suggestions.push('Verify token reference syntax uses {token.path} format');
      suggestions.push('Run validate-workflow-integrity to check all references');
    }

    if (errorMessage.includes('metadata') || errorMessage.includes('$metadata')) {
      suggestions.push('Ensure $metadata.json has valid tokenSetOrder array');
      suggestions.push('Check that all token sets in metadata have corresponding files');
    }

    if (errorMessage.includes('theme') || errorMessage.includes('$themes')) {
      suggestions.push('Validate $themes.json structure');
      suggestions.push('Ensure all themes have required properties (id, name, selectedTokenSets)');
    }

    // Git related errors
    if (errorMessage.includes('git') || errorMessage.includes('repository')) {
      suggestions.push('Check git repository status');
      suggestions.push('Ensure you are in a git repository');
      suggestions.push('Verify remote repository access');
    }

    // Transformation errors
    if (errorMessage.includes('split') || errorMessage.includes('Split')) {
      suggestions.push('Check tokensource.json structure and syntax');
      suggestions.push('Ensure source file contains valid token data');
      suggestions.push('Try cleaning the tokens directory first');
    }

    if (errorMessage.includes('consolidate') || errorMessage.includes('Consolidation')) {
      suggestions.push('Validate all token files in tokens/ directory');
      suggestions.push('Check that $metadata.json and $themes.json exist');
      suggestions.push('Ensure all referenced token sets have corresponding files');
    }

    // Generic suggestions if no specific ones found
    if (suggestions.length === 0) {
      suggestions.push('Check the error log for more details');
      suggestions.push('Try running the operation with verbose output');
      suggestions.push('Consider creating a backup before retrying');
    }

    return suggestions;
  }

  /**
   * Generate GitHub raw URL for tokensource.json import
   * @param {string} branch - Branch name (default: main)
   * @returns {Promise<{success: boolean, url: string, error?: string}>}
   */
  async generateGitHubImportUrl(branch = 'main') {
    try {
      const repoInfo = await this._getRepositoryInfo();
      
      if (!repoInfo.isGitRepo) {
        return {
          success: false,
          error: 'Not in a git repository'
        };
      }
      
      if (!repoInfo.repository) {
        return {
          success: false,
          error: 'Not a GitHub repository or remote not configured'
        };
      }
      
      const { owner, repo } = repoInfo.repository;
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/tokensource.json`;
      
      return {
        success: true,
        url,
        repository: `${owner}/${repo}`,
        branch,
        owner,
        repo
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate GitHub URL: ${error.message}`
      };
    }
  }

  /**
   * Validate GitHub repository configuration and access
   * @returns {Promise<{isValid: boolean, issues: string[], details: object}>}
   */
  async validateGitHubIntegration() {
    const issues = [];
    const details = {};
    
    try {
      // Check git repository status
      const gitStatus = await this._getGitStatus();
      details.gitStatus = gitStatus;
      
      // Check remote configuration
      const remoteResult = await this.generateGitHubImportUrl();
      details.remoteConfig = remoteResult;
      
      if (!remoteResult.success) {
        issues.push(`GitHub remote configuration issue: ${remoteResult.error}`);
      }
      
      // Check if tokensource.json exists and is committed
      const sourceExists = await this._fileExists(this.sourcePath);
      if (!sourceExists) {
        issues.push('tokensource.json not found in repository');
      } else {
        details.sourceFileExists = true;
        
        // Check if source file is committed (not in git status)
        const sourceFileName = path.basename(this.sourcePath);
        const isUncommitted = gitStatus.uncommittedFiles.includes(sourceFileName);
        if (isUncommitted) {
          issues.push('tokensource.json has uncommitted changes - designers may not see latest version');
        }
        details.sourceFileCommitted = !isUncommitted;
      }
      
      // Validate Token Studio compatibility
      if (sourceExists) {
        const compatibilityResult = await this._validateTokenStudioCompatibility(this.sourcePath);
        details.tokenStudioCompatibility = compatibilityResult;
        
        if (!compatibilityResult.isValid) {
          issues.push(...compatibilityResult.issues.map(issue => `Token Studio compatibility: ${issue}`));
        }
      }
      
      return {
        isValid: issues.length === 0,
        issues,
        details
      };
      
    } catch (error) {
      issues.push(`GitHub integration validation failed: ${error.message}`);
      return {
        isValid: false,
        issues,
        details
      };
    }
  }

  /**
   * Manage branch operations for workflow isolation
   * @param {string} action - 'create', 'switch', 'delete', 'list'
   * @param {string} branchName - Branch name for create/switch/delete operations
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async manageBranch(action, branchName = null) {
    try {
      switch (action) {
        case 'create':
          if (!branchName) {
            return this._errorResult('Branch name required for create operation');
          }
          
          // Check if branch already exists
          try {
            execSync(`git rev-parse --verify ${branchName}`, { encoding: 'utf8' });
            return this._errorResult(`Branch '${branchName}' already exists`);
          } catch {
            // Branch doesn't exist, we can create it
          }
          
          const createOutput = execSync(`git checkout -b ${branchName}`, { encoding: 'utf8' });
          return this._successResult(`Branch '${branchName}' created and switched to`, {
            branchName,
            output: createOutput.trim()
          });
          
        case 'switch':
          if (!branchName) {
            return this._errorResult('Branch name required for switch operation');
          }
          
          const switchOutput = execSync(`git checkout ${branchName}`, { encoding: 'utf8' });
          return this._successResult(`Switched to branch '${branchName}'`, {
            branchName,
            output: switchOutput.trim()
          });
          
        case 'delete':
          if (!branchName) {
            return this._errorResult('Branch name required for delete operation');
          }
          
          // Check if we're currently on the branch
          const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
          if (currentBranch === branchName) {
            return this._errorResult(`Cannot delete current branch '${branchName}'. Switch to another branch first.`);
          }
          
          const deleteOutput = execSync(`git branch -d ${branchName}`, { encoding: 'utf8' });
          return this._successResult(`Branch '${branchName}' deleted`, {
            branchName,
            output: deleteOutput.trim()
          });
          
        case 'list':
          const listOutput = execSync('git branch -a', { encoding: 'utf8' });
          const branches = listOutput.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => ({
              name: line.replace(/^\*\s*/, '').replace(/^remotes\/origin\//, ''),
              current: line.startsWith('*'),
              remote: line.startsWith('remotes/')
            }));
          
          return this._successResult('Branch list retrieved', {
            branches,
            currentBranch: branches.find(b => b.current)?.name
          });
          
        default:
          return this._errorResult(`Unknown branch action: ${action}`);
      }
      
    } catch (error) {
      return this._errorResult(`Branch operation failed: ${error.message}`);
    }
  }

  /**
   * Test designer import workflow with actual Token Studio format validation
   * @param {object} options - Test options
   * @returns {Promise<{success: boolean, message: string, details: object}>}
   */
  async testDesignerImport(options = {}) {
    const { verbose = false, branch = 'main' } = options;
    
    this._logProgress('🔄 Testing designer import workflow...');
    
    try {
      // Step 1: Validate GitHub integration
      this._logProgress('📋 Validating GitHub integration...', verbose);
      const githubValidation = await this.validateGitHubIntegration();
      
      if (!githubValidation.isValid) {
        this._logWarning('⚠️  GitHub integration issues detected');
        if (verbose) {
          console.log('Issues:', githubValidation.issues.join(', '));
        }
        // Continue with local testing even if GitHub integration has issues
      }
      
      // Step 2: Generate import URL
      this._logProgress('🔗 Generating import URL...', verbose);
      const urlResult = await this.generateGitHubImportUrl(branch);
      
      if (!urlResult.success) {
        this._logWarning('⚠️  Could not generate GitHub import URL');
        if (verbose) {
          console.log('Error:', urlResult.error);
        }
        // Continue with local testing
      }
      
      // Step 3: Validate tokensource.json for Token Studio compatibility
      this._logProgress('✅ Validating Token Studio compatibility...', verbose);
      const compatibilityResult = await this._validateTokenStudioCompatibility(this.sourcePath);
      
      if (!compatibilityResult.isValid) {
        this._logWarning('⚠️  Token Studio compatibility issues detected');
        if (verbose) {
          console.log('Issues:', compatibilityResult.issues.join(', '));
        }
      }
      
      // Step 4: Test file structure requirements
      this._logProgress('📁 Testing file structure requirements...', verbose);
      const structureTest = await this._testTokenStudioStructureRequirements();
      
      // Step 5: Simulate import process
      this._logProgress('🎭 Simulating Token Studio import process...', verbose);
      const importSimulation = await this._simulateTokenStudioImport();
      
      const summary = {
        githubIntegration: githubValidation,
        importUrl: urlResult.success ? urlResult.url : null,
        repository: urlResult.success ? urlResult.repository : null,
        branch: urlResult.success ? urlResult.branch : branch,
        tokenStudioCompatibility: compatibilityResult,
        structureRequirements: structureTest,
        importSimulation,
        designerReadiness: {
          canImport: compatibilityResult.isValid && structureTest.isValid,
          issues: [
            ...compatibilityResult.issues,
            ...structureTest.issues,
            ...importSimulation.issues
          ]
        }
      };
      
      // Success is based on Token Studio compatibility and structure, not GitHub integration
      const isSuccess = summary.designerReadiness.canImport && importSimulation.success;
      
      if (isSuccess) {
        this._logSuccess('✨ Designer import test passed! Ready for Token Studio import.');
        
        if (verbose) {
          if (urlResult.success) {
            console.log('🔗 Import URL:', urlResult.url);
          }
          console.log('📊 Token sets found:', structureTest.tokenSets?.length || 0);
          console.log('🎨 Themes available:', structureTest.themes?.length || 0);
        }
      } else {
        this._logError('❌ Designer import test failed.');
        console.log('Issues found:');
        summary.designerReadiness.issues.forEach(issue => {
          console.log(`  - ${issue}`);
        });
      }
      
      return isSuccess 
        ? this._successResult('Designer import test completed successfully', summary)
        : this._errorResult('Designer import test failed - see issues above', summary);
        
    } catch (error) {
      return this._errorResult(`Unexpected error during designer import test: ${error.message}`);
    }
  }

  /**
   * Test Token Studio structure requirements
   * @returns {Promise<{isValid: boolean, issues: string[], tokenSets: string[], themes: object[]}>}
   */
  async _testTokenStudioStructureRequirements() {
    const issues = [];
    let tokenSets = [];
    let themes = [];
    
    try {
      const content = await fs.readFile(this.sourcePath, 'utf8');
      const parsed = JSON.parse(content);
      
      // Find token sets (non-metadata keys)
      tokenSets = Object.keys(parsed).filter(key => !key.startsWith('$'));
      
      if (tokenSets.length === 0) {
        issues.push('No token sets found - Token Studio requires at least one token set');
      }
      
      // Check for themes
      if (parsed.$themes) {
        if (Array.isArray(parsed.$themes)) {
          themes = parsed.$themes;
          
          // Validate theme structure
          themes.forEach((theme, index) => {
            if (!theme.id) {
              issues.push(`Theme at index ${index} missing required 'id' field`);
            }
            if (!theme.name) {
              issues.push(`Theme at index ${index} missing required 'name' field`);
            }
            if (!theme.selectedTokenSets) {
              issues.push(`Theme at index ${index} missing required 'selectedTokenSets' field`);
            }
          });
        } else {
          issues.push('$themes must be an array');
        }
      } else {
        // No themes is acceptable, but warn
        console.warn('⚠️  No themes defined - designers will need to configure token sets manually');
      }
      
      // Check metadata
      if (parsed.$metadata) {
        if (parsed.$metadata.tokenSetOrder && !Array.isArray(parsed.$metadata.tokenSetOrder)) {
          issues.push('$metadata.tokenSetOrder must be an array');
        }
      }
      
      return {
        isValid: issues.length === 0,
        issues,
        tokenSets,
        themes
      };
      
    } catch (error) {
      issues.push(`Structure validation failed: ${error.message}`);
      return {
        isValid: false,
        issues,
        tokenSets: [],
        themes: []
      };
    }
  }

  /**
   * Simulate Token Studio import process
   * @returns {Promise<{success: boolean, issues: string[], details: object}>}
   */
  async _simulateTokenStudioImport() {
    const issues = [];
    const details = {};
    
    try {
      const content = await fs.readFile(this.sourcePath, 'utf8');
      const parsed = JSON.parse(content);
      
      // Simulate Token Studio parsing
      details.fileSize = Buffer.byteLength(content, 'utf8');
      details.tokenCount = 0;
      details.groupCount = 0;
      details.referenceCount = 0;
      
      // Count tokens and references
      const countTokens = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (key.startsWith('$')) continue; // Skip metadata
          
          if (typeof value === 'object' && value !== null) {
            if (value.$type && value.$value !== undefined) {
              // This is a token
              details.tokenCount++;
              
              // Check for references
              if (typeof value.$value === 'string' && value.$value.includes('{')) {
                details.referenceCount++;
              }
            } else {
              // This is a group
              details.groupCount++;
              countTokens(value, path ? `${path}.${key}` : key);
            }
          }
        }
      };
      
      // Count tokens in all token sets
      Object.keys(parsed).forEach(key => {
        if (!key.startsWith('$')) {
          countTokens(parsed[key]);
        }
      });
      
      // Check file size limits (Token Studio has practical limits)
      if (details.fileSize > 10 * 1024 * 1024) { // 10MB
        issues.push('File size very large - may cause performance issues in Token Studio');
      }
      
      // Check token count (practical limits)
      if (details.tokenCount > 10000) {
        issues.push('Very large number of tokens - may cause performance issues');
      }
      
      // Check for common issues
      if (details.referenceCount > 0 && details.referenceCount === details.tokenCount) {
        issues.push('All tokens are references - ensure some base values exist');
      }
      
      details.simulationResults = {
        canParse: true,
        estimatedLoadTime: details.tokenCount < 1000 ? 'fast' : details.tokenCount < 5000 ? 'moderate' : 'slow',
        memoryUsage: details.fileSize < 1024 * 1024 ? 'low' : details.fileSize < 5 * 1024 * 1024 ? 'moderate' : 'high'
      };
      
      return {
        success: issues.length === 0,
        issues,
        details
      };
      
    } catch (error) {
      issues.push(`Import simulation failed: ${error.message}`);
      return {
        success: false,
        issues,
        details: {}
      };
    }
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2];
  const flags = process.argv.slice(3);
  
  const options = {
    verbose: flags.includes('--verbose') || flags.includes('-v'),
    clean: flags.includes('--clean'),
    backup: !flags.includes('--no-backup'),
    sync: !flags.includes('--no-sync'),
    validate: !flags.includes('--no-validate'),
    branch: flags.find(f => f.startsWith('--branch='))?.split('=')[1] || 'main'
  };

  const workflow = new WorkflowCommands();
  let result;

  try {
    switch (command) {
      case 'split-source-to-tokens':
        result = await workflow.splitSourceToTokens(options);
        break;
      
      case 'consolidate-to-source':
        result = await workflow.consolidateToSource(options);
        break;
      
      case 'sync-from-github':
        result = await workflow.syncFromGithub(options);
        break;
      
      case 'validate-workflow-integrity':
        result = await workflow.validateWorkflowIntegrity(options);
        break;
      
      case 'workflow:start':
        result = await workflow.workflowStart(options);
        break;
      
      case 'workflow:finish':
        result = await workflow.workflowFinish(options);
        break;
      
      case 'generate-github-url':
        const urlResult = await workflow.generateGitHubImportUrl(options.branch);
        if (urlResult.success) {
          result = {
            success: true,
            message: `GitHub import URL generated successfully`,
            details: {
              url: urlResult.url,
              repository: urlResult.repository,
              branch: urlResult.branch
            }
          };
          console.log(`\n🔗 Import URL: ${urlResult.url}`);
          console.log(`📦 Repository: ${urlResult.repository}`);
          console.log(`🌿 Branch: ${urlResult.branch}`);
        } else {
          result = {
            success: false,
            message: urlResult.error,
            details: urlResult
          };
        }
        break;
      
      case 'validate-github-integration':
        const validationResult = await workflow.validateGitHubIntegration();
        result = {
          success: validationResult.isValid,
          message: validationResult.isValid 
            ? 'GitHub integration validation passed'
            : `GitHub integration validation failed: ${validationResult.issues.join(', ')}`,
          details: validationResult.details
        };
        
        if (validationResult.isValid) {
          console.log('\n✅ GitHub integration is properly configured');
          if (validationResult.details.remoteConfig?.success) {
            console.log(`🔗 Import URL: ${validationResult.details.remoteConfig.url}`);
          }
        } else {
          console.log('\n❌ GitHub integration issues found:');
          validationResult.issues.forEach(issue => {
            console.log(`  - ${issue}`);
          });
        }
        break;
      
      case 'manage-branch':
        const action = flags[0];
        const branchName = flags[1];
        if (!action) {
          console.error('Branch action required: create, switch, delete, list');
          process.exit(1);
        }
        result = await workflow.manageBranch(action, branchName);
        break;
      
      case 'test-designer-import':
        result = await workflow.testDesignerImport(options);
        break;
      
      // Consolidated command aliases for simplified interface
      case 'start':
        result = await workflow.workflowStart(options);
        break;
      
      case 'finish':
        result = await workflow.workflowFinish(options);
        break;
      
      default:
        console.log(`
Token Studio Workflow Commands

Usage: node scripts/workflow-commands.js <command> [options]

Commands:
  split-source-to-tokens       Split tokensource.json to Token Studio native format
  consolidate-to-source        Merge Token Studio files back to tokensource.json
  sync-from-github            Pull latest and split for editing
  validate-workflow-integrity  Test complete workflow roundtrip
  workflow:start              Complete setup for editing session
  workflow:finish             Consolidate and validate for commit
  generate-github-url          Generate GitHub import URL for designers
  validate-github-integration  Validate GitHub repository configuration
  manage-branch <action> [name] Manage branches (create, switch, delete, list)
  test-designer-import         Test designer import workflow

Options:
  --verbose, -v               Show detailed progress
  --clean                     Clean tokens directory before split
  --no-backup                 Skip backup creation
  --no-sync                   Skip GitHub sync in workflow:start
  --no-validate               Skip validation in workflow:finish
  --branch=<name>             Specify git branch (default: main)

Examples:
  node scripts/workflow-commands.js split-source-to-tokens --verbose
  node scripts/workflow-commands.js workflow:start --clean
  node scripts/workflow-commands.js sync-from-github --branch=develop
  node scripts/workflow-commands.js generate-github-url --branch=main
  node scripts/workflow-commands.js manage-branch create feature/new-tokens
  node scripts/workflow-commands.js test-designer-import --verbose
        `);
        process.exit(0);
    }

    if (result.success) {
      console.log(`\n✅ ${result.message}`);
      process.exit(0);
    } else {
      console.error(`\n❌ ${result.message}`);
      if (options.verbose && result.details) {
        console.error('Details:', JSON.stringify(result.details, null, 2));
      }
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n💥 Unexpected error: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

module.exports = WorkflowCommands;