export class RandomLoot {
  static registerHandlebarsHelpers() {
    Handlebars.registerHelper('add', function(value) {
      return parseInt(value) + 1;
    });
    
    Handlebars.registerHelper('subtract', function(total, index) {
      return total - index;
    });
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
    
    let creatureType = "";
    const typeData = tokenDoc.actor.system?.details?.type;
    
    if (typeData) {
        if (typeData.value === "custom" && typeData.custom) {
            creatureType = typeData.custom;
        } else {
            creatureType = typeData.value || "";
        }
    } else {
        creatureType = tokenDoc.actor.system?.details?.race || "";
    }
    
    let creatureSubtype = tokenDoc.actor.system?.details?.type?.subtype || "";
    
    let treasureType = "";
    if (tokenDoc.actor.system?.details?.treasure?.value instanceof Set) {
        const treasureValues = Array.from(tokenDoc.actor.system.details.treasure.value.values());
        treasureType = treasureValues.join(",");
    }
    
    let cr = tokenDoc.actor.system?.details?.cr || 0;
    
    if (enableDebug) {
        console.log(`%cLootable DEBUG |%c [RL] Token: ${tokenDoc.name} | Type: ${creatureType}, Subtype: ${creatureSubtype}, Treasure Type: ${treasureType}, CR: ${cr}`, 'color: #940000;', 'color: inherit');
    }
    
    if (!creatureType) {
        return;
    }
    
    let creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    if (!creatureTypeTables?.entries?.length) {
        return;
    }
    
    let matchingEntry = RandomLoot.findMatchingTableEntry(creatureType, creatureSubtype, treasureType, cr, creatureTypeTables.entries);
    
    if (enableDebug) {
        if (matchingEntry) {
            let tableId = matchingEntry.tableId;
            let table = tableId ? game.tables.get(tableId) : null;
            
            if (table) {
                console.log(`%cLootable DEBUG |%c [RL] Rolling on table: "${table.name}" (${table.id})`, 'color: #940000;', 'color: inherit');
            } else {
                console.log(`%cLootable DEBUG |%c [RL] Table ID ${tableId} not found`, 'color: #940000;', 'color: inherit');
            }
        } else {
            console.log(`%cLootable DEBUG |%c [RL] No matching table found for this token`, 'color: #940000;', 'color: inherit');
        }
    }
    
    if (!matchingEntry) {
        return;
    }
    
    let tableId = matchingEntry.tableId;
    let table = tableId ? game.tables.get(tableId) : null;
    
    if (!tableId || !table) return;

    if (showRandomLootPrompt) {
        await RandomLoot.showPrompt(tokenDoc, table);
    } else {
        let results = await RandomLoot.rollTable(table);
        if (!results || !results.length) {
            return;
        }
        
        const consolidatedItems = await RandomLoot.addItemsToActor(tokenDoc.actor, results);
        
        if (!hideRandomLootChatMsg) {
            await RandomLoot.sendLootMessage(tokenDoc.actor, consolidatedItems || results);
        }
    }
  }
  
  static async showPrompt(tokenDoc, table) {
    let currentResults = [];
    let allResults = [];
    
    // Handle both token document and token object cases
    const tokenName = tokenDoc.name;
    const tokenImg = tokenDoc.document ? 
      (tokenDoc.document.texture?.src || tokenDoc.document.img) : 
      (tokenDoc.texture?.src || tokenDoc.img);
    
    const dialog = new Dialog({
      title: game.i18n.localize('LOOTABLE.RandomLootPrompt.Title'),
      content: await renderTemplate('modules/lootable/templates/randomLootPrompt.hbs', {
        token: {
          name: tokenName,
          img: tokenImg
        },
        table,
        allResults
      }),
      buttons: {
        accept: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('LOOTABLE.RandomLootPrompt.Accept'),
          callback: async (html) => {
            if (!allResults || !allResults.length) return;
            
            const flatResults = allResults.flat();
            
            const consolidatedItems = await RandomLoot.addItemsToActor(tokenDoc.actor, flatResults);
            
            if (!game.settings.get('lootable', 'hideRandomLootChatMsg')) {
              await RandomLoot.sendLootMessage(tokenDoc.actor, consolidatedItems || flatResults);
            }
            
            return true;
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('LOOTABLE.RandomLootPrompt.Cancel'),
          callback: () => null
        }
      },
      render: (html) => {
        const updateContent = async () => {
          const content = await renderTemplate('modules/lootable/templates/randomLootPrompt.hbs', {
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

        // Handle Roll button
        html.find('.roll-button').click(async (event) => {
          event.preventDefault();
          currentResults = await RandomLoot.rollTable(table);
          if (!currentResults || !currentResults.length) {
            return;
          }
          // Add new results to the beginning of the array
          allResults.unshift(currentResults);
          await updateContent();
        });

        // Handle Reroll button
        html.find('.reroll-button').click(async (event) => {
          event.preventDefault();
          if (!allResults.length) return;
          
          currentResults = await RandomLoot.rollTable(table);
          if (!currentResults || !currentResults.length) {
            return;
          }
          // Replace first roll results (most recent)
          allResults[0] = currentResults;
          await updateContent();
        });

        // Handle Clear button
        html.find('.clear-button').click(async (event) => {
          event.preventDefault();
          allResults = [];
          currentResults = [];
          await updateContent();
        });

        // Prevent form submission
        html.find('form').submit((ev) => ev.preventDefault());
      },
      close: () => {}
    });

    dialog.render(true);
  }
  
  static logTableRollError(error, usingBetterTables = true) {
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
            if (enableDebug) console.log(`%cLootable DEBUG |%c [RL] [Better Tables] Item not found: ${result.text || result.documentId}`, 'color: #940000;', 'color: inherit');
            
            if (result.text) {
              processedResults.textResults.push({
                text: result.text,
                isText: true
              });
            }
          }
        } catch (itemError) {
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
      
      return null;
    } catch (error) {
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
                if (enableDebug) console.log(`%cLootable DEBUG |%c [RL] [Standard Tables] Item not found: ${r.text || documentId}`, 'color: #940000;', 'color: inherit');
                
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
        const textEntries = items.filter(item => item.isText);
        
        if (!itemsToAdd.length && !textEntries.length) return items;
        
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
        
        await actor.createEmbeddedDocuments('Item', consolidatedItems);
        
        if (enableDebug) {
            const totalItemCount = itemsToAdd.length;
            const uniqueItemCount = consolidatedItems.length;
            const textCount = textEntries.length;
            
            let debugMessage = `%cLootable DEBUG |%c [RL] Added to ${actor.name}: ${totalItemCount} total items consolidated into ${uniqueItemCount} unique items`;
            
            if (textCount > 0) {
                debugMessage += ` | ${textCount} text entries found`;
            }
            
            if (uniqueItemCount > 0) {
                const itemList = consolidatedItems.map(item => 
                    `${item.name} (${item.system.quantity || 1})`
                ).join(', ');
                debugMessage += ` | Items: ${itemList}`;
            }
            
            if (textCount > 0) {
                const textList = textEntries.map(entry => entry.text).join(', ');
                debugMessage += ` | Text: ${textList}`;
            }
            
            console.log(debugMessage, 'color: #940000;', 'color: inherit');
        }
        
        return items;
    } catch (error) {
        return items;
    }
  }
  
  static async sendLootMessage(actor, results) {
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    
    const textEntries = results.filter(item => item.isText);
    const itemResults = results.filter(item => !item.isText);
    
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
    }
  }

  static canUserRollLoot(user) {
    return user.isGM;
  }

  static canTokenReceiveLoot(token) {
    if (!token.actor) return false;
    
    // Check if the token is an NPC
    if (!token.actor.type === 'npc') return false;
    
    let creatureType = "";
    const typeData = token.actor.system?.details?.type;
    
    if (typeData) {
      if (typeData.value === "custom" && typeData.custom) {
        creatureType = typeData.custom;
      } else {
        creatureType = typeData.value || "";
      }
    } else {
      creatureType = token.actor.system?.details?.race || "";
    }
    
    if (!creatureType) return false;
    
    return true;
  }

  static findMatchingTableEntry(creatureType, creatureSubtype, treasureType, cr, entries) {
    if (!entries?.length) return null;

    for (let entry of entries) {
      if (!entry.tableId) continue;
      
      if (entry.type && entry.type !== "") {
        const entryTypes = entry.type.toLowerCase().split(',').map(t => t.trim());
        const tokenTypes = creatureType.toLowerCase().split(',').map(t => t.trim());
        
        const hasMatchingType = entryTypes.some(entryType => 
          tokenTypes.some(tokenType => tokenType === entryType)
        );
        
        if (!hasMatchingType) continue;
      }
      
      if (entry.subtype && entry.subtype !== "") {
        const entrySubtypes = entry.subtype.toLowerCase().split(',').map(s => s.trim());
        const tokenSubtypes = creatureSubtype.toLowerCase().split(',').map(s => s.trim());
        
        const hasMatchingSubtype = entrySubtypes.some(entrySubtype => 
          tokenSubtypes.some(tokenSubtype => tokenSubtype === entrySubtype)
        );
        
        if (!hasMatchingSubtype) continue;
      }
      
      if (entry.treasureType && entry.treasureType !== "") {
        const entryTreasureTypes = entry.treasureType.toLowerCase().split(',').map(t => t.trim());
        const tokenTreasureTypes = treasureType.toLowerCase().split(',').map(t => t.trim());
        
        const hasMatchingTreasureType = entryTreasureTypes.some(entryTreasureType => 
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
    let enableDebug = game.settings.get('lootable', 'enableDebug') || false;
    let showRandomLootPrompt = game.settings.get('lootable', 'showRandomLootPrompt');
    let hideRandomLootChatMsg = game.settings.get('lootable', 'hideRandomLootChatMsg');
    
    if (!this.canTokenReceiveLoot(token)) {
      if (enableDebug) {
        console.log(`%cLootable DEBUG |%c [RL] Token ${token.name} is not valid for random loot`, 'color: #940000;', 'color: inherit');
      }
      return;
    }
    
    let creatureType = "";
    const typeData = token.actor.system?.details?.type;
    
    if (typeData) {
      if (typeData.value === "custom" && typeData.custom) {
        creatureType = typeData.custom;
      } else {
        creatureType = typeData.value || "";
      }
    } else {
      creatureType = token.actor.system?.details?.race || "";
    }
    
    let creatureSubtype = token.actor.system?.details?.type?.subtype || "";
    
    let treasureType = "";
    if (token.actor.system?.details?.treasure?.value instanceof Set) {
      const treasureValues = Array.from(token.actor.system.details.treasure.value.values());
      treasureType = treasureValues.join(",");
    }
    
    let cr = token.actor.system?.details?.cr || 0;
    
    if (enableDebug) {
      console.log(`%cLootable DEBUG |%c [RL] Token: ${token.name} | Type: ${creatureType}, Subtype: ${creatureSubtype}, Treasure Type: ${treasureType}, CR: ${cr}`, 'color: #940000;', 'color: inherit');
    }
    
    let creatureTypeTables = game.settings.get('lootable', 'creatureTypeTables');
    if (!creatureTypeTables?.entries?.length) {
      return;
    }
    
    let matchingEntry = this.findMatchingTableEntry(creatureType, creatureSubtype, treasureType, cr, creatureTypeTables.entries);
    
    if (enableDebug) {
      if (matchingEntry) {
        let tableId = matchingEntry.tableId;
        let table = tableId ? game.tables.get(tableId) : null;
        
        if (table) {
          console.log(`%cLootable DEBUG |%c [RL] Rolling on table: "${table.name}" (${table.id})`, 'color: #940000;', 'color: inherit');
        } else {
          console.log(`%cLootable DEBUG |%c [RL] Table ID ${tableId} not found`, 'color: #940000;', 'color: inherit');
        }
      } else {
        console.log(`%cLootable DEBUG |%c [RL] No matching table found for this token`, 'color: #940000;', 'color: inherit');
      }
    }
    
    if (!matchingEntry) {
      return;
    }
    
    let tableId = matchingEntry.tableId;
    let table = tableId ? game.tables.get(tableId) : null;
    
    if (!tableId || !table) return;
    
    if (showRandomLootPrompt) {
      await this.showPrompt(token, table);
    } else {
      let results = await this.rollTable(table);
      if (!results || !results.length) {
        return;
      }
      
      const consolidatedItems = await this.addItemsToActor(token.actor, results);
      
      if (!hideRandomLootChatMsg) {
        await this.sendLootMessage(token.actor, consolidatedItems || results);
      }
    }
  }
}
