# Transcontinental Survival

A browser-based multiplayer co-op survival game set in the 1870s American frontier. Up to six players crew a steam train across 3,181 km of forest, desert, and tundra, fighting off bandits, mining ore, and managing fuel along the way.

[Edit in StackBlitz next generation editor](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Quickstart

Prerequisites: Node.js 18 or newer.

```bash
npm install
npm start
```

The server starts on port `3000` by default. Open `http://localhost:3000` in your browser to play. Set the `PORT` environment variable to bind to a different port.

## How to play

1. Enter your name on the main menu.
2. Choose **Create Lobby** to host a new game, or **Join Lobby** to join an existing one.
3. Once players have joined, the host clicks **Start Game**.
4. Survive the journey to 3,181 km. Reach the end as a team to win.

### Lobby system

- **Create Lobby** — set a lobby name, max players (1–6), and an optional password.
- **Join Lobby** — public lobbies appear automatically. Private lobbies prompt for a password.
- Lobbies are removed automatically when the last player disconnects.

### Controls

| Action | Key / Input |
|---|---|
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Shoot / mine | Left click |
| Interact / dump coal / mount horse | `E` |
| Reload | `R` |
| Throw bomb | `F` |
| Knife attack | `Space` |

Mobile devices show on-screen touch controls automatically.

## Gameplay

### Train

The train has five cars: engine, coal car, two passenger cars, and a caboose. The engine starts and stops the train when a player presses `E` next to it. The train has a 3-second cooldown between stops and starts.

- **Fuel** burns at 17 units/second while moving. Starting fuel and max capacity is 1,003.
- **Speed** is 35 km/h by default. Buying the speed upgrade adds 11%.
- Players who leave the train while it is moving are killed instantly. Enemies left behind when the train departs are also obliterated.

### Mining

When the train stops, ore deposits spawn within range. Stand near an ore and click to mine it.

| Ore | Sell value | Other use |
|---|---|---|
| Gold | $5 each | — |
| Silver | $3 each | — |
| Coal | — | Dump at the coal car for +50 fuel each |

Press `E` next to the coal car to dump all coal as fuel.

### Towns and shops

Towns appear every 274–497 km. When the train stops in a town, a Shop NPC spawns outside the train. Press `E` near the NPC to sell ore for cash and open the shop.

| Item | Cost | Effect |
|---|---|---|
| Bomb | $5 | Adds 1 throwable bomb |
| Bandage | $2 | Restores 50 HP |
| Warm Clothes | $11 | Prevents freezing in tundra |
| Knife | $5 | Enables 56-damage melee with `Space` |
| Ammo Pack | $4 | +6 reserve bullets (3 in stock per visit) |
| Fuel Tank | $7 | +200 max fuel (up to 4 upgrades) |
| Regen +2 / +4 / +6 HP/s | $8 | Persistent health regeneration |
| Train Speed +11% | $15 | Permanent speed boost (rare) |

### Combat

- Players start with 120 HP, a 5-round magazine, and 32 reserve bullets.
- Enemies spawn in three types: **gunmen** (ranged, 30 HP), **knifemen** (melee, 40 HP), and **bombmen** (lobbed bombs, 40 HP). Some enemies ride horses, which players can mount after killing the rider.
- **Raids** trigger occasionally while moving and bring waves of enemies onto the train. Surviving a raid heals 30 HP, or pays $2 if already at full HP.

### Biomes and hazards

The route passes through forest, desert, tundra, and back. Each biome introduces hazards:

- **Tundra** — players off the train freeze unless they own Warm Clothes. The cold meter starts at 167 and refills near the train.
- **Forest mountains** — rare avalanches stop the train and deal 50 damage to everyone on board if not stopped in time.

### Death and restart

When a player dies they enter spectator mode and can cycle through living teammates with **Spectate Next Player**. If everyone dies, any player can **Vote to Restart**. Once 30% of the lobby votes, the game resets after three seconds.

## Architecture

- **Server** — `server.js` runs an Express app with a Socket.IO server. The master game loop ticks at 30 FPS and broadcasts state to each room.
- **Client** — `public/index.html`, `public/client.js`, and `public/style.css` render the game on an HTML canvas and send player input over Socket.IO.
- **Rooms** — each lobby is an isolated room with its own train, players, enemies, ores, and event timers.
