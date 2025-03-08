export class RandomLoot {
  static async onCreateToken(tokenDoc, options, userId) {
    // Retrieve all settings at the beginning of the method
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    let disableRandomLoot = game.settings.get('lootable', 'disableRandomLoot');
    let hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    
    // Skip if not GM, if random loot is disabled, or if not the active user
    if (!game.user.isGM || game.userId !== userId) {
        return;
    }
    
    if (disableRandomLoot) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c Random Loot Disabled.`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    // Skip if token doesn't have an actor
    if (!tokenDoc.actor) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c Token has no actor, skipping random loot`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    // Get creature type and CR
    let creatureType = tokenDoc.actor.system?.details?.type?.value || tokenDoc.actor.system?.details?.race || "";
    let creatureSubtype = tokenDoc.actor.system?.details?.type?.subtype || "";
    let cr = tokenDoc.actor.system?.details?.cr || 0;
    
    if (enableDebug) {
        console.log(`%cLootable DEBUG |%c Processing token: ${tokenDoc.name}`, 'color: #940000;', 'color: inherit');
        console.log(`%cLootable DEBUG |%c Creature type: ${creatureType}, Subtype: ${creatureSubtype}, CR: ${cr}`, 'color: #940000;', 'color: inherit');
    }
    
    // Skip if no creature type
    if (!creatureType) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c No creature type found, skipping random loot`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    // Get creature type tables
    let creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    if (!creatureTypeTables?.entries?.length) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c No creature type tables defined, skipping random loot`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    // Find matching entry - entries higher in the list have priority
    let matchingEntry = null;
    for (let entry of creatureTypeTables.entries) {
        // Skip entries with no table ID
        if (!entry.tableId) continue;
        
        // Check if type matches
        if (entry.type !== creatureType) continue;
        
        // Check if subtype matches (if specified)
        if (entry.subtype && entry.subtype !== creatureSubtype) continue;
        
        // Check if CR is in range
        if (cr < entry.crRange[0] || cr > entry.crRange[1]) continue;
        
        // Found a match - since we're iterating in order, the first match has priority
        matchingEntry = entry;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Found matching table: ${JSON.stringify(matchingEntry)}`, 'color: #940000;', 'color: inherit');
        break;
    }
    
    if (!matchingEntry) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c No matching table found for ${creatureType} (${creatureSubtype}) CR ${cr}`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    // Get the table
    let tableId = matchingEntry.tableId;
    if (!tableId) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c No table ID found in matching entry`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    let table = game.tables.get(tableId);
    if (!table) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c Table not found: ${tableId}`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Found table: ${table.name}`, 'color: #940000;', 'color: inherit');
    
    // Roll on the table
    let results = await RandomLoot.rollTable(table);
    if (!results || !results.length) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c No results from table roll`, 'color: #940000;', 'color: inherit');
        return;
    }
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Table results:`, 'color: #940000;', 'color: inherit', results);
    
    // Add items to actor and get the consolidated items
    const consolidatedItems = await RandomLoot.addItemsToActor(tokenDoc.actor, results);
    
    // Send chat message with the consolidated items
    if (!hideRandomLootChatMsg) {
        await RandomLoot.sendLootMessage(tokenDoc.actor, consolidatedItems || results);
    }
  }
  
  static async rollWithBetterTables(table) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Rolling with Better Tables`, 'color: #940000;', 'color: inherit');
    
    try {
      // Get the Better Tables module
      const brt = game.modules.get('better-rolltables');
      if (!brt?.api) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c Better Roll Tables API not found`, 'color: #940000;', 'color: inherit');
        return await this.rollWithoutBetterTables(table);
      }
      
      // Use the betterTableRoll method as in the old implementation
      let betterResults = await brt.api.betterTableRoll(table, {
        displayChat: false,
        rollMode: 'gmroll'
      });
      
      if (enableDebug) console.log(`%cLootable DEBUG |%c Better Roll Tables results:`, 'color: #940000;', 'color: inherit', betterResults);
      
      // Process the results
      let processedResults = {
        items: []
      };
      
      // Process each result using the getItem method
      for (let result of betterResults) {
        try {
          let item = await this.getItem(result);
          if (item) {
            let itemData = item.toObject();
            itemData.system.quantity = result.hasOwnProperty('quantity') ? result.quantity : 1;
            processedResults.items.push(itemData);
          } else {
            if (enableDebug) console.log(`%cLootable DEBUG |%c Item not found: ${result.text || result.documentId}`, 'color: #940000;', 'color: inherit');
          }
        } catch (itemError) {
          if (enableDebug) console.error(`%cLootable DEBUG |%c Error processing item from Better Roll Tables:`, 'color: #940000;', 'color: inherit', itemError);
        }
      }
      
      if (enableDebug) console.log(`%cLootable DEBUG |%c Processed ${processedResults.items.length} items`, 'color: #940000;', 'color: inherit');
      
      return processedResults.items;
    } catch (error) {
      if (enableDebug) console.error(`%cLootable DEBUG |%c Error rolling with Better Tables:`, 'color: #940000;', 'color: inherit', error);
      return await this.rollWithoutBetterTables(table);
    }
  }
  
  static async getItem(result) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    try {
      // First try to find by documentId
      if (result.documentId) {
        // Check in game items
        let item = game.items.get(result.documentId);
        if (item) {
          if (enableDebug) console.log(`%cLootable DEBUG |%c Found item by ID in game items: ${item.name}`, 'color: #940000;', 'color: inherit');
          return item;
        }
        
        // Check in all item packs
        for (let pack of game.packs) {
          if (pack.documentName === 'Item') {
            try {
              const packItem = await pack.getDocument(result.documentId);
              if (packItem) {
                if (enableDebug) console.log(`%cLootable DEBUG |%c Found item by ID in pack ${pack.collection}: ${packItem.name}`, 'color: #940000;', 'color: inherit');
                return packItem;
              }
            } catch (e) {
              // Continue to next pack
            }
          }
        }
      }
      
      // If not found by ID, try to find by name
      if (result.text) {
        // Check in game items
        let item = game.items.getName(result.text);
        if (item) {
          if (enableDebug) console.log(`%cLootable DEBUG |%c Found item by name in game items: ${item.name}`, 'color: #940000;', 'color: inherit');
          return item;
        }
        
        // Check in all item packs
        for (let pack of game.packs) {
          if (pack.documentName === 'Item') {
            try {
              const index = await pack.getIndex();
              const entry = index.find(e => e.name === result.text);
              if (entry) {
                const packItem = await pack.getDocument(entry._id);
                if (packItem) {
                  if (enableDebug) console.log(`%cLootable DEBUG |%c Found item by name in pack ${pack.collection}: ${packItem.name}`, 'color: #940000;', 'color: inherit');
                  return packItem;
                }
              }
            } catch (e) {
              // Continue to next pack
            }
          }
        }
      }
      
      // If we get here, the item wasn't found
      if (enableDebug) console.log(`%cLootable DEBUG |%c Item not found: ${result.text || result.documentId}`, 'color: #940000;', 'color: inherit');
      return null;
    } catch (error) {
      if (enableDebug) console.error(`%cLootable DEBUG |%c Error getting item:`, 'color: #940000;', 'color: inherit', error);
      return null;
    }
  }
  
  static async rollWithoutBetterTables(table) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Rolling without Better Tables`, 'color: #940000;', 'color: inherit');
    
    try {
        // Roll on the table
        let roll = await table.draw({displayChat: false});
        
        if (enableDebug) console.log(`%cLootable DEBUG |%c Roll results obtained`, 'color: #940000;', 'color: inherit');
        
        let results = {
            items: []
        };
        
        // Handle different result structures
        let rollResults = [];
        
        // Check if roll.results is an array
        if (Array.isArray(roll.results)) {
            rollResults = roll.results;
        } 
        // Check if roll.results is a Collection
        else if (roll.results && typeof roll.results.contents !== 'undefined') {
            rollResults = roll.results.contents;
        }
        // Check if roll is itself a DrawResult with a collection property
        else if (roll.collection && Array.isArray(roll.collection)) {
            rollResults = roll.collection;
        }
        // Check if roll has a results property that's a Collection
        else if (roll.results && roll.results.forEach) {
            // Use forEach to convert to array
            rollResults = [];
            roll.results.forEach(r => rollResults.push(r));
        }
        
        if (enableDebug) console.log(`%cLootable DEBUG |%c Results count: ${rollResults.length}`, 'color: #940000;', 'color: inherit');
        
        // Process the results
        for (let r of rollResults) {
            // Handle different result structures
            let documentCollection = r.documentCollection || r.collection || r.data?.collection || null;
            let documentId = r.documentId || r.resultId || r.data?.resultId || r._id || null;
            
            if (!documentCollection) {
                if (enableDebug) console.log(`%cLootable DEBUG |%c No document collection for result, skipping`, 'color: #940000;', 'color: inherit');
                continue;
            }
            
            // Create a compatible result object
            let resultObj = {
                documentCollection: documentCollection,
                documentId: documentId
            };
            
            let item = await this.getItem(resultObj);
            if (!item) {
                continue;
            }
            
            let itemData = item.toObject();
            
            // Add quantity (default to 1)
            itemData.system.quantity = 1;
            
            results.items.push(itemData);
        }
        
        if (enableDebug) console.log(`%cLootable DEBUG |%c Processed ${results.items.length} items`, 'color: #940000;', 'color: inherit');
        
        return results.items;
    } catch (error) {
        if (enableDebug) console.error(`%cLootable DEBUG |%c Error rolling without Better Tables:`, 'color: #940000;', 'color: inherit', error);
        return null;
    }
  }
  
  static async rollTable(table) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Rolling on table: ${table.name}`, 'color: #940000;', 'color: inherit');
    
    // Check if Better Tables is available
    if (game.modules.get('better-rolltables')?.active) {
        if (enableDebug) console.log(`%cLootable DEBUG |%c Better Tables is active, using it`, 'color: #940000;', 'color: inherit');
        return await this.rollWithBetterTables(table);
    } else {
        if (enableDebug) console.log(`%cLootable DEBUG |%c Better Tables not active, using standard roll`, 'color: #940000;', 'color: inherit');
        return await this.rollWithoutBetterTables(table);
    }
  }
  
  static async addItemsToActor(actor, items) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Adding ${items.length} items to actor: ${actor.name}`, 'color: #940000;', 'color: inherit');
    
    if (!items.length) return;
    
    try {
        // Group similar items by name
        let groupedItems = {};
        for (let item of items) {
            const key = item.name;
            if (!groupedItems[key]) {
                // Create a copy of the item
                groupedItems[key] = foundry.utils.deepClone(item);
            } else {
                // Increase the quantity of the existing item
                groupedItems[key].system.quantity += item.system.quantity || 1;
            }
        }
        
        // Convert the grouped items back to an array
        const consolidatedItems = Object.values(groupedItems);
        
        if (enableDebug) {
            console.log(`%cLootable DEBUG |%c Consolidated ${items.length} items into ${consolidatedItems.length} unique items`, 'color: #940000;', 'color: inherit');
            console.log(`%cLootable DEBUG |%c Consolidated items:`, 'color: #940000;', 'color: inherit', consolidatedItems);
        }
        
        await actor.createEmbeddedDocuments('Item', consolidatedItems);
        if (enableDebug) console.log(`%cLootable DEBUG |%c Items added successfully`, 'color: #940000;', 'color: inherit');
        
        // Return the consolidated items for the chat message
        return consolidatedItems;
    } catch (error) {
        if (enableDebug) console.error(`%cLootable DEBUG |%c Error adding items:`, 'color: #940000;', 'color: inherit', error);
        return items; // Return original items if there was an error
    }
  }
  
  static async sendLootMessage(actor, results) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    if (enableDebug) console.log(`%cLootable DEBUG |%c Sending loot message for ${actor.name}`, 'color: #940000;', 'color: inherit');
    
    // Format the items for display
    let itemsToDisplay = results.map(item => ({
        name: item.name,
        img: item.img,
        quantity: item.system.quantity || 1
    }));
    
    // Create the chat message
    try {
        let content = await renderTemplate(`modules/lootable/templates/lootMessage.hbs`, {
            actor: {
                name: actor.name,
                img: actor.img
            },
            items: itemsToDisplay
        });
        
        await ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker({ actor }),
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            whisper: ChatMessage.getWhisperRecipients('GM'),
            flags: {
                lootable: {
                    randomLootGenerated: true
                }
            }
        });
        
        if (enableDebug) console.log(`%cLootable DEBUG |%c Loot message sent`, 'color: #940000;', 'color: inherit');
    } catch (error) {
        if (enableDebug) console.error(`%cLootable DEBUG |%c Error sending loot message:`, 'color: #940000;', 'color: inherit', error);
    }
  }
}
