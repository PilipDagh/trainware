---
title: Controls
description: Keyboard, mouse, and touch controls for moving, fighting, and interacting in the game.
---

# Controls

Use these controls to move your character, fight enemies, and interact with the train and townsfolk.

## Keyboard and mouse

| Action | Input |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Shoot | Left click on the canvas |
| Mine ore | Left click an ore node (only while the train is stopped) |
| Reload | `R` |
| Interact | `E` |
| Throw bomb | `F` (lands at the cursor position) |
| Stab with knife | `Spacebar` |

`R` performs a manual reload. There is no auto-reload, so swap magazines yourself before a fight starts. Reloading moves rounds from your reserve ammo into your 5-round magazine.

`E` is a context-sensitive interact key. Walk up to a horse, the engine button, the coal car, the shop NPC, or a beer barrel and press `E`.

## Touch controls

On phones and tablets, on-screen controls appear automatically when the game starts. The HUD includes a movement pad (`W` `A` `S` `D`) and dedicated buttons for shoot, interact, reload, bomb, and knife. Pinch-to-zoom and page scrolling are disabled in-game so taps stay on the controls.

## Interactions

Pressing `E` resolves to the first valid action in this order:

1. **Mount a horse.** Stand within 40 units of a horse to ride it. Mounted players move ~8% faster.
2. **Start or stop the train.** Stand at the engine. Starting the train kicks off an 8-second departure timer—everyone needs to be on board before it leaves, or they explode.
3. **Refuel the train.** Stand at the coal car to dump your coal into the tender. Each piece of coal adds 50 fuel.
4. **Open the shop.** Stand near the shop NPC in town. Any gold or silver in your inventory is auto-sold ($5 per gold, $3 per silver) before the shop opens.
5. **Drink or refill a beer barrel.** Stand next to a placed barrel to take a sip, or use a Beer Bottle from your inventory to top it back up.

## Tips

- Don't leave the train while it's moving. You'll be ejected and killed instantly.
- Mining only works at full stops, so plan your runs around the train state.
- The 5-round magazine is small. Reload between waves, not during them.
