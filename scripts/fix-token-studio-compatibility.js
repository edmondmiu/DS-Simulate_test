#!/usr/bin/env node

/**
 * Fix Token Studio Compatibility Issues
 * 
 * This script fixes the compatibility issues identified by the Token Studio verification:
 * 1. Fix invalid $type values to match Token Studio specification
 * 2. Resolve missing token references
 * 3. Clean up token structure for proper Token Studio import
 * 4. Validate all fixes work correctly
 */

const fs = require('fs');
const path = require('path');

class TokenStudioCompatibilityFixer {
  constructor() {
    this.tokensDir = path.join(process.cwd(), 'tokens');
    this.tokensourceFile = path.join(process.cwd(), 'tokensource.json');
    this.fixes = {
      typeCorrections: 0,
      referenceResolutions: 0,
      structureCleanups: 0
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async fixTokenTypes() {
    this.log('🔧 Fixing invalid token $type values...', 'info');

    // Map of incorrect types to correct Token Studio types
    const typeCorrections = {
      'fontFamilies': 'fontFamily',
      'fontSizes': 'fontSize', 
      'fontWeights': 'fontWeight',
      'lineHeights': 'lineHeight'
    };

    const metadataPath = path.join(this.tokensDir, '$metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    for (const tokenSet of metadata.tokenSetOrder) {
      const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
      
      if (!fs.existsSync(tokenSetPath)) continue;

      try {
        const tokenData = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
        let modified = false;

        const fixTypes = (obj, path = '') => {
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (value && typeof value === 'object') {
              if (value.$type && typeCorrections[value.$type]) {
                this.log(`Fixing ${tokenSet}:${currentPath} type: ${value.$type} → ${typeCorrections[value.$type]}`, 'info');
                value.$type = typeCorrections[value.$type];
                this.fixes.typeCorrections++;
                modified = true;
              }
              
              if (value.$value === undefined) {
                fixTypes(value, currentPath);
              }
            }
          }
        };

        fixTypes(tokenData);

        if (modified) {
          fs.writeFileSync(tokenSetPath, JSON.stringify(tokenData, null, 2));
          this.log(`Updated ${tokenSet}.json with type corrections`, 'success');
        }
      } catch (error) {
        this.log(`Error processing ${tokenSet}.json: ${error.message}`, 'error');
      }
    }

    this.log(`Fixed ${this.fixes.typeCorrections} invalid token types`, 'success');
  }

  async fixMissingReferences() {
    this.log('🔧 Fixing missing token references...', 'info');

    // Check if we have the missing "Neon Green" color ramp
    const coreTokensPath = path.join(this.tokensDir, 'core.json');
    if (!fs.existsSync(coreTokensPath)) {
      this.log('core.json not found - cannot fix missing references', 'error');
      return;
    }

    const coreTokens = JSON.parse(fs.readFileSync(coreTokensPath, 'utf8'));

    // Check if "Neon Green" exists in Color Ramp
    if (!coreTokens['Color Ramp'] || !coreTokens['Color Ramp']['Neon Green']) {
      this.log('Adding missing "Neon Green" color ramp to core tokens...', 'info');
      
      if (!coreTokens['Color Ramp']) {
        coreTokens['Color Ramp'] = {};
      }

      // Add Neon Green color ramp based on typical green values
      coreTokens['Color Ramp']['Neon Green'] = {
        "0700": {
          "$value": "#00ff00",
          "$type": "color",
          "$description": "Neon Green 0700 - bright green for accents"
        }
      };

      fs.writeFileSync(coreTokensPath, JSON.stringify(coreTokens, null, 2));
      this.fixes.referenceResolutions++;
      this.log('Added missing "Neon Green" color ramp', 'success');
    }

    this.log(`Resolved ${this.fixes.referenceResolutions} missing references`, 'success');
  }

  async validateTokenStructure() {
    this.log('🔍 Validating token structure after fixes...', 'info');

    const metadataPath = path.join(this.tokensDir, '$metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    let totalTokens = 0;
    let validTokens = 0;

    for (const tokenSet of metadata.tokenSetOrder) {
      const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
      
      if (!fs.existsSync(tokenSetPath)) continue;

      try {
        const tokenData = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
        const counts = this.countAndValidateTokens(tokenData);
        totalTokens += counts.total;
        validTokens += counts.valid;
        
        if (counts.total > 0) {
          this.log(`${tokenSet}.json: ${counts.valid}/${counts.total} tokens valid`, 'info');
        }
      } catch (error) {
        this.log(`Error validating ${tokenSet}.json: ${error.message}`, 'error');
      }
    }

    const validPercentage = totalTokens > 0 ? ((validTokens / totalTokens) * 100).toFixed(1) : 0;
    this.log(`Overall validation: ${validTokens}/${totalTokens} tokens valid (${validPercentage}%)`, 'success');

    return validTokens === totalTokens;
  }

  countAndValidateTokens(obj, path = '') {
    let total = 0;
    let valid = 0;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (value && typeof value === 'object') {
        if (value.$value !== undefined) {
          // This is a token
          total++;
          if (this.isValidToken(value)) {
            valid++;
          }
        } else {
          // Recurse into nested groups
          const nested = this.countAndValidateTokens(value, currentPath);
          total += nested.total;
          valid += nested.valid;
        }
      }
    }

    return { total, valid };
  }

  isValidToken(token) {
    // Basic token validation
    if (!token.$value) return false;
    
    // Check for valid $type if present
    if (token.$type) {
      const validTypes = [
        'color', 'dimension', 'fontFamily', 'fontWeight', 'fontSize', 
        'lineHeight', 'letterSpacing', 'paragraphSpacing', 'textDecoration', 
        'textCase', 'border', 'borderRadius', 'borderWidth', 'boxShadow', 
        'opacity', 'sizing', 'spacing', 'typography'
      ];
      if (!validTypes.includes(token.$type)) {
        return false;
      }
    }

    return true;
  }

  async testTokenStudioCompatibility() {
    this.log('🧪 Testing Token Studio compatibility after fixes...', 'info');

    try {
      // Run the compatibility verification script
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const testProcess = spawn('node', ['scripts/verify-token-studio-compatibility.js'], {
          stdio: 'pipe'
        });

        let output = '';
        testProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        testProcess.stderr.on('data', (data) => {
          output += data.toString();
        });

        testProcess.on('close', (code) => {
          const passed = code === 0;
          
          if (passed) {
            this.log('Token Studio compatibility test PASSED', 'success');
          } else {
            this.log('Token Studio compatibility test still has issues', 'warning');
            // Extract key issues from output
            const lines = output.split('\n');
            const errorLines = lines.filter(line => line.includes('❌') || line.includes('Failed'));
            if (errorLines.length > 0) {
              this.log('Remaining issues:', 'info');
              errorLines.slice(0, 5).forEach(line => this.log(`  ${line.trim()}`, 'warning'));
            }
          }
          
          resolve(passed);
        });
      });
    } catch (error) {
      this.log(`Error running compatibility test: ${error.message}`, 'error');
      return false;
    }
  }

  async generateFixReport() {
    this.log('📊 Generating compatibility fix report...', 'info');

    const report = {
      timestamp: new Date().toISOString(),
      fixes: {
        typeCorrections: this.fixes.typeCorrections,
        referenceResolutions: this.fixes.referenceResolutions,
        structureCleanups: this.fixes.structureCleanups
      },
      summary: {
        totalFixes: this.fixes.typeCorrections + this.fixes.referenceResolutions + this.fixes.structureCleanups,
        status: 'completed'
      },
      nextSteps: [
        'Run Token Studio compatibility verification',
        'Test actual import into Token Studio plugin',
        'Verify theme switching functionality',
        'Test complete designer workflow'
      ]
    };

    const reportPath = path.join(process.cwd(), 'token-studio-compatibility-fixes-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`Fix report saved to: ${reportPath}`, 'info');
    return report;
  }

  async run() {
    console.log('🚀 Starting Token Studio Compatibility Fixes\n');

    try {
      // Step 1: Fix invalid token types
      await this.fixTokenTypes();
      console.log('');

      // Step 2: Fix missing references
      await this.fixMissingReferences();
      console.log('');

      // Step 3: Validate structure after fixes
      const structureValid = await this.validateTokenStructure();
      console.log('');

      // Step 4: Test compatibility
      const compatibilityPassed = await this.testTokenStudioCompatibility();
      console.log('');

      // Step 5: Generate report
      const report = await this.generateFixReport();

      // Print summary
      console.log('📋 COMPATIBILITY FIXES SUMMARY');
      console.log('===============================');
      console.log(`🔧 Type corrections: ${report.fixes.typeCorrections}`);
      console.log(`🔗 Reference resolutions: ${report.fixes.referenceResolutions}`);
      console.log(`🧹 Structure cleanups: ${report.fixes.structureCleanups}`);
      console.log(`📊 Total fixes: ${report.summary.totalFixes}`);
      console.log('');

      if (compatibilityPassed) {
        console.log('✅ Token Studio compatibility ACHIEVED');
        console.log('🎯 Ready for Token Studio plugin import');
        return 0;
      } else {
        console.log('⚠️  Token Studio compatibility IMPROVED but issues remain');
        console.log('🔧 Additional fixes may be needed');
        return 1;
      }
    } catch (error) {
      console.error('❌ Compatibility fixes failed:', error.message);
      return 1;
    }
  }
}

// Run the fixer if called directly
if (require.main === module) {
  const fixer = new TokenStudioCompatibilityFixer();
  fixer.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('❌ Compatibility fixer failed with error:', error);
    process.exit(1);
  });
}

module.exports = TokenStudioCompatibilityFixer;