export class RandomLootSettingsForm extends FormApplication {
  constructor(...args) {
    super(...args);
    
    this.creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    this.enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    this.disableRandomLoot = game.settings.get('lootable', 'disableRandomLoot');
    this.hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    this.showRandomLootPrompt = game.settings.get('lootable', 'showRandomLootPrompt');
    this.hideRandomLootHUD = game.settings.get('lootable', 'hideRandomLootHUD');
    
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
      template: 'modules/lootable/templates/randomLoot.hbs',
      classes: ['random-loot-settings'],
      width: 900,
      height: 'auto',
      tabs: [{
        navSelector: '.tabs',
        contentSelector: '.content',
        initial: 'creature-types'
      }]
    });
  }

  async getData() {
    return {
      settings: {
        disableRandomLoot: game.settings.get('lootable', 'disableRandomLoot'),
        showRandomLootPrompt: game.settings.get('lootable', 'showRandomLootPrompt'),
        hideRandomLootChatMsg: game.settings.get('lootable', 'hideRandomLootChatMsg'),
        randomLootMode: game.settings.get('lootable', 'randomLootMode'),
        hideRandomLootHUD: game.settings.get('lootable', 'hideRandomLootHUD')
      },
      creatureTypes: this.creatureTypeTables.entries.map((entry, index) => ({
        ...entry,
        index,
        tableName: entry.tableId ? game.tables.get(entry.tableId)?.name || game.i18n.localize('LOOTABLE.RandomLootSettings.MissingTable') : game.i18n.localize('LOOTABLE.RandomLootSettings.NoTable')
      }))
    };
  }

  async _mapCreatureTypeEntry(entry, index) {
    let mappedEntry = foundry.utils.deepClone(entry);
    mappedEntry.index = index;
    
    if (!mappedEntry.tableId) {
        mappedEntry.tableName = game.i18n.localize('LOOTABLE.RandomLootSettings.NoTable');
        return mappedEntry;
    }
    
    let table = game.tables.get(mappedEntry.tableId);
    
    if (table) {
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
    html.find('.close-button').click(() => this.close());
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
    let { creatureType, creatureSubtype, treasureType, crRangeStart, crRangeEnd } = button.dataset;
    
    const crStart = parseInt(crRangeStart);
    const crEnd = parseInt(crRangeEnd);
    
    let currentTableId = "";
    let entryIndex = this.creatureTypeTables.entries.findIndex(e => {
        if (e.crRange[0] !== crStart || e.crRange[1] !== crEnd) return false;
        
        const entryType = e.type?.toLowerCase() || '';
        const entrySubtype = e.subtype?.toLowerCase() || '';
        const entryTreasureType = e.treasureType?.toLowerCase() || '';
        
        const buttonType = creatureType?.toLowerCase() || '';
        const buttonSubtype = creatureSubtype?.toLowerCase() || '';
        const buttonTreasureType = treasureType?.toLowerCase() || '';
        
        if (entryType !== buttonType) return false;
        if (entrySubtype !== buttonSubtype) return false;
        if (entryTreasureType !== buttonTreasureType) return false;
        
        return true;
    });
    
    if (entryIndex !== -1) {
        currentTableId = this.creatureTypeTables.entries[entryIndex].tableId || "";
    } else if (this.enableDebug) {
        console.log(`%cLootable DEBUG |%c No entry found for ${creatureType}, ${creatureSubtype}, ${treasureType}, ${crRangeStart}-${crRangeEnd}`, 'color: #940000;', 'color: inherit');
    }
    
    let tables = [{
        id: "",
        name: game.i18n.localize('LOOTABLE.RandomLootSettings.NoTable'),
        selected: currentTableId === ""
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
        if (a.id === "") return -1;
        if (b.id === "") return 1;
        return a.name.localeCompare(b.name);
    });
    
    const content = await renderTemplate('modules/lootable/templates/tableSelector.hbs', {
      tables: tables
    });
    
    new Dialog({
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.TableSelector.Title'),
      content: content,
      classes: ['table-selector-dialog'],
      resizable: true,
      height: 500,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('LOOTABLE.RandomLootSettings.TableSelector.Confirm'),
          callback: (html) => {
            const form = html.find('form')[0];
            const tableId = form.selectedTable?.value || "";
            
            if (entryIndex !== -1) {
              this.creatureTypeTables.entries[entryIndex].tableId = tableId;
              this._updateAndRender();
            } else if (this.enableDebug) {
              console.log(`%cLootable DEBUG |%c Entry not found for creature type: ${creatureType}, subtype: ${creatureSubtype}, treasure type: ${treasureType}, CR: ${crRangeStart}-${crRangeEnd}`, 'color: #940000;', 'color: inherit');
            }
          }
        }
      },
      default: "confirm",
      render: (html) => {
        const tableList = html.find('.table-list')[0];
        if (tableList) {
          $(tableList).css('max-height', '350px').css('overflow-y', 'auto');
          
          const selectedRadio = html.find('input[type="radio"]:checked')[0];
          if (selectedRadio) {
            setTimeout(() => {
              selectedRadio.scrollIntoView({ block: 'center' });
            }, 50);
          }
        }
      }
    }).render(true);
  }

  async _onEditCreatureType(event) {
    event.preventDefault();
    let button = event.currentTarget;
    let { creatureType, creatureSubtype, treasureType, crRangeStart, crRangeEnd } = button.dataset;
    
    const crStart = parseInt(crRangeStart);
    const crEnd = parseInt(crRangeEnd);
    
    let entryIndex = this.creatureTypeTables.entries.findIndex(e => {
        if (e.crRange[0] !== crStart || e.crRange[1] !== crEnd) return false;
        
        const entryType = e.type?.toLowerCase() || '';
        const entrySubtype = e.subtype?.toLowerCase() || '';
        const entryTreasureType = e.treasureType?.toLowerCase() || '';
        
        const buttonType = creatureType?.toLowerCase() || '';
        const buttonSubtype = creatureSubtype?.toLowerCase() || '';
        const buttonTreasureType = treasureType?.toLowerCase() || '';
        
        if (entryType !== buttonType) return false;
        if (entrySubtype !== buttonSubtype) return false;
        if (entryTreasureType !== buttonTreasureType) return false;
        
        return true;
    });
    
    if (entryIndex === -1) {
        if (this.enableDebug) console.log(`%cLootable DEBUG |%c Could not find entry for Type: ${creatureType}, Subtype: ${creatureSubtype}, Treasure Type: ${treasureType}, CR: ${crRangeStart}-${crRangeEnd}`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    let entry = this.creatureTypeTables.entries[entryIndex];
    
    new EditCreatureTypeForm(
      this.creatureTypeTables,
      entry,
      entryIndex,
      async (updatedEntry) => {
        this.creatureTypeTables.entries[entryIndex] = updatedEntry;
        await this._updateAndRender();
      }
    ).render(true);
  }

  async _onDeleteCreatureType(event) {
    event.preventDefault();
    let button = event.currentTarget;
    
    let tr = button.closest('.creature-type-entry');
    let index = parseInt(tr.dataset.index);
    
    if (isNaN(index) || index < 0 || index >= this.creatureTypeTables.entries.length) {
      console.error(`Invalid index: ${index}`);
      return;
    }
    
    let entry = this.creatureTypeTables.entries[index];
    let creatureType = entry?.type || 'Unknown';
    let creatureSubtype = entry?.subtype || '';
    let treasureType = entry?.treasureType || '';
    let crRangeStart = entry?.crRange?.[0] || 0;
    let crRangeEnd = entry?.crRange?.[1] || 0;
    
    let confirmContent = game.i18n.format('LOOTABLE.RandomLootSettings.RemoveCreatureType.ConfirmContent', {
      type: creatureType,
      subtype: creatureSubtype,
      treasureType: treasureType,
      crRange: `${crRangeStart}-${crRangeEnd}`
    });
    
    let confirmed = await Dialog.confirm({
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.RemoveCreatureType.Title'),
      content: confirmContent,
      yes: () => true,
      no: () => false,
      defaultYes: true
    });
    
    if (confirmed) {
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
    
    let temp = this.creatureTypeTables.entries[index];
    this.creatureTypeTables.entries[index] = this.creatureTypeTables.entries[index + 1];
    this.creatureTypeTables.entries[index + 1] = temp;
    
    await this._updateAndRender();
  }

  async _updateAndRender() {
    let creatureTypeTablesCopy = foundry.utils.deepClone(this.creatureTypeTables);
    
    await game.settings.set('lootable', 'creatureTypeTables', creatureTypeTablesCopy);
    
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

class AddCreatureTypeForm extends FormApplication {
  constructor(creatureTypeTables, callback) {
    super();
    this.creatureTypeTables = creatureTypeTables;
    this.callback = callback;
    this.enableDebug = game.settings.get('lootable', 'enableDebug') || false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.Title'),
      template: 'modules/lootable/templates/addCreatureType.hbs',
      classes: ['add-creature-type-form'],
      width: 400,
      height: 'auto',
      submitOnChange: false,
      closeOnSubmit: false
    });
  }

  async getData() {
    return {};
  }

  async _updateObject(_event, formData) {
    let type = formData.newCreatureType?.toLowerCase() || '';
    let subtype = formData.newCreatureSubtype?.toLowerCase() || '';
    let treasureType = formData.newCreatureTreasureType?.toLowerCase() || '';
    let crMin = parseInt(formData.newCreatureCRMin);
    let crMax = parseInt(formData.newCreatureCRMax);
    
    if (crMin > crMax) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.InvalidCRRange'));
      return;
    }
    
    let duplicate = this.creatureTypeTables.entries.some(e => {
        const eType = e.type?.toLowerCase() || '';
        const eSubtype = e.subtype?.toLowerCase() || '';
        const eTreasureType = e.treasureType?.toLowerCase() || '';
        
        return eType === type && 
               eSubtype === subtype && 
               eTreasureType === treasureType && 
               e.crRange[0] === crMin && 
               e.crRange[1] === crMax;
    });
    
    if (duplicate) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.DuplicateEntry'));
      return;
    }
    
    let newEntry = {
      type,
      subtype,
      treasureType,
      crRange: [crMin, crMax],
      tableId: ""
    };
    
    if (this.callback) {
      await this.callback(newEntry);
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

class EditCreatureTypeForm extends FormApplication {
  constructor(creatureTypeTables, entry, entryIndex, callback) {
    super();
    this.creatureTypeTables = creatureTypeTables;
    this.entry = entry;
    this.entryIndex = entryIndex;
    this.callback = callback;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('LOOTABLE.RandomLootSettings.EditCreatureType.Title'),
      template: 'modules/lootable/templates/editCreatureType.hbs',
      classes: ['edit-creature-type-form'],
      width: 400,
      height: 'auto',
      submitOnChange: false,
      closeOnSubmit: false
    });
  }

  async getData() {
    return {
      type: this.entry.type,
      subtype: this.entry.subtype || '',
      treasureType: this.entry.treasureType || '',
      crRangeStart: this.entry.crRange[0],
      crRangeEnd: this.entry.crRange[1]
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    html.find('.close-button').click(() => this.close({ force: true }));
  }

  async _updateObject(_event, formData) {
    let type = formData.editCreatureType?.toLowerCase() || '';
    let subtype = formData.editCreatureSubtype?.toLowerCase() || '';
    let treasureType = formData.editCreatureTreasureType?.toLowerCase() || '';
    let crMin = parseInt(formData.editCreatureCRMin);
    let crMax = parseInt(formData.editCreatureCRMax);
    
    if (crMin > crMax) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.InvalidCRRange'));
      return;
    }
    
    let duplicate = this.creatureTypeTables.entries.some((e, i) => {
      if (i === this.entryIndex) return false;
      
      const eType = e.type?.toLowerCase() || '';
      const eSubtype = e.subtype?.toLowerCase() || '';
      const eTreasureType = e.treasureType?.toLowerCase() || '';
      
      return eType === type && 
             eSubtype === subtype && 
             eTreasureType === treasureType && 
             e.crRange[0] === crMin && 
             e.crRange[1] === crMax;
    });
    
    if (duplicate) {
      ui.notifications.error(game.i18n.localize('LOOTABLE.RandomLootSettings.AddCreatureType.DuplicateEntry'));
      return;
    }
    
    if (this.callback) {
      await this.callback({
        ...this.entry,
        type,
        subtype,
        treasureType,
        crRange: [crMin, crMax]
      });
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