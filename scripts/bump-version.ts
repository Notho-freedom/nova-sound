import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Parse current version
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Get build date
const buildDate = new Date().toISOString();

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Version bumped: ${packageJson.version} → ${newVersion}`);
console.log(`📅 Build date: ${buildDate}`);

// Create version.json for update system
const versionInfo = {
  version: newVersion,
  buildDate,
  buildNumber: Date.now(),
  changelog: `Build ${newVersion}`,
  commits: []
};

const versionJsonPath = path.join(__dirname, '../local-ui/version.json');
const localUiDir = path.dirname(versionJsonPath);

if (!fs.existsSync(localUiDir)) {
  fs.mkdirSync(localUiDir, { recursive: true });
}

fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2));
console.log(`✅ Created version.json: ${versionJsonPath}`);

// Also copy to public directory for web access
const publicVersionPath = path.join(__dirname, '../public/version.json');
fs.writeFileSync(publicVersionPath, JSON.stringify(versionInfo, null, 2));
console.log(`✅ Copied version.json to public: ${publicVersionPath}`);
