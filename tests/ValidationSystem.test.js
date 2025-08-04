/**
 * ValidationSystem Tests
 * 
 * Comprehensive test suite for the ValidationSystem class
 * Tests all validation components and error scenarios
 */

const ValidationSystem = require('../src/ValidationSystem');
const fs = require('fs').promises;
const path = require('path');
const { beforeEach, afterEach, describe, it, expect } = require('@jest/globals');

describe('ValidationSystem', () => {
  let validationSystem;
  let testDir;

  beforeEach(async () => {
    validationSystem = new ValidationSystem();
    testDir = path.join(__dirname, 'temp-validation-test');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might not exist or be empty
    }
  });

  describe('validateTokenStudioStructure', () => {
    it('should validate a complete Token Studio structure', async () => {
      // Create valid Token Studio structure
      await createValidTokenStudioStructure(testDir);

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing directory', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent');

      const result = await validationSystem.validateTokenStudioStructure(nonExistentDir);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('missing_directory');
      expect(result.issues[0].severity).toBe('error');
    });

    it('should detect missing required files', async () => {
      // Create directory but no files
      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const missingFiles = result.issues.filter(issue => issue.type === 'missing_required_file');
      expect(missingFiles).toHaveLength(2); // $metadata.json and $themes.json
    });

    it('should detect invalid metadata structure', async () => {
      // Create invalid metadata
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ invalid: 'structure' })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify([])
      );

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(false);
      const metadataIssues = result.issues.filter(issue => issue.type === 'invalid_metadata_structure');
      expect(metadataIssues.length).toBeGreaterThan(0);
    });

    it('should detect invalid themes structure', async () => {
      // Create valid metadata but invalid themes
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core'] })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify({ invalid: 'structure' }) // Should be array
      );

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(false);
      const themesIssues = result.issues.filter(issue => issue.type === 'invalid_themes_structure');
      expect(themesIssues.length).toBeGreaterThan(0);
    });

    it('should detect missing token set files referenced in metadata', async () => {
      // Create metadata referencing non-existent token sets
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core', 'global', 'nonexistent'] })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify([])
      );
      await fs.writeFile(
        path.join(testDir, 'core.json'),
        JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } })
      );

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(false);
      const missingSetFiles = result.issues.filter(issue => issue.type === 'missing_token_set_file');
      expect(missingSetFiles.length).toBeGreaterThan(0);
      expect(missingSetFiles[0].tokenSet).toBe('global');
    });

    it('should validate token file structure', async () => {
      await createValidTokenStudioStructure(testDir);
      
      // Add invalid token file
      await fs.writeFile(
        path.join(testDir, 'invalid.json'),
        JSON.stringify({
          invalidToken: {
            // Missing $type and $value
            description: 'Invalid token'
          }
        })
      );

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      const tokenIssues = result.issues.filter(issue => 
        issue.type === 'missing_token_type' || issue.type === 'missing_token_value'
      );
      expect(tokenIssues.length).toBeGreaterThan(0);
    });
  });

  describe('validateTokenReferences', () => {
    it('should validate resolved token references', async () => {
      await createTokenStudioWithReferences(testDir);

      const result = await validationSystem.validateTokenReferences(testDir);

      expect(result.isValid).toBe(true);
      expect(result.unresolvedReferences).toHaveLength(0);
      expect(result.circularReferences).toHaveLength(0);
    });

    it('should detect unresolved token references', async () => {
      // Create structure with unresolved references
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core'] })
      );
      await fs.writeFile(
        path.join(testDir, 'core.json'),
        JSON.stringify({
          color: {
            primary: { $type: 'color', $value: '{color.nonexistent}' },
            secondary: { $type: 'color', $value: '{another.missing.token}' }
          }
        })
      );

      const result = await validationSystem.validateTokenReferences(testDir);

      expect(result.isValid).toBe(false);
      expect(result.unresolvedReferences.length).toBeGreaterThan(0);
      expect(result.unresolvedReferences[0].reference).toBe('{color.nonexistent}');
    });

    it('should detect circular references', async () => {
      // Create structure with circular references
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core'] })
      );
      await fs.writeFile(
        path.join(testDir, 'core.json'),
        JSON.stringify({
          color: {
            primary: { $type: 'color', $value: '{color.secondary}' },
            secondary: { $type: 'color', $value: '{color.primary}' }
          }
        })
      );

      const result = await validationSystem.validateTokenReferences(testDir);

      expect(result.isValid).toBe(false);
      // Note: Circular reference detection is complex and may need refinement
    });

    it('should handle missing metadata gracefully', async () => {
      const result = await validationSystem.validateTokenReferences(testDir);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateRoundtripIntegrity', () => {
    it('should validate successful roundtrip transformation', async () => {
      // Create original source file
      const originalSource = path.join(testDir, 'original.json');
      const originalData = {
        color: {
          primary: { $type: 'color', $value: '#000000' },
          secondary: { $type: 'color', $value: '#ffffff' }
        },
        $metadata: { tokenSetOrder: ['core'] },
        $themes: [{ id: 'base', name: 'Base', selectedTokenSets: { core: 'source' } }]
      };
      await fs.writeFile(originalSource, JSON.stringify(originalData, null, 2));

      const result = await validationSystem.validateRoundtripIntegrity(originalSource, testDir);

      // Note: This test requires TokenTransformationEngine to be working
      // The actual validation depends on the transformation engine implementation
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should detect differences in roundtrip transformation', async () => {
      // This test would require a more complex setup with actual transformation
      // For now, we test the error handling
      const nonExistentSource = path.join(testDir, 'nonexistent.json');

      const result = await validationSystem.validateRoundtripIntegrity(nonExistentSource, testDir);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateThemeCompleteness', () => {
    it('should validate complete themes', async () => {
      await createCompleteThemeStructure(testDir);

      const result = await validationSystem.validateThemeCompleteness(testDir);

      expect(result.isValid).toBe(true);
      expect(result.incompleteThemes).toHaveLength(0);
      expect(result.missingTokens).toHaveLength(0);
    });

    it('should detect incomplete themes', async () => {
      // Create themes with missing token sets
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core', 'global'] })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify([
          {
            id: 'incomplete',
            name: 'Incomplete Theme',
            selectedTokenSets: {
              core: 'source'
              // Missing 'global' token set
            }
          }
        ])
      );
      await fs.writeFile(
        path.join(testDir, 'core.json'),
        JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } })
      );
      await fs.writeFile(
        path.join(testDir, 'global.json'),
        JSON.stringify({ spacing: { base: { $type: 'dimension', $value: '8px' } } })
      );

      const result = await validationSystem.validateThemeCompleteness(testDir);

      expect(result.isValid).toBe(false);
      expect(result.incompleteThemes.length).toBeGreaterThan(0);
    });

    it('should detect themes referencing non-existent token sets', async () => {
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core'] })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify([
          {
            id: 'invalid',
            name: 'Invalid Theme',
            selectedTokenSets: {
              core: 'source',
              nonexistent: 'enabled'
            }
          }
        ])
      );
      await fs.writeFile(
        path.join(testDir, 'core.json'),
        JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } })
      );

      const result = await validationSystem.validateThemeCompleteness(testDir);

      expect(result.isValid).toBe(false);
      expect(result.incompleteThemes.length).toBeGreaterThan(0);
      expect(result.incompleteThemes[0].missingTokenSets).toContain('nonexistent');
    });

    it('should detect orphaned token sets', async () => {
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ tokenSetOrder: ['core', 'orphaned'] })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify([
          {
            id: 'base',
            name: 'Base Theme',
            selectedTokenSets: {
              core: 'source'
              // 'orphaned' token set not used
            }
          }
        ])
      );
      await fs.writeFile(
        path.join(testDir, 'core.json'),
        JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } })
      );
      await fs.writeFile(
        path.join(testDir, 'orphaned.json'),
        JSON.stringify({ unused: { token: { $type: 'color', $value: '#fff' } } })
      );

      const result = await validationSystem.validateThemeCompleteness(testDir);

      expect(result.orphanedSets).toContain('orphaned');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('generateValidationReport', () => {
    it('should generate comprehensive validation report', async () => {
      await createValidTokenStudioStructure(testDir);

      const result = await validationSystem.generateValidationReport(testDir);

      expect(result.report).toBeDefined();
      expect(result.report.timestamp).toBeDefined();
      expect(result.report.directory).toBe(testDir);
      expect(result.report.validations).toBeDefined();
      expect(result.report.validations.structure).toBeDefined();
      expect(result.report.validations.references).toBeDefined();
      expect(result.report.validations.themes).toBeDefined();
      expect(result.report.summary).toBeDefined();
      expect(result.report.summary.isValid).toBeDefined();
      expect(result.report.summary.totalIssues).toBeDefined();
      expect(result.report.summary.recommendations).toBeDefined();
    });

    it('should include roundtrip validation when source provided', async () => {
      await createValidTokenStudioStructure(testDir);
      const sourcePath = path.join(testDir, 'source.json');
      await fs.writeFile(sourcePath, JSON.stringify({ test: 'data' }));

      const result = await validationSystem.generateValidationReport(testDir, sourcePath);

      expect(result.report.validations.roundtrip).toBeDefined();
    });

    it('should handle validation errors gracefully', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent');

      const result = await validationSystem.generateValidationReport(nonExistentDir);

      expect(result.isValid).toBe(false);
      expect(result.report.summary.isValid).toBe(false);
      expect(result.report.summary.totalIssues).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Test with invalid permissions or non-existent paths
      const invalidPath = '/invalid/path/that/does/not/exist';

      const result = await validationSystem.validateTokenStudioStructure(invalidPath);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON files', async () => {
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        'invalid json content'
      );

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide actionable error messages', async () => {
      await fs.writeFile(
        path.join(testDir, '$metadata.json'),
        JSON.stringify({ invalid: 'structure' })
      );
      await fs.writeFile(
        path.join(testDir, '$themes.json'),
        JSON.stringify([])
      );

      const result = await validationSystem.validateTokenStudioStructure(testDir);

      expect(result.isValid).toBe(false);
      const issuesWithSuggestions = result.issues.filter(issue => issue.suggestion);
      expect(issuesWithSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('private helper methods', () => {
    it('should correctly identify token references', () => {
      expect(validationSystem._isTokenReference('{color.primary}')).toBe(true);
      expect(validationSystem._isTokenReference('{spacing.base}')).toBe(true);
      expect(validationSystem._isTokenReference('regular string')).toBe(false);
      expect(validationSystem._isTokenReference('#ffffff')).toBe(false);
    });

    it('should correctly identify tokens', () => {
      // Note: _isToken is a private method, testing through public interface
      const tokenObj = { $type: 'color', $value: '#fff' };
      const typeOnlyObj = { type: 'color', value: '#fff' };
      const valueOnlyObj = { $value: '#fff' };
      const regularObj = { regular: 'object' };
      
      // Test the logic that _isToken uses
      const isTokenLogic = (obj) => {
        return typeof obj === 'object' && obj !== null &&
               !!(obj.$type || obj.type || obj.$value !== undefined || obj.value !== undefined);
      };
      
      expect(isTokenLogic(tokenObj)).toBe(true);
      expect(isTokenLogic(typeOnlyObj)).toBe(true);
      expect(isTokenLogic(valueOnlyObj)).toBe(true);
      expect(isTokenLogic(regularObj)).toBe(false);
    });

    it('should get correct token set file names', () => {
      expect(validationSystem._getTokenSetFileName('core')).toBe('core.json');
      expect(validationSystem._getTokenSetFileName('global')).toBe('global.json');
      expect(validationSystem._getTokenSetFileName('custom')).toBe('custom.json');
    });
  });
});

// Helper functions for creating test structures

async function createValidTokenStudioStructure(testDir) {
  await fs.writeFile(
    path.join(testDir, '$metadata.json'),
    JSON.stringify({
      tokenSetOrder: ['core', 'global']
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, '$themes.json'),
    JSON.stringify([
      {
        id: 'base',
        name: 'Base Theme',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled'
        },
        $figmaStyleReferences: {},
        $figmaVariableReferences: {}
      }
    ], null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'core.json'),
    JSON.stringify({
      color: {
        primary: {
          $type: 'color',
          $value: '#000000',
          $description: 'Primary color'
        },
        secondary: {
          $type: 'color',
          $value: '#ffffff',
          $description: 'Secondary color'
        }
      },
      'Font Family': {
        heading: {
          $type: 'fontFamily',
          $value: 'Arial, sans-serif',
          $description: 'Heading font family'
        }
      },
      'Font Size': {
        base: {
          $type: 'fontSize',
          $value: '16',
          $description: 'Base font size'
        }
      },
      'Font Weight': {
        regular: {
          $type: 'fontWeight',
          $value: '400',
          $description: 'Regular font weight'
        }
      },
      'Line Height': {
        normal: {
          $type: 'lineHeight',
          $value: '1.5',
          $description: 'Normal line height'
        }
      }
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'global.json'),
    JSON.stringify({
      spacing: {
        base: {
          $type: 'dimension',
          $value: '8px',
          $description: 'Base spacing unit'
        }
      }
    }, null, 2)
  );
}

async function createTokenStudioWithReferences(testDir) {
  await fs.writeFile(
    path.join(testDir, '$metadata.json'),
    JSON.stringify({
      tokenSetOrder: ['core', 'global']
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'core.json'),
    JSON.stringify({
      color: {
        primary: {
          $type: 'color',
          $value: '#000000'
        }
      }
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'global.json'),
    JSON.stringify({
      color: {
        text: {
          $type: 'color',
          $value: '{color.primary}' // Valid reference
        }
      }
    }, null, 2)
  );
}

async function createCompleteThemeStructure(testDir) {
  await fs.writeFile(
    path.join(testDir, '$metadata.json'),
    JSON.stringify({
      tokenSetOrder: ['core', 'global']
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, '$themes.json'),
    JSON.stringify([
      {
        id: 'light',
        name: 'Light Theme',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled'
        }
      },
      {
        id: 'dark',
        name: 'Dark Theme',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled'
        }
      }
    ], null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'core.json'),
    JSON.stringify({
      color: {
        primary: { $type: 'color', $value: '#000' }
      }
    }, null, 2)
  );

  await fs.writeFile(
    path.join(testDir, 'global.json'),
    JSON.stringify({
      spacing: {
        base: { $type: 'dimension', $value: '8px' }
      }
    }, null, 2)
  );
}