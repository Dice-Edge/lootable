export class TableSelector extends FormApplication {
    constructor(creatureType, subtype, treasureType, crRange, callback) {
      super();
      this.creatureType = creatureType;
      this.subtype = subtype;
      this.treasureType = treasureType;
      this.crRange = crRange;
      this.callback = callback;
      
      this.enableDebug = game.settings.get('lootable', 'enableDebug') || false;
      this.creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    }
  
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        title: game.i18n.localize('LOOTABLE.RandomLootSettings.TableSelector.Title'),
        template: 'modules/lootable/templates/tableSelector.hbs',
        width: 400,
        height: 'auto',
        classes: ['lootable', 'table-selector'],
        scrollY: ['.table-list']
      });
    }
  
    async getData() {
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
      
      let tables = [{
          id: '',
          name: game.i18n.localize('LOOTABLE.RandomLootSettings.NoTable')
      }];
      
      let worldTables = game.tables.contents;
      for (let table of worldTables) {
          tables.push({
              id: table.id,
              name: table.name,
              selected: table.id === currentTableId
          });
      }
      
      let noTable = tables.shift();
      tables.sort((a, b) => a.name.localeCompare(b.name));
      tables.unshift(noTable);
      
      return {
          tables,
          hasWorldTables: tables.length > 1
      };
    }
    
    async _updateObject(_event, formData) {
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
}
  