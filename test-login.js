const http = require('http');

const loginData = {
  identifier: 'admin',
  password: 'password123'
};

const postData = JSON.stringify(loginData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔐 Testing Login to Queue Management System');
console.log('============================================');
console.log('Attempting to login with:');
console.log('Username: admin');
console.log('Password: password123');
console.log('URL: http://localhost:3001/api/v1/auth/login');
console.log('');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Login Response:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.success && response.data && response.data.token) {
        console.log('');
        console.log('🎉 LOGIN SUCCESSFUL!');
        console.log('');
        console.log('🔑 JWT Token:');
        console.log(response.data.token);
        console.log('');
        console.log('👤 User Info:');
        console.log(`Name: ${response.data.user.firstName} ${response.data.user.lastName}`);
        console.log(`Role: ${response.data.user.role}`);
        console.log(`Email: ${response.data.user.email}`);
        console.log('');
        console.log('✨ You can now use this token for API requests!');
        console.log('Add this header to your requests:');
        console.log(`Authorization: Bearer ${response.data.token}`);
      } else {
        console.log('❌ Login failed!');
      }
    } catch (error) {
      console.log('Raw response:', data);
      console.log('Parse error:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request failed:');
  console.log('Error:', error.message);
  console.log('');
  console.log('💡 Make sure the server is running with: npm run dev');
});

req.write(postData);
req.end();
