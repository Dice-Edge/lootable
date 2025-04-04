import { PocketChangeSettingsForm } from './PocketChangeSettingsForm.js';
import { RandomLootSettingsForm } from './RandomLootSettingsForm.js';

/* Settings Menu */
export function settings() {
  game.settings.registerMenu('lootable', 'pocketChangeSettings', {
    name: game.i18n.localize('LOOTABLE.SettingsMenu.PocketChange.Name'),
    label: game.i18n.localize('LOOTABLE.SettingsMenu.PocketChange.Label'),
    icon: 'fas fa-coins',
    type: PocketChangeSettingsForm,
    restricted: true
  });

  game.settings.registerMenu('lootable', 'randomLootSettings', {
    name: game.i18n.localize('LOOTABLE.SettingsMenu.RandomLoot.Name'),
    label: game.i18n.localize('LOOTABLE.SettingsMenu.RandomLoot.Label'),
    icon: 'fas fa-dice-d20',
    type: RandomLootSettingsForm,
    restricted: true
  });

  game.settings.register('lootable', 'enableDebug', {
    name: game.i18n.localize('LOOTABLE.SettingsMenu.EnableDebug.Name'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  /* Pocket Change Settings */
  game.settings.register('lootable', 'disablePocketChange', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.DisablePocketChange.Name'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'perCoinAmount', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.PerCoinAmount.Name'),
    scope: 'world',
    config: false,
    type: Number,
    range: {
      min: 0.1,
      max: 3,
      step: 0.1
    },
    default: 1
  });

  game.settings.register('lootable', 'minCoinAmount', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.MinCoinAmount.Name'),
    scope: 'world',
    config: false,
    type: Number,
    default: 10
  });

  game.settings.register('lootable', 'ignoreExistingCoin', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.IgnoreExistingCoin.Name'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register('lootable', 'allowedCreatureTypes', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.AllowedCreatureTypes.Name'),
    scope: 'world',
    config: false,
    type: String,
    default: 'humanoid'
  });

  game.settings.register('lootable', 'noCoinChance', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.NoCoinChance.Name'),
    scope: 'world',
    config: false,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.05
    },
    default: 0
  });

  game.settings.register('lootable', 'tenPercentGoldChance', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.TenPercentGoldChance.Name'),
    scope: 'world',
    config: false,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.05
    },
    default: 0.05
  });

  game.settings.register('lootable', 'halfGoldChance', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.HalfGoldChance.Name'),
    scope: 'world',
    config: false,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.05
    },
    default: 0.1
  });

  game.settings.register('lootable', 'doubleCoinChance', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.DoubleCoinChance.Name'),
    scope: 'world',
    config: false,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.05
    },
    default: 0.1
  });

  game.settings.register('lootable', 'tripleCoinChance', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.TripleCoinChance.Name'),
    scope: 'world',
    config: false,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.05
    },
    default: 0.05
  });

  game.settings.register('lootable', 'hidePocketChangeChatMsg', {
    name: game.i18n.localize('LOOTABLE.PocketChangeSettings.HidePocketChangeChatMsg.Name'),
    hint: game.i18n.localize('LOOTABLE.PocketChangeSettings.HidePocketChangeChatMsg.Hint'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  /* Random Loot Settings */
  game.settings.register('lootable', 'disableRandomLoot', {
    name: game.i18n.localize('LOOTABLE.RandomLootSettings.DisableRandomLoot.Name'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'randomLootMode', {
    name: game.i18n.localize('LOOTABLE.RandomLootSettings.Mode.Name'),
    hint: game.i18n.localize('LOOTABLE.RandomLootSettings.Mode.Hint'),
    scope: 'world',
    config: false,
    type: String,
    choices: {
      onCreate: game.i18n.localize('LOOTABLE.RandomLootSettings.Mode.OnCreate'),
      manualOnly: game.i18n.localize('LOOTABLE.RandomLootSettings.Mode.ManualOnly')
    },
    default: 'onCreate'
  });

  game.settings.register('lootable', 'hideRandomLootHUD', {
    name: game.i18n.localize('LOOTABLE.RandomLootSettings.HideRandomLootHUD.Name'),
    hint: game.i18n.localize('LOOTABLE.RandomLootSettings.HideRandomLootHUD.Hint'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'creatureTypeTables', {
    name: game.i18n.localize('LOOTABLE.RandomLootSettings.CreatureTypeTables.Name'),
    scope: 'world',
    config: false,
    type: Object,
    default: {
      entries: [
        { type: 'humanoid', subtype: '', crRange: [0, 30], tableId: '' }
      ]
    },
    onChange: value => {
      if (!value.entries || !Array.isArray(value.entries)) {
        let newValue = {
          entries: Object.entries(value).flatMap(([type, entries]) =>
            (Array.isArray(entries) ? entries : [entries]).map(entry => ({
              type,
              ...entry
            }))
          )
        };
        return newValue;
      }
      return value;
    }
  });

  game.settings.register('lootable', 'hideRandomLootChatMsg', {
    name: game.i18n.localize('LOOTABLE.RandomLootSettings.HideRandomLootChatMsg.Name'),
    hint: game.i18n.localize('LOOTABLE.RandomLootSettings.HideRandomLootChatMsg.Hint'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'showRandomLootPrompt', {
    name: game.i18n.localize('LOOTABLE.RandomLootSettings.ShowRandomLootPrompt.Name'),
    hint: game.i18n.localize('LOOTABLE.RandomLootSettings.ShowRandomLootPrompt.Hint'),
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });
}

Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context, null, 2);
});
