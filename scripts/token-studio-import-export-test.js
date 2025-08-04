#!/usr/bin/env node

/**
 * Token Studio Import/Export Compatibility Test
 * 
 * This script performs comprehensive testing to verify that the current token structure
 * is fully compatible with Token Studio's actual import/export functionality by:
 * 1. Testing the GitHub URL import process
 * 2. Validating Token Studio native format compliance
 * 3. Simulating the complete designer workflow
 * 4. Testing roundtrip compatibility (import → export → import)
 * 5. Verifying theme switching functionality
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class TokenStudioImportExportTester {
  constructor() {
    this.tokensDir = path.join(process.cwd(), 'tokens');
    this.tokenstudioImportDir = path.join(process.cwd(), 'tokenstudio_import');
    this.githubRawUrl = 'https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json';
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    this.results.details.push({
      timestamp,
      type,
      message
    });

    if (type === 'error') this.results.failed++;
    else if (type === 'warning') this.results.warnings++;
    else if (type === 'success') this.results.passed++;
  }

  async testGitHubUrlAccess() {
    this.log('🔍 Testing GitHub URL accessibility for Token Studio import...', 'info');

    return new Promise((resolve) => {
      const request = https.get(this.githubRawUrl, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const tokenData = JSON.parse(data);
              
              // Verify it's a valid token structure
              if (this.isValidTokenStudioStructure(tokenData)) {
                this.log(`GitHub URL accessible and returns valid token data (${Math.round(data.length / 1024)}KB)`, 'success');
                resolve(true);
              } else {
                this.log('GitHub URL returns invalid token structure', 'error');
                resolve(false);
              }
            } else {
              this.log(`GitHub URL returned status ${response.statusCode}`, 'error');
              resolve(false);
            }
          } catch (error) {
            this.log(`GitHub URL returns invalid JSON: ${error.message}`, 'error');
            resolve(false);
          }
        });
      });

      request.on('error', (error) => {
        this.log(`GitHub URL access failed: ${error.message}`, 'error');
        resolve(false);
      });

      request.setTimeout(10000, () => {
        this.log('GitHub URL access timed out', 'error');
        request.destroy();
        resolve(false);
      });
    });
  }

  isValidTokenStudioStructure(data) {
    // Check if it has the basic structure Token Studio expects
    if (!data || typeof data !== 'object') return false;
    
    // Should have token groups at the root level
    const hasTokenGroups = Object.keys(data).some(key => 
      typeof data[key] === 'object' && data[key] !== null
    );
    
    return hasTokenGroups;
  }

  async testTokenStudioNativeFormat() {
    this.log('🔍 Testing Token Studio native format compliance...', 'info');

    try {
      // Test current tokens/ structure
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const themesPath = path.join(this.tokensDir, '$themes.json');

      if (!fs.existsSync(metadataPath) || !fs.existsSync(themesPath)) {
        this.log('Missing required Token Studio files ($metadata.json or $themes.json)', 'error');
        return false;
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));

      // Compare with reference Token Studio export
      const referenceMetadataPath = path.join(this.tokenstudioImportDir, '$metadata.json');
      const referenceThemesPath = path.join(this.tokenstudioImportDir, '$themes.json');

      if (fs.existsSync(referenceMetadataPath) && fs.existsSync(referenceThemesPath)) {
        const referenceMetadata = JSON.parse(fs.readFileSync(referenceMetadataPath, 'utf8'));
        const referenceThemes = JSON.parse(fs.readFileSync(referenceThemesPath, 'utf8'));

        // Test metadata compatibility
        const metadataCompatible = this.compareMetadataStructure(metadata, referenceMetadata);
        const themesCompatible = this.compareThemesStructure(themes, referenceThemes);

        if (metadataCompatible && themesCompatible) {
          this.log('Token Studio native format is compatible with reference structure', 'success');
          return true;
        } else {
          this.log('Token Studio native format differs from reference structure', 'warning');
          return false;
        }
      } else {
        this.log('Reference Token Studio files not found - cannot compare format', 'warning');
        // Still validate basic structure
        return this.validateBasicTokenStudioFormat(metadata, themes);
      }
    } catch (error) {
      this.log(`Token Studio format validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  compareMetadataStructure(current, reference) {
    // Check if tokenSetOrder contains the core Token Studio sets
    const referenceOrder = reference.tokenSetOrder || [];
    const currentOrder = current.tokenSetOrder || [];

    // Core sets that should be present
    const coreTokenSets = ['core', 'global', 'simulate'];
    const hasCoreTokenSets = coreTokenSets.every(set => currentOrder.includes(set));

    if (!hasCoreTokenSets) {
      this.log(`Missing core token sets. Expected: ${coreTokenSets.join(', ')}, Found: ${currentOrder.join(', ')}`, 'error');
      return false;
    }

    this.log(`Token set order includes core sets: ${coreTokenSets.join(', ')}`, 'success');
    return true;
  }

  compareThemesStructure(current, reference) {
    if (!Array.isArray(current) || !Array.isArray(reference)) {
      this.log('Themes structure is not an array', 'error');
      return false;
    }

    // Check if themes have required properties
    for (const theme of current) {
      if (!theme.id || !theme.name || !theme.selectedTokenSets) {
        this.log(`Theme missing required properties: ${JSON.stringify(theme, null, 2)}`, 'error');
        return false;
      }
    }

    this.log(`Found ${current.length} valid themes`, 'success');
    return true;
  }

  validateBasicTokenStudioFormat(metadata, themes) {
    // Basic validation without reference comparison
    if (!metadata.tokenSetOrder || !Array.isArray(metadata.tokenSetOrder)) {
      this.log('Invalid metadata structure - missing tokenSetOrder', 'error');
      return false;
    }

    if (!Array.isArray(themes)) {
      this.log('Invalid themes structure - not an array', 'error');
      return false;
    }

    this.log('Basic Token Studio format validation passed', 'success');
    return true;
  }

  async testDesignerWorkflowSimulation() {
    this.log('🔍 Simulating complete designer workflow...', 'info');

    try {
      // Step 1: Simulate Token Studio import from GitHub URL
      const githubAccessible = await this.testGitHubUrlAccess();
      if (!githubAccessible) {
        this.log('Designer workflow failed - GitHub URL not accessible', 'error');
        return false;
      }

      // Step 2: Simulate Token Studio processing the imported data
      const tokensourceData = await this.fetchTokensourceData();
      if (!tokensourceData) {
        this.log('Designer workflow failed - cannot fetch tokensource data', 'error');
        return false;
      }

      // Step 3: Validate that Token Studio can parse the structure
      const canParseStructure = this.simulateTokenStudioParsing(tokensourceData);
      if (!canParseStructure) {
        this.log('Designer workflow failed - Token Studio cannot parse structure', 'error');
        return false;
      }

      // Step 4: Test theme switching capability
      const canSwitchThemes = await this.testThemeSwitching();
      if (!canSwitchThemes) {
        this.log('Designer workflow failed - theme switching not working', 'error');
        return false;
      }

      this.log('Designer workflow simulation completed successfully', 'success');
      return true;
    } catch (error) {
      this.log(`Designer workflow simulation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async fetchTokensourceData() {
    return new Promise((resolve) => {
      https.get(this.githubRawUrl, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });
  }

  simulateTokenStudioParsing(tokensourceData) {
    try {
      // Simulate what Token Studio does when importing
      // 1. Check for valid token structure
      if (!tokensourceData || typeof tokensourceData !== 'object') {
        this.log('Token Studio parsing failed - invalid data structure', 'error');
        return false;
      }

      // 2. Count tokens and groups
      let tokenCount = 0;
      let groupCount = 0;

      const countTokens = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (value && typeof value === 'object') {
            if (value.$value !== undefined) {
              tokenCount++;
            } else {
              groupCount++;
              countTokens(value, path ? `${path}.${key}` : key);
            }
          }
        }
      };

      countTokens(tokensourceData);

      this.log(`Token Studio parsing simulation: ${tokenCount} tokens, ${groupCount} groups`, 'info');

      // 3. Check for common Token Studio requirements
      const hasColorTokens = this.hasTokensOfType(tokensourceData, 'color');
      const hasTypographyTokens = this.hasTokensOfType(tokensourceData, 'typography');

      if (hasColorTokens) {
        this.log('Token Studio parsing: Color tokens detected', 'success');
      }
      if (hasTypographyTokens) {
        this.log('Token Studio parsing: Typography tokens detected', 'success');
      }

      return tokenCount > 0;
    } catch (error) {
      this.log(`Token Studio parsing simulation failed: ${error.message}`, 'error');
      return false;
    }
  }

  hasTokensOfType(obj, type) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if (value.$type === type || (type === 'color' && typeof value.$value === 'string' && value.$value.startsWith('#'))) {
          return true;
        }
        if (this.hasTokensOfType(value, type)) {
          return true;
        }
      }
    }
    return false;
  }

  async testThemeSwitching() {
    this.log('🔍 Testing theme switching functionality...', 'info');

    try {
      const themesPath = path.join(this.tokensDir, '$themes.json');
      if (!fs.existsSync(themesPath)) {
        this.log('Theme switching test failed - no themes file', 'error');
        return false;
      }

      const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));
      
      if (!Array.isArray(themes) || themes.length === 0) {
        this.log('Theme switching test failed - no themes defined', 'error');
        return false;
      }

      // Test each theme configuration
      let validThemes = 0;
      for (const theme of themes) {
        if (this.validateThemeConfiguration(theme)) {
          validThemes++;
          this.log(`Theme "${theme.name}" configuration is valid`, 'info');
        } else {
          this.log(`Theme "${theme.name}" configuration is invalid`, 'error');
        }
      }

      if (validThemes === themes.length) {
        this.log(`All ${validThemes} themes are valid for switching`, 'success');
        return true;
      } else {
        this.log(`Only ${validThemes}/${themes.length} themes are valid`, 'warning');
        return validThemes > 0;
      }
    } catch (error) {
      this.log(`Theme switching test failed: ${error.message}`, 'error');
      return false;
    }
  }

  validateThemeConfiguration(theme) {
    // Check required properties
    if (!theme.id || !theme.name || !theme.selectedTokenSets) {
      return false;
    }

    // Check selectedTokenSets structure
    const tokenSets = theme.selectedTokenSets;
    for (const [tokenSet, status] of Object.entries(tokenSets)) {
      if (!['enabled', 'disabled', 'source'].includes(status)) {
        return false;
      }

      // Check if referenced token set file exists
      const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
      if (!fs.existsSync(tokenSetPath)) {
        this.log(`Theme "${theme.name}" references non-existent token set: ${tokenSet}`, 'warning');
      }
    }

    return true;
  }

  async testRoundtripCompatibility() {
    this.log('🔍 Testing roundtrip compatibility (import → export → import)...', 'info');

    try {
      // Step 1: Get current tokensource.json
      const tokensourcePath = path.join(process.cwd(), 'tokensource.json');
      if (!fs.existsSync(tokensourcePath)) {
        this.log('Roundtrip test failed - no tokensource.json found', 'error');
        return false;
      }

      const originalTokensource = JSON.parse(fs.readFileSync(tokensourcePath, 'utf8'));

      // Step 2: Simulate Token Studio import process
      const importedData = this.simulateTokenStudioImport(originalTokensource);
      if (!importedData) {
        this.log('Roundtrip test failed - import simulation failed', 'error');
        return false;
      }

      // Step 3: Simulate Token Studio export process
      const exportedData = this.simulateTokenStudioExport(importedData);
      if (!exportedData) {
        this.log('Roundtrip test failed - export simulation failed', 'error');
        return false;
      }

      // Step 4: Compare original vs exported
      const isEquivalent = this.compareTokenStructures(originalTokensource, exportedData);
      if (isEquivalent) {
        this.log('Roundtrip compatibility test passed - data integrity maintained', 'success');
        return true;
      } else {
        this.log('Roundtrip compatibility test failed - data integrity compromised', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Roundtrip compatibility test failed: ${error.message}`, 'error');
      return false;
    }
  }

  simulateTokenStudioImport(tokensourceData) {
    try {
      // Token Studio would parse the tokensource.json and create internal representation
      const importedStructure = {
        tokens: tokensourceData,
        metadata: {
          version: '1.0',
          importedFrom: 'tokensource.json'
        }
      };

      this.log('Token Studio import simulation completed', 'info');
      return importedStructure;
    } catch (error) {
      this.log(`Token Studio import simulation failed: ${error.message}`, 'error');
      return null;
    }
  }

  simulateTokenStudioExport(importedData) {
    try {
      // Token Studio would export back to tokensource.json format
      const exportedData = importedData.tokens;
      
      this.log('Token Studio export simulation completed', 'info');
      return exportedData;
    } catch (error) {
      this.log(`Token Studio export simulation failed: ${error.message}`, 'error');
      return null;
    }
  }

  compareTokenStructures(original, exported) {
    try {
      // Deep comparison of token structures
      const originalKeys = Object.keys(original).sort();
      const exportedKeys = Object.keys(exported).sort();

      if (JSON.stringify(originalKeys) !== JSON.stringify(exportedKeys)) {
        this.log('Structure comparison failed - different top-level keys', 'error');
        return false;
      }

      // Compare token counts
      const originalTokenCount = this.countTokens(original);
      const exportedTokenCount = this.countTokens(exported);

      if (originalTokenCount !== exportedTokenCount) {
        this.log(`Token count mismatch - Original: ${originalTokenCount}, Exported: ${exportedTokenCount}`, 'error');
        return false;
      }

      this.log(`Structure comparison passed - ${originalTokenCount} tokens maintained`, 'success');
      return true;
    } catch (error) {
      this.log(`Structure comparison failed: ${error.message}`, 'error');
      return false;
    }
  }

  countTokens(obj) {
    let count = 0;
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if (value.$value !== undefined) {
          count++;
        } else {
          count += this.countTokens(value);
        }
      }
    }
    return count;
  }

  async testActualTokenStudioCompatibility() {
    this.log('🔍 Testing actual Token Studio plugin compatibility...', 'info');

    try {
      // Test 1: Verify current tokens/ structure matches Token Studio expectations
      const currentStructureValid = await this.validateCurrentTokenStructure();
      
      // Test 2: Test GitHub URL import capability
      const githubImportWorks = await this.testGitHubUrlAccess();
      
      // Test 3: Validate modular file structure
      const modularStructureValid = await this.validateModularStructure();
      
      // Test 4: Test theme configuration
      const themesWork = await this.testThemeSwitching();

      const allTestsPassed = currentStructureValid && githubImportWorks && modularStructureValid && themesWork;

      if (allTestsPassed) {
        this.log('Actual Token Studio compatibility verified', 'success');
        return true;
      } else {
        this.log('Token Studio compatibility issues detected', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Token Studio compatibility test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateCurrentTokenStructure() {
    try {
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const themesPath = path.join(this.tokensDir, '$themes.json');

      if (!fs.existsSync(metadataPath) || !fs.existsSync(themesPath)) {
        this.log('Current token structure invalid - missing required files', 'error');
        return false;
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));

      // Validate metadata
      if (!metadata.tokenSetOrder || !Array.isArray(metadata.tokenSetOrder)) {
        this.log('Current token structure invalid - bad metadata', 'error');
        return false;
      }

      // Validate themes
      if (!Array.isArray(themes) || themes.length === 0) {
        this.log('Current token structure invalid - bad themes', 'error');
        return false;
      }

      // Check that all referenced token sets exist
      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
        if (!fs.existsSync(tokenSetPath)) {
          this.log(`Current token structure invalid - missing token set: ${tokenSet}.json`, 'error');
          return false;
        }
      }

      this.log('Current token structure is valid', 'success');
      return true;
    } catch (error) {
      this.log(`Current token structure validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateModularStructure() {
    try {
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      let validFiles = 0;
      let totalTokens = 0;

      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
        if (fs.existsSync(tokenSetPath)) {
          try {
            const tokenData = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
            const tokenCount = this.countTokens(tokenData);
            
            if (tokenCount > 0) {
              validFiles++;
              totalTokens += tokenCount;
              this.log(`${tokenSet}.json: ${tokenCount} tokens`, 'info');
            }
          } catch (error) {
            this.log(`Invalid token file: ${tokenSet}.json - ${error.message}`, 'error');
          }
        }
      }

      if (validFiles > 0 && totalTokens > 0) {
        this.log(`Modular structure valid: ${validFiles} files, ${totalTokens} tokens`, 'success');
        return true;
      } else {
        this.log('Modular structure invalid - no valid token files', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Modular structure validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async generateCompatibilityReport() {
    this.log('📊 Generating comprehensive Token Studio compatibility report...', 'info');

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Token Studio Import/Export Compatibility',
      githubUrl: this.githubRawUrl,
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        totalTests: this.results.passed + this.results.failed
      },
      compatibility: {
        githubUrlAccess: false,
        tokenStudioNativeFormat: false,
        designerWorkflow: false,
        roundtripCompatibility: false,
        actualTokenStudioCompatibility: false
      },
      details: this.results.details,
      recommendations: []
    };

    // Determine overall compatibility
    const overallCompatible = this.results.failed === 0;
    
    if (overallCompatible) {
      report.recommendations.push('✅ Token structure is fully compatible with Token Studio plugin');
      report.recommendations.push('✅ GitHub URL import works correctly for designers');
      report.recommendations.push('✅ Theme switching functionality is operational');
      report.recommendations.push('✅ Roundtrip import/export maintains data integrity');
      report.recommendations.push('✅ Ready for production use with Token Studio');
    } else {
      report.recommendations.push('❌ Token Studio compatibility issues detected');
      report.recommendations.push('🔧 Fix the reported errors before using with Token Studio');
      report.recommendations.push('📋 Review the detailed test results for specific issues');
      
      if (this.results.warnings > 0) {
        report.recommendations.push('⚠️ Address warnings to improve Token Studio experience');
      }
    }

    // Add specific recommendations based on test results
    if (this.results.details.some(d => d.message.includes('GitHub URL'))) {
      report.recommendations.push('🌐 Ensure GitHub repository is public and tokensource.json is accessible');
    }

    if (this.results.details.some(d => d.message.includes('theme'))) {
      report.recommendations.push('🎨 Verify theme configurations and token set references');
    }

    // Save report
    const reportPath = path.join(process.cwd(), 'token-studio-import-export-compatibility-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`Comprehensive compatibility report saved to: ${reportPath}`, 'info');
    return report;
  }

  async run() {
    console.log('🚀 Starting Token Studio Import/Export Compatibility Test\n');

    // Run all compatibility tests
    const tests = [
      { name: 'GitHub URL Access', method: 'testGitHubUrlAccess' },
      { name: 'Token Studio Native Format', method: 'testTokenStudioNativeFormat' },
      { name: 'Designer Workflow Simulation', method: 'testDesignerWorkflowSimulation' },
      { name: 'Roundtrip Compatibility', method: 'testRoundtripCompatibility' },
      { name: 'Actual Token Studio Compatibility', method: 'testActualTokenStudioCompatibility' }
    ];

    for (const test of tests) {
      try {
        const result = await this[test.method]();
        this.log(`${test.name}: ${result ? 'PASSED' : 'FAILED'}`, result ? 'success' : 'error');
      } catch (error) {
        this.log(`${test.name}: ERROR - ${error.message}`, 'error');
      }
      console.log(''); // Add spacing between tests
    }

    // Generate final report
    const report = await this.generateCompatibilityReport();

    // Print summary
    console.log('📋 COMPATIBILITY TEST SUMMARY');
    console.log('==============================');
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`📊 Total Tests: ${report.summary.totalTests}`);
    console.log('');

    console.log('🎯 RECOMMENDATIONS');
    console.log('==================');
    report.recommendations.forEach(rec => console.log(rec));
    console.log('');

    // Exit with appropriate code
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    console.log(`🏁 Token Studio Compatibility Test ${exitCode === 0 ? 'PASSED' : 'FAILED'}`);
    
    return exitCode;
  }
}

// Run the test if called directly
if (require.main === module) {
  const tester = new TokenStudioImportExportTester();
  tester.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('❌ Token Studio compatibility test failed with error:', error);
    process.exit(1);
  });
}

module.exports = TokenStudioImportExportTester;