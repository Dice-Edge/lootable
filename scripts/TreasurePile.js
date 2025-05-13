export class TreasurePile extends Application {

  // Finds an item in the game world or compendiums based on UUID or ID
  static async findItem(itemData) {
    if (!itemData?.uuid && !itemData?.id) return null;
    let item = itemData.uuid ? await fromUuid(itemData.uuid) : null;
    if (!item && itemData.id) {
      item = game.items.get(itemData.id);
    }
    return item;
  }

  // Converts currency between different denominations (pp, gp, sp, cp)
  static convertCurrency(amount, fromCurrency, toCurrency) {
    const rates = { pp: 10, gp: 1, sp: 0.1, cp: 0.01 };
    return amount * (rates[fromCurrency] / rates[toCurrency]);
  }

  // Gets the UUID for an item, handling various item source types
  static getItemUUID(item) {
    if (!item) return null;
    return item.flags?.core?.sourceId || 
           (game.items.has(item._id) ? `Item.${item._id}` : null) ||
           (item.pack && item._id ? `Compendium.${item.pack}.${item._id}` : null) ||
           (item.source?.uuid || 
            (item.source?.documentCollection && item.source?.documentId ? 
             `Compendium.${item.source.documentCollection}.${item.source.documentId}` : null)) ||
           `Item.${item._id}`;
  }

  static debug(message, error = null) {
    if (!game.settings.get('lootable', 'enableDebug')) return;
    console.log('%cLootable DEBUG |%c [TP] ' + message, 'color: #940000;', 'color: inherit');
    if (error) console.error(error);
  }

  static getCoinAmountRange(amountType) {
    const ranges = {
      'purse': { min: 1.00, max: 10.00 },
      'sack': { min: 10.00, max: 50.00 },
      'coffer': { min: 50.00, max: 200.00 },
      'chest': { min: 200.00, max: 500.00 },
      'vault': { min: 500.00, max: 1000.00 }
    };
    if (amountType === 'random') {
      const availableRanges = Object.values(ranges);
      return availableRanges[Math.floor(Math.random() * availableRanges.length)];
    }
    return ranges[amountType] || ranges.purse;
  }

  // Constructor - Initializes the application with default values and registers Handlebars helpers
  constructor(options = {}) {
    super(options);
    this.results = [];
    this.totalValue = 0;
    this.minValue = 0;
    this.maxValue = 0;
    this.coinPercentage = 30;
    this.selectedCoinType = 'random';
    this.selectedAmountType = 'random';
    Handlebars.registerHelper('round', function (value) {
      return Math.round(Number(value) || 0);
    });
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'tsrpl-interface',
      template: 'modules/lootable/templates/tsrplInterface.hbs',
      title: game.i18n.localize("LOOTABLE.tsrplIntf.name"),
      width: 850,
      height: 800,
      classes: ["lootable", "tsrpl-interface"],
      scrollY: ["table-list", "tsrpl-results-list"]
    });
  }

  getData() {
    const defaultTables = game.settings.get('lootable', 'treasurePileDefaultTables') || [];
    const showAllTables = game.settings.get('lootable', 'treasurePileShowAllTables');
    const tables = (showAllTables ? game.tables.contents : 
                   game.tables.contents.filter(t => defaultTables.includes(t.id)))
                   .sort((a, b) => a.name.localeCompare(b.name));

    const totalCoins = this.results.reduce((acc, result) => {
      if (result.type === 'coins' && result.coins) {
        Object.entries(result.coins).forEach(([currency, amount]) => {
          acc[currency] = (acc[currency] || 0) + amount;
        });
      }
      return acc;
    }, { pp: 0, gp: 0, sp: 0, cp: 0 });

    const mappedResults = this.results.map(result => {
      if (result.type === 'coins') return { ...result, value: Number(result.value) };
      if (result.type === 'item') {
        const value = typeof result.value === 'object' ? result.value : { value: Number(result.value), displayValue: Number(result.value), currency: 'gp' };
        return { ...result, ...value };
      }
      return result;
    });

    return {
      results: mappedResults,
      totalCoins,
      totalValue: this._calculateTotalValue(),
      formattedTotalValue: this._calculateTotalValue().toFixed(2),
      tables: tables.map(({ id, name }) => ({ id, name })),
      isGM: game.user.isGM,
      minValue: this.minValue,
      maxValue: this.maxValue,
      coinPercentage: this.coinPercentage,
      selectedCoinType: this.selectedCoinType,
      selectedAmountType: this.selectedAmountType
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.tsrpl-item-name.clickable').on('click', async (event) => {
      const uuid = event.currentTarget.dataset.uuid;
      const itemId = event.currentTarget.dataset.itemId;
      let item;
      if (uuid) {
        item = await fromUuid(uuid);
      }
      if (!item && itemId) {
        item = game.items.get(itemId);
      }
      if (item) {
        item.sheet.render(true);
      }
    });
    html.find('input[name="itemQuantity"]').on('change', (event) => this._onItemQuantityChange(event));
    html.find('.roll-table').on('click', (event) => {
      event.preventDefault();
      const tableId = event.currentTarget.dataset.tableId;
      this._onRollTable(event, tableId);
    });
    html.find('.add-coins').on('click', (event) => this._onAddCoins(event));
    html.find('.clear-results').on('click', (event) => this._onClearResults(event));
    html.find('.autogen').on('click', (event) => this._onAutogen(event));
    html.find('.export-actor').on('click', (event) => this._onExportToActor(event));
    html.find('.export-journal').on('click', this._onExportToJournal.bind(this));
    html.find('input[name="minValue"]').on('change', (event) => this._onMinValueChange(event));
    html.find('input[name="maxValue"]').on('change', (event) => this._onMaxValueChange(event));
    html.find('input[name="coinPercentage"]').on('change', (event) => this._onCoinPercentageChange(event));
    const coinInputs = html.find('input[name="pp"], input[name="gp"], input[name="sp"], input[name="cp"]');
    coinInputs.on('change input', (event) => this._onCoinInputChange(event));
    html.find('input[name="coinType"]').on('change', (event) => {
      this.selectedCoinType = event.currentTarget.value;
    });
    html.find('input[name="coinAmount"]').on('change', (event) => {
      this.selectedAmountType = event.currentTarget.value;
    });
    html.find('.remove-item').click(ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      this._removeItem(itemId);
    });
    const dropZone = html.find('.tsrpl-drop-zone');
    dropZone.on('dragover', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropZone.addClass('dragover');
    });
    dropZone.on('dragleave', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropZone.removeClass('dragover');
    });
    dropZone.on('drop', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      dropZone.removeClass('dragover');
      let itemData;
      itemData = JSON.parse(ev.originalEvent.dataTransfer.getData('text/plain'));
      const item = await TreasurePile.findItem(itemData);
      if (!item) return;
      const itemValue = this._calculateItemValue(item, 1);
      const existingIndex = this.results.findIndex(r =>
        r.type === 'item' &&
        r.item &&
        ((r.item._id === item._id) || (r.source?.uuid === TreasurePile.getItemUUID(item)))
      );
      if (existingIndex !== -1) {
        this.results[existingIndex].quantity = (this.results[existingIndex].quantity || 1) + 1;
        this.results[existingIndex].value = this._calculateItemValue(item, this.results[existingIndex].quantity);
      } else {
        this.results.push({
          type: 'item',
          item: item,
          source: {
            uuid: TreasurePile.getItemUUID(item),
            type: 'item'
          },
          quantity: 1,
          value: itemValue
        });
      }
      this.totalValue = this._calculateTotalValue();
      await this._updateContent();
    });
  }

  async _updateContent() {
    const tablesList = this.element.find('.table-list');
    const resultsList = this.element.find('.tsrpl-results-list');
    const tableScroll = tablesList.scrollTop();
    const resultsScroll = resultsList.scrollTop();
    const content = await renderTemplate(this.template, await this.getData());
    const contentArea = this.element.find('.window-content');
    contentArea.html(content);
    this.activateListeners(this.element);
    const newTablesList = this.element.find('.table-list');
    const newResultsList = this.element.find('.tsrpl-results-list');
    if (newTablesList.length) {
      newTablesList.scrollTop(tableScroll);
    }
    if (newResultsList.length) {
      newResultsList.scrollTop(resultsScroll);
    }
  }

  async _onRollTable(event) {
    event.preventDefault();
    const table = game.tables.get(event.currentTarget.dataset.tableId);
    if (!table) {
      ui.notifications.error(game.i18n.localize("LOOTABLE.tsrplIntf.notice.noTables"));
      return;
    }

    const newResults = game.modules.get("better-rolltables")?.active ? 
      await this._rollWithBetterTables(table) : 
      await this._rollWithoutBetterTables(table);

    // Debug log the table roll and results in a single line
    const resultDetails = newResults?.length ? 
      newResults.map(result => {
        if (result.type === 'item') {
          return `${result.quantity}x ${result.item.name} (${result.value?.displayValue || result.value} ${result.value?.currency || 'gp'})`;
        }
        return null;
      }).filter(Boolean).join(', ') : 'no results';
    
    TreasurePile.debug(`Table Roll [${table.name} (${table.id})]: ${resultDetails}`);

    this.results = this._groupResults([...this.results, ...newResults]);
    this.totalValue = this._calculateTotalValue();
    await this._updateContent();
  }

  async _rollWithBetterTables(table) {
    const brt = game.modules.get('better-rolltables');
    if (!brt?.api) return await this._rollWithoutBetterTables(table);

    const betterResults = await brt.api.betterTableRoll(table, {
      displayChat: false,
      rollMode: 'gmroll'
    });

    const itemMap = new Map();
    for (const result of betterResults) {
      if (result.type === 'text') continue;
      
      const itemKey = result.documentCollection && result.documentId ? 
        `${result.documentCollection}.${result.documentId}` :
        result.documentId ? `Item.${result.documentId}` : null;
      
      if (!itemKey) continue;

      const pack = result.documentCollection ? game.packs.get(result.documentCollection) : null;
      const item = pack ? await pack.getDocument(result.documentId) : game.items.get(result.documentId);
      if (!item) continue;

      const quantity = result.roll?.quantity || 1;
      if (itemMap.has(itemKey)) {
        const existing = itemMap.get(itemKey);
        existing.quantity += quantity;
        existing.value = this._calculateItemValue(existing.item, existing.quantity);
      } else {
        const processedResult = await this._processRollTableItem(item, quantity, {
          documentCollection: result.documentCollection || 'Item',
          documentId: result.documentId,
          uuid: itemKey
        });
        if (processedResult) itemMap.set(itemKey, processedResult);
      }
    }
    return Array.from(itemMap.values());
  }

  async _rollWithoutBetterTables(table) {
    const roll = await table.draw({ displayChat: false });
    const results = [];
    const rollResults = Array.isArray(roll.results) ? roll.results : [roll.results];
    
    const itemSources = rollResults.reduce((acc, result) => {
      if (!(result.type === 2 || result.type === 'Item' || result.type === 'document' ||
            (result.documentCollection && (result.documentCollection === 'Item' || 
             result.documentCollection !== 'Item')))) return acc;
      
      const key = result.documentCollection ? 
        `Compendium.${result.documentCollection}.${result.documentId}` : 
        `Item.${result.documentId || result._id}`;
      
      if (!acc[key]) {
        acc[key] = {
          source: {
            type: result.documentCollection && result.documentCollection !== 'Item' ? 'compendium' : 'world',
            collection: result.documentCollection,
            id: result.documentId || result._id
          },
          count: 0
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    for (const [key, data] of Object.entries(itemSources)) {
      const pack = data.source.type === 'compendium' ? game.packs.get(data.source.collection) : null;
      const item = pack ? await pack.getDocument(data.source.id) : game.items.get(data.source.id);
      
      if (item) {
        const processedResult = await this._processRollTableItem(item, data.count, {
          documentCollection: data.source.type === 'compendium' ? data.source.collection : 'Item',
          documentId: data.source.id,
          uuid: key
        });
        if (processedResult) results.push(processedResult);
      }
    }
    return results;
  }

  // Common helper to process an item and add it to results
  async _processRollTableItem(item, quantity = 1, source = {}) {
    if (!item) return null;
    const itemData = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
    const uuid = source.uuid || 
                 (source.documentCollection && source.documentId) ? 
                 `Compendium.${source.documentCollection}.${source.documentId}` : 
                 `Item.${source.documentId || item._id}`;                 
    return {
      type: 'item',
      item: itemData,
      quantity: quantity,
      value: this._calculateItemValue(itemData, quantity),
      source: {
        documentCollection: source.documentCollection || (source.type === 'compendium' ? source.collection : 'Item'),
        documentId: source.documentId || source.id || item._id,
        uuid
      }
    };
  }

  // Calculates the value of an item, handling various price formats
  _calculateItemValue(item, quantity = 1) {
    if (!item?.system?.price) return { value: 0, displayValue: 0, currency: 'gp' };
    
    const price = item.system.price;
    let value = 0, displayValue = 0, currency = 'gp';
    
    if (typeof price === 'object') {
      if (price.value !== undefined) {
        displayValue = Number(price.value) || 0;
        currency = price.denomination?.toLowerCase() || 'gp';
        value = price.valueInGp !== undefined ? Number(price.valueInGp) : 
                TreasurePile.convertCurrency(displayValue, currency, 'gp');
      } else {
        const currencies = ['pp', 'gp', 'sp', 'cp'];
        for (const curr of currencies) {
          if (price[curr] !== undefined) {
            displayValue = Number(price[curr]);
            currency = curr;
            value = TreasurePile.convertCurrency(displayValue, currency, 'gp');
            break;
          }
        }
      }
    } else if (typeof price === 'string') {
      const match = price.match(/(\d+)\s*(gp|sp|cp|pp)?/i);
      if (match) {
        displayValue = Number(match[1]);
        currency = (match[2] || 'gp').toLowerCase();
        value = TreasurePile.convertCurrency(displayValue, currency, 'gp');
      } else {
        displayValue = value = Number(price.replace(/[^\d.-]/g, '')) || 0;
      }
    } else if (typeof price === 'number') {
      value = displayValue = price;
    }
    
    return {
      value: Math.round(value * quantity * 100) / 100,
      displayValue: Math.round(displayValue * quantity * 100) / 100,
      currency
    };
  }

  // Calculates the total value of all items and coins in the treasure pile
  _calculateTotalValue(results = null) {
    const targetResults = results || this.results;
    if (!targetResults?.length) return 0;
    const total = targetResults.reduce((total, result) => {
      if (result.type === 'coins') {
        return total + this._calculateCoinValue(result.coins);
      } else if (result.type === 'item' && result.value) {
        return total + (typeof result.value === 'object' ? result.value.value : result.value);
      }
      return total;
    }, 0);
    return Math.round(total * 100) / 100;
  }

  // Groups similar items together and combines their quantities
  _groupResults(results) {
    if (!results?.length) return [];
    const grouped = new Map();
    
    for (const result of results) {
      if (!result) continue;
      const key = result.type === 'coins' ? 'coins' : 
                 (result.source?.uuid || (result.item?._id ? `Item.${result.item._id}` : null));
      if (!key) continue;

      if (!grouped.has(key)) {
        grouped.set(key, { ...result, quantity: result.quantity || 1 });
      } else {
        const existing = grouped.get(key);
        existing.quantity += (result.quantity || 1);
        
        if (result.type === 'coins' && result.coins) {
          Object.entries(result.coins).forEach(([currency, amount]) => {
            existing.coins[currency] = (existing.coins[currency] || 0) + amount;
          });
          existing.value = this._calculateCoinValue(existing.coins);
        } else if (result.type === 'item') {
          existing.value = this._calculateItemValue(existing.item, existing.quantity);
        }
      }
    }
    
    return Array.from(grouped.values());
  }

  // Helper method to calculate soft caps for silver and copper
  _calculateSoftCaps(startingGold) {
    return {
      silver: Math.floor(startingGold) + 10,
      copper: Math.floor(startingGold) + 100
    };
  }

  // Helper method to convert decimal part to silver and copper
  _convertDecimalToSilverCopper(decimal) {
    const decimalCopper = Math.round(decimal * 100);
    return {
      silver: Math.floor(decimalCopper / 10),
      copper: decimalCopper % 10
    };
  }

  // Helper method to convert gold to silver and copper with percentage
  _convertGoldToSilverCopper(gold, copperPercentage) {
    const totalCopper = Math.round(gold * 100);
    const copper = Math.round(totalCopper * (copperPercentage / 100));
    const silver = Math.floor((totalCopper - copper) / 10);
    return { silver, copper };
  }

  // Distributes a gold value randomly across different coin types for realistic distribution
  _distributeCoinsRandomly(goldValue) {
    const startingGold = Math.round(goldValue * 100) / 100;
    const softCaps = this._calculateSoftCaps(startingGold);
    let coins = { pp: 0, gp: 0, sp: 0, cp: 0 };
    let debugSteps = [];
    
    // Step 1: Convert to platinum (20-80% of whole gold)
    const wholeGold = Math.floor(startingGold);
    if (wholeGold >= 20) {
      const platinumPercentage = 20 + (Math.random() * 60); // 20-80%
      const platinumGold = Math.round((wholeGold * platinumPercentage) / 100);
      // Round to nearest 10gp for platinum conversion
      const platinumGoldRounded = Math.round(platinumGold / 10) * 10;
      coins.pp = Math.floor(platinumGoldRounded / 10);
      coins.gp = wholeGold - platinumGoldRounded;
      debugSteps.push(`pp conversion: (${Math.round(platinumPercentage)}%) ${platinumGoldRounded}gp > ${coins.pp}pp`);
    } else {
      coins.gp = wholeGold;
      debugSteps.push(`pp conversion: Skipped - insufficient gold`);
    }

    // Step 2: Convert decimal part to silver and copper
    const decimal = +(startingGold - Math.floor(startingGold)).toFixed(2);
    if (decimal > 0) {
      const { silver, copper } = this._convertDecimalToSilverCopper(decimal);
      coins.sp += silver;
      coins.cp += copper;
      debugSteps.push(`Decimal conversion: ${decimal} gp → ${silver} sp, ${copper} cp`);
    }

    // Step 3: Convert additional gold to silver and copper
    const stepAmount = Math.ceil(startingGold / 100); // 1/100th of starting gold, rounded up
    let currentSp = coins.sp;
    let currentCp = coins.cp;
    let chance = 80;
    let step = 1;

    debugSteps.push(`sp/cp conversion (${stepAmount}gp per step)`);

    while (chance > 0) {
      const shouldConvert = Math.random() * 100 < chance;
      if (shouldConvert) {
        const copperPercentage = (Math.floor(Math.random() * 4) + 1) * 10; // 10, 20, 30, or 40%
        const { silver, copper } = this._convertGoldToSilverCopper(stepAmount, copperPercentage);
        
        // Check soft caps for next step
        const wouldExceedSpCap = currentSp + silver > softCaps.silver;
        const wouldExceedCpCap = currentCp + copper > softCaps.copper;
        
        // Always process current step
        coins.sp += silver;
        coins.cp += copper;
        currentSp += silver;
        currentCp += copper;
        debugSteps.push(`Step ${step} (${chance}%) Success - (${copperPercentage}% cp) ${silver}sp, ${copper}cp`);
        
        // Only break if we would exceed caps on next step
        if (wouldExceedSpCap || wouldExceedCpCap) {
          debugSteps.push(`Step ${step + 1} (${chance - 5}%) Skipped - ${wouldExceedSpCap ? 'sp' : 'cp'} Soft Cap reached (${currentSp}/${softCaps.silver}sp, ${currentCp}/${softCaps.copper}cp)`);
          break;
        }
      } else {
        debugSteps.push(`Step ${step} (${chance}%) Failure - Check failed`);
        break;
      }
      chance -= 5;
      step++;
    }

    // Format debug message
    const debugMessage = `Coin Generation: Starting value ${startingGold} gp (Soft Caps: ${softCaps.silver}sp, ${softCaps.copper}cp) | ${debugSteps.join(' | ')} | Final distribution: ${coins.pp} pp, ${coins.gp} gp, ${coins.sp} sp, ${coins.cp} cp`;
    TreasurePile.debug(debugMessage);

    return coins;
  }

  _calculateCoinValue(coins) {
    if (!coins) return 0;
    return Math.round(Object.entries(coins).reduce((total, [currency, amount]) => 
      total + (amount * TreasurePile.convertCurrency(1, currency, 'gp')), 0) * 100) / 100;
  }

  _onMinValueChange(event) {
    this.minValue = Number(event.currentTarget.value) || 0;
  }

  _onMaxValueChange(event) {
    this.maxValue = Number(event.currentTarget.value) || 0;
  }

  _onCoinPercentageChange(event) {
    this.coinPercentage = Math.min(100, Math.max(0, Number(event.currentTarget.value) || 30));
    event.currentTarget.value = this.coinPercentage;
  }

  async _onAutogen(event) {
    event?.preventDefault();
    this.results = [];
    this.totalValue = 0;
    const targetCoinValue = Math.floor(this.minValue * (this.coinPercentage / 100));
    const coins = this._distributeCoinsRandomly(targetCoinValue);
    let currentResults = [{
      type: 'coins',
      coins: coins,
      value: this._calculateCoinValue(coins)
    }];
    let currentValue = this._calculateTotalValue(currentResults);
    const defaultTables = game.settings.get('lootable', 'treasurePileDefaultTables') || [];
    if (!defaultTables.length) {
      ui.notifications.warn(game.i18n.localize('LOOTABLE.tsrplIntf.notice.noDefaultTables'));
      await this._updateContent();
      return;
    }
    const availableTables = await this._getAvailableTables(defaultTables);
    const defaultTableIds = new Set(defaultTables);
    const eligibleTables = availableTables.filter(table => defaultTableIds.has(table.id));
    if (!eligibleTables.length) {
      ui.notifications.warn(game.i18n.localize('LOOTABLE.tsrplIntf.notice.noEligibleTables'));
      await this._updateContent();
      return;
    }
    let previousResults = null;
    let previousValue = currentValue;
    let attempts = 0;
    const maxAttempts = game.settings.get('lootable', 'treasurePileGenerationLimit');
    while (currentValue < this.minValue && attempts < maxAttempts) {
      attempts++;
      previousResults = [...currentResults];
      previousValue = currentValue;
      const randomTable = eligibleTables[Math.floor(Math.random() * eligibleTables.length)];
      let newResults;
      if (game.modules.get("better-rolltables")?.active) {
        newResults = await this._rollWithBetterTables(game.tables.get(randomTable.id));
      } else {
        newResults = await this._rollWithoutBetterTables(game.tables.get(randomTable.id));
      }
      if (newResults?.length) {
        // Debug log the auto-gen table roll and results
        const resultDetails = newResults.map(result => {
          if (result.type === 'item') {
            return `${result.quantity}x ${result.item.name} (${result.value?.displayValue || result.value} ${result.value?.currency || 'gp'})`;
          }
          return null;
        }).filter(Boolean).join(', ');
        
        TreasurePile.debug(`Auto-Gen Table Roll [${randomTable.name} (${randomTable.id})]: ${resultDetails}`);

        currentResults.push(...newResults);
        const groupedResults = Object.values(this._groupResults(currentResults));
        currentResults = groupedResults;
        currentValue = this._calculateTotalValue(currentResults);
        if (this.maxValue > 0 && currentValue > this.maxValue) {
          TreasurePile.debug(`Auto-Gen Skipped Results: Would exceed max value (${currentValue} > ${this.maxValue})`);
          currentResults = previousResults;
          currentValue = previousValue;
          continue;
        }
      }
    }
    if (attempts >= maxAttempts) {
      if (currentValue < this.minValue) {
        ui.notifications.warn(game.i18n.localize('LOOTABLE.tsrplIntf.notice.generationLimit'));
      }
    }
    this.results = currentResults;
    this.totalValue = this._calculateTotalValue();
    await this._updateContent();
  }

  // Exports the treasure pile contents to a journal entry (new or existing)
  async _onExportToJournal(event) {
    event.preventDefault();
    const journals = game.journal.contents.filter(j => j.isOwner);
    const content = await renderTemplate('modules/lootable/templates/tsrplJournalExport.hbs', {
      journals,
      isGM: game.user.isGM,
      totalValue: this.totalValue
    });
    this._showExportDialog({
      title: game.i18n.localize('LOOTABLE.tsrplIntf.exportWin.journalName'),
      content,
      targetType: 'journal',
      pageNameField: true
    });
  }

  // Exports the treasure pile contents to an actor's inventory (new or existing)
  async _onExportToActor(event) {
    event.preventDefault();
    const actors = game.actors.contents.filter(a => a.isOwner);
    const content = await renderTemplate('modules/lootable/templates/tsrplActorExport.hbs', {
      actors,
      isGM: game.user.isGM,
      totalValue: this.totalValue
    });      
    this._showExportDialog({
      title: game.i18n.localize('LOOTABLE.tsrplIntf.exportWin.actorName'),
      content,
      targetType: 'actor'
    });
  }
  
  // Helper method to show export dialog with common functionality
  _showExportDialog({title, content, targetType, pageNameField = false}) {
    const dialog = new Dialog({
      title: title,
      content: content,
      buttons: {},
      render: (html) => {
        const createNewCheckbox = html.find('#createNew');
        const newNameDiv = html.find(`.new-${targetType}-name`);
        const targetSelect = html.find(`#${targetType}Select`);        
        createNewCheckbox.on('change', function() {
          const isChecked = this.checked;
          newNameDiv.toggle(isChecked);
          targetSelect.prop('disabled', isChecked);
          dialog.setPosition({ height: 'auto' });
        });        
        html.find('form').on('submit', async (submitEvent) => {
          submitEvent.preventDefault();
          const form = submitEvent.target;
          const createNew = form.createNew?.checked;
          const newName = createNew ? form[`new${targetType.charAt(0).toUpperCase() + targetType.slice(1)}Name`].value : '';
          
          // Validate new actor name if creating new actor
          if (targetType === 'actor' && createNew && !newName.trim()) {
            ui.notifications.error(game.i18n.localize('LOOTABLE.tsrplIntf.notice.newActorNameMissing'));
            return;
          }

          if (targetType === 'journal') {
            const pageName = form.pageName?.value || '';
            // Validate new journal name if creating new journal
            if (createNew && !newName.trim()) {
              ui.notifications.error(game.i18n.localize('LOOTABLE.tsrplIntf.notice.newJournalNameMissing'));
              return;
            }
            // Validate page name
            if (!pageName.trim()) {
              ui.notifications.error(game.i18n.localize('LOOTABLE.tsrplIntf.notice.pageNameMissing'));
              return;
            }
            await this._exportToJournal(form.journal.value, createNew, newName, pageName);
          } else {
            await this._exportResults(form.actor.value, createNew, newName);
          }          
          dialog.close();
        });
      }
    }, {
      width: 400,
      height: 'auto',
      classes: ['tsrpl-export-dialog']
    });
    dialog.render(true);
  }

  // Helper to format results for export
  _formatExportResults() {
    return this.results.map(result => {
      if (result.type === 'coins') {
        const coinEntries = Object.entries(result.coins)
          .filter(([_, value]) => value > 0)
          .map(([key, value]) => `${value} ${key}`);
        return `<div class="LOOTABLE treasurePile resultItem coin-result">
          <p><span class="LOOTABLE treasurePile coins">${coinEntries.join(' • ')}</span>
          <span class="LOOTABLE treasurePile value">(${result.value} gp)</span></p></div>`;
      }
      
      if (result.type === 'item' && result.item) {
        const itemLink = this._getItemLink(result);
        const { displayValue = 0, currency = 'gp' } = typeof result.value === 'object' ? result.value : { value: result.value };
        const quantityText = result.quantity > 1 ? ` ×${result.quantity}` : '';
        return `<div class="LOOTABLE treasurePile resultItem">
          <p><span class="LOOTABLE treasurePile itemName">@UUID[${itemLink}]{${result.item.name}}${quantityText}</span>
          <span class="LOOTABLE treasurePile value">(${Math.round(displayValue)} ${currency})</span></p></div>`;
      }
      
      return '';
    }).filter(Boolean).join('');
  }
  
  // Get the appropriate item link for use in journal exports
  _getItemLink(result) {
    if (!result.item) return '';
    const isWorldItem = game.items.has(result.item._id);
    if (isWorldItem) return `Item.${result.item._id}`;
    if (result.source?.uuid) return result.source.uuid;
    if (result.source?.documentCollection && result.source?.documentId)
      return `Compendium.${result.source.documentCollection}.${result.source.documentId}`;
    if (result.item.pack && result.item._id)
      return `Compendium.${result.item.pack}.${result.item._id}`;
    if (result.item.flags?.core?.sourceId)
      return result.item.flags.core.sourceId;
    return `Item.${result.item._id}`;
  }

  // Exports the treasure pile contents to an actor's inventory (new or existing)
  async _exportResults(actorId, createNew = false, newActorName = '') {
    let actor;
    if (createNew) {
      actor = await Actor.create({
        name: newActorName || game.i18n.localize('LOOTABLE.tsrplIntf.exportWin.newActorDefault'),
        type: 'npc',
        img: 'icons/svg/mystery-man.svg'
      });
    } else {
      actor = game.actors.get(actorId);
    }
    if (!actor) throw new Error('No valid actor found');
    const coinResult = this.results.find(result => result.type === 'coins');
    if (coinResult && coinResult.coins) {
      const currentCurrency = foundry.utils.deepClone(actor.system.currency || {});
      Object.entries(coinResult.coins).forEach(([currency, amount]) => {
        currentCurrency[currency] = (currentCurrency[currency] || 0) + amount;
      });
      await actor.update({ 'system.currency': currentCurrency });
    }
    const items = this.results
      .filter(result => result.type === 'item' && result.item)
      .flatMap(result => {
        const itemData = foundry.utils.deepClone(result.item);          
        if (itemData.type === 'container') {
          return Array(result.quantity).fill().map(() => itemData);
        } 
        if (itemData.system) {
          itemData.system.quantity = result.quantity;
        }
        return [itemData];
      });      
    if (items.length > 0) {
      await actor.createEmbeddedDocuments('Item', items);
    }      
    ui.notifications.info(game.i18n.localize('LOOTABLE.tsrplIntf.notice.exportSuccess'));
  }

  // Removes an item from the treasure pile results
  _removeItem(itemId) {
    const index = this.results.findIndex(r => r.item?._id === itemId);
    if (index !== -1) {
      this.results.splice(index, 1);
      this.totalValue = this._calculateTotalValue();
      this._updateContent();
    }
  }

  // Handles changes to coin input values
  _onCoinInputChange(event) {
    const coinType = event.currentTarget.name;
    const value = Number(event.currentTarget.value) || 0;
    
    let coinResult = this.results.find(r => r.type === 'coins') || {
      type: 'coins',
      coins: { pp: 0, gp: 0, sp: 0, cp: 0 },
      value: 0
    };
    
    if (!this.results.includes(coinResult)) this.results.push(coinResult);
    
    coinResult.coins[coinType] = value;
    coinResult.value = this._calculateCoinValue(coinResult.coins);
    this.totalValue = this._calculateTotalValue();
    
    const totalValueElement = this.element.find('.tsrpl-total-value span');
    if (totalValueElement.length) {
      totalValueElement.text(`${this.totalValue.toFixed(2)} gp`);
    }
  }

  // Handles changes to item quantity
  _onItemQuantityChange(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const newQuantity = Math.max(1, parseInt(event.currentTarget.value) || 1);
    const itemIndex = this.results.findIndex(r => r.type === 'item' && r.item?._id === itemId);
    
    if (itemIndex !== -1) {
      const item = this.results[itemIndex];
      item.quantity = newQuantity;
      item.value = this._calculateItemValue(item.item, newQuantity);
      this.totalValue = this._calculateTotalValue();
      this._updateContent();
    }
  }

  async _onClearResults(event) {
    event.preventDefault();
    this.results = [];
    this.totalValue = 0;
    await this._updateContent();
  }

  async _onAddCoins(event = null) {
    if (event) event.preventDefault();
    const coinType = this.element.find('input[name="coinType"]:checked').val() || 'random';
    const amountType = this.element.find('input[name="coinAmount"]:checked').val() || 'random';
    this.selectedCoinType = coinType;
    this.selectedAmountType = amountType;

    const range = TreasurePile.getCoinAmountRange(amountType);
    const goldValue = Number((Math.random() * (range.max - range.min) + range.min).toFixed(2));
    let coins = { pp: 0, gp: 0, sp: 0, cp: 0 };

    if (coinType === 'random') {
      coins = this._distributeCoinsRandomly(goldValue);
    } else {
      coins[coinType] = Math.floor(TreasurePile.convertCurrency(goldValue, 'gp', coinType));
    }

    let coinResult = this.results.find(r => r.type === 'coins');
    if (coinResult) {
      Object.entries(coins).forEach(([type, amount]) => {
        coinResult.coins[type] = (coinResult.coins[type] || 0) + amount;
      });
      coinResult.value = this._calculateCoinValue(coinResult.coins);
    } else {
      this.results.push({
        type: 'coins',
        coins: { ...coins },
        value: this._calculateCoinValue(coins)
      });
    }

    this.totalValue = this._calculateTotalValue();
    await this._updateContent();
  }

  async _getAvailableTables(defaultTables = []) {
    const tables = game.tables.contents.map(table => ({
      id: table.id,
      name: table.name,
      isDefault: defaultTables.includes(table.id)
    }));
    tables.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
    return tables;
  }

  async _exportToJournal(journalId, createNew = false, newJournalName = '', pageName = '') {
    const content = this._formatExportResults();
    let journal;
    if (createNew) {
      // Create a new journal entry with a single page
      journal = await JournalEntry.create({
        name: newJournalName || game.i18n.localize('LOOTABLE.tsrplIntf.exportWin.newJournalDefault'),
        pages: [{
          name: pageName || game.i18n.localize('LOOTABLE.tsrplIntf.exportWin.newPageDefault'),
          type: 'text',
          text: { content, format: 1 }
        }]
      });
    } else {
      journal = game.journal.get(journalId);
      if (!journal) throw new Error('No valid journal found');
      // Add a new page to the existing journal
      await journal.createEmbeddedDocuments('JournalEntryPage', [{
        name: pageName || game.i18n.localize('LOOTABLE.tsrplIntf.exportWin.newPageDefault'),
        type: 'text',
        text: { content, format: 1 }
      }]);
    }
    ui.notifications.info(game.i18n.localize('LOOTABLE.tsrplIntf.notice.exportSuccess'));
  }
}