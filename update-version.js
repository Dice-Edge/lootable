const fs = require('fs');
const { execSync } = require('child_process');

// Get the version argument
const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Please provide a version number (e.g., node update-version.js 0.1.3)');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Version must be in the format x.y.z (e.g., 0.1.3)');
  process.exit(1);
}

// Read the module.json file
const moduleJsonPath = './module.json';
let moduleJson;

try {
  const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf8');
  moduleJson = JSON.parse(moduleJsonContent);
} catch (error) {
  console.error('Error reading module.json:', error);
  process.exit(1);
}

// Update the version
const oldVersion = moduleJson.version;
moduleJson.version = newVersion;

// Update the download URL
moduleJson.download = `https://github.com/Dice-Edge/lootable/releases/download/v${newVersion}/lootable-v${newVersion}.zip`;

// Write the updated module.json
try {
  fs.writeFileSync(moduleJsonPath, JSON.stringify(moduleJson, null, 2));
  console.log(`Updated version from ${oldVersion} to ${newVersion} in module.json`);
} catch (error) {
  console.error('Error writing module.json:', error);
  process.exit(1);
}

// Instructions for the user
console.log('\nNext steps:');
console.log('1. Commit the changes:');
console.log('   git add module.json');
console.log('   git commit -m "Bump version to ' + newVersion + '"');
console.log('2. Create a new tag:');
console.log('   git tag v' + newVersion);
console.log('3. Push the changes and tag:');
console.log('   git push origin main');
console.log('   git push origin v' + newVersion);
console.log('\nThis will trigger the GitHub Actions workflow to create a new release.'); 