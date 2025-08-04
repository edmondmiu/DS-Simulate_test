const StyleDictionary = require('style-dictionary');

// Custom transforms for mathematical calculations
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
          return match; // Return original if evaluation fails
        }
      });
    }
    
    // Handle simple mathematical expressions
    if (value.includes(' * ') || value.includes(' + ') || value.includes(' - ') || value.includes(' / ')) {
      try {
        // Only evaluate if it's a simple numeric expression
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

// Custom format for typography tokens in CSS
StyleDictionary.registerFormat({
  name: 'css/typography',
  formatter: function(dictionary, config) {
    const typographyTokens = dictionary.allTokens.filter(token => 
      token.type === 'typography' || 
      (typeof token.value === 'object' && token.value.fontFamily)
    );
    
    // Helper function to evaluate mathematical expressions
    function evaluateExpression(expr) {
      if (typeof expr !== 'string') return expr;
      
      // Handle roundTo() function
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
      
      // Handle simple mathematical expressions
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
        // Convert typography object to CSS shorthand
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

// Custom format for CSS custom properties with theme support
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

// Custom format for JavaScript/TypeScript tokens
StyleDictionary.registerFormat({
  name: 'javascript/es6-themed',
  formatter: function(dictionary, config) {
    const { themeName } = config;
    const exportName = themeName ? `${themeName}Tokens` : 'tokens';
    
    return `export const ${exportName} = ${JSON.stringify(dictionary.tokens, null, 2)};`;
  }
});

module.exports = {
  source: [
    'tokens/tokens.json'
  ],
  platforms: {
    // CSS Variables
    css: {
      transformGroup: 'css',
      transforms: ['attribute/cti', 'name/cti/kebab', 'time/seconds', 'content/icon', 'size/rem', 'color/css', 'math/evaluate'],
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          filter: function(token) {
            // Exclude complex objects that should go to typography file
            return !(typeof token.value === 'object' && token.value.fontFamily);
          }
        },
        {
          destination: 'typography.css',
          format: 'css/typography'
        },
        {
          destination: 'tokens-custom.css',
          format: 'css/custom-properties-themed'
        }
      ]
    },
    
    // JavaScript/TypeScript
    js: {
      transformGroup: 'js',
      transforms: ['attribute/cti', 'name/cti/camel', 'size/rem', 'color/hex', 'math/evaluate'],
      buildPath: 'dist/js/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/es6'
        },
        {
          destination: 'tokens.ts',
          format: 'typescript/es6-declarations'
        }
      ]
    },
    
    // JSON (for documentation and debugging)
    json: {
      transformGroup: 'js',
      transforms: ['attribute/cti', 'name/cti/camel', 'size/rem', 'color/hex', 'math/evaluate'],
      buildPath: 'dist/json/',
      files: [
        {
          destination: 'tokens.json',
          format: 'json/nested'
        },
        {
          destination: 'tokens-flat.json',
          format: 'json/flat'
        }
      ]
    },
    
    // SCSS Variables
    scss: {
      transformGroup: 'scss',
      transforms: ['attribute/cti', 'name/cti/kebab', 'time/seconds', 'content/icon', 'size/rem', 'color/css', 'math/evaluate'],
      buildPath: 'dist/scss/',
      files: [
        {
          destination: 'tokens.scss',
          format: 'scss/variables'
        }
      ]
    },
    
    // iOS (Swift)
    ios: {
      transformGroup: 'ios',
      transforms: ['attribute/cti', 'name/cti/pascal', 'color/UIColor', 'content/icon', 'size/remToSp', 'size/remToDp', 'math/evaluate'],
      buildPath: 'dist/ios/',
      files: [
        {
          destination: 'Tokens.swift',
          format: 'ios-swift/class.swift',
          className: 'DSTokens'
        }
      ]
    },
    
    // Android
    android: {
      transformGroup: 'android',
      transforms: ['attribute/cti', 'name/cti/snake', 'color/hex8android', 'size/remToSp', 'size/remToDp', 'math/evaluate'],
      buildPath: 'dist/android/',
      files: [
        {
          destination: 'tokens.xml',
          format: 'android/resources'
        }
      ]
    }
  }
};