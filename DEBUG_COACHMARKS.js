// 🧪 Test Script pour le Coachmark
// À exécuter dans la console du navigateur (F12 → Console)

console.log('=== COACHMARKS TEST SCRIPT ===');

// 1. Vérifier localStorage
console.log('1. localStorage status:');
console.log('   nexus-coachmarks-completed:', localStorage.getItem('nexus-coachmarks-completed'));

// 2. Reset et relancer
console.log('\n2. Resetting coachmarks...');
localStorage.removeItem('nexus-coachmarks-completed');
console.log('   ✓ localStorage cleared');

// 3. Vérifier les data-coachmark attributes
console.log('\n3. Checking data-coachmark attributes:');
const targets = [
  '[data-coachmark="sidebar"]',
  '[data-coachmark="search-input"]',
  '[data-coachmark="player-bar"]',
  '[data-coachmark="player-controls"]',
  '[data-coachmark="queue-panel"]'
];

targets.forEach(target => {
  const el = document.querySelector(target);
  console.log(`   ${target}: ${el ? '✓ Found' : '✗ NOT FOUND'}`);
});

// 4. Recharger
console.log('\n4. Reloading page...');
setTimeout(() => location.reload(), 1000);
