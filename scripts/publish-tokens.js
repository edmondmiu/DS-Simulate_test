/**
 * Publish tokens to DS-Simulate-Consume repository for Figma consumption
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function publishTokens() {
  try {
    console.log('📦 Publishing tokens to consumption repository...');
    
    // Check if tokens.json exists
    if (!fs.existsSync('tokens.json')) {
      console.error('❌ tokens.json not found. Run "npm run transform" first.');
      process.exit(1);
    }
    
    // Create a temporary directory for the consumption repo
    const tempDir = path.join(__dirname, 'temp-consume');
    
    // Clean up any existing temp directory
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
    
    // Clone the consumption repository
    console.log('🔄 Cloning consumption repository...');
    execSync(`git clone https://github.com/edmondmiu/DS-Simulate-Consume.git ${tempDir}`);
    
    // Read current tokens.json
    const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
    
    // Add publication metadata
    const publishedTokens = {
      ...tokens,
      meta: {
        ...tokens.meta,
        publishedAt: new Date().toISOString(),
        publishedFrom: 'DS-Simulate private repository',
        figmaUrl: 'https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json',
        version: tokens.meta.version || '1.0.0'
      }
    };
    
    // Write tokens to consumption repo
    fs.writeFileSync(
      path.join(tempDir, 'tokens.json'), 
      JSON.stringify(publishedTokens, null, 2)
    );
    
    // Create a README for the consumption repo
    const readme = `# DS-Simulate Token Consumption

This repository contains the public tokens for Figma consumption.

## Figma Token URL
\`\`\`
https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json
\`\`\`

## Usage in Figma
1. Install the Figma Tokens plugin
2. Go to Settings → Add new token set
3. Use the URL above as the token source
4. Import the tokens

## Token Structure
- **Core tokens**: Foundation color ramps, spacing, typography
- **Theme tokens**: Dark and light theme variations
- **Semantic tokens**: Usage-based token assignments

## Last Updated
${new Date().toISOString()}

## Version
${tokens.meta.version || '1.0.0'}

---
*Generated automatically from DS-Simulate private repository*
`;
    
    fs.writeFileSync(path.join(tempDir, 'README.md'), readme);
    
    // Create an index.html for GitHub Pages
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DS-Simulate Design Tokens</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .token-url { background: #f6f8fa; padding: 16px; border-radius: 8px; font-family: monospace; }
        .copy-btn { background: #0366d6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        .copy-btn:hover { background: #0256cc; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #f6f8fa; padding: 16px; border-radius: 8px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 DS-Simulate Design Tokens</h1>
        <p>Public design tokens for Figma consumption</p>
        
        <h2>Figma Token URL</h2>
        <div class="token-url">
            <code id="token-url">https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json</code>
            <button class="copy-btn" onclick="copyToClipboard()">Copy URL</button>
        </div>
        
        <div class="stats">
            <div class="stat">
                <h3>${Object.keys(publishedTokens.tokens).length}</h3>
                <p>Token Categories</p>
            </div>
            <div class="stat">
                <h3>${Object.keys(publishedTokens.themes).length}</h3>
                <p>Themes</p>
            </div>
            <div class="stat">
                <h3>${publishedTokens.meta.version}</h3>
                <p>Version</p>
            </div>
        </div>
        
        <h2>How to Use</h2>
        <ol>
            <li>Install the <strong>Figma Tokens</strong> plugin</li>
            <li>Go to Settings → Add new token set</li>
            <li>Use the URL above as the token source</li>
            <li>Import the tokens</li>
        </ol>
        
        <h2>Token Structure</h2>
        <ul>
            <li><strong>Core tokens</strong>: Foundation color ramps, spacing, typography</li>
            <li><strong>Theme tokens</strong>: Dark and light theme variations</li>
            <li><strong>Semantic tokens</strong>: Usage-based token assignments</li>
        </ul>
        
        <p><small>Last updated: ${new Date().toISOString()}</small></p>
    </div>
    
    <script>
        function copyToClipboard() {
            const url = document.getElementById('token-url').textContent;
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.querySelector('.copy-btn');
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy URL', 2000);
            });
        }
    </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(tempDir, 'index.html'), indexHtml);
    
    // Commit and push to consumption repo
    console.log('📝 Committing changes to consumption repository...');
    process.chdir(tempDir);
    
    execSync('git add .');
    execSync(`git commit -m "Update tokens - ${new Date().toISOString()}

🤖 Auto-generated from DS-Simulate private repository
📦 Version: ${tokens.meta.version || '1.0.0'}
🎨 Token categories: ${Object.keys(publishedTokens.tokens).length}
🌙 Themes: ${Object.keys(publishedTokens.themes).length}
"`);
    
    execSync('git push origin main');
    
    // Clean up
    process.chdir(__dirname);
    execSync(`rm -rf ${tempDir}`);
    
    console.log('✅ Tokens published successfully!');
    console.log('🔗 Figma URL: https://raw.githubusercontent.com/edmondmiu/DS-Simulate-Consume/main/tokens.json');
    console.log('📄 GitHub Pages: https://edmondmiu.github.io/DS-Simulate-Consume/');
    
  } catch (error) {
    console.error('❌ Error publishing tokens:', error.message);
    process.exit(1);
  }
}

// Run the publication
if (require.main === module) {
  publishTokens();
}

module.exports = { publishTokens };