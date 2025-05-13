export class RandomLoot {
  
  static registerHandlebarsHelpers() {
    Handlebars.registerHelper('add', function(value) {
      return parseInt(value) + 1;
    });
    Handlebars.registerHelper('subtract', function(total, index) {
      return total - index;
    });
  }

  static debug(message, error = null) {
    if (!game.settings.get('lootable', 'enableDebug')) return;
    console.log('%cLootable DEBUG |%c [RL] ' + message, 'color: #940000;', 'color: inherit');
    if (error) console.error(error);
  }

  static getCreatureInfo(actor) {
    let creatureType = '';
    let typeData = actor.system?.details?.type;
    if (typeData) {
      if (typeData.value === 'custom' && typeData.custom) {
        creatureType = typeData.custom;
      } else if (typeData.value) {
        creatureType = typeData.value || '';
      } else {
        creatureType = actor.system?.details?.race || '';
      }
    }
    let creatureSubtype = actor.system?.details?.type?.subtype || '';
    let treasureType = '';
    if (actor.system?.details?.treasure?.value instanceof Set) {
      let treasureValues = Array.from(actor.system.details.treasure.value.values());
      treasureType = treasureValues.join(',');
    }    
    let cr = actor.system?.details?.cr || 0;
    return { creatureType, creatureSubtype, treasureType, cr };
  }

  static findMatchingTable(actor, creatureInfo) {
    const { creatureType, creatureSubtype, treasureType, cr } = creatureInfo;
    if (!creatureType) {
      return null;
    }    
    let creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    if (!creatureTypeTables?.entries?.length) {
      return null;
    }    
    let matchingEntry = this.findMatchingTableEntry(creatureType, creatureSubtype, treasureType, cr, creatureTypeTables.entries);
    if (matchingEntry) {
      let tableId = matchingEntry.tableId;
      let table = tableId ? game.tables.get(tableId) : null;      
      if (table) {
        this.debug('Rolling on table: \'' + table.name + '\' (' + table.id + ')');
        return table;
      } else {
        this.debug('Table ID ' + tableId + ' not found');
        return null;
      }
    } else {
      this.debug('No matching table found for this token');
      return null;
    }
  }

  static async onCreateToken(tokenDoc, options, userId) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    let disableRandomLoot = game.settings.get('lootable', 'disableRandomLoot');
    let hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    let showRandomLootPrompt = game.settings.get('lootable', 'showRandomLootPrompt');
    let randomLootMode = game.settings.get('lootable', 'randomLootMode');
    if (!game.user.isGM || game.userId !== userId) {
        return;
    }    
    if (disableRandomLoot) {
        return;
    }
    if (randomLootMode === 'manualOnly') {
        return;
    }    
    if (!tokenDoc.actor) {
        return;
    }    
    let creatureInfo = this.getCreatureInfo(tokenDoc.actor);
    this.debug('Token: ' + tokenDoc.name + ' | Type: ' + creatureInfo.creatureType + 
               ', Subtype: ' + creatureInfo.creatureSubtype + 
               ', Treasure Type: ' + creatureInfo.treasureType + 
               ', CR: ' + creatureInfo.cr);
    let table = this.findMatchingTable(tokenDoc.actor, creatureInfo);
    if (!table) return;
    if (showRandomLootPrompt) {
        await RandomLoot.showPrompt(tokenDoc, table);
    } else {
        let results = await RandomLoot.rollTable(table);
        if (!results || !results.length) {
            return;
        }        
        let consolidatedItems = await RandomLoot.addItemsToActor(tokenDoc.actor, results);
        if (!hideRandomLootChatMsg) {
            await RandomLoot.sendLootMessage(tokenDoc.actor, consolidatedItems || results);
        }
    }
  }
  
  static async showPrompt(tokenDoc, table) {
    let currentResults = [];
    let allResults = [];
    let tokenName = tokenDoc.name;
    let tokenImg = tokenDoc.document ? 
      (tokenDoc.document.texture?.src || tokenDoc.document.img) : 
      (tokenDoc.texture?.src || tokenDoc.img);    
    let dialog = new Dialog({
      title: game.i18n.localize('LOOTABLE.RandomLootPrompt.Title'),
      content: await renderTemplate('modules/lootable/templates/rndltPrompt.hbs', {
        token: {
          name: tokenName,
          img: tokenImg
        },
        table,
        allResults
      }),
      buttons: {},
      render: (html) => {
        let updateContent = async () => {
          let content = await renderTemplate('modules/lootable/templates/rndltPrompt.hbs', {
            token: {
              name: tokenName,
              img: tokenImg
            },
            table,
            allResults
          });
          dialog.data.content = content;
          dialog.render(true);
        };
        html.find('.roll-button').click(async (event) => {
          event.preventDefault();
          currentResults = await RandomLoot.rollTable(table);
          if (!currentResults || !currentResults.length) {
            return;
          }
          allResults.unshift(currentResults);
          await updateContent();
        });
        html.find('.reroll-button').click(async (event) => {
          event.preventDefault();
          if (!allResults.length) return;
          currentResults = await RandomLoot.rollTable(table);
          if (!currentResults || !currentResults.length) {
            return;
          }
          allResults[0] = currentResults;
          await updateContent();
        });
        html.find('.clear-button').click(async (event) => {
          event.preventDefault();
          allResults = [];
          currentResults = [];
          await updateContent();
        });
        html.find('button:contains("Accept")').click(async () => {
          if (!allResults || !allResults.length) return;
          let flatResults = allResults.flat();
          let consolidatedItems = await RandomLoot.addItemsToActor(tokenDoc.actor, flatResults);
          if (!game.settings.get('lootable', 'hideRandomLootChatMsg')) {
            await RandomLoot.sendLootMessage(tokenDoc.actor, consolidatedItems || flatResults);
          }          
          dialog.close();
        });
        html.find('button:contains("Cancel")').click(() => dialog.close());
        html.find('form').submit((ev) => ev.preventDefault());
      },
      close: () => {}
    }, {
      width: 400,
      height: 'auto',
      classes: ['rndlt-prompt-dialog']
    });
    dialog.render(true);
  }
  
  static logTableRollError(error, usingBetterTables = true) {
    const source = usingBetterTables ? 'Better Tables' : 'Standard Tables';
    this.debug('Table roll error with ' + source + ':', error);
  }
  static async processRollResults(results, source = "Unknown") {
    let processedResults = {
      items: [],
      textResults: []
    };
    for (let result of results) {
      try {
        if (this.isTextEntry(result)) {
          let text = result.text || result.data?.text || '';
          processedResults.textResults.push({
            text: text,
            isText: true
          });
          continue;
        }
        let documentId = result.documentId || result.resultId || result.data?.resultId || result._id;
        let resultObj = {
          documentCollection: result.documentCollection || result.collection || result.data?.collection,
          documentId: documentId,
          text: result.text
        };        
        let item = await this.getItem(resultObj);
        if (item) {
          let itemData = item.toObject();
          if (result.hasOwnProperty('quantity')) {
            itemData.system.quantity = result.quantity;
          } else {
            itemData.system.quantity = 1;
          }
          processedResults.items.push(itemData);
        } else {
          this.debug(`[${source}] Item not found: ${result.text || documentId}`);          
          if (result.text) {
            processedResults.textResults.push({
              text: result.text,
              isText: true
            });
          }
        }
      } catch (error) {
        this.debug(`[${source}] Error processing result`, error);
      }
    }
    return [...processedResults.items, ...processedResults.textResults];
  }
  
  static async rollWithBetterTables(table) {
    try {
      let brt = game.modules.get('better-rolltables');
      if (!brt?.api) {
        return await this.rollWithoutBetterTables(table);
      }
      let betterResults = await brt.api.betterTableRoll(table, {
        displayChat: false,
        rollMode: 'gmroll'
      });      
      return await this.processRollResults(betterResults, "Better Tables");
    } catch (error) {
      this.logTableRollError(error, true);
      return await this.rollWithoutBetterTables(table);
    }
  }
  
  static isTextEntry(result) {
    if (result.type === 'text' || result.documentType === 'Text' || result.data?.type === 'text') {
      return true;
    }
    if (result.text && (!result.documentId && !result.documentCollection)) {
      return true;
    }    
    let collection = result.documentCollection || result.collection || result.data?.collection;
    if (!collection && result.text) {
      return true;
    }    
    return false;
  }
  
  static async getItem(result) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    try {
      if (result.documentId) {
        let item = game.items.get(result.documentId);
        if (item) {
          return item;
        }        
        for (let pack of game.packs) {
          if (pack.documentName === 'Item') {
            let packItem = await pack.getDocument(result.documentId);
            if (packItem) {
              return packItem;
            }
          }
        }
      }
      if (result.text) {
        let item = game.items.getName(result.text);
        if (item) {
          return item;
        }
        for (let pack of game.packs) {
          if (pack.documentName === 'Item') {
            let index = await pack.getIndex();
            let entry = index.find(e => e.name === result.text);
            if (entry) {
              let packItem = await pack.getDocument(entry._id);
              if (packItem) {
                return packItem;
              }
            }
          }
        }
      }      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  static async rollWithoutBetterTables(table) {
    try {
      let roll = await table.draw({displayChat: false});
      let rollResults = [];
      if (Array.isArray(roll.results)) {
        rollResults = roll.results;
      } 
      else if (roll.results && typeof roll.results.contents !== 'undefined') {
        rollResults = roll.results.contents;
      }
      else if (roll.collection && Array.isArray(roll.collection)) {
        rollResults = roll.collection;
      }
      else if (roll.results && roll.results.forEach) {
        rollResults = [];
        roll.results.forEach(r => rollResults.push(r));
      }
      return await this.processRollResults(rollResults, "Standard Tables");
    } catch (error) {
      this.logTableRollError(error, false);
      return null;
    }
  }
  
  static async rollTable(table) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    if (game.modules.get('better-rolltables')?.active) {
        return await this.rollWithBetterTables(table);
    } else {
        return await this.rollWithoutBetterTables(table);
    }
  }
  
  static async addItemsToActor(actor, items) {
    if (!items.length) return [];
    let itemsToAdd = items.filter(item => !item.isText);
    let textEntries = items.filter(item => item.isText);
    if (!itemsToAdd.length && !textEntries.length) return items;
    let groupedItems = {};
    for (let item of itemsToAdd) {
        let key = item.name;
        if (!groupedItems[key]) {
            groupedItems[key] = foundry.utils.deepClone(item);
        } else {
            groupedItems[key].system.quantity += item.system.quantity || 1;
        }
    }    
    let consolidatedItems = Object.values(groupedItems);
    await actor.createEmbeddedDocuments('Item', consolidatedItems);
    let totalItemCount = itemsToAdd.length;
    let uniqueItemCount = consolidatedItems.length;
    let textCount = textEntries.length;
    let debugMessage = 'Added to ' + actor.name + ': ' + totalItemCount + ' total items consolidated into ' + uniqueItemCount + ' unique items';
    if (textCount > 0) {
        debugMessage += ' | ' + textCount + ' text entries found';
    }    
    if (uniqueItemCount > 0) {
        let itemList = consolidatedItems.map(item => 
            item.name + ' (' + (item.system.quantity || 1) + ')'
        ).join(', ');
        debugMessage += ' | Items: ' + itemList;
    }    
    if (textCount > 0) {
        let textList = textEntries.map(entry => entry.text).join(', ');
        debugMessage += ' | Text: ' + textList;
    }    
    this.debug(debugMessage);
    return items;
  }
  
  static async sendLootMessage(actor, results) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;    
    let textEntries = results.filter(item => item.isText);
    let itemResults = results.filter(item => !item.isText);
    let groupedItems = {};
    for (let item of itemResults) {
        let key = item.name;
        if (!groupedItems[key]) {
            groupedItems[key] = {
                name: item.name,
                img: item.img,
                quantity: item.system.quantity || 1
            };
        } else {
            groupedItems[key].quantity += item.system.quantity || 1;
        }
    }
    let itemsToDisplay = Object.values(groupedItems);
    let groupedTextEntries = {};
    for (let entry of textEntries) {
        let key = entry.text;
        if (!groupedTextEntries[key]) {
            groupedTextEntries[key] = {
                text: entry.text,
                isText: true,
                quantity: 1
            };
        } else {
            groupedTextEntries[key].quantity += 1;
        }
    }    
    let consolidatedTextEntries = Object.values(groupedTextEntries);
    let token = actor.token;
    let tokenName = token ? token.name : actor.name;
    let content = await renderTemplate('modules/lootable/templates/lootableMessage.hbs', {
        tokenName: tokenName,
        isCoinMessage: false,
        items: itemsToDisplay,
        textEntries: consolidatedTextEntries
    });    
    ChatMessage.create({
        content: content,
        whisper: ChatMessage.getWhisperRecipients('GM'),
        flags: { 'lootable': { randomLootGenerated: true } }
    });
  }

  static canUserRollLoot(user) {
    return user.isGM;
  }

  static canTokenReceiveLoot(token) {
    if (!token.actor) return false;
    if (!token.actor.type === 'npc') return false;
    let cr = token.actor.system?.details?.cr;
    if (cr === undefined || cr === null) return false;
    let creatureInfo = this.getCreatureInfo(token.actor);
    if (!creatureInfo.creatureType) return false;
    let table = this.findMatchingTable(token.actor, creatureInfo);
    return !!table;
  }

  static findMatchingTableEntry(creatureType, creatureSubtype, treasureType, cr, entries) {
    if (!entries?.length) return null;
    for (let entry of entries) {
      if (!entry.tableId) continue;
      if (entry.type && entry.type !== '') {
        let entryTypes = entry.type.toLowerCase().split(',').map(t => t.trim());
        let tokenTypes = creatureType.toLowerCase().split(',').map(t => t.trim());
        let hasMatchingType = entryTypes.some(entryType => 
          tokenTypes.some(tokenType => tokenType === entryType)
        );        
        if (!hasMatchingType) continue;
      }
      if (entry.subtype && entry.subtype !== '') {
        let entrySubtypes = entry.subtype.toLowerCase().split(',').map(s => s.trim());
        let tokenSubtypes = creatureSubtype.toLowerCase().split(',').map(s => s.trim());
        let hasMatchingSubtype = entrySubtypes.some(entrySubtype => 
          tokenSubtypes.some(tokenSubtype => tokenSubtype === entrySubtype)
        );        
        if (!hasMatchingSubtype) continue;
      }
      if (entry.treasureType && entry.treasureType !== '') {
        let entryTreasureTypes = entry.treasureType.toLowerCase().split(',').map(t => t.trim());
        let tokenTreasureTypes = treasureType.toLowerCase().split(',').map(t => t.trim());
        let hasMatchingTreasureType = entryTreasureTypes.some(entryTreasureType => 
          tokenTreasureTypes.some(tokenTreasureType => tokenTreasureType === entryTreasureType)
        );        
        if (!hasMatchingTreasureType) continue;
      }
      if (cr < entry.crRange[0] || cr > entry.crRange[1]) continue;
      return entry;
    }
    return null;
  }

  static async handleManualRoll(token) {
    let showRandomLootPrompt = game.settings.get('lootable', 'showRandomLootPrompt');
    let hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    if (!this.canTokenReceiveLoot(token)) {
      this.debug('Token ' + token.name + ' is not valid for random loot');
      return;
    }    
    let creatureInfo = this.getCreatureInfo(token.actor);
    this.debug('Token: ' + token.name + ' | Type: ' + creatureInfo.creatureType + 
               ', Subtype: ' + creatureInfo.creatureSubtype + 
               ', Treasure Type: ' + creatureInfo.treasureType + 
               ', CR: ' + creatureInfo.cr);    
    let table = this.findMatchingTable(token.actor, creatureInfo);
    if (!table) return;
    if (showRandomLootPrompt) {
      await this.showPrompt(token, table);
    } else {
      let results = await this.rollTable(table);
      if (!results || !results.length) {
        return;
      }      
      let consolidatedItems = await this.addItemsToActor(token.actor, results);
      if (!hideRandomLootChatMsg) {
        await this.sendLootMessage(token.actor, consolidatedItems || results);
      }
    }
  }
}
