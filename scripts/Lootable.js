import { settings } from './LootableSettings.js';
import { PocketChange } from './PocketChange.js';
import { RandomLoot } from './RandomLoot.js';

function logWelcomeMessage() {
  let moduleData = game.modules.get('lootable');
  let version = moduleData.version ? `v${moduleData.version}` : '';
  console.log(
    `\n%cLootable! ${version} 💰`,
    `color: #ffd700; background: #4a0000; font-size: 20px; padding: 5px 10px; font-family: "Trebuchet MS", Helvetica, sans-serif; border: 2px solid #ffd700; border-radius: 4px; font-weight: bold; text-shadow: 2px 2px 2px #000000;`
  );
}

Hooks.once('init', () => {
  settings();
});

Hooks.once('ready', () => {
  logWelcomeMessage();
});

Hooks.on('createToken', async (tokenDoc, options, userId) => {
  await PocketChange.onCreateToken(tokenDoc, options, userId);
  await RandomLoot.onCreateToken(tokenDoc, options, userId);
});

Hooks.on('renderChatMessage', (app, html, data) => {
  let flags = data?.message?.flags?.lootable;
  if (!flags) return;
  html.addClass('message lootable-message');
  if (flags.coinGenerated) {
    html.addClass('lootable-coin-generated');
  }
  if (flags.randomLootGenerated) {
    html.addClass('lootable-random-loot-generated');
  }
});
