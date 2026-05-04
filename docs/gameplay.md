---
title: Gameplay overview
description: How a run works—biomes, towns, train fuel, enemy raids, and the win condition.
---

# Gameplay overview

You're crewing an 1870s steam train across the continent. Each run mixes mining, fighting, and resource management. Survive long enough to reach the final stop, and you win.

## A run, end to end

1. **Lobby.** Players join, pick a name, and the host starts the game. See [Lobbies and multiplayer](./lobbies).
2. **Departure.** Start the train at the engine. The whole group has 8 seconds to climb aboard before it pulls out.
3. **Wilderness.** While moving, you can fight off raiders and ride the train. Mining is locked while in motion.
4. **Town arrival.** As the train approaches a town, you'll get a heads-up message—use it to reload, drink, or position before the stop.
5. **Town stop.** The train halts. Mine nearby ore nodes, sell at the shop NPC, refuel at the coal car, and re-stock gear.
6. **Repeat.** Press the engine button again to depart. Each leg gets you closer to the final destination.

## Biomes

The route cycles through three biomes, in this order:

1. Forest
2. Desert
3. Tundra (cold meter ticks down faster; **Warm Clothes** slows the bleed)
4. Desert
5. Forest

Mountain stretches and avalanches can interrupt any biome.

## Train state

The train has five states:

| State | Behavior |
| --- | --- |
| `STOPPED` | You can mine and interact with town objects. Fuel doesn't burn. |
| `DEPARTING` | 8-second countdown. Climb on board. |
| `ACCELERATING` | Speeding up. Don't step off. |
| `MOVING` | Cruising. Mining is locked. |
| `SLOWING` | Coming to a stop. Don't step off yet. |

Stepping off the train (leaving the rectangle from x: -400 to x: 280, y: -50 to y: 50) while it's not `STOPPED` kills your character instantly.

## Fuel

The tender starts with 1003 fuel and burns down as the train moves. To keep going:

- Mine **coal** ore in the wilderness or at town stops.
- Press `E` at the **coal car** (the second car from the engine) to dump all coal in your inventory. Each piece adds 50 fuel.
- Buy **Fuel Tank** upgrades at the shop to raise the cap by 200 per level (up to 4 levels).

If fuel hits 0, the train can't depart from the next stop until you refuel.

## Enemies and raids

Enemies spawn in groups in the wilderness and around towns:

- **Gunmen** (30 HP) — ranged shooters.
- **Knifemen** (40 HP) — close-range.
- **Bombmen** — rare, throw bombs.
- **Horseback enemies** — mobile gunmen. Killing one drops a free horse you can mount.

Wilderness encounters are deliberately rare—only ~20% of legs spawn an extra group, and 70% of attempted spawns are skipped. Most pressure comes from town visits and scripted raids.

```js
// Server-side spawn probability for an extra wilderness group
if (Math.random() < 0.2) groups++;
```

## Combat

- **Shoot:** left click. 30 base damage, 5-round magazine, 32 reserve.
- **Stab:** `Space`. Requires the **Knife** ($5 from the shop). 56 base damage, 50-unit reach.
- **Bomb:** `F`. Lands at the cursor. AoE; you start with 0 and buy more for $5 each.
- Drunk players (3+ sips) do 20% more damage with guns and knives.

## Death and victory

When you die, you switch to spectator mode and follow surviving teammates.

When the whole crew dies—or the train reaches the final stop and triggers victory—the run enters [restart voting](./lobbies#restart-voting).
