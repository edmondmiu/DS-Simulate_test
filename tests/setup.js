/**
 * Jest Test Setup
 * 
 * Global test configuration and utilities for the comprehensive testing suite
 */

const fs = require('fs').promises;
const path = require('path');

// Global test timeout
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Create temporary test directory
  async createTempDir(prefix = 'test') {
    const tempDir = path.join(__dirname, '..', '.temp', `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  },

  // Clean up temporary directory
  async cleanupTempDir(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${tempDir}:`, error.message);
    }
  },

  // Create test token source
  createTestTokenSource() {
    return {
      "core": {
        "color": {
          "primary": {
            "100": { "$type": "color", "$value": "#f0f9ff", "$description": "Light primary" },
            "500": { "$type": "color", "$value": "#3b82f6", "$description": "Primary brand color" },
            "900": { "$type": "color", "$value": "#1e3a8a", "$description": "Dark primary" }
          },
          "neutral": {
            "50": { "$type": "color", "$value": "#f9fafb" },
            "900": { "$type": "color", "$value": "#111827" }
          }
        },
        "spacing": {
          "xs": { "$type": "dimension", "$value": "4px" },
          "sm": { "$type": "dimension", "$value": "8px" },
          "md": { "$type": "dimension", "$value": "16px" },
          "lg": { "$type": "dimension", "$value": "24px" }
        },
        "typography": {
          "fontFamily": {
            "primary": { "$type": "fontFamily", "$value": "Inter, sans-serif" },
            "mono": { "$type": "fontFamily", "$value": "JetBrains Mono, monospace" }
          },
          "fontSize": {
            "sm": { "$type": "dimension", "$value": "14px" },
            "base": { "$type": "dimension", "$value": "16px" },
            "lg": { "$type": "dimension", "$value": "18px" }
          }
        }
      },
      "global": {
        "semantic": {
          "primary": { "$type": "color", "$value": "{core.color.primary.500}" },
          "background": { "$type": "color", "$value": "{core.color.neutral.50}" },
          "text": { "$type": "color", "$value": "{core.color.neutral.900}" }
        },
        "component": {
          "button": {
            "padding": { "$type": "dimension", "$value": "{core.spacing.md}" },
            "background": { "$type": "color", "$value": "{global.semantic.primary}" },
            "fontSize": { "$type": "dimension", "$value": "{core.typography.fontSize.base}" }
          },
          "card": {
            "padding": { "$type": "dimension", "$value": "{core.spacing.lg}" },
            "background": { "$type": "color", "$value": "{global.semantic.background}" }
          }
        }
      },
      "simulate": {
        "brand": {
          "primary": { "$type": "color", "$value": "{global.semantic.primary}" },
          "accent": { "$type": "color", "$value": "{core.color.primary.100}" }
        }
      },
      "$metadata": {
        "tokenSetOrder": ["core", "global", "simulate"]
      },
      "$themes": [
        {
          "id": "light-theme",
          "name": "Light Theme",
          "selectedTokenSets": {
            "core": "source",
            "global": "enabled",
            "simulate": "enabled"
          },
          "$figmaStyleReferences": {
            "core.color.primary.500": "S:abc123",
            "global.semantic.primary": "S:def456"
          }
        },
        {
          "id": "dark-theme",
          "name": "Dark Theme",
          "selectedTokenSets": {
            "core": "source",
            "global": "enabled",
            "simulate": "disabled"
          }
        }
      ]
    };
  },

  // Create large token source for performance testing
  createLargeTokenSource(tokenCount = 1000) {
    const source = this.createTestTokenSource();
    
    // Add many tokens for performance testing
    source.performance = {};
    for (let i = 0; i < tokenCount; i++) {
      source.performance[`token${i}`] = {
        "$type": "color",
        "$value": `#${i.toString(16).padStart(6, '0')}`,
        "$description": `Performance test token ${i}`
      };
    }
    
    source.$metadata.tokenSetOrder.push('performance');
    source.$themes[0].selectedTokenSets.performance = 'enabled';
    
    return source;
  },

  // Create token source with complex references
  createComplexReferenceSource() {
    return {
      "base": {
        "color": {
          "red": { "$type": "color", "$value": "#ff0000" },
          "green": { "$type": "color", "$value": "#00ff00" },
          "blue": { "$type": "color", "$value": "#0000ff" }
        }
      },
      "level1": {
        "primary": { "$type": "color", "$value": "{base.color.red}" },
        "secondary": { "$type": "color", "$value": "{base.color.green}" }
      },
      "level2": {
        "button": { "$type": "color", "$value": "{level1.primary}" },
        "link": { "$type": "color", "$value": "{level1.secondary}" }
      },
      "level3": {
        "cta": { "$type": "color", "$value": "{level2.button}" },
        "nav": { "$type": "color", "$value": "{level2.link}" }
      },
      "$metadata": {
        "tokenSetOrder": ["base", "level1", "level2", "level3"]
      },
      "$themes": [
        {
          "id": "complex-theme",
          "name": "Complex Reference Theme",
          "selectedTokenSets": {
            "base": "source",
            "level1": "enabled",
            "level2": "enabled",
            "level3": "enabled"
          }
        }
      ]
    };
  },

  // Wait for a specified time (for async operations)
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Check if file exists
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  // Read JSON file safely
  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
    }
  },

  // Write JSON file safely
  async writeJsonFile(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
    }
  },

  // Performance measurement utility
  measurePerformance(fn) {
    return async (...args) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      const result = await fn(...args);
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      return {
        result,
        performance: {
          duration: Number(endTime - startTime) / 1000000, // Convert to milliseconds
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          }
        }
      };
    };
  }
};

// Global test constants
global.TEST_CONSTANTS = {
  TIMEOUT: {
    SHORT: 5000,
    MEDIUM: 15000,
    LONG: 30000
  },
  PERFORMANCE: {
    SMALL_TOKEN_COUNT: 100,
    MEDIUM_TOKEN_COUNT: 500,
    LARGE_TOKEN_COUNT: 1000,
    MAX_PROCESSING_TIME: 5000, // 5 seconds
    MAX_MEMORY_USAGE: 100 * 1024 * 1024 // 100MB
  }
};

// Console suppression for tests
const originalConsole = { ...console };
global.suppressConsole = () => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
};

global.restoreConsole = () => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
};

// Cleanup after all tests
afterAll(async () => {
  // Clean up any remaining temp directories
  try {
    const tempDir = path.join(__dirname, '..', '.temp');
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});