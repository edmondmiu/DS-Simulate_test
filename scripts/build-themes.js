const StyleDictionary = require('style-dictionary');
const { createThemeConfig, themes } = require('../style-dictionary.theme.config.js');
const fs = require('fs');
const path = require('path');

// Register custom transforms and formats (copied from main config)
StyleDictionary.registerTransform({
  name: 'math/evaluate',
  type: 'value',
  matcher: function(token) {
    return typeof token.value === 'string' && 
           (token.value.includes('roundTo(') || 
            token.value.includes(' * ') || 
            token.value.includes(' + ') || 
            token.value.includes(' - ') || 
            token.value.includes(' / '));
  },
  transformer: function(token) {
    let value = token.value;
    
    // Handle roundTo() function
    if (value.includes('roundTo(')) {
      value = value.replace(/roundTo\(([^,]+),\s*(\d+)\)/g, (match, expression, decimals) => {
        try {
          const result = eval(expression);
          return Number(result.toFixed(parseInt(decimals)));
        } catch (e) {
          return match;
        }
      });
    }
    
    // Handle simple mathematical expressions
    if (value.includes(' * ') || value.includes(' + ') || value.includes(' - ') || value.includes(' / ')) {
      try {
        if (/^[\d\s\+\-\*\/\(\)]+$/.test(value)) {
          return eval(value);
        }
      } catch (e) {
        // Return original value if evaluation fails
      }
    }
    
    return value;
  }
});

StyleDictionary.registerFormat({
  name: 'css/typography',
  formatter: function(dictionary, config) {
    const typographyTokens = dictionary.allTokens.filter(token => 
      token.type === 'typography' || 
      (typeof token.value === 'object' && token.value.fontFamily)
    );
    
    function evaluateExpression(expr) {
      if (typeof expr !== 'string') return expr;
      
      if (expr.includes('roundTo(')) {
        expr = expr.replace(/roundTo\(([^,]+),\s*(\d+)\)/g, (match, expression, decimals) => {
          try {
            const result = eval(expression);
            return Number(result.toFixed(parseInt(decimals)));
          } catch (e) {
            return match;
          }
        });
      }
      
      if (expr.includes(' * ') || expr.includes(' + ') || expr.includes(' - ') || expr.includes(' / ')) {
        try {
          if (/^[\d\s\+\-\*\/\(\)]+$/.test(expr)) {
            return eval(expr);
          }
        } catch (e) {
          // Return original if evaluation fails
        }
      }
      
      return expr;
    }
    
    return typographyTokens.map(token => {
      const value = token.value;
      if (typeof value === 'object' && value.fontFamily) {
        const fontSize = evaluateExpression(value.fontSize) || '16';
        const lineHeight = value.lineHeight && value.lineHeight !== 'AUTO' ? value.lineHeight : '1.5';
        const fontWeight = value.fontWeight || 'normal';
        const fontFamily = value.fontFamily || 'inherit';
        
        return `  --${token.name}: ${fontWeight} ${fontSize}px/${lineHeight} ${fontFamily};`;
      }
      return `  --${token.name}: ${value};`;
    }).join('\n');
  }
});

StyleDictionary.registerFormat({
  name: 'css/custom-properties-themed',
  formatter: function(dictionary, config) {
    const { themeName } = config;
    const selector = themeName ? `[data-theme="${themeName}"]` : ':root';
    
    return `${selector} {\n${dictionary.allTokens.map(token => 
      `  --${token.name}: ${token.value};`
    ).join('\n')}\n}\n`;
  }
});

StyleDictionary.registerFormat({
  name: 'javascript/es6-themed',
  formatter: function(dictionary, config) {
    const { themeName } = config;
    const exportName = themeName ? `${themeName}Tokens` : 'tokens';
    
    return `export const ${exportName} = ${JSON.stringify(dictionary.tokens, null, 2)};`;
  }
});

console.log('🎨 Building theme-specific tokens...\n');

// Build tokens for each theme
themes.forEach(themeName => {
  console.log(`📦 Building tokens for ${themeName} theme...`);
  
  const config = createThemeConfig(themeName);
  const SD = StyleDictionary.extend(config);
  
  // Create theme-specific directories
  Object.keys(config.platforms).forEach(platform => {
    const buildPath = config.platforms[platform].buildPath;
    fs.mkdirSync(buildPath, { recursive: true });
  });
  
  // Build the tokens
  SD.buildAllPlatforms();
  
  console.log(`✅ ${themeName} theme tokens built successfully!\n`);
});

console.log('🎉 All theme tokens built successfully!');