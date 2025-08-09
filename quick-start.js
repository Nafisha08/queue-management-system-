#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

console.log('🚀 QUEUE MANAGEMENT SYSTEM - QUICK START');
console.log('=========================================');

// Start the server
console.log('Starting server...');
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true,
  detached: false
});

let serverOutput = '';
let serverStarted = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  
  // Check if server has started successfully
  if (output.includes('Queue Management System started on port') && !serverStarted) {
    serverStarted = true;
    console.log('✅ Server started successfully!');
    console.log('');
    
    // Wait a moment then run tests
    setTimeout(() => {
      runTests();
    }, 2000);
  }
  
  // Show server logs
  process.stdout.write(output);
});

server.stderr.on('data', (data) => {
  process.stderr.write(data);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.kill();
  process.exit(0);
});

async function runTests() {
  console.log('\n' + '='.repeat(50));
  console.log('🔍 RUNNING QUICK TESTS');
  console.log('='.repeat(50));
  
  // Test 1: Health check
  console.log('\n1️⃣ Testing health endpoint...');
  try {
    const healthResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    });
    
    if (healthResult.statusCode === 200) {
      console.log('✅ Health check passed');
      const data = JSON.parse(healthResult.body);
      console.log(`   Status: ${data.status}`);
      console.log(`   Environment: ${data.environment}`);
    } else {
      console.log('❌ Health check failed');
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
  }
  
  // Test 2: Login test
  console.log('\n2️⃣ Testing login...');
  try {
    const loginResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      identifier: 'admin',
      password: 'password123'
    });
    
    if (loginResult.statusCode === 200) {
      const data = JSON.parse(loginResult.body);
      if (data.success && data.data && data.data.token) {
        console.log('✅ Login successful');
        console.log(`   User: ${data.data.user.firstName} ${data.data.user.lastName}`);
        console.log(`   Role: ${data.data.user.role}`);
        console.log(`   Token: ${data.data.token.substring(0, 30)}...`);
        
        // Test 3: Protected endpoint
        console.log('\n3️⃣ Testing protected endpoint...');
        try {
          const customersResult = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/v1/customers',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${data.data.token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (customersResult.statusCode === 200) {
            console.log('✅ Protected endpoint accessible');
            const custData = JSON.parse(customersResult.body);
            console.log(`   Customers found: ${custData.results || 0}`);
          } else {
            console.log('❌ Protected endpoint failed');
          }
        } catch (error) {
          console.log('❌ Protected endpoint error:', error.message);
        }
        
      } else {
        console.log('❌ Login failed - invalid response');
      }
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
  }
  
  // Display summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 TESTS COMPLETED');
  console.log('='.repeat(50));
  console.log('\n📋 Your Queue Management System is running!');
  console.log('\n🔐 Test Credentials:');
  console.log('   Username: admin (or superadmin, subadmin, user)');
  console.log('   Password: password123');
  console.log('\n🌐 API Base URL: http://localhost:3001/api/v1');
  console.log('\n🛠️ Next Steps:');
  console.log('   • Use Postman to test all endpoints');
  console.log('   • Try the login endpoint with different users');
  console.log('   • Create customers, generate tokens, process payments');
  console.log('   • Explore all 113+ available endpoints');
  console.log('\n✨ Press Ctrl+C to stop the server when done testing');
}

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

// Display initial info
console.log('\n💡 This will:');
console.log('   1. Start your server on port 3001');
console.log('   2. Run quick functionality tests');
console.log('   3. Show you how to use the system');
console.log('\nStarting in 3 seconds... (Press Ctrl+C to cancel)');

setTimeout(() => {
  console.log('\n' + '='.repeat(50));
}, 3000);
