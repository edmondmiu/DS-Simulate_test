/**
 * Performance Tests
 * 
 * Comprehensive performance testing for:
 * - Large token sets processing
 * - Complex reference resolution
 * - Memory usage optimization
 * - Concurrent operations
 * - Scalability limits
 * 
 * Requirements tested: Performance considerations from all components
 */

const fs = require('fs').promises;
const path = require('path');
const TokenTransformationEngine = require('../src/TokenTransformationEngine');
const ValidationSystem = require('../src/ValidationSystem');
const FileStructureManager = require('../src/FileStructureManager');
const ModularEditingManager = require('../src/ModularEditingManager');

describe('Performance Tests', () => {
  let tempDir;
  let engine;
  let validator;
  let fileManager;
  let editingManager;

  beforeAll(async () => {
    tempDir = await testUtils.createTempDir('performance');
    engine = new TokenTransformationEngine();
    validator = new ValidationSystem();
    fileManager = new FileStructureManager();
    editingManager = new ModularEditingManager(tempDir);
  });

  afterAll(async () => {
    if (editingManager) {
      await editingManager.cleanup();
    }
    await testUtils.cleanupTempDir(tempDir);
  });

  describe('Large Token Set Processing', () => {
    test('should process 1000 tokens within performance limits', async () => {
      const largeTokenSource = testUtils.createLargeTokenSource(1000);
      const sourcePath = path.join(tempDir, 'large-source.json');
      const tokensDir = path.join(tempDir, 'large-tokens');
      
      await testUtils.writeJsonFile(sourcePath, largeTokenSource);

      const measureSplit = testUtils.measurePerformance(
        engine.splitSourceToTokens.bind(engine)
      );

      const { result: splitResult, performance: splitPerf } = await measureSplit(sourcePath, tokensDir);

      expect(splitResult.success).toBe(true);
      expect(splitResult.files.length).toBeGreaterThan(0);
      
      // Performance assertions
      expect(splitPerf.duration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE.MAX_PROCESSING_TIME);
      expect(splitPerf.memoryDelta.heapUsed).toBeLessThan(TEST_CONSTANTS.PERFORMANCE.MAX_MEMORY_USAGE);

      // Test consolidation performance
      const measureConsolidate = testUtils.measurePerformance(
        engine.consolidateToSource.bind(engine)
      );

      const consolidatedPath = path.join(tempDir, 'large-consolidated.json');
      const { result: consolidateResult, performance: consolidatePerf } = await measureConsolidate(tokensDir, consolidatedPath);

      expect(consolidateResult.success).toBe(true);
      expect(consolidateResult.tokensCount).toBeGreaterThan(1000);
      
      expect(consolidatePerf.duration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE.MAX_PROCESSING_TIME);
      expect(consolidatePerf.memoryDelta.heapUsed).toBeLessThan(TEST_CONSTANTS.PERFORMANCE.MAX_MEMORY_USAGE);
    }, TEST_CONSTANTS.TIMEOUT.LONG);

    test('should handle 5000 tokens with acceptable performance degradation', async () => {
      const veryLargeTokenSource = testUtils.createLargeTokenSource(5000);
      const sourcePath = path.join(tempDir, 'very-large-source.json');
      const tokensDir = path.join(tempDir, 'very-large-tokens');
      
      await testUtils.writeJsonFile(sourcePath, veryLargeTokenSource);

      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      
      const splitTime = Date.now() - startTime;
      const splitMemory = process.memoryUsage();

      expect(splitResult.success).toBe(true);
      expect(splitTime).toBeLessThan(15000); // 15 seconds max for 5000 tokens
      expect(splitMemory.heapUsed - startMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB max

      // Test throughput
      const tokensPerSecond = 5000 / (splitTime / 1000);
      expect(tokensPerSecond).toBeGreaterThan(100); // At least 100 tokens per second
    }, 30000);

    test('should maintain performance with deeply nested token structures', async () => {
      const deepTokenSource = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      // Add tokens at each level
      let currentLevel = deepTokenSource;
      for (let i = 1; i <= 10; i++) {
        const levelKey = `level${i}`;
        if (i < 10) {
          currentLevel = currentLevel[levelKey];
        } else {
          // Add many tokens at the deepest level
          for (let j = 0; j < 100; j++) {
            currentLevel[levelKey][`token${j}`] = {
              "$type": "color",
              "$value": `#${j.toString(16).padStart(6, '0')}`,
              "$description": `Deep token ${j} at level ${i}`
            };
          }
        }
      }

      const sourcePath = path.join(tempDir, 'deep-source.json');
      const tokensDir = path.join(tempDir, 'deep-tokens');
      
      await testUtils.writeJsonFile(sourcePath, deepTokenSource);

      const measureSplit = testUtils.measurePerformance(
        engine.splitSourceToTokens.bind(engine)
      );

      const { result, performance } = await measureSplit(sourcePath, tokensDir);

      expect(result.success).toBe(true);
      expect(performance.duration).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Complex Reference Resolution Performance', () => {
    test('should resolve complex reference chains efficiently', async () => {
      const complexSource = testUtils.createComplexReferenceSource();
      
      // Add more complex reference chains
      complexSource.level4 = {
        "deep": { "$type": "color", "$value": "{level3.cta}" }
      };
      complexSource.level5 = {
        "deeper": { "$type": "color", "$value": "{level4.deep}" }
      };

      const sourcePath = path.join(tempDir, 'complex-source.json');
      const tokensDir = path.join(tempDir, 'complex-tokens');
      
      await testUtils.writeJsonFile(sourcePath, complexSource);
      
      // Split first
      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      expect(splitResult.success).toBe(true);

      // Test reference resolution performance
      const measureValidation = testUtils.measurePerformance(
        validator.validateTokenReferences.bind(validator)
      );

      const { result: validationResult, performance } = await measureValidation(tokensDir);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.unresolvedReferences).toHaveLength(0);
      expect(performance.duration).toBeLessThan(2000); // 2 seconds max for complex references
    });

    test('should handle circular reference detection efficiently', async () => {
      const circularSource = {
        "tokens": {
          "a": { "$type": "color", "$value": "{tokens.b}" },
          "b": { "$type": "color", "$value": "{tokens.c}" },
          "c": { "$type": "color", "$value": "{tokens.a}" }
        }
      };

      const sourcePath = path.join(tempDir, 'circular-source.json');
      const tokensDir = path.join(tempDir, 'circular-tokens');
      
      await testUtils.writeJsonFile(sourcePath, circularSource);
      
      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      expect(splitResult.success).toBe(true);

      const startTime = Date.now();
      const validationResult = await validator.validateTokenReferences(tokensDir);
      const duration = Date.now() - startTime;

      expect(validationResult.isValid).toBe(false);
      expect(duration).toBeLessThan(1000); // Should detect circular references quickly
    });

    test('should scale reference resolution with token count', async () => {
      const scaleTestSizes = [100, 500, 1000];
      const results = [];

      for (const size of scaleTestSizes) {
        const source = {
          base: {},
          references: {}
        };

        // Create base tokens
        for (let i = 0; i < size; i++) {
          source.base[`token${i}`] = {
            "$type": "color",
            "$value": `#${i.toString(16).padStart(6, '0')}`
          };
        }

        // Create reference tokens
        for (let i = 0; i < size; i++) {
          source.references[`ref${i}`] = {
            "$type": "color",
            "$value": `{base.token${i}}`
          };
        }

        const sourcePath = path.join(tempDir, `scale-${size}-source.json`);
        const tokensDir = path.join(tempDir, `scale-${size}-tokens`);
        
        await testUtils.writeJsonFile(sourcePath, source);
        
        const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
        expect(splitResult.success).toBe(true);

        const startTime = Date.now();
        const validationResult = await validator.validateTokenReferences(tokensDir);
        const duration = Date.now() - startTime;

        expect(validationResult.isValid).toBe(true);
        
        results.push({
          size,
          duration,
          tokensPerMs: size / duration
        });
      }

      // Performance should not degrade significantly with scale
      const throughputRatio = results[2].tokensPerMs / results[0].tokensPerMs;
      expect(throughputRatio).toBeGreaterThan(0.5); // Should maintain at least 50% throughput
    });
  });

  describe('Memory Usage Optimization', () => {
    test('should maintain stable memory usage during large operations', async () => {
      const iterations = 10;
      const memoryReadings = [];

      for (let i = 0; i < iterations; i++) {
        const source = testUtils.createLargeTokenSource(500);
        const sourcePath = path.join(tempDir, `memory-test-${i}.json`);
        const tokensDir = path.join(tempDir, `memory-tokens-${i}`);
        
        await testUtils.writeJsonFile(sourcePath, source);

        const beforeMemory = process.memoryUsage();
        
        const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
        expect(splitResult.success).toBe(true);

        const consolidatedPath = path.join(tempDir, `memory-consolidated-${i}.json`);
        const consolidateResult = await engine.consolidateToSource(tokensDir, consolidatedPath);
        expect(consolidateResult.success).toBe(true);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const afterMemory = process.memoryUsage();
        memoryReadings.push({
          iteration: i,
          heapUsed: afterMemory.heapUsed,
          heapTotal: afterMemory.heapTotal,
          delta: afterMemory.heapUsed - beforeMemory.heapUsed
        });

        // Clean up files to prevent disk space issues
        await fs.rm(tokensDir, { recursive: true, force: true });
        await fs.unlink(sourcePath);
        await fs.unlink(consolidatedPath);
      }

      // Check for memory leaks - heap usage should not grow significantly
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const memoryGrowth = lastReading.heapUsed - firstReading.heapUsed;
      
      // Memory growth should be less than 50MB over 10 iterations
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle memory pressure gracefully', async () => {
      // Create a very large token source to test memory pressure
      const hugeSource = testUtils.createLargeTokenSource(10000);
      
      // Add complex nested structures
      hugeSource.complex = {};
      for (let i = 0; i < 100; i++) {
        hugeSource.complex[`group${i}`] = {};
        for (let j = 0; j < 50; j++) {
          hugeSource.complex[`group${i}`][`token${j}`] = {
            "$type": "color",
            "$value": `#${(i * 50 + j).toString(16).padStart(6, '0')}`,
            "$description": `Complex token ${i}-${j} with a very long description that takes up more memory and tests string handling performance`
          };
        }
      }

      const sourcePath = path.join(tempDir, 'huge-source.json');
      const tokensDir = path.join(tempDir, 'huge-tokens');
      
      await testUtils.writeJsonFile(sourcePath, hugeSource);

      const beforeMemory = process.memoryUsage();
      
      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      
      const afterMemory = process.memoryUsage();
      const memoryUsed = afterMemory.heapUsed - beforeMemory.heapUsed;

      expect(splitResult.success).toBe(true);
      // Should handle large datasets without excessive memory usage
      expect(memoryUsed).toBeLessThan(500 * 1024 * 1024); // 500MB max
    }, 60000);
  });

  describe('Concurrent Operations Performance', () => {
    test('should handle multiple simultaneous operations', async () => {
      const concurrentOperations = 5;
      const promises = [];

      for (let i = 0; i < concurrentOperations; i++) {
        const source = testUtils.createTestTokenSource();
        const sourcePath = path.join(tempDir, `concurrent-${i}.json`);
        const tokensDir = path.join(tempDir, `concurrent-tokens-${i}`);
        
        const operation = async () => {
          await testUtils.writeJsonFile(sourcePath, source);
          
          const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
          expect(splitResult.success).toBe(true);
          
          const consolidatedPath = path.join(tempDir, `concurrent-consolidated-${i}.json`);
          const consolidateResult = await engine.consolidateToSource(tokensDir, consolidatedPath);
          expect(consolidateResult.success).toBe(true);
          
          return { split: splitResult, consolidate: consolidateResult };
        };

        promises.push(operation());
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All operations should succeed
      results.forEach(result => {
        expect(result.split.success).toBe(true);
        expect(result.consolidate.success).toBe(true);
      });

      // Concurrent operations should not take significantly longer than sequential
      expect(duration).toBeLessThan(10000); // 10 seconds max for 5 concurrent operations
    });

    test('should maintain performance under concurrent editing sessions', async () => {
      const sessionCount = 3;
      const sessions = [];

      // Initialize multiple editing sessions
      for (let i = 0; i < sessionCount; i++) {
        const sessionId = `concurrent-session-${i}`;
        const initResult = await editingManager.initializeEditingSession(sessionId, {
          autoValidate: true,
          trackChanges: true
        });
        expect(initResult.success).toBe(true);
        sessions.push(sessionId);
      }

      // Perform concurrent operations
      const operations = sessions.map(async (sessionId, index) => {
        const filePath = path.join(tempDir, `session-${index}.json`);
        const tokenData = {
          color: {
            [`session${index}`]: {
              "$type": "color",
              "$value": `#${index.toString(16).padStart(6, '0')}`,
              "$description": `Session ${index} token`
            }
          }
        };
        
        await testUtils.writeJsonFile(filePath, tokenData);
        
        const validationResult = await editingManager.validateTokenFile(filePath, sessionId);
        expect(validationResult.isValid).toBe(true);
        
        await editingManager.trackChange(sessionId, filePath, {
          type: 'concurrent_test',
          sessionIndex: index
        });
        
        return sessionId;
      });

      const startTime = Date.now();
      const completedSessions = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(completedSessions).toHaveLength(sessionCount);
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Clean up sessions
      for (const sessionId of sessions) {
        await editingManager.finalizeEditingSession(sessionId);
      }
    });
  });

  describe('Validation Performance', () => {
    test('should validate large token structures efficiently', async () => {
      const largeSource = testUtils.createLargeTokenSource(2000);
      const sourcePath = path.join(tempDir, 'validation-large.json');
      const tokensDir = path.join(tempDir, 'validation-tokens');
      
      await testUtils.writeJsonFile(sourcePath, largeSource);
      
      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      expect(splitResult.success).toBe(true);

      const measureValidation = testUtils.measurePerformance(
        validator.validateTokenStudioStructure.bind(validator)
      );

      const { result: structureResult, performance: structurePerf } = await measureValidation(tokensDir);
      expect(structureResult.isValid).toBe(true);
      expect(structurePerf.duration).toBeLessThan(3000); // 3 seconds max

      const measureReferences = testUtils.measurePerformance(
        validator.validateTokenReferences.bind(validator)
      );

      const { result: referencesResult, performance: referencesPerf } = await measureReferences(tokensDir);
      expect(referencesResult.isValid).toBe(true);
      expect(referencesPerf.duration).toBeLessThan(3000); // 3 seconds max
    });

    test('should generate comprehensive reports efficiently', async () => {
      const source = testUtils.createTestTokenSource();
      const sourcePath = path.join(tempDir, 'report-source.json');
      const tokensDir = path.join(tempDir, 'report-tokens');
      
      await testUtils.writeJsonFile(sourcePath, source);
      
      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      expect(splitResult.success).toBe(true);

      const measureReport = testUtils.measurePerformance(
        validator.generateValidationReport.bind(validator)
      );

      const { result: reportResult, performance } = await measureReport(tokensDir, sourcePath);
      
      expect(reportResult.isValid).toBe(true);
      expect(reportResult.report).toBeDefined();
      expect(reportResult.report.validations).toBeDefined();
      expect(performance.duration).toBeLessThan(2000); // 2 seconds max
    });
  });

  describe('File System Performance', () => {
    test('should handle many small files efficiently', async () => {
      const fileCount = 100;
      const tokensDir = path.join(tempDir, 'many-files');
      
      await fs.mkdir(tokensDir, { recursive: true });

      // Create many small token files
      const createPromises = [];
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tokensDir, `tokens-${i}.json`);
        const tokenData = {
          [`group${i}`]: {
            token: {
              "$type": "color",
              "$value": `#${i.toString(16).padStart(6, '0')}`,
              "$description": `Token ${i}`
            }
          }
        };
        createPromises.push(testUtils.writeJsonFile(filePath, tokenData));
      }

      await Promise.all(createPromises);

      // Test file listing performance
      const measureListing = testUtils.measurePerformance(
        fileManager.listTokenFiles.bind(fileManager)
      );

      const { result: listResult, performance } = await measureListing(tokensDir);
      
      expect(listResult.tokenFiles).toHaveLength(fileCount);
      expect(performance.duration).toBeLessThan(1000); // 1 second max
    });

    test('should handle large individual files efficiently', async () => {
      const largeTokenData = {};
      
      // Create a single file with many tokens
      for (let i = 0; i < 5000; i++) {
        largeTokenData[`token${i}`] = {
          "$type": "color",
          "$value": `#${i.toString(16).padStart(6, '0')}`,
          "$description": `Large file token ${i} with additional metadata and longer descriptions for testing file I/O performance`
        };
      }

      const largeFilePath = path.join(tempDir, 'large-file.json');
      
      const measureWrite = testUtils.measurePerformance(
        testUtils.writeJsonFile.bind(testUtils)
      );

      const { performance: writePerf } = await measureWrite(largeFilePath, largeTokenData);
      expect(writePerf.duration).toBeLessThan(2000); // 2 seconds max

      const measureRead = testUtils.measurePerformance(
        testUtils.readJsonFile.bind(testUtils)
      );

      const { result: readResult, performance: readPerf } = await measureRead(largeFilePath);
      expect(Object.keys(readResult)).toHaveLength(5000);
      expect(readPerf.duration).toBeLessThan(1000); // 1 second max
    });
  });

  describe('Performance Regression Detection', () => {
    test('should maintain baseline performance metrics', async () => {
      const baselineMetrics = {
        splitTime: 1000, // 1 second for standard test source
        consolidateTime: 800, // 0.8 seconds
        validationTime: 500, // 0.5 seconds
        memoryUsage: 50 * 1024 * 1024 // 50MB
      };

      const source = testUtils.createTestTokenSource();
      const sourcePath = path.join(tempDir, 'baseline-source.json');
      const tokensDir = path.join(tempDir, 'baseline-tokens');
      
      await testUtils.writeJsonFile(sourcePath, source);

      // Measure split performance
      const splitStart = Date.now();
      const beforeMemory = process.memoryUsage();
      
      const splitResult = await engine.splitSourceToTokens(sourcePath, tokensDir);
      const splitTime = Date.now() - splitStart;
      
      expect(splitResult.success).toBe(true);
      expect(splitTime).toBeLessThan(baselineMetrics.splitTime * 1.5); // Allow 50% variance

      // Measure consolidate performance
      const consolidateStart = Date.now();
      const consolidatedPath = path.join(tempDir, 'baseline-consolidated.json');
      
      const consolidateResult = await engine.consolidateToSource(tokensDir, consolidatedPath);
      const consolidateTime = Date.now() - consolidateStart;
      
      expect(consolidateResult.success).toBe(true);
      expect(consolidateTime).toBeLessThan(baselineMetrics.consolidateTime * 1.5);

      // Measure validation performance
      const validationStart = Date.now();
      const validationResult = await validator.validateTokenStudioStructure(tokensDir);
      const validationTime = Date.now() - validationStart;
      
      expect(validationResult.isValid).toBe(true);
      expect(validationTime).toBeLessThan(baselineMetrics.validationTime * 1.5);

      // Check memory usage
      const afterMemory = process.memoryUsage();
      const memoryUsed = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryUsed).toBeLessThan(baselineMetrics.memoryUsage * 2); // Allow 100% variance for memory
    });
  });
});