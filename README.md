# Lootable!

[![GitHub release](https://img.shields.io/github/release/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/releases/)
[![GitHub issues](https://img.shields.io/github/issues/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/issues/)
[![Foundry Shield](https://img.shields.io/badge/Foundry-v12-informational)](https://foundryvtt.com)
[![GitHub license](https://img.shields.io/github/license/Dice-Edge/lootable.svg)](https://github.com/Dice-Edge/lootable/blob/main/LICENSE)

[![Support me on Patreon](https://img.shields.io/badge/Support%20me%20on-Patreon-orange?style=for-the-badge&logo=patreon)](https://www.patreon.com/diceedge)

A Foundry VTT module that automatically adds loot to NPCs when they are added to a scene, using rollable tables and configurable settings.

## Features

### Pocket Change
Automatically adds currency to NPCs based on their Challenge Rating (CR) when they are placed on the scene.

- **Configurable Currency Generation**: Starting with a base amount of coin using the creature's CR, the module features a highly configurable pocket change generation system.
- **Creature Type Filtering**: Specify which creature types can receive coins (e.g., humanoid, beast, monstrosity)
- **Probability Settings**: Random profiles to have pocket change variance for creatures. Penniless (no coin), Squalid (1/10th the coin), Poor (1/2 the coin), Wealthy (double the coin), Rich (triple the coin)
- **Ignore Existing Currency**: Option to skip NPCs that already have currency

### Random Loot
Automatically adds items to NPCs from rollable tables based on their creature type and CR.

- **Creature Type Tables**: Configure which rollable tables to use for different creature types, subtypes, and even treasure types.
- **CR Range Filtering**: Set different loot tables based on CR ranges
- **Better Tables Integration**: Compatible with the Better Tables module for more advanced loot assignment. Multiple of the same items and multi-table rolling.

## Requirements
- Foundry VTT v12+
- DnD5e System v4+ (Lootable may work on earlier versions but is untested and not supported)

## Installation
1. In the Foundry VTT setup screen, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Search for Lootable! in the search bar and select Install. OR enter the following URL in the "Manifest URL" field: https://github.com/Dice-Edge/lootable/releases/latest/download/module.json and click "Install"

## Credits
Created by Dice Edge

## License
[LICENSE](LICENSE)
