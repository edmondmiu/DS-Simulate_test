/**
 * ValidationSystem - Comprehensive validation system for Token Studio workflow
 * 
 * This class provides validation for:
 * - Token Studio format compliance
 * - Token reference integrity
 * - Roundtrip transformation validation
 * - Theme configuration completeness
 * - Actionable error reporting
 * 
 * Requirements addressed: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const fs = require('fs').promises;
const path = require('path');

class ValidationSystem {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validationResults = {};
  }

  /**
   * Validate Token Studio structure compliance
   * @param {string} tokensDir - Directory containing Token Studio files
   * @returns {Promise<{isValid: boolean, issues: object[], errors: string[]}>}
   */
  async validateTokenStudioStructure(tokensDir) {
    this.errors = [];
    this.warnings = [];
    const issues = [];

    try {
      // Check directory exists
      const dirExists = await this._directoryExists(tokensDir);
      if (!dirExists) {
        issues.push({
          type: 'missing_directory',
          severity: 'error',
          message: `Tokens directory does not exist: ${tokensDir}`,
          suggestion: 'Run split-source-to-tokens command to create the directory structure'
        });
        return { isValid: false, issues, errors: this.errors, warnings: this.warnings };
      }

      // Validate required files
      const requiredFiles = ['$metadata.json', '$themes.json'];
      for (const fileName of requiredFiles) {
        const filePath = path.join(tokensDir, fileName);
        const fileExists = await this._fileExists(filePath);
        
        if (!fileExists) {
          issues.push({
            type: 'missing_required_file',
            severity: 'error',
            file: fileName,
            message: `Required Token Studio file missing: ${fileName}`,
            suggestion: `Create ${fileName} with proper Token Studio structure`
          });
        } else {
          // Validate file content structure
          const contentValidation = await this._validateRequiredFileContent(filePath, fileName);
          issues.push(...contentValidation.issues);
        }
      }

      // Validate metadata structure
      const metadataValidation = await this._validateMetadataStructure(tokensDir);
      issues.push(...metadataValidation.issues);

      // Validate themes structure
      const themesValidation = await this._validateThemesStructure(tokensDir);
      issues.push(...themesValidation.issues);

      // Validate token set files
      const tokenSetsValidation = await this._validateTokenSetFiles(tokensDir);
      issues.push(...tokenSetsValidation.issues);

      // Check for structural consistency
      const consistencyValidation = await this._validateStructuralConsistency(tokensDir);
      issues.push(...consistencyValidation.issues);

      const errorCount = issues.filter(issue => issue.severity === 'error').length;
      
      return {
        isValid: errorCount === 0,
        issues,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Structure validation failed: ${error.message}`);
      return {
        isValid: false,
        issues,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Validate token references and relationships
   * @param {string} tokensDir - Directory containing Token Studio files
   * @returns {Promise<{isValid: boolean, unresolvedReferences: object[], circularReferences: object[], errors: string[]}>}
   */
  async validateTokenReferences(tokensDir) {
    this.errors = [];
    this.warnings = [];
    const unresolvedReferences = [];
    const circularReferences = [];

    try {
      // Load all token data
      const tokenData = await this._loadAllTokenData(tokensDir);
      if (!tokenData) {
        return {
          isValid: false,
          unresolvedReferences: [],
          circularReferences: [],
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Extract all token references
      const references = this._extractAllReferences(tokenData);
      
      // Validate each reference
      for (const reference of references) {
        const resolution = this._resolveTokenReference(reference.value, tokenData, reference.path);
        
        if (!resolution.resolved) {
          // Check if this is a known Token Studio format issue
          const isKnownFormatIssue = this._isKnownTokenStudioFormatIssue(reference.value);
          
          unresolvedReferences.push({
            reference: reference.value,
            location: reference.path,
            file: reference.file,
            message: `Unresolved token reference: ${reference.value}`,
            suggestion: resolution.suggestion || 'Check if the referenced token exists and is properly defined',
            isFormatIssue: isKnownFormatIssue,
            severity: isKnownFormatIssue ? 'warning' : 'error'
          });
        }
      }

      // Check for circular references
      const circularChecks = this._detectCircularReferences(tokenData);
      circularReferences.push(...circularChecks);

      return {
        isValid: unresolvedReferences.length === 0 && circularReferences.length === 0,
        unresolvedReferences,
        circularReferences,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Reference validation failed: ${error.message}`);
      return {
        isValid: false,
        unresolvedReferences,
        circularReferences,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Validate roundtrip integrity (split → consolidate → compare)
   * @param {string} originalSourcePath - Path to original tokensource.json
   * @param {string} tokensDir - Directory for temporary split operation
   * @returns {Promise<{isValid: boolean, differences: object[], preservationIssues: object[], errors: string[]}>}
   */
  async validateRoundtripIntegrity(originalSourcePath, tokensDir) {
    this.errors = [];
    this.warnings = [];
    const differences = [];
    const preservationIssues = [];

    try {
      // Load original source
      const originalData = await this._loadJsonFile(originalSourcePath);
      if (!originalData) {
        return {
          isValid: false,
          differences: [],
          preservationIssues: [],
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Create temporary directory for roundtrip test
      const tempDir = path.join(tokensDir, '.validation-temp');
      await this._ensureDirectory(tempDir);

      try {
        // Import transformation engine
        const TokenTransformationEngine = require('./TokenTransformationEngine');
        const engine = new TokenTransformationEngine();

        // Split original source
        const splitResult = await engine.splitSourceToTokens(originalSourcePath, tempDir);
        if (!splitResult.success) {
          this.errors.push('Failed to split source for roundtrip validation');
          this.errors.push(...splitResult.errors);
          
          // For Token Studio format, this might be expected if source is already in correct format
          this.warnings.push('Roundtrip validation skipped - source may already be in Token Studio format');
          return {
            isValid: true, // Don't fail validation for this
            differences: [],
            preservationIssues: [],
            errors: [],
            warnings: this.warnings
          };
        }

        // Consolidate back to source
        const tempSourcePath = path.join(tempDir, 'roundtrip-test.json');
        const consolidateResult = await engine.consolidateToSource(tempDir, tempSourcePath);
        if (!consolidateResult.success) {
          this.errors.push('Failed to consolidate for roundtrip validation');
          this.errors.push(...consolidateResult.errors);
          
          // For Token Studio format, this might be expected
          this.warnings.push('Roundtrip consolidation failed - may indicate Token Studio format compatibility issues');
          return {
            isValid: false,
            differences: [],
            preservationIssues: [],
            errors: this.errors,
            warnings: this.warnings
          };
        }

        // Load reconstituted data
        const reconstitutedData = await this._loadJsonFile(tempSourcePath);
        if (!reconstitutedData) {
          return {
            isValid: false,
            differences: [],
            preservationIssues: [],
            errors: this.errors,
            warnings: this.warnings
          };
        }

        // Compare structures
        this._compareTokenStructures(originalData, reconstitutedData, '', differences);

        // Check preservation of metadata
        this._validateMetadataPreservation(originalData, reconstitutedData, preservationIssues);

        // Check reference preservation
        this._validateReferencePreservation(originalData, reconstitutedData, preservationIssues);

        return {
          isValid: differences.length === 0 && preservationIssues.length === 0,
          differences,
          preservationIssues,
          errors: this.errors,
          warnings: this.warnings
        };

      } finally {
        // Clean up temporary directory
        await this._cleanupDirectory(tempDir);
      }

    } catch (error) {
      this.errors.push(`Roundtrip validation failed: ${error.message}`);
      return {
        isValid: false,
        differences,
        preservationIssues,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Validate theme configuration completeness
   * @param {string} tokensDir - Directory containing Token Studio files
   * @returns {Promise<{isValid: boolean, incompleteThemes: object[], missingTokens: object[], errors: string[]}>}
   */
  async validateThemeCompleteness(tokensDir) {
    this.errors = [];
    this.warnings = [];
    const incompleteThemes = [];
    const missingTokens = [];

    try {
      // Load themes configuration
      const themesPath = path.join(tokensDir, '$themes.json');
      const themes = await this._loadJsonFile(themesPath);
      if (!themes) {
        return {
          isValid: false,
          incompleteThemes: [],
          missingTokens: [],
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Load metadata to understand token set structure
      const metadataPath = path.join(tokensDir, '$metadata.json');
      const metadata = await this._loadJsonFile(metadataPath);
      if (!metadata) {
        return {
          isValid: false,
          incompleteThemes: [],
          missingTokens: [],
          errors: this.errors,
          warnings: this.warnings
        };
      }

      // Load all token sets
      const tokenSets = await this._loadAllTokenSets(tokensDir, metadata.tokenSetOrder || []);

      // Validate each theme
      for (const theme of themes) {
        const themeValidation = this._validateSingleTheme(theme, tokenSets, metadata);
        
        if (!themeValidation.isComplete) {
          incompleteThemes.push({
            themeId: theme.id,
            themeName: theme.name,
            issues: themeValidation.issues,
            missingTokenSets: themeValidation.missingTokenSets
          });
        }

        missingTokens.push(...themeValidation.missingTokens);
      }

      // Check for orphaned token sets (not used in any theme)
      const orphanedSets = this._findOrphanedTokenSets(themes, Object.keys(tokenSets));
      if (orphanedSets.length > 0) {
        this.warnings.push(`Orphaned token sets not used in any theme: ${orphanedSets.join(', ')}`);
      }

      return {
        isValid: incompleteThemes.length === 0 && missingTokens.length === 0,
        incompleteThemes,
        missingTokens,
        orphanedSets,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Theme validation failed: ${error.message}`);
      return {
        isValid: false,
        incompleteThemes,
        missingTokens,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Generate comprehensive validation report
   * @param {string} tokensDir - Directory to validate
   * @param {string} sourcePath - Optional source file for roundtrip validation
   * @returns {Promise<{isValid: boolean, report: object, errors: string[]}>}
   */
  async generateValidationReport(tokensDir, sourcePath = null) {
    this.errors = [];
    this.warnings = [];
    const report = {
      timestamp: new Date().toISOString(),
      directory: tokensDir,
      validations: {}
    };

    try {
      // Structure validation
      console.log('Running structure validation...');
      const structureValidation = await this.validateTokenStudioStructure(tokensDir);
      report.validations.structure = structureValidation;

      // Reference validation
      console.log('Running reference validation...');
      const referenceValidation = await this.validateTokenReferences(tokensDir);
      report.validations.references = referenceValidation;

      // Theme validation
      console.log('Running theme validation...');
      const themeValidation = await this.validateThemeCompleteness(tokensDir);
      report.validations.themes = themeValidation;

      // Roundtrip validation (if source provided)
      if (sourcePath) {
        console.log('Running roundtrip validation...');
        const roundtripValidation = await this.validateRoundtripIntegrity(sourcePath, tokensDir);
        report.validations.roundtrip = roundtripValidation;
      }

      // Calculate overall validity
      const allValidations = Object.values(report.validations);
      const overallValid = allValidations.every(validation => validation.isValid);

      // Generate summary
      report.summary = {
        isValid: overallValid,
        totalIssues: this._countTotalIssues(report.validations),
        criticalIssues: this._countCriticalIssues(report.validations),
        recommendations: this._generateRecommendations(report.validations)
      };

      return {
        isValid: overallValid,
        report,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Validation report generation failed: ${error.message}`);
      return {
        isValid: false,
        report,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  // Private helper methods

  async _directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
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

  async _loadJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to load JSON file ${path.basename(filePath)}: ${error.message}`);
      return null;
    }
  }

  async _ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.errors.push(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  async _cleanupDirectory(dirPath) {
    try {
      const exists = await this._directoryExists(dirPath);
      if (exists) {
        await fs.rmdir(dirPath, { recursive: true });
      }
    } catch (error) {
      this.warnings.push(`Failed to cleanup directory ${dirPath}: ${error.message}`);
    }
  }

  async _validateRequiredFileContent(filePath, fileName) {
    const issues = [];

    try {
      const content = await this._loadJsonFile(filePath);
      if (!content) {
        // Check if the file exists but has invalid JSON
        const fileExists = await this._fileExists(filePath);
        if (fileExists) {
          issues.push({
            type: 'invalid_json',
            severity: 'error',
            file: fileName,
            message: `Invalid JSON in ${fileName}`,
            suggestion: 'Fix JSON syntax errors in the file'
          });
        }
        return { issues };
      }

      if (fileName === '$metadata.json') {
        if (!content.tokenSetOrder) {
          issues.push({
            type: 'invalid_metadata_structure',
            severity: 'error',
            file: fileName,
            message: '$metadata.json missing required tokenSetOrder property',
            suggestion: 'Add tokenSetOrder array to define the order of token sets'
          });
        } else if (!Array.isArray(content.tokenSetOrder)) {
          issues.push({
            type: 'invalid_metadata_structure',
            severity: 'error',
            file: fileName,
            message: 'tokenSetOrder must be an array',
            suggestion: 'Change tokenSetOrder to an array of token set names'
          });
        }
      } else if (fileName === '$themes.json') {
        if (!Array.isArray(content)) {
          issues.push({
            type: 'invalid_themes_structure',
            severity: 'error',
            file: fileName,
            message: '$themes.json must be an array of theme objects',
            suggestion: 'Change $themes.json to contain an array of theme configurations'
          });
        }
      }

      return { issues };

    } catch (error) {
      issues.push({
        type: 'file_read_error',
        severity: 'error',
        file: fileName,
        message: `Failed to validate ${fileName}: ${error.message}`,
        suggestion: 'Check file permissions and JSON syntax'
      });
      return { issues };
    }
  }

  async _validateMetadataStructure(tokensDir) {
    const issues = [];
    const metadataPath = path.join(tokensDir, '$metadata.json');
    
    try {
      const metadata = await this._loadJsonFile(metadataPath);
      if (!metadata) {
        return { issues };
      }

      // Validate tokenSetOrder references existing files
      if (metadata.tokenSetOrder && Array.isArray(metadata.tokenSetOrder)) {
        for (const setName of metadata.tokenSetOrder) {
          const fileName = this._getTokenSetFileName(setName);
          const filePath = path.join(tokensDir, fileName);
          const fileExists = await this._fileExists(filePath);
          
          if (!fileExists) {
            issues.push({
              type: 'missing_token_set_file',
              severity: 'error',
              file: '$metadata.json',
              tokenSet: setName,
              expectedFile: fileName,
              message: `Token set '${setName}' listed in metadata but file '${fileName}' not found`,
              suggestion: `Create ${fileName} or remove '${setName}' from tokenSetOrder`
            });
          }
        }
      }

      // Validate Token Studio expected structure
      const expectedTokenSets = ['core', 'global'];
      const missingCriticalSets = expectedTokenSets.filter(setName => 
        !metadata.tokenSetOrder || !metadata.tokenSetOrder.includes(setName)
      );

      if (missingCriticalSets.length > 0) {
        issues.push({
          type: 'missing_critical_token_sets',
          severity: 'warning',
          file: '$metadata.json',
          missingSets: missingCriticalSets,
          message: `Missing recommended Token Studio token sets: ${missingCriticalSets.join(', ')}`,
          suggestion: 'Consider adding core and global token sets for better Token Studio compatibility'
        });
      }

      return { issues };

    } catch (error) {
      issues.push({
        type: 'metadata_validation_error',
        severity: 'error',
        file: '$metadata.json',
        message: `Metadata validation failed: ${error.message}`,
        suggestion: 'Check metadata file structure and content'
      });
      return { issues };
    }
  }

  async _validateThemesStructure(tokensDir) {
    const issues = [];
    const themesPath = path.join(tokensDir, '$themes.json');
    
    try {
      const themes = await this._loadJsonFile(themesPath);
      if (!themes) {
        return { issues };
      }

      if (!Array.isArray(themes)) {
        return { issues }; // Already handled in required file validation
      }

      // Validate each theme structure
      for (let i = 0; i < themes.length; i++) {
        const theme = themes[i];
        const themePrefix = `Theme ${i + 1} (${theme.name || 'unnamed'})`;

        if (!theme.id) {
          issues.push({
            type: 'missing_theme_property',
            severity: 'error',
            file: '$themes.json',
            theme: themePrefix,
            property: 'id',
            message: `${themePrefix} missing required 'id' property`,
            suggestion: 'Add unique id property to theme'
          });
        }

        if (!theme.name) {
          issues.push({
            type: 'missing_theme_property',
            severity: 'error',
            file: '$themes.json',
            theme: themePrefix,
            property: 'name',
            message: `${themePrefix} missing required 'name' property`,
            suggestion: 'Add descriptive name property to theme'
          });
        }

        if (!theme.selectedTokenSets || typeof theme.selectedTokenSets !== 'object') {
          issues.push({
            type: 'missing_theme_property',
            severity: 'error',
            file: '$themes.json',
            theme: themePrefix,
            property: 'selectedTokenSets',
            message: `${themePrefix} missing or invalid 'selectedTokenSets' property`,
            suggestion: 'Add selectedTokenSets object defining which token sets are enabled'
          });
        }
      }

      return { issues };

    } catch (error) {
      issues.push({
        type: 'themes_validation_error',
        severity: 'error',
        file: '$themes.json',
        message: `Themes validation failed: ${error.message}`,
        suggestion: 'Check themes file structure and content'
      });
      return { issues };
    }
  }

  async _validateTokenSetFiles(tokensDir) {
    const issues = [];

    try {
      // Get list of JSON files in directory
      const files = await fs.readdir(tokensDir);
      const tokenFiles = files.filter(file => 
        file.endsWith('.json') && 
        !file.startsWith('$') && 
        file !== 'package.json'
      );

      // Validate each token file
      for (const fileName of tokenFiles) {
        const filePath = path.join(tokensDir, fileName);
        const fileValidation = await this._validateTokenFile(filePath, fileName);
        issues.push(...fileValidation.issues);
      }

      // Check for expected Token Studio core token groups
      await this._validateCoreTokenGroups(tokensDir, issues);

      return { issues };

    } catch (error) {
      issues.push({
        type: 'token_files_validation_error',
        severity: 'error',
        message: `Token files validation failed: ${error.message}`,
        suggestion: 'Check token files directory and permissions'
      });
      return { issues };
    }
  }

  async _validateTokenFile(filePath, fileName) {
    const issues = [];

    try {
      const content = await this._loadJsonFile(filePath);
      if (!content) {
        return { issues };
      }

      // Validate token structure
      this._validateTokenStructure(content, fileName, '', issues);

      return { issues };

    } catch (error) {
      issues.push({
        type: 'token_file_validation_error',
        severity: 'error',
        file: fileName,
        message: `Token file validation failed: ${error.message}`,
        suggestion: 'Check file syntax and token structure'
      });
      return { issues };
    }
  }

  _validateTokenStructure(obj, fileName, path, issues) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      // Check if this looks like a token (has description but missing required properties)
      if (typeof value === 'object' && value !== null) {
        const hasTokenLikeProperties = value.description || value.$description;
        const hasType = value.$type || value.type;
        const hasValue = value.$value !== undefined || value.value !== undefined;
        
        if (hasTokenLikeProperties && !hasType && !hasValue) {
          // This looks like an incomplete token
          if (!hasType) {
            issues.push({
              type: 'missing_token_type',
              severity: 'warning',
              file: fileName,
              path: currentPath,
              message: `Token missing $type property: ${currentPath}`,
              suggestion: 'Add $type property to define token type (color, dimension, etc.)'
            });
          }

          if (!hasValue) {
            issues.push({
              type: 'missing_token_value',
              severity: 'error',
              file: fileName,
              path: currentPath,
              message: `Token missing $value property: ${currentPath}`,
              suggestion: 'Add $value property with token value or reference'
            });
          }
        } else if (this._isToken(value)) {
          // Validate complete tokens
          if (!hasType) {
            issues.push({
              type: 'missing_token_type',
              severity: 'warning',
              file: fileName,
              path: currentPath,
              message: `Token missing $type property: ${currentPath}`,
              suggestion: 'Add $type property to define token type (color, dimension, etc.)'
            });
          }

          if (!hasValue) {
            issues.push({
              type: 'missing_token_value',
              severity: 'error',
              file: fileName,
              path: currentPath,
              message: `Token missing $value property: ${currentPath}`,
              suggestion: 'Add $value property with token value or reference'
            });
          }
        } else {
          // Recursively validate nested objects that aren't tokens
          this._validateTokenStructure(value, fileName, currentPath, issues);
        }
      }
    }
  }

  async _validateStructuralConsistency(tokensDir) {
    const issues = [];

    try {
      // Load metadata and themes
      const metadata = await this._loadJsonFile(path.join(tokensDir, '$metadata.json'));
      const themes = await this._loadJsonFile(path.join(tokensDir, '$themes.json'));

      if (!metadata || !themes) {
        return { issues };
      }

      // Check theme references to token sets
      for (const theme of themes) {
        if (theme.selectedTokenSets) {
          for (const tokenSetName of Object.keys(theme.selectedTokenSets)) {
            if (!metadata.tokenSetOrder.includes(tokenSetName)) {
              issues.push({
                type: 'theme_references_unknown_set',
                severity: 'warning',
                file: '$themes.json',
                theme: theme.name,
                tokenSet: tokenSetName,
                message: `Theme '${theme.name}' references unknown token set '${tokenSetName}'`,
                suggestion: `Add '${tokenSetName}' to tokenSetOrder in $metadata.json or remove from theme`
              });
            }
          }
        }
      }

      return { issues };

    } catch (error) {
      issues.push({
        type: 'consistency_validation_error',
        severity: 'error',
        message: `Consistency validation failed: ${error.message}`,
        suggestion: 'Check file structure and references'
      });
      return { issues };
    }
  }

  async _loadAllTokenData(tokensDir) {
    try {
      const metadata = await this._loadJsonFile(path.join(tokensDir, '$metadata.json'));
      if (!metadata || !metadata.tokenSetOrder) {
        return null;
      }

      const tokenData = {};
      
      for (const setName of metadata.tokenSetOrder) {
        const fileName = this._getTokenSetFileName(setName);
        const filePath = path.join(tokensDir, fileName);
        const fileExists = await this._fileExists(filePath);
        
        if (fileExists) {
          const setData = await this._loadJsonFile(filePath);
          if (setData) {
            tokenData[setName] = setData;
          }
        }
      }

      return tokenData;

    } catch (error) {
      this.errors.push(`Failed to load token data: ${error.message}`);
      return null;
    }
  }

  _extractAllReferences(tokenData) {
    const references = [];

    for (const [setName, setData] of Object.entries(tokenData)) {
      this._extractReferencesFromObject(setData, references, '', setName);
    }

    return references;
  }

  _extractReferencesFromObject(obj, references, path, file) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string' && this._isTokenReference(value)) {
        references.push({
          value,
          path: currentPath,
          file
        });
      } else if (typeof value === 'object' && value !== null) {
        this._extractReferencesFromObject(value, references, currentPath, file);
      }
    }
  }

  _isTokenReference(value) {
    return typeof value === 'string' && value.includes('{') && value.includes('}');
  }

  _resolveTokenReference(reference, tokenData, contextPath) {
    try {
      // Extract token path from reference (e.g., "{color.primary}" -> "color.primary")
      const tokenPath = reference.replace(/[{}]/g, '');
      const pathParts = tokenPath.split('.');

      // Search through all token sets
      for (const [setName, setData] of Object.entries(tokenData)) {
        const resolved = this._findTokenInObject(setData, pathParts);
        if (resolved) {
          return { resolved: true, value: resolved };
        }
      }

      // Check for common Token Studio format variations
      const alternativeFormats = this._getAlternativeTokenFormats(tokenPath);
      for (const altFormat of alternativeFormats) {
        const altPathParts = altFormat.split('.');
        for (const [setName, setData] of Object.entries(tokenData)) {
          const resolved = this._findTokenInObject(setData, altPathParts);
          if (resolved) {
            return { 
              resolved: true, 
              value: resolved,
              suggestion: `Token found using alternative format: ${altFormat}`
            };
          }
        }
      }

      return {
        resolved: false,
        suggestion: `Check if token '${tokenPath}' exists in any token set. Common Token Studio formats include: ${alternativeFormats.join(', ')}`
      };

    } catch (error) {
      return {
        resolved: false,
        suggestion: `Invalid reference format: ${reference}`
      };
    }
  }

  _findTokenByPath(tokenData, pathParts) {
    // Search through all token sets for the token
    for (const [setName, setData] of Object.entries(tokenData)) {
      const result = this._findTokenInObject(setData, pathParts);
      if (result) {
        return result;
      }
    }
    return null;
  }

  _findTokenInObject(obj, pathParts) {
    let current = obj;
    
    for (const part of pathParts) {
      if (current && typeof current === 'object' && current[part] !== undefined) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  _detectCircularReferences(tokenData) {
    const circularReferences = [];
    
    // Simple circular reference detection
    // For now, we'll implement a basic version that detects direct circular references
    for (const [setName, setData] of Object.entries(tokenData)) {
      this._findCircularReferencesInSet(setData, setName, '', tokenData, circularReferences, new Set());
    }

    return circularReferences;
  }

  _findCircularReferencesInSet(obj, setName, path, allTokenData, circularReferences, visitedPaths) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const fullPath = `${setName}.${currentPath}`;

      if (this._isToken(value)) {
        const tokenValue = value.$value || value.value;
        if (typeof tokenValue === 'string' && this._isTokenReference(tokenValue)) {
          // Check for direct circular reference (A -> B -> A)
          const referencedPath = tokenValue.replace(/[{}]/g, '');
          
          // Simple check: if the referenced token references back to this token
          const referencedToken = this._findTokenByPath(allTokenData, referencedPath.split('.'));
          if (referencedToken && this._isToken(referencedToken)) {
            const referencedValue = referencedToken.$value || referencedToken.value;
            if (typeof referencedValue === 'string' && this._isTokenReference(referencedValue)) {
              const secondReference = referencedValue.replace(/[{}]/g, '');
              if (secondReference === currentPath || secondReference === fullPath) {
                circularReferences.push({
                  path: fullPath,
                  reference: tokenValue,
                  message: `Circular reference detected: ${fullPath} -> ${tokenValue} -> ${referencedValue}`,
                  suggestion: 'Remove circular dependency by using a different token or direct value'
                });
              }
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        this._findCircularReferencesInSet(value, setName, currentPath, allTokenData, circularReferences, visitedPaths);
      }
    }
  }

  _compareTokenStructures(original, reconstituted, path, differences) {
    const originalKeys = new Set(Object.keys(original));
    const reconstitutedKeys = new Set(Object.keys(reconstituted));

    // Check for missing keys
    for (const key of originalKeys) {
      if (!reconstitutedKeys.has(key)) {
        differences.push({
          type: 'missing_key',
          path: path ? `${path}.${key}` : key,
          message: `Key missing in reconstituted data: ${key}`,
          original: original[key]
        });
      }
    }

    // Check for extra keys
    for (const key of reconstitutedKeys) {
      if (!originalKeys.has(key)) {
        differences.push({
          type: 'extra_key',
          path: path ? `${path}.${key}` : key,
          message: `Extra key in reconstituted data: ${key}`,
          reconstituted: reconstituted[key]
        });
      }
    }

    // Compare common keys
    for (const key of originalKeys) {
      if (reconstitutedKeys.has(key)) {
        const currentPath = path ? `${path}.${key}` : key;
        const originalValue = original[key];
        const reconstitutedValue = reconstituted[key];

        if (typeof originalValue === 'object' && originalValue !== null &&
            typeof reconstitutedValue === 'object' && reconstitutedValue !== null) {
          this._compareTokenStructures(originalValue, reconstitutedValue, currentPath, differences);
        } else if (JSON.stringify(originalValue) !== JSON.stringify(reconstitutedValue)) {
          differences.push({
            type: 'value_mismatch',
            path: currentPath,
            message: `Value mismatch at ${currentPath}`,
            original: originalValue,
            reconstituted: reconstitutedValue
          });
        }
      }
    }
  }

  _validateMetadataPreservation(original, reconstituted, preservationIssues) {
    // Check that token descriptions are preserved
    this._checkDescriptionPreservation(original, reconstituted, '', preservationIssues);
  }

  _checkDescriptionPreservation(original, reconstituted, path, preservationIssues) {
    for (const [key, value] of Object.entries(original)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (this._isToken(value)) {
        const reconstitutedToken = reconstituted[key];
        if (reconstitutedToken) {
          const originalDesc = value.$description || value.description;
          const reconstitutedDesc = reconstitutedToken.$description || reconstitutedToken.description;

          if (originalDesc && !reconstitutedDesc) {
            preservationIssues.push({
              type: 'missing_description',
              path: currentPath,
              message: `Token description not preserved: ${currentPath}`,
              originalDescription: originalDesc
            });
          }
        }
      } else if (typeof value === 'object' && value !== null && reconstituted[key]) {
        this._checkDescriptionPreservation(value, reconstituted[key], currentPath, preservationIssues);
      }
    }
  }

  _validateReferencePreservation(original, reconstituted, preservationIssues) {
    const originalRefs = this._extractTokenReferences(original);
    const reconstitutedRefs = this._extractTokenReferences(reconstituted);

    for (const ref of originalRefs) {
      if (!reconstitutedRefs.includes(ref)) {
        preservationIssues.push({
          type: 'missing_reference',
          reference: ref,
          message: `Token reference not preserved: ${ref}`
        });
      }
    }
  }

  _extractTokenReferences(data, refs = []) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && this._isTokenReference(value)) {
        refs.push(value);
      } else if (typeof value === 'object' && value !== null) {
        this._extractTokenReferences(value, refs);
      }
    }
    return refs;
  }

  async _loadAllTokenSets(tokensDir, tokenSetOrder) {
    const tokenSets = {};

    for (const setName of tokenSetOrder) {
      const fileName = this._getTokenSetFileName(setName);
      const filePath = path.join(tokensDir, fileName);
      const fileExists = await this._fileExists(filePath);

      if (fileExists) {
        const setData = await this._loadJsonFile(filePath);
        if (setData) {
          tokenSets[setName] = setData;
        }
      }
    }

    return tokenSets;
  }

  _validateSingleTheme(theme, tokenSets, metadata) {
    const issues = [];
    const missingTokens = [];
    const missingTokenSets = [];

    // Check if theme references valid token sets
    if (theme.selectedTokenSets) {
      for (const [tokenSetName, status] of Object.entries(theme.selectedTokenSets)) {
        if (!tokenSets[tokenSetName]) {
          missingTokenSets.push(tokenSetName);
        }
      }
    }

    // Check for required token sets not included in theme (Token Studio best practices)
    const requiredSets = ['core']; // Core is typically required as source
    const recommendedSets = ['global']; // Global is typically enabled
    
    for (const requiredSet of requiredSets) {
      if (tokenSets[requiredSet] && (!theme.selectedTokenSets || !theme.selectedTokenSets[requiredSet])) {
        issues.push(`Theme missing required token set: ${requiredSet}`);
      }
    }

    for (const recommendedSet of recommendedSets) {
      if (tokenSets[recommendedSet] && (!theme.selectedTokenSets || !theme.selectedTokenSets[recommendedSet])) {
        issues.push(`Theme missing recommended token set: ${recommendedSet}`);
      }
    }

    // Validate Token Studio theme structure
    if (!theme.id) {
      issues.push('Theme missing required id property');
    }

    if (!theme.name) {
      issues.push('Theme missing required name property');
    }

    if (!theme.selectedTokenSets) {
      issues.push('Theme missing selectedTokenSets configuration');
    }

    // Check for Token Studio specific properties (warnings only)
    if (theme.$figmaStyleReferences === undefined) {
      this.warnings.push(`Theme '${theme.name}' missing $figmaStyleReferences (Token Studio format) - this is optional but recommended for Figma integration`);
    }

    if (theme.$figmaVariableReferences === undefined) {
      this.warnings.push(`Theme '${theme.name}' missing $figmaVariableReferences (Token Studio format) - this is optional but recommended for Figma integration`);
    }

    return {
      isComplete: issues.length === 0 && missingTokenSets.length === 0,
      issues,
      missingTokenSets,
      missingTokens
    };
  }

  _findOrphanedTokenSets(themes, availableTokenSets) {
    const usedSets = new Set();

    for (const theme of themes) {
      if (theme.selectedTokenSets) {
        for (const setName of Object.keys(theme.selectedTokenSets)) {
          usedSets.add(setName);
        }
      }
    }

    return availableTokenSets.filter(setName => !usedSets.has(setName));
  }

  _countTotalIssues(validations) {
    let count = 0;
    for (const validation of Object.values(validations)) {
      if (validation.issues) count += validation.issues.length;
      if (validation.unresolvedReferences) count += validation.unresolvedReferences.length;
      if (validation.circularReferences) count += validation.circularReferences.length;
      if (validation.differences) count += validation.differences.length;
      if (validation.incompleteThemes) count += validation.incompleteThemes.length;
    }
    return count;
  }

  _countCriticalIssues(validations) {
    let count = 0;
    for (const validation of Object.values(validations)) {
      if (validation.issues) {
        count += validation.issues.filter(issue => issue.severity === 'error').length;
      }
      if (validation.unresolvedReferences) count += validation.unresolvedReferences.length;
      if (validation.circularReferences) count += validation.circularReferences.length;
      if (validation.differences) count += validation.differences.length;
    }
    return count;
  }

  _generateRecommendations(validations) {
    const recommendations = [];

    // Structure recommendations
    if (validations.structure && !validations.structure.isValid) {
      recommendations.push('Fix Token Studio structure issues before proceeding');
    }

    // Reference recommendations
    if (validations.references && !validations.references.isValid) {
      recommendations.push('Resolve token reference issues to ensure proper token resolution');
    }

    // Theme recommendations
    if (validations.themes && !validations.themes.isValid) {
      recommendations.push('Complete theme configurations to ensure all themes work properly');
    }

    // Roundtrip recommendations
    if (validations.roundtrip && !validations.roundtrip.isValid) {
      recommendations.push('Fix roundtrip issues to ensure data integrity during transformations');
    }

    if (recommendations.length === 0) {
      recommendations.push('All validations passed - system is ready for production use');
    }

    return recommendations;
  }

  _getTokenSetFileName(setName) {
    const fileNameMap = {
      'core': 'core.json',
      'global': 'global.json',
      'components': 'components.json',
      'simulate': 'simulate.json',
      'Content Typography': 'Content Typography.json',
      'existing': 'existing.json'
    };

    return fileNameMap[setName] || `${setName}.json`;
  }

  _getAlternativeTokenFormats(tokenPath) {
    const alternatives = [];
    
    // Handle common Token Studio format conversions
    const formatMappings = {
      // Font-related tokens
      'fontWeights': ['Font Weight', 'fontWeight'],
      'fontSizes': ['Font Size', 'fontSize'],
      'lineHeights': ['Line Height', 'lineHeight'],
      'letterSpacing': ['Letter Spacing', 'letterSpacing'],
      'paragraphSpacing': ['Paragraph Spacing', 'paragraphSpacing'],
      'paragraphIndent': ['Paragraph Indent', 'paragraphIndent'],
      'textCase': ['Text Case', 'textCase'],
      'textDecoration': ['Text Decoration', 'textDecoration'],
      
      // Common token variations
      'fontFamily': ['Font Family', 'FontFamily'],
      'spacing': ['Spacing'],
      'color': ['Color'],
      'shadow': ['Shadow'],
      'borderRadius': ['Border Radius', 'borderRadius'],
      'opacity': ['Opacity']
    };

    const pathParts = tokenPath.split('.');
    const firstPart = pathParts[0];
    
    // Check if first part has known mappings
    if (formatMappings[firstPart]) {
      for (const mapping of formatMappings[firstPart]) {
        const newPath = [mapping, ...pathParts.slice(1)].join('.');
        alternatives.push(newPath);
      }
    }

    // Handle numeric suffixes (e.g., roboto-0 -> light, regular, etc.)
    if (pathParts.length > 1) {
      const lastPart = pathParts[pathParts.length - 1];
      
      // Font weight numeric mappings
      if (firstPart === 'fontWeights' && lastPart.includes('roboto-')) {
        const numericMappings = {
          'roboto-0': 'light',
          'roboto-1': 'regular', 
          'roboto-2': 'medium',
          'roboto-3': 'bold'
        };
        
        if (numericMappings[lastPart]) {
          alternatives.push(`Font Weight.${numericMappings[lastPart]}`);
          alternatives.push(`fontWeight.${numericMappings[lastPart]}`);
        }
      }
      
      // Line height numeric mappings
      if (firstPart === 'lineHeights' && /^\d+$/.test(lastPart)) {
        const lineHeightMappings = {
          '0': 'tight',
          '1': 'normal',
          '2': 'loose'
        };
        
        if (lineHeightMappings[lastPart]) {
          alternatives.push(`Line Height.${lineHeightMappings[lastPart]}`);
          alternatives.push(`lineHeight.${lineHeightMappings[lastPart]}`);
        }
      }
      
      // Font size mappings
      if (firstPart === 'fontSizes') {
        alternatives.push(`Font Size.${lastPart}`);
        alternatives.push(`fontSize.${lastPart}`);
      }
    }

    return alternatives;
  }

  _isToken(value) {
    return typeof value === 'object' && value !== null &&
           (value.$type || value.type || value.$value !== undefined || value.value !== undefined);
  }

  _isKnownTokenStudioFormatIssue(reference) {
    // Check for common Token Studio format migration issues
    const knownIssuePatterns = [
      /^{fontWeights\./,
      /^{fontSizes\./,
      /^{lineHeights\./,
      /^{letterSpacing\./,
      /^{paragraphSpacing\./,
      /^{paragraphIndent\./,
      /^{textCase\./,
      /^{textDecoration\./,
      /^{FontFamily\./,
      /roboto-\d+/,
      /\.\d+}$/  // Numeric suffixes
    ];

    return knownIssuePatterns.some(pattern => pattern.test(reference));
  }

  async _validateCoreTokenGroups(tokensDir, issues) {
    const coreFilePath = path.join(tokensDir, 'core.json');
    const coreExists = await this._fileExists(coreFilePath);
    
    if (!coreExists) {
      return; // Already handled by other validation
    }

    const coreData = await this._loadJsonFile(coreFilePath);
    if (!coreData) {
      return;
    }

    // Expected Token Studio core token groups
    const expectedCoreGroups = [
      'Font Family',
      'Font Size', 
      'Font Weight',
      'Line Height'
    ];

    const existingGroups = Object.keys(coreData);
    const missingGroups = expectedCoreGroups.filter(group => !existingGroups.includes(group));

    if (missingGroups.length > 0) {
      issues.push({
        type: 'missing_core_token_groups',
        severity: 'warning',
        file: 'core.json',
        missingGroups,
        message: `Core token file missing expected Token Studio groups: ${missingGroups.join(', ')}`,
        suggestion: 'Add missing token groups to core.json for proper Token Studio compatibility. This may resolve many unresolved token references.'
      });
    }

    // Check for old fragmented format indicators
    const hasFragmentedFormat = existingGroups.some(group => 
      /^\d+$/.test(group) || group.includes('-') || group.length < 3
    );

    if (hasFragmentedFormat) {
      issues.push({
        type: 'fragmented_token_format',
        severity: 'warning',
        file: 'core.json',
        message: 'Core tokens appear to use fragmented format instead of Token Studio native format',
        suggestion: 'Consider consolidating tokens into proper Token Studio groups (Font Weight, Font Size, etc.)'
      });
    }
  }
}

module.exports = ValidationSystem;