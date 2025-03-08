export class TableSelector extends FormApplication {
    constructor(creatureType, subtype, crRange, callback) {
      super();
      this.creatureType = creatureType;
      this.subtype = subtype;
      this.crRange = crRange;
      this.callback = callback;
      
      // Retrieve settings once
      this.enableDebug = game.settings.get('lootable', 'enableDebug') || false;
      this.creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    }
  
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        title: game.i18n.localize(`LOOTABLE.RandomLootSettings.TableSelector.Title`),
        template: `modules/lootable/templates/tableList.hbs`,
        width: 400,
        height: 'auto',
        classes: [`lootable`, `table-selector`],
        scrollY: ['.table-list']
      });
    }
  
    async getData() {
      let currentTableId = "";
      
      if (this.creatureTypeTables && this.creatureTypeTables.entries) {
          let entry = this.creatureTypeTables.entries.find(e => 
              e.type === this.creatureType && 
              e.subtype === this.subtype && 
              e.crRange[0] === this.crRange[0] && 
              e.crRange[1] === this.crRange[1]
          );
          
          if (entry) {
              currentTableId = entry.tableId || "";
          }
      }
      
      if (this.enableDebug) console.log(`%cLootable DEBUG |%c Loading tables for selector, current tableId: ${currentTableId}`, 'color: #940000;', 'color: inherit');
      
      // Start with "No Table" option
      let tables = [{
          id: "",
          name: game.i18n.localize(`LOOTABLE.RandomLootSettings.NoTable`)
      }];
      
      // Add world tables
      let worldTables = game.tables.contents;
      for (let table of worldTables) {
          tables.push({
              id: table.id,
              name: table.name,
              selected: table.id === currentTableId
          });
          
          if (this.enableDebug && table.id === currentTableId) {
              console.log(`%cLootable DEBUG |%c Found current table in world tables: ${table.name}`, 'color: #940000;', 'color: inherit');
          }
      }
      
      // Sort tables alphabetically, keeping "No Table" at the top
      let noTable = tables.shift();
      tables.sort((a, b) => a.name.localeCompare(b.name));
      tables.unshift(noTable);
      
      return {
          tables,
          hasWorldTables: tables.length > 1
      };
    }
    
    async _updateObject(_event, formData) {
      // Get the table ID from the form data
      let tableId = formData.selectedTable || "";
      
      if (this.enableDebug) console.log(`%cLootable DEBUG |%c Saving table selection: ${tableId}`, 'color: #940000;', 'color: inherit');
      
      // Get the latest creature type tables in case they've been updated elsewhere
      let creatureTypeTables = game.settings.get(`lootable`, `creatureTypeTables`);
      
      // Find the index of the entry for this creature type, subtype, and CR range
      let index = creatureTypeTables.entries.findIndex(e => 
          e.type === this.creatureType && 
          e.subtype === this.subtype && 
          e.crRange[0] === this.crRange[0] && 
          e.crRange[1] === this.crRange[1]
      );
      
      if (index !== -1) {
          if (this.enableDebug) console.log(`%cLootable DEBUG |%c Found entry at index ${index}`, 'color: #940000;', 'color: inherit');
          if (this.enableDebug) console.log(`%cLootable DEBUG |%c Before update: ${JSON.stringify(creatureTypeTables.entries[index])}`, 'color: #940000;', 'color: inherit');
          
          creatureTypeTables.entries[index].tableId = tableId;
          
          if (this.enableDebug) console.log(`%cLootable DEBUG |%c After update: ${JSON.stringify(creatureTypeTables.entries[index])}`, 'color: #940000;', 'color: inherit');
          
          // Save the updated creature type tables
          await game.settings.set(`lootable`, `creatureTypeTables`, creatureTypeTables);
      } else {
          if (this.enableDebug) console.log(`%cLootable DEBUG |%c No entry found for ${this.creatureType}, ${this.subtype}, ${JSON.stringify(this.crRange)}`, 'color: #940000;', 'color: inherit');
      }
      
      // Call the callback with the tableId if it exists
      if (this.callback) {
          if (this.enableDebug) console.log(`%cLootable DEBUG |%c Calling callback with tableId: ${tableId}`, 'color: #940000;', 'color: inherit');
          this.callback(tableId);
      }
    }
}
  