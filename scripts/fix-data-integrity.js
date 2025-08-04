#!/usr/bin/env node

/**
 * Data Integrity Fix Script
 * 
 * This script fixes data integrity issues in the token system by:
 * - Resolving broken token references
 * - Standardizing token naming conventions
 * - Ensuring all references point to existing tokens
 * 
 * This addresses the migration requirement for data loss prevention.
 */

const fs = require('fs').promises;
const path = require('path');

class DataIntegrityFixer {
  constructor() {
    this.fixes = [];
    this.errors = [];
  }

  async fixDataIntegrity() {
    console.log('🔧 Starting data integrity fixes...');
    
    try {
      // Step 1: Read current tokensource.json
      const tokensourceContent = await fs.readFile('tokensource.json', 'utf8');
      const tokensource = JSON.parse(tokensourceContent);
      
      // Step 2: Identify and fix reference issues
      const fixedTokensource = await this.fixTokenReferences(tokensource);
      
      // Step 3: Create backup before fixing
      const backupPath = await this.createBackup(tokensourceContent);
      console.log(`📦 Created backup: ${backupPath}`);
      
      // Step 4: Write fixed tokensource
      await fs.writeFile('tokensource.json', JSON.stringify(fixedTokensource, null, 2));
      
      // Step 5: Report fixes
      console.log(`✅ Applied ${this.fixes.length} fixes`);
      this.fixes.forEach(fix => {
        console.log(`   - ${fix}`);
      });
      
      if (this.errors.length > 0) {
        console.log(`⚠️  ${this.errors.length} issues could not be automatically fixed:`);
        this.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }
      
      return {
        success: true,
        fixesApplied: this.fixes.length,
        errorsRemaining: this.errors.length,
        backupPath
      };
      
    } catch (error) {
      console.error('❌ Data integrity fix failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fixTokenReferences(tokensource) {
    const fixed = JSON.parse(JSON.stringify(tokensource)); // Deep clone
    
    // Map of known broken references to their correct values
    const referenceMap = {
      // Font Family fixes
      '{FontFamily.heading}': '{fontFamilies.Roboto}',
      '{FontFamily.body}': '{fontFamilies.Roboto}',
      
      // Font Weight fixes - map to existing roboto weights
      '{fontWeights.roboto-0}': '{fontWeights.roboto.light}',
      '{fontWeights.roboto-1}': '{fontWeights.roboto.regular}',
      '{fontWeights.roboto-2}': '{fontWeights.roboto.medium}',
      '{fontWeights.roboto-3}': '{fontWeights.roboto.bold}',
      
      // Line Height fixes - map to existing line heights
      '{lineHeights.0}': '{lineHeights.tight}',
      '{lineHeights.1}': '{lineHeights.normal}',
      '{lineHeights.2}': '{lineHeights.loose}',
      
      // Font Size fixes - map to existing font sizes
      '{fontSizes.4xl}': '{fontSizes.xxl}',
      
      // Letter Spacing fixes
      '{letterSpacing.0}': '{letterSpacing.normal}'
    };
    
    // Apply fixes recursively
    this.applyReferenceFixes(fixed, referenceMap);
    
    return fixed;
  }

  applyReferenceFixes(obj, referenceMap, path = '') {
    if (typeof obj === 'string') {
      // Check if this string contains any broken references
      let fixedString = obj;
      let wasFixed = false;
      
      Object.entries(referenceMap).forEach(([broken, correct]) => {
        if (fixedString === broken) {
          fixedString = correct;
          wasFixed = true;
        }
      });
      
      if (wasFixed) {
        this.fixes.push(`Fixed reference in ${path}: ${obj} → ${fixedString}`);
        return fixedString;
      }
      
      return obj;
    } else if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        this.applyReferenceFixes(item, referenceMap, `${path}[${index}]`)
      );
    } else if (obj && typeof obj === 'object') {
      const result = {};
      Object.entries(obj).forEach(([key, value]) => {
        result[key] = this.applyReferenceFixes(value, referenceMap, path ? `${path}.${key}` : key);
      });
      return result;
    }
    
    return obj;
  }

  async createBackup(content) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `.backups/data-integrity-fix-${timestamp}.json`;
    
    await fs.mkdir('.backups', { recursive: true });
    await fs.writeFile(backupPath, content);
    
    return backupPath;
  }
}

// CLI interface
async function main() {
  const fixer = new DataIntegrityFixer();
  const result = await fixer.fixDataIntegrity();
  
  if (result.success) {
    console.log('\n🎉 Data integrity fixes completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run validate-workflow-integrity');
    console.log('2. Test the workflow: npm run workflow:start');
    console.log('3. Verify no data loss occurred');
    process.exit(0);
  } else {
    console.error('\n❌ Data integrity fixes failed');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DataIntegrityFixer;