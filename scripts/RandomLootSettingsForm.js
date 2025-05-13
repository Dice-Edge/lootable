export class RandomLootSettingsForm extends FormApplication {

  constructor(...args) {
    super(...args);
    this.creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables') ?? { entries: [] };
    if (!this.creatureTypeTables.entries) {
      this.creatureTypeTables.entries = [];
    }    
    this.disableRandomLoot = game.settings.get('lootable', 'disableRandomLoot');
    this.hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    this.showRandomLootPrompt = game.settings.get('lootable', 'showRandomLootPrompt');
    this.hideRandomLootHUD = game.settings.get('lootable', 'hideRandomLootHUD');
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'random-loot-settings',
      title: game.i18n.localize('LOOTABLE.settings.rndltName'),
      template: 'modules/lootable/templates/rndltSettings.hbs',
      classes: [],
      width: 900,
      height: 'auto',
      tabs: [{
        navSelector: '.tabs',
        contentSelector: '.content',
        initial: 'types'
      }]
    });
  }

  async getData() {
    return {
      settings: {
        disableRandomLoot: this.disableRandomLoot,
        showRandomLootPrompt: this.showRandomLootPrompt,
        hideRandomLootChatMsg: this.hideRandomLootChatMsg,
        randomLootMode: game.settings.get('lootable', 'randomLootMode'),
        hideRandomLootHUD: this.hideRandomLootHUD
      },
      creatureTypes: this.creatureTypeTables.entries.map((entry, index) => ({
        ...entry,
        index,
        tableName: entry.tableId ? game.tables.get(entry.tableId)?.name || game.i18n.localize('LOOTABLE.settings.rndltSettings.tableSelector.noTable') : game.i18n.localize('LOOTABLE.settings.rndltSettings.tableSelector.noTable')
      }))
    };
  }

  _findEntryIndex(type, subtype, treasureType, crStart, crEnd) {
    return this.creatureTypeTables.entries.findIndex(e => {
      if (e.crRange[0] !== crStart || e.crRange[1] !== crEnd) return false;
      return e.type?.toLowerCase() === (type?.toLowerCase() ?? '') && 
             e.subtype?.toLowerCase() === (subtype?.toLowerCase() ?? '') && 
             e.treasureType?.toLowerCase() === (treasureType?.toLowerCase() ?? '');
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.add-type').click(this._onAddType.bind(this));
    html.find('.select-table').click(this._onSelectTable.bind(this));
    html.find('.edit-type').click(this._onEditType.bind(this));
    html.find('.rndlt-remove-types').click(this._onDeleteType.bind(this));
    html.find('.move-up').click(e => this._onMove(e, -1));
    html.find('.move-down').click(e => this._onMove(e, 1));
    html.find('.close-button').click(() => this.close());
  }

  async _onAddType(event) {
    event.preventDefault();    
    new RndltTypeForm(this.creatureTypeTables, {
      mode: 'add',
      callback: async (newEntry) => {
        this.creatureTypeTables.entries.push(newEntry);
        await this._updateAndRender();
      }
    }).render(true);
  }

  async _onSelectTable(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const { type, subtype, treasureType, crRangeStart, crRangeEnd } = button.dataset;
    const crStart = parseInt(crRangeStart);
    const crEnd = parseInt(crRangeEnd);
    const entryIndex = this._findEntryIndex(type, subtype, treasureType, crStart, crEnd);
    const currentTableId = entryIndex !== -1 ? this.creatureTypeTables.entries[entryIndex].tableId ?? '' : '';
    await this._showTableSelectionDialog(currentTableId, async (tableId) => {
      if (entryIndex !== -1) {
        this.creatureTypeTables.entries[entryIndex].tableId = tableId;
        await this._updateAndRender();
      }
    });
  }
  
  async _showTableSelectionDialog(currentTableId, callback) {
    let tables = [{
        id: '',
        name: game.i18n.localize('LOOTABLE.settings.rndltSettings.tableSelector.noTable'),
        selected: currentTableId === ''
    }];
    let worldTables = game.tables.contents;
    for (let table of worldTables) {
        tables.push({
            id: table.id,
            name: table.name,
            selected: table.id === currentTableId
        });
    }    
    tables.sort((a, b) => {
        if (a.id === '') return -1;
        if (b.id === '') return 1;
        return a.name.localeCompare(b.name);
    });    
    const content = await renderTemplate('modules/lootable/templates/rndltTableSelect.hbs', {
      tables: tables
    });    
    const dialog = new Dialog({
      title: game.i18n.localize('LOOTABLE.settings.rndltSettings.tableSelector.name'),
      content: content,
      classes: ['table-selector'],
      resizable: true,
      height: 500,
      buttons: {},
      render: (html) => {
        html.find('form').on('submit', async (event) => {
          event.preventDefault();
          let form = event.target;
          let tableId = form.selectedTable?.value || '';          
          if (callback) await callback(tableId);
          dialog.close();
        });
        let selectedRadio = html.find('input[type=\'radio\']:checked')[0];
        if (selectedRadio) {
          setTimeout(() => {
            selectedRadio.scrollIntoView({ block: 'center' });
          }, 50);
        }
      }
    }).render(true);
  }

  async _onEditType(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const { type, subtype, treasureType, crRangeStart, crRangeEnd } = button.dataset;
    const crStart = parseInt(crRangeStart);
    const crEnd = parseInt(crRangeEnd);
    const entryIndex = this._findEntryIndex(type, subtype, treasureType, crStart, crEnd);
    if (entryIndex === -1) return;
    let entry = this.creatureTypeTables.entries[entryIndex];
    new RndltTypeForm(this.creatureTypeTables, {
      mode: 'edit',
      entry,
      entryIndex,
      callback: async (updatedEntry) => {
        this.creatureTypeTables.entries[entryIndex] = updatedEntry;
        await this._updateAndRender();
      }
    }).render(true);
  }

  async _onDeleteType(event) {
    event.preventDefault();
    const button = event.currentTarget;    
    const tr = button.closest('.rndlt-types-entry');
    const index = parseInt(tr.dataset.index);
    if (isNaN(index) || index < 0 || index >= this.creatureTypeTables.entries.length) {
      return;
    }    
    this.creatureTypeTables.entries.splice(index, 1);
    await this._updateAndRender();
  }

  async _onMove(event, direction) {
    event.preventDefault();
    const button = event.currentTarget;
    const tr = button.closest('.rndlt-types-entry');
    const index = parseInt(tr.dataset.index);
    const targetIndex = index + direction;    
    if (targetIndex < 0 || targetIndex >= this.creatureTypeTables.entries.length) return;
    const temp = this.creatureTypeTables.entries[index];
    this.creatureTypeTables.entries[index] = this.creatureTypeTables.entries[targetIndex];
    this.creatureTypeTables.entries[targetIndex] = temp;    
    await this._updateAndRender();
  }

  async _updateAndRender() {
    await game.settings.set('lootable', 'creatureTypeTables', this.creatureTypeTables);
    this.render();
  }

  async _updateObject(event, formData) {
    await game.settings.set('lootable', 'disableRandomLoot', formData.disableRandomLoot);
    await game.settings.set('lootable', 'showRandomLootPrompt', formData.showRandomLootPrompt);
    await game.settings.set('lootable', 'hideRandomLootChatMsg', formData.hideRandomLootChatMsg);
    await game.settings.set('lootable', 'randomLootMode', formData.randomLootMode);
    await game.settings.set('lootable', 'hideRandomLootHUD', formData.hideRandomLootHUD);
    await game.settings.set('lootable', 'creatureTypeTables', this.creatureTypeTables);
  }

  close(options={}) {
    if (options.force || !options.submitOnFormClose) {
      return super.close(options);
    }
    return;
  }
}

class RndltTypeForm extends FormApplication {

  constructor(creatureTypeTables, options) {
    super();
    this.creatureTypeTables = creatureTypeTables;
    this.mode = options.mode || 'add';
    this.entry = options.entry || null;
    this.entryIndex = options.entryIndex || null;
    this.callback = options.callback || null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('LOOTABLE.settings.rndltSettings.addEditType.addName'),
      template: 'modules/lootable/templates/rndltAddTypes.hbs',
      classes: ['type-form'],
      width: 400,
      height: 'auto',
      submitOnChange: false,
      closeOnSubmit: false
    });
  }

  static _validateCRRange(crMin, crMax) {
    if (isNaN(crMin) || isNaN(crMax) || crMin > crMax) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.settings.rndltSettings.error.invalidCRRange'));
      return false;
    }
    return true;
  }

  _isDuplicateEntry(type, subtype, treasureType, crMin, crMax) {
    return this.creatureTypeTables.entries.some((e, i) => {
      if (this.mode === 'edit' && i === this.entryIndex) return false;
      return e.type?.toLowerCase() === type && 
             e.subtype?.toLowerCase() === subtype && 
             e.treasureType?.toLowerCase() === treasureType && 
             e.crRange[0] === crMin && 
             e.crRange[1] === crMax;
    });
  }

  async getData() {
    const isEdit = this.mode === 'edit';    
    if (isEdit) {
      this.options.title = game.i18n.localize('LOOTABLE.settings.rndltSettings.addEditType.editName');
      this.options.template = 'modules/lootable/templates/rndltEditTypes.hbs';
      return {
        type: this.entry.type,
        subtype: this.entry.subtype || '',
        treasureType: this.entry.treasureType || '',
        crRangeStart: this.entry.crRange[0],
        crRangeEnd: this.entry.crRange[1]
      };
    }    
    return {};
  }

  async _updateObject(_event, formData) {
    const isEdit = this.mode === 'edit';
    const fieldPrefix = isEdit ? 'editCreature' : 'newCreature';
    const type = formData[`${fieldPrefix}Type`]?.toLowerCase() ?? '';
    const subtype = formData[`${fieldPrefix}Subtype`]?.toLowerCase() ?? '';
    const treasureType = formData[`${fieldPrefix}TreasureType`]?.toLowerCase() ?? '';
    const crMin = parseInt(formData[`${fieldPrefix}CRMin`]);
    const crMax = parseInt(formData[`${fieldPrefix}CRMax`]);    
    if (!RndltTypeForm._validateCRRange(crMin, crMax)) return;
    const duplicate = this._isDuplicateEntry(type, subtype, treasureType, crMin, crMax);
    if (duplicate) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.settings.rndltSettings.error.duplicateEntry'));
      return;
    }
    if (this.callback) {
      if (isEdit) {
        await this.callback({
          ...this.entry,
          type,
          subtype,
          treasureType,
          crRange: [crMin, crMax]
        });
      } else {
        await this.callback({
          type,
          subtype,
          treasureType,
          crRange: [crMin, crMax],
          tableId: ''
        });
      }
      super.close();
    }
  }

  close(options={}) {
    if (options.force || !options.submitOnFormClose) {
      return super.close(options);
    }
    return;
  }
}