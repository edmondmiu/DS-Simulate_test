/**
 * FileStructureManager - Manages Token Studio file structure and operations
 * 
 * This class handles:
 * - Token Studio folder initialization and validation
 * - Token set to filename mapping logic
 * - File system error handling and recovery
 * - Structure validation with detailed error reporting
 * 
 * Requirements addressed: 1.4, 1.5, 2.1, 2.2
 */

const fs = require('fs').promises;
const path = require('path');
const ErrorHandlingSystem = require('./ErrorHandlingSystem');

class FileStructureManager {
  constructor(options = {}) {
    this.errors = [];
    this.warnings = [];
    this.errorHandler = new ErrorHandlingSystem({
      backupDir: options.backupDir || '.backups',
      debugMode: options.debugMode || false
    });
  }

  /**
   * Initialize tokens folder with proper Token Studio structure
   * @param {string} tokensDir - Directory path for tokens folder
   * @returns {Promise<{success: boolean, structure: object}>}
   */
  async initializeTokensFolder(tokensDir) {
    this.errors = [];
    this.warnings = [];
    const structure = {};

    try {
      // Ensure the tokens directory exists
      await this._ensureDirectory(tokensDir);
      structure.tokensDir = tokensDir;

      // Create required Token Studio files if they don't exist
      const requiredFiles = this._getRequiredFiles();
      structure.files = {};

      for (const [fileName, defaultContent] of Object.entries(requiredFiles)) {
        const filePath = path.join(tokensDir, fileName);
        const fileExists = await this._fileExists(filePath);
        
        if (!fileExists) {
          await this._createFile(filePath, defaultContent);
          structure.files[fileName] = { created: true, path: filePath };
        } else {
          structure.files[fileName] = { created: false, path: filePath };
        }
      }

      // Validate the created structure
      const validation = await this.validateStructure(tokensDir);
      structure.validation = validation;

      return {
        success: this.errors.length === 0,
        structure,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Failed to initialize tokens folder: ${error.message}`);
      return {
        success: false,
        structure,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Validate Token Studio file structure
   * @param {string} tokensDir - Directory path to validate
   * @returns {Promise<{isValid: boolean, missingFiles: string[], issues: string[]}>}
   */
  async validateStructure(tokensDir) {
    this.errors = [];
    this.warnings = [];
    const missingFiles = [];
    const issues = [];

    try {
      // Check if tokens directory exists
      const dirExists = await this._directoryExists(tokensDir);
      if (!dirExists) {
        issues.push(`Tokens directory does not exist: ${tokensDir}`);
        return {
          isValid: false,
          missingFiles: [],
          issues,
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Check for required Token Studio files
      const requiredFiles = Object.keys(this._getRequiredFiles());
      
      for (const fileName of requiredFiles) {
        const filePath = path.join(tokensDir, fileName);
        const fileExists = await this._fileExists(filePath);
        
        if (!fileExists) {
          missingFiles.push(fileName);
        } else {
          // Validate file content structure
          const contentValidation = await this._validateFileContent(filePath, fileName);
          if (!contentValidation.isValid) {
            issues.push(...contentValidation.issues);
          }
        }
      }

      // Check for token set files consistency
      const consistencyValidation = await this._validateTokenSetConsistency(tokensDir);
      if (!consistencyValidation.isValid) {
        issues.push(...consistencyValidation.issues);
      }

      // Check for orphaned files
      const orphanedFiles = await this._findOrphanedFiles(tokensDir);
      if (orphanedFiles.length > 0) {
        this.warnings.push(`Found orphaned files: ${orphanedFiles.join(', ')}`);
      }

      return {
        isValid: missingFiles.length === 0 && issues.length === 0,
        missingFiles,
        issues,
        orphanedFiles,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Structure validation failed: ${error.message}`);
      return {
        isValid: false,
        missingFiles,
        issues,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Get file mapping for token sets
   * @returns {{[tokenSetName]: string}} Token set name to filename mapping
   */
  getTokenSetMapping() {
    return {
      // Core token sets
      'core': 'core.json',
      'global': 'global.json',
      'components': 'components.json',
      
      // Brand-specific sets
      'simulate': 'simulate.json',
      
      // Legacy/existing sets
      'Content Typography': 'Content Typography.json',
      'existing': 'existing.json',
      
      // Special Token Studio files
      '$metadata': '$metadata.json',
      '$themes': '$themes.json'
    };
  }

  /**
   * Get filename for a token set name
   * @param {string} tokenSetName - Name of the token set
   * @returns {string} Corresponding filename
   */
  getTokenSetFileName(tokenSetName) {
    const mapping = this.getTokenSetMapping();
    return mapping[tokenSetName] || `${this._sanitizeFileName(tokenSetName)}.json`;
  }

  /**
   * Get token set name from filename
   * @param {string} fileName - Filename to convert
   * @returns {string} Corresponding token set name
   */
  getTokenSetNameFromFile(fileName) {
    const mapping = this.getTokenSetMapping();
    
    // Find by exact match
    for (const [setName, mappedFileName] of Object.entries(mapping)) {
      if (mappedFileName === fileName) {
        return setName;
      }
    }
    
    // Extract from filename (remove .json extension)
    return fileName.replace(/\.json$/, '');
  }

  /**
   * List all token set files in directory
   * @param {string} tokensDir - Directory to scan
   * @returns {Promise<{tokenFiles: string[], metadataFiles: string[], errors: string[]}>}
   */
  async listTokenFiles(tokensDir) {
    this.errors = [];
    const tokenFiles = [];
    const metadataFiles = [];

    try {
      const files = await fs.readdir(tokensDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(tokensDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          if (file.startsWith('$')) {
            metadataFiles.push(file);
          } else {
            tokenFiles.push(file);
          }
        }
      }

      return {
        tokenFiles: tokenFiles.sort(),
        metadataFiles: metadataFiles.sort(),
        errors: this.errors
      };

    } catch (error) {
      this.errors.push(`Failed to list token files: ${error.message}`);
      return {
        tokenFiles: [],
        metadataFiles: [],
        errors: this.errors
      };
    }
  }

  /**
   * Clean up tokens directory (remove all files)
   * @param {string} tokensDir - Directory to clean
   * @param {boolean} preserveStructure - Whether to preserve directory structure
   * @returns {Promise<{success: boolean, removedFiles: string[], errors: string[]}>}
   */
  async cleanTokensDirectory(tokensDir, preserveStructure = false) {
    this.errors = [];
    this.warnings = [];
    const removedFiles = [];

    try {
      const dirExists = await this._directoryExists(tokensDir);
      if (!dirExists) {
        this.warnings.push(`Directory does not exist: ${tokensDir}`);
        return {
          success: true,
          removedFiles: [],
          errors: this.errors,
          warnings: this.warnings
        };
      }

      const files = await fs.readdir(tokensDir);
      
      for (const file of files) {
        const filePath = path.join(tokensDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && file.endsWith('.json')) {
          try {
            await fs.unlink(filePath);
            removedFiles.push(file);
          } catch (error) {
            this.errors.push(`Failed to remove file ${file}: ${error.message}`);
          }
        }
      }

      // Remove directory if not preserving structure
      if (!preserveStructure && removedFiles.length > 0) {
        try {
          await fs.rmdir(tokensDir);
        } catch (error) {
          // Directory might not be empty, that's okay
          this.warnings.push(`Could not remove directory: ${error.message}`);
        }
      }

      return {
        success: this.errors.length === 0,
        removedFiles,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Failed to clean tokens directory: ${error.message}`);
      return {
        success: false,
        removedFiles,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Create backup of tokens directory
   * @param {string} tokensDir - Source directory
   * @param {string} backupDir - Backup destination
   * @returns {Promise<{success: boolean, backupPath: string, errors: string[]}>}
   */
  async createBackup(tokensDir, backupDir) {
    this.errors = [];
    
    try {
      // Use the error handling system for backup creation
      const backupResult = await this.errorHandler.createOperationBackup('file-structure', tokensDir, {
        operation: 'createBackup',
        targetDir: backupDir
      });

      if (backupResult.success) {
        return {
          success: true,
          backupPath: backupResult.backupPath,
          backupId: backupResult.backupId,
          errors: this.errors,
          warnings: this.warnings
        };
      } else {
        this.errors.push(...backupResult.errors);
        return {
          success: false,
          backupPath: '',
          errors: this.errors,
          warnings: this.warnings
        };
      }

    } catch (error) {
      this.errors.push(`Failed to create backup: ${error.message}`);
      return {
        success: false,
        backupPath: '',
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  // Private helper methods

  /**
   * Get required Token Studio files with default content
   * @returns {object} Map of filename to default content
   * @private
   */
  _getRequiredFiles() {
    return {
      '$metadata.json': {
        tokenSetOrder: []
      },
      '$themes.json': [
        {
          id: "base-theme",
          name: "Base",
          selectedTokenSets: {},
          $figmaStyleReferences: {},
          $figmaVariableReferences: {}
        }
      ]
    };
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   * @private
   */
  async _ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.errors.push(`Failed to create directory ${dirPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>}
   * @private
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<boolean>}
   * @private
   */
  async _directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Create file with content
   * @param {string} filePath - File path
   * @param {object} content - Content to write
   * @private
   */
  async _createFile(filePath, content) {
    try {
      const jsonContent = JSON.stringify(content, null, 2);
      await fs.writeFile(filePath, jsonContent, 'utf8');
    } catch (error) {
      this.errors.push(`Failed to create file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate file content structure
   * @param {string} filePath - File to validate
   * @param {string} fileName - Name of the file
   * @returns {Promise<{isValid: boolean, issues: string[]}>}
   * @private
   */
  async _validateFileContent(filePath, fileName) {
    const issues = [];

    try {
      const content = await fs.readFile(filePath, 'utf8');
      let parsedContent;

      try {
        parsedContent = JSON.parse(content);
      } catch (parseError) {
        issues.push(`Invalid JSON in ${fileName}: ${parseError.message}`);
        return { isValid: false, issues };
      }

      // Validate specific file structures
      if (fileName === '$metadata.json') {
        if (!parsedContent.tokenSetOrder || !Array.isArray(parsedContent.tokenSetOrder)) {
          issues.push('$metadata.json must contain tokenSetOrder array');
        }
      } else if (fileName === '$themes.json') {
        if (!Array.isArray(parsedContent)) {
          issues.push('$themes.json must be an array');
        } else {
          for (let i = 0; i < parsedContent.length; i++) {
            const theme = parsedContent[i];
            if (!theme.id || !theme.name || !theme.selectedTokenSets) {
              issues.push(`Theme at index ${i} missing required properties (id, name, selectedTokenSets)`);
            }
          }
        }
      } else if (fileName.endsWith('.json') && !fileName.startsWith('$')) {
        // Validate token file structure
        if (typeof parsedContent !== 'object' || parsedContent === null) {
          issues.push(`Token file ${fileName} must contain an object`);
        }
      }

      return { isValid: issues.length === 0, issues };

    } catch (error) {
      issues.push(`Failed to validate ${fileName}: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  /**
   * Validate token set consistency between metadata and files
   * @param {string} tokensDir - Directory to validate
   * @returns {Promise<{isValid: boolean, issues: string[]}>}
   * @private
   */
  async _validateTokenSetConsistency(tokensDir) {
    const issues = [];

    try {
      const metadataPath = path.join(tokensDir, '$metadata.json');
      const metadataExists = await this._fileExists(metadataPath);
      
      if (!metadataExists) {
        return { isValid: true, issues }; // Already handled in main validation
      }

      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      if (!metadata.tokenSetOrder || !Array.isArray(metadata.tokenSetOrder)) {
        return { isValid: true, issues }; // Already handled in content validation
      }

      // Check if all token sets in metadata have corresponding files
      for (const tokenSetName of metadata.tokenSetOrder) {
        const fileName = this.getTokenSetFileName(tokenSetName);
        const filePath = path.join(tokensDir, fileName);
        const fileExists = await this._fileExists(filePath);
        
        if (!fileExists) {
          issues.push(`Token set '${tokenSetName}' listed in metadata but file '${fileName}' not found`);
        }
      }

      // Check for token files not listed in metadata
      const { tokenFiles } = await this.listTokenFiles(tokensDir);
      
      for (const fileName of tokenFiles) {
        const tokenSetName = this.getTokenSetNameFromFile(fileName);
        if (!metadata.tokenSetOrder.includes(tokenSetName)) {
          this.warnings.push(`Token file '${fileName}' exists but not listed in metadata tokenSetOrder`);
        }
      }

      return { isValid: issues.length === 0, issues };

    } catch (error) {
      issues.push(`Failed to validate token set consistency: ${error.message}`);
      return { isValid: false, issues };
    }
  }

  /**
   * Find orphaned files in tokens directory
   * @param {string} tokensDir - Directory to scan
   * @returns {Promise<string[]>} List of orphaned files
   * @private
   */
  async _findOrphanedFiles(tokensDir) {
    const orphanedFiles = [];

    try {
      const files = await fs.readdir(tokensDir);
      const validExtensions = ['.json'];
      const validPrefixes = ['$'];
      const knownFiles = Object.values(this.getTokenSetMapping());

      for (const file of files) {
        const hasValidExtension = validExtensions.some(ext => file.endsWith(ext));
        const isSpecialFile = validPrefixes.some(prefix => file.startsWith(prefix));
        const isKnownFile = knownFiles.includes(file);

        if (hasValidExtension && !isSpecialFile && !isKnownFile) {
          // Check if it's a valid token file by trying to parse it
          try {
            const filePath = path.join(tokensDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            
            // If it's not a valid token structure, consider it orphaned
            if (typeof parsed !== 'object' || parsed === null) {
              orphanedFiles.push(file);
            }
          } catch {
            orphanedFiles.push(file);
          }
        } else if (hasValidExtension && !isSpecialFile && !isKnownFile) {
          orphanedFiles.push(file);
        }
      }

      return orphanedFiles;

    } catch (error) {
      this.warnings.push(`Failed to scan for orphaned files: ${error.message}`);
      return [];
    }
  }

  /**
   * Sanitize filename for safe file system usage
   * @param {string} name - Name to sanitize
   * @returns {string} Sanitized filename
   * @private
   */
  _sanitizeFileName(name) {
    return name
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters except spaces, hyphens, underscores
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase();
  }
}

module.exports = FileStructureManager;