const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3000;

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);
    
    if (req.url === '/') {
        // Serve the index.html file
        const indexPath = path.join(__dirname, 'public', 'index.html');
        
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                <head><title>Queue Management System - Test</title></head>
                <body>
                    <h1>🎉 Server is Working!</h1>
                    <p>Your Node.js server is running successfully.</p>
                    <p>Server Time: ${new Date().toISOString()}</p>
                    <p>If you can see this page, your server setup is working correctly.</p>
                </body>
                </html>
            `);
        }
    } else if (req.url === '/test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            message: 'Test endpoint working',
            timestamp: new Date().toISOString(),
            port: PORT
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Page Not Found</h1>');
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('🚀 TEST SERVER STARTED SUCCESSFULLY!');
    console.log('================================');
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    console.log('📝 Test endpoints:');
    console.log(`   • Main page: http://localhost:${PORT}/`);
    console.log(`   • Test API: http://localhost:${PORT}/test`);
    console.log('');
    console.log('✅ If you see this message, Node.js is working!');
    console.log('🌐 Now open your browser and go to: http://localhost:3000');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('================================');
});

server.on('error', (err) => {
    console.error('❌ Server Error:', err.message);
    
    if (err.code === 'EADDRINUSE') {
        console.log(`\n💡 Port ${PORT} is already in use. Try:`);
        console.log('   1. Close other applications using port 3000');
        console.log('   2. Or change the port number in this file');
    }
    
    if (err.code === 'EACCES') {
        console.log(`\n💡 Permission denied. Try:`);
        console.log('   1. Run as administrator');
        console.log('   2. Or use a port number above 1024');
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📡 Shutting down server...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n📡 Shutting down server...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});
