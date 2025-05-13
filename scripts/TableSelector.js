export class TableSelector extends FormApplication {

  constructor(options = {}) {
    super();
    this.mode = options.mode || 'creature';
    this.creatureType = options.creatureType;
    this.subtype = options.subtype;
    this.treasureType = options.treasureType;
    this.crRange = options.crRange;
    this.selectedTables = options.selectedTables || [];
    this.callback = options.callback;
    this.enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    this.creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
  }
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('LOOTABLE.settings.rndltSettings.tableSelector.name'),
      template: 'modules/lootable/templates/rndltTableSelect.hbs',
      width: 400,
      resizable: true,
      classes: ['table-selector'],
      scrollY: ['.table-list'],
      submitButton: true,
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: true,
      buttons: {}
    });
  }
  
  async getData() {
    return this.mode === 'creature' ? this._getCreatureData() : this._getTreasurePileData();
  }

  async _getCreatureData() {
    let currentTableId = '';
    if (this.creatureTypeTables && this.creatureTypeTables.entries) {
      let entry = this.creatureTypeTables.entries.find(e => 
        e.type === this.creatureType && 
        e.subtype === this.subtype && 
        e.treasureType === this.treasureType && 
        e.crRange[0] === this.crRange[0] && 
        e.crRange[1] === this.crRange[1]
      );            
      if (entry) {
        currentTableId = entry.tableId || '';
      }
    }        
    let tables = await this._getFormattedTables(currentTableId);
    return {
      tables,
      hasWorldTables: tables.length > 1,
      mode: 'creature'
    };
  }

  async _getTreasurePileData() {
    let tables = await this._getFormattedTables(null, this.selectedTables);        
    return {
      tables,
      hasWorldTables: tables.length > 1,
      mode: 'treasurePile',
      multiSelect: true
    };
  }

  async _getFormattedTables(currentTableId = null, selectedTables = []) {
    let tables = [{
      id: '',
      name: game.i18n.localize('LOOTABLE.RandomLootSettings.NoTable')
    }];
    let worldTables = game.tables.contents;
    for (let table of worldTables) {
      tables.push({
        id: table.id,
        name: table.name,
        selected: currentTableId ? table.id === currentTableId : selectedTables.includes(table.id)
      });
    }        
    let noTable = tables.shift();
    tables.sort((a, b) => a.name.localeCompare(b.name));
    tables.unshift(noTable);
    
    return tables;
  }
  
  async _updateObject(_event, formData) {
    if (this.mode === 'creature') {
      await this._updateCreatureObject(formData);
    } else {
      await this._updateTreasurePileObject(formData);
    }
  }

  async _updateCreatureObject(formData) {
    let tableId = formData.selectedTable || '';
    let creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    let index = creatureTypeTables.entries.findIndex(e => 
      e.type === this.creatureType && 
      e.subtype === this.subtype && 
      e.treasureType === this.treasureType && 
      e.crRange[0] === this.crRange[0] && 
      e.crRange[1] === this.crRange[1]
    );        
    if (index !== -1) {
      creatureTypeTables.entries[index].tableId = tableId;
      await game.settings.set('lootable', 'creatureTypeTables', creatureTypeTables);
    } else {
      if (this.enableDebug) console.log('%cLootable DEBUG |%c No entry found for ' + this.creatureType + ', ' + this.subtype + ', ' + this.treasureType + ', ' + JSON.stringify(this.crRange), 'color: #940000;', 'color: inherit');
    }
    if (this.callback) {
      this.callback(tableId);
    }
  }

  async _updateTreasurePileObject(formData) {
    let selectedTables = formData.selectedTables || [];
    if (!Array.isArray(selectedTables)) {
      selectedTables = [selectedTables];
    }        
    if (this.callback) {
      this.callback(selectedTables);
    }
  }
}
  