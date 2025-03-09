const fs = require('fs');
const { execSync } = require('child_process');

const newVersion = process.argv[2];
if (!newVersion) {
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  process.exit(1);
}

const moduleJsonPath = './module.json';
let moduleJson;

try {
  const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf8');
  moduleJson = JSON.parse(moduleJsonContent);
} catch (error) {
  process.exit(1);
}

const oldVersion = moduleJson.version;
moduleJson.version = newVersion;

moduleJson.download = `https://github.com/Dice-Edge/lootable/releases/download/v${newVersion}/lootable-v${newVersion}.zip`;

try {
  fs.writeFileSync(moduleJsonPath, JSON.stringify(moduleJson, null, 2));
} catch (error) {
  process.exit(1); 
} 