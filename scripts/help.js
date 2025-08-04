#!/usr/bin/env node

/**
 * Help script - displays available commands and their usage
 * This script provides documentation for the consolidated workflow commands
 */

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function showHelp() {
  log('🚀 DS-Simulate Token Studio Workflow Commands', 'bold');
  log('=' .repeat(60), 'blue');
  
  log('\n📦 BUILD COMMANDS', 'cyan');
  log('  npm run build                 - Build Style Dictionary output', 'green');
  log('  npm run build:themes          - Build theme-specific outputs', 'green');
  log('  npm run build:all             - Build everything (styles + themes)', 'green');
  log('  npm run build:watch           - Watch tokensource.json for changes', 'green');
  log('  npm run clean                 - Clean build outputs', 'green');
  
  log('\n🔄 WORKFLOW COMMANDS', 'cyan');
  log('  npm run workflow:start              - Complete setup for editing', 'green');
  log('  npm run workflow:finish             - Consolidate and validate', 'green');
  log('  npm run workflow <command>          - Run specific workflow command', 'green');
  log('    Available commands: split-source-to-tokens, consolidate-to-source,', 'yellow');
  log('    sync-from-github, validate-workflow-integrity, generate-github-url,', 'yellow');
  log('    validate-github-integration, manage-branch, test-designer-import', 'yellow');
  
  log('\n🤖 AI WORKFLOW COMMANDS', 'cyan');
  log('  npm run ai <command>                - Run AI workflow command', 'green');
  log('    Available commands: init-session, validate-changes,', 'yellow');
  log('    auto-consolidate, test-workflow', 'yellow');
  
  log('\n🔄 MIGRATION COMMANDS', 'cyan');
  log('  npm run migrate <command>           - Run migration command', 'green');
  log('    Available commands: migrate, validate, status, rollback', 'yellow');
  
  log('\n✅ VALIDATION & TESTING', 'cyan');
  log('  npm run validate                    - Comprehensive Token Studio validation', 'green');
  log('  npm run test                        - Run all tests', 'green');
  log('  npm run test:watch                  - Run tests in watch mode', 'green');
  log('  npm run test:coverage               - Run tests with coverage', 'green');
  log('  npm run test:ci                     - Run tests for CI/CD', 'green');
  
  log('\n📤 PUBLISHING', 'cyan');
  log('  npm run publish                     - Publish tokens to distribution', 'green');
  
  log('\n📚 WORKFLOW GUIDE', 'yellow');
  log('  1. Start editing session:     npm run workflow:start', 'blue');
  log('  2. Edit tokens in tokens/     (Token Studio native format)', 'blue');
  log('     • core.json         - Foundation tokens (Color Ramp)', 'blue');
  log('     • global.json       - Semantic tokens (header, body, etc.)', 'blue');
  log('     • simulate.json     - Brand-specific tokens', 'blue');
  log('     • components.json   - Component tokens (buttons, etc.)', 'blue');
  log('  3. Finish editing session:    npm run workflow:finish', 'blue');
  log('  4. Commit and push changes    (tokensource.json updated)', 'blue');
  log('  5. Designers import from:     GitHub raw URL', 'blue');
  
  log('\n🔗 DESIGNER IMPORT URL', 'yellow');
  log('  https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json', 'blue');
  
  log('\n💡 TIPS', 'yellow');
  log('  • Use workflow:start/finish for complete editing sessions', 'blue');
  log('  • AI tools should use ai-* commands for automated workflows', 'blue');
  log('  • Always validate before committing changes', 'blue');
  log('  • tokensource.json is the single source of truth', 'blue');
  log('  • Token Studio native format ensures maximum compatibility', 'blue');
  log('  • Modular structure: core → global → components → simulate', 'blue');
  
  log('\n📖 For detailed documentation, see:', 'cyan');
  log('  • docs/QUICK_START_GUIDE.md - Get started in 5 minutes', 'blue');
  log('  • docs/COMMAND_REFERENCE.md - Essential commands reference', 'blue');
  log('  • docs/ENGINEER_WORKFLOW_GUIDE.md - Complete engineering workflow', 'blue');
  log('  • docs/DESIGNER_IMPORT_GUIDE.md - Figma Token Studio setup', 'blue');
  log('  • docs/AI_EDITING_GUIDE.md - AI-friendly token editing', 'blue');
  log('  • docs/TROUBLESHOOTING_GUIDE.md - Common issues and solutions', 'blue');
  
  log('\n🆘 Need immediate help?', 'yellow');
  log('  • Run: npm run validate-workflow-integrity (check system health)', 'blue');
  log('  • Run: npm run validate:comprehensive (detailed validation)', 'blue');
  log('  • Check: docs/TROUBLESHOOTING_GUIDE.md (common issues)', 'blue');
}

if (require.main === module) {
  showHelp();
}

module.exports = { showHelp };