const baseConfig = require('./style-dictionary.config.js');
const path = require('path');

// Helper function to create theme-specific configuration
function createThemeConfig(themeName) {
  const config = JSON.parse(JSON.stringify(baseConfig)); // Deep clone
  
  // Update source to include theme-specific tokens
  config.source = [
    'tokens/tokens.json',
    `tokens/${themeName}.json`
  ];
  
  // Update build paths to include theme name
  Object.keys(config.platforms).forEach(platform => {
    const originalBuildPath = config.platforms[platform].buildPath;
    config.platforms[platform].buildPath = `${originalBuildPath}${themeName}/`;
    
    // Update file destinations to include theme name
    config.platforms[platform].files.forEach(file => {
      const ext = path.extname(file.destination);
      const name = path.basename(file.destination, ext);
      file.destination = `${name}-${themeName}${ext}`;
    });
  });
  
  return config;
}

// Export theme configurations
module.exports = {
  createThemeConfig,
  themes: ['logifuture', 'bet9ja']
};