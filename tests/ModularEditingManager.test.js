/**
 * Tests for ModularEditingManager - Modular token editing support
 * 
 * Tests cover:
 * - Real-time validation for token file editing
 * - Token reference resolution system
 * - Syntax validation for Token Studio format
 * - Support for preserving token metadata and descriptions
 * - Editing session management for AI tools
 * 
 * Requirements tested: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2
 */

const fs = require('fs').promises;
const path = require('path');
const ModularEditingManager = require('../src/ModularEditingManager');

describe('ModularEditingManager', () => {
  let manager;
  let testTokensDir;
  let originalConsoleLog;

  // Set timeout for all tests to prevent hanging
  jest.setTimeout(10000);

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();
  });

  afterAll(() => {
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Clean up environment
    delete process.env.NODE_ENV;
  });

  beforeEach(async () => {
    // Create temporary test directory
    testTokensDir = path.join(__dirname, 'temp-tokens-editing');
    await fs.mkdir(testTokensDir, { recursive: true });
    
    // Initialize manager
    manager = new ModularEditingManager(testTokensDir);
    
    // Create test token structure
    await createTestTokenStructure(testTokensDir);
  });

  afterEach(async () => {
    // Clean up manager resources
    if (manager) {
      await manager.cleanup();
    }
    
    // Clean up test directory
    try {
      // Use rm instead of rmdir for better compatibility
      await fs.rm(testTokensDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Editing Session Management', () => {
    test('should initialize editing session successfully', async () => {
      const sessionId = 'test-session-1';
      const options = {
        autoValidate: true,
        preserveMetadata: true,
        trackChanges: true
      };

      const result = await manager.initializeEditingSession(sessionId, options);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.id).toBe(sessionId);
      expect(result.session.options).toMatchObject(options);
      expect(result.session.status).toBe('active');
      expect(result.errors).toHaveLength(0);
    });

    test('should fail to initialize session with invalid tokens directory', async () => {
      const invalidManager = new ModularEditingManager('/nonexistent/path');
      const result = await invalidManager.initializeEditingSession('test-session');

      expect(result.success).toBe(false);
      expect(result.session).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should track changes during editing session', async () => {
      const sessionId = 'test-session-2';
      await manager.initializeEditingSession(sessionId);

      const filePath = path.join(testTokensDir, 'core.json');
      const change = {
        type: 'token_update',
        tokenPath: 'color.primary',
        oldValue: '#0066cc',
        newValue: '#0077dd'
      };

      const result = await manager.trackChange(sessionId, filePath, change);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const session = manager.getSessionInfo(sessionId);
      expect(session.changes).toHaveLength(1);
      expect(session.changes[0].filePath).toBe(filePath);
      expect(session.changes[0].details).toMatchObject(change);
    });

    test('should finalize editing session with summary', async () => {
      const sessionId = 'test-session-3';
      await manager.initializeEditingSession(sessionId);

      // Make some changes
      const filePath = path.join(testTokensDir, 'core.json');
      await manager.trackChange(sessionId, filePath, { type: 'token_update' });

      const result = await manager.finalizeEditingSession(sessionId);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.sessionId).toBe(sessionId);
      expect(result.summary.changesCount).toBe(1);
      expect(result.summary.filesModified).toContain(filePath);
    });

    test('should list active sessions', async () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';

      await manager.initializeEditingSession(sessionId1);
      await manager.initializeEditingSession(sessionId2);

      const activeSessions = manager.listActiveSessions();

      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(s => s.id)).toContain(sessionId1);
      expect(activeSessions.map(s => s.id)).toContain(sessionId2);
    });
  });

  describe('Real-time Token File Validation', () => {
    test('should validate valid token file successfully', async () => {
      const filePath = path.join(testTokensDir, 'core.json');
      const result = await manager.validateTokenFile(filePath);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing token file', async () => {
      const filePath = path.join(testTokensDir, 'nonexistent.json');
      const result = await manager.validateTokenFile(filePath);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('file_not_found');
      expect(result.issues[0].severity).toBe('error');
    });

    test('should validate token structure and detect missing properties', async () => {
      // Create token file with missing properties
      const invalidTokenData = {
        color: {
          primary: {
            // Missing $type and $value
            $description: 'Primary color'
          }
        }
      };

      const filePath = path.join(testTokensDir, 'invalid.json');
      await fs.writeFile(filePath, JSON.stringify(invalidTokenData, null, 2));

      const result = await manager.validateTokenFile(filePath);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const missingValueIssue = result.issues.find(i => i.type === 'missing_token_value');
      expect(missingValueIssue).toBeDefined();
      expect(missingValueIssue.severity).toBe('error');
    });

    test('should validate token values based on type', async () => {
      const tokenData = {
        color: {
          invalid: {
            $type: 'color',
            $value: 'not-a-color'
          }
        },
        spacing: {
          invalid: {
            $type: 'dimension',
            $value: 'invalid-dimension'
          }
        }
      };

      const filePath = path.join(testTokensDir, 'invalid-values.json');
      await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));

      const result = await manager.validateTokenFile(filePath);

      expect(result.isValid).toBe(false);
      const valueIssues = result.issues.filter(i => i.type === 'invalid_token_value');
      expect(valueIssues.length).toBeGreaterThan(0);
    });

    test('should provide improvement suggestions', async () => {
      const tokenData = {
        color: {
          primary: {
            $value: '#0066cc'
            // Missing $type and $description
          }
        }
      };

      const filePath = path.join(testTokensDir, 'needs-improvement.json');
      await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));

      const result = await manager.validateTokenFile(filePath);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('$type'))).toBe(true);
    });
  });

  describe('Token Reference Resolution', () => {
    test('should resolve valid token reference', async () => {
      const reference = '{color.primary}';
      const result = await manager.resolveTokenReference(reference);

      expect(result.resolved).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.path).toEqual(['color', 'primary']);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail to resolve invalid reference', async () => {
      const reference = '{nonexistent.token}';
      const result = await manager.resolveTokenReference(reference);

      expect(result.resolved).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle malformed reference format', async () => {
      const reference = 'invalid-reference-format';
      const result = await manager.resolveTokenReference(reference);

      expect(result.resolved).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid reference format');
    });

    test('should validate token references in file', async () => {
      // Create file with both valid and invalid references
      const tokenData = {
        color: {
          secondary: {
            $type: 'color',
            $value: '{color.primary}' // Valid reference
          },
          tertiary: {
            $type: 'color',
            $value: '{color.nonexistent}' // Invalid reference
          }
        }
      };

      const filePath = path.join(testTokensDir, 'with-references.json');
      await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));

      const result = await manager.validateTokenFile(filePath);

      expect(result.isValid).toBe(false);
      const referenceIssues = result.issues.filter(i => i.type === 'unresolved_reference');
      expect(referenceIssues).toHaveLength(1);
      expect(referenceIssues[0].reference).toBe('{color.nonexistent}');
    });
  });

  describe('Token Studio Format Syntax Validation', () => {
    test('should validate proper Token Studio syntax', async () => {
      const validTokenData = {
        color: {
          primary: {
            $type: 'color',
            $value: '#0066cc',
            $description: 'Primary brand color'
          }
        },
        spacing: {
          small: {
            $type: 'dimension',
            $value: '8px',
            $description: 'Small spacing unit'
          }
        }
      };

      const result = manager.validateTokenStudioSyntax(validTokenData, 'test.json');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect syntax issues in Token Studio format', async () => {
      const invalidTokenData = {
        color: {
          primary: {
            // Missing $type
            $value: '#0066cc'
          },
          secondary: {
            $type: 'color'
            // Missing $value
          }
        }
      };

      const result = manager.validateTokenStudioSyntax(invalidTokenData, 'test.json');

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const typeIssues = result.issues.filter(i => i.type === 'missing_token_type');
      const valueIssues = result.issues.filter(i => i.type === 'missing_token_value');
      
      expect(typeIssues).toHaveLength(1);
      expect(valueIssues).toHaveLength(1);
    });

    test('should validate color token values', async () => {
      const colorTests = [
        { value: '#ff0000', valid: true },
        { value: '#f00', valid: true },
        { value: 'rgb(255, 0, 0)', valid: true },
        { value: 'rgba(255, 0, 0, 0.5)', valid: true },
        { value: 'red', valid: true },
        { value: 'invalid-color', valid: false }
      ];

      for (const test of colorTests) {
        const validation = manager._validateColorValue(test.value, 'test.path');
        expect(validation.isValid).toBe(test.valid);
      }
    });

    test('should validate dimension token values', async () => {
      const dimensionTests = [
        { value: '16px', valid: true },
        { value: '1.5rem', valid: true },
        { value: '100%', valid: true },
        { value: 16, valid: true },
        { value: 'invalid-dimension', valid: false }
      ];

      for (const test of dimensionTests) {
        const validation = manager._validateDimensionValue(test.value, 'test.path');
        expect(validation.isValid).toBe(test.valid);
      }
    });

    test('should validate typography token values', async () => {
      const validTypography = {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontWeight: 400
      };

      const invalidTypography = {
        fontSize: '16px'
        // Missing required fontFamily
      };

      const validResult = manager._validateTypographyValue(validTypography, 'test.path');
      const invalidResult = manager._validateTypographyValue(invalidTypography, 'test.path');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Metadata Preservation', () => {
    test('should preserve token descriptions', async () => {
      const originalToken = {
        $type: 'color',
        $value: '#0066cc',
        $description: 'Original description'
      };

      const editedToken = {
        $type: 'color',
        $value: '#0077dd'
        // Missing description
      };

      const preserved = manager.preserveTokenMetadata(originalToken, editedToken);

      expect(preserved.$description).toBe('Original description');
      expect(preserved.$value).toBe('#0077dd');
    });

    test('should preserve Figma references', async () => {
      const originalToken = {
        $type: 'color',
        $value: '#0066cc',
        $figmaStyleReferences: { 'style-id': 'figma-style-123' },
        $figmaVariableReferences: { 'var-id': 'figma-var-456' }
      };

      const editedToken = {
        $type: 'color',
        $value: '#0077dd'
      };

      const preserved = manager.preserveTokenMetadata(originalToken, editedToken);

      expect(preserved.$figmaStyleReferences).toEqual({ 'style-id': 'figma-style-123' });
      expect(preserved.$figmaVariableReferences).toEqual({ 'var-id': 'figma-var-456' });
    });

    test('should preserve extensions', async () => {
      const originalToken = {
        $type: 'color',
        $value: '#0066cc',
        $extensions: {
          'custom-extension': { data: 'value' }
        }
      };

      const editedToken = {
        $type: 'color',
        $value: '#0077dd',
        $extensions: {
          'new-extension': { data: 'new-value' }
        }
      };

      const preserved = manager.preserveTokenMetadata(originalToken, editedToken);

      expect(preserved.$extensions).toEqual({
        'custom-extension': { data: 'value' },
        'new-extension': { data: 'new-value' }
      });
    });

    test('should detect missing descriptions in validation', async () => {
      const tokenData = {
        color: {
          primary: {
            $type: 'color',
            $value: '#0066cc'
            // Missing description
          },
          secondary: {
            $type: 'color',
            $value: '#ff6600',
            $description: 'Has description'
          }
        }
      };

      const filePath = path.join(testTokensDir, 'missing-descriptions.json');
      await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));

      const result = await manager.validateTokenFile(filePath);

      const descriptionIssues = result.issues.filter(i => i.type === 'missing_description');
      expect(descriptionIssues).toHaveLength(1);
      expect(descriptionIssues[0].severity).toBe('info');
    });
  });

  describe('Integration with Session Management', () => {
    test('should update session validation results during file validation', async () => {
      const sessionId = 'integration-session';
      await manager.initializeEditingSession(sessionId);

      const filePath = path.join(testTokensDir, 'core.json');
      const result = await manager.validateTokenFile(filePath, sessionId);

      const session = manager.getSessionInfo(sessionId);
      expect(session.validationResults[filePath]).toBeDefined();
      expect(session.validationResults[filePath].isValid).toBe(result.isValid);
    });

    test('should emit events during session lifecycle', async () => {
      const sessionStartedEvents = [];
      const sessionFinalizedEvents = [];
      const tokenChangedEvents = [];

      manager.on('sessionStarted', (event) => sessionStartedEvents.push(event));
      manager.on('sessionFinalized', (event) => sessionFinalizedEvents.push(event));
      manager.on('tokenChanged', (event) => tokenChangedEvents.push(event));

      const sessionId = 'event-session';
      await manager.initializeEditingSession(sessionId);
      
      const filePath = path.join(testTokensDir, 'core.json');
      await manager.trackChange(sessionId, filePath, { type: 'test_change' });
      
      await manager.finalizeEditingSession(sessionId);

      expect(sessionStartedEvents).toHaveLength(1);
      expect(tokenChangedEvents).toHaveLength(1);
      expect(sessionFinalizedEvents).toHaveLength(1);
    });
  });

  describe('Modular Editing Workflows', () => {
    test('should support AI tool editing session with auto-validation', async () => {
      const sessionId = 'ai-editing-session';
      const options = {
        autoValidate: true,
        preserveMetadata: true,
        trackChanges: true
      };

      // Initialize session for AI tool
      const initResult = await manager.initializeEditingSession(sessionId, options);
      expect(initResult.success).toBe(true);

      // Simulate AI making token changes
      const filePath = path.join(testTokensDir, 'core.json');
      const changes = [
        {
          type: 'token_update',
          tokenPath: 'color.primary',
          oldValue: '#0066cc',
          newValue: '#0077dd',
          reason: 'AI optimization for accessibility'
        },
        {
          type: 'token_create',
          tokenPath: 'color.accent',
          value: '#ff6600',
          metadata: { $description: 'AI-generated accent color' }
        }
      ];

      // Track each change
      for (const change of changes) {
        const trackResult = await manager.trackChange(sessionId, filePath, change);
        expect(trackResult.success).toBe(true);
      }

      // Validate the session has tracked all changes
      const session = manager.getSessionInfo(sessionId);
      expect(session.changes).toHaveLength(2);
      expect(session.options.autoValidate).toBe(true);

      // Finalize session
      const finalResult = await manager.finalizeEditingSession(sessionId);
      expect(finalResult.success).toBe(true);
      expect(finalResult.summary.changesCount).toBe(2);
    });

    test('should handle complex token reference chains during editing', async () => {
      // Update the existing global.json to have a more complex reference chain
      const complexTokenData = {
        semantic: {
          color: {
            primary: {
              $type: 'color',
              $value: '{color.primary}', // References core token
              $description: 'Primary semantic color'
            }
          }
        },
        component: {
          button: {
            background: {
              $type: 'color',
              $value: '{semantic.color.primary}', // References semantic token
              $description: 'Button background color'
            }
          }
        }
      };

      const filePath = path.join(testTokensDir, 'global.json');
      await fs.writeFile(filePath, JSON.stringify(complexTokenData, null, 2));

      // Validate the complex reference chain
      const result = await manager.validateTokenFile(filePath);
      expect(result.isValid).toBe(true);

      // Test resolving references that exist in the token cache
      const resolution = await manager.resolveTokenReference('{color.primary}', filePath);
      expect(resolution.resolved).toBe(true);
      expect(resolution.path).toEqual(['color', 'primary']);
    });

    test('should preserve metadata during modular editing operations', async () => {
      const sessionId = 'metadata-preservation-session';
      await manager.initializeEditingSession(sessionId, { preserveMetadata: true });

      // Create token with rich metadata
      const originalToken = {
        $type: 'color',
        $value: '#0066cc',
        $description: 'Primary brand color with accessibility compliance',
        $extensions: {
          'figma': { styleId: 'S:123' },
          'accessibility': { contrast: 'AA', wcag: '2.1' }
        },
        $figmaStyleReferences: { 'primary-color': 'figma-style-123' }
      };

      // Simulate editing the token value
      const editedToken = {
        $type: 'color',
        $value: '#0077dd' // Only value changed
      };

      // Test metadata preservation
      const preserved = manager.preserveTokenMetadata(originalToken, editedToken);

      expect(preserved.$value).toBe('#0077dd');
      expect(preserved.$description).toBe('Primary brand color with accessibility compliance');
      expect(preserved.$extensions).toEqual({
        'figma': { styleId: 'S:123' },
        'accessibility': { contrast: 'AA', wcag: '2.1' }
      });
      expect(preserved.$figmaStyleReferences).toEqual({ 'primary-color': 'figma-style-123' });
    });

    test('should handle concurrent editing sessions', async () => {
      const session1Id = 'concurrent-session-1';
      const session2Id = 'concurrent-session-2';

      // Initialize multiple sessions
      const session1 = await manager.initializeEditingSession(session1Id, { trackChanges: true });
      const session2 = await manager.initializeEditingSession(session2Id, { trackChanges: true });

      expect(session1.success).toBe(true);
      expect(session2.success).toBe(true);

      // Make changes in both sessions
      const filePath = path.join(testTokensDir, 'core.json');
      
      await manager.trackChange(session1Id, filePath, { type: 'session1_change', data: 'test1' });
      await manager.trackChange(session2Id, filePath, { type: 'session2_change', data: 'test2' });

      // Verify sessions are independent
      const sessionInfo1 = manager.getSessionInfo(session1Id);
      const sessionInfo2 = manager.getSessionInfo(session2Id);

      expect(sessionInfo1.changes).toHaveLength(1);
      expect(sessionInfo2.changes).toHaveLength(1);
      expect(sessionInfo1.changes[0].details.data).toBe('test1');
      expect(sessionInfo2.changes[0].details.data).toBe('test2');

      // List active sessions
      const activeSessions = manager.listActiveSessions();
      expect(activeSessions).toHaveLength(2);
    });

    test('should validate token transformations during editing', async () => {
      const sessionId = 'transformation-session';
      await manager.initializeEditingSession(sessionId);

      // Test various token transformations
      const transformations = [
        {
          name: 'Color format change',
          original: { $type: 'color', $value: '#ff0000' },
          transformed: { $type: 'color', $value: 'rgb(255, 0, 0)' },
          shouldBeValid: true
        },
        {
          name: 'Dimension unit change',
          original: { $type: 'dimension', $value: '16px' },
          transformed: { $type: 'dimension', $value: '1rem' },
          shouldBeValid: true
        },
        {
          name: 'Invalid color transformation',
          original: { $type: 'color', $value: '#ff0000' },
          transformed: { $type: 'color', $value: 'invalid-color' },
          shouldBeValid: false
        }
      ];

      for (const transformation of transformations) {
        const tokenData = { test: { token: transformation.transformed } };
        const filePath = path.join(testTokensDir, `transformation-${transformation.name.replace(/\s+/g, '-').toLowerCase()}.json`);
        await fs.writeFile(filePath, JSON.stringify(tokenData, null, 2));

        const result = await manager.validateTokenFile(filePath, sessionId);
        expect(result.isValid).toBe(transformation.shouldBeValid);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      // Try to validate a directory instead of a file
      const result = await manager.validateTokenFile(testTokensDir);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle malformed JSON files', async () => {
      const malformedPath = path.join(testTokensDir, 'malformed.json');
      await fs.writeFile(malformedPath, '{ invalid json }');

      const result = await manager.validateTokenFile(malformedPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle session operations on non-existent sessions', async () => {
      const result = await manager.trackChange('nonexistent-session', 'file.json', {});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Session not found');
    });
  });
});

// Helper function to create test token structure
async function createTestTokenStructure(tokensDir) {
  // Create $metadata.json
  const metadata = {
    tokenSetOrder: ['core', 'global', 'simulate']
  };
  await fs.writeFile(
    path.join(tokensDir, '$metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  // Create $themes.json
  const themes = [
    {
      id: 'base-theme',
      name: 'Base',
      selectedTokenSets: {
        core: 'source',
        global: 'enabled',
        simulate: 'enabled'
      },
      $figmaStyleReferences: {},
      $figmaVariableReferences: {}
    }
  ];
  await fs.writeFile(
    path.join(tokensDir, '$themes.json'),
    JSON.stringify(themes, null, 2)
  );

  // Create core.json
  const coreTokens = {
    color: {
      primary: {
        $type: 'color',
        $value: '#0066cc',
        $description: 'Primary brand color'
      },
      secondary: {
        $type: 'color',
        $value: '#ff6600',
        $description: 'Secondary brand color'
      }
    },
    spacing: {
      small: {
        $type: 'dimension',
        $value: '8px',
        $description: 'Small spacing unit'
      },
      medium: {
        $type: 'dimension',
        $value: '16px',
        $description: 'Medium spacing unit'
      }
    }
  };
  await fs.writeFile(
    path.join(tokensDir, 'core.json'),
    JSON.stringify(coreTokens, null, 2)
  );

  // Create global.json
  const globalTokens = {
    button: {
      primary: {
        background: {
          $type: 'color',
          $value: '{color.primary}',
          $description: 'Primary button background'
        }
      }
    }
  };
  await fs.writeFile(
    path.join(tokensDir, 'global.json'),
    JSON.stringify(globalTokens, null, 2)
  );

  // Create simulate.json
  const simulateTokens = {
    brand: {
      accent: {
        $type: 'color',
        $value: '#00cc66',
        $description: 'Brand accent color'
      }
    }
  };
  await fs.writeFile(
    path.join(tokensDir, 'simulate.json'),
    JSON.stringify(simulateTokens, null, 2)
  );
}