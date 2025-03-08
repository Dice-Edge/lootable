export class PocketChange {
  static async onCreateToken(tokenDoc, options, userId) {
    if (!game.user.isGM || game.userId !== userId) return;

    let enableDebug = game.settings.get('lootable', 'enableDebug');
    
    if (game.settings.get('lootable', 'disablePocketChange')) {
      if (enableDebug) console.log(`%cLootable DEBUG |%c Pocket Change Disabled.`, 'color: #940000;', 'color: inherit');
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
      if (enableDebug) console.log(`%cLootable DEBUG |%c Token skipped - actor undefined.`, 'color: #940000;', 'color: inherit');
      return;
    }

    let tokenName = token.name;
    let currency = actor.system.currency;
    let CR = actor.system.details.cr;
    let creatureType = actor.system.details.type?.value?.toLowerCase() || "unknown";

    if (enableDebug) {
      console.log(`%cLootable DEBUG |%c Token: ${tokenName}`, 'color: #940000;', 'color: inherit');
      console.log(`%cLootable DEBUG |%c Creature Type: ${creatureType}`, 'color: #940000;', 'color: inherit');
      console.log(`%cLootable DEBUG |%c CR: ${CR}`, 'color: #940000;', 'color: inherit');
    }

    if (CR === undefined || CR === null) {
      if (enableDebug) console.log(`%cLootable DEBUG |%c ${tokenName} - no coin generated, invalid CR.`, 'color: #940000;', 'color: inherit');
      return;
    }

    if (!allowedCreatureTypes.includes(creatureType)) {
      if (enableDebug) console.log(`%cLootable DEBUG |%c ${tokenName} - no coin generated, creature type not included.`, 'color: #940000;', 'color: inherit');
      return;
    }
    if (ignoreExistingCoin && currency && (currency.gp || currency.sp || currency.ep || currency.pp || currency.cp)) {
      if (enableDebug) console.log(`%cLootable DEBUG |%c ${tokenName} - no coin generated, already has coin.`, 'color: #940000;', 'color: inherit');
      return;
    }

    let { cp, multiplier, isPenniless } = PocketChange.calculatePocketChange(CR, perCoinAmount);
    if (cp > 0 || isPenniless) {
      let { cp: finalCp, pp, gp, sp } = PocketChange.convertCurrency(cp, minCoinAmount);
      if (currency) {
        await actor.update({
          "system.currency.cp": (currency.cp || 0) + finalCp,
          "system.currency.pp": (currency.pp || 0) + pp,
          "system.currency.gp": (currency.gp || 0) + gp,
          "system.currency.sp": (currency.sp || 0) + sp,
        });
      } else {
        if (enableDebug) console.log(`%cLootable DEBUG |%c ${tokenName} - no coin generated, no coin entry field.`, 'color: #940000;', 'color: inherit');
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
      { type: 'noCoin', chance: noCoinChance },
      { type: 'doubleCoin', chance: doubleCoinChance },
      { type: 'tripleCoin', chance: tripleCoinChance },
      { type: 'halfGold', chance: halfGoldChance },
      { type: 'tenPercentGold', chance: tenPercentGoldChance }
    ];

    let totalChance = outcomes.reduce((sum, outcome) => sum + outcome.chance, 0);
    let normalChance = Math.max(0, 100 - totalChance);
    outcomes.push({ type: 'normal', chance: normalChance });
    
    if (enableDebug) {
      let chancesString = outcomes.map(outcome => `${outcome.type}: ${outcome.chance.toFixed(2)}%`).join(', ');
      console.log(`%cLootable DEBUG |%c Outcome chances: ${chancesString}`, 'color: #940000;', 'color: inherit');
    }

    let roll = Math.random() * 100;
    let cumulativeChance = 0;
    let selectedOutcome;
    for (let outcome of outcomes) {
      cumulativeChance += outcome.chance;
      if (roll < cumulativeChance) {
        selectedOutcome = outcome.type;
        break;
      }
    }

    switch (selectedOutcome) {
      case 'noCoin':
        if (enableDebug) console.log(`%cLootable DEBUG |%c Penniless profile used.`, 'color: #940000;', 'color: inherit');
        return { cp: 0, multiplier: 0, isPenniless: true };
      case 'doubleCoin':
        multiplier = 2;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Affluent profile used.`, 'color: #940000;', 'color: inherit');
        break;
      case 'tripleCoin':
        multiplier = 3;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Rich profile used.`, 'color: #940000;', 'color: inherit');
        break;
      case 'halfGold':
        multiplier = 0.5;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Poor profile used.`, 'color: #940000;', 'color: inherit');
        break;
      case 'tenPercentGold':
        multiplier = 0.1;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Squalid profile used.`, 'color: #940000;', 'color: inherit');
        break;
      default:
        if (enableDebug) console.log(`%cLootable DEBUG |%c Normal profile used.`, 'color: #940000;', 'color: inherit');
    }

    let baseCP = Math.round((Math.random() * (300 - 100) + 100) * (CR === 0 ? 1/8 : CR) * percentage);
    let finalCP = Math.round(baseCP * multiplier);

    if (enableDebug) console.log(`%cLootable DEBUG |%c Coin conversion START - Initial cp: ${baseCP}, cp Multiplier: ${multiplier}x, Starting cp: ${finalCP}.`, 'color: #940000;', 'color: inherit');

    return { cp: finalCP, multiplier: multiplier, isPenniless: false };
  }

  static convertCurrency(cp, minCoinAmount) {
    let pp = 0, gp = 0, sp = 0;
    let enableDebug = game.settings.get('lootable', 'enableDebug');

    if (cp > 0 && cp < minCoinAmount) {
      cp += minCoinAmount;
      if (enableDebug) console.log(`%cLootable DEBUG |%c Starting cp was less than ${minCoinAmount}. Added ${minCoinAmount}cp, new starting cp: ${cp}`, 'color: #940000;', 'color: inherit');
    }

    do {
      if (cp >= 1000) {
        let platinumValue = Math.floor((cp * Math.random()) / 1000);
        cp -= platinumValue * 1000;
        pp += platinumValue;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Converted to pp: ${pp}, remaining cp: ${cp}`, 'color: #940000;', 'color: inherit');
      }
      if (cp >= 100 && gp < 200) {
        let goldValue = Math.floor((cp * Math.random()) / 100);
        if (gp + goldValue > 200) {
          goldValue = 200 - gp;
          goldValue -= Math.floor(Math.random() * 6);
        }
        cp -= goldValue * 100;
        gp += goldValue;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Converted to gp: ${gp}, remaining cp: ${cp}`, 'color: #940000;', 'color: inherit');
      }
      if (cp >= 10 && sp < 200) {
        let silverValue = Math.floor((cp * Math.random()) / 10);
        if (sp + silverValue > 200) {
          silverValue = 200 - sp;
          silverValue -= Math.floor(Math.random() * 6);
        }
        cp -= silverValue * 10;
        sp += silverValue;
        if (enableDebug) console.log(`%cLootable DEBUG |%c Converted to sp: ${sp}, remaining cp: ${cp}`, 'color: #940000;', 'color: inherit');
      }
    } while (cp > 100);

    if (enableDebug) console.log(`%cLootable DEBUG |%c Coin conversion END - fewer than 100cp`, 'color: #940000;', 'color: inherit');
    return { cp, pp, gp, sp };
  }
}
