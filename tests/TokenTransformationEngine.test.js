/**
 * Unit tests for TokenTransformationEngine
 * Tests all transformation operations, validation, and error handling
 */

const fs = require('fs').promises;
const path = require('path');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');

// Mock fs module for testing
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

describe('TokenTransformationEngine', () => {
  let engine;
  let mockSourceData;
  let mockMetadata;
  let mockThemes;

  beforeEach(() => {
    engine = new TokenTransformationEngine();
    jest.clearAllMocks();

    // Mock source data structure
    mockSourceData = {
      'Color Ramp': {
        'Neutral': {
          'Neutral 1000': {
            value: '#aeb4b9',
            type: 'color',
            description: 'Neutral 1000 - Secondary text'
          }
        }
      },
      typography: {
        fontFamily: {
          roboto: {
            value: 'Roboto',
            type: 'fontFamily',
            description: 'Primary font family'
          }
        }
      },
      spacing: {
        base: {
          value: '2',
          type: 'spacing',
          description: 'Base unit for all spacing calculations'
        }
      },
      color: {
        text: {
          primary: {
            value: '{Color Ramp.Neutral.Neutral 1000}',
            type: 'color',
            description: 'Primary text color'
          }
        }
      }
    };

    mockMetadata = {
      tokenSetOrder: ['core', 'global', 'components']
    };

    mockThemes = [
      {
        id: 'base-theme',
        name: 'Base',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled'
        }
      }
    ];
  });

  describe('splitSourceToTokens', () => {
    it('should successfully split source into modular files', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(4); // metadata, themes, core, global
      expect(result.errors).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
    });

    it('should handle missing source file', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await engine.splitSourceToTokens('missing.json', 'tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to read source file');
    });

    it('should handle invalid JSON in source file', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to read source file');
    });

    it('should create output directory if it does not exist', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await engine.splitSourceToTokens('tokensource.json', 'new-tokens/');

      expect(fs.mkdir).toHaveBeenCalledWith('new-tokens/', { recursive: true });
    });

    it('should generate proper metadata structure', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      const metadataCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('$metadata.json')
      );
      expect(metadataCall).toBeDefined();
      
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata).toHaveProperty('tokenSetOrder');
      expect(Array.isArray(metadata.tokenSetOrder)).toBe(true);
    });

    it('should generate proper themes structure', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      const themesCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('$themes.json')
      );
      expect(themesCall).toBeDefined();
      
      const themes = JSON.parse(themesCall[1]);
      expect(Array.isArray(themes)).toBe(true);
      expect(themes[0]).toHaveProperty('selectedTokenSets');
    });

    it('should convert tokens to Token Studio format', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      const coreCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('core.json')
      );
      expect(coreCall).toBeDefined();
      
      const coreTokens = JSON.parse(coreCall[1]);
      expect(coreTokens['Color Ramp']['Neutral']['Neutral 1000']).toHaveProperty('$type', 'color');
      expect(coreTokens['Color Ramp']['Neutral']['Neutral 1000']).toHaveProperty('$value', '#aeb4b9');
    });
  });

  describe('consolidateToSource', () => {
    beforeEach(() => {
      // Mock file reads for consolidation
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify(mockThemes));
        }
        if (filePath.includes('core.json')) {
          return Promise.resolve(JSON.stringify({
            'Color Ramp': {
              'Neutral': {
                'Neutral 1000': {
                  $type: 'color',
                  $value: '#aeb4b9',
                  $description: 'Neutral 1000 - Secondary text'
                }
              }
            }
          }));
        }
        if (filePath.includes('global.json')) {
          return Promise.resolve(JSON.stringify({
            color: {
              text: {
                primary: {
                  $type: 'color',
                  $value: '{Color Ramp.Neutral.Neutral 1000}',
                  $description: 'Primary text color'
                }
              }
            }
          }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should successfully consolidate modular files to source', async () => {
      fs.writeFile.mockResolvedValue();

      const result = await engine.consolidateToSource('tokens/', 'tokensource.json');

      expect(result.success).toBe(true);
      expect(result.tokensCount).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalledWith('tokensource.json', expect.any(String));
    });

    it('should handle missing metadata file', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve('{}');
      });

      const result = await engine.consolidateToSource('tokens/', 'tokensource.json');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to read metadata');
    });

    it('should merge token sets correctly', async () => {
      fs.writeFile.mockResolvedValue();

      await engine.consolidateToSource('tokens/', 'tokensource.json');

      const writeCall = fs.writeFile.mock.calls.find(call => 
        call[0] === 'tokensource.json'
      );
      expect(writeCall).toBeDefined();
      
      const consolidatedData = JSON.parse(writeCall[1]);
      expect(consolidatedData).toHaveProperty('Color Ramp');
      expect(consolidatedData).toHaveProperty('color');
    });

    it('should preserve token references during consolidation', async () => {
      fs.writeFile.mockResolvedValue();

      await engine.consolidateToSource('tokens/', 'tokensource.json');

      const writeCall = fs.writeFile.mock.calls.find(call => 
        call[0] === 'tokensource.json'
      );
      const consolidatedData = JSON.parse(writeCall[1]);
      
      expect(consolidatedData.color.text.primary.$value).toBe('{Color Ramp.Neutral.Neutral 1000}');
    });

    it('should count tokens accurately', async () => {
      fs.writeFile.mockResolvedValue();

      const result = await engine.consolidateToSource('tokens/', 'tokensource.json');

      expect(result.tokensCount).toBe(2); // One from core, one from global
    });
  });

  describe('validateTransformation', () => {
    it('should validate successful roundtrip transformation', async () => {
      const testData = JSON.stringify(mockSourceData);
      fs.readFile.mockResolvedValue(testData);

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect missing keys', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve(JSON.stringify({ key1: 'value1', key2: 'value2' }));
        }
        return Promise.resolve(JSON.stringify({ key1: 'value1' }));
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(result.differences).toContainEqual(
        expect.objectContaining({
          type: 'missing_key',
          path: 'key2'
        })
      );
    });

    it('should detect value mismatches', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve(JSON.stringify({ key1: 'original_value' }));
        }
        return Promise.resolve(JSON.stringify({ key1: 'different_value' }));
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(result.differences).toContainEqual(
        expect.objectContaining({
          type: 'value_mismatch',
          path: 'key1'
        })
      );
    });

    it('should detect missing token references', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve(JSON.stringify({
            token: { value: '{reference.token}' }
          }));
        }
        return Promise.resolve(JSON.stringify({
          token: { value: 'literal_value' }
        }));
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      // The value mismatch should be detected
      expect(result.differences[0].type).toBe('value_mismatch');
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Permission denied');
    });

    it('should handle write errors during split', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to generate');
    });

    it('should collect multiple errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Read error'));
      fs.mkdir.mockRejectedValue(new Error('Directory error'));

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('token type inference', () => {
    it('should infer color type from hex values', () => {
      const token = { value: '#ffffff' };
      const converted = engine._convertToken(token);
      
      expect(converted.$type).toBe('color');
      expect(converted.$value).toBe('#ffffff');
    });

    it('should infer color type from rgba values', () => {
      const token = { value: 'rgba(255, 255, 255, 0.5)' };
      const converted = engine._convertToken(token);
      
      expect(converted.$type).toBe('color');
    });

    it('should infer dimension type from pixel values', () => {
      const token = { value: '16px' };
      const converted = engine._convertToken(token);
      
      expect(converted.$type).toBe('dimension');
    });

    it('should infer dimension type from numeric values', () => {
      const token = { value: 16 };
      const converted = engine._convertToken(token);
      
      expect(converted.$type).toBe('dimension');
    });

    it('should preserve existing Token Studio format', () => {
      const token = { $type: 'color', $value: '#ffffff', $description: 'White' };
      const converted = engine._convertToken(token);
      
      expect(converted).toEqual(token);
    });
  });

  describe('token set identification', () => {
    it('should identify core tokens correctly', () => {
      const tokenSets = engine._identifyTokenSets(mockSourceData);
      
      expect(tokenSets).toHaveProperty('core');
      expect(tokenSets.core).toHaveProperty('Color Ramp');
      expect(tokenSets.core).toHaveProperty('typography');
      expect(tokenSets.core).toHaveProperty('spacing');
    });

    it('should identify global tokens correctly', () => {
      const tokenSets = engine._identifyTokenSets(mockSourceData);
      
      expect(tokenSets).toHaveProperty('global');
      expect(tokenSets.global).toHaveProperty('color');
    });

    it('should handle empty source data', () => {
      const tokenSets = engine._identifyTokenSets({});
      
      expect(Object.keys(tokenSets)).toHaveLength(0);
    });
  });

  describe('file name mapping', () => {
    it('should map token set names to correct file names', () => {
      expect(engine._getTokenSetFileName('core')).toBe('core.json');
      expect(engine._getTokenSetFileName('global')).toBe('global.json');
      expect(engine._getTokenSetFileName('Content Typography')).toBe('Content Typography.json');
    });

    it('should handle custom set names', () => {
      expect(engine._getTokenSetFileName('custom-set')).toBe('custom-set.json');
    });
  });

  describe('token set order extraction', () => {
    it('should extract logical token set order', () => {
      const order = engine._extractTokenSetOrder(mockSourceData);
      
      expect(order).toContain('core');
      expect(order).toContain('global');
      expect(order.indexOf('core')).toBeLessThan(order.indexOf('global'));
    });

    it('should handle missing standard sets', () => {
      const minimalData = { 'custom': { token: { value: 'test' } } };
      const order = engine._extractTokenSetOrder(minimalData);
      
      expect(order).toContain('custom');
    });

    it('should use existing metadata token set order', () => {
      const dataWithMetadata = {
        $metadata: { tokenSetOrder: ['custom1', 'custom2'] },
        custom1: { token: { value: 'test' } },
        custom2: { token: { value: 'test' } }
      };
      const order = engine._extractTokenSetOrder(dataWithMetadata);
      
      expect(order).toEqual(['custom1', 'custom2']);
    });

    it('should handle empty source data', () => {
      const order = engine._extractTokenSetOrder({});
      
      expect(order).toEqual([]);
    });
  });

  describe('_extractModularFiles', () => {
    it('should extract modular files from source with metadata', async () => {
      const sourceWithModular = {
        $metadata: { tokenSetOrder: ['core', 'global'] },
        $themes: [{ id: 'test', name: 'Test' }],
        core: { color: { primary: { $type: 'color', $value: '#000' } } },
        global: { spacing: { base: { $type: 'dimension', $value: '8px' } } }
      };

      fs.writeFile.mockResolvedValue();

      const result = await engine._extractModularFiles(sourceWithModular, 'tokens/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(4); // metadata, themes, core, global
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
    });

    it('should handle missing metadata in modular source', async () => {
      const sourceWithoutMetadata = {
        $themes: [{ id: 'test', name: 'Test' }],
        core: { color: { primary: { $type: 'color', $value: '#000' } } }
      };

      fs.writeFile.mockResolvedValue();

      const result = await engine._extractModularFiles(sourceWithoutMetadata, 'tokens/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2); // themes, core
    });

    it('should handle additional token sets not in order', async () => {
      const sourceWithExtra = {
        $metadata: { tokenSetOrder: ['core'] },
        core: { color: { primary: { $type: 'color', $value: '#000' } } },
        extra: { spacing: { base: { $type: 'dimension', $value: '8px' } } }
      };

      fs.writeFile.mockResolvedValue();

      const result = await engine._extractModularFiles(sourceWithExtra, 'tokens/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(3); // metadata, core, extra
    });

    it('should handle write errors during extraction', async () => {
      const sourceWithModular = {
        $metadata: { tokenSetOrder: ['core'] },
        core: { color: { primary: { $type: 'color', $value: '#000' } } }
      };

      fs.writeFile.mockRejectedValue(new Error('Write failed'));

      const result = await engine._extractModularFiles(sourceWithModular, 'tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to extract modular files');
    });
  });

  describe('_isTokenSet', () => {
    it('should identify valid token sets', () => {
      expect(engine._isTokenSet({ token: { value: 'test' } })).toBe(true);
      expect(engine._isTokenSet({})).toBe(true);
    });

    it('should reject non-token sets', () => {
      expect(engine._isTokenSet(null)).toBe(false);
      expect(engine._isTokenSet([])).toBe(false);
      expect(engine._isTokenSet('string')).toBe(false);
      expect(engine._isTokenSet(123)).toBe(false);
    });
  });

  describe('_isTokenGroup', () => {
    it('should identify token groups', () => {
      expect(engine._isTokenGroup({ nested: { token: { value: 'test' } } })).toBe(true);
      expect(engine._isTokenGroup({})).toBe(true);
    });

    it('should reject tokens', () => {
      expect(engine._isTokenGroup({ $type: 'color', $value: '#000' })).toBe(false);
      expect(engine._isTokenGroup({ type: 'color', value: '#000' })).toBe(false);
      expect(engine._isTokenGroup({ value: '#000' })).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(engine._isTokenGroup(null)).toBe(false);
      expect(engine._isTokenGroup([])).toBe(false);
      expect(engine._isTokenGroup('string')).toBe(false);
    });
  });

  describe('_isToken', () => {
    it('should identify Token Studio format tokens', () => {
      expect(engine._isToken({ $type: 'color', $value: '#000' })).toBe(true);
    });

    it('should identify legacy format tokens', () => {
      expect(engine._isToken({ type: 'color', value: '#000' })).toBe(true);
    });

    it('should identify value-only tokens', () => {
      expect(engine._isToken({ value: '#000' })).toBe(true);
    });

    it('should reject non-tokens', () => {
      expect(engine._isToken({})).toBe(false);
      expect(engine._isToken({ nested: { token: 'test' } })).toBe(false);
      expect(engine._isToken(null)).toBe(false);
      expect(engine._isToken('string')).toBe(false);
    });
  });

  describe('_normalizeSetName', () => {
    it('should normalize known set names', () => {
      expect(engine._normalizeSetName('Color Ramp')).toBe('core');
      expect(engine._normalizeSetName('typography')).toBe('core');
      expect(engine._normalizeSetName('spacing')).toBe('core');
    });

    it('should normalize custom names', () => {
      expect(engine._normalizeSetName('Custom Set')).toBe('custom-set');
      expect(engine._normalizeSetName('UPPERCASE')).toBe('uppercase');
    });

    it('should handle already normalized names', () => {
      expect(engine._normalizeSetName('already-normalized')).toBe('already-normalized');
    });
  });

  describe('_extractThemes', () => {
    it('should use existing themes if present', () => {
      const dataWithThemes = {
        $themes: [{ id: 'existing', name: 'Existing Theme' }]
      };
      
      const themes = engine._extractThemes(dataWithThemes);
      expect(themes).toEqual([{ id: 'existing', name: 'Existing Theme' }]);
    });

    it('should generate default themes for token sets', () => {
      const dataWithTokenSets = {
        'Color Ramp': { primary: { value: '#000' } },
        color: { text: { value: '#333' } }
      };
      
      const themes = engine._extractThemes(dataWithTokenSets);
      expect(themes).toHaveLength(2);
      expect(themes[0].name).toBe('Base');
      expect(themes[1].name).toBe('Simulate');
    });

    it('should handle empty data', () => {
      const themes = engine._extractThemes({});
      expect(themes).toHaveLength(2); // Default Base and Simulate themes
    });
  });

  describe('_fileExists', () => {
    it('should return true for existing files', async () => {
      const fs = require('fs').promises;
      fs.access = jest.fn().mockResolvedValue();
      
      const exists = await engine._fileExists('existing-file.json');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const fs = require('fs').promises;
      fs.access = jest.fn().mockRejectedValue(new Error('File not found'));
      
      const exists = await engine._fileExists('non-existing-file.json');
      expect(exists).toBe(false);
    });
  });

  describe('_mergeTokens', () => {
    it('should merge token structures', () => {
      const target = {
        color: {
          primary: { $type: 'color', $value: '#000' }
        }
      };
      
      const source = {
        color: {
          secondary: { $type: 'color', $value: '#fff' }
        },
        spacing: {
          base: { $type: 'dimension', $value: '8px' }
        }
      };
      
      engine._mergeTokens(target, source);
      
      expect(target.color.primary).toBeDefined();
      expect(target.color.secondary).toBeDefined();
      expect(target.spacing).toBeDefined();
    });

    it('should overwrite conflicting tokens', () => {
      const target = {
        color: {
          primary: { $type: 'color', $value: '#000' }
        }
      };
      
      const source = {
        color: {
          primary: { $type: 'color', $value: '#fff' }
        }
      };
      
      engine._mergeTokens(target, source);
      
      expect(target.color.primary.$value).toBe('#fff');
    });
  });

  describe('_extractTokenReferences', () => {
    it('should extract token references from data', () => {
      const data = {
        color: {
          primary: '{base.color.primary}',
          secondary: '#fff'
        },
        spacing: {
          large: '{base.spacing.unit} * 2'
        }
      };
      
      const refs = engine._extractTokenReferences(data);
      
      expect(refs).toContain('{base.color.primary}');
      expect(refs).toContain('{base.spacing.unit} * 2');
      expect(refs).toHaveLength(2);
    });

    it('should handle nested token references', () => {
      const data = {
        color: {
          nested: {
            primary: '{base.color.primary}'
          }
        }
      };
      
      const refs = engine._extractTokenReferences(data);
      expect(refs).toContain('{base.color.primary}');
      expect(refs).toHaveLength(1);
    });

    it('should handle data without references', () => {
      const data = {
        color: {
          primary: '#000'
        }
      };
      
      const refs = engine._extractTokenReferences(data);
      expect(refs).toHaveLength(0);
    });
  });

  describe('_compareMetadata', () => {
    it('should detect missing descriptions', () => {
      const original = {
        color: {
          primary: { 
            value: '#000', 
            description: 'Primary color' 
          }
        }
      };
      
      const reconstituted = {
        color: {
          primary: { 
            $type: 'color',
            $value: '#000'
          }
        }
      };
      
      const differences = [];
      engine._compareMetadata(original, reconstituted, '', differences);
      
      expect(differences).toHaveLength(1);
      expect(differences[0].type).toBe('missing_description');
    });

    it('should handle preserved descriptions', () => {
      const original = {
        color: {
          primary: { 
            value: '#000', 
            description: 'Primary color' 
          }
        }
      };
      
      const reconstituted = {
        color: {
          primary: { 
            $type: 'color',
            $value: '#000',
            $description: 'Primary color'
          }
        }
      };
      
      const differences = [];
      engine._compareMetadata(original, reconstituted, '', differences);
      
      expect(differences).toHaveLength(0);
    });
  });

  describe('additional edge cases', () => {
    it('should handle complex token type inference', () => {
      expect(engine._inferTokenType('linear-gradient(90deg, #000, #fff)')).toBe('color');
      expect(engine._inferTokenType('1.5rem')).toBe('dimension');
      expect(engine._inferTokenType('100%')).toBe('dimension');
      expect(engine._inferTokenType({ fontFamily: 'Arial' })).toBe('typography');
      expect(engine._inferTokenType('unknown-value')).toBe('other');
    });

    it('should handle token conversion edge cases', () => {
      // Already in Token Studio format
      const tokenStudioToken = { $type: 'color', $value: '#000', $description: 'Test' };
      expect(engine._convertToken(tokenStudioToken)).toEqual(tokenStudioToken);
      
      // Legacy format with description
      const legacyToken = { type: 'color', value: '#000', description: 'Test' };
      const converted = engine._convertToken(legacyToken);
      expect(converted.$type).toBe('color');
      expect(converted.$value).toBe('#000');
      expect(converted.$description).toBe('Test');
      
      // Value-only token without description
      const valueOnlyToken = { value: '#000' };
      const convertedValueOnly = engine._convertToken(valueOnlyToken);
      expect(convertedValueOnly.$type).toBe('color');
      expect(convertedValueOnly.$value).toBe('#000');
      expect(convertedValueOnly.$description).toBeUndefined();
      
      // Non-standard token
      const nonStandardToken = { customProp: 'value' };
      expect(engine._convertToken(nonStandardToken)).toEqual(nonStandardToken);
    });

    it('should handle consolidation with themes and metadata', async () => {
      const tokenSets = {
        core: { color: { primary: { $type: 'color', $value: '#000' } } }
      };
      
      const themes = [{ id: 'test', name: 'Test Theme' }];
      const metadata = { tokenSetOrder: ['core'], customProp: 'value' };
      
      const consolidated = await engine._consolidateTokenSets(tokenSets, themes, metadata);
      
      expect(consolidated.$themes).toEqual(themes);
      expect(consolidated.$metadata).toEqual(metadata);
      expect(consolidated.color.primary.$value).toBe('#000');
    });

    it('should handle consolidation without themes', async () => {
      const tokenSets = {
        core: { color: { primary: { $type: 'color', $value: '#000' } } }
      };
      
      const consolidated = await engine._consolidateTokenSets(tokenSets, null, {});
      
      expect(consolidated.$themes).toBeUndefined();
      expect(consolidated.$metadata).toBeUndefined();
      expect(consolidated.color.primary.$value).toBe('#000');
    });

    it('should handle token counting in nested structures', () => {
      const tokenData = {
        level1: {
          level2: {
            token1: { $type: 'color', $value: '#000' },
            token2: { $type: 'color', $value: '#fff' }
          },
          token3: { $type: 'dimension', $value: '8px' }
        },
        token4: { $type: 'color', $value: '#ccc' }
      };
      
      const count = engine._countTokens(tokenData);
      expect(count).toBe(4);
    });

    it('should handle empty token data counting', () => {
      expect(engine._countTokens({})).toBe(0);
    });

    it('should handle complex token set identification edge cases', () => {
      const complexData = {
        'Color Ramp': { primary: { value: '#000' } },
        typography: { fontFamily: { value: 'Arial' } },
        spacing: { base: { value: '8px' } },
        color: { text: { value: '#333' } },
        dark: { background: { value: '#000' } },
        light: { background: { value: '#fff' } },
        header: { fontSize: { value: '24px' } },
        body: { fontSize: { value: '16px' } },
        label: { fontSize: { value: '14px' } },
        opacity: { disabled: { value: '0.5' } },
        borderRadius: { small: { value: '4px' } },
        borderWidth: { thin: { value: '1px' } },
        appBackground: { primary: { value: '#f5f5f5' } },
        brand: { primary: { value: '#007bff' } },
        surface: { elevated: { value: '#ffffff' } },
        content: { primary: { value: '#333333' } },
        primary: { main: { value: '#007bff' } },
        secondary: { main: { value: '#6c757d' } },
        button: { padding: { value: '8px 16px' } },
        CTA: { background: { value: '#28a745' } },
        FontFamily: { primary: { value: 'Roboto' } },
        'Content Typography': { heading: { value: 'bold' } },
        customSet: { token: { value: 'test' } }
      };

      const tokenSets = engine._identifyTokenSets(complexData);

      expect(tokenSets.core).toBeDefined();
      expect(tokenSets.global).toBeDefined();
      expect(tokenSets.simulate).toBeDefined();
      expect(tokenSets.components).toBeDefined();
      expect(tokenSets['Content Typography']).toBeDefined();
      expect(tokenSets.customset).toBeDefined();
    });

    it('should handle consolidation with minimal metadata', async () => {
      const tokenSets = {
        core: { color: { primary: { $type: 'color', $value: '#000' } } }
      };
      
      const themes = [];
      const metadata = { tokenSetOrder: ['core'] }; // Only has tokenSetOrder, no custom props
      
      const consolidated = await engine._consolidateTokenSets(tokenSets, themes, metadata);
      
      expect(consolidated.$themes).toBeUndefined(); // Empty themes array should not be added
      expect(consolidated.$metadata).toBeUndefined(); // Minimal metadata should not be added
      expect(consolidated.color.primary.$value).toBe('#000');
    });

    it('should handle token conversion with complex typography tokens', () => {
      const typographyToken = {
        value: {
          fontFamily: 'Arial',
          fontSize: '16px',
          fontWeight: 'bold'
        }
      };
      
      const converted = engine._convertToken(typographyToken);
      expect(converted.$type).toBe('typography');
      expect(converted.$value).toEqual(typographyToken.value);
    });

    it('should handle numeric token values', () => {
      const numericToken = { value: 16 };
      const converted = engine._convertToken(numericToken);
      
      expect(converted.$type).toBe('dimension');
      expect(converted.$value).toBe(16);
    });

    it('should handle gradient color values', () => {
      const gradientToken = { value: 'linear-gradient(90deg, #000000, #ffffff)' };
      const converted = engine._convertToken(gradientToken);
      
      expect(converted.$type).toBe('color');
      expect(converted.$value).toBe('linear-gradient(90deg, #000000, #ffffff)');
    });

    it('should handle percentage dimension values', () => {
      const percentToken = { value: '50%' };
      const converted = engine._convertToken(percentToken);
      
      expect(converted.$type).toBe('dimension');
      expect(converted.$value).toBe('50%');
    });

    it('should handle em dimension values', () => {
      const emToken = { value: '1.5em' };
      const converted = engine._convertToken(emToken);
      
      expect(converted.$type).toBe('dimension');
      expect(converted.$value).toBe('1.5em');
    });

    it('should handle unknown token types', () => {
      const unknownToken = { value: 'some-unknown-value' };
      const converted = engine._convertToken(unknownToken);
      
      expect(converted.$type).toBe('other');
      expect(converted.$value).toBe('some-unknown-value');
    });

    it('should handle validation errors during transformation validation', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve(JSON.stringify({ token: { value: '#000' } }));
        }
        if (filePath.includes('reconstituted.json')) {
          return Promise.resolve(JSON.stringify({ token: { value: '#fff' } }));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(result.differences[0].type).toBe('value_mismatch');
    });

    it('should handle extra keys in reconstituted data during validation', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve(JSON.stringify({ token1: { value: '#000' } }));
        }
        if (filePath.includes('reconstituted.json')) {
          return Promise.resolve(JSON.stringify({ 
            token1: { value: '#000' },
            token2: { value: '#fff' } // Extra key
          }));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(result.differences.some(diff => diff.type === 'extra_key')).toBe(true);
    });

    it('should handle missing reference validation', async () => {
      const original = { token: '{reference.token}' };
      const reconstituted = { token: '#000' };

      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve(JSON.stringify(original));
        }
        if (filePath.includes('reconstituted.json')) {
          return Promise.resolve(JSON.stringify(reconstituted));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(result.differences.some(diff => diff.type === 'missing_reference')).toBe(true);
    });

    it('should handle write errors during source file writing', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write permission denied'));

      await engine._writeSourceFile({ test: 'data' }, 'output.json');

      expect(engine.errors).toContain('Failed to write source file output.json: Write permission denied');
    });

    it('should handle source data that is already in modular format', async () => {
      const modularSourceData = {
        $metadata: { tokenSetOrder: ['core', 'global'] },
        $themes: [{ id: 'test', name: 'Test Theme' }],
        core: { color: { primary: { $type: 'color', $value: '#000' } } },
        global: { spacing: { base: { $type: 'dimension', $value: '8px' } } }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(modularSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(4); // metadata, themes, core, global
    });

    it('should handle validation errors in validateTransformation', async () => {
      // Mock to throw an error during validation
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          throw new Error('Validation processing error');
        }
        return Promise.resolve('{}');
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');

      expect(result.isValid).toBe(false);
      expect(engine.errors[0]).toContain('Validation processing error');
    });

    it('should handle edge cases in token set identification', () => {
      const edgeData = {
        'Color Ramp': null, // null value should be skipped
        typography: undefined, // undefined value should be skipped
        spacing: { base: { value: '8px' } }, // valid token set
        invalidSet: 'string value', // string should be skipped
        arraySet: [], // array should be skipped
        validCustom: { token: { value: 'test' } } // valid custom set
      };

      const tokenSets = engine._identifyTokenSets(edgeData);

      expect(tokenSets.core).toBeDefined();
      expect(tokenSets.core.spacing).toBeDefined();
      expect(tokenSets.validcustom).toBeDefined();
      expect(tokenSets['Color Ramp']).toBeUndefined();
      expect(tokenSets.typography).toBeUndefined();
    });

    it('should handle complex nested token references extraction', () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              token: '{deeply.nested.reference}'
            },
            directRef: '{simple.ref}'
          },
          stringValue: 'no reference here',
          anotherRef: '{another.reference}'
        }
      };

      const refs = engine._extractTokenReferences(complexData);

      expect(refs).toContain('{deeply.nested.reference}');
      expect(refs).toContain('{simple.ref}');
      expect(refs).toContain('{another.reference}');
      expect(refs).toHaveLength(3);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle multiple file read errors during consolidation', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.reject(new Error('Metadata read error'));
        }
        return Promise.reject(new Error('File read error'));
      });

      const result = await engine.consolidateToSource('tokens/', 'output.json');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle validation with malformed JSON', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('original.json')) {
          return Promise.resolve('{ invalid json }');
        }
        return Promise.resolve('{}');
      });

      const result = await engine.validateTransformation('original.json', 'reconstituted.json');
      
      expect(result.isValid).toBe(false);
    });

    it('should handle directory creation errors', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      fs.writeFile.mockResolvedValue();

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.errors.some(error => error.includes('Permission denied'))).toBe(true);
    });

    it('should handle backup creation failure during split', async () => {
      // Mock the ErrorHandlingSystem to simulate backup failure
      engine.errorHandler.createOperationBackup = jest.fn().mockResolvedValue({
        success: false,
        errors: ['Backup failed'],
        backupId: null
      });

      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Backup creation failed: Backup failed');
    });

    it('should handle backup creation failure during consolidation', async () => {
      // Mock the ErrorHandlingSystem to simulate backup failure
      engine.errorHandler.createOperationBackup = jest.fn().mockResolvedValue({
        success: false,
        errors: ['Backup failed'],
        backupId: null
      });

      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify({ tokenSetOrder: ['core'] }));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify([]));
        }
        if (filePath.includes('core.json')) {
          return Promise.resolve(JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } }));
        }
        return Promise.reject(new Error('File not found'));
      });

      fs.writeFile.mockResolvedValue();

      const result = await engine.consolidateToSource('tokens/', 'output.json');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Backup creation failed: Backup failed');
    });

    it('should handle existing output file during consolidation', async () => {
      // Mock _fileExists to return true for output file
      engine._fileExists = jest.fn().mockResolvedValue(true);
      
      engine.errorHandler.createOperationBackup = jest.fn().mockResolvedValue({
        success: true,
        backupId: 'test-backup'
      });

      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify({ tokenSetOrder: ['core'] }));
        }
        if (filePath.includes('core.json')) {
          return Promise.resolve(JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } }));
        }
        return Promise.resolve('{}');
      });

      fs.writeFile.mockResolvedValue();

      const result = await engine.consolidateToSource('tokens/', 'output.json');

      expect(result.success).toBe(true);
      expect(engine._fileExists).toHaveBeenCalledWith('output.json');
    });

    it('should handle unexpected errors during split with error reporting', async () => {
      // Mock to throw an unexpected error after successful file read
      fs.readFile.mockResolvedValue(JSON.stringify(mockSourceData));
      fs.mkdir.mockResolvedValue();
      
      // Mock the _generateMetadata method to throw an error
      const originalGenerateMetadata = engine._generateMetadata;
      engine._generateMetadata = jest.fn().mockRejectedValue(new Error('Unexpected metadata error'));
      
      engine.errorHandler.generateErrorReport = jest.fn().mockResolvedValue({
        report: 'Error report',
        suggestions: ['Try again']
      });

      const result = await engine.splitSourceToTokens('tokensource.json', 'tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unexpected error during split operation');
      expect(result.errorReport).toBe('Error report');
      expect(result.suggestions).toEqual(['Try again']);
      
      // Restore original method
      engine._generateMetadata = originalGenerateMetadata;
    });

    it('should handle unexpected errors during consolidation with error reporting', async () => {
      // Mock the _writeSourceFile method to throw an error
      const originalWriteSourceFile = engine._writeSourceFile;
      engine._writeSourceFile = jest.fn().mockRejectedValue(new Error('Write error'));
      
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify({ tokenSetOrder: ['core'] }));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify([]));
        }
        if (filePath.includes('core.json')) {
          return Promise.resolve(JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } }));
        }
        return Promise.reject(new Error('File not found'));
      });
      
      engine.errorHandler.generateErrorReport = jest.fn().mockResolvedValue({
        report: 'Consolidation error report',
        suggestions: ['Check file permissions']
      });

      const result = await engine.consolidateToSource('tokens/', 'output.json');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unexpected error during consolidation');
      expect(result.errorReport).toBe('Consolidation error report');
      expect(result.suggestions).toEqual(['Check file permissions']);
      
      // Restore original method
      engine._writeSourceFile = originalWriteSourceFile;
    });

    it('should handle themes file not found during consolidation', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify({ tokenSetOrder: ['core'] }));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.reject(new Error('Themes file not found'));
        }
        if (filePath.includes('core.json')) {
          return Promise.resolve(JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } }));
        }
        return Promise.reject(new Error('File not found'));
      });

      fs.writeFile.mockResolvedValue();

      const result = await engine.consolidateToSource('tokens/', 'output.json');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('No themes file found, using default theme configuration');
    });

    it('should handle token set file not found during consolidation', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify({ tokenSetOrder: ['core', 'missing'] }));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify([]));
        }
        if (filePath.includes('core.json')) {
          return Promise.resolve(JSON.stringify({ color: { primary: { $type: 'color', $value: '#000' } } }));
        }
        return Promise.reject(new Error('Token set file not found'));
      });

      fs.writeFile.mockResolvedValue();

      const result = await engine.consolidateToSource('tokens/', 'output.json');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Token set file not found: missing');
    });
  });
});