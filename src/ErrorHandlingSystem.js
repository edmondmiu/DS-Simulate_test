/**
 * ErrorHandlingSystem - Comprehensive error handling and recovery system
 * 
 * This class provides:
 * - Automatic backup system for all major operations
 * - Rollback capability for failed operations
 * - Partial recovery for validation failures
 * - Detailed error reporting with actionable suggestions
 * - Error logging and debugging support
 * 
 * Requirements addressed: 1.4, 3.4, 5.4, 8.4
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ErrorHandlingSystem {
  constructor(options = {}) {
    this.backupDir = options.backupDir || '.backups';
    this.logDir = options.logDir || '.logs';
    this.maxBackups = options.maxBackups || 10;
    this.debugMode = options.debugMode || false;
    this.errors = [];
    this.warnings = [];
    this.operations = new Map(); // Track ongoing operations
  }

  /**
   * Create automatic backup before major operations
   * @param {string} operationType - Type of operation (split, consolidate, etc.)
   * @param {string|string[]} sourcePaths - Files/directories to backup
   * @param {object} metadata - Additional metadata for the backup
   * @returns {Promise<{success: boolean, backupId: string, backupPath: string, errors: string[]}>}
   */
  async createOperationBackup(operationType, sourcePaths, metadata = {}) {
    this.errors = [];
    const backupId = this._generateBackupId(operationType);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `${operationType}-backup-${timestamp}`);

    try {
      // Ensure backup directory exists
      await this._ensureDirectory(this.backupDir);
      await this._ensureDirectory(backupPath);

      // Normalize source paths to array
      const paths = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
      const backedUpFiles = [];

      // Backup each source path
      for (const sourcePath of paths) {
        const backupResult = await this._backupPath(sourcePath, backupPath);
        if (backupResult.success) {
          backedUpFiles.push(...backupResult.files);
        } else {
          this.errors.push(...backupResult.errors);
        }
      }

      // If no files were backed up and there were errors, consider it a failure
      if (backedUpFiles.length === 0 && this.errors.length > 0) {
        return {
          success: false,
          backupId,
          backupPath: '',
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Create backup manifest
      const manifest = {
        backupId,
        operationType,
        timestamp: new Date().toISOString(),
        sourcePaths: paths,
        backedUpFiles,
        metadata,
        version: '1.0.0'
      };

      const manifestPath = path.join(backupPath, 'backup-manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Log backup creation
      await this._logOperation('backup_created', {
        backupId,
        operationType,
        backupPath,
        fileCount: backedUpFiles.length
      });

      // Clean up old backups
      await this._cleanupOldBackups(operationType);

      return {
        success: this.errors.length === 0,
        backupId,
        backupPath,
        manifest,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Backup creation failed: ${error.message}`);
      await this._logError('backup_failed', error, { operationType, backupId });
      
      return {
        success: false,
        backupId,
        backupPath: '',
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Rollback to a previous backup state
   * @param {string} backupId - ID of the backup to restore
   * @param {object} options - Rollback options
   * @returns {Promise<{success: boolean, restoredFiles: string[], errors: string[]}>}
   */
  async rollbackToBackup(backupId, options = {}) {
    this.errors = [];
    this.warnings = [];
    const { dryRun = false, force = false } = options;
    const restoredFiles = [];

    try {
      // Find backup by ID
      const backupInfo = await this._findBackupById(backupId);
      if (!backupInfo) {
        this.errors.push(`Backup not found: ${backupId}`);
        return { success: false, restoredFiles: [], errors: this.errors };
      }

      // Load backup manifest
      const manifestPath = path.join(backupInfo.path, 'backup-manifest.json');
      const manifest = await this._loadJsonFile(manifestPath);
      if (!manifest) {
        this.errors.push(`Invalid backup manifest: ${backupId}`);
        return { success: false, restoredFiles: [], errors: this.errors };
      }

      // Validate current state before rollback
      if (!force) {
        const validationResult = await this._validateRollbackSafety(manifest);
        if (!validationResult.isSafe) {
          this.errors.push(`Rollback not safe: ${validationResult.reasons.join(', ')}`);
          this.warnings.push('Use force=true to override safety checks');
          return { success: false, restoredFiles: [], errors: this.errors };
        }
      }

      // Create backup of current state before rollback (only for existing files)
      const existingPaths = [];
      for (const sourcePath of manifest.sourcePaths) {
        if (await this._fileExists(sourcePath)) {
          existingPaths.push(sourcePath);
        }
      }

      let preRollbackBackup = null;
      if (existingPaths.length > 0) {
        preRollbackBackup = await this.createOperationBackup('pre-rollback', existingPaths, {
          rollbackTarget: backupId,
          originalOperation: manifest.operationType
        });

        if (!preRollbackBackup.success) {
          this.warnings.push('Failed to create pre-rollback backup');
        }
      } else {
        this.warnings.push('No existing files to backup before rollback');
      }

      if (dryRun) {
        // Simulate rollback without making changes
        const simulationResult = await this._simulateRollback(manifest);
        return {
          success: true,
          restoredFiles: simulationResult.wouldRestore,
          dryRun: true,
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Perform actual rollback
      for (const sourcePath of manifest.sourcePaths) {
        const restoreResult = await this._restorePath(sourcePath, backupInfo.path);
        if (restoreResult.success) {
          restoredFiles.push(...restoreResult.files);
        } else {
          this.errors.push(...restoreResult.errors);
        }
      }

      // Log rollback operation
      await this._logOperation('rollback_completed', {
        backupId,
        restoredFiles: restoredFiles.length,
        preRollbackBackup: preRollbackBackup?.backupId || null
      });

      return {
        success: this.errors.length === 0,
        restoredFiles,
        preRollbackBackup: preRollbackBackup?.backupId || null,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Rollback failed: ${error.message}`);
      await this._logError('rollback_failed', error, { backupId });
      
      return {
        success: false,
        restoredFiles,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Implement partial recovery for validation failures
   * @param {object} validationResult - Result from validation system
   * @param {object} options - Recovery options
   * @returns {Promise<{success: boolean, recoveredItems: object[], errors: string[]}>}
   */
  async attemptPartialRecovery(validationResult, options = {}) {
    this.errors = [];
    this.warnings = [];
    const { autoFix = true, backupFirst = true } = options;
    const recoveredItems = [];

    try {
      // Create backup before attempting recovery
      if (backupFirst) {
        const backupResult = await this.createOperationBackup('partial-recovery', [
          'tokens',
          'tokensource.json'
        ], {
          validationErrors: validationResult.errors?.length || 0,
          validationWarnings: validationResult.warnings?.length || 0
        });

        if (!backupResult.success) {
          this.warnings.push('Failed to create recovery backup');
        }
      }

      // Process different types of validation issues from the nested structure
      const allIssues = [];
      
      // Extract issues from validation report structure
      if (validationResult.validations) {
        // Handle nested validation structure
        for (const [validationType, validation] of Object.entries(validationResult.validations)) {
          if (validation.issues) {
            allIssues.push(...validation.issues);
          }
          if (validation.unresolvedReferences) {
            allIssues.push(...validation.unresolvedReferences.map(ref => ({
              type: 'unresolved_reference',
              reference: ref.reference,
              location: ref.location,
              file: ref.file
            })));
          }
          if (validation.missingFiles) {
            allIssues.push(...validation.missingFiles.map(file => ({
              type: 'missing_file',
              file: file
            })));
          }
        }
      } else {
        // Handle direct issues structure (backward compatibility)
        if (validationResult.issues) {
          allIssues.push(...validationResult.issues);
        }
        if (validationResult.unresolvedReferences) {
          allIssues.push(...validationResult.unresolvedReferences.map(ref => ({
            type: 'unresolved_reference',
            reference: ref.reference,
            location: ref.location,
            file: ref.file
          })));
        }
        if (validationResult.missingFiles) {
          allIssues.push(...validationResult.missingFiles.map(file => ({
            type: 'missing_file',
            file: file
          })));
        }
      }

      // Process all collected issues
      for (const issue of allIssues) {
        let recoveryResult;
        
        if (issue.type === 'unresolved_reference') {
          recoveryResult = await this._attemptReferenceRecovery(issue, autoFix);
        } else if (issue.type === 'missing_file') {
          recoveryResult = await this._attemptFileRecovery(issue.file, autoFix);
        } else {
          recoveryResult = await this._attemptIssueRecovery(issue, autoFix);
        }
        
        if (recoveryResult.recovered) {
          recoveredItems.push(recoveryResult);
        }
      }

      // Log recovery attempt
      await this._logOperation('partial_recovery_attempted', {
        totalIssues: allIssues.length,
        recoveredItems: recoveredItems.length,
        autoFix
      });

      return {
        success: this.errors.length === 0,
        recoveredItems,
        totalAttempted: recoveredItems.length,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Partial recovery failed: ${error.message}`);
      await this._logError('partial_recovery_failed', error, { validationResult });
      
      return {
        success: false,
        recoveredItems,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Generate detailed error report with actionable suggestions
   * @param {Error|string} error - Error object or message
   * @param {object} context - Additional context information
   * @param {object} options - Report options
   * @returns {Promise<{report: object, suggestions: string[], debugInfo: object}>}
   */
  async generateErrorReport(error, context = {}, options = {}) {
    const { includeDebugInfo = this.debugMode, includeSuggestions = true } = options;
    
    const errorInfo = {
      message: error.message || error,
      type: error.constructor?.name || 'Unknown',
      timestamp: new Date().toISOString(),
      context,
      stack: error.stack
    };

    const report = {
      error: errorInfo,
      systemInfo: await this._getSystemInfo(),
      operationContext: this._getCurrentOperationContext(),
      relatedFiles: await this._getRelatedFiles(context),
      severity: this._assessErrorSeverity(error, context)
    };

    const suggestions = includeSuggestions ? this._generateErrorSuggestions(error, context) : [];
    const debugInfo = includeDebugInfo ? await this._collectDebugInfo(error, context) : {};

    // Log the error
    await this._logError('error_reported', error, context);

    return {
      report,
      suggestions,
      debugInfo
    };
  }

  /**
   * Start tracking an operation for error context
   * @param {string} operationType - Type of operation
   * @param {object} operationData - Operation data
   * @returns {string} Operation ID
   */
  startOperation(operationType, operationData = {}) {
    const operationId = this._generateOperationId(operationType);
    
    this.operations.set(operationId, {
      type: operationType,
      startTime: Date.now(),
      data: operationData,
      status: 'running'
    });

    return operationId;
  }

  /**
   * Complete an operation tracking
   * @param {string} operationId - Operation ID
   * @param {object} result - Operation result
   */
  async completeOperation(operationId, result = {}) {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.status = result.success ? 'completed' : 'failed';
      operation.endTime = Date.now();
      operation.duration = operation.endTime - operation.startTime;
      operation.result = result;

      // Log operation completion
      await this._logOperation('operation_completed', {
        operationId,
        type: operation.type,
        duration: operation.duration,
        success: result.success
      });

      // Keep completed operations for a short time for context
      setTimeout(() => {
        this.operations.delete(operationId);
      }, 60000); // 1 minute
    }
  }

  /**
   * Get list of available backups
   * @param {string} operationType - Filter by operation type (optional)
   * @returns {Promise<{backups: object[], errors: string[]}>}
   */
  async listBackups(operationType = null) {
    this.errors = [];
    const backups = [];

    try {
      const backupDirExists = await this._directoryExists(this.backupDir);
      if (!backupDirExists) {
        return { backups: [], errors: this.errors };
      }

      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const backupPath = path.join(this.backupDir, entry.name);
          const manifestPath = path.join(backupPath, 'backup-manifest.json');
          
          if (await this._fileExists(manifestPath)) {
            const manifest = await this._loadJsonFile(manifestPath);
            if (manifest && (!operationType || manifest.operationType === operationType)) {
              backups.push({
                id: manifest.backupId,
                type: manifest.operationType,
                timestamp: manifest.timestamp,
                path: backupPath,
                fileCount: manifest.backedUpFiles?.length || 0,
                metadata: manifest.metadata
              });
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return { backups, errors: this.errors };

    } catch (error) {
      this.errors.push(`Failed to list backups: ${error.message}`);
      return { backups: [], errors: this.errors };
    }
  }

  // Private helper methods

  async _backupPath(sourcePath, backupDir) {
    const files = [];
    const errors = [];

    try {
      const stats = await fs.stat(sourcePath);
      
      if (stats.isFile()) {
        const fileName = path.basename(sourcePath);
        const backupFilePath = path.join(backupDir, fileName);
        
        // Check for path length issues
        if (backupFilePath.length > 255) {
          errors.push(`Backup path too long for ${sourcePath} (${backupFilePath.length} chars)`);
          return { success: false, files, errors };
        }
        
        await fs.copyFile(sourcePath, backupFilePath);
        files.push(fileName);
      } else if (stats.isDirectory()) {
        const dirName = path.basename(sourcePath);
        const backupDirPath = path.join(backupDir, dirName);
        
        // Check for path length issues
        if (backupDirPath.length > 200) {
          errors.push(`Backup directory path too long for ${sourcePath} (${backupDirPath.length} chars)`);
          return { success: false, files, errors };
        }
        
        // Skip backup directories to prevent recursive backup loops
        if (dirName === '.backups' || sourcePath.includes('.backups')) {
          this.warnings.push(`Skipping backup directory: ${sourcePath}`);
          return { success: true, files, errors };
        }
        
        await this._ensureDirectory(backupDirPath);
        
        const entries = await fs.readdir(sourcePath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(sourcePath, entry.name);
          const backupEntryPath = path.join(backupDirPath, entry.name);
          
          // Skip nested backup directories
          if (entry.name === '.backups' || entry.name.includes('backup')) {
            this.warnings.push(`Skipping nested backup: ${entryPath}`);
            continue;
          }
          
          if (entry.isFile()) {
            // Check path length before copying
            if (backupEntryPath.length > 255) {
              errors.push(`File backup path too long: ${entryPath}`);
              continue;
            }
            
            await fs.copyFile(entryPath, backupEntryPath);
            files.push(path.join(dirName, entry.name));
          } else if (entry.isDirectory()) {
            const subResult = await this._backupPath(entryPath, backupDirPath);
            files.push(...subResult.files.map(f => path.join(dirName, f)));
            errors.push(...subResult.errors);
          }
        }
      }

      return { success: errors.length === 0, files, errors };

    } catch (error) {
      // Handle specific filesystem errors
      if (error.code === 'ENAMETOOLONG') {
        errors.push(`Path too long for backup: ${sourcePath}`);
      } else if (error.code === 'ENOENT') {
        errors.push(`Source not found for backup: ${sourcePath}`);
      } else if (error.code === 'EACCES') {
        errors.push(`Permission denied for backup: ${sourcePath}`);
      } else {
        errors.push(`Failed to backup ${sourcePath}: ${error.message}`);
      }
      return { success: false, files, errors };
    }
  }

  async _restorePath(targetPath, backupDir) {
    const files = [];
    const errors = [];

    try {
      const fileName = path.basename(targetPath);
      const backupPath = path.join(backupDir, fileName);
      
      const backupExists = await this._fileExists(backupPath);
      if (!backupExists) {
        errors.push(`Backup not found for: ${targetPath}`);
        return { success: false, files, errors };
      }

      const backupStats = await fs.stat(backupPath);
      
      if (backupStats.isFile()) {
        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        await this._ensureDirectory(targetDir);
        
        await fs.copyFile(backupPath, targetPath);
        files.push(fileName);
      } else if (backupStats.isDirectory()) {
        // Ensure target directory exists
        await this._ensureDirectory(targetPath);
        
        const entries = await fs.readdir(backupPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const backupEntryPath = path.join(backupPath, entry.name);
          const targetEntryPath = path.join(targetPath, entry.name);
          
          if (entry.isFile()) {
            await fs.copyFile(backupEntryPath, targetEntryPath);
            files.push(path.join(fileName, entry.name));
          } else if (entry.isDirectory()) {
            const subResult = await this._restorePath(targetEntryPath, backupEntryPath);
            files.push(...subResult.files.map(f => path.join(fileName, f)));
            errors.push(...subResult.errors);
          }
        }
      }

      return { success: errors.length === 0, files, errors };

    } catch (error) {
      errors.push(`Failed to restore ${targetPath}: ${error.message}`);
      return { success: false, files, errors };
    }
  }

  async _attemptIssueRecovery(issue, autoFix) {
    const recovery = {
      issue: issue.type,
      path: issue.path || issue.file,
      recovered: false,
      action: 'none',
      details: {}
    };

    try {
      switch (issue.type) {
        case 'missing_required_file':
          if (autoFix) {
            recovery.action = 'create_default_file';
            // Ensure we have the full path - if issue.file is just filename, we need to construct the full path
            let filePath = issue.file;
            if (issue.file && !issue.file.includes('/') && !issue.file.includes('\\')) {
              // If it's just a filename, assume it's in the tokens directory
              filePath = path.join('tokens', issue.file);
            }
            const created = await this._createDefaultFile(filePath);
            recovery.recovered = created;
            recovery.details = { created: filePath };
          }
          break;

        case 'invalid_json':
          if (autoFix) {
            recovery.action = 'attempt_json_repair';
            // Ensure we have the full path
            let filePath = issue.file;
            if (issue.file && !issue.file.includes('/') && !issue.file.includes('\\')) {
              filePath = path.join('tokens', issue.file);
            }
            const repaired = await this._attemptJsonRepair(filePath);
            recovery.recovered = repaired.success;
            recovery.details = repaired.details;
          }
          break;

        case 'missing_token_type':
          if (autoFix) {
            recovery.action = 'infer_token_type';
            // Ensure we have the full path
            let filePath = issue.file;
            if (issue.file && !issue.file.includes('/') && !issue.file.includes('\\')) {
              filePath = path.join('tokens', issue.file);
            }
            const inferred = await this._inferAndSetTokenType(filePath, issue.path);
            recovery.recovered = inferred.success;
            recovery.details = inferred.details;
          }
          break;

        default:
          recovery.action = 'no_auto_recovery';
          break;
      }

      return recovery;

    } catch (error) {
      recovery.details.error = error.message;
      return recovery;
    }
  }

  async _attemptReferenceRecovery(reference, autoFix) {
    const recovery = {
      reference: reference.reference,
      location: reference.location,
      recovered: false,
      action: 'none',
      details: {}
    };

    try {
      if (autoFix) {
        // Try to find similar tokens that might be the intended reference
        const suggestions = await this._findSimilarTokens(reference.reference);
        
        if (suggestions.length > 0) {
          recovery.action = 'suggest_alternatives';
          recovery.recovered = true; // Mark as recovered since we provided suggestions
          recovery.details = { suggestions: suggestions.slice(0, 3) };
          // Don't auto-replace references as this could break things
        }
      }

      return recovery;

    } catch (error) {
      recovery.details.error = error.message;
      return recovery;
    }
  }

  async _attemptFileRecovery(missingFile, autoFix) {
    const recovery = {
      file: missingFile,
      recovered: false,
      action: 'none',
      details: {}
    };

    try {
      if (autoFix) {
        recovery.action = 'create_empty_file';
        const created = await this._createDefaultFile(missingFile);
        recovery.recovered = created;
        recovery.details = { created: missingFile };
      }

      return recovery;

    } catch (error) {
      recovery.details.error = error.message;
      return recovery;
    }
  }

  _generateErrorSuggestions(error, context) {
    const suggestions = [];
    const errorMessage = error.message || error;

    // File system errors
    if (errorMessage.includes('ENOENT')) {
      suggestions.push('Check if the file or directory exists');
      suggestions.push('Verify file paths are correct');
      suggestions.push('Run split-source-to-tokens to create missing token files');
    }

    if (errorMessage.includes('EACCES')) {
      suggestions.push('Check file permissions');
      suggestions.push('Ensure you have write access to the directory');
    }

    if (errorMessage.includes('JSON')) {
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

    if (errorMessage.includes('reference') && errorMessage.includes('not found')) {
      suggestions.push('Check that referenced tokens exist');
      suggestions.push('Verify reference syntax uses {token.path} format');
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
    if (errorMessage.includes('git')) {
      suggestions.push('Check git repository status');
      suggestions.push('Ensure you are in a git repository');
      suggestions.push('Verify remote repository access');
    }

    // Transformation errors
    if (context.operationType === 'split') {
      suggestions.push('Check tokensource.json structure and syntax');
      suggestions.push('Ensure source file contains valid token data');
      suggestions.push('Try cleaning the tokens directory first');
    }

    if (context.operationType === 'consolidate') {
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

  async _logOperation(operationType, data) {
    try {
      await this._ensureDirectory(this.logDir);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: operationType,
        data,
        level: 'info'
      };

      const logFile = path.join(this.logDir, `operations-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      // Don't throw on logging errors
      console.warn(`Failed to log operation: ${error.message}`);
    }
  }

  async _logError(errorType, error, context) {
    try {
      await this._ensureDirectory(this.logDir);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: errorType,
        error: {
          message: error.message || error,
          stack: error.stack,
          type: error.constructor?.name
        },
        context,
        level: 'error'
      };

      const logFile = path.join(this.logDir, `errors-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine);
    } catch (logError) {
      // Don't throw on logging errors
      console.warn(`Failed to log error: ${logError.message}`);
    }
  }

  _generateBackupId(operationType) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${operationType}-${timestamp}-${random}`;
  }

  _generateOperationId(operationType) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(2).toString('hex');
    return `${operationType}-${timestamp}-${random}`;
  }

  async _ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

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

  async _loadJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load JSON file ${filePath}: ${error.message}`);
      return null;
    }
  }

  async _findBackupById(backupId) {
    try {
      const backups = await this.listBackups();
      return backups.backups.find(backup => backup.id === backupId) || null;
    } catch (error) {
      return null;
    }
  }

  async _validateRollbackSafety(manifest) {
    const reasons = [];
    
    try {
      // Check if target paths still exist
      for (const sourcePath of manifest.sourcePaths) {
        const exists = await this._fileExists(sourcePath);
        if (!exists) {
          reasons.push(`Target path no longer exists: ${sourcePath}`);
        }
      }

      // Check for uncommitted git changes
      try {
        const { execSync } = require('child_process');
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
          reasons.push('Uncommitted git changes detected');
        }
      } catch {
        // Git not available or not in repo - that's okay
      }

      return {
        isSafe: reasons.length === 0,
        reasons
      };

    } catch (error) {
      reasons.push(`Safety validation failed: ${error.message}`);
      return { isSafe: false, reasons };
    }
  }

  async _simulateRollback(manifest) {
    const wouldRestore = [];
    
    for (const sourcePath of manifest.sourcePaths) {
      const fileName = path.basename(sourcePath);
      wouldRestore.push(fileName);
    }

    return { wouldRestore };
  }

  async _cleanupOldBackups(operationType) {
    try {
      const { backups } = await this.listBackups(operationType);
      
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        
        for (const backup of toDelete) {
          try {
            await fs.rm(backup.path, { recursive: true, force: true });
          } catch (error) {
            this.warnings.push(`Failed to cleanup old backup ${backup.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      this.warnings.push(`Backup cleanup failed: ${error.message}`);
    }
  }

  async _getSystemInfo() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    };
  }

  _getCurrentOperationContext() {
    const activeOperations = [];
    
    for (const [id, operation] of this.operations.entries()) {
      if (operation.status === 'running') {
        activeOperations.push({
          id,
          type: operation.type,
          duration: Date.now() - operation.startTime
        });
      }
    }

    return { activeOperations };
  }

  async _getRelatedFiles(context) {
    const relatedFiles = [];
    
    try {
      // Check common files that might be related to the error
      const commonFiles = ['tokensource.json', 'tokens/$metadata.json', 'tokens/$themes.json'];
      
      for (const file of commonFiles) {
        if (await this._fileExists(file)) {
          const stats = await fs.stat(file);
          relatedFiles.push({
            path: file,
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        }
      }

      return relatedFiles;
    } catch (error) {
      return [];
    }
  }

  _assessErrorSeverity(error, context) {
    const errorMessage = error.message || error;
    
    // Critical errors that prevent operations
    if (errorMessage.includes('tokensource.json') && errorMessage.includes('ENOENT')) {
      return 'critical';
    }
    
    if (errorMessage.includes('ENAMETOOLONG') || errorMessage.includes('path too long')) {
      return 'high';
    }
    
    // High severity errors
    if (errorMessage.includes('JSON') && errorMessage.includes('parse')) {
      return 'high';
    }
    
    if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
      return 'high';
    }
    
    // Medium severity errors
    if (context?.operationType === 'validation') {
      return 'medium';
    }
    
    if (errorMessage.includes('reference') && errorMessage.includes('not found')) {
      return 'medium';
    }
    
    // Low severity for warnings and minor issues
    return 'low';
  }

  async _createDefaultFile(filePath) {
    try {
      const fileName = path.basename(filePath);
      const dir = path.dirname(filePath);
      
      await this._ensureDirectory(dir);
      
      let defaultContent = {};
      
      // Create appropriate default content based on file type
      if (fileName === '$metadata.json') {
        defaultContent = {
          tokenSetOrder: ['core', 'global', 'components', 'simulate']
        };
      } else if (fileName === '$themes.json') {
        defaultContent = [{
          id: 'default',
          name: 'Default',
          selectedTokenSets: {
            core: 'enabled',
            global: 'enabled'
          }
        }];
      } else if (fileName.endsWith('.json')) {
        defaultContent = {};
      }
      
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
      return true;
    } catch (error) {
      this.errors.push(`Failed to create default file ${filePath}: ${error.message}`);
      return false;
    }
  }

  async _attemptJsonRepair(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Common JSON repair strategies
      let repairedContent = content;
      let repairActions = [];
      
      // Remove trailing commas
      if (repairedContent.includes(',}') || repairedContent.includes(',]')) {
        repairedContent = repairedContent.replace(/,(\s*[}\]])/g, '$1');
        repairActions.push('removed_trailing_commas');
      }
      
      // Fix common quote issues
      if (repairedContent.includes("'")) {
        repairedContent = repairedContent.replace(/'/g, '"');
        repairActions.push('fixed_quotes');
      }
      
      // Fix incomplete JSON structures
      if (repairedContent.includes('[}') || repairedContent.includes('{]')) {
        // Try to fix malformed brackets
        repairedContent = repairedContent.replace(/\[\}/g, '[]');
        repairedContent = repairedContent.replace(/\{\]/g, '{}');
        repairActions.push('fixed_brackets');
      }
      
      // Try to parse the repaired content
      let parsed;
      try {
        parsed = JSON.parse(repairedContent);
      } catch (parseError) {
        // If still can't parse, try to create a minimal valid structure
        if (filePath.includes('$metadata.json')) {
          parsed = { tokenSetOrder: ['core'] };
          repairActions.push('created_default_metadata');
        } else if (filePath.includes('$themes.json')) {
          parsed = [];
          repairActions.push('created_default_themes');
        } else {
          parsed = {};
          repairActions.push('created_empty_object');
        }
      }
      
      // Write back the repaired content
      await fs.writeFile(filePath, JSON.stringify(parsed, null, 2));
      
      return {
        success: true,
        details: { 
          repaired: repairActions.join(', '),
          actions: repairActions
        }
      };
    } catch (error) {
      return {
        success: false,
        details: { error: error.message }
      };
    }
  }

  async _inferAndSetTokenType(filePath, tokenPath) {
    try {
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      // Navigate to the token
      const pathParts = tokenPath.split('.');
      let token = content;
      
      for (const part of pathParts) {
        if (token[part]) {
          token = token[part];
        } else {
          return { success: false, details: { error: 'Token not found' } };
        }
      }
      
      // Infer type based on value
      if (token.$value) {
        const value = token.$value;
        
        if (typeof value === 'string') {
          if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
            token.$type = 'color';
          } else if (value.includes('px') || value.includes('rem') || value.includes('em')) {
            token.$type = 'dimension';
          } else {
            token.$type = 'string';
          }
        } else if (typeof value === 'number') {
          token.$type = 'number';
        }
        
        // Write back the updated content
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
        
        return {
          success: true,
          details: { inferredType: token.$type }
        };
      }
      
      return { success: false, details: { error: 'No $value found' } };
    } catch (error) {
      return {
        success: false,
        details: { error: error.message }
      };
    }
  }

  async _findSimilarTokens(reference) {
    try {
      // This is a simplified implementation
      // In a real system, you'd search through all token files
      const suggestions = [];
      
      // Extract the token name from reference
      const tokenName = reference.replace(/[{}]/g, '');
      const parts = tokenName.split('.');
      
      if (parts.length > 1) {
        // Suggest common variations
        const lastPart = parts[parts.length - 1];
        
        // Common typos and variations
        const variations = [
          lastPart.replace('primry', 'primary'),
          lastPart.replace('secondry', 'secondary'),
          lastPart.replace('backgrond', 'background'),
          lastPart.replace('foregrond', 'foreground')
        ];
        
        for (const variation of variations) {
          if (variation !== lastPart) {
            const newReference = [...parts.slice(0, -1), variation].join('.');
            suggestions.push(`{${newReference}}`);
          }
        }
      }
      
      return suggestions;
    } catch (error) {
      return [];
    }
  }

  _assessErrorSeverity(error, context) {
    const errorMessage = error.message || error;
    
    // Critical errors that prevent operations
    if (errorMessage.includes('ENOENT') && errorMessage.includes('tokensource.json')) {
      return 'critical';
    }
    
    if (errorMessage.includes('JSON') && (errorMessage.includes('parse') || errorMessage.includes('Unexpected token'))) {
      return 'high';
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      return 'high';
    }
    
    // Medium severity issues
    if (errorMessage.includes('validation') || errorMessage.includes('reference')) {
      return 'medium';
    }
    
    // Low severity issues
    if (errorMessage.includes('warning') || context.operationType === 'validation') {
      return 'low';
    }
    
    return 'medium';
  }

  async _collectDebugInfo(error, context) {
    const debugInfo = {};
    
    try {
      // Environment info
      debugInfo.environment = {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        memoryUsage: process.memoryUsage()
      };

      // File system state
      debugInfo.fileSystem = {};
      
      if (await this._fileExists('tokensource.json')) {
        const stats = await fs.stat('tokensource.json');
        debugInfo.fileSystem.tokensource = {
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      }

      if (await this._directoryExists('tokens')) {
        const files = await fs.readdir('tokens');
        debugInfo.fileSystem.tokensDir = {
          fileCount: files.length,
          files: files.filter(f => f.endsWith('.json'))
        };
      }

      // Git state (if available)
      try {
        const { execSync } = require('child_process');
        const gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
        
        debugInfo.git = {
          branch: gitBranch,
          hasChanges: !!gitStatus,
          changeCount: gitStatus ? gitStatus.split('\n').length : 0
        };
      } catch {
        debugInfo.git = { available: false };
      }

      return debugInfo;
    } catch (error) {
      return { error: 'Failed to collect debug info' };
    }
  }

  async _createDefaultFile(fileName) {
    try {
      const defaults = {
        '$metadata.json': { tokenSetOrder: [] },
        '$themes.json': [{
          id: "default-theme",
          name: "Default",
          selectedTokenSets: {},
          $figmaStyleReferences: {},
          $figmaVariableReferences: {}
        }]
      };

      const defaultContent = defaults[fileName] || {};
      const filePath = fileName.startsWith('tokens/') ? fileName : path.join('tokens', fileName);
      
      await this._ensureDirectory(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async _attemptJsonRepair(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Try common JSON repair strategies
      let repairedContent = content;
      
      // Remove trailing commas
      repairedContent = repairedContent.replace(/,(\s*[}\]])/g, '$1');
      
      // Try to parse repaired content
      JSON.parse(repairedContent);
      
      // If successful, write back the repaired content
      await fs.writeFile(filePath, repairedContent);
      
      return {
        success: true,
        details: { action: 'removed_trailing_commas' }
      };
    } catch (error) {
      return {
        success: false,
        details: { error: error.message }
      };
    }
  }

  async _inferAndSetTokenType(filePath, tokenPath) {
    try {
      const content = await this._loadJsonFile(filePath);
      if (!content) return { success: false };

      // Navigate to the token
      const pathParts = tokenPath.split('.');
      let current = content;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) return { success: false };
        current = current[pathParts[i]];
      }

      const tokenName = pathParts[pathParts.length - 1];
      const token = current[tokenName];
      
      if (!token || !token.$value) return { success: false };

      // Infer type from value
      const inferredType = this._inferTokenType(token.$value);
      token.$type = inferredType;

      // Write back the file
      await fs.writeFile(filePath, JSON.stringify(content, null, 2));

      return {
        success: true,
        details: { inferredType, tokenPath }
      };
    } catch (error) {
      return {
        success: false,
        details: { error: error.message }
      };
    }
  }

  _inferTokenType(value) {
    if (typeof value === 'string') {
      if (value.match(/^#[0-9a-fA-F]{3,8}$/)) return 'color';
      if (value.match(/^rgba?\(/)) return 'color';
      if (value.match(/^\d+(\.\d+)?(px|rem|em|%)$/)) return 'dimension';
      if (value.includes('gradient')) return 'color';
    }
    if (typeof value === 'number') return 'dimension';
    if (typeof value === 'object' && value.fontFamily) return 'typography';
    
    return 'other';
  }

  async _findSimilarTokens(reference) {
    // This is a simplified implementation
    // In a real system, you might use fuzzy matching or token indexing
    const suggestions = [];
    
    try {
      const tokenPath = reference.replace(/[{}]/g, '');
      const parts = tokenPath.split('.');
      
      // Suggest common alternatives based on the path structure
      if (parts.includes('color')) {
        suggestions.push('{color.primary}', '{color.secondary}', '{color.background}');
      }
      
      if (parts.includes('spacing')) {
        suggestions.push('{spacing.small}', '{spacing.medium}', '{spacing.large}');
      }
      
      if (parts.includes('typography')) {
        suggestions.push('{typography.body}', '{typography.heading}', '{typography.caption}');
      }

      return suggestions.slice(0, 3);
    } catch (error) {
      return [];
    }
  }
}

module.exports = ErrorHandlingSystem;