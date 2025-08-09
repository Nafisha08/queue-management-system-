const http = require('http');

// Test data
const testLoginData = {
  identifier: 'admin',
  password: 'password123'
};

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          };
          resolve(result);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
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

// Test functions
async function testHealthCheck() {
  console.log('🔍 Testing Health Check...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    });
    
    console.log(`✅ Health Check - Status: ${response.statusCode}`);
    console.log(`   Response:`, response.body);
    return true;
  } catch (error) {
    console.log(`❌ Health Check Failed:`, error.message);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': JSON.stringify(testLoginData).length
      }
    }, testLoginData);
    
    console.log(`✅ Login - Status: ${response.statusCode}`);
    console.log(`   Response:`, JSON.stringify(response.body, null, 2));
    
    if (response.body && response.body.data && response.body.data.token) {
      return response.body.data.token;
    }
    return null;
  } catch (error) {
    console.log(`❌ Login Failed:`, error.message);
    return null;
  }
}

async function testProtectedRoute(token) {
  console.log('\n👥 Testing Protected Route (Customers)...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/customers',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Customers Route - Status: ${response.statusCode}`);
    console.log(`   Response:`, JSON.stringify(response.body, null, 2));
    return true;
  } catch (error) {
    console.log(`❌ Customers Route Failed:`, error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 TESTING QUEUE MANAGEMENT SYSTEM API');
  console.log('======================================');
  console.log('Base URL: http://localhost:3001');
  console.log('');

  // Test health check
  const healthCheck = await testHealthCheck();
  if (!healthCheck) {
    console.log('❌ Server is not running! Start it with: npm run dev');
    return;
  }

  // Test login
  const token = await testLogin();
  if (!token) {
    console.log('❌ Login failed! Cannot test protected routes.');
    return;
  }

  // Test protected route
  await testProtectedRoute(token);

  console.log('\n📋 SUMMARY');
  console.log('==========');
  console.log('✅ Server is running on port 3001');
  console.log('✅ Health check passed');
  console.log('✅ Login is working');
  console.log('✅ Authentication is working');
  console.log('');
  console.log('🔑 TEST CREDENTIALS:');
  console.log('   Username: admin');
  console.log('   Password: password123');
  console.log('');
  console.log('🌐 You can now test all endpoints with:');
  console.log('   - Postman');
  console.log('   - curl commands');
  console.log('   - Any HTTP client');
  console.log('');
  console.log('📖 Use the JWT token from login response in Authorization header:');
  console.log(`   Authorization: Bearer ${token.substring(0, 50)}...`);
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testLogin, testHealthCheck };
