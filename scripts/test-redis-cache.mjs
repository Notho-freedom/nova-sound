#!/usr/bin/env node
/**
 * Test Redis Cache API Endpoints
 */

const BASE_URL = 'http://localhost:3000';

async function testRedisAPI() {
  console.log('=== Test Redis Cache API ===\n');
  
  const tests = [
    { name: 'Health Check', method: 'GET', path: '/api/cache/redis' },
    { name: 'Track Set', method: 'PUT', path: '/api/cache/redis/track/test-id', body: { id: 'test-id', data: { title: 'Test' } } },
    { name: 'Search Set', method: 'PUT', path: '/api/cache/redis/search', body: { key: 'search:test', data: [] } },
    { name: 'Track Get', method: 'GET', path: '/api/cache/redis/track/test-id' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const options = {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(`${BASE_URL}${test.path}`, options);
      const text = await response.text();
      
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      const success = response.status < 400;
      if (success) {
        passed++;
        console.log(`✅ ${test.name}`);
      } else {
        failed++;
        console.log(`❌ ${test.name}`);
      }
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(body).substring(0, 100)}...`);
      console.log();
    } catch (error) {
      failed++;
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      console.log();
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

testRedisAPI();
