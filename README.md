# Lootable!

[![GitHub release](https://img.shields.io/github/release/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/releases/)
[![GitHub issues](https://img.shields.io/github/issues/Dice-Edge/lootable.svg)](https://GitHub.com/Dice-Edge/lootable/issues/)
[![Foundry Shield](https://img.shields.io/badge/Foundry-v12-informational)](https://foundryvtt.com)
[![GitHub license](https://img.shields.io/github/license/Dice-Edge/lootable.svg)](https://github.com/Dice-Edge/lootable/blob/main/LICENSE)

[![Support me on Patreon](https://img.shields.io/badge/Support%20me%20on-Patreon-orange?style=for-the-badge&logo=patreon)](https://www.patreon.com/diceedge)

A Foundry VTT module that automatically adds loot to NPCs when they are added to a scene, using rollable tables and configurable settings.

## Features
Note: Each feature can be toggled off independently within their own settings.

### Pocket Change
Features a highly customizeable system that automatically adds coin to tokens based on their Challenge Rating (CR) when they are placed on the scene.

Setting Options
- **Percentage of Coin Amount**: A direct scale to the overall amount of coin a token receives. Default is 100%, lower number means fewer coins.
- **Minimum Coin Amount**: The lowest amount of coin a token can recieve in cp. This value will be added to the toal if it is less than the value.
- **Ignore Existing Coin**: Coin will not be generated on any token if they already have any currencies assigned.
- **Allowed Creature Types**: Here you can enter any creature types that you wish to generate coin, it is only humanoids by default.
- **Probablity Config**: This allows you to set differnt profiles and their chance to trigger a different amount from normal. If it does not roll one of these options then the default normal 100% coin profile will be used. Options are no coin, 1/10th of the coin, 1/2 the coin, 2 times the coin, three times the coin.

How to Use
- Simply set the configuration to what types of creatures you want to allow to generate coin then you can add a matching creature type token to any scene. As long as the NPC has a CR rating the coin will calculate and be added to that token automatically. Because the coin is not added to the actor if you place multiple tokens of the same creature they will all calculate independently.

Adding Pocket Change to a humanoid token:

![2025-04-10_14-34-10](https://github.com/user-attachments/assets/7f30325b-a33b-4d13-80de-cf10bdbf8ce7)

### Random Loot
A Robust configurable system that uses rollable tables and adds the loot rolled to a token. This can be done automatically when the token is added, or you can have it prompt each time a new token is added. The random loot can also be triggered using the Random Loot button added to the token HUD.

Setting Options
- **Random Loot Mode**: This allows you to switch between adding the token loot automatically when each token is added to a scene or through manual application from the token HUD only.
- **Show Loot Roll Promt**: This allows you to switch from automatically rolling on the table when added or instead having a prompt window that will allow you to roll on the table and see the results before adding them to the token. The prompt window also supports multiple rolling and the addition of all items rolled.
- **Hide Random Loot Button**: This hides the token HUD button used for manual rolling if you do not wish to use it.
- **Rolltable by Types**: This section allows you to add multiple entries based on the type or types that you wish to filter on when adding loot. The type fields are all optional and if left blank will count for all options of that type, multiple types can be entered as well per entry. Once the enty is added the table can be configured using the table selection button on the entry. Entries in red do not have any table assigned to them.

How to Use:
- By default there is a single entry that triggers only for humanoids of any subtype or treasure type and any CR rating but no table is assined. You should configure the entries as you prefer and assign a table to each entry. Once these are set up simply add a token to the scene to trigger the roll depending on your settings. You can also manually trigger the random loot by using the token HUD by right-clicking any NPC token already on the scene. The NPC must have a valid CR assigned or the loot will not generate.

Setting up and rolling random loot for token:

![2025-04-10_14-47-19](https://github.com/user-attachments/assets/05fd280d-3137-4485-af6f-0519f68b4baf)

Using the Random Loot prompt to generate loot:

![2025-04-10_14-50-03](https://github.com/user-attachments/assets/4679802e-829e-4ff5-bc0c-7b824013a0a1)

Using the token HUD to prompt a new Random Loot roll:

![2025-04-10_14-51-06](https://github.com/user-attachments/assets/defde237-f035-46e9-b9aa-898a068b65fe)


## Requirements
- Foundry VTT v12+
- DnD5e System v4+
(Lootable may work on earlier versions but is untested and not supported)

## Installation
1. In the Foundry VTT setup screen, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Search for Lootable! in the search bar and select Install. OR enter the following URL in the "Manifest URL" field: https://github.com/Dice-Edge/lootable/releases/latest/download/module.json and click "Install"

## Credits
Created by Dice Edge

## License
[LICENSE](LICENSE)
