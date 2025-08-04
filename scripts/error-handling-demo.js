#!/usr/bin/env node

/**
 * Error Handling System Demonstration
 * 
 * This script demonstrates the key features of the error handling and recovery system:
 * - Automatic backup creation
 * - Rollback capabilities
 * - Partial recovery
 * - Error reporting
 * - Logging and debugging
 */

const fs = require('fs').promises;
const path = require('path');
const ErrorHandlingSystem = require('../src/ErrorHandlingSystem');
const WorkflowCommands = require('./workflow-commands');

async function demonstrateErrorHandling() {
  console.log('🚀 Error Handling System Demonstration\n');
  
  const errorHandler = new ErrorHandlingSystem({
    backupDir: '.demo-backups',
    logDir: '.demo-logs',
    debugMode: true
  });

  const workflowCommands = new WorkflowCommands();

  try {
    // 1. Demonstrate Automatic Backup System
    console.log('📦 1. Automatic Backup System');
    console.log('─'.repeat(40));
    
    // Create a test file
    const testFile = 'demo-tokens.json';
    const testData = {
      color: {
        primary: { $type: 'color', $value: '#007bff' },
        secondary: { $type: 'color', $value: '#6c757d' }
      }
    };
    
    await fs.writeFile(testFile, JSON.stringify(testData, null, 2));
    console.log('✓ Created test file:', testFile);
    
    // Create backup
    const backupResult = await errorHandler.createOperationBackup('demo', testFile, {
      purpose: 'demonstration',
      user: 'demo-user'
    });
    
    if (backupResult.success) {
      console.log('✓ Backup created successfully');
      console.log('  Backup ID:', backupResult.backupId);
      console.log('  Backup Path:', backupResult.backupPath);
    } else {
      console.log('✗ Backup failed:', backupResult.errors.join(', '));
    }

    // 2. Demonstrate Backup Listing
    console.log('\n📋 2. Backup Management');
    console.log('─'.repeat(40));
    
    const { backups } = await errorHandler.listBackups();
    console.log(`✓ Found ${backups.length} backup(s)`);
    
    if (backups.length > 0) {
      const latestBackup = backups[0];
      console.log('  Latest backup:');
      console.log('    ID:', latestBackup.id);
      console.log('    Type:', latestBackup.type);
      console.log('    Files:', latestBackup.fileCount);
      console.log('    Date:', new Date(latestBackup.timestamp).toLocaleString());
    }

    // 3. Demonstrate File Modification and Rollback
    console.log('\n🔄 3. Rollback Capability');
    console.log('─'.repeat(40));
    
    // Modify the test file
    const modifiedData = {
      color: {
        primary: { $type: 'color', $value: '#ff0000' }, // Changed to red
        secondary: { $type: 'color', $value: '#00ff00' }, // Changed to green
        tertiary: { $type: 'color', $value: '#0000ff' } // Added blue
      }
    };
    
    await fs.writeFile(testFile, JSON.stringify(modifiedData, null, 2));
    console.log('✓ Modified test file (changed colors, added tertiary)');
    
    // Demonstrate rollback
    if (backups.length > 0) {
      const rollbackResult = await errorHandler.rollbackToBackup(backups[0].id, {
        dryRun: true // First do a dry run
      });
      
      if (rollbackResult.success) {
        console.log('✓ Dry run rollback successful');
        console.log('  Would restore:', rollbackResult.restoredFiles.join(', '));
        
        // Now do actual rollback
        const actualRollback = await errorHandler.rollbackToBackup(backups[0].id);
        if (actualRollback.success) {
          console.log('✓ Actual rollback completed');
          console.log('  Restored files:', actualRollback.restoredFiles.join(', '));
        }
      }
    }

    // 4. Demonstrate Error Reporting
    console.log('\n🚨 4. Error Reporting System');
    console.log('─'.repeat(40));
    
    // Create a sample error
    const sampleError = new Error('Sample token reference not found: {color.nonexistent}');
    const errorReport = await errorHandler.generateErrorReport(sampleError, {
      operationType: 'consolidate',
      file: 'tokens/components.json',
      tokenPath: 'button.background'
    });
    
    console.log('✓ Error report generated');
    console.log('  Error:', errorReport.report.error.message);
    console.log('  Severity:', errorReport.report.severity);
    console.log('  Suggestions:');
    errorReport.suggestions.forEach(suggestion => {
      console.log('    -', suggestion);
    });

    // 5. Demonstrate Partial Recovery
    console.log('\n🛠️  5. Partial Recovery System');
    console.log('─'.repeat(40));
    
    // Create a problematic scenario
    await fs.mkdir('demo-tokens', { recursive: true });
    
    // Missing $metadata.json (will be recovered)
    await fs.writeFile('demo-tokens/core.json', JSON.stringify({
      color: {
        primary: {
          $value: '#007bff' // Missing $type - will be inferred
        }
      }
    }, null, 2));
    
    // Invalid JSON file (will be repaired)
    await fs.writeFile('demo-tokens/invalid.json', '{"test": "value",}'); // Trailing comma
    
    console.log('✓ Created problematic token files');
    
    // Simulate validation result
    const mockValidationResult = {
      issues: [
        {
          type: 'missing_required_file',
          file: '$metadata.json',
          severity: 'error'
        },
        {
          type: 'missing_token_type',
          file: 'demo-tokens/core.json',
          path: 'color.primary',
          severity: 'warning'
        },
        {
          type: 'invalid_json',
          file: 'demo-tokens/invalid.json',
          severity: 'error'
        }
      ]
    };
    
    const recoveryResult = await errorHandler.attemptPartialRecovery(mockValidationResult, {
      autoFix: true,
      backupFirst: false
    });
    
    if (recoveryResult.success) {
      console.log('✓ Partial recovery completed');
      console.log(`  Recovered ${recoveryResult.recoveredItems.length} items:`);
      recoveryResult.recoveredItems.forEach(item => {
        console.log(`    - ${item.action}: ${item.issue || item.file}`);
      });
    }

    // 6. Demonstrate Logging
    console.log('\n📝 6. Logging and Debugging');
    console.log('─'.repeat(40));
    
    const operationId = errorHandler.startOperation('demo-operation', {
      purpose: 'demonstration',
      files: [testFile]
    });
    
    console.log('✓ Started operation tracking:', operationId);
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await errorHandler.completeOperation(operationId, {
      success: true,
      filesProcessed: 1
    });
    
    console.log('✓ Operation completed and logged');
    
    // Check if log files were created
    try {
      const logFiles = await fs.readdir('.demo-logs');
      console.log('✓ Log files created:', logFiles.join(', '));
    } catch (error) {
      console.log('ℹ️  Log directory not accessible (this is normal in some environments)');
    }

    console.log('\n✨ Demonstration Complete!');
    console.log('\nThe error handling system provides:');
    console.log('• Automatic backups before risky operations');
    console.log('• Safe rollback to previous states');
    console.log('• Intelligent recovery from common issues');
    console.log('• Detailed error reporting with suggestions');
    console.log('• Comprehensive logging for debugging');
    console.log('\nAll features are integrated into the workflow commands.');

  } catch (error) {
    console.error('\n❌ Demonstration failed:', error.message);
    
    // Even in failure, demonstrate error reporting
    const errorReport = await errorHandler.generateErrorReport(error, {
      operationType: 'demonstration',
      step: 'unknown'
    });
    
    console.log('\n🔍 Error Analysis:');
    console.log('Severity:', errorReport.report.severity);
    console.log('Suggestions:');
    errorReport.suggestions.forEach(suggestion => {
      console.log('  -', suggestion);
    });
  } finally {
    // Cleanup demo files
    try {
      await fs.unlink('demo-tokens.json').catch(() => {});
      await fs.rm('demo-tokens', { recursive: true, force: true }).catch(() => {});
      await fs.rm('.demo-backups', { recursive: true, force: true }).catch(() => {});
      await fs.rm('.demo-logs', { recursive: true, force: true }).catch(() => {});
      console.log('\n🧹 Cleanup completed');
    } catch (error) {
      console.log('\n⚠️  Cleanup had issues (this is normal)');
    }
  }
}

// Run demonstration if called directly
if (require.main === module) {
  demonstrateErrorHandling().catch(console.error);
}

module.exports = { demonstrateErrorHandling };