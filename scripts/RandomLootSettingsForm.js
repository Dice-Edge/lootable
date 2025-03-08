import { TableSelector } from './TableSelector.js';

export class RandomLootSettingsForm extends FormApplication {
  constructor(...args) {
    super(...args);
    
    // Retrieve all settings once in the constructor
    this.creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    this.enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    this.disableRandomLoot = game.settings.get('lootable', 'disableRandomLoot');
    this.hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    
    // Initialize with empty array if needed
    if (!this.creatureTypeTables) {
      this.creatureTypeTables = { entries: [] };
    } else if (!this.creatureTypeTables.entries) {
      this.creatureTypeTables.entries = [];
    }
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'random-loot-settings',
      title: game.i18n.localize('LOOTABLE.SettingsMenu.RandomLoot.Name'),
      template: 'modules/lootable/templates/randomloot.hbs',
      classes: ['random-loot-settings'],
      width: 700,
      height: 'auto',
      tabs: [{
        navSelector: '.tabs',
        contentSelector: '.content',
        initial: 'creature-types'
      }]
    });
  }

  async getData() {
    // Map creature type entries with Promise.all to handle async operations
    let creatureTypes = await Promise.all(
        this.creatureTypeTables.entries.map((entry, index) => this._mapCreatureTypeEntry(entry, index))
    );
    
    return {
        creatureTypes,
        settings: {
            disableRandomLoot: this.disableRandomLoot,
            hideRandomLootChatMsg: this.hideRandomLootChatMsg
        }
    };
  }

  async _mapCreatureTypeEntry(entry, index) {
    // Clone the entry to avoid modifying the original
    let mappedEntry = foundry.utils.deepClone(entry);
    mappedEntry.index = index;
    
    // Handle the table ID
    if (this.enableDebug) console.log(`%cLootable DEBUG |%c Processing table ID: ${mappedEntry.tableId}`, 'color: #940000;', 'color: inherit');
    
    // If tableId is empty or null, it's "No Table"
    if (!mappedEntry.tableId) {
        if (this.enableDebug) console.log(`%cLootable DEBUG |%c No table selected`, 'color: #940000;', 'color: inherit');
        mappedEntry.tableName = game.i18n.localize('LOOTABLE.RandomLootSettings.NoTable');
        return mappedEntry;
    }
    
    // Try to get the table
    let table = game.tables.get(mappedEntry.tableId);
    
    // If table is found, use its name
    if (table) {
        if (this.enableDebug) console.log(`%cLootable DEBUG |%c Found world table: ${table.name}`, 'color: #940000;', 'color: inherit');
        mappedEntry.tableName = table.name;
    } else {
        if (this.enableDebug) console.log(`%cLootable DEBUG |%c Table not found: ${mappedEntry.tableId}`, 'color: #940000;', 'color: inherit');
        mappedEntry.tableName = game.i18n.localize('LOOTABLE.RandomLootSettings.TableNotFound');
    }
    
    return mappedEntry;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    html.find('.add-creature-type').click(this._onAddCreatureType.bind(this));
    html.find('.select-table').click(this._onSelectTable.bind(this));
    html.find('.edit-creature-type').click(this._onEditCreatureType.bind(this));
    html.find('.remove-creature-type').click(this._onDeleteCreatureType.bind(this));
    html.find('.move-up').click(this._onMoveUp.bind(this));
    html.find('.move-down').click(this._onMoveDown.bind(this));
  }

  async _onAddCreatureType(event) {
    event.preventDefault();
    
    new AddCreatureTypeForm(this.creatureTypeTables, async (newEntry) => {
      this.creatureTypeTables.entries.push(newEntry);
      await this._updateAndRender();
    }).render(true);
  }

  async _onSelectTable(event) {
    event.preventDefault();
    let button = event.currentTarget;
    let { creatureType, creatureSubtype, crRangeStart, crRangeEnd } = button.dataset;
    
    if (this.enableDebug) {
        console.log(`%cLootable DEBUG |%c Opening table selector for: ${creatureType}, ${creatureSubtype}, CR ${crRangeStart}-${crRangeEnd}`, 'color: #940000;', 'color: inherit');
    }
    
    // Create a callback function to handle the selected table
    let callback = async (tableId) => {
        if (this.enableDebug) {
            console.log(`%cLootable DEBUG |%c Table selector callback with newTableId: ${tableId}`, 'color: #940000;', 'color: inherit');
        }
        
        // Find the entry in creatureTypeTables
        let entryIndex = this.creatureTypeTables.entries.findIndex(e => 
            e.type === creatureType && 
            e.subtype === creatureSubtype && 
            e.crRange[0] === parseInt(crRangeStart) && 
            e.crRange[1] === parseInt(crRangeEnd)
        );
        
        if (entryIndex !== -1) {
            if (this.enableDebug) {
                console.log(`%cLootable DEBUG |%c Found entry at index ${entryIndex}`, 'color: #940000;', 'color: inherit');
                console.log(`%cLootable DEBUG |%c Before update: ${JSON.stringify(this.creatureTypeTables.entries[entryIndex])}`, 'color: #940000;', 'color: inherit');
            }
            
            // Update the tableId
            this.creatureTypeTables.entries[entryIndex].tableId = tableId;
            
            if (this.enableDebug) {
                console.log(`%cLootable DEBUG |%c After update: ${JSON.stringify(this.creatureTypeTables.entries[entryIndex])}`, 'color: #940000;', 'color: inherit');
            }
            
            // Save and render
            await this._updateAndRender();
        } else {
            if (this.enableDebug) {
                console.log(`%cLootable DEBUG |%c Entry not found for creature type: ${creatureType}, subtype: ${creatureSubtype}, CR: ${crRangeStart}-${crRangeEnd}`, 'color: #940000;', 'color: inherit');
            }
        }
    };
    
    // Open the table selector
    let tableSelector = new TableSelector(
        creatureType, 
        creatureSubtype, 
        [parseInt(crRangeStart), parseInt(crRangeEnd)], 
        callback
    );
    tableSelector.render(true);
  }

  async _onEditCreatureType(event) {
    event.preventDefault();
    let button = event.currentTarget;
    let { creatureType, creatureSubtype, crRangeStart, crRangeEnd } = button.dataset;
    
    // Find the entry in creatureTypeTables
    let entryIndex = this.creatureTypeTables.entries.findIndex(e => 
        e.type === creatureType && 
        e.subtype === creatureSubtype && 
        e.crRange[0] === parseInt(crRangeStart) && 
        e.crRange[1] === parseInt(crRangeEnd)
    );
    
    if (entryIndex === -1) return;
    
    let entry = this.creatureTypeTables.entries[entryIndex];
    
    // Render the template
    let content = await renderTemplate('modules/lootable/templates/editCreatureType.hbs', {
      type: entry.type,
      subtype: entry.subtype || '',
      crRangeStart: entry.crRange[0],
      crRangeEnd: entry.crRange[1]
    });
    
    // Create a dialog to edit the creature type
    let dialog = new Dialog({
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.EditCreatureType.Title'),
      content: content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-save"></i>',
          label: game.i18n.localize('LOOTABLE.RandomLootSettings.EditCreatureType.Confirm'),
          callback: async (html) => {
            let form = html.find('form')[0];
            let type = form.editCreatureType.value;
            let subtype = form.editCreatureSubtype.value;
            let crMin = parseInt(form.editCreatureCRMin.value);
            let crMax = parseInt(form.editCreatureCRMax.value);
            
            // Validate CR range
            if (crMin > crMax) {
              ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.InvalidCRRange'));
              return;
            }
            
            // Check for duplicate entries
            let duplicate = this.creatureTypeTables.entries.some((e, i) => 
                i !== entryIndex && 
                e.type === type && 
                e.subtype === subtype && 
                e.crRange[0] === crMin && 
                e.crRange[1] === crMax
            );
            
            if (duplicate) {
              ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.DuplicateEntry'));
              return;
            }
            
            // Update the entry
            this.creatureTypeTables.entries[entryIndex] = {
              ...entry,
              type,
              subtype,
              crRange: [crMin, crMax]
            };
            
            await this._updateAndRender();
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('LOOTABLE.RandomLootSettings.EditCreatureType.Cancel')
        }
      },
      default: 'confirm'
    });
    
    dialog.render(true);
  }

  async _onDeleteCreatureType(event) {
    event.preventDefault();
    let button = event.currentTarget;
    
    // Get the index directly from the closest creature-type-entry element
    let tr = button.closest('.creature-type-entry');
    let index = parseInt(tr.dataset.index);
    
    if (isNaN(index) || index < 0 || index >= this.creatureTypeTables.entries.length) {
      console.error(`Invalid index: ${index}`);
      return;
    }
    
    // Get the entry data for the confirmation message
    let entry = this.creatureTypeTables.entries[index];
    let creatureType = entry?.type || 'Unknown';
    let creatureSubtype = entry?.subtype || '';
    let crRangeStart = entry?.crRange?.[0] || 0;
    let crRangeEnd = entry?.crRange?.[1] || 0;
    
    // Create a confirmation dialog
    let confirmContent = game.i18n.format('LOOTABLE.RandomLootSettings.RemoveCreatureType.ConfirmContent', {
      type: creatureType,
      subtype: creatureSubtype,
      crRange: `${crRangeStart}-${crRangeEnd}`
    });
    
    let confirmed = await Dialog.confirm({
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.RemoveCreatureType.Title'),
      content: confirmContent,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
    
    if (confirmed) {
      // Remove the entry by index
      this.creatureTypeTables.entries.splice(index, 1);
      await this._updateAndRender();
    }
  }

  async _onMoveUp(event) {
    event.preventDefault();
    let button = event.currentTarget;
    let tr = button.closest('.creature-type-entry');
    let index = parseInt(tr.dataset.index);
    
    if (index <= 0) return;
    
    // Swap with the previous entry
    let temp = this.creatureTypeTables.entries[index];
    this.creatureTypeTables.entries[index] = this.creatureTypeTables.entries[index - 1];
    this.creatureTypeTables.entries[index - 1] = temp;
    
    await this._updateAndRender();
  }

  async _onMoveDown(event) {
    event.preventDefault();
    let button = event.currentTarget;
    let tr = button.closest('.creature-type-entry');
    let index = parseInt(tr.dataset.index);
    
    if (index >= this.creatureTypeTables.entries.length - 1) return;
    
    // Swap with the next entry
    let temp = this.creatureTypeTables.entries[index];
    this.creatureTypeTables.entries[index] = this.creatureTypeTables.entries[index + 1];
    this.creatureTypeTables.entries[index + 1] = temp;
    
    await this._updateAndRender();
  }

  async _updateAndRender() {
    if (this.enableDebug) console.log(`%cLootable DEBUG |%c Saving creatureTypeTables:`, 'color: #940000;', 'color: inherit', this.creatureTypeTables);
    
    let creatureTypeTablesCopy = foundry.utils.deepClone(this.creatureTypeTables);
    
    // Save the settings
    await game.settings.set('lootable', 'creatureTypeTables', creatureTypeTablesCopy);
    
    if (this.enableDebug) {
        console.log(`%cLootable DEBUG |%c Settings saved, rendering form`, 'color: #940000;', 'color: inherit');
    }
    
    // Re-render the form
    this.render();
  }

  async _updateObject(_event, formData) {
    if (this.enableDebug) console.log(`%cLootable DEBUG |%c Saving form data:`, 'color: #940000;', 'color: inherit', formData);
    
    // Handle all form data except creatureTypeTables
    for (let [key, value] of Object.entries(formData)) {
        if (key !== 'creatureTypeTables') {
            if (this.enableDebug) console.log(`%cLootable DEBUG |%c Setting ${key} to ${value}`, 'color: #940000;', 'color: inherit');
            await game.settings.set('lootable', key, value);
        }
    }
  }
}

class AddCreatureTypeForm extends FormApplication {
  constructor(creatureTypeTables, callback) {
    super();
    this.creatureTypeTables = creatureTypeTables;
    this.callback = callback;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.Title'),
      template: 'modules/lootable/templates/addCreatureType.hbs',
      width: 400,
      height: 'auto',
      classes: ['lootable', 'add-creature-type-form'],
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  async getData() {
    return {};
  }

  async _updateObject(_event, formData) {
    // Check if an entry with the same type, subtype, and CR range already exists
    let duplicate = this.creatureTypeTables.entries.some(e => 
      e.type === formData.newCreatureType && 
      e.subtype === formData.newCreatureSubtype && 
      e.crRange[0] === parseInt(formData.newCreatureCRMin) && 
      e.crRange[1] === parseInt(formData.newCreatureCRMax)
    );
    
    if (duplicate) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.DuplicateEntry'));
      return;
    }
    
    // Create the new entry
    let newEntry = {
      type: formData.newCreatureType,
      subtype: formData.newCreatureSubtype || "",
      crRange: [parseInt(formData.newCreatureCRMin), parseInt(formData.newCreatureCRMax)],
      tableId: ""
    };
    
    // Call the callback with the new entry
    if (this.callback) {
      this.callback(newEntry);
    }
  }
}