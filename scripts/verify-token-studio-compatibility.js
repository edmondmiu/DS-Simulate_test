#!/usr/bin/env node

/**
 * Token Studio Compatibility Verification Script
 * 
 * This script verifies that the current token structure is fully compatible
 * with Token Studio's native import/export format by testing:
 * 1. File structure compliance
 * 2. Metadata format validation
 * 3. Theme configuration validation
 * 4. Token syntax validation
 * 5. Reference resolution
 * 6. Import/export roundtrip testing
 */

const fs = require('fs');
const path = require('path');

class TokenStudioCompatibilityVerifier {
  constructor() {
    this.tokensDir = path.join(process.cwd(), 'tokens');
    this.tokenstudioImportDir = path.join(process.cwd(), 'tokenstudio_import');
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

  async verifyFileStructure() {
    this.log('🔍 Verifying Token Studio file structure...', 'info');

    // Check required files exist
    const requiredFiles = ['$metadata.json', '$themes.json'];
    const missingFiles = [];

    for (const file of requiredFiles) {
      const filePath = path.join(this.tokensDir, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      this.log(`Missing required files: ${missingFiles.join(', ')}`, 'error');
      return false;
    }

    this.log('All required Token Studio files present', 'success');
    return true;
  }

  async verifyMetadataFormat() {
    this.log('🔍 Verifying $metadata.json format...', 'info');

    try {
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Check required structure
      if (!metadata.tokenSetOrder || !Array.isArray(metadata.tokenSetOrder)) {
        this.log('$metadata.json missing or invalid tokenSetOrder array', 'error');
        return false;
      }

      // Verify all token sets in order have corresponding files
      const missingTokenSets = [];
      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetFile = path.join(this.tokensDir, `${tokenSet}.json`);
        if (!fs.existsSync(tokenSetFile)) {
          missingTokenSets.push(`${tokenSet}.json`);
        }
      }

      if (missingTokenSets.length > 0) {
        this.log(`Token sets referenced in metadata but missing files: ${missingTokenSets.join(', ')}`, 'error');
        return false;
      }

      // Compare with reference structure
      const referenceMetadataPath = path.join(this.tokenstudioImportDir, '$metadata.json');
      if (fs.existsSync(referenceMetadataPath)) {
        const referenceMetadata = JSON.parse(fs.readFileSync(referenceMetadataPath, 'utf8'));
        
        // Check if current structure matches reference structure
        const currentOrder = metadata.tokenSetOrder.slice(0, 5); // Compare first 5 which should match reference
        const referenceOrder = referenceMetadata.tokenSetOrder;
        
        const orderMatches = JSON.stringify(currentOrder.sort()) === JSON.stringify(referenceOrder.sort());
        if (!orderMatches) {
          this.log(`Token set order differs from Token Studio reference. Current: [${currentOrder.join(', ')}], Reference: [${referenceOrder.join(', ')}]`, 'warning');
        } else {
          this.log('Token set order matches Token Studio reference structure', 'success');
        }
      }

      this.log('$metadata.json format is valid', 'success');
      return true;
    } catch (error) {
      this.log(`Error reading $metadata.json: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyThemeConfiguration() {
    this.log('🔍 Verifying $themes.json configuration...', 'info');

    try {
      const themesPath = path.join(this.tokensDir, '$themes.json');
      const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));

      if (!Array.isArray(themes)) {
        this.log('$themes.json must be an array', 'error');
        return false;
      }

      let validThemes = 0;
      for (const theme of themes) {
        // Check required theme properties
        if (!theme.id || !theme.name || !theme.selectedTokenSets) {
          this.log(`Theme missing required properties (id, name, selectedTokenSets): ${JSON.stringify(theme, null, 2)}`, 'error');
          continue;
        }

        // Validate selectedTokenSets structure
        const tokenSets = theme.selectedTokenSets;
        let validTokenSets = true;

        for (const [tokenSet, status] of Object.entries(tokenSets)) {
          if (!['enabled', 'disabled', 'source'].includes(status)) {
            this.log(`Invalid token set status "${status}" for token set "${tokenSet}" in theme "${theme.name}"`, 'error');
            validTokenSets = false;
          }
        }

        if (validTokenSets) {
          validThemes++;
        }

        // Check for Figma references (optional but important for Token Studio)
        if (theme.$figmaStyleReferences && Object.keys(theme.$figmaStyleReferences).length > 0) {
          this.log(`Theme "${theme.name}" has ${Object.keys(theme.$figmaStyleReferences).length} Figma style references`, 'info');
        }
      }

      if (validThemes === 0) {
        this.log('No valid themes found in $themes.json', 'error');
        return false;
      }

      this.log(`Found ${validThemes} valid theme(s) in $themes.json`, 'success');
      return true;
    } catch (error) {
      this.log(`Error reading $themes.json: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyTokenSyntax() {
    this.log('🔍 Verifying token syntax in individual files...', 'info');

    try {
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      let validFiles = 0;
      let totalTokens = 0;
      let validTokens = 0;

      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
        
        if (!fs.existsSync(tokenSetPath)) {
          continue; // Already reported in metadata verification
        }

        try {
          const tokenData = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
          const fileTokenCount = this.validateTokenStructure(tokenData, tokenSet);
          
          if (fileTokenCount > 0) {
            validFiles++;
            totalTokens += fileTokenCount.total;
            validTokens += fileTokenCount.valid;
            this.log(`${tokenSet}.json: ${fileTokenCount.valid}/${fileTokenCount.total} tokens valid`, 'info');
          }
        } catch (error) {
          this.log(`Error parsing ${tokenSet}.json: ${error.message}`, 'error');
        }
      }

      if (validFiles === 0) {
        this.log('No valid token files found', 'error');
        return false;
      }

      const validPercentage = ((validTokens / totalTokens) * 100).toFixed(1);
      this.log(`Token syntax validation: ${validTokens}/${totalTokens} tokens valid (${validPercentage}%)`, 'success');
      
      return validTokens === totalTokens;
    } catch (error) {
      this.log(`Error during token syntax verification: ${error.message}`, 'error');
      return false;
    }
  }

  validateTokenStructure(tokenData, tokenSetName, path = '') {
    let totalCount = 0;
    let validCount = 0;

    for (const [key, value] of Object.entries(tokenData)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (this.isTokenDefinition(value)) {
        totalCount++;
        
        // Validate token structure
        if (this.validateToken(value, currentPath, tokenSetName)) {
          validCount++;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recurse into nested groups
        const nestedResult = this.validateTokenStructure(value, tokenSetName, currentPath);
        totalCount += nestedResult.total;
        validCount += nestedResult.valid;
      }
    }

    return { total: totalCount, valid: validCount };
  }

  isTokenDefinition(obj) {
    return obj && typeof obj === 'object' && obj.$value !== undefined;
  }

  validateToken(token, tokenPath, tokenSetName) {
    let isValid = true;

    // Check required properties
    if (!token.$value) {
      this.log(`Token ${tokenSetName}:${tokenPath} missing $value`, 'error');
      isValid = false;
    }

    // Validate $type if present
    if (token.$type) {
      const validTypes = ['color', 'dimension', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'textDecoration', 'textCase', 'border', 'borderRadius', 'borderWidth', 'boxShadow', 'opacity', 'sizing', 'spacing', 'typography'];
      if (!validTypes.includes(token.$type)) {
        this.log(`Token ${tokenSetName}:${tokenPath} has invalid $type: ${token.$type}`, 'warning');
      }
    }

    // Check for token references
    if (typeof token.$value === 'string' && token.$value.includes('{') && token.$value.includes('}')) {
      // This is a reference - we'll validate references separately
      this.log(`Token ${tokenSetName}:${tokenPath} contains reference: ${token.$value}`, 'info');
    }

    return isValid;
  }

  async verifyReferenceResolution() {
    this.log('🔍 Verifying token reference resolution...', 'info');

    try {
      // Load all token data
      const allTokens = {};
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
        if (fs.existsSync(tokenSetPath)) {
          allTokens[tokenSet] = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
        }
      }

      // Find and validate all references
      let totalReferences = 0;
      let resolvedReferences = 0;
      const unresolvedReferences = [];

      for (const [tokenSetName, tokenData] of Object.entries(allTokens)) {
        const references = this.findReferences(tokenData, tokenSetName);
        totalReferences += references.length;

        for (const ref of references) {
          if (this.resolveReference(ref.reference, allTokens)) {
            resolvedReferences++;
          } else {
            unresolvedReferences.push(`${tokenSetName}:${ref.path} -> ${ref.reference}`);
          }
        }
      }

      if (unresolvedReferences.length > 0) {
        this.log(`Unresolved references found:`, 'error');
        unresolvedReferences.forEach(ref => this.log(`  ${ref}`, 'error'));
        return false;
      }

      this.log(`Reference resolution: ${resolvedReferences}/${totalReferences} references resolved`, 'success');
      return true;
    } catch (error) {
      this.log(`Error during reference resolution verification: ${error.message}`, 'error');
      return false;
    }
  }

  findReferences(tokenData, tokenSetName, path = '') {
    const references = [];

    for (const [key, value] of Object.entries(tokenData)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (this.isTokenDefinition(value)) {
        if (typeof value.$value === 'string' && value.$value.includes('{') && value.$value.includes('}')) {
          const refMatch = value.$value.match(/\{([^}]+)\}/);
          if (refMatch) {
            references.push({
              path: currentPath,
              reference: refMatch[1],
              fullValue: value.$value
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        references.push(...this.findReferences(value, tokenSetName, currentPath));
      }
    }

    return references;
  }

  resolveReference(reference, allTokens) {
    // Simple reference resolution - check if the referenced token exists
    const parts = reference.split('.');
    
    for (const [tokenSetName, tokenData] of Object.entries(allTokens)) {
      let current = tokenData;
      let found = true;

      for (const part of parts) {
        if (current && typeof current === 'object' && current[part] !== undefined) {
          current = current[part];
        } else {
          found = false;
          break;
        }
      }

      if (found && this.isTokenDefinition(current)) {
        return true;
      }
    }

    return false;
  }

  async verifyImportExportRoundtrip() {
    this.log('🔍 Verifying import/export roundtrip compatibility...', 'info');

    try {
      // This test simulates what Token Studio would do:
      // 1. Read the current token structure
      // 2. Verify it can be parsed as Token Studio expects
      // 3. Check that all required elements are present

      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const themesPath = path.join(this.tokensDir, '$themes.json');

      if (!fs.existsSync(metadataPath) || !fs.existsSync(themesPath)) {
        this.log('Cannot perform roundtrip test - missing required files', 'error');
        return false;
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));

      // Simulate Token Studio import process
      const importedData = {
        metadata,
        themes,
        tokenSets: {}
      };

      // Load all token sets
      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
        if (fs.existsSync(tokenSetPath)) {
          importedData.tokenSets[tokenSet] = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
        }
      }

      // Verify the imported data structure matches Token Studio expectations
      const validationResults = this.validateImportedStructure(importedData);
      
      if (validationResults.isValid) {
        this.log('Import/export roundtrip validation passed', 'success');
        return true;
      } else {
        this.log(`Import/export roundtrip validation failed: ${validationResults.errors.join(', ')}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Error during roundtrip verification: ${error.message}`, 'error');
      return false;
    }
  }

  validateImportedStructure(importedData) {
    const errors = [];

    // Check metadata
    if (!importedData.metadata || !importedData.metadata.tokenSetOrder) {
      errors.push('Missing or invalid metadata');
    }

    // Check themes
    if (!importedData.themes || !Array.isArray(importedData.themes)) {
      errors.push('Missing or invalid themes array');
    }

    // Check token sets
    if (!importedData.tokenSets || Object.keys(importedData.tokenSets).length === 0) {
      errors.push('Missing token sets');
    }

    // Verify all referenced token sets exist
    if (importedData.metadata && importedData.metadata.tokenSetOrder) {
      for (const tokenSet of importedData.metadata.tokenSetOrder) {
        if (!importedData.tokenSets[tokenSet]) {
          errors.push(`Referenced token set "${tokenSet}" not found`);
        }
      }
    }

    // Verify themes reference valid token sets
    if (importedData.themes && Array.isArray(importedData.themes)) {
      for (const theme of importedData.themes) {
        if (theme.selectedTokenSets) {
          for (const tokenSet of Object.keys(theme.selectedTokenSets)) {
            if (!importedData.tokenSets[tokenSet]) {
              errors.push(`Theme "${theme.name}" references non-existent token set "${tokenSet}"`);
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async generateCompatibilityReport() {
    this.log('📊 Generating Token Studio compatibility report...', 'info');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        totalTests: this.results.passed + this.results.failed
      },
      compatibility: {
        fileStructure: false,
        metadataFormat: false,
        themeConfiguration: false,
        tokenSyntax: false,
        referenceResolution: false,
        importExportRoundtrip: false
      },
      details: this.results.details,
      recommendations: []
    };

    // Determine overall compatibility
    const overallCompatible = this.results.failed === 0;
    
    if (overallCompatible) {
      report.recommendations.push('✅ Token structure is fully compatible with Token Studio');
      report.recommendations.push('✅ Ready for import into Token Studio plugin');
      report.recommendations.push('✅ Can be used as GitHub URL source for designers');
    } else {
      report.recommendations.push('❌ Token structure has compatibility issues');
      report.recommendations.push('🔧 Fix the reported errors before using with Token Studio');
      
      if (this.results.warnings > 0) {
        report.recommendations.push('⚠️ Address warnings to improve Token Studio experience');
      }
    }

    // Save report
    const reportPath = path.join(process.cwd(), 'token-studio-compatibility-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`Compatibility report saved to: ${reportPath}`, 'info');
    return report;
  }

  async run() {
    console.log('🚀 Starting Token Studio Compatibility Verification\n');

    // Run all verification tests
    const tests = [
      { name: 'File Structure', method: 'verifyFileStructure' },
      { name: 'Metadata Format', method: 'verifyMetadataFormat' },
      { name: 'Theme Configuration', method: 'verifyThemeConfiguration' },
      { name: 'Token Syntax', method: 'verifyTokenSyntax' },
      { name: 'Reference Resolution', method: 'verifyReferenceResolution' },
      { name: 'Import/Export Roundtrip', method: 'verifyImportExportRoundtrip' }
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
    console.log('📋 VERIFICATION SUMMARY');
    console.log('========================');
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
    console.log(`🏁 Verification ${exitCode === 0 ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH ERRORS'}`);
    
    return exitCode;
  }
}

// Run the verification if called directly
if (require.main === module) {
  const verifier = new TokenStudioCompatibilityVerifier();
  verifier.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
  });
}

module.exports = TokenStudioCompatibilityVerifier;