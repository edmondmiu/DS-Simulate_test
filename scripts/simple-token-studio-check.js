#!/usr/bin/env node

/**
 * Simple Token Studio Compatibility Check
 * 
 * A lightweight script that performs basic Token Studio compatibility validation
 * without the complex operations that cause VS Code crashes.
 */

const fs = require('fs');
const path = require('path');

class SimpleTokenStudioCheck {
  constructor() {
    this.tokensDir = path.join(process.cwd(), 'tokens');
    this.results = [];
  }

  log(message, status = 'info') {
    const prefix = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} ${message}`);
    this.results.push({ message, status });
  }

  checkRequiredFiles() {
    this.log('Checking required Token Studio files...', 'info');
    
    const requiredFiles = ['$metadata.json', '$themes.json'];
    let allPresent = true;

    for (const file of requiredFiles) {
      const filePath = path.join(this.tokensDir, file);
      if (fs.existsSync(filePath)) {
        this.log(`${file} exists`, 'pass');
      } else {
        this.log(`${file} missing`, 'fail');
        allPresent = false;
      }
    }

    return allPresent;
  }

  checkMetadataStructure() {
    this.log('Checking $metadata.json structure...', 'info');
    
    try {
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      if (metadata.tokenSetOrder && Array.isArray(metadata.tokenSetOrder)) {
        this.log(`Token set order: [${metadata.tokenSetOrder.join(', ')}]`, 'pass');
        
        // Check if core token sets are present
        const coreTokenSets = ['core', 'global', 'simulate'];
        const hasCoreTokenSets = coreTokenSets.every(set => metadata.tokenSetOrder.includes(set));
        
        if (hasCoreTokenSets) {
          this.log('Core token sets present (core, global, simulate)', 'pass');
        } else {
          this.log('Missing some core token sets', 'warn');
        }
        
        return true;
      } else {
        this.log('Invalid tokenSetOrder in metadata', 'fail');
        return false;
      }
    } catch (error) {
      this.log(`Error reading metadata: ${error.message}`, 'fail');
      return false;
    }
  }

  checkThemesStructure() {
    this.log('Checking $themes.json structure...', 'info');
    
    try {
      const themesPath = path.join(this.tokensDir, '$themes.json');
      const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));

      if (Array.isArray(themes)) {
        this.log(`Found ${themes.length} theme(s)`, 'pass');
        
        let validThemes = 0;
        for (const theme of themes) {
          if (theme.id && theme.name && theme.selectedTokenSets) {
            validThemes++;
          }
        }
        
        this.log(`${validThemes}/${themes.length} themes have valid structure`, validThemes === themes.length ? 'pass' : 'warn');
        return validThemes > 0;
      } else {
        this.log('Themes is not an array', 'fail');
        return false;
      }
    } catch (error) {
      this.log(`Error reading themes: ${error.message}`, 'fail');
      return false;
    }
  }

  checkTokenSetFiles() {
    this.log('Checking token set files...', 'info');
    
    try {
      const metadataPath = path.join(this.tokensDir, '$metadata.json');
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      let existingFiles = 0;
      let totalTokens = 0;

      for (const tokenSet of metadata.tokenSetOrder) {
        const tokenSetPath = path.join(this.tokensDir, `${tokenSet}.json`);
        if (fs.existsSync(tokenSetPath)) {
          existingFiles++;
          try {
            const tokenData = JSON.parse(fs.readFileSync(tokenSetPath, 'utf8'));
            const tokenCount = this.countTokens(tokenData);
            totalTokens += tokenCount;
            this.log(`${tokenSet}.json: ${tokenCount} tokens`, 'pass');
          } catch (error) {
            this.log(`${tokenSet}.json: Invalid JSON`, 'fail');
          }
        } else {
          this.log(`${tokenSet}.json: Missing`, 'warn');
        }
      }

      this.log(`Total: ${existingFiles}/${metadata.tokenSetOrder.length} files, ${totalTokens} tokens`, 'info');
      return existingFiles > 0;
    } catch (error) {
      this.log(`Error checking token set files: ${error.message}`, 'fail');
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

  checkGitHubUrl() {
    this.log('Checking GitHub URL format...', 'info');
    
    const expectedUrl = 'https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json';
    this.log(`Expected URL: ${expectedUrl}`, 'info');
    this.log('Manual verification required: Test this URL in Token Studio', 'warn');
    
    return true; // We can't test this without network requests
  }

  run() {
    console.log('🚀 Simple Token Studio Compatibility Check\n');

    const checks = [
      { name: 'Required Files', method: 'checkRequiredFiles' },
      { name: 'Metadata Structure', method: 'checkMetadataStructure' },
      { name: 'Themes Structure', method: 'checkThemesStructure' },
      { name: 'Token Set Files', method: 'checkTokenSetFiles' },
      { name: 'GitHub URL', method: 'checkGitHubUrl' }
    ];

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
      console.log(`\n--- ${check.name} ---`);
      try {
        const result = this[check.method]();
        if (result) passed++;
        else failed++;
      } catch (error) {
        this.log(`${check.name} failed: ${error.message}`, 'fail');
        failed++;
      }
    }

    console.log('\n📋 SUMMARY');
    console.log('===========');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${passed + failed}`);

    if (failed === 0) {
      console.log('\n🎉 Basic Token Studio compatibility verified!');
      console.log('📝 Manual verification still needed:');
      console.log('   1. Test GitHub URL import in Token Studio');
      console.log('   2. Verify theme switching works');
      console.log('   3. Test token editing and export');
    } else {
      console.log('\n⚠️ Some compatibility issues found.');
      console.log('🔧 Fix the failed checks before using with Token Studio.');
    }

    return failed === 0 ? 0 : 1;
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new SimpleTokenStudioCheck();
  const exitCode = checker.run();
  process.exit(exitCode);
}

module.exports = SimpleTokenStudioCheck;