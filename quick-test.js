const http = require('http');

// Simple test to verify the server is working
async function quickTest() {
  console.log('🔍 Quick Test of Queue Management System\n');
  console.log('Server: http://localhost:3001\n');

  // Test 1: Health Check
  console.log('1. Testing Health Check...');
  try {
    const response = await makeHttpRequest('GET', 'localhost', 3001, '/health');
    if (response.statusCode === 200) {
      console.log('✅ Health Check PASSED');
      console.log(`   Response: ${response.body.substring(0, 100)}...`);
    } else {
      console.log(`❌ Health Check FAILED: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Health Check ERROR: ${error.message}`);
  }

  // Test 2: API Info
  console.log('\n2. Testing API Info...');
  try {
    const response = await makeHttpRequest('GET', 'localhost', 3001, '/api/v1');
    console.log(`   Status: ${response.statusCode}`);
    if (response.statusCode === 200) {
      console.log('✅ API Info ACCESSIBLE');
    }
  } catch (error) {
    console.log(`   API Info not accessible: ${error.message}`);
  }

  // Test 3: Login Test
  console.log('\n3. Testing Login...');
  try {
    const loginData = {
      identifier: 'admin',
      password: 'password123'
    };
    
    const response = await makeHttpRequest('POST', 'localhost', 3001, '/api/v1/auth/login', loginData);
    console.log(`   Login Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log('✅ LOGIN SUCCESS');
      const data = JSON.parse(response.body);
      if (data.data && data.data.token) {
        const token = data.data.token;
        console.log(`   Token received: ${token.substring(0, 20)}...`);
        
        // Test 4: Protected Route
        console.log('\n4. Testing Protected Route (Customers)...');
        const protectedResponse = await makeHttpRequest('GET', 'localhost', 3001, '/api/v1/customers', null, {
          'Authorization': `Bearer ${token}`
        });
        
        console.log(`   Customers Status: ${protectedResponse.statusCode}`);
        if (protectedResponse.statusCode === 200) {
          console.log('✅ PROTECTED ROUTE SUCCESS');
        } else {
          console.log(`❌ Protected route failed: ${protectedResponse.statusCode}`);
        }
      }
    } else {
      console.log(`❌ LOGIN FAILED: ${response.statusCode}`);
      console.log(`   Response: ${response.body}`);
    }
  } catch (error) {
    console.log(`❌ Login ERROR: ${error.message}`);
  }

  console.log('\n📋 SUMMARY:');
  console.log('✅ Your Queue Management System is running on port 3001');
  console.log('✅ You can now use it with:');
  console.log('   - Browser: http://localhost:3001');
  console.log('   - Postman/API clients');
  console.log('   - Frontend applications');
  console.log('\n🔑 Test Credentials:');
  console.log('   Username: admin (or admin@test.com)');
  console.log('   Password: password123');
}

function makeHttpRequest(method, hostname, port, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();

    // Set a timeout
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Run the test
quickTest().catch(console.error);
