#!/usr/bin/env node

/**
 * Refactor Token Structure to Token Studio Native Format
 * 
 * This script consolidates the current fragmented token structure (100+ files)
 * into Token Studio's native 5-file structure based on the tokenstudio_import reference.
 */

const fs = require('fs');
const path = require('path');

class TokenStudioRefactor {
    constructor() {
        this.tokensDir = path.join(process.cwd(), 'tokens');
        this.referenceDir = path.join(process.cwd(), 'tokenstudio_import');
        this.backupDir = path.join(process.cwd(), 'tokens_backup_before_refactor');
        
        // Token Studio native structure
        this.targetStructure = {
            'core.json': 'Foundation tokens (Color Ramp, primitives)',
            'global.json': 'Semantic tokens (typography, spacing, surface, content, primary, secondary)',
            'simulate.json': 'Brand-specific tokens and overrides',
            'components.json': 'Component-specific tokens',
            'Content Typography.json': 'Content-specific typography tokens'
        };
    }

    async refactor() {
        console.log('🔄 Starting Token Studio Native Format Refactoring...\n');
        
        try {
            // Step 1: Validate reference structure exists
            await this.validateReferenceStructure();
            
            // Step 2: Create backup if it doesn't exist
            await this.ensureBackup();
            
            // Step 3: Copy reference files to tokens directory
            await this.copyReferenceFiles();
            
            // Step 4: Update metadata and themes
            await this.updateMetadataAndThemes();
            
            // Step 5: Clean up fragmented files
            await this.cleanupFragmentedFiles();
            
            // Step 6: Validate new structure
            await this.validateNewStructure();
            
            console.log('✅ Token Studio Native Format Refactoring Complete!\n');
            console.log('📁 New structure:');
            console.log('  tokens/');
            console.log('  ├── $metadata.json (5 token sets)');
            console.log('  ├── $themes.json (proper theme configuration)');
            console.log('  ├── core.json (Color Ramp, primitives)');
            console.log('  ├── global.json (semantic tokens)');
            console.log('  ├── simulate.json (brand overrides)');
            console.log('  ├── components.json (component tokens)');
            console.log('  └── Content Typography.json (content typography)');
            
        } catch (error) {
            console.error('❌ Refactoring failed:', error.message);
            process.exit(1);
        }
    }

    async validateReferenceStructure() {
        console.log('🔍 Validating reference structure...');
        
        if (!fs.existsSync(this.referenceDir)) {
            throw new Error(`Reference directory not found: ${this.referenceDir}`);
        }
        
        const requiredFiles = [
            '$metadata.json',
            '$themes.json',
            'core.json',
            'global.json',
            'simulate.json',
            'components.json',
            'Content Typography.json'
        ];
        
        for (const file of requiredFiles) {
            const filePath = path.join(this.referenceDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Required reference file not found: ${file}`);
            }
        }
        
        console.log('✅ Reference structure validated');
    }

    async ensureBackup() {
        if (!fs.existsSync(this.backupDir)) {
            console.log('📦 Creating backup of current structure...');
            fs.cpSync(this.tokensDir, this.backupDir, { recursive: true });
            console.log('✅ Backup created');
        } else {
            console.log('📦 Backup already exists, skipping...');
        }
    }

    async copyReferenceFiles() {
        console.log('📋 Copying Token Studio native files...');
        
        const filesToCopy = [
            'core.json',
            'global.json',
            'simulate.json',
            'components.json',
            'Content Typography.json'
        ];
        
        for (const file of filesToCopy) {
            const sourcePath = path.join(this.referenceDir, file);
            const targetPath = path.join(this.tokensDir, file);
            
            console.log(`  Copying ${file}...`);
            fs.copyFileSync(sourcePath, targetPath);
        }
        
        console.log('✅ Token Studio native files copied');
    }

    async updateMetadataAndThemes() {
        console.log('🔧 Updating metadata and themes...');
        
        // Copy reference metadata
        const metadataSource = path.join(this.referenceDir, '$metadata.json');
        const metadataTarget = path.join(this.tokensDir, '$metadata.json');
        fs.copyFileSync(metadataSource, metadataTarget);
        console.log('  ✅ $metadata.json updated with proper token set order');
        
        // Copy reference themes
        const themesSource = path.join(this.referenceDir, '$themes.json');
        const themesTarget = path.join(this.tokensDir, '$themes.json');
        fs.copyFileSync(themesSource, themesTarget);
        console.log('  ✅ $themes.json updated with proper theme configuration');
    }

    async cleanupFragmentedFiles() {
        console.log('🧹 Cleaning up fragmented token files...');
        
        const filesToKeep = new Set([
            '$metadata.json',
            '$themes.json',
            'core.json',
            'global.json',
            'simulate.json',
            'components.json',
            'Content Typography.json'
        ]);
        
        const files = fs.readdirSync(this.tokensDir);
        let removedCount = 0;
        
        for (const file of files) {
            if (!filesToKeep.has(file) && file.endsWith('.json')) {
                const filePath = path.join(this.tokensDir, file);
                fs.unlinkSync(filePath);
                removedCount++;
            }
        }
        
        console.log(`  ✅ Removed ${removedCount} fragmented token files`);
    }

    async validateNewStructure() {
        console.log('🔍 Validating new Token Studio structure...');
        
        // Check metadata
        const metadataPath = path.join(this.tokensDir, '$metadata.json');
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        const expectedOrder = ["core", "global", "components", "simulate", "Content Typography"];
        if (JSON.stringify(metadata.tokenSetOrder) !== JSON.stringify(expectedOrder)) {
            throw new Error('Metadata token set order does not match expected Token Studio format');
        }
        
        // Check themes
        const themesPath = path.join(this.tokensDir, '$themes.json');
        const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));
        
        if (!Array.isArray(themes) || themes.length === 0) {
            throw new Error('Themes file is not in proper format');
        }
        
        // Check all required files exist
        const requiredFiles = [
            'core.json',
            'global.json',
            'simulate.json',
            'components.json',
            'Content Typography.json'
        ];
        
        for (const file of requiredFiles) {
            const filePath = path.join(this.tokensDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Required file missing: ${file}`);
            }
            
            // Validate JSON structure
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (typeof content !== 'object' || content === null) {
                    throw new Error(`Invalid JSON structure in ${file}`);
                }
            } catch (error) {
                throw new Error(`Invalid JSON in ${file}: ${error.message}`);
            }
        }
        
        console.log('✅ New Token Studio structure validated');
        
        // Report structure summary
        console.log('\n📊 Structure Summary:');
        console.log(`  Token Sets: ${metadata.tokenSetOrder.length}`);
        console.log(`  Themes: ${themes.length}`);
        
        for (const file of requiredFiles) {
            const filePath = path.join(this.tokensDir, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const tokenCount = this.countTokens(content);
            console.log(`  ${file}: ${tokenCount} tokens`);
        }
    }

    countTokens(obj, count = 0) {
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object') {
                if (obj[key].$type && obj[key].$value) {
                    count++;
                } else {
                    count = this.countTokens(obj[key], count);
                }
            }
        }
        return count;
    }
}

// Run the refactoring
if (require.main === module) {
    const refactor = new TokenStudioRefactor();
    refactor.refactor().catch(console.error);
}

module.exports = TokenStudioRefactor;