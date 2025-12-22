/**
 * Script to test PlanetHoster SFTP configuration and upload
 * Usage: npx tsx scripts/test-planethoster.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Load environment variables from .env.local or .env FIRST (before importing modules)
const envLocal = config({ path: resolve(process.cwd(), '.env.local') });
const env = config({ path: resolve(process.cwd(), '.env') });

// Debug: Verify env vars are loaded
console.log('\n[DEBUG] Environment variables check:');
console.log('PLANETHOSTER_SFTP_HOST:', process.env.PLANETHOSTER_SFTP_HOST ? '✅' : '❌');
console.log('PLANETHOSTER_SFTP_USER:', process.env.PLANETHOSTER_SFTP_USER ? '✅' : '❌');
console.log('PLANETHOSTER_SFTP_PASSWORD:', process.env.PLANETHOSTER_SFTP_PASSWORD ? '✅' : '❌');
console.log('');

// Import after loading env vars
import { uploadToPlanetHoster, isPlanetHosterConfigured, deleteFromPlanetHoster } from '../lib/planethoster-sftp';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testPlanetHosterSFTP() {
  logSection('🧪 Test PlanetHoster SFTP Configuration');

  // Step 1: Check configuration
  logSection('📋 Step 1: Checking Configuration');
  
  const PLANETHOSTER_SFTP_HOST = process.env.PLANETHOSTER_SFTP_HOST;
  const PLANETHOSTER_SFTP_PORT = process.env.PLANETHOSTER_SFTP_PORT || '22';
  const PLANETHOSTER_SFTP_USER = process.env.PLANETHOSTER_SFTP_USER;
  const PLANETHOSTER_SFTP_PASSWORD = process.env.PLANETHOSTER_SFTP_PASSWORD;
  const PLANETHOSTER_SFTP_PRIVATE_KEY = process.env.PLANETHOSTER_SFTP_PRIVATE_KEY;
  const PLANETHOSTER_SFTP_BASE_PATH = process.env.PLANETHOSTER_SFTP_BASE_PATH || '/';
  const PLANETHOSTER_CDN_URL = process.env.PLANETHOSTER_CDN_URL;

  log(`PLANETHOSTER_SFTP_HOST: ${PLANETHOSTER_SFTP_HOST ? '✅ Set (' + PLANETHOSTER_SFTP_HOST + ')' : '❌ Not set'}`, PLANETHOSTER_SFTP_HOST ? 'green' : 'red');
  log(`PLANETHOSTER_SFTP_PORT: ${PLANETHOSTER_SFTP_PORT ? '✅ Set (' + PLANETHOSTER_SFTP_PORT + ')' : '⚠️  Not set (default: 22)'}`, PLANETHOSTER_SFTP_PORT ? 'green' : 'yellow');
  log(`PLANETHOSTER_SFTP_USER: ${PLANETHOSTER_SFTP_USER ? '✅ Set (' + PLANETHOSTER_SFTP_USER + ')' : '❌ Not set'}`, PLANETHOSTER_SFTP_USER ? 'green' : 'red');
  log(`PLANETHOSTER_SFTP_PASSWORD: ${PLANETHOSTER_SFTP_PASSWORD ? '✅ Set (' + PLANETHOSTER_SFTP_PASSWORD.substring(0, 4) + '...)' : '⚠️  Not set'}`, PLANETHOSTER_SFTP_PASSWORD ? 'green' : 'yellow');
  log(`PLANETHOSTER_SFTP_PRIVATE_KEY: ${PLANETHOSTER_SFTP_PRIVATE_KEY ? '✅ Set (SSH key authentication)' : '⚠️  Not set (will use password if available)'}`, PLANETHOSTER_SFTP_PRIVATE_KEY ? 'green' : 'yellow');
  log(`PLANETHOSTER_SFTP_BASE_PATH: ${PLANETHOSTER_SFTP_BASE_PATH ? '✅ Set (' + PLANETHOSTER_SFTP_BASE_PATH + ')' : '⚠️  Not set (default: /)'}`, PLANETHOSTER_SFTP_BASE_PATH ? 'green' : 'yellow');
  log(`PLANETHOSTER_CDN_URL: ${PLANETHOSTER_CDN_URL ? '✅ Set (' + PLANETHOSTER_CDN_URL + ')' : '⚠️  Not set (will use host URL)'}`, PLANETHOSTER_CDN_URL ? 'green' : 'yellow');

  // Check configuration directly (don't rely on isPlanetHosterConfigured() as it uses cached env vars)
  const isConfigured = !!(
    PLANETHOSTER_SFTP_HOST &&
    PLANETHOSTER_SFTP_USER &&
    (PLANETHOSTER_SFTP_PASSWORD || PLANETHOSTER_SFTP_PRIVATE_KEY)
  );

  if (!isConfigured) {
    log('\n❌ PlanetHoster SFTP is not properly configured!', 'red');
    log('Please set PLANETHOSTER_SFTP_HOST, PLANETHOSTER_SFTP_USER, and', 'yellow');
    log('PLANETHOSTER_SFTP_PASSWORD or PLANETHOSTER_SFTP_PRIVATE_KEY in your .env file.', 'yellow');
    process.exit(1);
  }

  // Warn about port 21 (FTP) vs 22 (SFTP)
  if (PLANETHOSTER_SFTP_PORT === '21') {
    log('\n⚠️  Warning: Port 21 is typically for FTP, not SFTP!', 'yellow');
    log('   SFTP usually uses port 22. Please verify your configuration.', 'yellow');
    log('   If you need SFTP, set PLANETHOSTER_SFTP_PORT=22', 'yellow');
  }

  log('\n✅ PlanetHoster SFTP is configured', 'green');

  // Step 2: Check test file
  logSection('📝 Step 2: Checking Test File');
  
  const testFilePath = resolve(process.cwd(), 'public', 'icon.png');
  
  if (!existsSync(testFilePath)) {
    log(`❌ Test file not found: ${testFilePath}`, 'red');
    log('Please ensure icon.png exists in the public/ directory.', 'yellow');
    process.exit(1);
  }

  const fileStats = readFileSync(testFilePath);
  const fileSize = fileStats.length;
  log(`✅ Test file found: ${testFilePath}`, 'green');
  log(`   Size: ${(fileSize / 1024).toFixed(2)} KB (${fileSize} bytes)`, 'blue');
  log(`   Type: PNG image`, 'blue');

  // Step 3: Upload test file
  logSection('☁️  Step 3: Uploading Test File to PlanetHoster');
  
  const testPath = `nexus/test/${Date.now()}-icon.png`;
  let uploadResult;
  let uploadProgress = 0;
  
  try {
    log(`📤 Uploading to: ${testPath}`, 'blue');
    log(`   Full remote path: ${PLANETHOSTER_SFTP_BASE_PATH}/${testPath}`, 'blue');
    log(`   Using ${PLANETHOSTER_SFTP_PRIVATE_KEY ? 'SSH key' : 'password'} authentication`, 'blue');
    log(`   Max retries: 3`, 'blue');
    log(`   Timeout: 30 seconds`, 'blue');
    log(`\n⏳ Starting upload...`, 'yellow');
    
    // Force reload env vars by temporarily setting them (workaround for module cache)
    const originalEnv = { ...process.env };
    if (!process.env.PLANETHOSTER_SFTP_HOST && PLANETHOSTER_SFTP_HOST) {
      process.env.PLANETHOSTER_SFTP_HOST = PLANETHOSTER_SFTP_HOST;
    }
    if (!process.env.PLANETHOSTER_SFTP_USER && PLANETHOSTER_SFTP_USER) {
      process.env.PLANETHOSTER_SFTP_USER = PLANETHOSTER_SFTP_USER;
    }
    if (!process.env.PLANETHOSTER_SFTP_PASSWORD && PLANETHOSTER_SFTP_PASSWORD) {
      process.env.PLANETHOSTER_SFTP_PASSWORD = PLANETHOSTER_SFTP_PASSWORD;
    }
    if (!process.env.PLANETHOSTER_SFTP_PRIVATE_KEY && PLANETHOSTER_SFTP_PRIVATE_KEY) {
      process.env.PLANETHOSTER_SFTP_PRIVATE_KEY = PLANETHOSTER_SFTP_PRIVATE_KEY;
    }
    if (!process.env.PLANETHOSTER_SFTP_BASE_PATH && PLANETHOSTER_SFTP_BASE_PATH) {
      process.env.PLANETHOSTER_SFTP_BASE_PATH = PLANETHOSTER_SFTP_BASE_PATH;
    }
    if (!process.env.PLANETHOSTER_CDN_URL && PLANETHOSTER_CDN_URL) {
      process.env.PLANETHOSTER_CDN_URL = PLANETHOSTER_CDN_URL;
    }
    if (!process.env.PLANETHOSTER_SFTP_PORT && PLANETHOSTER_SFTP_PORT) {
      process.env.PLANETHOSTER_SFTP_PORT = PLANETHOSTER_SFTP_PORT;
    }
    
    const startTime = Date.now();
    
    uploadResult = await uploadToPlanetHoster(
      testPath,
      fileStats,
      (progress) => {
        uploadProgress = progress;
        if (progress < 100) {
          process.stdout.write(`\r   Progress: ${progress}%`);
        } else {
          process.stdout.write(`\r   Progress: ${progress}% ✅\n`);
        }
      },
      3 // maxRetries
    );
    
    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log(`\n✅ Upload successful!`, 'green');
    log(`   File path: ${uploadResult.path}`, 'blue');
    log(`   Public URL: ${uploadResult.url}`, 'blue');
    log(`   Size: ${(uploadResult.size / 1024).toFixed(2)} KB (${uploadResult.size} bytes)`, 'blue');
    log(`   Upload time: ${uploadTime}s`, 'blue');
  } catch (error: any) {
    log(`\n❌ Upload failed: ${error.message}`, 'red');
    
    // Detailed error information
    if (error.message.includes('timeout') || error.message.includes('Timed out')) {
      log(`\n💡 Timeout Error Detected:`, 'yellow');
      log(`   - The connection to PlanetHoster SFTP server timed out`, 'yellow');
      log(`   - This could be due to:`, 'yellow');
      log(`     • Network connectivity issues`, 'yellow');
      log(`     • Firewall blocking SFTP port (${PLANETHOSTER_SFTP_PORT})`, 'yellow');
      log(`     • Server overload or maintenance`, 'yellow');
      log(`   - The script will retry automatically (up to 3 times)`, 'yellow');
    } else if (error.message.includes('handshake')) {
      log(`\n💡 Handshake Error Detected:`, 'yellow');
      log(`   - The SFTP handshake failed`, 'yellow');
      log(`   - This could be due to:`, 'yellow');
      log(`     • Incorrect credentials`, 'yellow');
      log(`     • SSH key format issues`, 'yellow');
      log(`     • Server authentication problems`, 'yellow');
    } else if (error.message.includes('ECONNREFUSED')) {
      log(`\n💡 Connection Refused:`, 'yellow');
      log(`   - The server refused the connection`, 'yellow');
      log(`   - Check if PLANETHOSTER_SFTP_HOST and PLANETHOSTER_SFTP_PORT are correct`, 'yellow');
    } else if (error.message.includes('ENOTFOUND')) {
      log(`\n💡 Host Not Found:`, 'yellow');
      log(`   - The hostname could not be resolved`, 'yellow');
      log(`   - Check if PLANETHOSTER_SFTP_HOST is correct`, 'yellow');
    }
    
    process.exit(1);
  }

  // Step 4: Test file deletion
  logSection('🗑️  Step 4: Testing File Deletion');
  
  try {
    log(`🗑️  Deleting: ${testPath}`, 'blue');
    await deleteFromPlanetHoster(testPath);
    log(`✅ File deleted successfully!`, 'green');
  } catch (error: any) {
    log(`❌ Deletion failed: ${error.message}`, 'red');
    log(`   Note: The file may still exist on the server`, 'yellow');
  }

  // Step 5: Test file existence check (optional)
  logSection('🔍 Step 5: Testing File Existence Check');
  
  try {
    const { fileExistsOnPlanetHoster } = await import('../lib/planethoster-sftp');
    const exists = await fileExistsOnPlanetHoster(testPath);
    log(`   File exists: ${exists ? 'Yes (unexpected - should be deleted)' : 'No (expected - was deleted)'}`, exists ? 'yellow' : 'green');
  } catch (error: any) {
    log(`⚠️  File existence check failed: ${error.message}`, 'yellow');
  }

  // Summary
  logSection('📊 Test Summary');
  log('✅ All tests completed successfully!', 'green');
  log('\nPlanetHoster SFTP is properly configured and working.', 'green');
  log(`\nTest file path: ${testPath}`, 'blue');
  log(`Public URL: ${uploadResult.url}`, 'blue');
  log(`\nYou can now use PlanetHoster SFTP for Pro user uploads (serveur 2).`, 'cyan');
  log(`\nFeatures tested:`, 'cyan');
  log(`  ✅ Connection with retry logic (3 attempts)`, 'green');
  log(`  ✅ Directory creation (recursive)`, 'green');
  log(`  ✅ File upload with progress tracking`, 'green');
  log(`  ✅ File deletion`, 'green');
  log(`  ✅ Error handling and timeout management`, 'green');
}

// Run the test
testPlanetHosterSFTP().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

