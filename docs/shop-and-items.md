---
title: Shop and items
description: Buy gear, ammo, beer, and train upgrades from the town shop using gold and silver you mine on the way.
---

# Shop and items

Towns along the route have a shop NPC who buys your ores and sells gear. The shop opens automatically when you press `E` next to the NPC.

## How money works

You earn money by selling ore at the shop:

- **Gold** — $5 per piece
- **Silver** — $3 per piece
- **Coal** — not sold; feed it to the train at the coal car for 50 fuel per piece

Mining only works while the train is fully stopped, so use town stops and station breaks to top up your inventory.

## Items

### Player gear

| Item | Cost | Effect |
| --- | --- | --- |
| Bomb | $5 | Adds one bomb. Throw with `F` to deal area damage at the cursor. |
| Bandage (+50 HP) | $2 | Instantly heals 50 HP, capped at your max HP. |
| Warm Clothes | $11 | Slows the cold meter in tundra biomes. |
| Knife (56 DMG) | $5 | Unlocks the knife. Press `Space` to stab nearby enemies for 56 damage (20% more while drunk). |
| Ammo Pack (+6) | $4 | Adds 6 rounds to your reserve ammo. Limited to 3 per shop refresh. |

### Beer

Two new shop items support the saloon system:

| Item | Cost | Effect |
| --- | --- | --- |
| Beer Bottle | $3 | Adds one bottle to your inventory. Use a bottle on a placed Beer Barrel to refill it (~5 sips per bottle). Limited to 4 per shop refresh. |
| Beer Barrel | $11 | Adds one placeable barrel to your inventory. Place it on the train to share with the group. Limited to 2 per shop refresh. |

Beer Bottles and Beer Barrels are tracked separately in your inventory.

#### Drinking and getting drunk

Sipping from a barrel makes you drunk. Drunk effects are cumulative and timed:

- 3+ sips: +11% movement speed and +20% damage on guns and knife.
- 11 sips: you explode. Pace yourself.

Each barrel holds 67 sips and goes on a short cooldown between drinks per player.

### Regen tiers

Buy higher tiers to overwrite lower ones; only the highest active tier applies.

| Item | Cost | Effect |
| --- | --- | --- |
| Regen (+2 HP/s) | $8 | Passive health regeneration. |
| Regen (+4 HP/s) | $8 | Replaces the +2 tier. |
| Regen (+6 HP/s) | $8 | Replaces lower tiers. |

### Train upgrades

These are global purchases—buying them benefits every player on the train.

| Item | Cost | Effect |
| --- | --- | --- |
| Fuel Tank (+200) | $7 | Increases the train's max fuel by 200. Up to 4 levels. |
| Train Speed (+11%) | $15 | One-time speed boost. Only appears in the shop ~38% of the time and only if you haven't already bought it. |

## Placing a Beer Barrel

You must be standing on the train to place a barrel:

1. Buy a Beer Barrel from the shop.
2. Walk onto the train cars.
3. Trigger the place action (the client emits `placeBarrel`).
4. The barrel appears at your current position with 67 sips and is visible to the whole group.

```js
// Place a beer barrel from the client
socket.emit('placeBarrel');
```

If you're not on the train, or you have no Beer Barrels in your inventory, the action is ignored.
