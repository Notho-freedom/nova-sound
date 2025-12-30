#!/usr/bin/env node
/**
 * Comprehensive Redis Cache API Test
 * Tests the fix for 405 Method Not Allowed and 404 Not Found errors
 */

const BASE_URL = 'http://localhost:3000';

async function test(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    
    let body;
    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text.substring(0, 100);
      }
    } else {
      body = `[HTML Response - ${text.length} bytes]`;
    }

    return {
      status: response.status,
      method,
      path,
      contentType,
      body,
      success: response.status < 400,
    };
  } catch (error) {
    return {
      status: 'ERROR',
      method,
      path,
      error: error.message,
      success: false,
    };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Redis Cache API Test Suite            ║');
  console.log('║  Testing Fix for 405/404 Errors        ║');
  console.log('╚════════════════════════════════════════╝\n');

  const tests = [
    // Health check
    ['GET', '/api/cache/redis', null],
    
    // Track operations (the ones that were failing with 405/404)
    ['GET', '/api/cache/redis/track/yt_test123', null],
    ['PUT', '/api/cache/redis/track/yt_test123', { id: 'yt_test123', data: { title: 'Test Track' } }],
    
    // Search operations
    ['GET', '/api/cache/redis/search?key=search:test', null],
    ['PUT', '/api/cache/redis/search', { key: 'search:test', data: [] }],
    
    // Playlist operations  
    ['GET', '/api/cache/redis/playlist/pl_test', null],
    ['PUT', '/api/cache/redis/playlist/pl_test', { id: 'pl_test', data: { title: 'Test Playlist' } }],
    
    // Playlist videos
    ['GET', '/api/cache/redis/playlist-videos?key=playlist_videos:pl_test', null],
    ['PUT', '/api/cache/redis/playlist-videos', { key: 'playlist_videos:pl_test', data: [] }],
    
    // Tracks (multiple)
    ['GET', '/api/cache/redis/tracks?ids=id1,id2,id3', null],
    ['PUT', '/api/cache/redis/tracks', [{ id: 'id1', data: { title: 'Track 1' } }]],
  ];

  let passedCount = 0;
  let failedCount = 0;

  for (const [method, path, body] of tests) {
    const result = await test(method, path, body);
    
    const status = result.success ? '✅' : '❌';
    const statusCode = result.status === 'ERROR' ? result.status : result.status;
    
    console.log(`${status} ${method.padEnd(4)} ${path.padEnd(55)} → ${statusCode}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}\n`);
    } else if (!result.success && result.status >= 400) {
      console.log(`   Response: ${JSON.stringify(result.body).substring(0, 80)}\n`);
    }

    if (result.success) {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  Test Results                          ║`);
  console.log(`║  ✅ Passed: ${passedCount.toString().padEnd(30)} ║`);
  console.log(`║  ❌ Failed: ${failedCount.toString().padEnd(30)} ║`);
  console.log(`║  📊 Total: ${(passedCount + failedCount).toString().padEnd(31)} ║`);
  console.log('╚════════════════════════════════════════╝\n');

  if (failedCount === 0) {
    console.log('🎉 All tests passed! Redis API is working correctly.');
    console.log('The 405/404 errors have been fixed.\n');
  } else {
    console.log(`⚠️  ${failedCount} test(s) failed. Investigation needed.\n`);
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
