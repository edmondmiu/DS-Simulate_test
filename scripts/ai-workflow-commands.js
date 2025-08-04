#!/usr/bin/env node

/**
 * AI Workflow Commands - Specialized commands for AI-friendly token editing
 * 
 * This script provides AI-specific workflow commands:
 * - ai-editing-session: Initialize and manage AI editing sessions
 * - validate-ai-changes: Validate AI-generated token modifications
 * - auto-consolidate: Automatic consolidation with validation
 * - ai-workflow-test: Test complete AI editing workflow
 * 
 * Requirements addressed: 6.1, 6.2, 6.3, 6.4, 6.5
 */

const fs = require('fs').promises;
const path = require('path');
const ModularEditingManager = require('../src/ModularEditingManager');
const WorkflowCommands = require('./workflow-commands');

class AIWorkflowCommands {
  constructor() {
    this.manager = new ModularEditingManager('tokens');
    this.workflow = new WorkflowCommands();
    this.tokensDir = 'tokens';
    this.sourcePath = 'tokensource.json';
  }

  /**
   * Initialize AI editing session with comprehensive setup
   * @param {object} options - Session options
   * @returns {Promise<{success: boolean, sessionId: string, details: object}>}
   */
  async initializeAIEditingSession(options = {}) {
    const {
      sessionId = `ai-session-${Date.now()}`,
      autoValidate = true,
      preserveMetadata = true,
      trackChanges = true,
      verbose = false
    } = options;

    this._logProgress('🤖 Initializing AI editing session...', verbose);

    try {
      // Step 1: Ensure tokens directory is ready
      this._logProgress('📁 Preparing tokens directory...', verbose);
      const tokensReady = await this._ensureTokensReady();
      if (!tokensReady.success) {
        return this._errorResult(`Tokens preparation failed: ${tokensReady.message}`);
      }

      // Step 2: Initialize editing session
      this._logProgress('🔧 Starting editing session...', verbose);
      const session = await this.manager.initializeEditingSession(sessionId, {
        autoValidate,
        preserveMetadata,
        trackChanges
      });

      if (!session.success) {
        return this._errorResult(`Session initialization failed: ${session.errors.join(', ')}`);
      }

      // Step 3: Validate initial state
      this._logProgress('✅ Validating initial state...', verbose);
      const initialValidation = await this._validateAllTokenFiles(sessionId);

      const details = {
        sessionId,
        sessionInfo: session.session,
        tokensDirectory: this.tokensDir,
        availableFiles: tokensReady.files,
        initialValidation: {
          isValid: initialValidation.isValid,
          totalIssues: initialValidation.totalIssues,
          criticalIssues: initialValidation.criticalIssues
        },
        aiGuidelines: {
          preserveDescriptions: true,
          validateReferences: true,
          maintainTokenTypes: true,
          useSemanticNaming: true
        }
      };

      this._logSuccess(`✨ AI editing session initialized: ${sessionId}`, verbose);
      
      if (verbose) {
        console.log('📄 Available token files:', tokensReady.files.join(', '));
        console.log('🔍 Initial validation:', initialValidation.isValid ? '✅ Passed' : '⚠️ Issues detected');
        if (!initialValidation.isValid) {
          console.log(`   - Total issues: ${initialValidation.totalIssues}`);
          console.log(`   - Critical issues: ${initialValidation.criticalIssues}`);
        }
      }

      return this._successResult('AI editing session initialized successfully', details);

    } catch (error) {
      return this._errorResult(`Unexpected error initializing AI session: ${error.message}`);
    }
  }

  /**
   * Validate AI-generated token modifications
   * @param {object} options - Validation options
   * @returns {Promise<{success: boolean, validation: object, suggestions: string[]}>}
   */
  async validateAIChanges(options = {}) {
    const {
      sessionId = null,
      files = [],
      comprehensive = true,
      verbose = false
    } = options;

    this._logProgress('🔍 Validating AI-generated changes...', verbose);

    try {
      const validationResults = {
        fileValidations: {},
        overallValid: true,
        totalIssues: 0,
        criticalIssues: 0,
        suggestions: [],
        aiSpecificChecks: {
          metadataPreserved: true,
          referencesValid: true,
          typesConsistent: true,
          semanticNaming: true
        }
      };

      // Determine files to validate
      const filesToValidate = files.length > 0 ? files : await this._getTokenFiles();

      // Validate each file
      for (const file of filesToValidate) {
        this._logProgress(`📋 Validating ${path.basename(file)}...`, verbose);
        
        const fileValidation = await this.manager.validateTokenFile(file, sessionId);
        validationResults.fileValidations[file] = fileValidation;

        if (!fileValidation.isValid) {
          validationResults.overallValid = false;
        }

        const errorCount = fileValidation.issues.filter(i => i.severity === 'error').length;
        validationResults.totalIssues += fileValidation.issues.length;
        validationResults.criticalIssues += errorCount;

        // AI-specific validation checks
        const aiChecks = await this._performAISpecificValidation(file, fileValidation);
        Object.assign(validationResults.aiSpecificChecks, aiChecks);
      }

      // Generate AI-specific suggestions
      validationResults.suggestions = this._generateAISuggestions(validationResults);

      // Comprehensive validation if requested
      if (comprehensive) {
        this._logProgress('🔬 Running comprehensive validation...', verbose);
        const comprehensiveResult = await this.workflow.validateWorkflowIntegrity({ verbose: false });
        
        validationResults.comprehensiveValidation = {
          passed: comprehensiveResult.success,
          details: comprehensiveResult.details
        };
      }

      const success = validationResults.overallValid && validationResults.criticalIssues === 0;

      if (success) {
        this._logSuccess('✨ AI changes validation passed!', verbose);
      } else {
        this._logWarning(`⚠️ Validation issues detected: ${validationResults.criticalIssues} critical, ${validationResults.totalIssues} total`, verbose);
      }

      if (verbose) {
        console.log('📊 Validation Summary:');
        console.log(`   - Files validated: ${filesToValidate.length}`);
        console.log(`   - Total issues: ${validationResults.totalIssues}`);
        console.log(`   - Critical issues: ${validationResults.criticalIssues}`);
        console.log(`   - Metadata preserved: ${validationResults.aiSpecificChecks.metadataPreserved ? '✅' : '❌'}`);
        console.log(`   - References valid: ${validationResults.aiSpecificChecks.referencesValid ? '✅' : '❌'}`);
        
        if (validationResults.suggestions.length > 0) {
          console.log('💡 AI Suggestions:');
          validationResults.suggestions.forEach(suggestion => {
            console.log(`   - ${suggestion}`);
          });
        }
      }

      return {
        success,
        validation: validationResults,
        suggestions: validationResults.suggestions
      };

    } catch (error) {
      return this._errorResult(`AI changes validation failed: ${error.message}`);
    }
  }

  /**
   * Automatic consolidation with AI-specific validation and metadata preservation
   * @param {object} options - Consolidation options
   * @returns {Promise<{success: boolean, consolidation: object, validation: object}>}
   */
  async autoConsolidate(options = {}) {
    const {
      sessionId = null,
      validateBefore = true,
      validateAfter = true,
      preserveMetadata = true,
      createBackup = true,
      verbose = false
    } = options;

    this._logProgress('🔄 Starting automatic consolidation...', verbose);

    try {
      let preValidation = null;
      
      // Pre-consolidation validation
      if (validateBefore) {
        this._logProgress('🔍 Pre-consolidation validation...', verbose);
        preValidation = await this.validateAIChanges({ sessionId, verbose: false });
        
        if (!preValidation.success) {
          this._logWarning('⚠️ Pre-consolidation validation failed, proceeding with caution...', verbose);
        }
      }

      // Finalize editing session if provided
      let sessionSummary = null;
      if (sessionId) {
        this._logProgress('🏁 Finalizing editing session...', verbose);
        const finalization = await this.manager.finalizeEditingSession(sessionId);
        
        if (finalization.success) {
          sessionSummary = finalization.summary;
        } else {
          this._logWarning(`Session finalization issues: ${finalization.errors.join(', ')}`, verbose);
        }
      }

      // Perform consolidation
      this._logProgress('⚡ Consolidating changes to source...', verbose);
      const consolidation = await this.workflow.consolidateToSource({
        verbose: false,
        backup: createBackup
      });

      if (!consolidation.success) {
        return this._errorResult(`Consolidation failed: ${consolidation.message}`);
      }

      // Post-consolidation validation
      let postValidation = null;
      if (validateAfter) {
        this._logProgress('✅ Post-consolidation validation...', verbose);
        postValidation = await this.workflow.validateWorkflowIntegrity({ verbose: false });
      }

      // AI-specific metadata validation
      const metadataValidation = await this._validateMetadataPreservation();

      const result = {
        consolidation: consolidation.details,
        sessionSummary,
        preValidation: preValidation ? preValidation.validation : null,
        postValidation: postValidation ? postValidation.details : null,
        metadataPreservation: metadataValidation,
        recommendations: this._generatePostConsolidationRecommendations(consolidation, postValidation)
      };

      const success = consolidation.success && (!postValidation || postValidation.success);

      if (success) {
        this._logSuccess('✨ Automatic consolidation completed successfully!', verbose);
      } else {
        this._logWarning('⚠️ Consolidation completed with validation issues', verbose);
      }

      if (verbose) {
        console.log('📊 Consolidation Summary:');
        console.log(`   - Tokens processed: ${consolidation.details.tokensCount}`);
        console.log(`   - Backup created: ${consolidation.details.backupPath ? '✅' : '❌'}`);
        console.log(`   - Post-validation: ${postValidation ? (postValidation.success ? '✅' : '❌') : 'Skipped'}`);
        console.log(`   - Metadata preserved: ${metadataValidation.preserved ? '✅' : '❌'}`);
        
        if (result.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          result.recommendations.forEach(rec => {
            console.log(`   - ${rec}`);
          });
        }
      }

      return {
        success,
        consolidation: result.consolidation,
        validation: result.postValidation,
        metadata: result.metadataPreservation,
        recommendations: result.recommendations
      };

    } catch (error) {
      return this._errorResult(`Auto-consolidation failed: ${error.message}`);
    }
  }

  /**
   * Test complete AI editing workflow with sample modifications
   * @param {object} options - Test options
   * @returns {Promise<{success: boolean, testResults: object, performance: object}>}
   */
  async testAIWorkflow(options = {}) {
    const {
      includePerformanceTest = true,
      testModifications = true,
      verbose = false
    } = options;

    this._logProgress('🧪 Testing complete AI editing workflow...', verbose);

    const testResults = {
      stages: {},
      performance: {},
      issues: [],
      recommendations: []
    };

    const startTime = Date.now();

    try {
      // Stage 1: Session Initialization
      this._logProgress('1️⃣ Testing session initialization...', verbose);
      const sessionStart = Date.now();
      
      const sessionResult = await this.initializeAIEditingSession({
        sessionId: 'test-ai-session',
        verbose: false
      });
      
      testResults.stages.sessionInitialization = {
        success: sessionResult.success,
        duration: Date.now() - sessionStart,
        details: sessionResult.details
      };

      if (!sessionResult.success) {
        testResults.issues.push('Session initialization failed');
        return this._errorResult('AI workflow test failed at session initialization', testResults);
      }

      // Stage 2: Test Modifications (if enabled)
      if (testModifications) {
        this._logProgress('2️⃣ Testing AI modifications...', verbose);
        const modStart = Date.now();
        
        const modificationResult = await this._performTestModifications('test-ai-session');
        
        testResults.stages.modifications = {
          success: modificationResult.success,
          duration: Date.now() - modStart,
          modificationsApplied: modificationResult.count,
          details: modificationResult.details
        };

        if (!modificationResult.success) {
          testResults.issues.push('Test modifications failed');
        }
      }

      // Stage 3: Validation Testing
      this._logProgress('3️⃣ Testing AI changes validation...', verbose);
      const validationStart = Date.now();
      
      const validationResult = await this.validateAIChanges({
        sessionId: 'test-ai-session',
        comprehensive: true,
        verbose: false
      });
      
      testResults.stages.validation = {
        success: validationResult.success,
        duration: Date.now() - validationStart,
        issuesFound: validationResult.validation.totalIssues,
        criticalIssues: validationResult.validation.criticalIssues,
        suggestions: validationResult.suggestions
      };

      // Stage 4: Auto-consolidation Testing
      this._logProgress('4️⃣ Testing auto-consolidation...', verbose);
      const consolidationStart = Date.now();
      
      const consolidationResult = await this.autoConsolidate({
        sessionId: 'test-ai-session',
        validateBefore: true,
        validateAfter: true,
        verbose: false
      });
      
      testResults.stages.consolidation = {
        success: consolidationResult.success,
        duration: Date.now() - consolidationStart,
        tokensProcessed: consolidationResult.consolidation.tokensCount,
        metadataPreserved: consolidationResult.metadata.preserved
      };

      // Performance Analysis
      if (includePerformanceTest) {
        this._logProgress('📊 Analyzing performance...', verbose);
        testResults.performance = {
          totalDuration: Date.now() - startTime,
          stageBreakdown: {
            initialization: testResults.stages.sessionInitialization.duration,
            modifications: testResults.stages.modifications?.duration || 0,
            validation: testResults.stages.validation.duration,
            consolidation: testResults.stages.consolidation.duration
          },
          tokensPerSecond: testResults.stages.consolidation.tokensProcessed / 
                          ((Date.now() - startTime) / 1000),
          memoryUsage: process.memoryUsage()
        };
      }

      // Generate recommendations
      testResults.recommendations = this._generateTestRecommendations(testResults);

      // Determine overall success
      const overallSuccess = Object.values(testResults.stages).every(stage => stage.success);

      if (overallSuccess) {
        this._logSuccess('✨ AI workflow test completed successfully!', verbose);
      } else {
        this._logWarning('⚠️ AI workflow test completed with issues', verbose);
      }

      if (verbose) {
        console.log('🧪 Test Results Summary:');
        console.log(`   - Overall success: ${overallSuccess ? '✅' : '❌'}`);
        console.log(`   - Total duration: ${testResults.performance.totalDuration}ms`);
        console.log(`   - Tokens processed: ${testResults.stages.consolidation.tokensProcessed}`);
        console.log(`   - Performance: ${testResults.performance.tokensPerSecond.toFixed(2)} tokens/sec`);
        console.log(`   - Issues found: ${testResults.issues.length}`);
        
        if (testResults.recommendations.length > 0) {
          console.log('💡 Test Recommendations:');
          testResults.recommendations.forEach(rec => {
            console.log(`   - ${rec}`);
          });
        }
      }

      return {
        success: overallSuccess,
        testResults,
        performance: testResults.performance
      };

    } catch (error) {
      testResults.issues.push(`Unexpected error: ${error.message}`);
      return this._errorResult(`AI workflow test failed: ${error.message}`, testResults);
    }
  }

  // Private helper methods

  async _ensureTokensReady() {
    try {
      const tokensExists = await this._fileExists(this.tokensDir);
      
      if (!tokensExists) {
        // Split source to create tokens directory
        const splitResult = await this.workflow.splitSourceToTokens({ verbose: false });
        if (!splitResult.success) {
          return { success: false, message: splitResult.message };
        }
        
        return { success: true, files: splitResult.details.files };
      }

      // Get existing token files
      const files = await this._getTokenFiles();
      return { success: true, files };

    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async _validateAllTokenFiles(sessionId) {
    const files = await this._getTokenFiles();
    let totalIssues = 0;
    let criticalIssues = 0;
    let allValid = true;

    for (const file of files) {
      const validation = await this.manager.validateTokenFile(file, sessionId);
      if (!validation.isValid) {
        allValid = false;
      }
      
      totalIssues += validation.issues.length;
      criticalIssues += validation.issues.filter(i => i.severity === 'error').length;
    }

    return {
      isValid: allValid,
      totalIssues,
      criticalIssues,
      filesValidated: files.length
    };
  }

  async _getTokenFiles() {
    try {
      const files = await fs.readdir(this.tokensDir);
      return files
        .filter(file => file.endsWith('.json') && !file.startsWith('$'))
        .map(file => path.join(this.tokensDir, file));
    } catch (error) {
      return [];
    }
  }

  async _performAISpecificValidation(file, fileValidation) {
    const checks = {
      metadataPreserved: true,
      referencesValid: true,
      typesConsistent: true,
      semanticNaming: true
    };

    try {
      const content = JSON.parse(await fs.readFile(file, 'utf8'));
      
      // Check metadata preservation
      checks.metadataPreserved = this._checkMetadataPreservation(content);
      
      // Check reference validity
      checks.referencesValid = fileValidation.issues.filter(i => i.type === 'unresolved_reference').length === 0;
      
      // Check type consistency
      checks.typesConsistent = this._checkTypeConsistency(content);
      
      // Check semantic naming
      checks.semanticNaming = this._checkSemanticNaming(content);

    } catch (error) {
      // If we can't read the file, mark all checks as failed
      Object.keys(checks).forEach(key => checks[key] = false);
    }

    return checks;
  }

  _checkMetadataPreservation(tokenData) {
    const checkObject = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          if (this._isToken(value)) {
            // Check if token has description
            if (!value.$description && !value.description) {
              return false;
            }
          } else {
            if (!checkObject(value)) {
              return false;
            }
          }
        }
      }
      return true;
    };

    return checkObject(tokenData);
  }

  _checkTypeConsistency(tokenData) {
    const checkObject = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          if (this._isToken(value)) {
            // Check if token has type
            if (!value.$type && !value.type) {
              return false;
            }
          } else {
            if (!checkObject(value)) {
              return false;
            }
          }
        }
      }
      return true;
    };

    return checkObject(tokenData);
  }

  _checkSemanticNaming(tokenData) {
    // Check for semantic naming patterns
    const semanticPatterns = [
      /^(color|spacing|typography|border|shadow|opacity|size)/,
      /\.(primary|secondary|tertiary|success|error|warning|info)/,
      /\.(small|medium|large|xl|xs)/,
      /\.(light|dark|base|hover|active|disabled)/
    ];

    const checkNaming = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'object' && value !== null) {
          if (this._isToken(value)) {
            // Check if path follows semantic patterns
            const isSemanticName = semanticPatterns.some(pattern => pattern.test(currentPath));
            if (!isSemanticName && currentPath.split('.').length > 1) {
              return false;
            }
          } else {
            if (!checkNaming(value, currentPath)) {
              return false;
            }
          }
        }
      }
      return true;
    };

    return checkNaming(tokenData);
  }

  _generateAISuggestions(validationResults) {
    const suggestions = [];

    if (validationResults.criticalIssues > 0) {
      suggestions.push('Fix critical validation issues before proceeding with consolidation');
    }

    if (!validationResults.aiSpecificChecks.metadataPreserved) {
      suggestions.push('Add $description properties to tokens for better documentation');
    }

    if (!validationResults.aiSpecificChecks.referencesValid) {
      suggestions.push('Resolve unresolved token references to prevent build failures');
    }

    if (!validationResults.aiSpecificChecks.typesConsistent) {
      suggestions.push('Add $type properties to all tokens for better validation');
    }

    if (!validationResults.aiSpecificChecks.semanticNaming) {
      suggestions.push('Consider using semantic naming patterns (color.primary, spacing.large, etc.)');
    }

    if (validationResults.totalIssues > 10) {
      suggestions.push('Consider breaking large changes into smaller, focused modifications');
    }

    return suggestions;
  }

  async _validateMetadataPreservation() {
    try {
      const sourceContent = JSON.parse(await fs.readFile(this.sourcePath, 'utf8'));
      
      let totalTokens = 0;
      let tokensWithDescriptions = 0;

      const countTokens = (obj) => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            if (this._isToken(value)) {
              totalTokens++;
              if (value.$description || value.description) {
                tokensWithDescriptions++;
              }
            } else if (!key.startsWith('$')) {
              countTokens(value);
            }
          }
        }
      };

      countTokens(sourceContent);

      const preservationRate = totalTokens > 0 ? (tokensWithDescriptions / totalTokens) : 1;

      return {
        preserved: preservationRate > 0.8, // 80% threshold
        totalTokens,
        tokensWithDescriptions,
        preservationRate: Math.round(preservationRate * 100)
      };

    } catch (error) {
      return {
        preserved: false,
        error: error.message
      };
    }
  }

  _generatePostConsolidationRecommendations(consolidation, validation) {
    const recommendations = [];

    if (consolidation.details.warnings && consolidation.details.warnings.length > 0) {
      recommendations.push('Review consolidation warnings for potential issues');
    }

    if (validation && !validation.success) {
      recommendations.push('Address post-consolidation validation issues');
    }

    if (consolidation.details.tokensCount > 1000) {
      recommendations.push('Consider performance optimization for large token sets');
    }

    recommendations.push('Test designer import workflow after consolidation');
    recommendations.push('Validate multi-platform build outputs');

    return recommendations;
  }

  async _performTestModifications(sessionId) {
    try {
      const testFile = path.join(this.tokensDir, 'global.json');
      const content = JSON.parse(await fs.readFile(testFile, 'utf8'));

      // Test modification 1: Update existing token
      if (content.color && content.color.primary) {
        content.color.primary.$value = '#0066cc';
        content.color.primary.$description = 'Updated primary color for AI testing';
      }

      // Test modification 2: Add new token
      if (!content.color) content.color = {};
      content.color.aiTest = {
        $type: 'color',
        $value: '{color.primary}',
        $description: 'AI-generated test token'
      };

      // Write changes
      await fs.writeFile(testFile, JSON.stringify(content, null, 2));

      // Track changes
      await this.manager.trackChange(sessionId, testFile, {
        type: 'ai_test_modification',
        tokens: ['color.primary', 'color.aiTest'],
        description: 'AI workflow test modifications'
      });

      return {
        success: true,
        count: 2,
        details: {
          file: testFile,
          modifications: ['color.primary', 'color.aiTest']
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  _generateTestRecommendations(testResults) {
    const recommendations = [];

    if (testResults.performance.totalDuration > 10000) {
      recommendations.push('Consider optimizing workflow performance for large token sets');
    }

    if (testResults.stages.validation.criticalIssues > 0) {
      recommendations.push('Improve AI validation to catch critical issues earlier');
    }

    if (!testResults.stages.consolidation.metadataPreserved) {
      recommendations.push('Enhance metadata preservation during AI editing');
    }

    if (testResults.issues.length > 0) {
      recommendations.push('Address workflow issues for more reliable AI integration');
    }

    return recommendations;
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  _isToken(value) {
    return typeof value === 'object' && value !== null && 
           (value.$type || value.type || value.$value !== undefined || value.value !== undefined);
  }

  _logProgress(message, verbose = true) {
    if (verbose) {
      console.log(message);
    }
  }

  _logSuccess(message, verbose = true) {
    if (verbose) {
      console.log(`✅ ${message}`);
    }
  }

  _logWarning(message, verbose = true) {
    if (verbose) {
      console.log(`⚠️ ${message}`);
    }
  }

  _logError(message, verbose = true) {
    if (verbose) {
      console.log(`❌ ${message}`);
    }
  }

  _successResult(message, details = {}) {
    return { success: true, message, details };
  }

  _errorResult(message, details = {}) {
    return { success: false, message, details };
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const aiWorkflow = new AIWorkflowCommands();

  async function runCommand() {
    let result;
    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    switch (command) {
      case 'init-ai-session':
        const sessionId = process.argv[3] || `ai-session-${Date.now()}`;
        result = await aiWorkflow.initializeAIEditingSession({ sessionId, verbose });
        break;

      case 'validate-ai-changes':
        result = await aiWorkflow.validateAIChanges({ verbose, comprehensive: true });
        break;

      case 'auto-consolidate':
        result = await aiWorkflow.autoConsolidate({ verbose });
        break;

      case 'test-ai-workflow':
        result = await aiWorkflow.testAIWorkflow({ verbose });
        break;
      
      // Consolidated command aliases for simplified interface
      case 'init-session':
        const sessionId2 = process.argv[3] || `ai-session-${Date.now()}`;
        result = await aiWorkflow.initializeAIEditingSession({ sessionId: sessionId2, verbose });
        break;
      
      case 'validate-changes':
        result = await aiWorkflow.validateAIChanges({ verbose, comprehensive: true });
        break;
      
      case 'test-workflow':
        result = await aiWorkflow.testAIWorkflow({ verbose });
        break;

      default:
        if (!command) {
          console.log('AI Workflow Commands');
          console.log('');
          console.log('Usage: npm run ai <command> [options]');
          console.log('');
          console.log('Commands:');
          console.log('  init-session [sessionId]     Initialize AI editing session');
          console.log('  validate-changes             Validate AI-generated changes');
          console.log('  auto-consolidate             Automatic consolidation with validation');
          console.log('  test-workflow                Test complete AI editing workflow');
          console.log('');
          console.log('Legacy Commands (still supported):');
          console.log('  init-ai-session              Same as init-session');
          console.log('  validate-ai-changes          Same as validate-changes');
          console.log('  test-ai-workflow             Same as test-workflow');
          console.log('');
          console.log('Options:');
          console.log('  --verbose, -v                Enable verbose output');
          console.log('');
          console.log('Examples:');
          console.log('  npm run ai init-session');
          console.log('  npm run ai validate-changes -- --verbose');
          console.log('  npm run ai auto-consolidate');
        } else {
          console.log(`Unknown AI command: ${command}`);
          console.log('Run "npm run ai" to see available commands.');
        }
        process.exit(0);
    }

    if (result) {
      if (result.success) {
        console.log(`✅ ${result.message}`);
        if (verbose && result.details) {
          console.log('Details:', JSON.stringify(result.details, null, 2));
        }
        process.exit(0);
      } else {
        console.error(`❌ ${result.message}`);
        if (result.details) {
          console.error('Details:', JSON.stringify(result.details, null, 2));
        }
        process.exit(1);
      }
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}

module.exports = AIWorkflowCommands;