import { PocketChangeSettingsForm } from './PocketChangeSettingsForm.js';
import { RandomLootSettingsForm } from './RandomLootSettingsForm.js';
import { TreasurePileSettingsForm } from './TreasurePileSettingsForm.js';

/* Settings Menu */
export function settings() {
  game.settings.registerMenu('lootable', 'pocketChangeSettings', {
    name: game.i18n.localize('LOOTABLE.settings.pktcgName'),
    label: game.i18n.localize('LOOTABLE.settings.pktcgLabel'),
    icon: 'fas fa-coins',
    type: PocketChangeSettingsForm,
    restricted: true
  });

  game.settings.registerMenu('lootable', 'randomLootSettings', {
    name: game.i18n.localize('LOOTABLE.settings.rndltName'),
    label: game.i18n.localize('LOOTABLE.settings.rndltLabel'),
    icon: 'fas fa-dice-d20',
    type: RandomLootSettingsForm,
    restricted: true
  });

  game.settings.registerMenu('lootable', 'treasurePileSettings', {
    name: game.i18n.localize('LOOTABLE.settings.tsrplName'),
    label: game.i18n.localize('LOOTABLE.settings.tsrplLabel'),
    icon: 'fas fa-chess-pawn',
    type: TreasurePileSettingsForm,
    restricted: true
  });

  game.settings.register('lootable', 'enableDebug', {
    name: game.i18n.localize('LOOTABLE.settings.debug'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  /* Pocket Change Settings */
  game.settings.register('lootable', 'disablePocketChange', {
    name: 'Disable Pocket Change',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'perCoinAmount', {
    name: 'Per Coin Amount',
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
    name: 'Minimum Coin Amount',
    scope: 'world',
    config: false,
    type: Number,
    default: 10
  });

  game.settings.register('lootable', 'ignoreExistingCoin', {
    name: 'Ignore Existing Coin',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register('lootable', 'allowedCreatureTypes', {
    name: 'Allowed Creature Types',
    scope: 'world',
    config: false,
    type: String,
    default: 'humanoid'
  });

  game.settings.register('lootable', 'noCoinChance', {
    name: 'No Coin Chance',
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
    name: 'Ten Percent Gold Chance',
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
    name: 'Half Gold Chance',
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
    name: 'Double Coin Chance',
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
    name: 'Triple Coin Chance',
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
    name: 'Hide Pocket Change Chat Message',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  /* Random Loot Settings */
  game.settings.register('lootable', 'disableRandomLoot', {
    name: 'Disable Random Loot',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'randomLootMode', {
    name: 'Random Loot Mode',
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
    name: 'Hide Random Loot HUD',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'creatureTypeTables', {
    name: 'Creature Type Tables',
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
    name: 'Hide Random Loot Chat Message',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'showRandomLootPrompt', {
    name: 'Show Random Loot Prompt',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  /* Treasure Pile Settings */
  game.settings.register('lootable', 'disableTreasurePile', {
    name: 'Disable Treasure Pile',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register('lootable', 'treasurePileDefaultTables', {
    name: 'Treasure Pile Default Tables',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  game.settings.register('lootable', 'treasurePileGenerationLimit', {
    name: 'Treasure Pile Generation Limit',
    scope: 'world',
    config: false,
    type: Number,
    default: 250
  });

  game.settings.register('lootable', 'treasurePileShowAllTables', {
    name: 'Treasure Pile Show All Tables',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context, null, 2);
  });
}
