#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(colors.bold + colors.cyan, `📋 ${title}`);
  console.log('='.repeat(60));
}

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const icon = exists ? '✅' : '❌';
  const color = exists ? colors.green : colors.red;
  log(color, `${icon} ${description}: ${filePath}`);
  return exists;
}

function checkProjectStructure() {
  section('PROJECT STRUCTURE CHECK');
  
  const requiredFiles = [
    ['package.json', 'Package configuration'],
    ['.env', 'Environment variables'],
    ['src/index.js', 'Main application file'],
    ['src/models/User.js', 'User model'],
    ['src/models/Customer.js', 'Customer model'],
    ['src/models/Payment.js', 'Payment model'],
    ['src/models/Token.js', 'Token model'],
    ['src/models/Department.js', 'Department model'],
    ['src/models/Counter.js', 'Counter model'],
    ['src/routes/authRoutes.js', 'Authentication routes'],
    ['src/routes/customerRoutes.js', 'Customer routes'],
    ['src/routes/paymentRoutes.js', 'Payment routes'],
    ['src/routes/tokenRoutes.js', 'Token routes'],
    ['src/controllers/customerController.js', 'Customer controller'],
    ['src/controllers/paymentController.js', 'Payment controller'],
    ['src/controllers/tokenController.js', 'Token controller'],
    ['src/middleware/auth.js', 'Authentication middleware'],
    ['src/middleware/validation.js', 'Validation middleware'],
    ['src/utils/AppError.js', 'Error utility'],
    ['src/utils/catchAsync.js', 'Async error handler'],
    ['src/utils/APIFeatures.js', 'API query utility']
  ];

  let allFilesExist = true;
  requiredFiles.forEach(([file, desc]) => {
    if (!checkFile(file, desc)) {
      allFilesExist = false;
    }
  });

  return allFilesExist;
}

function checkPackageJson() {
  section('PACKAGE.JSON ANALYSIS');
  
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    log(colors.green, `✅ Project Name: ${pkg.name}`);
    log(colors.green, `✅ Version: ${pkg.version}`);
    log(colors.green, `✅ Description: ${pkg.description || 'No description'}`);
    
    console.log('\n📦 Dependencies:');
    Object.entries(pkg.dependencies || {}).forEach(([name, version]) => {
      console.log(`   ${name}: ${version}`);
    });
    
    console.log('\n🔧 Scripts:');
    Object.entries(pkg.scripts || {}).forEach(([name, command]) => {
      console.log(`   ${name}: ${command}`);
    });
    
    return true;
  } catch (error) {
    log(colors.red, '❌ Error reading package.json: ' + error.message);
    return false;
  }
}

function checkEnvironmentConfig() {
  section('ENVIRONMENT CONFIGURATION');
  
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const envLines = envContent.split('\n').filter(line => 
      line.trim() && !line.startsWith('#')
    );
    
    const envVars = {};
    envLines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=');
      }
    });
    
    const requiredEnvVars = [
      'PORT',
      'NODE_ENV',
      'MONGODB_URI',
      'JWT_SECRET',
      'USE_MOCK_DB'
    ];
    
    let allConfigured = true;
    requiredEnvVars.forEach(varName => {
      if (envVars[varName]) {
        log(colors.green, `✅ ${varName}: ${varName === 'JWT_SECRET' ? '[HIDDEN]' : envVars[varName]}`);
      } else {
        log(colors.red, `❌ Missing: ${varName}`);
        allConfigured = false;
      }
    });
    
    // Check database configuration
    console.log('\n🗄️ Database Configuration:');
    if (envVars.USE_MOCK_DB === 'true') {
      log(colors.yellow, '⚠️  Using MOCK database (data will not persist)');
    } else {
      log(colors.green, '✅ Using real MongoDB database');
    }
    
    return allConfigured;
  } catch (error) {
    log(colors.red, '❌ Error reading .env file: ' + error.message);
    return false;
  }
}

function checkServerStatus(callback) {
  section('SERVER STATUS CHECK');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        log(colors.green, '✅ Server is running and responding');
        console.log(`   Status: ${response.status}`);
        console.log(`   Port: ${response.port || 3001}`);
        console.log(`   Environment: ${response.environment}`);
        console.log(`   Uptime: ${response.uptime} seconds`);
        callback(true);
      } catch (error) {
        log(colors.red, '❌ Server responded but with invalid JSON');
        callback(false);
      }
    });
  });
  
  req.on('error', () => {
    log(colors.red, '❌ Server is not running');
    log(colors.yellow, '💡 Start the server with: npm run dev');
    callback(false);
  });
  
  req.on('timeout', () => {
    log(colors.red, '❌ Server request timed out');
    callback(false);
  });
  
  req.end();
}

async function testLogin() {
  return new Promise((resolve) => {
    section('LOGIN TEST');
    
    const loginData = JSON.stringify({
      identifier: 'admin',
      password: 'password123'
    });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      },
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.data && response.data.token) {
            log(colors.green, '✅ Login successful');
            console.log(`   User: ${response.data.user.firstName} ${response.data.user.lastName}`);
            console.log(`   Role: ${response.data.user.role}`);
            console.log(`   Token: ${response.data.token.substring(0, 50)}...`);
            resolve({ success: true, token: response.data.token });
          } else {
            log(colors.red, '❌ Login failed');
            console.log('   Response:', response);
            resolve({ success: false });
          }
        } catch (error) {
          log(colors.red, '❌ Login request failed - Invalid response');
          resolve({ success: false });
        }
      });
    });
    
    req.on('error', () => {
      log(colors.red, '❌ Login request failed - Connection error');
      resolve({ success: false });
    });
    
    req.on('timeout', () => {
      log(colors.red, '❌ Login request timed out');
      resolve({ success: false });
    });
    
    req.write(loginData);
    req.end();
  });
}

async function testProtectedEndpoint(token) {
  return new Promise((resolve) => {
    section('PROTECTED ENDPOINT TEST');
    
    if (!token) {
      log(colors.red, '❌ No token available for testing');
      resolve(false);
      return;
    }
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/customers',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 && response.success !== false) {
            log(colors.green, '✅ Protected endpoint accessible');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Customers returned: ${response.results || 0}`);
            resolve(true);
          } else {
            log(colors.red, `❌ Protected endpoint failed (${res.statusCode})`);
            resolve(false);
          }
        } catch (error) {
          log(colors.red, '❌ Protected endpoint response parsing failed');
          resolve(false);
        }
      });
    });
    
    req.on('error', () => {
      log(colors.red, '❌ Protected endpoint request failed');
      resolve(false);
    });
    
    req.on('timeout', () => {
      log(colors.red, '❌ Protected endpoint request timed out');
      resolve(false);
    });
    
    req.end();
  });
}

function displayUsage() {
  section('HOW TO USE YOUR QUEUE MANAGEMENT SYSTEM');
  
  console.log('\n🚀 Start the server:');
  console.log('   npm run dev');
  
  console.log('\n🔐 Test login:');
  console.log('   node test-login.js');
  
  console.log('\n📋 Available test accounts:');
  const accounts = [
    ['superadmin', 'superadmin@test.com', 'super_admin'],
    ['admin', 'admin@test.com', 'admin'],
    ['subadmin', 'subadmin@test.com', 'sub_admin'],
    ['user', 'user@test.com', 'user']
  ];
  
  accounts.forEach(([username, email, role]) => {
    console.log(`   Username: ${username} | Email: ${email} | Role: ${role}`);
  });
  console.log('   Password for all: password123');
  
  console.log('\n🌐 API Base URL:');
  console.log('   http://localhost:3001/api/v1');
  
  console.log('\n📊 Key endpoints to test:');
  console.log('   POST /auth/login - Login');
  console.log('   GET  /customers - List customers');
  console.log('   POST /tokens - Generate tokens');
  console.log('   GET  /payments - List payments');
  console.log('   GET  /departments - List departments');
  console.log('   GET  /counters - List counters');
  
  console.log('\n🛠️ Testing tools:');
  console.log('   • Postman (recommended)');
  console.log('   • Thunder Client (VS Code extension)');
  console.log('   • Insomnia');
  console.log('   • curl commands');
  console.log('   • Browser (for GET endpoints)');
}

function displaySummary(results) {
  section('PROJECT CHECK SUMMARY');
  
  const { structure, packageJson, env, server, login, protected } = results;
  
  console.log('\n📊 Results:');
  log(structure ? colors.green : colors.red, `${structure ? '✅' : '❌'} Project structure`);
  log(packageJson ? colors.green : colors.red, `${packageJson ? '✅' : '❌'} Package configuration`);
  log(env ? colors.green : colors.red, `${env ? '✅' : '❌'} Environment setup`);
  log(server ? colors.green : colors.red, `${server ? '✅' : '❌'} Server status`);
  log(login ? colors.green : colors.red, `${login ? '✅' : '❌'} Authentication`);
  log(protected ? colors.green : colors.red, `${protected ? '✅' : '❌'} Protected endpoints`);
  
  const totalTests = 6;
  const passedTests = [structure, packageJson, env, server, login, protected].filter(Boolean).length;
  
  console.log(`\n📈 Overall Status: ${passedTests}/${totalTests} checks passed`);
  
  if (passedTests === totalTests) {
    log(colors.green + colors.bold, '🎉 YOUR PROJECT IS FULLY FUNCTIONAL!');
  } else if (passedTests >= 4) {
    log(colors.yellow + colors.bold, '⚠️  Your project is mostly working but needs attention');
  } else {
    log(colors.red + colors.bold, '❌ Your project needs significant fixes');
  }
}

async function main() {
  console.log(colors.bold + colors.blue + '🔍 QUEUE MANAGEMENT SYSTEM - PROJECT CHECKER' + colors.reset);
  console.log('Checking your project structure, configuration, and functionality...\n');
  
  // Run all checks
  const structure = checkProjectStructure();
  const packageJson = checkPackageJson();
  const env = checkEnvironmentConfig();
  
  // Check server status
  const server = await new Promise(resolve => {
    checkServerStatus(resolve);
  });
  
  let login = false;
  let protected = false;
  let token = null;
  
  if (server) {
    // Test login
    const loginResult = await testLogin();
    login = loginResult.success;
    token = loginResult.token;
    
    // Test protected endpoint
    if (login && token) {
      protected = await testProtectedEndpoint(token);
    }
  }
  
  // Display results
  displaySummary({ structure, packageJson, env, server, login, protected });
  displayUsage();
}

// Run the checker
main().catch(console.error);
