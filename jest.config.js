/**
 * Jest Configuration for Token Studio Native Workflow Testing Suite
 * 
 * Simplified configuration for Node.js compatibility
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverage: false, // Disabled for now due to Babel issues
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test timeout (increased for integration tests)
  testTimeout: 30000,
  
  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/.backups/'
  ],
  
  // Verbose output for CI
  verbose: process.env.CI === 'true',
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true
};