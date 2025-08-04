/**
 * TokenTransformationEngine - Core transformation engine for Token Studio format conversion
 * 
 * This class handles the bidirectional transformation between:
 * - tokensource.json (Token Studio's native format)
 * - Modular Token Studio files ($metadata.json, $themes.json, individual token files)
 * 
 * Requirements addressed: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3
 */

const fs = require('fs').promises;
const path = require('path');
const ErrorHandlingSystem = require('./ErrorHandlingSystem');

class TokenTransformationEngine {
  constructor(options = {}) {
    this.errors = [];
    this.warnings = [];
    this.errorHandler = new ErrorHandlingSystem({
      backupDir: options.backupDir || '.backups',
      debugMode: options.debugMode || false
    });
  }

  /**
   * Split tokensource.json into Token Studio modular format
   * @param {string} sourcePath - Path to tokensource.json
   * @param {string} outputDir - Output directory for modular files
   * @returns {Promise<{success: boolean, files: string[], errors: string[]}>}
   */
  async splitSourceToTokens(sourcePath, outputDir) {
    this.errors = [];
    this.warnings = [];
    const createdFiles = [];
    const operationId = this.errorHandler.startOperation('split', { sourcePath, outputDir });

    try {
      // Create backup before operation
      const backupResult = await this.errorHandler.createOperationBackup('split', [sourcePath], {
        operation: 'splitSourceToTokens',
        targetDir: outputDir
      });

      if (!backupResult.success) {
        this.warnings.push(`Backup creation failed: ${backupResult.errors.join(', ')}`);
      }

      // Validate source file exists
      const sourceData = await this._readSourceFile(sourcePath);
      if (!sourceData) {
        await this.errorHandler.completeOperation(operationId, { success: false });
        
        // Generate error report with suggestions
        const errorReport = await this.errorHandler.generateErrorReport(
          new Error(`Failed to read source file: ${sourcePath}`),
          { operation: 'split', sourcePath, outputDir }
        );
        
        return { 
          success: false, 
          files: [], 
          errors: this.errors, 
          backupId: backupResult.backupId,
          errorReport: errorReport.report,
          suggestions: errorReport.suggestions
        };
      }

      // Ensure output directory exists
      await this._ensureDirectory(outputDir);

      // Check if source is already in modular format (has $metadata and $themes)
      if (sourceData.$metadata && sourceData.$themes) {
        // Source is already modular, just extract individual files
        return await this._extractModularFiles(sourceData, outputDir);
      }

      // Generate $metadata.json
      const metadataFile = await this._generateMetadata(sourceData, outputDir);
      if (metadataFile) createdFiles.push(metadataFile);

      // Generate $themes.json
      const themesFile = await this._generateThemes(sourceData, outputDir);
      if (themesFile) createdFiles.push(themesFile);

      // Generate individual token set files
      const tokenFiles = await this._generateTokenFiles(sourceData, outputDir);
      createdFiles.push(...tokenFiles);

      const result = {
        success: this.errors.length === 0,
        files: createdFiles,
        errors: this.errors,
        warnings: this.warnings,
        backupId: backupResult.backupId
      };

      await this.errorHandler.completeOperation(operationId, result);
      return result;

    } catch (error) {
      this.errors.push(`Unexpected error during split operation: ${error.message}`);
      
      // Generate detailed error report
      const errorReport = await this.errorHandler.generateErrorReport(error, {
        operationType: 'split',
        sourcePath,
        outputDir,
        operationId
      });

      const result = { 
        success: false, 
        files: createdFiles, 
        errors: this.errors,
        errorReport: errorReport.report,
        suggestions: errorReport.suggestions
      };

      await this.errorHandler.completeOperation(operationId, result);
      return result;
    }
  }

  /**
   * Consolidate modular Token Studio files back to tokensource.json
   * @param {string} tokensDir - Directory containing modular token files
   * @param {string} outputPath - Output path for consolidated tokensource.json
   * @returns {Promise<{success: boolean, tokensCount: number, errors: string[]}>}
   */
  async consolidateToSource(tokensDir, outputPath) {
    this.errors = [];
    this.warnings = [];
    let tokensCount = 0;
    const operationId = this.errorHandler.startOperation('consolidate', { tokensDir, outputPath });

    try {
      // Create backup before operation
      const backupPaths = [tokensDir];
      if (await this._fileExists(outputPath)) {
        backupPaths.push(outputPath);
      }

      const backupResult = await this.errorHandler.createOperationBackup('consolidate', backupPaths, {
        operation: 'consolidateToSource',
        outputPath
      });

      if (!backupResult.success) {
        this.warnings.push(`Backup creation failed: ${backupResult.errors.join(', ')}`);
      }
      // Read metadata to understand token set structure
      const metadata = await this._readMetadata(tokensDir);
      if (!metadata) {
        // Generate error report with suggestions
        const errorReport = await this.errorHandler.generateErrorReport(
          new Error(`Failed to read metadata from: ${tokensDir}`),
          { operation: 'consolidate', tokensDir, outputPath }
        );
        
        return { 
          success: false, 
          tokensCount: 0, 
          errors: this.errors,
          errorReport: errorReport.report,
          suggestions: errorReport.suggestions
        };
      }

      // Read themes configuration
      const themes = await this._readThemes(tokensDir);

      // Read all token set files
      const tokenSets = await this._readTokenSets(tokensDir, metadata.tokenSetOrder);
      
      // Consolidate into single source structure
      const consolidatedSource = await this._consolidateTokenSets(tokenSets, themes, metadata);
      
      // Count tokens for reporting
      tokensCount = this._countTokens(consolidatedSource);

      // Write consolidated source
      await this._writeSourceFile(consolidatedSource, outputPath);

      const result = {
        success: this.errors.length === 0,
        tokensCount,
        errors: this.errors,
        warnings: this.warnings,
        backupId: backupResult.backupId
      };

      await this.errorHandler.completeOperation(operationId, result);
      return result;

    } catch (error) {
      this.errors.push(`Unexpected error during consolidation: ${error.message}`);
      
      // Generate detailed error report
      const errorReport = await this.errorHandler.generateErrorReport(error, {
        operationType: 'consolidate',
        tokensDir,
        outputPath,
        operationId
      });

      const result = { 
        success: false, 
        tokensCount, 
        errors: this.errors,
        errorReport: errorReport.report,
        suggestions: errorReport.suggestions
      };

      await this.errorHandler.completeOperation(operationId, result);
      return result;
    }
  }

  /**
   * Validate transformation integrity by testing roundtrip conversion
   * @param {string} originalSource - Path to original tokensource.json
   * @param {string} reconstitutedSource - Path to reconstituted tokensource.json
   * @returns {Promise<{isValid: boolean, differences: object[], warnings: string[]}>}
   */
  async validateTransformation(originalSource, reconstitutedSource) {
    this.errors = [];
    this.warnings = [];
    const differences = [];

    try {
      const original = await this._readSourceFile(originalSource);
      const reconstituted = await this._readSourceFile(reconstitutedSource);

      if (!original || !reconstituted) {
        return { isValid: false, differences: [], warnings: this.warnings };
      }

      // Deep comparison of token structures
      this._compareTokenStructures(original, reconstituted, '', differences);

      // Validate token references are preserved
      this._validateTokenReferences(original, reconstituted, differences);

      // Check metadata preservation
      this._validateMetadataPreservation(original, reconstituted, differences);

      return {
        isValid: differences.length === 0,
        differences,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Validation error: ${error.message}`);
      return { isValid: false, differences, warnings: this.warnings };
    }
  }

  // Private helper methods

  async _extractModularFiles(sourceData, outputDir) {
    const createdFiles = [];
    
    try {
      // Extract and write $metadata.json
      if (sourceData.$metadata) {
        const metadataPath = path.join(outputDir, '$metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(sourceData.$metadata, null, 2));
        createdFiles.push(metadataPath);
      }

      // Extract and write $themes.json
      if (sourceData.$themes) {
        const themesPath = path.join(outputDir, '$themes.json');
        await fs.writeFile(themesPath, JSON.stringify(sourceData.$themes, null, 2));
        createdFiles.push(themesPath);
      }

      // Extract individual token sets
      const tokenSetOrder = sourceData.$metadata?.tokenSetOrder || [];
      
      for (const setName of tokenSetOrder) {
        if (sourceData[setName]) {
          const fileName = this._getTokenSetFileName(setName);
          const filePath = path.join(outputDir, fileName);
          await fs.writeFile(filePath, JSON.stringify(sourceData[setName], null, 2));
          createdFiles.push(filePath);
        }
      }

      // Handle any additional token sets not in the order
      for (const [key, value] of Object.entries(sourceData)) {
        if (key !== '$metadata' && key !== '$themes' && !tokenSetOrder.includes(key)) {
          if (this._isTokenSet(value)) {
            const fileName = this._getTokenSetFileName(key);
            const filePath = path.join(outputDir, fileName);
            await fs.writeFile(filePath, JSON.stringify(value, null, 2));
            createdFiles.push(filePath);
          }
        }
      }

      return {
        success: this.errors.length === 0,
        files: createdFiles,
        errors: this.errors,
        warnings: this.warnings
      };

    } catch (error) {
      this.errors.push(`Failed to extract modular files: ${error.message}`);
      return { success: false, files: createdFiles, errors: this.errors };
    }
  }

  async _readSourceFile(sourcePath) {
    let content;
    try {
      content = await fs.readFile(sourcePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to read source file ${sourcePath}: ${error.message}`);
      
      // Log the error using the error handling system
      await this.errorHandler.generateErrorReport(error, {
        operation: 'readSourceFile',
        sourcePath,
        fileContent: content ? content.substring(0, 100) + '...' : 'Unable to read content'
      });
      
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

  async _generateMetadata(sourceData, outputDir) {
    try {
      // Extract token set order from source structure
      const tokenSetOrder = this._extractTokenSetOrder(sourceData);
      
      const metadata = {
        tokenSetOrder
      };

      const metadataPath = path.join(outputDir, '$metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      return metadataPath;
    } catch (error) {
      this.errors.push(`Failed to generate metadata: ${error.message}`);
      return null;
    }
  }

  async _generateThemes(sourceData, outputDir) {
    try {
      // Extract theme configurations from source
      const themes = this._extractThemes(sourceData);
      
      const themesPath = path.join(outputDir, '$themes.json');
      await fs.writeFile(themesPath, JSON.stringify(themes, null, 2));
      
      return themesPath;
    } catch (error) {
      this.errors.push(`Failed to generate themes: ${error.message}`);
      return null;
    }
  }

  async _generateTokenFiles(sourceData, outputDir) {
    const createdFiles = [];
    
    try {
      // Identify token sets from source structure
      const tokenSets = this._identifyTokenSets(sourceData);
      
      for (const [setName, tokens] of Object.entries(tokenSets)) {
        const fileName = this._getTokenSetFileName(setName);
        const filePath = path.join(outputDir, fileName);
        
        // Convert to Token Studio format with $type and $value
        const tokenStudioFormat = this._convertToTokenStudioFormat(tokens);
        
        await fs.writeFile(filePath, JSON.stringify(tokenStudioFormat, null, 2));
        createdFiles.push(filePath);
      }
      
      return createdFiles;
    } catch (error) {
      this.errors.push(`Failed to generate token files: ${error.message}`);
      return createdFiles;
    }
  }

  _extractTokenSetOrder(sourceData) {
    // If metadata already exists, use it
    if (sourceData.$metadata && sourceData.$metadata.tokenSetOrder) {
      return sourceData.$metadata.tokenSetOrder;
    }
    
    // For Token Studio native format, always use the standard order
    // This ensures compatibility with Token Studio's expected structure
    const tokenSets = this._identifyTokenSets(sourceData);
    const standardOrder = ['core', 'global', 'components', 'simulate', 'Content Typography'];
    const result = [];
    
    // Add standard sets that exist in the identified token sets
    for (const setName of standardOrder) {
      if (tokenSets[setName]) {
        result.push(setName);
      }
    }
    
    // Add any additional sets that were identified but not in standard order
    for (const setName of Object.keys(tokenSets)) {
      if (!standardOrder.includes(setName)) {
        result.push(setName);
      }
    }
    
    return result;
  }

  _extractThemes(sourceData) {
    // If themes already exist, use them
    if (sourceData.$themes) {
      return sourceData.$themes;
    }
    
    // Default theme structure matching Token Studio native format
    const tokenSets = this._identifyTokenSets(sourceData);
    const selectedTokenSets = {};
    
    // Configure token sets based on what exists
    if (tokenSets.core) selectedTokenSets.core = "source";
    if (tokenSets.global) selectedTokenSets.global = "enabled";
    if (tokenSets.components) selectedTokenSets.components = "enabled";
    if (tokenSets.simulate) selectedTokenSets.simulate = "enabled";
    if (tokenSets['Content Typography']) selectedTokenSets['Content Typography'] = "enabled";
    
    // Add any additional token sets that were created
    for (const setName of Object.keys(tokenSets)) {
      if (!selectedTokenSets[setName] && !['core', 'global', 'components', 'simulate', 'Content Typography'].includes(setName)) {
        selectedTokenSets[setName] = "enabled";
      }
    }
    
    const themes = [
      {
        id: "aecc06453ea91e02360e6aa523b957cfb99005e7",
        name: "Base",
        selectedTokenSets,
        $figmaStyleReferences: {},
        $figmaVariableReferences: {}
      },
      {
        id: "880911ad44df50369d488cf03571c1ae85c4bf5c",
        name: "Simulate",
        selectedTokenSets: {
          core: "source",
          global: "enabled",
          simulate: "enabled"
        },
        $figmaStyleReferences: {},
        $figmaVariableReferences: {}
      }
    ];
    
    return themes;
  }

  _identifyTokenSets(sourceData) {
    const tokenSets = {};
    
    // Core tokens - foundation colors, typography, spacing
    const coreTokens = {};
    if (sourceData['Color Ramp']) {
      coreTokens['Color Ramp'] = sourceData['Color Ramp'];
    }
    if (sourceData.typography) {
      coreTokens.typography = sourceData.typography;
    }
    if (sourceData.spacing) {
      coreTokens.spacing = sourceData.spacing;
    }
    if (Object.keys(coreTokens).length > 0) {
      tokenSets.core = coreTokens;
    }
    
    // Global tokens - semantic tokens
    const globalTokens = {};
    const globalKeys = ['color', 'dark', 'light', 'header', 'body', 'label', 'opacity', 'borderRadius', 'borderWidth'];
    for (const key of globalKeys) {
      if (sourceData[key]) {
        globalTokens[key] = sourceData[key];
      }
    }
    if (Object.keys(globalTokens).length > 0) {
      tokenSets.global = globalTokens;
    }
    
    // Brand-specific tokens
    const simulateTokens = {};
    const simulateKeys = ['appBackground', 'brand', 'surface', 'content', 'primary', 'secondary'];
    for (const key of simulateKeys) {
      if (sourceData[key]) {
        simulateTokens[key] = sourceData[key];
      }
    }
    if (Object.keys(simulateTokens).length > 0) {
      tokenSets.simulate = simulateTokens;
    }
    
    // Component tokens - buttons, form elements, etc.
    const componentTokens = {};
    const componentKeys = ['button', 'CTA', 'FontFamily'];
    for (const key of componentKeys) {
      if (sourceData[key]) {
        componentTokens[key] = sourceData[key];
      }
    }
    if (Object.keys(componentTokens).length > 0) {
      tokenSets.components = componentTokens;
    }
    
    // Handle any remaining top-level groups
    const processedKeys = new Set([
      'Color Ramp', 'typography', 'spacing', 'color', 'dark', 'light', 
      'header', 'body', 'label', 'opacity', 'borderRadius', 'borderWidth',
      'appBackground', 'brand', 'surface', 'content', 'primary', 'secondary',
      'button', 'CTA', 'FontFamily',
      '$themes', '$metadata'
    ]);
    
    for (const [key, value] of Object.entries(sourceData)) {
      if (!processedKeys.has(key) && this._isTokenSet(value)) {
        // Add remaining tokens to appropriate sets or create new ones
        const normalizedName = this._normalizeSetName(key);
        if (normalizedName === 'content-typography') {
          tokenSets['Content Typography'] = { [key]: value };
        } else {
          tokenSets[normalizedName] = { [key]: value };
        }
      }
    }
    
    return tokenSets;
  }

  _convertToTokenStudioFormat(tokens) {
    const converted = {};
    
    for (const [key, value] of Object.entries(tokens)) {
      if (this._isTokenGroup(value)) {
        converted[key] = this._convertToTokenStudioFormat(value);
      } else if (this._isToken(value)) {
        converted[key] = this._convertToken(value);
      } else {
        converted[key] = value;
      }
    }
    
    return converted;
  }

  _convertToken(token) {
    // Convert from various formats to Token Studio format
    if (token.$type && token.$value !== undefined) {
      // Already in Token Studio format
      return token;
    }
    
    if (token.type && token.value !== undefined) {
      // Convert from type/value format
      return {
        $type: token.type,
        $value: token.value,
        ...(token.description && { $description: token.description })
      };
    }
    
    if (token.value !== undefined) {
      // Infer type from value
      return {
        $type: this._inferTokenType(token.value),
        $value: token.value,
        ...(token.description && { $description: token.description })
      };
    }
    
    return token;
  }

  _inferTokenType(value) {
    if (typeof value === 'string') {
      if (value.match(/^#[0-9a-fA-F]{3,8}$/)) return 'color';
      if (value.match(/^rgba?\(/)) return 'color';
      if (value.match(/^\d+(\.\d+)?(px|rem|em|%)$/)) return 'dimension';
      if (value.match(/^\d+$/)) return 'dimension';
      if (value.includes('gradient')) return 'color';
    }
    if (typeof value === 'number') return 'dimension';
    if (typeof value === 'object' && value.fontFamily) return 'typography';
    
    return 'other';
  }

  _isTokenSet(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  _isTokenGroup(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && 
           !this._isToken(value);
  }

  _isToken(value) {
    return typeof value === 'object' && value !== null && 
           !!(value.$type || value.type || value.value !== undefined);
  }

  _normalizeSetName(name) {
    // Normalize set names to match expected Token Studio conventions
    const nameMap = {
      'Color Ramp': 'core',
      'typography': 'core',
      'spacing': 'core'
    };
    
    return nameMap[name] || name.toLowerCase().replace(/\s+/g, '-');
  }

  _getTokenSetFileName(setName) {
    // Map set names to file names
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

  async _readMetadata(tokensDir) {
    try {
      const metadataPath = path.join(tokensDir, '$metadata.json');
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.errors.push(`Failed to read metadata: ${error.message}`);
      return null;
    }
  }

  async _readThemes(tokensDir) {
    try {
      const themesPath = path.join(tokensDir, '$themes.json');
      const content = await fs.readFile(themesPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.warnings.push(`No themes file found, using default theme configuration`);
      return [];
    }
  }

  async _readTokenSets(tokensDir, tokenSetOrder) {
    const tokenSets = {};
    
    for (const setName of tokenSetOrder) {
      try {
        const fileName = this._getTokenSetFileName(setName);
        const filePath = path.join(tokensDir, fileName);
        const content = await fs.readFile(filePath, 'utf8');
        tokenSets[setName] = JSON.parse(content);
      } catch (error) {
        this.warnings.push(`Token set file not found: ${setName}`);
      }
    }
    
    return tokenSets;
  }

  async _consolidateTokenSets(tokenSets, themes, metadata) {
    const consolidated = {};
    
    // Merge all token sets into consolidated structure
    for (const [setName, tokens] of Object.entries(tokenSets)) {
      this._mergeTokens(consolidated, tokens);
    }
    
    // Add themes if present
    if (themes && themes.length > 0) {
      consolidated.$themes = themes;
    }
    
    // Add metadata if needed
    if (metadata && Object.keys(metadata).length > 1) {
      consolidated.$metadata = metadata;
    }
    
    return consolidated;
  }

  _mergeTokens(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (this._isTokenGroup(value) && target[key] && this._isTokenGroup(target[key])) {
        this._mergeTokens(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }

  _countTokens(tokenData) {
    let count = 0;
    
    for (const value of Object.values(tokenData)) {
      if (this._isToken(value)) {
        count++;
      } else if (this._isTokenGroup(value)) {
        count += this._countTokens(value);
      }
    }
    
    return count;
  }

  async _writeSourceFile(data, outputPath) {
    try {
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.errors.push(`Failed to write source file ${outputPath}: ${error.message}`);
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

  _compareTokenStructures(original, reconstituted, path, differences) {
    // Deep comparison logic for validation
    const originalKeys = new Set(Object.keys(original));
    const reconstitutedKeys = new Set(Object.keys(reconstituted));
    
    // Check for missing keys
    for (const key of originalKeys) {
      if (!reconstitutedKeys.has(key)) {
        differences.push({
          type: 'missing_key',
          path: path ? `${path}.${key}` : key,
          message: `Key missing in reconstituted data`
        });
      }
    }
    
    // Check for extra keys
    for (const key of reconstitutedKeys) {
      if (!originalKeys.has(key)) {
        differences.push({
          type: 'extra_key',
          path: path ? `${path}.${key}` : key,
          message: `Extra key in reconstituted data`
        });
      }
    }
    
    // Compare common keys
    for (const key of originalKeys) {
      if (reconstitutedKeys.has(key)) {
        const currentPath = path ? `${path}.${key}` : key;
        const originalValue = original[key];
        const reconstitutedValue = reconstituted[key];
        
        if (this._isTokenGroup(originalValue) && this._isTokenGroup(reconstitutedValue)) {
          this._compareTokenStructures(originalValue, reconstitutedValue, currentPath, differences);
        } else if (JSON.stringify(originalValue) !== JSON.stringify(reconstitutedValue)) {
          differences.push({
            type: 'value_mismatch',
            path: currentPath,
            original: originalValue,
            reconstituted: reconstitutedValue,
            message: `Value mismatch`
          });
        }
      }
    }
  }

  _validateTokenReferences(original, reconstituted, differences) {
    // Extract and validate token references are preserved
    const originalRefs = this._extractTokenReferences(original);
    const reconstitutedRefs = this._extractTokenReferences(reconstituted);
    
    for (const ref of originalRefs) {
      if (!reconstitutedRefs.includes(ref)) {
        differences.push({
          type: 'missing_reference',
          reference: ref,
          message: `Token reference not preserved: ${ref}`
        });
      }
    }
  }

  _extractTokenReferences(data, refs = []) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
        refs.push(value);
      } else if (this._isTokenGroup(value)) {
        this._extractTokenReferences(value, refs);
      }
    }
    return refs;
  }

  _validateMetadataPreservation(original, reconstituted, differences) {
    // Check that descriptions and other metadata are preserved
    this._compareMetadata(original, reconstituted, '', differences);
  }

  _compareMetadata(original, reconstituted, path, differences) {
    for (const [key, value] of Object.entries(original)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (this._isToken(value)) {
        const reconstitutedToken = reconstituted[key];
        if (reconstitutedToken) {
          // Check description preservation
          if (value.description && !reconstitutedToken.$description && !reconstitutedToken.description) {
            differences.push({
              type: 'missing_description',
              path: currentPath,
              message: `Token description not preserved`
            });
          }
        }
      } else if (this._isTokenGroup(value) && reconstituted[key]) {
        this._compareMetadata(value, reconstituted[key], currentPath, differences);
      }
    }
  }
}

module.exports = TokenTransformationEngine;