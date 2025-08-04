/**
 * ModularEditingManager - Manages modular token editing support
 * 
 * This class provides:
 * - Real-time validation for token file editing
 * - Token reference resolution system
 * - Syntax validation for Token Studio format
 * - Support for preserving token metadata and descriptions
 * - Editing session management for AI tools
 * 
 * Requirements addressed: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ModularEditingManager extends EventEmitter {
  constructor(tokensDir) {
    super();
    this.tokensDir = tokensDir;
    this.errors = [];
    this.warnings = [];
    this.activeSessions = new Map();
    this.watchedFiles = new Map();
    this.tokenCache = new Map();
    this.referenceGraph = new Map();
  }

  /**
   * Initialize editing session for AI tools
   * @param {string} sessionId - Unique session identifier
   * @param {object} options - Session configuration options
   * @returns {Promise<{success: boolean, session: object, errors: string[]}>}
   */
  async initializeEditingSession(sessionId, options = {}) {
    this.errors = [];
    this.warnings = [];

    try {
      // Validate tokens directory exists and is properly structured
      const structureValidation = await this._validateTokensStructure();
      if (!structureValidation.isValid) {
        this.errors.push('Invalid tokens directory structure');
        this.errors.push(...structureValidation.errors);
        return { success: false, session: null, errors: this.errors };
      }

      // Load all token data and build reference graph
      await this._loadTokenData();
      await this._buildReferenceGraph();

      // Create editing session
      const session = {
        id: sessionId,
        startTime: new Date().toISOString(),
        options: {
          autoValidate: options.autoValidate !== false,
          preserveMetadata: options.preserveMetadata !== false,
          trackChanges: options.trackChanges !== false,
          ...options
        },
        changes: [],
        validationResults: {},
        status: 'active'
      };

      this.activeSessions.set(sessionId, session);

      // Set up file watching if enabled
      if (session.options.autoValidate) {
        await this._setupFileWatching(sessionId);
      }

      this.emit('sessionStarted', { sessionId, session });

      return {
        success: true,
        session,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Failed to initialize editing session: ${error.message}`);
      return { success: false, session: null, errors: this.errors };
    }
  }

  /**
   * Validate token file in real-time
   * @param {string} filePath - Path to token file to validate
   * @param {string} sessionId - Optional session ID for context
   * @returns {Promise<{isValid: boolean, issues: object[], suggestions: string[]}>}
   */
  async validateTokenFile(filePath, sessionId = null) {
    this.errors = [];
    this.warnings = [];
    const issues = [];
    const suggestions = [];

    try {
      // Check if file exists
      const fileExists = await this._fileExists(filePath);
      if (!fileExists) {
        issues.push({
          type: 'file_not_found',
          severity: 'error',
          message: `Token file not found: ${filePath}`,
          suggestion: 'Ensure the file path is correct and the file exists'
        });
        return { isValid: false, issues, suggestions };
      }

      // Load and parse file content
      const content = await this._loadTokenFile(filePath);
      if (!content) {
        return { 
          isValid: false, 
          issues, 
          suggestions,
          errors: this.errors || [],
          warnings: this.warnings || []
        };
      }

      // Validate Token Studio format syntax
      const syntaxValidation = this._validateTokenStudioSyntax(content, filePath);
      issues.push(...syntaxValidation.issues);

      // Validate token references
      const referenceValidation = await this._validateTokenReferences(content, filePath);
      issues.push(...referenceValidation.issues);

      // Validate metadata preservation
      const metadataValidation = this._validateMetadataPreservation(content, filePath);
      issues.push(...metadataValidation.issues);

      // Generate suggestions for improvements
      const improvementSuggestions = this._generateImprovementSuggestions(content, issues);
      suggestions.push(...improvementSuggestions);

      // Update session if provided
      if (sessionId && this.activeSessions.has(sessionId)) {
        const session = this.activeSessions.get(sessionId);
        session.validationResults[filePath] = {
          timestamp: new Date().toISOString(),
          isValid: issues.filter(i => i.severity === 'error').length === 0,
          issues,
          suggestions
        };
      }

      const errorCount = issues.filter(issue => issue.severity === 'error').length;
      
      return {
        isValid: errorCount === 0,
        issues,
        suggestions,
        errors: this.errors || [],
        warnings: this.warnings || []
      };

    } catch (error) {
      this.errors.push(`Token file validation failed: ${error.message}`);
      return {
        isValid: false,
        issues: [{
          type: 'validation_error',
          severity: 'error',
          message: `Validation failed: ${error.message}`,
          suggestion: 'Check file format and permissions'
        }],
        suggestions,
        errors: this.errors || [],
        warnings: this.warnings || []
      };
    }
  }

  /**
   * Resolve token reference to its value
   * @param {string} reference - Token reference (e.g., "{color.primary}")
   * @param {string} contextFile - File where reference is used (for relative resolution)
   * @returns {Promise<{resolved: boolean, value: any, path: string[], errors: string[]}>}
   */
  async resolveTokenReference(reference, contextFile = null) {
    this.errors = [];

    try {
      // Parse reference format
      const parsedRef = this._parseTokenReference(reference);
      if (!parsedRef.isValid) {
        this.errors.push(`Invalid reference format: ${reference}`);
        return { resolved: false, value: null, path: [], errors: this.errors };
      }

      // Search through token cache
      const resolution = await this._resolveReferenceInCache(parsedRef.path, contextFile);
      
      if (resolution.found) {
        return {
          resolved: true,
          value: resolution.value,
          path: resolution.fullPath,
          tokenSet: resolution.tokenSet,
          errors: this.errors
        };
      }

      // If not found in cache, try loading fresh data
      await this._loadTokenData();
      const freshResolution = await this._resolveReferenceInCache(parsedRef.path, contextFile);
      
      if (freshResolution.found) {
        return {
          resolved: true,
          value: freshResolution.value,
          path: freshResolution.fullPath,
          tokenSet: freshResolution.tokenSet,
          errors: this.errors
        };
      }

      this.errors.push(`Token reference not found: ${reference}`);
      return { resolved: false, value: null, path: parsedRef.path, errors: this.errors };

    } catch (error) {
      this.errors.push(`Reference resolution failed: ${error.message}`);
      return { resolved: false, value: null, path: [], errors: this.errors };
    }
  }

  /**
   * Validate Token Studio format syntax
   * @param {object} tokenData - Token data to validate
   * @param {string} filePath - File path for context
   * @returns {{isValid: boolean, issues: object[]}}
   */
  validateTokenStudioSyntax(tokenData, filePath) {
    return this._validateTokenStudioSyntax(tokenData, filePath);
  }

  /**
   * Preserve token metadata during editing
   * @param {object} originalToken - Original token data
   * @param {object} editedToken - Edited token data
   * @returns {object} Token with preserved metadata
   */
  preserveTokenMetadata(originalToken, editedToken) {
    const preserved = { ...editedToken };

    // Preserve description
    if (originalToken.$description && !preserved.$description) {
      preserved.$description = originalToken.$description;
    }
    if (originalToken.description && !preserved.description && !preserved.$description) {
      preserved.$description = originalToken.description;
    }

    // Preserve extensions
    if (originalToken.$extensions) {
      preserved.$extensions = { ...originalToken.$extensions, ...preserved.$extensions };
    }

    // Preserve Figma references
    if (originalToken.$figmaStyleReferences) {
      preserved.$figmaStyleReferences = originalToken.$figmaStyleReferences;
    }
    if (originalToken.$figmaVariableReferences) {
      preserved.$figmaVariableReferences = originalToken.$figmaVariableReferences;
    }

    return preserved;
  }

  /**
   * Track changes made during editing session
   * @param {string} sessionId - Session identifier
   * @param {string} filePath - File that was changed
   * @param {object} change - Change details
   * @returns {Promise<{success: boolean, errors: string[]}>}
   */
  async trackChange(sessionId, filePath, change) {
    this.errors = [];

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.errors.push(`Session not found: ${sessionId}`);
        return { success: false, errors: this.errors };
      }

      const changeRecord = {
        timestamp: new Date().toISOString(),
        filePath,
        type: change.type || 'unknown',
        details: change,
        sessionId
      };

      session.changes.push(changeRecord);

      // Emit change event
      this.emit('tokenChanged', changeRecord);

      // Auto-validate if enabled
      if (session.options.autoValidate) {
        await this.validateTokenFile(filePath, sessionId);
      }

      return { success: true, errors: this.errors };

    } catch (error) {
      this.errors.push(`Failed to track change: ${error.message}`);
      return { success: false, errors: this.errors };
    }
  }

  /**
   * Finalize editing session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<{success: boolean, summary: object, errors: string[]}>}
   */
  async finalizeEditingSession(sessionId) {
    this.errors = [];
    this.warnings = [];

    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.errors.push(`Session not found: ${sessionId}`);
        return { success: false, summary: null, errors: this.errors };
      }

      // Final validation of all changed files
      const finalValidation = await this._performFinalValidation(session);

      // Generate session summary
      const summary = {
        sessionId,
        duration: new Date() - new Date(session.startTime),
        changesCount: session.changes.length,
        filesModified: [...new Set(session.changes.map(c => c.filePath))],
        validationResults: finalValidation,
        status: finalValidation.isValid ? 'completed' : 'completed_with_issues'
      };

      // Clean up session
      session.status = 'finalized';
      session.endTime = new Date().toISOString();
      
      // Stop file watching
      await this._stopFileWatching(sessionId);

      // Remove from active sessions immediately in test environment
      if (process.env.NODE_ENV === 'test') {
        this.activeSessions.delete(sessionId);
      } else {
        // Remove from active sessions after a delay (for potential cleanup)
        setTimeout(() => {
          this.activeSessions.delete(sessionId);
        }, 60000); // Keep for 1 minute for potential queries
      }

      this.emit('sessionFinalized', { sessionId, summary });

      return {
        success: true,
        summary,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Failed to finalize session: ${error.message}`);
      return { success: false, summary: null, errors: this.errors };
    }
  }

  /**
   * Get editing session information
   * @param {string} sessionId - Session identifier
   * @returns {object|null} Session information or null if not found
   */
  getSessionInfo(sessionId) {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * List all active editing sessions
   * @returns {object[]} Array of active sessions
   */
  listActiveSessions() {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up all active sessions and resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Stop all file watching
    for (const sessionId of this.activeSessions.keys()) {
      await this._stopFileWatching(sessionId);
    }
    
    // Clear all sessions
    this.activeSessions.clear();
    
    // Clear caches
    this.tokenCache.clear();
    this.referenceGraph.clear();
    this.watchedFiles.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  // Private helper methods

  async _validateTokensStructure() {
    try {
      const FileStructureManager = require('./FileStructureManager');
      const structureManager = new FileStructureManager();
      return await structureManager.validateStructure(this.tokensDir);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Structure validation failed: ${error.message}`]
      };
    }
  }

  async _loadTokenData() {
    try {
      this.tokenCache.clear();

      // Load metadata to get token set order
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = await this._loadJsonFile(metadataPath);
      
      if (!metadata || !metadata.tokenSetOrder) {
        throw new Error('Invalid or missing metadata');
      }

      // Load each token set
      for (const setName of metadata.tokenSetOrder) {
        const fileName = this._getTokenSetFileName(setName);
        const filePath = path.join(this.tokensDir, fileName);
        
        if (await this._fileExists(filePath)) {
          const tokenData = await this._loadJsonFile(filePath);
          if (tokenData) {
            this.tokenCache.set(setName, {
              data: tokenData,
              filePath,
              lastModified: new Date()
            });
          }
        }
      }

    } catch (error) {
      this.errors.push(`Failed to load token data: ${error.message}`);
    }
  }

  async _buildReferenceGraph() {
    this.referenceGraph.clear();

    for (const [setName, setInfo] of this.tokenCache.entries()) {
      const references = this._extractReferences(setInfo.data, setName);
      this.referenceGraph.set(setName, references);
    }
  }

  _extractReferences(obj, setName, path = '') {
    const references = [];

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string' && this._isTokenReference(value)) {
        references.push({
          from: currentPath,
          to: value,
          setName
        });
      } else if (typeof value === 'object' && value !== null) {
        if (this._isToken(value)) {
          const tokenValue = value.$value || value.value;
          if (typeof tokenValue === 'string' && this._isTokenReference(tokenValue)) {
            references.push({
              from: currentPath,
              to: tokenValue,
              setName
            });
          }
        } else {
          references.push(...this._extractReferences(value, setName, currentPath));
        }
      }
    }

    return references;
  }

  async _setupFileWatching(sessionId) {
    // Note: In a real implementation, you would use fs.watch or chokidar
    // For now, we'll implement a polling-based approach
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Skip file watching in test environment to prevent hanging
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // This is a simplified implementation - in production you'd use proper file watching
    session.watchInterval = setInterval(async () => {
      try {
        await this._checkForFileChanges(sessionId);
      } catch (error) {
        // Ignore errors in file watching to prevent crashes
      }
    }, 1000); // Check every second
  }

  async _stopFileWatching(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session && session.watchInterval) {
      clearInterval(session.watchInterval);
      delete session.watchInterval;
    }
  }

  async _checkForFileChanges(sessionId) {
    // Simplified file change detection
    // In production, use proper file system events
    try {
      for (const [setName, setInfo] of this.tokenCache.entries()) {
        const stats = await fs.stat(setInfo.filePath);
        if (stats.mtime > setInfo.lastModified) {
          // File was modified
          await this.validateTokenFile(setInfo.filePath, sessionId);
          setInfo.lastModified = stats.mtime;
        }
      }
    } catch (error) {
      // Ignore errors in file watching
    }
  }

  _validateTokenStudioSyntax(tokenData, filePath) {
    const issues = [];

    try {
      this._validateTokenStructureRecursive(tokenData, '', filePath, issues);

      return {
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        issues
      };

    } catch (error) {
      issues.push({
        type: 'syntax_validation_error',
        severity: 'error',
        file: filePath,
        message: `Syntax validation failed: ${error.message}`,
        suggestion: 'Check token structure and format'
      });

      return { isValid: false, issues };
    }
  }

  _validateTokenStructureRecursive(obj, path, filePath, issues) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (this._isToken(value)) {
        // Validate token structure
        if (!value.$type && !value.type) {
          issues.push({
            type: 'missing_token_type',
            severity: 'warning',
            file: filePath,
            path: currentPath,
            message: `Token missing $type property: ${currentPath}`,
            suggestion: 'Add $type property to specify token type (color, dimension, typography, etc.)'
          });
        }

        if (value.$value === undefined && value.value === undefined) {
          issues.push({
            type: 'missing_token_value',
            severity: 'error',
            file: filePath,
            path: currentPath,
            message: `Token missing $value property: ${currentPath}`,
            suggestion: 'Add $value property with token value or reference'
          });
        }

        // Validate token value format
        const tokenValue = value.$value || value.value;
        if (tokenValue !== undefined) {
          const tokenType = value.$type || value.type;
          const valueValidation = this._validateTokenValue(tokenValue, tokenType, currentPath);
          if (!valueValidation.isValid) {
            issues.push({
              type: 'invalid_token_value',
              severity: 'error',
              file: filePath,
              path: currentPath,
              message: valueValidation.message,
              suggestion: valueValidation.suggestion
            });
          }
        }

      } else if (typeof value === 'object' && value !== null) {
        // Recursively validate nested objects
        this._validateTokenStructureRecursive(value, currentPath, filePath, issues);
      }
    }
  }

  _validateTokenValue(value, type, path) {
    if (typeof value === 'string' && this._isTokenReference(value)) {
      // Reference values are validated separately
      return { isValid: true };
    }

    switch (type) {
      case 'color':
        return this._validateColorValue(value, path);
      case 'dimension':
        return this._validateDimensionValue(value, path);
      case 'typography':
        return this._validateTypographyValue(value, path);
      default:
        return { isValid: true }; // Unknown types are allowed
    }
  }

  _validateColorValue(value, path) {
    if (typeof value !== 'string') {
      return {
        isValid: false,
        message: `Color value must be a string: ${path}`,
        suggestion: 'Use hex, rgb, rgba, or named color format'
      };
    }

    // Basic color format validation
    const colorFormats = [
      /^#[0-9a-fA-F]{3,8}$/, // Hex
      /^rgba?\([^)]+\)$/, // RGB/RGBA
      /^hsla?\([^)]+\)$/, // HSL/HSLA
    ];

    const isValidFormat = colorFormats.some(format => format.test(value));
    
    if (!isValidFormat && !this._isNamedColor(value)) {
      return {
        isValid: false,
        message: `Invalid color format: ${value}`,
        suggestion: 'Use valid color format (hex, rgb, rgba, hsl, hsla, or named color)'
      };
    }

    return { isValid: true };
  }

  _validateDimensionValue(value, path) {
    if (typeof value === 'number') {
      return { isValid: true };
    }

    if (typeof value === 'string') {
      const dimensionPattern = /^\d+(\.\d+)?(px|rem|em|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax)$/;
      if (dimensionPattern.test(value)) {
        return { isValid: true };
      }
    }

    return {
      isValid: false,
      message: `Invalid dimension value: ${value}`,
      suggestion: 'Use number or string with valid unit (px, rem, em, %, etc.)'
    };
  }

  _validateTypographyValue(value, path) {
    if (typeof value !== 'object' || value === null) {
      return {
        isValid: false,
        message: `Typography value must be an object: ${path}`,
        suggestion: 'Use object with fontFamily, fontSize, fontWeight, etc.'
      };
    }

    // Check for required typography properties
    const requiredProps = ['fontFamily'];
    const missingProps = requiredProps.filter(prop => !value[prop]);
    
    if (missingProps.length > 0) {
      return {
        isValid: false,
        message: `Typography missing required properties: ${missingProps.join(', ')}`,
        suggestion: 'Add required typography properties'
      };
    }

    return { isValid: true };
  }

  _isNamedColor(value) {
    const namedColors = [
      'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
      'gray', 'grey', 'darkgray', 'darkgrey', 'lightgray', 'lightgrey'
    ];
    return namedColors.includes(value.toLowerCase());
  }

  async _validateTokenReferences(tokenData, filePath) {
    const issues = [];

    try {
      const references = this._extractReferences(tokenData, path.basename(filePath, '.json'));

      for (const ref of references) {
        const resolution = await this.resolveTokenReference(ref.to, filePath);
        
        if (!resolution.resolved) {
          issues.push({
            type: 'unresolved_reference',
            severity: 'error',
            file: filePath,
            path: ref.from,
            reference: ref.to,
            message: `Unresolved token reference: ${ref.to}`,
            suggestion: 'Check if the referenced token exists and is properly defined'
          });
        }
      }

      return { isValid: issues.length === 0, issues };

    } catch (error) {
      issues.push({
        type: 'reference_validation_error',
        severity: 'error',
        file: filePath,
        message: `Reference validation failed: ${error.message}`,
        suggestion: 'Check token references and structure'
      });

      return { isValid: false, issues };
    }
  }

  _validateMetadataPreservation(tokenData, filePath) {
    const issues = [];

    // Check for tokens that might be missing descriptions
    this._checkMissingDescriptions(tokenData, '', filePath, issues);

    return { isValid: true, issues }; // Metadata preservation is non-blocking
  }

  _checkMissingDescriptions(obj, path, filePath, issues) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (this._isToken(value)) {
        if (!value.$description && !value.description) {
          issues.push({
            type: 'missing_description',
            severity: 'info',
            file: filePath,
            path: currentPath,
            message: `Token missing description: ${currentPath}`,
            suggestion: 'Add $description property to document token purpose'
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        this._checkMissingDescriptions(value, currentPath, filePath, issues);
      }
    }
  }

  _generateImprovementSuggestions(tokenData, issues) {
    const suggestions = [];

    // Analyze issues and generate actionable suggestions
    const errorTypes = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});

    if (errorTypes.missing_token_type > 0) {
      suggestions.push('Consider adding $type properties to improve token validation and tooling support');
    }

    if (errorTypes.unresolved_reference > 0) {
      suggestions.push('Review token references to ensure all referenced tokens exist');
    }

    if (errorTypes.missing_description > 0) {
      suggestions.push('Add descriptions to tokens to improve documentation and maintainability');
    }

    return suggestions;
  }

  async _performFinalValidation(session) {
    const results = {
      isValid: true,
      fileResults: {},
      summary: {
        totalFiles: 0,
        validFiles: 0,
        filesWithIssues: 0,
        totalIssues: 0
      }
    };

    // Get unique files that were modified
    const modifiedFiles = [...new Set(session.changes.map(c => c.filePath))];

    for (const filePath of modifiedFiles) {
      const validation = await this.validateTokenFile(filePath, session.id);
      results.fileResults[filePath] = validation;
      results.summary.totalFiles++;

      if (validation.isValid) {
        results.summary.validFiles++;
      } else {
        results.summary.filesWithIssues++;
        results.isValid = false;
      }

      results.summary.totalIssues += validation.issues.length;
    }

    return results;
  }

  async _loadTokenFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.errors = this.errors || [];
      this.errors.push(`Failed to load token file ${filePath}: ${error.message}`);
      return null;
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

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  _parseTokenReference(reference) {
    try {
      if (typeof reference !== 'string' || !reference.includes('{') || !reference.includes('}')) {
        return { isValid: false, path: [] };
      }

      const tokenPath = reference.replace(/[{}]/g, '');
      const pathParts = tokenPath.split('.');

      return {
        isValid: pathParts.length > 0 && pathParts.every(part => part.length > 0),
        path: pathParts,
        original: reference
      };

    } catch (error) {
      return { isValid: false, path: [] };
    }
  }

  async _resolveReferenceInCache(pathParts, contextFile) {
    // Search through all token sets in cache
    for (const [setName, setInfo] of this.tokenCache.entries()) {
      const result = this._findTokenInObject(setInfo.data, pathParts);
      if (result) {
        return {
          found: true,
          value: result,
          fullPath: pathParts,
          tokenSet: setName
        };
      }
    }

    return { found: false };
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

  _isTokenReference(value) {
    return typeof value === 'string' && value.includes('{') && value.includes('}');
  }

  _isToken(value) {
    return typeof value === 'object' && value !== null && 
           (value.$type || value.type || value.$value !== undefined || value.value !== undefined || 
            value.$description || value.description || value.$extensions);
  }

  _getTokenSetFileName(setName) {
    const mapping = {
      'core': 'core.json',
      'global': 'global.json',
      'components': 'components.json',
      'simulate': 'simulate.json',
      'Content Typography': 'Content Typography.json',
      'existing': 'existing.json'
    };
    
    return mapping[setName] || `${setName}.json`;
  }
}

module.exports = ModularEditingManager;