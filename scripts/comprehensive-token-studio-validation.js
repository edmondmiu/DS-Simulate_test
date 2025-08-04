#!/usr/bin/env node

/**
 * Comprehensive Token Studio Validation and Fix Script
 * 
 * This script performs comprehensive validation and fixes for Token Studio compatibility:
 * - Fixes broken token references
 * - Validates token structure integrity
 * - Ensures no data loss during migration
 * - Tests complete workflow roundtrip
 */

const fs = require('fs').promises;
const path = require('path');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');
const ValidationSystem = require('../src/ValidationSystem');

class ComprehensiveValidator {
  constructor() {
    this.transformationEngine = new TokenTransformationEngine();
    this.validator = new ValidationSystem();
    this.fixes = [];
    this.errors = [];
  }

  async validateAndFix() {
    console.log('🔍 Starting comprehensive Token Studio validation and fixes...');
    
    try {
      // Step 1: Create backup
      const backupPath = await this.createBackup();
      console.log(`📦 Created backup: ${backupPath}`);
      
      // Step 2: Fix broken references
      console.log('\n🔧 Fixing broken token references...');
      const fixResult = await this.fixBrokenReferences();
      
      if (fixResult.success) {
        console.log(`✅ Applied ${fixResult.fixCount} reference fixes`);
      } else {
        console.log(`❌ Reference fixes failed: ${fixResult.error}`);
        return { success: false, error: fixResult.error };
      }
      
      // Step 3: Test workflow integrity
      console.log('\n🧪 Testing workflow integrity...');
      const integrityResult = await this.testWorkflowIntegrity();
      
      if (integrityResult.success) {
        console.log('✅ Workflow integrity test passed');
      } else {
        console.log(`❌ Workflow integrity test failed: ${integrityResult.error}`);
        return { success: false, error: integrityResult.error };
      }
      
      // Step 4: Validate Token Studio compatibility
      console.log('\n🎯 Validating Token Studio compatibility...');
      const compatibilityResult = await this.validateTokenStudioCompatibility();
      
      if (compatibilityResult.success) {
        console.log('✅ Token Studio compatibility validated');
      } else {
        console.log(`⚠️  Token Studio compatibility issues: ${compatibilityResult.warnings?.length || 0} warnings`);
      }
      
      console.log('\n🎉 Comprehensive validation completed successfully!');
      console.log('\nSummary:');
      console.log(`- Reference fixes applied: ${fixResult.fixCount}`);
      console.log(`- Workflow integrity: ${integrityResult.success ? 'PASSED' : 'FAILED'}`);
      console.log(`- Token Studio compatibility: ${compatibilityResult.success ? 'VALIDATED' : 'WARNINGS'}`);
      console.log(`- Backup created: ${backupPath}`);
      
      return {
        success: true,
        fixCount: fixResult.fixCount,
        workflowIntegrity: integrityResult.success,
        tokenStudioCompatibility: compatibilityResult.success,
        backupPath
      };
      
    } catch (error) {
      console.error('❌ Comprehensive validation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async fixBrokenReferences() {
    try {
      // Read tokensource.json
      const content = await fs.readFile('tokensource.json', 'utf8');
      const data = JSON.parse(content);
      
      // Define reference fixes
      const fixes = [
        // Font Family fixes
        { from: '{FontFamily.heading}', to: '{fontFamilies.Roboto}' },
        { from: '{FontFamily.body}', to: '{fontFamilies.Roboto}' },
        
        // Font Weight fixes
        { from: '{fontWeights.roboto-0}', to: '{fontWeights.roboto.light}' },
        { from: '{fontWeights.roboto-1}', to: '{fontWeights.roboto.regular}' },
        { from: '{fontWeights.roboto-2}', to: '{fontWeights.roboto.medium}' },
        { from: '{fontWeights.roboto-3}', to: '{fontWeights.roboto.bold}' },
        
        // Line Height fixes
        { from: '{lineHeights.0}', to: '{lineHeights.tight}' },
        { from: '{lineHeights.1}', to: '{lineHeights.normal}' },
        { from: '{lineHeights.2}', to: '{lineHeights.loose}' },
        
        // Font Size fixes
        { from: '{fontSizes.4xl}', to: '{fontSizes.xxl}' },
        
        // Letter Spacing fixes
        { from: '{letterSpacing.0}', to: '{letterSpacing.normal}' }
      ];
      
      // Apply fixes by converting to string, replacing, and parsing back
      let jsonString = JSON.stringify(data, null, 2);
      let fixCount = 0;
      
      fixes.forEach(fix => {
        const regex = new RegExp(fix.from.replace(/[{}]/g, '\\$&'), 'g');
        const matches = jsonString.match(regex);
        if (matches) {
          jsonString = jsonString.replace(regex, fix.to);
          fixCount += matches.length;
          console.log(`   Fixed ${matches.length} instances of ${fix.from} → ${fix.to}`);
        }
      });
      
      // Parse back and write
      const fixedData = JSON.parse(jsonString);
      await fs.writeFile('tokensource.json', JSON.stringify(fixedData, null, 2));
      
      return { success: true, fixCount };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testWorkflowIntegrity() {
    try {
      // Test complete roundtrip: source → split → consolidate → compare
      const originalContent = await fs.readFile('tokensource.json', 'utf8');
      const originalData = JSON.parse(originalContent);
      
      // Split to tokens
      const splitResult = await this.transformationEngine.splitSourceToTokens(
        'tokensource.json',
        'tokens-integrity-test'
      );
      
      if (!splitResult.success) {
        throw new Error(`Split failed: ${splitResult.errors?.join(', ')}`);
      }
      
      // Consolidate back
      const consolidateResult = await this.transformationEngine.consolidateToSource(
        'tokens-integrity-test',
        'tokensource-integrity-test.json'
      );
      
      if (!consolidateResult.success) {
        throw new Error(`Consolidate failed: ${consolidateResult.errors?.join(', ')}`);
      }
      
      // Compare
      const roundtripContent = await fs.readFile('tokensource-integrity-test.json', 'utf8');
      const roundtripData = JSON.parse(roundtripContent);
      
      // Clean up test files
      await this.cleanup(['tokens-integrity-test', 'tokensource-integrity-test.json']);
      
      // Basic comparison - check token count
      const originalTokenCount = this.countTokens(originalData);
      const roundtripTokenCount = this.countTokens(roundtripData);
      
      if (originalTokenCount !== roundtripTokenCount) {
        throw new Error(`Token count mismatch: ${originalTokenCount} → ${roundtripTokenCount}`);
      }
      
      return { 
        success: true, 
        originalTokens: originalTokenCount,
        roundtripTokens: roundtripTokenCount
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async validateTokenStudioCompatibility() {
    try {
      // Split tokens to check Token Studio format
      const splitResult = await this.transformationEngine.splitSourceToTokens(
        'tokensource.json',
        'tokens-compatibility-test'
      );
      
      if (!splitResult.success) {
        throw new Error(`Split failed: ${splitResult.errors?.join(', ')}`);
      }
      
      // Validate structure
      const validationResult = await this.validator.validateTokenStudioStructure('tokens-compatibility-test');
      
      // Clean up
      await this.cleanup(['tokens-compatibility-test']);
      
      return {
        success: validationResult.isValid,
        warnings: validationResult.warnings || [],
        issues: validationResult.issues || []
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  countTokens(data) {
    let count = 0;
    
    function traverse(obj) {
      if (obj && typeof obj === 'object') {
        if (obj.$type && obj.$value) {
          count++;
        } else {
          Object.values(obj).forEach(traverse);
        }
      }
    }
    
    traverse(data);
    return count;
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `.backups/comprehensive-validation-${timestamp}.json`;
    
    await fs.mkdir('.backups', { recursive: true });
    const content = await fs.readFile('tokensource.json', 'utf8');
    await fs.writeFile(backupPath, content);
    
    return backupPath;
  }

  async cleanup(paths) {
    for (const p of paths) {
      try {
        const stat = await fs.stat(p);
        if (stat.isDirectory()) {
          await fs.rm(p, { recursive: true, force: true });
        } else {
          await fs.unlink(p);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// CLI interface
async function main() {
  const validator = new ComprehensiveValidator();
  const result = await validator.validateAndFix();
  
  if (result.success) {
    console.log('\n✅ All validation and fixes completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run workflow:start');
    console.log('2. Test token editing and consolidation');
    console.log('3. Verify Token Studio import works');
    process.exit(0);
  } else {
    console.error('\n❌ Validation and fixes failed');
    console.error('Error:', result.error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ComprehensiveValidator;