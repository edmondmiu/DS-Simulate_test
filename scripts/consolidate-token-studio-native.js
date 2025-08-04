#!/usr/bin/env node

/**
 * Consolidate Token Studio Native Structure to tokensource.json
 * 
 * This script consolidates the new Token Studio native structure
 * into a proper tokensource.json file that matches the format.
 */

const fs = require('fs');
const path = require('path');

class TokenStudioConsolidator {
    constructor() {
        this.tokensDir = path.join(process.cwd(), 'tokens');
        this.outputPath = path.join(process.cwd(), 'tokensource.json');
    }

    async consolidate() {
        console.log('🔄 Consolidating Token Studio native structure to tokensource.json...\n');
        
        try {
            // Read metadata to get token set order
            const metadata = await this.readMetadata();
            
            // Read themes
            const themes = await this.readThemes();
            
            // Read all token sets
            const tokenSets = await this.readTokenSets(metadata.tokenSetOrder);
            
            // Create consolidated structure
            const consolidated = {
                ...tokenSets,
                $metadata: metadata,
                $themes: themes
            };
            
            // Write to tokensource.json
            await this.writeConsolidated(consolidated);
            
            console.log('✅ Consolidation complete!');
            console.log(`📁 Created: tokensource.json`);
            console.log(`📊 Token sets: ${metadata.tokenSetOrder.length}`);
            console.log(`🎨 Themes: ${themes.length}`);
            
        } catch (error) {
            console.error('❌ Consolidation failed:', error.message);
            process.exit(1);
        }
    }

    async readMetadata() {
        const metadataPath = path.join(this.tokensDir, '$metadata.json');
        const content = fs.readFileSync(metadataPath, 'utf8');
        return JSON.parse(content);
    }

    async readThemes() {
        const themesPath = path.join(this.tokensDir, '$themes.json');
        const content = fs.readFileSync(themesPath, 'utf8');
        return JSON.parse(content);
    }

    async readTokenSets(tokenSetOrder) {
        const tokenSets = {};
        
        const fileMapping = {
            'core': 'core.json',
            'global': 'global.json',
            'components': 'components.json',
            'simulate': 'simulate.json',
            'Content Typography': 'Content Typography.json'
        };
        
        for (const setName of tokenSetOrder) {
            const fileName = fileMapping[setName];
            if (fileName) {
                const filePath = path.join(this.tokensDir, fileName);
                if (fs.existsSync(filePath)) {
                    console.log(`📖 Reading ${fileName}...`);
                    const content = fs.readFileSync(filePath, 'utf8');
                    tokenSets[setName] = JSON.parse(content);
                } else {
                    console.warn(`⚠️  File not found: ${fileName}`);
                }
            }
        }
        
        return tokenSets;
    }

    async writeConsolidated(consolidated) {
        const content = JSON.stringify(consolidated, null, 2);
        fs.writeFileSync(this.outputPath, content, 'utf8');
    }
}

// Run the consolidation
if (require.main === module) {
    const consolidator = new TokenStudioConsolidator();
    consolidator.consolidate().catch(console.error);
}

module.exports = TokenStudioConsolidator;