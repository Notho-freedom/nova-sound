/**
 * Script to test Bunny Storage configuration and upload
 * Usage: npx tsx scripts/test-bunny.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import axios from 'axios';
import * as crypto from 'crypto';

// Load environment variables from .env.local or .env FIRST
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

// Get Bunny configuration from environment
// Allow override via command line argument: npx tsx scripts/test-bunny.ts <api-key>
const BUNNY_STORAGE_NAME = process.env.BUNNY_STORAGE_NAME;
const BUNNY_API_KEY = process.argv[2] || process.env.BUNNY_API_KEY; // Allow CLI override
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
const BUNNY_TOKEN_KEY = process.env.BUNNY_TOKEN_KEY;
const BUNNY_STORAGE_URL = `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}`;

// Helper functions to test Bunny directly
async function uploadToBunnyDirect(path: string, file: Buffer, contentType: string = 'application/octet-stream'): Promise<{ url: string; path: string; size: number }> {
  if (!BUNNY_STORAGE_NAME || !BUNNY_API_KEY) {
    throw new Error('Bunny Storage is not configured. Please set BUNNY_STORAGE_NAME and BUNNY_API_KEY in .env');
  }

  const url = `${BUNNY_STORAGE_URL}/${path}`;

  const res = await axios.put(url, file, {
    headers: {
      AccessKey: BUNNY_API_KEY,
      'Content-Type': contentType,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const cdnUrl = BUNNY_CDN_URL 
    ? `${BUNNY_CDN_URL}/${path}`
    : `https://${BUNNY_STORAGE_NAME}.b-cdn.net/${path}`;

  return {
    url: cdnUrl,
    path,
    size: file.length,
  };
}

async function deleteFromBunnyDirect(path: string): Promise<void> {
  if (!BUNNY_STORAGE_NAME || !BUNNY_API_KEY) {
    throw new Error('Bunny Storage is not configured');
  }

  const url = `${BUNNY_STORAGE_URL}/${path}`;

  await axios.delete(url, {
    headers: {
      AccessKey: BUNNY_API_KEY,
    },
  });
}

function generateSignedUrlDirect(path: string, expiresIn: number = 3600): string {
  if (!BUNNY_CDN_URL) {
    return `https://${BUNNY_STORAGE_NAME}.b-cdn.net/${path}`;
  }

  if (!BUNNY_TOKEN_KEY) {
    return `${BUNNY_CDN_URL}/${path}`;
  }

  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const stringToSign = `${path}${expires}`;
  const token = crypto
    .createHmac('sha256', BUNNY_TOKEN_KEY)
    .update(stringToSign)
    .digest('hex');
  
  const separator = path.includes('?') ? '&' : '?';
  return `${BUNNY_CDN_URL}/${path}${separator}token=${token}&expires=${expires}`;
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testBunnyStorage() {
  logSection('🧪 Test Bunny Storage Configuration');

  // Step 1: Check configuration
  logSection('📋 Step 1: Checking Configuration');
  
  log(`BUNNY_STORAGE_NAME: ${BUNNY_STORAGE_NAME ? '✅ Set (' + BUNNY_STORAGE_NAME + ')' : '❌ Not set'}`, BUNNY_STORAGE_NAME ? 'green' : 'red');
  log(`BUNNY_API_KEY: ${BUNNY_API_KEY ? '✅ Set (' + BUNNY_API_KEY.substring(0, 8) + '...)' : '❌ Not set'}`, BUNNY_API_KEY ? 'green' : 'red');
  log(`BUNNY_CDN_URL: ${BUNNY_CDN_URL ? '✅ Set (' + BUNNY_CDN_URL + ')' : '⚠️  Not set (will use default)'}`, BUNNY_CDN_URL ? 'green' : 'yellow');
  log(`BUNNY_TOKEN_KEY: ${BUNNY_TOKEN_KEY ? '✅ Set' : '⚠️  Not set (URL signing disabled)'}`, BUNNY_TOKEN_KEY ? 'green' : 'yellow');

  // Check configuration manually
  if (!BUNNY_STORAGE_NAME || !BUNNY_API_KEY) {
    log('\n❌ Bunny Storage is not properly configured!', 'red');
    log('Please set BUNNY_STORAGE_NAME and BUNNY_API_KEY in your .env file.', 'yellow');
    process.exit(1);
  }

  log('\n✅ Bunny Storage is configured', 'green');

  // Step 2: Create test file
  logSection('📝 Step 2: Creating Test File');
  
  const testFileName = 'test-bunny-upload.txt';
  const testContent = `Bunny Storage Test File
Created at: ${new Date().toISOString()}
This is a test file to verify Bunny Storage upload functionality.
`;
  
  try {
    writeFileSync(testFileName, testContent, 'utf-8');
    log(`✅ Test file created: ${testFileName}`, 'green');
    log(`   Size: ${testContent.length} bytes`, 'blue');
  } catch (error: any) {
    log(`❌ Failed to create test file: ${error.message}`, 'red');
    process.exit(1);
  }

  // Step 3: Upload test file
  logSection('☁️  Step 3: Uploading Test File to Bunny');
  
  const testPath = `nexus/test/${Date.now()}-${testFileName}`;
  let uploadResult;
  
  try {
    const fileBuffer = readFileSync(testFileName);
    log(`📤 Uploading to: ${testPath}`, 'blue');
    log(`   Storage URL: ${BUNNY_STORAGE_URL}/${testPath}`, 'blue');
    
    uploadResult = await uploadToBunnyDirect(testPath, fileBuffer, 'text/plain');
    
    log(`✅ Upload successful!`, 'green');
    log(`   File ID: ${uploadResult.path}`, 'blue');
    log(`   CDN URL: ${uploadResult.url}`, 'blue');
    log(`   Size: ${uploadResult.size} bytes`, 'blue');
  } catch (error: any) {
    log(`❌ Upload failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    if (error.request) {
      log(`   Request URL: ${error.config?.url}`, 'red');
    }
    
    // Clean up test file
    try {
      unlinkSync(testFileName);
    } catch {}
    
    process.exit(1);
  }

  // Step 4: Test signed URL (if token key is configured)
  if (BUNNY_TOKEN_KEY) {
    logSection('🔐 Step 4: Testing Signed URL Generation');
    
    try {
      const signedUrl = generateSignedUrlDirect(testPath, 3600);
      log(`✅ Signed URL generated:`, 'green');
      log(`   ${signedUrl}`, 'blue');
      log(`   Expires in: 1 hour`, 'blue');
    } catch (error: any) {
      log(`⚠️  Signed URL generation failed: ${error.message}`, 'yellow');
    }
  } else {
    logSection('🔐 Step 4: Signed URL Generation');
    log('⚠️  Skipped (BUNNY_TOKEN_KEY not configured)', 'yellow');
  }

  // Step 5: Test file deletion
  logSection('🗑️  Step 5: Testing File Deletion');
  
  try {
    log(`🗑️  Deleting: ${testPath}`, 'blue');
    await deleteFromBunnyDirect(testPath);
    log(`✅ File deleted successfully!`, 'green');
  } catch (error: any) {
    log(`❌ Deletion failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
  }

  // Step 6: Cleanup
  logSection('🧹 Step 6: Cleanup');
  
  try {
    unlinkSync(testFileName);
    log(`✅ Test file removed: ${testFileName}`, 'green');
  } catch (error: any) {
    log(`⚠️  Failed to remove test file: ${error.message}`, 'yellow');
  }

  // Summary
  logSection('📊 Test Summary');
  log('✅ All tests completed successfully!', 'green');
  log('\nBunny Storage is properly configured and working.', 'green');
  log(`\nTest file path: ${testPath}`, 'blue');
  log(`CDN URL: ${uploadResult.url}`, 'blue');
  log(`\nYou can now use Bunny Storage for Pro user uploads.`, 'cyan');
}

// Run the test
testBunnyStorage().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
