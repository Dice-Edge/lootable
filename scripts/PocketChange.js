export class PocketChange {
  static async onCreateToken(tokenDoc, options, userId) {
    if (!game.user.isGM || game.userId !== userId) return;

    let enableDebug = game.settings.get('lootable', 'enableDebug');
    
    if (game.settings.get('lootable', 'disablePocketChange')) {
      return;
    }

    let perCoinAmount = game.settings.get('lootable', 'perCoinAmount');
    let minCoinAmount = game.settings.get('lootable', 'minCoinAmount');
    let ignoreExistingCoin = game.settings.get('lootable', 'ignoreExistingCoin');
    let allowedCreatureTypes = game.settings.get('lootable', 'allowedCreatureTypes').split(',').map(type => type.trim().toLowerCase());
    let hidePocketChangeChatMsg = game.settings.get('lootable', 'hidePocketChangeChatMsg');

    let token = tokenDoc.object;
    let actor = token.actor;
    if (!actor) {
      return;
    }

    let tokenName = token.name;
    let currency = actor.system.currency;
    let CR = actor.system.details.cr;
    let creatureType = actor.system.details.type?.value?.toLowerCase() || "unknown";

    if (enableDebug) {
      console.log(`%cLootable DEBUG |%c Token: ${tokenName} | Creature Type: ${creatureType} | CR: ${CR}`, 'color: #940000;', 'color: inherit');
    }

    if (CR === undefined || CR === null) {
      return;
    }

    if (!allowedCreatureTypes.includes(creatureType)) {
      return;
    }
    if (ignoreExistingCoin && currency && (currency.gp || currency.sp || currency.ep || currency.pp || currency.cp)) {
      return;
    }

    let { cp, multiplier, isPenniless, debugInfo } = PocketChange.calculatePocketChange(CR, perCoinAmount);
    if (cp > 0 || isPenniless) {
      let result = PocketChange.convertCurrency(cp, minCoinAmount);
      let { cp: finalCp, pp, gp, sp, debugInfo: conversionDebugInfo } = result;
      
      if (enableDebug && debugInfo) {
        let fullDebugInfo = debugInfo;
        if (conversionDebugInfo) {
          fullDebugInfo += " | " + conversionDebugInfo;
        }
        console.log(`%cLootable DEBUG |%c ${fullDebugInfo} | Coin Added: ${pp}pp, ${gp}gp, ${sp}sp, ${finalCp}cp`, 'color: #940000;', 'color: inherit');
      }
      
      if (currency) {
        await actor.update({
          "system.currency.cp": (currency.cp || 0) + finalCp,
          "system.currency.pp": (currency.pp || 0) + pp,
          "system.currency.gp": (currency.gp || 0) + gp,
          "system.currency.sp": (currency.sp || 0) + sp,
        });
      } else {
        return;
      }
      if (!hidePocketChangeChatMsg) {
        let content = await renderTemplate(`modules/lootable/templates/coinMessage.hbs`, {
          tokenName: tokenName,
          cp: finalCp,
          sp: sp,
          gp: gp,
          pp: pp,
          isPenniless: isPenniless
        });
        ChatMessage.create({
          content: content,
          whisper: ChatMessage.getWhisperRecipients(`GM`),
          flags: { "lootable": { coinGenerated: true } }
        });
      }
    }
  }

  static calculatePocketChange(CR, percentage) {
    let enableDebug = game.settings.get('lootable', 'enableDebug');
    let noCoinChance = game.settings.get('lootable', 'noCoinChance') * 100;
    let doubleCoinChance = game.settings.get('lootable', 'doubleCoinChance') * 100;
    let tripleCoinChance = game.settings.get('lootable', 'tripleCoinChance') * 100;
    let halfGoldChance = game.settings.get('lootable', 'halfGoldChance') * 100;
    let tenPercentGoldChance = game.settings.get('lootable', 'tenPercentGoldChance') * 100;

    let multiplier = 1;
    let outcomes = [
      { type: 'noCoin', chance: noCoinChance, name: 'Penniless' },
      { type: 'doubleCoin', chance: doubleCoinChance, name: 'Affluent' },
      { type: 'tripleCoin', chance: tripleCoinChance, name: 'Rich' },
      { type: 'halfGold', chance: halfGoldChance, name: 'Poor' },
      { type: 'tenPercentGold', chance: tenPercentGoldChance, name: 'Squalid' }
    ];

    let totalChance = outcomes.reduce((sum, outcome) => sum + outcome.chance, 0);
    let normalChance = Math.max(0, 100 - totalChance);
    outcomes.push({ type: 'normal', chance: normalChance, name: 'Normal' });
    
    let roll = Math.random() * 100;
    let cumulativeChance = 0;
    let selectedOutcome;
    let profileName = 'Normal';
    let profileChance = normalChance;
    
    for (let outcome of outcomes) {
      cumulativeChance += outcome.chance;
      if (roll < cumulativeChance) {
        selectedOutcome = outcome.type;
        profileName = outcome.name;
        profileChance = outcome.chance;
        break;
      }
    }

    switch (selectedOutcome) {
      case 'noCoin':
        return { cp: 0, multiplier: 0, isPenniless: true, debugInfo: `Profile: ${profileName} (${profileChance.toFixed(2)}%) | No coins generated` };
      case 'doubleCoin':
        multiplier = 2;
        break;
      case 'tripleCoin':
        multiplier = 3;
        break;
      case 'halfGold':
        multiplier = 0.5;
        break;
      case 'tenPercentGold':
        multiplier = 0.1;
        break;
    }

    // Generate a random number between 100 and 300
    let diceRoll = Math.floor(Math.random() * (300 - 100 + 1) + 100);
    let crValue = CR === 0 ? 1/8 : CR;
    let baseCP = Math.round(diceRoll * crValue * percentage);
    let finalCP = Math.round(baseCP * multiplier);

    let debugInfo = `Profile: ${profileName} (${profileChance.toFixed(2)}%) | Base: Roll.100-300(${diceRoll}) × CR(${crValue}) = ${baseCP}cp | Final: Base(${baseCP}cp) × %F(${percentage}) × Profile(${multiplier}) = ${finalCP}cp`;

    return { cp: finalCP, multiplier: multiplier, isPenniless: false, debugInfo };
  }

  static convertCurrency(cp, minCoinAmount) {
    let pp = 0, gp = 0, sp = 0;
    let enableDebug = game.settings.get('lootable', 'enableDebug');
    let originalCp = cp;
    let minCoinUsed = false;
    let loopCount = 0;
    let conversionSteps = [];
    let anyConversionsPerformed = false;

    // Check if minimum coin amount should be applied
    if (cp > 0 && cp < minCoinAmount) {
      let beforeMinCoin = cp;
      cp += minCoinAmount;
      minCoinUsed = true;
      if (enableDebug) {
        console.log(`%cLootable DEBUG |%c Min Coin Used: ${beforeMinCoin}cp → ${cp}cp`, 'color: #940000;', 'color: inherit');
      }
    }

    do {
      loopCount++;
      let loopConversions = [];
      let startingCpForLoop = cp;
      let conversionsInThisLoop = false;
      
      // Try to convert to platinum (1000cp = 1pp)
      if (cp >= 1000) {
        let platinumValue = Math.floor((cp * Math.random()) / 1000);
        if (platinumValue > 0) {
          let beforeCp = cp;
          cp -= platinumValue * 1000;
          pp += platinumValue;
          loopConversions.push(`${beforeCp}cp → ${platinumValue}pp - ${cp}cp remaining`);
          conversionsInThisLoop = true;
          anyConversionsPerformed = true;
        }
      }
      
      // Try to convert to gold (100cp = 1gp)
      if (cp >= 100 && gp < 200) {
        let goldValue = Math.floor((cp * Math.random()) / 100);
        if (gp + goldValue > 200) {
          goldValue = 200 - gp;
          goldValue -= Math.floor(Math.random() * 6);
        }
        if (goldValue > 0) {
          let beforeCp = cp;
          cp -= goldValue * 100;
          gp += goldValue;
          loopConversions.push(`${beforeCp}cp → ${goldValue}gp - ${cp}cp remaining`);
          conversionsInThisLoop = true;
          anyConversionsPerformed = true;
        }
      }
      
      // Try to convert to silver (10cp = 1sp)
      if (cp >= 10 && sp < 200) {
        let silverValue = Math.floor((cp * Math.random()) / 10);
        if (sp + silverValue > 200) {
          silverValue = 200 - sp;
          silverValue -= Math.floor(Math.random() * 6);
        }
        if (silverValue > 0) {
          let beforeCp = cp;
          cp -= silverValue * 10;
          sp += silverValue;
          loopConversions.push(`${beforeCp}cp → ${silverValue}sp - ${cp}cp remaining`);
          conversionsInThisLoop = true;
          anyConversionsPerformed = true;
        }
      }
      
      // Add this loop's conversions to the steps if any happened
      if (conversionsInThisLoop) {
        conversionSteps.push(loopConversions.join(' | '));
      }
      
      // If no conversions happened this loop or we're below the threshold, break
      if (!conversionsInThisLoop || cp <= 100) {
        break;
      }
    } while (true);

    // Only return debug info if debugging is enabled
    if (enableDebug) {
      let minCoinInfo = minCoinUsed ? `Min Coin Used ${originalCp}cp → ${originalCp + minCoinAmount}cp` : '';
      let conversionInfo = '';
      
      if (anyConversionsPerformed) {
        conversionInfo = `Conversion (${loopCount} loops): ${conversionSteps.join(' | ')}`;
      } else {
        conversionInfo = 'No conversions performed';
      }
      
      let debugInfo = '';
      if (minCoinInfo) debugInfo += minCoinInfo;
      if (debugInfo && conversionInfo) debugInfo += ' | ';
      if (conversionInfo) debugInfo += conversionInfo;
      
      return { cp, pp, gp, sp, debugInfo };
    }

    return { cp, pp, gp, sp };
  }
}


