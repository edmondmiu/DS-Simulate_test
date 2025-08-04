#!/usr/bin/env node

/**
 * Migration Commands - Handle migration to GitHub-centered Token Studio workflow
 * 
 * This script provides commands for migrating from the old workflow to the new one:
 * - migrate: Perform complete migration with validation and backup
 * - migrate:rollback: Rollback migration to previous state
 * - migrate:status: Check current migration status
 * - migrate:validate: Validate migration readiness
 * 
 * Requirements addressed: 9.1, 9.2, 9.3, 9.4, 9.5
 */

const MigrationSystem = require('../src/MigrationSystem');

// CLI Interface
async function main() {
  const command = process.argv[2];
  const flags = process.argv.slice(3);
  
  const options = {
    verbose: flags.includes('--verbose') || flags.includes('-v'),
    dryRun: flags.includes('--dry-run'),
    force: flags.includes('--force')
  };

  const migration = new MigrationSystem();
  let result;

  try {
    switch (command) {
      case 'migrate':
        result = await migration.performMigration(options);
        break;
      
      case 'migrate:rollback':
        const state = await migration.getMigrationState();
        if (!state || !state.backupPath) {
          result = {
            success: false,
            message: 'No migration backup found to rollback to',
            details: { state }
          };
        } else {
          result = await migration.rollbackMigration(state.backupPath);
        }
        break;
      
      case 'migrate:status':
        const currentState = await migration.getMigrationState();
        if (currentState) {
          result = {
            success: true,
            message: `Migration status: ${currentState.state}`,
            details: currentState
          };
          
          console.log(`\n📊 Migration Status: ${currentState.state.toUpperCase()}`);
          console.log(`⏰ Last Updated: ${currentState.timestamp}`);
          
          if (currentState.backupPath) {
            console.log(`💾 Backup Location: ${currentState.backupPath}`);
          }
          
          if (currentState.state === 'completed') {
            console.log('✅ Migration completed successfully');
          } else if (currentState.state === 'rolled_back') {
            console.log('🔄 Migration was rolled back');
          } else if (currentState.state === 'in_progress') {
            console.log('⚠️  Migration is in progress or was interrupted');
          }
        } else {
          result = {
            success: true,
            message: 'No migration has been performed yet',
            details: { state: 'not_started' }
          };
          console.log('\n📊 Migration Status: NOT STARTED');
          console.log('Run "npm run migrate" to begin migration');
        }
        break;
      
      case 'migrate:validate':
        result = await migration.validatePreMigration();
        
        if (result.success) {
          console.log('\n✅ Pre-migration validation passed');
          console.log('Your system is ready for migration');
          
          if (options.verbose) {
            console.log('\n📋 Validation Details:');
            console.log(`   tokensource.json: ${result.details.sourceValid ? '✅ Valid' : '❌ Invalid'}`);
            console.log(`   Existing functionality: ${result.details.functionalityValid ? '✅ Working' : '❌ Issues detected'}`);
            console.log(`   Required scripts: ${result.details.scriptsPresent ? '✅ Present' : '❌ Missing'}`);
            console.log(`   Backup capability: ${result.details.backupCapable ? '✅ Available' : '❌ Not available'}`);
          }
        } else {
          console.log('\n❌ Pre-migration validation failed');
          console.log('Please fix the following issues before migrating:');
          
          if (!result.details.sourceValid) {
            console.log('   - tokensource.json is missing or invalid');
          }
          if (!result.details.functionalityValid) {
            console.log('   - Existing functionality is not working properly');
          }
          if (!result.details.scriptsPresent) {
            console.log('   - Required scripts are missing from package.json');
          }
          if (!result.details.backupCapable) {
            console.log('   - Cannot create backups (check file permissions)');
          }
        }
        break;
      
      // Consolidated command aliases for simplified interface
      case 'rollback':
        const state2 = await migration.getMigrationState();
        if (!state2 || !state2.backupPath) {
          result = {
            success: false,
            message: 'No migration backup found to rollback to',
            details: { state: state2 }
          };
        } else {
          result = await migration.rollbackMigration(state2.backupPath);
        }
        break;
      
      case 'status':
        result = await migration.getMigrationStatus(options);
        break;
      
      case 'validate':
        result = await migration.validatePreMigration();
        
        if (result.success) {
          console.log('\n✅ Pre-migration validation passed');
          console.log('Your system is ready for migration');
          
          if (options.verbose) {
            console.log('\n📋 Validation Details:');
            console.log(`   tokensource.json: ${result.details.sourceValid ? '✅ Valid' : '❌ Invalid'}`);
            console.log(`   Existing functionality: ${result.details.functionalityValid ? '✅ Working' : '❌ Issues detected'}`);
            console.log(`   Required scripts: ${result.details.scriptsPresent ? '✅ Present' : '❌ Missing'}`);
            console.log(`   Backup capability: ${result.details.backupCapable ? '✅ Available' : '❌ Not available'}`);
          }
        } else {
          console.log('\n❌ Pre-migration validation failed');
          console.log('Please fix the following issues before migrating:');
          
          if (!result.details.sourceValid) {
            console.log('   - tokensource.json is missing or invalid');
          }
          if (!result.details.functionalityValid) {
            console.log('   - Existing functionality is not working properly');
          }
          if (!result.details.scriptsPresent) {
            console.log('   - Required scripts are missing from package.json');
          }
          if (!result.details.backupCapable) {
            console.log('   - Cannot create backups (check file permissions)');
          }
        }
        break;
      
      default:
        if (!command) {
          console.log(`
Migration Commands for Token Studio Workflow

Usage: npm run migrate <command> [options]

Commands:
  migrate                 Perform complete migration to new workflow
  rollback                Rollback migration to previous state
  status                  Check current migration status
  validate                Validate system readiness for migration

Legacy Commands (still supported):
  migrate:rollback        Same as rollback
  migrate:status          Same as status
  migrate:validate        Same as validate

Options:
  --verbose, -v          Show detailed progress and information
  --dry-run              Show what would be done without making changes
  --force                Force migration even if validation warnings exist

Examples:
  npm run migrate validate -- --verbose
  npm run migrate migrate -- --dry-run
  npm run migrate migrate -- --verbose
  npm run migrate status
  npm run migrate rollback

Migration Process:
  1. Run "npm run migrate validate" to check readiness
  2. Run "npm run migrate migrate -- --dry-run" to preview changes
  3. Run "npm run migrate migrate" to perform actual migration
  4. Use "npm run migrate status" to check progress
  5. Use "npm run migrate rollback" if issues occur

For detailed migration information, see docs/MIGRATION_GUIDE.md
        `);
        } else {
          console.log(`Unknown migration command: ${command}`);
          console.log('Run "npm run migrate" to see available commands.');
        }
        process.exit(0);
    }

    if (result.success) {
      if (command !== 'migrate:status') {
        console.log(`\n✅ ${result.message}`);
      }
      process.exit(0);
    } else {
      console.error(`\n❌ ${result.message}`);
      if (options.verbose && result.details) {
        console.error('\nDetails:', JSON.stringify(result.details, null, 2));
      }
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n💥 Unexpected error: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

module.exports = { main };