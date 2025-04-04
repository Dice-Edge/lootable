export class PocketChangeSettingsForm extends FormApplication {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        title: game.i18n.localize('LOOTABLE.SettingsMenu.PocketChange.Name'),
        id: 'pocket-change-settings',
        template: 'modules/lootable/templates/pocketChange.hbs',
        width: 500,
        height: 'auto',
        closeOnSubmit: true,
        scrollY: ['.form-content']
      });
    }
  
    async getData() {
      return {
        settings: {
          disablePocketChange: game.settings.get('lootable', 'disablePocketChange'),
          perCoinAmount: game.settings.get('lootable', 'perCoinAmount'),
          minCoinAmount: game.settings.get('lootable', 'minCoinAmount'),
          ignoreExistingCoin: game.settings.get('lootable', 'ignoreExistingCoin'),
          allowedCreatureTypes: game.settings.get('lootable', 'allowedCreatureTypes'),
          noCoinChance: game.settings.get('lootable', 'noCoinChance'),
          tenPercentGoldChance: game.settings.get('lootable', 'tenPercentGoldChance'),
          halfGoldChance: game.settings.get('lootable', 'halfGoldChance'),
          doubleCoinChance: game.settings.get('lootable', 'doubleCoinChance'),
          tripleCoinChance: game.settings.get('lootable', 'tripleCoinChance'),
          hidePocketChangeChatMsg: game.settings.get('lootable', 'hidePocketChangeChatMsg')
        },
        headers: {
          amountConfig: game.i18n.localize('LOOTABLE.PocketChangeSettings.AmountConfig'),
          tokenConfig: game.i18n.localize('LOOTABLE.PocketChangeSettings.TokenConfig'),
          probabilityConfig: game.i18n.localize('LOOTABLE.PocketChangeSettings.ProbabilityConfig'),
          messageConfig: game.i18n.localize('LOOTABLE.PocketChangeSettings.MessageConfig')
        }
      };
    }
  
    activateListeners(html) {
      super.activateListeners(html);
      this._initRangeInputs(html);
    }
  
    _initRangeInputs(html) {
      let rangeInputs = html.find('input[type=\'range\']');
      rangeInputs.each((i, input) => {
        let valueDisplay = $(input).next('.range-value');
        $(input).on('input', (event) => {
          valueDisplay.text(event.currentTarget.value);
        });
      });
    }
  
    async _updateObject(_event, formData) {
      for (let [key, value] of Object.entries(formData)) {
        if (key === 'allowedCreatureTypes' && typeof value === 'string') {
          value = value.toLowerCase();
        }
        await game.settings.set('lootable', key, value);
      }
    }
  }