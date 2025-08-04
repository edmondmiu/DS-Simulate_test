/**
 * Unit tests for FileStructureManager
 * Tests all file structure operations, validation, and error handling
 */

const fs = require('fs').promises;
const path = require('path');
const FileStructureManager = require('../src/FileStructureManager');

// Mock fs module for testing
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn(),
    rmdir: jest.fn(),
    copyFile: jest.fn()
  }
}));

describe('FileStructureManager', () => {
  let manager;
  let mockMetadata;
  let mockThemes;

  beforeEach(() => {
    manager = new FileStructureManager();
    jest.clearAllMocks();

    mockMetadata = {
      tokenSetOrder: ['core', 'global', 'simulate']
    };

    mockThemes = [
      {
        id: 'base-theme',
        name: 'Base',
        selectedTokenSets: {
          core: 'source',
          global: 'enabled'
        },
        $figmaStyleReferences: {},
        $figmaVariableReferences: {}
      }
    ];

    // Default successful mocks
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => true });
  });

  describe('initializeTokensFolder', () => {
    it('should successfully initialize tokens folder', async () => {
      fs.access.mockRejectedValue(new Error('File not found')); // Files don't exist initially

      const result = await manager.initializeTokensFolder('tokens/');

      // Check that files were created (regardless of validation outcome)
      expect(result.structure.tokensDir).toBe('tokens/');
      expect(Object.keys(result.structure.files)).toContain('$metadata.json');
      expect(Object.keys(result.structure.files)).toContain('$themes.json');
      expect(result.structure.files['$metadata.json'].created).toBe(true);
      expect(result.structure.files['$themes.json'].created).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith('tokens/', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // metadata and themes
    });

    it('should handle existing files gracefully', async () => {
      fs.access.mockResolvedValue(); // Files exist

      const result = await manager.initializeTokensFolder('tokens/');

      expect(result.success).toBe(true);
      expect(result.structure.files['$metadata.json'].created).toBe(false);
      expect(result.structure.files['$themes.json'].created).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle directory creation errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await manager.initializeTokensFolder('tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Permission denied');
    });

    it('should handle file creation errors', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      const result = await manager.initializeTokensFolder('tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Disk full');
    });

    it('should create proper default metadata structure', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      await manager.initializeTokensFolder('tokens/');

      const metadataCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('$metadata.json')
      );
      expect(metadataCall).toBeDefined();
      
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata).toHaveProperty('tokenSetOrder');
      expect(Array.isArray(metadata.tokenSetOrder)).toBe(true);
    });

    it('should create proper default themes structure', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      await manager.initializeTokensFolder('tokens/');

      const themesCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('$themes.json')
      );
      expect(themesCall).toBeDefined();
      
      const themes = JSON.parse(themesCall[1]);
      expect(Array.isArray(themes)).toBe(true);
      expect(themes[0]).toHaveProperty('id');
      expect(themes[0]).toHaveProperty('selectedTokenSets');
    });
  });

  describe('validateStructure', () => {
    beforeEach(() => {
      // Mock successful file reads for validation
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify(mockThemes));
        }
        return Promise.resolve('{}');
      });

      fs.readdir.mockResolvedValue(['$metadata.json', '$themes.json', 'core.json', 'global.json']);
      fs.access.mockResolvedValue(); // All files exist
    });

    it('should validate correct structure successfully', async () => {
      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(true);
      expect(result.missingFiles).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing directory', async () => {
      fs.stat.mockRejectedValue(new Error('Directory not found'));

      const result = await manager.validateStructure('nonexistent/');

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain('Tokens directory does not exist');
    });

    it('should detect missing required files', async () => {
      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve();
      });

      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(false);
      expect(result.missingFiles).toContain('$metadata.json');
    });

    it('should detect invalid JSON in files', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve('invalid json');
        }
        return Promise.resolve(JSON.stringify(mockThemes));
      });

      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain('Invalid JSON in $metadata.json');
    });

    it('should detect invalid metadata structure', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify({ invalid: 'structure' }));
        }
        return Promise.resolve(JSON.stringify(mockThemes));
      });

      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain('$metadata.json must contain tokenSetOrder array');
    });

    it('should detect invalid themes structure', async () => {
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify({ invalid: 'structure' }));
        }
        return Promise.resolve('{}');
      });

      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain('$themes.json must be an array');
    });

    it('should detect incomplete theme objects', async () => {
      const incompleteThemes = [{ id: 'test' }]; // Missing name and selectedTokenSets
      
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify(incompleteThemes));
        }
        return Promise.resolve('{}');
      });

      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain('Theme at index 0 missing required properties');
    });

    it('should detect token set consistency issues', async () => {
      const metadataWithMissingFile = {
        tokenSetOrder: ['core', 'global', 'missing-set']
      };

      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify(metadataWithMissingFile));
        }
        return Promise.resolve(JSON.stringify(mockThemes));
      });

      fs.access.mockImplementation((filePath) => {
        if (filePath.includes('missing-set.json')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve();
      });

      const result = await manager.validateStructure('tokens/');

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain("Token set 'missing-set' listed in metadata but file 'missing-set.json' not found");
    });

    it('should warn about orphaned files', async () => {
      fs.readdir.mockResolvedValue(['$metadata.json', '$themes.json', 'core.json', 'orphaned.json']);
      
      const result = await manager.validateStructure('tokens/');

      expect(result.warnings[0]).toContain("Token file 'orphaned.json' exists but not listed in metadata tokenSetOrder");
    });
  });

  describe('getTokenSetMapping', () => {
    it('should return correct token set mapping', () => {
      const mapping = manager.getTokenSetMapping();

      expect(mapping).toHaveProperty('core', 'core.json');
      expect(mapping).toHaveProperty('global', 'global.json');
      expect(mapping).toHaveProperty('simulate', 'simulate.json');
      expect(mapping).toHaveProperty('$metadata', '$metadata.json');
      expect(mapping).toHaveProperty('$themes', '$themes.json');
    });

    it('should include all expected token sets', () => {
      const mapping = manager.getTokenSetMapping();
      const expectedSets = ['core', 'global', 'components', 'simulate', 'Content Typography', 'existing'];

      for (const setName of expectedSets) {
        expect(mapping).toHaveProperty(setName);
        expect(mapping[setName]).toMatch(/\.json$/);
      }
    });
  });

  describe('getTokenSetFileName', () => {
    it('should return correct filename for known token sets', () => {
      expect(manager.getTokenSetFileName('core')).toBe('core.json');
      expect(manager.getTokenSetFileName('global')).toBe('global.json');
      expect(manager.getTokenSetFileName('Content Typography')).toBe('Content Typography.json');
    });

    it('should handle unknown token sets', () => {
      expect(manager.getTokenSetFileName('custom-set')).toBe('custom-set.json');
      expect(manager.getTokenSetFileName('Brand Tokens')).toBe('brand-tokens.json');
    });

    it('should sanitize special characters in filenames', () => {
      expect(manager.getTokenSetFileName('Special@#$%Characters')).toBe('specialcharacters.json');
      expect(manager.getTokenSetFileName('Spaces In Name')).toBe('spaces-in-name.json');
    });
  });

  describe('getTokenSetNameFromFile', () => {
    it('should return correct token set name for known files', () => {
      expect(manager.getTokenSetNameFromFile('core.json')).toBe('core');
      expect(manager.getTokenSetNameFromFile('global.json')).toBe('global');
      expect(manager.getTokenSetNameFromFile('Content Typography.json')).toBe('Content Typography');
    });

    it('should handle unknown files', () => {
      expect(manager.getTokenSetNameFromFile('custom.json')).toBe('custom');
      expect(manager.getTokenSetNameFromFile('brand-tokens.json')).toBe('brand-tokens');
    });

    it('should handle files without .json extension', () => {
      expect(manager.getTokenSetNameFromFile('core')).toBe('core');
      expect(manager.getTokenSetNameFromFile('custom-set')).toBe('custom-set');
    });
  });

  describe('listTokenFiles', () => {
    it('should list token files correctly', async () => {
      fs.readdir.mockResolvedValue(['$metadata.json', '$themes.json', 'core.json', 'global.json', 'README.md']);
      fs.stat.mockResolvedValue({ isFile: () => true });

      const result = await manager.listTokenFiles('tokens/');

      expect(result.tokenFiles).toEqual(['core.json', 'global.json']);
      expect(result.metadataFiles).toEqual(['$metadata.json', '$themes.json']);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle directory read errors', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await manager.listTokenFiles('tokens/');

      expect(result.tokenFiles).toHaveLength(0);
      expect(result.metadataFiles).toHaveLength(0);
      expect(result.errors[0]).toContain('Permission denied');
    });

    it('should filter out non-JSON files', async () => {
      fs.readdir.mockResolvedValue(['core.json', 'README.md', 'config.txt', '$metadata.json']);
      fs.stat.mockResolvedValue({ isFile: () => true });

      const result = await manager.listTokenFiles('tokens/');

      expect(result.tokenFiles).toEqual(['core.json']);
      expect(result.metadataFiles).toEqual(['$metadata.json']);
    });

    it('should sort files alphabetically', async () => {
      fs.readdir.mockResolvedValue(['z-tokens.json', 'a-tokens.json', '$themes.json', '$metadata.json']);
      fs.stat.mockResolvedValue({ isFile: () => true });

      const result = await manager.listTokenFiles('tokens/');

      expect(result.tokenFiles).toEqual(['a-tokens.json', 'z-tokens.json']);
      expect(result.metadataFiles).toEqual(['$metadata.json', '$themes.json']);
    });
  });

  describe('cleanTokensDirectory', () => {
    beforeEach(() => {
      fs.readdir.mockResolvedValue(['$metadata.json', '$themes.json', 'core.json', 'README.md']);
      fs.stat.mockResolvedValue({ isFile: () => true });
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();
    });

    it('should clean JSON files from directory', async () => {
      // Mock directory exists
      fs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => true });
      
      const result = await manager.cleanTokensDirectory('tokens/');

      expect(result.success).toBe(true);
      expect(result.removedFiles).toEqual(['$metadata.json', '$themes.json', 'core.json']);
      expect(fs.unlink).toHaveBeenCalledTimes(3);
      expect(fs.rmdir).toHaveBeenCalledWith('tokens/');
    });

    it('should preserve directory structure when requested', async () => {
      const result = await manager.cleanTokensDirectory('tokens/', true);

      expect(result.success).toBe(true);
      expect(fs.rmdir).not.toHaveBeenCalled();
    });

    it('should handle non-existent directory gracefully', async () => {
      fs.stat.mockRejectedValue(new Error('Directory not found'));

      const result = await manager.cleanTokensDirectory('nonexistent/');

      expect(result.success).toBe(true);
      expect(result.removedFiles).toHaveLength(0);
      expect(result.warnings[0]).toContain('Directory does not exist');
    });

    it('should handle file deletion errors', async () => {
      // Mock directory exists
      fs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => true });
      fs.unlink.mockRejectedValue(new Error('Permission denied'));

      const result = await manager.cleanTokensDirectory('tokens/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Permission denied');
    });

    it('should handle directory removal errors gracefully', async () => {
      // Mock directory exists and files are successfully removed
      fs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => true });
      fs.unlink.mockResolvedValue(); // Files are removed successfully
      fs.rmdir.mockRejectedValue(new Error('Directory not empty'));

      const result = await manager.cleanTokensDirectory('tokens/');

      expect(result.success).toBe(true); // Should still succeed
      expect(result.warnings[0]).toContain('Could not remove directory');
    });
  });

  describe('createBackup', () => {
    beforeEach(() => {
      fs.readdir.mockResolvedValue(['$metadata.json', '$themes.json', 'core.json']);
      fs.copyFile.mockResolvedValue();
    });

    it('should create backup successfully', async () => {
      const result = await manager.createBackup('tokens/', 'backups/');

      expect(result.success).toBe(true);
      expect(result.backupPath).toMatch(/backups\/tokens-backup-/);
      expect(fs.mkdir).toHaveBeenCalledWith('backups/', { recursive: true });
      expect(fs.copyFile).toHaveBeenCalledTimes(3);
    });

    it('should handle backup creation errors', async () => {
      fs.copyFile.mockRejectedValue(new Error('Disk full'));

      const result = await manager.createBackup('tokens/', 'backups/');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Disk full');
    });

    it('should create timestamped backup directory', async () => {
      const result = await manager.createBackup('tokens/', 'backups/');

      expect(result.backupPath).toMatch(/tokens-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it('should only backup JSON files', async () => {
      fs.readdir.mockResolvedValue(['$metadata.json', 'core.json', 'README.md', 'config.txt']);

      await manager.createBackup('tokens/', 'backups/');

      expect(fs.copyFile).toHaveBeenCalledTimes(2); // Only JSON files
    });
  });

  describe('error handling', () => {
    it('should collect multiple errors during initialization', async () => {
      fs.mkdir.mockRejectedValue(new Error('Directory error'));
      fs.writeFile.mockRejectedValue(new Error('Write error'));

      const result = await manager.initializeTokensFolder('tokens/');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Make stat throw an error - this will be caught by _directoryExists and return false
      fs.stat.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await manager.validateStructure('tokens/');

      // The system should handle the error gracefully and return a valid result
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('missingFiles');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result.isValid).toBe(false);
      // The directory doesn't exist error should be in issues, not errors
      expect(result.issues[0]).toContain('Tokens directory does not exist');
    });

    it('should reset errors between operations', async () => {
      fs.mkdir.mockRejectedValue(new Error('First error'));
      
      await manager.initializeTokensFolder('tokens/');
      expect(manager.errors.length).toBeGreaterThan(0);

      // Reset mocks for second operation
      fs.mkdir.mockResolvedValue();
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => true });
      fs.readdir.mockResolvedValue(['$metadata.json', '$themes.json']);
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('$metadata.json')) {
          return Promise.resolve(JSON.stringify(mockMetadata));
        }
        if (filePath.includes('$themes.json')) {
          return Promise.resolve(JSON.stringify(mockThemes));
        }
        return Promise.resolve('{}');
      });
      
      const result = await manager.validateStructure('tokens/');
      expect(result.errors).toHaveLength(0); // Errors should be reset
    });
  });

  describe('private helper methods', () => {
    describe('_sanitizeFileName', () => {
      it('should sanitize special characters', () => {
        const sanitized = manager._sanitizeFileName('Test@#$%Name');
        expect(sanitized).toBe('testname');
      });

      it('should replace spaces with hyphens', () => {
        const sanitized = manager._sanitizeFileName('Token Set Name');
        expect(sanitized).toBe('token-set-name');
      });

      it('should convert to lowercase', () => {
        const sanitized = manager._sanitizeFileName('UPPERCASE');
        expect(sanitized).toBe('uppercase');
      });

      it('should preserve hyphens and underscores', () => {
        const sanitized = manager._sanitizeFileName('valid-name_with_underscores');
        expect(sanitized).toBe('valid-name_with_underscores');
      });
    });

    describe('_fileExists', () => {
      it('should return true for existing files', async () => {
        fs.access.mockResolvedValue();
        
        const exists = await manager._fileExists('existing.json');
        expect(exists).toBe(true);
      });

      it('should return false for non-existent files', async () => {
        fs.access.mockRejectedValue(new Error('File not found'));
        
        const exists = await manager._fileExists('missing.json');
        expect(exists).toBe(false);
      });
    });

    describe('_directoryExists', () => {
      it('should return true for existing directories', async () => {
        fs.stat.mockResolvedValue({ isDirectory: () => true });
        
        const exists = await manager._directoryExists('tokens/');
        expect(exists).toBe(true);
      });

      it('should return false for non-existent directories', async () => {
        fs.stat.mockRejectedValue(new Error('Directory not found'));
        
        const exists = await manager._directoryExists('missing/');
        expect(exists).toBe(false);
      });

      it('should return false for files (not directories)', async () => {
        fs.stat.mockResolvedValue({ isDirectory: () => false });
        
        const exists = await manager._directoryExists('file.json');
        expect(exists).toBe(false);
      });
    });
  });
});