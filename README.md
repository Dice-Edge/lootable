# Lootable!

[![GitHub release](https://img.shields.io/github/release/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/releases/)
[![GitHub issues](https://img.shields.io/github/issues/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/issues/)
[![GitHub stars](https://img.shields.io/github/stars/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/stargazers/)
[![GitHub license](https://img.shields.io/github/license/Dice-Edge/lootable.svg)](https://github.com/Dice-Edge/lootable/blob/main/LICENSE)
[![Foundry Shield](https://img.shields.io/badge/Foundry-v11-informational)](https://foundryvtt.com)

[![Support me on Patreon](https://img.shields.io/badge/Support%20me%20on-Patreon-orange?style=for-the-badge&logo=patreon)](https://www.patreon.com/diceedge)

A Foundry VTT module that automatically adds loot to NPCs when they are added to a scene, using rollable tables and configurable settings.

## Features

### Pocket Change
Automatically adds currency to NPCs based on their Challenge Rating (CR) when they are placed on the scene.

- **Configurable Currency Generation**: Set the amount of coins NPCs receive based on their CR
- **Creature Type Filtering**: Specify which creature types can receive coins (e.g., humanoid, beast, monstrosity)
- **Probability Settings**: Configure chances for different coin amounts:
  - Penniless (no coins)
  - Squalid (10% of normal coins)
  - Poor (50% of normal coins)
  - Normal (base amount)
  - Wealthy (double coins)
  - Rich (triple coins)
- **Ignore Existing Currency**: Option to skip NPCs that already have currency

### Random Loot
Automatically adds items to NPCs from rollable tables based on their creature type and CR.

- **Creature Type Tables**: Configure which rollable tables to use for different creature types
- **CR Range Filtering**: Set different loot tables based on CR ranges
- **Creature Subtype Support**: Further refine loot tables by creature subtype
- **Better Tables Integration**: Compatible with the Better Tables module

### General Features
- **Chat Messages**: Configurable chat messages when loot is added
- **Debug Mode**: Enable detailed logging for troubleshooting
- **User Interface**: Dedicated settings forms for easy configuration
- **DnD5e Integration**: Designed to work with the DnD5e system

## Requirements
- Foundry VTT v11+
- DnD5e System v3.0.0+

## Installation
1. In the Foundry VTT setup screen, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Enter the following URL in the "Manifest URL" field: https://github.com/Dice-Edge/lootable/raw/main/module.json
4. Click "Install"

## Usage

### Setup
1. After enabling the module, access the module settings through the Game Settings menu
2. Configure "Pocket Change" settings to determine how currency is generated
3. Configure "Random Loot" settings to link creature types to rollable tables

### In-Game
- When you place an NPC token on the scene, the module automatically:
  1. Adds appropriate currency based on the NPC's CR and your settings
  2. Rolls on the configured loot tables based on the NPC's creature type
  3. Adds the resulting items to the NPC's inventory
  4. Sends a chat message with the generated loot (if enabled)

## Credits
Created by Dice Edge

## License
[LICENSE](LICENSE) 