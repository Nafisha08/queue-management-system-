#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

// Display welcome message
console.log('🚀 QUEUE MANAGEMENT SYSTEM');
console.log('===========================');
console.log('Starting development server...');
console.log('');

// Start the server
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  process.stdout.write(data);
});

server.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Wait for server to start and then show credentials
setTimeout(async () => {
  console.log('\n' + '='.repeat(50));
  console.log('🔐 TEST USER CREDENTIALS');
  console.log('='.repeat(50));
  console.log('📧 Login with: username or email');
  console.log('🔑 Password for all accounts: password123');
  console.log('');
  
  console.log('👑 Super Admin:');
  console.log('  Username: superadmin');
  console.log('  Email: superadmin@test.com');
  console.log('  Role: super_admin');
  console.log('');
  
  console.log('👨‍💼 Admin:');
  console.log('  Username: admin');
  console.log('  Email: admin@test.com');
  console.log('  Role: admin');
  console.log('');
  
  console.log('👥 Sub Admin:');
  console.log('  Username: subadmin');
  console.log('  Email: subadmin@test.com');
  console.log('  Role: sub_admin');
  console.log('');
  
  console.log('👤 Regular User:');
  console.log('  Username: user');
  console.log('  Email: user@test.com');
  console.log('  Role: user');
  console.log('');

  console.log('🌐 API ENDPOINTS');
  console.log('='.repeat(50));
  console.log('Base URL: http://localhost:3001/api/v1');
  console.log('');
  
  console.log('🔑 Authentication:');
  console.log('  POST /auth/login - Login');
  console.log('  GET /auth/me - Get current user');
  console.log('');
  
  console.log('👥 Key Endpoints:');
  console.log('  GET /customers - List customers');
  console.log('  POST /tokens - Generate tokens');
  console.log('  GET /payments - List payments');
  console.log('  GET /departments - List departments');
  console.log('  GET /counters - List counters');
  console.log('');

  console.log('📋 QUICK TEST WITH CURL');
  console.log('='.repeat(50));
  console.log('1. Login:');
  console.log('curl -X POST http://localhost:3001/api/v1/auth/login \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"identifier": "admin", "password": "password123"}\'');
  console.log('');
  console.log('2. Use the token from login response in subsequent requests:');
  console.log('curl -X GET http://localhost:3001/api/v1/customers \\');
  console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN"');
  console.log('');

  console.log('💡 TESTING OPTIONS');
  console.log('='.repeat(50));
  console.log('• Use Postman with the endpoints above');
  console.log('• Use curl commands shown above');
  console.log('• Use any HTTP client (Insomnia, Thunder Client, etc.)');
  console.log('• Test with our built-in test script: node test-api.js');
  console.log('');
  
  console.log('✨ Server is ready for testing!');
  console.log('Press Ctrl+C to stop the server');
  console.log('='.repeat(50));

  // Test if server is responding
  try {
    const testReq = http.get('http://localhost:3001/health', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Server is responding correctly!');
      }
    });
    testReq.on('error', () => {
      console.log('⏳ Server is starting... please wait a moment');
    });
  } catch (error) {
    console.log('⏳ Server is starting... please wait a moment');
  }
}, 3000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.kill();
  process.exit(0);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});
