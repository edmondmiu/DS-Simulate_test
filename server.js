const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Set CORS headers to allow Figma to access the tokens
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve tokens.json file
  if (req.url === '/tokens.json' || req.url === '/') {
    try {
      const tokensPath = path.join(__dirname, 'tokens.json');
      const tokensData = fs.readFileSync(tokensPath, 'utf8');
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(tokensData);
      
      console.log(`📤 Served tokens.json to ${req.headers['user-agent']?.substring(0, 50) || 'unknown client'}`);
    } catch (error) {
      console.error('❌ Error reading tokens.json:', error.message);
      res.writeHead(500);
      res.end('Error reading tokens file');
    }
  } else {
    // 404 for other paths
    res.writeHead(404);
    res.end('Not found - use /tokens.json');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Token server running at http://localhost:${PORT}`);
  console.log(`📋 Figma URL: http://localhost:${PORT}/tokens.json`);
  console.log(`💡 Use this URL in Figma Token Studio plugin`);
  console.log(`🛑 Press Ctrl+C to stop the server`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down token server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});