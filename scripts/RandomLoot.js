export class RandomLoot {
  static async onCreateToken(tokenDoc, options, userId) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    let disableRandomLoot = game.settings.get('lootable', 'disableRandomLoot');
    let hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    
    if (!game.user.isGM || game.userId !== userId) {
        return;
    }
    
    if (disableRandomLoot) {
        return;
    }
    
    if (!tokenDoc.actor) {
        return;
    }
    
    let creatureType = tokenDoc.actor.system?.details?.type?.value || tokenDoc.actor.system?.details?.race || "";
    let creatureSubtype = tokenDoc.actor.system?.details?.type?.subtype || "";
    let cr = tokenDoc.actor.system?.details?.cr || 0;
    
    if (enableDebug) {
        console.log(`%cLootable DEBUG |%c Processing token: ${tokenDoc.name} | Type: ${creatureType}, Subtype: ${creatureSubtype}, CR: ${cr}`, 'color: #940000;', 'color: inherit');
    }
    
    if (!creatureType) {
        return;
    }
    
    let creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    if (!creatureTypeTables?.entries?.length) {
        return;
    }
    
    let matchingEntry = null;
    for (let entry of creatureTypeTables.entries) {
        if (!entry.tableId) continue;
        
        if (entry.type !== creatureType) continue;
        
        if (entry.subtype && entry.subtype !== creatureSubtype) continue;
        
        if (cr < entry.crRange[0] || cr > entry.crRange[1]) continue;
        
        matchingEntry = entry;
        break;
    }
    
    if (!matchingEntry) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c No matching table found for ${creatureType} (${creatureSubtype}) CR ${cr}`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    let tableId = matchingEntry.tableId;
    let table = tableId ? game.tables.get(tableId) : null;
    
    if (enableDebug) {
        if (!tableId) {
            console.log(`%cLootable DEBUG |%c Table validation failed: No table ID in matching entry`, 'color: #940000;', 'color: inherit');
            return;
        } else if (!table) {
            console.log(`%cLootable DEBUG |%c Table validation failed: Table ID ${tableId} not found`, 'color: #940000;', 'color: inherit');
            return;
        }
    } else {
        if (!tableId || !table) return;
    }
    
    let results = await RandomLoot.rollTable(table);
    if (!results || !results.length) {
        return;
    }
    
    const consolidatedItems = await RandomLoot.addItemsToActor(tokenDoc.actor, results);
    
    if (!hideRandomLootChatMsg) {
        await RandomLoot.sendLootMessage(tokenDoc.actor, consolidatedItems || results);
    }
  }
  
  static logTableRollError(error, usingBetterTables = true) {
    const enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    if (enableDebug) {
        const context = usingBetterTables ? "with Better Tables" : "without Better Tables";
        console.error(`%cLootable DEBUG |%c Error rolling ${context}:`, 'color: #940000;', 'color: inherit', error);
    }
  }
  
  static async rollWithBetterTables(table) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    try {
      const brt = game.modules.get('better-rolltables');
      if (!brt?.api) {
        return await this.rollWithoutBetterTables(table);
      }
      
      let betterResults = await brt.api.betterTableRoll(table, {
        displayChat: false,
        rollMode: 'gmroll'
      });
      
      let processedResults = {
        items: [],
        textResults: []
      };
      
      for (let result of betterResults) {
        try {
          const isTextEntry = this.isTextEntry(result);
          
          if (isTextEntry) {
            const text = result.text || result.data?.text || '';
            if (enableDebug) console.log(`%cLootable DEBUG |%c [Better Tables] Found text entry: ${text}`, 'color: #940000;', 'color: inherit');
            processedResults.textResults.push({
              text: text,
              isText: true
            });
            continue;
          }
          
          let item = await this.getItem(result);
          if (item) {
            let itemData = item.toObject();
            itemData.system.quantity = result.hasOwnProperty('quantity') ? result.quantity : 1;
            processedResults.items.push(itemData);
          } else {
            if (enableDebug) console.log(`%cLootable DEBUG |%c [Better Tables] Item not found: ${result.text || result.documentId}`, 'color: #940000;', 'color: inherit');
            
            if (result.text) {
              processedResults.textResults.push({
                text: result.text,
                isText: true
              });
            }
          }
        } catch (itemError) {
          if (enableDebug) console.error(`%cLootable DEBUG |%c Error processing item from Better Roll Tables:`, 'color: #940000;', 'color: inherit', itemError);
        }
      }
      
      return [...processedResults.items, ...processedResults.textResults];
    } catch (error) {
      this.logTableRollError(error, true);
      return await this.rollWithoutBetterTables(table);
    }
  }
  
  static isTextEntry(result) {
    if (result.text && (!result.documentId && !result.documentCollection)) {
      return true;
    }
    
    if (result.type === 'text' || result.data?.type === 'text') {
      return true;
    }
    
    const collection = result.documentCollection || result.collection || result.data?.collection;
    if (!collection && result.text) {
      return true;
    }
    
    if (result.documentType === 'Text' || result.type === 'Text') {
      return true;
    }
    
    const text = result.text || result.data?.text;
    const documentId = result.documentId || result.resultId || result.data?.resultId || result._id;
    
    if (text && !documentId) {
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
            try {
              const packItem = await pack.getDocument(result.documentId);
              if (packItem) {
                return packItem;
              }
            } catch (e) {
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
            try {
              const index = await pack.getIndex();
              const entry = index.find(e => e.name === result.text);
              if (entry) {
                const packItem = await pack.getDocument(entry._id);
                if (packItem) {
                  return packItem;
                }
              }
            } catch (e) {
            }
          }
        }
      }
      
      if (enableDebug) console.log(`%cLootable DEBUG |%c [Item Lookup] Item not found: ${result.text || result.documentId}`, 'color: #940000;', 'color: inherit');
      return null;
    } catch (error) {
      if (enableDebug) console.error(`%cLootable DEBUG |%c Error getting item:`, 'color: #940000;', 'color: inherit', error);
      return null;
    }
  }
  
  static async rollWithoutBetterTables(table) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    try {
        let roll = await table.draw({displayChat: false});
        
        let results = {
            items: [],
            textResults: []
        };
        
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
        
        for (let r of rollResults) {
            if (this.isTextEntry(r)) {
                const text = r.text || r.data?.text || '';
                if (enableDebug) console.log(`%cLootable DEBUG |%c Found text entry: ${text}`, 'color: #940000;', 'color: inherit');
                results.textResults.push({
                    text: text,
                    isText: true
                });
                continue;
            }
            
            let documentCollection = r.documentCollection || r.collection || r.data?.collection || null;
            let documentId = r.documentId || r.resultId || r.data?.resultId || r._id || null;
            
            if (!documentCollection) {
                continue;
            }
            
            let resultObj = {
                documentCollection: documentCollection,
                documentId: documentId
            };
            
            let item = await this.getItem(resultObj);
            if (!item) {
                if (r.text) {
                    results.textResults.push({
                        text: r.text,
                        isText: true
                    });
                }
                continue;
            }
            
            let itemData = item.toObject();
            
            itemData.system.quantity = 1;
            
            results.items.push(itemData);
        }
        
        return [...results.items, ...results.textResults];
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
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    if (!items.length) return [];
    
    try {
        const itemsToAdd = items.filter(item => !item.isText);
        
        if (!itemsToAdd.length) return items;
        
        let groupedItems = {};
        for (let item of itemsToAdd) {
            const key = item.name;
            if (!groupedItems[key]) {
                groupedItems[key] = foundry.utils.deepClone(item);
            } else {
                groupedItems[key].system.quantity += item.system.quantity || 1;
            }
        }
        
        const consolidatedItems = Object.values(groupedItems);
        
        if (enableDebug) {
            const itemList = consolidatedItems.map(item => 
                `${item.name} (${item.system.quantity || 1})`
            ).join(', ');
            
            console.log(`%cLootable DEBUG |%c Consolidated ${itemsToAdd.length} items into ${consolidatedItems.length} unique items for ${actor.name} | Items: ${itemList}`, 'color: #940000;', 'color: inherit');
        }
        
        await actor.createEmbeddedDocuments('Item', consolidatedItems);
        
        return items;
    } catch (error) {
        if (enableDebug) console.error(`%cLootable DEBUG |%c Error adding items to ${actor.name}:`, 'color: #940000;', 'color: inherit', error);
        return items;
    }
  }
  
  static async sendLootMessage(actor, results) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    const textEntries = results.filter(item => item.isText);
    const itemResults = results.filter(item => !item.isText);
    
    // Consolidate items for the chat message
    let groupedItems = {};
    for (let item of itemResults) {
        const key = item.name;
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
    
    const itemsToDisplay = Object.values(groupedItems);
    
    if (enableDebug && itemResults.length > 0) {
        const itemList = itemsToDisplay.map(item => 
            `${item.name} (${item.quantity})`
        ).join(', ');
        
        console.log(`%cLootable DEBUG |%c Consolidated ${itemResults.length} items into ${itemsToDisplay.length} unique items for chat message | Items: ${itemList}`, 'color: #940000;', 'color: inherit');
    }
    
    // Consolidate text entries
    let groupedTextEntries = {};
    for (let entry of textEntries) {
        const key = entry.text;
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
    
    const consolidatedTextEntries = Object.values(groupedTextEntries);
    
    if (enableDebug && textEntries.length > 0) {
        const textList = consolidatedTextEntries.map(entry => 
            `${entry.text} (${entry.quantity})`
        ).join(', ');
        
        console.log(`%cLootable DEBUG |%c Consolidated ${textEntries.length} text entries into ${consolidatedTextEntries.length} unique entries for ${actor.name} | Text entries: ${textList}`, 'color: #940000;', 'color: inherit');
    }
    
    try {
        let content = await renderTemplate(`modules/lootable/templates/lootMessage.hbs`, {
            actor: {
                name: actor.name,
                img: actor.img
            },
            items: itemsToDisplay,
            textEntries: consolidatedTextEntries
        });
        
        ChatMessage.create({
            content: content,
            whisper: ChatMessage.getWhisperRecipients(`GM`),
            flags: { "lootable": { randomLootGenerated: true } }
        });
    } catch (error) {
        if (enableDebug) console.error(`%cLootable DEBUG |%c Error sending loot message:`, 'color: #940000;', 'color: inherit', error);
    }
  }
}
